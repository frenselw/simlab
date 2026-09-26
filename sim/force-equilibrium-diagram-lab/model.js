(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquilibriumModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const normalize = a => (a % 360 + 360) % 360;
  const angleDelta = (a, b) => Math.abs((normalize(a - b) + 180) % 360 - 180);
  const clone = a => JSON.parse(JSON.stringify(a));
  function validRecord(r) {
    return Array.isArray(r) && r.length === 3 && Number.isInteger(r[0]) && r[0] >= 0 && r[0] <= 4 &&
      ((r[1] === null && r[2] === null) || (Number.isInteger(r[1]) && r[1] >= 0 && r[1] < 3600 && Number.isInteger(r[2]) && r[2] >= 1 && r[2] <= 1000));
  }
  function validAnswer(a) {
    return Array.isArray(a) && a.length <= 8 && a.every(validRecord) && [0, 1, 2, 3, 4].every(k => a.filter(r => r[0] === k).length <= 3);
  }
  function change(answer, action) {
    const a = clone(answer), i = action.index;
    if (action.type === "add") a.push([action.kind, null, null]);
    else if (action.type === "clear") return [];
    else if (!Number.isInteger(i) || !a[i]) return a;
    else if (action.type === "remove") a.splice(i, 1);
    else if (action.type === "kind") a[i][0] = action.kind;
    else if (action.type === "place") a[i] = [a[i][0], Math.round(normalize(action.angle) * 10) % 3600, clamp(Math.round(action.length), 1, 1000)];
    else return a;
    return validAnswer(a) ? a : clone(answer);
  }
  function snap(angle, references, pointerType, previous = null) {
    const entry = pointerType === "touch" ? 6 : 4, exit = pointerType === "touch" ? 9 : 6;
    if (previous !== null && angleDelta(angle, previous) <= exit) return { angle: previous, target: previous };
    const nearest = references.reduce((best, a) => angleDelta(angle, a) < angleDelta(angle, best) ? a : best, references[0]);
    return angleDelta(angle, nearest) <= entry ? { angle: nearest, target: nearest } : { angle: normalize(angle), target: null };
  }
  function layout(width, height) {
    const displayScale = width >= 520 && height >= 400 ? 1.8 : 1;
    return { width, height, displayScale, center: { x: width / 2, y: height * .52 },
      left: 58 * displayScale, right: width - 58 * displayScale, top: 54 * displayScale, bottom: height - 42 * displayScale };
  }
  function radii(angle, l) {
    const x = Math.cos(angle * Math.PI / 180), y = -Math.sin(angle * Math.PI / 180);
    const rx = Math.abs(x) < 1e-8 ? Infinity : (x > 0 ? l.right - l.center.x : l.center.x - l.left) / Math.abs(x);
    const ry = Math.abs(y) < 1e-8 ? Infinity : (y > 0 ? l.bottom - l.center.y : l.center.y - l.top) / Math.abs(y);
    const max = Math.max(12, Math.min(rx, ry));
    return { min: Math.min(l.displayScale > 1 ? 64 * l.displayScale : 44, max), max };
  }
  function endpoint(record, l) {
    if (record[1] === null) return { ...l.center };
    const angle = record[1] / 10, bounds = radii(angle, l), length = bounds.min + (record[2] - 1) / 999 * (bounds.max - bounds.min);
    return { x: l.center.x + Math.cos(angle * Math.PI / 180) * length, y: l.center.y - Math.sin(angle * Math.PI / 180) * length };
  }
  function fromPoint(kind, point, l, references, pointerType, previous = null) {
    const dx = point.x - l.center.x, dy = l.center.y - point.y, radius = Math.hypot(dx, dy);
    if (radius < 18) return null;
    const resolved = snap(normalize(Math.atan2(dy, dx) * 180 / Math.PI), references, pointerType, previous);
    const angle10 = Math.round(normalize(resolved.angle) * 10) % 3600, bounds = radii(angle10 / 10, l);
    const length = bounds.max <= bounds.min ? 500 : clamp(Math.round(1 + (radius - bounds.min) / (bounds.max - bounds.min) * 999), 1, 1000);
    return { record: [kind, angle10, length], target: resolved.target };
  }
  function backgroundOffset(elapsedSeconds, motion, period = 144) { return ((-motion * 26 * elapsedSeconds) % period + period) % period; }
  class History {
    constructor() { this.undo = Array.from({ length: 5 }, () => []); this.redo = Array.from({ length: 5 }, () => []); }
    record(i, a) { this.undo[i].push(clone(a)); if (this.undo[i].length > 20) this.undo[i].shift(); this.redo[i] = []; }
    apply(i, a, redo = false) {
      const from = redo ? this.redo[i] : this.undo[i], to = redo ? this.undo[i] : this.redo[i];
      if (!from.length) return clone(a);
      to.push(clone(a)); return from.pop();
    }
  }
  return Object.freeze({ clamp, normalize, angleDelta, clone, validRecord, validAnswer, change, snap, layout, radii, endpoint, fromPoint, backgroundOffset, History });
});
