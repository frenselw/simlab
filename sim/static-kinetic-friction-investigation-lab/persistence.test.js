"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./measurement.js");
const S = require("./scoring.js");
const P = require("./persistence.js");

const ACTIVITY = "static-kinetic-friction-investigation-lab";
const scenario = G.generateScenario({ seed: 9 });
const samples = Array.from({ length: 301 }, (_, i) => ({ timeS: i * .1, pullCN: i < 50 ? i * 12 : 500, velocityMMps: i < 50 ? 0 : i < 90 ? 100 : i < 110 ? 100 + (i - 90) * 6 : 220 }));
const trial = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 19 } });
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
function applied(direction, magnitudeCN, committed = true) { return { direction, magnitudeCN, committed }; }
function opposite(direction) { return direction === "left" ? "right" : "left"; }
function finishBalance() {
  let state = roundTrip(P.freshState(scenario.seed), "zero-ready");
  state = roundTrip(P.transitions.setZeroForceAnswer(state, force("none", "none", 0)), "zero answer-complete");
  assert.equal(state.variant, "static-ready");
  state = roundTrip(P.transitions.setStaticForceAnswer(state, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, applied(scenario.balancePullDirection, scenario.balancePullCN), force("static", opposite(scenario.balancePullDirection), scenario.balancePullCN)), "static answer-complete");
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
assert.throws(() => P.transitions.setStaticForceAnswer(P.freshState(1), { direction: "right", magnitudeCN: 100 }, applied("right", 100), force("static", "left", 100)), /zero-force/);
assert.throws(() => P.transitions.recordBreakawayTrial(P.freshState(1), { direction: "right", pullCN: 500 }), /breakaway/);
assert.throws(() => P.transitions.setBreakawayAnswer(P.freshState(1), 100), /find breakaway/);

state = P.transitions.setPhase(state, "experiment");
state = P.transitions.acceptTrial(state, trial);
state = P.transitions.setPhase(state, "analysis");
const candidates = M.findCandidateWindows(trial);
assert.equal(state.analysis.staticFriction, null);
assert.equal(state.analysis.maximumStaticFriction, null);
assert.equal(state.analysis.kineticFriction, null);
assert.throws(() => P.transitions.setAnalysisTask(state, "kineticFriction", { index: 10, committed: false }), /active/);
state = P.transitions.setAnalysisMarkersDraft(state, {
  staticFriction: { index: candidates.static[0].startIndex, committed: false },
  maximumStaticFriction: { index: 50, committed: false },
  kineticFriction: { index: candidates.slow[0].startIndex, committed: false }
});
assert.equal(state.variant, "selection-only");
state = P.decodeSnapshot(snapshot(state), scenario, "draft");
state = P.transitions.setAnalysisMarkers(state, {
  staticFriction: { index: candidates.static[0].startIndex, committed: true },
  maximumStaticFriction: { index: 50, committed: true },
  kineticFriction: { index: candidates.slow[0].startIndex, committed: true }
});
assert.equal(P.hasAllAnalysisFields(state), true);
state = P.transitions.setPhase(state, "predict");
const requiredOnly = state;
scenario.predictions.forEach((spec, index) => {
  const partial = { id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: null, magnitudeCN: null, motionOutcome: null, committed: false };
  state = P.transitions.setPrediction(state, index, partial);
  state = P.decodeSnapshot(snapshot(state), scenario, "draft");
  state = P.transitions.setPrediction(state, index, { id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: spec.direction, magnitudeCN: spec.magnitudeCN, motionOutcome: spec.motionOutcome, committed: true });
  if (index < scenario.predictions.length - 1) state = P.transitions.advancePrediction(state);
});
state = P.transitions.setPhase(state, "review");
assert.equal(P.hasCompleteAnswer(state), true);

// Part D is optional at submission: an A/B/C-complete state may enter review
// with all four prediction slots still null, and scoring leaves Part D at 0.
const sparseReview = P.transitions.setPhase(requiredOnly, "review");
assert.equal(P.hasRequiredAuthority(sparseReview), true);
assert.equal(P.hasRequiredAnswer(sparseReview), true);
assert.equal(P.hasAllPredictions(sparseReview), false);
assert.equal(S.scoreAnswer(sparseReview, scenario).breakdown.predictions.score, 0);
const sparseReviewWire = P.encodeReview(sparseReview);
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: sparseReviewWire }, scenario, "review"), P.normalizeReview(sparseReview));

// A completely unanswered attempt is still a legal review/submit snapshot;
// scoring, rather than persistence validation, assigns zero to every rubric.
const blankReview = P.transitions.setPhase(P.freshState(scenario.seed), "review");
assert.equal(P.hasSubmittableAnswer(blankReview), true);
assert.equal(P.hasRequiredAuthority(blankReview), false);
assert.equal(P.hasCompleteAnswer(blankReview), false);
const blankResult = S.scoreAnswer(blankReview, scenario);
assert.equal(blankResult.score, 0);
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: P.encodeReview(blankReview) }, scenario, "review"), P.normalizeReview(blankReview));

// A1 and A2 are normal editable answers too: changing one Part A answer does
// not erase independently completed work in another task.
let normalEdit = P.transitions.setZeroForceAnswer(finishBalance(), force("static", "right", 100));
assert.equal(normalEdit.phase, "balance");
assert.notEqual(normalEdit.balance.staticCase, null);
assert.equal(normalEdit.trial, null);
normalEdit = P.transitions.setZeroForceAnswer(normalEdit, force("none", "none", 0));
normalEdit = P.transitions.setStaticForceAnswer(normalEdit, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, applied(scenario.balancePullDirection, scenario.balancePullCN), force("static", opposite(scenario.balancePullDirection), scenario.balancePullCN));
normalEdit = P.transitions.recordBreakawayTrial(normalEdit, { direction: scenario.balancePullDirection, pullCN: 700 });
normalEdit = P.transitions.setStaticForceAnswer(normalEdit, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, applied(opposite(scenario.balancePullDirection), scenario.balancePullCN + 50), force("none", "none", 0));
assert.equal(normalEdit.balance.breakaway.bestPullCN, 680);
assert.equal(normalEdit.balance.staticCase.learnerAppliedForce.direction, opposite(scenario.balancePullDirection));

// A/B/C/D are independently navigable. B can start before Part A is complete,
// D can hold the current sequential prediction before C is finished, and
// returning to an earlier part preserves the work already made elsewhere.
let freeNavigation = P.freshState(scenario.seed);
freeNavigation = P.transitions.setPhase(freeNavigation, "experiment");
assert.equal(freeNavigation.phase, "experiment");
let waitingAnalysis = P.transitions.setPhase(P.freshState(scenario.seed), "analysis");
assert.equal(waitingAnalysis.variant, "waiting-for-trial");
freeNavigation = P.transitions.acceptTrial(freeNavigation, trial);
freeNavigation = P.transitions.setPhase(freeNavigation, "predict");
const earlyPrediction = scenario.predictions[0];
freeNavigation = P.transitions.setPrediction(freeNavigation, 0, { id: earlyPrediction.id, scenarioId: earlyPrediction.scenarioId, frictionType: earlyPrediction.frictionType, direction: earlyPrediction.direction, magnitudeCN: earlyPrediction.magnitudeCN, motionOutcome: earlyPrediction.motionOutcome, committed: true });
freeNavigation = roundTrip(freeNavigation, "free navigation with first D answer");
freeNavigation = P.transitions.setPhase(freeNavigation, "balance");
assert.equal(freeNavigation.phase, "balance");
assert.equal(freeNavigation.predictions[0].committed, true);
freeNavigation = P.transitions.setPhase(freeNavigation, "analysis");
assert.equal(freeNavigation.phase, "analysis");
freeNavigation = P.transitions.selectAnalysisTask(freeNavigation, "maximumStaticFriction");
assert.equal(freeNavigation.working.activeAnalysisTask, 1);
freeNavigation = P.transitions.setPhase(freeNavigation, "predict");
assert.equal(freeNavigation.working.activePredictionIndex, 1, "returning to D resumes the next unanswered question");

for (const [key, save] of [
  ["zero-force", (edit) => P.transitions.setZeroForceAnswer(edit, force("none", "none", 0))],
  ["static-case", (edit) => P.transitions.setStaticForceAnswer(edit, { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN }, applied(scenario.balancePullDirection, scenario.balancePullCN), force("static", opposite(scenario.balancePullDirection), scenario.balancePullCN))],
  ["breakaway", (edit) => P.transitions.setBreakawayAnswer(edit, state.balance.breakaway.learnerMaxCN)]
]) {
  const edit = roundTrip(P.transitions.enterReviewEdit(state, "balance", key), `review-edit ${key}`);
  assert.equal(edit.working.editDraft.kind, "balance");
  assert.deepEqual(P.transitions.cancelReviewEdit(edit), state, `${key} review edit cancel restores authority`);
  assert.deepEqual(save(edit), state, `${key} exact review edit save is a no-op`);
}
const analysisEdit = roundTrip(P.transitions.enterReviewEdit(state, "analysis", "kineticFriction"), "analysis review edit");
const analysisDraft = P.transitions.setAnalysisDraft(analysisEdit, "kineticFriction", { index: candidates.slow[0].endIndex, committed: false });
assert.deepEqual(P.transitions.cancelReviewEdit(roundTrip(analysisDraft, "analysis partial review draft")), state, "analysis review draft cancellation restores authority");
const predictionEdit = roundTrip(P.transitions.enterReviewEdit(state, "predict", 1), "prediction review edit");
const predictionDraft = P.transitions.setPrediction(predictionEdit, 1, { ...state.predictions[1], magnitudeCN: null, committed: false });
assert.deepEqual(P.transitions.cancelReviewEdit(roundTrip(predictionDraft, "prediction partial review draft")), state, "prediction review draft cancellation restores authority");

const review = P.encodeReview(state);
assert.equal(review.w, "s6");
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
