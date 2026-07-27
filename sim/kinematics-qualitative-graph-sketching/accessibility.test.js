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
assert.match(html, /role="tablist" aria-label="同一情境的三種運動圖"/);
assert.match(html, /id="reviewWarning"[^>]*role="status"/);
assert.match(html, /id="resultNotice"[^>]*role="status"/);
assert.doesNotMatch(html, /type="number"/);
assert.doesNotMatch(html, /\d+\s*(?:m\/s|m\/s²|m\b)/);

assert.match(css, /\.graph-header-band[^}]*touch-action: pan-y/);
assert.match(css, /\.graph-input-surface \{[^}]*touch-action: none/);
assert.match(css, /\.graph-svg[^}]*pointer-events: none/);
assert.match(css, /\.tool-row button,[\s\S]*min-height: 44px/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.sr-only \{/);
assert.doesNotMatch(css, /html,\s*body\s*\{[^}]*overflow:\s*hidden/);

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

console.log("Qualitative kinematics accessibility checks passed");
