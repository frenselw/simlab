(function () {
  "use strict";
  const M = CentripetalModel, P = CentripetalPersistence, S = CentripetalScoring;
  const $ = id => document.getElementById(id), stage = $("stageContent"), device = $("deviceSvg"), graph = $("graphSvg");
  const titles = ["半徑如何影響徑向力？", "質量如何影響徑向力？", "轉速如何影響徑向力？"];
  const prompts = ["同質量、不同半徑：推動轉盤，同步比較 A、B 徑向力。", "同半徑、不同質量：推動轉盤，同步比較 A、B 徑向力。", "固定 A 側質量與半徑，改變轉速，比較徑向力的變化。"];
  const compareOptions = [["supports", "單變量結論有支持"], ["confounded", "兩個量同時改變，不能隔離"], ["no-contrast", "被研究量沒有差異"], ["insufficient", "資料不足"]];
  const reasonOptions = [["coefficient", "斜率對應兩側物理量比值／二次項對應質量與半徑的乘積"], ["constant", "只有常數項代表關係"], ["other", "係數與配置無關"], ["uncertain", "配置混雜或資料不足，不能隔離解釋"]];
  const lawOptions = [["linear", "徑向力與研究量成正比（其餘量固定）"], ["square", "徑向力與研究量的平方成正比（其餘量固定）"], ["inverse", "徑向力與研究量成反比"], ["none", "沒有可描述的關係"]];
  const controller = new CentripetalRuntime.Controller(SimScorm, SimActivityFlow, render);
  let motion = M.motion(), running = false, drag = null, lastFrame = 0, localMessage = "", reviewRun = [null, null, null], mathReady = false, lastLocation = "", graphOpen = true;
  const state = () => controller.state, page = () => controller.editable ? state().page : controller.reviewPage;
  const view = () => controller.editable ? state().view : controller.reviewView;
  const task = () => state()?.tasks[page()];
  const activeRun = () => task()?.current === null ? null : task().runs[task().current];
  const shownRun = () => controller.editable ? activeRun() : task()?.runs[reviewRun[page()] ?? task().selected ?? 0] || null;
  const fmt = value => Number(value.toPrecision(3)).toString();
  const safe = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const math = (tex, label = tex) => mathReady ? CircuitMath.html({ tex, text: label }) : safe(label);
  function typesetStatic() {
    for (const element of document.querySelectorAll("[data-tex]")) element.innerHTML = math(element.dataset.tex, element.dataset.mathLabel || element.textContent);
  }
  function ordered(options, id) {
    const seed = state()?.seed || 0, hash = key => { let value = (seed ^ 2166136261) >>> 0;
      for (const char of id + key) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
      return value; };
    return options.slice().sort((a, b) => hash(a[0]) - hash(b[0]));
  }
  function pause() { running = false; motion = { ...motion, omega: 0, pointerAngle: null, time: null }; if (drag) cancelDrag(); }
  function mapPoint(x, y) {
    const matrix = device.getScreenCTM();
    return { x: matrix.a * x + matrix.e, y: matrix.d * y + matrix.f, scale: matrix.a };
  }
  function svgPoint(event) {
    const origin = mapPoint(0, 0), scale = origin.scale;
    return { x: (event.clientX - origin.x) / scale, y: (event.clientY - origin.y) / scale };
  }
  const componentX = (side, index) => 300 + (side === "A" ? 1 : -1) * M.radius(index) * 430;
  const radiusY = side => side === "A" ? 330 : 142;
  const displayedConfig = () => {
    const cfg = view() === "setup" ? task().work.slice() : shownRun()?.cfg || task().work;
    if (view() === "setup" && drag?.type === "radius") cfg[drag.side === "A" ? 0 : 1] = drag.preview;
    return cfg;
  };
  function positionHit(button, x, y) {
    const p = mapPoint(x, y), r = stage.getBoundingClientRect();
    button.style.left = `${p.x - r.left - button.offsetWidth / 2}px`;
    button.style.top = `${p.y - r.top - button.offsetHeight / 2}px`;
  }
  function layoutTargets() {
    if (!state()) return;
    const cfg = displayedConfig();
    for (const [side, i] of [["A", 0], ["B", 1]]) {
      const x = componentX(side, cfg[i]);
      positionHit(document.querySelector(`.radius-handle[data-side="${side}"]`), x, radiusY(side));
      const button = document.querySelector(`.mass-token.placed.${side.toLowerCase()}`);
      const scale = mapPoint(0, 0).scale;
      button.style.width = `${Math.max(44, 58 * scale)}px`;
      button.style.height = button.style.width;
      positionHit(button, x, 230);
      button.setAttribute("aria-label", `${side} 托座：${cfg[i + 2]} 塊砝碼；可拖一塊回砝碼盤`);
    }
    if (view() !== "collect") return;
    const radius = 213 * mapPoint(0, 0).scale;
    document.querySelectorAll(".spin-segment").forEach((button, i) => {
      const size = Math.max(44, Math.min(64, 2 * Math.PI * radius / 24 + 8));
      button.style.width = `${size}px`; button.style.height = `${size}px`;
      const angle = i / 24 * Math.PI * 2;
      positionHit(button, 300 + 213 * Math.cos(angle), 230 + 213 * Math.sin(angle));
    });
  }
  function makeTargets() {
    const host = $("spinTargets");
    for (let i = 0; i < 24; i++) {
      const button = document.createElement("button"); button.type = "button"; button.className = "spin-segment";
      button.innerHTML = i ? "" : '<svg viewBox="0 0 24 28" width="24" height="28" aria-hidden="true"><path d="M7 7v14M12 4v20M17 7v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'; button.tabIndex = i ? -1 : 0;
      if (i) button.setAttribute("aria-hidden", "true");
      else button.setAttribute("aria-label", "按住沿金色操作環拖動；左右方向鍵調速，空白鍵暫停");
      host.append(button);
    }
    new ResizeObserver(() => { if (state()) { drawDevice(); renderMotion(); layoutTargets(); drawGraph(); } }).observe(stage);
    new ResizeObserver(() => { if (state()) drawGraph(); }).observe(graph);
  }
  function drawDevice() {
    const cfg = displayedConfig(), setup = view() === "setup";
    device.setAttribute("viewBox", setup ? "80 45 440 370" : "0 0 600 550");
    const scale = mapPoint(0, 0).scale, labelFont = Math.max(20, 16 / scale), countFont = Math.max(20, 14 / scale);
    const assemblies = ["A", "B"].map((side, i) => {
      const x = componentX(side, cfg[i]), direction = side === "A" ? 1 : -1, count = cfg[i + 2];
      const colour = side === "A" ? "#087c95" : "#b56317", light = side === "A" ? "#d2f0f3" : "#ffdfad";
      return `<g class="assembly" data-assembly="${side}" data-count="${count}" data-radius="${M.radius(cfg[i])}">
        <path d="M300 230H${x}" stroke="${colour}" stroke-width="4"/>
        <rect x="${x - direction * 34 - 8}" y="214" width="16" height="32" rx="4" fill="${light}" stroke="${colour}" stroke-width="3"/>
        <path d="M${x - direction * 34} 219v22" stroke="${colour}" stroke-width="2" stroke-dasharray="3 2"/>
        <circle class="weight-holder" cx="${x}" cy="230" r="29" fill="${light}" stroke="${colour}" stroke-width="4"/>
        ${count ? `<circle class="weight-plate" cx="${x}" cy="230" r="23" fill="#cbd6dd" stroke="#667e8d" stroke-width="2"/><circle cx="${x}" cy="230" r="8" fill="${light}" stroke="#667e8d" stroke-width="2"/>` : ''}
        <circle cx="${x}" cy="230" r="3" fill="${colour}"/>
        <g class="assembly-label" data-x="${x}" data-y="230">${setup ? `<rect x="${x - countFont * 1.3}" y="250" width="${countFont * 2.6}" height="${countFont * 1.3}" rx="6" fill="${colour}"/><text x="${x}" y="${250 + countFont}" text-anchor="middle" fill="white" font-size="${countFont}" font-weight="700">${side}·${count}</text>` : `<text x="${x}" y="${230 + labelFont * .3}" text-anchor="middle" fill="${colour}" stroke="white" stroke-width="1.5" paint-order="stroke" font-size="${labelFont * .85}" font-weight="700">${side}</text>`}</g>
      </g>`;
    }).join("");
    const rulers = setup ? ["A", "B"].map((side, i) => {
      const direction = side === "A" ? 1 : -1, y = radiusY(side), x = componentX(side, cfg[i]);
      return `<g class="radius-ruler" stroke="#758d9b" stroke-width="2"><path d="M300 ${y}H${300 + direction * 172}M${x} ${side === "A" ? 279 : 196}V${y}" stroke-dasharray="4 4"/>
        ${Array.from({ length: 7 }, (_, n) => `<path d="M${componentX(side, n)} ${y - 9}v18"/>`).join("")}</g>`;
    }).join("") : "";
    const radiusLabels = ["A", "B"].map((side, i) => {
      const index = setup && drag?.type === "radius" && drag.side === side ? drag.proposed : cfg[i];
      const spec = { tex: `r_${side}=${M.radius(index).toFixed(2)}\\,\\mathrm{m}`, text: `${side} 側半徑 ${M.radius(index).toFixed(2)} m` };
      const x = setup ? (i ? 190 : 410) : (i ? 500 : 100), y = setup ? (i ? 83 : 407) : 520, colour = i ? "#a45b24" : "#087c95";
      return `<g class="radius-annotation" data-radius-label="${side}">${!setup ? `<text x="${x}" y="480" text-anchor="middle" fill="${colour}" font-size="${labelFont}" font-weight="600">${side} · ${cfg[i + 2]} 塊</text>` : ''}${mathReady ? CircuitMath.svg(x, y, spec, labelFont, `fill="${colour}"`) : `<text x="${x}" y="${y}" text-anchor="middle" font-size="${labelFont}">${spec.text}</text>`}</g>`;
    }).join("");
    device.innerHTML = `${setup ? '<rect x="95" y="190" width="410" height="92" rx="16" fill="#fff" stroke="#d3e0e4" stroke-width="2"/>' : `
      <circle cx="300" cy="230" r="213" fill="none" stroke="#c49b52" stroke-width="9"/>
      <circle cx="300" cy="230" r="196" fill="#fff" stroke="#d3e0e4" stroke-width="2"/>`}
      <g id="rotatingAssembly"><path d="M116 230H484" stroke="#d8e3e9" stroke-width="22" stroke-linecap="round"/>
        <path d="M116 230H484" stroke="#7994a5" stroke-width="2" stroke-dasharray="2 9"/>
        ${assemblies}<circle cx="300" cy="230" r="12" fill="#355469" stroke="#f1f7fa" stroke-width="4"/>
        <path d="M293 230h14M300 223v14" stroke="#d2e1e9" stroke-width="2"/>
      </g>${rulers}${radiusLabels}`;
  }
  function graphAxes(kind) {
    const forceA = { tex: 'F_A\\,(\\mathrm{N})', text: 'A 側徑向力（N）' };
    return kind === "omega" ? { x: { tex: '\\omega\\,(\\mathrm{rad}/\\mathrm{s})', text: '角速率（rad/s）' }, y: forceA } :
      { x: { tex: 'F_B\\,(\\mathrm{N})', text: 'B 側徑向力（N）' }, y: forceA };
  }
  function drawGraph() {
    if ($("graphCard").hidden || !graphOpen) return;
    const compact = view() === "collect" && matchMedia("(max-width:899px)").matches;
    const bottom = compact ? 120 : 160, height = compact ? 170 : 210;
    graph.setAttribute("viewBox", `0 0 360 ${height}`);
    const run = shownRun(), kind = M.KINDS[page()], axes = graphAxes(kind);
    const points = run ? M.points(kind, run) : [], alternate = task()?.runs.find(item => item !== run);
    const other = alternate ? M.points(kind, alternate) : [];
    const all = points.concat(other), maxX = Math.max(0.1, ...all.map(p => p[0])) * 1.12, maxY = Math.max(0.1, ...all.map(p => p[1])) * 1.12;
    const px = x => 66 + x / maxX * 265, py = y => bottom - y / maxY * (bottom - 25);
    const box = graph.getBoundingClientRect(), scale = Math.min(box.width / 360, box.height / height);
    if (!scale) return;
    const axisFont = Math.max(18, 16 / scale), tickFont = Math.max(13, 13 / scale);
    const result = run?.fit ? M.fit(kind, run) : null;
    const curve = result?.ok ? Array.from({ length: 51 }, (_, i) => {
      const x = i / 50 * result.maxX;
      return `${i ? "L" : "M"}${px(x).toFixed(2)} ${py(NewtonFitting.predict(result.model, result.coefficients, x)).toFixed(2)}`;
    }).join(" ") : "";
    graph.innerHTML = `<path d="M66 25V${bottom}H331" fill="none" stroke="#64818d" stroke-width="1.5"/>
      <g stroke="#e2ebee" stroke-width="1">${[.5,1].map(f => `<path d="M66 ${py(maxY * f)}H331M${px(maxX * f)} 25V${bottom}"/>`).join("")}</g>
      ${mathReady ? CircuitMath.svg(210, height - 9, axes.x, axisFont, 'fill="#284a5f"') : `<text x="210" y="${height - 9}" text-anchor="middle" font-size="${axisFont}">${axes.x.text}</text>`}
      <g transform="translate(16 ${(bottom + 25) / 2}) rotate(-90)">${mathReady ? CircuitMath.svg(0, 0, axes.y, axisFont, 'fill="#284a5f"') : `<text text-anchor="middle" font-size="${axisFont}">${axes.y.text}</text>`}</g>
      <g fill="#56717d" font-size="${tickFont}"><text x="63" y="${bottom + 20}">0</text><text x="331" y="${bottom + 20}" text-anchor="end">${fmt(maxX)}</text><text x="59" y="32" text-anchor="end">${fmt(maxY)}</text></g>
      ${other.map(([x,y]) => `<circle cx="${px(x)}" cy="${py(y)}" r="4" fill="#b07932" opacity=".65"/>`).join("")}
      ${curve ? `<path class="fit-curve" d="${curve}" fill="none" stroke="#bd5a25" stroke-width="2"/>` : ""}
      ${points.map(([x,y]) => `<circle class="measured-point" cx="${px(x)}" cy="${py(y)}" r="4" fill="#087c95" stroke="white" stroke-width="1"/>`).join("")}
      ${!points.length ? `<text x="205" y="${(bottom + 25) / 2}" text-anchor="middle" fill="#6d8590" font-size="${tickFont}">${view() === 'collect' && controller.editable ? '推動轉盤，開始量測' : '本組尚未記錄數據'}</text>` : ''}`;
    $("graphLegend").hidden = !other.length;
    $("graphLegend").textContent = `藍色：本組 ${points.length} 點 · 棕色：另一組 ${other.length} 點`;
  }
  function renderMotion() {
    if (!state()) return;
    const reading = M.readings(displayedConfig(), Math.abs(motion.omega));
    $("omegaRead").textContent = Math.abs(motion.omega).toFixed(3);
    $("forceARead").textContent = fmt(reading.a);
    $("forceBRead").textContent = fmt(reading.b);
    $("compactOmega").textContent = Math.abs(motion.omega).toFixed(3);
    $("compactForceA").textContent = fmt(reading.a); $("compactForceB").textContent = fmt(reading.b);
    const angle = view() === "setup" ? 0 : motion.angle * 180 / Math.PI;
    device.querySelector("#rotatingAssembly")?.setAttribute("transform", `rotate(${angle} 300 230)`);
    device.querySelectorAll(".assembly-label").forEach(label => label.setAttribute("transform", `rotate(${-angle} ${label.dataset.x} ${label.dataset.y})`));
  }
  function setSelect(id, options, value, disabled) {
    const select = $(id), selected = value ?? "";
    select.innerHTML = `<option value="">未答</option>${ordered(options, id).map(([key, label]) => `<option value="${key}">${safe(label)}</option>`).join("")}`;
    select.value = selected; select.disabled = disabled;
  }
  function renderRuns() {
    const t = task(), locked = !controller.editable || state().view === "check";
    $("runList").innerHTML = t.runs.length ? t.runs.map((run, i) => `<div class="run-card ${t.current === i || locked && reviewRun[page()] === i ? "current" : ""}"><strong>資料組 ${i + 1}</strong><p>${run.q.length} 個轉速槽 · ${math(`m_A=${fmt(M.mass(run.cfg[2]))}\\,\\mathrm{kg},\\ r_A=${fmt(M.radius(run.cfg[0]))}\\,\\mathrm{m}`, 'A 側質量與半徑')} · ${math(`m_B=${fmt(M.mass(run.cfg[3]))}\\,\\mathrm{kg},\\ r_B=${fmt(M.radius(run.cfg[1]))}\\,\\mathrm{m}`, 'B 側質量與半徑')}</p><div class="run-actions"><button data-run="view:${i}" ${controller.mode === "technical" || controller.mode === "mismatch" || state().view === "check" && controller.editable ? "disabled" : ""}>查看</button><button data-run="select:${i}" aria-pressed="${t.selected === i}" ${locked ? "disabled" : ""}>${t.selected === i ? "評分組 ✓" : "選為評分組"}</button>${locked ? "" : `<button data-run="delete:${i}">刪除本組</button>`}</div></div>`).join("") : "<p>尚未收集資料。你仍可回答概念題或檢查作答。</p>";
    $("runHint").textContent = t.runs.length >= 2 ? "最多保留兩組；如要再收集，先明確刪除其中一組。" : "不同配置請建立新資料組；舊組數據不會被改寫。";
  }
  function render() {
    const s = state(), locked = !controller.editable, p = page(), v = view();
    $("app").dataset.view = v;
    const location = `${p}:${v}`;
    if (location !== lastLocation) { $("controlPanel").scrollTop = 0; if (v === "analyse") graphOpen = true; lastLocation = location; }
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
    $("taskIntro").hidden = v !== "setup";
    $("collectHelp").hidden = v !== "collect";
    $("graphCard").hidden = !["collect", "analyse"].includes(v);
    $("graphBody").hidden = !graphOpen;
    $("toggleGraph").setAttribute("aria-expanded", String(graphOpen));
    $("toggleGraph").textContent = graphOpen ? "收合圖像 −" : "展開圖像 ＋";
    $("setupView").textContent = v === "setup" ? "1 設定" : "← 返回設定";
    $("setupView").disabled = !editing; $("collectView").disabled = !editing || t.current === null; $("analyseView").disabled = !editing || t.current === null;
    for (const [id, target] of [["setupView", "setup"], ["collectView", "collect"], ["analyseView", "analyse"]]) $(id).setAttribute("aria-current", v === target ? "page" : "false");
    $("independent").value = t.roles[0] || ""; $("independent").disabled = !editing;
    for (const input of document.querySelectorAll("[data-control]")) { input.checked = (t.roles[1] || []).includes(input.dataset.control); input.disabled = !editing; }
    ["rAValue", "rBValue"].forEach((id, i) => { $(id).innerHTML = math(`r_${i ? 'B' : 'A'}=${M.radius(cfg[i]).toFixed(2)}\\,\\mathrm{m}`, `${M.radius(cfg[i]).toFixed(2)} m`); });
    ["mAValue", "mBValue"].forEach((id, i) => { $(id).innerHTML = `${cfg[i + 2]} 塊 · ${math(`m_${i ? 'B' : 'A'}=${M.mass(cfg[i + 2]).toFixed(3)}\\,\\mathrm{kg}`, `${M.mass(cfg[i + 2]).toFixed(3)} kg`)}`; });
    for (const button of document.querySelectorAll("[data-step]")) { const [field, delta] = button.dataset.step.split(":").map(Number); button.disabled = !editing || v !== "setup" || cfg[field] + delta < 0 || cfg[field] + delta > (field < 2 ? 6 : 8); }
    $("startButton").disabled = !editing || t.runs.length >= 2;
    $("startButton").textContent = t.runs.length ? `保留舊組，開始第 ${t.runs.length + 1} 組 →` : "開始收集 →";
    if (t.runs.length >= 2) $("startButton").textContent = "已保留兩組";
    $("setupRunNote").hidden = !t.runs.length;
    $("setupRunNote").textContent = t.runs.length >= 2 ? "已保留兩組。可繼續原組，或清除目前組並按新設定重做。" : "本組數據已保留。可繼續收集、保留並另開一組，或清除本組重做。";
    $("restartRunButton").hidden = !editing || t.current === null;
    $("restartRunNote").hidden = $("restartRunButton").hidden;
    $("restartRunButton").disabled = !editing;
    $("collectView").textContent = t.current === null || v === "collect" ? "2 收集" : "2 繼續本組";
    $("pushButton").disabled = !editing || v !== "collect"; $("slowButton").disabled = !editing || v !== "collect";
    $("resumeButton").hidden = running; $("resumeButton").disabled = !editing; $("stopButton").disabled = !editing;
    $("collectStatus").textContent = `${v === "collect" && running ? '收集中' : '已記錄'} · ${run?.q.length || 0} 點`;
    $("fitButton").disabled = !editing || !activeRun(); $("resumeFromGraph").disabled = !editing || !activeRun();
    $("axisLabel").innerHTML = p === 2 ? `橫軸 ${math('\\omega\\,(\\mathrm{rad}/\\mathrm{s})', '角速率（rad/s）')}；縱軸 ${math('F_A\\,(\\mathrm{N})', 'A 側徑向力（N）')}。二次擬合含一次項及常數項。` : `橫軸 ${math('F_B\\,(\\mathrm{N})', 'B 側徑向力（N）')}；縱軸 ${math('F_A\\,(\\mathrm{N})', 'A 側徑向力（N）')}。線性擬合含截距。`;
    const fit = run?.fit ? M.fit(M.KINDS[p], run) : null;
    $("fitResult").innerHTML = fit?.ok ? p === 2 ? `${math(`F_A=${fmt(fit.coefficients[0])}\\omega^2+${fmt(fit.coefficients[1])}\\omega+${fmt(fit.coefficients[2])}\\,\\mathrm{N}`, 'A 側徑向力二次擬合')}；${math(`\\mathrm{RMSE}=${fmt(fit.rmse)}\\,\\mathrm{N}`, '均方根誤差')}` : `${math(`F_A=${fmt(fit.coefficients[0])}F_B+${fmt(fit.coefficients[1])}\\,\\mathrm{N}`, '兩側徑向力線性擬合')}；${math(`\\mathrm{RMSE}=${fmt(fit.rmse)}\\,\\mathrm{N}`, '均方根誤差')}` :
      run?.a.some(Boolean) && run.q.length >= 2 ? "資料已更新或尚未擬合；原有結論保留，請重新擬合比較。" : "尚未擬合；請先收集足夠的不同轉速。";
    $("numericPrompt").innerHTML = p === 2 ? "角速率加倍時，力變成多少倍？" : p === 0 ? `${math('r_A/r_B', '兩側半徑比')} = ?` : `${math('m_A/m_B', '兩側質量比')} = ?`;
    $("numericAnswer").value = run?.a[0] || ""; $("numericAnswer").disabled = !editing || !activeRun();
    setSelect("comparison", p === 2 ? lawOptions : compareOptions, run?.a[1], !editing || !activeRun());
    setSelect("reason", reasonOptions, run?.a[2], !editing || !activeRun());
    $("lawPrompt").innerHTML = p === 2 ? `${math('F_A', 'A 側徑向力')} 與 ${math('\\omega', '角速率')} 的關係` : p === 0 ? `${math('F', '徑向力')} 與 ${math('r', '半徑')} 的關係` : `${math('F', '徑向力')} 與 ${math('m', '質量')} 的關係`;
    setSelect("law", lawOptions, t.law, !editing);
    $("syncAnswer").value = s.sync || ""; $("massPartsAnswer").value = s.massParts || "";
    $("syncAnswer").disabled = !editing; $("massPartsAnswer").disabled = !editing;
    $("clearTaskButton").disabled = !editing;
    renderRuns();
    const canOperate = editing && v === "collect" && running;
    $("spinTargets").hidden = !canOperate;
    for (const button of document.querySelectorAll(".radius-handle,.mass-token")) button.hidden = !editing || v !== "setup";
    $("weightTray").hidden = !editing || v !== "setup";
    $("stageHint").textContent = matchMedia("(max-height:260px) and (max-width:479px)").matches ?
      v === "collect" ? "拖金色環推動；讀數在下方。" : "短視窗可用下方按鈕設定；全螢幕可直接拖動。" :
      v === "analyse" ? "轉盤已暫停；數據圖可收合，裝置保留顯示。" : v === "collect" ? running ? "沿金色外圈拖動轉盤" : "已暫停；按「繼續收集」後再推動。" : v === "check" ? "檢查及提交在操作面板。" : "左右拖 A／B 調整半徑";
    if (v === "check") {
      $("checkSummary").innerHTML = s.tasks.map((item, i) => `<div class="check-row"><strong>實驗 ${i + 1} · ${titles[i]}</strong><small>資料組 ${item.runs.length}；評分組 ${item.selected === null ? "未選" : item.selected + 1}；結論 ${item.law === null ? "未答" : "已答"}</small></div>`).join("") + `<div class="check-row">綜合問題：${[s.sync, s.massParts].filter(Boolean).length} / 2 已答</div>`;
      $("submitButton").disabled = !controller.editable || controller.unsaved;
    }
    if (!$("feedbackPanel").hidden) {
      const result = controller.result;
      $("feedback").innerHTML = result?.detail?.pages ? result.detail.pages.map((part, i) => `<p>實驗 ${i + 1}：${part.score} / 30。${i === 2 ? `理想關係 ${math('F_A=m_A r_A\\omega^2', 'A 側徑向力公式')}；二次係數是 ${math('m_A r_A', '質量與半徑的乘積')}。` : i === 0 ? `同時刻兩側 ${math('\\omega', '角速率')} 相同；公平比較時 ${math('F_A/F_B=r_A/r_B', '兩側徑向力與半徑比相等')}。` : `同時刻兩側 ${math('\\omega', '角速率')} 相同；公平比較時 ${math('F_A/F_B=m_A/m_B', '兩側徑向力與質量比相等')}。`}</p>`).join("") : "";
    }
    drawDevice(); drawGraph();
    renderMotion(); layoutTargets();
  }
  function clearDropPreview() {
    delete $("app").dataset.drag;
    document.querySelectorAll(".drop-ready,.drop-active").forEach(button => button.classList.remove("drop-ready", "drop-active"));
  }
  function cancelDrag() {
    if (!drag) return;
    const operation = drag; drag = null;
    clearDropPreview();
    if (operation.type === "mass") { operation.target.style.left = ""; operation.target.style.top = ""; operation.target.style.bottom = ""; operation.target.classList.remove("dragging"); }
    try { operation.target.releasePointerCapture(operation.id); } catch (_) {}
    layoutTargets();
  }
  function angleOf(event) { const p = svgPoint(event); return Math.atan2(p.y - 230, p.x - 300); }
  function massHit(event, side, pointerType) {
    const center = mapPoint(componentX(side, task().work[side === "A" ? 0 : 1]), 230);
    return Math.hypot(event.clientX - center.x, event.clientY - center.y) <= Math.max(24, 29 * center.scale) + (pointerType === "touch" ? 18 : 10);
  }
  function down(event) {
    if (drag || event.pointerType === "touch" && !event.isPrimary) { if (drag) { pause(); render(); } return; }
    if (!controller.editable || state().view === "check") return;
    const target = event.target.closest(".spin-segment,.radius-handle,.mass-token");
    if (!target || target.hidden) return;
    const type = target.classList.contains("spin-segment") ? "spin" : target.classList.contains("radius-handle") ? "radius" : "mass";
    if (type === "spin" && !(view() === "collect" && running) || type !== "spin" && view() !== "setup") return;
    if (type === "mass" && target.dataset.mass !== "tray" && task().work[target.dataset.mass === "A" ? 2 : 3] === 0) return;
    event.preventDefault(); target.setPointerCapture(event.pointerId);
    drag = { target, id: event.pointerId, type, side: target.dataset.side || target.dataset.mass, proposed: null, pointerType: event.pointerType };
    if (type === "spin") motion = M.dragMotion({ ...motion, pointerAngle: null }, angleOf(event), event.timeStamp);
    if (type === "mass") {
      $("app").dataset.drag = "mass";
      document.querySelectorAll(".mass-token.placed").forEach(button => button.classList.add("drop-ready"));
      $("stageHint").textContent = "把圓片放到 A／B 托座；移除砝碼可拖回砝碼盤。";
    }
    if (type === "radius") {
      $("app").dataset.drag = "radius";
      drag.startX = svgPoint(event).x;
      drag.startIndex = task().work[drag.side === "A" ? 0 : 1];
      drag.preview = drag.startIndex; drag.proposed = drag.startIndex;
    }
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    if (drag.type === "spin") {
      const p = svgPoint(event);
      if (Math.hypot(p.x - 300, p.y - 230) < 30) return;
      motion = M.dragMotion(motion, angleOf(event), event.timeStamp);
      if (motion.warning) { localMessage = "手勢跳幅過大；請慢一點重新推動。"; $("notice").hidden = false; $("notice").textContent = localMessage; }
      else localMessage = "";
      recordCurrent(); renderMotion();
    } else if (drag.type === "radius") {
      const direction = drag.side === "A" ? 1 : -1;
      drag.preview = Math.max(0, Math.min(6, drag.startIndex + direction * (svgPoint(event).x - drag.startX) / 21.5));
      const index = Math.round(drag.preview);
      if (index !== drag.proposed) {
        drag.proposed = index;
        $(drag.side === "A" ? "rAValue" : "rBValue").innerHTML = math(`r_${drag.side}=${M.radius(index).toFixed(2)}\\,\\mathrm{m}`);
      }
      drawDevice(); layoutTargets();
    } else if (drag.type === "mass") {
      const rect = stage.getBoundingClientRect();
      drag.target.style.left = `${event.clientX - rect.left - drag.target.offsetWidth / 2}px`;
      drag.target.style.top = `${event.clientY - rect.top - drag.target.offsetHeight / 2}px`;
      drag.target.style.bottom = "auto";
      drag.target.classList.add("dragging");
      document.querySelectorAll(".mass-token.placed").forEach(button => {
        const hit = massHit(event, button.dataset.mass, drag.pointerType);
        const full = task().work[button.dataset.mass === "A" ? 2 : 3] >= 8;
        button.classList.toggle("drop-active", hit && !full);
        if (hit) $("stageHint").textContent = full ? `${button.dataset.mass} 托座已放滿 8 塊砝碼` : `放手：放入 ${button.dataset.mass} 托座`;
      });
    }
  }
  function up(event) {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault(); const operation = drag; drag = null;
    clearDropPreview();
    if (operation.type === "mass") { operation.target.style.left = ""; operation.target.style.top = ""; operation.target.style.bottom = ""; operation.target.classList.remove("dragging"); }
    layoutTargets();
    if (operation.type === "spin") { motion = { ...motion, pointerAngle: null, time: null }; renderMotion(); return; }
    if (operation.type === "radius" && operation.proposed !== null) {
      const field = operation.side === "A" ? 0 : 1;
      if (!controller.update(next => M.setWork(next.tasks[next.page], field, operation.proposed))) render();
      return;
    }
    if (operation.type === "mass") {
      const destination = massHit(event, "A", operation.pointerType) ? "A" : massHit(event, "B", operation.pointerType) ? "B" : null;
      const tray = document.querySelector(".mass-token.tray").getBoundingClientRect();
      const back = event.clientX >= tray.left - 18 && event.clientX <= tray.right + 18 && event.clientY >= tray.top - 18 && event.clientY <= tray.bottom + 18;
      if (operation.side === "tray" && destination) controller.update(next => { const t = next.tasks[next.page], field = destination === "A" ? 2 : 3; M.setWork(t, field, t.work[field] + 1); });
      else if (operation.side !== "tray" && (back || destination && destination !== operation.side)) controller.update(next => {
        const t = next.tasks[next.page], from = operation.side === "A" ? 2 : 3;
        if (destination && !back && t.work[destination === "A" ? 2 : 3] >= 8) return;
        if (t.work[from] > 0) { t.work[from]--; if (destination && !back) { const to = destination === "A" ? 2 : 3; M.setWork(t, to, t.work[to] + 1); } }
      });
    }
  }
  function recordCurrent() {
    if (!running || !controller.editable || state().view !== "collect") return;
    const changed = controller.update(next => M.record(next.tasks[next.page], motion.omega));
    if (changed) $("collectStatus").textContent = `正在收集 · ${activeRun().q.length} 點`;
  }
  function setSpeed(omega) {
    if (!controller.editable || view() !== "collect") return;
    running = true; motion = { ...motion, omega: Math.max(-6, Math.min(6, omega)) };
    recordCurrent(); render();
  }
  function frame(time) {
    const dt = lastFrame ? (time - lastFrame) / 1000 : 0; lastFrame = time;
    if (running && !drag && controller.editable && view() === "collect") { motion = M.coast(motion, dt); recordCurrent(); renderMotion(); }
    requestAnimationFrame(frame);
  }
  function setupEvents() {
    $("toggleGraph").addEventListener("click", () => { graphOpen = !graphOpen; render(); });
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
    [["setupView", "setup"], ["collectView", "collect"], ["analyseView", "analyse"]].forEach(([id, target]) => $(id).addEventListener("click", () => {
      pause(); if (controller.navigate(page(), target) && target === "collect" && controller.editable) { running = true; render(); }
    }));
    document.querySelectorAll("[data-step]").forEach(button => button.addEventListener("click", () => { const [field, delta] = button.dataset.step.split(":").map(Number); controller.update(next => { const t = next.tasks[next.page]; M.setWork(t, field, t.work[field] + delta); }); }));
    $("startButton").addEventListener("click", () => { pause(); motion = M.motion(); localMessage = ""; if (controller.update(next => { const t = next.tasks[next.page]; if (!M.begin(t)) return; next.view = "collect"; })) { running = true; render(); } });
    $("restartRunButton").addEventListener("click", () => {
      if (!controller.editable || view() !== "setup" || task().current === null) return;
      pause(); motion = M.motion(); localMessage = "";
      if (controller.update(next => { const t = next.tasks[next.page]; t.runs[t.current] = M.freshRun(t.work); next.view = "collect"; })) { running = true; render(); }
    });
    $("pushButton").addEventListener("click", () => setSpeed((Math.sign(motion.omega) || 1) * Math.min(6, Math.abs(motion.omega) + 0.5)));
    $("slowButton").addEventListener("click", () => setSpeed(Math.sign(motion.omega) * Math.max(0, Math.abs(motion.omega) - 0.5)));
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
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setSpeed(motion.omega + (event.key === "ArrowRight" ? 0.5 : -0.5)); }
    });
    document.querySelectorAll(".radius-handle").forEach(button => button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !controller.editable || view() !== "setup") return;
      event.preventDefault(); const field = button.dataset.side === "A" ? 0 : 1;
      controller.update(next => { const t = next.tasks[next.page]; M.setWork(t, field, Math.max(0, Math.min(6, t.work[field] + (event.key === "ArrowRight" ? 1 : -1)))); });
    }));
  }
  makeTargets(); setupEvents(); controller.start();
  Promise.resolve().then(() => CircuitMath.ready()).then(() => { mathReady = true; typesetStatic(); render(); }).catch(() => { localMessage = "數學排版未能載入；實驗仍可操作。"; render(); });
  if (state()) for (const id of ["independent", "syncAnswer", "massPartsAnswer"]) {
    const select = $(id), value = select.value;
    const options = [...select.options].slice(1).map(option => [option.value, option.textContent]);
    select.innerHTML = `<option value="">${select.options[0].textContent}</option>${ordered(options, id).map(([key, label]) => `<option value="${key}">${safe(label)}</option>`).join("")}`;
    select.value = value;
  }
  requestAnimationFrame(frame);
  window.__centripetalApp = { getState: () => M.clone(state()), getMotion: () => ({ ...motion, running }) };
})();
