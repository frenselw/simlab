(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.FreeFallModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FreeFallScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";

  const RUBRIC_VERSION = 3;
  const LEGACY_RUBRIC_VERSION = 2;
  const PASS_SCORE = 60;
  const DELTA_T_ABS_TOLERANCE_S = 0.005;
  const RATIO_TERM_TOLERANCE = 0.15;
  const MIN_MEANINGFUL_MOVE_NORM = 0.025;
  const ZERO_ALIGNMENT_TOLERANCE_PX = 6;
  const MIN_ZERO_TICK_OVERLAP_PX = 4;
  const ZERO_TICK_LENGTH_PX = 23;
  const HORIZONTAL_CANONICAL_TOLERANCE = 0.01;
  const GUIDE_X1 = 80;
  const GUIDE_X2 = 285;
  const RULER_SIDE_SPLIT_X = (GUIDE_X1 + GUIDE_X2) / 2;
  const RULER_GEOMETRY_FIXED_LEFT = "fixed-left-v1";
  const LEGACY_EDGE_MIN_GAP_PX = 6;
  const LEGACY_EDGE_MAX_GAP_PX = 44;
  const TOTAL_KEYS = Object.freeze(["total1", "total2", "total3", "total4"]);
  const GAP_KEYS = Object.freeze(["gap01", "gap12", "gap23", "gap34"]);
  const CONCEPT_ANSWERS = Object.freeze({
    lawAnswerId: "square",
    intervalLawAnswerId: "odd",
    accelerationAnswerId: "constant-acceleration"
  });

  const finite = Model.finite;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const CURRENT_PLACEMENT_FIELDS = Object.freeze([
    "rulerX", "rulerSide", "rulerGeometry", "horizontalMode", "guideFraction",
    "boundaryOverlapPx", "zeroTickOverlapPx"
  ]);
  const LEGACY_PLACEMENT_FIELDS = Object.freeze(["legacyEdgeSide", "legacyEdgeGapPx"]);
  const hasAny = (value, fields) => fields.some((field) => own(value || {}, field));
  const rulerSideForX = (rulerX) => rulerX < RULER_SIDE_SPLIT_X ? "left" : "right";
  function validCurrentHorizontalRelation(value) {
    if (!value || !finite(value.rulerX) || value.rulerX < 0 || value.rulerX > 360 ||
        !["left", "right"].includes(value.rulerSide) ||
        value.rulerSide !== rulerSideForX(value.rulerX) ||
        !finite(value.zeroTickOverlapPx) || value.zeroTickOverlapPx < 0 ||
        value.zeroTickOverlapPx > ZERO_TICK_LENGTH_PX ||
        own(value, "rulerGeometry") && value.rulerGeometry !== RULER_GEOMETRY_FIXED_LEFT) return false;
    if (value.horizontalMode === "guide-fraction") {
      if (!finite(value.guideFraction) || value.guideFraction < 0 || value.guideFraction > 1 ||
          own(value, "boundaryOverlapPx")) return false;
      const canonicalX = GUIDE_X1 + value.guideFraction * (GUIDE_X2 - GUIDE_X1);
      return Math.abs(value.rulerX - canonicalX) <= HORIZONTAL_CANONICAL_TOLERANCE &&
        value.rulerSide === rulerSideForX(canonicalX) &&
        Math.abs(value.zeroTickOverlapPx - ZERO_TICK_LENGTH_PX) <= HORIZONTAL_CANONICAL_TOLERANCE;
    }
    if (!["left-boundary", "right-boundary"].includes(value.horizontalMode) ||
        !finite(value.boundaryOverlapPx) || value.boundaryOverlapPx < 0 ||
        value.boundaryOverlapPx > ZERO_TICK_LENGTH_PX || own(value, "guideFraction")) return false;
    const expectedSide = value.horizontalMode === "left-boundary" ? "left" : "right";
    return value.rulerSide === expectedSide &&
      Math.abs(value.boundaryOverlapPx - value.zeroTickOverlapPx) <= HORIZONTAL_CANONICAL_TOLERANCE;
  }
  function distanceTolerance(expected) { return Math.max(0.03, 0.06 * expected); }
  function within(actual, expected, tolerance) {
    return finite(actual) && finite(expected) && finite(tolerance) && Math.abs(actual - expected) <= tolerance + 1e-12;
  }
  function validPlacement(value, task) {
    return Boolean(value && value.task === task && ["pointer", "keyboard"].includes(value.mode) &&
      hasAny(value, CURRENT_PLACEMENT_FIELDS) && !hasAny(value, LEGACY_PLACEMENT_FIELDS) &&
      finite(value.moveNorm) && value.moveNorm >= MIN_MEANINGFUL_MOVE_NORM && value.moveNorm <= 1 &&
      finite(value.zeroErrorPx) && Math.abs(value.zeroErrorPx) <= ZERO_ALIGNMENT_TOLERANCE_PX &&
      finite(value.zeroTickOverlapPx) && value.zeroTickOverlapPx >= MIN_ZERO_TICK_OVERLAP_PX &&
      validCurrentHorizontalRelation(value));
  }
  function validLegacyPlacement(value, task) {
    return Boolean(value && value.task === task && ["pointer", "keyboard"].includes(value.mode) &&
      hasAny(value, LEGACY_PLACEMENT_FIELDS) && !hasAny(value, CURRENT_PLACEMENT_FIELDS) &&
      finite(value.moveNorm) && value.moveNorm >= MIN_MEANINGFUL_MOVE_NORM && value.moveNorm <= 1 &&
      finite(value.zeroErrorPx) && Math.abs(value.zeroErrorPx) <= ZERO_ALIGNMENT_TOLERANCE_PX &&
      finite(value.legacyEdgeGapPx) && value.legacyEdgeGapPx >= LEGACY_EDGE_MIN_GAP_PX &&
      value.legacyEdgeGapPx <= LEGACY_EDGE_MAX_GAP_PX);
  }
  function totalPlacementValid(value) {
    return validPlacement(value, "total") || validLegacyPlacement(value, "total");
  }
  function gapEvidenceValid(value, task, reading) {
    return Boolean((validPlacement(value, task) || validLegacyPlacement(value, task)) &&
      value.usedWhileValid === true && finite(value.readingM) &&
      value.readingM === reading);
  }
  function resolvedReading(item) { return item?.status === "recorded" && finite(item.readingM) ? item.readingM : null; }
  function expectedTotals(frequencyHz) { return [1, 2, 3, 4].map((index) => Model.displacementAt(frequencyHz, index)); }
  function expectedGaps(frequencyHz) { return [1, 2, 3, 4].map((index) => Model.intervalDisplacement(frequencyHz, index)); }
  function ratioTarget(readings) {
    return Array.isArray(readings) && readings.length === 4 && readings.every((value) => finite(value) && value > 0)
      ? readings.map((value) => value / readings[0]) : null;
  }
  function scoreRatio(answer, target, pointsPerTerm) {
    if (!answer || answer.status !== "answered" || !Array.isArray(answer.values) || answer.values.length !== 4 ||
        answer.values[0] !== 1 || !answer.values.every((value) => finite(value) && value > 0) || !target) {
      return { points: 0, terms: [false, false, false], target };
    }
    const terms = [1, 2, 3].map((index) => within(answer.values[index], target[index], RATIO_TERM_TOLERANCE));
    return { points: terms.filter(Boolean).length * pointsPerTerm, terms, target };
  }
  function scoreAttemptV2(answer) {
    if (!answer || !Model.validFrequency(answer.frequencyHz)) throw new Error("Invalid free-fall answer");
    const measurements = answer.measurements || {};
    const evidence = answer.evidence || {};
    const analysis = answer.analysis || {};
    const totals = TOTAL_KEYS.map((key) => resolvedReading(measurements[key]));
    const gaps = GAP_KEYS.map((key) => resolvedReading(measurements[key]));
    const idealTotals = expectedTotals(answer.frequencyHz);
    const idealGaps = expectedGaps(answer.frequencyHz);

    const totalPlacement = totalPlacementValid({ task: "total", ...evidence.totalPlacement });
    const totalLinks = TOTAL_KEYS.map((key, index) => totalPlacement && measurements[key]?.usedTotalPlacement === true &&
      measurements[key]?.status === "recorded" && finite(totals[index]));
    const gapLinks = GAP_KEYS.map((key, index) => gapEvidenceValid(evidence[key], key, gaps[index]));
    const process = {
      setup: evidence.setupCompleted === true && answer.frequencyAssigned === true ? 4 : 0,
      totalPlacement: totalLinks.some(Boolean) ? 8 : 0,
      totalReadings: totalLinks.filter(Boolean).length,
      intervals: gapLinks.filter(Boolean).length * 6
    };
    process.points = process.setup + process.totalPlacement + process.totalReadings + process.intervals;
    process.items = [
      resultItem("setup", "拍攝設定", process.setup ? "correct" : "no-evidence", process.setup ? "有證據" : "未有證據", "完成拍攝", "舊版操作證據按原 rubric 保留。", process.setup, 4),
      resultItem("totalPlacement", "總位移尺位", process.totalPlacement ? "correct" : "no-evidence", process.totalPlacement ? "有證據" : "未有證據", "有效尺位", "舊版操作證據按原 rubric 保留。", process.totalPlacement, 8),
      resultItem("totalReadings", "總位移操作", process.totalReadings ? process.totalReadings === 4 ? "correct" : "incorrect" : "no-evidence", `${process.totalReadings}/4`, "4/4", "舊版操作證據按原 rubric 保留。", process.totalReadings, 4),
      resultItem("intervals", "相鄰間隔操作", process.intervals ? process.intervals === 24 ? "correct" : "incorrect" : "no-evidence", `${process.intervals}/24`, "24/24", "舊版操作證據按原 rubric 保留。", process.intervals, 24)
    ];
    const meaningfulRulerUse = totalPlacement && totalLinks.filter(Boolean).length >= 3 && gapLinks.filter(Boolean).length >= 3;

    const deltaTCorrect = within(analysis.deltaTS, Model.deltaT(answer.frequencyHz), DELTA_T_ABS_TOLERANCE_S);
    const totalReadingCorrect = totals.map((value, index) => within(value, idealTotals[index], distanceTolerance(idealTotals[index])));
    const gapReadingCorrect = gaps.map((value, index) => within(value, idealGaps[index], distanceTolerance(idealGaps[index])));
    const ratios = {
      cumulativeTime: scoreRatio(analysis.cumulativeTimeRatio, [1, 2, 3, 4], 2 / 3),
      totalDisplacement: scoreRatio(analysis.totalDisplacementRatio, ratioTarget(totals), 1),
      intervalTime: scoreRatio(analysis.intervalTimeRatio, [1, 1, 1, 1], 2 / 3),
      intervalDistance: scoreRatio(analysis.intervalDistanceRatio, ratioTarget(gaps), 1)
    };
    const quantitative = {
      deltaT: deltaTCorrect ? 4 : 0,
      totalReadings: totalReadingCorrect.filter(Boolean).length * 2,
      gapReadings: gapReadingCorrect.filter(Boolean).length * 2,
      ratios: Object.values(ratios).reduce((sum, part) => sum + part.points, 0)
    };
    quantitative.points = quantitative.deltaT + quantitative.totalReadings + quantitative.gapReadings + quantitative.ratios;
    const laws = {
      displacement: analysis.lawAnswerId === CONCEPT_ANSWERS.lawAnswerId ? 12 : 0,
      intervals: analysis.intervalLawAnswerId === CONCEPT_ANSWERS.intervalLawAnswerId ? 10 : 0,
      acceleration: analysis.accelerationAnswerId === CONCEPT_ANSWERS.accelerationAnswerId ? 8 : 0
    };
    laws.points = laws.displacement + laws.intervals + laws.acceleration;
    const rawScore = Math.max(0, Math.min(100, process.points + quantitative.points + laws.points));
    const score = Math.round(meaningfulRulerUse ? rawScore : Math.min(rawScore, 59));
    return {
      score, rawScore, maxScore: 100, passed: score >= PASS_SCORE, completed: true,
      meaningfulRulerUse, detail: { process, quantitative, laws, totalLinks, gapLinks, totalReadingCorrect, gapReadingCorrect, ratios },
      feedback: score === 100
        ? "你已用直尺證據連結等時間頻閃、平方總位移與連續奇數間隔。"
        : meaningfulRulerUse
          ? "請對照理想值，分清由起點量度的總位移和相鄰兩點的間隔。"
          : "今次未有足夠跨兩類量度的有效直尺證據，因此總分上限為 59 分。"
    };
  }

  function resultItem(id, label, status, learner, expected, guidance, points, max) {
    return { id, label, status, learner, expected, guidance, points, max };
  }
  const stablePoints = (value) => Math.round(value * 1e12) / 1e12;
  function answerStatus(value, correct) {
    return value == null ? "unanswered" : correct ? "correct" : "incorrect";
  }
  function scoreTimeRatioV3(answer, target, id, label) {
    const values = answer?.values;
    const maxPerTerm = 5 / 3;
    const items = [1, 2, 3].map((index) => {
      const learner = Array.isArray(values) ? values[index] : null;
      const correct = within(learner, target[index], RATIO_TERM_TOLERANCE);
      return resultItem(`${id}-${index + 1}`, `${label}第 ${index + 1} 項`, answerStatus(learner, correct), learner,
        target[index], `比較 ${label} 的第 ${index + 1} 項；容差 ±${RATIO_TERM_TOLERANCE}。`, correct ? maxPerTerm : 0, maxPerTerm);
    });
    return { points: stablePoints(items.reduce((sum, item) => sum + item.points, 0)), terms: items.map((item) => item.status === "correct"), target, items };
  }
  function scoreAttemptV3(answer) {
    if (!answer || !Model.validFrequency(answer.frequencyHz)) throw new Error("Invalid free-fall answer");
    const measurements = answer.measurements || {};
    const evidence = answer.evidence || {};
    const analysis = answer.analysis || {};
    const totals = TOTAL_KEYS.map((key) => resolvedReading(measurements[key]));
    const gaps = GAP_KEYS.map((key) => resolvedReading(measurements[key]));
    const idealTotals = expectedTotals(answer.frequencyHz);
    const idealGaps = expectedGaps(answer.frequencyHz);
    const totalPlacement = totalPlacementValid({ task: "total", ...evidence.totalPlacement });
    const totalLinks = TOTAL_KEYS.map((key, index) => totalPlacement && measurements[key]?.usedTotalPlacement === true &&
      measurements[key]?.status === "recorded" && finite(totals[index]));
    const gapLinks = GAP_KEYS.map((key, index) => gapEvidenceValid(evidence[key], key, gaps[index]));
    const process = {
      setup: evidence.setupCompleted === true && answer.frequencyAssigned === true ? 4 : 0,
      totalPlacement: totalLinks.some(Boolean) ? 8 : 0,
      totalReadings: totalLinks.filter(Boolean).length,
      intervals: gapLinks.filter(Boolean).length * 6
    };
    process.points = process.setup + process.totalPlacement + process.totalReadings + process.intervals;
    process.items = [
      resultItem("setup", "拍攝頻閃相片", process.setup ? "correct" : "no-evidence", process.setup ? "已完成" : "未有證據", "完成拍攝", "先完成並保存頻閃拍攝。", process.setup, 4),
      resultItem("total-placement", "總位移尺位", process.totalPlacement ? "correct" : "no-evidence", process.totalPlacement ? "有尺位證據" : "未有證據", "有效對準", "把零刻度對準 P0 並在有效尺位記錄讀數。", process.totalPlacement, 8),
      ...TOTAL_KEYS.map((key, index) => resultItem(`process-${key}`, `總位移讀數 ${index + 1} 尺位`, totalLinks[index] ? "correct" : "no-evidence",
        totalLinks[index] ? "有尺位證據" : "未有證據", "有效尺位連結", "在有效總位移尺位確認這個讀數。", totalLinks[index] ? 1 : 0, 1)),
      ...GAP_KEYS.map((key, index) => resultItem(`process-${key}`, `相鄰間隔 ${index + 1} 尺位`, gapLinks[index] ? "correct" : "no-evidence",
        gapLinks[index] ? "有尺位證據" : "未有證據", "重新對準並記錄", "每段都重新把零刻度對準較早的點。", gapLinks[index] ? 6 : 0, 6))
    ];
    const meaningfulRulerUse = totalPlacement && totalLinks.filter(Boolean).length >= 3 && gapLinks.filter(Boolean).length >= 3;
    const deltaCorrect = within(analysis.deltaTS, Model.deltaT(answer.frequencyHz), DELTA_T_ABS_TOLERANCE_S);
    const totalReadingCorrect = totals.map((value, index) => within(value, idealTotals[index], distanceTolerance(idealTotals[index])));
    const gapReadingCorrect = gaps.map((value, index) => within(value, idealGaps[index], distanceTolerance(idealGaps[index])));
    const cumulative = scoreTimeRatioV3(analysis.cumulativeTimeRatio, [1, 2, 3, 4], "cumulative-time", "累積時間比");
    const interval = scoreTimeRatioV3(analysis.intervalTimeRatio, [1, 1, 1, 1], "interval-time", "每段時間比");
    const quantitativeItems = [
      resultItem("delta-t", "相鄰影像時間 Δt", answerStatus(analysis.deltaTS, deltaCorrect), analysis.deltaTS,
        Model.deltaT(answer.frequencyHz), `使用 Δt = 1/f；容差 ±${DELTA_T_ABS_TOLERANCE_S} s。`, deltaCorrect ? 4 : 0, 4),
      ...TOTAL_KEYS.map((key, index) => resultItem(key, `P0→P${index + 1} 總位移`,
        answerStatus(totals[index], totalReadingCorrect[index]), totals[index], idealTotals[index],
        "重新讀取相片尺；相片厘米容差如結果卡所示。", totalReadingCorrect[index] ? 2 : 0, 2)),
      ...GAP_KEYS.map((key, index) => resultItem(key, `P${index}P${index + 1} 相鄰間隔`,
        answerStatus(gaps[index], gapReadingCorrect[index]), gaps[index], idealGaps[index],
        "重新讀取相鄰兩點；相片厘米容差如結果卡所示。", gapReadingCorrect[index] ? 2 : 0, 2)),
      ...cumulative.items, ...interval.items
    ];
    const quantitative = {
      deltaT: deltaCorrect ? 4 : 0,
      totalReadings: totalReadingCorrect.filter(Boolean).length * 2,
      gapReadings: gapReadingCorrect.filter(Boolean).length * 2,
      ratios: stablePoints(cumulative.points + interval.points),
      items: quantitativeItems
    };
    quantitative.points = stablePoints(quantitativeItems.reduce((sum, item) => sum + item.points, 0));
    const lawDefs = [
      ["lawAnswerId", "displacement", "總位移與時間", CONCEPT_ANSWERS.lawAnswerId, 12, "總位移由起點量度，應符合 s∝t²。"],
      ["intervalLawAnswerId", "intervals", "相鄰間隔規律", CONCEPT_ANSWERS.intervalLawAnswerId, 10, "相等時間內位移按 1:3:5:7 增加。"],
      ["accelerationAnswerId", "acceleration", "自由落體原因", CONCEPT_ANSWERS.accelerationAnswerId, 8, "固定加速度令速度每段增加相同數值。"]
    ];
    const lawItems = lawDefs.map(([key, id, label, expected, max, guidance]) => {
      const correct = analysis[key] === expected;
      return resultItem(id, label, answerStatus(analysis[key], correct), analysis[key], expected, guidance, correct ? max : 0, max);
    });
    const laws = Object.fromEntries(lawDefs.map(([, id], index) => [id, lawItems[index].points]));
    laws.points = lawItems.reduce((sum, item) => sum + item.points, 0); laws.items = lawItems;
    const rawScore = Math.max(0, Math.min(100, process.points + quantitative.points + laws.points));
    const score = Math.round(meaningfulRulerUse ? rawScore : Math.min(rawScore, 59));
    return {
      score, rawScore, maxScore: 100, passed: score >= PASS_SCORE, completed: true, meaningfulRulerUse,
      capApplied: !meaningfulRulerUse && rawScore > 59,
      detail: { process, quantitative, laws, totalLinks, gapLinks, totalReadingCorrect, gapReadingCorrect,
        ratios: { cumulativeTime: cumulative, intervalTime: interval },
        informationalDistanceSeries: { totals, gaps } },
      feedback: score === 100 ? "你已用直尺證據連結等時間頻閃、平方總位移與連續奇數間隔。" :
        meaningfulRulerUse ? "請對照每張卡的建議修正答案。" : "直尺證據未同時涵蓋兩類量度，總分上限為 59 分。"
    };
  }
  function scoreAttempt(answer) {
    if (answer?.rubricVersion === LEGACY_RUBRIC_VERSION) return scoreAttemptV2(answer);
    if (answer?.rubricVersion === RUBRIC_VERSION) return scoreAttemptV3(answer);
    throw new Error("Unsupported free-fall rubric version");
  }

  function measurementDiagnostic(answer, result) {
    const detail = result.detail;
    const correctTotalsWithoutEvidence = detail.totalReadingCorrect.filter((correct, index) => correct && !detail.totalLinks[index]).length;
    const correctGapsWithoutEvidence = detail.gapReadingCorrect.filter((correct, index) => correct && !detail.gapLinks[index]).length;
    const messages = [];
    if (correctTotalsWithoutEvidence || correctGapsWithoutEvidence) {
      messages.push(`有 ${correctTotalsWithoutEvidence + correctGapsWithoutEvidence} 個正確讀數未連結有效尺位；答案分保留，但不取得相應操作分。`);
    }
    if (!result.meaningfulRulerUse) messages.push("有效總位移讀數及相鄰間隔證據未同時達到各三項，總分上限為 59 分。");
    if (answer.analysis.lawAnswerId === "square" && answer.analysis.intervalLawAnswerId !== "odd") {
      messages.push("你辨認了總位移的平方比；相鄰間隔比較的是連續兩點之差，理想比為 1:3:5:7。");
    }
    if (answer.analysis.intervalLawAnswerId === "odd" && answer.analysis.lawAnswerId !== "square") {
      messages.push("你辨認了相鄰間隔的連續奇數比；由起點起計的總位移理想比為 1:4:9:16。");
    }
    return messages;
  }

  return {
    RUBRIC_VERSION, LEGACY_RUBRIC_VERSION, PASS_SCORE, DELTA_T_ABS_TOLERANCE_S, RATIO_TERM_TOLERANCE,
    MIN_MEANINGFUL_MOVE_NORM, ZERO_ALIGNMENT_TOLERANCE_PX, MIN_ZERO_TICK_OVERLAP_PX,
    ZERO_TICK_LENGTH_PX, HORIZONTAL_CANONICAL_TOLERANCE, GUIDE_X1, GUIDE_X2,
    RULER_GEOMETRY_FIXED_LEFT,
    LEGACY_EDGE_MIN_GAP_PX, LEGACY_EDGE_MAX_GAP_PX, TOTAL_KEYS, GAP_KEYS, CONCEPT_ANSWERS, distanceTolerance,
    within, validCurrentHorizontalRelation, validPlacement, validLegacyPlacement, totalPlacementValid, gapEvidenceValid, ratioTarget, scoreRatio,
    expectedTotals, expectedGaps, scoreAttempt, scoreAttemptV2, scoreAttemptV3, measurementDiagnostic
  };
});
