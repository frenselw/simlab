#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { XMLParser } = require("fast-xml-parser");
const {
  CdpClient, buildAndExtractPackage, cleanupResources, createServer, delay, devToolsPort,
  evaluate, fetchJson, findBrowser, listenServer, validateOwnedProfile, withTimeout
} = require("./position-time-browser-regression.js");

const root = path.resolve(__dirname, "..");
const slug = "hookes-law-spring-investigation-lab";
const tempRoot = fs.realpathSync(os.tmpdir());

function sourceParity() {
  const activityRoot = path.join(root, "sim", slug);
  const html = fs.readFileSync(path.join(activityRoot, "index.html"), "utf8");
  const manifest = fs.readFileSync(path.join(root, "sim", "manifests", `${slug}.xml`), "utf8");
  const refs = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1]).filter((value) => /\.(?:js|css)$/.test(value))
    .map((value) => value.startsWith("../") ? value.slice(3) : `${slug}/${value}`));
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
  const files = new Set([].concat(parsed.manifest?.resources?.resource?.file || [])
    .map((entry) => entry["@_href"]).filter((value) => value !== "config.js" && value !== `${slug}/index.html`));
  assert.deepEqual([...refs].sort(), [...files].sort(), "manifest and HTML runtime references differ");
  return [...refs].sort();
}

async function navigate(cdp, url, embedded = false) {
  await evaluate(cdp, embedded
    ? "(() => { const frame=document.getElementById('activity'); if (frame?.contentWindow) frame.contentWindow.__hookesLawDebug = undefined; })()"
    : "window.__hookesLawDebug = undefined");
  await cdp.send("Page.navigate", { url });
  await delay(250);
  const expectedUrl = JSON.stringify(url);
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = await evaluate(cdp, embedded
      ? `(() => { const frame=document.getElementById('activity'); return Boolean(window.location.href === ${expectedUrl} && frame?.contentWindow?.__hookesLawDebug && frame.contentDocument?.readyState === 'complete'); })()`
      : `Boolean(window.__hookesLawDebug && document.readyState === 'complete' && window.location.href === ${expectedUrl})`);
    if (ready) return;
    await delay(50);
  }
  throw new Error(`Hooke's law activity did not become ready: ${url}`);
}

async function setViewport(cdp, width, height, touch = false) {
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 760 });
  if (touch) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  else await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
}

async function touch(cdp, start, end) {
  const id = Math.floor(Math.random() * 100000) + 1;
  const point = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(start)] });
  for (let index = 1; index <= 8; index += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point({ x: start.x + (end.x - start.x) * index / 8, y: start.y + (end.y - start.y) * index / 8 })] });
    await delay(12);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(100);
}

function fixtureExpression(seed = 123) {
  return `(() => {
    const G=window.HookesLawGenerator,M=window.HookesLawModel,S=window.HookesLawScoring,P=window.HookesLawPersistence;
    const scenario=G.generateScenario({seed:${seed}}); let state=P.freshState(${seed});
    for(const springKey of ['A','B']){const spring=scenario.springs[springKey];state=P.transitions.replaceCalibration(state,springKey,{zeroM:spring.naturalLengthM,mode:'keyboard',moveM:.01},scenario);for(const loadKey of ['F1','F2','F3'])state=P.transitions.replaceMeasurement(state,springKey,loadKey,{loadKey,cursorM:M.endpointM(spring.naturalLengthM,S.forceByKey[loadKey],spring.kNPerM),mode:'keyboard',moveM:.01},scenario);}
    state=P.transitions.replaceModel(state,'A',2.5/scenario.springs.A.kNPerM,scenario);state=P.transitions.replaceModel(state,'B',2.5/scenario.springs.B.kNPerM,scenario);state=P.transitions.setPhase(state,'predict',scenario);
    for(const [index,spec] of scenario.predictions.entries())state=P.transitions.replacePrediction(state,index,spec.trueExtensionM,scenario);state=P.transitions.setPhase(state,'design',scenario);const best=M.optimalSafeDesign(scenario);state=P.transitions.replaceDesign(state,best.springKey,best.moduleCount,scenario);
    return state;
  })()`;
}

async function runDirectFlow(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1280, 800, false);
  await navigate(cdp, `${baseUrl}${launchPath}?browser=${label}`);
  const initial = await evaluate(cdp, `(() => { const d=document; return {
    presentation:window.__hookesLawDebug.getPresentation(), resultHidden:d.getElementById('resultPanel').classList.contains('is-hidden'),
    resultHtml:d.getElementById('resultPanel').innerHTML, body:d.body.textContent, stageTouch:getComputedStyle(d.getElementById('stage')).touchAction,
    debugPanelHidden:d.getElementById('debugPanel').classList.contains('is-hidden'),
    panelRange:d.getElementById('controlPanel').scrollHeight-d.getElementById('controlPanel').clientHeight,
    targetSizes:[...d.querySelectorAll('.drag-target:not([hidden])')].map((node)=>({w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height})),
    stageText:[...d.querySelectorAll('#stageSvg text')].map((node)=>node.textContent).filter(Boolean),
    mathPhysical:{zeroQuantity:Boolean(d.querySelector('#zeroReadout .math-quantity .math-number')),zeroUnit:d.querySelector('#zeroReadout .math-unit')?.textContent||'',forceButtons:[...d.querySelectorAll('[data-action=select-load]')].every((node)=>node.matches('.math-quantity')&&node.querySelector('.math-number')&&node.querySelector('.math-unit')),stageUnits:d.querySelectorAll('#stageSvg .math-unit').length,stageVariables:d.querySelectorAll('#stageSvg .math-variable').length},
    stageRectCount:d.querySelectorAll('#stageSvg rect').length,
    springFirstY:Number(d.querySelector('#stageSvg polyline')?.getAttribute('points')?.split(' ')[0]?.split(',')[1]),
    rulerTick:(()=>{const node=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='5 cm');return {x:Number(node?.getAttribute('x')),anchor:node?.getAttribute('text-anchor')||''};})(),
    rulerCaption:(()=>{const node=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='讀尺位置 / cm');return {x:Number(node?.getAttribute('x')),y:Number(node?.getAttribute('y')),anchor:node?.getAttribute('text-anchor')||''};})(),
    zeroGuide:(()=>{const node=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='零位'),rect=node?.getBoundingClientRect(),handle=d.getElementById('zeroDrag').getBoundingClientRect();return {x:Number(node?.getAttribute('x')),anchor:node?.getAttribute('text-anchor')||'',right:rect?.right,left:handle.left};})()
  }; })()`);
  assert.equal(initial.presentation, "editable", `${label}: direct startup is editable`);
  assert.equal(initial.resultHidden, true, `${label}: result panel starts hidden`);
  assert.equal(initial.resultHtml, "", `${label}: result DOM starts empty`);
  assert.equal(initial.debugPanelHidden, true, `${label}: debug shortcut stays hidden without debug=1`);
  assert.doesNotMatch(initial.body, /理想 k|最佳安全方案|實際伸長/, `${label}: editable accessibility tree has no reveal data`);
  assert.equal(initial.stageTouch, "pan-y", `${label}: stage owns the non-interactive pan-y contract`);
  assert.ok(initial.panelRange > 20, `${label}: control panel has an independent range`);
  assert.ok(initial.targetSizes.every(({ w, h }) => w >= 44 && h >= 44), `${label}: stable drag targets meet 44px minimum`);
  assert.equal(initial.mathPhysical.zeroQuantity, true, `${label}: live position readout uses a structured math quantity`);
  assert.equal(initial.mathPhysical.zeroUnit, "cm", `${label}: live position readout exposes cm as a unit span`);
  assert.equal(initial.mathPhysical.forceButtons, true, `${label}: force choices use structured number/unit spans`);
  assert.ok(initial.mathPhysical.stageUnits >= 1 && initial.mathPhysical.stageVariables >= 0, `${label}: SVG physical labels use math spans`);
  assert.ok(initial.stageText.includes("0"), `${label}: investigation SVG renders the origin label`);
  assert.ok(initial.stageText.includes("位置 / cm"), `${label}: investigation SVG renders the cm axis label`);
  assert.ok(!initial.stageText.some((text) => text.includes("真實探究現象")), `${label}: redundant investigation title is removed`);
  assert.equal(initial.stageRectCount, 0, `${label}: no load block is drawn before a load is attached`);
  assert.equal(initial.springFirstY, 42, `${label}: unloaded spring touches the ceiling anchor`);
  assert.ok(initial.rulerTick.x < 98 && initial.rulerTick.anchor === "end", `${label}: ruler tick labels sit left of the vertical axis`);
  assert.deepEqual(initial.rulerCaption, { x: 98, y: 480, anchor: "middle" }, `${label}: ruler caption is centered below the axis`);
  assert.equal(initial.zeroGuide.anchor, "end", `${label}: zero guide label is right-aligned before its drag handle`);
  assert.ok(initial.zeroGuide.right < initial.zeroGuide.left - 2, `${label}: zero guide label is not covered by its drag handle`);

  const zeroSnap = await evaluate(cdp, `(() => { const debug=window.__hookesLawDebug,state=debug.getState(),scenario=debug.getScenario(),spring=scenario.springs[state.activeSpring],svg=document.querySelector('#stageSvg'),targetY=42+spring.naturalLengthM/scenario.stage.spanM*(455-42),point=new DOMPoint(650,targetY).matrixTransform(svg.getScreenCTM());return {target:spring.naturalLengthM,start:state.working.zeroDraftM,y:point.y}; })()`);
  const zeroStart = await directPoint(cdp, "#zeroDrag");
  const zeroDirection = zeroSnap.target >= zeroSnap.start ? 1 : -1;
  await dragMouse(cdp, "#zeroDrag", { x: 0, y: zeroSnap.y + zeroDirection * 2 - zeroStart.y });
  const zeroAfter = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),spring=window.__hookesLawDebug.getScenario().springs[state.activeSpring];return {value:state.working.zeroDraftM,target:spring.naturalLengthM}; })()");
  assert.ok(Math.abs(zeroAfter.value - zeroAfter.target) < 1e-9, `${label}: near natural-length drag snaps to the exact spring end`);
  await clickDirect(cdp, "[data-action='record-calibration']");
  await clickDirect(cdp, "[data-action='select-load'][data-load='F1']");
  await clickDirect(cdp, "[data-action='attach-load']");
  await waitUntil(cdp, "document.getElementById('measurementStatus').textContent.includes('讀數只代表')", `${label}: snap test load did not settle`);
  const cursorGuideBefore = await evaluate(cdp, `(() => { const d=document,node=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='游標'),rect=node?.getBoundingClientRect(),handle=d.getElementById('cursorDrag').getBoundingClientRect();return {x:Number(node?.getAttribute('x')),anchor:node?.getAttribute('text-anchor')||'',right:rect?.right,left:handle.left}; })()`);
  assert.equal(cursorGuideBefore.anchor, "end", `${label}: cursor guide label is right-aligned before its drag handle`);
  assert.ok(cursorGuideBefore.right < cursorGuideBefore.left - 2, `${label}: cursor guide label is not covered by its drag handle`);
  const cursorSnap = await evaluate(cdp, `(() => { const debug=window.__hookesLawDebug,state=debug.getState(),scenario=debug.getScenario(),spring=scenario.springs[state.activeSpring],target=window.HookesLawModel.endpointM(spring.naturalLengthM,window.HookesLawScoring.forceByKey[state.activeLoadKey],spring.kNPerM),svg=document.querySelector('#stageSvg'),targetY=42+target/scenario.stage.spanM*(455-42),point=new DOMPoint(650,targetY).matrixTransform(svg.getScreenCTM());return {target,start:state.working.cursorDraftM,y:point.y}; })()`);
  const cursorStart = await directPoint(cdp, "#cursorDrag");
  const cursorDirection = cursorSnap.target >= cursorSnap.start ? 1 : -1;
  await dragMouse(cdp, "#cursorDrag", { x: 0, y: cursorSnap.y + cursorDirection * 2 - cursorStart.y });
  const cursorAfter = await evaluate(cdp, "(() => { const debug=window.__hookesLawDebug,state=debug.getState(),spring=debug.getScenario().springs[state.activeSpring],target=window.HookesLawModel.endpointM(spring.naturalLengthM,window.HookesLawScoring.forceByKey[state.activeLoadKey],spring.kNPerM);return {value:state.working.cursorDraftM,target}; })()");
  assert.ok(Math.abs(cursorAfter.value - cursorAfter.target) < 1e-9, `${label}: near loaded-endpoint drag snaps to the exact spring end`);
  const cursorGuideAfter = await evaluate(cdp, "(() => { const d=document,node=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='游標');return {present:Boolean(node),x:Number(node?.getAttribute('x')),anchor:node?.getAttribute('text-anchor')||''}; })()");
  assert.deepEqual(cursorGuideAfter, { present:true, x:596, anchor:"end" }, `${label}: cursor guide label remains visible after moving the measurement line`);

  await evaluate(cdp, `(() => { const answer=${fixtureExpression(123)}; window.__hookesLawDebug.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer}}); })()`);
  await evaluate(cdp, "document.querySelector('[data-action=to-review]').click()");
  await delay(80);
  const review = await evaluate(cdp, `(() => ({ phase:window.__hookesLawDebug.getState().phase, hidden:document.getElementById('resultPanel').classList.contains('is-hidden'), text:document.getElementById('controlPanel').textContent }))()`);
  assert.equal(review.phase, "review", `${label}: complete authority reaches review`);
  assert.equal(review.hidden, true, `${label}: review has no result panel`);
  assert.doesNotMatch(review.text, /理想 k|最佳安全方案|實際伸長/, `${label}: review has no correctness or actual endpoint`);

  await evaluate(cdp, "document.querySelector('[data-action=submit]').click()");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(cdp, "window.__hookesLawDebug.getPresentation() === 'submitted-success'")) break;
    await delay(25);
  }
  const result = await evaluate(cdp, `(() => ({ presentation:window.__hookesLawDebug.getPresentation(), hidden:document.getElementById('resultPanel').classList.contains('is-hidden'), text:document.getElementById('resultPanel').textContent, score:window.__hookesLawDebug.getResult()?.score }))()`);
  assert.equal(result.presentation, "submitted-success", `${label}: standalone submission reaches success`);
  assert.equal(result.hidden, false, `${label}: result panel is revealed only after success`);
  assert.equal(result.score, 100, `${label}: perfect fixture rescores to 100`);
  assert.match(result.text, /理想 k|最佳安全方案|實際伸長/, `${label}: result contains post-submit reveal data`);
  return `${label}: delayed feedback and success result passed`;
}

async function runDebugShortcut(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1280, 800, false);
  await navigate(cdp, `${baseUrl}${launchPath}?debug=1&browser=${label}`);
  const initial = await evaluate(cdp, "(() => ({ phase:window.__hookesLawDebug.getState().phase, visible:!document.getElementById('debugPanel').classList.contains('is-hidden'), checked:document.getElementById('debugCompleteInvestigation').checked }))()");
  assert.equal(initial.phase, "investigate", `${label}: debug shortcut starts in the first phase`);
  assert.equal(initial.visible, true, `${label}: debug shortcut panel is visible with debug=1`);
  assert.equal(initial.checked, false, `${label}: debug shortcut starts off`);
  await clickDirect(cdp, "#debugCompleteInvestigation");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'model'", `${label}: debug shortcut did not enter the model phase`);
  const completed = await evaluate(cdp, `(() => {
    const debug=window.__hookesLawDebug,state=debug.getState(),scenario=debug.getScenario(),
      errors=['A','B'].flatMap((springKey)=>['F1','F2','F3'].map((loadKey)=>Math.abs(state.measurements[springKey][loadKey].cursorM-window.HookesLawModel.endpointM(scenario.springs[springKey].naturalLengthM,window.HookesLawScoring.forceByKey[loadKey],scenario.springs[springKey].kNPerM))));
    return {phase:state.phase,activeSpring:state.activeSpring,checked:document.getElementById('debugCompleteInvestigation').checked,complete:window.HookesLawPersistence.hasAllCalibrationsAndMeasurements(state),maxError:Math.max(...errors)};
  })()`);
  assert.equal(completed.phase, "model", `${label}: debug shortcut enters the model phase`);
  assert.equal(completed.activeSpring, "A", `${label}: debug shortcut opens the first model spring`);
  assert.equal(completed.checked, true, `${label}: debug shortcut remains visibly enabled`);
  assert.equal(completed.complete, true, `${label}: debug shortcut fills all first-phase records`);
  assert.ok(completed.maxError < 1e-9, `${label}: debug shortcut fills exact endpoint answers`);
  return `${label}: first-phase debug shortcut passed`;
}

async function iframeMetrics(cdp) {
  return evaluate(cdp, `(() => { const frame=document.getElementById('activity'),fr=frame.getBoundingClientRect(),d=frame.contentDocument,p=d.getElementById('controlPanel'),a=d.getElementById('app');return {
    frame:{left:fr.left,top:fr.top,width:fr.width,height:fr.height},
    inner:frame.contentWindow.innerHeight,htmlHeight:d.documentElement.scrollHeight,bodyHeight:d.body.scrollHeight,htmlOverflow:getComputedStyle(d.documentElement).overflow,bodyOverflow:getComputedStyle(d.body).overflow,
    appHeight:a.getBoundingClientRect().height,panelRange:p.scrollHeight-p.clientHeight,panelScroll:p.scrollTop,hostScroll:scrollY
  }; })()`);
}

async function outerPoint(cdp, selector, point = "center") {
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),r=f.contentDocument.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+(${JSON.stringify(point)}==='top'?8:r.height/2)}; })()`);
}

async function directPoint(cdp, selector) {
  return evaluate(cdp, `(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!node || node.hidden) throw new Error('Missing visible target '+${JSON.stringify(selector)}); const r=node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
}

async function clickDirect(cdp, selector) {
  await evaluate(cdp, `(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!node) throw new Error('Missing button '+${JSON.stringify(selector)}); node.click(); })()`);
  await delay(45);
}

async function dragMouse(cdp, selector, delta) {
  const start = await directPoint(cdp, selector);
  const endPoint = { x: start.x + delta.x, y: start.y + delta.y };
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x, y: start.y, buttons: 0 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: start.x, y: start.y, button: "left", clickCount: 1 });
  for (let index = 1; index <= 6; index += 1) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x + (endPoint.x - start.x) * index / 6, y: start.y + (endPoint.y - start.y) * index / 6, buttons: 1 });
    await delay(10);
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: endPoint.x, y: endPoint.y, button: "left", clickCount: 1 });
  await delay(80);
}

async function waitUntil(cdp, expression, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(40);
  }
  let detail = "";
  try { detail = JSON.stringify(await evaluate(cdp, "(() => ({state:window.__hookesLawDebug?.getState?.(),evidence:window.__hookesLawDebug?.interactionEvidence?.(),errors:window.__hookErrors||[],status:document.getElementById('measurementStatus')?.textContent,button:document.querySelector('[data-action=record-measurement]')?.disabled,target:document.getElementById('cursorDrag')?.getBoundingClientRect?.().toJSON?.()}))()")); } catch {}
  throw new Error(`${message} ${detail}`);
}

async function pressKey(cdp, selector, key, count = 1) {
  await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})?.focus()`);
  const virtualKeyCodes = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
  for (let index = 0; index < count; index += 1) {
    const virtualKeyCode = virtualKeyCodes[key];
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
    await delay(18);
  }
}

async function completeLearnerPath(cdp, baseUrl, launchPath, label, keyboard = false) {
  await setViewport(cdp, 390, 700, false);
  await navigate(cdp, `${baseUrl}${launchPath}?learner-path=${label}-${keyboard ? "keyboard" : "pointer"}`);
  await evaluate(cdp, "window.__hookErrors=[]; window.addEventListener('error',event=>window.__hookErrors.push(event.error?.stack||event.message));");
  for (const springKey of ["A", "B"]) {
    if (springKey !== "A") await clickDirect(cdp, `[data-action="spring-tab"][data-spring="${springKey}"]`);
    if (keyboard) await pressKey(cdp, "#zeroDrag", "ArrowUp", 6);
    else {
      await dragMouse(cdp, "#zeroDrag", { x: 0, y: 24 });
    }
    await clickDirect(cdp, "[data-action='record-calibration']");
    await waitUntil(cdp, `Boolean(window.__hookesLawDebug.getState().calibrations.${springKey})`, `${label}: ${springKey} calibration did not save`);
    for (const loadKey of ["F1", "F2", "F3"]) {
      await clickDirect(cdp, `[data-action="select-load"][data-load="${loadKey}"]`);
      await clickDirect(cdp, "[data-action='attach-load']");
      await waitUntil(cdp, "document.getElementById('measurementStatus').textContent.includes('讀數只代表')", `${label}: load ${loadKey} did not settle`);
      if (keyboard) await pressKey(cdp, "#cursorDrag", "ArrowUp", 6);
      else {
        await dragMouse(cdp, "#cursorDrag", { x: 0, y: 30 });
      }
      await clickDirect(cdp, "[data-action='record-measurement']");
      await waitUntil(cdp, `Boolean(window.__hookesLawDebug.getState().measurements.${springKey}.${loadKey})`, `${label}: ${springKey}/${loadKey} measurement did not save`);
    }
  }
  await clickDirect(cdp, "[data-action='to-model']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'model'", `${label}: model phase did not open`);
  const modelAxis = await evaluate(cdp, "(() => { const d=document,node=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='F / N'),rect=node?.getBoundingClientRect(),tick=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='4'),tickRect=tick?.getBoundingClientRect();return {x:Number(node?.getAttribute('x')),anchor:node?.getAttribute('text-anchor')||'',right:rect?.right,tickLeft:tickRect?.left}; })()");
  assert.ok(modelAxis.x < 80 && modelAxis.anchor === "end", `${label}: vertical F axis label is separated from the tick numbers`);
  assert.ok(modelAxis.right < modelAxis.tickLeft, `${label}: vertical F axis label does not overlap the tick numbers`);
  for (const springKey of ["A", "B"]) {
    await clickDirect(cdp, `[data-action="model-spring-tab"][data-spring="${springKey}"]`);
    if (keyboard) { await pressKey(cdp, "#modelDrag", "ArrowUp", 6); await pressKey(cdp, "#modelDrag", "ArrowRight", 6); }
    else {
      await dragMouse(cdp, "#modelDrag", { x: 28, y: -28 });
    }
    const modelEvidence = await evaluate(cdp, "window.__hookesLawDebug.interactionEvidence()");
    assert.ok(modelEvidence.modelDraftForceN > 2.5, `${label}: model line control can move upward through the full graph`);
    await waitUntil(cdp, `Boolean(window.__hookesLawDebug.getState().models.${springKey})`, `${label}: ${springKey} model did not save`);
  }
  await clickDirect(cdp, "[data-action='to-predict']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'predict'", `${label}: predict phase did not open`);
  for (let index = 0; index < 3; index += 1) {
    if (index) await clickDirect(cdp, `[data-action="prediction-select"][data-index="${index}"]`);
    if (keyboard) await pressKey(cdp, "#predictionDrag", "ArrowUp", 6);
    else {
      await dragMouse(cdp, "#predictionDrag", { x: 0, y: 30 });
    }
    await waitUntil(cdp, `Boolean(window.__hookesLawDebug.getState().predictions[${index}])`, `${label}: prediction ${index + 1} did not save`);
  }
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'design'", `${label}: design phase did not open`);
  await clickDirect(cdp, "[data-action='design-spring'][value='A']");
  await clickDirect(cdp, "[data-action='module-plus']");
  await clickDirect(cdp, "[data-action='to-review']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'review'", `${label}: review did not open`);
  const review = await evaluate(cdp, "({phase:window.__hookesLawDebug.getState().phase,hidden:document.getElementById('resultPanel').classList.contains('is-hidden')})");
  assert.equal(review.phase, "review", `${label}: full learner path reaches review`);
  assert.equal(review.hidden, true, `${label}: full learner path remains neutral before submit`);
  await clickDirect(cdp, "[data-action='submit']");
  await waitUntil(cdp, "['submitted-success','submitted-committed'].includes(window.__hookesLawDebug.getPresentation())", `${label}: full learner path did not submit`);
  const result = await evaluate(cdp, "({presentation:window.__hookesLawDebug.getPresentation(),score:window.__hookesLawDebug.getResult()?.score})");
  assert.ok(["submitted-success", "submitted-committed"].includes(result.presentation), `${label}: result is locked`);
  assert.ok(Number.isFinite(result.score), `${label}: result has a numeric score`);
  return `${label}: complete ${keyboard ? "keyboard" : "pointer"} learner path passed`;
}

async function runTouchMatrix(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 390, 500, true);
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(`${baseUrl}${launchPath}?touch=${label}`)}`, true);
  const initial = await iframeMetrics(cdp);
  assert.ok(initial.panelRange > 20, `${label}: control panel owns a scroll range`);
  assert.ok(initial.htmlHeight <= initial.inner + 2 && initial.bodyHeight <= initial.inner + 2, `${label}: activity document has no third scroll owner ${JSON.stringify(initial)}`);
  assert.ok(["hidden", "clip"].includes(initial.htmlOverflow) && ["hidden", "clip"].includes(initial.bodyOverflow), `${label}: activity document overflow is bounded`);

  const blank = await outerPoint(cdp, "#stage", "top");
  const beforeHost = await evaluate(cdp, "scrollY");
  await touch(cdp, { x: blank.x + 25, y: blank.y + 70 }, { x: blank.x + 25, y: blank.y - 70 });
  const afterHost = await evaluate(cdp, "scrollY");
  assert.ok(afterHost > beforeHost, `${label}: trusted blank-stage swipe is owned by the enclosing host`);
  const afterBlank = await iframeMetrics(cdp);
  assert.equal(afterBlank.panelScroll, 0, `${label}: blank stage swipe does not scroll controls`);

  await evaluate(cdp, "(() => { const frame=document.getElementById('activity'); window.scrollTo(0, window.scrollY + frame.getBoundingClientRect().top); })()");
  await delay(50);
  await evaluate(cdp, "document.getElementById('activity').contentDocument.getElementById('controlPanel').scrollTop=0");
  const panelPoint = await outerPoint(cdp, "#controlPanel", "top");
  const panelHostBefore = await evaluate(cdp, "scrollY");
  await touch(cdp, { x: panelPoint.x + 20, y: panelPoint.y + 80 }, { x: panelPoint.x + 20, y: panelPoint.y - 80 });
  const panelAfter = await iframeMetrics(cdp);
  assert.ok(panelAfter.panelScroll > 0, `${label}: trusted control-panel swipe is owned by the panel ${JSON.stringify({ panelPoint, panelAfter, panelHostBefore })}`);
  assert.equal(await evaluate(cdp, "scrollY"), panelHostBefore, `${label}: panel swipe does not chain to host`);

  await evaluate(cdp, `(() => { const f=document.getElementById('activity'),d=f.contentDocument,w=f.contentWindow;w.__touchEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])d.addEventListener(type,e=>w.__touchEvents.push({type,isTrusted:e.isTrusted,pointerType:e.pointerType,target:e.target?.dataset?.dragTarget||e.target?.id||''}),true);d.getElementById('controlPanel').scrollTop=0;w.__before={host:scrollY,panel:d.getElementById('controlPanel').scrollTop}; })()`);
  const dragPoint = await outerPoint(cdp, "#zeroDrag");
  assert.ok(dragPoint.x > 0, `${label}: zero marker has a stable pre-pointerdown hit target`);
  await touch(cdp, dragPoint, { x: dragPoint.x, y: dragPoint.y - 65 });
  const dragAfter = await evaluate(cdp, `(() => { const f=document.getElementById('activity'),d=f.contentDocument,w=f.contentWindow,p=d.getElementById('controlPanel');return {events:w.__touchEvents,host:scrollY,panel:p.scrollTop,zero:w.__hookesLawDebug?.getState().working.zeroDraftM||null,target:d.elementFromPoint(${dragPoint.x - (await iframeOffset(cdp)).left},${dragPoint.y - (await iframeOffset(cdp)).top})?.id||''}; })()`);
  assert.equal(dragAfter.host, panelAfter.hostScroll, `${label}: drag does not move host`);
  assert.equal(dragAfter.panel, 0, `${label}: drag does not move panel`);
  assert.ok(dragAfter.events.some((event) => event.type === "pointermove" && event.isTrusted), `${label}: drag received trusted pointermove`);
  assert.ok(dragAfter.events.some((event) => event.type === "pointerup" && event.isTrusted), `${label}: drag received trusted pointerup`);
  assert.equal(dragAfter.events.some((event) => event.type === "pointercancel"), false, `${label}: drag completed without pointercancel`);

  for (const [width, height] of [[320, 500], [390, 600], [700, 390], [820, 700]]) {
    await setViewport(cdp, width, height, width < 760);
    await delay(80);
    const responsive = await iframeMetrics(cdp);
    assert.ok(Math.abs(responsive.appHeight - responsive.inner) < 3, `${label} ${width}x${height}: app is viewport-bounded`);
    assert.ok(responsive.htmlHeight <= responsive.inner + 3, `${label} ${width}x${height}: activity document remains bounded`);
  }
  return `${label}: host, panel and drag trusted-touch ownership passed`;
}

async function iframeOffset(cdp) {
  return evaluate(cdp, "(() => { const r=document.getElementById('activity').getBoundingClientRect();return {left:r.left,top:r.top}; })()");
}

async function main() {
  sourceParity();
  let sourceServer, packageServer, profileDirectory, packageDirectory, chrome, cdp, failure, summary, browserErrors = "";
  try {
    const browser = findBrowser();
    if (!browser) throw new Error("Chrome/Chromium is required for Hooke's law browser regression");
    const extracted = buildAndExtractPackage(tempRoot, { slug });
    packageDirectory = extracted.packageDirectory;
    sourceServer = createServer(root); packageServer = createServer(packageDirectory);
    await listenServer(sourceServer); await listenServer(packageServer);
    const sourceBase = `http://127.0.0.1:${sourceServer.address().port}`;
    const packageBase = `http://127.0.0.1:${packageServer.address().port}`;
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, "simlab-position-time-chrome-"));
    validateOwnedProfile(profileDirectory, tempRoot);
    const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "about:blank"];
    if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox");
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    chrome.stderr.on("data", (chunk) => { browserErrors = `${browserErrors}${chunk}`.slice(-4000); });
    const port = await withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome DevTools startup");
    const { body: target } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    cdp = new CdpClient(target.webSocketDebuggerUrl); await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    const sourceTouch = await runTouchMatrix(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageTouch = await runTouchMatrix(cdp, packageBase, extracted.activityPath, "package");
    const sourceDebug = await runDebugShortcut(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageDebug = await runDebugShortcut(cdp, packageBase, extracted.activityPath, "package");
    const sourceDirect = await runDirectFlow(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageDirect = await runDirectFlow(cdp, packageBase, extracted.activityPath, "package");
    const sourcePointer = await completeLearnerPath(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packagePointer = await completeLearnerPath(cdp, packageBase, extracted.activityPath, "package");
    const sourceKeyboard = await completeLearnerPath(cdp, sourceBase, `/sim/${slug}/index.html`, "source", true);
    const packageKeyboard = await completeLearnerPath(cdp, packageBase, extracted.activityPath, "package", true);
    summary = `Hooke's law browser regression passed: ${sourceDebug}; ${packageDebug}; ${sourceDirect}; ${packageDirect}; ${sourcePointer}; ${packagePointer}; ${sourceKeyboard}; ${packageKeyboard}; ${sourceTouch}; ${packageTouch}`;
  } catch (error) {
    if (browserErrors.trim()) error.message += `\nChrome stderr:\n${browserErrors.trim()}`;
    failure = error;
  }
  for (const server of [sourceServer, packageServer]) if (server) await new Promise((resolve) => server.close(resolve));
  try { await cleanupResources({ chrome, cdp, profileDirectory, packageDirectory, tempRoot }); }
  catch (error) { failure = new AggregateError(failure ? [failure, error] : [error], "Hooke's law browser regression cleanup failed"); }
  if (failure) throw failure;
  console.log(summary);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message || error); process.exitCode = 1; });
module.exports = { sourceParity, fixtureExpression };
