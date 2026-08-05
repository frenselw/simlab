"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const App = require("./main.js");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const beforeResult = html.slice(0, html.indexOf('<section id="resultPanel"'));
assert.equal(beforeResult.includes("trueExtensionM"), false);
assert.equal(beforeResult.includes("trueSprings"), false);
assert.equal(beforeResult.includes("scoreViewModel"), false);
assert.match(html, /resultPanel" class="panel-section [^"]*\bis-hidden\b[^"]*"[^>]*><\/section>/);
assert.match(source, /function mayRevealCorrectness/);
assert.match(source, /mayRevealCorrectness\(presentation\)/);
assert.match(source, /if \(mayRevealCorrectness\(presentation\)\) return renderResult/);
assert.match(source, /presentation === "technical" \|\| presentation === "frozen"[\s\S]*?renderTechnical/);
assert.match(source, /latestResult = null; renderFrozen/);
assert.doesNotMatch(source, /editable\.trueSprings/);
assert.doesNotMatch(source, /result\.breakdown\.predictions.*actualExtensionM/);
for (const state of ["editable", "retry", "frozen", "load-error"]) assert.equal(App.mayRevealCorrectness(state), false);
assert.equal(App.mayRevealCorrectness("submitted-success"), true);

console.log("Hooke's law delayed-feedback checks passed");
