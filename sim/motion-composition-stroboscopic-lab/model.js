(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MotionCompositionModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const VERSION = 1, DT = 0.2, GRID = 200;
  const MOTIONS = Object.freeze({ uniform: "勻速直線運動", accelerating: "勻加速直線運動", decelerating: "勻減速直線運動", nonuniform: "非勻變速直線運動" });
  const TRAJECTORIES = Object.freeze({ line: "直線", parabola: "拋物線", circular: "圓弧", other: "其他曲線" });
  const CASES = Object.freeze([
    { vx: 4, ax: 0, vy: -4, ay: 0, motions: ["uniform", "uniform"], trajectory: "line", explanation: "兩方向的等時位移都相等，合運動沿直線勻速前進。" },
    { vx: 4, ax: 0, vy: 0, ay: -10, motions: ["uniform", "accelerating"], trajectory: "parabola", explanation: "水平勻速，垂直由靜止自由落體，合成平拋的拋物線；本題取 g = 10 m/s²，忽略空氣阻力。" },
    { vx: 0, ax: 10, vy: -4, ay: 0, motions: ["accelerating", "uniform"], trajectory: "parabola", explanation: "水平勻加速，垂直勻速，合成向右彎的拋物線；水平加速不是自由落體。" },
    { vx: 0, ax: 10, vy: 0, ay: -10, motions: ["accelerating", "accelerating"], trajectory: "line", explanation: "兩方向由靜止勻加速，且加速度大小相同，所以位置始終滿足 y = −x。軌跡是直線，等時球影間距卻逐段增大。" }
  ].map(c => Object.freeze({ ...c, motions: Object.freeze(c.motions) })));
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const emptyCase = () => ({ observed: false, motions: [null, null], points: [null, null, null, null], trajectory: null });
  const validPoint = p => p === null || (Array.isArray(p) && p.length === 2 && p.every(Number.isInteger) && p[0] >= -400 && p[0] <= 3600 && p[1] >= -3600 && p[1] <= 400);
  function validCase(c) {
    return Boolean(c && !Array.isArray(c) && Object.keys(c).length === 4 && typeof c.observed === "boolean" &&
      Array.isArray(c.motions) && c.motions.length === 2 && c.motions.every(v => v === null || (typeof v === "string" && Object.hasOwn(MOTIONS, v))) &&
      Array.isArray(c.points) && c.points.length === 4 && c.points.every(validPoint) && (c.observed || c.points.every(p => p === null)) &&
      (c.trajectory === null || (typeof c.trajectory === "string" && Object.hasOwn(TRAJECTORIES, c.trajectory))));
  }
  function position(index, time) {
    const c = CASES[index];
    if (!c || !Number.isFinite(time) || time < 0 || time > 0.8 + 1e-9) throw new Error("Invalid model time");
    return [Math.round((c.vx * time + c.ax * time * time / 2) * 1000) || 0, Math.round((c.vy * time + c.ay * time * time / 2) * 1000) || 0];
  }
  const expected = index => [1, 2, 3, 4].map(i => position(index, i * DT));
  function gaps(index, axis) {
    const positions = [[0, 0], ...expected(index)];
    return positions.slice(1).map((p, i) => Math.abs(p[axis] - positions[i][axis]));
  }
  function progress(c) {
    const points = c.points.filter(p => p !== null).length, types = c.motions.filter(v => v !== null).length, trajectory = c.trajectory !== null;
    return { points, types, trajectory, count: points + types + Number(trajectory), complete: points === 4 && types === 2 && trajectory, started: c.observed || points > 0 || types > 0 || trajectory };
  }
  function layout(width, height, presentation = false) {
    const compact = width < 260 || height < 210;
    presentation = presentation && !compact;
    const sideSpace = compact ? 92 : presentation ? 220 : 148, verticalSpace = compact ? 100 : presentation ? 148 : 88;
    const size = Math.max(40, Math.min(width - sideSpace, height - verticalSpace));
    const left = compact ? (width - size) / 2 : (presentation ? 64 : 46) + (width - sideSpace - size) / 2, top = compact ? 8 : presentation ? 76 : 34;
    const trays = compact ? [0,1,2,3].map(i => ({ x: width / 2 + (i % 2 ? 22 : -22), y: height - (i < 2 ? 67 : 23) })) :
      [0,1,2,3].map(i => ({ x: left + size + (presentation ? 70 : 44), y: Math.max(presentation ? 82 : 54, height / 2 - (presentation ? 96 : 66)) + i * (presentation ? 64 : 44) }));
    return { width, height, size, left, top, compact, presentation, trays };
  }
  const pixel = (p, l) => ({ x: l.left + (p[0] + 400) * l.size / 4000, y: l.top + (400 - p[1]) * l.size / 4000 });
  const world = (p, l) => [(p.x - l.left) * 4000 / l.size - 400, 400 - (p.y - l.top) * 4000 / l.size];
  function resolve(p, l, type = "mouse", held = null) {
    const raw = world(p, l);
    if (raw[0] < -400 || raw[0] > 3600 || raw[1] < -3600 || raw[1] > 400) return null;
    const candidate = raw.map(v => Math.round(v / GRID) * GRID), touch = type === "touch", enter = touch ? 10 : 6, exit = touch ? 14 : 9, improvement = touch ? 2 : 1;
    const distance = point => { const q = pixel(point, l); return Math.hypot(q.x - p.x, q.y - p.y); };
    let snap = distance(candidate) <= enter ? candidate : null;
    if (held && distance(held) <= exit && (!snap || distance(held) - distance(snap) < improvement)) snap = held;
    return { point: (snap || raw).map(v => Math.round(v) || 0), snap: snap ? snap.map(v => v || 0) : null };
  }
  const format = mm => (mm / 1000).toFixed(3).replace("-0.000", "0.000");
  return Object.freeze({ VERSION, DT, GRID, MOTIONS, TRAJECTORIES, CASES, clone, emptyCase, validPoint, validCase, position, expected, gaps, progress, layout, pixel, world, resolve, format });
});
