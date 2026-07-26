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
  const resultGraphInputs = Array.from(document.querySelectorAll("input[name=resultGraphMode]"));
  const answerInputs = Array.from(document.querySelectorAll("input[name=checkpointAnswer]"));
  const canvas = elements.drivingCanvas;
  const ctx = canvas.getContext("2d");
  const graphCtx = elements.graphCanvas.getContext("2d");
  const checkpointXtCtx = elements.checkpointXtCanvas.getContext("2d");
  const checkpointVtCtx = elements.checkpointVtCanvas.getContext("2d");
  const CHECKPOINT_ANSWER_LABELS = Object.freeze({
    "vt-linear": "v–t 圖，因為勻變速時會形成斜率固定的直線",
    "xt-curvature": "x–t 圖，因為彎曲程度可以直接當作加速度讀數",
    "both-any": "兩幅圖一樣直接，只要圖線不是水平便足夠",
    "xt-fixed-slope": "x–t 圖，因為斜率固定代表加速度固定"
  });

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
  let pendingExpected = null;
  let technicalState = false;
  let resultReviewLevelId = null;
  let resultReviewZoneId = null;
  let resultReviewGraphMode = "vt";
  let stageView = { width: 800, height: 430, dpr: 1 };
  let graphView = { width: 220, height: 150, dpr: 1 };
  let checkpointXtView = { width: 220, height: 150, dpr: 1 };
  let checkpointVtView = { width: 220, height: 150, dpr: 1 };
  let liveLast = "";

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function currentLevel() {
    if (state?.phase === "practice") return Levels.PRACTICE;
    if (state?.phase === "level") return Levels.levelById(state.currentItem);
    if (state?.phase === "graph-check") return Levels.levelById(state.graphCheckpoint.sourceLevelId);
    if (state?.phase === "submitted" && resultReviewLevelId) return Levels.levelById(resultReviewLevelId);
    return Levels.levelById("level1");
  }
  function activeGraphMode() {
    return state?.phase === "submitted" && trustedResultReviewAvailable() ? resultReviewGraphMode : state?.graphMode || "vt";
  }
  function announce(text) {
    if (!text || text === liveLast) return;
    liveLast = text;
    elements.liveRegion.textContent = "";
    requestAnimationFrame(() => { elements.liveRegion.textContent = text; });
  }
  function focusHeading(element) {
    requestAnimationFrame(() => {
      elements.controlPanel.scrollTop = 0;
      element?.focus({ preventScroll: true });
    });
  }
  function candidateCodes() { return state?.candidateRun?.codes || []; }
  function selectedScore(id) {
    const selected = state.selectedRuns[id];
    return selected ? Scoring.scoreRun(Levels.levelById(id), selected.codes) : null;
  }
  function checkpointEligible(id) {
    const selected = state?.selectedRuns?.[id];
    return Boolean(selected && Scoring.checkpointEligible(id, selected.codes));
  }
  function draftSnapshot(settleRuntime = false) {
    if (settleRuntime) settleDraftRuntime(performance.now());
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
  function stopAnimationLoop() {
    if (!frameId) return;
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  function ensureAnimationLoop() {
    if (frameId || !running || locked) return;
    frameId = requestAnimationFrame(animate);
  }
  function neutralize() {
    running = false;
    stopAnimationLoop();
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
  function advanceCompleteTicks(limit) {
    let processed = 0;
    while (accumulator + 1e-9 >= Model.TICK_S && processed < limit && running) {
      tickWallCursor += Model.TICK_S * 1000;
      const consumed = Model.consumeInputTransitions(inputQueue, tickWallCursor, appliedCode);
      appliedCode = consumed.code;
      inputQueue = consumed.remaining;
      state.candidateRun.codes.push(appliedCode);
      runtimeRun = Model.replay(currentLevel(), state.candidateRun.codes);
      accumulator -= Model.TICK_S;
      processed += 1;
      if (!runtimeRun || runtimeRun.state.terminal) {
        return { processed, terminal: true, backlog: false };
      }
    }
    return {
      processed,
      terminal: false,
      backlog: running && processed === limit && accumulator + 1e-9 >= Model.TICK_S
    };
  }
  function transitionTerminalRun() {
    neutralize();
    if (!runtimeRun || !Model.isTerminalRun(currentLevel(), candidateCodes())) return null;
    analysisRun = Scoring.scoreRun(currentLevel(), candidateCodes());
    if (!analysisRun) return null;
    if (state.phase === "practice") {
      state.candidateRun = null;
      state.variant = "ready";
      rebuildRuntime();
      return "practice";
    }
    state.variant = state.returnToReview ? "review-retry-analysis" : "analysis";
    analysisZoneId = analysisRun.zones[0]?.zoneId || null;
    return "level";
  }
  function settleDraftRuntime(now) {
    if (!running || locked) return;
    accumulator += Math.max(0, (now - lastFrame) / 1000);
    lastFrame = now;
    const advancement = advanceCompleteTicks(8);
    if (advancement.terminal) {
      if (!transitionTerminalRun()) throw new Error("Terminal run could not be normalized for draft save");
      return;
    }
    // A page exit cannot preserve an in-progress pointer gesture or a partial
    // physics tick. Persist only the complete ticks processed above, paused in
    // neutral, and deliberately discard any remaining wall-clock backlog.
    neutralize();
  }
  function pauseForLifecycleInterruption() {
    if (!running || locked) return;
    try {
      settleDraftRuntime(performance.now());
      if (saveDraft(true)) {
        announce("試車狀態已安全保存；踏板已回到空檔。");
        render();
      }
    } catch (error) {
      console.warn(error);
      neutralize();
      showTechnical("未能在頁面暫停時保存完整物理狀態；操作已鎖定。", false);
    }
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
    ensureAnimationLoop();
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
    const outcome = transitionTerminalRun();
    if (!outcome) {
      return showTechnical("物理模擬未能產生可驗證的完整試車；操作已鎖定。", false);
    }
    if (outcome === "practice") {
      saveAndRender("練習試車已完結，可以重新練習或開始正式關卡。");
      return;
    }
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
  function abandonUncommittedSubmissionRetry() {
    if (retryMode !== "submit") return;
    retryMode = "none";
    pendingExpected = null;
    elements.submissionRetryButton.classList.add("is-hidden");
  }
  function enterLevel(id, reviewRetry = false) {
    abandonUncommittedSubmissionRetry();
    neutralize();
    state.phase = "level"; state.currentItem = id; state.returnToReview = reviewRetry;
    state.variant = reviewRetry ? "review-retry-briefing" : "briefing";
    state.candidateRun = null; analysisRun = null; rebuildRuntime();
    analysisZoneId = null;
    saveAndRender(reviewRetry ? "可重新挑戰；原有記錄會保留至你確認新表現。" : `已進入第 ${Levels.levelById(id).number} 關。`);
    focusHeading(elements.panelTitle);
  }
  function enterCheckpoint(fromReview) {
    abandonUncommittedSubmissionRetry();
    neutralize();
    const source = [state.graphCheckpoint.sourceLevelId, "level2", "level3"]
      .find((id) => checkpointEligible(id));
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
    elements.checkpointScrubRange.value = "100";
    saveAndRender("請查看同一段試車的兩幅圖。");
    focusHeading(elements.checkpointTitle);
  }
  function viewCheckpoint(mode) {
    if (locked || state.phase !== "graph-check") return;
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
    if (state.phase !== "level" || !state.selectedRuns[state.currentItem]) return;
    const returning = state.returnToReview;
    state.candidateRun = null; analysisRun = null;
    if (returning) return enterReview();
    state.variant = "accepted";
    rebuildRuntime();
    saveAndRender("已保留本關原有記錄。");
    focusHeading(elements.panelTitle);
  }
  function scoreForReview() { return Persistence.allComplete(state) ? Scoring.scoreActivity(state.selectedRuns, state.graphCheckpoint) : null; }
  function sameResult(left, right) {
    return Boolean(left && right &&
      Number.isFinite(left.score) && Number.isFinite(right.score) &&
      Number.isFinite(left.maxScore) && Number.isFinite(right.maxScore) &&
      typeof left.passed === "boolean" && typeof right.passed === "boolean" &&
      left.score === right.score && left.maxScore === right.maxScore && left.passed === right.passed);
  }
  function sameReviewState(left, right) {
    try {
      return Boolean(left && right &&
        JSON.stringify(Persistence.encode(left)) === JSON.stringify(Persistence.encode(right)));
    } catch {
      return false;
    }
  }
  function validatePendingSnapshot(snapshot) {
    try {
      const payload = snapshot?.payload;
      const exactKeys = (value, expected) => Boolean(value && typeof value === "object" &&
        Object.keys(value).length === expected.length &&
        expected.every((key) => Object.prototype.hasOwnProperty.call(value, key)));
      if (!exactKeys(snapshot, ["version", "activity", "kind", "payload"]) ||
          !exactKeys(payload, ["reviewJson", "score", "maxScore", "passed"]) ||
          window.SimScorm.snapshotBytes(snapshot) > 4000 ||
          typeof payload.reviewJson !== "string") return null;
      const reviewSnapshot = JSON.parse(payload.reviewJson);
      if (reviewSnapshot?.version !== 1 || reviewSnapshot.activity !== ACTIVITY || reviewSnapshot.kind !== "review") return null;
      const reviewState = Persistence.decodeReview(reviewSnapshot.answer);
      const computed = reviewState ? Scoring.scoreActivity(reviewState.selectedRuns, reviewState.graphCheckpoint) : null;
      const canonicalReview = reviewState && computed
        ? window.SimScorm.makeSnapshot(ACTIVITY, "review", Persistence.makeReview(reviewState), computed)
        : null;
      if (!canonicalReview || payload.reviewJson !== JSON.stringify(canonicalReview)) return null;
      const payloadResult = {
        score: payload.score,
        maxScore: payload.maxScore,
        passed: payload.passed
      };
      const savedResult = {
        score: reviewSnapshot.score,
        maxScore: computed?.maxScore,
        passed: reviewSnapshot.passed
      };
      return sameResult(computed, payloadResult) && sameResult(computed, savedResult)
        ? { reviewState, computed }
        : null;
    } catch {
      return null;
    }
  }
  function submitAll() {
    if (locked || state.phase !== "review" || state.variant !== "complete") return;
    let computed, reviewAnswer, snapshot;
    try {
      computed = scoreForReview();
      reviewAnswer = Persistence.makeReview(state);
      snapshot = window.SimScorm.makeSnapshot(ACTIVITY, "review", reviewAnswer, computed);
      pendingExpected = { reviewState: Persistence.decodeReview(reviewAnswer), computed };
      if (!pendingExpected.reviewState) throw new Error("Final review failed local validation");
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
        const message = failure.retryable ? "未能確認提交，記錄仍可重試。" : "提交前檢查失敗；目前操作已鎖定。";
        elements.submissionNotice.textContent = message;
        elements.submissionNotice.classList.remove("is-hidden");
        elements.submissionRetryButton.classList.toggle("is-hidden", !failure.retryable);
        announce(message);
        focusHeading(elements.submissionNotice);
      }
    });
    window.SimScorm.submitWithCallbacks(computed, snapshot, { onSuccess: handle, onFailure: handle });
  }
  function retrySubmission() {
    if (retryMode === "finish") {
      const result = submittedResult || pendingExpected?.computed;
      if (!result) return showTechnical("找不到可完成的提交記錄，請重新開啟活動。", false);
      if (window.SimScorm.finish()) {
        showSubmitted(result, true);
        announce("答案已提交，Moodle 工作階段已完成。");
      } else {
        showSubmitted(result, true, "成績已保存，但仍未能完成 Moodle 工作階段。");
      }
      return;
    }
    if (retryMode === "submit") { locked = false; return submitAll(); }
    if (retryMode !== "pending") return;
    const outcome = window.SimScorm.retryPending();
    if (outcome.committed) {
      const reviewState = outcome.review?.activity === ACTIVITY && outcome.review?.kind === "review" && outcome.review.answer
        ? Persistence.decodeReview(outcome.review.answer)
        : null;
      const computed = reviewState ? Scoring.scoreActivity(reviewState.selectedRuns, reviewState.graphCheckpoint) : submittedResult;
      const recorded = {
        score: outcome.score,
        maxScore: computed?.maxScore,
        passed: outcome.status === "passed" ? true : outcome.status === "failed" ? false : null
      };
      if (!computed || !sameResult(computed, recorded) ||
          pendingExpected && (!sameResult(computed, pendingExpected.computed) ||
            !sameReviewState(reviewState, pendingExpected.reviewState))) {
        return showTechnical("提交資料與駕駛記錄不一致，無法安全顯示結果。", false);
      }
      state = reviewState;
      pendingExpected = { reviewState, computed };
      showSubmitted(computed, true, outcome.finished ? "" : "成績已寫入，但 Moodle 尚未完成離開程序。");
    } else showTechnical("仍未能確認提交；駕駛記錄保持凍結。", Boolean(outcome.retryable));
  }
  function trustedResultReviewAvailable() {
    return Boolean(
      trustedReview &&
      state?.phase === "submitted" &&
      submittedResult?.levelResults?.length === Levels.LEVELS.length &&
      Levels.levelById(resultReviewLevelId) &&
      state.selectedRuns?.[resultReviewLevelId]
    );
  }
  function resetResultReview() {
    resultReviewLevelId = trustedReview && state?.phase === "submitted"
      ? Levels.LEVELS.find((level) => state.selectedRuns?.[level.id])?.id || null
      : null;
    resultReviewZoneId = resultReviewLevelId ? Levels.scoredZones(Levels.levelById(resultReviewLevelId))[0]?.id || null : null;
    resultReviewGraphMode = "vt";
    elements.resultScrubRange.value = "100";
  }
  function selectedResultLevelScore() {
    return submittedResult?.levelResults?.find((result) => result.levelId === resultReviewLevelId) || null;
  }
  function selectedResultZone() {
    return Levels.scoredZones(currentLevel()).find((zone) => zone.id === resultReviewZoneId) ||
      Levels.scoredZones(currentLevel())[0] || null;
  }
  function renderResultReviewTools() {
    const available = trustedResultReviewAvailable();
    elements.resultReviewTools.classList.toggle("is-hidden", !available);
    if (!available) return;
    const level = currentLevel();
    const zones = Levels.scoredZones(level);
    if (!zones.some((zone) => zone.id === resultReviewZoneId)) resultReviewZoneId = zones[0]?.id || null;
    elements.resultRunPicker.innerHTML = Levels.LEVELS.map((item) =>
      `<button type="button" data-result-level="${item.id}" aria-pressed="${item.id === resultReviewLevelId}" title="${escapeHtml(item.title)}">第 ${item.number} 關</button>`
    ).join("");
    elements.resultZoneTabs.innerHTML = zones.map((zone, index) =>
      `<button type="button" data-result-zone="${zone.id}" aria-pressed="${zone.id === resultReviewZoneId}">路段 ${index + 1}：${escapeHtml(Visuals.targetLabel(zone.target))}</button>`
    ).join("");
    resultGraphInputs.forEach((input) => { input.checked = input.value === resultReviewGraphMode; });
    const result = selectedResultLevelScore();
    const zoneResult = result?.zones.find((zone) => zone.zoneId === resultReviewZoneId);
    elements.resultReplayStatus.textContent = zoneResult
      ? `第 ${level.number} 關・${Visuals.targetLabel(zoneResult.target)}：${formatPoint(zoneResult.points)} / ${zoneResult.maxPoints}；只讀回放。`
      : `第 ${level.number} 關只讀回放。`;
    elements.stageKicker.textContent = `第 ${level.number} 關・只讀回放`;
    elements.stageTarget.textContent = Visuals.stageTargetLabel(level, selectedResultZone());
    elements.stageStatus.textContent = zoneResult ? Scoring.feedbackText(zoneResult) : "拖動游標查看已提交的試車記錄。";
  }
  function showSubmitted(result, trusted, notice = "") {
    technicalState = false;
    submittedResult = result; trustedReview = trusted; retryMode = notice ? "finish" : "none";
    locked = true; neutralize();
    if (state) { state.phase = "submitted"; state.variant = "locked"; state.currentItem = "review"; state.returnToReview = false; state.candidateRun = null; }
    resetResultReview();
    renderResult(notice);
    focusHeading(elements.resultTitle);
    announce(notice || `答案已提交；得分 ${result.score} 分。`);
  }
  function showTechnical(message, canRetry) {
    technicalState = true;
    locked = true; neutralize();
    elements.activitySection.classList.add("is-hidden");
    elements.checkpointSection.classList.add("is-hidden");
    elements.reviewSection.classList.add("is-hidden");
    elements.resultSection.classList.remove("is-hidden");
    elements.resultTitle.textContent = "技術狀態";
    elements.scorePanel.textContent = "--　未能安全判斷提交或合格狀態";
    elements.feedbackList.innerHTML = `<article class="feedback-item"><p>${escapeHtml(message)}</p></article>`;
    elements.resultRetryButton.classList.toggle("is-hidden", !canRetry);
    elements.stageKicker.textContent = "技術狀態";
    elements.stageTarget.textContent = "操作已鎖定";
    elements.stageStatus.textContent = "活動資料未能安全確認；駕駛操作不可用。";
    elements.resultReviewTools.classList.add("is-hidden");
    elements.graphCard.classList.add("is-hidden");
    announce(message);
    focusHeading(elements.resultTitle);
  }
  function restoreFinished(attempt) {
    technicalState = false;
    locked = true;
    const review = Persistence.decodeReview(attempt.snapshot?.answer);
    if (!review) {
      state = Persistence.initialState();
      const recorded = window.SimActivityFlow.recordedResult(attempt);
      submittedResult = { ...recorded, maxScore: 100, levelResults: [] };
      trustedReview = false;
      resetResultReview();
      renderResult("Moodle 已記錄完成，但詳細駕駛記錄無法安全還原。");
      focusHeading(elements.resultTitle);
      return;
    }
    state = review;
    const computed = Scoring.scoreActivity(review.selectedRuns, review.graphCheckpoint);
    const outcome = UiPolicy.reviewOutcome(computed, { score: attempt.snapshot.score, passed: attempt.snapshot.passed }, attempt);
    submittedResult = outcome.result; trustedReview = outcome.trusted;
    resetResultReview();
    renderResult(outcome.trusted ? "" : "記錄與 Moodle 結果不一致，只顯示可信的 Moodle 摘要。");
    focusHeading(elements.resultTitle);
  }
  function renderResult(notice = "") {
    elements.activitySection.classList.add("is-hidden");
    elements.checkpointSection.classList.add("is-hidden");
    elements.reviewSection.classList.add("is-hidden");
    elements.resultSection.classList.remove("is-hidden");
    elements.resultTitle.textContent = trustedReview ? "已提交：只讀檢討" : "已完成：安全摘要";
    elements.stageKicker.textContent = "提交結果";
    elements.stageTarget.textContent = trustedReview ? "只讀檢討" : "安全摘要";
    elements.stageStatus.textContent = trustedReview
      ? "提交記錄已鎖定；目前只供檢討。"
      : "詳細駕駛記錄未能驗證；只顯示 Moodle 安全摘要。";
    const label = window.SimActivityFlow.completionLabel(submittedResult?.passed ?? null);
    elements.scorePanel.textContent = `${submittedResult?.score ?? "--"} / 100　${label}`;
    const rows = [];
    if (notice) rows.push(`<article class="feedback-item"><p>${escapeHtml(notice)}</p></article>`);
    if (trustedReview && submittedResult?.levelResults) {
      submittedResult.levelResults.forEach((levelResult, index) => {
        const level = Levels.LEVELS[index];
        rows.push(`<article class="feedback-item ${levelResult.points >= levelResult.maxPoints * .7 ? "is-good" : ""}"><h3>${escapeHtml(level.title)}：${formatPoint(levelResult.points)} / ${levelResult.maxPoints}</h3>${levelResult.zones.map((zone) => `<p>${physicsHtml(Scoring.feedbackText(zone))}</p>`).join("")}</article>`);
      });
      const answerId = state.graphCheckpoint.answerId;
      const chosenAnswer = CHECKPOINT_ANSWER_LABELS[answerId] || "未能辨認";
      const answerOutcome = answerId === Scoring.CHECKPOINT_ANSWER ? "正確" : "未選中正確答案";
      rows.push(`<article class="feedback-item"><h3>圖像證據：${submittedResult.checkpointPoints} / 10</h3><p>${physicsHtml(`你的答案：${chosenAnswer}（${answerOutcome}）。`)}</p><p>${physicsHtml("正確解釋：勻速的 v–t 圖是水平直線；勻加速及勻減速分別是向上及向下直線。x–t 圖可以顯示速度正在改變，但 v–t 圖更直接顯示變化率是否固定。")}</p></article>`);
    }
    elements.feedbackList.innerHTML = rows.join("");
    elements.resultRetryButton.classList.toggle("is-hidden", retryMode === "none");
    renderResultReviewTools();
    renderProgress("review");
    draw();
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
    const replacing = Boolean(state.selectedRuns[state.currentItem]);
    elements.acceptButton.textContent = replacing ? "以今次表現取代原記錄" : "記錄今次表現";
    elements.keepPreviousButton.textContent = state.returnToReview ? "保留原有記錄並返回檢查" : "保留原有記錄";
    elements.keepPreviousButton.classList.toggle("is-hidden", !replacing);
  }
  function renderCheckpoint() {
    const checkpoint = state.graphCheckpoint;
    elements.stageKicker.textContent = "圖像證據";
    elements.stageTarget.innerHTML = physicsHtml("同步比較 x–t 與 v–t 圖");
    elements.checkpointAnswers.disabled = locked || !(checkpoint.viewedXt && checkpoint.viewedVt);
    elements.viewXtButton.disabled = locked;
    elements.viewVtButton.disabled = locked;
    elements.viewXtButton.setAttribute("aria-pressed", String(checkpoint.viewedXt));
    elements.viewVtButton.setAttribute("aria-pressed", String(checkpoint.viewedVt));
    elements.checkpointXtPlot.classList.toggle("is-viewed", checkpoint.viewedXt);
    elements.checkpointVtPlot.classList.toggle("is-viewed", checkpoint.viewedVt);
    elements.checkpointScrubRange.disabled = locked;
    elements.checkpointViewStatus.innerHTML = physicsHtml(`x–t：${checkpoint.viewedXt ? "已查看" : "未查看"}　v–t：${checkpoint.viewedVt ? "已查看" : "未查看"}`);
    answerInputs.forEach((input) => { input.checked = input.value === checkpoint.answerId; input.disabled = elements.checkpointAnswers.disabled; });
    elements.confirmCheckpointButton.textContent = "確認並返回關卡檢查";
    elements.confirmCheckpointButton.disabled = locked;
    elements.stageStatus.textContent = "拖動同一個回放游標，可同步比較車輛、x–t 圖與 v–t 圖。";
  }
  function renderReview() {
    const complete = Persistence.allComplete(state);
    state.variant = complete ? "complete" : "incomplete";
    elements.reviewList.innerHTML = Levels.LEVELS.map((level) => {
      const result = selectedScore(level.id);
      const canOpen = UiPolicy.canOpenReviewItem(state, level.id, locked);
      return `<article class="review-item"><h3>${escapeHtml(level.title)}</h3><p>${result ? `${formatPoint(result.points)} / ${result.maxPoints}，已記錄` : "尚未記錄"}</p><button type="button" data-edit-level="${level.id}"${canOpen ? "" : " disabled"}>${result ? "重新挑戰" : "完成此關"}</button></article>`;
    }).join("") + (() => {
      const eligible = ["level2", "level3"].some((id) => checkpointEligible(id));
      const canOpen = UiPolicy.canOpenReviewItem(state, "checkpoint", locked) && eligible;
      const checkpointCopy = state.graphCheckpoint.answerId ? "已回答" : canOpen ? "尚未完成" :
        state.selectedRuns.level2 || state.selectedRuns.level3 ? "已記錄的試車未有足夠圖像證據" : "請先記錄第 2 或第 3 關";
      return `<article class="review-item"><h3>圖像證據 checkpoint</h3><p>${checkpointCopy}</p><button type="button" data-edit-checkpoint${canOpen ? "" : " disabled"}>查看或修改</button></article>`;
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
      const currentStep = index === currentIndex;
      const done = item.dataset.step.startsWith("level") ? Boolean(state?.selectedRuns?.[item.dataset.step]) :
        item.dataset.step === "checkpoint" ? Boolean(state?.graphCheckpoint?.answerId) : index < currentIndex;
      item.classList.toggle("is-current", currentStep);
      item.classList.toggle("is-done", done);
      item.setAttribute("aria-current", currentStep ? "step" : "false");
      item.setAttribute("aria-label", `${item.textContent.trim()}${currentStep ? "，目前步驟" : done ? "，已完成" : ""}`);
    });
  }
  function displayRun() {
    if (state.phase === "graph-check") {
      const selected = state.selectedRuns[state.graphCheckpoint.sourceLevelId];
      return Model.replay(currentLevel(), selected?.codes || []);
    }
    if (state.phase === "submitted" && trustedResultReviewAvailable()) {
      return Model.replay(currentLevel(), state.selectedRuns[resultReviewLevelId]?.codes || []);
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
      const fraction = Number(elements.checkpointScrubRange.value) / 100;
      return run.samples[Math.round((run.samples.length - 1) * fraction)];
    }
    if (state.phase === "submitted" && trustedResultReviewAvailable()) {
      const zone = selectedResultZone();
      const zoneRows = run.samples.filter((sample) => sample.x >= zone.start && sample.x <= zone.end);
      if (zoneRows.length) {
        const fraction = Number(elements.resultScrubRange.value) / 100;
        return zoneRows[Math.round((zoneRows.length - 1) * fraction)];
      }
    }
    return run.samples[run.samples.length - 1];
  }
  function activeSampleSegment() { return Levels.segmentAt(currentLevel(), displaySample()?.x || 0); }
  function graphZone() {
    if (state.phase === "level" && state.variant.endsWith("analysis")) {
      return Levels.scoredZones(currentLevel()).find((zone) => zone.id === analysisZoneId) || Levels.scoredZones(currentLevel())[0];
    }
    if (state.phase === "submitted" && trustedResultReviewAvailable()) return selectedResultZone();
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
    return run.samples.filter((sample) => sample.x >= segment.start && sample.x <= segment.end);
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
    checkpointXtView = resizeCanvas(elements.checkpointXtCanvas, checkpointXtCtx, elements.checkpointXtCanvas, checkpointXtView);
    checkpointVtView = resizeCanvas(elements.checkpointVtCanvas, checkpointVtCtx, elements.checkpointVtCanvas, checkpointVtView);
    draw();
  }
  function draw() {
    if (!state) return;
    drawStage();
    drawGraph();
    drawCheckpointGraphs();
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
      const signPosition = segment.start;
      const x = Visuals.worldToScreen(signPosition, sample.x, anchorX, ppm);
      if (x < -80 || x > width + 80) return;
      const y = baseY + Visuals.roadY(signPosition, level, 0, ppm) - currentElevationY;
      drawRoadBoundary(x, y, roadDepth);
      drawTargetSign(x, y - 12, segment.target);
    });
    drawCar(anchorX, baseY + roadDepth * .55, Math.max(.78, Math.min(1.08, width / 720)), Visuals.visualSlopeAt(level, sample.x), Model.wheelAngle(sample.x));
    const graphAlternative = state.phase === "graph-check"
      ? `x–t ${Visuals.graphShapeLabel(graphSamples(), "xt")}；v–t ${Visuals.graphShapeLabel(graphSamples(), "vt")}；兩幅圖同步顯示`
      : activeGraphMode() === "hidden"
        ? "圖像已隱藏"
        : Visuals.graphShapeLabel(graphSamples(), activeGraphMode());
    if (elements.graphAlternative.textContent !== graphAlternative) {
      elements.graphAlternative.textContent = graphAlternative;
      if (running) announce(`圖像：${graphAlternative}`);
    }
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
  function drawCar(frontX, y, scale, slopeDeg, wheelAngle) {
    ctx.save(); ctx.translate(frontX, y); ctx.rotate(-slopeDeg * Math.PI / 180); ctx.scale(scale, scale); ctx.translate(-83, 0);
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
    const resultVisible = !elements.resultSection.classList.contains("is-hidden");
    const resultReview = trustedResultReviewAvailable();
    const mode = activeGraphMode();
    const hidden = technicalState || mode === "hidden" || state.phase === "graph-check" ||
      state.phase === "review" || state.phase === "submitted" && !resultReview ||
      resultVisible && !resultReview;
    elements.graphCard.classList.toggle("is-hidden", hidden);
    if (hidden) return;
    const allSamples = graphSamples();
    const cursorSample = displaySample();
    const scrubbed = state.phase === "level" && state.variant.endsWith("analysis") || resultReview;
    paintGraph(graphCtx, graphView, mode, allSamples, cursorSample, graphZone(), scrubbed);
  }
  function drawCheckpointGraphs() {
    if (state.phase !== "graph-check") return;
    const selected = state.selectedRuns[state.graphCheckpoint.sourceLevelId];
    const run = Model.replay(currentLevel(), selected?.codes || []);
    if (!run?.samples?.length) return;
    const cursorSample = displaySample();
    const level = currentLevel();
    const zone = {
      id: `${level.id}-checkpoint`,
      start: 0,
      end: level.routeLength,
      graphVelocitySpan: Levels.GRAPH_VELOCITY_SPAN,
      graphTimeSpan: Levels.GRAPH_TIME_SPAN_S
    };
    paintGraph(checkpointXtCtx, checkpointXtView, "xt", run.samples, cursorSample, zone, true);
    paintGraph(checkpointVtCtx, checkpointVtView, "vt", run.samples, cursorSample, zone, true);
    elements.checkpointXtCanvas.setAttribute(
      "aria-label",
      `同一試車記錄的位置對時間圖；${Visuals.graphShapeLabel(run.samples, "xt")}`
    );
    elements.checkpointVtCanvas.setAttribute(
      "aria-label",
      `同一試車記錄的速度對時間圖；${Visuals.graphShapeLabel(run.samples, "vt")}`
    );
  }
  function paintGraph(context, view, mode, allSamples, cursorSample, zone, scrubbed) {
    const width = view.width, height = view.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(255,255,255,.94)"; context.fillRect(0, 0, width, height);
    const rect = { x: 27, y: 20, width: Math.max(20, width - 49), height: Math.max(20, height - 42) };
    context.strokeStyle = "#94a3b8"; context.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const x = rect.x + rect.width * i / 5;
      context.beginPath(); context.moveTo(x, rect.y); context.lineTo(x, rect.y + rect.height); context.stroke();
      const y = rect.y + rect.height * i / 5;
      context.beginPath(); context.moveTo(rect.x, y); context.lineTo(rect.x + rect.width, y); context.stroke();
    }
    context.strokeStyle = "#334155"; context.lineWidth = 1.8; context.lineCap = "round";
    context.beginPath();
    context.moveTo(rect.x, rect.y + rect.height); context.lineTo(rect.x, rect.y);
    context.moveTo(rect.x - 4, rect.y + 7); context.lineTo(rect.x, rect.y); context.lineTo(rect.x + 4, rect.y + 7);
    context.moveTo(rect.x, rect.y + rect.height); context.lineTo(rect.x + rect.width, rect.y + rect.height);
    context.moveTo(rect.x + rect.width - 7, rect.y + rect.height - 4);
    context.lineTo(rect.x + rect.width, rect.y + rect.height);
    context.lineTo(rect.x + rect.width - 7, rect.y + rect.height + 4);
    context.stroke();
    const partialSamples = scrubbed
      ? allSamples.filter((sample) => sample.t <= cursorSample.t + 1e-9)
      : allSamples;
    const windowed = Visuals.graphWindow(partialSamples, cursorSample.t, zone?.graphTimeSpan);
    const graphDomain = { ...zone, graphTimeSpan: windowed.duration };
    const points = Visuals.graphPoints(windowed.samples, mode, rect, graphDomain, windowed.startTime);
    context.strokeStyle = "#1d4ed8"; context.lineWidth = 3; context.lineJoin = "round"; context.lineCap = "round"; context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke();
    const cursor = points[points.length - 1];
    if (cursor && scrubbed) {
      context.strokeStyle = "#f59e0b"; context.lineWidth = 1.5;
      context.beginPath(); context.moveTo(cursor.x, rect.y); context.lineTo(cursor.x, rect.y + rect.height); context.stroke();
      context.fillStyle = "#f59e0b"; context.beginPath(); context.arc(cursor.x, cursor.y, 3.5, 0, Math.PI * 2); context.fill();
    }
    context.save();
    context.fillStyle = "#1e293b";
    context.font = "italic 18px 'STIX Two Math', 'Cambria Math', 'Times New Roman', serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("t", rect.x + rect.width + 9, rect.y + rect.height + 10);
    context.fillText(mode === "xt" ? "x" : "v", rect.x - 10, rect.y - 8);
    context.restore();
  }
  function animate(now) {
    frameId = 0;
    const elapsed = Math.min(.5, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (running && !locked) {
      accumulator += elapsed;
      const advancement = advanceCompleteTicks(8);
      if (advancement.terminal) {
        finishRun();
        return;
      }
      if (advancement.backlog) {
        neutralize();
        announce("裝置暫時未能安全追上物理時間，試車已技術暫停。");
        if (saveDraft(true)) render();
      } else if (running && !locked) {
        elements.stageStatus.textContent = Model.qualitativeMotion(runtimeRun?.samples);
        elements.stageTarget.textContent = Visuals.stageTargetLabel(currentLevel(), activeSampleSegment());
        draw();
      }
    }
    ensureAnimationLoop();
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
    ["pointerup", "lostpointercapture"].forEach((type) => button.addEventListener(type, (event) => {
      releasePedal(kind, event.pointerId);
    }));
    button.addEventListener("pointercancel", (event) => {
      const interrupted = activePedal === kind && activePointer === event.pointerId;
      releasePedal(kind, event.pointerId);
      if (interrupted) announce("操作中斷；踏板已安全回到空檔。");
    });
  }
  wirePedal(elements.throttleButton, "throttle");
  wirePedal(elements.brakeButton, "brake");
  function wireRangeCapture(range) {
    range.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      range.setPointerCapture?.(event.pointerId);
    });
  }
  [elements.scrubRange, elements.checkpointScrubRange, elements.resultScrubRange].forEach(wireRangeCapture);
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
  elements.checkpointScrubRange.addEventListener("input", draw);
  graphInputs.forEach((input) => input.addEventListener("change", () => {
    if (locked || state.phase === "graph-check" || state.phase === "submitted") return;
    state.graphMode = input.value;
    render();
  }));
  elements.resultRunPicker.addEventListener("click", (event) => {
    if (!trustedResultReviewAvailable()) return;
    const levelId = event.target.closest("[data-result-level]")?.dataset.resultLevel;
    if (!Levels.levelById(levelId) || !state.selectedRuns[levelId]) return;
    resultReviewLevelId = levelId;
    resultReviewZoneId = Levels.scoredZones(Levels.levelById(levelId))[0]?.id || null;
    elements.resultScrubRange.value = "100";
    renderResultReviewTools();
    draw();
    requestAnimationFrame(() => {
      elements.resultRunPicker.querySelector(`[data-result-level="${levelId}"]`)?.focus({ preventScroll: true });
    });
  });
  elements.resultZoneTabs.addEventListener("click", (event) => {
    if (!trustedResultReviewAvailable()) return;
    const zoneId = event.target.closest("[data-result-zone]")?.dataset.resultZone;
    if (!Levels.scoredZones(currentLevel()).some((zone) => zone.id === zoneId)) return;
    resultReviewZoneId = zoneId;
    elements.resultScrubRange.value = "100";
    renderResultReviewTools();
    draw();
    requestAnimationFrame(() => {
      elements.resultZoneTabs.querySelector(`[data-result-zone="${zoneId}"]`)?.focus({ preventScroll: true });
    });
  });
  resultGraphInputs.forEach((input) => input.addEventListener("change", () => {
    if (!trustedResultReviewAvailable() || !["xt", "vt"].includes(input.value)) return;
    resultReviewGraphMode = input.value;
    draw();
  }));
  elements.resultScrubRange.addEventListener("input", () => {
    if (trustedResultReviewAvailable()) draw();
  });
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
  window.addEventListener("blur", pauseForLifecycleInterruption);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseForLifecycleInterruption();
  });
  let stageTouchY = null;
  elements.stage.addEventListener("touchstart", (event) => {
    if (event.isTrusted && event.touches.length === 1) stageTouchY = event.touches[0].clientY;
  }, { passive: true });
  elements.stage.addEventListener("touchmove", (event) => {
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
  elements.stage.addEventListener("touchend", () => { stageTouchY = null; }, { passive: true });
  elements.stage.addEventListener("touchcancel", () => { stageTouchY = null; }, { passive: true });
  let panelTouchY = null;
  elements.controlPanel.addEventListener("touchstart", (event) => {
    panelTouchY = event.isTrusted && event.touches.length === 1 ? event.touches[0].clientY : null;
  }, { passive: true });
  elements.controlPanel.addEventListener("touchmove", (event) => {
    if (panelTouchY == null || !event.isTrusted || event.touches.length !== 1) return;
    const nextY = event.touches[0].clientY;
    const deltaY = nextY - panelTouchY;
    const panel = elements.controlPanel;
    const maximum = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const blocksBoundary = maximum <= 1 ||
      (panel.scrollTop <= 1 && deltaY > 0) ||
      (panel.scrollTop >= maximum - 1 && deltaY < 0);
    if (blocksBoundary) event.preventDefault();
    panelTouchY = nextY;
  }, { passive: false });
  ["touchend", "touchcancel"].forEach((type) => elements.controlPanel.addEventListener(type, () => {
    panelTouchY = null;
  }, { passive: true }));
  new ResizeObserver(resize).observe(elements.stage);
  new ResizeObserver(resize).observe(elements.graphCard);
  new ResizeObserver(resize).observe(elements.checkpointXtCanvas);
  new ResizeObserver(resize).observe(elements.checkpointVtCanvas);

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
      window.SimScorm.setDraftProvider(() => draftSnapshot(true));
      if (attempt.state !== "new" || saveDraft(true)) render();
    } catch (error) { console.warn(error); state ||= Persistence.initialState(); showTechnical("未能安全載入活動草稿，操作已鎖定。", false); }
  } else if (mode === "pending") {
    state = Persistence.initialState();
    pendingExpected = validatePendingSnapshot(attempt.snapshot);
    if (pendingExpected) {
      retryMode = "pending";
      showTechnical(UiPolicy.technicalCopy("pending"), true);
    } else {
      window.SimScorm.quarantinePending();
      retryMode = "none";
      showTechnical("待確認的提交資料與駕駛記錄不一致，操作已鎖定。", false);
    }
  } else {
    state = Persistence.initialState();
    showTechnical(UiPolicy.technicalCopy("technical"), false);
  }
  resize();
  window.addEventListener("unload", stopAnimationLoop, { once: true });
})();
