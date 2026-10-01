# Horizontal Block FBD MVP Plan

> **2026-10-01 手機滾動修復：** 已由舊自然流遷移到 bounded stage／獨立面板；activity document 沒有捲動 range，空白與鎖定後原 target footprint 由真正 host 擁有。十個力箭頭 target、partial score、capture／cancel、提交／續作及 source／package 回歸已通過。
> 實作位於 `codex/mobile-scroll-audit`；逐模式、host、尺寸及證據範圍見[修復驗證記錄](../docs/mobile-scroll-repair-verification-2026-10-01.md)，工作項目為[修復計劃](mobile-scroll-repair-plan.md) R11。共用規則由[製作指引](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)擁有。
> 以下較早的測試記錄保留為歷史證據；本輪本機 Chrome／可信輸入結果不代表已通過真實 Moodle、iPhone 或 Android 驗收。

## Purpose

Build the first named simulation: `fbd-horizontal-block`.

Students construct a free-body diagram for an object on a horizontal surface.

## Student task

The student sees this scenario: an object on a horizontal surface is acted on by
a rightward external force, but remains at rest. The student must select and
adjust the correct force arrows:

- gravity, labeled `G`;
- normal reaction;
- applied force;
- friction, when needed.

The student submits the diagram and receives a score with brief feedback.

## Minimum scope

One scenario is enough for the MVP:

- a block on a horizontal surface;
- an applied horizontal force;
- friction may oppose the motion;
- no acceleration calculation required in the first version.

## Interaction

Use direct manipulation:

- use one row per force type, with `- / count / +` controls to add or remove
  arrows;
- the current maximum is two arrows per force type, controlled by
  `MAX_FORCE_PER_TYPE` in `main.js`;
- show the Chinese force name before the symbol, aligned in separate columns;
- each arrow starts from the block center;
- drag the arrow tip to adjust direction and length;
- use relative arrow length to show force magnitude: normal reaction and gravity
  should balance each other, as should applied force and friction;
- submit when ready.

On phones, keep the diagram in the upper bounded region and the independently
scrolling controls in the lower region. The activity fills its viewport;
`html`/`body`, the app grid, and the shell have no extra document scroll range.
On wider screens, controls may sit beside the diagram.

### Touch gesture ownership

Normal vertical scroll owner on blank stage: the actual enclosing host Window
or overflow element. The bounded activity document is not a third scroll owner.
Touches starting in the controls belong only to the native contained panel.
Direct standalone with no enclosing range leaves blank gestures unclaimed;
only that host-delta expectation is N/A.

Draggable target inventory:

| Target type | Hit-target strategy | Pointer-capture target |
|---|---|---|
| Every rendered `G`, `N`, `F`, `f`, and `T` force-arrow head, including every supported duplicate instance | Stable, explicitly sized HTML hit target aligned over the SVG arrow head | The same HTML hit target; it remains mounted for the whole drag |

Gesture ownership matrix:

| Touch starts on | Expected owner | Expected scroll delta | Required pointer result |
|---|---|---:|---|
| Non-interactive diagram background | Actual enclosing host | Non-zero host movement when it has range; panel, activity document and intermediary frames stay fixed. Direct standalone without enclosing range is N/A for host movement only | Simulation does not begin a drag or change an arrow |
| Any force-arrow head (`G`, `N`, `F`, `f`, or `T`, including each duplicate instance) | Simulation | `0` on document, viewport, panel, and host surfaces | Arrow changes; `pointermove` and `pointerup`; no `pointercancel` |
| A former force-arrow-head footprint after same-page `success`, `committed`, or `frozen` submission lock | Actual enclosing host | Same as blank stage; activity document remains bounded | The stable drag target is hidden/non-owning immediately; arrows and suspend state do not change |

The diagram surface permits vertical panning from blank regions. Inner SVG
arrow graphics are visual elements, not the sole touch-action boundary.

## Scoring rubric

Current scoring for this MVP:

- Total score: 100.
- Passing threshold: 60.
- Lowest score: 0.
- Required force types: `G`, `N`, `F`, and `f`.
- Correct required force types: 20 total, 5 points per required type shown.
- Correct force directions: 40 total, 10 points per required type with the
  correct direction.
- Arrow anchors on the object: 15 total, 3.75 points per required type. In this
  MVP, arrows start from the block center, so this is a structural check rather
  than a learner-controlled placement task.
- No extra incorrect force arrows: 15. Extra non-required forces deduct points.
  Duplicate required forces deduct enough to cancel the type, direction, and
  anchor points that the duplicate would otherwise make too easy to earn.
- Balanced relative magnitudes: 10 total, 5 points each for the `N`/`G` pair and
  the `F`/`f` pair. The two pairs may use different absolute lengths.

Current tolerance:

- Direction is checked by comparing the arrow angle with the expected force
  direction.
- Accepted direction error: within 10 degrees.
- Examples: a rightward applied force at 8 degrees is accepted; at 12 degrees it
  is not. A leftward friction force at 172 degrees is accepted; at 168 degrees it
  is not.
- A force pair is accepted only when both arrows first have their correct,
  opposite directions and then `shorter arrow length / longer arrow length >=
  0.80`. Exactly `80/100` is accepted; `79/100` is not. Thus `100/100` and
  `80/100` pass, while `40/200` does not. Equal-length arrows pointing the wrong
  way receive no balance credit. This symmetric ratio implements the
  approximately `±20%` tolerance without depending on which force is used as the
  reference.
- Only opposing pairs are compared. For example, `N = G = 80` and `F = f = 140`
  receives both balance-pair scores even though the vertical and horizontal
  arrows have different absolute lengths.

The first version scores the final submitted state only. Process scoring can wait.

Easy-to-change constants in `scoring.js`:

- `DIRECTION_TOLERANCE`
- `BALANCE_LENGTH_RATIO`
- `TYPE_POINTS`
- `DIRECTION_POINTS`
- `PLACEMENT_POINTS`
- `BALANCE_PAIR_POINTS`
- `CLEAN_POINTS`
- `OTHER_EXTRA_PENALTY`
- passing threshold in the `passed` result

## Files

Planned source location:

```text
sim/fbd-horizontal-block/
  index.html
  styles.css
  main.js
  scoring.js
sim/imsmanifest.xml
```

Shared files, when created:

```text
sim/shared/
  styles.css
  scorm.js
```

## SCORM behavior

When the student submits:

- calculate final score;
- show feedback in the page;
- send score to SCORM if available;
- mark `passed` when score is at least 60, otherwise `failed`;
- finish the SCORM attempt after submission;
- save compact review data so the same submitted attempt can be reopened for
  review;
- lock the submitted attempt so re-entering it cannot change the score.

When running in Live Server without Moodle, show the same score and log the SCORM
values locally.

## Acceptance checks

- Opens directly in Live Server.
- Usable on a phone-width viewport.
- Student can complete the task without keyboard input.
- A browser-level trusted touch swipe starting on a known non-interactive diagram
  region remains unclaimed by the simulation. In T1–T3 the test places the
  actual enclosing owner away from its boundary and observes non-zero host
  movement, zero panel/inner-document movement and no arrow-state changes.
  T0 without enclosing range marks only the host movement expectation N/A.
- A browser-level trusted touch drag is exercised separately for `G`, `N`, `F`,
  `f`, and `T`, including every supported duplicate-arrow instance: the arrow
  changes, every candidate document/viewport/panel/host scroll delta remains
  zero, `pointermove` and `pointerup` occur, and `pointercancel` does not.
- Same-page `success`, `committed`, and `frozen` submission transitions
  immediately hide every force-head overlay. A trusted vertical swipe starting
  at a former arrow-head footprint then scrolls the actual enclosing host while
  arrow geometry and the post-submission suspend state remain unchanged.
- The complete gesture ownership matrix passes on both the development page and
  the launch page served from the built or extracted SCORM package. CSS/source
  inspection alone is not accepted.
- Panel mid-range and top/bottom boundary swipes keep the stage, enclosing host
  and inner document fixed; the last control remains reachable.
- Submit produces a score from 0 to 100.
- Local fallback works without Moodle.
- SCORM package contains `imsmanifest.xml`.
- Package the contents of `sim/` so `fbd-horizontal-block/` and `shared/` stay
  together.
- Moodle receives score and completion status when uploaded as SCORM 1.2.
- Re-entering a submitted attempt shows the submitted state and feedback, but
  does not allow editing or resubmission.

## Out of scope

- multiple scenarios;
- teacher authoring tools;
- detailed operation-path analytics;
- SCORM 2004;
- xAPI/LRS tracking.
