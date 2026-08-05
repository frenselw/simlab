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

function fixtureExpression(seed = 123, modelK = null) {
  const modelHandle = (springKey) => {
    const k = modelK?.[springKey];
    return Number.isFinite(k) && k > 0 ? String(2.5 / k) : `2.5/scenario.springs.${springKey}.kNPerM`;
  };
  return `(() => {
    const G=window.HookesLawGenerator,M=window.HookesLawModel,S=window.HookesLawScoring,P=window.HookesLawPersistence;
    const scenario=G.generateScenario({seed:${seed}}); let state=P.freshState(${seed});
    for(const springKey of ['A','B']){const spring=scenario.springs[springKey];state=P.transitions.replaceCalibration(state,springKey,{zeroM:spring.naturalLengthM,mode:'keyboard',moveM:.01},scenario);for(const loadKey of ['F1','F2','F3'])state=P.transitions.replaceMeasurement(state,springKey,loadKey,{loadKey,cursorM:M.endpointM(spring.naturalLengthM,S.forceByKey[loadKey],spring.kNPerM),mode:'keyboard',moveM:.01},scenario);}
    state=P.transitions.replaceModel(state,'A',${modelHandle("A")},scenario);state=P.transitions.replaceModel(state,'B',${modelHandle("B")},scenario);state=P.transitions.setPhase(state,'predict',scenario);
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
    springGroups:[...d.querySelectorAll('.spring-tabs')].map((group)=>({role:group.getAttribute('role'),label:group.getAttribute('aria-label'),buttons:[...group.querySelectorAll('button')].map((button)=>({text:button.textContent.trim(),pressed:button.getAttribute('aria-pressed'),selected:button.getAttribute('aria-selected')}))})),
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
  assert.doesNotMatch(initial.body, /理想 k|最佳安全方案|實際伸長|自然長度基準|工程方案/, `${label}: editable accessibility tree has no reveal data`);
  assert.equal(initial.stageTouch, "pan-y", `${label}: stage owns the non-interactive pan-y contract`);
  assert.ok(initial.panelRange > 20, `${label}: control panel has an independent range`);
  assert.ok(initial.targetSizes.every(({ w, h }) => w >= 44 && h >= 44), `${label}: stable drag targets meet 44px minimum`);
  assert.deepEqual(initial.springGroups.map((group) => group.role), ["group", "group"], `${label}: spring selectors use button groups`);
  assert.ok(initial.springGroups.every((group) => group.label && group.buttons.length === 2 && group.buttons.every((button) => button.pressed && button.selected === null)), `${label}: spring selector buttons expose pressed state without tab state`);
  await pressKey(cdp, "[data-action='spring-tab'][data-spring='B']", "Enter");
  const switchedSpring = await evaluate(cdp, "(() => ({active:window.__hookesLawDebug.getState().activeSpring,pressed:[...document.querySelectorAll('[data-action=\\\"spring-tab\\\"]')].map((node)=>node.getAttribute('aria-pressed'))}))()");
  assert.equal(switchedSpring.active, "B", `${label}: keyboard activation changes the active spring`);
  assert.deepEqual(switchedSpring.pressed, ["false", "true"], `${label}: keyboard activation synchronizes pressed state`);
  await clickDirect(cdp, "[data-action='spring-tab'][data-spring='A']");
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
  await evaluate(cdp, `(() => { const answer=${fixtureExpression(123)},G=window.HookesLawGenerator,P=window.HookesLawPersistence,scenario=G.generateScenario({seed:answer.seed}),review=P.transitions.setPhase(answer,'review',scenario),edited=P.transitions.editSection(review,'investigate',scenario); window.__hookesLawDebug.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer:edited}}); })()`);
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'investigate'", `${label}: measurement review edit could not reopen the investigation phase`);
  await clickDirect(cdp, "[data-action='select-load'][data-load='F1']");
  await clickDirect(cdp, "[data-action='attach-load']");
  await waitUntil(cdp, "document.getElementById('measurementStatus').textContent.includes('讀數只代表')", `${label}: measurement invalidation load did not settle`);
  await pressKey(cdp, "#cursorDrag", "ArrowDown", 6);
  await clickDirect(cdp, "[data-action='record-measurement']");
  const measurementInvalidation = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),spring=state.activeSpring; return {spring,status:document.getElementById('measurementStatus').textContent,live:document.getElementById('liveRegion').textContent,model:state.models[spring],predictions:state.predictions.filter(Boolean).length,design:state.design,fromReview:state.fromReview}; })()");
  assert.match(measurementInvalidation.status, /已更新/ , `${label}: changed measurement visibly says it was updated (${measurementInvalidation.status})`);
  assert.match(measurementInvalidation.status, /模型.*清除|清除.*模型/, `${label}: changed measurement explains model invalidation`);
  assert.match(measurementInvalidation.status, /重新完成/, `${label}: changed measurement asks for the affected later phases again`);
  assert.equal(measurementInvalidation.model, null, `${label}: changed measurement clears that spring model`);
  assert.equal(measurementInvalidation.predictions, 0, `${label}: changed measurement clears predictions`);
  assert.equal(measurementInvalidation.design, null, `${label}: changed measurement clears the design`);
  assert.equal(measurementInvalidation.fromReview, false, `${label}: changed measurement exits review continuation`);
  await evaluate(cdp, `(() => { const answer=${fixtureExpression(123)}; window.__hookesLawDebug.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer}}); })()`);
  await clickDirect(cdp, "[data-action='navigate-phase'][data-phase='model']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'model'", `${label}: model semantic regression could not open the model phase`);
  const modelBeforeNoOp = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),key=state.activeSpring; return {key,handle:state.models[key].handleExtensionM,predictions:JSON.stringify(state.predictions),design:JSON.stringify(state.design),fromReview:state.fromReview}; })()");
  await pressKey(cdp, "#modelDrag", "ArrowUp");
  await delay(45);
  const modelAfterVertical = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),key=state.activeSpring; return {handle:state.models[key].handleExtensionM,predictions:JSON.stringify(state.predictions),design:JSON.stringify(state.design),fromReview:state.fromReview,force:window.__hookesLawDebug.interactionEvidence().modelDraftForceN,status:document.getElementById('modelStatus').textContent,live:document.getElementById('liveRegion').textContent}; })()");
  assert.equal(modelAfterVertical.handle, modelBeforeNoOp.handle, `${label}: moving the model handle along the same line does not change the saved slope`);
  assert.equal(modelAfterVertical.predictions, modelBeforeNoOp.predictions, `${label}: same-line model movement preserves predictions`);
  assert.equal(modelAfterVertical.design, modelBeforeNoOp.design, `${label}: same-line model movement preserves design`);
  assert.equal(modelAfterVertical.fromReview, modelBeforeNoOp.fromReview, `${label}: same-line model movement preserves review continuation`);
  assert.notEqual(modelAfterVertical.force, 2.5, `${label}: same-line browser test actually moved the force handle`);
  assert.doesNotMatch(modelAfterVertical.status, /已清除|重新完成/, `${label}: same-line model movement does not show an invalidation notice`);
  assert.doesNotMatch(modelAfterVertical.live, /已清除|重新完成/, `${label}: same-line model movement does not announce an invalidation`);
  await pressKey(cdp, "#modelDrag", "ArrowRight");
  await delay(45);
  const modelAfterHorizontal = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),key=state.activeSpring,evidence=window.__hookesLawDebug.interactionEvidence(); return {handle:state.models[key].handleExtensionM,draft:evidence.modelDraftM,move:evidence.modelMoveM,predictions:state.predictions.filter(Boolean).length,design:state.design,fromReview:state.fromReview,status:document.getElementById('modelStatus').textContent,live:document.getElementById('liveRegion').textContent}; })()");
  assert.notEqual(modelAfterHorizontal.handle, modelBeforeNoOp.handle, `${label}: horizontal model movement commits a changed slope`);
  assert.equal(modelAfterHorizontal.predictions, 0, `${label}: changed model clears predictions`);
  assert.equal(modelAfterHorizontal.design, null, `${label}: changed model clears design`);
  assert.equal(modelAfterHorizontal.fromReview, false, `${label}: changed model exits review continuation`);
  assert.match(modelAfterHorizontal.status, /已清除/, `${label}: changed model visibly explains that dependent answers were cleared`);
  assert.match(modelAfterHorizontal.status, /重新完成/, `${label}: changed model visibly asks the learner to redo later phases`);
  assert.match(modelAfterHorizontal.live, /已清除/, `${label}: changed model announces that dependent answers were cleared`);
  assert.match(modelAfterHorizontal.live, /重新完成/, `${label}: changed model announces the required follow-up work`);
  await evaluate(cdp, `(() => { const answer=${fixtureExpression(123)}; window.__hookesLawDebug.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer}}); })()`);
  await evaluate(cdp, "document.querySelector('[data-action=to-review]').click()");
  await delay(80);
  const review = await evaluate(cdp, `(() => ({ phase:window.__hookesLawDebug.getState().phase, hidden:document.getElementById('resultPanel').classList.contains('is-hidden'), text:document.getElementById('controlPanel').textContent }))()`);
  assert.equal(review.phase, "review", `${label}: complete authority reaches review`);
  assert.equal(review.hidden, true, `${label}: review has no result panel`);
  assert.doesNotMatch(review.text, /模擬設定的|最佳安全方案|模擬中的伸長|分數|正確性/, `${label}: review has no correctness or simulation-result reveal`);
  const reviewEvidence = await evaluate(cdp, "(() => ({measurementTables:[...document.querySelectorAll('#reviewSummary .review-measurement-table')].map((table)=>table.querySelectorAll('tbody tr').length),measurementCells:[...document.querySelectorAll('#reviewSummary .review-measurement-table tbody td:nth-child(2)')].map((cell)=>cell.textContent.trim()),modelCharts:document.querySelectorAll('#reviewSummary svg[data-review-model]').length,modelPoints:document.querySelectorAll('#reviewSummary svg[data-review-model] [data-review-point]').length,modelText:document.getElementById('reviewSummary').textContent}))()");
  assert.deepEqual(reviewEvidence.measurementTables, [3, 3], `${label}: review displays three saved measurements for each spring`);
  assert.equal(reviewEvidence.measurementCells.length, 6, `${label}: review displays all six learner measurement values`);
  assert.equal(reviewEvidence.modelCharts, 2, `${label}: review displays one learner-only model chart per spring`);
  assert.equal(reviewEvidence.modelPoints, 6, `${label}: review model charts display all six learner data points`);
  assert.match(reviewEvidence.modelText, /彈簧 A/);
  assert.match(reviewEvidence.modelText, /彈簧 B/);
  assert.match(reviewEvidence.modelText, /N\/m/);
  for (const testCase of [
    { modelK: { A: 20, B: 40 }, springKey: "A", expectedK: 20, expectedX: 0.18, expectedF: 3.6 },
    { modelK: { A: 30, B: 50 }, springKey: "B", expectedK: 50, expectedX: 0.08, expectedF: 4 }
  ]) {
    await evaluate(cdp, `(() => { const answer=${fixtureExpression(123, testCase.modelK)}; window.__hookesLawDebug.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer}}); })()`);
    await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'design'", `${label}: review geometry fixture did not load`);
    await clickDirect(cdp, "[data-action='to-review']");
    await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'review'", `${label}: review geometry fixture did not open review`);
    const geometry = await evaluate(cdp, `(() => { const svg=document.querySelector('#reviewSummary svg[data-review-model="${testCase.springKey}"]'),line=svg?.querySelector('[data-review-line="learner-model"]'),left=34,top=14,width=208,height=106,maxX=.18,maxF=4,x2=Number(line?.getAttribute('x2')),y2=Number(line?.getAttribute('y2')),endX=(x2-left)/width*maxX,endF=(top+height-y2)/height*maxF; return {endX,endF,slope:endF/endX,model:window.__hookesLawDebug.getState().models.${testCase.springKey}.handleExtensionM}; })()`);
    assert.ok(Math.abs(geometry.endX - testCase.expectedX) < 1e-9, `${label}: k=${testCase.expectedK} model line reaches the correct x boundary ${JSON.stringify(geometry)}`);
    assert.ok(Math.abs(geometry.endF - testCase.expectedF) < 1e-9, `${label}: k=${testCase.expectedK} model line reaches the correct force boundary ${JSON.stringify(geometry)}`);
    assert.ok(Math.abs(geometry.slope - testCase.expectedK) < 1e-9, `${label}: k=${testCase.expectedK} review SVG line preserves the learner-model slope ${JSON.stringify(geometry)}`);
    assert.ok(Math.abs(geometry.slope - 2.5 / geometry.model) < 1e-9, `${label}: review SVG slope matches the saved learner model ${JSON.stringify(geometry)}`);
  }
  await evaluate(cdp, `(() => { const answer=${fixtureExpression(123)}; window.__hookesLawDebug.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer}}); })()`);
  await clickDirect(cdp, "[data-action='to-review']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'review'", `${label}: original review fixture could not be restored after geometry checks`);
  await clickDirect(cdp, "[data-action='edit-section'][data-edit-phase='model']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'model'", `${label}: review model edit did not reopen the model phase`);
  const editFocus = await evaluate(cdp, "(() => ({tag:document.activeElement?.tagName||'',panel:document.activeElement?.closest('.panel-section')?.id||'',text:document.activeElement?.textContent||''}))()");
  assert.equal(editFocus.tag, "H2", `${label}: review edit moves focus to the new phase heading`);
  assert.equal(editFocus.panel, "modelPanel", `${label}: review edit focus stays inside the selected phase`);
  await evaluate(cdp, `(() => { const answer=${fixtureExpression(123)}; window.__hookesLawDebug.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer}}); })()`);
  await clickDirect(cdp, "[data-action='to-review']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'review'", `${label}: review fixture could not be restored after focus check`);

  await evaluate(cdp, "document.querySelector('[data-action=submit]').click()");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(cdp, "window.__hookesLawDebug.getPresentation() === 'submitted-success'")) break;
    await delay(25);
  }
  const result = await evaluate(cdp, `(() => ({ presentation:window.__hookesLawDebug.getPresentation(), hidden:document.getElementById('resultPanel').classList.contains('is-hidden'), text:document.getElementById('resultPanel').textContent, score:window.__hookesLawDebug.getResult()?.score }))()`);
  assert.equal(result.presentation, "submitted-success", `${label}: standalone submission reaches success`);
  assert.equal(result.hidden, false, `${label}: result panel is revealed only after success`);
  assert.equal(result.score, 100, `${label}: perfect fixture rescores to 100`);
  assert.match(result.text, /最大安全負載方案|模擬中的伸長量|總作用力/, `${label}: result contains post-submit reveal data with the current terminology`);
  assert.doesNotMatch(result.text, /自然長度基準|F-x|實際伸長|工程方案|模組|總負載|最大安全方案(?!負載)/, `${label}: result does not regress to the previous terminology`);
  return `${label}: delayed feedback and success result passed`;
}

async function runDebugShortcut(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1280, 800, false);
  await navigate(cdp, `${baseUrl}${launchPath}?debug=1&browser=${label}`);
  const initial = await evaluate(cdp, "(() => ({ phase:window.__hookesLawDebug.getState().phase, visible:!document.getElementById('debugPanel').classList.contains('is-hidden'), checked:document.getElementById('debugCompleteInvestigation').checked, modelButtonDisabled:document.getElementById('debugCompleteModel').disabled }))()");
  assert.equal(initial.phase, "investigate", `${label}: debug shortcut starts in the first phase`);
  assert.equal(initial.visible, true, `${label}: debug shortcut panel is visible with debug=1`);
  assert.equal(initial.checked, false, `${label}: debug shortcut starts off`);
  assert.equal(initial.modelButtonDisabled, true, `${label}: second-phase debug shortcut is locked until first phase is complete`);
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
  const modelReady = await evaluate(cdp, "(() => { const debug=window.__hookesLawDebug,state=debug.getState(),scenario=debug.getScenario(); const errors=['A','B'].map((springKey)=>Math.abs(state.models[springKey]?.handleExtensionM-window.HookesLawModel.MODEL_HANDLE_FORCE_N/scenario.springs[springKey].kNPerM)); return {phase:state.phase,complete:window.HookesLawPersistence.hasAllModels(state),predictions:state.predictions.filter(Boolean).length,maxError:Math.max(...errors),buttonDisabled:document.getElementById('debugCompleteModel').disabled}; })()");
  assert.equal(modelReady.phase, "model", `${label}: first-phase debug shortcut leaves the model phase active`);
  assert.equal(modelReady.complete, false, `${label}: second-phase debug shortcut has not run yet`);
  assert.equal(modelReady.buttonDisabled, false, `${label}: second-phase debug shortcut is enabled in the model phase`);
  await clickDirect(cdp, "#debugCompleteModel");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'predict'", `${label}: second-phase debug shortcut did not enter the predict phase`);
  const completedModel = await evaluate(cdp, "(() => { const debug=window.__hookesLawDebug,state=debug.getState(),scenario=debug.getScenario(); const errors=['A','B'].map((springKey)=>Math.abs(state.models[springKey]?.handleExtensionM-window.HookesLawModel.MODEL_HANDLE_FORCE_N/scenario.springs[springKey].kNPerM)); return {phase:state.phase,complete:window.HookesLawPersistence.hasAllModels(state),predictions:state.predictions.filter(Boolean).length,maxError:Math.max(...errors),buttonDisabled:document.getElementById('debugCompleteModel').disabled}; })()");
  assert.equal(completedModel.phase, "predict", `${label}: second-phase debug shortcut enters the third phase`);
  assert.equal(completedModel.complete, true, `${label}: second-phase debug shortcut fills both model answers`);
  assert.equal(completedModel.predictions, 0, `${label}: second-phase debug shortcut leaves third-phase predictions for testing`);
  assert.ok(completedModel.maxError < 1e-9, `${label}: second-phase debug shortcut fills exact model answers`);
  assert.equal(completedModel.buttonDisabled, true, `${label}: second-phase debug shortcut is disabled after entering the third phase`);
  await clickDirect(cdp, "[data-action='navigate-phase'][data-phase='model']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'model'", `${label}: debug shortcut cannot return to the model phase`);
  const debugReturnedModel = await evaluate(cdp, "({phase:window.__hookesLawDebug.getState().phase,models:window.__hookesLawDebug.getState().models,predictions:window.__hookesLawDebug.getState().predictions,fromReview:window.__hookesLawDebug.getState().fromReview})");
  assert.equal(debugReturnedModel.phase, "model", `${label}: debug third phase can inspect the model phase`);
  assert.ok(debugReturnedModel.models.A && debugReturnedModel.models.B, `${label}: debug return preserves both model answers`);
  assert.equal(debugReturnedModel.predictions.filter(Boolean).length, 0, `${label}: debug return does not create predictions`);
  assert.equal(debugReturnedModel.fromReview, true, `${label}: debug backward navigation keeps downstream review-continuation state`);
  await clickDirect(cdp, "#toPredict");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'predict'", `${label}: debug shortcut cannot return to the third phase`);
  return `${label}: first- and second-phase debug shortcuts passed`;
}

async function runMissingServiceLock(cdp, baseUrl, launchPath, label, missingGlobal) {
  await setViewport(cdp, 390, 700, false);
  await navigate(cdp, `${baseUrl}${launchPath}?missing-service=${label}-${missingGlobal}`);
  const outcome = await evaluate(cdp, `(() => {
    const missing=${JSON.stringify(missingGlobal)}, saved=window[missing];
    window[missing]=undefined;
    let thrown=false, debug=null;
    try { debug=window.HookesLawApp.boot({}); } catch { thrown=true; }
    window[missing]=saved;
    const panelIds=['investigatePanel','modelPanel','predictPanel','designPanel','reviewPanel'];
    const answerControls=[...document.querySelectorAll(panelIds.map((id)=>'#'+id+' [data-action]').join(','))];
    const visibleEnabledAnswerControls=answerControls.filter((node)=>!node.disabled && !node.closest('.is-hidden')).length;
    return {
      thrown,
      presentation:debug?.getPresentation?.()||null,
      state:debug?.getState?.()||null,
      result:debug?.getResult?.()||null,
      technicalHidden:document.getElementById('technicalPanel')?.classList.contains('is-hidden') ?? true,
      answerPanelsHidden:panelIds.every((id)=>document.getElementById(id)?.classList.contains('is-hidden')),
      resultHidden:document.getElementById('resultPanel')?.classList.contains('is-hidden') ?? true,
      resultText:document.getElementById('resultPanel')?.textContent||'',
      visibleEnabledAnswerControls
    };
  })()`);
  assert.equal(outcome.thrown, false, `${label}: missing ${missingGlobal} boot does not throw`);
  assert.equal(outcome.presentation, "technical", `${label}: missing ${missingGlobal} enters the technical-lock presentation`);
  assert.equal(outcome.state, null, `${label}: missing ${missingGlobal} does not create an answer state`);
  assert.equal(outcome.result, null, `${label}: missing ${missingGlobal} does not create a result`);
  assert.equal(outcome.technicalHidden, false, `${label}: missing ${missingGlobal} shows the technical panel`);
  assert.equal(outcome.answerPanelsHidden, true, `${label}: missing ${missingGlobal} hides every answer panel`);
  assert.equal(outcome.resultHidden, true, `${label}: missing ${missingGlobal} keeps the result panel hidden`);
  assert.equal(outcome.resultText, "", `${label}: missing ${missingGlobal} leaves the result panel empty`);
  assert.equal(outcome.visibleEnabledAnswerControls, 0, `${label}: missing ${missingGlobal} exposes no enabled answer control`);
  return `${label}: missing ${missingGlobal} fails closed safely`;
}

async function runFirstLoadDependencyLock(cdp, baseUrl, launchPath, label, dependencyFile) {
  await setViewport(cdp, 390, 700, false);
  const bootErrors = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__hookesLawBootErrors=[]; window.addEventListener('error',event=>window.__hookesLawBootErrors.push(event.message||event.type)); window.addEventListener('unhandledrejection',event=>window.__hookesLawBootErrors.push(event.reason?.message||String(event.reason||'unhandled rejection')));" });
  const blockedUrls = [];
  const removePaused = cdp.on("Fetch.requestPaused", async (event) => {
    try {
      const requestUrl = event.request?.url || "";
      if (requestUrl.split("?")[0].endsWith(`/${dependencyFile}`)) {
        blockedUrls.push(requestUrl);
        await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
      } else await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
    } catch {}
  });
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", resourceType: "Script", requestStage: "Request" }] });
  try {
    await navigate(cdp, `${baseUrl}${launchPath}?first-load-missing=${label}-${dependencyFile}`);
    const outcome = await evaluate(cdp, "(() => { const panelIds=['investigatePanel','modelPanel','predictPanel','designPanel','reviewPanel'],answerControls=[...document.querySelectorAll(panelIds.map((id)=>'#'+id+' [data-action]').join(','))]; return {presentation:window.__hookesLawDebug?.getPresentation?.()||null,state:window.__hookesLawDebug?.getState?.()||null,result:window.__hookesLawDebug?.getResult?.()||null,technicalHidden:document.getElementById('technicalPanel')?.classList.contains('is-hidden')??true,answerPanelsHidden:panelIds.every((id)=>document.getElementById(id)?.classList.contains('is-hidden')),resultHidden:document.getElementById('resultPanel')?.classList.contains('is-hidden')??true,resultText:document.getElementById('resultPanel')?.textContent||'',visibleEnabledAnswerControls:answerControls.filter((node)=>!node.disabled&&!node.closest('.is-hidden')).length,stageChildCount:document.getElementById('stageSvg')?.childElementCount??-1,bootErrors:window.__hookesLawBootErrors||[]}; })()");
    assert.equal(blockedUrls.length, 1, `${label}: first-load test blocked exactly ${dependencyFile}`);
    assert.equal(outcome.presentation, "technical", `${label}: missing ${dependencyFile} enters the technical-lock presentation on first load`);
    assert.equal(outcome.state, null, `${label}: missing ${dependencyFile} does not create an answer state`);
    assert.equal(outcome.result, null, `${label}: missing ${dependencyFile} does not create a result`);
    assert.equal(outcome.technicalHidden, false, `${label}: missing ${dependencyFile} shows the technical panel on first load`);
    assert.equal(outcome.answerPanelsHidden, true, `${label}: missing ${dependencyFile} hides every answer panel on first load`);
    assert.equal(outcome.resultHidden, true, `${label}: missing ${dependencyFile} keeps the result panel hidden`);
    assert.equal(outcome.resultText, "", `${label}: missing ${dependencyFile} leaves the result panel empty`);
    assert.equal(outcome.visibleEnabledAnswerControls, 0, `${label}: missing ${dependencyFile} exposes no enabled answer control`);
    assert.equal(outcome.stageChildCount, 0, `${label}: missing ${dependencyFile} does not render an answer stage`);
    assert.deepEqual(outcome.bootErrors, [], `${label}: missing ${dependencyFile} produces no uncaught boot error`);
    return `${label}: first-load missing ${dependencyFile} fails closed safely`;
  } finally {
    removePaused();
    try { await cdp.send("Fetch.disable"); } catch {}
    try { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: bootErrors.identifier }); } catch {}
  }
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
  const virtualKeyCodes = { Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
  for (let index = 0; index < count; index += 1) {
    const virtualKeyCode = virtualKeyCodes[key];
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
    await delay(18);
  }
}

async function completeLearnerPath(cdp, baseUrl, launchPath, label, keyboard = false) {
  await setViewport(cdp, 390, 700, false);
  await navigate(cdp, `${baseUrl}${launchPath}?learner-path=${label}-${keyboard ? "keyboard" : "pointer"}`);
  await evaluate(cdp, "window.__hookErrors=[]; window.addEventListener('error',event=>window.__hookErrors.push(event.error?.stack||event.message));");
  const initialDragLabel = await evaluate(cdp, "document.getElementById('zeroDrag')?.getAttribute('aria-label')||''");
  assert.match(initialDragLabel, /彈簧 A.*零位/ , `${label}: zero marker exposes the active spring and zero-position meaning`);
  assert.match(initialDragLabel, /cm/, `${label}: zero marker exposes its current centimetre value`);
  for (const springKey of ["A", "B"]) {
    if (springKey !== "A") await clickDirect(cdp, `[data-action="spring-tab"][data-spring="${springKey}"]`);
    if (keyboard) {
      if (springKey === "A") {
        const before = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),rect=document.getElementById('zeroDrag').getBoundingClientRect(); return {value:state.working.zeroDraftM,top:rect.top}; })()");
        await pressKey(cdp, "#zeroDrag", "ArrowUp");
        const afterUp = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),rect=document.getElementById('zeroDrag').getBoundingClientRect(); return {value:state.working.zeroDraftM,top:rect.top}; })()");
        assert.ok(afterUp.value < before.value && afterUp.top < before.top, `${label}: ArrowUp decreases the zero-position value and moves its marker upward`);
        await pressKey(cdp, "#zeroDrag", "ArrowDown");
      }
      await pressKey(cdp, "#zeroDrag", "ArrowDown", 6);
    }
    else {
      await dragMouse(cdp, "#zeroDrag", { x: 0, y: 24 });
    }
    await clickDirect(cdp, "[data-action='record-calibration']");
    await waitUntil(cdp, `Boolean(window.__hookesLawDebug.getState().calibrations.${springKey})`, `${label}: ${springKey} calibration did not save`);
    for (const loadKey of ["F1", "F2", "F3"]) {
      await clickDirect(cdp, `[data-action="select-load"][data-load="${loadKey}"]`);
      await clickDirect(cdp, "[data-action='attach-load']");
      await waitUntil(cdp, "document.getElementById('measurementStatus').textContent.includes('讀數只代表')", `${label}: load ${loadKey} did not settle`);
      if (keyboard) {
        if (springKey === "A" && loadKey === "F1") {
          await pressKey(cdp, "#cursorDrag", "ArrowDown", 6);
          const before = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),rect=document.getElementById('cursorDrag').getBoundingClientRect(); return {value:state.working.cursorDraftM,top:rect.top,label:document.getElementById('cursorDrag').getAttribute('aria-label')}; })()");
          assert.match(before.label, /彈簧 A.*1\.0 N.*量度游標.*伸長/, `${label}: cursor name includes the active load and extension value`);
          await pressKey(cdp, "#cursorDrag", "ArrowUp");
          const afterUp = await evaluate(cdp, "(() => { const state=window.__hookesLawDebug.getState(),rect=document.getElementById('cursorDrag').getBoundingClientRect(); return {value:state.working.cursorDraftM,top:rect.top}; })()");
          assert.ok(afterUp.value < before.value && afterUp.top < before.top, `${label}: ArrowUp decreases the cursor position and moves it upward`);
          await pressKey(cdp, "#cursorDrag", "ArrowDown");
        }
        await pressKey(cdp, "#cursorDrag", "ArrowDown", 6);
      }
      else {
        await dragMouse(cdp, "#cursorDrag", { x: 0, y: 30 });
      }
      await clickDirect(cdp, "[data-action='record-measurement']");
      await waitUntil(cdp, `Boolean(window.__hookesLawDebug.getState().measurements.${springKey}.${loadKey})`, `${label}: ${springKey}/${loadKey} measurement did not save`);
    }
  }
  await clickDirect(cdp, "[data-action='to-model']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'model'", `${label}: model phase did not open`);
  const modelDragLabel = await evaluate(cdp, "document.getElementById('modelDrag')?.getAttribute('aria-label')||''");
  assert.match(modelDragLabel, /彈簧 [AB]模型.*k = .*N\/m.*左右鍵改變斜率/, `${label}: model control exposes spring, k and keyboard ownership`);
  const modelAxis = await evaluate(cdp, "(() => { const d=document,f=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='F / N'),fRect=f?.getBoundingClientRect(),tick=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='4'),tickRect=tick?.getBoundingClientRect(),x=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='伸長量 x / cm'),xRect=x?.getBoundingClientRect(),xTick=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='18.0 cm'),xTickRect=xTick?.getBoundingClientRect();return {fX:Number(f?.getAttribute('x')),fAnchor:f?.getAttribute('text-anchor')||'',fRight:fRect?.right,fTickLeft:tickRect?.left,xX:Number(x?.getAttribute('x')),xY:Number(x?.getAttribute('y')),xAnchor:x?.getAttribute('text-anchor')||'',xTop:xRect?.top,xTickBottom:xTickRect?.bottom}; })()");
  assert.ok(modelAxis.fX < 80 && modelAxis.fAnchor === "end", `${label}: vertical F axis label is separated from the tick numbers`);
  assert.ok(modelAxis.fRight < modelAxis.fTickLeft, `${label}: vertical F axis label does not overlap the tick numbers`);
  assert.equal(modelAxis.xY, 460, `${label}: horizontal axis label uses the dedicated row below the tick labels`);
  assert.equal(modelAxis.xAnchor, "middle", `${label}: horizontal axis label is centered under the graph`);
  assert.ok(modelAxis.xTop > modelAxis.xTickBottom, `${label}: horizontal axis label does not overlap the tick numbers`);
  await setViewport(cdp, 1280, 800, false);
  await delay(80);
  const desktopModelAxis = await evaluate(cdp, "(() => { const d=document,x=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='伸長量 x / cm'),xRect=x?.getBoundingClientRect(),xTick=[...d.querySelectorAll('#stageSvg text')].find((text)=>text.textContent==='18.0 cm'),xTickRect=xTick?.getBoundingClientRect();return {xTop:xRect?.top,xTickBottom:xTickRect?.bottom}; })()");
  assert.ok(desktopModelAxis.xTop > desktopModelAxis.xTickBottom, `${label}: desktop horizontal axis label does not overlap the tick numbers`);
  await setViewport(cdp, 390, 700, false);
  await delay(80);
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
  const predictionStage = await evaluate(cdp, `(() => {
    const d=document, state=window.__hookesLawDebug.getState(),
      stageText=[...d.querySelectorAll('#stageSvg text')].map((node)=>node.textContent).filter(Boolean),
      spring=d.querySelector('#stageSvg polyline'), load=d.querySelector('#stageSvg rect'),
      target=d.getElementById('predictionDrag').getBoundingClientRect(), loadRect=load?.getBoundingClientRect();
    return {phase:state.phase, draftM:window.__hookesLawDebug.interactionEvidence().predictionDraftM,
      hasSpring:Boolean(spring), hasLoad:Boolean(load), loadY:loadRect ? loadRect.y + loadRect.height / 2 : null,
      stageText, targetY:target.y + target.height / 2,
      predictionButtons:[...d.querySelectorAll('[data-action="prediction-select"]')].map((node)=>node.textContent.trim()),
      hasCurrentEditingText:d.body.innerText.includes("目前編輯"), predictionStep:window.HookesLawApp.PREDICTION_SNAP_STEP_M};
  })()`);
  assert.equal(predictionStage.phase, "predict", `${label}: third phase starts with the prediction screen`);
  assert.equal(predictionStage.draftM, 0, `${label}: prediction starts at zero extension`);
  assert.equal(predictionStage.hasSpring, true, `${label}: prediction screen draws the spring before dragging`);
  assert.equal(predictionStage.hasLoad, true, `${label}: prediction screen draws the specified load before dragging`);
  assert.ok(predictionStage.stageText.some((text) => text.includes("負載下的伸長量")), `${label}: prediction stage uses a clear learner-facing heading`);
  assert.ok(predictionStage.stageText.includes("未伸長位置（x = 0 cm）"), `${label}: prediction screen labels the unloaded position`);
  assert.ok(predictionStage.stageText.includes("伸長量 x / cm"), `${label}: prediction screen labels extension in cm`);
  assert.ok(Math.abs(predictionStage.targetY - predictionStage.loadY) < 12, `${label}: prediction marker starts beside the load`);
  assert.deepEqual(predictionStage.predictionButtons, ["選擇題目 1", "選擇題目 2", "選擇題目 3"], `${label}: prediction switchers use clear question labels`);
  assert.equal(predictionStage.hasCurrentEditingText, false, `${label}: prediction selection uses highlight without the redundant current-editing label`);
  assert.equal(predictionStage.predictionStep, 0.01, `${label}: prediction values move in 1 cm increments`);
  const predictionDragLabel = await evaluate(cdp, "document.getElementById('predictionDrag')?.getAttribute('aria-label')||''");
  assert.match(predictionDragLabel, /預測 1.*彈簧 [AB].*N.*預測伸長/, `${label}: prediction control exposes question, load and extension value`);
  if (keyboard) {
    const before = await evaluate(cdp, "(() => { const evidence=window.__hookesLawDebug.interactionEvidence(),rect=document.getElementById('predictionDrag').getBoundingClientRect(); return {value:evidence.predictionDraftM,top:rect.top}; })()");
    await pressKey(cdp, "#predictionDrag", "ArrowDown");
    const afterDown = await evaluate(cdp, "(() => { const evidence=window.__hookesLawDebug.interactionEvidence(),rect=document.getElementById('predictionDrag').getBoundingClientRect(); return {value:evidence.predictionDraftM,top:rect.top}; })()");
    assert.ok(afterDown.value > before.value && afterDown.top > before.top, `${label}: ArrowDown increases prediction extension and moves the marker downward`);
    await pressKey(cdp, "#predictionDrag", "ArrowUp");
  }
  for (let index = 0; index < 3; index += 1) {
    if (index) await clickDirect(cdp, `[data-action="prediction-select"][data-index="${index}"]`);
    if (keyboard) await pressKey(cdp, "#predictionDrag", "ArrowDown", 6);
    else if (index === 0) {
      const exactTarget = await evaluate(cdp, `(() => {
        const debug=window.__hookesLawDebug,state=debug.getState(),spec=debug.getScenario().predictions[state.activePredictionIndex],
          stage=window.HookesLawApp.PREDICTION_STAGE,load=window.HookesLawApp.predictionLoadVisual(spec.forceN),
          svg=document.querySelector('#stageSvg'),y=stage.shortestSpringEndY + 0.04 / window.HookesLawGenerator.MAX_LINEAR_EXTENSION_M * stage.extensionPixels,
          point=new DOMPoint(stage.springX + load.width / 2 + 55,y).matrixTransform(svg.getScreenCTM());
        return {x:point.x,y:point.y};
      })()`);
      const exactStart = await directPoint(cdp, "#predictionDrag");
      await dragMouse(cdp, "#predictionDrag", { x: exactTarget.x - exactStart.x, y: exactTarget.y - exactStart.y });
      const exactPrediction = await evaluate(cdp, "window.__hookesLawDebug.getState().predictions[0]?.extensionM");
      assert.ok(Math.abs(exactPrediction - 0.04) < 1e-9, `${label}: prediction drag can select 4 cm exactly`);
    }
    else {
      await dragMouse(cdp, "#predictionDrag", { x: 0, y: 30 });
    }
    await waitUntil(cdp, `Boolean(window.__hookesLawDebug.getState().predictions[${index}])`, `${label}: prediction ${index + 1} did not save`);
  }
  const completedPredictionPhase = await evaluate(cdp, "({phase:window.__hookesLawDebug.getState().phase,toDesignDisabled:document.getElementById(\"toDesign\").disabled})");
  assert.equal(completedPredictionPhase.phase, "predict", `${label}: completing the third prediction stays on the prediction phase`);
  assert.equal(completedPredictionPhase.toDesignDisabled, false, `${label}: continue-to-design is enabled after all predictions are recorded`);
  await clickDirect(cdp, "#toDesign");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'design'", `${label}: design phase did not open`);
  const designInitial = await evaluate(cdp, "(() => { const zero=[...document.querySelectorAll('#stageSvg text')].find((node)=>node.textContent==='0.0 cm'),ceiling=[...document.querySelectorAll('#stageSvg line')].find((node)=>node.getAttribute('x1')==='96'&&node.getAttribute('x2')==='625'&&node.getAttribute('y1')==='62'),ceilingLabel=[...document.querySelectorAll('#stageSvg text')].find((node)=>node.textContent==='固定端／天花板'),limitLine=[...document.querySelectorAll('#stageSvg line')].find((node)=>node.getAttribute('x1')==='142'&&node.getAttribute('x2')==='705'&&node.getAttribute('stroke')==='#dc2626'),limitText=[...document.querySelectorAll('#stageSvg text')].find((node)=>node.textContent.includes('安全伸長量上限')),limitMax=limitText?.querySelector('tspan.math-subscript'),emptyHeading=[...document.querySelectorAll('#stageSvg text')].find((node)=>node.textContent==='請先選擇彈簧及負載塊。'),emptyHelp=[...document.querySelectorAll('#stageSvg text')].find((node)=>node.textContent.includes('系統會用你建立的模型')); return {heading:document.querySelector('#designPanel h2')?.textContent||'',calculationState:document.getElementById('designCalculation')?.dataset.state||'',stageText:[...document.querySelectorAll('#stageSvg text')].map((node)=>node.textContent),zeroY:Number(zero?.getAttribute('y')),ceilingY:Number(ceiling?.getAttribute('y1')),ceilingEndX:Number(ceiling?.getAttribute('x2')),ceilingLabelX:Number(ceilingLabel?.getAttribute('x')),limitY:Number(limitLine?.getAttribute('y1')),limitMaxShift:limitMax?.getAttribute('baseline-shift')||'',emptyHeadingY:Number(emptyHeading?.getAttribute('y')),emptyHelpY:Number(emptyHelp?.getAttribute('y'))}; })()");
  assert.ok(designInitial.heading.includes("最大安全負載"), `${label}: fourth phase explains the maximum-safe-load task`);
  assert.equal(designInitial.calculationState, "empty", `${label}: fourth phase asks for a spring before showing a calculation`);
  assert.ok(designInitial.stageText.some((text) => text.includes("安全伸長量上限")), `${label}: fourth phase stage labels the safety limit`);
  assert.ok(designInitial.stageText.some((text) => text.includes("最大安全負載挑戰・找出安全方案")), `${label}: fourth phase stage has a clear task heading`);
  assert.equal(designInitial.limitMaxShift, "sub", `${label}: safety-limit max is rendered as a subscript`);
  assert.equal(designInitial.zeroY, designInitial.ceilingY + 5, `${label}: fourth phase zero tick aligns with the ceiling`);
  assert.ok(designInitial.ceilingLabelX > designInitial.ceilingEndX, `${label}: ceiling label sits to the right of the ceiling line`);
  assert.ok(designInitial.emptyHeadingY > designInitial.limitY + 40, `${label}: empty design instruction stays below the safety-limit line`);
  assert.ok(designInitial.emptyHelpY > designInitial.emptyHeadingY, `${label}: empty design helper text stays below its heading`);
  assert.equal(designInitial.stageText.some((text) => text.includes("負載模組")), false, `${label}: fourth phase has no redundant horizontal module row`);
  const recordedPredictions = await evaluate(cdp, "JSON.stringify(window.__hookesLawDebug.getState().predictions)");
  await clickDirect(cdp, "[data-action='navigate-phase'][data-phase='predict']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'predict'", `${label}: design phase could not return to prediction`);
  const returnedFromDesign = await evaluate(cdp, "({phase:window.__hookesLawDebug.getState().phase,predictions:JSON.stringify(window.__hookesLawDebug.getState().predictions),design:window.__hookesLawDebug.getState().design})");
  assert.equal(returnedFromDesign.predictions, recordedPredictions, `${label}: returning from design preserves predictions`);
  assert.ok(returnedFromDesign.design === null, `${label}: prediction navigation keeps the not-yet-entered design answer empty`);
  await clickDirect(cdp, "[data-action='navigate-phase'][data-phase='model']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'model'", `${label}: prediction phase could not return to model`);
  const returnedToModel = await evaluate(cdp, "({predictions:JSON.stringify(window.__hookesLawDebug.getState().predictions),design:window.__hookesLawDebug.getState().design,fromReview:window.__hookesLawDebug.getState().fromReview})");
  assert.equal(returnedToModel.predictions, recordedPredictions, `${label}: returning to model preserves all prediction answers`);
  assert.equal(returnedToModel.design, null, `${label}: returning to model does not invent a design answer`);
  assert.equal(returnedToModel.fromReview, true, `${label}: backward phase navigation is marked as a review continuation`);
  await clickDirect(cdp, "#toPredict");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'predict'", `${label}: model phase could not return to prediction`);
  const returnedToPredict = await evaluate(cdp, "JSON.stringify(window.__hookesLawDebug.getState().predictions)");
  assert.equal(returnedToPredict, recordedPredictions, `${label}: returning to prediction keeps recorded results unchanged`);
  await clickDirect(cdp, "#toDesign");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'design'", `${label}: prediction phase could not return to design`);
  await clickDirect(cdp, "[data-action='design-spring'][value='A']");
  const designCalculation = await evaluate(cdp, "(() => { const nodes=[...document.querySelectorAll('#stageSvg [data-role=design-load]')]; const tops=nodes.map((node)=>Number(node.getAttribute('y'))); const bottoms=nodes.map((node)=>Number(node.getAttribute('y'))+Number(node.getAttribute('height'))); return {calculation:document.getElementById('designCalculation')?.textContent||'',summary:document.getElementById('designSummary')?.textContent||'',stageText:[...document.querySelectorAll('#stageSvg text')].map((node)=>node.textContent),kA:document.getElementById('designK_A')?.textContent||'',loadCount:nodes.length,loadHeight:nodes.length?Math.max(...bottoms)-Math.min(...tops):0}; })()");
  assert.ok(designCalculation.calculation.includes("F") && designCalculation.calculation.includes("x") && designCalculation.calculation.includes("安全伸長量上限"), `${label}: fourth phase shows the learner-model force and extension calculation`);
  assert.ok(designCalculation.summary.includes("總作用力"), `${label}: fourth phase shows the current total force summary`);
  assert.ok(designCalculation.stageText.some((text) => text.includes("按你的模型預測的伸長量")), `${label}: fourth phase stage labels the learner-model extension`);
  assert.ok(designCalculation.kA.includes("N/m"), `${label}: fourth phase shows the learner's spring slope`);
  assert.equal(designCalculation.loadCount, 1, `${label}: selecting a spring starts with one small hanging load block`);
  await clickDirect(cdp, "[data-action='module-plus']");
  const largerDesignLoad = await evaluate(cdp, "(() => { const nodes=[...document.querySelectorAll('#stageSvg [data-role=design-load]')]; const tops=nodes.map((node)=>Number(node.getAttribute('y'))); const bottoms=nodes.map((node)=>Number(node.getAttribute('y'))+Number(node.getAttribute('height'))); return {count:nodes.length,height:nodes.length?Math.max(...bottoms)-Math.min(...tops):0}; })()");
  assert.equal(largerDesignLoad.count, designCalculation.loadCount + 1, `${label}: increasing the load adds one hanging load block`);
  assert.ok(largerDesignLoad.height > designCalculation.loadHeight, `${label}: increasing the load makes the hanging stack longer`);
  await clickDirect(cdp, "[data-action='to-review']");
  await waitUntil(cdp, "window.__hookesLawDebug.getState().phase === 'review'", `${label}: review did not open`);
  const review = await evaluate(cdp, "({phase:window.__hookesLawDebug.getState().phase,hidden:document.getElementById('resultPanel').classList.contains('is-hidden'),controlText:document.getElementById('controlPanel')?.textContent||'',stageText:[...document.querySelectorAll('#stageSvg text')].map((node)=>node.textContent)})");
  assert.equal(review.phase, "review", `${label}: full learner path reaches review`);
  assert.equal(review.hidden, true, `${label}: full learner path remains neutral before submit`);
  assert.ok(review.stageText.some((text) => text.includes("提交前檢查")), `${label}: fifth phase uses a Chinese pre-submission heading`);
  assert.doesNotMatch(`${review.controlText}\n${review.stageText.join("\n")}`, /review|圖台|左側/, `${label}: fifth phase has no unexplained direction or English UI wording`);
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
    const sourceMissingScorm = await runMissingServiceLock(cdp, sourceBase, `/sim/${slug}/index.html`, "source", "SimScorm");
    const sourceMissingFlow = await runMissingServiceLock(cdp, sourceBase, `/sim/${slug}/index.html`, "source", "SimActivityFlow");
    const packageMissingScorm = await runMissingServiceLock(cdp, packageBase, extracted.activityPath, "package", "SimScorm");
    const packageMissingFlow = await runMissingServiceLock(cdp, packageBase, extracted.activityPath, "package", "SimActivityFlow");
    const localDependencyFiles = ["generator.js", "model.js", "animation.js", "scoring.js", "persistence.js"];
    const sourceMissingLocal = [];
    const packageMissingLocal = [];
    for (const dependencyFile of localDependencyFiles) sourceMissingLocal.push(await runFirstLoadDependencyLock(cdp, sourceBase, `/sim/${slug}/index.html`, "source", dependencyFile));
    for (const dependencyFile of localDependencyFiles) packageMissingLocal.push(await runFirstLoadDependencyLock(cdp, packageBase, extracted.activityPath, "package", dependencyFile));
    const sourceDirect = await runDirectFlow(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageDirect = await runDirectFlow(cdp, packageBase, extracted.activityPath, "package");
    const sourcePointer = await completeLearnerPath(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packagePointer = await completeLearnerPath(cdp, packageBase, extracted.activityPath, "package");
    const sourceKeyboard = await completeLearnerPath(cdp, sourceBase, `/sim/${slug}/index.html`, "source", true);
    const packageKeyboard = await completeLearnerPath(cdp, packageBase, extracted.activityPath, "package", true);
    summary = `Hooke's law browser regression passed: ${sourceDebug}; ${packageDebug}; ${sourceMissingScorm}; ${sourceMissingFlow}; ${packageMissingScorm}; ${packageMissingFlow}; ${sourceMissingLocal.join("; ")}; ${packageMissingLocal.join("; ")}; ${sourceDirect}; ${packageDirect}; ${sourcePointer}; ${packagePointer}; ${sourceKeyboard}; ${packageKeyboard}; ${sourceTouch}; ${packageTouch}`;
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
