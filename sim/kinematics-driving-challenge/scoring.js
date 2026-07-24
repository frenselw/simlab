(function (root, factory) {
  const levels = typeof module === "object" && module.exports ? require("./level-definitions.js") : root.KinematicsDrivingLevels;
  const model = typeof module === "object" && module.exports ? require("./driving-model.js") : root.KinematicsDrivingModel;
  const api = factory(levels, model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Levels, Model) {
  "use strict";

  const ENTRY_GRACE_S = 0.75;
  const MIN_EVIDENCE_S = 1.5;
  const MIN_SPEED = 3;
  const SIGN_EPSILON = 0.01;
  const CHECKPOINT_ANSWER = "vt-linear";

  function clamp01(value) { return Math.min(1, Math.max(0, value)); }
  function fullThenFade(value, fullLimit, zeroLimit) {
    if (value <= fullLimit) return 1;
    if (value >= zeroLimit) return 0;
    return (zeroLimit - value) / (zeroLimit - fullLimit);
  }
  function riseScore(value) {
    if (value <= 0.02) return 0;
    if (value >= 0.10) return 1;
    return (value - 0.02) / 0.08;
  }
  function regression(samples) {
    if (!Array.isArray(samples) || samples.length < 2) return null;
    const t0 = samples[0].t;
    const rows = samples.map((sample) => ({ t: sample.t - t0, v: sample.v }));
    const meanT = rows.reduce((sum, row) => sum + row.t, 0) / rows.length;
    const meanV = rows.reduce((sum, row) => sum + row.v, 0) / rows.length;
    const denom = rows.reduce((sum, row) => sum + (row.t - meanT) ** 2, 0);
    if (!(denom > 0)) return null;
    const slope = rows.reduce((sum, row) => sum + (row.t - meanT) * (row.v - meanV), 0) / denom;
    const intercept = meanV - slope * meanT;
    const rmse = Math.sqrt(rows.reduce((sum, row) => sum + (row.v - (intercept + slope * row.t)) ** 2, 0) / rows.length);
    return {
      slope, intercept, rmse, deltaV: rows[rows.length - 1].v - rows[0].v,
      speedRange: Math.max(...rows.map((row) => row.v)) - Math.min(...rows.map((row) => row.v)),
      duration: rows[rows.length - 1].t - rows[0].t,
      meanSpeed: meanV
    };
  }
  function zoneSamples(run, zone) {
    const inside = run.samples.filter((sample) => sample.x >= zone.start && sample.x <= zone.end);
    if (!inside.length) return [];
    const enteredAt = inside[0].t;
    return inside.filter((sample) => sample.t - enteredAt + 1e-9 >= ENTRY_GRACE_S);
  }
  function completion(run, zone) {
    const farthest = Math.min(zone.end, Math.max(zone.start, ...run.samples.map((sample) => sample.x)));
    return clamp01((farthest - zone.start) / (zone.end - zone.start));
  }
  function scoreZone(run, zone) {
    const samples = zoneSamples(run, zone);
    const C = completion(run, zone);
    const summary = regression(samples);
    const enough = Boolean(summary && summary.duration + 1e-9 >= MIN_EVIDENCE_S);
    if (!enough) return zoneResult(zone, C, 0, "evidence", summary);
    if (zone.target === "uniform") {
      const speedFloor = summary.meanSpeed >= MIN_SPEED;
      const stability = speedFloor
        ? 0.4 * fullThenFade(Math.abs(summary.slope), 0.08, 0.16) +
          0.3 * fullThenFade(summary.speedRange, 0.9, 1.8) +
          0.3 * fullThenFade(summary.rmse, 0.25, 0.5)
        : 0;
      const fraction = speedFloor ? 0.4 * C + 0.6 * stability : 0;
      const kind = !speedFloor ? "too-slow" : stability >= 0.82 ? "stable" : summary.slope > 0.08 ? "speeding-up" : summary.slope < -0.08 ? "slowing-down" : "unstable";
      return zoneResult(zone, C, fraction, kind, summary, { stability });
    }
    const desiredSign = zone.target === "accelerating" ? 1 : -1;
    const signedSlope = desiredSign * summary.slope;
    const plotRise = Math.abs(summary.deltaV) / zone.graphVelocitySpan;
    const direction = signedSlope > SIGN_EPSILON;
    const D = direction ? riseScore(plotRise) : 0;
    const linearity = fullThenFade(summary.rmse / zone.graphVelocitySpan, 0.0015, 0.008);
    const fraction = 0.25 * C + 0.25 * D + 0.5 * (direction ? linearity : 0);
    let kind = "stable";
    if (!direction) kind = Math.abs(summary.slope) <= SIGN_EPSILON ? "too-small" : "wrong-direction";
    else if (D < 0.55) kind = "too-small";
    else if (linearity < 0.72) kind = "unstable";
    else if (C < 0.95) kind = run.state.terminal === "stopped" ? "stopped-early" : "incomplete";
    return zoneResult(zone, C, fraction, kind, summary, { direction: D, linearity, plotRise });
  }
  function zoneResult(zone, completionValue, fraction, kind, summary, metrics = {}) {
    return {
      zoneId: zone.id, target: zone.target, maxPoints: zone.points, completion: completionValue,
      fraction: clamp01(fraction), points: zone.points * clamp01(fraction), kind, summary, metrics
    };
  }
  function scoreRun(level, codes) {
    const run = Model.replay(level, codes);
    if (!run || !run.state.terminal) return null;
    const zones = Levels.scoredZones(level).map((zone) => scoreZone(run, zone));
    return {
      levelId: level.id, terminal: run.state.terminal, zones,
      points: zones.reduce((sum, zone) => sum + zone.points, 0),
      maxPoints: zones.reduce((sum, zone) => sum + zone.maxPoints, 0),
      run
    };
  }
  function checkpointPoints(checkpoint) {
    return checkpoint?.viewedXt === true && checkpoint?.viewedVt === true && checkpoint.answerId === CHECKPOINT_ANSWER ? 10 : 0;
  }
  function scoreActivity(selectedRuns, checkpoint) {
    const levelResults = Levels.LEVELS.map((level) => scoreRun(level, selectedRuns?.[level.id]?.codes || []));
    if (levelResults.some((result) => !result)) return null;
    const raw = levelResults.reduce((sum, result) => sum + result.points, 0) + checkpointPoints(checkpoint);
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    return {
      score, maxScore: 100, passed: score >= 60, completed: true,
      feedback: "你已用實際駕駛記錄比較勻速、勻加速和勻減速。",
      levelResults, checkpointPoints: checkpointPoints(checkpoint)
    };
  }
  function feedbackText(zoneResultValue) {
    const target = zoneResultValue.target;
    const kind = zoneResultValue.kind;
    if (kind === "stable") {
      if (target === "uniform") return "v–t 圖接近水平，速度大致保持不變。";
      return target === "accelerating" ? "v–t 圖接近向上直線，速度以穩定比率增加。" : "v–t 圖接近向下直線，速度以穩定比率減少。";
    }
    if (kind === "too-slow") return "車速太低，不能用近乎停定當作勻速。";
    if (kind === "too-small") return "速度變化太小；圖線未能清楚顯示所要求的加速或減速。";
    if (kind === "wrong-direction") return target === "accelerating" ? "圖線方向顯示車沒有按要求加速。" : "圖線方向顯示車沒有按要求減速。";
    if (kind === "stopped-early") return "車在路段完結前已停止；請用較平穩的減速策略。";
    if (kind === "evidence") return "今次未留下足夠長的完整路段記錄。";
    if (kind === "speeding-up") return "圖線持續向上，表示車仍在加速，未能保持勻速。";
    if (kind === "slowing-down") return "圖線持續向下，表示車仍在減速，未能保持勻速。";
    if (kind === "incomplete") return "方向正確，但未完成整個計分路段。";
    return "速度變化方向大致正確，但 v–t 圖的斜率仍有明顯變化。";
  }

  return {
    ENTRY_GRACE_S, MIN_EVIDENCE_S, MIN_SPEED, SIGN_EPSILON, CHECKPOINT_ANSWER,
    clamp01, fullThenFade, riseScore, regression, zoneSamples, completion, scoreZone, scoreRun,
    checkpointPoints, scoreActivity, feedbackText
  };
});
