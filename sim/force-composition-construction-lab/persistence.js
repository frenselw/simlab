(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./generator.js") : root.ForceCompositionGenerator,
    typeof module === "object" && module.exports ? require("./model.js") : root.ForceCompositionModel
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceCompositionPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Model) {
  "use strict";

  if (!Generator || !Model) throw new Error("Generator and model are required");

  const ACTIVITY = "force-composition-construction-lab";
  const SCHEMA_VERSION = 1;
  const GENERATOR_VERSION = 1;
  const MAX_SNAPSHOT_BYTES = 4000;
  const TYPES = Object.freeze(["parallelogram", "parallelogram", "head-to-tail-2", "head-to-tail-2", "head-to-tail-3"]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function bytes(value) {
    return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).length;
  }

  function onlyKeys(value, keys) {
    return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
  }

  function freshState(seed, generatorVersion = GENERATOR_VERSION) {
    const scenario = Generator.generateScenario({ seed, generatorVersion });
    return {
      schemaVersion: SCHEMA_VERSION,
      generatorVersion,
      seed,
      phase: "practice",
      currentQuestion: 0,
      answers: Model.freshAnswers(scenario)
    };
  }

  function validPoint10(value) {
    return Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
  }

  function validatePlacement(placement, force, question, index) {
    if (!onlyKeys(placement, ["mode", "tail10", "targetKey"])) return "placement-fields";
    if (placement.mode === "initial") return Object.keys(placement).length === 1 ? null : "initial-contamination";
    if (placement.mode === "free") {
      if (!validPoint10(placement.tail10) || "targetKey" in placement) return "free-placement-shape";
      const point = Model.fromPoint10(placement.tail10);
      const clamped = Model.clampForceTail(point, force);
      if (Math.abs(point.x - clamped.x) > Model.MODEL_EPSILON || Math.abs(point.y - clamped.y) > Model.MODEL_EPSILON) return "free-placement-bounds";
      return null;
    }
    if (placement.mode !== "snap" || typeof placement.targetKey !== "string" || "tail10" in placement) return "placement-mode";
    if (question.type === "parallelogram") return placement.targetKey === "ORIGIN" ? null : "parallelogram-target";
    const target = Model.targetForceIndex(placement.targetKey);
    if (placement.targetKey !== "ORIGIN" && (target < 0 || target >= question.forces.length || target === index)) return "chain-target";
    return null;
  }

  function validateAnchor(anchor10, answer, question) {
    if (anchor10 == null) return null;
    if (!validPoint10(anchor10)) return "anchor-shape";
    const point = Model.fromPoint10(anchor10);
    const forceIndex = answer.placements.findIndex((placement) => placement.mode === "snap" && placement.targetKey === "ORIGIN");
    if (forceIndex < 0) return "anchor-without-root";
    const clamped = Model.clampAnchor(point, question, question.type === "parallelogram" ? null : forceIndex);
    if (Math.abs(point.x - clamped.x) > Model.MODEL_EPSILON || Math.abs(point.y - clamped.y) > Model.MODEL_EPSILON) return "anchor-bounds";
    return null;
  }

  function validateLineEnd(end, targetKey) {
    const allowedTargets = Array.isArray(targetKey) ? targetKey : [targetKey];
    if (!onlyKeys(end, ["mode", "point10", "targetKey"])) return "line-end-fields";
    if (end.mode === "free") {
      if (!validPoint10(end.point10) || "targetKey" in end) return "free-line-shape";
      const point = Model.fromPoint10(end.point10);
      if (point.x < Model.FREE_LINE_INSET || point.x > Generator.WIDTH - Model.FREE_LINE_INSET ||
          point.y < Model.FREE_LINE_INSET || point.y > Generator.HEIGHT - Model.FREE_LINE_INSET) return "free-line-bounds";
      return null;
    }
    if (end.mode !== "snap" || !allowedTargets.includes(end.targetKey)) return "line-snap-target";
    if (end.targetKey === "PARALLEL") {
      if (!validPoint10(end.point10)) return "parallel-line-shape";
      const point = Model.fromPoint10(end.point10);
      if (point.x < Model.FREE_LINE_INSET || point.x > Generator.WIDTH - Model.FREE_LINE_INSET ||
          point.y < Model.FREE_LINE_INSET || point.y > Generator.HEIGHT - Model.FREE_LINE_INSET) return "parallel-line-bounds";
      return null;
    }
    if (end.targetKey === Model.GUIDE_INTERSECTION_KEY) {
      if (!validPoint10(end.point10)) return "guide-intersection-line-shape";
      const point = Model.fromPoint10(end.point10);
      if (point.x < Model.FREE_LINE_INSET || point.x > Generator.WIDTH - Model.FREE_LINE_INSET ||
          point.y < Model.FREE_LINE_INSET || point.y > Generator.HEIGHT - Model.FREE_LINE_INSET) return "guide-intersection-line-bounds";
      return null;
    }
    if ("point10" in end) return "line-snap-target";
    return null;
  }

  function validateParallelogram(answer, question, questionIndex) {
    if (!onlyKeys(answer, ["type", "anchor10", "placements", "guides", "resultant"]) || !Array.isArray(answer.placements) || answer.placements.length !== 2 ||
        !Array.isArray(answer.guides) || answer.guides.length !== 2) return "parallelogram-shape";
    const anchorIssue = validateAnchor(answer.anchor10, answer, question);
    if (anchorIssue) return anchorIssue;
    for (let index = 0; index < 2; index += 1) {
      const issue = validatePlacement(answer.placements[index], question.forces[index], question, index);
      if (issue) return issue;
    }
    const common = Model.commonOrigin(answer);
    const origins = new Set();
    for (const guide of answer.guides) {
      if (guide === null) continue;
      if (!common) return "guide-before-common-origin";
      if (!onlyKeys(guide, ["originKey", "end"]) || typeof guide.originKey !== "string") return "guide-shape";
      const allowedOrigins = questionIndex === 0 ? ["F1_HEAD", "F2_HEAD"] : ["ORIGIN", "F1_HEAD", "F2_HEAD"];
      if (!allowedOrigins.includes(guide.originKey)) return "guide-origin";
      if (origins.has(guide.originKey)) return "duplicate-guide-origin";
      origins.add(guide.originKey);
      const endIssue = validateLineEnd(guide.end, guide.end?.targetKey === "PARALLEL" ? "PARALLEL" : "CORNER");
      if (endIssue) return endIssue;
      if (guide.end.mode === "snap" && !["F1_HEAD", "F2_HEAD"].includes(guide.originKey)) return "snapped-guide-origin";
      if (guide.end.mode === "snap" && guide.end.targetKey === "PARALLEL" && !Model.guideEndIsParallel(answer, question, guide)) return "guide-not-parallel";
    }
    if (answer.resultant !== null) {
      if (!Model.resultantAvailable(answer, question)) return "resultant-before-guides";
      if (!onlyKeys(answer.resultant, ["originKey", "originPoint10", "end"])) return "resultant-shape";
      const allowed = ["ORIGIN", "F1_TAIL", "F1_HEAD", "F2_TAIL", "F2_HEAD", "CORNER", "FREE"];
      if (!allowed.includes(answer.resultant.originKey)) return "resultant-origin";
      if (answer.resultant.originKey === "FREE") {
        if (!Model.validPoint10(answer.resultant.originPoint10)) return "resultant-origin-point";
        const point = Model.fromPoint10(answer.resultant.originPoint10);
        const clamped = Model.clampLinePoint(point);
        if (Math.abs(point.x - clamped.x) > Model.MODEL_EPSILON || Math.abs(point.y - clamped.y) > Model.MODEL_EPSILON) return "resultant-origin-bounds";
      } else if ("originPoint10" in answer.resultant) return "resultant-origin-point";
      const issue = validateLineEnd(answer.resultant.end, ["ORIGIN", "F1_HEAD", "F2_HEAD", "CORNER", Model.GUIDE_INTERSECTION_KEY]);
      if (issue) return issue;
      if (answer.resultant.end.targetKey === Model.GUIDE_INTERSECTION_KEY) {
        const intersection = Model.guideIntersectionPoint(answer, question);
        const point = Model.fromPoint10(answer.resultant.end.point10);
        if (!intersection || Model.distance(point, intersection) > Model.POSITION_QUANTUM + Model.MODEL_EPSILON) return "resultant-guide-intersection";
      }
    }
    return null;
  }

  function validateChain(answer, question, questionIndex) {
    if (!onlyKeys(answer, ["type", "anchor10", "placements", "resultant"]) || !Array.isArray(answer.placements) || answer.placements.length !== question.forces.length) return "chain-shape";
    const anchorIssue = validateAnchor(answer.anchor10, answer, question);
    if (anchorIssue) return anchorIssue;
    for (let index = 0; index < answer.placements.length; index += 1) {
      const issue = validatePlacement(answer.placements[index], question.forces[index], question, index);
      if (issue) return issue;
    }
    let chain;
    try { chain = Model.chainInfo(answer, question); }
    catch { return "chain-resolution"; }
    if (!chain.valid) return chain.reason || "chain-invalid";
    if (answer.resultant !== null) {
      if (!chain.complete) return "resultant-before-chain";
      if (!onlyKeys(answer.resultant, ["originKey", "originPoint10", "end"])) return "resultant-shape";
      const endpointKeys = ["ORIGIN"];
      for (let index = 0; index < question.forces.length; index += 1) endpointKeys.push(Model.tailKey(index), Model.headKey(index));
      endpointKeys.push("CHAIN_END");
      const allowed = [...endpointKeys, "FREE"];
      if (!allowed.includes(answer.resultant.originKey)) return "resultant-origin";
      const issue = validateLineEnd(answer.resultant.end, endpointKeys);
      if (issue) return issue;
      if (answer.resultant.originKey === "FREE") {
        if (!Model.validPoint10(answer.resultant.originPoint10)) return "resultant-origin-point";
        const point = Model.fromPoint10(answer.resultant.originPoint10);
        const clamped = Model.clampLinePoint(point);
        if (Math.abs(point.x - clamped.x) > Model.MODEL_EPSILON || Math.abs(point.y - clamped.y) > Model.MODEL_EPSILON) return "resultant-origin-bounds";
      } else if ("originPoint10" in answer.resultant) return "resultant-origin-point";
    }
    return null;
  }

  function validateAnswers(answers, scenario) {
    if (!Array.isArray(answers) || answers.length !== 5) return { ok: false, reason: "answer-count" };
    for (let index = 0; index < 5; index += 1) {
      const answer = answers[index];
      const question = scenario.questions[index];
      if (!answer || answer.type !== TYPES[index] || question.type !== TYPES[index]) return { ok: false, reason: `question-type-${index}` };
      const reason = question.type === "parallelogram" ? validateParallelogram(answer, question, index) : validateChain(answer, question, index);
      if (reason) return { ok: false, reason: `${reason}-${index}` };
    }
    return { ok: true };
  }

  function validate(value, options = {}) {
    const kind = options.kind || "draft";
    const topKeys = kind === "draft" ? ["schemaVersion", "generatorVersion", "seed", "phase", "currentQuestion", "answers"]
      : ["schemaVersion", "generatorVersion", "seed", "answers"];
    if (!onlyKeys(value, topKeys) || Object.keys(value).length !== topKeys.length) return { ok: false, reason: "top-level-shape" };
    if (value.schemaVersion !== SCHEMA_VERSION || value.generatorVersion !== GENERATOR_VERSION || !Generator.validateSeed(value.seed)) return { ok: false, reason: "version-or-seed" };
    if (kind === "draft" && (!["practice", "summary"].includes(value.phase) || !Number.isInteger(value.currentQuestion) || value.currentQuestion < 0 || value.currentQuestion > 4)) return { ok: false, reason: "phase-current" };
    let scenario;
    try { scenario = Generator.generateScenario({ seed: value.seed, generatorVersion: value.generatorVersion }); }
    catch { return { ok: false, reason: "scenario" }; }
    const answerValidation = validateAnswers(value.answers, scenario);
    if (!answerValidation.ok) return answerValidation;
    return { ok: true, scenario };
  }

  function assertValid(value, options) {
    const validation = validate(value, options);
    if (!validation.ok) throw new Error(`Invalid force-composition ${options?.kind || "draft"}: ${validation.reason}`);
    return validation;
  }

  function canonicalDraft(state) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatorVersion: state.generatorVersion,
      seed: state.seed,
      phase: state.phase,
      currentQuestion: state.currentQuestion,
      answers: clone(state.answers)
    };
  }

  function canonicalReview(state) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatorVersion: state.generatorVersion,
      seed: state.seed,
      answers: clone(state.answers)
    };
  }

  function encodeDraft(state) {
    const value = canonicalDraft(state);
    assertValid(value, { kind: "draft" });
    return value;
  }

  function encodeReview(state) {
    const value = canonicalReview(state);
    assertValid(value, { kind: "review" });
    return value;
  }

  function decodeDraft(value) {
    assertValid(value, { kind: "draft" });
    return canonicalDraft(value);
  }

  function decodeReview(value) {
    assertValid(value, { kind: "review" });
    return canonicalReview(value);
  }

  function makeSnapshot(kind, state, result) {
    const answer = kind === "draft" ? encodeDraft(state) : encodeReview(state);
    const snapshot = { version: 1, activity: ACTIVITY, kind, answer };
    if (kind === "review") {
      if (!result || !Number.isFinite(result.score) || typeof result.passed !== "boolean") throw new Error("Review result is required");
      snapshot.score = result.score;
      snapshot.passed = result.passed;
    }
    if (bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("SCORM snapshot exceeds 4000 bytes");
    return snapshot;
  }

  function decodeSnapshot(snapshot, kind) {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== kind || snapshot.answer == null || bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("Invalid snapshot envelope");
    return kind === "draft" ? decodeDraft(snapshot.answer) : decodeReview(snapshot.answer);
  }

  function canonicalReviewEqual(first, second) {
    try { return JSON.stringify(encodeReview(first)) === JSON.stringify(encodeReview(second)); }
    catch { return false; }
  }

  function pendingEnvelope(reviewSnapshot, result) {
    const reviewJson = JSON.stringify(reviewSnapshot);
    const payload = { reviewJson, score: Number(result.score), maxScore: Number(result.maxScore || 100), passed: Boolean(result.passed) };
    const snapshot = { version: 1, activity: ACTIVITY, kind: "pending-final", payload };
    if (bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("SCORM pending snapshot exceeds 4000 bytes");
    return snapshot;
  }

  function decodePending(pendingSnapshot) {
    if (!pendingSnapshot || pendingSnapshot.version !== 1 || pendingSnapshot.activity !== ACTIVITY || pendingSnapshot.kind !== "pending-final" || !onlyKeys(pendingSnapshot.payload, ["reviewJson", "score", "maxScore", "passed"])) throw new Error("Invalid pending envelope");
    const payload = pendingSnapshot.payload;
    if (typeof payload.reviewJson !== "string" || !Number.isFinite(payload.score) || !Number.isFinite(payload.maxScore) || typeof payload.passed !== "boolean" || bytes(pendingSnapshot) > MAX_SNAPSHOT_BYTES) throw new Error("Invalid pending payload");
    let review;
    try { review = JSON.parse(payload.reviewJson); } catch { throw new Error("Invalid nested review JSON"); }
    const answer = decodeSnapshot(review, "review");
    const canonical = makeSnapshot("review", answer, { score: review.score, passed: review.passed });
    if (JSON.stringify(canonical.answer) !== JSON.stringify(review.answer)) throw new Error("Nested review answer is not canonical");
    return { payload: clone(payload), snapshot: review, answer };
  }

  function derivedStatus(state, scenario) {
    return {
      phase: state.phase,
      currentQuestion: state.currentQuestion,
      variants: state.answers.map((answer, index) => Model.derivedVariant(answer, scenario.questions[index])),
      completed: state.answers.map((answer, index) => Model.questionComplete(answer, scenario.questions[index]))
    };
  }

  function legalNextAction(state, scenario) {
    if (state.phase === "summary") return "return-to-question-or-submit";
    const variant = Model.derivedVariant(state.answers[state.currentQuestion], scenario.questions[state.currentQuestion]);
    return ({ fresh: "translate-force", placing: "translate-force", guides: "draw-guide", resultant: "draw-resultant", complete: "revisit-or-navigate" })[variant];
  }

  function productionRoundTrip(state) {
    return decodeDraft(encodeDraft(state));
  }

  return Object.freeze({
    ACTIVITY, SCHEMA_VERSION, GENERATOR_VERSION, MAX_SNAPSHOT_BYTES, TYPES,
    clone, bytes, freshState, validatePlacement, validateLineEnd, validateParallelogram, validateChain,
    validateAnswers, validate, assertValid, canonicalDraft, canonicalReview,
    encodeDraft, encodeReview, decodeDraft, decodeReview, makeSnapshot, decodeSnapshot,
    canonicalReviewEqual, pendingEnvelope, decodePending, derivedStatus, legalNextAction, productionRoundTrip
  });
});
