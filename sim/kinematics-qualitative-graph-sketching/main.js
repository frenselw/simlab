(function () {
  "use strict";

  const Tasks = window.KinematicsGraphTasks;
  const Notation = window.KinematicsGraphNotation;
  const Model = window.KinematicsGraphModel;
  const Analysis = window.KinematicsGraphAnalysis;
  const Scoring = window.KinematicsGraphScoring;
  const Persistence = window.KinematicsGraphPersistence;
  const UiPolicy = window.KinematicsGraphUiPolicy;
  if (![Tasks, Notation, Model, Analysis, Scoring, Persistence, UiPolicy, window.SimScorm, window.SimActivityFlow].every(Boolean)) {
    throw new Error("Qualitative kinematics graph modules were not loaded");
  }

  const ACTIVITY = "kinematics-qualitative-graph-sketching";
  const elements = Object.fromEntries(Array.from(document.querySelectorAll("[id]")).map((element) => [element.id, element]));
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PLOT = Object.freeze({ left: 76, top: 44, width: 600, height: 432, bottom: 476 });
  let state = null;
  let mode = "activity";
  let locked = false;
  let retryMode = "none";
  let pendingExpected = null;
  let submittedResult = null;
  let trustedReview = true;
  let resultTaskIndex = Tasks.taskIndexById(`${Tasks.SCENARIOS[0].id}-${Tasks.DISPLAY_GRAPH_TYPES[0]}`);
  let activeTool = "pen";
  let liveLast = "";
  const pointerDiagnostics = { down: 0, move: 0, up: 0, cancel: 0, trustedTouch: 0 };

  function announce(message) {
    if (!message || message === liveLast) return;
    liveLast = message;
    elements.liveRegion.textContent = "";
    requestAnimationFrame(() => { elements.liveRegion.textContent = message; });
  }

  function focusHeading(element) {
    requestAnimationFrame(() => element?.focus({ preventScroll: false }));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function physicsFragment(value) {
    const fragment = document.createDocumentFragment();
    Notation.tokenize(value).forEach((part) => {
      if (part.variable) {
        const variable = document.createElement("var");
        variable.textContent = part.text;
        fragment.append(variable);
      } else {
        fragment.append(document.createTextNode(part.text));
      }
    });
    return fragment;
  }

  function setPhysicsText(element, value) {
    element.replaceChildren(physicsFragment(value));
  }

  function formatPhysicsNotation(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ["VAR", "SCRIPT", "STYLE", "TEXT", "TSPAN"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return Notation.tokenize(node.data).some((part) => part.variable)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => node.replaceWith(physicsFragment(node.data)));
  }

  function pathForTrace(trace) {
    if (!Model.isTrace(trace)) return "";
    let output = "";
    let connected = false;
    trace.forEach((value, index) => {
      if (value === Model.EMPTY) {
        connected = false;
        return;
      }
      const x = PLOT.left + index / (Model.DRAW_BINS - 1) * PLOT.width;
      const y = PLOT.bottom - value / Model.MAX_VALUE * PLOT.height;
      output += `${connected ? " L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      connected = true;
    });
    return output;
  }

  function createSvgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  class GraphView {
    constructor(mount, onCommit, options = {}) {
      this.mount = mount;
      this.onCommit = onCommit;
      this.practice = Boolean(options.practice);
      this.locked = Boolean(options.locked);
      this.graphType = "vt";
      this.composite = false;
      this.editor = new Model.Editor();
      this.editors = new Map();
      this.keyboardBin = 0;
      this.keyboardValue = Model.quantizeY(0.5);
      this.keyboardPenDown = false;
      this.currentKey = "";
      const fragment = elements.graphTemplate.content.cloneNode(true);
      mount.replaceChildren(fragment);
      this.board = mount.querySelector(".graph-board");
      this.svg = mount.querySelector(".graph-svg");
      this.surface = mount.querySelector(".graph-input-surface");
      this.studentPath = mount.querySelector(".student-path");
      this.exemplarPath = mount.querySelector(".exemplar-path");
      this.completenessHint = elements.stageCompletenessHint;
      this.phaseLayer = mount.querySelector(".phase-layer");
      this.cursorX = mount.querySelector(".cursor-x");
      this.cursorY = mount.querySelector(".cursor-y");
      this.cursorDot = mount.querySelector(".cursor-dot");
      this.bind();
    }

    bind() {
      this.surface.addEventListener("pointerdown", (event) => this.pointerDown(event));
      this.surface.addEventListener("pointermove", (event) => this.pointerMove(event));
      this.surface.addEventListener("pointerup", (event) => this.pointerUp(event));
      this.surface.addEventListener("pointercancel", (event) => this.pointerCancel(event, true));
      this.surface.addEventListener("lostpointercapture", (event) => {
        if (this.editor.active) this.pointerCancel(event, true);
      });
      this.surface.addEventListener("keydown", (event) => this.keyDown(event));
      this.surface.addEventListener("blur", () => {
        if (this.keyboardPenDown) this.cancelKeyboard(true);
      });
    }

    configure({ graphType, composite = false, trace = null, locked = false, exemplar = null, key = "" }) {
      this.graphType = graphType;
      this.composite = composite;
      this.locked = locked;
      this.board.classList.toggle("is-locked", locked);
      this.surface.setAttribute("aria-disabled", String(locked));
      this.surface.tabIndex = locked ? -1 : 0;
      this.surface.setAttribute("role", locked ? "img" : "application");
      this.updateAxes();
      this.updatePhases();
      if (key !== this.currentKey) {
        this.editor.cancel();
        this.currentKey = key;
        if (!this.editors.has(key)) this.editors.set(key, new Model.Editor(trace || Model.createTrace()));
        this.editor = this.editors.get(key);
        this.keyboardBin = 0;
        this.keyboardValue = this.firstVisibleValue();
        this.keyboardPenDown = false;
      }
      this.exemplarPath.setAttribute("d", exemplar ? pathForTrace(exemplar) : "");
      this.render();
    }

    firstVisibleValue() {
      const trace = this.editor.trace();
      const first = trace.find((value) => value !== Model.EMPTY);
      return first == null ? Model.quantizeY(this.graphType === "xt" ? 0.12 : 0.5) : first;
    }

    updateAxes() {
      const zeroY = this.graphType === "xt" ? PLOT.bottom : PLOT.top + PLOT.height / 2;
      const axis = this.svg.querySelector(".time-axis");
      axis.setAttribute("y1", zeroY);
      axis.setAttribute("y2", zeroY);
      axis.setAttribute("x2", "674");
      this.svg.querySelector(".time-arrow").setAttribute(
        "points", `696,${zeroY} 674,${zeroY - 11} 674,${zeroY + 11}`
      );
      const label = this.svg.querySelector(".time-label");
      label.setAttribute("y", zeroY + 36);
      this.svg.querySelector(".vertical-label").textContent = this.graphType[0];
      const signed = this.graphType !== "xt";
      this.svg.querySelector(".zero-label").style.display = signed ? "" : "none";
      this.svg.querySelector(".start-marker").style.display = this.graphType === "xt" ? "" : "none";
      this.surface.setAttribute("aria-label", this.locked
        ? `${Tasks.GRAPH_LABELS[this.graphType]}只讀圖像。顯示已提交的原始圖線及一個可接受例子。`
        : `${Tasks.GRAPH_LABELS[this.graphType]}可編輯作圖板。空白鍵切換畫筆，方向鍵移動，Delete 擦除，Control Z 復原。`);
    }

    updatePhases() {
      this.phaseLayer.replaceChildren();
      if (!this.composite) return;
      for (let index = 0; index < 4; index += 1) {
        const x = PLOT.left + index * PLOT.width / 4;
        const rect = createSvgElement("rect", {
          x, y: PLOT.top, width: PLOT.width / 4, height: PLOT.height,
          class: `phase-band phase-${index}`
        });
        if (index % 2) rect.setAttribute("opacity", ".15");
        this.phaseLayer.append(rect);
        const label = createSvgElement("text", {
          x: x + PLOT.width / 8, y: 30
        });
        label.textContent = ["A 勻加速", "B 勻速", "C 勻減速", "D 靜止"][index];
        this.phaseLayer.append(label);
        if (index > 0) {
          this.phaseLayer.append(createSvgElement("line", {
            class: "phase-divider", x1: x, x2: x, y1: PLOT.top, y2: PLOT.bottom
          }));
        }
      }
    }

    render() {
      const trace = this.editor.trace();
      this.studentPath.setAttribute("d", pathForTrace(trace));
      this.surface.classList.toggle("is-erasing", activeTool === "erase");
      this.updateCompletenessHint(trace);
      this.renderCursor();
      this.board.classList.toggle("is-drawing", this.editor.active);
      this.syncHistoryButtons();
      return trace;
    }

    syncHistoryButtons() {
      if (this.locked) return;
      const scope = this.practice ? elements.practiceSection : elements.taskSection;
      if (!scope) return;
      const empty = this.editor.trace().every((value) => value === Model.EMPTY);
      const undo = scope.querySelector('[data-action="undo"]');
      const redo = scope.querySelector('[data-action="redo"]');
      const clear = scope.querySelector('[data-action="clear"]');
      if (undo) undo.disabled = !this.editor.canUndo;
      if (redo) redo.disabled = !this.editor.canRedo;
      if (clear) clear.disabled = empty;
    }

    updateCompletenessHint(trace) {
      if (!this.completenessHint) return;
      const occupied = [];
      trace.forEach((value, index) => {
        if (value !== Model.EMPTY) occupied.push(index);
      });
      let longestGap = 0;
      for (let index = 1; index < occupied.length; index += 1) {
        longestGap = Math.max(longestGap, occupied[index] - occupied[index - 1] - 1);
      }
      const unfinished = occupied.length > 0 && (
        occupied[0] > 5 ||
        occupied[occupied.length - 1] < Model.DRAW_BINS - 6 ||
        longestGap > 4
      );
      this.completenessHint.classList.toggle(
        "is-hidden",
        this.practice || this.locked || this.editor.active || !unfinished
      );
    }

    renderCursor() {
      const x = PLOT.left + this.keyboardBin / (Model.DRAW_BINS - 1) * PLOT.width;
      const y = PLOT.bottom - this.keyboardValue / Model.MAX_VALUE * PLOT.height;
      this.cursorX.setAttribute("x1", x); this.cursorX.setAttribute("x2", x);
      this.cursorY.setAttribute("y1", y); this.cursorY.setAttribute("y2", y);
      this.cursorDot.setAttribute("cx", x); this.cursorDot.setAttribute("cy", y);
    }

    sample(event) {
      return Model.pointToSample(event.clientX, event.clientY, this.surface.getBoundingClientRect());
    }

    eraseRadius() {
      const width = this.surface.getBoundingClientRect().width;
      const pixels = matchMedia("(pointer: coarse)").matches ? 12 : 9;
      return Math.max(1, Math.round(pixels / Math.max(width, 1) * (Model.DRAW_BINS - 1)));
    }

    pointerDown(event) {
      if (this.locked || event.isPrimary === false || this.editor.active || event.button > 0) return;
      pointerDiagnostics.down += 1;
      if (event.isTrusted && event.pointerType === "touch") pointerDiagnostics.trustedTouch += 1;
      const sample = this.sample(event);
      if (!this.editor.begin(event.pointerId, sample, {
        isPrimary: event.isPrimary,
        mode: activeTool,
        radiusBins: activeTool === "erase" ? this.eraseRadius() : 0
      })) return;
      this.surface.setPointerCapture(event.pointerId);
      event.preventDefault();
      this.render();
    }

    pointerMove(event) {
      if (!this.editor.active || event.pointerId !== this.editor.activePointerId) return;
      pointerDiagnostics.move += 1;
      const sample = this.sample(event);
      this.editor.move(event.pointerId, sample, { radiusBins: activeTool === "erase" ? this.eraseRadius() : 0 });
      event.preventDefault();
      this.render();
    }

    pointerUp(event) {
      if (event.pointerId !== this.editor.activePointerId) return;
      pointerDiagnostics.up += 1;
      const changed = this.editor.commit(event.pointerId);
      if (this.surface.hasPointerCapture?.(event.pointerId)) this.surface.releasePointerCapture(event.pointerId);
      this.render();
      if (changed) this.commitChange();
    }

    pointerCancel(event, announceCancellation = false) {
      if (!this.editor.active || event.pointerId !== this.editor.activePointerId) return;
      pointerDiagnostics.cancel += 1;
      this.editor.cancel(event.pointerId);
      if (this.surface.hasPointerCapture?.(event.pointerId)) this.surface.releasePointerCapture(event.pointerId);
      this.render();
      if (announceCancellation) announce("操作中斷；未完成的筆劃已安全取消。");
    }

    commitChange() {
      if (typeof this.onCommit === "function") this.onCommit(this.editor.trace());
    }

    undo() {
      if (this.locked || !this.editor.undo()) return false;
      this.render(); this.commitChange(); return true;
    }

    redo() {
      if (this.locked || !this.editor.redo()) return false;
      this.render(); this.commitChange(); return true;
    }

    clear() {
      if (this.locked || !this.editor.clear()) return false;
      this.render(); this.commitChange(); return true;
    }

    keyDown(event) {
      if (this.locked) return;
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";
      if (shortcut) {
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault(); this.redo(); return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (this.keyboardPenDown) {
          const changed = this.editor.commit("keyboard");
          this.keyboardPenDown = false;
          if (changed) this.commitChange();
        } else {
          this.keyboardPenDown = this.editor.begin("keyboard", {
            bin: this.keyboardBin, value: this.keyboardValue
          }, { mode: activeTool, radiusBins: activeTool === "erase" ? 1 : 0 });
        }
        this.board.classList.add("has-keyboard-cursor");
        this.render();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault(); this.cancelKeyboard(true); return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (this.keyboardPenDown) this.cancelKeyboard(false);
        if (this.editor.begin("keyboard-delete", { bin: this.keyboardBin, value: this.keyboardValue }, { mode: "erase", radiusBins: 1 })) {
          const changed = this.editor.commit("keyboard-delete");
          this.render();
          if (changed) this.commitChange();
        }
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const previous = { bin: this.keyboardBin, value: this.keyboardValue };
      const horizontalStep = 4;
      const verticalStep = Math.round(Model.MAX_VALUE * (event.shiftKey ? 4 : 1) / 24);
      if (event.key === "ArrowLeft") this.keyboardBin = Math.max(0, this.keyboardBin - horizontalStep);
      if (event.key === "ArrowRight") this.keyboardBin = Math.min(Model.DRAW_BINS - 1, this.keyboardBin + horizontalStep);
      if (event.key === "ArrowUp") this.keyboardValue = Math.min(Model.MAX_VALUE, this.keyboardValue + verticalStep);
      if (event.key === "ArrowDown") this.keyboardValue = Math.max(0, this.keyboardValue - verticalStep);
      if (this.keyboardPenDown) {
        this.editor.move("keyboard", { bin: this.keyboardBin, value: this.keyboardValue }, {
          radiusBins: activeTool === "erase" ? 1 : 0
        });
      }
      this.board.classList.add("has-keyboard-cursor");
      this.render();
      if (previous.bin === this.keyboardBin && previous.value === this.keyboardValue) announce("游標已到達圖板邊界。");
    }

    cancelKeyboard(withAnnouncement) {
      if (!this.keyboardPenDown) return;
      this.editor.cancel("keyboard");
      this.keyboardPenDown = false;
      this.render();
      if (withAnnouncement) announce("未完成的鍵盤筆劃已取消。");
    }

    cancelActive(withAnnouncement) {
      if (this.editor.activePointerId === "keyboard") return this.cancelKeyboard(withAnnouncement);
      if (this.editor.active) {
        const id = this.editor.activePointerId;
        this.editor.cancel(id);
        if (this.surface.hasPointerCapture?.(id)) this.surface.releasePointerCapture(id);
        this.render();
        if (withAnnouncement) announce("操作中斷；未完成的筆劃已安全取消。");
      }
    }

    trace() { return this.editor.trace(); }
  }

  const practiceView = new GraphView(elements.practiceMount, null, { practice: true });
  practiceView.configure({ graphType: "vt", trace: Model.createTrace(), key: "practice" });
  const taskView = new GraphView(elements.taskMount, (trace) => commitTaskTrace(trace));
  const resultView = new GraphView(elements.resultGraphMount, null, { locked: true });

  function activeView() {
    if (!elements.practiceSection.classList.contains("is-hidden")) return practiceView;
    if (!elements.taskSection.classList.contains("is-hidden")) return taskView;
    return null;
  }

  function updateToolButtons() {
    document.querySelectorAll("[data-tool]").forEach((button) => {
      const active = button.dataset.tool === activeTool;
      button.setAttribute("aria-pressed", String(active));
    });
    [practiceView, taskView].forEach((view) => {
      view.surface.classList.toggle("is-erasing", activeTool === "erase");
    });
  }

  document.addEventListener("click", (event) => {
    const toolButton = event.target.closest("[data-tool]");
    if (toolButton) {
      activeTool = toolButton.dataset.tool === "erase" ? "erase" : "pen";
      updateToolButtons();
      announce(activeTool === "erase" ? "已選擇橡皮擦。" : "已選擇畫筆。");
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const view = activeView();
    if (!view || locked) return;
    if (actionButton.dataset.action === "undo") view.undo();
    if (actionButton.dataset.action === "redo") view.redo();
    if (actionButton.dataset.action === "clear" && view.clear()) {
      announce("已清除圖線；可按「復原上一步」取回。");
    }
  });

  function draftSnapshot() {
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(state));
  }

  function saveDraft() {
    if (locked || mode !== "activity") return false;
    try {
      if (!window.SimScorm.saveDraft(draftSnapshot())) throw new Error("Draft save rejected");
      return true;
    } catch (error) {
      console.warn(error);
      locked = true;
      showTechnical("未能保存目前進度；作圖操作已鎖定。", false);
      return false;
    }
  }

  function commitTaskTrace(trace) {
    if (locked || state?.phase !== "task") return;
    const answer = trace.some((value) => value !== Model.EMPTY) ? trace : null;
    const next = Persistence.setAnswer(state, state.taskIndex, answer);
    if (!next) return showTechnical("未能建立有效圖線記錄；作圖操作已鎖定。", false);
    state = next;
    if (saveDraft()) {
      renderProgress();
      renderGraphTabs();
    }
  }

  function renderProgress() {
    const current = state?.phase === "practice" ? "practice" :
      state?.phase === "review" ? "review" :
        state?.phase === "task" ? Tasks.TASKS[state.taskIndex].scenarioId : "review";
    document.querySelectorAll("[data-progress]").forEach((item) => {
      const key = item.dataset.progress;
      item.classList.toggle("is-current", key === current);
      const order = ["practice", "uniform", "accelerating", "decelerating", "composite", "review"];
      item.classList.toggle("is-done", order.indexOf(key) < order.indexOf(current));
    });
  }

  function setVisible(section) {
    [elements.practiceSection, elements.taskSection, elements.reviewSection, elements.resultSection].forEach((candidate) => {
      candidate.classList.toggle("is-hidden", candidate !== section);
    });
    elements.controlsPanel.scrollTop = 0;
  }

  function setStage(mount) {
    [elements.practiceMount, elements.taskMount, elements.resultGraphMount].forEach((candidate) => {
      candidate.classList.toggle("is-hidden", candidate !== mount);
    });
    const hidden = !mount;
    elements.stageRegion.classList.toggle("is-hidden", hidden);
    if (mount !== elements.taskMount) elements.stageCompletenessHint.classList.add("is-hidden");
    document.querySelector(".graph-app").classList.toggle("no-stage", hidden);
  }

  function renderPractice() {
    setVisible(elements.practiceSection);
    setStage(elements.practiceMount);
    renderProgress();
    practiceView.locked = locked;
    focusHeading(elements.practiceTitle);
  }

  function renderGraphTabs() {
    if (state?.phase !== "task") return;
    const task = Tasks.TASKS[state.taskIndex];
    const scenarioTasks = Tasks.displayTasksForScenario(task.scenarioId);
    const buttons = scenarioTasks.map((item) => {
      const index = Tasks.taskIndexById(item.id);
      const complete = Boolean(state.answers[index]);
      const visited = Boolean(state.visitedMask & (1 << index));
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.switchTask = String(index);
      button.setAttribute("aria-pressed", String(index === state.taskIndex));
      button.className = `${complete ? "is-complete" : ""} ${visited ? "is-visited" : ""}`.trim();
      const status = complete ? "，已有圖線" : visited ? "，未完成" : "，未開啟";
      button.setAttribute("aria-label", `${Tasks.GRAPH_LABELS[item.graphType]}${status}`);
      const symbol = document.createElement("span");
      symbol.className = "graph-tab-symbol";
      setPhysicsText(symbol, `${item.graphType[0]}–t`);
      const name = document.createElement("span");
      name.className = "graph-tab-name";
      name.textContent = item.graphType === "xt" ? "位置—時間" :
        item.graphType === "vt" ? "速度—時間" : "加速度—時間";
      button.append(symbol, name);
      return button;
    });
    elements.graphTabs.replaceChildren(...buttons);
  }

  function renderTask() {
    setVisible(elements.taskSection);
    setStage(elements.taskMount);
    renderProgress();
    const task = Tasks.TASKS[state.taskIndex];
    elements.scenarioKicker.textContent = `第 ${task.scenarioNumber} 關`;
    elements.scenarioTitle.textContent = task.title;
    elements.scenarioPrompt.textContent = task.prompt;
    setPhysicsText(elements.graphLabel, task.graphLabel);
    const displayPosition = Tasks.displayTasksForScenario(task.scenarioId)
      .findIndex((item) => item.id === task.id) + 1;
    elements.taskCounter.textContent = `第 ${task.scenarioNumber} 關 · 第 ${displayPosition} / 3 幅`;
    elements.graphRequirement.textContent = task.scenarioId === "composite"
      ? task.graphType === "xt"
        ? "由左端的起點標記開始，畫到最右端，完整表達 A、B、C、D 四個階段。"
        : "由圖板左邊界開始，畫到最右端，完整表達 A、B、C、D 四個階段。"
      : task.graphType === "xt"
        ? "由左端的起點標記開始，畫到最右端，表達完整作圖時間。"
        : "由圖板左邊界開始，畫到最右端，表達完整作圖時間。";
    renderGraphTabs();
    const trace = state.answers[state.taskIndex] ? Model.decodeTrace(state.answers[state.taskIndex]) : Model.createTrace();
    taskView.configure({
      graphType: task.graphType,
      composite: task.scenarioId === "composite",
      trace,
      locked,
      key: `task:${state.taskIndex}`
    });
    const scenarioTasks = Tasks.displayTasksForScenario(task.scenarioId);
    const allVisited = scenarioTasks.every((item) =>
      Boolean(state.visitedMask & (1 << Tasks.taskIndexById(item.id))));
    elements.nextButton.textContent = state.variant === "review-edit"
      ? "返回檢查" : allVisited
        ? task.scenarioNumber === Tasks.SCENARIOS.length ? "前往檢查" : "下一關"
        : "下一幅";
    formatPhysicsNotation(elements.taskSection);
    focusHeading(elements.scenarioTitle);
  }

  function reviewResultNow() {
    return Scoring.scoreActivity(state.answers);
  }

  function renderReview() {
    setVisible(elements.reviewSection);
    setStage(null);
    renderProgress();
    const result = reviewResultNow();
    const incompleteCount = result.evidenceIncompleteTaskIds.length;
    elements.reviewWarning.textContent = incompleteCount
      ? `仍有 ${incompleteCount} 幅圖空白、覆蓋不足或不可判讀；如現在提交，這些圖的可評證據會不足。`
      : "十二幅圖均可判讀。你仍可返回任何一幅修改。";
    elements.reviewList.innerHTML = Tasks.SCENARIOS.map((scenario) => {
      const cards = Tasks.displayTasksForScenario(scenario.id).map((task) => {
        const index = Tasks.taskIndexById(task.id);
        const taskResult = result.taskResults[index];
        const status = state.answers[index] == null ? "空白" :
          !taskResult.evidenceComplete ? taskResult.evidenceReason : "已有完整圖線";
        const className = !taskResult.evidenceComplete ? "is-invalid" : "is-ready";
        return `<button type="button" class="review-task ${className}" data-edit-task="${index}">
          <strong>${escapeHtml(task.graphLabel)}</strong><span>${status}；按此修改</span></button>`;
      }).join("");
      return `<section class="review-scenario"><h3>第 ${scenario.number} 關：${escapeHtml(scenario.title)}</h3>
        <div class="review-task-grid">${cards}</div></section>`;
    }).join("");
    formatPhysicsNotation(elements.reviewSection);
    focusHeading(elements.reviewTitle);
  }

  function render() {
    if (mode !== "activity") return;
    if (state.phase === "practice") renderPractice();
    else if (state.phase === "task") renderTask();
    else renderReview();
  }

  elements.startChallengeButton.addEventListener("click", () => {
    if (locked || state.phase !== "practice") return;
    activeTool = "pen";
    updateToolButtons();
    const next = Persistence.startTasks(state);
    if (!next) return showTechnical("未能開始挑戰；活動已鎖定。", false);
    state = next;
    if (saveDraft()) render();
  });

  elements.graphTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-switch-task]");
    if (!button || locked || state.phase !== "task") return;
    taskView.cancelActive(false);
    commitTaskTrace(taskView.trace());
    const next = Persistence.switchTask(state, Number(button.dataset.switchTask));
    if (!next || next.taskIndex === state.taskIndex) return;
    state = next;
    if (saveDraft()) render();
  });

  elements.nextButton.addEventListener("click", () => {
    if (locked || state.phase !== "task") return;
    taskView.cancelActive(false);
    const next = Persistence.nextTask(state);
    if (!next) return;
    state = next;
    if (saveDraft()) render();
  });

  elements.reviewList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-task]");
    if (!button || locked || state.phase !== "review") return;
    const next = Persistence.openReviewEdit(state, Number(button.dataset.editTask));
    if (!next) return;
    state = next;
    if (saveDraft()) render();
  });

  function sameResult(left, right) {
    return validResultMetadata(left) && validResultMetadata(right) &&
      left.score === right.score && left.maxScore === right.maxScore && left.passed === right.passed;
  }

  function validResultMetadata(result) {
    return Boolean(result && Number.isFinite(result.score) && Number.isFinite(result.maxScore) &&
      result.maxScore > 0 && result.score >= 0 && result.score <= result.maxScore &&
      typeof result.passed === "boolean");
  }

  function makeReviewSnapshot(review, result) {
    if (!validResultMetadata(result)) throw new Error("Invalid final result metadata");
    const snapshot = window.SimScorm.makeSnapshot(ACTIVITY, "review", review, result);
    snapshot.maxScore = result.maxScore;
    if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 4000) {
      throw new Error("Final review snapshot exceeds 4000 bytes");
    }
    return snapshot;
  }

  function sameReview(left, right) {
    return Boolean(left && right && JSON.stringify(left.answers) === JSON.stringify(right.answers));
  }

  function validatePendingSnapshot(snapshot) {
    try {
      if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== "pending-final") return null;
      const payload = snapshot.payload;
      if (!payload || typeof payload.reviewJson !== "string" || !validResultMetadata(payload)) return null;
      const reviewSnapshot = JSON.parse(payload.reviewJson);
      if (reviewSnapshot?.version !== 1 || reviewSnapshot.activity !== ACTIVITY || reviewSnapshot.kind !== "review") return null;
      const review = Persistence.decodeReview(reviewSnapshot.answer);
      if (!review) return null;
      const computed = Scoring.scoreActivity(review.answers);
      const canonical = makeReviewSnapshot(Persistence.makeReview(Persistence.reviewToState(review)), computed);
      const payloadResult = { score: payload.score, maxScore: payload.maxScore, passed: payload.passed };
      const savedResult = {
        score: reviewSnapshot.score,
        maxScore: reviewSnapshot.maxScore,
        passed: reviewSnapshot.passed
      };
      return JSON.stringify(canonical) === payload.reviewJson &&
        sameResult(computed, payloadResult) && sameResult(computed, savedResult) ? { review, computed } : null;
    } catch {
      return null;
    }
  }

  function submitAll() {
    if (locked || state.phase !== "review") return;
    const current = Scoring.scoreActivity(state.answers);
    const incomplete = current.evidenceIncompleteTaskIds.length > 0;
    if (incomplete &&
        !window.confirm("仍有空白、覆蓋不足或不可判讀圖線，這些部分的可評證據不足。仍然提交？")) return;
    let reviewAnswer, snapshot;
    try {
      reviewAnswer = Persistence.makeReview(state);
      snapshot = makeReviewSnapshot(reviewAnswer, current);
      pendingExpected = { review: Persistence.decodeReview(reviewAnswer), computed: current };
      if (!pendingExpected.review) throw new Error("Final review validation failed");
    } catch (error) {
      console.warn(error);
      showTechnical("未能建立可驗證的提交記錄；答案尚未提交。", false);
      return;
    }
    locked = true;
    const handle = (outcome) => UiPolicy.submission(outcome, {
      success: () => showSubmitted(pendingExpected.review, current, true),
      committed: () => {
        retryMode = "finish";
        showSubmitted(pendingExpected.review, current, true, UiPolicy.technicalCopy("committed"));
      },
      frozen: () => {
        retryMode = "pending";
        showTechnical(UiPolicy.technicalCopy("pending"), true);
      },
      retry: (failure) => {
        locked = !failure.retryable;
        retryMode = failure.retryable ? "submit" : "none";
        mode = "activity";
        renderReview();
        elements.reviewWarning.textContent = failure.retryable
          ? "未能確認提交；答案仍可修改或重試。"
          : "提交前檢查失敗；目前操作已鎖定。";
        elements.submissionRetryButton.classList.toggle("is-hidden", !failure.retryable);
        announce(elements.reviewWarning.textContent);
      }
    });
    window.SimScorm.submitWithCallbacks(current, snapshot, { onSuccess: handle, onFailure: handle });
  }

  elements.submitButton.addEventListener("click", submitAll);

  function retrySubmission() {
    if (retryMode === "finish") {
      if (window.SimScorm.finish()) {
        elements.resultNotice.classList.add("is-hidden");
        retryMode = "none";
        announce("Moodle 工作階段已完成。");
      } else {
        elements.resultNotice.textContent = UiPolicy.technicalCopy("committed");
        elements.resultNotice.classList.remove("is-hidden");
      }
      return;
    }
    if (retryMode === "submit") {
      locked = false;
      return submitAll();
    }
    if (retryMode !== "pending") return;
    const outcome = window.SimScorm.retryPending();
    if (!outcome.committed) {
      showTechnical("仍未能確認提交；十二幅圖保持凍結。", Boolean(outcome.retryable));
      return;
    }
    const review = outcome.review?.activity === ACTIVITY && outcome.review?.kind === "review"
      ? Persistence.decodeReview(outcome.review.answer) : null;
    const computed = review ? Scoring.scoreActivity(review.answers) : null;
    const recorded = {
      score: outcome.score,
      maxScore: pendingExpected?.computed?.maxScore,
      passed: outcome.status === "passed" ? true : outcome.status === "failed" ? false : null
    };
    if (!review || !sameResult(computed, recorded) ||
        pendingExpected && (!sameResult(computed, pendingExpected.computed) || !sameReview(review, pendingExpected.review))) {
      return showTechnical("提交資料與圖線記錄不一致，無法安全顯示結果。", false);
    }
    retryMode = outcome.finished ? "none" : "finish";
    showSubmitted(review, computed, true, outcome.finished ? "" : UiPolicy.technicalCopy("committed"));
  }

  elements.submissionRetryButton.addEventListener("click", retrySubmission);
  elements.resultRetryButton.addEventListener("click", retrySubmission);

  function renderResultGraph() {
    const task = Tasks.TASKS[resultTaskIndex];
    const review = pendingExpected?.review;
    const trace = review?.answers[resultTaskIndex] ? Model.decodeTrace(review.answers[resultTaskIndex]) : Model.createTrace();
    const exemplar = Scoring.exemplarTrace(task.id);
    resultView.configure({
      graphType: task.graphType,
      composite: task.scenarioId === "composite",
      trace,
      exemplar,
      locked: true,
      key: `result:${resultTaskIndex}:${trustedReview}`
    });
    const taskResult = submittedResult?.taskResults?.[resultTaskIndex];
    if (!trustedReview || !taskResult) {
      elements.resultFeedback.innerHTML = `<section><h3>${escapeHtml(task.graphLabel)}</h3>
        <p>${escapeHtml(UiPolicy.technicalCopy("review-fallback"))}</p></section>`;
      formatPhysicsNotation(elements.resultFeedback);
      return;
    }
    elements.resultFeedback.innerHTML = `<section>
      <h3>${escapeHtml(task.graphLabel)}：${taskResult.score.toFixed(1)} / ${taskResult.maxScore}</h3>
      ${taskResult.feedback.map((message) => `<p>${escapeHtml(message)}</p>`).join("")}
      <p class="example-key">一個可接受例子</p>
    </section>`;
    formatPhysicsNotation(elements.resultFeedback);
  }

  function renderResultTabs() {
    const displayTasks = Tasks.SCENARIOS.flatMap((scenario) => Tasks.displayTasksForScenario(scenario.id));
    const buttons = displayTasks.map((task) => {
      const index = Tasks.taskIndexById(task.id);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.resultTask = String(index);
      button.setAttribute("aria-pressed", String(index === resultTaskIndex));
      setPhysicsText(button, `第 ${task.scenarioNumber} 關 ${task.graphLabel}`);
      return button;
    });
    elements.resultTabs.replaceChildren(...buttons);
  }

  elements.resultTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-result-task]");
    if (!button) return;
    resultTaskIndex = Number(button.dataset.resultTask);
    renderResultTabs();
    renderResultGraph();
  });

  function showSubmitted(review, result, trust, notice = "") {
    mode = "submitted";
    locked = true;
    trustedReview = trust;
    pendingExpected = { review, computed: result };
    submittedResult = result;
    resultTaskIndex = Tasks.taskIndexById(`${Tasks.SCENARIOS[0].id}-${Tasks.DISPLAY_GRAPH_TYPES[0]}`);
    retryMode = notice ? retryMode : "none";
    setVisible(elements.resultSection);
    setStage(elements.resultGraphMount);
    elements.resultTitle.textContent = "已提交結果";
    const completion = window.SimActivityFlow.completionLabel(result.passed);
    const contradictionSummary = result.contradictions.length
      ? `<section class="contradiction-box"><strong>三圖關係提示</strong><ul>${result.contradictions
        .map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul></section>` : "";
    elements.scorePanel.innerHTML = `<strong>${result.score} / 100</strong><p>${escapeHtml(completion)}；綜合關 ${result.compositeScore.toFixed(1)} / 35</p>
      <p>x–t ${result.categoryScores.xt.toFixed(1)} / 36；v–t ${result.categoryScores.vt.toFixed(1)} / 32；a–t ${result.categoryScores.at.toFixed(1)} / 32</p>
      ${result.masteryFailures.length ? `<p>尚未掌握：${result.masteryFailures.map((failure) => escapeHtml(failure.label)).join("；")}</p>` : ""}
      ${contradictionSummary}`;
    formatPhysicsNotation(elements.scorePanel);
    elements.resultNotice.textContent = notice;
    elements.resultNotice.classList.toggle("is-hidden", !notice);
    elements.resultRetryButton.classList.toggle("is-hidden", !notice);
    renderResultTabs();
    renderResultGraph();
    formatPhysicsNotation(elements.resultSection);
    focusHeading(elements.resultTitle);
  }

  function showReviewFallback(attempt) {
    mode = "submitted";
    locked = true;
    trustedReview = false;
    submittedResult = null;
    pendingExpected = { review: { answers: Persistence.emptyAnswers() }, computed: null };
    setVisible(elements.resultSection);
    setStage(null);
    elements.resultTitle.textContent = "已完成活動";
    const recorded = window.SimActivityFlow.recordedResult(attempt);
    elements.scorePanel.innerHTML = `<strong>${recorded.score == null ? "--" : `${recorded.score} / 100`}</strong>
      <p>${escapeHtml(window.SimActivityFlow.completionLabel(recorded.passed))}</p>`;
    elements.resultNotice.textContent = UiPolicy.technicalCopy("review-fallback");
    elements.resultNotice.classList.remove("is-hidden");
    elements.resultRetryButton.classList.add("is-hidden");
    elements.resultTabs.replaceChildren();
    elements.resultFeedback.innerHTML = `<section><p>${escapeHtml(UiPolicy.technicalCopy("review-fallback"))}</p></section>`;
    formatPhysicsNotation(elements.resultSection);
    focusHeading(elements.resultTitle);
  }

  function restoreFinished(attempt) {
    const snapshot = attempt.snapshot;
    const review = snapshot?.activity === ACTIVITY && snapshot.kind === "review"
      ? Persistence.decodeReview(snapshot.answer) : null;
    if (!review) return showReviewFallback(attempt);
    const computed = Scoring.scoreActivity(review.answers);
    const trust = UiPolicy.reviewOutcome(
      computed,
      { score: snapshot.score, maxScore: snapshot.maxScore, passed: snapshot.passed },
      attempt
    );
    if (!trust.trusted) return showReviewFallback(attempt);
    pendingExpected = { review, computed };
    showSubmitted(review, computed, true);
  }

  function showTechnical(message, retryable) {
    mode = "technical";
    locked = true;
    setVisible(elements.resultSection);
    setStage(null);
    elements.resultTitle.textContent = "技術狀態";
    const technical = UiPolicy.technicalResult(retryMode === "pending" ? "pending" : "technical");
    elements.scorePanel.innerHTML = `<strong>${technical.score}</strong><p>${escapeHtml(technical.completion)}</p>`;
    elements.resultNotice.textContent = message || technical.message;
    elements.resultNotice.classList.remove("is-hidden");
    elements.resultTabs.replaceChildren();
    elements.resultFeedback.replaceChildren();
    elements.resultRetryButton.classList.toggle("is-hidden", !retryable);
    announce(message || technical.message);
    focusHeading(elements.resultTitle);
  }

  function cancelActiveOperations() {
    practiceView.cancelActive(true);
    taskView.cancelActive(true);
  }

  window.addEventListener("blur", cancelActiveOperations);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelActiveOperations();
  });

  const attempt = window.SimScorm.loadAttempt(ACTIVITY);
  const startup = window.SimActivityFlow.startup(attempt);
  const startupMode = UiPolicy.startupMode(startup);
  if (startupMode === "review") {
    restoreFinished(attempt);
  } else if (startupMode === "activity") {
    try {
      state = attempt.state === "draft" ? Persistence.decode(attempt.snapshot?.answer) : Persistence.initialState();
      if (!state) throw new Error("Invalid editable draft");
      mode = "activity";
      locked = false;
      window.SimScorm.setDraftProvider(() => draftSnapshot());
      if (attempt.state === "new" && !saveDraft()) throw new Error("Initial draft save failed");
      render();
    } catch (error) {
      console.warn(error);
      state = Persistence.initialState();
      showTechnical(UiPolicy.technicalCopy("technical"), false);
    }
  } else if (startupMode === "pending") {
    pendingExpected = validatePendingSnapshot(attempt.snapshot);
    retryMode = pendingExpected ? "pending" : "none";
    if (!pendingExpected) window.SimScorm.quarantinePending();
    showTechnical(pendingExpected ? UiPolicy.technicalCopy("pending") :
      "待確認的提交資料與圖線記錄不一致，操作已鎖定。", Boolean(pendingExpected));
  } else {
    showTechnical(UiPolicy.technicalCopy("technical"), false);
  }

  formatPhysicsNotation(elements.controlsPanel);
  updateToolButtons();
  window.__kinematicsGraphDebug = {
    getState: () => state ? JSON.parse(JSON.stringify(state)) : null,
    getMode: () => mode,
    getActiveTrace: () => activeView()?.trace() || null,
    getPointerDiagnostics: () => ({ ...pointerDiagnostics }),
    score: () => state ? Scoring.scoreActivity(state.answers) : null
  };
})();
