(function () {
  "use strict";

  const svg = document.getElementById("diagram");
  const arrowLayer = document.getElementById("arrowLayer");
  const scorePanel = document.getElementById("scorePanel");
  const forceButtons = document.querySelectorAll("[data-force][data-action]");
  const forceCounts = document.querySelectorAll("[data-force-count]");
  const submitButton = document.getElementById("submitDiagram");
  const stage = svg.closest(".sim-stage");
  const magnifier = createMagnifier();

  const MAX_FORCE_PER_TYPE = 2;
  const ACTIVITY = "fbd-horizontal-block";
  const block = { x: 240, y: 210, width: 160, height: 90 };
  const center = { x: block.x + block.width / 2, y: block.y + block.height / 2 };
  const state = {
    arrows: [],
    nextId: 1,
    selectedType: null,
    selectedId: null,
    drag: null,
    locked: false
  };

  const forceColors = {
    weight: "var(--force-weight)",
    normal: "var(--force-normal)",
    applied: "var(--force-applied)",
    friction: "var(--force-friction)",
    tension: "var(--force-tension)"
  };

  function changeForceCount(type, delta) {
    if (state.locked) return;
    if (delta > 0) {
      addForce(type);
    } else {
      removeForce(type);
    }
    normalizeSlots(type);
    render();
    saveDraft();
  }

  function addForce(type) {
    if (arrowsOfType(type).length >= MAX_FORCE_PER_TYPE) return;
    const arrow = {
      id: state.nextId,
      type,
      slot: String(arrowsOfType(type).length + 1),
      start: { ...center },
      end: randomEndPoint(type)
    };
    state.arrows.push(arrow);
    state.nextId += 1;
    state.selectedType = type;
    state.selectedId = arrow.id;
  }

  function removeForce(type) {
    const arrow = lastArrowOfType(type);
    if (!arrow) return;
    state.arrows = state.arrows.filter((item) => item.id !== arrow.id);
    const remaining = lastArrowOfType(type);
    state.selectedType = remaining ? type : null;
    state.selectedId = remaining ? remaining.id : null;
  }

  function arrowsOfType(type) {
    return state.arrows
      .filter((arrow) => arrow.type === type)
      .sort((a, b) => Number(a.slot) - Number(b.slot));
  }

  function lastArrowOfType(type) {
    const arrows = arrowsOfType(type);
    return arrows[arrows.length - 1];
  }

  function normalizeSlots(type) {
    arrowsOfType(type).forEach((arrow, index) => {
      arrow.slot = String(index + 1);
    });
  }

  function randomEndPoint(type) {
    const length = 115;
    const expected = window.FbdScoring.FORCE_TYPES[type].expectedAngle;
    let angle = Math.random() * 360;
    if (Number.isFinite(expected)) {
      while (window.FbdScoring.angleDistance(angle, expected) < 45) {
        angle = Math.random() * 360;
      }
    }
    const radians = angle * Math.PI / 180;
    return {
      x: center.x + Math.cos(radians) * length,
      y: center.y + Math.sin(radians) * length
    };
  }

  function submitDiagram() {
    if (state.locked) return;
    if (state.arrows.length === 0 && !window.confirm("你尚未加入任何力，仍要提交嗎？")) return;
    const result = window.FbdScoring.scoreDiagram(state.arrows, block);
    scorePanel.replaceChildren(
      textBlock("div", "目前分數"),
      textBlock("div", String(result.score), "score-value"),
      textBlock("div", result.passed ? "已通過" : "未通過")
    );
    const list = document.createElement("ul");
    list.className = "feedback-list";
    result.feedbackItems.forEach((item) => {
      list.append(textBlock("li", item.text, `feedback-item ${item.status}`));
    });
    scorePanel.append(list, textBlock("div", result.summary, "muted feedback-summary"));
    const handle = (submission) => window.SimActivityFlow.submission(submission, {
      success: () => lockAttempt("此作答次已提交。如要重新作答，請返回活動入口並開始新的作答次。"),
      committed: () => lockAttempt("成績已保存；Moodle session 會在離開頁面時再次完成。"),
      frozen: () => lockAttempt("提交狀態未確認；答案已凍結，請重新開啟活動再試。"),
      retry: () => scorePanel.append(textBlock("div", "未能傳送到 Moodle，請重試。", "feedback-item wrong"))
    });
    window.SimScorm.submitWithCallbacks(result, reviewState(result), { onFailure: handle, onSuccess: handle });
  }

  function reviewState(result) {
    return window.SimScorm.makeSnapshot(ACTIVITY, "review", { arrows: snapshotArrows() }, result);
  }

  function snapshotArrows() {
    return state.arrows.map((arrow) => ({
        type: arrow.type,
        slot: arrow.slot,
        start: arrow.start,
        end: arrow.end
      }));
  }

  function draftState() {
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", { arrows: snapshotArrows() });
  }

  function saveDraft() {
    if (!state.locked) window.SimScorm.saveDraft(draftState());
  }

  function lockAttempt(message) {
    state.locked = true;
    state.drag = null;
    state.selectedId = null;
    forceButtons.forEach((button) => {
      button.disabled = true;
    });
    submitButton.disabled = true;
    if (message) {
      scorePanel.append(textBlock("div", message, "muted feedback-summary"));
    }
  }

  function showSubmittedAttempt(attempt) {
    const review = attempt?.snapshot || attempt?.review || null;
    let result = null;
    if (review?.answer?.arrows && restoreArrows(review.answer.arrows)) {
      state.nextId = state.arrows.length + 1;
      Object.keys(forceColors).forEach(normalizeSlots);
      render();
      const rescored = window.FbdScoring.scoreDiagram(state.arrows, block);
      const raw = String(attempt?.score ?? "").trim();
      if (rescored.score === review.score && rescored.passed === review.passed && (!raw || Number(raw) === rescored.score)) result = rescored;
    }
    const score = result?.score ?? (attempt?.score || "--");
    scorePanel.replaceChildren(
      textBlock("div", "此作答次已提交"),
      textBlock("div", score, "score-value"),
      textBlock("div", result ? (result.passed ? "已通過" : "未通過") : "已記錄結果")
    );
    if (result) {
      const list = document.createElement("ul");
      list.className = "feedback-list";
      result.feedbackItems.forEach((item) => {
        list.append(textBlock("li", item.text, `feedback-item ${item.status}`));
      });
      scorePanel.append(list);
      scorePanel.append(textBlock("div", result.summary, "muted feedback-summary"));
    } else {
      scorePanel.append(textBlock("div", "已保存資料無法安全重建或與 Moodle 分數不一致。", "muted feedback-summary"));
    }
    scorePanel.append(textBlock("div", "如要重新作答，請返回活動入口並開始新的作答次。", "muted feedback-summary"));
    lockAttempt();
  }

  function restoreArrows(arrows) {
    const restored = window.FbdScoring.restoreArrowState(arrows);
    if (!restored) return false;
    state.arrows = restored.arrows;
    state.nextId = restored.nextId;
    state.selectedId = null;
    return true;
  }

  function textBlock(tagName, text, className) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function render() {
    renderButtons();
    renderArrows();
    renderMagnifier();
  }

  function renderButtons() {
    forceButtons.forEach((button) => {
      const type = button.dataset.force;
      const count = arrowsOfType(type).length;
      const isAdd = button.dataset.action === "add";
      button.disabled =
        state.locked ||
        (isAdd ? count >= MAX_FORCE_PER_TYPE : count === 0);
    });
    forceCounts.forEach((output) => {
      output.textContent = String(arrowsOfType(output.dataset.forceCount).length);
    });
  }

  function renderArrows() {
    arrowLayer.replaceChildren();
    state.arrows.forEach((arrow) => {
      const selected = arrow.id === state.selectedId;
      const group = svgElement("g", {
        class: selected ? "force-group is-selected" : "force-group"
      });
      const color = forceColors[arrow.type];
      const line = svgElement("line", {
        class: "force-line",
        x1: arrow.start.x,
        y1: arrow.start.y,
        x2: arrow.end.x,
        y2: arrow.end.y,
        stroke: color,
        "marker-end": `url(#arrow-${arrow.type})`,
        "data-id": arrow.id
      });
      const tipHit = svgElement("circle", {
        class: "force-tip-hit",
        cx: arrow.end.x,
        cy: arrow.end.y,
        r: 44,
        "data-id": arrow.id
      });
      const label = svgElement("text", {
        class: "force-label",
        x: (arrow.start.x + arrow.end.x) / 2 + 12,
        y: (arrow.start.y + arrow.end.y) / 2 - 10,
        fill: color
      });
      renderSvgLabel(label, arrow);
      group.append(line, tipHit, label);
      arrowLayer.append(group);
    });
  }

  function createMagnifier() {
    if (!stage) return null;
    const wrapper = document.createElement("div");
    wrapper.className = "fbd-magnifier";
    wrapper.setAttribute("aria-hidden", "true");
    const preview = svgElement("svg", {
      class: "fbd-magnifier-svg",
      viewBox: "0 0 150 150",
      focusable: "false"
    });
    wrapper.append(preview);
    stage.append(wrapper);
    return { wrapper, preview };
  }

  function renderMagnifier() {
    if (!magnifier) return;
    const arrow = state.drag && state.drag.isTouch ? getArrowById(state.drag.id) : null;
    magnifier.wrapper.classList.toggle("is-visible", Boolean(arrow));
    if (!arrow) return;
    const size = 150;
    const half = size / 2;
    const focus = arrow.end;
    magnifier.preview.setAttribute(
      "viewBox",
      `${focus.x - half} ${focus.y - half} ${size} ${size}`
    );
    magnifier.preview.replaceChildren(
      magnifierDefs(),
      svgElement("rect", {
        x: focus.x - half,
        y: focus.y - half,
        width: size,
        height: size,
        fill: "url(#magnifier-grid)"
      }),
      svgElement("rect", {
        x: 76,
        y: 300,
        width: 488,
        height: 38,
        fill: "url(#magnifier-ground-hatch)",
        class: "surface-base"
      }),
      svgElement("line", {
        x1: 76,
        y1: 300,
        x2: 564,
        y2: 300,
        class: "magnifier-surface"
      }),
      svgElement("rect", {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        rx: 6,
        class: "magnifier-block"
      }),
      magnifierArrowLayer(arrow.id)
    );
  }

  function magnifierDefs() {
    const defs = svgElement("defs", {});
    const pattern = svgElement("pattern", {
      id: "magnifier-grid",
      width: 40,
      height: 40,
      patternUnits: "userSpaceOnUse"
    });
    pattern.append(svgElement("path", {
      d: "M 40 0 L 0 0 0 40",
      fill: "none",
      stroke: "var(--grid-line)",
      "stroke-width": 1
    }));
    const groundPattern = svgElement("pattern", {
      id: "magnifier-ground-hatch",
      width: 18,
      height: 18,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(45)"
    });
    groundPattern.append(svgElement("line", {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 18,
      class: "surface-hatch"
    }));
    defs.append(pattern, groundPattern);
    Object.keys(forceColors).forEach((type) => {
      const marker = svgElement("marker", {
        id: `magnifier-arrow-${type}`,
        viewBox: "0 0 10 10",
        refX: 8,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: "auto-start-reverse"
      });
      marker.append(svgElement("path", {
        d: "M 0 0 L 10 5 L 0 10 z",
        fill: forceColors[type]
      }));
      defs.append(marker);
    });
    return defs;
  }

  function magnifierArrowLayer(selectedId) {
    const layer = svgElement("g", {});
    state.arrows.forEach((arrow) => {
      const selected = arrow.id === selectedId;
      const group = svgElement("g", {
        class: selected ? "magnifier-force is-selected" : "magnifier-force"
      });
      group.append(svgElement("line", {
        class: "magnifier-force-line",
        x1: arrow.start.x,
        y1: arrow.start.y,
        x2: arrow.end.x,
        y2: arrow.end.y,
        stroke: forceColors[arrow.type],
        "marker-end": `url(#magnifier-arrow-${arrow.type})`
      }));
      if (selected) {
        group.append(svgElement("circle", {
          class: "magnifier-tip",
          cx: arrow.end.x,
          cy: arrow.end.y,
          r: 8,
          stroke: forceColors[arrow.type]
        }));
      }
      const label = svgElement("text", {
        class: "magnifier-force-label",
        x: (arrow.start.x + arrow.end.x) / 2 + 10,
        y: (arrow.start.y + arrow.end.y) / 2 - 8,
        fill: forceColors[arrow.type]
      });
      renderSvgLabel(label, arrow);
      group.append(label);
      layer.append(group);
    });
    return layer;
  }

  function svgElement(name, attrs) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function svgPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function getArrowById(id) {
    return state.arrows.find((arrow) => arrow.id === id);
  }

  function activeArrowForType(type) {
    const selected = getArrowById(state.selectedId);
    if (selected && selected.type === type) return selected;
    return lastArrowOfType(type);
  }

  function labelPartsForArrow(arrow) {
    const sameType = state.arrows
      .filter((item) => item.type === arrow.type)
      .sort((a, b) => Number(a.slot) - Number(b.slot));
    const symbol = window.FbdScoring.FORCE_TYPES[arrow.type].symbol;
    return {
      symbol,
      subscript: sameType.length === 1 ? "" : String(sameType.indexOf(arrow) + 1)
    };
  }

  function renderSvgLabel(label, arrow) {
    label.replaceChildren();
    const parts = labelPartsForArrow(arrow);
    const symbol = svgElement("tspan", {});
    symbol.textContent = parts.symbol;
    label.append(symbol);
    if (parts.subscript) {
      const subscript = svgElement("tspan", {
        "baseline-shift": "sub",
        "font-size": "0.65em"
      });
      subscript.textContent = parts.subscript;
      label.append(subscript);
    }
  }

  function setArrowEnd(id, point) {
    const arrow = getArrowById(id);
    if (!arrow) return;
    arrow.end = { x: point.x, y: point.y };
    render();
  }

  function onPointerDown(event) {
    if (state.locked) return;
    const target = event.target.closest("[data-id]");
    if (!target) return;
    const id = Number(target.dataset.id);
    const arrow = getArrowById(id);
    if (!arrow) return;
    state.selectedType = arrow.type;
    state.selectedId = id;
    state.drag = {
      id,
      isTouch: event.pointerType === "touch",
      point: svgPoint(event),
      end: { ...arrow.end }
    };
    if (svg.setPointerCapture) {
      svg.setPointerCapture(event.pointerId);
    }
    render();
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!state.drag) return;
    const point = svgPoint(event);
    setArrowEnd(state.drag.id, {
      x: state.drag.end.x + point.x - state.drag.point.x,
      y: state.drag.end.y + point.y - state.drag.point.y
    });
    event.preventDefault();
  }

  function onPointerUp(event) {
    state.drag = null;
    render();
    saveDraft();
    if (svg.hasPointerCapture && svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
  }

  function onForceKeydown(event) {
    if (state.locked) return;
    const type = event.currentTarget.dataset.force;
    const arrow = activeArrowForType(type);
    if (!arrow) return;
    const moves = {
      ArrowUp: { x: 0, y: -10 },
      ArrowDown: { x: 0, y: 10 },
      ArrowLeft: { x: -10, y: 0 },
      ArrowRight: { x: 10, y: 0 }
    };
    const move = moves[event.key];
    if (!move) return;
    arrow.end = { x: arrow.end.x + move.x, y: arrow.end.y + move.y };
    state.selectedType = type;
    state.selectedId = arrow.id;
    event.preventDefault();
    render();
    saveDraft();
  }

  forceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      changeForceCount(button.dataset.force, button.dataset.action === "add" ? 1 : -1);
    });
    button.addEventListener("keydown", onForceKeydown);
  });
  submitButton.addEventListener("click", submitDiagram);
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);

  const attempt = window.SimScorm.loadAttempt(ACTIVITY);
  const startupState = window.SimActivityFlow.startup(attempt);
  if (startupState === "review") {
    showSubmittedAttempt(attempt);
  } else if (attempt.state === "draft") {
    if (!restoreArrows(attempt.snapshot.answer.arrows)) state.arrows = [];
    window.SimScorm.setDraftProvider(draftState);
  } else if (startupState === "editable") window.SimScorm.setDraftProvider(draftState);
  else if (startupState === "frozen") {
    const retry = window.SimScorm.retryPending(false);
    if (retry.committed) { showSubmittedAttempt(retry); window.SimScorm.finish(); }
    else lockAttempt("提交狀態未確認，請重新開啟活動再試。");
  } else lockAttempt("未能從 Moodle 安全載入本次作答，請重新開啟活動。");
  if (window.ResizeObserver) {
    new ResizeObserver(render).observe(svg);
  } else {
    window.addEventListener("resize", render);
  }
  render();
})();
