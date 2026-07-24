(function () {
  "use strict";

  const Levels = window.KinematicsDrivingLevels;
  const Model = window.KinematicsDrivingModel;
  const Scoring = window.KinematicsDrivingScoring;
  const Persistence = window.KinematicsDrivingPersistence;
  const Visuals = window.KinematicsDrivingVisuals;
  const UiPolicy = window.KinematicsDrivingUiPolicy;
  if (![Levels, Model, Scoring, Persistence, Visuals, UiPolicy, window.SimScorm, window.SimActivityFlow].every(Boolean)) {
    throw new Error("Driving activity modules were not loaded");
  }

  const ACTIVITY = "kinematics-driving-challenge";
  const elements = Object.fromEntries(Array.from(document.querySelectorAll("[id]")).map((element) => [element.id, element]));
  const graphInputs = Array.from(document.querySelectorAll("input[name=graphMode]"));
  const intensityInputs = Array.from(document.querySelectorAll("input[name=intensity]"));
  const answerInputs = Array.from(document.querySelectorAll("input[name=checkpointAnswer]"));
  const canvas = elements.drivingCanvas;
  const ctx = canvas.getContext("2d");
  const graphCtx = elements.graphCanvas.getContext("2d");

  let state = null;
  let locked = false;
  let running = false;
  let currentCode = 0;
  let appliedCode = 0;
  let inputSequence = 0;
  let inputQueue = [];
  let tickWallCursor = performance.now();
  let activePointer = null;
  let activePedal = null;
  let runtimeRun = null;
  let analysisRun = null;
  let accumulator = 0;
  let lastFrame = performance.now();
  let frameId = 0;
  let retryMode = "none";
  let trustedReview = true;
  let submittedResult = null;
  let stageView = { width: 800, height: 430, dpr: 1 };
  let graphView = { width: 220, height: 150, dpr: 1 };
  let liveLast = "";

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function currentLevel() {
    if (state?.phase === "practice") return Levels.PRACTICE;
    if (state?.phase === "level") return Levels.levelById(state.currentItem);
    if (state?.phase === "graph-check") return Levels.levelById(state.graphCheckpoint.sourceLevelId);
    return Levels.levelById("level1");
  }
  function announce(text) {
    if (!text || text === liveLast) return;
    liveLast = text;
    elements.liveRegion.textContent = "";
    requestAnimationFrame(() => { elements.liveRegion.textContent = text; });
  }
  function focusHeading(element) { requestAnimationFrame(() => element?.focus({ preventScroll: true })); }
  function candidateCodes() { return state?.candidateRun?.codes || []; }
  function selectedScore(id) {
    const selected = state.selectedRuns[id];
    return selected ? Scoring.scoreRun(Levels.levelById(id), selected.codes) : null;
  }
  function draftSnapshot() {
    const answer = Persistence.encode({ ...state, runtime: { running } });
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", answer);
  }
  function saveDraft(durable = true) {
    if (locked) return false;
    try {
      const snapshot = draftSnapshot();
      if (durable && !window.SimScorm.saveDraft(snapshot)) throw new Error("Draft save rejected");
      return true;
    } catch (error) {
      console.warn(error);
      neutralize();
      locked = true;
      showTechnical("未能保存目前進度，駕駛操作已鎖定。", false);
      return false;
    }
  }
  function saveAndRender(message) {
    neutralize();
    if (!saveDraft(true)) return false;
    if (message) announce(message);
    render();
    return true;
  }
  function rebuildRuntime() {
    const level = currentLevel();
    const replay = Model.replay(level, candidateCodes());
    runtimeRun = replay || Model.replay(level, []);
    accumulator = 0;
  }
  function neutralize() {
    running = false;
    currentCode = 0;
    appliedCode = 0;
    inputQueue = [];
    activePointer = null;
    activePedal = null;
    elements.throttleButton.classList.remove("is-pressed");
    elements.brakeButton.classList.remove("is-pressed");
    elements.throttleButton.setAttribute("aria-pressed", "false");
    elements.brakeButton.setAttribute("aria-pressed", "false");
  }
  function intensity() { return Number(intensityInputs.find((input) => input.checked)?.value || 2); }
  function beginPedal(kind, pointerId = null) {
    if (locked || !running || activePedal) return;
    activePedal = kind;
    activePointer = pointerId;
    currentCode = kind === "throttle" ? intensity() : intensity() + 3;
    inputQueue.push({ timestamp: performance.now(), sequence: inputSequence++, code: currentCode });
    const button = kind === "throttle" ? elements.throttleButton : elements.brakeButton;
    button.classList.add("is-pressed");
    button.setAttribute("aria-pressed", "true");
    renderControlState();
  }
  function releasePedal(kind, pointerId = null) {
    if (activePedal !== kind || (pointerId != null && activePointer != null && pointerId !== activePointer)) return;
    activePedal = null; activePointer = null; currentCode = 0;
    inputQueue.push({ timestamp: performance.now(), sequence: inputSequence++, code: 0 });
    elements.throttleButton.classList.remove("is-pressed");
    elements.brakeButton.classList.remove("is-pressed");
    elements.throttleButton.setAttribute("aria-pressed", "false");
    elements.brakeButton.setAttribute("aria-pressed", "false");
    renderControlState();
  }
  function renderControlState() {
    elements.controlState.textContent = `目前：${Model.CONTROL_LABELS[currentCode]}`;
  }
  function startRun() {
    if (locked || !["practice", "level"].includes(state.phase)) return;
    if (state.phase === "level" && !["briefing", "paused", "review-retry-briefing", "review-retry-paused"].includes(state.variant)) return;
    if (!state.candidateRun) state.candidateRun = { ownerId: currentLevel().id, codes: [] };
    state.variant = state.phase === "practice" ? "paused" : state.returnToReview ? "review-retry-paused" : "paused";
    rebuildRuntime();
    if (runtimeRun.state.terminal) return finishRun();
    running = true;
    tickWallCursor = performance.now();
    appliedCode = 0;
    inputQueue = [];
    lastFrame = performance.now();
    announce("試車開始；按住踏板控制車輛。");
    render();
  }
  function pauseRun() {
    if (locked || !running) return;
    neutralize();
    saveAndRender("試車已暫停；繼續時由空檔開始。");
  }
  function resetRun() {
    if (locked || !["practice", "level"].includes(state.phase)) return;
    neutralize();
    state.candidateRun = null;
    state.variant = state.phase === "practice" ? "ready" : state.returnToReview ? "review-retry-briefing" : "briefing";
    analysisRun = null;
    rebuildRuntime();
    saveAndRender("已重新開始今次試車。");
  }
  function finishRun() {
    neutralize();
    analysisRun = Scoring.scoreRun(currentLevel(), candidateCodes());
    if (state.phase === "practice") {
      state.candidateRun = null;
      state.variant = "ready";
      rebuildRuntime();
      saveAndRender("練習試車已完結，可以重新練習或開始正式關卡。");
      return;
    }
    state.variant = state.returnToReview ? "review-retry-analysis" : "analysis";
    saveAndRender("試車完成；請查看圖線及質性分析。");
  }
  function acceptRun() {
    if (locked || state.phase !== "level" || !state.variant.endsWith("analysis") || !analysisRun) return;
    const id = state.currentItem;
    const previous = state.selectedRuns[id];
    state.selectedRuns[id] = { revision: (previous?.revision || 0) + 1, codes: candidateCodes().slice() };
    state.candidateRun = null;
    if (["level2", "level3"].includes(id) && state.graphCheckpoint.sourceLevelId === id) {
      state.graphCheckpoint = {
        sourceLevelId: id, sourceRunRevision: state.selectedRuns[id].revision,
        viewedXt: false, viewedVt: false, answerId: null
      };
    }
    const returning = state.returnToReview;
    state.returnToReview = false;
    analysisRun = null;
    if (returning) return enterReview();
    if (id === "level1") return enterLevel("level2");
    if (id === "level2") return enterLevel("level3");
    if (id === "level3") return enterCheckpoint(false);
    if (id === "level4") return enterLevel("level5");
    return enterReview();
  }
  function enterLevel(id, reviewRetry = false) {
    neutralize();
    state.phase = "level"; state.currentItem = id; state.returnToReview = reviewRetry;
    state.variant = reviewRetry ? "review-retry-briefing" : "briefing";
    state.candidateRun = null; analysisRun = null; rebuildRuntime();
    saveAndRender(reviewRetry ? "可重新挑戰；原有記錄會保留至你確認新表現。" : `已進入第 ${Levels.levelById(id).number} 關。`);
    focusHeading(elements.panelTitle);
  }
  function enterCheckpoint(fromReview) {
    neutralize();
    const source = state.selectedRuns[state.graphCheckpoint.sourceLevelId] ? state.graphCheckpoint.sourceLevelId : "level2";
    state.graphCheckpoint.sourceLevelId = source;
    state.graphCheckpoint.sourceRunRevision = state.selectedRuns[source].revision;
    if (state.graphCheckpoint.answerId && !fromReview) {
      state.graphCheckpoint.viewedXt = false; state.graphCheckpoint.viewedVt = false; state.graphCheckpoint.answerId = null;
    }
    state.phase = "graph-check"; state.currentItem = "checkpoint"; state.returnToReview = fromReview;
    state.variant = fromReview && state.graphCheckpoint.answerId ? "review-edit-answered" : fromReview ? "review-edit-exploring" :
      state.graphCheckpoint.answerId ? "answered" : "exploring";
    state.candidateRun = null;
    elements.scrubRange.value = "100";
    saveAndRender("請查看同一段試車的兩幅圖。");
    focusHeading(elements.checkpointTitle);
  }
  function viewCheckpoint(mode) {
    if (locked || state.phase !== "graph-check") return;
    state.graphMode = mode;
    if (mode === "xt") state.graphCheckpoint.viewedXt = true;
    if (mode === "vt") state.graphCheckpoint.viewedVt = true;
    saveAndRender(`已查看 ${mode === "xt" ? "x–t" : "v–t"} 圖。`);
  }
  function confirmCheckpoint() {
    if (locked || state.phase !== "graph-check") return;
    if (!(state.graphCheckpoint.viewedXt && state.graphCheckpoint.viewedVt)) {
      elements.checkpointError.textContent = "請先查看同一段記錄的兩幅圖。";
      return;
    }
    const answer = answerInputs.find((input) => input.checked)?.value;
    if (!answer) { elements.checkpointError.textContent = "請選擇一項答案。"; return; }
    state.graphCheckpoint.answerId = answer;
    state.variant = state.returnToReview ? "review-edit-answered" : "answered";
    elements.checkpointError.textContent = "";
    if (state.returnToReview) return enterReview();
    enterLevel("level4");
  }
  function enterReview() {
    neutralize();
    state.phase = "review"; state.currentItem = "review"; state.returnToReview = false; state.candidateRun = null;
    state.variant = Persistence.allComplete(state) ? "complete" : "incomplete";
    saveAndRender("已進入提交前檢查。");
    focusHeading(elements.reviewTitle);
  }
  function keepPrevious() {
    if (!state.returnToReview) return;
    state.candidateRun = null; analysisRun = null;
    enterReview();
  }
  function beginFormal() { enterLevel("level1"); }
  function scoreForReview() { return Persistence.allComplete(state) ? Scoring.scoreActivity(state.selectedRuns, state.graphCheckpoint) : null; }
  function submitAll() {
    if (locked || state.phase !== "review" || state.variant !== "complete") return;
    let computed, reviewAnswer, snapshot;
    try {
      computed = scoreForReview();
      reviewAnswer = Persistence.makeReview(state);
      snapshot = window.SimScorm.makeSnapshot(ACTIVITY, "review", reviewAnswer, computed);
    } catch (error) {
      console.warn(error); return showTechnical("未能建立可驗證的提交記錄；答案尚未提交。", false);
    }
    locked = true; neutralize();
    const handle = (outcome) => UiPolicy.submission(outcome, {
      success: () => showSubmitted(computed, true),
      committed: () => { retryMode = "finish"; showSubmitted(computed, true, "成績已寫入，但 Moodle 尚未完成離開程序。"); },
      frozen: () => { retryMode = "pending"; showTechnical("提交仍待確認；目前記錄已凍結，請重試同一份提交。", true); },
      retry: (failure) => {
        locked = !failure.retryable;
        retryMode = failure.retryable ? "submit" : "none";
        state.phase = "review"; state.variant = "complete";
        render();
        elements.submissionNotice.textContent = failure.retryable ? "未能確認提交，記錄仍可重試。" : "提交前檢查失敗；目前操作已鎖定。";
        elements.submissionNotice.classList.remove("is-hidden");
        elements.submissionRetryButton.classList.toggle("is-hidden", !failure.retryable);
      }
    });
    window.SimScorm.submitWithCallbacks(computed, snapshot, { onSuccess: handle, onFailure: handle });
  }
  function retrySubmission() {
    if (retryMode === "submit") { locked = false; return submitAll(); }
    if (!["pending", "finish"].includes(retryMode)) return;
    const outcome = window.SimScorm.retryPending();
    if (outcome.committed) {
      const reviewState = outcome.review?.answer ? Persistence.decodeReview(outcome.review.answer) : null;
      const computed = reviewState ? Scoring.scoreActivity(reviewState.selectedRuns, reviewState.graphCheckpoint) : submittedResult;
      if (computed) showSubmitted(computed, true, outcome.finished ? "" : "成績已寫入，但 Moodle 尚未完成離開程序。");
    } else showTechnical("仍未能確認提交；駕駛記錄保持凍結。", true);
  }
  function showSubmitted(result, trusted, notice = "") {
    submittedResult = result; trustedReview = trusted; retryMode = notice ? "finish" : "none";
    locked = true; neutralize();
    if (state) { state.phase = "submitted"; state.variant = "locked"; state.currentItem = "review"; state.returnToReview = false; state.candidateRun = null; }
    renderResult(notice);
  }
  function showTechnical(message, canRetry) {
    locked = true; neutralize();
    elements.activitySection.classList.add("is-hidden");
    elements.checkpointSection.classList.add("is-hidden");
    elements.reviewSection.classList.add("is-hidden");
    elements.resultSection.classList.remove("is-hidden");
    elements.resultTitle.textContent = "技術狀態";
    elements.scorePanel.textContent = "--　未能安全判斷提交或合格狀態";
    elements.feedbackList.innerHTML = `<article class="feedback-item"><p>${escapeHtml(message)}</p></article>`;
    elements.resultRetryButton.classList.toggle("is-hidden", !canRetry);
    announce(message);
  }
  function restoreFinished(attempt) {
    locked = true;
    const review = Persistence.decodeReview(attempt.snapshot?.answer);
    if (!review) {
      state = Persistence.initialState();
      submittedResult = { score: Number.isFinite(Number(attempt.score)) ? Number(attempt.score) : null, maxScore: 100, passed: null, levelResults: [] };
      trustedReview = false;
      return renderResult("Moodle 已記錄完成，但詳細駕駛記錄無法安全還原。");
    }
    state = review;
    const computed = Scoring.scoreActivity(review.selectedRuns, review.graphCheckpoint);
    const outcome = UiPolicy.reviewOutcome(computed, { score: attempt.snapshot.score, passed: attempt.snapshot.passed }, attempt);
    submittedResult = outcome.result; trustedReview = outcome.trusted;
    renderResult(outcome.trusted ? "" : "記錄與 Moodle 結果不一致，只顯示可信的 Moodle 摘要。");
  }
  function renderResult(notice = "") {
    elements.activitySection.classList.add("is-hidden");
    elements.checkpointSection.classList.add("is-hidden");
    elements.reviewSection.classList.add("is-hidden");
    elements.resultSection.classList.remove("is-hidden");
    elements.resultTitle.textContent = trustedReview ? "已提交：只讀檢討" : "已完成：安全摘要";
    const label = window.SimActivityFlow.completionLabel(submittedResult?.passed ?? null);
    elements.scorePanel.textContent = `${submittedResult?.score ?? "--"} / 100　${label}`;
    const rows = [];
    if (notice) rows.push(`<article class="feedback-item"><p>${escapeHtml(notice)}</p></article>`);
    if (trustedReview && submittedResult?.levelResults) {
      submittedResult.levelResults.forEach((levelResult, index) => {
        const level = Levels.LEVELS[index];
        rows.push(`<article class="feedback-item ${levelResult.points >= levelResult.maxPoints * .7 ? "is-good" : ""}"><h3>${escapeHtml(level.title)}：${formatPoint(levelResult.points)} / ${levelResult.maxPoints}</h3>${levelResult.zones.map((zone) => `<p>${escapeHtml(Scoring.feedbackText(zone))}</p>`).join("")}</article>`);
      });
      rows.push(`<article class="feedback-item"><h3>圖像證據：${submittedResult.checkpointPoints} / 10</h3><p>勻速的 v–t 圖是水平直線；勻加速及勻減速分別是向上及向下直線。x–t 圖可以顯示速度正在改變，但 v–t 圖更直接顯示變化率是否固定。</p></article>`);
    }
    elements.feedbackList.innerHTML = rows.join("");
    elements.resultRetryButton.classList.toggle("is-hidden", retryMode === "none");
    renderProgress("review");
  }
  function render() {
    if (!state) return;
    elements.activitySection.classList.toggle("is-hidden", !["practice", "level"].includes(state.phase));
    elements.checkpointSection.classList.toggle("is-hidden", state.phase !== "graph-check");
    elements.reviewSection.classList.toggle("is-hidden", state.phase !== "review");
    elements.resultSection.classList.toggle("is-hidden", state.phase !== "submitted");
    if (state.phase === "submitted") return renderResult();
    graphInputs.forEach((input) => { input.checked = input.value === state.graphMode; input.disabled = locked; });
    if (state.phase === "practice" || state.phase === "level") renderDrivingPanel();
    else if (state.phase === "graph-check") renderCheckpoint();
    else if (state.phase === "review") renderReview();
    renderProgress();
    draw();
  }
  function renderDrivingPanel() {
    const level = currentLevel();
    const practice = state.phase === "practice";
    elements.panelKicker.textContent = practice ? "操作練習（不計分）" : `第 ${level.number} 關`;
    elements.panelTitle.textContent = level.title;
    elements.instruction.textContent = level.instruction;
    elements.stageKicker.textContent = practice ? "操作練習" : `第 ${level.number} 關`;
    elements.stageTarget.textContent = Visuals.targetLabel(activeSampleSegment()?.target || level.segments[0].target);
    const briefing = ["ready", "briefing", "review-retry-briefing"].includes(state.variant);
    const paused = state.variant === "paused" || state.variant === "review-retry-paused";
    const analysis = state.variant.endsWith("analysis");
    elements.startButton.textContent = paused ? "繼續試車" : "開始試車";
    elements.startButton.disabled = locked || running || analysis;
    elements.pauseButton.disabled = locked || !running;
    elements.resetButton.disabled = locked || analysis && false;
    elements.advanceButton.classList.toggle("is-hidden", !practice);
    elements.advanceButton.disabled = locked;
    elements.drivingDeck.classList.toggle("is-hidden", analysis);
    elements.analysisSection.classList.toggle("is-hidden", !analysis);
    if (analysis) renderAnalysis();
    elements.throttleButton.disabled = locked || !running;
    elements.brakeButton.disabled = locked || !running;
    intensityInputs.forEach((input) => { input.disabled = locked || analysis; });
    if (briefing) elements.stageStatus.textContent = "車輛已準備好。";
    else if (running) elements.stageStatus.textContent = Model.qualitativeMotion(runtimeRun?.samples);
    else if (analysis) elements.stageStatus.textContent = "試車已完成，正在只讀回放。";
    else elements.stageStatus.textContent = "試車已暫停；踏板已回到空檔。";
    renderControlState();
  }
  function renderAnalysis() {
    analysisRun ||= Scoring.scoreRun(currentLevel(), candidateCodes());
    elements.analysisList.innerHTML = analysisRun.zones.map((zone) =>
      `<article class="analysis-item"><h4>${escapeHtml(Visuals.targetLabel(zone.target))}：${formatPoint(zone.points)} / ${zone.maxPoints}</h4><p>${escapeHtml(Scoring.feedbackText(zone))}</p></article>`
    ).join("");
    elements.acceptButton.textContent = state.returnToReview ? "以今次表現取代原記錄" : "記錄今次表現";
    elements.keepPreviousButton.classList.toggle("is-hidden", !state.returnToReview);
  }
  function renderCheckpoint() {
    const checkpoint = state.graphCheckpoint;
    elements.stageKicker.textContent = "圖像證據";
    elements.stageTarget.textContent = state.graphMode === "xt" ? "比較 x–t 圖" : "比較 v–t 圖";
    elements.checkpointAnswers.disabled = locked || !(checkpoint.viewedXt && checkpoint.viewedVt);
    elements.checkpointViewStatus.textContent = `x–t：${checkpoint.viewedXt ? "已查看" : "未查看"}　v–t：${checkpoint.viewedVt ? "已查看" : "未查看"}`;
    answerInputs.forEach((input) => { input.checked = input.value === checkpoint.answerId; input.disabled = elements.checkpointAnswers.disabled; });
    elements.confirmCheckpointButton.textContent = state.returnToReview ? "確認並返回檢查" : "確認並前往第 4 關";
    elements.confirmCheckpointButton.disabled = locked;
    elements.stageStatus.textContent = "拖動回放游標，可比較同一時刻的車輛與圖線。";
  }
  function renderReview() {
    const complete = Persistence.allComplete(state);
    state.variant = complete ? "complete" : "incomplete";
    elements.reviewList.innerHTML = Levels.LEVELS.map((level) => {
      const result = selectedScore(level.id);
      return `<article class="review-item"><h3>${escapeHtml(level.title)}</h3><p>${result ? `${formatPoint(result.points)} / ${result.maxPoints}，已記錄` : "尚未記錄"}</p><button type="button" data-edit-level="${level.id}">${result ? "重新挑戰" : "完成此關"}</button></article>`;
    }).join("") + `<article class="review-item"><h3>圖像證據 checkpoint</h3><p>${state.graphCheckpoint.answerId ? "已回答" : "尚未完成"}</p><button type="button" data-edit-checkpoint>查看或修改</button></article>`;
    elements.submitButton.disabled = locked || !complete;
    elements.submissionNotice.classList.toggle("is-hidden", complete);
    elements.submissionNotice.textContent = complete ? "" : "請先完成五關及圖像 checkpoint。";
  }
  function renderProgress(force) {
    const current = force || (state.phase === "graph-check" ? "checkpoint" : state.phase === "level" ? state.currentItem : state.phase);
    const order = ["practice", "level1", "level2", "level3", "checkpoint", "level4", "level5", "review"];
    const currentIndex = order.indexOf(current);
    document.querySelectorAll("[data-step]").forEach((item) => {
      const index = order.indexOf(item.dataset.step);
      item.classList.toggle("is-current", index === currentIndex);
      item.classList.toggle("is-done", item.dataset.step.startsWith("level") ? Boolean(state?.selectedRuns?.[item.dataset.step]) :
        item.dataset.step === "checkpoint" ? Boolean(state?.graphCheckpoint?.answerId) : index < currentIndex);
    });
  }
  function displayRun() {
    if (state.phase === "graph-check") {
      const selected = state.selectedRuns[state.graphCheckpoint.sourceLevelId];
      return Model.replay(currentLevel(), selected?.codes || []);
    }
    if (state.phase === "level" && state.variant.endsWith("analysis")) return analysisRun?.run || runtimeRun;
    return runtimeRun;
  }
  function displaySample() {
    const run = displayRun();
    if (!run?.samples?.length) return { t: 0, x: 0, v: currentLevel().initialSpeed, a: 0 };
    if (state.phase === "graph-check" || state.phase === "level" && state.variant.endsWith("analysis")) {
      const fraction = Number(elements.scrubRange.value) / 100;
      return run.samples[Math.round((run.samples.length - 1) * fraction)];
    }
    return run.samples[run.samples.length - 1];
  }
  function activeSampleSegment() { return Levels.segmentAt(currentLevel(), displaySample()?.x || 0); }
  function graphSamples() {
    const run = displayRun();
    if (!run?.samples?.length) return [];
    if (state.phase === "graph-check") return run.samples;
    const segment = activeSampleSegment();
    return run.samples.filter((sample) => sample.segmentId === segment?.id);
  }
  function resizeCanvas(target, context, holder, viewKey) {
    const rect = holder.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (target.width !== width || target.height !== height) { target.width = width; target.height = height; }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height, dpr };
  }
  function resize() {
    stageView = resizeCanvas(canvas, ctx, elements.stage, stageView);
    graphView = resizeCanvas(elements.graphCanvas, graphCtx, elements.graphCard, graphView);
    draw();
  }
  function draw() {
    if (!state) return;
    drawStage();
    drawGraph();
  }
  function drawStage() {
    const width = stageView.width, height = stageView.height;
    const level = currentLevel();
    const sample = displaySample();
    const anchorX = width * 0.38;
    const baseY = height * 0.68;
    const ppm = Math.max(4.2, Math.min(7, width / 115));
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#dbeafe"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#bfdbfe"; ctx.beginPath(); ctx.moveTo(0, baseY - 55); ctx.lineTo(width * .28, baseY - 105); ctx.lineTo(width * .55, baseY - 58); ctx.lineTo(width, baseY - 120); ctx.lineTo(width, baseY); ctx.lineTo(0, baseY); ctx.fill();
    const currentElevationY = Visuals.roadY(sample.x, level, 0, ppm);
    for (let cell = Math.floor((sample.x - 80) / 18); cell <= Math.ceil((sample.x + 100) / 18); cell += 1) {
      const worldX = cell * 18;
      const x = Visuals.worldToScreen(worldX, sample.x, anchorX, ppm);
      const y = baseY + Visuals.roadY(worldX, level, 0, ppm) - currentElevationY;
      const item = Visuals.sceneryCell(cell, level.number * 13);
      drawScenery(item, x, y, 24 * item.height);
    }
    const roadPoints = [];
    for (let px = -30; px <= width + 30; px += 8) {
      const worldX = sample.x + (px - anchorX) / ppm;
      roadPoints.push({ x: px, y: baseY + Visuals.roadY(worldX, level, 0, ppm) - currentElevationY });
    }
    ctx.fillStyle = "#a9c994"; ctx.fillRect(0, baseY - 5, width, height - baseY + 5);
    ctx.beginPath(); ctx.moveTo(roadPoints[0].x, roadPoints[0].y);
    roadPoints.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(width + 30, height); ctx.lineTo(-30, height); ctx.closePath(); ctx.fillStyle = "#4b5563"; ctx.fill();
    ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2; ctx.setLineDash([18, 14]);
    ctx.beginPath(); roadPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y + 25) : ctx.moveTo(point.x, point.y + 25)); ctx.stroke(); ctx.setLineDash([]);
    level.segments.forEach((segment) => {
      const signPosition = segment.start === 0 ? Math.min(segment.end - 2, 18) : segment.start;
      const x = Visuals.worldToScreen(signPosition, sample.x, anchorX, ppm);
      if (x < -80 || x > width + 80) return;
      const y = baseY + Visuals.roadY(signPosition, level, 0, ppm) - currentElevationY;
      drawTargetSign(x, y - 6, segment.target);
    });
    drawCar(anchorX, baseY - 3, Math.max(.72, Math.min(1.05, width / 760)), Visuals.slopeAt(level, sample.x), Model.wheelAngle(sample.x));
    elements.graphAlternative.textContent = state.graphMode === "hidden" ? "圖像已隱藏" : Visuals.graphShapeLabel(graphSamples());
  }
  function drawScenery(item, x, y, size) {
    if (item.kind === "tree") {
      ctx.fillStyle = "#6b4f35"; ctx.fillRect(x - 2, y - size, 4, size);
      ctx.fillStyle = item.hue; ctx.beginPath(); ctx.arc(x, y - size, size * .45, 0, Math.PI * 2); ctx.fill();
    } else if (item.kind === "building") {
      ctx.fillStyle = item.hue; ctx.fillRect(x - size * .4, y - size * 1.5, size * .8, size * 1.5);
      ctx.fillStyle = "#e0f2fe"; ctx.fillRect(x - size * .24, y - size * 1.3, size * .18, size * .22);
    } else {
      ctx.strokeStyle = "#64748b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - size * 1.5); ctx.stroke();
      ctx.fillStyle = "#fef3c7"; ctx.beginPath(); ctx.arc(x + 5, y - size * 1.5, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawCar(x, y, scale, slopeDeg, wheelAngle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-slopeDeg * Math.PI / 180); ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(15,23,42,.16)"; ctx.beginPath(); ctx.ellipse(0, 10, 62, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e4554f"; ctx.strokeStyle = "#8f2d32"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-62, 0); ctx.lineTo(-49, -26); ctx.lineTo(-18, -33); ctx.lineTo(8, -52); ctx.lineTo(38, -46); ctx.lineTo(55, -23); ctx.lineTo(66, -18); ctx.lineTo(66, 4); ctx.lineTo(-62, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#bfdbfe"; ctx.beginPath(); ctx.moveTo(-10, -32); ctx.lineTo(11, -47); ctx.lineTo(31, -43); ctx.lineTo(43, -25); ctx.closePath(); ctx.fill();
    [-39, 39].forEach((wheelX) => {
      ctx.save(); ctx.translate(wheelX, 5); ctx.rotate(wheelAngle); ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke(); ctx.restore();
    });
    ctx.restore();
  }
  function drawTargetSign(x, y, target) {
    if (target === "transition") return;
    const label = Visuals.targetLabel(target);
    ctx.save(); ctx.strokeStyle = "#475569"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 50); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5; ctx.fillRect(x - 38, y - 78, 76, 29); ctx.strokeRect(x - 38, y - 78, 76, 29);
    ctx.fillStyle = "#1f2937"; ctx.font = "700 12px system-ui"; ctx.textAlign = "center"; ctx.fillText(label, x, y - 59); ctx.restore();
  }
  function drawGraph() {
    const hidden = state.graphMode === "hidden" || state.phase === "review" || state.phase === "submitted";
    elements.graphCard.classList.toggle("is-hidden", hidden);
    if (hidden) return;
    const width = graphView.width, height = graphView.height;
    graphCtx.clearRect(0, 0, width, height);
    graphCtx.fillStyle = "rgba(255,255,255,.94)"; graphCtx.fillRect(0, 0, width, height);
    const rect = { x: 23, y: 22, width: Math.max(20, width - 34), height: Math.max(20, height - 34) };
    graphCtx.strokeStyle = "#94a3b8"; graphCtx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const x = rect.x + rect.width * i / 5;
      graphCtx.beginPath(); graphCtx.moveTo(x, rect.y); graphCtx.lineTo(x, rect.y + rect.height); graphCtx.stroke();
    }
    graphCtx.strokeStyle = "#334155"; graphCtx.lineWidth = 1.5; graphCtx.beginPath();
    graphCtx.moveTo(rect.x, rect.y); graphCtx.lineTo(rect.x, rect.y + rect.height); graphCtx.lineTo(rect.x + rect.width, rect.y + rect.height); graphCtx.stroke();
    const samples = graphSamples();
    const points = Visuals.graphPoints(samples, state.graphMode, rect, activeSampleSegment());
    graphCtx.strokeStyle = "#2563eb"; graphCtx.lineWidth = 2.5; graphCtx.lineJoin = "round"; graphCtx.beginPath();
    points.forEach((point, index) => index ? graphCtx.lineTo(point.x, point.y) : graphCtx.moveTo(point.x, point.y)); graphCtx.stroke();
    elements.graphTitle.textContent = state.graphMode === "xt" ? "x–t" : "v–t";
    graphCtx.fillStyle = "#334155"; graphCtx.font = "700 11px system-ui"; graphCtx.fillText("t", width - 12, height - 4);
    graphCtx.fillText(state.graphMode === "xt" ? "x" : "v", 7, 18);
  }
  function animate(now) {
    const elapsed = Math.min(.5, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (running && !locked) {
      accumulator += elapsed;
      let catchup = 0;
      while (accumulator + 1e-9 >= Model.TICK_S && catchup < 8 && running) {
        tickWallCursor += Model.TICK_S * 1000;
        const consumed = Model.consumeInputTransitions(inputQueue, tickWallCursor, appliedCode);
        appliedCode = consumed.code;
        inputQueue = consumed.remaining;
        state.candidateRun.codes.push(appliedCode);
        runtimeRun = Model.replay(currentLevel(), state.candidateRun.codes);
        accumulator -= Model.TICK_S; catchup += 1;
        if (!runtimeRun || runtimeRun.state.terminal) finishRun();
      }
      if (catchup === 8 && accumulator >= Model.TICK_S) {
        neutralize(); announce("裝置暫時未能安全追上物理時間，試車已技術暫停。"); saveDraft(true); render();
      } else {
        elements.stageStatus.textContent = Model.qualitativeMotion(runtimeRun?.samples);
        elements.stageTarget.textContent = Visuals.targetLabel(activeSampleSegment()?.target);
        draw();
      }
    }
    frameId = requestAnimationFrame(animate);
  }
  function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value ?? ""); return span.innerHTML; }
  function formatPoint(value) { return Number(value).toFixed(value % 1 ? 1 : 0); }
  function wirePedal(button, kind) {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (activePedal) return;
      button.setPointerCapture?.(event.pointerId);
      beginPedal(kind, event.pointerId);
      event.preventDefault();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => button.addEventListener(type, (event) => {
      releasePedal(kind, event.pointerId);
    }));
  }
  wirePedal(elements.throttleButton, "throttle");
  wirePedal(elements.brakeButton, "brake");
  elements.startButton.addEventListener("click", startRun);
  elements.pauseButton.addEventListener("click", pauseRun);
  elements.resetButton.addEventListener("click", resetRun);
  elements.advanceButton.addEventListener("click", beginFormal);
  elements.acceptButton.addEventListener("click", acceptRun);
  elements.retryRunButton.addEventListener("click", resetRun);
  elements.keepPreviousButton.addEventListener("click", keepPrevious);
  elements.viewXtButton.addEventListener("click", () => viewCheckpoint("xt"));
  elements.viewVtButton.addEventListener("click", () => viewCheckpoint("vt"));
  elements.confirmCheckpointButton.addEventListener("click", confirmCheckpoint);
  elements.submitButton.addEventListener("click", submitAll);
  elements.submissionRetryButton.addEventListener("click", retrySubmission);
  elements.resultRetryButton.addEventListener("click", retrySubmission);
  elements.scrubRange.addEventListener("input", draw);
  graphInputs.forEach((input) => input.addEventListener("change", () => {
    if (locked) return;
    state.graphMode = input.value;
    if (state.phase === "graph-check") {
      if (input.value === "xt") state.graphCheckpoint.viewedXt = true;
      if (input.value === "vt") state.graphCheckpoint.viewedVt = true;
    }
    render();
  }));
  elements.reviewList.addEventListener("click", (event) => {
    const levelId = event.target.closest("[data-edit-level]")?.dataset.editLevel;
    if (levelId) enterLevel(levelId, Boolean(state.selectedRuns[levelId]));
    if (event.target.closest("[data-edit-checkpoint]")) enterCheckpoint(true);
  });
  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "1" || event.key === "2" || event.key === "3") {
      intensityInputs.forEach((input) => { input.checked = input.value === event.key; });
    } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") { beginPedal("throttle"); event.preventDefault(); }
    else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") { beginPedal("brake"); event.preventDefault(); }
    else if (event.code === "Space") { running ? pauseRun() : startRun(); event.preventDefault(); }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") releasePedal("throttle");
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") releasePedal("brake");
  });
  window.addEventListener("blur", () => { if (activePedal) { neutralize(); if (state) render(); } });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activePedal) { neutralize(); if (state) render(); }
  });
  let stageTouchY = null;
  canvas.addEventListener("touchstart", (event) => {
    if (event.isTrusted && event.touches.length === 1) stageTouchY = event.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    if (stageTouchY == null || !event.isTrusted || event.touches.length !== 1) return;
    try {
      if (window.parent !== window && window.parent.document) {
        const next = event.touches[0].clientY;
        window.parent.scrollBy(0, stageTouchY - next);
        stageTouchY = next;
        event.preventDefault();
      }
    } catch { /* Cross-origin host must provide its own verified owner path. */ }
  }, { passive: false });
  canvas.addEventListener("touchend", () => { stageTouchY = null; }, { passive: true });
  canvas.addEventListener("touchcancel", () => { stageTouchY = null; }, { passive: true });
  new ResizeObserver(resize).observe(elements.stage);
  new ResizeObserver(resize).observe(elements.graphCard);

  const attempt = window.SimScorm.loadAttempt(ACTIVITY);
  const startup = window.SimActivityFlow.startup(attempt);
  const mode = UiPolicy.startupMode(startup);
  if (mode === "review") restoreFinished(attempt);
  else if (mode === "activity") {
    try {
      state = attempt.state === "draft" ? Persistence.decode(attempt.snapshot?.answer) : Persistence.initialState();
      if (!state && attempt.state === "draft") {
        state = Persistence.initialState();
        if (!window.SimScorm.saveDraft(window.SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(state)))) throw new Error("Invalid draft could not be replaced");
        announce("舊有或損壞的草稿已安全清除，活動由練習重新開始。");
      }
      if (!state) throw new Error("Invalid initial state");
      locked = false; rebuildRuntime();
      if (state.phase === "level" && state.variant.endsWith("analysis")) analysisRun = Scoring.scoreRun(currentLevel(), candidateCodes());
      window.SimScorm.setDraftProvider(draftSnapshot);
      if (attempt.state !== "new" || saveDraft(true)) render();
    } catch (error) { console.warn(error); state ||= Persistence.initialState(); showTechnical("未能安全載入活動草稿，操作已鎖定。", false); }
  } else if (mode === "pending") {
    state = Persistence.initialState(); retryMode = "pending";
    showTechnical(UiPolicy.technicalCopy("pending"), true);
  } else {
    state = Persistence.initialState();
    showTechnical(UiPolicy.technicalCopy("technical"), false);
  }
  resize();
  frameId = requestAnimationFrame(animate);
  window.addEventListener("unload", () => cancelAnimationFrame(frameId), { once: true });
})();
