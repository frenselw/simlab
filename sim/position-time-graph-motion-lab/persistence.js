(function (root, factory) {
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.PositionTimeScoring;
  const generator = typeof module === "object" && module.exports ? require("./generator.js") : root.PositionTimeGenerator;
  const api = factory(scoring, generator);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PositionTimePersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Scoring, Generator) {
  "use strict";

  const SCHEMA_VERSION = 2;
  const LEGACY_SCHEMA_VERSION = 1;
  const KEYS = ["m1", "m2", "m3", "m4", "m5"];

  function createExplore(x0 = 0, v = 1) {
    return { phase: "explore", variant: "free", currentStep: null, editingStep: null, exploration: { x0, v }, assessment: null };
  }
  function startAssessment(state, setId) {
    if (state.phase !== "explore" || !Scoring.getScenarioSet(Scoring.LIBRARY_VERSION, setId)) return false;
    enterAssessment(state, { lv: Scoring.LIBRARY_VERSION, sid: setId, seen: [true, false, false, false, false], ans: Scoring.blankAnswers() });
    return true;
  }
  function startGeneratedAssessment(state, seed, paper) {
    if (state.phase !== "explore" || !Generator.matchesSeed(seed, paper)) return false;
    enterAssessment(state, { gv: Generator.GENERATOR_VERSION, seed, paper: Generator.cleanPaper(paper), seen: [true, false, false, false, false], ans: Scoring.blankAnswers() });
    return true;
  }
  function enterAssessment(state, assessment) {
    state.phase = "mission";
    state.variant = "normal";
    state.currentStep = 0;
    state.editingStep = null;
    state.assessment = assessment;
  }
  function scenariosForAssessment(assessment) {
    if (validGeneratedAssessmentShape(assessment)) return assessment.paper.missions;
    if (validLegacyAssessment(assessment)) return Scoring.getScenarioSet(assessment.lv, assessment.sid);
    return null;
  }
  function nextMission(state) {
    if (state.phase !== "mission" || state.variant !== "normal" || !validAssessment(state.assessment)) return false;
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
    if (state.phase !== "final-review" || !validAssessment(state.assessment) || !Number.isInteger(step) || step < 0 || step > 4) return false;
    state.phase = "mission";
    state.variant = "from-review";
    state.currentStep = step;
    state.editingStep = step;
    return true;
  }
  function returnToReview(state) {
    if (state.phase !== "mission" || state.variant !== "from-review" || state.editingStep !== state.currentStep || !validAssessment(state.assessment)) return false;
    state.phase = "final-review";
    state.variant = "ready";
    state.currentStep = null;
    state.editingStep = null;
    return true;
  }

  function encodeDraft(state) {
    if (state.assessment && validLegacyAssessment(state.assessment)) return encodeLegacyDraft(state);
    const generated = state.assessment ? generatedEnvelope(state.assessment) : null;
    const payload = {
      v: SCHEMA_VERSION,
      p: state.phase,
      r: state.variant,
      c: state.currentStep,
      e: state.editingStep,
      x: { x0: state.exploration.x0, v: state.exploration.v },
      g: generated,
      a: state.assessment ? { seen: state.assessment.seen.slice(), ans: cleanAnswers(state.assessment.ans) } : null
    };
    return validateDraftV2(payload) ? payload : null;
  }
  function encodeLegacyDraft(state) {
    const payload = {
      v: LEGACY_SCHEMA_VERSION, p: state.phase, r: state.variant, c: state.currentStep, e: state.editingStep,
      x: { x0: state.exploration.x0, v: state.exploration.v },
      a: state.assessment ? { lv: state.assessment.lv, sid: state.assessment.sid, seen: state.assessment.seen.slice(), ans: cleanAnswers(state.assessment.ans) } : null
    };
    return validateDraftV1(payload) ? payload : null;
  }
  function decodeDraft(payload) {
    if (payload?.v === LEGACY_SCHEMA_VERSION) return decodeLegacyDraft(payload);
    if (!validateDraftV2(payload)) return null;
    const assessment = payload.g ? {
      gv: payload.g.v,
      seed: payload.g.s,
      paper: { version: payload.g.v, missions: Generator.cleanPaper({ version: payload.g.v, missions: payload.g.q }).missions },
      seen: payload.a.seen.slice(),
      ans: cleanAnswers(payload.a.ans)
    } : null;
    return stateFromPayload(payload, assessment);
  }
  function decodeLegacyDraft(payload) {
    if (!validateDraftV1(payload)) return null;
    const assessment = payload.a ? { lv: payload.a.lv, sid: payload.a.sid, seen: payload.a.seen.slice(), ans: cleanAnswers(payload.a.ans) } : null;
    return stateFromPayload(payload, assessment);
  }
  function stateFromPayload(payload, assessment) {
    return { phase: payload.p, variant: payload.r, currentStep: payload.c, editingStep: payload.e, exploration: { x0: payload.x.x0, v: payload.x.v }, assessment };
  }

  function encodeReview(state) {
    if (!state.assessment || !validAssessment(state.assessment)) return null;
    if (validLegacyAssessment(state.assessment)) return { v: LEGACY_SCHEMA_VERSION, lv: state.assessment.lv, sid: state.assessment.sid, ans: cleanAnswers(state.assessment.ans) };
    return { v: SCHEMA_VERSION, g: generatedEnvelope(state.assessment), ans: cleanAnswers(state.assessment.ans) };
  }
  function decodeReview(payload) {
    if (payload?.v === LEGACY_SCHEMA_VERSION) return decodeLegacyReview(payload);
    if (!plain(payload) || !onlyKeys(payload, ["v", "g", "ans"]) || payload.v !== SCHEMA_VERSION || !validGeneratedEnvelope(payload.g) || !Scoring.validAnswers(payload.ans)) return null;
    const assessment = {
      gv: payload.g.v, seed: payload.g.s,
      paper: { version: payload.g.v, missions: Generator.cleanPaper({ version: payload.g.v, missions: payload.g.q }).missions },
      seen: [true, true, true, true, true], ans: cleanAnswers(payload.ans)
    };
    return submittedState(assessment);
  }
  function decodeLegacyReview(payload) {
    if (!plain(payload) || !onlyKeys(payload, ["v", "lv", "sid", "ans"]) || payload.v !== LEGACY_SCHEMA_VERSION) return null;
    const assessment = { lv: payload.lv, sid: payload.sid, seen: [true, true, true, true, true], ans: payload.ans };
    return validLegacyAssessment(assessment) ? submittedState({ ...assessment, ans: cleanAnswers(payload.ans) }) : null;
  }
  function submittedState(assessment) {
    return { phase: "submitted-review", variant: "complete", currentStep: null, editingStep: null, exploration: { x0: 0, v: 0 }, assessment, locked: true };
  }

  function validateDraft(payload) { return payload?.v === LEGACY_SCHEMA_VERSION ? validateDraftV1(payload) : validateDraftV2(payload); }
  function validateDraftV2(payload) {
    if (!exactKeys(payload, ["v", "p", "r", "c", "e", "x", "g", "a"]) || payload.v !== SCHEMA_VERSION || !validExploration(payload.x)) return false;
    if (payload.p === "explore") return payload.r === "free" && payload.c == null && payload.e == null && payload.g == null && payload.a == null;
    if (!validGeneratedEnvelope(payload.g) || !plain(payload.a) || !onlyKeys(payload.a, ["seen", "ans"])) return false;
    const assessment = { gv: payload.g.v, seed: payload.g.s, paper: { version: payload.g.v, missions: payload.g.q }, seen: payload.a.seen, ans: payload.a.ans };
    return validGeneratedAssessment(assessment) && validPhase(payload, assessment);
  }
  function validateDraftV1(payload) {
    if (!exactKeys(payload, ["v", "p", "r", "c", "e", "x", "a"]) || payload.v !== LEGACY_SCHEMA_VERSION || !validExploration(payload.x)) return false;
    if (payload.p === "explore") return payload.r === "free" && payload.c == null && payload.e == null && payload.a == null;
    return validLegacyAssessment(payload.a) && validPhase(payload, payload.a);
  }
  function validPhase(payload, assessment) {
    if (payload.p === "final-review") return payload.r === "ready" && payload.c == null && payload.e == null && assessment.seen.every(Boolean);
    if (payload.p !== "mission" || !Number.isInteger(payload.c) || payload.c < 0 || payload.c > 4) return false;
    if (payload.r === "from-review") return payload.e === payload.c && assessment.seen.every(Boolean);
    if (payload.r !== "normal" || payload.e != null) return false;
    return assessment.seen.every((seen, index) => index <= payload.c ? seen : !seen) && KEYS.slice(payload.c + 1).every((key) => pristine(assessment.ans[key], key));
  }
  function validAssessment(value) { return validGeneratedAssessment(value) || validLegacyAssessment(value); }
  function validLegacyAssessment(value) {
    return Boolean(plain(value) && onlyKeys(value, ["lv", "sid", "seen", "ans"]) && Scoring.getScenarioSet(value.lv, value.sid) && validSeenAnswers(value));
  }
  function validGeneratedAssessment(value) {
    return validGeneratedAssessmentShape(value) && Generator.matchesSeed(value.seed, value.paper);
  }
  function validGeneratedAssessmentShape(value) {
    return Boolean(plain(value) && onlyKeys(value, ["gv", "seed", "paper", "seen", "ans"]) && value.gv === Generator.GENERATOR_VERSION && Generator.decodeSeed(value.seed) && Generator.validateGeneratedPaper(value.paper) && validSeenAnswers(value));
  }
  function validSeenAnswers(value) {
    return Array.isArray(value.seen) && value.seen.length === 5 && value.seen.every((item) => typeof item === "boolean") && Scoring.validAnswers(value.ans);
  }
  function generatedEnvelope(assessment) {
    const paper = Generator.cleanPaper(assessment.paper);
    return paper ? { v: assessment.gv, s: assessment.seed, q: paper.missions } : null;
  }
  function validGeneratedEnvelope(value) {
    return Boolean(plain(value) && onlyKeys(value, ["v", "s", "q"]) && value.v === Generator.GENERATOR_VERSION && Generator.matchesSeed(value.s, { version: value.v, missions: value.q }));
  }
  function validExploration(value) {
    return Boolean(plain(value) && onlyKeys(value, ["x0", "v"]) && Number.isFinite(value.x0) && value.x0 >= Scoring.LIMITS.x0Min && value.x0 <= Scoring.LIMITS.x0Max && Number.isFinite(value.v) && value.v >= Scoring.LIMITS.velocityMin && value.v <= Scoring.LIMITS.velocityMax);
  }
  function pristine(value, key) { return JSON.stringify(value) === JSON.stringify(Scoring.blankAnswers()[key]); }
  function cleanAnswers(answers) { return Object.fromEntries(KEYS.map((key) => [key, clean(answers[key])])); }
  function clean(value) {
    if (Array.isArray(value)) return value.map(clean);
    if (!plain(value)) return value;
    const output = {};
    Object.entries(value).forEach(([key, item]) => { if (item != null) output[key] = clean(item); });
    return output;
  }
  function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
  function onlyKeys(value, keys) { return Object.keys(value).every((key) => keys.includes(key)); }
  function exactKeys(value, keys) { return plain(value) && Object.keys(value).sort().join(",") === keys.slice().sort().join(","); }

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

  return { SCHEMA_VERSION, LEGACY_SCHEMA_VERSION, createExplore, startAssessment, startGeneratedAssessment, scenariosForAssessment, nextMission, editMission, returnToReview, encodeDraft, decodeDraft, encodeReview, decodeReview, validateDraft, lifecyclePolicy };
});
