(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsQuantitativeQuestions = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const QUESTION_SET_VERSION = 1;
  const GRAPH_TYPES = Object.freeze(["x", "v", "a"]);
  const GRAPH_LABELS = Object.freeze({ x: "位置—時間圖 x–t", v: "速度—時間圖 v–t", a: "加速度—時間圖 a–t" });
  const UNITS = Object.freeze({ x: "m", v: "m/s", a: "m/s²" });
  const PAPERS = Object.freeze({
    A: [[0, 5, 0, 4], [0, 0, 2, 4], [2, 2, 1, 4], [0, 8, -2, 4]],
    B: [[4, 3, 0, 6], [2, 0, 2, 6], [0, 3, 2, 6], [4, 12, -2, 6]],
    C: [[2, 4, 0, 4], [4, 0, 1, 4], [4, 1, 2, 4], [2, 4, -1, 4]],
    D: [[6, 2, 0, 6], [0, 0, 2, 6], [2, 2, 2, 6], [0, 12, -2, 6]],
    E: [[3, 5, 0, 4], [6, 0, 1, 4], [0, 4, 1, 4], [5, 8, -2, 4]],
    F: [[5, 3, 0, 4], [2, 0, 2, 6], [6, 2, 2, 4], [2, 12, -2, 6]]
  });
  const MISSION_TYPES = Object.freeze(["uniform", "from-rest", "accelerating", "decelerating"]);
  const TASKS = Object.freeze(MISSION_TYPES.flatMap((missionType, missionIndex) => GRAPH_TYPES.map((graphType) => ({
    id: `${missionIndex + 1}-${graphType}`, missionIndex, graphType, missionType
  }))));

  function valueAt(question, kind, t) {
    if (kind === "x") return question.x0 + question.v0 * t + 0.5 * question.a * t * t;
    if (kind === "v") return question.v0 + question.a * t;
    return question.a;
  }

  function controlTimes(question, graphType) {
    return graphType === "x" && question.a !== 0 ? [0, question.T / 2, question.T] : [0, question.T];
  }

  function targetValues(question, graphType) {
    return controlTimes(question, graphType).map((time) => valueAt(question, graphType, time));
  }

  function axisFor(question, graphType) {
    const values = targetValues(question, graphType);
    if (graphType === "x") return { min: 0, max: Math.max(20, Math.ceil((Math.max(...values) + 4) / 10) * 10), step: 1 };
    if (graphType === "v") return { min: -4, max: Math.max(10, Math.ceil((Math.max(...values) + 2) / 5) * 5), step: 1 };
    return { min: -3, max: 3, step: 1 };
  }

  function missionPrompt(question, index) {
    const prefix = `第 ${index + 1} 關：`;
    if (index === 0) return `${prefix}物體在 t=0 時位於 x=${question.x0} m，其後以固定速度 ${question.v0} m/s 向正方向運動 ${question.T} s。建立三幅圖。`;
    if (index === 1) return `${prefix}物體在 t=0 時位於 x=${question.x0} m，並由靜止開始，以固定正加速度 ${question.a} m/s² 運動 ${question.T} s。建立三幅圖。`;
    if (index === 2) return `${prefix}物體在 t=0 時位於 x=${question.x0} m，已有正初速度 ${question.v0} m/s，以固定正加速度 ${question.a} m/s² 運動 ${question.T} s。建立三幅圖。`;
    return `${prefix}物體在 t=0 時位於 x=${question.x0} m，以正初速度 ${question.v0} m/s 運動，並以固定負加速度 ${question.a} m/s² 勻減速；在 ${question.T} s 剛好停止，不反向。`;
  }

  function paper(paperId) {
    const rows = Object.hasOwn(PAPERS, paperId) ? PAPERS[paperId] : null;
    if (!Array.isArray(rows)) return null;
    return rows.map((row, index) => {
      const [x0, v0, a, T] = row;
      const question = Object.freeze({ paperId, missionIndex: index, missionType: MISSION_TYPES[index], x0, v0, a, T });
      return Object.freeze({ ...question, prompt: missionPrompt(question, index) });
    });
  }

  function taskIndex(missionIndex, graphType) { return missionIndex * 3 + GRAPH_TYPES.indexOf(graphType); }
  function taskFor(index) { return TASKS[index] || null; }
  function taskDefinition(paperId, index) {
    const task = taskFor(index); const questions = paper(paperId);
    if (!task || !questions) return null;
    const question = questions[task.missionIndex];
    return Object.freeze({ ...task, question, times: controlTimes(question, task.graphType), targets: targetValues(question, task.graphType), axis: axisFor(question, task.graphType) });
  }

  function validatePaper(paperId) {
    const questions = paper(paperId);
    if (!questions || questions.length !== 4 || !/^[A-F]$/.test(paperId)) return false;
    return questions.every((question, index) => {
      if (![question.x0, question.v0, question.a, question.T].every(Number.isFinite) || ![4, 6].includes(question.T) || !Number.isInteger(question.T / 2)) return false;
      if (index === 0 && !(question.a === 0 && question.v0 > 0)) return false;
      if (index === 1 && !(question.v0 === 0 && question.a > 0)) return false;
      if (index === 2 && !(question.v0 > 0 && question.a > 0)) return false;
      if (index === 3 && !(question.v0 > 0 && question.a < 0 && valueAt(question, "v", question.T) === 0)) return false;
      for (const type of GRAPH_TYPES) {
        const values = targetValues(question, type); const axis = axisFor(question, type);
        if (!values.every(Number.isSafeInteger) || values.some((value) => value < axis.min || value > axis.max)) return false;
        if (type === "x" && axis.max > 60) return false;
        if (type === "v" && axis.max > 20) return false;
      }
      for (let t = 0; t <= question.T; t += 0.5) {
        const x = valueAt(question, "x", t); const v = valueAt(question, "v", t);
        if (!(x >= 0 && x <= 60 && v >= 0 && v <= 15)) return false;
      }
      return true;
    });
  }

  function validateQuestionSet() {
    const ids = Object.keys(PAPERS);
    return ids.length === 6 && new Set(ids).size === ids.length && ids.every(validatePaper);
  }

  function choosePaper(random = null) {
    const ids = Object.keys(PAPERS);
    let index = 0;
    if (typeof random === "function") index = Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * ids.length);
    else if (typeof crypto !== "undefined" && crypto.getRandomValues) { const data = new Uint32Array(1); crypto.getRandomValues(data); index = data[0] % ids.length; }
    else index = Math.floor(Math.random() * ids.length);
    return ids[index];
  }

  return { QUESTION_SET_VERSION, GRAPH_TYPES, GRAPH_LABELS, UNITS, PAPERS, MISSION_TYPES, TASKS, valueAt, controlTimes, targetValues, axisFor, paper, taskIndex, taskFor, taskDefinition, validatePaper, validateQuestionSet, choosePaper };
});
