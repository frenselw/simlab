# PR #1 Third Review Follow-up Plan

## Goal

Resolve the latest review findings against head `677ba52` without expanding the
runtime architecture or adding dependencies. The work is complete only when two
independent reviewers report no new actionable findings in the same review round
and the full quality gate passes.

## Completion status

- [x] Implementation completed across the planned lifecycle, result, and restore-safety phases.
- [x] Six implementer/reviewer rounds completed; both independent reviewers reported no new actionable findings in the final round.
- [x] Automated checks, SCORM package verification, and focused Playwright smoke checks passed.
- [ ] Real Moodle learner-account validation was not performed and remains pending.

## Team and collaboration loop

- [x] Root agent records the starting commit and confirms the worktree is clean.
- [x] Root agent starts one subagent as the implementer. The implementer owns all
  code and test changes and may create several small, logical commits.
- [x] Root agent starts two independent reviewer subagents after the first
  implementation pass:
  - Reviewer A: SCORM lifecycle, startup gates, pending-final recovery, BFCache,
    and student-visible result states.
  - Reviewer B: snapshot validation, restore safety, activity outcome tests, and
    regression coverage.
- [x] Reviewers inspect the same commit independently and report only actionable
  findings with severity, file/line, reproduction path, and expected behavior.
- [x] Root agent deduplicates findings and sends them back to the implementer.
- [x] Implementer fixes accepted findings, adds or updates the smallest relevant
  tests, runs the focused checks, and commits the next logical batch.
- [x] Both reviewers re-review the new commit, including the full affected flow
  rather than only the latest diff.
- [x] Repeat implementer/reviewer rounds until both reviewers return **no new
  findings in the same round**.
- [x] Root agent runs the final quality gate and reviews the complete PR diff.

## Phase 1 - SCORM lifecycle and page state

### Unknown startup state must not mutate attempt data

- [x] Track whether `loadAttempt()` produced `read-error` or `inconsistent`.
- [x] Block `LMSSetValue()` and `LMSCommit()` during page close when startup state
  is unknown.
- [x] If initialization succeeded, allow only a best-effort `LMSFinish()` cleanup;
  do not change score, status, exit, or suspend data.
- [x] Keep normal draft, pending-final, committed-final, and previously finished
  close behavior unchanged.
- [x] Add fake-LMS checks proving read-error/inconsistent page close performs no
  data writes or commit.

### BFCache lifecycle

- [x] Replace the unconditional `pagehide` close handler with an event-aware path.
- [x] On `pagehide.persisted`, save/commit recoverable state without finishing the
  SCORM session.
- [x] On a persisted `pageshow`, reload the SCO so runtime and LMS session state
  are initialized again from durable draft/pending-final data.
- [x] Add the smallest runtime test covering persisted pagehide versus permanent
  pagehide behavior.

## Phase 2 - Honest submitted and unavailable result displays

### Reference-frame activity

- [x] Separate a genuine submitted result from pending-final failure and startup
  load-error/inconsistent UI states.
- [x] Never synthesize `0 / 100` or `failed` when no trustworthy result exists.
- [x] For an untrusted completed snapshot, use only a finite Moodle raw score.
- [x] Derive pass/fail only from `attempt.status === "passed"` or `"failed"`;
  otherwise show that completion status cannot be determined safely.
- [x] Stop inserting result values through `innerHTML`; build score/status text
  with `textContent` or existing DOM helpers.
- [x] Add focused tests for trusted result, score mismatch, load error, and frozen
  pending submission outcomes.

### Map activity

- [x] Replace the untrusted fallback's hard-coded `passed: false` with a
  passed/failed/unknown outcome derived from Moodle lesson status.
- [x] Render unknown status without saying the learner failed.
- [x] Preserve the safe score-only fallback when the review snapshot is missing or
  invalid.
- [x] Add focused tests for Moodle `passed`, `failed`, and unknown status when the
  restored review is untrusted.

### Other activities

- [x] Check FBD and plane-mirror fallback displays for the same false-result
  pattern; change them only if the same bug is present.

## Phase 3 - Restore validation at trust boundaries

### Plane-mirror snapshot

- [x] Reject non-finite or invalid scene geometry.
- [x] Accept only valid `imageChoice` values.
- [x] When an image exists, require finite `x`, `y`, `height`, and `angle`, with a
  positive height.
- [x] Rebuild bundle IDs as `1..n` and set `nextId = n + 1`, or reject duplicate
  and invalid IDs; use one consistent safe restore rule.
- [x] Keep source and segment geometry validation already in place.
- [x] Add restore tests for duplicate IDs, invalid image choice, missing image
  geometry, non-finite values, and a valid round trip.

### Map coverage and persistence

- [x] Make `Coverage.expand()` require `0 <= start <= end <= 1`.
- [x] Reject unknown edge IDs and non-finite interval values as before.
- [x] Require every restored `routeDistance` to be finite and non-negative; do not
  coerce damaged values to zero.
- [x] Reject rather than normalize snapshots whose scored data is invalid.
- [x] Replace the constant route-distance assertion with a production
  encode/decode round-trip assertion.
- [x] Add regression cases for reversed intervals, both-sided out-of-range values,
  `NaN`, `Infinity`, and negative distance.

## Phase 4 - Activity flow verification

- [x] Keep `sim/shared/activity-flow.test.js` for shared mapping behavior only;
  rename its description if it implies full activity coverage.
- [x] Exercise the real outcome function used by each affected activity for:
  success, frozen pending-final, committed finish failure, read-error,
  inconsistent startup, trusted review, and untrusted review.
- [x] Do not add JSDOM, a test framework, or another runtime dependency.
- [x] Run a focused browser smoke check through the existing Playwright CLI using
  Git Bash, with any temporary runner stored under ignored `output/playwright/`.
- [x] Confirm all four activities initialize, load-error never shows a score,
  failed final submission remains frozen, and a trusted submitted attempt remains
  review-only.

## Commit checkpoints

The implementer may combine adjacent items when the diff stays coherent. Suggested
commit boundaries:

- [x] `Guard SCORM close and BFCache lifecycle`
- [x] `Render safe activity result fallbacks`
- [x] `Validate restored activity snapshots`
- [x] `Cover activity recovery outcomes`
- [x] Additional reviewer-finding commits as needed

Do not squash during the review loop; each reviewer should name the exact commit
reviewed. Squashing, if wanted, is a separate final decision.

## Final verification

- [x] `npm.cmd run check`
- [x] `npm.cmd test`
- [x] `npm.cmd run package:all`
- [x] `git diff --check origin/main...HEAD`
- [x] Inspect each generated ZIP: `imsmanifest.xml` at root, required shared files
  present, no tests/screenshots/temp files.
- [x] Reviewer A reports no new findings on the final commit.
- [x] Reviewer B reports no new findings on the final commit.
- [x] Root agent confirms all review findings are fixed or explicitly documented
  as accepted limitations.
- [ ] Record Moodle manual validation as still pending unless it was actually run
  with a learner account.

## Definition of done

- [x] No technical/load error is displayed as a learner score or failure.
- [x] Unknown startup state cannot overwrite SCORM attempt data.
- [x] BFCache restoration cannot continue with a finished in-memory session.
- [x] Damaged mirror/map snapshots are rejected or safely reconstructed without
  changing their scored meaning.
- [x] Two independent reviewers find no new actionable issues in the same round.
- [x] All automated checks and package inspection pass.
