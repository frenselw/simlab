(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsGraphModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DRAW_BINS = 96;
  const EMPTY = 255;
  const MAX_VALUE = 254;
  const MAX_UNDO = 24;

  function createTrace() {
    const trace = new Uint8Array(DRAW_BINS);
    trace.fill(EMPTY);
    return trace;
  }

  function isTrace(value) {
    return value instanceof Uint8Array && value.length === DRAW_BINS &&
      Array.from(value).every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= EMPTY);
  }

  function cloneTrace(value) {
    if (!isTrace(value)) throw new TypeError("Trace must be a canonical 96-byte Uint8Array");
    return Uint8Array.from(value);
  }

  function equalTrace(left, right) {
    return isTrace(left) && isTrace(right) && left.every((value, index) => value === right[index]);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function quantizeY(normalizedY) {
    return Math.round(clamp(Number(normalizedY) || 0, 0, 1) * MAX_VALUE);
  }

  function pointToSample(clientX, clientY, rect) {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((rect.bottom - clientY) / rect.height, 0, 1);
    return {
      bin: clamp(Math.round(x * (DRAW_BINS - 1)), 0, DRAW_BINS - 1),
      value: quantizeY(y),
      x,
      y
    };
  }

  function applyPoint(trace, sample, mode, radiusBins = 0) {
    if (!isTrace(trace) || !sample || !Number.isInteger(sample.bin)) return false;
    const radius = Math.max(0, Math.round(radiusBins));
    let changed = false;
    for (let index = Math.max(0, sample.bin - radius); index <= Math.min(DRAW_BINS - 1, sample.bin + radius); index += 1) {
      const next = mode === "erase" ? EMPTY : sample.value;
      if (trace[index] !== next) {
        trace[index] = next;
        changed = true;
      }
    }
    return changed;
  }

  function applySegment(trace, from, to, mode, radiusBins = 0) {
    if (!isTrace(trace) || !from || !to) return false;
    const distance = Math.abs(to.bin - from.bin);
    let changed = false;
    for (let step = 0; step <= distance; step += 1) {
      const fraction = distance ? step / distance : 0;
      const bin = Math.round(from.bin + (to.bin - from.bin) * fraction);
      const value = Math.round(from.value + (to.value - from.value) * fraction);
      changed = applyPoint(trace, { bin, value }, mode, radiusBins) || changed;
    }
    return changed;
  }

  function toBase64Url(bytes) {
    let base64;
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(bytes).toString("base64");
    } else {
      let binary = "";
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      base64 = btoa(binary);
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64Url(text) {
    if (typeof text !== "string" || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
    const padding = "=".repeat((4 - text.length % 4) % 4);
    const base64 = text.replace(/-/g, "+").replace(/_/g, "/") + padding;
    try {
      const bytes = typeof Buffer !== "undefined"
        ? Uint8Array.from(Buffer.from(base64, "base64"))
        : Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      return bytes;
    } catch {
      return null;
    }
  }

  function encodeTrace(trace) {
    if (!isTrace(trace)) throw new TypeError("Cannot encode non-canonical trace");
    return toBase64Url(trace);
  }

  function decodeTrace(text) {
    const bytes = fromBase64Url(text);
    if (!bytes || bytes.length !== DRAW_BINS || !isTrace(bytes)) return null;
    return encodeTrace(bytes) === text ? bytes : null;
  }

  class Editor {
    constructor(initialTrace) {
      this.committed = initialTrace ? cloneTrace(initialTrace) : createTrace();
      this.working = null;
      this.backup = null;
      this.activePointerId = null;
      this.mode = "pen";
      this.lastSample = null;
      this.changed = false;
      this.undoStack = [];
      this.redoStack = [];
    }

    setTrace(trace) {
      this.cancel();
      this.committed = trace ? cloneTrace(trace) : createTrace();
      this.undoStack = [];
      this.redoStack = [];
      return this.trace();
    }

    trace() {
      return cloneTrace(this.working || this.committed);
    }

    begin(pointerId, sample, options = {}) {
      if (options.isPrimary === false || this.activePointerId !== null || !sample) return false;
      this.activePointerId = pointerId;
      this.mode = options.mode === "erase" ? "erase" : "pen";
      this.backup = cloneTrace(this.committed);
      this.working = cloneTrace(this.committed);
      this.lastSample = sample;
      this.changed = applyPoint(this.working, sample, this.mode, options.radiusBins || 0);
      return true;
    }

    move(pointerId, sample, options = {}) {
      if (pointerId !== this.activePointerId || !this.working || !sample) return false;
      this.changed = applySegment(this.working, this.lastSample, sample, this.mode, options.radiusBins || 0) || this.changed;
      this.lastSample = sample;
      return true;
    }

    commit(pointerId) {
      if (pointerId !== this.activePointerId || !this.working) return false;
      if (this.changed && !equalTrace(this.backup, this.working)) {
        this.undoStack.push(this.backup);
        if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
        this.redoStack = [];
        this.committed = cloneTrace(this.working);
      }
      const changed = this.changed;
      this.resetOperation();
      return changed;
    }

    cancel(pointerId) {
      if (pointerId !== undefined && this.activePointerId !== null && pointerId !== this.activePointerId) return false;
      const active = this.activePointerId !== null || Boolean(this.working);
      this.resetOperation();
      return active;
    }

    resetOperation() {
      this.working = null;
      this.backup = null;
      this.activePointerId = null;
      this.lastSample = null;
      this.changed = false;
    }

    undo() {
      this.cancel();
      const previous = this.undoStack.pop();
      if (!previous) return false;
      this.redoStack.push(cloneTrace(this.committed));
      this.committed = cloneTrace(previous);
      return true;
    }

    redo() {
      this.cancel();
      const next = this.redoStack.pop();
      if (!next) return false;
      this.undoStack.push(cloneTrace(this.committed));
      this.committed = cloneTrace(next);
      return true;
    }

    clear() {
      this.cancel();
      const empty = createTrace();
      if (equalTrace(this.committed, empty)) return false;
      this.undoStack.push(cloneTrace(this.committed));
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack = [];
      this.committed = empty;
      return true;
    }

    replaceBins(nextTrace) {
      if (!isTrace(nextTrace) || equalTrace(nextTrace, this.committed)) return false;
      this.cancel();
      this.undoStack.push(cloneTrace(this.committed));
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack = [];
      this.committed = cloneTrace(nextTrace);
      return true;
    }

    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }
    get active() { return this.activePointerId !== null; }
  }

  return {
    DRAW_BINS,
    EMPTY,
    MAX_VALUE,
    MAX_UNDO,
    createTrace,
    isTrace,
    cloneTrace,
    equalTrace,
    quantizeY,
    pointToSample,
    applyPoint,
    applySegment,
    encodeTrace,
    decodeTrace,
    Editor
  };
});
