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
    Object.freeze({ type: "首尾相接法・基礎一", title: "用首尾相接法作出兩力合力", prompt: "任選一個力，把它的箭尾移到作圖起點；再把另一個力的箭尾接到第一個力的箭頭。兩個次序都可以。" }),
    Object.freeze({ type: "首尾相接法・基礎二", title: "自行安排兩個力的首尾次序", prompt: "把兩個力排成由作圖起點出發的單一力鏈，再由力鏈起點畫到終點。" }),
    Object.freeze({ type: "三力合成・進階題", title: "用首尾相接法作出三力合力", prompt: "三個力各使用一次，按任意次序接成由作圖起點出發的單一力鏈，再畫出三力合力。" })
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
        return count ? "再把另一個力的箭尾移到同一個作圖起點。" : "先把兩個力的箭尾移到共同作圖起點。";
      }
      if (variant === "guides") return question.guided ? "由目前顯示的箭頭端點拖出虛線輔助線。" : "自行選擇端點，畫出兩條構成平行四邊形的虛線輔助線。";
      return question.guided ? "由作圖起點拖至平行四邊形對角頂點，畫出合力。" : "自行選擇正確起點，畫出平行四邊形的對角線合力。";
    }
    const chain = M.chainInfo(answer, question);
    if (!chain.order.length) return "任選一個力，把它的箭尾移到作圖起點。";
    if (!chain.complete) return `已接上 ${chain.order.length} 個力；把另一個力的箭尾接到目前力鏈的自由箭頭。`;
    return question.guided ? "由作圖起點拖至力鏈終點，畫出合力。" : "自行選擇正確起點，畫至整條力鏈的終點。";
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
  let selectedForce = 0;
  let unsaved = false;
  let pendingFreshState = null;
  let submitting = false;
  let drag = null;
  let keyboardLine = null;
  let nearSnapPoint = null;
  const undoStacks = Array.from({ length: 5 }, () => []);
  const eventTelemetry = [];
  const touchTelemetry = [];

  function cacheDom() {
    for (const id of [
      "app", "questionCounter", "attemptStatus", "stage", "stageSvg", "dragLayer", "controlPanel", "magnifier", "magnifierLabel", "magnifierLine",
      "saveBanner", "saveBannerText", "retrySave", "technicalPanel", "technicalTitle", "technicalMessage", "technicalActions",
      "practicePanel", "questionType", "questionTitle", "questionPrompt", "formula", "stepPrompt", "forceSelector", "lineTools", "questionProgress",
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

  function arrowPolygon(start, end, size = 15) {
    const length = Math.max(.0001, M.distance(start, end));
    const ux = (end.x - start.x) / length;
    const uy = (end.y - start.y) / length;
    const base = { x: end.x - ux * size, y: end.y - uy * size };
    const px = -uy * size * .52;
    const py = ux * size * .52;
    return `${end.x},${end.y} ${base.x + px},${base.y + py} ${base.x - px},${base.y - py}`;
  }

  function drawArrow(parent, start, end, options = {}) {
    const className = options.className || "force-line";
    const line = drawLine(parent, start, end, className, options.forceIndex == null ? {} : { "data-force-index": options.forceIndex });
    const polygon = createSvg("polygon", {
      points: arrowPolygon(start, end, options.size || 15),
      class: options.arrowClass || "force-arrowhead",
      ...(options.forceIndex == null ? {} : { "data-force-index": options.forceIndex })
    });
    parent.append(polygon);
    return { line, polygon };
  }

  function drawGrid(parent) {
    for (let x = 0; x <= G.WIDTH; x += 40) drawLine(parent, { x, y: 0 }, { x, y: G.HEIGHT }, "grid-line");
    for (let y = 0; y <= G.HEIGHT; y += 40) drawLine(parent, { x: 0, y }, { x: G.WIDTH, y }, "grid-line");
  }

  function labelPosition(start, end) {
    const length = Math.max(1, M.distance(start, end));
    const nx = -(end.y - start.y) / length;
    const ny = (end.x - start.x) / length;
    return { x: (start.x + end.x) / 2 + nx * 20, y: (start.y + end.y) / 2 + ny * 20 };
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
    geometry.forEach((item, index) => {
      drawArrow(parent, item.tail, item.head, { forceIndex: index });
      const position = labelPosition(item.tail, item.head);
      parent.append(N.svgLabel(documentObject, N.vector(index + 1), { x: position.x, y: position.y, fill: ["#1d4ed8", "#7e22ce", "#be185d"][index] }));
    });
    if (question.type !== "parallelogram") {
      const chain = M.chainInfo(answer, question);
      for (let index = 1; index < chain.order.length; index += 1) {
        const point = M.endpointForKey(answer, question, M.tailKey(chain.order[index]));
        parent.append(createSvg("circle", { cx: point.x, cy: point.y, r: 6, class: "junction" }));
      }
    }
    if (answer.resultant) {
      const start = M.endpointForKey(answer, question, answer.resultant.originKey);
      const end = M.lineEndPoint(answer.resultant, answer, question);
      drawArrow(parent, start, end, { className: `resultant-line${answer.resultant.end.mode === "free" ? " provisional" : ""}`, arrowClass: "resultant-arrowhead", size: 17 });
      const position = labelPosition(start, end);
      parent.append(N.svgLabel(documentObject, N.vector("R"), { x: position.x, y: position.y, fill: "#b45309" }));
    }
  }

  function drawCorrectGeometry(parent, question) {
    if (question.type === "parallelogram") {
      const firstHead = M.add(G.ORIGIN, question.forces[0]);
      const secondHead = M.add(G.ORIGIN, question.forces[1]);
      const target = M.corner(question);
      drawArrow(parent, G.ORIGIN, firstHead, { className: "force-line correct-overlay", arrowClass: "resultant-arrowhead correct-overlay", size: 12 });
      drawArrow(parent, G.ORIGIN, secondHead, { className: "force-line correct-overlay", arrowClass: "resultant-arrowhead correct-overlay", size: 12 });
      drawLine(parent, firstHead, target, "guide-line correct-overlay");
      drawLine(parent, secondHead, target, "guide-line correct-overlay");
      drawArrow(parent, G.ORIGIN, target, { className: "resultant-line correct-overlay", arrowClass: "resultant-arrowhead correct-overlay", size: 16 });
    } else {
      let current = { ...G.ORIGIN };
      for (const force of question.forces) {
        const next = M.add(current, force);
        drawArrow(parent, current, next, { className: "force-line correct-overlay", arrowClass: "resultant-arrowhead correct-overlay", size: 12 });
        current = next;
      }
      drawArrow(parent, G.ORIGIN, current, { className: "resultant-line correct-overlay", arrowClass: "resultant-arrowhead correct-overlay", size: 16 });
    }
  }

  function renderStage(answerOverride = null) {
    dom.stageSvg.replaceChildren();
    const background = createSvg("g", { "aria-hidden": "true" });
    drawGrid(background);
    dom.stageSvg.append(background);
    dom.stageSvg.append(createSvg("circle", { cx: G.ORIGIN.x, cy: G.ORIGIN.y, r: 8, class: "origin-point" }));
    dom.stageSvg.append(N.svgLabel(documentObject, N.point("O"), { x: G.ORIGIN.x + 13, y: G.ORIGIN.y - 13, class: "math-svg origin-label", fill: "#334155" }));
    if (!state || !scenario || !state.answers) return;
    const question = scenario.questions[state.currentQuestion];
    const answer = answerOverride || state.answers[state.currentQuestion];
    drawQuestionGeometry(dom.stageSvg, answer, question);
    if (presentation === "review" && trustedReview && correctOverlay) drawCorrectGeometry(dom.stageSvg, question);
    if (nearSnapPoint) dom.stageSvg.append(createSvg("circle", { cx: nearSnapPoint.x, cy: nearSnapPoint.y, r: 17, class: "near-snap" }));
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
    if (key === "ORIGIN") return "O";
    if (key === "CORNER") return "C";
    const match = /^F([1-3])_(TAIL|HEAD)$/.exec(key || "");
    if (!match) return "•";
    const subscripts = { 1: "₁", 2: "₂", 3: "₃" };
    return `F${subscripts[match[1]]}${match[2] === "TAIL" ? "尾" : "頭"}`;
  }

  function lineHandlePoint(button, answer, question) {
    const kind = button.dataset.dragKind;
    if (kind === "guide-start" || kind === "resultant-start") return M.endpointForKey(answer, question, button.dataset.originKey);
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
    geometry.forEach((item, index) => {
      const button = makeOverlayButton("force-hit", `force-${index}`, forceAccessibleLabel(index, item));
      button.dataset.forceIndex = String(index);
      button.dataset.dragKind = "force";
      button.classList.toggle("is-selected", index === selectedForce);
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
    for (const handle of M.resultantStartHandles(answer, question)) {
      const button = makeOverlayButton("line-handle", `resultant-start-${handle.key}`, `由${endpointAccessible(handle.key)}開始畫合力`);
      button.dataset.dragKind = "resultant-start";
      button.dataset.lineKind = "resultant";
      button.dataset.originKey = handle.key;
      positionHandle(button, handle.point);
      dom.dragLayer.append(button);
    }
    if (answer.resultant) {
      const button = makeOverlayButton("line-handle", "resultant-end", "調整合力終點");
      button.dataset.dragKind = "resultant-end";
      button.dataset.lineKind = "resultant-end";
      button.dataset.originKey = answer.resultant.originKey;
      positionHandle(button, M.lineEndPoint(answer.resultant, answer, question));
      dom.dragLayer.append(button);
    }
    layoutLineHandles(answer, question);
  }

  function positionExistingOverlays(answer) {
    const question = scenario.questions[state.currentQuestion];
    const geometry = M.forceGeometry(answer, question);
    dom.dragLayer.querySelectorAll(".force-hit").forEach((button) => positionForceButton(button, geometry[Number(button.dataset.forceIndex)]));
    layoutLineHandles(answer, question);
  }

  function endpointAccessible(key) {
    if (key === "ORIGIN") return "作圖起點 O";
    if (key === "CORNER") return "平行四邊形對角頂點";
    const match = /^F([1-3])_(TAIL|HEAD)$/.exec(key || "");
    if (!match) return key;
    return `${N.accessibleForce(Number(match[1]))}的${match[2] === "TAIL" ? "箭尾" : "箭頭"}`;
  }

  function renderFormula() {
    dom.formula.replaceChildren();
    N.appendHtml(dom.formula, N.expression(scenario.questions[state.currentQuestion].forces.length));
  }

  function renderForceSelector() {
    dom.forceSelector.replaceChildren();
    const count = scenario.questions[state.currentQuestion].forces.length;
    for (let index = 0; index < count; index += 1) {
      const button = documentObject.createElement("button");
      button.type = "button";
      button.dataset.selectForce = String(index);
      button.setAttribute("aria-pressed", String(index === selectedForce));
      button.setAttribute("aria-label", `選擇${N.accessibleForce(index + 1)}`);
      N.appendHtml(button, N.vector(index + 1));
      dom.forceSelector.append(button);
    }
  }

  function renderLineTools() {
    dom.lineTools.replaceChildren();
    const answer = state.answers[state.currentQuestion];
    if (answer.type !== "parallelogram") return;
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
    dom.questionType.textContent = `${view.id}・${view.type}`;
    dom.questionTitle.textContent = view.title;
    dom.questionPrompt.textContent = view.prompt;
    dom.stepPrompt.textContent = view.step;
    renderFormula();
    renderForceSelector();
    renderLineTools();
    renderProgress();
    const policy = UI.controlPolicy({ presentation, phase: state.phase, undoAvailable: undoStacks[state.currentQuestion].length > 0, unsaved });
    dom.undo.disabled = !policy.undoEnabled;
    dom.resetQuestion.disabled = !policy.resetEnabled || M.isBlank(state.answers[state.currentQuestion]);
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

  function finalizeAnswer(nextAnswer, message, focusKey) {
    const index = state.currentQuestion;
    const previous = state.answers[index];
    if (JSON.stringify(previous) === JSON.stringify(nextAnswer)) { renderAll({ focusKey }); return; }
    pushUndo(index, previous);
    state.answers[index] = nextAnswer;
    state = P.productionRoundTrip(state);
    saveDraft();
    renderAll({ focusKey });
    if (message) announce(message);
  }

  function navigateQuestion(index, fromSummary = false) {
    if (!state || !scenario || index < 0 || index > 4 || presentation === "technical") return;
    state.currentQuestion = index;
    state.phase = "practice";
    selectedForce = 0;
    correctOverlay = false;
    if (["editable", "retryable"].includes(presentation)) saveDraft();
    renderAll();
    if (fromSummary) dom.questionTitle.focus({ preventScroll: true });
  }

  function goToSummary() {
    state.phase = "summary";
    presentation = "editable";
    saveDraft();
    renderAll();
    dom.summaryPanel.querySelector("h2")?.focus({ preventScroll: true });
  }

  function undo() {
    const stack = undoStacks[state.currentQuestion];
    if (!stack.length) return;
    state.answers[state.currentQuestion] = stack.pop();
    state = P.productionRoundTrip(state);
    saveDraft();
    renderAll();
    announce("已復原本題上一個完整操作。");
  }

  function resetCurrent() {
    const answer = state.answers[state.currentQuestion];
    if (M.isBlank(answer)) return;
    pushUndo(state.currentQuestion, answer);
    state.answers[state.currentQuestion] = M.freshAnswer(scenario.questions[state.currentQuestion]);
    state = P.productionRoundTrip(state);
    saveDraft();
    renderAll();
    announce("本題已重設；可使用復原上一步取回剛才的作答。");
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
    const point = clientToModel(event.clientX, event.clientY);
    const base = { pointerId: event.pointerId, pointerType: event.pointerType || "mouse", kind, target, before: P.clone(answer), point, preview: answer };
    if (kind === "force") {
      const index = Number(target.dataset.forceIndex);
      selectedForce = index;
      const tail = M.forceGeometry(answer, question)[index].tail;
      Object.assign(base, { forceIndex: index, startTail: tail, startPoint: point });
    } else if (kind === "guide-start" || kind === "guide-end") {
      Object.assign(base, { originKey: target.dataset.originKey });
    } else if (kind === "resultant-start" || kind === "resultant-end") {
      Object.assign(base, { originKey: target.dataset.originKey });
    } else return;
    drag = base;
    target.setPointerCapture(event.pointerId);
    target.classList.add("is-dragging");
    event.preventDefault();
    renderMagnifier(event);
  }

  function updateNearSnap(preview, question, candidate, pointerType, kind, originKey) {
    nearSnapPoint = null;
    let targets = [];
    if (kind === "force") targets = M.legalForceTargets(preview, question, drag.forceIndex);
    else if (kind.startsWith("guide") && ["F1_HEAD", "F2_HEAD"].includes(originKey)) targets = [{ key: "CORNER", point: M.corner(question) }];
    else if (kind.startsWith("resultant") && originKey === "ORIGIN") targets = [{ key: question.type === "parallelogram" ? "CORNER" : "CHAIN_END", point: M.corner(question) }];
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
      preview = M.previewForceTranslation(drag.before, drag.forceIndex, candidate, question);
      candidate = M.fromPoint10(preview.placements[drag.forceIndex].tail10);
    } else if (drag.kind.startsWith("guide")) preview = M.previewGuide(drag.before, drag.originKey, point, question);
    else preview = M.previewResultant(drag.before, drag.originKey, point, question);
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
      message = guide?.end.mode === "snap" ? "虛線輔助線已連接到平行四邊形對角頂點。" : "虛線輔助線尚未吸附，可拖動終點再調整。";
    } else {
      next = M.commitResultant(active.before, active.originKey, point, question, options);
      message = M.canonicalResultant(next, question) ? "合力已正確連接，本題完成。" : "合力尚未吸附，可拖動終點再調整。";
    }
    finalizeAnswer(next, message, active.target.dataset.semanticKey);
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
    dom.magnifierLabel.textContent = drag?.kind === "force" ? N.accessibleForce(drag.forceIndex + 1) : drag?.kind?.startsWith("guide") ? "虛線輔助線終點" : "合力終點";
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
    else endpoint = M.endpointForKey(answer, question, originKey);
    keyboardLine = { kind, originKey, target, before: P.clone(answer), endpoint };
    announce("已開始鍵盤畫線。使用方向鍵移動終點，Enter 確認，Escape 取消。");
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
        : M.commitResultant(active.before, active.originKey, active.endpoint, question, options);
      nearSnapPoint = null;
      finalizeAnswer(next, M.canonicalResultant(next, question) ? "合力已正確連接，本題完成。" : "已確認線段位置。", active.target.dataset.semanticKey);
      event.preventDefault();
      return true;
    }
    const vectors = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!vectors[event.key]) return false;
    const step = event.shiftKey ? 10 : 2;
    keyboardLine.endpoint = M.clampLinePoint({ x: keyboardLine.endpoint.x + vectors[event.key][0] * step, y: keyboardLine.endpoint.y + vectors[event.key][1] * step });
    const question = scenario.questions[state.currentQuestion];
    const preview = keyboardLine.kind.startsWith("guide") ? M.previewGuide(keyboardLine.before, keyboardLine.originKey, keyboardLine.endpoint, question)
      : M.previewResultant(keyboardLine.before, keyboardLine.originKey, keyboardLine.endpoint, question);
    updateNearSnap(preview, question, keyboardLine.endpoint, "keyboard", keyboardLine.kind, keyboardLine.originKey);
    renderStage(preview);
    positionExistingOverlays(preview);
    event.preventDefault();
    return true;
  }

  function handleOverlayKey(event) {
    const target = event.target.closest(".force-hit,.line-handle");
    if (!target) return;
    if (keyboardLine && updateKeyboardLine(event)) return;
    if (target.classList.contains("line-handle") && event.key === "Enter") {
      beginKeyboardLine(target);
      event.preventDefault();
      return;
    }
    if (!target.classList.contains("force-hit")) return;
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
    dom.dragLayer.addEventListener("pointerdown", (event) => {
      const target = event.target.closest(".force-hit,.line-handle");
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
      const target = event.target.closest(".line-handle");
      if (target && event.detail === 0 && !keyboardLine) beginKeyboardLine(target);
    });
    dom.forceSelector.addEventListener("click", (event) => {
      const button = event.target.closest("[data-select-force]");
      if (!button) return;
      selectedForce = Number(button.dataset.selectForce);
      renderForceSelector();
      renderOverlays();
      announce(`${N.accessibleForce(selectedForce + 1)}已選取。`);
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
    windowObject.addEventListener("resize", () => { if (!drag && !keyboardLine) renderOverlays(); });
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
