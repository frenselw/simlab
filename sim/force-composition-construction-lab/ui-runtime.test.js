"use strict";

const assert = require("node:assert/strict");
const UI = require("./ui-runtime.js");

assert.equal(UI.startupPresentation({ state: "new" }), "editable");
assert.equal(UI.startupPresentation({ state: "draft" }), "editable");
assert.equal(UI.startupPresentation({ state: "finished" }), "review");
assert.equal(UI.startupPresentation({ state: "pending-final" }), "frozen");
assert.equal(UI.startupPresentation({ state: "read-error" }), "technical");

assert.equal(UI.submissionPresentation({ activityState: "success" }), "review");
assert.equal(UI.submissionPresentation({ activityState: "committed" }), "committed");
assert.equal(UI.submissionPresentation({ activityState: "frozen" }), "frozen");
assert.equal(UI.submissionPresentation({ activityState: "retry", retryable: true }), "retryable");
assert.equal(UI.submissionPresentation({ activityState: "retry", retryable: false }), "technical");
assert.equal(UI.reviewPresentation({ trusted: true }), "review");
assert.equal(UI.reviewPresentation({ trusted: false }), "mismatch");

const editable = UI.controlPolicy({ presentation: "editable", phase: "practice", undoAvailable: true });
assert.equal(editable.progressEnabled, true);
assert.equal(editable.dragEnabled, true);
assert.equal(editable.undoEnabled, true);
assert.equal(editable.submitEnabled, false);
const summary = UI.controlPolicy({ presentation: "summary", phase: "summary", unsaved: false });
assert.equal(summary.progressEnabled, true, "all question buttons remain available from summary");
assert.equal(summary.dragEnabled, false);
assert.equal(summary.submitEnabled, true, "zero completed questions do not disable submission");
assert.equal(UI.controlPolicy({ presentation: "summary", phase: "summary", unsaved: true }).submitEnabled, false, "unsaved draft blocks final submission");
const review = UI.controlPolicy({ presentation: "review", phase: "review", trusted: true });
assert.equal(review.dragEnabled, false);
assert.equal(review.correctOverlayEnabled, true);
assert.equal(UI.copyFor("frozen").score, "--");
assert.doesNotMatch(UI.copyFor("frozen").title, /已提交|通過|未通過/);
assert.equal(UI.copyFor("review", { score: 80, maxScore: 100, passed: true }).completion, "已通過");
assert.equal(UI.completionLabel(null), "未能安全判斷合格狀態");

console.log("force-composition UI runtime tests passed");
