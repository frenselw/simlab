# PR #1 Third Review Follow-up Plan

## Goal

Resolve the latest review findings against head `677ba52` without expanding the
runtime architecture or adding dependencies. The work is complete only when two
independent reviewers report no new actionable findings in the same review round
and the full quality gate passes.

## Team and collaboration loop

- [ ] Root agent records the starting commit and confirms the worktree is clean.
- [ ] Root agent starts one subagent as the implementer. The implementer owns all
  code and test changes and may create several small, logical commits.
- [ ] Root agent starts two independent reviewer subagents after the first
  implementation pass:
  - Reviewer A: SCORM lifecycle, startup gates, pending-final recovery, BFCache,
    and student-visible result states.
  - Reviewer B: snapshot validation, restore safety, activity outcome tests, and
    regression coverage.
- [ ] Reviewers inspect the same commit independently and report only actionable
  findings with severity, file/line, reproduction path, and expected behavior.
- [ ] Root agent deduplicates findings and sends them back to the implementer.
- [ ] Implementer fixes accepted findings, adds or updates the smallest relevant
  tests, runs the focused checks, and commits the next logical batch.
- [ ] Both reviewers re-review the new commit, including the full affected flow
  rather than only the latest diff.
- [ ] Repeat implementer/reviewer rounds until both reviewers return **no new
  findings in the same round**.
- [ ] Root agent runs the final quality gate and reviews the complete PR diff.

## Phase 1 - SCORM lifecycle and page state

### Unknown startup state must not mutate attempt data

- [ ] Track whether `loadAttempt()` produced `read-error` or `inconsistent`.
- [ ] Block `LMSSetValue()` and `LMSCommit()` during page close when startup state
  is unknown.
- [ ] If initialization succeeded, allow only a best-effort `LMSFinish()` cleanup;
  do not change score, status, exit, or suspend data.
- [ ] Keep normal draft, pending-final, committed-final, and previously finished
  close behavior unchanged.
- [ ] Add fake-LMS checks proving read-error/inconsistent page close performs no
  data writes or commit.

### BFCache lifecycle

- [ ] Replace the unconditional `pagehide` close handler with an event-aware path.
- [ ] On `pagehide.persisted`, save/commit recoverable state without finishing the
  SCORM session.
- [ ] On a persisted `pageshow`, reload the SCO so runtime and LMS session state
  are initialized again from durable draft/pending-final data.
- [ ] Add the smallest runtime test covering persisted pagehide versus permanent
  pagehide behavior.

## Phase 2 - Honest submitted and unavailable result displays

### Reference-frame activity

- [ ] Separate a genuine submitted result from pending-final failure and startup
  load-error/inconsistent UI states.
- [ ] Never synthesize `0 / 100` or `failed` when no trustworthy result exists.
- [ ] For an untrusted completed snapshot, use only a finite Moodle raw score.
- [ ] Derive pass/fail only from `attempt.status === "passed"` or `"failed"`;
  otherwise show that completion status cannot be determined safely.
- [ ] Stop inserting result values through `innerHTML`; build score/status text
  with `textContent` or existing DOM helpers.
- [ ] Add focused tests for trusted result, score mismatch, load error, and frozen
  pending submission outcomes.

### Map activity

- [ ] Replace the untrusted fallback's hard-coded `passed: false` with a
  passed/failed/unknown outcome derived from Moodle lesson status.
- [ ] Render unknown status without saying the learner failed.
- [ ] Preserve the safe score-only fallback when the review snapshot is missing or
  invalid.
- [ ] Add focused tests for Moodle `passed`, `failed`, and unknown status when the
  restored review is untrusted.

### Other activities

- [ ] Check FBD and plane-mirror fallback displays for the same false-result
  pattern; change them only if the same bug is present.

## Phase 3 - Restore validation at trust boundaries

### Plane-mirror snapshot

- [ ] Reject non-finite or invalid scene geometry.
- [ ] Accept only valid `imageChoice` values.
- [ ] When an image exists, require finite `x`, `y`, `height`, and `angle`, with a
  positive height.
- [ ] Rebuild bundle IDs as `1..n` and set `nextId = n + 1`, or reject duplicate
  and invalid IDs; use one consistent safe restore rule.
- [ ] Keep source and segment geometry validation already in place.
- [ ] Add restore tests for duplicate IDs, invalid image choice, missing image
  geometry, non-finite values, and a valid round trip.

### Map coverage and persistence

- [ ] Make `Coverage.expand()` require `0 <= start <= end <= 1`.
- [ ] Reject unknown edge IDs and non-finite interval values as before.
- [ ] Require every restored `routeDistance` to be finite and non-negative; do not
  coerce damaged values to zero.
- [ ] Reject rather than normalize snapshots whose scored data is invalid.
- [ ] Replace the constant route-distance assertion with a production
  encode/decode round-trip assertion.
- [ ] Add regression cases for reversed intervals, both-sided out-of-range values,
  `NaN`, `Infinity`, and negative distance.

## Phase 4 - Activity flow verification

- [ ] Keep `sim/shared/activity-flow.test.js` for shared mapping behavior only;
  rename its description if it implies full activity coverage.
- [ ] Exercise the real outcome function used by each affected activity for:
  success, frozen pending-final, committed finish failure, read-error,
  inconsistent startup, trusted review, and untrusted review.
- [ ] Do not add JSDOM, a test framework, or another runtime dependency.
- [ ] Run a focused browser smoke check through the existing Playwright CLI using
  Git Bash, with any temporary runner stored under ignored `output/playwright/`.
- [ ] Confirm all four activities initialize, load-error never shows a score,
  failed final submission remains frozen, and a trusted submitted attempt remains
  review-only.

## Commit checkpoints

The implementer may combine adjacent items when the diff stays coherent. Suggested
commit boundaries:

- [ ] `Guard SCORM close and BFCache lifecycle`
- [ ] `Render safe activity result fallbacks`
- [ ] `Validate restored activity snapshots`
- [ ] `Cover activity recovery outcomes`
- [ ] Additional reviewer-finding commits as needed

Do not squash during the review loop; each reviewer should name the exact commit
reviewed. Squashing, if wanted, is a separate final decision.

## Final verification

- [ ] `npm.cmd run check`
- [ ] `npm.cmd test`
- [ ] `npm.cmd run package:all`
- [ ] `git diff --check origin/main...HEAD`
- [ ] Inspect each generated ZIP: `imsmanifest.xml` at root, required shared files
  present, no tests/screenshots/temp files.
- [ ] Reviewer A reports no new findings on the final commit.
- [ ] Reviewer B reports no new findings on the final commit.
- [ ] Root agent confirms all review findings are fixed or explicitly documented
  as accepted limitations.
- [ ] Record Moodle manual validation as still pending unless it was actually run
  with a learner account.

## Definition of done

- [ ] No technical/load error is displayed as a learner score or failure.
- [ ] Unknown startup state cannot overwrite SCORM attempt data.
- [ ] BFCache restoration cannot continue with a finished in-memory session.
- [ ] Damaged mirror/map snapshots are rejected or safely reconstructed without
  changing their scored meaning.
- [ ] Two independent reviewers find no new actionable issues in the same round.
- [ ] All automated checks and package inspection pass.
