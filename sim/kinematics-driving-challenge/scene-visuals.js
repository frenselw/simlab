(function (root, factory) {
  const levels = typeof module === "object" && module.exports ? require("./level-definitions.js") : root.KinematicsDrivingLevels;
  const api = factory(levels);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingVisuals = api;
})(typeof window !== "undefined" ? window : globalThis, function (Levels) {
  "use strict";

  const BACKGROUND_LAYERS = Object.freeze({
    far: Object.freeze({ spacing: 15, parallax: 0.7, salt: 0x4f1bbcdc }),
    roadside: Object.freeze({ spacing: 9, parallax: 1, salt: 0x68bc21eb })
  });

  function positiveModulo(value, divisor) { return ((value % divisor) + divisor) % divisor; }
  function roadY(position, level, baseY, pixelsPerMetre) {
    const first = level.segments[0];
    const last = level.segments[level.segments.length - 1];
    if (position < first.start) {
      return baseY - (position - first.start) * Math.sin(first.slopeDeg * Math.PI / 180) * pixelsPerMetre;
    }
    let elevation = 0;
    for (const segment of level.segments) {
      const span = Math.max(0, Math.min(position, segment.end) - segment.start);
      elevation += span * Math.sin(segment.slopeDeg * Math.PI / 180);
      if (position <= segment.end) break;
    }
    if (position > last.end) {
      elevation += (position - last.end) * Math.sin(last.slopeDeg * Math.PI / 180);
    }
    return baseY - elevation * pixelsPerMetre;
  }
  function worldToScreen(worldPosition, cameraPosition, anchorX, pixelsPerMetre) {
    return anchorX + (worldPosition - cameraPosition) * pixelsPerMetre;
  }
  function graphWindow(samples, cursorTime, duration = Levels.GRAPH_TIME_SPAN_S) {
    if (!samples?.length || !Number.isFinite(cursorTime) || !(duration > 0)) {
      return { samples: [], startTime: 0, endTime: 0, duration };
    }
    const firstTime = samples[0].t;
    const lastTime = samples[samples.length - 1].t;
    const endTime = Math.max(firstTime, Math.min(lastTime, cursorTime));
    const elapsed = Math.max(0, endTime - firstTime);
    const scaleSteps = elapsed <= duration ? 0 : Math.ceil(Math.log2(elapsed / duration));
    const expandedDuration = duration * 2 ** scaleSteps;
    const visible = samples.filter((sample) => sample.t <= endTime + 1e-9);
    return { samples: visible, startTime: firstTime, endTime, duration: expandedDuration };
  }
  function graphPoints(samples, mode, rect, zone, windowStart = samples?.[0]?.t || 0) {
    if (!samples?.length) return [];
    const duration = Math.max(0.001, zone?.graphTimeSpan || Levels.GRAPH_TIME_SPAN_S);
    const x0 = Number.isFinite(zone?.start) ? zone.start : samples[0].x;
    const xSpan = Math.max(1, zone?.end - zone?.start || samples[samples.length - 1].x - x0);
    const vSpan = zone?.graphVelocitySpan || Levels.GRAPH_VELOCITY_SPAN;
    return samples.map((sample) => ({
      x: Math.max(rect.x, Math.min(rect.x + rect.width, rect.x + (sample.t - windowStart) / duration * rect.width)),
      y: mode === "xt"
        ? rect.y + rect.height - (sample.x - x0) / xSpan * rect.height
        : rect.y + rect.height - sample.v / vSpan * rect.height
    }));
  }
  function mixHash(value) {
    let hash = Math.imul(value ^ value >>> 16, 0x45d9f3b);
    hash = Math.imul(hash ^ hash >>> 16, 0x45d9f3b);
    return (hash ^ hash >>> 16) >>> 0;
  }
  function hashCell(layer, cellId, seed = 0) {
    const config = BACKGROUND_LAYERS[layer];
    if (!config || !Number.isSafeInteger(cellId) || !Number.isSafeInteger(seed)) throw new TypeError("Invalid background cell");
    const low = cellId >>> 0;
    const high = Math.floor(cellId / 0x100000000) >>> 0;
    return mixHash(mixHash(low ^ config.salt ^ seed) ^ high);
  }
  function backgroundAppearance(layer, cellId, seed = 0) {
    const hash = hashCell(layer, cellId, seed);
    const variant = (hash >>> 7) % 4;
    const offset = ((hash >>> 12) % 61 - 30) / 100;
    if (layer === "far") {
      const choice = hash % 10;
      if (choice === 0) return { type: "empty", offset };
      if (choice <= 2) return { type: "house", width: 42 + (hash >>> 3) % 15, height: 36 + (hash >>> 9) % 13, variant, offset };
      if (choice <= 4) return { type: "shop", width: 50 + (hash >>> 3) % 17, height: 38 + (hash >>> 9) % 12, variant, offset };
      if (choice <= 7) return { type: "apartment", width: 44 + (hash >>> 3) % 18, height: 64 + (hash >>> 9) % 35, variant, offset };
      return { type: "treeCluster", width: 52 + (hash >>> 3) % 20, height: 43 + (hash >>> 9) % 15, variant, offset };
    }
    const choice = hash % 12;
    if (choice <= 1) return { type: "empty", offset };
    if (choice <= 4) return { type: "tree", width: 38 + (hash >>> 3) % 15, height: 60 + (hash >>> 9) % 26, variant, offset };
    if (choice <= 6) return { type: "shrubs", width: 48 + (hash >>> 3) % 21, height: 22 + (hash >>> 9) % 10, variant, offset };
    if (choice <= 8) return { type: "lamp", width: 22, height: 67 + (hash >>> 9) % 16, variant, offset };
    if (choice === 9) return { type: "sign", width: 27 + (hash >>> 3) % 8, height: 48 + (hash >>> 9) % 10, variant, offset };
    return { type: "treeShrubs", width: 62 + (hash >>> 3) % 18, height: 61 + (hash >>> 9) % 22, variant, offset };
  }
  function visibleBackgroundCells(layer, worldPosition, pixelsPerMetre, viewportWidth, bufferPixels = 110) {
    const config = BACKGROUND_LAYERS[layer];
    if (!config || ![worldPosition, pixelsPerMetre, viewportWidth, bufferPixels].every(Number.isFinite) ||
        pixelsPerMetre <= 0 || viewportWidth <= 0 || bufferPixels < 0) throw new TypeError("Invalid background viewport");
    const effectiveScale = pixelsPerMetre * config.parallax;
    const halfSpan = (viewportWidth / 2 + bufferPixels) / effectiveScale;
    const first = Math.floor((worldPosition - halfSpan) / config.spacing);
    const last = Math.ceil((worldPosition + halfSpan) / config.spacing);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }
  function slopeAt(level, position) { return Levels.segmentAt(level, position)?.slopeDeg || 0; }
  function boundaryMarkers(level) {
    if (!level?.segments) return [];
    return level.segments.slice(1).map((segment) => ({
      position: segment.start,
      target: segment.target,
      kind: segment.target === "transition" ? "prepare" : "start"
    }));
  }
  function visualSlopeAt(level, position, blendDistance = 2) {
    const current = Levels.segmentAt(level, position);
    if (!current || !(blendDistance > 0)) return current?.slopeDeg || 0;
    const index = level.segments.indexOf(current);
    const previous = level.segments[index - 1];
    const next = level.segments[index + 1];
    if (previous && position - current.start < blendDistance) {
      const ratio = (position - current.start + blendDistance) / (blendDistance * 2);
      return previous.slopeDeg + (current.slopeDeg - previous.slopeDeg) * Math.max(0, Math.min(1, ratio));
    }
    if (next && current.end - position < blendDistance) {
      const ratio = (position - (current.end - blendDistance)) / (blendDistance * 2);
      return current.slopeDeg + (next.slopeDeg - current.slopeDeg) * Math.max(0, Math.min(1, ratio));
    }
    return current.slopeDeg;
  }
  function targetLabel(target) {
    return {
      uniform: "保持勻速", accelerating: "保持勻加速", decelerating: "保持勻減速",
      transition: "調整路段", practice: "自由練習"
    }[target] || "";
  }
  function graphShapeLabel(samples) {
    if (!samples || samples.length < 12) return "資料尚不足";
    const first = samples[0].v;
    const last = samples[samples.length - 1].v;
    const delta = last - first;
    if (Math.abs(delta) < 0.15) return "圖線接近水平";
    const half = Math.floor(samples.length / 2);
    const d1 = samples[half].v - first;
    const d2 = last - samples[half].v;
    const straight = Math.abs(d1 - d2) < Math.max(0.18, Math.abs(delta) * 0.22);
    return delta > 0
      ? (straight ? "圖線接近向上直線" : "圖線大致向上，但斜率有變化")
      : (straight ? "圖線接近向下直線" : "圖線大致向下，但斜率有變化");
  }

  return {
    BACKGROUND_LAYERS, positiveModulo, roadY, worldToScreen, graphWindow, graphPoints,
    backgroundAppearance, visibleBackgroundCells, slopeAt, boundaryMarkers, visualSlopeAt, targetLabel, graphShapeLabel
  };
});
