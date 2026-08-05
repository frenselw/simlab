"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");
const S = require("./scoring.js");
const P = require("./persistence.js");
const App = require("./main.js");
const Flow = require("../shared/activity-flow.js");

function completed(seed = 41) {
  const scenario = G.generateScenario({ seed });
  let state = P.freshState(seed);
  for (const springKey of P.SPRINGS) {
    const spring = scenario.springs[springKey];
    state = P.transitions.replaceCalibration(state, springKey, { zeroM: spring.naturalLengthM, mode: "keyboard", moveM: .01 }, scenario);
    for (const loadKey of P.LOAD_KEYS) state = P.transitions.replaceMeasurement(state, springKey, loadKey, {
      loadKey,
      cursorM: M.endpointM(spring.naturalLengthM, S.forceByKey[loadKey], spring.kNPerM),
      mode: "keyboard",
      moveM: .01
    }, scenario);
  }
  state = P.transitions.replaceModel(state, "A", 2.5 / scenario.springs.A.kNPerM, scenario);
  state = P.transitions.replaceModel(state, "B", 2.5 / scenario.springs.B.kNPerM, scenario);
  state = P.transitions.setPhase(state, "predict", scenario);
  for (const [index, prediction] of scenario.predictions.entries()) state = P.transitions.replacePrediction(state, index, prediction.trueExtensionM, scenario);
  state = P.transitions.setPhase(state, "design", scenario);
  const design = M.optimalSafeDesign(scenario);
  state = P.transitions.replaceDesign(state, design.springKey, design.moduleCount, scenario);
  return { scenario, state, review: P.transitions.setPhase(state, "review", scenario) };
}

for (const startup of ["review", "editable", "frozen", "load-error"]) {
  const attempt = startup === "review" ? { state: "finished" } : startup === "editable" ? { state: "draft" } : startup === "frozen" ? { state: "pending-final" } : { state: "read-error" };
  assert.equal(App.routeStartup(attempt, Flow), startup === "load-error" ? "load-error" : startup === "review" ? "review" : startup === "editable" ? "editable" : "frozen");
}

const fixture = completed();
const editable = App.buildEditableViewModel(fixture.state, fixture.scenario);
assert.equal(Object.hasOwn(editable, "trueSprings"), false, "editable view model has no truth projection");
assert.equal(JSON.stringify(editable).includes("naturalLengthM"), false, "editable view model has no natural length truth");
assert.equal(JSON.stringify(editable).includes("trueExtensionM"), false, "editable view model has no true endpoints");
const result = S.scoreAnswer(fixture.review, fixture.scenario);
const revealed = App.buildResultViewModel(fixture.review, fixture.scenario, result);
assert.equal(revealed.trueSprings.A.kNPerM, fixture.scenario.springs.A.kNPerM);
assert.equal(revealed.score, result.score);
assert.equal(App.mayRevealCorrectness("editable"), false);
assert.equal(App.mayRevealCorrectness("frozen"), false);
assert.equal(App.mayRevealCorrectness("submitted-success"), true);
assert.equal(App.mayRevealCorrectness("submitted-committed"), true);
assert.equal(App.mayRevealCorrectness("trusted-finished-review"), true);

const reviewSnapshot = { version: 1, activity: App.ACTIVITY, kind: "review", answer: fixture.review, score: result.score, passed: result.passed };
assert.equal(P.decodeSnapshot(reviewSnapshot, fixture.scenario, "review").phase, "review");
assert.equal(S.scoreAnswer(P.decodeSnapshot(reviewSnapshot, fixture.scenario, "review"), fixture.scenario).score, result.score, "review restore rescoring is stable");
for (const activityState of ["success", "committed", "frozen", "retry"]) {
  let called = "";
  const outcome = { activityState, retryable: true };
  App.routeSubmission(outcome, Flow, {
    success: () => { called = "success"; },
    committed: () => { called = "committed"; },
    frozen: () => { called = "frozen"; },
    retry: () => { called = "retry"; }
  });
  assert.equal(called, activityState);
}

console.log("Hooke's law lifecycle checks passed");
