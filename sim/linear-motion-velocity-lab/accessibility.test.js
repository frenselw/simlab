"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const scoring = fs.readFileSync(path.join(__dirname, "scoring.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const runtimeSources = [["styles.css", styles], ...["motion-model.js", "persistence.js"].map((name) => [name, fs.readFileSync(path.join(__dirname, name), "utf8")])];

assert.strictEqual((html.match(/aria-live=/g) || []).length, 1, "only the dedicated live region announces updates");
assert.match(html, /id="liveRegion"[^>]*aria-live="polite"/);
assert.doesNotMatch(html, /role="status"/, "the dedicated live region owns polite announcements");
assert.doesNotMatch(html, /<output\b/, "animation readouts must not have output's implicit status role");
assert.doesNotMatch(html.match(/id="progressMessage"[^>]*>/)?.[0] || "", /aria-live/);
assert.match(html, /id="resultTitle"[^>]*tabindex="-1"/);
assert.doesNotMatch(main.match(/function drawRoad\(\)[\s\S]*?\n  }/)?.[0] || "", /renderLiveReadouts/, "road drawing must not duplicate semantic updates");
assert.match(main, /SimActivityFlow\.submission\(outcome,/);
for (const [name, source] of [["HTML", html], ["main script", main], ["scoring script", scoring], ...runtimeSources]) {
  assert.doesNotMatch(source, /MathJax|mathjax|\\\(|\\\[|\\mathrm|\\Delta|\\bar/, `${name} must not contain MathJax or raw TeX`);
}
assert.match(html, /<var class="overbar">v<\/var>/, "average velocity uses a stable semantic overbar");
assert.match(html, /class="fraction"/, "formula uses native semantic fraction styling");
assert.match(html, /<var>Δx<\/var>/, "formula variables use semantic HTML");
assert.match(main, /scene\.observationStarted !== 1[\s\S]*尚未開始觀察/, "pristine observation has a distinct status");
const animateBody = main.match(/function animate\([^]*?\n  }/)?.[0] || "";
assert.match(animateBody, /catch[\s\S]*locked = true[\s\S]*showTechnical\(/, "runtime numeric failures enter the locked technical view");
const graphBody = main.match(/function drawGraph\([^]*?\n  }/)?.[0] || "";
assert.match(graphBody, /positionReadout\.textContent = `\$\{Model\.format3\(targetWorldPosition\)\} m`/, "stage-three digital position uses the graph's world coordinate");
assert.doesNotMatch(graphBody, /rollingReadingOrigin/, "stage-three graph must not mix in the measurement rolling coordinate");
for (const name of ["drawRoad", "drawFrozenContext"]) {
  const body = main.match(new RegExp(`function ${name}\\([^]*?\\n  }`))?.[0] || "";
  assert.match(body, /for \(let offset = -tickRadius/, `${name} uses a fixed-count screen-offset tick loop`);
  assert.doesNotMatch(body, /for \(let metre =/, `${name} must not increment huge absolute metre values`);
}
assert.match(styles, /repeat\(3, minmax\(0, 1fr\)\)/, "captured readings use shrinkable equal columns");
for (const name of ["showTechnical", "showResult"]) {
  const body = main.match(new RegExp(`function ${name}\\([^]*?\\n  }`))?.[0] || "";
  assert.match(body, /announce\(/, `${name} must announce its final state once`);
  assert.match(body, /resultTitle\.focus\(/, `${name} must focus the result heading`);
}

console.log("Linear motion accessibility checks passed");
