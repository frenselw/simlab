"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");

for (const text of ["aria-roledescription=\"可移動直尺\"", "aria-describedby=\"rulerHelp\"", "aria-live=\"polite\"", "role=\"alert\""]) assert.ok(html.includes(text), text);
for (const id of ["rulerHandle", "controlPanel", "readingInput", "submitButton"]) assert.ok(html.includes(`id="${id}"`));
assert.ok(html.includes('id="frequencyChip"'));
for (const id of ["measurementTitle", "analysisTitle", "reviewTitle", "resultTitle"]) {
  assert.match(html, new RegExp(`id="${id}"[^>]*tabindex="-1"`));
}
assert.ok(css.includes("touch-action: pan-y"));
assert.ok(css.includes(".ruler-handle"));
assert.ok(css.includes("touch-action: none"));
assert.ok(css.includes("overscroll-behavior: contain"));
assert.ok(css.includes("prefers-reduced-motion"));
assert.ok(css.includes("height: 100dvh"));
assert.ok(css.includes("min-height: 0"));
assert.ok(css.includes("forced-colors: active"));
assert.ok(css.includes(".result-cards"));
for (const token of ['"alertdialog"', '"aria-labelledby"', '"aria-describedby"', "blankWarningTitle", "blankWarningDescription"]) {
  assert.ok(main.includes(token), `blank confirmation accessibility token ${token}`);
}
assert.ok(!html.includes("magnifier"));
assert.ok(!css.includes(".magnifier"));
assert.ok(html.includes("preserveAspectRatio=\"xMidYMid meet\""));
assert.ok(html.includes("data-ruler-drag-owner"));
assert.ok(html.includes("<var>g</var>"));
assert.ok(html.includes("<var>t</var><sup>2</sup>"));
assert.ok(html.includes("<var>P</var><sub>0</sub>"));
assert.strictEqual((html.match(/class="prose-inline-symbol"/g) || []).length, 3,
  "Chinese prose variables use a scoped spacing wrapper without altering formula markup");
assert.ok(html.includes("<span class=\"unit\">cm</span>"));
assert.ok(html.includes("id=\"assignedFrequency\""));
assert.ok(!html.includes("readonly"));
assert.ok(html.includes("id=\"stageReadout\""));
assert.ok(html.includes("aria-live=\"off\""));
assert.ok(!main.includes("stageOutputAllowedTaskKey"),
  "stage readout visibility has no secondary display-authorization latch");
assert.match(main, /if \(valid && !drag\) showStageOutput\(reading\)/,
  "stage readout visibility is derived from the current valid non-dragging placement");
assert.ok(css.includes("pointer-events: none"));
assert.strictEqual((html.match(/data-reset-frequency>重新開始<\/button>/g) || []).length, 3);
assert.ok(!html.includes("返回停泊區"));
assert.strictEqual((html.match(/data-randomize-options/g) || []).length, 3);
assert.ok(css.includes(".error-text:empty"));
assert.ok(css.includes(".reset-action"));
assert.ok(css.includes("margin-top: 12px"));
assert.ok(css.includes(".exposure-cue"));
assert.ok(!html.includes("⋮⋮"));
assert.match(css, /\.ruler-handle\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s);
assert.ok(html.includes("id=\"replayPreviewButton\""));
assert.ok(html.includes("id=\"animationStatus\""));
assert.ok(html.includes("直接拖動直尺"));
assert.ok(!html.includes("data-nudge"));
assert.ok(!html.includes("nudge-grid"));
assert.ok(!css.includes(".nudge-grid"));
assert.ok((html.match(/<label><input type="radio"/g) || []).length >= 11, "every radio option has a real label element");
console.log("free-fall accessibility contract tests passed");
