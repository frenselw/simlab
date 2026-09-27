(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.NewtonModel,
    typeof module === "object" && module.exports ? require("./fitting.js") : root.NewtonFitting);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, F) {
  "use strict";
  function experiment(group, index) {
    const expectedRoles = index === 0 ? ["force", "mass", "acceleration"] : ["mass", "force", "acceleration"];
    const roles = group.roles.map((v, i) => v === expectedRoles[i]), n = group.records.length, buckets = new Map();
    for (const [row, r] of group.records.entries()) {
      const control = r[index === 0 ? 0 : 1], independent = index === 0 ? M.force(r[1]) : M.mass(r[0]);
      if (!buckets.has(control)) buckets.set(control, []); buckets.get(control).push({ row, independent });
    }
    const candidates = [...buckets].map(([key, values]) => ({ key, rows: values.map(v => v.row), count: values.length,
      unique: new Set(values.map(v => v.independent)).size, span: Math.max(...values.map(v => v.independent)) - Math.min(...values.map(v => v.independent)) }));
    candidates.sort((a, b) => b.count - a.count || b.unique - a.unique || b.span - a.span || a.key - b.key);
    const best = candidates[0] || { count: 0, unique: 0, span: 0, rows: [] };
    const control = n < 2 ? 0 : 6 * (best.count - 1) / (n - 1);
    const sampling = 6 * Math.min(best.unique / 5, 1) * Math.min(best.span / (.6 * (index === 0 ? 1 : 1.5)), 1);
    return { score: roles.filter(Boolean).length + control + sampling, roles, control, sampling, best, count: n, expectedRoles };
  }
  function graphScore(state, index) {
    const plot = state.plots[index], records = state.groups[M.sourceGroup(index)].records, range = M.bounds(state, index);
    const tolerance = [Math.max(.001, range.x * .005), Math.max(.001, range.y * .005)];
    const points = records.map((r, i) => {
      const expected = M.expected(index, r), actual = plot.points[i]?.map(v => v / 10000) ?? null;
      return { expected, actual, correct: expected.map((v, axis) => actual !== null && Math.abs(actual[axis] - v) <= tolerance[axis] + 1e-12) };
    });
    const pointScore = points.reduce((s, p) => s + p.correct.filter(Boolean).length, 0) / 12 * 10;
    const fit = plot.fitAttempted ? F.fit(plot.model, F.plotted(plot)) : null;
    let modelScore = index === 1 ? (plot.model === "inverse" ? 3 : 0) : (["linear", "origin"].includes(plot.model) ? 3 : 0);
    if (index !== 1 && plot.model === "quadratic" && fit?.ok && Math.abs(fit.coefficients[0]) * Math.max(fit.minX ** 2, fit.maxX ** 2) <= range.y * .01) modelScore = 2;
    return { pointScore, modelScore, fitScore: fit?.ok ? 2 : 0, fit, points, tolerance };
  }
  function score(state) {
    const experiments = state.groups.map(experiment), graphs = state.plots.map((_, i) => graphScore(state, i));
    const conclusions = state.conclusions.map((v, i) => v === M.QUESTIONS[i].options[0][0]);
    const total = experiments.reduce((s, g) => s + g.score, 0) + graphs.reduce((s, g) => s + g.pointScore + g.modelScore + g.fitScore, 0) + conclusions.filter(Boolean).length * 5;
    const value = Math.max(0, Math.min(100, total));
    return { score: value, maxScore: 100, passed: value >= 60, completed: true, detail: { experiments, graphs, conclusions } };
  }
  return Object.freeze({ experiment, graphScore, score });
});
