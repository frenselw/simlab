"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./measurement.js");
const S = require("./scoring.js");
const P = require("./persistence.js");
const scenario = G.generateScenario({ seed: 9 });
const samples = Array.from({ length: 301 }, (_, i) => ({ timeS: i * .04, pullCN: i < 50 ? i * 12 : 500, velocityMMps: i < 50 ? 0 : i < 90 ? 100 : i < 110 ? 100 + (i - 90) * 6 : 220 }));
const trial = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 49 } });
let state = P.freshState(scenario.seed);
state = P.transitions.setTare(state, 3);
state = P.transitions.recordObservation(state, { id: "zero-pull", measuredPullCN: 0, measuredVelocityMMps: 0, learnerForce: null });
state = P.transitions.setObservationAnswer(state, "zero-pull", { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, operationDeltaCN: 0, committed: true });
state = P.transitions.recordObservation(state, { id: "static-1", measuredPullCN: 220, measuredVelocityMMps: 0, learnerForce: null });
state = P.transitions.setObservationAnswer(state, "static-1", { frictionType: "static", direction: "left", frictionMagnitudeCN: 220, operationDeltaCN: 0, committed: true });
state = P.transitions.recordObservation(state, { id: "static-1", measuredPullCN: 450, measuredVelocityMMps: 0, learnerForce: null });
state = P.transitions.setObservationAnswer(state, "static-high", { frictionType: "static", direction: "left", frictionMagnitudeCN: 450, operationDeltaCN: 0, committed: true });
assert.equal(state.balance.observations.length, 3);
assert.throws(() => P.transitions.setTare(state, 0), /before observations/);
state = P.transitions.setPhase(state, "experiment");
state = P.transitions.acceptTrial(state, trial);
state = P.transitions.setPhase(state, "analysis");
const candidates = M.findCandidateWindows(trial);
assert.throws(() => P.transitions.setAnalysisTask(state, "fastPlateau", { startIndex: 10, endIndex: 20 }), /active/);
state = P.transitions.setAnalysisTask(state, "staticInterval", { ...candidates.static[0], frictionType: null, relation: null });
assert.equal(state.variant, "selection-only");
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: P.encodeDraft(state) }, scenario, "draft"), state);
state = P.transitions.setAnalysisTask(state, "staticInterval", { ...candidates.static[0], frictionType: "static", relation: "equal" });
state = P.transitions.advanceAnalysisTask(state);
state = P.transitions.setAnalysisTask(state, "breakaway", { markerIndex: 50, estimatedFsMaxCN: 600, identifiedAs: "maximum-static-friction" });
state = P.transitions.advanceAnalysisTask(state);
const restoredAtSlow = P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: P.encodeDraft(state) }, scenario, "draft");
assert.equal(restoredAtSlow.working.activeAnalysisTask, 2);
state = restoredAtSlow;
state = P.transitions.setAnalysisTask(state, "slowPlateau", { ...candidates.slow[0], estimatedFkCN: 500 });
state = P.transitions.advanceAnalysisTask(state);
state = P.transitions.setAnalysisTask(state, "acceleration", { ...candidates.acceleration[0], relation: "pull-greater", pullEqualsFk: "no" });
state = P.transitions.advanceAnalysisTask(state);
state = P.transitions.setAnalysisTask(state, "fastPlateau", { ...candidates.fast[0], estimatedFkCN: 500, speedComparison: "same-average" });
state = P.transitions.setPhase(state, "predict");
assert.throws(() => P.transitions.setPrediction(state, 1, { id: scenario.predictions[1].id, scenarioId: scenario.predictions[1].scenarioId, frictionType: null, direction: null, magnitudeCN: null, motionOutcome: null, committed: false }), /active|future/);
const partialPrediction = P.transitions.setPrediction(state, 0, { id: scenario.predictions[0].id, scenarioId: scenario.predictions[0].scenarioId, frictionType: "static", direction: null, magnitudeCN: null, motionOutcome: null, committed: false });
const partialWire = P.encodeDraft(partialPrediction);
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: partialWire }, scenario, "draft"), partialPrediction);
const malformedPredictionWire = P.clone(partialWire); malformedPredictionWire.P[0][2] = 99;
assert.throws(() => P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: malformedPredictionWire }, scenario, "draft"), /enum/);
const malformedCommitWire = P.clone(partialWire); malformedCommitWire.P[0][6] = 2;
assert.throws(() => P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: malformedCommitWire }, scenario, "draft"), /prediction wire/);
const mismatchedPredictionId = P.clone(partialWire); mismatchedPredictionId.P[0][0] = "wrong-id";
assert.throws(() => P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: mismatchedPredictionId }, scenario, "draft"), /scenario mismatch/);
scenario.predictions.forEach((spec, index) => { state = P.transitions.setPrediction(state, index, { id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: spec.direction, magnitudeCN: spec.magnitudeCN, motionOutcome: spec.motionOutcome, committed: true }); if (index < scenario.predictions.length - 1) { assert.equal(state.variant, "answer-complete"); assert.deepEqual(P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: P.encodeDraft(state) }, scenario, "draft"), state); state = P.transitions.advancePrediction(state); } });
state = P.transitions.setPhase(state, "review");
assert.equal(P.hasCompleteAnswer(state), true);
const edit = P.transitions.enterReviewEdit(state, "analysis", "slowPlateau");
assert.equal(edit.variant, "review-edit");
const reviewDraft = P.transitions.setAnalysisDraft(edit, "slowPlateau", { startIndex: 53, endIndex: 94, estimatedFkCN: null });
assert.deepEqual(reviewDraft.analysis, state.analysis);
const restoredReviewDraft = P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: P.encodeDraft(reviewDraft) }, scenario, "draft");
assert.deepEqual(restoredReviewDraft, reviewDraft);
const cancelled = P.transitions.cancelReviewEdit(restoredReviewDraft);
assert.equal(cancelled.phase, "review");
assert.deepEqual(cancelled.analysis, state.analysis);
assert.deepEqual(cancelled.predictions, state.predictions);
const changedEdit = P.transitions.enterReviewEdit(state, "analysis", "slowPlateau");
const changed = P.transitions.setAnalysisTask(changedEdit, "slowPlateau", { startIndex: 52, endIndex: 95, estimatedFkCN: 500 });
assert.equal(changed.phase, "predict"); assert.equal(changed.variant, "answer-ready"); assert.equal(changed.predictions.every((item) => item === null), true);
assert.throws(() => P.transitions.enterReviewEdit(state, "balance", "not-an-observation"), /existing observation/);
const balanceEdit = P.transitions.enterReviewEdit(state, "balance", "static-low");
assert.throws(() => P.transitions.setPhase(balanceEdit, "experiment"), /dedicated/);
const draft = P.encodeDraft(state); P.validateState(P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: draft }, scenario, "draft"));
const review = P.encodeReview(state); assert.equal(review.w, "s1"); const expandedReview = P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "review", answer: review }, scenario, "review"); P.validateState({ ...expandedReview, working: P.emptyWorking() }, { skipVariant: true });
const decoded = expandedReview;
assert.equal(decoded.phase, "review");
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "review", answer: review }, scenario, "review"), P.normalizeReview(state));
assert.throws(() => P.validateState({ ...P.decodeSnapshot({ version: 1, activity: "static-kinetic-friction-investigation-lab", kind: "draft", answer: draft }, scenario, "draft"), balance: { ...state.balance, tared: false, tareCorrectionCN: 3 } }), /tare|invalid/);
let sequential = P.transitions.setTare(P.freshState(101), 0);
sequential = P.transitions.recordObservation(sequential, { id: "zero-pull", measuredPullCN: 0, measuredVelocityMMps: 0, learnerForce: null });
assert.throws(() => P.transitions.recordObservation(sequential, { id: "static-1", measuredPullCN: 200, measuredVelocityMMps: 0, learnerForce: null }), /active observation/);
assert.throws(() => P.validateState({ ...sequential, balance: { ...sequential.balance, observations: [{ ...sequential.balance.observations[0], learnerForce: { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, operationDeltaCN: 0, committed: false } }] } }), /invalid observations/);
assert.throws(() => P.validateState({ ...sequential, balance: { ...sequential.balance, observations: [sequential.balance.observations[0], { id: "static-1", measuredPullCN: 200, measuredVelocityMMps: 0, learnerForce: null }] } }), /only one/);

const ACTIVITY = "static-kinetic-friction-investigation-lab";
let maximumDraftBytes = 0;
function roundTripDraft(value, label) {
  const answer = P.encodeDraft(value);
  maximumDraftBytes = Math.max(maximumDraftBytes, Buffer.byteLength(JSON.stringify({ version: 1, activity: ACTIVITY, kind: "draft", answer }), "utf8"));
  const restored = P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer }, scenario, "draft");
  assert.deepEqual(restored, value, `${label} round-trips exactly`);
  return restored;
}
const zeroAnswer = { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, operationDeltaCN: 0, committed: true };
const staticAnswer = (forceCN) => ({ frictionType: "static", direction: "left", frictionMagnitudeCN: forceCN, operationDeltaCN: forceCN, committed: true });
function completeBalance(order = [220, 450]) {
  let value = roundTripDraft(P.freshState(scenario.seed), "balance untared");
  value = roundTripDraft(P.transitions.setTare(value, 3), "balance observation-ready step 0");
  value = roundTripDraft(P.transitions.recordObservation(value, { id: "zero-pull", measuredPullCN: 0, measuredVelocityMMps: 0, learnerForce: null }), "balance answer-pending step 0");
  value = roundTripDraft(P.transitions.setObservationAnswer(value, "zero-pull", zeroAnswer), "balance answer-complete step 0");
  for (let index = 0; index < order.length; index += 1) {
    value = roundTripDraft(P.transitions.recordObservation(value, { id: "static-1", measuredPullCN: order[index], measuredVelocityMMps: 0, learnerForce: null }), `balance answer-pending nonzero ${index + 1} order ${order.join("-")}`);
    const active = value.balance.observations.find((observation) => observation.learnerForce == null);
    value = roundTripDraft(P.transitions.setObservationAnswer(value, active.id, staticAnswer(active.measuredPullCN)), `balance answer-complete nonzero ${index + 1} order ${order.join("-")}`);
  }
  return value;
}
const ascendingBalance = completeBalance([220, 450]);
const descendingBalance = completeBalance([450, 220]);
assert.deepEqual(descendingBalance.balance.observations.map((item) => item.id), ["zero-pull", "static-low", "static-high"], "reverse measurement order canonicalizes atomically");
assert.deepEqual(descendingBalance.balance.observations.map((item) => item.measuredPullCN), [0, 220, 450]);

let analysisMatrix = roundTripDraft(P.transitions.setPhase(ascendingBalance, "experiment"), "experiment ready");
const runningCheckpoint = roundTripDraft(analysisMatrix, "pre-record running checkpoint");
assert.throws(() => P.validateState({ ...runningCheckpoint, variant: "running" }), /variant/, "fabricated serialized running variant is rejected");
analysisMatrix = roundTripDraft(P.transitions.acceptTrial(analysisMatrix, trial), "experiment accepted");
analysisMatrix = P.transitions.setPhase(analysisMatrix, "analysis");
const interval = (candidate) => ({ startIndex: candidate.startIndex, endIndex: candidate.endIndex });
const taskValues = {
  staticInterval: { complete: { ...interval(candidates.static[0]), frictionType: "static", relation: "equal" }, partial: { ...interval(candidates.static[0]), frictionType: null, relation: null } },
  breakaway: { complete: { markerIndex: 50, estimatedFsMaxCN: 600, identifiedAs: "maximum-static-friction" }, partial: { markerIndex: 50, estimatedFsMaxCN: null, identifiedAs: null } },
  slowPlateau: { complete: { ...interval(candidates.slow[0]), estimatedFkCN: 500 }, partial: { ...interval(candidates.slow[0]), estimatedFkCN: null } },
  acceleration: { complete: { ...interval(candidates.acceleration[0]), relation: "pull-greater", pullEqualsFk: "no" }, partial: { ...interval(candidates.acceleration[0]), relation: null, pullEqualsFk: null } },
  fastPlateau: { complete: { ...interval(candidates.fast[0]), estimatedFkCN: 500, speedComparison: "same-average" }, partial: { ...interval(candidates.fast[0]), estimatedFkCN: null, speedComparison: null } }
};
P.ANALYSIS_KEYS.forEach((key, index) => {
  analysisMatrix = roundTripDraft(analysisMatrix, `analysis ${key} selection-ready`);
  assert.equal(analysisMatrix.working.activeAnalysisTask, index);
  analysisMatrix = roundTripDraft(P.transitions.setAnalysisTask(analysisMatrix, key, taskValues[key].partial), `analysis ${key} selection-only`);
  assert.equal(P.analysisTaskComplete(key, analysisMatrix.analysis[key]), false);
  analysisMatrix = roundTripDraft(P.transitions.setAnalysisTask(analysisMatrix, key, taskValues[key].complete), `analysis ${key} task-complete`);
  if (index < P.ANALYSIS_KEYS.length - 1) analysisMatrix = P.transitions.advanceAnalysisTask(analysisMatrix);
});
analysisMatrix = roundTripDraft(analysisMatrix, "analysis complete");
let predictionMatrix = P.transitions.setPhase(analysisMatrix, "predict");
scenario.predictions.forEach((spec, index) => {
  predictionMatrix = roundTripDraft(predictionMatrix, `prediction ${index} answer-ready`);
  const partial = { id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: null, magnitudeCN: null, motionOutcome: null, committed: false };
  predictionMatrix = roundTripDraft(P.transitions.setPrediction(predictionMatrix, index, partial), `prediction ${index} answer-draft`);
  predictionMatrix = roundTripDraft(P.transitions.setPrediction(predictionMatrix, index, { id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: spec.direction, magnitudeCN: spec.magnitudeCN, motionOutcome: spec.motionOutcome, committed: true }), `prediction ${index} answer-complete`);
  if (index < scenario.predictions.length - 1) predictionMatrix = P.transitions.advancePrediction(predictionMatrix);
});
const matrixReview = roundTripDraft(P.transitions.setPhase(predictionMatrix, "review"), "review complete");

for (const observation of matrixReview.balance.observations) {
  const editState = roundTripDraft(P.transitions.enterReviewEdit(matrixReview, "balance", observation.id), `balance review-edit ${observation.id}`);
  assert.deepEqual(P.transitions.cancelReviewEdit(editState), matrixReview, `balance review-edit ${observation.id} cancels`);
  assert.deepEqual(P.transitions.setObservationAnswer(editState, observation.id, observation.learnerForce), matrixReview, `balance review-edit ${observation.id} saves exact value`);
}
const experimentEdit = roundTripDraft(P.transitions.enterReviewEdit(matrixReview, "experiment", null), "experiment review-edit");
assert.deepEqual(P.transitions.cancelReviewEdit(experimentEdit), matrixReview, "experiment review-edit cancels");
const redone = P.transitions.redoExperiment(experimentEdit);
assert.equal(redone.phase, "experiment"); assert.equal(redone.trial, null); assert.equal(redone.predictions.every((item) => item == null), true);
for (const key of P.ANALYSIS_KEYS) {
  let editState = roundTripDraft(P.transitions.enterReviewEdit(matrixReview, "analysis", key), `analysis review-edit ${key}`);
  const partialValue = taskValues[key].partial;
  editState = roundTripDraft(P.transitions.setAnalysisDraft(editState, key, partialValue), `analysis review-edit ${key} partial draft`);
  assert.deepEqual(P.transitions.cancelReviewEdit(editState), matrixReview, `analysis review-edit ${key} partial cancel`);
  const sameState = roundTripDraft(P.transitions.enterReviewEdit(matrixReview, "analysis", key), `analysis review-edit ${key} same-value row`);
  assert.deepEqual(P.transitions.setAnalysisTask(sameState, key, matrixReview.analysis[key]), matrixReview, `analysis review-edit ${key} exact save is no-op`);
}
for (let index = 0; index < scenario.predictions.length; index += 1) {
  let editState = roundTripDraft(P.transitions.enterReviewEdit(matrixReview, "predict", index), `prediction review-edit ${index}`);
  const original = matrixReview.predictions[index];
  editState = roundTripDraft(P.transitions.setPrediction(editState, index, { ...original, magnitudeCN: Math.min(1200, original.magnitudeCN + 5), committed: false }), `prediction review-edit ${index} partial draft`);
  assert.deepEqual(P.transitions.cancelReviewEdit(editState), matrixReview, `prediction review-edit ${index} cancels`);
  const saveState = roundTripDraft(P.transitions.enterReviewEdit(matrixReview, "predict", index), `prediction review-edit ${index} save row`);
  assert.deepEqual(P.transitions.setPrediction(saveState, index, original), matrixReview, `prediction review-edit ${index} saves exact value`);
}
const changedEachAnalysis = P.ANALYSIS_KEYS.map((key) => {
  const editState = P.transitions.enterReviewEdit(matrixReview, "analysis", key);
  const replacement = P.clone(matrixReview.analysis[key]);
  if (key === "breakaway") replacement.markerIndex = replacement.markerIndex > 0 ? replacement.markerIndex - 1 : replacement.markerIndex + 1;
  else replacement.endIndex = replacement.endIndex > replacement.startIndex ? replacement.endIndex - 1 : replacement.endIndex + 1;
  return P.transitions.setAnalysisTask(editState, key, replacement);
});
for (const changedState of changedEachAnalysis) { assert.equal(changedState.phase, "predict"); assert.equal(changedState.variant, "answer-ready"); assert.equal(changedState.predictions.every((item) => item == null), true); }

assert.ok(maximumDraftBytes < 4000, `all production-shaped draft matrix rows fit suspend_data (${maximumDraftBytes} bytes)`);
const reviewEnvelope = { version: 1, activity: ACTIVITY, kind: "review", answer: P.encodeReview(matrixReview) };
assert.ok(Buffer.byteLength(JSON.stringify(reviewEnvelope), "utf8") < 4000, "canonical review fits suspend_data");
for (const [field, value] of [["p", "balance"], ["q", "bogus"], ["R", true]]) {
  const invalidHeader = P.clone(reviewEnvelope); invalidHeader.answer[field] = value;
  assert.throws(() => P.decodeSnapshot(invalidHeader, scenario, "review"), /noncanonical header/, `finished review rejects noncanonical ${field}`);
}
assert.throws(() => P.decodeSnapshot({ ...reviewEnvelope, version: 2 }, scenario, "review"), /envelope/);
const unknownVersion = P.clone(reviewEnvelope); unknownVersion.answer.v[0] = 2;
assert.throws(() => P.decodeSnapshot(unknownVersion, scenario, "review"), /wire|version|header/);
const corruptTrace = P.clone(reviewEnvelope); corruptTrace.answer.t.x = "not-base64";
assert.throws(() => P.decodeSnapshot(corruptTrace, scenario, "review"));
console.log("Static/kinetic friction persistence checks passed");
