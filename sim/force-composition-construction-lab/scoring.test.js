"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");
const P = require("./persistence.js");
const S = require("./scoring.js");

const scenario = G.generateScenario({ seed: 91 });

function correctAnswer(question, order) {
  const answer = M.freshAnswer(question);
  if (question.type === "parallelogram") {
    answer.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
    answer.guides = [
      { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "CORNER" } },
      { originKey: "F2_HEAD", end: { mode: "snap", targetKey: "CORNER" } }
    ];
    answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CORNER" } };
  } else {
    const actualOrder = order || question.forces.map((_, index) => index);
    answer.placements[actualOrder[0]] = { mode: "snap", targetKey: "ORIGIN" };
    for (let index = 1; index < actualOrder.length; index += 1) answer.placements[actualOrder[index]] = { mode: "snap", targetKey: M.headKey(actualOrder[index - 1]) };
    answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CHAIN_END" } };
  }
  return answer;
}

const blank = P.freshState(91);
assert.equal(S.score(blank, scenario).score, 0, "all blank answers score zero");

const complete = P.freshState(91);
complete.answers = scenario.questions.map((question) => correctAnswer(question));
const perfect = S.score(complete, scenario);
assert.equal(perfect.score, 100);
assert.equal(perfect.passed, true);
assert.ok(perfect.detail.every((item) => item.score === 20 && item.complete));

const partialP = P.freshState(91);
partialP.answers[0].placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
partialP.answers[0].guides[0] = { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "CORNER" } };
assert.equal(S.score(partialP, scenario).detail[0].score, 8, "P score is 2+2+4 before the second guide and resultant");

const partialH = P.freshState(91);
partialH.answers[2].placements[1] = { mode: "snap", targetKey: "ORIGIN" };
assert.equal(S.score(partialH, scenario).detail[2].score, 4, "H continuous root earns four points");
partialH.answers[2].placements[0] = { mode: "snap", targetKey: "F2_HEAD" };
assert.equal(S.score(partialH, scenario).detail[2].score, 8, "H complete chain without resultant earns eight points");

const partialT = P.freshState(91);
partialT.answers[4].placements[2] = { mode: "snap", targetKey: "ORIGIN" };
partialT.answers[4].placements[0] = { mode: "snap", targetKey: "F3_HEAD" };
assert.equal(S.score(partialT, scenario).detail[4].score, 6, "T root plus first junction scores 2+4");
partialT.answers[4].placements[1] = { mode: "snap", targetKey: "F1_HEAD" };
assert.equal(S.score(partialT, scenario).detail[4].score, 10, "T complete chain without resultant scores ten");

for (const order of [[0, 1], [1, 0]]) {
  const state = P.freshState(91);
  state.answers[2] = correctAnswer(scenario.questions[2], order);
  assert.equal(S.score(state, scenario).detail[2].score, 20, `H order ${order.join("-")} receives full credit`);
}
for (const order of G.permutations([0, 1, 2])) {
  const state = P.freshState(91);
  state.answers[4] = correctAnswer(scenario.questions[4], order);
  assert.equal(S.score(state, scenario).detail[4].score, 20, `T order ${order.join("-")} receives full credit`);
}

const freeCoincidence = P.freshState(91);
freeCoincidence.answers[2].placements[0] = { mode: "free", tail10: [3800, 2500] };
assert.equal(S.score(freeCoincidence, scenario).detail[2].score, 0, "free coordinates at O do not masquerade as a semantic snap");
assert.equal(S.PASS_SCORE, 60);
assert.ok(perfect.feedbackItems.every((item) => /作圖完整/.test(item)));

console.log("force-composition scoring tests passed");
