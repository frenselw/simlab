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
  let analysisZoneId = null;
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
    elements.throttleButton.querySelectorAll("[data-intensity]").forEach((item) => item.classList.remove("is-active"));
    elements.brakeButton.querySelectorAll("[data-intensity]").forEach((item) => item.classList.remove("is-active"));
    elements.throttleButton.setAttribute("aria-pressed", "false");
    elements.brakeButton.setAttribute("aria-pressed", "false");
  }
  function showPedalIntensity(kind, intensity) {
    const button = kind === "throttle" ? elements.throttleButton : elements.brakeButton;
    button.querySelectorAll("[data-intensity]").forEach((item) => {
      item.classList.toggle("is-active", Number(item.dataset.intensity) === intensity);
    });
  }
  function beginPedal(kind, pointerId = null, intensity = 2) {
    if (locked || !running || activePedal) return;
    activePedal = kind;
    activePointer = pointerId;
    currentCode = kind === "throttle" ? intensity : intensity + 3;
    inputQueue.push({ timestamp: performance.now(), sequence: inputSequence++, code: currentCode });
    const button = kind === "throttle" ? elements.throttleButton : elements.brakeButton;
    button.classList.add("is-pressed");
    button.setAttribute("aria-pressed", "true");
    showPedalIntensity(kind, intensity);
    renderControlState();
  }
  function changePedalIntensity(kind, pointerId, intensity) {
    if (activePedal !== kind || activePointer !== pointerId) return;
    const nextCode = kind === "throttle" ? intensity : intensity + 3;
    if (nextCode === currentCode) return;
    currentCode = nextCode;
    inputQueue.push({ timestamp: performance.now(), sequence: inputSequence++, code: currentCode });
    showPedalIntensity(kind, intensity);
    renderControlState();
  }
  function releasePedal(kind, pointerId = null) {
    if (activePedal !== kind || (pointerId != null && activePointer != null && pointerId !== activePointer)) return;
    activePedal = null; activePointer = null; currentCode = 0;
    inputQueue.push({ timestamp: performance.now(), sequence: inputSequence++, code: 0 });
    elements.throttleButton.classList.remove("is-pressed");
    elements.brakeButton.classList.remove("is-pressed");
    elements.throttleButton.querySelectorAll("[data-intensity]").forEach((item) => item.classList.remove("is-active"));
    elements.brakeButton.querySelectorAll("[data-intensity]").forEach((item) => item.classList.remove("is-active"));
    elements.throttleButton.setAttribute("aria-pressed", "false");
    elements.brakeButton.setAttribute("aria-pressed", "false");
    renderControlState();
  }
  function renderControlState() {
    elements.controlState.textContent = `目前：${Model.CONTROL_LABELS[currentCode]}`;
  }
  function startRun() {
    if (locked || !["practice", "level"].includes(state.phase)) return;
    if (state.phase === "level" && !["briefing", "paused", "accepted", "review-retry-briefing", "review-retry-paused"].includes(state.variant)) return;
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
    analysisZoneId = analysisRun?.zones[0]?.zoneId || null;
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
    state.variant = "accepted";
    saveAndRender(`已記錄第 ${Levels.levelById(id).number} 關；可以自由選擇其他關卡。`);
  }
  function enterLevel(id, reviewRetry = false) {
    neutralize();
    state.phase = "level"; state.currentItem = id; state.returnToReview = reviewRetry;
    state.variant = reviewRetry ? "review-retry-briefing" : "briefing";
    state.candidateRun = null; analysisRun = null; rebuildRuntime();
    analysisZoneId = null;
    saveAndRender(reviewRetry ? "可重新挑戰；原有記錄會保留至你確認新表現。" : `已進入第 ${Levels.levelById(id).number} 關。`);
    focusHeading(elements.panelTitle);
  }
  function enterCheckpoint(fromReview) {
    neutralize();
    const source = [state.graphCheckpoint.sourceLevelId, "level2", "level3"]
      .find((id) => state.selectedRuns[id]);
    if (!source) {
      announce("請先記錄第 2 或第 3 關，才可比較圖像。");
      return;
    }
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
    enterReview();
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
        rows.push(`<article class="feedback-item ${levelResult.points >= levelResult.maxPoints * .7 ? "is-good" : ""}"><h3>${escapeHtml(level.title)}：${formatPoint(levelResult.points)} / ${levelResult.maxPoints}</h3>${levelResult.zones.map((zone) => `<p>${physicsHtml(Scoring.feedbackText(zone))}</p>`).join("")}</article>`);
      });
      rows.push(`<article class="feedback-item"><h3>圖像證據：${submittedResult.checkpointPoints} / 10</h3><p>${physicsHtml("勻速的 v–t 圖是水平直線；勻加速及勻減速分別是向上及向下直線。x–t 圖可以顯示速度正在改變，但 v–t 圖更直接顯示變化率是否固定。")}</p></article>`);
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
    elements.instruction.innerHTML = physicsHtml(level.instruction);
    elements.stageKicker.textContent = practice ? "操作練習" : `第 ${level.number} 關`;
    elements.stageTarget.textContent = Visuals.stageTargetLabel(level, activeSampleSegment() || level.segments[0]);
    const briefing = ["ready", "briefing", "review-retry-briefing"].includes(state.variant);
    const paused = state.variant === "paused" || state.variant === "review-retry-paused";
    const analysis = state.variant.endsWith("analysis");
    const accepted = state.variant === "accepted";
    elements.startButton.textContent = paused ? "繼續試車" : accepted ? "重新挑戰本關" : "開始試車";
    elements.startButton.disabled = locked || running || analysis;
    elements.pauseButton.disabled = locked || !running;
    elements.resetButton.disabled = locked || analysis && false;
    renderLevelPicker();
    elements.drivingDeck.classList.toggle("is-hidden", analysis);
    elements.analysisSection.classList.toggle("is-hidden", !analysis);
    if (analysis) renderAnalysis();
    elements.throttleButton.disabled = locked || !running;
    elements.brakeButton.disabled = locked || !running;
    if (briefing) elements.stageStatus.textContent = "按住踏板即可開始駕駛。";
    else if (running) elements.stageStatus.textContent = Model.qualitativeMotion(runtimeRun?.samples);
    else if (analysis) elements.stageStatus.textContent = "試車已完成，正在只讀回放。";
    else if (accepted) elements.stageStatus.textContent = "本關表現已記錄；可選擇其他關卡。";
    else elements.stageStatus.textContent = "試車已暫停；踏板已回到空檔。";
    renderControlState();
  }
  function renderLevelPicker() {
    elements.levelPicker.querySelectorAll("[data-pick-level]").forEach((button) => {
      const id = button.dataset.pickLevel;
      const current = state.phase === "level" && state.currentItem === id;
      button.classList.toggle("is-current", current);
      button.classList.toggle("is-complete", Boolean(state.selectedRuns[id]));
      button.setAttribute("aria-current", current ? "step" : "false");
      button.disabled = locked;
    });
    elements.reviewProgressButton.disabled = locked;
  }
  function renderAnalysis() {
    analysisRun ||= Scoring.scoreRun(currentLevel(), candidateCodes());
    if (!analysisRun.zones.some((zone) => zone.zoneId === analysisZoneId)) analysisZoneId = analysisRun.zones[0]?.zoneId || null;
    elements.analysisZoneTabs.innerHTML = analysisRun.zones.map((zone, index) =>
      `<button type="button" data-analysis-zone="${zone.zoneId}" aria-pressed="${zone.zoneId === analysisZoneId}"${locked ? " disabled" : ""}>路段 ${index + 1}：${escapeHtml(Visuals.targetLabel(zone.target))}</button>`
    ).join("");
    elements.analysisList.innerHTML = analysisRun.zones.map((zone) =>
      `<article class="analysis-item${zone.zoneId === analysisZoneId ? " is-selected" : ""}"><h4>${escapeHtml(Visuals.targetLabel(zone.target))}：${formatPoint(zone.points)} / ${zone.maxPoints}</h4><p>${physicsHtml(Scoring.feedbackText(zone))}</p></article>`
    ).join("");
    elements.acceptButton.textContent = state.returnToReview ? "以今次表現取代原記錄" : "記錄今次表現";
    elements.keepPreviousButton.classList.toggle("is-hidden", !state.returnToReview);
  }
  function renderCheckpoint() {
    const checkpoint = state.graphCheckpoint;
    elements.stageKicker.textContent = "圖像證據";
    elements.stageTarget.innerHTML = physicsHtml(state.graphMode === "xt" ? "比較 x–t 圖" : "比較 v–t 圖");
    elements.checkpointAnswers.disabled = locked || !(checkpoint.viewedXt && checkpoint.viewedVt);
    elements.viewXtButton.disabled = locked;
    elements.viewVtButton.disabled = locked;
    elements.scrubRange.disabled = locked;
    elements.checkpointViewStatus.innerHTML = physicsHtml(`x–t：${checkpoint.viewedXt ? "已查看" : "未查看"}　v–t：${checkpoint.viewedVt ? "已查看" : "未查看"}`);
    answerInputs.forEach((input) => { input.checked = input.value === checkpoint.answerId; input.disabled = elements.checkpointAnswers.disabled; });
    elements.confirmCheckpointButton.textContent = "確認並返回關卡檢查";
    elements.confirmCheckpointButton.disabled = locked;
    elements.stageStatus.textContent = "拖動回放游標，可比較同一時刻的車輛與圖線。";
  }
  function renderReview() {
    const complete = Persistence.allComplete(state);
    state.variant = complete ? "complete" : "incomplete";
    elements.reviewList.innerHTML = Levels.LEVELS.map((level) => {
      const result = selectedScore(level.id);
      const canOpen = UiPolicy.canOpenReviewItem(state, level.id, locked);
      return `<article class="review-item"><h3>${escapeHtml(level.title)}</h3><p>${result ? `${formatPoint(result.points)} / ${result.maxPoints}，已記錄` : "尚未記錄"}</p><button type="button" data-edit-level="${level.id}"${canOpen ? "" : " disabled"}>${result ? "重新挑戰" : "完成此關"}</button></article>`;
    }).join("") + (() => {
      const canOpen = UiPolicy.canOpenReviewItem(state, "checkpoint", locked);
      return `<article class="review-item"><h3>圖像證據 checkpoint</h3><p>${state.graphCheckpoint.answerId ? "已回答" : canOpen ? "尚未完成" : "請先記錄第 2 或第 3 關"}</p><button type="button" data-edit-checkpoint${canOpen ? "" : " disabled"}>查看或修改</button></article>`;
    })();
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
    if (state.phase === "level" && state.variant.endsWith("analysis")) {
      const zone = graphZone();
      const zoneRows = run.samples.filter((sample) => sample.segmentId === zone?.id);
      if (zoneRows.length) {
        const fraction = Number(elements.scrubRange.value) / 100;
        return zoneRows[Math.round((zoneRows.length - 1) * fraction)];
      }
    }
    if (state.phase === "graph-check") {
      const fraction = Number(elements.scrubRange.value) / 100;
      return run.samples[Math.round((run.samples.length - 1) * fraction)];
    }
    return run.samples[run.samples.length - 1];
  }
  function activeSampleSegment() { return Levels.segmentAt(currentLevel(), displaySample()?.x || 0); }
  function graphZone() {
    if (state.phase === "level" && state.variant.endsWith("analysis")) {
      return Levels.scoredZones(currentLevel()).find((zone) => zone.id === analysisZoneId) || Levels.scoredZones(currentLevel())[0];
    }
    const level = currentLevel();
    return {
      id: `${level.id}-preview`,
      start: 0,
      end: level.routeLength,
      graphVelocitySpan: Levels.GRAPH_VELOCITY_SPAN,
      graphTimeSpan: Levels.GRAPH_TIME_SPAN_S
    };
  }
  function graphSamples() {
    const run = displayRun();
    if (!run?.samples?.length) return [];
    if (state.phase === "graph-check") return run.samples;
    if (state.phase === "level" && !state.variant.endsWith("analysis")) return run.samples;
    const segment = graphZone();
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
    const roadDepth = Math.max(52, Math.min(82, height * .19));
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, baseY);
    sky.addColorStop(0, "#dbeafe"); sky.addColorStop(1, "#eff6ff");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#c9dcf4"; ctx.beginPath();
    ctx.moveTo(0, baseY - 48); ctx.lineTo(width * .2, baseY - 103); ctx.lineTo(width * .4, baseY - 57);
    ctx.lineTo(width * .62, baseY - 121); ctx.lineTo(width * .82, baseY - 70); ctx.lineTo(width, baseY - 112);
    ctx.lineTo(width, baseY); ctx.lineTo(0, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d8e6d0"; ctx.beginPath();
    ctx.moveTo(0, baseY - 24); ctx.lineTo(width * .24, baseY - 61); ctx.lineTo(width * .48, baseY - 29);
    ctx.lineTo(width * .72, baseY - 70); ctx.lineTo(width, baseY - 34);
    ctx.lineTo(width, baseY); ctx.lineTo(0, baseY); ctx.closePath(); ctx.fill();
    const currentElevationY = Visuals.roadY(sample.x, level, 0, ppm);
    const roadPoints = [];
    for (let px = -30; px <= width + 30; px += 8) {
      const worldX = sample.x + (px - anchorX) / ppm;
      roadPoints.push({ x: px, y: baseY + Visuals.roadY(worldX, level, 0, ppm) - currentElevationY });
    }
    ctx.beginPath(); ctx.moveTo(roadPoints[0].x, roadPoints[0].y - 28);
    roadPoints.forEach((point) => ctx.lineTo(point.x, point.y - 28));
    ctx.lineTo(width + 30, height); ctx.lineTo(-30, height); ctx.closePath();
    ctx.fillStyle = "#9fbe89"; ctx.fill();
    drawBackgroundLayer("far", sample.x, level, anchorX, ppm, baseY, currentElevationY, width, height);
    drawBackgroundLayer("roadside", sample.x, level, anchorX, ppm, baseY, currentElevationY, width, height);
    fillRoadStrip(roadPoints, -15, 0, "#d8d3c6");
    strokeRoadPath(roadPoints, -14, "#f8fafc", 2);
    const asphalt = ctx.createLinearGradient(0, baseY, 0, baseY + roadDepth);
    asphalt.addColorStop(0, "#626c79"); asphalt.addColorStop(.58, "#4b5563"); asphalt.addColorStop(1, "#3f4752");
    fillRoadStrip(roadPoints, 0, roadDepth, asphalt);
    strokeRoadPath(roadPoints, 1.5, "#7b8794", 3);
    strokeRoadPath(roadPoints, roadDepth - 1.5, "#303844", 3);
    drawRoadTexture(sample.x, anchorX, ppm, roadPoints, roadDepth, width);
    fillRoadStrip(roadPoints, roadDepth, roadDepth + 15, "#c8c2b5");
    strokeRoadPath(roadPoints, roadDepth + 2, "#eef2f7", 2);
    ctx.beginPath(); ctx.moveTo(roadPoints[0].x, roadPoints[0].y + roadDepth + 15);
    roadPoints.forEach((point) => ctx.lineTo(point.x, point.y + roadDepth + 15));
    ctx.lineTo(width + 30, height); ctx.lineTo(-30, height); ctx.closePath();
    ctx.fillStyle = "#789a68"; ctx.fill();
    Visuals.boundaryMarkers(level).forEach((marker) => {
      const x = Visuals.worldToScreen(marker.position, sample.x, anchorX, ppm);
      if (x < -40 || x > width + 40) return;
      const y = baseY + Visuals.roadY(marker.position, level, 0, ppm) - currentElevationY;
      drawRoadBoundary(x, y, roadDepth);
      drawTargetSign(x, y - 12, marker.target);
    });
    level.segments.forEach((segment) => {
      if (segment.start > 0) return;
      const signPosition = segment.start === 0 ? Math.min(segment.end - 2, 18) : segment.start;
      const x = Visuals.worldToScreen(signPosition, sample.x, anchorX, ppm);
      if (x < -80 || x > width + 80) return;
      const y = baseY + Visuals.roadY(signPosition, level, 0, ppm) - currentElevationY;
      drawTargetSign(x, y - 12, segment.target);
    });
    drawCar(anchorX, baseY + roadDepth * .55, Math.max(.78, Math.min(1.08, width / 720)), Visuals.visualSlopeAt(level, sample.x), Model.wheelAngle(sample.x));
    elements.graphAlternative.textContent = state.graphMode === "hidden" ? "圖像已隱藏" : Visuals.graphShapeLabel(graphSamples());
  }
  function fillRoadStrip(points, topOffset, bottomOffset, fillStyle) {
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y + topOffset) : ctx.moveTo(point.x, point.y + topOffset));
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index]; ctx.lineTo(point.x, point.y + bottomOffset);
    }
    ctx.closePath(); ctx.fillStyle = fillStyle; ctx.fill();
  }
  function strokeRoadPath(points, offset, strokeStyle, lineWidth) {
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y + offset) : ctx.moveTo(point.x, point.y + offset));
    ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth; ctx.stroke();
  }
  function drawRoadTexture(worldPosition, anchorX, ppm, roadPoints, roadDepth, width) {
    const firstCell = Math.floor((worldPosition - width / ppm) / 13);
    const lastCell = Math.ceil((worldPosition + width / ppm) / 13);
    ctx.save(); ctx.fillStyle = "rgba(15,23,42,.09)";
    for (let cell = firstCell; cell <= lastCell; cell += 1) {
      const x = Visuals.worldToScreen(cell * 13 + 4, worldPosition, anchorX, ppm);
      if (x < -20 || x > width + 20) continue;
      const nearest = roadPoints[Math.max(0, Math.min(roadPoints.length - 1, Math.round((x + 30) / 8)))];
      ctx.beginPath(); ctx.ellipse(x, nearest.y + roadDepth * .62, 9, 2.2, -.08, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawBackgroundLayer(layer, worldPosition, level, anchorX, ppm, baseY, currentElevationY, width, height) {
    const config = Visuals.BACKGROUND_LAYERS[layer];
    const size = Math.max(.68, Math.min(1.06, Math.min(width / 680, height / 330)));
    for (const cellId of Visuals.visibleBackgroundCells(layer, worldPosition, ppm, width)) {
      const appearance = Visuals.backgroundAppearance(layer, cellId, level.number * 29);
      if (appearance.type === "empty") continue;
      const world = (cellId + appearance.offset) * config.spacing;
      const x = anchorX + (world - worldPosition) * ppm * config.parallax;
      const ground = baseY + Visuals.roadY(world, level, 0, ppm) - currentElevationY - (layer === "far" ? 25 : 7);
      if (layer === "far") drawFarLandmark(x, ground, appearance, size * .86);
      else drawRoadsideLandmark(x, ground, appearance, size);
    }
  }
  function drawFarLandmark(x, ground, appearance, size) {
    const wallColours = ["#9aa9b8", "#b0aaa1", "#90a9a0", "#aaa8a2"];
    const roofColours = ["#7c5f52", "#64748b", "#6b7280", "#78716c"];
    const width = appearance.width * size, height = appearance.height * size;
    ctx.save(); ctx.translate(x, ground);
    if (appearance.type === "treeCluster") {
      ctx.fillStyle = "#6f855d";
      [[-.28, -.56, .34], [.05, -.7, .4], [.32, -.53, .31]].forEach(([dx, dy, radius]) => {
        ctx.beginPath(); ctx.arc(dx * width, dy * height, radius * height, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "#765846"; ctx.fillRect(-2 * size, -height * .5, 4 * size, height * .5); ctx.restore(); return;
    }
    ctx.fillStyle = wallColours[appearance.variant]; ctx.fillRect(-width / 2, -height, width, height);
    ctx.fillStyle = roofColours[appearance.variant];
    if (appearance.type === "house") {
      ctx.beginPath(); ctx.moveTo(-width * .58, -height); ctx.lineTo(0, -height - 16 * size); ctx.lineTo(width * .58, -height); ctx.closePath(); ctx.fill();
    } else ctx.fillRect(-width * .54, -height - 5 * size, width * 1.08, 5 * size);
    if (appearance.type === "shop") {
      ctx.fillStyle = ["#d97706", "#0f766e", "#2563eb", "#9f1239"][appearance.variant];
      ctx.fillRect(-width * .46, -height * .74, width * .92, 9 * size);
    }
    ctx.fillStyle = "#dce8e8";
    const rows = appearance.type === "apartment" ? Math.max(2, Math.floor(height / (18 * size))) : 1;
    const columns = appearance.type === "house" ? 2 : 3;
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      const wx = -width * .32 + column * width * .32;
      const wy = -height + 11 * size + row * 17 * size;
      if (wy + 7 * size < -3 * size) ctx.fillRect(wx - 3 * size, wy, 6 * size, 7 * size);
    }
    ctx.fillStyle = "#5b4636"; ctx.fillRect(-4 * size, -14 * size, 8 * size, 14 * size); ctx.restore();
  }
  function drawRoadsideLandmark(x, ground, appearance, size) {
    const greens = ["#3f6f49", "#4f7c45", "#386641", "#52734d"];
    const width = appearance.width * size, height = appearance.height * size;
    ctx.save(); ctx.translate(x, ground);
    if (["tree", "treeShrubs"].includes(appearance.type)) {
      ctx.fillStyle = "#76513e"; ctx.fillRect(-3 * size, -height * .58, 6 * size, height * .58);
      ctx.fillStyle = greens[appearance.variant];
      [[0, -.74, .28], [-.18, -.58, .22], [.2, -.57, .23]].forEach(([dx, dy, radius]) => {
        ctx.beginPath(); ctx.arc(dx * width, dy * height, radius * height, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (["shrubs", "treeShrubs"].includes(appearance.type)) {
      ctx.fillStyle = greens[(appearance.variant + 1) % greens.length];
      [-.32, 0, .32].forEach((offset, index) => {
        ctx.beginPath(); ctx.arc(offset * width, -height * (.12 + index % 2 * .04), height * .2, 0, Math.PI * 2); ctx.fill();
      });
    } else if (appearance.type === "lamp") {
      ctx.strokeStyle = "#475569"; ctx.lineWidth = 3.5 * size; ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -height); ctx.quadraticCurveTo(0, -height - 7 * size, 9 * size, -height - 7 * size); ctx.stroke();
      ctx.fillStyle = "#fef3c7"; ctx.beginPath(); ctx.ellipse(12 * size, -height - 5 * size, 7 * size, 4 * size, 0, 0, Math.PI * 2); ctx.fill();
    } else if (appearance.type === "sign") {
      ctx.fillStyle = "#64748b"; ctx.fillRect(-2 * size, -height * .7, 4 * size, height * .7);
      ctx.fillStyle = ["#2563eb", "#047857", "#b45309", "#7c3aed"][appearance.variant];
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2 * size;
      ctx.fillRect(-width / 2, -height, width, height * .42); ctx.strokeRect(-width / 2, -height, width, height * .42);
    }
    ctx.restore();
  }
  function drawCar(x, y, scale, slopeDeg, wheelAngle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-slopeDeg * Math.PI / 180); ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(15,23,42,.2)"; ctx.beginPath(); ctx.ellipse(3, 1, 72, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e4554f"; ctx.strokeStyle = "#8f2d32"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-64, -18); ctx.lineTo(-63, -37); ctx.quadraticCurveTo(-61, -46, -52, -48);
    ctx.lineTo(-28, -51); ctx.lineTo(-16, -68); ctx.quadraticCurveTo(-12, -73, -5, -73);
    ctx.lineTo(20, -73); ctx.quadraticCurveTo(27, -72, 32, -66); ctx.lineTo(44, -50);
    ctx.lineTo(59, -47); ctx.quadraticCurveTo(70, -44, 75, -34); ctx.lineTo(79, -24);
    ctx.quadraticCurveTo(80, -18, 72, -16); ctx.lineTo(-57, -16); ctx.quadraticCurveTo(-64, -16, -64, -18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#bfdbfe"; ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -67); ctx.lineTo(-23, -52); ctx.lineTo(3, -52); ctx.lineTo(3, -67); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -67); ctx.lineTo(20, -67); ctx.lineTo(37, -51); ctx.lineTo(10, -51); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#8f2d32"; ctx.beginPath(); ctx.moveTo(7, -50); ctx.lineTo(7, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44, -49); ctx.quadraticCurveTo(58, -47, 68, -41); ctx.stroke();
    ctx.fillStyle = "#fef3c7"; ctx.strokeStyle = "#92400e"; ctx.beginPath();
    ctx.moveTo(66, -41); ctx.lineTo(75, -36); ctx.lineTo(77, -29); ctx.lineTo(66, -31); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#7f1d1d"; ctx.fillRect(-64, -37, 6, 11);
    ctx.fillStyle = "#374151"; ctx.fillRect(73, -23, 10, 7); ctx.fillRect(-67, -21, 8, 5);
    ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 1.5;
    [-1, 1].forEach((offset) => {
      ctx.beginPath(); ctx.moveTo(73, -27 + offset * 3); ctx.lineTo(79, -27 + offset * 3); ctx.stroke();
    });
    [-38, 43].forEach((wheelX) => {
      ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.arc(wheelX, -14, 15, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(wheelX, -14); ctx.rotate(wheelAngle);
      ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke(); ctx.restore();
      ctx.fillStyle = "#d1d5db"; ctx.beginPath(); ctx.arc(wheelX, -14, 5, 0, Math.PI * 2); ctx.fill();
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
  function drawRoadBoundary(x, y, roadDepth) {
    ctx.save();
    ctx.lineCap = "butt";
    ctx.strokeStyle = "rgba(15,23,42,.72)";
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + roadDepth - 2); ctx.stroke();
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + roadDepth - 2); ctx.stroke();
    ctx.restore();
  }
  function drawGraph() {
    const hidden = state.graphMode === "hidden" || state.phase === "review" || state.phase === "submitted";
    elements.graphCard.classList.toggle("is-hidden", hidden);
    if (hidden) return;
    const width = graphView.width, height = graphView.height;
    graphCtx.clearRect(0, 0, width, height);
    graphCtx.fillStyle = "rgba(255,255,255,.94)"; graphCtx.fillRect(0, 0, width, height);
    const rect = { x: 27, y: 20, width: Math.max(20, width - 49), height: Math.max(20, height - 42) };
    graphCtx.strokeStyle = "#94a3b8"; graphCtx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const x = rect.x + rect.width * i / 5;
      graphCtx.beginPath(); graphCtx.moveTo(x, rect.y); graphCtx.lineTo(x, rect.y + rect.height); graphCtx.stroke();
      const y = rect.y + rect.height * i / 5;
      graphCtx.beginPath(); graphCtx.moveTo(rect.x, y); graphCtx.lineTo(rect.x + rect.width, y); graphCtx.stroke();
    }
    graphCtx.strokeStyle = "#334155"; graphCtx.lineWidth = 1.8; graphCtx.lineCap = "round";
    graphCtx.beginPath();
    graphCtx.moveTo(rect.x, rect.y + rect.height); graphCtx.lineTo(rect.x, rect.y);
    graphCtx.moveTo(rect.x - 4, rect.y + 7); graphCtx.lineTo(rect.x, rect.y); graphCtx.lineTo(rect.x + 4, rect.y + 7);
    graphCtx.moveTo(rect.x, rect.y + rect.height); graphCtx.lineTo(rect.x + rect.width, rect.y + rect.height);
    graphCtx.moveTo(rect.x + rect.width - 7, rect.y + rect.height - 4);
    graphCtx.lineTo(rect.x + rect.width, rect.y + rect.height);
    graphCtx.lineTo(rect.x + rect.width - 7, rect.y + rect.height + 4);
    graphCtx.stroke();
    const allSamples = graphSamples();
    const cursorSample = displaySample();
    const partialSamples = (state.phase === "graph-check" || state.phase === "level" && state.variant.endsWith("analysis"))
      ? allSamples.filter((sample) => sample.t <= cursorSample.t + 1e-9)
      : allSamples;
    const zone = graphZone();
    const windowed = Visuals.graphWindow(partialSamples, cursorSample.t, zone?.graphTimeSpan);
    const graphDomain = { ...zone, graphTimeSpan: windowed.duration };
    const points = Visuals.graphPoints(windowed.samples, state.graphMode, rect, graphDomain, windowed.startTime);
    graphCtx.strokeStyle = "#1d4ed8"; graphCtx.lineWidth = 3; graphCtx.lineJoin = "round"; graphCtx.lineCap = "round"; graphCtx.beginPath();
    points.forEach((point, index) => index ? graphCtx.lineTo(point.x, point.y) : graphCtx.moveTo(point.x, point.y)); graphCtx.stroke();
    const cursor = points[points.length - 1];
    if (cursor && (state.phase === "graph-check" || state.phase === "level" && state.variant.endsWith("analysis"))) {
      graphCtx.strokeStyle = "#f59e0b"; graphCtx.lineWidth = 1.5;
      graphCtx.beginPath(); graphCtx.moveTo(cursor.x, rect.y); graphCtx.lineTo(cursor.x, rect.y + rect.height); graphCtx.stroke();
      graphCtx.fillStyle = "#f59e0b"; graphCtx.beginPath(); graphCtx.arc(cursor.x, cursor.y, 3.5, 0, Math.PI * 2); graphCtx.fill();
    }
    graphCtx.save();
    graphCtx.fillStyle = "#1e293b";
    graphCtx.font = "italic 18px 'STIX Two Math', 'Cambria Math', 'Times New Roman', serif";
    graphCtx.textAlign = "center";
    graphCtx.textBaseline = "middle";
    graphCtx.fillText("t", rect.x + rect.width + 9, rect.y + rect.height + 10);
    graphCtx.fillText(state.graphMode === "xt" ? "x" : "v", rect.x - 10, rect.y - 8);
    graphCtx.restore();
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
        elements.stageTarget.textContent = Visuals.stageTargetLabel(currentLevel(), activeSampleSegment());
        draw();
      }
    }
    frameId = requestAnimationFrame(animate);
  }
  function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value ?? ""); return span.innerHTML; }
  function physicsHtml(value) {
    return escapeHtml(value).replace(/([xv])–t/g, (_, symbol) =>
      `<span class="math-expression"><var>${symbol}</var><span class="math-operator">−</span><var>t</var></span>`
    );
  }
  function formatPoint(value) { return Number(value).toFixed(value % 1 ? 1 : 0); }
  function wirePedal(button, kind) {
    const intensityAt = (clientX) => {
      const rect = button.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(.999999, (clientX - rect.left) / Math.max(1, rect.width)));
      return Math.floor(fraction * 3) + 1;
    };
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (activePedal) return;
      button.setPointerCapture?.(event.pointerId);
      beginPedal(kind, event.pointerId, intensityAt(event.clientX));
      event.preventDefault();
    });
    button.addEventListener("pointermove", (event) => {
      if (activePedal !== kind || activePointer !== event.pointerId) return;
      changePedalIntensity(kind, event.pointerId, intensityAt(event.clientX));
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
  elements.levelPicker.addEventListener("click", (event) => {
    if (locked) return;
    const levelId = event.target.closest("[data-pick-level]")?.dataset.pickLevel;
    if (levelId && Levels.levelById(levelId)) enterLevel(levelId);
  });
  elements.reviewProgressButton.addEventListener("click", () => { if (!locked) enterReview(); });
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
    if (locked) return;
    const levelId = event.target.closest("[data-edit-level]")?.dataset.editLevel;
    if (levelId && UiPolicy.canOpenReviewItem(state, levelId, locked)) enterLevel(levelId, Boolean(state.selectedRuns[levelId]));
    if (event.target.closest("[data-edit-checkpoint]") && UiPolicy.canOpenReviewItem(state, "checkpoint", locked)) enterCheckpoint(true);
  });
  elements.analysisZoneTabs.addEventListener("click", (event) => {
    if (locked) return;
    const zoneId = event.target.closest("[data-analysis-zone]")?.dataset.analysisZone;
    if (!zoneId || !analysisRun?.zones.some((zone) => zone.zoneId === zoneId)) return;
    analysisZoneId = zoneId;
    elements.scrubRange.value = "100";
    render();
  });
  window.addEventListener("keydown", (event) => {
    if (!UiPolicy.shouldHandleGlobalShortcut(event.target) && !event.target.closest?.(".pedal")) return;
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    const throttleIntensity = key === "q" ? 1 : key === "w" || event.key === "ArrowUp" ? 2 : key === "e" ? 3 : 0;
    const brakeIntensity = key === "a" ? 1 : key === "s" || event.key === "ArrowDown" ? 2 : key === "d" ? 3 : 0;
    if (throttleIntensity) { beginPedal("throttle", `key:${event.code}`, throttleIntensity); event.preventDefault(); }
    else if (brakeIntensity) { beginPedal("brake", `key:${event.code}`, brakeIntensity); event.preventDefault(); }
    else if (event.code === "Space") { running ? pauseRun() : startRun(); event.preventDefault(); }
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (["q", "w", "e"].includes(key) || event.key === "ArrowUp") releasePedal("throttle", `key:${event.code}`);
    if (["a", "s", "d"].includes(key) || event.key === "ArrowDown") releasePedal("brake", `key:${event.code}`);
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
