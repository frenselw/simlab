(function (root, factory) {
  const G = root.StaticKineticFrictionGenerator || (typeof module === "object" && module.exports ? require("./generator.js") : null);
  const api = factory(G);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionPhysics = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator) {
  "use strict";

  const PHYSICS_DT_S = 1 / 240;
  const HANDLE_OMEGA = 40;
  const HANDLE_ZETA = 1;
  const HANDLE_SPEED_LIMIT_MPS = 0.35;
  const V_STICK_MPS = 1e-5;
  const FORCE_EPSILON_N = 1e-8;
  const RESTICK_EPSILON_N = 1e-7;
  const REST_LENGTH_EPS_M = 1e-9;
  const CROSSING_FRACTION_EPS = 1e-7;
  const MAX_CROSSING_DEPTH = 4;

  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function smoothstep(edge0, edge1, x) {
    if (edge1 <= edge0) return x <= edge0 ? 0 : 1;
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function createInitialState(scenario) {
    const rest = scenario.connector.restLengthM;
    return {
      timeS: 0,
      block: { positionM: 0, velocityMps: 0, accelerationMps2: 0 },
      handle: { targetPositionM: rest, positionM: rest, velocityMps: 0 },
      connector: { extensionM: 0, tensionPhysicalN: 0 },
      contact: { mode: "static", frictionPhysicalN: 0 },
      events: []
    };
  }
  function stepHandle(handle, targetPositionM, dt) {
    const target = finite(targetPositionM, handle.targetPositionM);
    const acceleration = HANDLE_OMEGA * HANDLE_OMEGA * (target - handle.positionM) -
      2 * HANDLE_ZETA * HANDLE_OMEGA * handle.velocityMps;
    const velocityMps = clamp(handle.velocityMps + acceleration * dt, -HANDLE_SPEED_LIMIT_MPS, HANDLE_SPEED_LIMIT_MPS);
    return { targetPositionM: target, velocityMps, positionM: handle.positionM + velocityMps * dt };
  }
  function connectorTension(handlePositionM, blockPositionM, handleVelocityMps, blockVelocityMps, connector = Generator.CONNECTOR) {
    const gapM = handlePositionM - blockPositionM;
    if (gapM < connector.restLengthM) return 0;
    const extensionM = Math.max(0, gapM - connector.restLengthM);
    const relativeVelocityMps = handleVelocityMps - blockVelocityMps;
    const dampingWeight = smoothstep(0, connector.dampingEngagementLengthM, extensionM);
    return Math.max(0, connector.stiffnessNPerM * extensionM + dampingWeight * connector.dampingNsPerM * relativeVelocityMps);
  }
  function connectorExtension(handlePositionM, blockPositionM, connector = Generator.CONNECTOR) {
    return Math.max(0, handlePositionM - blockPositionM - connector.restLengthM);
  }
  function predictedBlockPosition(state, handle, scenario, dt) {
    const tensionN = connectorTension(handle.positionM, state.block.positionM, handle.velocityMps, state.block.velocityMps, scenario.connector);
    if (state.contact.mode === "static" && tensionN <= staticLimitAt(state, scenario) + FORCE_EPSILON_N) return state.block.positionM;
    const frictionN = kineticFrictionAt(state, scenario);
    const accelerationMps2 = (tensionN - frictionN) / scenario.massKg;
    const proposedVelocity = state.block.velocityMps + accelerationMps2 * dt;
    if (state.block.velocityMps > 0 && proposedVelocity <= 0 && tensionN <= staticLimitAt(state, scenario) + RESTICK_EPSILON_N) return state.block.positionM;
    return state.block.positionM + Math.max(0, proposedVelocity) * dt;
  }
  function splitAtRestLengthCrossing(state, handle, restLengthM, dt, endBlockPositionM = state.block.positionM) {
    const startGap = state.handle.positionM - state.block.positionM;
    const endGap = handle.positionM - endBlockPositionM;
    if (startGap < restLengthM - REST_LENGTH_EPS_M && endGap >= restLengthM - REST_LENGTH_EPS_M && endGap > startGap + REST_LENGTH_EPS_M) {
      const u = clamp((restLengthM - startGap) / (endGap - startGap), 0, 1);
      if (u <= CROSSING_FRACTION_EPS || 1 - u <= CROSSING_FRACTION_EPS) return { crossed: false, slackDt: 0, tautDt: dt, fraction: null };
      return { crossed: true, slackDt: dt * u, tautDt: dt * (1 - u), fraction: u };
    }
    if (startGap >= restLengthM - REST_LENGTH_EPS_M && endGap < restLengthM - REST_LENGTH_EPS_M && endGap < startGap - REST_LENGTH_EPS_M) {
      const u = clamp((startGap - restLengthM) / (startGap - endGap), 0, 1);
      if (u <= CROSSING_FRACTION_EPS || 1 - u <= CROSSING_FRACTION_EPS) return { crossed: false, slackDt: 0, tautDt: dt, fraction: null };
      return { crossed: true, slackDt: dt * (1 - u), tautDt: dt * u, fraction: u };
    }
    return { crossed: false, slackDt: 0, tautDt: dt, fraction: null };
  }
  function staticLimitAt(state, scenario) { return Generator.staticLimitAt(state.block.positionM, scenario); }
  function kineticFrictionAt(state, scenario) { return Generator.kineticFrictionAt(state.block.positionM, scenario); }
  function resolveStaticContact(state, tensionN, scenario) {
    const limitN = staticLimitAt(state, scenario);
    if (Math.abs(state.block.velocityMps) <= V_STICK_MPS && tensionN <= limitN + FORCE_EPSILON_N) {
      return { mode: "static", frictionN: tensionN, accelerationMps2: 0, velocityMps: 0 };
    }
    return null;
  }
  function resolveSlidingContact(state, tensionN, scenario) {
    const frictionN = kineticFrictionAt(state, scenario);
    return { mode: "sliding", frictionN, accelerationMps2: (tensionN - frictionN) / scenario.massKg };
  }
  function maybeRestick(state, tensionN, nextVelocityMps, scenario) {
    const limitN = staticLimitAt(state, scenario);
    if (state.block.velocityMps > 0 && nextVelocityMps <= 0 && tensionN <= limitN + RESTICK_EPSILON_N) {
      return { mode: "static", frictionN: tensionN, velocityMps: 0, accelerationMps2: 0 };
    }
    return null;
  }
  function interpolateHandle(start, end, fraction) {
    const u = clamp(fraction, 0, 1);
    return {
      targetPositionM: end.targetPositionM,
      positionM: start.positionM + (end.positionM - start.positionM) * u,
      velocityMps: start.velocityMps + (end.velocityMps - start.velocityMps) * u
    };
  }
  function stepPhysics(state, input = {}, scenario, dt = PHYSICS_DT_S, forcedHandle = null, crossingDepth = 0) {
    if (!scenario) throw new Error("scenario required");
    const h = forcedHandle || stepHandle(state.handle, input.handleTargetPositionM ?? state.handle.targetPositionM, dt);
    // A connector cannot push.  When a render/physics step crosses its rest
    // length, split the step at the crossing so the slack part has exactly
    // zero tension and the taut part starts from zero extension.  This also
    // handles taut -> slack transitions without an artificial impulse.
    if (!forcedHandle && dt > 1e-12 && crossingDepth < MAX_CROSSING_DEPTH) {
      const crossing = splitAtRestLengthCrossing(state, h, scenario.connector.restLengthM, dt, predictedBlockPosition(state, h, scenario, dt));
      if (crossing.crossed) {
        const startGap = state.handle.positionM - state.block.positionM;
        const enteringTaut = startGap < scenario.connector.restLengthM - REST_LENGTH_EPS_M;
        const crossHandle = interpolateHandle(state.handle, h, crossing.fraction);
        if (enteringTaut) {
          const slackState = crossing.slackDt > 1e-12
            ? stepPhysics(state, input, scenario, crossing.slackDt, crossHandle, crossingDepth + 1)
            : { ...state, handle: crossHandle };
          const tautState = crossing.tautDt > 1e-12
            ? stepPhysics(slackState, input, scenario, crossing.tautDt, null, crossingDepth + 1)
            : slackState;
          return { ...tautState, events: [...(slackState.events || []), ...(tautState.events || [])] };
        }
        const tautState = crossing.tautDt > 1e-12
          ? stepPhysics(state, input, scenario, crossing.tautDt, crossHandle, crossingDepth + 1)
          : { ...state, handle: crossHandle };
        const slackState = crossing.slackDt > 1e-12
          ? stepPhysics(tautState, input, scenario, crossing.slackDt, null, crossingDepth + 1)
          : tautState;
        return { ...slackState, events: [...(tautState.events || []), ...(slackState.events || [])] };
      }
    }
    const connector = scenario.connector;
    const extensionM = connectorExtension(h.positionM, state.block.positionM, connector);
    const tensionN = connectorTension(h.positionM, state.block.positionM, h.velocityMps, state.block.velocityMps, connector);
    const priorTension = connectorTension(state.handle.positionM, state.block.positionM, state.handle.velocityMps, state.block.velocityMps, connector);
    const limitN = staticLimitAt(state, scenario);
    const events = [];
    let contact;
    let positionM = state.block.positionM;
    let velocityMps = state.block.velocityMps;
    let accelerationMps2 = 0;
    if (state.contact.mode === "static") {
      const staticResult = resolveStaticContact(state, tensionN, scenario);
      if (staticResult) {
        contact = staticResult;
      } else {
        const sliding = resolveSlidingContact(state, tensionN, scenario);
        const proposedVelocity = state.block.velocityMps + sliding.accelerationMps2 * dt;
        const restick = maybeRestick(state, tensionN, proposedVelocity, scenario);
        if (restick) contact = restick;
        else {
          contact = sliding;
          velocityMps = Math.max(0, proposedVelocity);
          positionM += velocityMps * dt;
          accelerationMps2 = sliding.accelerationMps2;
          const crossing = tensionN > limitN + FORCE_EPSILON_N && priorTension <= limitN + FORCE_EPSILON_N;
          if (crossing) {
            const denominator = tensionN - priorTension;
            const u = Math.abs(denominator) > FORCE_EPSILON_N ? clamp((limitN - priorTension) / denominator, 0, 1) : 1;
            // The event is the transition itself, not the end-of-step
            // tension.  Keep the raw event at the interpolated crossing so
            // the measurement layer can interpolate the sensor state at the
            // same timestamp.
            const transitionTensionN = clamp(priorTension + denominator * u, 0, tensionN);
            events.push({ type: "breakaway", timeS: state.timeS + u * dt, physicalTensionN: transitionTensionN, staticLimitN: limitN, transitionFraction: u });
          }
        }
      }
    } else {
      const sliding = resolveSlidingContact(state, tensionN, scenario);
      const proposedVelocity = state.block.velocityMps + sliding.accelerationMps2 * dt;
      const restick = maybeRestick(state, tensionN, proposedVelocity, scenario);
      if (restick) contact = restick;
      else {
        contact = sliding;
        velocityMps = Math.max(0, proposedVelocity);
        positionM += velocityMps * dt;
        accelerationMps2 = sliding.accelerationMps2;
      }
    }
    const nextExtensionM = connectorExtension(h.positionM, positionM, connector);
    const nextTensionN = connectorTension(h.positionM, positionM, h.velocityMps, contact.velocityMps ?? velocityMps, connector);
    const next = {
      timeS: state.timeS + dt,
      block: { positionM, velocityMps: contact.velocityMps ?? velocityMps, accelerationMps2: contact.accelerationMps2 ?? accelerationMps2 },
      handle: h,
      connector: { extensionM: nextExtensionM, tensionPhysicalN: nextTensionN },
      contact: { mode: contact.mode, frictionPhysicalN: contact.frictionN },
      events
    };
    if (![next.timeS, next.block.positionM, next.block.velocityMps, next.block.accelerationMps2, next.handle.positionM, next.connector.tensionPhysicalN].every(Number.isFinite)) throw new Error("non-finite physics state");
    return next;
  }
  function createInputQueue() { return { entries: [], lastTargetPositionM: null }; }
  function enqueueInput(queue, entry) {
    if (!queue || !Number.isFinite(entry?.timeS) || !Number.isFinite(entry?.handleTargetPositionM)) return false;
    queue.entries.push({ timeS: entry.timeS, handleTargetPositionM: entry.handleTargetPositionM, order: queue.entries.length });
    queue.entries.sort((a, b) => a.timeS - b.timeS || a.order - b.order);
    return true;
  }
  function inputAt(queue, timeS, fallback) {
    let target = queue.lastTargetPositionM ?? fallback;
    let consumed = 0;
    while (consumed < queue.entries.length && queue.entries[consumed].timeS <= timeS + 1e-12) {
      target = queue.entries[consumed].handleTargetPositionM;
      consumed += 1;
    }
    if (consumed) queue.entries.splice(0, consumed);
    queue.lastTargetPositionM = target;
    return { handleTargetPositionM: target };
  }
  function simulate(inputs, scenario, options = {}) {
    const dt = options.dt || PHYSICS_DT_S;
    const durationS = options.durationS ?? 12;
    const state = createInitialState(scenario);
    const queue = createInputQueue();
    (inputs || []).forEach((entry) => enqueueInput(queue, entry));
    let current = state;
    const states = [current];
    const events = [];
    const stalls = new Set((options.stallTimesS || []).map(Number));
    let abortedOnStall = false;
    while (current.timeS < durationS - dt / 2) {
      const input = inputAt(queue, current.timeS + dt, current.handle.targetPositionM);
      if (stalls.has(Number(current.timeS.toFixed(6)))) {
        abortedOnStall = true;
        break;
      }
      current = stepPhysics(current, input, scenario, dt);
      states.push(current);
      events.push(...current.events);
    }
    return { state: current, states, events, queue, abortedOnStall };
  }
  function runFixedStep(scenario, options = {}) {
    const queue = createInputQueue();
    (options.inputs || []).forEach((entry) => enqueueInput(queue, entry));
    let state = createInitialState(scenario);
    let accumulatorS = 0;
    let running = true;
    let abortedOnStall = false;
    function advanceFrame(frameDurationMs) {
      const rawFrameDurationS = Math.max(0, Number(frameDurationMs) || 0) / 1000;
      if (rawFrameDurationS > 0.05) {
        accumulatorS = 0;
        if (running) { running = false; abortedOnStall = true; }
        return { state, running, abortedOnStall, steps: 0 };
      }
      accumulatorS += rawFrameDurationS;
      let steps = 0;
      const advancedStates = [];
      while (running && accumulatorS >= PHYSICS_DT_S) {
        const input = inputAt(queue, state.timeS + PHYSICS_DT_S, state.handle.targetPositionM);
        state = stepPhysics(state, input, scenario, PHYSICS_DT_S);
        accumulatorS -= PHYSICS_DT_S;
        steps += 1;
        advancedStates.push(state);
      }
      return { state, running, abortedOnStall, steps, states: advancedStates };
    }
    return { getState: () => state, getRunning: () => running, advanceFrame, queue };
  }
  function simulateRenderSchedule(inputs, scenario, frameDurationsMs, options = {}) {
    const queue = createInputQueue();
    (inputs || []).forEach((entry) => enqueueInput(queue, entry));
    let current = createInitialState(scenario);
    let accumulator = 0;
    let abortedOnStall = false;
    const samples = [];
    const events = [];
    for (const durationMs of frameDurationsMs) {
      const raw = Math.max(0, Number(durationMs) || 0) / 1000;
      if (raw > 0.05) { accumulator = 0; abortedOnStall = true; if (options.abortOnStall !== false) break; continue; }
      accumulator += Math.max(0, raw);
      while (accumulator >= PHYSICS_DT_S) {
        const input = inputAt(queue, current.timeS + PHYSICS_DT_S, current.handle.targetPositionM);
        current = stepPhysics(current, input, scenario, PHYSICS_DT_S);
        events.push(...current.events);
        accumulator -= PHYSICS_DT_S;
      }
      samples.push(current);
    }
    return { state: current, samples, events, abortedOnStall };
  }
  return Object.freeze({
    PHYSICS_DT_S, HANDLE_OMEGA, HANDLE_ZETA, HANDLE_SPEED_LIMIT_MPS, V_STICK_MPS,
    smoothstep, createInitialState, stepHandle, connectorTension, connectorExtension,
    splitAtRestLengthCrossing, staticLimitAt, kineticFrictionAt, resolveStaticContact,
    resolveSlidingContact, maybeRestick, predictedBlockPosition, stepPhysics, createInputQueue, enqueueInput,
    inputAt, simulate, runFixedStep, simulateRenderSchedule
  });
});
