(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const BALANCE_TOLERANCE = 0.018;
  const INVERTED_ESCAPE = 3 * Math.PI / 180;
  const finite = Number.isFinite;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  function supportOutcome(x, xCm) {
    if (![x, xCm].every(finite)) return null;
    const d = xCm - x;
    return Math.abs(d) <= BALANCE_TOLERANCE ? "balanced" : d < 0 ? "left-fall" : "right-fall";
  }
  function canonicalView(view) {
    if (!view || !Number.isInteger(view.yaw10) || !Number.isInteger(view.pitch10)) return null;
    let yaw10 = ((view.yaw10 + 1800) % 3600 + 3600) % 3600 - 1800;
    return { yaw10, pitch10: clamp(view.pitch10, -800, 800) };
  }
  function viewVector(view) {
    const current = canonicalView(view);
    if (!current) return null;
    const yaw = current.yaw10 * Math.PI / 1800, pitch = current.pitch10 * Math.PI / 1800;
    return [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  }
  function orientationDifference(a, b) {
    const av = viewVector(a), bv = viewVector(b);
    if (!av || !bv) return NaN;
    const dot = clamp(av.reduce((sum, value, i) => sum + value * bv[i], 0), -1, 1);
    return Math.acos(dot) * 180 / Math.PI;
  }
  function validObservations(initial, observations) {
    return Array.isArray(observations) && observations.length === 2 &&
      observations.every((item) => canonicalView(item) && item.yaw10 === canonicalView(item).yaw10 && item.pitch10 === canonicalView(item).pitch10) &&
      orientationDifference(initial, observations[0]) >= 21 && orientationDifference(observations[0], observations[1]) >= 36;
  }
  function transform(point, pose) {
    const c = Math.cos(pose.angle), s = Math.sin(pose.angle);
    return { x: pose.x + point.x * c - point.y * s, y: pose.y + point.x * s + point.y * c };
  }
  function inverseTransform(point, pose) {
    const x = point.x - pose.x, y = point.y - pose.y, c = Math.cos(pose.angle), s = Math.sin(pose.angle);
    return { x: x * c + y * s, y: -x * s + y * c };
  }
  function equilibriumAngle(hole, centre) { return Math.atan2(centre.x - hole.x, centre.y - hole.y); }
  function angularDifference(angle, target) { return ((angle - target + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }
  function damping({ inertia, mass, distance, gravity = 9.81, zeta = 0.55 }) {
    const c = 2 * zeta * Math.sqrt(inertia * mass * gravity * distance);
    return finite(c) && c > 0 ? c : null;
  }
  function createSwing(problem, hole, angle) {
    const dx = problem.centre.x - hole.x, dy = problem.centre.y - hole.y;
    const distance = Math.hypot(dx, dy), mass = problem.mass;
    const inertiaCm = problem.inertiaCm, inertia = inertiaCm + mass * distance * distance, target = equilibriumAngle(hole, problem.centre);
    const phi = angularDifference(angle, target);
    if (Math.PI - Math.abs(phi) < INVERTED_ESCAPE) angle = target + (phi < 0 ? -1 : 1) * (Math.PI - INVERTED_ESCAPE);
    return { angle, omega: 0, target, distance, inertiaCm, inertia, mass,
      damping: damping({ inertia, mass, distance }), settledFor: 0 };
  }
  function stepSwing(swing, dt, mass = 1) {
    const elapsed = clamp(dt, 0, 0.05), fixed = 1 / 120;
    let remaining = elapsed;
    while (remaining >= fixed - 1e-9) {
      const phi = angularDifference(swing.angle, swing.target);
      const alpha = (-mass * 9.81 * swing.distance * Math.sin(phi) - swing.damping * swing.omega) / swing.inertia;
      swing.omega += alpha * fixed; swing.angle += swing.omega * fixed; remaining -= fixed;
      if (Math.abs(angularDifference(swing.angle, swing.target)) < 0.75 * Math.PI / 180 && Math.abs(swing.omega) < 1.5 * Math.PI / 180) swing.settledFor += fixed;
      else swing.settledFor = 0;
    }
    if (swing.settledFor >= 0.25) { swing.angle = swing.target; swing.omega = 0; return true; }
    return false;
  }
  function pointLineDistance(point, line) {
    const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1];
    return Math.abs(dy * point.x - dx * point.y + line.b[0] * line.a[1] - line.b[1] * line.a[0]) / Math.hypot(dx, dy);
  }
  function acuteLineAngle(a, b) {
    const av = [a.b[0] - a.a[0], a.b[1] - a.a[1]], bv = [b.b[0] - b.a[0], b.b[1] - b.a[1]];
    const cosine = Math.abs((av[0] * bv[0] + av[1] * bv[1]) / (Math.hypot(...av) * Math.hypot(...bv)));
    return Math.acos(clamp(cosine, -1, 1)) * 180 / Math.PI;
  }
  function lineValid(line, hole, centre, size) {
    if (!line || !Array.isArray(line.a) || !Array.isArray(line.b) || ![...line.a, ...line.b].every(finite)) return false;
    const length = Math.hypot(line.b[0] - line.a[0], line.b[1] - line.a[1]);
    if (length < 0.45 * size || pointLineDistance(hole, line) > 0.025 * size) return false;
    const ideal = { a: [hole.x, hole.y], b: [centre.x, centre.y] };
    return acuteLineAngle(line, ideal) <= 5;
  }
  function lineRecordable(line, hole, centre, size) {
    if (!line || Object.keys(line).length !== 3 || !Object.prototype.hasOwnProperty.call(line, "holeKey") ||
        !Array.isArray(line.a) || line.a.length !== 2 || !Array.isArray(line.b) || line.b.length !== 2 ||
        ![...line.a, ...line.b].every((value) => finite(value) && Math.abs(value) <= 1.5) ||
        !hole || !centre || !finite(size) || size <= 0) return false;
    const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], length = Math.hypot(dx, dy);
    if (length < 0.45 * size || pointLineDistance(hole, line) > 0.025 * size) return false;
    const idealX = centre.x - hole.x, idealY = centre.y - hole.y;
    return dx * idealX + dy * idealY > 0;
  }
  function pairwiseIntersections(lines) {
    if (!Array.isArray(lines)) return [];
    const result = [];
    for (let i = 0; i < lines.length; i += 1) for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i], b = lines[j];
      if (![a?.a, a?.b, b?.a, b?.b].every((point) => Array.isArray(point) && point.length === 2 && point.every(finite))) continue;
      const ax = a.b[0] - a.a[0], ay = a.b[1] - a.a[1], bx = b.b[0] - b.a[0], by = b.b[1] - b.a[1];
      const determinant = ax * by - ay * bx;
      if (Math.abs(determinant) < 1e-8) continue;
      const qx = b.a[0] - a.a[0], qy = b.a[1] - a.a[1], t = (qx * by - qy * bx) / determinant;
      const x = a.a[0] + t * ax, y = a.a[1] + t * ay;
      if ([x, y].every(finite)) result.push({ x, y, pair: [i, j] });
    }
    return result;
  }
  function leastSquares(lines) {
    if (!Array.isArray(lines) || lines.length < 2) return null;
    let a00 = 0, a01 = 0, a11 = 0, b0 = 0, b1 = 0;
    for (const line of lines) {
      const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], len = Math.hypot(dx, dy);
      if (!finite(len) || len < 1e-8) return null;
      const nx = -dy / len, ny = dx / len, c = nx * line.a[0] + ny * line.a[1];
      a00 += nx * nx; a01 += nx * ny; a11 += ny * ny; b0 += nx * c; b1 += ny * c;
    }
    const det = a00 * a11 - a01 * a01;
    if (Math.abs(det) < 1e-6) return null;
    return { x: (b0 * a11 - b1 * a01) / det, y: (a00 * b1 - a01 * b0) / det };
  }
  function project(point, view, scale = 1) {
    const current = canonicalView(view); if (!current || !point?.every(finite)) return null;
    const yaw = current.yaw10 * Math.PI / 1800, pitch = current.pitch10 * Math.PI / 1800;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = point[0] * cy + point[2] * sy, z1 = -point[0] * sy + point[2] * cy;
    return { x: x1 * scale, y: (-point[1] * cp + z1 * sp) * scale, depth: point[1] * sp + z1 * cp };
  }
  return { BALANCE_TOLERANCE, finite, clamp, supportOutcome, canonicalView, viewVector, orientationDifference,
    validObservations, transform, inverseTransform, equilibriumAngle, damping, createSwing, stepSwing,
    pointLineDistance, acuteLineAngle, lineValid, lineRecordable, pairwiseIntersections, leastSquares, project, angularDifference, INVERTED_ESCAPE };
});
