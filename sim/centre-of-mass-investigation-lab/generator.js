(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const VERSION = 1;
  const LABELS = Object.freeze(["A", "B", "C", "D", "E"]);
  const PLATE = Object.freeze([
    Object.freeze([-0.58, -0.42]), Object.freeze([0.36, -0.5]),
    Object.freeze([0.62, -0.08]), Object.freeze([0.44, 0.52]),
    Object.freeze([-0.45, 0.48]), Object.freeze([-0.65, 0.06])
  ]);
  const HOLES = Object.freeze([
    Object.freeze({ key: "h1", x: -0.38, y: -0.25 }), Object.freeze({ key: "h2", x: 0.2, y: -0.34 }),
    Object.freeze({ key: "h3", x: 0.38, y: 0.19 }), Object.freeze({ key: "h4", x: -0.31, y: 0.28 })
  ]);
  function hash(seed) {
    let x = Number(seed) >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return x >>> 0;
  }
  function polygonArea(points) {
    let twice = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i], b = points[(i + 1) % points.length];
      twice += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(twice) / 2;
  }
  function q(value) { return Math.round(value * 10000) / 10000; }
  function generate(seed, version = VERSION) {
    if (version !== VERSION || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Unsupported generator input");
    const n = hash(seed || 0x9e3779b9);
    const side = n & 1 ? 1 : -1;
    const masses = side > 0
      ? [{ m: 2, x: 0.15 }, { m: 3, x: 0.6 }, { m: 4, x: 0.82 }]
      : [{ m: 4, x: 0.18 }, { m: 3, x: 0.4 }, { m: 2, x: 0.85 }];
    const total = masses.reduce((sum, item) => sum + item.m, 0);
    const xCm = q(masses.reduce((sum, item) => sum + item.m * item.x, 0) / total);
    const area = q(polygonArea(PLATE));
    const plateCom = side > 0 ? { x: 0.095, y: 0.035 } : { x: -0.095, y: 0.035 };
    const solidTypes = ["sphere", "cube", "cuboid"];
    const type = solidTypes[(n >>> 1) % solidTypes.length];
    const axes = type === "sphere" ? [1, 1, 1] : type === "cube" ? [0.9, 0.9, 0.9] : [1, 0.72, 0.58];
    const offsets = [[0, 0, 0], [0.34, 0.17, -0.18], [-0.31, 0.2, 0.19], [0.21, -0.3, 0.22], [-0.24, -0.19, -0.28]];
    const correctIndex = (n >>> 4) % 5;
    const candidates = LABELS.map((key, index) => {
      const source = offsets[(index - correctIndex + 5) % 5];
      return { key, position: source.map((value, axis) => q(value * axes[axis])) };
    });
    return Object.freeze({
      generatorVersion: VERSION, seed,
      part1: Object.freeze({ length: 1, skin: n & 2 ? "broom" : "rod", masses: Object.freeze(masses), totalMass: total, xCm }),
      part2: Object.freeze({ polygon: PLATE, area, size: q(Math.sqrt(area)), centre: Object.freeze(plateCom), holes: HOLES, mass: 1, inertiaCm: 0.025 }),
      part3: Object.freeze({ type, axes: Object.freeze(axes), candidates: Object.freeze(candidates), correctKey: LABELS[correctIndex], initialView: Object.freeze({ yaw10: 350, pitch10: -180 }) })
    });
  }
  return { VERSION, LABELS, polygonArea, generate };
});
