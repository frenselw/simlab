"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");const html=fs.readFileSync(__dirname+"/index.html","utf8"),css=fs.readFileSync(__dirname+"/styles.css","utf8");
assert.match(html,/<html lang="zh-Hant">/);assert.doesNotMatch(html,/role="math"|<var>|MathJax|KaTeX|\\frac|\$\$/);assert.match(html,/aria-label="可旋轉的均勻立體及候選點"/);assert.match(html,/aria-live="polite"/);
assert.doesNotMatch(html,/a11y-actions|data-reset-part/);for(const id of ["part1Controls","part2Controls","part3Controls"]){const section=html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0]||"";assert.doesNotMatch(section,/<button\\b/,`${id} has no normal-panel operational buttons`);}
assert.match(css,/height:\s*100dvh/);assert.match(css,/overflow-y:\s*auto/);assert.match(css,/overscroll-behavior:\s*contain/);assert.match(css,/touch-action:\s*pan-y/);assert.match(css,/\.direct-target[^}]*[\s\S]*?touch-action:\s*none/);assert.match(css,/min-width:\s*44px/);assert.match(css,/@media\s*\(forced-colors:\s*active\)/);
console.log("Centre-of-mass accessibility checks passed");
