(function () {
  "use strict";

  const ACTIVITY = "position-time-graph-motion-lab";
  const S = window.PositionTimeScoring;
  const P = window.PositionTimePersistence;
  const ROAD = { left: 70, right: 750, y: 108 };
  const GRAPH = { left: 80, right: 760, top: 24, bottom: 390 };
  const MISSION_NAMES = ["根據目標圖設定運動", "根據運動畫出 x–t 圖", "量度兩車速度並比較", "建立特殊運動狀態", "兩車相遇挑戰"];
  const dom = Object.fromEntries(["modeDescription", "phaseBadge", "roadSvg", "roadLayer", "graphSvg", "graphLayer", "graphSummary", "taskTitle", "answerState", "taskInstruction", "setupSection", "motionControls", "presetControls", "playButton", "stepButton", "replayButton", "resetButton", "timeSlider", "timeOutput", "answerSection", "answerControls", "probeSection", "probeControls", "dataGrid", "liveStatus", "navigationControls", "resultSection", "resultPanel", "startDialog", "confirmStart", "submitDialog", "confirmSubmit"].map((id) => [id, document.getElementById(id)]));

  let state = P.createExplore();
  const ui = { time: 0, playing: false, frame: 0, lastFrame: 0, explorationProbes: [], drag: null, locked: false, result: null, resultTrusted: false, technical: null, safeSummary: false, reviewStep: 0 };

  function math(symbol, unit, value) {
    const shown = value == null || value === "" ? "--" : signed(value);
    return `<span class="math"><var>${symbol}</var></span> = ${shown}${unit ? ` <span class="unit">${unit}</span>` : ""}`;
  }
  function signed(value) {
    if (!Number.isFinite(Number(value))) return "--";
    const number = Number(value);
    return `${number > 0 ? "+" : number < 0 ? "−" : ""}${Math.abs(number).toFixed(1)}`;
  }
  function escapeText(value) {
    return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
  }
  function snap(value, step) { return Math.round(value / step) * step; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function roadX(position) { return ROAD.left + (position - S.LIMITS.positionMin) / 40 * (ROAD.right - ROAD.left); }
  function graphX(time) { return GRAPH.left + time / 6 * (GRAPH.right - GRAPH.left); }
  function graphY(position) { return GRAPH.bottom - (position - S.LIMITS.positionMin) / 40 * (GRAPH.bottom - GRAPH.top); }
  function clientPoint(svg, event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }
  function svgLine(motion, className, endTime = 6) {
    if (!motion || !Number.isFinite(motion.x0) || !Number.isFinite(motion.v)) return "";
    return `<line class="motion-line ${className}" x1="${graphX(0)}" y1="${graphY(S.positionAt(motion, 0))}" x2="${graphX(endTime)}" y2="${graphY(S.positionAt(motion, endTime))}"></line>`;
  }
  function currentSet() { return state.assessment ? S.getScenarioSet(state.assessment.lv, state.assessment.sid) : null; }
  function missionKey() { return `m${state.currentStep + 1}`; }
  function currentAnswer() { return state.assessment?.ans[missionKey()]; }
  function editable() { return !ui.locked && !ui.technical && (state.phase === "explore" || state.phase === "mission"); }
  function settingsEditable() { return editable() && !ui.playing && ui.time === 0; }

  function announce(message) {
    dom.liveStatus.textContent = message;
  }

  function stopAnimation() {
    ui.playing = false;
    if (ui.frame) cancelAnimationFrame(ui.frame);
    ui.frame = 0;
    ui.lastFrame = 0;
  }
  function play() {
    if (ui.locked && state.phase !== "submitted-review") return;
    if (ui.time >= 6) ui.time = 0;
    ui.playing = !ui.playing;
    if (ui.playing) {
      ui.lastFrame = performance.now();
      ui.frame = requestAnimationFrame(tick);
    } else stopAnimation();
    render();
  }
  function tick(now) {
    if (!ui.playing) return;
    const elapsed = Math.min(0.08, (now - ui.lastFrame) / 1000);
    ui.lastFrame = now;
    ui.time = Math.min(6, ui.time + elapsed);
    renderDynamic();
    if (ui.time >= 6) {
      stopAnimation();
      render();
    } else ui.frame = requestAnimationFrame(tick);
  }
  function setTime(time, speak = false) {
    stopAnimation();
    const previous = ui.time;
    ui.time = clamp(snap(Number(time), 0.5), 0, 6);
    if (state.phase === "explore" && ui.time < previous && ui.explorationProbes.some((probe) => probe > ui.time)) ui.explorationProbes = [];
    render();
    if (speak) announce(`時間游標：${ui.time.toFixed(1)} 秒。`);
  }
  function resetTime(clearProbes = false) {
    stopAnimation();
    ui.time = 0;
    if (clearProbes) ui.explorationProbes = [];
  }

  function render() {
    renderHeader();
    renderTask();
    renderControls();
    renderDynamic();
    renderNavigation();
    renderResult();
  }
  function renderDynamic() {
    dom.timeSlider.value = String(ui.time);
    dom.timeOutput.innerHTML = math("t", "s", ui.time);
    dom.playButton.textContent = ui.playing ? "暫停" : "播放";
    dom.stepButton.disabled = ui.playing || ui.time >= 6 || ui.technical;
    dom.replayButton.disabled = ui.technical;
    dom.resetButton.disabled = ui.playing || ui.technical || state.phase === "submitted-review";
    drawRoad();
    drawGraph();
    renderData();
  }
  function renderHeader() {
    if (ui.technical) {
      dom.phaseBadge.textContent = "技術狀態";
      dom.modeDescription.textContent = ui.technical;
    } else if (ui.safeSummary) {
      dom.phaseBadge.textContent = "只讀摘要";
      dom.modeDescription.textContent = "已完成作答保持鎖定；逐題答案未能安全驗證。";
    } else if (state.phase === "explore") {
      dom.phaseBadge.textContent = "自由探索";
      dom.modeDescription.textContent = "自由設定起點與速度，觀察、重播及量度位置—時間圖。";
    } else if (state.phase === "submitted-review") {
      dom.phaseBadge.textContent = "只讀檢討";
      dom.modeDescription.textContent = "本次作答已鎖定；你仍可重播及移動時間游標。";
    } else {
      dom.phaseBadge.textContent = state.phase === "final-review" ? "提交前檢視" : `任務 ${state.currentStep + 1} / 5`;
      dom.modeDescription.textContent = "五個任務合共 100 分，提交前可回看及修改答案。";
    }
  }
  function renderTask() {
    dom.answerState.hidden = true;
    if (ui.technical) {
      dom.taskTitle.textContent = "暫時無法載入活動";
      dom.taskInstruction.textContent = ui.technical;
      return;
    }
    if (ui.safeSummary) {
      dom.taskTitle.textContent = "Moodle 作答摘要";
      dom.taskInstruction.textContent = "逐題檢討資料無法安全載入，因此只顯示 Moodle 記錄的分數及狀態。";
      return;
    }
    if (state.phase === "explore") {
      dom.taskTitle.textContent = "自由探索";
      dom.taskInstruction.textContent = "設定運動，播放並觀察圖線。探索不計分，亦沒有完成門檻。";
      return;
    }
    if (state.phase === "final-review") {
      dom.taskTitle.textContent = "提交前檢視";
      dom.taskInstruction.textContent = "檢查每題是否完整；此處只顯示完成狀態，不會透露對錯。";
      return;
    }
    const step = state.phase === "submitted-review" ? ui.reviewStep : state.currentStep;
    dom.taskTitle.textContent = `${step + 1}. ${MISSION_NAMES[step]}`;
    dom.taskInstruction.innerHTML = instructionFor(step, currentSet()[`m${step + 1}`]);
    const key = `m${step + 1}`;
    const complete = S.completeness(key, state.assessment.ans[key]);
    dom.answerState.hidden = false;
    dom.answerState.dataset.state = complete;
    dom.answerState.textContent = complete === "complete" ? "已完整" : complete === "partial" ? "部分作答" : "未作答";
  }
  function instructionFor(step, scenario) {
    if (step === 0) return "拖車設定初始位置，再拖速度箭嘴設定速度，令學生圖線符合紫色虛線。";
    if (step === 1) return "播放並觀察車的位置讀數；拖動圖上 <span class=\"math\"><var>P</var><sub>0</sub></span>、<span class=\"math\"><var>P</var><sub>6</sub></span> 畫出直線。";
    if (step === 2) return "分別在 A、B 圖線放置相隔最少 2.0 s 的探針，計算兩車帶符號速度，再比較速度大小。";
    if (step === 3) return scenario.v === 0 ? `建立一架在 <span class="math"><var>t</var></span> = 0.0 <span class="unit">s</span> 至 6.0 <span class="unit">s</span> 都停在 <span class="math"><var>x</var></span> = ${signed(scenario.x0)} <span class="unit">m</span> 的車。` : `建立運動：<span class="math"><var>t</var></span> = 0.0 <span class="unit">s</span> 時 <span class="math"><var>x</var></span> = ${signed(scenario.x0)} <span class="unit">m</span>；<span class="math"><var>t</var></span> = ${scenario.atTime.toFixed(1)} <span class="unit">s</span> 時 <span class="math"><var>x</var></span> = ${signed(scenario.atPosition)} <span class="unit">m</span>。`;
    return `A 車已固定。設定 B 車，令兩車在 <span class="math"><var>t</var><sup>*</sup></span> = ${scenario.meetTime.toFixed(1)} <span class="unit">s</span> 相遇，再輸入相遇位置 <span class="math"><var>x</var><sup>*</sup></span>。`;
  }

  function renderControls() {
    dom.setupSection.hidden = ui.technical || ui.safeSummary || state.phase === "final-review" || state.phase === "submitted-review" && ui.reviewStep === 1 || state.phase === "submitted-review" && ui.reviewStep === 2;
    dom.answerSection.hidden = true;
    dom.probeSection.hidden = true;
    dom.motionControls.replaceChildren();
    dom.presetControls.replaceChildren();
    dom.answerControls.replaceChildren();
    dom.probeControls.replaceChildren();
    if (ui.technical || ui.safeSummary || state.phase === "final-review") return;
    const step = state.phase === "submitted-review" ? ui.reviewStep : state.phase === "mission" ? state.currentStep : null;
    if (state.phase === "explore") {
      dom.motionControls.innerHTML = motionControlHtml(state.exploration.x0, state.exploration.v, false);
      dom.presetControls.innerHTML = [
        ["靜止", 0, 0], ["慢速向右", -6, 1], ["快速向右", -6, 2], ["慢速向左", 6, -1], ["快速向左", 6, -2], ["非零位置出發", 4, 1.5]
      ].map(([label, x0, v]) => `<button type="button" data-preset="${x0},${v}" ${settingsEditable() ? "" : "disabled"}>${label}</button>`).join("");
      renderProbeControls("explore");
    } else if (step === 0 || step === 3 || step === 4) {
      const answer = state.assessment.ans[`m${step + 1}`];
      const values = step === 4 ? { x0: answer.x0B, v: answer.vB } : answer;
      dom.motionControls.innerHTML = motionControlHtml(values.x0, values.v, ui.locked);
      if (step === 4) {
        dom.answerSection.hidden = false;
        dom.answerControls.innerHTML = numberInputHtml("meetingX", "相遇位置", "x<sup>*</sup>", "m", answer.meetingX, -20, 20, 0.5);
      }
    } else if (step === 1) {
      dom.answerSection.hidden = false;
      const answer = state.assessment.ans.m2;
      dom.answerControls.innerHTML = `${graphPointControl("xStart", "P<sub>0</sub>（t = 0 s）", answer.xStart)}${graphPointControl("xEnd", "P<sub>6</sub>（t = 6 s）", answer.xEnd)}`;
    } else if (step === 2) {
      dom.answerSection.hidden = false;
      const answer = state.assessment.ans.m3;
      dom.answerControls.innerHTML = ["A", "B"].map((label) => numberInputHtml(`${label}-velocity`, `${label} 車速度`, `v<sub>${label}</sub>`, "m/s", answer[label].velocity, -2, 2, 0.1)).join("") + fasterControl(answer.faster);
      renderProbeControls("assessment");
    }
    bindControlEvents();
  }
  function motionControlHtml(x0, velocity, locked) {
    const disabled = locked || !settingsEditable();
    return quantityControl("x0", "初始位置", "x<sub>0</sub>", "m", x0, -8, 8, 1, disabled) + quantityControl("velocity", "速度", "v", "m/s", velocity, -2, 2, 0.5, disabled);
  }
  function quantityControl(name, label, symbol, unit, value, min, max, step, disabled) {
    const fallback = value == null ? 0 : value;
    return `<div class="quantity-control">
      <div class="value-heading"><label for="${name}Range">${label} <span class="math"><var>${symbol}</var></span></label><output id="${name}Value">${value == null ? "未設定" : `${signed(value)} <span class="unit">${unit}</span>`}</output></div>
      <input id="${name}Range" data-quantity="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${fallback}" ${disabled ? "disabled" : ""} aria-label="${label}">
      <div class="stepper"><button type="button" data-step-quantity="${name}" data-delta="-${step}" ${disabled ? "disabled" : ""} aria-label="減少${label}">−</button><span class="math-readout">${value == null ? "--" : `${signed(value)} <span class="unit">${unit}</span>`}</span><button type="button" data-step-quantity="${name}" data-delta="${step}" ${disabled ? "disabled" : ""} aria-label="增加${label}">＋</button></div>
    </div>`;
  }
  function graphPointControl(name, label, value) {
    return quantityControl(name, label, "x", "m", value, -20, 20, 1, ui.locked);
  }
  function numberInputHtml(name, label, symbol, unit, value, min, max, step) {
    return `<label class="quantity-control" for="${name}Input"><span>${label} <span class="math"><var>${symbol}</var></span></span><span class="number-with-unit"><input id="${name}Input" data-number-answer="${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${value == null ? "" : value}" ${ui.locked ? "disabled" : ""}><span class="unit">${unit}</span></span></label>`;
  }
  function fasterControl(value) {
    return `<fieldset><legend>速度大小較大</legend><div class="choice-grid">${[["A", "A 車"], ["B", "B 車"], ["same", "一樣快"]].map(([key, label]) => `<button type="button" data-faster="${key}" aria-pressed="${value === key}" ${ui.locked ? "disabled" : ""}>${label}</button>`).join("")}</div><p class="sr-note">亦可拖動圖內「速度大小較大」標記到 A、B 或一樣快區域。</p></fieldset>`;
  }
  function renderProbeControls(mode) {
    dom.probeSection.hidden = false;
    if (mode === "explore") {
      const motion = state.exploration;
      dom.probeControls.innerHTML = probeCard("探索圖線", ui.explorationProbes, motion, "E", ui.time) + `<div class="button-row"><button type="button" data-add-probe="E" ${ui.time <= 0 || ui.explorationProbes.length >= 2 ? "disabled" : ""}>加入下一個探針</button><button type="button" data-clear-probe="E" ${ui.explorationProbes.length ? "" : "disabled"}>清除探針</button></div>`;
    } else {
      const answer = state.assessment.ans.m3;
      const scenario = currentSet().m3;
      dom.probeControls.innerHTML = ["A", "B"].map((label) => `<div class="probe-card">${probeCard(`${label} 車圖線`, answer[label].probes, scenario[label], label, 6)}<div class="button-row"><button type="button" data-add-probe="${label}" ${ui.locked || answer[label].probes.length >= 2 ? "disabled" : ""}>加入 ${label} 車探針</button><button type="button" data-clear-probe="${label}" ${ui.locked || !answer[label].probes.length ? "disabled" : ""}>清除</button></div></div>`).join("");
    }
  }
  function probeCard(label, probes, motion, line, maxTime) {
    const rows = probes.map((time, index) => {
      const pointLabel = index === 0 ? "P" : "Q";
      return `<label class="range-row"><span>${pointLabel}</span><input type="range" min="0" max="${maxTime}" step="0.5" value="${time}" data-probe-line="${line}" data-probe-index="${index}" ${ui.locked ? "disabled" : ""} aria-label="${label} ${pointLabel} 探針時間"><output>(${time.toFixed(1)} s, ${signed(S.positionAt(motion, time))} m)</output></label>`;
    }).join("");
    const delta = probes.length === 2 ? measurementHtml(probes, motion) : "加入 P、Q 兩個探針以顯示 Δt 及 Δx。";
    return `<div class="probe-heading"><strong>${label}</strong><span>${probes.length}/2</span></div>${rows}<div class="muted">${delta}</div>`;
  }
  function measurementHtml(probes, motion) {
    const dt = probes[1] - probes[0];
    const dx = S.positionAt(motion, probes[1]) - S.positionAt(motion, probes[0]);
    if (Math.abs(dt) < 1e-12) return "兩個探針時間相同，未能計算速度。";
    return `<span class="math">Δ<var>t</var></span> = ${signed(dt)} <span class="unit">s</span>；<span class="math">Δ<var>x</var></span> = ${signed(dx)} <span class="unit">m</span>${state.phase === "explore" ? `；<span class="math"><var>v</var> = Δ<var>x</var>/Δ<var>t</var></span> = ${signed(dx / dt)} <span class="unit">m/s</span>` : ""}`;
  }

  function bindControlEvents() {
    document.querySelectorAll("[data-quantity]").forEach((input) => input.addEventListener("input", () => updateQuantity(input.dataset.quantity, Number(input.value), false)));
    document.querySelectorAll("[data-quantity]").forEach((input) => input.addEventListener("change", () => { saveDraft(); announce("運動設定已更新。"); }));
    document.querySelectorAll("[data-step-quantity]").forEach((button) => button.addEventListener("click", () => stepQuantity(button.dataset.stepQuantity, Number(button.dataset.delta))));
    document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
      const [x0, v] = button.dataset.preset.split(",").map(Number);
      state.exploration = { x0, v };
      resetTime(true);
      saveDraft();
      render();
      announce("快捷情境已載入；你仍可修改數值。");
    }));
    document.querySelectorAll("[data-number-answer]").forEach((input) => input.addEventListener("change", () => updateNumberAnswer(input.dataset.numberAnswer, input.value)));
    document.querySelectorAll("[data-faster]").forEach((button) => button.addEventListener("click", () => { currentAnswer().faster = button.dataset.faster; saveDraft(); render(); announce("速度大小比較標記已保存。"); }));
    document.querySelectorAll("[data-add-probe]").forEach((button) => button.addEventListener("click", () => addProbe(button.dataset.addProbe)));
    document.querySelectorAll("[data-clear-probe]").forEach((button) => button.addEventListener("click", () => clearProbes(button.dataset.clearProbe)));
    document.querySelectorAll("[data-probe-line]").forEach((input) => input.addEventListener("input", () => updateProbe(input.dataset.probeLine, Number(input.dataset.probeIndex), Number(input.value), false)));
    document.querySelectorAll("[data-probe-line]").forEach((input) => input.addEventListener("change", () => { saveDraft(); announce("探針位置已保存。"); }));
  }
  function stepQuantity(name, delta) {
    const current = quantityValue(name);
    const bounds = name === "xStart" || name === "xEnd" ? [-20, 20] : name === "velocity" ? [-2, 2] : [-8, 8];
    updateQuantity(name, clamp((current == null ? 0 : current) + delta, bounds[0], bounds[1]), true);
  }
  function quantityValue(name) {
    if (state.phase === "explore") return name === "x0" ? state.exploration.x0 : state.exploration.v;
    const answer = currentAnswer();
    if (name === "x0") return state.currentStep === 4 ? answer.x0B : answer.x0;
    if (name === "velocity") return state.currentStep === 4 ? answer.vB : answer.v;
    return answer[name];
  }
  function updateQuantity(name, value, persist) {
    if (!settingsEditable() && name !== "xStart" && name !== "xEnd") return;
    if (state.phase === "explore") state.exploration[name === "x0" ? "x0" : "v"] = value;
    else {
      const answer = currentAnswer();
      if (name === "x0") answer[state.currentStep === 4 ? "x0B" : "x0"] = value;
      else if (name === "velocity") answer[state.currentStep === 4 ? "vB" : "v"] = value;
      else answer[name] = value;
    }
    resetTime(state.phase === "explore");
    if (persist) saveDraft();
    render();
  }
  function updateNumberAnswer(name, raw) {
    const answer = currentAnswer();
    const value = raw.trim() === "" ? null : Number(raw);
    if (name === "meetingX") setOptional(answer, "meetingX", value, -20, 20);
    else {
      const [line] = name.split("-");
      setOptional(answer[line], "velocity", value, -2, 2);
    }
    saveDraft();
    render();
  }
  function setOptional(target, key, value, min, max) {
    if (value == null) delete target[key];
    else if (Number.isFinite(value) && value >= min && value <= max) target[key] = value;
    else announce("請輸入操作範圍內的有限數值。");
  }
  function probeList(line) { return line === "E" ? ui.explorationProbes : state.assessment.ans.m3[line].probes; }
  function addProbe(line) {
    const list = probeList(line);
    if (list.length >= 2) return;
    const maxTime = line === "E" ? ui.time : 6;
    list.push(list.length ? Math.min(maxTime, list[0] + 2) : 0);
    saveDraft();
    render();
    announce(`${list.length === 1 ? "P" : "Q"} 探針已加入。`);
  }
  function clearProbes(line) {
    if (line === "E") ui.explorationProbes = [];
    else state.assessment.ans.m3[line].probes = [];
    saveDraft();
    render();
  }
  function updateProbe(line, index, time, persist) {
    probeList(line)[index] = snap(time, 0.5);
    if (persist) saveDraft();
    render();
  }

  function displayContext() {
    if (state.phase === "explore" || ui.safeSummary) return { step: null, scenario: null, answer: null };
    const step = state.phase === "submitted-review" ? ui.reviewStep : state.currentStep;
    return { step, scenario: currentSet()[`m${step + 1}`], answer: state.assessment.ans[`m${step + 1}`] };
  }
  function answerMotion(step, answer) {
    if (step === 0 || step === 3) return { x0: answer.x0 ?? 0, v: answer.v ?? 0, incomplete: answer.x0 == null || answer.v == null };
    if (step === 4) return { x0: answer.x0B ?? 0, v: answer.vB ?? 0, incomplete: answer.x0B == null || answer.vB == null };
    return null;
  }
  function drawRoad() {
    let html = `<line class="road-track" x1="${ROAD.left}" y1="${ROAD.y}" x2="${ROAD.right}" y2="${ROAD.y}"></line>`;
    for (let x = -20; x <= 20; x += 5) html += `<line class="road-tick" x1="${roadX(x)}" y1="${ROAD.y - 8}" x2="${roadX(x)}" y2="${ROAD.y + 8}"></line><text class="tick-label" x="${roadX(x)}" y="${ROAD.y + 29}">${x}</text>`;
    html += `<text class="axis-label" x="766" y="${ROAD.y + 8}">x / m</text><text class="svg-label" x="704" y="55">正方向 →</text>`;
    const context = displayContext();
    const cars = [];
    if (ui.safeSummary) { /* no untrusted answer geometry */ }
    else if (state.phase === "explore") cars.push({ label: "A", motion: state.exploration, draggable: true });
    else if (context.step === 0 || context.step === 3) cars.push({ label: "A", motion: answerMotion(context.step, context.answer), draggable: true });
    else if (context.step === 1) cars.push({ label: "A", motion: context.scenario, draggable: false });
    else if (context.step === 2) cars.push({ label: "A", motion: context.scenario.A, draggable: false }, { label: "B", motion: context.scenario.B, draggable: false });
    else if (context.step === 4) cars.push({ label: "A", motion: context.scenario.A, draggable: false }, { label: "B", motion: answerMotion(context.step, context.answer), draggable: true });
    html += cars.map((car, index) => carSvg(car, index)).join("");
    dom.roadLayer.innerHTML = html;
    dom.roadSvg.classList.toggle("is-locked", !settingsEditable());
  }
  function carSvg(car, index) {
    const position = S.positionAt(car.motion, ui.time);
    const x = roadX(clamp(position, -20, 20));
    const y = ROAD.y - 23 - index * 47;
    const canDrag = car.draggable && settingsEditable();
    const arrowLength = car.motion.v * 48;
    const endpoint = x + arrowLength;
    const arrow = canDrag || Number.isFinite(car.motion.v) ? `<line class="velocity-line" x1="${x}" y1="${y - 31}" x2="${endpoint}" y2="${y - 31}"></line><path d="M ${endpoint} ${y - 31} l ${arrowLength >= 0 ? -10 : 10} -7 l 0 14 z" fill="${car.label === "A" ? "var(--car-a)" : "var(--car-b)"}"></path><circle class="velocity-handle" cx="${endpoint}" cy="${y - 31}" r="9"></circle><circle class="drag-hit" data-drag="velocity:${car.label}" tabindex="${canDrag ? 0 : -1}" role="slider" aria-label="${car.label} 車速度 ${signed(car.motion.v)} 米每秒" aria-valuemin="-2" aria-valuemax="2" aria-valuenow="${car.motion.v}" cx="${endpoint}" cy="${y - 31}" r="23"></circle>` : "";
    return `<g class="car-${car.label.toLowerCase()}">${arrow}<g transform="translate(${x - 26} ${y - 15})"><rect class="car-body" x="0" y="0" width="52" height="25" rx="7"></rect><circle class="car-wheel" cx="12" cy="26" r="6"></circle><circle class="car-wheel" cx="40" cy="26" r="6"></circle><text class="svg-label" x="26" y="17" text-anchor="middle" font-weight="700">${car.label}${car.motion.incomplete ? " ?" : ""}</text><rect class="car-hit" data-drag="car:${car.label}" tabindex="${canDrag ? 0 : -1}" role="slider" aria-label="拖動 ${car.label} 車設定初始位置 ${signed(car.motion.x0)} 米" aria-valuemin="-8" aria-valuemax="8" aria-valuenow="${car.motion.x0}" x="-8" y="-12" width="68" height="58" rx="12"></rect></g></g>`;
  }

  function graphBase() {
    let html = "";
    for (let t = 0; t <= 6; t += 1) html += `<line class="plot-grid" x1="${graphX(t)}" y1="${GRAPH.top}" x2="${graphX(t)}" y2="${GRAPH.bottom}"></line><text class="tick-label" x="${graphX(t)}" y="${GRAPH.bottom + 22}">${t}</text>`;
    for (let x = -20; x <= 20; x += 5) html += `<line class="plot-grid" x1="${GRAPH.left}" y1="${graphY(x)}" x2="${GRAPH.right}" y2="${graphY(x)}"></line><text class="tick-label" x="${GRAPH.left - 28}" y="${graphY(x) + 5}">${x}</text>`;
    html += `<line class="plot-axis" x1="${GRAPH.left}" y1="${GRAPH.bottom}" x2="${GRAPH.right + 6}" y2="${GRAPH.bottom}"></line><line class="plot-axis" x1="${GRAPH.left}" y1="${GRAPH.bottom}" x2="${GRAPH.left}" y2="${GRAPH.top - 6}"></line><text class="axis-label" x="${GRAPH.right + 4}" y="${GRAPH.bottom + 21}">t / s</text><text class="axis-label" x="26" y="${GRAPH.top + 4}">x / m</text>`;
    return html;
  }
  function drawGraph() {
    let html = graphBase();
    const context = displayContext();
    const visibleReadings = [];
    if (ui.safeSummary) { /* axes only */ }
    else if (state.phase === "explore") {
      html += svgLine(state.exploration, "line-a", ui.time);
      html += currentDot(state.exploration, "line-a");
      html += probeSvg("E", ui.explorationProbes, state.exploration);
      visibleReadings.push(["探索圖線", S.positionAt(state.exploration, ui.time)]);
    } else if (context.step === 0) {
      html += svgLine(context.scenario, "target-line", 6);
      visibleReadings.push(["目標圖線", S.positionAt(context.scenario, ui.time)]);
      const own = answerMotion(0, context.answer);
      if (!own.incomplete) { html += svgLine(own, "student-line", ui.time); html += currentDot(own, "student-line"); visibleReadings.push(["學生圖線", S.positionAt(own, ui.time)]); }
    } else if (context.step === 1) {
      const answer = context.answer;
      if (Number.isFinite(answer.xStart) && Number.isFinite(answer.xEnd)) html += `<line class="motion-line student-line" x1="${graphX(0)}" y1="${graphY(answer.xStart)}" x2="${graphX(6)}" y2="${graphY(answer.xEnd)}"></line>`;
      html += graphHandle("xStart", 0, answer.xStart) + graphHandle("xEnd", 6, answer.xEnd);
      visibleReadings.push(["車的位置讀數", S.positionAt(context.scenario, ui.time)]);
    } else if (context.step === 2) {
      html += svgLine(context.scenario.A, "line-a", 6) + svgLine(context.scenario.B, "line-b", 6);
      html += probeSvg("A", context.answer.A.probes, context.scenario.A) + probeSvg("B", context.answer.B.probes, context.scenario.B) + fasterSvg(context.answer.faster);
      visibleReadings.push(["A 圖線", S.positionAt(context.scenario.A, ui.time)], ["B 圖線", S.positionAt(context.scenario.B, ui.time)]);
    } else if (context.step === 3) {
      const own = answerMotion(3, context.answer);
      if (!own.incomplete) { html += svgLine(own, "student-line", ui.time); html += currentDot(own, "student-line"); visibleReadings.push(["學生圖線", S.positionAt(own, ui.time)]); }
    } else if (context.step === 4) {
      html += svgLine(context.scenario.A, "line-a", ui.time);
      visibleReadings.push(["A 圖線", S.positionAt(context.scenario.A, ui.time)]);
      const own = answerMotion(4, context.answer);
      if (!own.incomplete) { html += svgLine(own, "line-b", ui.time); visibleReadings.push(["B 圖線", S.positionAt(own, ui.time)]); }
      html += `<line class="time-cursor" x1="${graphX(context.scenario.meetTime)}" y1="${GRAPH.top}" x2="${graphX(context.scenario.meetTime)}" y2="${GRAPH.bottom}"></line><text class="svg-label" x="${graphX(context.scenario.meetTime) + 6}" y="42">t*</text>`;
    }
    html += `<line class="time-cursor" x1="${graphX(ui.time)}" y1="${GRAPH.top}" x2="${graphX(ui.time)}" y2="${GRAPH.bottom}"></line>`;
    dom.graphLayer.innerHTML = html;
    dom.graphSummary.textContent = visibleReadings.length ? `讀圖游標 t = ${ui.time.toFixed(1)} s；${visibleReadings.map(([label, value]) => `${label} x = ${signed(value)} m`).join("；")}` : "橫軸時間 0 至 6 s；縱軸位置 −20 至 20 m。";
  }
  function currentDot(motion, className) {
    const color = className === "line-a" ? "var(--car-a)" : "var(--student-line)";
    return `<circle class="current-dot" cx="${graphX(ui.time)}" cy="${graphY(S.positionAt(motion, ui.time))}" r="7" stroke="${color}"></circle>`;
  }
  function graphHandle(name, time, value) {
    const position = value == null ? 0 : value;
    const label = time === 0 ? "P₀" : "P₆";
    return `<g><circle class="graph-handle" cx="${graphX(time)}" cy="${graphY(position)}" r="11"></circle><circle class="drag-hit" data-drag="graph:${name}" tabindex="${ui.locked ? -1 : 0}" role="slider" aria-label="${label} 位置 ${value == null ? "未設定" : signed(value)} 米" aria-valuemin="-20" aria-valuemax="20" aria-valuenow="${position}" cx="${graphX(time)}" cy="${graphY(position)}" r="25"></circle><text class="svg-label" x="${graphX(time) + (time === 0 ? 14 : -38)}" y="${graphY(position) - 15}">${label}${value == null ? " ?" : ""}</text></g>`;
  }
  function probeSvg(line, probes, motion) {
    return probes.map((time, index) => {
      const position = S.positionAt(motion, time);
      const label = index === 0 ? "P" : "Q";
      return `<g><line class="time-cursor" x1="${graphX(time)}" y1="${graphY(position)}" x2="${graphX(time)}" y2="${GRAPH.bottom}"></line><circle class="probe-handle" cx="${graphX(time)}" cy="${graphY(position)}" r="10"></circle><circle class="drag-hit" data-drag="probe:${line}:${index}" tabindex="${ui.locked ? -1 : 0}" role="slider" aria-label="${line === "E" ? "探索" : line + " 車"} ${label} 探針，時間 ${time.toFixed(1)} 秒，位置 ${signed(position)} 米" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${time}" cx="${graphX(time)}" cy="${graphY(position)}" r="23"></circle><text class="svg-label" x="${graphX(time) + 12}" y="${graphY(position) - 12}">${line === "E" ? "" : line}${label}</text></g>`;
    }).join("");
  }
  function fasterSvg(value) {
    const zones = [["A", 300, "A"], ["B", 430, "B"], ["same", 560, "一樣快"]];
    const selected = zones.find(([key]) => key === value);
    const tokenX = selected ? selected[1] : 170;
    return zones.map(([key, x, label]) => `<rect class="faster-zone ${value === key ? "is-selected" : ""}" x="${x - 52}" y="396" width="104" height="28" rx="7"></rect><text class="svg-label" x="${x}" y="415" text-anchor="middle">${label}</text>`).join("") + `<rect class="faster-token" data-drag="faster" tabindex="${ui.locked ? -1 : 0}" role="slider" aria-label="速度大小較大標記；目前 ${value || "未設定"}" x="${tokenX - 70}" y="354" width="140" height="28" rx="14"></rect><text class="svg-label" x="${tokenX}" y="373" text-anchor="middle" pointer-events="none">速度大小較大</text>`;
  }

  function renderData() {
    const context = displayContext();
    const values = [["時間", math("t", "s", ui.time)]];
    if (ui.safeSummary || state.phase === "final-review") { /* time only */ }
    else if (state.phase === "explore") values.push(["初始位置", math("x<sub>0</sub>", "m", state.exploration.x0)], ["目前位置", math("x", "m", S.positionAt(state.exploration, ui.time))], ["速度", math("v", "m/s", state.exploration.v)]);
    else if (context.step === 2) values.push(["A 車位置", math("x<sub>A</sub>", "m", S.positionAt(context.scenario.A, ui.time))], ["B 車位置", math("x<sub>B</sub>", "m", S.positionAt(context.scenario.B, ui.time))]);
    else if (context.step === 1) values.push(["車的位置", math("x", "m", S.positionAt(context.scenario, ui.time))]);
    else if (context.step === 4) {
      values.push(["A 車位置", math("x<sub>A</sub>", "m", S.positionAt(context.scenario.A, ui.time))]);
      const own = answerMotion(4, context.answer);
      values.push(["B 車位置", own.incomplete ? "--" : math("x<sub>B</sub>", "m", S.positionAt(own, ui.time))], ["指定相遇時間", math("t<sup>*</sup>", "s", context.scenario.meetTime)]);
    } else {
      const own = answerMotion(context.step, context.answer);
      values.push(["初始位置", own.incomplete && context.answer.x0 == null ? "--" : math("x<sub>0</sub>", "m", own.x0)], ["目前位置", own.incomplete ? "--" : math("x", "m", S.positionAt(own, ui.time))], ["速度", own.incomplete && context.answer.v == null ? "--" : math("v", "m/s", own.v)]);
    }
    dom.dataGrid.innerHTML = values.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");
  }

  function renderNavigation() {
    dom.navigationControls.replaceChildren();
    if (ui.technical || ui.safeSummary) return;
    if (state.phase === "explore") {
      dom.navigationControls.innerHTML = `<button id="startAssessment" type="button" class="primary-button">開始小功課</button>`;
      document.getElementById("startAssessment").addEventListener("click", () => dom.startDialog.showModal());
      return;
    }
    if (state.phase === "mission") {
      if (state.variant === "from-review") dom.navigationControls.innerHTML = `<button type="button" id="returnReview" class="primary-button">保存並返回檢視</button>`;
      else dom.navigationControls.innerHTML = `<button type="button" id="nextMission" class="primary-button">${state.currentStep === 4 ? "前往提交檢視" : "下一題／稍後再做"}</button>`;
      const button = document.getElementById(state.variant === "from-review" ? "returnReview" : "nextMission");
      button.addEventListener("click", () => {
        resetTime();
        state.variant === "from-review" ? P.returnToReview(state) : P.nextMission(state);
        saveDraft();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (state.phase === "final-review") {
      dom.navigationControls.innerHTML = `<button type="button" id="submitAttempt" class="primary-button">最後提交</button>`;
      document.getElementById("submitAttempt").addEventListener("click", () => dom.submitDialog.showModal());
      return;
    }
    if (state.phase === "submitted-review") {
      dom.navigationControls.innerHTML = `<button type="button" data-review-move="-1" ${ui.reviewStep === 0 ? "disabled" : ""}>上一題</button><button type="button" data-review-move="1" ${ui.reviewStep === 4 ? "disabled" : ""}>下一題</button>`;
      document.querySelectorAll("[data-review-move]").forEach((button) => button.addEventListener("click", () => { ui.reviewStep += Number(button.dataset.reviewMove); resetTime(); render(); }));
    }
  }

  function renderResult() {
    dom.resultSection.hidden = !ui.result && state.phase !== "final-review" && !ui.technical;
    if (ui.technical) {
      dom.resultSection.hidden = false;
      dom.resultPanel.className = "readout technical";
      dom.resultPanel.innerHTML = `<strong>技術狀態</strong><p>${escapeText(ui.technical)}</p><div id="technicalAction"></div>`;
      return;
    }
    dom.resultPanel.className = "readout";
    if (state.phase === "final-review") {
      dom.resultSection.hidden = false;
      dom.resultPanel.innerHTML = `<div class="review-list">${[0, 1, 2, 3, 4].map((step) => {
        const key = `m${step + 1}`;
        const status = S.completeness(key, state.assessment.ans[key]);
        const label = status === "complete" ? "已完整" : status === "partial" ? "部分作答" : "未作答";
        return `<div class="review-item"><h3>${step + 1}. ${MISSION_NAMES[step]}</h3><p>${label}</p><button type="button" data-edit-step="${step}">修改第 ${step + 1} 題</button></div>`;
      }).join("")}</div>`;
      document.querySelectorAll("[data-edit-step]").forEach((button) => button.addEventListener("click", () => { P.editMission(state, Number(button.dataset.editStep)); resetTime(); saveDraft(); render(); }));
      return;
    }
    if (!ui.result) return;
    dom.resultSection.hidden = false;
    const scoreLabel = ui.result.score == null ? "--" : `${ui.result.score} / 100`;
    const completion = ui.result.passed == null ? "未能安全判斷合格狀態" : ui.result.passed ? "已通過" : "未通過";
    const detail = ui.resultTrusted && ui.result.detail?.length ? ui.result.detail.map((item, index) => `<div class="feedback-card ${item.score === 20 ? "good" : "needs-work"}"><h3>任務 ${index + 1}：${item.score} / 20</h3>${item.components.map((part) => `<p><strong>${escapeText(part.name)}：${part.earned} / ${part.points}</strong> — ${escapeText(part.feedback)}</p>`).join("")}</div>`).join("") : `<p>無法安全驗證已儲存的逐題答案；只顯示 Moodle 可提供的摘要。</p>`;
    dom.resultPanel.innerHTML = `<div>分數</div><div class="score-value">${scoreLabel}</div><strong>${completion}</strong><div class="feedback-list">${detail}</div>`;
  }

  function saveDraft() {
    if (ui.locked || ui.technical || state.phase === "submitted-review") return false;
    const payload = P.encodeDraft(state);
    if (!payload) { showTechnical("目前草稿狀態無法安全保存。請重新開啟活動。"); return false; }
    try { return window.SimScorm.saveDraft(window.SimScorm.makeSnapshot(ACTIVITY, "draft", payload)); }
    catch { showTechnical("草稿超出儲存限制，活動已鎖定以免遺失答案。"); return false; }
  }
  function draftSnapshot() {
    const payload = P.encodeDraft(state);
    if (!payload) throw new Error("invalid draft state");
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", payload);
  }
  function showTechnical(message) {
    stopAnimation();
    ui.locked = true;
    ui.technical = message;
    ui.result = null;
    render();
  }

  function submitAttempt() {
    if (state.phase !== "final-review" || ui.locked) return;
    const set = currentSet();
    const result = S.scoreAssessment(state.assessment.ans, set);
    const reviewPayload = P.encodeReview(state);
    if (!reviewPayload) { showTechnical("答案未能建立安全的提交資料；沒有傳送分數。"); return; }
    let review;
    try { review = window.SimScorm.makeSnapshot(ACTIVITY, "review", reviewPayload, result); }
    catch { showTechnical("提交資料超出 Moodle 儲存限制；沒有傳送分數。"); return; }
    const handle = (outcome) => {
      P.lifecyclePolicy("submission", outcome);
      return window.SimActivityFlow.submission(outcome, {
      success: () => showSubmitted(reviewPayload, result, true, "本次作答已提交。"),
      committed: () => showSubmitted(reviewPayload, result, true, "成績已保存；Moodle session 會在離開頁面時再次完成。"),
      frozen: () => showFrozen("提交狀態未確認；答案已凍結，請使用重試按鈕傳送同一份答案。"),
      retry: (failure) => failure.retryable ? showRetry("未能傳送到 Moodle；答案仍可修改或再次提交。") : showTechnical("未能建立可重試的提交；沒有確認分數或合格狀態。")
      });
    };
    window.SimScorm.submitWithCallbacks(result, review, { onSuccess: handle, onFailure: handle });
  }
  function showSubmitted(reviewPayload, result, trusted, message) {
    const restored = P.decodeReview(reviewPayload);
    if (!restored) { showTechnical("已保存結果，但檢討資料無法安全載入。"); return; }
    state = restored;
    ui.locked = true;
    ui.technical = null;
    ui.result = result;
    ui.resultTrusted = trusted;
    ui.reviewStep = 0;
    resetTime();
    render();
    announce(message);
  }
  function showFrozen(message) {
    stopAnimation();
    ui.locked = true;
    ui.technical = message;
    ui.result = null;
    render();
    const host = document.getElementById("technicalAction");
    if (host) {
      host.innerHTML = `<button type="button" id="retryPending" class="primary-button">重試同一份提交</button>`;
      document.getElementById("retryPending").addEventListener("click", retryPending);
    }
  }
  function showRetry(message) {
    ui.locked = false;
    ui.technical = null;
    render();
    announce(message);
  }
  function retryPending() {
    const raw = window.SimScorm.retryPending();
    const outcome = { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
    window.SimActivityFlow.submission(outcome, {
      success: () => restorePendingReview(raw, "提交已完成。"),
      committed: () => restorePendingReview(raw, "成績已保存；完成 session 時會再試。"),
      frozen: () => showFrozen("提交仍未確認；答案保持凍結。"),
      retry: (failure) => failure.retryable ? showFrozen("暫時仍未能提交；請稍後重試同一份答案。") : showTechnical("未能安全重試提交。")
    });
  }
  function restorePendingReview(outcome, message) {
    const payload = outcome.review?.answer;
    const restored = P.decodeReview(payload);
    if (!restored) { showTechnical("Moodle 已保存摘要，但檢討資料無法安全載入。"); return; }
    const result = S.scoreAssessment(restored.assessment.ans, S.getScenarioSet(restored.assessment.lv, restored.assessment.sid));
    showSubmitted(payload, result, true, message);
  }

  function applyDrag(kind, point, persist) {
    const [type, line, rawIndex] = kind.split(":");
    if (type === "car" && settingsEditable()) {
      const value = clamp(snap(S.LIMITS.positionMin + (point.x - ROAD.left) / (ROAD.right - ROAD.left) * 40, 1), -8, 8);
      updateDirectMotion("x0", value);
    } else if (type === "velocity" && settingsEditable()) {
      const motion = directMotion();
      const value = clamp(snap((point.x - roadX(motion.x0)) / 48, 0.5), -2, 2);
      updateDirectMotion("v", value);
    } else if (type === "graph" && editable()) {
      const position = clamp(snap(S.LIMITS.positionMin + (GRAPH.bottom - point.y) / (GRAPH.bottom - GRAPH.top) * 40, 1), -20, 20);
      currentAnswer()[line] = position;
    } else if (type === "probe" && editable()) {
      const max = line === "E" ? ui.time : 6;
      const time = clamp(snap((point.x - GRAPH.left) / (GRAPH.right - GRAPH.left) * 6, 0.5), 0, max);
      probeList(line)[Number(rawIndex)] = time;
    } else if (type === "faster" && editable()) {
      currentAnswer().faster = point.x < 365 ? "A" : point.x < 495 ? "B" : "same";
    } else return;
    if (persist) saveDraft();
    render();
  }
  function directMotion() {
    if (state.phase === "explore") return state.exploration;
    const context = displayContext();
    return answerMotion(context.step, context.answer);
  }
  function updateDirectMotion(field, value) {
    if (state.phase === "explore") state.exploration[field] = value;
    else {
      const context = displayContext();
      const key = context.step === 4 ? field === "x0" ? "x0B" : "vB" : field;
      context.answer[key] = value;
    }
    resetTime(state.phase === "explore");
  }
  function pointerDown(event) {
    const target = event.target.closest("[data-drag]");
    if (!target || ui.locked || ui.technical) return;
    const type = target.dataset.drag.split(":")[0];
    if (["car", "velocity"].includes(type) && !settingsEditable()) return;
    if (!["car", "velocity"].includes(type) && !editable()) return;
    ui.drag = { kind: target.dataset.drag, svg: event.currentTarget, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function pointerMove(event) {
    if (!ui.drag || ui.drag.pointerId !== event.pointerId || ui.drag.svg !== event.currentTarget) return;
    applyDrag(ui.drag.kind, clientPoint(event.currentTarget, event), false);
    event.preventDefault();
  }
  function pointerUp(event) {
    if (!ui.drag || ui.drag.pointerId !== event.pointerId || ui.drag.svg !== event.currentTarget) return;
    const kind = ui.drag.kind;
    ui.drag = null;
    applyDrag(kind, clientPoint(event.currentTarget, event), true);
    announce("操作已保存。");
  }
  function dragKeydown(event) {
    const target = event.target.closest("[data-drag]");
    if (!target || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || ui.locked) return;
    const [type, line, rawIndex] = target.dataset.drag.split(":");
    const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
    const large = event.shiftKey ? 2 : 1;
    if (type === "car" && settingsEditable()) updateDirectMotion("x0", clamp(directMotion().x0 + direction * large, -8, 8));
    else if (type === "velocity" && settingsEditable()) updateDirectMotion("v", clamp(directMotion().v + direction * 0.5 * large, -2, 2));
    else if (type === "graph" && editable()) currentAnswer()[line] = clamp((currentAnswer()[line] ?? 0) + direction * large, -20, 20);
    else if (type === "probe" && editable()) {
      const max = line === "E" ? ui.time : 6;
      const index = Number(rawIndex);
      probeList(line)[index] = clamp(probeList(line)[index] + direction * 0.5 * large, 0, max);
    } else if (type === "faster" && editable()) {
      const values = ["A", "B", "same"];
      const index = Math.max(0, values.indexOf(currentAnswer().faster));
      currentAnswer().faster = values[clamp(index + direction, 0, 2)];
    } else return;
    event.preventDefault();
    saveDraft();
    render();
    announce("鍵盤操作已保存。");
  }

  function showFinished(attempt) {
    const payload = attempt.snapshot?.answer;
    const restored = P.decodeReview(payload);
    if (!restored) { showSafeFinished(attempt); return; }
    const computed = S.scoreAssessment(restored.assessment.ans, S.getScenarioSet(restored.assessment.lv, restored.assessment.sid));
    const trust = window.SimActivityFlow.reviewResult(computed, { score: attempt.snapshot.score, passed: attempt.snapshot.passed }, attempt);
    state = restored;
    ui.locked = true;
    ui.result = trust.result;
    ui.resultTrusted = trust.trusted;
    ui.reviewStep = 0;
    render();
  }
  function showSafeFinished(attempt) {
    const recorded = window.SimActivityFlow.recordedResult(attempt);
    ui.locked = true;
    ui.safeSummary = true;
    ui.result = { score: recorded.score, passed: recorded.passed, maxScore: 100, detail: [] };
    ui.resultTrusted = false;
    render();
  }
  function initialize() {
    if (!S.validateScenarioLibrary()) { showTechnical("題目情境驗證失敗；活動沒有開放作答。"); return; }
    const attempt = window.SimScorm.loadAttempt(ACTIVITY);
    const startup = window.SimActivityFlow.startup(attempt);
    const policy = P.lifecyclePolicy("startup", startup);
    if (policy.key === "review") showFinished(attempt);
    else if (policy.key === "editable") {
      if (attempt.state === "draft") {
        const restored = P.decodeDraft(attempt.snapshot?.answer);
        if (!restored) { showTechnical("已儲存的草稿無法安全載入；活動已鎖定，沒有覆寫原有資料。"); return; }
        state = restored;
      }
      window.SimScorm.setDraftProvider(draftSnapshot);
      render();
    } else if (policy.key === "frozen") showFrozen("上次提交仍未確認；答案保持凍結，只可重試同一份提交。");
    else showTechnical("無法安全讀取 Moodle 作答資料；沒有開放編輯或顯示未確認成績。");
  }

  [dom.roadSvg, dom.graphSvg].forEach((svg) => {
    svg.addEventListener("pointerdown", pointerDown);
    svg.addEventListener("pointermove", pointerMove);
    svg.addEventListener("pointerup", pointerUp);
    svg.addEventListener("pointercancel", () => { ui.drag = null; });
    svg.addEventListener("keydown", dragKeydown);
  });
  dom.playButton.addEventListener("click", play);
  dom.stepButton.addEventListener("click", () => setTime(ui.time + 0.5, true));
  dom.replayButton.addEventListener("click", () => { setTime(0, true); if (state.phase === "explore") ui.explorationProbes = []; render(); });
  dom.resetButton.addEventListener("click", () => { resetTime(state.phase === "explore"); render(); announce("已回到 t = 0；物理設定保持不變。"); });
  dom.timeSlider.addEventListener("input", () => setTime(Number(dom.timeSlider.value)));
  dom.timeSlider.addEventListener("change", () => announce(`讀圖游標：t = ${ui.time.toFixed(1)} 秒。${dom.graphSummary.textContent}`));
  dom.confirmStart.addEventListener("click", () => {
    const ids = S.scenarioIds();
    const setId = ids[Math.floor(Math.random() * ids.length)];
    P.startAssessment(state, setId);
    resetTime(true);
    saveDraft();
    render();
  });
  dom.confirmSubmit.addEventListener("click", submitAttempt);
  initialize();
})();
