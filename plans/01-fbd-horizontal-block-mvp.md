# Horizontal Block FBD MVP Plan

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

On phones, prioritize the diagram first and place controls below it.
On wider screens, controls may sit beside the diagram.

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
