"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");

assert.equal((html.match(/id="liveRegion"/g) || []).length, 1);
assert.match(html, /id="liveRegion"[^>]*aria-live="polite"/);
assert.match(html, /class="graph-input-surface"[^>]*role="application"[^>]*tabindex="0"/);
assert.match(html, /aria-label="定性運動圖作圖板。空白鍵切換畫筆/);
assert.match(html, /role="toolbar" aria-label="作圖工具"/);
assert.match(html, />復原上一步</);
assert.match(html, />取消復原</);
assert.match(html, /id="checkGraphButton"[^>]*disabled[^>]*>檢查畫法</);
assert.match(html, /只提供修改建議，不會提交或計分/);
assert.doesNotMatch(html, /id="skipButton"|稍後再做|取得作圖提示/);
assert.doesNotMatch(html, /role="tablist" aria-label="同一情境的三種運動圖"/);
assert.match(html, /id="stageRegion"[^>]*class="stage-region"/);
assert.match(html, /id="controlsPanel"[^>]*class="controls-panel"/);
assert.match(html, /id="resultTabs"[^>]*aria-label="選擇已提交圖線"/);
assert.doesNotMatch(html, /id="resultTabs"[^>]*role="tablist"/);
assert.match(html, /id="reviewWarning"[^>]*role="status"/);
assert.match(html, /id="resultNotice"[^>]*role="status"/);
assert.doesNotMatch(html, /type="number"/);
assert.doesNotMatch(html, /\d+\s*(?:m\/s|m\/s²|m\b)/);
assert.doesNotMatch(html, /class="positive-label"|class="negative-label"/);
assert.match(html, /class="vertical-arrow"/);
assert.match(html, /class="time-arrow"/);
assert.ok(html.indexOf('id="controlsPanel"') < html.indexOf('id="stageRegion"'),
  "controls precede the graph stage in reading and focus order");

assert.match(css, /\.graph-header-band[^}]*touch-action: pan-y/);
assert.match(css, /\.graph-input-surface \{[^}]*touch-action: none/);
assert.match(css, /\.graph-svg[^}]*pointer-events: none/);
assert.match(css, /\.tool-row button,[\s\S]*min-height: 44px/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.sr-only \{/);
assert.match(css, /html,\s*body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
assert.match(css, /\.graph-app\s*\{[^}]*height:\s*100vh[^}]*height:\s*100dvh/);
assert.match(css, /\.stage-region\s*\{[^}]*min-height:\s*0/);
assert.match(css, /\.controls-panel\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
assert.match(css, /@media \(min-width:\s*820px\)/);
assert.match(css, /\.graph-app\s*\{[^}]*width:\s*100%/);
assert.match(css, /\.progress\s*\{[^}]*grid-template-columns:\s*repeat\(6/);
assert.match(css, /\.graph-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(3/);
assert.doesNotMatch(html, /id="previousButton"/);
assert.doesNotMatch(html, /class="magnifier"/);
assert.doesNotMatch(css, /\.graph-tabs[^}]*overflow-x:\s*auto/);

assert.match(main, /event\.isPrimary === false/);
assert.match(main, /setPointerCapture/);
assert.match(main, /pointercancel/);
assert.match(main, /lostpointercapture/);
assert.match(main, /操作中斷；未完成的筆劃已安全取消/);
assert.match(main, /event\.code === "Space"/);
assert.match(main, /ArrowLeft/);
assert.match(main, /ArrowRight/);
assert.match(main, /ArrowUp/);
assert.match(main, /ArrowDown/);
assert.match(main, /event\.key === "Delete"/);
assert.match(main, /visibilitychange/);
assert.match(main, /window\.SimScorm\.setDraftProvider/);
assert.match(main, /window\.SimScorm\.quarantinePending/);
assert.match(main, /window\.SimScorm\.submitWithCallbacks/);
assert.match(main, /window\.SimActivityFlow\.startup/);
assert.doesNotMatch(main, /LMSGetValue|LMSSetValue|LMSCommit|LMSFinish/);
assert.doesNotMatch(main, /addEventListener\("pagehide"/);
assert.match(main, /activeTool = "pen";/);
assert.doesNotMatch(main, /window\.parent\.postMessage|window\.parent\.scrollBy|simlab-host-scroll/);
assert.match(main, /aria-pressed/);
assert.match(main, /evidenceIncompleteTaskIds[\s\S]{0,180}window\.confirm/);
const clearHandler = main.slice(
  main.indexOf('document.addEventListener("click"'),
  main.indexOf("function draftSnapshot")
);
assert.doesNotMatch(clearHandler, /window\.confirm/);
assert.match(main, /function formatPhysicsNotation/);
assert.doesNotMatch(main, /\(\?<!/);
assert.match(main, /task\.scenarioId === "composite"[\s\S]{0,180}task\.graphType === "xt"/);
assert.match(main, /tabIndex = locked \? -1 : 0/);
assert.match(main, /只讀/);
assert.match(main, /原始圖線|setPhysicsText|formatPhysicsNotation/);

console.log("Qualitative kinematics accessibility checks passed");
