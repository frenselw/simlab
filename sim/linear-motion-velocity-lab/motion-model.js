(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LinearMotionModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const SIGNIFICANT_FIGURES = 3;
  const WINDOWS = [2, 1, 0.5, 0.25];
  const TARGET_BOUNDARY_MARGIN_S = 0.1;
  const NUMERIC_EPSILON_FACTOR = 8;
  const MAX_GENERATION_ATTEMPTS = 80;
  const MAX_MODEL_TIME = 1e9;
  const MAX_FRAME_DELTA = 0.05;
  const MODEL_TIME_TOLERANCE = MAX_MODEL_TIME * Number.EPSILON * 128;
  const MODEL_TIME_CONTINUATION_RESERVE = MAX_FRAME_DELTA + MODEL_TIME_TOLERANCE;
  const MAX_RENDER_POSITION = 1e11;
  const MIN_NORMAL = 2.2250738585072014e-308;
  const MAX_INPUT_LENGTH = 32;
  const MAX_LEARNER_INPUT_VALUE = MAX_RENDER_POSITION;
  const READING_SPAN = 50;
  const READING_BASE = 20;
  const STREAM_VERSION = 1;
  const CHUNK_DURATION = 48;
  const CHUNK_DISTANCE = 240;
  const SEGMENT_COUNT = 22;
  const TARGET_SEGMENT_INDEX = 7;

  function finite(value) { return Number.isFinite(value); }
  function roundStep(value, step) { return Math.round(value / step) * step; }
  function canonicalNumber(value) {
    if (!finite(value)) throw new TypeError("Value must be finite");
    return value === 0 ? 0 : Number(value.toPrecision(SIGNIFICANT_FIGURES));
  }
  function roundedExponential(value) {
    const rounded = canonicalNumber(value);
    return finite(rounded) ? rounded.toExponential(SIGNIFICANT_FIGURES - 1) : null;
  }
  function fixedNotation(exponential) {
    const [coefficient, rawExponent] = exponential.split("e");
    const negative = coefficient.startsWith("-");
    const digits = coefficient.replace("-", "").replace(".", "");
    const point = 1 + Number(rawExponent);
    const unsigned = point <= 0 ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length ? `${digits}${"0".repeat(point - digits.length)}`
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
    return negative ? `-${unsigned}` : unsigned;
  }
  function format3(value) {
    if (!finite(value)) return "--";
    if (value === 0) return "0.00";
    if (Math.abs(value) < MIN_NORMAL) return "--";
    const exponential = roundedExponential(value);
    return exponential ? fixedNotation(exponential) : "--";
  }
  function formatInput3(value) {
    return finite(value) && value >= 0 ? format3(value) : "--";
  }
  function normalizeInput(raw) {
    const text = String(raw ?? "").trim();
    const match = text.match(/^(\d+(?:\.\d+)?)(?:[eE][+-]?\d+)?$/);
    if (!text || text.length > MAX_INPUT_LENGTH || !match) return null;
    const value = Number(text);
    const nonZeroMantissa = /[1-9]/.test(match[1]);
    if (!finite(value) || value < 0 || value > MAX_LEARNER_INPUT_VALUE || nonZeroMantissa && (value === 0 || value < MIN_NORMAL)) return null;
    return { value, text };
  }
  function safeModelTime(value) { return finite(value) && value >= 0 && value <= MAX_MODEL_TIME; }
  function hasModelTimeHeadroom(value, duration) {
    const required = duration + MODEL_TIME_CONTINUATION_RESERVE;
    return safeModelTime(value) && finite(duration) && duration >= 0 && finite(required) && value <= MAX_MODEL_TIME - required;
  }
  function minimumDurationReached(duration, minimum) {
    return finite(duration) && finite(minimum) && duration >= 0 && minimum >= 0 && duration + MODEL_TIME_TOLERANCE >= minimum;
  }
  function safeWorldPosition(value) { return finite(value) && Math.abs(value) <= MAX_RENDER_POSITION; }
  function rollingReadingOrigin(worldPosition) {
    if (!safeWorldPosition(worldPosition)) throw new RangeError("World position cannot be rendered safely");
    return Math.floor(worldPosition / READING_SPAN) * READING_SPAN - READING_BASE;
  }
  function readingPosition(worldPosition, readingOrigin) {
    const value = worldPosition - readingOrigin;
    if (!safeWorldPosition(worldPosition) || !finite(readingOrigin) || !safeWorldPosition(value)) throw new RangeError("Reading position is invalid");
    return value;
  }
  function halfThirdPlace(expected) {
    if (!expected) return 0;
    return 0.5 * (10 ** (Math.floor(Math.log10(Math.abs(expected))) - SIGNIFICANT_FIGURES + 1));
  }
  function numericMatch(answer, expected) {
    if (!finite(answer) || !finite(expected)) return false;
    if (expected === 0) return answer === 0;
    const guard = NUMERIC_EPSILON_FACTOR * Number.EPSILON * Math.max(1, Math.abs(expected));
    return Math.abs(answer - expected) <= halfThirdPlace(expected) + guard;
  }
  function mulberry32(seed) {
    let value = seed >>> 0;
    return function random() {
      value += 0x6d2b79f5;
      let item = value;
      item = Math.imul(item ^ item >>> 15, item | 1);
      item ^= item + Math.imul(item ^ item >>> 7, item | 61);
      return ((item ^ item >>> 14) >>> 0) / 4294967296;
    };
  }
  function randomSeed() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0];
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }
  function mixSeed(seed, chunkIndex) {
    let value = (seed ^ Math.imul((chunkIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
    value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
    return Math.imul(value, 0x846ca68b) ^ value >>> 16;
  }
  function sampleStep(random, min, max, step) {
    return roundStep(min + Math.floor(random() * (Math.floor((max - min) / step) + 1)) * step, step);
  }
  function shuffle(items, random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function streamChunk(definition, chunkIndex) {
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) throw new RangeError("Invalid stream chunk");
    const random = mulberry32(mixSeed(definition.seed, chunkIndex));
    const stopCandidates = Array.from({ length: SEGMENT_COUNT - 4 }, (_, index) => index + 2).filter((index) => Math.abs(index - TARGET_SEGMENT_INDEX) > 1);
    const stopIndex = stopCandidates[Math.floor(random() * stopCandidates.length)];
    const cruiseCandidates = stopCandidates.filter((index) => Math.abs(index - stopIndex) > 1 && index !== SEGMENT_COUNT - 1);
    const cruiseIndex = cruiseCandidates[Math.floor(random() * cruiseCandidates.length)];
    const rawDurations = Array.from({ length: SEGMENT_COUNT }, (_, index) => index === TARGET_SEGMENT_INDEX && chunkIndex === 0 ? 2.6 : index === stopIndex ? 0.7 : 1.7 + random() * 0.75);
    const flexible = rawDurations.reduce((sum, value, index) => sum + (index === TARGET_SEGMENT_INDEX && chunkIndex === 0 || index === stopIndex ? 0 : value), 0);
    const fixed = rawDurations[TARGET_SEGMENT_INDEX] * (chunkIndex === 0 && TARGET_SEGMENT_INDEX !== stopIndex ? 1 : 0) + 0.7;
    const durations = rawDurations.map((value, index) => index === stopIndex ? 0.7 : index === TARGET_SEGMENT_INDEX && chunkIndex === 0 ? 2.6 : value * (CHUNK_DURATION - fixed) / flexible);
    const velocities = Array.from({ length: SEGMENT_COUNT + 1 }, (_, index) => index === 0 || index === SEGMENT_COUNT ? 0 : 3 + random() * 5);
    velocities[stopIndex] = 0; velocities[stopIndex + 1] = 0;
    for (let index = 1; index < velocities.length - 1; index += 1) {
      if (index !== stopIndex && index !== stopIndex + 1 && Math.abs(velocities[index] - velocities[index - 1]) < 0.35) velocities[index] += velocities[index] < 7 ? 0.55 : -0.55;
    }
    velocities[cruiseIndex + 1] = velocities[cruiseIndex];
    let rawDistance = 0;
    durations.forEach((duration, index) => { rawDistance += (velocities[index] + velocities[index + 1]) * duration / 2; });
    const speedScale = CHUNK_DISTANCE / rawDistance;
    let start = 0, distance = 0;
    return durations.map((duration, index) => {
      const v0 = velocities[index] * speedScale, v1 = velocities[index + 1] * speedScale;
      const segment = { index: chunkIndex * SEGMENT_COUNT + index, localIndex: index, start, duration, v0, v1, startDistance: distance };
      distance += (v0 + v1) * duration / 2; start += duration;
      return segment;
    });
  }
  function segmentAt(definition, time) {
    const safeTime = Math.max(0, time);
    const chunkIndex = Math.min(Math.floor(safeTime / CHUNK_DURATION), Math.floor(MAX_MODEL_TIME / CHUNK_DURATION));
    const localTime = safeTime - chunkIndex * CHUNK_DURATION;
    const table = streamChunk(definition, chunkIndex);
    const segment = table.find((item) => localTime < item.start + item.duration - 1e-10) || table[table.length - 1];
    return { chunkIndex, localTime, segment, elapsed: Math.max(0, Math.min(segment.duration, localTime - segment.start)) };
  }
  function profileState(definition, time) {
    const found = segmentAt(definition, time);
    const acceleration = (found.segment.v1 - found.segment.v0) / found.segment.duration;
    const velocity = found.segment.v0 + acceleration * found.elapsed;
    return { segmentIndex: found.segment.index, elapsed: found.elapsed, velocity: Math.max(0, velocity), acceleration };
  }
  function profileDistance(definition, time) {
    const found = segmentAt(definition, time);
    const acceleration = (found.segment.v1 - found.segment.v0) / found.segment.duration;
    return found.chunkIndex * CHUNK_DISTANCE + found.segment.startDistance + found.segment.v0 * found.elapsed + 0.5 * acceleration * found.elapsed * found.elapsed;
  }
  function variablePosition(definition, time) { return definition.x0 + profileDistance(definition, Math.max(0, time)); }
  function variableVelocity(definition, time) { return profileState(definition, Math.max(0, time)).velocity; }
  function qualitativeState(definition, time) {
    const value = profileState(definition, time);
    if (value.velocity < 1e-8 && Math.abs(value.acceleration) < 1e-8) return "stopped";
    if (value.acceleration > 0.05) return "accelerate";
    if (value.acceleration < -0.05) return "decelerate";
    return value.velocity < 4 ? "slow" : "fast";
  }
  function targetSceneTime(definition) {
    const target = definition.instantTarget;
    const chunkIndex = Math.floor(target.segmentIndex / SEGMENT_COUNT);
    const localIndex = target.segmentIndex % SEGMENT_COUNT;
    const segment = streamChunk(definition.variable, chunkIndex)[localIndex];
    return chunkIndex * CHUNK_DURATION + segment.start + target.timeWithinSegment;
  }
  function stoppedSceneTime(definition) {
    const target = definition.stoppedCheckpoint;
    const chunkIndex = Math.floor(target.segmentIndex / SEGMENT_COUNT);
    const localIndex = target.segmentIndex % SEGMENT_COUNT;
    const segment = streamChunk(definition.variable, chunkIndex)[localIndex];
    return chunkIndex * CHUNK_DURATION + segment.start + segment.duration / 2;
  }
  function analysisWindowGeometry(definition) {
    const targetTime = targetSceneTime(definition);
    return definition.windows.map((window) => {
      const startTime = targetTime - window;
      const startPosition = variablePosition(definition.variable, startTime);
      const endPosition = variablePosition(definition.variable, targetTime);
      return {
        window, startTime, endTime: targetTime, startPosition, endPosition,
        duration: window, averageVelocity: (endPosition - startPosition) / window
      };
    });
  }
  function analysisWindows(definition) {
    return analysisWindowGeometry(definition).map((row) => ({
      window: row.window,
      startTime: canonicalNumber(row.startTime), endTime: canonicalNumber(row.endTime),
      startPosition: canonicalNumber(row.startPosition), endPosition: canonicalNumber(row.endPosition),
      duration: row.duration, averageVelocity: canonicalNumber(row.averageVelocity)
    }));
  }
  function buildOptions(definition, random) {
    const rows = analysisWindows(definition);
    const target = canonicalNumber(variableVelocity(definition.variable, targetSceneTime(definition)));
    const acceleration = profileState(definition.variable, targetSceneTime(definition)).acceleration;
    const direction = acceleration > 0 ? -1 : 1;
    const raw = [target, rows[0].averageVelocity, rows[3].averageVelocity, canonicalNumber(Math.max(0.1, target + direction * Math.max(0.5, Math.abs(target - rows[0].averageVelocity) * 1.8)))];
    const unique = [];
    raw.forEach((value) => {
      let candidate = canonicalNumber(value);
      while (unique.some((item) => item.value === candidate)) candidate = canonicalNumber(Math.max(0.1, candidate + direction * 0.2));
      unique.push({ id: `o${unique.length + 1}`, value: candidate, correct: unique.length === 0 ? 1 : 0 });
    });
    return shuffle(unique, random);
  }
  function createAttempt(seed = randomSeed(), maxAttempts = MAX_GENERATION_ATTEMPTS) {
    if (!Number.isInteger(seed) || seed < 0 || !Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("Invalid generation request");
    const random = mulberry32(seed);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const x0 = sampleStep(random, 12, 38, 0.1), variableX0 = x0 + sampleStep(random, 1, 8, 0.1);
      const variable = { seed: (seed + attempt * 0x9e3779b9) >>> 0, streamVersion: STREAM_VERSION, x0: variableX0, coordinateOrigin: Math.floor(variableX0 / 10) * 10, layout: Math.floor(random() * 3) };
      const firstChunk = streamChunk(variable, 0);
      const targetSegment = firstChunk[TARGET_SEGMENT_INDEX];
      const stopSegment = firstChunk.find((item) => item.v0 === 0 && item.v1 === 0);
      const definition = {
        seed, uniform: { x0, speed: sampleStep(random, 3.2, 8.8, 0.01), coordinateOrigin: Math.floor(x0 / 10) * 10, layout: Math.floor(random() * 3) },
        variable, variableMinimumDuration: sampleStep(random, 3, 5, 0.25),
        instantTarget: { segmentIndex: targetSegment.index, timeWithinSegment: 2.35 },
        stoppedCheckpoint: { segmentIndex: stopSegment.index }, windows: WINDOWS.slice(), instantOptions: []
      };
      definition.instantOptions = buildOptions(definition, random);
      if (validateDefinition(definition)) return definition;
    }
    throw new Error("未能產生有效的運動題目");
  }
  function validateDefinition(definition) {
    if (!definition || !Number.isInteger(definition.seed) || definition.seed < 0 || !definition.uniform || !definition.variable) return false;
    const u = definition.uniform, v = definition.variable;
    if (![u.x0, u.speed, u.coordinateOrigin, v.x0, v.coordinateOrigin, definition.variableMinimumDuration].every(finite)) return false;
    if (v.streamVersion !== STREAM_VERSION || !Number.isInteger(v.seed) || v.seed < 0) return false;
    if (![u.layout, v.layout].every((value) => Number.isInteger(value) && value >= 0 && value <= 2)) return false;
    if (u.speed < 3.2 || u.speed > 8.8 || definition.variableMinimumDuration < 3 || definition.variableMinimumDuration > 5 || Math.abs(definition.variableMinimumDuration * 4 - Math.round(definition.variableMinimumDuration * 4)) > 1e-9) return false;
    if (!safeWorldPosition(uniformPosition(u, MAX_MODEL_TIME)) || !safeWorldPosition(v.x0 + Math.ceil(MAX_MODEL_TIME / CHUNK_DURATION) * CHUNK_DISTANCE)) return false;
    if (!Array.isArray(definition.windows) || definition.windows.some((value, index) => value !== WINDOWS[index])) return false;
    const target = definition.instantTarget, stopped = definition.stoppedCheckpoint;
    if (!target || !Number.isInteger(target.segmentIndex) || target.segmentIndex < 0 || !finite(target.timeWithinSegment) || !stopped || !Number.isInteger(stopped.segmentIndex) || stopped.segmentIndex < 0) return false;
    const targetSegment = streamChunk(v, Math.floor(target.segmentIndex / SEGMENT_COUNT))[target.segmentIndex % SEGMENT_COUNT];
    const stoppedSegment = streamChunk(v, Math.floor(stopped.segmentIndex / SEGMENT_COUNT))[stopped.segmentIndex % SEGMENT_COUNT];
    if (!targetSegment || target.timeWithinSegment < WINDOWS[0] + TARGET_BOUNDARY_MARGIN_S || target.timeWithinSegment > targetSegment.duration - TARGET_BOUNDARY_MARGIN_S || targetSegment.v0 === targetSegment.v1) return false;
    if (!stoppedSegment || stoppedSegment.v0 !== 0 || stoppedSegment.v1 !== 0 || variableVelocity(v, stoppedSceneTime(definition)) !== 0) return false;
    const rows = analysisWindows(definition), exact = canonicalNumber(variableVelocity(v, targetSceneTime(definition)));
    if (new Set(rows.map((row) => row.averageVelocity)).size < 3) return false;
    const differences = rows.map((row) => Math.abs(row.averageVelocity - exact));
    const acceleration = profileState(v, targetSceneTime(definition)).acceleration;
    for (let index = 1; index < rows.length; index += 1) {
      const directed = acceleration > 0 ? rows[index].averageVelocity > rows[index - 1].averageVelocity : rows[index].averageVelocity < rows[index - 1].averageVelocity;
      if (!directed || !(differences[index] < differences[index - 1])) return false;
    }
    const options = definition.instantOptions;
    return Array.isArray(options) && options.length === 4 && options.every((item) => item && typeof item.id === "string" && finite(item.value) && item.value >= 0 && item.value <= MAX_LEARNER_INPUT_VALUE && [0, 1].includes(item.correct)) && new Set(options.map((item) => item.id)).size === 4 && new Set(options.map((item) => item.value)).size === 4 && options.filter((item) => item.correct === 1).length === 1 && options.find((item) => item.correct === 1).value === exact;
  }
  function uniformPosition(definition, time) { return definition.x0 + definition.speed * Math.max(0, time); }
  function uniformVelocity(definition) { return definition.speed; }
  function captureMeasurement(positionAt, startModelTime, endModelTime, readingOrigin) {
    if (!safeModelTime(startModelTime) || !safeModelTime(endModelTime) || endModelTime <= startModelTime) return null;
    const origin = readingOrigin ?? rollingReadingOrigin(positionAt(startModelTime));
    return { startModelTime, endModelTime, readingOrigin: origin, x1: canonicalNumber(readingPosition(positionAt(startModelTime), origin)), x2: canonicalNumber(readingPosition(positionAt(endModelTime), origin)), dt: canonicalNumber(endModelTime - startModelTime) };
  }
  function measurementWorldPosition(measurement, endpoint) {
    if (!measurement || !["x1", "x2"].includes(endpoint) || !finite(measurement[endpoint])) return null;
    return measurement.readingOrigin + measurement[endpoint];
  }
  function expectedFromMeasurement(measurement) {
    if (!measurement) return null;
    const displacement = canonicalNumber(measurement.x2 - measurement.x1);
    return { displacement, time: measurement.dt, averageVelocity: canonicalNumber(displacement / measurement.dt) };
  }
  function advanceSimulationTime(initial, frames) {
    if (!safeModelTime(initial) || !Array.isArray(frames)) throw new TypeError("Invalid frame schedule");
    return frames.reduce((time, frame) => {
      if (!frame || !finite(frame.dt) || frame.dt < 0) throw new TypeError("Invalid frame");
      const next = frame.running ? time + Math.min(MAX_FRAME_DELTA, frame.dt) : time;
      if (!safeModelTime(next) || frame.running && frame.dt > 0 && next <= time) throw new RangeError("Simulation time cannot advance safely");
      return next;
    }, initial);
  }

  return {
    SIGNIFICANT_FIGURES, WINDOWS, TARGET_BOUNDARY_MARGIN_S, NUMERIC_EPSILON_FACTOR, MAX_MODEL_TIME, MAX_FRAME_DELTA, MODEL_TIME_TOLERANCE, MODEL_TIME_CONTINUATION_RESERVE, MAX_RENDER_POSITION, MIN_NORMAL, MAX_INPUT_LENGTH, MAX_LEARNER_INPUT_VALUE, STREAM_VERSION, CHUNK_DURATION, CHUNK_DISTANCE, SEGMENT_COUNT,
    canonicalNumber, format3, formatInput3, normalizeInput, halfThirdPlace, numericMatch, mulberry32, randomSeed,
    safeModelTime, hasModelTimeHeadroom, minimumDurationReached, safeWorldPosition, rollingReadingOrigin, readingPosition,
    createAttempt, validateDefinition, uniformPosition, uniformVelocity, streamChunk, segmentAt, profileState, variablePosition, variableVelocity, qualitativeState, targetSceneTime, stoppedSceneTime, analysisWindowGeometry, analysisWindows,
    captureMeasurement, measurementWorldPosition, expectedFromMeasurement, advanceSimulationTime
  };
});
