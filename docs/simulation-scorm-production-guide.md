# Simulation and SCORM Production Guide

Use this guide before building a new SimLab simulation. It records the practical
SCORM/Moodle behaviors that are easy to miss.

## Before coding

- Write a simulation plan in `plans/` before implementation.
- Give the work a specific slug, not a generic topic name. Example:
  `plane-mirror-pencil-ray-diagram`, not `optics`.
- Define the learner task, required interactions, scoring rubric, tolerance
  choices, feedback, and SCORM behavior before drawing the UI.
- Keep the first version to one clear scenario unless variation is part of the
  learning objective.
- Start with static HTML, CSS, and JavaScript. Add libraries only when they
  remove real complexity.

## Interaction design

- Design phone-first, then expand to tablet and desktop.
- Make the first screen the actual task, not a landing page.
- Use touch-friendly controls and Pointer Events for dragging.
- Avoid snap behavior unless it directly helps the task. A grid can be visual
  only; it must not stop learners from drawing physically correct directions.
- When a touch drag target can be hidden by the learner's finger, prefer a
  temporary local preview or magnifier over moving the actual object away from
  the finger. Keep the object on the normal relative-drag path so fine adjustment
  still works.
- Keep touch previews visually stable. Prefer fixing the preview to the diagram
  corner farthest from the current finger position instead of making it track the
  finger continuously.
- For close draggable objects, highlight the selected object during drag and
  make the preview show which object is currently being adjusted.
- When a learner reaches a state where the next action is in the controls panel,
  a subtle in-diagram hint can help. Use layout-neutral wording such as
  "go to the operation panel"; do not assume the button is below, above, left, or
  right of the diagram.
- Hide in-diagram continuation hints as soon as the learner opens the relevant
  control, answers, or moves to the next task state.
- Do not place answers in the default state. Defaults may show available objects,
  but learners must still make the meaningful choices.
- Keep object labels off the diagram unless the label teaches something.
- Make physical scenery distinguishable from other physics objects. For example,
  draw a ground or support surface with thickness or hatch marks instead of only
  a single line when future tasks may also contain ropes, strings, rays, or
  vectors.
- Use compact, readable diagram labels. For duplicate symbols, render numeric
  subscripts, not underscores. In HTML, use `N<sub>2</sub>`; in SVG, use a
  smaller `<tspan>` with `baseline-shift="sub"`.
- For repeated selectable items such as multiple forces of the same type, avoid
  adding more and more duplicate buttons. Use one row per item type with a clear
  count and add/remove buttons, and state the maximum count in the plan.
- In those rows, align the learner-facing name and physics symbol separately,
  such as `支持力` in one column and `N` in another. Do not rely on mixed Chinese
  and Latin text widths lining up naturally.

## Scoring and feedback

- Score the submitted final state unless the plan explicitly requires process
  scoring.
- Keep score within `0..100`; never let penalties make it negative.
- Do not hide scoring choices inside code. Before implementation, explain the
  exact scoring model to the user in plain language.
- Do not hard-code a generic "correct" tolerance in the guide. Choose tolerance
  values per simulation, state the unit, and explain what learner behavior that
  tolerance accepts or rejects.
- Make every score component explicit:
  - what earns points;
  - how many points it earns;
  - what loses points;
  - whether duplicate or extra objects can cancel points already earned;
  - the passing threshold;
  - the minimum and maximum possible score.
- Make every tolerance explicit:
  - the measured quantity, such as angle, position, length, time, or numeric
    value;
  - the accepted error range and unit, such as degrees, pixels, percent, or SI
    units;
  - whether the range is symmetric, one-sided, relative, or absolute;
  - examples of answers just inside and just outside the tolerance.
- If a learner can gain points by selecting every possible option, the rubric is
  wrong. Extra objects, duplicate objects, or irrelevant actions must either
  earn no credit or deduct enough credit to remove the advantage.
- Feedback should tell the learner what is right, missing, extra, or wrong in
  terms of the physics, not just show a number.

Use this compact format in each simulation plan:

```text
Scoring:
- Total: 100
- Passing threshold: ...
- Components: ...
- Penalties: ...
- Lowest score: 0

Tolerance:
- Quantity checked: ...
- Accepted range: ...
- Borderline examples: ...
- Easy-to-change constants: ...
```

## SCORM runtime rules

- Use SCORM 1.2 for Moodle unless there is a confirmed reason to use something
  else.
- Keep SCORM as a thin reporting layer. The simulation owns scoring and feedback.
- On submit, set at least:
  - `cmi.core.score.min`
  - `cmi.core.score.max`
  - `cmi.core.score.raw`
  - `cmi.core.lesson_status`
  - `cmi.core.exit`
- For a final submission, set `cmi.core.exit` to `logout`, not `suspend`.
- Call `LMSCommit` and `LMSFinish` immediately after a final submission. Do not
  wait for the learner to leave the page.
- After submission, lock the current attempt inside the simulation. The learner
  may review the submitted state, but must not be able to drag objects or submit
  again in the same attempt.
- Store the submitted review state in `cmi.suspend_data` when useful. Keep it
  small: score, pass/fail, feedback text, and the minimum geometry needed to
  redraw the submitted answer.
- Treat `cmi.suspend_data` as a small review snapshot, not a history database.
  SCORM 1.2 storage is limited, so do not store screenshots, long logs, or all
  attempts there.
- On loading an already finished attempt, read Moodle state and show the saved
  review state instead of reopening the task for editing.
- Keep a local fallback for Live Server. Without Moodle, log SCORM values so the
  same submission path can still be checked.

## Moodle attempt expectations

For formal graded simulations, use these Moodle activity settings as the default:

- Attempts allowed: the teacher's intended limit, for example `3`.
- Attempts grading: `Highest grade` for practice-with-improvement tasks.
- Force new attempt: when the previous attempt is completed, passed, or failed.
- Lock after final attempt: `No` if students should still enter for review.
- Disable preview mode: `Yes` for formal assessment.
- Student skip content structure page: `Never`, so students can see attempt
  status before starting.
- Display attempt status: entry page and dashboard.

Important Moodle behavior:

- Preview mode can let students inspect the task without consuming an attempt.
  Disable it for formal assessment.
- If learners can re-enter a completed attempt, Moodle may resume that same
  attempt unless they start a new one. The simulation must therefore lock a
  submitted attempt itself.
- Moodle's SCORM entry page can show previous attempt scores, but a SCORM 1.2
  package normally only receives the current attempt's runtime data. Do not plan
  a learner-facing "review all previous attempts" screen unless the simulation
  stores its own history outside normal Moodle SCORM attempts.
- Do not rely on the package automatically jumping back to the Moodle entry page
  after submission. Show the submitted/review state in place.

## SCORM package rules

- Package the contents of `sim/`, not the `sim/` folder itself.
- The ZIP root must contain `imsmanifest.xml`.
- Keep only runtime files in the ZIP. Do not include tests, temporary scripts, or
  generated screenshots.
- Include vendored library files inside the ZIP when Moodle delivery needs them.
  Do not rely on CDN access for learners.
- After changing source files, rebuild the ZIP before uploading to Moodle.

Expected ZIP shape:

```text
imsmanifest.xml
config.js
shared/
  scorm.js
  styles.css
simulation-slug/
  index.html
  main.js
  scoring.js
  styles.css
```

## Minimum checks

Before calling a simulation ready:

- Run JavaScript syntax checks for changed files.
- Run the scoring self-check or test file.
- Open with Live Server or a local static server.
- Submit once outside Moodle and confirm local SCORM logging still works.
- Inspect the built ZIP before upload: `imsmanifest.xml` must be at the root,
  and tests or temporary files must not be included.
- Upload the ZIP to Moodle as a SCORM 1.2 activity.
- Test with a student account, not only a teacher account.
- Check: preview is hidden, attempt status is visible, submit records score,
  re-entering the same submitted attempt is review-only, and a new attempt is
  required to change the score.
