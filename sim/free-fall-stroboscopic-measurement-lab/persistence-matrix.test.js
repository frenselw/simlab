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
    edgeSide: "right", edgeGapPx: 10, zeroErrorPx: 0
  };
}
function decoded(state, label) {
  const restored = P.decode(JSON.parse(JSON.stringify(P.encode(state))));
  assert.deepEqual(restored, state, `${label}: production encode/decode round-trip`);
  if (state.measurements && P.analysisFieldValid(state.analysis, state.measurements, true)) {
    const before = S.scoreAttempt(state);
    const after = S.scoreAttempt(restored);
    assert.equal(after.score, before.score, `${label}: score survives restore`);
    assert.equal(after.passed, before.passed, `${label}: pass survives restore`);
  }
  return restored;
}
function skippedMeasurements(frequency = 5) {
  let state = P.generate(P.configuredState(frequency));
  for (let index = 0; index < 4; index += 1) state = P.resolveMeasurement(state, null, true);
  for (let index = 0; index < 4; index += 1) state = P.resolveMeasurement(state, null, true);
  return state;
}
function completeState() {
  let state = P.generate(P.configuredState(5));
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
assert.equal(P.configuredState(4).variant, "configured", "setup/new legal continuation selects frequency");
const configured = decoded(P.configuredState(5), "setup/configured");
assert.equal(P.generate(configured).phase, "measure-total", "setup/configured legal continuation generates trajectory");

for (let step = 0; step < 4; step += 1) {
  let unpositioned = P.generate(P.configuredState(5));
  for (let prior = 0; prior < step; prior += 1) unpositioned = P.resolveMeasurement(unpositioned, null, true);
  const restoredUnpositioned = decoded(unpositioned, `measure-total/normal-unpositioned/${step}`);
  const ready = P.withPlacement(restoredUnpositioned, placement(restoredUnpositioned, "total"));
  assert.ok(ready, `measure-total/normal-unpositioned/${step}: decoded fixture can move ruler`);
  const restoredReady = decoded(ready, `measure-total/normal-placement-ready/${step}`);
  assert.ok(P.resolveMeasurement(restoredReady, null, true), `measure-total/normal-placement-ready/${step}: decoded fixture can resolve`);
}

for (let step = 0; step < 4; step += 1) {
  let unpositioned = P.generate(P.configuredState(5));
  for (let total = 0; total < 4; total += 1) unpositioned = P.resolveMeasurement(unpositioned, null, true);
  for (let prior = 0; prior < step; prior += 1) unpositioned = P.resolveMeasurement(unpositioned, null, true);
  const restoredUnpositioned = decoded(unpositioned, `measure-interval/normal-unpositioned/${step}`);
  const task = S.GAP_KEYS[step];
  const ready = P.withPlacement(restoredUnpositioned, placement(restoredUnpositioned, task));
  assert.ok(ready, `measure-interval/normal-unpositioned/${step}: decoded fixture can move ruler`);
  const restoredReady = decoded(ready, `measure-interval/normal-placement-ready/${step}`);
  assert.ok(P.resolveMeasurement(restoredReady, null, true), `measure-interval/normal-placement-ready/${step}: decoded fixture can resolve`);
}

const analyzeNormal = decoded(skippedMeasurements(), "analyze/normal");
assert.equal(P.enterReview(analyzeNormal).variant, "incomplete", "analyze/normal decoded fixture enters review");
const reviewIncomplete = decoded(P.enterReview(P.setAnalysis(skippedMeasurements(), { deltaTS: .2 })), "review/incomplete");
assert.equal(P.edit(reviewIncomplete, "analysis").variant, "review-edit", "review/incomplete decoded fixture can edit");
const reviewComplete = completeState();
decoded(reviewComplete, "review/complete");
assert.equal(P.edit(reviewComplete, "analysis").phase, "analyze", "review/complete decoded fixture can edit");

for (const [area, keys] of [["total", S.TOTAL_KEYS], ["interval", S.GAP_KEYS]]) {
  for (let step = 0; step < 4; step += 1) {
    const unpositioned = P.edit(reviewComplete, area, step);
    const restoredUnpositioned = decoded(unpositioned, `${area}/review-edit-unpositioned/${step}`);
    const task = area === "total" ? "total" : keys[step];
    const ready = P.withPlacement(restoredUnpositioned, placement(restoredUnpositioned, task));
    assert.ok(ready, `${area}/review-edit-unpositioned/${step}: decoded fixture can move ruler`);
    const restoredReady = decoded(ready, `${area}/review-edit-placement-ready/${step}`);
    assert.equal(P.resolveMeasurement(restoredReady, null, true).phase, "review",
      `${area}/review-edit-placement-ready/${step}: decoded fixture returns to review`);
  }
}
const analyzeEdit = decoded(P.edit(reviewComplete, "analysis"), "analyze/review-edit");
assert.equal(P.enterReview(analyzeEdit).phase, "review", "analyze/review-edit decoded fixture returns to review");

console.log("free-fall complete persistence phase/variant/step matrix tests passed");
