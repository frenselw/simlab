(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.FreeFallModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FreeFallAnimation = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";

  const PREVIEW_DURATION_MS = 1000;

  function browserClock() {
    return {
      now: () => performance.now(),
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id)
    };
  }

  function createController(options = {}) {
    const clock = options.clock || browserClock();
    const onUpdate = typeof options.onUpdate === "function" ? options.onUpdate : () => {};
    const onStamp = typeof options.onStamp === "function" ? options.onStamp : () => {};
    const onComplete = typeof options.onComplete === "function" ? options.onComplete : () => {};
    let token = 0;
    let frameId = null;
    let active = false;
    let view = Object.freeze({ mode: "idle", liveBallM: null, stamps: [] });

    function publish(next) {
      view = Object.freeze({ ...next, stamps: Object.freeze([...(next.stamps || [])]) });
      onUpdate(view);
    }
    function invalidate(nextMode = "idle") {
      token += 1;
      active = false;
      if (frameId !== null) clock.cancelFrame(frameId);
      frameId = null;
      publish({ mode: nextMode, liveBallM: null, stamps: [] });
    }
    function schedule(runToken, callback) {
      frameId = clock.requestFrame(() => {
        frameId = null;
        if (runToken !== token) return;
        callback();
      });
    }
    function startPreview({ reducedMotion = false } = {}) {
      invalidate();
      const runToken = token;
      if (reducedMotion) {
        publish({ mode: "preview-reduced", liveBallM: null, stamps: [], startM: 0, endM: Model.freeFallDisplacement(1) });
        return true;
      }
      active = true;
      const startedAt = clock.now();
      publish({ mode: "preview", liveBallM: 0, elapsedS: 0, stamps: [] });
      function tick() {
        const elapsedS = Math.min(PREVIEW_DURATION_MS, Math.max(0, clock.now() - startedAt)) / 1000;
        const complete = elapsedS >= 1;
        publish({
          mode: complete ? "preview-complete" : "preview",
          liveBallM: Model.freeFallDisplacement(elapsedS), elapsedS, stamps: []
        });
        if (complete) {
          active = false;
          onComplete(view);
        } else schedule(runToken, tick);
      }
      schedule(runToken, tick);
      return true;
    }
    function showPreviewStatic() {
      invalidate();
      publish({ mode: "preview-static", liveBallM: null, stamps: [], startM: 0, endM: Model.freeFallDisplacement(1) });
      return true;
    }
    function startCapture(frequencyHz, { reducedMotion = false } = {}) {
      if (!Model.validFrequency(frequencyHz) || active && view.mode === "capture") return false;
      invalidate();
      const runToken = token;
      const points = Model.trajectory(frequencyHz);
      const stamps = [];
      function addStamp(index) {
        if (stamps.some((stamp) => stamp.index === index)) return;
        const point = points[index];
        const stamp = Object.freeze({ index, timeS: point.timeS, displacementM: point.displacementM });
        stamps.push(stamp);
        onStamp(stamp);
      }
      if (reducedMotion) {
        points.forEach((point) => addStamp(point.index));
        publish({ mode: "static", frequencyHz, liveBallM: null, elapsedS: points[4].timeS, stamps });
        onComplete(view);
        return true;
      }
      active = true;
      const startedAt = clock.now();
      addStamp(0);
      publish({ mode: "capture", frequencyHz, liveBallM: 0, elapsedS: 0, stamps });
      function tick() {
        const elapsedS = Math.max(0, clock.now() - startedAt) / 1000;
        const lastTime = points[4].timeS;
        const logicalTime = Math.min(elapsedS, lastTime);
        for (let index = 1; index < points.length && points[index].timeS <= logicalTime + 1e-12; index += 1) addStamp(index);
        if (logicalTime >= lastTime) {
          active = false;
          publish({ mode: "static", frequencyHz, liveBallM: null, elapsedS: lastTime, stamps });
          onComplete(view);
          return;
        }
        publish({
          mode: "capture", frequencyHz, liveBallM: Model.freeFallDisplacement(logicalTime),
          elapsedS: logicalTime, stamps
        });
        schedule(runToken, tick);
      }
      schedule(runToken, tick);
      return true;
    }
    function showStatic(frequencyHz) {
      if (!Model.validFrequency(frequencyHz)) return false;
      invalidate();
      const points = Model.trajectory(frequencyHz);
      publish({
        mode: "static", frequencyHz, liveBallM: null, elapsedS: points[4].timeS,
        stamps: points.map(({ index, timeS, displacementM }) => Object.freeze({ index, timeS, displacementM }))
      });
      return true;
    }

    return {
      startPreview, showPreviewStatic, startCapture, showStatic, cancel: invalidate,
      snapshot: () => ({ ...view, stamps: view.stamps.map((stamp) => ({ ...stamp })) }),
      isActive: () => active
    };
  }

  return { PREVIEW_DURATION_MS, createController };
});
