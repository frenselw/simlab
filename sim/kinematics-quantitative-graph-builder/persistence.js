(function (root, factory) {
  const questions = typeof module === "object" && module.exports ? require("./question-definitions.js") : root.KinematicsQuantitativeQuestions;
  const model = typeof module === "object" && module.exports ? require("./graph-model.js") : root.KinematicsQuantitativeModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.KinematicsQuantitativeScoring;
  const api = factory(questions, model, scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsQuantitativePersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Questions, Model, Scoring) {
  "use strict";
  const VERSION = 1; const FULL_VISITED_MASK = 0xfff;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const emptyAnswers = () => Array(12).fill(null);
  const exactKeys = (value, keys) => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)));
  function normalizeAnswers(pid, answers) {
    if (!Questions.paper(pid) || !Array.isArray(answers) || answers.length !== 12) return null;
    const output = [];
    for (let index = 0; index < answers.length; index += 1) {
      const answer = answers[index]; const definition = Questions.taskDefinition(pid, index);
      if (answer !== null && !Model.validAnswer(answer, definition)) return null;
      output.push(Model.canonicalAnswer(answer, definition));
    }
    return output;
  }
  function canonicalAnswers(pid, answers) {
    const normalized = normalizeAnswers(pid, answers);
    return normalized && JSON.stringify(normalized) === JSON.stringify(answers) ? normalized : null;
  }
  function validVisitMask(vm, answers) {
    if (!Number.isInteger(vm) || vm < 1 || vm > FULL_VISITED_MASK) return false;
    for (let missionStart = 0; missionStart < 12; missionStart += 3) {
      const missionMask = 0b111 << missionStart;
      if ((vm & missionMask) && !(vm & (1 << missionStart))) return false;
    }
    return answers.every((answer, index) => answer === null || Boolean(vm & (1 << index)));
  }
  function validTaskFields(state) {
    return Number.isInteger(state.ti) && state.ti >= 0 && state.ti <= 11 &&
      ["first", "edit"].includes(state.mode) && Boolean(state.vm & (1 << state.ti)) &&
      validVisitMask(state.vm, state.ans);
  }
  function validateDraft(state) {
    if (!state || state.v !== VERSION || state.qv !== Questions.QUESTION_SET_VERSION || !["practice", "task", "review"].includes(state.phase) || !Number.isInteger(state.vm) || state.vm < 0 || state.vm > FULL_VISITED_MASK) return false;
    if (state.phase === "practice") return exactKeys(state, ["v", "qv", "phase", "vm", "ans"]) && state.vm === 0 && Array.isArray(state.ans) && state.ans.length === 12 && state.ans.every((answer) => answer === null);
    if (!Questions.paper(state.pid) || !normalizeAnswers(state.pid, state.ans)) return false;
    if (state.phase === "task") return exactKeys(state, ["v", "qv", "phase", "pid", "ti", "mode", "vm", "ans"]) && validTaskFields(state);
    return exactKeys(state, ["v", "qv", "phase", "pid", "vm", "ans"]) && validVisitMask(state.vm, state.ans);
  }
  function normalize(state) {
    if (!validateDraft(state)) return null; const result = clone(state); if (result.pid) result.ans = normalizeAnswers(result.pid, result.ans); return result;
  }
  function initialState() { return { v: VERSION, qv: Questions.QUESTION_SET_VERSION, phase: "practice", vm: 0, ans: emptyAnswers() }; }
  function encode(state) { const normalized = normalize(state); if (!normalized) throw new Error("Invalid quantitative graph draft"); return normalized; }
  function decode(value) { const normalized = normalize(value); return normalized && JSON.stringify(normalized) === JSON.stringify(value) ? normalized : null; }
  function startTasks(state, pid) { if (!validateDraft(state) || state.phase !== "practice" || !Questions.paper(pid)) return null; return { v: VERSION, qv: Questions.QUESTION_SET_VERSION, phase: "task", pid, ti: 0, mode: "first", vm: 1, ans: emptyAnswers() }; }
  function setAnswer(state, index, answer) { if (!validateDraft(state) || state.phase !== "task" || index !== state.ti) return null; const definition = Questions.taskDefinition(state.pid, index); if (answer !== null && !Model.validAnswer(answer, definition)) return null; const next = clone(state); next.ans[index] = Model.canonicalAnswer(answer, definition); return validateDraft(next) ? next : null; }
  function markTaskVisited(state, index) { const next = clone(state); const missionStart = Math.floor(index / 3) * 3; next.ti = index; next.vm |= (1 << missionStart) | (1 << index); return validateDraft(next) ? next : null; }
  function switchTask(state, index) { if (!validateDraft(state) || state.phase !== "task" || !Number.isInteger(index) || index < 0 || index > 11 || Math.floor(index / 3) !== Math.floor(state.ti / 3)) return null; return markTaskVisited(state, index); }
  function switchMission(state, missionIndex) { if (!validateDraft(state) || state.phase !== "task" || !Number.isInteger(missionIndex) || missionIndex < 0 || missionIndex > 3) return null; return markTaskVisited(state, missionIndex * 3); }
  function openReview(state) { if (!validateDraft(state) || state.phase !== "task") return null; return { v: VERSION, qv: Questions.QUESTION_SET_VERSION, phase: "review", pid: state.pid, vm: state.vm, ans: state.ans.slice() }; }
  function nextTask(state) {
    if (!validateDraft(state) || state.phase !== "task") return null;
    if (state.mode === "edit") return openReview(state);
    for (let offset = 1; offset <= 12; offset += 1) {
      const index = (state.ti + offset) % 12;
      if (!(state.vm & (1 << index))) return markTaskVisited(state, index);
    }
    return openReview(state);
  }
  function openReviewEdit(state, index) {
    if (!validateDraft(state) || state.phase !== "review" || !Number.isInteger(index) || index < 0 || index > 11) return null;
    const missionStart = Math.floor(index / 3) * 3;
    const vm = state.vm | (1 << missionStart) | (1 << index);
    return { v: VERSION, qv: Questions.QUESTION_SET_VERSION, phase: "task", pid: state.pid, ti: index, mode: "edit", vm, ans: state.ans.slice() };
  }
  function makeReview(state) { if (!validateDraft(state) || state.phase !== "review") throw new Error("Review requires valid review state"); return { v: VERSION, qv: Questions.QUESTION_SET_VERSION, locked: 1, pid: state.pid, ans: normalizeAnswers(state.pid, state.ans) }; }
  function decodeReview(value) { if (!exactKeys(value, ["v", "qv", "locked", "pid", "ans"]) || value.v !== VERSION || value.qv !== Questions.QUESTION_SET_VERSION || value.locked !== 1) return null; const ans = canonicalAnswers(value.pid, value.ans); if (!ans || JSON.stringify(ans) !== JSON.stringify(value.ans)) return null; return { v: VERSION, qv: Questions.QUESTION_SET_VERSION, locked: 1, pid: value.pid, ans }; }
  function reviewToState(review) { const decoded = decodeReview(review); return decoded ? { v: VERSION, qv: Questions.QUESTION_SET_VERSION, phase: "review", pid: decoded.pid, vm: FULL_VISITED_MASK, ans: decoded.ans.slice() } : null; }
  function reviewVariant(state) { return Scoring.scoreActivity(state.pid, state.ans).evidenceIncompleteTaskIds.length ? "incomplete" : "ready"; }
  function bytes(value) { return new TextEncoder().encode(JSON.stringify(value)).length; }
  return { VERSION, FULL_VISITED_MASK, emptyAnswers, normalizeAnswers, canonicalAnswers, initialState, validateDraft, encode, decode, startTasks, setAnswer, switchTask, switchMission, nextTask, openReview, openReviewEdit, makeReview, decodeReview, reviewToState, reviewVariant, bytes };
});
