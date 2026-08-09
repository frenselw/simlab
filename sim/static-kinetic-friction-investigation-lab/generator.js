(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const GENERATOR_VERSION = 1;
  const PHYSICS_VERSION = 2;
  const MEASUREMENT_VERSION = 4;
  const RUBRIC_VERSION = 2;
  const GRAVITY_MPS2 = 9.81;
  const MASS_OPTIONS_KG = Object.freeze([1.5, 1.7, 1.9, 2.1]);
  const FRICTION_PAIRS = Object.freeze([
    Object.freeze({ muS: 0.36, muK: 0.28 }),
    Object.freeze({ muS: 0.38, muK: 0.29 }),
    Object.freeze({ muS: 0.40, muK: 0.31 }),
    Object.freeze({ muS: 0.42, muK: 0.32 })
  ]);
  const CONNECTOR = Object.freeze({
    restLengthM: 0.18,
    stiffnessNPerM: 300,
    dampingNsPerM: 18,
    dampingEngagementLengthM: 0.004
  });
  const SURFACE_VARIATION_FRACTION = 0.02;
  const SURFACE_GRID_STEP_M = 0.002;
  const MAX_TRIAL_DURATION_S = 30;
  const STAGE_LENGTH_M = 1.65;
  const SENSOR_RANGE_N = 12;
  const BALANCE_PULL_FRACTIONS = Object.freeze([0.24, 0.28, 0.32, 0.36]);
  const PREDICTION_BOUNDARY_MARGIN_N = 0.60;
  const PREDICTION_FORCE_STEP_N = 0.10;
  const FLOAT_EPSILON = 1e-9;

  function uint32(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n >>> 0 : null;
  }
  function hashString(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function deriveSeed(seed, label) {
    let h = hashString(`${uint32(seed)}:${label}`);
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function createRng(seed) {
    let state = (uint32(seed) || 1) >>> 0;
    return {
      nextUint32() {
        state ^= state << 13; state >>>= 0;
        state ^= state >>> 17; state >>>= 0;
        state ^= state << 5; state >>>= 0;
        return state >>> 0;
      },
      next() { return this.nextUint32() / 0x100000000; },
      pick(values) { return values[Math.floor(this.next() * values.length)]; }
    };
  }
  function quantize(value, step) { return Math.round(value / step) * step; }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(freeze);
    return value;
  }

  function rawSurface(positionM, profile) {
    const a = 0.55 * Math.sin(2 * Math.PI * positionM / profile.lambda1M + profile.phase1);
    const b = 0.30 * Math.sin(2 * Math.PI * positionM / profile.lambda2M + profile.phase2);
    const c = 0.15 * Math.sin(2 * Math.PI * positionM / profile.lambda3M + profile.phase3);
    return a + b + c;
  }
  function activeTrackMean(profile) {
    const count = Math.floor(STAGE_LENGTH_M / SURFACE_GRID_STEP_M) + 1;
    let sum = 0;
    for (let i = 0; i < count; i += 1) sum += rawSurface(i * SURFACE_GRID_STEP_M, profile);
    return sum / count;
  }
  function surfaceVariation(positionM, profile) {
    if (!profile) return 0;
    const value = (rawSurface(Number(positionM) || 0, profile) - profile.activeTrackMean) * profile.activeTrackScale;
    return clamp(value, -1, 1);
  }
  function choosePrediction(rng, candidates, predicate, fallback) {
    const order = candidates.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const index of order) if (predicate(candidates[index])) return candidates[index];
    return fallback;
  }
  function generatePredictions(seed, massKg, staticLimitMeanN, kineticFrictionMeanN) {
    const rng = createRng(deriveSeed(seed, "prediction"));
    const staticCandidates = [0.55, 0.60, 0.65, 0.70, 0.75].map((fraction) =>
      quantize(staticLimitMeanN * fraction, PREDICTION_FORCE_STEP_N));
    const staticPullN = choosePrediction(rng, staticCandidates,
      (value) => staticLimitMeanN - value >= PREDICTION_BOUNDARY_MARGIN_N,
      quantize(Math.max(0.1, staticLimitMeanN - PREDICTION_BOUNDARY_MARGIN_N), PREDICTION_FORCE_STEP_N));
    const highMargin = Math.max(1.0, 0.20 * kineticFrictionMeanN);
    const lowMargin = Math.max(0.8, 0.18 * kineticFrictionMeanN);
    const highPullN = choosePrediction(rng, [0.2, 0.25, 0.3, 0.35].map((f) => quantize(kineticFrictionMeanN + highMargin + f, 0.1)),
      (value) => value >= kineticFrictionMeanN + highMargin,
      quantize(kineticFrictionMeanN + highMargin, 0.1));
    const lowPullN = choosePrediction(rng, [0.1, 0.2, 0.3, 0.4].map((f) => quantize(kineticFrictionMeanN - lowMargin - f, 0.1)),
      (value) => value <= kineticFrictionMeanN - lowMargin,
      quantize(Math.max(0.1, kineticFrictionMeanN - lowMargin), 0.1));
    const slots = [
      { slot: "zero", pullN: 0, velocityMps: 0, frictionType: "none", direction: "none", magnitudeN: 0, motionOutcome: "remain-still" },
      { slot: "static-below-limit", pullN: staticPullN, velocityMps: 0, frictionType: "static", direction: "left", magnitudeN: staticPullN, motionOutcome: "remain-still" },
      // Keep the full mean in the authority model.  The learner-facing
      // centinewton value is deliberately rounded below, but scoring must not
      // compare against a display-rounded value.
      { slot: "sliding-pull-greater", pullN: highPullN, velocityMps: rng.pick([0.10, 0.12, 0.14]), frictionType: "kinetic", direction: "left", magnitudeN: kineticFrictionMeanN, motionOutcome: "speed-up" },
      { slot: "sliding-pull-less", pullN: lowPullN, velocityMps: rng.pick([0.16, 0.18, 0.20]), frictionType: "kinetic", direction: "left", magnitudeN: kineticFrictionMeanN, motionOutcome: "slow-down" }
    ];
    // Shuffle presentation only; canonical scoring uses slot.
    for (let i = slots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    return slots.map((item, index) => ({
      id: `D${index + 1}`,
      scenarioId: item.slot,
      ...item,
      pullCN: Math.round(item.pullN * 100),
      // Display precision is 0.1 N.  `magnitudeN` remains authoritative.
      magnitudeCN: Math.round(quantize(item.magnitudeN, 0.1) * 100)
    }));
  }

  function generateScenario(options = {}) {
    const seed = uint32(options.seed);
    if (seed === null || options.generatorVersion && options.generatorVersion !== GENERATOR_VERSION ||
        options.physicsVersion && options.physicsVersion !== PHYSICS_VERSION ||
        options.measurementVersion && options.measurementVersion !== MEASUREMENT_VERSION) {
      throw new Error("Unsupported generator version or seed");
    }
    const parameterRng = createRng(deriveSeed(seed, "parameters"));
    const massKg = parameterRng.pick(MASS_OPTIONS_KG);
    const pair = parameterRng.pick(FRICTION_PAIRS);
    const normalForceN = massKg * GRAVITY_MPS2;
    const staticLimitMeanN = pair.muS * normalForceN;
    const kineticFrictionMeanN = pair.muK * normalForceN;
    if (staticLimitMeanN < 4.5 || staticLimitMeanN > 9 || kineticFrictionMeanN < 3.2 || kineticFrictionMeanN > 7 || staticLimitMeanN - kineticFrictionMeanN < 0.8) {
      throw new Error("Generated scenario violates friction constraints");
    }
    const balancePullDirection = parameterRng.pick(["left", "right"]);
    const balancePullN = quantize(staticLimitMeanN * parameterRng.pick(BALANCE_PULL_FRACTIONS), 0.1);
    const surfaceRng = createRng(deriveSeed(seed, "surface"));
    const surfaceProfile = {
      lambda1M: 0.18 + surfaceRng.next() * 0.10,
      lambda2M: 0.055 + surfaceRng.next() * 0.035,
      lambda3M: 0.021 + surfaceRng.next() * 0.014,
      phase1: surfaceRng.next() * Math.PI * 2,
      phase2: surfaceRng.next() * Math.PI * 2,
      phase3: surfaceRng.next() * Math.PI * 2,
      activeTrackMean: 0,
      activeTrackScale: 1
    };
    surfaceProfile.activeTrackMean = activeTrackMean(surfaceProfile);
    surfaceProfile.activeTrackScale = 1 / (1 + Math.abs(surfaceProfile.activeTrackMean));
    const predictions = generatePredictions(seed, massKg, staticLimitMeanN, kineticFrictionMeanN);
    const scenario = {
      generatorVersion: GENERATOR_VERSION,
      physicsVersion: PHYSICS_VERSION,
      measurementVersion: MEASUREMENT_VERSION,
      rubricVersion: RUBRIC_VERSION,
      seed,
      massKg,
      normalForceN,
      muS: pair.muS,
      muK: pair.muK,
      staticLimitMeanN,
      kineticFrictionMeanN,
      balancePullDirection,
      balancePullN,
      balancePullCN: Math.round(balancePullN * 100),
      surfaceVariationFraction: SURFACE_VARIATION_FRACTION,
      surfaceProfile,
      connector: CONNECTOR,
      sensorRangeN: SENSOR_RANGE_N,
      stage: { lengthM: STAGE_LENGTH_M, maxTrialDurationS: MAX_TRIAL_DURATION_S },
      predictionSeed: deriveSeed(seed, "prediction"),
      sensorSeed: deriveSeed(seed, "sensor"),
      surfaceSeed: deriveSeed(seed, "surface"),
      predictions
    };
    return freeze(scenario);
  }

  return Object.freeze({
    GENERATOR_VERSION, PHYSICS_VERSION, MEASUREMENT_VERSION, RUBRIC_VERSION,
    GRAVITY_MPS2, MASS_OPTIONS_KG, FRICTION_PAIRS, CONNECTOR, SURFACE_VARIATION_FRACTION,
    SURFACE_GRID_STEP_M, MAX_TRIAL_DURATION_S, STAGE_LENGTH_M, SENSOR_RANGE_N,
    PREDICTION_BOUNDARY_MARGIN_N, PREDICTION_FORCE_STEP_N, BALANCE_PULL_FRACTIONS, FLOAT_EPSILON,
    deriveSeed, createRng, rawSurface, surfaceVariation, generateScenario,
    staticLimitAt(positionM, scenario) { return scenario.staticLimitMeanN; },
    kineticFrictionAt(positionM, scenario) { return scenario.kineticFrictionMeanN * (1 + scenario.surfaceVariationFraction * surfaceVariation(positionM, scenario.surfaceProfile)); },
    quantize
  });
});
