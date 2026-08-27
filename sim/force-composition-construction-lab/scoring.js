(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.ForceCompositionModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceCompositionScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";

  if (!Model) throw new Error("ForceCompositionModel is required");
  const MAX_SCORE = 100;
  const PASS_SCORE = 60;

  function component(key, label, points, earned) {
    return { key, label, points, earned: earned ? points : 0, correct: Boolean(earned) };
  }

  function scoreParallelogram(answer, question) {
    const placements = answer.placements.map((placement) => placement.mode === "snap" && placement.targetKey === "ORIGIN");
    const guides = new Set(Model.correctGuides(answer, question).map((guide) => guide.originKey));
    const components = [
      component("F1-origin", "力矢量 F 一的箭尾在所選共同起點", 2, placements[0]),
      component("F2-origin", "力矢量 F 二的箭尾在所選共同起點", 2, placements[1]),
      component("F1-guide", "由力矢量 F 一箭頭畫出的虛線輔助線", 4, guides.has("F1_HEAD")),
      component("F2-guide", "由力矢量 F 二箭頭畫出的虛線輔助線", 4, guides.has("F2_HEAD")),
      component("resultant", "由作圖起點指向平行四邊形對角頂點的合力", 8, Model.canonicalResultant(answer, question))
    ];
    return components;
  }

  function scoreHeadToTail(answer, question) {
    const chain = Model.chainInfo(answer, question);
    const components = [
      component("origin", "第一支力的箭尾在所選共同起點", 4, chain.valid && chain.order.length >= 1),
      component("junction", "兩個力有效首尾相接", 4, chain.valid && chain.order.length >= 2),
      component("resultant", "合力由力鏈起點指向終點", 12, Model.canonicalResultant(answer, question))
    ];
    return components;
  }

  function scoreTriple(answer, question) {
    const chain = Model.chainInfo(answer, question);
    return [
      component("origin", "第一支力的箭尾在所選共同起點", 2, chain.valid && chain.order.length >= 1),
      component("junction-1", "第一個有效首尾接點", 4, chain.valid && chain.order.length >= 2),
      component("junction-2", "第二個有效接點並完成三力單一路徑", 4, chain.valid && chain.order.length >= 3),
      component("resultant", "合力由三力鏈起點指向終點", 10, Model.canonicalResultant(answer, question))
    ];
  }

  function questionDetail(answer, question, index) {
    const components = question.type === "parallelogram" ? scoreParallelogram(answer, question)
      : question.type === "head-to-tail-2" ? scoreHeadToTail(answer, question) : scoreTriple(answer, question);
    const score = components.reduce((total, item) => total + item.earned, 0);
    return { id: question.id, index, type: question.type, score, maxScore: 20, complete: Model.questionComplete(answer, question), components };
  }

  function feedbackFor(detail) {
    const missing = detail.components.filter((item) => !item.correct).map((item) => item.label);
    if (!missing.length) return `${detail.id}：作圖完整，合力位置正確。`;
    const correct = detail.components.filter((item) => item.correct).map((item) => item.label);
    if (!correct.length) return `${detail.id}：未建立可計分的作圖關係。`;
    return `${detail.id}：已完成${correct.join("、")}；仍欠${missing.join("、")}。`;
  }

  function score(state, scenario) {
    if (!state || !Array.isArray(state.answers) || state.answers.length !== scenario?.questions?.length) throw new Error("A complete five-question state is required");
    const detail = state.answers.map((answer, index) => questionDetail(answer, scenario.questions[index], index));
    const raw = detail.reduce((total, item) => total + item.score, 0);
    const total = Math.max(0, Math.min(MAX_SCORE, raw));
    const feedbackItems = detail.map(feedbackFor);
    return {
      score: total,
      maxScore: MAX_SCORE,
      passed: total >= PASS_SCORE,
      completed: true,
      detail,
      feedbackItems,
      feedback: feedbackItems.join(" ")
    };
  }

  return Object.freeze({ MAX_SCORE, PASS_SCORE, component, scoreParallelogram, scoreHeadToTail, scoreTriple, questionDetail, feedbackFor, score });
});
