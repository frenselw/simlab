"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const uiPolicy = fs.readFileSync(path.join(__dirname, "ui-policy.js"), "utf8");
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
assert.match(html, /平均速度大小 = 位移大小 ÷ 經過時間/, "the learner calculation prompt uses plain Chinese quantity names");
for (const [name, source] of [["HTML", html], ["main script", main], ["scoring script", scoring]]) {
  assert.doesNotMatch(source, /\|<var|class="overbar"|\|v\(t\)\||\|v̄\||\|Δx\|/, `${name} learner copy does not require absolute-value or overbar notation`);
}
assert.match(main, /function feedbackFormulaHtml[\s\S]*role="math"[\s\S]*aria-label=/, "final feedback formulas use native accessible math markup");
assert.match(styles, /\.feedback-formula[\s\S]*overflow-x: auto/, "long formula feedback remains usable on narrow screens");
assert.match(styles, /\.feedback-formula[^}]*min-width: 0;[^}]*max-width: 100%/, "formula cards stay within the narrow-screen panel");
assert.match(styles, /\.feedback-formula > div[^}]*min-width: 0;[^}]*flex-wrap: wrap/, "average-velocity equations wrap between semantic terms on narrow screens");
assert.match(styles, /\.limit-formula[^}]*grid-template-columns: 1fr/, "limit sequence uses one stable row per interval");
assert.match(styles, /\.limit-step[^}]*flex-wrap: wrap/, "each limit step wraps instead of overlapping its neighbours");
assert.match(styles, /@media \(max-width: 390px\)[\s\S]*\.window-controls \{ grid-template-columns: 1fr; \}/, "delta-time controls stack on narrow screens");
assert.match(styles, /@media \(max-width: 819px\)[\s\S]*\.motion-shell \{ grid-template-rows: minmax\(13rem, 44vh\) minmax\(0, 1fr\); overflow: hidden; \}/, "mobile shell reserves the remaining viewport height for the scrolling control panel");
assert.match(styles, /@supports \(height: 100dvh\)[\s\S]*@media \(max-width: 819px\)[\s\S]*\.motion-shell \{ grid-template-rows: minmax\(13rem, 44dvh\) minmax\(0, 1fr\); \}/, "mobile shell follows the dynamic viewport height when supported");
assert.doesNotMatch(styles, /minmax\(16rem, 48dvh\)/, "short mobile viewports do not enlarge the stage at the control panel's expense");
assert.match(styles, /\.stopped-question \.calculation-row \{ grid-template-columns: minmax\(0, 1fr\)/, "stopped-velocity input can shrink within a narrow panel");
assert.match(styles, /\.motion-stage\.is-graph \.stage-readouts \{ position: static;[^}]*grid-row: 1;/, "graph readouts occupy their own row instead of covering the car at any viewport width");
assert.match(styles, /\.motion-stage\.is-graph #motionCanvas \{ grid-row: 2;/, "graph canvas follows the separate readout row");
assert.match(styles, /@media \(max-width: 819px\)[\s\S]*\.motion-stage:not\(\.is-graph\) \.motion-status \{ position: static;[^}]*grid-row: 2;[^}]*max-width: none;/, "mobile measurement status occupies a dedicated row below the canvas instead of covering the ruler");
assert.match(styles, /\.motion-stage\.is-graph \.stage-readouts > span \{[^}]*grid-template-columns: auto minmax\(0, 1fr\)[^}]*border-left: 3px solid var\(--color-accent\)/, "each mobile graph label and value forms one bounded card");
assert.match(styles, /\.motion-stage\.is-graph \.stage-readouts \[id\$="Readout"\] \{[^}]*border-left: 1px solid var\(--color-border-light\)/, "each mobile graph value has an internal divider from its own label");
assert.match(styles, /\.answer-form fieldset > legend[^}]*max-width: calc\(100% - \.5rem\)[^}]*border-left: 4px solid var\(--color-accent\)/, "question prompts use a bounded, accented card treatment");
assert.match(html, /車輛每一時刻的速度大小，是否都等於整段量度時間的平均速度大小/, "the relationship question uses plain Chinese quantity names");
assert.match(html, /id="longerWindowButton"[\s\S]*id="shorterWindowButton"/, "time magnifier exposes both longer and shorter interval controls");
assert.match(html, /車輛位置在一段時間內保持不變/, "stopped-velocity prompt defines the physical situation");
assert.match(main, /function showLongerWindow[\s\S]*activeWindowIndex = current - 1/, "learners can revisit a longer interval");
assert.match(main, /function showShorterWindow[\s\S]*state\.viewedWindowCount = next \+ 1/, "shortening preserves cumulative four-window progress");
assert.match(main, /aria-current="true"/, "the active analysis row is exposed semantically");
assert.match(main, /scene\.observationStarted !== 1[\s\S]*尚未開始觀察/, "pristine observation has a distinct status");
const animateBody = main.match(/function animate\([^]*?\n  }/)?.[0] || "";
assert.match(animateBody, /catch[\s\S]*locked = true[\s\S]*showTechnical\(/, "runtime numeric failures enter the locked technical view");
assert.doesNotMatch(animateBody, /captureEndpoint|stopwatch\(/, "animation never auto-stops or auto-captures an eligible measurement");
assert.match(animateBody, /state\?\.phase === "instant"[\s\S]*!reducedMotion && !instantDemoPaused\) draw\(\)/, "stage-three demonstration redraws without changing authoritative motion time and stops when paused");
assert.match(main, /const reducedMotionPreference = window\.matchMedia[\s\S]*prefers-reduced-motion: reduce/, "stage-three autoplay has a reduced-motion static equivalent");
assert.match(main, /handleReducedMotionChange[\s\S]*addEventListener\("change", handleReducedMotionChange\)/, "a live reduced-motion preference change immediately updates the demonstration");
assert.match(main, /renderMeasurementStage\(\)[\s\S]*canvas\.setAttribute\("aria-label", "固定在中央的車輛、向後移動的道路標尺或位置時間圖"\)/, "measurement stages retain an accurate canvas description");
assert.match(main, /renderInstant\(\)[\s\S]*靜態示意圖[\s\S]*車輛示意動畫/, "stage three accurately distinguishes its reduced-motion static image from its animation");
assert.match(main, /renderInstant\(\)[\s\S]*畫面不按比例顯示速度大小/, "stage-three copy says the qualitative car pass does not encode the model speed");
assert.match(html, /id="demoToggleButton"[^>]*>暫停示範<\/button>/, "stage-three autoplay has an explicit pause control");
assert.match(main, /function toggleInstantDemo\(\)[\s\S]*instantDemoPaused[\s\S]*瞬時速度示範已暫停/, "the demonstration pause control freezes and announces its state");
assert.match(html, /id="positionReadoutLabel">位置<\/b>[\s\S]*id="timerReadoutLabel">計時器<\/b>/, "readout labels have addressable stage-specific text");
assert.match(main, /positionReadoutLabel\.textContent = "目標位置"[\s\S]*timerReadoutLabel\.textContent = "目標時刻"/, "stage three identifies fixed target readings instead of presenting them as live values");
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
assert.match(main, /const rows = analysis\.geometry/, "graph secants use cached exact curve coordinates rather than display-rounded rows");
assert.match(uiPolicy, /geometry: Object\.freeze\(Model\.analysisWindowGeometry\(definition\)/, "production graph cache derives secants from exact model geometry");
assert.match(main, /lineDashOffset = Visuals\.laneDashOffset\(worldPosition, pixelsPerMetre\)[\s\S]*setLineDash\(\[\]\); context\.lineDashOffset = 0/, "lane divider follows world position and resets Canvas dash state");
const graphBody = main.match(/function drawGraph\([^]*?\n  }/)?.[0] || "";
assert.match(graphBody, /positionReadout\.textContent = `\$\{Model\.format3\(targetWorldPosition\)\} m`/, "stage-three digital position uses the graph's world coordinate");
assert.doesNotMatch(graphBody, /rollingReadingOrigin/, "stage-three graph must not mix in the measurement rolling coordinate");
assert.match(graphBody, /font = "bold 11px system-ui"[\s\S]*fillText\("x \/ m", left \+ 6, top \+ 14\)/, "the vertical-axis quantity label sits visibly inside the plot below the road");
assert.doesNotMatch(graphBody, /fillText\("x \/ m", left, top - 8\)/, "the vertical-axis quantity label must not sit against the road edge");
assert.match(graphBody, /instantDemoActive[\s\S]*Visuals\.instantDemoFrame\(demoElapsed\)/, "stage-three graph derives its repeated car pass from the tested demo timeline");
assert.match(main, /function drawFrozenContext\(position, compact, demoFrame = null\)[\s\S]*instantDemoGeometry[\s\S]*globalAlpha = \.24[\s\S]*demoFrame\.moving/, "the target ghost is translucent and the moving car uses tested geometry before disappearing during the hold");
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
