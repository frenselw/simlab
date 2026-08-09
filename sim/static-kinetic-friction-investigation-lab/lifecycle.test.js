"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const App = require("./main.js");
const Generator = require("./generator.js");
const Measurement = require("./measurement.js");
const Persistence = require("./persistence.js");
const Scoring = require("./scoring.js");
const Flow = require("../shared/activity-flow.js");
assert.equal(App.routeStartup({ state: "new" }, Flow), "editable");
assert.equal(App.routeStartup({ state: "draft" }, Flow), "editable");
assert.equal(App.routeStartup({ state: "finished" }, Flow), "review");
assert.equal(App.routeStartup({ state: "pending-final" }, Flow), "frozen");
assert.equal(App.routeStartup({ state: "read-error" }, Flow), "load-error");
for (const activityState of ["success", "committed", "frozen", "retry"]) { let called = ""; App.routeSubmission({ activityState }, Flow, { success: () => { called = "success"; }, committed: () => { called = "committed"; }, frozen: () => { called = "frozen"; }, retry: () => { called = "retry"; } }); assert.equal(called, activityState); }
assert.equal(App.mayRevealCorrectness("editable"), false);
assert.equal(App.mayRevealCorrectness("submitted-success"), true);
const scenario = Generator.generateScenario({ seed: 17 });
const slack = App.simulateBalanceRig(scenario, scenario.connector.restLengthM);
const low = App.simulateBalanceRig(scenario, scenario.connector.restLengthM + .005);
const high = App.simulateBalanceRig(scenario, scenario.connector.restLengthM + .010);
const crossed = App.simulateBalanceRig(scenario, scenario.connector.restLengthM + .030);
assert.equal(slack.reading.forceCN, 0);
assert.equal(low.physicsState.contact.mode, "static"); assert.equal(high.physicsState.contact.mode, "static");
assert.ok(high.reading.forceCN - low.reading.forceCN >= 100, "Part A readings come from physically separated static equilibria");
assert.equal(crossed.moved, true, "Part A can reject a target that has already produced breakaway");
assert.deepEqual(App.localExtremaIndices([]), []);
assert.deepEqual(App.localExtremaIndices([
  { measuredPullN: 0, measuredVelocityMps: 0 },
  { measuredPullN: 2, measuredVelocityMps: 1 },
  { measuredPullN: 1, measuredVelocityMps: 2 },
  { measuredPullN: 3, measuredVelocityMps: 1 },
  { measuredPullN: 2, measuredVelocityMps: 0 }
]), [1, 2, 3], "screen-reader navigation derives local extrema only from learner-visible samples");

const scormSource = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
function fakeRuntime(initial = {}) {
  const durable = { ...initial }; let buffer = { ...durable }; let lastError = "0";
  const control = { durable, commits: 0, finishes: 0, failCommitCall: 0, failFinish: false, failInitialize: false, failRead: "" };
  const api = {
    LMSInitialize: () => control.failInitialize ? "false" : "true",
    LMSGetValue(key) { if (control.failRead === key) { lastError = "101"; return ""; } lastError = "0"; return buffer[key] || ""; },
    LMSSetValue(key, value) { buffer[key] = String(value); lastError = "0"; return "true"; },
    LMSCommit() { control.commits += 1; if (control.commits === control.failCommitCall) { lastError = "101"; return "false"; } Object.assign(durable, buffer); lastError = "0"; return "true"; },
    LMSFinish() { control.finishes += 1; if (control.failFinish) { lastError = "101"; return "false"; } lastError = "0"; return "true"; },
    LMSGetLastError: () => lastError,
    LMSGetErrorString: () => "static-friction fake LMS failure"
  };
  const listeners = {}; const window = { API: api, opener: null, addEventListener(name, handler) { listeners[name] = handler; } };
  window.parent = window; window.top = window;
  vm.runInNewContext(scormSource, { window, console, JSON, TextEncoder });
  return { scorm: window.SimScorm, control, listeners };
}
const lifecycleSamples = Array.from({ length: 301 }, (_, i) => ({ timeS: i * .1, pullCN: i < 50 ? i * 12 : 500, velocityMMps: i < 50 ? 0 : i < 90 ? 100 : i < 110 ? 100 + (i - 90) * 6 : 220 }));
const lifecycleTrial = Measurement.packTrace({ regularSamples: lifecycleSamples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 19 } });
const lifecycleReview = Scoring.perfectAnswer(scenario, lifecycleTrial);
const lifecycleResult = Scoring.scoreAnswer(lifecycleReview, scenario);
const envelopeRuntime = fakeRuntime();
const reviewSnapshot = envelopeRuntime.scorm.makeSnapshot(App.ACTIVITY, "review", Persistence.encodeReview(lifecycleReview), lifecycleResult);
assert.deepEqual(Persistence.decodeSnapshot(reviewSnapshot, scenario, "review"), Persistence.normalizeReview(lifecycleReview), "production review envelope decodes to canonical authority");
assert.ok(envelopeRuntime.scorm.snapshotBytes(reviewSnapshot) <= 2800, "maximum production review envelope stays within the 2800-byte activity budget");

const reviewWithWorking = { ...Persistence.clone(lifecycleReview), working: Persistence.emptyWorking() };
const experimentReady = Persistence.transitions.redoExperiment(Persistence.transitions.enterReviewEdit(reviewWithWorking, "experiment", null));
const providerRuntime = fakeRuntime(); assert.equal(providerRuntime.scorm.loadAttempt(App.ACTIVITY).state, "new");
providerRuntime.scorm.setDraftProvider(() => providerRuntime.scorm.makeSnapshot(App.ACTIVITY, "draft", Persistence.encodeDraft(experimentReady)));
providerRuntime.listeners.pagehide({ persisted: false });
const runningCheckpointEnvelope = JSON.parse(providerRuntime.control.durable["cmi.suspend_data"]);
const restoredReady = Persistence.decodeSnapshot(runningCheckpointEnvelope, scenario, "draft");
assert.equal(restoredReady.phase, "experiment"); assert.equal(restoredReady.variant, "ready"); assert.equal(restoredReady.trial, null, "active recording is absent from the production draft provider checkpoint");
assert.equal(Persistence.transitions.acceptTrial(restoredReady, lifecycleTrial).variant, "accepted", "restored pre-record checkpoint has a legal continuation");

let callbackState = "";
const success = envelopeRuntime.scorm.submitWithCallbacks(lifecycleResult, reviewSnapshot, {
  onSuccess(outcome) { callbackState = App.routeSubmission(outcome, Flow, { success: () => "success", committed: () => "committed", frozen: () => "frozen", retry: () => "retry" }); },
  onFailure() { assert.fail("canonical submission must succeed"); }
});
assert.equal(success.activityState, "success"); assert.equal(callbackState, "success");
const finishedAttempt = fakeRuntime(envelopeRuntime.control.durable).scorm.loadAttempt(App.ACTIVITY);
assert.equal(finishedAttempt.state, "finished");
const finishedController = App.createController(); assert.equal(finishedController.routeAttempt(finishedAttempt), true); assert.equal(finishedController.getPresentation(), "trusted-finished-review"); assert.deepEqual(finishedController.getResult(), lifecycleResult);

const committedRuntime = fakeRuntime(); committedRuntime.control.failFinish = true;
let committedState = "";
const committed = committedRuntime.scorm.submitWithCallbacks(lifecycleResult, committedRuntime.scorm.makeSnapshot(App.ACTIVITY, "review", Persistence.encodeReview(lifecycleReview), lifecycleResult), {
  onSuccess() { assert.fail("finish failure is not full success"); },
  onFailure(outcome) { committedState = outcome.activityState; }
});
assert.equal(committed.activityState, "committed"); assert.equal(committedState, "committed");
committedRuntime.control.failFinish = false; assert.equal(committedRuntime.scorm.retryFinish().ok, true); assert.equal(committedRuntime.scorm.retryPending().reason, "no-pending");

function makeFrozenRuntime() {
  const runtime = fakeRuntime(); runtime.control.failCommitCall = 2;
  const snapshot = runtime.scorm.makeSnapshot(App.ACTIVITY, "review", Persistence.encodeReview(lifecycleReview), lifecycleResult);
  const outcome = runtime.scorm.submitResult(lifecycleResult, snapshot); assert.equal(outcome.frozen, true); assert.equal(JSON.parse(runtime.control.durable["cmi.suspend_data"]).kind, "pending-final");
  return runtime;
}
const frozenRuntime = makeFrozenRuntime();
assert.ok(Buffer.byteLength(frozenRuntime.control.durable["cmi.suspend_data"], "utf8") <= 4000, "production submitWithCallbacks pending checkpoint, including escaped reviewJson, fits 4000 bytes");
const pendingAttempt = fakeRuntime(frozenRuntime.control.durable).scorm.loadAttempt(App.ACTIVITY);
assert.equal(pendingAttempt.state, "pending-final");
function auditPending(snapshot) {
  let quarantines = 0; let retries = 0;
  global.SimScorm = { retryPending() { retries += 1; return { ok: false, committed: false }; }, quarantinePending() { quarantines += 1; return true; } };
  const controller = App.createController(); const accepted = controller.routeAttempt({ state: "pending-final", snapshot });
  delete global.SimScorm;
  return { accepted, quarantines, retries, presentation: controller.getPresentation() };
}
const validPendingAudit = auditPending(pendingAttempt.snapshot);
assert.deepEqual(validPendingAudit, { accepted: false, quarantines: 0, retries: 1, presentation: "frozen" }, "canonical pending checkpoint reaches only the retry path");
const mutatePending = (mutator) => { const snapshot = JSON.parse(JSON.stringify(pendingAttempt.snapshot)); mutator(snapshot); return snapshot; };
const canonicalMismatch = mutatePending((snapshot) => { const nested = JSON.parse(snapshot.payload.reviewJson); nested.answer.q = "noncanonical-review-variant"; snapshot.payload.reviewJson = JSON.stringify(nested); });
assert.deepEqual(auditPending(canonicalMismatch), { accepted: false, quarantines: 1, retries: 0, presentation: "frozen" }, "noncanonical nested review is quarantined");
const scoreMismatch = mutatePending((snapshot) => { snapshot.payload.score += 1; });
assert.equal(auditPending(scoreMismatch).quarantines, 1, "pending score mismatch is quarantined");
const statusMismatch = mutatePending((snapshot) => { snapshot.payload.passed = !snapshot.payload.passed; });
assert.equal(auditPending(statusMismatch).quarantines, 1, "pending pass/status mismatch is quarantined");
const invalidNested = mutatePending((snapshot) => { snapshot.payload.reviewJson = "{}"; });
assert.equal(auditPending(invalidNested).quarantines, 1, "invalid nested pending review is quarantined");
const quarantineRuntime = makeFrozenRuntime(); const durableDiagnostic = quarantineRuntime.control.durable["cmi.suspend_data"];
assert.equal(quarantineRuntime.scorm.quarantinePending(), true); assert.equal(quarantineRuntime.scorm.retryPending().reason, "no-pending", "quarantine clears in-memory retry authority");
assert.equal(quarantineRuntime.control.durable["cmi.suspend_data"], durableDiagnostic, "quarantine preserves the durable pending diagnostic without rewriting untrusted payloads");

const retryableRuntime = fakeRuntime(); retryableRuntime.control.failInitialize = true; let retryableCallback = "";
const retryableOutcome = retryableRuntime.scorm.submitWithCallbacks(lifecycleResult, retryableRuntime.scorm.makeSnapshot(App.ACTIVITY, "review", Persistence.encodeReview(lifecycleReview), lifecycleResult), {
  onSuccess() { assert.fail("initialize failure cannot succeed"); },
  onFailure(outcome) { retryableCallback = App.routeSubmission(outcome, Flow, { success: () => "success", committed: () => "committed", frozen: () => "frozen", retry: () => "retry" }); }
});
assert.equal(retryableOutcome.activityState, "retry"); assert.equal(retryableOutcome.retryable, true); assert.equal(retryableCallback, "retry", "production callback routes retryable retry without locking a result");

const retryRuntime = fakeRuntime();
const retryOutcome = retryRuntime.scorm.submitWithCallbacks(lifecycleResult, null, { onSuccess() { assert.fail("invalid review cannot succeed"); }, onFailure() {} });
assert.equal(retryOutcome.activityState, "retry"); assert.equal(retryOutcome.retryable, false, "preflight failure is a non-retryable technical outcome");
const readFailureRuntime = fakeRuntime(); readFailureRuntime.control.failRead = "cmi.suspend_data";
assert.equal(App.routeStartup(readFailureRuntime.scorm.loadAttempt(App.ACTIVITY), Flow), "load-error");
const unfinishedReview = { ...envelopeRuntime.control.durable, "cmi.core.lesson_status": "mystery", "cmi.suspend_data": JSON.stringify(reviewSnapshot) };
assert.equal(App.routeStartup(fakeRuntime(unfinishedReview).scorm.loadAttempt(App.ACTIVITY), Flow), "load-error", "unknown unfinished Moodle status cannot expose a review result");
console.log("Static/kinetic friction lifecycle checks passed");
