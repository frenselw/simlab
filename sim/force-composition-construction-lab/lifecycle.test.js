"use strict";

const assert = require("node:assert/strict");
const Flow = require("../shared/activity-flow.js");
const UI = require("./ui-runtime.js");
const G = require("./generator.js");
const M = require("./model.js");
const P = require("./persistence.js");
const S = require("./scoring.js");

assert.equal(Flow.startup({ state: "finished" }), "review");
assert.equal(Flow.startup({ state: "draft" }), "editable");
assert.equal(Flow.startup({ state: "new" }), "editable");
assert.equal(Flow.startup({ state: "pending-final" }), "frozen");
assert.equal(Flow.startup({ state: "read-error" }), "load-error");

for (const activityState of ["success", "committed", "frozen", "retry"]) {
  let called = "";
  const handlers = Object.fromEntries(["success", "committed", "frozen", "retry"].map((name) => [name, () => { called = name; }]));
  assert.equal(Flow.submission({ activityState }, handlers), activityState);
  assert.equal(called, activityState);
}
assert.equal(UI.submissionPresentation({ activityState: "retry", retryable: true }), "retryable");
assert.equal(UI.submissionPresentation({ activityState: "retry", retryable: false }), "technical");

const scenario = G.generateScenario({ seed: 22 });
const state = P.freshState(22);
const computed = S.score(state, scenario);
const trusted = Flow.reviewResult(computed, { score: 0, passed: false }, { score: "0", status: "failed" });
assert.equal(trusted.trusted, true);
assert.equal(UI.reviewPresentation(trusted), "review");
const mismatch = Flow.reviewResult(computed, { score: 20, passed: false }, { score: "20", status: "failed" });
assert.equal(mismatch.trusted, false);
assert.equal(UI.reviewPresentation(mismatch), "mismatch");
const unknown = Flow.reviewResult(computed, { score: 0, passed: false }, { score: "0", status: "completed" });
assert.equal(unknown.trusted, false);
assert.equal(unknown.result.passed, null);
assert.equal(Flow.completionLabel(null), "未能安全判斷合格狀態");

const review = P.makeSnapshot("review", state, computed);
const pending = P.pendingEnvelope(review, computed);
const decoded = P.decodePending(pending);
assert.deepEqual(decoded.answer.answers, state.answers, "valid pending keeps the immutable authoritative answer");
const quarantinable = P.clone(pending);
const nested = JSON.parse(quarantinable.payload.reviewJson);
nested.answer.answers[2].resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CHAIN_END" } };
quarantinable.payload.reviewJson = JSON.stringify(nested);
assert.throws(() => P.decodePending(quarantinable), /resultant-before-chain/);

const policies = [
  UI.controlPolicy({ presentation: "frozen", phase: "review" }),
  UI.controlPolicy({ presentation: "committed", phase: "review" }),
  UI.controlPolicy({ presentation: "technical", phase: "review" }),
  UI.controlPolicy({ presentation: "review", phase: "review", trusted: true })
];
assert.ok(policies.every((policy) => !policy.dragEnabled && !policy.submitEnabled), "every locked runtime variant removes edit and resubmit ownership");
for (const presentation of ["frozen", "technical"]) {
  const copy = UI.copyFor(presentation);
  assert.equal(copy.score, "--");
  assert.doesNotMatch(`${copy.title} ${copy.completion}`, /已提交|已通過|未通過/);
}

for (let index = 0; index < 5; index += 1) {
  const answer = state.answers[index];
  assert.ok(["fresh", "placing", "guides", "resultant", "complete"].includes(M.derivedVariant(answer, scenario.questions[index])));
}

console.log("force-composition lifecycle tests passed");
