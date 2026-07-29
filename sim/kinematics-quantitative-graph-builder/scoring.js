(function (root, factory) {
  const questions = typeof module === "object" && module.exports ? require("./question-definitions.js") : root.KinematicsQuantitativeQuestions;
  const model = typeof module === "object" && module.exports ? require("./graph-model.js") : root.KinematicsQuantitativeModel;
  const api = factory(questions, model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsQuantitativeScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Questions, Model) {
  "use strict";
  const MAX_SCORE = 100;
  const PASS_SCORE = 70;
  const GRAPH_MAX = Object.freeze({ x: 40, v: 32, a: 28 });
  const GRAPH_FLOOR = Object.freeze({ x: 20, v: 16, a: 14 });
  const COMPONENTS = Object.freeze({ x2: [5, 5], x3: [3, 3, 4], v: [4, 4], a: [3.5, 3.5] });
  const nearly = (a, b) => Math.abs(a - b) < 1e-9;
  function graphComponents(definition) { if (definition.graphType === "x") return definition.times.length === 2 ? COMPONENTS.x2 : COMPONENTS.x3; return COMPONENTS[definition.graphType]; }
  function scoreGraph(definition, answer) {
    const target = definition.targets; const values = Array.isArray(answer) ? answer : [];
    const components = graphComponents(definition).map((points, index) => ({ index, points, correct: values[index] === target[index], student: values[index] ?? null, target: target[index] }));
    const score = components.reduce((total, part) => total + (part.correct ? part.points : 0), 0);
    return { score, maxScore: components.reduce((total, part) => total + part.points, 0), components, complete: Model.isComplete(answer, definition) };
  }
  function feedbackFor(definition, graph) {
    const missing = graph.components.filter((part) => part.student === null);
    if (missing.length) return ["這個控制點仍未設定，因此本部分沒有可評分答案。"];
    const wrong = graph.components.filter((part) => !part.correct);
    if (!wrong.length) return ["所有控制點正確。"];
    const messages = [];
    if (wrong.some((part) => part.index === 0)) messages.push("你的圖線在 t=0 的初值與題目不符。先檢查初始位置、初速度或加速度。");
    const midpointWrong = definition.graphType === "x" && definition.times.length === 3 && wrong.some((part) => part.index === 1);
    const endpointWrong = graph.components.find((part) => part.index === 2); const acceleration = definition.question.a; const omittedHalfDirection = midpointWrong && endpointWrong && ((acceleration > 0 && graph.components[1].student > graph.components[1].target && endpointWrong.student > endpointWrong.target) || (acceleration < 0 && graph.components[1].student < graph.components[1].target && endpointWrong.student < endpointWrong.target));
    if (omittedHalfDirection) messages.push("你的中間及終點位置都偏離題目；代入位置公式時要保留 ½at²。");
    else if (midpointWrong) messages.push("中間控制點錯誤會建立另一條二次曲線；請重新代入題目的位置公式。 ");
    if (definition.question.missionType === "decelerating" && definition.graphType === "v" && wrong.some((part) => part.index === 1)) messages.push("物體在 T 剛好停止，所以 v(T)=0。");
    if (definition.question.missionType === "decelerating" && definition.graphType === "a" && wrong.some((part) => part.student >= 0)) messages.push("題目是勻減速，a–t 圖應在零軸下方。");
    if (!messages.length) messages.push("檢查題目數據、單位和固定時間的計算。 ");
    return messages.slice(0, 2);
  }
  function crossDiagnostic(paperId, answers, missionIndex) {
    const x = Questions.taskDefinition(paperId, missionIndex * 3); const v = Questions.taskDefinition(paperId, missionIndex * 3 + 1); const a = Questions.taskDefinition(paperId, missionIndex * 3 + 2);
    const xp = Model.impliedParameters(x, answers[missionIndex * 3]); const vp = Model.impliedParameters(v, answers[missionIndex * 3 + 1]); const ap = Model.impliedParameters(a, answers[missionIndex * 3 + 2]);
    if (ap && ap.a0 !== ap.aT) return `你的 a–t 圖兩端不同（${ap.a0} 至 ${ap.aT} m/s²），代表加速度隨時間改變，不符合本題的勻變速。`;
    if (xp && vp && Number.isFinite(xp.a) && Number.isFinite(vp.a) && !nearly(xp.a, vp.a)) return `你的 x–t 曲率表示 a=${xp.a} m/s²，但 v–t 圖斜率表示 a=${vp.a} m/s²。`;
    if (xp && ap && Number.isFinite(xp.a) && Number.isFinite(ap.a0) && !nearly(xp.a, ap.a0)) return `你的 x–t 曲率表示 a=${xp.a} m/s²，但 a–t 圖設定為 ${ap.a0} m/s²。`;
    if (vp && ap && Number.isFinite(vp.a) && Number.isFinite(ap.a0) && !nearly(vp.a, ap.a0)) return `你的 v–t 圖斜率表示 a=${vp.a} m/s²，但 a–t 圖設定為 ${ap.a0} m/s²。`;
    if (xp && vp && Number.isFinite(xp.v0) && Number.isFinite(vp.v0) && !nearly(xp.v0, vp.v0)) return `你的 x–t 圖初始斜率表示 v₀=${xp.v0} m/s，但 v–t 圖起點是 ${vp.v0} m/s。`;
    return null;
  }
  function scoreActivity(paperId, answers) {
    const safeAnswers = Array.isArray(answers) && answers.length === 12 ? answers : Array(12).fill(null);
    const details = Questions.TASKS.map((task, index) => {
      const definition = Questions.taskDefinition(paperId, index); const graph = definition ? scoreGraph(definition, safeAnswers[index]) : { score: 0, maxScore: 0, components: [], complete: false };
      return { ...task, ...graph, feedback: definition ? feedbackFor(definition, graph) : [] };
    });
    const families = { x: 0, v: 0, a: 0 }; const missions = [0, 0, 0, 0];
    details.forEach((detail) => { families[detail.graphType] += detail.score; missions[detail.missionIndex] += detail.score; });
    const rawScore = Math.max(0, Math.min(MAX_SCORE, details.reduce((total, detail) => total + detail.score, 0)));
    const positiveComplete = [1, 2].some((mission) => [0, 1, 2].every((offset) => details[mission * 3 + offset].score === details[mission * 3 + offset].maxScore));
    const decelerationComplete = [0, 1, 2].every((offset) => details[9 + offset].score === details[9 + offset].maxScore);
    const gates = { raw: rawScore >= PASS_SCORE, x: families.x >= GRAPH_FLOOR.x, v: families.v >= GRAPH_FLOOR.v, a: families.a >= GRAPH_FLOOR.a, missions: missions.every((score) => score >= 10), positiveComplete, decelerationComplete };
    const passed = Object.values(gates).every(Boolean);
    return { score: rawScore, maxScore: MAX_SCORE, passed, completed: true, details, families, missions, gates, diagnostics: [0, 1, 2, 3].map((mission) => crossDiagnostic(paperId, safeAnswers, mission)), evidenceIncompleteTaskIds: details.filter((detail) => !detail.complete).map((detail) => detail.id), feedback: passed ? "你已精確建立所有必要的定量圖像證據。" : "檢查每幅圖的固定時間控制點，並完成四個情境。" };
  }
  return { MAX_SCORE, PASS_SCORE, GRAPH_MAX, GRAPH_FLOOR, COMPONENTS, graphComponents, scoreGraph, feedbackFor, crossDiagnostic, scoreActivity };
});
