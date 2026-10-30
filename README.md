# SimLab

Mobile-first interactive physics simulations for classroom demonstrations and student investigations. SimLab provides standalone teacher workbenches that also form the reusable foundation for circuit activities, alongside assessed student activities that run independently or as **SCORM 1.2** packages in Moodle. Learner interfaces use Traditional Chinese, with direct manipulation, drawing, measurement and curve fitting at the centre of the learning experience.

Each entry runs as static HTML, CSS and JavaScript with SVG or Canvas. No front-end build step is required to use it through Live Server, and third-party runtime assets are included in the relevant packages.

[Quick start](#quick-start) · [Activity catalogue](#activity-catalogue) · [Packaging and deployment](#packaging-and-deployment) · [Development and verification](#development-and-verification) · [Maintenance guides](#maintenance-guides)

## Current scope

The teaching tools listed below comprise **three teacher workbenches and 25 assessed student activities**, registered in [sim/config.js](sim/config.js). The catalogue also includes a separate [SCORM fullscreen test variant](sim/newtons-third-law-fullscreen-test/index.html) of the Newton's Third Law activity.

| Type | Purpose | Scores and saved work |
|---|---|---|
| Teacher workbench | Free circuit construction and classroom demonstration; a reusable foundation for designing SCORM circuit activities | Unscored; export and import JSON to save circuits |
| Assessed student activity | Manipulate, measure or draw, then check answers and explicitly submit | Activity-specific partial credit; Moodle retains work and results within the same attempt |

`active` is the catalogue's deployable status. Consult each activity plan for the actual verification scope of a particular version. **Local test results do not establish real Moodle or physical-phone acceptance.**

## Quick start

### Try an activity locally

1. Open the project in VS Code and start Live Server, or use another local static server.
2. Open an entry from the catalogue below at `sim/<activity-folder>/index.html`, for example:

   ```text
   sim/horizontal-projectile-lab/index.html
   sim/circuit-workbench/index.html
   ```

3. Use the activity directly. Running existing pages does not require `npm ci`.

Catalogue links point to entry files in this repository. A source-hosting website displays their source; use a local static server or a deployed URL for interactive use.

Refreshing a student activity in standalone mode starts a fresh practice session. Moodle restores work within the same attempt. Submitted attempts are review-only, and pending submissions stay locked for retry. All three teacher workbenches also start fresh on refresh; export JSON before leaving and import it explicitly to reopen a circuit. See the [refresh and resume contract](docs/simulation-scorm-production-guide.md#standalone-refresh-and-moodle-resume).

### Set up development tools

Checks, tests and packaging require **Node.js 22 or newer**. From the repository root, run:

```sh
npm ci
```

On Windows PowerShell, use `npm.cmd` in place of `npm` if execution policy blocks `npm.ps1`. Browser regressions also require local Chrome or Chromium; see [browser verification](#browser-verification).

## Activity catalogue

English labels below describe each activity; the accompanying Chinese names match the learner-facing titles.

### Teacher circuit workbenches

Teacher workbenches support classroom demonstrations and provide the foundation for designing future SCORM circuit activities. Authors can build and explore a circuit, then configure its initial state, available components, permitted actions and checks for a focused student task.

All three workbenches share the `CircuitEditor.mount(host, config)` editor, wiring and interaction code, with separate physics backends. An assessed activity reuses this core and adds its own questions, rubric, feedback, persistence and SCORM attempt flow. See the [activity authoring guide](docs/circuit-activity-authoring.md) for configuration and integration.

| Workbench | Current features | Usage and model guide |
|---|---|---|
| [DC Circuit Workbench](sim/circuit-workbench/index.html) — 電路工作台 | DC steady-state circuits, finite-length cables, source internal resistance, resistors and lamps, sliding rheostats, A/V/G/W instruments, potential and current displays | [DC usage and core API](docs/circuit-workbench-core.md) |
| [AC Circuit Workbench](sim/circuit-ac-workbench/index.html) — 交流電路工作台 | Time stepping, AC sources, generator and flux observations, capacitors and inductors, transformers, RMS measurements, waveforms and LC energy exchange | [AC authoring and physics](docs/circuit-ac-workbench.md) |
| [Household Circuit Workbench](sim/circuit-household-workbench/index.html) — 家庭電路工作台 | An educational RMS model of L/N/E wiring, appliances, earthing, human contact, faults, protection timing and electrical energy | [Household maintenance guide](docs/circuit-household-workbench.md) |

The workbenches support real/schematic views, undo/redo, JSON export/import and SVG export. High-voltage transmission is a **preset inside the AC workbench**. It compares direct transmission with step-up/step-down transmission using identical sources and loads; delivered load power differs. See the [AC classroom presets and model limits](docs/circuit-ac-workbench.md#課堂預設與教學界限) for the comparison conditions.

The two assessed DC activities below already use this shared foundation. Assessed AC and household activities still need their own questions, rubrics and persistence formats.

### Assessed student activities

#### Motion and graphs

| Activity | Main task |
|---|---|
| [Rocket Factory: Launch to Orbit](sim/rocket-space-mission-lab/index.html) — 火箭工廠：發射入軌 | Assemble a 3D rocket with a fixed 150 kg payload, control launch and staging, and reach a safe near-circular orbit; [implementation and readiness plan](plans/40-rocket-space-mission-lab.md) |
| [Distance and Displacement Map Journey](sim/displacement-distance-map-journey/index.html) — 路程、位移與總位移地圖任務 | Move around a map, measure distance and draw segment and total displacements |
| [Inertial Reference Frames: Road Observers](sim/inertial-reference-frame-road-observer/index.html) — 慣性參考系：公路觀察任務 | Switch viewpoints and use relative motion to identify reference frames |
| [Position–Time Graph Motion Lab](sim/position-time-graph-motion-lab/index.html) — 位置—時間圖運動實驗室 | Set up motion, then observe, draw and measure position–time graphs |
| [Linear Motion: Average and Instantaneous Velocity](sim/linear-motion-velocity-lab/index.html) — 直線運動：平均速度與瞬時速度 | Measure motion using a ruler, timer and time magnifier |
| [Uniform Motion and Constant Acceleration: Driving Challenge](sim/kinematics-driving-challenge/index.html) — 勻速與勻變速：駕駛控制挑戰 | Operate the accelerator and brakes, and interpret motion graphs |
| [Motion Graph Sketching Challenge](sim/kinematics-qualitative-graph-sketching/index.html) — 勻速與勻變速：三圖手繪挑戰 | Sketch qualitative x–t, v–t and a–t graphs from motion descriptions |
| [Quantitative Motion Graph Builder](sim/kinematics-quantitative-graph-builder/index.html) — 勻速與勻變速：三圖定量建構挑戰 | Construct graphs with precise coordinates from initial conditions and elapsed time |
| [Free Fall: Stroboscopic Measurement Lab](sim/free-fall-stroboscopic-measurement-lab/index.html) — 自由落體：頻閃量度實驗室 | Set a flash frequency, measure positions and infer motion patterns |
| [Motion Composition: Stroboscopic Trajectories](sim/motion-composition-stroboscopic-lab/index.html) — 運動合成：頻閃軌跡建構 | Compare component motions at equal time intervals and construct the resultant trajectory |
| [Horizontal Projectile Motion: Trajectory Measurement and Fitting](sim/horizontal-projectile-lab/index.html) — 平拋運動：軌跡量度與擬合 | Adjust a recording trough, measure trajectory points, fit a curve and calculate the mean launch speed |
| [Circular Motion: Linear and Angular Speed Measurement](sim/circular-motion-speed-lab/index.html) — 線速率與角速率量度 | Time points on one disc and two belt-driven wheels, unwrap their paths, then compare linear and angular speeds |
| [Centripetal Force Source](sim/centripetal-force-source-lab/index.html) — 誰提供向心力：受力分析與圓心方向 | Identify the centre, draw real forces, and explain their radial resultant in six situations |
| [Circular Motion: Velocity and Acceleration Directions](sim/circular-motion-vector-lab/index.html) — 圓周運動：由位移到速度與加速度方向 | Shorten the time interval, compare displacement directions and construct velocity changes to infer instantaneous directions |
| [Centripetal Force Investigation](sim/centripetal-force-investigation-lab/index.html) — 向心力探究：操作轉盤與同步量測 | Push a turntable, compare synchronous radial force readings and fit the observed relationships |

Rocket Factory uses locally packaged Three.js and requires WebGL 2. Learners assemble up to two stages with the same fixed 150 kg payload and control throttle/pitch/staging to establish a safe near-circular orbit. The launch-only rubric awards 10/15/45/30 points for liftoff, reaching space, orbit progress, and circularity (pass: 70). Borderline bound trajectories earn partial orbit credit; a high apogee does not erase safe-orbit credit. Submitted v2 results retain their original rubric while unfinished v2 drafts resume under the revised rubric. The 3D view has a fixed flight plane and attitude assistance. The launch-only assessment has a separate activity ID from the original two-task SCO; create a new Moodle activity when moving from that original version. The previous two-task package is retained separately at output/rocket-space-mission-lab-legacy-p40-scorm.zip. Standalone refresh starts fresh; Moodle resumes the same attempt paused. See the [activity plan and actual readiness evidence](plans/40-rocket-space-mission-lab.md) for model limits, scoring and acceptance status.

#### Forces and investigations

| Activity | Main task |
|---|---|
| [Free-Body Diagram: Stationary Block](sim/fbd-horizontal-block/index.html) — 水平面靜止物體受力圖 | Draw the forces on a stationary block subject to an external force |
| [Centre of Mass Investigation Lab](sim/centre-of-mass-investigation-lab/index.html) — 重心探究實驗室 | Locate centres of mass through support, suspension and rotation of 3D objects |
| [Hooke's Law: Spring Investigation and Prediction](sim/hookes-law-spring-investigation-lab/index.html) — 胡克定律：彈簧探究與預測實驗室 | Measure extension, build an F–x model, make predictions and design a safe load |
| [Static and Kinetic Friction Investigation Lab](sim/static-kinetic-friction-investigation-lab/index.html) — 靜摩擦力與滑動摩擦力探究實驗室 | Drag an object, record a pulling-force–time graph and analyse friction |
| [Force Composition Construction Lab](sim/force-composition-construction-lab/index.html) — 力的合成作圖實驗室 | Construct resultant forces using parallelogram and head-to-tail methods |
| [Orthogonal Force Decomposition](sim/force-orthogonal-decomposition/index.html) — 力的正交分解作圖練習 | Draw perpendicular force components in horizontal and inclined-plane settings |
| [Force Equilibrium: Free-Body Diagram Challenge](sim/force-equilibrium-diagram-lab/index.html) — 共點力平衡：受力圖挑戰 | Identify and draw the forces on a specified body in equilibrium |
| [Force Equilibrium: Advanced Diagram Challenge](sim/force-equilibrium-advanced-diagram-lab/index.html) — 共點力平衡：進階受力圖挑戰 | Analyse situations with multiple contacts, springs and interacting bodies |
| [Newton's Second Law: Fair Tests and Graphs](sim/newtons-second-law-investigation-lab/index.html) — 牛頓第二定律：公平測試與數據作圖 | Design two fair tests, measure acceleration and plot and fit the results |
| [Newton's Third Law: Reaction Force Diagrams](sim/newtons-third-law-reaction-force-lab/index.html) — 牛頓第三定律：反作用力作圖挑戰 | Select the receiving body and draw a reaction force's anchor, direction, magnitude and type |

#### Optics and circuits

| Activity | Main task |
|---|---|
| [Plane Mirror: Pencil Ray Diagram](sim/plane-mirror-pencil-ray-diagram/index.html) — 平面鏡鉛筆成像光路圖 | Draw rays and extensions, and position the virtual image |
| [Two-Lamp Series Circuit](sim/circuit-dc-series-build/index.html) — 兩燈串聯搭建 | Build a series circuit from a fixed toolbox, earning credit for wiring and powered operation |
| [Sliding Rheostat Adjustment](sim/circuit-dc-rheostat-adjust/index.html) — 滑動變阻器調參 | Adjust a fixed circuit to reach target current/voltage readings and explain resistance changes |

Activity-specific physics, rubrics, persistence formats and verification records are in [plans/](plans/).

## Packaging and deployment

### Public simulations: GitHub Pages

The public trial site at <https://frenselw.github.io/simlab/> contains the DC, AC and household workbenches plus Rocket Factory. Each entry has an actual simulation screenshot in `tools/pages/previews/`. Build it with `npm run build:pages`; the generated site is in `output/pages/`. The builder reuses the workbench asset lists and standalone packager, and the rocket's existing SCORM packager/manifest, retaining all shared dependencies and relative paths. The public site excludes the SCORM root manifest and unselected activities.

In repository **Settings → Pages**, select **GitHub Actions** as the source. To publish an update, open **Actions → Publish SimLab simulations → Run workflow** on `main`. Ordinary pushes do not update the site. The workflow validates the generated files before deploying with GitHub's Pages actions. For local verification, run `node tools/pages.test.js` and `node tools/pages-browser-regression.js`; set `SIMLAB_PAGES_URL=https://frenselw.github.io/simlab/` to check the deployed site instead.

All public simulations start fresh on refresh. Workbenches are unscored; export JSON to retain a circuit and import it explicitly to reopen it. Rocket Factory runs as standalone practice and does not report results to Moodle on this site. Deployment scope and actual verification evidence are recorded in the [Pages publication plan](plans/github-pages-circuit-workbenches.md).

### Student activities: SCORM 1.2

Package one activity, for example:

```sh
npm run package -- horizontal-projectile-lab
```

This writes `output/packages/horizontal-projectile-lab-scorm.zip`. Add a **SCORM activity** in Moodle and upload the ZIP. Its root contains `imsmanifest.xml`, with the activity and shared runtime assets included according to the manifest.

Build and verify all SCORM packages:

```sh
npm run package:all
```

This command processes only SCORM packages declared in `sim/manifests/`. Rebuild after source changes. Generated ZIPs go into the Git-ignored `output/packages/` directory; rebuilding does not update existing Moodle or Sites deployments.

ZIPs are kept separately from other generated files:

| Directory | Contents |
|---|---|
| `output/packages/` | Current SCORM and standalone ZIPs only |
| `output/reports/` | Build and retained verification reports |
| `output/playwright/`, `output/ci-tests/` | Necessary test evidence |
| `output/tmp/<task>/` | Temporary files, removed when the task finishes |

See the [output and cleanup contract](docs/simulation-scorm-production-guide.md#generated-output-and-cleanup).

### Teacher workbenches: standalone ZIPs

Rebuild all three workbenches and three assessed DC packages, checking source/ZIP file consistency:

```sh
npm run package:circuit-platform
```

| Workbench | Output ZIP in `output/packages/` | Launch file / Moodle main file |
|---|---|---|
| DC | `circuit-workbench-standalone.zip` | `circuit-workbench/index.html` |
| AC, including high-voltage transmission | `circuit-ac-workbench-standalone.zip` | `circuit-ac-workbench/index.html` |
| Household | `circuit-household-workbench-standalone.zip` | `circuit-household-workbench/index.html` |

These three standalone ZIPs have no `imsmanifest.xml`. Extract the complete archive for local use, or upload it as a Moodle **File resource**, unzip it and select the launch file above as the main file. Preserve all relative folder paths. AC and household packages also include shared code under `circuit-workbench/`.

The same command produces `circuit-dc-series-build-scorm.zip`, `circuit-dc-rheostat-adjust-scorm.zip`, `circuit-dc-wire-match-scorm.zip` and the consistency report `output/reports/circuit-platform-build.json`. Use `npm run package:circuit` when only the DC teacher ZIP is needed; after a shared circuit-core change, use the complete `package:circuit-platform` command.

## Development and verification

### Common commands

Run these from the repository root. Choose checks appropriate to the change; complete delivery requirements are in the [production verification checklist](docs/simulation-scorm-production-guide.md#verification-checklists).

| Command | Purpose |
|---|---|
| `npm run check:tests` | Validate test registration, ownership and helper mappings without executing tests |
| `npm run check` | Validate the test registry, JavaScript syntax and project-specific SCORM manifest rules |
| `npm run test:fast` | Run all registered non-browser tests |
| `npm test` | Run the complete registered suite, including browser regressions |
| `npm run package:all` | Rebuild and verify all SCORM ZIPs |
| `npm run package:circuit-platform` | Rebuild and verify the three workbenches and three assessed DC ZIPs |
| `node tools/check-docs.js README.md` | Check repository links and Markdown anchors in this README |
| `git diff --check` | Check uncommitted changes for whitespace errors and conflict markers |

`check` uses SimLab's SCORM 1.2 manifest profile and dependency checks, rather than the complete official SCORM schema set. Documentation-only changes require link and diff checks; they do not require repeating every interaction scenario.

For a **committed range whose head matches the checkout**, preview the affected selection before executing it:

```sh
npm run test:affected -- --base=<base-sha> --head=<head-sha> --plan
npm run test:affected -- --base=<base-sha> --head=<head-sha>
```

Replace `<base-sha>` and `<head-sha>` with actual commits. A local comparison covers only that range and does not establish GitHub PR/main baseline verification. Reports and per-entry logs are written under `output/ci-tests/`.

### Browser verification

[package.json](package.json) provides topic-specific `test:browser:*` commands. [tools/test-registry.js](tools/test-registry.js) owns the complete test inventory, browser ownership and separate manual acceptance checks. Examples:

```sh
npm run test:browser:newtons-second-law
npm run test:browser:newtons-third-law
npm run test:browser:circuit -- --activity-core-smoke
npm run test:browser:circuit -- --micro-flow-smoke
npm run test:circuit-ac
npm run test:circuit-activities
```

Browser runners look for Chrome or Chromium in common installation locations. Set `CHROME_PATH` to the full executable path for a non-standard installation. A missing browser is a failed prerequisite.

The shared runner separately checks trusted touch input and scrolling in Moodle-style hosts, for example:

```sh
npm run test:browser:mobile-scroll -- --host=T2 --mode=source
npm run test:browser:mobile-scroll -- --host=T3 --mode=package
```

Source/extracted-package coverage, phases, host cases, physical-device requirements and Windows/Git Bash Playwright usage are documented in [browser tooling](docs/simulation-scorm-production-guide.md#browser-check-tooling) and the [gesture ownership contract](docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership).

### CI and delivery gates

[Quality](.github/workflows/quality.yml) creates an immutable affected verification plan for pushes and pull requests. Missing baseline or dependency evidence triggers conservative full coverage; missing or failed required work cannot pass the final gate. [Quality Full](.github/workflows/quality-full.yml) independently runs the complete suite and both package types. It is scheduled daily at 03:30 Macau time and also accepts a manually specified ref.

The project distinguishes **package-ready** (source, test and package verification) from **Moodle-ready** (additional real Moodle and physical-phone acceptance). Historical audits and local browser records support only their recorded versions and scopes; consult each activity plan for its status. See [CI and maintenance contracts](docs/simulation-scorm-production-guide.md#ci-gates-and-maintenance-commands) and the [delivery checklists](docs/simulation-scorm-production-guide.md#package-ready-checks).

## Project structure

```text
sim/
  config.js                    Activity catalogue and status
  shared/                      Shared styles, fullscreen, SCORM and attempt flow
  manifests/                   Student activity SCORM manifests
  <activity>/                  Activity entry, model, scoring and persistence
  circuit-workbench/           DC teacher entry and shared circuit core
  circuit-ac-workbench/        AC teacher entry and classroom presets
  circuit-household-workbench/ Household teacher entry and classroom presets
plans/                         Activity decisions, rubrics, schemas and evidence
docs/                          Production contracts, authoring guides and audits
tools/                         Checks, test selection, browser runners and packaging
output/                        Generated artifacts (ignored; see output organization above)
```

## Maintenance guides

Before adding or changing an activity, read:

1. [Shared product and style rules](plans/00-shared-platform-and-style.md): layout, navigation, diagrams, touch and submission experience.
2. [Simulation and SCORM production guide](docs/simulation-scorm-production-guide.md): implementation, authoritative state, persistence, trust, retries and acceptance contracts.
3. [New activity plan template](plans/NEW-SIMULATION-PLAN-TEMPLATE.md): define the subject model, risk, rubric, dependencies, phases and tests before implementation.
4. The [relevant activity plan](plans/): activity-specific decisions and executed verification evidence.

New activities must update `sim/config.js`, their runtime asset list or SCORM manifest, and `tools/test-registry.js`. Run `check:tests` and record a selection preview for committed changes, following the [test registration procedure](docs/simulation-scorm-production-guide.md#test-registration-for-new-simulations).

For circuit work, also read the [activity authoring guide](docs/circuit-activity-authoring.md) and [shared architecture map](docs/circuit-workbench-architecture-review.md#現行入口與交付物). Reuse the common interaction and physics core; each assessed activity owns its questions, authoritative answers, rubric and persistence format.

This README provides entry points and workflows; shared rules remain in their owning documents. Browser scoring is intended for formative or low-risk assessment. High-risk assessment requires trusted server-side validation.
