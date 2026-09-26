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

## Local development

Open an activity directly with Live Server:

```text
sim/<activity-folder>/index.html
```

For example:

```text
sim/displacement-distance-map-journey/index.html
```

Each activity runs independently without a front-end build step. Outside Moodle,
the shared SCORM runtime provides a local fallback for development.

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
```

These checks require a local Google Chrome or Chromium executable. They detect the
usual macOS, Linux, and Windows install locations. Set `CHROME_PATH` to the full
browser executable path when using a non-standard installation; a missing
browser is reported as a failed prerequisite rather than a skipped test.

The [Quality workflow](.github/workflows/quality.yml) runs syntax/manifest checks,
unit and regression tests, package verification, and selected browser checks on
pushes and pull requests. Local checks do not replace validation in a real
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
