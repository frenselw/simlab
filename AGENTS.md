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

## Working Rules

- Prefer static HTML, CSS, and JavaScript until the project clearly needs more.
- In this repository, the canonical activity entry files are `index.html`,
  `styles.css`, and `main.js`, plus `scoring.js`/`persistence.js` when needed.
  These project rules override generic simulation scaffolds that use `script.js`.
- Use Traditional Chinese learner-facing copy unless the simulation plan or user
  explicitly requests another language.
- Reuse `sim/shared/styles.css` and `sim/shared/scorm.js`.
- Keep each simulation independently runnable in Live Server.
- Keep SCORM as a thin wrapper: the simulation owns the score; Moodle receives it.
- Use `SimScorm.loadAttempt()` and `SimActivityFlow.startup()` for startup. Do not
  read raw LMS fields independently inside an activity.
- Use `SimScorm.submitWithCallbacks()` and handle all four outcomes: `success`,
  `committed`, `frozen`, and `retry`.
- Score the submitted final state unless a plan explicitly requires process scoring.
- Store compact review data in `cmi.suspend_data` when learners should revisit
  their submitted answer.
- Before coding persistence, write the activity phase/state matrix and snapshot
  schema in its plan. Every UI-reachable saved state must restore; impossible or
  corrupt states must fail closed.
- Every activity with draft/review persistence needs production
  encode/decode/restore round-trip tests and invalid-state matrix tests.
- Technical load or pending-submit errors must lock unsafe actions without being
  described as a confirmed submission, score, pass, or fail.
- After final submission, finish the SCORM attempt and lock that submitted
  attempt for review.
- Use SCORM 1.2 for Moodle unless there is a confirmed reason to do otherwise.
- Do not add dependencies until native browser SVG/Canvas features fall short.
- Add every new test file to `tools/run-tests.js`, every runtime file to the
  activity manifest, and every active simulation to `sim/config.js`.

## Layout

```text
plans/
docs/
sim/
  config.js
  manifests/
  shared/
  fbd-horizontal-block/
  plane-mirror-pencil-ray-diagram/
  displacement-distance-map-journey/
  inertial-reference-frame-road-observer/
tools/
output/
```

`output/` is for generated packages, screenshots, and temporary checks.

For SCORM export, package one activity at a time so the package root contains
`imsmanifest.xml` and the activity can still load shared files by relative path.
