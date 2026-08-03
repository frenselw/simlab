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
assert.match(browser, /Input\.dispatchTouchEvent/);
assert.match(browser, /isTrusted/);
assert.match(browser, /sourceTouch/);
assert.match(browser, /packageTouch/);
assert.match(browser, /__embed-scroll-test\.html/);

console.log("Hooke's law browser regression wiring checks passed");
