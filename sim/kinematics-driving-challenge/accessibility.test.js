"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");

assert.equal((html.match(/aria-live=/g) || []).length, 1);
assert.match(html, /id="liveRegion"[^>]*aria-live="polite"/);
assert.match(html, /id="throttleButton"[^>]*aria-keyshortcuts="ArrowUp W"/);
assert.match(html, /id="brakeButton"[^>]*aria-keyshortcuts="ArrowDown S"/);
assert.match(css, /\.pedal \{[^}]*min-height: 72px/);
assert.match(css, /\.driving-stage[^}]*touch-action: pan-y/);
assert.match(css, /\.driving-panel[^}]*overscroll-behavior: contain/);
assert.match(css, /\.pedal[^}]*touch-action: none/);
assert.match(css, /minmax\(13rem, 44vh\) minmax\(0,1fr\)/);
assert.match(css, /minmax\(13rem, 44dvh\) minmax\(0,1fr\)/);
assert.match(main, /setPointerCapture/);
assert.match(main, /pointercancel/);
assert.match(main, /visibilitychange/);
assert.match(main, /shouldHandleGlobalShortcut\(event\.target\)/);
assert.match(main, /event\.code === "Space"/);
assert.match(main, /canOpenReviewItem\(state, level\.id, locked\)/);
assert.match(main, /elements\.reviewList\.addEventListener\("click", \(event\) => \{\s*if \(locked\) return;/);
assert.match(html, /id="analysisZoneTabs"/);
assert.doesNotMatch(html, /id="graphTitle"/);
assert.doesNotMatch(main, /setLineDash/);
assert.match(main, /font = "italic 18px 'STIX Two Math', 'Cambria Math', 'Times New Roman', serif"/);
assert.doesNotMatch(html, /m\/s|m\/s²|m\/s<sup>2/);
assert.doesNotMatch(html, /type="number"/);

console.log("Kinematics driving accessibility checks passed");
