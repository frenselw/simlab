(function (root, factory) {
  const api = factory(root?.HookesLawModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HookesLawScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";

  const ZERO_FULL_ERROR_M = 0.002;
  const ZERO_PARTIAL_ERROR_M = 0.004;
  const CURSOR_FULL_ERROR_M = 0.0025;
  const CURSOR_PARTIAL_ERROR_M = 0.005;
  const MODEL_FULL_REL = 0.05;
  const MODEL_GOOD_REL = 0.10;
  const MODEL_PARTIAL_REL = 0.20;
  const PREDICT_FULL_ABS_M = 0.003;
  const PREDICT_GOOD_ABS_M = 0.006;
  const PREDICT_PARTIAL_ABS_M = 0.012;
  const FLOAT_EPSILON = 1e-9;
  const SCORE_MIN = 0;
  const SCORE_MAX = 100;
  const PASSING_THRESHOLD = 60;
  const MASTERY_GATES = Object.freeze({ experiment: 8, model: 8, prediction: 18, engineering: 8 });
  const FORCE_KEYS = Object.freeze(["F1", "F2", "F3"]);
  const forceByKey = Object.freeze({ F1: 1.0, F2: 2.0, F3: 3.0 });

  function finite(value) { return Number.isFinite(value); }
  function clampScore(value) { return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(value))); }
  function tier(error, full, partial, points) {
    if (!finite(error)) return 0;
    if (error <= full + FLOAT_EPSILON) return points;
    if (error <= partial + FLOAT_EPSILON) return points === 4 ? 2 : points === 2 ? 1 : 5;
    return 0;
  }
  function relativeTier(error, points) {
    if (!finite(error)) return 0;
    if (error <= MODEL_FULL_REL + FLOAT_EPSILON) return points;
    if (error <= MODEL_GOOD_REL + FLOAT_EPSILON) return points === 4 ? 3 : 9;
    if (error <= MODEL_PARTIAL_REL + FLOAT_EPSILON) return points === 4 ? 1 : 5;
    return 0;
  }
  function validMode(mode) { return mode === "pointer" || mode === "keyboard"; }
  function validEvidence(evidence, positionM, stageSpanM) {
    return Boolean(evidence && validMode(evidence.mode) && finite(evidence.moveM) &&
      evidence.moveM >= Model.MIN_OPERATION_MOVE_M - FLOAT_EPSILON && finite(positionM) &&
      positionM >= 0 && positionM <= stageSpanM + FLOAT_EPSILON);
  }
  function validCalibration(record, scenario, springKey) {
    return Boolean(record && scenario?.springs?.[springKey] && validEvidence(record, record.zeroM, scenario.stage.spanM));
  }
  function validMeasurement(record, scenario, springKey, loadKey) {
    return Boolean(record && record.loadKey === loadKey && forceByKey[loadKey] &&
      validEvidence(record, record.cursorM, scenario?.stage?.spanM) && record.cursorM >= 0);
  }
  function validModel(record, scenario) {
    return Boolean(record && finite(record.handleExtensionM) && record.handleExtensionM >= Model.MIN_EXTENSION_M &&
      record.handleExtensionM <= scenario.stage.maxLinearExtensionM + FLOAT_EPSILON &&
      finite(Model.kFromModelHandle(record.handleExtensionM)));
  }
  function validPrediction(record, scenario) {
    return Boolean(record && finite(record.extensionM) && record.extensionM >= 0 &&
      record.extensionM <= scenario.stage.maxLinearExtensionM + FLOAT_EPSILON);
  }
  function validDesign(record, scenario) {
    return Boolean(record && (record.springKey === "A" || record.springKey === "B") &&
      Number.isInteger(record.moduleCount) && record.moduleCount >= 1 && record.moduleCount <= scenario.design.maxModuleCount);
  }
  function recordsForSpring(state, springKey) {
    return FORCE_KEYS.map((loadKey) => {
      const record = state?.measurements?.[springKey]?.[loadKey];
      const measured = record ? Model.measuredExtensionM(state.calibrations[springKey]?.zeroM, record.cursorM) : null;
      return { forceN: forceByKey[loadKey], measuredExtensionM: measured };
    });
  }
  function completeEvidence(state, scenario) {
    if (!state || !scenario || !state.calibrations || !state.measurements || !state.models || !Array.isArray(state.predictions)) return false;
    if (!["A", "B"].every((key) => validCalibration(state.calibrations[key], scenario, key))) return false;
    if (!["A", "B"].every((springKey) => state.measurements[springKey] && FORCE_KEYS.every((loadKey) => validMeasurement(state.measurements[springKey][loadKey], scenario, springKey, loadKey)))) return false;
    if (!["A", "B"].every((key) => validModel(state.models[key], scenario))) return false;
    if (state.predictions.length !== 3 || !state.predictions.every((prediction) => validPrediction(prediction, scenario))) return false;
    return validDesign(state.design, scenario);
  }

  function scoreCalibration(record, spring, scenario) {
    if (!validCalibration(record, scenario, spring.key)) return { score: 0, errorM: null, valid: false };
    const errorM = Math.abs(record.zeroM - spring.naturalLengthM);
    return { score: errorM <= ZERO_FULL_ERROR_M + FLOAT_EPSILON ? 4 : errorM <= ZERO_PARTIAL_ERROR_M + FLOAT_EPSILON ? 2 : 0, errorM, valid: true };
  }

  function scoreMeasurement(record, spring, loadKey, scenario) {
    if (!validMeasurement(record, scenario, spring.key, loadKey)) return { score: 0, errorM: null, valid: false };
    const expectedM = Model.endpointM(spring.naturalLengthM, forceByKey[loadKey], spring.kNPerM);
    const errorM = Math.abs(record.cursorM - expectedM);
    return { score: errorM <= CURSOR_FULL_ERROR_M + FLOAT_EPSILON ? 2 : errorM <= CURSOR_PARTIAL_ERROR_M + FLOAT_EPSILON ? 1 : 0, errorM, valid: true, expectedM };
  }

  function scoreModel(springKey, state, scenario) {
    const spring = scenario.springs[springKey];
    const record = state.models?.[springKey];
    if (!validModel(record, scenario)) return { ownScore: 0, trueScore: 0, kModel: null, kFit: null, ownRelativeError: null, trueRelativeError: null };
    const kModel = Model.kFromModelHandle(record.handleExtensionM);
    const kFit = Model.fitKThroughOrigin(recordsForSpring(state, springKey));
    const ownRelativeError = Model.relativeError(kModel, kFit);
    const trueRelativeError = Model.relativeError(kModel, spring.kNPerM);
    return {
      ownScore: relativeTier(ownRelativeError, 4),
      trueScore: relativeTier(trueRelativeError, 4),
      kModel,
      kFit,
      ownRelativeError,
      trueRelativeError
    };
  }

  function scorePrediction(record, spec, scenario) {
    if (!validPrediction(record, scenario) || !spec || !finite(spec.forceN) || !scenario.springs[spec.springKey]) return { score: 0, errorM: null, actualM: null };
    const actualM = Model.extensionM(spec.forceN, scenario.springs[spec.springKey].kNPerM);
    const errorM = Math.abs(record.extensionM - actualM);
    const full = Math.max(PREDICT_FULL_ABS_M, 0.05 * actualM);
    const good = Math.max(PREDICT_GOOD_ABS_M, 0.10 * actualM);
    const partial = Math.max(PREDICT_PARTIAL_ABS_M, 0.20 * actualM);
    return { score: errorM <= full + FLOAT_EPSILON ? 12 : errorM <= good + FLOAT_EPSILON ? 9 : errorM <= partial + FLOAT_EPSILON ? 5 : 0, errorM, actualM, fullToleranceM: full, goodToleranceM: good, partialToleranceM: partial };
  }

  function scoreEngineering(design, scenario) {
    if (!validDesign(design, scenario)) return { score: 0, safetyPoints: 0, efficiencyPoints: 0, safe: false, forceN: null, extensionM: null, optimal: Model.optimalSafeDesign(scenario) };
    const spring = scenario.springs[design.springKey];
    const forceN = design.moduleCount * scenario.design.moduleForceN;
    const extensionM = Model.extensionM(forceN, spring.kNPerM);
    const safe = extensionM !== null && extensionM <= scenario.design.limitM + FLOAT_EPSILON;
    if (!safe) return { score: 0, safetyPoints: 0, efficiencyPoints: 0, safe: false, forceN, extensionM, optimal: Model.optimalSafeDesign(scenario) };
    const optimal = Model.optimalSafeDesign(scenario);
    const optimalSafeForceN = optimal?.forceN || 0;
    const safetyPoints = 8;
    const efficiencyPoints = Math.round(16 * Math.min(1, optimalSafeForceN > 0 ? forceN / optimalSafeForceN : 0));
    return { score: safetyPoints + efficiencyPoints, safetyPoints, efficiencyPoints, safe: true, forceN, extensionM, optimal };
  }

  function feedbackFor(state, scenario, breakdown) {
    const items = [];
    const calibration = ["A", "B"].map((key) => breakdown.calibration[key]);
    const measurementErrors = ["A", "B"].flatMap((key) => FORCE_KEYS.map((loadKey) => breakdown.measurements[key][loadKey].errorM)).filter(finite);
    const zeroLarge = calibration.some((item) => item.errorM !== null && item.errorM > ZERO_PARTIAL_ERROR_M);
    const cursorLarge = measurementErrors.some((errorM) => errorM > CURSOR_PARTIAL_ERROR_M);
    if (zeroLarge) items.push("你記錄的伸長量零位與未加負載時的彈簧末端有明顯差距。伸長量應由原長 L₀ 的零位起計。");
    else if (cursorLarge) items.push("伸長量零位合理，但部分量度游標未對準彈簧穩定後的末端。");
    else items.push("你能以伸長量零位作基準，量度不同負載下的伸長量。");

    for (const springKey of ["A", "B"]) {
      const model = breakdown.models[springKey];
      if (model.kModel === null) continue;
      if (model.ownRelativeError !== null && model.ownRelativeError <= MODEL_GOOD_REL && model.trueRelativeError > MODEL_GOOD_REL) items.push(`${springKey} 模型有配合你的數據，但整組數據可能受零位或讀尺偏差影響。`);
      else if (model.ownRelativeError === null || model.ownRelativeError > MODEL_GOOD_REL) items.push(`${springKey} 的量度點已保存，但模型直線的斜率未能代表這組數據。`);
      else items.push(`${springKey} 的通過原點直線能代表 F=kx。`);
    }
    const trueOrder = Math.sign(scenario.springs.A.kNPerM - scenario.springs.B.kNPerM);
    const modelOrder = Math.sign((breakdown.models.A.kModel || 0) - (breakdown.models.B.kModel || 0));
    if (trueOrder !== modelOrder) items.push("同一作用力下，伸長量較小的彈簧有較大的 k；它的 F–x 直線斜率較大（直線更陡）。");

    breakdown.predictions.forEach((prediction, index) => {
      items.push(`預測 ${index + 1}：你的預測伸長量 ${displayCm(prediction.predictedExtensionM)} cm；模擬中的伸長量 ${displayCm(prediction.actualM)} cm；差距 ${displayCm(prediction.errorM)} cm。`);
    });
    const engineering = breakdown.engineering;
    if (engineering.safe) {
      const optimal = engineering.optimal;
      const extra = optimal ? optimal.moduleCount - state.design.moduleCount : 0;
      items.push(`最大安全負載方案：選擇彈簧 ${state.design.springKey}、${state.design.moduleCount} 個負載塊；總作用力 ${engineering.forceN.toFixed(1)} N；模擬中的伸長量 ${displayCm(engineering.extensionM)} cm；安全伸長上限 ${displayCm(scenario.design.limitM)} cm。`);
      if (extra > 0) items.push(`方案仍可增加 ${extra} 個負載塊而不超過限制；最大安全負載方案是彈簧 ${optimal.springKey}、${optimal.moduleCount} 個負載塊。`);
      else if (optimal) items.push(`這是最大安全負載方案：彈簧 ${optimal.springKey}、${optimal.moduleCount} 個負載塊。`);
    } else items.push(`最大安全負載方案不安全：${displayCm(engineering.extensionM || 0)} cm 的伸長量超過 ${displayCm(scenario.design.limitM)} cm 限制。`);
    return items;
  }

  function displayCm(meters) { return finite(meters) ? (Math.round(meters * 1000) / 10).toFixed(1) : "--"; }

  function scoreAnswer(state, scenario) {
    const breakdown = {
      calibration: {},
      measurements: { A: {}, B: {} },
      models: {},
      predictions: [],
      engineering: null
    };
    for (const springKey of ["A", "B"]) {
      breakdown.calibration[springKey] = scoreCalibration(state?.calibrations?.[springKey], scenario.springs[springKey], scenario);
      for (const loadKey of FORCE_KEYS) breakdown.measurements[springKey][loadKey] = scoreMeasurement(state?.measurements?.[springKey]?.[loadKey], scenario.springs[springKey], loadKey, scenario);
      breakdown.models[springKey] = scoreModel(springKey, state, scenario);
    }
    breakdown.hardnessScore = completeEvidence(state, scenario) && Math.sign(breakdown.models.A.kModel - breakdown.models.B.kModel) === Math.sign(scenario.springs.A.kNPerM - scenario.springs.B.kNPerM) ? 4 : 0;
    breakdown.predictions = (scenario.predictions || []).map((spec, index) => {
      const item = scorePrediction(state?.predictions?.[index], spec, scenario);
      return { ...item, id: spec.id, springKey: spec.springKey, forceN: spec.forceN, predictedExtensionM: state?.predictions?.[index]?.extensionM ?? null };
    });
    breakdown.engineering = scoreEngineering(state?.design, scenario);
    const experimentScore = Object.values(breakdown.calibration).reduce((sum, item) => sum + item.score, 0) + ["A", "B"].reduce((sum, key) => sum + FORCE_KEYS.reduce((part, loadKey) => part + breakdown.measurements[key][loadKey].score, 0), 0);
    const modelScore = breakdown.models.A.ownScore + breakdown.models.A.trueScore + breakdown.models.B.ownScore + breakdown.models.B.trueScore + breakdown.hardnessScore;
    const predictionScore = breakdown.predictions.reduce((sum, item) => sum + item.score, 0);
    const engineeringScore = breakdown.engineering.score;
    const totalScore = clampScore(experimentScore + modelScore + predictionScore + engineeringScore);
    const passed = totalScore >= PASSING_THRESHOLD && experimentScore >= MASTERY_GATES.experiment && modelScore >= MASTERY_GATES.model && predictionScore >= MASTERY_GATES.prediction && engineeringScore >= MASTERY_GATES.engineering;
    const result = {
      score: totalScore,
      maxScore: SCORE_MAX,
      passed,
      completed: completeEvidence(state, scenario),
      breakdown: { ...breakdown, experimentScore, modelScore, predictionScore, engineeringScore },
      feedbackItems: [],
      feedback: ""
    };
    result.feedbackItems = feedbackFor(state, scenario, result.breakdown);
    result.feedback = result.feedbackItems.join(" ");
    return result;
  }

  return {
    ZERO_FULL_ERROR_M,
    ZERO_PARTIAL_ERROR_M,
    CURSOR_FULL_ERROR_M,
    CURSOR_PARTIAL_ERROR_M,
    MODEL_FULL_REL,
    MODEL_GOOD_REL,
    MODEL_PARTIAL_REL,
    PREDICT_FULL_ABS_M,
    PREDICT_GOOD_ABS_M,
    PREDICT_PARTIAL_ABS_M,
    FLOAT_EPSILON,
    SCORE_MIN,
    SCORE_MAX,
    PASSING_THRESHOLD,
    MASTERY_GATES,
    FORCE_KEYS,
    forceByKey,
    validCalibration,
    validMeasurement,
    validModel,
    validPrediction,
    validDesign,
    completeEvidence,
    recordsForSpring,
    scoreAnswer,
    scoreCalibration,
    scoreMeasurement,
    scoreModel,
    scorePrediction,
    scoreEngineering,
    displayCm
  };
});
