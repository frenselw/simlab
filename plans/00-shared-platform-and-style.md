# Project Design Baseline

## Goal

Create a reusable base for small educational simulations that:

- work well on phones, iPad, and desktop;
- can be tested with Live Server;
- can report score and completion to Moodle through SCORM 1.2;
- share a consistent visual style and interaction model;
- are easy to extend beyond physics later.

## Design baseline

The project should feel like a focused lab tool: calm, clear, touch-friendly, and
directly usable. Open into the simulation task, not a landing page.

Reuse the previous simulation style as the baseline, but translate it into plain
CSS and small shared JavaScript instead of copying Tailwind-specific classes.

Core principles:

- mobile first;
- readable at classroom distance;
- high-contrast diagrams;
- one main task per screen;
- shared controls and scoring behavior;
- no decorative UI that competes with the physics.

## Minimum platform

Use plain browser technology first:

- HTML for structure;
- CSS for layout, responsive rules, and visual tokens;
- JavaScript for simulation state, scoring, and SCORM reporting;
- SVG or Canvas for diagrams, whichever keeps the simulation simpler.

Do not add a build system until more than one simulation clearly benefits from it.

## Visual tokens

When `sim/shared/styles.css` is created, start with these CSS variables:

```css
:root {
  --color-app: #f3f4f6;
  --color-panel: #f9fafb;
  --color-canvas: #ffffff;
  --color-canvas-muted: #e5e7eb;

  --color-text: #1f2937;
  --color-text-muted: #4b5563;
  --color-text-soft: #9ca3af;
  --color-accent: #2563eb;
  --color-danger: #dc2626;

  --color-border: #d1d5db;
  --color-border-light: #e5e7eb;

  --force-weight: #22c55e;
  --force-normal: #db2777;
  --force-friction: #ef4444;
  --force-applied: #9333ea;
  --force-resultant: #f59e0b;

  --object-fill: #3b82f6;
  --object-stroke: #1e40af;
  --grid-line: #e5e7eb;

  --radius-panel: 8px;
  --touch-target: 44px;
}
```

Keep these as semantic names. A later simulation can draw chemistry particles or
biology labels without inheriting physics-only variable names except where the
concept really is a force.

## Typography

- Use system UI fonts: `Segoe UI`, `Tahoma`, `Geneva`, `Verdana`, sans-serif.
- Use monospace only for numeric readouts or raw data.
- Use compact headings inside tools; avoid hero-scale text.
- Use clear Chinese labels by default, with English identifiers only in code.

Suggested sizes:

- page/task title: `1.25rem` to `1.5rem`;
- section title: `0.875rem`, semibold;
- body/control text: `1rem`;
- diagram labels: `1rem` to `1.1rem`, bold when needed.

## Layout

Use one responsive app shell:

- phone: diagram first, controls below or in a short top/bottom panel;
- tablet: diagram remains dominant, controls can sit beside it if space allows;
- desktop: split pane, controls sidebar plus main diagram area.

Baseline dimensions:

- desktop sidebar: flexible, around `18rem` to `24rem`;
- panel padding: `1rem` on mobile, up to `1.5rem` on desktop;
- touch target: at least `44px`;
- avoid horizontal scrolling.

Do not require a keyboard for the core task unless the learning objective is
numeric input.

## Diagram graphics

For physics diagrams, reuse these defaults:

- grid spacing: about `40px`;
- grid line width: `1px`;
- normal vector width: `3px`;
- emphasized vector width: `5px`;
- arrow heads: large enough for phone screens;
- line caps: round;
- dashed guides: `[5, 5]`.

Draw physical objects so their role is visually identifiable. A surface or
ground should usually have thickness or hatch marks when a plain line could be
confused with a rope, string, ray, or vector. Use a simple filled object with a
clear outline for blocks; avoid text labels inside objects unless the label is
part of the physics.

Prefer SVG for free-body diagrams and vector-heavy tasks. Use Canvas when many
objects move every frame. Use JSXGraph when coordinate geometry tools save code.
Use p5.js when animation or sketch-style drawing becomes simpler with it.

## Third-party JavaScript

SCORM packages can include normal web files, including JavaScript libraries.
Use external libraries only when they make the simulation simpler.

Preferred order:

1. native browser features;
2. a small vendored library inside the SCORM package;
3. CDN links for development only.

For Moodle delivery, package library files inside the SCORM ZIP and reference them
with relative paths. Do not rely on learners having internet access to a CDN.

Do not include MathJax, p5.js, JSXGraph, or similar libraries globally. Add them
only to simulations that need them.

## Shared runtime shape

Keep the common layer small:

- `sim/shared/styles.css`: colors, spacing, typography, layout, controls;
- `sim/shared/scorm.js`: SCORM 1.2 API lookup, local fallback, score submit;
- `sim/shared/ui.js`: only repeated UI helpers, if duplication appears;
- `sim/shared/scoring.js`: only generic score helpers, if duplication appears.

Each simulation owns its own physics model and scoring rubric.

## Controls and interaction

The first viewport target is a phone in portrait orientation.

- Use large touch targets.
- Use sliders, buttons, toggles, drag handles, and direct manipulation.
- Avoid precise text entry unless the learning objective requires it.
- Keep the main task visible without horizontal scrolling.
- Let tablet and desktop layouts add space, not new required actions.
- Use Pointer Events for drag interactions.
- Prevent page scrolling only while the learner is actively dragging inside the
  simulation.
- Use snap-to-grid only when it helps the task; do not make it fight the learner.
- For touch dragging, avoid making the controlled object jump away from the
  finger. If the finger hides important detail, use a temporary local preview or
  magnifier and highlight the selected object.
- If the next required action is outside the diagram, show a subtle diagram hint
  when helpful, but use position-neutral wording such as "go to the operation
  panel." The controls may be below the diagram on phones and beside it on wider
  screens.
- Remove those hints once the learner opens the relevant control, answers, or
  advances to the next task state.
- When learners can add repeated diagram items, prefer a per-type quantity
  control such as `- / count / +` over a growing list of duplicate buttons. Keep
  the maximum count as an easy-to-change constant in the simulation.
- In control rows for physics quantities, show the Chinese name and the symbol in
  separate aligned columns, for example `重力` then `G`, so mixed-width text does
  not make the panel look uneven.
- Show hover/focus/active states, but make touch behavior complete without hover.

## Component style

Use a quiet lab-tool style:

- light background;
- strong contrast;
- clear panels;
- restrained accent colors;
- consistent controls;
- no decorative landing page.

Cards are allowed for repeated items, feedback blocks, or compact control groups.
Do not nest cards inside cards.

## Scoring contract

Every simulation should expose one final result:

```js
{
  score: 0,
  maxScore: 100,
  passed: false,
  completed: true,
  feedback: "short learner-facing feedback"
}
```

For SCORM 1.2, report at least:

- `cmi.core.score.min`
- `cmi.core.score.max`
- `cmi.core.score.raw`
- `cmi.core.lesson_status`
- `cmi.core.exit`

Use local fallback logging when no SCORM API exists, so Live Server remains useful.

After final submission, call commit/finish immediately and lock the current
attempt for review. If learners should see their submitted answer later, store a
compact review state in `cmi.suspend_data`; do not use it as a full attempt
history store. See
`docs/simulation-scorm-production-guide.md` before implementing a new SCORM
package.

## Plan per simulation

Each new simulation gets a plan in `plans/` with:

- learning objective;
- student task;
- interaction design;
- scoring rubric with explicit point values, penalties, pass threshold, and score
  floor/ceiling;
- tolerance choices with units, borderline examples, and easy-to-change
  constants;
- file location;
- third-party libraries, if any;
- SCORM behavior;
- acceptance checks;
- out-of-scope items.

Start from `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`. A plan is not ready for
implementation until it also defines:

- every UI phase and the allowed transition out of it;
- a state matrix showing which fields must be present, absent, or pristine in
  every saveable phase;
- the compact draft and review snapshot schemas;
- which fields are authoritative learner answers and which are derived UI state;
- how corrupt, old-version, read-error, pending-final, and finished states appear;
- round-trip and invalid-state tests that will be added to `tools/run-tests.js`.

## Reliability baseline for new simulations

Do not implement activity-local SCORM lifecycle logic. New activities use:

- `SimScorm.loadAttempt(activity)` plus `SimActivityFlow.startup(attempt)`;
- `SimScorm.makeSnapshot()` and `SimScorm.setDraftProvider()` for persistence;
- `SimScorm.submitWithCallbacks()` plus `SimActivityFlow.submission()`;
- `SimActivityFlow.reviewResult()` and `completionLabel()` for restored results.

The activity owns its model, scoring, snapshot validation, and learner-facing
views. The shared layer owns LMS reads/writes, pending-final durability,
commit/finish ordering, BFCache handling, and recorded-result trust.

For every state accepted by an activity restore function:

```text
restore(encode(validState)) preserves its scored meaning and continuation path
```

Reject a snapshot when it would skip a required task, revive already-completed
work as editable, retain stale future data, dead-end the learner, or change the
score after restore. Only normalize an old phase or field when the migration is
explicit and covered by a test.
