"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const activityRoot = path.join(root, "sim", "force-orthogonal-decomposition");
const html = fs.readFileSync(path.join(activityRoot, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(activityRoot, "styles.css"), "utf8");
const main = fs.readFileSync(path.join(activityRoot, "main.js"), "utf8");
const model = fs.readFileSync(path.join(activityRoot, "model.js"), "utf8");
const scoring = fs.readFileSync(path.join(activityRoot, "scoring.js"), "utf8");
const persistence = fs.readFileSync(path.join(activityRoot, "persistence.js"), "utf8");
const scorm = fs.readFileSync(path.join(root, "sim", "shared", "scorm.js"), "utf8");
const manifest = fs.readFileSync(path.join(root, "sim", "manifests", "force-orthogonal-decomposition.xml"), "utf8");
const plan = fs.readFileSync(path.join(root, "plans", "20-force-orthogonal-decomposition-full-delivery.md"), "utf8");
const config = fs.readFileSync(path.join(root, "sim", "config.js"), "utf8");
const lifecycleBrowser = fs.readFileSync(path.join(root, "tools", "force-orthogonal-decomposition-lifecycle-playwright-check.js"), "utf8");
const browserCheck = fs.readFileSync(path.join(root, "tools", "force-orthogonal-decomposition-playwright-check.js"), "utf8");
const browserHarness = fs.readFileSync(path.join(root, "tools", "force-orthogonal-decomposition-browser-regression.sh"), "utf8");
const embeddedHost = fs.readFileSync(path.join(root, "tools", "force-orthogonal-decomposition-embedded-host.html"), "utf8");
const staticServer = fs.readFileSync(path.join(root, "tools", "force-orthogonal-decomposition-static-server.js"), "utf8");

for (const id of ["originHit", "pointHit", "thetaHit", "directionEdit0", "directionEdit1", "perpendicularEdit0", "perpendicularEdit1", "componentEdit0", "componentEdit1"]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} has a stable trusted hit target`);
}
assert.match(html, /<html lang="zh-Hant">/);
assert.match(html, /shared\/scorm\.js/);
assert.match(html, /shared\/activity-flow\.js/);
assert.match(html, /scoring\.js/);
assert.match(html, /persistence\.js/);
assert.match(html, /id="questionProgress"[^>]*role="tablist"/);
assert.match(html, /id="summaryPanel"/);
assert.match(html, /id="reviewPanel"/);
assert.match(html, /id="technicalPanel"/);
assert.doesNotMatch(html + styles, /MathJax|KaTeX|cdnjs|unpkg|jsdelivr/i);

assert.match(styles, /\.force-decomposition-app\s*\{[\s\S]*position:\s*fixed;[\s\S]*height:\s*100vh;[\s\S]*height:\s*100dvh;[\s\S]*overflow:\s*hidden/s);
assert.match(styles, /html,[\s\S]*body\s*\{[\s\S]*height:\s*100%;[\s\S]*overflow:\s*hidden/s);
assert.match(styles, /\.force-shell\s*\{[\s\S]*grid-template-rows:\s*minmax\(13rem,\s*44vh\)\s+minmax\(0,\s*1fr\)/s);
assert.match(styles, /\.force-panel\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;[\s\S]*overscroll-behavior:\s*contain/s);
assert.match(styles, /\.force-stage\s*\{[\s\S]*touch-action:\s*pan-y/s);
assert.match(styles, /\.stage-hit,[\s\S]*\.theta-hit\s*\{[\s\S]*touch-action:\s*none/s);
assert.match(styles, /\.stage-hit\s*\{[\s\S]*width:\s*52px[\s\S]*height:\s*52px/s);
assert.match(styles, /\.stage-hits\s*\{[\s\S]*pointer-events:\s*none/s);
assert.match(styles, /\.force-diagram\s*\{[\s\S]*pointer-events:\s*none/s);

assert.match(main, /SimScorm\.loadAttempt\(ACTIVITY\)/);
assert.match(main, /SimActivityFlow\.startup\(attempt\)/);
assert.match(main, /SimScorm\.enableStandalonePersistence/);
assert.match(main, /SimScorm\.submitWithCallbacks\(result, reviewSnapshot/);
for (const state of ["success", "committed", "frozen", "retry"]) assert.match(main, new RegExp(`(?:${state})`), `${state} submission path exists`);
assert.match(main, /Persistence\.decodePending/);
assert.match(main, /getActivityState/);
assert.match(main, /finishRetryAvailable/);
assert.match(main, /next\.committed \? "committed"/);
assert.match(main, /button\.addEventListener\("pointerdown", startPointerDrag\)/);
assert.match(main, /button\.addEventListener\("pointermove", updatePointerDrag\)/);
assert.match(main, /button\.addEventListener\("pointerup", finishPointerDrag\)/);
assert.match(main, /button\.addEventListener\("pointercancel"/);
assert.match(main, /target\.setPointerCapture\(event\.pointerId\)/);
assert.match(main, /previousTargetKey: draft\.preview\?\.targetKey \|\| null/);
assert.match(main, /getTouchTelemetry/);
const captureTouchStart = main.indexOf("function captureStageTouch");
const captureTouchEnd = main.indexOf("function captureTouchPointer", captureTouchStart);
assert.ok(captureTouchStart >= 0 && captureTouchEnd > captureTouchStart, "stage touch capture helper is present");
assert.doesNotMatch(main.slice(captureTouchStart, captureTouchEnd), /stage-navigation/, "stage navigation is not treated as a draggable touch owner");
const stageOwnerStart = main.indexOf("function stageTouchOwner");
const stageOwnerEnd = main.indexOf("function startStageHostTouch", stageOwnerStart);
assert.match(main.slice(stageOwnerStart, stageOwnerEnd), /stage-navigation/, "stage navigation remains excluded from host scrolling");
assert.match(main, /given-theta-arc/);
assert.match(main, /given-theta-reference/);
assert.match(main, /function thetaVisualPoint\(\)/);
assert.match(main, /THETA_SEAT_SVG/);
assert.match(main, /thetaHit\.dataset\.thetaState/);
assert.match(main, /phase === "components" && items\.length >= 1/);
assert.match(main, /thetaPoint/);
assert.match(main, /const thetaActive = phase === "angle" \|\| phase === "formulas" \|\| Boolean\(state\.theta\)/);
assert.match(main, /function thetaCandidatesForInteraction\(source = state\)/);
assert.match(main, /allowImperfect: true/);
assert.match(main, /perpendiculars: source\?\.perpendiculars \|\| \[\]/);
assert.match(main, /圖形仍可修改；你可以先標示 θ/);
assert.match(main, /dom\.thetaChoices\.hidden = state\.phase !== "angle" \|\| !thetaCandidatesForInteraction\(\)\.length/);
assert.match(main, /function thetaSeatWorld\(scene = activeScene\(\)\)/);
assert.match(main, /function renderSceneHeader\(scene, \{ review = false \} = \{\}\)/);
assert.match(main, /data-label\": \"student-theta\"/);
assert.match(main, /const studentThetaLabelPoint = \(\(\) =>/);
assert.match(main, /runtimeState === "review" && studentThetaLabelPoint/);
assert.match(main, /const eventTarget = event\.target\?\.closest\?\.\("\.stage-hit, \.theta-hit"\)/);
assert.match(main, /function isStandaloneMode\(\)/);
assert.match(main, /isStandaloneMode\(\) && standaloneStorageState !== \"available\"/);
assert.doesNotMatch(persistence, /formula-stale-geometry/);
assert.match(main, /sceneFrame/);
assert.match(main, /bodyOffset \+ halfHeight/);
assert.match(main, /forceLabelAnchor = isGravityScene/);
assert.match(main, /Gₓ、Gᵧ 不可對調/);
assert.match(main, /提交後顯示評核/);
assert.match(main, /三題提交後才會顯示總分/);
assert.doesNotMatch(main, /data-label": "force-head"/);
assert.doesNotMatch(main, /LMSGetValue|LMSSetValue|LMSCommit|LMSFinish/);
assert.match(styles, /\.given-theta-arc/);
assert.match(styles, /\.given-theta-reference/);

assert.match(model, /inclined-external-force/);
assert.match(model, /inclined-gravity/);
assert.match(model, /decompositionAngle/);
assert.match(model, /function imperfectThetaCandidates\(directions, options = \{\}\)/);
assert.match(model, /function thetaCandidatesForInteraction\(directions, options = \{\}\)/);
assert.match(model, /const closest = candidates\[0\]/);
assert.match(model, /distance\(start, candidate\.foot\) >= minimum/);
assert.match(model, /distance\(start, candidate\.snappedPoint\) >= minimum/);
assert.match(model, /distance\(scene\.origin, candidate\.point\) >= minimum/);
assert.match(model, /visible angle edge is the learner's perpendicular guide/);
assert.match(model, /G 與向內法線分量/);
assert.match(model, /forceSymbol: "G"/);
assert.match(model, /componentSymbols: Object\.freeze/);
assert.doesNotMatch(main + model, /forceMagnitudeLabel|force-magnitude|mg/);
assert.match(main, /data-component-axis/);
assert.match(scoring, /item\("theta", "θ 的角度語意", GROUP_POINTS/);
assert.match(scoring, /const targetFor = component => visible\.find/);
assert.match(scoring, /targetMatchesAxis/);
assert.match(scoring, /兩者位置不可對調/);
assert.match(persistence, /function decodePending/);
assert.match(persistence, /phase-dependency/);
assert.match(scorm, /enableStandalonePersistence/);
assert.match(scorm, /localStorage/);
assert.match(scorm, /standaloneHasDurableCheckpoint/);
assert.match(scorm, /standaloneDurabilityFailure/);

for (const label of ["success", "committed", "frozen", "retryable", "nonretryable", "invalid-pending", "finished-missing", "finished-mismatch", "review-only"]) {
  assert.match(lifecycleBrowser, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} production lifecycle evidence exists`);
}
assert.match(browserCheck, /Input\.dispatchTouchEvent/);
assert.match(browserCheck, /stageBackButton/);
assert.match(browserCheck, /stageNextButton/);
assert.match(browserHarness, /force-orthogonal-decomposition-lifecycle-playwright-check\.js/);
assert.match(browserHarness, /SIMLAB_SERVER_PORT=/);
assert.match(browserHarness, /__simlab_health/);
assert.match(embeddedHost, /invalid-pending/);
assert.match(embeddedHost, /finished-missing/);
assert.match(embeddedHost, /finishFailuresRemaining/);
assert.match(staticServer, /__simlab_health/);
assert.match(staticServer, /process\.env\.SIMLAB_PORT \|\| 0/);

for (const file of ["config.js", "force-orthogonal-decomposition/index.html", "force-orthogonal-decomposition/styles.css", "force-orthogonal-decomposition/model.js", "force-orthogonal-decomposition/scoring.js", "force-orthogonal-decomposition/persistence.js", "force-orthogonal-decomposition/main.js", "shared/styles.css", "shared/scorm.js", "shared/activity-flow.js"]) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(manifest, new RegExp(`<file href="${escaped}"`), `${file} is packaged`);
}
assert.match(config, /folder: "force-orthogonal-decomposition"[\s\S]*status: "active"/);
assert.match(plan, /三題|three-question|三個情境/);
assert.match(plan, /touch-action: pan-y/);
assert.match(plan, /localStorage/);
assert.match(plan, /review-edit/);

console.log("force orthogonal decomposition browser contract tests passed");
