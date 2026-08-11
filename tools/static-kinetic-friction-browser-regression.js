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
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((x) => /\.(?:js|css)(?:[?#]|$)/.test(x) && x !== "../config.js").map((x) => { const clean = x.split(/[?#]/)[0]; return clean.startsWith("../") ? clean.slice(3) : `${slug}/${clean}`; }).sort();
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
  await touchStartMove(cdp, start, end);
  await touchEnd(cdp);
}
async function touchStartMove(cdp, start, end) {
  const id = 17;
  const point = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(start)] });
  for (let index = 1; index <= 8; index += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point({ x: start.x + (end.x - start.x) * index / 8, y: start.y + (end.y - start.y) * index / 8 })] });
    await delay(8);
  }
}
async function touchStartMoveGradual(cdp, start, end, steps = 36, stepDelayMs = 35) {
  const id = 17;
  const point = ({ x, y }) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(start)] });
  for (let index = 1; index <= steps; index += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point({ x: start.x + (end.x - start.x) * index / steps, y: start.y + (end.y - start.y) * index / steps })] });
    await delay(stepDelayMs);
  }
}
async function touchEnd(cdp) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function tap(cdp, point) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, id: 18, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(40);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // Allow the trusted mobile click synthesis and the following render to
  // settle before reading validation or phase state under a busy test run.
  await delay(220);
}
async function tapSelector(cdp, selector) {
  await evaluate(cdp, `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) throw new Error(${JSON.stringify(`missing selector: ${selector}`)}); node.scrollIntoView({ block: 'center', inline: 'center' }); return true; })()`);
  // Let the compositor apply the independently scrolling panel position and
  // finish any preceding trusted drag before deriving viewport coordinates.
  // Reading the rect in the same task as scrollIntoView can leave Linux
  // headless Chrome tapping the button's pre-scroll position.
  await delay(180);
  const point = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify(`missing selector: ${selector}`)});
    const r = node.getBoundingClientRect();
    const point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    if (!hit || (hit !== node && !node.contains(hit))) throw new Error(${JSON.stringify(`selector is not hit-testable after scrolling: ${selector}`)});
    return point;
  })()`);
  await tap(cdp, point);
}
async function pressKeyOn(cdp, selector, key, code = key) {
  await evaluate(cdp, `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) throw new Error(${JSON.stringify(`missing key target: ${selector}`)}); node.focus(); return true; })()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
  await delay(100);
}
function analysisFixtureScript(activeIndex = 0) {
  return `(() => {
    const G = window.StaticKineticFrictionGenerator, M = window.StaticKineticFrictionMeasurement, P = window.StaticKineticFrictionPersistence;
    const scenario = G.generateScenario({ seed: 9 });
    const samples = Array.from({ length: 301 }, (_, i) => ({ timeS: i * .1, pullCN: i < 50 ? i * 12 : 500, velocityMMps: i < 50 ? 0 : i < 90 ? 100 : i < 110 ? 100 + (i - 90) * 6 : 220 }));
    const trial = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 19 } });
    let state = P.freshState(scenario.seed);
    const opposite = scenario.balancePullDirection === 'left' ? 'right' : 'left';
    state = P.transitions.setZeroForceAnswer(state, { frictionType: 'none', direction: 'none', frictionMagnitudeCN: 0, committed: true });
    state = P.transitions.setStaticForceAnswer(state, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN, committed: true }, { frictionType: 'static', direction: opposite, frictionMagnitudeCN: scenario.balancePullCN, committed: true });
    state = P.transitions.recordBreakawayTrial(state, { direction: scenario.balancePullDirection, pullCN: Math.ceil(scenario.staticLimitMeanN * 10) * 10 });
    state = P.transitions.setBreakawayAnswer(state, Math.round(scenario.staticLimitMeanN * 100));
    state = P.transitions.setPhase(state, 'experiment'); state = P.transitions.acceptTrial(state, trial); state = P.transitions.setPhase(state, 'analysis');
    const candidates = M.findCandidateWindows(trial);
    const snapshot = { version: 1, activity: '${slug}', kind: 'draft', answer: P.encodeDraft(state) };
    window.__staticKineticFrictionApp.routeAttempt({ state: 'draft', snapshot });
    window.__frictionFixture = { scenario, trial, candidates };
    return window.__staticKineticFrictionApp.getState();
  })()`;
}
function frameSchedule(totalMs, pattern) {
  const durations = [];
  let elapsed = 0;
  let index = 0;
  while (elapsed < totalMs) {
    const duration = Math.min(pattern[index % pattern.length], totalMs - elapsed);
    durations.push(duration);
    elapsed += duration;
    index += 1;
  }
  return durations;
}
function productionExperimentScript(frameDurationsMs, options = {}) {
  const inputs = Array.from({ length: 41 }, (_, index) => ({ timeStampMs: index * 50, forceN: Number((index * .2).toFixed(2)) }));
  return `(() => {
    const app=window.__staticKineticFrictionApp,P=window.StaticKineticFrictionPersistence;
    const blank=P.freshState(12345);
    app.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(blank)}});
    document.querySelector('[data-action="navigate-phase"][data-phase="experiment"]').click();
    if (!app.regression.startExperiment(0)) throw new Error('production manual recording did not start');
    const inputs=${JSON.stringify(inputs)}, batchSize=${Number(options.batchSize || inputs.length)};
    for (let index=0; index<inputs.length; index+=batchSize) app.regression.queueExperimentForces(inputs.slice(index,index+batchSize));
    let now=0;
    app.regression.advanceExperimentFrame(now);
    for (const duration of ${JSON.stringify(frameDurationsMs)}) { now+=duration; app.regression.advanceExperimentFrame(now); }
    if (${options.finalize === false ? "false" : "true"} && app.interactionEvidence().recorderRunning) app.regression.finalizeExperiment(${options.timedOut ? "true" : "false"});
    const state=app.getState(), evidence=app.interactionEvidence();
    return { trial:state.trial, running:evidence.recorderRunning, timedOut:evidence.experiment?.timedOut, status:document.getElementById('experimentStatus').textContent, feedback:document.getElementById('experimentFeedback').textContent, live:document.getElementById('liveRegion').textContent, stageDescription:document.getElementById('stageDescription').textContent };
  })()`;
}
async function productionExperimentRegression(cdp, url, label) {
  const schedules = [
    { name: "60 Hz", pattern: [16, 17, 17], batchSize: 41 },
    { name: "90 Hz batched", pattern: [11, 11, 11, 12], batchSize: 7 },
    { name: "120 Hz coalesced", pattern: [8, 8, 9], batchSize: 3 }
  ];
  const traces = [];
  for (const schedule of schedules) {
    await navigate(cdp, url);
    const result = await evaluate(cdp, productionExperimentScript(frameSchedule(4500, schedule.pattern), { batchSize: schedule.batchSize }));
    assert.ok(result.trial, `${label}: production ${schedule.name} path saves a valid trace`);
    assert.equal(result.running, false, `${label}: production ${schedule.name} finalizes`);
    assert.doesNotMatch(`${result.status} ${result.live} ${result.stageDescription}`, /滑動摩擦力附近/, `${label}: rendered visible, live and ARIA feedback do not identify the C3 region`);
    traces.push(result.trial);
  }
  assert.equal(JSON.stringify(traces[1]), JSON.stringify(traces[0]), `${label}: production 60/90 Hz schedules produce the same packed canonical trace`);
  assert.equal(JSON.stringify(traces[2]), JSON.stringify(traces[0]), `${label}: production 60/120 Hz and coalesced batching produce the same packed canonical trace`);

  await tapSelector(cdp, "#requestRedoExperiment");
  const pendingRedo = await evaluate(cdp, `(() => ({ dialogVisible:!document.getElementById('redoExperimentConfirm').classList.contains('is-hidden'), trial:window.__staticKineticFrictionApp.getState().trial }))()`);
  assert.equal(pendingRedo.dialogVisible, true, `${label}: redoing an accepted B trial requires confirmation`);
  assert.deepEqual(pendingRedo.trial, traces[2], `${label}: the accepted B authority remains intact before confirmation`);
  await tapSelector(cdp, "[data-action='cancel-redo-experiment']");
  assert.deepEqual(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().trial"), traces[2], `${label}: cancelling the redo preserves the accepted B authority`);
  await tapSelector(cdp, "#requestRedoExperiment");
  await tapSelector(cdp, "[data-action='confirm-redo-experiment']");
  await delay(120);
  const confirmedRedo = await evaluate(cdp, `(() => ({ trial:window.__staticKineticFrictionApp.getState().trial, running:window.__staticKineticFrictionApp.interactionEvidence().recorderRunning, dialogHidden:document.getElementById('redoExperimentConfirm').classList.contains('is-hidden') }))()`);
  assert.deepEqual(confirmedRedo, { trial: null, running: true, dialogHidden: true }, `${label}: confirming the redo atomically clears the accepted trial and starts a new recording`);

  await navigate(cdp, url);
  const validTimeout = await evaluate(cdp, productionExperimentScript(frameSchedule(30000, [40]), { batchSize: 5, finalize: false }));
  assert.ok(validTimeout.trial, `${label}: a valid trial auto-saves at the 30 second boundary`);
  assert.equal(validTimeout.timedOut, true, `${label}: valid automatic stop records the timeout boundary`);
  assert.match(validTimeout.status, /自動停止並保存/, `${label}: valid automatic stop reports saved data`);
  assert.doesNotMatch(validTimeout.feedback, /超時.*重新開始/, `${label}: valid automatic stop never contradicts its saved status`);

  await navigate(cdp, url);
  const invalidTimeout = await evaluate(cdp, `(() => {
    const app=window.__staticKineticFrictionApp; app.routeAttempt({state:'new'});
    document.querySelector('[data-action="navigate-phase"][data-phase="experiment"]').click();
    app.regression.startExperiment(0); app.regression.advanceExperimentFrame(0);
    let now=0; for (const duration of ${JSON.stringify(frameSchedule(30000, [40]))}) { now+=duration; app.regression.advanceExperimentFrame(now); }
    const state=app.getState(),evidence=app.interactionEvidence(); return {trial:state.trial,running:evidence.recorderRunning,timedOut:evidence.experiment?.timedOut,status:document.getElementById('experimentStatus').textContent};
  })()`);
  assert.equal(invalidTimeout.trial, null, `${label}: an invalid trial is rejected at the 30 second boundary`);
  assert.equal(invalidTimeout.running, false, `${label}: invalid automatic stop ends recording`);
  assert.equal(invalidTimeout.timedOut, true, `${label}: invalid automatic stop records the timeout boundary`);
  assert.match(invalidTimeout.status, /30 秒記錄已結束.*重新開始/, `${label}: invalid automatic stop uses neutral retry guidance`);

  await navigate(cdp, url);
  const emptyStop = await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp; app.routeAttempt({state:'new'}); document.querySelector('[data-action="navigate-phase"][data-phase="experiment"]').click(); app.regression.startExperiment(0); const accepted=app.regression.finalizeExperiment(false); const canRestart=app.regression.startExperiment(10); return {accepted,canRestart,state:app.getState(),evidence:app.interactionEvidence(),status:document.getElementById('experimentStatus').textContent}; })()`);
  assert.equal(emptyStop.accepted, false, `${label}: stopping before the first sample is rejected without throwing`);
  assert.equal(emptyStop.canRestart, true, `${label}: an empty stop never wedges the next recording`);

  await navigate(cdp, url);
  const delayedFirstFrame = await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp; app.routeAttempt({state:'new'}); document.querySelector('[data-action="navigate-phase"][data-phase="experiment"]').click(); app.regression.startExperiment(0); const result=app.regression.advanceExperimentFrame(120); return {result,running:app.interactionEvidence().recorderRunning,status:document.getElementById('experimentStatus').textContent}; })()`);
  assert.equal(delayedFirstFrame.result.abortedOnStall, false, `${label}: a delayed first recording frame only establishes the clock`);
  assert.equal(delayedFirstFrame.running, true, `${label}: confirmation/render delay cannot stop a newly started recorder`);

  const baselineAlignedTraces = await evaluate(cdp, `(() => {
    const app=window.__staticKineticFrictionApp,P=window.StaticKineticFrictionPersistence;
    const relativeInputs=${JSON.stringify(Array.from({ length: 41 }, (_, index) => ({ timeStampMs: index * 50, forceN: Number((index * .2).toFixed(2)) })))};
    const durations=${JSON.stringify(frameSchedule(4500, [16, 17, 17]))};
    const run=(firstFrameMs)=>{
      const blank=P.freshState(12345);
      app.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(blank)}});
      document.querySelector('[data-action="navigate-phase"][data-phase="experiment"]').click();
      app.regression.startExperiment(0);
      app.regression.advanceExperimentFrame(firstFrameMs);
      app.regression.queueExperimentForces(relativeInputs.map(input=>({forceN:input.forceN,timeStampMs:firstFrameMs+input.timeStampMs})));
      let now=firstFrameMs;
      for(const duration of durations){now+=duration;app.regression.advanceExperimentFrame(now);}
      if(app.interactionEvidence().recorderRunning)app.regression.finalizeExperiment(false);
      return app.getState().trial;
    };
    return [run(0),run(120)];
  })()`);
  assert.ok(baselineAlignedTraces.every(Boolean), `${label}: both first-frame schedules create valid canonical trials`);
  assert.deepEqual(baselineAlignedTraces[1], baselineAlignedTraces[0], `${label}: rebased timestamped input produces the same packed trace after a 0 or 120 ms first frame`);

  await navigate(cdp, url);
  const stalled = await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp; app.routeAttempt({state:'new'}); document.querySelector('[data-action="navigate-phase"][data-phase="experiment"]').click(); app.regression.startExperiment(0); app.regression.advanceExperimentFrame(0); const result=app.regression.advanceExperimentFrame(60); return {result,state:app.getState(),evidence:app.interactionEvidence(),status:document.getElementById('experimentStatus').textContent,startDisabled:document.getElementById('startRecording').disabled}; })()`);
  assert.equal(stalled.result.abortedOnStall, true, `${label}: a production frame gap over 50 ms aborts without catch-up`);
  assert.equal(stalled.evidence.recorderRunning, false, `${label}: timing-gap abort stops the production recorder`);
  assert.equal(stalled.state.trial, null, `${label}: timing-gap abort creates no authority trace`);
  assert.equal(stalled.startDisabled, false, `${label}: timing-gap abort fully refreshes the controls`);
  assert.match(stalled.status, /技術時間間隔/, `${label}: timing-gap abort is distinguished from normal timeout`);

  await navigate(cdp, url);
  await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp; app.routeAttempt({state:'new'}); document.querySelector('[data-action="navigate-phase"][data-phase="experiment"]').click(); app.regression.startExperiment(performance.now()); return true; })()`);
  await pressKeyOn(cdp, "#experimentOrigin", "ArrowRight");
  const normalKeyForce = await evaluate(cdp, "window.__staticKineticFrictionApp.interactionEvidence().experiment.appliedForceN");
  assert.equal(normalKeyForce, .1, `${label}: one ordinary keyboard force step is exactly 0.1 N`);
  await evaluate(cdp, "document.getElementById('experimentOrigin').focus()");
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", modifiers: 8 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", modifiers: 8 });
  const shiftedKeyForce = await evaluate(cdp, "window.__staticKineticFrictionApp.interactionEvidence().experiment.appliedForceN");
  assert.equal(shiftedKeyForce, .6, `${label}: one Shift keyboard force step is exactly 0.5 N`);
}
async function semanticSmoke(cdp, url, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, url);
  const delayedFeedback = await evaluate(cdp, `(() => ({coach:document.getElementById('stageCoachText').textContent,balance:document.getElementById('balanceStatus').textContent,description:document.getElementById('stageDescription').textContent,live:document.getElementById('liveRegion').textContent}))()`);
  assert.doesNotMatch(Object.values(delayedFeedback).join(" "), /摩擦力大小和方向都應為零|滑動摩擦力附近/, `${label}: rendered startup visible, live and ARIA copy does not reveal A1 or C3 answers`);
  const blankA1 = await evaluate(cdp, `(() => { const type=document.getElementById('zeroFrictionType'),direction=document.getElementById('zeroFrictionDirection'),magnitude=document.getElementById('zeroFrictionMagnitude'); type.value='none'; direction.value='none'; magnitude.value='0'; window.__staticKineticFrictionApp.routeAttempt({state:'new'}); return {type:type.value,direction:direction.value,typeLabel:type.selectedOptions[0]?.textContent,directionLabel:direction.selectedOptions[0]?.textContent,magnitude:magnitude.value}; })()`);
  assert.deepEqual(blankA1, { type: "", direction: "", typeLabel: "請選擇", directionLabel: "請選擇", magnitude: "" }, `${label}: A1 starts blank and requires three explicit fields`);
  await tapSelector(cdp, "[data-action='save-zero-force']");
  const blankA1Validation = await evaluate(cdp, `(() => ({ localVisible:!document.getElementById('zeroValidationStatus').classList.contains('is-hidden'), globalVisible:!document.getElementById('validationStatus').classList.contains('is-hidden'), text:document.getElementById('zeroValidationStatus').textContent, focused:document.activeElement===document.getElementById('zeroValidationStatus') }))()`);
  assert.deepEqual(blankA1Validation, { localVisible: true, globalVisible: false, text: "請先選擇 A1 的摩擦力類型、方向及大小。", focused: true }, `${label}: blank A1 validation stays beside its save button`);
  await evaluate(cdp, `(() => { const type=document.getElementById('zeroFrictionType'); type.value='none'; type.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  await tapSelector(cdp, "[data-action='save-zero-force']");
  assert.equal(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.zeroForce"), null, `${label}: choosing only 'no friction' cannot auto-fill A1 direction or magnitude`);
  const inconsistentA1Visual = await evaluate(cdp, `(() => { const direction=document.getElementById('zeroFrictionDirection'),magnitude=document.getElementById('zeroFrictionMagnitude'); direction.value='right'; direction.dispatchEvent(new Event('change',{bubbles:true})); magnitude.value='1'; magnitude.dispatchEvent(new Event('input',{bubbles:true})); const arrow=document.querySelector('#apparatusSvg .learner-friction-arrow'),label=[...document.querySelectorAll('#apparatusSvg .force-builder-label')].find(node=>/摩擦力/.test(node.textContent)); return {x1:Number(arrow?.getAttribute('x1')),x2:Number(arrow?.getAttribute('x2')),label:label?.textContent}; })()`);
  assert.ok(inconsistentA1Visual.x2 > inconsistentA1Visual.x1 && inconsistentA1Visual.label === "摩擦力 1.0 N", `${label}: A1 stage faithfully draws the selected direction and magnitude even when the selected type is no friction ${JSON.stringify(inconsistentA1Visual)}`);
  await tapSelector(cdp, "[data-action='save-zero-force']");
  const completeWrongA1 = await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp,S=window.StaticKineticFrictionScoring;const state=app.getState();return {answer:state.balance.zeroForce,points:S.balanceScore(state,app.getScenario()).detail.find(item=>item.key==='zero-force').points,validationHidden:document.getElementById('zeroValidationStatus').classList.contains('is-hidden')}; })()`);
  assert.deepEqual(completeWrongA1, { answer: { frictionType: "none", direction: "right", frictionMagnitudeCN: 100, committed: true }, points: 1, validationHidden: true }, `${label}: complete but physically inconsistent A1 answers save and receive component credit`);
  await evaluate(cdp, "window.__staticKineticFrictionApp.routeAttempt({state:'new'})");
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='predict']");
  const blankDPredict = await evaluate(cdp, "(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, buttonDisabled:document.querySelector('[data-action=to-review]').disabled }))()");
  assert.deepEqual(blankDPredict, { phase: "predict", buttonDisabled: false }, `${label}: Part D lower review button is enabled even when every D answer is blank`);
  await tapSelector(cdp, "[data-action='to-review']");
  const blankDReview = await evaluate(cdp, "(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, predictHidden:document.getElementById('predictPanel').classList.contains('is-hidden'), reviewVisible:!document.getElementById('reviewPanel').classList.contains('is-hidden'), submitDisabled:document.getElementById('submit').disabled, validation:document.getElementById('validationStatus').textContent }))()");
  assert.equal(blankDReview.phase, "review", `${label}: blank Part D lower button reaches the submission review`);
  assert.equal(blankDReview.predictHidden, true, `${label}: blank Part D lower button hides D after routing to review`);
  assert.equal(blankDReview.reviewVisible, true, `${label}: blank Part D lower button shows the review panel`);
  assert.equal(blankDReview.submitDisabled, false, `${label}: blank Part D review keeps submit enabled`);
  assert.equal(blankDReview.validation, "", `${label}: blank Part D lower routing does not show a false validation warning`);
  await evaluate(cdp, "window.__staticKineticFrictionApp.routeAttempt({state:'new'})");
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='experiment']");
  const blankB = await evaluate(cdp, "(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, buttonDisabled:document.querySelector('[data-action=to-analysis]').disabled }))()");
  assert.deepEqual(blankB, { phase: "experiment", buttonDisabled: false }, `${label}: Part B lower Part C button remains available before a recording`);
  await tapSelector(cdp, "[data-action='to-analysis']");
  const blankC = await evaluate(cdp, "(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, analysisVisible:!document.getElementById('analysisPanel').classList.contains('is-hidden'), text:document.getElementById('analysisTasks').textContent }))()");
  assert.equal(blankC.phase, "analysis", `${label}: blank Part B lower button reaches Part C`);
  assert.equal(blankC.analysisVisible, true, `${label}: blank Part B lower button shows Part C`);
  assert.match(blankC.text, /沒有可分析的實驗記錄/, `${label}: blank Part C explains its missing B trace without blocking navigation`);
  const blankCPredictButton = await evaluate(cdp, "(() => ({ disabled:document.getElementById('to-predict').disabled, validation:document.getElementById('validationStatus').textContent }))()");
  assert.deepEqual(blankCPredictButton, { disabled: false, validation: "" }, `${label}: blank Part C keeps the lower Part D navigation available without validation`);
  await tapSelector(cdp, "#to-predict");
  const blankDPredictFromC = await evaluate(cdp, "(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, predictVisible:!document.getElementById('predictPanel').classList.contains('is-hidden'), validation:document.getElementById('validationStatus').textContent }))()");
  assert.deepEqual(blankDPredictFromC, { phase: "predict", predictVisible: true, validation: "" }, `${label}: blank Part C lower Part D button navigates like the upper phase menu`);
  await evaluate(cdp, "window.__staticKineticFrictionApp.routeAttempt({state:'new'})");
  await evaluate(cdp, `(() => { const set=(id,value,eventName='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event(eventName,{bubbles:true}))}; set('zeroFrictionType','none');set('zeroFrictionDirection','none');set('zeroFrictionMagnitude','0','input');return true; })()`);
  await tapSelector(cdp, "[data-action='save-zero-force']");
  const a1 = await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.zeroForce");
  assert.deepEqual(a1, { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, committed: true }, `${label}: A1 stores explicit zero friction`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='experiment']");
  const earlyExperiment = await evaluate(cdp, "({ phase:window.__staticKineticFrictionApp.getState().phase, startDisabled:document.getElementById('startRecording').disabled })");
  assert.deepEqual(earlyExperiment, { phase: "experiment", startDisabled: false }, `${label}: Part B is directly selectable before Part A is complete`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='balance']");
  await evaluate(cdp, `(() => { const set=(id,value,eventName='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event(eventName,{bubbles:true}))}; set('zeroFrictionType','static');set('zeroFrictionDirection','right');set('zeroFrictionMagnitude','0.1','input');document.querySelector('[data-action="save-zero-force"]').click();return true; })()`);
  const resetByA1 = await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.staticCase");
  assert.equal(resetByA1, null, `${label}: changing a saved A1 answer clears the dependent A2 answer`);
  await evaluate(cdp, `(() => { const set=(id,value,eventName='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event(eventName,{bubbles:true}))}; set('zeroFrictionType','none');set('zeroFrictionDirection','none');set('zeroFrictionMagnitude','0','input');document.querySelector('[data-action="save-zero-force"]').click();return true; })()`);
  const staticSetup = await evaluate(cdp, `(() => { const scenario=window.StaticKineticFrictionGenerator.generateScenario({seed:window.__staticKineticFrictionApp.getState().seed}); return {direction:scenario.balancePullDirection,magnitudeCN:scenario.balancePullCN,opposite:scenario.balancePullDirection==='left'?'right':'left'}; })()`);
  await evaluate(cdp, "(() => { const button=document.getElementById('save-static-force'); button.focus(); button.click(); return true; })()");
  await delay(100);
  const blankA2Validation = await evaluate(cdp, `(() => ({ localVisible:!document.getElementById('staticValidationStatus').classList.contains('is-hidden'), globalVisible:!document.getElementById('validationStatus').classList.contains('is-hidden'), text:document.getElementById('staticValidationStatus').textContent, focused:document.activeElement===document.getElementById('staticValidationStatus') }))()`);
  assert.deepEqual(blankA2Validation, { localVisible: true, globalVisible: false, text: "請先由物體中央畫出 A2 拉力；摩擦力可以畫出，亦可以不畫。", focused: true }, `${label}: blank A2 validation stays beside its save button`);
  const forceEndpoint = async (magnitudeN, direction) => evaluate(cdp, `(() => { const node=document.getElementById('balanceOrigin'),svg=document.getElementById('apparatusSvg'); const r=node.getBoundingClientRect(),svgRect=svg.getBoundingClientRect(),s=Math.min(svgRect.width/900,svgRect.height/430); return { start:{x:r.left+r.width/2,y:r.top+r.height/2}, end:{x:r.left+r.width/2+${direction === "left" ? -1 : 1}*${magnitudeN}*18*s,y:r.top+r.height/2} }; })()`);
  await tapSelector(cdp, "#draw-applied");
  let drag = await forceEndpoint(staticSetup.magnitudeCN / 100, staticSetup.direction); await touch(cdp, drag.start, drag.end);
  await tapSelector(cdp, "#draw-friction");
  drag = await forceEndpoint(staticSetup.magnitudeCN / 100, staticSetup.opposite); await touch(cdp, drag.start, drag.end);
  const drawnBalance = await evaluate(cdp, `(() => { const block=document.querySelector('.apparatus-block'),centerY=Number(block.getAttribute('y'))+Number(block.getAttribute('height'))/2,arrows=[...document.querySelectorAll('.pull-arrow,.learner-friction-arrow')],labels=[...document.querySelectorAll('.force-builder-label')].map((node)=>({text:node.textContent,y:Number(node.getAttribute('y'))})); return { arrows:arrows.length,centerY,starts:arrows.map((node)=>Number(node.getAttribute('y1'))),labels }; })()`);
  const labelYs = drawnBalance.labels.map((label) => label.y);
  assert.ok(drawnBalance.arrows >= 2 && drawnBalance.starts.every((y) => Math.abs(y - drawnBalance.centerY) < .1) && drawnBalance.labels.some((label) => /^拉力 /.test(label.text)) && drawnBalance.labels.some((label) => /^摩擦力 /.test(label.text)) && Math.max(...labelYs) - Math.min(...labelYs) >= 10, `${label}: Part A force arrows start at the block centre and use separated pull/friction labels ${JSON.stringify(drawnBalance)}`);
  await tapSelector(cdp, "[data-action='save-static-force']");
  let balance = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(); return { staticCase:state.balance.staticCase, arrows:document.querySelectorAll('.pull-arrow,.learner-friction-arrow').length, experimentOriginHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'), phase:state.phase }; })()`);
  const breakawayControls = await evaluate(cdp, `([...document.querySelectorAll('#breakawayTask [data-action]')].map((node)=>node.dataset.action))`);
  assert.equal(breakawayControls.includes('pull-left') || breakawayControls.includes('pull-right') || breakawayControls.includes('reset-breakaway'), false, `${label}: A3 has no direction or reset buttons`);
  assert.equal(balance.staticCase.learnerAppliedForce.direction, staticSetup.direction, `${label}: A2 stores the direction of the directly drawn applied force`);
  assert.equal(balance.staticCase.learnerAppliedForce.magnitudeCN, staticSetup.magnitudeCN, `${label}: A2 stores the directly drawn applied force magnitude`);
  assert.equal(balance.staticCase.learnerForce.direction, staticSetup.opposite, `${label}: A2 friction direction is opposite the drawn applied force`);
  await tapSelector(cdp, "[data-action='save-breakaway-answer']");
  const blankA3Validation = await evaluate(cdp, `(() => ({ localVisible:!document.getElementById('breakawayValidationStatus').classList.contains('is-hidden'), globalVisible:!document.getElementById('validationStatus').classList.contains('is-hidden'), text:document.getElementById('breakawayValidationStatus').textContent, focused:document.activeElement===document.getElementById('breakawayValidationStatus') }))()`);
  assert.deepEqual(blankA3Validation, { localVisible: true, globalVisible: false, text: "請先完成試拉，然後填寫最大靜摩擦力估計。", focused: true }, `${label}: blank A3 validation stays beside its save button`);
  await tapSelector(cdp, "#draw-applied");
  drag = await forceEndpoint(staticSetup.magnitudeCN / 100 + .2, staticSetup.direction); await touch(cdp, drag.start, drag.end);
  await tapSelector(cdp, "[data-action='save-static-force']");
  const a2Edited = await evaluate(cdp, "window.__staticKineticFrictionApp.getState()");
  assert.equal(a2Edited.balance.breakaway.bestPullCN, null, `${label}: A2 remains editable before an A3 trial has been recorded`);
  assert.equal(a2Edited.balance.staticCase.learnerAppliedForce.magnitudeCN, staticSetup.magnitudeCN + 20, `${label}: A2 can be updated after its first save`);
  await tapSelector(cdp, "#draw-friction");
  await tapSelector(cdp, "#clear-friction");
  await tapSelector(cdp, "[data-action='save-static-force']");
  const noFriction = await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.staticCase.learnerForce");
  assert.deepEqual(noFriction, { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, committed: true }, `${label}: clearing the optional A2 arrow commits no friction explicitly`);
  await tapSelector(cdp, "#draw-applied");
  drag = await forceEndpoint(staticSetup.magnitudeCN / 100, staticSetup.direction); await touch(cdp, drag.start, drag.end);
  await tapSelector(cdp, "#draw-friction");
  drag = await forceEndpoint(staticSetup.magnitudeCN / 100, staticSetup.opposite); await touch(cdp, drag.start, drag.end);
  await tapSelector(cdp, "[data-action='save-static-force']");
  const threshold = await evaluate(cdp, "Math.ceil(window.StaticKineticFrictionGenerator.generateScenario({seed:window.__staticKineticFrictionApp.getState().seed}).staticLimitMeanN * 10) * 10");
  let blockBefore = await evaluate(cdp, "document.querySelector('.apparatus-block')?.getAttribute('x')");
  for (let n = 20; n < threshold; n += 20) { drag = await forceEndpoint(n / 100, staticSetup.direction); await touch(cdp, drag.start, drag.end); }
  drag = await forceEndpoint(threshold / 100 + .2, staticSetup.direction);
  await touchStartMove(cdp, drag.start, drag.end);
  await delay(120);
  const motion = await evaluate(cdp, `(() => { const line=document.querySelector('.pull-arrow'),svg=document.getElementById('apparatusSvg'); let end=null; if(line){const point=svg.createSVGPoint();point.x=Number(line.getAttribute('x2'));point.y=Number(line.getAttribute('y2'));const screen=point.matrixTransform(svg.getScreenCTM());end={x:screen.x,y:screen.y};} return {pull:document.getElementById('breakawayPullValue').textContent,status:document.getElementById('breakawayMotionStatus').textContent,friction:document.querySelectorAll('.learner-friction-arrow').length,arrow:document.querySelectorAll('.pull-arrow').length,block:document.querySelector('.apparatus-block')?.getAttribute('x'),motion:window.__staticKineticFrictionApp.interactionEvidence().balanceMotion,arrowEnd:end}; })()`);
  const breakaway = await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.breakaway");
  assert.ok(breakaway.bestPullCN >= threshold && breakaway.attempts >= 1, `${label}: A3 records a breakaway trial after gradual force increase`);
  assert.equal(motion.friction, 0, `${label}: A3 does not display static friction`);
  const initialSign = staticSetup.direction === "left" ? -1 : 1;
  assert.ok(motion.arrow >= 1 && motion.block !== blockBefore && motion.motion?.velocityMps * initialSign > 0 && motion.arrowEnd && Math.abs(motion.arrowEnd.x - drag.end.x) < 8, `${label}: A3 pull arrow follows the trusted pointer while the block moves ${JSON.stringify({ ...motion, expectedX: drag.end.x, deltaX: motion.arrowEnd ? motion.arrowEnd.x - drag.end.x : null, direction: staticSetup.direction, initialSign })}`);
  await touchEnd(cdp);
  await delay(120);
  const released = await evaluate(cdp, `(() => ({pull:document.getElementById('breakawayPullValue').textContent,arrow:document.querySelectorAll('.pull-arrow').length,status:document.getElementById('breakawayMotionStatus').textContent,block:document.querySelector('.apparatus-block')?.getAttribute('x'),motion:window.__staticKineticFrictionApp.interactionEvidence().balanceMotion}))()`);
  assert.deepEqual(released.pull, "0.0 N", `${label}: pointerup releases the A3 pull`);
  assert.equal(released.arrow, 0, `${label}: A3 hides the released pull arrow`);
  assert.ok(released.motion && Math.abs(released.motion.appliedForceN) < 1e-8 && released.block !== blockBefore && /靜止|減速|勻速/.test(released.status), `${label}: the block keeps its continuous post-release motion ${JSON.stringify(released)}`);
  const reverseDrag = await forceEndpoint(threshold / 100 + .5, staticSetup.opposite);
  await touchStartMove(cdp, reverseDrag.start, reverseDrag.end);
  await delay(360);
  const reverseMotion = await evaluate(cdp, `(() => { const block=document.querySelector('.apparatus-block'); return {x:block?.getAttribute('x'),status:document.getElementById('breakawayMotionStatus').textContent,motion:window.__staticKineticFrictionApp.interactionEvidence().balanceMotion}; })()`);
  const reverseSign = staticSetup.opposite === "left" ? -1 : 1;
  assert.ok(reverseMotion.motion && reverseMotion.motion.velocityMps * reverseSign > 0, `${label}: A3 accepts a live opposite-direction pull and reverses the block ${JSON.stringify(reverseMotion)}`);
  await touchEnd(cdp);
  await delay(1400);
  for (const direction of [staticSetup.direction, staticSetup.opposite]) {
    drag = await forceEndpoint(threshold / 100 + .2, direction); await touch(cdp, drag.start, drag.end); await delay(900);
  }
  const repeatedTrials = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),target=document.getElementById('balanceOrigin'); return { attempts:state.balance.breakaway.attempts, bestPullCN:state.balance.breakaway.bestPullCN, targetHidden:target.classList.contains('is-hidden'), pull:document.getElementById('breakawayPullValue').textContent, motion:document.getElementById('breakawayMotionStatus').textContent }; })()`);
  assert.ok(repeatedTrials.attempts >= 3, `${label}: A3 can repeat breakaway trials after reversing direction ${JSON.stringify(repeatedTrials)}`);
  assert.ok(repeatedTrials.bestPullCN >= threshold, `${label}: repeated A3 trials preserve the measured threshold range`);
  assert.equal(repeatedTrials.targetHidden, false, `${label}: A3 keeps the drawing target available before the estimate is saved`);
  const offscreenDrag = await forceEndpoint(12, staticSetup.direction);
  await touchStartMove(cdp, offscreenDrag.start, { x: offscreenDrag.start.x + (staticSetup.direction === "left" ? -1200 : 1200), y: offscreenDrag.start.y });
  await delay(1200);
  const offscreen = await evaluate(cdp, `(() => ({motion:window.__staticKineticFrictionApp.interactionEvidence().balanceMotion,buttonHidden:document.getElementById('resetBalanceObject').classList.contains('is-hidden'),targetHidden:document.getElementById('balanceOrigin').classList.contains('is-hidden')}))()`);
  assert.equal(offscreen.motion?.offscreen, true, `${label}: A3 exposes the return button when continuous motion leaves the stage ${JSON.stringify(offscreen)}`);
  assert.equal(offscreen.buttonHidden, false, `${label}: A3 return button is visible offscreen`);
  await touchEnd(cdp);
  await tapSelector(cdp, "[data-action='reset-balance-object']");
  const resetObject = await evaluate(cdp, `(() => { const motion=window.__staticKineticFrictionApp.interactionEvidence().balanceMotion; return {motion,buttonHidden:document.getElementById('resetBalanceObject').classList.contains('is-hidden'),targetHidden:document.getElementById('balanceOrigin').classList.contains('is-hidden')}; })()`);
  assert.ok(resetObject.motion && Math.abs(resetObject.motion.positionM - .72) < 1e-9 && resetObject.motion.velocityMps === 0 && resetObject.motion.appliedForceN === 0, `${label}: A3 return button recenters and stops the object without clearing trials ${JSON.stringify(resetObject)}`);
  assert.equal(resetObject.buttonHidden, true, `${label}: A3 hides the return button after reset`);
  assert.equal(resetObject.targetHidden, false, `${label}: A3 restores the central drag target after reset`);
  await evaluate(cdp, "document.getElementById('breakawayAnswer').value=(window.StaticKineticFrictionGenerator.generateScenario({seed:window.__staticKineticFrictionApp.getState().seed}).staticLimitMeanN).toFixed(1)");
  await tapSelector(cdp, "[data-action='save-breakaway-answer']");
  assert.equal(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().variant"), "answer-complete", `${label}: all three Part A tasks complete`);
  assert.equal(await evaluate(cdp, "document.getElementById('balanceOrigin').classList.contains('is-hidden')"), false, `${label}: A3 remains editable after the estimate is saved`);
  await tapSelector(cdp, "#to-experiment");
  assert.equal(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().phase"), "experiment", `${label}: sequential Part A continues legally`);
  const readyExperiment = await evaluate(cdp, "(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, trial:window.__staticKineticFrictionApp.getState().trial, startDisabled:document.getElementById('startRecording').disabled, redoDisabled:document.getElementById('requestRedoExperiment').disabled, originPresent:Boolean(document.getElementById('experimentOrigin')), originHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'), sliderPresent:Boolean(document.getElementById('experimentForceSlider')), confirmPresent:Boolean(document.getElementById('redoExperimentConfirm')), confirmHidden:document.getElementById('redoExperimentConfirm').classList.contains('is-hidden') }))()");
  assert.deepEqual(readyExperiment, { phase: "experiment", trial: null, startDisabled: false, redoDisabled: false, originPresent: true, originHidden: true, sliderPresent: false, confirmPresent: true, confirmHidden: true }, `${label}: B exposes direct stage dragging and keeps the saved-trial confirmation hidden before recording`);
  await tapSelector(cdp, "#requestRedoExperiment");
  const restartedBeforeDrag = await evaluate(cdp, "(() => { const evidence=window.__staticKineticFrictionApp.interactionEvidence(); return { phase:window.__staticKineticFrictionApp.getState().phase, trial:window.__staticKineticFrictionApp.getState().trial, running:evidence.recorderRunning, time:evidence.experiment?.timeS, position:evidence.experiment?.positionM, originHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'), confirmHidden:document.getElementById('redoExperimentConfirm').classList.contains('is-hidden') }; })()");
  assert.equal(restartedBeforeDrag.running, true, `${label}: pressing restart immediately starts a fresh 30-second recording`);
  assert.ok(restartedBeforeDrag.time < .35 && Math.abs(restartedBeforeDrag.position) < 1e-9, `${label}: immediate restart resets time and position ${JSON.stringify(restartedBeforeDrag)}`);
  assert.equal(restartedBeforeDrag.trial, null, `${label}: immediate restart clears the old B trial`);
  assert.equal(restartedBeforeDrag.originHidden, false, `${label}: immediate restart exposes the stage drag target`);
  assert.equal(restartedBeforeDrag.confirmHidden, true, `${label}: an unsaved restart does not display the saved-trial confirmation`);
  const bRegions = await evaluate(cdp, `(() => { const pick=(r)=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}); const apparatus=pick(document.getElementById('apparatusSvg').getBoundingClientRect()),graphRegion=pick(document.getElementById('experimentGraphStage').getBoundingClientRect()),graph=pick(document.getElementById('experimentGraphSvg').getBoundingClientRect()); return {apparatus,graphRegion,graph,graphCentered:Math.abs((graph.left+graph.width/2)-(graphRegion.left+graphRegion.width/2))<1 && Math.abs((graph.top+graph.height/2)-(graphRegion.top+graphRegion.height/2))<1}; })()`);
  assert.ok(bRegions.apparatus.height > 0 && bRegions.graphRegion.height > 0, `${label}: B has non-empty upper apparatus and lower graph regions`);
  assert.ok(bRegions.graphRegion.top >= bRegions.apparatus.bottom - 1, `${label}: B graph region sits below the upper apparatus region`);
  assert.equal(bRegions.graphCentered, true, `${label}: B graph SVG is centered within its lower region ${JSON.stringify(bRegions)}`);
  const experimentInitial = await evaluate(cdp, "window.__staticKineticFrictionApp.interactionEvidence().experiment");
  assert.ok(experimentInitial && Math.abs(experimentInitial.positionM) < 1e-9, `${label}: B starts the object at the left edge of the track ${JSON.stringify(experimentInitial)}`);
  const experimentTarget = await evaluate(cdp, `(() => { const node=document.getElementById('experimentOrigin'),svg=document.getElementById('apparatusSvg'); node.scrollIntoView({block:'center',inline:'center'}); const r=node.getBoundingClientRect(),sr=svg.getBoundingClientRect(),viewHeight=svg.viewBox.baseVal.height||430,scale=Math.min(sr.width/900,sr.height/viewHeight); return {x:r.left+r.width/2,y:r.top+r.height/2,hidden:node.classList.contains('is-hidden'),width:r.width,height:r.height,forcePxPerN:30*scale}; })()`);
  assert.equal(experimentTarget.hidden, false, `${label}: B exposes the direct-pull target only while recording`);
  assert.ok(experimentTarget.width >= 44 && experimentTarget.height >= 44, `${label}: B direct-pull target has a usable touch target`);
  await touchStartMoveGradual(cdp, experimentTarget, { x: experimentTarget.x + experimentTarget.forcePxPerN * 11, y: experimentTarget.y }, 36, 35);
  let preBreakPeakForce = 0;
  let breakawayPeakForce = 0;
  let experimentHeld = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await delay(100);
    const snapshot = await evaluate(cdp, `(() => { const evidence=window.__staticKineticFrictionApp.interactionEvidence(),line=document.querySelector('#apparatusSvg .pull-arrow'),graph=document.getElementById('experimentGraphSvg'); return {running:evidence.recorderRunning,force:evidence.experiment?.appliedForceN,measuredForce:evidence.experiment?.measuredForceN,breakawayForce:evidence.experiment?.breakawayForceN,velocityMps:evidence.experiment?.velocityMps,time:evidence.experiment?.timeS,autoKineticHold:evidence.experiment?.autoKineticHold,graphLines:document.querySelectorAll('.experiment-force-line').length,velocityLines:document.querySelectorAll('.velocity-line').length,graphText:graph?.textContent || '',graphRegion:!document.getElementById('experimentGraphStage').classList.contains('is-hidden'),graphAxisArrows:graph?.querySelectorAll('.graph-axis[marker-start],.graph-axis[marker-end]').length || 0,graphYAxisUp:[...(graph?.querySelectorAll('.graph-axis[marker-end]') || [])].some(axis=>Number(axis.getAttribute('x1'))===Number(axis.getAttribute('x2'))&&Number(axis.getAttribute('y1'))>Number(axis.getAttribute('y2'))),feedback:document.getElementById('experimentFeedback').textContent,originHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'),arrow:document.querySelectorAll('#apparatusSvg .pull-arrow').length,arrowStart:line?Number(line.getAttribute('x1')):null,arrowEnd:line?Number(line.getAttribute('x2')):null,liveReadout:document.querySelector('.live-readouts'),slider:document.getElementById('experimentForceSlider')}; })()`);
    if (!snapshot.autoKineticHold) preBreakPeakForce = Math.max(preBreakPeakForce, snapshot.measuredForce || 0);
    breakawayPeakForce = Math.max(breakawayPeakForce, snapshot.breakawayForce || 0);
    experimentHeld = snapshot;
    if (snapshot.autoKineticHold) break;
  }
  if (experimentHeld?.autoKineticHold) {
    await delay(350);
    experimentHeld = await evaluate(cdp, `(() => { const evidence=window.__staticKineticFrictionApp.interactionEvidence(),line=document.querySelector('#apparatusSvg .pull-arrow'),graph=document.getElementById('experimentGraphSvg'); return {running:evidence.recorderRunning,force:evidence.experiment?.appliedForceN,measuredForce:evidence.experiment?.measuredForceN,breakawayForce:evidence.experiment?.breakawayForceN,velocityMps:evidence.experiment?.velocityMps,time:evidence.experiment?.timeS,autoKineticHold:evidence.experiment?.autoKineticHold,graphLines:document.querySelectorAll('.experiment-force-line').length,velocityLines:document.querySelectorAll('.velocity-line').length,graphText:graph?.textContent || '',graphRegion:!document.getElementById('experimentGraphStage').classList.contains('is-hidden'),graphAxisArrows:graph?.querySelectorAll('.graph-axis[marker-start],.graph-axis[marker-end]').length || 0,graphYAxisUp:[...(graph?.querySelectorAll('.graph-axis[marker-end]') || [])].some(axis=>Number(axis.getAttribute('x1'))===Number(axis.getAttribute('x2'))&&Number(axis.getAttribute('y1'))>Number(axis.getAttribute('y2'))),feedback:document.getElementById('experimentFeedback').textContent,originHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'),arrow:document.querySelectorAll('#apparatusSvg .pull-arrow').length,arrowStart:line?Number(line.getAttribute('x1')):null,arrowEnd:line?Number(line.getAttribute('x2')):null,liveReadout:document.querySelector('.live-readouts'),slider:document.getElementById('experimentForceSlider')}; })()`);
  }
  assert.equal(experimentHeld.running, true, `${label}: B recorder remains active during a direct pull ${JSON.stringify(experimentHeld)}`);
  assert.equal(experimentHeld.autoKineticHold, true, `${label}: B hands control to the automatic kinetic-friction hold after breakaway ${JSON.stringify(experimentHeld)}`);
  assert.ok(experimentHeld.force > 0 && experimentHeld.force <= 12 && experimentHeld.time > 0, `${label}: automatic hold supplies a rightward force after breakaway ${JSON.stringify(experimentHeld)}`);
  assert.ok(breakawayPeakForce > experimentHeld.measuredForce + .5, `${label}: the measured force visibly drops from the breakaway peak to the kinetic plateau ${JSON.stringify({ preBreakPeakForce, breakawayPeakForce, plateau: experimentHeld.measuredForce })}`);
  assert.ok(experimentHeld.arrowEnd > experimentHeld.arrowStart, `${label}: B renders the pull arrow only toward the right ${JSON.stringify(experimentHeld)}`);
  assert.equal(experimentHeld.originHidden, true, `${label}: B hides the learner drag target after breakaway because the system takes over`);
  assert.equal(experimentHeld.graphLines, 1, `${label}: B renders a live force-time path`);
  assert.equal(experimentHeld.velocityLines, 0, `${label}: B does not render a velocity-time path`);
  assert.equal(experimentHeld.graphRegion, true, `${label}: B renders the force-time graph in its separate lower stage region`);
  assert.equal(experimentHeld.graphAxisArrows, 2, `${label}: B force-time graph has arrowheads on both axes`);
  assert.equal(experimentHeld.graphYAxisUp, true, `${label}: B force-time graph vertical axis arrow points upward`);
  assert.match(experimentHeld.graphText, /t\s*\/\s*s/, `${label}: B graph keeps the lowercase time symbol`);
  assert.doesNotMatch(experimentHeld.graphText, /圖（0.?30 秒）/, `${label}: B graph removes the redundant top title label`);
  assert.doesNotMatch(experimentHeld.graphText, /速度|velocity/i, `${label}: B learner-facing stage contains no velocity quantity`);
  assert.match(experimentHeld.feedback, /系統正維持接近勻速/, `${label}: B tells the learner that the system is maintaining the post-breakaway motion`);
  assert.equal(experimentHeld.liveReadout, null, `${label}: the obsolete live readout overlay is removed from the F–t graph`);
  assert.equal(experimentHeld.slider, null, `${label}: B has no control-panel slider`);
  await touchEnd(cdp);
  await delay(250);
  const heldAfterRelease = await evaluate(cdp, "window.__staticKineticFrictionApp.interactionEvidence().experiment");
  assert.equal(heldAfterRelease.autoKineticHold, true, `${label}: releasing the learner pointer does not cancel the automatic kinetic hold`);
  assert.ok(Math.abs(heldAfterRelease.velocityMps - experimentHeld.velocityMps) < .02, `${label}: automatic hold keeps the breakaway speed approximately constant ${JSON.stringify({ before: experimentHeld.velocityMps, after: heldAfterRelease.velocityMps })}`);
  await delay(1100);
  await tapSelector(cdp, "#stopRecording");
  const savedExperiment = await evaluate(cdp, "(() => ({ trial:Boolean(window.__staticKineticFrictionApp.getState().trial), running:window.__staticKineticFrictionApp.interactionEvidence().recorderRunning, status:document.getElementById('experimentStatus').textContent }))()");
  assert.equal(savedExperiment.trial, true, `${label}: the automatically maintained trace can be stopped and saved ${JSON.stringify(savedExperiment)}`);
  assert.equal(savedExperiment.running, false, `${label}: saving ends the transient B recorder`);
  const partBFonts = await evaluate(cdp, `(() => { const svg=document.getElementById('experimentGraphSvg'),axis=svg?.querySelector('.graph-axis-label'),tick=svg?.querySelector('.graph-tick-label'); return {axis:axis?getComputedStyle(axis).fontFamily:'',tick:tick?getComputedStyle(tick).fontFamily:'',preserve:svg?.getAttribute('preserveAspectRatio')}; })()`);
  assert.ok(partBFonts.axis && partBFonts.tick, `${label}: Part B exposes its graph math font after saving ${JSON.stringify(partBFonts)}`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='analysis']");
  const retainedInAnalysis = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),svg=document.getElementById('graphSvg'),path=svg?.querySelector('.analysis-force-line'),readout=document.getElementById('graphCursorReadout'); const pick=(node)=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,height:r.height}}; const xTickLabels=[...svg.querySelectorAll('.graph-tick-label')].filter(node=>Number(node.getAttribute('y'))>350).map(node=>Number(node.textContent)); const axis=svg?.querySelector('.graph-axis-label'),tick=svg?.querySelector('.graph-tick-label'); return {phase:state.phase,hasTrial:Boolean(state.trial),pathD:path?.getAttribute('d')||'',pathStroke:path?.getAttribute('stroke')||getComputedStyle(path||document.body).stroke,svg:pick(svg),readout:pick(readout),xTickLabels,maxXTick:Math.max(...xTickLabels),preserveC:svg?.getAttribute('preserveAspectRatio'),axisFontC:axis?getComputedStyle(axis).fontFamily:'',tickFontC:tick?getComputedStyle(tick).fontFamily:''}; })()`);
  assert.equal(retainedInAnalysis.phase, "analysis", `${label}: saved B trace can be opened in Part C`);
  assert.equal(retainedInAnalysis.hasTrial, true, `${label}: Part C keeps the accepted B trial in state`);
  assert.ok(retainedInAnalysis.pathD.startsWith("M") && retainedInAnalysis.pathD.length > 20, `${label}: Part C renders the saved B force-time trace ${JSON.stringify(retainedInAnalysis)}`);
  assert.equal(retainedInAnalysis.pathStroke, "#b91c1c", `${label}: Part C force-time trace is visibly styled`);
  assert.ok(retainedInAnalysis.maxXTick >= 5 && retainedInAnalysis.maxXTick < 30, `${label}: Part C trims the time axis to this short recorded run ${JSON.stringify(retainedInAnalysis)}`);
  assert.ok(retainedInAnalysis.readout.top >= retainedInAnalysis.svg.bottom - 1, `${label}: Part C readout sits below the graph instead of covering the x-axis ${JSON.stringify(retainedInAnalysis)}`);
  assert.equal(retainedInAnalysis.preserveC, "xMidYMid meet", `${label}: Part C preserves the graph aspect ratio`);
  assert.equal(partBFonts.preserve, "xMidYMid meet", `${label}: Part B preserves the graph aspect ratio`);
  assert.equal(partBFonts.axis, retainedInAnalysis.axisFontC, `${label}: Part B and C axis labels share one math font`);
  assert.equal(partBFonts.tick, retainedInAnalysis.tickFontC, `${label}: Part B and C tick labels share one math font`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='experiment']");
  const retainedInExperiment = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),svg=document.getElementById('experimentGraphSvg'),path=svg?.querySelector('.experiment-force-line'); return {phase:state.phase,hasTrial:Boolean(state.trial),pathD:path?.getAttribute('d')||'',graphVisible:!document.getElementById('experimentGraphStage').classList.contains('is-hidden')}; })()`);
  assert.equal(retainedInExperiment.phase, "experiment", `${label}: navigation returns to Part B`);
  assert.equal(retainedInExperiment.hasTrial, true, `${label}: returning to Part B preserves the accepted trial`);
  assert.ok(retainedInExperiment.graphVisible && retainedInExperiment.pathD.startsWith("M") && retainedInExperiment.pathD.length > 20, `${label}: Part B redraws its saved force-time graph after returning from Part C ${JSON.stringify(retainedInExperiment)}`);
  await tapSelector(cdp, "#requestRedoExperiment");
  const redoPrompt = await evaluate(cdp, "(() => ({dialogVisible:!document.getElementById('redoExperimentConfirm').classList.contains('is-hidden'),trial:Boolean(window.__staticKineticFrictionApp.getState().trial),running:window.__staticKineticFrictionApp.interactionEvidence().recorderRunning}))()");
  assert.deepEqual(redoPrompt, { dialogVisible: true, trial: true, running: false }, `${label}: a saved B trial remains authoritative until redo is confirmed`);
  await tapSelector(cdp, "[data-action='confirm-redo-experiment']");
  const restartedDuringRecording = await evaluate(cdp, "(() => { const evidence=window.__staticKineticFrictionApp.interactionEvidence(); return {running:evidence.recorderRunning,time:evidence.experiment?.timeS,position:evidence.experiment?.positionM,trial:window.__staticKineticFrictionApp.getState().trial,confirmHidden:document.getElementById('redoExperimentConfirm').classList.contains('is-hidden')}; })()");
  assert.ok(restartedDuringRecording.running && restartedDuringRecording.time < .35 && Math.abs(restartedDuringRecording.position) < 1e-9, `${label}: confirmed redo clears and restarts the recording ${JSON.stringify(restartedDuringRecording)}`);
  assert.equal(restartedDuringRecording.trial, null, `${label}: confirmed redo removes the previous trial`);
  assert.equal(restartedDuringRecording.confirmHidden, true, `${label}: confirmed redo closes the prompt`);
  await delay(80);
  const interrupted = await evaluate(cdp, `(() => { window.dispatchEvent(new Event('pagehide')); const raw=window.SimScorm.getLocalLog().filter(item=>item.key==='cmi.suspend_data').at(-1)?.value;const snapshot=JSON.parse(raw);window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot});const state=window.__staticKineticFrictionApp.getState();return {checkpointPhase:snapshot.answer.p,checkpointVariant:snapshot.answer.q,phase:state.phase,variant:state.variant,trial:state.trial,status:document.getElementById('experimentStatus').textContent,running:window.__staticKineticFrictionApp.interactionEvidence().recorderRunning,startDisabled:document.getElementById('startRecording').disabled}; })()`);
  assert.deepEqual(interrupted, { checkpointPhase: "experiment", checkpointVariant: "ready", phase: "experiment", variant: "ready", trial: null, status: "上次實驗記錄未完成，請重新開始這次記錄。", running: false, startDisabled: false }, `${label}: active recording restores the pre-record checkpoint with an interruption message and legal restart`);

  await evaluate(cdp, analysisFixtureScript(0));
  const blankAnalysis = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),svg=document.getElementById('graphSvg'),path=svg?.querySelector('.analysis-force-line'),readout=document.getElementById('graphCursorReadout'),handles=[...document.querySelectorAll('.analysis-marker')]; const svgRect=svg?.getBoundingClientRect(),readoutRect=readout?.getBoundingClientRect(); return { phase:state?.phase, hasTrial:Boolean(state?.trial), graphInStage:document.getElementById('stage').contains(svg), visible:handles.filter(node=>!node.classList.contains('is-hidden')).map(node=>node.dataset.dragTarget), graphText:svg?.textContent || '', pathD:path?.getAttribute('d') || '', readoutBelowAxis:Boolean(readoutRect && svgRect && readoutRect.top >= svgRect.bottom - 1), panelText:document.getElementById('analysisPanel')?.textContent || '' }; })()`);
  assert.equal(blankAnalysis.phase, "analysis", `${label}: C fixture opens in analysis phase`);
  assert.equal(blankAnalysis.hasTrial, true, `${label}: C receives the B trial`);
  assert.equal(blankAnalysis.graphInStage, true, `${label}: B graph and C markers share the stage coordinate space`);
  assert.ok(blankAnalysis.pathD.startsWith("M") && blankAnalysis.pathD.length > 20, `${label}: C fixture renders a visible saved force-time trace`);
  assert.equal(blankAnalysis.readoutBelowAxis, true, `${label}: C readout does not cover the x-axis`);
  assert.deepEqual(blankAnalysis.visible.sort(), ["kinetic-friction-marker", "maximum-static-friction-marker", "static-friction-marker"], `${label}: C exposes the three simple graph markers`);
  assert.match(blankAnalysis.panelText, /靜摩擦力/);
  assert.match(blankAnalysis.panelText, /最大靜摩擦力/);
  assert.match(blankAnalysis.panelText, /滑動摩擦力/);
  const blankMarkerVisuals = await evaluate(cdp, `(() => [...document.querySelectorAll('#staticFrictionMarker,#maximumStaticFrictionMarker,#kineticFrictionMarker')].map(node=>{const r=node.getBoundingClientRect(),style=getComputedStyle(node);return {key:node.dataset.dragTarget,left:r.left,top:r.top,width:r.width,height:r.height,background:style.backgroundColor,border:style.borderTopColor}}))()`);
  assert.equal(new Set(blankMarkerVisuals.map((marker) => marker.background)).size, 3, `${label}: C draggable markers use three distinct translucent friction colours ${JSON.stringify(blankMarkerVisuals)}`);
  assert.equal(blankMarkerVisuals.every((marker) => Math.abs(marker.width - marker.height) < 1), true, `${label}: C draggable markers keep a circular touch target ${JSON.stringify(blankMarkerVisuals)}`);
  assert.equal(Math.max(...blankMarkerVisuals.map((marker) => marker.top)) - Math.min(...blankMarkerVisuals.map((marker) => marker.top)) < 1, true, `${label}: unselected C markers share one horizontal drag row ${JSON.stringify(blankMarkerVisuals)}`);
  const blankMarker = await evaluate(cdp, `(() => { const node=document.getElementById('maximumStaticFrictionMarker'),r=node.getBoundingClientRect(),state=window.__staticKineticFrictionApp.getState(); return {x:r.left+r.width/2,y:r.top+r.height/2,index:state.working.analysisDraft?.maximumStaticFriction || state.analysis.maximumStaticFriction}; })()`);
  await evaluate(cdp, `(() => { window.__originalSaveDraft=window.SimScorm.saveDraft;window.__analysisDraftCommits=0;window.SimScorm.saveDraft=(...args)=>{window.__analysisDraftCommits+=1;return window.__originalSaveDraft(...args)};return true; })()`);
  await touch(cdp, { x: blankMarker.x, y: blankMarker.y }, { x: blankMarker.x + 8, y: blankMarker.y });
  const draggedMarker = await evaluate(cdp, `(() => { const node=document.getElementById('maximumStaticFrictionMarker'),r=node.getBoundingClientRect(),state=window.__staticKineticFrictionApp.getState(),commits=window.__analysisDraftCommits;window.SimScorm.saveDraft=window.__originalSaveDraft;delete window.__originalSaveDraft;return {x:r.left+r.width/2,y:r.top+r.height/2,index:state.working.analysisDraft?.maximumStaticFriction?.index,commits}; })()`);
  assert.equal(blankMarker.index, null, `${label}: an unselected C marker starts without an answer`);
  assert.ok(Number.isInteger(draggedMarker.index) && draggedMarker.index > 10, `${label}: dragging an unselected C marker uses its graph position instead of jumping to sample zero ${JSON.stringify({ blankMarker, draggedMarker })}`);
  assert.ok(Math.abs(draggedMarker.x - blankMarker.x) < 24, `${label}: the first C marker drag follows the pointer without a large jump ${JSON.stringify({ blankMarker, draggedMarker })}`);
  assert.equal(draggedMarker.commits, 1, `${label}: one C pointerup checkpoints the marker draft exactly once`);
  await evaluate(cdp, analysisFixtureScript(0));
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='predict']");
  const earlyPrediction = await evaluate(cdp, "(() => { const card=document.querySelector('#predictionCards [data-prediction-index=\"0\"]'); return { phase:window.__staticKineticFrictionApp.getState().phase, cards:document.querySelectorAll('#predictionCards [data-prediction-index]').length, firstEnabled:!card.querySelector('select').disabled, progress:document.querySelectorAll('.prediction-progress-step').length, numericInput:Boolean(card.querySelector('input[type=number]')) }; })()");
  assert.deepEqual(earlyPrediction, { phase: "predict", cards: 1, firstEnabled: true, progress: 4, numericInput: false }, `${label}: Part D is directly selectable with one sequential active question while Part C is still incomplete`);
  const predictionStageLayout = await evaluate(cdp, "(() => { const stage=document.getElementById('stage'),coach=document.getElementById('stageCoach'),readout=document.getElementById('predictionReadout'),block=document.querySelector('#apparatusSvg .apparatus-block'),surface=document.querySelector('#apparatusSvg .apparatus-surface'),blockRect=block?.getBoundingClientRect(),surfaceRect=surface?.getBoundingClientRect(); return { stagePrediction:stage.classList.contains('has-prediction'), coachHidden:coach.classList.contains('is-hidden'), coachDisplay:getComputedStyle(coach).display, readoutHidden:readout.classList.contains('is-hidden'), readoutDisplay:getComputedStyle(readout).display, blockTop:blockRect?.top, surfaceTop:surfaceRect?.top }; })()");
  assert.equal(predictionStageLayout.stagePrediction, true, `${label}: Part D uses the compact single-row stage layout`);
  assert.equal(predictionStageLayout.coachHidden, true, `${label}: Part D hides the redundant stage coach so it cannot cover the apparatus`);
  assert.equal(predictionStageLayout.readoutHidden, true, `${label}: Part D hides the redundant stage readout so it cannot cover the apparatus`);
  const predictionTarget = await evaluate(cdp, `(() => { const node=document.getElementById('predictionFriction'),r=node.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2, hidden:node.classList.contains('is-hidden') }; })()`);
  assert.equal(predictionTarget.hidden, false, `${label}: Part D exposes the small direct force target`);
  await touch(cdp, predictionTarget, { x: predictionTarget.x - 58, y: predictionTarget.y });
  const drawnPrediction = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(); return { direction:state.predictions[0]?.direction, magnitudeCN:state.predictions[0]?.magnitudeCN, arrow:Boolean(document.querySelector('.prediction-friction-arrow')), readout:document.querySelector('[data-prediction-magnitude-readout]')?.textContent }; })()`);
  assert.ok(drawnPrediction.direction === "left" && drawnPrediction.magnitudeCN > 0 && drawnPrediction.arrow && /N/.test(drawnPrediction.readout), `${label}: dragging the Part D target draws a leftward force and synchronises the readout ${JSON.stringify(drawnPrediction)}`);
  await tapSelector(cdp, "[data-action='to-review']");
  const dReview = await evaluate(cdp, `(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, presentation:window.__staticKineticFrictionApp.getPresentation(), predictHidden:document.getElementById('predictPanel').classList.contains('is-hidden'), reviewVisible:!document.getElementById('reviewPanel').classList.contains('is-hidden'), submitDisabled:document.getElementById('submit').disabled }))()`);
  assert.deepEqual(dReview, { phase: "review", presentation: "editable", predictHidden: true, reviewVisible: true, submitDisabled: false }, `${label}: Part D can enter the review page directly without returning to D`);
  await tapSelector(cdp, "#submit");
  const dResult = await evaluate(cdp, `(() => ({ phase:window.__staticKineticFrictionApp.getState().phase, presentation:window.__staticKineticFrictionApp.getPresentation(), predictHidden:document.getElementById('predictPanel').classList.contains('is-hidden'), reviewVisible:!document.getElementById('reviewPanel').classList.contains('is-hidden'), resultVisible:!document.getElementById('resultPanel').classList.contains('is-hidden') }))()`);
  assert.deepEqual(dResult, { phase: "review", presentation: "submitted-success", predictHidden: true, reviewVisible: true, resultVisible: true }, `${label}: submitting from Part D stays on the review/result page`);
  await navigate(cdp, url);
  await evaluate(cdp, analysisFixtureScript(0));
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='analysis']");
  await evaluate(cdp, `(() => { window.__originalSaveDraft=window.SimScorm.saveDraft;window.__analysisDraftCommits=0;window.SimScorm.saveDraft=(...args)=>{window.__analysisDraftCommits+=1;return window.__originalSaveDraft(...args)};return true; })()`);
  await pressKeyOn(cdp, "#staticFrictionMarker", "ArrowRight");
  const keyboardDraftCommits = await evaluate(cdp, `(() => { const commits=window.__analysisDraftCommits;window.SimScorm.saveDraft=window.__originalSaveDraft;delete window.__originalSaveDraft;return commits; })()`);
  assert.equal(keyboardDraftCommits, 1, `${label}: one C keyboard step checkpoints the marker draft exactly once`);
  const partial = await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp,P=window.StaticKineticFrictionPersistence;const state=app.getState();window.__analysisSnapshot={version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(state)};app.routeAttempt({state:'draft',snapshot:window.__analysisSnapshot});const restored=app.getState(),draft=restored.working.analysisDraft;return {variant:restored.variant,active:restored.working.activeAnalysisTask,canonical:restored.analysis.staticFriction,selected:draft.staticFriction?.index,unselected:[draft.maximumStaticFriction,draft.kineticFriction]} })()`);
  assert.deepEqual(partial, { variant: "selection-only", active: 1, canonical: null, selected: 1, unselected: [null, null] }, `${label}: graph marker drafts persist separately without replacing canonical C authority`);
  await pressKeyOn(cdp, "#maximumStaticFrictionMarker", "ArrowRight");
  await pressKeyOn(cdp, "#kineticFrictionMarker", "ArrowRight");
  await tapSelector(cdp, "[data-action='save-analysis']");
  const continued = await evaluate(cdp, `(() => ({complete:window.StaticKineticFrictionPersistence.hasAllAnalysisFields(window.__staticKineticFrictionApp.getState()),visible:[...document.querySelectorAll('.analysis-marker:not(.is-hidden)')].map(node=>node.dataset.dragTarget)}))()`);
  assert.equal(continued.complete, true, `${label}: one save commits all three graph markers`); assert.deepEqual(continued.visible.sort(), ["kinetic-friction-marker", "maximum-static-friction-marker", "static-friction-marker"], `${label}: all graph markers remain available for revision`);
  const markerLabelLayout = await evaluate(cdp, `(() => [...document.querySelectorAll('#graphSvg .analysis-marker-label')].map(node=>{const r=node.getBoundingClientRect(),line=document.querySelector('#graphSvg .analysis-marker-line[data-marker-key="'+node.dataset.markerKey+'"]');return {text:node.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,textX:Number(node.getAttribute('x')),lineX:Number(line?.getAttribute('x1'))}}))()`);
  assert.equal(markerLabelLayout.length, 3, `${label}: C renders one top label for each selected marker`);
  assert.equal(markerLabelLayout.every((rect) => Math.abs(rect.textX - rect.lineX) < 1), true, `${label}: C marker labels follow their coloured guide x-coordinates ${JSON.stringify(markerLabelLayout)}`);
  assert.equal(markerLabelLayout.every((rect, index, all) => all.every((other, otherIndex) => index === otherIndex || rect.right <= other.left + 1 || other.right <= rect.left + 1 || rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)), true, `${label}: C marker labels do not overlap even when guides are close ${JSON.stringify(markerLabelLayout)}`);
  const selectedMarkerVisuals = await evaluate(cdp, `(() => ({targets:[...document.querySelectorAll('#staticFrictionMarker,#maximumStaticFrictionMarker,#kineticFrictionMarker')].map(node=>{const r=node.getBoundingClientRect();return {top:r.top,width:r.width,height:r.height}}),dots:[...document.querySelectorAll('#graphSvg .analysis-marker-dot')].map(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height}})}))()`);
  assert.equal(Math.max(...selectedMarkerVisuals.targets.map((marker) => marker.top)) - Math.min(...selectedMarkerVisuals.targets.map((marker) => marker.top)) < 1, true, `${label}: selected C markers stay on one horizontal drag row ${JSON.stringify(selectedMarkerVisuals)}`);
  assert.equal(selectedMarkerVisuals.targets.every((marker) => Math.abs(marker.width - marker.height) < 1), true, `${label}: selected C drag targets stay circular ${JSON.stringify(selectedMarkerVisuals)}`);
  assert.equal(selectedMarkerVisuals.dots.length, 3, `${label}: C renders three coloured graph dots`);
  assert.equal(selectedMarkerVisuals.dots.every((marker) => Math.abs(marker.width - marker.height) < 1), true, `${label}: C graph dots stay circular after SVG scaling ${JSON.stringify(selectedMarkerVisuals)}`);

  await evaluate(cdp, `(() => { const P=window.StaticKineticFrictionPersistence, app=window.__staticKineticFrictionApp, blank=P.freshState(window.__frictionFixture.scenario.seed); app.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(blank)}}); return true })()`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='review']");
  const partialReview = await evaluate(cdp, `(() => { const block=document.querySelector('#apparatusSvg .apparatus-block'), state=window.__staticKineticFrictionApp.getState(); return {phase:state.phase, submitDisabled:document.getElementById('submit').disabled, hasRope:Boolean(document.querySelector('#apparatusSvg .apparatus-rope')), hasGrip:Boolean(document.querySelector('#apparatusSvg .apparatus-grip')), blockX:Number(block?.getAttribute('x')), summary:document.getElementById('reviewSummary').textContent}; })()`);
  assert.equal(partialReview.phase, "review", `${label}: incomplete work can enter the submission review`);
  assert.equal(partialReview.submitDisabled, false, `${label}: incomplete work can be submitted`);
  assert.equal(partialReview.hasRope, false, `${label}: submission review uses the clean apparatus without the old rope`);
  assert.equal(partialReview.hasGrip, false, `${label}: submission review uses the clean apparatus without the old orange grip`);
  assert.ok(partialReview.blockX > 380 && partialReview.blockX < 470, `${label}: submission review centers the clean block ${JSON.stringify(partialReview)}`);
  assert.match(partialReview.summary, /可先核對已保存答案，再提交/, `${label}: submission review uses neutral pre-submit guidance`);
  await tapSelector(cdp, "#submit");
  const partialResult = await evaluate(cdp, "(() => ({presentation:window.__staticKineticFrictionApp.getPresentation(),text:document.getElementById('resultPanel').textContent}))()");
  assert.equal(partialResult.presentation, "submitted-success", `${label}: incomplete submission can finish successfully`);
  assert.match(partialResult.text, /各部分得分及扣分/, `${label}: submitted result has the score ledger heading`);
  assert.match(partialResult.text, /Part A.*扣/, `${label}: submitted result identifies deductions in Part A`);
  assert.match(partialResult.text, /摩擦力類型.*方向.*大小.*未得分/, `${label}: submitted result names the missing A1 components`);

  await navigate(cdp, url);
  await evaluate(cdp, analysisFixtureScript(0));

  await evaluate(cdp, `(() => { const S=window.StaticKineticFrictionScoring,P=window.StaticKineticFrictionPersistence;const perfect={...S.perfectAnswer(window.__frictionFixture.scenario,window.__frictionFixture.trial),working:P.emptyWorking()};const snapshot={version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(perfect)};window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot});window.__reviewAuthority=JSON.stringify({analysis:perfect.analysis,predictions:perfect.predictions});return true })()`);
  await tapSelector(cdp, "#submit");
  const submittedGraph = await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp,graph=document.getElementById('stageGraph'),readout=document.getElementById('graphCursorReadout'); return {presentation:app.getPresentation(),graphVisible:!graph.classList.contains('is-hidden'),correctRanges:document.querySelectorAll('#graphSvg [data-correct-range]').length,learnerLines:document.querySelectorAll('#graphSvg .analysis-marker-line[data-learner-marker]').length,learnerDots:document.querySelectorAll('#graphSvg .analysis-marker-dot[data-learner-marker]').length,editableTargets:[...document.querySelectorAll('.analysis-marker')].filter(node=>!node.classList.contains('is-hidden')&&!node.disabled).length,readout:readout.textContent,result:document.getElementById('resultPanel').textContent}; })()`);
  assert.equal(submittedGraph.presentation, "submitted-success", `${label}: perfect submission reaches the locked result presentation`);
  assert.equal(submittedGraph.graphVisible, true, `${label}: submitted Part C result graph is visible on the stage`);
  assert.ok(submittedGraph.correctRanges >= 3, `${label}: submitted graph shows the three correct concept ranges`);
  assert.equal(submittedGraph.learnerLines, 3, `${label}: submitted graph shows all three learner marker guides`);
  assert.equal(submittedGraph.learnerDots, 3, `${label}: submitted graph shows all three learner marker readings`);
  assert.equal(submittedGraph.editableTargets, 0, `${label}: submitted graph exposes no editable marker target`);
  assert.match(submittedGraph.readout, /靜摩擦力.*s.*N.*最大靜摩擦力.*s.*N.*滑動摩擦力.*s.*N/s, `${label}: submitted graph lists learner marker time and pull readings`);
  assert.match(submittedGraph.result, /Part C 圖像結果.*上方只讀/s, `${label}: result panel points learners to the visible read-only graph`);

  await navigate(cdp, url);
  await evaluate(cdp, analysisFixtureScript(0));
  await evaluate(cdp, `(() => { const S=window.StaticKineticFrictionScoring,P=window.StaticKineticFrictionPersistence;const perfect={...S.perfectAnswer(window.__frictionFixture.scenario,window.__frictionFixture.trial),working:P.emptyWorking()};const snapshot={version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(perfect)};window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot});window.__reviewAuthority=JSON.stringify({analysis:perfect.analysis,predictions:perfect.predictions});return true })()`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='analysis']");
  await pressKeyOn(cdp, "#kineticFrictionMarker", "ArrowRight");
  const unsavedNormalC = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),saved=JSON.parse(window.__reviewAuthority); return {canonicalSame:JSON.stringify(state.analysis)===JSON.stringify(saved.analysis),predictionsSame:JSON.stringify(state.predictions)===JSON.stringify(saved.predictions),draftIndex:state.working.analysisDraft?.kineticFriction?.index,canonicalIndex:state.analysis.kineticFriction.index}; })()`);
  assert.equal(unsavedNormalC.canonicalSame, true, `${label}: normal C dragging leaves saved C authority unchanged before save`);
  assert.equal(unsavedNormalC.predictionsSame, true, `${label}: normal C dragging leaves D authority unchanged before save`);
  assert.notEqual(unsavedNormalC.draftIndex, unsavedNormalC.canonicalIndex, `${label}: normal C dragging persists a distinct working marker draft`);
  const dirtyMarkerCopy = await evaluate(cdp, `document.getElementById('analysisTasks').textContent`);
  assert.match(dirtyMarkerCopy, /C3.*有未保存修改/s, `${label}: a changed C3 marker is labelled as unsaved rather than saved`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='review']");
  const dirtyCReview = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),saved=JSON.parse(window.__reviewAuthority),wire=window.StaticKineticFrictionPersistence.encodeReview(state); return {canonicalSame:JSON.stringify(state.analysis)===JSON.stringify(saved.analysis),draftIndex:state.working?.analysisDraft?.kineticFriction?.index,wireIndex:wire.a.k?.[0],summary:document.getElementById('reviewSummary').textContent}; })()`);
  assert.equal(dirtyCReview.canonicalSame, true, `${label}: editable review reads the saved C authority`);
  assert.equal(dirtyCReview.draftIndex, unsavedNormalC.draftIndex, `${label}: editable review retains the unsaved C draft separately`);
  assert.equal(dirtyCReview.wireIndex, unsavedNormalC.canonicalIndex, `${label}: final review wire uses the saved C3 marker, not the dirty draft`);
  assert.match(dirtyCReview.summary, /Part C 有未保存修改.*評分仍使用已保存標示/s, `${label}: review explicitly explains how the dirty C draft is handled`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='analysis']");
  assert.equal(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().working.analysisDraft.kineticFriction.index"), unsavedNormalC.draftIndex, `${label}: returning from review resumes the unsaved C marker`);
  await tapSelector(cdp, "[data-action='navigate-phase'][data-phase='predict']");
  const leftUnsavedC = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),saved=JSON.parse(window.__reviewAuthority); return {canonicalSame:JSON.stringify(state.analysis)===JSON.stringify(saved.analysis),predictionsSame:JSON.stringify(state.predictions)===JSON.stringify(saved.predictions),draftIndex:state.working.analysisDraft?.kineticFriction?.index}; })()`);
  assert.deepEqual(leftUnsavedC, { canonicalSame: true, predictionsSame: true, draftIndex: unsavedNormalC.draftIndex }, `${label}: leaving C preserves authority and the resumable working draft`);

  await navigate(cdp, url);
  await evaluate(cdp, analysisFixtureScript(0));
  await evaluate(cdp, `(() => { const S=window.StaticKineticFrictionScoring,P=window.StaticKineticFrictionPersistence;const perfect={...S.perfectAnswer(window.__frictionFixture.scenario,window.__frictionFixture.trial),working:P.emptyWorking()};const snapshot={version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(perfect)};window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot});window.__reviewAuthority=JSON.stringify({analysis:perfect.analysis,predictions:perfect.predictions});return true })()`);
  const kineticPredictionIndex = await evaluate(cdp, "window.__staticKineticFrictionApp.getScenario().predictions.findIndex(spec=>spec.frictionType==='kinetic')");
  await tapSelector(cdp, `[data-action='edit-predict'][data-prediction-index='${kineticPredictionIndex}']`);
  const kineticPredictionCopy = await evaluate(cdp, `(() => { const card=document.querySelector('#predictionCards [data-prediction-index="${kineticPredictionIndex}"]');return [card.querySelector('.prediction-kinetic-prompt')?.textContent,card.querySelector('.prediction-force-readout')?.textContent].join(' '); })()`);
  assert.match(kineticPredictionCopy, /摩擦力的平均大小.*畫出的平均摩擦力估值/s, `${label}: kinetic prediction clarifies the average magnitude without revealing its type`);
  assert.doesNotMatch(kineticPredictionCopy, /滑動摩擦力/, `${label}: pre-submit average-value guidance does not reveal the scored friction type`);
  await tapSelector(cdp, "#cancelReviewEdit");
  await tapSelector(cdp, "[data-action='edit-analysis'][data-analysis-key='kineticFriction']"); await pressKeyOn(cdp, "#kineticFrictionMarker", "ArrowRight"); await tapSelector(cdp, "#cancelReviewEdit");
  assert.equal(await evaluate(cdp, "JSON.stringify({analysis:window.__staticKineticFrictionApp.getState().analysis,predictions:window.__staticKineticFrictionApp.getState().predictions})===window.__reviewAuthority"), true, `${label}: cancelling graph review edit restores immutable authority`);
  await tapSelector(cdp, "[data-action='edit-predict'][data-prediction-index='1']");
  const predictionVisualBefore = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),r=document.getElementById('predictionFriction').getBoundingClientRect();return {magnitude:state.predictions[1].magnitudeCN,handleX:r.left+r.width/2,arrow:Boolean(document.querySelector('.prediction-friction-arrow')),readout:document.getElementById('predictionReadout').textContent} })()`);
  await pressKeyOn(cdp, "#predictionFriction", "ArrowRight");
  const predictionDraft = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),r=document.getElementById('predictionFriction').getBoundingClientRect();return {target:state.working.reviewEditTarget.semanticKey,authority:state.predictions[1].magnitudeCN,draft:state.working.editDraft.value.magnitudeCN,handleX:r.left+r.width/2,arrow:Boolean(document.querySelector('.prediction-friction-arrow')),readout:document.getElementById('predictionReadout').textContent} })()`);
  const beforePrediction = predictionVisualBefore.magnitude;
  assert.equal(predictionDraft.target, 1, `${label}: prediction drag targets the active semantic card`); assert.equal(predictionDraft.authority, beforePrediction, `${label}: prediction review drag leaves authority immutable`); assert.notEqual(predictionDraft.draft, beforePrediction, `${label}: prediction drag persists a working draft`);
  assert.equal(predictionVisualBefore.arrow && predictionDraft.arrow, true, `${label}: Part D renders the learner friction arrow`); assert.notEqual(predictionDraft.handleX, predictionVisualBefore.handleX, `${label}: Part D arrowhead moves with learner magnitude`); assert.match(predictionDraft.readout, /畫出的摩擦力/, `${label}: Part D stage exposes learner-readable force text`);
  await evaluate(cdp, `(() => { const select=document.querySelector('[data-prediction-index="1"] [data-prediction-field="frictionType"]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));return true })()`);
  await tapSelector(cdp, "[data-prediction-index='1'] [data-action='save-prediction']");
  const validation = await evaluate(cdp, `(() => { const node=document.getElementById('validationStatus');return {visible:!node.classList.contains('is-hidden'),text:node.textContent,focused:document.activeElement===node} })()`);
  assert.equal(validation.visible, true, `${label}: invalid prediction shows a visible validation message`); assert.match(validation.text, /畫出摩擦力.*類型.*運動結果/, `${label}: validation message identifies the stage force and control choices`); assert.equal(validation.focused, true, `${label}: validation error has a deterministic screen-reader focus target`);
  await tapSelector(cdp, "#cancelReviewEdit");
  await tapSelector(cdp, "[data-action='edit-experiment']");
  const reviewRedoPrompt = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(); return {phase:state.phase,trial:Boolean(state.trial),dialogVisible:!document.getElementById('redoExperimentConfirm').classList.contains('is-hidden')}; })()`);
  assert.deepEqual(reviewRedoPrompt, { phase: "review", trial: true, dialogVisible: true }, `${label}: review experiment editing preserves the saved authority until confirmation`);
  await tapSelector(cdp, "[data-action='confirm-redo-experiment']");
  const reviewRedo = await evaluate(cdp, `(() => { const evidence=window.__staticKineticFrictionApp.interactionEvidence(),state=window.__staticKineticFrictionApp.getState(); return {phase:state.phase,fromReview:state.fromReview,running:evidence.recorderRunning,time:evidence.experiment?.timeS,trial:state.trial,confirmHidden:document.getElementById('redoExperimentConfirm').classList.contains('is-hidden'),runHidden:document.getElementById('experimentRunActions').classList.contains('is-hidden')}; })()`);
  assert.equal(reviewRedo.phase, "experiment", `${label}: review experiment editing enters a fresh experiment phase`);
  assert.equal(reviewRedo.fromReview, false, `${label}: direct review restart exits review-edit mode`);
  assert.equal(reviewRedo.running, true, `${label}: review experiment editing starts a new direct recording`);
  assert.ok(reviewRedo.time < .35, `${label}: review experiment restart resets the recording clock ${JSON.stringify(reviewRedo)}`);
  assert.equal(reviewRedo.trial, null, `${label}: review experiment restart clears the old trial`);
  assert.equal(reviewRedo.confirmHidden, true, `${label}: confirmed review restart closes the confirmation prompt`);
  assert.equal(reviewRedo.runHidden, false, `${label}: the direct recording controls remain available after review restart`);
  await evaluate(cdp, `(() => { const S=window.StaticKineticFrictionScoring,P=window.StaticKineticFrictionPersistence;const perfect={...S.perfectAnswer(window.__frictionFixture.scenario,window.__frictionFixture.trial),working:P.emptyWorking()};const snapshot={version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(perfect)};window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot});return true })()`);
  await evaluate(cdp, "window.SimScorm.submitWithCallbacks=(result,snapshot,handlers)=>{handlers.onFailure({activityState:'retry',retryable:true});return {activityState:'retry',retryable:true}};"); await tapSelector(cdp, "#submit");
  const retryable = await evaluate(cdp, `(() => ({presentation:window.__staticKineticFrictionApp.getPresentation(),status:document.getElementById('submitStatus').textContent,submitDisabled:document.getElementById('submit').disabled,resultHidden:document.getElementById('resultPanel').classList.contains('is-hidden')}))()`);
  assert.equal(retryable.presentation, "editable", `${label}: retryable submission remains editable`); assert.match(retryable.status, /技術提交未完成.*分數均未確認/, `${label}: retryable submission shows a neutral status`); assert.equal(retryable.submitDisabled, false); assert.equal(retryable.resultHidden, true, `${label}: retryable submission reveals no result`);
  await evaluate(cdp, "window.SimScorm.submitWithCallbacks=(result,snapshot,handlers)=>{handlers.onFailure({activityState:'retry',retryable:false});return {activityState:'retry',retryable:false}};"); await tapSelector(cdp, "#submit");
  const technical = await evaluate(cdp, `(() => ({presentation:window.__staticKineticFrictionApp.getPresentation(),technical:!document.getElementById('technicalPanel').classList.contains('is-hidden'),resultHidden:document.getElementById('resultPanel').classList.contains('is-hidden'),unsafeEnabled:[...document.querySelectorAll('[data-action]')].filter(node=>!node.disabled).map(node=>node.dataset.action)}))()`);
  assert.equal(technical.presentation, "technical", `${label}: non-retryable submission enters technical lock`); assert.equal(technical.technical, true); assert.equal(technical.resultHidden, true, `${label}: technical lock reveals no score`); assert.deepEqual(technical.unsafeEnabled, [], `${label}: technical lock disables unsafe actions`);
  await navigate(cdp, url);
  await evaluate(cdp, `window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot:{version:1,activity:'${slug}',kind:'draft',answer:{}}})`);
  const loadError = await evaluate(cdp, `(() => ({presentation:window.__staticKineticFrictionApp.getPresentation(),dragTargets:[...document.querySelectorAll('.drag-target')].map(node=>({disabled:node.disabled,aria:node.getAttribute('aria-disabled')}))}))()`);
  assert.equal(loadError.presentation, "technical", `${label}: invalid draft enters technical startup fallback`); assert.ok(loadError.dragTargets.every(target=>target.disabled&&target.aria==='true'), `${label}: startup fallback locks every focusable drag target`);
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
      panelOverflowY: getComputedStyle(panel).overflowY,
      appHeight: document.getElementById('app').getBoundingClientRect().height,
      shellHeight: document.querySelector('.friction-shell').getBoundingClientRect().height,
      stageHeight: stage.getBoundingClientRect().height,
      panelHeight: panel.getBoundingClientRect().height,
      controlsFirst: document.querySelector('.friction-shell').firstElementChild === panel,
      experimentOriginHidden: document.getElementById('experimentOrigin').classList.contains('is-hidden'),
      coach: document.getElementById('stageCoach').textContent,
      zeroTask: document.getElementById('zeroTask').textContent,
      sensorReadoutsHidden: !document.getElementById('liveReadouts'),
      explanation: document.querySelector('.first-step-explanation').textContent,
      headerHasSimLab: document.querySelector('.sim-header').textContent.includes('SimLab'),
      stageLabels: document.getElementById('apparatusSvg').textContent,
      zeroMagnitudeHeight: document.getElementById('zeroFrictionMagnitude').getBoundingClientRect().height,
      zeroTypeHeight: document.getElementById('zeroFrictionType').getBoundingClientRect().height,
      zeroDirectionHeight: document.getElementById('zeroFrictionDirection').getBoundingClientRect().height,
      breakawayInputHeight: document.getElementById('breakawayAnswer').getBoundingClientRect().height,
      breakawayInputValue: document.getElementById('breakawayAnswer').value,
      targets: [...document.querySelectorAll('.drag-target:not(.is-hidden)')].map(node => { const r = node.getBoundingClientRect(); return { w: r.width, h: r.height }; })
    };
  })()`);
  assert.equal(layout.presentation, "editable", `${label}: embedded startup presentation`);
  assert.equal(layout.phase, "balance", `${label}: embedded startup phase`);
  assert.equal(layout.touch, "pan-y", `${label}: embedded stage touch action`);
  assert.ok(layout.html <= layout.inner + 1, `${label}: embedded activity document is bounded (${layout.html}/${layout.inner}; app=${layout.appHeight}, shell=${layout.shellHeight}, stage=${layout.stageHeight}, panel=${layout.panelHeight})`);
  assert.ok(layout.panelRange > 8, `${label}: embedded panel has independent scroll range`);
  assert.equal(layout.panelOverflowY, "auto", `${label}: embedded control panel is the declared independent scroll owner`);
  assert.equal(layout.controlsFirst, true, `${label}: controls precede stage in live DOM order`);
  assert.equal(layout.experimentOriginHidden, true, `${label}: Part A does not expose the B direct-pull target`);
  assert.match(layout.coach, /A1.*沒有水平拉力/s, `${label}: startup coach names the zero-horizontal-force task`);
  assert.match(layout.zeroTask, /摩擦力.*方向.*大小/s, `${label}: A1 asks for friction type, direction and magnitude`);
  assert.equal(layout.sensorReadoutsHidden, true, `${label}: Part A hides experiment readouts`);
  assert.equal(layout.headerHasSimLab, false, `${label}: the activity header does not repeat the SimLab brand`);
  assert.doesNotMatch(layout.stageLabels, /物體|水平粗糙面|Part A：只看水平力的大小和方向/, `${label}: redundant stage labels are removed`);
  assert.match(layout.explanation, /不使用測力計.*歸零/s, `${label}: Part A explicitly removes instrument calibration`);
  assert.ok(layout.stageHeight <= layout.shellHeight * .48, `${label}: the phone stage leaves most of the bounded shell to the control panel (${layout.stageHeight}/${layout.shellHeight})`);
  assert.ok(Math.abs(layout.zeroMagnitudeHeight - layout.zeroTypeHeight) < 1 && Math.abs(layout.zeroMagnitudeHeight - layout.zeroDirectionHeight) < 1, `${label}: A1 magnitude input matches both select heights (${JSON.stringify(layout)})`);
  assert.ok(layout.breakawayInputHeight >= 44, `${label}: A3 estimate input keeps a 44px touch height (${layout.breakawayInputHeight}px)`);
  assert.equal(layout.breakawayInputValue, "", `${label}: A3 estimate input starts blank before a breakaway trial`);
  assert.ok(layout.targets.every((target) => target.w >= 44 && target.h >= 44), `${label}: embedded targets are stable touch sizes`);
  await evaluate(cdp, "scrollTo({ top: 300, behavior: 'instant' })");
  await delay(120);
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
  await navigateEmbedded(cdp, base, launch);
  await frameEvaluate(cdp, `(() => { window.__trustedEvents = []; for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) document.addEventListener(type, event => window.__trustedEvents.push({ type, trusted: event.isTrusted, pointerType: event.pointerType }), true); return true; })()`);
  await evaluate(cdp, "scrollTo({ top: 300, behavior: 'instant' })");
  await delay(120);
  const panelPoint = await frameEvaluate(cdp, `(() => { const frame = window.frameElement.getBoundingClientRect(); const panel = document.getElementById('controlPanel'); const r = panel.getBoundingClientRect(); for (let y = r.top + 12; y < r.bottom - 12; y += 12) { const hit = document.elementFromPoint(r.left + r.width / 2, y); if (!hit?.closest('button,input,select,.drag-target')) return { x: frame.left + r.left + r.width / 2, y: frame.top + y }; } return { x: frame.left + r.left + r.width / 2, y: frame.top + r.top + 12 }; })()`);
  const panelRange = await frameEvaluate(cdp, "(() => { const panel = document.getElementById('controlPanel'); return panel.scrollHeight - panel.clientHeight; })()");
  assert.ok(panelRange > 8, `${label}: expanded control panel has independent scroll range (${panelRange})`);
  // Exceed Chromium's touch-slop so the trusted gesture produces touchmove
  // events even when the panel has only a short remaining scroll range.
  const panelDelta = Math.max(16, Math.min(24, panelRange / 4));
  await frameEvaluate(cdp, `(() => { const panel = document.getElementById('controlPanel'); panel.scrollTop = ${panelRange / 2}; return true; })()`);
  const beforePanel = await metrics();
  await touch(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y - panelDelta });
  await delay(320);
  const afterPanel = await metrics();
  assert(afterPanel.panel > beforePanel.panel, `${label}: control panel swipe owns panel scroll`);
  assert.ok(Math.abs(afterPanel.host - beforePanel.host) <= 1, `${label}: panel swipe leaves enclosing host fixed (≤1 CSS px rounding)`);
  await delay(500);
  const momentumDistance = Math.min(72, Math.max(28, panelRange * .12));
  await frameEvaluate(cdp, `(() => { const panel = document.getElementById('controlPanel'); panel.scrollTop = ${panelRange * .15}; return true; })()`);
  // Use a genuine quick flick.  A 384 ms drag can correctly retain almost no
  // release velocity on Linux headless Chrome and therefore does not test the
  // native momentum behaviour that a learner expects from a phone swipe.
  await touchStartMoveGradual(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y - momentumDistance }, 8, 8);
  await touchEnd(cdp);
  let panelAtRelease = await metrics();
  await delay(180);
  let panelAfterMomentum = await metrics();
  let momentumDelta = panelAfterMomentum.panel - panelAtRelease.panel;
  let reachedPanelEnd = momentumDelta > 0 && panelRange - panelAfterMomentum.panel <= 1;
  if (momentumDelta <= 1 && !reachedPanelEnd) {
    await frameEvaluate(cdp, `(() => { const panel = document.getElementById('controlPanel'); panel.scrollTop = ${panelRange * .15}; return true; })()`);
    await touchStartMoveGradual(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y - momentumDistance }, 6, 6);
    await touchEnd(cdp);
    panelAtRelease = await metrics();
    await delay(180);
    panelAfterMomentum = await metrics();
    momentumDelta = panelAfterMomentum.panel - panelAtRelease.panel;
    reachedPanelEnd = momentumDelta > 0 && panelRange - panelAfterMomentum.panel <= 1;
  }
  assert.ok(momentumDelta > 1 || reachedPanelEnd, `${label}: releasing a panel swipe keeps native momentum scrolling (${JSON.stringify({ range: panelRange, atRelease: panelAtRelease.panel, afterMomentum: panelAfterMomentum.panel, delta: momentumDelta, reachedPanelEnd, distance: momentumDistance })})`);
  assert.ok(Math.abs(panelAfterMomentum.host - panelAtRelease.host) <= 1, `${label}: panel momentum leaves enclosing host fixed`);
  const prepared = await frameEvaluate(cdp, `(() => {
    const state=window.__staticKineticFrictionApp.getState();
    return {zero:state.balance.zeroForce,experimentOriginHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'),originHidden:document.getElementById('balanceOrigin').classList.contains('is-hidden')};
  })()`);
  assert.deepEqual(prepared, { zero: null, experimentOriginHidden: true, originHidden: true }, `${label}: Part A startup exposes only the A1 control task`);
  await frameEvaluate(cdp, `(() => { const set=(id,value,eventName='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event(eventName,{bubbles:true}))};set('zeroFrictionType','none');set('zeroFrictionDirection','none');set('zeroFrictionMagnitude','0','input');document.querySelector('[data-action="save-zero-force"]').click();return true; })()`);
  await delay(120);
  const originTarget = await frameEvaluate(cdp, `(() => { const frame=window.frameElement.getBoundingClientRect(),node=document.getElementById('balanceOrigin'),r=node.getBoundingClientRect();return {x:frame.left+r.left+r.width/2,y:frame.top+r.top+r.height/2,hidden:node.classList.contains('is-hidden')}; })()`);
  assert.equal(originTarget.hidden, false, `${label}: A2 exposes the stable object-centre drawing target after A1`);
  await frameEvaluate(cdp, "window.__trustedEvents = []");
  await touch(cdp, originTarget, { x: originTarget.x + 24, y: originTarget.y });
  const events = await frameEvaluate(cdp, "window.__trustedEvents.slice()");
  const touchEvents = events.filter((event) => event.pointerType === "touch");
  assert(touchEvents.some((event) => event.type === "pointerup" && event.trusted), `${label}: A2 friction arrow has trusted pointerup`);
  assert.equal(touchEvents.some((event) => event.type === "pointercancel"), false, `${label}: A2 friction arrow has no pointercancel`);
}
async function desktopSmoke(cdp, url, label, width, height, deviceScaleFactor) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile: false });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, url);
  const layout = await evaluate(cdp, `(() => {
    const stage=document.getElementById('stage').getBoundingClientRect();
    const panel=document.getElementById('controlPanel').getBoundingClientRect();
    const header=document.querySelector('.sim-header').getBoundingClientRect();
    const text=[...document.querySelectorAll('#apparatusSvg text')].map(node=>node.getBoundingClientRect());
    return {stage:{left:stage.left,right:stage.right,width:stage.width},panel:{left:panel.left,right:panel.right,width:panel.width},headerHeight:header.height,dpr:devicePixelRatio,docWidth:document.documentElement.scrollWidth,innerWidth,experimentOriginHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'),coach:document.getElementById('stageCoach').textContent,zeroTask:document.getElementById('zeroTask').textContent,explanation:document.querySelector('.first-step-explanation').textContent,textInside:text.every(rect=>rect.left>=stage.left-2&&rect.right<=stage.right+2)};
  })()`);
  assert.equal(layout.stage.left, 0, `${label}: desktop stage starts at the left edge`);
  assert.ok(layout.stage.right <= layout.panel.left + 1, `${label}: desktop stage precedes the control panel visually`);
  assert.ok(layout.stage.width >= layout.panel.width * 1.35, `${label}: desktop stage remains the primary visual region (${layout.stage.width}/${layout.panel.width})`);
  assert.ok(layout.panel.right <= width + 1 && layout.panel.width >= 384 && layout.panel.width <= 513, `${label}: desktop control panel stays within its bounded width`);
  assert.ok(layout.headerHeight >= 64 && layout.headerHeight <= 96, `${label}: desktop header stays compact without clipping (${layout.headerHeight}px at dpr ${layout.dpr})`);
  assert.ok(layout.docWidth <= layout.innerWidth + 1, `${label}: desktop has no horizontal document overflow`);
  assert.equal(layout.textInside, true, `${label}: apparatus labels remain inside the stage`);
  assert.equal(layout.experimentOriginHidden, true, `${label}: desktop Part A hides the B direct-pull target`);
  assert.match(layout.coach, /A1.*沒有水平拉力/s, `${label}: desktop coach shows the zero-force task`);
  assert.match(layout.zeroTask, /摩擦力.*方向.*大小/s, `${label}: desktop A1 asks for all force-vector fields`);
  assert.match(layout.explanation, /不使用測力計.*歸零/s, `${label}: desktop explanation removes calibration from Part A`);
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
      const layout = await evaluate(cdp, `(()=>{const stage=document.getElementById('stage'),panel=document.getElementById('controlPanel'),app=document.getElementById('app'),shell=document.querySelector('.friction-shell'),coach=document.getElementById('stageCoach'),block=document.querySelector('#apparatusSvg .apparatus-block'),coachRect=coach.getBoundingClientRect(),blockRect=block?.getBoundingClientRect();return {presentation:window.__staticKineticFrictionApp.getPresentation(),phase:window.__staticKineticFrictionApp.getState().phase,resultHidden:document.getElementById('resultPanel').classList.contains('is-hidden'),touch:getComputedStyle(stage).touchAction,html:document.documentElement.scrollHeight,inner:innerHeight,panelRange:panel.scrollHeight-panel.clientHeight,panelClientHeight:panel.clientHeight,panelScrollHeight:panel.scrollHeight,appHeight:app.getBoundingClientRect().height,shellHeight:shell.getBoundingClientRect().height,experimentOriginHidden:document.getElementById('experimentOrigin').classList.contains('is-hidden'),coach:document.getElementById('stageCoach').textContent,coachBottom:coachRect.bottom,blockTop:blockRect?.top,coachBlockOverlap:Boolean(blockRect&&coachRect.bottom>blockRect.top&&coachRect.top<blockRect.bottom),zeroTask:document.getElementById('zeroTask').textContent,sensorReadoutsHidden:!document.getElementById('liveReadouts'),targets:[...document.querySelectorAll('.drag-target:not(.is-hidden)')].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))}})()`);
      assert.equal(layout.presentation, "editable", `${label}: startup presentation`); assert.equal(layout.phase, "balance", `${label}: startup phase`); assert.equal(layout.resultHidden, true, `${label}: result starts hidden`); assert.equal(layout.touch, "pan-y", `${label}: stage touch action`); assert.ok(layout.html <= layout.inner + 1, `${label}: activity document is bounded`); assert.ok(layout.panelRange > 8, `${label}: panel has independent scroll range (${layout.panelRange}; client=${layout.panelClientHeight}, scroll=${layout.panelScrollHeight}, app=${layout.appHeight}, shell=${layout.shellHeight})`); assert.equal(layout.experimentOriginHidden, true, `${label}: Part A hides the B direct-pull target`); assert.match(layout.coach, /A1.*沒有水平拉力/s, `${label}: startup coach is actionable`); assert.match(layout.zeroTask, /摩擦力.*方向.*大小/s, `${label}: startup contains the A1 force-vector task`); assert.equal(layout.sensorReadoutsHidden, true, `${label}: Part A hides experiment readouts`); assert.ok(layout.targets.every((target) => target.w >= 44 && target.h >= 44), `${label}: touch targets are stable`); assert.equal(layout.coachBlockOverlap, false, `${label}: mobile stage guidance reserves space instead of covering the object (${JSON.stringify({ coachBottom: layout.coachBottom, blockTop: layout.blockTop })})`);
      const stage = await evaluate(cdp, "(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()"); await touch(cdp, stage, { x: stage.x, y: stage.y - 55 });
      await productionExperimentRegression(cdp, `${base}${launch}`, label);
      for (const [width, height, dpr] of [[1024, 768, 1], [2048, 1167, 2]]) await desktopSmoke(cdp, `${base}${launch}`, `${label} desktop ${width}x${height}@${dpr}`, width, height, dpr);
      await semanticSmoke(cdp, `${base}${launch}`, label);
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
