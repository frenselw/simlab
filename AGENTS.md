# SimLab Project Notes

Build mobile-first educational simulations as static web apps, packaged one
activity at a time as SCORM 1.2 for Moodle. Keep shared code generic; each activity
owns its subject model, authoritative answers, and scoring rubric.

## Read first

1. [Shared product and style rules](plans/00-shared-platform-and-style.md)
2. [Implementation and verification contracts](docs/simulation-scorm-production-guide.md)
3. [New activity plan template](plans/NEW-SIMULATION-PLAN-TEMPLATE.md)
4. The activity-specific plan in `plans/`

Keep each rule in its owning document and link to it. Activity plans record
subject-specific decisions within these contracts; existing user instructions
govern any exceptions. Mark old implementation gaps and historical evidence clearly.

## Working rules

- Prefer plain HTML/CSS/JavaScript and native SVG/Canvas. Keep activities runnable
  in Live Server; add dependencies only for a concrete need and package them locally.
- Use Traditional Chinese learner-facing copy unless requested otherwise.
- Reuse `sim/shared/styles.css`, `sim/shared/scorm.js`, and
  `sim/shared/activity-flow.js`; canonical entry files are `index.html`,
  `styles.css`, `main.js`, with `scoring.js`/`persistence.js` as needed.
- Apply the baseline's three-region layout, dependency-based navigation,
  notation, arrows, snapping, and touch-preview decisions. Mobile layout and
  trusted-touch verification are required, including usable side scroll strips
  for free drawing; follow the production guide's gesture ownership contract.
- Allow every editable stage to reach check-and-submit with blank or partial
  answers. Preserve earned partial credit, score untouched attempts zero, and
  require explicit final submission. Recorded attempts are review-only; neither
  Moodle nor standalone may offer a clear-results/restart control. Pending
  submissions remain frozen for retry.
- Before coding, complete the plan's assessment risk, rubric, dependencies,
  phase/variant matrix, authoritative snapshot schema, and test decisions.
  Browser scoring is for formative/low-risk use; high-risk grading needs trusted
  server validation. Never ship secrets in learner JavaScript.
- Keep SCORM as the reporting layer. Use `SimScorm.loadAttempt()` with
  `SimActivityFlow.startup()` and `SimScorm.submitWithCallbacks()` with all four
  outcomes (`success`, `committed`, `frozen`, `retry`). Do not read/write raw LMS
  fields or implement activity-local commit/finish/page-lifecycle handling.
- Preserve the production guide's persistence, trust, error, and retry contracts.
  Every saveable phase/variant needs a production encode/decode/restore round-trip
  and one executed legal continuation; validate invalid states separately from
  legal unanswered work. Technical failures must not claim confirmed results.
- Add new tests to `tools/run-tests.js`, all runtime dependencies to the activity
  manifest, and deployable activities to `sim/config.js` with `title`, `folder`,
  `categories`, `description`, `tags`, and `status`.
- Use the production guide's separate package-ready and Moodle-ready gates.
  Report actual evidence; local browser checks do not establish real Moodle or
  real-phone readiness.

## Layout

```text
plans/          activity decisions and shared product baseline
docs/           production contracts
sim/config.js   catalogue
sim/manifests/  one SCORM manifest per activity
sim/shared/     shared styles and runtime
sim/<slug>/     independently runnable activity
tools/          validation and packaging
output/         generated packages, screenshots, temporary checks
```

Package roots contain `imsmanifest.xml`; shared files remain accessible by relative
path. Browser tooling, including Windows-specific setup, is documented once in
the production guide.
