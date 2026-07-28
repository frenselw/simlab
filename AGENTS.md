# SimLab Project Notes

## Project Purpose

Build mobile-first educational simulations that run as plain web apps during
development and can be packaged as SCORM 1.2 activities for Moodle.

SimLab should stay useful beyond physics. Keep shared runtime code generic, and
let each simulation own its subject model and scoring rubric.

## Read First

1. `plans/00-shared-platform-and-style.md`
2. `docs/simulation-scorm-production-guide.md`
3. `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`
4. The simulation-specific plan in `plans/`

## Subagent Review Workflow

The main agent owns orchestration, scope, user authorization, and the final
result. Custom subagents provide bounded specialist review or implementation;
they do not replace the main agent's judgment. Classify changes by affected
contract and consequence, not by line count. A one-line scoring, persistence,
manifest, or touch-ownership change can be higher risk than a large
non-behavioral cleanup.

Before delegating, the main agent must give each subagent:

- the simulation slug and task goal;
- an explicit base ref and the changed paths or other review scope;
- the risk tier and affected contracts;
- the available test, browser, and package evidence;
- the exact requested output, including whether the task is review-only.

When the working tree is part of the review, compare the base ref with the
working tree rather than silently reviewing only committed changes. If any
scope input is missing, the subagent must state its assumption instead of
silently choosing a different scope.

Use these risk tiers:

- **T0 — trivial, non-behavioral:** Typos that do not change scientific meaning,
  comments, formatting, test descriptions, and documentation-only cleanup.
  The main agent handles the change and runs a targeted check. Do not use a
  subagent by default.
- **T1 — small, local, single-contract:** A localized change to one simulation
  that does not affect scoring, persistence, submission, gesture ownership, or
  packaging. The main agent normally implements and verifies it. Use at most
  the relevant specialist when independent review adds material value; do not
  use the final verifier by default.
- **T2 — contract-sensitive:** A change to the learning model, scoring,
  persistence, lifecycle, mobile interaction contract, accessibility,
  registration, manifest, tests, or package. Use each affected specialist.
  Use the final verifier for P0/P1 findings, conflicting findings,
  cross-contract conclusions, or material uncertainty.
- **T3 — broad or release-critical:** A new simulation, a shared-runtime
  change, a large cross-contract change, a full audit, or a release/Moodle
  package gate. Run all applicable specialist reviewers, normally in parallel;
  send their complete findings, including clean results, and evidence to the
  final verifier; implement only work authorized by the user; rerun every
  affected specialist after the fix; and use the final verifier again when the
  result is a merge or release gate.

Route work by contract:

- Use `simlab_subject_reviewer` for scientific or mathematical correctness,
  formulas, units, learner tasks, feedback, and meaning-bearing learner copy.
- Use `simlab_scorm_reviewer` for scoring, pass/fail, state invariants,
  persistence, restoration, submission, attempt locking, and SCORM runtime
  behavior.
- Use `simlab_interaction_reviewer` for HTML/CSS layout, mobile behavior,
  scrolling, touch ownership, dragging, keyboard access, animation, and real
  browser evidence.
- Use `simlab_test_package_reviewer` for automated-test coverage, manifests,
  activity registration, runtime-file inclusion, and source/package parity.
- Use `simlab_final_verifier` after proposed findings exist, for any clean T3
  gate after the specialist pass, or when the user explicitly requests an
  independent final gate. Give it the complete proposed-finding set, including
  an explicitly empty set when specialists found no defect, and all available
  evidence; it is not a substitute for the specialist pass.
- Use `simlab_simulation_implementer` for verified fixes to one simulation when
  implementation has been authorized. Before starting it, the main agent must
  confirm that no other writing agent is active for the affected worktree and
  must not start a second writer until the first one finishes. The main agent
  may implement T0/T1 work directly.

All reviewers use this finding schema:

- severity: P0, P1, P2, or P3;
- exact file and location;
- violated plan, project, learner, browser, test, package, or LMS contract;
- reproducible trigger and evidence;
- observable consequence;
- confidence and any evidence that could not be collected locally.

Severity means:

- **P0:** catastrophic assessment-integrity, security, data-loss, or
  broadly unusable release failure;
- **P1:** reproducible merge blocker with serious learner, LMS, or release
  impact;
- **P2:** real non-blocking defect or material regression-coverage gap;
- **P3:** low-impact defect. Do not report style-only preferences.

After implementation, rerun targeted checks and every specialist whose
contract was changed. Do not rerun unrelated specialists merely because they
exist. A reviewer may review a fix but must not modify it, and an implementer
must never approve its own work.

## Working Rules

- Prefer static HTML, CSS, and JavaScript until the project clearly needs more.
- In this repository, the canonical activity entry files are `index.html`,
  `styles.css`, and `main.js`, plus `scoring.js`/`persistence.js` when needed.
- Use Traditional Chinese learner-facing copy unless the simulation plan or user
  explicitly requests another language.
- Reuse `sim/shared/styles.css`, `sim/shared/scorm.js`, and
  `sim/shared/activity-flow.js`.
- Keep each simulation independently runnable in Live Server.
- Keep SCORM as a thin wrapper: the simulation owns the score; Moodle receives it.
- Use `SimScorm.loadAttempt()` and `SimActivityFlow.startup()` for startup. Do not
  read raw LMS fields independently inside an activity.
- Use `SimScorm.submitWithCallbacks()` and handle all four outcomes: `success`,
  `committed`, `frozen`, and `retry`.
- Score the submitted final state unless a plan explicitly requires process scoring.
- Classify the assessment risk before implementation. Browser-scored SCORM is
  suitable only for formative or low-risk use; high-risk scoring needs trusted
  server-side validation, and secrets must never be placed in learner JavaScript.
- Store authoritative answers sufficient to validate, rescore, and redraw a
  submitted attempt in `cmi.suspend_data` when learners should revisit it.
- Before coding persistence, write the activity phase/state matrix and snapshot
  schema in its plan. This applies to every persisted activity. Cover every
  phase plus its invariant variants, including review-edit continuations.
- Every activity with draft/review persistence needs production
  encode/decode/restore round-trip tests for each phase/variant, invalid-state
  matrix tests, and a restored-state test that executes one legal continuation.
- Technical load or pending-submit errors must lock unsafe actions without being
  described as a confirmed submission, score, pass, or fail.
- After final submission, finish the SCORM attempt and lock that submitted
  attempt for review.
- Use SCORM 1.2 for Moodle unless there is a confirmed reason to do otherwise.
- Do not add dependencies until native browser SVG/Canvas features fall short.
- When an activity has a substantial control panel that learners use while the
  stage must remain visible, use the bounded mobile split-panel contract from
  the production guide: stage on top, independently scrolling controls in the
  remaining height, `100vh`/`100dvh` fallback, and `min-height: 0` on shrinking
  grid/flex children. The bounded activity `html`/`body` must not become a third
  vertical scroll owner. Activities without such a panel may use natural page
  flow.
- Every mobile activity with a stage and controls must define a touch gesture
  ownership matrix in its plan, whether or not the stage contains draggable
  objects. For bounded split-panel activities, the following three start-region
  rules are project-wide defaults and must not be reassigned by an activity:
  1. A vertical touch starting on non-interactive stage content scrolls the
     enclosing page/Moodle host when that host has range. It must not scroll a
     sibling control panel or the activity iframe document.
  2. A vertical touch starting in an independently scrolling control panel
     scrolls only that panel. The enclosing page/Moodle host, activity document,
     iframe position, and stage stay fixed, including at panel boundaries.
     "Stage remains visible while controls are used" refers to this panel
     gesture; it does not reassign a gesture that starts on the stage.
  3. A touch starting on a draggable target belongs only to the simulation for
     that active drag. The target moves while every page, activity-document,
     panel, host/activity visual-viewport, iframe, and host scroll position stays
     fixed.
  Use `touch-action: pan-y` on non-interactive stage surfaces. Never forward a
  stage gesture to a sibling control panel. If native iframe behavior cannot
  reach the enclosing host, change the scroll topology or forward only to that
  same host owner and verify it; do not choose a different owner. Activities
  with direct manipulation must additionally inventory every draggable target,
  use stable pre-`pointerdown` drag hit targets, and deliver `pointermove` plus
  `pointerup` without `pointercancel`. Verify every matrix row with
  browser-level trusted touch gestures in a scrollable Moodle-like iframe for
  both development source and packaged SCORM; direct-page tests,
  DOM-dispatched events, source checks, and computed-style checks alone are not
  sufficient. A short natural-flow controls region is not an independently
  scrolling control panel: its matrix names the enclosing page/host as the
  normal scroll owner instead of adding the panel-only row.
- Add every new test file to `tools/run-tests.js`, every runtime dependency
  referenced by HTML or loaded code to the activity manifest, and every active
  simulation to `sim/config.js` with
  title, folder, categories, description, tags, and status.

## Layout

```text
plans/
docs/
sim/
  config.js
  manifests/
  shared/
  <activity-slug>/
tools/
output/
```

`output/` is for generated packages, screenshots, and temporary checks.

For SCORM export, package one activity at a time so the package root contains
`imsmanifest.xml` and the activity can still load shared files by relative path.

## Local browser checks on Windows

Use Git Bash, not the default `bash` on PATH:

```powershell
& "C:\Program Files\Git\bin\bash.exe" -lc '"/c/Users/frens/.codex/skills/playwright/scripts/playwright_cli.sh" --help'
& "C:\Program Files\Git\bin\bash.exe" "output/playwright/<check>.sh"
```

Inside the ignored check script, set
`PWCLI=/c/Users/frens/.codex/skills/playwright/scripts/playwright_cli.sh`.
Treat any `### Error` in Playwright CLI output as a failed check even when the
process exits with code 0.
