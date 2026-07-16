"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");

assert.strictEqual((html.match(/aria-live=/g) || []).length, 1, "only the dedicated live region announces updates");
assert.match(html, /id="liveRegion"[^>]*aria-live="polite"/);
assert.doesNotMatch(html, /<output\b/, "animation readouts must not have output's implicit status role");
assert.doesNotMatch(html.match(/id="progressMessage"[^>]*>/)?.[0] || "", /aria-live/);
assert.doesNotMatch(main.match(/function drawRoad\(\)[\s\S]*?\n  }/)?.[0] || "", /renderLiveReadouts/, "road drawing must not duplicate semantic updates");
assert.match(main, /SimActivityFlow\.submission\(outcome,/);

console.log("Linear motion accessibility checks passed");
