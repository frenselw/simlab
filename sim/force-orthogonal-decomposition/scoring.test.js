"use strict";

const assert = require("node:assert/strict");
const M = require("./model.js");
const S = require("./scoring.js");
const P = require("./persistence.js");

function complete(id) {
  const scene = M.getScenario(id);
  let directions = [];
  for (const axis of scene.axes) directions = M.commitDirection(M.add(scene.origin, M.scale(axis.unit, 180)), directions, { scene }).directions;
  let perpendiculars = [];
  for (const direction of directions) perpendiculars = M.commitPerpendicular(M.projectionFoot(scene.forceHead, direction, scene), directions, perpendiculars, { scene, bounds: P.WORLD_BOUNDS, minDistance: 4 }).perpendiculars;
  let components = [];
  for (const target of M.visibleIntersections(perpendiculars, directions, scene)) components = M.commitComponent(target.point, perpendiculars, directions, components, { scene, bounds: P.WORLD_BOUNDS, minDistance: 4 }).components;
  const theta = M.thetaCandidates(directions, scene)[0].key;
  let question = { ...M.createQuestionState(id), phase: "formulas", directions, perpendiculars, components, theta };
  question.formulas = Object.fromEntries(M.formulaExpectations(question).map(entry => [entry.key, entry.value]));
  return question;
}

const activity = P.freshDraft();
activity.phase = "summary";
activity.questions = P.SCENARIO_IDS.map(complete);
const result = S.score(activity);
assert.equal(result.score, 100);
assert.equal(result.maxScore, 100);
assert.equal(result.passed, true, "formative receipt is explicit, not a mastery threshold");
for (const question of activity.questions) {
  const detail = S.questionDetail(question, 0);
  assert.equal(detail.groups.length, 5);
  assert.deepEqual(detail.groups.map(group => group.points), [20, 20, 20, 20, 20]);
  assert.equal(detail.groups.find(group => group.key === "theta").items.length, 1);
  assert.equal(detail.groups.every(group => group.correct), true);
}

const partial = P.clone(activity);
partial.questions[1] = M.createQuestionState("inclined-external-force");
partial.questions[1].phase = "directions";
const partialResult = S.score(partial);
assert.ok(partialResult.score >= 0 && partialResult.score < 100, "partial work receives bounded formative credit");
assert.equal(partialResult.detail[1].score, 0);

const imperfectDirections = [
  { key: "D1", unit: { x: .6, y: .8 }, axis: null },
  { key: "D2", unit: { x: .8, y: -.6 }, axis: null }
];
const imperfectTheta = M.thetaCandidatesForInteraction(imperfectDirections, { scene: "horizontal-vertical", allowImperfect: true })[0];
const wrongAngle = { ...M.createQuestionState("horizontal-vertical"), phase: "angle", directions: imperfectDirections, theta: imperfectTheta.key };
assert.equal(S.thetaGroup(wrongAngle, M.getScenario("horizontal-vertical"))[0].correct, false, "an interaction-only theta choice remains incorrect until the formal geometry is valid");

const gravity = activity.questions[2];
const gravityExpectations = M.formulaExpectations(gravity);
assert.deepEqual(gravityExpectations.map(entry => [entry.axis, entry.value]).sort(), [["normal", "cos"], ["parallel", "sin"]]);
assert.deepEqual(S.formulaGroup(gravity, M.getScenario("inclined-gravity")).map(entry => entry.label).sort(), ["Gₓ 的分力表達式", "Gᵧ 的分力表達式"].sort());
const reversedGravity = P.clone(gravity);
reversedGravity.components.reverse();
reversedGravity.components = reversedGravity.components.map((entry, index) => ({ ...entry, key: `F${index + 1}` }));
const reversedExpectations = M.formulaExpectations(reversedGravity);
assert.deepEqual(reversedExpectations.map(entry => entry.value).sort(), ["cos", "sin"], "formula meaning survives F1/F2 creation order");
assert.deepEqual(reversedExpectations.map(entry => [entry.key, entry.value]), [["F1", "sin"], ["F2", "cos"]], "gravity formula slots keep Gₓ/Gᵧ semantics");
const reversedGravityDetail = S.questionDetail(reversedGravity, 2);
const reversedComponentItems = reversedGravityDetail.groups.find(group => group.key === "components").items;
assert.equal(reversedComponentItems.every(item => item.correct), false, "gravity rejects swapped Gₓ/Gᵧ placement");
assert.match(reversedComponentItems.map(item => item.detail).join("；"), /Gₓ 平行斜面、Gᵧ 垂直斜面/);

const clipped = S.score({ ...activity, questions: activity.questions.map(question => ({ ...question, formulas: { F1: "tan", F2: "tan" } })) });
assert.ok(clipped.score >= 0 && clipped.score <= 100, "score is always clipped to 0–100");

console.log("force orthogonal decomposition scoring tests passed");
