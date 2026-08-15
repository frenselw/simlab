(function (root, factory) {
  const api = factory({
    Generator: typeof module === "object" && module.exports ? require("./generator.js") : root.ForceCompositionGenerator,
    Notation: typeof module === "object" && module.exports ? require("./notation.js") : root.ForceCompositionNotation,
    Model: typeof module === "object" && module.exports ? require("./model.js") : root.ForceCompositionModel,
    Scoring: typeof module === "object" && module.exports ? require("./scoring.js") : root.ForceCompositionScoring,
    Persistence: typeof module === "object" && module.exports ? require("./persistence.js") : root.ForceCompositionPersistence,
    UiRuntime: typeof module === "object" && module.exports ? require("./ui-runtime.js") : root.ForceCompositionUiRuntime,
    SimScorm: root?.SimScorm,
    SimActivityFlow: root?.SimActivityFlow,
    document: root?.document,
    window: root?.window || root
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceCompositionApp = api;
})(typeof window !== "undefined" ? window : globalThis, function (dependencies) {
  "use strict";

  const { Generator: G, Notation: N, Model: M, Scoring: S, Persistence: P, UiRuntime: UI } = dependencies;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const QUESTION_COPY = Object.freeze([
    Object.freeze({ type: "平行四邊形法則・基礎一", title: "用平行四邊形法則作出兩力合力", prompt: "先把兩個箭尾移到共同起點，再由兩個箭頭各畫一條虛線輔助線，最後畫出對角線合力。" }),
    Object.freeze({ type: "平行四邊形法則・基礎二", title: "自行選擇正確端點完成平行四邊形", prompt: "完成平行四邊形，再由正確起點畫出合力。中性端點不代表每一個選擇都正確。" }),
    Object.freeze({ type: "首尾相接法・基礎一", title: "用首尾相接法作出兩力合力", prompt: "任選一個力，在任意位置開始作圖；再把另一個力的箭尾接到第一個力的箭頭。兩個次序都可以。" }),
    Object.freeze({ type: "首尾相接法・基礎二", title: "自行安排兩個力的首尾次序", prompt: "在任意位置開始，將兩個力排成單一首尾力鏈，再由力鏈起點畫到終點。" }),
    Object.freeze({ type: "三力合成・進階題", title: "用首尾相接法作出三力合力", prompt: "在任意位置開始，將三個力各使用一次，按任意次序接成單一力鏈，再畫出三力合力。" })
  ]);

  function dependencyIssue(values = dependencies) {
    const required = ["Generator", "Notation", "Model", "Scoring", "Persistence", "UiRuntime", "SimScorm", "SimActivityFlow"];
    return required.find((key) => !values[key]) || null;
  }

  function stepPrompt(answer, question) {
    const variant = M.derivedVariant(answer, question);
    if (variant === "complete") return "本題已完成。你仍可修改、復原或前往其他題目。";
    if (question.type === "parallelogram") {
      if (variant === "fresh" || variant === "placing") {
        const count = answer.placements.filter((placement) => placement.mode === "snap" && placement.targetKey === "ORIGIN").length;
        return count ? "再把另一個力的箭尾移到同一個共同起點。" : "先選擇任意位置作為共同起點，再放置第一個力。";
      }
      if (variant === "guides") return question.guided ? "由目前顯示的箭頭端點拖出虛線輔助線；方向接近對邊平行時會自動吸附，線長不限。" : "自行選擇端點，畫出兩條與對邊平行的虛線輔助線；方向接近時會自動吸附，線長不限。";
      return "兩條輔助線已畫出；按「開始畫合力」鎖定前面作圖，再由任意端點或舞台空白位置畫出合力。";
    }
    const chain = M.chainInfo(answer, question);
    if (!chain.order.length) return "任選一個力，在任意位置開始作圖。";
    if (!chain.complete) return `已接上 ${chain.order.length} 個力；把另一個力的箭尾接到目前力鏈的自由箭頭。`;
    return question.guided ? "由共同起點拖至力鏈終點，畫出合力。" : "自行選擇正確起點，畫至整條力鏈的終點。";
  }

  function questionView(state, scenario, index) {
    const answer = state.answers[index];
    const question = scenario.questions[index];
    return {
      ...QUESTION_COPY[index],
      id: question.id,
      index,
      variant: M.derivedVariant(answer, question),
      complete: M.questionComplete(answer, question),
      step: stepPrompt(answer, question),
      forceCount: question.forces.length
    };
  }

  if (!dependencies.document) return Object.freeze({ QUESTION_COPY, dependencyIssue, stepPrompt, questionView });

  const documentObject = dependencies.document;
  const windowObject = dependencies.window;
  const SimScorm = dependencies.SimScorm;
  const SimActivityFlow = dependencies.SimActivityFlow;
  const dom = {};
  let state = null;
  let scenario = null;
  let attempt = null;
  let presentation = "technical";
  let trustedReview = false;
  let reviewResult = null;
  let correctOverlay = false;
  let resultantMode = false;
  let unsaved = false;
  let pendingFreshState = null;
  let submitting = false;
  let drag = null;
  let keyboardLine = null;
  let nearSnapPoint = null;
  let stageCamera = { x: 0, y: 0, width: G.WIDTH, height: G.HEIGHT };
  const undoStacks = Array.from({ length: 5 }, () => []);
  const eventTelemetry = [];
  const touchTelemetry = [];

  function cacheDom() {
    for (const id of [
      "app", "questionCounter", "attemptStatus", "stage", "stageSvg", "dragLayer", "controlPanel", "magnifier", "magnifierLabel", "magnifierLine",
      "saveBanner", "saveBannerText", "retrySave", "technicalPanel", "technicalTitle", "technicalMessage", "technicalActions",
      "practicePanel", "questionType", "questionTitle", "questionPrompt", "formula", "stepPrompt", "lineTools", "drawResultant", "questionProgress",
      "undo", "resetQuestion", "previousQuestion", "nextQuestion", "goSummary", "summaryPanel", "summaryList", "summaryWarning",
      "submitAttempt", "returnToPractice", "submitStatus", "reviewPanel", "reviewTitle", "reviewScore", "reviewCompletion",
      "reviewQuestionNavigation", "toggleCorrect", "reviewFeedback", "reviewActions", "liveRegion", "submitDialog", "submitDialogMessage",
      "confirmSubmit", "resetDialog", "confirmReset"
    ]) dom[id] = documentObject.getElementById(id);
  }

  function createSvg(name, attributes = {}) {
    const node = documentObject.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  function drawLine(parent, start, end, className, attributes = {}) {
    const line = createSvg("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: className, ...attributes });
    parent.append(line);
    return line;
  }

  function arrowPathData(start, end, options = {}) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return `M ${start.x} ${start.y} Z`;
    const ux = dx / length;
    const uy = dy / length;
    const nx = -uy;
    const ny = ux;
    const isResultant = options.className?.includes("resultant-line");
    const isCorrect = options.className?.includes("correct-overlay");
    const shaftWidth = isResultant ? 6 : isCorrect ? 3 : 5;
    const nominalHeadLength = isResultant ? 26 : isCorrect ? 15 : 22;
    const nominalHeadWidth = isResultant ? 25 : isCorrect ? 14 : 21;
    const headLength = Math.min(nominalHeadLength, length * 0.45);
    const headWidth = Math.min(nominalHeadWidth, length * 0.65);
    const bodyWidth = Math.min(shaftWidth, length * 0.35);
    const base = { x: end.x - ux * headLength, y: end.y - uy * headLength };
    const bodyLeft = { x: base.x + nx * bodyWidth / 2, y: base.y + ny * bodyWidth / 2 };
    const bodyRight = { x: base.x - nx * bodyWidth / 2, y: base.y - ny * bodyWidth / 2 };
    const headLeft = { x: base.x + nx * headWidth / 2, y: base.y + ny * headWidth / 2 };
    const headRight = { x: base.x - nx * headWidth / 2, y: base.y - ny * headWidth / 2 };
    const tailLeft = { x: start.x + nx * bodyWidth / 2, y: start.y + ny * bodyWidth / 2 };
    const tailRight = { x: start.x - nx * bodyWidth / 2, y: start.y - ny * bodyWidth / 2 };
    return [tailLeft, bodyLeft, headLeft, end, headRight, bodyRight, tailRight]
      .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
      .join(" ") + " Z";
  }

  function drawArrow(parent, start, end, options = {}) {
    const className = options.className || "force-line";
    const path = createSvg("path", {
      d: arrowPathData(start, end, { ...options, className }),
      class: className,
      ...(options.forceIndex == null ? {} : { "data-force-index": options.forceIndex })
    });
    parent.append(path);
    return { path };
  }

  function drawGrid(parent) {
    for (let x = 0; x <= G.WIDTH; x += 40) drawLine(parent, { x, y: 0 }, { x, y: G.HEIGHT }, "grid-line");
    for (let y = 0; y <= G.HEIGHT; y += 40) drawLine(parent, { x: 0, y }, { x: G.WIDTH, y }, "grid-line");
  }

  function pointSegmentDistance(point, start, end) {
    const vx = end.x - start.x;
    const vy = end.y - start.y;
    const length2 = vx * vx + vy * vy;
    const ratio = length2 ? Math.max(0, Math.min(1, ((point.x - start.x) * vx + (point.y - start.y) * vy) / length2)) : 0;
    return Math.hypot(point.x - (start.x + ratio * vx), point.y - (start.y + ratio * vy));
  }

  function orientation(first, second, third) {
    return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
  }

  function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
    const first = orientation(firstStart, firstEnd, secondStart);
    const second = orientation(firstStart, firstEnd, secondEnd);
    const third = orientation(secondStart, secondEnd, firstStart);
    const fourth = orientation(secondStart, secondEnd, firstEnd);
    const epsilon = 0.0001;
    const onSegment = (start, end, point) => Math.abs(orientation(start, end, point)) <= epsilon &&
      point.x >= Math.min(start.x, end.x) - epsilon && point.x <= Math.max(start.x, end.x) + epsilon &&
      point.y >= Math.min(start.y, end.y) - epsilon && point.y <= Math.max(start.y, end.y) + epsilon;
    return (first * second < 0 && third * fourth < 0) ||
      (Math.abs(first) <= epsilon && onSegment(firstStart, firstEnd, secondStart)) ||
      (Math.abs(second) <= epsilon && onSegment(firstStart, firstEnd, secondEnd)) ||
      (Math.abs(third) <= epsilon && onSegment(secondStart, secondEnd, firstStart)) ||
      (Math.abs(fourth) <= epsilon && onSegment(secondStart, secondEnd, firstEnd));
  }

  function segmentSegmentDistance(firstStart, firstEnd, secondStart, secondEnd) {
    if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0;
    return Math.min(
      pointSegmentDistance(firstStart, secondStart, secondEnd),
      pointSegmentDistance(firstEnd, secondStart, secondEnd),
      pointSegmentDistance(secondStart, firstStart, firstEnd),
      pointSegmentDistance(secondEnd, firstStart, firstEnd)
    );
  }

  function segmentRectDistance(start, end, rect) {
    const corners = [
      { x: rect.left, y: rect.top }, { x: rect.right, y: rect.top },
      { x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }
    ];
    const edges = corners.map((corner, index) => [corner, corners[(index + 1) % corners.length]]);
    if (corners.some((corner) => pointSegmentDistance(corner, start, end) === 0) ||
        (start.x >= rect.left && start.x <= rect.right && start.y >= rect.top && start.y <= rect.bottom) ||
        (end.x >= rect.left && end.x <= rect.right && end.y >= rect.top && end.y <= rect.bottom)) return 0;
    return Math.min(...edges.map(([edgeStart, edgeEnd]) => segmentSegmentDistance(start, end, edgeStart, edgeEnd)));
  }

  function forceLabelPosition(start, end, occupied = [], segments = []) {
    const length = Math.max(1, M.distance(start, end));
    const ux = (end.x - start.x) / length;
    const uy = (end.y - start.y) / length;
    const nx = -uy;
    const ny = ux;
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    // The SVG text's x/y is a centered horizontal anchor plus a baseline, not
    // the visual centre of the glyph. Keep the collision box close to the
    // actual painted symbol so labels can sit near a vector without touching it.
    const width = 30;
    const height = 36;
    const baselineOffset = -5;
    const labelGap = 4;
    const lineGap = 3;
    const labelRect = (point) => ({
      left: point.x - width / 2,
      right: point.x + width / 2,
      top: point.y + baselineOffset - height / 2,
      bottom: point.y + baselineOffset + height / 2,
      x: point.x,
      y: point.y + baselineOffset,
      width,
      height
    });
    const normalExtent = Math.abs(nx) * width / 2 + Math.abs(ny) * height / 2;
    // Try the closest normal offset first. If another line blocks that spot,
    // move a little along the vector before increasing the normal distance.
    const normalDistances = [normalExtent + lineGap + 1, normalExtent + 9, normalExtent + 17, normalExtent + 27];
    const tangentOffsets = [0, -10, 10, -20, 20, -34, 34, -48, 48];
    const candidates = [];
    normalDistances.forEach((normalDistance) => {
      [1, -1].forEach((side) => {
        tangentOffsets.forEach((tangent) => {
          const dx = nx * normalDistance * side + ux * tangent;
          const dy = ny * normalDistance * side + uy * tangent;
          candidates.push({ x: midpoint.x + dx, y: midpoint.y + dy, dx, dy });
        });
      });
    });
    function overlap(first, second) {
      return first.left < second.right + labelGap && first.right > second.left - labelGap &&
        first.top < second.bottom + labelGap && first.bottom > second.top - labelGap;
    }
    function score(point) {
      let value = 0;
      const box = labelRect(point);
      const edge = Math.min(box.left - stageCamera.x - 8, stageCamera.x + stageCamera.width - 8 - box.right,
        box.top - stageCamera.y - 8, stageCamera.y + stageCamera.height - 8 - box.bottom);
      if (edge < 0) value += 10000000 + Math.abs(edge) * 100000;
      for (const other of occupied) if (overlap(box, other)) value += 100000000;
      for (const segment of segments) {
        const expanded = { left: box.left - lineGap, right: box.right + lineGap,
          top: box.top - lineGap, bottom: box.bottom + lineGap };
        const distance = segmentRectDistance(segment.start, segment.end, expanded);
        if (distance <= 0.01) value += 1000000000;
      }
      // Once a candidate is clear, prefer the one nearest the vector. The
      // small tangent premium keeps a label close even when it must slide to
      // avoid a neighbouring force or resultant.
      value += Math.hypot(point.dx, point.dy) * 0.2 + Math.abs(point.dx * ux + point.dy * uy) * 0.04;
      return value;
    }
    const position = candidates.sort((first, second) => score(first) - score(second))[0] || midpoint;
    return { ...position, box: labelRect(position) };
  }

  function drawQuestionGeometry(parent, answer, question) {
    if (question.type === "parallelogram") {
      for (const guide of answer.guides) {
        if (!guide) continue;
        const start = M.endpointForKey(answer, question, guide.originKey);
        const end = M.lineEndPoint(guide, answer, question);
        drawLine(parent, start, end, `guide-line${guide.end.mode === "free" ? " provisional" : ""}`);
      }
    }
    const geometry = M.forceGeometry(answer, question);
    const labelSegments = geometry.map((item) => ({ start: item.tail, end: item.head }));
    if (question.type === "parallelogram") {
      for (const guide of answer.guides) {
        if (!guide) continue;
        labelSegments.push({ start: M.endpointForKey(answer, question, guide.originKey), end: M.lineEndPoint(guide, answer, question) });
      }
    }
    if (answer.resultant) labelSegments.push({ start: M.lineStartPoint(answer.resultant, answer, question), end: M.lineEndPoint(answer.resultant, answer, question) });
    const occupiedLabels = [];
    geometry.forEach((item, index) => {
      drawArrow(parent, item.tail, item.head, { forceIndex: index });
      const position = forceLabelPosition(item.tail, item.head, occupiedLabels, labelSegments);
      parent.append(N.svgLabel(documentObject, N.vector(index + 1), { x: position.x, y: position.y, fill: ["#1d4ed8", "#7e22ce", "#be185d"][index], "text-anchor": "middle" }));
      occupiedLabels.push(position.box);
    });
    if (answer.resultant) {
      const start = M.lineStartPoint(answer.resultant, answer, question);
      const end = M.lineEndPoint(answer.resultant, answer, question);
      drawArrow(parent, start, end, { className: `resultant-line${answer.resultant.end.mode === "free" ? " provisional" : ""}` });
      const position = forceLabelPosition(start, end, occupiedLabels, labelSegments);
      parent.append(N.svgLabel(documentObject, N.vector("R"), { x: position.x, y: position.y, fill: "#b45309", "text-anchor": "middle" }));
    }
  }

  function drawCorrectGeometry(parent, answer, question) {
    if (question.type === "parallelogram") {
      const start = M.anchorPoint(answer);
      const firstHead = M.add(start, question.forces[0]);
      const secondHead = M.add(start, question.forces[1]);
      const target = M.corner(question, answer);
      drawArrow(parent, start, firstHead, { className: "force-line correct-overlay" });
      drawArrow(parent, start, secondHead, { className: "force-line correct-overlay" });
      drawLine(parent, firstHead, target, "guide-line correct-overlay");
      drawLine(parent, secondHead, target, "guide-line correct-overlay");
      drawArrow(parent, start, target, { className: "resultant-line correct-overlay" });
    } else {
      const start = M.anchorPoint(answer);
      let current = start;
      for (const force of question.forces) {
        const next = M.add(current, force);
        drawArrow(parent, current, next, { className: "force-line correct-overlay" });
        current = next;
      }
      drawArrow(parent, start, current, { className: "resultant-line correct-overlay" });
    }
  }

  function cameraPoints(answer, question) {
    const points = [];
    const addPoint = (point) => { if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point); };
    addPoint(M.anchorPoint(answer));
    addPoint(M.corner(question, answer));
    for (const item of M.forceGeometry(answer, question)) { addPoint(item.tail); addPoint(item.head); }
    if (question.type === "parallelogram") {
      for (const guide of answer.guides) {
        if (!guide) continue;
        addPoint(M.endpointForKey(answer, question, guide.originKey));
        addPoint(M.lineEndPoint(guide, answer, question));
      }
    }
    if (answer.resultant) {
      addPoint(M.lineStartPoint(answer.resultant, answer, question));
      addPoint(M.lineEndPoint(answer.resultant, answer, question));
    }
    return points;
  }

  function fullStageCamera() {
    return { x: 0, y: 0, width: G.WIDTH, height: G.HEIGHT };
  }

  function computeStageCamera(answer, question) {
    const stageWidth = dom.stage?.clientWidth || 0;
    const stageHeight = dom.stage?.clientHeight || 0;
    if (!stageWidth || !stageHeight) return fullStageCamera();
    const points = cameraPoints(answer, question);
    if (!points.length) return fullStageCamera();
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const compact = stageWidth < 760;
    if (!compact) return fullStageCamera();
    const padding = 42;
    const aspect = stageWidth / stageHeight;
    let width = Math.max(300, maxX - minX + padding * 2);
    let height = Math.max(220, maxY - minY + padding * 2);
    if (width / height < aspect) width = height * aspect;
    else height = width / aspect;
    // A separated initial force layout may need the full stage; never crop a legal answer just to enlarge it.
    if (width > G.WIDTH || height > G.HEIGHT) return fullStageCamera();
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const camera = {
      width,
      height,
      x: Math.max(0, Math.min(G.WIDTH - width, centerX - width / 2)),
      y: Math.max(0, Math.min(G.HEIGHT - height, centerY - height / 2))
    };
    // Clamping against the model edge can only reduce the visible margin. If it would clip a point, fall back to the full model.
    if (points.some((point) => point.x < camera.x || point.x > camera.x + camera.width || point.y < camera.y || point.y > camera.y + camera.height)) return fullStageCamera();
    return camera;
  }

  function setStageCamera(camera) {
    stageCamera = { ...camera };
    dom.stageSvg.setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.width} ${camera.height}`);
  }

  function renderStage(answerOverride = null) {
    const question = state && scenario ? scenario.questions[state.currentQuestion] : null;
    const answer = answerOverride || (state && scenario ? state.answers[state.currentQuestion] : null);
    const camera = drag?.camera || keyboardLine?.camera || (answer && question ? computeStageCamera(answer, question) : fullStageCamera());
    setStageCamera(camera);
    dom.stageSvg.replaceChildren();
    const background = createSvg("g", { "aria-hidden": "true" });
    drawGrid(background);
    dom.stageSvg.append(background);
    if (!state || !scenario || !state.answers) return;
    drawQuestionGeometry(dom.stageSvg, answer, question);
    if (presentation === "review" && trustedReview && correctOverlay) drawCorrectGeometry(dom.stageSvg, answer, question);
  }

  function modelToClient(point) {
    const svgPoint = dom.stageSvg.createSVGPoint();
    svgPoint.x = point.x;
    svgPoint.y = point.y;
    return svgPoint.matrixTransform(dom.stageSvg.getScreenCTM());
  }

  function clientToModel(clientX, clientY) {
    const svgPoint = dom.stageSvg.createSVGPoint();
    svgPoint.x = clientX;
    svgPoint.y = clientY;
    return svgPoint.matrixTransform(dom.stageSvg.getScreenCTM().inverse());
  }

  function pointInLayer(point) {
    const client = modelToClient(point);
    const rect = dom.dragLayer.getBoundingClientRect();
    return { x: client.x - rect.left, y: client.y - rect.top };
  }

  function makeOverlayButton(className, semanticKey, ariaLabel) {
    const button = documentObject.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.semanticKey = semanticKey;
    button.setAttribute("aria-label", ariaLabel);
    return button;
  }

  function positionForceButton(button, geometry) {
    const start = pointInLayer(geometry.tail);
    const end = pointInLayer(geometry.head);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    button.style.left = `${start.x - 12}px`;
    button.style.top = `${start.y - 22}px`;
    button.style.width = `${Math.max(44, length + 24)}px`;
    button.style.transformOrigin = "12px 22px";
    button.style.transform = `rotate(${angle}deg)`;
  }

  function positionResultantButton(button, startPoint, endPoint) {
    const start = pointInLayer(startPoint);
    const end = pointInLayer(endPoint);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    button.style.left = `${start.x - 24}px`;
    button.style.top = `${start.y - 24}px`;
    button.style.width = `${Math.max(48, length + 48)}px`;
    button.style.transformOrigin = "24px 24px";
    button.style.transform = `rotate(${angle}deg)`;
  }

  function positionHandle(button, point) {
    const local = pointInLayer(point);
    button.style.left = `${local.x}px`;
    button.style.top = `${local.y}px`;
  }

  function positionOffsetHandle(button, point, offsetX, offsetY) {
    const local = pointInLayer(point);
    const x = Math.max(24, Math.min(dom.dragLayer.clientWidth - 24, local.x + offsetX));
    const y = Math.max(24, Math.min(dom.dragLayer.clientHeight - 24, local.y + offsetY));
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  }

  function shortEndpointLabel(key) {
    if (key === "ORIGIN") return "起點";
    if (key === "CORNER") return "C";
    if (key === "FREE") return "自由";
    const match = /^F([1-3])_(TAIL|HEAD)$/.exec(key || "");
    if (!match) return "•";
    const subscripts = { 1: "₁", 2: "₂", 3: "₃" };
    return `F${subscripts[match[1]]}${match[2] === "TAIL" ? "尾" : "頭"}`;
  }

  function lineHandlePoint(button, answer, question) {
    const kind = button.dataset.dragKind;
    if (kind === "guide-start") return M.endpointForKey(answer, question, button.dataset.originKey);
    if (kind === "resultant-start" && answer.resultant && button.dataset.semanticKey === "resultant-start-edit") return M.lineStartPoint(answer.resultant, answer, question);
    if (kind === "resultant-start") return M.endpointForKey(answer, question, button.dataset.originKey);
    if (kind === "guide-end") return M.lineEndPoint(answer.guides[Number(button.dataset.guideIndex)], answer, question);
    if (kind === "resultant-end" && answer.resultant) return M.lineEndPoint(answer.resultant, answer, question);
    return null;
  }

  function layoutLineHandles(answer, question) {
    const groups = new Map();
    dom.dragLayer.querySelectorAll(".line-handle").forEach((button) => {
      const point = lineHandlePoint(button, answer, question);
      if (!point) return;
      const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ button, point });
    });
    groups.forEach((items) => {
      const count = items.length;
      const radius = count === 2 ? 25 : Math.max(32, count * 10);
      items.forEach(({ button, point }, index) => {
        button.classList.toggle("is-offset", count > 1);
        button.textContent = count > 1 ? shortEndpointLabel(button.dataset.originKey) : "";
        if (count === 1) {
          positionHandle(button, point);
          return;
        }
        const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
        positionOffsetHandle(button, point, Math.cos(angle) * radius, Math.sin(angle) * radius);
      });
    });
  }

  function forceAccessibleLabel(index, geometry) {
    return `${N.accessibleForce(index + 1)}，箭尾位置 x ${geometry.tail.x.toFixed(1)}、y ${geometry.tail.y.toFixed(1)}；方向和長度固定，只可平移。方向鍵每次移動 2 單位，按 Shift 時移動 10 單位。`;
  }

  function renderOverlays(answerOverride = null) {
    if (drag || keyboardLine) return;
    dom.dragLayer.replaceChildren();
    if (!state || !scenario || !["editable", "retryable"].includes(presentation) || state.phase !== "practice") return;
    const question = scenario.questions[state.currentQuestion];
    const answer = answerOverride || state.answers[state.currentQuestion];
    const geometry = M.forceGeometry(answer, question);
    const lockComposition = resultantMode;
    const showResultant = resultantMode;
    if (!lockComposition) {
      geometry.forEach((item, index) => {
        const button = makeOverlayButton("force-hit", `force-${index}`, forceAccessibleLabel(index, item));
        button.dataset.forceIndex = String(index);
        button.dataset.dragKind = "force";
        positionForceButton(button, item);
        dom.dragLayer.append(button);
      });
      for (const handle of M.guideStartHandles(answer, question)) {
        const button = makeOverlayButton("line-handle", `guide-start-${handle.key}`, `由${endpointAccessible(handle.key)}開始畫虛線輔助線`);
        button.dataset.dragKind = "guide-start";
        button.dataset.lineKind = "guide";
        button.dataset.originKey = handle.key;
        positionHandle(button, handle.point);
        dom.dragLayer.append(button);
      }
      if (question.type === "parallelogram") {
        answer.guides.forEach((guide, index) => {
          if (!guide) return;
          const button = makeOverlayButton("line-handle", `guide-end-${index}`, `調整第 ${index + 1} 條虛線輔助線的終點`);
          button.dataset.dragKind = "guide-end";
          button.dataset.lineKind = "guide-end";
          button.dataset.guideIndex = String(index);
          button.dataset.originKey = guide.originKey;
          positionHandle(button, M.lineEndPoint(guide, answer, question));
          dom.dragLayer.append(button);
        });
      }
    }
    if (showResultant) {
      if (!answer.resultant) {
        for (const handle of M.resultantStartHandles(answer, question, { allowAnyOrigin: resultantMode })) {
          const button = makeOverlayButton("line-handle", `resultant-start-${handle.key}`, `由${endpointAccessible(handle.key)}開始畫合力`);
          button.dataset.dragKind = "resultant-start";
          button.dataset.lineKind = "resultant";
          button.dataset.originKey = handle.key;
          positionHandle(button, handle.point);
          dom.dragLayer.append(button);
        }
      } else {
        const lineStart = M.lineStartPoint(answer.resultant, answer, question);
        const lineEnd = M.lineEndPoint(answer.resultant, answer, question);
        const lineHit = makeOverlayButton("resultant-hit", "resultant-translate", "平移整支合力；方向和長度保持不變");
        lineHit.dataset.dragKind = "resultant-translate";
        lineHit.dataset.lineKind = "resultant-translate";
        positionResultantButton(lineHit, lineStart, lineEnd);
        dom.dragLayer.append(lineHit);
        const start = makeOverlayButton("line-handle", "resultant-start-edit", "調整合力起點");
        start.dataset.dragKind = "resultant-start";
        start.dataset.lineKind = "resultant-start";
        start.dataset.originKey = answer.resultant.originKey;
        positionHandle(start, M.lineStartPoint(answer.resultant, answer, question));
        dom.dragLayer.append(start);
        const button = makeOverlayButton("line-handle", "resultant-end", "調整合力終點");
        button.dataset.dragKind = "resultant-end";
        button.dataset.lineKind = "resultant-end";
        button.dataset.originKey = answer.resultant.originKey;
        positionHandle(button, M.lineEndPoint(answer.resultant, answer, question));
        dom.dragLayer.append(button);
      }
    }
    layoutLineHandles(answer, question);
  }

  function positionExistingOverlays(answer) {
    const question = scenario.questions[state.currentQuestion];
    const geometry = M.forceGeometry(answer, question);
    dom.dragLayer.querySelectorAll(".force-hit").forEach((button) => positionForceButton(button, geometry[Number(button.dataset.forceIndex)]));
    if (answer.resultant) {
      const start = M.lineStartPoint(answer.resultant, answer, question);
      const end = M.lineEndPoint(answer.resultant, answer, question);
      dom.dragLayer.querySelectorAll(".resultant-hit").forEach((button) => positionResultantButton(button, start, end));
    }
    layoutLineHandles(answer, question);
  }

  function endpointAccessible(key) {
    if (key === "ORIGIN") return "共同起點";
    if (key === "CORNER") return "平行四邊形對角頂點";
    if (key === "FREE") return "自由位置";
    const match = /^F([1-3])_(TAIL|HEAD)$/.exec(key || "");
    if (!match) return key;
    return `${N.accessibleForce(Number(match[1]))}的${match[2] === "TAIL" ? "箭尾" : "箭頭"}`;
  }

  function renderFormula() {
    dom.formula.replaceChildren();
    N.appendHtml(dom.formula, N.expression(scenario.questions[state.currentQuestion].forces.length));
  }

  function renderLineTools() {
    dom.lineTools.replaceChildren();
    const answer = state.answers[state.currentQuestion];
    if (answer.type !== "parallelogram" || resultantMode) return;
    answer.guides.forEach((guide, index) => {
      if (!guide) return;
      const button = documentObject.createElement("button");
      button.type = "button";
      button.dataset.clearGuide = String(index);
      button.textContent = `清除第 ${index + 1} 條虛線輔助線`;
      dom.lineTools.append(button);
    });
  }

  function completionStates() {
    return state.answers.map((answer, index) => M.questionComplete(answer, scenario.questions[index]));
  }

  function makeQuestionButton(index, review = false) {
    const complete = completionStates()[index];
    const button = documentObject.createElement("button");
    button.type = "button";
    button.textContent = scenario.questions[index].id;
    button.dataset.questionIndex = String(index);
    button.dataset.complete = String(complete);
    button.setAttribute("aria-label", `第 ${index + 1} 題，${QUESTION_COPY[index].type}，${complete ? "完成" : "未完成"}`);
    if (index === state.currentQuestion) button.setAttribute("aria-current", "step");
    button.disabled = review ? !state?.answers : !["editable", "retryable", "summary"].includes(presentation);
    return button;
  }

  function renderProgress() {
    dom.questionProgress.replaceChildren(...scenario.questions.map((_, index) => makeQuestionButton(index)));
  }

  function renderPractice() {
    const view = questionView(state, scenario, state.currentQuestion);
    const answer = state.answers[state.currentQuestion];
    const question = scenario.questions[state.currentQuestion];
    dom.questionType.textContent = `${view.id}・${view.type}`;
    dom.questionTitle.textContent = view.title;
    dom.questionPrompt.textContent = view.prompt;
    dom.stepPrompt.textContent = resultantMode
      ? "合力作圖模式：力矢量及輔助線已鎖定；由任意端點或舞台空白位置拖出合力，之後可拖動線身整體平移或調整兩端，方向錯誤的作答也會保留。"
      : view.step;
    renderFormula();
    renderLineTools();
    const resultantAvailable = M.resultantAvailable(answer, question);
    dom.drawResultant.classList.remove("is-hidden");
    dom.drawResultant.disabled = !resultantAvailable;
    dom.drawResultant.setAttribute("aria-pressed", String(resultantMode));
    dom.drawResultant.dataset.active = String(resultantMode);
    dom.drawResultant.textContent = resultantMode ? "返回修改力與作圖" : resultantAvailable ? "開始畫合力（鎖定前面作圖）" : "完成前置作圖後開始畫合力";
    dom.stage.classList.toggle("resultant-mode", resultantMode);
    renderProgress();
    const policy = UI.controlPolicy({ presentation, phase: state.phase, undoAvailable: undoStacks[state.currentQuestion].length > 0, unsaved });
    dom.undo.disabled = resultantMode || !policy.undoEnabled;
    dom.resetQuestion.disabled = resultantMode || !policy.resetEnabled || M.isBlank(state.answers[state.currentQuestion]);
    dom.previousQuestion.disabled = !policy.navigationEnabled;
    dom.nextQuestion.disabled = !policy.navigationEnabled;
    dom.goSummary.disabled = !policy.summaryEnabled;
    dom.practicePanel.classList.toggle("is-hidden", state.phase !== "practice" || !["editable", "retryable"].includes(presentation));
  }

  function renderSummary() {
    dom.summaryList.replaceChildren();
    const completed = completionStates();
    completed.forEach((value, index) => {
      const row = documentObject.createElement("div");
      row.className = "summary-item";
      const copy = documentObject.createElement("div");
      const title = documentObject.createElement("strong");
      title.textContent = `${scenario.questions[index].id}・${QUESTION_COPY[index].type}`;
      const status = documentObject.createElement("span");
      status.textContent = value ? "完成" : "未完成";
      copy.append(title, status);
      const button = documentObject.createElement("button");
      button.type = "button";
      button.dataset.editQuestion = String(index);
      button.textContent = value ? "查看／修改" : "前往作答";
      copy.setAttribute("aria-label", `${title.textContent}，${status.textContent}`);
      row.append(copy, button);
      dom.summaryList.append(row);
    });
    const missing = completed.filter((value) => !value).length;
    dom.summaryWarning.textContent = missing ? `仍有 ${missing} 題未完成；提交後不能修改，未完成項目會計零分。` : "五題均已完成；提交後本次作答會鎖定。";
    const policy = UI.controlPolicy({ presentation: "summary", phase: "summary", unsaved });
    dom.submitAttempt.disabled = !policy.submitEnabled || submitting;
    dom.returnToPractice.disabled = submitting;
    dom.summaryPanel.classList.toggle("is-hidden", state.phase !== "summary" || !["editable", "retryable"].includes(presentation));
  }

  function renderReview() {
    const locked = ["review", "committed", "frozen", "mismatch", "technical"].includes(presentation);
    dom.reviewPanel.classList.toggle("is-hidden", !locked || presentation === "technical" || !state?.answers);
    if (dom.reviewPanel.classList.contains("is-hidden")) return;
    dom.reviewActions.replaceChildren();
    const copy = UI.copyFor(presentation, reviewResult);
    dom.reviewTitle.textContent = copy.title;
    dom.reviewScore.textContent = copy.score;
    dom.reviewCompletion.textContent = copy.completion;
    dom.reviewQuestionNavigation.replaceChildren(...scenario.questions.map((_, index) => makeQuestionButton(index, true)));
    dom.toggleCorrect.hidden = !(presentation === "review" && trustedReview);
    dom.toggleCorrect.disabled = !(presentation === "review" && trustedReview);
    dom.toggleCorrect.setAttribute("aria-pressed", String(correctOverlay));
    dom.toggleCorrect.textContent = correctOverlay ? "隱藏正確作圖" : "顯示正確作圖";
    dom.reviewFeedback.replaceChildren();
    if (presentation === "review" && trustedReview && reviewResult?.detail) {
      for (const detail of reviewResult.detail) {
        const section = documentObject.createElement("section");
        section.className = "feedback-question";
        const heading = documentObject.createElement("h3");
        heading.textContent = `${detail.id}・${detail.score} / 20`;
        const list = documentObject.createElement("ul");
        for (const component of detail.components) {
          const item = documentObject.createElement("li");
          item.dataset.correct = String(component.correct);
          item.textContent = `${component.label}：${component.earned} / ${component.points}`;
          list.append(item);
        }
        section.append(heading, list);
        dom.reviewFeedback.append(section);
      }
    } else {
      const message = documentObject.createElement("p");
      message.className = "task-copy";
      message.textContent = presentation === "frozen" ? "提交資料已凍結，只可重試同一份提交；目前未能確認分數或完成狀態。" :
        presentation === "committed" ? "成績資料已記錄，但結束連線未完成；本次作答仍然鎖定。" :
          "已完成紀錄未能與作答快照安全核對，只顯示 Moodle 可確認的紀錄。";
      dom.reviewFeedback.append(message);
    }
    if (presentation === "frozen") addReviewAction("重試同一份提交", () => handleSubmissionOutcome(pendingOutcome(SimScorm.retryPending())));
    if (presentation === "committed") addReviewAction("重試完成連線", () => handleSubmissionOutcome(pendingOutcome(SimScorm.retryFinish())));
  }

  function renderSaveBanner() {
    dom.saveBanner.classList.toggle("is-hidden", !unsaved);
    if (unsaved) dom.saveBannerText.textContent = "未能儲存最新進度。你可繼續修改，但重新載入前的未儲存內容可能遺失；成功重試前不能最終提交或清除資料。";
  }

  function focusSemantic(key) {
    if (!key) return;
    windowObject.requestAnimationFrame(() => dom.dragLayer.querySelector(`[data-semantic-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true }));
  }

  function renderAll(options = {}) {
    const previousKey = options.focusKey || documentObject.activeElement?.dataset?.semanticKey;
    dom.technicalPanel.classList.add("is-hidden");
    if (state && scenario) {
      dom.questionCounter.textContent = `第 ${state.currentQuestion + 1} / 5 題`;
      const completed = completionStates().filter(Boolean).length;
      dom.attemptStatus.textContent = presentation === "review" ? "已提交・只可檢視" : presentation === "committed" ? "已記錄・待完成連線" :
        presentation === "frozen" ? "提交狀態未確認" : `已完成 ${completed} / 5 題`;
      renderStage();
      renderOverlays();
      renderPractice();
      renderSummary();
      renderReview();
    } else {
      dom.stageSvg.replaceChildren();
      dom.dragLayer.replaceChildren();
      dom.practicePanel.classList.add("is-hidden");
      dom.summaryPanel.classList.add("is-hidden");
      dom.reviewPanel.classList.add("is-hidden");
    }
    renderSaveBanner();
    dom.app.setAttribute("aria-busy", "false");
    focusSemantic(previousKey);
  }

  function announce(message) {
    dom.liveRegion.textContent = "";
    windowObject.setTimeout(() => { dom.liveRegion.textContent = message; }, 20);
  }

  function draftSnapshot() {
    return SimScorm.makeSnapshot(P.ACTIVITY, "draft", P.encodeDraft(state));
  }

  function registerDraftProvider() {
    SimScorm.setDraftProvider(() => draftSnapshot());
  }

  function saveDraft() {
    try {
      state = P.productionRoundTrip(state);
      const saved = SimScorm.saveDraft(draftSnapshot());
      unsaved = !saved;
      renderSaveBanner();
      return saved;
    } catch (error) {
      console.error(error);
      unsaved = true;
      renderSaveBanner();
      return false;
    }
  }

  function beginFreshAttempt(clearExisting = false) {
    if (!pendingFreshState || clearExisting) pendingFreshState = P.freshState(G.newSeed());
    try {
      const snapshot = SimScorm.makeSnapshot(P.ACTIVITY, "draft", P.encodeDraft(pendingFreshState));
      if (!SimScorm.saveDraft(snapshot)) {
        showTechnical("未能建立練習", "系統未能安全儲存本次隨機題目，因此作圖功能尚未解鎖。", [{ label: "重試建立練習", handler: () => beginFreshAttempt(false) }]);
        return;
      }
      state = pendingFreshState;
      scenario = G.generateScenario({ seed: state.seed, generatorVersion: state.generatorVersion });
      pendingFreshState = null;
      presentation = "editable";
      resultantMode = false;
      unsaved = false;
      registerDraftProvider();
      renderAll();
      announce("隨機練習已建立，五題均可自由選擇。");
    } catch (error) {
      console.error(error);
      showTechnical("未能建立練習", "隨機題目資料未能建立。", [{ label: "重試建立練習", handler: () => beginFreshAttempt(false) }]);
    }
  }

  function showTechnical(title, message, actions = []) {
    presentation = "technical";
    dom.practicePanel.classList.add("is-hidden");
    dom.summaryPanel.classList.add("is-hidden");
    dom.reviewPanel.classList.add("is-hidden");
    dom.dragLayer.replaceChildren();
    dom.technicalPanel.classList.remove("is-hidden");
    dom.technicalTitle.textContent = title;
    dom.technicalMessage.textContent = message;
    dom.technicalActions.replaceChildren();
    for (const action of actions) {
      const button = documentObject.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", action.handler, { once: true });
      dom.technicalActions.append(button);
    }
    dom.questionCounter.textContent = "--";
    dom.attemptStatus.textContent = "技術狀態未確認";
    dom.app.setAttribute("aria-busy", "false");
    dom.technicalTitle.focus({ preventScroll: true });
  }

  function safeRecordedResult(attemptValue) {
    return SimActivityFlow.recordedResult(attemptValue);
  }

  function showSafeFinishedFallback(attemptValue, reason) {
    const recorded = safeRecordedResult(attemptValue);
    state = null;
    scenario = null;
    presentation = "mismatch";
    reviewResult = { score: recorded.score, maxScore: 100, passed: recorded.passed };
    showTechnical("已完成紀錄未能安全核對", `${reason}。本次作答保持鎖定；Moodle 記錄分數：${Number.isFinite(recorded.score) ? recorded.score : "--"}，完成狀態：${UI.completionLabel(recorded.passed)}。`);
  }

  function restoreFinished(attemptValue) {
    if (!attemptValue.snapshot) { showSafeFinishedFallback(attemptValue, "找不到可驗證的提交作圖"); return; }
    try {
      const answer = P.decodeSnapshot(attemptValue.snapshot, "review");
      scenario = G.generateScenario({ seed: answer.seed, generatorVersion: answer.generatorVersion });
      const computed = S.score(answer, scenario);
      const review = SimActivityFlow.reviewResult(computed, { score: attemptValue.snapshot.score, passed: attemptValue.snapshot.passed }, attemptValue);
      if (!review.trusted) { showSafeFinishedFallback(attemptValue, "提交作圖與 Moodle 記錄不一致或完成狀態不明"); return; }
      state = { ...answer, phase: "review", currentQuestion: 0 };
      presentation = "review";
      resultantMode = false;
      trustedReview = true;
      reviewResult = computed;
      renderAll();
    } catch (error) {
      console.error(error);
      showSafeFinishedFallback(attemptValue, "提交作圖資料無法驗證");
    }
  }

  function pendingOutcome(raw) {
    return { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
  }

  function restoreFrozen(attemptValue) {
    try {
      const decoded = P.decodePending(attemptValue.snapshot);
      scenario = G.generateScenario({ seed: decoded.answer.seed, generatorVersion: decoded.answer.generatorVersion });
      const computed = S.score(decoded.answer, scenario);
      if (computed.score !== decoded.payload.score || computed.maxScore !== decoded.payload.maxScore || computed.passed !== decoded.payload.passed ||
          decoded.snapshot.score !== computed.score || Boolean(decoded.snapshot.passed) !== computed.passed) throw new Error("Pending result does not match authoritative geometry");
      state = { ...decoded.answer, phase: "review", currentQuestion: 0 };
      presentation = "frozen";
      resultantMode = false;
      trustedReview = false;
      reviewResult = null;
      renderAll();
    } catch (error) {
      console.error(error);
      SimScorm.quarantinePending();
      showTechnical("提交資料需要技術檢查", "已凍結的提交資料未能通過作答驗證。本頁不會重試、改寫或顯示分數。" );
    }
  }

  function restoreDraft(attemptValue) {
    try {
      state = P.decodeSnapshot(attemptValue.snapshot, "draft");
      scenario = G.generateScenario({ seed: state.seed, generatorVersion: state.generatorVersion });
      presentation = "editable";
      resultantMode = false;
      unsaved = false;
      registerDraftProvider();
      renderAll();
    } catch (error) {
      console.error(error);
      showTechnical("練習資料無法載入", "已儲存的練習資料不符合本活動的安全狀態規則。除非你明確清除，系統不會建立新題目。", [
        { label: "清除損壞資料並重新開始", handler: () => beginFreshAttempt(true) }
      ]);
    }
  }

  function startup() {
    cacheDom();
    const missing = dependencyIssue(dependencies);
    if (missing) { showTechnical("活動未能載入", `缺少必要執行元件：${missing}。本頁不會建立或提交作答。`); return; }
    bindEvents();
    attempt = SimScorm.loadAttempt(P.ACTIVITY);
    const startupState = SimActivityFlow.startup(attempt);
    if (startupState === "review") restoreFinished(attempt);
    else if (startupState === "editable" && attempt.state === "draft") restoreDraft(attempt);
    else if (startupState === "editable") beginFreshAttempt(false);
    else if (startupState === "frozen") restoreFrozen(attempt);
    else showTechnical("練習暫時鎖定", "系統未能安全讀取目前 Moodle 練習狀態。本頁不會寫入新資料、分數或完成狀態。" );
  }

  function pushUndo(index, previousAnswer) {
    undoStacks[index].push(P.clone(previousAnswer));
    if (undoStacks[index].length > 20) undoStacks[index].shift();
  }

  function finalizeAnswer(nextAnswer, message, focusKey, options = {}) {
    const index = state.currentQuestion;
    const previous = state.answers[index];
    if (JSON.stringify(previous) === JSON.stringify(nextAnswer)) { renderAll({ focusKey }); return; }
    const panelScrollTop = options.preservePanelScroll ? dom.controlPanel.scrollTop : null;
    pushUndo(index, previous);
    state.answers[index] = nextAnswer;
    state = P.productionRoundTrip(state);
    saveDraft();
    renderAll({ focusKey });
    if (panelScrollTop !== null) dom.controlPanel.scrollTop = panelScrollTop;
    if (message) announce(message);
  }

  function navigateQuestion(index, fromSummary = false) {
    if (!state || !scenario || index < 0 || index > 4 || presentation === "technical") return;
    state.currentQuestion = index;
    state.phase = "practice";
    resultantMode = false;
    correctOverlay = false;
    if (["editable", "retryable"].includes(presentation)) saveDraft();
    renderAll();
    if (fromSummary) dom.questionTitle.focus({ preventScroll: true });
  }

  function goToSummary() {
    resultantMode = false;
    state.phase = "summary";
    presentation = "editable";
    saveDraft();
    renderAll();
    dom.summaryPanel.querySelector("h2")?.focus({ preventScroll: true });
  }

  function undo() {
    const stack = undoStacks[state.currentQuestion];
    if (!stack.length) return;
    resultantMode = false;
    state.answers[state.currentQuestion] = stack.pop();
    state = P.productionRoundTrip(state);
    saveDraft();
    renderAll();
    announce("已復原本題上一個完整操作。");
  }

  function resetCurrent() {
    const answer = state.answers[state.currentQuestion];
    if (M.isBlank(answer)) return;
    resultantMode = false;
    pushUndo(state.currentQuestion, answer);
    state.answers[state.currentQuestion] = M.freshAnswer(scenario.questions[state.currentQuestion]);
    state = P.productionRoundTrip(state);
    saveDraft();
    renderAll();
    announce("本題已重設；可使用復原上一步取回剛才的作答。");
  }

  function toggleResultantMode() {
    const question = scenario.questions[state.currentQuestion];
    const answer = state.answers[state.currentQuestion];
    if (!M.resultantAvailable(answer, question)) return;
    resultantMode = !resultantMode;
    renderAll();
    announce(resultantMode ? "已進入合力作圖模式；力矢量及輔助線暫時鎖定。" : "已返回修改力矢量及輔助線模式。");
  }

  function normalizeSubmission(outcome) {
    return outcome?.activityState ? outcome : pendingOutcome(outcome || {});
  }

  function handleSubmissionOutcome(rawOutcome) {
    const outcome = normalizeSubmission(rawOutcome);
    submitting = false;
    SimActivityFlow.submission(outcome, {
      success: () => {
        presentation = "review";
        trustedReview = true;
        correctOverlay = false;
        state.phase = "review";
        reviewResult = outcome.result || reviewResult;
        renderAll();
        dom.reviewTitle.focus({ preventScroll: true });
      },
      committed: () => {
        presentation = "committed";
        trustedReview = false;
        state.phase = "review";
        reviewResult = outcome.result || reviewResult;
        renderAll();
      },
      frozen: () => {
        presentation = "frozen";
        trustedReview = false;
        state.phase = "review";
        reviewResult = null;
        renderAll();
      },
      retry: (failure) => {
        if (failure.retryable) {
          presentation = "retryable";
          state.phase = "summary";
          dom.submitStatus.textContent = "提交程序未能完成；本次作答尚未提交，你可修改或重試。";
          dom.submitStatus.dataset.kind = "technical";
          renderAll();
        } else showTechnical("提交程序未能完成", "系統未能安全建立最終提交資料；本頁不會聲稱已提交、合格或不合格。" );
      }
    });
  }

  function addReviewAction(label, handler) {
    const button = documentObject.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler, { once: true });
    dom.reviewActions.append(button);
  }

  function submitNow() {
    if (unsaved || submitting) return;
    submitting = true;
    dom.submitStatus.textContent = "正在提交同一份最終作答……";
    dom.submitStatus.dataset.kind = "";
    reviewResult = S.score(state, scenario);
    const reviewSnapshot = SimScorm.makeSnapshot(P.ACTIVITY, "review", P.encodeReview(state), reviewResult);
    const handle = (outcome) => handleSubmissionOutcome(outcome);
    SimScorm.submitWithCallbacks(reviewResult, reviewSnapshot, { onSuccess: handle, onFailure: handle });
  }

  function showSubmitConfirmation() {
    const missing = completionStates().filter((value) => !value).length;
    dom.submitDialogMessage.textContent = missing ? `仍有 ${missing} 題未完成，提交後不能修改，仍要提交嗎？` : "五題均已完成，提交後不能修改，確定提交嗎？";
    if (typeof dom.submitDialog.showModal === "function") dom.submitDialog.showModal();
    else if (windowObject.confirm(dom.submitDialogMessage.textContent)) submitNow();
  }

  function beginPointerDrag(event, target) {
    if (!["editable", "retryable"].includes(presentation) || state.phase !== "practice" || event.button > 0) return;
    const question = scenario.questions[state.currentQuestion];
    const answer = state.answers[state.currentQuestion];
    const kind = target.dataset.dragKind;
    if (resultantMode && !kind.startsWith("resultant")) return;
    const point = clientToModel(event.clientX, event.clientY);
    const base = { pointerId: event.pointerId, pointerType: event.pointerType || "mouse", kind, target, before: P.clone(answer), point, preview: answer, camera: { ...stageCamera } };
    if (kind === "force") {
      const index = Number(target.dataset.forceIndex);
      const tail = M.forceGeometry(answer, question)[index].tail;
      Object.assign(base, { forceIndex: index, startTail: tail, startPoint: point });
    } else if (kind === "guide-start" || kind === "guide-end") {
      Object.assign(base, { originKey: target.dataset.originKey });
    } else if (kind === "resultant-start" || kind === "resultant-end") {
      Object.assign(base, { originKey: target.dataset.originKey });
    } else if (kind === "resultant-translate" && answer.resultant) {
      Object.assign(base, {
        startPoint: point,
        startLineStart: M.lineStartPoint(answer.resultant, answer, question),
        startLineEnd: M.lineEndPoint(answer.resultant, answer, question)
      });
    } else return;
    drag = base;
    target.setPointerCapture(event.pointerId);
    target.classList.add("is-dragging");
    event.preventDefault();
    renderMagnifier(event);
  }

  function beginFreeResultantDrag(event) {
    if (!resultantMode || !["editable", "retryable"].includes(presentation) || state.phase !== "practice" || event.button > 0) return;
    const question = scenario.questions[state.currentQuestion];
    if (state.answers[state.currentQuestion].resultant) return;
    const answer = state.answers[state.currentQuestion];
    const point = clientToModel(event.clientX, event.clientY);
    drag = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || "mouse",
      kind: "resultant-start",
      target: dom.stage,
      before: P.clone(answer),
      point,
      startPoint: point,
      originKey: "FREE",
      preview: answer,
      candidate: point,
      camera: { ...stageCamera }
    };
    dom.stage.setPointerCapture(event.pointerId);
    event.preventDefault();
    renderMagnifier(event);
  }

  function updateNearSnap(preview, question, candidate, pointerType, kind, originKey) {
    nearSnapPoint = null;
    let targets = [];
    if (kind === "force") targets = M.legalForceTargets(preview, question, drag.forceIndex);
    else if (kind.startsWith("guide") && ["F1_HEAD", "F2_HEAD"].includes(originKey)) targets = [{ key: "CORNER", point: M.corner(question, preview) }];
    else if (kind === "resultant-end") targets = M.resultantSnapTargets(preview, question, originKey);
    else if (kind === "resultant-start") targets = M.resultantStartHandles(preview, question, { allowAnyOrigin: resultantMode });
    else if (kind === "resultant-translate" && preview.resultant) {
      const targetsForLine = question.type === "parallelogram" ? M.parallelogramCornerTargets(preview, question) : M.endpointHandles(preview, question);
      const startSnap = M.selectSnapCandidate(M.lineStartPoint(preview.resultant, preview, question), targetsForLine, { pointerType, project: modelToClient });
      const endSnap = M.selectSnapCandidate(M.lineEndPoint(preview.resultant, preview, question), targetsForLine, { pointerType, project: modelToClient });
      nearSnapPoint = (startSnap || endSnap)?.point || null;
      return;
    }
    const snap = M.selectSnapCandidate(candidate, targets, { pointerType, project: modelToClient });
    if (snap) nearSnapPoint = snap.point;
  }

  function updatePointerDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const question = scenario.questions[state.currentQuestion];
    const point = clientToModel(event.clientX, event.clientY);
    let preview;
    let candidate = point;
    if (drag.kind === "force") {
      candidate = { x: drag.startTail.x + point.x - drag.startPoint.x, y: drag.startTail.y + point.y - drag.startPoint.y };
      preview = M.previewSnappedForceTranslation(drag.before, drag.forceIndex, candidate, question, { pointerType: drag.pointerType, project: modelToClient });
    } else if (drag.kind.startsWith("guide")) {
      preview = M.previewGuide(drag.before, drag.originKey, point, question, { snap: true });
    } else if (drag.kind === "resultant-start" && drag.before.resultant) {
      preview = M.previewResultantStart(drag.before, point, question, {
        pointerType: drag.pointerType,
        project: modelToClient,
        snap: true,
        allowIncomplete: resultantMode,
        allowAnyOrigin: resultantMode
      });
    } else if (drag.kind === "resultant-translate" && drag.before.resultant) {
      const delta = { x: point.x - drag.startPoint.x, y: point.y - drag.startPoint.y };
      preview = M.previewResultantTranslation(drag.before, delta, question, {
        pointerType: drag.pointerType,
        project: modelToClient,
        snap: true,
        allowIncomplete: resultantMode
      });
    } else {
      preview = M.previewResultant(drag.before, drag.originKey, point, question, {
        pointerType: drag.pointerType,
        project: modelToClient,
        snap: true,
        allowIncomplete: resultantMode,
        allowAnyOrigin: resultantMode,
        originPoint: drag.startPoint
      });
    }
    drag.preview = preview;
    drag.candidate = candidate;
    updateNearSnap(preview, question, candidate, drag.pointerType, drag.kind, drag.originKey);
    renderStage(preview);
    positionExistingOverlays(preview);
    renderMagnifier(event);
    event.preventDefault();
  }

  function finishPointerDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const active = drag;
    drag = null;
    nearSnapPoint = null;
    hideMagnifier();
    const question = scenario.questions[state.currentQuestion];
    const point = clientToModel(event.clientX, event.clientY);
    const options = { pointerType: active.pointerType, project: modelToClient };
    let next;
    let message;
    if (active.kind === "force") {
      const candidate = active.candidate || { x: active.startTail.x + point.x - active.startPoint.x, y: active.startTail.y + point.y - active.startPoint.y };
      next = M.commitForceTranslation(active.before, active.forceIndex, candidate, question, options);
      const placement = next.placements[active.forceIndex];
      message = placement.mode === "snap" ? `${N.accessibleForce(active.forceIndex + 1)}已吸附到${endpointAccessible(placement.targetKey)}。` : `${N.accessibleForce(active.forceIndex + 1)}已平移，大小和方向保持不變。`;
    } else if (active.kind.startsWith("guide")) {
      next = M.commitGuide(active.before, active.originKey, point, question, options);
      const guide = next.guides.find((item) => item?.originKey === active.originKey);
      message = guide?.end.mode === "snap"
        ? guide.end.targetKey === "PARALLEL" ? "虛線輔助線已吸附到對邊的平行方向，線長可以不同。" : "虛線輔助線已連接到平行四邊形對角頂點。"
        : "虛線輔助線尚未吸附，可拖動終點再調整。";
    } else if (active.kind === "resultant-start" && active.before.resultant) {
      next = M.commitResultantStart(active.before, point, question, {
        ...options,
        allowIncomplete: resultantMode,
        allowAnyOrigin: resultantMode
      });
      message = M.canonicalResultant(next, question) ? "合力已正確連接，本題完成。" : "合力起點已更新，可繼續調整兩端。";
    } else if (active.kind === "resultant-translate" && active.before.resultant) {
      const delta = { x: point.x - active.startPoint.x, y: point.y - active.startPoint.y };
      next = M.commitResultantTranslation(active.before, delta, question, {
        ...options,
        allowIncomplete: resultantMode
      });
      message = M.canonicalResultant(next, question) ? "合力已正確連接，本題完成。" : "合力已平移，可繼續調整兩端。";
    } else {
      next = M.commitResultant(active.before, active.originKey, point, question, {
        ...options,
        allowIncomplete: resultantMode,
        allowAnyOrigin: resultantMode,
        originPoint: active.startPoint
      });
      message = M.canonicalResultant(next, question) ? "合力已正確連接，本題完成。" : active.before.resultant ? "合力終點已更新，可繼續調整兩端。" : "合力已畫出，可繼續拖動起點或終點調整。";
    }
    finalizeAnswer(next, message, active.target.dataset.semanticKey, { preservePanelScroll: true });
  }

  function cancelPointerDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    nearSnapPoint = null;
    hideMagnifier();
    renderStage();
    renderOverlays();
    announce("已取消拖動，作圖回復到操作前狀態。");
  }

  function renderMagnifier(event) {
    if (event.pointerType !== "touch") return;
    const rect = dom.stage.getBoundingClientRect();
    const horizontal = event.clientX < rect.left + rect.width / 2 ? "right" : "left";
    const vertical = event.clientY < rect.top + rect.height / 2 ? "bottom" : "top";
    dom.magnifier.dataset.corner = `${vertical}-${horizontal}`;
    dom.magnifier.classList.add("is-visible");
    dom.magnifierLabel.textContent = drag?.kind === "force" ? N.accessibleForce(drag.forceIndex + 1) : drag?.kind?.startsWith("guide") ? "虛線輔助線終點" : drag?.kind === "resultant-start" ? "合力起點" : drag?.kind === "resultant-translate" ? "平移整支合力" : "合力終點";
  }

  function hideMagnifier() {
    dom.magnifier.classList.remove("is-visible");
  }

  function beginKeyboardLine(target) {
    if (keyboardLine || !["editable", "retryable"].includes(presentation)) return;
    const question = scenario.questions[state.currentQuestion];
    const answer = state.answers[state.currentQuestion];
    const kind = target.dataset.dragKind;
    const originKey = target.dataset.originKey;
    let endpoint;
    if (kind === "guide-end") endpoint = M.lineEndPoint(answer.guides[Number(target.dataset.guideIndex)], answer, question);
    else if (kind === "resultant-end") endpoint = M.lineEndPoint(answer.resultant, answer, question);
    else if (kind === "resultant-start" && answer.resultant) endpoint = M.lineStartPoint(answer.resultant, answer, question);
    else if (kind === "resultant-translate" && answer.resultant) endpoint = M.lineStartPoint(answer.resultant, answer, question);
    else endpoint = M.endpointForKey(answer, question, originKey);
    keyboardLine = { kind, originKey, target, before: P.clone(answer), endpoint, startPoint: kind === "resultant-translate" ? { ...endpoint } : null, camera: { ...stageCamera } };
    announce(kind === "resultant-start" ? "已開始鍵盤調整合力起點。使用方向鍵移動，Enter 確認，Escape 取消。" : kind === "resultant-translate" ? "已開始鍵盤平移整支合力。使用方向鍵移動，Enter 確認，Escape 取消。" : "已開始鍵盤畫線。使用方向鍵移動終點，Enter 確認，Escape 取消。");
  }

  function updateKeyboardLine(event) {
    if (!keyboardLine) return false;
    if (event.key === "Escape") {
      keyboardLine = null;
      nearSnapPoint = null;
      renderStage();
      renderOverlays();
      announce("已取消鍵盤畫線。");
      event.preventDefault();
      return true;
    }
    if (event.key === "Enter") {
      const active = keyboardLine;
      keyboardLine = null;
      const question = scenario.questions[state.currentQuestion];
      const options = { pointerType: "keyboard", project: modelToClient };
      const next = active.kind.startsWith("guide") ? M.commitGuide(active.before, active.originKey, active.endpoint, question, options)
        : active.kind === "resultant-start" && active.before.resultant ? M.commitResultantStart(active.before, active.endpoint, question, { ...options, allowIncomplete: resultantMode, allowAnyOrigin: resultantMode })
          : active.kind === "resultant-translate" && active.before.resultant ? M.commitResultantTranslation(active.before, { x: active.endpoint.x - active.startPoint.x, y: active.endpoint.y - active.startPoint.y }, question, { ...options, allowIncomplete: resultantMode })
          : M.commitResultant(active.before, active.originKey, active.endpoint, question, { ...options, allowIncomplete: resultantMode, allowAnyOrigin: resultantMode });
      nearSnapPoint = null;
      finalizeAnswer(next, M.canonicalResultant(next, question) ? "合力已正確連接，本題完成。" : active.kind === "resultant-start" && active.before.resultant ? "已確認合力起點位置。" : active.kind === "resultant-translate" ? "已確認合力平移位置。" : "已確認合力終點位置。", active.target.dataset.semanticKey);
      event.preventDefault();
      return true;
    }
    const vectors = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!vectors[event.key]) return false;
    const step = event.shiftKey ? 10 : 2;
    keyboardLine.endpoint = M.clampLinePoint({ x: keyboardLine.endpoint.x + vectors[event.key][0] * step, y: keyboardLine.endpoint.y + vectors[event.key][1] * step });
    const question = scenario.questions[state.currentQuestion];
    const preview = keyboardLine.kind.startsWith("guide") ? M.previewGuide(keyboardLine.before, keyboardLine.originKey, keyboardLine.endpoint, question, { snap: true })
      : keyboardLine.kind === "resultant-start" && keyboardLine.before.resultant ? M.previewResultantStart(keyboardLine.before, keyboardLine.endpoint, question, { snap: true, allowIncomplete: resultantMode, allowAnyOrigin: resultantMode, pointerType: "keyboard", project: modelToClient })
        : keyboardLine.kind === "resultant-translate" && keyboardLine.before.resultant ? M.previewResultantTranslation(keyboardLine.before, { x: keyboardLine.endpoint.x - keyboardLine.startPoint.x, y: keyboardLine.endpoint.y - keyboardLine.startPoint.y }, question, { snap: true, allowIncomplete: resultantMode, pointerType: "keyboard", project: modelToClient })
        : M.previewResultant(keyboardLine.before, keyboardLine.originKey, keyboardLine.endpoint, question, { snap: true, allowIncomplete: resultantMode, allowAnyOrigin: resultantMode, pointerType: "keyboard", project: modelToClient });
    updateNearSnap(preview, question, keyboardLine.endpoint, "keyboard", keyboardLine.kind, keyboardLine.originKey);
    renderStage(preview);
    positionExistingOverlays(preview);
    event.preventDefault();
    return true;
  }

  function handleOverlayKey(event) {
    const target = event.target.closest(".force-hit,.line-handle,.resultant-hit");
    if (!target) return;
    if (keyboardLine && updateKeyboardLine(event)) return;
    if ((target.classList.contains("line-handle") || target.classList.contains("resultant-hit")) && event.key === "Enter") {
      beginKeyboardLine(target);
      event.preventDefault();
      return;
    }
    if (!target.classList.contains("force-hit")) return;
    if (resultantMode) return;
    const vectors = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!vectors[event.key]) return;
    const question = scenario.questions[state.currentQuestion];
    const answer = state.answers[state.currentQuestion];
    const index = Number(target.dataset.forceIndex);
    const tail = M.forceGeometry(answer, question)[index].tail;
    const step = event.shiftKey ? 10 : 2;
    const candidate = { x: tail.x + vectors[event.key][0] * step, y: tail.y + vectors[event.key][1] * step };
    const next = M.commitForceTranslation(answer, index, candidate, question, { pointerType: "keyboard", project: modelToClient });
    finalizeAnswer(next, `${N.accessibleForce(index + 1)}已用鍵盤平移。`, target.dataset.semanticKey);
    event.preventDefault();
  }

  function bindHostForwarding() {
    let lastY = null;
    dom.stage.addEventListener("touchstart", (event) => {
      if (event.target !== dom.stage || event.touches.length !== 1) { lastY = null; return; }
      lastY = event.touches[0].clientY;
      touchTelemetry.push({ type: "touchstart", isTrusted: event.isTrusted });
    }, { passive: true });
    dom.stage.addEventListener("touchmove", (event) => {
      if (lastY === null || event.touches.length !== 1) return;
      const nextY = event.touches[0].clientY;
      const deltaY = lastY - nextY;
      lastY = nextY;
      touchTelemetry.push({ type: "touchmove", isTrusted: event.isTrusted, deltaY });
      try {
        if (resultantMode) { lastY = null; return; }
        if (windowObject.parent !== windowObject && windowObject.parent.location.origin === windowObject.location.origin) {
          const root = windowObject.parent.document.scrollingElement;
          if (root && root.scrollHeight > root.clientHeight) windowObject.parent.scrollBy(0, deltaY);
        }
      } catch (_) { lastY = null; }
    }, { passive: true });
    dom.stage.addEventListener("touchend", () => { lastY = null; }, { passive: true });
    dom.stage.addEventListener("touchcancel", () => { lastY = null; }, { passive: true });
  }

  function bindEvents() {
    dom.stage.addEventListener("pointerdown", (event) => {
      if (event.target !== dom.stage) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: "resultant-stage-start" });
      beginFreeResultantDrag(event);
    });
    dom.stage.addEventListener("pointermove", (event) => {
      if (!drag || drag.target !== dom.stage) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: "resultant-stage-start" });
      updatePointerDrag(event);
    });
    dom.stage.addEventListener("pointerup", (event) => {
      if (!drag || drag.target !== dom.stage) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: "resultant-stage-start" });
      finishPointerDrag(event);
    });
    dom.stage.addEventListener("pointercancel", (event) => {
      if (!drag || drag.target !== dom.stage) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: "resultant-stage-start" });
      cancelPointerDrag(event);
    });
    dom.dragLayer.addEventListener("pointerdown", (event) => {
      const target = event.target.closest(".force-hit,.line-handle,.resultant-hit");
      if (!target) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: target.dataset.semanticKey });
      beginPointerDrag(event, target);
    });
    dom.dragLayer.addEventListener("pointermove", (event) => {
      if (!drag) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: drag.target.dataset.semanticKey });
      updatePointerDrag(event);
    });
    dom.dragLayer.addEventListener("pointerup", (event) => {
      if (!drag) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: drag.target.dataset.semanticKey });
      finishPointerDrag(event);
    });
    dom.dragLayer.addEventListener("pointercancel", (event) => {
      if (!drag) return;
      eventTelemetry.push({ type: event.type, isTrusted: event.isTrusted, pointerType: event.pointerType, target: drag.target.dataset.semanticKey });
      cancelPointerDrag(event);
    });
    dom.dragLayer.addEventListener("keydown", handleOverlayKey);
    dom.dragLayer.addEventListener("click", (event) => {
      const target = event.target.closest(".line-handle,.resultant-hit");
      if (target && event.detail === 0 && !keyboardLine) beginKeyboardLine(target);
    });
    dom.lineTools.addEventListener("click", (event) => {
      const button = event.target.closest("[data-clear-guide]");
      if (!button) return;
      const index = Number(button.dataset.clearGuide);
      const next = M.removeGuide(state.answers[state.currentQuestion], index);
      finalizeAnswer(next, `第 ${index + 1} 條虛線輔助線已清除。`);
    });
    dom.questionProgress.addEventListener("click", (event) => {
      const button = event.target.closest("[data-question-index]");
      if (button) navigateQuestion(Number(button.dataset.questionIndex));
    });
    dom.reviewQuestionNavigation.addEventListener("click", (event) => {
      const button = event.target.closest("[data-question-index]");
      if (!button || !state?.answers) return;
      state.currentQuestion = Number(button.dataset.questionIndex);
      correctOverlay = false;
      renderAll();
    });
    dom.summaryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-question]");
      if (button) navigateQuestion(Number(button.dataset.editQuestion), true);
    });
    dom.undo.addEventListener("click", undo);
    dom.drawResultant.addEventListener("click", toggleResultantMode);
    dom.resetQuestion.addEventListener("click", () => {
      if (typeof dom.resetDialog.showModal === "function") dom.resetDialog.showModal();
      else if (windowObject.confirm("重設本題？")) resetCurrent();
    });
    dom.resetDialog.addEventListener("close", () => { if (dom.resetDialog.returnValue === "confirm") resetCurrent(); });
    dom.previousQuestion.addEventListener("click", () => navigateQuestion((state.currentQuestion + 4) % 5));
    dom.nextQuestion.addEventListener("click", () => navigateQuestion((state.currentQuestion + 1) % 5));
    dom.goSummary.addEventListener("click", goToSummary);
    dom.returnToPractice.addEventListener("click", () => navigateQuestion(state.currentQuestion, true));
    dom.submitAttempt.addEventListener("click", showSubmitConfirmation);
    dom.submitDialog.addEventListener("close", () => { if (dom.submitDialog.returnValue === "confirm") submitNow(); });
    dom.retrySave.addEventListener("click", () => { if (saveDraft()) { renderAll(); announce("最新進度已儲存。"); } });
    dom.toggleCorrect.addEventListener("click", () => { correctOverlay = !correctOverlay; renderAll(); });
    windowObject.addEventListener("resize", () => { if (!drag && !keyboardLine) renderAll(); });
    bindHostForwarding();
  }

  function publicState() {
    return state ? P.clone(state) : null;
  }

  const api = Object.freeze({
    QUESTION_COPY, dependencyIssue, stepPrompt, questionView,
    getState: publicState,
    getScenario: () => scenario,
    getPresentation: () => presentation,
    getCompletion: () => state && scenario ? completionStates() : [],
    getEventTelemetry: () => eventTelemetry.slice(),
    getTouchTelemetry: () => touchTelemetry.slice()
  });
  windowObject.__forceCompositionApp = api;
  queueMicrotask(startup);
  return api;
});
