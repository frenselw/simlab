"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const activities = [
  "fbd-horizontal-block",
  "plane-mirror-pencil-ray-diagram",
  "displacement-distance-map-journey",
  "inertial-reference-frame-road-observer"
];
for (const activity of activities) {
  const source = fs.readFileSync(path.join(__dirname, "..", activity, "main.js"), "utf8");
  assert(/onFailure:\s*\(submission\)/.test(source), activity + " must receive the submission state");
  assert(source.includes("submission.committed"), activity + " must distinguish a committed finish failure");
  assert(source.includes("成績已保存"), activity + " must explain that the final result was saved");
}

console.log("activity committed-submission callback checks passed");
