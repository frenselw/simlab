"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const scoring = fs.readFileSync(path.join(__dirname, "scoring.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const runtimeSources = [["styles.css", styles], ...["motion-model.js", "scene-visuals.js", "persistence.js"].map((name) => [name, fs.readFileSync(path.join(__dirname, name), "utf8")])];

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
for (const [name, source] of [["HTML", html], ["main script", main], ["scoring script", scoring]]) {
  assert(!source.includes("t*") && !source.includes("<sup>*</sup>"), `${name} must call the learner-facing target the 目標時刻, not t star`);
}
assert.match(html, /<var class="overbar">v<\/var>/, "average velocity uses a stable semantic overbar");
assert.match(html, /class="fraction"/, "formula uses native semantic fraction styling");
assert.match(main, /function feedbackFormulaHtml[\s\S]*role="math"[\s\S]*aria-label=/, "final feedback formulas use native accessible math markup");
assert.match(styles, /\.feedback-formula[\s\S]*overflow-x: auto/, "long formula feedback remains usable on narrow screens");
assert.match(styles, /\.feedback-formula[^}]*min-width: 0;[^}]*max-width: 100%/, "formula cards stay within the narrow-screen panel");
assert.match(styles, /\.feedback-formula > div[^}]*min-width: 0;[^}]*flex-wrap: wrap/, "average-velocity equations wrap between semantic terms on narrow screens");
assert.match(styles, /\.limit-formula[^}]*grid-template-columns: 1fr/, "limit sequence uses one stable row per interval");
assert.match(styles, /\.limit-step[^}]*flex-wrap: wrap/, "each limit step wraps instead of overlapping its neighbours");
assert.match(styles, /@media \(max-width: 390px\)[\s\S]*\.window-controls \{ grid-template-columns: 1fr; \}/, "delta-time controls stack on narrow screens");
assert.match(styles, /\.stopped-question \.calculation-row \{ grid-template-columns: minmax\(0, 1fr\)/, "stopped-velocity input can shrink within a narrow panel");
assert.match(html, /<var>Δx<\/var>/, "formula variables use semantic HTML");
assert.match(html, /id="longerWindowButton"[\s\S]*id="shorterWindowButton"/, "time magnifier exposes both longer and shorter interval controls");
assert.match(html, /車輛位置在一段時間內保持不變/, "stopped-velocity prompt defines the physical situation");
assert.match(main, /function showLongerWindow[\s\S]*activeWindowIndex = current - 1/, "learners can revisit a longer interval");
assert.match(main, /function showShorterWindow[\s\S]*state\.viewedWindowCount = next \+ 1/, "shortening preserves cumulative four-window progress");
assert.match(main, /aria-current="true"/, "the active analysis row is exposed semantically");
assert.match(main, /scene\.observationStarted !== 1[\s\S]*尚未開始觀察/, "pristine observation has a distinct status");
const animateBody = main.match(/function animate\([^]*?\n  }/)?.[0] || "";
assert.match(animateBody, /catch[\s\S]*locked = true[\s\S]*showTechnical\(/, "runtime numeric failures enter the locked technical view");
assert.doesNotMatch(animateBody, /captureEndpoint|stopwatch\(/, "animation never auto-stops or auto-captures an eligible measurement");
const progressBody = main.match(/function renderMeasurementProgress\(\)[^]*?\n  }/)?.[0] || "";
assert.match(progressBody, /eligible = Model\.minimumDurationReached\(duration, minimum\)[\s\S]*remaining = eligible \? 0/, "progress copy uses the same minimum-duration tolerance as the stop control");
assert.match(progressBody, /remaining > 0[\s\S]*已達最低量度時間/, "zero normalized remainder selects the reached-minimum message");
assert.match(progressBody, /running, observationStarted: state\.scene\.observationStarted === 1/, "stopwatch control receives the live observation state");
const stopwatchBody = main.match(/function stopwatch\(\)[^]*?\n  }/)?.[0] || "";
assert.match(stopwatchBody, /observationStarted !== 1 \|\| !running[\s\S]*請先按開始觀察/, "stopwatch defensively requires a running observation before start");
assert.match(stopwatchBody, /if \(!running\)[\s\S]*請先繼續觀察/, "a paused active stopwatch cannot capture an endpoint");
assert.match(main, /Visuals\.wheelAngle\(worldPosition\)/, "road car wheel angle derives from authoritative world position");
assert.match(main, /label: "開始 x₁"[\s\S]*dashed: true[\s\S]*shape: "circle"/, "start marker has text, line pattern, and shape");
assert.match(main, /label: "停止 x₂"[\s\S]*dashed: false[\s\S]*shape: "square"/, "stop marker does not rely on colour alone");
assert.match(main, /measurementWorldPosition\(measurement, marker\.endpoint\)/, "measurement markers derive from authoritative world readings");
assert.match(main, /left \? "←" : "→"/, "off-screen markers expose a direction cue");
assert.match(main, /strokeStyle = "#fff"; context\.lineWidth = 8[\s\S]*strokeStyle = marker\.colour/, "marker core has a high-contrast white halo");
assert(main.indexOf("drawMeasurementMarkers(currentMeasurement()") > main.indexOf('fillText("量度指針"'), "markers render after the car and pointer so the pointer cannot erase them");
assert.match(main, /Persistence\.next\(state, state\.returnToReview \? "return-review" : "advance"\)/, "measurement confirmation transitions without an extra navigation click");
assert.match(html, /id="previousStageButton"[\s\S]*id="nextStageButton"/, "every activity stage exposes explicit backward and forward navigation");
assert.match(main, /function navigateTo\(phase,[\s\S]*Persistence\.navigate\(state, phase, returnToReview\)/, "stage navigation persists arbitrary valid phase changes");
assert.match(main, /function renderReview\(\)[\s\S]*submitButton\.disabled = !complete/, "formal submission remains locked until all three answers are confirmed");
assert.match(main, /function syncMeasurementDraftFromForm[\s\S]*state\.draftAnswers\[state\.phase\] = draft/, "partial measurement answers are retained before navigation");
assert.match(main, /function syncInstantDraftFromForm[\s\S]*state\.draftAnswers\.instant = draft/, "partial instant-speed answers are retained before navigation");
assert.match(main, /focusContext\(state\.phase === "review" \? elements\.reviewTitle : elements\.stageTitle\)/, "automatic transitions focus their new context");
assert.match(main, /focusContext\(target\)/, "save failures focus the visible alert");
assert.match(html, /id="stageTitle"[^>]*tabindex="-1"/);
assert.match(html, /id="reviewTitle"[^>]*tabindex="-1"/);
assert.match(main, /Visuals\.carScale\(pixelsPerMetre\)/, "rendered wheel radius uses the same world-to-screen scale as background travel");
assert.match(main, /Visuals\.visibleBackgroundCells\(layer[\s\S]*Visuals\.backgroundAppearance\(layer, cellId\)/, "background layers use stable world-cell identities");
assert.match(main, /const rows = Model\.analysisWindowGeometry\(state\.definition\)/, "graph secants use exact curve coordinates rather than display-rounded rows");
assert.match(main, /lineDashOffset = Visuals\.laneDashOffset\(worldPosition, pixelsPerMetre\)[\s\S]*setLineDash\(\[\]\); context\.lineDashOffset = 0/, "lane divider follows world position and resets Canvas dash state");
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
