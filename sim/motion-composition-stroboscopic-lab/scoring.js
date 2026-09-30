(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.MotionCompositionModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MotionCompositionScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const POSITION_TOLERANCE_MM = 50, COORDINATE_POINTS = 2, MOTION_POINTS = 3, TRAJECTORY_POINTS = 3, PASS_SCORE = 60;
  function score(state) {
    if (!state || !Array.isArray(state.cases) || state.cases.length !== 4 || !state.cases.every(M.validCase)) throw new Error("Invalid answers");
    const detail = state.cases.map((c, index) => {
      const expected = M.expected(index), points = c.points.map((p, i) => ({
        x: p !== null && Math.abs(p[0] - expected[i][0]) <= POSITION_TOLERANCE_MM,
        y: p !== null && Math.abs(p[1] - expected[i][1]) <= POSITION_TOLERANCE_MM
      }));
      const motions = c.motions.map((v, i) => v === M.CASES[index].motions[i]), trajectory = c.trajectory === M.CASES[index].trajectory;
      return { points, motions, trajectory, score: points.reduce((n, p) => n + (Number(p.x) + Number(p.y)) * COORDINATE_POINTS, 0) + motions.filter(Boolean).length * MOTION_POINTS + Number(trajectory) * TRAJECTORY_POINTS };
    });
    const total = detail.reduce((n, c) => n + c.score, 0);
    return { score: total, maxScore: 100, passed: total >= PASS_SCORE, completed: true, feedback: "依同一時刻的水平、垂直位置合成；未答項不計分。", detail };
  }
  return Object.freeze({ POSITION_TOLERANCE_MM, COORDINATE_POINTS, MOTION_POINTS, TRAJECTORY_POINTS, PASS_SCORE, score });
});
