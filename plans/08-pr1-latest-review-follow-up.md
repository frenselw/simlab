# PR #1 Latest Review Follow-up Plan

## Goal

Resolve the actionable findings reported against head `5c6077a` while preserving
the current activity behavior and avoiding new dependencies or framework work.
Completion requires two independent reviewers to report no new actionable
findings in the same review round.

## Scope decisions

- [x] Preserve the plane-mirror UI rule that an image may be placed after at
  least one incident ray exists; restore must accept every state that this UI can
  save or submit.
- [x] Keep reference-frame load-error and pending-final states locked, but never
  describe either technical state as a confirmed submitted attempt.
- [x] Normalize legacy map persistence phases to the three phases the current UI
  actually handles instead of expanding the UI state machine.
- [x] Add focused pure-function/round-trip tests and a browser smoke check; do not
  add JSDOM, a test framework, or another dependency.

## Team workflow

- [x] Root records the starting commit and confirms the worktree contains no
  unrelated changes.
- [x] Root starts one subagent as the implementer. The implementer owns all code,
  test, plan-checklist, and commit changes.
- [x] The implementer may create several small logical commits and must report the
  exact commit reviewed after every implementation pass.
- [x] After the first pass, root starts two independent reviewer subagents:
  - Reviewer A: plane-mirror UI/save/restore/submission consistency and
    reference-frame startup/error-state presentation.
  - Reviewer B: map persistence phase normalization, round-trip validation, and
    regression-test quality.
- [x] Both reviewers inspect the same commit independently and report findings
  with severity, file/line, reproduction, and expected behavior.
- [x] Root deduplicates accepted findings and returns them to the same implementer.
- [x] Implementer fixes findings, adds the smallest relevant regression checks,
  runs validation, and commits.
- [x] Both reviewers re-review the new commit and the complete affected flows.
- [x] Repeat until both reviewers return **no new findings in the same round**.
- [x] Root then performs the final verification and updates this checklist.

## Phase 1 - Plane-mirror partial-image restore

- [x] Trace all ways image state can be created, edited, partially removed,
  drafted, submitted, and restored.
- [x] Keep existing validation for scene geometry, source ordering, ray dependency,
  image choice, finite image geometry, positive image height, and rebuilt IDs.
- [x] Remove the restore-only requirement that an image needs four complete ray
  bundles.
- [x] Require only the same prerequisite used by the production UI: at least one
  valid incident ray before an image can exist.
- [x] Confirm removing a reflected ray or extension does not make an otherwise
  UI-valid image snapshot unrestorable.
- [x] Confirm incomplete submitted answers with an image restore safely for review
  and are rescored rather than replaced by an unavailable fallback.

### Plane-mirror regression checklist

- [x] One incident ray plus a valid virtual image restores.
- [x] Two partial bundles plus an image restore.
- [x] Four incomplete bundles plus an image restore.
- [x] Four complete bundles plus an image restore.
- [x] Removing an extension after placing the image still round-trips.
- [x] Image with zero bundles is rejected because the UI cannot create it.
- [x] Invalid image choice, geometry, height, ray dependency, or source order is
  still rejected.
- [x] Incomplete submitted answer with an image restores and rescoring remains
  consistent with the saved Moodle result contract.

## Phase 2 - Reference-frame technical error presentation

- [x] Separate display wording for a trusted submitted review, a frozen
  pending-final retry, and a load-error/inconsistent startup.
- [x] Pending-final failure remains locked and says the submission state is not
  confirmed and must be retried/reopened.
- [x] Load-error/inconsistent remains locked and says Moodle attempt data could not
  be loaded safely.
- [x] Neither technical state says the attempt was submitted or completed.
- [x] Neither technical state displays a synthetic score or pass/fail status.
- [x] A genuine finished attempt continues to display submitted/review-only text.
- [x] Reuse the existing `unavailableReason`/startup outcome data where possible;
  do not introduce a new general state-machine abstraction.

### Reference-frame regression checklist

- [x] Trusted finished review shows submitted/review-only wording.
- [x] Untrusted finished review shows only the recorded Moodle summary.
- [x] Frozen pending-final retry failure shows pending/unconfirmed wording.
- [x] Read-error and inconsistent startup show load-error wording.
- [x] All technical-error controls remain locked.
- [x] Score remains `--` and completion remains indeterminate when no trustworthy
  Moodle result exists.

## Phase 3 - Map persistence phase normalization

- [x] Treat current production phases as `walk`, `draw-segment`, and `draw-total`.
- [x] Normalize legacy `segment-answer` to `draw-segment` during decode.
- [x] Normalize legacy `ready-submit` to `draw-total` during decode.
- [x] Run `validProgress()` against the normalized phase and existing validated
  answer/arrow data.
- [x] Reject a legacy alias when its required reached/arrow/answer invariants are
  missing.
- [x] Ensure decoded state always has a current UI instruction, current arrow when
  required, and an enabled path to continue.
- [x] Keep encoded snapshots on current production phase names only.

### Map regression checklist

- [x] Valid `segment-answer` snapshot decodes to `draw-segment` and can open the
  segment answer flow.
- [x] Invalid `segment-answer` snapshot without reached/arrow data is rejected.
- [x] Valid `ready-submit` snapshot decodes to `draw-total` and can continue.
- [x] Invalid `ready-submit` snapshot without completed segments/total arrow is
  rejected.
- [x] Production `walk`, `draw-segment`, and `draw-total` round-trip unchanged.
- [x] Scored distance, direction, coverage, and answer validation remain unchanged.

## Phase 4 - Verification coverage

- [x] Add mirror production serializer/restore round-trip cases to the existing
  scoring test rather than creating a new test framework.
- [x] Add map legacy-alias and production-phase cases to the existing persistence
  test.
- [x] Add the smallest directly runnable check for reference-frame startup display
  outcomes; if extracting such a function would add more code than it tests, use
  the focused browser smoke instead.
- [x] Use the existing Git Bash Playwright CLI route for browser verification.
- [x] Browser smoke confirms all four activities load without `### Error`;
  concrete partial-image, frozen-state, and legacy-phase cases are covered by
  runnable automated tests rather than injected browser fixtures.
- [x] Treat any Playwright output containing `### Error` as failure.

## Suggested commit checkpoints

- [x] `Restore partial plane-mirror image states`
- [x] `Clarify reference-frame recovery states`
- [x] `Normalize legacy map phases`
- [x] Additional reviewer-finding commits as required
- [x] `Complete latest review follow-up plan`

Do not squash commits during the review loop. Each reviewer must name the exact
commit inspected.

## Final verification

- [x] `npm.cmd run check`
- [x] `npm.cmd test`
- [x] `npm.cmd run package:all`
- [x] `git diff --check origin/main...HEAD`
- [x] Playwright smoke loads all four activities without browser errors; affected
  recovery-state logic is covered by the focused automated checks above.
- [x] Generated ZIPs contain root `imsmanifest.xml`, required shared/activity
  files, and no tests/screenshots/temp files.
- [x] Reviewer A reports no new findings on the final code commit.
- [x] Reviewer B reports no new findings on the final code commit.
- [x] Root confirms the worktree is clean and records all commits.
- [x] Real Moodle learner-account validation remains explicitly pending unless it
  was actually performed.

## Definition of done

- [x] Every plane-mirror image state allowed by the UI can be restored.
- [x] Reference-frame technical errors are never described as confirmed
  submissions.
- [x] Map decode never returns a phase unsupported by the current UI.
- [x] Relevant automated and browser checks pass.
- [x] Both independent reviewers find no new actionable issues in the same round.
