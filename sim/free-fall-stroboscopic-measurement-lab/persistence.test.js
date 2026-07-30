"use strict";
const assert = require("assert");
const Model = require("./model.js");
const Scoring = require("./scoring.js");
const Persistence = require("./persistence.js");

const placement = (task, overrides = {}) => {
  const gapIndex = Scoring.GAP_KEYS.indexOf(task);
  const rulerZeroM = gapIndex >= 0 ? Model.displacementAt(5, gapIndex) : 0;
  return {
    mode: "keyboard", moveNorm: .03, rulerZeroM, edgeSide: "right",
    edgeGapPx: 10, zeroErrorPx: 0, ...overrides
  };
};
function roundTrip(state) {
  const encoded = Persistence.encode(state);
  const restored = Persistence.decode(JSON.parse(JSON.stringify(encoded)));
  assert.deepStrictEqual(restored, encoded);
  return restored;
}

let state = Persistence.initialState();
assert.strictEqual(roundTrip(state).variant, "new");
state = Persistence.configuredState(5);
assert.strictEqual(roundTrip(state).variant, "configured");
state = Persistence.generate(state);
assert.strictEqual(roundTrip(state).phase, "measure-total");

state = Persistence.withPlacement(state, placement("total"));
assert.ok(state && state.variant === "normal-placement-ready");
for (let index = 0; index < 4; index += 1) {
  const restoredReady = roundTrip(state);
  state = Persistence.resolveMeasurement(restoredReady, Model.displacementAt(5, index + 1));
  assert.ok(state);
  if (index < 3) assert.strictEqual(state.currentStep, index + 1);
}
assert.strictEqual(state.phase, "measure-interval");
for (let index = 0; index < 4; index += 1) {
  assert.strictEqual(roundTrip(state).variant, "normal-unpositioned");
  const task = Scoring.GAP_KEYS[index];
  const ready = Persistence.withPlacement(state, placement(task));
  assert.ok(ready);
  state = Persistence.resolveMeasurement(roundTrip(ready), Model.intervalDisplacement(5, index + 1));
  assert.ok(state);
}
assert.strictEqual(state.phase, "analyze");
state = Persistence.setAnalysis(state, {
  deltaTS: .2,
  cumulativeTimeRatio: { status: "answered", values: [1, 2, 3, 4] },
  totalDisplacementRatio: { status: "answered", values: [1, 4, 9, 16] },
  intervalTimeRatio: { status: "answered", values: [1, 1, 1, 1] },
  intervalDistanceRatio: { status: "answered", values: [1, 3, 5, 7] },
  lawAnswerId: "square", intervalLawAnswerId: "odd", accelerationAnswerId: "constant-acceleration"
});
assert.ok(state);
state = Persistence.enterReview(roundTrip(state));
assert.strictEqual(state.variant, "complete");
roundTrip(state);
const originalScore = Scoring.scoreAttempt(state);
assert.strictEqual(originalScore.score, 100);
const review = Persistence.makeReview(state);
const restoredReview = Persistence.decodeReview(JSON.parse(JSON.stringify(review)));
assert.deepStrictEqual(restoredReview, review);
const restoredState = Persistence.fromReview(restoredReview);
assert.strictEqual(Scoring.scoreAttempt(restoredState).score, originalScore.score);
assert.strictEqual(Scoring.scoreAttempt(restoredState).passed, originalScore.passed);

for (const [area, expectedPhase] of [["total", "measure-total"], ["interval", "measure-interval"], ["analysis", "analyze"]]) {
  const edit = Persistence.edit(state, area, 0);
  assert.strictEqual(roundTrip(edit).phase, expectedPhase);
}
const totalEdit = Persistence.edit(state, "total", 0);
assert.strictEqual(roundTrip(totalEdit).variant, "review-edit-unpositioned");
const totalEditReady = Persistence.withPlacement(totalEdit, placement("total", { moveNorm: .04 }));
assert.ok(Scoring.TOTAL_KEYS.every((key) => totalEditReady.measurements[key].usedTotalPlacement === false));
assert.strictEqual(totalEditReady.evidence.totalPlacement, undefined);
assert.strictEqual(Persistence.resolveMeasurement(roundTrip(totalEditReady), .2).phase, "review");
const intervalEdit = Persistence.edit(state, "interval", 0);
assert.strictEqual(roundTrip(intervalEdit).variant, "review-edit-unpositioned");
const intervalEditReady = Persistence.withPlacement(intervalEdit, placement("gap01"));
assert.strictEqual(roundTrip(intervalEditReady).variant, "review-edit-placement-ready");
assert.strictEqual(Persistence.resolveMeasurement(intervalEditReady, .2).phase, "review");

const badFuture = Persistence.generate(Persistence.configuredState(5));
badFuture.measurements.total2 = { status: "skipped" };
assert.strictEqual(Persistence.decode(badFuture), null);
const badPhase = { ...Persistence.generate(Persistence.configuredState(5)), currentStep: 5 };
assert.strictEqual(Persistence.decode(badPhase), null);
const wrongPlacementTask = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total"));
wrongPlacementTask.activePlacement.task = "gap01";
assert.strictEqual(Persistence.decode(wrongPlacementTask), null);
const badActive = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total"));
badActive.activePlacement.moveNorm = Infinity;
assert.strictEqual(Persistence.decode(badActive), null);
const excessiveMove = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total"));
excessiveMove.activePlacement.moveNorm = 1.001;
assert.strictEqual(Persistence.decode(excessiveMove), null);
const impossibleZero = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total"));
impossibleZero.activePlacement.rulerZeroM = Model.cameraMax(5) + .501;
assert.strictEqual(Persistence.decode(impossibleZero), null);
const negativeZero = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total"));
negativeZero.activePlacement.rulerZeroM = -0.001;
negativeZero.activePlacement.zeroErrorPx = -0.1;
assert.strictEqual(Persistence.decode(negativeZero), null);
const contradictorySign = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total"));
contradictorySign.activePlacement.rulerZeroM = .1;
contradictorySign.activePlacement.zeroErrorPx = -5;
assert.strictEqual(Persistence.decode(contradictorySign), null);
const impossibleScale = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total"));
impossibleScale.activePlacement.rulerZeroM = .1;
impossibleScale.activePlacement.zeroErrorPx = .1;
assert.strictEqual(Persistence.decode(impossibleScale), null);
const consistentOffset = Persistence.withPlacement(Persistence.generate(Persistence.configuredState(5)), placement("total", { rulerZeroM: .1, zeroErrorPx: 5 }));
assert.ok(consistentOffset);
const badEvidence = JSON.parse(JSON.stringify(state));
badEvidence.evidence.gap01.edgeGapPx = 100;
assert.strictEqual(Persistence.decode(badEvidence), null);
const unknownEvidence = JSON.parse(JSON.stringify(state));
unknownEvidence.evidence.unknown = { usedWhileValid: true };
assert.strictEqual(Persistence.decode(unknownEvidence), null);
const skippedWithEvidence = JSON.parse(JSON.stringify(state));
skippedWithEvidence.measurements.gap01 = { status: "skipped" };
assert.strictEqual(Persistence.decode(skippedWithEvidence), null);
const brokenReviewEdit = Persistence.edit(state, "total", 0);
brokenReviewEdit.returnToReview = false;
assert.strictEqual(Persistence.decode(brokenReviewEdit), null);
const missingPriorInterval = JSON.parse(JSON.stringify(Persistence.edit(state, "interval", 2)));
missingPriorInterval.measurements.gap01 = null;
assert.strictEqual(Persistence.decode(missingPriorInterval), null);
const impossibleFinalMove = JSON.parse(JSON.stringify(state));
impossibleFinalMove.evidence.totalPlacement.moveNorm = 1.001;
assert.strictEqual(Persistence.decode(impossibleFinalMove), null);
const contradictoryFinal = JSON.parse(JSON.stringify(state));
contradictoryFinal.evidence.totalPlacement.rulerZeroM = .1;
contradictoryFinal.evidence.totalPlacement.zeroErrorPx = -5;
assert.strictEqual(Persistence.decode(contradictoryFinal), null);
const danglingTotalPlacement = JSON.parse(JSON.stringify(state));
for (const key of Scoring.TOTAL_KEYS) danglingTotalPlacement.measurements[key].usedTotalPlacement = false;
assert.strictEqual(Persistence.decode(danglingTotalPlacement), null);
const gapWithTotalLink = JSON.parse(JSON.stringify(state));
gapWithTotalLink.measurements.gap01.usedTotalPlacement = true;
assert.strictEqual(Persistence.decode(gapWithTotalLink), null);
const badRatio = JSON.parse(JSON.stringify(state));
badRatio.analysis.totalDisplacementRatio.values[0] = 2;
assert.strictEqual(Persistence.decode(badRatio), null);
const oldVersion = JSON.parse(JSON.stringify(state));
oldVersion.v = 0;
assert.strictEqual(Persistence.decode(oldVersion), null);

let skipped = Persistence.generate(Persistence.configuredState(4));
for (let i = 0; i < 4; i += 1) skipped = Persistence.resolveMeasurement(skipped, null, true);
for (let i = 0; i < 4; i += 1) skipped = Persistence.resolveMeasurement(skipped, null, true);
skipped = Persistence.setAnalysis(skipped, {
  deltaTS: .25,
  cumulativeTimeRatio: { status: "answered", values: [1, 2, 3, 4] },
  totalDisplacementRatio: { status: "insufficient-data" },
  intervalTimeRatio: { status: "answered", values: [1, 1, 1, 1] },
  intervalDistanceRatio: { status: "insufficient-data" },
  lawAnswerId: "square", intervalLawAnswerId: "odd", accelerationAnswerId: "constant-acceleration"
});
assert.ok(skipped);
assert.strictEqual(Persistence.enterReview(skipped).variant, "complete");
const invalidInsufficient = JSON.parse(JSON.stringify(state));
invalidInsufficient.analysis.totalDisplacementRatio = { status: "insufficient-data" };
assert.strictEqual(Persistence.decode(invalidInsufficient), null);
const skippedSourceAnswered = JSON.parse(JSON.stringify(state));
skippedSourceAnswered.measurements.total2 = { status: "skipped" };
skippedSourceAnswered.measurements.total1.usedTotalPlacement = false;
skippedSourceAnswered.measurements.total3.usedTotalPlacement = false;
skippedSourceAnswered.measurements.total4.usedTotalPlacement = false;
delete skippedSourceAnswered.evidence.totalPlacement;
assert.strictEqual(Persistence.decode(skippedSourceAnswered), null, "answered total ratio requires four positive readings");
const zeroSourceAnswered = JSON.parse(JSON.stringify(state));
zeroSourceAnswered.measurements.gap01.readingM = 0;
zeroSourceAnswered.evidence.gap01.readingM = 0;
assert.strictEqual(Persistence.decode(zeroSourceAnswered), null, "answered interval ratio rejects a zero source");

const incompleteAnalysis = Persistence.setAnalysis(
  (() => {
    let value = Persistence.generate(Persistence.configuredState(6));
    for (let i = 0; i < 4; i += 1) value = Persistence.resolveMeasurement(value, null, true);
    for (let i = 0; i < 4; i += 1) value = Persistence.resolveMeasurement(value, null, true);
    return value;
  })(),
  { deltaTS: 1 / 6 }
);
const incompleteReview = Persistence.enterReview(incompleteAnalysis);
assert.strictEqual(roundTrip(incompleteReview).variant, "incomplete");
assert.strictEqual(Persistence.edit(incompleteReview, "analysis").variant, "review-edit");

const skipTotalEdit = Persistence.resolveMeasurement(Persistence.edit(state, "total", 2), null, true);
assert.strictEqual(skipTotalEdit.analysis.totalDisplacementRatio.status, "insufficient-data");
assert.strictEqual(skipTotalEdit.variant, "complete");
const restoreTotalReading = Persistence.resolveMeasurement(Persistence.edit(skipTotalEdit, "total", 2), Model.displacementAt(5, 3));
assert.strictEqual(restoreTotalReading.analysis.totalDisplacementRatio, null);
assert.strictEqual(restoreTotalReading.variant, "incomplete");
const skipGapEdit = Persistence.resolveMeasurement(Persistence.edit(state, "interval", 1), null, true);
assert.strictEqual(skipGapEdit.analysis.intervalDistanceRatio.status, "insufficient-data");
const restoreGapReading = Persistence.resolveMeasurement(Persistence.edit(skipGapEdit, "interval", 1), Model.intervalDisplacement(5, 2));
assert.strictEqual(restoreGapReading.analysis.intervalDistanceRatio, null);
assert.strictEqual(restoreGapReading.variant, "incomplete");

assert.ok(Persistence.bytes({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "draft", answer: state }) < 3000);
assert.ok(Persistence.bytes({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "review", answer: review, score: 100, passed: true }) < 2400);
const reviewJson = JSON.stringify({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "review", answer: review, score: 100, passed: true });
assert.ok(Persistence.bytes({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "pending-final", payload: { reviewJson, score: 100, maxScore: 100, passed: true } }) < 4000);
console.log("free-fall persistence tests passed");

module.exports = { completeState: state, review };
