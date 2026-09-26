(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.EquilibriumModel,
    typeof module === "object" && module.exports ? require("./generator.js") : root.EquilibriumGenerator);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquilibriumScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, G) {
  "use strict";
  const DIRECTION_TOLERANCE = 10;
  function questionScore(records, question) {
    if (!M.validAnswer(records)) throw new Error("Invalid learner records");
    let best = { matches: [], directionCount: -1, typeCount: -1 };
    function search(index, used, matches, directionCount) {
      if (index === question.expected.length) {
        if (matches.length > best.typeCount || (matches.length === best.typeCount && directionCount > best.directionCount))
          best = { matches: matches.slice(), typeCount: matches.length, directionCount };
        return;
      }
      search(index + 1, used, matches, directionCount);
      const expected = question.expected[index];
      records.forEach((record, i) => {
        if (used.has(i) || record[0] !== expected.kind) return;
        const correct = record[1] !== null && M.angleDelta(record[1] / 10, expected.angle) <= DIRECTION_TOLERANCE + 1e-9;
        used.add(i); matches.push({ expected: index, record: i, correct });
        search(index + 1, used, matches, directionCount + Number(correct));
        matches.pop(); used.delete(i);
      });
    }
    search(0, new Set(), [], 0);
    const extra = records.map((_, i) => i).filter(i => !best.matches.some(m => m.record === i));
    const missing = question.expected.map((_, i) => i).filter(i => !best.matches.some(m => m.expected === i));
    return { family: question.family, score: M.clamp((8 * best.typeCount + 12 * best.directionCount - 20 * extra.length) / question.expected.length, 0, 20),
      maxScore: 20, matches: best.matches, missing, extra, typeCount: best.typeCount, directionCount: best.directionCount };
  }
  function score(state) {
    if (state.rubricVersion !== 1 || !Array.isArray(state.answers) || state.answers.length !== 5) throw new Error("Unsupported rubric or answers");
    const scenario = G.generate(state.seed, state.generatorVersion);
    const detail = scenario.questions.map((q, i) => questionScore(state.answers[i], q));
    const total = detail.reduce((s, d) => s + d.score, 0);
    return { score: total, maxScore: 100, passed: total >= 60, completed: true, detail, feedback: "依外力種類及方向評分；箭長不計分。" };
  }
  return Object.freeze({ DIRECTION_TOLERANCE, questionScore, score });
});
