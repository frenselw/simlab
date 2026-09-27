"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js"), S = require("./scoring.js"), P = require("./persistence.js"), M = require("./model.js");
const ideal = q => q.expected.map(f => [f.kind, Math.round(f.angle * 10) % 3600, 500]);
const q = G.generate(21).questions[3], answer = ideal(q);
assert.equal(S.questionScore([], q).score, 0);
assert.equal(S.questionScore(answer.slice(0, 2), q).score, 10);
assert.equal(S.questionScore(answer.map(r => [r[0], null, null]), q).score, 8);
const wrong = M.clone(answer); wrong[0][1] = (wrong[0][1] + 1800) % 3600;
assert.equal(S.questionScore(wrong, q).score, 17);
assert.equal(S.questionScore(answer.concat([[4, 1234, 50]]), q).score, 15);
const inside = M.clone(answer), outside = M.clone(answer); inside[0][1] += 100; outside[0][1] += 101;
assert.equal(S.questionScore(inside, q).score, 20); assert.equal(S.questionScore(outside, q).score, 17);
assert.equal(S.questionScore(answer.map((r, i) => [r[0], r[1], i % 2 ? 1 : 1000]), q).score, 20);
const wrap = { family: "test", expected: [{ kind: 4, angle: 0 }] };
assert.equal(S.questionScore([[4, 3500, 500]], wrap).score, 20);
assert.equal(S.questionScore([[4, 3499, 500]], wrap).score, 8);
const cases = require('./test-cases.js');
for (const block of cases.filter(q => q.family === 'C')) {
  assert.equal(S.questionScore(ideal(block), block).score, 20, 'both target bodies receive the same maximum');
  const conflated = ideal(block).map(r => r[0] === 5 ? [4, r[1], r[2]] : r);
  assert.ok(S.questionScore(conflated, block).score < 20, 'an applied push cannot replace spring force');
}
for (const ball of cases.filter(q => q.family === 'E' && q.params.target === 1)) {
  const reversed = ideal(ball), index = ball.expected.findIndex(f => f.source === 'b');
  reversed[index][1] = (reversed[index][1] + 1800) % 3600;
  assert.equal(S.questionScore(reversed, ball).score, 16, 'the lower string pulls the upper ball down along b');
}
for (let seed = 0; seed < 100; seed++) {
  const scenario = G.generate(seed), state = P.fresh(seed); state.answers = scenario.questions.map(ideal);
  assert.equal(S.score(state).score, 100); assert.equal(S.score(P.fresh(seed)).score, 0);
  scenario.questions.forEach(question => {
    const good = ideal(question);
    assert.equal(S.questionScore(good.slice().reverse(), question).score, 20);
    for (let angle = 0; angle < 3600; angle += 150) {
      for (const kind of [...new Set(good.map(r => r[0]))]) {
        if (good.filter(r => r[0] === kind).length >= 3) continue;
        const bad = good.map(r => [r[0], (r[1] + 170) % 3600, r[2]]);
        assert.ok(S.questionScore(bad.concat([[kind, angle, 1]]), question).score <= S.questionScore(bad, question).score, "extra direction sweeping cannot increase credit");
      }
    }
  });
}
console.log("equilibrium scoring: partial credit, duplicates, assignment permutations, angular boundaries and length independence passed");
