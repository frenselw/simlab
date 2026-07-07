# SimLab Plane Mirror Pencil Ray Diagram MVP Plan

## Purpose

Build the first SimLab optics simulation: `plane-mirror-pencil-ray-diagram`.

Students construct a ray diagram for a vertical pencil placed in front of a
vertical plane mirror. The mirror cross-section is shown as a vertical line with
the reflecting side randomly set to the left or right. A vertical pencil of
random length is placed on that reflecting side.

The learning goal is to connect these ideas:

- light from the top and bottom of an object can reach the mirror along many
  incident paths;
- each reflected ray obeys the law of reflection;
- backward extensions of reflected rays meet behind the mirror;
- a plane mirror forms an upright virtual image at the same perpendicular
  distance behind the mirror and with the same size as the object.

## Shared files to use

Use these project files as the base:

- `sim/shared/scorm.js`: SCORM 1.2 initialization, score submit, local fallback,
  `suspend_data` review state, and final attempt finish.
- `sim/shared/styles.css`: responsive shell, panel styles, buttons, readout
  blocks, score panel, and shared design tokens.
- `docs/simulation-scorm-production-guide.md`: SCORM and Moodle production rules.
- `plans/00-shared-platform-and-style.md`: shared visual and interaction baseline.

Do not reuse unrelated diagram-specific `main.js` or `scoring.js`; the ray
geometry and rubric are different enough that a small optics-specific
implementation is cleaner.

## Student task

One randomized scenario is enough for the MVP:

- mirror is vertical near the center of the diagram;
- reflecting side is randomly `left` or `right`;
- pencil is vertical on the reflecting side;
- pencil length is random within a classroom-friendly range;
- the pencil top and bottom are visually marked as ray source points.

The student completes four ray bundles:

- two bundles start from the pencil top;
- two bundles start from the pencil bottom;
- each bundle contains one incident ray, one reflected ray, and one backward
  extension line.

After all four ray bundles are complete, the simulation shows two image-type
choices:

- `實像`
- `虛像`

The student must choose `虛像`, then drag and resize a vertical image pencil to
the correct position behind the mirror.

## Interaction

Use direct manipulation on an SVG diagram.

Use the same add/remove count-control pattern for rays:

- one row for `入射光線`, with `- / count / +`;
- one row for `反射光線`, with `- / count / +`;
- one row for `延長線`, with `- / count / +`;
- counts show how many of that segment type currently exist;
- add buttons create the next drawable segment and select it immediately;
- remove buttons remove the most recent segment of that type;
- maximum count is four per segment type, controlled by constants such as
  `MAX_INCIDENT_RAYS`, `MAX_REFLECTED_RAYS`, and `MAX_EXTENSION_LINES`;
- removing an incident ray also removes its dependent reflected ray and
  extension line;
- removing a reflected ray also removes its dependent extension line.

The required incident-ray source order should be simple and visible:

- first two incident rays start from the pencil top;
- next two incident rays start from the pencil bottom;
- each newly added ray is labelled, for example `入射 1`, `入射 2`, `反射 1`,
  and `延長 1`.

Disable unavailable add buttons instead of showing an error:

- `反射光線 +` is enabled only when at least one incident ray has no reflected
  ray;
- `延長線 +` is enabled only when at least one reflected ray has no extension
  line;
- after four complete bundles exist, the ray add buttons are disabled and the
  image-type choice appears.

Recommended mode flow:

1. Draw incident rays
   - The learner taps `入射光線 +`.
   - The new ray starts from the next required pencil endpoint.
   - The learner drags the ray end to a point on the reflecting surface.
   - The incident ray is valid only if it starts from the correct object point
     and reaches the mirror from the reflecting side.

2. Draw reflected rays
   - The learner taps `反射光線 +`.
   - The new reflected ray attaches to the selected incident ray, or otherwise
     to the oldest incident ray that does not yet have one.
   - The learner drags out the reflected ray from the same mirror point.
   - Correct target direction follows the law of reflection.
   - Snap should not change the physics target. Interpret the requested
     `1/6 * theta` as the snap capture zone: when the learner drags within
     `theta / 6` of the correct reflected angle, snap to the exact reflected
     angle. Use a small minimum snap zone so near-normal rays are still usable.

3. Draw backward extensions
   - The learner taps `延長線 +`.
   - The new extension attaches to the selected reflected ray, or otherwise to
     the oldest reflected ray that does not yet have one.
   - The learner drags a dashed extension line behind the mirror.
   - The extension line should be collinear with the reflected ray, but drawn
     backward into the non-reflecting side.
   - The same snap idea applies: capture near the correct backward extension
     direction and draw the exact line.

4. Place the image
   - Show image-type choices only after all four ray bundles exist.
   - After the learner chooses an image type, show a draggable vertical image
     pencil.
   - Dragging the body moves the image.
   - Dragging the top or bottom handle changes image height.
   - The correct image is upright, virtual, same height as the pencil, and at
     the mirrored position behind the mirror.

Phone behavior:

- diagram first, controls below;
- large touch targets;
- no keyboard requirement;
- use a local magnifier only if ray handles become hard to drag.

## Physics model

Use a simple 2D coordinate model:

- mirror is a vertical line at `mirrorX`;
- reflecting side is `-1` for left or `+1` for right;
- pencil center is at `objectX`, `objectY`;
- pencil endpoints are `top = { x: objectX, y: objectY - height / 2 }` and
  `bottom = { x: objectX, y: objectY + height / 2 }`;
- correct image endpoints are reflected across the mirror line:
  `imageX = 2 * mirrorX - objectX`, with the same `y` coordinates.

For a ray from source point `S` to mirror point `M`:

- incident vector points from `S` to `M`;
- the mirror normal is horizontal;
- reflected vector is the incident vector mirrored horizontally;
- virtual extension direction is the opposite of the reflected direction,
  continuing behind the mirror.

Keep all geometry deterministic after random setup so scoring and review state
can be reproduced.

## Scoring

Total: 100.

Passing threshold: 60.

Components:

- Incident rays: 20 points total, 5 per ray bundle.
  - starts from the assigned pencil endpoint;
  - reaches the reflecting side of the mirror;
  - uses a clear non-zero length.

- Reflected rays: 24 points total, 6 per ray bundle.
  - starts from the same mirror point as its incident ray;
  - goes away from the mirror on the reflecting side;
  - matches the law of reflection within tolerance.

- Backward extension lines: 16 points total, 4 per ray bundle.
  - starts from the same mirror point;
  - is dashed or visually marked as an extension;
  - extends behind the mirror;
  - is collinear with the reflected ray within tolerance.

- Image type: 10 points.
  - `虛像` earns full credit;
  - `實像` earns zero for this component.

- Image placement and size: 20 points.
  - 10 for horizontal position at the mirror-symmetric distance;
  - 4 for top endpoint y-position;
  - 4 for bottom endpoint y-position;
  - 2 for keeping the image vertical and upright.

- Clean completion: 10 points.
  - all four ray bundles are complete;
  - no extra ray bundles are submitted;
  - submitted answer can be locked and reviewed.

Penalties:

- clamp final score to `0..100`;
- extra ray bundles deduct up to 10 points from clean completion;
- very short rays earn no credit for that segment;
- rays drawn on the wrong side of the mirror earn no segment credit even if
  their angle is close.

## Tolerance

Easy-to-change constants in `scoring.js`:

- `ANGLE_TOLERANCE_DEG`
- `MIN_RAY_LENGTH`
- `MIRROR_HIT_TOLERANCE_PX`
- `SOURCE_TOLERANCE_PX`
- `IMAGE_X_TOLERANCE_PX`
- `IMAGE_Y_TOLERANCE_PX`
- `IMAGE_HEIGHT_TOLERANCE_RATIO`
- `PASSING_SCORE`
- snap minimum and maximum capture angles

Suggested starting values:

- scored reflected-ray angle tolerance: `5deg`;
- scored extension-line collinearity tolerance: `5deg`;
- source point tolerance: `12px`;
- mirror hit tolerance: `10px`;
- minimum ray length: `35px`;
- image horizontal position tolerance: `14px`;
- image endpoint y-position tolerance: `14px`;
- image height tolerance: `8%`;
- snap capture zone: `max(4deg, min(12deg, theta / 6))`.

Borderline examples:

- a reflected ray 4 degrees from the correct angle is accepted;
- a reflected ray 7 degrees from the correct angle loses reflected-ray angle
  credit;
- an image with height error 6% is accepted;
- an image with height error 12% loses size credit;
- an extension line behind the mirror but not collinear loses extension credit.

## Files

Planned runtime files:

```text
sim/plane-mirror-pencil-ray-diagram/
  index.html
  styles.css
  main.js
  scoring.js
  scoring.test.js
sim/config.js
sim/imsmanifest.xml
```

Shared files already present:

```text
sim/shared/
  styles.css
  scorm.js
```

## SCORM behavior

When the student submits:

- calculate final score;
- show detailed feedback in the page;
- save compact review data:
  - random scenario values;
  - four ray bundles;
  - selected image type;
  - placed image geometry;
  - score and feedback;
- send score to SCORM if available;
- mark `passed` when score is at least 60, otherwise `failed`;
- finish the SCORM attempt;
- lock the submitted attempt so re-entering it is review-only.

When running without Moodle, use the existing local SCORM fallback and log values
to the browser console.

## Acceptance checks

- Opens directly in Live Server.
- Randomly supports mirror reflecting side on the left or right.
- Random pencil length is visible and leaves enough room to draw rays.
- Student can complete the task without keyboard input.
- All four ray bundles can be drawn on phone-width viewport.
- Snap helps but does not force an already-wrong line to score as correct unless
  it lands within the defined snap zone.
- Submit produces a score from 0 to 100.
- Scoring self-check covers perfect answer, wrong image type, wrong mirror side,
  wrong reflected angle, missing extension, and wrong image size.
- Local fallback works without Moodle.
- SCORM package contains `imsmanifest.xml` at the ZIP root.
- Re-entering a submitted attempt shows the submitted state and feedback, but
  does not allow editing or resubmission.

## Out of scope

- lenses;
- curved mirrors;
- multiple objects;
- real-image cases;
- angle measurement input;
- teacher authoring tools;
- process analytics beyond final submitted state;
- SCORM 2004 or xAPI.
