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
assert.match(main, /只供查閱，作答已鎖定/);
assert.doesNotMatch(main, /有厚度斜面／固定原力|review-only，作答已鎖定/);
assert.doesNotMatch(main, /"data-label": "force-head"/, "the force arrowhead is not labelled P");
assert.doesNotMatch(main + html, /頂點 P|O 或 P/, "learner instructions do not reference the removed P label");
assert.match(main, /SimActivityFlow\.reviewResult/);
assert.match(main, /reviewFormulaSummary/);
assert.match(main, /reviewResult\?\.trusted === true/);
assert.match(main, /row\.dataset\.result = result/);
assert.match(main, /activity\.phase !== "practice"/);
assert.match(main, /SimActivityFlow\.submission\(outcome, submissionHandlers\(\)\)/);
assert.match(main, /function isPracticeEditable\(\)/);
assert.match(main, /活動必要共用模組未能載入；已停用作答及提交/);
assert.match(main, /必要共用模組未能載入；已停用提交，未寫入 LMS/);
assert.match(main, /function clearInteractionTransient\(\)/);
assert.match(main, /reviewQuestionNavigation\.hidden = !trusted/);
assert.match(main, /const detail = reviewResult\.result\.detail\[index\]/, "review tabs share the verified versioned result instead of regrading answers");
assert.match(main, /reviewResult\?\.trusted !== false && reviewSnapshot\?\.answer\?\.questions/);
assert.match(main, /runtimeState !== "editable"/);
assert.match(main, /dom\.submitAttempt\.disabled = runtimeState !== "editable"/);
assert.match(main, /activity\.currentQuestion = index/);
assert.match(main, /activity\.fromReview = Boolean\(fromSummary\)/);
assert.match(main, /Persistence\.makeSnapshot\("review"/);
assert.match(html, /id="questionProgress"/);
assert.match(html, /id="reviewQuestionNavigation"/);
assert.match(html, /id="reviewFormulaSummary"/);
assert.match(html, /id="reviewFormulaRows"/);
assert.match(html, /id="submitAttempt"[^>]*type="button"/);
assert.match(html, /id="returnToPractice"[^>]*type="button"/);
assert.doesNotMatch(html, /checkFormulasButton|檢查本題公式|formulaFeedback|data-formula-feedback/);
assert.doesNotMatch(main, /checkFormulasButton|formulaResult|M\.checkFormulas\(state\)/);

console.log("force orthogonal decomposition UI runtime tests passed");
