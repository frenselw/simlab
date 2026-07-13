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
console.log("activity production-flow checks passed");
