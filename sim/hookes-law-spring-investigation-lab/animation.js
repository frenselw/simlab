(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HookesLawAnimation = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VISUAL_OMEGA = 8;
  const VISUAL_ZETA = 0.32;
  const SETTLE_POSITION_EPS_M = 0.0002;
  const SETTLE_SPEED_EPS_M_PER_S = 0.001;

  function stepDamped(x, velocity, equilibrium, dt, options = {}) {
    const omega = options.omega ?? VISUAL_OMEGA;
    const zeta = options.zeta ?? VISUAL_ZETA;
    const elapsed = Math.max(0, Math.min(0.05, Number(dt) || 0));
    const acceleration = omega * omega * (equilibrium - x) - 2 * zeta * omega * velocity;
    const nextVelocity = velocity + acceleration * elapsed;
    const nextX = x + nextVelocity * elapsed;
    return { x: nextX, velocity: nextVelocity };
  }

  function createAnimator(options = {}) {
    const requestFrame = options.requestFrame || ((callback) => requestAnimationFrame(callback));
    const cancelFrame = options.cancelFrame || ((handle) => cancelAnimationFrame(handle));
    const now = options.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const reducedMotion = options.reducedMotion || (() => false);
    let token = 0;
    let frameHandle = null;
    let state = { x: 0, velocity: 0, equilibrium: 0, settled: true, token: 0 };

    function cancel() {
      token += 1;
      if (frameHandle !== null) cancelFrame(frameHandle);
      frameHandle = null;
      state = { ...state, settled: true, token };
      return token;
    }

    function start({ from, equilibrium, onFrame = () => {}, onSettled = () => {} }) {
      cancel();
      const currentToken = token;
      let x = Number(from);
      let velocity = 0;
      const target = Number(equilibrium);
      if (!Number.isFinite(x) || !Number.isFinite(target)) throw new Error("Animation requires finite positions");
      state = { x, velocity, equilibrium: target, settled: false, token: currentToken };
      if (reducedMotion()) {
        x = target;
        velocity = 0;
        state = { x, velocity, equilibrium: target, settled: true, token: currentToken };
        onFrame(x, state);
        onSettled(state);
        return currentToken;
      }
      let previous = now();
      const frame = (timestamp) => {
        if (currentToken !== token) return;
        const dt = Math.max(0, Math.min(0.05, (Number(timestamp) - previous) / 1000));
        previous = Number(timestamp);
        const stepped = stepDamped(x, velocity, target, dt);
        x = stepped.x;
        velocity = stepped.velocity;
        if (Math.abs(x - target) <= SETTLE_POSITION_EPS_M && Math.abs(velocity) <= SETTLE_SPEED_EPS_M_PER_S) {
          x = target;
          velocity = 0;
          state = { x, velocity, equilibrium: target, settled: true, token: currentToken };
          onFrame(x, state);
          frameHandle = null;
          onSettled(state);
          return;
        }
        state = { x, velocity, equilibrium: target, settled: false, token: currentToken };
        onFrame(x, state);
        frameHandle = requestFrame(frame);
      };
      frameHandle = requestFrame(frame);
      return currentToken;
    }

    return { start, cancel, getState: () => ({ ...state }), isCurrent: (candidate) => candidate === token, constants: { VISUAL_OMEGA, VISUAL_ZETA, SETTLE_POSITION_EPS_M, SETTLE_SPEED_EPS_M_PER_S } };
  }

  return { VISUAL_OMEGA, VISUAL_ZETA, SETTLE_POSITION_EPS_M, SETTLE_SPEED_EPS_M_PER_S, stepDamped, createAnimator };
});
