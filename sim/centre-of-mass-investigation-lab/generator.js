(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const VERSION = 2;
  const LEGACY_VERSION = 1;
  const LABELS = Object.freeze(["A", "B", "C", "D", "E"]);
  const CANDIDATE_COLORS = Object.freeze({ A: "#2563eb", B: "#db2777", C: "#16a34a", D: "#ea580c", E: "#7c3aed" });
  const PLATE_V1 = Object.freeze([
    Object.freeze([-0.58, -0.42]), Object.freeze([0.36, -0.5]),
    Object.freeze([0.62, -0.08]), Object.freeze([0.44, 0.52]),
    Object.freeze([-0.45, 0.48]), Object.freeze([-0.65, 0.06])
  ]);
  const HOLES_V1 = Object.freeze([
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
  function freezePoints(points) { return Object.freeze(points.map(([x, y]) => Object.freeze([q(x), q(y)]))); }
  function freezeHoles(holes) { return Object.freeze(holes.map((hole) => Object.freeze({ key: hole.key, x: q(hole.x), y: q(hole.y) }))); }
  function circlePoints(rx, ry, count, phase = 0) { return Array.from({ length: count }, (_, index) => { const angle = phase + index * Math.PI * 2 / count; return [rx * Math.cos(angle), ry * Math.sin(angle)]; }); }
  const SHAPES = Object.freeze([
    Object.freeze({ kind: "irregular", polygon: freezePoints(PLATE_V1), cutouts: Object.freeze([]), holes: freezeHoles(HOLES_V1), inertiaCm: .025 }),
    Object.freeze({ kind: "angular", polygon: freezePoints([
      [-.72, -.18], [-.48, -.5], [.22, -.5], [.7, -.1], [.52, .46], [-.2, .54], [-.68, .28]
    ]), cutouts: Object.freeze([]), holes: freezeHoles([
      { key: "h1", x: -.46, y: -.18 }, { key: "h2", x: .22, y: -.3 },
      { key: "h3", x: .42, y: .16 }, { key: "h4", x: -.2, y: .34 }
    ]), inertiaCm: .02 }),
    Object.freeze({ kind: "ring", polygon: freezePoints(circlePoints(.72, .58, 16, Math.PI / 16)), cutouts: Object.freeze([freezePoints(circlePoints(.32, .25, 16, Math.PI / 16))]), holes: freezeHoles([
      { key: "h1", x: -.34, y: -.34 }, { key: "h2", x: .34, y: -.34 },
      { key: "h3", x: .34, y: .34 }, { key: "h4", x: -.34, y: .34 }
    ]), inertiaCm: .04 })
  ]);
  function plateArea(polygon, cutouts = []) { return polygonArea(polygon) - cutouts.reduce((sum, cutout) => sum + polygonArea(cutout), 0); }
  function validateSeed(seed) { return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff; }
  function sharedPart1(n) {
    const side = n & 1 ? 1 : -1;
    const masses = side > 0
      ? [{ m: 2, x: 0.15 }, { m: 3, x: 0.6 }, { m: 4, x: 0.82 }]
      : [{ m: 4, x: 0.18 }, { m: 3, x: 0.4 }, { m: 2, x: 0.85 }];
    const total = masses.reduce((sum, item) => sum + item.m, 0);
    return { side, masses: Object.freeze(masses), total, xCm: q(masses.reduce((sum, item) => sum + item.m * item.x, 0) / total), skin: n & 2 ? "broom" : "rod" };
  }
  function sharedPart3(n) {
    const solidTypes = ["sphere", "cube", "cuboid"], type = solidTypes[(n >>> 1) % solidTypes.length];
    const axes = type === "sphere" ? [1, 1, 1] : type === "cube" ? [0.9, 0.9, 0.9] : [1, 0.72, 0.58];
    const offsets = [[0, 0, 0], [0.34, 0.17, -0.18], [-0.31, 0.2, 0.19], [0.21, -0.3, 0.22], [-0.24, -0.19, -0.28]], correctIndex = (n >>> 4) % 5;
    const candidates = LABELS.map((key, index) => { const source = offsets[(index - correctIndex + 5) % 5]; return { key, position: source.map((value, axis) => q(value * axes[axis])) }; });
    return { type, axes: Object.freeze(axes), candidates: Object.freeze(candidates), correctKey: LABELS[correctIndex], initialView: Object.freeze({ yaw10: 350, pitch10: -180 }) };
  }
  function generateLegacy(seed) {
    if (!validateSeed(seed)) throw new Error("Unsupported generator input");
    const n = hash(seed || 0x9e3779b9);
    const part1 = sharedPart1(n), plateCom = part1.side > 0 ? { x: 0.095, y: 0.035 } : { x: -0.095, y: 0.035 }, area = q(polygonArea(PLATE_V1));
    return Object.freeze({ generatorVersion: LEGACY_VERSION, seed,
      part1: Object.freeze({ length: 1, skin: part1.skin, masses: part1.masses, totalMass: part1.total, xCm: part1.xCm }),
      part2: Object.freeze({ kind: "irregular", polygon: PLATE_V1, cutouts: Object.freeze([]), area, size: q(Math.sqrt(area)), centre: Object.freeze(plateCom), holes: HOLES_V1, mass: 1, inertiaCm: .025 }),
      part3: Object.freeze(sharedPart3(n))
    });
  }
  function generate(seed, version = VERSION) {
    if (!validateSeed(seed)) throw new Error("Unsupported generator input");
    if (version === LEGACY_VERSION) return generateLegacy(seed);
    if (version !== VERSION) throw new Error("Unsupported generator input");
    const n = hash(seed || 0x9e3779b9), part1 = sharedPart1(n), shape = SHAPES[(n >>> 5) % SHAPES.length];
    const area = q(plateArea(shape.polygon, shape.cutouts)), plateCom = shape.kind === "ring" ? { x: 0, y: 0 } : part1.side > 0 ? { x: 0.095, y: 0.035 } : { x: -0.095, y: 0.035 };
    return Object.freeze({ generatorVersion: VERSION, seed,
      part1: Object.freeze({ length: 1, skin: part1.skin, masses: part1.masses, totalMass: part1.total, xCm: part1.xCm }),
      part2: Object.freeze({ kind: shape.kind, polygon: shape.polygon, cutouts: shape.cutouts, area, size: q(Math.sqrt(area)), centre: Object.freeze(plateCom), holes: shape.holes, mass: 1, inertiaCm: shape.inertiaCm }),
      part3: Object.freeze(sharedPart3(n))
    });
  }
  return { VERSION, LEGACY_VERSION, SUPPORTED_VERSIONS: Object.freeze([LEGACY_VERSION, VERSION]), LABELS, CANDIDATE_COLORS, polygonArea, plateArea, generate };
});
