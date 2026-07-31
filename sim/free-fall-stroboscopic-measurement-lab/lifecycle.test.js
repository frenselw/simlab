"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const App = require("./main.js");
const M = require("./model.js");
const P = require("./persistence.js");
const S = require("./scoring.js");
const fixture = require("./persistence.test.js");

const source = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
const activityFlow = require("../shared/activity-flow.js");
const activity = App.ACTIVITY;
const review = P.decodeReview(fixture.review);
const result = S.scoreAttempt(review);
function completeReview(frequency) {
  const placement = (state, task) => {
    const gapIndex = S.GAP_KEYS.indexOf(task);
    return {
      mode: "keyboard", moveNorm: .03,
      rulerZeroM: gapIndex >= 0 ? M.displacementAt(frequency, gapIndex) : 0,
      rulerX: 100, rulerSide: "left", rulerGeometry: "fixed-left-v1",
      horizontalMode: "guide-fraction", guideFraction: 20 / 205,
      zeroTickOverlapPx: 23, zeroErrorPx: 0
    };
  };
  let state = P.generate(P.assignedState(frequency));
  state = P.withPlacement(state, placement(state, "total"));
  for (let index = 0; index < 4; index += 1) {
    state = P.resolveMeasurement(state, M.displacementAt(frequency, index + 1));
  }
  for (let index = 0; index < 4; index += 1) {
    const task = S.GAP_KEYS[index];
    state = P.resolveMeasurement(P.withPlacement(state, placement(state, task)),
      M.intervalDisplacement(frequency, index + 1));
  }
  return P.makeReview(P.enterReview(P.setAnalysis(state, {
    deltaTS: 1 / frequency,
    cumulativeTimeRatio: { values: [1, 2, 3, 4] },
    intervalTimeRatio: { values: [1, 1, 1, 1] },
    lawAnswerId: "square", intervalLawAnswerId: "odd", accelerationAnswerId: "constant-acceleration"
  })));
}
const review6 = completeReview(6);
const result6 = S.scoreAttempt(review6);
const review8 = completeReview(8);
const result8 = S.scoreAttempt(review8);
assert.deepEqual({ score: result8.score, passed: result8.passed, process: result8.detail.process.points },
  { score: 100, passed: true, process: 40 });

function fakeRuntime(initial = {}) {
  const durable = { ...initial };
  let buffer = { ...durable };
  let lastError = "0";
  const control = { failCommitCall: 0, failFinish: false, failRead: "", failSet: "", commits: 0, finishes: 0, durable };
  const api = {
    LMSInitialize: () => "true",
    LMSGetValue(key) {
      if (control.failRead === key) { lastError = "101"; return ""; }
      lastError = "0"; return buffer[key] || "";
    },
    LMSSetValue(key, value) {
      if (control.failSet === key) { lastError = "101"; return "false"; }
      buffer[key] = String(value); lastError = "0"; return "true";
    },
    LMSCommit() {
      control.commits += 1;
      if (control.commits === control.failCommitCall) { lastError = "101"; return "false"; }
      Object.assign(durable, buffer); lastError = "0"; return "true";
    },
    LMSFinish() {
      control.finishes += 1;
      if (control.failFinish) { lastError = "101"; return "false"; }
      lastError = "0"; return "true";
    },
    LMSGetLastError: () => lastError,
    LMSGetErrorString: () => "fake lifecycle failure"
  };
  const listeners = {};
  const window = { API: api, opener: null, addEventListener(name, handler) { listeners[name] = handler; } };
  window.parent = window; window.top = window;
  vm.runInNewContext(source, { window, console, JSON, TextEncoder });
  return { scorm: window.SimScorm, control, listeners };
}

const newRun = fakeRuntime();
assert.equal(activityFlow.startup(newRun.scorm.loadAttempt(activity)), "editable");
const draftSnapshot = newRun.scorm.makeSnapshot(activity, "draft", P.initialState());
assert.equal(newRun.scorm.saveDraft(draftSnapshot), true);
const restoredDraft = fakeRuntime(newRun.control.durable);
assert.equal(activityFlow.startup(restoredDraft.scorm.loadAttempt(activity)), "editable");

const successRun = fakeRuntime();
const reviewSnapshot = successRun.scorm.makeSnapshot(activity, "review", review, result);
let callbackState = "";
const success = successRun.scorm.submitWithCallbacks(result, reviewSnapshot, {
  onSuccess: (outcome) => { callbackState = activityFlow.submission(outcome, { success: () => "success", committed: () => "committed", frozen: () => "frozen", retry: () => "retry" }); },
  onFailure: () => assert.fail("success path must not fail")
});
assert.equal(success.activityState, "success");
assert.equal(callbackState, "success");
assert.equal(JSON.parse(successRun.control.durable["cmi.suspend_data"]).kind, "review");

const success8Run = fakeRuntime();
const snapshot8 = success8Run.scorm.makeSnapshot(activity, "review", review8, result8);
assert.equal(success8Run.scorm.submitResult(result8, snapshot8).ok, true);
const durable8 = JSON.parse(success8Run.control.durable["cmi.suspend_data"]);
assert.equal(durable8.answer.frequencyHz, 8);
assert.deepEqual(S.scoreAttempt(P.decodeReview(durable8.answer)), result8,
  "8 Hz durable SCORM review decodes and rescores identically");
const restored8Run = fakeRuntime(success8Run.control.durable);
assert.equal(activityFlow.startup(restored8Run.scorm.loadAttempt(activity)), "review",
  "8 Hz durable SCORM round-trip restores the finished review");

const committedRun = fakeRuntime();
committedRun.control.failFinish = true;
const committedSnapshot = committedRun.scorm.makeSnapshot(activity, "review", review, result);
let committedOutcome;
committedRun.scorm.submitWithCallbacks(result, committedSnapshot, {
  onSuccess: () => assert.fail("finish failure is not full success"),
  onFailure: (outcome) => { committedOutcome = outcome; }
});
assert.equal(committedOutcome.activityState, "committed");
assert.equal(App.submissionView(committedOutcome).retry, "finish");
assert.equal(committedRun.control.finishes, 1);
committedRun.control.failFinish = false;
assert.equal(committedRun.scorm.finish(), true, "committed recovery calls the real LMSFinish path");
assert.equal(committedRun.control.finishes, 2);
assert.equal(committedRun.scorm.retryPending().reason, "no-pending", "committed recovery never retries a pending payload");

const frozenRun = fakeRuntime();
frozenRun.control.failCommitCall = 2;
const frozenSnapshot = frozenRun.scorm.makeSnapshot(activity, "review", review, result);
const frozen = frozenRun.scorm.submitResult(result, frozenSnapshot);
assert.equal(frozen.frozen, true);
const pending = JSON.parse(frozenRun.control.durable["cmi.suspend_data"]);
assert.equal(pending.kind, "pending-final");
assert.equal(App.canonicalReviewMatches(review, pending.payload, result), true);
assert.equal(App.canonicalReviewMatches(review, { ...pending.payload, maxScore: 99 }, result), false);

const validBoundaryReview = JSON.parse(JSON.stringify(review));
Object.assign(validBoundaryReview.evidence.totalPlacement, {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 4, zeroTickOverlapPx: 4
});
delete validBoundaryReview.evidence.totalPlacement.guideFraction;
Object.assign(validBoundaryReview.evidence.gap01, {
  rulerX: 310, rulerSide: "right", horizontalMode: "right-boundary",
  boundaryOverlapPx: 4, zeroTickOverlapPx: 4
});
delete validBoundaryReview.evidence.gap01.guideFraction;
assert.ok(P.decodeReview(validBoundaryReview), "canonical left/right boundary review remains valid");
const validBoundaryResult = S.scoreAttempt(validBoundaryReview);
const validBoundaryRun = fakeRuntime();
validBoundaryRun.control.failCommitCall = 2;
const validBoundarySnapshot = validBoundaryRun.scorm.makeSnapshot(
  activity, "review", validBoundaryReview, validBoundaryResult);
assert.equal(validBoundaryRun.scorm.submitResult(validBoundaryResult, validBoundarySnapshot).frozen, true);
const validBoundaryPending = JSON.parse(validBoundaryRun.control.durable["cmi.suspend_data"]);
assert.equal(App.canonicalReviewMatches(validBoundaryReview, validBoundaryPending.payload, validBoundaryResult), true,
  "valid canonical boundaries survive frozen pending-final validation");

const contradictoryBoundaryReview = JSON.parse(JSON.stringify(validBoundaryReview));
contradictoryBoundaryReview.evidence.totalPlacement.boundaryOverlapPx = 0;
assert.equal(P.decodeReview(contradictoryBoundaryReview), null);
const contradictoryBoundaryResult = S.scoreAttempt(contradictoryBoundaryReview);
assert.equal(contradictoryBoundaryResult.detail.process.totalPlacement, 0);
const contradictoryBoundaryRun = fakeRuntime();
contradictoryBoundaryRun.control.failCommitCall = 2;
const contradictoryBoundarySnapshot = contradictoryBoundaryRun.scorm.makeSnapshot(
  activity, "review", contradictoryBoundaryReview, contradictoryBoundaryResult);
assert.equal(contradictoryBoundaryRun.scorm.submitResult(
  contradictoryBoundaryResult, contradictoryBoundarySnapshot).frozen, true);
const contradictoryBoundaryPending = JSON.parse(
  contradictoryBoundaryRun.control.durable["cmi.suspend_data"]);
assert.equal(App.canonicalReviewMatches(
  contradictoryBoundaryReview, contradictoryBoundaryPending.payload, contradictoryBoundaryResult), false,
"contradictory boundary fields cannot pass frozen pending-final canonical validation");

const legacyReview = JSON.parse(JSON.stringify(review6));
legacyReview.v = 1;
legacyReview.rubricVersion = 2;
legacyReview.frequencyActivelySelected = legacyReview.frequencyAssigned;
delete legacyReview.frequencyAssigned;
legacyReview.analysis = {
  deltaTS: legacyReview.analysis.deltaTS,
  cumulativeTimeRatio: { status: "answered", values: legacyReview.analysis.cumulativeTimeRatio.values },
  totalDisplacementRatio: { status: "answered", values: [1, 4, 9, 16] },
  intervalTimeRatio: { status: "answered", values: legacyReview.analysis.intervalTimeRatio.values },
  intervalDistanceRatio: { status: "answered", values: [1, 3, 5, 7] },
  lawAnswerId: legacyReview.analysis.lawAnswerId,
  intervalLawAnswerId: legacyReview.analysis.intervalLawAnswerId,
  accelerationAnswerId: legacyReview.analysis.accelerationAnswerId
};
const toLegacyPlacement = (value, keepSide = false) => {
  value.edgeGapPx = 10;
  delete value.zeroTickOverlapPx;
  delete value.rulerX;
  delete value.rulerGeometry;
  delete value.horizontalMode;
  delete value.guideFraction;
  delete value.boundaryOverlapPx;
  if (Object.hasOwn(value, "rulerSide")) {
    if (keepSide) value.edgeSide = "right";
    delete value.rulerSide;
  }
};
toLegacyPlacement(legacyReview.evidence.totalPlacement, true);
S.GAP_KEYS.forEach((key) => toLegacyPlacement(legacyReview.evidence[key]));
const legacyRun = fakeRuntime();
legacyRun.control.failCommitCall = 2;
const immutableLegacyReview = P.decodeImmutableReview(legacyReview);
const legacyResult = S.scoreAttempt(immutableLegacyReview);
const legacySnapshot = legacyRun.scorm.makeSnapshot(activity, "review", legacyReview, legacyResult);
const legacyFrozen = legacyRun.scorm.submitResult(legacyResult, legacySnapshot);
assert.equal(legacyFrozen.frozen, true);
const legacyPendingRaw = legacyRun.control.durable["cmi.suspend_data"];
const legacyPending = JSON.parse(legacyPendingRaw);
const normalizedLegacyReview = P.decodeImmutableReview(legacyReview);
assert.ok(normalizedLegacyReview, "v1 review normalizes in memory");
assert.equal(App.canonicalReviewMatches(normalizedLegacyReview, legacyPending.payload,
  S.scoreAttempt(normalizedLegacyReview)), true, "v1 pending payload passes canonical migration/rescore");
const invalidLegacyReview = JSON.parse(JSON.stringify(legacyReview));
invalidLegacyReview.evidence.totalPlacement.rulerZeroM = -.75;
invalidLegacyReview.evidence.totalPlacement.zeroErrorPx = -6;
const invalidLegacySnapshot = legacyRun.scorm.makeSnapshot(activity, "review", invalidLegacyReview, legacyResult);
const invalidLegacyPayload = {
  reviewJson: JSON.stringify(invalidLegacySnapshot), score: legacyResult.score, maxScore: 100, passed: legacyResult.passed
};
assert.equal(P.decodeImmutableReview(invalidLegacyReview), null);
assert.equal(App.canonicalReviewMatches(P.decodeImmutableReview(invalidLegacyReview), invalidLegacyPayload, legacyResult), false,
  "v1-invalid negative placement cannot pass frozen canonical validation under v2 rules");
const legacyRetryRun = fakeRuntime(legacyRun.control.durable);
assert.equal(activityFlow.startup(legacyRetryRun.scorm.loadAttempt(activity)), "frozen");
const retriedLegacy = legacyRetryRun.scorm.retryPending();
assert.equal(retriedLegacy.ok, true);
assert.equal(legacyRetryRun.control.durable["cmi.suspend_data"], JSON.stringify(legacySnapshot),
  "v1 frozen retry writes the original review payload without v2 re-encoding");
assert.equal(legacyRun.control.durable["cmi.suspend_data"], legacyPendingRaw,
  "the original frozen durable payload remains byte-for-byte unchanged");

const historicalV2Review6 = JSON.parse(JSON.stringify(review6));
delete historicalV2Review6.evidence.totalPlacement.rulerGeometry;
S.GAP_KEYS.forEach((key) => delete historicalV2Review6.evidence[key].rulerGeometry);
const historicalV2Result6 = S.scoreAttempt(historicalV2Review6);
const historicalV2Run = fakeRuntime();
historicalV2Run.control.failCommitCall = 2;
const historicalV2Snapshot6 = historicalV2Run.scorm.makeSnapshot(
  activity, "review", historicalV2Review6, historicalV2Result6);
assert.equal(historicalV2Run.scorm.submitResult(historicalV2Result6, historicalV2Snapshot6).frozen, true);
const historicalV2PendingRaw = historicalV2Run.control.durable["cmi.suspend_data"];
const historicalV2Retry = fakeRuntime(historicalV2Run.control.durable);
assert.equal(activityFlow.startup(historicalV2Retry.scorm.loadAttempt(activity)), "frozen");
assert.equal(historicalV2Retry.scorm.retryPending().ok, true);
assert.equal(historicalV2Retry.control.durable["cmi.suspend_data"], JSON.stringify(historicalV2Snapshot6),
  "historical v2 6 Hz retry preserves the original undiscriminated review bytes");
assert.equal(historicalV2Run.control.durable["cmi.suspend_data"], historicalV2PendingRaw,
  "historical v2 6 Hz frozen payload remains byte-for-byte unchanged");

const blankReview = JSON.parse(JSON.stringify(review)); blankReview.analysis = P.emptyAnalysis();
const mixedReview = JSON.parse(JSON.stringify(review));
mixedReview.analysis = {
  deltaTS: null, cumulativeTimeRatio: { values: [1, null, 8, 4] },
  intervalTimeRatio: { values: [1, 1, null, 8] }, lawAnswerId: "linear",
  intervalLawAnswerId: null, accelerationAnswerId: "constant-speed"
};
for (const [name, answer] of [["blank", blankReview], ["mixed", mixedReview]]) {
  assert.ok(P.validateReview(answer));
  const scored = S.scoreAttempt(answer);
  for (const outcome of ["success", "committed", "frozen", "retry"]) {
    const runtime = fakeRuntime();
    if (outcome === "committed") runtime.control.failFinish = true;
    if (outcome === "frozen") runtime.control.failCommitCall = 2;
    if (outcome === "retry") runtime.control.failSet = "cmi.suspend_data";
    const snapshot = runtime.scorm.makeSnapshot(activity, "review", answer, scored);
    const submitted = runtime.scorm.submitResult(scored, snapshot);
    if (outcome === "success") assert.equal(submitted.ok, true);
    if (outcome === "committed") assert.equal(submitted.committed, true);
    if (outcome === "frozen") assert.equal(submitted.frozen, true);
    if (outcome === "retry") assert.ok(!submitted.ok && submitted.retryable && !submitted.committed,
      "checkpoint failure remains retryable without claiming commit/success");
    assert.doesNotThrow(() => App.submissionView({ ...submitted, activityState: outcome }));
  }
}

const finished6 = fakeRuntime({
  "cmi.core.lesson_status": "passed",
  "cmi.core.score.raw": String(result6.score),
  "cmi.suspend_data": JSON.stringify(
    fakeRuntime().scorm.makeSnapshot(activity, "review", review6, result6))
});
assert.equal(activityFlow.startup(finished6.scorm.loadAttempt(activity)), "review",
  "persisted-only 6 Hz finished attempt restores for review");
const legacyFinished6 = fakeRuntime({
  "cmi.core.lesson_status": "passed",
  "cmi.core.score.raw": String(result6.score),
  "cmi.suspend_data": JSON.stringify(legacySnapshot)
});
assert.equal(activityFlow.startup(legacyFinished6.scorm.loadAttempt(activity)), "review",
  "v1 persisted-only 6 Hz finished attempt migrates in memory for review");

const finishedRun = fakeRuntime({
  "cmi.core.lesson_status": "passed",
  "cmi.core.score.raw": String(result.score),
  "cmi.suspend_data": JSON.stringify(reviewSnapshot)
});
assert.equal(activityFlow.startup(finishedRun.scorm.loadAttempt(activity)), "review");
const readErrorRun = fakeRuntime();
readErrorRun.control.failRead = "cmi.core.lesson_status";
assert.equal(activityFlow.startup(readErrorRun.scorm.loadAttempt(activity)), "load-error");

console.log("free-fall production fake-LMS lifecycle tests passed");
