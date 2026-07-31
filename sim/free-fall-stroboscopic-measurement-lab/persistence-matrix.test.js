"use strict";
const assert = require("node:assert/strict");
const M = require("./model.js");
const S = require("./scoring.js");
const P = require("./persistence.js");

function placement(state, task) {
  const gapIndex = S.GAP_KEYS.indexOf(task);
  return {
    mode: "keyboard", moveNorm: .03,
    rulerZeroM: gapIndex >= 0 ? M.displacementAt(state.frequencyHz, gapIndex) : 0,
    rulerX: 100, rulerSide: "left", horizontalMode: "guide-fraction",
    guideFraction: 20 / 205, zeroTickOverlapPx: 23, zeroErrorPx: 0
  };
}
function asV1(state) {
  const legacy = JSON.parse(JSON.stringify(state));
  legacy.v = 1;
  legacy.rubricVersion = 1;
  legacy.frequencyActivelySelected = legacy.frequencyAssigned;
  delete legacy.frequencyAssigned;
  if (legacy.phase === "setup" && legacy.variant === "assigned") legacy.variant = "configured";
  const convert = (value, keepSide = false, edgeGapPx = 10) => {
    if (!value) return;
    value.edgeGapPx = edgeGapPx;
    delete value.zeroTickOverlapPx;
    delete value.rulerX;
    delete value.horizontalMode;
    delete value.guideFraction;
    delete value.boundaryOverlapPx;
    if (Object.prototype.hasOwnProperty.call(value, "rulerSide")) {
      if (keepSide) value.edgeSide = "right";
      delete value.rulerSide;
    }
  };
  convert(legacy.activePlacement, true, 100);
  convert(legacy.evidence?.totalPlacement, true);
  S.GAP_KEYS.forEach((key) => convert(legacy.evidence?.[key]));
  return legacy;
}
function decoded(state, label) {
  const restored = P.decode(JSON.parse(JSON.stringify(P.encode(state))));
  assert.deepEqual(restored, state, `${label}: production encode/decode round-trip`);
  const migrated = P.decode(asV1(state));
  assert.ok(migrated, `${label}: exact v1 shape migrates to a valid canonical v2 state`);
  if (migrated.activePlacement) {
    assert.equal(Object.hasOwn(migrated.activePlacement, "edgeGapPx"), false);
    assert.equal(migrated.activePlacement.legacyEdgeGapPx, 100);
    assert.equal(S.validLegacyPlacement(migrated.activePlacement, migrated.activePlacement.task), false,
      `${label}: restored bounded legacy candidate remains scoring-invalid`);
  }
  if (state.measurements && P.analysisFieldValid(state.analysis, state.measurements, true)) {
    const before = S.scoreAttempt(state);
    const after = S.scoreAttempt(migrated);
    assert.equal(after.score, before.score, `${label}: score survives restore`);
    assert.equal(after.passed, before.passed, `${label}: pass survives restore`);
  }
  return migrated;
}
function contradictoryBoundary(value) {
  const candidate = JSON.parse(JSON.stringify(value));
  Object.assign(candidate, {
    rulerX: 50, rulerSide: "left", horizontalMode: "left-boundary",
    boundaryOverlapPx: 0, zeroTickOverlapPx: 4
  });
  delete candidate.guideFraction;
  return candidate;
}
function skippedMeasurements(frequency = 5) {
  let state = P.generate(P.assignedState(frequency));
  for (let index = 0; index < 4; index += 1) state = P.resolveMeasurement(state, null, true);
  for (let index = 0; index < 4; index += 1) state = P.resolveMeasurement(state, null, true);
  return state;
}
function completeState() {
  let state = P.generate(P.assignedState(5));
  state = P.withPlacement(state, placement(state, "total"));
  for (let index = 0; index < 4; index += 1) state = P.resolveMeasurement(state, M.displacementAt(5, index + 1));
  for (let index = 0; index < 4; index += 1) {
    const task = S.GAP_KEYS[index];
    state = P.resolveMeasurement(P.withPlacement(state, placement(state, task)), M.intervalDisplacement(5, index + 1));
  }
  state = P.setAnalysis(state, {
    deltaTS: .2,
    cumulativeTimeRatio: { status: "answered", values: [1, 2, 3, 4] },
    totalDisplacementRatio: { status: "answered", values: [1, 4, 9, 16] },
    intervalTimeRatio: { status: "answered", values: [1, 1, 1, 1] },
    intervalDistanceRatio: { status: "answered", values: [1, 3, 5, 7] },
    lawAnswerId: "square", intervalLawAnswerId: "odd", accelerationAnswerId: "constant-acceleration"
  });
  return P.enterReview(state);
}

const newState = decoded(P.initialState(), "setup/new");
assert.equal(P.assignFrequency(P.initialState(), 4).variant, "assigned", "setup/new legal continuation assigns frequency");
const assigned = decoded(P.assignedState(5), "setup/assigned");
assert.equal(P.generate(assigned).phase, "measure-total", "setup/assigned legal continuation generates trajectory");

for (let step = 0; step < 4; step += 1) {
  let unpositioned = P.generate(P.assignedState(5));
  for (let prior = 0; prior < step; prior += 1) unpositioned = P.resolveMeasurement(unpositioned, null, true);
  const restoredUnpositioned = decoded(unpositioned, `measure-total/normal-unpositioned/${step}`);
  const ready = P.withPlacement(restoredUnpositioned, placement(restoredUnpositioned, "total"));
  assert.ok(ready, `measure-total/normal-unpositioned/${step}: decoded fixture can move ruler`);
  const contradictory = JSON.parse(JSON.stringify(ready));
  contradictory.activePlacement = contradictoryBoundary(contradictory.activePlacement);
  assert.equal(P.decode(contradictory), null,
    `measure-total/normal-placement-ready/${step}: contradictory cross-fields fail closed`);
  const restoredReady = decoded(ready, `measure-total/normal-placement-ready/${step}`);
  const recordedWithoutEvidence = P.resolveMeasurement(
    restoredReady, M.displacementAt(5, step + 1));
  assert.equal(recordedWithoutEvidence.measurements[S.TOTAL_KEYS[step]].usedTotalPlacement, false,
    `measure-total/normal-placement-ready/${step}: bounded legacy candidate creates no operation link`);
  assert.equal(recordedWithoutEvidence.evidence.totalPlacement, undefined);
  assert.ok(P.resolveMeasurement(restoredReady, null, true), `measure-total/normal-placement-ready/${step}: decoded fixture can resolve`);
}

for (let step = 0; step < 4; step += 1) {
  let unpositioned = P.generate(P.assignedState(5));
  for (let total = 0; total < 4; total += 1) unpositioned = P.resolveMeasurement(unpositioned, null, true);
  for (let prior = 0; prior < step; prior += 1) unpositioned = P.resolveMeasurement(unpositioned, null, true);
  const restoredUnpositioned = decoded(unpositioned, `measure-interval/normal-unpositioned/${step}`);
  const task = S.GAP_KEYS[step];
  const ready = P.withPlacement(restoredUnpositioned, placement(restoredUnpositioned, task));
  assert.ok(ready, `measure-interval/normal-unpositioned/${step}: decoded fixture can move ruler`);
  const contradictory = JSON.parse(JSON.stringify(ready));
  contradictory.activePlacement = contradictoryBoundary(contradictory.activePlacement);
  assert.equal(P.decode(contradictory), null,
    `measure-interval/normal-placement-ready/${step}: contradictory cross-fields fail closed`);
  const restoredReady = decoded(ready, `measure-interval/normal-placement-ready/${step}`);
  const recordedWithoutEvidence = P.resolveMeasurement(
    restoredReady, M.intervalDisplacement(5, step + 1));
  assert.equal(recordedWithoutEvidence.evidence[task], undefined,
    `measure-interval/normal-placement-ready/${step}: bounded legacy candidate creates no operation evidence`);
  assert.ok(P.resolveMeasurement(restoredReady, null, true), `measure-interval/normal-placement-ready/${step}: decoded fixture can resolve`);
}

const analyzeNormal = decoded(skippedMeasurements(), "analyze/normal");
assert.equal(P.enterReview(analyzeNormal).variant, "incomplete", "analyze/normal decoded fixture enters review");
const reviewIncomplete = decoded(P.enterReview(P.setAnalysis(skippedMeasurements(), { deltaTS: .2 })), "review/incomplete");
assert.equal(P.edit(reviewIncomplete, "analysis").variant, "review-edit", "review/incomplete decoded fixture can edit");
const reviewComplete = completeState();
decoded(reviewComplete, "review/complete");
const contradictoryReview = JSON.parse(JSON.stringify(reviewComplete));
contradictoryReview.evidence.totalPlacement = contradictoryBoundary(contradictoryReview.evidence.totalPlacement);
assert.equal(P.decode(contradictoryReview), null, "review/complete contradictory total evidence fails closed");
assert.equal(P.edit(reviewComplete, "analysis").phase, "analyze", "review/complete decoded fixture can edit");

for (const [area, keys] of [["total", S.TOTAL_KEYS], ["interval", S.GAP_KEYS]]) {
  for (let step = 0; step < 4; step += 1) {
    const unpositioned = P.edit(reviewComplete, area, step);
    const restoredUnpositioned = decoded(unpositioned, `${area}/review-edit-unpositioned/${step}`);
    const task = area === "total" ? "total" : keys[step];
    const ready = P.withPlacement(restoredUnpositioned, placement(restoredUnpositioned, task));
    assert.ok(ready, `${area}/review-edit-unpositioned/${step}: decoded fixture can move ruler`);
    const contradictory = JSON.parse(JSON.stringify(ready));
    contradictory.activePlacement = contradictoryBoundary(contradictory.activePlacement);
    assert.equal(P.decode(contradictory), null,
      `${area}/review-edit-placement-ready/${step}: contradictory cross-fields fail closed`);
    const restoredReady = decoded(ready, `${area}/review-edit-placement-ready/${step}`);
    const reading = area === "total"
      ? M.displacementAt(5, step + 1) : M.intervalDisplacement(5, step + 1);
    const recordedWithoutEvidence = P.resolveMeasurement(restoredReady, reading);
    if (area === "total") {
      assert.equal(recordedWithoutEvidence.measurements[keys[step]].usedTotalPlacement, false,
        `${area}/review-edit-placement-ready/${step}: bounded legacy candidate creates no operation link`);
    } else {
      assert.equal(recordedWithoutEvidence.evidence[keys[step]], undefined,
        `${area}/review-edit-placement-ready/${step}: bounded legacy candidate creates no operation evidence`);
    }
    assert.equal(P.resolveMeasurement(restoredReady, null, true).phase, "review",
      `${area}/review-edit-placement-ready/${step}: decoded fixture returns to review`);
  }
}
const analyzeEdit = decoded(P.edit(reviewComplete, "analysis"), "analyze/review-edit");
assert.equal(P.enterReview(analyzeEdit).phase, "review", "analyze/review-edit decoded fixture returns to review");

console.log("free-fall complete persistence phase/variant/step matrix tests passed");
