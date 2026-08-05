"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sourceParity, fixtureExpression } = require("./hookes-law-spring-browser-regression.js");

assert.ok(sourceParity().length >= 8, "browser parity enumerates all local runtime dependencies");
assert.match(fixtureExpression(7), /HookesLawPersistence/);
assert.match(fixtureExpression(7), /replaceCalibration/);
assert.match(fixtureExpression(7), /replaceMeasurement/);
assert.match(fixtureExpression(7), /replaceModel/);
assert.match(fixtureExpression(7), /replacePrediction/);
assert.match(fixtureExpression(7), /replaceDesign/);
const browser = fs.readFileSync(path.join(__dirname, "hookes-law-spring-browser-regression.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "quality.yml"), "utf8");
assert.equal(packageJson.scripts["test:browser:hookes-law"], "node tools/hookes-law-spring-browser-regression.js", "package script runs the full Hooke browser regression");
assert.match(workflow, /npm run test:browser:hookes-law/, "Quality workflow runs the full Hooke browser regression");
assert.match(browser, /Input\.dispatchTouchEvent/);
assert.match(browser, /isTrusted/);
assert.match(browser, /sourceTouch/);
assert.match(browser, /packageTouch/);
assert.match(browser, /__embed-scroll-test\.html/);
assert.match(browser, /runFirstLoadDependencyLock/);
assert.match(browser, /Fetch\.requestPaused/);
assert.doesNotMatch(browser, /runDebugShortcut/);
assert.match(browser, /legacyDebugControls/);
for (const dependencyFile of ["generator.js", "model.js", "animation.js", "scoring.js", "persistence.js"]) assert.match(browser, new RegExp(dependencyFile.replace(".", "\\.")), `browser regression covers first-load ${dependencyFile} failure`);

console.log("Hooke's law browser regression wiring checks passed");
