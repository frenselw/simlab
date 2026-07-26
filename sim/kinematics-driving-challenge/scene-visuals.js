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
      target: segment.target
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
  function stageTargetLabel(level, segment) {
    if (!segment) return "";
    return targetLabel(segment.target);
  }
  function graphShapeLabel(samples, mode = "vt") {
    if (!samples || samples.length < 12) return "資料尚不足";
    const rows = samples.map((sample, index) => ({
      t: Number.isFinite(sample.t) ? sample.t : index,
      v: sample.v
    })).filter((sample) => Number.isFinite(sample.t) && Number.isFinite(sample.v));
    if (rows.length < 12) return "資料尚不足";
    const t0 = rows[0].t;
    const relative = rows.map((sample) => ({ t: sample.t - t0, v: sample.v }));
    const meanT = relative.reduce((sum, sample) => sum + sample.t, 0) / relative.length;
    const meanV = relative.reduce((sum, sample) => sum + sample.v, 0) / relative.length;
    const denominator = relative.reduce((sum, sample) => sum + (sample.t - meanT) ** 2, 0);
    if (!(denominator > 0)) return "資料尚不足";
    const slope = relative.reduce((sum, sample) =>
      sum + (sample.t - meanT) * (sample.v - meanV), 0) / denominator;
    const intercept = meanV - slope * meanT;
    const rmse = Math.sqrt(relative.reduce((sum, sample) =>
      sum + (sample.v - (intercept + slope * sample.t)) ** 2, 0) / relative.length);
    const duration = relative[relative.length - 1].t;
    const fittedChange = slope * duration;
    const speedRange = Math.max(...relative.map((sample) => sample.v)) -
      Math.min(...relative.map((sample) => sample.v));
    if (mode === "xt") {
      if (Math.abs(fittedChange) < 0.15) {
        return speedRange < 0.3 && rmse < 0.1
          ? "x–t 圖接近斜直線，斜率大致固定"
          : "x–t 圖斜率有明顯變化";
      }
      if (slope > 0) {
        return rmse / Levels.GRAPH_VELOCITY_SPAN <= 0.0015
          ? "x–t 圖愈來愈斜，斜率逐漸增加"
          : "x–t 圖整體愈來愈斜，但斜率變化不規則";
      }
      return rmse / Levels.GRAPH_VELOCITY_SPAN <= 0.0015
        ? "x–t 圖逐漸變平，斜率逐漸減少"
        : "x–t 圖整體逐漸變平，但斜率變化不規則";
    }
    if (Math.abs(fittedChange) < 0.15) {
      return speedRange < 0.3 && rmse < 0.1 ? "圖線接近水平" : "圖線有明顯起伏，斜率不固定";
    }
    const straight = rmse / Levels.GRAPH_VELOCITY_SPAN <= 0.0015;
    return slope > 0
      ? (straight ? "圖線接近向上直線" : "圖線大致向上，但斜率有變化")
      : (straight ? "圖線接近向下直線" : "圖線大致向下，但斜率有變化");
  }

  return {
    BACKGROUND_LAYERS, positiveModulo, roadY, worldToScreen, graphWindow, graphPoints,
    backgroundAppearance, visibleBackgroundCells, slopeAt, boundaryMarkers, visualSlopeAt,
    targetLabel, stageTargetLabel, graphShapeLabel
  };
});
