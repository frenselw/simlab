const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const browserRegressionSource = fs.readFileSync(
  path.join(root, "tools", "mobile-touch-browser-regression.js"),
  "utf8"
);

assert.match(
  browserRegressionSource,
  /type === "error" \|\| type === "assert"/,
  "trusted-touch browser diagnostics fail on console errors and failed console assertions"
);

function readStyles(activity) {
  return fs.readFileSync(path.join(root, "sim", activity, "styles.css"), "utf8");
}

const mapStyles = readStyles("displacement-distance-map-journey");
const mapSource = fs.readFileSync(
  path.join(root, "sim", "displacement-distance-map-journey", "main.js"),
  "utf8"
);
const mapIndex = fs.readFileSync(
  path.join(root, "sim", "displacement-distance-map-journey", "index.html"),
  "utf8"
);
assert.match(
  mapStyles,
  /\.journey-map\s*\{[^}]*touch-action:\s*pan-x pinch-zoom/s,
  "map forwarding surface leaves horizontal pan and pinch zoom browser-owned"
);
assert.match(
  mapIndex,
  /id="personTouchTarget"[^>]*class="person-touch-target"[^>]*data-person-hit="true"/,
  "map person has a stable HTML touch target outside the rerendered SVG layer"
);
assert.match(
  mapIndex,
  /id="arrowTouchTarget"[^>]*class="arrow-touch-target"/,
  "map displacement arrow has a stable HTML touch target outside the rerendered SVG layer"
);
assert.match(
  mapStyles,
  /\.person-touch-target,\s*\.arrow-touch-target\s*\{[^}]*position:\s*absolute[^}]*touch-action:\s*none/s,
  "map person and displacement arrow HTML targets reliably own their touch gestures"
);
assert.match(
  mapSource,
  /personTouchTarget\.addEventListener\("pointerdown", onPointerDown\)[\s\S]*personTouchTarget\.addEventListener\("pointercancel", onPointerCancel\)/,
  "map person drag stays captured by the stable HTML target"
);
assert.match(
  mapSource,
  /arrowTouchTarget\.addEventListener\("pointerdown", onPointerDown\)[\s\S]*arrowTouchTarget\.addEventListener\("pointercancel", onPointerCancel\)/,
  "map displacement arrow drag stays captured by the stable HTML target"
);

const fbdStyles = readStyles("fbd-horizontal-block");
const fbdSource = fs.readFileSync(
  path.join(root, "sim", "fbd-horizontal-block", "main.js"),
  "utf8"
);
const fbdIndex = fs.readFileSync(
  path.join(root, "sim", "fbd-horizontal-block", "index.html"),
  "utf8"
);
assert.match(
  fbdStyles,
  /\.fbd-diagram\s*\{[^}]*touch-action:\s*pan-y/s,
  "FBD blank-space swipes allow vertical page scrolling"
);
assert.match(
  fbdIndex,
  /id="forceTouchTargets"[^>]*class="force-touch-targets"/,
  "FBD force arrows have a stable HTML touch-target layer"
);
assert.match(
  fbdStyles,
  /\.force-touch-target\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*auto[^}]*touch-action:\s*none/s,
  "FBD force-arrow HTML targets reliably own their touch gestures"
);
assert.match(
  fbdSource,
  /forceTouchTargets\.addEventListener\("pointerdown", onPointerDown\)[\s\S]*forceTouchTargets\.addEventListener\("pointercancel", onPointerCancel\)/,
  "FBD force-arrow drags stay captured by stable HTML targets"
);
assert.doesNotMatch(
  fbdSource,
  /class:\s*"force-line"[\s\S]{0,300}"data-id"/,
  "FBD arrow shafts are not draggable"
);
assert.match(
  fbdStyles,
  /\.force-line\s*\{[^}]*pointer-events:\s*none/s,
  "FBD arrow shafts are non-interactive"
);

console.log("mobile touch scroll tests passed");
