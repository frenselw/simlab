# Linear Motion Velocity Lab Plan

## Purpose

Build a formative SCORM 1.2 activity named `linear-motion-velocity-lab` that
helps learners connect:

- displacement and elapsed time;
- average velocity magnitude in one-dimensional forward motion;
- instantaneous velocity in uniform and non-uniform motion;
- instantaneous velocity as the limiting value approached by average velocity
  over progressively shorter time intervals.

In the first two stages the activity uses a tracked car: the car remains near
the centre of the stage while the road ruler and roadside cues move backwards.
Learners operate a stopwatch, record position readings, and calculate from the
displayed three-significant-figure measurements. The third-stage time magnifier
uses a fixed road and a moving-car target animation to introduce instantaneous
velocity before learners compare progressively shorter graph intervals.

All learner-facing text is Traditional Chinese.

## Scope

- Slug: `linear-motion-velocity-lab`
- Learner-facing title: `直線運動：平均速度與瞬時速度`
- Learning objectives:
  - determine displacement from two position readings;
  - determine elapsed time from stopwatch readings;
  - calculate average velocity magnitude from displacement and elapsed time;
  - distinguish the uniform-motion relationship from the non-uniform case;
  - explain instantaneous velocity using successively shorter intervals;
  - work with measurements and expected results canonicalized to three
    significant figures without requiring padded learner input.
- Learner task:
  - complete one random uniform-motion measurement;
  - complete one random variable-motion measurement containing visibly
    different speeds; the measured interval need not contain a stop;
  - estimate instantaneous velocity at a random valid target instant;
  - answer one independent zero-velocity concept checkpoint about a stopped
    interval in the same motion model;
  - review all answers and submit once.
- Main interactions:
  - start, pause, and resume the car animation;
  - press one stopwatch control to record the start and end of a measurement;
  - enter displacement, elapsed time, and average velocity answers;
  - choose conceptual answers;
  - step through progressively shorter analysis windows;
  - choose the best supported three-significant-figure instantaneous-velocity
    estimate;
  - review and edit answers before final submission.
- Libraries: none; use native HTML, CSS, Canvas, and SVG. Prefer plain Chinese
  quantity names in learner prompts, labels, review, and feedback; use native
  semantic HTML and CSS fractions only where a worked calculation benefits
  from them. Do not load MathJax or expose TeX source to learners or assistive
  technology.
- Assessment risk: `formative`.
- Trusted validation for high risk: not applicable. Browser-side scoring is not
  a trusted boundary and the activity must not contain secrets.
- Expected completion time: about 8 to 12 minutes.

## Catalogue metadata (`sim/config.js`)

```js
{
  title: "直線運動：平均速度與瞬時速度",
  folder: "linear-motion-velocity-lab",
  categories: ["Mechanics"],
  description: "利用移動標尺、計時器和時間放大鏡，量度位移與時間，計算平均速度，並理解瞬時速度。",
  tags: ["physics", "mechanics", "kinematics", "velocity", "instantaneous-velocity", "scorm"],
  status: "active"
}
```

The folder name, manifest identifier, snapshot activity identifier, and config
entry must use the same slug. Do not register the activity as active until it is
package-ready.

## Planned files

```text
plans/10-linear-motion-velocity-lab.md
.github/workflows/quality.yml
package.json
sim/linear-motion-velocity-lab/
  index.html
  styles.css
  main.js
  motion-model.js
  motion-model.test.js
  scene-visuals.js
  scene-visuals.test.js
  scoring.js
  scoring.test.js
  persistence.js
  persistence.test.js
  ui-policy.js
  ui-runtime.test.js
  accessibility.test.js
sim/manifests/linear-motion-velocity-lab.xml
sim/config.js
tools/linear-motion-browser-regression.js
tools/position-time-browser-regression.js  # shared browser harness
tools/position-time-browser-regression.test.js
tools/run-tests.js
```

Reuse:

```text
sim/shared/styles.css
sim/shared/scorm.js
sim/shared/activity-flow.js
```

`motion-model.js` is justified because motion integration, seeded attempt
generation, three-significant-figure canonicalization, and instantaneous-window
calculations must remain pure and Node-testable. `scene-visuals.js` is the
second justified helper: responsive scene geometry, stable world-cell visuals,
wheel rotation, and the stage-three demonstration timeline and geometry must be
pure and independently testable. `accessibility.test.js` protects production
HTML/CSS/runtime wiring and responsive non-overlap and reduced-motion
invariants that are not motion-model or scoring concerns. Do not create another
helper file unless implementation shows a further concrete need.

## Terminology and conceptual boundaries

The car moves only in the positive `x` direction and never reverses. It may
temporarily stop. Therefore:

```text
displacement Δx = x₂ - x₁ >= 0
displacement magnitude |Δx| = Δx
average velocity v̄ = Δx / Δt >= 0
average velocity magnitude |v̄| = v̄
```

This deliberately avoids mixing the initial learning objective with direction
signs or the distinction between distance and displacement magnitude during a
reversal. Learner-facing copy should consistently ask for `位移大小` and
`平均速度大小`. A short note explains that, because the car travels only in the
positive direction, the numerical value of average velocity magnitude also
equals average speed for these trials. Do not surround these Chinese names with
absolute-value bars or an average-velocity overbar in learner prompts, field
labels, review, or feedback.

Do not ask the ambiguous question `瞬時速度是否等於平均速度？`. Use:

- uniform motion: `在這段勻速直線運動中，車在每一時刻的瞬時速度大小，是否都等於這段時間的平均速度大小？`
- variable motion: `在這段變速直線運動中，車在每一時刻的瞬時速度大小，是否都等於這段時間的平均速度大小？`

The uniform answer is yes. The variable-motion answer is no. Final feedback
must add that an instantaneous value may coincidentally equal the interval
average at one particular instant; it is not equal at every instant.

## Three-significant-figure policy

Three significant figures apply to ruler labels, captured position readings,
stopwatch readings, analysis-window durations, calculated correct answers, and
final numeric feedback. Learner answer strings are not required to contain
three significant digits; any safe numeric form that parses to an accepted
value is eligible for numeric scoring.

### Display rules

Use one shared production formatter and test it independently.

The formatter canonicalizes the raw finite value to three significant figures
and always expands it as ordinary decimal notation. A rounding carry such as
`99.96 -> 100` must remain correct. Unsupported subnormal values display as `--`
and are never accepted as learner answers.

- Non-zero values are rounded to three significant figures. Ordinary-decimal
  integers such as `500` do not visually encode how many terminal zeros are
  significant; the activity treats them as canonical rounded values without
  claiming the notation alone communicates that precision.
- Preserve required trailing zeros when ordinary decimal notation can express
  them, such as `5.00` and `50.0`; whole integers remain bare.
- Use tabular or monospace numerals so changing decimal places do not shift the
  layout.
- Examples:
  - `0.00500 m`
  - `0.500 s`
  - `5.00 m/s`
  - `50.0 m`
  - `500 m`
- Exact zero displays as `0.00` plus its unit. Formally zero has no non-zero
  significant digit; this notation communicates the activity's measurement
  precision and is the sole zero exception.
- All activity-generated and display-formatted values use ordinary decimal
  notation, including integers with trailing zeros and small decimals. Long
  manually timed observations may produce longer decimal strings, but generated
  output never switches to scientific notation. Preserved learner strings shown
  in draft or locked review may retain accepted `e`/`E` notation.
- Ruler major marks are every `10.0 m` and minor marks every `1.00 m`. Major
  labels use the same three-significant-figure formatter. The fixed pointer also
  shows the current position digitally to three significant figures.
- The timer begins at `0.00 s`; after it becomes non-zero, it uses the same
  formatter rather than a fixed number of decimal places.

### Authoritative measurement rule

Never score against hidden precision that the learner cannot see.

On a stopwatch press:

1. calculate the high-precision simulation time and world position;
2. use the stage's generated fixed `definition.uniform.coordinateOrigin` or
   `definition.variable.coordinateOrigin` as `readingOrigin`; the visible ruler
   already uses that same origin before timing, and stopwatch start persists and
   continues using it without changing the displayed reading;
3. canonicalize each local reading (`worldPosition - readingOrigin`) to the exact
   numeric value represented by its three-significant-figure display;
4. store the origin and canonical readings as the authoritative assessment data;
5. derive displacement, elapsed time, and average velocity from those stored
   readings;
6. round each final calculated answer to three significant figures.

Intermediate arithmetic retains full precision after the captured readings have
been canonicalized. Do not repeatedly round intermediate results.

### Learner input rules

Use text inputs with `inputmode="text"`, not `input type="number"`, because the
browser may discard significant trailing zeros and a mobile learner may need to
enter an `e` exponent.

- Accept unsigned decimal notation or standard `e`/`E` scientific notation for
  input compatibility. Parse it to a numeric value for validation and scoring,
  while preserving the learner's trimmed safe input string for draft and locked
  review. Negative signs, commas, and units remain invalid; a signed exponent is
  valid.
- Reject a non-zero mantissa that underflows to zero, unsupported subnormal
  magnitudes, non-finite values, and magnitudes above
  `MAX_LEARNER_INPUT_VALUE`. True zero forms such as `0`, `0.0`, and `0e-999`
  remain valid.
- Ignore surrounding whitespace.
- Examples:
  - `5`, `5.0`, and `5.00` are valid and score as the same number;
  - `0`, `0.0`, `0.00`, and `0e-999` are valid zero entries;
  - `0.500` is valid;
  - `05.00` is valid, scores numerically as `5`, and remains `05.00` in review;
  - `5.00e2` is valid, scores numerically as `500`, and remains `5.00e2` in
    review;
- `0.00` is a valid zero-format entry in every numeric field; whether zero is
  correct is decided only during final scoring, never by pre-submit format
  validation;
  - unit text such as `5.00 m` is invalid because the unit is already displayed
    beside the field.
- Formatting errors do not deduct points. They block confirmation and explain
  that units, commas, signs on the mantissa, underflow, and excessively large
  values are unsupported.

### Numeric scoring tolerance

Once an entry passes the numeric safety check, use the symmetric
inclusive comparison:

```text
|answer - expected| <= halfThirdPlace(expected) + epsilonGuard(expected)
epsilonGuard(x) = 8 × Number.EPSILON × max(1, |x|)
```

`answer` and `expected` use the quantity's displayed unit. An expected exact
zero accepts only parsed numeric zero. The expected value and tolerance still
come from the three-significant-figure canonical displayed answer.

Examples:

- expected `6.42` has a half-unit boundary of `0.005`;
- expected `42.0` has a half-unit boundary of `0.05`;
- expected `0.500` has a half-unit boundary of `0.0005`.
- for the expected `6.42`, a raw comparator probe of `6.424999` is just inside
  and `6.425001` is just outside before the epsilon guard; among valid
  three-significant-figure learner entries, `6.42` is accepted and `6.43` is
  rejected.

Easy-to-change constants:

- `SIGNIFICANT_FIGURES = 3`
- `RULER_MAJOR_STEP_M = 10`
- `RULER_MINOR_STEP_M = 1`
- `NUMERIC_EPSILON_FACTOR`
- `MAX_LEARNER_INPUT_VALUE = MAX_RENDER_POSITION`

## Attempt randomization

Every new editable Moodle attempt creates a new random attempt definition. Use
`crypto.getRandomValues()` where available and a small local seeded PRNG after
seed creation so tests and review reconstruction are deterministic.

Do not use learner identity or personally identifiable LMS fields as part of the
seed. A sufficiently large parameter space makes identical answer sets between
students unlikely, but the UI and documentation must not claim mathematical
global uniqueness.

Save the generator version and concrete attempt-level controls with the seed.
The local versioned PRNG and chunk-index contract are production data: final
review regenerates and validates the same stream without storing an unbounded
segment array.

Randomized values include:

- uniform speed;
- initial world position and coordinate origin;
- variable-stream endpoint speeds, ramp directions, non-zero cruise locations,
  exact-stop locations, and segment durations in every chunk;
- a visible stage-two minimum from `3.00 s` to `5.00 s` in `0.250 s` steps;
- whether the instantaneous target ramp accelerates or decelerates;
- the precise target position within that ramp;
- small finite scene-layout variants that do not change the physics.

Learner-selected stopwatch instants add further variation, but random attempt
generation must already produce different expected values without relying on
human reaction time.

Reject and resample an attempt definition when:

- the uniform speed is not visibly distinct from the variable profile's main
  speed levels;
- the variable speed ever becomes negative;
- the variable profile has a discontinuous velocity at any segment or chunk
  boundary;
- a constant non-zero or stopped plateau is as long as the smallest stage-two
  minimum, because a legal interval must contain genuine velocity variation;
- a stage-three target is at or too near a segment boundary;
- the four shrinking-window average velocities do not produce at least three
  distinct displayed values;
- the shrinking-window values fail to approach the target instantaneous value
  in the expected direction;
- any expected learner numeric answer is non-finite or cannot be represented by
  the supported ordinary-decimal three-significant-figure formatter;
- motion is too small to be obvious at a 320 CSS-pixel viewport;
- the chosen scale would move ruler labels too quickly to read;
- the minimum accepted interval would make independently rounded `x1` and `x2`
  too coarse to resolve displacement.

Generator validation has a fixed retry cap. Exceeding it is a technical attempt
generation error, not permission to use an invalid fallback question. Ruler tick
phase is derived from the coordinate origin and current world position; it is
not an independent decorative random value that could disagree with the numeric
position readout.

## Scene and layout

Use the shared responsive split-pane shell.

Desktop and wider tablets:

- left scrollable operation panel, approximately `20rem` to `24rem`;
- right stage remains visually dominant;
- measurement readouts remain visible while answers are entered.

Phone portrait:

- stage remains anchored at the top of a bounded app viewport;
- operation panel is the independently scrollable lower region;
- no horizontal scrolling;
- all controls have at least a 44 CSS-pixel target.

Scroll topology and gesture ownership:

- `.motion-panel` is the sole normal vertical control-scroll owner. The
  activity document and Moodle host page must not move while the learner is
  trying to reach controls;
- because `.motion-stage` and `.motion-panel` are sibling grid tracks, a native
  stage pan cannot scroll the panel. The stable stage surface explicitly
  forwards a one-finger vertical gesture to the panel after an 8 CSS-pixel
  intent threshold;
- `touch-action: pan-x pinch-zoom` is present on the stage before
  `pointerdown`. Horizontal and multi-touch gestures stay browser-owned. A
  non-primary touch entering the stage after the primary touch began on the
  panel or elsewhere is never eligible for forwarding;
- forwarding uses signed finger movement, clamps to the panel's true range, and
  keeps the activity page, visual viewport, iframe/Moodle host page, and fixed
  stage position unchanged. It changes no motion model, timer, answer, or
  persisted state;
- the Canvas has no draggable target. All assessed interactions remain native
  controls in the panel.

| Touch starts on | Owner | Required result |
|---|---|---|
| Non-interactive motion/graph stage | Explicit stage-to-panel forwarding after vertical intent | Non-zero panel delta when range exists; zero activity-page, viewport, iframe/host, and stage-position delta; trusted `pointermove` and `pointerup`, no unexpected `pointercancel` |
| Operation-panel control or panel background | Native operation panel | The panel reaches its true top and bottom, including the current phase's final action, without moving Moodle |
| Horizontal or multi-touch gesture on stage | Browser | No panel forwarding and no motion/answer-state change |

The motion scene is a clear horizontal side view rather than the oblique
three-lane layout of the reference-frame activity. Reuse the existing activity's
car colour, recognisable body treatment, restrained palette, and shadow style;
do not copy its multi-car reference-frame model.

Stage-one and stage-two layers:

1. quiet sky and a deterministic far layer of houses, shops, apartments, and
   tree groups;
2. a nearer verge layer of trees, shrubs, lamps, signs, and small clusters;
3. a two-lane road with its dashed divider at the exact vertical centre;
4. a separate horizontal world-position ruler below the road;
5. the tracked car inside the upper lane at the central measurement pointer;
6. stopwatch and position overlays;
7. accessible status text outside Canvas.

The road layout is derived from one responsive geometry containing `roadTop`,
`roadBottom`, `roadCentreY`, both lane centres, `carGroundY`, and `rulerY`.
The wheel contact line must remain inside the upper lane and clear of both the
grass verge and centre divider at desktop, tablet, and 320 CSS-pixel widths.
The ruler occupies its own dark measurement strip and must never resemble a
second lane divider. Tick heights adapt to the available strip: their complete
strokes and top margin remain below `roadBottom`, while labels remain inside the
viewport even in a 180 CSS-pixel-high stage. The dashed road divider is anchored
to authoritative world position, moves backwards with the ruler, and restores
to the same phase.

Stages one and two must make the reference choice explicit:

```text
鏡頭正在跟隨車輛；車的實際位置由下方標尺讀取。
```

In stages one and two the car remains at a stable screen coordinate. Ruler
ticks, road texture, and both background layers translate backwards according
to the car's world position. The near layer moves with the road; the far layer
uses restrained parallax. Each layer uses stable layer-plus-world-cell
identities, including at negative coordinates, so an object cannot change type,
size, or shape while it is visible. Cells include deliberate gaps and
deterministic within-cell offsets to avoid a mechanical alternating pattern.
Objects enter and leave outside the viewport buffer, and roadside objects are
drawn behind the car and pointer. Far-layer objects use a deeper baseline within
the verge; roadside objects use a separate baseline immediately beside
`roadTop`, so the two depth layers do not collapse onto one horizon.
At zero velocity all of these cues stop together. Do not use motion blur, camera
shake, or decorative speed lines as required evidence.

Each stage starts from its saved random initial position and motion phase. The
tracked world may continue for as long as the learner chooses: the road, ruler,
and landmarks recycle visually while authoritative model time and position stay
finite. There is no preview timeout, episode cap, or automatic capture.
`重新量度` returns to the same random initial position and phase rather than
generating a new question.

Before timing, the visible ruler uses the stage's generated fixed
`coordinateOrigin`. Starting the stopwatch persists that same origin as the
measurement's `readingOrigin`; it does not rebase the ruler or change the
displayed reading. The digital position, ruler, captured table, calculation,
feedback, and scoring all use the same local readings; hidden world-position
precision is never used as a separate scoring source. The runtime accepts model
times only up to a technical multi-year safety ceiling (`1000000000 s`) and
renderable positions up to `100000000000 m`. These are corrupted-state guards,
not learner-facing time limits, pauses, or automatic capture points.
Restorable ready states must retain enough headroom for the stage minimum
measurement plus one safe interaction frame and a centralized floating-point
reserve; active measurements must retain the same continuation reserve after
reaching minimum eligibility. Runtime numeric failures enter a locked technical
state instead of leaving controls in a false running state.

The measurement pointer is a fixed vertical line through the car's centre. Every
captured position uses that centre point. Brief `A` and `B` capture badges may
flash at the pointer, while the authoritative readings remain in the operation
panel. Pressing `停止計時` stops the stopwatch only; it must not make the car
physically stop.

Stage three changes the main stage to an analysis view:

- keep the road and target marker fixed while a demonstration car travels at a
  constant screen speed from off-screen left to off-screen right;
- leave a translucent car image at the fixed target after the car crosses it,
  hold the image for about two seconds after the moving car exits, then restart
  the clean loop;
- give the position-time graph the main readable area below that compact road
  context;
- place the grouped `目標位置` and `目標時刻` readout cards in their own row
  above the Canvas, with each value visually divided from its own label so the
  two readings cannot be mistaken for one another or cover the car;
- show the target instant as a vertical cursor;
- show the selected interval's two endpoints and secant line;
- reveal the tangent and exact instantaneous velocity only after a trusted final
  submission has completed; pre-submit review and review-edit remain solution-free.

Stage three uses the original world-position coordinate consistently for the
graph, fixed-road target context, and digital position readout. Its table uses
relative `Δx` and `Δt`, derived from the same exact model endpoints, so each
displayed average can be checked directly. The looping car pass is qualitative
and does not advance authoritative model time. Stages one and two use their
generated fixed `coordinateOrigin` for the whole stage, including before and at
stopwatch start, so the displayed reading stays continuous across 50 m world
boundaries and does not jump when measurement begins.

At phone widths the stage-one and stage-two motion status occupies a dedicated
row below the Canvas rather than floating over it; it must not cover ruler
ticks, labels, or the measurement pointer. In the stage-three grid, target
readouts, Canvas, and status each occupy separate rows at every viewport width.
The graph's `x / m` quantity label sits inside the plot below the road boundary,
and its axis label, graph, car context, and grouped readouts must not overlap at
320 CSS-pixel width, short-height phone layouts, or 200% zoom.

Use native Canvas for the animated road scene and native SVG or Canvas for the
position-time graph, whichever gives simpler crisp labels. No third-party graph
library is justified.

### Stopwatch position markers

Starting the stopwatch draws `開始 x₁` at authoritative world position
`readingOrigin + x1`; stopping draws `停止 x₂` at `readingOrigin + x2`.
Markers move with the road, survive pause/restore/review-edit, clear on
remeasurement, and become labelled directional edge cues while off screen.
Pausing observation never creates `x₂`. Start and stop use different text,
line patterns, and circle/square shapes. A white contrast halo plus dark teal or
purple core provides at least 3:1 non-text contrast. Draw the lower-lane marker
after the car and pointer, with an offset opaque label badge, so a marker at the
pointer remains legible without covering the car.

## Physics and motion model

Use one-dimensional world position `x` in metres and simulation time `t` in
seconds. Animation time is derived from `requestAnimationFrame` timestamps, but
all scored calculations use the pure motion model.

### Uniform motion

```text
x(t) = x₀ + vt
v(t) = v
```

Suggested validated random ranges:

- speed `v`: `3.20 m/s` to `8.80 m/s`, sampled in `0.01 m/s` steps;
- initial position `x₀` and coordinate origin: sampled together for a readable
  opening ruler view;
- minimum accepted measurement duration: `1.50 s`;
- no maximum measurement duration; only the learner stops the stopwatch.

The exact generated range may be tightened after visual checks, but it must
retain enough combinations that attempts do not collapse to a small answer set.
The theoretical instantaneous velocity and average velocity are exactly equal in
the ideal uniform model. Independently rounded position and time readings may
make the learner's calculated displayed average differ in the third digit; the
categorical question refers to the ideal values, and feedback must label any
such last-digit difference as measurement rounding rather than non-uniform
motion.

### Variable motion

Use a versioned, seeded, non-repeating stream of continuous piecewise-linear
velocity. Stream v1 divides time into 48-second random-access chunks. Each
chunk's internal durations, endpoint speeds, acceleration/deceleration order,
short non-zero cruise, and short exact-zero stop location are regenerated from
`seed + chunkIndex`; different chunks do not wrap or replay a fixed pattern.
The chunk's total time and distance are fixed only to permit O(1) lookup at very
large model times. Its visible internal events are independently randomized.

Adjacent segments share velocity endpoints, and adjacent chunks meet at zero,
so velocity and analytically integrated position never jump. Velocity stays
non-negative. Each chunk contains acceleration, deceleration, a non-zero
constant cruise, and an exact stopped plateau. Every constant plateau is shorter
than `3.00 s`; therefore every accepted stage-two measurement contains genuine
non-uniform motion even though it need not contain every event type.

Each attempt displays a minimum accepted duration sampled from `3.00 s` through
`5.00 s` in `0.250 s` steps. Disable endpoint capture until that duration has
elapsed, then let the learner stop manually. There is no complete-cycle rule,
automatic pause, or automatic endpoint capture.
The progress message uses the same centralized floating-point tolerance as the
stop control, so an eligible measurement reports that the minimum is reached
instead of displaying a microscopic positive remainder.

### Instantaneous velocity analysis

Reuse the same concrete variable-motion profile from stage two. Randomly select
one target instant `t*` inside a validated acceleration or deceleration ramp.
`t*` is internal technical notation only. Learner-facing headings, questions,
graph descriptions, review copy, and feedback always call it `目標時刻`; the UI
must never display "t star", `t*`, or `v(t*)`.
The complete longest window must remain inside that same linear ramp:

```text
t* - rampStart >= 2.00 s + TARGET_BOUNDARY_MARGIN_S
rampEnd - t* >= TARGET_BOUNDARY_MARGIN_S
```

Start with `TARGET_BOUNDARY_MARGIN_S = 0.100 s`. Each eligible ramp must be long
enough to satisfy both inequalities; the generator rejects all other targets.

Use one-sided intervals ending at the same target instant:

```text
[t* - 2.00 s, t*]
[t* - 1.00 s, t*]
[t* - 0.500 s, t*]
[t* - 0.250 s, t*]
```

One-sided intervals are deliberate: even under constant acceleration, their
average velocities change and approach `v(t*)`. A symmetric interval inside a
constant-acceleration segment would equal the midpoint instantaneous velocity
for every interval and would hide the intended convergence.

The authoritative duration is the exact declared window (`2`, `1`, `0.5`, or
`0.25`). Evaluate the model at exact `t* - window` and exact `t*`, canonicalize
their difference as displayed `Δx`, then derive the displayed average from that
displayed `Δx` divided by the exact displayed `Δt`. This avoids contradictory
independently rounded large absolute coordinates. Generator checks require the
four displayed averages to approach `v(t*)` strictly and in the acceleration
direction.

For each window show, to three significant figures, columns labelled in Chinese:

- `時間間隔`;
- `位移大小`;
- the explicit `位移大小 ÷ 時間間隔` operation;
- `平均速度大小`, derived from those displayed relative values.

The learner first reveals the windows from longest to shortest. The interface
then keeps all revealed rows and provides both `加長時間間隔` and `縮短時間間隔` controls,
so the learner can revisit the secants in either direction. The graph and a
highlighted table row always show the same active window. `viewedWindowCount`
remains the persisted cumulative reveal progress; the currently selected row is
transient view state and may safely return to the latest revealed row on reload.

Stages one and two already assess the arithmetic. Stage three therefore computes
the four window averages after the learner steps through the measurements and
asks the learner to choose the best supported three-significant-figure limiting
value from four randomized options rather than repeat four nearly identical
divisions. The correct option is the model `v(t*)` rounded to three significant
figures. Distractors use the longest-window value, shortest-window value, and a
wrong-direction continuation. Generation must reject a set unless the displayed
trend makes the correct option uniquely defensible and every option differs by
at least four units in the correct answer's third significant place.

After a trusted final submission, reveal:

- the exact model value `v(t*)`, displayed to three significant figures;
- the tangent on the position-time graph;
- feedback connecting the shrinking secants to the tangent slope.

The stopped plateau provides one additional, independent numeric concept
checkpoint. The stage-two learner measurement does not have to overlap that
plateau. The prompt must
define the physical situation directly instead of relying on the unexplained
term "completely stopped period":

```text
第 2 關的車有時會短暫停定。當車輛位置在一段時間內保持不變，
該段時間的瞬時速度大小是多少？
```

Supporting copy states that the position-time graph is horizontal in this
interval. The required answer is `0.00 m/s` under the exact-zero display
convention.

## Learner flow

### Stage 1: uniform motion

1. Read the short task instruction and press `開始觀察`.
2. Watch the ruler and car before measuring.
3. Press `開始計時`; the stopwatch becomes zero and position `x₁` is captured.
4. After at least the minimum time, press `停止計時`; `x₂` and elapsed time are
   captured while the car continues moving.
5. Read the captured table and enter numeric answers; learners need not pad
   their entries to three significant figures:
   - `位移大小` in metres;
   - `經過時間` in seconds;
   - `平均速度大小` in metres per second.
6. Answer the uniform-motion instantaneous-versus-average relationship question.
7. Confirming atomically saves the answer and opens stage two; `重新量度`
   remains available before confirmation.

### Stage 2: variable motion

1. Start and observe the seeded, visibly irregular motion stream.
2. While observation is running, press the stopwatch at any phase.
3. Continue until the displayed randomized minimum duration has elapsed.
4. Stop the stopwatch and answer the same three numeric quantities.
5. Answer the non-uniform-motion relationship question.
6. Confirming atomically saves the answer and opens stage three.

### Stage 3: time magnifier

1. Watch the looping road demonstration above the graph. The road remains
   fixed while the car moves at a constant screen speed from off-screen left
   to off-screen right. This qualitative pass identifies the target instant;
   its screen speed is not a scale representation of the generated motion.
   When it crosses the central gold target marker, leave a translucent car
   image at that position. The moving car exits, the image remains for about
   two seconds, and then the cycle restarts. A learner can pause and resume the
   demonstration at any point. This image identifies the instant whose
   velocity is being studied; playback is transient presentation state only.
2. Inspect the matching random target instant on the position-time graph.
3. Step through the four decreasing intervals from longest to shortest.
4. Use the longer/shorter controls to revisit any revealed interval, observing
   the highlighted table row, average velocity, and matching secant line.
5. Choose the best supported three-significant-figure estimate of the
   instantaneous velocity from four generated options.
6. Answer the conceptual multiple-choice question:
   - correct idea: `某一時刻附近愈來愈短時間內，平均速度所趨近的值`;
   - distractor: total displacement divided by total journey time;
   - distractor: displacement divided by exactly zero seconds;
   - distractor: the largest speed observed during one second.
7. Answer the explicitly worded checkpoint about a vehicle whose position stays
   unchanged while it is stopped.
8. Confirming atomically saves the answers and opens final review; correctness
   remains hidden until final submission.

### Review and submission

- Show all three stages in a compact review list.
- Provide visible previous/next controls on every activity stage. The learner
  may move forward or backward at any time without first confirming the current
  answer, including moving directly to an incomplete review.
- Preserve partial field strings and choices whenever the learner changes stage
  or reloads an editable draft. Returning to a stage restores that work.
- Display the learner's recorded readings and answers, but not correctness.
- Allow returning to any stage and changing its measurement or answers.
- Changing a stage-one or stage-two measurement invalidates that stage's three
  numeric answers and requires re-entry.
- Changing the variable-motion measurement does not regenerate the variable
  profile or stage-three target.
- Do not allow final submission while any required answer is missing or fails
  numeric safety validation.
- Final submission scores only the final recorded state.
- Review edits return directly to review after a successful atomic save. Focus
  moves to the new stage heading, review heading, or focused save-error alert.

## Controls and accessibility

Controls:

- `開始觀察` / `暫停觀察` / `繼續觀察`;
- `開始計時` / `停止計時` / `重新量度`;
- numeric answer fields with visible fixed units;
- conceptual radio groups with no preselected answer;
- analysis-window step buttons;
- stage-three `暫停示範` / `繼續示範` control when motion reduction is
  not requested;
- stage navigation, review, edit, and final submit.

Rules:

- Core operation works with touch, mouse, and keyboard.
- Focus order follows the visible task order.
- Every button and input has an accessible name and visible focus state.
- Do not convey fast, slow, or stopped states through colour alone.
- A polite live region announces start, manual pause, manual capture, stage
  transition, and final submission outcomes; it does not update every
  animation frame.
- In stages one and two, a persistent text status outside Canvas names the
  current qualitative motion state: slow cruise, accelerating, fast cruise,
  decelerating, or stopped. Update it only at motion-segment boundaries, not
  every frame.
- In stage three, the persistent status instead explains the qualitative
  pass/target image, paused or reduced-motion presentation, secant comparison,
  and tangent reveal. Its meaning must not depend on seeing an animation frame.
- The stage-three endpoint and average-velocity table is the non-visual
  equivalent of the position-time graph and secant display.
- Reduced-motion preferences remove decorative fades and easing. The stage-three
  looping demonstration becomes a static frame showing the moving car beyond
  the central translucent target image; its adjacent text and table preserve
  the complete concept. Essential learner-started measurement motion remains
  available with pause and replay.
- Stages one and two never autoplay. Stage three alone has the explicitly
  designed instructional loop above, with a visible pause/resume control; it
  changes no model time, answers, score, or persisted state. A live change to
  the operating-system reduced-motion preference immediately swaps the loop
  for its labelled static equivalent and, when motion reduction is removed,
  restores the prior paused/running presentation state.
- If the learner pauses during a running measurement, both the motion model and
  stopwatch freeze; the stop control stays disabled until observation resumes,
  then the same simulated interval continues.
- The stopwatch cannot start before `開始觀察`, and it can start or stop only
  while observation is running. UI disabled state and event guards enforce the
  same rule.
- Technical load or pending-submit errors disable unsafe controls and must not be
  described as a confirmed score, pass, fail, or submission.

## Scoring

Total: `100`.

Passing threshold: `60`.

### Stage 1: uniform motion — 30 points

- displacement magnitude: 10;
- elapsed time: 5;
- average velocity magnitude: 10;
- every-instant relationship: 5.

### Stage 2: variable motion — 35 points

- displacement magnitude: 10;
- elapsed time: 5;
- average velocity magnitude: 10;
- every-instant relationship: 10.

### Stage 3: instantaneous velocity — 35 points

- target instantaneous-velocity estimate choice: 20;
- limiting-average conceptual answer: 10;
- stopped-plateau instantaneous velocity: 5.

Scoring rules:

- Each component earns full assigned points or zero.
- Missing answers cannot be submitted.
- Learners do not have to enter or pad three significant digits. Any bounded,
  format-valid numeric string described by the learner-input rules can be
  confirmed; numerically equivalent forms receive the same score.
- Unsupported syntax, units, signed mantissas, non-finite values, underflow, and
  over-limit values block confirmation as numeric-safety errors, not as a
  significant-figure penalty.
- Replaying, pausing, remeasuring, or changing an answer before submission has no
  penalty.
- Clamp the total to `0..100`.
- Lowest possible score: 0.
- Highest possible score: 100.
- Passing requires 60 or above.

The three numeric measurement answers from stages one and two total 50 points.
A learner cannot pass using arithmetic alone without earning conceptual or
instantaneous-velocity credit.

## Feedback

Before final submission, do not reveal correctness.

After submission, show stage-by-stage feedback containing:

- the captured three-significant-figure readings;
- the learner's answer and the expected three-significant-figure answer;
- the worked calculation `位移大小 = 終點位置 − 起點位置`;
- the worked calculation `平均速度大小 = 位移大小 ÷ 經過時間`;
- a statement that uniform motion has constant instantaneous velocity;
- a statement that variable motion does not have one instantaneous velocity
  equal to the interval average at every instant;
- the four shrinking-window values and target instantaneous value;
- an explanation that zero velocity applies during the stopped plateau.

Render substitutions with trusted structured numeric data and plain Chinese
quantity names. Native CSS stacked fractions may show the arithmetic without
introducing absolute-value bars or overbars. Formula blocks have plain-language
`aria-label` descriptions and responsive overflow. Escape all prose and learner
strings before insertion. MathJax is unnecessary and must not be added: the
SCORM package remains self-contained and offline-capable.

For uniform motion, use `=` for the ideal model and `≈` when comparing the
constant model velocity with an average calculated from independently rounded
display readings. Explicitly attribute any last-digit difference to the required
three-significant-figure measurement precision.

Do not show more hidden precision than was available during the task.

## Phase/state matrix

The activity persists editable drafts and final review state. `running` is a
transient animation flag, not a persisted variant. When a draft is encoded while
motion or a stopwatch is running, capture the current pure simulation time and
normalize the saved variant to the corresponding paused state. This avoids
advancing time while the page is closed and gives the learner one legal `繼續`
action after restore.

| Phase | Variant/invariant | Current stage | Required semantic state | Must be absent/pristine | Allowed next action |
|---|---|---:|---|---|---|
| `uniform` | `ready` | 0 | valid attempt definition; uniform scene time; any independent work from other stages | uniform measurement and confirmed uniform answer | start observation, or navigate to any other stage |
| `uniform` | `paused-measuring` | 0 | canonical `x1`; elapsed time; current scene time | `x2`; uniform answers | resume observation, then stop when eligible; or discard measurement |
| `uniform` | `captured` | 0 | canonical `x1`, `x2`, `dt`; derived expected values | confirmed uniform answers | enter answers or remeasure |
| `uniform` | `answered` | 0 | valid captured measurement; three numeric answers; relationship answer | result metadata | revise, navigate, or confirm and open variable |
| `variable` | `ready` | 1 | valid variable profile; scene phase/time; any independent stage answers | variable measurement and confirmed variable answer | start observation, or navigate to any other stage |
| `variable` | `paused-measuring` | 1 | canonical `x1`; elapsed time; saved minimum; scene time | `x2`; confirmed variable answer | resume observation, discard measurement, or navigate away |
| `variable` | `captured` | 1 | valid minimum-duration measurement and canonical readings | confirmed variable answer | enter answers, remeasure, or navigate away |
| `variable` | `answered` | 1 | valid captured measurement and stage-two answers | result metadata | revise, navigate, or confirm and open instant |
| `instant` | `exploring` | 2 | valid target; completed-window prefix `0..4`; any independent prior-stage work | confirmed instant answer | view/revisit windows, answer when enabled, or navigate away |
| `instant` | `answered` | 2 | all four windows viewed; prediction; concept answer; stopped answer | final result metadata | atomically save and open review |
| `review` | `incomplete` | 3 | valid attempt plus any combination of partial/confirmed stage work | final result metadata | return to any stage; final submit remains disabled |
| `review` | `complete` | 3 | all authoritative attempt data and answers complete | score/result metadata before submit | edit or final submit |
| `uniform` | `review-edit-ready` | 0 | `returnToReview = true`; same definition; any independent other-stage work | current uniform measurement and answer | start observation or navigate elsewhere |
| `uniform` | `review-edit-paused-measuring` | 0 | `returnToReview = true`; uniform `x1`, elapsed/model time | uniform `x2` and confirmed current-stage answer | resume, discard, or navigate elsewhere |
| `uniform` | `review-edit-captured` | 0 | `returnToReview = true`; valid uniform measurement | confirmed uniform answer | enter answers, remeasure, or navigate elsewhere |
| `uniform` | `review-edit-answered` | 0 | `returnToReview = true`; confirmed uniform answer | result metadata | revise, remeasure, navigate, or return to review |
| `variable` | `review-edit-ready` | 1 | `returnToReview = true`; same profile and target; any independent other-stage work | current variable measurement and answer | start observation or navigate elsewhere |
| `variable` | `review-edit-paused-measuring` | 1 | `returnToReview = true`; variable `x1`, elapsed/model time | variable `x2` and confirmed current-stage answer | resume, discard, or navigate elsewhere |
| `variable` | `review-edit-captured` | 1 | `returnToReview = true`; valid variable measurement | confirmed variable answer | enter answers, remeasure, or navigate elsewhere |
| `variable` | `review-edit-answered` | 1 | `returnToReview = true`; confirmed variable answer | result metadata | revise, remeasure, navigate, or return to review |
| `instant` | `review-edit-exploring` | 2 | `returnToReview = true`; valid target and reveal prefix | confirmed instant answer | explore, answer, navigate, or return to incomplete review |
| `instant` | `review-edit-answered` | 2 | all windows viewed; `returnToReview = true`; confirmed instant answer | result metadata | revise, navigate, or return to review |
| `submitted` | `locked` | 3 | valid review snapshot sufficient to rescore and redraw | editable controls | inspect locked feedback only |

Transitions:

```text
any editable activity phase -> any other activity phase on explicit navigation,
  preserving measurements, confirmed answers, and partial draftAnswers
any incomplete activity state -> review/incomplete on explicit navigation to review
review/incomplete -> any review-edit stage when the learner selects that stage
uniform/ready -> uniform/paused-measuring when a running measurement is persisted
uniform/ready|paused-measuring -> uniform/captured when a valid endpoint is captured
uniform/captured -> uniform/answered when all stage-one answers are confirmed
uniform/answered -> variable/ready when the learner advances
variable/ready -> variable/paused-measuring when a running measurement is persisted
variable/ready|paused-measuring -> variable/captured when a minimum-duration endpoint is captured
variable/captured -> variable/answered when all stage-two answers are confirmed
variable/answered -> instant/exploring when the learner advances
instant/exploring -> instant/answered when all windows and answers are complete
instant/answered -> review/complete on confirmed atomic save
review/complete -> uniform/review-edit-answered when the learner edits stage one
review/complete -> variable/review-edit-answered when the learner edits stage two
review/complete -> instant/review-edit-answered when the learner edits stage three
uniform/review-edit-answered|review-edit-captured -> uniform/review-edit-ready when remeasurement begins
uniform/review-edit-ready|review-edit-paused-measuring -> uniform/review-edit-captured when a valid endpoint is captured
uniform/review-edit-captured -> uniform/review-edit-answered when revised answers are confirmed
uniform/review-edit-answered -> review/complete on confirmed atomic save
variable/review-edit-answered|review-edit-captured -> variable/review-edit-ready when remeasurement begins
variable/review-edit-ready|review-edit-paused-measuring -> variable/review-edit-captured when a valid endpoint is captured
variable/review-edit-captured -> variable/review-edit-answered when revised answers are confirmed
variable/review-edit-answered -> review/complete on confirmed atomic save
instant/review-edit-answered -> review/complete on confirmed atomic save
review/complete -> submitted/locked after a successful or committed final payload
```

Editing rules:

- remeasuring stage one clears only its three numeric answers and its relationship
  answer, then returns to `uniform/captured` after a new endpoint;
- remeasuring stage two clears only its three numeric answers and relationship
  answer; it retains the concrete variable profile and target definition;
- changing the variable profile is never an edit action; only a new Moodle
  attempt receives a new profile;
- stage-three window data is derived from the retained profile and target, not
  trusted as learner-authored snapshot data.
- review-edit variants retain all independent work from other stages because
  their physics is independent of the edited measurement; only the current
  stage's dependent confirmed answer is cleared by remeasurement. The learner
  may navigate away before completing the edit; no duplicate pre-edit backup is
  persisted.

## Persistence contract

Use `SimScorm.loadAttempt()` and `SimActivityFlow.startup()` at startup,
`SimScorm.makeSnapshot()` for drafts and reviews, and
`SimScorm.submitWithCallbacks()` plus `SimActivityFlow.submission()` for final
submission.

### Draft snapshot

The production schema may shorten property names, but it must preserve these
semantics:

```js
{
  v: 6,
  definition: {
    seed,
    uniform: { x0, speed, coordinateOrigin, layout },
    variable: { seed, streamVersion: 1, x0, coordinateOrigin, layout },
    variableMinimumDuration,
    instantTarget: { segmentIndex, timeWithinSegment },
    stoppedCheckpoint: { segmentIndex },
    windows: [2, 1, 0.5, 0.25],
    instantOptions: [{ id, value }]
  },
  phase,
  variant,
  stage,
  returnToReview,
  scene: { simulationTime, paused: 1, observationStarted: 0 | 1 },
  uniformMeasurement: {
    startModelTime,
    currentOrEndModelTime,
    readingOrigin,
    x1,
    x2,
    dt
  },
  variableMeasurement,
  answers,
  draftAnswers: {
    uniform: { displacement, time, averageVelocity, relationship },
    variable: { displacement, time, averageVelocity, relationship },
    instant: { predictionChoice, concept, stoppedVelocity }
  },
  viewedWindowCount
}
```

### Review snapshot

```js
{
  v: 6,
  locked: 1,
  definition,
  uniformMeasurement: { startModelTime, endModelTime, readingOrigin, x1, x2, dt },
  variableMeasurement: { startModelTime, endModelTime, readingOrigin, x1, x2, dt },
  answers: {
    uniform: { displacement, time, averageVelocity, relationship },
    variable: { displacement, time, averageVelocity, relationship },
    instant: { predictionChoice, concept, stoppedVelocity }
  }
}
```

Store confirmed trimmed learner numeric strings as authoritative answers so
locked review reproduces what was entered. Reparse them with the same bounded
numeric policy; do not maintain two independent sources of truth.

Do not duplicate `score` or `passed` inside the answer object. The result
metadata supplied to `SimScorm.makeSnapshot(..., result)` is the sole saved
comparison metadata in the shared envelope. Finished restore is:

```text
validate definition and answers
-> rebuild derived motion and expected values
-> activity scorer
-> SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

### Authoritative state

- concrete motion parameters and target definition;
- model start/end times, locked `readingOrigin`, and captured canonical `x1`,
  `x2`, and `dt` for both
  measured stages; model times are required to validate the capture against the
  saved motion definition and prove minimum-duration coverage;
- confirmed learner answer strings and conceptual choice IDs, plus bounded
  partial `draftAnswers` strings/choice IDs required to restore unconfirmed form
  work after arbitrary stage navigation;
- phase, variant, current stage, `returnToReview`, and completed-window count
  needed to continue;
- paused simulation time and active measurement start needed to resume.

### Derived state rebuilt on restore

- current high-precision position from the motion model;
- expected displacement, average velocity, and instantaneous velocity;
- versioned chunk segments and analytic integrated offsets;
- position-time graph points and secant/tangent geometry;
- ruler tick DOM/Canvas positions;
- score, pass/fail, feedback, enabled buttons, CSS classes, and focus state.

### Transient state never persisted

- `requestAnimationFrame` ID and previous wall-clock timestamp;
- stage-three demonstration epoch, elapsed cycle time, paused/running flag, and
  paused elapsed time;
- currently highlighted stage-three window/row; `viewedWindowCount` alone is
  authoritative unlock progress, so restore may select the latest revealed row;
- live operating-system reduced-motion preference;
- DOM references;
- hover, focus, pressed visual state, and live-region queue;
- deterministic far-layer and roadside-layer world-cell identities and appearance;
- cached graph pixels or screenshots.

### Validation invariants

- Schema version, activity slug, phase, variant, and stage are supported.
- Every numeric field is finite and non-negative where required. Simulation
  time and rendered position remain below the technical multi-year safety
  bounds; there is no normal learner-facing duration cap.
- Ready and active measurement states retain enough model-time headroom to
  complete the applicable `1.50 s` or seeded `3.00–5.00 s` minimum; boundary states that
  cannot advance to a legal continuation fail closed.
- The variable seed, stream version, minimum duration, and regenerated chunks
  are valid and deterministic.
- Velocity is continuous, non-negative, and includes a valid zero plateau.
- Target segment and target time satisfy the same-ramp longest-window and margin
  inequalities.
- Window list is exactly the supported decreasing set for version 6; each row's
  authoritative duration equals that exact value.
- Instantaneous options have four unique stable IDs, three-significant-figure
  values, one validated correct ID, and the saved display order; restore never
  reshuffles them.
- Captured measurement values have valid ordering and agree with their motion
  definition, locked local reading origin, and canonical capture precision.
- A captured variable interval covers its saved minimum duration.
- Answer strings pass bounded numeric parsing and correspond to their phase.
- Stage position is independent of answer completion: any editable stage may be
  visited, but a confirmed measurement answer still requires its own captured
  measurement, and an instant answer still requires all four windows.
- Every confirmed answer exactly matches its stage's persisted `draftAnswers`.
  Bounded incomplete draft strings and empty choices are legal; unsupported
  choice IDs, excessive lengths, or inconsistent confirmed/draft pairs fail
  closed.
- Review-edit variants have `returnToReview = true` and clear only the current
  stage's dependent answer during remeasurement. Ordinary activity variants and
  review itself must not carry the flag.
- `viewedWindowCount` is an integer from 0 to 4 and a prediction choice cannot
  exist before all four windows are viewed.
- Submitted review contains every answer and no editable-only transient state.
- Representative maximum draft and review snapshots remain below 4000 UTF-8
  bytes.

### Invalid snapshot policy

- Invalid editable draft: lock with a technical load message unless the shared
  runtime can explicitly clear/overwrite the invalid draft before starting a new
  attempt definition. Never silently reinterpret invalid measurements.
- Pending-final: remain frozen and retry the exact same payload.
- Invalid finished review: remain locked and show only trustworthy Moodle score
  and status; do not reopen editing.
- Unsupported version: follow the same safe policy; no implicit migration. v3
  and v4 development drafts may be explicitly replaced by a fresh v5 attempt
  with a clear notice; invalid finished reviews remain locked unless a separate
  read-only decoder is deliberately shipped.
- Score mismatch: keep Moodle's recorded result authoritative and suppress
  untrustworthy detailed correctness.

Save a draft after semantic changes: attempt creation, stopwatch start/stop,
pause, measurement discard, answer confirmation, arbitrary stage transition, analysis
window advance, and review edit. Do not commit on every animation frame. Register
a draft provider so lifecycle flushes capture the current simulation time and
normalize running motion to a paused snapshot.

## Shared SCORM lifecycle

Startup UI:

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `review` | No | Validate, rescore, and show locked review or safe Moodle summary |
| `editable` | Yes | Create or restore the random attempt and register the draft provider |
| `frozen` | No | Retry the same pending payload; status remains unconfirmed |
| `load-error` | No | Show a technical error without score/pass/submitted claims |

Submission UI:

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `success` | No | Show submitted review-only state |
| `committed` | No | Show committed result; allow finish retry only |
| `frozen` | No | Show pending/unconfirmed state without result claims |
| `retry` | Depends | Respect `retryable`; never promise an unavailable retry |

After final submission, finish the SCORM attempt and lock the submitted attempt
for review. A new Moodle attempt is required for new random values or a changed
score.

## Test plan

Add every new test file to `tools/run-tests.js`.

### Display precision and bounded numeric-input tests

- formatting `0.00500`, `0.500`, `5.00`, `50.0`, `500`, and exact
  `0.00`;
- rounding across a power-of-ten boundary;
- preserving trailing zeros in learner answers and review;
- accepting `5.00`, `0.500`, and `05.00`;
- accepting `0.00` as a format-valid zero in every numeric field while scoring
  it wrong against a non-zero expected answer;
- accepting `5`, `5.0`, `5.00`, zero forms, and correctly formed `e`/`E`
  scientific notation, while rejecting malformed exponents;
- comparing values correctly at power-of-ten boundaries, preserving and
  round-tripping every accepted trimmed safe input string, and rejecting
  unsupported subnormal magnitudes;
- formatting expected/display boundary values with three significant digits and
  no `Infinity` or `NaN` text;
- rejecting unit text, commas, non-finite values, non-zero underflow such as
  `1e-324`, over-limit values, and overlong strings; accepting true zero
  exponent forms such as `0e-999`;
- half-third-significant-place tolerance just inside and just outside;
- exact-zero scoring accepts parsed zero and rejects the smallest non-zero valid
  three-significant-figure entry;
- scored expected values derived from displayed canonical captures rather than
  hidden simulation precision.

### Random-generation tests

- same seed produces the same concrete validated definition;
- at least 95 of 100 fixed distinct test seeds produce different concrete
  parameter tuples, and the sample produces multiple expected answer sets for
  both measured stages;
- all generated values remain within declared ranges;
- retry cap fails closed;
- long-running observation remains finite and reset returns to the same
  definition and start;
- late-start minimum and multi-chunk measurements retain non-zero canonical
  displacement through their locked local reading origin;
- generated expected numeric answers remain displayable with three significant
  figures;
- final snapshot restores from concrete parameters without rerunning random
  sampling.

### Motion-model tests

- uniform position and velocity at representative times;
- variable velocity and position continuity at every segment and chunk boundary;
- analytic integrated displacement for every segment;
- non-negative velocity and a true zero plateau;
- monotonic non-decreasing world position;
- any accepted stage-two interval is at least its seeded minimum and is truly
  non-uniform; each generated chunk contains non-zero cruise, stop,
  acceleration, and deceleration events in varied positions;
- pause/resume changes no simulation time while paused;
- render frame rate does not change final model position;
- all four one-sided averages use exact `[2, 1, 0.5, 0.25]` durations, approach
  `v(t*)` strictly in the correct direction, and retain at least three distinct
  displayed values across a large deterministic seed sweep;
- the full longest window and boundary margins lie inside one linear ramp;
- generated instantaneous options are unique, sufficiently separated, saved in
  stable order, and have exactly one defensible correct ID;
- stopped checkpoint derives exact zero.

### Scene-visual tests

- responsive road, lane, ruler, car, and background geometry remains finite and
  ordered at desktop, tablet, and phone scales;
- wheel angle follows authoritative world distance and stable background and
  landmark cells retain their identities across recycle boundaries;
- stage-three demonstration starts off-screen left without a target image,
  travels at constant screen speed, crosses the exact fixed centre target,
  continues right while the translucent image remains, holds with the moving
  car off screen, and restarts from a clean cycle;
- invalid demonstration time or geometry fails closed.

### Scoring tests

- perfect score of 100 and pass;
- all wrong score of 0 and fail;
- exact pass boundary of 60;
- each component weight independently;
- correct arithmetic with wrong relationship answers;
- correct stage-one and stage-two arithmetic alone totals 50 and fails;
- missing or malformed answer rejected before final scoring;
- changed measurement invalidates stale numeric answers;
- remeasure/replay/pause metadata does not affect score;
- score clamped to `0..100`.

### Persistence tests

For every saveable phase/variant row:

- encode/decode/restore a production-shaped state;
- assert scored meaning is unchanged;
- execute one legal continuation and assert the next phase/variant;
- verify a running in-memory measurement encodes as the declared paused variant;
- verify score and pass/fail equality before and after final review restore.

Invalid-state matrix cases include:

- incomplete and complete review states reached through arbitrary stage order;
- partial form strings and choices surviving encode/decode and forward/backward
  navigation;
- confirmed answers that disagree with their persisted draft values;
- confirmed stage answers without their own required captured measurement or
  four-window reveal prerequisite;
- active measurement with an endpoint already present;
- variable measurement shorter than its saved minimum;
- captured endpoint later than the current scene time;
- long active and manually captured measurements failing round-trip restore;
- missing or inconsistent `readingOrigin`, unsafe model time, unsafe rendered
  position, or inconsistent `observationStarted` state;
- ready/active states at the technical ceiling or just below it without the
  applicable minimum-measurement headroom;
- repeated production-size frames from accepted ready/active boundary states,
  including stop eligibility and one further safe frame without automatic stop;
- impossible phase/variant/current-stage combinations;
- missing or stray `returnToReview` flags and invalid review-edit variants;
- a review-edit round trip for every declared uniform, variable, and instant
  edit variant, followed by its legal return to review;
- invalid target relationship or window order;
- missing model capture times, capture values inconsistent with those times, or
  an interval whose displayed `dt` disagrees with its model endpoints;
- malformed, underflowing, or over-limit numeric answer strings;
- `NaN`, `Infinity`, negative durations, negative speeds, and zero-length ramps;
- unsupported stream version or discontinuous regenerated stream definition;
- unsupported version;
- finished invalid review remains locked;
- pending-final payload remains frozen;
- score/status mismatch uses safe Moodle review;
- maximum snapshot stays below 4000 UTF-8 bytes.

### Shared lifecycle UI tests

Exercise the production outcome-to-view logic, not source-string searches:

- startup `review`, `editable`, `frozen`, and `load-error`;
- submission `success`, `committed`, `frozen`, retryable `retry`, and
  non-retryable `retry`;
- trusted restored review, score/status mismatch, corrupt review, and unknown
  Moodle lesson status;
- every technical or pending state locks unsafe controls and avoids an
  unconfirmed score/pass/fail/submitted claim.

Keep the outcome-to-view mapping pure and exported from production code so the
existing smallest suitable test file can call it directly. Add a separate
runtime/helper file only if direct testing from `main.js` proves impractical.

### Interaction and visual checks

- 320 CSS-pixel phone portrait;
- phone landscape and short-height viewports;
- tablet and desktop split-pane layouts;
- 200% browser zoom;
- high device-pixel ratio;
- keyboard-only completion;
- touch controls and no accidental page scroll while operating the stage;
- reduced-motion preference;
- stage-three pause/resume freezes and continues the same qualitative
  demonstration frame without changing model time, answers, score, or snapshot;
- a live reduced-motion preference change replaces the loop with its labelled
  static car-beyond-target image and can restore the loop;
- long Traditional Chinese feedback;
- ruler labels remain readable and correctly recycled;
- phone stage-one and stage-two status uses its own row below the Canvas and
  never covers ruler ticks or labels;
- timer and position fields do not shift as decimal places change;
- fast, slow, and stopped motion are visually obvious without colour alone;
- stage-three target-position and target-time cards remain grouped, separated,
  and outside the Canvas; they do not cover the animated car;
- stage-three graph labels and secants remain readable on phone, and the `x / m`
  label remains visible inside the plot below the road;
- resizing preserves attempt definition, phase, measurements, answers,
  simulation time, and pause state.

Use the documented Git Bash Playwright CLI route for the built-package smoke
check and treat `### Error` output as failure even if the process exits zero.

## Acceptance checks

- Opens directly into the first task; no decorative landing page.
- All learner-facing copy is Traditional Chinese.
- Stages one and two use the tracked central car and backward-moving world
  ruler, and explicitly explain that the camera follows the car.
- In stages one and two car position is always measured at the fixed centre
  pointer.
- Stage three instead keeps the road and centre target fixed while a car moves
  from off-screen left to off-screen right at constant screen speed, leaves a
  translucent image at the target, holds it for about two seconds, and repeats.
- The stage-three demonstration has pause/resume, a labelled reduced-motion
  static equivalent, and never changes model time, answers, score, or persisted
  state.
- Ruler major and minor spacing represents metres consistently.
- Ruler labels, stopwatch values, captured positions, expected answers, and
  numeric feedback are canonicalized or rounded to three significant figures;
  learner inputs need not pad trailing zeros.
- Activity-generated measurements, choices, expected answers, and feedback use
  ordinary decimal notation. A bare whole integer such as `500` is the
  activity's canonical rounded value but does not visually encode terminal-zero
  precision by itself.
- Numeric input preserves the learner's trimmed safe bounded string for draft
  and locked review, including accepted `e`/`E` notation, while treating
  numerically equivalent forms equally for scoring.
- Scoring uses canonical displayed readings, never hidden raw values.
- Every new editable attempt receives a validated random definition.
- A restored attempt preserves the same concrete questions and expected answers.
- Randomness does not use learner identity or other PII.
- Uniform and variable stages both vary numerically between attempts.
- Observation and measurement have no time cap or automatic pause/capture;
  remeasure returns to the same random start.
- Stopwatch start captures `x1`; stopwatch stop captures `x2` and `dt`.
- Stopwatch start is disabled until observation has started and is running;
  pausing an active stopwatch disables endpoint capture until observation resumes.
- Wheel spokes rotate from world distance, freeze on manual pause and physical
  zero velocity, and restore deterministically from the saved world position.
- Car proportions show a short rear overhang and a distinct right-facing bonnet,
  headlamp, grille, and bumper while its centre stays aligned with the pointer.
- Trees and buildings derive type and geometry from stable world-cell IDs, keep
  their identity across recycle boundaries, and enter or leave outside the viewport.
- Both measured stages require learner answers for displacement, elapsed time,
  and average velocity.
- Pressing stopwatch stop does not stop the physical car.
- Variable motion is irregular, non-repeating, and includes randomized ramps,
  non-zero cruises, and exact stops; every valid measurement is non-uniform but
  need not include every event type.
- Variable velocity and position remain continuous.
- The variable relationship question uses `每一時刻` and avoids the ambiguous
  unrestricted equality question.
- Stage-three one-sided intervals visibly converge toward the target
  instantaneous velocity.
- All four analysis windows lie inside the same ramp, retain their exact
  declared durations, and show relative displacement and average-velocity
  values that can be recomputed from one another; the four saved estimate options have
  exactly one defensible answer.
- Tangent and exact target value remain hidden through answering, pre-submit
  review, review-edit, save failure, and unconfirmed submission states; they
  appear only with a trusted submitted review.
- Learner identifies zero instantaneous velocity during the stopped plateau.
- No answer is preselected.
- Learner may remeasure and edit without penalty before submission.
- Remeasuring invalidates stale dependent answers.
- Phone controls remain at least 44 CSS pixels and the task is keyboard
  accessible.
- On phones, stage-one and stage-two status occupies a dedicated row below the
  Canvas and cannot cover the ruler, its labels, or the pointer.
- Stage-three target-position and target-time readouts are individually grouped
  and divided in a row above the Canvas; the car, readouts, graph, and status do
  not overlap, and the `x / m` axis quantity remains visible inside the plot.
- Canvas motion states have a persistent non-visual text equivalent, and the
  analysis table is the non-visual equivalent of the graph.
- Local fallback works without Moodle.
- Draft restore preserves the random attempt and a legal continuation.
- Every review-edit variant restores retained downstream work and returns legally
  to review after the current stage is completed.
- Final submission handles `success`, `committed`, `frozen`, and `retry`.
- Re-entry after submission is locked review-only.
- Corrupt review data fails safely to a locked Moodle-summary view.
- `npm.cmd run check`, `npm.cmd test`, and `npm.cmd run package:all` pass.
- `npm run test:browser:linear-motion` loads the packaged production activity in
  Chrome, completes all three editable stages through pre-submit review and
  review-edit, and verifies that neither solution copy nor tangent pixels appear
  before a trusted final submission. It restores the real completed draft and
  drives production final-submit/startup handlers for `success`, `committed`,
  `frozen`, retryable and non-retryable `retry`, and load-error outcomes,
  checking view locks, retry affordances, score claims, and trusted-only solution
  display. Browser console/page errors fail the gate.
- Package manifest lists every runtime dependency.
- Built ZIP has `imsmanifest.xml` at its root and excludes tests and temporary
  files.

## Out of scope

- reverse motion or signed negative velocity;
- distinguishing distance from displacement during reversal;
- learner-authored velocity functions;
- free dragging of graph points or tangent lines;
- acceleration calculations or acceleration scoring;
- calculus notation beyond the qualitative shrinking-interval idea;
- numerical differentiation from noisy experimental data;
- multiple vehicles or reference-frame selection;
- collision, lane changing, steering, or driving gameplay;
- sound as required information;
- teacher-authored parameter sets;
- high-risk or server-validated assessment;
- SCORM 2004, xAPI, or attempt-history analytics.
