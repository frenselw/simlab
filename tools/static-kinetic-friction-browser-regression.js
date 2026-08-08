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
async function tapSelector(cdp, selector) {
  const point = await evaluate(cdp, `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) throw new Error(${JSON.stringify(`missing selector: ${selector}`)}); node.scrollIntoView({ block: 'center', inline: 'center' }); const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await delay(80); await tap(cdp, point);
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
    const samples = Array.from({ length: 301 }, (_, i) => ({ timeS: i * .04, pullCN: i < 50 ? i * 12 : 500, velocityMMps: i < 50 ? 0 : i < 90 ? 100 : i < 110 ? 100 + (i - 90) * 6 : 220 }));
    const trial = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 49 } });
    let state = P.freshState(scenario.seed);
    const opposite = scenario.balancePullDirection === 'left' ? 'right' : 'left';
    state = P.transitions.setZeroForceAnswer(state, { frictionType: 'none', direction: 'none', frictionMagnitudeCN: 0, committed: true });
    state = P.transitions.setStaticForceAnswer(state, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN, committed: true }, { frictionType: 'static', direction: opposite, frictionMagnitudeCN: scenario.balancePullCN, committed: true });
    state = P.transitions.recordBreakawayTrial(state, { direction: scenario.balancePullDirection, pullCN: Math.ceil(scenario.staticLimitMeanN * 10) * 10 });
    state = P.transitions.setBreakawayAnswer(state, Math.round(scenario.staticLimitMeanN * 100));
    state = P.transitions.setPhase(state, 'experiment'); state = P.transitions.acceptTrial(state, trial); state = P.transitions.setPhase(state, 'analysis');
    const candidates = M.findCandidateWindows(trial);
    const tasks = [
      ['staticInterval', { ...candidates.static[0], frictionType: 'static', relation: 'equal' }],
      ['breakaway', { markerIndex: 50, estimatedFsMaxCN: 600, identifiedAs: 'maximum-static-friction' }],
      ['slowPlateau', { ...candidates.slow[0], estimatedFkCN: 500 }],
      ['acceleration', { ...candidates.acceleration[0], relation: 'pull-greater', pullEqualsFk: 'no' }],
      ['fastPlateau', { ...candidates.fast[0], estimatedFkCN: 500, speedComparison: 'same-average' }]
    ];
    for (let index = 0; index < ${activeIndex}; index += 1) { state = P.transitions.setAnalysisTask(state, tasks[index][0], tasks[index][1]); state = P.transitions.advanceAnalysisTask(state); }
    const snapshot = { version: 1, activity: '${slug}', kind: 'draft', answer: P.encodeDraft(state) };
    window.__staticKineticFrictionApp.routeAttempt({ state: 'draft', snapshot });
    window.__frictionFixture = { scenario, trial, candidates };
    return window.__staticKineticFrictionApp.getState();
  })()`;
}
async function semanticSmoke(cdp, url, label) {
  await navigate(cdp, url);
  await evaluate(cdp, `(() => { const set=(id,value,eventName='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event(eventName,{bubbles:true}))}; set('zeroFrictionType','none');set('zeroFrictionDirection','none');set('zeroFrictionMagnitude','0','input');return true; })()`);
  await tapSelector(cdp, "[data-action='save-zero-force']");
  const a1 = await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.zeroForce");
  assert.deepEqual(a1, { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, committed: true }, `${label}: A1 stores explicit zero friction`);
  await evaluate(cdp, `(() => { const set=(id,value,eventName='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event(eventName,{bubbles:true}))}; set('zeroFrictionType','static');set('zeroFrictionDirection','right');set('zeroFrictionMagnitude','0.1','input');document.querySelector('[data-action="save-zero-force"]').click();return true; })()`);
  const resetByA1 = await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.staticCase");
  assert.equal(resetByA1, null, `${label}: changing a saved A1 answer clears the dependent A2 answer`);
  await evaluate(cdp, `(() => { const set=(id,value,eventName='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event(eventName,{bubbles:true}))}; set('zeroFrictionType','none');set('zeroFrictionDirection','none');set('zeroFrictionMagnitude','0','input');document.querySelector('[data-action="save-zero-force"]').click();return true; })()`);
  const staticSetup = await evaluate(cdp, `(() => { const scenario=window.StaticKineticFrictionGenerator.generateScenario({seed:window.__staticKineticFrictionApp.getState().seed}); return {direction:scenario.balancePullDirection,magnitudeCN:scenario.balancePullCN,opposite:scenario.balancePullDirection==='left'?'right':'left'}; })()`);
  const forceEndpoint = async (magnitudeN, direction) => evaluate(cdp, `(() => { const node=document.getElementById('balanceOrigin'),svg=document.getElementById('apparatusSvg'); const r=node.getBoundingClientRect(),s=svg.getBoundingClientRect().width/900; return { start:{x:r.left+r.width/2,y:r.top+r.height/2}, end:{x:r.left+r.width/2+${direction === "left" ? -1 : 1}*${magnitudeN}*18*s,y:r.top+r.height/2} }; })()`);
  await tapSelector(cdp, "#draw-applied");
  let drag = await forceEndpoint(staticSetup.magnitudeCN / 100, staticSetup.direction); await touch(cdp, drag.start, drag.end);
  await tapSelector(cdp, "#draw-friction");
  drag = await forceEndpoint(staticSetup.magnitudeCN / 100, staticSetup.opposite); await touch(cdp, drag.start, drag.end);
  const drawnBalance = await evaluate(cdp, `(() => ({ arrows:document.querySelectorAll('.pull-arrow,.learner-friction-arrow').length, sigma:document.getElementById('balanceNetForce').textContent }))()`);
  assert.ok(drawnBalance.arrows >= 2 && /ΣFx/.test(drawnBalance.sigma), `${label}: Part A renders centre-of-mass force arrows and net force ${JSON.stringify(drawnBalance)}`);
  await tapSelector(cdp, "[data-action='save-static-force']");
  let balance = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(); return { staticCase:state.balance.staticCase, arrows:document.querySelectorAll('.pull-arrow,.learner-friction-arrow').length, sigma:document.getElementById('balanceNetForce').textContent, forceGripHidden:document.getElementById('forceGrip').classList.contains('is-hidden'), phase:state.phase }; })()`);
  assert.equal(balance.staticCase.learnerAppliedForce.direction, staticSetup.direction, `${label}: A2 stores the direction of the directly drawn applied force`);
  assert.equal(balance.staticCase.learnerAppliedForce.magnitudeCN, staticSetup.magnitudeCN, `${label}: A2 stores the directly drawn applied force magnitude`);
  assert.equal(balance.staticCase.learnerForce.direction, staticSetup.opposite, `${label}: A2 friction direction is opposite the drawn applied force`);
  await tapSelector(cdp, "#draw-applied");
  drag = await forceEndpoint(staticSetup.magnitudeCN / 100 + .2, staticSetup.direction); await touch(cdp, drag.start, drag.end);
  await tapSelector(cdp, "[data-action='save-static-force']");
  const a2Edited = await evaluate(cdp, "window.__staticKineticFrictionApp.getState()");
  assert.equal(a2Edited.balance.breakaway.bestPullCN, null, `${label}: changing a saved A2 answer clears the dependent A3 trial`);
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
  await tapSelector(cdp, `[data-action='pull-${staticSetup.direction}']`);
  let blockBefore = await evaluate(cdp, "document.querySelector('.apparatus-block')?.getAttribute('x')");
  for (let n = 20; n < threshold; n += 20) { drag = await forceEndpoint(n / 100, staticSetup.direction); await touch(cdp, drag.start, drag.end); }
  drag = await forceEndpoint(threshold / 100, staticSetup.direction); await touch(cdp, drag.start, drag.end);
  await delay(100);
  const breakaway = await evaluate(cdp, "window.__staticKineticFrictionApp.getState().balance.breakaway");
  assert.ok(breakaway.bestPullCN >= threshold && breakaway.attempts >= 1, `${label}: A3 records a breakaway trial after gradual force increase`);
  const motion = await evaluate(cdp, `(() => ({pull:document.getElementById('breakawayPullValue').textContent,status:document.getElementById('breakawayMotionStatus').textContent,friction:document.querySelectorAll('.learner-friction-arrow').length,arrow:document.querySelectorAll('.pull-arrow').length,block:document.querySelector('.apparatus-block')?.getAttribute('x')}))()`);
  assert.equal(motion.friction, 0, `${label}: A3 does not display static friction`);
  assert.ok(motion.arrow >= 1 && /滑動並加速/.test(motion.status) && motion.block !== blockBefore, `${label}: A3 shows the pull arrow and motion after breakaway ${JSON.stringify(motion)}`);
  await evaluate(cdp, "document.getElementById('breakawayAnswer').value=(window.StaticKineticFrictionGenerator.generateScenario({seed:window.__staticKineticFrictionApp.getState().seed}).staticLimitMeanN).toFixed(1)");
  await tapSelector(cdp, "[data-action='save-breakaway-answer']");
  assert.equal(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().variant"), "answer-complete", `${label}: all three Part A tasks complete`);
  await tapSelector(cdp, "#to-experiment");
  assert.equal(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().phase"), "experiment", `${label}: sequential Part A continues legally`);
  await tapSelector(cdp, "#startRecording");
  const interrupted = await evaluate(cdp, `(() => { window.dispatchEvent(new Event('pagehide')); const raw=window.SimScorm.getLocalLog().filter(item=>item.key==='cmi.suspend_data').at(-1)?.value;const snapshot=JSON.parse(raw);window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot});const state=window.__staticKineticFrictionApp.getState();return {checkpointPhase:snapshot.answer.p,checkpointVariant:snapshot.answer.q,phase:state.phase,variant:state.variant,trial:state.trial,status:document.getElementById('experimentStatus').textContent,running:window.__staticKineticFrictionApp.interactionEvidence().recorderRunning,startDisabled:document.getElementById('startRecording').disabled}; })()`);
  assert.deepEqual(interrupted, { checkpointPhase: "experiment", checkpointVariant: "ready", phase: "experiment", variant: "ready", trial: null, status: "上次實驗記錄未完成，請重新開始這次記錄。", running: false, startDisabled: false }, `${label}: active recording restores the pre-record checkpoint with an interruption message and legal restart`);

  await evaluate(cdp, analysisFixtureScript(0));
  const blankAnalysis = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),Graph=window.StaticKineticFrictionGraph,M=window.StaticKineticFrictionMeasurement,svg=document.getElementById('graphSvg'),handle=document.getElementById('static-start'),sample=M.unpackTrace(state.trial).merged[0],sr=svg.getBoundingClientRect(),hr=handle.getBoundingClientRect(),expected=sr.left+Graph.timeToX(sample.timeS)/820*sr.width;return { type: document.querySelector('[data-analysis-task="staticInterval"] [data-analysis-field="frictionType"]').value, relation: document.querySelector('[data-analysis-task="staticInterval"] [data-analysis-field="relation"]').value, graphInStage: document.getElementById('stage').contains(svg), handleDelta:Math.abs(hr.left+hr.width/2-expected), visible: [...document.querySelectorAll('.drag-target:not(.is-hidden)')].map(node=>node.dataset.dragTarget) } })()`);
  assert.equal(blankAnalysis.type, "", `${label}: C1 type starts explicitly blank`); assert.equal(blankAnalysis.relation, "", `${label}: C1 relation starts explicitly blank`);
  assert.equal(blankAnalysis.graphInStage, true, `${label}: graph and handles share the stage coordinate space`);
  assert.ok(blankAnalysis.handleDelta <= 4, `${label}: graph handle is spatially aligned with its sample (${blankAnalysis.handleDelta}px)`);
  assert.deepEqual(blankAnalysis.visible.sort(), ["static-end", "static-start"], `${label}: only active graph handles are exposed`);
  await pressKeyOn(cdp, "#static-start", "ArrowRight");
  const partial = await evaluate(cdp, `(() => { const app=window.__staticKineticFrictionApp,P=window.StaticKineticFrictionPersistence;const state=app.getState();window.__analysisSnapshot={version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(state)};app.routeAttempt({state:'draft',snapshot:window.__analysisSnapshot});const restored=app.getState();return {variant:restored.variant,active:restored.working.activeAnalysisTask,future:P.ANALYSIS_KEYS.slice(1).every(key=>restored.analysis[key]===null)} })()`);
  assert.deepEqual(partial, { variant: "selection-only", active: 0, future: true }, `${label}: graph handle persists and restores only the active partial task`);
  await evaluate(cdp, `(() => { const set=(field,value)=>{const node=document.querySelector('[data-analysis-task="staticInterval"] [data-analysis-field="'+field+'"]');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}))};set('frictionType','static');set('relation','equal');return true })()`);
  await tapSelector(cdp, "[data-action='save-analysis']");
  const continued = await evaluate(cdp, `(() => ({active:window.__staticKineticFrictionApp.getState().working.activeAnalysisTask,blank:document.querySelector('[data-analysis-task="breakaway"] [data-analysis-field="identifiedAs"]').value,visible:[...document.querySelectorAll('.drag-target:not(.is-hidden)')].map(node=>node.dataset.dragTarget)}))()`);
  assert.equal(continued.active, 1, `${label}: restored partial analysis executes its legal continuation`); assert.equal(continued.blank, "", `${label}: C2 authority enum starts null`); assert.deepEqual(continued.visible, ["breakaway-marker"], `${label}: active marker alone is exposed and aligned to graph stage`);

  await evaluate(cdp, `(() => { const S=window.StaticKineticFrictionScoring,P=window.StaticKineticFrictionPersistence;const perfect={...S.perfectAnswer(window.__frictionFixture.scenario,window.__frictionFixture.trial),working:P.emptyWorking()};const snapshot={version:1,activity:'${slug}',kind:'draft',answer:P.encodeDraft(perfect)};window.__staticKineticFrictionApp.routeAttempt({state:'draft',snapshot});window.__reviewAuthority=JSON.stringify({analysis:perfect.analysis,predictions:perfect.predictions});return true })()`);
  await tapSelector(cdp, "[data-action='edit-analysis'][data-analysis-key='slowPlateau']"); await pressKeyOn(cdp, "#slow-start", "ArrowRight"); await tapSelector(cdp, "#cancelReviewEdit");
  assert.equal(await evaluate(cdp, "JSON.stringify({analysis:window.__staticKineticFrictionApp.getState().analysis,predictions:window.__staticKineticFrictionApp.getState().predictions})===window.__reviewAuthority"), true, `${label}: cancelling graph review edit restores immutable authority`);
  await tapSelector(cdp, "[data-action='edit-predict'][data-prediction-index='1']");
  const predictionVisualBefore = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),r=document.getElementById('predictionFriction').getBoundingClientRect();return {magnitude:state.predictions[1].magnitudeCN,handleX:r.left+r.width/2,arrow:Boolean(document.querySelector('.prediction-friction-arrow')),readout:document.getElementById('predictionReadout').textContent} })()`);
  await pressKeyOn(cdp, "#predictionFriction", "ArrowRight");
  const predictionDraft = await evaluate(cdp, `(() => { const state=window.__staticKineticFrictionApp.getState(),r=document.getElementById('predictionFriction').getBoundingClientRect();return {target:state.working.reviewEditTarget.semanticKey,authority:state.predictions[1].magnitudeCN,draft:state.working.editDraft.value.magnitudeCN,handleX:r.left+r.width/2,arrow:Boolean(document.querySelector('.prediction-friction-arrow')),readout:document.getElementById('predictionReadout').textContent} })()`);
  const beforePrediction = predictionVisualBefore.magnitude;
  assert.equal(predictionDraft.target, 1, `${label}: prediction drag targets the active semantic card`); assert.equal(predictionDraft.authority, beforePrediction, `${label}: prediction review drag leaves authority immutable`); assert.notEqual(predictionDraft.draft, beforePrediction, `${label}: prediction drag persists a working draft`);
  assert.equal(predictionVisualBefore.arrow && predictionDraft.arrow, true, `${label}: Part D renders the learner friction arrow`); assert.notEqual(predictionDraft.handleX, predictionVisualBefore.handleX, `${label}: Part D arrowhead moves with learner magnitude`); assert.match(predictionDraft.readout, /你的摩擦力/, `${label}: Part D stage exposes learner-readable force text`);
  await evaluate(cdp, `(() => { const input=document.querySelector('[data-prediction-index="1"] [data-prediction-field="magnitudeCN"]');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));return true })()`);
  await tapSelector(cdp, "[data-prediction-index='1'] [data-action='save-prediction']");
  const validation = await evaluate(cdp, `(() => { const node=document.getElementById('validationStatus');return {visible:!node.classList.contains('is-hidden'),text:node.textContent,focused:document.activeElement===node} })()`);
  assert.equal(validation.visible, true, `${label}: invalid prediction shows a visible validation message`); assert.match(validation.text, /摩擦力類型.*方向.*大小.*運動結果/, `${label}: validation message identifies all required fields`); assert.equal(validation.focused, true, `${label}: validation error has a deterministic screen-reader focus target`);
  await tapSelector(cdp, "#cancelReviewEdit");
  await tapSelector(cdp, "[data-action='edit-experiment']");
  const redoPrompt = await evaluate(cdp, `(() => ({phase:window.__staticKineticFrictionApp.getState().phase,fromReview:window.__staticKineticFrictionApp.getState().fromReview,visible:!document.getElementById('redoExperimentConfirm').classList.contains('is-hidden'),runHidden:document.getElementById('experimentRunActions').classList.contains('is-hidden')}))()`);
  assert.deepEqual(redoPrompt, { phase: "experiment", fromReview: true, visible: true, runHidden: true }, `${label}: review redo requires a neutral confirmation and hides normal navigation`);
  await tapSelector(cdp, "[data-action='cancel-redo-experiment']");
  assert.equal(await evaluate(cdp, "window.__staticKineticFrictionApp.getState().phase"), "review", `${label}: cancelling redo returns to unchanged review`);
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
      gripHidden: document.getElementById('forceGrip').classList.contains('is-hidden'),
      coach: document.getElementById('stageCoach').textContent,
      zeroTask: document.getElementById('zeroTask').textContent,
      sensorReadoutsHidden: document.getElementById('liveReadouts').classList.contains('is-hidden'),
      explanation: document.querySelector('.first-step-explanation').textContent,
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
  assert.equal(layout.gripHidden, true, `${label}: Part A does not expose a measurement grip`);
  assert.match(layout.coach, /A1.*沒有水平外力/s, `${label}: startup coach names the zero-horizontal-force task`);
  assert.match(layout.zeroTask, /摩擦力.*方向.*大小/s, `${label}: A1 asks for friction type, direction and magnitude`);
  assert.equal(layout.sensorReadoutsHidden, true, `${label}: Part A hides experiment readouts`);
  assert.match(layout.explanation, /不使用測力計.*歸零/s, `${label}: Part A explicitly removes instrument calibration`);
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
  const prepared = await frameEvaluate(cdp, `(() => {
    const state=window.__staticKineticFrictionApp.getState();
    return {zero:state.balance.zeroForce,gripHidden:document.getElementById('forceGrip').classList.contains('is-hidden'),originHidden:document.getElementById('balanceOrigin').classList.contains('is-hidden')};
  })()`);
  assert.deepEqual(prepared, { zero: null, gripHidden: true, originHidden: true }, `${label}: Part A startup exposes only the A1 control task`);
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
    return {stage:{left:stage.left,right:stage.right,width:stage.width},panel:{left:panel.left,right:panel.right,width:panel.width},headerHeight:header.height,dpr:devicePixelRatio,docWidth:document.documentElement.scrollWidth,innerWidth,gripHidden:document.getElementById('forceGrip').classList.contains('is-hidden'),coach:document.getElementById('stageCoach').textContent,zeroTask:document.getElementById('zeroTask').textContent,explanation:document.querySelector('.first-step-explanation').textContent,textInside:text.every(rect=>rect.left>=stage.left-2&&rect.right<=stage.right+2)};
  })()`);
  assert.equal(layout.stage.left, 0, `${label}: desktop stage starts at the left edge`);
  assert.ok(layout.stage.right <= layout.panel.left + 1, `${label}: desktop stage precedes the control panel visually`);
  assert.ok(layout.stage.width >= layout.panel.width * 1.35, `${label}: desktop stage remains the primary visual region (${layout.stage.width}/${layout.panel.width})`);
  assert.ok(layout.panel.right <= width + 1 && layout.panel.width >= 384 && layout.panel.width <= 513, `${label}: desktop control panel stays within its bounded width`);
  assert.ok(layout.headerHeight >= 90, `${label}: high-density desktop does not trigger the short-screen header (${layout.headerHeight}px at dpr ${layout.dpr})`);
  assert.ok(layout.docWidth <= layout.innerWidth + 1, `${label}: desktop has no horizontal document overflow`);
  assert.equal(layout.textInside, true, `${label}: apparatus labels remain inside the stage`);
  assert.equal(layout.gripHidden, true, `${label}: desktop Part A hides the experiment grip`);
  assert.match(layout.coach, /A1.*沒有水平外力/s, `${label}: desktop coach shows the zero-force task`);
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
      const layout = await evaluate(cdp, `(()=>{const stage=document.getElementById('stage'),panel=document.getElementById('controlPanel'),app=document.getElementById('app'),shell=document.querySelector('.friction-shell');return {presentation:window.__staticKineticFrictionApp.getPresentation(),phase:window.__staticKineticFrictionApp.getState().phase,resultHidden:document.getElementById('resultPanel').classList.contains('is-hidden'),touch:getComputedStyle(stage).touchAction,html:document.documentElement.scrollHeight,inner:innerHeight,panelRange:panel.scrollHeight-panel.clientHeight,panelClientHeight:panel.clientHeight,panelScrollHeight:panel.scrollHeight,appHeight:app.getBoundingClientRect().height,shellHeight:shell.getBoundingClientRect().height,gripHidden:document.getElementById('forceGrip').classList.contains('is-hidden'),coach:document.getElementById('stageCoach').textContent,zeroTask:document.getElementById('zeroTask').textContent,sensorReadoutsHidden:document.getElementById('liveReadouts').classList.contains('is-hidden'),targets:[...document.querySelectorAll('.drag-target:not(.is-hidden)')].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))}})()`);
      assert.equal(layout.presentation, "editable", `${label}: startup presentation`); assert.equal(layout.phase, "balance", `${label}: startup phase`); assert.equal(layout.resultHidden, true, `${label}: result starts hidden`); assert.equal(layout.touch, "pan-y", `${label}: stage touch action`); assert.ok(layout.html <= layout.inner + 1, `${label}: activity document is bounded`); assert.ok(layout.panelRange > 8, `${label}: panel has independent scroll range (${layout.panelRange}; client=${layout.panelClientHeight}, scroll=${layout.panelScrollHeight}, app=${layout.appHeight}, shell=${layout.shellHeight})`); assert.equal(layout.gripHidden, true, `${label}: Part A hides the experiment grip`); assert.match(layout.coach, /A1.*沒有水平外力/s, `${label}: startup coach is actionable`); assert.match(layout.zeroTask, /摩擦力.*方向.*大小/s, `${label}: startup contains the A1 force-vector task`); assert.equal(layout.sensorReadoutsHidden, true, `${label}: Part A hides experiment readouts`); assert.ok(layout.targets.every((target) => target.w >= 44 && target.h >= 44), `${label}: touch targets are stable`);
      const stage = await evaluate(cdp, "(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()"); await touch(cdp, stage, { x: stage.x, y: stage.y - 55 });
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
