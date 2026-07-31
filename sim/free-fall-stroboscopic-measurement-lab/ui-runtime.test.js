"use strict";
const assert = require("assert");
const App = require("./main.js");
const Persistence = require("./persistence.js");
const PersistenceFixtures = require("./persistence.test.js");
const Scoring = require("./scoring.js");

assert.deepStrictEqual(App.startupView("editable"), { editable: true, locked: false, mode: "activity" });
assert.strictEqual(App.startupView("review").mode, "review");
assert.strictEqual(App.startupView("frozen").mode, "pending");
assert.strictEqual(App.startupView("load-error").mode, "technical");
assert.deepStrictEqual(App.submissionView({ activityState: "success" }), { locked: true, mode: "review", trusted: true, retry: "none" });
assert.strictEqual(App.submissionView({ activityState: "committed" }).retry, "finish");
assert.strictEqual(App.submissionView({ activityState: "frozen" }).trusted, false);
assert.strictEqual(App.submissionView({ activityState: "retry", retryable: true }).locked, false);
assert.strictEqual(App.submissionView({ activityState: "retry", retryable: false }).locked, true);
assert.strictEqual(App.formatPhotoCm(5, 0), "0");
assert.strictEqual(App.formatPhotoCm(5, .2), "0.29");
assert.strictEqual(App.formatPhotoCm(5, 3.2), "4.57");
assert.strictEqual(App.photoCmToMeters(5, 5), 3.5);
assert.ok(Math.abs(App.photoCmToMeters(5, Number(App.formatPhotoCm(5, .2))) - .2) > 1e-6,
  "rounded 0.01 cm display is not an authoritative round-trip");
const editBaseline = App.formatPhotoCm(5, .1, 12);
assert.deepStrictEqual(App.resolveManualReading(5, editBaseline, editBaseline, .1),
  { ok: true, readingM: .1, reusedOriginal: true });
assert.deepStrictEqual(App.resolveManualReading(5, "0.2", editBaseline, .1),
  { ok: true, readingM: .14, reusedOriginal: false });
for (const value of ["", "Infinity", "-0.1", "5.1"]) {
  assert.strictEqual(App.resolveManualReading(5, value).ok, false);
}
assert.match(App.mathQuantity("Δt", "0.2000", "s"), /class="delta">Δ<\/span><var>t<\/var>.* = .*0\.2000.*unit.*s/);

const review = PersistenceFixtures.review;
const result = Scoring.scoreAttempt(review);
const nested = { version: 1, activity: App.ACTIVITY, kind: "review", answer: review, score: result.score, passed: result.passed };
const payload = { reviewJson: JSON.stringify(nested), score: result.score, maxScore: 100, passed: result.passed };
assert.strictEqual(App.canonicalReviewMatches(review, payload, result), true);
const changed = JSON.parse(JSON.stringify(review));
changed.analysis.lawAnswerId = "linear";
assert.strictEqual(App.canonicalReviewMatches(changed, payload, Scoring.scoreAttempt(changed)), false);
assert.strictEqual(App.canonicalReviewMatches(review, { ...payload, score: 59 }, result), false);
assert.strictEqual(App.canonicalReviewMatches(review, { ...payload, maxScore: 99 }, result), false);
assert.strictEqual(App.canonicalReviewMatches(review, { ...payload, passed: !result.passed }, result), false);
assert.strictEqual(App.canonicalReviewMatches(review, { ...payload, reviewJson: JSON.stringify({ ...nested, score: 59 }) }, result), false);
assert.strictEqual(App.canonicalReviewMatches(review, { ...payload, reviewJson: JSON.stringify({ ...nested, passed: !result.passed }) }, result), false);
assert.strictEqual(App.canonicalReviewMatches(review, { ...payload, reviewJson: JSON.stringify({ ...nested, activity: "wrong" }) }, result), false);
const feedback = App.resultFeedbackItems(review, result).join("\n");
assert.match(feedback, /理想相片上總位移/);
assert.match(feedback, /容差/);
assert.match(feedback, /cm/);
assert.match(feedback, /相片上/);
assert.doesNotMatch(feedback, /\d(?:\.\d+)? m(?:；|。)/);
assert.match(feedback, /1:4:9:16/);
assert.match(feedback, /1:3:5:7/);
assert.doesNotMatch(feedback, /P[₀-₄]/, "plain-text scoring feedback does not emit an unstructured physical point symbol");

const boundaryReview = JSON.parse(JSON.stringify(review));
[.1, 1, 2, 3].forEach((readingM, index) => {
  boundaryReview.measurements[Scoring.TOTAL_KEYS[index]].readingM = readingM;
});
boundaryReview.measurements.total4.usedTotalPlacement = false;
boundaryReview.analysis.cumulativeTimeRatio = { status: "answered", values: [1, 99, 3, 4] };
boundaryReview.analysis.totalDisplacementRatio = { status: "answered", values: [1, 9.85, 20, 30] };
boundaryReview.analysis.lawAnswerId = "linear";
boundaryReview.analysis.intervalLawAnswerId = "equal";
boundaryReview.analysis.accelerationAnswerId = "constant-speed";
assert.ok(Persistence.validateReview(boundaryReview));
const boundaryBefore = Scoring.scoreAttempt(boundaryReview);
assert.deepStrictEqual({ score: boundaryBefore.score, passed: boundaryBefore.passed }, { score: 60, passed: true });
const unchanged = App.resolveManualReading(5, editBaseline, editBaseline, .1);
const boundaryEdit = Persistence.edit(Persistence.fromReview(boundaryReview), "total", 0);
const boundaryEvidenceBefore = JSON.parse(JSON.stringify(boundaryEdit.evidence));
const unchangedState = Persistence.resolveMeasurement(
  boundaryEdit, unchanged.readingM, false, { reusedOriginal: unchanged.reusedOriginal });
const unchangedReview = Persistence.makeReview(unchangedState);
const boundaryAfter = Scoring.scoreAttempt(unchangedReview);
assert.ok(Object.is(unchangedReview.measurements.total1.readingM,
  boundaryReview.measurements.total1.readingM));
assert.deepStrictEqual(unchangedReview.evidence, boundaryEvidenceBefore,
  "unchanged total confirmation preserves all existing process evidence exactly");
assert.deepStrictEqual({ score: boundaryAfter.score, passed: boundaryAfter.passed },
  { score: boundaryBefore.score, passed: boundaryBefore.passed },
  "unchanged review-edit baseline preserves canonical reading, score, and pass exactly");
const gapEdit = Persistence.edit(Persistence.fromReview(review), "interval", 0);
const gapEvidenceBefore = JSON.parse(JSON.stringify(gapEdit.evidence));
const originalGap = gapEdit.measurements.gap01.readingM;
const unchangedGapState = Persistence.resolveMeasurement(
  gapEdit, originalGap, false, { reusedOriginal: true });
assert.ok(Object.is(unchangedGapState.measurements.gap01.readingM, originalGap));
assert.deepStrictEqual(unchangedGapState.evidence, gapEvidenceBefore,
  "unchanged gap confirmation preserves its evidence exactly");
assert.deepStrictEqual(Scoring.scoreAttempt(unchangedGapState), Scoring.scoreAttempt(review),
  "unchanged gap confirmation preserves the complete score result");
const roundedReplacement = App.resolveManualReading(5, `${editBaseline}0`, editBaseline, .1);
const changedBoundaryState = Persistence.resolveMeasurement(
  Persistence.edit(Persistence.fromReview(boundaryReview), "total", 0),
  roundedReplacement.readingM, false, { reusedOriginal: roundedReplacement.reusedOriginal });
const changedReviewAtBoundary = Persistence.makeReview(changedBoundaryState);
const changedBoundaryScore = Scoring.scoreAttempt(changedReviewAtBoundary);
assert.notStrictEqual(roundedReplacement.readingM, .1);
assert.strictEqual(changedReviewAtBoundary.measurements.total1.usedTotalPlacement, false,
  "changed total text without a new valid placement clears its process link");
assert.ok(changedBoundaryScore.score < 60 && !changedBoundaryScore.passed,
  "changed text follows one-time conversion and may cross the documented pass boundary");
const changedGapState = Persistence.resolveMeasurement(
  Persistence.edit(Persistence.fromReview(review), "interval", 0),
  originalGap + .01, false, { reusedOriginal: false });
assert.strictEqual(changedGapState.evidence.gap01, undefined,
  "changed gap text without a new valid placement clears its evidence");
console.log("free-fall UI lifecycle tests passed");
