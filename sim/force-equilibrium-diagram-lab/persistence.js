(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.EquilibriumModel,
    typeof module === "object" && module.exports ? require("./generator.js") : root.EquilibriumGenerator);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquilibriumPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, G) {
  "use strict";
  const ACTIVITY = "force-equilibrium-diagram-lab", MAX_BYTES = 4000;
  const baseKeys = ["schemaVersion", "generatorVersion", "rubricVersion", "seed", "answers"];
  const draftKeys = baseKeys.concat("phase", "current", "returnToCheck");
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  function fresh(seed) {
    G.generate(seed);
    return { schemaVersion: 1, generatorVersion: 1, rubricVersion: 1, seed, answers: [[], [], [], [], []], phase: "edit", current: 0, returnToCheck: false };
  }
  function validate(a, kind) {
    const keys = kind === "draft" ? draftKeys : baseKeys;
    if (!a || Array.isArray(a) || Object.keys(a).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(a, k))) throw new Error("Invalid answer fields");
    if (a.schemaVersion !== 1 || a.generatorVersion !== 1 || a.rubricVersion !== 1) throw new Error("Unsupported answer version");
    G.generate(a.seed, a.generatorVersion);
    if (!Array.isArray(a.answers) || a.answers.length !== 5 || !a.answers.every(M.validAnswer)) throw new Error("Invalid answer records");
    if (kind === "draft") {
      if (typeof a.returnToCheck !== "boolean") throw new Error("Invalid continuation");
      if (a.phase === "check") { if (a.current !== null || a.returnToCheck) throw new Error("Invalid check state"); }
      else if (a.phase !== "edit" || !Number.isInteger(a.current) || a.current < 0 || a.current > 4) throw new Error("Invalid edit state");
    }
    if (bytes(a) > MAX_BYTES) throw new Error("Snapshot too large");
    return M.clone(a);
  }
  function review(state) { return validate(Object.fromEntries(baseKeys.map(k => [k, state[k]])), "review"); }
  function draft(state) { return validate(state, "draft"); }
  function decode(snapshot, kind) {
    if (!["draft", "review"].includes(kind)) throw new Error("Invalid snapshot kind");
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== kind || bytes(snapshot) > MAX_BYTES) throw new Error("Invalid snapshot envelope");
    if (kind === "review" && (!Number.isFinite(snapshot.score) || snapshot.score < 0 || snapshot.score > 100 || typeof snapshot.passed !== "boolean")) throw new Error("Invalid review metadata");
    return validate(snapshot.answer, kind);
  }
  function navigate(state, current, fromCheck = false) {
    return draft({ ...state, phase: "edit", current, returnToCheck: fromCheck || state.returnToCheck });
  }
  function check(state) { return draft({ ...state, phase: "check", current: null, returnToCheck: false }); }
  return Object.freeze({ ACTIVITY, MAX_BYTES, bytes, fresh, validate, review, draft, decode, navigate, check });
});
