"use strict";
const assert = require("assert");
const Model = require("./model.js");
const Scoring = require("./scoring.js");
const Persistence = require("./persistence.js");

const placement = (task, overrides = {}) => {
  const gapIndex = Scoring.GAP_KEYS.indexOf(task);
  const rulerZeroM = gapIndex >= 0 ? Model.displacementAt(5, gapIndex) : 0;
  return {
    mode: "keyboard", moveNorm: .03, rulerZeroM, rulerX: 100, rulerSide: "left",
    horizontalMode: "guide-fraction", guideFraction: 20 / 205,
    zeroTickOverlapPx: 23, zeroErrorPx: 0, ...overrides
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
for (const [sample, expected] of [[0, 4], [1 / 3, 5], [2 / 3, 6], [.999999, 6]]) {
  let calls = 0;
  assert.strictEqual(Persistence.chooseFrequency(() => { calls += 1; return sample; }), expected);
  assert.strictEqual(calls, 1, "frequency RNG is sampled exactly once");
}
for (const sample of [-.001, 1, NaN, Infinity]) assert.strictEqual(Persistence.chooseFrequency(() => sample), null);
assert.strictEqual(Persistence.chooseFrequency(null), null);
const assignedOnce = Persistence.assignFrequency(Persistence.initialState(), 5);
assert.strictEqual(assignedOnce.variant, "assigned");
assert.strictEqual(Persistence.assignFrequency(assignedOnce, 4), null, "assigned attempt cannot reroll");
state = Persistence.assignedState(5);
assert.strictEqual(roundTrip(state).variant, "assigned");
assert.deepStrictEqual(Persistence.reset(state), state, "reset preserves assigned frequency");
state = Persistence.generate(state);
assert.strictEqual(roundTrip(state).phase, "measure-total");
const manualOnly = Persistence.resolveMeasurement(state, Model.displacementAt(5, 1));
assert.ok(manualOnly, "v2 runtime records a manual answer without a persisted placement");
assert.strictEqual(manualOnly.measurements.total1.usedTotalPlacement, false);
assert.strictEqual(manualOnly.evidence.totalPlacement, undefined);
assert.ok(Persistence.resolveMeasurement(state, 0), "0 cm-equivalent canonical reading is inclusive");
assert.ok(Persistence.resolveMeasurement(state, Model.cameraMax(5)), "5 cm-equivalent canonical reading is inclusive");
assert.strictEqual(Persistence.resolveMeasurement(state, -Number.EPSILON), null);
assert.strictEqual(Persistence.resolveMeasurement(state, Model.cameraMax(5) + 1e-12), null);
assert.strictEqual(Persistence.resolveMeasurement(state, Infinity), null);
const invalidReady = Persistence.withPlacement(state, placement("total", { moveNorm: .01 }));
assert.ok(invalidReady, "placement-ready drafts may retain a not-yet-scoring-valid placement");
const invalidPlacementReading = Persistence.resolveMeasurement(invalidReady, Model.displacementAt(5, 1));
assert.ok(invalidPlacementReading, "manual answer remains recordable from an invalid placement");
assert.strictEqual(invalidPlacementReading.measurements.total1.usedTotalPlacement, false);
const staleValidReady = Persistence.withPlacement(state, placement("total"));
const currentInvalidPlacement = placement("total", {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 0, zeroTickOverlapPx: 0
});
delete currentInvalidPlacement.guideFraction;
const currentInvalid = Persistence.refreshPlacement(staleValidReady, currentInvalidPlacement);
assert.ok(currentInvalid, "current-CTM placement refresh accepts bounded invalid geometry");
const staleMetricAnswer = Persistence.resolveMeasurement(currentInvalid, Model.displacementAt(5, 1));
assert.strictEqual(staleMetricAnswer.measurements.total1.usedTotalPlacement, false);
assert.strictEqual(staleMetricAnswer.evidence.totalPlacement, undefined,
  "a previously valid persisted metric cannot create evidence after current geometry refreshes invalid");

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

function asV1(value) {
  const legacy = JSON.parse(JSON.stringify(value));
  legacy.v = 1;
  legacy.rubricVersion = 1;
  legacy.frequencyActivelySelected = legacy.frequencyAssigned;
  delete legacy.frequencyAssigned;
  if (legacy.phase === "setup" && legacy.variant === "assigned") legacy.variant = "configured";
  const convert = (placement, keepSide = false, edgeGapPx = 10) => {
    if (!placement) return;
    placement.edgeGapPx = edgeGapPx;
    delete placement.zeroTickOverlapPx;
    delete placement.rulerX;
    delete placement.horizontalMode;
    delete placement.guideFraction;
    delete placement.boundaryOverlapPx;
    if (Object.prototype.hasOwnProperty.call(placement, "rulerSide")) {
      if (keepSide) placement.edgeSide = "right";
      delete placement.rulerSide;
    }
  };
  convert(legacy.activePlacement, true, 100);
  convert(legacy.evidence?.totalPlacement, true);
  Scoring.GAP_KEYS.forEach((key) => convert(legacy.evidence?.[key]));
  return legacy;
}
const migratedReview = Persistence.decodeReview(asV1(review));
assert.strictEqual(migratedReview.v, 2);
assert.strictEqual(migratedReview.rubricVersion, 2);
assert.strictEqual(migratedReview.frequencyAssigned, true);
assert.strictEqual(Scoring.scoreAttempt(migratedReview).score, originalScore.score);
assert.strictEqual(migratedReview.evidence.totalPlacement.legacyEdgeGapPx, 10);
assert.strictEqual(Object.hasOwn(migratedReview.evidence.totalPlacement, "zeroTickOverlapPx"), false,
  "v1 edge gap is preserved as legacy data and never reinterpreted as overlap");
for (const edgeGapPx of [5.99, 44.01, 100]) {
  const invalidLegacyGap = asV1(review);
  invalidLegacyGap.evidence.totalPlacement.edgeGapPx = edgeGapPx;
  assert.strictEqual(Persistence.decodeReview(invalidLegacyGap), null,
    `v1 edge gap ${edgeGapPx} is rejected under the legacy inclusive 6..44 rule`);
}
const invalidLegacyGapEvidence = asV1(review);
invalidLegacyGapEvidence.evidence.gap01.edgeGapPx = 100;
assert.strictEqual(Persistence.decodeReview(invalidLegacyGapEvidence), null,
  "v1 finalized gap evidence keeps the inclusive 6..44 scoring gate");
const invalidLegacyReview = asV1(review);
invalidLegacyReview.evidence.totalPlacement.rulerZeroM = -.75;
invalidLegacyReview.evidence.totalPlacement.zeroErrorPx = -6;
assert.strictEqual(Persistence.decodeReview(invalidLegacyReview), null,
  "v1 review cannot inherit v2's negative-side ruler-zero allowance");
const legacyReadyDraft = asV1(Persistence.withPlacement(
  Persistence.generate(Persistence.assignedState(5)), placement("total")));
const migratedLegacyReady = Persistence.decode(legacyReadyDraft);
assert.ok(migratedLegacyReady && migratedLegacyReady.variant === "normal-placement-ready");
assert.strictEqual(migratedLegacyReady.activePlacement.legacyEdgeGapPx, 100);
const legacyCandidateContinuation = Persistence.resolveMeasurement(
  roundTrip(migratedLegacyReady), Model.displacementAt(5, 1));
assert.strictEqual(legacyCandidateContinuation.measurements.total1.usedTotalPlacement, false);
assert.strictEqual(legacyCandidateContinuation.evidence.totalPlacement, undefined,
  "bounded scoring-invalid v1 active candidate restores and continues without operation evidence");
legacyReadyDraft.activePlacement.rulerZeroM = -.75;
legacyReadyDraft.activePlacement.zeroErrorPx = -6;
assert.strictEqual(Persistence.decode(legacyReadyDraft), null,
  "v1 placement-ready draft applies its nonnegative ruler-zero rule before migration");
const legacyManual = Persistence.generate(Persistence.assignedState(5));
legacyManual.measurements.total1 = { status: "recorded", readingM: .23125, usedTotalPlacement: false };
legacyManual.currentStep = 1;
const migratedManual = Persistence.decode(asV1(legacyManual));
assert.strictEqual(migratedManual.measurements.total1.readingM, .23125);
assert.strictEqual(migratedManual.measurements.total1.usedTotalPlacement, false);
assert.strictEqual(migratedManual.v, 2);
const legacyNew = asV1(Persistence.initialState());
assert.strictEqual(Persistence.decode(legacyNew).variant, "new");

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

const badFuture = Persistence.generate(Persistence.assignedState(5));
badFuture.measurements.total2 = { status: "skipped" };
assert.strictEqual(Persistence.decode(badFuture), null);
const badPhase = { ...Persistence.generate(Persistence.assignedState(5)), currentStep: 5 };
assert.strictEqual(Persistence.decode(badPhase), null);
const wrongPlacementTask = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), placement("total"));
wrongPlacementTask.activePlacement.task = "gap01";
assert.strictEqual(Persistence.decode(wrongPlacementTask), null);
const badActive = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), placement("total"));
badActive.activePlacement.moveNorm = Infinity;
assert.strictEqual(Persistence.decode(badActive), null);
const excessiveMove = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), placement("total"));
excessiveMove.activePlacement.moveNorm = 1.001;
assert.strictEqual(Persistence.decode(excessiveMove), null);
const impossibleZero = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), placement("total"));
impossibleZero.activePlacement.rulerZeroM = Model.cameraMax(5) + .501;
assert.strictEqual(Persistence.decode(impossibleZero), null);
const negativeZero = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)),
  placement("total", { rulerZeroM: -.01818181818181818, zeroErrorPx: -1.25 }));
assert.ok(negativeZero, "a visually valid negative-side P0 alignment persists");
const exactNegativeBoundary = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)),
  placement("total", { rulerZeroM: -.75, zeroErrorPx: -6 }));
assert.ok(exactNegativeBoundary, "inclusive negative-side zero-alignment boundary persists");
assert.strictEqual(Scoring.validPlacement(exactNegativeBoundary.activePlacement, "total"), true);
const outsideNegativeBoundary = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)),
  placement("total", { rulerZeroM: -.751, zeroErrorPx: -6.01 }));
assert.strictEqual(outsideNegativeBoundary, null, "negative-side geometry outside the inclusive boundary fails closed");
const contradictorySign = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), placement("total"));
contradictorySign.activePlacement.rulerZeroM = .1;
contradictorySign.activePlacement.zeroErrorPx = -5;
assert.strictEqual(Persistence.decode(contradictorySign), null);
const impossibleScale = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), placement("total"));
impossibleScale.activePlacement.rulerZeroM = .1;
impossibleScale.activePlacement.zeroErrorPx = .1;
assert.strictEqual(Persistence.decode(impossibleScale), null);
const consistentOffset = Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), placement("total", { rulerZeroM: .1, zeroErrorPx: 5 }));
assert.ok(consistentOffset);
for (const overrides of [
  { zeroTickOverlapPx: -1 },
  { zeroTickOverlapPx: 501 },
  { rulerX: -1 },
  { rulerX: 361 },
  { rulerSide: "middle" },
  { rulerX: 100, rulerSide: "right" }
]) {
  assert.strictEqual(Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)),
    placement("total", overrides)), null, `raw placement bounds reject ${JSON.stringify(overrides)}`);
}
for (const overrides of [
  { horizontalMode: "guide-fraction", guideFraction: -1 },
  { horizontalMode: "guide-fraction", guideFraction: 2 },
  { horizontalMode: "guide-fraction", guideFraction: 20 / 205, rulerX: 100.011 },
  { horizontalMode: "guide-fraction", guideFraction: 20 / 205, zeroTickOverlapPx: 22.98 },
  { horizontalMode: "guide-fraction", boundaryOverlapPx: 4 },
  { horizontalMode: "left-boundary", guideFraction: .1, boundaryOverlapPx: 4 },
  { horizontalMode: "left-boundary", guideFraction: undefined, boundaryOverlapPx: 24 },
  { horizontalMode: "left-boundary", guideFraction: undefined, boundaryOverlapPx: 0, zeroTickOverlapPx: 4 },
  { horizontalMode: "left-boundary", guideFraction: undefined, boundaryOverlapPx: 4, zeroTickOverlapPx: 4.011 },
  { horizontalMode: "left-boundary", guideFraction: undefined, boundaryOverlapPx: 4, rulerSide: "right", rulerX: 300 }
]) {
  const candidate = placement("total", overrides);
  if (candidate.guideFraction === undefined) delete candidate.guideFraction;
  assert.strictEqual(Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)),
    candidate), null, `horizontal relation invariants reject ${JSON.stringify(overrides)}`);
}
const leftBoundary = placement("total", {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 4, zeroTickOverlapPx: 4
});
delete leftBoundary.guideFraction;
assert.ok(Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), leftBoundary));
const tolerantLeftBoundary = { ...leftBoundary, zeroTickOverlapPx: 4.009 };
assert.ok(Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), tolerantLeftBoundary));
const rightBoundary = placement("total", {
  rulerX: 310, rulerSide: "right", horizontalMode: "right-boundary",
  boundaryOverlapPx: 4, zeroTickOverlapPx: 4
});
delete rightBoundary.guideFraction;
assert.ok(Persistence.withPlacement(Persistence.generate(Persistence.assignedState(5)), rightBoundary));
const contradictoryReady = Persistence.withPlacement(
  Persistence.generate(Persistence.assignedState(5)), leftBoundary);
contradictoryReady.activePlacement.boundaryOverlapPx = 0;
assert.strictEqual(Persistence.decode(contradictoryReady), null,
  "draft decode rejects contradictory boundary cross-fields");
const mixedSchemaReady = Persistence.withPlacement(
  Persistence.generate(Persistence.assignedState(5)), leftBoundary);
mixedSchemaReady.activePlacement.legacyEdgeSide = "left";
mixedSchemaReady.activePlacement.legacyEdgeGapPx = 10;
assert.strictEqual(Persistence.decode(mixedSchemaReady), null,
  "draft decode rejects mixed current and legacy placement fields");
const badEvidence = JSON.parse(JSON.stringify(state));
badEvidence.evidence.gap01.zeroTickOverlapPx = -1;
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
const contradictoryBoundaryFinal = JSON.parse(JSON.stringify(state));
Object.assign(contradictoryBoundaryFinal.evidence.totalPlacement, {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 0, zeroTickOverlapPx: 4
});
delete contradictoryBoundaryFinal.evidence.totalPlacement.guideFraction;
assert.strictEqual(Persistence.decode(contradictoryBoundaryFinal), null);
assert.strictEqual(Persistence.validateReview(Persistence.makeReview(state)), true);
const contradictoryBoundaryReview = Persistence.makeReview(state);
Object.assign(contradictoryBoundaryReview.evidence.gap01, {
  rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
  boundaryOverlapPx: 0, zeroTickOverlapPx: 4
});
delete contradictoryBoundaryReview.evidence.gap01.guideFraction;
assert.strictEqual(Persistence.validateReview(contradictoryBoundaryReview), false);
assert.strictEqual(Persistence.decodeReview(contradictoryBoundaryReview), null,
  "review decoder rejects contradictory gap cross-fields");
const mixedSchemaReview = Persistence.makeReview(state);
mixedSchemaReview.evidence.totalPlacement.legacyEdgeSide = "left";
mixedSchemaReview.evidence.totalPlacement.legacyEdgeGapPx = 10;
assert.strictEqual(Persistence.decodeReview(mixedSchemaReview), null,
  "review decoder rejects mixed current and legacy total evidence");
const incompleteCurrentWithLegacy = Persistence.makeReview(state);
delete incompleteCurrentWithLegacy.evidence.totalPlacement.horizontalMode;
delete incompleteCurrentWithLegacy.evidence.totalPlacement.guideFraction;
incompleteCurrentWithLegacy.evidence.totalPlacement.legacyEdgeSide = "left";
incompleteCurrentWithLegacy.evidence.totalPlacement.legacyEdgeGapPx = 10;
assert.strictEqual(Persistence.decodeReview(incompleteCurrentWithLegacy), null,
  "review decoder does not fall back from incomplete current fields to legacy evidence");
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

let skipped = Persistence.generate(Persistence.assignedState(4));
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
    let value = Persistence.generate(Persistence.assignedState(6));
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
const restoreTotalEdit = Persistence.edit(skipTotalEdit, "total", 2);
const restoreTotalReading = Persistence.resolveMeasurement(
  Persistence.withPlacement(restoreTotalEdit, placement("total")), Model.displacementAt(5, 3));
assert.strictEqual(restoreTotalReading.analysis.totalDisplacementRatio, null);
assert.strictEqual(restoreTotalReading.variant, "incomplete");
const skipGapEdit = Persistence.resolveMeasurement(Persistence.edit(state, "interval", 1), null, true);
assert.strictEqual(skipGapEdit.analysis.intervalDistanceRatio.status, "insufficient-data");
const restoreGapEdit = Persistence.edit(skipGapEdit, "interval", 1);
const restoreGapReading = Persistence.resolveMeasurement(
  Persistence.withPlacement(restoreGapEdit, placement("gap12")), Model.intervalDisplacement(5, 2));
assert.strictEqual(restoreGapReading.analysis.intervalDistanceRatio, null);
assert.strictEqual(restoreGapReading.variant, "incomplete");

assert.ok(Persistence.bytes({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "draft", answer: state }) < 3000);
assert.ok(Persistence.bytes({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "review", answer: review, score: 100, passed: true }) < 2400);
const reviewJson = JSON.stringify({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "review", answer: review, score: 100, passed: true });
assert.ok(Persistence.bytes({ version: 1, activity: "free-fall-stroboscopic-measurement-lab", kind: "pending-final", payload: { reviewJson, score: 100, maxScore: 100, passed: true } }) < 4000);
console.log("free-fall persistence tests passed");

module.exports = { completeState: state, review };
