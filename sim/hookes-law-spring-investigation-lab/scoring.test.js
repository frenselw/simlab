"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");
const S = require("./scoring.js");

function completeState(scenario) {
  const state = {
    calibrations: { A: null, B: null },
    measurements: { A: { F1: null, F2: null, F3: null }, B: { F1: null, F2: null, F3: null } },
    models: { A: null, B: null },
    predictions: [null, null, null],
    design: null
  };
  for (const springKey of ["A", "B"]) {
    const spring = scenario.springs[springKey];
    state.calibrations[springKey] = { zeroM: spring.naturalLengthM, mode: "pointer", moveM: 0.01 };
    for (const [index, loadKey] of ["F1", "F2", "F3"].entries()) {
      const forceN = [1, 2, 3][index];
      state.measurements[springKey][loadKey] = { loadKey, cursorM: M.endpointM(spring.naturalLengthM, forceN, spring.kNPerM), mode: "pointer", moveM: 0.01 };
    }
    state.models[springKey] = { handleExtensionM: S.forceByKey.F1 / 1 + (2.5 / spring.kNPerM - 0.05) };
    state.models[springKey].handleExtensionM = 2.5 / spring.kNPerM;
  }
  state.predictions = scenario.predictions.map((spec) => ({ extensionM: M.extensionM(spec.forceN, scenario.springs[spec.springKey].kNPerM) }));
  state.design = { springKey: M.optimalSafeDesign(scenario).springKey, moduleCount: M.optimalSafeDesign(scenario).moduleCount };
  return state;
}

const scenario = G.generateScenario({ seed: 17 });
const perfect = completeState(scenario);
const result = S.scoreAnswer(perfect, scenario);
assert.equal(result.score, 100);
assert.equal(result.maxScore, 100);
assert.equal(result.passed, true);
assert.equal(result.completed, true);
assert.deepEqual({ experiment: result.breakdown.experimentScore, model: result.breakdown.modelScore, prediction: result.breakdown.predictionScore, engineering: result.breakdown.engineeringScore }, { experiment: 20, model: 20, prediction: 36, engineering: 24 });
assert.ok(result.feedbackItems.length >= 5);

const calibrationBorder = completeState(scenario);
calibrationBorder.calibrations.A.zeroM = scenario.springs.A.naturalLengthM + S.ZERO_FULL_ERROR_M;
assert.equal(S.scoreCalibration(calibrationBorder.calibrations.A, scenario.springs.A, scenario).score, 4);
calibrationBorder.calibrations.A.zeroM = scenario.springs.A.naturalLengthM + S.ZERO_FULL_ERROR_M + 0.0000001;
assert.equal(S.scoreCalibration(calibrationBorder.calibrations.A, scenario.springs.A, scenario).score, 2);
calibrationBorder.calibrations.A.zeroM = scenario.springs.A.naturalLengthM + S.ZERO_PARTIAL_ERROR_M;
assert.equal(S.scoreCalibration(calibrationBorder.calibrations.A, scenario.springs.A, scenario).score, 2);
calibrationBorder.calibrations.A.zeroM = scenario.springs.A.naturalLengthM + S.ZERO_PARTIAL_ERROR_M + 0.0000001;
assert.equal(S.scoreCalibration(calibrationBorder.calibrations.A, scenario.springs.A, scenario).score, 0);

const cursor = completeState(scenario);
const expectedA1 = M.endpointM(scenario.springs.A.naturalLengthM, 1, scenario.springs.A.kNPerM);
cursor.measurements.A.F1.cursorM = expectedA1 + S.CURSOR_FULL_ERROR_M;
assert.equal(S.scoreMeasurement(cursor.measurements.A.F1, scenario.springs.A, "F1", scenario).score, 2);
cursor.measurements.A.F1.cursorM = expectedA1 + S.CURSOR_FULL_ERROR_M + 0.0000001;
assert.equal(S.scoreMeasurement(cursor.measurements.A.F1, scenario.springs.A, "F1", scenario).score, 1);
cursor.measurements.A.F1.cursorM = expectedA1 + S.CURSOR_PARTIAL_ERROR_M + 0.0000001;
assert.equal(S.scoreMeasurement(cursor.measurements.A.F1, scenario.springs.A, "F1", scenario).score, 0);

const prediction = completeState(scenario);
const spec = scenario.predictions[0];
const actual = M.extensionM(spec.forceN, scenario.springs[spec.springKey].kNPerM);
const fullTolerance = Math.max(S.PREDICT_FULL_ABS_M, 0.05 * actual);
prediction.predictions[0].extensionM = actual + fullTolerance;
assert.equal(S.scorePrediction(prediction.predictions[0], spec, scenario).score, 12);
prediction.predictions[0].extensionM = actual + fullTolerance + 0.0000001;
assert.equal(S.scorePrediction(prediction.predictions[0], spec, scenario).score, 9);

const unsafe = completeState(scenario);
const optimal = M.optimalSafeDesign(scenario);
unsafe.design.moduleCount = optimal.moduleCount + 1;
unsafe.design.springKey = optimal.springKey;
assert.equal(S.scoreEngineering(unsafe.design, scenario).score, 0);
assert.equal(S.scoreEngineering({ springKey: optimal.springKey, moduleCount: optimal.moduleCount }, scenario).score, 24);
assert.equal(S.scoreAnswer({ ...perfect, predictions: [null, null, null], design: null }, scenario).score >= 0, true);

const crossSpringScenario = G.generateScenario({ seed: 60 });
const crossSpringState = completeState(crossSpringScenario);
assert.equal(S.sameSpringMaximumDesign(crossSpringScenario, "A").moduleCount, 3);
assert.equal(S.sameSpringMaximumDesign(crossSpringScenario, "B").moduleCount, 7);

crossSpringState.design = { springKey: "A", moduleCount: 3 };
const safeLowerChoice = S.scoreAnswer(crossSpringState, crossSpringScenario);
assert.match(safeLowerChoice.feedback, /你選擇的負載方案：彈簧 A、3 個負載塊/);
assert.match(safeLowerChoice.feedback, /彈簧 A 已不能再安全增加負載塊/);
assert.match(safeLowerChoice.feedback, /整體最大安全負載方案需要改用彈簧 B、7 個負載塊/);
assert.doesNotMatch(safeLowerChoice.feedback, /最多仍可增加/);

crossSpringState.design = { springKey: "B", moduleCount: 3 };
const sameSpringHeadroom = S.scoreAnswer(crossSpringState, crossSpringScenario);
assert.match(sameSpringHeadroom.feedback, /如保持使用彈簧 B，最多仍可增加 4 個負載塊/);
assert.match(sameSpringHeadroom.feedback, /模擬設定下的最大安全負載方案是彈簧 B、7 個負載塊/);

crossSpringState.design = { springKey: "A", moduleCount: 7 };
const unsafeChoice = S.scoreAnswer(crossSpringState, crossSpringScenario);
assert.match(unsafeChoice.feedback, /你選擇的負載方案不安全/);
assert.doesNotMatch(unsafeChoice.feedback, /整體最大安全負載方案需要改用/);

crossSpringState.design = { springKey: "B", moduleCount: 7 };
const exactOptimalChoice = S.scoreAnswer(crossSpringState, crossSpringScenario);
assert.match(exactOptimalChoice.feedback, /你選擇的方案已是模擬設定下的最大安全負載方案/);

console.log("Hooke's law scoring checks passed");
