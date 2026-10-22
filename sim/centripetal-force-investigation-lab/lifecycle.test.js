"use strict";
const assert = require("node:assert/strict"), M = require("./model.js"), P = require("./persistence.js"), S = require("./scoring.js"), { environment } = require("./test-support.js");
for (const mode of ["success", "committed", "frozen", "retry"]) {
  const e = environment({ submitMode: mode }); e.c.check(); e.c.submit();
  assert.equal(e.c.mode, { success: "review", committed: "committed", frozen: "frozen", retry: "editable" }[mode]);
  if (mode === "frozen") { assert.equal(e.c.result, null); e.c.retryFinal(); assert.equal(e.c.mode, "review"); }
  if (mode === "committed") { e.c.retryFinal(); assert.equal(e.c.mode, "review"); }
  if (mode === "retry") assert.equal(e.c.state.view, "check");
  else { assert.equal(e.c.result.score, 0); assert.equal(e.c.update(s => s.sync = "same-omega"), false); }
}
const denied = environment({ submitMode: "retry", retryable: false }); denied.c.check(); denied.c.submit(); assert.equal(denied.c.mode, "technical");
const badSave = environment({ saveFail: true }); badSave.c.check(); assert.equal(badSave.c.submit(), false); assert.equal(badSave.c.mode, "editable");
const draft = environment(); draft.c.update(s => { s.tasks[0].work[0] = 4; });
assert.equal(environment({ durable: draft.durable }).c.state.tasks[0].work[0], 4, "Moodle draft resumes");
const done = environment(); done.c.check(); done.c.submit(); assert.equal(environment({ durable: done.durable }).c.mode, "review");
for (const mutate of [d => d.score = "99", d => d.status = "completed", d => d.snapshot.answer.sync = "same-omega"] ) {
  const wrong = M.clone(done.durable); mutate(wrong); const resumed = environment({ durable: wrong });
  assert.equal(resumed.c.mode, "mismatch"); assert.equal(resumed.c.editable, false);
}
const review = P.review(M.fresh(1)), result = S.score(review), inner = { version: 1, activity: P.ACTIVITY, kind: "review", answer: review, score: result.score, passed: result.passed };
const pending = { state: "pending-final", snapshot: { version: 1, activity: P.ACTIVITY, kind: "pending-final", payload: { reviewJson: JSON.stringify(inner), score: result.score, maxScore: 100, passed: result.passed } } };
const resumedPending = environment({ durable: M.clone(pending) }); assert.equal(resumedPending.c.mode, "frozen"); resumedPending.c.retryFinal(); assert.equal(resumedPending.c.mode, "review");
const damaged = M.clone(pending); damaged.snapshot.payload.reviewJson = JSON.stringify({ ...inner, answer: { ...review, sync: "invalid" } });
const quarantined = environment({ durable: damaged }); assert.equal(quarantined.c.mode, "technical"); assert.equal(quarantined.events.quarantined, 1);
const invalidDraft = M.clone(draft.durable); invalidDraft.snapshot.answer.tasks[0].work[0] = -1;
assert.equal(environment({ durable: invalidDraft }).c.mode, "technical");
assert.equal(environment().c.state.tasks[0].work[0], 2, "standalone new launch starts fresh");
console.log("centripetal lifecycle ok");
