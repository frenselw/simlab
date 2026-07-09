(function () {
  "use strict";

  const Scoring = window.MapJourneyScoring;
  const svg = document.getElementById("mapSvg");
  const roadLayer = document.getElementById("roadLayer");
  const blockLayer = document.getElementById("blockLayer");
  const placeLayer = document.getElementById("placeLayer");
  const traceLayer = document.getElementById("traceLayer");
  const arrowLayer = document.getElementById("arrowLayer");
  const personLayer = document.getElementById("personLayer");
  const dragPreview = document.getElementById("dragPreview");
  const dragPreviewSvg = document.getElementById("dragPreviewSvg");
  const answerHint = document.getElementById("answerHint");
  const taskText = document.getElementById("taskText");
  const routeReadout = document.getElementById("routeReadout");
  const statusText = document.getElementById("statusText");
  const instructionText = document.getElementById("instructionText");
  const segmentDistance = document.getElementById("segmentDistance");
  const totalDistance = document.getElementById("totalDistance");
  const arrowMagnitude = document.getElementById("arrowMagnitude");
  const arrowDirection = document.getElementById("arrowDirection");
  const segmentAnswerButton = document.getElementById("segmentAnswerButton");
  const finalAnswerButton = document.getElementById("finalAnswerButton");
  const scorePanel = document.getElementById("scorePanel");
  const answerDialog = document.getElementById("answerDialog");
  const answerForm = document.getElementById("answerForm");
  const dialogTitle = document.getElementById("dialogTitle");
  const dialogPrompt = document.getElementById("dialogPrompt");
  const answerReadout = document.getElementById("answerReadout");
  const routeLegend = document.getElementById("routeLegend");
  const routeChoices = document.getElementById("routeChoices");
  const magnitudeChoices = document.getElementById("magnitudeChoices");
  const directionChoices = document.getElementById("directionChoices");
  const saveAnswerButton = document.getElementById("saveAnswerButton");

  const SVG_WIDTH = 120;
  const SVG_HEIGHT = 80;
  const ROAD_WIDTH = 4;
  const REVIEW_TRACE_POINT_CAP = 18;
  const PREVIEW_VIEWBOX_WIDTH = 30;
  const PREVIEW_VIEWBOX_HEIGHT = 20;
  const PREVIEW_MARGIN_PX = 10;
  const ARROW_SNAP_TOLERANCE_M = Scoring.ARROW_HEAD_TOLERANCE_M;
  const ARROW_SNAPPED_TOLERANCE_M = 0.05;
  const PERSON_DRAG_ROAD_TOLERANCE_M = ROAD_WIDTH;
  const PERSON_DRAG_TURN_LIMIT_M = ROAD_WIDTH * 2.5;
  const COMPASS_CLEAR_ZONE = { x: 105, y: 0, width: 15, height: 24 };
  const GRID_X = [12, 30, 48, 66, 84, 102];
  const GRID_Y = [10, 24, 38, 52, 68];
  const PLACE_LABELS = ["學校", "超市", "銀行", "公園", "圖書館"];

  const state = {
    scene: null,
    segments: [],
    person: null,
    currentSegment: 0,
    phase: "walk",
    totalArrow: null,
    totalAnswers: null,
    drag: null,
    dialogMode: null,
    dialogSelection: null,
    locked: false,
    result: null
  };

  function startNewAttempt() {
    state.scene = buildScene(randomSeed());
    state.segments = [blankSegment(), blankSegment()];
    state.currentSegment = 0;
    state.phase = "walk";
    state.totalArrow = null;
    state.totalAnswers = null;
    state.locked = false;
    state.result = null;
    startWalkSegment(0);
    render();
  }

  function blankSegment() {
    return {
      reached: false,
      routeDistance: 0,
      trace: [],
      arrow: null,
      answers: null
    };
  }

  function randomSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function buildScene(seed, routeIds) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const usedSeed = (seed + attempt * 2654435761) >>> 0;
      const scene = tryBuildScene(usedSeed, routeIds);
      if (scene) return scene;
    }
    throw new Error("Unable to build a connected map");
  }

  function tryBuildScene(seed, routeIds) {
    const rng = mulberry32(seed);
    const nodes = gridNodes();
    const selected = choosePlaceNodes(nodes, rng);
    if (selected.length < PLACE_LABELS.length) return null;
    const edges = buildRoadEdges(selected, rng);
    const places = buildPlaces(selected, edges, rng);
    if (!places) return null;
    const blocks = buildNeutralBlocks(places, edges, rng);
    const scene = {
      seed,
      nodes,
      edges: edges.map((edge, index) => ({ ...edge, id: index })),
      places,
      blocks,
      routeIds: routeIds && routeIds.length === 3 ? routeIds : chooseRouteIds(places, rng)
    };
    scene.edgeById = Object.fromEntries(scene.edges.map((edge) => [edge.id, edge]));
    return routeIsUsable(scene) ? scene : null;
  }

  function mulberry32(seed) {
    return function random() {
      let value = seed += 0x6d2b79f5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function gridNodes() {
    const nodes = [];
    GRID_Y.forEach((y, yi) => {
      GRID_X.forEach((x, xi) => {
        nodes.push({ key: nodeKey(xi, yi), xi, yi, x, y });
      });
    });
    return nodes;
  }

  function nodeKey(xi, yi) {
    return `${xi},${yi}`;
  }

  function edgeKey(a, b) {
    return [a.key, b.key].sort().join("|");
  }

  function choosePlaceNodes(nodes, rng) {
    const choices = shuffle(nodes, rng);
    const selected = [];
    choices.forEach((node) => {
      if (
        selected.length < PLACE_LABELS.length &&
        selected.every((item) => Scoring.pointDistance(item, node) >= 24)
      ) {
        selected.push(node);
      }
    });
    return selected;
  }

  function buildRoadEdges(selected, rng) {
    const nodesByKey = Object.fromEntries(gridNodes().map((node) => [node.key, node]));
    const edges = new Map();
    const order = shuffle(selected, rng);
    for (let i = 1; i < order.length; i += 1) {
      connectManhattan(order[i - 1], order[i], rng, nodesByKey, edges);
    }
    const connectedKeys = connectedRoadKeys(edges);
    for (let i = 0; i < 9; i += 1) {
      const node = randomItem(Object.values(nodesByKey).filter((item) => connectedKeys.has(item.key)), rng);
      const neighbor = randomNeighbor(node, nodesByKey, rng);
      if (neighbor) {
        addEdge(node, neighbor, edges);
        connectedKeys.add(neighbor.key);
      }
    }
    return Array.from(edges.values());
  }

  function connectedRoadKeys(edges) {
    const keys = new Set();
    edges.forEach((edge) => {
      keys.add(edge.aKey);
      keys.add(edge.bKey);
    });
    return keys;
  }

  function connectManhattan(from, to, rng, nodesByKey, edges) {
    let xi = from.xi;
    let yi = from.yi;
    const stepX = () => {
      while (xi !== to.xi) {
        const nextXi = xi + Math.sign(to.xi - xi);
        addEdge(nodesByKey[nodeKey(xi, yi)], nodesByKey[nodeKey(nextXi, yi)], edges);
        xi = nextXi;
      }
    };
    const stepY = () => {
      while (yi !== to.yi) {
        const nextYi = yi + Math.sign(to.yi - yi);
        addEdge(nodesByKey[nodeKey(xi, yi)], nodesByKey[nodeKey(xi, nextYi)], edges);
        yi = nextYi;
      }
    };
    if (rng() < 0.5) {
      stepX();
      stepY();
    } else {
      stepY();
      stepX();
    }
  }

  function randomNeighbor(node, nodesByKey, rng) {
    const neighbors = shuffle([
      nodeKey(node.xi + 1, node.yi),
      nodeKey(node.xi - 1, node.yi),
      nodeKey(node.xi, node.yi + 1),
      nodeKey(node.xi, node.yi - 1)
    ], rng).map((key) => nodesByKey[key]);
    return neighbors.find(Boolean);
  }

  function addEdge(a, b, edges) {
    if (!a || !b) return;
    const key = edgeKey(a, b);
    if (edges.has(key)) return;
    const edge = {
      key,
      aKey: a.key,
      bKey: b.key,
      a: { x: a.x, y: a.y },
      b: { x: b.x, y: b.y },
      length: Scoring.pointDistance(a, b)
    };
    if (rectTouchesEdge(COMPASS_CLEAR_ZONE, edge, 1)) return;
    edges.set(key, edge);
  }

  function buildPlaces(nodes, edges, rng) {
    const labels = shuffle(PLACE_LABELS, rng);
    const places = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const size = {
        width: randomInt(12, 18, rng),
        height: randomInt(7, 11, rng)
      };
      const directions = preferredPlaceDirections(node, edges, rng);
      const rect = directions.map((direction) => placeRect(node, size, direction)).find((item) => {
        return (
          item &&
          !rectsOverlap(expandRect(item, 1), COMPASS_CLEAR_ZONE) &&
          places.every((place) => !rectsOverlap(expandRect(item, 2), expandRect(place.rect, 2))) &&
          !edges.some((edge) => rectTouchesEdge(item, edge, 1))
        );
      });
      if (!rect) return null;
      places.push({
        id: `place-${i}`,
        label: labels[i],
        rect,
        nodeKey: node.key,
        entrance: { x: node.x, y: node.y },
        position: { x: node.x, y: node.y },
        center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      });
    }
    return places;
  }

  function preferredPlaceDirections(node, edges, rng) {
    const occupied = new Set();
    edges.forEach((edge) => {
      if (edge.aKey !== node.key && edge.bKey !== node.key) return;
      const other = edge.aKey === node.key ? edge.bKey : edge.aKey;
      const [xi, yi] = other.split(",").map(Number);
      if (xi > node.xi) occupied.add("east");
      if (xi < node.xi) occupied.add("west");
      if (yi > node.yi) occupied.add("south");
      if (yi < node.yi) occupied.add("north");
    });
    return shuffle(["north", "south", "east", "west"], rng).sort((a, b) => {
      return Number(occupied.has(a)) - Number(occupied.has(b));
    });
  }

  function placeRect(node, size, direction) {
    const gap = ROAD_WIDTH / 2 + 3;
    const rect = { width: size.width, height: size.height };
    if (direction === "north") {
      rect.x = node.x - size.width / 2;
      rect.y = node.y - gap - size.height;
    }
    if (direction === "south") {
      rect.x = node.x - size.width / 2;
      rect.y = node.y + gap;
    }
    if (direction === "east") {
      rect.x = node.x + gap;
      rect.y = node.y - size.height / 2;
    }
    if (direction === "west") {
      rect.x = node.x - gap - size.width;
      rect.y = node.y - size.height / 2;
    }
    if (
      rect.x < 2 ||
      rect.y < 2 ||
      rect.x + rect.width > SVG_WIDTH - 2 ||
      rect.y + rect.height > SVG_HEIGHT - 2
    ) {
      return null;
    }
    return rect;
  }

  function buildNeutralBlocks(places, edges, rng) {
    const blocks = [];
    for (let attempt = 0; attempt < 120 && blocks.length < 11; attempt += 1) {
      const rect = {
        x: randomInt(5, 105, rng),
        y: randomInt(6, 68, rng),
        width: randomInt(5, 10, rng),
        height: randomInt(4, 8, rng)
      };
      if (rect.x + rect.width > SVG_WIDTH - 2 || rect.y + rect.height > SVG_HEIGHT - 2) continue;
      if (rectsOverlap(expandRect(rect, 1), COMPASS_CLEAR_ZONE)) continue;
      if (places.some((place) => rectsOverlap(expandRect(rect, 2), expandRect(place.rect, 2)))) {
        continue;
      }
      if (blocks.some((block) => rectsOverlap(expandRect(rect, 1), expandRect(block, 1)))) continue;
      if (edges.some((edge) => rectTouchesEdge(rect, edge))) continue;
      blocks.push(rect);
    }
    return blocks;
  }

  function rectTouchesEdge(rect, edge, extraPad) {
    const pad = ROAD_WIDTH / 2 + (extraPad ?? 1);
    const box = expandRect(rect, pad);
    return (
      Math.min(edge.a.x, edge.b.x) <= box.x + box.width &&
      Math.max(edge.a.x, edge.b.x) >= box.x &&
      Math.min(edge.a.y, edge.b.y) <= box.y + box.height &&
      Math.max(edge.a.y, edge.b.y) >= box.y
    );
  }

  function expandRect(rect, pad) {
    return {
      x: rect.x - pad,
      y: rect.y - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2
    };
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function chooseRouteIds(places, rng) {
    return shuffle(places, rng).slice(0, 3).map((place) => place.id);
  }

  function routeIsUsable(scene) {
    if (!scene.routeIds.every((id) => scene.places.some((place) => place.id === id))) return false;
    if (!placesAreRoadConnected(scene)) return false;
    return [0, 1].every((index) => {
      const expected = Scoring.expectedSegment(journeyForScene(scene), index);
      return expected.magnitude >= 14;
    });
  }

  function placesAreRoadConnected(scene) {
    const adjacency = new Map();
    scene.edges.forEach((edge) => {
      if (!adjacency.has(edge.aKey)) adjacency.set(edge.aKey, []);
      if (!adjacency.has(edge.bKey)) adjacency.set(edge.bKey, []);
      adjacency.get(edge.aKey).push(edge.bKey);
      adjacency.get(edge.bKey).push(edge.aKey);
    });
    const startKey = scene.places[0]?.nodeKey;
    if (!startKey || !adjacency.has(startKey)) return false;
    const seen = new Set([startKey]);
    const queue = [startKey];
    while (queue.length) {
      const key = queue.shift();
      (adjacency.get(key) || []).forEach((next) => {
        if (seen.has(next)) return;
        seen.add(next);
        queue.push(next);
      });
    }
    return scene.places.every((place) => seen.has(place.nodeKey));
  }

  function randomInt(min, max, rng) {
    return Math.floor(min + rng() * (max - min + 1));
  }

  function randomItem(items, rng) {
    return items[Math.floor(rng() * items.length)];
  }

  function shuffle(items, rng) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startWalkSegment(index) {
    state.currentSegment = index;
    state.phase = "walk";
    const startPlace = placeById(state.scene.routeIds[index]);
    state.person = nearestRoadPosition(startPlace.entrance);
    state.segments[index].trace = [pointOnly(state.person)];
  }

  function nearestRoadPosition(point) {
    let best = null;
    state.scene.edges.forEach((edge) => {
      const projection = projectToSegment(point, edge.a, edge.b);
      if (!best || projection.distance < best.distance) {
        best = { ...projection, edgeId: edge.id };
      }
    });
    return best;
  }

  function projectToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    return { x, y, t, distance: Math.hypot(point.x - x, point.y - y) };
  }

  function roadPath(from, to) {
    if (!from || !to) return { distance: 0, points: [] };
    const edge = state.scene.edgeById[from.edgeId];
    if (edge && from.edgeId === to.edgeId) {
      return {
        distance: Math.abs(to.t - from.t) * edge.length,
        points: [pointOnly(from), pointOnly(to)]
      };
    }
    return shortestRoadPath(from, to);
  }

  function shortestRoadPath(from, to) {
    const startKey = "__start";
    const endKey = "__end";
    const adjacency = new Map();
    const pointsByKey = new Map([
      [startKey, pointOnly(from)],
      [endKey, pointOnly(to)]
    ]);
    state.scene.edges.forEach((edge) => {
      pointsByKey.set(edge.aKey, edge.a);
      pointsByKey.set(edge.bKey, edge.b);
      addGraphLink(adjacency, edge.aKey, edge.bKey, edge.length);
    });
    addPositionLinks(adjacency, startKey, from);
    addPositionLinks(adjacency, endKey, to);
    const result = dijkstra(adjacency, startKey, endKey);
    return {
      distance: result.distance,
      points: result.path.map((key) => pointsByKey.get(key)).filter(Boolean)
    };
  }

  function addPositionLinks(adjacency, key, position) {
    const edge = state.scene.edgeById[position.edgeId];
    if (!edge) return;
    addGraphLink(adjacency, key, edge.aKey, position.t * edge.length);
    addGraphLink(adjacency, key, edge.bKey, (1 - position.t) * edge.length);
  }

  function addGraphLink(adjacency, a, b, length) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push({ key: b, length });
    adjacency.get(b).push({ key: a, length });
  }

  function dijkstra(adjacency, startKey, endKey) {
    const distances = new Map([[startKey, 0]]);
    const previous = new Map();
    const visited = new Set();
    while (visited.size < adjacency.size) {
      const current = Array.from(distances.entries())
        .filter(([key]) => !visited.has(key))
        .sort((a, b) => a[1] - b[1])[0];
      if (!current) break;
      const [key, distance] = current;
      if (key === endKey) {
        const path = [];
        for (let node = endKey; node; node = previous.get(node)) {
          path.unshift(node);
          if (node === startKey) break;
        }
        return { distance, path };
      }
      visited.add(key);
      (adjacency.get(key) || []).forEach((link) => {
        const next = distance + link.length;
        if (next < (distances.get(link.key) ?? Infinity)) {
          distances.set(link.key, next);
          previous.set(link.key, key);
        }
      });
    }
    return { distance: Infinity, path: [] };
  }

  function placeById(id) {
    return state.scene.places.find((place) => place.id === id);
  }

  function journeyForScene(scene) {
    return {
      routePlaceIds: scene.routeIds,
      places: scene.places.map((place) => ({
        id: place.id,
        label: place.label,
        position: displacementPoint(place)
      }))
    };
  }

  function currentAnswer() {
    return {
      segments: state.segments.map((segment) => ({
        reached: segment.reached,
        routeDistance: segment.routeDistance,
        arrow: cloneArrow(segment.arrow),
        answers: cloneAnswers(segment.answers)
      })),
      totalArrow: cloneArrow(state.totalArrow),
      totalAnswers: cloneAnswers(state.totalAnswers)
    };
  }

  function cloneArrow(arrow) {
    return arrow ? { tail: { ...arrow.tail }, head: { ...arrow.head } } : null;
  }

  function cloneAnswers(answers) {
    return answers
      ? {
          routeDistance: answers.routeDistance,
          displacementMagnitude: answers.displacementMagnitude,
          direction: { ...answers.direction }
        }
      : null;
  }

  function currentRouteLabels() {
    return state.scene.routeIds.map((id) => placeById(id).label);
  }

  function completeCurrentSegment() {
    const segment = state.segments[state.currentSegment];
    const target = placeById(state.scene.routeIds[state.currentSegment + 1]);
    segment.reached = true;
    state.person = nearestRoadPosition(target.entrance);
    pushTracePoint(segment, pointOnly(state.person));
    segment.arrow = defaultArrow(displacementPoint(segmentStartPlace(state.currentSegment)));
    state.phase = "draw-segment";
    state.drag = null;
    render();
  }

  function segmentStartPlace(index) {
    return placeById(state.scene.routeIds[index]);
  }

  function segmentEndPlace(index) {
    return placeById(state.scene.routeIds[index + 1]);
  }

  function displacementPoint(place) {
    return pointOnly(place.position);
  }

  function defaultArrow(tail) {
    return {
      tail: { ...tail },
      head: {
        x: clamp(tail.x + 16, 3, SVG_WIDTH - 3),
        y: clamp(tail.y - 12, 3, SVG_HEIGHT - 3)
      }
    };
  }

  function submitAttempt() {
    const result = Scoring.scoreJourney(currentAnswer(), journeyForScene(state.scene));
    state.result = result;
    showResult(result);
    window.SimScorm.submitResult(result, reviewState(result));
    lockAttempt("此作答次已提交。如要重新作答，請返回活動入口並開始新的作答次。");
  }

  function reviewState(result) {
    return {
      seed: state.scene.seed,
      routeIds: state.scene.routeIds,
      segments: state.segments.map((segment) => ({
        reached: segment.reached,
        routeDistance: round1(segment.routeDistance),
        trace: compactTrace(segment.trace),
        arrow: compactArrow(segment.arrow),
        answers: cloneAnswers(segment.answers)
      })),
      totalArrow: compactArrow(state.totalArrow),
      totalAnswers: cloneAnswers(state.totalAnswers),
      result: compactResult(result)
    };
  }

  function compactTrace(trace) {
    const points = trace.length <= REVIEW_TRACE_POINT_CAP
      ? trace
      : Array.from({ length: REVIEW_TRACE_POINT_CAP }, (_, index) => {
          const sourceIndex = Math.round(index * (trace.length - 1) / (REVIEW_TRACE_POINT_CAP - 1));
          return trace[sourceIndex];
        });
    return points.map(compactPoint);
  }

  function compactArrow(arrow) {
    return arrow
      ? {
          tail: compactPoint(arrow.tail),
          head: compactPoint(arrow.head)
        }
      : null;
  }

  function compactPoint(point) {
    return [round1(point.x), round1(point.y)];
  }

  function compactResult(result) {
    return {
      score: result.score,
      passed: result.passed,
      feedbackItems: result.feedbackItems,
      summary: result.summary
    };
  }

  function showSubmittedAttempt() {
    const review = readReviewState();
    if (!review.seed || !review.routeIds) {
      scorePanel.replaceChildren(
        textBlock("div", "此作答次已提交"),
        textBlock("div", String(window.SimScorm.getValue("cmi.core.score.raw") || "--"), "score-value"),
        textBlock("div", "未能載入已提交地圖。", "muted feedback-summary")
      );
      state.locked = true;
      return;
    }
    state.scene = buildScene(review.seed, review.routeIds);
    state.segments = (review.segments || [blankSegment(), blankSegment()]).map((segment) => ({
      reached: Boolean(segment.reached),
      routeDistance: segment.routeDistance || 0,
      trace: expandTrace(segment.trace || []),
      arrow: expandArrow(segment.arrow),
      answers: segment.answers || null
    }));
    while (state.segments.length < 2) state.segments.push(blankSegment());
    state.totalArrow = expandArrow(review.totalArrow);
    state.totalAnswers = review.totalAnswers || null;
    state.person = nearestRoadPosition(placeById(state.scene.routeIds[2]).entrance);
    state.result = review.result || null;
    state.phase = "submitted";
    showResult(state.result || {
      score: window.SimScorm.getValue("cmi.core.score.raw") || "--",
      passed: false,
      feedbackItems: [],
      summary: "此作答次已提交。"
    });
    lockAttempt();
  }

  function expandTrace(trace) {
    return trace.map((point) => Array.isArray(point) ? { x: point[0], y: point[1] } : point);
  }

  function expandArrow(arrow) {
    if (!arrow) return null;
    const point = (item) => Array.isArray(item) ? { x: item[0], y: item[1] } : item;
    return {
      tail: point(arrow.tail),
      head: point(arrow.head)
    };
  }

  function readReviewState() {
    try {
      return JSON.parse(window.SimScorm.getValue("cmi.suspend_data") || "{}");
    } catch {
      return {};
    }
  }

  function lockAttempt(message) {
    state.locked = true;
    state.drag = null;
    state.phase = "submitted";
    segmentAnswerButton.disabled = true;
    finalAnswerButton.disabled = true;
    if (message) scorePanel.append(textBlock("div", message, "muted feedback-summary"));
    render();
  }

  function showResult(result) {
    scorePanel.replaceChildren(
      textBlock("div", "目前分數"),
      textBlock("div", String(result.score), "score-value"),
      textBlock("div", result.passed ? "已通過" : "未通過")
    );
    const list = document.createElement("ul");
    list.className = "feedback-list";
    (result.feedbackItems || []).forEach((item) => {
      list.append(textBlock("li", item.text, `feedback-item ${item.status}`));
    });
    scorePanel.append(list, textBlock("div", result.summary || "", "muted feedback-summary"));
  }

  function textBlock(tagName, text, className) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function render() {
    if (!state.scene) return;
    renderMap();
    renderTrace();
    renderArrows();
    renderPerson();
    renderPanel();
  }

  function renderMap() {
    roadLayer.replaceChildren(
      ...state.scene.edges.map((edge) => roadLine(edge, "road-line-edge")),
      ...state.scene.edges.map((edge) => roadLine(edge, "road-line"))
    );
    blockLayer.replaceChildren(
      ...state.scene.blocks.map((rect) => svgElement("rect", {
        class: "neutral-block",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        rx: 0.8
      }))
    );
    placeLayer.replaceChildren(...state.scene.places.flatMap(renderPlace));
  }

  function roadLine(edge, className) {
    return svgElement("line", {
      class: className,
      x1: edge.a.x,
      y1: edge.a.y,
      x2: edge.b.x,
      y2: edge.b.y
    });
  }

  function renderPlace(place) {
    const isTarget =
      state.phase === "walk" &&
      place.id === state.scene.routeIds[state.currentSegment + 1];
    const rectClass = [
      "place-rect",
      isTarget ? "is-target" : ""
    ].filter(Boolean).join(" ");
    const items = [
      svgElement("rect", {
        class: rectClass,
        x: place.rect.x,
        y: place.rect.y,
        width: place.rect.width,
        height: place.rect.height,
        rx: 1.1
      }),
      svgText(place.label, place.center.x, place.center.y, "place-label"),
      svgElement("circle", {
        class: "position-dot",
        cx: place.position.x,
        cy: place.position.y,
        r: 0.95
      })
    ];
    return items;
  }

  function renderTrace() {
    traceLayer.replaceChildren();
    state.segments.forEach((segment, index) => {
      if (segment.trace.length < 2) return;
      traceLayer.append(svgElement("polyline", {
        class: `trace-line segment-${index === 0 ? "one" : "two"}`,
        points: segment.trace.map((point) => `${point.x},${point.y}`).join(" ")
      }));
    });
  }

  function renderArrows() {
    arrowLayer.replaceChildren();
    state.segments.forEach((segment, index) => {
      if (!segment.arrow) return;
      renderArrow(segment.arrow, index === 0 ? "segment-one" : "segment-two", `第 ${index + 1} 段`, {
        draggable: state.phase === "draw-segment" && state.currentSegment === index,
        key: "segment"
      });
    });
    if (state.totalArrow) {
      renderArrow(state.totalArrow, "total", "總位移", {
        draggable: state.phase === "draw-total",
        key: "total"
      });
    }
  }

  function renderArrow(arrow, className, label, options) {
    const isDragging = options.draggable && state.drag?.kind === "arrow" && state.drag.key === options.key;
    arrowLayer.append(svgElement("line", {
      class: `displacement-line ${className}${isDragging ? " is-dragging" : ""}`,
      x1: arrow.tail.x,
      y1: arrow.tail.y,
      x2: arrow.head.x,
      y2: arrow.head.y
    }));
    const mid = {
      x: (arrow.tail.x + arrow.head.x) / 2,
      y: (arrow.tail.y + arrow.head.y) / 2
    };
    arrowLayer.append(svgText(label, mid.x, mid.y - 2.5, "place-label"));
    if (!options.draggable) return;
    const colorClass = className === "total" ? "var(--force-resultant)" : className === "segment-one" ? "var(--color-accent)" : "var(--force-applied)";
    arrowLayer.append(
      svgElement("circle", {
        class: `arrow-handle${isDragging ? " is-dragging" : ""}`,
        cx: arrow.head.x,
        cy: arrow.head.y,
        r: 1.7,
        stroke: colorClass
      }),
      svgElement("circle", {
        class: "arrow-hit",
        cx: arrow.head.x,
        cy: arrow.head.y,
        r: 8.5,
        "data-arrow": options.key
      })
    );
  }

  function renderPerson() {
    personLayer.replaceChildren();
    if (!state.person) return;
    const group = svgElement("g", {
      class: `person-marker${state.drag?.kind === "person" ? " is-dragging" : ""}`,
      transform: `translate(${state.person.x} ${state.person.y})`
    });
    group.append(
      svgElement("ellipse", { class: "person-shadow", cx: 0, cy: 2.3, rx: 2.4, ry: 0.7 }),
      svgElement("circle", { class: "person-head", cx: 0, cy: -2.1, r: 1.3 }),
      svgElement("path", { class: "person-body", d: "M -1.3 -0.7 L 1.3 -0.7 L 1.8 2 L -1.8 2 Z" }),
      svgElement("circle", {
        class: "person-hit",
        cx: 0,
        cy: 0,
        r: 8.5,
        "data-person-hit": "true"
      })
    );
    personLayer.append(group);
  }

  function renderPanel() {
    const labels = currentRouteLabels();
    const segment = state.segments[state.currentSegment] || state.segments[1];
    const activeArrow = currentArrow();
    const activeArrowSnapped = isCurrentArrowSnapped();
    taskText.textContent = `題目：由${labels[0]}出發，先到${labels[1]}，再到${labels[2]}。`;
    routeReadout.textContent = `${labels[0]} → ${labels[1]} → ${labels[2]}`;
    statusText.textContent = statusMessage(labels);
    instructionText.textContent = instructionMessage(labels);
    segmentDistance.textContent = `${round1(segment?.routeDistance || 0)} m`;
    totalDistance.textContent = `${round1(totalRouteDistance())} m`;
    if (activeArrow) {
      const item = Scoring.vector(activeArrow.tail, activeArrow.head);
      arrowMagnitude.textContent = `${round1(Scoring.vectorMagnitude(item))} m`;
      arrowDirection.textContent = Scoring.formatBearing(Scoring.bearingFromVector(item));
    } else {
      arrowMagnitude.textContent = "--";
      arrowDirection.textContent = "--";
    }
    segmentAnswerButton.disabled = state.locked || state.phase !== "draw-segment" || !activeArrowSnapped;
    finalAnswerButton.disabled = state.locked || state.phase !== "draw-total" || !activeArrowSnapped;
    renderAnswerHint(activeArrowSnapped);
  }

  function renderAnswerHint(activeArrowSnapped) {
    const canAnswer =
      !state.locked &&
      activeArrowSnapped &&
      (state.phase === "draw-segment" || state.phase === "draw-total");
    answerHint.hidden = !canAnswer;
    if (!canAnswer) return;
    answerHint.textContent =
      state.phase === "draw-total"
        ? "已可答題，向下滑按「填寫總結答案」。"
        : "已可答題，向下滑按「填寫本段答案」。";
  }

  function statusMessage(labels) {
    if (state.phase === "submitted") return "此作答次已提交，現在只能檢視。";
    if (state.phase === "draw-total") return `已完成兩段旅程：${labels[0]} → ${labels[1]} → ${labels[2]}。`;
    return `第 ${state.currentSegment + 1} 段：${labels[state.currentSegment]} → ${labels[state.currentSegment + 1]}。`;
  }

  function instructionMessage(labels) {
    if (state.phase === "walk") {
      return `拖曳小人沿道路由${labels[state.currentSegment]}前往${labels[state.currentSegment + 1]}。來回走動也會增加路程。`;
    }
    if (state.phase === "draw-segment") {
      return `已到達${labels[state.currentSegment + 1]}。拖曳位移箭頭終點，然後填寫本段答案。`;
    }
    if (state.phase === "draw-total") {
      return `拖曳總位移箭頭，由${labels[0]}直接指向${labels[2]}，然後填寫總結答案。`;
    }
    return "此作答次已提交。如要重新作答，請返回活動入口並開始新的作答次。";
  }

  function currentArrow() {
    if (state.phase === "draw-segment") return state.segments[state.currentSegment].arrow;
    if (state.phase === "draw-total") return state.totalArrow;
    return null;
  }

  function currentArrowDestination() {
    if (state.phase === "draw-segment") return displacementPoint(segmentEndPlace(state.currentSegment));
    if (state.phase === "draw-total") return displacementPoint(placeById(state.scene.routeIds[2]));
    return null;
  }

  function isCurrentArrowSnapped() {
    const arrow = currentArrow();
    const destination = currentArrowDestination();
    return Boolean(
      arrow &&
        destination &&
        Scoring.pointDistance(arrow.head, destination) <= ARROW_SNAPPED_TOLERANCE_M
    );
  }

  function totalRouteDistance() {
    return state.segments.reduce((sum, segment) => sum + (segment.routeDistance || 0), 0);
  }

  function openSegmentDialog() {
    if (!isCurrentArrowSnapped()) return;
    openAnswerDialog({
      type: "segment",
      index: state.currentSegment,
      title: `第 ${state.currentSegment + 1} 段答案`,
      prompt: `由${segmentStartPlace(state.currentSegment).label}到${segmentEndPlace(state.currentSegment).label}：根據上方讀數，選出本段的路程、位移大小和位移方向。`,
      routeLegendText: "本段路程"
    });
  }

  function openFinalDialog() {
    if (!isCurrentArrowSnapped()) return;
    const labels = currentRouteLabels();
    openAnswerDialog({
      type: "total",
      title: "總結答案",
      prompt: `由${labels[0]}到${labels[2]}全程：根據上方讀數，選出總路程、總位移大小和總位移方向。`,
      routeLegendText: "總路程"
    });
  }

  function openAnswerDialog(mode) {
    state.dialogMode = mode;
    state.dialogSelection = {
      routeDistance: null,
      displacementMagnitude: null,
      direction: null
    };
    const choices = answerChoiceData(mode);
    dialogTitle.textContent = mode.title;
    dialogPrompt.textContent = mode.prompt;
    routeLegend.textContent = mode.routeLegendText;
    renderAnswerReadout(choices.readout);
    renderChoiceGroup(routeChoices, "routeDistance", choices.routeDistance);
    renderChoiceGroup(magnitudeChoices, "displacementMagnitude", choices.displacementMagnitude);
    renderChoiceGroup(directionChoices, "direction", choices.direction);
    saveAnswerButton.disabled = true;
    answerDialog.showModal();
  }

  function saveDialogAnswer() {
    if (!isDialogComplete()) return;
    const answer = {
      routeDistance: state.dialogSelection.routeDistance,
      displacementMagnitude: state.dialogSelection.displacementMagnitude,
      direction: state.dialogSelection.direction
    };
    if (state.dialogMode.type === "segment") {
      state.segments[state.dialogMode.index].answers = answer;
      if (state.dialogMode.index === 0) {
        startWalkSegment(1);
      } else {
        state.phase = "draw-total";
        state.totalArrow = defaultArrow(displacementPoint(placeById(state.scene.routeIds[0])));
      }
      render();
      return;
    }
    state.totalAnswers = answer;
    submitAttempt();
  }

  function answerChoiceData(mode) {
    if (mode.type === "segment") {
      const segment = state.segments[mode.index];
      const expected = Scoring.expectedSegment(journeyForScene(state.scene), mode.index);
      return buildAnswerChoices({
        routeDistance: segment.routeDistance,
        displacementMagnitude: expected.magnitude,
        bearing: expected.bearing,
        readout: [
          ["小人已走過的距離", `${round1(segment.routeDistance)} m`],
          ["兩地位置點的直線距離", `${round1(expected.magnitude)} m`],
          ["由起點指向終點的方向", Scoring.formatBearing(expected.bearing)]
        ],
        routeAlternates: [expected.magnitude, totalRouteDistance()],
        magnitudeAlternates: [segment.routeDistance, totalRouteDistance()]
      });
    }
    const expected = Scoring.expectedTotal(journeyForScene(state.scene));
    return buildAnswerChoices({
      routeDistance: totalRouteDistance(),
      displacementMagnitude: expected.magnitude,
      bearing: expected.bearing,
      readout: [
        ["第 1 段小人走過的距離", `${round1(state.segments[0].routeDistance)} m`],
        ["第 2 段小人走過的距離", `${round1(state.segments[1].routeDistance)} m`],
        ["小人全程走過的距離", `${round1(totalRouteDistance())} m`],
        ["第一地點到最後地點的直線距離", `${round1(expected.magnitude)} m`],
        ["由第一地點指向最後地點的方向", Scoring.formatBearing(expected.bearing)]
      ],
      routeAlternates: [
        expected.magnitude,
        state.segments[0].routeDistance,
        state.segments[1].routeDistance
      ],
      magnitudeAlternates: [totalRouteDistance(), state.segments[0].routeDistance]
    });
  }

  function buildAnswerChoices(data) {
    return {
      readout: data.readout,
      routeDistance: distanceChoices(data.routeDistance, data.routeAlternates),
      displacementMagnitude: distanceChoices(data.displacementMagnitude, data.magnitudeAlternates),
      direction: directionChoicesForBearing(data.bearing)
    };
  }

  function distanceChoices(correct, alternates) {
    const value = round1(correct);
    const delta = Math.max(2, round1(Math.abs(value) * 0.15));
    const choices = [value].concat(
      (alternates || []).map(round1),
      round1(value + delta),
      round1(Math.max(0, value - delta)),
      round1(value + delta * 2)
    );
    return rotateChoices(uniqueValues(choices).slice(0, 4).map((item) => ({
      label: `${item} m`,
      value: item
    })), value);
  }

  function directionChoicesForBearing(bearing) {
    const bearings = [
      bearing,
      Scoring.normalizeBearing(bearing + 90),
      Scoring.normalizeBearing(bearing + 180),
      Scoring.normalizeBearing(bearing - 90)
    ];
    const options = [];
    bearings.forEach((item) => {
      const answer = directionAnswerForBearing(item);
      const label = directionLabel(answer);
      if (!options.some((option) => option.label === label)) {
        options.push({ label, value: answer, iconAngle: Math.round(Scoring.normalizeBearing(item)) });
      }
    });
    return options.slice(0, 4);
  }

  function directionAnswerForBearing(bearing) {
    const value = Math.round(Scoring.normalizeBearing(bearing));
    if (Scoring.angleDistance(value, 0) < 0.5) return { directionType: "north" };
    if (Scoring.angleDistance(value, 90) < 0.5) return { directionType: "east" };
    if (Scoring.angleDistance(value, 180) < 0.5) return { directionType: "south" };
    if (Scoring.angleDistance(value, 270) < 0.5) return { directionType: "west" };
    if (value < 90) return { directionType: "north-east", angle: value };
    if (value < 180) return { directionType: "south-east", angle: 180 - value };
    if (value < 270) return { directionType: "south-west", angle: value - 180 };
    return { directionType: "north-west", angle: 360 - value };
  }

  function directionLabel(answer) {
    const labels = {
      north: "向北",
      east: "向東",
      south: "向南",
      west: "向西",
      "north-east": "北偏東",
      "south-east": "南偏東",
      "south-west": "南偏西",
      "north-west": "北偏西"
    };
    return answer.angle == null
      ? labels[answer.directionType]
      : `${labels[answer.directionType]} ${answer.angle}°`;
  }

  function uniqueValues(values) {
    const seen = new Set();
    return values.filter((value) => {
      if (!Number.isFinite(value) || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  function rotateChoices(choices, seed) {
    if (!choices.length) return choices;
    const offset = Math.abs(Math.round(seed * 10)) % choices.length;
    return choices.slice(offset).concat(choices.slice(0, offset));
  }

  function renderAnswerReadout(items) {
    answerReadout.replaceChildren(
      ...items.map(([label, value]) => {
        const row = document.createElement("div");
        row.append(textBlock("span", label), textBlock("b", value));
        return row;
      })
    );
  }

  function renderChoiceGroup(container, key, options) {
    container.replaceChildren();
    options.forEach((option, index) => {
      const id = `${key}-${index}`;
      const input = document.createElement("input");
      input.className = "choice-input";
      input.type = "radio";
      input.id = id;
      input.name = key;
      input.required = true;
      input.addEventListener("change", () => {
        state.dialogSelection[key] = option.value;
        saveAnswerButton.disabled = !isDialogComplete();
      });
      const label = document.createElement("label");
      label.className = key === "direction" ? "choice-option direction-option" : "choice-option";
      label.htmlFor = id;
      if (key === "direction") {
        label.setAttribute("aria-label", option.label);
        label.style.setProperty("--direction-angle", `${option.iconAngle}deg`);
        label.append(textBlock("span", "", "direction-icon"));
      } else {
        label.textContent = option.label;
      }
      container.append(input, label);
    });
  }

  function isDialogComplete() {
    return Boolean(
      state.dialogSelection?.routeDistance != null &&
        state.dialogSelection?.displacementMagnitude != null &&
        state.dialogSelection?.direction
    );
  }

  function svgPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function shouldShowDragPreview(event) {
    return event.pointerType === "touch" || event.pointerType === "pen";
  }

  function dragFocusPoint(fallback) {
    if (state.drag?.kind === "person" && state.person) return pointOnly(state.person);
    if (state.drag?.kind === "arrow") return pointOnly(currentArrow()?.head || fallback);
    return fallback;
  }

  function updateDragPreview(event, point) {
    if (!dragPreview || !dragPreviewSvg || !state.drag?.preview) return;
    const focus = dragFocusPoint(point);
    const viewX = clamp(focus.x - PREVIEW_VIEWBOX_WIDTH / 2, 0, SVG_WIDTH - PREVIEW_VIEWBOX_WIDTH);
    const viewY = clamp(focus.y - PREVIEW_VIEWBOX_HEIGHT / 2, 0, SVG_HEIGHT - PREVIEW_VIEWBOX_HEIGHT);
    dragPreviewSvg.setAttribute("viewBox", [
      viewX,
      viewY,
      PREVIEW_VIEWBOX_WIDTH,
      PREVIEW_VIEWBOX_HEIGHT
    ].join(" "));
    dragPreview.style.setProperty("--preview-focus-x", `${(focus.x - viewX) / PREVIEW_VIEWBOX_WIDTH * 100}%`);
    dragPreview.style.setProperty("--preview-focus-y", `${(focus.y - viewY) / PREVIEW_VIEWBOX_HEIGHT * 100}%`);
    dragPreviewSvg.replaceChildren(...Array.from(svg.children).map(clonePreviewChild));
    dragPreview.classList.add("is-active");

    const stageRect = svg.parentElement.getBoundingClientRect();
    const width = dragPreview.offsetWidth;
    const height = dragPreview.offsetHeight;
    const maxLeft = Math.max(PREVIEW_MARGIN_PX, stageRect.width - width - PREVIEW_MARGIN_PX);
    const maxTop = Math.max(PREVIEW_MARGIN_PX, stageRect.height - height - PREVIEW_MARGIN_PX);
    const localX = event.clientX - stageRect.left;
    const localY = event.clientY - stageRect.top;
    const left = localX < stageRect.width / 2 ? maxLeft : PREVIEW_MARGIN_PX;
    const top = localY < stageRect.height / 2 ? maxTop : PREVIEW_MARGIN_PX;
    dragPreview.style.transform = `translate(${left}px, ${top}px)`;
  }

  function clonePreviewChild(child) {
    const clone = child.cloneNode(true);
    clone.querySelectorAll?.("[data-person-hit], [data-arrow]").forEach((element) => {
      element.removeAttribute("data-person-hit");
      element.removeAttribute("data-arrow");
    });
    return clone;
  }

  function hideDragPreview() {
    dragPreview?.classList.remove("is-active");
  }

  function onPointerDown(event) {
    if (state.locked) return;
    const arrowTarget = event.target.closest("[data-arrow]");
    if (arrowTarget && currentArrow()) {
      const point = svgPoint(event);
      state.drag = {
        kind: "arrow",
        key: arrowTarget.dataset.arrow,
        preview: shouldShowDragPreview(event)
      };
      svg.setPointerCapture?.(event.pointerId);
      render();
      updateDragPreview(event, point);
      event.preventDefault();
      return;
    }
    const personTarget = event.target.closest("[data-person-hit]");
    if (personTarget && state.phase === "walk") {
      const point = svgPoint(event);
      state.drag = {
        kind: "person",
        offset: { x: state.person.x - point.x, y: state.person.y - point.y },
        preview: shouldShowDragPreview(event)
      };
      svg.setPointerCapture?.(event.pointerId);
      render();
      updateDragPreview(event, point);
      event.preventDefault();
    }
  }

  function onPointerMove(event) {
    if (!state.drag) return;
    const point = svgPoint(event);
    if (state.drag.kind === "person") {
      movePerson({
        x: point.x + state.drag.offset.x,
        y: point.y + state.drag.offset.y
      });
    } else {
      moveArrow(point);
    }
    if (state.drag) {
      render();
      updateDragPreview(event, point);
    } else {
      hideDragPreview();
    }
    event.preventDefault();
  }

  function onPointerUp(event) {
    state.drag = null;
    hideDragPreview();
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    render();
  }

  function movePerson(point) {
    const next = nearestRoadPosition(point);
    if (!next || next.distance > PERSON_DRAG_ROAD_TOLERANCE_M) return;
    const segment = state.segments[state.currentSegment];
    const path = roadPath(state.person, next);
    const isTurning = state.person.edgeId !== next.edgeId;
    if (!Number.isFinite(path.distance) || (isTurning && path.distance > PERSON_DRAG_TURN_LIMIT_M)) return;
    segment.routeDistance += path.distance;
    state.person = next;
    path.points.slice(1).forEach((pathPoint) => pushTracePoint(segment, pathPoint));
    if (reachedTarget()) completeCurrentSegment();
  }

  function moveArrow(point) {
    const arrow = currentArrow();
    if (!arrow) return;
    const head = {
      x: clamp(point.x, 1, SVG_WIDTH - 1),
      y: clamp(point.y, 1, SVG_HEIGHT - 1)
    };
    const destination = currentArrowDestination();
    arrow.head =
      destination && Scoring.pointDistance(head, destination) <= ARROW_SNAP_TOLERANCE_M
        ? destination
        : head;
  }

  function reachedTarget() {
    const target = segmentEndPlace(state.currentSegment);
    return (
      Scoring.pointDistance(pointOnly(state.person), target.entrance) <=
        Scoring.DESTINATION_REACH_TOLERANCE_M ||
      pointInRect(pointOnly(state.person), expandRect(target.rect, 1))
    );
  }

  function pointInRect(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  function pushTracePoint(segment, point) {
    segment.trace.push(point);
  }

  function pointOnly(point) {
    return { x: round1(point.x), y: round1(point.y) };
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function svgElement(name, attrs) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  function svgText(text, x, y, className) {
    const element = svgElement("text", { class: className, x, y });
    element.textContent = text;
    return element;
  }

  segmentAnswerButton.addEventListener("click", openSegmentDialog);
  finalAnswerButton.addEventListener("click", openFinalDialog);
  answerForm.addEventListener("submit", (event) => {
    if (event.submitter?.value !== "save") return;
    event.preventDefault();
    if (!answerForm.reportValidity()) return;
    saveDialogAnswer();
    answerDialog.close("save");
  });
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);

  window.SimScorm.init();
  if (window.SimScorm.isAttemptFinished()) {
    showSubmittedAttempt();
  } else {
    startNewAttempt();
  }
})();
