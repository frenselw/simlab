"use strict";

const assert = require("node:assert/strict");
const UiPolicy = require("./ui-policy.js");

assert.equal(UiPolicy.startupMode("review"), "review");
assert.equal(UiPolicy.startupMode("editable"), "activity");
assert.equal(UiPolicy.startupMode("frozen"), "pending");
assert.equal(UiPolicy.startupMode("load-error"), "technical");
assert.equal(UiPolicy.controlsLocked("pending"), true);
assert.equal(UiPolicy.controlsLocked("technical"), true);
assert.match(UiPolicy.technicalCopy("pending"), /待確認/);

const calls = [];
for (const activityState of ["success", "committed", "frozen", "retry"]) {
  UiPolicy.submission({ activityState }, {
    success: () => calls.push("success"), committed: () => calls.push("committed"),
    frozen: () => calls.push("frozen"), retry: () => calls.push("retry")
  });
}
assert.deepEqual(calls, ["success", "committed", "frozen", "retry"]);
const trusted = UiPolicy.reviewOutcome(
  { score: 70, maxScore: 100, passed: true },
  { score: 70, passed: true },
  { score: 70, status: "passed" }
);
assert.equal(trusted.trusted, true);

function reviewState(selectedIds, answered = false) {
  return {
    phase: "review",
    selectedRuns: Object.fromEntries(selectedIds.map((id) => [id, { revision: 1, codes: [] }])),
    graphCheckpoint: { answerId: answered ? "vt-linear" : null }
  };
}
let review = reviewState([]);
assert.equal(UiPolicy.canOpenReviewItem(review, "level1"), true);
assert.equal(UiPolicy.canOpenReviewItem(review, "level2"), true, "all formal levels are open from the start");
assert.equal(UiPolicy.canOpenReviewItem(review, "level4"), true);
assert.equal(UiPolicy.canOpenReviewItem(review, "level5"), true);
assert.equal(UiPolicy.canOpenReviewItem(review, "checkpoint"), false);
review = reviewState(["level3"]);
assert.equal(UiPolicy.canOpenReviewItem(review, "checkpoint"), true, "either acceleration level unlocks graph comparison");
assert.equal(UiPolicy.canOpenReviewItem(review, "level5", true), false,
  "a non-retryable submission failure locks every review edit route");

assert.equal(UiPolicy.shouldHandleGlobalShortcut({ closest: () => null }), true);
for (const selector of ["button", "input", "select", "textarea", "a[href]", "summary", "[contenteditable='true']", "[role='button']"]) {
  assert.equal(UiPolicy.shouldHandleGlobalShortcut({ closest: (query) => query.includes(selector) ? {} : null }), false);
}

console.log("Kinematics driving lifecycle UI tests passed");
