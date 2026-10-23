(function () {
  "use strict";
  const M = CentripetalModel, P = CentripetalPersistence, S = CentripetalScoring;
  const $ = id => document.getElementById(id), stage = $("stageContent"), device = $("deviceSvg"), graph = $("graphSvg");
  const titles = ["半徑如何影響徑向力？", "質量如何影響徑向力？", "轉速如何影響徑向力？"];
  const prompts = ["保持兩側質量相同，研究徑向力與半徑的關係。半徑可相同（1:1），亦可試其他比例。", "保持兩側半徑相同、總質量不同，觀察改變轉速時兩側徑向力的比值。", "只量測 A，B 作平衡配重。固定 A 的質量及半徑，推轉、測量、減速，再試反向。"];
  const compareOptions = [["supports", "斜率與設定比值相符，支持本題比例關係"], ["confounded", "兩個量同時改變，不能隔離"], ["no-contrast", "被研究量沒有差異"], ["insufficient", "數據不足"]];
  const reasonOptions = [["coefficient", "斜率對應兩側物理量比值／二次項對應質量與半徑的乘積"], ["constant", "只有常數項代表關係"], ["other", "係數與配置無關"], ["uncertain", "配置混雜或數據不足，不能隔離解釋"]];
  const lawOptions = [["linear", "徑向力與研究量成正比（其餘量固定）"], ["square", "徑向力與研究量的平方成正比（其餘量固定）"], ["inverse", "徑向力與研究量成反比"], ["none", "沒有可描述的關係"]];
  const controller = new CentripetalRuntime.Controller(SimScorm, SimActivityFlow, render);
  let motion = M.motion(), running = false, drag = null, lastFrame = 0, localMessage = "", reviewRun = [null, null, null], mathReady = false, lastLocation = "", graphOpen = true, measuring = false, lastSampleAt = -Infinity, lastSampleQ = null, brakeHold = null, squaredGraph = false, graphProjection = null, lastReadoutAt = -Infinity, sampleTimer = null;
  const state = () => controller.state, page = () => controller.editable ? state().page : controller.reviewPage;
  const view = () => controller.editable ? state().view : controller.reviewView;
  const task = () => state()?.tasks[page()];
  const activeRun = () => task()?.current === null ? null : task().runs[task().current];
  const runNames = ["第一組數據", "第二組數據"];
  const shownRun = () => controller.editable ? activeRun() : task()?.runs[reviewRun[page()] ?? task().selected ?? 0] || null;
  const fmt = value => Number(value.toPrecision(3)).toString();
  function updateText(id, value) { const node = $(id); if (node.textContent !== value) node.textContent = value; }
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
  function pause() { measuring = false; lastSampleAt = -Infinity; releaseBrake(); running = false; motion = { ...motion, omega: 0, pointerAngle: null, time: null }; if (drag) cancelDrag(); }
  function mapPoint(x, y) {
    const matrix = device.getScreenCTM();
    return { x: matrix.a * x + matrix.e, y: matrix.d * y + matrix.f, scale: matrix.a };
  }
  function svgPoint(event) {
    const origin = mapPoint(0, 0), scale = origin.scale;
    return { x: (event.clientX - origin.x) / scale, y: (event.clientY - origin.y) / scale };
  }
  const componentX = (side, index) => 300 + (side === "A" ? 1 : -1) * M.radius(index) * 430;
  const phoneSetup = () => view() === "setup" && matchMedia("(max-width:599px) and (min-height:401px)").matches;
  const radiusY = side => phoneSetup() ? side === "A" ? 316 : 150 : side === "A" ? 330 : 142;
  const displayedConfig = () => {
    const cfg = view() === "setup" ? task().work.slice() : shownRun()?.cfg || task().work;
    if (view() === "setup" && drag?.type === "radius") cfg[drag.side === "A" ? 0 : 1] = drag.preview;
    if (page() === 2 && view() === "setup") { cfg[1] = cfg[0]; cfg[3] = cfg[2]; }
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
      button.style.width = `${Math.max(44, 30 * scale)}px`;
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
    const cfg = displayedConfig(), setup = view() === "setup", single = page() === 2, compact = phoneSetup();
    device.setAttribute("aria-label", single ? "A 測力計與 B 平衡配重；只量測 A 側徑向力" : "兩側測力計與旋轉平台");
    device.setAttribute("viewBox", setup ? compact ? "80 90 440 292" : "80 45 440 370" : "65 0 470 475");
    const scale = mapPoint(0, 0).scale, labelFont = Math.max(14, 16 / scale), countFont = Math.max(10, 14 / scale);
    const assemblies = ["A", "B"].map((side, i) => {
      const x = componentX(side, cfg[i]), direction = side === "A" ? 1 : -1, count = cfg[i + 2];
      const balance = single && side === "B";
      const colour = balance ? "#7c8c95" : side === "A" ? "#087c95" : "#a9662a", light = side === "A" ? "#e5f3f5" : "#fbf0df";
      const meterWidth = Math.min(compact ? 48 : 40, Math.abs(x - 300) - (compact ? 28 : 23)), meterX = x - direction * ((compact ? 23 : 17) + meterWidth / 2);
      return `<g class="assembly" data-assembly="${side}" data-count="${count}" data-radius="${M.radius(cfg[i])}">
        <path class="apparatus-line" d="M300 230H${x}" stroke="${colour}" stroke-width="1.5"/>
        ${balance ? '' : `<g class="force-meter" aria-label="${side} 測力計">
          <rect class="apparatus-line" x="${meterX - meterWidth / 2}" y="${compact ? 208 : 218}" width="${meterWidth}" height="${compact ? 44 : 24}" rx="3" fill="${single ? '#e0f4f7' : '#fff'}" stroke="${single ? colour : '#728994'}" stroke-width="${single ? 2 : 1.3}"/>
          <rect x="${meterX - meterWidth * .32}" y="${compact ? 213 : 222}" width="${meterWidth * .64}" height="${compact ? 19 : 10}" rx="1.5" fill="#e4edef"/>
          <path class="apparatus-line" d="M${meterX - meterWidth * .24} 237h${meterWidth * .48}M${meterX - meterWidth * .12} 235v4M${meterX} 235v4M${meterX + meterWidth * .12} 235v4" fill="none" stroke="#91a4ad" stroke-width=".8"/>
        </g>`}
        ${balance ? `<rect class="counterweight apparatus-line" x="${x - 13}" y="216" width="26" height="28" rx="4" fill="#cbd5da" stroke="#8196a0" stroke-width="1"/><path class="apparatus-line" d="M${x-8} 223h16m-16 7h16m-16 7h16" stroke="#9baeb8" stroke-width="1"/>` : `<circle class="weight-holder apparatus-line" cx="${x}" cy="230" r="${compact ? 20 : 14}" fill="${light}" stroke="${colour}" stroke-width="1.5"/>
        ${count ? `<circle class="weight-plate apparatus-line" cx="${x}" cy="230" r="${compact ? 15 : 10}" fill="#c4d0d6" stroke="#8196a0" stroke-width="1"/><circle cx="${x}" cy="230" r="3.5" fill="${light}"/>` : ''}`}
        <g class="assembly-label" data-x="${setup && !balance ? meterX : x}" data-y="${setup ? 227 : 200}"><text x="${setup && !balance ? meterX : x}" y="${setup ? 230 : 205}" text-anchor="middle" fill="${colour}" font-size="${setup ? compact ? 12 / scale : 9 : labelFont}" font-weight="600">${side}</text></g>
      </g>`;
    }).join("");
    const rulers = setup ? (single ? ["A"] : ["A", "B"]).map((side, i) => {
      const direction = side === "A" ? 1 : -1, y = radiusY(side), x = componentX(side, cfg[i]);
      return `<g class="radius-ruler" fill="none" stroke="#95aab4" stroke-width="1"><path class="apparatus-line" d="M300 ${y}H${300 + direction * 172}"/>
        <path class="apparatus-line" d="M${x} ${side === "A" ? 303 : 214}V${y}" stroke-dasharray="3 5"/>
        ${Array.from({ length: 7 }, (_, n) => `<path class="apparatus-line" d="M${componentX(side, n)} ${y - 5}v10"/>`).join("")}</g>`;
    }).join("") : "";
    const counts = setup ? ["A", "B"].map((side,i) => {
      const x = componentX(side,cfg[i]), anchor = i ? 190 : 410;
      return `<g class="weight-count-label" data-count-label="${side}">
        <path class="apparatus-line" d="M${x} 246v10L${anchor} 273" fill="none" stroke="#acbcc3" stroke-width=".8"/>
        <text x="${anchor}" y="${compact ? 286 : 292}" text-anchor="middle" font-size="${countFont}" fill="#365563"><tspan font-weight="700">${side}</tspan>：${single && i ? "平衡配重" : `砝碼 × ${cfg[i+2]}`}</text>
      </g>`;
    }).join("") : "";
    const radiusLabels = (single ? ["A"] : ["A", "B"]).map((side, i) => {
      const index = setup && drag?.type === "radius" && drag.side === side ? drag.proposed : cfg[i];
      const spec = { tex: `r_${side}=${M.radius(index).toFixed(2)}\\,\\mathrm{m}`, text: `${side} 側半徑 ${M.radius(index).toFixed(2)} m` };
      const x = setup ? (i ? 190 : 410) : (i ? 455 : 145), y = setup ? compact ? (i ? 110 : 368) : (i ? 83 : 390) : 463, colour = i ? "#a45b24" : "#087c95";
      return `<g class="radius-annotation" data-radius-label="${side}">${mathReady ? CircuitMath.svg(x, y, spec, labelFont, `fill="${colour}"`) : `<text x="${x}" y="${y}" text-anchor="middle" font-size="${labelFont}">${spec.text}</text>`}</g>`;
    }).join("");
    device.innerHTML = `${setup ? `<rect class="apparatus-line" x="98" y="${compact ? 198 : 202}" width="404" height="${compact ? 62 : 56}" rx="9" fill="#fff" stroke="#d7e3e7" stroke-width="1"/>` : `
      <circle cx="300" cy="230" r="213" fill="none" stroke="#c49b52" stroke-width="9"/>
      <circle class="apparatus-line" cx="300" cy="230" r="196" fill="#fff" stroke="#d3e0e4" stroke-width="1"/>`}
      <g id="rotatingAssembly"><rect x="116" y="227" width="368" height="6" rx="3" fill="#dfe8ec"/>
        <path class="apparatus-line" d="M116 230H484" stroke="#a4b6bf" stroke-width=".8" stroke-dasharray="1 11"/>
        ${assemblies}<circle class="apparatus-line" cx="300" cy="230" r="5" fill="#f8fbfc" stroke="#607c8a" stroke-width="1.5"/>
        <circle cx="300" cy="230" r="1.7" fill="#607c8a"/>
      </g>${rulers}${counts}${radiusLabels}${single && setup ? `<text class="measurement-roles" x="300" y="110" text-anchor="middle" font-size="${Math.max(12,14/scale)}" fill="#607580"><tspan fill="#087c95" font-weight="700">A 測力計</tspan>　｜　B 平衡配重</text>` : ""}`;
  }
  function graphPoints(kind, run) {
    return M.points(kind, run).map(([x, y]) => [kind === "omega" && squaredGraph ? x * x : x, y]);
  }
  function graphFit(kind, run) {
    return kind === "omega" && squaredGraph ? NewtonFitting.fit("linear", graphPoints(kind, run)) : M.fit(kind, run);
  }
  function graphAxes(kind) {
    const forceA = { tex: 'F_A\\,(\\mathrm{N})', text: 'A 側徑向力（N）' };
    return kind === "omega" && squaredGraph ? { x: { tex: "\\omega^2\\,(\\mathrm{rad}^2/\\mathrm{s}^2)", text: "角速度平方" }, y: forceA } : kind === "omega" ? { x: { tex: '\\omega\\,(\\mathrm{rad}/\\mathrm{s})', text: '角速度（rad/s）' }, y: forceA } :
      { x: { tex: 'F_B\\,(\\mathrm{N})', text: 'B 側徑向力（N）' }, y: forceA };
  }
  function drawGraph() {
    if ($("graphCard").hidden || !graphOpen) return;
    const compact = view() === "collect" && matchMedia("(max-width:899px)").matches;
    const height = compact ? Math.max(150, Math.round(360 * graph.clientHeight / Math.max(1, graph.clientWidth))) : 210, bottom = height - 50;
    graph.setAttribute("viewBox", `0 0 360 ${height}`);
    const run = shownRun(), kind = M.KINDS[page()], axes = graphAxes(kind);
    const points = run ? graphPoints(kind, run) : [], alternate = task()?.runs.find(item => item !== run);
    const other = alternate ? graphPoints(kind, alternate) : [];
    const all = points.concat(other), maxX = Math.max(0.1, ...all.map(p => kind === "omega" ? Math.abs(p[0]) : p[0])) * 1.12, minX = kind === "omega" && !squaredGraph ? -maxX : 0, maxY = Math.max(0.1, ...all.map(p => p[1])) * 1.12;
    const px = x => 66 + (x - minX) / (maxX - minX) * 265, py = y => bottom - y / maxY * (bottom - 25);
    graphProjection = { px, py, minX, maxX, maxY };
    const box = graph.getBoundingClientRect(), scale = Math.min(box.width / 360, box.height / height);
    if (!scale) return;
    const axisFont = Math.max(18, 16 / scale), tickFont = Math.max(13, 13 / scale);
    const result = run?.fit ? graphFit(kind, run) : null;
    const curve = result?.ok ? Array.from({ length: 51 }, (_, i) => {
      const x = result.minX + i / 50 * (result.maxX - result.minX);
      return `${i ? "L" : "M"}${px(x).toFixed(2)} ${py(NewtonFitting.predict(result.model, result.coefficients, x)).toFixed(2)}`;
    }).join(" ") : "";
    if (!$("graphNotation")) graph.innerHTML = '<g id="graphNotation"></g><g id="graphMarks"></g>';
    const notation = $("graphNotation"), notationKey = [kind, squaredGraph, height, axisFont, mathReady].join(":");
    if (notation.dataset.key !== notationKey) {
      notation.innerHTML = `      ${mathReady ? CircuitMath.svg(210, height - 9, axes.x, axisFont, 'fill="#284a5f"') : `<text x="210" y="${height - 9}" text-anchor="middle" font-size="${axisFont}">${axes.x.text}</text>`}
      <g transform="translate(16 ${(bottom + 25) / 2}) rotate(-90)">${mathReady ? CircuitMath.svg(0, 0, axes.y, axisFont, 'fill="#284a5f"') : `<text text-anchor="middle" font-size="${axisFont}">${axes.y.text}</text>`}</g>
`;
      notation.dataset.key = notationKey;
    }
    $("graphMarks").innerHTML = `<defs><marker id="graphAxisArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#64818d"/></marker></defs>
      <g stroke="#e2ebee" stroke-width="1">${[.5,1].map(f => `<path d="M66 ${py(maxY * f)}H331M${px(maxX * f)} 25V${bottom}"/>`).join("")}</g>
      <g fill="none" stroke="#64818d" stroke-width="1.5" marker-end="url(#graphAxisArrow)"><path class="axis-x" d="M66 ${bottom}H339"/><path class="axis-y" d="M${px(0)} ${bottom}V17"/></g>
      <g fill="#56717d" font-size="${tickFont}"><text x="66" y="${bottom + 20}">${fmt(minX)}</text>${minX < 0 ? `<text x="${px(0)}" y="${bottom + 20}" text-anchor="middle">0</text>` : ''}<text x="331" y="${bottom + 20}" text-anchor="end">${fmt(maxX)}</text><text x="59" y="32" text-anchor="end">${fmt(maxY)}</text></g>
      ${other.map(([x,y]) => `<circle cx="${px(x)}" cy="${py(y)}" r="4" fill="#b07932" opacity=".65"/>`).join("")}
      ${points.map(([x,y], i) => `<circle class="measured-point" cx="${px(x)}" cy="${py(y)}" r="4" fill="#087c95" stroke="white" stroke-width="1"/>${view() === "collect" && run.q[i] === lastSampleQ && performance.now() - lastSampleAt < 750 ? `<circle class="new-point-ring" cx="${px(x)}" cy="${py(y)}" r="8" fill="none" stroke="#b56317" stroke-width="2" aria-hidden="true"/>` : ""}`).join("")}
      ${curve ? `<path class="fit-curve" d="${curve}" fill="none" stroke="#bd5a25" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round"/>` : ""}
      <path id="livePoint" d="M-8 0H8M0-8V8" fill="none" stroke="#bc5c17" stroke-width="2.5" visibility="hidden"/>
      ${!points.length ? `<text x="205" y="${(bottom + 25) / 2}" text-anchor="middle" fill="#6d8590" font-size="${tickFont}">${view() === 'collect' && controller.editable ? '推轉後開始測量，再按住減速' : '本組尚未記錄數據'}</text>` : ''}`;
    $("graphLegend").hidden = !points.length && !other.length;
    $("graphLegend").textContent = `藍點：量測記錄 · 橙十字：即時讀數${other.length ? " · 棕色：另一組" : ""}`;
  }
  function renderRotor() {
    if (!state()) return;
    const angle = view() === "setup" ? 0 : -motion.angle * 180 / Math.PI;
    device.querySelector("#rotatingAssembly")?.setAttribute("transform", `rotate(${angle} 300 230)`);
    device.querySelectorAll(".assembly-label").forEach(label => label.setAttribute("transform", `rotate(${-angle} ${label.dataset.x} ${label.dataset.y})`));
  }
  function renderControls() {
    $("measureButton").disabled = !controller.editable || view() !== "collect" || !running || !!drag || !measuring && (Math.abs(motion.omega) < .25);
    updateText("measureButton", measuring ? "暫停測量" : "開始測量");
    $("measureButton").setAttribute("aria-pressed", String(measuring));
    $("brakeButton").disabled = !controller.editable || view() !== "collect" || !running || !!drag || !motion.omega;
    $("brakeButton").setAttribute("aria-pressed", String(!!brakeHold));
  }
  function renderMotion(force = false) {
    if (!state()) return;
    renderRotor();
    const now = performance.now();
    if (!force && now - lastReadoutAt < 50) return;
    lastReadoutAt = now;
    if (performance.now() - lastSampleAt >= 750) graph.querySelector(".new-point-ring")?.remove();
    const reading = M.readings(displayedConfig(), motion.omega), live = graph.querySelector("#livePoint");
    if (live && graphProjection) {
      const { px, py, minX, maxX, maxY } = graphProjection, x = page() === 2 ? motion.omega : reading.b;
      const visible = view() === "collect" && running && shownRun()?.q.length && x >= minX && x <= maxX && reading.a <= maxY;
      live.setAttribute("visibility", visible ? "visible" : "hidden");
      if (visible) live.setAttribute("transform", `translate(${px(x)} ${py(reading.a)})`);
    }
    updateText("omegaRead", motion.omega.toFixed(3));
    updateText("forceARead", fmt(reading.a));
    updateText("forceBRead", fmt(reading.b));
    updateText("compactOmega", motion.omega.toFixed(3));
    updateText("compactForceA", fmt(reading.a)); updateText("compactForceB", fmt(reading.b));

    renderControls();
    let hint, status;
    if (drag) { status = "dragging"; hint = "推轉中，暫不取點；放手後繼續。"; }
    else if (Math.abs(motion.omega) < .25) { status = "slow"; hint = measuring ? "轉速太低，暫停取點；可直接再推快。" : "拖外圈推轉、放手，再開始測量。"; }
    else if (!measuring) { status = "paused"; hint = "按「開始測量」，再按住舞台的減速掣。"; }
    else if (performance.now() - lastSampleAt < 750) { status = "added"; hint = `已新增第 ${activeRun().q.length} 點 · 新點以橙圈標示。`; }
    else if (!M.sampleReady(activeRun(), motion.omega, M.KINDS[page()])) { status = "repeated"; hint = S.coverage(M.KINDS[page()], activeRun()).dataScore === 4 ? "這段轉速已記錄；取點已足夠，可分析。" : brakeHold ? "這段轉速已記錄，不重複加點。" : "這段轉速已記錄；按住減速試其他轉速。"; }
    else { status = "ready"; hint = "測量中 · 按住減速收集不同轉速。"; }
    if ($("measurementHint").textContent !== hint) $("measurementHint").textContent = hint;
    $("measurementHint").dataset.status = status;
  }
  function setSelect(id, options, value, disabled) {
    const select = $(id), selected = value ?? "";
    select.innerHTML = `<option value="">未答</option>${ordered(options, id).map(([key, label]) => `<option value="${key}">${safe(label)}</option>`).join("")}`;
    select.value = selected; select.disabled = disabled;
  }
  function renderRuns() {
    const t = task(), locked = !controller.editable || state().view === "check";
    $("runList").innerHTML = t.runs.length ? t.runs.map((run, i) => `<div class="run-card ${t.current === i || locked && reviewRun[page()] === i ? "current" : ""}"><strong>${runNames[i]}</strong><p><span data-run-count="${i}">${run.q.length}</span> 個量測點 · ${math(`m_A=${fmt(M.mass(run.cfg[2]))}\\,\\mathrm{kg},\\ r_A=${fmt(M.radius(run.cfg[0]))}\\,\\mathrm{m}`, 'A 側質量與半徑')} · ${math(`m_B=${fmt(M.mass(run.cfg[3]))}\\,\\mathrm{kg},\\ r_B=${fmt(M.radius(run.cfg[1]))}\\,\\mathrm{m}`, 'B 側質量與半徑')}</p><div class="run-actions"><button data-run="view:${i}" ${controller.mode === "technical" || controller.mode === "mismatch" || state().view === "check" && controller.editable ? "disabled" : ""}>${locked ? "查看" : "查看及作答"}</button>${locked ? "" : `<button data-run="delete:${i}">刪除本組</button>`}</div></div>`).join("") : "<p>尚未收集數據。你仍可回答概念題或檢查作答。</p>";
    $("runHint").textContent = state().rv < 4 ? "舊版已提交作答保留原有評分規則。" : t.runs.length >= 2 ? "兩組均計分。請分別擬合及作答；重做時只清除指定的一組。" : "請完成兩組數據，兩組均計分。返回「器材設定」可準備下一組。";
  }
  function renderSampling() {
    const run = shownRun(), p = page(), cfg = task().work, editing = controller.editable && view() !== "check";
    $("collectStatus").textContent = `${run?.q.length || 0} 點`;
    $("collectStatus").title = p === 2 ? `正 ${run?.q.filter(q=>q>0).length || 0}／負 ${run?.q.filter(q=>q<0).length || 0}` : "";
    $("collectStatus").setAttribute("aria-label", [$("collectStatus").textContent, $("collectStatus").title].filter(Boolean).join("，"));
    const enough = S.coverage(M.KINDS[p], run).dataScore === 4;
    $("samplingGuide").dataset.sufficient = String(enough);
    $("samplingGuide").textContent = "✓ 足夠";
    $("samplingGuide").hidden = !enough || !["collect","analyse"].includes(view());
    $("notice").hidden = !controller.notice && !localMessage;
    $("notice").textContent = localMessage || controller.notice;
    $("saveRetryButton").hidden = !controller.editable || !controller.unsaved;
    document.querySelectorAll("[data-run-count]").forEach(node => { node.textContent = task().runs[Number(node.dataset.runCount)].q.length; });
  }
  function render() {
    const s = state(), locked = !controller.editable, p = page(), v = view();
    $("app").dataset.view = v;
    const location = `${p}:${v}`;
    if (location !== lastLocation) { if (v === "collect") squaredGraph = false; $("controlPanel").scrollTop = 0; if (v === "analyse") graphOpen = true; lastLocation = location; }
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
    if (!s) { $("stageHint").textContent = "作答數據尚未能安全讀取。"; return; }
    const t = task(), cfg = t.work, run = shownRun(), editing = !locked && v !== "check";
    $("app").dataset.experiment = M.KINDS[p];
    $("measurementRoles").hidden = p !== 2 || v === "setup";
    document.querySelector(".setting-row.side-b").hidden = p === 2;
    $("setupHelp").textContent = p === 2 ? "拖動 A 調半徑，砝碼放入 A 托座或拖回盤取下，亦可用 ＋／−。B 是平衡配重，新設定的質量與半徑自動跟隨 A，不作測力。" : "左右拖 A／B 調半徑；砝碼拖入托座，拖回「砝碼盤」取下，亦可用 ＋／−。圖中「砝碼 × 數量」顯示各側放入的塊數。";
    document.querySelector(".mass-token.tray").setAttribute("aria-label", p === 2 ? "從砝碼盤拖一塊圓片到 A 托座；拖回此盤可取下砝碼" : "從砝碼盤拖一塊圓片到 A 或 B 托座；拖回此盤可取下砝碼");
    $("graphTitle").textContent = p === 2 ? "A 側徑向力與角速度" : "同步量測圖";
    $("taskNumber").textContent = `實驗 ${p + 1} / 3`; $("taskTitle").textContent = titles[p]; $("taskPrompt").textContent = prompts[p] + (s.rv >= 4 ? " 請量測兩組數據，分別擬合及作答；兩組均計分。" : "");
    $("setupPanel").hidden = v !== "setup"; $("collectPanel").hidden = v !== "collect"; $("analysePanel").hidden = v !== "analyse";
    $("taskIntro").hidden = v !== "setup";
    $("collectHelp").hidden = v !== "collect";
    $("samplingGuide").hidden = !["collect", "analyse"].includes(v);
    $("graphCard").hidden = !["collect", "analyse"].includes(v);
    $("graphBody").hidden = !graphOpen;
    $("toggleGraph").setAttribute("aria-expanded", String(graphOpen));
    $("toggleGraph").textContent = graphOpen ? "−" : "＋";
    $("toggleGraph").setAttribute("aria-label", graphOpen ? "收合數據圖" : "展開數據圖");
    $("setupView").textContent = "器材設定";
    $("analyseView").textContent = "擬合分析";
    $("experimentSelect").value = String(p);
    $("experimentSelect").disabled = !s;
    $("mobileCheckButton").hidden = locked;
    $("measureButton").hidden = !editing || v !== "collect";
    $("setupView").disabled = !editing; $("collectView").disabled = !editing || t.current === null; $("analyseView").disabled = !editing || t.current === null;
    for (const [id, target] of [["setupView", "setup"], ["collectView", "collect"], ["analyseView", "analyse"]]) $(id).setAttribute("aria-current", v === target ? "page" : "false");
    const inquiry = s.rv >= 2 && p < 2;
    $("inquiryField").hidden = !inquiry || v !== "setup"; $("rolesField").hidden = inquiry;
    $("setupReasonPrompt").textContent = p === 0 ? "要研究徑向力與半徑的關係，兩側質量應怎樣設定？為甚麼？" : "要研究徑向力與總質量的關係，兩側半徑應怎樣設定？為甚麼？";
    setSelect("setupReason", [["equal-mass", "兩側質量相同，避免質量差異影響比較結果"], ["equal-radius", "兩側半徑相同，避免半徑差異影響比較結果"], ["equal-force", "先把兩側的徑向力調成相同"], ["different-both", "兩側的質量和半徑都要不同"]], t.inquiry?.[0], !editing);
    setSelect("speedRelation", [["ratio-steady", "兩側徑向力隨轉速改變，但兩者的比值保持不變"], ["forces-steady", "兩側徑向力都保持不變"], ["ratio-speed", "兩側徑向力的比值隨轉速增大"], ["unrelated", "兩側徑向力沒有固定比例"]], t.inquiry?.[1], !editing);
    $("squareGraph").hidden = p !== 2 || v !== "analyse";
    $("squareGraph").textContent = squaredGraph ? "返回帶正負角速度圖" : "改看角速度平方圖";
    $("squareGraph").setAttribute("aria-pressed", String(squaredGraph));
    $("independent").value = t.roles[0] || ""; $("independent").disabled = !editing;
    for (const input of document.querySelectorAll("[data-control]")) { input.checked = (t.roles[1] || []).includes(input.dataset.control); input.disabled = !editing; }
    ["rAValue", "rBValue"].forEach((id, i) => { $(id).innerHTML = math(`r_${i ? 'B' : 'A'}=${M.radius(cfg[i]).toFixed(2)}\\,\\mathrm{m}`, `${M.radius(cfg[i]).toFixed(2)} m`); });
    ["mAValue", "mBValue"].forEach((id, i) => { $(id).innerHTML = `${cfg[i + 2] ? cfg[i + 2] + ' 塊' : '空托座'}<small>${math(`m_${i ? 'B' : 'A'}=${M.mass(cfg[i + 2]).toFixed(3)}\\,\\mathrm{kg}`, `${M.mass(cfg[i + 2]).toFixed(3)} kg`)}</small>`; });
    for (const button of document.querySelectorAll("[data-step]")) { const [field, delta] = button.dataset.step.split(":").map(Number); button.disabled = !editing || v !== "setup" || cfg[field] + delta < 0 || cfg[field] + delta > (field < 2 ? 6 : 8); }
    $("startButton").disabled = !editing || t.runs.length >= 2;
    $("startButton").textContent = t.runs.length ? `準備${runNames[1]} →` : `準備${runNames[0]} →`;
    if (t.runs.length >= 2) $("startButton").textContent = "已建立兩組數據";
    $("setupRunNote").hidden = !t.runs.length;
    $("setupRunNote").textContent = t.runs.length >= 2 ? "已保留兩組。可繼續原組，或清除目前組並按新設定重做。" : "第一組數據已保留。調整器材後可準備第二組數據。";
    $("restartRunButton").hidden = !editing || t.current === null;
    $("restartRunNote").hidden = $("restartRunButton").hidden;
    $("restartRunButton").disabled = !editing;
    $("collectView").textContent = "轉動量測";
    $("brakeButton").hidden = !editing || v !== "collect";
    renderRuns(); renderSampling();
    $("analyseTitle").textContent = run ? `${runNames[t.current ?? reviewRun[p] ?? t.selected ?? 0]}：比較與解釋` : "比較與解釋";
    $("fitButton").disabled = !editing || !activeRun(); $("resumeFromGraph").disabled = !editing || !activeRun();
    $("axisLabel").innerHTML = p === 2 && squaredGraph ? `橫軸 ${math("\\omega^2", "角速度平方")}；縱軸 ${math("F_A", "A 側徑向力")}。檢查直線斜率及截距；原角速度圖與答案保留。` : p === 2 ? `橫軸 ${math('\\omega\\,(\\mathrm{rad}/\\mathrm{s})', '角速度（rad/s）')}；縱軸 ${math('F_A\\,(\\mathrm{N})', 'A 側徑向力（N）')}。二次擬合含一次項及常數項。` : `橫軸 ${math('F_B\\,(\\mathrm{N})', 'B 側徑向力（N）')}；縱軸 ${math('F_A\\,(\\mathrm{N})', 'A 側徑向力（N）')}。兩軸都是同步量測的力；比較斜率與設定比值，並檢查截距。`;
    const fit = run?.fit ? graphFit(M.KINDS[p], run) : null;
    const fitNumber = value => fmt(Math.abs(value) < 1e-12 ? 0 : value).replace(/e([+-]?\d+)/, '\\times10^{$1}');
    $("fitResult").innerHTML = fit?.ok ? p === 2 && !squaredGraph ? `${math(`F_A=${fitNumber(fit.coefficients[0])}\\omega^2+${fitNumber(fit.coefficients[1])}\\omega+${fitNumber(fit.coefficients[2])}\\,\\mathrm{N}`, 'A 側徑向力二次擬合')}` : `${math(`F_A=${fitNumber(fit.coefficients[0])}${p === 2 ? "\\omega^2" : "F_B"}+${fitNumber(fit.coefficients[1])}\\,\\mathrm{N}`, '兩側徑向力線性擬合')}` :
      run?.a.some(Boolean) && run.q.length >= 2 ? "數據已更新或尚未擬合；原有結論保留，請重新擬合比較。" : "尚未擬合；請先收集足夠的不同轉速。";
    $("numericPrompt").innerHTML = p === 2 ? "角速度加倍時，力變成多少倍？" : p === 0 ? `${math('r_A/r_B', '兩側半徑的比值')} = ?` : `${math('m_A/m_B', '兩側質量的比值')} = ?`;
    $("numericAnswer").value = run?.a[0] || ""; $("numericAnswer").disabled = !editing || !activeRun();
    setSelect("comparison", p === 2 ? lawOptions : compareOptions, run?.a[1], !editing || !activeRun());
    setSelect("reason", reasonOptions, run?.a[2], !editing || !activeRun());
    $("lawPrompt").innerHTML = p === 2 ? `${math('F_A', 'A 側徑向力')} 與 ${math('\\omega', '角速度')} 的關係` : p === 0 ? `${math('F', '徑向力')} 與 ${math('r', '半徑')} 的關係` : `${math('F', '徑向力')} 與 ${math('m', '質量')} 的關係`;
    if (p < 2) $("lawPrompt").innerHTML = `兩側${p === 0 ? "質量" : "半徑"}相同、同時角速度相同時，兩側徑向力的比值 ${math("F_A/F_B", "兩側徑向力的比值")} 與${p === 0 ? "半徑" : "總質量"}的比值 ${math(p === 0 ? "r_A/r_B" : "m_A/m_B", "A側除以B側的比值")} 有甚麼關係？`;
    else $("lawPrompt").innerHTML = `固定質量及半徑，${math("F_A", "徑向力")} 與 ${math("\\omega", "角速度")} 的關係`;
    setSelect("law", p < 2 ? [["linear", "兩個比值相等"], ["square", "前者等於後者的平方"], ["inverse", "前者等於後者的倒數"], ["none", "沒有固定關係"]] : lawOptions, t.law, !editing);
    $("syncAnswer").value = s.sync || ""; $("massPartsAnswer").value = s.massParts || "";
    $("syncAnswer").disabled = !editing; $("massPartsAnswer").disabled = !editing;
    $("clearTaskButton").disabled = !editing;
    const canOperate = editing && v === "collect";
    $("spinTargets").hidden = !canOperate;
    for (const button of document.querySelectorAll(".radius-handle,.mass-token")) button.hidden = !editing || v !== "setup" || p === 2 && (button.dataset.side === "B" || button.dataset.mass === "B");
    $("weightTray").hidden = !editing || v !== "setup";
    $("stageHint").textContent = matchMedia("(max-height:260px) and (max-width:479px)").matches ?
      v === "collect" ? "拖金色環推動；讀數在下方。" : "短視窗可用下方按鈕設定；全螢幕可直接拖動。" :
      v === "analyse" ? "轉盤已暫停；數據圖可收合，裝置保留顯示。" : v === "collect" ? running ? "沿金色外圈拖動轉盤" : "已暫停；直接拖動金色外圈繼續。" : v === "check" ? "檢查及提交在操作面板。" : "左右拖 A／B 調整半徑";
    if (v === "check") {
      $("checkSummary").innerHTML = s.tasks.map((item, i) => `<div class="check-row"><strong>實驗 ${i + 1} · ${titles[i]}</strong>${[0,1].map(index => { const r = item.runs[index]; return `<small>${runNames[index]}：${r?.q.length ? r.q.length + " 個量測點" : "未量測"} · ${r?.fit ? "已擬合" : "未擬合"} · 作答 ${r?.a.filter(a => a !== null && a !== "").length || 0}/3</small>`; }).join("")}<small>結論 ${item.law === null ? "未答" : "已答"}</small></div>`).join("") + `<div class="check-row">綜合問題：${[s.sync, s.massParts].filter(Boolean).length} / 2 已答</div>`;
      $("submitButton").disabled = !controller.editable || controller.unsaved;
    }
    if (!$("feedbackPanel").hidden) {
      const result = controller.result;
      $("feedback").innerHTML = result?.detail?.pages ? result.detail.pages.map((part, i) => `<p>實驗 ${i + 1}：${part.score} / 30。${part.runs ? part.runs.map((r, j) => `${runNames[j]}：${r.score / 2} / 9。`).join(" ") : ""}${i === 2 ? `理想關係 ${math('F_A=m_A r_A\\omega^2', 'A 側徑向力公式')}；二次係數是 ${math('m_A r_A', '質量與半徑的乘積')}。` : i === 0 ? `同時刻兩側 ${math('\\omega', '角速度')} 相同；公平比較時 ${math('F_A/F_B=r_A/r_B', '兩側徑向力與半徑比相等')}。` : `同時刻兩側 ${math('\\omega', '角速度')} 相同；公平比較時 ${math('F_A/F_B=m_A/m_B', '兩側徑向力與質量比相等')}。`}</p>`).join("") : "";
    }
    drawDevice(); drawGraph();
    renderMotion(true); layoutTargets();
  }
  function clearDropPreview() {
    delete $("app").dataset.drag;
    document.querySelectorAll(".drop-ready,.drop-active").forEach(button => button.classList.remove("drop-ready", "drop-active"));
    $("trayHint").textContent = "取用／放回";
  }
  function cancelDrag() {
    if (!drag) return;
    const operation = drag; drag = null;
    clearDropPreview();
    if (operation.type === "mass") { operation.target.style.left = ""; operation.target.style.top = ""; operation.target.style.bottom = ""; operation.target.classList.remove("dragging"); }
    try { operation.target.releasePointerCapture(operation.id); } catch (_) {}
    layoutTargets();
  }
  function massHit(event, side, pointerType) {
    if (page() === 2 && side === "B") return false;
    const center = mapPoint(componentX(side, task().work[side === "A" ? 0 : 1]), 230);
    return Math.hypot(event.clientX - center.x, event.clientY - center.y) <= Math.max(24, 15 * center.scale) + (pointerType === "touch" ? 18 : 10);
  }
  function trayHit(event) {
    const r = $("weightTray").getBoundingClientRect();
    return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
  }
  function down(event) {
    if (drag || event.pointerType === "touch" && !event.isPrimary) { if (drag) { pause(); render(); } return; }
    if (!controller.editable || state().view === "check") return;
    const target = event.target.closest(".spin-segment,.radius-handle,.mass-token");
    if (!target || target.hidden) return;
    const type = target.classList.contains("spin-segment") ? "spin" : target.classList.contains("radius-handle") ? "radius" : "mass";
    if (type === "spin" && view() !== "collect" || type !== "spin" && view() !== "setup") return;
    if (type === "mass" && target.dataset.mass !== "tray" && task().work[target.dataset.mass === "A" ? 2 : 3] === 0) return;
    event.preventDefault(); target.focus({ preventScroll: true }); target.setPointerCapture(event.pointerId);
    drag = { target, id: event.pointerId, type, side: target.dataset.side || target.dataset.mass, proposed: null, pointerType: event.pointerType };
    if (type === "spin") {
      advanceMotion();
      running = true;
      $("stageHint").textContent = "沿金色外圈拖動轉盤";
      releaseBrake();
      drag.center = mapPoint(300, 230);
      motion = M.dragMotion({ ...motion, pointerAngle: null }, Math.atan2(event.clientY - drag.center.y, event.clientX - drag.center.x), event.timeStamp);
      renderRotor(); renderControls();
    }
    if (type === "mass") {
      $("app").dataset.drag = "mass";
      document.querySelectorAll(".mass-token.placed").forEach(button => button.classList.add("drop-ready"));
      if (drag.side !== "tray") { $("weightTray").classList.add("drop-ready"); $("trayHint").textContent = "拖回取下"; }
      $("stageHint").textContent = (page() === 2 ? "把圓片放到 A 托座；B 配重會自動跟隨。" : "把圓片放到 A／B 托座；移除砝碼可拖回砝碼盤。");
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
      advanceMotion();
      const events = event.getCoalescedEvents?.() || [], { x, y, scale } = drag.center;
      for (const point of events.length ? events : [event]) {
        if (Math.hypot(point.clientX - x, point.clientY - y) < 30 * scale) continue;
        motion = M.dragMotion(motion, Math.atan2(point.clientY - y, point.clientX - x), point.timeStamp);
      }
      if (motion.warning) { localMessage = "手勢跳幅過大；請慢一點重新推動。"; $("notice").hidden = false; $("notice").textContent = localMessage; }
      else localMessage = "";
      renderRotor();
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
      const back = drag.side !== "tray" && trayHit(event);
      $("weightTray").classList.toggle("drop-active", back);
      $("trayHint").textContent = back ? "放手取下" : drag.side === "tray" ? (page() === 2 ? "拖到 A" : "拖到 A／B") : "拖回取下";
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
    if (operation.type === "spin") {
      advanceMotion();
      const { x, y, scale } = operation.center;
      if (Math.hypot(event.clientX - x, event.clientY - y) >= 30 * scale) {
        motion = M.dragMotion(motion, Math.atan2(event.clientY - y, event.clientX - x), event.timeStamp);
      }
      motion = M.releaseMotion(motion);
      renderRotor(); renderControls();
      return;
    }
    clearDropPreview();
    if (operation.type === "mass") { operation.target.style.left = ""; operation.target.style.top = ""; operation.target.style.bottom = ""; operation.target.classList.remove("dragging"); }
    layoutTargets();
    if (operation.type === "radius" && operation.proposed !== null) {
      const field = operation.side === "A" ? 0 : 1;
      if (!controller.update(next => M.setWork(next.tasks[next.page], field, operation.proposed))) render();
      return;
    }
    if (operation.type === "mass") {
      const destination = massHit(event, "A", operation.pointerType) ? "A" : massHit(event, "B", operation.pointerType) ? "B" : null;
      const back = trayHit(event);
      if (operation.side === "tray" && destination) controller.update(next => { const t = next.tasks[next.page], field = destination === "A" ? 2 : 3; M.setWork(t, field, t.work[field] + 1); });
      else if (operation.side !== "tray" && (back || destination && destination !== operation.side)) controller.update(next => {
        const t = next.tasks[next.page], from = operation.side === "A" ? 2 : 3;
        if (destination && !back && t.work[destination === "A" ? 2 : 3] >= 8) return;
        if (t.work[from] > 0) { t.work[from]--; if (destination && !back) { const to = destination === "A" ? 2 : 3; M.setWork(t, to, t.work[to] + 1); } }
      });
    }
  }
  function recordCurrent() {
    if (!measuring || !running || drag || !controller.editable || state().view !== "collect" || !M.sampleReady(activeRun(), motion.omega, M.KINDS[page()])) return;
    lastSampleAt = performance.now(); lastSampleQ = Math.round(motion.omega * 1000);
    if (controller.update(next => M.record(next.tasks[next.page], motion.omega, M.KINDS[next.page]), false)) {
      renderSampling(); drawGraph(); renderMotion(true);
    }
  }

  function releaseBrake() {
    const held = brakeHold; brakeHold = null;
    if (held?.id !== undefined) try { $("brakeButton").releasePointerCapture(held.id); } catch (_) {}
    $("brakeButton").setAttribute("aria-pressed", "false");
  }
  function setSpeed(omega) {
    if (!controller.editable || view() !== "collect") return;
    advanceMotion();
    running = true; motion = { ...motion, omega: Math.max(-M.MAX_OMEGA, Math.min(M.MAX_OMEGA, omega)) };
    render();
  }
  function advanceMotion(time = performance.now()) {
    const dt = lastFrame ? (time - lastFrame) / 1000 : 0; lastFrame = time;
    if (running && controller.editable && view() === "collect") {
      // One clock drives rotation, including gaps between pointer events.
      motion = M.coast(motion, dt, !!brakeHold);
      if (!motion.omega) releaseBrake();
    }
  }
  function frame() {
    advanceMotion();
    if (running && controller.editable && view() === "collect") {
      renderMotion();
      // Keep saving and graph layout out of the frame that hands off the gesture.
      if (!drag && measuring && sampleTimer === null && M.sampleReady(activeRun(), motion.omega, M.KINDS[page()])) {
        sampleTimer = setTimeout(() => { sampleTimer = null; recordCurrent(); }, 0);
      }
    }
    requestAnimationFrame(frame);
  }
  function setupEvents() {
    $("experimentSelect").addEventListener("change", event => document.querySelector(`[data-page="${event.target.value}"]`)?.click());
    $("mobileCheckButton").addEventListener("click", () => $("checkButton").click());
    $("measureButton").addEventListener("click", () => { measuring = !measuring; recordCurrent(); renderMotion(true); });
    $("squareGraph").addEventListener("click", () => { squaredGraph = !squaredGraph; render(); });
    const brake = $("brakeButton");
    brake.addEventListener("pointerdown", event => {
      if (brake.disabled || drag || !event.isPrimary || event.button !== 0) return;
      event.preventDefault(); brake.setPointerCapture(event.pointerId); brakeHold = { id: event.pointerId }; renderMotion();
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) brake.addEventListener(name, releaseBrake);
    brake.addEventListener("keydown", event => {
      if (![" ", "Enter"].includes(event.key) || brake.disabled) return;
      event.preventDefault(); if (!event.repeat) { brakeHold = { key: event.key }; renderMotion(); }
    });
    brake.addEventListener("keyup", event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); releaseBrake(); } });
    brake.addEventListener("blur", releaseBrake);
    $("toggleGraph").addEventListener("click", () => { graphOpen = !graphOpen; render(); });
    document.addEventListener("pointerdown", event => { if ((drag || brakeHold) && event.pointerType === "touch" && event.pointerId !== (drag?.id ?? brakeHold?.id)) { pause(); render(); } }, true);
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
    $("resumeFromGraph").addEventListener("click", () => { if (controller.navigate(page(), "collect")) { running = true; render(); } });
    $("fitButton").addEventListener("click", () => { const kind = M.KINDS[page()], result = M.fit(kind, activeRun());
      if (result.ok) controller.update(next => { next.tasks[next.page].runs[next.tasks[next.page].current].fit = true; });
      else { localMessage = result.message; render(); } });
    [["setupReason", 0], ["speedRelation", 1]].forEach(([id, i]) => $(id).addEventListener("change", event => controller.update(next => { next.tasks[next.page].inquiry[i] = event.target.value || null; })));
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
  window.__centripetalApp = { getState: () => M.clone(state()), getMotion: () => ({ ...motion, running, measuring, braking: !!brakeHold }) };
})();
