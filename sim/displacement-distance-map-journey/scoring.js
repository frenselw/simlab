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

  function scoreArrow(arrow, expected, headPoints, directionPoints) {
    if (!arrow || !arrow.head) {
      return { score: 0, headScore: 0, directionScore: 0 };
    }
    const learnerVector = vector(arrow.tail || expected.start, arrow.head);
    const headScore =
      pointDistance(arrow.head, expected.end) <= ARROW_HEAD_TOLERANCE_M ? headPoints : 0;
    const directionScore =
      angleDistance(bearingFromVector(learnerVector), expected.bearing) <= ANGLE_TOLERANCE_DEG
        ? directionPoints
        : 0;
    return {
      score: headScore + directionScore,
      headScore,
      directionScore
    };
  }

  function segmentAnswerScore(segment, expected) {
    if (!segment || !segment.reached || !segment.answers) {
      return { score: 0, routeScore: 0, magnitudeScore: 0, directionScore: 0 };
    }
    const routeScore = isDistanceAnswerCorrect(segment.answers.routeDistance, segment.routeDistance)
      ? 5
      : 0;
    const magnitudeScore = isDistanceAnswerCorrect(
      segment.answers.displacementMagnitude,
      expected.magnitude
    )
      ? 5
      : 0;
    const directionScore = isDirectionAnswerCorrect(segment.answers.direction, expected.bearing)
      ? 5
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
    const allReached = segments[0]?.reached && segments[1]?.reached;
    if (!allReached || !answer.totalAnswers) {
      return { score: 0, routeScore: 0, magnitudeScore: 0, directionScore: 0 };
    }
    const totalRoute = segments.reduce((sum, segment) => sum + (segment.routeDistance || 0), 0);
    const routeScore = isDistanceAnswerCorrect(answer.totalAnswers.routeDistance, totalRoute)
      ? 9
      : 0;
    const magnitudeScore = isDistanceAnswerCorrect(
      answer.totalAnswers.displacementMagnitude,
      expected.magnitude
    )
      ? 8
      : 0;
    const directionScore = isDirectionAnswerCorrect(answer.totalAnswers.direction, expected.bearing)
      ? 8
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
    const firstReached = Boolean(segments[0]?.reached);
    const secondReached = Boolean(firstReached && segments[1]?.reached);
    const completionOne = firstReached ? 5 : 0;
    const completionTwo = secondReached ? 5 : 0;
    const arrowOne = firstReached
      ? scoreArrow(segments[0].arrow, expectedOne, 5, 5)
      : { score: 0, headScore: 0, directionScore: 0 };
    const arrowTwo = secondReached
      ? scoreArrow(segments[1].arrow, expectedTwo, 5, 5)
      : { score: 0, headScore: 0, directionScore: 0 };
    const answerOne = firstReached ? segmentAnswerScore(segments[0], expectedOne) : zeroAnswerScore();
    const answerTwo = secondReached ? segmentAnswerScore(segments[1], expectedTwo) : zeroAnswerScore();
    const allReached = Boolean(firstReached && secondReached);
    const totalArrow = allReached
      ? scoreArrow(answer.totalArrow, expectedEnd, 8, 7)
      : { score: 0, headScore: 0, directionScore: 0 };
    const totalAnswers = finalAnswerScore(answer, expectedEnd);
    const score = clamp(
      Math.round(
        completionOne +
          completionTwo +
          arrowOne.score +
          arrowTwo.score +
          answerOne.score +
          answerTwo.score +
          totalArrow.score +
          totalAnswers.score
      ),
      0,
      100
    );
    const feedbackItems = buildFeedbackItems({
      completionOne,
      completionTwo,
      arrowOne,
      arrowTwo,
      answerOne,
      answerTwo,
      totalArrow,
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
        completion: completionOne + completionTwo,
        segmentArrows: [arrowOne, arrowTwo],
        segmentAnswers: [answerOne, answerTwo],
        totalArrow,
        totalAnswers
      }
    };
  }

  function zeroAnswerScore() {
    return { score: 0, routeScore: 0, magnitudeScore: 0, directionScore: 0 };
  }

  function buildFeedbackItems(detail) {
    return [
      {
        status: detail.completionOne ? "correct" : "missing",
        text: detail.completionOne ? "第一段：已到達指定地點。" : "第一段：未到達指定地點。"
      },
      {
        status: detail.completionTwo ? "correct" : "missing",
        text: detail.completionTwo ? "第二段：已到達指定地點。" : "第二段：未到達指定地點。"
      },
      arrowFeedback("第一段位移箭頭", detail.arrowOne, 10),
      arrowFeedback("第二段位移箭頭", detail.arrowTwo, 10),
      answerFeedback("第一段答案", detail.answerOne, 15),
      answerFeedback("第二段答案", detail.answerTwo, 15),
      arrowFeedback("總位移箭頭", detail.totalArrow, 15),
      answerFeedback("總結答案", detail.totalAnswers, 25)
    ];
  }

  function arrowFeedback(label, item, total) {
    if (item.score === total) return { status: "correct", text: `${label}：大小和方向正確。` };
    if (item.score === 0) return { status: "wrong", text: `${label}：未能取得正確分。` };
    return { status: "wrong", text: `${label}：部分正確，請留意箭頭終點和方向。` };
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
    scoreJourney,
    vector,
    vectorMagnitude
  };
});
