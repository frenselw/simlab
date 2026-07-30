"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

for (const text of ["aria-roledescription=\"可移動直尺\"", "aria-describedby=\"rulerHelp\"", "aria-live=\"polite\"", "role=\"alert\"", "P₀–P₄"]) assert.ok(html.includes(text), text);
for (const id of ["rulerHandle", "controlPanel", "readingInput", "submitButton"]) assert.ok(html.includes(`id="${id}"`));
assert.ok(css.includes("touch-action: pan-y"));
assert.ok(css.includes(".ruler-handle"));
assert.ok(css.includes("touch-action: none"));
assert.ok(css.includes("overscroll-behavior: contain"));
assert.ok(css.includes("prefers-reduced-motion"));
assert.ok(css.includes("height: 100dvh"));
assert.ok(css.includes("min-height: 0"));
assert.ok(html.includes("magnifierReadout"));
assert.ok((html.match(/<label><input type="radio"/g) || []).length >= 11, "every radio option has a real label element");
console.log("free-fall accessibility contract tests passed");
