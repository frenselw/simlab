"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
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
assert.deepEqual([true, false, null].map(Flow.completionLabel), ["已通過", "未通過", "未能安全判斷合格狀態"]);
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
for (const activity of ["fbd-horizontal-block", "plane-mirror-pencil-ray-diagram", "displacement-distance-map-journey", "inertial-reference-frame-road-observer"]) {
  const main = fs.readFileSync(path.join(__dirname, "..", activity, "main.js"), "utf8");
  assert.match(main, /SimActivityFlow\.reviewResult\(/, `${activity} routes restored results through the shared status-aware contract`);
}
const referenceMain = fs.readFileSync(path.join(__dirname, "..", "inertial-reference-frame-road-observer", "main.js"), "utf8");
const referenceHtml = fs.readFileSync(path.join(__dirname, "..", "inertial-reference-frame-road-observer", "index.html"), "utf8");
assert.match(referenceHtml, /id="feedbackHeading"[^>]*>提交結果</, "reference activity exposes the result heading");
assert.match(referenceMain, /feedbackHeading\.textContent = isUnavailable \? "Moodle 狀態資訊" : "提交結果"/, "technical states do not present themselves as submission results");
const frozenHandler = referenceMain.match(/frozen: \(\) => \{([\s\S]*?)\n\s*\},\n\s*retry:/)?.[1] || "";
assert.match(frozenHandler, /result: null/, "immediate pending failure hides an unconfirmed score");
assert.match(frozenHandler, /unavailableReason:/, "immediate pending failure uses the technical unavailable presentation");
assert.doesNotMatch(frozenHandler, /lockSubmitted/, "immediate pending failure is not presented as submitted");
console.log("activity production-flow checks passed");
