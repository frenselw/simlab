(function () {
  "use strict";

  const ACTIVITY = "position-time-graph-motion-lab";
  const S = window.PositionTimeScoring;
  const G = window.PositionTimeGenerator;
  const P = window.PositionTimePersistence;
  const R = window.PositionTimeUiRuntime;
  const ROAD = { left: 70, right: 750, y: 108 };
  const GRAPH = { left: 80, right: 760, top: 60, bottom: 390, compactHeight: 440, comparisonHeight: 490 };
  const ROAD_MAGNIFIER = { width: 280, height: 120 };
  const GRAPH_MAGNIFIER = { width: 280, height: 180 };
  const MISSION_NAMES = ["根據目標圖設定運動", "根據運動畫出 x–t 圖", "量度兩車速度並比較", "建立特殊運動狀態", "兩車相遇挑戰"];
  const dom = Object.fromEntries(["modeDescription", "phaseBadge", "roadSvg", "roadDesc", "roadLayer", "roadTouchPreviewHost", "graphSvg", "graphLayer", "graphTouchPreviewHost", "graphSummary", "labUpperScroll", "labPanel", "taskSection", "taskKicker", "taskTitle", "answerState", "taskInstruction", "setupSection", "motionControls", "presetControls", "playButton", "stepButton", "replayButton", "timeSlider", "timeOutput", "answerSection", "answerControls", "probeSection", "probeControls", "dataGrid", "liveStatus", "navigationControls", "resultSection", "resultPanel", "startDialog", "confirmStart", "submitDialog", "confirmSubmit"].map((id) => [id, document.getElementById(id)]));

  let state = P.createExplore();
  const ui = { time: 0, playing: false, frame: 0, lastFrame: 0, explorationProbes: [], drag: null, locked: false, result: null, resultTrusted: false, technical: null, technicalAction: null, finishRetry: false, unsaved: false, safeSummary: false, reviewStep: 0 };

  function math(symbol, unit, value) {
    const shown = value == null || value === "" ? "--" : signed(value);
    return `<span class="math"><var>${symbol}</var></span> = ${shown}${unit ? ` <span class="unit">${unit}</span>` : ""}`;
  }
  function missionNameHtml(step) {
    return step === 1 ? `根據運動畫出 <span class="math"><var>x</var>–<var>t</var></span> 圖` : MISSION_NAMES[step];
  }
  function pointSymbolHtml(index) {
    return `<span class="math"><var>x</var><sub class="numeric-subscript">${index}</sub></span>`;
  }
  function probeName(_line, index) {
    return index === 0 ? "P" : "Q";
  }
  function probeNameHtml(line, index) {
    return `<span>${probeName(line, index)}</span>`;
  }
  function probeValueHtml(time, position) {
    return `(${math("t", "s", time)}, ${math("x", "m", position)})`;
  }
  function probePromptHtml() {
    return `加入 P、Q 兩個探針以顯示 <span class="math">Δ<var>t</var></span> 及 <span class="math">Δ<var>x</var></span>。`;
  }
  function svgPointSymbol(index) {
    return `<tspan class="svg-math-symbol">x</tspan><tspan class="svg-numeric-subscript" baseline-shift="sub">${index}</tspan>`;
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
  function graphRenderedWidth() {
    const scale = Math.abs(Number(dom.graphSvg.getScreenCTM?.()?.a));
    return scale > 0 ? scale * 800 : dom.graphSvg.clientWidth;
  }
  function roadRenderedWidth() {
    const scale = Math.abs(Number(dom.roadSvg.getScreenCTM?.()?.a));
    return scale > 0 ? scale * 800 : dom.roadSvg.clientWidth;
  }
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
  function currentSet() { return state.assessment ? P.scenariosForDisplay(state.assessment) : null; }
  function missionKey() { return `m${state.currentStep + 1}`; }
  function currentAnswer() { return state.assessment?.ans[missionKey()]; }
  function editable() { return !ui.locked && !ui.technical && (state.phase === "explore" || state.phase === "mission"); }
  function settingsEditable() { return editable() && !ui.playing && ui.time === 0; }
  function playbackDisabled() { return Boolean(ui.technical || ui.safeSummary || state.phase === "final-review" || (ui.locked && state.phase !== "submitted-review")); }
  function interactionContext() {
    return { phase: state.phase, step: state.currentStep, locked: ui.locked, technical: Boolean(ui.technical), playing: ui.playing, time: ui.time };
  }

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
    if (playbackDisabled()) return;
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
    if (playbackDisabled()) return;
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
    const focusKey = R.focusKey(document.activeElement);
    renderHeader();
    renderTask();
    renderControls();
    renderDynamic();
    renderTouchPreviews();
    renderNavigation();
    renderResult();
    R.restoreFocus(document, focusKey);
  }
  function renderDynamic() {
    const disablePlayback = playbackDisabled();
    dom.timeSlider.value = String(ui.time);
    dom.timeOutput.innerHTML = math("t", "s", ui.time);
    dom.playButton.textContent = ui.playing ? "暫停" : "播放";
    dom.playButton.disabled = disablePlayback;
    dom.stepButton.disabled = disablePlayback || ui.playing || ui.time >= 6;
    dom.replayButton.disabled = disablePlayback;
    dom.timeSlider.disabled = disablePlayback;
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
      dom.modeDescription.textContent = "自由設定起點與速度，觀察、回到 0 s 及量度位置—時間圖。";
    } else if (state.phase === "submitted-review") {
      dom.phaseBadge.textContent = "只讀檢討";
      dom.modeDescription.textContent = "本次作答已鎖定；你仍可回到 0 s 及移動時間游標。";
    } else {
      dom.phaseBadge.textContent = state.phase === "final-review" ? "提交前檢視" : `任務 ${state.currentStep + 1} / 5`;
      dom.modeDescription.textContent = "五個任務合共 100 分，提交前可回看及修改答案。";
    }
    if (ui.unsaved && !ui.technical) dom.phaseBadge.textContent += " · 未儲存";
  }
  function renderTask() {
    dom.answerState.hidden = true;
    dom.taskSection.dataset.mode = "guide";
    dom.taskKicker.textContent = "活動指引";
    if (ui.technical) {
      dom.taskKicker.textContent = "技術提示";
      dom.taskTitle.textContent = "暫時無法載入活動";
      dom.taskInstruction.textContent = ui.technical;
      return;
    }
    if (ui.safeSummary) {
      dom.taskKicker.textContent = "只讀摘要";
      dom.taskTitle.textContent = "Moodle 作答摘要";
      dom.taskInstruction.textContent = "逐題檢討資料無法安全載入，因此只顯示 Moodle 記錄的分數及狀態。";
      return;
    }
    if (state.phase === "explore") {
      dom.taskTitle.textContent = "自由探索";
      dom.taskInstruction.textContent = "設定運動，播放並觀察圖線。探索不計分，亦沒有完成門檻。";
      if (ui.unsaved) {
        dom.answerState.hidden = false;
        dom.answerState.dataset.state = "unsaved";
        dom.answerState.textContent = "未儲存（技術問題）";
      }
      return;
    }
    if (state.phase === "final-review") {
      dom.taskKicker.textContent = "五題完成狀態";
      dom.taskTitle.textContent = "提交前檢視";
      dom.taskInstruction.textContent = "檢查每題是否完整；此處只顯示完成狀態，不會透露對錯。";
      if (ui.unsaved) {
        dom.answerState.hidden = false;
        dom.answerState.dataset.state = "unsaved";
        dom.answerState.textContent = "未儲存（技術問題）";
      }
      return;
    }
    const step = state.phase === "submitted-review" ? ui.reviewStep : state.currentStep;
    const reviewing = state.phase === "submitted-review";
    dom.taskSection.dataset.mode = "mission";
    dom.taskKicker.textContent = `${reviewing ? "檢討任務" : "今題任務"} · ${step + 1} / 5`;
    if (step === 1) dom.taskTitle.innerHTML = missionNameHtml(step);
    else dom.taskTitle.textContent = MISSION_NAMES[step];
    const scenario = currentSet()[`m${step + 1}`];
    dom.taskInstruction.innerHTML = instructionFor(step, scenario) + (reviewing ? reviewConditionHtml(step, scenario) : "");
    const key = `m${step + 1}`;
    const complete = S.completeness(key, state.assessment.ans[key]);
    dom.answerState.hidden = false;
    dom.answerState.dataset.state = ui.unsaved ? "unsaved" : complete;
    dom.answerState.textContent = ui.unsaved ? "未儲存（技術問題）" : complete === "complete" ? "已完整" : complete === "partial" ? "部分作答" : "未作答";
  }
  function instructionFor(step, scenario) {
    if (step === 0) return "拖車設定初始位置，再拖速度箭嘴設定速度，令學生圖線符合紫色虛線。";
    if (step === 1) return "播放並觀察車的位置讀數；設定 <span class=\"math\"><var>x</var><sub class=\"numeric-subscript\">0</sub></span>、<span class=\"math\"><var>x</var><sub class=\"numeric-subscript\">6</sub></span> 畫出直線。";
    if (step === 2) return "分別在 A、B 圖線放置相隔最少 2.0 s 的探針，計算兩車帶符號速度，再比較速度大小。";
    if (step === 3) return scenario.v === 0 ? `建立一架在 <span class="math"><var>t</var></span> = 0.0 <span class="unit">s</span> 至 6.0 <span class="unit">s</span> 都停在 <span class="math"><var>x</var></span> = ${signed(scenario.x0)} <span class="unit">m</span> 的車。` : `建立運動：<span class="math"><var>t</var></span> = 0.0 <span class="unit">s</span> 時 <span class="math"><var>x</var></span> = ${signed(scenario.x0)} <span class="unit">m</span>；<span class="math"><var>t</var></span> = ${scenario.atTime.toFixed(1)} <span class="unit">s</span> 時 <span class="math"><var>x</var></span> = ${signed(scenario.atPosition)} <span class="unit">m</span>。`;
    return `A 車已固定。設定 B 車，令兩車在 <span class="math"><var>t</var></span> = ${scenario.meetTime.toFixed(1)} <span class="unit">s</span> 相遇，再輸入相遇位置 <span class="math"><var>x</var></span>。`;
  }
  function reviewConditionHtml(step, scenario) {
    if (step === 0 || step === 3) return `<span class="review-condition">正確條件：<span class="math"><var>x</var><sub class="numeric-subscript">0</sub></span> = ${signed(scenario.x0)} <span class="unit">m</span>，<span class="math"><var>v</var></span> = ${signed(scenario.v)} <span class="unit">m/s</span>。</span>`;
    if (step === 1) return `<span class="review-condition">正確位置：${pointSymbolHtml(0)} = ${signed(scenario.x0)} <span class="unit">m</span>，${pointSymbolHtml(6)} = ${signed(S.positionAt(scenario, 6))} <span class="unit">m</span>。</span>`;
    if (step === 2) {
      const faster = Math.abs(scenario.A.v) === Math.abs(scenario.B.v) ? "兩車一樣快" : Math.abs(scenario.A.v) > Math.abs(scenario.B.v) ? "A 車較快" : "B 車較快";
      return `<span class="review-condition">正確量度：<span class="math"><var>v</var><sub>A</sub></span> = ${signed(scenario.A.v)} <span class="unit">m/s</span>，<span class="math"><var>v</var><sub>B</sub></span> = ${signed(scenario.B.v)} <span class="unit">m/s</span>；${faster}。</span>`;
    }
    const meetingX = S.positionAt(scenario.A, scenario.meetTime);
    return `<span class="review-condition">接受任何不與 A 全程重合、並在 <span class="math"><var>t</var></span> = ${scenario.meetTime.toFixed(1)} <span class="unit">s</span> 到達 <span class="math"><var>x</var></span> = ${signed(meetingX)} <span class="unit">m</span> 的 B 車設定。</span>`;
  }

  function renderControls() {
    const step = state.phase === "submitted-review" ? ui.reviewStep : state.phase === "mission" ? state.currentStep : null;
    dom.setupSection.hidden = ui.technical || ui.safeSummary || state.phase === "final-review" || step === 1 || step === 2;
    dom.answerSection.hidden = true;
    dom.probeSection.hidden = true;
    dom.motionControls.replaceChildren();
    dom.presetControls.replaceChildren();
    dom.answerControls.replaceChildren();
    dom.probeControls.replaceChildren();
    if (ui.technical || ui.safeSummary || state.phase === "final-review") return;
    if (state.phase === "explore") {
      dom.motionControls.innerHTML = motionControlHtml(state.exploration.x0, state.exploration.v, false);
      dom.presetControls.innerHTML = [
        ["靜止", 0, 0], ["慢速向右", -6, 1], ["快速向右", -6, 2], ["慢速向左", 6, -1], ["快速向左", 6, -2], ["非零位置出發", 4, 1.5]
      ].map(([label, x0, v]) => `<button type="button" data-preset="${x0},${v}" data-focus-key="preset:${x0}:${v}" ${settingsEditable() ? "" : "disabled"}>${label}</button>`).join("");
      renderProbeControls("explore");
    } else if (step === 0 || step === 3 || step === 4) {
      const answer = state.assessment.ans[`m${step + 1}`];
      const values = step === 4 ? { x0: answer.x0B, v: answer.vB } : answer;
      dom.motionControls.innerHTML = motionControlHtml(values.x0, values.v, ui.locked);
      if (step === 4) {
        dom.answerSection.hidden = false;
        dom.answerControls.innerHTML = numberInputHtml("meetingX", "相遇位置", "x", "m", answer.meetingX, -20, 20, 0.5);
      }
    } else if (step === 1) {
      dom.answerSection.hidden = false;
      const answer = state.assessment.ans.m2;
      dom.answerControls.innerHTML = `${graphPointControl("xStart", 0, answer.xStart)}${graphPointControl("xEnd", 6, answer.xEnd)}`;
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
    return quantityControl("x0", "初始位置", "x<sub class=\"numeric-subscript\">0</sub>", "m", x0, -8, 8, 1, disabled) + quantityControl("velocity", "速度", "v", "m/s", velocity, -2, 2, 0.5, disabled);
  }
  function quantityControl(name, label, symbol, unit, value, min, max, step, disabled, ariaLabel = label) {
    const fallback = value == null ? 0 : value;
    const middleControl = value == null && !disabled
      ? `<button type="button" class="set-zero" data-set-quantity="${name}" data-value="0" data-focus-key="set:${name}:zero" aria-label="將${escapeText(ariaLabel)}設定為零">設定為 0 <span class="unit">${unit}</span></button>`
      : `<span id="${name}StepperValue" class="math-readout">${value == null ? "--" : `${signed(value)} <span class="unit">${unit}</span>`}</span>`;
    return `<div class="quantity-control">
      <div class="value-heading"><label for="${name}Range">${label} <span class="math"><var>${symbol}</var></span></label><output id="${name}Value">${value == null ? "未設定" : `${signed(value)} <span class="unit">${unit}</span>`}</output></div>
      <input id="${name}Range" data-quantity="${name}" data-focus-key="quantity:${name}" type="range" min="${min}" max="${max}" step="${step}" value="${fallback}" ${disabled ? "disabled" : ""} aria-label="${escapeText(ariaLabel)}">
      <div class="stepper"><button type="button" data-step-quantity="${name}" data-delta="-${step}" data-focus-key="step:${name}:minus" ${disabled ? "disabled" : ""} aria-label="減少${escapeText(ariaLabel)}">−</button>${middleControl}<button type="button" data-step-quantity="${name}" data-delta="${step}" data-focus-key="step:${name}:plus" ${disabled ? "disabled" : ""} aria-label="增加${escapeText(ariaLabel)}">＋</button></div>
    </div>`;
  }
  function graphPointControl(name, time, value) {
    const spokenIndex = time === 0 ? "零" : "六";
    const label = `<span class="math"><var>t</var></span> = ${time.toFixed(1)} <span class="unit">s</span> 時的位置`;
    return quantityControl(name, label, `x<sub class="numeric-subscript">${time}</sub>`, "m", value, -20, 20, 1, ui.locked, `x ${spokenIndex}，時間${spokenIndex}秒的位置`);
  }
  function numberInputHtml(name, label, symbol, unit, value, min, max, step) {
    return `<label class="quantity-control" for="${name}Input"><span>${label} <span class="math"><var>${symbol}</var></span></span><span class="number-with-unit"><input id="${name}Input" data-number-answer="${name}" data-focus-key="number:${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${value == null ? "" : value}" ${ui.locked ? "disabled" : ""}><span class="unit">${unit}</span></span></label>`;
  }
  function fasterControl(value) {
    return `<fieldset><legend>速度大小較大</legend><div class="choice-grid">${[["A", "A 車"], ["B", "B 車"], ["same", "一樣快"]].map(([key, label]) => `<button type="button" data-faster="${key}" data-focus-key="faster:${key}" aria-pressed="${value === key}" ${ui.locked ? "disabled" : ""}>${label}</button>`).join("")}</div><p class="sr-note">亦可拖動圖內「速度大小較大」標記到 A、B 或一樣快區域。</p></fieldset>`;
  }
  function assessmentProbeButtonText(label, count) {
    if (count >= 2) return `${label} 車探針已齊`;
    return `加入 ${label} 車第${count === 0 ? "一" : "二"}個探針`;
  }
  function explorationProbeButtonText(count) {
    if (count >= 2) return "探針已齊";
    return `加入第${count === 0 ? "一" : "二"}個探針`;
  }
  function renderProbeControls(mode) {
    dom.probeSection.hidden = false;
    if (mode === "explore") {
      const motion = state.exploration;
      dom.probeControls.innerHTML = probeCard("探索圖線", ui.explorationProbes, motion, "E", ui.time) + `<div class="button-row probe-actions"><button type="button" data-add-probe="E" data-focus-key="probe-add:E" ${ui.time <= 0 || ui.explorationProbes.length >= 2 ? "disabled" : ""}>${explorationProbeButtonText(ui.explorationProbes.length)}</button><button type="button" data-clear-probe="E" data-focus-key="probe-clear:E" ${ui.explorationProbes.length ? "" : "disabled"}>清除探針</button></div>`;
    } else {
      const answer = state.assessment.ans.m3;
      const scenario = currentSet().m3;
      dom.probeControls.innerHTML = ["A", "B"].map((label) => `<div class="probe-card">${probeCard(`${label} 車圖線`, answer[label].probes, scenario[label], label, 6)}<div class="button-row probe-actions"><button type="button" data-add-probe="${label}" data-focus-key="probe-add:${label}" ${ui.locked || answer[label].probes.length >= 2 ? "disabled" : ""}>${assessmentProbeButtonText(label, answer[label].probes.length)}</button><button type="button" data-clear-probe="${label}" data-focus-key="probe-clear:${label}" ${ui.locked || !answer[label].probes.length ? "disabled" : ""}>清除</button></div></div>`).join("");
    }
  }
  function probeCard(label, probes, motion, line, maxTime) {
    const rows = probes.map((time, index) => {
      const pointLabel = probeName(line, index);
      return `<label class="range-row"><span>${probeNameHtml(line, index)}</span><input type="range" min="0" max="${maxTime}" step="0.5" value="${time}" data-probe-line="${line}" data-probe-index="${index}" data-focus-key="probe-range:${line}:${index}" ${ui.locked ? "disabled" : ""} aria-label="${label} ${pointLabel} 探針時間"><output id="probeValue-${line}-${index}">${probeValueHtml(time, S.positionAt(motion, time))}</output></label>`;
    }).join("");
    const delta = probes.length === 2 ? measurementHtml(probes, motion) : probePromptHtml(line);
    return `<div class="probe-heading"><strong>${label}</strong><span>${probes.length}/2</span></div>${rows}<div id="probeDelta-${line}" class="muted">${delta}</div>`;
  }
  function measurementHtml(probes, motion) {
    const dt = probes[1] - probes[0];
    const dx = S.positionAt(motion, probes[1]) - S.positionAt(motion, probes[0]);
    if (Math.abs(dt) < 1e-12) return "兩個探針時間相同，未能計算速度。";
    return `<span class="math">Δ<var>t</var></span> = ${signed(dt)} <span class="unit">s</span>；<span class="math">Δ<var>x</var></span> = ${signed(dx)} <span class="unit">m</span>${state.phase === "explore" ? `；<span class="math"><var>v</var> = Δ<var>x</var>/Δ<var>t</var></span> = ${signed(dx / dt)} <span class="unit">m/s</span>` : ""}`;
  }

  function bindControlEvents() {
    document.querySelectorAll("[data-quantity]").forEach((input) => input.addEventListener("input", () => updateQuantity(input.dataset.quantity, Number(input.value), false)));
    document.querySelectorAll("[data-quantity]").forEach((input) => input.addEventListener("change", () => saveAndAnnounce("運動設定已更新並儲存。")));
    document.querySelectorAll("[data-step-quantity]").forEach((button) => button.addEventListener("click", () => stepQuantity(button.dataset.stepQuantity, Number(button.dataset.delta))));
    document.querySelectorAll("[data-set-quantity]").forEach((button) => button.addEventListener("click", () => confirmQuantity(button.dataset.setQuantity, Number(button.dataset.value))));
    document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
      const [x0, v] = button.dataset.preset.split(",").map(Number);
      state.exploration = { x0, v };
      resetTime(true);
      const saved = saveDraft();
      render();
      announce(saved ? "快捷情境已載入並儲存；你仍可修改數值。" : "快捷情境已載入，但草稿未能儲存；請重試。");
    }));
    document.querySelectorAll("[data-number-answer]").forEach((input) => input.addEventListener("input", () => {
      if (syncNumberAnswer(input.dataset.numberAnswer, input.value)) ui.unsaved = true;
    }));
    document.querySelectorAll("[data-number-answer]").forEach((input) => input.addEventListener("change", () => updateNumberAnswer(input.dataset.numberAnswer, input.value)));
    document.querySelectorAll("[data-faster]").forEach((button) => button.addEventListener("click", () => { currentAnswer().faster = button.dataset.faster; const saved = saveDraft(); render(); announce(saved ? "速度大小比較標記已儲存。" : "比較標記未能儲存；請重試。" ); }));
    document.querySelectorAll("[data-add-probe]").forEach((button) => button.addEventListener("click", () => addProbe(button.dataset.addProbe)));
    document.querySelectorAll("[data-clear-probe]").forEach((button) => button.addEventListener("click", () => clearProbes(button.dataset.clearProbe)));
    document.querySelectorAll("[data-probe-line]").forEach((input) => input.addEventListener("input", () => updateProbe(input.dataset.probeLine, Number(input.dataset.probeIndex), Number(input.value), false)));
    document.querySelectorAll("[data-probe-line]").forEach((input) => input.addEventListener("change", () => saveAndAnnounce("探針位置已儲存。")));
  }
  function stepQuantity(name, delta) {
    const current = quantityValue(name);
    const bounds = name === "xStart" || name === "xEnd" ? [-20, 20] : name === "velocity" ? [-2, 2] : [-8, 8];
    updateQuantity(name, clamp((current == null ? 0 : current) + delta, bounds[0], bounds[1]), true);
  }
  function confirmQuantity(name, value) {
    updateQuantity(name, value, true);
    R.restoreFocus(document, `focus:quantity:${name}`);
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
    ui.unsaved = true;
    if (persist) {
      saveAndAnnounce("數值已儲存。", false);
      render();
      return;
    }
    const unit = name === "velocity" ? "m/s" : "m";
    const valueHtml = `${signed(value)} <span class="unit">${unit}</span>`;
    const headingValue = document.getElementById(`${name}Value`);
    const stepperValue = document.getElementById(`${name}StepperValue`);
    if (headingValue) headingValue.innerHTML = valueHtml;
    if (stepperValue) stepperValue.innerHTML = valueHtml;
    renderDynamic();
  }
  function updateNumberAnswer(name, raw) {
    if (!syncNumberAnswer(name, raw)) {
      render();
      announce("請輸入操作範圍內的有限數值；原有答案未有更改。");
      return;
    }
    const saved = saveDraft();
    render();
    announce(saved ? "數值答案已儲存。" : "數值答案未能儲存；請重試。" );
  }
  function syncNumberAnswer(name, raw) {
    const answer = currentAnswer();
    if (!answer) return false;
    const value = raw.trim() === "" ? null : Number(raw);
    if (name === "meetingX") return setOptional(answer, "meetingX", value, -20, 20);
    const [line] = name.split("-");
    return Boolean(answer[line]) && setOptional(answer[line], "velocity", value, -2, 2);
  }
  function syncVisibleNumberInputsToState() {
    document.querySelectorAll("[data-number-answer]").forEach((input) => syncNumberAnswer(input.dataset.numberAnswer, input.value));
  }
  function setOptional(target, key, value, min, max) {
    return R.setOptional(target, key, value, min, max);
  }
  function probeList(line) { return line === "E" ? ui.explorationProbes : state.assessment.ans.m3[line].probes; }
  function addProbe(line) {
    const list = probeList(line);
    if (list.length >= 2) return;
    const maxTime = line === "E" ? ui.time : 6;
    list.push(list.length ? Math.min(maxTime, list[0] + 2) : 0);
    const saved = saveDraft();
    render();
    if (line === "E") announce(`${probeName(line, list.length - 1)}探針已加入；只保留於目前探索頁面。`);
    else announce(saved ? `${probeName(line, list.length - 1)}探針已加入並儲存。` : "探針已加入，但未能儲存；請重試。" );
  }
  function clearProbes(line) {
    if (line === "E") ui.explorationProbes = [];
    else state.assessment.ans.m3[line].probes = [];
    const saved = saveDraft();
    render();
    if (line === "E") announce("探索探針已清除；探針本來只保留於目前頁面。");
    else announce(saved ? "探針已清除並儲存。" : "探針已清除，但未能儲存；請重試。" );
  }
  function updateProbe(line, index, time, persist) {
    probeList(line)[index] = snap(time, 0.5);
    ui.unsaved = true;
    if (persist) {
      saveAndAnnounce("探針位置已儲存。", false);
      render();
      return;
    }
    const probes = probeList(line);
    const motion = line === "E" ? state.exploration : currentSet().m3[line];
    const probeValue = document.getElementById(`probeValue-${line}-${index}`);
    const probeDelta = document.getElementById(`probeDelta-${line}`);
    if (probeValue) probeValue.innerHTML = probeValueHtml(probes[index], S.positionAt(motion, probes[index]));
    if (probeDelta) probeDelta.innerHTML = probes.length === 2 ? measurementHtml(probes, motion) : probePromptHtml(line);
    renderDynamic();
  }

  function saveAndAnnounce(success, shouldRender = true) {
    const saved = saveDraft();
    if (shouldRender) render();
    announce(saved ? success : "草稿未能儲存；目前答案只保留在此頁，請重試後才前往下一步。");
    return saved;
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
    dom.roadSvg.classList.toggle("is-narrow", dom.roadSvg.clientWidth > 0 && dom.roadSvg.clientWidth <= 420);
    let html = `<line class="road-track" x1="${ROAD.left}" y1="${ROAD.y}" x2="${ROAD.right}" y2="${ROAD.y}"></line>`;
    for (let x = -20; x <= 20; x += 5) html += `<line class="road-tick" x1="${roadX(x)}" y1="${ROAD.y - 8}" x2="${roadX(x)}" y2="${ROAD.y + 8}"></line><text class="tick-label" x="${roadX(x)}" y="${ROAD.y + 29}">${x}</text>`;
    html += `<text class="axis-label" x="742" y="${ROAD.y - 16}" text-anchor="end">x / m</text><text class="svg-label" x="704" y="55">正方向 →</text>`;
    const context = displayContext();
    const cars = [];
    if (ui.safeSummary) { /* no untrusted answer geometry */ }
    else if (state.phase === "explore") cars.push({ label: "A", motion: state.exploration, draggable: true });
    else if (context.step === 0 || context.step === 3) cars.push({ label: "A", motion: answerMotion(context.step, context.answer), draggable: true });
    else if (context.step === 1) cars.push({ label: "A", motion: context.scenario, draggable: false, showPositionGuide: true });
    else if (context.step === 2) cars.push({ label: "A", motion: context.scenario.A, draggable: false }, { label: "B", motion: context.scenario.B, draggable: false });
    else if (context.step === 4) cars.push({ label: "A", motion: context.scenario.A, draggable: false }, { label: "B", motion: answerMotion(context.step, context.answer), draggable: true });
    const requiredPositionGuide = context.step === 3 ? targetPositionGuideSvg(context.scenario) : "";
    dom.roadDesc.textContent = (cars.some((car) => car.draggable && settingsEditable())
      ? "位置由負二十米至正二十米。可拖動車輛設定初始位置，並拖動速度箭嘴調整方向和大小。"
      : "位置由負二十米至正二十米。圖中的車輛運動只供觀察。") + (requiredPositionGuide ? " 紫色垂直虛線標示指定時刻要到達的位置。" : "");
    html += requiredPositionGuide + cars.map((car, index) => carSvg(car, index, cars.length)).join("");
    dom.roadLayer.innerHTML = html;
    dom.roadSvg.classList.toggle("is-locked", !settingsEditable());
  }
  function targetPositionGuideSvg(scenario) {
    const x = roadX(clamp(scenario.atPosition, -20, 20));
    const anchor = x > ROAD.right - 160 ? "end" : "start";
    const labelX = x + (anchor === "end" ? -9 : 9);
    return `<g class="target-position-guide"><line class="position-guide" x1="${x}" y1="22" x2="${x}" y2="${ROAD.y}"></line><text class="position-guide-label" x="${labelX}" y="22" text-anchor="${anchor}"><tspan class="svg-math-symbol">t</tspan> = ${scenario.atTime.toFixed(1)} <tspan class="svg-unit">s</tspan>：<tspan class="svg-math-symbol">x</tspan> = ${signed(scenario.atPosition)} <tspan class="svg-unit">m</tspan></text></g>`;
  }
  function carSvg(car, index, carCount) {
    const position = S.positionAt(car.motion, ui.time);
    const x = roadX(clamp(position, -20, 20));
    const carTop = carCount > 1 ? (index === 0 ? 76 : 29) : 70;
    const y = carTop + 15;
    const canDrag = car.draggable && settingsEditable();
    const arrowLength = car.motion.v * 48;
    const endpoint = x + arrowLength;
    const arrowY = carCount > 1 ? (index === 0 ? 66 : 24) : 54;
    const direction = Math.sign(arrowLength);
    const arrowHeadBase = endpoint - direction * 14;
    const magnitudeLabelX = endpoint + (direction < 0 ? -14 : 14);
    const magnitudeLabelY = carCount > 1 ? (index === 0 ? 72 : 22) : 60;
    const magnitudeAnchor = direction < 0 ? "end" : "start";
    const magnitudeText = car.motion.incomplete ? "|v|=? m/s" : `|v|=${Math.abs(car.motion.v).toFixed(1)} m/s`;
    const magnitudeLabel = `<text class="velocity-magnitude-label${direction === 0 ? " velocity-zero-label" : ""} svg-label" x="${magnitudeLabelX}" y="${magnitudeLabelY}" text-anchor="${magnitudeAnchor}">${magnitudeText}</text>`;
    const velocityVisual = direction === 0
      ? `<circle class="velocity-zero-marker" cx="${x}" cy="${arrowY}" r="6"></circle>${magnitudeLabel}`
      : `<line class="velocity-line" x1="${x}" y1="${arrowY}" x2="${endpoint}" y2="${arrowY}"></line><path class="velocity-arrowhead" d="M ${endpoint} ${arrowY} L ${arrowHeadBase} ${arrowY - 9} L ${arrowHeadBase} ${arrowY + 9} Z"></path>${magnitudeLabel}`;
    const hitRadius = R.hitRadius(800, roadRenderedWidth(), 26, 52);
    const velocityHit = canDrag ? `<circle class="road-drag-hit velocity-hit" data-drag="velocity:${car.label}" data-focus-x="${endpoint}" data-focus-y="${arrowY}" tabindex="0" role="slider" aria-label="調整 ${car.label} 車速度；目前 ${signed(car.motion.v)} 米每秒" aria-valuemin="-2" aria-valuemax="2" aria-valuenow="${car.motion.v}" cx="${endpoint}" cy="${arrowY}" r="${hitRadius}"></circle>` : "";
    const arrow = car.motion.incomplete && !canDrag ? "" : velocityVisual;
    const guideAnchor = x > ROAD.right - 110 ? "end" : "start";
    const guideLabelX = x + (guideAnchor === "end" ? -9 : 9);
    const positionGuide = car.showPositionGuide ? `<line class="position-guide" x1="${x}" y1="22" x2="${x}" y2="${ROAD.y}"></line><text class="position-guide-label" x="${guideLabelX}" y="22" text-anchor="${guideAnchor}"><tspan class="svg-math-symbol">x</tspan> = ${signed(position)} <tspan class="svg-unit">m</tspan></text>` : "";
    const carHit = canDrag ? `<circle class="road-drag-hit car-hit" data-drag="car:${car.label}" data-focus-x="${x}" data-focus-y="${y}" tabindex="0" role="slider" aria-label="拖動 ${car.label} 車設定初始位置；目前 ${signed(car.motion.x0)} 米" aria-valuemin="-8" aria-valuemax="8" aria-valuenow="${car.motion.x0}" cx="${x}" cy="${y}" r="${hitRadius}"></circle>` : "";
    const selectedCar = ui.drag?.kind === `car:${car.label}` ? " is-dragging-car" : "";
    const selectedVelocity = ui.drag?.kind === `velocity:${car.label}` ? " is-dragging-velocity" : "";
    return `<g class="car-${car.label.toLowerCase()}${selectedCar}${selectedVelocity}" data-road-car="${car.label}">${positionGuide}<g transform="translate(${x - 26} ${carTop})"><rect class="car-body" x="0" y="0" width="52" height="25" rx="7"></rect><circle class="car-wheel" cx="12" cy="26" r="6"></circle><circle class="car-wheel" cx="40" cy="26" r="6"></circle><text class="svg-label" x="26" y="17" text-anchor="middle" font-weight="700">${car.label}${car.motion.incomplete ? " ?" : ""}</text></g><g class="velocity-visual">${arrow}</g>${carHit}${velocityHit}</g>`;
  }

  function graphBase() {
    let html = "";
    for (let t = 0; t <= 6; t += 1) html += `<line class="plot-grid" x1="${graphX(t)}" y1="${GRAPH.top}" x2="${graphX(t)}" y2="${GRAPH.bottom}"></line><text class="tick-label horizontal-tick" x="${graphX(t)}" y="${GRAPH.bottom + 34}">${t}</text>`;
    for (let x = -20; x <= 20; x += 5) html += `<line class="plot-grid" x1="${GRAPH.left}" y1="${graphY(x)}" x2="${GRAPH.right}" y2="${graphY(x)}"></line><text class="tick-label vertical-tick" x="${GRAPH.left - 28}" y="${graphY(x) + 5}">${x}</text>`;
    html += `<line class="plot-axis" x1="${GRAPH.left}" y1="${GRAPH.bottom}" x2="${GRAPH.right + 6}" y2="${GRAPH.bottom}"></line><line class="plot-axis" x1="${GRAPH.left}" y1="${GRAPH.bottom}" x2="${GRAPH.left}" y2="${GRAPH.top - 6}"></line><text class="axis-label horizontal-axis-label" x="${GRAPH.right - 12}" y="${GRAPH.bottom - 14}" text-anchor="end">t / s</text><text class="axis-label vertical-axis-label" x="${GRAPH.left}" y="${GRAPH.top - 25}" text-anchor="middle">x / m</text>`;
    return html;
  }
  function drawGraph() {
    dom.graphSvg.classList.toggle("is-narrow", dom.graphSvg.clientWidth > 0 && dom.graphSvg.clientWidth <= 420);
    const context = displayContext();
    dom.graphSvg.setAttribute("viewBox", `0 0 800 ${context.step === 2 ? GRAPH.comparisonHeight : GRAPH.compactHeight}`);
    let html = graphBase();
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
      html += svgLine(own, "student-line", ui.time) + missionInitialPoint(own, context.answer);
      visibleReadings.push(["學生圖線", S.positionAt(own, ui.time)]);
    } else if (context.step === 1) {
      const answer = context.answer;
      html += `<line class="motion-line student-line" data-graph-answer-line x1="${graphX(0)}" y1="${graphY(answer.xStart ?? 0)}" x2="${graphX(6)}" y2="${graphY(answer.xEnd ?? 0)}"></line>`;
      if (state.phase === "submitted-review") html += svgLine(context.scenario, "target-line", 6) + `<circle class="target-point" cx="${graphX(0)}" cy="${graphY(context.scenario.x0)}" r="8"></circle><circle class="target-point" cx="${graphX(6)}" cy="${graphY(S.positionAt(context.scenario, 6))}" r="8"></circle><text class="svg-label" x="${graphX(0) + 12}" y="${graphY(context.scenario.x0) - 12}">正確 ${svgPointSymbol(0)}</text><text class="svg-label" x="${graphX(6) - 76}" y="${graphY(S.positionAt(context.scenario, 6)) - 12}">正確 ${svgPointSymbol(6)}</text>`;
      html += graphHandle("xStart", 0, answer.xStart) + graphHandle("xEnd", 6, answer.xEnd);
      visibleReadings.push(["車的位置讀數", S.positionAt(context.scenario, ui.time)]);
    } else if (context.step === 2) {
      html += svgLine(context.scenario.A, "line-a", 6) + svgLine(context.scenario.B, "line-b", 6);
      html += probeSvg("A", context.answer.A.probes, context.scenario.A) + probeSvg("B", context.answer.B.probes, context.scenario.B) + fasterSvg(context.answer.faster);
      visibleReadings.push(["A 圖線", S.positionAt(context.scenario.A, ui.time)], ["B 圖線", S.positionAt(context.scenario.B, ui.time)]);
    } else if (context.step === 3) {
      const own = answerMotion(3, context.answer);
      html += svgLine(own, "student-line", ui.time) + missionInitialPoint(own, context.answer);
      visibleReadings.push(["學生圖線", S.positionAt(own, ui.time)]);
      if (state.phase === "submitted-review") html += svgLine(context.scenario, "target-line", 6);
    } else if (context.step === 4) {
      html += svgLine(context.scenario.A, "line-a", ui.time);
      visibleReadings.push(["A 圖線", S.positionAt(context.scenario.A, ui.time)]);
      const own = answerMotion(4, context.answer);
      if (!own.incomplete) { html += svgLine(own, "line-b", ui.time); visibleReadings.push(["B 圖線", S.positionAt(own, ui.time)]); }
      if (state.phase === "submitted-review") html += `<circle class="target-point" cx="${graphX(context.scenario.meetTime)}" cy="${graphY(S.positionAt(context.scenario.A, context.scenario.meetTime))}" r="9"></circle><text class="svg-label" x="${graphX(context.scenario.meetTime) + 12}" y="${graphY(S.positionAt(context.scenario.A, context.scenario.meetTime)) - 12}">指定相遇點</text>`;
      html += `<line class="time-cursor" x1="${graphX(context.scenario.meetTime)}" y1="${GRAPH.top}" x2="${graphX(context.scenario.meetTime)}" y2="${GRAPH.bottom}"></line><text class="svg-label" x="${graphX(context.scenario.meetTime) + 6}" y="${GRAPH.top + 18}"><tspan class="svg-math-symbol">t</tspan></text>`;
    }
    html += `<line class="time-cursor" x1="${graphX(ui.time)}" y1="${GRAPH.top}" x2="${graphX(ui.time)}" y2="${GRAPH.bottom}"></line>`;
    dom.graphLayer.innerHTML = html;
    dom.graphSummary.textContent = visibleReadings.length ? `讀圖游標 t = ${ui.time.toFixed(1)} s；${visibleReadings.map(([label, value]) => `${label} x = ${signed(value)} m`).join("；")}` : "橫軸時間 0 至 6 s；縱軸位置 −20 至 20 m。";
  }
  function currentDot(motion, className) {
    const color = className === "line-a" ? "var(--car-a)" : "var(--student-line)";
    return `<circle class="current-dot" cx="${graphX(ui.time)}" cy="${graphY(S.positionAt(motion, ui.time))}" r="7" stroke="${color}"></circle>`;
  }
  function missionInitialPoint(motion, answer) {
    if (!settingsEditable()) return currentDot(motion, "student-line");
    const pointX = graphX(0);
    const pointY = graphY(motion.x0);
    const hitGeometry = graphHitGeometry(pointX, pointY);
    const selected = ui.drag?.kind === "initial:x0";
    const hit = `<rect class="drag-hit graph-drag-hit" data-drag="initial:x0" data-point-cx="${pointX}" data-point-cy="${pointY}" tabindex="0" role="slider" aria-label="初始位置 x 零；目前 ${answer.x0 == null ? "未設定" : signed(answer.x0)} 米" aria-valuemin="-8" aria-valuemax="8" aria-valuenow="${motion.x0}" x="${hitGeometry.x}" y="${hitGeometry.y}" width="${hitGeometry.size}" height="${hitGeometry.size}" rx="${hitGeometry.radius * 0.45}"></rect>`;
    return `<g class="graph-point initial-position-point${selected ? " is-dragging" : ""}" data-graph-point="initial"><circle class="graph-handle-highlight" cx="${pointX}" cy="${pointY}" r="18"></circle><circle class="current-dot" cx="${pointX}" cy="${pointY}" r="7" stroke="var(--student-line)"></circle>${hit}</g>`;
  }
  function graphHandle(name, time, value) {
    const position = value == null ? 0 : value;
    const pointIndex = time === 0 ? 0 : 6;
    const spokenLabel = pointIndex === 0 ? "x 零" : "x 六";
    const pointX = graphX(time);
    const pointY = graphY(position);
    const hitGeometry = graphHitGeometry(pointX, pointY);
    const selected = ui.drag?.kind === `graph:${name}`;
    const hit = ui.locked ? "" : `<rect class="drag-hit graph-drag-hit" data-drag="graph:${name}" data-point-cx="${pointX}" data-point-cy="${pointY}" tabindex="0" role="slider" aria-label="${spokenLabel} 位置 ${value == null ? "未設定" : signed(value)} 米" aria-valuemin="-20" aria-valuemax="20" aria-valuenow="${position}" x="${hitGeometry.x}" y="${hitGeometry.y}" width="${hitGeometry.size}" height="${hitGeometry.size}" rx="${hitGeometry.radius * 0.45}"></rect>`;
    return `<g class="graph-point${selected ? " is-dragging" : ""}" data-graph-point="P${pointIndex}"><circle class="graph-handle-highlight" cx="${pointX}" cy="${pointY}" r="18"></circle><circle class="graph-handle" cx="${pointX}" cy="${pointY}" r="11"></circle>${hit}<text class="svg-label" x="${pointX + (time === 0 ? 14 : -108)}" y="${pointY - 15}">${svgPointSymbol(pointIndex)}${value == null ? " ?" : ` = ${signed(value)} <tspan class="svg-unit">m</tspan>`}</text></g>`;
  }
  function graphHitGeometry(pointX, pointY) {
    const radius = R.hitRadius(800, graphRenderedWidth(), 26, 52);
    const size = radius * 2;
    return { radius, size, x: clamp(pointX - radius, 0, 800 - size), y: clamp(pointY - radius, 0, GRAPH.compactHeight - size) };
  }
  function magnifierSource(layer) {
    return layer.innerHTML
      .replace(/<(rect|circle)\b(?=[^>]*\bclass="[^"]*\b(?:road-drag-hit|drag-hit|car-hit)\b)[^>]*><\/\1>/gi, "")
      .replace(/\s(?:id|data-drag|tabindex|role|focusable|aria-[\w-]+)="[^"]*"/gi, "");
  }
  function graphMagnifierViewBox(name, position) {
    const focusX = graphX(name === "xEnd" ? 6 : 0);
    const focusY = graphY(position);
    const sourceHeight = Number(dom.graphSvg.getAttribute("viewBox")?.split(/\s+/)[3]) || GRAPH.compactHeight;
    const x = clamp(focusX - GRAPH_MAGNIFIER.width / 2, 0, 800 - GRAPH_MAGNIFIER.width);
    const y = clamp(focusY - GRAPH_MAGNIFIER.height / 2, 0, sourceHeight - GRAPH_MAGNIFIER.height);
    return `${x} ${y} ${GRAPH_MAGNIFIER.width} ${GRAPH_MAGNIFIER.height}`;
  }
  function renderGraphTouchPreview() {
    const preview = ui.drag?.preview;
    const graphPreview = preview?.diagram === "graph";
    dom.graphTouchPreviewHost.hidden = !graphPreview;
    dom.graphTouchPreviewHost.className = `diagram-magnifier-host graph-magnifier-host${graphPreview ? ` is-${preview.horizontal} is-${preview.vertical}` : ""}`;
    if (!graphPreview) {
      dom.graphTouchPreviewHost.innerHTML = "";
      return;
    }
    const name = ui.drag.kind.split(":")[1];
    const position = currentAnswer()?.[name] ?? 0;
    const viewBox = graphMagnifierViewBox(name, position);
    dom.graphTouchPreviewHost.innerHTML = `<svg class="diagram-magnifier graph-magnifier" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g class="graph-magnifier-source">${magnifierSource(dom.graphLayer)}</g></svg>`;
  }
  function renderRoadTouchPreview() {
    const preview = ui.drag?.preview;
    const roadPreview = preview?.diagram === "road";
    dom.roadTouchPreviewHost.hidden = !roadPreview;
    dom.roadTouchPreviewHost.className = `diagram-magnifier-host road-magnifier-host${roadPreview ? ` is-${preview.horizontal} is-${preview.vertical}` : ""}`;
    if (!roadPreview) {
      dom.roadTouchPreviewHost.innerHTML = "";
      return;
    }
    const target = Array.from(dom.roadLayer.querySelectorAll("[data-drag]")).find((element) => element.dataset.drag === ui.drag.kind);
    if (!target) {
      dom.roadTouchPreviewHost.hidden = true;
      dom.roadTouchPreviewHost.innerHTML = "";
      return;
    }
    const focusX = Number(target.dataset.focusX);
    const focusY = Number(target.dataset.focusY);
    const x = clamp(focusX - ROAD_MAGNIFIER.width / 2, 0, 800 - ROAD_MAGNIFIER.width);
    const y = clamp(focusY - ROAD_MAGNIFIER.height / 2, 0, 145 - ROAD_MAGNIFIER.height);
    dom.roadTouchPreviewHost.innerHTML = `<svg class="diagram-magnifier road-magnifier" viewBox="${x} ${y} ${ROAD_MAGNIFIER.width} ${ROAD_MAGNIFIER.height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g class="road-magnifier-source">${magnifierSource(dom.roadLayer)}</g></svg>`;
  }
  function renderTouchPreviews() {
    renderRoadTouchPreview();
    renderGraphTouchPreview();
  }
  function clearDragTransient() {
    document.querySelectorAll(".graph-point").forEach((point) => point.classList.toggle("is-dragging", false));
    document.querySelectorAll("[data-road-car]").forEach((car) => {
      car.classList.toggle("is-dragging-car", false);
      car.classList.toggle("is-dragging-velocity", false);
    });
    renderTouchPreviews();
  }
  function updateGraphDragVisuals(name, position) {
    const pointIndex = name === "xStart" ? 0 : 6;
    const time = pointIndex;
    const pointX = graphX(time);
    const pointY = graphY(position);
    const group = document.querySelector(`[data-graph-point="P${pointIndex}"]`);
    const handle = group?.querySelector(".graph-handle");
    const highlight = group?.querySelector(".graph-handle-highlight");
    const hit = group?.querySelector(".graph-drag-hit");
    const label = group?.querySelector(".svg-label");
    for (const circle of [handle, highlight]) {
      circle?.setAttribute("cx", pointX);
      circle?.setAttribute("cy", pointY);
    }
    if (hit) {
      const geometry = graphHitGeometry(pointX, pointY);
      hit.dataset.pointCx = String(pointX);
      hit.dataset.pointCy = String(pointY);
      hit.setAttribute("aria-valuenow", position);
      hit.setAttribute("aria-label", `${pointIndex === 0 ? "x 零" : "x 六"} 位置 ${signed(position)} 米`);
      hit.setAttribute("x", geometry.x);
      hit.setAttribute("y", geometry.y);
      hit.setAttribute("width", geometry.size);
      hit.setAttribute("height", geometry.size);
      hit.setAttribute("rx", geometry.radius * 0.45);
    }
    if (label) {
      label.setAttribute("x", pointX + (time === 0 ? 14 : -108));
      label.setAttribute("y", pointY - 15);
      label.innerHTML = `${svgPointSymbol(pointIndex)} = ${signed(position)} <tspan class="svg-unit">m</tspan>`;
    }
    const line = document.querySelector("[data-graph-answer-line]");
    line?.setAttribute(name === "xStart" ? "y1" : "y2", pointY);
    const quantity = document.querySelector(`[data-quantity="${name}"]`);
    if (quantity) quantity.value = String(position);
    const valueHtml = `${signed(position)} <span class="unit">m</span>`;
    const headingValue = document.getElementById(`${name}Value`);
    const stepperValue = document.getElementById(`${name}StepperValue`);
    if (headingValue) headingValue.innerHTML = valueHtml;
    if (stepperValue) stepperValue.innerHTML = valueHtml;
    renderGraphTouchPreview();
  }
  function probeSvg(line, probes, motion) {
    return probes.map((time, index) => {
      const position = S.positionAt(motion, time);
      const label = probeName(line, index);
      const hit = ui.locked ? "" : `<circle class="drag-hit" data-drag="probe:${line}:${index}" tabindex="0" role="slider" aria-label="${line === "E" ? "探索" : line + " 車"} ${label} 探針，時間 ${time.toFixed(1)} 秒，位置 ${signed(position)} 米" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${time}" cx="${graphX(time)}" cy="${graphY(position)}" r="10"></circle>`;
      return `<g><line class="time-cursor" x1="${graphX(time)}" y1="${graphY(position)}" x2="${graphX(time)}" y2="${GRAPH.bottom}"></line><circle class="probe-handle" cx="${graphX(time)}" cy="${graphY(position)}" r="10"></circle>${hit}<text class="svg-label" x="${graphX(time) + 12}" y="${graphY(position) - 12}">${line === "E" ? "" : line}${label}</text></g>`;
    }).join("");
  }
  function fasterSvg(value) {
    const zones = [["A", 300, "A"], ["B", 430, "B"], ["same", 560, "一樣快"]];
    const selected = zones.find(([key]) => key === value);
    const tokenX = selected ? selected[1] : 170;
    const token = `<rect class="faster-token" x="${tokenX - 70}" y="432" width="140" height="28" rx="14"></rect><text class="svg-label" x="${tokenX}" y="451" text-anchor="middle" pointer-events="none">速度大小較大</text>`;
    const hit = ui.locked ? "" : `<rect class="drag-hit pointer-only" data-drag="faster" aria-hidden="true" focusable="false" x="${tokenX - 70}" y="432" width="140" height="28" rx="14"></rect>`;
    return zones.map(([key, x, label]) => `<rect class="faster-zone ${value === key ? "is-selected" : ""}" x="${x - 52}" y="462" width="104" height="26" rx="7"></rect><text class="svg-label" x="${x}" y="481" text-anchor="middle">${label}</text>`).join("") + token + hit;
  }

  function renderData() {
    const context = displayContext();
    const values = [["時間", math("t", "s", ui.time)]];
    if (ui.safeSummary || state.phase === "final-review") { /* time only */ }
    else if (state.phase === "explore") values.push(["初始位置", math("x<sub class=\"numeric-subscript\">0</sub>", "m", state.exploration.x0)], ["目前位置", math("x", "m", S.positionAt(state.exploration, ui.time))], ["速度", math("v", "m/s", state.exploration.v)]);
    else if (context.step === 2) values.push(["A 車位置", math("x<sub>A</sub>", "m", S.positionAt(context.scenario.A, ui.time))], ["B 車位置", math("x<sub>B</sub>", "m", S.positionAt(context.scenario.B, ui.time))]);
    else if (context.step === 1) values.push(["車的位置", math("x", "m", S.positionAt(context.scenario, ui.time))]);
    else if (context.step === 4) {
      values.push(["A 車位置", math("x<sub>A</sub>", "m", S.positionAt(context.scenario.A, ui.time))]);
      const own = answerMotion(4, context.answer);
      values.push(["B 車位置", own.incomplete ? "--" : math("x<sub>B</sub>", "m", S.positionAt(own, ui.time))], ["指定相遇時間", math("t", "s", context.scenario.meetTime)]);
    } else {
      const own = answerMotion(context.step, context.answer);
      values.push(["初始位置", own.incomplete && context.answer.x0 == null ? "--" : math("x<sub class=\"numeric-subscript\">0</sub>", "m", own.x0)], ["目前位置", own.incomplete ? "--" : math("x", "m", S.positionAt(own, ui.time))], ["速度", own.incomplete && context.answer.v == null ? "--" : math("v", "m/s", own.v)]);
    }
    dom.dataGrid.innerHTML = values.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");
  }

  function scrollRegionsToTop() {
    dom.labUpperScroll.scrollTop = 0;
    dom.labPanel.scrollTop = 0;
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
        const moved = transitionSafely((next) => next.variant === "from-review" ? P.returnToReview(next) : P.nextMission(next));
        if (moved) scrollRegionsToTop();
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
      R.renderRetryAction(document.getElementById("technicalAction"), ui.technicalAction, retryPending);
      return;
    }
    dom.resultPanel.className = "readout";
    if (state.phase === "final-review") {
      dom.resultSection.hidden = false;
      dom.resultPanel.innerHTML = `<div class="review-list">${[0, 1, 2, 3, 4].map((step) => {
        const key = `m${step + 1}`;
        const status = S.completeness(key, state.assessment.ans[key]);
        const label = status === "complete" ? "已完整" : status === "partial" ? "部分作答" : "未作答";
        return `<div class="review-item"><h3>${step + 1}. ${missionNameHtml(step)}</h3><p>${label}</p><button type="button" data-edit-step="${step}">修改第 ${step + 1} 題</button></div>`;
      }).join("")}</div>`;
      document.querySelectorAll("[data-edit-step]").forEach((button) => button.addEventListener("click", () => { resetTime(); transitionSafely((next) => P.editMission(next, Number(button.dataset.editStep))); }));
      return;
    }
    if (!ui.result) return;
    dom.resultSection.hidden = false;
    const scoreLabel = ui.result.score == null ? "--" : `${ui.result.score} / 100`;
    const completion = ui.result.passed == null ? "未能安全判斷合格狀態" : ui.result.passed ? "已通過" : "未通過";
    const detail = ui.resultTrusted && ui.result.detail?.length ? ui.result.detail.map((item, index) => `<div class="feedback-card ${item.score === 20 ? "good" : "needs-work"}"><h3>任務 ${index + 1}：${item.score} / 20</h3>${item.components.map((part) => `<p><strong>${escapeText(part.name)}：${part.earned} / ${part.points}</strong> — ${escapeText(part.feedback)}</p>`).join("")}</div>`).join("") : `<p>無法安全驗證已儲存的逐題答案；只顯示 Moodle 可提供的摘要。</p>`;
    dom.resultPanel.innerHTML = `<div>分數</div><div class="score-value">${scoreLabel}</div><strong>${completion}</strong><div class="feedback-list">${detail}</div><div id="finishAction"></div>`;
    R.renderFinishAction(document.getElementById("finishAction"), ui.finishRetry, retryFinish);
  }

  function persistState(candidate) {
    if (ui.locked || ui.technical || candidate.phase === "submitted-review") return false;
    const payload = P.encodeDraft(candidate);
    if (!payload) return false;
    try { return window.SimScorm.saveDraft(window.SimScorm.makeSnapshot(ACTIVITY, "draft", payload)); }
    catch { return false; }
  }
  function saveDraft() {
    const saved = persistState(state);
    ui.unsaved = !saved;
    return saved;
  }
  function transitionSafely(mutator) {
    const outcome = R.transitionWithSave(state, mutator, persistState);
    state = outcome.state;
    ui.unsaved = outcome.stage === "before";
    render();
    if (outcome.ok) announce("目前答案及下一步已儲存。");
    else if (outcome.stage === "after") announce("未能儲存下一步；已安全返回目前頁面，答案仍已保存。");
    else announce("草稿未能儲存；已留在目前頁面，請重試。");
    return outcome.ok;
  }
  function draftSnapshot() {
    syncVisibleNumberInputsToState();
    const payload = P.encodeDraft(state);
    if (!payload) throw new Error("invalid draft state");
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", payload);
  }
  function showTechnical(message) {
    stopAnimation();
    ui.locked = true;
    ui.technical = message;
    ui.technicalAction = null;
    ui.finishRetry = false;
    ui.result = null;
    render();
  }

  function submitAttempt() {
    if (state.phase !== "final-review" || ui.locked) return;
    const result = S.scoreAssessment(state.assessment);
    const reviewPayload = P.encodeReview(state);
    if (!result || !reviewPayload) { showTechnical("答案或題目未能通過安全驗證；沒有傳送分數。"); return; }
    let review;
    try { review = window.SimScorm.makeSnapshot(ACTIVITY, "review", reviewPayload, result); }
    catch { showTechnical("提交資料超出 Moodle 儲存限制；沒有傳送分數。"); return; }
    const handle = (outcome) => {
      P.lifecyclePolicy("submission", outcome);
      return window.SimActivityFlow.submission(outcome, {
      success: () => showSubmitted(reviewPayload, result, true, "本次作答已提交。"),
      committed: () => showSubmitted(reviewPayload, result, true, "成績已保存；請重試完成 Moodle session。", true),
      frozen: () => showFrozen("提交狀態未確認；答案已凍結，請使用重試按鈕傳送同一份答案。"),
      retry: (failure) => failure.retryable ? showRetry("未能傳送到 Moodle；答案仍可修改或再次提交。") : showTechnical("未能建立可重試的提交；沒有確認分數或合格狀態。")
      });
    };
    window.SimScorm.submitWithCallbacks(result, review, { onSuccess: handle, onFailure: handle });
  }
  function showSubmitted(reviewPayload, result, trusted, message, finishRetry = false) {
    const restored = P.decodeReview(reviewPayload);
    if (!restored) { showTechnical("已保存結果，但檢討資料無法安全載入。"); return; }
    state = restored;
    ui.locked = true;
    ui.technical = null;
    ui.technicalAction = null;
    ui.finishRetry = finishRetry;
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
    ui.technicalAction = "retry-pending";
    ui.finishRetry = false;
    ui.result = null;
    render();
  }
  function showRetry(message) {
    ui.locked = false;
    ui.technical = null;
    ui.technicalAction = null;
    ui.finishRetry = false;
    render();
    announce(message);
  }
  function retryPending() {
    const raw = window.SimScorm.retryPending();
    const outcome = { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
    window.SimActivityFlow.submission(outcome, {
      success: () => restorePendingReview(raw, "提交已完成。"),
      committed: () => restorePendingReview(raw, "成績已保存；請重試完成 Moodle session。", true),
      frozen: () => showFrozen("提交仍未確認；答案保持凍結。"),
      retry: (failure) => failure.retryable ? showFrozen("暫時仍未能提交；請稍後重試同一份答案。") : showTechnical("未能安全重試提交。")
    });
  }
  function retryFinish() {
    const finished = window.SimScorm.finish();
    if (finished) ui.finishRetry = false;
    render();
    announce(finished ? "Moodle session 已完成。" : "仍未能完成 Moodle session；成績保持鎖定，請稍後再試。");
  }
  function restorePendingReview(outcome, message, finishRetry = false) {
    const payload = outcome.review?.answer;
    const restored = P.decodeReview(payload);
    if (!restored) { showTechnical("Moodle 已保存摘要，但檢討資料無法安全載入。"); return; }
    const result = S.scoreAssessment(restored.assessment);
    showSubmitted(payload, result, true, message, finishRetry);
  }

  function applyDrag(kind, point, persist, dragMeta = null) {
    if (!R.dragAllowed(kind, interactionContext())) return false;
    const [type, line, rawIndex] = kind.split(":");
    let graphPosition = null;
    let changed = false;
    if (type === "car") {
      const value = R.positionFromPointer(point.x, dragMeta?.grabOffset || 0, ROAD.left, ROAD.right, -20, 20, 1, -8, 8);
      changed = value !== directMotion().x0;
      if (changed) updateDirectMotion("x0", value);
    } else if (type === "velocity") {
      const motion = directMotion();
      const value = clamp(snap((point.x - roadX(motion.x0)) / 48, 0.5), -2, 2);
      changed = value !== motion.v;
      if (changed) updateDirectMotion("v", value);
    } else if (type === "graph") {
      const adjustedY = point.y - (dragMeta?.grabOffsetY || 0);
      graphPosition = clamp(snap(S.LIMITS.positionMin + (GRAPH.bottom - adjustedY) / (GRAPH.bottom - GRAPH.top) * 40, 1), -20, 20);
      changed = graphPosition !== (currentAnswer()[line] ?? 0);
      if (changed) currentAnswer()[line] = graphPosition;
    } else if (type === "initial") {
      const adjustedY = point.y - (dragMeta?.grabOffsetY || 0);
      graphPosition = clamp(snap(S.LIMITS.positionMin + (GRAPH.bottom - adjustedY) / (GRAPH.bottom - GRAPH.top) * 40, 1), -8, 8);
      changed = graphPosition !== (currentAnswer().x0 ?? 0);
      if (changed) {
        currentAnswer().x0 = graphPosition;
        resetTime();
      }
    } else if (type === "probe") {
      const max = line === "E" ? ui.time : 6;
      const time = clamp(snap((point.x - GRAPH.left) / (GRAPH.right - GRAPH.left) * 6, 0.5), 0, max);
      const index = Number(rawIndex);
      changed = time !== probeList(line)[index];
      if (changed) probeList(line)[index] = time;
    } else if (type === "faster") {
      const value = point.x < 365 ? "A" : point.x < 495 ? "B" : "same";
      changed = value !== currentAnswer().faster;
      if (changed) currentAnswer().faster = value;
    } else return false;
    if (!changed && !(persist && dragMeta?.moved)) return false;
    if (changed) ui.unsaved = true;
    if (!persist && type === "graph" && ui.drag) {
      updateGraphDragVisuals(line, graphPosition);
      return true;
    }
    let saved = true;
    if (persist) saved = saveDraft();
    render();
    if (persist) announce(saved ? "操作已儲存。" : "操作未能儲存；請重試後才前往下一步。" );
    return changed;
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
  function nearestRoadDragTarget(event) {
    if (event.currentTarget !== dom.roadSvg) return null;
    const contact = Number.isFinite(event.clientX) ? event : event.touches?.[0] || event.changedTouches?.[0];
    if (!contact) return null;
    const candidates = Array.from(dom.roadLayer.querySelectorAll("[data-drag]"))
      .filter((target) => ["car", "velocity"].includes(target.dataset.drag.split(":")[0]) && R.dragAllowed(target.dataset.drag, interactionContext()))
      .map((target) => {
        const focus = dom.roadSvg.createSVGPoint();
        focus.x = Number(target.dataset.focusX);
        focus.y = Number(target.dataset.focusY);
        const screen = focus.matrixTransform(dom.roadSvg.getScreenCTM());
        return { target, distance: Math.hypot(contact.clientX - screen.x, contact.clientY - screen.y) };
      })
      .filter((candidate) => candidate.distance <= 28)
      .sort((a, b) => a.distance - b.distance);
    return candidates[0]?.target || null;
  }
  function pointerDown(event) {
    if (ui.drag || event.isPrimary === false) return;
    const target = event.currentTarget === dom.roadSvg ? nearestRoadDragTarget(event) : event.target.closest("[data-drag]");
    if (!target || !R.dragAllowed(target.dataset.drag, interactionContext())) return;
    const type = target.dataset.drag.split(":")[0];
    const graphLike = type === "graph" || type === "initial";
    const graphName = graphLike ? target.dataset.drag.split(":")[1] : null;
    const point = clientPoint(event.currentTarget, event);
    const grabOffset = type === "car" ? point.x - roadX(directMotion().x0) : 0;
    const grabOffsetY = graphLike ? point.y - graphY(currentAnswer()?.[graphName] ?? 0) : 0;
    const touchPointer = ["touch", "pen"].includes(event.pointerType);
    let preview = null;
    if (touchPointer && ["car", "velocity", "graph", "initial"].includes(type)) {
      const previewContainer = graphLike ? dom.graphSvg : dom.roadTouchPreviewHost.parentElement;
      const previewBounds = previewContainer?.getBoundingClientRect?.() || { left: 0, top: 0, width: 800, height: graphLike ? GRAPH.compactHeight : 585 };
      preview = {
        diagram: graphLike ? "graph" : "road",
        horizontal: event.clientX < previewBounds.left + previewBounds.width / 2 ? "right" : "left",
        vertical: event.clientY < previewBounds.top + previewBounds.height / 2 ? "bottom" : "top"
      };
    }
    ui.drag = { kind: target.dataset.drag, svg: event.currentTarget, pointerId: event.pointerId, grabOffset, grabOffsetY, preview, startClientX: event.clientX, startClientY: event.clientY, activated: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (preview) {
      if (graphLike) {
        const pointKey = type === "initial" ? "initial" : target.dataset.drag.endsWith("xStart") ? "P0" : "P6";
        document.querySelector(`[data-graph-point="${pointKey}"]`)?.classList.toggle("is-dragging", true);
      } else {
        target.closest("[data-road-car]")?.classList.add(type === "car" ? "is-dragging-car" : "is-dragging-velocity");
      }
      renderTouchPreviews();
    }
    event.preventDefault();
  }
  function pointerMove(event) {
    if (!ui.drag || ui.drag.pointerId !== event.pointerId || ui.drag.svg !== event.currentTarget) return;
    if (!ui.drag.activated) {
      if (Math.hypot(event.clientX - ui.drag.startClientX, event.clientY - ui.drag.startClientY) < 5) {
        event.preventDefault();
        return;
      }
      ui.drag.activated = true;
    }
    ui.drag.moved = applyDrag(ui.drag.kind, clientPoint(event.currentTarget, event), false, ui.drag) || Boolean(ui.drag.moved);
    event.preventDefault();
  }
  function pointerUp(event) {
    if (!ui.drag || ui.drag.pointerId !== event.pointerId || ui.drag.svg !== event.currentTarget) return;
    const drag = ui.drag;
    ui.drag = null;
    if (!drag.moved) {
      clearDragTransient();
      event.preventDefault();
      return;
    }
    applyDrag(drag.kind, clientPoint(event.currentTarget, event), true, drag);
    event.preventDefault();
  }
  function pointerCancel(event) {
    if (!ui.drag || ui.drag.pointerId !== event.pointerId || ui.drag.svg !== event.currentTarget) return;
    const moved = ui.drag.moved;
    ui.drag = null;
    if (moved) saveAndAnnounce("中斷前的操作已儲存。");
    else clearDragTransient();
    event.preventDefault();
  }
  function preventDragTouchScroll(event) {
    const activeHere = ui.drag && ui.drag.svg === event.currentTarget;
    const target = event.currentTarget === dom.roadSvg ? nearestRoadDragTarget(event) : event.target.closest("[data-drag]");
    if (activeHere || (target && R.dragAllowed(target.dataset.drag, interactionContext()))) event.preventDefault();
  }
  function dragKeydown(event) {
    const target = event.target.closest("[data-drag]");
    if (!target || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || !R.dragAllowed(target.dataset.drag, interactionContext())) return;
    const [type, line, rawIndex] = target.dataset.drag.split(":");
    if (type === "car") updateDirectMotion("x0", R.adjustByArrow(directMotion().x0, event.key, 1, -8, 8, event.shiftKey));
    else if (type === "velocity") updateDirectMotion("v", R.adjustByArrow(directMotion().v, event.key, 0.5, -2, 2, event.shiftKey));
    else if (type === "graph") currentAnswer()[line] = R.adjustByArrow(currentAnswer()[line] ?? 0, event.key, 1, -20, 20, event.shiftKey);
    else if (type === "initial") currentAnswer().x0 = R.adjustByArrow(currentAnswer().x0 ?? 0, event.key, 1, -8, 8, event.shiftKey);
    else if (type === "probe") {
      const max = line === "E" ? ui.time : 6;
      const index = Number(rawIndex);
      probeList(line)[index] = R.adjustByArrow(probeList(line)[index], event.key, 0.5, 0, max, event.shiftKey);
    } else if (type === "faster") {
      const values = ["A", "B", "same"];
      const index = Math.max(0, values.indexOf(currentAnswer().faster));
      const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
      currentAnswer().faster = values[clamp(index + direction, 0, 2)];
    } else return;
    event.preventDefault();
    const focusKey = `drag:${target.dataset.drag}`;
    ui.unsaved = true;
    const saved = saveDraft();
    render();
    R.restoreFocus(document, focusKey);
    announce(saved ? "鍵盤操作已儲存。" : "鍵盤操作未能儲存；請重試。" );
  }

  function showFinished(attempt) {
    const payload = attempt.snapshot?.answer;
    const restored = P.decodeReview(payload);
    if (!restored) { showSafeFinished(attempt); return; }
    const computed = S.scoreAssessment(restored.assessment);
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
    if (!S.validateScenarioLibrary() || !G || G.GENERATOR_VERSION !== 2) { showTechnical("題目情境驗證失敗；活動沒有開放作答。"); return; }
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
    svg.addEventListener("touchstart", preventDragTouchScroll, { passive: false });
    svg.addEventListener("touchmove", preventDragTouchScroll, { passive: false });
    svg.addEventListener("pointerdown", pointerDown);
    svg.addEventListener("pointermove", pointerMove);
    svg.addEventListener("pointerup", pointerUp);
    svg.addEventListener("pointercancel", pointerCancel);
    svg.addEventListener("lostpointercapture", pointerCancel);
    svg.addEventListener("keydown", dragKeydown);
  });
  dom.playButton.addEventListener("click", play);
  dom.stepButton.addEventListener("click", () => setTime(ui.time + 0.5, true));
  dom.replayButton.addEventListener("click", () => { setTime(0, true); if (state.phase === "explore") ui.explorationProbes = []; render(); });
  dom.timeSlider.addEventListener("input", () => setTime(Number(dom.timeSlider.value)));
  dom.timeSlider.addEventListener("change", () => announce(`讀圖游標：t = ${ui.time.toFixed(1)} 秒。${dom.graphSummary.textContent}`));
  dom.confirmStart.addEventListener("click", () => {
    const seed = G.createSeed(window.crypto);
    if (!seed) { announce("未能建立安全的隨機題目；仍在自由探索，請重試。"); return; }
    const paper = G.generatePaper(seed);
    if (!paper || !G.validateGeneratedPaper(paper)) { announce("題目生成驗證失敗；仍在自由探索，請重試。"); return; }
    resetTime(true);
    const moved = transitionSafely((next) => P.startGeneratedAssessment(next, seed, paper));
    if (moved) scrollRegionsToTop();
  });
  dom.confirmSubmit.addEventListener("click", submitAttempt);
  initialize();
})();
