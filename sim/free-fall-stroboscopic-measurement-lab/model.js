(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FreeFallModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MODEL_VERSION = 1;
  const G = 10;
  const FREQUENCIES = Object.freeze([4, 5, 6, 8]);
  const ASSIGNABLE_FREQUENCIES = Object.freeze([4, 5, 8]);
  const POINT_COUNT = 5;
  const PHOTO_RULER_CM = 5;

  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  function validFrequency(value) { return finite(value) && FREQUENCIES.includes(value); }
  function deltaT(frequencyHz) {
    if (!validFrequency(frequencyHz)) throw new Error("Unsupported strobe frequency");
    return 1 / frequencyHz;
  }
  function timeAt(frequencyHz, index) {
    if (!Number.isInteger(index) || index < 0 || index >= POINT_COUNT) throw new Error("Invalid point index");
    return index * deltaT(frequencyHz);
  }
  function displacementAt(frequencyHz, index) {
    const time = timeAt(frequencyHz, index);
    return freeFallDisplacement(time);
  }
  function freeFallDisplacement(timeS) {
    if (!finite(timeS) || timeS < 0) throw new Error("Invalid free-fall time");
    return 0.5 * G * timeS * timeS;
  }
  function intervalDisplacement(frequencyHz, intervalIndex) {
    if (!Number.isInteger(intervalIndex) || intervalIndex < 1 || intervalIndex >= POINT_COUNT) throw new Error("Invalid interval index");
    return displacementAt(frequencyHz, intervalIndex) - displacementAt(frequencyHz, intervalIndex - 1);
  }
  function trajectory(frequencyHz) {
    if (!validFrequency(frequencyHz)) return null;
    return Array.from({ length: POINT_COUNT }, (_, index) => ({
      index,
      timeS: timeAt(frequencyHz, index),
      displacementM: displacementAt(frequencyHz, index),
      velocityMps: G * timeAt(frequencyHz, index)
    }));
  }
  function cameraMax(frequencyHz) {
    return Math.ceil((displacementAt(frequencyHz, 4) + 0.25) / 0.5) * 0.5;
  }
  function metersToPhotoCm(frequencyHz, meters) {
    return validFrequency(frequencyHz) && finite(meters) ? meters * PHOTO_RULER_CM / cameraMax(frequencyHz) : NaN;
  }
  function photoCmToMeters(frequencyHz, photoCm) {
    return validFrequency(frequencyHz) && finite(photoCm) ? photoCm * cameraMax(frequencyHz) / PHOTO_RULER_CM : NaN;
  }
  function geometry(frequencyHz, stageHeightPx, topPaddingPx = 18, bottomPaddingPx = 18) {
    if (!validFrequency(frequencyHz) || ![stageHeightPx, topPaddingPx, bottomPaddingPx].every(finite) ||
        stageHeightPx <= topPaddingPx + bottomPaddingPx || topPaddingPx < 0 || bottomPaddingPx < 0) return null;
    const maxM = cameraMax(frequencyHz);
    const usablePx = stageHeightPx - topPaddingPx - bottomPaddingPx;
    return {
      cameraMaxM: maxM,
      metersToY: (meters) => topPaddingPx + usablePx * meters / maxM,
      yToMeters: (y) => (y - topPaddingPx) * maxM / usablePx,
      pixelsPerMeter: usablePx / maxM
    };
  }

  return {
    MODEL_VERSION, G, FREQUENCIES, ASSIGNABLE_FREQUENCIES, POINT_COUNT, PHOTO_RULER_CM, finite, validFrequency, deltaT,
    timeAt, freeFallDisplacement, displacementAt, intervalDisplacement, trajectory, cameraMax,
    metersToPhotoCm, photoCmToMeters, geometry
  };
});
