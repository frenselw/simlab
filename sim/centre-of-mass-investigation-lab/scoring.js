(function (root, factory) {
  const G = typeof module === "object" && module.exports ? require("./generator.js") : root.CentreMassGenerator;
  const M = typeof module === "object" && module.exports ? require("./model.js") : root.CentreMassModel;
  const api = factory(G, M);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Model) {
  "use strict";
  const RUBRIC_VERSION = 1;
  const partial = (error, fullAt, zeroAfter, full, floorAtZero) => {
    const raw = error <= fullAt + 1e-12 ? full : error <= zeroAfter + 1e-12
      ? full - (full - floorAtZero) * (error - fullAt) / (zeroAfter - fullAt) : 0;
    return Math.max(0, Math.min(full, raw));
  };
  function evidence(state, problem) {
    const episodes = Array.isArray(state?.part1?.supportEpisodes) ? state.part1.supportEpisodes : [];
    const validEpisodes = episodes.filter((item) => Number.isFinite(item?.x) && item.x >= 0 && item.x <= 1 &&
      item.outcome === Model.supportOutcome(item.x, problem.part1.xCm));
    const balanced = validEpisodes.some((item) => item.outcome === "balanced");
    const holes = new Map(problem.part2.holes.map((item) => [item.key, item]));
    const settled = [...new Set((state?.part2?.hangRecords || []).map((item) => item?.holeKey).filter((key) => holes.has(key)))];
    const lines = [];
    for (const line of state?.part2?.lines || []) {
      const hole = holes.get(line?.holeKey);
      if (hole && settled.includes(line.holeKey) && !lines.some((item) => item.holeKey === line.holeKey) &&
          Model.lineValid(line, hole, problem.part2.centre, problem.part2.size)) lines.push(line);
    }
    let nonDegenerate = false;
    for (let i = 0; i < lines.length; i += 1) for (let j = i + 1; j < lines.length; j += 1) {
      if (Model.acuteLineAngle(lines[i], lines[j]) >= 25) nonDegenerate = true;
    }
    const intersection = nonDegenerate ? Model.leastSquares(lines) : null;
    const observations = Model.validObservations(problem.part3.initialView, state?.part3?.observations) ? state.part3.observations : [];
    return { validEpisodes, balanced, settled, lines, nonDegenerate, intersection, observations };
  }
  function score(state) {
    let problem;
    try { problem = Generator.generate(state?.seed, state?.generatorVersion); } catch { return empty(); }
    const ev = evidence(state, problem), detail = [];
    const add = (key, label, points, max) => detail.push({ key, label, points, max });
    add("p1-release", "完成承托放手", ev.validEpisodes.length ? 5 : 0, 5);
    add("p1-balance", "找到水平中性平衡", ev.balanced ? 10 : 0, 10);
    const mark1 = state?.part1?.markX;
    add("p1-mark", "標註一維重心", ev.balanced && Number.isFinite(mark1) ? partial(Math.abs(mark1 - problem.part1.xCm), 0.02, 0.05, 15, 5) : 0, 15);
    add("p2-hang", "兩個小孔懸掛並停止", Math.min(2, ev.settled.length) * 6, 12);
    add("p2-lines", "兩條有效鉛垂線", Math.min(2, ev.lines.length) * 9, 18);
    const mark2 = state?.part2?.mark;
    const gate2 = ev.settled.length >= 2 && ev.lines.length >= 2 && ev.nonDegenerate && mark2 && [mark2.x, mark2.y].every(Number.isFinite);
    const lineError = gate2 && ev.intersection ? Math.hypot(mark2.x - ev.intersection.x, mark2.y - ev.intersection.y) / problem.part2.size : Infinity;
    add("p2-intersection", "根據鉛垂線交會作答", gate2 ? partial(lineError, 0.03, 0.08, 10, 0) : 0, 10);
    const comError = gate2 ? Math.hypot(mark2.x - problem.part2.centre.x, mark2.y - problem.part2.centre.y) / problem.part2.size : Infinity;
    add("p2-mark", "標註平板重心", gate2 ? partial(comError, 0.03, 0.07, 15, 5) : 0, 15);
    add("p3-observe", "完成兩個有效觀察姿態", ev.observations.length === 2 ? 5 : 0, 5);
    add("p3-select", "選中幾何中心", ev.observations.length === 2 && state?.part3?.selectedCandidateKey === problem.part3.correctKey ? 10 : 0, 10);
    const total = detail.reduce((sum, item) => sum + item.points, 0);
    return { score: total, maxScore: 100, passed: total >= 60, completed: true, detail,
      diagnostics: { part1Error: Number.isFinite(mark1) ? Math.abs(mark1 - problem.part1.xCm) : null,
        part2Error: Number.isFinite(comError) ? comError : null, lineError: Number.isFinite(lineError) ? lineError : null } };
  }
  function empty() { return { score: 0, maxScore: 100, passed: false, completed: true, detail: [], diagnostics: {} }; }
  return { RUBRIC_VERSION, evidence, score, empty };
});
