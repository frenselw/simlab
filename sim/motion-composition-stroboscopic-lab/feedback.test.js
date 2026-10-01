"use strict";
const assert = require("node:assert/strict");
const M = require("./model.js"), S = require("./scoring.js"), F = require("./feedback.js");
const state = () => ({ cases: [0, 1, 2, 3].map(() => M.emptyCase()) });
const render = (s, index = 0) => F.html(index, s.cases[index], S.score(s).detail[index]);
const text = html => html.replace(/<[^>]*>/g, "");
const blank = state();
const blankHTML = render(blank);
assert.equal(S.score(blank).score, 0);
assert.equal((blankHTML.match(/class="unanswered">未作答/g) || []).length, 3);
assert.equal((text(blankHTML).match(/水平：未放置/g) || []).length, 4);
assert.equal((text(blankHTML).match(/垂直：未放置/g) || []).length, 4);
assert.ok(!blankHTML.includes('class="issue"'), "unanswered work is identified separately from incorrect answers");
const partial = state();
partial.cases[0] = { observed: true, motions: ["uniform", "accelerating"], trajectory: null,
  points: [[850, -851], null, [2400, -2400], [3200, -3200]] };
const partialHTML = render(partial), score = S.score(partial).detail[0];
assert.equal(score.score, 13);
assert.ok(partialHTML.includes("勻加速直線運動（需要修正）"), "shows the learner's incorrect choice, not only the reference choice");
assert.ok(partialHTML.includes("正確答案：勻速直線運動"));
assert.ok(text(partialHTML).includes("水平：正確") && text(partialHTML).includes("垂直：需修正"), "each axis reports its own tolerance result");
assert.equal((partialHTML.match(/class="reference-position"/g) || []).length, 2, "only missing or incorrect positions repeat the reference coordinates");
assert.ok(partialHTML.includes("每個方向正確得2分") && partialHTML.includes("0.050 m"));
for (let index = 0; index < 4; index++) {
  const correct = state(), definition = M.CASES[index];
  correct.cases[index] = { observed: true, motions: [...definition.motions], trajectory: definition.trajectory, points: M.expected(index) };
  const html = render(correct, index);
  assert.ok(html.includes("25/25 分") && html.includes(`${M.TRAJECTORIES[definition.trajectory]}（正確）`));
  assert.ok(!html.includes("正確答案：") && !html.includes("reference-position"), "correct work has no redundant answer list");
  assert.ok(!html.includes('class="issue"') && !html.includes('class="unanswered"'));
  assert.ok(html.includes("位置檢查") && !html.includes("分量</th>"));
}
console.log("motion composition feedback: blank, partial credit, tolerance boundaries and four correct cases passed");
