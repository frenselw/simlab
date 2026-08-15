"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");

const scenario = G.generateScenario({ seed: 7 });

function correctParallelogram(index = 0) {
  const question = scenario.questions[index];
  let answer = M.freshAnswer(question);
  answer.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
  answer.guides = [
    { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "CORNER" } },
    { originKey: "F2_HEAD", end: { mode: "snap", targetKey: "CORNER" } }
  ];
  answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CORNER" } };
  return answer;
}

function chainAnswer(question, order, completeResultant = true) {
  const answer = M.freshAnswer(question);
  answer.placements[order[0]] = { mode: "snap", targetKey: "ORIGIN" };
  for (let index = 1; index < order.length; index += 1) answer.placements[order[index]] = { mode: "snap", targetKey: M.headKey(order[index - 1]) };
  if (completeResultant) answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CHAIN_END" } };
  return answer;
}

const firstQuestion = scenario.questions[0];
const initial = M.freshAnswer(firstQuestion);
const beforeForce = firstQuestion.forces[0];
const moved = M.commitForceTranslation(initial, 0, { x: 270, y: 130 }, firstQuestion, { pointerType: "mouse" });
assert.equal(firstQuestion.forces[0].dx, beforeForce.dx);
assert.equal(firstQuestion.forces[0].dy, beforeForce.dy);
assert.equal(Math.hypot(firstQuestion.forces[0].dx, firstQuestion.forces[0].dy), Math.hypot(beforeForce.dx, beforeForce.dy), "translation cannot resize the vector");
assert.equal(moved.placements[0].mode, "snap", "the first placed force establishes a freely chosen common anchor");
assert.deepEqual(moved.anchor10, [2700, 1300]);
const secondAtArbitraryAnchor = M.commitForceTranslation(moved, 1, { x: 270, y: 130 }, firstQuestion, { pointerType: "mouse" });
assert.deepEqual(M.forceGeometry(secondAtArbitraryAnchor, firstQuestion).map((item) => item.tail), [{ x: 270, y: 130 }, { x: 270, y: 130 }], "the second force snaps to the selected anchor, not a fixed screen point");

const nearOrigin = M.commitForceTranslation(initial, 0, { x: 399, y: 250 }, firstQuestion, { pointerType: "touch" });
assert.deepEqual(nearOrigin.placements[0], { mode: "snap", targetKey: "ORIGIN" }, "19 CSS px touch distance snaps");
const outsideOrigin = M.commitForceTranslation(initial, 0, { x: 401, y: 250 }, firstQuestion, { pointerType: "touch" });
assert.equal(outsideOrigin.placements[0].mode, "snap", "the first force may establish an anchor at any valid position");
assert.notDeepEqual(outsideOrigin.anchor10, [3800, 2500]);
assert.ok(M.selectSnapCandidate({ x: 14, y: 0 }, [{ key: "A", point: { x: 0, y: 0 } }], { pointerType: "mouse" }), "inclusive 14px pointer threshold snaps");
assert.equal(M.selectSnapCandidate({ x: 14.01, y: 0 }, [{ key: "A", point: { x: 0, y: 0 } }], { pointerType: "mouse" }), null);
assert.ok(M.selectSnapCandidate({ x: 6, y: 0 }, [{ key: "A", point: { x: 0, y: 0 } }], { pointerType: "keyboard", project: (point) => ({ x: point.x * 2, y: point.y * 2 }) }), "keyboard threshold is evaluated in projected CSS pixels");
assert.equal(M.selectSnapCandidate({ x: 10, y: 0 }, [{ key: "B", point: { x: 0, y: 0 } }, { key: "A", point: { x: 0, y: 0 } }], { threshold: 20 }).key, "A", "equal-distance ties use stable key order");

const P = correctParallelogram();
assert.equal(M.derivedVariant(P, firstQuestion), "complete");
const releasedP = M.previewForceTranslation(P, 0, { x: 200, y: 200 }, firstQuestion);
assert.deepEqual(releasedP.guides, [null, null], "moving a common-origin force atomically clears both guides");
assert.equal(releasedP.resultant, null, "moving a common-origin force atomically clears resultant");

const P2Question = scenario.questions[1];
let P2 = M.freshAnswer(P2Question);
P2.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
P2 = M.commitGuide(P2, "ORIGIN", M.corner(P2Question), P2Question, { threshold: 1000 });
assert.equal(P2.guides.filter(Boolean)[0].end.mode, "free", "wrong neutral guide origin remains provisional even on the corner");
assert.throws(() => M.commitGuide({ ...M.freshAnswer(firstQuestion), placements: P2.placements }, "ORIGIN", M.corner(firstQuestion), firstQuestion), /not available|Guide/);
const guideOrigin = M.endpointForKey(P, firstQuestion, "F1_HEAD");
const guideDirection = firstQuestion.forces[1];
const arbitraryGuideEnd = { x: guideOrigin.x + guideDirection.dx * 0.4, y: guideOrigin.y + guideDirection.dy * 0.4 };
const parallelGuide = M.commitGuide(P, "F1_HEAD", arbitraryGuideEnd, firstQuestion);
assert.deepEqual(parallelGuide.guides[0].end.mode, "snap");
assert.equal(parallelGuide.guides[0].end.targetKey, "PARALLEL", "a guide snaps by direction without requiring the fourth vertex");
assert.ok(Math.abs(M.distance(M.lineEndPoint(parallelGuide.guides[0], parallelGuide, firstQuestion), guideOrigin) - M.distance(arbitraryGuideEnd, guideOrigin)) < 1, "parallel snap preserves learner-chosen guide length");

const HQuestion = scenario.questions[2];
for (const order of [[0, 1], [1, 0]]) {
  const answer = chainAnswer(HQuestion, order);
  assert.deepEqual(M.chainInfo(answer, HQuestion).order, order);
  assert.equal(M.canonicalResultant(answer, HQuestion), true);
  assert.deepEqual(M.corner(HQuestion), M.endpointForKey(answer, HQuestion, "CHAIN_END"));
}

const TQuestion = scenario.questions[4];
const resultantEndpoints = [];
for (const order of G.permutations([0, 1, 2])) {
  const answer = chainAnswer(TQuestion, order);
  const chain = M.chainInfo(answer, TQuestion);
  assert.equal(chain.valid, true);
  assert.equal(chain.complete, true);
  assert.deepEqual(chain.order, order);
  assert.equal(M.canonicalResultant(answer, TQuestion), true);
  resultantEndpoints.push(M.endpointForKey(answer, TQuestion, "CHAIN_END"));
}
assert.ok(resultantEndpoints.every((point) => M.distance(point, resultantEndpoints[0]) <= M.MODEL_EPSILON), "all six orders have the same resultant endpoint");

const chain = chainAnswer(TQuestion, [0, 1, 2], false);
const beforeTails = M.resolveTails(chain, TQuestion);
const detached = M.previewForceTranslation(chain, 0, { x: 200, y: 150 }, TQuestion);
assert.equal(detached.placements[1].mode, "free");
assert.equal(detached.placements[2].mode, "free");
assert.deepEqual(M.fromPoint10(detached.placements[1].tail10), { x: Math.round(beforeTails[1].x * 10) / 10, y: Math.round(beforeTails[1].y * 10) / 10 }, "moving an upstream force releases descendants without moving their visible tails");

const branched = chainAnswer(TQuestion, [0, 1], false);
branched.placements[2] = { mode: "snap", targetKey: "F1_HEAD" };
assert.equal(M.chainInfo(branched, TQuestion).valid, false, "branches are rejected");
const cycle = M.freshAnswer(TQuestion);
cycle.placements[0] = { mode: "snap", targetKey: "F2_HEAD" };
cycle.placements[1] = { mode: "snap", targetKey: "F1_HEAD" };
assert.equal(M.chainInfo(cycle, TQuestion).valid, false, "cycles are rejected");

assert.deepEqual(M.clampLinePoint({ x: -100, y: 900 }), { x: 24, y: 476 });
const clampedTail = M.clampForceTail({ x: -500, y: 900 }, firstQuestion.forces[0]);
const clampedHead = M.add(clampedTail, firstQuestion.forces[0]);
assert.ok(clampedTail.x >= 34 && clampedTail.y >= 34 && clampedHead.x <= 726 && clampedHead.y <= 466, "whole force stays inside hard visual bounds");

console.log("force-composition model tests passed");
