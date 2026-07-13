const assert = require("assert");
const {
  correctImage,
  incidentAngleToNormal,
  sourcePoint,
  restoreAnswer,
  scoreDiagram,
  vectorAngle
} = require("./scoring.js");

const leftScene = {
  mirrorX: 380,
  mirrorTop: 80,
  mirrorBottom: 400,
  reflectingSide: -1,
  objectX: 220,
  objectY: 240,
  objectHeight: 120
};
const rightScene = { ...leftScene, reflectingSide: 1, objectX: 540 };

const ray = { start: { x: 1, y: 1 }, end: { x: 2, y: 2 } };
const saved = { scene: leftScene, response: { bundles: ["top", "top", "bottom", "bottom"].map((source) => ({ id: 9, source, incident: ray, reflected: ray, extension: ray })), imageChoice: "virtual", image: { x: 540, y: 240, height: 120, angle: 0 } } };
assert.deepEqual(restoreAnswer(saved).bundles.map(({ id }) => id), [1, 2, 3, 4], "restore rebuilds unique bundle IDs");
assert.equal(restoreAnswer({ ...saved, response: { ...saved.response, imageChoice: "guess" } }), null);
assert.equal(restoreAnswer({ ...saved, response: { ...saved.response, image: {} } }), null);
assert.equal(restoreAnswer({ ...saved, scene: { ...leftScene, objectX: Infinity } }), null);
assert.equal(restoreAnswer({ ...saved, response: { ...saved.response, bundles: [{ source: "bottom", incident: null }] } }), null, "impossible source order is rejected");
assert.equal(restoreAnswer({ ...saved, response: { ...saved.response, bundles: [{ source: "top", incident: null, reflected: null, extension: null }] } }), null, "bundle requires an incident ray");
assert.equal(restoreAnswer({ ...saved, response: { ...saved.response, bundles: [{ source: "top", incident: saved.response.bundles[0].incident, extension: { start: { x: 1, y: 1 }, end: { x: 2, y: 2 } } }] } }), null, "extension requires a reflected ray");

function pointFromAngle(start, angle, length) {
  const radians = angle * Math.PI / 180;
  return {
    x: start.x + Math.cos(radians) * length,
    y: start.y + Math.sin(radians) * length
  };
}

function bundle(scene, source, mirrorY) {
  const sourceStart = sourcePoint(scene, source);
  const mirrorPoint = { x: scene.mirrorX, y: mirrorY };
  const incidentVector = {
    x: mirrorPoint.x - sourceStart.x,
    y: mirrorPoint.y - sourceStart.y
  };
  const reflectedAngle = vectorAngle({ x: -incidentVector.x, y: incidentVector.y });
  const extensionAngle = vectorAngle({ x: incidentVector.x, y: -incidentVector.y });
  return {
    source,
    incident: { start: sourceStart, end: mirrorPoint },
    reflected: {
      start: mirrorPoint,
      end: pointFromAngle(mirrorPoint, reflectedAngle, 120)
    },
    extension: {
      start: mirrorPoint,
      end: pointFromAngle(mirrorPoint, extensionAngle, 120)
    }
  };
}

function perfectAnswer(scene) {
  const image = correctImage(scene);
  return {
    bundles: [
      bundle(scene, "top", 145),
      bundle(scene, "top", 210),
      bundle(scene, "bottom", 270),
      bundle(scene, "bottom", 335)
    ],
    imageChoice: "virtual",
    image
  };
}

const perfect = scoreDiagram(perfectAnswer(leftScene), leftScene);
assert.equal(perfect.score, 100);
assert.equal(perfect.passed, true);
assert.equal(perfect.detail.incidentCorrect, 4);
assert.equal(perfect.detail.reflectedCorrect, 4);
assert.equal(perfect.detail.extensionCorrect, 4);

const overlapping = perfectAnswer(leftScene);
overlapping.bundles[1] = bundle(leftScene, "top", 145);
const overlappingScore = scoreDiagram(overlapping, leftScene);
assert.equal(overlappingScore.detail.duplicatePathCount, 1);
assert(overlappingScore.score < 100);
assert(overlappingScore.feedbackItems.some((item) => item.text.includes("兩條不同")));

const wrongType = scoreDiagram({ ...perfectAnswer(leftScene), imageChoice: "real" }, leftScene);
assert.equal(wrongType.score, 90);
assert.equal(wrongType.detail.imageTypeCorrect, false);

const wrongSide = perfectAnswer(leftScene);
wrongSide.bundles[0].reflected.end.x = leftScene.mirrorX + 80;
assert(wrongSide.bundles[0].reflected.end.x > leftScene.mirrorX);
const wrongSideScore = scoreDiagram(wrongSide, leftScene);
assert.equal(wrongSideScore.detail.reflectedCorrect, 3);
assert.equal(wrongSideScore.detail.extensionCorrect, 3);
assert(wrongSideScore.score < 100);

const wrongAngle = perfectAnswer(leftScene);
wrongAngle.bundles[1].reflected.end.y += 80;
const wrongAngleScore = scoreDiagram(wrongAngle, leftScene);
assert.equal(wrongAngleScore.detail.reflectedCorrect, 3);
assert.equal(wrongAngleScore.detail.extensionCorrect, 3);

const allReflectionsWrong = perfectAnswer(leftScene);
allReflectionsWrong.bundles.forEach((item) => {
  item.reflected.end.x = leftScene.mirrorX + 80;
});
const allReflectionsWrongScore = scoreDiagram(allReflectionsWrong, leftScene);
assert.equal(allReflectionsWrongScore.detail.reflectedCorrect, 0);
assert.equal(allReflectionsWrongScore.detail.extensionCorrect, 0);
assert.equal(allReflectionsWrongScore.passed, false);

const missingExtension = perfectAnswer(leftScene);
delete missingExtension.bundles[2].extension;
const missingExtensionScore = scoreDiagram(missingExtension, leftScene);
assert.equal(missingExtensionScore.detail.extensionCorrect, 3);
assert.equal(missingExtensionScore.detail.completeBundles, 3);

const wrongImageSize = perfectAnswer(leftScene);
wrongImageSize.image.bottomY += 40;
const wrongImageSizeScore = scoreDiagram(wrongImageSize, leftScene);
assert(wrongImageSizeScore.detail.imageChecks.some((check) => check.score === 0));
assert(wrongImageSizeScore.score < 100);

const centeredWrongImageSize = perfectAnswer(leftScene);
centeredWrongImageSize.image = {
  x: correctImage(leftScene).x,
  y: leftScene.objectY,
  height: leftScene.objectHeight + leftScene.objectHeight * 0.12,
  angle: 0
};
const centeredWrongImageSizeScore = scoreDiagram(centeredWrongImageSize, leftScene);
assert.equal(centeredWrongImageSizeScore.detail.imageChecks.find((check) => check.name === "topY").score, 0);
assert.equal(centeredWrongImageSizeScore.detail.imageChecks.find((check) => check.name === "bottomY").score, 0);
assert(centeredWrongImageSizeScore.score <= 90);

const centeredImage = correctImage(leftScene);
const rotatedImage = perfectAnswer(leftScene);
rotatedImage.image = {
  x: centeredImage.x,
  y: leftScene.objectY,
  height: leftScene.objectHeight,
  angle: 28
};
const rotatedImageScore = scoreDiagram(rotatedImage, leftScene);
assert(rotatedImageScore.detail.imageChecks.some((check) => check.name === "upright" && check.score === 0));
assert(rotatedImageScore.score < 100);

const rightPerfect = scoreDiagram(perfectAnswer(rightScene), rightScene);
assert.equal(rightPerfect.score, 100);
assert.equal(incidentAngleToNormal(sourcePoint(leftScene, "top"), { x: leftScene.mirrorX, y: 190 }), incidentAngleToNormal(sourcePoint(rightScene, "top"), { x: rightScene.mirrorX, y: 190 }));

console.log("plane mirror scoring checks passed");
