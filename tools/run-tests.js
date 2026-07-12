#!/usr/bin/env node
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const tests = [
  "sim/fbd-horizontal-block/scoring.test.js",
  "sim/plane-mirror-pencil-ray-diagram/scoring.test.js",
  "sim/displacement-distance-map-journey/scoring.test.js",
  "sim/inertial-reference-frame-road-observer/scoring.test.js",
  "sim/inertial-reference-frame-road-observer/animation.test.js",
  "sim/shared/scorm.test.js",
  "sim/shared/activity-submission.test.js"
];

for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(root, test)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
