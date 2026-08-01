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
    rulerX: 100, rulerSide: "left", rulerGeometry: "fixed-left-v1", horizontalMode: "guide-fraction",
    guideFraction: 20 / 205, zeroTickOverlapPx: 23, zeroErrorPx: 0
  };
}
function asV2(state) {
  const legacy = JSON.parse(JSON.stringify(state));
  legacy.v = 2; legacy.rubricVersion = 2;
  if (legacy.phase === "measure-total" && legacy.activePlacement) legacy.activePlacement.task = "total";
  if (legacy.evidence) {
    S.TOTAL_KEYS.forEach((key) => {
      if (legacy.measurements?.[key]?.status === "recorded") legacy.measurements[key].usedTotalPlacement = Boolean(legacy.evidence[key]);
    });
    const first = S.TOTAL_KEYS.map((key) => legacy.evidence[key]).find(Boolean);
    if (first) legacy.evidence.totalPlacement = {
      mode: first.mode, moveNorm: first.moveNorm, rulerZeroM: 0,
      rulerX: 100, rulerSide: "left", rulerGeometry: "fixed-left-v1",
      horizontalMode: "guide-fraction", guideFraction: 20 / 205,
      zeroTickOverlapPx: 23, zeroErrorPx: first.zeroErrorPx
    };
    S.TOTAL_KEYS.forEach((key) => { delete legacy.evidence[key]; });
  }
  if (legacy.analysis) legacy.analysis = {
    deltaTS: legacy.analysis.deltaTS,
    cumulativeTimeRatio: legacy.analysis.cumulativeTimeRatio.values.slice(1).every((term) => term !== null)
      ? { status: "answered", values: legacy.analysis.cumulativeTimeRatio.values } : null,
    totalDisplacementRatio: S.TOTAL_KEYS.every((key) => legacy.measurements?.[key]?.status === "recorded" && legacy.measurements[key].readingM > 0)
      ? { status: "answered", values: [1, 4, 9, 16] } : { status: "insufficient-data" },
    intervalTimeRatio: legacy.analysis.intervalTimeRatio.values.slice(1).every((term) => term !== null)
      ? { status: "answered", values: legacy.analysis.intervalTimeRatio.values } : null,
    intervalDistanceRatio: S.GAP_KEYS.every((key) => legacy.measurements?.[key]?.status === "recorded" && legacy.measurements[key].readingM > 0)
      ? { status: "answered", values: [1, 3, 5, 7] } : { status: "insufficient-data" },
    lawAnswerId: legacy.analysis.lawAnswerId,
    intervalLawAnswerId: legacy.analysis.intervalLawAnswerId,
    accelerationAnswerId: legacy.analysis.accelerationAnswerId
  };
  if (legacy.phase === "review") legacy.variant = Object.values(legacy.analysis).every((value) => value !== null) ? "complete" : "incomplete";
  return legacy;
}
function asV1(state) {
  const legacy = asV2(state);
  legacy.v = 1;
  legacy.rubricVersion = 2;
  legacy.frequencyActivelySelected = legacy.frequencyAssigned;
  delete legacy.frequencyAssigned;
  if (legacy.phase === "setup" && legacy.variant === "assigned") legacy.variant = "configured";
  const convert = (value, keepSide = false, edgeGapPx = 10) => {
    if (!value) return;
    value.edgeGapPx = edgeGapPx;
    delete value.zeroTickOverlapPx;
    delete value.rulerX;
    delete value.rulerGeometry;
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
function restoredV2(state, label) {
  const restored = P.decode(asV2(state));
  const expected = JSON.parse(JSON.stringify(state));
  if (expected.phase === "measure-total" && expected.activePlacement) {
    delete expected.activePlacement;
    expected.variant = expected.returnToReview ? "review-edit-unpositioned" : "normal-unpositioned";
  }
  assert.deepEqual(restored, expected, `${label}: exact legacy v2 migrates to canonical v4`);
  return restored;
}
function restoredV1(state, label) {
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
function decoded(state, label) {
  const current = P.decode(JSON.parse(JSON.stringify(P.encode(state))));
  assert.deepEqual(current, state, `${label}: production v4 encode/decode round-trip`);
  restoredV2(state, label);
  restoredV1(state, label);
  return current;
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
function completeState(frequency = 5) {
  let state = P.generate(P.assignedState(frequency));
  for (let index = 0; index < 4; index += 1) {
    state = P.withPlacement(state, placement(state, S.TOTAL_KEYS[index]));
    state = P.resolveMeasurement(state, M.displacementAt(frequency, index + 1));
  }
  for (let index = 0; index < 4; index += 1) {
    const task = S.GAP_KEYS[index];
    state = P.resolveMeasurement(P.withPlacement(state, placement(state, task)), M.intervalDisplacement(frequency, index + 1));
  }
  state = P.setAnalysis(state, {
    deltaTS: 1 / frequency,
    cumulativeTimeRatio: { values: [1, 2, 3, 4] },
    intervalTimeRatio: { values: [1, 1, 1, 1] },
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
  const recordedWithEvidence = P.resolveMeasurement(
    restoredReady, M.displacementAt(5, step + 1));
  assert.ok(recordedWithEvidence.evidence[S.TOTAL_KEYS[step]],
    `measure-total/normal-placement-ready/${step}: current placement creates per-item operation evidence`);
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
  const recordedWithEvidence = P.resolveMeasurement(
    restoredReady, M.intervalDisplacement(5, step + 1));
  assert.ok(recordedWithEvidence.evidence[task],
    `measure-interval/normal-placement-ready/${step}: current placement creates operation evidence`);
  assert.ok(P.resolveMeasurement(restoredReady, null, true), `measure-interval/normal-placement-ready/${step}: decoded fixture can resolve`);
}

const analyzeNormal = decoded(skippedMeasurements(), "analyze/normal");
assert.equal(P.enterReview(analyzeNormal).variant, "ready", "analyze/normal decoded fixture enters ready review");
const reviewIncomplete = decoded(P.enterReview(P.setAnalysis(skippedMeasurements(), { deltaTS: .2 })), "review/incomplete");
assert.equal(P.edit(reviewIncomplete, "analysis").variant, "review-edit", "review/incomplete decoded fixture can edit");
const reviewComplete = completeState();
decoded(reviewComplete, "review/complete");
const contradictoryReview = JSON.parse(JSON.stringify(reviewComplete));
contradictoryReview.evidence.total1 = contradictoryBoundary(contradictoryReview.evidence.total1);
assert.equal(P.decode(contradictoryReview), null, "review/complete contradictory total evidence fails closed");
for (const rulerX of [0, 360]) {
  const impossibleReview = JSON.parse(JSON.stringify(reviewComplete));
  Object.assign(impossibleReview.evidence.total1, { rulerX, zeroTickOverlapPx: 23 });
  assert.equal(P.decode(impossibleReview), null,
    `review/complete impossible compact total geometry at x=${rulerX} fails closed`);
}
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
    const recordedWithEvidence = P.resolveMeasurement(restoredReady, reading);
    if (area === "total") {
      assert.ok(recordedWithEvidence.evidence[keys[step]],
        `${area}/review-edit-placement-ready/${step}: current placement replaces only this item's evidence`);
    } else {
      assert.ok(recordedWithEvidence.evidence[keys[step]],
        `${area}/review-edit-placement-ready/${step}: current placement creates operation evidence`);
    }
    assert.equal(P.resolveMeasurement(restoredReady, null, true).phase, "review",
      `${area}/review-edit-placement-ready/${step}: decoded fixture returns to review`);
  }
}
const analyzeEdit = decoded(P.edit(reviewComplete, "analysis"), "analyze/review-edit");
assert.equal(P.enterReview(analyzeEdit).phase, "review", "analyze/review-edit decoded fixture returns to review");

{
  const frequency = 6;
  const assigned = P.assignedState(frequency);
  for (const [kind, restored] of [["v2", restoredV2(assigned, "6Hz/v2/setup/assigned")],
    ["v1", restoredV1(assigned, "6Hz/v1/setup/assigned")]]) {
    assert.equal(P.generate(restored).phase, "measure-total", `6Hz/${kind} assigned continuation`);
  }
  for (let step = 0; step < 4; step += 1) {
    let total = P.generate(assigned);
    for (let prior = 0; prior < step; prior += 1) total = P.resolveMeasurement(total, null, true);
    for (const [kind, restore] of [["v2", restoredV2], ["v1", restoredV1]]) {
      const unpositioned = restore(total, `6Hz/${kind}/total/normal-unpositioned/${step}`);
      assert.ok(P.withPlacement(unpositioned, placement(unpositioned, "total")));
      const readySource = P.withPlacement(total, placement(total, "total"));
      const ready = restore(readySource, `6Hz/${kind}/total/normal-ready/${step}`);
      assert.ok(P.resolveMeasurement(ready, M.displacementAt(frequency, step + 1)),
        `6Hz/${kind}/total/${step} legal continuation`);
    }

    let gap = P.generate(assigned);
    for (let index = 0; index < 4; index += 1) gap = P.resolveMeasurement(gap, null, true);
    for (let prior = 0; prior < step; prior += 1) gap = P.resolveMeasurement(gap, null, true);
    const task = S.GAP_KEYS[step];
    for (const [kind, restore] of [["v2", restoredV2], ["v1", restoredV1]]) {
      const unpositioned = restore(gap, `6Hz/${kind}/gap/normal-unpositioned/${step}`);
      assert.ok(P.withPlacement(unpositioned, placement(unpositioned, task)));
      const readySource = P.withPlacement(gap, placement(gap, task));
      const ready = restore(readySource, `6Hz/${kind}/gap/normal-ready/${step}`);
      assert.ok(P.resolveMeasurement(ready, M.intervalDisplacement(frequency, step + 1)),
        `6Hz/${kind}/gap/${step} legal continuation`);
    }
  }

  const complete = completeState(frequency);
  assert.equal(S.scoreAttempt(complete).score, 100);
  restoredV2(complete, "6Hz/v2/review/complete");
  restoredV1(complete, "6Hz/v1/review/complete");
  for (const [area, keys] of [["total", S.TOTAL_KEYS], ["interval", S.GAP_KEYS]]) {
    for (let step = 0; step < 4; step += 1) {
      const task = area === "total" ? "total" : keys[step];
      const editSource = P.edit(complete, area, step);
      for (const [kind, restore] of [["v2", restoredV2], ["v1", restoredV1]]) {
        const unpositioned = restore(editSource, `6Hz/${kind}/${area}/review-edit-unpositioned/${step}`);
        assert.ok(P.withPlacement(unpositioned, placement(unpositioned, task)));
        const readySource = P.withPlacement(editSource, placement(editSource, task));
        const ready = restore(readySource, `6Hz/${kind}/${area}/review-edit-ready/${step}`);
        const reading = area === "total" ? M.displacementAt(frequency, step + 1) :
          M.intervalDisplacement(frequency, step + 1);
        const returned = P.resolveMeasurement(ready, reading);
        assert.ok(returned && returned.phase === "review" && returned.variant === "ready",
          `6Hz/${kind}/${area}/${step} restored edit returns to ready review`);
      }
    }
  }
  const analyze = skippedMeasurements(frequency);
  for (const [kind, restore] of [["v2", restoredV2], ["v1", restoredV1]]) {
    const restoredAnalyze = restore(analyze, `6Hz/${kind}/analyze`);
    assert.equal(P.enterReview(restoredAnalyze).phase, "review");
  }
}

console.log("free-fall complete persistence phase/variant/step matrix tests passed");
