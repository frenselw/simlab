# SimLab

Mobile-first educational simulations built as static web apps: standalone
teacher workbenches and SCORM 1.2 student activities for Moodle.

## Teacher circuit workbench

The [電路工作台](sim/circuit-workbench/index.html) is a standalone DC steady-state
teaching tool with a large canvas and compact controls. It provides:

- A stock of 20 physical cables by default, with finite length, draggable ends,
  smooth bending and shared junctions. Dragging either a cable or a component can
  snap their contacts together; rotating a component straightens its attached cables.
- Adjustable source voltage/internal resistance, resistors, ideal and thermal
  lamps, switches, and a sliding rheostat with four terminals by default.
- A/V meters with three sockets and two ranges, signed analog scales and damped
  needles, a G galvanometer, and a four-terminal W meter.
- Real/schematic views, potential overlays, and current/electron animation through
  both cables and components. Motion adapts to each connected circuit so microamp
  examples remain visible; animation speed is a teaching aid, not a drift velocity.
- Optional names and quantities, quick parameter controls, undo/redo, JSON files,
  fixed-component templates, SVG export, and mouse/touch canvas navigation.

Open the [configuration examples](sim/circuit-workbench/activity-examples.html)
to try student tasks using the same `CircuitEditor.mount(host, config)` core.
Each activity can choose its components, stock, permissions, visible controls
and answer checks. These examples have no scoring or submission; formal SCORM
activities must supply their own rubric, snapshot and shared attempt lifecycle.
The DC workbench has no levels or data-recording/graph-fitting module. The
separate AC workbench below uses the same editor with a time-dependent backend.

Run `npm run package:circuit` to build `output/circuit-workbench-standalone.zip`.
Extract it and open `circuit-workbench/index.html`, preserving the sibling
`shared/` directory. This ZIP is a standalone tool, not a SCORM package.

Start with the [user/core guide](docs/circuit-workbench-core.md),
[activity authoring guide](docs/circuit-activity-authoring.md),
[architecture and maintenance notes](docs/circuit-workbench-architecture-review.md),
and [implementation plan](plans/28-circuit-workbench.md). The
[three-reviewer audit](docs/circuit-workbench-audit-2026-10-04.md) records the
version reviewed; later microcurrent changes have separate focused evidence in
the plan. Local browser evidence does not establish real-phone or Moodle readiness.

## AC circuit workbench

The [交流電路工作台](sim/circuit-ac-workbench/index.html) adds configurable AC
sources, generator/flux observations, capacitors, inductors, SPDT switches,
ideal and coupled transformers, LED direction demonstrations, RMS instruments,
waveforms/cursors and LC energy exchange. It shares wiring, dragging, permission
checks and drawing with the DC editor. [Two unscored embedding examples](sim/circuit-ac-workbench/activity-examples.html)
demonstrate fixed profiles and dynamic checkpoint restoration.

`npm run package:circuit-platform` rebuilds both workbenches and the two DC SCORM
packages, with source/ZIP byte checks. Upload `circuit-ac-workbench-standalone.zip`
as a Moodle File resource and select `circuit-ac-workbench/index.html` as its main
file. Formal AC SCORM questions and scoring are a later activity-specific step.
See the [AC implementation plan](plans/32-circuit-ac-workbench.md) and
[authoring/physics guide](docs/circuit-ac-workbench.md) for interfaces, model
limits and local versus real Moodle/device acceptance.

## Current activities

The workbench above and the student activities below are registered in
`sim/config.js`, which records their status. The catalogue also contains an
isolated fullscreen test version of the third-law activity.

- `fbd-horizontal-block` - 水平面靜止物體受力圖
- `plane-mirror-pencil-ray-diagram` - 平面鏡鉛筆成像光路圖
- `displacement-distance-map-journey` - 路程、位移與總位移地圖任務
- `inertial-reference-frame-road-observer` - 慣性參考系：公路觀察任務
- `position-time-graph-motion-lab` - 位置—時間圖運動實驗室
- `linear-motion-velocity-lab` - 直線運動：平均速度與瞬時速度
- `kinematics-driving-challenge` - 勻速與勻變速：駕駛控制挑戰
- `kinematics-qualitative-graph-sketching` - 勻速與勻變速：三圖手繪挑戰
- `kinematics-quantitative-graph-builder` - 勻速與勻變速：三圖定量建構挑戰
- `free-fall-stroboscopic-measurement-lab` - 自由落體：頻閃量度實驗室
- `centre-of-mass-investigation-lab` - 重心探究實驗室
- `hookes-law-spring-investigation-lab` - 胡克定律：彈簧探究與預測實驗室
- `static-kinetic-friction-investigation-lab` - 靜摩擦力與滑動摩擦力探究實驗室
- `force-composition-construction-lab` - 力的合成作圖實驗室
- `force-orthogonal-decomposition` - 力的正交分解作圖練習
- `force-equilibrium-diagram-lab` - 共點力平衡：受力圖挑戰
- `force-equilibrium-advanced-diagram-lab` - 共點力平衡：進階受力圖挑戰
- `newtons-second-law-investigation-lab` - 牛頓第二定律：公平測試與數據作圖
- `newtons-third-law-reaction-force-lab` - 牛頓第三定律：反作用力作圖挑戰
- `motion-composition-stroboscopic-lab` - 運動合成：頻閃軌跡建構

### Newton's second law investigation

The [Newton activity](sim/newtons-second-law-investigation-lab/index.html) lets
learners design two fair tests using an idealized cart: acceleration against net
force, and acceleration against total mass. Learners choose their variables,
adjust mass and force, and record up to six measurements per group. Starting
masses are randomized for each new attempt; keeping the control variable
constant is the learner's responsibility.

Learners drag their measurements onto three graphs—acceleration against net
force, mass, and reciprocal mass—then choose a fit and interpret its coefficients.
Fits use the learner's actual plotted points. Touch previews show the current
coordinates and units beside a magnified grid; coordinate overlays disappear
on release. Progress labels and next-step buttons guide the activity without
revealing correctness or requiring every answer before final submission.

See the [activity plan](plans/23-newtons-second-law-investigation-lab.md) for the
physics model, scoring rubric, persistence schema, and verification evidence.

### Newton's third law reaction forces

The [third-law activity](sim/newtons-third-law-reaction-force-lab/index.html)
presents five randomized scenes: an incline, accelerating blocks, a stretched or
compressed spring, a hanging or swinging ball, and Earth attracting a nearby
ball. Learners draw eight reaction forces, choosing each receiving body, anchor,
direction, magnitude and force type. Known and learner-drawn forces share one
linear scale; selecting the original body remains a legitimate, gradable mistake.

Touch dragging includes a magnified scene with separate body, force and angle
readouts. Magnitudes snap to 0.5 N steps below 10 N and 1 N steps at or above it,
with hysteresis to steady the value and 0.1 N buttons for fine adjustment.
New questions use these same increments for their given magnitudes, so every
shown value can be drawn exactly. Older Moodle attempts keep their original
questions and scores, with 0.01 N adjustment for their original readings.
Switching force pairs within a question preserves the panel's scroll position.
Dragging an arrow back to its starting point cancels that change and preserves
the previous answer. Question, force-pair, body and anchor controls retain
keyboard focus when updated. Accessible scene descriptions provide the known
forces' directions and spatial arrangement; the drawing handle announces its
current magnitude and angle.
Contact pushes use the symbol F and their paired reactions use F′.
On horizontal surfaces, support arrows and their contact markers are displayed
beside the unchanged weight arrow; the corresponding reaction stays collinear.
Moving ground illustrates uniform motion or acceleration up to a visual speed
limit, while bodies and force arrows stay fixed for drawing. Question progress,
next-step controls, undo and editable answer clearing
support the drawing process. Explicit submission awards partial credit and opens
read-only explanations and reference diagrams. Incorrect answers receive
specific explanations about the receiving body, contact point, direction,
magnitude and interaction type. The shared SCORM runtime handles
draft resumption, frozen submission retries and completed attempts.

See the [activity plan](plans/24-newtons-third-law-reaction-force-lab.md) for the
physics constraints, rubric, snapshot schema and local verification evidence.
The [independent review report](docs/reviews/2026-09-28-newtons-third-law-review.md)
records the full-branch audits, follow-up fixes and verification results. On
2026-09-28, GPT-6 Luna and GPT-6 Sol (both using Max reasoning) completed
independent reviews and follow-up checks with no outstanding confirmed findings.
Local validation passed `npm run check`, the full `npm test` suite, and
`npm run package:all`, including browser checks of the source and extracted
SCORM package. All SCORM packages were regenerated and verified.
Real Moodle, physical-phone and assistive-technology acceptance remain separate
deployment checks; browser touch and accessibility-tree checks are local evidence.

## Local development

Open an activity directly with Live Server:

```text
sim/<activity-folder>/index.html
```

For example:

```text
sim/displacement-distance-map-journey/index.html
```

Each activity runs independently without a front-end build step. Standalone
practice keeps answers in memory; refreshing starts a fresh session. Moodle
restores work within the same attempt, with completed attempts kept read-only
until Moodle supplies a new attempt. See the shared
[refresh and resume contract](docs/simulation-scorm-production-guide.md#standalone-refresh-and-moodle-resume).
The teacher workbench also starts fresh on refresh; reopening a circuit is an
explicit JSON import.

## SCORM packaging

Local quality checks and packaging require Node.js 22 or newer. Run `npm ci`
once to install the development-only ZIP and XML helpers; generated activities
remain plain static HTML, CSS, and JavaScript.

`npm run check` validates the manifests against SimLab's local SCORM 1.2
manifest profile and project-specific linkage rules. It is not a copy of the
complete official SCORM schema set.

Build one Moodle activity at a time:

```powershell
node tools/package-scorm.js <activity-folder>
```

For example:

```powershell
node tools/package-scorm.js displacement-distance-map-journey
```

The ZIP files are written to `output/<activity-folder>-scorm.zip`, with
`imsmanifest.xml` at the ZIP root and shared runtime files included. Rebuild the
ZIP after source changes before uploading it to Moodle.

Run the complete local quality checks and build every SCORM activity:

```text
npm run check
npm test
npm run package:all
```

The standalone circuit ZIP has its own asset list and builder;
`package:all` builds SCORM manifests only. After a shared circuit-core change,
rebuild the standalone ZIP and any SCORM packages that include that core.

## Browser checks

Run the focused browser regressions as needed:

```text
npm run test:browser:position-time
npm run test:browser:linear-motion
npm run test:browser:driving
npm run test:browser:qualitative-graphs
npm run test:browser:mobile-touch
npm run test:browser:hookes-law
npm run test:browser:static-kinetic-friction
npm run test:browser:force-composition
npm run test:browser:force-equilibrium
npm run test:browser:force-equilibrium-advanced
npm run test:browser:newtons-second-law
npm run test:browser:newtons-third-law
npm run test:browser:motion-composition
```

The circuit runner also supports focused source/extracted-ZIP checks:

```text
npm run test:browser:circuit -- --activity-core-smoke
npm run test:browser:circuit -- --micro-flow-smoke
```

Use the filter relevant to the change; `npm run test:browser:circuit` runs the
full workbench browser suite. Choose adjacent unit checks from the
[authoring guide](docs/circuit-activity-authoring.md#驗證範圍) and record the
coverage actually executed. Documentation-only changes need link/diff checks;
they do not require repeating every browser scenario.

These checks require a local Google Chrome or Chromium executable. They detect the
usual macOS, Linux, and Windows install locations. Set `CHROME_PATH` to the full
browser executable path when using a non-standard installation; a missing
browser is reported as a failed prerequisite rather than a skipped test.

For mobile scrolling, use the shared trusted-touch runner on source files and
extracted SCORM packages. These examples cover a nested player and a player with
an overflowing host element, including the friction activity's repeated panel
gestures:

```text
npm run test:browser:mobile-scroll -- --host=T2 --mode=source
npm run test:browser:mobile-scroll -- --host=T3 --mode=package
npm run test:browser:mobile-scroll -- --host=T3 --mode=package --phases=all --panel-sequence --slugs=static-kinetic-friction-investigation-lab
```

See the production guide's [gesture ownership contract](docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)
for layout, scroll owners, phase coverage, and the T0–T4 host cases. The
[repair plan](plans/mobile-scroll-repair-plan.md),
[repair verification record](docs/mobile-scroll-repair-verification-2026-10-01.md),
and [main integration record](docs/mobile-scroll-main-merge-2026-10-02.md) document
the fixes and their executed coverage. Local browser passes establish evidence
for the recorded cases; real-phone Moodle acceptance remains a separate gate.

The [Quality workflow](.github/workflows/quality.yml) runs syntax/manifest checks,
the full test suite and package verification alongside a separate job for the
additional browser checks on pushes and pull requests. Each job uses its own
checkout; the final `check` succeeds only when both jobs pass. This keeps all
existing checks while avoiding one shared timeout for the growing test suite.
Local checks do not replace validation in a real
Moodle student attempt; see the production guide for both acceptance checklists.

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Project notes

Before adding or changing a simulation, read:

- [Shared platform and style](plans/00-shared-platform-and-style.md)
- [Simulation and SCORM production guide](docs/simulation-scorm-production-guide.md)
- [New simulation plan template](plans/NEW-SIMULATION-PLAN-TEMPLATE.md)
- the simulation-specific plan in `plans/`

Prefer plain HTML, CSS, and JavaScript. Reuse `sim/shared/styles.css` and the
shared fullscreen control. Assessed activities use `sim/shared/scorm.js` and
`sim/shared/activity-flow.js` for startup, persistence, submission and the SCORM
attempt lifecycle. Each activity owns its authoritative answers and rubric;
circuit activities reuse the existing editor and physics core through configuration.

When adding an activity, register its catalogue metadata in `sim/config.js`,
list every runtime dependency in `sim/manifests/<activity-folder>.xml`, and add
new tests to `tools/run-tests.js`. Define persisted phases and snapshot schemas
in the activity plan before implementing draft or review restoration.
For non-assessment workbenches, follow the production guide's
[scope and shared-core contract](docs/simulation-scorm-production-guide.md#scope-and-shared-cores);
the circuit workbench declares its standalone runtime in
`sim/circuit-workbench/assets.json`.

Browser-computed SCORM scores are intended for formative or low-risk assessment.
High-risk assessment requires trusted server-side validation.
