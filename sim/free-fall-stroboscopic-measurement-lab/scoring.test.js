"use strict";
const assert = require("assert");
const Model = require("./model.js");
const Scoring = require("./scoring.js");

function placement(task, mode = "pointer", overrides = {}) {
  return {
    task, mode, moveNorm: .03, rulerX: 100, rulerSide: "left", rulerGeometry: "fixed-left-v1",
    horizontalMode: "guide-fraction", guideFraction: 20 / 205,
    zeroErrorPx: 0, zeroTickOverlapPx: 23, ...overrides
  };
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
    evidence.totalPlacement = {
      mode: "pointer", moveNorm: .03, rulerZeroM: 0, rulerX: 100, rulerSide: "left", rulerGeometry: "fixed-left-v1",
      horizontalMode: "guide-fraction", guideFraction: 20 / 205,
      zeroErrorPx: 0, zeroTickOverlapPx: 23
    };
    Scoring.GAP_KEYS.forEach((key, index) => { evidence[key] = { ...placement(key), readingM: gaps[index], usedWhileValid: true }; });
  }
  return {
    rubricVersion: 3, frequencyHz, frequencyAssigned: true, measurements, evidence,
    analysis: {
      deltaTS: .2,
      cumulativeTimeRatio: { values: [1, 2, 3, 4] },
      intervalTimeRatio: { values: [1, 1, 1, 1] },
      lawAnswerId: "square", intervalLawAnswerId: "odd", accelerationAnswerId: "constant-acceleration"
    }
  };
}

const perfect = Scoring.scoreAttempt(perfectAnswer());
assert.strictEqual(perfect.score, 100);
assert.strictEqual(perfect.passed, true);
assert.strictEqual(perfect.detail.process.points, 40);
assert.strictEqual(perfect.detail.quantitative.points, 30);
assert.strictEqual(perfect.detail.laws.points, 30);
for (const group of [perfect.detail.process.items, perfect.detail.quantitative.items, perfect.detail.laws.items]) {
  for (const item of group) assert.deepStrictEqual(Object.keys(item),
    ["id", "label", "status", "learner", "expected", "guidance", "points", "max"]);
}
const oneBlankRatioTerm = perfectAnswer();
oneBlankRatioTerm.analysis.cumulativeTimeRatio.values[2] = null;
const oneBlankRatioScore = Scoring.scoreAttempt(oneBlankRatioTerm);
assert.strictEqual(oneBlankRatioScore.detail.ratios.cumulativeTime.items[1].status, "unanswered");
assert.ok(Math.abs(oneBlankRatioScore.detail.quantitative.ratios - 25 / 3) < 1e-9,
  "each of the six editable ratio terms scores independently at 5/3 points");
const legacyPerfect = perfectAnswer();
legacyPerfect.rubricVersion = 2;
legacyPerfect.analysis = {
  deltaTS: .2,
  cumulativeTimeRatio: { status: "answered", values: [1, 2, 3, 4] },
  totalDisplacementRatio: { status: "answered", values: [1, 4, 9, 16] },
  intervalTimeRatio: { status: "answered", values: [1, 1, 1, 1] },
  intervalDistanceRatio: { status: "answered", values: [1, 3, 5, 7] },
  lawAnswerId: "square", intervalLawAnswerId: "odd", accelerationAnswerId: "constant-acceleration"
};
assert.strictEqual(Scoring.scoreAttempt(legacyPerfect).score, 100, "rubric-2 immutable answers use the legacy scorer");
const legacyNoEvidence = JSON.parse(JSON.stringify(legacyPerfect));
delete legacyNoEvidence.evidence.totalPlacement;
Scoring.TOTAL_KEYS.forEach((key) => { legacyNoEvidence.measurements[key].usedTotalPlacement = false; });
Scoring.GAP_KEYS.forEach((key) => { delete legacyNoEvidence.evidence[key]; });
assert.ok(Scoring.scoreAttempt(legacyNoEvidence).detail.process.items
  .filter((item) => item.id !== "setup").every((item) => item.status === "no-evidence"),
"legacy rubric2 zero process components are no-evidence, never unanswered");
assert.throws(() => Scoring.scoreAttempt({ ...perfectAnswer(), rubricVersion: 99 }), /Unsupported/);
const blankAnswer = perfectAnswer();
blankAnswer.analysis = {
  deltaTS: null, cumulativeTimeRatio: { values: [1, null, null, null] },
  intervalTimeRatio: { values: [1, null, null, null] },
  lawAnswerId: null, intervalLawAnswerId: null, accelerationAnswerId: null
};
const blankScore = Scoring.scoreAttempt(blankAnswer);
assert.deepStrictEqual({ raw: blankScore.rawScore, final: blankScore.score, passed: blankScore.passed },
  { raw: 56, final: 56, passed: false });
assert.strictEqual([...blankScore.detail.quantitative.items, ...blankScore.detail.laws.items]
  .filter((item) => item.status === "unanswered").length, 10);
const blankCases = [
  ["deltaTS", null, "delta-t", 4],
  ...["cumulativeTimeRatio", "intervalTimeRatio"].flatMap((key) => [1, 2, 3].map((index) =>
    [`${key}.${index}`, null, `${key === "cumulativeTimeRatio" ? "cumulative-time" : "interval-time"}-${index + 1}`, 5 / 3])),
  ["lawAnswerId", null, "displacement", 12], ["intervalLawAnswerId", null, "intervals", 10],
  ["accelerationAnswerId", null, "acceleration", 8]
];
for (const [path, , itemId, max] of blankCases) {
  const answer = perfectAnswer();
  if (path.includes(".")) { const [key, index] = path.split("."); answer.analysis[key].values[Number(index)] = null; }
  else answer.analysis[path] = null;
  const scored = Scoring.scoreAttempt(answer);
  const item = [...scored.detail.quantitative.items, ...scored.detail.laws.items].find((entry) => entry.id === itemId);
  assert.equal(item.status, "unanswered", `${path} maps to its own unanswered detail item`);
  assert.ok(Math.abs(scored.rawScore - (100 - max)) < 1e-9);
}
const skippedAnswer = perfectAnswer();
skippedAnswer.measurements.total2 = { status: "skipped" };
skippedAnswer.measurements.total1.usedTotalPlacement = false;
skippedAnswer.measurements.total3.usedTotalPlacement = false;
skippedAnswer.measurements.total4.usedTotalPlacement = false;
delete skippedAnswer.evidence.totalPlacement;
const skippedScore = Scoring.scoreAttempt(skippedAnswer);
assert.equal(skippedScore.detail.quantitative.items.find((item) => item.id === "total2").status, "unanswered");
assert.ok(skippedScore.detail.process.items.filter((item) => item.id.startsWith("process-total"))
  .every((item) => item.status === "no-evidence"));
for (const scored of [perfect, blankScore, skippedScore]) {
  const groupSum = scored.detail.process.points + scored.detail.quantitative.points + scored.detail.laws.points;
  assert.ok(Math.abs(scored.rawScore - groupSum) < 1e-9, "item groups reconcile to raw score");
  assert.equal(scored.score, Math.round(scored.meaningfulRulerUse ? groupSum : Math.min(groupSum, 59)));
  assert.equal(scored.passed, scored.score >= Scoring.PASS_SCORE);
}
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
for (const [value, expected] of [[-6.01, false], [-6, true], [-5.99, true], [5.99, true], [6, true], [6.01, false]]) {
  assert.strictEqual(Scoring.validPlacement(placement("total", "pointer", { zeroErrorPx: value }), "total"), expected);
}
for (const [value, expected] of [[3.99, false], [4, true], [4.01, true], [23, true]]) {
  const boundary = placement("total", "keyboard", {
    rulerX: 50, horizontalMode: "left-boundary",
    boundaryOverlapPx: value, zeroTickOverlapPx: value
  });
  delete boundary.guideFraction;
  assert.strictEqual(Scoring.validPlacement(boundary, "total"), expected);
}
assert.strictEqual(Scoring.validPlacement(placement("total", "keyboard", { zeroTickOverlapPx: Infinity }), "total"), false);
assert.strictEqual(Scoring.validPlacement(placement("total", "keyboard"), "total"), true);
for (const overrides of [
  { guideFraction: -.01 },
  { guideFraction: 1.01 },
  { guideFraction: 20 / 205, rulerX: 100.011 },
  { guideFraction: 20 / 205, rulerSide: "right" },
  { guideFraction: 20 / 205, boundaryOverlapPx: 23 },
  { guideFraction: 20 / 205, zeroTickOverlapPx: 22.98 }
]) {
  assert.strictEqual(Scoring.validPlacement(placement("total", "keyboard", overrides), "total"), false,
    `guide canonical relation rejects ${JSON.stringify(overrides)}`);
}
const validLeftBoundary = placement("total", "keyboard", {
  rulerX: 50, horizontalMode: "left-boundary", boundaryOverlapPx: 4, zeroTickOverlapPx: 4.009
});
delete validLeftBoundary.guideFraction;
assert.strictEqual(Scoring.validPlacement(validLeftBoundary, "total"), true);
const contradictoryLeftBoundary = { ...validLeftBoundary, boundaryOverlapPx: 0, zeroTickOverlapPx: 4 };
assert.strictEqual(Scoring.validPlacement(contradictoryLeftBoundary, "total"), false);
const excessiveBoundaryDifference = { ...validLeftBoundary, boundaryOverlapPx: 4, zeroTickOverlapPx: 4.011 };
assert.strictEqual(Scoring.validPlacement(excessiveBoundaryDifference, "total"), false);
const validRightBoundary = placement("total", "keyboard", {
  rulerX: 310, rulerSide: "right", horizontalMode: "right-boundary",
  boundaryOverlapPx: 4, zeroTickOverlapPx: 4
});
delete validRightBoundary.guideFraction;
assert.strictEqual(Scoring.validPlacement(validRightBoundary, "total"), true);
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
wrongAnswers.analysis.cumulativeTimeRatio = { values: [1, 8, 8, 8] };
wrongAnswers.analysis.intervalTimeRatio = { values: [1, 8, 8, 8] };
wrongAnswers.analysis.lawAnswerId = "linear";
wrongAnswers.analysis.intervalLawAnswerId = "equal";
wrongAnswers.analysis.accelerationAnswerId = "constant-speed";
const wrongScore = Scoring.scoreAttempt(wrongAnswers);
assert.strictEqual(wrongScore.score, 56);
const mixedAnswer = perfectAnswer();
mixedAnswer.analysis.deltaTS = null;
mixedAnswer.analysis.cumulativeTimeRatio.values = [1, 2, 8, null];
mixedAnswer.analysis.intervalTimeRatio.values = [1, 1, 8, null];
mixedAnswer.analysis.lawAnswerId = "linear";
mixedAnswer.analysis.intervalLawAnswerId = null;
delete mixedAnswer.evidence.gap01;
const mixedScore = Scoring.scoreAttempt(mixedAnswer);

function assertScoreReconciles(scored, label) {
  const groups = [scored.detail.process, scored.detail.quantitative, scored.detail.laws];
  for (const group of groups) {
    const itemPoints = group.items.reduce((sum, item) => sum + item.points, 0);
    assert.ok(Math.abs(itemPoints - group.points) < 1e-9,
      `${label}: detail item points reconcile to their group`);
  }
  const allItemPoints = groups.flatMap((group) => group.items).reduce((sum, item) => sum + item.points, 0);
  assert.ok(Math.abs(allItemPoints - scored.rawScore) < 1e-9,
    `${label}: all detail item points reconcile to rawScore`);
  const expectedFinal = Math.round(scored.meaningfulRulerUse ? scored.rawScore : Math.min(scored.rawScore, 59));
  assert.strictEqual(scored.score, expectedFinal, `${label}: cap changes only the final score`);
  assert.strictEqual(scored.capApplied, !scored.meaningfulRulerUse && scored.rawScore > 59,
    `${label}: capApplied explains the final-score-only cap`);
}
for (const [label, scored] of [
  ["perfect", perfect], ["wrong", wrongScore], ["mixed", mixedScore], ["all-null", blankScore],
  ["skipped/no-evidence", skippedScore], ["capped/no-evidence", noEvidence]
]) assertScoreReconciles(scored, label);
const invalidPlacementAnswer = perfectAnswer();
invalidPlacementAnswer.evidence.totalPlacement.moveNorm = 1.01;
assert.strictEqual(Scoring.scoreAttempt(invalidPlacementAnswer).detail.process.totalPlacement, 0);
assert.strictEqual(Scoring.scoreAttempt(invalidPlacementAnswer).score, 59);
const contradictoryTotalAnswer = perfectAnswer();
Object.assign(contradictoryTotalAnswer.evidence.totalPlacement, {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 0, zeroTickOverlapPx: 4
});
delete contradictoryTotalAnswer.evidence.totalPlacement.guideFraction;
const contradictoryTotalScore = Scoring.scoreAttempt(contradictoryTotalAnswer);
assert.deepStrictEqual(contradictoryTotalScore.detail.totalLinks, [false, false, false, false]);
assert.strictEqual(contradictoryTotalScore.detail.process.totalPlacement, 0);
assert.strictEqual(contradictoryTotalScore.meaningfulRulerUse, false);
assert.strictEqual(contradictoryTotalScore.score, 59,
  "hand-constructed contradictory total evidence cannot score process links");
const contradictoryGapAnswer = perfectAnswer();
Object.assign(contradictoryGapAnswer.evidence.gap01, {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 0, zeroTickOverlapPx: 4
});
delete contradictoryGapAnswer.evidence.gap01.guideFraction;
assert.strictEqual(Scoring.scoreAttempt(contradictoryGapAnswer).detail.gapLinks[0], false,
  "hand-constructed contradictory gap evidence cannot score its process link");
const currentFields = [
  "rulerX", "rulerSide", "rulerGeometry", "horizontalMode", "guideFraction",
  "boundaryOverlapPx", "zeroTickOverlapPx"
];
const toPureLegacy = (value, total = false) => {
  for (const field of currentFields) delete value[field];
  value.legacyEdgeGapPx = 10;
  if (total) value.legacyEdgeSide = "left";
};
const pureLegacyAnswer = perfectAnswer();
toPureLegacy(pureLegacyAnswer.evidence.totalPlacement, true);
Scoring.GAP_KEYS.forEach((key) => toPureLegacy(pureLegacyAnswer.evidence[key]));
const pureLegacyScore = Scoring.scoreAttempt(pureLegacyAnswer);
assert.strictEqual(pureLegacyScore.score, 100);
assert.strictEqual(pureLegacyScore.detail.process.points, 40,
  "pure legacy compatibility evidence remains accepted");
const invalidLegacyFinalEvidence = JSON.parse(JSON.stringify(pureLegacyAnswer));
invalidLegacyFinalEvidence.evidence.gap01.legacyEdgeGapPx = 100;
assert.strictEqual(Scoring.scoreAttempt(invalidLegacyFinalEvidence).detail.gapLinks[0], false,
  "bounded active-candidate range is never accepted as finalized legacy gap evidence");
assert.strictEqual(Scoring.scoreAttempt(perfectAnswer()).score, 100,
  "pure current evidence remains accepted");
const historicalCurrentAnswer = perfectAnswer();
delete historicalCurrentAnswer.evidence.totalPlacement.rulerGeometry;
Scoring.GAP_KEYS.forEach((key) => delete historicalCurrentAnswer.evidence[key].rulerGeometry);
const historicalCurrentScore = Scoring.scoreAttempt(historicalCurrentAnswer);
assert.strictEqual(historicalCurrentScore.score, 100,
  "undiscriminated v2 current geometry remains historical scoring evidence");
const unknownGeometryAnswer = perfectAnswer();
unknownGeometryAnswer.evidence.gap01.rulerGeometry = "future-geometry";
assert.strictEqual(Scoring.scoreAttempt(unknownGeometryAnswer).detail.gapLinks[0], false,
  "an unknown geometry discriminator fails closed");

const mixedContradictoryTotal = perfectAnswer();
Object.assign(mixedContradictoryTotal.evidence.totalPlacement, {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 0, zeroTickOverlapPx: 4,
  legacyEdgeSide: "left", legacyEdgeGapPx: 10
});
delete mixedContradictoryTotal.evidence.totalPlacement.guideFraction;
const mixedContradictoryScore = Scoring.scoreAttempt(mixedContradictoryTotal);
assert.deepStrictEqual(mixedContradictoryScore.detail.totalLinks, [false, false, false, false]);
assert.strictEqual(mixedContradictoryScore.detail.process.totalPlacement, 0);
assert.strictEqual(mixedContradictoryScore.meaningfulRulerUse, false);
assert.strictEqual(mixedContradictoryScore.score, 59,
  "valid legacy fields cannot rescue contradictory current total evidence");

const mixedIncompleteTotal = perfectAnswer();
mixedIncompleteTotal.evidence.totalPlacement.legacyEdgeSide = "left";
mixedIncompleteTotal.evidence.totalPlacement.legacyEdgeGapPx = 10;
delete mixedIncompleteTotal.evidence.totalPlacement.horizontalMode;
delete mixedIncompleteTotal.evidence.totalPlacement.guideFraction;
const mixedIncompleteScore = Scoring.scoreAttempt(mixedIncompleteTotal);
assert.strictEqual(mixedIncompleteScore.detail.process.totalPlacement, 0);
assert.strictEqual(mixedIncompleteScore.score, 59,
  "valid legacy fields cannot rescue incomplete current total evidence");

const mixedGapAnswer = perfectAnswer();
mixedGapAnswer.evidence.gap01.legacyEdgeGapPx = 10;
const mixedGapScore = Scoring.scoreAttempt(mixedGapAnswer);
assert.strictEqual(mixedGapScore.detail.gapLinks[0], false,
  "mixed current and legacy gap evidence fails closed");
const diagnosticAnswer = perfectAnswer(false);
const diagnostic = Scoring.measurementDiagnostic(diagnosticAnswer, Scoring.scoreAttempt(diagnosticAnswer));
assert.ok(diagnostic.some((message) => message.includes("正確讀數未連結有效尺位")));
assert.ok(diagnostic.some((message) => message.includes("59")));
const mixedLaw = perfectAnswer();
mixedLaw.analysis.lawAnswerId = "linear";
const mixedDiagnostic = Scoring.measurementDiagnostic(mixedLaw, Scoring.scoreAttempt(mixedLaw));
assert.ok(mixedDiagnostic.some((message) => message.includes("由起點起計")));
assert.ok(mixedDiagnostic.every((message) => !/P[₀-₄]/.test(message)));
console.log("free-fall scoring tests passed");

module.exports = { perfectAnswer, placement };
