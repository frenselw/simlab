(function (root, factory) {
  const questions = typeof module === "object" && module.exports ? require("./question-definitions.js") : root.KinematicsQuantitativeQuestions;
  const api = factory(questions);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsQuantitativeModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (Questions) {
  "use strict";
  const INPUT_STEPS = Object.freeze({ x: 1, v: 1, a: 1 });
  const ACTIVATION_THRESHOLD_CSS_PX = 4;
  const MAX_UNDO = 24;
  const isIntegerOrNull = (value) => value === null || Number.isSafeInteger(value);
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function snap(value, axis) { return clamp(Math.round(value / axis.step) * axis.step, axis.min, axis.max); }
  function validAnswer(answer, definition) { return Array.isArray(answer) && answer.length === definition.times.length && answer.every((value) => isIntegerOrNull(value) && (value === null || (value >= definition.axis.min && value <= definition.axis.max))); }
  function canonicalAnswer(answer, definition) { if (!validAnswer(answer, definition) || answer.every((value) => value === null)) return null; return answer.slice(); }
  function isComplete(answer, definition) { return validAnswer(answer, definition) && answer.every((value) => value !== null); }
  function lineThrough(times, values) { if (times.length !== 2 || !values.every(Number.isFinite) || times[0] === times[1]) return null; const slope = (values[1] - values[0]) / (times[1] - times[0]); const intercept = values[0] - slope * times[0]; return { kind: "line", slope, intercept, valueAt: (time) => slope * time + intercept }; }
  function quadraticThrough(times, values) { if (times.length !== 3 || !values.every(Number.isFinite)) return null; const [t0, t1, t2] = times; const [y0, y1, y2] = values; if (!(t0 === 0 && t1 === t2 / 2 && t2 > 0)) return null; const h = t1; const C = y0; const A = (y2 - 2 * y1 + y0) / (2 * h * h); const B = (y1 - y0 - A * h * h) / h; return { kind: "quadratic", A, B, C, valueAt: (time) => A * time * time + B * time + C }; }
  function graphFunction(definition, answer) { if (!isComplete(answer, definition)) return null; return definition.times.length === 2 ? lineThrough(definition.times, answer) : quadraticThrough(definition.times, answer); }
  function impliedParameters(definition, answer) { const fn = graphFunction(definition, answer); if (!fn) return null; if (definition.graphType === "x") return fn.kind === "line" ? { x0: fn.intercept, v0: fn.slope, a: 0 } : { x0: fn.C, v0: fn.B, a: 2 * fn.A }; if (definition.graphType === "v") return { v0: fn.intercept, a: fn.slope }; return definition.times[0] === 0 ? { a0: answer[0], aT: answer[1] } : null; }
  function plotTransform(axis, width, height, left = 0, top = 0) { return { toX: (time, T) => left + time / T * width, toY: (value) => top + (axis.max - value) / (axis.max - axis.min) * height, fromY: (pixel) => axis.max - (pixel - top) / height * (axis.max - axis.min) }; }
  function sampledPath(definition, answer, samples = 121) { const fn = graphFunction(definition, answer); if (!fn) return []; return Array.from({ length: samples }, (_, index) => { const time = definition.question.T * index / (samples - 1); return [time, fn.valueAt(time)]; }); }
  class Editor {
    constructor(definition, answer = null) { this.definition = definition; this.answer = canonicalAnswer(answer || Array(definition.times.length).fill(null), definition) || Array(definition.times.length).fill(null); this.undo = []; this.redo = []; }
    snapshot() { return this.answer.slice(); }
    commit(next) { const canonical = canonicalAnswer(next, this.definition); const normalized = canonical || Array(this.definition.times.length).fill(null); if (JSON.stringify(normalized) === JSON.stringify(this.answer)) return false; this.undo.push(this.snapshot()); if (this.undo.length > MAX_UNDO) this.undo.shift(); this.redo = []; this.answer = normalized; return true; }
    set(index, value) { if (!Number.isInteger(index) || index < 0 || index >= this.answer.length || !Number.isFinite(value)) return false; const next = this.snapshot(); next[index] = snap(value, this.definition.axis); return this.commit(next); }
    clear(index) { if (!Number.isInteger(index) || index < 0 || index >= this.answer.length) return false; const next = this.snapshot(); next[index] = null; return this.commit(next); }
    clearAll() { return this.commit(Array(this.answer.length).fill(null)); }
    step(index, delta) { const value = this.answer[index] == null ? clamp(0, this.definition.axis.min, this.definition.axis.max) : this.answer[index]; return this.set(index, value + delta * this.definition.axis.step); }
    undoOnce() { if (!this.undo.length) return false; this.redo.push(this.snapshot()); this.answer = this.undo.pop(); return true; }
    redoOnce() { if (!this.redo.length) return false; this.undo.push(this.snapshot()); this.answer = this.redo.pop(); return true; }
  }
  return { INPUT_STEPS, ACTIVATION_THRESHOLD_CSS_PX, MAX_UNDO, clamp, snap, isIntegerOrNull, validAnswer, canonicalAnswer, isComplete, lineThrough, quadraticThrough, graphFunction, impliedParameters, plotTransform, sampledPath, Editor };
});
