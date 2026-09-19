"use strict";

const assert = require("node:assert/strict");
const Flow = require("../shared/activity-flow.js");
const M = require("./model.js");
const P = require("./persistence.js");
const S = require("./scoring.js");

for (const [attempt, expected] of [
  [{ state: "new" }, "editable"],
  [{ state: "draft" }, "editable"],
  [{ state: "finished" }, "review"],
  [{ state: "pending-final" }, "frozen"],
  [{ state: "read-error" }, "load-error"],
  [{ state: "inconsistent" }, "load-error"]
]) assert.equal(Flow.startup(attempt), expected);

for (const state of ["success", "committed", "frozen", "retry"]) {
  let called = "";
  const handlers = Object.fromEntries(["success", "committed", "frozen", "retry"].map(name => [name, () => { called = name; }]));
  assert.equal(Flow.submission({ activityState: state }, handlers), state);
  assert.equal(called, state);
}

const draft = P.freshDraft();
const computed = S.score(draft);
const review = P.makeSnapshot("review", draft, computed);
const trusted = Flow.reviewResult(computed, { score: computed.score, passed: computed.passed }, { score: String(computed.score), status: "passed" });
assert.equal(trusted.trusted, true);
assert.equal(trusted.result.score, computed.score);
const mismatch = Flow.reviewResult(computed, { score: computed.score + 1, passed: computed.passed }, { score: String(computed.score + 1), status: "passed" });
assert.equal(mismatch.trusted, false);
assert.equal(mismatch.result.score, computed.score + 1);
const unknownStatus = Flow.reviewResult(computed, { score: computed.score, passed: computed.passed }, { score: String(computed.score), status: "completed" });
assert.equal(unknownStatus.trusted, false);
assert.equal(unknownStatus.result.passed, null);

const pending = P.pendingEnvelope(review, computed);
assert.equal(P.decodePending(pending).snapshot.kind, "review");
assert.equal(Flow.completionLabel(null), "未能安全判斷合格狀態");
assert.equal(M.PHASES.length, 5, "the shared phase flow still covers every construction step");

console.log("force orthogonal decomposition lifecycle tests passed");
