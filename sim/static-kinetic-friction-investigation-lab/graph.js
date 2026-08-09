(function (root, factory) {
  const M = root.StaticKineticFrictionMeasurement || (typeof module === "object" && module.exports ? require("./measurement.js") : null);
  const api = factory(M);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionGraph = api;
})(typeof window !== "undefined" ? window : globalThis, function (Measurement) {
  "use strict";

  const GRAPH = Object.freeze({ left: 60, top: 30, width: 700, height: 330, gap: 0, velocityHeight: 0, maxTimeS: 30, maxForceN: 12, maxVelocityMps: 0.35 });
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function traceData(trace) { return trace?.merged ? trace : Measurement.unpackTrace(trace); }
  function timeToX(timeS, config = GRAPH) { return config.left + clamp(timeS, 0, config.maxTimeS) / config.maxTimeS * config.width; }
  function forceToY(forceN, config = GRAPH) { return config.top + config.height - clamp(forceN, 0, config.maxForceN) / config.maxForceN * config.height; }
  function velocityToY(velocityMps, config = GRAPH) { return config.top + config.height + config.gap + config.velocityHeight - clamp(velocityMps, 0, config.maxVelocityMps) / config.maxVelocityMps * config.velocityHeight; }
  function pointForSample(sample, kind = "force", config = GRAPH) {
    return { x: timeToX(sample.timeS, config), y: kind === "velocity" ? velocityToY(sample.measuredVelocityMps, config) : forceToY(sample.measuredPullN, config) };
  }
  function svgPath(trace, kind = "force", config = GRAPH) {
    const samples = traceData(trace).merged;
    return samples.map((sample, index) => { const point = pointForSample(sample, kind, config); return `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`; }).join(" ");
  }
  function canonicalIndexAtTime(trace, timeS) {
    const samples = traceData(trace).merged;
    if (!samples.length) return 0;
    let best = 0;
    for (let i = 1; i < samples.length; i += 1) if (Math.abs(samples[i].timeS - timeS) < Math.abs(samples[best].timeS - timeS)) best = i;
    return best;
  }
  function normalizeSelection(trace, startIndex, endIndex, minimumSamples = 2) {
    const length = traceData(trace).merged.length;
    let start = clamp(Math.round(startIndex), 0, Math.max(0, length - 1));
    let end = clamp(Math.round(endIndex), 0, Math.max(0, length - 1));
    if (end < start) [start, end] = [end, start];
    if (end - start + 1 < minimumSamples) end = Math.min(length - 1, start + minimumSamples - 1);
    if (end - start + 1 < minimumSamples) start = Math.max(0, end - minimumSamples + 1);
    return { startIndex: start, endIndex: end };
  }
  function selectionStats(trace, selection) { return Measurement.intervalStats(traceData(trace), selection.startIndex, selection.endIndex); }
  function intervalIoU(a, b, trace = null) {
    if (!a || !b) return 0;
    if (trace) {
      const samples = traceData(trace).merged;
      const aStart = samples[a.startIndex]?.timeS, aEnd = samples[a.endIndex]?.timeS;
      const bStart = samples[b.startIndex]?.timeS, bEnd = samples[b.endIndex]?.timeS;
      if ([aStart, aEnd, bStart, bEnd].every(Number.isFinite)) {
        const intersection = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
        const union = Math.max(aEnd, bEnd) - Math.min(aStart, bStart);
        return union > 0 ? intersection / union : 0;
      }
    }
    const left = Math.max(a.startIndex, b.startIndex);
    const right = Math.min(a.endIndex, b.endIndex);
    const intersection = Math.max(0, right - left + 1);
    const union = Math.max(a.endIndex, b.endIndex) - Math.min(a.startIndex, b.startIndex) + 1;
    return union ? intersection / union : 0;
  }
  function bestCandidateIoU(selection, candidates = [], trace = null) { return candidates.reduce((best, candidate) => Math.max(best, intervalIoU(selection, candidate, trace)), 0); }
  function intervalLabel(trace, selection, label) {
    const stats = selectionStats(trace, selection);
    if (!stats) return `${label}，未選取有效區段`;
    return `${label}，${stats.startTimeS.toFixed(2)} 至 ${stats.endTimeS.toFixed(2)} 秒，平均拉力 ${stats.meanPullN.toFixed(2)} 牛頓`;
  }
  function createSelectionSet(trace) {
    const max = Math.max(0, traceData(trace).merged.length - 1);
    return {
      staticInterval: { startIndex: 0, endIndex: Math.min(max, 20) },
      breakaway: { markerIndex: Math.min(max, 30), estimatedFsMaxCN: null, identifiedAs: null },
      slowPlateau: { startIndex: Math.min(max, 50), endIndex: Math.min(max, 80), estimatedFkCN: null },
      acceleration: { startIndex: Math.min(max, 90), endIndex: Math.min(max, 120), relation: null, pullEqualsFk: null },
      fastPlateau: { startIndex: Math.min(max, 140), endIndex: Math.min(max, 170), estimatedFkCN: null, speedComparison: null }
    };
  }
  function renderSvgPaths(document, container, trace, config = GRAPH) {
    if (!document || !container) return null;
    const ns = "http://www.w3.org/2000/svg";
    const root = document.createElementNS(ns, "g");
    const force = document.createElementNS(ns, "path"); force.setAttribute("d", svgPath(trace, "force", config)); force.setAttribute("class", "force-line"); force.setAttribute("aria-label", "測力計讀數（拉力） F拉—時間 t");
    root.append(force); container.append(root); return root;
  }
  return Object.freeze({ GRAPH, timeToX, forceToY, velocityToY, pointForSample, svgPath, canonicalIndexAtTime, normalizeSelection, selectionStats, intervalIoU, bestCandidateIoU, intervalLabel, createSelectionSet, renderSvgPaths });
});
