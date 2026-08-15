"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sourceParity, query } = require("./force-composition-browser-regression.js");

assert.ok(sourceParity().length >= 11, "browser parity covers all local and shared runtime files");
assert.match(query(7), /__seed=7/);
const browser = fs.readFileSync(path.join(__dirname, "force-composition-browser-regression.js"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "..", "sim", "force-composition-construction-lab", "main.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "quality.yml"), "utf8");
assert.equal(packageJson.scripts["test:browser:force-composition"], "node tools/force-composition-browser-regression.js");
assert.match(workflow, /npm run test:browser:force-composition/);
assert.match(browser, /Input\.dispatchTouchEvent/);
assert.match(browser, /isTrusted/);
assert.match(browser, /pointerType === "touch"/);
assert.match(browser, /runTouchMatrix/);
assert.match(browser, /runTripleOrders/);
assert.match(browser, /runBlankSubmission/);
assert.match(browser, /runDraftReload/);
assert.match(browser, /sourceTouch/);
assert.match(browser, /packageTouch/);
assert.match(browser, /enterResultantMode/);
assert.match(browser, /#drawResultant/);
assert.match(browser, /__embed-scroll-test\.html/);
assert.match(main, /marker-end/);
assert.match(main, /resultant-start-edit/);
assert.match(main, /beginFreeResultantDrag/);

console.log("force-composition browser regression wiring tests passed");
