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

const scribble = Model.createTrace();
for (let index = 0; index < Model.DRAW_BINS; index += 1) scribble[index] = Math.floor(index / 4) % 2 ? 250 : 4;
const scribbleMetrics = Analysis.analyzeTrace(scribble, "xt");
const gate = Scoring.grossGate(scribbleMetrics);
assert.equal(gate.invalid, true);
assert.ok(gate.signals.length >= 2);

const wrongCurve = Scoring.exemplarTrace("accelerating-xt");
const curveResult = Scoring.scoreTask(Tasks.taskById("uniform-xt"), wrongCurve);
assert.ok(curveResult.score < 4.5, "a steepening curve must lose fixed-slope credit");

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

console.log("Qualitative kinematics scoring tests passed");
