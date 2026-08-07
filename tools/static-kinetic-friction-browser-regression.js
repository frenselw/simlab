#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { XMLParser } = require("fast-xml-parser");
const { CdpClient, buildAndExtractPackage, cleanupResources, createServer, delay, devToolsPort, evaluate, fetchJson, findBrowser, listenServer, validateOwnedProfile, withTimeout } = require("./position-time-browser-regression.js");
const root = path.resolve(__dirname, "..");
const slug = "static-kinetic-friction-investigation-lab";
function parity() {
  const html = fs.readFileSync(path.join(root, "sim", slug, "index.html"), "utf8");
  const manifest = new XMLParser({ ignoreAttributes: false }).parse(fs.readFileSync(path.join(root, "sim/manifests", `${slug}.xml`), "utf8"));
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((x) => /\.(?:js|css)$/.test(x) && x !== "../config.js").map((x) => x.startsWith("../") ? x.slice(3) : `${slug}/${x}`).sort();
  const files = [].concat(manifest.manifest.resources.resource.file || []).map((entry) => entry["@_href"]).filter((x) => x !== "config.js" && x !== `${slug}/index.html`).sort();
  assert.deepEqual(refs, files, "source HTML and SCORM manifest runtime references differ");
  assert.equal(fs.readFileSync(path.join(root, "sim", slug, "styles.css"), "utf8").includes("touch-action: pan-y"), true);
  return refs;
}
async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await delay(300);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(cdp, "Boolean(window.__staticKineticFrictionApp && document.readyState === 'complete')")) return;
    await delay(50);
  }
  throw new Error(`activity did not become ready: ${url}`);
}
async function touch(cdp, start, end) {
  const id = 17;
  const point = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(start)] });
  for (let index = 1; index <= 8; index += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point({ x: start.x + (end.x - start.x) * index / 8, y: start.y + (end.y - start.y) * index / 8 })] });
    await delay(8);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function tap(cdp, point) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, id: 18, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(40);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(120);
}
async function frameEvaluate(cdp, expression) {
  return evaluate(cdp, `(() => {
    const frame = document.getElementById("activity");
    if (!frame?.contentWindow) throw new Error("Moodle-like activity iframe is unavailable");
    const childWindow = frame.contentWindow;
    return ((document, window) => (${expression}))(childWindow.document, childWindow);
  })()`);
}
async function navigateEmbedded(cdp, base, launch) {
  await cdp.send("Page.navigate", { url: `${base}/__embed-scroll-test.html?fluid=1&src=${encodeURIComponent(launch)}` });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await frameEvaluate(cdp, "document.readyState === 'complete' && Boolean(window.__staticKineticFrictionApp)")) return;
    await delay(50);
  }
  throw new Error(`embedded activity did not become ready: ${launch}`);
}
async function embeddedSmoke(cdp, base, launch, label, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigateEmbedded(cdp, base, launch);
  const layout = await frameEvaluate(cdp, `(() => {
    const stage = document.getElementById("stage");
    const panel = document.getElementById("controlPanel");
    window.__trustedEvents = [];
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) document.addEventListener(type, event => window.__trustedEvents.push({ type, trusted: event.isTrusted, pointerType: event.pointerType }), true);
    return {
      presentation: window.__staticKineticFrictionApp.getPresentation(),
      phase: window.__staticKineticFrictionApp.getState().phase,
      touch: getComputedStyle(stage).touchAction,
      html: document.documentElement.scrollHeight,
      inner: innerHeight,
      panelRange: panel.scrollHeight - panel.clientHeight,
      appHeight: document.getElementById('app').getBoundingClientRect().height,
      shellHeight: document.querySelector('.friction-shell').getBoundingClientRect().height,
      stageHeight: stage.getBoundingClientRect().height,
      panelHeight: panel.getBoundingClientRect().height,
      controlsFirst: document.querySelector('.friction-shell').firstElementChild === panel,
      targets: [...document.querySelectorAll('.drag-target')].map(node => { const r = node.getBoundingClientRect(); return { w: r.width, h: r.height }; })
    };
  })()`);
  assert.equal(layout.presentation, "editable", `${label}: embedded startup presentation`);
  assert.equal(layout.phase, "balance", `${label}: embedded startup phase`);
  assert.equal(layout.touch, "pan-y", `${label}: embedded stage touch action`);
  assert.ok(layout.html <= layout.inner + 1, `${label}: embedded activity document is bounded (${layout.html}/${layout.inner}; app=${layout.appHeight}, shell=${layout.shellHeight}, stage=${layout.stageHeight}, panel=${layout.panelHeight})`);
  assert.ok(layout.panelRange > 8, `${label}: embedded panel has independent scroll range`);
  assert.equal(layout.controlsFirst, true, `${label}: controls precede stage in live DOM order`);
  assert.ok(layout.targets.every((target) => target.w >= 44 && target.h >= 44), `${label}: embedded targets are stable touch sizes`);
  await evaluate(cdp, "scrollTo({ top: 300, behavior: 'instant' })");
  await delay(120);
  const tarePoint = await frameEvaluate(cdp, `(() => { const frame = window.frameElement.getBoundingClientRect(); const r = document.getElementById('tareButton').getBoundingClientRect(); return { x: frame.left + r.left + r.width / 2, y: frame.top + r.top + r.height / 2 }; })()`);
  await tap(cdp, tarePoint);
  await delay(500);
  assert.equal(await frameEvaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.tared"), true, `${label}: panel tap synthesizes tare click`);
  const metrics = () => frameEvaluate(cdp, `(() => ({ panel: document.getElementById('controlPanel').scrollTop, activity: window.scrollY, host: window.parent.scrollY }))()`);
  await evaluate(cdp, "scrollTo({ top: 120, behavior: 'instant' })");
  await delay(120);
  const blank = await frameEvaluate(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const r = document.getElementById('stage').getBoundingClientRect();
    const points = [[.18,.20],[.50,.20],[.82,.20],[.20,.78],[.50,.78],[.82,.78]];
    for (const [rx, ry] of points) { const x = r.left + r.width * rx, y = r.top + r.height * ry; const hit = document.elementFromPoint(x,y); if (!hit?.closest('.drag-target')) return { x: frame.left + x, y: frame.top + y }; }
    throw new Error('no blank stage point available');
  })()`);
  const beforeStage = await metrics();
  await touch(cdp, blank, { x: blank.x, y: blank.y - 65 });
  const afterStage = await metrics();
  assert.notEqual(afterStage.host, beforeStage.host, `${label}: stage swipe owns enclosing Moodle host scroll`);
  assert.equal(afterStage.panel, beforeStage.panel, `${label}: stage swipe does not scroll control panel`);
  await evaluate(cdp, "scrollTo({ top: 300, behavior: 'instant' })");
  await delay(120);
  const panelPoint = await frameEvaluate(cdp, `(() => { const frame = window.frameElement.getBoundingClientRect(); const panel = document.getElementById('controlPanel'); const r = panel.getBoundingClientRect(); for (let y = r.top + 12; y < r.bottom - 12; y += 12) { const hit = document.elementFromPoint(r.left + r.width / 2, y); if (!hit?.closest('button,input,select,.drag-target')) return { x: frame.left + r.left + r.width / 2, y: frame.top + y }; } return { x: frame.left + r.left + r.width / 2, y: frame.top + r.top + 12 }; })()`);
  const panelRange = await frameEvaluate(cdp, "(() => { const panel = document.getElementById('controlPanel'); return panel.scrollHeight - panel.clientHeight; })()");
  // Exceed Chromium's touch-slop so the trusted gesture produces touchmove
  // events even when the panel has only a short remaining scroll range.
  const panelDelta = Math.max(16, Math.min(24, panelRange / 4));
  await frameEvaluate(cdp, `(() => { const panel = document.getElementById('controlPanel'); panel.scrollTop = ${panelRange / 2}; return true; })()`);
  await evaluate(cdp, "window.__panelTestLockY=scrollY; window.__panelTestLock=()=>scrollTo(0,window.__panelTestLockY); addEventListener('scroll',window.__panelTestLock,{passive:true}); document.documentElement.style.overflow='hidden'; document.body.style.overflow='hidden'; document.scrollingElement.style.overflow='hidden';");
  const beforePanel = await metrics();
  await frameEvaluate(cdp, "window.parent.postMessage({ source: 'simlab', activity: 'static-kinetic-friction-investigation-lab', type: 'panel-gesture', phase: 'start' }, window.location.origin)");
  await touch(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y - panelDelta });
  await frameEvaluate(cdp, "window.parent.postMessage({ source: 'simlab', activity: 'static-kinetic-friction-investigation-lab', type: 'panel-gesture', phase: 'end' }, window.location.origin)");
  await delay(320);
  const afterPanel = await metrics();
  await evaluate(cdp, "removeEventListener('scroll',window.__panelTestLock); window.__panelTestLock=null; document.documentElement.style.overflow=''; document.body.style.overflow=''; document.scrollingElement.style.overflow='';");
  assert(afterPanel.panel > beforePanel.panel, `${label}: control panel swipe owns panel scroll`);
  assert.ok(Math.abs(afterPanel.host - beforePanel.host) <= 1, `${label}: panel swipe leaves enclosing host fixed (≤1 CSS px rounding)`);
  const targets = await frameEvaluate(cdp, `(() => { const frame = window.frameElement.getBoundingClientRect(); return [...document.querySelectorAll('.drag-target')].map(node => { const r = node.getBoundingClientRect(); return { x: frame.left + r.left + r.width / 2, y: frame.top + r.top + r.height / 2, id: node.dataset.dragTarget }; }); })()`);
  for (const target of targets) {
    await frameEvaluate(cdp, "window.__trustedEvents = []");
    await touch(cdp, target, { x: target.x + 18, y: target.y });
    const events = await frameEvaluate(cdp, "window.__trustedEvents.slice()");
    const touchEvents = events.filter((event) => event.pointerType === "touch");
    assert(touchEvents.some((event) => event.type === "pointerup" && event.trusted), `${label}: ${target.id} has trusted pointerup`);
    assert.equal(touchEvents.some((event) => event.type === "pointercancel"), false, `${label}: ${target.id} has no pointercancel`);
  }
}
async function realSmoke() {
  const tempRoot = fs.realpathSync(os.tmpdir());
  let sourceServer, packageServer, packageDirectory, chrome, cdp, profileDirectory;
  try {
    const extracted = buildAndExtractPackage(tempRoot, { slug }); packageDirectory = extracted.packageDirectory;
    sourceServer = createServer(root); packageServer = createServer(packageDirectory); await listenServer(sourceServer); await listenServer(packageServer);
    const sourceBase = `http://127.0.0.1:${sourceServer.address().port}`; const packageBase = `http://127.0.0.1:${packageServer.address().port}`;
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, "simlab-position-time-chrome-")); validateOwnedProfile(profileDirectory, tempRoot);
    chrome = spawn(findBrowser(), ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    const port = await withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome DevTools startup"); const { body: target } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    cdp = new CdpClient(target.webSocketDebuggerUrl); await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true }); await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    for (const [base, launch, label] of [[sourceBase, `/sim/${slug}/index.html`, "source"], [packageBase, extracted.activityPath, "package"]]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
      await navigate(cdp, `${base}${launch}`);
      const layout = await evaluate(cdp, `(()=>{const stage=document.getElementById('stage'),panel=document.getElementById('controlPanel'),app=document.getElementById('app'),shell=document.querySelector('.friction-shell');window.__trustedEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>window.__trustedEvents.push({type,isTrusted:e.isTrusted,pointerType:e.pointerType}),true);return {presentation:window.__staticKineticFrictionApp.getPresentation(),phase:window.__staticKineticFrictionApp.getState().phase,resultHidden:document.getElementById('resultPanel').classList.contains('is-hidden'),touch:getComputedStyle(stage).touchAction,html:document.documentElement.scrollHeight,inner:innerHeight,panelRange:panel.scrollHeight-panel.clientHeight,panelClientHeight:panel.clientHeight,panelScrollHeight:panel.scrollHeight,appHeight:app.getBoundingClientRect().height,shellHeight:shell.getBoundingClientRect().height,targets:[...document.querySelectorAll('.drag-target')].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))}})()`);
      assert.equal(layout.presentation, "editable", `${label}: startup presentation`); assert.equal(layout.phase, "balance", `${label}: startup phase`); assert.equal(layout.resultHidden, true, `${label}: result starts hidden`); assert.equal(layout.touch, "pan-y", `${label}: stage touch action`); assert.ok(layout.html <= layout.inner + 1, `${label}: activity document is bounded`); assert.ok(layout.panelRange > 8, `${label}: panel has independent scroll range (${layout.panelRange}; client=${layout.panelClientHeight}, scroll=${layout.panelScrollHeight}, app=${layout.appHeight}, shell=${layout.shellHeight})`); assert.ok(layout.targets.every((target) => target.w >= 44 && target.h >= 44), `${label}: touch targets are stable`);
      const stage = await evaluate(cdp, "(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()"); await touch(cdp, stage, { x: stage.x, y: stage.y - 55 });
      await evaluate(cdp, "window.__trustedEvents=[]");
      const target = await evaluate(cdp, "(()=>{const r=document.getElementById('forceGrip').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()"); await touch(cdp, target, { x: target.x + 45, y: target.y });
      const trusted = await evaluate(cdp, "({events:window.__trustedEvents,host:scrollY,panel:document.getElementById('controlPanel').scrollTop})"); assert.ok(trusted.events.some((event) => event.type === "pointermove" && event.isTrusted), `${label}: trusted pointermove delivered`); assert.ok(trusted.events.some((event) => event.type === "pointerup" && event.isTrusted), `${label}: trusted pointerup delivered`); assert.equal(trusted.events.some((event) => event.type === "pointercancel"), false, `${label}: no pointercancel`);
      for (const [width, height] of [[320, 500], [390, 600], [600, 390], [768, 800]]) {
        await embeddedSmoke(cdp, base, launch, `${label} iframe ${width}x${height}`, width, height);
      }
    }
    console.log("Static/kinetic friction browser regression passed: source and extracted SCORM startup, bounded layout, trusted touch and target contract");
  } finally {
    await cleanupResources({ chrome, cdp, profileDirectory, packageDirectory, server: sourceServer, tempRoot }).catch(() => {});
    if (packageServer) await new Promise((resolve) => packageServer.close(resolve));
  }
}
if (require.main === module) {
  if (process.argv.includes("--parity")) console.log(`Static/kinetic friction browser parity checks passed (${parity().length} runtime files)`);
  else realSmoke().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
module.exports = { parity, realSmoke };
