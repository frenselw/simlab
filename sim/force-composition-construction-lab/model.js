(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./generator.js") : root.ForceCompositionGenerator);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceCompositionModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator) {
  "use strict";

  if (!Generator) throw new Error("ForceCompositionGenerator is required");

  const SNAP_TOUCH_PX = 20;
  const SNAP_POINTER_PX = 14;
  const SNAP_KEYBOARD_PX = 12;
  const MODEL_EPSILON = 0.01;
  const POSITION_QUANTUM = 0.1;
  const MODEL_VISUAL_INSET = 34;
  const FREE_LINE_INSET = 24;
  const ORIGIN_KEY = "ORIGIN";
  const PARALLEL_SNAP_ANGLE_DEG = 10;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function forceKey(index) {
    return `F${index + 1}`;
  }

  function forceIndex(key) {
    const match = /^F([1-3])$/.exec(key || "");
    return match ? Number(match[1]) - 1 : -1;
  }

  function headKey(index) {
    return `${forceKey(index)}_HEAD`;
  }

  function tailKey(index) {
    return `${forceKey(index)}_TAIL`;
  }

  function targetForceIndex(targetKey) {
    const match = /^F([1-3])_HEAD$/.exec(targetKey || "");
    return match ? Number(match[1]) - 1 : -1;
  }

  function quantize(value) {
    return Math.round(value / POSITION_QUANTUM) * POSITION_QUANTUM;
  }

  function point10(point) {
    return [Math.round(point.x * 10), Math.round(point.y * 10)];
  }

  function fromPoint10(value) {
    return { x: value[0] / 10, y: value[1] / 10 };
  }

  function validPoint10(value) {
    return Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
  }

  function add(point, vector) {
    return { x: point.x + vector.dx, y: point.y + vector.dy };
  }

  function sumForces(forces) {
    return forces.reduce((total, force) => ({ dx: total.dx + force.dx, dy: total.dy + force.dy }), { dx: 0, dy: 0 });
  }

  function distance(first, second) {
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function threshold(pointerType) {
    return pointerType === "touch" ? SNAP_TOUCH_PX : pointerType === "keyboard" ? SNAP_KEYBOARD_PX : SNAP_POINTER_PX;
  }

  function projectIdentity(point) {
    return point;
  }

  function selectSnapCandidate(candidate, targets, options = {}) {
    const project = options.project || projectIdentity;
    const limit = options.threshold ?? threshold(options.pointerType);
    const candidateScreen = project(candidate);
    return targets
      .map((target) => ({ ...target, distance: distance(candidateScreen, project(target.point)) }))
      .filter((target) => target.distance <= limit)
      .sort((first, second) => first.distance - second.distance || String(first.key).localeCompare(String(second.key)))[0] || null;
  }

  function clampForceTail(point, force) {
    const minX = MODEL_VISUAL_INSET - Math.min(0, force.dx);
    const maxX = Generator.WIDTH - MODEL_VISUAL_INSET - Math.max(0, force.dx);
    const minY = MODEL_VISUAL_INSET - Math.min(0, force.dy);
    const maxY = Generator.HEIGHT - MODEL_VISUAL_INSET - Math.max(0, force.dy);
    return {
      x: quantize(Math.max(minX, Math.min(maxX, point.x))),
      y: quantize(Math.max(minY, Math.min(maxY, point.y)))
    };
  }

  function clampLinePoint(point) {
    return {
      x: quantize(Math.max(FREE_LINE_INSET, Math.min(Generator.WIDTH - FREE_LINE_INSET, point.x))),
      y: quantize(Math.max(FREE_LINE_INSET, Math.min(Generator.HEIGHT - FREE_LINE_INSET, point.y)))
    };
  }

  function freshAnswer(question) {
    if (question.type === "parallelogram") {
      return { type: question.type, anchor10: null, placements: [{ mode: "initial" }, { mode: "initial" }], guides: [null, null], resultant: null };
    }
    return { type: question.type, anchor10: null, placements: question.forces.map(() => ({ mode: "initial" })), resultant: null };
  }

  function freshAnswers(scenario) {
    return scenario.questions.map(freshAnswer);
  }

  function resolveTails(answer, question) {
    const tails = new Array(question.forces.length);
    const resolving = new Set();
    function resolve(index) {
      if (tails[index]) return tails[index];
      if (resolving.has(index)) throw new Error("Cyclic force placement");
      resolving.add(index);
      const placement = answer.placements[index];
      let tail;
      if (placement.mode === "initial") tail = { ...question.initialTails[index] };
      else if (placement.mode === "free") tail = fromPoint10(placement.tail10);
      else if (placement.mode === "snap" && placement.targetKey === ORIGIN_KEY) tail = anchorPoint(answer);
      else if (placement.mode === "snap") {
        const parent = targetForceIndex(placement.targetKey);
        if (parent < 0 || parent >= question.forces.length || parent === index) throw new Error("Invalid force placement relationship");
        tail = add(resolve(parent), question.forces[parent]);
      } else throw new Error("Invalid force placement mode");
      resolving.delete(index);
      tails[index] = tail;
      return tail;
    }
    for (let index = 0; index < question.forces.length; index += 1) resolve(index);
    return tails;
  }

  function forceGeometry(answer, question) {
    const tails = resolveTails(answer, question);
    return question.forces.map((force, index) => ({ key: force.key, force, tail: tails[index], head: add(tails[index], force) }));
  }

  function chainInfo(answer, question) {
    if (question.type === "parallelogram") return { valid: false, order: [], complete: false, reason: "not-chain" };
    const children = new Map();
    const roots = [];
    for (let index = 0; index < answer.placements.length; index += 1) {
      const placement = answer.placements[index];
      if (placement.mode !== "snap") continue;
      if (placement.targetKey === ORIGIN_KEY) roots.push(index);
      else {
        const parent = targetForceIndex(placement.targetKey);
        if (parent < 0 || parent === index || children.has(parent)) return { valid: false, order: [], complete: false, reason: "branch-or-self" };
        children.set(parent, index);
      }
    }
    if (roots.length > 1) return { valid: false, order: [], complete: false, reason: "multiple-roots" };
    if (!roots.length) {
      const snappedCount = answer.placements.filter((placement) => placement.mode === "snap").length;
      return snappedCount ? { valid: false, order: [], complete: false, reason: "floating-or-cycle" }
        : { valid: true, order: [], complete: false, freeHeadKey: ORIGIN_KEY };
    }
    const order = [];
    const seen = new Set();
    let current = roots[0];
    while (current != null) {
      if (seen.has(current)) return { valid: false, order: [], complete: false, reason: "cycle" };
      seen.add(current);
      order.push(current);
      current = children.get(current);
    }
    const snappedCount = answer.placements.filter((placement) => placement.mode === "snap").length;
    if (snappedCount !== order.length) return { valid: false, order, complete: false, reason: "floating-relationship" };
    return {
      valid: true,
      order,
      complete: order.length === question.forces.length,
      freeHeadKey: order.length ? headKey(order[order.length - 1]) : ORIGIN_KEY
    };
  }

  function commonOrigin(answer) {
    return answer.type === "parallelogram" && answer.placements.every((placement) => placement.mode === "snap" && placement.targetKey === ORIGIN_KEY);
  }

  function anchorPoint(answer) {
    return Array.isArray(answer?.anchor10) ? fromPoint10(answer.anchor10) : { ...Generator.ORIGIN };
  }

  function clampAnchor(point, question, forceIndexValue = null) {
    const forces = forceIndexValue == null ? question.forces : [question.forces[forceIndexValue]];
    return forces.reduce((candidate, force) => clampForceTail(candidate, force), { ...point });
  }

  function corner(question, answer = null) {
    return add(anchorPoint(answer), sumForces(question.forces));
  }

  function endpointForKey(answer, question, key) {
    if (key === ORIGIN_KEY) return anchorPoint(answer);
    if (key === "CORNER" || key === "CHAIN_END") return corner(question, answer);
    const match = /^F([1-3])_(TAIL|HEAD)$/.exec(key || "");
    if (!match) throw new Error(`Unknown endpoint ${key}`);
    const index = Number(match[1]) - 1;
    const geometry = forceGeometry(answer, question)[index];
    if (!geometry) throw new Error(`Unknown force endpoint ${key}`);
    return match[2] === "TAIL" ? geometry.tail : geometry.head;
  }

  function lineStartPoint(line, answer, question) {
    if (!line) return null;
    if (line.originKey === "FREE") {
      if (!validPoint10(line.originPoint10)) throw new Error("Invalid free line origin");
      return fromPoint10(line.originPoint10);
    }
    return endpointForKey(answer, question, line.originKey);
  }

  function correctGuides(answer) {
    if (!commonOrigin(answer)) return [];
    return answer.guides.filter((guide) => guide && ["F1_HEAD", "F2_HEAD"].includes(guide.originKey) && guide.end.mode === "snap" && ["CORNER", "PARALLEL"].includes(guide.end.targetKey));
  }

  function prerequisitesForResultant(answer, question) {
    return question.type === "parallelogram"
      ? commonOrigin(answer) && new Set(correctGuides(answer).map((guide) => guide.originKey)).size === 2
      : chainInfo(answer, question).complete;
  }

  function resultantAvailable(answer, question) {
    return question.type === "parallelogram"
      ? commonOrigin(answer) && answer.guides.every((guide) => guide !== null)
      : chainInfo(answer, question).complete;
  }

  function canonicalResultant(answer, question) {
    return Boolean(prerequisitesForResultant(answer, question) && answer.resultant?.originKey === ORIGIN_KEY && answer.resultant.end.mode === "snap" &&
      answer.resultant.end.targetKey === (question.type === "parallelogram" ? "CORNER" : "CHAIN_END"));
  }

  function derivedVariant(answer, question) {
    if (question.type === "parallelogram") {
      if (canonicalResultant(answer, question)) return "complete";
      if (!commonOrigin(answer)) return answer.placements.every((placement) => placement.mode === "initial") ? "fresh" : "placing";
      if (resultantAvailable(answer, question)) return "resultant";
      return "guides";
    }
    if (canonicalResultant(answer, question)) return "complete";
    const chain = chainInfo(answer, question);
    if (chain.complete) return "resultant";
    return answer.placements.every((placement) => placement.mode === "initial") ? "fresh" : "placing";
  }

  function releaseForceAndDescendants(answer, question, movingIndex) {
    const next = clone(answer);
    const tails = resolveTails(answer, question);
    const released = new Set([movingIndex]);
    let changed = true;
    while (changed) {
      changed = false;
      next.placements.forEach((placement, index) => {
        const parent = placement.mode === "snap" ? targetForceIndex(placement.targetKey) : -1;
        if (parent >= 0 && released.has(parent) && !released.has(index)) { released.add(index); changed = true; }
      });
    }
    for (const index of released) next.placements[index] = { mode: "free", tail10: point10(tails[index]) };
    if (!next.placements.some((placement) => placement.mode === "snap" && placement.targetKey === ORIGIN_KEY)) next.anchor10 = null;
    if (question.type === "parallelogram") { next.guides = [null, null]; next.resultant = null; }
    else next.resultant = null;
    return next;
  }

  function previewForceTranslation(answer, forceIndexValue, candidateTail, question) {
    const next = releaseForceAndDescendants(answer, question, forceIndexValue);
    const clamped = clampForceTail(candidateTail, question.forces[forceIndexValue]);
    next.placements[forceIndexValue] = { mode: "free", tail10: point10(clamped) };
    return next;
  }

  function previewSnappedForceTranslation(answer, forceIndexValue, candidateTail, question, options = {}) {
    const next = previewForceTranslation(answer, forceIndexValue, candidateTail, question);
    const candidate = fromPoint10(next.placements[forceIndexValue].tail10);
    const snap = selectSnapCandidate(candidate, legalForceTargets(next, question, forceIndexValue), options);
    if (!snap) return next;
    if (question.type !== "parallelogram" && snap.attach === "HEAD") {
      const targetMatch = /^F([1-3])_TAIL$/.exec(snap.key || "");
      const targetIndex = targetMatch ? Number(targetMatch[1]) - 1 : -1;
      if (targetIndex >= 0 && targetIndex !== forceIndexValue && question.forces.length === 2) {
        next.anchor10 = point10(candidate);
        next.placements[forceIndexValue] = { mode: "snap", targetKey: ORIGIN_KEY };
        next.placements[targetIndex] = { mode: "snap", targetKey: headKey(forceIndexValue) };
        return next;
      }
    }
    if (question.type === "parallelogram" && !Array.isArray(next.anchor10) && snap.key !== ORIGIN_KEY) {
      const otherIndex = forceIndexValue === 0 ? 1 : 0;
      next.anchor10 = point10(snap.point);
      next.placements[forceIndexValue] = { mode: "snap", targetKey: ORIGIN_KEY };
      next.placements[otherIndex] = { mode: "snap", targetKey: ORIGIN_KEY };
      return next;
    }
    if (question.type !== "parallelogram" && !Array.isArray(next.anchor10) && snap.key !== ORIGIN_KEY) {
      const parentIndex = targetForceIndex(snap.key);
      if (parentIndex >= 0 && parentIndex !== forceIndexValue) {
        const parentTail = forceGeometry(next, question)[parentIndex].tail;
        next.anchor10 = point10(parentTail);
        next.placements[parentIndex] = { mode: "snap", targetKey: ORIGIN_KEY };
        next.placements[forceIndexValue] = { mode: "snap", targetKey: snap.key };
        return next;
      }
    }
    next.placements[forceIndexValue] = { mode: "snap", targetKey: snap.key };
    return next;
  }

  function legalForceTargets(answer, question, movingIndex) {
    if (question.type === "parallelogram") {
      if (Array.isArray(answer.anchor10)) return [{ key: ORIGIN_KEY, point: anchorPoint(answer) }];
      const otherIndex = movingIndex === 0 ? 1 : 0;
      return [{ key: tailKey(otherIndex), point: forceGeometry(answer, question)[otherIndex].tail }];
    }
    if (!Array.isArray(answer.anchor10)) {
      // Either force may be placed first. Before a chain root exists, allow
      // either endpoint to meet another force. A moving tail meeting a head
      // makes the other force the root; a moving head meeting a tail makes
      // the moving force the root. The latter is intentionally limited to
      // the two-force H1/H2 exercises so T1 never creates a branch.
      const geometry = forceGeometry(answer, question);
      const targets = [];
      geometry.forEach((item, index) => {
        if (index === movingIndex) return;
        targets.push({ key: headKey(index), point: item.head, attach: "TAIL" });
        if (question.forces.length === 2) {
          const force = question.forces[movingIndex];
          targets.push({ key: tailKey(index), point: { x: item.tail.x - force.dx, y: item.tail.y - force.dy }, attach: "HEAD" });
        }
      });
      return targets;
    }

    const chain = chainInfo(answer, question);
    if (!chain.valid) return [];
    if (!chain.order.length) return [{ key: ORIGIN_KEY, point: anchorPoint(answer) }];
    if (chain.order.includes(movingIndex) || chain.complete) return [];
    const lastIndex = chain.order[chain.order.length - 1];
    const targets = [{ key: headKey(lastIndex), point: endpointForKey(answer, question, headKey(lastIndex)), attach: "TAIL" }];
    if (question.forces.length === 2) {
      const otherIndex = movingIndex === 0 ? 1 : 0;
      const force = question.forces[movingIndex];
      const otherTail = endpointForKey(answer, question, tailKey(otherIndex));
      targets.push({ key: tailKey(otherIndex), point: { x: otherTail.x - force.dx, y: otherTail.y - force.dy }, attach: "HEAD" });
    }
    return targets;
  }

  function commitForceTranslation(answer, forceIndexValue, candidateTail, question, options = {}) {
    const next = previewSnappedForceTranslation(answer, forceIndexValue, candidateTail, question, options);
    if (next.placements[forceIndexValue].mode === "snap") return next;
    let candidate = fromPoint10(next.placements[forceIndexValue].tail10);
    if (!Array.isArray(next.anchor10)) {
      const targets = legalForceTargets(next, question, forceIndexValue);
      const snap = selectSnapCandidate(candidate, targets, options);
      if (question.type === "parallelogram" && snap) {
        const otherIndex = forceIndexValue === 0 ? 1 : 0;
        const anchor = fromPoint10(point10(snap.point));
        next.anchor10 = point10(anchor);
        next.placements[forceIndexValue] = { mode: "snap", targetKey: ORIGIN_KEY };
        next.placements[otherIndex] = { mode: "snap", targetKey: ORIGIN_KEY };
        return next;
      }
      candidate = clampAnchor(candidate, question, question.type === "parallelogram" ? null : forceIndexValue);
      next.anchor10 = point10(candidate);
      next.placements[forceIndexValue] = { mode: "snap", targetKey: ORIGIN_KEY };
      return next;
    }
    const snap = selectSnapCandidate(candidate, legalForceTargets(next, question, forceIndexValue), options);
    if (snap) next.placements[forceIndexValue] = { mode: "snap", targetKey: snap.key };
    return next;
  }

  function lineEndPoint(line, answer, question) {
    if (!line) return null;
    if (line.end.mode === "free" || line.end.targetKey === "PARALLEL") return fromPoint10(line.end.point10);
    return endpointForKey(answer, question, line.end.targetKey);
  }

  function parallelSnapPoint(answer, question, originKey, candidateEnd) {
    const match = /^F([1-3])_HEAD$/.exec(originKey || "");
    const index = match ? Number(match[1]) - 1 : -1;
    if (index < 0 || index >= question.forces.length) return null;
    const origin = endpointForKey(answer, question, originKey);
    const direction = question.forces[index === 0 ? 1 : 0];
    const delta = { x: candidateEnd.x - origin.x, y: candidateEnd.y - origin.y };
    const length = Math.hypot(delta.x, delta.y);
    const magnitude = Math.hypot(direction.dx, direction.dy);
    if (length < 8 || magnitude < MODEL_EPSILON) return null;
    const cross = Math.abs(delta.x * direction.dy - delta.y * direction.dx) / (length * magnitude);
    if (cross > Math.sin(PARALLEL_SNAP_ANGLE_DEG * Math.PI / 180)) return null;
    const sign = delta.x * direction.dx + delta.y * direction.dy < 0 ? -1 : 1;
    return clampLinePoint({
      x: origin.x + sign * direction.dx / magnitude * length,
      y: origin.y + sign * direction.dy / magnitude * length
    });
  }

  function guideEndIsParallel(answer, question, guide) {
    if (!guide || !["F1_HEAD", "F2_HEAD"].includes(guide.originKey)) return false;
    if (guide.end?.mode === "snap" && guide.end.targetKey === "CORNER") return true;
    if (guide.end?.mode !== "snap" || guide.end.targetKey !== "PARALLEL") return false;
    return Boolean(parallelSnapPoint(answer, question, guide.originKey, lineEndPoint(guide, answer, question)));
  }

  function guideOriginAllowed(question, originKey) {
    return question.guided ? ["F1_HEAD", "F2_HEAD"].includes(originKey) : [ORIGIN_KEY, "F1_HEAD", "F2_HEAD"].includes(originKey);
  }

  function resultantOriginAllowed(question, originKey, options = {}) {
    if (originKey === "FREE") return true;
    if (options.allowAnyOrigin) {
      const keys = [ORIGIN_KEY, "FREE"];
      for (let index = 0; index < question.forces.length; index += 1) keys.push(tailKey(index), headKey(index));
      if (question.type === "parallelogram") keys.push("CORNER");
      else keys.push("CHAIN_END");
      return keys.includes(originKey);
    }
    if (question.guided) return originKey === ORIGIN_KEY;
    const count = question.forces.length;
    const keys = [ORIGIN_KEY];
    for (let index = 0; index < count; index += 1) keys.push(tailKey(index), headKey(index));
    if (question.type === "parallelogram") keys.push("CORNER");
    return keys.includes(originKey);
  }

  function parallelogramCornerTargets(answer, question) {
    if (question.type !== "parallelogram") return [];
    return [
      { key: ORIGIN_KEY, point: anchorPoint(answer) },
      { key: "F1_HEAD", point: endpointForKey(answer, question, "F1_HEAD") },
      { key: "F2_HEAD", point: endpointForKey(answer, question, "F2_HEAD") },
      { key: "CORNER", point: corner(question, answer) }
    ];
  }

  function resultantSnapTargets(answer, question, originKey = ORIGIN_KEY) {
    if (question.type === "parallelogram") return parallelogramCornerTargets(answer, question);
    return endpointHandles(answer, question);
  }

  function previewGuide(answer, originKey, candidateEnd, question, options = {}) {
    if (question.type !== "parallelogram" || !commonOrigin(answer) || !guideOriginAllowed(question, originKey)) throw new Error("Guide is not available");
    const next = clone(answer);
    const line = { originKey, end: { mode: "free", point10: point10(clampLinePoint(candidateEnd)) } };
    const sameOrigin = next.guides.findIndex((guide) => guide?.originKey === originKey);
    const slot = sameOrigin >= 0 ? sameOrigin : next.guides.findIndex((guide) => guide === null);
    if (slot < 0) throw new Error("Both guide slots are in use");
    next.guides[slot] = line;
    next.resultant = null;
    if (options.snap && ["F1_HEAD", "F2_HEAD"].includes(originKey)) {
      const candidate = fromPoint10(next.guides[slot].end.point10);
      const snapped = parallelSnapPoint(next, question, originKey, candidate);
      if (snapped) next.guides[slot].end = { mode: "snap", targetKey: "PARALLEL", point10: point10(snapped) };
    }
    return next;
  }

  function commitGuide(answer, originKey, candidateEnd, question, options = {}) {
    return previewGuide(answer, originKey, candidateEnd, question, { ...options, snap: true });
  }

  function removeGuide(answer, index) {
    const next = clone(answer);
    next.guides[index] = null;
    next.resultant = null;
    return next;
  }

  function previewResultant(answer, originKey, candidateEnd, question, options = {}) {
    if ((!resultantAvailable(answer, question) && !options.allowIncomplete) || !resultantOriginAllowed(question, originKey, options)) throw new Error("Resultant is not available");
    const next = clone(answer);
    next.resultant = { originKey, end: { mode: "free", point10: point10(clampLinePoint(candidateEnd)) } };
    if (originKey === "FREE") {
      const originPoint10 = answer.resultant?.originPoint10 || (options.originPoint ? point10(clampLinePoint(options.originPoint)) : null);
      if (!validPoint10(originPoint10)) throw new Error("Free resultant origin is missing");
      next.resultant.originPoint10 = originPoint10.slice();
    }
    if (options.snap) {
      const candidate = fromPoint10(next.resultant.end.point10);
      const snap = selectSnapCandidate(candidate, resultantSnapTargets(next, question, originKey), options);
      if (snap) next.resultant.end = { mode: "snap", targetKey: snap.key };
    }
    return next;
  }

  function commitResultant(answer, originKey, candidateEnd, question, options = {}) {
    return previewResultant(answer, originKey, candidateEnd, question, { ...options, snap: true });
  }

  function previewResultantStart(answer, candidateStart, question, options = {}) {
    if (!answer.resultant || (!resultantAvailable(answer, question) && !options.allowIncomplete)) throw new Error("Resultant is not available");
    const next = clone(answer);
    const candidate = clampLinePoint(candidateStart);
    const targets = question.type === "parallelogram"
      ? parallelogramCornerTargets(next, question)
      : endpointHandles(next, question).filter((handle) => resultantOriginAllowed(question, handle.key, options));
    const snap = options.snap ? selectSnapCandidate(candidate, targets, options) : null;
    if (snap) {
      next.resultant.originKey = snap.key;
      delete next.resultant.originPoint10;
    } else if (question.type === "parallelogram" && options.allowAnyOrigin) {
      next.resultant.originKey = "FREE";
      next.resultant.originPoint10 = point10(candidate);
    }
    return next;
  }

  function commitResultantStart(answer, candidateStart, question, options = {}) {
    return previewResultantStart(answer, candidateStart, question, { ...options, snap: true });
  }

  function boundedTranslationDelta(start, end, delta) {
    const points = [start, end];
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return {
      x: Math.max(FREE_LINE_INSET - minX, Math.min(Generator.WIDTH - FREE_LINE_INSET - maxX, delta.x)),
      y: Math.max(FREE_LINE_INSET - minY, Math.min(Generator.HEIGHT - FREE_LINE_INSET - maxY, delta.y))
    };
  }

  function previewResultantTranslation(answer, delta, question, options = {}) {
    if (!answer.resultant || (!resultantAvailable(answer, question) && !options.allowIncomplete)) throw new Error("Resultant is not available");
    const start = lineStartPoint(answer.resultant, answer, question);
    const end = lineEndPoint(answer.resultant, answer, question);
    const bounded = boundedTranslationDelta(start, end, delta);
    const candidateStart = clampLinePoint({ x: start.x + bounded.x, y: start.y + bounded.y });
    const candidateEnd = clampLinePoint({ x: end.x + bounded.x, y: end.y + bounded.y });
    const next = clone(answer);
    next.resultant = {
      originKey: "FREE",
      originPoint10: point10(candidateStart),
      end: { mode: "free", point10: point10(candidateEnd) }
    };
    if (options.snap) {
      const targets = question.type === "parallelogram" ? parallelogramCornerTargets(next, question) : endpointHandles(next, question);
      const startSnap = selectSnapCandidate(candidateStart, targets, options);
      if (startSnap) {
        next.resultant.originKey = startSnap.key;
        delete next.resultant.originPoint10;
      }
      const endSnap = selectSnapCandidate(candidateEnd, targets, options);
      if (endSnap) next.resultant.end = { mode: "snap", targetKey: endSnap.key };
    }
    return next;
  }

  function commitResultantTranslation(answer, delta, question, options = {}) {
    return previewResultantTranslation(answer, delta, question, { ...options, snap: true });
  }

  function endpointHandles(answer, question) {
    const geometry = forceGeometry(answer, question);
    const handles = [{ key: ORIGIN_KEY, point: anchorPoint(answer) }];
    for (let index = 0; index < geometry.length; index += 1) {
      handles.push({ key: tailKey(index), point: geometry[index].tail });
      handles.push({ key: headKey(index), point: geometry[index].head });
    }
    handles.push({ key: question.type === "parallelogram" ? "CORNER" : "CHAIN_END", point: corner(question, answer) });
    return handles;
  }

  function guideStartHandles(answer, question) {
    if (question.type !== "parallelogram" || !commonOrigin(answer) || resultantAvailable(answer, question)) return [];
    if (question.guided) {
      const existing = new Set(answer.guides.filter(Boolean).map((guide) => guide.originKey));
      return ["F1_HEAD", "F2_HEAD"].filter((key) => !existing.has(key)).map((key) => ({ key, point: endpointForKey(answer, question, key) }));
    }
    const allowed = answer.guides.every((guide) => guide !== null)
      ? new Set(answer.guides.map((guide) => guide.originKey))
      : new Set([ORIGIN_KEY, "F1_HEAD", "F2_HEAD"]);
    return endpointHandles(answer, question).filter((handle) => allowed.has(handle.key));
  }

  function resultantStartHandles(answer, question, options = {}) {
    if (!resultantAvailable(answer, question) || canonicalResultant(answer, question)) return [];
    if (options.allowAnyOrigin) return endpointHandles(answer, question);
    if (question.guided) return [{ key: ORIGIN_KEY, point: anchorPoint(answer) }];
    return endpointHandles(answer, question);
  }

  function isBlank(answer) {
    return answer.placements.every((placement) => placement.mode === "initial") &&
      (answer.type !== "parallelogram" || answer.guides.every((guide) => guide === null)) && answer.resultant === null;
  }

  function questionComplete(answer, question) {
    return canonicalResultant(answer, question);
  }

  return Object.freeze({
    SNAP_TOUCH_PX, SNAP_POINTER_PX, SNAP_KEYBOARD_PX, PARALLEL_SNAP_ANGLE_DEG, MODEL_EPSILON, POSITION_QUANTUM,
    MODEL_VISUAL_INSET, FREE_LINE_INSET, ORIGIN_KEY,
    clone, forceKey, forceIndex, headKey, tailKey, targetForceIndex, quantize, point10, fromPoint10, validPoint10,
    add, sumForces, distance, threshold, selectSnapCandidate, clampForceTail, clampAnchor, clampLinePoint,
    freshAnswer, freshAnswers, resolveTails, forceGeometry, chainInfo, commonOrigin, anchorPoint, corner, endpointForKey,
    correctGuides, prerequisitesForResultant, resultantAvailable, canonicalResultant, derivedVariant,
    releaseForceAndDescendants, previewForceTranslation, previewSnappedForceTranslation, legalForceTargets, commitForceTranslation,
    lineStartPoint, lineEndPoint, parallelSnapPoint, guideEndIsParallel, guideOriginAllowed, resultantOriginAllowed, previewGuide, commitGuide, removeGuide,
    parallelogramCornerTargets, resultantSnapTargets, previewResultant, commitResultant, previewResultantStart, commitResultantStart,
    boundedTranslationDelta, previewResultantTranslation, commitResultantTranslation,
    endpointHandles, guideStartHandles, resultantStartHandles,
    isBlank, questionComplete
  });
});
