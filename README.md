# SimLab

Mobile-first educational simulations packaged as SCORM 1.2 activities for Moodle.

## Current activities

- `fbd-horizontal-block` - 水平面靜止物體受力圖
- `plane-mirror-pencil-ray-diagram` - 平面鏡鉛筆成像光路圖

## Local development

Open each activity directly with Live Server:

```text
sim/fbd-horizontal-block/index.html
sim/plane-mirror-pencil-ray-diagram/index.html
```

## SCORM packaging

Build one Moodle activity at a time:

```powershell
node tools/package-scorm.js fbd-horizontal-block
node tools/package-scorm.js plane-mirror-pencil-ray-diagram
```

The ZIP files are written to `output/`.
