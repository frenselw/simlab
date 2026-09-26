# Simulation and SCORM Production Guide

Use this guide before building a new SimLab simulation. It records the practical
SCORM/Moodle behaviors that are easy to miss. The
[shared design baseline](../plans/00-shared-platform-and-style.md) owns product and
visual rules; this guide owns implementation and acceptance checks.

## End-to-end workflow

Follow this order when creating a simulation from scratch:

1. Read `AGENTS.md` and `plans/00-shared-platform-and-style.md` for the project
   rules and shared design baseline.
2. Copy `plans/NEW-SIMULATION-PLAN-TEMPLATE.md` to a simulation-specific plan and
   complete its scope, catalogue metadata, subject model, scoring, and tolerance.
3. Define the phase/state matrix, persistence contract, invalid-state policy,
   SCORM lifecycle outcomes, and test plan before building the UI.
4. Implement the activity with the shared styles, SCORM runtime, and activity
   flow; keep scoring and persistence logic independently testable.
5. Register the activity in `sim/config.js`, its manifest, and the test runner.
6. Complete the [Package-ready checks](#package-ready-checks), including the
   built-package browser smoke test.
7. Complete the [Moodle-ready checks](#moodle-ready-checks) in a real Moodle
   student attempt.

The simulation-specific plan is the implementation blueprint. It may specialize
the subject model and rubric, but it must not silently override the shared
lifecycle, persistence, trust, or packaging contracts in this guide.

## Before coding

- Write a simulation plan in `plans/` before implementation.
- Copy `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`; do not start from an empty file.
- Give the work a specific slug, not a generic topic name. Example:
  `plane-mirror-pencil-ray-diagram`, not `optics`.
- Define the learner task, required interactions, scoring rubric, tolerance
  choices, feedback, and SCORM behavior before drawing the UI.
- Classify the assessment as formative, low-risk graded, or high-risk graded.
  Browser-scored SCORM is not a trusted grading boundary; high-risk work needs
  server-side answer validation.
- Keep the first version to one clear scenario unless variation is part of the
  learning objective.
- Start with static HTML, CSS, and JavaScript. Add libraries only when they
  remove real complexity.

## Canonical SimLab activity shape

```text
sim/<slug>/
  index.html
  styles.css
  main.js
  scoring.js
  scoring.test.js
  persistence.js       # only when draft/review state needs a separate model
  persistence.test.js  # required when persistence.js exists
```

Also update:

- `sim/config.js` with one non-duplicate entry containing `title`, `folder`,
  `categories`, `description`, `tags`, and `status`; `folder` must match the
  directory/manifest slug and only deployable activities may be `active`;
- `sim/manifests/<slug>.xml` with every runtime file, including shared helpers;
- `tools/run-tests.js` with every new test file.

Use `sim/shared/styles.css`, `sim/shared/scorm.js`, and
`sim/shared/activity-flow.js`. Do not copy their logic into an activity and do
not call `LMSGetValue`, `LMSSetValue`, `LMSCommit`, or `LMSFinish` directly.
Keep scoring and persistence functions pure and Node-testable where practical;
load them before `main.js` in `index.html` and list them in the manifest.

## Model the state before the UI

Every activity that persists draft or review data must define a phase/state
matrix before coding, even if it has only one visible step. Use one row for each
saveable phase plus each invariant variant that changes what data or continuation
is legal:

| Phase | Variant/invariant | Required semantic state | Must be absent/pristine | Allowed next action |
|---|---|---|---|---|
| `start` | new | ... | ... | ... |
| `edit` | normal | ... | ... | ... |
| `edit` | returning from review | ... | ... | return to review |
| `review` | complete | ... | ... | submit or edit |
| `review` | empty or partial | explicit unanswered/partial answers | no invented completion | submit or edit |

The matrix must answer:

- Which phase names can production code actually render?
- Which current step/index values are legal in each phase?
- Which dependencies are required for a particular operation? Missing work must
  not block entry to review or submission.
- Whether an active answer is absent, partial, or already present for a valid
  review-edit continuation;
- Which future-step fields must be empty or zero for that specific variant;
- Which controls and continuation action exist after restore?
- Which state is final and review-only?

Do not keep persistence-only phase names that the UI cannot render. If an old
snapshot used one, normalize it once at the decode boundary and test the
migration.

State needed to continue the learner's task is semantic state. Persist it even
when it looks UI-related, for example `fromReview`, the active step, a selected
candidate that affects the next action, or completed observations. Do not persist
transient pointer coordinates, DOM references, hover state, or open animations.

## Snapshot and restore contract

These restore rules apply to saved Moodle attempts. Standalone practice uses
the same snapshot validation and submission flow within the loaded page, then
follows the [standalone refresh contract](#standalone-refresh-and-moodle-resume)
when reloaded.

Write the draft and review schemas in the activity plan. Both must contain the
authoritative learner answers needed to validate and rescore; review data must
also be sufficient to redraw the submitted answer. Separate:

- authoritative learner answers needed to rescore;
- minimal geometry needed to redraw or continue;
- phase/current-step data;
- semantic continuation state needed for the matrix variant;
- derived state that should be rebuilt instead of trusted, such as generated
  IDs, slots, DOM objects, button states, or cached totals.

If one saved object refers to another, decide explicitly whether the relationship
key is authoritative or derived. Validate authoritative keys for type, uniqueness,
and referential integrity. Omit or ignore generated IDs on restore and rebuild
them deterministically.

Use the shared envelope:

```js
SimScorm.makeSnapshot(ACTIVITY, "draft", answer);
SimScorm.makeSnapshot(ACTIVITY, "review", answer, result);
```

Save drafts after semantic changes such as completing a step, recording an
answer, or finishing a drag. Do not commit on every pointer move. Always register
a draft provider so the latest in-memory state can be flushed on page lifecycle
events.

Restore rules:

- Every state that the production UI can save or submit must restore.
- Corrupt or impossible states must be rejected, not silently converted into a
  different meaningful answer.
- Rebuild IDs and other derived state deterministically.
- Reject non-finite numbers, invalid enums, impossible dependencies, stale data
  that violates the phase matrix, and states with no continuation. Unvisited,
  empty, and partial work are legal review states, not corrupt snapshots: encode
  missing answers as `null` or an explicit unanswered value and preserve valid
  independent answers. This does not relax schema or relationship validation.
- Preserve full scoring precision. Round values only for display.
- Keep the serialized snapshot below the SCORM 1.2 suspend-data limit.
- A finished attempt with an invalid review snapshot, or with a stale
  draft/pending-final snapshot instead of a review snapshot, remains locked and
  shows only the trustworthy Moodle summary; it never becomes a new editable
  attempt or a generic load-error screen.
- A pending-final snapshot is owned by the shared runtime and must remain frozen
  for retry of the same payload.
- If an activity's deeper authoritative decoder or rescorer rejects a
  structurally valid pending-final payload, call
  `SimScorm.quarantinePending()` before rendering the technical lock. This
  leaves the durable checkpoint untouched but prevents manual, BFCache, or
  pagehide retry from writing the rejected result.
- An invalid draft may reset only when evidence confirms it is unsubmitted and
  the plan defines how to clear/overwrite it. Unknown, pending, or completed
  attempts stay locked; an error alone is not permission to clear their data.

The required invariant is:

```text
score(validState) === score(restore(encode(validState)))
```

Add a byte-size assertion for representative maximum drafts and reviews; this
project treats 4000 UTF-8 bytes as the snapshot ceiling.

The restored state must also have the same legal next action as the original.
Each round-trip test must execute one such action and assert the expected next
phase or invariant; merely comparing serialized fields is insufficient.

## Required persistence tests

For each saveable phase and invariant variant, leave one production
encode/decode/restore round-trip test and execute one legal continuation after
restore. Cover these valid and invalid cases:

- missing true dependencies, distinguished from legal unanswered work;
- empty/partial review, including entry from every editable phase, and review-edit
  continuations without invented visited/completed flags;
- active-answer and future-data combinations that violate that matrix row
  (review-edit variants may legitimately retain an active answer);
- dependency inversion, invalid enums, `NaN`, `Infinity`, and negative values
  where not allowed;
- duplicate or dangling authoritative relationship keys; generated IDs must be
  omitted or ignored and rebuilt, not rejected as learner data;
- a phase/current-step combination the UI cannot render or continue;
- old snapshot aliases or migrations, when supported;
- score and pass/fail equality before and after restore.

Fixtures must use the same shapes produced by production code. Do not invent a
test-only direction, point, answer, or phase schema.

## Interaction design

Use the shared baseline for [layout](../plans/00-shared-platform-and-style.md#layout),
[navigation](../plans/00-shared-platform-and-style.md#navigation),
[submission/reset](../plans/00-shared-platform-and-style.md#submission-and-reset),
[diagrams and notation](../plans/00-shared-platform-and-style.md#diagrams-and-notation),
[snapping](../plans/00-shared-platform-and-style.md#snapping),
[touch previews](../plans/00-shared-platform-and-style.md#touch-preview), and
[mobile interaction](../plans/00-shared-platform-and-style.md#mobile-interaction).
Record the activity's choices in its plan; implement these technical contracts:

- Classify controls as short/natural flow or bounded split-panel. For a bounded
  panel, use `100vh` then `100dvh`, an upper stage and a panel in the remaining
  height; apply `min-height: 0` through the shrinking grid/flex chain. The panel
  uses `overflow-y: auto` and `overscroll-behavior: contain`; `html`, `body`, and
  the app shell have no competing vertical scroll range. A short controls region
  may remain in natural flow.
- Specify the stage track in the plan. `minmax(13rem, 44vh)` plus `44dvh` is a
  starting point. At short heights or zoom, reflow/resize the stage; do not add a
  stage scroller or let intrinsic content make primary controls unreachable.
- Every editable phase, including optional practice, must offer entry to review
  without requiring all tasks to be viewed, answered, or individually skipped.
  Review accepts empty/partial
  work, identifies unanswered items and their scoring effect, and requires an
  explicit submit action; navigation must never submit automatically.
- Reset is limited to editable work or the confirmed unsubmitted corrupt-draft
  recovery above. `success`, `committed`, `frozen`, unknown finalization, and
  finished review have no clear/restart control in the loaded page, including
  standalone attempts. Browser refresh outside Moodle follows the separate
  [standalone refresh contract](#standalone-refresh-and-moodle-resume).
- Use Pointer Events with stable capture targets. Convert pointer, diagram,
  preview, and snap coordinates consistently through scaling/letterboxing;
  evaluate screen-distance thresholds in CSS pixels, not device pixels or fixed
  SVG units. Preview and release must use the same resolved geometry.
- A touch preview renders actual current geometry and the snapped focus; it does
  not intercept input, create duplicate IDs, or become authoritative state.
  Clear it on release, cancel, lost capture, navigation/teardown, blur, and lock.
  Keep the camera fixed during a drag; viewport changes require deliberate reflow.

### Selective touch gesture ownership

A gesture has one owner determined by its start region. Every mobile activity
with a stage and controls needs a matrix, even without draggable objects. For a
bounded split-panel use all applicable rows below; natural-flow controls share
the page/host owner and have no independent-panel row.

| Touch starts on | Owner | Observable acceptance result |
|---|---|---|
| Non-interactive stage content | Enclosing page/Moodle host | Host scrolls and iframe moves with it; activity document, activity visual viewport, panel and learner state stay unchanged |
| Independently scrolling control panel | Control panel | Only panel scrolls when it has range; host, iframe, stage, activity document and both visual viewports stay fixed, including at panel boundaries; learner state unchanged |
| Each draggable target type | Simulation | Intended target changes; all scroll/viewport/iframe positions stay fixed; `pointermove` and `pointerup`, no `pointercancel` |
| Free drawing surface, when present | Simulation | Stroke changes with the same fixed-position and pointer requirements as dragging |
| Left scroll strip beside drawing surface | Enclosing page/Moodle host | Same result as non-interactive stage; no stroke starts |
| Right scroll strip beside drawing surface | Enclosing page/Moodle host | Same result as non-interactive stage; no stroke starts |

Use `touch-action: pan-y` on non-interactive stage content and both scroll strips.
Only actual drag targets and the drawing surface use `touch-action: none`, in
place **before** `pointerdown`. In free drawing modes, inset the drawing surface
within the stage and reserve usable strips on both sides; record each width and
its reason in the plan and verify it at narrow phone sizes. Do not let a drawing overlay cover
those strips. Individual draggable objects never justify disabling the full stage.

Document the scroll topology for development, packaged SCORM, and Moodle. Native
panning follows scrollable ancestors, not a sibling panel: never forward a stage
gesture to controls. Remove activity-document scroll range in a bounded iframe.
If native behavior cannot reach the enclosing host, change the topology or forward
only to that host and verify the matrix; forwarding is not native scrolling. Only
a direct standalone page with genuinely no enclosing scroll range may mark host
movement N/A; the required scrollable Moodle-like iframe test may not.

Inventory every target type. SVG `circle`, `line`, `path`, or `g` alone is not a
portable gesture boundary: normally use explicit-size positioned HTML targets.
Canvas/SVG alternatives need equivalent browser/device evidence. Keep capture
targets mounted throughout rendering and dragging; changing `touch-action` after
pointerdown does not change that gesture's owner.

Verification must use real touchscreen or browser-level trusted touch input
(`touchStart`/`touchMove`/`touchEnd`), confirm touch pointer type and trusted events,
and record engine/device. DOM `dispatchEvent`, source/CSS/computed-style checks,
and programmatic `scrollTop` changes do not count as acceptance gestures.
Run every applicable row on **both development and built/extracted SCORM** launch
pages in a scrollable Moodle-like iframe host with range away from its boundaries.
Use up/down swipes, test the panel at both boundaries, every target type, the
active drawing surface, and each side strip separately. Programmatic positioning
is allowed only for setup.

Record before/after host scroll and visual-viewport/page position, iframe bounds,
activity-document scroll and visual viewport, panel scroll, and owned learner
state (phase, selection, answers/persistence); record viewport measures wherever
available. Assert the table's changed owner and every fixed non-owner, not just
the intended movement. Pause/fake continuous model time or account for expected
evolution so it cannot hide gesture side effects. Preview checks cover actual
geometry, snapped focus, unobstructed placement, non-interception, and cleanup.
These are package gates; repeat the matrix on a real phone in Moodle's
current-window player and, when offered, new-window player for Moodle readiness.

## Scoring and feedback

Expose a final result with this shape; derive it from authoritative learner work:

```js
{ score: 0, maxScore: 100, passed: false, completed: true,
  feedback: "short learner-facing feedback" }
```

- Score the submitted final state unless the plan explicitly requires process
  scoring. Keep `score` in `0..100` and `maxScore` at `100`; clamp the score to
  zero after penalties.
  Empty work scores zero. Partial work retains credit for each valid independent
  component; missing items earn zero without erasing unrelated earned points.
- Before implementation, explain the rubric in plain language and record it in
  the plan: components/points, genuine dependencies, extras/duplicates/penalties,
  total, passing threshold, and minimum/maximum. Selecting everything must not
  create an advantage; irrelevant actions earn no credit.
- Set tolerances per activity: measured quantity, accepted range and unit,
  symmetric/one-sided and relative/absolute rules, just-inside/outside examples,
  and easy-to-change constants. Do not copy a generic tolerance from this guide.
- Feedback explains what is right, missing, extra, or wrong in the subject model.
  `completed` describes the intended final result; only the shared submission
  outcome confirms whether it was recorded.

## SCORM runtime rules

- Use SCORM 1.2 for Moodle unless there is a confirmed reason to use something
  else.
- Keep SCORM as a thin reporting layer. The simulation owns scoring and feedback.
- The shared runtime, not the activity, sets at least:
  - `cmi.core.score.min`
  - `cmi.core.score.max`
  - `cmi.core.score.raw`
  - `cmi.core.lesson_status`
  - `cmi.core.exit`
- The activity submits through `SimScorm.submitWithCallbacks(result, review,
  callbacks)`. Do not reproduce the SetValue/commit/finish sequence locally.
- The shared runtime stores a durable pending-final checkpoint before final score
  and status writes, sets final `exit` to `logout`, commits, and then finishes.
- Register the latest in-memory draft with `SimScorm.setDraftProvider()` so the
  shared page lifecycle can save it.
- After submission, lock the current attempt inside the simulation. The learner
  may review the submitted state, but must not be able to drag objects or submit
  again in the same attempt.
- Store the submitted review state in `cmi.suspend_data` when useful. It must
  contain authoritative answers sufficient to validate, rescore, and redraw.
  Saved score and pass/fail are comparison metadata, never the source of truth
  for activity rescoring.
- Treat `cmi.suspend_data` as a small review snapshot, not a history database.
  SCORM 1.2 storage is limited, so do not store screenshots, long logs, or all
  attempts there.
- On loading an already finished attempt, read Moodle state and show the saved
  review state instead of reopening the task for editing.
- Keep a memory-only local fallback for Live Server. Standalone and Moodle use
  the same submission path, with the distinct refresh/resume rules below.

### Standalone refresh and Moodle resume

All activities must follow this contract, including existing simulations:

| Launch context | Refresh or re-entry behavior |
|---|---|
| Standalone development/practice, without an LMS | Browser refresh starts a fresh activity with empty learner answers and initial navigation, including after final submission. Fixed questions keep their configured content; randomized activities generate a new attempt normally. |
| Same unfinished Moodle attempt | Restore the saved draft, current step and authoritative answers after refresh or leaving and returning. |
| Same submitted Moodle attempt | Restore the saved answers and result as review-only; do not erase the result or reopen editing. |
| Same pending/uncertain Moodle submission | Keep the saved submission frozen and retry the same validated payload under the shared lifecycle rules. |
| New attempt supplied by Moodle | Start fresh. Moodle owns attempt limits, new-attempt creation and previous scores. |

- Use the shared runtime's memory-only standalone fallback. Production activities
  must not opt into `enableStandalonePersistence()` or restore standalone answers,
  results or navigation from localStorage, sessionStorage, IndexedDB or another
  cross-reload store. This is a shared requirement, not a per-activity option.
- Existing local checkpoints from older versions must be ignored. Do not read,
  migrate or delete them to implement refresh; inaccessible or corrupt browser
  storage must not prevent a fresh standalone practice session.
- Continue using `loadAttempt()`, `SimActivityFlow.startup()`, `saveDraft()`,
  `setDraftProvider()` and `submitWithCallbacks()`. Let the shared runtime detect
  the launch context. A missing/broken LMS in an embedded player must remain a
  technical failure, not silently become a standalone session.
- In the currently loaded page, final results remain review-only and pending
  submissions remain frozen. Do not add a learner-facing clear-results/restart
  control. The browser's standalone refresh starts a separate local session;
  it must never clear Moodle data or write a new status over a recorded attempt.
- Standalone UI must not claim that work survives reload or has been submitted
  to Moodle. Memory-only operation is normal, not a browser-storage error; no
  extra refresh notice is required.
- Same-attempt restore and new-attempt creation are different operations. The
  [Moodle settings](#moodle-attempt-expectations) control automatic new attempts
  after completion. Verify whole-player refresh and exit/re-entry in the real
  deployment; a local fake LMS only proves package behavior for the attempt it
  supplies.

Historical note (2026-09-27): standalone persistence was previously optional and
used by force orthogonal decomposition. The shared storage helpers and their
compatibility tests remain, but production activities no longer use them. Older
plans and test evidence do not override this refresh contract.

## Mandatory shared lifecycle flow

Startup calls `SimScorm.loadAttempt(ACTIVITY)` then
`SimActivityFlow.startup(attempt)`. Handle every outcome:

- `review`: validate the snapshot, restore its authoritative answer, rescore, and
  lock the finished attempt;
- `editable`: create or restore a draft and register its draft provider;
- `frozen`: retry the same pending-final payload; never reopen editing;
- `load-error`: lock unsafe actions and show only a technical error state.

The `frozen` handler must validate and rescore the nested review snapshot before
offering retry. Aggregate score/pass equality is not sufficient: compare the
canonical authoritative review answer as well. On validation failure,
`SimScorm.quarantinePending()` is mandatory.

Submission handles all four `activityState` outcomes:

- `success`: final commit and finish succeeded; show submitted review-only state;
- `committed`: final commit succeeded but finish failed; keep the committed
  result locked and allow finish retry;
- `frozen`: final data is not confirmed; freeze the answer and allow retry of the
  same payload, but do not claim a score, pass, fail, or confirmed submission;
- `retry`: no durable final state exists; inspect `retryable`. When it is `true`,
  keep editing available and offer retry. When it is `false`, show a technical
  error without promising that retry will work. Never label either case submitted.

Use this glue shape; the same handler is intentional because the shared runtime
decides whether the callback is success or failure:

```js
const attempt = SimScorm.loadAttempt(ACTIVITY);
const startupState = SimActivityFlow.startup(attempt);

switch (startupState) {
  case "review": showFinishedReview(attempt); break;
  case "editable": restoreOrCreateDraft(attempt); break;
  case "frozen": showFrozenAndRetryPending(attempt); break;
  default: showTechnicalLoadError(attempt);
}

function submit(result) {
  const handle = (outcome) => SimActivityFlow.submission(outcome, {
    success: showSubmittedReview,
    committed: showCommittedAndRetryFinish,
    frozen: showFrozenPending,
    retry: (failure) => showSubmissionError({ retryable: failure.retryable })
  });

  return SimScorm.submitWithCallbacks(result, reviewSnapshot(result), {
    onSuccess: handle,
    onFailure: handle
  });
}
```

Restore a completed attempt in this order:

```text
validate snapshot -> restore authoritative answer -> run the activity scorer
-> SimActivityFlow.reviewResult(computed, savedMetadata, attempt)
```

`reviewResult()` compares a score already computed by the activity with the
saved metadata and Moodle record; it does not validate or rescore the answer.
Use `completionLabel()` for `true`, `false`, and `null`; do not turn an unknown
status into "failed".

Technical states must use technical wording. A pending or load error may lock
controls, but its title, badge, score panel, and feedback must not say "submitted",
"passed", or "failed". Show `--` and an indeterminate completion label when no
trustworthy Moodle result exists.

Do not add activity-local `pagehide`, `pageshow`, commit, or finish logic. The
shared runtime owns normal close, draft suspend, pending-final retry, read-error
write blocking, and BFCache reload behavior.

Lifecycle tests must exercise startup outcomes (`review`, `editable`, `frozen`,
`load-error`), submission outcomes (`success`, `committed`, `frozen`, `retry`,
including non-retryable retry), and review trust matches, mismatches, and unknown
Moodle status. Test actual outcome/render functions, not source-code strings.

## Front-end SCORM trust boundary

All simulation code, answers, scoring, and SCORM calls run in the learner's
browser. A learner with developer tools can alter them. Renaming, minifying, or
obfuscating JavaScript does not create a trusted boundary, and secrets or signing
keys must never be shipped in JavaScript or the SCORM ZIP.

- Formative and low-risk graded work may use client-computed SCORM scores when
  this limitation is accepted and recorded in the plan.
- High-risk assessment requires trusted server-side validation, such as a Moodle
  question type, LTI service, or backend API that recomputes from submitted answers.
- Saving authoritative answers for teacher review improves auditability but does
  not make a browser-computed score tamper-proof.

## Moodle attempt expectations

For low-risk graded simulations, use these Moodle activity settings as the default:

- Attempts allowed: the teacher's intended limit, for example `3`.
- Attempts grading: `Highest grade` for practice-with-improvement tasks.
- Force new attempt: when the previous attempt is completed, passed, or failed.
- Lock after final attempt: `No` if students should still enter for review.
- Disable preview mode: `Yes` for formal assessment.
- Student skip content structure page: `Never`, so students can see attempt
  status before starting.
- Display attempt status: entry page and dashboard.

Important Moodle behavior:

- Preview mode can let students inspect the task without consuming an attempt.
  Disable it for formal assessment.
- If learners can re-enter a completed attempt, Moodle may resume that same
  attempt unless they start a new one. The simulation must therefore lock a
  submitted attempt itself.
- Moodle's SCORM entry page can show previous attempt scores, but a SCORM 1.2
  package normally only receives the current attempt's runtime data. Do not plan
  a learner-facing "review all previous attempts" screen unless the simulation
  stores its own history outside normal Moodle SCORM attempts.
- Do not rely on the package automatically jumping back to the Moodle entry page
  after submission. Show the submitted/review state in place.

## SCORM package rules

- Build one activity with `npm run package -- <activity-slug>`. The tool reads
  `sim/manifests/<activity-slug>.xml`; every `<file href>` is relative to `sim/`
  and becomes a ZIP-root-relative path.
- The ZIP root must contain `imsmanifest.xml`.
- Keep only runtime files in the ZIP. Do not include tests, temporary scripts, or
  generated screenshots.
- Include vendored library files inside the ZIP when Moodle delivery needs them.
  Do not rely on CDN access for learners.
- After changing source files, rebuild the ZIP before uploading to Moodle.

Expected ZIP shape:

```text
imsmanifest.xml
config.js
shared/
  activity-flow.js
  scorm.js
  styles.css
simulation-slug/
  index.html
  main.js
  scoring.js
  styles.css
```

The current package check proves that ZIP entries exactly match the manifest,
but it does not discover dependencies omitted from both. Until that audit is
automated, compare every local `script[src]`, stylesheet/link `href`, and other
runtime asset referenced by `index.html` or loaded code against the manifest.
Then serve the built or extracted ZIP and run the browser smoke against that
artifact, not only against `sim/` source files.

<a id="playwright-cli-on-this-windows-machine"></a>

## Browser check tooling

Use the available project browser runner or resolve the installed Playwright CLI
wrapper from the current environment. Put temporary flows in ignored
`output/playwright/` scripts; have each script start and stop its server/browser.
On Windows, use Git Bash explicitly if plain `bash` invokes unconfigured WSL,
and use `npm.cmd` if the shell cannot run `npm`. Do not copy another machine's
user paths. Treat `### Error` in Playwright CLI output as failure even with exit 0.

## Verification checklists

### Package-ready checks

- Complete the plan: scope/risk, catalogue entry, scoring/tolerances, phase matrix,
  schemas, lifecycle outcomes, navigation, mobile layout, all target types and
  gesture rows, snap/preview decisions, and out-of-scope items.
- Run scoring tests, [all persistence tests](#required-persistence-tests), and
  [lifecycle/UI tests](#mandatory-shared-lifecycle-flow). Cover byte limits,
  every phase/variant plus legal restored continuation, invalid states, migrations,
  trust mismatches/unknown status, and shared fake-LMS failure tests for runtime
  changes. Verify empty/partial review and submission from every editable phase,
  restored partial work, and no reset after score or uncertain finalization.
- Use Live Server or a local static server and pass the full
  [trusted-touch matrix](#selective-touch-gesture-ownership) on source and extracted
  packages, including both side strips in drawing mode and panel boundaries.
- Test `320x500`, `390x500`, `390x600`, a normal full-height phone, landscape,
  toolbar changes, software keyboard, and 200% zoom. Inspect actual scaled text
  and diagram labels for readability; keep primary actions/panel bottom reachable,
  side strips usable, and bounded activity documents free of competing scroll.
- Through production UI on source and extracted SCORM, verify standalone refresh
  starts fresh after partial work, final check and submission; redraw and submit
  successfully afterwards. Seed old draft/review/pending/corrupt local checkpoints
  and deny browser storage: none may restore old work or lock standalone startup.
  Separately verify same-attempt Moodle draft/review/pending restoration and a
  fresh attempt from Moodle. Local tests do not establish real Moodle readiness.
- Run changed-file syntax checks and the repository gates: `npm run check`,
  `npm test`, `npm run package:all`, and `git diff --check <base>...HEAD`
  (normally `origin/main...HEAD`). All new tests must be in `tools/run-tests.js`.
- Check the [ZIP and manifest contract](#scorm-package-rules), including runtime
  references omitted from both manifest and ZIP. Launch the built/extracted
  artifact for browser smoke; source-only evidence is insufficient.

### Moodle-ready checks

- Complete package checks, upload the ZIP as SCORM 1.2, and test a real student
  account with the intended attempt policy.
- On a real phone in current-window and offered new-window players, repeat the
  full gesture matrix, reach the last control and scroll back, and verify text,
  drawing side strips, preview/snap behavior, keyboard, and viewport changes.
- Confirm SCORM preview mode is disabled for formal assessment and attempt status
  is visible. Verify draft resume, pending retry, empty/partial score/status,
  submitted review-only re-entry with no reset, and a new Moodle attempt to change
  the score. Confirm any required trusted server-side validation works.
- Record Moodle/device evidence separately; local emulation cannot satisfy it.

## Package-ready definition of done

All [Package-ready checks](#package-ready-checks) pass with recorded evidence.
Invalid states fail closed, lifecycle wording is honest, and restored work keeps
its score and legal continuation. Outstanding Moodle/device gates remain explicit.

## Moodle-ready definition of done

Package readiness plus all [Moodle-ready checks](#moodle-ready-checks) pass in the
real deployment. Browser scoring stays within the plan's accepted risk level;
required trusted validation is operational. Local checks never establish this gate.
