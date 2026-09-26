(function () {
  "use strict";
  const G = window.EquilibriumGenerator, M = window.EquilibriumModel, N = window.EquilibriumNotation;
  const P = window.EquilibriumPersistence, Scene = window.EquilibriumScene;
  const dom = Object.fromEntries(Array.from(document.querySelectorAll("[id]")).map(e => [e.id, e]));
  if (![G, M, N, P, Scene, window.EquilibriumRuntime, window.SimScorm, window.SimActivityFlow].every(Boolean)) {
    dom.notice.hidden = false; dom.notice.textContent = "活動元件未能完整載入，請重新開啟。本頁不會提交作答。";
    dom.editPanel.hidden = true; dom.technicalPanel.hidden = false; return;
  }
  let selected = -1, drag = null, keyboard = null, showReference = false;
  let layout = null, elapsed = 0, lastFrame = null, previousQuestion = null;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reducedMotion.matches;
  const diagnostics = { down: 0, move: 0, up: 0, cancel: 0, trustedTouch: 0 };
  const controller = new window.EquilibriumRuntime.Controller(SimScorm, SimActivityFlow, render);
  const targets = [], nav = [], palette = [];
  const announce = text => { dom.liveRegion.textContent = text; };
  const question = () => controller.scenario?.questions[controller.familyIndex];
  const records = () => controller.state?.answers[controller.familyIndex] || [];
  const editable = () => controller.mode === "edit";
  function displayRecords() {
    if (showReference && controller.trusted) return question().expected.map(f => [f.kind, Math.round(f.angle * 10) % 3600, 620]);
    return drag?.working || keyboard?.working || records();
  }
  function button(text, fn) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = text; b.addEventListener("click", fn); return b;
  }
  for (let position = 0; position < 5; position++) {
    const b = button(String(position + 1), () => { cancelInteractions(); selected = -1; showReference = false; controller.navigate(position); dom.controlPanel.scrollTop = 0; });
    nav.push(b); dom.questionNav.append(b);
  }
  for (let kind = 0; kind < 5; kind++) {
    const row = document.createElement("div"); row.className = "force-row";
    const name = document.createElement("span"); name.textContent = N.names[kind];
    const symbol = document.createElement("var"); symbol.className = "math"; symbol.textContent = N.symbols[kind]; symbol.style.color = N.colors[kind];
    const minus = button("−", () => {
      cancelInteractions(); const a = records();
      const i = a[selected]?.[0] === kind ? selected : a.map(r => r[0]).lastIndexOf(kind);
      selected = -1; controller.command({ type: "remove", index: i });
    });
    minus.setAttribute("aria-label", `移除一個${N.names[kind]}`);
    const count = document.createElement("output"); count.textContent = "0";
    const plus = button("＋", () => {
      cancelInteractions(); selected = records().length;
      if (controller.command({ type: "add", kind })) { origin.focus({ preventScroll: true }); announce(`已加入${N.names[kind]}，請從重心畫出方向。`); }
    });
    plus.dataset.addKind = String(kind); plus.setAttribute("aria-label", `加入${N.names[kind]}`);
    row.append(name, symbol, minus, count, plus); dom.forcePalette.append(row); palette.push({ minus, count, plus });
    const option = document.createElement("option"); option.value = String(kind); option.textContent = N.names[kind]; dom.kindSelect.append(option);
  }
  function makeTarget(index, originTarget = false) {
    const b = document.createElement("button"); b.type = "button"; b.className = originTarget ? "origin-hit" : "force-head-hit";
    b.hidden = true; b.dataset.index = String(index); dom.dragLayer.append(b);
    b.addEventListener("pointerdown", event => pointerDown(event, originTarget ? selected : index, b));
    b.addEventListener("pointermove", pointerMove); b.addEventListener("pointerup", pointerUp);
    b.addEventListener("pointercancel", event => { if (drag?.pointerId === event.pointerId) { diagnostics.cancel++; cancelInteractions(true); } });
    b.addEventListener("lostpointercapture", event => { if (drag?.pointerId === event.pointerId) cancelInteractions(true); });
    b.addEventListener("keydown", event => handleKeyboard(event, originTarget ? selected : index));
    return b;
  }
  const origin = makeTarget(-1, true);
  for (let i = 0; i < 8; i++) targets.push(makeTarget(i));
  function syncTargets() {
    const a = displayRecords(), enabled = editable() && Boolean(layout);
    targets.forEach((b, i) => {
      const r = a[i]; b.hidden = !enabled || !r || r[1] === null;
      if (!b.hidden) {
        const end = M.endpoint(r, layout); b.style.left = `${end.x}px`; b.style.top = `${end.y}px`;
        b.style.zIndex = selected === i ? "5" : "2"; b.setAttribute("aria-label", `${N.accessible(a, i)}箭尖；拖動或按Enter修改方向`);
      }
    });
    origin.hidden = !enabled || selected < 0 || !records()[selected] || (records()[selected][1] !== null && !drag?.creating);
    if (!origin.hidden) {
      origin.style.left = `${layout.center.x}px`; origin.style.top = `${layout.center.y}px`; origin.style.zIndex = "6";
      origin.setAttribute("aria-label", `從重心畫出${N.accessible(records(), selected)}；拖動或按Enter開始`);
    }
  }
  function renderStage() {
    if (!question() || controller.mode === "check" || ["technical", "mismatch"].includes(controller.mode)) { targets.forEach(t => { t.hidden = true; }); origin.hidden = true; return; }
    const rect = dom.stage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    layout = M.layout(rect.width, rect.height);
    Scene.render(dom.stageSvg, question(), layout, displayRecords(), showReference ? -1 : selected, drag?.snapTarget ?? null);
    Scene.animate(dom.stageSvg, elapsed, question().motion);
    syncTargets();
  }
  function render() {
    const panelScroll = dom.controlPanel.scrollTop;
    const edit = editable(), check = controller.mode === "check", lockedReview = ["review", "committed", "frozen", "mismatch"].includes(controller.mode);
    const noScene = check || !controller.scenario || ["technical", "mismatch"].includes(controller.mode);
    dom.app.classList.toggle("no-scene", noScene); dom.stage.hidden = noScene;
    dom.editPanel.hidden = !edit; dom.checkPanel.hidden = !check; dom.reviewPanel.hidden = !lockedReview; dom.technicalPanel.hidden = controller.mode !== "technical";
    dom.checkButton.hidden = !controller.editable; dom.checkButton.disabled = check;
    dom.notice.hidden = !controller.notice; dom.notice.textContent = controller.notice;
    dom.storageNotice.hidden = !controller.storageNotice; dom.storageNotice.textContent = controller.storageNotice;
    dom.saveRetryButton.hidden = !controller.editable || !controller.unsaved;
    dom.recoverButton.hidden = !controller.canRecover;
    dom.attemptStatus.textContent = controller.editable ? "尚未提交 · 五題獨立作答" : controller.mode === "review" ? "已提交 · 只讀檢討" : controller.mode === "committed" ? "成績已記錄" : controller.mode === "frozen" ? "提交尚未確認" : "作答已鎖定";
    nav.forEach((b, i) => {
      b.disabled = !controller.state || !controller.scenario;
      const q = controller.scenario?.questions[controller.scenario.order[i]];
      b.title = q?.title || ""; b.setAttribute("aria-label", `第${i + 1}題${q ? `：${q.title}` : ""}`);
      b.classList.toggle("has-answer", Boolean(controller.state?.answers[controller.scenario?.order[i]]?.length));
      if (controller.position === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    if (question()) {
      const q = question(), identity = `${controller.state.seed}:${q.family}`;
      if (identity !== previousQuestion) { previousQuestion = identity; elapsed = 0; lastFrame = null; }
      dom.motionLabel.textContent = q.motion ? `相對地面向${q.motion > 0 ? "右" : "左"}勻速直線運動` : "相對地面靜止";
      dom.motionLabel.classList.toggle("moving", Boolean(q.motion)); dom.motionControls.hidden = !q.motion || noScene; dom.pauseButton.textContent = paused ? "播放背景" : "暫停背景";
      dom.pauseButton.setAttribute("aria-pressed", String(paused));
      dom.questionKicker.textContent = `第 ${(controller.position ?? 0) + 1} / 5 題 · 平衡狀態`;
      dom.questionTitle.textContent = q.title; dom.questionPrompt.textContent = q.prompt;
    }
    if (selected >= records().length) selected = -1;
    const a = records();
    palette.forEach((row, kind) => {
      const count = a.filter(r => r[0] === kind).length; row.count.textContent = String(count);
      row.plus.disabled = !edit || count >= 3 || a.length >= 8; row.minus.disabled = !edit || count === 0;
    });
    dom.forceList.replaceChildren();
    a.forEach((record, i) => {
      const b = button("", () => { cancelInteractions(); selected = i; render(); });
      b.innerHTML = `${N.html(a, i)}${record[1] === null ? '<span class="pending-text">待畫</span>' : ""}`;
      b.setAttribute("aria-label", `${N.accessible(a, i)}${record[1] === null ? "，待畫方向" : "，選取修改"}`);
      b.setAttribute("aria-pressed", String(selected === i)); b.style.color = N.colors[record[0]]; dom.forceList.append(b);
    });
    dom.selectedControls.hidden = !edit || selected < 0;
    if (edit && selected >= 0) {
      dom.selectedLabel.textContent = N.accessible(a, selected); dom.kindSelect.value = String(a[selected][0]);
      Array.from(dom.kindSelect.options).forEach(o => { o.disabled = Number(o.value) !== a[selected][0] && a.filter(r => r[0] === Number(o.value)).length >= 3; });
      dom.selectionHint.textContent = keyboard ? "方向鍵微調，Enter確認，Escape取消。" : a[selected][1] === null ? "從重心起筆；或用轉向按鈕預覽，再確認方向。" : "拖箭尖修改；方向鍵可微調1°，Shift配合方向鍵調整5°。";
    }
    dom.confirmDirection.hidden = !keyboard;
    dom.undoButton.disabled = !edit || !controller.history.undo[controller.familyIndex].length;
    dom.redoButton.disabled = !edit || !controller.history.redo[controller.familyIndex].length;
    dom.clearButton.disabled = !edit || !a.length;
    dom.nextButton.textContent = controller.position === 4 ? "前往檢查作答" : "下一題";
    dom.returnCheckButton.hidden = !edit || !controller.state.returnToCheck;
    dom.drawHint.hidden = !edit || Boolean(a.length);
    if (check) {
      dom.checkList.replaceChildren();
      controller.scenario.order.forEach((familyIndex, position) => {
        const answer = controller.state.answers[familyIndex], drawn = answer.filter(r => r[1] !== null).length;
        const b = button("", () => { selected = -1; controller.navigate(position); dom.controlPanel.scrollTop = 0; });
        const strong = document.createElement("strong"); strong.textContent = `${position + 1}. ${controller.scenario.questions[familyIndex].title}`;
        const span = document.createElement("span"); span.textContent = answer.length ? `已選 ${answer.length} 個力，已畫 ${drawn} 個方向` : "未作答";
        b.append(strong, span); dom.checkList.append(b);
      });
      dom.submitButton.disabled = controller.unsaved;
    }
    if (lockedReview) renderReview();
    renderStage(); dom.controlPanel.scrollTop = panelScroll;
  }
  function renderReview() {
    const mode = controller.mode;
    dom.reviewTitle.textContent = mode === "frozen" ? "提交尚未確認" : mode === "committed" ? "成績已記錄" : mode === "mismatch" ? "已完成紀錄未能核對" : "只讀檢討";
    dom.scorePanel.replaceChildren();
    if (controller.result) {
      const score = document.createElement("strong"), status = document.createElement("p");
      score.textContent = Number.isFinite(controller.result.score) ? `${Number(controller.result.score.toFixed(1))} / 100` : "--";
      status.textContent = SimActivityFlow.completionLabel(controller.result.passed); dom.scorePanel.append(score, status);
    } else dom.scorePanel.textContent = "-- · 成績尚未確認";
    dom.retryFinalButton.hidden = !["frozen", "committed"].includes(mode);
    dom.retryFinalButton.textContent = mode === "committed" ? "重試完成連線" : "重試同一份提交";
    dom.referenceButton.hidden = !controller.trusted;
    dom.referenceButton.textContent = showReference ? "顯示我的圖" : "顯示參考圖";
    dom.referenceButton.setAttribute("aria-pressed", String(showReference)); dom.feedback.replaceChildren();
    if (!controller.trusted || !question()) return;
    const q = question(), detail = controller.result.detail[controller.familyIndex];
    const heading = document.createElement("h3"); heading.textContent = `${q.title} · ${Number(detail.score.toFixed(1))} / 20`; dom.feedback.append(heading);
    q.expected.forEach((f, i) => {
      const match = detail.matches.find(m => m.expected === i), p = document.createElement("p");
      p.className = match?.correct ? "ok" : "issue";
      p.textContent = `${!match ? "缺少" : match.correct ? "✓" : "方向需修正"}：${N.names[f.kind]}。${f.reason}`; dom.feedback.append(p);
    });
    if (detail.extra.length) {
      const p = document.createElement("p"); p.className = "issue";
      p.textContent = `多餘或重複的力：${detail.extra.map(i => N.accessible(records(), i)).join("、")}。每個力只應表示一次。`; dom.feedback.append(p);
    }
    const p = document.createElement("p"); p.className = "small";
    p.textContent = q.surface === "smooth" ? "光滑接觸沒有摩擦力。箭長不計分，合力為零不代表物體一定靜止。" : "圖中箭長不按大小比例。平衡表示實際合力為零，並不表示物體沒有受到力。"; dom.feedback.append(p);
  }
  function localPoint(event) { const r = dom.stage.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function pointerDown(event, index, target) {
    if (!editable() || drag || event.isPrimary === false || event.button > 0 || !records()[index]) return;
    cancelKeyboard(); selected = index;
    const before = M.clone(records()), p = localPoint(event), creating = before[index][1] === null;
    const end = creating ? layout.center : M.endpoint(before[index], layout);
    drag = { pointerId: event.pointerId, pointerType: event.pointerType, index, target, before, working: M.clone(before), creating,
      offset: { x: p.x - end.x, y: p.y - end.y }, snapTarget: null, corner: null, focus: end };
    diagnostics.down++; if (event.isTrusted && event.pointerType === "touch") diagnostics.trustedTouch++;
    target.setPointerCapture(event.pointerId); event.preventDefault(); render(); updatePreview(p);
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    diagnostics.move++; event.preventDefault();
    const p = localPoint(event), resolved = M.fromPoint(drag.before[drag.index][0], { x: p.x - drag.offset.x, y: p.y - drag.offset.y }, layout, question().referenceAngles, drag.pointerType, drag.snapTarget);
    if (resolved) { drag.working[drag.index] = resolved.record; drag.snapTarget = resolved.target; drag.focus = M.endpoint(resolved.record, layout); }
    renderStage(); updatePreview(p);
  }
  function pointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    diagnostics.up++; const active = drag; drag = null;
    if (active.target.hasPointerCapture(event.pointerId)) active.target.releasePointerCapture(event.pointerId);
    hidePreview(); controller.setAnswer(active.working); render(); announce("已記錄方向。");
  }
  function cancelKeyboard() { keyboard = null; }
  function cancelInteractions(interrupted = false) {
    const active = drag; drag = null; cancelKeyboard();
    if (active?.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    hidePreview();
    if (layout) renderStage();
    if (interrupted) announce("操作中斷；未完成的修改已取消。");
  }
  function cloneScene(svg) {
    const nodes = Array.from(dom.stageSvg.children).map(child => {
      const copy = child.cloneNode(true); copy.removeAttribute("id");
      copy.querySelectorAll("[id], [tabindex]").forEach(n => { n.removeAttribute("id"); n.removeAttribute("tabindex"); }); return copy;
    });
    svg.replaceChildren(...nodes);
  }
  function updatePreview(pointer) {
    if (!drag || !["touch", "pen"].includes(drag.pointerType)) return;
    dom.magnifier.hidden = false;
    const width = dom.magnifier.offsetWidth, height = dom.magnifier.offsetHeight, gap = 7;
    const corners = [
      { name: "top-left", x: gap, y: gap }, { name: "top-right", x: layout.width - width - gap, y: gap },
      { name: "bottom-left", x: gap, y: layout.height - height - gap }, { name: "bottom-right", x: layout.width - width - gap, y: layout.height - height - gap }
    ];
    const distance = corner => Math.hypot(Math.max(corner.x - pointer.x, 0, pointer.x - corner.x - width), Math.max(corner.y - pointer.y, 0, pointer.y - corner.y - height));
    let corner = corners.find(c => c.name === drag.corner);
    if (!corner || distance(corner) < 26) { corner = corners.slice().sort((a, b) => distance(b) - distance(a))[0]; drag.corner = corner.name; }
    dom.magnifier.style.left = `${corner.x}px`; dom.magnifier.style.top = `${corner.y}px`; dom.magnifier.dataset.corner = corner.name;
    const vw = width / 1.8, vh = height / 1.8, focus = drag.focus;
    const x = M.clamp(focus.x - vw / 2, 0, layout.width - vw), y = M.clamp(focus.y - vh / 2, 0, layout.height - vh);
    cloneScene(dom.magnifierSvg); dom.magnifierSvg.setAttribute("viewBox", `${x} ${y} ${vw} ${vh}`);
    const focusMark = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    for (const [k, v] of Object.entries({ cx: focus.x, cy: focus.y, r: 4, fill: "none", stroke: "#2563eb", "stroke-width": .8, "data-preview-focus": "true" })) focusMark.setAttribute(k, String(v));
    dom.magnifierSvg.append(focusMark); cloneScene(dom.overviewSvg); dom.overviewSvg.setAttribute("viewBox", dom.stageSvg.getAttribute("viewBox"));
    dom.overviewSvg.toggleAttribute("hidden", layout.center.x >= x && layout.center.x <= x + vw && layout.center.y >= y && layout.center.y <= y + vh);
  }
  function hidePreview() { dom.magnifier.hidden = true; dom.magnifierSvg.replaceChildren(); dom.overviewSvg.replaceChildren(); }
  function startKeyboard(index) {
    if (!editable() || !records()[index]) return;
    selected = index; const before = M.clone(records()); keyboard = { index, before, working: M.clone(before) };
    if (keyboard.working[index][1] === null) keyboard.working[index] = [before[index][0], 0, 500];
  }
  function commitKeyboard() {
    if (!keyboard) return; const answer = keyboard.working; keyboard = null; controller.setAnswer(answer); render(); announce("已確認方向。");
  }
  function handleKeyboard(event, index) {
    if (!editable()) return;
    if (event.key === "Escape") { event.preventDefault(); cancelInteractions(); render(); return; }
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); cancelInteractions(); selected = -1; controller.command({ type: "remove", index }); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); if (keyboard) commitKeyboard(); else { startKeyboard(index); render(); } return;
    }
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault(); if (!keyboard) startKeyboard(index);
    if (!keyboard) return;
    const r = keyboard.working[keyboard.index], delta = ["ArrowLeft", "ArrowUp"].includes(event.key) ? 1 : -1;
    r[1] = Math.round(M.normalize(r[1] / 10 + delta * (event.shiftKey ? 5 : 1)) * 10) % 3600; render();
  }
  document.querySelectorAll("[data-adjust]").forEach(b => b.addEventListener("click", () => {
    if (!editable() || selected < 0) return;
    if (drag) cancelInteractions();
    const pending = records()[selected][1] === null;
    if (pending && !keyboard) startKeyboard(selected);
    const a = M.clone(keyboard?.working || records()), r = a[selected], action = b.dataset.adjust;
    if (action === "ccw" || action === "cw") r[1] = Math.round(M.normalize(r[1] / 10 + (action === "ccw" ? 5 : -5)) * 10) % 3600;
    else r[2] = M.clamp(r[2] + (action === "longer" ? 100 : -100), 1, 1000);
    if (keyboard) { keyboard.working = a; render(); } else controller.setAnswer(a);
  }));
  dom.confirmDirection.addEventListener("click", commitKeyboard);
  dom.kindSelect.addEventListener("change", () => { const kind = Number(dom.kindSelect.value); cancelInteractions(); controller.command({ type: "kind", index: selected, kind }); });
  dom.removeSelected.addEventListener("click", () => { const i = selected; cancelInteractions(); selected = -1; controller.command({ type: "remove", index: i }); });
  dom.undoButton.addEventListener("click", () => { cancelInteractions(); selected = -1; controller.undo(); });
  dom.redoButton.addEventListener("click", () => { cancelInteractions(); selected = -1; controller.undo(true); });
  dom.clearButton.addEventListener("click", () => { if (!confirm("清除本題所有力？其他題及場景會保留。")) return; cancelInteractions(); selected = -1; controller.command({ type: "clear" }); });
  function enterCheck() { cancelInteractions(); selected = -1; controller.check(); dom.controlPanel.scrollTop = 0; dom.checkTitle.focus({ preventScroll: true }); }
  dom.checkButton.addEventListener("click", enterCheck); dom.returnCheckButton.addEventListener("click", enterCheck);
  dom.nextButton.addEventListener("click", () => { if (controller.position === 4) enterCheck(); else { cancelInteractions(); selected = -1; controller.navigate(controller.position + 1); dom.controlPanel.scrollTop = 0; } });
  dom.submitButton.addEventListener("click", () => { cancelInteractions(); controller.submit(); dom.controlPanel.scrollTop = 0; });
  dom.saveRetryButton.addEventListener("click", () => controller.retrySave());
  dom.retryFinalButton.addEventListener("click", () => { cancelInteractions(); controller.retryFinal(); });
  dom.referenceButton.addEventListener("click", () => { showReference = !showReference; selected = -1; render(); });
  dom.pauseButton.addEventListener("click", () => { paused = !paused; lastFrame = null; render(); });
  dom.recoverButton.addEventListener("click", () => { if (confirm("只清除這個已確認未提交的損壞草稿？此操作不能復原。") && controller.recoverDraft() === "reload") location.reload(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && (keyboard || drag)) { e.preventDefault(); cancelInteractions(); render(); }
    if (editable() && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); cancelInteractions(); selected = -1; controller.undo(e.shiftKey); }
  });
  // Blank-stage swipes belong to the enclosing host. The activity document is bounded.
  const touchOwners = new Map(); let handoffPanel = false;
  const ownTarget = target => target?.closest?.(".origin-hit, .force-head-hit");
  document.addEventListener("pointerdown", e => {
    if (e.pointerType !== "touch" || e.isPrimary !== false || !drag || ownTarget(e.target)) return;
    handoffPanel = dom.controlPanel.contains(e.target); cancelInteractions(true); render();
  }, true);
  document.addEventListener("touchstart", e => {
    for (const t of e.changedTouches) {
      let owner = "native";
      if (ownTarget(t.target)) owner = "draw";
      else if (dom.stage.contains(t.target) && !t.target.closest?.("button")) owner = "host";
      else if (handoffPanel && dom.controlPanel.contains(t.target)) owner = "panel-handoff";
      touchOwners.set(t.identifier, { owner, y: owner === "host" ? t.screenY : t.clientY });
    }
    handoffPanel = false;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    let handled = false;
    for (const t of e.changedTouches) {
      const record = touchOwners.get(t.identifier); if (!record) continue;
      // The iframe itself moves during host scrolling. Its local clientY is
      // therefore not a stable measure of finger travel; use screenY for the host.
      const y = record.owner === "host" ? t.screenY : t.clientY;
      const delta = record.y - y; record.y = y;
      if (record.owner === "host") {
        try { if (window.parent !== window && window.parent.document) { window.parent.scrollBy(0, delta / (window.parent.visualViewport?.scale || 1)); handled = true; } } catch (_) { /* Cross-origin hosts require their own verified bridge. */ }
      } else if (record.owner === "panel-handoff") { dom.controlPanel.scrollTop += delta; handled = true; }
    }
    if (handled && e.cancelable) e.preventDefault();
  }, { passive: false });
  for (const type of ["touchend", "touchcancel"]) document.addEventListener(type, e => { for (const t of e.changedTouches) touchOwners.delete(t.identifier); }, { passive: true });
  window.addEventListener("blur", () => { cancelInteractions(true); render(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelInteractions(true); lastFrame = null; render(); } });
  window.addEventListener("resize", () => { cancelInteractions(true); renderStage(); });
  reducedMotion.addEventListener("change", e => { paused = e.matches; lastFrame = null; render(); });
  new ResizeObserver(() => { if (!drag) renderStage(); }).observe(dom.stage);
  function frame(now) {
    if (!document.hidden && question()?.motion && !paused) {
      if (lastFrame !== null) elapsed += (now - lastFrame) / 1000;
      Scene.animate(dom.stageSvg, elapsed, question().motion);
      if (!dom.magnifier.hidden) { Scene.animate(dom.magnifierSvg, elapsed, question().motion); Scene.animate(dom.overviewSvg, elapsed, question().motion); }
    }
    lastFrame = document.hidden ? null : now; requestAnimationFrame(frame);
  }
  window.__equilibriumApp = Object.freeze({
    getState: () => M.clone(controller.state), getMode: () => controller.mode,
    getQuestion: () => M.clone(question() || null), getGeometry: () => M.clone(layout),
    getPointerDiagnostics: () => ({ ...diagnostics }), getResult: () => M.clone(controller.result),
    getSnapshot: () => controller.editable ? controller.draftSnapshot() : M.clone(controller.finalSnapshot),
    getAnimation: () => ({ elapsed, paused, offset: M.backgroundOffset(elapsed, question()?.motion || 0) })
  });
  controller.start(); requestAnimationFrame(frame);
})();
