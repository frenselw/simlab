"use strict";
const assert = require("node:assert/strict");
const P = require("./persistence.js"), M = require("./model.js"), S = require("./scoring.js"), G = require("./generator.js");
const envelope = (kind, answer) => ({ version: 1, activity: P.ACTIVITY, kind, answer, ...(kind === "review" ? { score: S.score(answer).score, passed: S.score(answer).passed } : {}) });
const contents = [[], [[5, null, null]], [[5, 2100, 1]], [[0, 2700, 1000], [5, null, null], [0, 100, 1]]];
let rows = 0;
for (const content of contents) for (const fromCheck of [false, true]) for (let position = 0; position < 5; position++) {
  let state = P.fresh(21); state.current = position; state.returnToCheck = fromCheck;
  state.answers = contents.concat([[[4, 1375, 100]]]).map(M.clone); state.answers[G.generate(21).order[position]] = M.clone(content);
  const restored = P.decode(JSON.parse(JSON.stringify(envelope("draft", P.draft(state)))), "draft");
  assert.deepEqual(restored, state); assert.deepEqual(S.score(restored), S.score(state));
  assert.equal(P.check(restored).phase, "check", "each editable variant can legally continue to check"); rows++;
}
for (const content of contents) {
  const state = P.check({ ...P.fresh(42), answers: Array.from({ length: 5 }, () => M.clone(content)) });
  const restored = P.decode(envelope("draft", P.draft(state)), "draft");
  const edited = P.navigate(restored, 3, true); assert.equal(edited.returnToCheck, true);
  assert.deepEqual(edited.answers, state.answers); assert.deepEqual(S.score(edited), S.score(state));
  const reviewed = P.decode(envelope("review", P.review(restored)), "review"); assert.deepEqual(S.score(reviewed), S.score(state)); rows += 2;
}
// Restore the generated object identity and all six force kinds across both mirrors/targets.
const targets = new Set();
for (let seed = 0; seed < 100; seed++) {
  const state = P.fresh(seed), scenario = G.generate(seed);
  state.answers = scenario.questions.map(q => q.expected.map((f, i) => [f.kind, i ? Math.round(f.angle * 10) % 3600 : null, i ? 600 : null]));
  const restored = P.decode(envelope('draft', P.draft(state)), 'draft');
  assert.deepEqual(G.generate(restored.seed), scenario);
  assert.deepEqual(restored.answers, state.answers);
  const next = P.check(restored); assert.equal(next.phase, 'check');
  assert.deepEqual(S.score(next), S.score(state));
  for (const q of scenario.questions.filter(q => ['C','E'].includes(q.family))) targets.add(`${q.family}-${q.params.target}-${q.params.sign}`);
}
assert.equal(targets.size, 8);
const maximum = P.fresh(0xffffffff); maximum.answers = Array.from({ length: 5 }, () => [[5,3599,1000],[5,3599,1000],[5,3599,1000],[1,3599,1000],[1,3599,1000],[1,3599,1000],[3,3599,1000],[3,3599,1000]]);
const review = envelope("review", P.review(maximum));
const pending = { version: 1, activity: P.ACTIVITY, kind: "pending-final", payload: { reviewJson: JSON.stringify(review), score: review.score, maxScore: 100, passed: review.passed } };
for (const s of [envelope("draft", P.draft(maximum)), review, pending]) assert.ok(P.bytes(s) <= 4000);
for (const mutate of [s => { s.current = null; }, s => { s.phase = "check"; }, s => { s.current = 5; }, s => { s.returnToCheck = 1; }, s => { s.answers.pop(); }, s => { s.seed = -1; }, s => { s.generatorVersion = 2; }, s => { s.rubricVersion = 2; }, s => { s.answers[0] = [[0, null, 1]]; }, s => { s.answers[0] = [[0, NaN, 1]]; }, s => { s.answers[0] = [[0, Infinity, 1]]; }, s => { delete s.answers; }, s => { s.secret = 1; }]) {
  const state = P.fresh(21); mutate(state); assert.throws(() => P.draft(state));
}
assert.throws(() => P.decode({ ...review, activity: "other" }, "review"));
assert.throws(() => P.decode({ ...review, activity: "force-equilibrium-diagram-lab" }, "review"));
assert.throws(() => P.draft({ ...P.fresh(21), answers: [[[6, 0, 500]], [], [], [], []] }));
console.log(`equilibrium persistence: ${rows} production matrix round-trips with legal continuations; max draft/review/pending ${P.bytes(envelope("draft", P.draft(maximum)))}/${P.bytes(review)}/${P.bytes(pending)} bytes`);
