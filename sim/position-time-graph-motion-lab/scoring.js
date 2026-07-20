(function (root, factory) {
  const api = factory(() => typeof module === "object" && module.exports ? require("./generator.js") : root?.PositionTimeGenerator);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PositionTimeScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (getGenerator) {
  "use strict";

  const LIMITS = Object.freeze({ timeMin: 0, timeMax: 6, positionMin: -20, positionMax: 20, x0Min: -8, x0Max: 8, velocityMin: -2, velocityMax: 2 });
  const TOLERANCE = Object.freeze({ position: 0.5, graphPoint: 0.5, velocity: 0.1, stationary: 0.05, probeTime: 2, meetingPosition: 0.5, meetingTime: 0.2 });
  const LIBRARY_VERSION = 1;
  const SCENARIO_SETS = Object.freeze({
    alpha: freezeSet({
      m1: { type: "target", x0: -6, v: 2 },
      m2: { type: "draw", x0: 4, v: -1 },
      m3: { type: "measure", A: { x0: 6, v: 1 }, B: { x0: -4, v: 2 } },
      m4: { type: "special", x0: 5, v: 0, atTime: 6, atPosition: 5 },
      m5: { type: "meet", A: { x0: -4, v: 2 }, meetTime: 3, exampleB: { x0: 8, v: -2 } }
    }),
    beta: freezeSet({
      m1: { type: "target", x0: 8, v: -2 },
      m2: { type: "draw", x0: -6, v: 1 },
      m3: { type: "measure", A: { x0: -6, v: -2 }, B: { x0: 4, v: 1 } },
      m4: { type: "special", x0: 8, v: -2, atTime: 4, atPosition: 0 },
      m5: { type: "meet", A: { x0: 4, v: -1 }, meetTime: 4, exampleB: { x0: -8, v: 2 } }
    }),
    gamma: freezeSet({
      m1: { type: "target", x0: -4, v: 1 },
      m2: { type: "draw", x0: 2, v: 2 },
      m3: { type: "measure", A: { x0: -8, v: 1 }, B: { x0: 6, v: -1 } },
      m4: { type: "special", x0: -6, v: 2, atTime: 4, atPosition: 2 },
      m5: { type: "meet", A: { x0: 6, v: -2 }, meetTime: 3, exampleB: { x0: -6, v: 2 } }
    })
  });

  function freezeSet(set) {
    Object.values(set).forEach((scenario) => {
      if (scenario.A) Object.freeze(scenario.A);
      if (scenario.B) Object.freeze(scenario.B);
      if (scenario.exampleB) Object.freeze(scenario.exampleB);
      Object.freeze(scenario);
    });
    return Object.freeze(set);
  }

  function positionAt(motion, time) { return motion.x0 + motion.v * time; }
  function nearly(value, target, tolerance) { return Number.isFinite(value) && Math.abs(value - target) <= tolerance + Number.EPSILON * 8; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function velocityFromPoints(first, second) {
    if (!first || !second || ![first.t, first.x, second.t, second.x].every(Number.isFinite)) return null;
    const dt = second.t - first.t;
    return Math.abs(dt) < 1e-12 ? null : (second.x - first.x) / dt;
  }
  function intersection(a, b) {
    if (![a?.x0, a?.v, b?.x0, b?.v].every(Number.isFinite)) return { kind: "invalid" };
    if (Math.abs(a.v - b.v) < 1e-12) return Math.abs(a.x0 - b.x0) < 1e-12 ? { kind: "coincident" } : { kind: "parallel" };
    const time = (b.x0 - a.x0) / (a.v - b.v);
    return { kind: "point", time, position: positionAt(a, time) };
  }
  function lineWithinBounds(motion) {
    return finiteMotion(motion, LIMITS.x0Min, LIMITS.x0Max) && [0, LIMITS.timeMax].every((time) => {
      const x = positionAt(motion, time);
      return x >= LIMITS.positionMin && x <= LIMITS.positionMax;
    });
  }
  function finiteMotion(motion, xMin = LIMITS.positionMin, xMax = LIMITS.positionMax) {
    return Boolean(motion && Number.isFinite(motion.x0) && Number.isFinite(motion.v) && motion.x0 >= xMin && motion.x0 <= xMax && motion.v >= LIMITS.velocityMin && motion.v <= LIMITS.velocityMax);
  }
  function getScenarioSet(version, id) { return version === LIBRARY_VERSION && SCENARIO_SETS[id] ? SCENARIO_SETS[id] : null; }
  function scenarioIds() { return Object.keys(SCENARIO_SETS); }

  function blankAnswers() {
    return { m1: {}, m2: {}, m3: { A: { probes: [] }, B: { probes: [] } }, m4: {}, m5: {} };
  }

  function validAnswerShape(key, answer) {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
    if (key === "m1" || key === "m4") return optionalNumber(answer.x0, LIMITS.x0Min, LIMITS.x0Max) && optionalNumber(answer.v, LIMITS.velocityMin, LIMITS.velocityMax) && onlyKeys(answer, ["x0", "v"]);
    if (key === "m2") return optionalNumber(answer.xStart, LIMITS.positionMin, LIMITS.positionMax) && optionalNumber(answer.xEnd, LIMITS.positionMin, LIMITS.positionMax) && onlyKeys(answer, ["xStart", "xEnd"]);
    if (key === "m3") return validMeasureLine(answer.A) && validMeasureLine(answer.B) && (answer.faster == null || ["A", "B", "same"].includes(answer.faster)) && onlyKeys(answer, ["A", "B", "faster"]);
    if (key === "m5") return optionalNumber(answer.x0B, LIMITS.x0Min, LIMITS.x0Max) && optionalNumber(answer.vB, LIMITS.velocityMin, LIMITS.velocityMax) && optionalNumber(answer.meetingX, LIMITS.positionMin, LIMITS.positionMax) && onlyKeys(answer, ["x0B", "vB", "meetingX"]);
    return false;
  }
  function optionalNumber(value, min, max) { return value == null || (Number.isFinite(value) && value >= min && value <= max); }
  function onlyKeys(value, keys) { return Object.keys(value).every((key) => keys.includes(key)); }
  function validMeasureLine(line) {
    return Boolean(line && typeof line === "object" && !Array.isArray(line) && onlyKeys(line, ["probes", "velocity"]) && Array.isArray(line.probes) && line.probes.length <= 2 && line.probes.every((time) => Number.isFinite(time) && time >= 0 && time <= LIMITS.timeMax) && optionalNumber(line.velocity, LIMITS.velocityMin, LIMITS.velocityMax));
  }
  function validAnswers(answers) {
    return Boolean(answers && !Array.isArray(answers) && Object.keys(answers).length === 5 && ["m1", "m2", "m3", "m4", "m5"].every((key) => validAnswerShape(key, answers[key])));
  }

  function completeness(key, answer) {
    if (!validAnswerShape(key, answer)) return "invalid";
    const populated = hasAny(answer);
    if (!populated) return "empty";
    if ((key === "m1" || key === "m4") && Number.isFinite(answer.x0) && Number.isFinite(answer.v)) return "complete";
    if (key === "m2" && Number.isFinite(answer.xStart) && Number.isFinite(answer.xEnd)) return "complete";
    if (key === "m3" && validMeasurement(answer.A) && validMeasurement(answer.B) && Number.isFinite(answer.A.velocity) && Number.isFinite(answer.B.velocity) && answer.faster) return "complete";
    if (key === "m5" && Number.isFinite(answer.x0B) && Number.isFinite(answer.vB) && Number.isFinite(answer.meetingX)) return "complete";
    return "partial";
  }
  function hasAny(value) {
    return Object.entries(value).some(([, item]) => Array.isArray(item) ? item.length : item && typeof item === "object" ? hasAny(item) : item != null);
  }
  function validMeasurement(line) { return line?.probes?.length === 2 && Math.abs(line.probes[1] - line.probes[0]) >= TOLERANCE.probeTime; }

  function scoreAssessment(assessment) {
    const set = scenariosForScoring(assessment);
    const answers = assessment?.ans;
    if (!set || !validAnswers(answers)) return null;
    const detail = [scoreMotion("m1", answers.m1, set.m1), scoreGraph(answers.m2, set.m2), scoreMeasure(answers.m3, set.m3), scoreMotion("m4", answers.m4, set.m4), scoreMeeting(answers.m5, set.m5)];
    return resultFrom(detail);
  }
  function scenariosForScoring(assessment) {
    if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) return null;
    const keys = Object.keys(assessment).sort().join(",");
    if (keys === "ans,lv,seen,sid") return getScenarioSet(assessment.lv, assessment.sid);
    if (keys !== "ans,gv,paper,seed,seen") return null;
    const Generator = getGenerator?.();
    return Generator && assessment.gv === Generator.GENERATOR_VERSION && Generator.matchesSeed(assessment.seed, assessment.paper) ? assessment.paper.missions : null;
  }
  function resultFrom(detail) {
    const score = clamp(detail.reduce((sum, item) => sum + item.score, 0), 0, 100);
    return { score, maxScore: 100, passed: score >= 60, completed: true, detail, feedback: score >= 60 ? "你已掌握位置—時間圖的主要關係。" : "再檢視截距、斜率、方向與相遇條件。" };
  }
  function component(name, points, earned, feedback) { return { name, points, earned: earned ? points : 0, feedback }; }
  function mission(key, components) { return { key, score: components.reduce((sum, item) => sum + item.earned, 0), maxScore: 20, components }; }
  function scoreMotion(key, answer, target) {
    const positionOk = nearly(answer.x0, target.x0, TOLERANCE.position);
    const velocityTolerance = target.v === 0 ? TOLERANCE.stationary : TOLERANCE.velocity;
    const velocityOk = nearly(answer.v, target.v, velocityTolerance);
    const velocityFeedback = velocityOk ? "速度大小和方向符合要求。" : target.v === 0 ? "水平線表示時間繼續而位置不變，因此速度為零。" : Number.isFinite(answer.v) && Math.sign(answer.v) === -Math.sign(target.v) ? "速度方向相反；負斜率表示位置隨時間減少。" : "圖線斜率不同，表示速度仍需調整。";
    return mission(key, [component("初始位置", 8, positionOk, positionOk ? "初始位置符合要求。" : "車在 t = 0 的位置不符合目標。"), component("速度", 12, velocityOk, velocityFeedback)]);
  }
  function scoreGraph(answer, target) {
    const slope = Number.isFinite(answer.xStart) && Number.isFinite(answer.xEnd) ? (answer.xEnd - answer.xStart) / 6 : null;
    return mission("m2", [component("圖線起點", 8, nearly(answer.xStart, target.x0, TOLERANCE.graphPoint), "圖線在 t = 0 的截距要對應初始位置。"), component("圖線斜率", 12, nearly(slope, target.v, TOLERANCE.velocity), "終點和起點的變化決定斜率，即速度。")]);
  }
  function scoreMeasure(answer, target) {
    const aOk = validMeasurement(answer.A) && nearly(answer.A.velocity, target.A.v, TOLERANCE.velocity);
    const bOk = validMeasurement(answer.B) && nearly(answer.B.velocity, target.B.v, TOLERANCE.velocity);
    const expected = Math.abs(target.A.v) === Math.abs(target.B.v) ? "same" : Math.abs(target.A.v) > Math.abs(target.B.v) ? "A" : "B";
    const compareOk = validMeasurement(answer.A) && validMeasurement(answer.B) && answer.faster === expected;
    return mission("m3", [component("A 車量度", 7, aOk, aOk ? "A 車量度與計算正確。" : measurementFeedback(answer.A)), component("B 車量度", 7, bOk, bOk ? "B 車量度與計算正確。" : measurementFeedback(answer.B)), component("速度大小比較", 6, compareOk, compareOk ? "速度大小比較正確。" : "請比較速度的絕對值；圖線較高不一定較快。")]);
  }
  function measurementFeedback(line) {
    if (!validMeasurement(line)) return "請在圖線上放置相隔至少 2.0 s 的兩個探針。";
    return "用 Δx/Δt 計算速度，並保留方向的正負號。";
  }
  function scoreMeeting(answer, target) {
    const b = { x0: answer.x0B, v: answer.vB };
    const crossing = intersection(target.A, b);
    const validB = finiteMotion(b, LIMITS.x0Min, LIMITS.x0Max) && lineWithinBounds(b);
    const timeOk = validB && crossing.kind === "point" && crossing.time >= LIMITS.timeMin && crossing.time <= LIMITS.timeMax && nearly(crossing.time, target.meetTime, TOLERANCE.meetingTime);
    const targetX = positionAt(target.A, target.meetTime);
    const positionOk = nearly(answer.meetingX, targetX, TOLERANCE.meetingPosition);
    const meetingFeedback = crossing.kind === "coincident" ? "兩條圖線全程重合，沒有形成指定時間的單一相遇點。" : timeOk ? "B 車在指定時間與 A 車相遇。" : "B 車仍未在指定時間與 A 車相遇。";
    return mission("m5", [component("相遇設定", 12, timeOk, meetingFeedback), component("相遇位置", 8, positionOk, positionOk ? "相遇位置讀取正確。" : "用時間游標讀取 A 車在指定時間的位置。")]);
  }

  function validateScenarioLibrary(library = SCENARIO_SETS) {
    const expectedTypes = ["target", "draw", "measure", "special", "meet"];
    const ids = library && typeof library === "object" && !Array.isArray(library) ? Object.keys(library) : [];
    if (ids.length < 3) return false;
    const allowedVelocity = [-2, -1, 1, 2];
    const comparisons = new Set();
    const meetingPositions = new Set();
    const allVelocities = [];
    let hasHigherButSlower = false;
    let hasMission3Negative = false;
    let hasStationaryMission4 = false;
    const setupX0 = (value) => Number.isInteger(value) && value >= LIMITS.x0Min && value <= LIMITS.x0Max;
    const valid = ids.every((id) => {
      const set = library[id];
      if (!set || typeof set !== "object" || Array.isArray(set) || Object.keys(set).sort().join(",") !== "m1,m2,m3,m4,m5") return false;
      const missions = [set.m1, set.m2, set.m3, set.m4, set.m5];
      if (!missions.every((item, index) => item && item.type === expectedTypes[index])) return false;
      if (!setupX0(set.m1.x0) || !allowedVelocity.includes(set.m1.v)) return false;
      if (!setupX0(set.m2.x0) || set.m2.x0 % 2 !== 0 || !allowedVelocity.includes(set.m2.v)) return false;
      if (![set.m3.A?.x0, set.m3.B?.x0].every((value) => setupX0(value) && value % 2 === 0) || set.m3.A.x0 === set.m3.B.x0 || ![set.m3.A.v, set.m3.B.v].every((value) => allowedVelocity.includes(value))) return false;
      if (!setupX0(set.m4.x0) || ![0, ...allowedVelocity].includes(set.m4.v) || !Number.isInteger(set.m4.atTime) || set.m4.atTime < 1 || set.m4.atTime > LIMITS.timeMax || !Number.isInteger(set.m4.atPosition) || positionAt(set.m4, set.m4.atTime) !== set.m4.atPosition) return false;
      if (![-6, -4, -2, 2, 4, 6].includes(set.m5.A?.x0) || !allowedVelocity.includes(set.m5.A?.v) || ![2, 3, 4, 5].includes(set.m5.meetTime)) return false;
      const motions = [set.m1, set.m2, set.m3.A, set.m3.B, set.m4, set.m5.A, set.m5.exampleB];
      if (!motions.every(lineWithinBounds)) return false;
      const example = intersection(set.m5.A, set.m5.exampleB);
      const meetingPosition = positionAt(set.m5.A, set.m5.meetTime);
      if (!finiteMotion(set.m5.exampleB, LIMITS.x0Min, LIMITS.x0Max) || !Number.isInteger(set.m5.exampleB.x0) || !Number.isInteger(set.m5.exampleB.v * 2) || example.kind !== "point" || !nearly(example.time, set.m5.meetTime, 1e-9) || !Number.isInteger(meetingPosition) || meetingPosition < -16 || meetingPosition > 16) return false;
      const comparison = Math.abs(set.m3.A.v) === Math.abs(set.m3.B.v) ? "same" : Math.abs(set.m3.A.v) > Math.abs(set.m3.B.v) ? "A" : "B";
      comparisons.add(comparison);
      meetingPositions.add(meetingPosition);
      allVelocities.push(...motions.map((motion) => motion.v));
      if ((set.m3.A.x0 > set.m3.B.x0 && Math.abs(set.m3.A.v) < Math.abs(set.m3.B.v)) || (set.m3.B.x0 > set.m3.A.x0 && Math.abs(set.m3.B.v) < Math.abs(set.m3.A.v))) hasHigherButSlower = true;
      if (set.m3.A.v < 0 || set.m3.B.v < 0) hasMission3Negative = true;
      if (set.m4.v === 0 && set.m4.atTime === LIMITS.timeMax && set.m4.atPosition === set.m4.x0) hasStationaryMission4 = true;
      return true;
    });
    return valid && ["A", "B", "same"].every((value) => comparisons.has(value)) && hasHigherButSlower && hasMission3Negative && hasStationaryMission4 && meetingPositions.size >= 2 && allVelocities.some((value) => value > 0) && allVelocities.some((value) => value < 0) && allVelocities.includes(0);
  }

  return { LIMITS, TOLERANCE, LIBRARY_VERSION, SCENARIO_SETS, positionAt, velocityFromPoints, intersection, lineWithinBounds, getScenarioSet, scenarioIds, blankAnswers, validAnswerShape, validAnswers, completeness, validMeasurement, scoreAssessment, validateScenarioLibrary };
});
