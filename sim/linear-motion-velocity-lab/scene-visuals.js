(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LinearMotionSceneVisuals = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TAU = Math.PI * 2;
  const WHEEL_RADIUS_METRES = 0.58;
  const LANDMARK_SPACING_METRES = 18;

  function positiveModulo(value, divisor) { return ((value % divisor) + divisor) % divisor; }

  function wheelAngle(worldPosition, radiusMetres = WHEEL_RADIUS_METRES) {
    if (!Number.isFinite(worldPosition) || !Number.isFinite(radiusMetres) || radiusMetres <= 0) throw new TypeError("Invalid wheel geometry");
    return positiveModulo(worldPosition / radiusMetres, TAU);
  }

  function carScale(pixelsPerMetre, wheelRadiusPixels = 15, radiusMetres = WHEEL_RADIUS_METRES) {
    if (![pixelsPerMetre, wheelRadiusPixels, radiusMetres].every(Number.isFinite) || pixelsPerMetre <= 0 || wheelRadiusPixels <= 0 || radiusMetres <= 0) throw new TypeError("Invalid car geometry");
    return radiusMetres * pixelsPerMetre / wheelRadiusPixels;
  }

  function landmarkAppearance(cellId) {
    if (!Number.isSafeInteger(cellId)) throw new TypeError("Landmark cell must be a safe integer");
    let hash = Math.imul(cellId ^ 0x51f15e5d, 0x45d9f3b);
    hash = Math.imul(hash ^ hash >>> 16, 0x45d9f3b);
    hash = (hash ^ hash >>> 16) >>> 0;
    const building = (hash & 1) === 1;
    const height = 30 + (hash >>> 6) % 22;
    return building
      ? { type: "building", width: 24 + (hash >>> 2) % 13, height, palette: (hash >>> 11) % 3, windowRows: Math.min(3, Math.floor((height - 14) / 11) + 1) }
      : { type: "tree", crownRadius: 14 + (hash >>> 2) % 6, trunkHeight: 19 + (hash >>> 7) % 8, palette: (hash >>> 12) % 3 };
  }

  function visibleLandmarkCells(worldPosition, pixelsPerMetre, viewportWidth, spacing = LANDMARK_SPACING_METRES, bufferPixels = 50) {
    if (![worldPosition, pixelsPerMetre, viewportWidth, spacing, bufferPixels].every(Number.isFinite) || pixelsPerMetre <= 0 || viewportWidth <= 0 || spacing <= 0 || bufferPixels < 0) throw new TypeError("Invalid landmark viewport");
    const halfSpan = (viewportWidth / 2 + bufferPixels) / pixelsPerMetre;
    const first = Math.floor((worldPosition - halfSpan) / spacing);
    const last = Math.ceil((worldPosition + halfSpan) / spacing);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }

  return { TAU, WHEEL_RADIUS_METRES, LANDMARK_SPACING_METRES, wheelAngle, carScale, landmarkAppearance, visibleLandmarkCells };
});
