"use strict";
const assert = require("node:assert/strict"); const U = require("./ui-policy.js");
assert.equal(U.startupMode("editable"), "activity"); assert.equal(U.startupMode("review"), "review"); assert.equal(U.startupMode("frozen"), "pending"); assert.equal(U.startupMode("load-error"), "technical");
assert.equal(U.controlsLocked("activity"), false); assert.equal(U.controlsLocked("pending"), true); assert.equal(U.technicalResult("pending").submittedClaim, false);
for (const value of [{ score: 70, maxScore: 100, passed: true }, { score: 69.5, maxScore: 100, passed: false }]) assert.equal(U.validResultMetadata(value), true);
for (const value of [{ score: 70, maxScore: 99, passed: true }, { score: "70", maxScore: 100, passed: true }, { score: 70, maxScore: 100, passed: "true" }]) assert.equal(U.validResultMetadata(value), false);
const calls = []; for (const activityState of ["success", "committed", "frozen", "retry"]) U.submission({ activityState }, { success: () => calls.push("success"), committed: () => calls.push("committed"), frozen: () => calls.push("frozen"), retry: () => calls.push("retry") }); assert.deepEqual(calls, ["success", "committed", "frozen", "retry"]);
const expected = { answer: { v: 1 }, score: 70, maxScore: 100, passed: true }; const computed = { score: 70, passed: true };
assert.equal(U.pendingReturnDecision({ ok: true, review: expected }, expected, { ok: true }, computed), "review");
assert.equal(U.pendingReturnDecision({ committed: true, review: expected }, expected, { ok: true }, computed), "committed");
assert.equal(U.pendingReturnDecision({ frozen: true }, expected, null, null), "pending");
assert.equal(U.pendingReturnDecision({ ok: true, review: { ...expected, score: 69 } }, expected, { ok: true }, computed), "quarantine");
assert.deepEqual(U.attemptSummary({ score: 0, status: "failed" }), { score: "0", status: "failed" }, "finished fallback must display a recorded zero");
assert.deepEqual(U.attemptSummary({ score: "", status: "" }), { score: "--", status: "--" }); assert.match(U.retryableRetryMessage, /重試/);
assert.equal(U.usesCompactLayout({ width: 320, height: 500 }), false); assert.equal(U.usesCompactLayout({ width: 390, height: 500 }), false); assert.equal(U.usesCompactLayout({ width: 390, height: 420 }), true); assert.equal(U.usesCompactLayout({ width: 1024, height: 500 }), false); assert.equal(U.usesCompactLayout({ width: 390, height: 250 }), true);
const Q = require("./question-definitions.js");
for (const pid of Object.keys(Q.PAPERS)) for (let task=0;task<12;task++) {
  const definition=Q.taskDefinition(pid,task), labels=U.axisLabels(definition);
  assert.equal(labels[0],definition.axis.min); assert.equal(labels.at(-1),definition.axis.max); assert.ok(labels.includes(0));
  for(let index=1;index<labels.length;index++) assert.ok((labels[index]-labels[index-1])/(definition.axis.max-definition.axis.min)*390>=40, `${pid}/${task}: labels leave room for cross-browser 24px phone SVG tick bounds`);
}
console.log("Quantitative graph lifecycle UI tests passed");
