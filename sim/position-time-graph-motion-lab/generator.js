(function (root, factory) {
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.PositionTimeScoring;
  const api = factory(scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PositionTimeGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function (Scoring) {
  "use strict";

  const GENERATOR_VERSION = 2;
  const SEED_PATTERN = /^[0-9a-f]{32}$/;
  const MISSION_KEYS = Object.freeze(["m1", "m2", "m3", "m4", "m5"]);
  const X0_VALUES = Object.freeze(Array.from({ length: 17 }, (_, index) => index - 8));
  const EVEN_X0_VALUES = Object.freeze(X0_VALUES.filter((value) => value % 2 === 0));
  const VELOCITY_VALUES = Object.freeze([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]);
  const INTEGER_VELOCITIES = Object.freeze([-2, -1, 1, 2]);
  const M4_CATEGORIES = Object.freeze(["stationary", "positive", "negative"]);
  const M3_CATEGORIES = Object.freeze(["A", "B", "same"]);

  function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
  function exactKeys(value, keys) { return plain(value) && Object.keys(value).sort().join(",") === keys.slice().sort().join(","); }
  function lattice(value, step) { return Number.isFinite(value) && Math.abs(value / step - Math.round(value / step)) < 1e-9; }
  function inSet(value, values) { return values.includes(value); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function motionSignature(motion) { return `${motion.x0}:${motion.v}`; }
  function categoryM3(scenario) {
    const a = Math.abs(scenario.A.v);
    const b = Math.abs(scenario.B.v);
    return a === b ? "same" : a > b ? "A" : "B";
  }
  function categoryM4(scenario) { return scenario.v === 0 ? "stationary" : scenario.v > 0 ? "positive" : "negative"; }

  function encodeSeed(words) {
    if (!Array.isArray(words) && !(words instanceof Uint32Array)) return null;
    if (words.length !== 4 || !Array.from(words).every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffffffff)) return null;
    return Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("");
  }
  function decodeSeed(seed) {
    if (typeof seed !== "string" || !SEED_PATTERN.test(seed)) return null;
    return [0, 8, 16, 24].map((offset) => Number.parseInt(seed.slice(offset, offset + 8), 16) >>> 0);
  }
  function createSeed(cryptoRef = typeof crypto !== "undefined" ? crypto : null) {
    if (!cryptoRef || typeof cryptoRef.getRandomValues !== "function") return null;
    try {
      const words = new Uint32Array(4);
      cryptoRef.getRandomValues(words);
      return encodeSeed(words);
    } catch {
      return null;
    }
  }

  function rotl(value, shift) { return ((value << shift) | (value >>> (32 - shift))) >>> 0; }
  function avalanche(value) {
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  }
  function hashDomain(label) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < label.length; index += 1) {
      hash ^= label.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return avalanche(hash >>> 0);
  }

  // xoshiro128** with explicit uint32 arithmetic. Generator version 2 freezes
  // this algorithm, the domain derivation below, and bounded sampling together.
  function createPrng(seed, domain = "paper") {
    const words = decodeSeed(seed);
    if (!words) return null;
    const domainHash = hashDomain(`position-time-v${GENERATOR_VERSION}:${domain}`);
    const state = words.map((word, index) => avalanche((word ^ domainHash ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0));
    if (state.every((word) => word === 0)) state[0] = 0x6d2b79f5;
    function nextUint32() {
      const result = Math.imul(rotl(Math.imul(state[1], 5) >>> 0, 7), 9) >>> 0;
      const temporary = (state[1] << 9) >>> 0;
      state[2] ^= state[0]; state[3] ^= state[1]; state[1] ^= state[2]; state[0] ^= state[3];
      state[2] ^= temporary;
      state[3] = rotl(state[3], 11);
      return result >>> 0;
    }
    function bounded(limit) {
      if (!Number.isInteger(limit) || limit <= 0 || limit > 0x100000000) throw new RangeError("invalid bounded sampler limit");
      const threshold = (0x100000000 - limit) % limit;
      let value;
      do value = nextUint32(); while (value < threshold);
      return value % limit;
    }
    function shuffle(values) {
      const output = values.slice();
      for (let index = output.length - 1; index > 0; index -= 1) {
        const selected = bounded(index + 1);
        [output[index], output[selected]] = [output[selected], output[index]];
      }
      return output;
    }
    return { nextUint32, bounded, shuffle };
  }

  function validateMotion(motion, allowedX0 = X0_VALUES, allowedV = VELOCITY_VALUES, allowZero = false) {
    return exactKeys(motion, ["x0", "v"]) && inSet(motion.x0, allowedX0) && (inSet(motion.v, allowedV) || (allowZero && motion.v === 0)) && Scoring.lineWithinBounds(motion);
  }
  function validateMission(key, scenario) {
    if (key === "m1") return validateMotion(scenario) && scenario.v !== 0;
    if (key === "m2") return validateMotion(scenario, EVEN_X0_VALUES) && scenario.v !== 0 && Number.isInteger(Scoring.positionAt(scenario, 6));
    if (key === "m3") {
      return exactKeys(scenario, ["A", "B"]) && validateMotion(scenario.A, EVEN_X0_VALUES, INTEGER_VELOCITIES) && validateMotion(scenario.B, EVEN_X0_VALUES, INTEGER_VELOCITIES) && scenario.A.x0 !== scenario.B.x0 && (scenario.A.v < 0 || scenario.B.v < 0) && motionSignature(scenario.A) !== motionSignature(scenario.B) && M3_CATEGORIES.includes(categoryM3(scenario));
    }
    if (key === "m4") {
      if (!exactKeys(scenario, ["x0", "v", "atTime", "atPosition"]) || !lattice(scenario.atPosition, 0.5) || scenario.atPosition !== Scoring.positionAt(scenario, scenario.atTime)) return false;
      const category = categoryM4(scenario);
      if (category === "stationary") return scenario.v === 0 && scenario.atTime === 6 && scenario.atPosition === scenario.x0 && validateMotion({ x0: scenario.x0, v: scenario.v }, X0_VALUES, VELOCITY_VALUES, true);
      return inSet(scenario.atTime, [2, 3, 4, 5]) && validateMotion({ x0: scenario.x0, v: scenario.v }) && (category === "positive" || category === "negative");
    }
    if (key === "m5") {
      return exactKeys(scenario, ["A", "meetTime"]) && validateMotion(scenario.A) && scenario.A.v !== 0 && inSet(scenario.meetTime, [2, 3, 4, 5]) && Math.abs(Scoring.positionAt(scenario.A, scenario.meetTime)) <= 16 && lattice(Scoring.positionAt(scenario.A, scenario.meetTime), 0.5) && enumerateMeetingSolutions(scenario).length >= 3;
    }
    return false;
  }

  function enumerateMeetingSolutions(scenario) {
    if (!exactKeys(scenario, ["A", "meetTime"]) || !plain(scenario.A) || !Number.isFinite(scenario.A.x0) || !Number.isFinite(scenario.A.v) || !inSet(scenario.meetTime, [2, 3, 4, 5])) return [];
    const targetX2 = Math.round(2 * Scoring.positionAt(scenario.A, scenario.meetTime));
    const solutions = [];
    for (const x0 of X0_VALUES) {
      for (const v of [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]) {
        const motion = { x0, v };
        if (motionSignature(motion) === motionSignature(scenario.A) || !Scoring.lineWithinBounds(motion)) continue;
        if (2 * x0 + Math.round(2 * v) * scenario.meetTime !== targetX2) continue;
        const crossing = Scoring.intersection(scenario.A, motion);
        if (crossing.kind === "point" && Math.abs(crossing.time - scenario.meetTime) < 1e-9) solutions.push(motion);
      }
    }
    return solutions;
  }

  function buildPools() {
    const m1 = [];
    const m2 = [];
    const m3 = { A: [], B: [], same: [] };
    const m4 = { stationary: [], positive: [], negative: [] };
    const m5 = [];
    for (const x0 of X0_VALUES) for (const v of VELOCITY_VALUES) {
      const first = { x0, v };
      if (validateMission("m1", first)) m1.push(first);
      for (const atTime of [2, 3, 4, 5]) {
        const fourth = { x0, v, atTime, atPosition: Scoring.positionAt(first, atTime) };
        if (validateMission("m4", fourth)) m4[categoryM4(fourth)].push(fourth);
      }
      for (const meetTime of [2, 3, 4, 5]) {
        const fifth = { A: first, meetTime };
        if (validateMission("m5", fifth)) m5.push(fifth);
      }
    }
    for (const x0 of X0_VALUES) {
      const stationary = { x0, v: 0, atTime: 6, atPosition: x0 };
      if (validateMission("m4", stationary)) m4.stationary.push(stationary);
    }
    for (const x0 of EVEN_X0_VALUES) for (const v of VELOCITY_VALUES) {
      const second = { x0, v };
      if (validateMission("m2", second)) m2.push(second);
    }
    for (const x0A of EVEN_X0_VALUES) for (const x0B of EVEN_X0_VALUES) {
      for (const vA of INTEGER_VELOCITIES) for (const vB of INTEGER_VELOCITIES) {
        const third = { A: { x0: x0A, v: vA }, B: { x0: x0B, v: vB } };
        if (validateMission("m3", third)) m3[categoryM3(third)].push(third);
      }
    }
    return deepFreeze({ m1, m2, m3, m4, m5 });
  }
  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }
  const POOLS = buildPools();

  function validateGeneratedPaper(paper) {
    if (!exactKeys(paper, ["version", "missions"]) || paper.version !== GENERATOR_VERSION || !exactKeys(paper.missions, MISSION_KEYS)) return false;
    if (!MISSION_KEYS.every((key) => validateMission(key, paper.missions[key]))) return false;
    const signatures = [paper.missions.m1, paper.missions.m2, paper.missions.m4].map(motionSignature);
    if (new Set(signatures).size !== signatures.length) return false;
    const motions = [paper.missions.m1, paper.missions.m2, paper.missions.m3.A, paper.missions.m3.B, paper.missions.m4, paper.missions.m5.A];
    return motions.some((motion) => motion.v > 0) && motions.some((motion) => motion.v < 0);
  }

  function generatePaper(seed) {
    if (!decodeSeed(seed)) return null;
    const streams = Object.fromEntries(MISSION_KEYS.map((key) => [key, createPrng(seed, `mission-${key.slice(1)}`)]));
    const m3Category = M3_CATEGORIES[streams.m3.bounded(M3_CATEGORIES.length)];
    const m4Category = M4_CATEGORIES[streams.m4.bounded(M4_CATEGORIES.length)];
    const ordered = {
      m1: rotatePool(POOLS.m1, streams.m1.bounded(POOLS.m1.length)),
      m2: rotatePool(POOLS.m2, streams.m2.bounded(POOLS.m2.length)),
      m3: rotatePool(POOLS.m3[m3Category], streams.m3.bounded(POOLS.m3[m3Category].length)),
      m4: rotatePool(POOLS.m4[m4Category], streams.m4.bounded(POOLS.m4[m4Category].length)),
      m5: rotatePool(POOLS.m5, streams.m5.bounded(POOLS.m5.length))
    };
    const fixedM3 = ordered.m3[0];
    const fixedM5 = ordered.m5[0];
    for (const m1 of ordered.m1) for (const m2 of ordered.m2) for (const m4 of ordered.m4) {
      const paper = { version: GENERATOR_VERSION, missions: { m1, m2, m3: fixedM3, m4, m5: fixedM5 } };
      if (validateGeneratedPaper(paper)) return clone(paper);
    }
    return null;
  }
  function rotatePool(pool, offset) { return pool.slice(offset).concat(pool.slice(0, offset)); }
  function cleanPaper(paper) { return validateGeneratedPaper(paper) ? clone(paper) : null; }
  function fingerprint(paper) { return validateGeneratedPaper(paper) ? JSON.stringify(paper.missions) : null; }
  function matchesSeed(seed, paper) {
    if (!decodeSeed(seed) || !validateGeneratedPaper(paper)) return false;
    const expected = generatePaper(seed);
    return Boolean(expected && fingerprint(expected) === fingerprint(paper));
  }
  function poolSizes() {
    return { m1: POOLS.m1.length, m2: POOLS.m2.length, m3: Object.fromEntries(M3_CATEGORIES.map((key) => [key, POOLS.m3[key].length])), m4: Object.fromEntries(M4_CATEGORIES.map((key) => [key, POOLS.m4[key].length])), m5: POOLS.m5.length };
  }
  function candidatePools() { return POOLS; }

  return { GENERATOR_VERSION, MISSION_KEYS, X0_VALUES, EVEN_X0_VALUES, VELOCITY_VALUES, INTEGER_VELOCITIES, M3_CATEGORIES, M4_CATEGORIES, encodeSeed, decodeSeed, createSeed, createPrng, enumerateMeetingSolutions, validateMission, validateGeneratedPaper, generatePaper, cleanPaper, fingerprint, matchesSeed, poolSizes, candidatePools };
});
