(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.createAnimationLoop = factory;
})(typeof window !== "undefined" ? window : globalThis, function createAnimationLoop(options) {
  let pending = null;
  let lastFrame = 0;

  function tick(now) {
    pending = null;
    const elapsed = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (options.onFrame(elapsed)) pending = options.requestFrame(tick);
  }

  return {
    start() {
      if (pending != null) return;
      lastFrame = options.now();
      pending = options.requestFrame(tick);
    },
    stop() {
      if (pending == null) return;
      options.cancelFrame(pending);
      pending = null;
    },
    isRunning: () => pending != null
  };
});
