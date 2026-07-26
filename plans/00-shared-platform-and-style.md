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

### Phone control-panel contract

Use this contract when an activity has a substantial or repeatedly used control
panel and learners need the stage to remain visible while operating it. It does
not apply to activities with no control panel or only a short set of controls;
those may use natural document flow.

- Bound the phone app to the available viewport with `100vh` as a fallback and
  `100dvh` when supported, and prevent the app shell from creating a second page
  scroll region. In an embedded bounded activity, `html`/`body` must also have no
  usable vertical scroll range; the activity document is never a third scroll
  owner between Moodle and the panel.
- Keep the stage in the upper row. Put the control panel in the lower row, give
  it the remaining height, and make that panel independently scrollable.
- Set every shrinking grid/flex child in this chain to `min-height: 0`; use
  `overflow-y: auto` and `overscroll-behavior: contain` on the control panel.
- Choose the stage track in the simulation plan. `minmax(13rem, 44vh)` with a
  `44dvh` enhancement is the baseline starting point, not a universal constant.
- At extreme heights or zoom, reflow or resize an unusually dense stage instead
  of making it an independent vertical scroll owner. Keep primary actions and
  keyboard focus targets reachable.
- Ownership depends on where the touch starts: stage content scrolls the
  enclosing page/Moodle host, while control-panel content scrolls only the
  panel. The activity body must own neither gesture.
- "Keep the stage visible while controls are used" means the stage stays fixed
  during a panel gesture. It does not mean a gesture starting on the stage
  should scroll the panel.
- Use `overscroll-behavior: contain` so a control-panel gesture does not move the
  host when the panel reaches its top or bottom.
- Test short Moodle-like viewports as well as full-height phones; browser chrome,
  orientation changes, zoom, and the software keyboard must not leave an
  unreachable strip at the bottom of the panel.

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
- `sim/shared/scorm.js`: SCORM 1.2 API lookup, local fallback, persistence,
  score submit, and page lifecycle;
- `sim/shared/activity-flow.js`: shared startup, submission, and recorded-result
  trust outcomes;
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

### Touch gesture ownership contract

Every mobile activity with a stage and controls must include a gesture ownership
matrix in its simulation plan, even when the stage has no draggable objects.
Activities with direct manipulation must additionally list every draggable
target type. For a bounded split-panel activity, ownership is determined by
where the touch starts:

| Touch starts on | Gesture owner | Required result |
|---|---|---|
| Non-interactive stage content | Enclosing page/Moodle host | When the host has range, a vertical swipe moves the host and complete activity iframe; the activity document and control panel do not scroll and the gesture causes no learner-state change |
| Independently scrolling control panel | Control panel | A vertical swipe moves only the panel; enclosing page/host, activity document, host and activity visual viewports, iframe position, and stage stay fixed, including at panel boundaries; the gesture does not alter learner state |
| A draggable target | The simulation for the active drag | The target moves; enclosing page/host, activity document, panel, host and activity visual viewports, and iframe position all stay fixed; `pointermove` and `pointerup` complete and no `pointercancel` occurs |

For a short natural-flow controls region, do not invent an independent panel
owner: the enclosing page/host remains the normal scroll owner outside actual
interactive or draggable targets.

Apply `touch-action: pan-y` to the root stage surface so vertical swipes from its
non-interactive region reach the enclosing page/host. Do not put
`touch-action: none` on the whole stage merely because part of it is draggable.
Confine gesture suppression to each drag target. Record the scroll topology in
the plan: native panning follows the gesture target's scrollable ancestor chain
and does not scroll a sibling control panel. Never forward a stage gesture to
that sibling panel. In a bounded iframe, remove any activity-document scroll
range that could consume the stage gesture. If the browser still cannot reach
the enclosing host, change the topology or forward only to the same host owner;
do not substitute the panel as owner or describe programmatic forwarding as
native scrolling.

In a direct standalone page where the enclosing document genuinely has no
range, a blank-stage swipe may remain unclaimed with zero scroll delta. This N/A
case does not apply to the required scrollable Moodle-like iframe test: position
the host away from a boundary and require a non-zero host delta.

For an SVG scene, do not rely on `touch-action: none` on inner graphics such as
`circle`, `line`, `path`, or `g` as the only scroll-prevention mechanism. Prefer
a stable HTML hit target with explicit dimensions over the draggable region, or
use another implementation whose behavior has been verified with real touch
input in the supported browsers. A Canvas scene may use stable HTML overlays or
an equivalently verified selective gesture-claiming design. In all cases, the
element holding pointer capture must remain mounted for the whole gesture; a
render must not replace it. Treat `pointercancel` during an ordinary drag as a
failed interaction, not a successful completion.

The drag target's effective `touch-action` must already be in place before
`pointerdown`; changing it in a pointer handler or after the gesture starts
cannot change ownership of that gesture.

Verification must use browser-level trusted touch input (a real touchscreen or
browser automation protocol producing `touchStart`/`touchMove`/`touchEnd`), not
DOM `dispatchEvent`, source inspection, or computed CSS alone. Confirm trusted
events and touch pointer type, and record the browser engine/device. Run every
applicable row on the development page and again on the built or extracted SCORM
launch page inside a scrollable Moodle-like host containing the activity iframe;
bounded split-panels must run all three regions. Give the host available scroll
range, place it away from the relevant boundary, and swipe in both directions.

Before and after every gesture, record the enclosing host page scroll position,
host visual-viewport offset/page position where measurable, iframe bounding
rectangle, activity-document scroll position, activity visual-viewport offset
where measurable, control-panel scroll position, and gesture-owned learner state
such as phase, selection, answers, or persisted data. For a continuously running
simulation, pause or fake the clock, or compare against its expected time
evolution, so ordinary model progress is not mistaken for a gesture side effect.
Apply these row-specific assertions:

- blank stage: host scroll delta and iframe movement are non-zero in the intended
  direction; activity document, activity visual viewport, and panel deltas are
  zero; the gesture causes no learner-state change;
- control panel: panel delta is non-zero when it has range; host, iframe,
  activity document, host and activity visual viewports, and stage stay fixed;
  the gesture causes no learner-state change. Repeat at the panel's top and
  bottom boundaries and require the host to remain fixed;
- draggable target: the target changes; every recorded scroll delta is zero;
  `pointermove` and `pointerup` occur and `pointercancel` does not.

Do not use programmatic `scrollTop` assignment as the acceptance gesture.
Programmatic setup may place a scroll owner away from a boundary, but repeated
trusted touch gestures must produce the measured result. In a direct standalone
page with no enclosing scroll range, only the blank-stage non-zero delta may be
marked not applicable; all zero-delta and state assertions still apply. For
Moodle, repeat the same complete matrix on a real phone in the current-window
player and in the new-window player when both launch modes are offered.

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

The activity submits only through `SimScorm.submitWithCallbacks()`. The shared
runtime performs final commit/finish; the activity uses the resulting
`SimActivityFlow` outcome to lock controls and show the correct submitted,
committed, frozen, or retry state. If learners should see their submitted answer
later, store a compact review state in `cmi.suspend_data`; do not use it as a full
attempt history store. See
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
- assessment risk classification (`formative`, `low-risk graded`, or
  `high-risk graded`) and the trusted validation path required for high risk;
- acceptance checks;
- out-of-scope items.

Start from `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`. A plan is not ready for
implementation until it also defines:

- every UI phase, invariant variant, and allowed transition out of it;
- a state matrix for every persisted activity showing which semantic fields must
  be present, absent, or pristine in each phase/variant, including review-edit;
- compact draft and review schemas whose authoritative answers are sufficient to
  validate, rescore, continue when editable, and redraw review state;
- which fields are authoritative learner answers and which are derived UI state;
- how corrupt, old-version, read-error, pending-final, and finished states appear;
- round-trip and invalid-state tests that will be added to `tools/run-tests.js`.

## Reliability baseline for new simulations

Do not implement activity-local SCORM lifecycle logic. New activities use:

- `SimScorm.loadAttempt(activity)` plus `SimActivityFlow.startup(attempt)`;
- `SimScorm.makeSnapshot()` and `SimScorm.setDraftProvider()` for persistence;
- `SimScorm.submitWithCallbacks()` plus `SimActivityFlow.submission()`;
- `SimScorm.retryPending()` for a validated immutable payload and
  `SimScorm.quarantinePending()` when activity-level decode/rescore rejects a
  structurally valid pending payload;
- `SimActivityFlow.reviewResult()` and `completionLabel()` for restored results.

The activity owns its model, scoring, snapshot validation, and learner-facing
views. The shared layer owns LMS reads/writes, pending-final durability,
commit/finish ordering, BFCache handling, and recorded-result trust.

For every phase/invariant state accepted by an activity restore function:

```text
restore(encode(validState)) preserves its scored meaning and continuation path
```

Execute one legal continuation after restore. Reject a snapshot when it violates
its matrix row, skips required work, dead-ends the learner, or changes the score.
An active answer or future data is invalid only when that phase/variant says so;
review-edit continuations can legitimately retain them. Rebuild generated IDs,
but validate authoritative relationship keys. Only normalize old data through an
explicit, tested migration.

Review restoration follows this order:

```text
validate snapshot -> restore answer -> activity scorer
-> SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

Client-side SCORM scoring is appropriate only for formative or low-risk use. It
can be changed with browser developer tools and must not contain secrets. High-
risk assessment needs trusted server-side validation.
