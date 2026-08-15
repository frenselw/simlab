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
const slug = "force-composition-construction-lab";
const tempRoot = fs.realpathSync(os.tmpdir());
const virtualKeyCodes = { Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };

function sourceParity() {
  const html = fs.readFileSync(path.join(root, "sim", slug, "index.html"), "utf8");
  const manifest = fs.readFileSync(path.join(root, "sim", "manifests", `${slug}.xml`), "utf8");
  const refs = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1]).filter((value) => /\.(?:js|css)$/.test(value))
    .map((value) => value.startsWith("../") ? value.slice(3) : `${slug}/${value}`));
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
  const files = new Set([].concat(parsed.manifest?.resources?.resource?.file || [])
    .map((entry) => entry["@_href"]).filter((value) => value !== "config.js" && value !== `${slug}/index.html`));
  assert.deepEqual([...refs].sort(), [...files].sort(), "manifest exactly matches every HTML runtime dependency");
  return [...refs].sort();
}

async function installPreload(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get('__seed'));
    if (Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff) {
      try { Object.defineProperty(window.crypto, 'getRandomValues', { configurable: true, value(array) { if (!array || !array.length) return array; array.fill(0); array[0] = seed >>> 0; return array; } }); } catch (_) {}
    }
    const fixture = params.get('__fixture');
    if (fixture != null) {
      let values = {};
      try { values = JSON.parse(fixture); } catch (_) {}
      let lastError = '0';
      window.__forceLmsValues = values;
      window.API = {
        LMSInitialize: () => 'true',
        LMSGetValue: (key) => { if (params.get('__failRead') === key) { lastError = '101'; return ''; } lastError = '0'; return values[key] || ''; },
        LMSSetValue: (key, value) => { if (params.get('__failWrite') === key) { lastError = '351'; return 'false'; } values[key] = String(value); lastError = '0'; return 'true'; },
        LMSCommit: () => params.get('__failCommit') === '1' ? (lastError = '391', 'false') : (lastError = '0', 'true'),
        LMSFinish: () => params.get('__failFinish') === '1' ? (lastError = '101', 'false') : (lastError = '0', 'true'),
        LMSGetLastError: () => lastError,
        LMSGetErrorString: () => lastError === '0' ? 'No error' : 'Fixture error',
        LMSGetDiagnostic: () => ''
      };
    }
  })();` });
}

function query(seed, extras = {}) {
  const params = new URLSearchParams({ __seed: String(seed), ...extras });
  return params.toString();
}

async function setViewport(cdp, width, height, touch = false, scale = 1) {
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 760, scale });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 2 : 1 });
}

async function waitReady(cdp, embedded = false) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = await evaluate(cdp, embedded
      ? "Boolean(document.getElementById('activity')?.contentWindow?.__forceCompositionApp?.getState?.())"
      : "Boolean(window.__forceCompositionApp?.getState?.())");
    if (ready) return;
    await delay(40);
  }
  throw new Error(`force-composition activity did not become ready (${embedded ? "embedded" : "direct"})`);
}

async function navigateDirect(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitReady(cdp, false);
}

async function navigateEmbedded(cdp, baseUrl, activityUrl) {
  await cdp.send("Page.navigate", { url: `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityUrl)}` });
  await waitReady(cdp, true);
  await evaluate(cdp, "(() => { const f=document.getElementById('activity'); window.scrollTo(0, window.scrollY + f.getBoundingClientRect().top); })()");
  await delay(60);
}

function contextExpression(expression, embedded) {
  return embedded
    ? `(() => { const frame=globalThis.document.getElementById('activity'),window=frame.contentWindow,document=frame.contentDocument; return (${expression}); })()`
    : `(${expression})`;
}

async function inActivity(cdp, expression, embedded = false) {
  return evaluate(cdp, contextExpression(expression, embedded));
}

async function elementPoint(cdp, selector, embedded = false) {
  const selectorJson = JSON.stringify(selector);
  if (!embedded) return evaluate(cdp, `(() => { const r=document.querySelector(${selectorJson})?.getBoundingClientRect(); if(!r) return null; return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`);
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),r=f.contentDocument.querySelector(${selectorJson})?.getBoundingClientRect(); if(!r) return null; return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2,w:r.width,h:r.height}; })()`);
}

async function modelPoint(cdp, point, embedded = false) {
  const payload = JSON.stringify(point);
  if (!embedded) return evaluate(cdp, `(() => { const svg=document.getElementById('stageSvg'),p=svg.createSVGPoint(),v=${payload};p.x=v.x;p.y=v.y;const q=p.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y}; })()`);
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),d=f.contentDocument,svg=d.getElementById('stageSvg'),p=svg.createSVGPoint(),v=${payload};p.x=v.x;p.y=v.y;const q=p.matrixTransform(svg.getScreenCTM());return {x:fr.left+q.x,y:fr.top+q.y}; })()`);
}

async function touch(cdp, start, end) {
  const id = Math.floor(Math.random() * 100000) + 1;
  const point = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(start)] });
  for (let index = 1; index <= 10; index += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point({ x: start.x + (end.x - start.x) * index / 10, y: start.y + (end.y - start.y) * index / 10 })] });
    await delay(10);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(90);
}

async function mouseDrag(cdp, start, end) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x, y: start.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: start.x, y: start.y, button: "left", clickCount: 1 });
  for (let index = 1; index <= 8; index += 1) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x + (end.x - start.x) * index / 8, y: start.y + (end.y - start.y) * index / 8, button: "left", buttons: 1 });
    await delay(8);
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: end.x, y: end.y, button: "left", clickCount: 1 });
  await delay(80);
}

async function drag(cdp, start, end, input) {
  if (input === "touch") return touch(cdp, start, end);
  return mouseDrag(cdp, start, end);
}

async function click(cdp, selector, embedded = false) {
  await inActivity(cdp, `(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(node?.closest('#controlPanel,dialog')) node.scrollIntoView({block:'center',inline:'center'}); })()`, embedded);
  await delay(30);
  const point = await elementPoint(cdp, selector, embedded);
  if (!point) throw new Error(`Missing click target ${selector}`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await delay(70);
}

async function press(cdp, key, options = {}) {
  const code = virtualKeyCodes[key];
  const modifiers = options.shift ? 8 : 0;
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers });
  await delay(options.delay ?? 28);
}

async function focus(cdp, selector, embedded = false) {
  await inActivity(cdp, `document.querySelector(${JSON.stringify(selector)})?.focus()`, embedded);
  await delay(25);
}

async function targetModelPoint(cdp, targetKey, embedded = false) {
  return inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[s.currentQuestion],a=s.answers[s.currentQuestion]; return window.ForceCompositionModel.endpointForKey(a,q,${JSON.stringify(targetKey)}); })()`, embedded);
}

async function currentTail(cdp, index, embedded = false) {
  return inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[s.currentQuestion]; return window.ForceCompositionModel.forceGeometry(s.answers[s.currentQuestion],q)[${index}].tail; })()`, embedded);
}

async function moveForcePointer(cdp, index, targetKey, input, embedded = false) {
  const selector = `.force-hit[data-force-index="${index}"]`;
  const start = await elementPoint(cdp, selector, embedded);
  const before = await currentTail(cdp, index, embedded);
  const target = await targetModelPoint(cdp, targetKey, embedded);
  const beforeClient = await modelPoint(cdp, before, embedded);
  const targetClient = await modelPoint(cdp, target, embedded);
  await drag(cdp, start, { x: start.x + targetClient.x - beforeClient.x, y: start.y + targetClient.y - beforeClient.y }, input);
  const placement = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[window.__forceCompositionApp.getState().currentQuestion].placements[${index}]`, embedded);
  assert.deepEqual(placement, { mode: "snap", targetKey }, `${input}: F${index + 1} snaps to ${targetKey}`);
}

async function moveForceKeyboard(cdp, index, targetKey, embedded = false) {
  const selector = `.force-hit[data-force-index="${index}"]`;
  await focus(cdp, selector, embedded);
  for (let attempt = 0; attempt < 140; attempt += 1) {
    const placement = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[window.__forceCompositionApp.getState().currentQuestion].placements[${index}]`, embedded);
    if (placement.mode === "snap" && placement.targetKey === targetKey) return;
    const current = await currentTail(cdp, index, embedded);
    const target = await targetModelPoint(cdp, targetKey, embedded);
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const delta = horizontal ? dx : dy;
    const key = horizontal ? (delta > 0 ? "ArrowRight" : "ArrowLeft") : (delta > 0 ? "ArrowDown" : "ArrowUp");
    await press(cdp, key, { shift: Math.abs(delta) > 18, delay: 35 });
  }
  throw new Error(`keyboard could not snap F${index + 1} to ${targetKey}`);
}

async function moveForce(cdp, index, targetKey, input, embedded = false) {
  return input === "keyboard" ? moveForceKeyboard(cdp, index, targetKey, embedded) : moveForcePointer(cdp, index, targetKey, input, embedded);
}

async function drawLinePointer(cdp, semanticKey, target, input, embedded = false) {
  const start = await elementPoint(cdp, `[data-semantic-key="${semanticKey}"]`, embedded);
  if (!start) throw new Error(`Missing line handle ${semanticKey}`);
  const end = await modelPoint(cdp, target, embedded);
  await drag(cdp, start, end, input);
}

async function drawLineKeyboard(cdp, semanticKey, startModel, targetModel, embedded = false) {
  const selector = `[data-semantic-key="${semanticKey}"]`;
  await focus(cdp, selector, embedded);
  await press(cdp, "Enter");
  const delta = { x: targetModel.x - startModel.x, y: targetModel.y - startModel.y };
  for (const axis of ["x", "y"]) {
    const positive = axis === "x" ? "ArrowRight" : "ArrowDown";
    const negative = axis === "x" ? "ArrowLeft" : "ArrowUp";
    const key = delta[axis] >= 0 ? positive : negative;
    let remaining = Math.abs(delta[axis]);
    while (remaining > 6) { await press(cdp, key, { shift: true, delay: 10 }); remaining -= 10; }
    while (remaining > 1) { await press(cdp, key, { delay: 10 }); remaining -= 2; }
  }
  await press(cdp, "Enter");
  await delay(60);
}

async function drawLine(cdp, semanticKey, target, input, embedded = false) {
  if (input !== "keyboard") return drawLinePointer(cdp, semanticKey, target, input, embedded);
  const startKey = semanticKey.startsWith("guide-start-") ? semanticKey.slice("guide-start-".length) : semanticKey.startsWith("resultant-start-") ? semanticKey.slice("resultant-start-".length) : null;
  const start = startKey ? await targetModelPoint(cdp, startKey, embedded) : null;
  if (!start) throw new Error(`Keyboard line requires a start handle: ${semanticKey}`);
  return drawLineKeyboard(cdp, semanticKey, start, target, embedded);
}

async function navigateQuestion(cdp, index, embedded = false) {
  await click(cdp, `#questionProgress [data-question-index="${index}"]`, embedded);
  const current = await inActivity(cdp, "window.__forceCompositionApp.getState().currentQuestion", embedded);
  assert.equal(current, index);
}

async function enterResultantMode(cdp, embedded = false) {
  await click(cdp, "#drawResultant", embedded);
  assert.equal(await inActivity(cdp, "document.getElementById('drawResultant').getAttribute('aria-pressed')", embedded), "true");
}

async function completeCurrentQuestion(cdp, index, order, input, embedded = false) {
  await navigateQuestion(cdp, index, embedded);
  const question = await inActivity(cdp, "window.__forceCompositionApp.getScenario().questions[window.__forceCompositionApp.getState().currentQuestion]", embedded);
  if (question.type === "parallelogram") {
    await moveForce(cdp, 0, "ORIGIN", input, embedded);
    await moveForce(cdp, 1, "ORIGIN", input, embedded);
    const corner = await targetModelPoint(cdp, "CORNER", embedded);
    await drawLine(cdp, "guide-start-F1_HEAD", corner, input, embedded);
    await drawLine(cdp, "guide-start-F2_HEAD", corner, input, embedded);
    await enterResultantMode(cdp, embedded);
    await drawLine(cdp, "resultant-start-ORIGIN", corner, input, embedded);
  } else {
    const actualOrder = order || question.forces.map((_, forceIndex) => forceIndex);
    await moveForce(cdp, actualOrder[0], "ORIGIN", input, embedded);
    for (let position = 1; position < actualOrder.length; position += 1) await moveForce(cdp, actualOrder[position], `F${actualOrder[position - 1] + 1}_HEAD`, input, embedded);
    const end = await targetModelPoint(cdp, "CHAIN_END", embedded);
    await drawLine(cdp, "resultant-start-ORIGIN", end, input, embedded);
  }
  const complete = await inActivity(cdp, `window.__forceCompositionApp.getCompletion()[${index}]`, embedded);
  if (!complete) {
    const diagnostic = await inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[${index}],a=s.answers[${index}];return {answer:a,score:window.ForceCompositionScoring.questionDetail(a,q,${index})}; })()`, embedded);
    assert.equal(complete, true, `${input}: ${question.id} completes through production controls\n${JSON.stringify(diagnostic)}`);
  }
}

async function runPerfectMouse(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1280, 800, false);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { flow: label })}`);
  const initial = await evaluate(cdp, `(() => ({
    presentation:window.__forceCompositionApp.getPresentation(),
    buttons:[...document.querySelectorAll('#questionProgress button')].map((button)=>button.disabled),
    targets:[...document.querySelectorAll('.force-hit,.line-handle')].map((node)=>({w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height})),
    math:{vector:document.querySelectorAll('.math-vector').length,sub:document.querySelectorAll('.math-subscript-upright').length,raw:document.body.textContent.includes('F_1')},
    documentRange:document.documentElement.scrollHeight-innerHeight,
    panelRange:document.getElementById('controlPanel').scrollHeight-document.getElementById('controlPanel').clientHeight,
    panelOverflow:getComputedStyle(document.getElementById('controlPanel')).overflowY
  }))()`);
  assert.equal(initial.presentation, "editable");
  assert.deepEqual(initial.buttons, [false, false, false, false, false], `${label}: all five questions are immediately available`);
  assert.ok(initial.targets.every((target) => target.h >= 44 && target.w >= 44), `${label}: all visible targets meet 44px minimum`);
  assert.ok(initial.math.vector >= 3 && initial.math.sub >= 3 && !initial.math.raw, `${label}: notation is structured and no underscore leaks`);
  assert.ok(initial.documentRange <= 2, `${label}: activity document has no third scroll range`);
  assert.match(initial.panelOverflow, /auto|scroll/, `${label}: panel is the configured independent scroll owner when content overflows`);

  await completeCurrentQuestion(cdp, 0, null, "mouse");
  await completeCurrentQuestion(cdp, 1, null, "mouse");
  await completeCurrentQuestion(cdp, 2, [0, 1], "mouse");
  await completeCurrentQuestion(cdp, 3, [1, 0], "mouse");
  await completeCurrentQuestion(cdp, 4, [2, 0, 1], "mouse");
  assert.deepEqual(await evaluate(cdp, "window.__forceCompositionApp.getCompletion()"), [true, true, true, true, true]);
  await click(cdp, "#goSummary");
  await click(cdp, "#submitAttempt");
  assert.match(await evaluate(cdp, "document.getElementById('submitDialogMessage').textContent"), /五題均已完成/);
  await click(cdp, "#confirmSubmit");
  assert.equal(await evaluate(cdp, "window.__forceCompositionApp.getPresentation()"), "review");
  assert.equal(await evaluate(cdp, "document.getElementById('reviewScore').textContent"), "100 / 100");
  assert.equal(await evaluate(cdp, "document.querySelectorAll('#dragLayer .force-hit,#dragLayer .line-handle').length"), 0, `${label}: final lock removes former drag ownership`);
  assert.equal(await evaluate(cdp, "document.getElementById('toggleCorrect').hidden"), false);
  await click(cdp, "#toggleCorrect");
  assert.ok(await evaluate(cdp, "document.querySelectorAll('#stageSvg .correct-overlay').length") > 0, `${label}: correct overlay appears only in submitted review`);
  const log = await evaluate(cdp, "window.SimScorm.getLocalLog()");
  assert.ok(log.some((item) => item.key === "cmi.core.score.raw" && item.value === "100"));
  assert.ok(log.some((item) => item.key === "cmi.core.lesson_status" && item.value === "passed"));
  return `${label}: five-question mouse flow scored 100 and locked`;
}

async function runBlankSubmission(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 390, 600, false);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(73, { blank: label })}`);
  assert.deepEqual(await evaluate(cdp, "window.__forceCompositionApp.getCompletion()"), [false, false, false, false, false]);
  await click(cdp, "#goSummary");
  assert.match(await evaluate(cdp, "document.getElementById('summaryWarning').textContent"), /5 題未完成/);
  assert.equal(await evaluate(cdp, "document.getElementById('submitAttempt').disabled"), false, `${label}: 0/5 may submit`);
  await click(cdp, "#submitAttempt");
  assert.match(await evaluate(cdp, "document.getElementById('submitDialogMessage').textContent"), /仍有 5 題未完成/);
  await click(cdp, "#confirmSubmit");
  assert.equal(await evaluate(cdp, "window.__forceCompositionApp.getPresentation()"), "review");
  assert.equal(await evaluate(cdp, "document.getElementById('reviewScore').textContent"), "0 / 100");
  return `${label}: blank 0/5 submission scored zero without auto-fill`;
}

async function runDraftReload(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 900, 700, false);
  const activity = `${baseUrl}${launchPath}?${query(39, { draft: label })}`;
  await navigateEmbedded(cdp, baseUrl, activity);
  await moveForce(cdp, 0, "ORIGIN", "mouse", true);
  const before = await inActivity(cdp, "window.__forceCompositionApp.getState()", true);
  await evaluate(cdp, "document.getElementById('activity').contentWindow.location.reload()");
  await waitReady(cdp, true);
  const after = await inActivity(cdp, "window.__forceCompositionApp.getState()", true);
  assert.equal(after.seed, before.seed, `${label}: draft reload keeps seed`);
  assert.deepEqual(after.answers[0].placements[0], { mode: "snap", targetKey: "ORIGIN" }, `${label}: draft reload restores semantic snap`);
  assert.deepEqual(await inActivity(cdp, "[...document.querySelectorAll('#questionProgress button')].map((button)=>button.disabled)", true), [false, false, false, false, false]);
  return `${label}: same-attempt iframe reload restored seed and answer`;
}

async function runTripleOrders(cdp, baseUrl, launchPath, label) {
  const cases = [
    { order: [0, 1, 2], input: "mouse" }, { order: [2, 1, 0], input: "mouse" },
    { order: [1, 0, 2], input: "touch" }, { order: [2, 0, 1], input: "touch" },
    { order: [0, 2, 1], input: "keyboard" }, { order: [1, 2, 0], input: "keyboard" }
  ];
  for (const [index, entry] of cases.entries()) {
    await setViewport(cdp, 1180, 760, entry.input === "touch");
    await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { order: `${label}-${index}` })}`);
    await completeCurrentQuestion(cdp, 4, entry.order, entry.input);
    const chain = await evaluate(cdp, "(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[4];return window.ForceCompositionModel.chainInfo(s.answers[4],q).order; })()");
    assert.deepEqual(chain, entry.order, `${label}: ${entry.input} preserves requested T1 order`);
  }
  return `${label}: all six T1 orders passed across mouse, touch and keyboard`;
}

async function iframeMetrics(cdp) {
  return evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),w=f.contentWindow,d=f.contentDocument,p=d.getElementById('controlPanel'),r=f.getBoundingClientRect();
    return {host:scrollY,hostViewport:visualViewport?{offsetTop:visualViewport.offsetTop,pageTop:visualViewport.pageTop}:null,iframe:{top:r.top,left:r.left},activity:w.scrollY,activityViewport:w.visualViewport?{offsetTop:w.visualViewport.offsetTop,pageTop:w.visualViewport.pageTop}:null,panel:p.scrollTop,panelRange:p.scrollHeight-p.clientHeight,html:d.documentElement.scrollHeight,body:d.body.scrollHeight,inner:w.innerHeight,app:d.getElementById('app').getBoundingClientRect().height,state:w.__forceCompositionApp.getState()};
  })()`);
}

function assertFixed(before, after, label, allowPanel = false) {
  assert.equal(after.host, before.host, `${label}: host stays fixed`);
  assert.equal(after.iframe.top, before.iframe.top, `${label}: iframe stays fixed`);
  assert.equal(after.activity, before.activity, `${label}: activity document stays fixed`);
  if (!allowPanel) assert.equal(after.panel, before.panel, `${label}: panel stays fixed`);
  if (before.hostViewport && after.hostViewport) assert.deepEqual(after.hostViewport, before.hostViewport, `${label}: host visual viewport stays fixed`);
  if (before.activityViewport && after.activityViewport) assert.deepEqual(after.activityViewport, before.activityViewport, `${label}: activity visual viewport stays fixed`);
}

async function ownedTouchDrag(cdp, selector, endPoint, label) {
  const start = await elementPoint(cdp, selector, true);
  const before = await iframeMetrics(cdp);
  const eventStart = await inActivity(cdp, "window.__forceCompositionApp.getEventTelemetry().length", true);
  await touch(cdp, start, endPoint);
  const after = await iframeMetrics(cdp);
  assertFixed(before, after, label);
  assert.notDeepEqual(after.state, before.state, `${label}: learner state changes`);
  const events = (await inActivity(cdp, "window.__forceCompositionApp.getEventTelemetry()", true)).slice(eventStart);
  assert.ok(events.some((event) => event.type === "pointermove" && event.isTrusted && event.pointerType === "touch"), `${label}: trusted touch pointermove`);
  assert.ok(events.some((event) => event.type === "pointerup" && event.isTrusted && event.pointerType === "touch"), `${label}: trusted touch pointerup`);
  assert.equal(events.some((event) => event.type === "pointercancel"), false, `${label}: no pointercancel`);
}

async function runTouchMatrix(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 390, 500, true);
  await navigateEmbedded(cdp, baseUrl, `${baseUrl}${launchPath}?${query(91, { touchMatrix: label })}`);
  const initial = await iframeMetrics(cdp);
  assert.ok(initial.panelRange > 20);
  assert.ok(initial.html <= initial.inner + 2 && initial.body <= initial.inner + 2, `${label}: inner document has no third scroll owner`);

  const blank = await evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),s=f.contentDocument.getElementById('stage').getBoundingClientRect();return {x:fr.left+s.right-34,y:fr.top+s.top+Math.min(125,s.height-32)}; })()`);
  const beforeBlank = await iframeMetrics(cdp);
  const blankLogStart = await inActivity(cdp, "window.__forceCompositionApp.getTouchTelemetry().length", true);
  await touch(cdp, blank, { x: blank.x, y: blank.y - 95 });
  const afterBlank = await iframeMetrics(cdp);
  assert.ok(afterBlank.host > beforeBlank.host, `${label}: blank stage scrolls parent host`);
  assert.ok(afterBlank.iframe.top < beforeBlank.iframe.top, `${label}: iframe moves with host`);
  assert.equal(afterBlank.activity, beforeBlank.activity);
  assert.equal(afterBlank.panel, beforeBlank.panel);
  assert.deepEqual(afterBlank.state, beforeBlank.state);
  const blankEvents = (await inActivity(cdp, "window.__forceCompositionApp.getTouchTelemetry()", true)).slice(blankLogStart);
  assert.ok(blankEvents.some((event) => event.type === "touchmove" && event.isTrusted), `${label}: forwarding is driven by trusted touchmove`);

  await evaluate(cdp, "(() => { const f=document.getElementById('activity');window.scrollTo(0,window.scrollY+f.getBoundingClientRect().top);f.contentDocument.getElementById('controlPanel').scrollTop=0; })()");
  const panelPoint = await evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),p=f.contentDocument.getElementById('controlPanel').getBoundingClientRect();return {x:fr.left+p.width/2,y:fr.top+p.top+Math.min(85,p.height-25)}; })()`);
  const beforePanel = await iframeMetrics(cdp);
  await touch(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y - 95 });
  const afterPanel = await iframeMetrics(cdp);
  assert.ok(afterPanel.panel > beforePanel.panel, `${label}: panel owns its scroll`);
  assertFixed(beforePanel, afterPanel, `${label} panel`, true);
  assert.deepEqual(afterPanel.state, beforePanel.state);
  await inActivity(cdp, "document.getElementById('controlPanel').scrollTop=document.getElementById('controlPanel').scrollHeight", true);
  const beforeBottom = await iframeMetrics(cdp);
  await touch(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y - 80 });
  assertFixed(beforeBottom, await iframeMetrics(cdp), `${label} panel bottom`, true);
  await inActivity(cdp, "document.getElementById('controlPanel').scrollTop=0", true);
  const beforeTop = await iframeMetrics(cdp);
  await touch(cdp, { x: panelPoint.x, y: panelPoint.y - 55 }, { x: panelPoint.x, y: panelPoint.y + 25 });
  assertFixed(beforeTop, await iframeMetrics(cdp), `${label} panel top`, true);

  for (const index of [0, 1]) {
    const start = await elementPoint(cdp, `.force-hit[data-force-index="${index}"]`, true);
    await ownedTouchDrag(cdp, `.force-hit[data-force-index="${index}"]`, { x: start.x + 28, y: start.y + 18 }, `${label} F${index + 1}`);
    await click(cdp, "#resetQuestion", true); await click(cdp, "#confirmReset", true);
  }
  await navigateQuestion(cdp, 4, true);
  const third = await elementPoint(cdp, '.force-hit[data-force-index="2"]', true);
  await ownedTouchDrag(cdp, '.force-hit[data-force-index="2"]', { x: third.x - 28, y: third.y + 18 }, `${label} F3`);
  await click(cdp, "#resetQuestion", true); await click(cdp, "#confirmReset", true);

  await navigateQuestion(cdp, 0, true);
  await moveForce(cdp, 0, "ORIGIN", "touch", true);
  await moveForce(cdp, 1, "ORIGIN", "touch", true);
  const corner = await targetModelPoint(cdp, "CORNER", true);
  const provisional = { x: GPoint(corner.x - 80), y: GPoint(corner.y + 65) };
  await ownedTouchDrag(cdp, '[data-semantic-key="guide-start-F1_HEAD"]', await modelPoint(cdp, provisional, true), `${label} guide start`);
  await ownedTouchDrag(cdp, '[data-semantic-key="guide-end-0"]', await modelPoint(cdp, corner, true), `${label} provisional guide endpoint`);
  const snappedGuide = await elementPoint(cdp, '[data-semantic-key="guide-end-0"]', true);
  await ownedTouchDrag(cdp, '[data-semantic-key="guide-end-0"]', { x: snappedGuide.x - 36, y: snappedGuide.y + 28 }, `${label} snapped guide endpoint`);
  await ownedTouchDrag(cdp, '[data-semantic-key="guide-end-0"]', await modelPoint(cdp, corner, true), `${label} guide resnap`);
  await ownedTouchDrag(cdp, '[data-semantic-key="guide-start-F2_HEAD"]', await modelPoint(cdp, corner, true), `${label} second guide start`);
  await enterResultantMode(cdp, true);
  const provisionalResult = { x: corner.x - 70, y: corner.y - 55 };
  await ownedTouchDrag(cdp, '[data-semantic-key="resultant-start-ORIGIN"]', await modelPoint(cdp, provisionalResult, true), `${label} resultant start`);
  await ownedTouchDrag(cdp, '[data-semantic-key="resultant-end"]', await modelPoint(cdp, corner, true), `${label} provisional resultant endpoint`);
  const snappedResult = await elementPoint(cdp, '[data-semantic-key="resultant-end"]', true);
  await ownedTouchDrag(cdp, '[data-semantic-key="resultant-end"]', { x: snappedResult.x - 34, y: snappedResult.y + 30 }, `${label} snapped resultant endpoint`);
  const beforeTranslation = await inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[s.currentQuestion],a=s.answers[s.currentQuestion],M=window.ForceCompositionModel; const start=M.lineStartPoint(a.resultant,a,q),end=M.lineEndPoint(a.resultant,a,q); return {start,end,vector:{x:end.x-start.x,y:end.y-start.y}}; })()`, true);
  const lineHit = await elementPoint(cdp, '.resultant-hit', true);
  assert.ok(lineHit, `${label}: whole resultant line has a draggable hit target`);
  await ownedTouchDrag(cdp, '.resultant-hit', { x: lineHit.x + 22, y: lineHit.y + 16 }, `${label} whole resultant translation`);
  const afterTranslation = await inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[s.currentQuestion],a=s.answers[s.currentQuestion],M=window.ForceCompositionModel; const start=M.lineStartPoint(a.resultant,a,q),end=M.lineEndPoint(a.resultant,a,q); return {start,end,vector:{x:end.x-start.x,y:end.y-start.y}}; })()`, true);
  assert.notDeepEqual(afterTranslation.start, beforeTranslation.start, `${label}: whole resultant translation moves its start`);
  assert.ok(Math.abs(afterTranslation.vector.x - beforeTranslation.vector.x) < 0.2 && Math.abs(afterTranslation.vector.y - beforeTranslation.vector.y) < 0.2, `${label}: whole resultant translation preserves direction and length`);

  for (const [width, height] of [[320, 500], [390, 500], [390, 600], [700, 390], [820, 700]]) {
    await setViewport(cdp, width, height, width < 760);
    await delay(90);
    const responsive = await iframeMetrics(cdp);
    assert.ok(Math.abs(responsive.app - responsive.inner) < 3, `${label} ${width}x${height}: app is viewport bounded`);
    assert.ok(responsive.html <= responsive.inner + 3 && responsive.body <= responsive.inner + 3, `${label} ${width}x${height}: no document scroll owner`);
    await inActivity(cdp, "document.getElementById('controlPanel').scrollTop=document.getElementById('controlPanel').scrollHeight", true);
    const bottom = await inActivity(cdp, "(() => { const p=document.getElementById('controlPanel');return p.scrollTop+p.clientHeight>=p.scrollHeight-2; })()", true);
    assert.equal(bottom, true, `${label} ${width}x${height}: panel reaches true bottom`);
  }
  return `${label}: trusted host/panel and every force/guide/resultant target contract passed`;
}

function GPoint(value) { return Math.max(24, Math.min(736, value)); }

async function runLifecycleFixtures(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 900, 700, false);
  const emptyFixture = JSON.stringify({ "cmi.core.lesson_status": "not attempted" });
  await cdp.send("Page.navigate", { url: `${baseUrl}${launchPath}?${query(12, { __fixture: emptyFixture, __failRead: "cmi.suspend_data", lifecycle: `${label}-load` })}` });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, "window.__forceCompositionApp?.getPresentation?.() === 'technical'")) break;
    await delay(40);
  }
  assert.equal(await evaluate(cdp, "window.__forceCompositionApp.getPresentation()"), "technical");
  assert.match(await evaluate(cdp, "document.getElementById('technicalTitle').textContent"), /暫時鎖定/);
  assert.equal(await evaluate(cdp, "document.getElementById('reviewScore').textContent"), "--");

  const corruptFixture = JSON.stringify({ "cmi.core.lesson_status": "completed", "cmi.core.score.raw": "65", "cmi.suspend_data": "not-json" });
  await cdp.send("Page.navigate", { url: `${baseUrl}${launchPath}?${query(13, { __fixture: corruptFixture, lifecycle: `${label}-finished` })}` });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, "document.getElementById('technicalTitle')?.textContent.includes('已完成紀錄')")) break;
    await delay(40);
  }
  assert.match(await evaluate(cdp, "document.getElementById('technicalMessage').textContent"), /Moodle 記錄分數：65/);
  assert.equal(await evaluate(cdp, "document.querySelectorAll('#dragLayer button').length"), 0);
  return `${label}: load-error and invalid finished review fail closed`;
}

async function main() {
  sourceParity();
  let sourceServer, packageServer, profileDirectory, packageDirectory, chrome, cdp, failure, summary, browserErrors = "";
  const consoleErrors = [];
  const runtimeExceptions = [];
  try {
    const browser = findBrowser();
    if (!browser) throw new Error("Chrome/Chromium is required for force-composition browser regression");
    const extracted = buildAndExtractPackage(tempRoot, { slug });
    packageDirectory = extracted.packageDirectory;
    sourceServer = createServer(root);
    packageServer = createServer(packageDirectory);
    await listenServer(sourceServer);
    await listenServer(packageServer);
    const sourceBase = `http://127.0.0.1:${sourceServer.address().port}`;
    const packageBase = `http://127.0.0.1:${packageServer.address().port}`;
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, "simlab-position-time-chrome-"));
    validateOwnedProfile(profileDirectory, tempRoot);
    chrome = spawn(browser, ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    chrome.stderr.on("data", (chunk) => { browserErrors = `${browserErrors}${chunk}`.slice(-5000); });
    const port = await withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome DevTools startup");
    const { body: target } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    cdp.on("Runtime.exceptionThrown", (event) => {
      const description = event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || "runtime exception";
      runtimeExceptions.push(description);
      consoleErrors.push(description);
    });
    cdp.on("Runtime.consoleAPICalled", (event) => { if (["error", "assert"].includes(event.type)) consoleErrors.push(`${event.type}: ${event.args?.map((arg) => arg.value || arg.description || "").join(" ")}`); });
    await installPreload(cdp);

    const sourceDirect = await runPerfectMouse(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageDirect = await runPerfectMouse(cdp, packageBase, extracted.activityPath, "package");
    const sourceBlank = await runBlankSubmission(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageBlank = await runBlankSubmission(cdp, packageBase, extracted.activityPath, "package");
    const sourceDraft = await runDraftReload(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageDraft = await runDraftReload(cdp, packageBase, extracted.activityPath, "package");
    const sourceOrders = await runTripleOrders(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageOrders = await runTripleOrders(cdp, packageBase, extracted.activityPath, "package");
    const sourceTouch = await runTouchMatrix(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageTouch = await runTouchMatrix(cdp, packageBase, extracted.activityPath, "package");
    assert.deepEqual(consoleErrors, [], `browser console/runtime errors before negative lifecycle fixtures: ${consoleErrors.join("\n")}`);
    consoleErrors.length = 0;
    const sourceLifecycle = await runLifecycleFixtures(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageLifecycle = await runLifecycleFixtures(cdp, packageBase, extracted.activityPath, "package");
    assert.deepEqual(runtimeExceptions, [], `uncaught runtime exceptions: ${runtimeExceptions.join("\n")}`);
    const version = await cdp.send("Browser.getVersion");
    summary = `Force-composition browser regression passed on ${version.product}: ${sourceDirect}; ${packageDirect}; ${sourceBlank}; ${packageBlank}; ${sourceDraft}; ${packageDraft}; ${sourceOrders}; ${packageOrders}; ${sourceTouch}; ${packageTouch}; ${sourceLifecycle}; ${packageLifecycle}`;
  } catch (error) {
    if (browserErrors.trim()) error.message += `\nChrome stderr:\n${browserErrors.trim()}`;
    failure = error;
  }
  for (const server of [sourceServer, packageServer]) if (server) await new Promise((resolve) => server.close(resolve));
  try { await cleanupResources({ chrome, cdp, profileDirectory, packageDirectory, tempRoot }); }
  catch (error) { failure = new AggregateError(failure ? [failure, error] : [error], "force-composition browser cleanup failed"); }
  if (failure) throw failure;
  console.log(summary);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message || error); process.exitCode = 1; });
module.exports = { sourceParity, query };
