"use strict";
const assert = require("node:assert/strict");
const App = require("./main.js");
const Flow = require("../shared/activity-flow.js");
assert.equal(App.routeStartup({ state: "new" }, Flow), "editable");
assert.equal(App.routeStartup({ state: "draft" }, Flow), "editable");
assert.equal(App.routeStartup({ state: "finished" }, Flow), "review");
assert.equal(App.routeStartup({ state: "pending-final" }, Flow), "frozen");
assert.equal(App.routeStartup({ state: "read-error" }, Flow), "load-error");
for (const activityState of ["success", "committed", "frozen", "retry"]) { let called = ""; App.routeSubmission({ activityState }, Flow, { success: () => { called = "success"; }, committed: () => { called = "committed"; }, frozen: () => { called = "frozen"; }, retry: () => { called = "retry"; } }); assert.equal(called, activityState); }
assert.equal(App.mayRevealCorrectness("editable"), false);
assert.equal(App.mayRevealCorrectness("submitted-success"), true);
console.log("Static/kinetic friction lifecycle checks passed");
