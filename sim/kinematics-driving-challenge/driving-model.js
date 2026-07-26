(function (root, factory) {
  const levels = typeof module === "object" && module.exports ? require("./level-definitions.js") : root.KinematicsDrivingLevels;
  const api = factory(levels);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (Levels) {
  "use strict";

  const PHYSICS_VERSION = 6;
  const TICK_S = 0.05;
  const GRAVITY = 9.81;
  const RESISTANCE_BASE = 0.05;
  const RESISTANCE_SPEED_SQUARED = 0.0025;
  const UNIFORM_SPEED = 8;
  const MAX_SPEED = 20;
  const LIGHT_THROTTLE_RESPONSE = 0.4;
  const LIGHT_THROTTLE_SPEED_SCALE = 3;
  const MEDIUM_THROTTLE_NET_ACCELERATION = 0.6;
  const FULL_THROTTLE_BASE_NET_ACCELERATION = 0.65;
  const FULL_THROTTLE_SPEED_FACTOR = 0.05;
  const LIGHT_BRAKE_MIN_NET_DECELERATION = 0.72;
  const LIGHT_BRAKE_MAX_NET_DECELERATION = 1.29;
  const LIGHT_BRAKE_CURVE_RATE = 2;
  const MEDIUM_BRAKE_NET_DECELERATION = 1.3;
  const FULL_BRAKE_BASE_NET_DECELERATION = 1.45;
  const FULL_BRAKE_SPEED_FACTOR = 0.06;
  const DOWNHILL_BALANCE_DECELERATION = GRAVITY * Math.sin(4.34 * Math.PI / 180);
  const LIGHT_BRAKE_CURVE_CENTER = UNIFORM_SPEED - Math.log(
    (DOWNHILL_BALANCE_DECELERATION - LIGHT_BRAKE_MIN_NET_DECELERATION) /
      (LIGHT_BRAKE_MAX_NET_DECELERATION - DOWNHILL_BALANCE_DECELERATION)
  ) / LIGHT_BRAKE_CURVE_RATE;
  const STOP_TIMEOUT_TICKS = 60;
  const CONTROL_LABELS = Object.freeze(["空檔", "輕油門", "中油門", "油門踩盡", "輕煞車", "中煞車", "煞車踩盡"]);

  function validCode(code) { return Number.isInteger(code) && code >= 0 && code <= 6; }
  function resistanceAcceleration(speed) {
    return RESISTANCE_BASE + RESISTANCE_SPEED_SQUARED * Math.max(0, speed) ** 2;
  }
  function lightThrottleNetAcceleration(speed) {
    return LIGHT_THROTTLE_RESPONSE *
      Math.tanh((UNIFORM_SPEED - Math.max(0, speed)) / LIGHT_THROTTLE_SPEED_SCALE);
  }
  function driveAcceleration(speed, code) {
    if (!validCode(code)) throw new Error("Invalid control code");
    if (code === 1) return resistanceAcceleration(speed) + lightThrottleNetAcceleration(speed);
    if (code === 2) return resistanceAcceleration(speed) + MEDIUM_THROTTLE_NET_ACCELERATION;
    if (code === 3) {
      return resistanceAcceleration(speed) + FULL_THROTTLE_BASE_NET_ACCELERATION +
        FULL_THROTTLE_SPEED_FACTOR * Math.max(0, speed);
    }
    return 0;
  }
  function lightBrakeNetDeceleration(speed) {
    return LIGHT_BRAKE_MIN_NET_DECELERATION +
      (LIGHT_BRAKE_MAX_NET_DECELERATION - LIGHT_BRAKE_MIN_NET_DECELERATION) *
      (1 / (1 + Math.exp(-LIGHT_BRAKE_CURVE_RATE * (Math.max(0, speed) - LIGHT_BRAKE_CURVE_CENTER))));
  }
  function slopeAcceleration(slopeDeg) { return GRAVITY * Math.sin(slopeDeg * Math.PI / 180); }
  function flatRoadAcceleration(speed, code) {
    if (!validCode(code)) throw new Error("Invalid control code");
    // Brake controls are calibrated as net flat-road responses so the
    // learner-facing light/medium/full ordering remains true at every legal
    // speed while only the medium setting produces a straight v–t trace.
    if (code === 4) return -lightBrakeNetDeceleration(speed);
    if (code === 5) return -MEDIUM_BRAKE_NET_DECELERATION;
    if (code === 6) return -(FULL_BRAKE_BASE_NET_DECELERATION + FULL_BRAKE_SPEED_FACTOR * Math.max(0, speed));
    return driveAcceleration(speed, code) - resistanceAcceleration(speed);
  }
  function accelerationFor(speed, slopeDeg, code) {
    const acceleration = flatRoadAcceleration(speed, code) - slopeAcceleration(slopeDeg);
    if (speed <= 0 && acceleration <= 0) return 0;
    return acceleration;
  }
  function initialState(level) {
    return { tick: 0, t: 0, x: 0, v: level.initialSpeed, a: 0, stoppedTicks: 0, terminal: null };
  }
  function integrateSubstep(speed, position, duration, slopeDeg, code) {
    const a = accelerationFor(speed, slopeDeg, code);
    const unconstrainedV = speed + a * duration;
    if (a < 0 && speed > 0 && unconstrainedV < 0) {
      const movingDuration = Math.min(duration, speed / -a);
      return {
        a,
        v: 0,
        x: position + speed * movingDuration + .5 * a * movingDuration ** 2
      };
    }
    const nextV = Math.max(0, unconstrainedV);
    return { a, v: nextV, x: position + (speed + nextV) * duration / 2 };
  }
  function crossingDuration(speed, acceleration, distance, maximumDuration) {
    if (!(distance >= 0) || !(maximumDuration > 0)) return null;
    if (distance === 0) return 0;
    if (Math.abs(acceleration) < 1e-12) return speed > 0 ? Math.min(maximumDuration, distance / speed) : null;
    const discriminant = speed * speed + 2 * acceleration * distance;
    if (discriminant < 0) return null;
    const root = (-speed + Math.sqrt(discriminant)) / acceleration;
    return root >= 0 && root <= maximumDuration + 1e-10 ? Math.min(maximumDuration, root) : null;
  }
  function tick(level, source, code) {
    if (!level || !validCode(code) || source.terminal) return { ...source };
    const segment = Levels.segmentAt(level, source.x);
    let integrated = integrateSubstep(source.v, source.x, TICK_S, segment?.slopeDeg || 0, code);
    let a = integrated.a;
    let pieces = [{
      segmentId: segment?.id || null, duration: TICK_S,
      startX: source.x, endX: integrated.x, startV: source.v, endV: integrated.v
    }];
    if (segment && integrated.x > segment.end && segment.end < level.routeLength && integrated.x > source.x) {
      const firstDuration = crossingDuration(source.v, integrated.a, segment.end - source.x, TICK_S);
      if (firstDuration == null) return { ...source, terminal: "technical" };
      const first = integrateSubstep(source.v, source.x, firstDuration, segment.slopeDeg, code);
      first.x = segment.end;
      const nextSegment = Levels.segmentAt(level, Math.min(level.routeLength, segment.end + 1e-9));
      const second = integrateSubstep(first.v, first.x, TICK_S - firstDuration, nextSegment?.slopeDeg || 0, code);
      integrated = second;
      a = (second.v - source.v) / TICK_S;
      pieces = [
        { segmentId: segment.id, duration: firstDuration, startX: source.x, endX: segment.end, startV: source.v, endV: first.v },
        { segmentId: nextSegment?.id || null, duration: TICK_S - firstDuration, startX: segment.end, endX: second.x, startV: first.v, endV: second.v }
      ];
    }
    const nextV = integrated.v;
    const nextX = integrated.x;
    const nextTick = source.tick + 1;
    const stoppedTicks = nextV <= 1e-8 ? source.stoppedTicks + 1 : 0;
    let terminal = null;
    if (![a, nextV, nextX].every(Number.isFinite)) terminal = "technical";
    else if (nextV >= MAX_SPEED) terminal = "max-speed";
    else if (nextX >= level.routeLength) terminal = "complete";
    else if (stoppedTicks >= STOP_TIMEOUT_TICKS) terminal = "stopped";
    else if (nextTick >= level.maxTicks) terminal = "max-ticks";
    return {
      tick: nextTick, t: nextTick * TICK_S, x: Math.min(nextX, level.routeLength), v: Math.min(nextV, MAX_SPEED),
      a, stoppedTicks, terminal, pieces
    };
  }
  function replay(level, codes, options = {}) {
    if (!level || !Array.isArray(codes) || codes.length > level.maxTicks || codes.some((code) => !validCode(code))) return null;
    let state = initialState(level);
    const samples = [{ tick: 0, t: 0, x: 0, v: state.v, a: 0, code: 0, segmentId: Levels.segmentAt(level, 0)?.id || null }];
    for (let index = 0; index < codes.length; index += 1) {
      if (state.terminal) {
        if (!options.allowTrailing) return null;
        break;
      }
      state = tick(level, state, codes[index]);
      if (state.pieces?.length === 2) {
        const first = state.pieces[0];
        samples.push({
          tick: state.tick, t: state.t - state.pieces[1].duration, x: first.endX, v: first.endV,
          a: (first.endV - first.startV) / Math.max(first.duration, 1e-12), code: codes[index],
          segmentId: first.segmentId, boundary: true
        });
      }
      samples.push({
        tick: state.tick, t: state.t, x: state.x, v: state.v, a: state.a, code: codes[index],
        segmentId: Levels.segmentAt(level, Math.min(state.x, level.routeLength - 1e-9))?.id || null
      });
    }
    const finalState = { ...state };
    delete finalState.pieces;
    return { state: finalState, samples, codes: codes.slice(0, state.tick) };
  }
  function isTerminalRun(level, codes) {
    const run = replay(level, codes);
    return Boolean(run?.state.terminal && ["complete", "stopped", "max-speed", "max-ticks"].includes(run.state.terminal));
  }
  function wheelAngle(distance, radius = 0.58) {
    if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) throw new TypeError("Invalid wheel geometry");
    const turn = distance / radius;
    return ((turn % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }
  function qualitativeMotion(samples) {
    if (!samples || samples.length < 8) return "資料尚不足";
    const recent = samples.slice(-12);
    const delta = recent[recent.length - 1].v - recent[0].v;
    return Math.abs(delta) < 0.06 ? "速度大致穩定" : delta > 0 ? "車輛正在加快" : "車輛正在減慢";
  }
  function consumeInputTransitions(queue, boundaryTimestamp, appliedCode = 0) {
    if (!Array.isArray(queue) || !Number.isFinite(boundaryTimestamp) ||
        boundaryTimestamp < 0 || !validCode(appliedCode)) throw new Error("Invalid input queue");
    const sequences = new Set();
    const ordered = queue.map((transition) => {
      if (!transition || !Number.isFinite(transition.timestamp) || transition.timestamp < 0 ||
          !Number.isSafeInteger(transition.sequence) || transition.sequence < 0 ||
          !validCode(transition.code) || sequences.has(transition.sequence)) {
        throw new Error("Invalid input transition");
      }
      sequences.add(transition.sequence);
      return transition;
    }).sort((left, right) => left.timestamp - right.timestamp || left.sequence - right.sequence);
    let code = appliedCode;
    let consumed = 0;
    while (consumed < ordered.length && ordered[consumed].timestamp <= boundaryTimestamp) {
      const transition = ordered[consumed];
      code = transition.code;
      consumed += 1;
    }
    return { code, remaining: ordered.slice(consumed) };
  }

  return {
    PHYSICS_VERSION, TICK_S, GRAVITY, RESISTANCE_BASE, RESISTANCE_SPEED_SQUARED, UNIFORM_SPEED, MAX_SPEED,
    LIGHT_THROTTLE_RESPONSE, LIGHT_THROTTLE_SPEED_SCALE,
    MEDIUM_THROTTLE_NET_ACCELERATION, FULL_THROTTLE_BASE_NET_ACCELERATION, FULL_THROTTLE_SPEED_FACTOR,
    LIGHT_BRAKE_MIN_NET_DECELERATION, LIGHT_BRAKE_MAX_NET_DECELERATION,
    MEDIUM_BRAKE_NET_DECELERATION, FULL_BRAKE_BASE_NET_DECELERATION, FULL_BRAKE_SPEED_FACTOR,
    CONTROL_LABELS, validCode, resistanceAcceleration, lightThrottleNetAcceleration,
    driveAcceleration, flatRoadAcceleration,
    slopeAcceleration, accelerationFor, initialState, tick, replay, isTerminalRun,
    wheelAngle, qualitativeMotion, consumeInputTransitions, crossingDuration
  };
});
