"use strict";

const assert = require("node:assert/strict");
const P = require("./persistence.js");

assert.deepEqual(P.lifecyclePolicy("startup", "review"), { key: "review", editable: false, showScore: true });
assert.deepEqual(P.lifecyclePolicy("startup", "editable"), { key: "editable", editable: true, showScore: false });
assert.deepEqual(P.lifecyclePolicy("startup", "frozen"), { key: "frozen", editable: false, showScore: false });
assert.deepEqual(P.lifecyclePolicy("startup", "load-error"), { key: "load-error", editable: false, showScore: false });
assert.deepEqual(P.lifecyclePolicy("submission", { activityState: "success" }), { key: "success", editable: false, showScore: true });
assert.deepEqual(P.lifecyclePolicy("submission", { activityState: "committed" }), { key: "committed", editable: false, showScore: true });
assert.deepEqual(P.lifecyclePolicy("submission", { activityState: "frozen" }), { key: "frozen", editable: false, showScore: false });
assert.deepEqual(P.lifecyclePolicy("submission", { activityState: "retry", retryable: true }), { key: "retry", editable: true, showScore: false });
assert.deepEqual(P.lifecyclePolicy("submission", { activityState: "retry", retryable: false }), { key: "retry", editable: false, showScore: false });

console.log("Position-time lifecycle policy checks passed");
