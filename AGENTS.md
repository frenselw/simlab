# SimLab Project Notes

## Project Purpose

Build mobile-first educational simulations that run as plain web apps during
development and can be packaged as SCORM 1.2 activities for Moodle.

SimLab should stay useful beyond physics. Keep shared runtime code generic, and
let each simulation own its subject model and scoring rubric.

## Read First

1. `plans/00-shared-platform-and-style.md`
2. `docs/simulation-scorm-production-guide.md`
3. The simulation-specific plan in `plans/`

## Working Rules

- Prefer static HTML, CSS, and JavaScript until the project clearly needs more.
- Reuse `sim/shared/styles.css` and `sim/shared/scorm.js`.
- Keep each simulation independently runnable in Live Server.
- Keep SCORM as a thin wrapper: the simulation owns the score; Moodle receives it.
- Score the submitted final state unless a plan explicitly requires process scoring.
- Store compact review data in `cmi.suspend_data` when learners should revisit
  their submitted answer.
- After final submission, finish the SCORM attempt and lock that submitted
  attempt for review.
- Use SCORM 1.2 for Moodle unless there is a confirmed reason to do otherwise.
- Do not add dependencies until native browser SVG/Canvas features fall short.

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
tools/
output/
```

`output/` is for generated packages, screenshots, and temporary checks.

For SCORM export, package one activity at a time so the package root contains
`imsmanifest.xml` and the activity can still load shared files by relative path.
