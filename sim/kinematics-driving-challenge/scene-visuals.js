(function (root, factory) {
  const levels = typeof module === "object" && module.exports ? require("./level-definitions.js") : root.KinematicsDrivingLevels;
  const api = factory(levels);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingVisuals = api;
})(typeof window !== "undefined" ? window : globalThis, function (Levels) {
  "use strict";

  function roadY(position, level, baseY, pixelsPerMetre) {
    let elevation = 0;
    for (const segment of level.segments) {
      const span = Math.max(0, Math.min(position, segment.end) - segment.start);
      elevation += span * Math.sin(segment.slopeDeg * Math.PI / 180);
      if (position <= segment.end) break;
    }
    return baseY - elevation * pixelsPerMetre;
  }
  function worldToScreen(worldPosition, cameraPosition, anchorX, pixelsPerMetre) {
    return anchorX + (worldPosition - cameraPosition) * pixelsPerMetre;
  }
  function graphPoints(samples, mode, rect, zone) {
    if (!samples?.length) return [];
    const t0 = samples[0].t;
    const duration = Math.max(0.001, zone?.graphTimeSpan || Levels.GRAPH_TIME_SPAN_S);
    const x0 = samples[0].x;
    const xSpan = Math.max(1, zone?.end - zone?.start || samples[samples.length - 1].x - x0);
    const vSpan = zone?.graphVelocitySpan || Levels.GRAPH_VELOCITY_SPAN;
    return samples.map((sample) => ({
      x: rect.x + (sample.t - t0) / duration * rect.width,
      y: mode === "xt"
        ? rect.y + rect.height - (sample.x - x0) / xSpan * rect.height
        : rect.y + rect.height - sample.v / vSpan * rect.height
    }));
  }
  function sceneryCell(index, seed = 17) {
    const value = Math.abs(Math.sin((index + seed) * 12.9898) * 43758.5453) % 1;
    return {
      kind: value < 0.36 ? "tree" : value < 0.7 ? "building" : "lamp",
      height: 0.55 + value * 0.45,
      hue: value < 0.5 ? "#94a3b8" : "#a9c994"
    };
  }
  function slopeAt(level, position) { return Levels.segmentAt(level, position)?.slopeDeg || 0; }
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

  return { roadY, worldToScreen, graphPoints, sceneryCell, slopeAt, visualSlopeAt, targetLabel, graphShapeLabel };
});
