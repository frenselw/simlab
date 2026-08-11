(function (root, factory) {
  const M = root.StaticKineticFrictionMeasurement || (typeof module === "object" && module.exports ? require("./measurement.js") : null);
  const G = root.StaticKineticFrictionGenerator || (typeof module === "object" && module.exports ? require("./generator.js") : null);
  const Graph = root.StaticKineticFrictionGraph || (typeof module === "object" && module.exports ? require("./graph.js") : null);
  const api = factory(M, G, Graph);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Measurement, Generator, Graph) {
  "use strict";

  const RUBRIC_VERSION = Generator.RUBRIC_VERSION;
  const PASSING_SCORE = 60;
  const ZERO_FRICTION_TOLERANCE_N = 0.10;
  const BALANCE_ABS_TOLERANCE_N = 0.15;
  const BALANCE_REL_TOLERANCE = 0.05;
  const MAX_STATIC_BALANCE_ABS_TOLERANCE_N = 0.30;
  const MAX_STATIC_BALANCE_REL_TOLERANCE = 0.05;
  const BREAKAWAY_TIME_TOLERANCE_S = 0.16;
  const KINETIC_MARKER_SETTLE_S = 0.25;
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
  function integer(v) { return Number.isInteger(v); }
  function balanceToleranceN(expectedN) { return Math.max(BALANCE_ABS_TOLERANCE_N, BALANCE_REL_TOLERANCE * Math.abs(expectedN)); }
  function maximumStaticBalanceToleranceN(expectedN) { return Math.max(MAX_STATIC_BALANCE_ABS_TOLERANCE_N, MAX_STATIC_BALANCE_REL_TOLERANCE * Math.abs(expectedN)); }
  function fsToleranceN(expectedN) { return Math.max(FS_MAX_ABS_TOLERANCE_N, FS_MAX_REL_TOLERANCE * Math.abs(expectedN)); }
  function fkToleranceN(expectedN) { return Math.max(FK_ABS_TOLERANCE_N, FK_REL_TOLERANCE * Math.abs(expectedN)); }
  function platformToleranceN(referenceN) { return Math.max(PLATFORM_COMPARISON_ABS_N, PLATFORM_COMPARISON_REL * Math.abs(referenceN)); }
  function approx(actual, expected, tolerance) { return finite(actual) && finite(expected) && Math.abs(actual - expected) <= tolerance + FLOAT_EPSILON; }
  function answerAnalysis(answer) { return answer?.analysis || {}; }
  function balanceScore(answer, scenario) {
    const balance = answer?.balance || {};
    const detail = [];
    let score = 0;
    const zero = balance.zeroForce;
    const zeroType = Boolean(zero?.committed && zero.frictionType === "none");
    const zeroDirection = Boolean(zero?.committed && zero.direction === "none");
    const zeroMagnitude = Boolean(zero?.committed && approx((zero.frictionMagnitudeCN || 0) / 100, 0, ZERO_FRICTION_TOLERANCE_N));
    const zeroPoints = (zeroType ? 1 : 0) + (zeroDirection ? 1 : 0) + (zeroMagnitude ? 2 : 0);
    score += zeroPoints; detail.push({ key: "zero-force", points: zeroPoints, max: 4, correct: zeroType && zeroDirection && zeroMagnitude, type: zeroType, direction: zeroDirection, magnitude: zeroMagnitude, expectedN: 0 });

    const staticCase = balance.staticCase;
    const appliedForce = staticCase?.learnerAppliedForce;
    const staticForce = staticCase?.learnerForce;
    const expectedStaticN = Number(scenario?.balancePullN ?? scenario?.staticLimitMeanN * 0.3);
    const appliedDirection = Boolean(appliedForce?.committed && appliedForce.direction === scenario?.balancePullDirection);
    const appliedMagnitude = Boolean(appliedForce?.committed && approx(appliedForce.magnitudeCN / 100, expectedStaticN, balanceToleranceN(expectedStaticN)));
    const expectedStaticDirection = scenario?.balancePullDirection === "left" ? "right" : "left";
    const staticType = Boolean(staticForce?.committed && staticForce.frictionType === "static");
    const staticDirection = Boolean(staticForce?.committed && staticForce.direction === expectedStaticDirection);
    const staticMagnitude = Boolean(staticForce?.committed && approx(staticForce.frictionMagnitudeCN / 100, expectedStaticN, balanceToleranceN(expectedStaticN)));
    const staticPoints = (appliedDirection ? 1 : 0) + (appliedMagnitude ? 2 : 0) + (staticType ? 1 : 0) + (staticDirection ? 1 : 0) + (staticMagnitude ? 1 : 0);
    score += staticPoints; detail.push({ key: "static-case", points: staticPoints, max: 6, correct: appliedDirection && appliedMagnitude && staticType && staticDirection && staticMagnitude, appliedDirection, appliedMagnitude, type: staticType, direction: staticDirection, magnitude: staticMagnitude, expectedN: finite(expectedStaticN) ? expectedStaticN : null });

    const breakaway = balance.breakaway;
    const maximumStatic = Boolean(breakaway?.committed && integer(breakaway.learnerMaxCN) && approx(breakaway.learnerMaxCN / 100, scenario?.staticLimitMeanN, maximumStaticBalanceToleranceN(scenario?.staticLimitMeanN)));
    const breakawayPoints = maximumStatic ? 10 : 0;
    score += breakawayPoints; detail.push({ key: "maximum-static-friction", points: breakawayPoints, max: 10, correct: maximumStatic, expectedN: finite(scenario?.staticLimitMeanN) ? scenario.staticLimitMeanN : null, toleranceN: finite(scenario?.staticLimitMeanN) ? maximumStaticBalanceToleranceN(scenario.staticLimitMeanN) : null, observedN: integer(breakaway?.bestPullCN) ? breakaway.bestPullCN / 100 : null });
    return { score, maxScore: 20, detail };
  }
  function experimentScore(answer) {
    let quality = null;
    try { if (answer?.trial) quality = Measurement.assessTrial(answer.trial); } catch { quality = null; }
    const evidence = quality?.evidence || { breakaway: false, slow: false };
    const detail = [
      { key: "breakaway", points: evidence.breakaway ? 10 : 0, max: 10, correct: Boolean(evidence.breakaway) },
      { key: "continued-motion", points: evidence.slow ? 10 : 0, max: 10, correct: Boolean(evidence.slow) }
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
  function pointInWindows(index, windows = []) {
    return integer(index) && windows.some((window) => integer(window?.startIndex) && integer(window?.endIndex) && index >= window.startIndex && index <= window.endIndex);
  }
  function postBreakawayKineticMarker(index, decoded) {
    if (!integer(index) || !decoded?.breakaway || !Array.isArray(decoded.merged)) return false;
    const sample = decoded.merged[index];
    const breakawayTimeS = decoded.breakaway.timeMs / 1000;
    return Boolean(sample && finite(breakawayTimeS) && sample.timeS >= breakawayTimeS + KINETIC_MARKER_SETTLE_S - FLOAT_EPSILON);
  }
  function analysisScore(answer, scenario) {
    const analysis = answerAnalysis(answer);
    let decoded;
    try { decoded = answer?.trial ? Measurement.unpackTrace(answer.trial) : null; } catch { decoded = null; }
    if (!decoded) return { score: 0, maxScore: 40, detail: [] };
    const candidates = Measurement.findCandidateWindows(decoded);
    const detail = [];
    let score = 0;
    const staticIndex = analysis.staticFriction?.committed === true ? analysis.staticFriction.index : null;
    const staticCorrect = pointInWindows(staticIndex, candidates.static);
    const staticPoints = staticCorrect ? 13 : 0;
    score += staticPoints;
    detail.push({ key: "static-friction", points: staticPoints, max: 13, correct: staticCorrect, index: staticIndex });
    const eventTimeS = decoded.breakaway ? decoded.breakaway.timeMs / 1000 : NaN;
    const maximumIndex = analysis.maximumStaticFriction?.committed === true ? analysis.maximumStaticFriction.index : null;
    const markerTimeS = decoded.merged[maximumIndex]?.timeS;
    const maximumCorrect = approx(markerTimeS, eventTimeS, BREAKAWAY_TIME_TOLERANCE_S);
    const maximumPoints = maximumCorrect ? 14 : 0;
    score += maximumPoints;
    detail.push({ key: "maximum-static-friction", points: maximumPoints, max: 14, correct: maximumCorrect, index: maximumIndex });
    const kineticIndex = analysis.kineticFriction?.committed === true ? analysis.kineticFriction.index : null;
    const kineticWindows = [...(candidates.slow || []), ...(candidates.fast || [])];
    // Part B now takes over the pull after breakaway and maintains the
    // near-uniform-speed force automatically. A late marker on that stable
    // tail is therefore equivalent to a candidate plateau marker, even when
    // its measured speed falls between the historical slow/fast bands.
    const kineticCandidateCorrect = pointInWindows(kineticIndex, kineticWindows);
    const kineticSettledCorrect = postBreakawayKineticMarker(kineticIndex, decoded);
    const kineticCorrect = kineticCandidateCorrect || kineticSettledCorrect;
    const kineticPoints = kineticCorrect ? 13 : 0;
    score += kineticPoints;
    detail.push({ key: "kinetic-friction", points: kineticPoints, max: 13, correct: kineticCorrect, candidate: kineticCandidateCorrect, settledPostBreak: kineticSettledCorrect, index: kineticIndex });
    return { score, maxScore: 40, detail, candidates, decoded };
  }
  function predictionScore(answer, scenario) {
    const answers = answer?.predictions || [];
    const detail = [];
    let score = 0;
    for (const spec of scenario.predictions || []) {
      const response = answers.find((item) => item?.scenarioId === spec.scenarioId) || answers.find((item) => item?.id === spec.id);
      const type = Boolean(response?.committed && response.frictionType === spec.frictionType);
      const direction = Boolean(response?.committed && response.direction === spec.direction);
      const expectedTolerance = spec.frictionType === "static" ? balanceToleranceN(spec.magnitudeN) : spec.frictionType === "kinetic" ? fkToleranceN(spec.magnitudeN) : ZERO_FRICTION_TOLERANCE_N;
      const magnitude = Boolean(type && direction && Number.isInteger(response?.magnitudeCN) && approx(response.magnitudeCN / 100, spec.magnitudeN, expectedTolerance));
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
    if (analysis.detail.find((item) => item.key === "static-friction" && !item.correct)) feedbackItems.push("靜摩擦力應標記在物體仍靜止、拉力逐漸增加的區段。");
    if (analysis.detail.find((item) => item.key === "maximum-static-friction" && !item.correct)) feedbackItems.push("最大靜摩擦力在物體剛開始滑動的時刻附近。");
    if (analysis.detail.find((item) => item.key === "kinetic-friction" && !item.correct)) feedbackItems.push("滑動摩擦力在物體開始滑動後近似勻速運動的區段。");
    return { score, maxScore: 100, passed, completed: Boolean(answer), breakdown: { balance, experiment, analysis, predictions }, feedbackItems };
  }
  function perfectAnswer(scenario, trial) {
    const decoded = Measurement.unpackTrace(trial);
    const candidates = Measurement.findCandidateWindows(decoded);
    const pointFromWindow = (list, fallback = 0) => {
      const window = list?.[0];
      return window ? Math.round((window.startIndex + window.endIndex) / 2) : fallback;
    };
    const breakawayIndex = decoded.breakaway ? Math.max(0, decoded.merged.findIndex((sample) => sample.kind === "breakaway")) : pointFromWindow(candidates.static, 0);
    const kineticWindow = candidates.slow?.[0] || candidates.fast?.[0];
    const kineticFallback = breakawayIndex < decoded.merged.length - 1 ? breakawayIndex + 1 : breakawayIndex;
    const appliedDirection = scenario.balancePullDirection || "right";
    const oppositeDirection = appliedDirection === "left" ? "right" : "left";
    const appliedMagnitudeCN = scenario.balancePullCN || Math.round(scenario.staticLimitMeanN * 0.3 * 100);
    return {
      schemaVersion: 6, generatorVersion: 1, physicsVersion: 7, measurementVersion: 5, rubricVersion: RUBRIC_VERSION, seed: scenario.seed, phase: "review", variant: "complete", fromReview: false,
      balance: { zeroForce: { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, committed: true }, staticCase: { appliedDirection, appliedMagnitudeCN, learnerAppliedForce: { direction: appliedDirection, magnitudeCN: appliedMagnitudeCN, committed: true }, learnerForce: { frictionType: "static", direction: oppositeDirection, frictionMagnitudeCN: appliedMagnitudeCN, committed: true } }, breakaway: { attempts: 1, bestPullCN: Math.ceil(scenario.staticLimitMeanN * 10) * 10, bestDirection: appliedDirection, learnerMaxCN: Math.round(scenario.staticLimitMeanN * 100), committed: true } }, trial,
      analysis: { staticFriction: { index: pointFromWindow(candidates.static, 0), committed: true }, maximumStaticFriction: { index: breakawayIndex, committed: true }, kineticFriction: { index: kineticWindow ? Math.round((kineticWindow.startIndex + kineticWindow.endIndex) / 2) : kineticFallback, committed: true } },
      predictions: scenario.predictions.map((spec) => ({ id: spec.id, scenarioId: spec.scenarioId, frictionType: spec.frictionType, direction: spec.direction, magnitudeCN: spec.magnitudeCN, motionOutcome: spec.motionOutcome, committed: true }))
    };
  }
  return Object.freeze({ RUBRIC_VERSION, PASSING_SCORE, ZERO_FRICTION_TOLERANCE_N, BALANCE_ABS_TOLERANCE_N, BALANCE_REL_TOLERANCE, MAX_STATIC_BALANCE_ABS_TOLERANCE_N, MAX_STATIC_BALANCE_REL_TOLERANCE, BREAKAWAY_TIME_TOLERANCE_S, KINETIC_MARKER_SETTLE_S, FS_MAX_ABS_TOLERANCE_N, FS_MAX_REL_TOLERANCE, FK_ABS_TOLERANCE_N, FK_REL_TOLERANCE, INTERVAL_MIN_IOU, PLATFORM_COMPARISON_ABS_N, PLATFORM_COMPARISON_REL, FLOAT_EPSILON, forceByKey, balanceToleranceN, maximumStaticBalanceToleranceN, fsToleranceN, fkToleranceN, platformToleranceN, approx, postBreakawayKineticMarker, balanceScore, experimentScore, selectionScore, analysisScore, predictionScore, scoreAnswer, perfectAnswer });
});
