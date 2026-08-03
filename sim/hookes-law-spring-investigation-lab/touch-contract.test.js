"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
assert.match(css, /\.stage[^}]*touch-action:\s*pan-y/);
assert.match(css, /\.drag-target[^}]*touch-action:\s*none/);
assert.match(css, /\.control-panel[^}]*overflow-y:\s*auto/);
assert.match(css, /\.control-panel[^}]*overscroll-behavior:\s*contain/);
assert.match(css, /html, body[^}]*overflow:\s*hidden/);
assert.match(main, /hostSwipe/);
assert.match(main, /host\.parent\.scrollBy\(0, delta\)/);
assert.match(main, /event\.target\.closest\?\.\("\.drag-target"\)/);
assert.match(main, /pointercancel/);
assert.match(main, /event\.isPrimary === false/);
assert.match(main, /setPointerCapture/);
for (const target of ["zero", "cursor", "model", "prediction"]) assert.match(html, new RegExp(`data-drag-target="${target}"`));
assert.doesNotMatch(main, /controlPanel\.scrollTop\s*[+\-]=/);
assert.doesNotMatch(main, /stage\.addEventListener\(["']wheel/);

console.log("Hooke's law touch contract checks passed");
