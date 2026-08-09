(function (root, factory) {
  const G = root.StaticKineticFrictionGenerator || (typeof module === "object" && module.exports ? require("./generator.js") : null);
  const api = factory(G);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionMeasurement = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator) {
  "use strict";

  const GRAPH_SAMPLE_DT_S = 0.10;
  const GRAPH_SAMPLE_DT_MS = 100;
  const MAX_TRIAL_DURATION_S = 30;
  const MAX_REGULAR_SAMPLE_COUNT = 301;
  const FORCE_SENSOR_TAU_S = 0.025;
  const VELOCITY_SENSOR_TAU_S = 0.040;
  const FORCE_SENSOR_NOISE_SIGMA_N = 0.015;
  const FORCE_SENSOR_RESOLUTION_N = 0.01;
  const FORCE_SENSOR_NOISE_RHO = 0.70;
  const FORCE_SENSOR_NOISE_MAX_ABS_N = 0.045;
  const VELOCITY_NOISE_SIGMA_MPS = 0.0025;
  const VELOCITY_RESOLUTION_MPS = 0.001;
  const VELOCITY_NOISE_MAX_ABS_MPS = 0.0075;
  const VELOCITY_NOISE_RHO = 0.70;
  const MAX_FORCE_CN = 1200;
  const MIN_VELOCITY_MMPS = -1000;
  const MAX_VELOCITY_MMPS = 5000;
  const MIN_STATIC_OBSERVATION_SEPARATION_N = 1;
  const MIN_PREBREAK_DURATION_S = 0.8;
  const MIN_FORCE_RISE_N = 1;
  const MAX_LOADING_SLOPE_N_PER_S = 6;
  const MIN_POSTBREAK_MOVE_S = 1.0;
  const MIN_PLATEAU_DURATION_S = 1.2;
  const MAX_PLATEAU_ABS_SLOPE_MPS2 = 0.04;
  const MIN_MOVING_SPEED_MPS = 0.04;
  const MIN_ACCELERATION_DURATION_S = 0.50;
  const MIN_ACCELERATION_DELTA_V_MPS = 0.06;
  const MIN_ACCELERATION_SLOPE_MPS2 = 0.08;
  const MAX_PLATEAU_FORCE_CV = 0.08;
  const MAX_OTHER_PHASE_FRACTION = 0.15;
  const MIN_STATIC_RISE_DURATION_S = 0.60;
  const MIN_STATIC_RISE_FORCE_DELTA_N = 0.80;
  const MIN_STATIC_RISE_FORCE_SLOPE_N_PER_S = 0.30;
  const MAX_STATIC_ABS_VELOCITY_MPS = 0.012;
  const SLOW_SPEED_MIN_MPS = 0.07;
  const SLOW_SPEED_MAX_MPS = 0.13;
  const FAST_SPEED_MIN_MPS = 0.16;
  const FAST_SPEED_MAX_MPS = 0.23;
  const MIN_SPEED_DIFFERENCE_MPS = 0.06;
  const candidateCache = new Map();

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function finite(v, fallback = 0) { return Number.isFinite(v) ? v : fallback; }
  function quantize(v, step) { return Math.round(v / step) * step; }
  function lowPass(previous, target, dt, timeConstantS) {
    const alpha = 1 - Math.exp(-Math.max(0, dt) / timeConstantS);
    return previous + alpha * (target - previous);
  }
  function stepCorrelatedNoise(previous, rng, rho) {
    const white = clamp(gaussian(rng), -3, 3);
    return clamp(rho * previous + Math.sqrt(1 - rho * rho) * white, -3, 3);
  }
  function gaussian(rng) {
    const u = Math.max(1e-12, rng.next());
    const v = Math.max(1e-12, rng.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  }
  function base64ToBytes(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new Error("invalid trace base64");
    if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(value, "base64"));
    const text = atob(value);
    return Uint8Array.from([...text].map((ch) => ch.charCodeAt(0)));
  }
  function createMeasurementState(scenario, options = {}) {
    const seed = Number.isInteger(options.sensorSeed) ? options.sensorSeed >>> 0 : scenario.sensorSeed;
    return {
      sensorSeed: seed,
      forceFilteredN: 0,
      velocityFilteredMps: 0,
      forceNoise: 0,
      velocityNoise: 0,
      lastSampleTimeS: -Infinity,
      regularSamples: [],
      breakaway: null,
      running: false,
      aborted: false,
      overrange: false
    };
  }
  function cloneMeasurementState(state) {
    return { ...state, regularSamples: state.regularSamples.map((sample) => ({ ...sample })), breakaway: state.breakaway ? { ...state.breakaway } : null };
  }
  function step(state, physical, scenario, dt) {
    const next = cloneMeasurementState(state);
    const directForceN = Number.isFinite(physical?.appliedForceN) ? Math.abs(physical.appliedForceN) : finite(physical?.connector?.tensionPhysicalN);
    const directVelocityMps = Number.isFinite(physical?.appliedForceN) ? Math.abs(finite(physical?.block?.velocityMps)) : Math.max(0, finite(physical?.block?.velocityMps));
    next.forceFilteredN = lowPass(state.forceFilteredN, directForceN, dt, FORCE_SENSOR_TAU_S);
    next.velocityFilteredMps = lowPass(state.velocityFilteredMps, directVelocityMps, dt, VELOCITY_SENSOR_TAU_S);
    return { state: next, live: liveReading(next) };
  }
  function liveReading(state) {
    const forceN = Math.max(0, state.forceFilteredN);
    return { forceN, velocityMps: Math.max(0, state.velocityFilteredMps), forceCN: Math.round(forceN * 100), velocityMMps: Math.round(Math.max(0, state.velocityFilteredMps) * 1000) };
  }
  function captureSample(state, physical, scenario, options = {}) {
    const next = cloneMeasurementState(state);
    const timeS = finite(options.timeS, physical?.timeS ?? 0);
    let sample = null;
    const targetIndex = Math.min(MAX_REGULAR_SAMPLE_COUNT - 1, Math.floor((timeS + 1e-9) / GRAPH_SAMPLE_DT_S));
    if (timeS >= -1e-9 && timeS <= MAX_TRIAL_DURATION_S + 1e-9 && targetIndex >= 0) {
      // The recorder can be called after a render frame has crossed more than
      // one 40 ms boundary.  Fill every missed canonical index instead of
      // rounding the current physics time (which creates gaps such as 9, 11).
      for (let index = next.regularSamples.length; index <= targetIndex && index < MAX_REGULAR_SAMPLE_COUNT; index += 1) {
        const forceRng = options.rng || Generator.createRng(Generator.deriveSeed(next.sensorSeed, `f:${index}`));
        const velocityRng = options.velocityRng || Generator.createRng(Generator.deriveSeed(next.sensorSeed, `v:${index}`));
        next.forceNoise = stepCorrelatedNoise(next.forceNoise, forceRng, FORCE_SENSOR_NOISE_RHO);
        next.velocityNoise = stepCorrelatedNoise(next.velocityNoise, velocityRng, VELOCITY_NOISE_RHO);
        const forceNoiseN = clamp(FORCE_SENSOR_NOISE_SIGMA_N * next.forceNoise, -FORCE_SENSOR_NOISE_MAX_ABS_N, FORCE_SENSOR_NOISE_MAX_ABS_N);
        const velocityNoiseMps = clamp(VELOCITY_NOISE_SIGMA_MPS * next.velocityNoise, -VELOCITY_NOISE_MAX_ABS_MPS, VELOCITY_NOISE_MAX_ABS_MPS);
        const forceSignalN = Math.max(0, next.forceFilteredN);
        const velocitySignalMps = Math.max(0, next.velocityFilteredMps);
        const measuredPullN = quantize(Math.max(0, forceSignalN + forceNoiseN), FORCE_SENSOR_RESOLUTION_N);
        const measuredVelocityMps = quantize(Math.max(0, next.velocityFilteredMps + velocityNoiseMps), VELOCITY_RESOLUTION_MPS);
        // Range validity is deterministic for a physical/filtered signal.
        // A particular random draw must never be the sole reason a trial is
        // rejected, so reserve the full bounded-noise envelope here.
        if ((forceSignalN + FORCE_SENSOR_NOISE_MAX_ABS_N) * 100 > MAX_FORCE_CN || (velocitySignalMps + VELOCITY_NOISE_MAX_ABS_MPS) * 1000 > MAX_VELOCITY_MMPS) next.overrange = true;
        const sampleTimeS = index * GRAPH_SAMPLE_DT_S;
        sample = { timeS: Number(sampleTimeS.toFixed(3)), timeMs: index * GRAPH_SAMPLE_DT_MS, measuredPullN: Math.min(measuredPullN, MAX_FORCE_CN / 100), measuredVelocityMps: clamp(measuredVelocityMps, MIN_VELOCITY_MMPS / 1000, MAX_VELOCITY_MMPS / 1000), pullCN: clamp(Math.round(measuredPullN * 100), 0, MAX_FORCE_CN), velocityMMps: clamp(Math.round(measuredVelocityMps * 1000), MIN_VELOCITY_MMPS, MAX_VELOCITY_MMPS), kind: "grid", index };
        next.regularSamples.push({ ...sample });
        next.lastSampleTimeS = sampleTimeS;
      }
    }
    return { state: next, sample };
  }
  function enrichBreakaway(state, rawEvent, previousMeasurement = state, currentMeasurement = state, previousPhysical = null, currentPhysical = null) {
    if (!rawEvent || rawEvent.type !== "breakaway" || state.breakaway) return state;
    const pre = state.regularSamples.filter((sample) => sample.timeS <= rawEvent.timeS + 1e-9);
    const preBreakPeakGridIndex = pre.length ? pre.reduce((best, sample, index) => sample.pullCN > pre[best].pullCN ? index : best, 0) : 0;
    const t0 = finite(previousPhysical?.timeS, rawEvent.timeS);
    const t1 = finite(currentPhysical?.timeS, rawEvent.timeS);
    const u = t1 > t0 ? clamp((rawEvent.timeS - t0) / (t1 - t0), 0, 1) : 0;
    const interpolated = {
      ...currentMeasurement,
      forceFilteredN: finite(previousMeasurement?.forceFilteredN) + (finite(currentMeasurement?.forceFilteredN) - finite(previousMeasurement?.forceFilteredN)) * u,
      velocityFilteredMps: finite(previousMeasurement?.velocityFilteredMps) + (finite(currentMeasurement?.velocityFilteredMps) - finite(previousMeasurement?.velocityFilteredMps)) * u,
      forceNoise: finite(previousMeasurement?.forceNoise) + (finite(currentMeasurement?.forceNoise) - finite(previousMeasurement?.forceNoise)) * u,
      velocityNoise: finite(previousMeasurement?.velocityNoise) + (finite(currentMeasurement?.velocityNoise) - finite(previousMeasurement?.velocityNoise)) * u
    };
    const measured = liveReading(interpolated);
    // A spring scale can reach the static-friction peak at the transition and
    // then contract sharply during the same physics interval. Preserve that
    // physical peak in the breakaway sidecar instead of letting interpolation
    // between the pre- and post-drop filtered states erase it.
    const eventForceN = Number.isFinite(rawEvent.physicalTensionN)
      ? Math.max(0, rawEvent.physicalTensionN)
      : Number.isFinite(rawEvent.physicalForceN)
        ? Math.abs(rawEvent.physicalForceN)
        : measured.forceN;
    const breakawayForceN = Math.max(measured.forceN, eventForceN);
    const event = {
      timeMs: Math.round(rawEvent.timeS * 1000),
      measuredPullCN: clamp(Math.round(breakawayForceN * 100), 0, 65535),
      measuredVelocityMMps: clamp(Math.round(measured.velocityMps * 1000), -32768, 32767),
      preBreakPeakGridIndex
    };
    return { ...cloneMeasurementState(state), breakaway: event };
  }
  function createRecorder(scenario, options = {}) {
    const measurement = createMeasurementState(scenario, options);
    return { measurement, trace: null, running: true, startedAtS: 0, stalled: false };
  }
  function stopRecorder(recorder) {
    if (!recorder || recorder.stalled) return { accepted: false, reason: "timing-gap" };
    if (recorder.measurement?.overrange) return { accepted: false, reason: "sensor-overrange" };
    const trial = packTrace({ regularSamples: recorder.measurement.regularSamples, breakaway: recorder.measurement.breakaway });
    recorder.running = false;
    recorder.trace = trial;
    return { accepted: true, trial };
  }
  function trimmedMean(values, trimFraction = 0.10) {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const trim = Math.min(Math.floor(sorted.length * trimFraction), Math.floor((sorted.length - 1) / 2));
    const kept = sorted.slice(trim, sorted.length - trim);
    return kept.reduce((sum, value) => sum + value, 0) / kept.length;
  }
  function linearSlope(samples, field = "measuredVelocityMps") {
    const values = samples.filter((sample) => Number.isFinite(sample.timeS) && Number.isFinite(sample[field]));
    if (values.length < 2) return null;
    const meanX = values.reduce((s, p) => s + p.timeS, 0) / values.length;
    const meanY = values.reduce((s, p) => s + p[field], 0) / values.length;
    const denom = values.reduce((s, p) => s + (p.timeS - meanX) ** 2, 0);
    return denom > 0 ? values.reduce((s, p) => s + (p.timeS - meanX) * (p[field] - meanY), 0) / denom : 0;
  }
  function standardDeviation(values) {
    const xs = values.filter(Number.isFinite);
    if (xs.length < 2) return 0;
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
  }
  function unpackTrace(trace) {
    if (!trace || trace.sampleDtMs !== GRAPH_SAMPLE_DT_MS || !Number.isInteger(trace.regularSampleCount) || trace.regularSampleCount < 1 || trace.regularSampleCount > MAX_REGULAR_SAMPLE_COUNT) throw new Error("invalid trace metadata");
    const bytes = base64ToBytes(trace.forceVelocityBase64);
    if (bytes.length !== trace.regularSampleCount * 4) throw new Error("trace byte length mismatch");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const regularSamples = [];
    for (let i = 0; i < trace.regularSampleCount; i += 1) {
      const forceCN = view.getUint16(i * 4, true);
      const velocityMMps = view.getInt16(i * 4 + 2, true);
      if (forceCN > MAX_FORCE_CN || velocityMMps < MIN_VELOCITY_MMPS || velocityMMps > MAX_VELOCITY_MMPS) throw new Error("trace value out of range");
      regularSamples.push({ index: i, timeS: i * GRAPH_SAMPLE_DT_S, timeMs: i * GRAPH_SAMPLE_DT_MS, pullCN: forceCN, velocityMMps, measuredPullN: forceCN / 100, measuredVelocityMps: velocityMMps / 1000, kind: "grid" });
    }
    const breakaway = trace.breakaway == null ? null : { ...trace.breakaway };
    if (breakaway) {
      if (!Number.isInteger(breakaway.timeMs) || breakaway.timeMs < 0 || breakaway.timeMs > MAX_TRIAL_DURATION_S * 1000 || !Number.isInteger(breakaway.measuredPullCN) || !Number.isInteger(breakaway.measuredVelocityMMps) || !Number.isInteger(breakaway.preBreakPeakGridIndex) || breakaway.preBreakPeakGridIndex < 0 || breakaway.preBreakPeakGridIndex >= regularSamples.length) throw new Error("invalid breakaway sidecar");
      if (breakaway.measuredPullCN < 0 || breakaway.measuredPullCN > MAX_FORCE_CN || breakaway.measuredVelocityMMps < MIN_VELOCITY_MMPS || breakaway.measuredVelocityMMps > MAX_VELOCITY_MMPS) throw new Error("breakaway sidecar value out of range");
      const preTimeMs = regularSamples[breakaway.preBreakPeakGridIndex].timeMs;
      const eventGridIndex = Math.floor(breakaway.timeMs / GRAPH_SAMPLE_DT_MS);
      // preBreakPeakGridIndex records the local measured peak before the
      // event; it need not be the immediately preceding grid sample.
      if (preTimeMs > breakaway.timeMs || breakaway.preBreakPeakGridIndex > eventGridIndex) throw new Error("breakaway sidecar peak is after event");
    }
    const merged = mergeCanonicalSamples(regularSamples, breakaway);
    const decoded = { sampleDtMs: GRAPH_SAMPLE_DT_MS, regularSampleCount: regularSamples.length, regularSamples, breakaway, merged, visibleBreakawayPeakCN: breakaway ? Math.max(regularSamples[breakaway.preBreakPeakGridIndex]?.pullCN || 0, breakaway.measuredPullCN) : null };
    Object.defineProperty(decoded, "candidateCacheKey", { value: `${trace.forceVelocityBase64}|${breakaway ? `${breakaway.timeMs},${breakaway.measuredPullCN},${breakaway.measuredVelocityMMps},${breakaway.preBreakPeakGridIndex}` : "-"}`, enumerable: false });
    return decoded;
  }
  function packTrace(input) {
    const regularSamples = input?.regularSamples || input?.regular || [];
    if (!Array.isArray(regularSamples) || !regularSamples.length || regularSamples.length > MAX_REGULAR_SAMPLE_COUNT) throw new Error("invalid regular trace length");
    const bytes = new Uint8Array(regularSamples.length * 4);
    const view = new DataView(bytes.buffer);
    regularSamples.forEach((sample, index) => {
      if (!sample || (sample.timeS != null && (!Number.isFinite(sample.timeS) || Math.abs(sample.timeS - index * GRAPH_SAMPLE_DT_S) > 1e-9)) || (sample.index != null && sample.index !== index)) throw new Error("regular trace is not on canonical time grid");
      const forceValue = sample.pullCN ?? (Number.isFinite(sample.measuredPullN) ? sample.measuredPullN * 100 : NaN);
      const velocityValue = sample.velocityMMps ?? (Number.isFinite(sample.measuredVelocityMps) ? sample.measuredVelocityMps * 1000 : NaN);
      if (!Number.isFinite(forceValue) || !Number.isFinite(velocityValue)) throw new Error("non-finite trace value");
      const forceCN = Math.round(forceValue);
      const velocityMMps = Math.round(velocityValue);
      if (forceCN < 0 || forceCN > MAX_FORCE_CN || velocityMMps < MIN_VELOCITY_MMPS || velocityMMps > MAX_VELOCITY_MMPS) throw new Error("trace value out of range");
      view.setUint16(index * 4, forceCN, true);
      view.setInt16(index * 4 + 2, velocityMMps, true);
    });
    const breakaway = input?.breakaway ? { ...input.breakaway } : null;
    const packed = { sampleDtMs: GRAPH_SAMPLE_DT_MS, regularSampleCount: regularSamples.length, forceVelocityBase64: bytesToBase64(bytes), breakaway };
    // Validate the production representation before returning it.
    unpackTrace(packed);
    return packed;
  }
  function mergeCanonicalSamples(regularSamples, breakaway) {
    const merged = regularSamples.map((sample) => ({ ...sample, canonicalIndex: null }));
    if (breakaway) {
      const event = { index: breakaway.preBreakPeakGridIndex, timeS: breakaway.timeMs / 1000, timeMs: breakaway.timeMs, pullCN: breakaway.measuredPullCN, velocityMMps: breakaway.measuredVelocityMMps, measuredPullN: breakaway.measuredPullCN / 100, measuredVelocityMps: breakaway.measuredVelocityMMps / 1000, kind: "breakaway", canonicalIndex: null };
      const replace = merged.findIndex((sample) => sample.timeMs === event.timeMs);
      if (replace >= 0) merged[replace] = event;
      else {
        merged.push(event);
        merged.sort((a, b) => a.timeMs - b.timeMs || (a.kind === "breakaway" ? 1 : -1));
      }
    }
    merged.forEach((sample, index) => { sample.canonicalIndex = index; });
    return merged;
  }
  function intervalSamples(trace, startIndex, endIndex) {
    const canonical = trace?.merged || unpackTrace(trace).merged;
    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex >= canonical.length || endIndex < startIndex) return [];
    return canonical.slice(startIndex, endIndex + 1);
  }
  function intervalStats(trace, startIndex, endIndex) {
    const samples = intervalSamples(trace, startIndex, endIndex);
    if (samples.length < 2) return null;
    const meanPullN = trimmedMean(samples.map((s) => s.measuredPullN));
    const trim = Math.min(Math.floor(samples.length * 0.10), Math.floor((samples.length - 1) / 2));
    const trimmed = samples.slice(trim, samples.length - trim);
    const velocityChangeMps = samples[samples.length - 1].measuredVelocityMps - samples[0].measuredVelocityMps;
    return {
      startIndex, endIndex, startTimeS: samples[0].timeS, endTimeS: samples[samples.length - 1].timeS,
      durationS: samples[samples.length - 1].timeS - samples[0].timeS,
      meanPullN,
      meanVelocityMps: trimmedMean(samples.map((s) => s.measuredVelocityMps), 0),
      maxVelocityMps: Math.max(...samples.map((s) => s.measuredVelocityMps)),
      maxAbsVelocityMps: Math.max(...samples.map((s) => Math.abs(s.measuredVelocityMps))),
      velocityChangeMps,
      velocitySlopeMps2: linearSlope(samples, "measuredVelocityMps"),
      forceSlopeNPerS: linearSlope(trimmed, "measuredPullN"),
      forceStdN: standardDeviation(samples.map((s) => s.measuredPullN)),
      forceRangeN: Math.max(...samples.map((s) => s.measuredPullN)) - Math.min(...samples.map((s) => s.measuredPullN)),
      forceCv: meanPullN > 0 ? standardDeviation(samples.map((s) => s.measuredPullN)) / meanPullN : Infinity
    };
  }
  function pairDuration(samples, index) { return Math.max(0, samples[index + 1].timeS - samples[index].timeS); }
  function pairMidpoint(samples, index) { return (samples[index].timeS + samples[index + 1].timeS) / 2; }
  function intervalContainsTime(interval, timeS, samples) {
    if (!interval || !samples?.[interval.startIndex] || !samples?.[interval.endIndex]) return false;
    return timeS >= samples[interval.startIndex].timeS - 1e-9 && timeS <= samples[interval.endIndex].timeS + 1e-9;
  }
  function otherPhaseFraction(selection, phaseIntervals, trace, targetType = null) {
    if (!selection || !Array.isArray(phaseIntervals) || (!phaseIntervals.length && !targetType)) return 0;
    const samples = trace ? (trace.merged ? trace.merged : unpackTrace(trace).merged) : null;
    if (!samples) {
      const selected = Math.max(1, selection.endIndex - selection.startIndex);
      const covered = phaseIntervals.reduce((sum, interval) => sum + Math.max(0, Math.min(selection.endIndex, interval.endIndex) - Math.max(selection.startIndex, interval.startIndex)), 0);
      return clamp((selected - Math.min(selected, covered)) / selected, 0, 1);
    }
    let selectedDuration = 0;
    let otherDuration = 0;
    for (let i = selection.startIndex; i < selection.endIndex && i + 1 < samples.length; i += 1) {
      const duration = pairDuration(samples, i);
      selectedDuration += duration;
      const pair = { start: samples[i], end: samples[i + 1] };
      const belongsToTarget = targetType ? classifyPairForTarget(pair, targetType) : phaseIntervals.some((interval) => intervalContainsTime(interval, pairMidpoint(samples, i), samples));
      if (!belongsToTarget) otherDuration += duration;
    }
    return selectedDuration > 0 ? clamp(otherDuration / selectedDuration, 0, 1) : 0;
  }
  function classifyPairForTarget(pair, targetType, constants = {}) {
    const v0 = finite(pair?.start?.measuredVelocityMps), v1 = finite(pair?.end?.measuredVelocityMps);
    const f0 = finite(pair?.start?.measuredPullN), f1 = finite(pair?.end?.measuredPullN);
    const dt = Math.max(1e-9, finite(pair?.end?.timeS) - finite(pair?.start?.timeS));
    const vm = (v0 + v1) / 2;
    const fm = (f0 + f1) / 2;
    const slope = (v1 - v0) / dt;
    if (targetType === "static") {
      const minForceSlope = constants.minForceSlopeNPerS ?? MIN_STATIC_RISE_FORCE_SLOPE_N_PER_S;
      return vm <= (constants.maxVelocityMps ?? MAX_STATIC_ABS_VELOCITY_MPS) && (f1 - f0) / dt >= minForceSlope;
    }
    if (targetType === "slow") return vm >= (constants.minSpeedMps ?? MIN_MOVING_SPEED_MPS) && vm >= SLOW_SPEED_MIN_MPS && vm <= SLOW_SPEED_MAX_MPS && Math.abs(slope) <= (constants.maxSlopeMps2 ?? MAX_PLATEAU_ABS_SLOPE_MPS2) && fm <= (constants.maxForceN ?? MAX_FORCE_CN / 100);
    if (targetType === "fast") return vm >= (constants.minSpeedMps ?? MIN_MOVING_SPEED_MPS) && vm >= FAST_SPEED_MIN_MPS && vm <= FAST_SPEED_MAX_MPS && Math.abs(slope) <= (constants.maxSlopeMps2 ?? MAX_PLATEAU_ABS_SLOPE_MPS2) && fm <= (constants.maxForceN ?? MAX_FORCE_CN / 100);
    if (targetType === "acceleration") return slope >= (constants.minSlopeMps2 ?? MIN_ACCELERATION_SLOPE_MPS2);
    return false;
  }
  function isStaticRise(stats) { return Boolean(stats && stats.durationS >= MIN_STATIC_RISE_DURATION_S && stats.forceRangeN >= MIN_STATIC_RISE_FORCE_DELTA_N && stats.forceSlopeNPerS >= MIN_STATIC_RISE_FORCE_SLOPE_N_PER_S && stats.maxAbsVelocityMps <= MAX_STATIC_ABS_VELOCITY_MPS); }
  function isVelocityPlateau(stats) { return Boolean(stats && stats.durationS >= MIN_PLATEAU_DURATION_S && Math.abs(stats.velocitySlopeMps2) <= MAX_PLATEAU_ABS_SLOPE_MPS2 && stats.meanVelocityMps >= MIN_MOVING_SPEED_MPS && stats.forceRangeN <= MAX_FORCE_CN / 100 && stats.forceCv <= MAX_PLATEAU_FORCE_CV); }
  function isAccelerationWindow(stats) { return Boolean(stats && stats.durationS >= MIN_ACCELERATION_DURATION_S && stats.velocityChangeMps >= MIN_ACCELERATION_DELTA_V_MPS && stats.velocitySlopeMps2 >= MIN_ACCELERATION_SLOPE_MPS2); }
  function findCandidateWindows(trace) {
    const decoded = trace?.merged ? trace : unpackTrace(trace);
    const cacheKey = decoded.candidateCacheKey;
    if (cacheKey && candidateCache.has(cacheKey)) return candidateCache.get(cacheKey);
    const samples = decoded.merged;
    const candidates = { static: [], slow: [], acceleration: [], fast: [] };
    const breakIndex = decoded.breakaway ? samples.findIndex((s) => Math.abs(s.timeMs - decoded.breakaway.timeMs) < 1e-9) : Math.floor(samples.length * 0.2);
    const addAllWindows = (kind, predicate, minDurationS, qualifier = () => true) => {
      for (let start = 0; start <= breakIndex; start += 1) {
        if (!predicate(samples[start], start)) continue;
        for (let end = start + 1; end <= breakIndex; end += 1) {
          if (!predicate(samples[end], end)) break;
          if (samples[end].timeS - samples[start].timeS < minDurationS) continue;
          const stats = intervalStats(decoded, start, end);
          if (qualifier(stats, start, end)) candidates[kind].push({ startIndex: start, endIndex: end, stats });
        }
      }
    };
    addAllWindows("static", (s) => s.measuredVelocityMps <= MAX_STATIC_ABS_VELOCITY_MPS, MIN_STATIC_RISE_DURATION_S, (stats) => isStaticRise(stats));
    const addPlateauWindows = (kind) => {
      for (let start = Math.max(0, breakIndex + 1); start < samples.length - 1; start += 1) {
        for (let end = start + 1; end < samples.length; end += 1) {
          if (!classifyPairForTarget({ start: samples[end - 1], end: samples[end] }, kind)) break;
          if (samples[end].timeS - samples[start].timeS < MIN_PLATEAU_DURATION_S) continue;
          const stats = intervalStats(decoded, start, end);
          if (isVelocityPlateau(stats)) candidates[kind].push({ startIndex: start, endIndex: end, stats });
        }
      }
    };
    addPlateauWindows("slow");
    addPlateauWindows("fast");
    const velocity = samples.map((s) => s.measuredVelocityMps);
    for (let i = Math.max(0, breakIndex + 1); i < samples.length - 1; i += 1) {
      for (let j = i + Math.ceil(MIN_ACCELERATION_DURATION_S / GRAPH_SAMPLE_DT_S); j < samples.length; j += 1) {
        const stats = intervalStats(decoded, i, j);
        if (isAccelerationWindow(stats)) candidates.acceleration.push({ startIndex: i, endIndex: j, stats });
      }
    }
    if (cacheKey) {
      candidateCache.set(cacheKey, candidates);
      while (candidateCache.size > 8) candidateCache.delete(candidateCache.keys().next().value);
    }
    return candidates;
  }
  function continuousMovingDuration(samples, startTimeS, minVelocityMps = MIN_MOVING_SPEED_MPS) {
    let longest = 0;
    let runStart = null;
    let previous = null;
    for (const sample of samples || []) {
      if (sample.timeS < startTimeS - 1e-9 || sample.measuredVelocityMps < minVelocityMps) {
        if (runStart != null && previous) longest = Math.max(longest, previous.timeS - runStart);
        runStart = null;
        previous = null;
        continue;
      }
      if (runStart == null || (previous && sample.timeS - previous.timeS > GRAPH_SAMPLE_DT_S * 1.5)) {
        if (runStart != null && previous) longest = Math.max(longest, previous.timeS - runStart);
        runStart = sample.timeS;
      }
      previous = sample;
    }
    if (runStart != null && previous) longest = Math.max(longest, previous.timeS - runStart);
    return longest;
  }
  function assessTrial(trace) {
    const decoded = trace?.merged ? trace : unpackTrace(trace);
    const candidates = findCandidateWindows(decoded);
    const breakaway = decoded.breakaway;
    const pre = breakaway ? decoded.merged.filter((s) => s.timeS <= breakaway.timeMs / 1000) : [];
    const forceRise = pre.length ? Math.max(...pre.map((s) => s.measuredPullN)) - Math.min(...pre.map((s) => s.measuredPullN)) : 0;
    const preDuration = pre.length ? pre[pre.length - 1].timeS - pre[0].timeS : 0;
    const trim = Math.min(Math.floor(pre.length * 0.10), Math.floor((pre.length - 1) / 2));
    const loadingSlopeNPerS = pre.length > 1 ? linearSlope(pre.slice(trim, pre.length - trim), "measuredPullN") : Infinity;
    const postBreakMoveDurationS = breakaway ? continuousMovingDuration(decoded.merged, breakaway.timeMs / 1000, MIN_MOVING_SPEED_MPS) : 0;
    const maxForceN = decoded.merged.length ? Math.max(...decoded.merged.map((s) => s.measuredPullN)) : Infinity;
    const valid = Boolean(breakaway && preDuration >= MIN_PREBREAK_DURATION_S && forceRise >= MIN_FORCE_RISE_N && maxForceN <= MAX_FORCE_CN / 100 && postBreakMoveDurationS >= MIN_POSTBREAK_MOVE_S);
    const neutralMessage = !breakaway
      ? "物體尚未開始移動；請慢慢增加拉力後再繼續。"
      : postBreakMoveDurationS < MIN_POSTBREAK_MOVE_S
        ? "物體開始移動後的記錄太短；請繼續拉一段時間再停止。"
        : maxForceN > MAX_FORCE_CN / 100
          ? "拉力超出可記錄範圍；請重新開始並減少拉力。"
          : valid ? "記錄已完成，可以保存並進入 Part C。" : "記錄未能形成可分析資料，請重新開始。";
    return { valid, breakaway: Boolean(breakaway), preDuration, forceRise, loadingSlopeNPerS, maxForceN, postBreakMoveDurationS, candidates, evidence: { breakaway: Boolean(breakaway), slow: postBreakMoveDurationS >= MIN_POSTBREAK_MOVE_S, acceleration: candidates.acceleration.length > 0, fast: candidates.fast.length > 0 }, neutralMessage };
  }
  return Object.freeze({
    GRAPH_SAMPLE_DT_S, GRAPH_SAMPLE_DT_MS, MAX_TRIAL_DURATION_S, MAX_REGULAR_SAMPLE_COUNT,
    FORCE_SENSOR_TAU_S, VELOCITY_SENSOR_TAU_S,
    FORCE_SENSOR_NOISE_SIGMA_N, FORCE_SENSOR_RESOLUTION_N, FORCE_SENSOR_NOISE_RHO, FORCE_SENSOR_NOISE_MAX_ABS_N,
    VELOCITY_NOISE_SIGMA_MPS, VELOCITY_RESOLUTION_MPS, VELOCITY_NOISE_MAX_ABS_MPS, VELOCITY_NOISE_RHO,
    MAX_FORCE_CN, MIN_VELOCITY_MMPS, MAX_VELOCITY_MMPS, MIN_STATIC_OBSERVATION_SEPARATION_N, MIN_PREBREAK_DURATION_S, MIN_FORCE_RISE_N, MAX_LOADING_SLOPE_N_PER_S,
    MIN_POSTBREAK_MOVE_S, MIN_PLATEAU_DURATION_S, MAX_PLATEAU_ABS_SLOPE_MPS2, MIN_MOVING_SPEED_MPS, MIN_ACCELERATION_DURATION_S, MIN_ACCELERATION_DELTA_V_MPS, MIN_ACCELERATION_SLOPE_MPS2, MAX_PLATEAU_FORCE_CV, MAX_OTHER_PHASE_FRACTION, MIN_STATIC_RISE_DURATION_S, MIN_STATIC_RISE_FORCE_DELTA_N, MIN_STATIC_RISE_FORCE_SLOPE_N_PER_S, MAX_STATIC_ABS_VELOCITY_MPS,
    SLOW_SPEED_MIN_MPS, SLOW_SPEED_MAX_MPS, FAST_SPEED_MIN_MPS, FAST_SPEED_MAX_MPS, MIN_SPEED_DIFFERENCE_MPS,
    lowPass, stepCorrelatedNoise, gaussian, createMeasurementState, cloneMeasurementState, step, liveReading, captureSample, enrichBreakaway, continuousMovingDuration,
    createRecorder, stopRecorder, trimmedMean, linearSlope, standardDeviation, otherPhaseFraction, classifyPairForTarget, isStaticRise, isVelocityPlateau, isAccelerationWindow, packTrace, unpackTrace, mergeCanonicalSamples, intervalSamples, intervalStats, findCandidateWindows, assessTrial
  });
});
