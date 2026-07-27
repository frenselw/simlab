(function (root, factory) {
  const tasks = typeof module === "object" && module.exports ? require("./task-definitions.js") : root.KinematicsGraphTasks;
  const model = typeof module === "object" && module.exports ? require("./graph-model.js") : root.KinematicsGraphModel;
  const analysis = typeof module === "object" && module.exports ? require("./graph-analysis.js") : root.KinematicsGraphAnalysis;
  const api = factory(tasks, model, analysis);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsGraphScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Tasks, Model, Analysis) {
  "use strict";

  const TOLERANCE = Object.freeze({
    drawBins: 96,
    analysisBins: 24,
    zeroBand: 0.08,
    grossMinCoverage: 0.20,
    minCoverage: 0.75,
    minCompositeCoverage: 0.80,
    minPhaseCoverage: 0.60,
    maxGapFraction: 0.16,
    grossMaxLengthRatio: 6.0,
    grossMaxOscillations: 10,
    grossMaxRoughness: 0.14,
    maxNormalOscillations: 5,
    roughnessFull: 0.045,
    roughnessZero: 0.100,
    lineRmseFull: 0.045,
    lineRmseZero: 0.110,
    horizontalSlopeFull: 0.10,
    horizontalSlopeZero: 0.24,
    slopeDeltaZero: 0.12,
    slopeDeltaFull: 0.35,
    slopeTrendRhoZero: 0.25,
    slopeTrendRhoFull: 0.60,
    bicSupportZero: 2,
    bicSupportFull: 6,
    regionRatioZero: 0.65,
    regionRatioFull: 0.85,
    startWindowEnd: 0.22,
    endWindowStart: 0.78,
    startAnchorFull: 0.08,
    startAnchorZero: 0.20,
    endZeroFull: 0.10,
    endZeroZero: 0.22,
    endFlatFull: 0.12,
    endFlatZero: 0.28,
    boundaryYJumpFull: 0.08,
    boundaryYJumpZero: 0.22,
    boundarySlopeJumpFull: 0.20,
    boundarySlopeJumpZero: 0.55,
    classificationAmbiguity: 0.10,
    rawGrossMaxLengthRatio: 20,
    rawGrossMaxOscillations: 24,
    rawGrossMaxRoughness: 0.22,
    rawGrossMaxBucketSpread: 0.45,
    rawEvidenceMinCoverage: 0.50,
    rawEvidenceMinDensity: 0.50,
    rawEvidenceMinAdjacentPairs: 0.35,
    rawEvidenceMaxGapFraction: 0.25,
    evidenceMinReadability: 0.55,
    evidenceMinEdgeCoverage: 0.65,
    phaseSlopeDeltaZero: 0.05,
    phaseSlopeDeltaFull: 0.14
  });

  const CATEGORY_MAX = Object.freeze({ xt: 36, vt: 32, at: 32 });
  const CATEGORY_FLOORS = Object.freeze({ xt: 18, vt: 16, at: 16 });

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }

  function fadeUp(value, zero, full) {
    if (!Number.isFinite(value) || full <= zero) return 0;
    return clamp01((value - zero) / (full - zero));
  }

  function fullThenFade(value, full, zero) {
    if (!Number.isFinite(value) || zero <= full) return 0;
    return clamp01((zero - value) / (zero - full));
  }

  function regionScore(ratio) {
    return fadeUp(ratio, TOLERANCE.regionRatioZero, TOLERANCE.regionRatioFull);
  }

  function zeroAxisScore(metrics) {
    return fullThenFade(metrics?.region?.zeroP80, TOLERANCE.zeroBand, 0.18);
  }

  function coverageScore(metrics) {
    return fadeUp(metrics?.coverage, 0.50, TOLERANCE.minCoverage);
  }

  function readability(metrics) {
    if (!metrics || metrics.structuralInvalid) return 0;
    const gapScore = fullThenFade(metrics.maxGapFraction, 0.08, TOLERANCE.maxGapFraction);
    const edgeScore = clamp01(metrics.edgeCoverage);
    const roughnessScore = fullThenFade(metrics.roughness, TOLERANCE.roughnessFull, TOLERANCE.roughnessZero);
    const oscillationScore = fullThenFade(metrics.oscillationCount, 3, TOLERANCE.maxNormalOscillations);
    const aggregateReadability = clamp01(
      0.45 * coverageScore(metrics) +
      0.20 * gapScore +
      0.15 * edgeScore +
      0.12 * roughnessScore +
      0.08 * oscillationScore
    );
    const raw = metrics.rawDiagnostics;
    const rawContinuity = raw ? clamp01(
      0.35 * fadeUp(raw.coverage, 0.30, 0.75) +
      0.30 * fadeUp(raw.density, 0.30, 0.75) +
      0.20 * fadeUp(raw.adjacentPairRatio, 0.10, 0.65) +
      0.15 * fullThenFade(raw.maxGapFraction, 0.08, 0.25)
    ) : 0;
    return aggregateReadability * (0.35 + 0.65 * rawContinuity);
  }

  function grossGate(metrics) {
    if (!metrics || metrics.structuralInvalid || metrics.validAnalysisCount < 6 ||
        metrics.coverage < TOLERANCE.grossMinCoverage || !(metrics.horizontalSpan > 0)) {
      return { invalid: true, signals: ["結構或覆蓋不足"] };
    }
    const signals = [];
    if (metrics.pathLengthRatio > TOLERANCE.grossMaxLengthRatio) signals.push("線長異常");
    if (metrics.oscillationCount > TOLERANCE.grossMaxOscillations) signals.push("反覆轉折");
    if (metrics.roughness > TOLERANCE.grossMaxRoughness) signals.push("粗糙度過高");
    const rawSignals = [];
    const raw = metrics.rawDiagnostics;
    if (raw?.pathLengthRatio > TOLERANCE.rawGrossMaxLengthRatio) rawSignals.push("原始線長異常");
    if (raw?.oscillationCount > TOLERANCE.rawGrossMaxOscillations) rawSignals.push("原始筆跡反覆轉折");
    if (raw?.roughness > TOLERANCE.rawGrossMaxRoughness) rawSignals.push("原始筆跡粗糙度過高");
    if (raw?.bucketVerticalSpreadP80 > TOLERANCE.rawGrossMaxBucketSpread) rawSignals.push("同一時間小區間高度分散");
    return { invalid: rawSignals.length >= 2 || signals.length >= 2, signals: rawSignals.concat(signals), rawSignals };
  }

  function linearity(metrics) {
    return fullThenFade(metrics?.line?.rmse, TOLERANCE.lineRmseFull, TOLERANCE.lineRmseZero);
  }

  function straightness(metrics) {
    const delta = metrics?.localSlopes?.delta;
    if (!Number.isFinite(delta)) return 0;
    const slopeStability = fullThenFade(Math.abs(delta), 0.06, 0.20);
    return linearity(metrics) * (0.35 + 0.65 * slopeStability);
  }

  function horizontal(metrics) {
    return fullThenFade(Math.abs(metrics?.line?.slope), TOLERANCE.horizontalSlopeFull, TOLERANCE.horizontalSlopeZero);
  }

  function monotonicUp(metrics) {
    if (!metrics) return 0;
    return Math.max(
      fadeUp(metrics.positiveSlopeRatio, 0.60, 0.85),
      fadeUp(metrics.overallChange, 0.08, 0.24) * 0.72
    );
  }

  function monotonicDown(metrics) {
    if (!metrics) return 0;
    return Math.max(
      fadeUp(metrics.negativeSlopeRatio, 0.60, 0.85),
      fadeUp(-metrics.overallChange, 0.08, 0.24) * 0.72
    );
  }

  function directionalQuadraticSupport(metrics, direction, materiality) {
    const coefficient = direction * (metrics?.quadratic?.quadratic ?? 0);
    return fadeUp(metrics?.deltaBIC, TOLERANCE.bicSupportZero, TOLERANCE.bicSupportFull) *
      fadeUp(coefficient, metrics?.scope === "phase" ? 0.015 : 0.02, metrics?.scope === "phase" ? 0.05 : 0.08) *
      materiality;
  }

  function curveEvidence(metrics, direction) {
    const local = metrics?.localSlopes;
    if (!local || local.validCount < 4) return 0;
    const delta = direction * local.delta;
    const zero = metrics.scope === "phase" ? TOLERANCE.phaseSlopeDeltaZero : TOLERANCE.slopeDeltaZero;
    const full = metrics.scope === "phase" ? TOLERANCE.phaseSlopeDeltaFull : TOLERANCE.slopeDeltaFull;
    const materiality = fadeUp(delta, Math.min(zero, 0.08), metrics.scope === "phase" ? 0.12 : 0.18);
    const trend = fadeUp(direction * local.rho, TOLERANCE.slopeTrendRhoZero, TOLERANCE.slopeTrendRhoFull) * materiality;
    return clamp01(
      0.55 * fadeUp(delta, zero, full) +
      0.30 * trend +
      0.15 * directionalQuadraticSupport(metrics, direction, materiality)
    ) * monotonicUp(metrics);
  }

  function slopeIncrease(metrics) {
    return curveEvidence(metrics, 1);
  }

  function slopeDecrease(metrics) {
    return curveEvidence(metrics, -1);
  }

  function startAnchor(metrics) {
    return fullThenFade(Math.abs((metrics?.startY ?? Infinity) - 0.12), TOLERANCE.startAnchorFull, TOLERANCE.startAnchorZero);
  }

  function startPositive(metrics) {
    return fadeUp(metrics?.startY, 0.06, 0.14);
  }

  function endAtZero(metrics) {
    return fullThenFade(Math.abs(metrics?.endY), TOLERANCE.endZeroFull, TOLERANCE.endZeroZero);
  }

  function endFlat(metrics) {
    return fullThenFade(Math.abs(metrics?.endSlope), TOLERANCE.endFlatFull, TOLERANCE.endFlatZero);
  }

  function startSlopePositive(metrics) {
    return fadeUp(metrics?.startSlope, 0.04, 0.16);
  }

  function startFlat(metrics) {
    return fullThenFade(Math.abs(metrics?.startSlope), 0.14, 0.38);
  }

  function noNegativeRegion(metrics) {
    return fullThenFade(metrics?.region?.negative || 0, 0.02, 0.18);
  }

  function boundaryY(metrics) {
    return fullThenFade(metrics?.yJump, TOLERANCE.boundaryYJumpFull, TOLERANCE.boundaryYJumpZero);
  }

  function boundarySlope(metrics) {
    return fullThenFade(metrics?.slopeJump, TOLERANCE.boundarySlopeJumpFull, TOLERANCE.boundarySlopeJumpZero);
  }

  function taskTrace(answer) {
    if (Model.isTrace(answer)) return Model.cloneTrace(answer);
    return typeof answer === "string" ? Model.decodeTrace(answer) : null;
  }

  function add(components, key, maximum, quality) {
    const score = maximum * clamp01(quality);
    components.push({ key, maximum, quality: clamp01(quality), score });
    return score;
  }

  function scoreSingle(task, metrics) {
    const components = [];
    const read = readability(metrics);
    let raw = 0;
    const r = (quality) => quality * read;
    switch (task.rubric) {
      case "uniform-vt":
        raw += add(components, "正值區域", 2, r(regionScore(metrics.region.positive)));
        raw += add(components, "水平程度", 3, r(horizontal(metrics)));
        break;
      case "uniform-at":
        raw += add(components, "接近零軸", 3, r(zeroAxisScore(metrics)));
        raw += add(components, "水平及完整", 2, r(horizontal(metrics)));
        break;
      case "uniform-xt":
        raw += add(components, "起始位置", 1, r(startAnchor(metrics)));
        raw += add(components, "位置增加", 1, r(monotonicUp(metrics)));
        raw += add(components, "固定斜率", 3, r(straightness(metrics)));
        break;
      case "accelerating-vt":
        raw += add(components, "正初速度", 1, r(startPositive(metrics)));
        raw += add(components, "速度增加並保持正值", 2, r(Math.min(monotonicUp(metrics), noNegativeRegion(metrics))));
        raw += add(components, "向上直線", 5, r(Math.min(monotonicUp(metrics), straightness(metrics))));
        break;
      case "accelerating-at":
        raw += add(components, "正加速度", 3, r(regionScore(metrics.region.positive)));
        raw += add(components, "水平程度", 5, r(horizontal(metrics)));
        break;
      case "accelerating-xt":
        raw += add(components, "起始位置", 1, r(startAnchor(metrics)));
        raw += add(components, "初始正斜率", 1, r(startSlopePositive(metrics)));
        raw += add(components, "位置增加", 1, r(monotonicUp(metrics)));
        raw += add(components, "愈來愈斜", 6, r(slopeIncrease(metrics)));
        break;
      case "decelerating-vt":
        raw += add(components, "正初速度", 1, r(startPositive(metrics)));
        raw += add(components, "向下直線", 4, r(Math.min(monotonicDown(metrics), straightness(metrics))));
        raw += add(components, "到零且不反向", 3, r(Math.min(endAtZero(metrics), noNegativeRegion(metrics))));
        break;
      case "decelerating-at":
        raw += add(components, "負加速度", 3, r(regionScore(metrics.region.negative)));
        raw += add(components, "水平程度", 5, r(horizontal(metrics)));
        break;
      case "decelerating-xt":
        raw += add(components, "起始位置", 1, r(startAnchor(metrics)));
        raw += add(components, "位置增加且不反向", 2, r(Math.min(monotonicUp(metrics), noNegativeRegion(metrics))));
        raw += add(components, "愈來愈平", 4, r(slopeDecrease(metrics)));
        raw += add(components, "末段斜率接近零", 2, r(endFlat(metrics)));
        break;
      default:
        break;
    }
    return { score: raw, components, readability: read };
  }

  function phaseRead(metrics) {
    return readability(metrics);
  }

  function scoreComposite(task, metrics) {
    const components = [];
    if (!metrics.phases || metrics.phases.length !== 4) return { score: 0, components, readability: 0 };
    const [a, b, c, d] = metrics.phases;
    const reads = metrics.phases.map(phaseRead);
    const pr = (index, quality) => quality * reads[index];
    let raw = 0;
    if (task.rubric === "composite-vt") {
      raw += add(components, "A 由零向上直線", 2, pr(0, Math.min(endAtZero({ endY: a.startY }), monotonicUp(a), straightness(a))));
      raw += add(components, "B 正值水平", 2, pr(1, Math.min(regionScore(b.region.positive), horizontal(b))));
      raw += add(components, "C 向下直線至零", 2, pr(2, Math.min(monotonicDown(c), straightness(c), endAtZero(c))));
      raw += add(components, "D 零速度", 1, pr(3, Math.min(zeroAxisScore(d), horizontal(d))));
      metrics.boundaries.forEach((boundary, index) => {
        raw += add(components, `邊界 ${index + 1} 速度連續`, 4 / 3, boundaryY(boundary));
      });
    } else if (task.rubric === "composite-at") {
      raw += add(components, "A 正加速度", 2, pr(0, Math.min(regionScore(a.region.positive), horizontal(a))));
      raw += add(components, "B 零加速度", 2, pr(1, Math.min(zeroAxisScore(b), horizontal(b))));
      raw += add(components, "C 負加速度", 2, pr(2, Math.min(regionScore(c.region.negative), horizontal(c))));
      raw += add(components, "D 零加速度", 2, pr(3, Math.min(zeroAxisScore(d), horizontal(d))));
      raw += add(components, "各段覆蓋及次序", 3, reads.reduce((sum, value) => sum + value, 0) / 4);
    } else if (task.rubric === "composite-xt") {
      raw += add(components, "起始位置", 1, pr(0, startAnchor(a)));
      raw += add(components, "A 由靜止愈來愈斜", 3, pr(0, Math.min(startFlat(a), slopeIncrease(a))));
      raw += add(components, "B 固定正斜率", 2, pr(1, Math.min(monotonicUp(b), straightness(b))));
      raw += add(components, "C 愈來愈平至停止", 3, pr(2, Math.min(slopeDecrease(c), endFlat(c))));
      raw += add(components, "D 位置不變", 1, pr(3, horizontal(d)));
      metrics.boundaries.forEach((boundary, index) => {
        raw += add(components, `邊界 ${index + 1} 位置連續`, 0.5, boundaryY(boundary));
        raw += add(components, `邊界 ${index + 1} 斜率連續`, 0.5, boundarySlope(boundary));
      });
    }
    const overall = fadeUp(metrics.coverage, 0.60, TOLERANCE.minCompositeCoverage);
    components.forEach((component) => {
      component.quality *= overall;
      component.score *= overall;
    });
    return {
      score: raw * overall,
      components,
      readability: readability(metrics),
      phaseReadability: reads,
      overallCompositeCoverageScore: overall
    };
  }

  function evidenceStatus(task, metrics, gate, scored) {
    if (gate.invalid) return { complete: false, reason: "圖線不可判讀" };
    if (metrics.coverage < TOLERANCE.minCoverage) return { complete: false, reason: "圖線未覆蓋主要時間範圍" };
    if (metrics.edgeCoverage < TOLERANCE.evidenceMinEdgeCoverage) return { complete: false, reason: "圖線未延伸至作圖時間範圍兩端點" };
    if (scored.readability < TOLERANCE.evidenceMinReadability) return { complete: false, reason: "圖線可判讀程度不足" };
    const raw = metrics.rawDiagnostics;
    if (!raw || raw.coverage < TOLERANCE.rawEvidenceMinCoverage ||
        raw.density < TOLERANCE.rawEvidenceMinDensity ||
        raw.adjacentPairRatio < TOLERANCE.rawEvidenceMinAdjacentPairs ||
        raw.maxGapFraction > TOLERANCE.rawEvidenceMaxGapFraction) {
      return { complete: false, reason: "原始圖線過於稀疏或不連續" };
    }
    if (task.scenarioId === "composite") {
      if (metrics.coverage < TOLERANCE.minCompositeCoverage) return { complete: false, reason: "綜合圖整體覆蓋不足" };
      if (metrics.phases.some((phase) => phase.coverage < TOLERANCE.minPhaseCoverage ||
          phase.edgeCoverage < TOLERANCE.evidenceMinEdgeCoverage ||
          readability(phase) < 0.50 ||
          !phase.rawDiagnostics ||
          phase.rawDiagnostics.coverage < TOLERANCE.rawEvidenceMinCoverage ||
          phase.rawDiagnostics.density < TOLERANCE.rawEvidenceMinDensity ||
          phase.rawDiagnostics.adjacentPairRatio < TOLERANCE.rawEvidenceMinAdjacentPairs ||
          phase.rawDiagnostics.maxGapFraction > TOLERANCE.rawEvidenceMaxGapFraction)) {
        return { complete: false, reason: "綜合圖有階段未完整表達" };
      }
    }
    return { complete: true, reason: "" };
  }

  function compositeFeedback(task, metrics, scored) {
    const messages = [];
    const [a, b, c, d] = metrics.phases || [];
    if (!a || !b || !c || !d) return ["綜合圖的四個階段未能完整判讀。"];
    if (task.graphType === "vt") {
      if (straightness(a) < 0.55 || monotonicUp(a) < 0.65) messages.push("A 階段的 v–t 圖應由零開始，以直線上升。");
      if (horizontal(b) < 0.55 || regionScore(b.region.positive) < 0.55) messages.push("B 階段的 v–t 圖應在正值區保持水平。");
      if (straightness(c) < 0.55 || monotonicDown(c) < 0.65 || endAtZero(c) < 0.55) messages.push("C 階段的 v–t 圖應以直線下降，並在段末到零。");
      if (zeroAxisScore(d) < 0.55) messages.push("D 階段靜止，v–t 圖應沿零軸。");
    } else if (task.graphType === "at") {
      if (regionScore(a.region.positive) < 0.55 || horizontal(a) < 0.55) messages.push("A 階段應是正值水平的 a–t 圖。");
      if (zeroAxisScore(b) < 0.55) messages.push("B 階段勻速，加速度應在零軸。");
      if (regionScore(c.region.negative) < 0.55 || horizontal(c) < 0.55) messages.push("C 階段應是負值水平的 a–t 圖。");
      if (zeroAxisScore(d) < 0.55) messages.push("D 階段靜止，加速度應在零軸。");
    } else {
      if (slopeIncrease(a) < 0.55 || startFlat(a) < 0.55) messages.push("A 階段的 x–t 圖應由近乎水平開始，之後愈來愈斜。");
      if (straightness(b) < 0.55 || monotonicUp(b) < 0.65) messages.push("B 階段的 x–t 圖應接成固定正斜率的直線。");
      if (slopeDecrease(c) < 0.55 || endFlat(c) < 0.55) messages.push("C 階段的 x–t 圖應繼續上升，但愈來愈平至停止。");
      if (horizontal(d) < 0.55) messages.push("D 階段位置不變，x–t 圖應保持水平。");
      const badY = metrics.boundaries.some((boundary) => boundaryY(boundary) < 0.55);
      const badSlope = metrics.boundaries.some((boundary) => boundarySlope(boundary) < 0.35);
      if (badY) messages.push("階段邊界的位置不應突然跳變。");
      else if (badSlope) messages.push("x–t 圖在階段邊界的斜率應大致接得上。");
    }
    if (!messages.length && scored.score >= task.points * 0.8) messages.push("圖線已清楚表達這段運動的主要特徵。");
    return messages.slice(0, 2);
  }

  function feedbackFor(task, metrics, scored, gate) {
    if (gate.invalid) return ["目前圖線未形成一條可判讀的運動曲線。請擦除多餘轉折，再表達整段運動。"];
    if (task.scenarioId === "composite") return compositeFeedback(task, metrics, scored);
    const messages = [];
    if ((metrics.region?.negative || 0) > 0.18 && task.graphType !== "at") {
      messages.push("圖線進入了負值區；這些情境不包含反向運動。");
    }
    if (metrics.coverage < 0.75 || metrics.edgeCoverage < 0.7) {
      messages.push("請把圖線延伸至主要時間範圍，讓整段運動都可判讀。");
    }
    const straight = linearity(metrics);
    const increase = slopeIncrease(metrics);
    const decrease = slopeDecrease(metrics);
    if (["uniform-xt", "accelerating-vt", "decelerating-vt"].includes(task.rubric) && straight < 0.55) {
      messages.push(task.rubric === "uniform-xt"
        ? "勻速的 x–t 圖斜率應大致保持不變。"
        : "勻變速的 v–t 圖應是斜率固定的直線。");
    }
    if (["accelerating-at", "decelerating-at", "uniform-vt", "uniform-at"].includes(task.rubric) && horizontal(metrics) < 0.55) {
      messages.push("這幅圖應大致水平；目前高度隨時間明顯改變。");
    }
    if (["accelerating-xt", "composite-xt"].includes(task.rubric) && increase < 0.45) {
      messages.push("勻加速階段應愈來愈斜，請比較前段與後段的斜率。");
    }
    if (["decelerating-xt", "composite-xt"].includes(task.rubric) && decrease < 0.45) {
      messages.push("勻減速階段位置仍增加，但圖線應愈來愈平。");
    }
    if (task.rubric === "decelerating-vt" && endAtZero(metrics) < 0.55) {
      messages.push("物體在作圖時間末剛好停止，v–t 圖最右端應到達零。");
    }
    if (!messages.length && scored.score >= task.points * 0.8) messages.push("圖線已清楚表達這段運動的主要特徵。");
    if (!messages.length) messages.push("圖線已有部分正確特徵；請再檢查方向、斜率及終點。");
    return messages.slice(0, 2);
  }

  function scoreTask(task, answer) {
    const trace = taskTrace(answer);
    if (!trace) {
      return {
        taskId: task.id, graphType: task.graphType, score: 0, maxScore: task.points,
        grossInvalid: true, evidenceComplete: false, evidenceReason: "圖線仍是空白或資料無效",
        analysis: null, components: [], feedback: ["這幅圖仍是空白或資料無效。"]
      };
    }
    const metrics = Analysis.analyzeTrace(trace, task.graphType, { composite: task.scenarioId === "composite" });
    const gate = grossGate(metrics);
    if (gate.invalid) {
      return {
        taskId: task.id, graphType: task.graphType, score: 0, maxScore: task.points,
        grossInvalid: true, evidenceComplete: false, evidenceReason: "圖線不可判讀",
        analysis: metrics, components: [], feedback: feedbackFor(task, metrics, { score: 0 }, gate)
      };
    }
    const scored = task.scenarioId === "composite" ? scoreComposite(task, metrics) : scoreSingle(task, metrics);
    const score = Math.max(0, Math.min(task.points, scored.score));
    const evidence = evidenceStatus(task, metrics, gate, scored);
    return {
      taskId: task.id,
      graphType: task.graphType,
      score,
      maxScore: task.points,
      grossInvalid: false,
      analysis: metrics,
      components: scored.components,
      readability: scored.readability,
      evidenceComplete: evidence.complete,
      evidenceReason: evidence.reason,
      feedback: feedbackFor(task, metrics, { ...scored, score }, gate)
    };
  }

  function contradictionMessages(taskResults) {
    const byId = Object.fromEntries(taskResults.map((result) => [result.taskId, result]));
    const messages = [];
    for (const scenario of Tasks.SCENARIOS) {
      const vt = byId[`${scenario.id}-vt`]?.analysis;
      const at = byId[`${scenario.id}-at`]?.analysis;
      const xt = byId[`${scenario.id}-xt`]?.analysis;
      if (!vt || !at || !xt) continue;
      if (scenario.id === "accelerating" && at.region.positive > 0.75 && vt.overallChange < -0.08) {
        messages.push("勻加速情境的 a–t 圖表示正加速度，但 v–t 圖正在下降。");
      } else if (scenario.id === "uniform" && at.region.zero > 0.75 && Math.abs(vt.overallChange || 0) > 0.16) {
        messages.push("勻速情境的 a–t 圖接近零，但 v–t 圖仍有明顯升降。");
      } else if (scenario.id === "decelerating" && (vt.overallChange || 0) < -0.1 &&
          (xt.localSlopes?.delta || 0) > 0.15) {
        messages.push("勻減速情境的 v–t 圖正在下降，但 x–t 圖反而愈來愈斜。");
      }
    }
    return messages.slice(0, 4);
  }

  function scoreActivity(answers) {
    const normalized = Array.isArray(answers) ? answers : [];
    const taskResults = Tasks.TASKS.map((task, index) => scoreTask(task, normalized[index]));
    const unroundedScore = taskResults.reduce((sum, result) => sum + result.score, 0);
    const categoryScores = { xt: 0, vt: 0, at: 0 };
    taskResults.forEach((result) => { categoryScores[result.graphType] += result.score; });
    const compositeScore = taskResults
      .filter((result) => result.taskId.startsWith("composite-"))
      .reduce((sum, result) => sum + result.score, 0);
    const byId = Object.fromEntries(taskResults.map((result) => [result.taskId, result]));
    const validMastery = (taskId, predicate) => {
      const result = byId[taskId];
      return Boolean(result && !result.grossInvalid && result.evidenceComplete &&
        result.analysis && predicate(result.analysis));
    };
    const semanticChecks = [
      {
        code: "accelerating-at-positive", label: "勻加速 a–t 圖需要固定正加速度",
        passed: validMastery("accelerating-at", (metrics) =>
          regionScore(metrics.region.positive) >= 0.55 && horizontal(metrics) >= 0.55)
      },
      {
        code: "decelerating-at-negative", label: "勻減速 a–t 圖需要固定負加速度",
        passed: validMastery("decelerating-at", (metrics) =>
          regionScore(metrics.region.negative) >= 0.55 && horizontal(metrics) >= 0.55)
      },
      {
        code: "composite-at-signs", label: "綜合 a–t 圖的 A 階段要為正、C 階段要為負",
        passed: validMastery("composite-at", (metrics) => {
          const [a, , c] = metrics.phases || [];
          return Boolean(a && c &&
            regionScore(a.region.positive) >= 0.55 && horizontal(a) >= 0.55 &&
            regionScore(c.region.negative) >= 0.55 && horizontal(c) >= 0.55);
        })
      },
      {
        code: "accelerating-xt-curve", label: "勻加速 x–t 圖需要清楚表達斜率增加",
        passed: validMastery("accelerating-xt", (metrics) => curveEvidence(metrics, 1) >= 0.40)
      },
      {
        code: "decelerating-xt-curve", label: "勻減速 x–t 圖需要清楚表達斜率減少",
        passed: validMastery("decelerating-xt", (metrics) => curveEvidence(metrics, -1) >= 0.40)
      },
      {
        code: "composite-xt-curves", label: "綜合 x–t 圖需要同時表達 A 加速及 C 減速形狀",
        passed: validMastery("composite-xt", (metrics) =>
          curveEvidence(metrics.phases?.[0], 1) >= 0.35 &&
          curveEvidence(metrics.phases?.[2], -1) >= 0.35)
      }
    ];
    const masteryFailures = semanticChecks.filter((check) => !check.passed).map(({ code, label }) => ({ code, label }));
    const passed = unroundedScore >= 65 && compositeScore >= 18 &&
      Object.entries(CATEGORY_FLOORS).every(([key, floor]) => categoryScores[key] >= floor) &&
      masteryFailures.length === 0;
    const score = Math.max(0, Math.min(100, Math.round(unroundedScore)));
    return {
      score,
      unroundedScore,
      maxScore: 100,
      passed,
      completed: true,
      compositeScore,
      categoryScores,
      categoryMaximums: { ...CATEGORY_MAX },
      taskResults,
      semanticChecks,
      masteryFailures,
      evidenceIncompleteTaskIds: taskResults.filter((result) => !result.evidenceComplete).map((result) => result.taskId),
      contradictions: contradictionMessages(taskResults),
      feedback: passed
        ? "你已掌握三種運動圖的主要定性特徵。"
        : "請根據逐圖回饋再比較位置、速度與加速度的變化。"
    };
  }

  function idealValue(taskId, t) {
    if (taskId === "uniform-vt") return 0.28;
    if (taskId === "uniform-at") return 0;
    if (taskId === "uniform-xt") return 0.12 + 0.58 * t;
    if (taskId === "accelerating-vt") return 0.12 + 0.34 * t;
    if (taskId === "accelerating-at") return 0.27;
    if (taskId === "accelerating-xt") return 0.12 + 0.12 * t + 0.58 * t * t;
    if (taskId === "decelerating-vt") return 0.42 * (1 - t);
    if (taskId === "decelerating-at") return -0.26;
    if (taskId === "decelerating-xt") return 0.12 + 0.70 * t - 0.35 * t * t;
    const phase = Math.min(3, Math.floor(t * 4));
    const u = phase === 3 ? (t - 0.75) * 4 : (t - phase / 4) * 4;
    if (taskId === "composite-vt") {
      if (phase === 0) return 0.32 * u;
      if (phase === 1) return 0.32;
      if (phase === 2) return 0.32 * (1 - u);
      return 0;
    }
    if (taskId === "composite-at") return [0.26, 0, -0.26, 0][phase];
    if (taskId === "composite-xt") {
      if (phase === 0) return 0.08 + 0.16 * u * u;
      if (phase === 1) return 0.24 + 0.32 * u;
      if (phase === 2) return 0.56 + 0.32 * u - 0.16 * u * u;
      return 0.72;
    }
    return 0;
  }

  function exemplarTrace(taskId) {
    const task = Tasks.taskById(taskId);
    if (!task) return null;
    const trace = Model.createTrace();
    for (let index = 0; index < Model.DRAW_BINS; index += 1) {
      const time = index / (Model.DRAW_BINS - 1);
      const normalized = idealValue(taskId, time);
      const plotY = task.graphType === "xt" ? normalized : normalized + 0.5;
      trace[index] = Model.quantizeY(plotY);
    }
    return trace;
  }

  function readableSummary(taskResult) {
    if (!taskResult?.analysis || taskResult.grossInvalid) return "資料不足";
    const metrics = taskResult.analysis;
    const parts = [];
    if ((metrics.overallChange || 0) > 0.10) parts.push("圖線整體上升");
    else if ((metrics.overallChange || 0) < -0.10) parts.push("圖線整體下降");
    else parts.push("圖線整體接近水平");
    if (taskResult.graphType !== "xt") {
      if (metrics.region.positive > 0.65) parts.push("主要位於正區");
      else if (metrics.region.negative > 0.65) parts.push("主要位於負區");
      else if (metrics.region.zero > 0.65) parts.push("主要位於零附近");
    }
    return parts.join("；");
  }

  return {
    TOLERANCE,
    CATEGORY_MAX,
    CATEGORY_FLOORS,
    fadeUp,
    fullThenFade,
    readability,
    grossGate,
    curveEvidence,
    scoreTask,
    scoreActivity,
    contradictionMessages,
    exemplarTrace,
    readableSummary
  };
});
