# Inertial Reference Frame Road Observer Plan

## Purpose

Build a SCORM 1.2 activity named
`inertial-reference-frame-road-observer`.

The activity teaches qualitative motion descriptions in inertial reference
frames. Treat the roadside frame as approximately inertial for this school-level
context. A vehicle frame that translates at constant velocity in a straight line
without rotating relative to that roadside frame is also treated as inertial.
Learners determine which reference object produces a required set of observed
motions.

The first version does not teach or display relative-velocity calculations. It
also does not introduce accelerating or non-inertial frames.

Visible learner-facing text should use Traditional Chinese.

## Learning objectives

After completing the activity, the learner should be able to:

- recognise that motion or rest must be described relative to a chosen
  reference object;
- identify the roadside observer and the constant-velocity, straight-line
  vehicle observers in this activity as valid inertial reference frames;
- recognise that the selected reference object is stationary in its own
  reference frame;
- recognise that two vehicles moving with the same constant velocity are
  stationary relative to each other;
- recognise that a vehicle moving along the road can move in the opposite screen
  direction in another constant-velocity vehicle frame;
- select a suitable inertial reference frame from qualitative observations,
  without calculating a relative velocity.

## Scope boundaries and terminology

In scope:

- a straight, level road shown diagonally from the lower-left region toward the
  upper-right region;
- roadside scenery fixed to the road;
- three vehicles moving in the same road direction at constant velocities;
- the roadside frame treated as approximately inertial, and each non-rotating
  vehicle frame in constant straight-line translation relative to it treated as
  inertial;
- qualitative states only: stationary, moving toward `↗`, or moving toward
  `↙`.

Out of the teaching scope:

- acceleration, braking, turning, or circular motion;
- non-inertial reference frames and fictitious forces;
- relative-speed or relative-velocity formulas;
- numerical speed values, vector subtraction, or graph interpretation;
- oncoming traffic or vehicles changing lanes.

Use `參考物體` when the learner is selecting an object and `參考系` when
describing the resulting view. Represent the road frame as `路旁觀察者`, so the
learner has a concrete observation point rather than an abstract button labelled
only `道路`.

Do not imply that observing one object moving uniformly is, by itself, a proof
that its frame is inertial. The inertial status of the vehicle frames is a stated
model assumption relative to the approximately inertial roadside frame.

## Simulation metadata

- Title: `慣性參考系：公路觀察任務`
- Folder slug: `inertial-reference-frame-road-observer`
- Categories: `["Mechanics"]`
- Hub description: `在斜角公路場景中轉換觀察位置，根據物體的相對運動找出合適的慣性參考系。`
- Tags: `["physics", "mechanics", "reference-frame", "inertial-frame", "motion", "scorm"]`
- Runtime files planned for the implementation phase:

```text
sim/inertial-reference-frame-road-observer/
  index.html
  styles.css
  main.js
  scoring.js
  scoring.test.js
sim/config.js
sim/manifests/inertial-reference-frame-road-observer.xml
```

Reuse:

```text
sim/shared/styles.css
sim/shared/scorm.js
```

Use the native Canvas API for the animated scene. No third-party library,
MathJax, build system, or network resource is required.

## Core learner task

The main assessed task is the reverse-inference challenge:

> 根據指定現象，找出一個合適的參考物體。

Each attempt contains five rounds drawn from five validated blueprint groups.
One blueprint is sampled from each group, the five rounds are shuffled, and
each round receives its own vehicle-role permutation. A core reverse-inference
round presents two or three qualitative observations whose
intersection is needed to identify the reference frame, for example:

```text
請選擇一個參考物體，使：
- 車 C（黃色小巴）在該參考系中向右上方（↗）移動；
- 車 A（紅色小型車）在該參考系中向左下方（↙）移動。
```

The learner may test candidate reference objects by running the same short
observation repeatedly. Testing is an intended experiment and does not reduce
the score. The learner then records one final reference-object choice for that
round.

The activity does not use the simpler `given a reference frame, choose the
observed motion` format as a scored question type. The selected frame and the
resulting animation are evidence used to solve the reverse-inference task.

## Attempt and round flow

The first viewport opens directly into the activity, not a landing page. Before
the five scored rounds, include one short unscored guided observation in the same
stage and controls. It asks the learner to select one named vehicle, run the
observation, and notice that the selected vehicle stays anchored while roadside
scenery changes position. This teaches the control meaning without turning the
simple `given frame -> observe motion` task into a scored question. The guide
should take about 30 seconds and remain available through a help control.

Show one activity-wide instruction before the scored rounds:

```text
每題可能有一個或多個合適答案。請選擇任何一個同時符合全部條件的參考物體。
```

For each round:

1. Show the target observations and the available reference-object buttons.
2. Start with no reference object selected and no animation playing.
3. Let the learner select `路旁觀察者`, `車 A`, `車 B`, or `車 C`.
4. On `開始觀察`, reset the scene to the same round-specific initial state.
5. Briefly fade the stage and show `正以車 A 作為參考系觀察` or equivalent.
6. Anchor the selected reference object and play exactly 3.5 seconds of simulated
   time.
7. Pause automatically at the end. Do not draw a path, trail, ghost image, or
   displacement line.
8. Allow `重播`, `慢動作`, or selection of a different reference object.
9. Enable `記錄為本題答案` only after the currently selected candidate has
   completed the full observation at least once in that round.
10. Let the learner choose `記錄為本題答案` when satisfied.
11. Store the choice without revealing correctness and move to the next round.

After round 5:

- show a compact review list with all five selected answers;
- allow the learner to revisit any round and change the recorded answer;
- keep all choices editable until `提交全部答案`;
- require explicit confirmation before the final SCORM submission.

This makes the submitted final state, rather than the number or order of tests,
the assessed work.

### Round state model

Use these explicit states:

| State | Available actions | Required transition |
|---|---|---|
| `unselected` | select a candidate | selection -> `selected-unobserved` |
| `selected-unobserved` | start, choose another candidate | start -> `playing` |
| `playing` | pause only | pause -> `paused`; natural end -> `observed` |
| `paused` | resume, replay, choose another candidate | resume -> `playing`; new candidate -> `selected-unobserved` |
| `observed` | replay, choose another candidate, record | record -> `recorded` |
| `recorded` | continue; on revisit select/replay another candidate | continue -> next round; revisited selection -> `observed` if already tested, otherwise `selected-unobserved` |
| `final-review` | revisit any round, submit when complete | submit -> `submitted-locked` |
| `submitted-locked` | review only | no editable transition |

Disable candidate switching while an observation is playing. A new candidate
selection resets the visible trial to time zero. Track which candidates have
completed a full observation in the current round; a previously observed
candidate returns directly to `observed` and may be recorded again without a
redundant replay, while a never-observed candidate enters `selected-unobserved`.
Reopening a recorded
round shows the recorded answer, while selecting and observing another candidate
allows replacement. After replacement, return to the five-round review.

The `慢動作` mode may be selected in `selected-unobserved`, `paused`, or before
`重播`. Lock the playback-mode control while playing; never change the time scale
mid-observation.

Normal playback takes 3.5 seconds of wall time. Slow motion plays the same 3.5
seconds of simulated time over 7 seconds of wall time, so both modes end at the
same object positions.

## Scene composition and art direction

Use a restrained 2.5D miniature-city style. The scene should feel playful and
polished while remaining a clear physics observation tool.

Road geometry:

- visual road axis runs from approximately `190deg` at the lower-left to
  approximately `10deg` at the upper-right;
- because Canvas screen `y` increases downward, define the positive road-axis
  screen vector explicitly as `(cos(10deg), -sin(10deg))`; the reverse vector is
  its negative;
- the positive road direction is always `↗`, and the reverse direction is
  always `↙`;
- use a mild oblique top-down projection, with the near end slightly wider than
  the far end;
- place the implied vanishing point beyond the upper-right edge;
- keep perspective convergence subtle so the road reads as a level road viewed
  diagonally, not as a physical uphill slope;
- use three same-direction lanes so the three labelled vehicles can remain
  visually separate;
- draw the road base as a fixed band extending beyond both stage edges; moving
  road texture and landmarks must not expose an empty background or make the
  entire road slab slide off screen;
- show a darker near road face, kerb, shoulder, or guard rail plus consistent
  soft shadows to create depth.

Scene layers, drawn back to front:

1. muted ground and distant city blocks;
2. far-side buildings and smaller trees;
3. road base, shoulder, lane surface, and lane markings;
4. roadside landmarks such as trees, lamp posts, a bus-stop sign, and short
   walls;
5. vehicles and their shadows;
6. upright vehicle labels and reference-frame status overlays.

Visual palette:

- retain the shared app, panel, text, accent, and border tokens;
- use a blue-grey road, low-saturation green planting, and warm neutral
  buildings;
- use distinct saturated vehicle colours and silhouettes, for example a red
  hatchback, blue saloon, and yellow minibus;
- never rely on colour alone: every vehicle must also have an upright `車 A`,
  `車 B`, or `車 C` label and a distinguishable silhouette.

Keep these colour, silhouette, and label identities fixed for all five rounds in
one attempt. Question text uses both identity and appearance, for example
`車 B（藍色房車）`, rather than only `藍色車`.

Depth cues:

- vehicle roof and a small visible side face;
- short shadows cast in one consistent direction;
- nearby scenery slightly larger than far scenery;
- conservative occlusion and environmental parallax;
- no decorative camera shake, depth-of-field blur, or dramatic zoom.

Keep all three vehicles inside a middle-depth placement band at observation
time zero. Prompt-involved vehicles may not be hidden by scenery or another
vehicle. Vehicle labels use a fixed minimum CSS font size, remain upright, and
apply simple collision avoidance. Set a minimum perspective scale so far labels
and vehicles remain legible at a 320 CSS-pixel viewport and at 200% browser
zoom.

Do not visibly rotate vehicle wheels. Wheel rotation could imply motion even
when a vehicle is stationary relative to the selected frame. Judge motion by
change of relative position in the scene.

## Reference-frame presentation

When a reference object is selected:

- keep it at a stable anchor point around the central safe area of the stage;
- add a blue focus ring or soft base glow;
- show an upright `👁 參考系` badge next to its label;
- keep road orientation, camera rotation, and camera zoom unchanged;
- translate the world along the road axis according to the selected frame;
- lock only the selected object's longitudinal road coordinate; selecting a
  vehicle in a different lane must not move the camera sideways;
- keep any object with the same constant velocity at an unchanged relative
  position and unchanged rendered scale;
- do not show numerical velocities or the calculation used by the simulation.

For `路旁觀察者`, use a small roadside observer or camera icon fixed beside the
road. The observer icon is the anchored reference object while the road and
roadside scenery remain stationary.

Changing reference objects must reset and replay the same interval rather than
continuing from the previous trial time. Use a short fade/reset transition, not
a visible high-speed camera flight between objects.

## Motion visibility without trails

No path line, motion trail, afterimage, or ghost position is allowed.

Keep motion observable through:

- a fixed, replayable interval of 3.5 seconds of simulated time;
- road markings and sparse landmarks moving continuously through the view;
- a `慢動作` playback option that slows every animated element by the same
  factor, takes 7 seconds of wall time, and reaches the same final positions;
- consistent object labels that remain readable during motion;
- one automatic stage scale selected per round and reused for every candidate
  reference frame.

For every supported viewport of at least 320 CSS pixels wide, choose initial
positions and one visual scale that satisfy all of these invariants across every
candidate frame:

- every non-zero class difference produces at least 36 CSS pixels of projected
  displacement over the full observation;
- every main vehicle remains inside the labelled safe area for the entire
  interval;
- the largest projected displacement stays below 55% of the usable road-axis
  span;
- prompt-involved vehicles and their labels remain fully visible;
- the same scale and simulated interval are used for normal and slow playback.

Use only velocity classes `0..3`, curated initial-position bands, and validated
blueprints so the minimum-visibility and maximum-displacement constraints can be
met together. If a layout cannot meet them after a viewport resize, recompute
the projection scale and label layout at the same simulation time; do not shorten
the observation, regenerate the round, or change its physics.

Main vehicles must never leave the stage or wrap from one edge to the opposite
edge in the supported viewport range. Repeating lane-mark textures and sparse
roadside scenery may recycle outside the visible stage because they represent
new scenery along an extended road. Vary recycled landmarks and keep the repeat
distance long enough that the same building does not visibly teleport.

## Physics model

Use one internal one-dimensional world coordinate along the road axis. Canvas
projection converts that coordinate to the 2.5D diagonal scene.

World motion rules:

- road and roadside scenery have constant world velocity class `0`;
- each vehicle has one constant positive world velocity class for the entire
  round;
- all vehicles move in the `↗` road direction in the road frame;
- no object accelerates, brakes, turns, or changes lane;
- vehicle positions are deterministic functions of the instantiated round
  definition and observation time.

For rendering only, the simulation derives whether each object is stationary,
moves `↗`, or moves `↙` in the selected frame. The learner sees only those
qualitative phenomena through animation. Do not expose the internal velocity
classes, subtraction, symbols, or formula.

Apply reference-frame translation before the visual projection. This invariant
is important: two objects with the same world velocity must stay in a fixed
relative visual arrangement even with the 2.5D projection.

For every frame:

1. subtract the selected reference object's longitudinal coordinate from every
   object's longitudinal coordinate;
2. apply the same fixed lateral lane offsets;
3. project all resulting relative coordinates through the same 2.5D transform;
4. add screen-space upright labels after projection.

Moving road markings, roadside objects, vehicles, and the roadside-observer icon
all use this relative longitudinal coordinate. The road base remains an
extended, fixed visual band so the stage never reveals an empty gap.

## Round generation and answer validity

Use a local seeded PRNG to instantiate an attempt, but do not freely generate
physics statements or depend on preserving that temporary seed. Create each
attempt by sampling one blueprint from each of the following five groups, then
shuffle the sampled rounds and save the concrete round definitions at final
submission. Here `R` means
`路旁觀察者`, scenery has velocity class `0`, and sets list the candidates that
satisfy each condition independently.

| Group | Blueprint | Internal classes `(A,B,C)` | Validated conditions | Accepted intersection | Points |
|---|---|---:|---|---|---:|
| roadside foundation | `foundation-road` | `(1,2,3)` | scenery stationary `{R}`; C `↗` `{R,A,B}` | `{R}` | 10 |
| roadside foundation | `foundation-two-forward` | `(1,2,3)` | A `↗` `{R}`; B `↗` `{R,A}` | `{R}` | 10 |
| equal motion | `equal-motion` | `(2,2,3)` | A stationary `{A,B}`; B stationary `{A,B}` | `{A,B}` | 15 |
| equal motion | `equal-motion-road` | `(1,1,3)` | A stationary `{A,B}`; C `↗` `{R,A,B}`; scenery `↙` `{A,B,C}` | `{A,B}` | 15 |
| lower moving frame | `core-lower-middle` | `(1,2,3)` | B `↗` `{R,A}`; scenery `↙` `{A,B,C}` | `{A}` | 25 |
| lower moving frame | `core-lower-both-forward` | `(1,2,3)` | B `↗` `{R,A}`; C `↗` `{R,A,B}`; scenery `↙` `{A,B,C}` | `{A}` | 25 |
| middle moving frame | `core-upper-middle` | `(1,2,3)` | C `↗` `{R,A,B}`; A `↙` `{B,C}` | `{B}` | 25 |
| middle moving frame | `core-middle-three-signs` | `(1,2,3)` | scenery `↙` `{A,B,C}`; A `↙` `{B,C}`; C `↗` `{R,A,B}` | `{B}` | 25 |
| transferred roles | `core-transfer` | `(3,1,2)` | A `↗` `{R,B,C}`; B `↙` `{A,C}` | `{C}` | 25 |
| transferred roles | `core-transfer-road` | `(3,1,2)` | A `↗` `{R,B,C}`; B `↙` `{A,C}`; scenery `↙` `{A,B,C}` | `{C}` | 25 |

Every attempt preserves the weights `10`, `15`, `25`, `25`, and `25` and
therefore covers one foundation-road task, one equal-motion task, and three core
reverse-inference tasks even after shuffling. Equal-motion variants accept two
physically equivalent frames. Every other sampled blueprint has one accepted
frame derived from the intersection of its validated predicates.

At attempt start, independently apply a seeded permutation of template roles
`A/B/C` to each sampled round. Do not reuse one identity mapping across all five
prompts. The independent mappings, group-level sampling, shuffled round order,
and finite layout variants are saved in the final snapshot so locked review can
reconstruct the exact submitted attempt.

Keep the four answer buttons in a fixed order throughout the attempt. Randomize
the prompt roles rather than the answer-button positions so the interface stays
predictable while memorized vehicle-letter answers do not transfer.

Keep vehicle A/B/C colour and silhouette fixed throughout the attempt. Vary the
sampled blueprint, per-round identity-role permutation, round order, and
validated initial-position variant. The displayed question number does not
indicate difficulty after shuffling.

Allowed prompt predicates are:

- `[object] 相對所選參考物體靜止`;
- `[object] 在該參考系中向右上方（↗）移動`;
- `[object] 在該參考系中向左下方（↙）移動`.

Never use unrestricted random sentence assembly. Validate each instantiated
blueprint by deriving the complete qualitative motion table and checking every
condition's candidate set and their intersection. Never mark one of two
physically equivalent frames wrong merely to force a unique answer.

## Interaction and layout

Use the shared responsive split-pane shell.

Desktop and wider tablets:

- left scrollable operation panel around `20rem` to `24rem`;
- right stage fills the remaining space;
- target observations remain visible while trials run;
- keep the stage visually dominant.

Phone portrait:

- stage stays anchored at the top in a bounded app viewport;
- controls form the independently scrollable lower region;
- local layout styles use `100dvh` with a `100vh` fallback and set grid/flex
  children to `min-height: 0` so the lower panel can scroll correctly;
- maintain a stage aspect ratio close to `4:3` where possible;
- preserve the lower-left to upper-right road path and a central safe area for
  all key vehicle labels;
- do not make the whole page scroll in a way that moves the observation stage
  out of view while the learner operates controls.

Scroll topology and gesture ownership:

- the activity document and Moodle host page are not normal control-scroll
  owners; `.reference-panel` is the sole vertical owner while it has range;
- the Canvas stage and control panel are sibling grid tracks, so native panning
  from the stage cannot reach the panel. The stable `.reference-stage` surface
  therefore uses explicit stage-to-panel forwarding;
- the surface has `touch-action: pan-x pinch-zoom` before `pointerdown`.
  Forwarding begins only after an 8 CSS-pixel intent threshold and only when the
  vertical displacement exceeds the horizontal displacement. Horizontal and
  multi-touch gestures remain browser-owned. A non-primary touch that first
  enters the stage after the primary touch began on the panel or elsewhere is
  never eligible for forwarding;
- a claimed one-finger vertical gesture changes `reference-panel.scrollTop`
  using signed finger movement, clamps at both boundaries, and keeps the
  activity document, visual viewport, iframe, Moodle host page, and stage
  position unchanged;
- there are no draggable stage targets in this activity. Candidate selection
  remains in the native control panel.

| Touch starts on | Owner | Required result |
|---|---|---|
| Non-interactive road stage | Explicit stage-to-panel forwarding after vertical intent | Non-zero panel delta when range exists; zero activity-page, viewport, iframe/host, and stage-position delta; trusted `pointermove` and `pointerup`, no unexpected `pointercancel` |
| Operation-panel control or panel background | Native operation panel | The panel scrolls normally and can reach its true top and bottom without moving the Moodle page |
| Horizontal or multi-touch gesture on stage | Browser | No panel forwarding and no simulation-state change |

Canvas sizing:

- keep Canvas CSS size separate from its backing-store size;
- scale the backing store using `devicePixelRatio` for crisp vehicles and labels;
- use `ResizeObserver` to recompute projection and label layout;
- resizing must preserve the current blueprint, answers, selected frame,
  simulation time, and play/pause state;
- resizing must not regenerate a round or restart the observation;
- explicitly test phone portrait, phone landscape, short-height viewports,
  browser toolbar changes, and high-DPR displays.

Controls:

- four minimum-44-pixel reference-object choices with icon, name, selected,
  focus, and disabled states;
- `開始觀察`;
- `暫停` while playing;
- `繼續` after pausing;
- `重播` after a completed or paused observation;
- `慢動作` as an explicit playback aid, not a physics speed control;
- `記錄為本題答案`;
- round navigation and final `提交全部答案`.

Selecting a reference object does not automatically record it as the answer.
The learner must deliberately test and then record the choice. No candidate is
preselected. For version 1, reference objects are selected only through the
operation-panel buttons; Canvas vehicle hit-testing and direct tapping are out of
scope.

## Accessibility and motion comfort

- Keep labels upright and high-contrast against the animated scene.
- Use shape, label, and colour together to identify vehicles.
- Give every control a visible keyboard focus state and accessible name.
- Provide text equivalents for `↗` and `↙` in prompts and controls.
- Do not autoplay an observation; movement begins only after learner action.
- `暫停`, `重播`, and `慢動作` must work with touch and keyboard.
- Respect reduced-motion preferences by removing decorative fades and easing,
  while retaining user-started essential physics motion.
- Do not use sound as required information. The first version needs no audio.
- At observation start, pause, and completion, update one polite screen-reader
  status region with a complete qualitative snapshot, for example:
  `目前以車 B 作參考系。車 A 向左下方移動；車 B 靜止；車 C 向右上方移動；路旁景物向左下方移動。`
- Do not update this status every animation frame. The summary is the non-visual
  equivalent of the Canvas observation, not an extra correctness message.

## Answer collection and feedback

Before final submission:

- do not reveal whether a recorded frame is correct;
- let the learner reopen any round, rerun trials, and change the answer;
- show unanswered rounds clearly in the final review;
- do not permit final submission while any round is unanswered.

After final submission, show round-by-round feedback. Each feedback item should
state:

- the learner's selected reference object;
- whether that object produces both requested observations;
- which requested observation is satisfied or contradicted;
- one short qualitative explanation based on changing or unchanged relative
  position;
- all accepted reference objects for every round, including single-answer
  rounds.

Example feedback:

```text
以車 B 作為參考系時，車 A 和車 B 之間的位置保持不變，所以車 A 相對車 B 靜止；
車 B 作為參考物體亦相對自己靜止。車 B 符合兩個條件；車 A 亦是本題可接受的參考物體。
```

Do not introduce a relative-velocity formula in feedback.

## Scoring

Scoring:

- Total: `100`.
- Passing threshold: `60`.
- Foundation roadside round: `10` points.
- Equal-motion round: `15` points.
- Three core reverse-inference rounds with two or three conditions: `25` points
  each.
- A round earns its full blueprint weight when the recorded reference-object ID
  belongs to that round's accepted answer set.
- A wrong or missing round answer earns `0` points for that round.
- Testing, replaying, pausing, using slow motion, or changing a pre-submit answer
  has no penalty.
- Equivalent accepted reference objects receive identical full credit.
- There is no partial credit for satisfying only some prompt conditions; the
  learner is selecting one frame that must satisfy the complete
  target phenomenon.
- Clamp the final score to `0..100`.
- Lowest possible score: `0`.
- Highest possible score: `100`.

Scoring is based only on the five recorded answers present at final submission.
Do not score the number of experiments or the learner's process.

The weighting ensures that the two easier foundation rounds total only 25
points. A learner must answer at least two of the three core reverse-inference
rounds correctly to reach the passing threshold, even if both foundation rounds
are correct.

## Tolerance

Tolerance:

- Quantity checked: categorical reference-object identity against a generated
  accepted-answer set.
- Accepted range: exact set membership; there is no pixel, time, speed, angle,
  or numerical tolerance.
- Borderline examples:
  - in a 25-point core round with accepted answers `[車 A]`, selecting `車 A`
    earns 25 and selecting `車 B` earns 0;
  - if physically equivalent accepted answers are `[車 A, 車 B]`, either earns
    the full 15 points assigned to that blueprint;
  - paused animation, viewport size, normal playback, and slow motion never
    change scoring.
- Easy-to-change constants and tables: `ROUND_GROUPS`, `PATTERNS`,
  `PASSING_SCORE`, `SIMULATION_SECONDS`, `SLOW_FACTOR`, and
  `MIN_VISIBLE_DISPLACEMENT`.

## SCORM behavior

Use SCORM 1.2 through `sim/shared/scorm.js`.

Before submission:

- keep the instantiated rounds and learner answers in normal activity state;
- do not report a provisional score for individual trials or rounds.
- version 1 does not persist an unfinished draft to SCORM; reloading or closing
  before final submission deliberately restarts the five unsaved rounds and
  clears unsent answers.

On `提交全部答案`:

- calculate the final `0..100` score;
- mark `passed` at 60 or above, otherwise `failed`;
- set score min, max, raw, lesson status, and exit;
- set final exit to `logout`;
- call commit and finish immediately;
- lock all answers and testing controls in the submitted attempt;
- remain on an in-place review screen rather than assuming Moodle navigation.

Store one versioned compact review snapshot in `cmi.suspend_data`. Use a schema
equivalent to:

```json
{
  "v": 1,
  "locked": 1,
  "rounds": [
    {
      "p": "foundation-road",
      "classes": [1, 2, 3],
      "perm": "ABC",
      "layout": 2
    },
    {
      "p": "equal-motion",
      "classes": [2, 2, 3],
      "perm": "ABC",
      "layout": 1
    },
    {
      "p": "core-lower-middle",
      "classes": [1, 2, 3],
      "perm": "ABC",
      "layout": 3
    },
    {
      "p": "core-upper-middle",
      "classes": [1, 2, 3],
      "perm": "ABC",
      "layout": 2
    },
    {
      "p": "core-transfer",
      "classes": [3, 1, 2],
      "perm": "ABC",
      "layout": 1
    }
  ],
  "answers": ["R", "A", "A", "B", "R"],
  "score": 75,
  "passed": 1
}
```

The actual implementation may use shorter keys, but must preserve the same
semantics: schema version, locked flag, each round's pattern ID, actual velocity
classes, identity permutation, validated layout variant, five answers, score,
and pass/fail. Derive prompts, accepted-answer sets, and feedback from these
saved round definitions; do not duplicate long Chinese strings.

Keep serialized review data below 3000 UTF-8 bytes, leaving margin below common
SCORM 1.2 `suspend_data` limits. Do not store screenshots, animation frames,
repeated trial history, tested-candidate history, or decorative scene data.

On reopening a finished attempt, reconstruct the five scenes and show the locked
review state. A new Moodle attempt is required to change the score.

Review recovery rules:

- if the snapshot is valid and supported, reconstruct all rounds and show full
  locked round-by-round feedback;
- if JSON is corrupt, fields are missing, or `v` is unsupported, keep the
  attempt locked, show the LMS lesson status and raw score with a generic review
  message, and do not reopen editing;
- if a recomputed score differs from the saved or LMS raw score, keep the attempt
  locked, display the LMS raw score as authoritative, suppress untrustworthy
  per-round correctness, and log a diagnostic in the local/developer console;
- review recovery must never resubmit or overwrite a completed Moodle attempt.

Keep the local fallback path so the same final submission can be checked through
Live Server without Moodle.

## Testing plan

`scoring.test.js` should cover:

- all five answers correct;
- all answers wrong;
- mixed correct and wrong answers;
- one missing answer rejected before final submission;
- exact membership in a single-answer set;
- either answer accepted in an equivalent-frame set;
- a non-member rejected from an equivalent-frame set;
- blueprint weights of `10`, `15`, `25`, `25`, and `25`;
- both foundation rounds plus one core round produce 50 and fail;
- both foundation rounds plus two core rounds produce 75 and pass;
- the current exact passing boundary: foundation-road plus two core rounds
  produce 60 and pass;
- score clamped to `0..100`;
- testing and replay metadata ignored by scoring.

Blueprint and seed self-checks should verify:

- all ten blueprint IDs derive exactly their declared accepted sets;
- every attempt contains exactly one sampled blueprint from each of the five
  groups;
- sampled rounds can occur in any order while their weights still total 100;
- each round stores and restores its own valid `A/B/C` permutation;
- equal-motion variants contain the intended equivalent accepted-frame pair;
- each single-answer core blueprint has a one-candidate intersection;
- three-condition prompts render and restore every predicate without truncation;
- prompt predicates match the rendered qualitative motion table;
- fixed vehicle colours and labels remain consistent across all rounds;
- sampled blueprints, permutations, and lane/layout variants remain within their
  validated finite sets.

Physics, state, and rendering tests should cover:

- qualitative motion derivation before projection for every class pair `0..3`;
- equal-class objects retain a fixed relative position at sampled animation
  frames;
- normal and slow playback reach identical simulation time and final positions;
- every non-zero motion reaches at least 36 CSS pixels over the interval at a
  320-pixel-wide viewport;
- every key vehicle stays within the safe area in all blueprints, candidates,
  and validated layout variants;
- pause/resume preserves simulation time;
- candidate switching is disabled during play and resets to time zero otherwise;
- answer recording stays disabled until the current candidate has completed one
  full observation;
- resize preserves round, selected frame, time, answers, and play/pause state;
- road-axis projection uses positive screen vector `(cos 10deg, -sin 10deg)`;
- Canvas backing-store scaling remains crisp at high device pixel ratios;
- screen-reader summaries update at start, pause, and completion, not per frame.

SCORM and recovery tests should cover:

- snapshot serialization stays below 3000 UTF-8 bytes;
- snapshot round trip reconstructs all five rounds and answers;
- a completed snapshot reopens with every editing and testing control locked;
- corrupt JSON, unsupported version, and missing fields use the locked generic
  fallback;
- score mismatch keeps the LMS score authoritative and does not resubmit;
- unsubmitted reload begins a fresh unsaved activity state;
- local fallback logs the same final payload without Moodle.

Visual and interaction checks should include 320-pixel phone portrait, phone
landscape, short-height viewports, 200% browser zoom, high DPR, keyboard-only
operation, reduced-motion preference, long Traditional Chinese labels, label
collision avoidance, and background recycling.

## Acceptance checks

- Opens directly into the first task in Live Server.
- All visible learner text is Traditional Chinese.
- The activity states that the roadside frame is approximately inertial and that
  each non-rotating, constant-velocity straight-line vehicle frame is treated as
  inertial relative to it.
- No acceleration, braking, turning, or lane changing is shown.
- No numerical speed or relative-velocity formula is visible.
- Road runs visually from approximately lower-left `190deg` to upper-right
  `10deg`.
- Road reads as a flat plane viewed obliquely, not an uphill ramp.
- 2.5D depth comes from mild perspective, side faces, size, occlusion, and
  shadows without compromising motion readability.
- Road direction remains fixed as `↗`; reverse remains `↙`.
- Selected reference object remains anchored and clearly marked.
- Objects with the same world velocity stay at fixed relative visual positions.
- No path, trail, afterimage, ghost position, or displacement line is drawn.
- Main vehicles never wrap across opposite stage edges.
- All three main vehicles and prompt labels remain inside the safe area for the
  complete fixed observation on every supported viewport.
- Background recycling does not create obvious teleporting landmarks.
- Changing reference objects replays the same initial state and interval.
- Visual scale remains constant across all trials in one round.
- Normal and slow playback cover the same 3.5 seconds of simulated time and end
  at the same positions.
- Every non-zero motion produces at least 36 CSS pixels of visible displacement
  on a 320 CSS-pixel-wide viewport.
- No reference object is preselected or recorded automatically.
- The selected candidate must complete one full observation before it can be
  recorded.
- Learner can test every candidate without losing points.
- Five final answers can be reviewed and changed before submission.
- Final score is based only on the submitted five-answer state.
- Foundation rounds total 25 points and the three core reverse-inference rounds
  total 75 points.
- Equivalent physically valid reference frames receive equal credit.
- Round feedback identifies which requested observation was satisfied or
  contradicted without using a relative-velocity formula.
- Every round feedback item lists all accepted reference objects.
- A non-visual qualitative summary is available after each observation.
- Phone portrait keeps the stage visible while controls remain usable.
- Touch targets are at least 44 pixels and the full task is keyboard accessible.
- Reduced-motion preference removes decorative motion but preserves
  user-initiated essential observation.
- Local SCORM fallback works without Moodle.
- Final SCORM submission commits, finishes, and locks the attempt.
- Re-entering a submitted attempt is review-only.
- Corrupt or unsupported review data fails safely to a locked generic score view.
- Built package contains `imsmanifest.xml` at the ZIP root and no test or
  temporary files.

## Out of scope

- non-inertial reference frames;
- acceleration, braking, turning, circular motion, or inertial-force examples;
- relative velocity calculations or numerical speed comparison;
- learner-created vehicle motion;
- free camera pan, rotate, or zoom;
- direct selection by tapping vehicles inside the Canvas;
- driving, collision, lane-change, or traffic-rule gameplay;
- audio narration;
- teacher-authored question sets;
- persistence of unfinished answers across page reloads;
- attempt-history analytics beyond the current SCORM attempt;
- SCORM 2004 or xAPI/LRS integration.
