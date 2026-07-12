"use strict";

const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(__dirname + "/main.js", "utf8");
assert(source.includes('state.playback === "playing" && !document.hidden'));
assert(source.includes('document.addEventListener("visibilitychange"'));
assert(source.includes("window.cancelAnimationFrame(animationFrame)"));
assert(!/renderUI\(\);\s*window\.requestAnimationFrame\(tick\)/.test(source));

console.log("reference-frame animation lifecycle checks passed");
