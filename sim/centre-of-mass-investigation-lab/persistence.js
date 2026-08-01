(function (root, factory) {
  const G = typeof module === "object" && module.exports ? require("./generator.js") : root.CentreMassGenerator;
  const M = typeof module === "object" && module.exports ? require("./model.js") : root.CentreMassModel;
  const S = typeof module === "object" && module.exports ? require("./scoring.js") : root.CentreMassScoring;
  const api = factory(G, M, S);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Model, Scoring) {
  "use strict";
  const VERSION = 2;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const exact = (value, keys) => Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)));
  const pristine1 = () => ({ supportEpisodes: [], markX: null });
  const pristine2 = () => ({ hangRecords: [], activeHoleKey: null, lines: [], mark: null });
  const pristine3 = (problem) => ({ view: clone(problem.part3.initialView), observations: [], selectedCandidateKey: null });

  function initial(seed) {
    const problem = Generator.generate(seed, Generator.VERSION);
    return { v: VERSION, generatorVersion: Generator.VERSION, rubricVersion: Scoring.RUBRIC_VERSION, seed,
      phase: "part1", variant: "editing", part1: pristine1(), part2: pristine2(), part3: pristine3(problem) };
  }
  function variantFor(state) { return state.phase === "review" ? "submitted" : state.phase === "check" ? "complete" : "editing"; }
  function validPoint(point) { return exact(point, ["x", "y"]) && [point.x, point.y].every(Number.isFinite) && Math.abs(point.x) <= 1.5 && Math.abs(point.y) <= 1.5; }
  function semantic(state, problem) {
    if (!exact(state.part1, ["supportEpisodes", "markX"]) || !Array.isArray(state.part1.supportEpisodes) || state.part1.supportEpisodes.length > 12 ||
      !state.part1.supportEpisodes.every((item) => exact(item, ["x", "outcome"]) && Number.isFinite(item.x) && item.x >= 0 && item.x <= 1 && item.outcome === Model.supportOutcome(item.x, problem.part1.xCm)) ||
      !(state.part1.markX === null || Number.isFinite(state.part1.markX) && state.part1.markX >= 0 && state.part1.markX <= 1)) return null;
    const balanced = state.part1.supportEpisodes.some((item) => item.outcome === "balanced");
    if (state.part1.markX !== null && !balanced) return null;
    if (!exact(state.part2, ["hangRecords", "activeHoleKey", "lines", "mark"]) || !Array.isArray(state.part2.hangRecords) || !Array.isArray(state.part2.lines) ||
      state.part2.hangRecords.length > 4 || state.part2.lines.length > 4 || !(state.part2.mark === null || validPoint(state.part2.mark))) return null;
    const holeMap = new Map(problem.part2.holes.map((hole) => [hole.key, hole]));
    const hangKeys = state.part2.hangRecords.map((item) => exact(item, ["holeKey"]) ? item.holeKey : null);
    if (hangKeys.some((key) => !holeMap.has(key)) || new Set(hangKeys).size !== hangKeys.length || !(state.part2.activeHoleKey === null || hangKeys.includes(state.part2.activeHoleKey))) return null;
    const lineKeys = state.part2.lines.map((line) => line?.holeKey);
    if (new Set(lineKeys).size !== lineKeys.length || !state.part2.lines.every((line) => exact(line, ["holeKey", "a", "b"]) && hangKeys.includes(line.holeKey) && Model.lineValid(line, holeMap.get(line.holeKey), problem.part2.centre, problem.part2.size))) return null;
    if (state.part2.activeHoleKey !== null && lineKeys.includes(state.part2.activeHoleKey) || hangKeys.some((key) => key !== state.part2.activeHoleKey && !lineKeys.includes(key))) return null;
    let enoughAngle = false;
    for (let i = 0; i < state.part2.lines.length; i += 1) for (let j = i + 1; j < state.part2.lines.length; j += 1) if (Model.acuteLineAngle(state.part2.lines[i], state.part2.lines[j]) >= 25) enoughAngle = true;
    if (state.part2.mark && (hangKeys.length < 2 || state.part2.lines.length < 2 || !enoughAngle || state.part2.activeHoleKey !== null)) return null;
    if (!exact(state.part3, ["view", "observations", "selectedCandidateKey"]) || !exact(state.part3.view, ["yaw10", "pitch10"]) || JSON.stringify(state.part3.view) !== JSON.stringify(Model.canonicalView(state.part3.view)) ||
      !Array.isArray(state.part3.observations) || state.part3.observations.length > 2 || !state.part3.observations.every((item) => exact(item, ["yaw10", "pitch10"]) && JSON.stringify(item) === JSON.stringify(Model.canonicalView(item))) ||
      !(state.part3.selectedCandidateKey === null || problem.part3.candidates.some((item) => item.key === state.part3.selectedCandidateKey))) return null;
    return { balanced, enoughAngle, p1Complete: balanced && state.part1.markX !== null, p2Complete: Boolean(state.part2.mark), p3Complete: state.part3.selectedCandidateKey !== null && Model.validObservations(problem.part3.initialView, state.part3.observations), hangKeys, lineKeys };
  }
  function validate(state, review = false) {
    if (!exact(state, ["v", "generatorVersion", "rubricVersion", "seed", "phase", "variant", "part1", "part2", "part3"]) || state.v !== VERSION ||
      state.generatorVersion !== Generator.VERSION || state.rubricVersion !== Scoring.RUBRIC_VERSION || !Number.isInteger(state.seed) || state.seed < 0 || state.seed > 0xffffffff ||
      !["part1", "part2", "part3", "check", "review"].includes(state.phase) || state.variant !== variantFor(state)) return false;
    let problem; try { problem = Generator.generate(state.seed, state.generatorVersion); } catch { return false; }
    const facts = semantic(state, problem); if (!facts) return false;
    if (["check", "review"].includes(state.phase) && !(facts.p1Complete && facts.p2Complete && facts.p3Complete)) return false;
    if (review && state.phase !== "review") return false;
    return true;
  }
  function legacyVariant(state) {
    const suffix = state.returnToCheck ? "redo" : "normal";
    if (state.phase === "part1") return state.part1.markX != null ? `marked-${suffix}` : state.part1.supportEpisodes.some((x) => x.outcome === "balanced") ? `balanced-${suffix}` : `seeking-${state.returnToCheck ? "redo" : "new"}`;
    if (state.phase === "part2") { if (state.part2.mark) return `marked-${suffix}`; if (state.part2.activeHoleKey) return `${state.part2.lines.length ? "settled-next" : "settled-first"}-${suffix}`; if (state.part2.lines.length >= 2) return `between-multi-${suffix}`; if (state.part2.lines.length === 1) return `between-one-${suffix}`; return `ready-${state.returnToCheck ? "redo" : "new"}`; }
    if (state.phase === "part3") return state.part3.selectedCandidateKey ? `selected-${suffix}` : state.part3.observations.length === 2 ? `eligible-${suffix}` : `observing-${state.returnToCheck ? "redo" : "new"}`;
    return state.phase === "check" ? "complete" : state.phase === "review" ? "submitted" : null;
  }
  function migrateV1(value) {
    if (!exact(value, ["v", "generatorVersion", "rubricVersion", "seed", "phase", "variant", "returnToCheck", "part1", "part2", "part3"]) || value.v !== 1 || typeof value.returnToCheck !== "boolean" || value.variant !== legacyVariant(value)) return null;
    let problem; try { problem = Generator.generate(value.seed, value.generatorVersion); } catch { return null; }
    const facts = semantic(value, problem); if (!facts) return null;
    if (value.part3.selectedCandidateKey !== null && !Model.validObservations(problem.part3.initialView, value.part3.observations)) return null;
    const p2Pristine = facts.hangKeys.length === 0 && value.part2.activeHoleKey === null && value.part2.lines.length === 0 && value.part2.mark === null;
    const p3Pristine = value.part3.observations.length === 0 && value.part3.selectedCandidateKey === null && JSON.stringify(value.part3.view) === JSON.stringify(problem.part3.initialView);
    if (!value.returnToCheck) {
      if (["part2", "part3", "check", "review"].includes(value.phase) && !facts.p1Complete || ["part3", "check", "review"].includes(value.phase) && !facts.p2Complete || ["check", "review"].includes(value.phase) && !facts.p3Complete) return null;
      if (value.phase === "part1" && (!p2Pristine || !p3Pristine) || value.phase === "part2" && !p3Pristine) return null;
    } else {
      if (!["part1", "part2", "part3"].includes(value.phase) || value.phase === "part1" && (!facts.p2Complete || !facts.p3Complete) || value.phase === "part2" && (!facts.p1Complete || !facts.p3Complete) || value.phase === "part3" && (!facts.p1Complete || !facts.p2Complete)) return null;
    }
    if (["check", "review"].includes(value.phase) && value.returnToCheck) return null;
    const next = { v: VERSION, generatorVersion: value.generatorVersion, rubricVersion: value.rubricVersion, seed: value.seed, phase: value.phase, variant: value.phase === "review" ? "submitted" : value.phase === "check" ? "complete" : "editing", part1: clone(value.part1), part2: clone(value.part2), part3: clone(value.part3) };
    return validate(next, value.phase === "review") ? next : null;
  }
  function encode(state) { if (!validate(state)) throw new Error("Invalid centre-of-mass draft"); return clone(state); }
  function decode(value) { try { const next = clone(value); return next?.v === 1 ? migrateV1(next) : validate(next) ? next : null; } catch { return null; } }
  function mutate(state, phase, action) { if (!validate(state) || state.phase !== phase) return null; const next = clone(state); action(next); next.variant = variantFor(next); return validate(next) ? next : null; }
  function release(state, x) { if (!Number.isFinite(x)) return null; return mutate(state, "part1", (next) => { const problem = Generator.generate(next.seed), item = { x: Math.max(0, Math.min(1, x)), outcome: null }; item.outcome = Model.supportOutcome(item.x, problem.part1.xCm); next.part1.supportEpisodes.push(item); if (next.part1.supportEpisodes.length > 12) { const balanced = next.part1.supportEpisodes.find((e) => e.outcome === "balanced"), tail = next.part1.supportEpisodes.slice(-12); next.part1.supportEpisodes = balanced && !tail.includes(balanced) ? [balanced, ...tail.slice(-11)] : tail; } }); }
  function markPart1(state, markX) { if (!Number.isFinite(markX) || markX < 0 || markX > 1 || !state?.part1?.supportEpisodes.some((x) => x.outcome === "balanced")) return null; return mutate(state, "part1", (next) => { next.part1.markX = markX; }); }
  function settleHole(state, key) { const problem = state && Generator.generate(state.seed); if (!problem?.part2.holes.some((x) => x.key === key) || state.part2.activeHoleKey || state.part2.lines.some((x) => x.holeKey === key)) return null; return mutate(state, "part2", (next) => { if (!next.part2.hangRecords.some((x) => x.holeKey === key)) next.part2.hangRecords.push({ holeKey: key }); next.part2.activeHoleKey = key; }); }
  function detachActiveHole(state) { if (!state?.part2?.activeHoleKey || state.part2.lines.some((line) => line.holeKey === state.part2.activeHoleKey)) return null; return mutate(state, "part2", (next) => { const key = next.part2.activeHoleKey; next.part2.activeHoleKey = null; next.part2.hangRecords = next.part2.hangRecords.filter((record) => record.holeKey !== key); }); }
  function traceVertical(state) { if (!state?.part2?.activeHoleKey) return null; const problem = Generator.generate(state.seed), hole = problem.part2.holes.find((x) => x.key === state.part2.activeHoleKey), dx = problem.part2.centre.x - hole.x, dy = problem.part2.centre.y - hole.y, n = Math.hypot(dx, dy), half = .36; return recordLine(state, { holeKey: hole.key, a: [hole.x - dx / n * half, hole.y - dy / n * half], b: [hole.x + dx / n * half, hole.y + dy / n * half] }); }
  function recordLine(state, line) { if (!state?.part2?.activeHoleKey || line?.holeKey !== state.part2.activeHoleKey) return null; return mutate(state, "part2", (next) => { next.part2.lines = next.part2.lines.filter((x) => x.holeKey !== line.holeKey); next.part2.lines.push(clone(line)); next.part2.activeHoleKey = null; }); }
  function markPart2(state, mark) { if (!validPoint(mark) || state?.part2?.activeHoleKey) return null; return mutate(state, "part2", (next) => { next.part2.mark = clone(mark); }); }
  function setView(state, view, record = true) { const current = Model.canonicalView(view); if (!current) return null; return mutate(state, "part3", (next) => { next.part3.view = current; const problem = Generator.generate(next.seed); if (record && next.part3.observations.length === 0 && Model.orientationDifference(problem.part3.initialView, current) >= 21) next.part3.observations.push(current); else if (record && next.part3.observations.length === 1 && Model.orientationDifference(next.part3.observations[0], current) >= 36) next.part3.observations.push(current); }); }
  function selectPart3(state, key) { if (!Generator.LABELS.includes(key) || !state) return null; return mutate(state, "part3", (next) => { next.part3.selectedCandidateKey = key; }); }
  function allComplete(state) { if (!validate(state)) return false; const p = Generator.generate(state.seed), f = semantic(state, p); return f.p1Complete && f.p2Complete && f.p3Complete; }
  function switchPart(state, part) { if (!validate(state) || state.phase === "review" || ![1, 2, 3].includes(part)) return null; const next = clone(state); next.phase = `part${part}`; next.variant = "editing"; return validate(next) ? next : null; }
  function enterCheck(state) { if (!allComplete(state) || state.phase === "review") return null; const next = clone(state); next.phase = "check"; next.variant = "complete"; return validate(next) ? next : null; }
  function resetPart(state, part) { const next = switchPart(state, part); if (!next) return null; const problem = Generator.generate(next.seed); if (part === 1) next.part1 = pristine1(); if (part === 2) next.part2 = pristine2(); if (part === 3) next.part3 = pristine3(problem); return validate(next) ? next : null; }
  function makeReview(state) { if (!validate(state) || state.phase !== "check") return null; const next = clone(state); next.phase = "review"; next.variant = "submitted"; return validate(next, true) ? next : null; }
  function fromReview(value) { try { const next = clone(value), decoded = next?.v === 1 ? migrateV1(next) : next; return validate(decoded, true) ? decoded : null; } catch { return null; } }
  function lifecyclePolicy(kind, outcome) { const key = kind === "startup" ? outcome : outcome?.activityState || "retry"; return { key, editable: kind === "startup" ? key === "editable" : key === "retry" && outcome?.retryable === true, showScore: kind === "startup" ? key === "review" : ["success", "committed"].includes(key) }; }
  return { VERSION, initial, variantFor, validate, encode, decode, migrateV1, release, markPart1, settleHole, detachActiveHole, traceVertical, recordLine, markPart2, setView, selectPart3, allComplete, switchPart, enterCheck, resetPart, makeReview, fromReview, lifecyclePolicy };
});
