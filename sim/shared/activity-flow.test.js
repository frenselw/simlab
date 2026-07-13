"use strict";
const assert = require("assert");
const Flow = require("./activity-flow.js");
for (const state of ["success", "committed", "frozen", "retry"]) {
  const calls = [];
  const handlers = Object.fromEntries(["success", "committed", "frozen", "retry"].map((name) => [name, () => calls.push(name)]));
  assert.equal(Flow.submission({ activityState: state }, handlers), state);
  assert.deepEqual(calls, [state]);
}
assert.equal(Flow.startup({ state: "finished" }), "review");
assert.equal(Flow.startup({ state: "draft" }), "editable");
assert.equal(Flow.startup({ state: "new" }), "editable");
assert.equal(Flow.startup({ state: "pending-final" }), "frozen");
assert.equal(Flow.startup({ state: "read-error" }), "load-error");
assert.equal(Flow.startup({ state: "inconsistent" }), "load-error");
assert.deepEqual(Flow.recordedResult({ score: "80", status: "passed" }), { score: 80, passed: true });
assert.deepEqual(Flow.recordedResult({ score: "40", status: "failed" }), { score: 40, passed: false });
assert.deepEqual(Flow.recordedResult({ score: "", status: "completed" }), { score: null, passed: null });
assert.deepEqual(Flow.recordedResult({ score: "bad", status: "passed" }), { score: null, passed: true });
const computed = { score: 80, maxScore: 100, passed: true, detail: [1] };
assert.deepEqual(Flow.reviewResult(computed, { score: 80, passed: true }, { score: "80", status: "passed" }), { trusted: true, result: computed });
assert.deepEqual(Flow.reviewResult(computed, { score: 40, passed: false }, { score: "40", status: "failed" }).result, { score: 40, maxScore: 100, passed: false, completed: true, detail: [], feedbackItems: [] });
assert.equal(Flow.reviewResult(null, null, { score: "", status: "completed" }).result.passed, null);
for (const [computedPassed, status, expectedPassed] of [[true, "failed", false], [false, "passed", true]]) {
  const scored = { score: 80, maxScore: 100, passed: computedPassed };
  const outcome = Flow.reviewResult(scored, { score: 80, passed: computedPassed }, { score: "80", status });
  assert.equal(outcome.trusted, false, "Moodle pass status disagreement is untrusted");
  assert.equal(outcome.result.passed, expectedPassed, "fallback uses the recorded Moodle status");
}
for (const computedPassed of [true, false]) {
  const scored = { score: 80, maxScore: 100, passed: computedPassed };
  const outcome = Flow.reviewResult(scored, { score: 80, passed: computedPassed }, { score: "80", status: "completed" });
  assert.equal(outcome.trusted, false, "completed status cannot authorize a pass/fail claim");
  assert.equal(outcome.result.passed, null, "ambiguous Moodle status stays indeterminate");
}
console.log("activity production-flow checks passed");
