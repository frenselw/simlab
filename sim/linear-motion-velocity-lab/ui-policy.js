(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./motion-model.js") : root.LinearMotionModel;
  const flow = typeof module === "object" && module.exports ? require("../shared/activity-flow.js") : root.SimActivityFlow;
  const api = factory(model, flow);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LinearMotionUiPolicy = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, Flow) {
  "use strict";

  const graphCache = new WeakMap();

  function canRevealSolution({ locked, trustedReview, result }) {
    return locked === true && trustedReview === true && result != null;
  }

  function reviewOutcome(computed, saved, recorded) {
    return Flow.reviewResult(computed, saved, recorded);
  }

  function stageReadingOrigin(definition, phase) {
    return phase === "uniform" ? definition.uniform.coordinateOrigin : definition.variable.coordinateOrigin;
  }

  function displayedPosition(definition, phase, worldPosition, measurement = null) {
    return Model.readingPosition(worldPosition, measurement?.readingOrigin ?? stageReadingOrigin(definition, phase));
  }

  function analysisRows(definition) {
    return graphAnalysis(definition).displayRows;
  }

  function graphAnalysis(definition) {
    if (graphCache.has(definition)) return graphCache.get(definition);
    const target = Model.targetSceneTime(definition);
    const t0 = target - 2.25;
    const t1 = target + 0.35;
    const points = Object.freeze(Array.from({ length: 90 }, (_, index) => Object.freeze({
      t: t0 + (t1 - t0) * index / 89,
      x: Model.variablePosition(definition.variable, t0 + (t1 - t0) * index / 89)
    })));
    const analysis = Object.freeze({
      geometry: Object.freeze(Model.analysisWindowGeometry(definition).map((row) => Object.freeze(row))),
      displayRows: Object.freeze(Model.analysisWindows(definition).map((row) => Object.freeze(row))),
      points,
      target,
      t0,
      t1,
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x))
    });
    graphCache.set(definition, analysis);
    return analysis;
  }

  function appendPredictionOptions(container, options, document) {
    if (container.children.length) return;
    options.forEach((option) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "prediction";
      input.value = option.id;
      input.setAttribute("aria-label", `${Model.format3(option.value)} 米每秒`);
      label.append(input, document.createTextNode(" "));
      const quantity = document.createElement("span");
      quantity.className = "math-quantity";
      const number = document.createElement("span");
      number.className = "math-number";
      number.textContent = Model.format3(option.value);
      const unit = document.createElement("span");
      unit.className = "unit";
      unit.textContent = "m/s";
      quantity.append(number, document.createTextNode(" "), unit);
      label.append(quantity);
      container.append(label);
    });
  }

  function isLegacySnapshot(answer, currentVersion) {
    return Number.isInteger(answer?.v) && answer.v < currentVersion;
  }

  return { canRevealSolution, reviewOutcome, stageReadingOrigin, displayedPosition, analysisRows, graphAnalysis, appendPredictionOptions, isLegacySnapshot };
});
