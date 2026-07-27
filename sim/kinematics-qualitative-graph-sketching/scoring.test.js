"use strict";

const assert = require("node:assert/strict");
const Tasks = require("./task-definitions.js");
const Model = require("./graph-model.js");
const Analysis = require("./graph-analysis.js");
const Scoring = require("./scoring.js");

const idealAnswers = Tasks.TASKS.map((task) => Model.encodeTrace(Scoring.exemplarTrace(task.id)));
const ideal = Scoring.scoreActivity(idealAnswers);
assert.ok(ideal.unroundedScore > 95);
assert.equal(ideal.score, Math.round(ideal.unroundedScore));
assert.equal(ideal.passed, true);
assert.deepEqual(ideal.categoryMaximums, { xt: 36, vt: 32, at: 32 });
assert.equal(ideal.taskResults.every((result) => result.score >= result.maxScore * 0.75), true);

const blank = Scoring.scoreActivity(Array(12).fill(null));
assert.equal(blank.score, 0);
assert.equal(blank.passed, false);
assert.equal(blank.taskResults.every((result) => result.grossInvalid), true);

const withoutVt = idealAnswers.slice();
Tasks.TASKS.forEach((task, index) => { if (task.graphType === "vt") withoutVt[index] = null; });
const noVt = Scoring.scoreActivity(withoutVt);
assert.ok(noVt.score >= 65, "overall score alone would pass");
assert.equal(noVt.categoryScores.vt, 0);
assert.equal(noVt.passed, false, "v–t mastery floor is mandatory");

const withoutAt = idealAnswers.slice();
Tasks.TASKS.forEach((task, index) => { if (task.graphType === "at") withoutAt[index] = null; });
assert.equal(Scoring.scoreActivity(withoutAt).passed, false, "a–t mastery floor is mandatory");

const withoutComposite = idealAnswers.slice();
Tasks.TASKS.forEach((task, index) => { if (task.scenarioId === "composite") withoutComposite[index] = null; });
assert.equal(Scoring.scoreActivity(withoutComposite).passed, false, "composite floor is mandatory");

const short = Model.createTrace();
for (let index = 0; index < 16; index += 1) short[index] = 180;
const shortResult = Scoring.scoreTask(Tasks.taskById("uniform-vt"), short);
assert.equal(shortResult.score, 0);
assert.equal(shortResult.grossInvalid, true);

const gapped = Scoring.exemplarTrace("uniform-vt");
for (let index = 40; index < 56; index += 1) gapped[index] = Model.EMPTY;
const gappedResult = Scoring.scoreTask(Tasks.taskById("uniform-vt"), gapped);
assert.equal(gappedResult.grossInvalid, false);
assert.ok(gappedResult.score > 0, "a single valid gap cannot clear all physics evidence");
assert.ok(gappedResult.score < 5);

const sparse = Model.createTrace();
for (let index = 0; index < Model.DRAW_BINS; index += 4) {
  const t = index / (Model.DRAW_BINS - 1);
  sparse[index] = Model.quantizeY(0.68 + 0.12 * t);
}
const sparseResult = Scoring.scoreTask(Tasks.taskById("uniform-vt"), sparse);
assert.equal(sparseResult.grossInvalid, false, "isolated samples are incomplete evidence, not necessarily scribble");
assert.equal(sparseResult.evidenceComplete, false, "one isolated point per analysis bucket is not complete evidence");
assert.ok(sparseResult.score < sparseResult.maxScore * 0.75, "sparse alias cannot receive near-full credit");

const scribble = Model.createTrace();
for (let index = 0; index < Model.DRAW_BINS; index += 1) scribble[index] = Math.floor(index / 4) % 2 ? 250 : 4;
const scribbleMetrics = Analysis.analyzeTrace(scribble, "xt");
const gate = Scoring.grossGate(scribbleMetrics);
assert.equal(gate.invalid, true);
assert.ok(gate.signals.length >= 2);

for (const period of [1, 2]) {
  const alias = Model.createTrace();
  for (let index = 0; index < Model.DRAW_BINS; index += 1) {
    alias[index] = Math.floor(index / period) % 2 ? 250 : 4;
  }
  const aliased = Scoring.scoreTask(Tasks.taskById("uniform-vt"), alias);
  assert.equal(aliased.grossInvalid, true, `period-${period} alternating trace is gross-invalid`);
  assert.equal(aliased.score, 0);
}

const wrongCurve = Scoring.exemplarTrace("accelerating-xt");
const curveResult = Scoring.scoreTask(Tasks.taskById("uniform-xt"), wrongCurve);
assert.ok(curveResult.score < 4.5, "a steepening curve must lose fixed-slope credit");

const exactLine = Scoring.exemplarTrace("uniform-xt");
const exactLineMetrics = Analysis.analyzeTrace(exactLine, "xt");
assert.ok(Scoring.curveEvidence(exactLineMetrics, 1) < 0.05, "an exact line has no accelerating-curve evidence");
assert.ok(Scoring.curveEvidence(exactLineMetrics, -1) < 0.05, "an exact line has no decelerating-curve evidence");

const zeroAxisAt = idealAnswers.slice();
for (const taskId of ["accelerating-at", "decelerating-at", "composite-at"]) {
  zeroAxisAt[Tasks.taskIndexById(taskId)] = Model.encodeTrace(Scoring.exemplarTrace("uniform-at"));
}
const semanticAtFailure = Scoring.scoreActivity(zeroAxisAt);
assert.ok(semanticAtFailure.score >= 65);
assert.ok(semanticAtFailure.categoryScores.at >= Scoring.CATEGORY_FLOORS.at);
assert.equal(semanticAtFailure.passed, false);
assert.ok(semanticAtFailure.masteryFailures.some((failure) => failure.code === "accelerating-at-positive"));
assert.ok(semanticAtFailure.masteryFailures.some((failure) => failure.code === "decelerating-at-negative"));
assert.ok(semanticAtFailure.masteryFailures.some((failure) => failure.code === "composite-at-signs"));

function atTrace(fn) {
  const trace = Model.createTrace();
  for (let index = 0; index < Model.DRAW_BINS; index += 1) {
    const t = index / (Model.DRAW_BINS - 1);
    trace[index] = Model.quantizeY(fn(t) + 0.5);
  }
  return trace;
}

const slopedAt = idealAnswers.slice();
slopedAt[Tasks.taskIndexById("accelerating-at")] = Model.encodeTrace(atTrace((t) => 0.12 + 0.28 * t));
slopedAt[Tasks.taskIndexById("decelerating-at")] = Model.encodeTrace(atTrace((t) => -0.12 - 0.28 * t));
slopedAt[Tasks.taskIndexById("composite-at")] = Model.encodeTrace(atTrace((t) => {
  const phase = Math.min(3, Math.floor(t * 4));
  const u = phase === 3 ? (t - 0.75) * 4 : (t - phase / 4) * 4;
  if (phase === 0) return 0.12 + 0.25 * u;
  if (phase === 2) return -0.12 - 0.25 * u;
  return 0;
}));
const slopedAtFailure = Scoring.scoreActivity(slopedAt);
assert.equal(slopedAtFailure.passed, false);
assert.ok(slopedAtFailure.masteryFailures.some((failure) => failure.code === "accelerating-at-positive"),
  "positive but sloped accelerating a-t fails fixed-positive mastery");
assert.ok(slopedAtFailure.masteryFailures.some((failure) => failure.code === "decelerating-at-negative"),
  "negative but sloped decelerating a-t fails fixed-negative mastery");
assert.ok(slopedAtFailure.masteryFailures.some((failure) => failure.code === "composite-at-signs"),
  "correct-sign but sloped composite phases fail mastery");

function signedGross(sign) {
  const trace = Model.createTrace();
  for (let index = 0; index < Model.DRAW_BINS; index += 1) {
    const normalized = sign * (index % 2 ? 0.44 : 0.12);
    trace[index] = Model.quantizeY(normalized + 0.5);
  }
  return trace;
}

const grossSignedAt = idealAnswers.slice();
grossSignedAt[Tasks.taskIndexById("accelerating-at")] = Model.encodeTrace(signedGross(1));
grossSignedAt[Tasks.taskIndexById("decelerating-at")] = Model.encodeTrace(signedGross(-1));
grossSignedAt[Tasks.taskIndexById("composite-at")] = Model.encodeTrace(atTrace((t) => {
  const phase = Math.min(3, Math.floor(t * 4));
  if (phase === 0) return Math.floor(t * 96) % 2 ? 0.44 : 0.12;
  if (phase === 2) return Math.floor(t * 96) % 2 ? -0.44 : -0.12;
  return 0;
}));
const grossSignedFailure = Scoring.scoreActivity(grossSignedAt);
assert.ok(grossSignedFailure.taskResults[Tasks.taskIndexById("accelerating-at")].grossInvalid);
assert.ok(grossSignedFailure.taskResults[Tasks.taskIndexById("decelerating-at")].grossInvalid);
assert.ok(grossSignedFailure.taskResults[Tasks.taskIndexById("composite-at")].grossInvalid);
assert.ok(grossSignedFailure.masteryFailures.some((failure) => failure.code === "accelerating-at-positive"));
assert.ok(grossSignedFailure.masteryFailures.some((failure) => failure.code === "decelerating-at-negative"));
assert.ok(grossSignedFailure.masteryFailures.some((failure) => failure.code === "composite-at-signs"));

const straightXt = idealAnswers.slice();
straightXt[Tasks.taskIndexById("accelerating-xt")] = Model.encodeTrace(Scoring.exemplarTrace("uniform-xt"));
straightXt[Tasks.taskIndexById("decelerating-xt")] = Model.encodeTrace(Scoring.exemplarTrace("uniform-xt"));
const semanticXtFailure = Scoring.scoreActivity(straightXt);
assert.equal(semanticXtFailure.passed, false);
assert.ok(semanticXtFailure.masteryFailures.some((failure) => failure.code === "accelerating-xt-curve"));
assert.ok(semanticXtFailure.masteryFailures.some((failure) => failure.code === "decelerating-xt-curve"));

const grossXt = idealAnswers.slice();
for (const taskId of ["accelerating-xt", "decelerating-xt"]) {
  const trace = Scoring.exemplarTrace(taskId);
  for (let index = 0; index < trace.length; index += 1) {
    trace[index] = Math.max(1, Math.min(254, trace[index] + (index % 2 ? 60 : -60)));
  }
  grossXt[Tasks.taskIndexById(taskId)] = Model.encodeTrace(trace);
}
const grossXtFailure = Scoring.scoreActivity(grossXt);
assert.ok(grossXtFailure.masteryFailures.some((failure) => failure.code === "accelerating-xt-curve"));
assert.ok(grossXtFailure.masteryFailures.some((failure) => failure.code === "decelerating-xt-curve"));

const sparseXt = idealAnswers.slice();
for (const taskId of ["accelerating-xt", "decelerating-xt"]) {
  const trace = Scoring.exemplarTrace(taskId);
  for (let index = 0; index < trace.length; index += 1) {
    if (index % 4 !== 0) trace[index] = Model.EMPTY;
  }
  sparseXt[Tasks.taskIndexById(taskId)] = Model.encodeTrace(trace);
}
const sparseXtFailure = Scoring.scoreActivity(sparseXt);
assert.equal(sparseXtFailure.taskResults[Tasks.taskIndexById("accelerating-xt")].evidenceComplete, false);
assert.equal(sparseXtFailure.taskResults[Tasks.taskIndexById("decelerating-xt")].evidenceComplete, false);
assert.ok(sparseXtFailure.masteryFailures.some((failure) => failure.code === "accelerating-xt-curve"));
assert.ok(sparseXtFailure.masteryFailures.some((failure) => failure.code === "decelerating-xt-curve"));

const compositeXtTask = Tasks.taskById("composite-xt");
const compositeXtResult = Scoring.scoreTask(compositeXtTask, Scoring.exemplarTrace(compositeXtTask.id));
assert.ok(compositeXtResult.score >= 12.25, "official composite x–t exemplar is near full credit");
assert.deepEqual(compositeXtResult.feedback, ["圖線已清楚表達這段運動的主要特徵。"]);

const incompleteCoverage = Scoring.exemplarTrace("uniform-vt");
for (let index = 76; index < 96; index += 1) incompleteCoverage[index] = Model.EMPTY;
const incompleteResult = Scoring.scoreTask(Tasks.taskById("uniform-vt"), incompleteCoverage);
assert.equal(incompleteResult.grossInvalid, false);
assert.equal(incompleteResult.evidenceComplete, false);
assert.match(incompleteResult.evidenceReason, /時間範圍|端點|可判讀/);

const contradictionAnswers = idealAnswers.slice();
contradictionAnswers[Tasks.taskIndexById("accelerating-vt")] =
  Model.encodeTrace(Scoring.exemplarTrace("decelerating-vt"));
const contradiction = Scoring.scoreActivity(contradictionAnswers);
assert.ok(contradiction.contradictions.some((message) => /正加速度.*下降/.test(message)));

assert.equal(Scoring.fadeUp(0.75, 0.5, 0.75), 1);
assert.equal(Scoring.fadeUp(0.5, 0.5, 0.75), 0);
assert.equal(Scoring.fullThenFade(0.08, 0.08, 0.16), 1);
assert.equal(Scoring.fullThenFade(0.16, 0.08, 0.16), 0);
assert.equal(ideal.score, Math.round(ideal.unroundedScore), "rounding occurs after all components");
assert.deepEqual(ideal.masteryFailures, []);
assert.deepEqual(ideal.evidenceIncompleteTaskIds, []);

console.log("Qualitative kinematics scoring tests passed");
