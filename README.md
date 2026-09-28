# SimLab

Mobile-first educational simulations built as static web apps and packaged as
SCORM 1.2 activities for Moodle.

## Current activities

The activities below are registered in `sim/config.js`, which records their status.

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

Run the complete local quality checks and build every activity:

```text
npm run check
npm test
npm run package:all
```

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
```

These checks require a local Google Chrome or Chromium executable. They detect the
usual macOS, Linux, and Windows install locations. Set `CHROME_PATH` to the full
browser executable path when using a non-standard installation; a missing
browser is reported as a failed prerequisite rather than a skipped test.

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

Prefer plain HTML, CSS, and JavaScript. Reuse `sim/shared/styles.css`,
`sim/shared/scorm.js`, and `sim/shared/activity-flow.js`; each simulation owns its
own model, scoring rubric, and answer validation. The shared runtime handles
startup, persistence, submission, and the SCORM attempt lifecycle.

When adding an activity, register its catalogue metadata in `sim/config.js`,
list every runtime dependency in `sim/manifests/<activity-folder>.xml`, and add
new tests to `tools/run-tests.js`. Define persisted phases and snapshot schemas
in the activity plan before implementing draft or review restoration.

Browser-computed SCORM scores are intended for formative or low-risk assessment.
High-risk assessment requires trusted server-side validation.
