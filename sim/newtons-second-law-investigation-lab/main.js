(function () {
  "use strict";
  const M = NewtonModel, P = NewtonPersistence, G = NewtonGraph, F = NewtonFitting, E = NewtonExperiment;
  const ids = ["app", "attemptStatus", "stage", "stageSvg", "controlPanel", "experimentNav", "graphNav", "notice", "saveRetryButton", "resultPanel", "reviewTitle", "scorePanel", "retryFinalButton", "collectPanel", "collectTitle", "collectPrompt", "role0", "role1", "role2", "instrumentControls", "massLock", "massDown", "massUp", "massValue", "forceLock", "forceDown", "forceUp", "forceValue", "forceRange", "measureButton", "measurementReadout", "recordButton", "replayButton", "sensorGraph", "recordCount", "recordTable", "goGraph", "clearGroup", "plotPanel", "graphKicker", "plotTitle", "plotTable", "pointControls", "keyboardPlace", "removePoint", "keyboardHelp", "fitModel", "fitButton", "fitResult", "returnExperiment", "clearGraph", "referenceButton", "concludePanel", "conclusionFields", "checkPanel", "checkSummary", "submitButton", "feedback", "editableFooter", "returnCheck", "clearAllButton", "checkButton", "recoverButton", "sourceHandle", "pointHandles", "magnifier", "magnifierSvg"];
  const d = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const esc = G.escape, display = n => Number(n.toPrecision(5)).toString(), phaseTitles = { collect: "實驗", plot: "作圖", conclude: "歸納", check: "檢查" };
  const controller = new NewtonRuntime.Controller(SimScorm, SimActivityFlow, render);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"), handles = new Map();
  let selected = 0, geometry = null, drag = null, keyboard = null, run = null, showReference = false, lastGroup = 0, lastGraph = 0, lastPreviewCorner = null;
  const diagnostics = { downs: 0, moves: 0, ups: 0, cancels: 0, trustedTouch: 0, previews: 0, lastTarget: null };
  const editable = () => controller.editable && controller.mode !== "check";
  const view = () => controller.view;
  const localPoint = event => { const r = d.stage.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
  const graphName = i => i === 0 ? '<var>a</var>–<var>F</var><sub>合</sub>' : i === 1 ? '<var>a</var>–<var>m</var>' : '<var>a</var>–1/<var>m</var>';
  d.conclusionFields.innerHTML = M.QUESTIONS.map((q, i) => `<fieldset><legend>${i + 1}. ${esc(q.title)}</legend>${q.options.slice((i + 1) % 4).concat(q.options.slice(0, (i + 1) % 4)).map(([value, label]) => `<label class="choice"><input type="radio" name="conclusion${i}" data-conclusion="${i}" value="${value}"><span>${esc(label)}</span></label>`).join("")}</fieldset>`).join("");
  function command(action) { return controller.command(action); }
  function cancelWork(count = false) {
    const previous = drag; drag = null; keyboard = null; lastPreviewCorner = null;
    d.magnifier.hidden = true; d.magnifierSvg.replaceChildren(); d.keyboardHelp.hidden = true;
    if (previous) { if (count) diagnostics.cancels++; try { previous.target.releasePointerCapture(previous.id); } catch (_) {} }
  }
  function navigate(phase, index = null) {
    cancelWork(); run = null; selected = 0; showReference = false;
    if (phase === "collect") lastGroup = index;
    if (phase === "plot") lastGraph = index;
    controller.navigate(phase, index); d.controlPanel.scrollTop = 0;
  }
  function render() {
    const s = controller.state, v = view(), locked = !controller.editable;
    if (locked) { cancelWork(); run = null; }
    const scene = Boolean(s && ["collect", "plot"].includes(v.phase));
    d.app.classList.toggle("no-scene", !scene); d.stage.setAttribute("aria-hidden", String(!scene));
    d.attemptStatus.textContent = controller.editable ? "公平測試與數據作圖" : controller.mode === "review" ? "已提交 · 只讀檢討" : controller.mode === "committed" ? "成績已記錄" : controller.mode === "frozen" ? "提交待確認" : "作答狀態";
    d.notice.hidden = !controller.notice; d.notice.textContent = controller.notice;
    d.saveRetryButton.hidden = !controller.editable || !controller.unsaved;
    d.recoverButton.hidden = !controller.canRecover;
    d.experimentNav.hidden = !s || v.phase !== "collect"; d.graphNav.hidden = !s || v.phase !== "plot";
    for (const b of document.querySelectorAll("[data-phase]")) { b.disabled = !s; b.setAttribute("aria-current", b.dataset.phase === v.phase ? "step" : "false"); }
    for (const b of document.querySelectorAll("[data-group]")) b.setAttribute("aria-current", v.phase === "collect" && +b.dataset.group === v.index ? "step" : "false");
    for (const b of d.graphNav.querySelectorAll("[data-graph]")) b.setAttribute("aria-current", v.phase === "plot" && +b.dataset.graph === v.index ? "step" : "false");
    d.checkButton.hidden = locked; d.editableFooter.hidden = locked;
    d.returnCheck.hidden = !controller.editable || !s?.returnToCheck;
    for (const phase of ["collect", "plot", "conclude", "check"]) d[`${phase}Panel`].hidden = !s || v.phase !== phase;
    d.resultPanel.hidden = controller.editable || controller.mode === "technical" || controller.mode === "submitting";
    d.reviewTitle.textContent = controller.mode === "frozen" ? "提交尚未確認" : controller.mode === "committed" ? "成績已記錄" : controller.mode === "mismatch" ? "已完成紀錄未能核對" : "只讀檢討";
    d.scorePanel.innerHTML = controller.result ? `<strong>${controller.result.score === null ? "—" : display(controller.result.score)} / 100</strong><p>${esc(SimActivityFlow.completionLabel(controller.result.passed))}</p>` : "— · 成績尚未確認";
    d.retryFinalButton.hidden = !["frozen", "committed"].includes(controller.mode);
    d.retryFinalButton.textContent = controller.mode === "committed" ? "重試完成程序" : "重試同一份提交";
    if (s) {
      if (v.phase === "collect") renderCollect(v.index);
      if (v.phase === "plot") renderPlot(v.index);
      if (v.phase === "conclude") for (const r of d.conclusionFields.querySelectorAll("input")) { r.checked = s.conclusions[+r.dataset.conclusion] === r.value; r.disabled = locked; }
      if (v.phase === "check") renderCheck();
    }
    renderFeedback(); renderStage();
  }
  function renderCollect(i) {
    const s = controller.state, g = s.groups[i], setup = s.setups?.[i], busy = Boolean(run), locked = !editable();
    d.collectTitle.textContent = i === 0 ? "A · 探究合外力" : "B · 探究總質量";
    d.collectPrompt.textContent = `探究${i === 0 ? "合外力" : "總質量"}對加速度的影響。請自行決定改變、保持不變及量度的量。`;
    for (let j = 0; j < 3; j++) { d[`role${j}`].value = g.roles[j] || ""; d[`role${j}`].disabled = locked || busy; }
    d.instrumentControls.hidden = locked;
    if (setup) {
      const [mi, fi] = setup.settings;
      d.massValue.textContent = `${M.mass(mi).toFixed(2)} kg`; d.forceValue.textContent = `${M.force(fi).toFixed(2)} N`;
      d.forceRange.value = fi; d.forceRange.setAttribute("aria-valuetext", `${M.force(fi).toFixed(2)} 牛頓`);
      for (const [name, j] of [["mass", 0], ["force", 1]]) {
        d[`${name}Lock`].setAttribute("aria-pressed", String(setup.locks[j])); d[`${name}Lock`].textContent = setup.locks[j] ? "已鎖定" : "鎖定";
        d[`${name}Lock`].disabled = busy || locked;
      }
      d.massDown.disabled = locked || busy || setup.locks[0] || mi === 0; d.massUp.disabled = locked || busy || setup.locks[0] || mi === 6;
      d.forceDown.disabled = locked || busy || setup.locks[1] || fi === 0; d.forceUp.disabled = locked || busy || setup.locks[1] || fi === 5;
      d.forceRange.disabled = locked || busy || setup.locks[1];
      d.measureButton.disabled = locked || busy || g.records.length >= 6;
      d.measureButton.textContent = busy ? "量測中…" : g.records.length >= 6 ? "本組已有 6 筆記錄" : setup.candidate ? "重新量測" : "啟動量測";
      d.measurementReadout.innerHTML = busy ? "正在記錄速度變化…" : setup.candidate ? `<var>a</var> = <strong>${(setup.candidate[2] / 1000).toFixed(3)}</strong> m/s²` : "加速度讀數將在量測完成後顯示。";
      d.recordButton.disabled = locked || busy || !setup.candidate || g.records.length >= 6;
      d.replayButton.disabled = locked || busy || !setup.candidate;
      d.sensorGraph.innerHTML = setup.candidate ? E.sensorSvg(setup.candidate) : "";
    }
    d.recordCount.textContent = `${g.records.length} / 6 筆`;
    d.recordTable.innerHTML = g.records.length ? `<table><thead><tr><th>筆</th><th><var>m</var><small>kg</small></th><th><var>F</var><sub>合</sub><small>N</small></th><th><var>a</var><small>m/s²</small></th>${locked ? "" : '<th aria-label="操作"></th>'}</tr></thead><tbody>${g.records.map((r, n) => { const q = M.values(r); return `<tr><td>${n + 1}</td><td>${q.m.toFixed(2)}</td><td>${q.f.toFixed(2)}</td><td>${q.a.toFixed(3)}</td>${locked ? "" : `<td><button data-delete-record="${n}" aria-label="刪除第${n + 1}筆量測" ${busy ? "disabled" : ""}>×</button></td>`}</tr>`; }).join("")}</tbody></table>` : '<p class="small">尚未加入量測記錄。</p>';
    d.clearGroup.hidden = locked; d.clearGroup.disabled = busy || !g.records.length;
  }
  function renderPlot(i) {
    const s = controller.state, p = s.plots[i], rows = s.groups[M.sourceGroup(i)].records, locked = !editable();
    selected = rows.length ? Math.max(0, Math.min(selected, rows.length - 1)) : -1;
    d.graphKicker.textContent = `使用實驗 ${i === 0 ? "A" : "B"} 的原始數據`;
    d.plotTitle.innerHTML = `${graphName(i)} 圖`;
    const xt = i === 0 ? '<var>F</var><sub>合</sub><small>N</small>' : i === 1 ? '<var>m</var><small>kg</small>' : '1/<var>m</var><small>kg⁻¹</small>';
    d.plotTable.innerHTML = rows.length ? `<table><thead><tr><th>選取</th>${i === 2 ? '<th><var>m</var><small>kg</small></th>' : ""}<th>${xt}</th><th><var>a</var><small>m/s²</small></th><th>點位</th></tr></thead><tbody>${rows.map((r, n) => { const v = M.values(r), xy = M.expected(i, r); return `<tr><td><button class="row-select" data-select-row="${n}" aria-pressed="${n === selected}">#${n + 1}</button></td>${i === 2 ? `<td>${v.m.toFixed(2)}</td>` : ""}<td>${xy[0].toFixed(i === 2 ? 3 : 2)}</td><td>${v.a.toFixed(3)}</td><td>${p.points[n] ? "已放" : "待放"}</td></tr>`; }).join("")}</tbody></table>` : '<p class="small">此組尚無記錄；可返回實驗頁收集數據。</p>';
    d.pointControls.hidden = locked || !rows.length; d.removePoint.disabled = !p.points[selected];
    d.fitModel.value = p.model || ""; d.fitModel.disabled = locked;
    d.fitButton.hidden = locked; d.fitButton.disabled = !p.model;
    if (p.fitAttempted) {
      const fit = F.fit(p.model, F.plotted(p));
      d.fitResult.innerHTML = fit.ok ? `<p class="equation">${equation(fit)}</p><p>使用 ${fit.n} 個已放點<br>RMSE = ${display(fit.rmse)} m/s²${fit.model === "linear" ? `<br>截距 b = ${display(fit.coefficients[1])} m/s²` : ""}</p>` : `<p>${esc(fit.message)}</p><p>目前有 ${fit.n} 個已放點。</p>`;
    } else d.fitResult.innerHTML = `<p>${p.model ? "點位或方法改動後，請按「擬合我的點」。" : "選擇模型，再用自己的點進行擬合。"}</p>`;
    d.clearGraph.hidden = locked; d.clearGraph.disabled = !p.points.some(Boolean) && !p.model;
    d.referenceButton.hidden = !controller.trusted; d.referenceButton.setAttribute("aria-pressed", String(showReference));
    d.referenceButton.textContent = showReference ? "隱藏參考點" : "顯示參考點";
  }
  function equation(fit) {
    const c = fit.coefficients.map(v => Math.abs(v) < 1e-12 ? 0 : v), signed = (v, suffix = "") => `${v < 0 ? " − " : " + "}${display(Math.abs(v))}${suffix}`;
    if (fit.model === "linear") return `y = ${display(c[0])}x${signed(c[1])}`;
    if (fit.model === "origin") return `y = ${display(c[0])}x`;
    if (fit.model === "inverse") return `y = ${display(c[0])}/x`;
    return `y = ${display(c[0])}x²${signed(c[1], "x")}${signed(c[2])}`;
  }
  function renderCheck() {
    const s = controller.state;
    d.checkSummary.innerHTML = s.groups.map((g, i) => `<button data-check-phase="collect" data-index="${i}">實驗 ${i === 0 ? "A" : "B"}<span>變量選擇 ${g.roles.filter(Boolean).length}/3 · 已記錄 ${g.records.length}/6 筆${s.setups[i].candidate ? " · 有一筆讀數尚未加入" : ""}</span></button>`).join("") + s.plots.map((p, i) => `<button data-check-phase="plot" data-index="${i}">${graphName(i)} 圖<span>已放 ${p.points.filter(Boolean).length}/${p.points.length} 個資料點 · ${p.fitAttempted ? "已嘗試擬合" : "未擬合"}</span></button>`).join("") + `<button data-check-phase="conclude">歸納<span>已回答 ${s.conclusions.filter(Boolean).length}/5 項</span></button>`;
    d.submitButton.disabled = controller.unsaved;
  }
  function renderFeedback() {
    d.feedback.hidden = !controller.trusted || !controller.result?.detail;
    if (d.feedback.hidden) { d.feedback.replaceChildren(); return; }
    const result = controller.result.detail, v = view(), rows = [];
    if (v.phase === "collect") {
      const r = result.experiments[v.index], g = controller.state.groups[v.index];
      rows.push(`<h3>實驗設計 ${display(r.score)} / 15</h3>`);
      const labels = { mass: "總質量", force: "合外力", acceleration: "加速度" };
      rows.push(`<p>本組應改變${labels[r.expectedRoles[0]]}、保持${labels[r.expectedRoles[1]]}不變，並量度加速度。</p>`);
      if (r.count < 2) rows.push('<p class="issue">需要不同條件的多筆量測，才能比較關係。</p>');
      else if (r.best.count < r.count) rows.push(`<p class="issue">第 ${g.records.map((_, i) => i).filter(i => !r.best.rows.includes(i)).map(i => i + 1).join("、")} 筆的控制量與主要資料組不同，不能混在一起判斷單一變量的影響。</p>`);
      else rows.push('<p class="ok">保留記錄的控制量一致。</p>');
      rows.push(`<p>一致條件中有 ${r.best.unique} 個不同水平；請同時留意數量及跨度。</p>`);
    } else if (v.phase === "plot") {
      const r = result.graphs[v.index]; rows.push(`<h3>作圖 ${display(r.pointScore)} / 10 · 擬合 ${display(r.modelScore + r.fitScore)} / 5</h3>`);
      for (let i = 0; i < r.points.length; i++) {
        const p = r.points[i]; rows.push(`<p class="${p.correct.every(Boolean) ? "ok" : "issue"}">#${i + 1}：${!p.actual ? "尚未放點。" : p.correct.every(Boolean) ? "兩個座標都符合記錄。" : `請核對${!p.correct[0] ? "橫座標" : ""}${!p.correct[0] && !p.correct[1] ? "及" : ""}${!p.correct[1] ? "縱座標" : ""}。`}</p>`);
      }
      rows.push(`<p>${v.index === 1 ? "反比例模型適合描述固定合外力時的 a–m 關係。下降曲線本身不足以證明反比，可再看 a–1/m 圖。" : "直線是簡潔的模型；還要檢查截距是否接近零，才能支持正比。二次項接近零時，二次式可簡化為直線。"}</p>`);
      if (r.points.some(p => !p.correct.every(Boolean))) rows.push('<p>擬合使用的是你的點位；曲線貼近這些點，不代表已忠實繪出原始數據。</p>');
      if (showReference) rows.push('<p>橙圈：原始記錄座標；藍點：我的作圖。參考點不改動你的答案。</p>');
    } else {
      rows.push('<h3>規律與條件</h3>');
      M.QUESTIONS.forEach((q, i) => rows.push(`<p class="${result.conclusions[i] ? "ok" : "issue"}">${i + 1}. ${esc(q.options[0][1])}。${result.conclusions[i] ? "你的判斷正確。" : "請對照題目中的控制條件與圖像證據。"}</p>`));
      rows.push('<p>在總質量不變時，加速度與合外力成正比；在合外力不變時，加速度與總質量成反比。在本活動的 SI 單位中：<var>F</var><sub>合</sub> = <var>ma</var>。</p><p class="small">延伸：a–F合 的斜率對應 1/m（kg⁻¹）；a–1/m 的斜率對應 F合（N）。有限讀數精度會帶來很小的擬合偏差。</p>');
    }
    d.feedback.innerHTML = rows.join("");
  }
  function renderStage() {
    const s = controller.state, v = view(), rect = d.stage.getBoundingClientRect();
    if (!s || rect.width < 1 || rect.height < 1 || !["collect", "plot"].includes(v.phase)) { d.sourceHandle.hidden = true; d.stageSvg.replaceChildren(); for (const b of handles.values()) b.hidden = true; return; }
    d.stageSvg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    if (v.phase === "collect") {
      d.sourceHandle.hidden = true;
      const setup = s.setups?.[v.index], first = s.groups[v.index].records[0], settings = setup?.settings || first?.slice(0, 2) || [2, 2];
      const t = run ? Math.min(1, (performance.now() - run.started) / 1000) : setup?.candidate || (!controller.editable && first) ? 1 : 0;
      d.stageSvg.setAttribute("aria-label", "水平小車在可調恆力下由靜止加速，總質量包含配重");
      d.stageSvg.innerHTML = E.svg(rect.width, rect.height, settings, t, !run && t === 1, v.index);
      for (const b of handles.values()) b.hidden = true; geometry = null; return;
    }
    geometry = G.geometry(rect.width, rect.height, M.bounds(s, v.index));
    const working = drag?.point || keyboard?.point || null, plot = s.plots[v.index], records = s.groups[M.sourceGroup(v.index)].records;
    d.stageSvg.setAttribute("aria-label", `${M.GRAPH_NAMES[v.index]} 圖，縱軸加速度，${records.length}筆原始記錄`);
    d.stageSvg.innerHTML = G.svg(s, v.index, geometry, selected, working, showReference && controller.trusted);
    // Keep the focused/captured source mounted and visible across working renders.
    d.sourceHandle.hidden = !(editable() && records[selected]);
    if (editable() && records[selected]) {
      const xy = M.expected(v.index, records[selected]); d.sourceHandle.hidden = false;
      if (!drag) d.sourceHandle.innerHTML = `<strong>#${selected + 1} · ${plot.points[selected] ? "拖動重新放點" : "拖入圖框"}</strong><span>x = ${xy[0].toFixed(3)}　y = ${xy[1].toFixed(3)}</span>`;
      d.sourceHandle.setAttribute("aria-label", `第${selected + 1}筆資料，橫座標${xy[0]}，縱座標${xy[1]}，拖入圖框或按Enter開始鍵盤放點`);
    }
    for (const [key, b] of handles) if (!key.startsWith(`${v.index}:`)) b.hidden = true;
    plot.points.forEach((encoded, i) => {
      const key = `${v.index}:${i}`; let button = handles.get(key);
      if (!button) { button = document.createElement("button"); button.dataset.point = i; button.dataset.graph = v.index; button.type = "button"; d.pointHandles.append(button); handles.set(key, button); bindPoint(button); }
      const point = i === selected && working ? working : encoded?.map(n => n / 10000);
      button.hidden = !editable() || !point;
      if (point) { const h = G.handle(geometry, point); button.className = h.offscale ? "offscale-point-hit" : "plot-point-hit"; button.style.left = `${h.x}px`; button.style.top = `${h.y}px`; button.style.zIndex = i === selected ? "6" : "2"; button.setAttribute("aria-label", `第${i + 1}筆圖點，${h.offscale ? "超出圖框，" : ""}座標${G.fmt(point[0])}，${G.fmt(point[1])}`); }
    });
    for (const [key, b] of handles) if (key.startsWith(`${v.index}:`) && +key.split(":")[1] >= plot.points.length) b.hidden = true;
  }
  function preview(point) {
    if (!geometry || !drag || drag.type === "mouse") return;
    const w = Math.min(176, Math.max(124, geometry.width * .4)), h = Math.min(114, Math.max(64, geometry.height * .28));
    d.magnifier.style.width = `${w}px`; d.magnifier.style.height = `${h}px`;
    const focus = G.pixel(geometry, point), candidates = [{ x: 34, y: 3 }, { x: geometry.width - 34 - w, y: 3 }, { x: 34, y: geometry.height - h - 3 }, { x: geometry.width - 34 - w, y: geometry.height - h - 3 }];
    const clear = q => !(drag.cursor.x > q.x - 18 && drag.cursor.x < q.x + w + 18 && drag.cursor.y > q.y - 18 && drag.cursor.y < q.y + h + 18);
    let corner = lastPreviewCorner;
    if (!corner || !clear(corner)) corner = candidates.sort((a, b) => Math.hypot(b.x + w / 2 - drag.cursor.x, b.y + h / 2 - drag.cursor.y) - Math.hypot(a.x + w / 2 - drag.cursor.x, a.y + h / 2 - drag.cursor.y))[0];
    lastPreviewCorner = corner; d.magnifier.style.left = `${corner.x}px`; d.magnifier.style.top = `${corner.y}px`; d.magnifier.hidden = false;
    const iw = w - 4, ih = h - 4;
    d.magnifierSvg.setAttribute("viewBox", `${focus.x - iw / 4} ${focus.y - ih / 4} ${iw / 2} ${ih / 2}`);
    d.magnifierSvg.innerHTML = d.stageSvg.innerHTML.replaceAll("plot-clip", "preview-plot-clip") + `<path d="M${focus.x - 3} ${focus.y}h6M${focus.x} ${focus.y - 3}v6" stroke="#0f172a" stroke-width=".5"/>`;
    diagnostics.previews++;
  }
  function beginDrag(event, index, target) {
    if (!editable() || view().phase !== "plot" || !geometry || event.button > 0 || event.isPrimary === false) return;
    const plot = controller.state.plots[view().index]; if (!M.integer(index, 0, plot.points.length - 1)) return;
    event.preventDefault(); cancelWork(); selected = index;
    drag = { id: event.pointerId, target, index, graph: view().index, type: event.pointerType, point: plot.points[index]?.map(v => v / 10000) || null, held: null, cursor: localPoint(event) };
    target.setPointerCapture(event.pointerId); diagnostics.downs++; diagnostics.lastTarget = target === d.sourceHandle ? "source" : "point";
    if (event.isTrusted && event.pointerType === "touch") diagnostics.trustedTouch++;
    renderStage();
  }
  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault(); diagnostics.moves++; drag.cursor = localPoint(event);
    const known = M.expected(drag.graph, controller.state.groups[M.sourceGroup(drag.graph)].records[drag.index]);
    const snap = G.snap(geometry, drag.cursor, known, drag.type, drag.held); drag.point = snap.point; drag.held = snap.held;
    renderStage(); preview(drag.point);
  }
  function finishDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault(); const current = drag, valid = G.inside(geometry, localPoint(event)), point = current.point;
    diagnostics.ups++; cancelWork();
    if (valid && point) command({ type: "place", graph: current.graph, index: current.index, point: G.encoded(point) });
    render();
  }
  function pointKey(event, index) {
    if (!editable() || view().phase !== "plot" || !geometry) return;
    if (!["Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") { cancelWork(); render(); return; }
    if (event.key === "Delete" || event.key === "Backspace") { cancelWork(); command({ type: "place", index, point: null }); return; }
    if (!keyboard) {
      selected = index; const existing = controller.state.plots[view().index].points[index];
      const point = existing ? existing.map(v => v / 10000) : [geometry.range.x / 2, geometry.range.y / 2];
      keyboard = { graph: view().index, index, point: point.slice(), raw: point.slice(), held: null }; d.keyboardHelp.hidden = false; renderStage();
      if (event.key === "Enter") return;
    }
    if (event.key === "Enter") { const k = keyboard; cancelWork(); command({ type: "place", graph: k.graph, index: k.index, point: G.encoded(k.point) }); render(); return; }
    const axis = ["ArrowLeft", "ArrowRight"].includes(event.key) ? 0 : 1, direction = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1;
    const step = (axis ? geometry.minorY : geometry.minorX) / (event.shiftKey ? 1 : 10);
    keyboard.raw[axis] = G.clamp(keyboard.raw[axis] + direction * step, 0, axis ? geometry.range.y : geometry.range.x);
    const known = M.expected(keyboard.graph, controller.state.groups[M.sourceGroup(keyboard.graph)].records[keyboard.index]);
    const snapped = G.snap(geometry, G.pixel(geometry, keyboard.raw), known, "mouse", keyboard.held);
    keyboard.point = snapped.point; keyboard.held = snapped.held; renderStage();
  }
  function bindPoint(button) {
    button.addEventListener("pointerdown", e => beginDrag(e, +button.dataset.point, button)); button.addEventListener("pointermove", moveDrag); button.addEventListener("pointerup", finishDrag);
    for (const name of ["pointercancel", "lostpointercapture"]) button.addEventListener(name, () => { if (drag?.target === button) { cancelWork(true); render(); } });
    button.addEventListener("keydown", e => pointKey(e, +button.dataset.point));
  }
  d.sourceHandle.addEventListener("pointerdown", e => beginDrag(e, selected, d.sourceHandle));
  d.sourceHandle.addEventListener("pointermove", moveDrag); d.sourceHandle.addEventListener("pointerup", finishDrag);
  for (const name of ["pointercancel", "lostpointercapture"]) d.sourceHandle.addEventListener(name, () => { if (drag?.target === d.sourceHandle) { cancelWork(true); render(); } });
  d.sourceHandle.addEventListener("keydown", e => pointKey(e, selected));
  for (const b of document.querySelectorAll(".workflow [data-phase]")) b.addEventListener("click", () => {
    const phase = b.dataset.phase, v = view(); navigate(phase, phase === "collect" ? v.phase === "plot" ? M.sourceGroup(v.index) : lastGroup : phase === "plot" ? v.phase === "collect" ? (v.index === 0 ? 0 : lastGraph || 1) : lastGraph : null);
  });
  for (const b of d.experimentNav.querySelectorAll("button")) b.addEventListener("click", () => navigate("collect", +b.dataset.group));
  for (const b of d.graphNav.querySelectorAll("button")) b.addEventListener("click", () => navigate("plot", +b.dataset.graph));
  for (let i = 0; i < 3; i++) d[`role${i}`].addEventListener("change", e => command({ type: "role", index: i, value: e.target.value || null }));
  function adjustSetting(index, delta) { const i = view().index; command({ type: "setting", group: i, index, value: controller.state.setups[i].settings[index] + delta }); }
  d.massDown.onclick = () => adjustSetting(0, -1); d.massUp.onclick = () => adjustSetting(0, 1); d.forceDown.onclick = () => adjustSetting(1, -1); d.forceUp.onclick = () => adjustSetting(1, 1);
  d.massLock.onclick = () => command({ type: "lock", index: 0 }); d.forceLock.onclick = () => command({ type: "lock", index: 1 });
  d.forceRange.addEventListener("input", e => command({ type: "setting", index: 1, value: +e.target.value }));
  function startRun(replay = false) {
    if (!editable() || view().phase !== "collect" || run) return;
    const group = view().index;
    if (!replay && controller.state.groups[group].records.length >= 6) return;
    if (!replay) command({ type: "discard", group });
    if (reduced.matches) { if (!replay) command({ type: "measure", group }); render(); return; }
    run = { group, replay, started: performance.now() }; render();
  }
  d.measureButton.onclick = () => startRun(); d.replayButton.onclick = () => startRun(true);
  d.recordButton.onclick = () => { if (!run) command({ type: "record" }); };
  d.recordTable.addEventListener("click", e => { const b = e.target.closest("[data-delete-record]"); if (!b || !editable() || run) return; const index = +b.dataset.deleteRecord, group = view().index;
    if (M.related(group).some(g => controller.state.plots[g].points[index]) && !confirm("刪除此筆量測會移除它在相關圖上的點，並需要重新擬合。其他資料會保留。")) return;
    command({ type: "removeRecord", index });
  });
  d.goGraph.onclick = () => navigate("plot", view().index === 0 ? 0 : 1);
  d.returnExperiment.onclick = () => navigate("collect", M.sourceGroup(view().index));
  d.clearGroup.onclick = () => { if (editable() && confirm("清除此組量測及相關圖點和擬合？另一組資料和歸納答案會保留。")) command({ type: "clearGroup" }); };
  d.clearGraph.onclick = () => { if (editable() && confirm("清除此圖的點位和擬合？原始量測及其他圖會保留。")) { cancelWork(); command({ type: "clearGraph" }); } };
  d.clearAllButton.onclick = () => { if (controller.editable && confirm("清除全部實驗資料、圖點、擬合及歸納答案，重新作答？")) { cancelWork(); run = null; controller.clearAllAnswers(); d.controlPanel.scrollTop = 0; } };
  d.plotTable.addEventListener("click", e => { const b = e.target.closest("[data-select-row]"); if (b) { cancelWork(); selected = +b.dataset.selectRow; render(); } });
  d.keyboardPlace.onclick = () => { if (editable() && selected >= 0) { pointKey({ key: "Enter", preventDefault() {} }, selected); d.sourceHandle.focus({ preventScroll: true }); } };
  d.removePoint.onclick = () => { cancelWork(); command({ type: "place", index: selected, point: null }); };
  d.fitModel.onchange = e => { cancelWork(); command({ type: "model", value: e.target.value || null }); };
  d.fitButton.onclick = () => { cancelWork(); command({ type: "fit" }); };
  d.referenceButton.onclick = () => { if (controller.trusted) { showReference = !showReference; render(); } };
  d.conclusionFields.addEventListener("change", e => { if (e.target.matches("input[data-conclusion]")) command({ type: "conclusion", index: +e.target.dataset.conclusion, value: e.target.value }); });
  d.checkButton.onclick = d.returnCheck.onclick = () => navigate("check");
  d.checkSummary.addEventListener("click", e => { const b = e.target.closest("[data-check-phase]"); if (b) navigate(b.dataset.checkPhase, b.dataset.index == null ? null : +b.dataset.index); });
  d.submitButton.onclick = () => { cancelWork(); run = null; showReference = false; controller.submit(); d.controlPanel.scrollTop = 0; };
  d.saveRetryButton.onclick = () => controller.retrySave(); d.retryFinalButton.onclick = () => controller.retryFinal();
  d.recoverButton.onclick = () => { if (confirm("已確認這是未提交的損壞草稿。清除並開始空白作答？")) controller.recoverDraft(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && (drag || keyboard)) { e.preventDefault(); cancelWork(); render(); } });
  const owners = new Map(); let handoff = false;
  const ownTarget = target => target?.closest?.(".data-point-source, .plot-point-hit, .offscale-point-hit, .force-range");
  document.addEventListener("pointerdown", e => { if (e.pointerType === "touch" && e.isPrimary === false && drag) { handoff = d.controlPanel.contains(e.target); cancelWork(true); render(); } }, true);
  document.addEventListener("touchstart", e => {
    for (const t of e.changedTouches) {
      const owner = ownTarget(t.target) ? "draw" : d.stage.contains(t.target) ? "host" : handoff && d.controlPanel.contains(t.target) ? "panel-handoff" : "native";
      owners.set(t.identifier, { owner, y: owner === "host" ? t.screenY : t.clientY });
    }
    handoff = false;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    let handled = false;
    for (const t of e.changedTouches) {
      const r = owners.get(t.identifier); if (!r) continue;
      const y = r.owner === "host" ? t.screenY : t.clientY, delta = r.y - y; r.y = y;
      if (r.owner === "host") { try { if (window.parent !== window && window.parent.document) { window.parent.scrollBy(0, delta / (window.parent.visualViewport?.scale || 1)); handled = true; } } catch (_) { /* Cross-origin players need separate host acceptance. */ } }
      else if (r.owner === "panel-handoff") { d.controlPanel.scrollTop += delta; handled = true; }
    }
    if (handled && e.cancelable) e.preventDefault();
  }, { passive: false });
  for (const name of ["touchend", "touchcancel"]) document.addEventListener(name, e => { for (const t of e.changedTouches) owners.delete(t.identifier); }, { passive: true });
  window.addEventListener("blur", () => { cancelWork(true); run = null; render(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelWork(true); run = null; render(); } });
  window.addEventListener("resize", () => { cancelWork(true); renderStage(); });
  new ResizeObserver(() => { if (drag || keyboard) cancelWork(true); renderStage(); }).observe(d.stage);
  function frame(now) {
    if (run) {
      if (!editable() || view().phase !== "collect" || view().index !== run.group) { run = null; render(); }
      else if (now - run.started >= 1000) { const previous = run; run = null; if (!previous.replay) command({ type: "measure", group: previous.group }); else render(); }
      else renderStage();
    }
    requestAnimationFrame(frame);
  }
  window.__newtonApp = Object.freeze({ getState: () => M.clone(controller.state), getMode: () => controller.mode, getGeometry: () => M.clone(geometry), getResult: () => M.clone(controller.result),
    getPointerDiagnostics: () => ({ ...diagnostics }), getSnapshot: () => controller.editable ? controller.draftSnapshot() : M.clone(controller.finalSnapshot), getRunning: () => Boolean(run) });
  controller.start(); requestAnimationFrame(frame);
})();
