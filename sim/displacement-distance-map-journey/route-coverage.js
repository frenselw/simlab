(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MapRouteCoverage = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const EPSILON = 0.001;

  function addInterval(coverage, edgeId, from, to) {
    const start = clamp(Math.min(from, to), 0, 1);
    const end = clamp(Math.max(from, to), 0, 1);
    if (!Number.isInteger(edgeId) || end - start <= EPSILON) return coverage;
    const next = coverage.concat({ edgeId, start, end })
      .sort((a, b) => a.edgeId - b.edgeId || a.start - b.start);
    const merged = [];
    next.forEach((interval) => {
      const previous = merged[merged.length - 1];
      if (previous && previous.edgeId === interval.edgeId && interval.start <= previous.end + EPSILON) {
        previous.end = Math.max(previous.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    });
    return merged;
  }

  function addPath(coverage, edges, points) {
    let result = coverage.slice();
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const match = edges.map((edge) => ({
        edge,
        from: project(from, edge),
        to: project(to, edge)
      })).find((item) => item.from.distance <= EPSILON && item.to.distance <= EPSILON);
      if (match) result = addInterval(result, match.edge.id, match.from.t, match.to.t);
    }
    return result;
  }

  function compact(coverage) {
    return coverage.map(({ edgeId, start, end }) => [edgeId, round3(start), round3(end)]);
  }

  function expand(value, edges) {
    if (!Array.isArray(value)) return null;
    let result = [];
    for (const item of value) {
      if (!Array.isArray(item) || item.length !== 3 || !item.every(Number.isFinite)) return null;
      const [edgeId, start, end] = item;
      if (!Number.isInteger(edgeId) || !edges.some((edge) => edge.id === edgeId) || start < 0 || start > end || end > 1) return null;
      result = addInterval(result, edgeId, start, end);
    }
    return result;
  }

  function intervalPoints(interval, edgeById) {
    const edge = edgeById[interval.edgeId];
    if (!edge) return null;
    return [pointAt(edge, interval.start), pointAt(edge, interval.end)];
  }

  function fromLegacyTrace(trace, edges, pathBetween) {
    if (!Array.isArray(trace) || typeof pathBetween !== "function") return [];
    let result = [];
    for (let index = 1; index < trace.length; index += 1) {
      const points = pathBetween(trace[index - 1], trace[index]);
      if (Array.isArray(points)) result = addPath(result, edges, points);
    }
    return result;
  }

  function project(point, edge) {
    const dx = edge.b.x - edge.a.x;
    const dy = edge.b.y - edge.a.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = clamp(((point.x - edge.a.x) * dx + (point.y - edge.a.y) * dy) / lengthSquared, 0, 1);
    const projected = pointAt(edge, t);
    return { t, distance: Math.hypot(point.x - projected.x, point.y - projected.y) };
  }

  function pointAt(edge, t) {
    return { x: edge.a.x + (edge.b.x - edge.a.x) * t, y: edge.a.y + (edge.b.y - edge.a.y) * t };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  return { addInterval, addPath, compact, expand, intervalPoints, fromLegacyTrace };
});
