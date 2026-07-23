const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

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
  /\.journey-map\s*\{[^}]*touch-action:\s*pan-y/s,
  "map blank-space swipes allow vertical page scrolling"
);
assert.match(
  mapIndex,
  /id="personTouchTarget"[^>]*class="person-touch-target"[^>]*data-person-hit="true"/,
  "map person has a stable HTML touch target outside the rerendered SVG layer"
);
assert.match(
  mapStyles,
  /\.person-touch-target\s*\{[^}]*position:\s*absolute[^}]*touch-action:\s*none/s,
  "map person HTML target reliably owns its touch gesture"
);
assert.match(
  mapSource,
  /personTouchTarget\.addEventListener\("pointerdown", onPointerDown\)[\s\S]*personTouchTarget\.addEventListener\("pointercancel", onPointerUp\)/,
  "map person drag stays captured by the stable HTML target"
);

const fbdStyles = readStyles("fbd-horizontal-block");
assert.match(
  fbdStyles,
  /\.fbd-diagram\s*\{[^}]*touch-action:\s*pan-y/s,
  "FBD blank-space swipes allow vertical page scrolling"
);
assert.match(
  fbdStyles,
  /\.force-tip-hit\s*\{[^}]*touch-action:\s*none/s,
  "FBD drag targets continue to own two-dimensional touch gestures"
);

console.log("mobile touch scroll tests passed");
