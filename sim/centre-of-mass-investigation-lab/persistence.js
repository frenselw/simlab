(function (root, factory) {
  const G = typeof module === "object" && module.exports ? require("./generator.js") : root.CentreMassGenerator;
  const M = typeof module === "object" && module.exports ? require("./model.js") : root.CentreMassModel;
  const S = typeof module === "object" && module.exports ? require("./scoring.js") : root.CentreMassScoring;
  const api = factory(G, M, S);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Model, Scoring) {
  "use strict";
  const VERSION = 1;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const exact = (value, keys) => Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)));
  function initial(seed) {
    Generator.generate(seed, Generator.VERSION);
    return { v: VERSION, generatorVersion: Generator.VERSION, rubricVersion: Scoring.RUBRIC_VERSION, seed,
      phase: "part1", variant: "seeking-new", returnToCheck: false,
      part1: { supportEpisodes: [], markX: null },
      part2: { hangRecords: [], activeHoleKey: null, lines: [], mark: null },
      part3: { view: clone(Generator.generate(seed).part3.initialView), observations: [], selectedCandidateKey: null } };
  }
  function variantFor(state) {
    const suffix = state.returnToCheck ? "redo" : "normal";
    if (state.phase === "part1") return state.part1.markX != null ? `marked-${suffix}` :
      state.part1.supportEpisodes.some((item) => item.outcome === "balanced") ? `balanced-${suffix}` : `seeking-${state.returnToCheck ? "redo" : "new"}`;
    if (state.phase === "part2") {
      if (state.part2.mark) return `marked-${suffix}`;
      if (state.part2.activeHoleKey) return `${state.part2.lines.length ? "settled-next" : "settled-first"}-${suffix}`;
      if (state.part2.lines.length >= 2) return `between-multi-${suffix}`;
      if (state.part2.lines.length === 1) return `between-one-${suffix}`;
      return `ready-${state.returnToCheck ? "redo" : "new"}`;
    }
    if (state.phase === "part3") return state.part3.selectedCandidateKey ? `selected-${suffix}` :
      state.part3.observations.length === 2 ? `eligible-${suffix}` : `observing-${state.returnToCheck ? "redo" : "new"}`;
    return state.phase === "check" ? "complete" : state.phase === "review" ? "submitted" : null;
  }
  function validPoint(point) { return exact(point, ["x", "y"]) && [point.x, point.y].every(Number.isFinite) && Math.abs(point.x) <= 1.5 && Math.abs(point.y) <= 1.5; }
  function validate(state, review = false) {
    if (!exact(state, ["v", "generatorVersion", "rubricVersion", "seed", "phase", "variant", "returnToCheck", "part1", "part2", "part3"]) ||
      state.v !== VERSION || state.generatorVersion !== Generator.VERSION || state.rubricVersion !== Scoring.RUBRIC_VERSION ||
      !Number.isInteger(state.seed) || state.seed < 0 || state.seed > 0xffffffff || typeof state.returnToCheck !== "boolean") return false;
    let problem; try { problem = Generator.generate(state.seed, state.generatorVersion); } catch { return false; }
    if (!exact(state.part1, ["supportEpisodes", "markX"]) || !Array.isArray(state.part1.supportEpisodes) || state.part1.supportEpisodes.length > 12 ||
      !state.part1.supportEpisodes.every((item) => exact(item, ["x", "outcome"]) && Number.isFinite(item.x) && item.x >= 0 && item.x <= 1 && item.outcome === Model.supportOutcome(item.x, problem.part1.xCm)) ||
      !(state.part1.markX === null || Number.isFinite(state.part1.markX) && state.part1.markX >= 0 && state.part1.markX <= 1)) return false;
    const balanced = state.part1.supportEpisodes.some((item) => item.outcome === "balanced");
    if (state.part1.markX !== null && !balanced) return false;
    if (!exact(state.part2, ["hangRecords", "activeHoleKey", "lines", "mark"]) || !Array.isArray(state.part2.hangRecords) || !Array.isArray(state.part2.lines) ||
      state.part2.hangRecords.length > 4 || state.part2.lines.length > 4 || !(state.part2.mark === null || validPoint(state.part2.mark))) return false;
    const holeMap = new Map(problem.part2.holes.map((hole) => [hole.key, hole]));
    const hangKeys = state.part2.hangRecords.map((item) => exact(item, ["holeKey"]) ? item.holeKey : null);
    if (hangKeys.some((key) => !holeMap.has(key)) || new Set(hangKeys).size !== hangKeys.length ||
      !(state.part2.activeHoleKey === null || hangKeys.includes(state.part2.activeHoleKey))) return false;
    const lineKeys = state.part2.lines.map((line) => line?.holeKey);
    if (new Set(lineKeys).size !== lineKeys.length || !state.part2.lines.every((line) => exact(line, ["holeKey", "a", "b"]) && hangKeys.includes(line.holeKey) &&
      Model.lineValid(line, holeMap.get(line.holeKey), problem.part2.centre, problem.part2.size))) return false;
    if (state.part2.activeHoleKey !== null && lineKeys.includes(state.part2.activeHoleKey) ||
        hangKeys.some((key) => key !== state.part2.activeHoleKey && !lineKeys.includes(key))) return false;
    let enoughAngle = false;
    for (let i = 0; i < state.part2.lines.length; i += 1) for (let j = i + 1; j < state.part2.lines.length; j += 1)
      if (Model.acuteLineAngle(state.part2.lines[i], state.part2.lines[j]) >= 25) enoughAngle = true;
    if (state.part2.mark && (hangKeys.length < 2 || state.part2.lines.length < 2 || !enoughAngle)) return false;
    if (!exact(state.part3, ["view", "observations", "selectedCandidateKey"]) || !exact(state.part3.view, ["yaw10", "pitch10"]) ||
      !Model.canonicalView(state.part3.view) || JSON.stringify(state.part3.view) !== JSON.stringify(Model.canonicalView(state.part3.view)) ||
      !Array.isArray(state.part3.observations) || state.part3.observations.length > 2 ||
      !state.part3.observations.every((item) => exact(item, ["yaw10", "pitch10"]) && JSON.stringify(item) === JSON.stringify(Model.canonicalView(item))) ||
      !(state.part3.selectedCandidateKey === null || problem.part3.candidates.some((item) => item.key === state.part3.selectedCandidateKey))) return false;
    if (state.part3.selectedCandidateKey !== null && !Model.validObservations(problem.part3.initialView, state.part3.observations)) return false;
    if (!["part1", "part2", "part3", "check", "review"].includes(state.phase) || state.variant !== variantFor(state)) return false;
    if (state.phase === "part2") {
      const stem = state.variant.replace(/-(?:normal|redo|new)$/, "");
      if (stem === "ready" && (hangKeys.length !== 0 || lineKeys.length !== 0 || state.part2.activeHoleKey !== null) ||
          stem === "settled-first" && (hangKeys.length !== 1 || lineKeys.length !== 0 || state.part2.activeHoleKey === null) ||
          stem === "between-one" && (hangKeys.length !== 1 || lineKeys.length !== 1 || state.part2.activeHoleKey !== null) ||
          stem === "settled-next" && (lineKeys.length < 1 || lineKeys.length > 3 || hangKeys.length !== lineKeys.length + 1 || state.part2.activeHoleKey === null) ||
          stem === "between-multi" && (lineKeys.length < 2 || lineKeys.length > 4 || hangKeys.length !== lineKeys.length || state.part2.activeHoleKey !== null || !enoughAngle) ||
          stem === "marked" && (lineKeys.length < 2 || lineKeys.length > 4 || hangKeys.length !== lineKeys.length || state.part2.activeHoleKey !== null || !enoughAngle || !state.part2.mark)) return false;
    }
    const p1Complete = balanced && state.part1.markX !== null, p2Complete = Boolean(state.part2.mark), p3Complete = state.part3.selectedCandidateKey !== null;
    if (!state.returnToCheck) {
      if ((state.phase === "part2" || state.phase === "part3" || state.phase === "check" || state.phase === "review") && !p1Complete) return false;
      if ((state.phase === "part3" || state.phase === "check" || state.phase === "review") && !p2Complete) return false;
      if ((state.phase === "check" || state.phase === "review") && !p3Complete) return false;
      const part2Pristine = hangKeys.length === 0 && state.part2.activeHoleKey === null && state.part2.lines.length === 0 && state.part2.mark === null;
      const part3Pristine = state.part3.observations.length === 0 && state.part3.selectedCandidateKey === null &&
        JSON.stringify(state.part3.view) === JSON.stringify(problem.part3.initialView);
      if (state.phase === "part1" && (!part2Pristine || !part3Pristine)) return false;
      if (state.phase === "part2" && !part3Pristine) return false;
    } else {
      if (!["part1", "part2", "part3"].includes(state.phase)) return false;
      if (state.phase === "part1" && (!p2Complete || !p3Complete) || state.phase === "part2" && (!p1Complete || !p3Complete) ||
          state.phase === "part3" && (!p1Complete || !p2Complete)) return false;
    }
    if ((state.phase === "check" || state.phase === "review") && state.returnToCheck) return false;
    if (review && state.phase !== "review") return false;
    return true;
  }
  function encode(state) { if (!validate(state)) throw new Error("Invalid centre-of-mass draft"); return clone(state); }
  function decode(value) { try { const next = clone(value); return validate(next) ? next : null; } catch { return null; } }
  function release(state, x) {
    if (!validate(state) || state.phase !== "part1" || state.part1.markX !== null || !Number.isFinite(x)) return null;
    const next = clone(state), problem = Generator.generate(next.seed), item = { x: Math.max(0, Math.min(1, x)), outcome: null };
    item.outcome = Model.supportOutcome(item.x, problem.part1.xCm); next.part1.supportEpisodes.push(item);
    if (next.part1.supportEpisodes.length > 12) next.part1.supportEpisodes.shift(); next.variant = variantFor(next); return next;
  }
  function markPart1(state, markX) { const next = clone(state); if (!validate(state) || state.phase !== "part1" || !state.part1.supportEpisodes.some((x) => x.outcome === "balanced") || !Number.isFinite(markX) || markX < 0 || markX > 1) return null; next.part1.markX = markX; next.variant = variantFor(next); return next; }
  function confirmPart1(state) { if (!validate(state) || state.phase !== "part1" || state.part1.markX === null) return null; const next = clone(state); if (next.returnToCheck) { next.phase = "check"; next.returnToCheck = false; } else next.phase = "part2"; next.variant = variantFor(next); return next; }
  function settleHole(state, key) { if (!validate(state) || state.phase !== "part2" || state.part2.activeHoleKey || state.part2.lines.some((x) => x.holeKey === key)) return null; const problem = Generator.generate(state.seed); if (!problem.part2.holes.some((x) => x.key === key)) return null; const next = clone(state); if (!next.part2.hangRecords.some((x) => x.holeKey === key)) next.part2.hangRecords.push({ holeKey: key }); next.part2.activeHoleKey = key; next.variant = variantFor(next); return next; }
  function traceVertical(state) { if (!validate(state) || state.phase !== "part2" || !state.part2.activeHoleKey) return null; const next = clone(state), problem = Generator.generate(state.seed), hole = problem.part2.holes.find((x) => x.key === state.part2.activeHoleKey), centre = problem.part2.centre; const dx = centre.x - hole.x, dy = centre.y - hole.y, length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length, half = 0.36; next.part2.lines = next.part2.lines.filter((x) => x.holeKey !== hole.key); next.part2.lines.push({ holeKey: hole.key, a: [hole.x - ux * half, hole.y - uy * half], b: [hole.x + ux * half, hole.y + uy * half] }); next.part2.activeHoleKey = null; next.variant = variantFor(next); return validate(next) ? next : null; }
  function recordLine(state, line) { if (!validate(state) || state.phase !== "part2" || !state.part2.activeHoleKey || line?.holeKey !== state.part2.activeHoleKey) return null; const next = clone(state); next.part2.lines = next.part2.lines.filter((item) => item.holeKey !== line.holeKey); next.part2.lines.push(clone(line)); next.part2.activeHoleKey = null; next.variant = variantFor(next); return validate(next) ? next : null; }
  function markPart2(state, mark) { const next = clone(state); if (!validate(state) || state.phase !== "part2" || state.part2.activeHoleKey || !validPoint(mark)) return null; next.part2.mark = clone(mark); next.variant = variantFor(next); return validate(next) ? next : null; }
  function confirmPart2(state) { if (!validate(state) || state.phase !== "part2" || !state.part2.mark) return null; const next = clone(state); if (next.returnToCheck) { next.phase = "check"; next.returnToCheck = false; } else next.phase = "part3"; next.variant = variantFor(next); return next; }
  function setView(state, view, record = true) { if (!validate(state) || state.phase !== "part3") return null; const current = Model.canonicalView(view); if (!current) return null; const next = clone(state); next.part3.view = current; const problem = Generator.generate(next.seed); if (record && next.part3.observations.length === 0 && Model.orientationDifference(problem.part3.initialView, current) >= 21) next.part3.observations.push(current); else if (record && next.part3.observations.length === 1 && Model.orientationDifference(next.part3.observations[0], current) >= 36) next.part3.observations.push(current); next.variant = variantFor(next); return next; }
  function selectPart3(state, key) { if (!validate(state) || state.phase !== "part3" || !Model.validObservations(Generator.generate(state.seed).part3.initialView, state.part3.observations) || !Generator.LABELS.includes(key)) return null; const next = clone(state); next.part3.selectedCandidateKey = key; next.variant = variantFor(next); return next; }
  function confirmPart3(state) { if (!validate(state) || state.phase !== "part3" || !state.part3.selectedCandidateKey) return null; const next = clone(state); next.phase = "check"; next.returnToCheck = false; next.variant = variantFor(next); return next; }
  function redo(state, part) { if (!validate(state) || state.phase !== "check" || ![1, 2, 3].includes(part)) return null; const next = clone(state); next.phase = `part${part}`; next.returnToCheck = true; if (part === 1) next.part1 = { supportEpisodes: [], markX: null }; if (part === 2) next.part2 = { hangRecords: [], activeHoleKey: null, lines: [], mark: null }; if (part === 3) next.part3 = { view: clone(Generator.generate(next.seed).part3.initialView), observations: [], selectedCandidateKey: null }; next.variant = variantFor(next); return next; }
  function makeReview(state) { if (!validate(state) || state.phase !== "check") return null; const next = clone(state); next.phase = "review"; next.variant = "submitted"; return validate(next, true) ? next : null; }
  function fromReview(value) { try { const next = clone(value); return validate(next, true) ? next : null; } catch { return null; } }
  function lifecyclePolicy(kind, outcome) { const key = kind === "startup" ? outcome : outcome?.activityState || "retry"; return { key, editable: kind === "startup" ? key === "editable" : key === "retry" && outcome?.retryable === true, showScore: kind === "startup" ? key === "review" : ["success", "committed"].includes(key) }; }
  return { VERSION, initial, variantFor, validate, encode, decode, release, markPart1, confirmPart1, settleHole, traceVertical, recordLine,
    markPart2, confirmPart2, setView, selectPart3, confirmPart3, redo, makeReview, fromReview, lifecyclePolicy };
});
