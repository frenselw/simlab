# SimLab

Mobile-first educational simulations built as static web apps and packaged as
SCORM 1.2 activities for Moodle.

## Current activities

- `fbd-horizontal-block` - 水平面靜止物體受力圖
- `plane-mirror-pencil-ray-diagram` - 平面鏡鉛筆成像光路圖
- `displacement-distance-map-journey` - 路程、位移與總位移地圖任務
- `inertial-reference-frame-road-observer` - 慣性參考系公路觀察任務

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

Local quality checks and packaging currently require Node.js, `xmllint`, `zip`,
and `unzip` on the system path. Removing these platform tools remains a later
cross-platform packaging improvement.

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

## Project notes

Before adding or changing a simulation, read:

- `plans/00-shared-platform-and-style.md`
- `docs/simulation-scorm-production-guide.md`
- the simulation-specific plan in `plans/`

Prefer plain HTML, CSS, and JavaScript. Reuse `sim/shared/styles.css` and
`sim/shared/scorm.js`; each simulation owns its own model and scoring rubric.
