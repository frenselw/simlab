(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.MotionCompositionModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MotionCompositionPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const ACTIVITY = "motion-composition-stroboscopic-lab", MAX_BYTES = 4000;
  const keys = ["schemaVersion", "modelVersion", "rubricVersion", "phase", "activeCase", "activeTime", "returnToCheck", "cases"];
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  const fresh = () => ({ schemaVersion: 1, modelVersion: 1, rubricVersion: 1, phase: "edit", activeCase: 0, activeTime: 1, returnToCheck: false, cases: Array.from({ length: 4 }, M.emptyCase) });
  function validate(s, kind) {
    if (!["draft", "review"].includes(kind) || !s || Array.isArray(s) || Object.keys(s).length !== keys.length || !keys.every(k => Object.hasOwn(s, k))) throw new Error("Invalid snapshot fields");
    if (s.schemaVersion !== 1 || s.modelVersion !== M.VERSION || s.rubricVersion !== 1) throw new Error("Unsupported version");
    if (!Array.isArray(s.cases) || s.cases.length !== 4 || !s.cases.every(M.validCase)) throw new Error("Invalid case records");
    if (!Number.isInteger(s.activeCase) || s.activeCase < 0 || s.activeCase > 3 || !Number.isInteger(s.activeTime) || s.activeTime < 1 || s.activeTime > 4) throw new Error("Invalid selection");
    if (!["edit", "check", "review"].includes(s.phase) || typeof s.returnToCheck !== "boolean" || (s.phase !== "edit" && s.returnToCheck)) throw new Error("Invalid continuation");
    if ((kind === "review") !== (s.phase === "review") || bytes(s) > MAX_BYTES) throw new Error("Invalid snapshot phase or size");
    return M.clone(s);
  }
  const draft = s => validate(s, "draft"), review = s => validate({ ...s, phase: "review", returnToCheck: false }, "review");
  function decode(snapshot, kind) {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== kind || bytes(snapshot) > MAX_BYTES) throw new Error("Invalid envelope");
    if (kind === "review" && (!Number.isFinite(snapshot.score) || snapshot.score < 0 || snapshot.score > 100 || typeof snapshot.passed !== "boolean")) throw new Error("Invalid result metadata");
    return validate(snapshot.answer, kind);
  }
  const navigate = (s, activeCase, activeTime = 1) => draft({ ...s, phase: "edit", activeCase, activeTime, returnToCheck: s.phase === "check" || s.returnToCheck });
  const check = s => draft({ ...s, phase: "check", returnToCheck: false });
  function command(s, action) {
    if (s.phase !== "edit") throw new Error("Attempt is not editable");
    const next = draft(s), c = next.cases[next.activeCase];
    if (action.type === "observe") c.observed = true;
    else if (action.type === "motion" && [0, 1].includes(action.axis)) c.motions[action.axis] = action.value;
    else if (action.type === "trajectory") c.trajectory = action.value;
    else if (action.type === "place" && c.observed) c.points[next.activeTime - 1] = M.clone(action.point);
    else if (action.type === "remove") c.points[next.activeTime - 1] = null;
    else if (action.type === "clear") next.cases[next.activeCase] = { ...M.emptyCase(), observed: c.observed };
    else throw new Error("Invalid operation");
    return draft(next);
  }
  return Object.freeze({ ACTIVITY, MAX_BYTES, bytes, fresh, validate, draft, review, decode, navigate, check, command });
});
