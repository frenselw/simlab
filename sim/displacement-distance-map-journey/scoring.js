(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.MapJourneyScoring = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DISTANCE_ABSOLUTE_TOLERANCE_M = 1;
  const DISTANCE_RELATIVE_TOLERANCE = 0.03;
  const ANGLE_TOLERANCE_DEG = 8;
  const ARROW_HEAD_TOLERANCE_M = 2;
  const DESTINATION_REACH_TOLERANCE_M = 2;
  const PASSING_SCORE = 60;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pointDistance(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function hasReachedDestination(point, destination) {
    return pointDistance(point, destination) <= DESTINATION_REACH_TOLERANCE_M;
  }

  function routeCompletion(current, destination, findPath) {
    const path = findPath(current, destination);
    return {
      distance: Number.isFinite(path.distance) ? path.distance : 0,
      points: Number.isFinite(path.distance) ? path.points.slice(1) : [],
      end: destination
    };
  }

  function restoredWalkerPoint(snapshot, currentSegment, fallback) {
    if (isFinitePoint(snapshot?.person)) return snapshot.person;
    const trace = snapshot?.segments?.[currentSegment]?.trace;
    const last = Array.isArray(trace) ? trace[trace.length - 1] : null;
    return isFinitePoint(last) ? last : fallback;
  }

  function isFinitePoint(point) {
    return Array.isArray(point)
      ? point.length === 2 && point.every(Number.isFinite)
      : Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  function vector(start, end) {
    return {
      x: end.x - start.x,
      y: end.y - start.y
    };
  }

  function vectorMagnitude(item) {
    return Math.hypot(item.x, item.y);
  }

  function normalizeBearing(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function bearingFromVector(item) {
    if (!item || (!item.x && !item.y)) return null;
    return normalizeBearing(Math.atan2(item.x, -item.y) * 180 / Math.PI);
  }

  function angleDistance(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
    const diff = Math.abs(normalizeBearing(a - b));
    return Math.min(diff, 360 - diff);
  }

  function answerToBearing(answer) {
    if (!answer) return null;
    if (answer.directionType) {
      return directionTypeToBearing(answer.directionType, answer.angle);
    }
    const angle = Number(answer.angle);
    if (!Number.isFinite(angle) || angle < 0 || angle > 90) return null;
    const ns = answer.ns;
    const ew = answer.ew;
    if (ns === "north" && ew === "east") return angle;
    if (ns === "north" && ew === "west") return normalizeBearing(360 - angle);
    if (ns === "south" && ew === "east") return 180 - angle;
    if (ns === "south" && ew === "west") return 180 + angle;
    return null;
  }

  function directionTypeToBearing(directionType, answerAngle) {
    const cardinal = {
      north: 0,
      east: 90,
      south: 180,
      west: 270
    };
    if (Object.prototype.hasOwnProperty.call(cardinal, directionType)) return cardinal[directionType];
    const angle = Number(answerAngle);
    if (!Number.isFinite(angle) || angle < 0 || angle > 90) return null;
    if (directionType === "north-east") return angle;
    if (directionType === "south-east") return 180 - angle;
    if (directionType === "south-west") return 180 + angle;
    if (directionType === "north-west") return normalizeBearing(360 - angle);
    return null;
  }

  function formatBearing(bearing) {
    const value = normalizeBearing(bearing);
    const near = (target) => angleDistance(value, target) < 0.5;
    if (near(0)) return "向北";
    if (near(90)) return "向東";
    if (near(180)) return "向南";
    if (near(270)) return "向西";
    if (value < 90) return `北偏東 ${Math.round(value)}°`;
    if (value < 180) return `南偏東 ${Math.round(180 - value)}°`;
    if (value < 270) return `南偏西 ${Math.round(value - 180)}°`;
    return `北偏西 ${Math.round(360 - value)}°`;
  }

  function isDistanceAnswerCorrect(answer, actual) {
    const value = Number(answer);
    if (!Number.isFinite(value)) return false;
    const tolerance = Math.max(
      DISTANCE_ABSOLUTE_TOLERANCE_M,
      Math.abs(actual) * DISTANCE_RELATIVE_TOLERANCE
    );
    return Math.abs(value - actual) <= tolerance;
  }

  function isDirectionAnswerCorrect(answer, expectedBearing) {
    const learnerBearing = answerToBearing(answer);
    return angleDistance(learnerBearing, expectedBearing) <= ANGLE_TOLERANCE_DEG;
  }

  function placeMap(journey) {
    return Object.fromEntries((journey.places || []).map((place) => [place.id, place]));
  }

  function expectedSegment(journey, index) {
    const places = placeMap(journey);
    const from = places[journey.routePlaceIds[index]];
    const to = places[journey.routePlaceIds[index + 1]];
    return expectedVector(from, to);
  }

  function expectedTotal(journey) {
    const places = placeMap(journey);
    return expectedVector(places[journey.routePlaceIds[0]], places[journey.routePlaceIds[2]]);
  }

  function expectedVector(from, to) {
    const start = placePosition(from);
    const end = placePosition(to);
    const item = vector(start, end);
    const magnitude = vectorMagnitude(item);
    return {
      from,
      to,
      start,
      end,
      vector: item,
      magnitude,
      bearing: bearingFromVector(item)
    };
  }

  function placePosition(place) {
    return place.position || place.center;
  }

  function segmentAnswerScore(segment, expected) {
    if (!segment || !segment.answers) {
      return { score: 0, routeScore: 0, magnitudeScore: 0, directionScore: 0 };
    }
    const routeScore = isDistanceAnswerCorrect(segment.answers.routeDistance, segment.routeDistance)
      ? 10
      : 0;
    const magnitudeScore = isDistanceAnswerCorrect(
      segment.answers.displacementMagnitude,
      expected.magnitude
    )
      ? 10
      : 0;
    const directionScore = isDirectionAnswerCorrect(segment.answers.direction, expected.bearing)
      ? 10
      : 0;
    return {
      score: routeScore + magnitudeScore + directionScore,
      routeScore,
      magnitudeScore,
      directionScore
    };
  }

  function finalAnswerScore(answer, expected) {
    const segments = answer.segments || [];
    if (!answer.totalAnswers) {
      return { score: 0, routeScore: 0, magnitudeScore: 0, directionScore: 0 };
    }
    const totalRoute = segments.reduce((sum, segment) => sum + (segment.routeDistance || 0), 0);
    const routeScore = isDistanceAnswerCorrect(answer.totalAnswers.routeDistance, totalRoute)
      ? 14
      : 0;
    const magnitudeScore = isDistanceAnswerCorrect(
      answer.totalAnswers.displacementMagnitude,
      expected.magnitude
    )
      ? 13
      : 0;
    const directionScore = isDirectionAnswerCorrect(answer.totalAnswers.direction, expected.bearing)
      ? 13
      : 0;
    return {
      score: routeScore + magnitudeScore + directionScore,
      routeScore,
      magnitudeScore,
      directionScore
    };
  }

  function scoreJourney(answer, journey) {
    const segments = answer.segments || [];
    const expectedOne = expectedSegment(journey, 0);
    const expectedTwo = expectedSegment(journey, 1);
    const expectedEnd = expectedTotal(journey);
    const answerOne = segmentAnswerScore(segments[0], expectedOne);
    const answerTwo = segmentAnswerScore(segments[1], expectedTwo);
    const totalAnswers = finalAnswerScore(answer, expectedEnd);
    const score = clamp(
      Math.round(answerOne.score + answerTwo.score + totalAnswers.score),
      0,
      100
    );
    const feedbackItems = buildFeedbackItems({
      answerOne,
      answerTwo,
      totalAnswers
    });
    const summary =
      "路程取決於實際走過的道路，位移只取決於起點和終點；總位移是由第一個地點直接指向最後一個地點。";

    return {
      score,
      maxScore: 100,
      passed: score >= PASSING_SCORE,
      completed: true,
      feedback: feedbackItems.map((item) => item.text).concat(summary).join(" "),
      feedbackItems,
      summary,
      detail: {
        segmentAnswers: [answerOne, answerTwo],
        totalAnswers
      }
    };
  }

  function buildFeedbackItems(detail) {
    return [
      answerFeedback("第一段答案", detail.answerOne, 30),
      answerFeedback("第二段答案", detail.answerTwo, 30),
      answerFeedback("總結答案", detail.totalAnswers, 40)
    ];
  }

  function answerFeedback(label, item, total) {
    if (item.score === total) return { status: "correct", text: `${label}：全部正確。` };
    if (item.score === 0) return { status: "wrong", text: `${label}：未能取得正確分。` };
    return { status: "wrong", text: `${label}：部分正確，請分清路程、位移大小和方向。` };
  }

  return {
    DISTANCE_ABSOLUTE_TOLERANCE_M,
    DISTANCE_RELATIVE_TOLERANCE,
    ANGLE_TOLERANCE_DEG,
    ARROW_HEAD_TOLERANCE_M,
    DESTINATION_REACH_TOLERANCE_M,
    PASSING_SCORE,
    answerToBearing,
    angleDistance,
    bearingFromVector,
    expectedSegment,
    expectedTotal,
    formatBearing,
    isDirectionAnswerCorrect,
    isDistanceAnswerCorrect,
    normalizeBearing,
    pointDistance,
    hasReachedDestination,
    routeCompletion,
    restoredWalkerPoint,
    scoreJourney,
    vector,
    vectorMagnitude
  };
});
