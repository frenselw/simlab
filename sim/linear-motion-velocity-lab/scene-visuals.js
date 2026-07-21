(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LinearMotionSceneVisuals = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TAU = Math.PI * 2;
  const WHEEL_RADIUS_METRES = 0.58;
  const LANDMARK_SPACING_METRES = 8;
  const INSTANT_DEMO = Object.freeze({ travelMs: 2600, holdMs: 2200 });
  const BACKGROUND_LAYERS = Object.freeze({
    far: Object.freeze({ spacing: 13, parallax: 0.72, salt: 0x4f1bbcdc }),
    roadside: Object.freeze({ spacing: LANDMARK_SPACING_METRES, parallax: 1, salt: 0x68bc21eb })
  });

  function positiveModulo(value, divisor) { return ((value % divisor) + divisor) % divisor; }

  function instantDemoFrame(elapsedMs) {
    if (!Number.isFinite(elapsedMs)) throw new TypeError("Invalid instant demo time");
    const totalMs = INSTANT_DEMO.travelMs + INSTANT_DEMO.holdMs;
    const cycleMs = positiveModulo(elapsedMs, totalMs);
    const moving = cycleMs < INSTANT_DEMO.travelMs;
    const linearProgress = moving ? cycleMs / INSTANT_DEMO.travelMs : 1;
    return Object.freeze({ cycleMs, moving, carProgress: linearProgress, ghostVisible: cycleMs >= INSTANT_DEMO.travelMs / 2 });
  }

  function instantDemoGeometry(frame, viewportWidth, carScale) {
    if (!frame || !Number.isFinite(frame.carProgress) || !Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(carScale) || carScale <= 0) {
      throw new TypeError("Invalid instant demo geometry");
    }
    const margin = 90 * carScale;
    const startX = -margin;
    const endX = viewportWidth + margin;
    return Object.freeze({
      startX,
      endX,
      targetX: viewportWidth / 2,
      carX: startX + frame.carProgress * (endX - startX)
    });
  }

  function wheelAngle(worldPosition, radiusMetres = WHEEL_RADIUS_METRES) {
    if (!Number.isFinite(worldPosition) || !Number.isFinite(radiusMetres) || radiusMetres <= 0) throw new TypeError("Invalid wheel geometry");
    return positiveModulo(worldPosition / radiusMetres, TAU);
  }

  function carScale(pixelsPerMetre, wheelRadiusPixels = 15, radiusMetres = WHEEL_RADIUS_METRES) {
    if (![pixelsPerMetre, wheelRadiusPixels, radiusMetres].every(Number.isFinite) || pixelsPerMetre <= 0 || wheelRadiusPixels <= 0 || radiusMetres <= 0) throw new TypeError("Invalid car geometry");
    return radiusMetres * pixelsPerMetre / wheelRadiusPixels;
  }

  function sceneLayout(width, height) {
    if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new TypeError("Invalid scene viewport");
    const vergeTop = Math.round(height * 0.4);
    const roadTop = Math.round(height * 0.5);
    const roadBottom = Math.round(height * 0.86);
    const roadCentreY = (roadTop + roadBottom) / 2;
    const upperLaneCentreY = (roadTop + roadCentreY) / 2;
    const lowerLaneCentreY = (roadCentreY + roadBottom) / 2;
    const measurementStripHeight = height - roadBottom;
    const rulerY = roadBottom + measurementStripHeight * 0.45;
    const rulerTickTopMargin = Math.max(2, Math.min(4, measurementStripHeight * 0.1));
    const rulerMajorTickHeight = Math.max(4, Math.min(22, rulerY - roadBottom - rulerTickTopMargin));
    return Object.freeze({
      horizon: Math.round(height * 0.36),
      vergeTop,
      roadTop,
      roadBottom,
      roadCentreY,
      upperLaneCentreY,
      lowerLaneCentreY,
      carGroundY: upperLaneCentreY - Math.max(1, height * 0.006),
      farGroundY: vergeTop + (roadTop - vergeTop) * 0.28,
      roadsideGroundY: roadTop - Math.max(2, height * 0.006),
      rulerY,
      rulerTickTopMargin,
      rulerMajorTickHeight,
      rulerMinorTickHeight: Math.max(3, rulerMajorTickHeight * 0.55),
      rulerLabelY: height - 9
    });
  }

  function laneDashOffset(worldPosition, pixelsPerMetre, patternLength = 50) {
    if (![worldPosition, pixelsPerMetre, patternLength].every(Number.isFinite) || pixelsPerMetre <= 0 || patternLength <= 0) throw new TypeError("Invalid lane dash geometry");
    return positiveModulo(worldPosition * pixelsPerMetre, patternLength);
  }

  function mixHash(value) {
    let hash = Math.imul(value ^ value >>> 16, 0x45d9f3b);
    hash = Math.imul(hash ^ hash >>> 16, 0x45d9f3b);
    return (hash ^ hash >>> 16) >>> 0;
  }

  function hashCell(layer, cellId) {
    const config = BACKGROUND_LAYERS[layer];
    if (!config || !Number.isSafeInteger(cellId)) throw new TypeError("Invalid background cell");
    const low = cellId >>> 0;
    const high = Math.floor(cellId / 0x100000000) >>> 0;
    return mixHash(mixHash(low ^ config.salt) ^ high);
  }

  function backgroundAppearance(layer, cellId) {
    const hash = hashCell(layer, cellId);
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

  function visibleBackgroundCells(layer, worldPosition, pixelsPerMetre, viewportWidth, bufferPixels = 100) {
    const config = BACKGROUND_LAYERS[layer];
    if (!config || ![worldPosition, pixelsPerMetre, viewportWidth, bufferPixels].every(Number.isFinite) || pixelsPerMetre <= 0 || viewportWidth <= 0 || bufferPixels < 0) throw new TypeError("Invalid background viewport");
    const effectiveScale = pixelsPerMetre * config.parallax;
    const halfSpan = (viewportWidth / 2 + bufferPixels) / effectiveScale;
    const first = Math.floor((worldPosition - halfSpan) / config.spacing);
    const last = Math.ceil((worldPosition + halfSpan) / config.spacing);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }

  function landmarkAppearance(cellId) { return backgroundAppearance("roadside", cellId); }
  function visibleLandmarkCells(worldPosition, pixelsPerMetre, viewportWidth, spacing = LANDMARK_SPACING_METRES, bufferPixels = 100) {
    if (spacing !== LANDMARK_SPACING_METRES) {
      if (![worldPosition, pixelsPerMetre, viewportWidth, spacing, bufferPixels].every(Number.isFinite) || pixelsPerMetre <= 0 || viewportWidth <= 0 || spacing <= 0 || bufferPixels < 0) throw new TypeError("Invalid landmark viewport");
      const halfSpan = (viewportWidth / 2 + bufferPixels) / pixelsPerMetre;
      const first = Math.floor((worldPosition - halfSpan) / spacing);
      const last = Math.ceil((worldPosition + halfSpan) / spacing);
      return Array.from({ length: last - first + 1 }, (_, index) => first + index);
    }
    return visibleBackgroundCells("roadside", worldPosition, pixelsPerMetre, viewportWidth, bufferPixels);
  }

  return { TAU, WHEEL_RADIUS_METRES, LANDMARK_SPACING_METRES, BACKGROUND_LAYERS, INSTANT_DEMO, instantDemoFrame, instantDemoGeometry, wheelAngle, carScale, sceneLayout, laneDashOffset, backgroundAppearance, visibleBackgroundCells, landmarkAppearance, visibleLandmarkCells };
});
