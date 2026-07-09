# Displacement and Distance Map Journey Plan

## Purpose

Build a SCORM activity named `displacement-distance-map-journey`.

Students move a person through a random town map to compare:

- route distance and displacement for each journey segment;
- total route distance and total displacement for a two-segment journey;
- direction descriptions measured from north or south.

Visible learner-facing text should use Traditional Chinese.

## Simulation metadata

- Title: `路程、位移與總位移地圖任務`
- Folder slug: `displacement-distance-map-journey`
- Categories: `["Mechanics"]`
- Hub description: `在隨機地圖中拖曳小人行走，量度路程，畫出分段位移和總位移。`
- Tags: `["physics", "mechanics", "displacement", "distance", "vectors", "scorm"]`
- Runtime files:

```text
sim/displacement-distance-map-journey/
  index.html
  styles.css
  main.js
  scoring.js
  scoring.test.js
sim/config.js
sim/manifests/displacement-distance-map-journey.xml
```

Use existing shared files:

```text
sim/shared/styles.css
sim/shared/scorm.js
```

No third-party library is needed. Use SVG for the map, road hit areas, draggable
person, and displacement arrows.

## Student task

Each attempt creates one random map with five labelled places, for example:

- 學校
- 超市
- 銀行
- 公園
- 圖書館

The learner starts at one randomly selected place. The activity then randomly
selects two more distinct places as the required destinations.

Example task:

```text
由學校出發，先到銀行，再到公園。
```

The learner must:

1. drag the person along roads from the start place to the second place;
2. observe the route distance accumulating during the drag;
3. draw the displacement vector for that segment;
4. answer the segment route distance, displacement magnitude, and direction;
5. repeat the same actions from the second place to the third place;
6. draw the total displacement vector from the first place to the third place;
7. answer the total route distance, total displacement magnitude, and direction.

If the learner drags back and forth along the roads, the route distance keeps
increasing. The correct route-distance answer is the distance actually travelled
in that submitted attempt, not the shortest road path.

## Random map generation

Generate a deterministic random map from a saved seed so the same attempt can be
reviewed later.

Map layout:

- one SVG map area with a light grid;
- five labelled place rectangles with different sizes;
- several unlabelled neutral rectangles representing other buildings or blocks;
- random road corridors between rectangles;
- all five labelled places must be reachable through the road graph;
- the compass must have a reserved top-right clear zone where roads and
  buildings are not generated.

Suggested generation flow:

1. Create a connected road graph on a coarse grid.
   - Use horizontal and vertical road segments.
   - Start with a random spanning tree so all five place anchors are connected.
   - Add a few extra road segments to create alternate routes.

2. Place five destination rectangles next to road nodes or road segments.
   - Rectangles may have different width and height.
   - Each place has one visible position point on the road graph.
   - The position point is also the road entrance for the first version.
   - Places must not overlap each other.
   - Do not add numeric badges to the place rectangles.

3. Add unlabelled rectangles.
   - They are visual map blocks only.
   - They do not count as places.
   - They must not cover road entrances or make the graph disconnected.

4. Reject and regenerate the seed when:
   - any labelled place is unreachable from the other labelled places;
   - two labelled places overlap;
   - a destination rectangle is too close to another destination;
   - the selected journey has a near-zero displacement segment.

Distances should use map metres. Keep one scale constant, for example:

```text
1 SVG grid unit = 5 m
```

The exact pixel-to-metre scale should live in one constant in `main.js`.

## Interaction design

Use the shared split-pane layout.

Canvas/SVG region:

- map, roads, labelled places, neutral rectangles;
- draggable person marker;
- live route trace for the current segment, styled more subtly than the
  displacement vectors;
- displacement arrow drawing layer;
- compact compass indicator showing north and south in its reserved clear zone;
- current direction readout for the arrow being drawn.

Control panel:

- task route, such as `學校 → 銀行 → 公園`;
- current segment status;
- current segment route distance;
- total route distance;
- instructions for the next required action;
- submit/continue buttons;
- final feedback after submission.

Dragging rules:

- the person can move only on road corridors;
- pointer movement is projected onto the nearest valid road position;
- pointer movement that is too far from a road is ignored;
- changing from one road segment to another is accepted only near a junction, so
  dragging straight across the map must not create an automatic shortest-path
  route trace;
- distance added for each movement is the road-graph distance from the previous
  valid road position to the new valid road position;
- reversing direction still adds distance;
- reaching a destination means entering its position-point zone or place hit zone;
- once the required destination is reached, lock the person until the learner
  completes that segment's displacement arrow and answer.

Displacement drawing:

- for a segment, the arrow tail is fixed at the segment start place position point;
- the learner drags the arrow head to show the segment displacement;
- for total displacement, the arrow tail is fixed at the original start place
  position point;
- the learner drags the arrow head to show the final place displacement;
- when the arrow head is close to the correct destination, it snaps to that
  destination point;
- the answer button is enabled only after the arrow has snapped to the correct
  destination point;
- the drawn arrow is a required action and visual check, not a scoring component;
- while drawing, show the learner's arrow magnitude and direction.

Direction format:

- if the vector points mainly north, show direction from north:
  `北偏東 30°` or `北偏西 30°`;
- if the vector points mainly south, show direction from south:
  `南偏東 30°` or `南偏西 30°`;
- if the vector is due north, east, south, or west, display the simpler
  `向北`, `向東`, `向南`, or `向西` instead of forcing an angle.

This satisfies cases where the displacement points south: the readout should use
the angle with south instead of forcing a north reference.

## Physics and maths model

Use a 2D coordinate system in metres.

For each segment:

```text
route distance = accumulated road distance travelled by the person
displacement vector = destination position point - segment start position point
displacement magnitude = Euclidean length of the displacement vector
direction = bearing of the displacement vector
```

For the full task:

```text
total route distance = segment 1 route distance + segment 2 route distance
total displacement vector = final destination position point - original start position point
total displacement magnitude = Euclidean length of total displacement vector
```

Bearing convention:

- north is `0deg`;
- east is `90deg`;
- south is `180deg`;
- west is `270deg`;
- learner answer controls use one direction-format choice such as `向東`,
  `北偏東`, or `南偏西`; only non-cardinal choices require an acute angle;
- scoring should convert both the correct answer and the learner answer to a
  bearing, then compare angular difference.

## Answer flow

Segment 1 modal:

- show a compact readout above the questions:
  - distance the person has walked;
  - straight-line distance between the two place position points;
  - direction from the start place to the destination place;
- ask three multiple-choice questions for route distance, displacement
  magnitude, and displacement direction.

Segment 2 modal:

- route distance travelled from place 2 to place 3;
- displacement magnitude from place 2 to place 3;
- displacement direction using the same controls.

Final modal:

- show a compact readout above the questions:
  - distance the person walked in segment 1;
  - distance the person walked in segment 2;
  - total distance the person walked;
  - straight-line distance from place 1 to place 3;
  - direction from place 1 to place 3;
- ask three multiple-choice questions for total route distance, total
  displacement magnitude, and total displacement direction.

All distance options use metres. Direction options are four arrow icons spaced
90 degrees apart; the text direction is used for scoring and accessibility, not
as the visible answer.

Question text must clearly distinguish:

- route distance: the distance travelled along roads;
- displacement magnitude: the straight-line distance from start to destination;
- displacement direction: a cardinal direction such as `向東`, or a reference
  direction such as `南偏東` plus an acute angle.

Answer choices must start unselected. Do not preselect a default answer or derive
hidden selected values from the learner's drawn arrow.

## Scoring

Total: 100.

Passing threshold: 60.

Components:

- Segment 1 answers: 30 points.
  - 10 points for route distance.
  - 10 points for displacement magnitude.
  - 10 points for displacement direction.

- Segment 2 answers: 30 points.
  - 10 points for route distance.
  - 10 points for displacement magnitude.
  - 10 points for displacement direction.

- Final total answers: 40 points.
  - 14 points for total route distance.
  - 13 points for total displacement magnitude.
  - 13 points for total displacement direction.

Penalties and caps:

- Clamp final score to `0..100`.
- Missing an answer earns zero for that answer component.
- Displacement arrows are required before the answer modal opens, but they do not
  add or remove score after snapping.
- A route-distance answer is judged against the learner's actual accumulated
  distance, so wandering does not create an automatic penalty.
- If the learner somehow submits without an answer group, that answer group earns
  zero.

## Tolerance

Easy-to-change constants in `scoring.js`:

- `DISTANCE_ABSOLUTE_TOLERANCE_M`
- `DISTANCE_RELATIVE_TOLERANCE`
- `ANGLE_TOLERANCE_DEG`
- `ARROW_HEAD_TOLERANCE_M`
- `DESTINATION_REACH_TOLERANCE_M`
- `PASSING_SCORE`

Suggested starting values:

- route distance answer tolerance: within `max(1 m, 3%)`;
- displacement magnitude answer tolerance: within `max(1 m, 3%)`;
- drawn arrow head tolerance: within `2 m` of the correct destination position point;
- arrow snap tolerance: same value as drawn arrow head tolerance;
- direction tolerance: within `8deg`;
- destination reach tolerance: `2 m` around the place position point or hit zone.

Borderline examples:

- an actual route distance of `85 m` accepts `83 m` to `88 m`;
- a displacement magnitude of `40 m` accepts `39 m` to `41 m`;
- a direction `南偏東 25°` accepts bearings within `8deg`;
- `南偏西 25°` for a southeast displacement earns no direction credit.

## SCORM behavior

On final submission:

- calculate the final score;
- show score and feedback in the page;
- submit `0..100` score through `sim/shared/scorm.js`;
- mark `passed` when score is at least 60, otherwise `failed`;
- call commit and finish immediately;
- lock the submitted attempt for review.

Store compact review data in `cmi.suspend_data`:

- random seed;
- selected route place IDs;
- segment route distances;
- learner displacement arrows;
- learner numeric answers;
- score and feedback.

Do not store screenshots or full high-frequency drag samples. If a route trace
is useful for review, store a simplified polyline with a strict point cap.

## Feedback

Feedback should identify the physics idea, not just the score:

- route distance depends on the actual path;
- displacement depends only on start and end positions;
- total route distance is the sum of travelled distances;
- total displacement is from the first place directly to the last place;
- direction may be described from north or south depending on the vector.

## Acceptance checks

- Opens directly in Live Server.
- Uses five labelled places in every attempt.
- Random start, second place, and third place are distinct.
- Random roads always connect all labelled places.
- Compass area stays clear of generated roads and buildings.
- Compass north/south text spacing is visually balanced around the arrow.
- Includes unlabelled rectangles that are not valid destinations.
- Dragging back and forth increases route distance.
- Person cannot leave the road network during normal dragging.
- Dragging directly across the map toward a destination does not create an
  automatic road trace or route distance.
- Answer modals show the measured values above the questions.
- Answer modals use touch-friendly choices instead of numeric text input.
- Answer modals do not preselect answer values.
- Segment displacement can point north, south, east, or west.
- A southward vector displays angle from south.
- Student can complete the task without keyboard input.
- Works on a phone-width viewport.
- Submit produces a score from 0 to 100.
- Scoring self-check covers:
  - perfect answer;
  - extra wandering route distance;
  - wrong displacement magnitude;
  - wrong north/south direction reference;
  - southward displacement;
  - missing second segment;
  - wrong total displacement.
- Local SCORM fallback works without Moodle.
- SCORM package contains `imsmanifest.xml` at the ZIP root.
- Re-entering a submitted attempt is review-only.

## Out of scope

- teacher map authoring;
- storing every drag sample as analytics;
- shortest-path hints;
- SCORM 2004;
- xAPI/LRS tracking.
