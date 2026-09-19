(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceOrthogonalDecompositionModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PI2 = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const EPSILON = 1e-8;
  const SNAP_TOUCH_PX = 20;
  const SNAP_POINTER_PX = 14;
  const SNAP_KEYBOARD_PX = 12;
  const SNAP_STICKY_MULTIPLIER = 1.3;
  const THETA_SNAP_RADIUS = 24;
  const DIRECTION_SNAP_DEG = 10;
  const DIRECTION_DUPLICATE_DEG = 12;
  const MIN_DRAW_DISTANCE = 12;
  const THETA_RADIUS = 76;
  const THETA_LABEL_GAP = 26;
  const THETA_ARC_CHORD = 54;
  const THETA_MIN_RADIUS = 44;
  const THETA_MAX_RADIUS = 84;

  // The model uses a small mathematical coordinate system with +y upwards.
  // The view translates it into SVG coordinates only at render time.
  const ORIGIN = Object.freeze({ x: 0, y: 0 });
  const FORCE_HEAD = Object.freeze({ x: 240, y: 160 });
  // In the gravity-on-an-incline scene, place the object up the slope so the
  // body and its mg vector stay central in the stage rather than collecting
  // in the lower-left corner.
  const INCLINED_GRAVITY_ORIGIN = Object.freeze({ x: 106, y: 56 });
  const INCLINED_GRAVITY_FORCE_HEAD = Object.freeze({ x: 106, y: -64 });
  const PHASES = Object.freeze(["directions", "perpendiculars", "components", "angle", "formulas"]);
  const DEFAULT_SCENARIO_ID = "horizontal-vertical";

  function axisData(key, angle, label) {
    return Object.freeze({ key, label, unit: Object.freeze({ x: Math.cos(angle), y: Math.sin(angle) }) });
  }

  const SCENARIOS = Object.freeze({
    "horizontal-vertical": Object.freeze({
      id: "horizontal-vertical",
      title: "水平／垂直分解",
      kind: "free-angle",
      origin: ORIGIN,
      forceHead: FORCE_HEAD,
      forceSymbol: "F",
      axes: Object.freeze([axisData("horizontal", 0, "水平"), axisData("vertical", HALF_PI, "垂直")]),
      plane: null,
      thetaMode: "free"
    }),
    "inclined-external-force": Object.freeze({
      id: "inclined-external-force",
      title: "斜面上的外力 F",
      kind: "inclined-external",
      origin: ORIGIN,
      forceHead: Object.freeze({ x: 150, y: 180 }),
      forceSymbol: "F",
      axes: Object.freeze([axisData("parallel", radians(28), "平行斜面"), axisData("normal", radians(118), "垂直斜面")]),
      plane: Object.freeze({ angle: radians(28), bodyOffset: 22 }),
      thetaMode: "free"
    }),
    "inclined-gravity": Object.freeze({
      id: "inclined-gravity",
      title: "斜面上的重力 mg",
      kind: "inclined-gravity",
      origin: INCLINED_GRAVITY_ORIGIN,
      forceHead: INCLINED_GRAVITY_FORCE_HEAD,
      forceSymbol: "mg",
      axes: Object.freeze([axisData("parallel", radians(28), "沿斜面"), axisData("normal", radians(118), "向內法線")]),
      plane: Object.freeze({ angle: radians(28), bodyOffset: 22 }),
      thetaMode: "given",
      givenTheta: Object.freeze({ key: "theta-incline", description: "O 點：mg 與向內法線分量之間的等角 θ", label: "θ" })
    })
  });

  function getScenario(id = DEFAULT_SCENARIO_ID) {
    return SCENARIOS[id] || null;
  }

  function sceneFor(value) {
    if (value && typeof value === "object" && value.origin && value.forceHead && Array.isArray(value.axes)) return value;
    if (typeof value === "string" && getScenario(value)) return getScenario(value);
    if (value && typeof value === "object" && value.scene) {
      if (typeof value.scene === "object" && value.scene.origin && value.scene.forceHead && Array.isArray(value.scene.axes)) return value.scene;
      if (getScenario(value.scene)) return getScenario(value.scene);
    }
    if (value && typeof value === "object" && value.scenarioId && getScenario(value.scenarioId)) return getScenario(value.scenarioId);
    return getScenario();
  }

  function clonePoint(point) {
    return { x: Number(point.x), y: Number(point.y) };
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function add(first, second) {
    return { x: first.x + second.x, y: first.y + second.y };
  }

  function subtract(first, second) {
    return { x: first.x - second.x, y: first.y - second.y };
  }

  function scale(vector, factor) {
    return { x: vector.x * factor, y: vector.y * factor };
  }

  function dot(first, second) {
    return first.x * second.x + first.y * second.y;
  }

  function cross(first, second) {
    return first.x * second.y - first.y * second.x;
  }

  function distance(first, second) {
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function length(vector) {
    return Math.hypot(vector.x, vector.y);
  }

  function normalize(vector) {
    const magnitude = length(vector);
    return magnitude <= EPSILON ? null : scale(vector, 1 / magnitude);
  }

  function fromAngle(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizeAngle(angle) {
    let result = angle % PI2;
    if (result < 0) result += PI2;
    return result;
  }

  function angleDifference(first, second) {
    let difference = Math.abs(normalizeAngle(first) - normalizeAngle(second));
    if (difference > Math.PI) difference = PI2 - difference;
    return difference;
  }

  function lineAngleDifference(first, second) {
    let difference = Math.abs((first - second) % Math.PI);
    if (difference > HALF_PI) difference = Math.PI - difference;
    return Math.abs(difference);
  }

  function degrees(radians) {
    return radians * 180 / Math.PI;
  }

  function radians(degreesValue) {
    return degreesValue * Math.PI / 180;
  }

  function thetaRadius(startAngle, endAngle, options = {}) {
    if (Number.isFinite(options.radius)) return options.radius;
    const scene = sceneFor(options);
    // The two acute choices in the inclined-force triangle should read as
    // equivalent alternatives.  A shared radius keeps one choice from
    // becoming a visibly oversized arc simply because its angle is narrower.
    if (scene?.id === "inclined-external-force") return 64;
    const span = clamp(Math.abs(endAngle - startAngle), radians(8), Math.PI);
    const chord = options.targetChord ?? THETA_ARC_CHORD;
    return clamp(chord / (2 * Math.sin(span / 2)), THETA_MIN_RADIUS, THETA_MAX_RADIUS);
  }

  function thetaCandidate(entry, options = {}) {
    const midAngle = (entry.startAngle + entry.endAngle) / 2;
    const radius = thetaRadius(entry.startAngle, entry.endAngle, options);
    const scene = sceneFor(options);
    // Keep the θ control next to the actual arc.  A large scene-specific gap
    // made the label look detached from the angle and could put it over F₂.
    const labelGap = scene?.id === "inclined-external-force" ? 18 : THETA_LABEL_GAP;
    const center = add(entry.vertex, scale(fromAngle(midAngle), radius));
    return {
      ...entry,
      label: entry.label || "θ",
      midAngle,
      center,
      labelCenter: add(entry.vertex, scale(fromAngle(midAngle), radius + labelGap)),
      radius
    };
  }

  function thresholdFor(pointerType) {
    if (pointerType === "touch") return SNAP_TOUCH_PX;
    if (pointerType === "keyboard") return SNAP_KEYBOARD_PX;
    return SNAP_POINTER_PX;
  }

  function canonicalLineUnit(vector) {
    const unit = normalize(vector);
    if (!unit) return null;
    if (unit.x < -EPSILON || (Math.abs(unit.x) <= EPSILON && unit.y < 0)) return scale(unit, -1);
    return unit;
  }

  function axisForUnit(unit) {
    if (!unit) return null;
    const horizontal = lineAngleDifference(Math.atan2(unit.y, unit.x), 0);
    const vertical = lineAngleDifference(Math.atan2(unit.y, unit.x), HALF_PI);
    const limit = radians(DIRECTION_SNAP_DEG);
    if (horizontal <= limit && horizontal <= vertical) return "horizontal";
    if (vertical <= limit) return "vertical";
    return null;
  }

  function axisMatchForUnit(unit, scene) {
    const candidates = sceneFor(scene).axes.map((axis) => ({
      axis,
      error: lineAngleDifference(Math.atan2(unit.y, unit.x), Math.atan2(axis.unit.y, axis.unit.x))
    })).sort((first, second) => first.error - second.error);
    const best = candidates[0];
    return best && best.error <= radians(DIRECTION_SNAP_DEG) ? best.axis : null;
  }

  function directionAxisKey(direction, scene) {
    if (!direction) return null;
    const candidate = direction.axisKey || direction.role || direction.axis;
    if (candidate && sceneFor(scene).axes.some((axis) => axis.key === candidate)) return candidate;
    const unit = normalize(direction.unit);
    return unit ? axisMatchForUnit(unit, sceneFor(scene))?.key || null : null;
  }

  function directionFromPointer(pointer, options = {}) {
    const scene = sceneFor(options);
    const vector = subtract(pointer, scene.origin);
    const magnitude = length(vector);
    const minimum = options.minDistance ?? MIN_DRAW_DISTANCE;
    if (magnitude < minimum) return { valid: false, reason: "too-short", point: clonePoint(pointer) };
    const unit = canonicalLineUnit(vector);
    const snappedAxis = scene.id === DEFAULT_SCENARIO_ID && !options.scene
      ? axisForUnit(unit)
      : axisMatchForUnit(unit, scene);
    const axis = snappedAxis?.key || (typeof snappedAxis === "string" ? snappedAxis : null);
    const snappedUnit = snappedAxis
      ? clonePoint(typeof snappedAxis === "string" ? (snappedAxis === "horizontal" ? { x: 1, y: 0 } : { x: 0, y: 1 }) : snappedAxis.unit)
      : unit;
    const result = {
      valid: true,
      point: clonePoint(pointer),
      unit: snappedUnit,
      axis,
      angle: Math.atan2(snappedUnit.y, snappedUnit.x),
      distance: magnitude
    };
    if (scene.id !== DEFAULT_SCENARIO_ID) {
      result.axisKey = axis;
      result.role = axis;
    }
    return result;
  }

  function directionKey(index) {
    return `D${index + 1}`;
  }

  function makeDirection(pointer, index, options = {}) {
    const preview = directionFromPointer(pointer, options);
    if (!preview.valid) return preview;
    const direction = {
      key: directionKey(index),
      unit: clonePoint(preview.unit),
      axis: preview.axis,
      angle: preview.angle
    };
    if (preview.axisKey !== undefined) {
      direction.axisKey = preview.axisKey;
      direction.role = preview.role;
    }
    return {
      valid: true,
      direction,
      preview
    };
  }

  function isDuplicateDirection(candidate, directions, tolerance = radians(DIRECTION_DUPLICATE_DEG)) {
    return directions.some((direction) => lineAngleDifference(
      Math.atan2(candidate.unit.y, candidate.unit.x),
      Math.atan2(direction.unit.y, direction.unit.x)
    ) < tolerance);
  }

  function commitDirection(pointer, directions, options = {}) {
    const next = makeDirection(pointer, directions.length, options);
    if (!next.valid) return { accepted: false, reason: next.reason, directions: clone(directions) };
    if (isDuplicateDirection(next.direction, directions, options.duplicateTolerance ?? radians(DIRECTION_DUPLICATE_DEG))) {
      return { accepted: false, reason: "duplicate", directions: clone(directions), direction: next.direction };
    }
    return { accepted: true, reason: "created", directions: [...clone(directions), next.direction], direction: next.direction };
  }

  function projectionFoot(point, direction, sceneOrOptions) {
    const scene = sceneFor(sceneOrOptions);
    const unit = direction.unit || direction;
    const relative = subtract(point, scene.origin);
    return add(scene.origin, scale(unit, dot(relative, unit)));
  }

  function boundedEndpoint(start, end, bounds) {
    if (!bounds) return clonePoint(end);
    const delta = subtract(end, start);
    let fraction = 1;
    if (delta.x > 0) fraction = Math.min(fraction, (bounds.right - start.x) / delta.x);
    if (delta.x < 0) fraction = Math.min(fraction, (bounds.left - start.x) / delta.x);
    if (delta.y > 0) fraction = Math.min(fraction, (bounds.top - start.y) / delta.y);
    if (delta.y < 0) fraction = Math.min(fraction, (bounds.bottom - start.y) / delta.y);
    return add(start, scale(delta, Math.max(0, fraction)));
  }

  function chooseNormal(vector, direction) {
    const unit = direction.unit || direction;
    const left = { x: -unit.y, y: unit.x };
    return dot(vector, left) >= 0 ? left : scale(left, -1);
  }

  function perpendicularPreview(pointer, directions, options = {}) {
    const scene = sceneFor(options);
    const start = scene.forceHead;
    pointer = boundedEndpoint(start, pointer, options.bounds);
    const vector = subtract(pointer, start);
    const magnitude = length(vector);
    if (magnitude < (options.minDistance ?? 4)) {
      return { valid: false, point: clonePoint(pointer), targetKey: null, directionSnapped: false, reason: "too-short" };
    }

    const angleLimit = options.angleLimit ?? radians(DIRECTION_SNAP_DEG);
    const threshold = options.threshold ?? thresholdFor(options.pointerType);
    const excluded = new Set(options.excludedTargetKeys || []);
    const previousTargetKey = options.previousTargetKey || null;
    const candidates = directions.map((direction) => {
      const normal = chooseNormal(vector, direction);
      const vectorUnit = normalize(vector);
      const angularError = angleDifference(Math.atan2(vectorUnit.y, vectorUnit.x), Math.atan2(normal.y, normal.x));
      const snappedPoint = boundedEndpoint(start, add(start, scale(normal, magnitude)), options.bounds);
      const foot = projectionFoot(scene.forceHead, direction, scene);
      return {
        direction,
        normal,
        angularError,
        snappedPoint,
        foot,
        footDistance: distance(snappedPoint, foot)
      };
    }).filter((candidate) => candidate.angularError <= angleLimit)
      .sort((first, second) => first.angularError - second.angularError || first.footDistance - second.footDistance);

    if (!candidates.length) {
      return { valid: true, point: clonePoint(pointer), targetKey: null, directionSnapped: false, reason: "free" };
    }

    const stickyCandidate = previousTargetKey
      ? candidates.find((candidate) => candidate.direction.key === previousTargetKey && !excluded.has(candidate.direction.key))
      : null;
    const chosen = stickyCandidate && stickyCandidate.footDistance <= threshold * SNAP_STICKY_MULTIPLIER
      ? stickyCandidate
      : candidates[0];
    const canUseTarget = !excluded.has(chosen.direction.key);
    const sticky = previousTargetKey === chosen.direction.key && chosen.footDistance <= threshold * SNAP_STICKY_MULTIPLIER;
    const footVisible = distance(boundedEndpoint(start, chosen.foot, options.bounds), chosen.foot) <= EPSILON;
    const snappedToFoot = canUseTarget && footVisible && (chosen.footDistance <= threshold || sticky);
    return {
      valid: true,
      point: clonePoint(snappedToFoot ? chosen.foot : chosen.snappedPoint),
      targetKey: snappedToFoot ? chosen.direction.key : null,
      directionSnapped: true,
      candidateDirectionKey: chosen.direction.key,
      foot: clonePoint(chosen.foot),
      angularError: chosen.angularError,
      reason: snappedToFoot ? "foot-snap" : "direction-snap"
    };
  }

  function commitPerpendicular(pointer, directions, existing = [], options = {}) {
    const preview = perpendicularPreview(pointer, directions, {
      ...options,
      excludedTargetKeys: existing.map((item) => item.targetKey).filter(Boolean)
    });
    if (!preview.valid) return { accepted: false, reason: preview.reason, perpendiculars: clone(existing), preview };
    const item = {
      key: `P${existing.length + 1}`,
      end: clonePoint(preview.point),
      targetKey: preview.targetKey
    };
    return { accepted: true, reason: "created", perpendiculars: [...clone(existing), item], item, preview };
  }

  function segmentLineIntersection(start, end, direction, sceneOrOptions) {
    const scene = sceneFor(sceneOrOptions);
    const segment = subtract(end, start);
    const lineUnit = direction.unit || direction;
    const denominator = cross(segment, lineUnit);
    if (Math.abs(denominator) <= EPSILON) return null;
    const startToLine = subtract(scene.origin, start);
    const segmentRatio = cross(startToLine, lineUnit) / denominator;
    if (segmentRatio < -EPSILON || segmentRatio > 1 + EPSILON) return null;
    return add(start, scale(segment, clamp(segmentRatio, 0, 1)));
  }

  function intersectionKey(perpendicular, direction) {
    return `${perpendicular.key}:${direction.key}`;
  }

  function visibleIntersections(perpendiculars, directions, sceneOrOptions) {
    const scene = sceneFor(sceneOrOptions);
    const intersections = [];
    for (const perpendicular of perpendiculars) {
      for (const direction of directions) {
        const point = segmentLineIntersection(scene.forceHead, perpendicular.end, direction, scene);
        if (point) intersections.push({ key: intersectionKey(perpendicular, direction), point, perpendicularKey: perpendicular.key, directionKey: direction.key });
      }
    }
    return intersections;
  }

  function previewComponent(pointer, perpendiculars, directions, options = {}) {
    const scene = sceneFor(options);
    pointer = boundedEndpoint(scene.origin, pointer, options.bounds);
    const minimum = options.minDistance ?? MIN_DRAW_DISTANCE;
    if (distance(pointer, scene.origin) < minimum) {
      return { valid: false, point: clonePoint(pointer), targetKey: null, reason: "too-short", candidates: [] };
    }
    const threshold = options.threshold ?? thresholdFor(options.pointerType);
    const excluded = new Set(options.excludedTargetKeys || []);
    const previousTargetKey = options.previousTargetKey || null;
    const candidates = visibleIntersections(perpendiculars, directions, scene)
      .filter(candidate => distance(boundedEndpoint(scene.origin, candidate.point, options.bounds), candidate.point) <= EPSILON)
      .filter((candidate) => !excluded.has(candidate.key))
      .map((candidate) => ({ ...candidate, distance: distance(pointer, candidate.point) }))
      .sort((first, second) => first.distance - second.distance);
    const stickyCandidate = previousTargetKey
      ? candidates.find((candidate) => candidate.key === previousTargetKey && candidate.distance <= threshold * SNAP_STICKY_MULTIPLIER)
      : null;
    const closest = stickyCandidate || candidates[0];
    if (!closest) return { valid: true, point: clonePoint(pointer), targetKey: null, reason: "free", candidates: [] };
    const sticky = previousTargetKey === closest.key && closest.distance <= threshold * SNAP_STICKY_MULTIPLIER;
    if (closest.distance <= threshold || sticky) {
      return { valid: true, point: clonePoint(closest.point), targetKey: closest.key, reason: "intersection-snap", candidates };
    }
    return { valid: true, point: clonePoint(pointer), targetKey: null, reason: "free", candidates };
  }

  function commitComponent(pointer, perpendiculars, directions, existing = [], options = {}) {
    const preview = previewComponent(pointer, perpendiculars, directions, {
      ...options,
      excludedTargetKeys: existing.map((item) => item.targetKey).filter(Boolean)
    });
    if (!preview.valid) return { accepted: false, reason: preview.reason, components: clone(existing), preview };
    const item = {
      key: `F${existing.length + 1}`,
      end: clonePoint(preview.point),
      targetKey: preview.targetKey
    };
    return { accepted: true, reason: "created", components: [...clone(existing), item], item, preview };
  }

  function editGeometry(state, kind, index, pointer, options = {}) {
    const scene = sceneFor(options.scene || state);
    const collection = { direction: "directions", perpendicular: "perpendiculars", component: "components" }[kind];
    const original = state[collection]?.[index];
    if (!original) return { valid: false, reason: "missing" };
    const others = state[collection].filter((_, itemIndex) => itemIndex !== index);
    const editOptions = { ...options, scene, excludedTargetKeys: others.map(item => item.targetKey).filter(Boolean) };
    const preview = kind === "direction" ? makeDirection(pointer, index, editOptions)
      : kind === "perpendicular" ? perpendicularPreview(pointer, state.directions, editOptions)
        : previewComponent(pointer, state.perpendiculars, state.directions, editOptions);
    if (!preview.valid) return preview;
    if (kind === "direction" && isDuplicateDirection(preview.direction, others)) return { valid: false, reason: "duplicate" };
    const next = clone(state);
    next[collection][index] = kind === "direction"
      ? { ...preview.direction, key: original.key }
      : { ...original, end: clonePoint(preview.point), targetKey: preview.targetKey };

    // Keep every other line where the learner placed it. Only refresh links to
    // geometric intersections; an upstream edit must not erase their work.
    for (const line of next.perpendiculars) {
      const direction = perpendicularDirection(line, next.directions, scene);
      line.targetKey = direction && distance(line.end, projectionFoot(scene.forceHead, direction, scene)) <= 1e-5 ? direction.key : null;
    }
    const intersections = visibleIntersections(next.perpendiculars, next.directions, scene);
    for (const component of next.components) {
      const matches = intersections.filter(target => distance(component.end, target.point) <= 1e-5);
      component.targetKey = (matches.find(target => target.key === component.targetKey) || matches[0])?.key || null;
    }
    if (!isCorrectDecomposition(next)) next.theta = null;
    return { ...preview, editedState: next };
  }

  function thetaCandidates(directions, options = {}) {
    const scene = sceneFor(options);
    if (scene.thetaMode === "given") {
      const forceAngle = Math.atan2(scene.forceHead.y - scene.origin.y, scene.forceHead.x - scene.origin.x);
      const normalAxis = scene.axes.find(axis => axis.key === "normal") || scene.axes[1];
      const normalFoot = projectionFoot(scene.forceHead, normalAxis, scene);
      let normalAngle = Math.atan2(normalFoot.y - scene.origin.y, normalFoot.x - scene.origin.x);
      let endAngle = normalAngle;
      while (endAngle < forceAngle) endAngle += PI2;
      while (endAngle - forceAngle > Math.PI) endAngle -= PI2;
      const angle = endAngle - forceAngle;
      return [thetaCandidate({
        key: scene.givenTheta.key,
        vertex: scene.origin,
        description: scene.givenTheta.description,
        label: scene.givenTheta.label,
        startAngle: forceAngle,
        endAngle,
        given: true,
        adjacentAxisKey: "normal",
        decompositionAngle: angle
      }, { ...options, radius: options.radius ?? 64 })];
    }
    if (scene.id !== DEFAULT_SCENARIO_ID) {
      const first = scene.axes[0];
      const second = scene.axes[1];
      const firstAngle = Math.atan2(first.unit.y, first.unit.x);
      const forceAngle = Math.atan2(scene.forceHead.y - scene.origin.y, scene.forceHead.x - scene.origin.x);
      let unwrappedForce = forceAngle;
      while (unwrappedForce < firstAngle) unwrappedForce += PI2;
      while (unwrappedForce > firstAngle + PI2) unwrappedForce -= PI2;
      const secondAngle = firstAngle + HALF_PI;
      if (unwrappedForce < firstAngle || unwrappedForce > secondAngle) return [];
      const entries = [
        { key: "theta-parallel", vertex: scene.origin, startAngle: firstAngle, endAngle: unwrappedForce, description: `O 點：原力與${first.label}之間`, adjacentAxisKey: first.key },
        { key: "theta-normal", vertex: scene.origin, startAngle: unwrappedForce, endAngle: secondAngle, description: `O 點：原力與${second.label}之間`, adjacentAxisKey: second.key },
        { key: "theta-head-parallel", vertex: scene.forceHead, startAngle: firstAngle + Math.PI, endAngle: unwrappedForce + Math.PI, description: `P 點：原力與${first.label}之間`, adjacentAxisKey: first.key },
        { key: "theta-head-normal", vertex: scene.forceHead, startAngle: unwrappedForce + Math.PI, endAngle: secondAngle + Math.PI, description: `P 點：原力與${second.label}之間`, adjacentAxisKey: second.key }
      ];
      return entries.map((entry) => thetaCandidate({ ...entry, label: "θ" }, options));
    }
    const horizontal = directions.find((direction) => directionAxisKey(direction, scene) === "horizontal");
    const vertical = directions.find((direction) => directionAxisKey(direction, scene) === "vertical");
    if (!horizontal || !vertical) return [];
    const forceAngle = Math.atan2(FORCE_HEAD.y, FORCE_HEAD.x);
    return [
      thetaCandidate({
        key: "theta-horizontal",
        vertex: ORIGIN,
        description: "O 點：原力與水平分力之間",
        label: "θ",
        startAngle: 0,
        endAngle: forceAngle,
        adjacentAxisKey: "horizontal"
      }, options),
      thetaCandidate({
        key: "theta-vertical",
        vertex: ORIGIN,
        description: "O 點：原力與垂直分力之間",
        label: "θ",
        startAngle: forceAngle,
        endAngle: HALF_PI,
        adjacentAxisKey: "vertical"
      }, options),
      thetaCandidate({
        key: "theta-head-horizontal",
        vertex: FORCE_HEAD,
        description: "P 點：原力與水平虛線之間",
        label: "θ",
        startAngle: Math.PI,
        endAngle: Math.PI + forceAngle,
        adjacentAxisKey: "horizontal"
      }, options),
      thetaCandidate({
        key: "theta-head-vertical",
        vertex: FORCE_HEAD,
        description: "P 點：原力與垂直虛線之間",
        label: "θ",
        startAngle: Math.PI + forceAngle,
        endAngle: Math.PI * 1.5,
        adjacentAxisKey: "vertical"
      }, options)
    ];
  }

  function angleInSector(angle, startAngle, endAngle) {
    let value = normalizeAngle(angle);
    let start = normalizeAngle(startAngle);
    const span = endAngle - startAngle;
    while (value < start) value += PI2;
    while (start + span > PI2 && value < start + span - PI2) value += PI2;
    return value >= start - EPSILON && value <= start + span + EPSILON;
  }

  function thetaCandidateAt(pointer, directions, options = {}) {
    const threshold = options.threshold ?? THETA_SNAP_RADIUS;
    const previousTargetKey = options.previousTargetKey || null;
    const candidates = thetaCandidates(directions, options)
      .filter((candidate) => angleInSector(Math.atan2(pointer.y - candidate.vertex.y, pointer.x - candidate.vertex.x), candidate.startAngle, candidate.endAngle))
      .map((candidate) => ({ ...candidate, distance: distance(pointer, candidate.center) }))
      .sort((first, second) => first.distance - second.distance);
    const stickyCandidate = previousTargetKey
      ? candidates.find((candidate) => candidate.key === previousTargetKey && candidate.distance <= threshold * SNAP_STICKY_MULTIPLIER)
      : null;
    const closest = stickyCandidate || candidates[0];
    if (!closest || (closest.distance > threshold && !stickyCandidate)) return null;
    return closest;
  }

  function lineSegmentForDirection(direction, bounds, sceneOrOptions) {
    const scene = sceneFor(sceneOrOptions);
    const actualBounds = bounds;
    const unit = direction.unit || direction;
    const values = [];
    let minimum = -Infinity;
    let maximum = Infinity;
    const origin = scene.origin;
    const clippingBounds = actualBounds || bounds;
    for (const [coordinate, component] of [["x", unit.x], ["y", unit.y]]) {
      const low = clippingBounds[coordinate === "x" ? "left" : "bottom"];
      const high = clippingBounds[coordinate === "x" ? "right" : "top"];
      if (Math.abs(component) <= EPSILON) {
        if (origin[coordinate] < low || origin[coordinate] > high) return null;
        continue;
      }
      const first = (low - origin[coordinate]) / component;
      const second = (high - origin[coordinate]) / component;
      minimum = Math.max(minimum, Math.min(first, second));
      maximum = Math.min(maximum, Math.max(first, second));
    }
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) return null;
    values.push(add(origin, scale(unit, minimum)), add(origin, scale(unit, maximum)));
    return values;
  }

  function componentTargetPoint(component, perpendiculars, directions, sceneOrOptions) {
    if (!component?.targetKey) return null;
    const target = visibleIntersections(perpendiculars, directions, sceneOrOptions || component?.sceneId).find((item) => item.key === component.targetKey);
    return target ? clonePoint(target.point) : null;
  }

  function createState(scenarioId) {
    const state = {
      phase: "directions",
      directions: [],
      perpendiculars: [],
      components: [],
      theta: null,
      formulas: { F1: null, F2: null }
    };
    if (scenarioId && scenarioId !== DEFAULT_SCENARIO_ID) state.scenarioId = scenarioId;
    return state;
  }

  function createQuestionState(scenarioId = DEFAULT_SCENARIO_ID) {
    return { ...createState(scenarioId), scenarioId };
  }

  function clearAfter(state, phase) {
    const next = clone(state);
    const index = PHASES.indexOf(phase);
    if (index < 0) return next;
    if (index < 1) next.perpendiculars = [];
    if (index < 2) next.components = [];
    if (index < 3) next.theta = null;
    next.formulas = { F1: null, F2: null };
    return next;
  }

  function resetCurrentPhase(state) {
    const next = clearAfter(state, state.phase);
    if (state.phase === "directions") next.directions = [];
    if (state.phase === "perpendiculars") next.perpendiculars = [];
    if (state.phase === "components") next.components = [];
    if (state.phase === "angle") next.theta = null;
    return next;
  }

  function backToPrevious(state) {
    const index = PHASES.indexOf(state.phase);
    if (index <= 0) return clone(state);
    const previous = PHASES[index - 1];
    const next = clone(state);
    next.phase = previous;
    return next;
  }

  function canAdvance(state) {
    if (state.phase === "directions") return state.directions.length >= 2;
    if (state.phase === "perpendiculars") return state.perpendiculars.length >= 2;
    if (state.phase === "components") return state.components.length >= 2;
    if (state.phase === "angle") return Boolean(formulaExpectations(state));
    return false;
  }

  function advance(state) {
    if (!canAdvance(state)) return clone(state);
    const index = PHASES.indexOf(state.phase);
    return { ...clone(state), phase: PHASES[index + 1] };
  }

  function perpendicularDirection(perpendicular, directions, sceneOrOptions) {
    const scene = sceneFor(sceneOrOptions);
    const segment = subtract(perpendicular.end, scene.forceHead);
    const unit = normalize(segment);
    if (!unit) return null;
    return directions.find(direction => {
      if (Math.abs(dot(unit, direction.unit)) > EPSILON) return false;
      const intersection = segmentLineIntersection(scene.forceHead, perpendicular.end, direction, scene);
      return intersection && distance(intersection, projectionFoot(scene.forceHead, direction, scene)) <= 1e-5;
    }) || null;
  }

  function isCorrectDecomposition(state) {
    if (!state || state.directions?.length !== 2 || state.perpendiculars?.length !== 2 || state.components?.length !== 2) return false;
    const scene = sceneFor(state);
    const directionKeys = state.directions.map((direction) => directionAxisKey(direction, scene));
    if (directionKeys.some((key) => !key) || new Set(directionKeys).size !== 2 ||
        scene.axes.some((axis) => !directionKeys.includes(axis.key))) return false;

    const crossedDirections = state.perpendiculars.map(item => perpendicularDirection(item, state.directions, scene));
    if (crossedDirections.some(direction => !direction) || new Set(crossedDirections.map(direction => direction.key)).size !== 2) return false;

    const visible = visibleIntersections(state.perpendiculars, state.directions, scene);
    const componentKeys = state.components.map((item) => item.targetKey);
    if (componentKeys.some((key) => !key) || new Set(componentKeys).size !== 2) return false;
    const targets = state.components.map(component => visible.find(target => target.key === component.targetKey && distance(component.end, target.point) <= 1e-5));
    return targets.every(Boolean) && new Set(targets.map(target => target.directionKey)).size === 2;
  }

  function arrowPathData(start, end, options = {}) {
    const vector = subtract(end, start);
    const magnitude = length(vector);
    if (magnitude <= EPSILON) return "";
    const unit = scale(vector, 1 / magnitude);
    const normal = { x: -unit.y, y: unit.x };
    const headLength = Math.min(options.headLength ?? 22, magnitude * 0.46);
    const headWidth = Math.min(options.headWidth ?? 20, magnitude * 0.62);
    const shaftWidth = Math.min(options.shaftWidth ?? 5, magnitude * 0.24);
    const base = subtract(end, scale(unit, headLength));
    const shaftLeft = add(start, scale(normal, shaftWidth / 2));
    const shaftRight = subtract(start, scale(normal, shaftWidth / 2));
    const baseLeft = add(base, scale(normal, shaftWidth / 2));
    const baseRight = subtract(base, scale(normal, shaftWidth / 2));
    const headLeft = add(base, scale(normal, headWidth / 2));
    const headRight = subtract(base, scale(normal, headWidth / 2));
    const point = (value) => `${value.x.toFixed(3)},${value.y.toFixed(3)}`;
    return `M ${point(shaftLeft)} L ${point(baseLeft)} L ${point(headLeft)} L ${point(end)} L ${point(headRight)} L ${point(baseRight)} L ${point(shaftRight)} Z`;
  }

  function formulaExpectations(state) {
    if (!isCorrectDecomposition(state)) return null;
    const scene = sceneFor(state);
    const angle = thetaCandidates(state.directions, scene).find(item => item.key === state.theta);
    if (!angle) return null;
    const horizontalAngle = state.theta === "theta-horizontal" || state.theta === "theta-head-horizontal";
    return state.components.map(component => {
      const target = visibleIntersections(state.perpendiculars, state.directions, scene).find(item => item.key === component.targetKey);
      const direction = target && state.directions.find(item => item.key === target.directionKey);
      const axisKey = directionAxisKey(direction, scene);
      if (scene.thetaMode === "given") {
        const parallel = axisKey === "parallel";
        return { key: component.key, axis: axisKey, relation: parallel ? "opposite" : "adjacent", value: parallel ? "sin" : "cos", atHead: false };
      }
      if (scene.id === DEFAULT_SCENARIO_ID && !state.scenarioId) {
        const horizontal = axisKey === "horizontal";
        const adjacent = horizontal === horizontalAngle;
        return { key: component.key, axis: horizontal ? "horizontal" : "vertical", relation: adjacent ? "adjacent" : "opposite", value: adjacent ? "cos" : "sin", atHead: angle.vertex === FORCE_HEAD };
      }
      const adjacent = axisKey === angle.adjacentAxisKey;
      return { key: component.key, axis: axisKey, relation: adjacent ? "adjacent" : "opposite", value: adjacent ? "cos" : "sin", atHead: angle.vertex === scene.forceHead };
    });
  }

  function setFormula(state, key, value) {
    if (state.phase !== "formulas" || !formulaExpectations(state) || !["F1", "F2"].includes(key) || ![null, "sin", "cos"].includes(value)) return clone(state);
    return { ...clone(state), formulas: { ...state.formulas, [key]: value } };
  }

  function checkFormulas(state) {
    const expected = formulaExpectations(state);
    if (!expected) return { status: "unavailable", items: [] };
    const items = expected.map(item => ({ ...item, status: !state.formulas?.[item.key] ? "missing" : state.formulas[item.key] === item.value ? "correct" : "incorrect" }));
    return { status: items.every(item => item.status === "correct") ? "correct" : items.some(item => item.status === "missing") ? "incomplete" : "incorrect", items };
  }

  return Object.freeze({
    EPSILON,
    SNAP_TOUCH_PX,
    SNAP_POINTER_PX,
    SNAP_KEYBOARD_PX,
    SNAP_STICKY_MULTIPLIER,
    DIRECTION_SNAP_DEG,
    DIRECTION_DUPLICATE_DEG,
    MIN_DRAW_DISTANCE,
    THETA_RADIUS,
    THETA_SNAP_RADIUS,
    ORIGIN,
    FORCE_HEAD,
    PHASES,
    DEFAULT_SCENARIO_ID,
    SCENARIOS,
    getScenario,
    createQuestionState,
    directionAxisKey,
    formulaExpectations,
    setFormula,
    checkFormulas,
    add,
    subtract,
    scale,
    dot,
    cross,
    distance,
    length,
    normalize,
    fromAngle,
    clamp,
    normalizeAngle,
    angleDifference,
    lineAngleDifference,
    degrees,
    radians,
    thresholdFor,
    directionFromPointer,
    directionKey,
    makeDirection,
    isDuplicateDirection,
    commitDirection,
    projectionFoot,
    boundedEndpoint,
    chooseNormal,
    perpendicularPreview,
    commitPerpendicular,
    segmentLineIntersection,
    intersectionKey,
    visibleIntersections,
    previewComponent,
    commitComponent,
    editGeometry,
    thetaCandidates,
    thetaCandidateAt,
    lineSegmentForDirection,
    componentTargetPoint,
    createState,
    clearAfter,
    resetCurrentPhase,
    backToPrevious,
    canAdvance,
    advance,
    isCorrectDecomposition,
    perpendicularDirection,
    arrowPathData,
    clone
  });
});
