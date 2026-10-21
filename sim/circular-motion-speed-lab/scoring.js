(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.CircularSpeedModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CircularSpeedScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";
  const NUMERIC = ["vA", "vB", "omegaA", "omegaB"];
  const CONCEPT = ["speedRelation", "angularRelation", "speedReason", "angularReason"];
  const CORRECT = {
    coaxial: { speedRelation: "lt", angularRelation: "eq", speedReason: "equal-angle-larger-radius", angularReason: "rigid-angle" },
    belt: { speedRelation: "eq", angularRelation: "gt", speedReason: "belt-no-slip", angularReason: "equal-arc-smaller-radius" }
  };
  const POINTS = { vA: 8, vB: 8, omegaA: 8, omegaB: 8, speedRelation: 5, angularRelation: 5, speedReason: 4, angularReason: 4 };
  function parseNumeric(raw) {
    if (typeof raw !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  function matches(raw, expected) {
    const number = parseNumeric(raw);
    if (number === null || !Number.isFinite(expected) || expected <= 0) return false;
    const halfUnit = 0.5 * 10 ** (Math.floor(Math.log10(expected)) - 2);
    return Math.abs(number - expected) <= halfUnit + Number.EPSILON * Math.max(1, expected) * 4;
  }
  function scoreCase(kind, item) {
    const reading = ["captured", "unwrapped"].includes(item.phase) ? Model.readings(kind, item.definition, item.measurement.elapsed) : null;
    const detail = {};
    let score = 0;
    for (const key of NUMERIC) {
      const correct = item.phase === "unwrapped" && reading && matches(item.answers[key], reading[key]);
      detail[key] = { correct: Boolean(correct), points: correct ? POINTS[key] : 0, max: POINTS[key], expected: reading?.[key] ?? null };
      score += detail[key].points;
    }
    for (const key of CONCEPT) {
      const correct = item.answers[key] === CORRECT[kind][key];
      detail[key] = { correct, points: correct ? POINTS[key] : 0, max: POINTS[key], expected: CORRECT[kind][key] };
      score += detail[key].points;
    }
    return { score, detail, reading };
  }
  function scoreAttempt(state) {
    const coaxial = scoreCase("coaxial", state.cases.coaxial);
    const belt = scoreCase("belt", state.cases.belt);
    const score = coaxial.score + belt.score;
    return { score, maxScore: 100, passed: score >= 60, completed: true, cases: { coaxial, belt } };
  }
  return { NUMERIC, CONCEPT, CORRECT, POINTS, parseNumeric, matches, scoreCase, scoreAttempt };
});
