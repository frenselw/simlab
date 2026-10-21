(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.CircularSpeedModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CircularSpeedPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";
  const REASONS = ["rigid-angle", "equal-angle-larger-radius", "belt-no-slip", "equal-arc-smaller-radius", "larger-always-faster", "equal-time-means-equal-speed"];
  const OPTIONS = {
    coaxial: { speedReason: ["equal-angle-larger-radius", "rigid-angle", "larger-always-faster", "equal-time-means-equal-speed"], angularReason: ["rigid-angle", "belt-no-slip", "equal-arc-smaller-radius", "larger-always-faster"] },
    belt: { speedReason: ["belt-no-slip", "rigid-angle", "equal-angle-larger-radius", "larger-always-faster"], angularReason: ["equal-arc-smaller-radius", "equal-angle-larger-radius", "equal-time-means-equal-speed", "larger-always-faster"] }
  };
  const emptyAnswers = () => ({ vA: "", vB: "", omegaA: "", omegaB: "", speedRelation: null, angularRelation: null, speedReason: null, angularReason: null });
  function emptyCase(definition) { return { definition, phase: "ready", measurement: { startAngles: null, elapsed: 0 }, answers: emptyAnswers() }; }
  function initial(random = Math.random) {
    return { schemaVersion: 1, modelVersion: 1, rubricVersion: 1, view: "task", activeCase: "coaxial",
      cases: { coaxial: emptyCase(Model.definition(random)), belt: emptyCase(Model.definition(random)) } };
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function validCase(kind, item) {
    if (!item || !Model.validDefinition(item.definition) || !["ready", "measuring", "captured", "unwrapped"].includes(item.phase)) return false;
    const m = item.measurement, a = item.answers;
    if (!m || !Number.isFinite(m.elapsed) || m.elapsed < 0 || m.elapsed > Model.MAX_TIME || !a) return false;
    const angles = m.startAngles;
    if (item.phase === "ready" ? angles !== null || m.elapsed !== 0 : !Array.isArray(angles) || angles.length !== 2 || angles.some(x => !Number.isFinite(x) || x < 0 || x >= Model.TAU)) return false;
    if (angles && kind === "coaxial" && Math.abs(angles[0] - angles[1]) > 1e-10) return false;
    if (["captured", "unwrapped"].includes(item.phase) && m.elapsed <= 0) return false;
    if (["vA", "vB", "omegaA", "omegaB"].some(key => typeof a[key] !== "string" || a[key].length > 32 || (item.phase !== "unwrapped" && a[key] !== ""))) return false;
    if (["speedRelation", "angularRelation"].some(key => a[key] !== null && !["lt", "eq", "gt"].includes(a[key]))) return false;
    if (["speedReason", "angularReason"].some(key => a[key] !== null && (!REASONS.includes(a[key]) || !OPTIONS[kind][key].includes(a[key])))) return false;
    return true;
  }
  function validate(s) {
    return Boolean(s && s.schemaVersion === 1 && s.modelVersion === 1 && s.rubricVersion === 1 &&
      ["task", "check"].includes(s.view) && Model.CASES.includes(s.activeCase) && s.cases &&
      Model.CASES.every(kind => validCase(kind, s.cases[kind])));
  }
  function encode(s) { if (!validate(s)) throw new Error("Invalid circular-speed snapshot"); return clone(s); }
  function decode(s) { return validate(s) ? clone(s) : null; }
  function start(s, kind, angles) {
    if (s.cases[kind].phase !== "ready" || !Array.isArray(angles) || angles.length !== 2) return null;
    const next = clone(s); next.cases[kind].phase = "measuring"; next.cases[kind].measurement = { startAngles: angles, elapsed: 0 };
    return decode(next);
  }
  function stop(s, kind) {
    if (s.cases[kind].phase !== "measuring" || s.cases[kind].measurement.elapsed <= 0) return null;
    const next = clone(s); next.cases[kind].phase = "captured"; return decode(next);
  }
  function unwrap(s, kind) {
    if (s.cases[kind].phase !== "captured") return null;
    const next = clone(s); next.cases[kind].phase = "unwrapped"; return decode(next);
  }
  function remeasure(s, kind) {
    const next = clone(s), old = next.cases[kind];
    const fresh = emptyCase(old.definition);
    for (const key of ["speedRelation", "angularRelation", "speedReason", "angularReason"]) fresh.answers[key] = old.answers[key];
    next.cases[kind] = fresh; return decode(next);
  }
  return { OPTIONS, REASONS, initial, validate, encode, decode, start, stop, unwrap, remeasure };
});
