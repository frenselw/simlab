(function () {
  "use strict";

  const svg = document.getElementById("diagram");
  const dragPreview = document.getElementById("dragPreview");
  const dragPreviewSvg = document.getElementById("dragPreviewSvg");
  const sceneLayer = document.getElementById("sceneLayer");
  const rayLayer = document.getElementById("rayLayer");
  const imageLayer = document.getElementById("imageLayer");
  const scorePanel = document.getElementById("scorePanel");
  const submitButton = document.getElementById("submitDiagram");
  const imageChoicePanel = document.getElementById("imageChoicePanel");
  const segmentButtons = document.querySelectorAll("[data-segment][data-action]");
  const countOutputs = document.querySelectorAll("[data-count]");
  const imageChoiceButtons = document.querySelectorAll("[data-image-choice]");

  const MAX_INCIDENT_RAYS = 4;
  const MAX_REFLECTED_RAYS = 4;
  const MAX_EXTENSION_LINES = 4;
  const SVG_WIDTH = 760;
  const SVG_HEIGHT = 480;
  const SNAP_MIN_DEG = 4;
  const SNAP_MAX_DEG = 12;
  const HANDLE_R = 44;
  const PREVIEW_VIEWBOX_WIDTH = 120;
  const PREVIEW_VIEWBOX_HEIGHT = 76;
  const PREVIEW_OFFSET = 28;
  const PREVIEW_MARGIN = 8;
  const ACTIVITY = "plane-mirror-pencil-ray-diagram";

  const state = {
    scene: createScene(),
    bundles: [],
    nextId: 1,
    selected: null,
    drag: null,
    imageChoice: null,
    image: null,
    locked: false,
    reviewUnavailable: false
  };

  function createScene() {
    const reflectingSide = Math.random() < 0.5 ? -1 : 1;
    const mirrorX = SVG_WIDTH / 2;
    const objectDistance = randomInt(130, 180);
    const objectHeight = randomInt(105, 150);
    const objectY = randomInt(225, 255);
    return {
      mirrorX,
      mirrorTop: 76,
      mirrorBottom: 404,
      reflectingSide,
      objectX: mirrorX + reflectingSide * objectDistance,
      objectY,
      objectHeight
    };
  }

  function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function randomImageAngle() {
    const angle = randomInt(-38, 38);
    return Math.abs(angle) < 12 ? angle + (angle < 0 ? -18 : 18) : angle;
  }

  function sourcePoint(source) {
    return window.MirrorRayScoring.sourcePoint(state.scene, source);
  }

  function correctImage() {
    return window.MirrorRayScoring.correctImage(state.scene);
  }

  function imageEndpoints(image) {
    return window.MirrorRayScoring.imageEndpoints(image);
  }

  function imageFromEndpoints(top, bottom) {
    const dx = bottom.x - top.x;
    const dy = bottom.y - top.y;
    return {
      x: (top.x + bottom.x) / 2,
      y: (top.y + bottom.y) / 2,
      height: Math.max(20, Math.hypot(dx, dy)),
      angle: 90 - window.MirrorRayScoring.vectorAngle({ x: dx, y: dy })
    };
  }

  function sourceForIndex(index) {
    return index < 2 ? "top" : "bottom";
  }

  function segmentCount(kind) {
    if (kind === "incident") return state.bundles.length;
    return state.bundles.filter((bundle) => Boolean(bundle[kind])).length;
  }

  function addSegment(kind) {
    if (state.locked) return;
    if (kind === "incident") addIncident();
    if (kind === "reflected") addReflected();
    if (kind === "extension") addExtension();
    render();
    saveDraft();
  }

  function removeSegment(kind) {
    if (state.locked) return;
    if (kind === "incident") {
      const removed = state.bundles.pop();
      if (removed && state.selected && state.selected.id === removed.id) state.selected = null;
    }
    if (kind === "reflected") {
      const bundle = lastBundleWith("reflected");
      if (bundle) {
        delete bundle.reflected;
        delete bundle.extension;
        if (state.selected && state.selected.id === bundle.id) state.selected = null;
      }
    }
    if (kind === "extension") {
      const bundle = lastBundleWith("extension");
      if (bundle) {
        delete bundle.extension;
        if (state.selected && state.selected.id === bundle.id && state.selected.kind === "extension") {
          state.selected = null;
        }
      }
    }
    if (!canPlaceImage()) {
      state.imageChoice = null;
      state.image = null;
    }
    render();
    saveDraft();
  }

  function addIncident() {
    if (state.bundles.length >= MAX_INCIDENT_RAYS) return;
    const source = sourceForIndex(state.bundles.length);
    const start = sourcePoint(source);
    const yOffset = [-70, -25, 25, 70][state.bundles.length];
    const end = {
      x: start.x + state.scene.reflectingSide * 78,
      y: start.y + yOffset * 0.3
    };
    const bundle = {
      id: state.nextId,
      source,
      incident: { start, end }
    };
    state.nextId += 1;
    state.bundles.push(bundle);
    state.selected = { kind: "incident", id: bundle.id };
  }

  function addReflected() {
    if (segmentCount("reflected") >= MAX_REFLECTED_RAYS) return;
    const bundle = selectedEligibleBundle("incident", (item) => item.incident && !item.reflected);
    if (!bundle) return;
    const start = { ...bundle.incident.end };
    bundle.reflected = {
      start,
      end: {
        x: start.x + state.scene.reflectingSide * 115,
        y: start.y + 35
      }
    };
    delete bundle.extension;
    state.selected = { kind: "reflected", id: bundle.id };
  }

  function addExtension() {
    if (segmentCount("extension") >= MAX_EXTENSION_LINES) return;
    const bundle = selectedEligibleBundle("reflected", (item) => item.reflected && !item.extension);
    if (!bundle) return;
    const start = { ...bundle.reflected.start };
    bundle.extension = {
      start,
      end: {
        x: start.x - state.scene.reflectingSide * 110,
        y: start.y - 30
      }
    };
    state.selected = { kind: "extension", id: bundle.id };
  }

  function selectedEligibleBundle(kind, predicate) {
    const selected = state.selected && state.selected.kind === kind ? getBundle(state.selected.id) : null;
    if (selected && predicate(selected)) return selected;
    return state.bundles.find(predicate);
  }

  function lastBundleWith(kind) {
    return state.bundles.slice().reverse().find((bundle) => bundle[kind]);
  }

  function getBundle(id) {
    return state.bundles.find((bundle) => bundle.id === id);
  }

  function isIncidentReady(bundle) {
    if (!bundle.incident) return false;
    const end = bundle.incident.end;
    return (
      Math.abs(end.x - state.scene.mirrorX) <= 16 &&
      end.y >= state.scene.mirrorTop &&
      end.y <= state.scene.mirrorBottom
    );
  }

  function allBundlesComplete() {
    return (
      state.bundles.length === MAX_INCIDENT_RAYS &&
      state.bundles.every((bundle) => bundle.incident && bundle.reflected && bundle.extension)
    );
  }

  function canPlaceImage() {
    return state.bundles.some((bundle) => bundle.incident || bundle.reflected || bundle.extension);
  }

  function canSubmitAttempt() {
    return canPlaceImage() || Boolean(state.imageChoice || state.image);
  }

  function chooseImageType(choice) {
    if (state.locked || !canPlaceImage()) return;
    state.imageChoice = choice;
    if (!state.image) {
      const expected = correctImage();
      state.image = {
        x: state.scene.mirrorX - state.scene.reflectingSide * 86,
        y: (expected.topY + expected.bottomY) / 2,
        height: Math.max(40, expected.bottomY - expected.topY - 36),
        angle: randomImageAngle()
      };
    }
    render();
    saveDraft();
  }

  function submitDiagram() {
    if (state.locked || !canSubmitAttempt()) return;
    const answer = currentAnswer();
    const result = window.MirrorRayScoring.scoreDiagram(answer, state.scene);
    showResult(result);
    const handle = (submission) => window.SimActivityFlow.submission(submission, {
      success: () => lockAttempt("此作答次已提交。如要重新作答，請返回活動入口並開始新的作答次。"),
      committed: () => lockAttempt("成績已保存；Moodle session 會在離開頁面時再次完成。"),
      frozen: () => lockAttempt("提交狀態未確認；答案已凍結，請重新開啟活動再試。"),
      retry: () => scorePanel.append(textBlock("div", "未能傳送到 Moodle，請重試。", "feedback-item wrong"))
    });
    window.SimScorm.submitWithCallbacks(result, reviewState(result), { onFailure: handle, onSuccess: handle });
  }

  function currentAnswer() {
    return {
      bundles: state.bundles.map((bundle) => ({
        id: bundle.id,
        source: bundle.source,
        incident: cloneSegment(bundle.incident),
        reflected: cloneSegment(bundle.reflected),
        extension: cloneSegment(bundle.extension)
      })),
      imageChoice: state.imageChoice,
      image: state.image ? { ...state.image } : null
    };
  }

  function cloneSegment(segment) {
    if (!segment) return null;
    return {
      start: { ...segment.start },
      end: { ...segment.end }
    };
  }

  function reviewState(result) {
    return window.SimScorm.makeSnapshot(ACTIVITY, "review", {
      scene: state.scene,
      response: currentAnswer()
    }, result);
  }

  function draftState() {
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", { scene: state.scene, response: currentAnswer() });
  }

  function saveDraft() {
    if (!state.locked) window.SimScorm.saveDraft(draftState());
  }

  function showResult(result) {
    scorePanel.replaceChildren(
      textBlock("div", "目前分數"),
      textBlock("div", String(result.score), "score-value"),
      textBlock("div", window.SimActivityFlow.completionLabel(result.passed))
    );
    const list = document.createElement("ul");
    list.className = "feedback-list";
    result.feedbackItems.forEach((item) => {
      list.append(textBlock("li", item.text, `feedback-item ${item.status}`));
    });
    scorePanel.append(list, textBlock("div", result.summary, "muted feedback-summary"));
  }

  function lockAttempt(message) {
    state.locked = true;
    state.drag = null;
    state.selected = null;
    segmentButtons.forEach((button) => {
      button.disabled = true;
    });
    imageChoiceButtons.forEach((button) => {
      button.disabled = true;
    });
    submitButton.disabled = true;
    if (message) {
      scorePanel.append(textBlock("div", message, "muted feedback-summary"));
    }
    render();
  }

  function showSubmittedAttempt(attempt) {
    const review = attempt?.snapshot || attempt?.review || null;
    const restored = restoreSnapshot(review);
    if (!restored) {
      state.reviewUnavailable = true;
    }
    const rescored = restored ? window.MirrorRayScoring.scoreDiagram(currentAnswer(), state.scene) : null;
    const outcome = window.SimActivityFlow.reviewResult(rescored, review, attempt);
    render();
    showResult({ ...outcome.result, score: outcome.result.score ?? "--", summary: outcome.trusted ? outcome.result.summary : "已保存資料無法安全重建或與 Moodle 記錄不一致。" });
    scorePanel.append(textBlock("div", "如要重新作答，請返回活動入口並開始新的作答次。", "muted feedback-summary"));
    lockAttempt();
  }

  function restoreSnapshot(snapshot) {
    const restored = window.MirrorRayScoring.restoreAnswer(snapshot?.answer);
    if (!restored) return false;
    state.scene = restored.scene;
    state.bundles = restored.bundles;
    state.nextId = state.bundles.length + 1;
    state.imageChoice = restored.imageChoice;
    state.image = restored.image;
    return true;
  }

  function textBlock(tagName, text, className) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function render() {
    renderControls();
    renderScene();
    renderRays();
    renderImage();
  }

  function renderControls() {
    countOutputs.forEach((output) => {
      output.textContent = String(segmentCount(output.dataset.count));
    });
    segmentButtons.forEach((button) => {
      const kind = button.dataset.segment;
      const action = button.dataset.action;
      button.disabled = state.locked || !canUseSegmentButton(kind, action);
    });
    const imageReady = canPlaceImage();
    imageChoicePanel.classList.toggle("is-hidden", !imageReady);
    imageChoiceButtons.forEach((button) => {
      const selected = button.dataset.imageChoice === state.imageChoice;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = state.locked || !imageReady;
    });
    submitButton.disabled = state.locked || !canSubmitAttempt();
  }

  function canUseSegmentButton(kind, action) {
    if (action === "remove") return segmentCount(kind) > 0;
    if (kind === "incident") return segmentCount("incident") < MAX_INCIDENT_RAYS;
    if (kind === "reflected") {
      return (
        segmentCount("reflected") < MAX_REFLECTED_RAYS &&
        state.bundles.some((bundle) => bundle.incident && !bundle.reflected)
      );
    }
    if (kind === "extension") {
      return (
        segmentCount("extension") < MAX_EXTENSION_LINES &&
        state.bundles.some((bundle) => bundle.reflected && !bundle.extension)
      );
    }
    return false;
  }

  function renderScene() {
    sceneLayer.replaceChildren();
    if (state.reviewUnavailable) {
      sceneLayer.append(label("未能載入已提交圖形", 300, 240, "source-label"));
      return;
    }
    const scene = state.scene;
    const nonReflectingSide = -scene.reflectingSide;
    const backX = scene.mirrorX + nonReflectingSide * 12;
    const mirrorLeft = Math.min(scene.mirrorX, backX);
    sceneLayer.append(
      svgElement("rect", {
        class: "mirror-pane",
        x: mirrorLeft,
        y: scene.mirrorTop,
        width: Math.abs(backX - scene.mirrorX),
        height: scene.mirrorBottom - scene.mirrorTop
      }),
      svgElement("line", {
        class: "mirror-face",
        x1: scene.mirrorX,
        y1: scene.mirrorTop,
        x2: scene.mirrorX,
        y2: scene.mirrorBottom
      }),
      svgElement("line", {
        class: "mirror-back",
        x1: backX,
        y1: scene.mirrorTop,
        x2: backX,
        y2: scene.mirrorBottom
      })
    );
    for (let y = scene.mirrorTop + 10; y < scene.mirrorBottom; y += 22) {
      sceneLayer.append(svgElement("line", {
        class: "mirror-hatch",
        x1: backX,
        y1: y,
        x2: backX + nonReflectingSide * 18,
        y2: y + 14
      }));
    }
    const top = sourcePoint("top");
    const bottom = sourcePoint("bottom");
    sceneLayer.append(
      pencilGroup(top, bottom, "object-pencil", false),
      svgElement("circle", {
        class: "source-dot",
        cx: top.x,
        cy: top.y,
        r: 6
      }),
      svgElement("circle", {
        class: "source-dot",
        cx: bottom.x,
        cy: bottom.y,
        r: 6
      })
    );
  }

  function pencilGroup(top, bottom, className, ghost) {
    const group = svgElement("g", {
      class: `${className}${ghost ? " is-ghost" : ""}`
    });
    const dx = bottom.x - top.x;
    const dy = bottom.y - top.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const bodyInset = Math.min(18, length * 0.18);
    const bodyTop = { x: top.x + ux * bodyInset, y: top.y + uy * bodyInset };
    const bodyBottom = bottom;
    const width = 8;
    group.append(
      svgElement("polygon", {
        class: "pencil-body-shape",
        points: [
          pointString(bodyTop.x + px * width, bodyTop.y + py * width),
          pointString(bodyTop.x - px * width, bodyTop.y - py * width),
          pointString(bodyBottom.x - px * width, bodyBottom.y - py * width),
          pointString(bodyBottom.x + px * width, bodyBottom.y + py * width)
        ].join(" ")
      }),
      svgElement("polygon", {
        class: "pencil-tip-shape",
        points: [
          pointString(top.x, top.y),
          pointString(bodyTop.x + px * width, bodyTop.y + py * width),
          pointString(bodyTop.x - px * width, bodyTop.y - py * width)
        ].join(" ")
      }),
      svgElement("line", {
        class: "pencil-end-cap",
        x1: bodyBottom.x + px * width,
        y1: bodyBottom.y + py * width,
        x2: bodyBottom.x - px * width,
        y2: bodyBottom.y - py * width
      })
    );
    return group;
  }

  function pointString(x, y) {
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }

  function renderRays() {
    rayLayer.replaceChildren();
    if (state.reviewUnavailable) return;
    state.bundles.forEach((bundle, index) => {
      if (bundle.incident) renderRay(bundle, "incident", `入射 ${index + 1}`);
      if (bundle.reflected) renderRay(bundle, "reflected", `反射 ${index + 1}`);
      if (bundle.extension) renderRay(bundle, "extension", `延長 ${index + 1}`);
    });
    renderNormal();
  }

  function renderNormal() {
    if (!state.selected || state.selected.kind !== "reflected") return;
    const bundle = getBundle(state.selected.id);
    if (!bundle || !isIncidentReady(bundle)) return;
    const point = bundle.incident.end;
    rayLayer.append(svgElement("line", {
      class: "normal-line",
      x1: point.x - 70,
      y1: point.y,
      x2: point.x + 70,
      y2: point.y
    }));
  }

  function renderRay(bundle, kind, text) {
    const segment = bundle[kind];
    const selected = state.selected && state.selected.kind === kind && state.selected.id === bundle.id;
    const group = svgElement("g", {
      class: selected ? "ray-group is-selected" : "ray-group"
    });
    group.append(svgElement("line", {
      class: `ray-line ${kind}`,
      x1: segment.start.x,
      y1: segment.start.y,
      x2: segment.end.x,
      y2: segment.end.y
    }));
    if (kind === "incident") {
      group.append(svgElement("circle", {
        class: "mirror-point",
        cx: segment.end.x,
        cy: segment.end.y,
        r: 4
      }));
    }
    group.append(svgElement("circle", {
      class: "ray-hit",
      cx: segment.end.x,
      cy: segment.end.y,
      r: HANDLE_R,
      tabindex: 0,
      role: "slider",
      "aria-label": text,
      "data-kind": kind,
      "data-id": bundle.id
    }));
    rayLayer.append(group);
  }

  function renderImage() {
    imageLayer.replaceChildren();
    if (state.reviewUnavailable) return;
    if (!canPlaceImage() || !state.imageChoice || !state.image) return;
    const endpoints = imageEndpoints(state.image);
    const group = svgElement("g", {});
    const imagePencil = pencilGroup(endpoints.top, endpoints.bottom, "image-pencil", true);
    imagePencil.setAttribute("data-image-handle", "body");
    imagePencil.setAttribute("tabindex", "0");
    imagePencil.setAttribute("role", "slider");
    imagePencil.setAttribute("aria-label", "像的位置");
    group.append(
      imagePencil,
      svgElement("line", {
        class: "image-body-hit",
        x1: endpoints.top.x,
        y1: endpoints.top.y,
        x2: endpoints.bottom.x,
        y2: endpoints.bottom.y,
        tabindex: 0,
        role: "slider",
        "aria-label": "像的位置",
        "data-image-handle": "body"
      }),
      svgElement("circle", {
        class: "image-handle",
        cx: endpoints.top.x,
        cy: endpoints.top.y,
        r: 9
      }),
      svgElement("circle", {
        class: "image-handle-hit",
        cx: endpoints.top.x,
        cy: endpoints.top.y,
        r: HANDLE_R,
        tabindex: 0,
        role: "slider",
        "aria-label": "像的頂端",
        "data-image-handle": "top"
      }),
      svgElement("circle", {
        class: "image-handle",
        cx: endpoints.bottom.x,
        cy: endpoints.bottom.y,
        r: 9
      }),
      svgElement("circle", {
        class: "image-handle-hit",
        cx: endpoints.bottom.x,
        cy: endpoints.bottom.y,
        r: HANDLE_R,
        tabindex: 0,
        role: "slider",
        "aria-label": "像的底端",
        "data-image-handle": "bottom"
      })
    );
    imageLayer.append(group);
  }

  function label(text, x, y, className) {
    const element = svgElement("text", { class: className, x, y });
    element.textContent = text;
    return element;
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

  function shouldShowDragPreview(event) {
    return event.pointerType === "touch" || event.pointerType === "pen";
  }

  function updateDragPreview(event, point) {
    if (!dragPreview || !dragPreviewSvg || !state.drag || !state.drag.preview) return;
    dragPreviewSvg.setAttribute("viewBox", [
      clampValue(point.x - PREVIEW_VIEWBOX_WIDTH / 2, 0, SVG_WIDTH - PREVIEW_VIEWBOX_WIDTH),
      clampValue(point.y - PREVIEW_VIEWBOX_HEIGHT / 2, 0, SVG_HEIGHT - PREVIEW_VIEWBOX_HEIGHT),
      PREVIEW_VIEWBOX_WIDTH,
      PREVIEW_VIEWBOX_HEIGHT
    ].join(" "));
    dragPreviewSvg.replaceChildren(...Array.from(svg.children).map(clonePreviewChild));
    dragPreview.classList.add("is-active");

    const stageRect = svg.parentElement.getBoundingClientRect();
    const width = dragPreview.offsetWidth;
    const height = dragPreview.offsetHeight;
    const localX = event.clientX - stageRect.left;
    const localY = event.clientY - stageRect.top;
    const maxLeft = stageRect.width - width - PREVIEW_MARGIN;
    const maxTop = stageRect.height - height - PREVIEW_MARGIN;
    const left = clampValue(localX < stageRect.width / 2 ? maxLeft : PREVIEW_MARGIN, PREVIEW_MARGIN, maxLeft);
    const top = clampValue(localY < stageRect.height / 2 ? maxTop : PREVIEW_MARGIN, PREVIEW_MARGIN, maxTop);
    dragPreview.style.transform = "translate(" + left + "px, " + top + "px)";
  }

  function clonePreviewChild(child) {
    const clone = child.cloneNode(true);
    if (clone.removeAttribute) clone.removeAttribute("tabindex");
    clone.querySelectorAll?.("[tabindex]").forEach((element) => element.removeAttribute("tabindex"));
    return clone;
  }

  function hideDragPreview() {
    if (!dragPreview) return;
    dragPreview.classList.remove("is-active");
  }

  function clampValue(value, min, max) {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  function onPointerDown(event) {
    if (state.locked) return;
    const imageTarget = event.target.closest("[data-image-handle]");
    if (imageTarget && state.image) {
      const point = svgPoint(event);
      state.selected = null;
      state.drag = {
        kind: "image",
        handle: imageTarget.dataset.imageHandle,
        point,
        image: { ...state.image },
        preview: shouldShowDragPreview(event)
      };
      if (svg.setPointerCapture) svg.setPointerCapture(event.pointerId);
      updateDragPreview(event, point);
      event.preventDefault();
      return;
    }
    const target = event.target.closest("[data-kind][data-id]");
    if (!target) {
      state.selected = null;
      render();
      return;
    }
    const id = Number(target.dataset.id);
    const bundle = getBundle(id);
    if (!bundle || !bundle[target.dataset.kind]) return;
    const point = svgPoint(event);
    state.selected = { kind: target.dataset.kind, id };
    state.drag = {
      kind: target.dataset.kind,
      id,
      point,
      end: { ...bundle[target.dataset.kind].end },
      preview: shouldShowDragPreview(event)
    };
    if (svg.setPointerCapture) svg.setPointerCapture(event.pointerId);
    updateDragPreview(event, point);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!state.drag) return;
    const point = svgPoint(event);
    if (state.drag.kind === "image") {
      dragImage(point);
    } else {
      dragRay(point);
    }
    updateDragPreview(event, point);
    event.preventDefault();
  }

  function onPointerUp(event) {
    state.drag = null;
    hideDragPreview();
    render();
    saveDraft();
    if (svg.hasPointerCapture && svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event) {
    if (state.locked) return;
    const moves = {
      ArrowUp: { x: 0, y: -8 },
      ArrowDown: { x: 0, y: 8 },
      ArrowLeft: { x: -8, y: 0 },
      ArrowRight: { x: 8, y: 0 }
    };
    const move = moves[event.key];
    if (!move) return;
    const imageTarget = event.target.closest("[data-image-handle]");
    if (imageTarget && state.image) {
      window.MirrorDraftSave.change(() => moveImageByKey(imageTarget.dataset.imageHandle, move), keyboardDraftSave);
      event.preventDefault();
      return;
    }
    const rayTarget = event.target.closest("[data-kind][data-id]");
    if (!rayTarget) return;
    window.MirrorDraftSave.change(
      () => moveRayByKey(Number(rayTarget.dataset.id), rayTarget.dataset.kind, move),
      keyboardDraftSave
    );
    event.preventDefault();
  }

  const keyboardDraftSave = window.MirrorDraftSave.create(saveDraft);

  function moveImageByKey(handle, move) {
    const endpoints = imageEndpoints(state.image);
    if (handle === "body") {
      state.image = {
        ...state.image,
        x: state.image.x + move.x,
        y: state.image.y + move.y
      };
    } else if (handle === "top") {
      state.image = imageFromEndpoints(
        { x: endpoints.top.x + move.x, y: endpoints.top.y + move.y },
        endpoints.bottom
      );
    } else {
      state.image = imageFromEndpoints(
        endpoints.top,
        { x: endpoints.bottom.x + move.x, y: endpoints.bottom.y + move.y }
      );
    }
    render();
    focusImageHandle(handle);
  }

  function moveRayByKey(id, kind, move) {
    const bundle = getBundle(id);
    if (!bundle || !bundle[kind]) return;
    const current = bundle[kind].end;
    const next = { x: current.x + move.x, y: current.y + move.y };
    state.selected = { kind, id };
    if (kind === "incident") {
      bundle.incident.end = snapIncidentEnd(next);
      if (bundle.reflected) bundle.reflected.start = { ...bundle.incident.end };
      if (bundle.extension) bundle.extension.start = { ...bundle.incident.end };
    } else {
      bundle[kind].end = next;
    }
    render();
    focusRayHandle(id, kind);
  }

  function focusImageHandle(handle) {
    const target = imageLayer.querySelector("[data-image-handle=\"" + handle + "\"]");
    if (target && target.focus) target.focus();
  }

  function focusRayHandle(id, kind) {
    const target = rayLayer.querySelector("[data-id=\"" + id + "\"][data-kind=\"" + kind + "\"]");
    if (target && target.focus) target.focus();
  }

  function dragImage(point) {
    const dx = point.x - state.drag.point.x;
    const dy = point.y - state.drag.point.y;
    const image = state.drag.image;
    const endpoints = imageEndpoints(image);
    if (state.drag.handle === "body") {
      state.image = {
        ...image,
        x: image.x + dx,
        y: image.y + dy
      };
    } else if (state.drag.handle === "top") {
      state.image = imageFromEndpoints(point, endpoints.bottom);
    } else {
      state.image = imageFromEndpoints(endpoints.top, point);
    }
    render();
  }

  function dragRay(point) {
    const bundle = getBundle(state.drag.id);
    if (!bundle) return;
    const kind = state.drag.kind;
    if (kind === "incident") {
      const end = snapIncidentEnd(point);
      bundle.incident.end = end;
      if (bundle.reflected) bundle.reflected.start = { ...end };
      if (bundle.extension) bundle.extension.start = { ...end };
    }
    if (kind === "reflected") {
      bundle.reflected.end = snappedRayEnd(bundle, "reflected", point);
    }
    if (kind === "extension") {
      bundle.extension.end = snappedRayEnd(bundle, "extension", point);
    }
    render();
  }

  function snapIncidentEnd(point) {
    const y = Math.max(state.scene.mirrorTop, Math.min(state.scene.mirrorBottom, point.y));
    if (Math.abs(point.x - state.scene.mirrorX) <= 22) {
      return { x: state.scene.mirrorX, y };
    }
    return {
      x: point.x,
      y: Math.max(30, Math.min(SVG_HEIGHT - 30, point.y))
    };
  }

  function snappedRayEnd(bundle, kind, point) {
    const segment = bundle[kind];
    const start = segment.start;
    const length = Math.max(45, window.MirrorRayScoring.pointDistance(start, point));
    const rawAngle = window.MirrorRayScoring.vectorAngle({
      x: point.x - start.x,
      y: point.y - start.y
    });
    const expectedAngle =
      kind === "reflected"
        ? window.MirrorRayScoring.expectedReflectedAngle(bundle, state.scene)
        : window.MirrorRayScoring.expectedExtensionAngle(bundle, state.scene);
    if (kind === "reflected" && !isIncidentReady(bundle)) {
      const radians = rawAngle * Math.PI / 180;
      return {
        x: start.x + Math.cos(radians) * length,
        y: start.y + Math.sin(radians) * length
      };
    }
    const capture = snapCaptureDegrees(bundle);
    const angle =
      window.MirrorRayScoring.angleDistance(rawAngle, expectedAngle) <= capture
        ? expectedAngle
        : rawAngle;
    const radians = angle * Math.PI / 180;
    return {
      x: start.x + Math.cos(radians) * length,
      y: start.y + Math.sin(radians) * length
    };
  }

  function snapCaptureDegrees(bundle) {
    const source = sourcePoint(bundle.source);
    const mirrorPoint = bundle.incident.end;
    const theta = window.MirrorRayScoring.incidentAngleToNormal(source, mirrorPoint);
    return Math.max(SNAP_MIN_DEG, Math.min(SNAP_MAX_DEG, theta / 6));
  }

  segmentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "add") {
        addSegment(button.dataset.segment);
      } else {
        removeSegment(button.dataset.segment);
      }
    });
  });
  imageChoiceButtons.forEach((button) => {
    button.addEventListener("click", () => chooseImageType(button.dataset.imageChoice));
  });
  submitButton.addEventListener("click", submitDiagram);
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);
  svg.addEventListener("keydown", onKeyDown);

  const attempt = window.SimScorm.loadAttempt(ACTIVITY);
  const startupState = window.SimActivityFlow.startup(attempt);
  if (startupState === "review") {
    showSubmittedAttempt(attempt);
  } else if (attempt.state === "draft") {
    if (!restoreSnapshot(attempt.snapshot)) lockAttempt("已保存草稿損壞，請重新開啟活動。");
    else window.SimScorm.setDraftProvider(draftState);
    render();
  } else if (startupState === "editable") {
    window.SimScorm.setDraftProvider(draftState);
    render();
  } else if (startupState === "frozen") {
    const retry = window.SimScorm.retryPending(false);
    if (retry.committed) { showSubmittedAttempt(retry); window.SimScorm.finish(); }
    else lockAttempt("提交狀態未確認，請重新開啟活動再試。");
  } else lockAttempt("未能從 Moodle 安全載入本次作答，請重新開啟活動。");
})();
