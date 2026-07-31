"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const App = require("./main.js");
const P = require("./persistence.js");
const S = require("./scoring.js");
const fixture = require("./persistence.test.js");

const source = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
const activityFlow = require("../shared/activity-flow.js");
const activity = App.ACTIVITY;
const review = P.decodeReview(fixture.review);
const result = S.scoreAttempt(review);

function fakeRuntime(initial = {}) {
  const durable = { ...initial };
  let buffer = { ...durable };
  let lastError = "0";
  const control = { failCommitCall: 0, failFinish: false, failRead: "", commits: 0, finishes: 0, durable };
  const api = {
    LMSInitialize: () => "true",
    LMSGetValue(key) {
      if (control.failRead === key) { lastError = "101"; return ""; }
      lastError = "0"; return buffer[key] || "";
    },
    LMSSetValue(key, value) { buffer[key] = String(value); lastError = "0"; return "true"; },
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

const legacyReview = JSON.parse(JSON.stringify(review));
legacyReview.v = 1;
legacyReview.rubricVersion = 1;
legacyReview.frequencyActivelySelected = legacyReview.frequencyAssigned;
delete legacyReview.frequencyAssigned;
const toLegacyPlacement = (value, keepSide = false) => {
  value.edgeGapPx = 10;
  delete value.zeroTickOverlapPx;
  delete value.rulerX;
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
const legacySnapshot = legacyRun.scorm.makeSnapshot(activity, "review", legacyReview, result);
const legacyFrozen = legacyRun.scorm.submitResult(result, legacySnapshot);
assert.equal(legacyFrozen.frozen, true);
const legacyPendingRaw = legacyRun.control.durable["cmi.suspend_data"];
const legacyPending = JSON.parse(legacyPendingRaw);
const normalizedLegacyReview = P.decodeReview(legacyReview);
assert.ok(normalizedLegacyReview, "v1 review normalizes in memory");
assert.equal(App.canonicalReviewMatches(normalizedLegacyReview, legacyPending.payload,
  S.scoreAttempt(normalizedLegacyReview)), true, "v1 pending payload passes canonical migration/rescore");
const invalidLegacyReview = JSON.parse(JSON.stringify(legacyReview));
invalidLegacyReview.evidence.totalPlacement.rulerZeroM = -.75;
invalidLegacyReview.evidence.totalPlacement.zeroErrorPx = -6;
const invalidLegacySnapshot = legacyRun.scorm.makeSnapshot(activity, "review", invalidLegacyReview, result);
const invalidLegacyPayload = {
  reviewJson: JSON.stringify(invalidLegacySnapshot), score: result.score, maxScore: 100, passed: result.passed
};
assert.equal(P.decodeReview(invalidLegacyReview), null);
assert.equal(App.canonicalReviewMatches(P.decodeReview(invalidLegacyReview), invalidLegacyPayload, result), false,
  "v1-invalid negative placement cannot pass frozen canonical validation under v2 rules");
const legacyRetryRun = fakeRuntime(legacyRun.control.durable);
assert.equal(activityFlow.startup(legacyRetryRun.scorm.loadAttempt(activity)), "frozen");
const retriedLegacy = legacyRetryRun.scorm.retryPending();
assert.equal(retriedLegacy.ok, true);
assert.equal(legacyRetryRun.control.durable["cmi.suspend_data"], JSON.stringify(legacySnapshot),
  "v1 frozen retry writes the original review payload without v2 re-encoding");
assert.equal(legacyRun.control.durable["cmi.suspend_data"], legacyPendingRaw,
  "the original frozen durable payload remains byte-for-byte unchanged");

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
