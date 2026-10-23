(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.CentripetalModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentripetalScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const roles = [
    { independent: "r", controls: ["m", "omega"] },
    { independent: "m", controls: ["r", "omega"] },
    { independent: "omega", controls: ["m", "r"] }
  ];
  const near = (input, target) => typeof input === "string" && input.length > 0 && /^\d*(?:\.\d*)?$/.test(input) &&
    Math.abs(Number(input) - target) <= Math.max(0.01, 0.02 * Math.abs(target)) + 1e-12;
  function fair(kind, run, rv = 3) {
    if (!run || new Set(run.q.map(q => M.slot(kind === "omega" ? q : Math.abs(q)))).size < 2) return false;
    const [rA, rB, nA, nB] = run.cfg;
    if (kind === "radius") return nA === nB && (rv >= 3 || rA !== rB);
    if (kind === "mass") return rA === rB && nA !== nB;
    return true;
  }
  function comparison(kind, run, rv = 3) {
    if (!run || !run.fit || !M.fit(kind, run).ok) return "insufficient";
    if (kind === "omega") return "square";
    const [rA, rB, nA, nB] = run.cfg;
    if (kind === "radius") return rv < 3 && rA === rB ? "no-contrast" : nA !== nB ? "confounded" : "supports";
    return nA === nB ? "no-contrast" : rA !== rB ? "confounded" : "supports";
  }
  function coverage(kind, run) {
    const samples = run ? run.q.map(q => kind === "omega" ? q : Math.abs(q)) : [];
    const span = samples.length ? (Math.max(...samples) - Math.min(...samples)) / 1000 : 0;
    const slots = new Set(samples.map(M.slot)).size;
    const dataScore = slots >= 3 && span >= 1 ? 4 : slots >= 2 && span >= 0.5 ? 2 : 0;
    return { span, slots, dataScore };
  }
  function runResult(kind, run, rv) {
    const fairScore = fair(kind, run, rv) ? 4 : 0;
    const { span, slots, dataScore } = coverage(kind, run);
    const ratio = run ? kind === "radius" ? M.radius(run.cfg[0]) / M.radius(run.cfg[1]) :
      kind === "mass" ? M.mass(run.cfg[2]) / M.mass(run.cfg[3]) : 4 : null;
    const numericScore = ratio !== null && near(run.a[0], ratio) ? 4 : 0;
    const actualFit = run?.fit ? M.fit(kind, run) : null;
    const fitScore = !actualFit?.ok ? 0 : kind === "omega" ?
      (run.a[1] === "square" ? 3 : 0) + (run.a[2] === "coefficient" ? 3 : 0) :
      (run.a[1] === comparison(kind, run, rv) ? 3 : 0) +
      (run.a[2] === (fair(kind, run, rv) ? "coefficient" : "uncertain") ? 3 : 0);
    return { fairScore, dataScore, numericScore, fitScore, score: fairScore + dataScore + numericScore + fitScore,
      fit: actualFit, ratio, span, slots, fair: fair(kind, run, rv) };
  }
  function page(state, i) {
    const task = state.tasks[i], kind = M.KINDS[i];
    const [independent, controls] = task.roles, expected = roles[i];
    const roleScore = state.rv >= 2 && i < 2 ?
      (task.inquiry[0] === (i === 0 ? "equal-mass" : "equal-radius") ? 3 : 0) +
      (task.inquiry[1] === "ratio-steady" ? 3 : 0) : (independent === expected.independent ? 2 : 0) +
      expected.controls.filter(key => controls?.includes(key)).length * 2;
    const lawScore = task.law === (kind === "omega" ? "square" : "linear") ? 6 : 0;
    if (state.rv < 4) {
      const result = runResult(kind, task.selected === null ? null : task.runs[task.selected], state.rv);
      return { ...result, roleScore, lawScore, score: roleScore + lawScore + result.score };
    }
    const runs = [0, 1].map(index => runResult(kind, task.runs[index], state.rv));
    const credit = key => runs.reduce((sum, run) => sum + run[key] / 2, 0);
    return { roleScore, lawScore, fairScore: credit("fairScore"), dataScore: credit("dataScore"),
      numericScore: credit("numericScore"), fitScore: credit("fitScore"), runs,
      score: roleScore + lawScore + credit("score") };
  }
  function score(state) {
    const pages = M.KINDS.map((_, i) => page(state, i));
    const syncScore = state.sync === "same-omega" ? 5 : 0;
    const massPartsScore = state.massParts === "cap-screw-weights" ? 5 : 0;
    const total = pages.reduce((sum, item) => sum + item.score, 0) + syncScore + massPartsScore;
    return { score: total, maxScore: 100, passed: total >= 60, completed: true,
      detail: { pages, syncScore, massPartsScore } };
  }
  return Object.freeze({ near, fair, comparison, coverage, page, score });
});
