(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceCompositionGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const GENERATOR_VERSION = 2;
  const LEGACY_GENERATOR_VERSION = 1;
  const WIDTH = 760;
  const HEIGHT = 500;
  const ORIGIN = Object.freeze({ x: 380, y: 250 });
  const SAFE = Object.freeze({ minX: 70, maxX: 690, minY: 60, maxY: 440 });
  const BASIC_LENGTHS = Object.freeze(Array.from({ length: 11 }, (_, index) => 85 + index * 5));
  const TRIPLE_LENGTHS = Object.freeze(Array.from({ length: 9 }, (_, index) => 70 + index * 5));
  const DIRECTIONS = Object.freeze(Array.from({ length: 72 }, (_, index) => index * 5));
  const BASIC_CENTERS = Object.freeze([Object.freeze({ x: 145, y: 130 }), Object.freeze({ x: 145, y: 370 })]);
  const TRIPLE_CENTERS = Object.freeze([
    Object.freeze({ x: 135, y: 125 }), Object.freeze({ x: 135, y: 375 }), Object.freeze({ x: 625, y: 125 })
  ]);
  // Version 2 keeps the same force magnitudes and directions but places the
  // three initially separate vectors in a tighter, still non-overlapping
  // working area.  The mobile camera can therefore start at a useful scale
  // instead of fitting an unnecessarily wide triangle of starting points.
  const TRIPLE_CENTERS_V2 = Object.freeze([
    Object.freeze({ x: 220, y: 150 }), Object.freeze({ x: 220, y: 350 }), Object.freeze({ x: 540, y: 150 })
  ]);
  const BASIC_TYPES = Object.freeze(["parallelogram", "parallelogram", "head-to-tail-2", "head-to-tail-2"]);
  const QUESTION_IDS = Object.freeze(["P1", "P2", "H1", "H2", "T1"]);
  const MAX_ATTEMPTS = 256;
  const EPSILON = 0.01;
  const GENERATOR_PROFILES = Object.freeze({
    1: Object.freeze({ tripleCenters: TRIPLE_CENTERS }),
    2: Object.freeze({ tripleCenters: TRIPLE_CENTERS_V2 })
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function validateSeed(seed) {
    return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return function random() {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(values, random) {
    return values[Math.floor(random() * values.length)];
  }

  function round(value, places = 6) {
    const scale = 10 ** places;
    return Math.round(value * scale) / scale;
  }

  function vector(length, directionDeg, key) {
    const radians = directionDeg * Math.PI / 180;
    return deepFreeze({
      key,
      length,
      directionDeg,
      dx: round(length * Math.cos(radians)),
      dy: round(-length * Math.sin(radians))
    });
  }

  function magnitude(value) {
    return Math.hypot(value.dx, value.dy);
  }

  function add(...values) {
    return values.reduce((total, value) => ({ dx: total.dx + value.dx, dy: total.dy + value.dy }), { dx: 0, dy: 0 });
  }

  function minimumAngle(a, b) {
    const raw = Math.abs(a - b) % 360;
    return Math.min(raw, 360 - raw);
  }

  function pointInside(point, inset = 0) {
    return point.x >= SAFE.minX + inset - EPSILON && point.x <= SAFE.maxX - inset + EPSILON &&
      point.y >= SAFE.minY + inset - EPSILON && point.y <= SAFE.maxY - inset + EPSILON;
  }

  function endpoint(base, value) {
    return { x: base.x + value.dx, y: base.y + value.dy };
  }

  function initialTail(center, value) {
    return deepFreeze({ x: round(center.x - value.dx / 2), y: round(center.y - value.dy / 2) });
  }

  function segmentDistance(a1, a2, b1, b2) {
    function pointSegment(point, start, end) {
      const vx = end.x - start.x;
      const vy = end.y - start.y;
      const length2 = vx * vx + vy * vy;
      const t = length2 ? Math.max(0, Math.min(1, ((point.x - start.x) * vx + (point.y - start.y) * vy) / length2)) : 0;
      return Math.hypot(point.x - (start.x + t * vx), point.y - (start.y + t * vy));
    }
    return Math.min(pointSegment(a1, b1, b2), pointSegment(a2, b1, b2), pointSegment(b1, a1, a2), pointSegment(b2, a1, a2));
  }

  function initialPlacementValid(forces, tails) {
    const segments = forces.map((force, index) => ({ tail: tails[index], head: endpoint(tails[index], force) }));
    if (segments.some(({ tail, head }) => !pointInside(tail, 4) || !pointInside(head, 4))) return false;
    for (let first = 0; first < segments.length; first += 1) {
      if (Math.hypot(segments[first].tail.x - ORIGIN.x, segments[first].tail.y - ORIGIN.y) < 70) return false;
      for (let second = first + 1; second < segments.length; second += 1) {
        if (segmentDistance(segments[first].tail, segments[first].head, segments[second].tail, segments[second].head) < 58) return false;
      }
    }
    return true;
  }

  function basicCandidate(type, random) {
    const firstLength = pick(BASIC_LENGTHS, random);
    const secondLength = pick(BASIC_LENGTHS, random);
    const firstDirection = pick(DIRECTIONS, random);
    const secondDirection = pick(DIRECTIONS, random);
    const forces = [vector(firstLength, firstDirection, "F1"), vector(secondLength, secondDirection, "F2")];
    const tails = forces.map((force, index) => initialTail(BASIC_CENTERS[index], force));
    return { type, forces, initialTails: tails };
  }

  function validateBasic(question) {
    if (!question || !["parallelogram", "head-to-tail-2"].includes(question.type) || question.forces?.length !== 2) return false;
    const [first, second] = question.forces;
    const angle = minimumAngle(first.directionDeg, second.directionDeg);
    const resultant = add(first, second);
    if (angle < 30 || angle > 150 || angle === 90) return false;
    if (![first, second].every((force) => BASIC_LENGTHS.includes(force.length) && DIRECTIONS.includes(force.directionDeg))) return false;
    if (Math.min(first.length, second.length) / Math.max(first.length, second.length) < 0.65) return false;
    if (magnitude(resultant) < 65 - EPSILON || magnitude(resultant) > 220 + EPSILON) return false;
    const points = [
      ORIGIN,
      endpoint(ORIGIN, first),
      endpoint(ORIGIN, second),
      endpoint(ORIGIN, resultant)
    ];
    if (!points.every((point) => pointInside(point, 14))) return false;
    if (!initialPlacementValid(question.forces, question.initialTails)) return false;
    return true;
  }

  function tripleCandidate(random, profile = GENERATOR_PROFILES[LEGACY_GENERATOR_VERSION]) {
    const forces = [0, 1, 2].map((index) => vector(pick(TRIPLE_LENGTHS, random), pick(DIRECTIONS, random), `F${index + 1}`));
    return { type: "head-to-tail-3", forces, initialTails: forces.map((force, index) => initialTail(profile.tripleCenters[index], force)) };
  }

  function permutations(values) {
    if (values.length < 2) return [values.slice()];
    return values.flatMap((value, index) => permutations(values.slice(0, index).concat(values.slice(index + 1))).map((rest) => [value, ...rest]));
  }

  function validateTriple(question) {
    if (!question || question.type !== "head-to-tail-3" || question.forces?.length !== 3) return false;
    if (!question.forces.every((force) => TRIPLE_LENGTHS.includes(force.length) && DIRECTIONS.includes(force.directionDeg))) return false;
    const pairAngles = [];
    for (let first = 0; first < 3; first += 1) {
      for (let second = first + 1; second < 3; second += 1) {
        const angle = minimumAngle(question.forces[first].directionDeg, question.forces[second].directionDeg);
        pairAngles.push(angle);
        if (angle < 25 || angle > 155 || angle === 90) return false;
      }
    }
    if (Math.max(...pairAngles) < 80) return false;
    const resultant = add(...question.forces);
    if (magnitude(resultant) < 60 - EPSILON || magnitude(resultant) > 220 + EPSILON) return false;
    for (const order of permutations(question.forces)) {
      let point = { ...ORIGIN };
      if (!pointInside(point, 18)) return false;
      for (const force of order) {
        point = endpoint(point, force);
        if (!pointInside(point, 18)) return false;
      }
    }
    if (!initialPlacementValid(question.forces, question.initialTails)) return false;
    return true;
  }

  function signature(question) {
    const tuples = question.forces.map((force) => [force.length, force.directionDeg]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return `${question.type}:${tuples.map(([length, direction]) => `${length}@${direction}`).join("|")}`;
  }

  const FALLBACK_BASIC = Object.freeze([
    Object.freeze([[90, 85], [105, 55]]),
    Object.freeze([[85, 275], [110, 140]]),
    Object.freeze([[95, 150], [100, 15]]),
    Object.freeze([[105, 355], [120, 275]])
  ]);
  const FALLBACK_TRIPLE = Object.freeze([[75, 260], [80, 15], [95, 45]]);

  function rotateFallback(entries, rotation) {
    return entries.map(([length, direction], index) => vector(length, (direction + rotation) % 360, `F${index + 1}`));
  }

  function fallbackQuestion(type, seed, index, profile = GENERATOR_PROFILES[LEGACY_GENERATOR_VERSION]) {
    if (type === "head-to-tail-3") {
      const start = (seed % 72) * 5;
      for (let step = 0; step < 72; step += 1) {
        const forces = rotateFallback(FALLBACK_TRIPLE, (start + step * 5) % 360);
        const question = { type, forces, initialTails: forces.map((force, forceIndex) => initialTail(profile.tripleCenters[forceIndex], force)) };
        if (validateTriple(question)) return question;
      }
    } else {
      const template = FALLBACK_BASIC[index % FALLBACK_BASIC.length];
      const start = ((seed >>> ((index % 4) * 8)) % 72) * 5;
      for (let step = 0; step < 72; step += 1) {
        const rotated = rotateFallback(template, (start + step * 5) % 360);
        const question = { type, forces: rotated, initialTails: rotated.map((force, forceIndex) => initialTail(BASIC_CENTERS[forceIndex], force)) };
        if (validateBasic(question)) return question;
      }
    }
    throw new Error("Versioned fallback template did not satisfy generator constraints");
  }

  function generateQuestion(type, random, seed, index, forceFallback, profile = GENERATOR_PROFILES[LEGACY_GENERATOR_VERSION]) {
    if (!forceFallback) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const candidate = type === "head-to-tail-3" ? tripleCandidate(random, profile) : basicCandidate(type, random);
        if ((type === "head-to-tail-3" ? validateTriple(candidate) : validateBasic(candidate))) return { question: candidate, attempts: attempt, fallback: false };
      }
    }
    return { question: fallbackQuestion(type, seed, index, profile), attempts: MAX_ATTEMPTS, fallback: true };
  }

  function generateVersion(options, generatorVersion, profile) {
    const seed = options?.seed;
    if (!validateSeed(seed)) throw new Error("seed must be a uint32");
    const random = mulberry32(seed);
    const questions = [];
    const signatures = new Set();
    const diagnostics = [];
    for (let index = 0; index < BASIC_TYPES.length; index += 1) {
      let generated;
      for (let duplicateAttempt = 0; duplicateAttempt < MAX_ATTEMPTS; duplicateAttempt += 1) {
        generated = generateQuestion(BASIC_TYPES[index], random, seed, index, options?.forceFallback === true, profile);
        const currentSignature = signature(generated.question);
        if (!signatures.has(currentSignature)) { signatures.add(currentSignature); break; }
        generated = null;
      }
      if (!generated) generated = { question: fallbackQuestion(BASIC_TYPES[index], seed ^ (index * 0x9e3779b9), index, profile), attempts: MAX_ATTEMPTS, fallback: true };
      signatures.add(signature(generated.question));
      questions.push({ ...generated.question, id: QUESTION_IDS[index], guided: index === 0 || index === 2 });
      diagnostics.push({ attempts: generated.attempts, fallback: generated.fallback });
    }
    const triple = generateQuestion("head-to-tail-3", random, seed, 4, options?.forceFallback === true, profile);
    questions.push({ ...triple.question, id: "T1", guided: false });
    diagnostics.push({ attempts: triple.attempts, fallback: triple.fallback });
    return deepFreeze({
      schemaVersion: 1,
      generatorVersion,
      seed,
      width: WIDTH,
      height: HEIGHT,
      origin: { ...ORIGIN },
      safeRegion: { ...SAFE },
      questions,
      diagnostics,
      signature: questions.map(signature).join("||")
    });
  }

  function generateV1(options) {
    return generateVersion(options, LEGACY_GENERATOR_VERSION, GENERATOR_PROFILES[LEGACY_GENERATOR_VERSION]);
  }

  function generateV2(options) {
    return generateVersion(options, GENERATOR_VERSION, GENERATOR_PROFILES[GENERATOR_VERSION]);
  }

  const GENERATORS = Object.freeze({ 1: generateV1, 2: generateV2 });

  function generateScenario(options = {}) {
    const version = options.generatorVersion ?? GENERATOR_VERSION;
    const generator = GENERATORS[version];
    if (!generator) throw new Error(`Unsupported generator version ${version}`);
    return generator(options);
  }

  function newSeed(cryptoObject = typeof crypto !== "undefined" ? crypto : null) {
    if (cryptoObject?.getRandomValues) {
      const values = new Uint32Array(1);
      cryptoObject.getRandomValues(values);
      return values[0] >>> 0;
    }
    newSeed.counter = (newSeed.counter + 1) >>> 0;
    const highResolution = typeof performance !== "undefined" && Number.isFinite(performance.now()) ? Math.floor(performance.now() * 1000) : 0;
    return (Date.now() ^ highResolution ^ Math.imul(newSeed.counter, 0x9e3779b9)) >>> 0;
  }
  newSeed.counter = 0;

  return Object.freeze({
    GENERATOR_VERSION, LEGACY_GENERATOR_VERSION, GENERATORS, WIDTH, HEIGHT, ORIGIN, SAFE, MAX_ATTEMPTS, EPSILON,
    BASIC_LENGTHS, TRIPLE_LENGTHS, DIRECTIONS, QUESTION_IDS,
    validateSeed, mulberry32, vector, magnitude, add, minimumAngle, endpoint, permutations,
    validateBasic, validateTriple, signature, generateScenario, newSeed
  });
});
