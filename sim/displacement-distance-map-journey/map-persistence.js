(function (root, factory) {
  const coverage = typeof module === "object" && module.exports
    ? require("./route-coverage.js")
    : root.MapRouteCoverage;
  const api = factory(coverage);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MapJourneyPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Coverage) {
  "use strict";

  const TRACE_FORMAT = 2;
  const PHASES = ["walk", "draw-segment", "draw-total"];
  const PHASE_ALIASES = { "segment-answer": "draw-segment", "ready-submit": "draw-total" };

  function encode(source) {
    return {
      seed: source.seed,
      routeIds: source.routeIds.slice(),
      currentSegment: source.currentSegment,
      phase: PHASE_ALIASES[source.phase] || source.phase,
      traceFormat: TRACE_FORMAT,
      person: source.person ? compactPoint(source.person) : null,
      segments: source.segments.map((segment) => ({
        reached: Boolean(segment.reached),
        routeDistance: segment.routeDistance,
        coverage: Coverage.compact(segment.coverage),
        arrow: compactArrow(segment.arrow),
        answers: segment.answers || null
      })),
      totalArrow: compactArrow(source.totalArrow),
      totalAnswers: source.totalAnswers || null
    };
  }

  function decode(review, edges, pathBetween) {
    if (!validHeader(review) || !Array.isArray(edges)) return null;
    const legacy = review.traceFormat !== TRACE_FORMAT;
    const segments = [];
    for (const segment of review.segments) {
      if (!segment || !validArrow(segment.arrow) || !validAnswer(segment.answers) || !Number.isFinite(segment.routeDistance) || segment.routeDistance < 0) return null;
      let coverage;
      if (legacy) {
        if (!Array.isArray(segment.trace) || !segment.trace.every(validPoint)) return null;
        coverage = Coverage.fromLegacyTrace(segment.trace, edges, pathBetween);
      } else {
        coverage = Coverage.expand(segment.coverage, edges);
        if (!coverage) return null;
      }
      segments.push({
        reached: Boolean(segment.reached),
        routeDistance: segment.routeDistance,
        coverage,
        arrow: expandArrow(segment.arrow),
        answers: segment.answers || null
      });
    }
    if (segments.length !== 2 || !validArrow(review.totalArrow) || !validAnswer(review.totalAnswers) || (review.person != null && !validPoint(review.person))) return null;
    const inferredSegment = segments[0].answers ? 1 : 0;
    const currentSegment = Number.isInteger(review.currentSegment) && review.currentSegment >= 0 && review.currentSegment < 2
      ? review.currentSegment
      : inferredSegment;
    const inferredPhase = review.totalAnswers ? "draw-total" : segments[currentSegment]?.reached ? "draw-segment" : "walk";
    if (review.phase === "segment-answer" && !segments[currentSegment]?.arrow) return null;
    const normalizedPhase = PHASE_ALIASES[review.phase] || review.phase;
    const phase = PHASES.includes(normalizedPhase) ? normalizedPhase : inferredPhase;
    if (!validProgress(segments, currentSegment, phase, review.totalArrow, review.totalAnswers)) return null;
    return {
      segments,
      currentSegment,
      phase,
      person: review.person == null ? null : expandPoint(review.person),
      totalArrow: expandArrow(review.totalArrow),
      totalAnswers: review.totalAnswers || null,
      legacy
    };
  }

  function validHeader(review) {
    return Number.isFinite(review?.seed) && Array.isArray(review.routeIds) && review.routeIds.length === 3 && Array.isArray(review.segments);
  }

  function validPoint(point) {
    return Array.isArray(point)
      ? point.length === 2 && point.every(Number.isFinite)
      : Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  function validArrow(arrow) {
    return !arrow || (validPoint(arrow.tail) && validPoint(arrow.head));
  }

  function validAnswer(answer) {
    return !answer || (Number.isFinite(answer.routeDistance) && answer.routeDistance >= 0 &&
      Number.isFinite(answer.displacementMagnitude) && answer.displacementMagnitude >= 0 && validDirection(answer.direction));
  }

  function validDirection(direction) {
    const cardinal = ["north", "south", "east", "west"];
    const diagonal = ["north-east", "north-west", "south-east", "south-west"];
    if (!direction || typeof direction !== "object") return false;
    if (cardinal.includes(direction.directionType)) return direction.angle == null;
    return diagonal.includes(direction.directionType) && Number.isFinite(direction.angle) && direction.angle >= 0 && direction.angle <= 90;
  }

  function validProgress(segments, currentSegment, phase, totalArrow, totalAnswers) {
    if (segments[0].answers && (!segments[0].reached || !segments[0].arrow)) return false;
    if ((segments[1].reached || segments[1].arrow || segments[1].answers) && !segments[0].answers) return false;
    if (segments[1].answers && (!segments[1].reached || !segments[1].arrow)) return false;
    if ((totalArrow || totalAnswers || phase === "draw-total") && !segments[1].answers) return false;
    if (totalAnswers && !totalArrow) return false;
    if (phase === "walk" && (segments[currentSegment].reached || segments[currentSegment].arrow)) return false;
    if (phase === "draw-segment" && !segments[currentSegment].reached) return false;
    if (phase === "draw-total" && (currentSegment !== 1 || !totalArrow)) return false;
    return true;
  }

  function compactArrow(arrow) {
    return arrow ? { tail: compactPoint(arrow.tail), head: compactPoint(arrow.head) } : null;
  }

  function expandArrow(arrow) {
    return arrow ? { tail: expandPoint(arrow.tail), head: expandPoint(arrow.head) } : null;
  }

  function compactPoint(point) {
    return [round1(point.x), round1(point.y)];
  }

  function expandPoint(point) {
    return Array.isArray(point) ? { x: point[0], y: point[1] } : { x: point.x, y: point.y };
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  return { TRACE_FORMAT, encode, decode };
});
