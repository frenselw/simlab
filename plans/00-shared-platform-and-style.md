# Project Design Baseline

SimLab activities are mobile-first educational tools: open directly into a task,
use Traditional Chinese learner-facing copy, and share a calm, readable style.
Keep the platform generic; each activity owns its subject model and rubric.

## Document roles

- This baseline defines shared learner experience and visual rules.
- The [production guide](../docs/simulation-scorm-production-guide.md) defines
  implementation, persistence, SCORM, and verification contracts.
- The [plan template](NEW-SIMULATION-PLAN-TEMPLATE.md) records activity-specific
  decisions, parameters, state, and evidence; link shared rules instead of copying them.
- Activity plans specialize these contracts. Earlier plans, source code, and
  historical acceptance records may predate them; label outstanding alignment
  work explicitly. An old implementation is not an exception to the current rules.

## Platform and shared style

- Prefer static HTML, CSS, and JavaScript, with native SVG/Canvas. Keep each
  activity independently runnable in Live Server and packageable as SCORM 1.2.
- Reuse `sim/shared/styles.css`, `sim/shared/scorm.js`, and
  `sim/shared/activity-flow.js`. Add shared helpers only for demonstrated reuse.
- Use the semantic colors, borders, radii, and control tokens in the shared
  stylesheet as the source of truth. Keep white/light-grey surfaces, strong
  text contrast, blue primary actions, and restrained subject-specific colors.
- Use compact headings, clear control groups, and one obvious next action.
  Cards may group repeated items or feedback; avoid nested cards, decorative
  landing pages, oversized titles, and persistent decorative highlights.
- Add a library only when native features fall short. Package dependencies
  locally with relative paths; CDN access is for development only. Do not load
  MathJax, JSXGraph, or p5.js globally or add a build system without a concrete need.

## Layout

Use three regions: a full-width **header**, a **simulation stage**, and a
**control panel**. Keep the activity title and applicable task navigation in the
header, outside the scrolling control panel.

- Phone: header, then stage, then controls. Tablet/desktop may place stage and
  controls beside each other. Avoid horizontal page scrolling.
- Choose panel width from the space needed by the stage and its controls. The
  shared sidebar size is a starting point, not a fixed requirement: a broad
  drawing task may need a narrower panel; longer controls may need more room.
  Record the choice and breakpoint in the activity plan.
- If a substantial panel is repeatedly used while viewing the stage, use a
  bounded split-panel: the stage stays visible while the lower panel scrolls.
  Short controls may use natural page flow. Record this classification.
- Give the stage and panel enough usable space at short phone heights; reflow
  content instead of shrinking labels or hiding the final controls.

Use `linear-motion-velocity-lab` as a reference for the three-region structure
and header navigation. Its exact dimensions and subject graphics are not presets.
See the production guide for the bounded layout and scroll implementation.

## Navigation

Decide navigation from **data and operation dependencies**, not topic order:

| Task relationship | Navigation |
|---|---|
| Independent tasks | Direct task buttons in the header; switching preserves each draft |
| A step uses the previous step's measurement, construction, or answer | Sequential controls; progress labels must not imply unrestricted jumping |
| Independent questions with dependent steps inside each | Direct question navigation plus sequential steps within each question |

Show the current task and recorded/unanswered state without implying correctness.
Returning to an editable step preserves work unless an explicit reset or a
documented dependency change invalidates it. Regardless of task dependencies,
the final check remains reachable under the next section's contract.

## Submission and reset

- From every editable stage, including an optional practice stage, provide a
  route to **check current answers**, then an explicit **submit** action.
  Blank and partial attempts are valid; do not require every task to be visited,
  completed, confirmed, or individually skipped before final submission.
- The check view lists what will be scored and what is unanswered, permits
  returning to edit, and explains omissions without blocking submission.
  Completing the last task must not submit automatically.
- Unanswered scoring items earn zero; independently valid work retains the
  credit defined by the rubric. A completely untouched attempt scores zero;
  preset demonstrations or default positions are not learner answers.
- Score the submitted final state unless the plan explicitly requires process
  scoring. Default to revealing correctness and detailed scores after submission;
  any teaching feedback shown earlier must be specified in the plan.
- While editable, allow appropriate remeasurement, redraw, per-task reset, or
  whole-attempt redo. Label the scope and explain any downstream work it clears.
- Once a result is recorded, keep that attempt review-only, including zero-score
  attempts. Do not offer a learner-facing clear-results/restart action in either
  Moodle or standalone mode. A new Moodle attempt is started through Moodle.
- Standalone browser refresh starts a fresh practice session with empty answers,
  including after submission. In Moodle, retain work within the same attempt.
  Follow the production guide's [refresh/resume contract](../docs/simulation-scorm-production-guide.md#standalone-refresh-and-moodle-resume).
- A pending or uncertain submission also cannot be cleared or reopened; retain
  its payload for retry. Technical errors must not claim a confirmed score or
  submission. Recovery rules are defined in the production guide.

## Typography and controls

- Use the shared system UI font for Chinese interface text; reserve math fonts
  for mathematical notation. Monospace is suitable for numeric readouts.
- Start with body/main controls at `1rem` (normally 16px), compact titles at
  `1.25rem`–`1.5rem`, and secondary text around `0.875rem`. Check necessary diagram
  labels at their **rendered phone size**, after SVG/Canvas scaling.
- Keep touch targets at least `44px`; small visible handles may have larger
  transparent hit areas. Do not enlarge all diagram marks to button size.
- Prefer direct manipulation, sliders, toggles, and buttons. Avoid precise text
  entry unless needed by the task; provide keyboard alternatives where applicable.
- Keep focus/active states clear and make every action usable without hover.
  For repeated object types, use aligned name/symbol columns and `− / count / +`
  controls rather than an expanding list of duplicate buttons.
- Keep instructions short. A temporary stage hint may point to the “操作面板”;
  avoid location-dependent wording and remove the hint when its action is taken.

## Diagrams and notation

- Keep diagrams high-contrast and uncluttered. Use light grids, dashed auxiliary
  lines, and meaningful colors consistently. Distinguish physical surfaces from
  rays, ropes, and vectors using thickness or hatching when needed.
- For constructed force/displacement vectors, use one continuous filled arrow
  shape with a clear head and its tip exactly at the model endpoint. Keep short
  arrows legible. Visual sizing must not change vector geometry, snapping, or
  scoring; choose shaft/head dimensions for the activity and rendered scale.
  Ray direction markers and other subject graphics may use different conventions.
- Place labels near their objects without covering lines, controls, other labels,
  or the stage edge. Use subtle selection cues instead of large persistent halos.
- Use math serif fonts, italic variables, upright numbers/units/operators and
  function names such as `sin`/`cos`, and real superscripts/subscripts. Distinguish
  variable subscripts from upright numeric/descriptive ones. Do not show raw
  `F_1` or LaTeX commands to learners.
- Use the same math font stack across rendering surfaces: `"STIX Two Math",
  "Cambria Math", "Latin Modern Math", "Times New Roman", serif`.
- Declare the vector-versus-magnitude convention in the plan. Keep notation
  consistent across the stage, prompts, controls, previews, and results. Native
  HTML/SVG is sufficient for simple formulas; LaTeX-like typography does not
  require a rendering library.

Use the force composition/decomposition activities as references for arrow
construction and math typography, following the current rules above.

## Snapping

Every plan must decide whether key alignments need snapping and why. Provide it
when finger precision would otherwise obstruct the intended construction.

- Specify targets (endpoints, visible intersections, directions, or grid values),
  tolerances, and units. Use screen/CSS-pixel distance for proximity so zoom does
  not unexpectedly change the interaction; record angular/value tolerances separately.
- Preview the snapped position during movement and preserve that position on
  release. Avoid jitter, surprise jumps, and changes to objects not being dragged.
- Snap to task-appropriate geometry that is available to the learner. A snap
  does not imply correctness; it must not silently reveal a hidden answer,
  repair the learner's whole construction, or prevent a valid alternative.
- Keep snapping thresholds separate from scoring tolerances. A visual grid alone
  does not require snapping, and freehand tasks need not snap every stroke.

## Touch preview

Every plan records **needed / not needed and why**, by manipulation type. If a
finger hides a detail needed for accurate placement, provide a local magnified
preview. Ordinary buttons or coarse dragging need no automatic preview.

Show the real scene, relevant reference geometry, selected object, and current
post-snap position. Keep the preview in a stable unobstructed corner; move it only
when needed to avoid the finger. It must not intercept gestures, reveal an answer,
or displace the actual object from its normal drag path. Hide it on completion,
cancellation, navigation, or locking. Keep the stage camera stable during a drag.

## Mobile interaction

Gesture ownership follows the starting region:

- Non-interactive stage content scrolls the enclosing page/Moodle host.
- An independently scrolling control panel scrolls only itself, including at
  its boundaries; the stage and enclosing page stay fixed.
- A drag target or active drawing surface owns its manipulation; all scrolling
  stays fixed. Short natural-flow controls share the enclosing page's scroll.

For drawing anywhere within a canvas, confine the drawing surface inside the
stage and reserve **usable vertical-swipe strips on both sides**. Neither strip
may start a stroke or drag; each must scroll the same enclosing page/host as blank
stage content. Record their actual width and verify finger access on a narrow
phone. A decorative border or a few leftover pixels is insufficient. Individual
drag handles must not disable scrolling across the whole stage.

Phone usability is a delivery requirement. Verify readable labels, reachable
controls, both side strips when applicable, every drag/drawing type, and preview
placement. The [production guide](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)
owns the detailed layout, trusted-touch matrix, source/package checks, and real
phone Moodle acceptance. A desktop screenshot is not evidence of those checks.
