const assert = require("assert");
const { scoreDiagram, BALANCE_LENGTH_RATIO } = require("./scoring.js");

const block = { x: 240, y: 210, width: 160, height: 90 };
const center = { x: 320, y: 255 };

function arrow(type, dx, dy, slot) {
  return {
    type,
    slot,
    start: { ...center },
    end: { x: center.x + dx, y: center.y + dy }
  };
}

const blank = scoreDiagram([], block);
assert.equal(blank.score, 0);

const perfect = scoreDiagram([
  arrow("weight", 0, 90),
  arrow("normal", 0, -90),
  arrow("applied", 100, 0),
  arrow("friction", -100, 0)
], block);

assert.equal(perfect.score, 100);
assert.equal(perfect.passed, true);
assert(perfect.feedbackItems.every((item) => item.status === "correct"));
assert(perfect.summary.includes("合力為零"));
assert.deepEqual(perfect.detail.balancedPairs, ["vertical", "horizontal"]);
assert.equal(BALANCE_LENGTH_RATIO, 0.8);

const differentPairLengths = scoreDiagram([
  arrow("weight", 0, 80),
  arrow("normal", 0, -80),
  arrow("applied", 140, 0),
  arrow("friction", -140, 0)
], block);

assert.equal(differentPairLengths.score, 100);
assert.deepEqual(differentPairLengths.detail.balancedPairs, ["vertical", "horizontal"]);

const exactBalanceBoundary = scoreDiagram([
  arrow("weight", 0, 80),
  arrow("normal", 0, -100),
  arrow("applied", 100, 0),
  arrow("friction", -80, 0)
], block);

assert.equal(exactBalanceBoundary.score, 100);
assert.deepEqual(exactBalanceBoundary.detail.balancedPairs, ["vertical", "horizontal"]);

const outsideBalanceBoundary = scoreDiagram([
  arrow("weight", 0, 79),
  arrow("normal", 0, -100),
  arrow("applied", 100, 0),
  arrow("friction", -79, 0)
], block);

assert.equal(outsideBalanceBoundary.score, 90);
assert.deepEqual(outsideBalanceBoundary.detail.balancedPairs, []);
assert(outsideBalanceBoundary.feedbackItems.some((item) =>
  item.text.includes("支持力與重力：箭頭長度相差太大")
));
assert(outsideBalanceBoundary.feedbackItems.some((item) =>
  item.text.includes("外力與摩擦力：箭頭長度相差太大")
));

const oneUnbalancedPair = scoreDiagram([
  arrow("weight", 0, 100),
  arrow("normal", 0, -100),
  arrow("applied", 200, 0),
  arrow("friction", -40, 0)
], block);

assert.equal(oneUnbalancedPair.score, 95);
assert.deepEqual(oneUnbalancedPair.detail.balancedPairs, ["vertical"]);
assert.equal(oneUnbalancedPair.passed, true);
assert(oneUnbalancedPair.summary.includes("應各自大小大致相等"));

const missingFriction = scoreDiagram([
  arrow("weight", 0, 90),
  arrow("normal", 0, -90),
  arrow("applied", 100, 0)
], block);

assert(missingFriction.score < perfect.score);
assert(missingFriction.detail.missingTypes.includes("friction"));
assert(missingFriction.feedbackItems.some((item) => item.text.includes("摩擦力應向左")));

const wrongDirections = scoreDiagram([
  arrow("weight", 100, 0),
  arrow("normal", 100, 0),
  arrow("applied", 100, 0),
  arrow("friction", 100, 0)
], block);

assert(wrongDirections.score < perfect.score);
assert(wrongDirections.detail.correctDirections.length < 4);
assert.deepEqual(wrongDirections.detail.balancedPairs, []);
assert(wrongDirections.feedbackItems.some((item) => item.status === "wrong"));
assert(wrongDirections.feedbackItems.some((item) => item.text.includes("請先修正箭頭方向")));

const onePairWrongDirection = scoreDiagram([
  arrow("weight", 0, 100),
  arrow("normal", 0, -100),
  arrow("applied", 100, 0),
  arrow("friction", 100, 0)
], block);

assert.deepEqual(onePairWrongDirection.detail.balancedPairs, ["vertical"]);
assert.equal(onePairWrongDirection.score, 85);
assert(onePairWrongDirection.feedbackItems.some((item) =>
  item.text.includes("外力與摩擦力：請先修正箭頭方向")
));

const slightlyWrongApplied = scoreDiagram([
  arrow("weight", 0, 90),
  arrow("normal", 0, -90),
  arrow("applied", 100, 27),
  arrow("friction", -100, 0)
], block);

assert(!slightlyWrongApplied.detail.correctDirections.includes("applied"));

const duplicateApplied = scoreDiagram([
  arrow("weight", 0, 90),
  arrow("normal", 0, -90),
  arrow("applied", 100, 0),
  arrow("applied", 100, 0)
], block);

assert.equal(duplicateApplied.detail.extraCount, 1);
assert(duplicateApplied.detail.missingTypes.includes("friction"));

const duplicateNormal = scoreDiagram([
  arrow("weight", 0, 90),
  arrow("normal", 0, -90, "1"),
  arrow("normal", 0, -90, "2"),
  arrow("applied", 100, 0),
  arrow("friction", -100, 0)
], block);

assert.equal(duplicateNormal.detail.extraCount, 1);
assert(duplicateNormal.feedbackItems.some((item) => item.text.includes("N₂ 支持力")));
assert.equal(duplicateNormal.score, 66);

const duplicateVerticalPair = scoreDiagram([
  arrow("weight", 0, 90, "1"),
  arrow("weight", 0, 90, "2"),
  arrow("normal", 0, -90, "1"),
  arrow("normal", 0, -90, "2"),
  arrow("applied", 100, 0),
  arrow("friction", -100, 0)
], block);

assert.equal(duplicateVerticalPair.score, 48);
assert.equal(duplicateVerticalPair.detail.extraCount, 2);
assert.deepEqual(duplicateVerticalPair.detail.extraTypes, ["weight", "normal"]);
assert.deepEqual(duplicateVerticalPair.detail.balancedPairs, ["vertical", "horizontal"]);

const extraTension = scoreDiagram([
  arrow("weight", 0, 90),
  arrow("normal", 0, -90),
  arrow("applied", 100, 0),
  arrow("friction", -100, 0),
  arrow("tension", 100, -100)
], block);

assert.equal(extraTension.detail.extraCount, 1);
assert(extraTension.feedbackItems.some((item) => item.text.includes("T 拉力：此題不需要")));
assert.equal(extraTension.score, 75);

const allButtons = scoreDiagram([
  arrow("weight", 0, 90, "1"),
  arrow("weight", 0, 90, "2"),
  arrow("normal", 0, -90, "1"),
  arrow("normal", 0, -90, "2"),
  arrow("applied", 100, 0, "1"),
  arrow("applied", 100, 0, "2"),
  arrow("friction", -100, 0, "1"),
  arrow("friction", -100, 0, "2"),
  arrow("tension", 100, -100, "1"),
  arrow("tension", -100, -100, "2")
], block);

assert.equal(allButtons.score, 0);

const zeroLength = scoreDiagram([
  arrow("weight", 0, 0),
  arrow("normal", 0, 0),
  arrow("applied", 0, 0),
  arrow("friction", 0, 0)
], block);

assert.equal(zeroLength.passed, false);
assert.equal(zeroLength.detail.tooShortCount, 4);
assert(zeroLength.score < 60);

console.log("scoring checks passed");
