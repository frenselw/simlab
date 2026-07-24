(function (root, factory) {
  const levels = typeof module === "object" && module.exports ? require("./level-definitions.js") : root.KinematicsDrivingLevels;
  const api = factory(levels);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (Levels) {
  "use strict";

  const PHYSICS_VERSION = 1;
  const TICK_S = 0.05;
  const MASS = 1200;
  const GRAVITY = 9.81;
  const ROLLING = 180;
  const STATIC_HOLD = 220;
  const DRAG = 0.38;
  const THROTTLE = Object.freeze([0, 220, 1100, 2500]);
  const BRAKE = Object.freeze([0, 650, 1600, 3200]);
  const MAX_SPEED = 20;
  const STOP_TIMEOUT_TICKS = 60;
  const CONTROL_LABELS = Object.freeze(["空檔", "輕油門", "中油門", "重油門", "輕煞車", "中煞車", "重煞車"]);

  function validCode(code) { return Number.isInteger(code) && code >= 0 && code <= 6; }
  function forces(code) {
    if (!validCode(code)) throw new Error("Invalid control code");
    return code <= 3 ? { drive: THROTTLE[code], brake: 0 } : { drive: 0, brake: BRAKE[code - 3] };
  }
  function slopeForce(slopeDeg) { return MASS * GRAVITY * Math.sin(slopeDeg * Math.PI / 180); }
  function accelerationFor(speed, slopeDeg, code) {
    const input = forces(code);
    const resisting = speed > 0 ? ROLLING + DRAG * speed * speed : 0;
    const net = input.drive - input.brake - resisting - slopeForce(slopeDeg);
    if (speed <= 0 && net <= STATIC_HOLD) return 0;
    return net / MASS;
  }
  function initialState(level) {
    return { tick: 0, t: 0, x: 0, v: level.initialSpeed, a: 0, stoppedTicks: 0, terminal: null };
  }
  function integrateSubstep(speed, position, duration, slopeDeg, code) {
    const a = accelerationFor(speed, slopeDeg, code);
    const nextV = Math.max(0, speed + a * duration);
    return { a, v: nextV, x: position + (speed + nextV) * duration / 2 };
  }
  function tick(level, source, code) {
    if (!level || !validCode(code) || source.terminal) return { ...source };
    const segment = Levels.segmentAt(level, source.x);
    let integrated = integrateSubstep(source.v, source.x, TICK_S, segment?.slopeDeg || 0, code);
    let a = integrated.a;
    if (segment && integrated.x > segment.end && segment.end < level.routeLength && integrated.x > source.x) {
      const firstDuration = TICK_S * Math.max(0, Math.min(1, (segment.end - source.x) / (integrated.x - source.x)));
      const first = integrateSubstep(source.v, source.x, firstDuration, segment.slopeDeg, code);
      const nextSegment = Levels.segmentAt(level, Math.min(level.routeLength, segment.end + 1e-9));
      const second = integrateSubstep(first.v, first.x, TICK_S - firstDuration, nextSegment?.slopeDeg || 0, code);
      integrated = second;
      a = (second.v - source.v) / TICK_S;
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
      a, stoppedTicks, terminal
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
      samples.push({
        tick: state.tick, t: state.t, x: state.x, v: state.v, a: state.a, code: codes[index],
        segmentId: Levels.segmentAt(level, Math.min(state.x, level.routeLength - 1e-9))?.id || null
      });
    }
    return { state, samples, codes: codes.slice(0, state.tick) };
  }
  function isTerminalRun(level, codes) {
    const run = replay(level, codes);
    return Boolean(run?.state.terminal && ["complete", "stopped", "max-speed", "max-ticks"].includes(run.state.terminal));
  }
  function wheelAngle(distance, radius = 0.34) { return -(distance / radius) % (Math.PI * 2); }
  function qualitativeMotion(samples) {
    if (!samples || samples.length < 8) return "資料尚不足";
    const recent = samples.slice(-12);
    const delta = recent[recent.length - 1].v - recent[0].v;
    return Math.abs(delta) < 0.06 ? "速度大致穩定" : delta > 0 ? "車輛正在加快" : "車輛正在減慢";
  }
  function consumeInputTransitions(queue, boundaryTimestamp, appliedCode = 0) {
    if (!Array.isArray(queue) || !Number.isFinite(boundaryTimestamp) || !validCode(appliedCode)) throw new Error("Invalid input queue");
    let code = appliedCode;
    let consumed = 0;
    while (consumed < queue.length && queue[consumed].timestamp <= boundaryTimestamp) {
      const transition = queue[consumed];
      if (!Number.isFinite(transition.timestamp) || !Number.isInteger(transition.sequence) || !validCode(transition.code)) throw new Error("Invalid input transition");
      code = transition.code;
      consumed += 1;
    }
    return { code, remaining: queue.slice(consumed) };
  }

  return {
    PHYSICS_VERSION, TICK_S, MASS, GRAVITY, ROLLING, STATIC_HOLD, DRAG, THROTTLE, BRAKE, MAX_SPEED,
    CONTROL_LABELS, validCode, forces, slopeForce, accelerationFor, initialState, tick, replay, isTerminalRun,
    wheelAngle, qualitativeMotion, consumeInputTransitions
  };
});
