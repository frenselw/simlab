(function (root, factory) {
  const M = root.StaticKineticFrictionMeasurement || (typeof module === "object" && module.exports ? require("./measurement.js") : null);
  const G = root.StaticKineticFrictionGenerator || (typeof module === "object" && module.exports ? require("./generator.js") : null);
  const Graph = root.StaticKineticFrictionGraph || (typeof module === "object" && module.exports ? require("./graph.js") : null);
  const api = factory(M, G, Graph);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Measurement, Generator, Graph) {
  "use strict";

  const PASSING_SCORE = 60;
  const ZERO_FRICTION_TOLERANCE_N = 0.10;
  const BALANCE_ABS_TOLERANCE_N = 0.15;
  const BALANCE_REL_TOLERANCE = 0.05;
  const BREAKAWAY_TIME_TOLERANCE_S = 0.16;
  const FS_MAX_ABS_TOLERANCE_N = 0.20;
  const FS_MAX_REL_TOLERANCE = 0.04;
  const FK_ABS_TOLERANCE_N = 0.15;
  const FK_REL_TOLERANCE = 0.05;
  const INTERVAL_MIN_IOU = 0.70;
  const PLATFORM_COMPARISON_ABS_N = 0.25;
  const PLATFORM_COMPARISON_REL = 0.06;
  const FLOAT_EPSILON = 1e-9;
  const forceByKey = Object.freeze({});
  function finite(v) { return Number.isFinite(v); }
  function balanceToleranceN(expectedN) { return Math.max(BALANCE_ABS_TOLERANCE_N, BALANCE_REL_TOLERANCE * Math.abs(expectedN)); }
  function fsToleranceN(expectedN) { return Math.max(FS_MAX_ABS_TOLERANCE_N, FS_MAX_REL_TOLERANCE * Math.abs(expectedN)); }
  function fkToleranceN(expectedN) { return Math.max(FK_ABS_TOLERANCE_N, FK_REL_TOLERANCE * Math.abs(expectedN)); }
  function platformToleranceN(referenceN) { return Math.max(PLATFORM_COMPARISON_ABS_N, PLATFORM_COMPARISON_REL * Math.abs(referenceN)); }
  function approx(actual, expected, tolerance) { return finite(actual) && finite(expected) && Math.abs(actual - expected) <= tolerance + FLOAT_EPSILON; }
  function observationList(answer) { return answer?.balance?.observations || answer?.observations || []; }
  function answerAnalysis(answer) { return answer?.analysis || {}; }
  function balanceScore(answer, scenario) {
    const observations = observationList(answer);
    const zero = observations.find((item) => item.id === "zero-pull" || item.measuredPullCN === 0);
    const nonzero = observations.filter((item) => item.id === "static-low" || item.id === "static-high" || item.id === "static-1").sort((a, b) => a.measuredPullCN - b.measuredPullCN);
    const detail = [];
    let score = 0;
    const zeroForce = zero?.learnerForce;
    const zeroCorrect = Boolean(zero?.learnerForce?.committed && zeroForce.frictionType === "none" && zeroForce.direction === "none" && Math.abs(zeroForce.frictionMagnitudeCN / 100) <= ZERO_FRICTION_TOLERANCE_N);
    if (zeroCorrect) score += 6;
    detail.push({ key: "zero", points: zeroCorrect ? 6 : 0, max: 6, correct: zeroCorrect });
    for (let index = 0; index < 2; index += 1) {
      const observation = nonzero[index];
      const force = observation?.learnerForce;
      const expectedN = observation ? observation.measuredPullCN / 100 : NaN;
      const correct = Boolean(observation && force?.committed && force.frictionType === "static" && force.direction === "left" && approx(force.frictionMagnitudeCN / 100, expectedN, balanceToleranceN(expectedN)));
      const points = correct ? 7 : 0;
      score += points; detail.push({ key: index === 0 ? "static-low" : "static-high", points, max: 7, correct, expectedN: finite(expectedN) ? expectedN : null });
    }
    return { score, maxScore: 20, detail };
  }
  function experimentScore(answer) {
    let quality = null;
    try { if (answer?.trial) quality = Measurement.assessTrial(answer.trial); } catch { quality = null; }
    const evidence = quality?.evidence || { breakaway: false, slow: false, acceleration: false, fast: false };
    const detail = [
      { key: "breakaway", points: evidence.breakaway ? 6 : 0, max: 6, correct: Boolean(evidence.breakaway) },
      { key: "slow", points: evidence.slow ? 5 : 0, max: 5, correct: Boolean(evidence.slow) },
      { key: "acceleration", points: evidence.acceleration ? 4 : 0, max: 4, correct: Boolean(evidence.acceleration) },
      { key: "fast", points: evidence.fast ? 5 : 0, max: 5, correct: Boolean(evidence.fast) }
    ];
    const valid = Boolean(quality?.valid);
    // Part B is a gate: an incomplete/invalid trace cannot contribute partial
    // evidence points that would make an unanalysable experiment scoreable.
    return { score: valid ? 20 : 0, maxScore: 20, valid, quality, detail: valid ? detail : detail.map((item) => ({ ...item, points: 0, correct: false })) };
  }
  function selectionScore(trace, selection, candidates, kind = null, allCandidates = null) {
    if (!selection || !Number.isInteger(selection.startIndex) || !Number.isInteger(selection.endIndex)) return { valid: false, iou: 0, stats: null };
    const stats = Measurement.intervalStats(trace, selection.startIndex, selection.endIndex);
    const iou = Graph.bestCandidateIoU(selection, candidates || [], trace);
    const predicates = {
      static: (value) => Measurement.isStaticRise(value),
      slow: (value) => Measurement.isVelocityPlateau(value),
      fast: (value) => Measurement.isVelocityPlateau(value),
      acceleration: (value) => Measurement.isAccelerationWindow(value)
    };
    const own = predicates[kind] ? predicates[kind](stats) : Boolean(stats);
    const groups = allCandidates || {};
    const otherIntervals = Object.entries(groups).filter(([key]) => key !== kind).flatMap(([, list]) => list || []);
    const otherFraction = kind ? Measurement.otherPhaseFraction(selection, otherIntervals, trace, kind) : 0;
    const valid = Boolean(stats && own && iou >= INTERVAL_MIN_IOU && otherFraction <= Measurement.MAX_OTHER_PHASE_FRACTION + FLOAT_EPSILON);
    return { valid, iou, stats, own, otherPhaseFraction: otherFraction };
  }
  function analysisScore(answer, scenario) {
    const analysis = answerAnalysis(answer);
    let decoded;
    try { decoded = answer?.trial ? Measurement.unpackTrace(answer.trial) : null; } catch { decoded = null; }
    if (!decoded) return { score: 0, maxScore: 40, detail: [] };
    const candidates = Measurement.findCandidateWindows(decoded);
    const detail = [];
    let score = 0;
    const c1 = selectionScore(decoded, analysis.staticInterval, candidates.static, "static", candidates);
    const c1Concept = c1.valid;
    const c1Answer = analysis.staticInterval?.frictionType === "static" && analysis.staticInterval?.relation === "equal";
    const c1Points = (c1Concept ? 3 : 0) + (c1Answer ? 4 : 0); score += c1Points; detail.push({ key: "static-rise", points: c1Points, max: 7, correct: c1Concept && c1Answer, iou: c1.iou });
    const eventTimeS = decoded.breakaway ? decoded.breakaway.timeMs / 1000 : NaN;
    const markerTimeS = decoded.merged[analysis.breakaway?.markerIndex]?.timeS;
    const markerCorrect = approx(markerTimeS, eventTimeS, BREAKAWAY_TIME_TOLERANCE_S);
    const visiblePeakN = decoded.visibleBreakawayPeakCN == null ? NaN : decoded.visibleBreakawayPeakCN / 100;
    const fsEstimateN = Number(analysis.breakaway?.estimatedFsMaxCN) / 100;
    const fsCorrect = approx(fsEstimateN, visiblePeakN, fsToleranceN(visiblePeakN));
    const fsLabel = analysis.breakaway?.identifiedAs === "maximum-static-friction";
    const c2Points = (markerCorrect ? 4 : 0) + (fsCorrect ? 3 : 0) + (fsLabel ? 2 : 0); score += c2Points; detail.push({ key: "breakaway", points: c2Points, max: 9, correct: markerCorrect && fsCorrect && fsLabel });
    const c3 = selectionScore(decoded, analysis.slowPlateau, candidates.slow, "slow", candidates);
    const fkSlow = Number(analysis.slowPlateau?.estimatedFkCN) / 100;
    const c3Concept = c3.valid && approx(fkSlow, c3.stats.meanPullN, fkToleranceN(c3.stats.meanPullN));
    const c3Points = (c3.valid ? 4 : 0) + (c3Concept ? 4 : 0); score += c3Points; detail.push({ key: "slow", points: c3Points, max: 8, correct: c3Concept, iou: c3.iou });
    const c4 = selectionScore(decoded, analysis.acceleration, candidates.acceleration, "acceleration", candidates);
    const c4Concept = c4.valid && analysis.acceleration?.relation === "pull-greater";
    const c4NoEquals = analysis.acceleration?.pullEqualsFk === "no";
    const c4Points = (c4.valid ? 3 : 0) + (c4Concept ? 2 : 0) + (c4NoEquals ? 2 : 0); score += c4Points; detail.push({ key: "acceleration", points: c4Points, max: 7, correct: c4Concept && c4NoEquals, iou: c4.iou });
    const c5 = selectionScore(decoded, analysis.fastPlateau, candidates.fast, "fast", candidates);
    const fkFast = Number(analysis.fastPlateau?.estimatedFkCN) / 100;
    const c5Estimate = c5.valid && approx(fkFast, c5.stats.meanPullN, fkToleranceN(c5.stats.meanPullN));
    const slowMean = c3.stats?.meanPullN;
    const comparison = c5.valid && finite(slowMean) && finite(c5.stats.meanPullN) && Math.abs(slowMean - c5.stats.meanPullN) <= platformToleranceN(slowMean) && analysis.fastPlateau?.speedComparison === "same-average";
    const c5Points = (c5.valid ? 4 : 0) + (c5Estimate ? 3 : 0) + (comparison ? 2 : 0); score += c5Points; detail.push({ key: "fast", points: c5Points, max: 9, correct: c5Estimate && comparison, iou: c5.iou });
    return { score, maxScore: 40, detail, candidates, decoded };
  }
  function predictionScore(answer, scenario) {
    const answers = answer?.predictions || [];
    const detail = [];
    let score = 0;
    for (const spec of scenario.predictions || []) {
      const response = answers.find((item) => item?.scenarioId === spec.scenarioId) || answers.find((item) => item?.id === spec.id);
      const type = Boolean(response?.committed && response.frictionType === spec.frictionType);
      const direction = Boolean(type && response.direction === spec.direction);
      const expectedTolerance = spec.frictionType === "static" ? balanceToleranceN(spec.magnitudeN) : spec.frictionType === "kinetic" ? fkToleranceN(spec.magnitudeN) : ZERO_FRICTION_TOLERANCE_N;
      const magnitude = Boolean(direction && approx(Number(response?.magnitudeCN) / 100, spec.magnitudeN, expectedTolerance));
      const outcome = Boolean(response?.committed && response.motionOutcome === spec.motionOutcome);
      const points = (type ? 1 : 0) + (direction ? 1 : 0) + (magnitude ? 2 : 0) + (outcome ? 1 : 0);
      score += points; detail.push({ key: spec.scenarioId, points, max: 5, correct: points === 5, type, direction, magnitude, outcome });
    }
    return { score, maxScore: 20, detail };
  }
  function scoreAnswer(answer, scenario) {
    const balance = balanceScore(answer, scenario);
    const experiment = experimentScore(answer);
    const analysis = analysisScore(answer, scenario);
    const predictions = predictionScore(answer, scenario);
    const score = Math.max(0, Math.min(100, balance.score + experiment.score + analysis.score + predictions.score));
    const passed = score >= PASSING_SCORE && balance.score >= 10 && analysis.score >= 20 && predictions.score >= 8;
    const feedbackItems = [];
    if (balance.detail.find((item) => item.key === "zero" && !item.correct)) feedbackItems.push("沒有水平外力時，應由力平衡判斷水平摩擦力是否存在。");
    if (analysis.detail.find((item) => item.key === "acceleration" && !item.correct)) feedbackItems.push("加速區段的測力計讀數還包括令物體加速的合力，不能直接當作滑動摩擦力。");
    if (analysis.detail.find((item) => item.key === "fast" && !item.correct)) feedbackItems.push("兩段近似勻速區段可用平均拉力估計滑動摩擦力；細微波動不代表平均值隨速度改變。");
    return { score, maxScore: 100, passed, completed: Boolean(answer), breakdown: { balance, experiment, analysis, predictions }, feedbackItems };
  }
  function perfectAnswer(scenario, trial) {
    const decoded = Measurement.unpackTrace(trial);
    const candidates = Measurement.findCandidateWindows(decoded);
    const choose = (list, kind) => {
      if (!list?.length) return { startIndex: 0, endIndex: 1 };
      const ranked = list.slice().sort((a, b) => {
        const aOther = Measurement.otherPhaseFraction(a, [{}], decoded, kind);
        const bOther = Measurement.otherPhaseFraction(b, [{}], decoded, kind);
        return aOther - bOther || (b.stats?.durationS || 0) - (a.stats?.durationS || 0) || a.startIndex - b.startIndex;
      });
      return { startIndex: ranked[0].startIndex, endIndex: ranked[0].endIndex };
    };
    const slow = candidates.slow[0];
    const fast = candidates.fast[0];
    const slowMeanCN = Math.round((slow?.stats.meanPullN || scenario.kineticFrictionMeanN) * 100);
    const fastMeanCN = Math.round((fast?.stats.meanPullN || scenario.kineticFrictionMeanN) * 100);
    const observations = [
      { id: "zero-pull", measuredPullCN: 0, measuredVelocityMMps: 0, learnerForce: { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, committed: true, operationDeltaCN: 0 } },
      { id: "static-low", measuredPullCN: Math.round(scenario.staticLimitMeanN * 0.35 * 100), measuredVelocityMMps: 0, learnerForce: { frictionType: "static", direction: "left", frictionMagnitudeCN: Math.round(scenario.staticLimitMeanN * 0.35 * 100), committed: true, operationDeltaCN: 0 } },
      { id: "static-high", measuredPullCN: Math.round(scenario.staticLimitMeanN * 0.55 * 100), measuredVelocityMMps: 0, learnerForce: { frictionType: "static", direction: "left", frictionMagnitudeCN: Math.round(scenario.staticLimitMeanN * 0.55 * 100), committed: true, operationDeltaCN: 0 } }
    ];
    return {
      schemaVersion: 1, generatorVersion: 1, physicsVersion: 1, measurementVersion: 1, rubricVersion: 1, seed: scenario.seed, phase: "review", variant: "complete", fromReview: false,
      balance: { tared: true, tareCorrectionCN: 0, observations }, trial,
      analysis: { staticInterval: { ...choose(candidates.static, "static"), frictionType: "static", relation: "equal" }, breakaway: { markerIndex: decoded.breakaway ? decoded.merged.findIndex((s) => s.kind === "breakaway") : 0, estimatedFsMaxCN: decoded.visibleBreakawayPeakCN || 0, identifiedAs: "maximum-static-friction" }, slowPlateau: { ...choose(candidates.slow, "slow"), estimatedFkCN: slowMeanCN }, acceleration: { ...choose(candidates.acceleration, "acceleration"), relation: "pull-greater", pullEqualsFk: "no" }, fastPlateau: { ...choose(candidates.fast, "fast"), estimatedFkCN: fastMeanCN, speedComparison: "same-average" } },
      predictions: scenario.predictions.map((spec) => ({ id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: spec.direction, magnitudeCN: spec.magnitudeCN, motionOutcome: spec.motionOutcome, committed: true }))
    };
  }
  return Object.freeze({ PASSING_SCORE, ZERO_FRICTION_TOLERANCE_N, BALANCE_ABS_TOLERANCE_N, BALANCE_REL_TOLERANCE, BREAKAWAY_TIME_TOLERANCE_S, FS_MAX_ABS_TOLERANCE_N, FS_MAX_REL_TOLERANCE, FK_ABS_TOLERANCE_N, FK_REL_TOLERANCE, INTERVAL_MIN_IOU, PLATFORM_COMPARISON_ABS_N, PLATFORM_COMPARISON_REL, FLOAT_EPSILON, forceByKey, balanceToleranceN, fsToleranceN, fkToleranceN, platformToleranceN, approx, balanceScore, experimentScore, selectionScore, analysisScore, predictionScore, scoreAnswer, perfectAnswer });
});
