"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const App = require("./main.js");
const Flow = require("../shared/activity-flow.js");

const source = fs.readFileSync(require.resolve("./main.js"), "utf8");
assert.match(source, /quarantinePending/);
assert.match(source, /verifyPendingOutcome/);
assert.match(source, /presentation = "frozen"/);
assert.match(source, /latestResult = null; renderFrozen/);
for (const activityState of ["frozen", "retry"]) {
  let chosen = "";
  App.routeSubmission({ activityState, retryable: true }, Flow, {
    frozen: () => { chosen = "frozen"; },
    retry: () => { chosen = "retry"; }
  });
  assert.equal(chosen, activityState);
}

console.log("Hooke's law pending-final checks passed");
