"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const App = require("./main.js");
const G = require("./generator.js");
const P = require("./persistence.js");

const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
for (const phase of ["investigate", "model", "predict", "design", "review"]) assert.match(source, new RegExp(`state\.phase === ["']${phase}["']`));
for (const transition of ["replaceCalibration", "replaceMeasurement", "replaceModel", "replacePrediction", "replaceDesign", "setPhase", "editSection", "clearCalibration"]) assert.match(source + fs.readFileSync(path.join(__dirname, "persistence.js"), "utf8"), new RegExp(transition));
assert.match(source, /Animation.createAnimator/);
assert.match(source, /animationToken/);
assert.match(source, /visibilitychange/);
assert.match(source, /resize/);
assert.match(source, /setDraftProvider/);
assert.match(source, /loadAttempt\(ACTIVITY\)/);
assert.match(source, /submitWithCallbacks/);
assert.match(source, /activityState: outcome/);
assert.match(source, /quarantinePending/);
assert.match(html, /data-action="record-calibration"/);
assert.match(html, /data-action="record-measurement"/);
assert.match(html, /data-action="submit"/);
assert.match(css, /grid-template-areas[^;]*"stage"[^;]*"controls"/);
assert.match(css, /grid-template-areas[^;]*"controls stage"/);
assert.match(css, /overflow-y[^;]*auto/);
assert.match(css, /overscroll-behavior[^;]*contain/);

const scenario = G.generateScenario({ seed: 19 });
const state = P.freshState(19);
const view = App.buildEditableViewModel(state, scenario);
assert.equal(view.phase, "investigate");
assert.equal(view.measurements.A.length, 3);
assert.equal(view.measurements.A[0].extensionM, null);
assert.equal(Object.keys(view).includes("optimal"), false);
assert.equal(App.investigationEndpointM(state, scenario.springs.A, 0.21), scenario.springs.A.naturalLengthM, "unloaded spring stays at its generated natural length");
assert.equal(App.investigationEndpointM({ activeLoadKey: "F1" }, scenario.springs.A, 0.21), 0.21, "loaded spring uses its animated equilibrium position");

console.log("Hooke's law UI runtime checks passed");
