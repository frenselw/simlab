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
assert.deepEqual(state.analysis, P.emptyAnalysis(), "an unsaved C marker draft never replaces canonical analysis authority");
assert.equal(state.working.analysisDraft.maximumStaticFriction.index, 50);
state = P.decodeSnapshot(snapshot(state), scenario, "draft");
assert.equal(state.working.analysisDraft.kineticFriction.index, candidates.slow[0].startIndex, "working C marker draft survives a draft round-trip");
state = P.transitions.setAnalysisMarkers(state, {
  staticFriction: { index: candidates.static[0].startIndex, committed: true },
  maximumStaticFriction: { index: 50, committed: true },
  kineticFriction: { index: candidates.slow[0].startIndex, committed: true }
});
assert.equal(P.hasAllAnalysisFields(state), true);
assert.equal(state.working.analysisDraft, null, "saving all C markers clears only the working draft");
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

// Switching freely between D questions must keep an explicitly saved answer
// canonical while a later edit remains a separate working draft.
const savedD1 = P.clone(state.predictions[0]);
let dirtyPrediction = P.transitions.setPhase(state, "predict");
const changedD1 = { ...savedD1, frictionType: savedD1.frictionType === "kinetic" ? "static" : "kinetic", committed: false };
dirtyPrediction = P.transitions.setPrediction(dirtyPrediction, 0, changedD1);
assert.deepEqual(dirtyPrediction.predictions[0], savedD1, "editing a saved D answer does not replace its canonical answer");
assert.deepEqual(dirtyPrediction.working.predictionDraft[0], changedD1, "editing a saved D answer creates a separate working draft");
dirtyPrediction = P.transitions.selectPrediction(dirtyPrediction, 3);
dirtyPrediction = roundTrip(dirtyPrediction, "D answer draft while switching questions");
const dirtyPredictionReview = P.transitions.setPhase(dirtyPrediction, "review");
assert.deepEqual(dirtyPredictionReview.predictions[0], savedD1, "entering review keeps the last explicitly saved D answer");
assert.equal(dirtyPredictionReview.working, undefined, "uncommitted D drafts are discarded from review without changing canonical answers");

// Part D is optional at submission: an A/B/C-complete state may enter review
// with all four prediction slots still null, and scoring leaves Part D at 0.
const sparseReview = P.transitions.setPhase(requiredOnly, "review");
assert.equal(P.hasRequiredAuthority(sparseReview), true);
assert.equal(P.hasRequiredAnswer(sparseReview), true);
assert.equal(P.hasAllPredictions(sparseReview), false);
assert.equal(S.scoreAnswer(sparseReview, scenario).breakdown.predictions.score, 0);
const sparseReviewWire = P.encodeReview(sparseReview);
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: sparseReviewWire }, scenario, "review"), P.normalizeReview(sparseReview));

// Uncommitted D input is a working draft only. Entering review drops it from
// both the editable review state and the final canonical review wire.
const firstPredictionSpec = scenario.predictions[0];
const uncommittedPrediction = P.transitions.setPrediction(requiredOnly, 0, { id: firstPredictionSpec.id, scenarioId: firstPredictionSpec.scenarioId, frictionType: firstPredictionSpec.frictionType, direction: null, magnitudeCN: null, motionOutcome: null, committed: false });
const normalizedUncommittedPrediction = P.normalizeReview(uncommittedPrediction);
assert.equal(normalizedUncommittedPrediction.predictions[0], null, "uncommitted D is null in editable review");
assert.equal(P.encodeReview(uncommittedPrediction).P[0], null, "uncommitted D is absent from the final review wire");

// A completely unanswered attempt is still a legal review/submit snapshot;
// scoring, rather than persistence validation, assigns zero to every rubric.
const blankReview = P.transitions.setPhase(P.freshState(scenario.seed), "review");
assert.equal(P.hasSubmittableAnswer(blankReview), true);
assert.equal(P.hasRequiredAuthority(blankReview), false);
assert.equal(P.hasCompleteAnswer(blankReview), false);
const blankResult = S.scoreAnswer(blankReview, scenario);
assert.equal(blankResult.score, 0);
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: P.encodeReview(blankReview) }, scenario, "review"), P.normalizeReview(blankReview));

// A1 persistence validates only answer structure.  Physics consistency is a
// scoring concern so complete but incorrect combinations remain saveable.
for (const [answer, expectedPoints] of [
  [force("none", "right", 0), 3],
  [force("none", "none", 100), 2],
  [force("static", "none", 0), 3]
]) {
  const saved = P.transitions.setZeroForceAnswer(P.freshState(scenario.seed), answer);
  const restored = roundTrip(saved, `A1 independent component answer ${JSON.stringify(answer)}`);
  assert.deepEqual(restored.balance.zeroForce, answer);
  assert.equal(S.balanceScore(restored, scenario).detail.find((item) => item.key === "zero-force").points, expectedPoints);
}

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
const sameAnalysis = P.transitions.setAnalysisTask(analysisEdit, "kineticFriction", { ...state.analysis.kineticFriction, committed: true });
assert.deepEqual(sameAnalysis, state, "same-value Part C review edit preserves all Part D answers");
const currentKineticIndex = state.analysis.kineticFriction.index;
const changedKineticIndex = currentKineticIndex < M.unpackTrace(state.trial).merged.length - 1 ? currentKineticIndex + 1 : currentKineticIndex - 1;
const changedAnalysis = P.transitions.setAnalysisTask(analysisEdit, "kineticFriction", { index: changedKineticIndex, committed: true });
assert.equal(changedAnalysis.phase, "predict", "a changed Part C authority returns to prediction");
assert.deepEqual(changedAnalysis.predictions, [null, null, null, null], "a changed Part C authority invalidates all dependent Part D answers");

// The normal Part C route keeps canonical markers and dependent D answers
// immutable until the learner explicitly saves the working marker draft.
const canonicalAnalysis = P.clone(state.analysis);
const canonicalPredictions = P.clone(state.predictions);
let normalAnalysisDraft = P.transitions.setPhase(state, "analysis");
normalAnalysisDraft = P.transitions.setAnalysisMarkersDraft(normalAnalysisDraft, {
  ...P.clone(canonicalAnalysis),
  kineticFriction: { index: changedKineticIndex, committed: false }
});
normalAnalysisDraft = roundTrip(normalAnalysisDraft, "normal Part C unsaved marker draft");
assert.deepEqual(normalAnalysisDraft.analysis, canonicalAnalysis, "normal C dragging leaves saved C authority unchanged");
assert.deepEqual(normalAnalysisDraft.predictions, canonicalPredictions, "normal C dragging leaves D authority unchanged");
normalAnalysisDraft = P.transitions.setPhase(normalAnalysisDraft, "predict");
assert.deepEqual(normalAnalysisDraft.analysis, canonicalAnalysis, "leaving C without saving preserves canonical C");
assert.deepEqual(normalAnalysisDraft.predictions, canonicalPredictions, "leaving C without saving preserves D");
normalAnalysisDraft = P.transitions.setPhase(normalAnalysisDraft, "analysis");
assert.equal(normalAnalysisDraft.working.analysisDraft.kineticFriction.index, changedKineticIndex, "returning to C restores the unsaved working draft");
const dirtyAnalysisReview = roundTrip(P.normalizeReview(normalAnalysisDraft), "review retaining unsaved Part C marker draft");
assert.deepEqual(dirtyAnalysisReview.analysis, canonicalAnalysis, "review uses only saved Part C authority");
assert.equal(dirtyAnalysisReview.working.analysisDraft.kineticFriction.index, changedKineticIndex, "editable review retains the unsaved C marker separately");
const returnedDirtyAnalysis = P.transitions.setPhase(dirtyAnalysisReview, "analysis");
assert.equal(returnedDirtyAnalysis.working.analysisDraft.kineticFriction.index, changedKineticIndex, "returning from review resumes the unsaved C marker");
const sameValueSave = P.transitions.setAnalysisMarkers(normalAnalysisDraft, Object.fromEntries(P.ANALYSIS_KEYS.map((key) => [key, { index: canonicalAnalysis[key].index, committed: true }])));
assert.deepEqual(sameValueSave.analysis, canonicalAnalysis, "saving the original C indices is a semantic no-op");
assert.deepEqual(sameValueSave.predictions, canonicalPredictions, "same-value normal C save preserves D");
const changedValueSave = P.transitions.setAnalysisMarkers(normalAnalysisDraft, Object.fromEntries(P.ANALYSIS_KEYS.map((key) => [key, { index: key === "kineticFriction" ? changedKineticIndex : canonicalAnalysis[key].index, committed: true }])));
assert.deepEqual(changedValueSave.predictions, [null, null, null, null], "changed normal C save invalidates D only at explicit save");
const predictionEdit = roundTrip(P.transitions.enterReviewEdit(state, "predict", 1), "prediction review edit");
const predictionDraft = P.transitions.setPrediction(predictionEdit, 1, { ...state.predictions[1], magnitudeCN: null, committed: false });
assert.deepEqual(P.transitions.cancelReviewEdit(roundTrip(predictionDraft, "prediction partial review draft")), state, "prediction review draft cancellation restores authority");

const review = P.encodeReview(state);
assert.equal(G.RUBRIC_VERSION, P.RUBRIC_VERSION, "generator and persistence use one rubric authority");
assert.equal(S.RUBRIC_VERSION, P.RUBRIC_VERSION, "scoring and persistence use one rubric authority");
assert.equal(review.v[4], P.RUBRIC_VERSION, "snapshot header uses the shared rubric authority");
assert.equal(review.w, "s6");
assert.ok(Buffer.byteLength(JSON.stringify({ version: 1, activity: ACTIVITY, kind: "review", answer: review }), "utf8") < 4000, "canonical review fits suspend_data");
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: review }, scenario, "review"), P.normalizeReview(state));
assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: review }, { ...scenario, rubricVersion: 2 }, "review"), /scenario mismatch/, "a mismatched scenario rubric is rejected");
assert.throws(() => P.validateState({ ...state, balance: { ...state.balance, tareCorrectionCN: 3 } }), /invalid/);
const malformedForce = P.clone(review); malformedForce.b.z = [0, 0, 0, 2]; assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: malformedForce }, scenario, "review"), /force|zero/);
const malformedBreakaway = P.clone(review); malformedBreakaway.b.r[4] = 2; assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: malformedBreakaway }, scenario, "review"), /breakaway/);
const unknownVersion = P.clone(review); unknownVersion.v[0] = 2; assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: unknownVersion }, scenario, "review"), /wire|version|header/);
assert.throws(() => P.decodeSnapshot({ version: 2, activity: ACTIVITY, kind: "review", answer: review }, scenario, "review"), /envelope/);
const legacyDraft = P.clone(P.encodeDraft(P.freshState(41))); legacyDraft.w = "s2"; legacyDraft.v = [2, 1, 1, 2, 1];
const migrated = P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: legacyDraft }, null, "draft");
assert.equal(migrated.variant, "zero-ready"); assert.deepEqual(migrated.balance, P.freshState(41).balance);
assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: { ...review, w: "s2" } }, scenario, "review"), /legacy review/);

// Measurement v5 never relabels an older B trace as current authority.  Draft
// migration preserves independent A/D answers but clears B/C and resumes at B.
const oldMeasurementSpec = scenario.predictions[0];
const oldMeasurementState = P.transitions.setPrediction(requiredOnly, 0, { id: oldMeasurementSpec.id, scenarioId: oldMeasurementSpec.scenarioId, frictionType: oldMeasurementSpec.frictionType, direction: oldMeasurementSpec.direction, magnitudeCN: oldMeasurementSpec.magnitudeCN, motionOutcome: oldMeasurementSpec.motionOutcome, committed: true });
const oldV4Wire = P.clone(P.encodeDraft(oldMeasurementState)); oldV4Wire.v[3] = 4;
const migratedV4 = P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: oldV4Wire }, scenario, "draft");
assert.equal(migratedV4.phase, "experiment");
assert.equal(migratedV4.trial, null);
assert.deepEqual(migratedV4.analysis, P.emptyAnalysis());
assert.deepEqual(migratedV4.balance, oldMeasurementState.balance);
assert.deepEqual(migratedV4.predictions, oldMeasurementState.predictions);
const oldS5Wire = P.clone(P.encodeDraft(oldMeasurementState)); oldS5Wire.w = "s5"; oldS5Wire.v = [5, 1, 7, 4, 2]; delete oldS5Wire.k.m;
const migratedS5 = P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: oldS5Wire }, scenario, "draft");
assert.equal(migratedS5.trial, null, "s5 traces are cleared even if their header was manually relabelled v5");
assert.deepEqual(migratedS5.analysis, P.emptyAnalysis());
assert.deepEqual(migratedS5.predictions, oldMeasurementState.predictions);
const preWorkingDraftWire = P.clone(P.encodeDraft(oldMeasurementState)); delete preWorkingDraftWire.k.m; delete preWorkingDraftWire.k.n;
assert.deepEqual(P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: preWorkingDraftWire }, scenario, "draft"), oldMeasurementState, "current s6 drafts written before working C draft storage remain compatible");
const oldV4Review = P.clone(review); oldV4Review.v[3] = 4;
assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "review", answer: oldV4Review }, scenario, "review"), /legacy review/, "finished reviews are never silently rescored under a new measurement contract");
for (const futureOrCorruptMeasurement of [6, 999, "corrupt", null]) {
  const unsupported = P.clone(P.encodeDraft(oldMeasurementState)); unsupported.v[3] = futureOrCorruptMeasurement;
  assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: unsupported }, scenario, "draft"), /header/, `measurement header ${String(futureOrCorruptMeasurement)} fails closed`);
}
const mixedLegacyHeader = P.clone(P.encodeDraft(oldMeasurementState)); mixedLegacyHeader.v = [6, 1, 6, 4, 3];
assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: mixedLegacyHeader }, scenario, "draft"), /header/, "mixed old measurement header fails closed");
const unknownS5Header = P.clone(oldS5Wire); unknownS5Header.v = [5, 1, 99, 4, 2];
assert.throws(() => P.decodeSnapshot({ version: 1, activity: ACTIVITY, kind: "draft", answer: unknownS5Header }, scenario, "draft"), /header/, "unknown s5 header fails closed");
assert.ok(maximumDraftBytes < 4000, `all production-shaped draft rows fit suspend_data (${maximumDraftBytes} bytes)`);
console.log("Static/kinetic friction persistence checks passed");
