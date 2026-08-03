(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HookesLawModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MODEL_HANDLE_FORCE_N = 2.5;
  const MIN_FIT_DENOMINATOR = 1e-12;
  const FLOAT_EPSILON = 1e-9;
  const MIN_OPERATION_MOVE_M = 0.005;
  const MIN_EXTENSION_M = 0.001;

  const finite = Number.isFinite;
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function extensionM(forceN, kNPerM) {
    return finite(forceN) && finite(kNPerM) && kNPerM > 0 ? forceN / kNPerM : null;
  }

  function endpointM(naturalLengthM, forceN, kNPerM) {
    const extension = extensionM(forceN, kNPerM);
    return finite(naturalLengthM) && extension !== null ? naturalLengthM + extension : null;
  }

  function measuredExtensionM(zeroM, cursorM) {
    if (![zeroM, cursorM].every(finite) || cursorM < zeroM - FLOAT_EPSILON) return null;
    return cursorM - zeroM;
  }

  function kFromModelHandle(handleExtensionM) {
    return finite(handleExtensionM) && handleExtensionM >= MIN_EXTENSION_M ? MODEL_HANDLE_FORCE_N / handleExtensionM : null;
  }

  function modelForceN(kModelNPerM, extension) {
    return finite(kModelNPerM) && finite(extension) && kModelNPerM >= 0 && extension >= 0 ? kModelNPerM * extension : null;
  }

  function fitKThroughOrigin(records) {
    if (!Array.isArray(records) || !records.length) return null;
    let numerator = 0;
    let denominator = 0;
    for (const record of records) {
      if (!record || !finite(record.forceN) || !finite(record.measuredExtensionM) || record.measuredExtensionM < 0) return null;
      numerator += record.forceN * record.measuredExtensionM;
      denominator += record.measuredExtensionM ** 2;
    }
    return denominator > MIN_FIT_DENOMINATOR ? numerator / denominator : null;
  }

  function relativeError(actual, expected) {
    if (![actual, expected].every(finite) || expected === 0) return null;
    return Math.abs(actual - expected) / Math.abs(expected);
  }

  function graphPointFromPhysics(extension, forceN, graph) {
    if (!graph || ![extension, forceN, graph.left, graph.top, graph.width, graph.height, graph.maxExtensionM, graph.maxForceN].every(finite) || graph.maxExtensionM <= 0 || graph.maxForceN <= 0) return null;
    return {
      x: graph.left + clamp(extension, 0, graph.maxExtensionM) / graph.maxExtensionM * graph.width,
      y: graph.top + graph.height - clamp(forceN, 0, graph.maxForceN) / graph.maxForceN * graph.height
    };
  }

  function physicsFromGraphPoint(x, y, graph) {
    if (!graph || ![x, y, graph.left, graph.top, graph.width, graph.height, graph.maxExtensionM, graph.maxForceN].every(finite) || graph.width <= 0 || graph.height <= 0) return null;
    return {
      extensionM: clamp((x - graph.left) / graph.width, 0, 1) * graph.maxExtensionM,
      forceN: clamp((graph.top + graph.height - y) / graph.height, 0, 1) * graph.maxForceN
    };
  }

  function enumerateDesigns(scenario) {
    const moduleForceN = scenario?.design?.moduleForceN;
    const maxModuleCount = scenario?.design?.maxModuleCount;
    const limitM = scenario?.design?.limitM;
    if (!scenario?.springs || !finite(moduleForceN) || !Number.isInteger(maxModuleCount) || maxModuleCount < 1 || !finite(limitM)) return [];
    return ["A", "B"].flatMap((springKey) => {
      const spring = scenario.springs[springKey];
      if (!spring || !finite(spring.kNPerM) || spring.kNPerM <= 0) return [];
      return Array.from({ length: maxModuleCount }, (_, index) => {
        const moduleCount = index + 1;
        const forceN = moduleCount * moduleForceN;
        const extension = extensionM(forceN, spring.kNPerM);
        return { springKey, moduleCount, forceN, extensionM: extension, safe: extension !== null && extension <= limitM + FLOAT_EPSILON };
      });
    });
  }

  function optimalSafeDesign(scenario) {
    const safe = enumerateDesigns(scenario).filter((design) => design.safe);
    if (!safe.length) return null;
    const forceN = Math.max(...safe.map((design) => design.forceN));
    const candidates = safe.filter((design) => Math.abs(design.forceN - forceN) <= FLOAT_EPSILON);
    if (!candidates.length) return null;
    return candidates[0];
  }

  function validOperationEvidence(evidence, positionM, maximumM) {
    return Boolean(evidence && (evidence.mode === "pointer" || evidence.mode === "keyboard") &&
      finite(evidence.moveM) && evidence.moveM >= MIN_OPERATION_MOVE_M - FLOAT_EPSILON &&
      finite(positionM) && positionM >= 0 && positionM <= maximumM + FLOAT_EPSILON);
  }

  return {
    MODEL_HANDLE_FORCE_N,
    MIN_FIT_DENOMINATOR,
    FLOAT_EPSILON,
    MIN_OPERATION_MOVE_M,
    MIN_EXTENSION_M,
    finite,
    clamp,
    extensionM,
    endpointM,
    measuredExtensionM,
    kFromModelHandle,
    modelForceN,
    fitKThroughOrigin,
    relativeError,
    graphPointFromPhysics,
    physicsFromGraphPoint,
    enumerateDesigns,
    optimalSafeDesign,
    validOperationEvidence
  };
});
