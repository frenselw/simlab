(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.NewtonModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const ACTIVITY = "newtons-second-law-investigation-lab", MAX_BYTES = 4000;
  const baseKeys = ["schemaVersion", "modelVersion", "rubricVersion", "groups", "plots", "conclusions"];
  const draftKeys = baseKeys.concat("phase", "group", "graph", "returnToCheck", "setups");
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  function keys(value, expected) {
    if (!value || Array.isArray(value) || Object.keys(value).length !== expected.length || !expected.every(k => Object.prototype.hasOwnProperty.call(value, k))) throw new Error("Invalid fields");
  }
  function list(value, size) { if (!Array.isArray(value) || value.length !== size) throw new Error("Invalid array length"); }
  function validate(a, kind) {
    if (!["draft", "review"].includes(kind)) throw new Error("Invalid kind");
    keys(a, kind === "draft" ? draftKeys : baseKeys);
    if (a.modelVersion !== 1 || !((a.schemaVersion === 1 && a.rubricVersion === 1) || (a.schemaVersion === 2 && [1, 2].includes(a.rubricVersion)))) throw new Error("Unsupported version");
    list(a.groups, 2); list(a.plots, 3); list(a.conclusions, 5);
    for (const g of a.groups) {
      keys(g, ["roles", "records"]); list(g.roles, 3);
      if (g.roles.some(r => r !== null && !M.ROLES.includes(r)) || !Array.isArray(g.records) || g.records.length > 6 || !g.records.every(M.validRecord)) throw new Error("Invalid experiment");
    }
    a.plots.forEach((p, i) => {
      keys(p, ["points", "model", "fitAttempted"].concat(a.schemaVersion === 2 ? ["meaning"] : [])); list(p.points, a.groups[M.sourceGroup(i)].records.length);
      if (a.schemaVersion === 2 && p.meaning !== null && !M.MEANINGS.some(([value]) => value === p.meaning)) throw new Error("Invalid interpretation");
      if (p.model !== null && !M.METHODS.includes(p.model)) throw new Error("Invalid fit model");
      if (typeof p.fitAttempted !== "boolean" || (p.model === null && p.fitAttempted)) throw new Error("Invalid fit operation");
      for (const pt of p.points) if (pt !== null && (!Array.isArray(pt) || pt.length !== 2 || !M.integer(pt[0], 0, i === 0 ? 14000 : 22500) || !M.integer(pt[1], 0, 30000))) throw new Error("Invalid point");
    });
    a.conclusions.forEach((v, i) => { if (v !== null && !M.QUESTIONS[i].options.some(o => o[0] === v)) throw new Error("Invalid conclusion"); });
    if (kind === "draft") {
      if (typeof a.returnToCheck !== "boolean") throw new Error("Invalid continuation");
      if (a.phase === "collect") { if (!M.integer(a.group, 0, 1) || a.graph !== null) throw new Error("Invalid collection navigation"); }
      else if (a.phase === "plot") { if (a.group !== null || !M.integer(a.graph, 0, 2)) throw new Error("Invalid graph navigation"); }
      else if (["conclude", "check"].includes(a.phase)) { if (a.group !== null || a.graph !== null || (a.phase === "check" && a.returnToCheck)) throw new Error("Invalid final navigation"); }
      else throw new Error("Unknown phase");
      list(a.setups, 2);
      a.setups.forEach((setup, i) => {
        keys(setup, ["settings", "locks", "candidate"]); list(setup.settings, 2); list(setup.locks, 2);
        if (!M.integer(setup.settings[0], 0, 6) || !M.integer(setup.settings[1], 0, 5) || setup.locks.some(v => typeof v !== "boolean")) throw new Error("Invalid instrument setup");
        if (setup.candidate !== null && (!M.validRecord(setup.candidate) || a.groups[i].records.length >= 6 || setup.candidate[0] !== setup.settings[0] || setup.candidate[1] !== setup.settings[1])) throw new Error("Invalid unrecorded observation");
      });
    }
    if (bytes(a) > MAX_BYTES) throw new Error("Snapshot too large");
    return M.clone(a);
  }
  const review = state => validate(Object.fromEntries(baseKeys.map(k => [k, state[k]])), "review");
  const draft = state => validate(state, "draft");
  function upgradeDraft(state) {
    const result = draft(state);
    if (result.schemaVersion === 1) { result.schemaVersion = 2; result.plots.forEach(p => { p.meaning = null; }); }
    return draft(result);
  }
  const editableFromReview = state => upgradeDraft({ ...M.fresh(state.rubricVersion), ...review(state) });
  function navigate(state, phase, index = null) {
    return draft({ ...state, phase, group: phase === "collect" ? index : null, graph: phase === "plot" ? index : null,
      returnToCheck: phase === "check" ? false : state.phase === "check" || state.returnToCheck });
  }
  function decode(snapshot, kind) {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== kind || bytes(snapshot) > MAX_BYTES) throw new Error("Invalid envelope");
    if (kind === "review" && (!Number.isFinite(snapshot.score) || snapshot.score < 0 || snapshot.score > 100 || typeof snapshot.passed !== "boolean")) throw new Error("Invalid result");
    return validate(snapshot.answer, kind);
  }
  return Object.freeze({ ACTIVITY, MAX_BYTES, bytes, fresh: M.fresh, validate, review, draft, decode, navigate, editableFromReview, upgradeDraft });
});
