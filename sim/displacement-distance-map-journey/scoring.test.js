const assert = require("assert");
const {
  bearingFromVector,
  expectedSegment,
  expectedTotal,
  formatBearing,
  hasReachedDestination,
  isDirectionAnswerCorrect,
  routeCompletion,
  scoreJourney
} = require("./scoring.js");

assert(hasReachedDestination({ x: 2, y: 0 }, { x: 0, y: 0 }));
assert(!hasReachedDestination({ x: 2.01, y: 0 }, { x: 0, y: 0 }));

const toleranceCompletion = routeCompletion(
  { x: 1.5, y: 0 },
  { x: 0, y: 0 },
  (from, to) => ({ distance: 1.5, points: [from, to] })
);
assert.equal(toleranceCompletion.distance, 1.5);
assert.deepEqual(toleranceCompletion.points.at(-1), { x: 0, y: 0 });

const rectCompletion = routeCompletion(
  { x: 4, y: 3 },
  { x: 0, y: 0 },
  (from, to) => ({ distance: 7, points: [from, { x: 4, y: 0 }, to] })
);
assert.equal(rectCompletion.distance, 7);
assert.deepEqual(rectCompletion.points, [{ x: 4, y: 0 }, { x: 0, y: 0 }]);

const existingSegment = { routeDistance: 25, trace: [{ x: 8, y: 3 }] };
existingSegment.routeDistance += rectCompletion.distance;
existingSegment.trace.push(...rectCompletion.points);
assert.equal(existingSegment.routeDistance, 32);
assert.deepEqual(existingSegment.trace.at(-1), rectCompletion.end);

const journey = {
  routePlaceIds: ["school", "bank", "park"],
  places: [
    { id: "school", label: "學校", position: { x: 10, y: 10 } },
    { id: "bank", label: "銀行", position: { x: 40, y: 50 } },
    { id: "park", label: "公園", position: { x: 90, y: 50 } }
  ]
};

function directionFor(bearing) {
  if (bearing === 0) return { directionType: "north" };
  if (bearing === 90) return { directionType: "east" };
  if (bearing === 180) return { directionType: "south" };
  if (bearing === 270) return { directionType: "west" };
  if (bearing <= 90) return { ns: "north", ew: "east", angle: bearing };
  if (bearing <= 180) return { ns: "south", ew: "east", angle: 180 - bearing };
  if (bearing <= 270) return { ns: "south", ew: "west", angle: bearing - 180 };
  return { ns: "north", ew: "west", angle: 360 - bearing };
}

function segmentAnswer(index, routeDistance) {
  const expected = expectedSegment(journey, index);
  return {
    reached: true,
    routeDistance,
    arrow: {
      tail: expected.start,
      head: expected.end
    },
    answers: {
      routeDistance,
      displacementMagnitude: expected.magnitude,
      direction: directionFor(expected.bearing)
    }
  };
}

function perfectAnswer() {
  const total = expectedTotal(journey);
  return {
    segments: [segmentAnswer(0, 85), segmentAnswer(1, 50)],
    totalArrow: {
      tail: total.start,
      head: total.end
    },
    totalAnswers: {
      routeDistance: 135,
      displacementMagnitude: total.magnitude,
      direction: directionFor(total.bearing)
    }
  };
}

const perfect = scoreJourney(perfectAnswer(), journey);
assert.equal(perfect.score, 100);
assert.equal(perfect.passed, true);

const wandered = perfectAnswer();
wandered.segments[0].routeDistance = 120;
wandered.segments[0].answers.routeDistance = 120;
wandered.totalAnswers.routeDistance = 170;
assert.equal(scoreJourney(wandered, journey).score, 100);

const wrongMagnitude = perfectAnswer();
wrongMagnitude.segments[0].answers.displacementMagnitude += 8;
const wrongMagnitudeScore = scoreJourney(wrongMagnitude, journey);
assert.equal(wrongMagnitudeScore.detail.segmentAnswers[0].magnitudeScore, 0);
assert.equal(wrongMagnitudeScore.score, 90);

const wrongReference = perfectAnswer();
wrongReference.segments[0].answers.direction = { ns: "north", ew: "east", angle: 37 };
const wrongReferenceScore = scoreJourney(wrongReference, journey);
assert.equal(wrongReferenceScore.detail.segmentAnswers[0].directionScore, 0);
assert.equal(wrongReferenceScore.score, 90);

const southEastBearing = bearingFromVector({ x: 12, y: 30 });
assert(formatBearing(southEastBearing).startsWith("南偏東"));
assert(isDirectionAnswerCorrect({ directionType: "east" }, 90));
assert(!isDirectionAnswerCorrect({ directionType: "north" }, 90));
assert(isDirectionAnswerCorrect({ directionType: "south-east", angle: 22 }, southEastBearing));
assert(isDirectionAnswerCorrect({ ns: "south", ew: "east", angle: 22 }, southEastBearing));
assert(!isDirectionAnswerCorrect({ ns: "north", ew: "east", angle: 22 }, southEastBearing));

const missingSecond = perfectAnswer();
missingSecond.segments[1] = { reached: false, routeDistance: 0 };
missingSecond.totalAnswers = null;
const missingSecondScore = scoreJourney(missingSecond, journey);
assert.equal(missingSecondScore.detail.segmentAnswers[1].score, 0);
assert.equal(missingSecondScore.detail.totalAnswers.score, 0);
assert.equal(missingSecondScore.passed, false);

const missingFirst = perfectAnswer();
missingFirst.segments[0] = { reached: false, routeDistance: 0 };
missingFirst.segments[1] = { reached: false, routeDistance: 0 };
missingFirst.totalAnswers = null;
const missingFirstScore = scoreJourney(missingFirst, journey);
assert.equal(missingFirstScore.detail.segmentAnswers[0].score, 0);
assert.equal(missingFirstScore.detail.segmentAnswers[1].score, 0);
assert.equal(missingFirstScore.detail.totalAnswers.score, 0);
assert.equal(missingFirstScore.score, 0);

const wrongArrows = perfectAnswer();
wrongArrows.segments[0].arrow.head = { x: 0, y: 0 };
wrongArrows.segments[1].arrow.head = { x: 0, y: 0 };
wrongArrows.totalArrow.head = { x: 0, y: 0 };
assert.equal(scoreJourney(wrongArrows, journey).score, 100);

const wrongTotal = perfectAnswer();
wrongTotal.totalArrow.head = { x: 20, y: 20 };
wrongTotal.totalAnswers.displacementMagnitude = 10;
wrongTotal.totalAnswers.direction = { ns: "north", ew: "west", angle: 10 };
const wrongTotalScore = scoreJourney(wrongTotal, journey);
assert.equal(wrongTotalScore.detail.totalAnswers.magnitudeScore, 0);
assert.equal(wrongTotalScore.detail.totalAnswers.directionScore, 0);
assert.equal(wrongTotalScore.score, 74);

console.log("map journey scoring checks passed");
