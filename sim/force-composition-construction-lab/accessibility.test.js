"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const App = require("./main.js");
const G = require("./generator.js");
const P = require("./persistence.js");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
assert.match(html, /<html lang="zh-Hant">/);
assert.match(html, /id="liveRegion"[^>]*aria-live="polite"/);
assert.match(html, /id="dragLayer"[^>]*aria-label="作圖操作層"/);
assert.match(html, /id="stageSvg"[^>]*role="img"[^>]*aria-describedby="stageDescription"/);
assert.match(html, /id="magnifierSvg"[^>]*class="magnifier-svg"/);
assert.match(html, /id="magnifierFocus"[^>]*class="magnifier-focus"/);
assert.doesNotMatch(html, /id="forceSelector"/);
assert.match(html, /class="drag-layer"/);
assert.match(html, /id="drawResultant"[^>]*aria-pressed="false"/);
assert.match(html, /id="deleteResultant"/);
assert.match(html, /id="submitDialog"/);
assert.match(html, /仍要提交/);
assert.match(css, /\.force-hit[\s\S]*height:\s*44px/);
assert.match(css, /\.line-handle[\s\S]*width:\s*44px[\s\S]*height:\s*44px/);
assert.match(css, /touch-action:\s*pan-y/);
assert.match(css, /touch-action:\s*none/);
assert.match(css, /\.magnifier-svg\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/s);
assert.match(css, /\.magnifier-focus\s*\{/);
assert.match(css, /overscroll-behavior:\s*contain/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /\.force-hit:focus-visible\s*\{[^}]*outline:\s*3px/s);
assert.match(css, /\.resultant-hit:focus-visible\s*\{[^}]*outline:\s*3px/s);
assert.match(css, /\.line-handle\.is-offset\s*\{[^}]*font-size:/s);
assert.match(css, /\.line-handle\.is-offset\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
assert.match(css, /\.stage\.resultant-draw-ready\s*\{[^}]*touch-action:\s*none/s);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.math-vector\s*\{[^}]*font-style:\s*italic[^}]*font-weight:\s*700/s);
assert.match(css, /\.math-subscript-upright\s*\{[^}]*font-style:\s*normal/s);
assert.doesNotMatch(html + css, /MathJax|KaTeX|cdnjs|unpkg|jsdelivr/i);
assert.match(main, /button\.dataset\.semanticKey = `guide-clear-\$\{index\}`/);
assert.match(main, /button\.dataset\.semanticKey = review \? `review-question-\$\{index\}` : `question-progress-\$\{index\}`/);
assert.match(main, /button\.setAttribute\("aria-label", `\$\{scenario\.questions\[index\]\.id\}/);
assert.match(main, /dom\.app\.querySelectorAll\("\[data-semantic-key\]"\)/);
assert.match(main, /focusFallbackKeys: \["draw-resultant", "question-title"\]/);

const scenario = G.generateScenario({ seed: 31 });
const state = P.freshState(31);
for (let index = 0; index < 5; index += 1) {
  const view = App.questionView(state, scenario, index);
  assert.ok(view.title && view.prompt && view.step);
  assert.doesNotMatch(`${view.title} ${view.prompt} ${view.step}`, /平衡四邊形|手尾連接|兩個質量/);
}
assert.equal(App.QUESTION_COPY.length, 5);

console.log("force-composition accessibility tests passed");
