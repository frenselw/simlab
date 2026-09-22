(function (root, factory) {
  const app = factory(root.ForceOrthogonalDecompositionModel, root.ForceOrthogonalDecompositionScoring,
    root.ForceOrthogonalDecompositionPersistence, root.SimScorm, root.SimActivityFlow, root.document, root);
  if (root) root.__forceOrthogonalApp = app;
})(typeof window !== "undefined" ? window : globalThis, function (M, Scoring, Persistence, SimScorm, SimActivityFlow, documentObject, windowObject) {
  "use strict";

  if (!documentObject || !M || !Scoring || !Persistence) return Object.freeze({ error: "Force orthogonal decomposition dependencies are missing" });

  const SVG_NS = "http://www.w3.org/2000/svg";
  const DEFAULT_VIEWBOX = Object.freeze({ x: 0, y: 0, width: 560, height: 360 });
  const SCENE_FRAMES = Object.freeze({
    default: Object.freeze({ origin: Object.freeze({ x: 120, y: 280 }), viewBox: DEFAULT_VIEWBOX }),
    "inclined-external-force": Object.freeze({ origin: Object.freeze({ x: 170, y: 225 }), viewBox: DEFAULT_VIEWBOX }),
    "inclined-gravity": Object.freeze({ origin: Object.freeze({ x: 170, y: 225 }), viewBox: DEFAULT_VIEWBOX })
  });
  const EDIT_HIT_RADIUS = 26;
  // Fixed SVG-space seat: all three scenarios show the unplaced θ in the
  // same lower-right location even though their world origins differ.
  const THETA_SEAT_SVG = Object.freeze({ x: 480, y: 320 });
  const POINTER_STEP = 16;
  const DEFAULT_DIRECTION_DISTANCE = 100;
  const DEFAULT_PERPENDICULAR_DISTANCE = 140;
  const DEFAULT_COMPONENT_DISTANCE = 100;
  const GIVEN_SLOPE_MARKER_DISTANCE = -180;
  const THETA_SCREEN_RADIUS = 48;
  const THETA_SCREEN_LABEL_GAP = 18;

  const dom = {
    app: documentObject.getElementById("app"),
    stage: documentObject.getElementById("stage"),
    stageCanvas: documentObject.getElementById("stageCanvas"),
    diagram: documentObject.getElementById("diagram"),
    touchPreview: documentObject.getElementById("touchPreview"),
    touchPreviewSvg: documentObject.getElementById("touchPreviewSvg"),
    touchPreviewLabel: documentObject.getElementById("touchPreviewLabel"),
    originHit: documentObject.getElementById("originHit"),
    pointHit: documentObject.getElementById("pointHit"),
    thetaHit: documentObject.getElementById("thetaHit"),
    thetaChoices: documentObject.getElementById("thetaChoices"),
    formulaWorkbench: documentObject.getElementById("formulaWorkbench"),
    formulaTokens: Array.from(documentObject.querySelectorAll("[data-formula-token]")),
    formulaSlots: Array.from(documentObject.querySelectorAll("[data-formula-slot]")),
    formulaGhost: documentObject.getElementById("formulaGhost"),
    editHits: Array.from(documentObject.querySelectorAll("[data-edit-kind]")),
    stageBackButton: documentObject.getElementById("stageBackButton"),
    stageNextButton: documentObject.getElementById("stageNextButton"),
    stageStepLabel: documentObject.getElementById("stageStepLabel"),
    stepPrompt: documentObject.getElementById("stepPrompt"),
    interactionStatus: documentObject.getElementById("interactionStatus"),
    directionCount: documentObject.getElementById("directionCount"),
    perpendicularCount: documentObject.getElementById("perpendicularCount"),
    componentCount: documentObject.getElementById("componentCount"),
    phaseSteps: documentObject.getElementById("phaseSteps"),
    sceneTitle: documentObject.getElementById("sceneTitle"),
    sceneKind: documentObject.getElementById("sceneKind"),
    activitySubtitle: documentObject.getElementById("activitySubtitle"),
    questionCounter: documentObject.getElementById("questionCounter"),
    attemptStatus: documentObject.getElementById("attemptStatus"),
    questionType: documentObject.getElementById("questionType"),
    questionTitle: documentObject.getElementById("questionTitle"),
    questionPrompt: documentObject.getElementById("questionPrompt"),
    questionScenarioBadge: documentObject.getElementById("questionScenarioBadge"),
    questionProgress: documentObject.getElementById("questionProgress"),
    goSummary: documentObject.getElementById("goSummary"),
    forcePanel: documentObject.getElementById("forcePanel"),
    practicePanel: documentObject.getElementById("practicePanel"),
    summaryPanel: documentObject.getElementById("summaryPanel"),
    summaryList: documentObject.getElementById("summaryList"),
    summaryWarning: documentObject.getElementById("summaryWarning"),
    submitAttempt: documentObject.getElementById("submitAttempt"),
    returnToPractice: documentObject.getElementById("returnToPractice"),
    submitStatus: documentObject.getElementById("submitStatus"),
    reviewPanel: documentObject.getElementById("reviewPanel"),
    reviewTitle: documentObject.getElementById("reviewTitle"),
    reviewScore: documentObject.getElementById("reviewScore"),
    reviewCompletion: documentObject.getElementById("reviewCompletion"),
    reviewQuestionNavigation: documentObject.getElementById("reviewQuestionNavigation"),
    reviewFormulaSummary: documentObject.getElementById("reviewFormulaSummary"),
    reviewFormulaRows: documentObject.getElementById("reviewFormulaRows"),
    reviewFeedback: documentObject.getElementById("reviewFeedback"),
    reviewTrustNote: documentObject.getElementById("reviewTrustNote"),
    reviewActions: documentObject.getElementById("reviewActions"),
    technicalPanel: documentObject.getElementById("technicalPanel"),
    technicalTitle: documentObject.getElementById("technicalTitle"),
    technicalMessage: documentObject.getElementById("technicalMessage"),
    technicalActions: documentObject.getElementById("technicalActions"),
    saveBanner: documentObject.getElementById("saveBanner"),
    saveBannerText: documentObject.getElementById("saveBannerText"),
    retrySave: documentObject.getElementById("retrySave"),
    backButton: documentObject.getElementById("backButton"),
    redrawButton: documentObject.getElementById("redrawButton"),
    nextButton: documentObject.getElementById("nextButton"),
    resetButton: documentObject.getElementById("resetButton"),
    liveRegion: documentObject.getElementById("liveRegion")
  };

  const ACTIVITY = Persistence.ACTIVITY;
  const SCENARIO_IDS = Persistence.SCENARIO_IDS;
  let activity = Persistence.freshDraft();
  let state = activity.questions[0];
  let reviewResult = null;
  let runtimeState = "editable";
  let reviewSnapshot = null;
  let finishRetryAvailable = false;
  let activityLoadError = "";
  let invalidDraftRecovery = false;
  let standaloneStorageState = "disabled";
  let draftSaveState = "unknown";
  let draftSaveError = "";
  let drag = null;
  let keyboardDrag = null;
  let formulaDrag = null;
  let selectedFormula = null;
  let suppressFormulaClick = false;
  let hostTouchScroll = null;
  let pointerPanelScrollTop = null;
  let message = "由 O 拖出第 1 條方向虛線。";
  let messageKind = "";
  const pointerTelemetry = [];

  function activeScene() { return M.getScenario(state.scenarioId) || M.getScenario(); }
  function isStandaloneMode() { return Boolean(SimScorm?.isStandalone?.()); }
  function isPracticeEditable() { return runtimeState === "editable" && activity.phase === "practice"; }
  function thetaInteractionOptions(source = state) {
    const scene = M.getScenario(source?.scenarioId) || activeScene();
    const scale = Math.max(diagramTransform().scale, .01);
    return {
      scene,
      allowImperfect: true,
      perpendiculars: source?.perpendiculars || [],
      radius: THETA_SCREEN_RADIUS / scale,
      labelGap: THETA_SCREEN_LABEL_GAP / scale
    };
  }
  function thetaCandidatesForInteraction(source = state) {
    return M.thetaCandidatesForInteraction(source?.directions || [], thetaInteractionOptions(source));
  }
  function sceneFrame(scene = activeScene()) { return SCENE_FRAMES[scene.id] || SCENE_FRAMES.default; }
  function sceneViewBox(scene = activeScene()) { return sceneFrame(scene).viewBox; }
  function sceneWorldBounds(scene = activeScene()) {
    const frame = sceneFrame(scene);
    const viewBox = frame.viewBox;
    return {
      left: viewBox.x - frame.origin.x,
      right: viewBox.x + viewBox.width - frame.origin.x,
      bottom: frame.origin.y - viewBox.y - viewBox.height,
      top: frame.origin.y - viewBox.y
    };
  }
  function sceneOrigin() { return activeScene().origin; }
  function sceneForceHead() { return activeScene().forceHead; }
  function syncCurrentQuestion(next = state) {
    if (runtimeState !== "editable") return false;
    state = next;
    activity.questions[activity.currentQuestion] = M.clone(next);
    return true;
  }
  function snapshotActivity() {
    return { ...activity, questions: activity.questions.map(question => M.clone(question)) };
  }
  function currentQuestionIndex() { return activity.currentQuestion; }

  const PHASE_COPY = Object.freeze({
    perpendiculars: "由原力箭嘴頂點 P 拖出兩條垂線。畫好後可直接拖動終點調整，接近垂足時會吸附。",
    components: "由 O 拖出兩支分力。畫歪了可直接拖動分力箭頭調整方向及長度，接近交點時會吸附。",
    angle: "",
    formulas: "按圖中 θ 的位置，用 sin θ 或 cos θ 表示兩個分力的大小。原力大小會按題目顯示，不需要計算數值。"
  });

  function directionAxisLabel(scene, axisKey) {
    if (!axisKey) return "";
    if (scene.id === "inclined-gravity") return axisKey === "parallel" ? "平行斜面" : axisKey === "normal" ? "垂直斜面" : "";
    return scene.axes.find(axis => axis.key === axisKey)?.label || "";
  }

  function directionPhaseCopy(scene = activeScene()) {
    const labels = scene.axes.map(axis => directionAxisLabel(scene, axis.key));
    return `由 O 拖出兩條方向虛線（${labels[0]}及${labels[1]}）。畫好後可拖動線上的小方點調整方向；接近${labels[0]}或${labels[1]}時會吸附。`;
  }

  function formulaStepComplete(question = state) {
    const expectations = M.formulaExpectations(question) || [];
    return expectations.length > 0 && expectations.every(({ key }) => ["sin", "cos"].includes(question.formulas?.[key]));
  }

  function formulaCompletionCopy() {
    return activity.currentQuestion < SCENARIO_IDS.length - 1
      ? "第 5 步「分力表達式」已完成，請按「下一題」。"
      : "第 5 步「分力表達式」已完成，請前往提交前檢查。";
  }

  function formulaNextLabel() {
    return activity.currentQuestion < SCENARIO_IDS.length - 1 ? "下一題" : "完成本題，前往檢查";
  }

  function createSvg(name, attributes = {}) {
    const node = documentObject.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  // Format the small vocabulary used in learner copy, without interpreting HTML.
  function setMathText(node, text) {
    const fragment = documentObject.createDocumentFragment();
    const pattern = /(?:sin|cos)\s*θ|(?<![A-Za-z])(?:[FG](?:_?[12xy]|[₁₂ₓᵧ])?)(?![A-Za-z0-9])|θ|(?<![A-Za-z])[OP](?![A-Za-z])/gu;
    let end = 0;
    for (const match of text.matchAll(pattern)) {
      fragment.append(documentObject.createTextNode(text.slice(end, match.index)));
      const math = documentObject.createElement("span");
      math.className = "math-inline";
      const token = match[0];
      const variable = documentObject.createElement("var");
      if (token.startsWith("sin") || token.startsWith("cos")) {
        math.append(documentObject.createTextNode(`${token.slice(0, 3)} `));
        variable.textContent = "θ";
      } else {
        const symbol = /^([FG])(?:_?([12xy])|([₁₂ₓᵧ]))?$/.exec(token);
        variable.textContent = symbol?.[1] || token;
        const subscript = symbol?.[2] || symbol?.[3];
        math.append(variable);
        if (subscript) {
          const sub = documentObject.createElement("sub");
          sub.textContent = ({ "1": "1", "2": "2", x: "x", y: "y", "₁": "1", "₂": "2", "ₓ": "x", "ᵧ": "y" })[subscript] || subscript;
          math.append(sub);
        }
      }
      if (!math.contains(variable)) math.append(variable);
      fragment.append(math);
      end = match.index + token.length;
    }
    fragment.append(documentObject.createTextNode(text.slice(end)));
    node.replaceChildren(fragment);
  }

  function setAttributes(node, attributes) {
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  function worldToSvg(point, scene = activeScene()) {
    const origin = sceneFrame(scene).origin;
    return { x: origin.x + point.x, y: origin.y - point.y };
  }

  function svgToWorld(point, scene = activeScene()) {
    const origin = sceneFrame(scene).origin;
    return { x: point.x - origin.x, y: origin.y - point.y };
  }

  function diagramTransform() {
    const rect = dom.diagram.getBoundingClientRect();
    const viewBox = sceneViewBox();
    const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height) || 1;
    return {
      rect,
      scale,
      offsetX: (rect.width - viewBox.width * scale) / 2,
      offsetY: (rect.height - viewBox.height * scale) / 2,
      viewBox
    };
  }

  function clientToWorld(clientX, clientY) {
    const transform = diagramTransform();
    const svgPoint = {
      x: (clientX - transform.rect.left - transform.offsetX) / transform.scale,
      y: (clientY - transform.rect.top - transform.offsetY) / transform.scale
    };
    return svgToWorld(svgPoint);
  }

  function worldToStagePixel(point) {
    const transform = diagramTransform();
    const svgPoint = worldToSvg(point);
    const stageRect = dom.stageCanvas.getBoundingClientRect();
    return {
      x: transform.rect.left - stageRect.left + transform.offsetX + svgPoint.x * transform.scale,
      y: transform.rect.top - stageRect.top + transform.offsetY + svgPoint.y * transform.scale
    };
  }

  function worldThreshold(pointerType) {
    const transform = diagramTransform();
    return M.thresholdFor(pointerType) / Math.max(transform.scale, 0.01);
  }

  function hideTouchPreview() {
    dom.touchPreview.hidden = true;
    dom.touchPreviewSvg.replaceChildren();
  }

  function renderTouchPreview(thetaLabelPoint) {
    if (!isPracticeEditable() || !drag || !["touch", "pen"].includes(drag.pointerType)) {
      hideTouchPreview();
      return;
    }
    // Follow the geometry after snapping, not the finger's unsnapped position.
    let point = drag.preview?.point || drag.point;
    if (drag.kind === "direction" && drag.preview?.direction) {
      const unit = drag.preview.direction.unit;
      point = M.add(sceneOrigin(), M.scale(unit, M.dot(M.subtract(drag.point, sceneOrigin()), unit)));
    }
    const focus = worldToSvg(point);
    const canvas = dom.stageCanvas.getBoundingClientRect();
    // Keep the entire lens inside a short canvas, including its caption.
    dom.touchPreview.style.width = `${Math.max(0, Math.min(canvas.width * .44, 192, (canvas.height - 40) * 1.5))}px`;
    dom.touchPreview.hidden = false;
    const kindLabel = { direction: "方向線", perpendicular: "垂線", component: "分力", theta: "θ" }[drag.kind];
    dom.touchPreviewLabel.textContent = `局部放大 ×2・${kindLabel}`;
    const transform = diagramTransform();
    const lens = dom.touchPreviewSvg.getBoundingClientRect();
    const width = lens.width / (transform.scale * 2);
    const height = lens.height / (transform.scale * 2);
    const view = transform.viewBox;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const left = clamp(focus.x - width / 2, view.x, view.x + view.width - width);
    const top = clamp(focus.y - height / 2, view.y, view.y + view.height - height);
    dom.touchPreviewSvg.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
    const scene = Array.from(dom.diagram.children, child => {
      const clone = child.cloneNode(true);
      [clone, ...clone.querySelectorAll("[id], [tabindex]")].forEach(node => {
        node.removeAttribute("id");
        node.removeAttribute("tabindex");
      });
      return clone;
    });
    dom.touchPreviewSvg.replaceChildren(...scene);
    // Editable θ lives in an HTML hit target, so include its glyph separately.
    if (thetaLabelPoint) drawScreenText(dom.touchPreviewSvg, thetaLabelPoint, "θ", "scene-label student-theta-label", {
      "data-label": "student-theta", "text-anchor": "middle"
    });
    dom.touchPreviewSvg.appendChild(createSvg("circle", {
      cx: focus.x, cy: focus.y, r: 9 / (transform.scale * 2), class: "touch-preview-focus"
    }));

    // Stay in one corner until the finger approaches it; never follow the hand.
    const stage = dom.stageCanvas.getBoundingClientRect();
    const box = dom.touchPreview.getBoundingClientRect();
    const inset = 8;
    const corners = ["top-right", "top-left", "bottom-right", "bottom-left"].map(name => ({
      name,
      x: name.endsWith("right") ? stage.right - box.width - inset : stage.left + inset,
      y: name.startsWith("bottom") ? stage.bottom - box.height - inset : stage.top + inset
    }));
    let corner = corners.find(item => item.name === drag.previewCorner) || corners[0];
    const fingerMargin = 24;
    if (drag.clientX > corner.x - fingerMargin && drag.clientX < corner.x + box.width + fingerMargin &&
        drag.clientY > corner.y - fingerMargin && drag.clientY < corner.y + box.height + fingerMargin) {
      const distance = item => Math.hypot(drag.clientX - item.x - box.width / 2, drag.clientY - item.y - box.height / 2);
      corner = corners.reduce((best, item) => distance(item) > distance(best) ? item : best);
    }
    drag.previewCorner = corner.name;
    dom.touchPreview.dataset.corner = corner.name;
  }

  function setHitPosition(button, point) {
    const position = worldToStagePixel(point);
    button.style.left = `${position.x}px`;
    button.style.top = `${position.y}px`;
  }

  function setHitVisibility(button, visible, label) {
    button.hidden = !visible;
    button.setAttribute("aria-hidden", visible ? "false" : "true");
    button.disabled = !visible;
    if (label) button.setAttribute("aria-label", label);
  }

  function updateThetaHitPresentation() {
    const thetaDrag = drag?.kind === "theta" ? drag : keyboardDrag?.kind === "theta" ? keyboardDrag : null;
    const snapped = thetaDrag ? Boolean(thetaDrag.preview) : Boolean(state.theta);
    dom.thetaHit.dataset.thetaState = snapped ? "placed" : thetaDrag ? "dragging" : "unplaced";
  }

  function drawGrid(parent, viewBox = sceneViewBox()) {
    const layer = createSvg("g", { "aria-hidden": "true" });
    for (let x = viewBox.x; x <= viewBox.x + viewBox.width; x += 40) layer.appendChild(createSvg("line", { x1: x, y1: viewBox.y, x2: x, y2: viewBox.y + viewBox.height, class: "force-grid-line" }));
    for (let y = viewBox.y; y <= viewBox.y + viewBox.height; y += 40) layer.appendChild(createSvg("line", { x1: viewBox.x, y1: y, x2: viewBox.x + viewBox.width, y2: y, class: "force-grid-line" }));
    parent.appendChild(layer);
  }

  function drawWorldLine(parent, start, end, className, attributes = {}) {
    parent.appendChild(createSvg("line", {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      class: className,
      ...attributes
    }));
  }

  function drawWorldPath(parent, pathData, className, attributes = {}) {
    if (!pathData) return;
    parent.appendChild(createSvg("path", { d: pathData, class: className, ...attributes }));
  }

  function drawScreenText(parent, point, text, className, attributes = {}) {
    const svgPoint = worldToSvg(point);
    const node = createSvg("text", { x: svgPoint.x, y: svgPoint.y, class: className, ...attributes });
    const force = /^([FG])(?:_?([12xy])|([₁₂ₓᵧ]))$/.exec(text);
    if (force) {
      node.appendChild(documentObject.createTextNode(force[1]));
      const subscript = createSvg("tspan", { "baseline-shift": "sub", "font-size": "70%", "class": "math-subscript" });
      const value = force[2] || force[3];
      subscript.textContent = ({ "1": "1", "2": "2", x: "x", y: "y", "₁": "1", "₂": "2", "ₓ": "x", "ᵧ": "y" })[value] || value;
      node.appendChild(subscript);
      node.setAttribute("aria-label", `${force[1]} 下標 ${subscript.textContent}`);
    } else node.textContent = text;
    parent.appendChild(node);
  }

  function componentAxisKey(component, source = state, scene = activeScene()) {
    if (!component) return null;
    const target = M.visibleIntersections(source.perpendiculars, source.directions, scene)
      .find(item => item.key === component.targetKey);
    const direction = target && source.directions.find(item => item.key === target.directionKey);
    return direction ? M.directionAxisKey(direction, scene) : null;
  }

  function componentDisplayLabel(component, index, source = state, scene = activeScene()) {
    // The gravity question has a fixed semantic naming convention: F1 is
    // always Gₓ (parallel to the incline) and F2 is always Gᵧ (normal to the
    // incline).  Keeping this independent of the line's actual axis makes a
    // swapped construction visible to the learner and lets scoring penalise
    // the swap instead of silently renaming it.
    if (scene.id === "inclined-gravity") {
      return M.componentSymbol(scene, index === 0 ? "parallel" : "normal", index);
    }
    return M.componentSymbol(scene, componentAxisKey(component, source, scene), index);
  }

  function drawNode(parent, point, className = "force-node", radius = 5) {
    parent.appendChild(createSvg("circle", { cx: point.x, cy: point.y, r: radius, class: className }));
  }

  function drawRightAngle(parent, perpendicular, direction) {
    const foot = M.projectionFoot(sceneForceHead(), direction, activeScene());
    const along = direction.unit || direction;
    const normal = M.normalize(M.subtract(sceneForceHead(), foot));
    if (!normal) return;
    const size = 13;
    const first = M.add(foot, M.scale(along, size));
    const second = M.add(first, M.scale(normal, size));
    const third = M.add(foot, M.scale(normal, size));
    parent.appendChild(createSvg("path", {
      d: `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} L ${second.x.toFixed(2)} ${second.y.toFixed(2)} L ${third.x.toFixed(2)} ${third.y.toFixed(2)}`,
      class: "right-angle-mark",
      "data-perpendicular-key": perpendicular.key
    }));
  }

  function drawThetaArc(parent, candidate, className = "theta-arc") {
    const radius = candidate.radius ?? 48;
    // A given slope marker keeps its semantic vertex on the plane for hit
    // testing and scoring, but can draw a few pixels outward for legibility.
    const drawVertex = candidate.visualVertex || candidate.vertex;
    const points = [];
    const count = 16;
    for (let index = 0; index <= count; index += 1) {
      const angle = candidate.startAngle + (candidate.endAngle - candidate.startAngle) * index / count;
      points.push(M.add(drawVertex, M.scale(M.fromAngle(angle), radius)));
    }
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    parent.appendChild(createSvg("path", {
      d: path,
      class: className,
      "data-theta-key": candidate.key,
      "data-theta-vertex-x": candidate.vertex.x,
      "data-theta-vertex-y": candidate.vertex.y
    }));
  }

  function givenSlopeCandidate(scene) {
    if (!scene?.plane || scene.thetaMode !== "given") return null;
    const parallel = scene.axes[0].unit;
    const normal = scene.axes[1].unit;
    const planePoint = M.add(scene.origin, M.scale(normal, -scene.plane.bodyOffset));
    // Anchor the known-angle marker on the actual slope.  Its compact arc and
    // short rays keep the label readable without creating a detached diagram.
    // Place the known slope angle on the open left portion of the incline,
    // like a textbook diagram.  Keeping it away from O and P leaves the
    // construction itself unobstructed while remaining inside narrow stages.
    const vertex = M.add(planePoint, M.scale(parallel, GIVEN_SLOPE_MARKER_DISTANCE));
    const radius = 28;
    // Keep the stored vertex on the physical plane, while drawing the small
    // marker just below the incline (the conventional place for the slope
    // angle) so the arc and θ do not merge into the thick slope.
    const visualVertex = M.add(vertex, M.scale(normal, -18));
    const referenceEnd = M.add(visualVertex, { x: 48, y: 0 });
    const slopeEnd = M.add(visualVertex, M.scale(parallel, 48));
    return {
      key: "given-slope-theta",
      vertex,
      visualVertex,
      startAngle: 0,
      endAngle: scene.plane.angle,
      radius,
      center: M.add(visualVertex, M.scale(M.fromAngle(scene.plane.angle / 2), radius)),
      labelCenter: M.add(visualVertex, M.scale(M.fromAngle(scene.plane.angle / 2), radius + 12)),
      referenceEnd,
      slopeEnd
    };
  }

  function drawGivenSlopeAnnotation(parent, scene) {
    const candidate = givenSlopeCandidate(scene);
    if (!candidate) return null;
    const { vertex, visualVertex, referenceEnd, slopeEnd } = candidate;
    const markerVertex = visualVertex || vertex;
    drawWorldLine(parent, markerVertex, referenceEnd, "given-theta-reference", { "data-scene": scene.id });
    drawWorldLine(parent, markerVertex, slopeEnd, "given-theta-slope", { "data-scene": scene.id });
    drawThetaArc(parent, candidate, "given-theta-arc");
    return candidate;
  }

  function drawInclinedScenery(parent, scene) {
    if (!scene.plane) return;
    const parallel = scene.axes[0].unit;
    const normal = scene.axes[1].unit;
    const planePoint = M.add(scene.origin, M.scale(normal, -scene.plane.bodyOffset));
    const planeStart = M.add(planePoint, M.scale(parallel, -190));
    const planeEnd = M.add(planePoint, M.scale(parallel, 260));
    drawWorldLine(parent, planeStart, planeEnd, "inclined-plane", { "data-scene": scene.id });
    drawWorldLine(parent, M.add(planeStart, M.scale(normal, -9)), M.add(planeEnd, M.scale(normal, -9)), "inclined-plane-edge");
    const halfWidth = 23;
    const halfHeight = 17;
    // The lower body edge sits on the plane centreline, matching the physical
    // contact point used by the construction and scoring model.
    const bodyCenter = M.add(scene.origin, M.scale(normal, -scene.plane.bodyOffset + halfHeight));
    const corners = [
      M.add(M.add(bodyCenter, M.scale(parallel, -halfWidth)), M.scale(normal, -halfHeight)),
      M.add(M.add(bodyCenter, M.scale(parallel, halfWidth)), M.scale(normal, -halfHeight)),
      M.add(M.add(bodyCenter, M.scale(parallel, halfWidth)), M.scale(normal, halfHeight)),
      M.add(M.add(bodyCenter, M.scale(parallel, -halfWidth)), M.scale(normal, halfHeight))
    ];
    const points = corners.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    parent.appendChild(createSvg("polygon", { points, class: "inclined-body", "data-scene": scene.id }));
  }

  function drawScene() {
    const interactive = isPracticeEditable();
    const editing = interactive && (drag?.editIndex != null ? drag : keyboardDrag?.editIndex != null ? keyboardDrag : null);
    const scene = editing?.preview?.editedState || state;
    const frame = sceneFrame(activeScene());
    const viewBox = frame.viewBox;
    dom.diagram.replaceChildren();
    dom.diagram.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    drawGrid(dom.diagram, viewBox);
    const worldLayer = createSvg("g", { transform: `translate(${frame.origin.x} ${frame.origin.y}) scale(1 -1)` });
    const labelLayer = createSvg("g", { "aria-hidden": "true" });
    drawInclinedScenery(worldLayer, activeScene());
    const originalPath = M.arrowPathData(sceneOrigin(), sceneForceHead(), { headLength: 25, headWidth: 23, shaftWidth: 6 });
    // Draw the original force after the block so its shaft and arrowhead are
    // still visible when the vector starts at the object's origin.
    drawWorldPath(worldLayer, originalPath, "force-original-line", {
      "data-kind": "original",
      "data-start-x": sceneOrigin().x,
      "data-start-y": sceneOrigin().y,
      "data-end-x": sceneForceHead().x,
      "data-end-y": sceneForceHead().y
    });
    const givenSlope = drawGivenSlopeAnnotation(worldLayer, activeScene());
    if (givenSlope) {
      drawScreenText(labelLayer, M.add(givenSlope.labelCenter || givenSlope.center, { x: 5, y: 4 }), "θ", "scene-label given-theta-label", { "data-label": "given-slope-theta" });
    }

    scene.directions.forEach((direction, index) => {
      const segment = M.lineSegmentForDirection(direction, sceneWorldBounds(), activeScene());
      if (!segment) return;
      drawWorldLine(worldLayer, segment[0], segment[1], "force-direction-line", { "data-direction-index": index, "data-direction-key": direction.key });
    });

    scene.perpendiculars.forEach((perpendicular, index) => {
      drawWorldLine(worldLayer, sceneForceHead(), perpendicular.end, "force-perpendicular-line", {
        "data-perpendicular-index": index,
        "data-perpendicular-key": perpendicular.key,
        "data-target-key": perpendicular.targetKey || ""
      });
      const direction = M.perpendicularDirection(perpendicular, scene.directions, activeScene());
      if (direction) drawRightAngle(worldLayer, perpendicular, direction);
    });

    scene.components.forEach((component, index) => {
      drawWorldPath(worldLayer, M.arrowPathData(sceneOrigin(), component.end, { headLength: 22, headWidth: 21, shaftWidth: 5 }), "force-component-line", {
        "data-component-index": index,
        "data-component-key": component.key,
        "data-target-key": component.targetKey || "",
        "data-start-x": sceneOrigin().x,
        "data-start-y": sceneOrigin().y,
        "data-end-x": component.end.x,
        "data-end-y": component.end.y
      });
    });

    if ((scene.phase === "angle" || scene.phase === "formulas") && !scene.theta) {
      thetaCandidatesForInteraction(scene).forEach(candidate => {
        drawThetaArc(worldLayer, candidate, "theta-arc theta-guide");
      });
    }
    if (scene.theta && (!interactive || (drag?.kind !== "theta" && keyboardDrag?.kind !== "theta"))) {
      const candidate = thetaCandidatesForInteraction(scene).find((item) => item.key === scene.theta);
      if (candidate) {
        drawThetaArc(worldLayer, candidate);
      }
    }

    if (interactive && drag?.preview && drag.editIndex == null) {
      if (drag.kind === "direction" && drag.preview.valid) {
        const segment = M.lineSegmentForDirection(drag.preview.direction, sceneWorldBounds(), activeScene());
        if (segment) drawWorldLine(worldLayer, segment[0], segment[1], "force-direction-line force-preview", { "data-preview": "direction" });
      }
      if (drag.kind === "perpendicular" && drag.preview.valid) {
        drawWorldLine(worldLayer, sceneForceHead(), drag.preview.point, "force-perpendicular-line force-preview", { "data-preview": "perpendicular", "data-target-key": drag.preview.targetKey || "" });
      }
      if (drag.kind === "component" && drag.preview.valid) {
        drawWorldPath(worldLayer, M.arrowPathData(sceneOrigin(), drag.preview.point, { headLength: 22, headWidth: 21, shaftWidth: 5 }), "force-component-line force-preview", { "data-preview": "component", "data-component-index": state.components.length, "data-target-key": drag.preview.targetKey || "" });
      }
      if (drag.kind === "theta" && drag.preview) {
        drawThetaArc(worldLayer, drag.preview);
      }
    }

    if (interactive && keyboardDrag?.preview && keyboardDrag.editIndex == null) {
      const preview = keyboardDrag.preview;
      if (keyboardDrag.kind === "direction" && preview.valid) {
        const segment = M.lineSegmentForDirection(preview.direction, sceneWorldBounds(activeScene()), activeScene());
        if (segment) drawWorldLine(worldLayer, segment[0], segment[1], "force-direction-line force-preview", { "data-preview": "keyboard-direction" });
      }
      if (keyboardDrag.kind === "perpendicular" && preview.valid) drawWorldLine(worldLayer, sceneForceHead(), preview.point, "force-perpendicular-line force-preview", { "data-preview": "keyboard-perpendicular", "data-target-key": preview.targetKey || "" });
      if (keyboardDrag.kind === "component" && preview.valid) drawWorldPath(worldLayer, M.arrowPathData(sceneOrigin(), preview.point, { headLength: 22, headWidth: 21, shaftWidth: 5 }), "force-component-line force-preview", { "data-preview": "keyboard-component", "data-component-index": state.components.length, "data-target-key": preview.targetKey || "" });
      if (keyboardDrag.kind === "theta" && preview) {
        drawThetaArc(worldLayer, preview);
      }
    }

    drawNode(worldLayer, sceneOrigin(), "force-node", 5);
    drawNode(worldLayer, sceneForceHead(), "force-node", 5);
    dom.diagram.appendChild(worldLayer);
    drawScreenText(labelLayer, { x: sceneOrigin().x - 24, y: sceneOrigin().y - 12 }, "O", "scene-label", { "data-label": "origin" });
    drawScreenText(labelLayer, M.add(sceneForceHead(), { x: 14, y: 12 }), "P", "scene-label", { "data-label": "force-head" });
    const forceVector = M.subtract(sceneForceHead(), sceneOrigin());
    const forceUnit = M.normalize(forceVector) || { x: 1, y: 0 };
    const isGravityScene = activeScene().id === "inclined-gravity";
    const forceLabelFraction = activeScene().id === "inclined-external-force" ? .64 : .5;
    const forceLabelOffset = activeScene().id === "inclined-external-force"
      ? { x: -forceUnit.y * 18, y: forceUnit.x * 18 }
      : isGravityScene ? { x: 16, y: 18 } : { x: 8, y: 12 };
    const forceLabelAnchor = isGravityScene
      ? M.add(sceneForceHead(), { x: 26, y: -20 })
      : M.add(M.add(sceneOrigin(), M.scale(forceVector, forceLabelFraction)), forceLabelOffset);
    const forceLabelDirection = isGravityScene ? { x: 26, y: -20 } : forceLabelOffset;
    const studentThetaLabelPoint = (() => {
      const thetaPreview = interactive ? (drag?.kind === "theta" ? drag : keyboardDrag?.kind === "theta" ? keyboardDrag : null) : null;
      if (thetaPreview?.point) return thetaPreview.point;
      if (thetaPreview?.preview?.labelCenter) return thetaPreview.preview.labelCenter;
      if (scene.theta) return thetaCandidatesForInteraction(scene).find(item => item.key === scene.theta)?.labelCenter || null;
      if (scene.thetaPoint) return scene.thetaPoint;
      return null;
    })();
    // The fixed incline angle is a label-avoidance obstacle, but it is not a
    // student answer. Keep it separate so review cannot invent a student θ
    // when the learner left the third question unmarked.
    const thetaLabelPoint = studentThetaLabelPoint || (() => {
      if (activeScene().thetaMode === "given") return givenSlopeCandidate(activeScene())?.labelCenter || null;
      return null;
    })();
    const labelDistance = (first, second) => M.distance(first, second);
    const safeUnit = (value, fallback = { x: 1, y: 0 }) => M.normalize(value) || fallback;
    const moveLabelAwayFrom = (point, obstacle, preferredDirection, clearance) => {
      if (!obstacle) return point;
      const distance = labelDistance(point, obstacle);
      if (distance >= clearance) return point;
      const direction = safeUnit(preferredDirection, { x: 0, y: 1 });
      const amount = clearance - distance;
      const positive = M.add(point, M.scale(direction, amount));
      const negative = M.add(point, M.scale(direction, -amount));
      return labelDistance(positive, obstacle) >= labelDistance(negative, obstacle) ? positive : negative;
    };
    const labelPoints = [];
    const placeLabel = (point, preferredDirection, clearance) => {
      let placed = moveLabelAwayFrom(point, thetaLabelPoint, preferredDirection, clearance);
      for (const prior of labelPoints) placed = moveLabelAwayFrom(placed, prior.point, preferredDirection, clearance * .82);
      labelPoints.push({ point: placed });
      return placed;
    };
    const forceLabelPoint = placeLabel(
      forceLabelAnchor,
      forceLabelDirection,
      activeScene().id === "inclined-external-force" ? 32 : 28
    );
    drawScreenText(labelLayer, forceLabelPoint, activeScene().forceSymbol, "scene-label force-label", { "data-label": "original-force" });
    scene.components.forEach((component, index) => {
      const isInclinedExternal = activeScene().id === "inclined-external-force";
      const componentAngle = Math.atan2(component.end.y, component.end.x);
      const parallelAngle = Math.atan2(activeScene().axes[0].unit.y, activeScene().axes[0].unit.x);
      const isParallelComponent = isInclinedExternal && M.lineAngleDifference(componentAngle, parallelAngle) < M.radians(10);
      const componentVector = M.subtract(component.end, sceneOrigin());
      const axisKey = componentAxisKey(component, scene, activeScene());
      const gravityParallel = isGravityScene && axisKey === "parallel";
      const fraction = isParallelComponent || gravityParallel ? .68 : .52;
      const midpoint = M.add(sceneOrigin(), M.scale(componentVector, fraction));
      const unit = M.normalize(componentVector) || { x: 1, y: 0 };
      const offsetMagnitude = isParallelComponent ? 24 : gravityParallel ? 20 : 14;
      const offset = { x: -unit.y * offsetMagnitude, y: unit.x * offsetMagnitude };
      const label = componentDisplayLabel(component, index, scene, activeScene());
      const gravityNormal = activeScene().id === "inclined-gravity" && axisKey === "normal";
      const gravityParallelOffset = { x: unit.y * 22, y: -unit.x * 22 };
      const labelPoint = gravityNormal
        ? placeLabel(M.add(midpoint, { x: 24, y: 0 }), { x: 1, y: 0 }, 28)
        : placeLabel(M.add(midpoint, gravityParallel ? gravityParallelOffset : offset), gravityParallel ? gravityParallelOffset : offset, 28);
      drawScreenText(labelLayer, labelPoint, label, `scene-label component-label component-label-${index}`, { "data-component-label": index, "data-component-index": index, "data-component-axis": axisKey || "", "text-anchor": gravityNormal ? "start" : unit.y > .5 ? "end" : "middle" });
    });
    // The editable θ is an HTML hit target so it can carry the drag and
    // keyboard affordances. In the summary and after submission the stage is
    // read-only, so keep the learner's saved label in the SVG instead. This
    // also covers a free thetaPoint that has no matching arc candidate.
    const readOnlyStage = runtimeState === "review" || activity.phase !== "practice";
    if (readOnlyStage && studentThetaLabelPoint) {
      drawScreenText(labelLayer, studentThetaLabelPoint, "θ", "scene-label student-theta-label", {
        "data-label": "student-theta",
        "text-anchor": "middle",
        "aria-hidden": "true"
      });
    }
    dom.diagram.appendChild(labelLayer);
    const thetaDrag = interactive ? (drag?.kind === "theta" ? drag : keyboardDrag?.kind === "theta" ? keyboardDrag : null) : null;
    updateThetaHitPresentation();
    if (thetaDrag) setHitPosition(dom.thetaHit, thetaDrag.point || thetaDrag.preview?.labelCenter || thetaDrag.preview?.center);
    if (editing?.preview?.editedState) setHitPosition(editing.target, editPoint(editing.kind, editing.editIndex, scene));
    if (editing) dom.thetaHit.style.visibility = scene.theta ? "" : "hidden";
    renderTouchPreview(studentThetaLabelPoint);
  }

  function editPoint(kind, index, source = state) {
    const editScene = M.getScenario(source.scenarioId) || activeScene();
    const point = kind === "direction" ? M.add(editScene.origin, M.scale(source.directions[index].unit, 120))
      : source[kind === "component" ? "components" : "perpendiculars"][index].end;
    const anchor = kind === "perpendicular" ? sceneForceHead() : sceneOrigin();
    return M.boundedEndpoint(anchor, point, editingBounds(anchor));
  }

  function editingBounds(anchor = null) {
    // Keep the whole 52px target visible, including after a viewport resize.
    const transform = diagramTransform();
    const canvas = dom.stageCanvas.getBoundingClientRect();
    const padding = Math.min(transform.rect.left - canvas.left, transform.rect.top - canvas.top);
    const inset = Math.max(1, EDIT_HIT_RADIUS + 2 - padding) / Math.max(transform.scale, .01);
    const bounds = sceneWorldBounds();
    const result = {
      left: bounds.left + inset,
      right: bounds.right - inset,
      bottom: bounds.bottom + inset,
      // The navigation buttons are an overlay, not a drawing boundary.  A
      // global cap derived from their rectangle clipped valid intersections
      // on narrow stages (especially the upper inclined-force foot).
      top: bounds.top - inset
    };
    // The force head can sit just beyond the inset top edge at a narrow
    // viewport. Include the active anchor so dragging an existing segment
    // never starts outside the clipping rectangle.
    if (anchor) {
      result.left = Math.min(result.left, anchor.x);
      result.right = Math.max(result.right, anchor.x);
      result.bottom = Math.min(result.bottom, anchor.y);
      result.top = Math.max(result.top, anchor.y);
    }
    return result;
  }

  function boundThetaPoint(point) {
    const bounds = editingBounds();
    return {
      x: M.clamp(point.x, bounds.left, bounds.right),
      y: M.clamp(point.y, bounds.bottom, bounds.top)
    };
  }

  function updateHitTargets() {
    if (!isPracticeEditable()) {
      [dom.originHit, dom.pointHit, dom.thetaHit, ...dom.editHits].forEach(button => {
        if (!button) return;
        setHitVisibility(button, false);
        button.dataset.dragKind = "";
        button.disabled = true;
      });
      return;
    }
    const phase = state.phase;
    const originActive = (phase === "directions" && state.directions.length < 2) || (phase === "components" && state.components.length < 2);
    const originLabel = phase === "components" ? "由共同起點 O 開始畫分力箭嘴" : "由共同起點 O 開始畫方向虛線";
    setHitVisibility(dom.originHit, originActive, originLabel);
    setHitPosition(dom.originHit, sceneOrigin());
    dom.originHit.dataset.dragKind = phase === "components" ? "component" : "direction";

    const pointActive = phase === "perpendiculars" && state.perpendiculars.length < 2;
    setHitVisibility(dom.pointHit, pointActive, "由原力箭嘴頂點 P 開始畫垂線");
    setHitPosition(dom.pointHit, sceneForceHead());
    dom.pointHit.dataset.dragKind = "perpendicular";

    const thetaCandidatesAvailable = thetaCandidatesForInteraction().length > 0;
    const thetaActive = phase === "angle" || phase === "formulas" || Boolean(state.theta);
    const thetaLabel = state.theta
      ? "拖動 θ 更換角度位置"
      : thetaCandidatesAvailable ? "拖動 θ 到 O 或 P 附近的銳角" : "目前沒有可吸附的角弧；可返回調整方向線";
    setHitVisibility(dom.thetaHit, thetaActive, thetaLabel);
    dom.thetaHit.disabled = phase !== "angle" && phase !== "formulas";
    setHitPosition(dom.thetaHit, thetaVisualPoint());
    dom.thetaHit.dataset.dragKind = "theta";
    updateThetaHitPresentation();
    dom.thetaHit.style.visibility = "";
    dom.editHits.forEach(button => {
      const kind = button.dataset.editKind;
      const index = Number(button.dataset.editIndex);
      const items = state[{ direction: "directions", perpendicular: "perpendiculars", component: "components" }[kind]];
      const active = kind === "component"
        ? ((phase === "components" && items.length >= 1) || phase === "angle" || phase === "formulas")
        : phase === { direction: "directions", perpendicular: "perpendiculars" }[kind];
      setHitVisibility(button, active && Boolean(items[index]));
      button.dataset.dragKind = kind;
      if (items[index]) {
        setHitPosition(button, editPoint(kind, index));
        if (kind === "component") button.setAttribute("aria-label", `調整 ${componentDisplayLabel(items[index], index)} 箭頭`);
      }
    });
  }

  function thetaVisualPoint() {
    if (!state.theta) return state.thetaPoint || thetaSeatWorld();
    const placedCandidate = thetaCandidatesForInteraction().find((item) => item.key === state.theta);
    return placedCandidate?.labelCenter || placedCandidate?.center || thetaSeatWorld();
  }

  function thetaSeatWorld(scene = activeScene()) {
    const frame = sceneFrame(scene);
    return boundThetaPoint({ x: THETA_SEAT_SVG.x - frame.origin.x, y: frame.origin.y - THETA_SEAT_SVG.y });
  }

  function phasePrompt() {
    if (state.phase === "directions") return directionPhaseCopy();
    if (state.phase === "formulas" && formulaStepComplete()) return formulaCompletionCopy();
    if (state.phase !== "angle") return PHASE_COPY[state.phase];
    if (!thetaCandidatesForInteraction().length) return "目前方向線不足以標示 θ；可返回補畫方向線。";
    if (!M.isCorrectDecomposition(state)) return "圖形仍可修改；你可以先標示 θ，評分會按目前作答判斷。";
    return activeScene().thetaMode === "given"
      ? "題目已給定斜面傾角 θ；請在分解三角形中找出 G 與向內法線分量之間的等角，將 θ 標在該銳角。"
      : "把 θ 拖到分解三角形的任一合法銳角內，放手後留下字母和角弧；亦可再拖到另一個角。";
  }

  function questionPrompt(scene) {
    if (scene.id === "horizontal-vertical") return "畫出水平／垂直兩條方向虛線，再作垂線、分力、θ，最後判斷兩個分力使用 sin θ 還是 cos θ。";
    if (scene.id === "inclined-external-force") return "物體受斜向外力 F。沿平行及垂直斜面的方向作圖，θ 可由你選擇的銳角定義。";
    return "物體在斜面上受重力 G。請把 G 分解成平行斜面的分量 Gₓ，以及垂直斜面、向內法線方向的分量 Gᵧ；Gₓ、Gᵧ 不可對調。斜面傾角 θ 已給定，請在分解三角形中辨認 G 與向內法線之間的等角。";
  }

  function sceneKindLabel(scene) {
    return scene.id === "inclined-gravity" ? "斜面傾角 θ 已給定" : scene.plane ? "平行／垂直斜面分解" : "原力 F 固定";
  }

  function renderSceneHeader(scene, { review = false } = {}) {
    setMathText(dom.sceneTitle, scene.title);
    setMathText(dom.sceneKind, sceneKindLabel(scene));
    setMathText(dom.questionTitle, scene.title);
    dom.questionType.textContent = review
      ? `第 ${activity.currentQuestion + 1} 題／已提交作答`
      : `第 ${activity.currentQuestion + 1} 題／目前情境`;
    setMathText(dom.questionScenarioBadge, sceneKindLabel(scene));
    setMathText(dom.questionPrompt, questionPrompt(scene));
    if (review) {
      dom.questionCounter.textContent = "已提交／3 題";
      dom.attemptStatus.textContent = "只供查閱，作答已鎖定";
      dom.stageStepLabel.textContent = "唯讀";
      setMathText(dom.stepPrompt, "已提交作答；舞台只供查看，不能再修改圖形。");
      dom.phaseSteps.querySelectorAll("[data-phase]").forEach(item => { item.dataset.state = "review"; });
    }
  }

  function renderQuestionProgress(target = dom.questionProgress, review = false) {
    if (!target) return;
    target.replaceChildren();
    if (review && reviewResult?.trusted === false) return;
    SCENARIO_IDS.forEach((id, index) => {
      const scene = M.getScenario(id);
      const button = documentObject.createElement("button");
      button.type = "button";
      button.className = "question-tab";
      button.dataset.questionIndex = String(index);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(index === activity.currentQuestion));
      const title = documentObject.createElement("span");
      setMathText(title, `${index + 1}. ${scene.title}`);
      button.replaceChildren(title);
      if (review) {
        const detail = Scoring.questionDetail(activity.questions[index], index);
        button.appendChild(documentObject.createTextNode(`（${detail.score}/100）`));
        button.setAttribute("aria-label", `${index + 1}. ${scene.title}，${detail.score} 分`);
      } else {
        button.setAttribute("aria-label", `${index + 1}. ${scene.title}，提交後顯示評核`);
      }
      button.disabled = runtimeState !== "editable" && !review;
      target.appendChild(button);
    });
  }

  function renderThetaChoices() {
    const container = documentObject.getElementById("thetaChoiceButtons");
    if (!container) return;
    container.replaceChildren();
    thetaCandidatesForInteraction().forEach(candidate => {
      const button = documentObject.createElement("button");
      button.type = "button";
      button.dataset.thetaChoice = candidate.key;
      button.setAttribute("aria-pressed", String(state.theta === candidate.key));
      setMathText(button, candidate.description);
      container.appendChild(button);
    });
  }

  function missingQuestionItems(question) {
    const missing = [];
    const missingCount = (label, count) => {
      if (count < 2) missing.push(`${label}尚欠${2 - count}條`);
    };
    missingCount("方向線", question.directions.length);
    missingCount("垂線", question.perpendiculars.length);
    missingCount("分力", question.components.length);
    if (question.theta === null && question.thetaPoint === null) missing.push("θ");
    if (!question.formulas?.F1) missing.push("第 1 個分力公式");
    if (!question.formulas?.F2) missing.push("第 2 個分力公式");
    return missing;
  }

  function summarySaveStatus() {
    if (draftSaveState === "failed") return "最近一次保存失敗，請重試儲存";
    if (draftSaveState === "memory-only" && isStandaloneMode()) return "目前只保留本頁，待最終提交評核";
    if (draftSaveState === "saved" || draftSaveState === "memory-only") return "已保存，待最終提交評核";
    return "待保存，提交後評核";
  }

  function renderSaveBanner() {
    const visible = runtimeState === "editable" && draftSaveState === "failed";
    dom.saveBanner.classList.toggle("is-hidden", !visible);
    dom.saveBanner.dataset.kind = visible ? "technical" : "";
    dom.saveBannerText.textContent = visible
      ? (draftSaveError || "草稿未能保存；目前作答只保留在本頁，請重試儲存。")
      : "";
    dom.retrySave.disabled = !visible;
  }

  function draftStatusCopy() {
    if (isStandaloneMode() && standaloneStorageState !== "available") {
      return draftSaveState === "failed"
        ? "本機儲存失敗；目前只保留本頁資料，請勿重載。"
        : standaloneStorageState === "read-only" ? "本機儲存唯讀；新草稿只保留本頁，重載會回到上次成功保存。" : "本機儲存不可用；只保留本頁草稿，重載可能遺失。";
    }
    if (draftSaveState === "failed") return "草稿儲存失敗；請修復儲存後再繼續。";
    return activity.phase === "summary" ? "提交前檢查" : "草稿已保存";
  }

  function renderPracticeHeader() {
    const scene = activeScene();
    renderSceneHeader(scene);
    dom.questionCounter.textContent = `第 ${activity.currentQuestion + 1} / ${SCENARIO_IDS.length} 題`;
    dom.attemptStatus.textContent = draftStatusCopy();
    renderQuestionProgress();
    renderThetaChoices();
  }

  function renderSummary() {
    dom.summaryList.replaceChildren();
    const incomplete = [];
    activity.questions.forEach((question, index) => {
      const scene = M.getScenario(question.scenarioId) || M.getScenario();
      const missing = missingQuestionItems(question);
      if (missing.length) incomplete.push(`第${index + 1}題（${missing.join("、")}）`);
      const row = documentObject.createElement("div");
      row.className = "summary-item";
      const heading = documentObject.createElement("strong");
      setMathText(heading, `${index + 1}. ${scene.title}`);
      const status = documentObject.createElement("span");
      status.className = "summary-pending";
      status.textContent = `${missing.length ? `未完成：${missing.join("、")}；` : "作答項目已填妥；"}${summarySaveStatus()}`;
      const edit = documentObject.createElement("button");
      edit.type = "button";
      edit.dataset.editQuestion = String(index);
      edit.textContent = "返回修改";
      row.append(heading, status, edit);
      const feedback = documentObject.createElement("p");
      feedback.textContent = missing.length
        ? `目前只顯示作答完整度；${missing.join("、")}仍未完成。答案對錯會在三題最終提交後才顯示。`
        : "作答項目已填妥；答案對錯會在三題最終提交後才顯示。";
      row.appendChild(feedback);
      dom.summaryList.appendChild(row);
    });
    const incompleteCopy = incomplete.length ? `仍有未作答項目：${incomplete.join("；")}。最終提交時會先確認是否照常提交。` : "三題作答項目已填妥。";
    const saveCopy = draftSaveState === "failed" ? "最近一次保存失敗，請先重試儲存。" : "";
    dom.summaryWarning.textContent = `${incompleteCopy} ${saveCopy}三題提交後才會顯示總分、各題得分及錯誤部分；提交前可返回任何一題修改。`;
    dom.submitAttempt.disabled = runtimeState !== "editable" || Boolean(drag || keyboardDrag || formulaDrag);
  }

  function lockStageControls() {
    dom.stage.dataset.runtimeState = runtimeState;
    [dom.originHit, dom.pointHit, dom.thetaHit, ...dom.editHits].forEach(button => {
      if (!button) return;
      setHitVisibility(button, false);
      button.disabled = true;
    });
    [dom.stageBackButton, dom.stageNextButton, dom.backButton, dom.redrawButton, dom.nextButton, dom.resetButton, dom.goSummary, dom.submitAttempt, dom.returnToPractice].forEach(button => {
      if (button) button.disabled = true;
    });
    dom.thetaChoices.hidden = true;
    dom.thetaChoices.querySelectorAll("button").forEach(button => { button.disabled = true; });
    dom.formulaTokens.forEach(button => { button.disabled = true; });
    dom.formulaSlots.forEach(button => { button.disabled = true; });
    dom.formulaWorkbench.querySelectorAll("[data-formula-clear]").forEach(button => { button.disabled = true; });
  }

  function restorePanelScroll(scrollTop) {
    if (!Number.isFinite(scrollTop) || !dom.forcePanel) return;
    const restore = () => { dom.forcePanel.scrollTop = scrollTop; };
    restore();
    // Text and button dimensions can settle on the next layout frame after a
    // state render. Restore once more so a stage drag never changes the
    // independently scrolling controls panel as a side effect.
    windowObject.requestAnimationFrame?.(() => {
      restore();
      windowObject.requestAnimationFrame?.(restore);
    });
    windowObject.setTimeout?.(restore, 0);
    windowObject.setTimeout?.(restore, 50);
  }

  function clearInteractionTransient() {
    const activePointer = drag;
    const activeFormula = formulaDrag;
    drag = null;
    keyboardDrag = null;
    formulaDrag = null;
    selectedFormula = null;
    suppressFormulaClick = false;
    hostTouchScroll = null;
    pointerPanelScrollTop = null;
    hideTouchPreview();
    try { activePointer?.target?.releasePointerCapture(activePointer.pointerId); } catch (_) {}
    try { activeFormula?.button?.releasePointerCapture(activeFormula.id); } catch (_) {}
    if (dom.formulaGhost) {
      dom.formulaGhost.hidden = true;
      dom.formulaGhost.style.left = "";
      dom.formulaGhost.style.top = "";
    }
    dom.formulaSlots.forEach(button => { button.dataset.drop = "false"; });
  }

  function renderTechnical() {
    dom.practicePanel.classList.add("is-hidden");
    dom.summaryPanel.classList.add("is-hidden");
    dom.reviewPanel.classList.add("is-hidden");
    dom.technicalPanel.classList.remove("is-hidden");
    dom.technicalTitle.textContent = runtimeState === "frozen" ? "提交狀態未確認" : runtimeState === "quarantined" ? "提交資料已隔離" : "活動暫時鎖定";
    dom.technicalMessage.textContent = activityLoadError || "目前不能安全地繼續編輯或確認提交；請修復連線／資料後重試。";
    dom.technicalActions.replaceChildren();
    if (runtimeState !== "quarantined") {
      const retry = documentObject.createElement("button");
      retry.type = "button";
      retry.className = "primary-button";
      retry.textContent = runtimeState === "frozen" ? "重試同一提交" : "重新載入活動";
      retry.addEventListener("click", () => runtimeState === "frozen" ? retryFrozen() : windowObject.location.reload());
      dom.technicalActions.appendChild(retry);
      if (invalidDraftRecovery) {
        const reset = documentObject.createElement("button");
        reset.type = "button";
        reset.className = "danger-button";
        reset.dataset.action = "reset-invalid-draft";
        reset.textContent = isStandaloneMode() ? "清除損壞本機草稿並重新開始" : "覆寫損壞草稿並重新開始";
        reset.addEventListener("click", resetInvalidDraft);
        dom.technicalActions.appendChild(reset);
      }
    }
    dom.app.setAttribute("aria-busy", "false");
    lockStageControls();
  }

  function renderReview() {
    const selectedQuestion = activity.currentQuestion || 0;
    const trusted = reviewResult?.trusted !== false;
    dom.practicePanel.classList.add("is-hidden");
    dom.summaryPanel.classList.add("is-hidden");
    dom.technicalPanel.classList.add("is-hidden");
    dom.reviewPanel.classList.remove("is-hidden");
    dom.reviewScore.textContent = reviewResult?.result?.score == null ? "--" : `${reviewResult.result.score} / 100`;
    const localReview = Boolean(SimScorm?.isStandalone?.());
    const untrusted = reviewResult?.trusted === false;
    const missingRecordedScore = untrusted && reviewResult?.result?.score == null;
    dom.reviewCompletion.textContent = untrusted ? "只顯示已記錄摘要" : localReview ? "已完成（本機形成性回饋）" : "已提交（形成性回饋）";
    dom.reviewTitle.textContent = missingRecordedScore
      ? "已提交作答（LMS 分數未提供）"
      : untrusted ? "已提交作答（摘要可信，細節未能驗證）" : "已提交作答結果";
    dom.reviewTrustNote.textContent = missingRecordedScore
      ? "LMS 沒有提供可用的已記錄分數；為安全起見保持唯讀，顯示 --，不能以保存快照推算分數。"
      : untrusted ? "已記錄摘要與活動答案不一致；為安全起見，只顯示已記錄的分數／狀態，不恢復可編輯作答。" : "本次作答已完成並鎖定；可切換題目查閱答案，不能返回修改或清除紀錄重新作答。";
    dom.reviewQuestionNavigation.hidden = !trusted;
    dom.reviewFeedback.hidden = !trusted;
    if (untrusted) {
      activity = { ...Persistence.freshDraft(), phase: "summary", currentQuestion: 0 };
      state = activity.questions[0];
      renderSceneHeader(activeScene(), { review: true });
      dom.reviewQuestionNavigation.replaceChildren();
      dom.reviewFeedback.replaceChildren();
      renderReviewFormulaSummary(null, null);
      drawScene();
    } else if (reviewSnapshot?.answer?.questions) {
      const saved = { ...Persistence.freshDraft(), phase: "summary", questions: reviewSnapshot.answer.questions.map(question => M.clone(question)) };
      saved.currentQuestion = Math.min(selectedQuestion, SCENARIO_IDS.length - 1);
      activity = saved;
      state = activity.questions[activity.currentQuestion];
      renderSceneHeader(activeScene(), { review: true });
      renderQuestionProgress(dom.reviewQuestionNavigation, true);
      renderReviewFormulaSummary(untrusted ? null : reviewResult?.result?.detail?.[selectedQuestion], state);
      dom.reviewFeedback.replaceChildren();
      (reviewResult?.result?.feedbackItems || []).forEach(text => {
        const p = documentObject.createElement("p");
        setMathText(p, text);
        dom.reviewFeedback.appendChild(p);
      });
      drawScene();
    } else {
      renderSceneHeader(activeScene(), { review: true });
      dom.reviewQuestionNavigation.replaceChildren();
      renderReviewFormulaSummary(null, null);
      dom.reviewFeedback.textContent = "目前只有 Moodle 摘要可供查閱。";
    }
    dom.reviewActions.replaceChildren();
    if (finishRetryAvailable) {
      const retry = documentObject.createElement("button");
      retry.type = "button";
      retry.textContent = "重試完成 LMS 工作階段";
      retry.addEventListener("click", retryFinishOnly);
      dom.reviewActions.appendChild(retry);
    }
    dom.app.setAttribute("aria-busy", "false");
    lockStageControls();
  }

  function renderReviewFormulaSummary(questionDetail, question) {
    if (!dom.reviewFormulaSummary || !dom.reviewFormulaRows) return;
    const trustedQuestion = Boolean(questionDetail && question && reviewResult?.trusted === true);
    dom.reviewFormulaSummary.hidden = !trustedQuestion;
    dom.reviewFormulaRows.replaceChildren();
    if (!trustedQuestion) return;
    const scene = M.getScenario(question.scenarioId) || activeScene();
    const formulaGroup = questionDetail.groups?.find(group => group.key === "formulas");
    const items = formulaGroup?.items || [];
    ["F1", "F2"].forEach((key, index) => {
      const item = items.find(entry => entry.key === `formula-${key}`);
      const actual = question.formulas?.[key] || null;
      const result = !actual ? "missing" : item?.assessable === false ? "unavailable" : item?.correct ? "correct" : "incorrect";
      const row = documentObject.createElement("div");
      row.className = "review-formula-row";
      row.dataset.formulaReviewKey = key;
      row.dataset.result = result;
      const expression = documentObject.createElement("span");
      expression.className = "review-formula-expression";
      const label = item?.label?.replace(/ 的分力表達式$/, "") || `${scene.forceSymbol}${index + 1}`;
      setMathText(expression, `${label} = ${scene.forceSymbol} × ${actual ? `${actual} θ` : "未作答"}`);
      const status = documentObject.createElement("span");
      status.className = "review-formula-status";
      status.textContent = result === "correct" ? "正確" : result === "incorrect" ? "錯誤" : result === "unavailable" ? "未能判斷" : "未作答";
      status.setAttribute("aria-label", `${label}：${status.textContent}`);
      row.append(expression, status);
      if (item?.detail) {
        const detail = documentObject.createElement("p");
        detail.className = "review-formula-detail";
        setMathText(detail, item.detail);
        row.appendChild(detail);
      }
      dom.reviewFormulaRows.appendChild(row);
    });
  }

  function renderControls() {
    renderPracticeHeader();
    const phaseIndex = M.PHASES.indexOf(state.phase);
    const practiceEditable = isPracticeEditable();
    Array.from(dom.phaseSteps.querySelectorAll("[data-phase]")).forEach((item) => {
      const index = M.PHASES.indexOf(item.dataset.phase);
      item.dataset.state = index === phaseIndex ? "current" : index < phaseIndex ? "done" : "";
    });
    setMathText(dom.stepPrompt, phasePrompt());
    setMathText(dom.interactionStatus, message);
    dom.interactionStatus.dataset.kind = messageKind;
    dom.directionCount.textContent = `方向虛線 ${state.directions.length} / 2`;
    dom.perpendicularCount.textContent = `垂線 ${state.perpendiculars.length} / 2`;
    dom.componentCount.textContent = `分力 ${state.components.length} / 2`;
    dom.backButton.disabled = !practiceEditable || phaseIndex <= 0 || Boolean(drag || keyboardDrag || formulaDrag);
    dom.redrawButton.disabled = !practiceEditable || Boolean(drag || keyboardDrag || formulaDrag);
    dom.resetButton.disabled = !practiceEditable || Boolean(drag || keyboardDrag || formulaDrag);
    const formulaDone = state.phase === "formulas" && formulaStepComplete();
    const canAdvance = M.canAdvance(state) || formulaDone;
    dom.nextButton.disabled = !practiceEditable || !canAdvance || Boolean(drag || keyboardDrag || formulaDrag);
    setMathText(dom.nextButton, state.phase === "components" ? "進入 θ 標示" : state.phase === "angle" ? "表示分力大小" : state.phase === "formulas" ? (formulaDone ? formulaNextLabel() : "完成分力表達式") : "進入下一步");
    dom.redrawButton.textContent = state.phase === "formulas" ? "清空兩個公式" : "重畫目前步驟";
    dom.stageBackButton.disabled = dom.backButton.disabled;
    dom.stageNextButton.disabled = dom.nextButton.disabled;
    const stageNextLabel = state.phase === "formulas" ? (formulaDone ? formulaNextLabel() : "完成分力表達式") : "下一步";
    dom.stageNextButton.setAttribute("aria-label", stageNextLabel);
    dom.stageNextButton.title = stageNextLabel;
    dom.stageStepLabel.textContent = `${phaseIndex + 1} / ${M.PHASES.length}`;
    dom.thetaChoices.hidden = state.phase !== "angle" || !thetaCandidatesForInteraction().length;
    dom.thetaChoices.querySelectorAll("[data-theta-choice]").forEach(button => {
      button.disabled = !practiceEditable || Boolean(drag || keyboardDrag);
      button.setAttribute("aria-pressed", String(state.theta === button.dataset.thetaChoice));
    });
    dom.goSummary.disabled = !practiceEditable || Boolean(drag || keyboardDrag || formulaDrag);
    renderFormulas();
  }

  function renderAll(preservedPanelScrollTop = null) {
    const panelScrollTop = Number.isFinite(preservedPanelScrollTop) ? preservedPanelScrollTop : dom.forcePanel?.scrollTop;
    if (!isPracticeEditable()) clearInteractionTransient();
    renderSaveBanner();
    if (runtimeState === "review") {
      renderReview();
      restorePanelScroll(panelScrollTop);
      return;
    }
    if (runtimeState !== "editable") {
      renderTechnical();
      restorePanelScroll(panelScrollTop);
      return;
    }
    if (state.phase !== "formulas" || !M.formulaExpectations(state)) selectedFormula = null;
    dom.practicePanel.classList.toggle("is-hidden", activity.phase !== "practice");
    dom.summaryPanel.classList.toggle("is-hidden", activity.phase !== "summary");
    dom.technicalPanel.classList.add("is-hidden");
    dom.reviewPanel.classList.add("is-hidden");
    renderControls();
    if (activity.phase === "summary") renderSummary();
    drawScene();
    updateHitTargets();
    restorePanelScroll(panelScrollTop);
    dom.app.setAttribute("aria-busy", "false");
  }

  function renderFormulas() {
    dom.formulaWorkbench.hidden = state.phase !== "formulas";
    const expectations = M.formulaExpectations(state) || [];
    const available = expectations.length > 0;
    const formulaLabel = (key) => {
      const index = key === "F1" ? 0 : 1;
      const expected = expectations.find(item => item.key === key);
      const axis = activeScene().id === "inclined-gravity"
        ? (key === "F1" ? "parallel" : "normal")
        : expected?.axis;
      return M.componentSymbol(activeScene(), axis, index);
    };
    dom.formulaWorkbench.querySelectorAll("[data-formula-label]").forEach(node => {
      setMathText(node, formulaLabel(node.dataset.formulaLabel));
    });
    dom.formulaWorkbench.querySelectorAll("[data-formula-force-label]").forEach(node => {
      setMathText(node, activeScene().forceSymbol);
    });
    const angle = thetaCandidatesForInteraction().find(item => item.key === state.theta);
    setMathText(documentObject.getElementById("formulaAngleDescription"), angle ? `目前 θ：${angle.description}。` : "");
    const busy = Boolean(drag || keyboardDrag || formulaDrag);
    const editable = isPracticeEditable();
    dom.formulaTokens.forEach(button => {
      // A captured source stays enabled and mounted throughout the drag.
      button.disabled = !available || !editable || Boolean(drag || keyboardDrag);
      button.setAttribute("aria-pressed", String(selectedFormula === button.dataset.formulaToken));
    });
    dom.formulaSlots.forEach(button => {
      const key = button.dataset.formulaSlot;
      const token = state.formulas?.[key];
      const label = formulaLabel(key);
      setMathText(button, token ? `${token} θ` : "？");
      button.setAttribute("aria-label", `${label} 的函數：${token ? token + " θ" : "未填"}。先選卡片，再點此處放置。`);
      button.disabled = !available || !editable || Boolean(drag || keyboardDrag);
    });
    dom.formulaWorkbench.querySelectorAll("[data-formula-clear]").forEach(button => {
      const label = formulaLabel(button.dataset.formulaClear);
      button.setAttribute("aria-label", `清空 ${label} 公式`);
      button.disabled = !available || !editable || busy || !state.formulas?.[button.dataset.formulaClear];
    });
  }

  function placeFormula(key, token) {
    if (!isPracticeEditable()) return;
    syncCurrentQuestion(M.setFormula(state, key, token));
    persistDraft();
    selectedFormula = null;
    const complete = formulaStepComplete();
    setMessage(complete ? formulaCompletionCopy() : "", complete ? "success" : "");
    renderAll();
  }

  function formulaDropAt(x, y) {
    let closest = null;
    let minimum = Infinity;
    for (const button of dom.formulaSlots) {
      const box = button.getBoundingClientRect();
      const distance = Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));
      if (distance <= 14 && distance < minimum) { closest = button; minimum = distance; }
    }
    return closest;
  }

  function moveFormula(event) {
    if (!formulaDrag || formulaDrag.id !== event.pointerId) return;
    event.preventDefault();
    formulaDrag.moved ||= Math.hypot(event.clientX - formulaDrag.x, event.clientY - formulaDrag.y) > 6;
    dom.formulaGhost.hidden = !formulaDrag.moved;
    const visualScale = dom.formulaGhost.offsetWidth ? dom.formulaGhost.getBoundingClientRect().width / dom.formulaGhost.offsetWidth : 1;
    dom.formulaGhost.style.left = `${event.clientX / visualScale}px`;
    dom.formulaGhost.style.top = `${event.clientY / visualScale}px`;
    const target = formulaDropAt(event.clientX, event.clientY);
    dom.formulaSlots.forEach(button => { button.dataset.drop = String(formulaDrag.moved && button === target); });
  }

  function endFormulaDrag(event, cancelled = false) {
    if (!formulaDrag || (event && formulaDrag.id !== event.pointerId)) return;
    const active = formulaDrag;
    formulaDrag = null;
    suppressFormulaClick = active.moved || cancelled;
    dom.formulaGhost.hidden = true;
    dom.formulaSlots.forEach(button => { button.dataset.drop = "false"; });
    try { active.button.releasePointerCapture(active.id); } catch (_) {}
    const target = !cancelled && active.moved && event ? formulaDropAt(event.clientX, event.clientY) : null;
    if (target) placeFormula(target.dataset.formulaSlot, active.token);
    else renderControls();
  }

  function setMessage(text, kind = "") {
    message = text;
    messageKind = kind;
    setMathText(dom.interactionStatus, message);
    dom.interactionStatus.dataset.kind = messageKind;
    dom.liveRegion.textContent = message;
  }

  function beginPreview(kind, point, pointerType, previousTargetKey = null, editIndex = null) {
    const transform = diagramTransform();
    const anchor = kind === "perpendicular" ? sceneForceHead() : kind === "component" || kind === "direction" ? sceneOrigin() : null;
    const options = {
      pointerType,
      threshold: worldThreshold(pointerType),
      minDistance: M.MIN_DRAW_DISTANCE / Math.max(transform.scale, .01),
      bounds: editingBounds(anchor),
      previousTargetKey
    };
    if (editIndex != null) return M.editGeometry(state, kind, editIndex, point, { ...options, scene: activeScene() });
    if (kind === "direction") return M.makeDirection(point, state.directions.length, { ...options, scene: activeScene() });
    if (kind === "perpendicular") return M.perpendicularPreview(point, state.directions, {
      ...options,
      scene: activeScene(),
      excludedTargetKeys: state.perpendiculars.map((item) => item.targetKey).filter(Boolean)
    });
    if (kind === "component") return M.previewComponent(point, state.perpendiculars, state.directions, {
      ...options,
      scene: activeScene(),
      excludedTargetKeys: state.components.map((item) => item.targetKey).filter(Boolean)
    });
    if (kind === "theta") return M.thetaCandidateAt(point, state.directions, {
      ...options,
      ...thetaInteractionOptions(),
      threshold: M.THETA_SNAP_RADIUS / Math.max(transform.scale, .01)
    });
    return null;
  }

  function nearestHitTarget(event) {
    let nearest = event.currentTarget;
    let distance = Infinity;
    for (const button of [event.currentTarget, dom.originHit, dom.pointHit, dom.thetaHit, ...dom.editHits]) {
      if (button.hidden || button.disabled || !button.dataset.dragKind) continue;
      const rect = button.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
      const candidateDistance = Math.hypot(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
      if (candidateDistance < distance) { nearest = button; distance = candidateDistance; }
    }
    return nearest;
  }

  function startPointerDrag(event) {
    if (!isPracticeEditable()) return;
    const target = event.currentTarget;
    // Enlarged touch regions can overlap on a compact canvas. Resolve intent
    // by the closest anchor, but keep capture on the original, stable element.
    const hit = nearestHitTarget(event);
    const kind = hit.dataset.dragKind;
    if (!kind || target.hidden || event.button > 0 || drag || keyboardDrag || formulaDrag) return;
    event.preventDefault();
    const pointer = clientToWorld(event.clientX, event.clientY);
    const editIndex = hit.dataset.editIndex == null ? null : Number(hit.dataset.editIndex);
    const point = editIndex != null ? editPoint(kind, editIndex) : kind === "theta" ? thetaVisualPoint() : pointer;
    drag = {
      kind,
      editIndex,
      target,
      pointerId: event.pointerId,
      pointerType: event.pointerType || "mouse",
      clientX: event.clientX,
      clientY: event.clientY,
      point,
      startPoint: point,
      offset: M.subtract(pointer, point),
      maxDistance: 0,
      minimumMovement: M.MIN_DRAW_DISTANCE / Math.max(diagramTransform().scale, .01),
      panelScrollTop: Number.isFinite(pointerPanelScrollTop) ? pointerPanelScrollTop : dom.forcePanel?.scrollTop,
      preview: beginPreview(kind, point, event.pointerType || "mouse", null, editIndex)
    };
    try { target.setPointerCapture(event.pointerId); } catch (_) {}
    renderControls();
    restorePanelScroll(drag.panelScrollTop);
    drawScene();
  }

  function updatePointerDrag(event) {
    if (!isPracticeEditable() || !drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const rawPoint = M.subtract(clientToWorld(event.clientX, event.clientY), drag.offset);
    const point = drag.kind === "theta" ? boundThetaPoint(rawPoint) : rawPoint;
    drag.maxDistance = Math.max(drag.maxDistance, M.distance(drag.startPoint, point));
    const previousTargetKey = drag.preview?.targetKey || drag.preview?.key || null;
    drag.point = point;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    drag.preview = beginPreview(drag.kind, point, drag.pointerType, previousTargetKey, drag.editIndex);
    drawScene();
  }

  function finishPointerDrag(event) {
    if (!isPracticeEditable() || !drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const rawPoint = M.subtract(clientToWorld(event.clientX, event.clientY), drag.offset);
    const point = drag.kind === "theta" ? boundThetaPoint(rawPoint) : rawPoint;
    drag.maxDistance = Math.max(drag.maxDistance, M.distance(drag.startPoint, point));
    const previousTargetKey = drag.preview?.targetKey || drag.preview?.key || null;
    drag.point = point;
    drag.preview = beginPreview(drag.kind, point, drag.pointerType, previousTargetKey, drag.editIndex);
    const active = drag;
    drag = null;
    commitDraft(active);
    try { active.target.releasePointerCapture(event.pointerId); } catch (_) {}
  }

  function cancelPointerDrag(event, reason = "作圖操作已取消。") {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const active = drag;
    drag = null;
    try { active.target.releasePointerCapture(active.pointerId); } catch (_) {}
    setMessage(reason);
    renderAll(active.panelScrollTop);
  }

  function commitDraft(draft) {
    if (!isPracticeEditable() || !draft) return;
    if (draft.pointerType !== "keyboard" && draft.maxDistance < draft.minimumMovement) {
      setMessage("拖動距離太短，沒有建立作圖。", "warning");
      renderAll(draft.panelScrollTop);
      return;
    }
    if (draft.pointerType === "keyboard" && draft.kind !== "theta" && !draft.moved) {
      setMessage("請先用方向鍵移動，再按 Enter 確認作圖。", "warning");
      renderAll(draft.panelScrollTop);
      return;
    }
    if (draft.editIndex != null) {
      if (draft.preview?.editedState) {
        syncCurrentQuestion(draft.preview.editedState);
        setMessage("已調整這條線；其他作圖保持原位。", "success");
        if (!persistDraft()) setMessage("已套用調整，但最新修改未能保存；請按「重試儲存」。", "warning");
      } else setMessage(draft.preview?.reason === "duplicate" ? "兩條方向線不能重疊，這次調整未套用。" : "線段太短，這次調整未套用。", "warning");
      renderAll(draft.panelScrollTop);
      return;
    }
    if (draft.kind === "direction") {
      const result = M.commitDirection(draft.point, state.directions, {
        minDistance: M.MIN_DRAW_DISTANCE / Math.max(diagramTransform().scale, .01),
        scene: activeScene()
      });
      if (!result.accepted) {
        setMessage(result.reason === "duplicate" ? "這條方向線與已有方向線重複，請畫另一個方向。" : "拖動距離太短，沒有建立方向線。", "warning");
      } else {
        syncCurrentQuestion({ ...state, directions: result.directions });
        const axisKey = result.direction.axisKey ?? result.direction.axis;
        const axisLabel = directionAxisLabel(activeScene(), axisKey);
        setMessage(`已保留第 ${state.directions.length} 條方向虛線${axisLabel ? `（${axisLabel}吸附）` : ""}。`, "success");
      }
    } else if (draft.kind === "perpendicular") {
      const result = M.commitPerpendicular(draft.point, state.directions, state.perpendiculars, {
        scene: activeScene(),
        bounds: editingBounds(sceneForceHead()),
        pointerType: draft.pointerType,
        threshold: worldThreshold(draft.pointerType),
        minDistance: M.MIN_DRAW_DISTANCE / Math.max(diagramTransform().scale, .01),
        previousTargetKey: draft.preview?.targetKey || null
      });
      if (!result.accepted) setMessage("拖動距離太短，沒有建立垂線。", "warning");
      else {
        syncCurrentQuestion({ ...state, perpendiculars: result.perpendiculars });
        setMessage(result.item.targetKey ? "垂線已吸附到垂足；只有真正抵達垂足才顯示直角記號。" : "已保留這條垂線的實際終點。", result.item.targetKey ? "success" : "");
      }
    } else if (draft.kind === "component") {
      const result = M.commitComponent(draft.point, state.perpendiculars, state.directions, state.components, {
        scene: activeScene(),
        bounds: editingBounds(sceneOrigin()),
        pointerType: draft.pointerType,
        threshold: worldThreshold(draft.pointerType),
        minDistance: M.MIN_DRAW_DISTANCE / Math.max(diagramTransform().scale, .01),
        previousTargetKey: draft.preview?.targetKey || null
      });
      if (!result.accepted) setMessage("沒有可用的分力端點；請先建立垂線。", "warning");
      else {
        syncCurrentQuestion({ ...state, components: result.components });
        setMessage(result.item.targetKey ? `第 ${state.components.length} 支分力已吸附到可見交點。` : `已保留第 ${state.components.length} 支分力的實際端點。`, result.item.targetKey ? "success" : "");
      }
    } else if (draft.kind === "theta") {
      const candidate = draft.preview;
      if (!candidate) {
        syncCurrentQuestion({ ...state, theta: null, thetaPoint: boundThetaPoint(draft.point || thetaVisualPoint()) });
        setMessage("θ 已保留在你放手的位置；靠近角弧時會自動吸附。", "");
      } else {
        syncCurrentQuestion({ ...state, theta: candidate.key, thetaPoint: null });
        setMessage(`θ 已放在 ${candidate.description}。可繼續拖動更換位置。`, "success");
      }
    }
    persistDraft();
    renderAll(draft.panelScrollTop);
  }

  function initialKeyboardPoint(kind) {
    if (kind === "direction" || kind === "component") return sceneOrigin();
    if (kind === "perpendicular") return sceneForceHead();
    return thetaVisualPoint();
  }

  function startKeyboardDrag(button) {
    if (!isPracticeEditable() || keyboardDrag || drag || formulaDrag || !button || button.hidden) return;
    const kind = button.dataset.dragKind;
    if (!kind) return;
    const editIndex = button.dataset.editIndex == null ? null : Number(button.dataset.editIndex);
    const point = editIndex != null ? editPoint(kind, editIndex) : initialKeyboardPoint(kind);
    keyboardDrag = { kind, editIndex, target: button, pointerType: "keyboard", point, startPoint: point, moved: false, thetaIndex: 0, panelScrollTop: dom.forcePanel?.scrollTop, preview: beginPreview(kind, point, "keyboard", null, editIndex) };
    if (kind === "theta" && state.theta) {
      const candidates = thetaCandidatesForInteraction();
      keyboardDrag.thetaIndex = Math.max(0, candidates.findIndex((candidate) => candidate.key === state.theta));
      keyboardDrag.point = candidates[keyboardDrag.thetaIndex]?.labelCenter || candidates[keyboardDrag.thetaIndex]?.center || point;
      keyboardDrag.preview = beginPreview(kind, keyboardDrag.point, "keyboard");
    }
    setMessage("正在調整控制點。", "success");
    renderControls();
    restorePanelScroll(keyboardDrag.panelScrollTop);
    drawScene();
  }

  function updateKeyboardDrag(key) {
    if (!isPracticeEditable() || !keyboardDrag) return false;
    if (keyboardDrag.kind === "theta" && (key === "ArrowLeft" || key === "ArrowRight")) {
      const candidates = thetaCandidatesForInteraction();
      if (!candidates.length) return true;
      keyboardDrag.thetaIndex = (keyboardDrag.thetaIndex + (key === "ArrowRight" ? 1 : -1) + candidates.length) % candidates.length;
      keyboardDrag.point = candidates[keyboardDrag.thetaIndex].center;
    } else {
      const delta = key === "ArrowRight" ? { x: POINTER_STEP, y: 0 }
        : key === "ArrowLeft" ? { x: -POINTER_STEP, y: 0 }
          : key === "ArrowUp" ? { x: 0, y: POINTER_STEP }
            : key === "ArrowDown" ? { x: 0, y: -POINTER_STEP }
              : null;
      if (!delta) return false;
      keyboardDrag.point = M.add(keyboardDrag.point, delta);
      if (keyboardDrag.kind === "perpendicular" || keyboardDrag.kind === "component") {
        const anchor = keyboardDrag.kind === "perpendicular" ? sceneForceHead() : sceneOrigin();
        keyboardDrag.point = M.boundedEndpoint(anchor, keyboardDrag.point, editingBounds(anchor));
      }
      if (keyboardDrag.kind === "theta") keyboardDrag.point = boundThetaPoint(keyboardDrag.point);
      keyboardDrag.moved = true;
    }
    keyboardDrag.preview = beginPreview(keyboardDrag.kind, keyboardDrag.point, "keyboard", keyboardDrag.preview?.targetKey || keyboardDrag.preview?.key || null, keyboardDrag.editIndex);
    drawScene();
    return true;
  }

  function finishKeyboardDrag() {
    if (!keyboardDrag) return;
    const active = keyboardDrag;
    keyboardDrag = null;
    commitDraft(active);
  }

  function cancelKeyboardDrag() {
    if (!keyboardDrag) return;
    const active = keyboardDrag;
    keyboardDrag = null;
    setMessage("已取消調整。", "");
    renderAll(active.panelScrollTop);
  }

  function onHitKeyDown(event) {
    if (!isPracticeEditable()) return;
    const button = event.currentTarget;
    if (event.key === "Enter") {
      event.preventDefault();
      if (keyboardDrag) finishKeyboardDrag();
      else startKeyboardDrag(button);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (keyboardDrag) cancelKeyboardDrag();
      return;
    }
    if (updateKeyboardDrag(event.key)) event.preventDefault();
  }

  function recordPointer(event) {
    const stageTarget = event.target?.closest?.(".stage-hit, .theta-hit");
    if (isPracticeEditable() && stageTarget && Number.isFinite(pointerPanelScrollTop)) {
      // A touch can move an independently scrolling panel just before the
      // corresponding pointer event is delivered. Keep the panel at the
      // position that was visible when this stage drag began.
      dom.forcePanel.scrollTop = pointerPanelScrollTop;
    }
    if (isPracticeEditable() && stageTarget && (event.type === "pointerdown" || event.type === "pointermove")) {
      // Prevent the browser from handing a stage drag to the scroll owner.
      // This capture-phase guard runs before the target handler and covers
      // touch hardware that begins native panning before pointer capture.
      event.preventDefault();
    }
    if (event.type === "pointerdown" && isPracticeEditable() && stageTarget && !Number.isFinite(pointerPanelScrollTop)) {
      // Capture before the target handler and before the browser can apply
      // any native touch scrolling. The completed drag must restore this
      // exact panel position.
      pointerPanelScrollTop = dom.forcePanel?.scrollTop;
    }
    pointerTelemetry.push({
      sequence: (pointerTelemetry[pointerTelemetry.length - 1]?.sequence || 0) + 1,
      type: event.type,
      pointerType: event.pointerType || "",
      isTrusted: Boolean(event.isTrusted),
      clientX: event.clientX,
      clientY: event.clientY,
      panelScrollTop: dom.forcePanel?.scrollTop,
      target: event.target?.id || event.target?.className?.baseVal || event.target?.tagName || ""
    });
    if (pointerTelemetry.length > 300) pointerTelemetry.shift();
    if (event.type === "pointerup" || event.type === "pointercancel") pointerPanelScrollTop = null;
  }

  function captureStageTouch(event) {
    if (!isPracticeEditable() || event.touches?.length !== 1) return;
    const touch = event.touches[0];
    // Only drawing hit targets own the touch gesture.  Navigation buttons use
    // the browser's normal touch-to-click path; intercepting their touchstart
    // suppresses the click in Chromium touch contexts.
    const eventTarget = event.target?.closest?.(".stage-hit, .theta-hit");
    const pointTarget = documentObject.elementFromPoint(touch.clientX, touch.clientY);
    const owner = eventTarget || pointTarget?.closest?.(".stage-hit, .theta-hit");
    if (!owner || !dom.stage?.contains(owner)) {
      pointerPanelScrollTop = null;
      return;
    }
    pointerPanelScrollTop = dom.forcePanel?.scrollTop;
    event.preventDefault();
  }

  function captureTouchPointer(event) {
    if (!isPracticeEditable() || event.pointerType !== "touch" || Number.isFinite(pointerPanelScrollTop)) return;
    pointerPanelScrollTop = dom.forcePanel?.scrollTop;
  }

  // A bounded SCO document cannot own the host page's scroll range. For a
  // vertical gesture that starts on non-interactive stage content, forward
  // only that same gesture to the enclosing host. Stable drag hit targets
  // opt out before pointerdown, and the controls panel never reaches this
  // stage listener.
  function stageTouchOwner(target) {
    return target?.closest?.(".stage-hit, .theta-hit, .stage-navigation") || null;
  }

  function startStageHostTouch(event) {
    if (event.touches.length !== 1 || stageTouchOwner(event.target)) return;
    const touch = event.touches[0];
    hostTouchScroll = { identifier: touch.identifier, lastY: touch.clientY };
  }

  function moveStageHostTouch(event) {
    if (!hostTouchScroll) return;
    const touch = Array.from(event.touches).find(item => item.identifier === hostTouchScroll.identifier);
    if (!touch) return;
    const delta = hostTouchScroll.lastY - touch.clientY;
    hostTouchScroll.lastY = touch.clientY;
    if (delta && windowObject.parent && windowObject.parent !== windowObject) {
      try { windowObject.parent.scrollBy(0, delta); } catch (_) { /* cross-origin host may deny inspection, not ownership */ }
      event.preventDefault();
    }
  }

  function endStageHostTouch(event) {
    if (!hostTouchScroll) return;
    if (!event.touches.length || !Array.from(event.touches).some(item => item.identifier === hostTouchScroll.identifier)) hostTouchScroll = null;
  }

  function attachHit(button) {
    button.addEventListener("pointerdown", startPointerDrag);
    button.addEventListener("pointermove", updatePointerDrag);
    button.addEventListener("pointerup", finishPointerDrag);
    button.addEventListener("pointercancel", (event) => cancelPointerDrag(event, "觸控被瀏覽器取消，這次作圖沒有建立。"));
    button.addEventListener("lostpointercapture", (event) => {
      if (drag && event.pointerId === drag.pointerId) cancelPointerDrag(event, "作圖操作失去控制，這次作圖沒有建立。");
    });
    button.addEventListener("keydown", onHitKeyDown);
  }

  function handleBack() {
    if (!isPracticeEditable() || drag || keyboardDrag || formulaDrag) return;
    const previous = state.phase;
    syncCurrentQuestion(M.backToPrevious(state));
    if (previous !== state.phase) setMessage("已返回上一步，全部作圖保留；可直接拖動箭頭或虛線上的操作點調整。", "");
    persistDraft();
    renderAll();
  }

  function handleRedraw() {
    if (!isPracticeEditable() || drag || keyboardDrag || formulaDrag) return;
    syncCurrentQuestion(M.resetCurrentPhase(state));
    setMessage("目前步驟已清空，可以重新作圖。", "");
    persistDraft();
    renderAll();
  }

  function handleReset() {
    if (!isPracticeEditable() || drag || keyboardDrag || formulaDrag) return;
    syncCurrentQuestion(M.createQuestionState(state.scenarioId));
    setMessage("本圖已重設，請由 O 畫第一條方向虛線。", "");
    persistDraft();
    renderAll();
  }

  function handleNext() {
    if (!isPracticeEditable() || drag || keyboardDrag || formulaDrag) return;
    if (state.phase === "formulas") {
      if (!formulaStepComplete()) return;
      if (activity.currentQuestion >= SCENARIO_IDS.length - 1) {
        setMessage(formulaCompletionCopy(), "success");
        openSummary();
      } else {
        const nextIndex = activity.currentQuestion + 1;
        switchQuestion(nextIndex, false, `第 5 步「分力表達式」已完成，現在進入第 ${nextIndex + 1} 題。`);
      }
      return;
    }
    if (!M.canAdvance(state)) return;
    syncCurrentQuestion(M.advance(state));
    setMessage(state.phase === "angle" && !M.isCorrectDecomposition(state)
      ? "作圖仍可修改；你可以先標示 θ，評分會按目前作答判斷。"
      : `已進入第 ${M.PHASES.indexOf(state.phase) + 1} 步。`, "");
    persistDraft();
    renderAll();
  }

  function persistDraft() {
    if (runtimeState !== "editable" || !SimScorm?.saveDraft) return true;
    try {
      const saved = SimScorm.saveDraft(Persistence.makeSnapshot("draft", snapshotActivity()));
      standaloneStorageState = SimScorm.getStandaloneStorageStatus?.() || standaloneStorageState;
      // In an LMS frame, the LMS commit is the authoritative durable write even
      // when the browser denies localStorage. Only standalone mode can fall
      // back to the local-storage/memory-only distinction.
      draftSaveState = saved ? (isStandaloneMode() && standaloneStorageState !== "available" ? "memory-only" : "saved") : "failed";
      draftSaveError = saved ? "" : "草稿未能保存；目前作答只保留在本頁，請按「重試儲存」。";
      return saved;
    } catch (error) {
      draftSaveError = `草稿未能保存：${error.message}`;
      draftSaveState = "failed";
      standaloneStorageState = SimScorm.getStandaloneStorageStatus?.() || standaloneStorageState;
      return false;
    }
  }

  function switchQuestion(index, fromSummary = false, transitionMessage = "") {
    if (runtimeState !== "editable" || !Number.isInteger(index) || index < 0 || index >= SCENARIO_IDS.length) return;
    activity.currentQuestion = index;
    activity.phase = "practice";
    activity.fromReview = Boolean(fromSummary);
    state = activity.questions[index];
    drag = null;
    keyboardDrag = null;
    formulaDrag = null;
    selectedFormula = null;
    message = transitionMessage || `目前是第 ${index + 1} 題：${M.getScenario(state.scenarioId).title}。`;
    messageKind = "";
    persistDraft();
    renderAll();
  }

  function openSummary() {
    if (!isPracticeEditable() || drag || keyboardDrag || formulaDrag) return;
    activity.phase = "summary";
    activity.fromReview = false;
    persistDraft();
    renderAll();
    dom.summaryPanel.querySelector("h2")?.focus();
  }

  function routeQuestionClick(event) {
    const button = event.target.closest("[data-question-index]");
    if (!button) return;
    const index = Number(button.dataset.questionIndex);
    if (runtimeState === "editable") switchQuestion(index, activity.phase === "summary");
    else if (runtimeState === "review" && reviewResult?.trusted !== false && reviewSnapshot?.answer?.questions) {
      activity.currentQuestion = index;
      state = activity.questions[index];
      renderReview();
    }
  }

  function routeSummaryEdit(event) {
    const button = event.target.closest("[data-edit-question]");
    if (button) switchQuestion(Number(button.dataset.editQuestion), true);
  }

  function buildComputedReview(snapshot) {
    const draftLike = { ...Persistence.freshDraft(), phase: "summary", questions: snapshot.answer.questions };
    return Scoring.score(draftLike);
  }

  function enterReview(snapshot, outcome = {}) {
    reviewSnapshot = snapshot;
    const computed = buildComputedReview(snapshot);
    const hasOutcomeScore = Object.prototype.hasOwnProperty.call(outcome, "score");
    const hasOutcomeStatus = Object.prototype.hasOwnProperty.call(outcome, "status");
    const attempt = {
      // A finished LMS attempt must be judged against the value LMS exposed,
      // even when that value is blank/invalid. Only locally generated or
      // callback outcomes may use the validated snapshot as their source.
      score: hasOutcomeScore ? outcome.score : snapshot.score ?? computed.score,
      status: hasOutcomeStatus ? outcome.status : (snapshot.passed ? "passed" : "failed")
    };
    reviewResult = SimActivityFlow?.reviewResult ? SimActivityFlow.reviewResult(computed, { score: snapshot.score, passed: snapshot.passed }, attempt) : { trusted: true, result: computed };
    const trusted = reviewResult.trusted !== false;
    clearInteractionTransient();
    if (!trusted) reviewSnapshot = null;
    runtimeState = "review";
    activity = { ...Persistence.freshDraft(), phase: "summary", currentQuestion: 0 };
    if (trusted) activity.questions = snapshot.answer.questions.map(question => M.clone(question));
    state = activity.questions[0];
    renderAll();
  }

  function retryFinishOnly() {
    const next = SimScorm?.retryFinish ? SimScorm.retryFinish() : { ok: false, retryable: true, committed: true, frozen: true };
    next.activityState = next.ok ? "success" : next.committed ? "committed" : next.frozen ? "frozen" : "retry";
    SimActivityFlow.submission(next, submissionHandlers());
  }

  function submissionHandlers() {
    return {
      success: (outcome) => {
        finishRetryAvailable = false;
        enterReview(reviewSnapshot, outcome);
      },
      committed: (outcome) => {
        finishRetryAvailable = true;
        enterReview(reviewSnapshot, outcome);
      },
      frozen: (outcome) => {
        runtimeState = "frozen";
        activityLoadError = "提交尚未被 LMS 確認；目前保留同一個不可修改的提交內容。";
        dom.submitStatus.textContent = "提交尚未確認，不能宣稱已提交或已取得分數。";
        renderAll();
      },
      retry: (outcome) => {
        if (outcome?.retryable) {
          runtimeState = "frozen";
          activityLoadError = "SCORM 操作需要重試；答案已鎖定，尚未確認提交。";
          renderAll();
        } else {
          runtimeState = "editable";
          activityLoadError = `提交前檢查失敗：${outcome?.reason || "unknown"}`;
          dom.submitStatus.textContent = activityLoadError;
          renderAll();
        }
      }
    };
  }

  function routeSubmission(outcome) {
    if (!SimActivityFlow) return;
    SimActivityFlow.submission(outcome, submissionHandlers());
  }

  function submitAttempt() {
    if (runtimeState !== "editable" || activity.phase !== "summary") return;
    if (drag || keyboardDrag || formulaDrag) {
      dom.submitStatus.textContent = "目前仍有未完成的作圖或公式操作，請先完成或取消後再提交。";
      return;
    }
    const incomplete = activity.questions
      .map((question, index) => ({ index, missing: missingQuestionItems(question) }))
      .filter(entry => entry.missing.length);
    if (incomplete.length && typeof windowObject.confirm === "function") {
      const detail = incomplete.map(entry => `第${entry.index + 1}題：${entry.missing.join("、")}`).join("\n");
      if (!windowObject.confirm(`仍有未作答項目：\n${detail}\n\n是否照常提交？`)) {
        dom.submitStatus.textContent = "已取消提交；可返回修改未完成項目。";
        return;
      }
    }
    const finalState = snapshotActivity();
    const result = Scoring.score(finalState);
    try {
      reviewSnapshot = Persistence.makeSnapshot("review", finalState, result);
    } catch (error) {
      dom.submitStatus.textContent = `提交前驗證失敗：${error.message}`;
      return;
    }
    if (!SimScorm?.submitWithCallbacks || !SimActivityFlow) {
      runtimeState = "load-error";
      activityLoadError = "必要共用模組未能載入；已停用提交，未寫入 LMS。";
      renderAll();
      return;
    }
    dom.submitAttempt.disabled = true;
    dom.submitStatus.textContent = "正在提交；未收到確認前不會顯示已提交結果。";
    const outcome = SimScorm.submitWithCallbacks(result, reviewSnapshot, {
      onSuccess: routeSubmission,
      onFailure: routeSubmission
    });
    if (!outcome.ok && !outcome.frozen && !outcome.committed) routeSubmission(outcome);
  }

  function retryFrozen() {
    if (runtimeState !== "frozen" || !reviewSnapshot || !SimScorm?.retryPending) return;
    const outcome = SimScorm.retryPending();
    if (outcome?.review?.kind === "review") {
      try {
        const answer = Persistence.decodeSnapshot(outcome.review, "review");
        reviewSnapshot = { ...outcome.review, answer };
      } catch (_) {
        SimScorm.quarantinePending?.();
        runtimeState = "quarantined";
        activityLoadError = "重試回傳的 review 無法由活動驗證；提交資料已隔離，未顯示結果。";
        renderAll();
        return;
      }
    }
    outcome.activityState = outcome.ok ? "success" : outcome.committed ? "committed" : outcome.frozen ? "frozen" : "retry";
    routeSubmission(outcome);
  }

  function resetInvalidDraft() {
    if (runtimeState !== "load-error" || !invalidDraftRecovery) return;
    const standalone = isStandaloneMode();
    const warning = standalone
      ? "目前保存的本機草稿無法驗證。清除後這次未提交作答不能恢復，確定重新開始嗎？"
      : "目前保存的 LMS 草稿無法驗證。覆寫後這次未提交作答不能恢復，確定重新開始嗎？";
    if (typeof windowObject.confirm === "function" && !windowObject.confirm(warning)) return;

    let cleared = false;
    try {
      if (standalone) {
        cleared = SimScorm?.clearStandaloneAttempt?.(ACTIVITY) === true;
      } else {
        const fresh = Persistence.makeSnapshot("draft", Persistence.freshDraft());
        cleared = SimScorm?.saveDraft?.(fresh) === true;
      }
    } catch (error) {
      activityLoadError = `無法重設損壞草稿：${error.message}`;
    }
    if (!cleared && !activityLoadError) {
      activityLoadError = standalone
        ? "本機草稿無法清除；資料仍保留，請檢查瀏覽器儲存權限後再試。"
        : "LMS 草稿無法覆寫；資料仍保留，請檢查 LMS 連線及保存權限後再試。";
    }
    if (!cleared) {
      renderTechnical();
      return;
    }
    invalidDraftRecovery = false;
    windowObject.location.reload();
  }

  function loadFinishedReview(attempt) {
    const recorded = SimActivityFlow?.recordedResult?.(attempt) || {
      score: (() => {
        const raw = String(attempt?.score ?? "").trim();
        const value = raw === "" ? null : Number(raw);
        return Number.isFinite(value) ? value : null;
      })(),
      passed: attempt?.status === "passed" ? true : attempt?.status === "failed" ? false : null
    };
    if (!attempt.snapshot || attempt.snapshot.kind !== "review") {
      runtimeState = "review";
      reviewResult = { trusted: false, result: { score: recorded.score, maxScore: 100, passed: recorded.passed, completed: true, detail: [], feedbackItems: [] } };
      reviewSnapshot = null;
      renderAll();
      return;
    }
    try {
      const answer = Persistence.decodeSnapshot(attempt.snapshot, "review");
      enterReview({ ...attempt.snapshot, answer }, { score: attempt.score, status: attempt.status });
    } catch (error) {
      runtimeState = "review";
      activityLoadError = "已完成的 review 資料無法驗證；只顯示 Moodle 已記錄摘要。";
      reviewResult = { trusted: false, result: { score: recorded.score, maxScore: 100, passed: recorded.passed, completed: true, detail: [], feedbackItems: [] } };
      reviewSnapshot = null;
      renderAll();
    }
  }

  function startup() {
    if (!SimScorm || !SimActivityFlow) {
      runtimeState = "load-error";
      activityLoadError = "活動必要共用模組未能載入；已停用作答及提交。請重新載入活動。";
      renderAll();
      return;
    }
    const standaloneStorage = SimScorm.enableStandalonePersistence?.(ACTIVITY);
    let attempt;
    try { attempt = SimScorm.loadAttempt(ACTIVITY); } catch (error) {
      runtimeState = "load-error";
      activityLoadError = `活動載入失敗：${error.message}`;
      renderAll();
      return;
    }
    const mode = SimActivityFlow.startup(attempt);
    if (attempt.state === "pending-invalid") {
      SimScorm.quarantinePending?.();
      runtimeState = "quarantined";
      activityLoadError = "提交資料的外層格式已損壞，已隔離且不會重試；請由 LMS 管理者處理。";
      renderAll();
      return;
    }
    if (mode === "review") { loadFinishedReview(attempt); return; }
    if (mode === "frozen") {
      try {
        const pending = Persistence.decodePending(attempt.snapshot);
        const computed = Scoring.score({ ...Persistence.freshDraft(), phase: "summary", questions: pending.state.questions });
        if (pending.payload.maxScore !== Scoring.MAX_SCORE || pending.payload.score !== pending.snapshot.score || pending.payload.passed !== pending.snapshot.passed || pending.payload.score !== computed.score || pending.payload.passed !== computed.passed) {
          throw new Error("pending result metadata mismatch");
        }
        reviewSnapshot = pending.snapshot;
      } catch (error) {
        SimScorm.quarantinePending?.();
        runtimeState = "quarantined";
        activityLoadError = `提交資料未通過活動驗證，已隔離且不會重試：${error.message}`;
        renderAll();
        return;
      }
      runtimeState = "frozen";
      activityLoadError = "找到尚未確認的提交；請只重試同一個提交內容。";
      renderAll();
      return;
    }
    if (mode !== "editable") {
      runtimeState = "load-error";
      activityLoadError = "活動狀態或保存資料無法安全驗證，已鎖定避免誤改答案。";
      renderAll();
      return;
    }
    try {
      activity = attempt.state === "draft" ? Persistence.decodeSnapshot(attempt.snapshot, "draft") : Persistence.freshDraft();
      state = activity.questions[activity.currentQuestion];
    } catch (error) {
      invalidDraftRecovery = attempt.state === "draft";
      runtimeState = "load-error";
      activityLoadError = `草稿無法驗證：${error.message}`;
      renderAll();
      return;
    }
    runtimeState = "editable";
    standaloneStorageState = standaloneStorage;
    draftSaveState = isStandaloneMode() && standaloneStorage !== "available" ? "memory-only" : "saved";
    if (attempt.state === "draft") {
      message = `已恢復第 ${activity.currentQuestion + 1} 題草稿；請按目前步驟繼續作答。`;
      messageKind = "";
    }
    SimScorm.setDraftProvider(() => Persistence.makeSnapshot("draft", snapshotActivity()));
    renderAll();
  }

  attachHit(dom.originHit);
  attachHit(dom.pointHit);
  attachHit(dom.thetaHit);
  dom.editHits.forEach(attachHit);
  dom.formulaTokens.forEach(button => {
    button.addEventListener("pointerdown", event => {
      if (!isPracticeEditable() || event.button > 0 || drag || keyboardDrag || formulaDrag || state.phase !== "formulas" || !M.formulaExpectations(state)) return;
      event.preventDefault();
      suppressFormulaClick = false;
      formulaDrag = { id: event.pointerId, button, token: button.dataset.formulaToken, x: event.clientX, y: event.clientY, moved: false };
      setMathText(dom.formulaGhost, `${formulaDrag.token} θ`);
      button.setPointerCapture(event.pointerId);
      renderControls();
    });
    button.addEventListener("pointermove", moveFormula);
    button.addEventListener("pointerup", event => endFormulaDrag(event));
    button.addEventListener("pointercancel", event => endFormulaDrag(event, true));
    button.addEventListener("lostpointercapture", event => endFormulaDrag(event, true));
    button.addEventListener("click", event => {
      if (!isPracticeEditable()) return;
      if (event.detail > 0 && suppressFormulaClick) { suppressFormulaClick = false; return; }
      selectedFormula = button.dataset.formulaToken;
      renderFormulas();
    });
  });
  dom.formulaSlots.forEach(button => button.addEventListener("click", () => {
    if (!isPracticeEditable()) return;
    if (selectedFormula && !formulaDrag) placeFormula(button.dataset.formulaSlot, selectedFormula);
    else if (!formulaDrag) setMessage("請先選 sin θ 或 cos θ 卡片，再點這個空格。", "");
  }));
  dom.formulaWorkbench.querySelectorAll("[data-formula-clear]").forEach(button => button.addEventListener("click", () => {
    if (isPracticeEditable()) placeFormula(button.dataset.formulaClear, null);
  }));
  documentObject.addEventListener("keydown", event => {
    if (event.key !== "Escape" || (!formulaDrag && !selectedFormula)) return;
    event.preventDefault();
    selectedFormula = null;
    endFormulaDrag(null, true);
    renderFormulas();
  });
  dom.thetaChoices.addEventListener("click", event => {
    const button = event.target.closest("[data-theta-choice]");
    if (!isPracticeEditable() || !button || drag || keyboardDrag || state.phase !== "angle") return;
    const candidate = thetaCandidatesForInteraction().find(item => item.key === button.dataset.thetaChoice);
    if (candidate) commitDraft({ kind: "theta", pointerType: "keyboard", preview: candidate });
  });
  dom.questionProgress.addEventListener("click", routeQuestionClick);
  dom.summaryList.addEventListener("click", routeSummaryEdit);
  dom.reviewQuestionNavigation.addEventListener("click", routeQuestionClick);
  dom.goSummary.addEventListener("click", openSummary);
  dom.submitAttempt.addEventListener("click", submitAttempt);
  dom.returnToPractice.addEventListener("click", () => switchQuestion(activity.currentQuestion, true));
  dom.retrySave.addEventListener("click", () => { persistDraft(); renderAll(); });
  dom.backButton.addEventListener("click", handleBack);
  dom.redrawButton.addEventListener("click", handleRedraw);
  dom.resetButton.addEventListener("click", handleReset);
  dom.nextButton.addEventListener("click", handleNext);
  dom.stageBackButton.addEventListener("click", handleBack);
  dom.stageNextButton.addEventListener("click", handleNext);
  dom.stage.addEventListener("touchstart", startStageHostTouch, { passive: true });
  dom.stage.addEventListener("touchmove", moveStageHostTouch, { passive: false });
  dom.stage.addEventListener("touchend", endStageHostTouch, { passive: true });
  dom.stage.addEventListener("touchcancel", () => { hostTouchScroll = null; }, { passive: true });
  documentObject.addEventListener("pointerdown", recordPointer, true);
  documentObject.addEventListener("pointermove", recordPointer, true);
  documentObject.addEventListener("pointerup", recordPointer, true);
  documentObject.addEventListener("pointercancel", recordPointer, true);
  documentObject.addEventListener("pointerover", captureTouchPointer, true);
  documentObject.addEventListener("touchstart", captureStageTouch, { capture: true, passive: false });
  windowObject.addEventListener("resize", () => { if (!drag && !keyboardDrag && !formulaDrag) renderAll(); });

  documentObject.querySelectorAll(".force-header p:not(.prototype-note), .phase-steps b, .theta-choices p, .theta-choices button, [data-formula-token]").forEach(node => setMathText(node, node.textContent));
  startup();

  return Object.freeze({
    getState: () => M.clone(state),
    getDragPreview: () => M.clone(drag || keyboardDrag),
    getTouchTelemetry: () => M.clone(pointerTelemetry),
    clearTouchTelemetry: () => { pointerTelemetry.length = 0; },
    getPhase: () => state.phase,
    getActivityState: () => snapshotActivity(),
    getRuntimeState: () => runtimeState,
    getLayoutMetrics: () => ({
      sceneId: activeScene().id,
      origin: M.clone(sceneFrame().origin),
      viewBox: M.clone(sceneViewBox()),
      worldBounds: M.clone(sceneWorldBounds()),
      editingBounds: M.clone(editingBounds()),
      diagramScale: diagramTransform().scale
    }),
    isCorrectDecomposition: () => M.isCorrectDecomposition(state),
    reset: handleReset
  });
});
