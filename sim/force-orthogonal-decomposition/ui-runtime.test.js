"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(main, /function startup\(\)/);
assert.match(main, /SimActivityFlow\.startup\(attempt\)/);
assert.match(main, /runtimeState = "frozen"/);
assert.match(main, /目前不能安全地繼續編輯或確認提交/);
assert.match(main, /review-only，作答已鎖定/);
assert.match(main, /SimActivityFlow\.reviewResult/);
assert.match(main, /SimActivityFlow\.submission\(outcome, submissionHandlers\(\)\)/);
assert.match(main, /runtimeState !== "editable"/);
assert.match(main, /dom\.submitAttempt\.disabled = runtimeState !== "editable"/);
assert.match(main, /activity\.currentQuestion = index/);
assert.match(main, /activity\.fromReview = Boolean\(fromSummary\)/);
assert.match(main, /Persistence\.makeSnapshot\("review"/);
assert.match(html, /id="questionProgress"/);
assert.match(html, /id="reviewQuestionNavigation"/);
assert.match(html, /id="submitAttempt"[^>]*type="button"/);
assert.match(html, /id="returnToPractice"[^>]*type="button"/);

console.log("force orthogonal decomposition UI runtime tests passed");
