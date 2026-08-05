"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");

for (const id of ["controlPanel", "stage", "stageSvg", "stageDescription", "liveRegion", "zeroDragHelp", "cursorDragHelp", "modelDragHelp", "predictionDragHelp", "recalibrationDialog"]) assert.match(html, new RegExp(`id="${id}"`));
for (const target of ["zeroDrag", "cursorDrag", "modelDrag", "predictionDrag"]) {
  assert.match(html, new RegExp(`id="${target}"[^>]*class="drag-target"`));
  assert.match(html, new RegExp(`id="${target}"[^>]*aria-describedby="[^"]+"`));
}
assert.equal((html.match(/class="spring-tabs" role="group"/g) || []).length, 2, "both spring selectors use button groups");
assert.equal((html.match(/aria-pressed="(?:true|false)"/g) || []).length, 4, "all spring buttons expose pressed state");
assert.doesNotMatch(html, /role="tablist"|role="tab"|aria-selected=/, "spring selectors do not advertise incomplete tab semantics");
assert.match(html, /aria-live="polite"/);
assert.match(html, /<dialog id="recalibrationDialog"/);
assert.match(css, /min-height[^}]*44px/);
assert.match(css, /touch-action[^}]*pan-y/);
assert.match(css, /touch-action[^}]*none/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors[^}]*active/);
assert.match(css, /height[^}]*100dvh/);
assert.match(css, /min-height[^}]*0/);
assert.match(main, /ArrowUp/);
assert.match(main, /ArrowDown/);
assert.match(main, /ArrowLeft/);
assert.match(main, /ArrowRight/);
assert.match(main, /setPointerCapture/);
assert.match(main, /pointercancel/);
assert.match(main, /event.isPrimary === false/);
assert.match(main, /setAttribute\("aria-pressed", String\(button.dataset.spring === key\)\)/);
assert.doesNotMatch(main, /setAttribute\("aria-selected"/);
assert.match(main, /event\.key === "Enter" \|\| event\.key === " "/);
assert.match(main, /host.parent.scrollBy/);
assert.doesNotMatch(main, /innerHTML\s*=/, "runtime uses DOM nodes/textContent for dynamic learner data");

console.log("Hooke's law accessibility checks passed");
