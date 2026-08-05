(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HookesLawGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const GENERATOR_VERSION = 3;
  const K_PAIRS_N_PER_M = Object.freeze([
    Object.freeze([20, 35]),
    Object.freeze([20, 40]),
    Object.freeze([25, 40]),
    Object.freeze([25, 45]),
    Object.freeze([30, 50]),
    Object.freeze([35, 50])
  ]);
  const NATURAL_LENGTHS_M = Object.freeze([0.075, 0.085, 0.095, 0.105]);
  const INVESTIGATION_FORCES_N = Object.freeze([1.0, 2.0, 3.0]);
  const PREDICTION_COUNT = 3;
  const PREDICTION_MIN_EXTENSION_CM = 3;
  const PREDICTION_MAX_FORCE_N = 4;
  const LIMITS_M = Object.freeze([0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12]);
  const STAGE_SPAN_M = 0.29;
  const MAX_LINEAR_EXTENSION_M = 0.18;
  const MODULE_FORCE_N = 0.5;
  const MAX_MODULE_COUNT = 8;
  const FLOAT_EPSILON = 1e-9;

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
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function integer(random, maximum) {
    return Math.floor(random() * maximum);
  }

  function shuffled(values, random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = integer(random, index + 1);
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function extensionM(forceN, kNPerM) {
    return forceN / kNPerM;
  }

  function displayCm(meters) {
    return Math.round(meters * 1000) / 10;
  }

  function enumerateDesigns(scenario, limitM = scenario?.design?.limitM) {
    if (!scenario?.springs || !Number.isFinite(limitM)) return [];
    return ["A", "B"].flatMap((springKey) =>
      Array.from({ length: MAX_MODULE_COUNT }, (_, index) => {
        const moduleCount = index + 1;
        const forceN = moduleCount * MODULE_FORCE_N;
        const extension = extensionM(forceN, scenario.springs[springKey].kNPerM);
        return {
          springKey,
          moduleCount,
          forceN,
          extensionM: extension,
          displayExtensionCm: displayCm(extension),
          safe: extension <= limitM + FLOAT_EPSILON
        };
      })
    );
  }

  function bestDesigns(designs) {
    const safe = designs.filter((design) => design.safe);
    if (!safe.length) return [];
    const bestForce = Math.max(...safe.map((design) => design.forceN));
    return safe.filter((design) => Math.abs(design.forceN - bestForce) <= FLOAT_EPSILON);
  }

  function candidateDesignLimits(springs) {
    return LIMITS_M.filter((limitM) => {
      const scenario = { springs, design: { limitM } };
      const designs = enumerateDesigns(scenario, limitM);
      const safe = designs.filter((design) => design.safe);
      if (!safe.every((design) => design.extensionM <= MAX_LINEAR_EXTENSION_M + FLOAT_EPSILON)) return false;
      if (!springs || !["A", "B"].every((key) => safe.some((design) => design.springKey === key && design.moduleCount >= 1))) return false;
      const best = bestDesigns(designs);
      if (best.length !== 1) return false;
      const bestCount = best[0].moduleCount;
      if (bestCount < 3 || bestCount > 7) return false;
      const lowerCounts = safe.filter((design) => design.forceN < best[0].forceN).map((design) => design.moduleCount);
      if (lowerCounts.length && Math.max(...lowerCounts) > bestCount - 1) return false;
      const plusOne = designs.filter((design) => design.moduleCount === bestCount + 1);
      if (plusOne.some((design) => design.safe)) return false;
      const nextDisplay = plusOne.map((design) => design.displayExtensionCm);
      return nextDisplay.every((value) => value !== best[0].displayExtensionCm);
    });
  }

  function predictionCandidates(kNPerM) {
    if (!Number.isFinite(kNPerM) || kNPerM <= 0) return [];
    const maximumExtensionCm = Math.min(
      Math.round(MAX_LINEAR_EXTENSION_M * 100),
      Math.floor((PREDICTION_MAX_FORCE_N * 100) / kNPerM + FLOAT_EPSILON)
    );
    if (maximumExtensionCm < PREDICTION_MIN_EXTENSION_CM) return [];
    return Array.from({ length: maximumExtensionCm - PREDICTION_MIN_EXTENSION_CM + 1 }, (_, index) => {
      const extensionCm = PREDICTION_MIN_EXTENSION_CM + index;
      const forceN = (kNPerM * extensionCm) / 100;
      return { extensionCm, extensionM: extensionCm / 100, forceN };
    }).filter((candidate) => !INVESTIGATION_FORCES_N.some((forceN) => Math.abs(forceN - candidate.forceN) <= FLOAT_EPSILON));
  }

  function choosePredictionSet(springKeys, springs, random) {
    const candidateLists = springKeys.map((springKey) => shuffled(predictionCandidates(springs[springKey].kNPerM), random));
    if (candidateLists.some((candidates) => !candidates.length)) throw new Error("Generator produced no valid prediction candidates");
    const combinations = [];
    function visit(index, selected, usedForces, usedExtensions) {
      if (index === candidateLists.length) {
        combinations.push(selected.slice());
        return;
      }
      for (const candidate of candidateLists[index]) {
        if (usedForces.some((forceN) => Math.abs(forceN - candidate.forceN) <= FLOAT_EPSILON)) continue;
        if (usedExtensions.includes(candidate.extensionCm)) continue;
        visit(
          index + 1,
          selected.concat({ springKey: springKeys[index], ...candidate }),
          usedForces.concat(candidate.forceN),
          usedExtensions.concat(candidate.extensionCm)
        );
      }
    }
    visit(0, [], [], []);
    if (!combinations.length) throw new Error("Generator produced no valid prediction set");
    return combinations[integer(random, combinations.length)];
  }

  function generateScenario({ seed, generatorVersion = GENERATOR_VERSION } = {}) {
    if (!validateSeed(seed) || generatorVersion !== GENERATOR_VERSION) throw new Error("Unsupported generator input");
    const random = mulberry32(seed);
    const pair = K_PAIRS_N_PER_M[integer(random, K_PAIRS_N_PER_M.length)];
    const orderedK = random() < 0.5 ? pair.slice() : pair.slice().reverse();
    const natural = shuffled(NATURAL_LENGTHS_M, random).slice(0, 2);
    const springs = {
      A: { key: "A", kNPerM: orderedK[0], naturalLengthM: natural[0] },
      B: { key: "B", kNPerM: orderedK[1], naturalLengthM: natural[1] }
    };
    const candidateLimits = candidateDesignLimits(springs);
    if (!candidateLimits.length) throw new Error("Generator produced no valid engineering limit");
    const limitM = candidateLimits[integer(random, candidateLimits.length)];
    const firstSpring = random() < 0.5 ? "A" : "B";
    const secondSpring = firstSpring === "A" ? "B" : "A";
    const thirdSpring = random() < 0.5 ? "A" : "B";
    const predictionSpringKeys = [firstSpring, secondSpring, thirdSpring];
    const predictionSet = choosePredictionSet(predictionSpringKeys, springs, random);
    const predictions = predictionSet.map((prediction, index) => ({
      id: `P${index + 1}`,
      springKey: prediction.springKey,
      forceN: prediction.forceN,
      trueExtensionM: prediction.extensionM
    }));
    const maxEndpointM = Math.max(
      ...Object.values(springs).flatMap((spring) => INVESTIGATION_FORCES_N.map((forceN) => spring.naturalLengthM + extensionM(forceN, spring.kNPerM))),
      ...predictions.map((prediction) => springs[prediction.springKey].naturalLengthM + prediction.trueExtensionM)
    );
    if (maxEndpointM > STAGE_SPAN_M + FLOAT_EPSILON) throw new Error("Generator exceeded stage span");
    const scenario = {
      generatorVersion: GENERATOR_VERSION,
      seed,
      springs,
      investigationForcesN: INVESTIGATION_FORCES_N.slice(),
      predictionForcesN: predictions.map((prediction) => prediction.forceN),
      predictions,
      design: {
        limitM,
        moduleForceN: MODULE_FORCE_N,
        maxModuleCount: MAX_MODULE_COUNT
      },
      stage: {
        spanM: STAGE_SPAN_M,
        maxLinearExtensionM: MAX_LINEAR_EXTENSION_M,
        maxEndpointM
      }
    };
    return deepFreeze(scenario);
  }

  return {
    GENERATOR_VERSION,
    K_PAIRS_N_PER_M,
    NATURAL_LENGTHS_M,
    INVESTIGATION_FORCES_N,
    PREDICTION_COUNT,
    PREDICTION_MIN_EXTENSION_CM,
    PREDICTION_MAX_FORCE_N,
    LIMITS_M,
    STAGE_SPAN_M,
    MAX_LINEAR_EXTENSION_M,
    MODULE_FORCE_N,
    MAX_MODULE_COUNT,
    FLOAT_EPSILON,
    validateSeed,
    mulberry32,
    extensionM,
    displayCm,
    enumerateDesigns,
    bestDesigns,
    candidateDesignLimits,
    predictionCandidates,
    choosePredictionSet,
    generateScenario
  };
});
