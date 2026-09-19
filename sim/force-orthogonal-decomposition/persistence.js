(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./model.js") : root.ForceOrthogonalDecompositionModel
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceOrthogonalDecompositionPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";

  if (!M) throw new Error("Force orthogonal decomposition model is required");
  const ACTIVITY = "force-orthogonal-decomposition";
  const SCHEMA_VERSION = 1;
  const MAX_SNAPSHOT_BYTES = 4000;
  const SCENARIO_IDS = Object.freeze(["horizontal-vertical", "inclined-external-force", "inclined-gravity"]);
  const WORLD_BOUNDS = Object.freeze({ left: -180, right: 440, bottom: -260, top: 280 });
  const PHASES = M.PHASES;

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function bytes(value) { return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).length; }
  function onlyKeys(value, keys) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key)) && Object.keys(value).length === keys.length);
  }
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function validPoint(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && onlyKeys(value, ["x", "y"]) && finite(value.x) && finite(value.y) &&
      value.x >= WORLD_BOUNDS.left && value.x <= WORLD_BOUNDS.right && value.y >= WORLD_BOUNDS.bottom && value.y <= WORLD_BOUNDS.top);
  }
  // Keep the model's exact floating-point construction. Three questions still
  // fit comfortably in the SCORM suspend_data budget, and re-quantizing a
  // direction before restore would move its projection foot enough to change
  // the semantic answer.
  function point(value) { return { x: value.x, y: value.y }; }
  function canonicalDirection(value) {
    return { key: value.key, unit: point(value.unit), axisKey: value.axisKey ?? M.directionAxisKey(value) };
  }
  function canonicalQuestion(value) {
    return {
      scenarioId: value.scenarioId,
      phase: value.phase,
      directions: value.directions.map(entry => canonicalDirection(entry)),
      perpendiculars: value.perpendiculars.map(entry => ({ key: entry.key, end: point(entry.end), targetKey: entry.targetKey ?? null })),
      components: value.components.map(entry => ({ key: entry.key, end: point(entry.end), targetKey: entry.targetKey ?? null })),
      theta: value.theta ?? null,
      formulas: { F1: value.formulas?.F1 ?? null, F2: value.formulas?.F2 ?? null }
    };
  }

  function directionValid(value, scene, index) {
    if (!onlyKeys(value, ["key", "unit", "axisKey"]) || value.key !== `D${index + 1}` || !validPoint(value.unit)) return false;
    const magnitude = Math.hypot(value.unit.x, value.unit.y);
    if (Math.abs(magnitude - 1) > 0.002) return false;
    if (value.axisKey !== null && (!scene.axes.some(axis => axis.key === value.axisKey) || M.lineAngleDifference(Math.atan2(value.unit.y, value.unit.x), Math.atan2(scene.axes.find(axis => axis.key === value.axisKey).unit.y, scene.axes.find(axis => axis.key === value.axisKey).unit.x)) > 1e-4)) return false;
    return true;
  }

  function perpendicularValid(value, answer, scene, index) {
    if (!onlyKeys(value, ["key", "end", "targetKey"]) || value.key !== `P${index + 1}` || !validPoint(value.end)) return false;
    if (M.distance(scene.forceHead, value.end) < M.MIN_DRAW_DISTANCE / 2) return false;
    if (value.targetKey !== null && !answer.directions.some(direction => direction.key === value.targetKey)) return false;
    if (value.targetKey !== null) {
      const direction = answer.directions.find(entry => entry.key === value.targetKey);
      const foot = M.projectionFoot(scene.forceHead, direction, scene);
      if (M.distance(value.end, foot) > 0.002) return false;
    }
    return true;
  }

  function componentValid(value, answer, scene, index) {
    if (!onlyKeys(value, ["key", "end", "targetKey"]) || value.key !== `F${index + 1}` || !validPoint(value.end)) return false;
    if (M.distance(scene.origin, value.end) < M.MIN_DRAW_DISTANCE / 2) return false;
    if (value.targetKey !== null) {
      const visible = M.visibleIntersections(answer.perpendiculars, answer.directions, scene).find(entry => entry.key === value.targetKey);
      if (!visible || M.distance(value.end, visible.point) > 0.002) return false;
    }
    return true;
  }

  function validateQuestion(value, index) {
    const sceneId = SCENARIO_IDS[index];
    if (!onlyKeys(value, ["scenarioId", "phase", "directions", "perpendiculars", "components", "theta", "formulas"]) || value.scenarioId !== sceneId || !PHASES.includes(value.phase)) return { ok: false, reason: `question-shape-${index}` };
    const scene = M.getScenario(sceneId);
    if (!Array.isArray(value.directions) || value.directions.length > 2 || !value.directions.every((entry, itemIndex) => directionValid(entry, scene, itemIndex))) return { ok: false, reason: `directions-${index}` };
    if (!Array.isArray(value.perpendiculars) || value.perpendiculars.length > 2 || !value.perpendiculars.every((entry, itemIndex) => perpendicularValid(entry, value, scene, itemIndex))) return { ok: false, reason: `perpendiculars-${index}` };
    if (!Array.isArray(value.components) || value.components.length > 2 || !value.components.every((entry, itemIndex) => componentValid(entry, value, scene, itemIndex))) return { ok: false, reason: `components-${index}` };
    if (!onlyKeys(value.formulas, ["F1", "F2"]) || ![null, "sin", "cos"].includes(value.formulas.F1) || ![null, "sin", "cos"].includes(value.formulas.F2)) return { ok: false, reason: `formulas-${index}` };
    if (value.theta !== null && !M.thetaCandidates(value.directions, scene).some(candidate => candidate.key === value.theta)) return { ok: false, reason: `theta-${index}` };

    const count = (name) => value[name].length;
    // Back navigation is a supported semantic continuation: the current phase
    // changes, but completed downstream geometry/answers remain authoritative.
    // Only reject downstream data when the current phase has not yet completed
    // the prerequisite collection that could have produced it.
    if (value.phase === "directions" && count("directions") < 2 && (count("perpendiculars") || count("components") || value.theta !== null || value.formulas.F1 || value.formulas.F2)) return { ok: false, reason: `phase-dependency-${index}` };
    if (value.phase === "perpendiculars" && (count("directions") !== 2 || (count("perpendiculars") < 2 && (count("components") || value.theta !== null || value.formulas.F1 || value.formulas.F2)))) return { ok: false, reason: `phase-dependency-${index}` };
    if (value.phase === "components" && (count("directions") !== 2 || count("perpendiculars") !== 2 || (count("components") < 2 && (value.theta !== null || value.formulas.F1 || value.formulas.F2)))) return { ok: false, reason: `phase-dependency-${index}` };
    if (value.phase === "angle" && (count("directions") !== 2 || count("perpendiculars") !== 2 || count("components") !== 2)) return { ok: false, reason: `phase-dependency-${index}` };
    if (value.phase === "formulas" && (count("directions") !== 2 || count("perpendiculars") !== 2 || count("components") !== 2)) return { ok: false, reason: `phase-dependency-${index}` };
    // A direct edit can repair the geometry while the learner is still in the
    // formula phase, after the previous theta was correctly cleared. This is
    // a reachable continuation: keep the attempted expressions and let the
    // learner back up to place theta again.
    if (value.phase === "formulas" && value.theta !== null && !M.isCorrectDecomposition(value)) return { ok: false, reason: `formula-stale-geometry-${index}` };
    return { ok: true, scene };
  }

  function validate(value, options = {}) {
    const kind = options.kind || "draft";
    const allowed = kind === "draft" ? ["schemaVersion", "phase", "currentQuestion", "fromReview", "questions"] : ["schemaVersion", "questions"];
    if (!onlyKeys(value, allowed) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.questions) || value.questions.length !== SCENARIO_IDS.length) return { ok: false, reason: "top-level-shape" };
    if (kind === "draft" && (!["practice", "summary"].includes(value.phase) || !Number.isInteger(value.currentQuestion) || value.currentQuestion < 0 || value.currentQuestion >= SCENARIO_IDS.length || typeof value.fromReview !== "boolean")) return { ok: false, reason: "phase-current" };
    if (kind === "review" && Object.prototype.hasOwnProperty.call(value, "phase")) return { ok: false, reason: "review-phase" };
    for (let index = 0; index < value.questions.length; index += 1) {
      const result = validateQuestion(value.questions[index], index);
      if (!result.ok) return result;
    }
    if (kind === "draft" && value.phase === "summary" && value.fromReview) return { ok: false, reason: "summary-from-review" };
    return { ok: true };
  }

  function assertValid(value, options) {
    const result = validate(value, options);
    if (!result.ok) throw new Error(`Invalid force-orthogonal-decomposition ${options?.kind || "draft"}: ${result.reason}`);
    return result;
  }

  function freshDraft() {
    return {
      schemaVersion: SCHEMA_VERSION,
      phase: "practice",
      currentQuestion: 0,
      fromReview: false,
      questions: SCENARIO_IDS.map(id => M.createQuestionState(id))
    };
  }

  function canonicalDraft(state) {
    return {
      schemaVersion: SCHEMA_VERSION,
      phase: state.phase,
      currentQuestion: state.currentQuestion,
      fromReview: Boolean(state.fromReview),
      questions: state.questions.map(canonicalQuestion)
    };
  }
  function canonicalReview(state) {
    return { schemaVersion: SCHEMA_VERSION, questions: state.questions.map(canonicalQuestion) };
  }
  function encodeDraft(state) { const value = canonicalDraft(state); assertValid(value, { kind: "draft" }); return value; }
  function encodeReview(state) { const value = canonicalReview(state); assertValid(value, { kind: "review" }); return value; }
  function decodeDraft(value) { assertValid(value, { kind: "draft" }); return canonicalDraft(value); }
  function decodeReview(value) { assertValid(value, { kind: "review" }); return canonicalReview(value); }

  function makeSnapshot(kind, state, result) {
    const answer = kind === "draft" ? encodeDraft(state) : encodeReview(state);
    const snapshot = { version: 1, activity: ACTIVITY, kind, answer };
    if (kind === "review") {
      if (!result || !finite(result.score) || typeof result.passed !== "boolean") throw new Error("Review result is required");
      snapshot.score = result.score;
      snapshot.passed = result.passed;
    }
    if (bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("SCORM snapshot exceeds 4000 bytes");
    return snapshot;
  }

  function decodeSnapshot(snapshot, kind) {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== kind || bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("Invalid snapshot envelope");
    return kind === "draft" ? decodeDraft(snapshot.answer) : decodeReview(snapshot.answer);
  }

  function pendingEnvelope(reviewSnapshot, result) {
    const payload = { reviewJson: JSON.stringify(reviewSnapshot), score: Number(result.score), maxScore: Number(result.maxScore || 100), passed: Boolean(result.passed) };
    const snapshot = { version: 1, activity: ACTIVITY, kind: "pending-final", payload };
    if (bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("SCORM pending snapshot exceeds 4000 bytes");
    return snapshot;
  }

  function decodePending(snapshot) {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== "pending-final" || !onlyKeys(snapshot.payload, ["reviewJson", "score", "maxScore", "passed"])) throw new Error("Invalid pending envelope");
    if (typeof snapshot.payload.reviewJson !== "string" || !finite(snapshot.payload.score) || !finite(snapshot.payload.maxScore) || typeof snapshot.payload.passed !== "boolean" || bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("Invalid pending payload");
    let review;
    try { review = JSON.parse(snapshot.payload.reviewJson); } catch { throw new Error("Invalid nested review JSON"); }
    const state = decodeSnapshot(review, "review");
    return { payload: clone(snapshot.payload), snapshot: review, state };
  }

  function legalNextAction(state) {
    if (state.phase === "summary") return "return-to-question-or-submit";
    const question = state.questions[state.currentQuestion];
    if (question.phase === "formulas" && !M.formulaExpectations(question)) return M.isCorrectDecomposition(question) && question.theta === null ? "place-theta" : "repair-geometry";
    return ({ directions: "draw-directions", perpendiculars: "draw-perpendiculars", components: "draw-components", angle: "place-theta", formulas: "answer-formulas" })[question.phase];
  }

  function productionRoundTrip(state) {
    return decodeDraft(encodeDraft(state));
  }

  return Object.freeze({ ACTIVITY, SCHEMA_VERSION, MAX_SNAPSHOT_BYTES, SCENARIO_IDS, WORLD_BOUNDS, clone, bytes, freshDraft, validateQuestion, validate, assertValid, canonicalDraft, canonicalReview, encodeDraft, encodeReview, decodeDraft, decodeReview, makeSnapshot, decodeSnapshot, pendingEnvelope, decodePending, legalNextAction, productionRoundTrip });
});
