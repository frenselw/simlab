"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./measurement.js");
const S = require("./scoring.js");
const P = require("./persistence.js");

const ACTIVITY = "static-kinetic-friction-investigation-lab";
const scenario = G.generateScenario({ seed: 9 });
const samples = Array.from({ length: 301 }, (_, i) => ({ timeS: i * .04, pullCN: i < 50 ? i * 12 : 500, velocityMMps: i < 50 ? 0 : i < 90 ? 100 : i < 110 ? 100 + (i - 90) * 6 : 220 }));
const trial = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 49 } });
const snapshot = (state, kind = "draft") => ({ version: 1, activity: ACTIVITY, kind, answer: kind === "review" ? P.encodeReview(state) : P.encodeDraft(state) });
let maximumDraftBytes = 0;
function roundTrip(state, label) {
  const answer = P.encodeDraft(state);
  maximumDraftBytes = Math.max(maximumDraftBytes, Buffer.byteLength(JSON.stringify({ version: 1, activity: ACTIVITY, kind: "draft", answer }), "utf8"));
  const restored = P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer }, scenario, "draft");
  assert.deepEqual(restored, state, `${label} round-trips exactly`);
  return restored;
}
function force(frictionType, direction, frictionMagnitudeCN, committed = true) { return { frictionType, direction, frictionMagnitudeCN, committed }; }
function opposite(direction) { return direction === "left" ? "right" : "left"; }
function finishBalance() {
  let state = roundTrip(P.freshState(scenario.seed), "zero-ready");
  state = roundTrip(P.transitions.setZeroForceAnswer(state, force("none", "none", 0)), "zero answer-complete");
  assert.equal(state.variant, "static-ready");
  state = roundTrip(P.transitions.setStaticForceAnswer(state, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, force("static", opposite(scenario.balancePullDirection), scenario.balancePullCN)), "static answer-complete");
  assert.equal(state.variant, "breakaway-ready");
  state = roundTrip(P.transitions.recordBreakawayTrial(state, { direction: "left", pullCN: 700 }), "breakaway first trial");
  state = roundTrip(P.transitions.recordBreakawayTrial(state, { direction: "right", pullCN: 680 }), "breakaway repeated better trial");
  assert.equal(state.balance.breakaway.bestPullCN, 680);
  state = roundTrip(P.transitions.setBreakawayAnswer(state, Math.round(scenario.staticLimitMeanN * 100)), "breakaway answer-complete");
  assert.equal(state.variant, "answer-complete");
  assert.equal(P.allBalanceAnswersCommitted(state), true);
  return state;
}

let state = finishBalance();
assert.equal(P.transitions.setTare, undefined, "learner tare is not a public transition");
assert.throws(() => P.transitions.setZeroForceAnswer(P.freshState(1), force("none", "none", 0, false)), /committed/);
assert.throws(() => P.transitions.setStaticForceAnswer(P.freshState(1), { direction: "right", magnitudeCN: 100 }, force("static", "left", 100)), /zero-force/);
assert.throws(() => P.transitions.recordBreakawayTrial(P.freshState(1), { direction: "right", pullCN: 500 }), /breakaway/);
assert.throws(() => P.transitions.setBreakawayAnswer(P.freshState(1), 100), /find breakaway/);

state = P.transitions.setPhase(state, "experiment");
state = P.transitions.acceptTrial(state, trial);
state = P.transitions.setPhase(state, "analysis");
const candidates = M.findCandidateWindows(trial);
assert.throws(() => P.transitions.setAnalysisTask(state, "fastPlateau", { startIndex: 10, endIndex: 20 }), /active/);
state = P.transitions.setAnalysisTask(state, "staticInterval", { ...candidates.static[0], frictionType: null, relation: null });
assert.equal(state.variant, "selection-only");
state = P.decodeSnapshot(snapshot(state), scenario, "draft");
state = P.transitions.setAnalysisTask(state, "staticInterval", { ...candidates.static[0], frictionType: "static", relation: "equal" });
state = P.transitions.advanceAnalysisTask(state);
state = P.transitions.setAnalysisTask(state, "breakaway", { markerIndex: 50, estimatedFsMaxCN: 600, identifiedAs: "maximum-static-friction" });
state = P.transitions.advanceAnalysisTask(state);
state = P.decodeSnapshot(snapshot(state), scenario, "draft");
assert.equal(state.working.activeAnalysisTask, 2);
state = P.transitions.setAnalysisTask(state, "slowPlateau", { ...candidates.slow[0], estimatedFkCN: 500 });
state = P.transitions.advanceAnalysisTask(state);
state = P.transitions.setAnalysisTask(state, "acceleration", { ...candidates.acceleration[0], relation: "pull-greater", pullEqualsFk: "no" });
state = P.transitions.advanceAnalysisTask(state);
state = P.transitions.setAnalysisTask(state, "fastPlateau", { ...candidates.fast[0], estimatedFkCN: 500, speedComparison: "same-average" });
state = P.transitions.setPhase(state, "predict");
scenario.predictions.forEach((spec, index) => {
  const partial = { id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: null, magnitudeCN: null, motionOutcome: null, committed: false };
  state = P.transitions.setPrediction(state, index, partial);
  state = P.decodeSnapshot(snapshot(state), scenario, "draft");
  state = P.transitions.setPrediction(state, index, { id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: spec.direction, magnitudeCN: spec.magnitudeCN, motionOutcome: spec.motionOutcome, committed: true });
  if (index < scenario.predictions.length - 1) state = P.transitions.advancePrediction(state);
});
state = P.transitions.setPhase(state, "review");
assert.equal(P.hasCompleteAnswer(state), true);

for (const [key, save] of [
  ["zero-force", (edit) => P.transitions.setZeroForceAnswer(edit, force("none", "none", 0))],
  ["static-case", (edit) => P.transitions.setStaticForceAnswer(edit, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, force("static", opposite(scenario.balancePullDirection), scenario.balancePullCN))],
  ["breakaway", (edit) => P.transitions.setBreakawayAnswer(edit, state.balance.breakaway.learnerMaxCN)]
]) {
  const edit = roundTrip(P.transitions.enterReviewEdit(state, "balance", key), `review-edit ${key}`);
  assert.equal(edit.working.editDraft.kind, "balance");
  assert.deepEqual(P.transitions.cancelReviewEdit(edit), state, `${key} review edit cancel restores authority`);
  assert.deepEqual(save(edit), state, `${key} exact review edit save is a no-op`);
}
const analysisEdit = roundTrip(P.transitions.enterReviewEdit(state, "analysis", "slowPlateau"), "analysis review edit");
const analysisDraft = P.transitions.setAnalysisDraft(analysisEdit, "slowPlateau", { startIndex: candidates.slow[0].startIndex, endIndex: candidates.slow[0].endIndex, estimatedFkCN: null });
assert.deepEqual(P.transitions.cancelReviewEdit(roundTrip(analysisDraft, "analysis partial review draft")), state, "analysis review draft cancellation restores authority");
const predictionEdit = roundTrip(P.transitions.enterReviewEdit(state, "predict", 1), "prediction review edit");
const predictionDraft = P.transitions.setPrediction(predictionEdit, 1, { ...state.predictions[1], magnitudeCN: null, committed: false });
assert.deepEqual(P.transitions.cancelReviewEdit(roundTrip(predictionDraft, "prediction partial review draft")), state, "prediction review draft cancellation restores authority");

const review = P.encodeReview(state);
assert.equal(review.w, "s3");
assert.ok(Buffer.byteLength(JSON.stringify({ version: 1, activity: ACTIVITY, kind: "review", answer: review }), "utf8") < 4000, "canonical review fits suspend_data");
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: review }, scenario, "review"), P.normalizeReview(state));
assert.throws(() => P.validateState({ ...state, balance: { ...state.balance, tareCorrectionCN: 3 } }), /invalid/);
const malformedForce = P.clone(review); malformedForce.b.z = [0, 0, 0, 2]; assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: malformedForce }, scenario, "review"), /force|zero/);
const malformedBreakaway = P.clone(review); malformedBreakaway.b.r[4] = 2; assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: malformedBreakaway }, scenario, "review"), /breakaway/);
const unknownVersion = P.clone(review); unknownVersion.v[0] = 2; assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: unknownVersion }, scenario, "review"), /wire|version|header/);
assert.throws(() => P.decodeSnapshot({ version: 2, activity: ACTIVITY, kind: "review", answer: review }, scenario, "review"), /envelope/);
const legacyDraft = P.clone(P.encodeDraft(P.freshState(41))); legacyDraft.w = "s2"; legacyDraft.v = [2, 1, 1, 2, 1];
const migrated = P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: legacyDraft }, null, "draft");
assert.equal(migrated.variant, "zero-ready"); assert.deepEqual(migrated.balance, P.freshState(41).balance);
assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: { ...review, w: "s2" } }, scenario, "review"), /legacy review/);
assert.ok(maximumDraftBytes < 4000, `all production-shaped draft rows fit suspend_data (${maximumDraftBytes} bytes)`);
console.log("Static/kinetic friction persistence checks passed");
