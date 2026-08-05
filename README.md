# SimLab

Mobile-first educational simulations built as static web apps and packaged as
SCORM 1.2 activities for Moodle.

## Current activities

- `fbd-horizontal-block` - 水平面靜止物體受力圖
- `plane-mirror-pencil-ray-diagram` - 平面鏡鉛筆成像光路圖
- `displacement-distance-map-journey` - 路程、位移與總位移地圖任務
- `inertial-reference-frame-road-observer` - 慣性參考系公路觀察任務
- `position-time-graph-motion-lab` - 位置—時間圖運動實驗室
- `linear-motion-velocity-lab` - 直線運動：平均速度與瞬時速度
- `kinematics-driving-challenge` - 勻速與勻變速：駕駛控制挑戰
- `kinematics-qualitative-graph-sketching` - 勻速與勻變速：三圖手繪挑戰
- `kinematics-quantitative-graph-builder` - 勻速與勻變速：三圖定量建構挑戰
- `free-fall-stroboscopic-measurement-lab` - 自由落體：頻閃量度實驗室
- `centre-of-mass-investigation-lab` - 重心探究實驗室
- `hookes-law-spring-investigation-lab` - 胡克定律：彈簧探究與預測實驗室

## Local development

Open an activity directly with Live Server:

```text
sim/<activity-folder>/index.html
```

For example:

```text
sim/displacement-distance-map-journey/index.html
```

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

The ZIP files are written to `output/`.

Run the complete local quality checks and build every activity:

```text
npm run check
npm test
npm run package:all
```

The position–time lab also has a real-browser interaction gate which loads its
production HTML, CSS, and JavaScript at desktop and 320 px widths:

```text
npm run test:browser:position-time
```

This gate requires a local Google Chrome or Chromium executable. It detects the
usual macOS, Linux, and Windows install locations. Set `CHROME_PATH` to the full
browser executable path when using a non-standard installation; a missing
browser is reported as a failed prerequisite rather than a skipped test.

## Project notes

Before adding or changing a simulation, read:

- `plans/00-shared-platform-and-style.md`
- `docs/simulation-scorm-production-guide.md`
- the simulation-specific plan in `plans/`

Prefer plain HTML, CSS, and JavaScript. Reuse `sim/shared/styles.css` and
`sim/shared/scorm.js`; each simulation owns its own model and scoring rubric.
