"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");const html=fs.readFileSync(__dirname+"/index.html","utf8"),css=fs.readFileSync(__dirname+"/styles.css","utf8");
assert.match(html,/<html lang="zh-Hant">/);assert.doesNotMatch(html,/role="math"|<var>|MathJax|KaTeX|\\frac|\$\$/);assert.match(html,/aria-label="可旋轉的均勻立體及候選點"/);assert.match(html,/aria-live="polite"/);
assert.match(css,/height:\s*100dvh/);assert.match(css,/overflow-y:\s*auto/);assert.match(css,/overscroll-behavior:\s*contain/);assert.match(css,/touch-action:\s*pan-y/);assert.match(css,/\.direct-target[^}]*[\s\S]*?touch-action:\s*none/);assert.match(css,/min-width:\s*44px/);assert.match(css,/@media\s*\(forced-colors:\s*active\)/);
console.log("Centre-of-mass accessibility checks passed");
