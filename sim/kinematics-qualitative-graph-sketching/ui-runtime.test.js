"use strict";

const assert = require("node:assert/strict");
const UiPolicy = require("./ui-policy.js");

assert.equal(UiPolicy.startupMode("review"), "review");
assert.equal(UiPolicy.startupMode("editable"), "activity");
assert.equal(UiPolicy.startupMode("frozen"), "pending");
assert.equal(UiPolicy.startupMode("load-error"), "technical");
assert.equal(UiPolicy.controlsLocked("pending"), true);
assert.equal(UiPolicy.controlsLocked("technical"), true);
assert.equal(UiPolicy.controlsLocked("activity"), false);
assert.match(UiPolicy.technicalCopy("pending"), /待確認/);
assert.match(UiPolicy.technicalCopy("review-fallback"), /Moodle/);
assert.equal(UiPolicy.technicalResult("pending").submittedClaim, false);
assert.equal(UiPolicy.technicalResult("technical").score, "--");

const calls = [];
for (const activityState of ["success", "committed", "frozen", "retry"]) {
  UiPolicy.submission({ activityState }, {
    success: () => calls.push("success"),
    committed: () => calls.push("committed"),
    frozen: () => calls.push("frozen"),
    retry: () => calls.push("retry")
  });
}
assert.deepEqual(calls, ["success", "committed", "frozen", "retry"]);

const trusted = UiPolicy.reviewOutcome(
  { score: 70, maxScore: 100, passed: true },
  { score: 70, maxScore: 100, passed: true },
  { score: 70, status: "passed" }
);
assert.equal(trusted.trusted, true);
assert.equal(UiPolicy.reviewOutcome(
  { score: 70, maxScore: 100, passed: true },
  { score: 70, maxScore: 100, passed: true },
  { score: 69, status: "passed" }
).trusted, false);
assert.equal(UiPolicy.reviewOutcome(
  { score: 70, maxScore: 100, passed: true },
  { score: 70, maxScore: 100, passed: true },
  { score: 70, status: "completed" }
).result.passed, null);
for (const invalid of [
  { score: 70, passed: true },
  { score: 70, maxScore: 0, passed: true },
  { score: "70", maxScore: 100, passed: true },
  { score: 70, maxScore: 100, passed: "true" }
]) {
  assert.equal(UiPolicy.validResultMetadata(invalid), false);
  assert.equal(UiPolicy.reviewOutcome(
    { score: 70, maxScore: 100, passed: true }, invalid, { score: 70, status: "passed" }
  ).trusted, false, "invalid saved review metadata never unlocks detailed review");
}

assert.equal(UiPolicy.shouldHandleGraphShortcut({ closest: () => null }), true);
assert.equal(UiPolicy.shouldHandleGraphShortcut({ closest: () => ({}) }), false);

console.log("Qualitative kinematics lifecycle UI tests passed");
