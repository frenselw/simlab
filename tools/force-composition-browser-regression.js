#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { XMLParser } = require("fast-xml-parser");
const G = require("../sim/force-composition-construction-lab/generator.js");
const {
  CdpClient, buildAndExtractPackage, cleanupResources, createServer, delay, devToolsPort,
  evaluate, fetchJson, findBrowser, listenServer, validateOwnedProfile, withTimeout
} = require("./position-time-browser-regression.js");

const root = path.resolve(__dirname, "..");
const slug = "force-composition-construction-lab";
const tempRoot = fs.realpathSync(os.tmpdir());
const virtualKeyCodes = { Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };

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
    window.__forceCompositionDocumentToken = String(performance.timeOrigin) + ':' + String(Date.now()) + ':' + String(Math.random());
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
      window.__forceFailCommit = params.get('__failCommit') === '1';
      window.API = {
        LMSInitialize: () => 'true',
        LMSGetValue: (key) => { if (params.get('__failRead') === key) { lastError = '101'; return ''; } lastError = '0'; return values[key] || ''; },
        LMSSetValue: (key, value) => { if (params.get('__failWrite') === key) { lastError = '351'; return 'false'; } values[key] = String(value); lastError = '0'; return 'true'; },
        LMSCommit: () => window.__forceFailCommit ? (lastError = '391', 'false') : (lastError = '0', 'true'),
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

async function waitReady(cdp, embedded = false, previousDocumentToken = null) {
  const previousToken = JSON.stringify(previousDocumentToken);
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = await evaluate(cdp, embedded
      ? `(() => { const frame=document.getElementById('activity'),w=frame?.contentWindow,d=frame?.contentDocument; const ready=d?.readyState === 'complete' && w?.__forceCompositionApp?.getState?.(); return Boolean(ready && (${previousToken} === null || w.__forceCompositionDocumentToken !== ${previousToken})); })()`
      : `(() => { const d=document; const ready=d.readyState === 'complete' && window.__forceCompositionApp?.getState?.(); return Boolean(ready && (${previousToken} === null || window.__forceCompositionDocumentToken !== ${previousToken})); })()`);
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

async function blankStagePoint(cdp, embedded = false) {
  const local = await inActivity(cdp, `(() => {
    const stage = document.getElementById('stage');
    const r = stage.getBoundingClientRect();
    const candidates = [
      { x: r.right - 34, y: r.top + Math.min(125, r.height - 32) },
      { x: r.left + 34, y: r.top + Math.min(125, r.height - 32) },
      { x: r.right - 24, y: r.top + 24 },
      { x: r.left + 24, y: r.top + 24 },
      { x: r.left + r.width / 2, y: r.bottom - 24 }
    ];
    for (const point of candidates) {
      const node = document.elementFromPoint(point.x, point.y);
      if (node === stage) return point;
    }
    return candidates[0];
  })()`, embedded);
  if (!embedded) return local;
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(); return {x:fr.left+${local.x},y:fr.top+${local.y}}; })()`);
}

async function modelPoint(cdp, point, embedded = false) {
  const payload = JSON.stringify(point);
  const expression = `(() => { const svg=document.getElementById('stageSvg'),r=svg.getBoundingClientRect(),v=${payload},b=svg.viewBox.baseVal,s=Math.min(r.width/b.width,r.height/b.height),ox=(r.width-b.width*s)/2,oy=(r.height-b.height*s)/2; return {x:r.left+ox+(v.x-b.x)*s,y:r.top+oy+(v.y-b.y)*s}; })()`;
  if (!embedded) return evaluate(cdp, expression);
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),d=f.contentDocument,svg=d.getElementById('stageSvg'),r=svg.getBoundingClientRect(),v=${payload},b=svg.viewBox.baseVal,s=Math.min(r.width/b.width,r.height/b.height),ox=(r.width-b.width*s)/2,oy=(r.height-b.height*s)/2; return {x:fr.left+r.left+ox+(v.x-b.x)*s,y:fr.top+r.top+oy+(v.y-b.y)*s}; })()`);
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

async function touchPreviewProbe(cdp, start, move) {
  const id = 17001;
  const point = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(start)] });
  await delay(45);
  const down = await inActivity(cdp, "(() => { const source=document.getElementById('stageSvg'),lens=document.getElementById('magnifierSvg'),box=document.getElementById('magnifier'); return {camera:source.getAttribute('viewBox'),visible:box.classList.contains('is-visible'),sourceChildren:source.children.length,previewChildren:lens.children.length,viewBox:lens.getAttribute('viewBox'),focusX:box.style.getPropertyValue('--preview-focus-x'),focusY:box.style.getPropertyValue('--preview-focus-y')}; })()", true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(move)] });
  await delay(60);
  const moved = await inActivity(cdp, "(() => { const source=document.getElementById('stageSvg'),lens=document.getElementById('magnifierSvg'),box=document.getElementById('magnifier'); return {camera:source.getAttribute('viewBox'),visible:box.classList.contains('is-visible'),sourceChildren:source.children.length,previewChildren:lens.children.length,viewBox:lens.getAttribute('viewBox'),focusX:box.style.getPropertyValue('--preview-focus-x'),focusY:box.style.getPropertyValue('--preview-focus-y')}; })()", true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(90);
  const ended = await inActivity(cdp, "(() => { const source=document.getElementById('stageSvg'),lens=document.getElementById('magnifierSvg'),box=document.getElementById('magnifier'); return {camera:source.getAttribute('viewBox'),visible:box.classList.contains('is-visible'),previewChildren:lens.children.length}; })()", true);
  return { down, moved, ended };
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

async function renderedForceTail(cdp, index, embedded = false) {
  const selector = `#stageSvg path.force-line[data-force-index="${index}"]`;
  return inActivity(cdp, `(() => {
    const path = document.querySelector(${JSON.stringify(selector)});
    const values = path?.getAttribute("d")?.match(/-?(?:\\d+\\.?\\d*|\\.\\d+)/g)?.map(Number) || [];
    if (values.length < 4) return null;
    return { x: (values[0] + values[values.length - 2]) / 2, y: (values[1] + values[values.length - 1]) / 2 };
  })()`, embedded);
}

async function dragWithPreviewProbe(cdp, start, end, input, forceIndex, embedded = false) {
  const point = ({ x, y }) => ({ x, y });
  let preview = null;
  if (input === "touch") {
    const id = 17002;
    const touchPoint = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint(start)] });
    for (let step = 1; step <= 10; step += 1) {
      const next = { x: start.x + (end.x - start.x) * step / 10, y: start.y + (end.y - start.y) * step / 10 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint(next)] });
      await delay(12);
      if (step === 10) {
        // Flush one duplicate terminal move before reading the SVG preview;
        // CDP touch events can be coalesced one turn behind the pointerup
        // that follows them.
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint(next)] });
        await delay(60);
        preview = await renderedForceTail(cdp, forceIndex, embedded);
      }
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(start) });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point(start), button: "left", clickCount: 1 });
    for (let step = 1; step <= 10; step += 1) {
      const next = { x: start.x + (end.x - start.x) * step / 10, y: start.y + (end.y - start.y) * step / 10 };
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(next), button: "left", buttons: 1 });
      await delay(12);
      if (step === 10) {
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(next), button: "left", buttons: 1 });
        await delay(60);
        preview = await renderedForceTail(cdp, forceIndex, embedded);
      }
    }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point(end), button: "left", clickCount: 1 });
  }
  await delay(90);
  return { preview, committed: await currentTail(cdp, forceIndex, embedded) };
}

async function dragSnapThresholdProbe(cdp, start, outside, inside, input, forceIndex, embedded = false) {
  const point = ({ x, y }) => ({ x, y });
  let outsidePreview;
  let insidePreview;
  if (input === "touch") {
    const id = 17003;
    const touchPoint = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint(start)] });
    await delay(45);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint(outside)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint(outside)] });
    await delay(60);
    outsidePreview = await renderedForceTail(cdp, forceIndex, embedded);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint(inside)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint(inside)] });
    await delay(60);
    insidePreview = await renderedForceTail(cdp, forceIndex, embedded);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(start) });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point(start), button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(outside), button: "left", buttons: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(outside), button: "left", buttons: 1 });
    await delay(60);
    outsidePreview = await renderedForceTail(cdp, forceIndex, embedded);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(inside), button: "left", buttons: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(inside), button: "left", buttons: 1 });
    await delay(60);
    insidePreview = await renderedForceTail(cdp, forceIndex, embedded);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point(inside), button: "left", clickCount: 1 });
  }
  await delay(90);
  return { outsidePreview, insidePreview, committed: await currentTail(cdp, forceIndex, embedded) };
}

async function runSnapThresholdContinuity(cdp, baseUrl, launchPath, label, input) {
  const embedded = false;
  await setViewport(cdp, input === "touch" ? 390 : 1180, input === "touch" ? 500 : 760, input === "touch");
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { snapThreshold: `${label}-${input}` })}`);
  await navigateQuestion(cdp, 3);
  const target = await targetModelPoint(cdp, "F1_HEAD");
  const targetClient = await modelPoint(cdp, target);
  const oneModelUnit = await modelPoint(cdp, { x: target.x + 1, y: target.y });
  const unitX = oneModelUnit.x - targetClient.x;
  const unitY = oneModelUnit.y - targetClient.y;
  const cssThreshold = input === "touch" ? 20 : 14;
  const start = await elementPoint(cdp, '.force-hit[data-force-index="1"]');
  const before = await currentTail(cdp, 1);
  const beforeClient = await modelPoint(cdp, before);
  const outsideCandidateClient = { x: targetClient.x - unitX * (cssThreshold + 1), y: targetClient.y - unitY * (cssThreshold + 1) };
  const insideCandidateClient = { x: targetClient.x - unitX * (cssThreshold - 1), y: targetClient.y - unitY * (cssThreshold - 1) };
  // The drag handler preserves the pointer-to-tail offset captured on
  // pointerdown, so convert the desired tail positions into actual pointer
  // destinations relative to the hit target's centre.
  const outside = { x: start.x + outsideCandidateClient.x - beforeClient.x, y: start.y + outsideCandidateClient.y - beforeClient.y };
  const inside = { x: start.x + insideCandidateClient.x - beforeClient.x, y: start.y + insideCandidateClient.y - beforeClient.y };
  const result = await dragSnapThresholdProbe(cdp, start, outside, inside, input, 1, embedded);
  assert.ok(result.outsidePreview && result.insidePreview && result.committed, `${label}: ${input} captures both threshold-side previews and commit`);
  const jump = Math.hypot(result.insidePreview.x - result.outsidePreview.x, result.insidePreview.y - result.outsidePreview.y);
  const committedDelta = Math.hypot(result.committed.x - result.insidePreview.x, result.committed.y - result.insidePreview.y);
  const state = await inActivity(cdp, "window.__forceCompositionApp.getState().answers[3]");
  assert.equal(state.placements[1].targetKey, "F1_HEAD", `${label}: ${input} threshold-inside frame keeps the semantic F2-tail to F1-head snap`);
  assert.ok(jump <= cssThreshold + 2 + 0.2, `${label}: ${input} threshold crossing stays within pointer movement plus snap threshold (${JSON.stringify({ result, jump, cssThreshold, outside, inside })})`);
  assert.ok(jump < 20, `${label}: ${input} threshold crossing avoids the hidden-candidate jump (${JSON.stringify({ result, jump })})`);
  assert.ok(committedDelta <= 0.11, `${label}: ${input} pointerup preserves the threshold-inside preview (${JSON.stringify({ result, committedDelta })})`);
  return `${label}: ${input} H2 seed-91 endpoint threshold preview remains continuous`;
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

async function moveForceKeyboardTail(cdp, index, targetTail, embedded = false) {
  const selector = `.force-hit[data-force-index="${index}"]`;
  await focus(cdp, selector, embedded);
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const current = await currentTail(cdp, index, embedded);
    const placement = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[window.__forceCompositionApp.getState().currentQuestion].placements[${index}]`, embedded);
    if (placement.mode === "snap") {
      const geometry = await inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[s.currentQuestion]; return window.ForceCompositionModel.forceGeometry(s.answers[s.currentQuestion],q)[${index}].tail; })()`, embedded);
      if (Math.hypot(geometry.x - targetTail.x, geometry.y - targetTail.y) <= 0.2) return placement;
    }
    const dx = targetTail.x - current.x;
    const dy = targetTail.y - current.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      await press(cdp, "ArrowRight", { delay: 35 });
      continue;
    }
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const delta = horizontal ? dx : dy;
    const key = horizontal ? (delta > 0 ? "ArrowRight" : "ArrowLeft") : (delta > 0 ? "ArrowDown" : "ArrowUp");
    await press(cdp, key, { shift: Math.abs(delta) > 18, delay: 35 });
  }
  return inActivity(cdp, `window.__forceCompositionApp.getState().answers[window.__forceCompositionApp.getState().currentQuestion].placements[${index}]`, embedded);
}

async function moveForce(cdp, index, targetKey, input, embedded = false) {
  return input === "keyboard" ? moveForceKeyboard(cdp, index, targetKey, embedded) : moveForcePointer(cdp, index, targetKey, input, embedded);
}

async function moveForceEndpoint(cdp, index, endpoint, targetKey, embedded = false, offset = { x: 0, y: 0 }, input = "mouse") {
  const selector = `.force-hit[data-force-index="${index}"]`;
  const start = await elementPoint(cdp, selector, embedded);
  const before = await currentTail(cdp, index, embedded);
  const target = await targetModelPoint(cdp, targetKey, embedded);
  const force = await inActivity(cdp, `window.__forceCompositionApp.getScenario().questions[window.__forceCompositionApp.getState().currentQuestion].forces[${index}]`, embedded);
  const desiredTail = endpoint === "HEAD" ? { x: target.x - force.dx + offset.x, y: target.y - force.dy + offset.y } : { x: target.x + offset.x, y: target.y + offset.y };
  const beforeClient = await modelPoint(cdp, before, embedded);
  const desiredClient = await modelPoint(cdp, desiredTail, embedded);
  await drag(cdp, start, { x: start.x + desiredClient.x - beforeClient.x, y: start.y + desiredClient.y - beforeClient.y }, input);
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

async function assertStageLabelsClear(cdp, label, embedded = false) {
  const boxes = await inActivity(cdp, "[...document.querySelectorAll('#stageSvg .math-svg')].map((node) => { const rect=node.getBoundingClientRect(); return { left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom }; })", embedded);
  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first], b = boxes[second];
      const overlaps = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      assert.equal(overlaps, false, `${label}: force labels do not overlap (${JSON.stringify({ a, b })})`);
    }
  }
}

async function completeCurrentQuestion(cdp, index, order, input, embedded = false) {
  await navigateQuestion(cdp, index, embedded);
  const question = await inActivity(cdp, "window.__forceCompositionApp.getScenario().questions[window.__forceCompositionApp.getState().currentQuestion]", embedded);
  assert.equal(await inActivity(cdp, "document.getElementById('drawResultant').disabled", embedded), true, `${input}: resultant button starts disabled before prerequisites`);
  if (question.type === "parallelogram") {
    await moveForce(cdp, 0, "ORIGIN", input, embedded);
    await moveForce(cdp, 1, "ORIGIN", input, embedded);
    const corner = await targetModelPoint(cdp, "CORNER", embedded);
    await drawLine(cdp, "guide-start-F1_HEAD", corner, input, embedded);
    await drawLine(cdp, "guide-start-F2_HEAD", corner, input, embedded);
  } else {
    const actualOrder = order || question.forces.map((_, forceIndex) => forceIndex);
    await moveForce(cdp, actualOrder[0], "ORIGIN", input, embedded);
    for (let position = 1; position < actualOrder.length; position += 1) await moveForce(cdp, actualOrder[position], `F${actualOrder[position - 1] + 1}_HEAD`, input, embedded);
  }
  assert.equal(await inActivity(cdp, "document.getElementById('drawResultant').disabled", embedded), false, `${input}: resultant button unlocks after prerequisites`);
  await enterResultantMode(cdp, embedded);
  const offsetTargets = await inActivity(cdp, "[...document.querySelectorAll('.line-handle.is-offset')].map((node)=>{const r=node.getBoundingClientRect();return {w:r.width,h:r.height};})", embedded);
  assert.ok(offsetTargets.every((rect) => rect.w >= 44 && rect.h >= 44), `${input}: overlapping line handles retain a 44px hit target`);
  assert.ok(await elementPoint(cdp, '[data-semantic-key="resultant-start-ORIGIN"]', embedded), `${input}: resultant mode exposes a consistent origin handle`);
  const resultantEnd = await targetModelPoint(cdp, question.type === "parallelogram" ? "CORNER" : "CHAIN_END", embedded);
  await drawLine(cdp, "resultant-start-ORIGIN", resultantEnd, input, embedded);
  if (input === "mouse" || input === "touch") {
    const resultantFocus = await inActivity(cdp, "document.activeElement?.dataset?.semanticKey || null", embedded);
    assert.ok(["resultant-end", "resultant-start-edit"].includes(resultantFocus), `${input}: first pointer resultant creation transfers focus to a live resultant handle`);
  }
  assert.equal(await inActivity(cdp, "document.getElementById('deleteResultant').hidden", embedded), false, `${input}: delete resultant control appears after drawing`);
  await click(cdp, "#deleteResultant", embedded);
  assert.equal(await inActivity(cdp, "window.__forceCompositionApp.getState().answers[window.__forceCompositionApp.getState().currentQuestion].resultant", embedded), null, `${input}: delete resultant clears the current line`);
  assert.equal(await inActivity(cdp, "document.getElementById('drawResultant').getAttribute('aria-pressed')", embedded), "true", `${input}: delete keeps resultant mode ready for redraw`);
  assert.equal(await inActivity(cdp, "document.getElementById('deleteResultant').hidden", embedded), true, `${input}: delete control hides until a new line is drawn`);
  await drawLine(cdp, "resultant-start-ORIGIN", resultantEnd, input, embedded);
  await assertStageLabelsClear(cdp, `${input}: question ${index + 1}`, embedded);
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

  await press(cdp, "Tab", { delay: 10 });
  await focus(cdp, '.force-hit[data-force-index="0"]');
  const forceFocus = await evaluate(cdp, `(() => { const node=document.querySelector('.force-hit[data-force-index="0"]'); const style=getComputedStyle(node); return { active:document.activeElement===node, visible:node.matches(':focus-visible'), outlineStyle:style.outlineStyle }; })()`);
  assert.equal(forceFocus.active, true, `${label}: force hit receives keyboard focus`);
  assert.equal(forceFocus.visible, true, `${label}: force hit exposes focus-visible state`);
  assert.notEqual(forceFocus.outlineStyle, "none", `${label}: force hit focus indicator is visible`);

  await completeCurrentQuestion(cdp, 0, null, "mouse");
  await completeCurrentQuestion(cdp, 1, null, "mouse");
  await completeCurrentQuestion(cdp, 2, [0, 1], "mouse");
  await completeCurrentQuestion(cdp, 3, [1, 0], "mouse");
  await completeCurrentQuestion(cdp, 4, [2, 0, 1], "mouse");
  await press(cdp, "Tab", { delay: 10 });
  await focus(cdp, '.resultant-hit');
  const resultantFocus = await evaluate(cdp, `(() => { const node=document.querySelector('.resultant-hit'); const style=getComputedStyle(node); return { active:document.activeElement===node, visible:node.matches(':focus-visible'), outlineStyle:style.outlineStyle }; })()`);
  assert.equal(resultantFocus.active, true, `${label}: resultant hit receives keyboard focus`);
  assert.equal(resultantFocus.visible, true, `${label}: resultant hit exposes focus-visible state`);
  assert.notEqual(resultantFocus.outlineStyle, "none", `${label}: resultant focus indicator is visible`);
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
  await click(cdp, '#reviewQuestionNavigation [data-question-index="4"]');
  await click(cdp, "#toggleCorrect");
  assert.deepEqual(await evaluate(cdp, "[...document.querySelectorAll('#stageSvg .correct-overlay.force-line')].map((node)=>Number(node.dataset.forceIndex))"), [2, 0, 1], `${label}: submitted T1 review overlay follows the learner's accepted chain order`);
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
  const previousDocumentToken = await evaluate(cdp, "document.getElementById('activity')?.contentWindow?.__forceCompositionDocumentToken");
  await evaluate(cdp, "document.getElementById('activity').contentWindow.location.reload()");
  await waitReady(cdp, true, previousDocumentToken);
  const nextDocumentToken = await evaluate(cdp, "document.getElementById('activity')?.contentWindow?.__forceCompositionDocumentToken");
  assert.notEqual(nextDocumentToken, previousDocumentToken, `${label}: iframe reload installed a new document token before app readiness`);
  const after = await inActivity(cdp, "window.__forceCompositionApp.getState()", true);
  assert.equal(after.seed, before.seed, `${label}: draft reload keeps seed`);
  assert.deepEqual(after.answers[0].placements[0], { mode: "snap", targetKey: "ORIGIN" }, `${label}: draft reload restores semantic snap`);
  assert.deepEqual(await inActivity(cdp, "[...document.querySelectorAll('#questionProgress button')].map((button)=>button.disabled)", true), [false, false, false, false, false]);
  return `${label}: same-attempt iframe reload restored seed and answer`;
}

async function runPendingRetry(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 900, 700, false);
  const fixture = JSON.stringify({ "cmi.core.lesson_status": "not attempted" });
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(57, { __fixture: fixture, pendingRetry: label })}`);
  await click(cdp, "#goSummary");
  await evaluate(cdp, "window.__forceFailCommit = true");
  await click(cdp, "#submitAttempt");
  await click(cdp, "#confirmSubmit");
  assert.equal(await evaluate(cdp, "window.__forceCompositionApp.getPresentation()"), "frozen", `${label}: failed final commit enters frozen state`);
  assert.equal(await evaluate(cdp, "document.getElementById('reviewScore').textContent"), "--", `${label}: frozen state does not expose an unverified score`);
  assert.equal(await evaluate(cdp, "document.querySelectorAll('#reviewFeedback .feedback-question').length"), 0, `${label}: frozen state does not expose unverified component feedback`);
  const pendingFixture = await evaluate(cdp, "JSON.stringify(window.__forceLmsValues)");
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(57, { __fixture: pendingFixture, __failCommit: "1", pendingRestore: label })}`);
  assert.equal(await evaluate(cdp, "window.__forceCompositionApp.getPresentation()"), "frozen", `${label}: pending-final startup restores as frozen`);
  await evaluate(cdp, "window.__forceFailCommit = false");
  const retry = await elementPoint(cdp, "#reviewActions button");
  assert.ok(retry, `${label}: frozen review exposes retry action`);
  await click(cdp, "#reviewActions button");
  assert.equal(await evaluate(cdp, "window.__forceCompositionApp.getPresentation()"), "review", `${label}: retry success enters trusted review`);
  assert.equal(await evaluate(cdp, "document.getElementById('reviewScore').textContent"), "0 / 100", `${label}: retry success restores score immediately`);
  assert.equal(await evaluate(cdp, "document.querySelectorAll('#reviewFeedback .feedback-question').length"), 5, `${label}: retry success restores all question feedback`);
  assert.ok(await evaluate(cdp, "document.querySelectorAll('#reviewFeedback li').length") >= 5, `${label}: retry success restores component details`);
  return `${label}: failed final commit and startup pending-final retry recover trusted score and feedback`;
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

async function runKeyboardForceRelease(cdp, baseUrl, launchPath, label) {
  const cases = [
    { question: 0, force: 0, order: null },
    { question: 2, force: 0, order: [0, 1] },
    { question: 2, force: 1, order: [0, 1] },
    { question: 4, force: 0, order: [0, 1, 2] },
    { question: 4, force: 1, order: [0, 1, 2] },
    { question: 4, force: 2, order: [0, 1, 2] }
  ];
  for (const shift of [false, true]) {
    for (const entry of cases) {
      await setViewport(cdp, 1180, 760, false);
      await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { keyboardRelease: `${label}-${entry.question}-${entry.force}-${shift}` })}`);
      await navigateQuestion(cdp, entry.question);
      if (entry.order) {
        for (let position = 0; position < entry.order.length; position += 1) {
          const forceIndex = entry.order[position];
          await moveForce(cdp, forceIndex, position === 0 ? "ORIGIN" : `F${entry.order[position - 1] + 1}_HEAD`, "mouse");
        }
      } else {
        await moveForce(cdp, entry.force, "ORIGIN", "mouse");
      }
      const before = await currentTail(cdp, entry.force);
      const placementBefore = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[${entry.question}].placements[${entry.force}]`);
      await focus(cdp, `.force-hit[data-force-index="${entry.force}"]`);
      await press(cdp, "ArrowRight", { shift, delay: 45 });
      const after = await currentTail(cdp, entry.force);
      const placementAfter = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[${entry.question}].placements[${entry.force}]`);
      assert.equal(placementBefore.mode, "snap", `${label}: keyboard release fixture starts snapped for ${JSON.stringify(entry)}`);
      assert.notDeepEqual(placementAfter, placementBefore, `${label}: keyboard ${shift ? "shift-" : ""}arrow releases the old relationship for ${JSON.stringify(entry)} (${JSON.stringify({ placementBefore, placementAfter, before, after })})`);
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 0.1, `${label}: keyboard ${shift ? "shift-" : ""}arrow moves the released force`);
      const releaseSteps = shift ? 2 : 7;
      for (let step = 0; step < releaseSteps; step += 1) {
        await press(cdp, "ArrowRight", { shift, delay: 35 });
        const intermediate = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[${entry.question}].placements[${entry.force}]`);
        assert.notEqual(intermediate.targetKey, placementBefore.targetKey, `${label}: repeated keyboard ${shift ? "Shift+" : ""}ArrowRight does not snap back to the released target`);
      }
      await moveForceKeyboard(cdp, entry.force, placementBefore.targetKey);
      const restored = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[${entry.question}].placements[${entry.force}]`);
      assert.deepEqual(restored, placementBefore, `${label}: after moving away, reverse keyboard motion can re-snap the original relationship`);
    }
  }
  return `${label}: keyboard arrows release snapped root, middle and final forces, resist snap-back, and re-snap after reversal for regular and Shift steps`;
}

async function runTripleArbitraryAnchors(cdp, baseUrl, launchPath, label) {
  for (const [caseIndex, order] of G.permutations([0, 1, 2]).entries()) {
    await setViewport(cdp, 1180, 760, false);
    await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { arbitraryAnchor: `${label}-${caseIndex}` })}`);
    await navigateQuestion(cdp, 4);
    const anchor = await inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[4]; const b=window.ForceCompositionModel.chainAnchorBounds(q,${order[0]}); return {x:b.minX,y:b.minY}; })()`);
    const root = await elementPoint(cdp, `.force-hit[data-force-index="${order[0]}"]`);
    const before = await currentTail(cdp, order[0]);
    const beforeClient = await modelPoint(cdp, before);
    const anchorClient = await modelPoint(cdp, anchor);
    await mouseDrag(cdp, root, { x: root.x + anchorClient.x - beforeClient.x, y: root.y + anchorClient.y - beforeClient.y });
    assert.equal(await inActivity(cdp, `window.__forceCompositionApp.getState().answers[4].placements[${order[0]}].targetKey`), "ORIGIN", `${label}: edge anchor establishes the requested root`);
    for (let position = 1; position < order.length; position += 1) await moveForce(cdp, order[position], `F${order[position - 1] + 1}_HEAD`, "mouse");
    assert.deepEqual(await inActivity(cdp, "window.ForceCompositionModel.chainInfo(window.__forceCompositionApp.getState().answers[4],window.__forceCompositionApp.getScenario().questions[4]).order"), order, `${label}: edge anchor supports advertised order ${order.join(",")}`);
    assert.equal(await inActivity(cdp, "window.ForceCompositionModel.chainInfo(window.__forceCompositionApp.getState().answers[4],window.__forceCompositionApp.getScenario().questions[4]).complete"), true, `${label}: edge anchor completes order ${order.join(",")}`);
  }
  return `${label}: all six T1 orders remain completable from the computed feasible anchor edge`;
}

async function runParallelogramBoundary(cdp, baseUrl, launchPath, label) {
  for (const questionIndex of [0, 1]) {
    await setViewport(cdp, 1180, 760, false);
    await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(0, { parallelogramBoundary: `${label}-${questionIndex}` })}`);
    await navigateQuestion(cdp, questionIndex);
    const anchor = await inActivity(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[${questionIndex}],b=window.ForceCompositionModel.parallelogramAnchorBounds(q); return {x:b.maxX,y:b.maxY}; })()`);
    const root = await elementPoint(cdp, '.force-hit[data-force-index="0"]');
    const before = await currentTail(cdp, 0);
    const beforeClient = await modelPoint(cdp, before);
    const anchorClient = await modelPoint(cdp, anchor);
    await mouseDrag(cdp, root, { x: root.x + anchorClient.x - beforeClient.x, y: root.y + anchorClient.y - beforeClient.y });
    const edgeState = await inActivity(cdp, `window.__forceCompositionApp.getState().answers[${questionIndex}]`);
    assert.equal(edgeState.placements[0].targetKey, "ORIGIN", `${label}: P${questionIndex + 1} accepts the computed feasible edge anchor`);
    assert.ok(await inActivity(cdp, `window.ForceCompositionModel.resolvedForceGeometryWithinBounds(window.__forceCompositionApp.getState().answers[${questionIndex}],window.__forceCompositionApp.getScenario().questions[${questionIndex}])`), `${label}: P${questionIndex + 1} edge anchor resolves inside the canvas`);
    await moveForce(cdp, 1, "ORIGIN", "mouse");
    const corner = await targetModelPoint(cdp, "CORNER");
    await drawLine(cdp, "guide-start-F1_HEAD", corner, "mouse");
    await drawLine(cdp, "guide-start-F2_HEAD", corner, "mouse");
    await enterResultantMode(cdp);
    await drawLine(cdp, "resultant-start-ORIGIN", corner, "mouse");
    assert.equal(await inActivity(cdp, `window.__forceCompositionApp.getCompletion()[${questionIndex}]`), true, `${label}: P${questionIndex + 1} remains completable from the advertised edge anchor`);
  }
  return `${label}: P1/P2 remain completable from the full parallelogram feasible boundary`;
}

async function runPointerPreviewCommitParity(cdp, baseUrl, launchPath, label, input) {
  await setViewport(cdp, input === "touch" ? 390 : 1180, input === "touch" ? 500 : 760, input === "touch");
  const questionIndices = [0, 1, 2, 3, 4];
  const cornerNames = ["top-left", "top-right", "bottom-left", "bottom-right"];
  for (const questionIndex of questionIndices) {
    for (const [cornerIndex, cornerName] of cornerNames.entries()) {
      await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { previewCommit: `${label}-${input}-${questionIndex}-${cornerName}` })}`);
      await navigateQuestion(cdp, questionIndex);
      const corners = await inActivity(cdp, `(() => {
        const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[s.currentQuestion],M=window.ForceCompositionModel;
        const points = [[-1e6,-1e6],[1e6,-1e6],[-1e6,1e6],[1e6,1e6]];
        return points.map(([x,y]) => M.clampForceTail({x,y},q.forces[0]));
      })()`);
      const start = await elementPoint(cdp, '.force-hit[data-force-index="0"]');
      const before = await currentTail(cdp, 0);
      const beforeClient = await modelPoint(cdp, before);
      const targetClient = await modelPoint(cdp, corners[cornerIndex]);
      const result = await dragWithPreviewProbe(cdp, start, {
        x: start.x + targetClient.x - beforeClient.x,
        y: start.y + targetClient.y - beforeClient.y
      }, input, 0);
      assert.ok(result.preview && result.committed, `${label}: ${input} ${questionIndex + 1} ${cornerName} captures preview and committed F1 tails`);
      const delta = Math.hypot(result.preview.x - result.committed.x, result.preview.y - result.committed.y);
      assert.ok(delta <= 0.11, `${label}: ${input} question ${questionIndex + 1} ${cornerName} pointer preview and pointerup stay within one quantization step (${JSON.stringify({ preview: result.preview, committed: result.committed, delta, corner: corners[cornerIndex], before, start, targetClient })})`);
    }
  }
  return `${label}: ${input} first-force preview/commit parity across P1/P2/H1/H2/T1 corners`;
}

async function reloadEmbeddedActivity(cdp) {
  const previousToken = await evaluate(cdp, "document.getElementById('activity')?.contentWindow?.__forceCompositionDocumentToken");
  await evaluate(cdp, "document.getElementById('activity').contentWindow.location.reload()");
  await waitReady(cdp, true, previousToken);
}

async function runReleaseSafeContinuations(cdp, baseUrl, launchPath, label) {
  // Seed 0 H1: a compact touch projection can bring the clamped F2 tail
  // within the touch threshold of the stationary F1 head.  It must remain a
  // free placement because the resulting relationship is outside the hard
  // visual inset; moving F1 afterwards must still be accepted.
  await setViewport(cdp, 390, 500, true);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(0, { releaseSafeH1: label })}`);
  await navigateQuestion(cdp, 2);
  await moveForceEndpoint(cdp, 1, "TAIL", "F1_HEAD", false, undefined, "touch");
  const nearMiss = await inActivity(cdp, "window.__forceCompositionApp.getState().answers[2].placements[1]");
  assert.notDeepEqual(nearMiss, { mode: "snap", targetKey: "F1_HEAD" }, `${label}: seed 0 H1 touch near-miss stays free when release-unsafe`);
  const firstForce = await elementPoint(cdp, '.force-hit[data-force-index="0"]');
  await touch(cdp, firstForce, { x: firstForce.x + 22, y: firstForce.y + 18 });
  assert.equal(await inActivity(cdp, "window.__forceCompositionApp.getPresentation()"), "editable", `${label}: seed 0 H1 upstream touch drag remains editable`);
  assert.equal(await inActivity(cdp, "window.ForceCompositionPersistence.validate(window.__forceCompositionApp.getState(),{kind:'draft'}).ok"), true, `${label}: seed 0 H1 upstream release remains production-valid`);

  // Seed 1 H2: save a mobile chain, resize to desktop, reload through the
  // same LMS-backed iframe, and finish the chain/resultant there.  The saved
  // chain must be release-safe and its semantic CHAIN_END must remain inside
  // the desktop free-line bounds.
  await setViewport(cdp, 390, 500, true);
  await navigateEmbedded(cdp, baseUrl, `${baseUrl}${launchPath}?${query(1, { releaseSafeH2: label })}`);
  await navigateQuestion(cdp, 3, true);
  await moveForce(cdp, 1, "ORIGIN", "touch", true);
  await moveForceEndpoint(cdp, 0, "TAIL", "F2_HEAD", true, undefined, "touch");
  const mobileState = await inActivity(cdp, "window.__forceCompositionApp.getState()", true);
  assert.equal(await inActivity(cdp, "window.ForceCompositionPersistence.validate(window.__forceCompositionApp.getState(),{kind:'draft'}).ok" , true), true, `${label}: seed 1 H2 mobile draft is production-valid`);
  const mobileChain = await inActivity(cdp, "window.ForceCompositionModel.chainInfo(window.__forceCompositionApp.getState().answers[3],window.__forceCompositionApp.getScenario().questions[3])", true);
  if (mobileChain.complete) {
    const end = await targetModelPoint(cdp, "CHAIN_END", true);
    assert.ok(end.y >= 34 - 0.11 && end.y <= 466 + 0.11, `${label}: mobile H2 CHAIN_END stays inside release-safe visual bounds`);
  }
  await setViewport(cdp, 1180, 760, false);
  await reloadEmbeddedActivity(cdp);
  assert.equal(await inActivity(cdp, "window.ForceCompositionPersistence.validate(window.__forceCompositionApp.getState(),{kind:'draft'}).ok", true), true, `${label}: seed 1 H2 reload on desktop restores a valid draft`);
  const restored = await inActivity(cdp, "window.__forceCompositionApp.getState()", true);
  assert.equal(restored.seed, mobileState.seed, `${label}: mobile-to-desktop reload preserves seed`);
  if (mobileChain.complete) {
    const end = await targetModelPoint(cdp, "CHAIN_END", true);
    await enterResultantMode(cdp, true);
    await drawLine(cdp, "resultant-start-ORIGIN", end, "mouse", true);
    assert.equal(await inActivity(cdp, "window.__forceCompositionApp.getCompletion()[3]", true), true, `${label}: desktop continuation reaches the H2 resultant`);
  }
  return `${label}: release-safe seed 0 touch continuation and seed 1 mobile-to-desktop draft restore passed`;
}

async function runKeyboardAlternateTarget(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1180, 760, false);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { keyboardAlternate: label })}`);
  await navigateQuestion(cdp, 2);
  await moveForce(cdp, 0, "ORIGIN", "mouse");
  await moveForce(cdp, 1, "F1_HEAD", "mouse");
  const oldPlacement = await inActivity(cdp, "window.__forceCompositionApp.getState().answers[2].placements[1]");
  const rootTail = await targetModelPoint(cdp, "F1_TAIL");
  const force = await inActivity(cdp, "window.__forceCompositionApp.getScenario().questions[2].forces[1]");
  const desiredTail = { x: rootTail.x - force.dx, y: rootTail.y - force.dy };
  await focus(cdp, '.force-hit[data-force-index="1"]');
  // Move far enough to arm the old-target hysteresis, then approach the
  // legal prepend target F1_TAIL.  The old implementation kept every snap
  // disabled during this phase and could never create the reversed chain.
  for (let step = 0; step < 8; step += 1) await press(cdp, "ArrowRight", { delay: 35 });
  await moveForceKeyboardTail(cdp, 1, desiredTail);
  assert.deepEqual(await inActivity(cdp, "window.ForceCompositionModel.chainInfo(window.__forceCompositionApp.getState().answers[2],window.__forceCompositionApp.getScenario().questions[2]).order"), [1, 0], `${label}: keyboard alternate target re-roots H1`);
  assert.deepEqual(oldPlacement, { mode: "snap", targetKey: "F1_HEAD" });
  return `${label}: keyboard hysteresis resists old snap-back while allowing H1 prepend target`;
}

async function runKeyboardLockResetUndo(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1180, 760, false);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { keyboardLockLifecycle: label })}`);
  await navigateQuestion(cdp, 2);
  await moveForce(cdp, 0, "ORIGIN", "mouse");
  await focus(cdp, '.force-hit[data-force-index="0"]');
  await press(cdp, "ArrowRight", { delay: 35 });
  assert.equal((await inActivity(cdp, "window.__forceCompositionApp.getState().answers[2].placements[0]")).mode, "free", `${label}: keyboard release creates a provisional free force`);
  await click(cdp, "#resetQuestion");
  await click(cdp, "#confirmReset");
  await focus(cdp, '.force-hit[data-force-index="0"]');
  await press(cdp, "ArrowRight", { delay: 35 });
  assert.equal((await inActivity(cdp, "window.__forceCompositionApp.getState().answers[2].placements[0]")).mode, "snap", `${label}: reset clears the whole-question release lock before a fresh arrow`);

  // Create an armed lock, undo back to the old snapped answer, then verify
  // the first new arrow follows fresh hysteresis rather than the stale armed
  // lock.  Repeated undo is intentional: each keyboard arrow is an atomic
  // undo step in the activity contract.
  await navigateQuestion(cdp, 2);
  await moveForce(cdp, 0, "ORIGIN", "mouse");
  await focus(cdp, '.force-hit[data-force-index="0"]');
  for (let step = 0; step < 8; step += 1) await press(cdp, "ArrowRight", { delay: 25 });
  let undoCount = 0;
  for (let step = 0; step < 12; step += 1) {
    await click(cdp, "#undo");
    undoCount += 1;
    const placement = await inActivity(cdp, "window.__forceCompositionApp.getState().answers[2].placements[0]");
    if (undoCount > 0 && placement.mode === "snap" && placement.targetKey === "ORIGIN") break;
  }
  const restoredState = await inActivity(cdp, "window.__forceCompositionApp.getState()");
  const restored = restoredState.answers[2].placements[0];
  assert.deepEqual(restored, { mode: "snap", targetKey: "ORIGIN" }, `${label}: undo restores the snapped answer before the lock lifecycle check`);
  await focus(cdp, '.force-hit[data-force-index="0"]');
  await press(cdp, "ArrowRight", { delay: 35 });
  const afterUndoArrow = await inActivity(cdp, "window.__forceCompositionApp.getState().answers[2].placements[0]");
  assert.equal(afterUndoArrow.mode, "free", `${label}: undo clears the stale armed lock before a fresh arrow (${JSON.stringify({ restoredState, afterUndoArrow })})`);
  return `${label}: reset and undo clear question-scoped keyboard release locks`;
}

async function runKeyboardCrossForceLock(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1180, 760, false);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { keyboardCrossLock: label })}`);

  // H1: arm F2's old F1_HEAD lock, then move the root F1 with keyboard.  The
  // parent move changes the released F2 geometry; the next F2 arrow must be
  // allowed to establish a fresh ORIGIN rather than using F2's stale target.
  await navigateQuestion(cdp, 2);
  await moveForce(cdp, 0, "ORIGIN", "mouse");
  await moveForce(cdp, 1, "F1_HEAD", "mouse");
  await focus(cdp, '.force-hit[data-force-index="1"]');
  for (let step = 0; step < 8; step += 1) await press(cdp, "ArrowRight", { delay: 25 });
  const beforeParentH1 = await currentTail(cdp, 0);
  await focus(cdp, '.force-hit[data-force-index="0"]');
  for (let step = 0; step < 8; step += 1) await press(cdp, "ArrowUp", { delay: 25 });
  const afterParentH1 = await currentTail(cdp, 0);
  assert.ok(Math.hypot(afterParentH1.x - beforeParentH1.x, afterParentH1.y - beforeParentH1.y) > 0.1, `${label}: H1 keyboard parent movement changes F1 geometry`);
  await focus(cdp, '.force-hit[data-force-index="1"]');
  await press(cdp, "ArrowRight", { delay: 35 });
  const h1After = await inActivity(cdp, "(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[2],a=s.answers[2]; return { placement:a.placements[1],placements:a.placements,geometry:window.ForceCompositionModel.forceGeometry(a,q) }; })()");
  assert.deepEqual(h1After.placement, { mode: "snap", targetKey: "ORIGIN" }, `${label}: H1 keyboard move of F1 clears F2's stale lock before a fresh F2 root arrow (${JSON.stringify({ h1After, beforeParentH1, afterParentH1 })})`);

  // T1: repeat with a descendant lock and its direct parent.  Moving F2
  // changes the old F2_HEAD target used by F3, so F3 must not remain trapped
  // in the previous hysteresis state.
  await navigateQuestion(cdp, 4);
  await moveForce(cdp, 0, "ORIGIN", "mouse");
  await moveForce(cdp, 1, "F1_HEAD", "mouse");
  await moveForce(cdp, 2, "F2_HEAD", "mouse");
  await focus(cdp, '.force-hit[data-force-index="2"]');
  for (let step = 0; step < 8; step += 1) await press(cdp, "ArrowRight", { delay: 25 });
  const beforeParentT1 = await currentTail(cdp, 1);
  await focus(cdp, '.force-hit[data-force-index="1"]');
  for (let step = 0; step < 8; step += 1) await press(cdp, "ArrowLeft", { delay: 25 });
  const afterParentT1 = await currentTail(cdp, 1);
  assert.ok(Math.hypot(afterParentT1.x - beforeParentT1.x, afterParentT1.y - beforeParentT1.y) > 0.1, `${label}: T1 keyboard parent movement changes F2 geometry`);
  await focus(cdp, '.force-hit[data-force-index="0"]');
  for (let step = 0; step < 8; step += 1) await press(cdp, "ArrowUp", { delay: 25 });
  await focus(cdp, '.force-hit[data-force-index="2"]');
  await press(cdp, "ArrowRight", { delay: 35 });
  assert.deepEqual(await inActivity(cdp, "window.__forceCompositionApp.getState().answers[4].placements[2]"), { mode: "snap", targetKey: "ORIGIN" }, `${label}: T1 keyboard move of F2 clears F3's stale lock before a fresh F3 root arrow`);
  return `${label}: cross-force keyboard moves invalidate stale H1/T1 release locks`;
}

async function runTripleMobileScale(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 390, 600, true);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(91, { tripleScale: label })}`);
  await navigateQuestion(cdp, 4);
  const metrics = await evaluate(cdp, `(() => {
    const svg=document.getElementById('stageSvg'),box=svg.viewBox.baseVal;
    const forces=[...document.querySelectorAll('.force-hit[data-force-index]')].map((node)=>node.getBoundingClientRect());
    return { cameraWidth:box.width, cameraHeight:box.height, minHitWidth:Math.min(...forces.map((rect)=>rect.width)), forceCount:forces.length };
  })()`);
  assert.equal(metrics.forceCount, 3, `${label}: T1 exposes all three force targets on mobile`);
  assert.ok(metrics.cameraWidth < 600, `${label}: T1 mobile camera keeps a useful scale (${metrics.cameraWidth})`);
  assert.ok(metrics.minHitWidth >= 44, `${label}: T1 force targets remain touchable (${metrics.minHitWidth})`);
  return `${label}: T1 mobile camera keeps the three vectors readable`;
}

async function runHeadTailEndpointSnaps(cdp, baseUrl, launchPath, label) {
  const cases = [
    { moving: 0, endpoint: "TAIL", target: "F2_HEAD", order: [1, 0] },
    { moving: 0, endpoint: "HEAD", target: "F2_TAIL", order: [0, 1] },
    { moving: 1, endpoint: "TAIL", target: "F1_HEAD", order: [0, 1] },
    { moving: 1, endpoint: "HEAD", target: "F1_TAIL", order: [1, 0] }
  ];
  for (const questionIndex of [2, 3]) {
    for (const [caseIndex, testCase] of cases.entries()) {
      await setViewport(cdp, 1180, 760, false);
      // Use a geometry-safe deterministic seed for the bidirectional endpoint
      // matrix; the near-edge seed 0/1 release-safety cases are covered by
      // runReleaseSafeContinuations above and are intentionally rejected as
      // semantic snaps when their free representation would clip.
      await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(16, { endpointSnap: `${label}-${questionIndex}-${caseIndex}` })}`);
      await navigateQuestion(cdp, questionIndex);
      const stationaryIndex = testCase.moving === 0 ? 1 : 0;
      const stationaryBefore = await currentTail(cdp, stationaryIndex);
      await moveForceEndpoint(cdp, testCase.moving, testCase.endpoint, testCase.target, false, testCase.endpoint === "HEAD" ? { x: 8, y: 0 } : undefined);
      const result = await evaluate(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[${questionIndex}],a=s.answers[${questionIndex}],M=window.ForceCompositionModel; return {complete:M.chainInfo(a,q).complete,order:M.chainInfo(a,q).order}; })()`);
      assert.equal(result.complete, true, `${label}: H${questionIndex - 1} ${testCase.endpoint.toLowerCase()} endpoint snap completes the chain (case ${caseIndex}, ${JSON.stringify(result)})`);
      assert.deepEqual(result.order, testCase.order, `${label}: H${questionIndex - 1} ${testCase.endpoint.toLowerCase()} endpoint snap uses the expected order (case ${caseIndex})`);
      const stationaryAfter = await currentTail(cdp, stationaryIndex);
      assert.ok(Math.hypot(stationaryAfter.x - stationaryBefore.x, stationaryAfter.y - stationaryBefore.y) <= 0.2, `${label}: H${questionIndex - 1} stationary force stays fixed during ${testCase.endpoint.toLowerCase()} snap`);
    }
  }
  const tripleCases = [];
  for (let moving = 0; moving < 3; moving += 1) {
    for (let target = 0; target < 3; target += 1) {
      if (moving !== target) tripleCases.push({ moving, target });
    }
  }
  for (const [caseIndex, testCase] of tripleCases.entries()) {
    await setViewport(cdp, 1180, 760, false);
    await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(16, { tripleEndpointSnap: `${label}-${caseIndex}` })}`);
    await navigateQuestion(cdp, 4);
    const stationaryBefore = await currentTail(cdp, testCase.target);
    await moveForceEndpoint(cdp, testCase.moving, "HEAD", `F${testCase.target + 1}_TAIL`, false, { x: 8, y: 0 });
    const result = await evaluate(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[4],a=s.answers[4],M=window.ForceCompositionModel; return {placements:a.placements,order:M.chainInfo(a,q).order}; })()`);
    assert.deepEqual(result.placements[testCase.moving], { mode: "snap", targetKey: "ORIGIN" }, `${label}: T1 F${testCase.moving + 1} head snaps to the selected tail`);
    assert.deepEqual(result.placements[testCase.target], { mode: "snap", targetKey: `F${testCase.moving + 1}_HEAD` }, `${label}: T1 selected force becomes the dragged force's child`);
    assert.deepEqual(result.order, [testCase.moving, testCase.target], `${label}: T1 head-to-tail snap keeps a single chain path`);
    const stationaryAfter = await currentTail(cdp, testCase.target);
    assert.ok(Math.hypot(stationaryAfter.x - stationaryBefore.x, stationaryAfter.y - stationaryBefore.y) <= 0.2, `${label}: T1 stationary force stays fixed during head-to-tail snap`);
  }
  for (const [caseIndex, testCase] of tripleCases.entries()) {
    await setViewport(cdp, 1180, 760, false);
    await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(16, { tripleRootSnap: `${label}-${caseIndex}` })}`);
    await navigateQuestion(cdp, 4);
    await moveForce(cdp, testCase.target, "ORIGIN", "mouse");
    const stationaryBefore = await currentTail(cdp, testCase.target);
    await moveForceEndpoint(cdp, testCase.moving, "HEAD", `F${testCase.target + 1}_TAIL`, false, { x: 8, y: 0 });
    const result = await evaluate(cdp, `(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[4],a=s.answers[4],M=window.ForceCompositionModel; return {placements:a.placements,order:M.chainInfo(a,q).order}; })()`);
    assert.deepEqual(result.placements[testCase.moving], { mode: "snap", targetKey: "ORIGIN" }, `${label}: T1 head-to-root-tail re-roots the dragged force`);
    assert.deepEqual(result.placements[testCase.target], { mode: "snap", targetKey: `F${testCase.moving + 1}_HEAD` }, `${label}: T1 original root becomes the dragged force's child`);
    assert.deepEqual(result.order, [testCase.moving, testCase.target], `${label}: T1 head-to-root-tail snap keeps a single chain path`);
    const stationaryAfter = await currentTail(cdp, testCase.target);
    assert.ok(Math.hypot(stationaryAfter.x - stationaryBefore.x, stationaryAfter.y - stationaryBefore.y) <= 0.2, `${label}: T1 root force stays fixed during re-root snap`);
  }
  return `${label}: H1/H2 and T1 tail-to-head/head-to-tail endpoint snaps passed in both directions`;
}

async function runWrongGuideResultantSnap(cdp, baseUrl, launchPath, label) {
  await setViewport(cdp, 1180, 760, false);
  await navigateDirect(cdp, `${baseUrl}${launchPath}?${query(7, { wrongGuideIntersection: label })}`);
  await navigateQuestion(cdp, 0);
  await moveForce(cdp, 0, "ORIGIN", "mouse");
  await moveForce(cdp, 1, "ORIGIN", "mouse");
  await drawLine(cdp, "guide-start-F1_HEAD", { x: 300, y: 300 }, "mouse");
  await drawLine(cdp, "guide-start-F2_HEAD", { x: 520, y: 160 }, "mouse");
  const intersection = await inActivity(cdp, "(() => { const app=window.__forceCompositionApp,s=app.getState(),q=app.getScenario().questions[0]; return window.ForceCompositionModel.guideIntersectionPoint(s.answers[0],q); })()");
  assert.ok(intersection, `${label}: wrong guides have a visible intersection`);
  await enterResultantMode(cdp);
  await drawLine(cdp, "resultant-start-ORIGIN", { x: intersection.x + 7, y: intersection.y - 6 }, "mouse");
  const resultant = await inActivity(cdp, "window.__forceCompositionApp.getState().answers[0].resultant");
  assert.deepEqual(resultant.end, {
    mode: "snap", targetKey: "GUIDE_INTERSECTION", point10: [Math.round(intersection.x * 10), Math.round(intersection.y * 10)]
  }, `${label}: resultant endpoint snaps to the crossing of wrong guides`);
  return `${label}: wrong-guide intersection resultant snap passed`;
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

  const cameraBeforePreview = await inActivity(cdp, "document.getElementById('stageSvg').getAttribute('viewBox')", true);
  const previewStart = await elementPoint(cdp, '.force-hit[data-force-index="0"]', true);
  const preview = await touchPreviewProbe(cdp, previewStart, { x: previewStart.x + 62, y: previewStart.y + 28 });
  assert.equal(preview.down.visible, true, `${label}: touch drag immediately shows the stage preview window`);
  assert.equal(preview.down.sourceChildren, preview.down.previewChildren, `${label}: preview clones the complete rendered stage`);
  assert.ok(preview.down.viewBox && preview.down.focusX && preview.down.focusY, `${label}: preview exposes a focused crop and touch marker`);
  assert.equal(preview.moved.visible, true, `${label}: preview stays visible while the finger moves`);
  assert.notEqual(preview.moved.viewBox, preview.down.viewBox, `${label}: preview crop follows the finger`);
  assert.notEqual(`${preview.moved.focusX},${preview.moved.focusY}`, `${preview.down.focusX},${preview.down.focusY}`, `${label}: preview focus follows the finger`);
  assert.equal(preview.down.camera, cameraBeforePreview, `${label}: camera stays fixed during touch drag`);
  assert.equal(preview.moved.camera, cameraBeforePreview, `${label}: camera does not zoom while touch drag updates`);
  assert.equal(preview.ended.visible, false, `${label}: preview hides after touch release`);
  assert.equal(preview.ended.previewChildren, 0, `${label}: preview clears its cloned stage after release`);
  assert.equal(preview.ended.camera, cameraBeforePreview, `${label}: camera remains fixed after touch release`);
  await click(cdp, "#resetQuestion", true); await click(cdp, "#confirmReset", true);

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

  await evaluate(cdp, "window.scrollTo(0, 0)");
  const blankAfterResultant = await blankStagePoint(cdp, true);
  const beforeResultantBlank = await iframeMetrics(cdp);
  const resultantBeforeBlank = await inActivity(cdp, "JSON.stringify(window.__forceCompositionApp.getState().answers[window.__forceCompositionApp.getState().currentQuestion].resultant)", true);
  const resultantBlankLogStart = await inActivity(cdp, "window.__forceCompositionApp.getTouchTelemetry().length", true);
  await touch(cdp, blankAfterResultant, { x: blankAfterResultant.x, y: blankAfterResultant.y - 95 });
  const afterResultantBlank = await iframeMetrics(cdp);
  assert.ok(afterResultantBlank.host > beforeResultantBlank.host, `${label}: blank stage still forwards to host after resultant exists`);
  assert.equal(afterResultantBlank.activity, beforeResultantBlank.activity, `${label}: resultant blank swipe does not scroll activity document`);
  assert.equal(afterResultantBlank.panel, beforeResultantBlank.panel, `${label}: resultant blank swipe does not scroll control panel`);
  assert.equal(await inActivity(cdp, "JSON.stringify(window.__forceCompositionApp.getState().answers[window.__forceCompositionApp.getState().currentQuestion].resultant)", true), resultantBeforeBlank, `${label}: blank stage swipe preserves the existing resultant`);
  const resultantBlankEvents = (await inActivity(cdp, "window.__forceCompositionApp.getTouchTelemetry()", true)).slice(resultantBlankLogStart);
  assert.ok(resultantBlankEvents.some((event) => event.type === "touchmove" && event.isTrusted), `${label}: existing-resultant blank swipe uses trusted host forwarding`);

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
    const sourcePendingRetry = await runPendingRetry(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packagePendingRetry = await runPendingRetry(cdp, packageBase, extracted.activityPath, "package");
    const sourceOrders = await runTripleOrders(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageOrders = await runTripleOrders(cdp, packageBase, extracted.activityPath, "package");
    const sourceKeyboardRelease = await runKeyboardForceRelease(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageKeyboardRelease = await runKeyboardForceRelease(cdp, packageBase, extracted.activityPath, "package");
    const sourceArbitraryAnchors = await runTripleArbitraryAnchors(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageArbitraryAnchors = await runTripleArbitraryAnchors(cdp, packageBase, extracted.activityPath, "package");
    const sourceParallelogramBoundary = await runParallelogramBoundary(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageParallelogramBoundary = await runParallelogramBoundary(cdp, packageBase, extracted.activityPath, "package");
    const sourcePreviewMouse = await runPointerPreviewCommitParity(cdp, sourceBase, `/sim/${slug}/index.html`, "source", "mouse");
    const packagePreviewMouse = await runPointerPreviewCommitParity(cdp, packageBase, extracted.activityPath, "package", "mouse");
    const sourcePreviewTouch = await runPointerPreviewCommitParity(cdp, sourceBase, `/sim/${slug}/index.html`, "source", "touch");
    const packagePreviewTouch = await runPointerPreviewCommitParity(cdp, packageBase, extracted.activityPath, "package", "touch");
    const sourceSnapThresholdMouse = await runSnapThresholdContinuity(cdp, sourceBase, `/sim/${slug}/index.html`, "source", "mouse");
    const packageSnapThresholdMouse = await runSnapThresholdContinuity(cdp, packageBase, extracted.activityPath, "package", "mouse");
    const sourceSnapThresholdTouch = await runSnapThresholdContinuity(cdp, sourceBase, `/sim/${slug}/index.html`, "source", "touch");
    const packageSnapThresholdTouch = await runSnapThresholdContinuity(cdp, packageBase, extracted.activityPath, "package", "touch");
    const sourceReleaseSafe = await runReleaseSafeContinuations(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageReleaseSafe = await runReleaseSafeContinuations(cdp, packageBase, extracted.activityPath, "package");
    const sourceKeyboardAlternate = await runKeyboardAlternateTarget(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageKeyboardAlternate = await runKeyboardAlternateTarget(cdp, packageBase, extracted.activityPath, "package");
    const sourceKeyboardLifecycle = await runKeyboardLockResetUndo(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageKeyboardLifecycle = await runKeyboardLockResetUndo(cdp, packageBase, extracted.activityPath, "package");
    const sourceKeyboardCrossLock = await runKeyboardCrossForceLock(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageKeyboardCrossLock = await runKeyboardCrossForceLock(cdp, packageBase, extracted.activityPath, "package");
    const sourceTripleScale = await runTripleMobileScale(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageTripleScale = await runTripleMobileScale(cdp, packageBase, extracted.activityPath, "package");
    const sourceEndpointSnaps = await runHeadTailEndpointSnaps(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageEndpointSnaps = await runHeadTailEndpointSnaps(cdp, packageBase, extracted.activityPath, "package");
    const sourceWrongGuideSnap = await runWrongGuideResultantSnap(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageWrongGuideSnap = await runWrongGuideResultantSnap(cdp, packageBase, extracted.activityPath, "package");
    const sourceTouch = await runTouchMatrix(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageTouch = await runTouchMatrix(cdp, packageBase, extracted.activityPath, "package");
    assert.deepEqual(consoleErrors, [], `browser console/runtime errors before negative lifecycle fixtures: ${consoleErrors.join("\n")}`);
    consoleErrors.length = 0;
    const sourceLifecycle = await runLifecycleFixtures(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    const packageLifecycle = await runLifecycleFixtures(cdp, packageBase, extracted.activityPath, "package");
    assert.deepEqual(runtimeExceptions, [], `uncaught runtime exceptions: ${runtimeExceptions.join("\n")}`);
    const version = await cdp.send("Browser.getVersion");
    summary = `Force-composition browser regression passed on ${version.product}: ${sourceDirect}; ${packageDirect}; ${sourceBlank}; ${packageBlank}; ${sourceDraft}; ${packageDraft}; ${sourcePendingRetry}; ${packagePendingRetry}; ${sourceOrders}; ${packageOrders}; ${sourceKeyboardRelease}; ${packageKeyboardRelease}; ${sourceArbitraryAnchors}; ${packageArbitraryAnchors}; ${sourceParallelogramBoundary}; ${packageParallelogramBoundary}; ${sourcePreviewMouse}; ${packagePreviewMouse}; ${sourcePreviewTouch}; ${packagePreviewTouch}; ${sourceSnapThresholdMouse}; ${packageSnapThresholdMouse}; ${sourceSnapThresholdTouch}; ${packageSnapThresholdTouch}; ${sourceReleaseSafe}; ${packageReleaseSafe}; ${sourceKeyboardAlternate}; ${packageKeyboardAlternate}; ${sourceKeyboardLifecycle}; ${packageKeyboardLifecycle}; ${sourceKeyboardCrossLock}; ${packageKeyboardCrossLock}; ${sourceTripleScale}; ${packageTripleScale}; ${sourceEndpointSnaps}; ${packageEndpointSnaps}; ${sourceWrongGuideSnap}; ${packageWrongGuideSnap}; ${sourceTouch}; ${packageTouch}; ${sourceLifecycle}; ${packageLifecycle}`;
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
module.exports = {
  sourceParity, query, runReleaseSafeContinuations, runKeyboardAlternateTarget, runKeyboardLockResetUndo, runKeyboardCrossForceLock,
  runParallelogramBoundary, runPointerPreviewCommitParity, runSnapThresholdContinuity, runKeyboardForceRelease, runHeadTailEndpointSnaps, setViewport, navigateDirect, navigateQuestion, focus, press, moveForce, click, inActivity
};
