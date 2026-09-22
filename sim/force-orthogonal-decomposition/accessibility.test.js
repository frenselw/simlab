"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert.match(html, /<html lang="zh-Hant">/);
assert.match(html, /id="diagram"[^>]*role="img"[^>]*aria-describedby="stageDescription"/);
assert.match(html, /id="stageDescription"[^>]*class="sr-only"/);
assert.match(html, /id="liveRegion"[^>]*aria-live="polite"/);
assert.match(html, /id="stageHits"[^>]*aria-label=/);
assert.match(html, /aria-keyshortcuts="Enter ArrowUp ArrowDown ArrowLeft ArrowRight Escape"/);
assert.match(html, /data-formula-label="F1">F₁/);
assert.match(html, /data-formula-label="F2">F₂/);
assert.doesNotMatch(html + css, /MathJax|KaTeX|cdnjs|unpkg|jsdelivr/i);
assert.match(css, /\.math-inline\s*\{[\s\S]*font-family:\s*var\(--math-font\)/);
assert.match(css, /\.math-inline var,[\s\S]*font-style:\s*italic/);
assert.match(css, /\.theta-hit::before\s*\{[\s\S]*box-shadow:/);
assert.match(css, /\.force-stage\s*\{[\s\S]*touch-action:\s*pan-y/);
assert.match(css, /\.stage-hit,[\s\S]*\.theta-hit\s*\{[\s\S]*touch-action:\s*none/);
assert.match(css, /\.formula-palette button[\s\S]*touch-action:\s*none/);
assert.match(css, /\.stage-hit:focus-visible,[\s\S]*outline:\s*3px/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /@media \(max-width: 520px\)/);
assert.match(css, /\.summary-item\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(css, /\.summary-item \.summary-pending\s*\{[^}]*overflow-wrap:\s*anywhere/);

console.log("force orthogonal decomposition accessibility tests passed");
