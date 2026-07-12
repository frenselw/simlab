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
console.log("activity production-flow checks passed");
