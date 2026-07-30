"use strict";
const assert = require("assert");
const Model = require("./model.js");
const Scoring = require("./scoring.js");

function placement(task, mode = "pointer", overrides = {}) {
  return { task, mode, moveNorm: .03, zeroErrorPx: 0, edgeGapPx: 10, ...overrides };
}
function perfectAnswer(withEvidence = true) {
  const frequencyHz = 5;
  const totals = Scoring.expectedTotals(frequencyHz);
  const gaps = Scoring.expectedGaps(frequencyHz);
  const measurements = {};
  Scoring.TOTAL_KEYS.forEach((key, index) => { measurements[key] = { status: "recorded", readingM: totals[index], usedTotalPlacement: withEvidence }; });
  Scoring.GAP_KEYS.forEach((key, index) => { measurements[key] = { status: "recorded", readingM: gaps[index] }; });
  const evidence = { setupCompleted: true };
  if (withEvidence) {
    evidence.totalPlacement = { mode: "pointer", moveNorm: .03, rulerZeroM: 0, edgeSide: "right", zeroErrorPx: 0, edgeGapPx: 10 };
    Scoring.GAP_KEYS.forEach((key, index) => { evidence[key] = { ...placement(key), readingM: gaps[index], usedWhileValid: true }; });
  }
  return {
    frequencyHz, frequencyActivelySelected: true, measurements, evidence,
    analysis: {
      deltaTS: .2,
      cumulativeTimeRatio: { status: "answered", values: [1, 2, 3, 4] },
      totalDisplacementRatio: { status: "answered", values: [1, 4, 9, 16] },
      intervalTimeRatio: { status: "answered", values: [1, 1, 1, 1] },
      intervalDistanceRatio: { status: "answered", values: [1, 3, 5, 7] },
      lawAnswerId: "square", intervalLawAnswerId: "odd", accelerationAnswerId: "constant-acceleration"
    }
  };
}

const perfect = Scoring.scoreAttempt(perfectAnswer());
assert.strictEqual(perfect.score, 100);
assert.strictEqual(perfect.passed, true);
assert.strictEqual(perfect.detail.process.points, 40);
const noEvidence = Scoring.scoreAttempt(perfectAnswer(false));
assert.strictEqual(noEvidence.rawScore, 64);
assert.strictEqual(noEvidence.score, 59);
assert.strictEqual(noEvidence.passed, false);

const gateBoundary = perfectAnswer();
gateBoundary.measurements.total4.usedTotalPlacement = false;
delete gateBoundary.evidence.gap34;
assert.strictEqual(Scoring.scoreAttempt(gateBoundary).meaningfulRulerUse, true);
gateBoundary.measurements.total3.usedTotalPlacement = false;
assert.strictEqual(Scoring.scoreAttempt(gateBoundary).meaningfulRulerUse, false);

for (const [value, expected] of [[.0249, false], [.025, true], [.0251, true]]) assert.strictEqual(Scoring.validPlacement(placement("total", "pointer", { moveNorm: value }), "total"), expected);
for (const [value, expected] of [[.9999, true], [1, true], [1.0001, false]]) assert.strictEqual(Scoring.validPlacement(placement("total", "pointer", { moveNorm: value }), "total"), expected);
for (const [value, expected] of [[5.99, true], [6, true], [6.01, false]]) assert.strictEqual(Scoring.validPlacement(placement("total", "pointer", { zeroErrorPx: value }), "total"), expected);
for (const [value, expected] of [[5.99, false], [6, true], [6.01, true], [43.99, true], [44, true], [44.01, false]]) assert.strictEqual(Scoring.validPlacement(placement("total", "keyboard", { edgeGapPx: value }), "total"), expected);
assert.strictEqual(Scoring.within(.205, .2, .005), true);
assert.strictEqual(Scoring.within(.2051, .2, .005), false);
assert.strictEqual(Scoring.within(.23, .2, Scoring.distanceTolerance(.2)), true);
assert.strictEqual(Scoring.within(.2301, .2, Scoring.distanceTolerance(.2)), false);
assert.strictEqual(Scoring.within(3.392, 3.2, Scoring.distanceTolerance(3.2)), true);
assert.strictEqual(Scoring.within(3.3921, 3.2, Scoring.distanceTolerance(3.2)), false);
assert.strictEqual(Scoring.scoreRatio({ status: "answered", values: [1, 4.15, 9, 16] }, [1, 4, 9, 16], 1).points, 3);
assert.strictEqual(Scoring.scoreRatio({ status: "answered", values: [1, 4.1501, 9, 16] }, [1, 4, 9, 16], 1).points, 2);
assert.deepStrictEqual(Scoring.ratioTarget([.3, 1.25, 2.8, 5]).map((v) => Number(v.toFixed(3))), [1, 4.167, 9.333, 16.667]);
assert.strictEqual(Scoring.validPlacement(placement("gap01", "keyboard"), "gap01"), true);
assert.strictEqual(Scoring.scoreAttempt({ ...perfectAnswer(), analysis: { ...perfectAnswer().analysis, lawAnswerId: "linear" } }).detail.laws.points, 18);
assert.strictEqual(Scoring.ratioTarget([0, 1, 2, 3]), null);
assert.strictEqual(Scoring.ratioTarget([1, -1, 2, 3]), null);
assert.strictEqual(Scoring.scoreRatio({ status: "answered", values: [2, 4, 9, 16] }, [1, 4, 9, 16], 1).points, 0);
assert.strictEqual(Scoring.scoreRatio({ status: "answered", values: [1, Infinity, 9, 16] }, [1, 4, 9, 16], 1).points, 0);
const wrongAnswers = perfectAnswer();
wrongAnswers.analysis.deltaTS = .3;
wrongAnswers.analysis.cumulativeTimeRatio = { status: "answered", values: [1, 8, 8, 8] };
wrongAnswers.analysis.totalDisplacementRatio = { status: "answered", values: [1, 8, 8, 8] };
wrongAnswers.analysis.intervalTimeRatio = { status: "answered", values: [1, 8, 8, 8] };
wrongAnswers.analysis.intervalDistanceRatio = { status: "answered", values: [1, 8, 8, 8] };
wrongAnswers.analysis.lawAnswerId = "linear";
wrongAnswers.analysis.intervalLawAnswerId = "equal";
wrongAnswers.analysis.accelerationAnswerId = "constant-speed";
assert.strictEqual(Scoring.scoreAttempt(wrongAnswers).score, 56);
const invalidPlacementAnswer = perfectAnswer();
invalidPlacementAnswer.evidence.totalPlacement.moveNorm = 1.01;
assert.strictEqual(Scoring.scoreAttempt(invalidPlacementAnswer).detail.process.totalPlacement, 0);
assert.strictEqual(Scoring.scoreAttempt(invalidPlacementAnswer).score, 59);
const diagnosticAnswer = perfectAnswer(false);
const diagnostic = Scoring.measurementDiagnostic(diagnosticAnswer, Scoring.scoreAttempt(diagnosticAnswer));
assert.ok(diagnostic.some((message) => message.includes("正確讀數未連結有效尺位")));
assert.ok(diagnostic.some((message) => message.includes("59")));
console.log("free-fall scoring tests passed");

module.exports = { perfectAnswer, placement };
