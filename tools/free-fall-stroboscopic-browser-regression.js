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
const slug = "free-fall-stroboscopic-measurement-lab";

function sourceParity() {
  const html = fs.readFileSync(path.join(root, "sim", slug, "index.html"), "utf8");
  const manifest = fs.readFileSync(path.join(root, "sim", "manifests", `${slug}.xml`), "utf8");
  const referenced = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1]).filter((value) => /\.(?:js|css)$/.test(value))
    .map((value) => value.startsWith("../") ? value.slice(3) : `${slug}/${value}`));
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
  const declared = new Set([].concat(parsed.manifest.resources.resource.file || [])
    .map((entry) => entry["@_href"]).filter((value) => value !== "config.js" && value !== `${slug}/index.html`));
  assert.deepEqual([...referenced].sort(), [...declared].sort(), "manifest exactly declares every local runtime dependency");
}

async function navigate(cdp, url, embedded = false) {
  await cdp.send("Page.navigate", { url });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = await evaluate(cdp, embedded
      ? "Boolean(document.getElementById('activity')?.contentWindow?.__freeFallDebug)"
      : "Boolean(window.__freeFallDebug)");
    if (ready) return;
    await delay(50);
  }
  throw new Error(`free-fall activity did not load: ${url}`);
}

async function setViewport(cdp, width, height, pageScale = 1) {
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: pageScale });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
}

async function prepare(cdp, frameExpression = "window") {
  await evaluate(cdp, `(() => { const w=${frameExpression},d=w.document; d.querySelector('[data-frequency="5"]').click(); d.getElementById('generateButton').click(); })()`);
  await delay(100);
}

async function productionFixture(cdp) {
  return evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,P=w.FreeFallPersistence,S=w.FreeFallScoring,M=w.FreeFallModel;
    let state=P.generate(P.configuredState(5));
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,edgeSide:'right',edgeGapPx:10,zeroErrorPx:0});
    state=P.withPlacement(state,place('total',0));
    for(let index=0;index<4;index+=1)state=P.resolveMeasurement(state,M.displacementAt(5,index+1));
    for(let index=0;index<4;index+=1){const task=S.GAP_KEYS[index];state=P.resolveMeasurement(P.withPlacement(state,place(task,M.displacementAt(5,index))),M.intervalDisplacement(5,index+1));}
    state=P.setAnalysis(state,{deltaTS:.2,cumulativeTimeRatio:{status:'answered',values:[1,2,3,4]},totalDisplacementRatio:{status:'answered',values:[1,4,9,16]},intervalTimeRatio:{status:'answered',values:[1,1,1,1]},intervalDistanceRatio:{status:'answered',values:[1,3,5,7]},lawAnswerId:'square',intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    state=P.enterReview(state);const review=P.makeReview(state),result=S.scoreAttempt(review),snapshot=w.SimScorm.makeSnapshot('${slug}','review',review,result);
    return {review,result,snapshot,pending:{version:1,activity:'${slug}',kind:'pending-final',payload:{reviewJson:JSON.stringify(snapshot),score:result.score,maxScore:100,passed:result.passed}}};
  })()`);
}

async function reloadWithLms(cdp, activityPath, caseId, values) {
  await evaluate(cdp, `(() => {
    const values=${JSON.stringify(values)},f=document.getElementById('activity');
    window.API={LMSInitialize:()=>'true',LMSGetValue:key=>values[key]||'',LMSSetValue:(key,value)=>(values[key]=String(value),'true'),LMSCommit:()=>'true',LMSFinish:()=>'true',LMSGetLastError:()=>'0',LMSGetErrorString:()=>'No error'};
    f.src=${JSON.stringify(activityPath)}+'?lifecycle='+${JSON.stringify(caseId)};
  })()`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, `(() => {const w=document.getElementById('activity')?.contentWindow;return Boolean(w&&new URLSearchParams(w.location.search).get('lifecycle')===${JSON.stringify(caseId)}&&w.__freeFallDebug)})()`)) return;
    await delay(50);
  }
  throw new Error(`lifecycle case did not load: ${caseId}`);
}

async function runLifecycleMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}`, true);
  const fixture = await productionFixture(cdp);
  const values = (status, snapshot, score = "") => ({
    "cmi.core.lesson_status": status,
    "cmi.core.score.raw": String(score),
    "cmi.suspend_data": snapshot ? JSON.stringify(snapshot) : ""
  });

  await reloadWithLms(cdp, activityPath, `${label}-pending-valid`, values("incomplete", fixture.pending));
  let view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('technicalTitle').textContent,retry:[...d.querySelectorAll('#technicalSection button')].some(b=>/重試同一份/.test(b.textContent)),locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /待確認/); assert.ok(view.retry && view.locked, `${label}: valid frozen startup is locked with same-payload retry`);

  const badNested = { ...fixture.snapshot, answer: { invalid: true } };
  const badPending = { ...fixture.pending, payload: { ...fixture.pending.payload, reviewJson: JSON.stringify(badNested) } };
  await reloadWithLms(cdp, activityPath, `${label}-pending-invalid`, values("incomplete", badPending));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('technicalTitle').textContent,retry:w.SimScorm.retryPending().reason,locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /安全載入/); assert.equal(view.retry, "no-pending"); assert.ok(view.locked, `${label}: invalid frozen payload is quarantined and locked`);

  const badFinished = { version: 1, activity: slug, kind: "review", answer: { invalid: true }, score: 42, passed: false };
  await reloadWithLms(cdp, activityPath, `${label}-finished-invalid`, values("failed", badFinished, 42));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('resultTitle').textContent,score:d.getElementById('scorePanel').textContent,locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /詳細資料不可驗證/); assert.match(view.score, /42/); assert.ok(view.locked, `${label}: invalid finished review uses Moodle fallback`);

  await reloadWithLms(cdp, activityPath, `${label}-unknown-status`, values("completed", fixture.snapshot, fixture.result.score));
  view = await evaluate(cdp, `document.getElementById('activity').contentWindow.document.getElementById('scorePanel').textContent`);
  assert.match(view, /未能安全判斷合格狀態/, `${label}: unknown Moodle pass status remains indeterminate`);

  for (const [name, outcome] of [
    ["retryable", { activityState: "retry", retryable: true }],
    ["nonretryable", { activityState: "retry", retryable: false }],
    ["frozen", { activityState: "frozen", retryable: true }],
    ["success", { activityState: "success" }]
  ]) {
    await reloadWithLms(cdp, activityPath, `${label}-${name}`, values("not attempted", null));
    view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,fixture=${JSON.stringify(fixture)};w.__freeFallDebug.setReview(fixture.review);w.__freeFallDebug.routeSubmission(${JSON.stringify(outcome)});return {locked:w.__freeFallDebug.locked(),review:!d.getElementById('reviewSection').classList.contains('is-hidden'),technical:!d.getElementById('technicalSection').classList.contains('is-hidden'),result:!d.getElementById('resultSection').classList.contains('is-hidden'),retry:!d.getElementById('submissionRetry').classList.contains('is-hidden')};})()`);
    if (name === "retryable") assert.ok(!view.locked && view.review && view.retry, `${label}: retryable outcome remains editable`);
    if (name === "nonretryable") assert.ok(view.locked && view.technical, `${label}: non-retryable outcome uses technical lock`);
    if (name === "frozen") assert.ok(view.locked && view.technical, `${label}: frozen outcome uses pending lock`);
    if (name === "success") assert.ok(view.locked && view.result, `${label}: success outcome uses locked result`);
  }

  await reloadWithLms(cdp, activityPath, `${label}-committed`, values("not attempted", null));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,fixture=${JSON.stringify(fixture)};let finishes=0;w.SimScorm.finish=()=>{finishes+=1;return true};w.__freeFallDebug.setReview(fixture.review);w.__freeFallDebug.routeSubmission({activityState:'committed'});const before={locked:w.__freeFallDebug.locked(),retry:!d.getElementById('resultRetry').classList.contains('is-hidden')};d.getElementById('resultRetry').click();return {...before,finishes,title:d.getElementById('resultTitle').textContent,stillLocked:w.__freeFallDebug.locked()};})()`);
  assert.ok(view.locked && view.retry && view.finishes === 1 && view.stillLocked, `${label}: committed recovery calls finish once and remains locked`);
  assert.match(view.title, /完成連線/);
}

async function layoutMatrix(cdp, baseUrl, activityPath, label) {
  for (const [width, height, pageScale] of [[320, 500, 1], [390, 500, 1], [390, 600, 1], [430, 800, 1], [700, 390, 1], [390, 600, 2]]) {
    await setViewport(cdp, width, height, pageScale);
    await navigate(cdp, `${baseUrl}${activityPath}`);
    const radioLabels = await evaluate(cdp, `(() => [...document.querySelectorAll('fieldset label')]
      .filter(label=>label.getClientRects().length>0)
      .map(label=>{const r=label.getBoundingClientRect();return {w:r.width,h:r.height,display:getComputedStyle(label).display}}))()`);
    await prepare(cdp);
    const snapshot = await evaluate(cdp, `(() => {
      const d=document.documentElement,b=document.body,a=document.querySelector('.freefall-app'),p=document.getElementById('controlPanel');
      p.scrollTop=p.scrollHeight;a.scrollTop=100;
      const last=p.querySelector('[data-reset-frequency]').getBoundingClientRect(),pr=p.getBoundingClientRect();
      return {docRange:d.scrollHeight-d.clientHeight,bodyRange:b.scrollHeight-b.clientHeight,
        appRange:a.scrollHeight-a.clientHeight,appScroll:a.scrollTop,horizontal:Math.max(d.scrollWidth-d.clientWidth,b.scrollWidth-b.clientWidth),
        panelRange:p.scrollHeight-p.clientHeight,panelBottom:p.scrollTop,buttonReachable:last.bottom<=pr.bottom+1,
        visual:visualViewport?{scale:visualViewport.scale,width:visualViewport.width,height:visualViewport.height}:null};
    })()`);
    assert.ok(snapshot.docRange <= 1 && snapshot.bodyRange <= 1 && snapshot.appScroll === 0,
      `${label} ${width}x${height}: activity document is not a third vertical owner ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.horizontal <= 1, `${label} ${width}x${height}: no horizontal overflow`);
    assert.ok(snapshot.panelRange > 0 && snapshot.panelBottom >= snapshot.panelRange - 1 && snapshot.buttonReachable,
      `${label} ${width}x${height}: independently scrolling panel reaches its true bottom`);
    assert.ok(radioLabels.length >= 2 && radioLabels.every((item) => item.h >= 44 && item.w > 0 && ["flex", "inline-flex", "block", "grid"].includes(item.display)),
      `${label} ${width}x${height}: radio labels are real >=44px layout boxes ${JSON.stringify(radioLabels)}`);
  }
}

async function touch(cdp, type, x, y) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" || type === "touchCancel" ? [] :
      [{ x, y, id: 1, radiusX: 5, radiusY: 5, force: 1 }]
  });
  await delay(45);
}

async function swipe(cdp, start, end) {
  await touch(cdp, "touchStart", start.x, start.y);
  for (let step = 1; step <= 5; step += 1) {
    await touch(cdp, "touchMove", start.x + (end.x - start.x) * step / 5, start.y + (end.y - start.y) * step / 5);
  }
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
}

async function settle(cdp, script, expected, label) {
  const value = await evaluate(cdp, `new Promise((resolve,reject)=>{let stable=0,frames=0;const tick=()=>{${script};const now=${expected.expression};stable=Math.abs(now-${expected.value})<=1?stable+1:0;if(stable>=5)return resolve(now);if(++frames>80)return reject(new Error('settle timeout'));requestAnimationFrame(tick)};tick()})`);
  assert.ok(Math.abs(value - expected.value) <= 1, label);
}

async function snapshot(cdp) {
  return evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),w=f.contentWindow,d=w.document,p=d.getElementById('controlPanel'),r=f.getBoundingClientRect();
    const hv=visualViewport,av=w.visualViewport;
    return {host:scrollY,hostViewport:{top:hv?.offsetTop||0,page:hv?.pageTop||0,left:hv?.offsetLeft||0},
      iframe:{top:r.top,left:r.left},activity:d.scrollingElement.scrollTop,
      activityViewport:{top:av?.offsetTop||0,page:av?.pageTop||0,left:av?.offsetLeft||0},
      panel:p.scrollTop,state:JSON.stringify(w.__freeFallDebug.state()),ruler:w.__freeFallDebug.ruler(),
      events:w.__freeFallDebug.eventCounts()};
  })()`);
}

function zeroDelta(before, after, keys, label) {
  for (const key of keys) assert.deepEqual(after[key], before[key], `${label}: ${key} remains fixed`);
}

async function point(cdp, selector) {
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),e=f.contentWindow.document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(); return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2}; })()`);
}

async function runTouchMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  const source = `${activityPath}?trusted-touch=${encodeURIComponent(label)}`;
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(source)}`, true);
  await prepare(cdp, "document.getElementById('activity').contentWindow");
  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: host setup`);

  const blank = await point(cdp, "#stage");
  blank.x = 35;
  for (const direction of [-1, 1]) {
    await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: blank reset`);
    const before = await snapshot(cdp);
    await swipe(cdp, { x: blank.x, y: blank.y }, { x: blank.x, y: blank.y + direction * 90 });
    const after = await snapshot(cdp);
    assert.ok(Math.abs(after.host - before.host) > 10, `${label}: blank-stage swipe ${direction} moves host`);
    assert.ok(Math.abs((after.iframe.top - before.iframe.top) + (after.host - before.host)) <= 3, `${label}: iframe moves with host`);
    zeroDelta(before, after, ["activity", "activityViewport", "panel", "state", "ruler"], `${label}: blank-stage swipe ${direction}`);
  }

  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: panel host reset`);
  const panelPoint = await point(cdp, "#controlPanel");
  for (const [name, setup, delta] of [
    ["middle-up", "p.scrollTop=Math.floor((p.scrollHeight-p.clientHeight)/2)", -90],
    ["middle-down", "p.scrollTop=Math.floor((p.scrollHeight-p.clientHeight)/2)", 90],
    ["top-boundary", "p.scrollTop=0", 90],
    ["bottom-boundary", "p.scrollTop=p.scrollHeight", -90]
  ]) {
    await settle(cdp, `const p=document.getElementById('activity').contentWindow.document.getElementById('controlPanel');${setup}`,
      { expression: "Math.round(document.getElementById('activity').contentWindow.document.getElementById('controlPanel').scrollTop)",
        value: name === "top-boundary" ? 0 : name === "bottom-boundary"
          ? await evaluate(cdp, "(()=>{const p=document.getElementById('activity').contentWindow.document.getElementById('controlPanel');return p.scrollHeight-p.clientHeight})()")
          : await evaluate(cdp, "(()=>{const p=document.getElementById('activity').contentWindow.document.getElementById('controlPanel');return Math.floor((p.scrollHeight-p.clientHeight)/2)})()") },
      `${label}: ${name} setup`);
    const before = await snapshot(cdp);
    await swipe(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y + delta });
    const after = await snapshot(cdp);
    if (name.startsWith("middle")) assert.ok(Math.abs(after.panel - before.panel) > 10, `${label}: ${name} changes panel scroll`);
    zeroDelta(before, after, ["host", "hostViewport", "iframe", "activity", "activityViewport", "state", "ruler"], `${label}: panel ${name}`);
  }

  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: ruler host reset`);
  await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('controlPanel').scrollTop=0");
  const rulerPoint = await point(cdp, "#rulerHandle");
  const beforeDrag = await snapshot(cdp);
  await swipe(cdp, rulerPoint, { x: rulerPoint.x - 125, y: rulerPoint.y + 35 });
  const afterDrag = await snapshot(cdp);
  assert.notDeepEqual(afterDrag.ruler, beforeDrag.ruler, `${label}: trusted touch changes ruler`);
  zeroDelta(beforeDrag, afterDrag, ["host", "hostViewport", "iframe", "activity", "activityViewport", "panel"], `${label}: ruler drag`);
  const beforeState = JSON.parse(beforeDrag.state), afterState = JSON.parse(afterDrag.state);
  assert.deepEqual(afterState.measurements, beforeState.measurements, `${label}: drag does not record an answer`);
  assert.deepEqual(afterState.evidence, beforeState.evidence, `${label}: pointerup creates placement, not finalized evidence`);
  assert.ok(afterDrag.events.trusted && afterDrag.events.pointerType === "touch" && afterDrag.events.moves > 0 &&
    afterDrag.events.ups === 1 && afterDrag.events.cancels === 0,
  `${label}: trusted touch delivers pointermove/pointerup without pointercancel ${JSON.stringify(afterDrag.events)}`);
}

async function runArtifact(cdp, packageRoot, activityPath, label) {
  const server = createServer(packageRoot);
  await withTimeout(listenServer(server), 3000, `${label} HTTP listen`);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await layoutMatrix(cdp, baseUrl, activityPath, label);
    await runTouchMatrix(cdp, baseUrl, activityPath, label);
    await runLifecycleMatrix(cdp, baseUrl, activityPath, label);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function main() {
  sourceParity();
  const browser = findBrowser();
  if (!browser) throw new Error("Chrome/Chromium is required for free-fall trusted-touch regression.");
  const tempRoot = fs.realpathSync(os.tmpdir());
  let chrome, cdp, profileDirectory, packageDirectory, failure;
  try {
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, "simlab-position-time-chrome-"));
    validateOwnedProfile(profileDirectory, tempRoot);
    const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-component-update", "--disable-sync", "about:blank"];
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    const port = await withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome startup");
    const { response, body } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Could not create Chrome target (${response.status}).`);
    cdp = new CdpClient(body.webSocketDebuggerUrl);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    await runArtifact(cdp, root, `/sim/${slug}/index.html`, "development source");
    const extracted = buildAndExtractPackage(tempRoot, { slug });
    packageDirectory = extracted.packageDirectory;
    await runArtifact(cdp, packageDirectory, extracted.activityPath, "extracted SCORM");
  } catch (error) { failure = error; }
  try {
    await cleanupResources({ chrome, cdp, server: null, profileDirectory, packageDirectory, tempRoot });
  } catch (error) {
    failure = new AggregateError(failure ? [failure, error] : [error], "free-fall browser cleanup failed");
  }
  if (failure) throw failure;
  console.log("Free-fall source and extracted-package responsive/trusted-touch regression passed");
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { sourceParity };
