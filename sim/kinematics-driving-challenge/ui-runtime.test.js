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

console.log("Kinematics driving lifecycle UI tests passed");
