"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");
const S = require("./scoring.js");
const P = require("./persistence.js");

function evidence(positionM) { return { zeroM: positionM, mode: "pointer", moveM: 0.01 }; }
function measurement(scenario, springKey, loadKey) {
  const forceN = S.forceByKey[loadKey];
  const spring = scenario.springs[springKey];
  return { loadKey, cursorM: M.endpointM(spring.naturalLengthM, forceN, spring.kNPerM), mode: "pointer", moveM: 0.01 };
}

function fullDraft(scenario, seed = scenario.seed) {
  let state = P.freshState(seed);
  state = P.transitions.replaceCalibration(state, "A", evidence(scenario.springs.A.naturalLengthM), scenario);
  state = P.transitions.replaceCalibration(state, "B", evidence(scenario.springs.B.naturalLengthM), scenario);
  for (const springKey of ["A", "B"]) for (const loadKey of P.LOAD_KEYS) state = P.transitions.replaceMeasurement(state, springKey, loadKey, measurement(scenario, springKey, loadKey), scenario);
  state = P.transitions.replaceModel(state, "A", 2.5 / scenario.springs.A.kNPerM, scenario);
  state = P.transitions.replaceModel(state, "B", 2.5 / scenario.springs.B.kNPerM, scenario);
  state = P.transitions.setPhase(state, "predict", scenario);
  state = scenario.predictions.reduce((current, spec, index) => P.transitions.replacePrediction(current, index, M.extensionM(spec.forceN, scenario.springs[spec.springKey].kNPerM), scenario), state);
  state = P.transitions.setPhase(state, "design", scenario);
  const optimal = M.optimalSafeDesign(scenario);
  state = P.transitions.replaceDesign(state, optimal.springKey, optimal.moduleCount, scenario);
  return state;
}

const scenario = G.generateScenario({ seed: 31 });
const initial = P.freshState(scenario.seed);
assert.equal(P.validateAnswer(initial, scenario, { kind: "draft" }).ok, true);
assert.equal(initial.phase, "investigate");

const fixtures = [];
let state = initial;
fixtures.push(["investigate-new", state]);
state = P.transitions.replaceCalibration(state, "A", evidence(scenario.springs.A.naturalLengthM), scenario);
fixtures.push(["investigate-one-calibration", state]);
state = P.transitions.replaceCalibration(state, "B", evidence(scenario.springs.B.naturalLengthM), scenario);
state = P.transitions.replaceMeasurement(state, "A", "F1", measurement(scenario, "A", "F1"), scenario);
fixtures.push(["investigate-partial-measurement", state]);
state = P.transitions.replaceMeasurement(state, "A", "F2", measurement(scenario, "A", "F2"), scenario);
state = P.transitions.replaceMeasurement(state, "A", "F3", measurement(scenario, "A", "F3"), scenario);
state = P.transitions.replaceMeasurement(state, "B", "F1", measurement(scenario, "B", "F1"), scenario);
state = P.transitions.replaceMeasurement(state, "B", "F2", measurement(scenario, "B", "F2"), scenario);
state = P.transitions.replaceMeasurement(state, "B", "F3", measurement(scenario, "B", "F3"), scenario);
fixtures.push(["investigate-complete", state]);
state = P.transitions.replaceModel(state, "A", 2.5 / scenario.springs.A.kNPerM, scenario);
fixtures.push(["model-one", state]);
state = P.transitions.replaceModel(state, "B", 2.5 / scenario.springs.B.kNPerM, scenario);
fixtures.push(["model-complete", state]);
state = P.transitions.setPhase(state, "predict", scenario);
fixtures.push(["predict-empty", state]);
state = P.transitions.replacePrediction(state, 0, M.extensionM(scenario.predictions[0].forceN, scenario.springs[scenario.predictions[0].springKey].kNPerM), scenario);
fixtures.push(["predict-one", state]);
state = P.transitions.replacePrediction(state, 1, M.extensionM(scenario.predictions[1].forceN, scenario.springs[scenario.predictions[1].springKey].kNPerM), scenario);
state = P.transitions.replacePrediction(state, 2, M.extensionM(scenario.predictions[2].forceN, scenario.springs[scenario.predictions[2].springKey].kNPerM), scenario);
assert.equal(state.phase, "predict", "recording the third prediction does not auto-advance to design");
assert.equal(state.activePredictionIndex, 2, "the completed prediction remains selected for review");
fixtures.push(["predict-complete", state]);
state = P.transitions.setPhase(state, "design", scenario);
fixtures.push(["design-empty", state]);
const optimal = M.optimalSafeDesign(scenario);
state = P.transitions.replaceDesign(state, optimal.springKey, optimal.moduleCount, scenario);
fixtures.push(["design-complete", state]);
const review = P.transitions.setPhase(state, "review", scenario);
fixtures.push(["review-complete", review]);

for (const [name, fixture] of fixtures) {
  const kind = fixture.phase === "review" ? "review" : "draft";
  const snapshot = P.makeSnapshot(kind, fixture, scenario, kind === "review" ? { score: 100, passed: true } : undefined);
  assert.ok(P.snapshotBytes(snapshot) <= 4000, `${name} snapshot too large`);
  const restored = P.decodeSnapshot(snapshot, scenario, kind);
  assert.deepEqual(restored, fixture, `${name} changed on round trip`);
  assert.equal(P.validateAnswer(restored, scenario, { kind }).ok, true);
}
const reviewSnapshot = P.makeSnapshot("review", review, scenario, { score: 100, passed: true });
assert.ok(P.snapshotBytes(reviewSnapshot) <= 4000);
assert.equal(P.decodeSnapshot(reviewSnapshot, scenario, "review").phase, "review");
assert.equal(S.scoreAnswer(review, scenario).score, S.scoreAnswer(P.decodeSnapshot(reviewSnapshot, scenario, "review"), scenario).score);

const editModel = P.transitions.editSection(review, "model", scenario);
assert.equal(editModel.fromReview, true);
assert.ok(editModel.predictions.every(Boolean));
assert.ok(editModel.design);
const unchangedModel = P.transitions.replaceModel(editModel, "A", editModel.models.A.handleExtensionM, scenario);
assert.deepEqual(unchangedModel, editModel, "re-saving the same model handle is a no-op");
const epsilonModel = P.transitions.replaceModel(editModel, "A", editModel.models.A.handleExtensionM + M.FLOAT_EPSILON, scenario);
assert.deepEqual(epsilonModel, editModel, "a model handle change within epsilon is a no-op");
const changedModel = P.transitions.replaceModel(editModel, "A", editModel.models.A.handleExtensionM + 0.001, scenario);
assert.equal(changedModel.fromReview, false, "a semantic model change leaves review continuation");
assert.ok(changedModel.predictions.every((item) => item === null), "a semantic model change clears predictions");
assert.equal(changedModel.design, null, "a semantic model change clears design");
const returnedReview = P.transitions.setPhase(editModel, "review", scenario);
assert.equal(returnedReview.phase, "review");
assert.equal(returnedReview.fromReview, false);

const navigationModel = P.transitions.setPhase(state, "model", scenario);
assert.equal(navigationModel.phase, "model");
assert.equal(navigationModel.fromReview, true, "returning to an earlier phase keeps downstream answers as a review continuation");
assert.ok(navigationModel.predictions.every(Boolean));
assert.ok(navigationModel.design);
const navigationPredict = P.transitions.setPhase(navigationModel, "predict", scenario);
assert.equal(navigationPredict.phase, "predict");
assert.equal(navigationPredict.fromReview, true);
assert.ok(navigationPredict.predictions.every(Boolean));
assert.ok(navigationPredict.design);
const navigationDesign = P.transitions.setPhase(navigationPredict, "design", scenario);
assert.equal(navigationDesign.phase, "design");
assert.ok(navigationDesign.predictions.every(Boolean));
assert.deepEqual(navigationDesign.design, state.design, "returning to design preserves the active design answer");
for (const [name, fixture] of [["navigation-model", navigationModel], ["navigation-predict", navigationPredict], ["navigation-design", navigationDesign]]) {
  const snapshot = P.makeSnapshot("draft", fixture, scenario);
  assert.deepEqual(P.decodeSnapshot(snapshot, scenario, "draft"), fixture, `${name} round trip preserves navigable downstream answers`);
}

const recalibrated = P.transitions.replaceCalibration(editModel, "A", evidence(scenario.springs.A.naturalLengthM + 0.001), scenario);
assert.equal(recalibrated.fromReview, false);
assert.ok(recalibrated.measurements.A.F1 === null && recalibrated.models.A === null);
assert.ok(recalibrated.predictions.every((item) => item === null));
assert.equal(recalibrated.measurements.B.F1.loadKey, "F1");
assert.equal(recalibrated.models.B !== null, true);

const editMeasurement = P.transitions.editSection(review, "investigate", scenario);
const remeasured = P.transitions.replaceMeasurement(editMeasurement, "B", "F2", measurement(scenario, "B", "F2"), scenario);
assert.equal(remeasured.models.B, null);
assert.equal(remeasured.models.A !== null, true);
assert.ok(remeasured.predictions.every((item) => item === null));
assert.equal(remeasured.design, null);

const editPrediction = P.transitions.editSection(review, "predict", scenario);
const replacementPrediction = P.transitions.replacePrediction(editPrediction, 0, 0.04, scenario);
assert.equal(replacementPrediction.phase, "predict");
assert.equal(replacementPrediction.fromReview, true, "editing a prediction from review preserves the review continuation");
assert.equal(replacementPrediction.design.springKey, review.design.springKey);
assert.equal(replacementPrediction.design.moduleCount, review.design.moduleCount);

const editedDesign = P.transitions.editSection(review, "design", scenario);
const changedDesign = P.transitions.replaceDesign(editedDesign, review.design.springKey === "A" ? "B" : "A", 1, scenario);
assert.equal(changedDesign.phase, "design");
assert.equal(changedDesign.fromReview, false);

function invalid(answer, reason) {
  const result = P.validateAnswer(answer, scenario, { kind: answer.phase === "review" ? "review" : "draft" });
  assert.equal(result.ok, false, reason);
}

const badNaN = P.clone(initial); badNaN.working.zeroDraftM = NaN; invalid(badNaN, "NaN rejected");
const badEnum = P.clone(initial); badEnum.activeSpring = "C"; invalid(badEnum, "spring enum rejected");
const badMeasurementBeforeCalibration = P.clone(initial); badMeasurementBeforeCalibration.measurements.A.F1 = measurement(scenario, "A", "F1"); invalid(badMeasurementBeforeCalibration, "measurement prerequisite rejected");
const badModelEarly = P.clone(initial); badModelEarly.phase = "model"; badModelEarly.models.A = { handleExtensionM: 0.1 }; invalid(badModelEarly, "model prerequisite rejected");
const badPredictionEarly = P.clone(initial); badPredictionEarly.phase = "predict"; badPredictionEarly.predictions[0] = { extensionM: 0.04 }; invalid(badPredictionEarly, "prediction prerequisite rejected");
const badDesignEarly = P.clone(initial); badDesignEarly.phase = "design"; badDesignEarly.design = { springKey: "A", moduleCount: 1 }; invalid(badDesignEarly, "design prerequisite rejected");
const badCursor = P.clone(state); badCursor.measurements.A.F1.cursorM = badCursor.calibrations.A.zeroM - 0.001; invalid(badCursor, "cursor below zero rejected");
const badFuture = P.clone(state); badFuture.phase = "model"; badFuture.predictions[0] = { extensionM: 0.04 }; invalid(badFuture, "future prediction rejected");
const badReview = P.clone(state); badReview.phase = "review"; badReview.working = { zeroDraftM: null, cursorDraftM: null }; badReview.design = null; invalid(badReview, "incomplete review rejected");
const badCount = P.clone(state); badCount.design = { springKey: "A", moduleCount: 0 }; invalid(badCount, "invalid module count rejected");
const badKeys = P.clone(initial); badKeys.working.extra = 1; invalid(badKeys, "unknown keys rejected");
const badActive = P.clone(initial); badActive.phase = "model"; badActive.activeLoadKey = "F1"; invalid(badActive, "active load outside investigation context rejected");
const staleReview = P.clone(review); staleReview.phase = "model"; staleReview.fromReview = false; invalid(staleReview, "stale downstream data rejected");

assert.throws(() => P.decodeSnapshot({ version: 1, activity: P.ACTIVITY, kind: "draft", answer: badNaN }, scenario, "draft"));

console.log("Hooke's law persistence checks passed");
