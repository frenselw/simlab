# PR #1 Latest Review Follow-up Plan

## Goal

Resolve the actionable findings reported against head `5c6077a` while preserving
the current activity behavior and avoiding new dependencies or framework work.
Completion requires two independent reviewers to report no new actionable
findings in the same review round.

## Scope decisions

- [ ] Preserve the plane-mirror UI rule that an image may be placed after at
  least one incident ray exists; restore must accept every state that this UI can
  save or submit.
- [ ] Keep reference-frame load-error and pending-final states locked, but never
  describe either technical state as a confirmed submitted attempt.
- [ ] Normalize legacy map persistence phases to the three phases the current UI
  actually handles instead of expanding the UI state machine.
- [ ] Add focused pure-function/round-trip tests and a browser smoke check; do not
  add JSDOM, a test framework, or another dependency.

## Team workflow

- [ ] Root records the starting commit and confirms the worktree contains no
  unrelated changes.
- [ ] Root starts one subagent as the implementer. The implementer owns all code,
  test, plan-checklist, and commit changes.
- [ ] The implementer may create several small logical commits and must report the
  exact commit reviewed after every implementation pass.
- [ ] After the first pass, root starts two independent reviewer subagents:
  - Reviewer A: plane-mirror UI/save/restore/submission consistency and
    reference-frame startup/error-state presentation.
  - Reviewer B: map persistence phase normalization, round-trip validation, and
    regression-test quality.
- [ ] Both reviewers inspect the same commit independently and report findings
  with severity, file/line, reproduction, and expected behavior.
- [ ] Root deduplicates accepted findings and returns them to the same implementer.
- [ ] Implementer fixes findings, adds the smallest relevant regression checks,
  runs validation, and commits.
- [ ] Both reviewers re-review the new commit and the complete affected flows.
- [ ] Repeat until both reviewers return **no new findings in the same round**.
- [ ] Root then performs the final verification and updates this checklist.

## Phase 1 - Plane-mirror partial-image restore

- [ ] Trace all ways image state can be created, edited, partially removed,
  drafted, submitted, and restored.
- [ ] Keep existing validation for scene geometry, source ordering, ray dependency,
  image choice, finite image geometry, positive image height, and rebuilt IDs.
- [ ] Remove the restore-only requirement that an image needs four complete ray
  bundles.
- [ ] Require only the same prerequisite used by the production UI: at least one
  valid incident ray before an image can exist.
- [ ] Confirm removing a reflected ray or extension does not make an otherwise
  UI-valid image snapshot unrestorable.
- [ ] Confirm incomplete submitted answers with an image restore safely for review
  and are rescored rather than replaced by an unavailable fallback.

### Plane-mirror regression checklist

- [ ] One incident ray plus a valid virtual image restores.
- [ ] Two partial bundles plus an image restore.
- [ ] Four incomplete bundles plus an image restore.
- [ ] Four complete bundles plus an image restore.
- [ ] Removing an extension after placing the image still round-trips.
- [ ] Image with zero bundles is rejected because the UI cannot create it.
- [ ] Invalid image choice, geometry, height, ray dependency, or source order is
  still rejected.
- [ ] Incomplete submitted answer with an image restores and rescoring remains
  consistent with the saved Moodle result contract.

## Phase 2 - Reference-frame technical error presentation

- [ ] Separate display wording for a trusted submitted review, a frozen
  pending-final retry, and a load-error/inconsistent startup.
- [ ] Pending-final failure remains locked and says the submission state is not
  confirmed and must be retried/reopened.
- [ ] Load-error/inconsistent remains locked and says Moodle attempt data could not
  be loaded safely.
- [ ] Neither technical state says the attempt was submitted or completed.
- [ ] Neither technical state displays a synthetic score or pass/fail status.
- [ ] A genuine finished attempt continues to display submitted/review-only text.
- [ ] Reuse the existing `unavailableReason`/startup outcome data where possible;
  do not introduce a new general state-machine abstraction.

### Reference-frame regression checklist

- [ ] Trusted finished review shows submitted/review-only wording.
- [ ] Untrusted finished review shows only the recorded Moodle summary.
- [ ] Frozen pending-final retry failure shows pending/unconfirmed wording.
- [ ] Read-error and inconsistent startup show load-error wording.
- [ ] All technical-error controls remain locked.
- [ ] Score remains `--` and completion remains indeterminate when no trustworthy
  Moodle result exists.

## Phase 3 - Map persistence phase normalization

- [ ] Treat current production phases as `walk`, `draw-segment`, and `draw-total`.
- [ ] Normalize legacy `segment-answer` to `draw-segment` during decode.
- [ ] Normalize legacy `ready-submit` to `draw-total` during decode.
- [ ] Run `validProgress()` against the normalized phase and existing validated
  answer/arrow data.
- [ ] Reject a legacy alias when its required reached/arrow/answer invariants are
  missing.
- [ ] Ensure decoded state always has a current UI instruction, current arrow when
  required, and an enabled path to continue.
- [ ] Keep encoded snapshots on current production phase names only.

### Map regression checklist

- [ ] Valid `segment-answer` snapshot decodes to `draw-segment` and can open the
  segment answer flow.
- [ ] Invalid `segment-answer` snapshot without reached/arrow data is rejected.
- [ ] Valid `ready-submit` snapshot decodes to `draw-total` and can continue.
- [ ] Invalid `ready-submit` snapshot without completed segments/total arrow is
  rejected.
- [ ] Production `walk`, `draw-segment`, and `draw-total` round-trip unchanged.
- [ ] Scored distance, direction, coverage, and answer validation remain unchanged.

## Phase 4 - Verification coverage

- [ ] Add mirror production serializer/restore round-trip cases to the existing
  scoring test rather than creating a new test framework.
- [ ] Add map legacy-alias and production-phase cases to the existing persistence
  test.
- [ ] Add the smallest directly runnable check for reference-frame startup display
  outcomes; if extracting such a function would add more code than it tests, use
  the focused browser smoke instead.
- [ ] Use the existing Git Bash Playwright CLI route for browser verification.
- [ ] Browser smoke confirms partial mirror draft reload, reference load-error
  wording, reference pending-final wording, and restored map legacy phases.
- [ ] Treat any Playwright output containing `### Error` as failure.

## Suggested commit checkpoints

- [ ] `Restore partial plane-mirror image states`
- [ ] `Clarify reference-frame recovery states`
- [ ] `Normalize legacy map phases`
- [ ] Additional reviewer-finding commits as required
- [ ] `Complete latest review follow-up plan`

Do not squash commits during the review loop. Each reviewer must name the exact
commit inspected.

## Final verification

- [ ] `npm.cmd run check`
- [ ] `npm.cmd test`
- [ ] `npm.cmd run package:all`
- [ ] `git diff --check origin/main...HEAD`
- [ ] Focused Playwright smoke passes for all affected flows.
- [ ] Generated ZIPs contain root `imsmanifest.xml`, required shared/activity
  files, and no tests/screenshots/temp files.
- [ ] Reviewer A reports no new findings on the final code commit.
- [ ] Reviewer B reports no new findings on the final code commit.
- [ ] Root confirms the worktree is clean and records all commits.
- [ ] Real Moodle learner-account validation remains explicitly pending unless it
  was actually performed.

## Definition of done

- [ ] Every plane-mirror image state allowed by the UI can be restored.
- [ ] Reference-frame technical errors are never described as confirmed
  submissions.
- [ ] Map decode never returns a phase unsupported by the current UI.
- [ ] Relevant automated and browser checks pass.
- [ ] Both independent reviewers find no new actionable issues in the same round.
