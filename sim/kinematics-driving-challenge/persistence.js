(function (root, factory) {
  const levels = typeof module === "object" && module.exports ? require("./level-definitions.js") : root.KinematicsDrivingLevels;
  const model = typeof module === "object" && module.exports ? require("./driving-model.js") : root.KinematicsDrivingModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.KinematicsDrivingScoring;
  const api = factory(levels, model, scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Levels, Model, Scoring) {
  "use strict";

  const VERSION = 1;
  const GRAPH_MODES = ["vt", "xt", "hidden"];
  const LEVEL_IDS = Levels.LEVELS.map((level) => level.id);
  const PHASE_VARIANTS = Object.freeze({
    practice: ["ready", "paused"],
    level: ["briefing", "paused", "analysis", "accepted", "review-retry-briefing", "review-retry-paused", "review-retry-analysis"],
    "graph-check": ["exploring", "answered", "review-edit-exploring", "review-edit-answered"],
    review: ["incomplete", "complete"],
    submitted: ["locked"]
  });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let text = "";
    bytes.forEach((byte) => { text += String.fromCharCode(byte); });
    return btoa(text);
  }
  function base64ToBytes(text) {
    try {
      if (typeof text !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) return null;
      const buffer = typeof Buffer !== "undefined" ? Buffer.from(text, "base64") : Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
      return Uint8Array.from(buffer);
    } catch { return null; }
  }
  function packControls(codes) {
    if (!Array.isArray(codes) || codes.some((code) => !Model.validCode(code))) throw new Error("Invalid control stream");
    const bytes = new Uint8Array(Math.ceil(codes.length * 3 / 8));
    codes.forEach((code, index) => {
      const bit = index * 3;
      const byte = Math.floor(bit / 8);
      const shift = bit % 8;
      bytes[byte] |= code << shift;
      if (shift > 5) bytes[byte + 1] |= code >> (8 - shift);
    });
    return bytesToBase64(bytes);
  }
  function unpackControls(packed, tickCount) {
    if (!Number.isInteger(tickCount) || tickCount < 0) return null;
    const bytes = base64ToBytes(packed);
    const expected = Math.ceil(tickCount * 3 / 8);
    if (!bytes || bytes.length !== expected || bytesToBase64(bytes) !== packed) return null;
    const codes = [];
    for (let index = 0; index < tickCount; index += 1) {
      const bit = index * 3;
      const byte = Math.floor(bit / 8);
      const shift = bit % 8;
      const value = ((bytes[byte] >> shift) | (shift > 5 ? bytes[byte + 1] << (8 - shift) : 0)) & 7;
      if (!Model.validCode(value)) return null;
      codes.push(value);
    }
    const usedBits = tickCount * 3;
    if (bytes.length && usedBits % 8) {
      const used = usedBits % 8;
      if ((bytes[bytes.length - 1] & ~((1 << used) - 1)) !== 0) return null;
    }
    return codes;
  }
  function packedRun(run, includeRevision = true) {
    if (!run || !Array.isArray(run.codes)) return null;
    const output = { n: run.codes.length, c: packControls(run.codes) };
    if (includeRevision) output.r = run.revision;
    return output;
  }
  function unpackRun(value, level, selected) {
    if (!value || !Number.isInteger(value.n) || value.n < 0 || value.n > level.maxTicks || typeof value.c !== "string") return null;
    const codes = unpackControls(value.c, value.n);
    if (!codes) return null;
    if (selected && (!Number.isInteger(value.r) || value.r < 1 || !Model.isTerminalRun(level, codes))) return null;
    return selected ? { revision: value.r, codes } : { codes };
  }
  function initialState() {
    return {
      v: VERSION, physicsVersion: Model.PHYSICS_VERSION, levelSetVersion: Levels.LEVEL_SET_VERSION,
      phase: "practice", variant: "ready", currentItem: "practice", returnToReview: false, graphMode: "vt",
      selectedRuns: {}, candidateRun: null,
      graphCheckpoint: { sourceLevelId: "level2", sourceRunRevision: null, viewedXt: false, viewedVt: false, answerId: null }
    };
  }
  function encode(source) {
    const state = normalizeRuntimeForSave(source);
    if (!validateState(state, false)) throw new Error("Invalid driving draft");
    const answer = {
      v: VERSION, p: Model.PHYSICS_VERSION, l: Levels.LEVEL_SET_VERSION,
      h: state.phase, q: state.variant, i: state.currentItem, b: state.returnToReview ? 1 : 0,
      g: state.graphMode,
      s: Object.fromEntries(Object.entries(state.selectedRuns).map(([id, run]) => [id, packedRun(run)])),
      c: state.candidateRun ? { o: state.candidateRun.ownerId, ...packedRun(state.candidateRun, false) } : null,
      k: {
        s: state.graphCheckpoint.sourceLevelId, r: state.graphCheckpoint.sourceRunRevision,
        x: state.graphCheckpoint.viewedXt ? 1 : 0, y: state.graphCheckpoint.viewedVt ? 1 : 0,
        a: state.graphCheckpoint.answerId
      }
    };
    return answer;
  }
  function decode(answer) {
    if (!answer || answer.v !== VERSION || answer.p !== Model.PHYSICS_VERSION || answer.l !== Levels.LEVEL_SET_VERSION ||
        answer.s === null || typeof answer.s !== "object" || Array.isArray(answer.s) || !answer.k ||
        ![0, 1].includes(answer.b) || ![0, 1].includes(answer.k.x) || ![0, 1].includes(answer.k.y)) return null;
    const selectedRuns = {};
    for (const [id, packed] of Object.entries(answer.s)) {
      const level = Levels.levelById(id);
      if (!LEVEL_IDS.includes(id) || selectedRuns[id]) return null;
      const run = unpackRun(packed, level, true);
      if (!run) return null;
      selectedRuns[id] = run;
    }
    let candidateRun = null;
    if (answer.c != null) {
      const owner = answer.c.o;
      const level = Levels.levelById(owner);
      if (!level) return null;
      const run = unpackRun(answer.c, level, false);
      if (!run) return null;
      candidateRun = { ownerId: owner, codes: run.codes };
    }
    const state = {
      v: VERSION, physicsVersion: answer.p, levelSetVersion: answer.l,
      phase: answer.h, variant: answer.q, currentItem: answer.i, returnToReview: answer.b === 1,
      graphMode: answer.g, selectedRuns, candidateRun,
      graphCheckpoint: {
        sourceLevelId: answer.k.s, sourceRunRevision: answer.k.r,
        viewedXt: answer.k.x === 1, viewedVt: answer.k.y === 1, answerId: answer.k.a
      }
    };
    return validateState(state, false) ? state : null;
  }
  function normalizeRuntimeForSave(source) {
    const state = clone(source);
    const wasRunning = state.runtime?.running === true;
    delete state.runtime;
    delete state.result;
    delete state.locked;
    if (state.phase === "practice" && state.candidateRun?.codes?.length) state.variant = "paused";
    if (state.phase === "level" && wasRunning) state.variant = state.returnToReview ? "review-retry-paused" : "paused";
    return state;
  }
  function validateState(state, reviewOnly) {
    if (!state || state.v !== VERSION || state.physicsVersion !== Model.PHYSICS_VERSION || state.levelSetVersion !== Levels.LEVEL_SET_VERSION ||
        !PHASE_VARIANTS[state.phase]?.includes(state.variant) || !GRAPH_MODES.includes(state.graphMode) ||
        typeof state.returnToReview !== "boolean" || !state.selectedRuns || typeof state.selectedRuns !== "object" ||
        !validCheckpoint(state.graphCheckpoint, state.selectedRuns)) return false;
    for (const [id, run] of Object.entries(state.selectedRuns)) {
      const level = Levels.levelById(id);
      if (!LEVEL_IDS.includes(id) || !Number.isInteger(run.revision) || run.revision < 1 ||
          !Array.isArray(run.codes) || run.codes.length > level.maxTicks || !Model.isTerminalRun(level, run.codes)) return false;
    }
    const candidate = state.candidateRun;
    if (candidate) {
      const owner = Levels.levelById(candidate.ownerId);
      if (!owner || !Array.isArray(candidate.codes) || candidate.codes.length > owner.maxTicks || candidate.codes.some((code) => !Model.validCode(code))) return false;
    }
    if (reviewOnly) {
      return state.phase === "submitted" && state.variant === "locked" && state.currentItem === "review" &&
        !state.returnToReview && candidate === null && allComplete(state);
    }
    if (state.phase === "practice") {
      if (state.currentItem !== "practice" || state.returnToReview || (state.variant === "ready" ? candidate !== null : candidate?.ownerId !== "practice")) return false;
      if (state.variant === "paused" && Model.isTerminalRun(Levels.PRACTICE, candidate.codes)) return false;
    } else if (state.phase === "level") {
      if (!LEVEL_IDS.includes(state.currentItem)) return false;
      const retry = state.variant.startsWith("review-retry-");
      if (state.returnToReview !== retry) return false;
      if (retry && !state.selectedRuns[state.currentItem]) return false;
      const expectsCandidate = ["paused", "analysis", "review-retry-paused", "review-retry-analysis"].includes(state.variant);
      if (expectsCandidate !== Boolean(candidate) || (candidate && candidate.ownerId !== state.currentItem)) return false;
      if (candidate) {
        const terminal = Model.isTerminalRun(Levels.levelById(state.currentItem), candidate.codes);
        if (state.variant.endsWith("analysis") !== terminal) return false;
      }
      if (["accepted"].includes(state.variant) && !state.selectedRuns[state.currentItem]) return false;
      if (!expectsCandidate && candidate) return false;
    } else if (state.phase === "graph-check") {
      if (state.currentItem !== "checkpoint" || candidate || !state.selectedRuns[state.graphCheckpoint.sourceLevelId]) return false;
      if (state.graphCheckpoint.sourceRunRevision !== state.selectedRuns[state.graphCheckpoint.sourceLevelId].revision) return false;
      if (!Scoring.checkpointEligible(
        state.graphCheckpoint.sourceLevelId,
        state.selectedRuns[state.graphCheckpoint.sourceLevelId].codes
      )) return false;
      const edit = state.variant.startsWith("review-edit-");
      if (state.returnToReview !== edit) return false;
      const answered = state.variant.endsWith("answered");
      if (answered !== Boolean(state.graphCheckpoint.answerId)) return false;
    } else if (state.phase === "review") {
      if (state.currentItem !== "review" || state.returnToReview || candidate) return false;
      if (state.variant === "complete" ? !allComplete(state) : allComplete(state)) return false;
    } else if (state.phase === "submitted") {
      if (state.currentItem !== "review" || state.returnToReview || candidate || !allComplete(state)) return false;
    }
    return true;
  }
  function validCheckpoint(checkpoint, selectedRuns) {
    if (!checkpoint || !["level2", "level3"].includes(checkpoint.sourceLevelId) ||
        typeof checkpoint.viewedXt !== "boolean" || typeof checkpoint.viewedVt !== "boolean" ||
        ![null, Scoring.CHECKPOINT_ANSWER, "xt-curvature", "both-any", "xt-fixed-slope"].includes(checkpoint.answerId)) return false;
    const source = selectedRuns[checkpoint.sourceLevelId];
    if (checkpoint.sourceRunRevision == null) {
      return !source && checkpoint.answerId == null && !checkpoint.viewedXt && !checkpoint.viewedVt;
    }
    if (!source || checkpoint.sourceRunRevision !== source.revision) return false;
    if (checkpoint.answerId && !(checkpoint.viewedXt && checkpoint.viewedVt)) return false;
    return true;
  }
  function allComplete(state) {
    const source = state.selectedRuns[state.graphCheckpoint.sourceLevelId];
    return LEVEL_IDS.every((id) => state.selectedRuns[id]) && Boolean(state.graphCheckpoint.answerId) &&
      Boolean(source && Scoring.checkpointEligible(state.graphCheckpoint.sourceLevelId, source.codes));
  }
  function makeReview(source) {
    const state = clone(source);
    state.phase = "submitted"; state.variant = "locked"; state.currentItem = "review";
    state.returnToReview = false; state.candidateRun = null;
    if (!validateState(state, true)) throw new Error("Incomplete review");
    return encode(state);
  }
  function decodeReview(answer) {
    const state = decode(answer);
    return state && validateState(state, true) ? state : null;
  }
  function bytes(value) {
    const text = JSON.stringify(value);
    return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).length : Buffer.byteLength(text);
  }

  return {
    VERSION, GRAPH_MODES, LEVEL_IDS, PHASE_VARIANTS, initialState, packControls, unpackControls,
    encode, decode, validateState, allComplete, makeReview, decodeReview, bytes
  };
});
