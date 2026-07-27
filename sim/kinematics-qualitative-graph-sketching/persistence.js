(function (root, factory) {
  const tasks = typeof module === "object" && module.exports ? require("./task-definitions.js") : root.KinematicsGraphTasks;
  const model = typeof module === "object" && module.exports ? require("./graph-model.js") : root.KinematicsGraphModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.KinematicsGraphScoring;
  const api = factory(tasks, model, scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsGraphPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Tasks, Model, Scoring) {
  "use strict";

  const VERSION = 1;
  const FULL_VISITED_MASK = (1 << Tasks.TASKS.length) - 1;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function exactKeys(value, required, optional = []) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value).sort();
    const allowed = required.concat(optional);
    return required.every((key) => keys.includes(key)) && keys.every((key) => allowed.includes(key));
  }

  function emptyAnswers() {
    return Array(Tasks.TASKS.length).fill(null);
  }

  function initialState() {
    return {
      v: VERSION,
      taskSetVersion: Tasks.TASK_SET_VERSION,
      phase: "practice",
      visitedMask: 0,
      answers: emptyAnswers()
    };
  }

  function canonicalAnswer(value) {
    if (value == null) return null;
    if (Model.isTrace(value)) return Model.encodeTrace(value);
    const trace = typeof value === "string" ? Model.decodeTrace(value) : null;
    return trace ? Model.encodeTrace(trace) : null;
  }

  function canonicalAnswers(answers) {
    if (!Array.isArray(answers) || answers.length !== Tasks.TASKS.length) return null;
    const output = [];
    for (const answer of answers) {
      if (answer == null) output.push(null);
      else {
        const canonical = canonicalAnswer(answer);
        if (!canonical) return null;
        output.push(canonical);
      }
    }
    return output;
  }

  function scenarioBounds(taskIndex) {
    const start = Math.floor(taskIndex / Tasks.GRAPH_TYPES.length) * Tasks.GRAPH_TYPES.length;
    return { start, end: start + Tasks.GRAPH_TYPES.length };
  }

  function validateDraftState(state) {
    if (!state || state.v !== VERSION || state.taskSetVersion !== Tasks.TASK_SET_VERSION ||
        !["practice", "task", "review"].includes(state.phase) ||
        !Number.isInteger(state.visitedMask) || state.visitedMask < 0 || state.visitedMask > FULL_VISITED_MASK ||
        !canonicalAnswers(state.answers)) return false;
    if (state.phase === "practice") {
      return exactKeys(state, ["v", "taskSetVersion", "phase", "visitedMask", "answers"]) &&
        state.visitedMask === 0 && state.answers.every((answer) => answer == null);
    }
    if (state.phase === "task") {
      if (!exactKeys(state, ["v", "taskSetVersion", "phase", "taskIndex", "variant", "visitedMask", "answers"]) ||
          !Number.isInteger(state.taskIndex) || state.taskIndex < 0 || state.taskIndex >= Tasks.TASKS.length ||
          !["first-pass", "review-edit"].includes(state.variant)) return false;
      if (state.variant === "first-pass") {
        const { start, end } = scenarioBounds(state.taskIndex);
        const priorMask = start ? (1 << start) - 1 : 0;
        const allowedMask = (1 << end) - 1;
        const recommendedStart = start + Tasks.GRAPH_TYPES.indexOf("xt");
        if ((state.visitedMask & priorMask) !== priorMask ||
            !(state.visitedMask & (1 << state.taskIndex)) ||
            !(state.visitedMask & (1 << recommendedStart)) ||
            (state.visitedMask & ~allowedMask) !== 0 ||
            !state.answers.slice(end).every((answer) => answer == null)) return false;
        return state.answers.every((answer, index) => answer == null || Boolean(state.visitedMask & (1 << index)));
      }
      return state.visitedMask === FULL_VISITED_MASK;
    }
    return exactKeys(state, ["v", "taskSetVersion", "phase", "visitedMask", "answers"]) &&
      state.visitedMask === FULL_VISITED_MASK;
  }

  function normalizeState(source) {
    if (!source || typeof source !== "object") return null;
    const answers = canonicalAnswers(source.answers);
    if (!answers) return null;
    const state = {
      v: source.v,
      taskSetVersion: source.taskSetVersion,
      phase: source.phase,
      visitedMask: source.visitedMask,
      answers
    };
    if (source.phase === "task") {
      state.taskIndex = source.taskIndex;
      state.variant = source.variant;
    }
    return state;
  }

  function encode(source) {
    if (!validateDraftState(source)) throw new Error("Invalid qualitative graph draft");
    const state = normalizeState(source);
    if (!state || !validateDraftState(state)) throw new Error("Invalid qualitative graph draft");
    return clone(state);
  }

  function migrateLegacyPrefixDraft(source) {
    if (!exactKeys(source, ["v", "taskSetVersion", "phase", "taskIndex", "variant", "visitedMask", "answers"]) ||
        source.v !== VERSION || source.taskSetVersion !== Tasks.TASK_SET_VERSION ||
        source.phase !== "task" || source.variant !== "first-pass" ||
        !Number.isInteger(source.taskIndex) || source.taskIndex < 0 || source.taskIndex >= Tasks.TASKS.length ||
        !Number.isInteger(source.visitedMask) || source.visitedMask !== (1 << (source.taskIndex + 1)) - 1) return null;
    const state = normalizeState(source);
    if (!state || !state.answers.slice(source.taskIndex + 1).every((answer) => answer == null)) return null;
    const { start } = scenarioBounds(source.taskIndex);
    const recommendedStart = start + Tasks.GRAPH_TYPES.indexOf("xt");
    state.visitedMask |= 1 << recommendedStart;
    return validateDraftState(state) ? state : null;
  }

  function decode(answer) {
    const candidate = validateDraftState(answer) ? answer : migrateLegacyPrefixDraft(answer);
    if (!candidate) return null;
    const state = normalizeState(candidate);
    return state && validateDraftState(state) ? state : null;
  }

  function startTasks(state) {
    if (!validateDraftState(state) || state.phase !== "practice") return null;
    const taskIndex = Tasks.taskIndexById(`${Tasks.SCENARIOS[0].id}-${Tasks.DISPLAY_GRAPH_TYPES[0]}`);
    return {
      ...state,
      phase: "task",
      taskIndex,
      variant: "first-pass",
      visitedMask: 1 << taskIndex
    };
  }

  function setAnswer(state, taskIndex, answer) {
    if (!validateDraftState(state) || state.phase !== "task" || state.taskIndex !== taskIndex) return null;
    const canonical = canonicalAnswer(answer);
    if (answer != null && !canonical) return null;
    const next = clone(state);
    next.answers[taskIndex] = canonical;
    return validateDraftState(next) ? next : null;
  }

  function nextTask(state) {
    if (!validateDraftState(state) || state.phase !== "task") return null;
    if (state.variant === "review-edit") return {
      v: VERSION,
      taskSetVersion: Tasks.TASK_SET_VERSION,
      phase: "review",
      visitedMask: FULL_VISITED_MASK,
      answers: state.answers.slice()
    };
    const currentTask = Tasks.TASKS[state.taskIndex];
    const scenarioTasks = Tasks.displayTasksForScenario(currentTask.scenarioId);
    const nextUnvisited = scenarioTasks.find((task) => {
      const index = Tasks.taskIndexById(task.id);
      return !(state.visitedMask & (1 << index));
    });
    if (nextUnvisited) return switchTask(state, Tasks.taskIndexById(nextUnvisited.id));
    const scenarioIndex = Tasks.SCENARIOS.findIndex((scenario) => scenario.id === currentTask.scenarioId);
    if (scenarioIndex === Tasks.SCENARIOS.length - 1) {
      return {
        v: VERSION,
        taskSetVersion: Tasks.TASK_SET_VERSION,
        phase: "review",
        visitedMask: FULL_VISITED_MASK,
        answers: state.answers.slice()
      };
    }
    const nextScenario = Tasks.SCENARIOS[scenarioIndex + 1];
    const taskIndex = Tasks.taskIndexById(`${nextScenario.id}-${Tasks.DISPLAY_GRAPH_TYPES[0]}`);
    return {
      ...state,
      taskIndex,
      visitedMask: state.visitedMask | (1 << taskIndex)
    };
  }

  function switchTask(state, taskIndex) {
    if (!validateDraftState(state) || state.phase !== "task" ||
        !Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= Tasks.TASKS.length ||
        Tasks.TASKS[taskIndex].scenarioId !== Tasks.TASKS[state.taskIndex].scenarioId) return null;
    const next = { ...state, taskIndex, visitedMask: state.visitedMask | (1 << taskIndex) };
    return validateDraftState(next) ? next : null;
  }

  function previousTask(state) {
    if (!validateDraftState(state) || state.phase !== "task") return null;
    const display = Tasks.displayTasksForScenario(Tasks.TASKS[state.taskIndex].scenarioId);
    const position = display.findIndex((task) => Tasks.taskIndexById(task.id) === state.taskIndex);
    if (position <= 0) return null;
    return switchTask(state, Tasks.taskIndexById(display[position - 1].id));
  }

  function openReviewEdit(state, taskIndex) {
    if (!validateDraftState(state) || state.phase !== "review" ||
        !Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= Tasks.TASKS.length) return null;
    return {
      ...state,
      phase: "task",
      taskIndex,
      variant: "review-edit"
    };
  }

  function reviewVariant(state) {
    if (!validateDraftState(state) || state.phase !== "review") return null;
    const result = Scoring.scoreActivity(state.answers);
    return result.evidenceIncompleteTaskIds.length
      ? "incomplete" : "ready";
  }

  function makeReview(source) {
    const state = normalizeState(source);
    if (!state || !validateDraftState(state) || state.phase !== "review") throw new Error("Review can only be made from a valid review state");
    return {
      v: VERSION,
      locked: 1,
      taskSetVersion: Tasks.TASK_SET_VERSION,
      answers: state.answers.slice()
    };
  }

  function decodeReview(answer) {
    if (!exactKeys(answer, ["v", "locked", "taskSetVersion", "answers"]) ||
        answer.v !== VERSION || answer.locked !== 1 || answer.taskSetVersion !== Tasks.TASK_SET_VERSION) return null;
    const answers = canonicalAnswers(answer.answers);
    if (!answers || answers.some((value, index) => value !== answer.answers[index])) return null;
    return {
      v: VERSION,
      locked: 1,
      taskSetVersion: Tasks.TASK_SET_VERSION,
      answers
    };
  }

  function reviewToState(review) {
    const decoded = decodeReview(review);
    if (!decoded) return null;
    return {
      v: VERSION,
      taskSetVersion: Tasks.TASK_SET_VERSION,
      phase: "review",
      visitedMask: FULL_VISITED_MASK,
      answers: decoded.answers.slice()
    };
  }

  function scoreState(state) {
    if (!validateDraftState(state)) return null;
    return Scoring.scoreActivity(state.answers);
  }

  function bytes(value) {
    const text = JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
    return Buffer.byteLength(text);
  }

  return {
    VERSION,
    FULL_VISITED_MASK,
    emptyAnswers,
    initialState,
    canonicalAnswer,
    validateDraftState,
    encode,
    decode,
    startTasks,
    setAnswer,
    nextTask,
    switchTask,
    previousTask,
    openReviewEdit,
    reviewVariant,
    makeReview,
    decodeReview,
    reviewToState,
    scoreState,
    bytes
  };
});
