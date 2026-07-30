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
