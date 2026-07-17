(function (root, factory) {
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.PositionTimeScoring;
  const api = factory(scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PositionTimePersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Scoring) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const KEYS = ["m1", "m2", "m3", "m4", "m5"];

  function createExplore(x0 = 0, v = 1) {
    return { phase: "explore", variant: "free", currentStep: null, editingStep: null, exploration: { x0, v }, assessment: null };
  }
  function startAssessment(state, setId) {
    if (state.phase !== "explore" || !Scoring.getScenarioSet(Scoring.LIBRARY_VERSION, setId)) return false;
    state.phase = "mission";
    state.variant = "normal";
    state.currentStep = 0;
    state.editingStep = null;
    state.assessment = { lv: Scoring.LIBRARY_VERSION, sid: setId, seen: [true, false, false, false, false], ans: Scoring.blankAnswers() };
    return true;
  }
  function nextMission(state) {
    if (state.phase !== "mission" || state.variant !== "normal") return false;
    if (state.currentStep < 4) {
      state.currentStep += 1;
      state.assessment.seen[state.currentStep] = true;
    } else {
      state.phase = "final-review";
      state.variant = "ready";
      state.currentStep = null;
    }
    return true;
  }
  function editMission(state, step) {
    if (state.phase !== "final-review" || !Number.isInteger(step) || step < 0 || step > 4) return false;
    state.phase = "mission";
    state.variant = "from-review";
    state.currentStep = step;
    state.editingStep = step;
    return true;
  }
  function returnToReview(state) {
    if (state.phase !== "mission" || state.variant !== "from-review" || state.editingStep !== state.currentStep) return false;
    state.phase = "final-review";
    state.variant = "ready";
    state.currentStep = null;
    state.editingStep = null;
    return true;
  }

  function encodeDraft(state) {
    const payload = {
      v: SCHEMA_VERSION,
      p: state.phase,
      r: state.variant,
      c: state.currentStep,
      e: state.editingStep,
      x: { x0: state.exploration.x0, v: state.exploration.v },
      a: state.assessment ? {
        lv: state.assessment.lv,
        sid: state.assessment.sid,
        seen: state.assessment.seen.slice(),
        ans: cleanAnswers(state.assessment.ans)
      } : null
    };
    return validateDraft(payload) ? payload : null;
  }
  function decodeDraft(payload) {
    if (!validateDraft(payload)) return null;
    return {
      phase: payload.p,
      variant: payload.r,
      currentStep: payload.c,
      editingStep: payload.e,
      exploration: { x0: payload.x.x0, v: payload.x.v },
      assessment: payload.a ? { lv: payload.a.lv, sid: payload.a.sid, seen: payload.a.seen.slice(), ans: cleanAnswers(payload.a.ans) } : null
    };
  }
  function encodeReview(state) {
    if (!state.assessment || !validAssessment(state.assessment)) return null;
    return { v: SCHEMA_VERSION, lv: state.assessment.lv, sid: state.assessment.sid, ans: cleanAnswers(state.assessment.ans) };
  }
  function decodeReview(payload) {
    if (!plain(payload) || !onlyKeys(payload, ["v", "lv", "sid", "ans"]) || payload.v !== SCHEMA_VERSION) return null;
    const assessment = { lv: payload.lv, sid: payload.sid, seen: [true, true, true, true, true], ans: payload.ans };
    if (!validAssessment(assessment)) return null;
    return { phase: "submitted-review", variant: "complete", currentStep: null, editingStep: null, exploration: { x0: 0, v: 0 }, assessment: { ...assessment, ans: cleanAnswers(payload.ans) }, locked: true };
  }

  function validateDraft(payload) {
    if (!plain(payload) || !onlyKeys(payload, ["v", "p", "r", "c", "e", "x", "a"]) || payload.v !== SCHEMA_VERSION || !validExploration(payload.x)) return false;
    if (payload.p === "explore") return payload.r === "free" && payload.c == null && payload.e == null && payload.a == null;
    if (!validAssessment(payload.a)) return false;
    if (payload.p === "final-review") return payload.r === "ready" && payload.c == null && payload.e == null && payload.a.seen.every(Boolean);
    if (payload.p !== "mission" || !Number.isInteger(payload.c) || payload.c < 0 || payload.c > 4) return false;
    if (payload.r === "from-review") return payload.e === payload.c && payload.a.seen.every(Boolean);
    if (payload.r !== "normal" || payload.e != null) return false;
    return payload.a.seen.every((seen, index) => index <= payload.c ? seen : !seen) && KEYS.slice(payload.c + 1).every((key) => pristine(payload.a.ans[key], key));
  }
  function validAssessment(value) {
    return Boolean(plain(value) && onlyKeys(value, ["lv", "sid", "seen", "ans"]) && Scoring.getScenarioSet(value.lv, value.sid) && Array.isArray(value.seen) && value.seen.length === 5 && value.seen.every((item) => typeof item === "boolean") && Scoring.validAnswers(value.ans));
  }
  function validExploration(value) {
    return Boolean(plain(value) && onlyKeys(value, ["x0", "v"]) && Number.isFinite(value.x0) && value.x0 >= Scoring.LIMITS.x0Min && value.x0 <= Scoring.LIMITS.x0Max && Number.isFinite(value.v) && value.v >= Scoring.LIMITS.velocityMin && value.v <= Scoring.LIMITS.velocityMax);
  }
  function pristine(value, key) {
    const blank = Scoring.blankAnswers()[key];
    return JSON.stringify(value) === JSON.stringify(blank);
  }
  function cleanAnswers(answers) {
    const output = {};
    KEYS.forEach((key) => { output[key] = clean(answers[key]); });
    return output;
  }
  function clean(value) {
    if (Array.isArray(value)) return value.map(clean);
    if (!plain(value)) return value;
    const output = {};
    Object.entries(value).forEach(([key, item]) => { if (item != null) output[key] = clean(item); });
    return output;
  }
  function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
  function onlyKeys(value, keys) { return Object.keys(value).every((key) => keys.includes(key)); }

  function lifecyclePolicy(stage, outcome) {
    if (stage === "startup") {
      if (outcome === "review") return { key: "review", editable: false, showScore: true };
      if (outcome === "editable") return { key: "editable", editable: true, showScore: false };
      if (outcome === "frozen") return { key: "frozen", editable: false, showScore: false };
      return { key: "load-error", editable: false, showScore: false };
    }
    const key = outcome?.activityState;
    if (key === "success" || key === "committed") return { key, editable: false, showScore: true };
    if (key === "frozen") return { key, editable: false, showScore: false };
    return { key: "retry", editable: Boolean(outcome?.retryable), showScore: false };
  }

  return { SCHEMA_VERSION, createExplore, startAssessment, nextMission, editMission, returnToReview, encodeDraft, decodeDraft, encodeReview, decodeReview, validateDraft, lifecyclePolicy };
});
