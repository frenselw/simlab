(function () {
  "use strict";
  const M = CentripetalModel, P = CentripetalPersistence, S = CentripetalScoring;
  const $ = id => document.getElementById(id), stage = $("stageContent"), device = $("deviceSvg"), graph = $("graphSvg");
  const titles = ["改變半徑", "改變總質量", "改變角速率"];
  const prompts = ["把兩側質量設成相同，再改變半徑；同步讀取兩側的徑向力。", "把兩側半徑設成相同，再改變質量；同步讀取兩側的徑向力。", "保持 A 側質量與半徑不變，改變平台角速率，觀察 A 側徑向力。"];
  const compareOptions = [["supports", "單變量結論有支持"], ["confounded", "兩個量同時改變，不能隔離"], ["no-contrast", "被研究量沒有差異"], ["insufficient", "資料不足"]];
  const reasonOptions = [["coefficient", "斜率對應兩側物理量比值／二次項對應 mr"], ["constant", "只有常數項代表關係"], ["other", "係數與配置無關"], ["uncertain", "配置混雜或資料不足，不能隔離解釋"]];
  const lawOptions = [["linear", "F 與研究量成正比（其餘量固定）"], ["square", "F 與研究量的平方成正比（其餘量固定）"], ["inverse", "F 與研究量成反比"], ["none", "沒有可描述的關係"]];
  const controller = new CentripetalRuntime.Controller(SimScorm, SimActivityFlow, render);
  let motion = M.motion(), running = false, drag = null, lastFrame = 0, localMessage = "", reviewRun = [null, null, null];
  const state = () => controller.state, page = () => controller.editable ? state().page : controller.reviewPage;
  const view = () => controller.editable ? state().view : controller.reviewView;
  const task = () => state()?.tasks[page()];
  const activeRun = () => task()?.current === null ? null : task().runs[task().current];
  const shownRun = () => controller.editable ? activeRun() : task()?.runs[reviewRun[page()] ?? task().selected ?? 0] || null;
  const fmt = value => Number(value.toPrecision(3)).toString();
  const safe = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function ordered(options, id) {
    const seed = state()?.seed || 0, hash = key => { let value = (seed ^ 2166136261) >>> 0;
      for (const char of id + key) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
      return value; };
    return options.slice().sort((a, b) => hash(a[0]) - hash(b[0]));
  }
  function pause() { running = false; motion = { ...motion, omega: 0, pointerAngle: null, time: null }; if (drag) cancelDrag(); }
  function mapPoint(x, y) {
    const rect = stage.getBoundingClientRect(), scale = Math.min(rect.width / 600, rect.height / 360);
    return { x: rect.left + (rect.width - 600 * scale) / 2 + x * scale,
      y: rect.top + (rect.height - 360 * scale) / 2 + y * scale, scale };
  }
  function svgPoint(event) {
    const origin = mapPoint(0, 0), scale = origin.scale;
    return { x: (event.clientX - origin.x) / scale, y: (event.clientY - origin.y) / scale };
  }
  const componentX = (side, index) => 300 + (side === "A" ? 1 : -1) * (64 + index * 18);
  function positionHit(button, x, y) {
    const p = mapPoint(x, y), r = stage.getBoundingClientRect();
    button.style.left = `${p.x - r.left - button.offsetWidth / 2}px`;
    button.style.top = `${p.y - r.top - button.offsetHeight / 2}px`;
  }
  function layoutTargets() {
    if (!state()) return;
    const cfg = task().work;
    for (const [side, i] of [["A", 0], ["B", 1]]) positionHit(document.querySelector(`.radius-handle[data-side="${side}"]`), componentX(side, cfg[i]), 185);
    document.querySelectorAll(".spin-segment").forEach((button, i) => {
      const a = (i / 12) * Math.PI * 2;
      positionHit(button, 300 + Math.cos(a) * 139, 185 + Math.sin(a) * 139);
    });
  }
  function makeTargets() {
    const host = $("spinTargets");
    for (let i = 0; i < 12; i++) {
      const button = document.createElement("button"); button.type = "button"; button.className = "spin-segment";
      button.textContent = "↻"; button.tabIndex = i === 0 ? 0 : -1;
      button.setAttribute("aria-label", i === 0 ? "操作環：左右方向鍵調速，空白鍵暫停" : `操作環第 ${i + 1} 段`);
      host.append(button);
    }
    new ResizeObserver(layoutTargets).observe(stage);
  }
  function drawDevice() {
    const cfg = task()?.work || M.CFG, rA = componentX("A", cfg[0]), rB = componentX("B", cfg[1]);
    const angle = motion.angle * 180 / Math.PI;
    const selected = shownRun(), q = selected?.q || [];
    const mini = q.length ? `<g transform="translate(450 245)"><rect width="115" height="76" rx="6" fill="#fffef8" stroke="#a6bdc9"/><path d="M14 9V62H105" fill="none" stroke="#667e8b"/>${q.map(v => { const p = M.readings(selected.cfg, v / 1000); return `<circle cx="${14 + v / 6000 * 88}" cy="${62 - Math.min(1, p.a / 1.6) * 49}" r="2.8" fill="#146c88"/>`; }).join("")}<text x="17" y="73" font-size="9" fill="#476579">即時圖點 ${q.length}</text></g>` : "";
    device.innerHTML = `<defs><radialGradient id="disk"><stop stop-color="#fcfeff"/><stop offset="1" stop-color="#a8c6d4"/></radialGradient></defs>
      <rect x="0" y="0" width="600" height="360" fill="#e6f2f7"/><g stroke="#c2d8e2" stroke-width="1"><path d="M20 185H580"/><path d="M300 45V330"/></g>
      <circle cx="300" cy="185" r="144" fill="none" stroke="#bf8c32" stroke-width="19" stroke-dasharray="52 23"/><circle cx="300" cy="185" r="124" fill="url(#disk)" stroke="#6b95aa" stroke-width="5"/>
      <g transform="rotate(${angle} 300 185)"><path d="M${rB} 185H${rA}" stroke="#637e8d" stroke-width="14" stroke-linecap="round"/><circle cx="300" cy="185" r="21" fill="#315776" stroke="#15384f" stroke-width="4"/>
      <rect x="${rA - 24}" y="169" width="48" height="32" rx="7" fill="#8fd7e0" stroke="#076f89" stroke-width="3"/><rect x="${rB - 24}" y="169" width="48" height="32" rx="7" fill="#f6c68d" stroke="#ab641b" stroke-width="3"/>
      <circle cx="${rA}" cy="185" r="7" fill="#173f54"/><circle cx="${rB}" cy="185" r="7" fill="#173f54"/></g>
      <text x="${rA}" y="150" text-anchor="middle" font-size="22" font-weight="bold" fill="#075b75">A</text><text x="${rB}" y="150" text-anchor="middle" font-size="22" font-weight="bold" fill="#a3580e">B</text>
      <text x="300" y="325" text-anchor="middle" font-size="17" fill="#476579">操作環 · 拖得越快，角速率越大</text>${mini}`;
  }
  function graphAxes(kind) {
    return kind === "omega" ? { x: "ω (rad/s)", y: 'F<tspan baseline-shift="sub" font-size="70%">A</tspan> (N)' } :
      { x: 'F<tspan baseline-shift="sub" font-size="70%">B</tspan> (N)', y: 'F<tspan baseline-shift="sub" font-size="70%">A</tspan> (N)' };
  }
  function drawGraph() {
    const run = shownRun(), kind = M.KINDS[page()], axes = graphAxes(kind);
    const points = run ? M.points(kind, run) : [], alternate = task()?.runs.find(item => item !== run);
    const other = alternate ? M.points(kind, alternate) : [];
    const all = points.concat(other), maxX = Math.max(0.1, ...all.map(p => p[0])) * 1.12, maxY = Math.max(0.1, ...all.map(p => p[1])) * 1.12;
    const px = x => 63 + x / maxX * 480, py = y => 291 - y / maxY * 225;
    const box = stage.getBoundingClientRect(), scale = Math.min(box.width / 600, box.height / 360);
    const axisFont = Math.max(20, 18 / scale), tickFont = Math.max(14, 15 / scale);
    const result = run?.fit ? M.fit(kind, run) : null;
    const curve = result?.ok ? Array.from({ length: 51 }, (_, i) => {
      const x = i / 50 * result.maxX;
      return `${i ? "L" : "M"}${px(x).toFixed(2)} ${py(NewtonFitting.predict(result.model, result.coefficients, x)).toFixed(2)}`;
    }).join(" ") : "";
    graph.innerHTML = `<rect width="600" height="360" fill="#f9fcfd"/><path d="M63 53V291H555" fill="none" stroke="#35596d" stroke-width="2"/>
      <g stroke="#d4e1e7" stroke-width="1">${[1,2,3,4].map(i => `<path d="M63 ${291 - i * 45}H555M${63 + i * 96} 53V291"/>`).join("")}</g>
      <text x="300" y="337" text-anchor="middle" font-size="${axisFont}" fill="#284a5f">${axes.x}</text><text x="24" y="185" transform="rotate(-90 24 185)" text-anchor="middle" font-size="${axisFont}" fill="#284a5f">${axes.y}</text>
      <text x="63" y="312" font-size="${tickFont}">0</text><text x="508" y="312" font-size="${tickFont}">${fmt(maxX)}</text><text x="11" y="64" font-size="${tickFont}">${fmt(maxY)}</text>
      ${other.map(([x,y]) => `<circle cx="${px(x)}" cy="${py(y)}" r="4" fill="#b07932" opacity=".65"/>`).join("")}
      ${curve ? `<path d="${curve}" fill="none" stroke="#bd5a25" stroke-width="3"/>` : ""}
      ${points.map(([x,y]) => `<circle cx="${px(x)}" cy="${py(y)}" r="5" fill="#096b88" stroke="white" stroke-width="1.5"/>`).join("")}
      <text x="78" y="39" font-size="${tickFont}" fill="#315b71">本組 ${points.length} 點${other.length ? ` · 另一組 ${other.length} 點` : ""}</text>`;
  }
  function renderMotion() {
    if (!state()) return;
    const reading = M.readings(task().work, Math.abs(motion.omega));
    $("omegaRead").textContent = Math.abs(motion.omega).toFixed(3);
    $("forceARead").textContent = fmt(reading.a);
    $("forceBRead").textContent = fmt(reading.b);
    $("compactReadouts").innerHTML = `<var>ω</var> ${Math.abs(motion.omega).toFixed(3)} rad/s · <var>F</var><sub>A</sub> ${fmt(reading.a)} N · <var>F</var><sub>B</sub> ${fmt(reading.b)} N`;
    if (view() === "analyse") drawGraph(); else drawDevice();
  }
  function setSelect(id, options, value, disabled) {
    const select = $(id), selected = value ?? "";
    select.innerHTML = `<option value="">未答</option>${ordered(options, id).map(([key, label]) => `<option value="${key}">${safe(label)}</option>`).join("")}`;
    select.value = selected; select.disabled = disabled;
  }
  function renderRuns() {
    const t = task(), locked = !controller.editable || state().view === "check";
    $("runList").innerHTML = t.runs.length ? t.runs.map((run, i) => `<div class="run-card ${t.current === i || locked && reviewRun[page()] === i ? "current" : ""}"><strong>資料組 ${i + 1}</strong><p>${run.q.length} 個轉速槽 · A ${fmt(M.mass(run.cfg[2]))} kg / ${fmt(M.radius(run.cfg[0]))} m · B ${fmt(M.mass(run.cfg[3]))} kg / ${fmt(M.radius(run.cfg[1]))} m</p><div class="run-actions"><button data-run="view:${i}" ${controller.mode === "technical" || controller.mode === "mismatch" || state().view === "check" && controller.editable ? "disabled" : ""}>查看</button><button data-run="select:${i}" aria-pressed="${t.selected === i}" ${locked ? "disabled" : ""}>${t.selected === i ? "評分組 ✓" : "選為評分組"}</button>${locked ? "" : `<button data-run="delete:${i}">刪除本組</button>`}</div></div>`).join("") : "<p>尚未收集資料。你仍可回答概念題或檢查作答。</p>";
    $("runHint").textContent = t.runs.length >= 2 ? "最多保留兩組；如要再收集，先明確刪除其中一組。" : "不同配置請建立新資料組；舊組數據不會被改寫。";
  }
  function render() {
    const s = state(), locked = !controller.editable, p = page(), v = view();
    $("attemptStatus").textContent = controller.mode === "review" ? "已提交 · 只讀" : controller.mode === "committed" ? "成績已記錄 · 待完成程序" : controller.mode === "frozen" ? "提交待確認" : controller.mode === "technical" || controller.mode === "mismatch" ? "狀態需核對" : "操作轉盤與同步量測";
    $("notice").hidden = !controller.notice && !localMessage; $("notice").textContent = localMessage || controller.notice;
    $("saveRetryButton").hidden = locked || !controller.unsaved;
    $("resultPanel").hidden = controller.editable || controller.mode === "technical" || controller.mode === "submitting";
    $("reviewTitle").textContent = controller.mode === "frozen" ? "提交尚未確認" : controller.mode === "committed" ? "成績已記錄" : controller.mode === "mismatch" ? "已完成紀錄未能核對" : "只讀檢討";
    $("scorePanel").textContent = controller.result?.score === null || controller.result?.score === undefined ? "— · 成績尚未確認" : `${controller.result.score} / 100 · ${SimActivityFlow.completionLabel(controller.result.passed)}`;
    $("retryFinalButton").hidden = !["frozen", "committed"].includes(controller.mode);
    $("retryFinalButton").textContent = controller.mode === "committed" ? "重試完成程序" : "重試同一份提交";
    $("taskPanel").hidden = !s || v === "check"; $("checkPanel").hidden = !s || v !== "check";
    $("feedbackPanel").hidden = controller.mode !== "review" && controller.mode !== "committed";
    $("checkButton").hidden = locked; $("checkButton").disabled = !s;
    for (const button of document.querySelectorAll("[data-page]")) { button.disabled = !s; button.setAttribute("aria-current", Number(button.dataset.page) === p ? "page" : "false"); }
    if (!s) { $("stageHint").textContent = "作答資料尚未能安全讀取。"; return; }
    const t = task(), cfg = t.work, run = shownRun(), editing = !locked && v !== "check";
    $("taskNumber").textContent = `實驗 ${p + 1} / 3`; $("taskTitle").textContent = titles[p]; $("taskPrompt").textContent = prompts[p];
    $("setupPanel").hidden = v !== "setup"; $("collectPanel").hidden = v !== "collect"; $("analysePanel").hidden = v !== "analyse";
    $("setupView").disabled = !editing; $("collectView").disabled = !editing || t.current === null; $("analyseView").disabled = !editing || t.current === null;
    for (const [id, target] of [["setupView", "setup"], ["collectView", "collect"], ["analyseView", "analyse"]]) $(id).setAttribute("aria-current", v === target ? "page" : "false");
    $("independent").value = t.roles[0] || ""; $("independent").disabled = !editing;
    for (const input of document.querySelectorAll("[data-control]")) { input.checked = (t.roles[1] || []).includes(input.dataset.control); input.disabled = !editing; }
    ["rAValue", "rBValue"].forEach((id, i) => { $(id).textContent = `${M.radius(cfg[i]).toFixed(2)} m`; });
    ["mAValue", "mBValue"].forEach((id, i) => { $(id).textContent = `${M.mass(cfg[i + 2]).toFixed(3)} kg`; });
    for (const button of document.querySelectorAll("[data-step]")) { const [field, delta] = button.dataset.step.split(":").map(Number); button.disabled = !editing || v !== "setup" || cfg[field] + delta < 0 || cfg[field] + delta > (field < 2 ? 6 : 8); }
    $("startButton").disabled = !editing || t.runs.length >= 2;
    $("resumeButton").disabled = !editing || running; $("stopButton").disabled = !editing;
    $("collectStatus").textContent = running ? `正在收集 · ${activeRun()?.q.length || 0} 點` : `已暫停 · ${activeRun()?.q.length || 0} 點；可繼續收集`;
    $("fitButton").disabled = !editing || !activeRun(); $("resumeFromGraph").disabled = !editing || !activeRun();
    $("axisLabel").innerHTML = p === 2 ? "橫軸 <var>ω</var>（rad/s）；縱軸 <var>F</var><sub>A</sub>（N）。二次擬合含一次項及常數項。" : "橫軸 <var>F</var><sub>B</sub>（N）；縱軸 <var>F</var><sub>A</sub>（N）。線性擬合含截距。";
    const fit = run?.fit ? M.fit(M.KINDS[p], run) : null;
    $("fitResult").innerHTML = fit?.ok ? p === 2 ? `<var>F</var><sub>A</sub> = ${fmt(fit.coefficients[0])}<var>ω</var><sup>2</sup> + ${fmt(fit.coefficients[1])}<var>ω</var> + ${fmt(fit.coefficients[2])} N；RMSE ${fmt(fit.rmse)} N` : `<var>F</var><sub>A</sub> = ${fmt(fit.coefficients[0])}<var>F</var><sub>B</sub> + ${fmt(fit.coefficients[1])} N；RMSE ${fmt(fit.rmse)} N` :
      run?.a.some(Boolean) && run.q.length >= 2 ? "資料已更新或尚未擬合；原有結論保留，請重新擬合比較。" : "尚未擬合；請先收集足夠的不同轉速。";
    $("numericPrompt").innerHTML = p === 2 ? "角速率加倍時，力變成多少倍？" : p === 0 ? "<var>r</var><sub>A</sub> / <var>r</var><sub>B</sub> = ?" : "<var>m</var><sub>A</sub> / <var>m</var><sub>B</sub> = ?";
    $("numericAnswer").value = run?.a[0] || ""; $("numericAnswer").disabled = !editing || !activeRun();
    setSelect("comparison", p === 2 ? lawOptions : compareOptions, run?.a[1], !editing || !activeRun());
    setSelect("reason", reasonOptions, run?.a[2], !editing || !activeRun());
    $("lawPrompt").textContent = p === 2 ? "F_A 與 ω 的關係" : p === 0 ? "F 與 r 的關係" : "F 與 m 的關係";
    setSelect("law", lawOptions, t.law, !editing);
    $("syncAnswer").value = s.sync || ""; $("massPartsAnswer").value = s.massParts || "";
    $("syncAnswer").disabled = !editing; $("massPartsAnswer").disabled = !editing;
    $("clearTaskButton").disabled = !editing;
    renderRuns();
    const canOperate = editing && v === "collect" && running;
    $("spinTargets").hidden = !canOperate;
    for (const button of document.querySelectorAll(".radius-handle,.mass-token")) button.hidden = !editing || v !== "setup";
    $("deviceSvg").hidden = v === "analyse";
    $("graphSvg").hidden = !$("deviceSvg").hidden;
    $("stageHint").textContent = matchMedia("(max-height:260px) and (max-width:479px)").matches ?
      v === "collect" ? "拖金色環推動；讀數在下方。" : "短視窗可用下方按鈕設定；全螢幕可直接拖動。" :
      v === "analyse" ? "圖點來自實際操作的同步讀數；另一組以棕色表示。" : v === "collect" ? running ? "拖動金色操作環，放手後平台會續轉。" : "已暫停收集；按繼續後推動操作環。" : v === "check" ? "檢查及提交在右側／下方操作面板。" : "拖動 A／B 測力計，放上砝碼，然後開始收集。";
    if (v === "check") {
      $("checkSummary").innerHTML = s.tasks.map((item, i) => `<div class="check-row"><strong>實驗 ${i + 1} · ${titles[i]}</strong><small>資料組 ${item.runs.length}；評分組 ${item.selected === null ? "未選" : item.selected + 1}；結論 ${item.law === null ? "未答" : "已答"}</small></div>`).join("") + `<div class="check-row">綜合問題：${[s.sync, s.massParts].filter(Boolean).length} / 2 已答</div>`;
      $("submitButton").disabled = !controller.editable || controller.unsaved;
    }
    if (!$("feedbackPanel").hidden) {
      const result = controller.result;
      $("feedback").innerHTML = result?.detail?.pages ? result.detail.pages.map((part, i) => `<p>實驗 ${i + 1}：${part.score} / 30。${i === 2 ? "理想 <var>F</var><sub>A</sub> = <var>m</var><sub>A</sub><var>r</var><sub>A</sub><var>ω</var><sup>2</sup>；二次係數是 <var>m</var><sub>A</sub><var>r</var><sub>A</sub>。" : i === 0 ? "同時刻兩側 <var>ω</var> 相同；公平比較時 <var>F</var><sub>A</sub> / <var>F</var><sub>B</sub> = <var>r</var><sub>A</sub> / <var>r</var><sub>B</sub>。" : "同時刻兩側 <var>ω</var> 相同；公平比較時 <var>F</var><sub>A</sub> / <var>F</var><sub>B</sub> = <var>m</var><sub>A</sub> / <var>m</var><sub>B</sub>。"}</p>`).join("") : "";
    }
    renderMotion(); layoutTargets();
  }
  function cancelDrag() {
    if (!drag) return;
    try { drag.target.releasePointerCapture(drag.id); } catch (_) {}
    drag = null; $("radiusPreview").hidden = true; layoutTargets();
  }
  function angleOf(event) { const p = svgPoint(event); return Math.atan2(p.y - 185, p.x - 300); }
  function down(event) {
    if (drag || event.pointerType === "touch" && !event.isPrimary) { if (drag) { pause(); render(); } return; }
    if (!controller.editable || state().view === "check") return;
    const target = event.target.closest(".spin-segment,.radius-handle,.mass-token");
    if (!target || target.hidden) return;
    const type = target.classList.contains("spin-segment") ? "spin" : target.classList.contains("radius-handle") ? "radius" : "mass";
    if (type === "spin" && !(view() === "collect" && running) || type !== "spin" && view() !== "setup") return;
    event.preventDefault(); target.setPointerCapture(event.pointerId);
    drag = { target, id: event.pointerId, type, side: target.dataset.side || target.dataset.mass, proposed: null, pointerType: event.pointerType };
    if (type === "spin") motion = M.dragMotion({ ...motion, pointerAngle: null }, angleOf(event), event.timeStamp);
    if (type === "radius") showRadiusPreview(target.dataset.side, task().work[target.dataset.side === "A" ? 0 : 1]);
  }
  function showRadiusPreview(side, index) {
    const preview = $("radiusPreview"); preview.hidden = false;
    preview.innerHTML = `<strong>${side} 側 · 2× 放大</strong><br>軸心 ━━━ ●<br><var>r</var> = ${M.radius(index).toFixed(2)} m`;
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    if (drag.type === "spin") {
      const p = svgPoint(event);
      if (Math.hypot(p.x - 300, p.y - 185) < 30) return;
      motion = M.dragMotion(motion, angleOf(event), event.timeStamp);
      if (motion.warning) { localMessage = "手勢跳幅過大；請慢一點重新推動。"; $("notice").hidden = false; $("notice").textContent = localMessage; }
      else localMessage = "";
      recordCurrent(); renderMotion();
    } else if (drag.type === "radius") {
      const p = svgPoint(event), side = drag.side, distance = Math.abs(p.x - 300);
      const index = Math.max(0, Math.min(6, Math.round((distance - 64) / 18)));
      const snap = mapPoint(componentX(side, index), 185), threshold = drag.pointerType === "touch" ? 12 : 8;
      drag.proposed = Math.hypot(event.clientX - snap.x, event.clientY - snap.y) <= threshold ? index : null;
      if (drag.proposed !== null) positionHit(drag.target, componentX(side, index), 185);
      showRadiusPreview(side, index);
    }
  }
  function up(event) {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault(); const operation = drag; drag = null; $("radiusPreview").hidden = true; layoutTargets();
    if (operation.type === "spin") { motion = { ...motion, pointerAngle: null, time: null }; renderMotion(); return; }
    if (operation.type === "radius" && operation.proposed !== null) {
      const field = operation.side === "A" ? 0 : 1;
      controller.update(next => M.setWork(next.tasks[next.page], field, operation.proposed));
      return;
    }
    if (operation.type === "mass") {
      const hit = (side, index) => { const center = mapPoint(componentX(side, task().work[index]), 185);
        return Math.hypot(event.clientX - center.x, event.clientY - center.y) <= 22 + (operation.pointerType === "touch" ? 18 : 10); };
      const destination = hit("A", 0) ? "A" : hit("B", 1) ? "B" : null;
      const tray = document.querySelector(".mass-token.tray").getBoundingClientRect();
      const back = event.clientX >= tray.left - 18 && event.clientX <= tray.right + 18 && event.clientY >= tray.top - 18 && event.clientY <= tray.bottom + 18;
      if (operation.side === "tray" && destination) controller.update(next => { const t = next.tasks[next.page], field = destination === "A" ? 2 : 3; M.setWork(t, field, t.work[field] + 1); });
      else if (operation.side !== "tray" && (back || destination && destination !== operation.side)) controller.update(next => {
        const t = next.tasks[next.page], from = operation.side === "A" ? 2 : 3;
        if (t.work[from] > 0) { t.work[from]--; if (destination && !back) { const to = destination === "A" ? 2 : 3; M.setWork(t, to, t.work[to] + 1); } }
      });
    }
  }
  function recordCurrent() {
    if (!running || !controller.editable || state().view !== "collect") return;
    const changed = controller.update(next => M.record(next.tasks[next.page], motion.omega));
    if (changed) $("collectStatus").textContent = `正在收集 · ${activeRun().q.length} 點`;
  }
  function frame(time) {
    const dt = lastFrame ? (time - lastFrame) / 1000 : 0; lastFrame = time;
    if (running && !drag && controller.editable && view() === "collect") { motion = M.coast(motion, dt); recordCurrent(); renderMotion(); }
    requestAnimationFrame(frame);
  }
  function setupEvents() {
    document.addEventListener("pointerdown", event => { if (drag && event.pointerType === "touch" && event.pointerId !== drag.id) { pause(); render(); } }, true);
    stage.addEventListener("pointerdown", down); stage.addEventListener("pointermove", move); stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", () => { pause(); render(); });
    stage.addEventListener("lostpointercapture", () => { if (drag) { pause(); render(); } });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(); render(); } });
    window.addEventListener("blur", () => { pause(); render(); });
    document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => { pause(); controller.navigate(Number(button.dataset.page), "setup"); }));
    $("checkButton").addEventListener("click", () => { pause(); controller.check(); });
    $("backButton").addEventListener("click", () => controller.back());
    $("submitButton").addEventListener("click", () => { pause(); controller.submit(); });
    $("retryFinalButton").addEventListener("click", () => controller.retryFinal());
    $("saveRetryButton").addEventListener("click", () => controller.retrySave());
    [["setupView", "setup"], ["collectView", "collect"], ["analyseView", "analyse"]].forEach(([id, target]) => $(id).addEventListener("click", () => { pause(); controller.navigate(page(), target); }));
    document.querySelectorAll("[data-step]").forEach(button => button.addEventListener("click", () => { const [field, delta] = button.dataset.step.split(":").map(Number); controller.update(next => { const t = next.tasks[next.page]; M.setWork(t, field, t.work[field] + delta); }); }));
    $("startButton").addEventListener("click", () => { pause(); if (controller.update(next => { const t = next.tasks[next.page]; if (!M.begin(t)) return; next.view = "collect"; })) { running = true; render(); } });
    $("resumeButton").addEventListener("click", () => { running = true; render(); });
    $("resumeFromGraph").addEventListener("click", () => { if (controller.navigate(page(), "collect")) { running = true; render(); } });
    $("stopButton").addEventListener("click", () => { pause(); controller.navigate(page(), "analyse"); });
    $("fitButton").addEventListener("click", () => { const kind = M.KINDS[page()], result = M.fit(kind, activeRun());
      if (result.ok) controller.update(next => { next.tasks[next.page].runs[next.tasks[next.page].current].fit = true; });
      else { localMessage = result.message; render(); } });
    $("independent").addEventListener("change", event => controller.update(next => { next.tasks[next.page].roles[0] = event.target.value || null; }));
    for (const input of document.querySelectorAll("[data-control]")) input.addEventListener("change", event => {
      const key = event.target.dataset.control, current = task().roles[1] || [], values = event.target.checked ? current.concat(key) : current.filter(value => value !== key);
      if (values.length > 2) { event.target.checked = false; localMessage = "控制量最多選兩項。"; render(); return; }
      controller.update(next => { next.tasks[next.page].roles[1] = values.length ? values : null; });
    });
    $("numericAnswer").addEventListener("input", event => { const value = event.target.value;
      if (value.length <= 12 && /^\d*(?:\.\d*)?$/.test(value)) controller.update(next => { next.tasks[next.page].runs[next.tasks[next.page].current].a[0] = value || null; });
      else { localMessage = "只可輸入最多 12 字的非負十進位數。"; $("notice").hidden = false; $("notice").textContent = localMessage; }
    });
    [["comparison", 1], ["reason", 2]].forEach(([id, index]) => $(id).addEventListener("change", event => controller.update(next => { next.tasks[next.page].runs[next.tasks[next.page].current].a[index] = event.target.value || null; })));
    $("law").addEventListener("change", event => controller.update(next => { next.tasks[next.page].law = event.target.value || null; }));
    $("syncAnswer").addEventListener("change", event => controller.update(next => { next.sync = event.target.value || null; }));
    $("massPartsAnswer").addEventListener("change", event => controller.update(next => { next.massParts = event.target.value || null; }));
    $("clearTaskButton").addEventListener("click", () => { pause(); controller.update(next => { next.tasks[next.page] = M.freshTask(); next.view = "setup"; }); });
    $("runList").addEventListener("click", event => { const button = event.target.closest("[data-run]"); if (!button) return;
      const [action, raw] = button.dataset.run.split(":"), index = Number(raw);
      if (action === "view") { pause(); if (controller.editable) controller.update(next => { next.tasks[next.page].current = index; next.view = "analyse"; });
        else if (["review", "committed", "frozen"].includes(controller.mode)) { reviewRun[page()] = index; controller.navigate(page(), "analyse"); } }
      if (action === "select") controller.update(next => { next.tasks[next.page].selected = index; });
      if (action === "delete") { pause(); controller.update(next => { const t = next.tasks[next.page]; M.removeRun(t, index); if (t.current === null && ["collect", "analyse"].includes(next.view)) next.view = "setup"; }); }
    });
    $("spinTargets").addEventListener("keydown", event => {
      if (!controller.editable || view() !== "collect") return;
      if (event.key === " ") { event.preventDefault(); pause(); render(); }
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); running = true;
        motion = { ...motion, omega: Math.max(-6, Math.min(6, motion.omega + (event.key === "ArrowRight" ? 0.5 : -0.5))) };
        recordCurrent(); renderMotion(); render(); }
    });
    document.querySelectorAll(".radius-handle").forEach(button => button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !controller.editable || view() !== "setup") return;
      event.preventDefault(); const field = button.dataset.side === "A" ? 0 : 1;
      controller.update(next => { const t = next.tasks[next.page]; M.setWork(t, field, Math.max(0, Math.min(6, t.work[field] + (event.key === "ArrowRight" ? 1 : -1)))); });
    }));
  }
  makeTargets(); setupEvents(); controller.start();
  if (state()) for (const id of ["independent", "syncAnswer", "massPartsAnswer"]) {
    const select = $(id), value = select.value;
    const options = [...select.options].slice(1).map(option => [option.value, option.textContent]);
    select.innerHTML = `<option value="">${select.options[0].textContent}</option>${ordered(options, id).map(([key, label]) => `<option value="${key}">${safe(label)}</option>`).join("")}`;
    select.value = value;
  }
  requestAnimationFrame(frame);
  window.__centripetalApp = { getState: () => M.clone(state()), getMotion: () => ({ ...motion, running }) };
})();
