(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CircularSpeedModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const RADII = [0.10, 0.15, 0.20];
  const RATIOS = [1.5, 2];
  const SPEEDS = [0.35, 0.45, 0.55, 0.65];
  const TAU = 2 * Math.PI;
  const MAX_TIME = 86400;
  const CASES = ["coaxial", "belt"];
  const pick = (length, random) => Math.min(length - 1, Math.floor(random() * length));
  function definition(random = Math.random) {
    return { radiusIndex: pick(RADII.length, random), ratioIndex: pick(RATIOS.length, random), speedIndex: pick(SPEEDS.length, random) };
  }
  function validDefinition(value) {
    return value && Number.isInteger(value.radiusIndex) && value.radiusIndex >= 0 && value.radiusIndex < RADII.length &&
      Number.isInteger(value.ratioIndex) && value.ratioIndex >= 0 && value.ratioIndex < RATIOS.length &&
      Number.isInteger(value.speedIndex) && value.speedIndex >= 0 && value.speedIndex < SPEEDS.length;
  }
  function parameters(kind, value) {
    if (!CASES.includes(kind) || !validDefinition(value)) throw new Error("Invalid wheel definition");
    const rA = RADII[value.radiusIndex], rB = rA * RATIOS[value.ratioIndex], omegaB = SPEEDS[value.speedIndex];
    const omegaA = kind === "coaxial" ? omegaB : omegaB * rB / rA;
    return { rA, rB, omegaA, omegaB, vA: rA * omegaA, vB: rB * omegaB, centreDistance: 1.6 * (rA + rB) };
  }
  function format3(value) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0";
    const rounded = Number(value.toPrecision(3));
    return Math.abs(rounded) >= 10000 || Math.abs(rounded) < 0.001 ? rounded.toExponential(2).replace(/e\+?/, "×10^") : String(rounded);
  }
  function displayedNumber(value) { return Number(Number(value).toPrecision(3)); }
  function readings(kind, def, elapsed) {
    if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > MAX_TIME) return null;
    const p = parameters(kind, def);
    const dt = displayedNumber(elapsed);
    const sA = displayedNumber(p.vA * elapsed), sB = displayedNumber(p.vB * elapsed);
    const angleA = displayedNumber(p.omegaA * elapsed), angleB = displayedNumber(p.omegaB * elapsed);
    return { dt, sA, sB, angleA, angleB,
      vA: displayedNumber(sA / dt), vB: displayedNumber(sB / dt),
      omegaA: displayedNumber(angleA / dt), omegaB: displayedNumber(angleB / dt),
      turnsA: Math.floor(p.omegaA * elapsed / TAU), turnsB: Math.floor(p.omegaB * elapsed / TAU) };
  }
  function angleAt(start, omega, elapsed) { return ((start + omega * elapsed) % TAU + TAU) % TAU; }
  function beltTangents(rA, rB, distance) {
    const sin = (rB - rA) / distance, cos = Math.sqrt(1 - sin * sin);
    return { upperA: [-rA * sin, rA * cos], upperB: [distance - rB * sin, rB * cos],
      lowerA: [-rA * sin, -rA * cos], lowerB: [distance - rB * sin, -rB * cos] };
  }
  return { RADII, RATIOS, SPEEDS, TAU, MAX_TIME, CASES, definition, validDefinition, parameters, format3, displayedNumber, readings, angleAt, beltTangents };
});
