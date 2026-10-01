(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.MotionCompositionModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MotionCompositionAnimation = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const SLOWDOWN = 4, DURATION_MS = 4 * M.DT * 1000 * SLOWDOWN;
  function createController(options = {}) {
    const clock = options.clock || { now: () => performance.now(), request: fn => requestAnimationFrame(fn), cancel: id => cancelAnimationFrame(id) };
    let token = 0, frame = null, active = false, view = { kind: "idle", time: null, stamps: 0, active: false };
    const publish = next => { view = Object.freeze(next); options.onUpdate?.(view); };
    function cancel() {
      token++; active = false;
      if (frame !== null) clock.cancel(frame);
      frame = null; publish({ kind: "idle", time: null, stamps: 0, active: false });
    }
    function start(kind, reducedMotion = false) {
      if (!["capture", "replay", "preview"].includes(kind)) throw new Error("Invalid animation kind");
      cancel(); active = true;
      const run = token, started = clock.now();
      publish({ kind, time: 0, stamps: 0, active: true });
      function tick() {
        frame = null;
        if (run !== token) return;
        const elapsed = Math.min(DURATION_MS, Math.max(0, clock.now() - started)), logical = elapsed / (1000 * SLOWDOWN);
        const stamps = Math.min(4, Math.floor((logical + 1e-10) / M.DT));
        const complete = elapsed >= DURATION_MS;
        active = !complete;
        publish({ kind, time: reducedMotion ? stamps * M.DT : logical, stamps: kind === "preview" ? 0 : stamps, active });
        if (complete) options.onComplete?.(view);
        else if (run === token) frame = clock.request(tick);
      }
      frame = clock.request(tick);
    }
    return Object.freeze({ start, cancel, snapshot: () => ({ ...view }), isActive: () => active });
  }
  return Object.freeze({ SLOWDOWN, DURATION_MS, createController });
});
