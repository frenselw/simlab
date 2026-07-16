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
  const MAX_RENDER_POSITION = 1e11;
  const MIN_NORMAL = 2.2250738585072014e-308;
  const READING_SPAN = 50;
  const READING_BASE = 20;
  const SEGMENTS = ["slow", "accelerate", "fast", "decelerate", "stopped", "restart"];
  const DURATION_RANGES = {
    slow: [0.6, 0.8], accelerate: [2.8, 3.1], fast: [0.6, 0.8],
    decelerate: [2.8, 3.1], stopped: [0.6, 0.8], restart: [1, 1.2]
  };

  function finite(value) { return Number.isFinite(value); }
  function roundStep(value, step) { return Math.round(value / step) * step; }
  function canonicalNumber(value) {
    if (!finite(value)) throw new TypeError("Value must be finite");
    return value === 0 ? 0 : Number(value.toPrecision(SIGNIFICANT_FIGURES));
  }
  function roundedParts(value) {
    const rounded = canonicalNumber(value);
    if (!finite(rounded)) return null;
    const exponential = rounded.toExponential(SIGNIFICANT_FIGURES - 1);
    return { rounded, exponential, exponent: Number(exponential.slice(exponential.indexOf("e") + 1)) };
  }
  function format3(value) {
    if (!finite(value)) return "--";
    if (value === 0) return "0.00";
    if (Math.abs(value) < MIN_NORMAL) return "--";
    const parts = roundedParts(value);
    if (!parts) return "--";
    const { rounded, exponential, exponent } = parts;
    if (exponent >= 2 || exponent <= -4) {
      const mantissa = exponential.slice(0, exponential.indexOf("e"));
      return `${mantissa} × 10${superscript(exponent)}`;
    }
    return rounded.toFixed(Math.max(0, SIGNIFICANT_FIGURES - exponent - 1));
  }
  function formatInput3(value) {
    if (!finite(value) || value < 0) return "--";
    if (value === 0) return "0.00";
    if (value < MIN_NORMAL) return "--";
    const parts = roundedParts(value);
    if (!parts) return "--";
    const { rounded, exponential, exponent } = parts;
    return exponent >= 2 || exponent <= -4
      ? exponential.replace("e+", "e")
      : rounded.toFixed(Math.max(0, SIGNIFICANT_FIGURES - exponent - 1));
  }
  function superscript(value) {
    const map = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    return String(value).split("").map((digit) => map[digit]).join("");
  }
  function normalizeInput(raw) {
    const text = String(raw ?? "").trim();
    const match = text.match(/^(\d+(?:\.\d+)?)(?:[eE]([+-]?\d+))?$/);
    if (!match) return null;
    const value = Number(text);
    if (!finite(value) || (value !== 0 && value < MIN_NORMAL)) return null;
    if (value === 0) return match[2] == null && /^0+\.00$/.test(text) ? { value: 0, text: "0.00" } : null;
    const compact = match[1].replace(/^0+/, "");
    const digits = compact.replace(".", "");
    const first = digits.search(/[1-9]/);
    if (first < 0 || digits.slice(first).length !== SIGNIFICANT_FIGURES) return null;
    const normalized = formatInput3(value);
    return normalized === "--" || !finite(Number(normalized)) ? null : { value, text: normalized };
  }
  function safeModelTime(value) { return finite(value) && value >= 0 && value <= MAX_MODEL_TIME; }
  function hasModelTimeHeadroom(value, duration) {
    return safeModelTime(value) && finite(duration) && duration >= 0 && value + duration > value && value + duration <= MAX_MODEL_TIME;
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
    const exponent = Math.floor(Math.log10(Math.abs(expected)));
    return 0.5 * (10 ** (exponent - SIGNIFICANT_FIGURES + 1));
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
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0];
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }
  function sampleStep(random, min, max, step) {
    return roundStep(min + Math.floor(random() * (Math.floor((max - min) / step) + 1)) * step, step);
  }
  function shuffle(items, random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function createAttempt(seed = randomSeed(), maxAttempts = MAX_GENERATION_ATTEMPTS) {
    if (!Number.isInteger(seed) || seed < 0 || !Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("Invalid generation request");
    const random = mulberry32(seed);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const definition = candidate(seed, random);
      if (validateDefinition(definition)) return definition;
    }
    throw new Error("未能產生有效的運動題目");
  }
  function candidate(seed, random) {
    const slowSpeed = sampleStep(random, 1.5, 3, 0.01);
    const fastSpeed = sampleStep(random, Math.max(6.5, slowSpeed + 4), 9.5, 0.01);
    const durations = {
      slow: sampleStep(random, 0.6, 0.8, 0.05),
      accelerate: sampleStep(random, 2.8, 3.1, 0.05),
      fast: sampleStep(random, 0.6, 0.8, 0.05),
      decelerate: sampleStep(random, 2.8, 3.1, 0.05),
      stopped: sampleStep(random, 0.6, 0.8, 0.05),
      restart: sampleStep(random, 1, 1.2, 0.05)
    };
    const cycle = Object.values(durations).reduce((sum, value) => sum + value, 0);
    const targetSegment = random() < 0.5 ? "accelerate" : "decelerate";
    const targetDuration = durations[targetSegment];
    const targetWithin = sampleStep(random, 2.1, targetDuration - TARGET_BOUNDARY_MARGIN_S, 0.01);
    const targetStart = targetSegment === "accelerate"
      ? durations.slow
      : durations.slow + durations.accelerate + durations.fast;
    const desiredTargetTime = sampleStep(random, 4.2, 8.2, 0.01);
    const initialPhase = roundStep(mod(targetStart + targetWithin - desiredTargetTime, cycle), 0.01);
    const targetCycleIndex = initialPhase <= targetStart + targetWithin ? 0 : 1;
    const x0 = sampleStep(random, 12, 38, 0.1);
    const variableX0 = x0 + sampleStep(random, 1, 8, 0.1);
    const uniformSpeed = sampleStep(random, 3.2, 8.8, 0.01);
    const definition = {
      seed,
      uniform: { x0, speed: uniformSpeed, coordinateOrigin: Math.floor(x0 / 10) * 10, layout: Math.floor(random() * 3) },
      variable: { x0: variableX0, coordinateOrigin: Math.floor(variableX0 / 10) * 10, slowSpeed, fastSpeed, durations, initialPhase, layout: Math.floor(random() * 3) },
      instantTarget: { segment: targetSegment, cycleIndex: targetCycleIndex, timeWithinSegment: targetWithin },
      windows: WINDOWS.slice(),
      instantOptions: []
    };
    definition.instantOptions = buildOptions(definition, random);
    return definition;
  }
  function buildOptions(definition, random) {
    const rows = analysisWindows(definition);
    const target = canonicalNumber(variableVelocity(definition.variable, targetSceneTime(definition)));
    const direction = definition.instantTarget.segment === "accelerate" ? -1 : 1;
    const raw = [target, rows[0].averageVelocity, rows[3].averageVelocity, canonicalNumber(Math.max(0.1, target + direction * Math.max(0.4, Math.abs(target - rows[0].averageVelocity) * 1.7)))];
    const unique = [];
    raw.forEach((value) => {
      let candidateValue = canonicalNumber(value);
      while (unique.some((item) => item.value === candidateValue)) candidateValue = canonicalNumber(candidateValue + (direction || 1) * 0.1);
      unique.push({ id: `o${unique.length + 1}`, value: candidateValue, correct: unique.length === 0 ? 1 : 0 });
    });
    return shuffle(unique, random);
  }

  function uniformPosition(definition, time) { return definition.x0 + definition.speed * Math.max(0, time); }
  function uniformVelocity(definition) { return definition.speed; }
  function cycleDuration(definition) { return SEGMENTS.reduce((sum, key) => sum + definition.durations[key], 0); }
  function segmentTable(definition) {
    const d = definition.durations;
    const slow = definition.slowSpeed;
    const fast = definition.fastSpeed;
    let start = 0;
    return [
      { key: "slow", start, duration: d.slow, v0: slow, v1: slow },
      { key: "accelerate", start: start += d.slow, duration: d.accelerate, v0: slow, v1: fast },
      { key: "fast", start: start += d.accelerate, duration: d.fast, v0: fast, v1: fast },
      { key: "decelerate", start: start += d.fast, duration: d.decelerate, v0: fast, v1: 0 },
      { key: "stopped", start: start += d.decelerate, duration: d.stopped, v0: 0, v1: 0 },
      { key: "restart", start: start += d.stopped, duration: d.restart, v0: 0, v1: slow }
    ];
  }
  function mod(value, divisor) { return ((value % divisor) + divisor) % divisor; }
  function profileState(definition, profileTime) {
    const cycle = cycleDuration(definition);
    const local = mod(profileTime, cycle);
    const segment = segmentTable(definition).find((item) => local <= item.start + item.duration + 1e-10) || segmentTable(definition)[0];
    const elapsed = Math.max(0, Math.min(segment.duration, local - segment.start));
    const acceleration = (segment.v1 - segment.v0) / segment.duration;
    return { segment: segment.key, elapsed, velocity: segment.v0 + acceleration * elapsed, acceleration };
  }
  function distanceWithinCycle(definition, localTime) {
    let distance = 0;
    const limit = Math.max(0, Math.min(cycleDuration(definition), localTime));
    for (const segment of segmentTable(definition)) {
      const elapsed = Math.max(0, Math.min(segment.duration, limit - segment.start));
      distance += segment.v0 * elapsed + 0.5 * ((segment.v1 - segment.v0) / segment.duration) * elapsed * elapsed;
    }
    return distance;
  }
  function profileDistance(definition, profileTime) {
    const cycle = cycleDuration(definition);
    const cycles = Math.floor(profileTime / cycle);
    return cycles * distanceWithinCycle(definition, cycle) + distanceWithinCycle(definition, mod(profileTime, cycle));
  }
  function variablePosition(definition, time) {
    const t = Math.max(0, time);
    return definition.x0 + profileDistance(definition, definition.initialPhase + t) - profileDistance(definition, definition.initialPhase);
  }
  function variableVelocity(definition, time) { return profileState(definition, definition.initialPhase + Math.max(0, time)).velocity; }
  function qualitativeState(definition, time) {
    const state = profileState(definition, definition.initialPhase + Math.max(0, time));
    return state.segment;
  }
  function targetSceneTime(definition) {
    const segment = segmentTable(definition.variable).find((item) => item.key === definition.instantTarget.segment);
    return definition.instantTarget.cycleIndex * cycleDuration(definition.variable) + segment.start + definition.instantTarget.timeWithinSegment - definition.variable.initialPhase;
  }
  function analysisWindows(definition) {
    const targetTime = targetSceneTime(definition);
    return definition.windows.map((window) => {
      const startTime = canonicalNumber(targetTime - window);
      const endTime = canonicalNumber(targetTime);
      const startPosition = canonicalNumber(variablePosition(definition.variable, startTime));
      const endPosition = canonicalNumber(variablePosition(definition.variable, endTime));
      const duration = canonicalNumber(endTime - startTime);
      const averageVelocity = canonicalNumber((endPosition - startPosition) / duration);
      return { window: canonicalNumber(window), startTime, endTime, startPosition, endPosition, duration, averageVelocity };
    });
  }
  function captureMeasurement(positionAt, startModelTime, endModelTime, readingOrigin) {
    if (!safeModelTime(startModelTime) || !safeModelTime(endModelTime) || endModelTime <= startModelTime) return null;
    const origin = readingOrigin ?? rollingReadingOrigin(positionAt(startModelTime));
    return {
      startModelTime,
      endModelTime,
      readingOrigin: origin,
      x1: canonicalNumber(readingPosition(positionAt(startModelTime), origin)),
      x2: canonicalNumber(readingPosition(positionAt(endModelTime), origin)),
      dt: canonicalNumber(endModelTime - startModelTime)
    };
  }
  function expectedFromMeasurement(measurement) {
    if (!measurement) return null;
    const displacement = canonicalNumber(measurement.x2 - measurement.x1);
    return { displacement, time: measurement.dt, averageVelocity: canonicalNumber(displacement / measurement.dt) };
  }
  function validDurations(durations) {
    return durations && SEGMENTS.every((key) => {
      const [minimum, maximum] = DURATION_RANGES[key];
      return finite(durations[key]) && durations[key] >= minimum - 1e-9 && durations[key] <= maximum + 1e-9;
    });
  }
  function validateDefinition(definition) {
    if (!definition || !Number.isInteger(definition.seed) || definition.seed < 0 || !definition.uniform || !definition.variable) return false;
    const u = definition.uniform;
    const v = definition.variable;
    if (![u.x0, u.speed, u.coordinateOrigin, v.x0, v.coordinateOrigin, v.slowSpeed, v.fastSpeed, v.initialPhase].every(finite)) return false;
    if (!Number.isInteger(u.layout) || u.layout < 0 || u.layout > 2 || !Number.isInteger(v.layout) || v.layout < 0 || v.layout > 2) return false;
    if (u.x0 < 12 || u.x0 > 38 || v.x0 < 13 || v.x0 > 46) return false;
    if (u.coordinateOrigin % 10 !== 0 || v.coordinateOrigin % 10 !== 0 || u.x0 < u.coordinateOrigin || u.x0 >= u.coordinateOrigin + 10 || v.x0 < v.coordinateOrigin || v.x0 >= v.coordinateOrigin + 10) return false;
    if (u.speed < 3.2 || u.speed > 8.8 || v.slowSpeed < 1.5 || v.slowSpeed > 3 || v.fastSpeed < 6.5 || v.fastSpeed > 9.5 || v.fastSpeed - v.slowSpeed < 4) return false;
    if (Math.abs(u.speed - v.slowSpeed) < 0.75 || Math.abs(u.speed - v.fastSpeed) < 0.75) return false;
    if (!validDurations(v.durations)) return false;
    const cycle = cycleDuration(v);
    if (cycle < 7.5 || cycle > 10.5) return false;
    if (v.initialPhase < 0 || v.initialPhase >= cycle) return false;
    if (!safeWorldPosition(uniformPosition(u, MAX_MODEL_TIME)) || !safeWorldPosition(variablePosition(v, MAX_MODEL_TIME))) return false;
    if (!Array.isArray(definition.windows) || definition.windows.length !== WINDOWS.length || !definition.windows.every((item, index) => item === WINDOWS[index])) return false;
    const target = definition.instantTarget;
    if (!target || !["accelerate", "decelerate"].includes(target.segment) || ![0, 1].includes(target.cycleIndex) || !finite(target.timeWithinSegment)) return false;
    const duration = v.durations[target.segment];
    if (target.timeWithinSegment < WINDOWS[0] + TARGET_BOUNDARY_MARGIN_S - 1e-9 || duration - target.timeWithinSegment < TARGET_BOUNDARY_MARGIN_S - 1e-9) return false;
    if (targetSceneTime(definition) <= WINDOWS[0]) return false;
    const rows = analysisWindows(definition);
    if (new Set(rows.map((row) => row.averageVelocity)).size < 3) return false;
    const exact = canonicalNumber(variableVelocity(v, targetSceneTime(definition)));
    const differences = rows.map((row) => Math.abs(row.averageVelocity - exact));
    for (let index = 1; index < rows.length; index += 1) {
      const expectedDirection = target.segment === "accelerate"
        ? rows[index].averageVelocity > rows[index - 1].averageVelocity
        : rows[index].averageVelocity < rows[index - 1].averageVelocity;
      if (!expectedDirection || !(differences[index] < differences[index - 1])) return false;
    }
    const options = definition.instantOptions;
    if (!Array.isArray(options) || options.length !== 4 || new Set(options.map((item) => item.id)).size !== 4 || new Set(options.map((item) => item.value)).size !== 4 || options.filter((item) => item.correct === 1).length !== 1) return false;
    if (!options.every((item) => typeof item.id === "string" && finite(item.value) && item.value >= 0 && format3(item.value) !== "--")) return false;
    if (options.find((item) => item.correct === 1).value !== exact) return false;
    const thirdPlace = halfThirdPlace(exact) * 2;
    if (options.some((item, index) => options.slice(index + 1).some((other) => Math.abs(item.value - other.value) < thirdPlace * 4 - 1e-9))) return false;
    return true;
  }

  function advanceSimulationTime(initial, frames) {
    if (!safeModelTime(initial) || !Array.isArray(frames)) throw new TypeError("Invalid frame schedule");
    return frames.reduce((time, frame) => {
      if (!frame || !finite(frame.dt) || frame.dt < 0) throw new TypeError("Invalid frame");
      const next = frame.running ? time + Math.min(0.05, frame.dt) : time;
      if (!safeModelTime(next) || (frame.running && frame.dt > 0 && next <= time)) throw new RangeError("Simulation time cannot advance safely");
      return next;
    }, initial);
  }

  return {
    SIGNIFICANT_FIGURES, WINDOWS, TARGET_BOUNDARY_MARGIN_S, NUMERIC_EPSILON_FACTOR, MAX_MODEL_TIME, MAX_RENDER_POSITION, MIN_NORMAL, SEGMENTS,
    canonicalNumber, format3, formatInput3, normalizeInput, halfThirdPlace, numericMatch, mulberry32, randomSeed,
    safeModelTime, hasModelTimeHeadroom, safeWorldPosition, rollingReadingOrigin, readingPosition,
    createAttempt, validateDefinition, uniformPosition, uniformVelocity, cycleDuration, segmentTable,
    profileState, variablePosition, variableVelocity, qualitativeState, targetSceneTime, analysisWindows,
    captureMeasurement, expectedFromMeasurement, advanceSimulationTime
  };
});
