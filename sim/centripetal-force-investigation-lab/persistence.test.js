"use strict";
const assert = require("node:assert/strict"), M = require("./model.js"), P = require("./persistence.js"), S = require("./scoring.js");
const snapshot = (answer, kind = "draft") => ({ version: 1, activity: P.ACTIVITY, kind, answer,
  ...(kind === "review" ? { score: S.score(answer).score, passed: S.score(answer).passed } : {}) });
function roundtrip(s, continuation) {
  const saved = snapshot(s); assert.deepEqual(P.decode(JSON.parse(JSON.stringify(saved)), "draft"), s);
  assert.equal(S.score(P.decode(saved, "draft")).score, S.score(s).score);
  continuation(P.decode(saved, "draft"));
}
roundtrip(M.fresh(2), s => { s.tasks[0].work[0] = 3; assert.equal(P.validate(s).tasks[0].work[0], 3); });
for (const page of [0, 1, 2]) for (const variant of ["empty", "partial", "fit", "check", "edit"]) {
  const s = M.fresh(page); s.page = page; const t = s.tasks[page]; M.begin(t); s.view = "collect";
  if (variant !== "empty") for (const q of [500, 1500, 3000]) M.record(t, q / 1000);
  if (variant === "fit") { s.view = "analyse"; assert.equal(M.fitCurrent(M.KINDS[page], t).ok, true); }
  if (variant === "check") { s.returnTo = [page, "collect"]; s.view = "check"; }
  if (variant === "edit") s.fromReview = true;
  roundtrip(s, restored => { if (restored.view === "check") { restored.view = "collect"; restored.returnTo = null; }
    assert.equal(M.record(restored.tasks[page], 4), true); assert.ok(P.validate(restored)); });
}
const full = M.fresh(0xffffffff); full.sync = "same-omega"; full.massParts = "sensor-and-weights";
for (const [i, t] of full.tasks.entries()) for (let run = 0; run < 2; run++) {
  M.begin(t); for (let q = 5953; q <= 6000; q++) M.record(t, -q / 1000);
  t.runs[run].a = ["123456789012", i === 2 ? "square" : "supports", "coefficient"];
  t.roles = ["force",["omega","force"]]; t.law = "inverse";
}
const review = P.review(full); assert.deepEqual(P.decode(snapshot(review, "review"), "review"), review);
for (const kind of ["draft", "review"]) assert.ok(P.bytes(snapshot(kind === "draft" ? full : review, kind)) <= 4000);
const pending = { version: 1, activity: P.ACTIVITY, kind: "pending-final", payload: { reviewJson: JSON.stringify(snapshot(review, "review")), score: S.score(review).score, maxScore: 100, passed: S.score(review).passed } };
assert.ok(P.bytes(pending) <= 4000, "worst-case pending must fit SCORM");
console.log(`snapshot bytes: draft ${P.bytes(snapshot(full))}, review ${P.bytes(snapshot(review, 'review'))}, pending ${P.bytes(pending)}`);
const legacy = M.fresh(5); legacy.mv = 1; M.begin(legacy.tasks[0]); M.record(legacy.tasks[0], 1);
roundtrip(legacy, s => { s.mv = 2; assert.equal(M.record(s.tasks[0], -1), true); assert.ok(P.validate(s)); });
const legacyReview = P.review(legacy); assert.deepEqual(P.decode(snapshot(legacyReview, 'review'), 'review'), legacyReview);
const signed = M.fresh(8); signed.page = 2; signed.view = 'collect'; M.begin(signed.tasks[2]);
for (const value of [-3, -1, 1, 3]) M.record(signed.tasks[2], value);
roundtrip(signed, s => { assert.ok(M.fitCurrent('omega', s.tasks[2]).ok); assert.ok(P.validate(s)); });
for (const change of [s => s.v = 2, s => s.tasks[0].work[0] = NaN, s => s.tasks[0].runs[0].q.push(250),
  s => { s.tasks[0].runs[0].q = [250]; s.tasks[0].runs[0].fit = true; }, s => s.tasks[0].selected = 9, s => s.tasks[0].roles[1] = ["m", "m"]]) {
  const bad = M.clone(full); change(bad); assert.throws(() => P.validate(bad));
}
console.log("centripetal persistence ok");
