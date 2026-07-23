const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readStyles(activity) {
  return fs.readFileSync(path.join(root, "sim", activity, "styles.css"), "utf8");
}

const mapStyles = readStyles("displacement-distance-map-journey");
assert.match(
  mapStyles,
  /\.journey-map\s*\{[^}]*touch-action:\s*pan-y/s,
  "map blank-space swipes allow vertical page scrolling"
);
assert.match(
  mapStyles,
  /\.arrow-hit,\s*\.person-hit\s*\{[^}]*touch-action:\s*none/s,
  "map drag targets continue to own two-dimensional touch gestures"
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
