(function () {
  "use strict";

  const Model = window.LinearMotionModel;
  const UiPolicy = window.LinearMotionUiPolicy;
  const Visuals = window.LinearMotionSceneVisuals;
  const Scoring = window.LinearMotionScoring;
  const Persistence = window.LinearMotionPersistence;
  if (!Model || !UiPolicy || !Visuals || !Scoring || !Persistence) throw new Error("Linear-motion modules were not loaded");

  const ACTIVITY = "linear-motion-velocity-lab";
  const canvas = document.getElementById("motionCanvas");
  const stage = document.querySelector(".motion-stage");
  const controlPanel = document.querySelector(".motion-panel");
  const context = canvas.getContext("2d");
  const elements = Object.fromEntries(Array.from(document.querySelectorAll("[id]")).map((element) => [element.id, element]));
  const progressItems = Array.from(document.querySelectorAll("[data-progress]"));
  const relationshipInputs = Array.from(document.querySelectorAll("input[name=relationship]"));
  const conceptInputs = Array.from(document.querySelectorAll("input[name=concept]"));
  const reducedMotionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
  if (!window.SimPanelScrollForwarding) throw new Error("Panel scroll forwarding module was not loaded");
  window.SimPanelScrollForwarding.attach({ surface: stage, panel: controlPanel });
  let reducedMotion = reducedMotionPreference?.matches === true;
  let state = null;
  let locked = false;
  let running = false;
  let timerRunning = false;
  let lastFrame = 0;
  let result = null;
  let trustedReview = true;
  let retryMode = "none";
  let lastMotionSegment = null;
  let frameId = 0;
  let activeWindowIndex = null;
  let instantDemoStartedAt = null;
  let instantDemoPaused = false;
  let instantDemoPausedElapsed = 0;
  let view = { width: 800, height: 500, dpr: 1 };

  function resetInstantDemo() {
    instantDemoStartedAt = null;
    instantDemoPaused = false;
    instantDemoPausedElapsed = 0;
  }
  function handleReducedMotionChange(event) {
    reducedMotion = event.matches === true;
    if (!reducedMotion && !instantDemoPaused) instantDemoStartedAt = performance.now();
    if (state?.phase === "instant" && !locked) { renderInstant(); draw(); }
  }
  if (typeof reducedMotionPreference?.addEventListener === "function") reducedMotionPreference.addEventListener("change", handleReducedMotionChange);
  else reducedMotionPreference?.addListener?.(handleReducedMotionChange);

  function announce(message) { elements.liveRegion.textContent = ""; requestAnimationFrame(() => { elements.liveRegion.textContent = message; }); }
  function focusContext(element) { requestAnimationFrame(() => element?.focus({ preventScroll: true })); }
  function quantityHtml(value, unit) { return `<span class="math-quantity"><span class="math-number">${Model.format3(value)}</span> <span class="unit">${unit}</span></span>`; }
  function setQuantityValue(element, value, unit, plainUnit = unit) {
    element.innerHTML = quantityHtml(value, unit);
    element.setAttribute("aria-label", `${Model.format3(value)} ${plainUnit}`);
  }
  function currentMeasurement() { return state.phase === "variable" ? state.variableMeasurement : state.uniformMeasurement; }
  function setCurrentMeasurement(value) { if (state.phase === "variable") state.variableMeasurement = value; else state.uniformMeasurement = value; }
  function positionAt(time = state.scene.simulationTime) {
    return state.phase === "variable" || state.phase === "instant"
      ? Model.variablePosition(state.definition.variable, time)
      : Model.uniformPosition(state.definition.uniform, time);
  }
  function displayedPositionAt(time = state.scene.simulationTime) {
    const worldPosition = positionAt(time);
    const measurement = ["uniform", "variable"].includes(state.phase) ? currentMeasurement() : null;
    return UiPolicy.displayedPosition(state.definition, state.phase, worldPosition, measurement);
  }
  function activeDuration() { return timerRunning && currentMeasurement() ? state.scene.simulationTime - currentMeasurement().startModelTime : currentMeasurement()?.dt || 0; }
  function minimumDuration() { return state.phase === "variable" ? state.definition.variableMinimumDuration : 1.5; }
  function updateActiveMeasurement() {
    const measurement = currentMeasurement();
    if (!measurement || measurement.x2 != null) return;
    measurement.currentOrEndModelTime = state.scene.simulationTime;
    measurement.dt = Model.canonicalNumber(Math.max(0, state.scene.simulationTime - measurement.startModelTime));
  }
  function draftSnapshot() {
    updateActiveMeasurement();
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode({ ...state, running, timerRunning }));
  }
  function saveDraft() {
    if (locked) return false;
    try {
      if (!window.SimScorm.saveDraft(draftSnapshot())) throw new Error("Draft save was rejected");
      return true;
    } catch (error) {
      locked = true;
      running = false;
      timerRunning = false;
      showTechnical("未能保存目前進度，活動已鎖定；請勿關閉頁面。", false);
      console.warn(error);
      return false;
    }
  }
  function saveTransition(candidate, fallback, message) {
    try {
      const snapshot = window.SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode({ ...candidate, running: false, timerRunning: false }));
      if (!window.SimScorm.saveDraft(snapshot)) throw new Error("Transition save was rejected");
      state = candidate;
      running = false;
      timerRunning = state.variant.endsWith("paused-measuring");
      if (fallback.phase !== "instant" && state.phase === "instant") { activeWindowIndex = null; resetInstantDemo(); }
      announce(message);
      render();
      focusContext(state.phase === "review" ? elements.reviewTitle : elements.stageTitle);
      return true;
    } catch (error) {
      state = fallback;
      locked = true;
      running = false;
      timerRunning = false;
      const wasLocked = locked; locked = false; render(); locked = wasLocked;
      document.querySelectorAll("#activitySection button, #activitySection input").forEach((control) => { control.disabled = true; });
      const target = state.phase === "instant" ? elements.instantError : elements.answerError;
      target.textContent = "未能保存答案及轉關；答案仍顯示於本關，操作已鎖定。請勿關閉頁面。";
      announce(target.textContent);
      focusContext(target);
      console.warn(error);
      return false;
    }
  }

  function startOrResume() {
    if (locked || state.phase === "instant" || state.phase === "review") return;
    running = true;
    state.scene.observationStarted = 1;
    lastFrame = performance.now();
    announce(timerRunning ? "繼續觀察及計時。" : "開始觀察車輛運動。");
    if (!saveDraft()) return;
    render();
  }
  function pause() {
    if (!running || locked) return;
    running = false;
    updateActiveMeasurement();
    announce(timerRunning ? "觀察及計時已暫停。" : "觀察已暫停。");
    if (!saveDraft()) return;
    render();
  }
  function resetMeasurement() {
    if (locked || !["uniform", "variable"].includes(state.phase)) return;
    running = false;
    timerRunning = false;
    state.scene = { simulationTime: 0, paused: 1, observationStarted: 0 };
    setCurrentMeasurement(null);
    state.answers[state.phase] = null;
    state.draftAnswers[state.phase] = { displacement: "", time: "", averageVelocity: "", relationship: "" };
    state.variant = state.returnToReview ? "review-edit-ready" : "ready";
    clearMeasurementForm();
    announce("已回到相同題目的起始狀態，請重新量度。");
    if (!saveDraft()) return;
    render();
  }
  function stopwatch() {
    if (locked || !["uniform", "variable"].includes(state.phase)) return;
    if (!timerRunning) {
      if (currentMeasurement()?.x2 != null || state.variant.endsWith("answered")) return;
      if (state.scene.observationStarted !== 1 || !running) {
        announce("請先按開始觀察，再開始計時。");
        return;
      }
      const time = state.scene.simulationTime;
      const readingOrigin = UiPolicy.stageReadingOrigin(state.definition, state.phase);
      const measurement = {
        startModelTime: time, currentOrEndModelTime: time, readingOrigin,
        x1: Model.canonicalNumber(Model.readingPosition(positionAt(time), readingOrigin)), x2: null, dt: 0
      };
      setCurrentMeasurement(measurement);
      state.answers[state.phase] = null;
      state.draftAnswers[state.phase] = { displacement: "", time: "", averageVelocity: "", relationship: "" };
      state.variant = state.returnToReview ? "review-edit-paused-measuring" : "paused-measuring";
      timerRunning = true;
      announce(`已記錄起點 ${Model.format3(measurement.x1)} m，開始計時。`);
      if (!saveDraft()) return;
      render();
      return;
    }
    if (!running) {
      announce("請先繼續觀察，再停止計時。");
      return;
    }
    if (!Model.minimumDurationReached(activeDuration(), minimumDuration())) return;
    captureEndpoint();
  }
  function captureEndpoint(endTime = state.scene.simulationTime) {
    const measurement = Model.captureMeasurement(positionAt, currentMeasurement().startModelTime, endTime, currentMeasurement().readingOrigin);
    setCurrentMeasurement({ ...measurement, currentOrEndModelTime: measurement.endModelTime });
    timerRunning = false;
    state.variant = state.returnToReview ? "review-edit-captured" : "captured";
    announce(`已記錄終點 ${Model.format3(measurement.x2)} m；${running ? "觀察仍繼續運動。" : "觀察仍由你暫停。"}`);
    if (!saveDraft()) return false;
    render();
    return true;
  }
  function clearMeasurementForm() {
    [elements.displacementInput, elements.timeInput, elements.averageInput].forEach((input) => { input.value = ""; });
    relationshipInputs.forEach((input) => { input.checked = false; });
    elements.answerError.textContent = "";
  }
  function loadMeasurementForm(answer) {
    if (!answer) return clearMeasurementForm();
    elements.displacementInput.value = answer.displacement;
    elements.timeInput.value = answer.time;
    elements.averageInput.value = answer.averageVelocity;
    relationshipInputs.forEach((input) => { input.checked = input.value === answer.relationship; });
  }
  function syncMeasurementDraftFromForm() {
    if (!state || !["uniform", "variable"].includes(state.phase) || currentMeasurement()?.x2 == null) return;
    const draft = {
      displacement: elements.displacementInput.value,
      time: elements.timeInput.value,
      averageVelocity: elements.averageInput.value,
      relationship: relationshipInputs.find((input) => input.checked)?.value || ""
    };
    state.draftAnswers[state.phase] = draft;
    if (state.answers[state.phase] && JSON.stringify(state.answers[state.phase]) !== JSON.stringify(draft)) {
      state.answers[state.phase] = null;
      state.variant = state.returnToReview ? "review-edit-captured" : "captured";
    }
  }
  function submitMeasurement(event) {
    event.preventDefault();
    if (locked || currentMeasurement()?.x2 == null) return;
    syncMeasurementDraftFromForm();
    const parsed = [elements.displacementInput, elements.timeInput, elements.averageInput].map((input) => Model.normalizeInput(input.value));
    const relationship = relationshipInputs.find((input) => input.checked)?.value;
    if (parsed.some((item) => !item)) return void (elements.answerError.textContent = "請輸入非負數值；可用小數或科學記數法，但不要輸入單位、逗號或負號。");
    if (!relationship) return void (elements.answerError.textContent = "請回答瞬時速度與平均速度的關係。");
    state.answers[state.phase] = {
      displacement: parsed[0].text, time: parsed[1].text, averageVelocity: parsed[2].text, relationship
    };
    state.draftAnswers[state.phase] = { ...state.answers[state.phase] };
    state.variant = state.returnToReview ? "review-edit-answered" : "answered";
    elements.answerError.textContent = "";
    const fallback = JSON.parse(JSON.stringify(state));
    const next = Persistence.next(state, state.returnToReview ? "return-review" : "advance");
    if (!next) return void (elements.answerError.textContent = "未能安全記錄本關狀態，請檢查答案後再試。");
    running = false;
    timerRunning = false;
    const message = next.phase === "review" ? "修改已保存，返回提交前檢查。" : next.phase === "instant" ? "第 2 關答案已保存，前往時間放大鏡。" : "第 1 關答案已保存，前往變速運動。";
    if (!saveTransition(next, fallback, message)) return;
    if (state.phase === "variable") clearMeasurementForm();
  }

  function syncInstantDraftFromForm() {
    if (!state || state.phase !== "instant" || state.viewedWindowCount < 4) return;
    const draft = {
      predictionChoice: document.querySelector("input[name=prediction]:checked")?.value || "",
      concept: conceptInputs.find((input) => input.checked)?.value || "",
      stoppedVelocity: elements.stoppedInput.value
    };
    state.draftAnswers.instant = draft;
    if (state.answers.instant && JSON.stringify(state.answers.instant) !== JSON.stringify(draft)) {
      state.answers.instant = null;
      state.variant = state.returnToReview ? "review-edit-exploring" : "exploring";
    }
  }
  function navigateTo(phase, returnToReview = false) {
    if (locked || !state || state.phase === phase) return;
    updateActiveMeasurement();
    if (["uniform", "variable"].includes(state.phase)) syncMeasurementDraftFromForm();
    if (state.phase === "instant") syncInstantDraftFromForm();
    const fallback = JSON.parse(JSON.stringify(state));
    const next = Persistence.navigate(state, phase, returnToReview);
    if (!next) {
      announce("未能安全保存目前草稿，暫時不能轉關。");
      return;
    }
    const names = { uniform: "第 1 關", variable: "第 2 關", instant: "第 3 關", review: "提交前檢查" };
    saveTransition(next, fallback, `草稿已保存，前往${names[phase]}。`);
  }
  function previousStage() {
    const target = { variable: "uniform", instant: "variable" }[state?.phase];
    if (target) navigateTo(target);
  }
  function nextStage() {
    const target = { uniform: "variable", variable: "instant", instant: "review" }[state?.phase];
    if (target) navigateTo(target);
  }
  function normalizedActiveWindowIndex() {
    const count = Math.max(0, Math.min(Model.WINDOWS.length, state?.viewedWindowCount || 0));
    if (!count) return -1;
    if (!Number.isInteger(activeWindowIndex) || activeWindowIndex < 0 || activeWindowIndex >= count) activeWindowIndex = count - 1;
    return activeWindowIndex;
  }
  function showLongerWindow() {
    if (locked || state.phase !== "instant") return;
    const current = normalizedActiveWindowIndex();
    if (current <= 0) return;
    activeWindowIndex = current - 1;
    announce(`圖中改為較長的 ${Model.format3(Model.WINDOWS[activeWindowIndex])} s 時間區間。`);
    render();
  }
  function showShorterWindow() {
    if (locked || state.phase !== "instant") return;
    const current = normalizedActiveWindowIndex();
    const next = current < 0 ? 0 : current + 1;
    if (next >= Model.WINDOWS.length) return;
    activeWindowIndex = next;
    const revealed = next >= state.viewedWindowCount;
    if (revealed) state.viewedWindowCount = next + 1;
    announce(`${revealed ? "已顯示" : "圖中改為"} ${Model.format3(Model.WINDOWS[next])} s 時間區間。`);
    if (revealed && !saveDraft()) return;
    render();
  }
  function toggleInstantDemo() {
    if (locked || state?.phase !== "instant" || reducedMotion) return;
    const now = performance.now();
    if (instantDemoPaused) {
      instantDemoStartedAt = now - instantDemoPausedElapsed;
      instantDemoPaused = false;
      announce("瞬時速度示範已繼續播放。");
    } else {
      if (instantDemoStartedAt == null) instantDemoStartedAt = now;
      instantDemoPausedElapsed = Math.max(0, now - instantDemoStartedAt);
      instantDemoPaused = true;
      announce("瞬時速度示範已暫停。");
    }
    renderInstant();
    draw();
  }
  function submitInstant(event) {
    event.preventDefault();
    syncInstantDraftFromForm();
    const predictionChoice = document.querySelector("input[name=prediction]:checked")?.value;
    const concept = conceptInputs.find((input) => input.checked)?.value;
    const stopped = Model.normalizeInput(elements.stoppedInput.value);
    if (!predictionChoice || !concept) return void (elements.instantError.textContent = "請完成兩條選擇題。");
    if (!stopped) return void (elements.instantError.textContent = "請輸入非負數值，例如 0、0.0 或 0.00；不要輸入單位。");
    state.answers.instant = { predictionChoice, concept, stoppedVelocity: stopped.text };
    state.draftAnswers.instant = { ...state.answers.instant };
    state.variant = state.returnToReview ? "review-edit-answered" : "answered";
    elements.instantError.textContent = "";
    const fallback = JSON.parse(JSON.stringify(state));
    const wasEdit = state.returnToReview;
    const next = Persistence.next(state, state.returnToReview ? "return-review" : "review");
    if (!next) return void (elements.instantError.textContent = "未能安全記錄本關狀態，請檢查答案後再試。");
    saveTransition(next, fallback, wasEdit ? "修改已保存，返回提交前檢查。" : "第 3 關答案已保存，前往提交前檢查。");
  }
  function editStage(stage) {
    if (locked || state.phase !== "review") return;
    state = Persistence.next(state, ["edit-uniform", "edit-variable", "edit-instant"][stage]);
    if (!state) return;
    running = false;
    timerRunning = false;
    if (stage < 2) loadMeasurementForm(state.draftAnswers[state.phase]);
    else { activeWindowIndex = null; resetInstantDemo(); loadInstantForm(); }
    announce(`返回第 ${stage + 1} 關修改答案。`);
    if (!saveDraft()) return;
    render();
    focusContext(elements.stageTitle);
  }
  function loadInstantForm() {
    const answer = state.draftAnswers.instant;
    document.querySelectorAll("input[name=prediction]").forEach((input) => { input.checked = input.value === answer?.predictionChoice; });
    conceptInputs.forEach((input) => { input.checked = input.value === answer?.concept; });
    elements.stoppedInput.value = answer?.stoppedVelocity || "";
  }

  function submitAll() {
    if (locked || state.phase !== "review" || state.variant !== "complete" || !window.confirm("確認提交全部答案？提交後本次嘗試只可重看。")) return;
    elements.submissionNotice.classList.add("is-hidden");
    elements.reviewRetryButton.classList.add("is-hidden");
    submitPayload(buildSubmissionPayload());
  }
  function buildSubmissionPayload() {
    const computed = Scoring.scoreAttempt(state.definition, state.uniformMeasurement, state.variableMeasurement, state.answers);
    const review = Persistence.makeReview(state);
    const snapshot = window.SimScorm.makeSnapshot(ACTIVITY, "review", review, computed);
    return { computed, snapshot };
  }
  function submitPayload(payload) {
    const handle = (outcome) => {
      retryMode = Persistence.retryAction(outcome);
      window.SimActivityFlow.submission(outcome, {
        success: () => {
          locked = true; result = payload.computed; trustedReview = true;
          showResult("答案已提交。", true, false);
        },
        committed: () => {
          locked = true; result = payload.computed; trustedReview = true;
          showResult("成績已保存，但 Moodle 工作階段尚待完成；請重試完成連線。", true, true);
        },
        frozen: () => {
          locked = true; result = null; trustedReview = false;
          showTechnical("提交狀態尚未確認；答案已凍結，請重試同一份提交。", true);
        },
        retry: () => {
          if (outcome.retryable) showReviewRetry("未能傳送到 Moodle。你可修改答案，或重試提交目前答案。");
          else {
            locked = true;
            showTechnical("提交前檢查失敗，暫時不能重試。", false);
          }
        }
      });
    };
    window.SimScorm.submitWithCallbacks(payload.computed, payload.snapshot, { onSuccess: handle, onFailure: handle });
  }
  function showReviewRetry(message) {
    locked = false;
    retryMode = "resubmit";
    render();
    elements.submissionNotice.textContent = message;
    elements.submissionNotice.classList.remove("is-hidden");
    elements.reviewRetryButton.classList.remove("is-hidden");
    announce(message);
  }
  function retrySubmission() {
    if (retryMode === "finish") {
      if (window.SimScorm.finish()) {
        retryMode = "none";
        showResult("答案已提交，Moodle 工作階段已完成。", true, false);
      } else showResult("成績已保存，但仍未能完成 Moodle 工作階段。", true, true);
      return;
    }
    if (retryMode === "resubmit") {
      if (!state || state.phase !== "review") return showTechnical("找不到可重試的提交資料，請重新開啟活動。", false);
      elements.submissionNotice.classList.add("is-hidden");
      elements.reviewRetryButton.classList.add("is-hidden");
      submitPayload(buildSubmissionPayload());
      return;
    }
    const raw = window.SimScorm.retryPending();
    const outcome = { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
    const restorePendingResult = (message, nextRetryMode) => {
      const review = Persistence.decodeReview(raw.review?.answer);
      if (review) {
        state = Persistence.fromReview(review);
        const computed = Scoring.scoreAttempt(review.definition, review.uniformMeasurement, review.variableMeasurement, review.answers);
        const outcome = UiPolicy.reviewOutcome(computed, raw.review, { score: raw.score, status: raw.status });
        trustedReview = outcome.trusted;
        result = outcome.result;
      } else {
        result = { score: Number.isFinite(raw.score) ? raw.score : null, maxScore: 100, passed: raw.status === "passed" ? true : raw.status === "failed" ? false : null, completed: true, feedbackItems: [] };
        trustedReview = false;
      }
      locked = true;
      retryMode = nextRetryMode;
      showResult(message, trustedReview, retryMode !== "none");
    };
    window.SimActivityFlow.submission(outcome, {
      success: () => restorePendingResult("答案已提交。", "none"),
      committed: () => restorePendingResult("成績已保存，但 Moodle 工作階段尚待完成。", "finish"),
      frozen: () => { locked = true; retryMode = "pending"; showTechnical("提交狀態仍待確認；答案繼續凍結。", true); },
      retry: () => { locked = true; retryMode = "pending"; showTechnical("仍未能確認提交狀態，請稍後再試。", true); }
    });
    render();
    return outcome.activityState;
  }

  function restoreFinished(attempt) {
    const recorded = window.SimActivityFlow.recordedResult(attempt);
    const saved = attempt.snapshot;
    const review = Persistence.decodeReview(saved?.answer);
    if (!review) {
      locked = true; trustedReview = false; result = { score: recorded.score, maxScore: 100, passed: recorded.passed, completed: true, feedbackItems: [] };
      showResult("已完成的記錄無法安全還原，只顯示 Moodle 已記錄結果。", false);
      return;
    }
    state = Persistence.fromReview(review);
    const computed = Scoring.scoreAttempt(review.definition, review.uniformMeasurement, review.variableMeasurement, review.answers);
    const outcome = window.SimActivityFlow.reviewResult(computed, saved, attempt);
    locked = true; trustedReview = outcome.trusted; result = outcome.result;
    showResult(outcome.trusted ? "已提交答案（只供重看）。" : "答案內容與 Moodle 記錄不一致，只顯示 Moodle 已記錄結果。", outcome.trusted);
  }
  function showTechnical(message, retryable) {
    setGraphLayout(true);
    elements.activitySection.classList.add("is-hidden");
    elements.reviewSection.classList.add("is-hidden");
    elements.resultSection.classList.remove("is-hidden");
    elements.resultTitle.textContent = "技術狀態";
    elements.scorePanel.textContent = `成績：--　狀態：未能安全判斷合格狀態`;
    elements.feedbackList.innerHTML = `<div class="feedback-item"><p>${escapeHtml(message)}</p></div>`;
    elements.retryButton.classList.toggle("is-hidden", !retryable);
    elements.retryButton.textContent = retryMode === "finish" ? "重試完成連線" : retryMode === "resubmit" ? "重試提交" : "重試連線";
    announce(`技術狀態。未能安全判斷合格狀態。${message}`);
    elements.resultTitle.focus({ preventScroll: true });
  }
  function showResult(message, detailed, retryable = false) {
    setGraphLayout(true);
    elements.activitySection.classList.add("is-hidden");
    elements.reviewSection.classList.add("is-hidden");
    elements.resultSection.classList.remove("is-hidden");
    elements.resultTitle.textContent = detailed ? "提交結果" : "已記錄結果";
    const label = window.SimActivityFlow.completionLabel(result?.passed ?? null);
    elements.scorePanel.textContent = `成績：${result?.score ?? "--"} / 100　狀態：${label}`;
    const items = detailed && trustedReview ? result.feedbackItems : [];
    elements.feedbackList.innerHTML = `<div class="feedback-item"><p>${escapeHtml(message)}</p></div>` + items.map(feedbackItemHtml).join("");
    elements.retryButton.classList.toggle("is-hidden", !retryable);
    elements.retryButton.textContent = retryMode === "finish" ? "重試完成連線" : "重試連線";
    if (state) draw();
    const detail = items.map((item) => `${item.title}。${item.text}`).join(" ");
    announce(`${elements.resultTitle.textContent}。${elements.scorePanel.textContent}。${message}${detail ? ` ${detail}` : ""}`);
    elements.resultTitle.focus({ preventScroll: true });
  }

  function render() {
    if (!state) return drawEmpty();
    setGraphLayout(state.phase === "instant" || state.phase === "review" || locked);
    const stageIndex = state.stage;
    const completed = [state.answers.uniform, state.answers.variable, state.answers.instant, state.variant === "complete"];
    progressItems.forEach((item, index) => { item.classList.toggle("is-current", index === stageIndex); item.classList.toggle("is-done", Boolean(completed[index])); });
    elements.activitySection.classList.toggle("is-hidden", state.phase === "review" || locked);
    elements.reviewSection.classList.toggle("is-hidden", state.phase !== "review" || locked);
    if (!locked) elements.resultSection.classList.add("is-hidden");
    if (state.phase === "review") renderReview();
    else if (state.phase === "instant") renderInstant();
    else renderMeasurementStage();
    if (state.phase !== "review") renderStageNavigation();
    if (["uniform", "variable"].includes(state.phase)) renderLiveReadouts(false);
    draw();
  }
  function renderStageNavigation() {
    elements.stageNavigation.classList.remove("is-hidden");
    elements.previousStageButton.disabled = state.phase === "uniform";
    elements.previousStageButton.textContent = state.phase === "variable" ? "返回第 1 關" : state.phase === "instant" ? "返回第 2 關" : "上一關";
    elements.nextStageButton.textContent = state.phase === "uniform" ? "前往第 2 關" : state.phase === "variable" ? "前往第 3 關" : "前往檢查";
  }
  function setGraphLayout(graph) { canvas.parentElement.classList.toggle("is-graph", graph); }
  function renderMeasurementStage() {
    const variable = state.phase === "variable";
    canvas.setAttribute("aria-label", "固定在中央的車輛、向後移動的道路標尺或位置時間圖");
    elements.cameraNote.textContent = "鏡頭正在跟隨車輛；車的實際位置由下方標尺讀取。";
    elements.positionReadoutLabel.textContent = "位置";
    elements.timerReadoutLabel.textContent = "計時器";
    elements.stageKicker.textContent = variable ? "第 2 關" : "第 1 關";
    elements.stageTitle.textContent = variable ? "變速運動" : "勻速運動";
    elements.instructionText.textContent = variable ? `車速會不規則改變；自行量度至少 ${Model.format3(state.definition.variableMinimumDuration)} s。` : "操作計時器記錄起點位置、終點位置和經過時間。";
    elements.relationshipLegend.textContent = variable
      ? "在這段變速直線運動中，車輛每一時刻的速度大小，是否都等於整段量度時間的平均速度大小？"
      : "在這段勻速直線運動中，車輛每一時刻的速度大小，是否都等於整段量度時間的平均速度大小？";
    elements.measurementSubmitButton.textContent = state.returnToReview ? "確認修改並返回檢查" : variable ? "確認答案並前往第 3 關" : "確認答案並前往第 2 關";
    elements.instantControls.classList.add("is-hidden");
    elements.observationControls.classList.remove("is-hidden");
    elements.timerButton.classList.remove("is-hidden");
    elements.progressMessage.classList.remove("is-hidden");
    const measurement = currentMeasurement();
    const captured = measurement?.x2 != null;
    elements.measurementCard.classList.toggle("is-hidden", !measurement);
    elements.measurementForm.classList.toggle("is-hidden", !captured);
    if (measurement) setQuantityValue(elements.x1Readout, measurement.x1, "m");
    else { elements.x1Readout.textContent = "--"; elements.x1Readout.setAttribute("aria-label", "起點位置，未記錄"); }
    if (captured) setQuantityValue(elements.x2Readout, measurement.x2, "m");
    else { elements.x2Readout.textContent = "--"; elements.x2Readout.setAttribute("aria-label", "終點位置，未記錄"); }
    elements.observeButton.textContent = running ? "觀察中" : state.scene.observationStarted === 1 ? "繼續觀察" : "開始觀察";
    elements.observeButton.disabled = running;
    elements.pauseButton.disabled = !running;
    renderMeasurementProgress();
    if (captured) loadMeasurementForm(state.draftAnswers[state.phase]);
  }
  function renderMeasurementProgress() {
    const measurement = currentMeasurement();
    const captured = measurement?.x2 != null;
    const answered = state.variant.endsWith("answered");
    const duration = activeDuration();
    const minimum = minimumDuration();
    const eligible = Model.minimumDurationReached(duration, minimum);
    const control = Persistence.measurementControlState({ timerRunning, duration, minimum, captured, answered, running, observationStarted: state.scene.observationStarted === 1 });
    if (measurement && !timerRunning) setQuantityValue(elements.dtReadout, activeDuration(), "s");
    else {
      elements.dtReadout.textContent = measurement ? `${Model.format3(activeDuration())} s` : "--";
      elements.dtReadout.setAttribute("aria-label", measurement ? `${Model.format3(activeDuration())} s` : "經過時間，未記錄");
    }
    elements.timerButton.textContent = control.label;
    elements.timerButton.classList.toggle("is-running", timerRunning);
    elements.timerButton.disabled = control.disabled;
    const remaining = eligible ? 0 : Math.max(0, minimum - duration);
    elements.progressMessage.textContent = timerRunning && !running
      ? "觀察及計時已暫停；請先按繼續觀察，之後才可停止計時。"
      : timerRunning && remaining > 0
      ? `尚需量度約 ${Model.format3(remaining)} s。`
      : timerRunning ? "已達最低量度時間，可自行按停止計時；觀察不會自動暫停。" : captured ? "量度已完成；觀察可繼續，如要更改讀數請先按重新量度。" : state.scene.observationStarted !== 1 ? "請先按開始觀察，再開始計時。" : `最低量度時間：${Model.format3(minimumDuration())} s。`;
  }
  function renderInstant() {
    canvas.setAttribute("aria-label", reducedMotion
      ? "固定道路上以半透明車影標記目標一刻的靜態示意圖，以及位置時間圖"
      : "固定道路上由左至右駛過目標位置、留下半透明車影的車輛示意動畫，以及位置時間圖");
    elements.cameraNote.textContent = reducedMotion
      ? "馬路保持不動；靜態車影標記車輛通過中央位置的一刻。"
      : "馬路保持不動；車輛通過中央金色標記時會留下淡色車影。";
    elements.positionReadoutLabel.textContent = "目標位置";
    elements.timerReadoutLabel.textContent = "目標時刻";
    elements.stageKicker.textContent = "第 3 關";
    elements.stageTitle.textContent = "時間放大鏡";
    elements.instructionText.textContent = reducedMotion
      ? "上方靜態示意圖以淡色車影標記要研究的一刻；畫面不按比例顯示速度大小。下方區間愈短，平均速度會愈趨近該刻的瞬時速度。"
      : "上方等速示意動畫只用來標記要研究的一刻，畫面不按比例顯示速度大小；車影會留在車輛通過目標位置的一刻。下方區間愈短，平均速度會愈趨近該刻的瞬時速度。";
    elements.observationControls.classList.add("is-hidden");
    elements.timerButton.classList.add("is-hidden");
    elements.progressMessage.classList.add("is-hidden");
    elements.measurementCard.classList.add("is-hidden");
    elements.measurementForm.classList.add("is-hidden");
    elements.instantControls.classList.remove("is-hidden");
    elements.demoToggleButton.disabled = reducedMotion;
    elements.demoToggleButton.textContent = reducedMotion ? "靜態示意（無需暫停）" : instantDemoPaused ? "繼續示範" : "暫停示範";
    elements.instantSubmitButton.textContent = state.returnToReview ? "確認修改並返回檢查" : "確認答案並檢查全部答案";
    const selected = normalizedActiveWindowIndex();
    const rows = UiPolicy.analysisRows(state.definition).slice(0, state.viewedWindowCount);
    elements.windowRows.innerHTML = rows.map((row, index) => `<tr${index === selected ? ' class="is-selected" aria-current="true"' : ""}><td>${quantityHtml(row.duration, "s")}</td><td>${quantityHtml(row.displacement, "m")}</td><td>${quantityHtml(row.displacement, "m")} ÷ ${quantityHtml(row.duration, "s")}</td><td>${quantityHtml(row.averageVelocity, "m/s")}</td></tr>`).join("");
    elements.longerWindowButton.disabled = selected <= 0;
    elements.longerWindowButton.innerHTML = selected > 0 ? `加長時間間隔至 ${quantityHtml(Model.WINDOWS[selected - 1], "s")}` : "已是最長時間間隔";
    elements.shorterWindowButton.disabled = selected === Model.WINDOWS.length - 1;
    elements.shorterWindowButton.innerHTML = selected < 0 ? `顯示時間間隔 ${quantityHtml(Model.WINDOWS[0], "s")}` : selected < Model.WINDOWS.length - 1 ? `縮短時間間隔至 ${quantityHtml(Model.WINDOWS[selected + 1], "s")}` : "已是最短時間間隔";
    elements.windowSelectionMessage.innerHTML = selected < 0 ? "先顯示最長的時間區間。" : `圖中目前顯示的時間間隔是 ${quantityHtml(Model.WINDOWS[selected], "s")}；藍底列是目前區間。`;
    elements.instantForm.classList.toggle("is-hidden", state.viewedWindowCount < 4);
    UiPolicy.appendPredictionOptions(elements.optionChoices, state.definition.instantOptions, document);
    if (state.viewedWindowCount === 4) loadInstantForm();
    const showSolution = UiPolicy.canRevealSolution({ locked, trustedReview, result });
    elements.revealCard.classList.toggle("is-hidden", !showSolution);
    if (showSolution) {
      elements.revealCard.innerHTML = `模型在目標時刻的瞬時速度是 ${quantityHtml(Scoring.correctOption(state.definition).value, "m/s")}；圖中虛線顯示該點切線。`;
    }
  }
  function renderReview() {
    elements.reviewList.innerHTML = [
      state.answers.uniform ? reviewItem(0, "勻速運動", state.uniformMeasurement, state.answers.uniform) : incompleteReviewItem(0, "勻速運動", state.uniformMeasurement ? "量度已記錄，答案仍未確認。" : "尚未完成量度及答案。"),
      state.answers.variable ? reviewItem(1, "變速運動", state.variableMeasurement, state.answers.variable) : incompleteReviewItem(1, "變速運動", state.variableMeasurement ? "量度已記錄，答案仍未確認。" : "尚未完成量度及答案。"),
      state.answers.instant
        ? `<article class="review-item"><h3>時間放大鏡</h3><p>目標時刻的瞬時速度估計：${quantityHtml(state.definition.instantOptions.find((option) => option.id === state.answers.instant.predictionChoice).value, "m/s")}</p><p>概念答案：${escapeHtml(conceptLabel(state.answers.instant.concept))}</p><p>車輛停定、位置保持不變時：${escapeHtml(state.answers.instant.stoppedVelocity)} <span class="unit">m/s</span></p><button type="button" data-edit="2">修改第 3 關</button></article>`
        : incompleteReviewItem(2, "時間放大鏡", state.viewedWindowCount === 4 ? "觀察已完成，答案仍未確認。" : `已查看 ${state.viewedWindowCount} / 4 個時間區間，答案尚未完成。`)
    ].join("");
    elements.reviewList.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editStage(Number(button.dataset.edit))));
    const complete = state.variant === "complete";
    elements.submitButton.disabled = !complete;
    elements.submissionNotice.classList.toggle("is-hidden", complete);
    elements.submissionNotice.textContent = complete ? "" : "你可以自由返回任何一關；完成並確認三關答案後，先可以正式提交。";
  }
  function incompleteReviewItem(index, title, message) {
    return `<article class="review-item is-incomplete"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><button type="button" data-edit="${index}">返回第 ${index + 1} 關</button></article>`;
  }
  function reviewItem(index, title, measurement, answer) {
    return `<article class="review-item"><h3>${title}</h3><p>讀數：起點位置 ${quantityHtml(measurement.x1, "m")}；終點位置 ${quantityHtml(measurement.x2, "m")}；經過時間 ${quantityHtml(measurement.dt, "s")}</p><p>答案：位移大小 ${escapeHtml(answer.displacement)} <span class="unit">m</span>；經過時間 ${escapeHtml(answer.time)} <span class="unit">s</span>；平均速度大小 ${escapeHtml(answer.averageVelocity)} <span class="unit">m/s</span>；每一時刻關係：${answer.relationship === "yes" ? "是" : "否"}</p><button type="button" data-edit="${index}">修改第 ${index + 1} 關</button></article>`;
  }
  function conceptLabel(value) {
    return ({ limit: "愈短時間內平均速度所趨近的值", "journey-average": "全程總位移除以總時間", "zero-division": "位移除以正好零秒", "largest-one-second": "一秒內最大速度" })[value] || "--";
  }

  function animate(timestamp) {
    if (running && state && !locked) {
      try {
        const delta = Math.min(Model.MAX_FRAME_DELTA, Math.max(0, (timestamp - lastFrame) / 1000));
        state.scene.simulationTime = Model.advanceSimulationTime(state.scene.simulationTime, [{ dt: delta, running: true }]);
        lastFrame = timestamp;
        updateActiveMeasurement();
        renderLiveReadouts(true);
        draw();
      } catch {
        running = false;
        timerRunning = false;
        locked = true;
        showTechnical("運動數值已超出可安全繼續的範圍，活動已鎖定；這不是已提交或已評分狀態。", false);
      }
    }
    else if (state?.phase === "instant" && !locked && !reducedMotion && !instantDemoPaused) draw();
    frameId = requestAnimationFrame(animate);
  }
  function renderLiveReadouts(announceBoundary) {
    elements.positionReadout.textContent = `${Model.format3(displayedPositionAt())} m`;
    elements.timerReadout.textContent = `${Model.format3(timerRunning ? activeDuration() : currentMeasurement()?.dt || 0)} s`;
    elements.positionReadout.setAttribute("aria-label", `位置 ${elements.positionReadout.textContent}`);
    elements.timerReadout.setAttribute("aria-label", `計時器 ${elements.timerReadout.textContent}`);
    if (["uniform", "variable"].includes(state.phase) && timerRunning) renderMeasurementProgress();
    if (state.scene.observationStarted !== 1) {
      elements.motionStatus.textContent = "尚未開始觀察。";
      lastMotionSegment = null;
    }
    else if (state.phase === "variable") {
      const segment = Model.qualitativeState(state.definition.variable, state.scene.simulationTime);
      elements.motionStatus.textContent = motionLabel(segment, running);
      if (announceBoundary && running && lastMotionSegment && segment !== lastMotionSegment) announce(motionLabel(segment, true));
      lastMotionSegment = segment;
    }
    else elements.motionStatus.textContent = running ? "車輛正以固定速度向右前進。" : "觀察由你暫停；車輛與標尺已凍結。";
  }
  function motionLabel(segment, isRunning) {
    if (!isRunning) return "觀察由你暫停；車輛與標尺已凍結。";
    return ({ slow: "車輛正慢速向右巡航。", accelerate: "車輛正在向右加速。", fast: "車輛正快速向右巡航。", decelerate: "車輛正在減速。", stopped: "物理模型速度為零：車輛短暫停止，觀察仍在運行。", restart: "車輛正由物理停止狀態重新向右加速。" })[segment];
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr: Math.min(2, window.devicePixelRatio || 1) };
    canvas.width = Math.round(view.width * view.dpr); canvas.height = Math.round(view.height * view.dpr);
    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); draw();
  }
  function draw() {
    context.clearRect(0, 0, view.width, view.height);
    if (!state) return drawEmpty();
    if (state.phase === "instant" || state.phase === "review" || locked) drawGraph(); else drawRoad();
  }
  function drawEmpty() { context.fillStyle = "#f9fafb"; context.fillRect(0, 0, view.width, view.height); }
  function drawRoad() {
    const w = view.width, h = view.height, layout = Visuals.sceneLayout(w, h);
    context.fillStyle = "#dbeafe"; context.fillRect(0, 0, w, layout.vergeTop);
    context.fillStyle = "#a9c994"; context.fillRect(0, layout.vergeTop, w, layout.roadTop - layout.vergeTop);
    const worldPosition = positionAt();
    const position = displayedPositionAt();
    const pixelsPerMetre = Math.max(16, Math.min(28, w / 24));
    drawLandmarks(worldPosition, pixelsPerMetre, layout);
    context.fillStyle = "#4b5563"; context.fillRect(0, layout.roadTop, w, layout.roadBottom - layout.roadTop);
    context.fillStyle = "#64748b"; context.fillRect(0, layout.roadTop, w, 3); context.fillRect(0, layout.roadBottom - 3, w, 3);
    context.strokeStyle = "#f8fafc"; context.lineWidth = 3; context.setLineDash([28, 22]); context.lineDashOffset = Visuals.laneDashOffset(worldPosition, pixelsPerMetre); context.beginPath(); context.moveTo(0, layout.roadCentreY); context.lineTo(w, layout.roadCentreY); context.stroke(); context.setLineDash([]); context.lineDashOffset = 0;
    context.fillStyle = "#374151"; context.fillRect(0, layout.roadBottom, w, h - layout.roadBottom);
    context.strokeStyle = "#94a3b8"; context.lineWidth = 1; context.beginPath(); context.moveTo(0, layout.roadBottom); context.lineTo(w, layout.roadBottom); context.stroke();
    const centreMetre = Math.floor(position);
    const tickRadius = Math.ceil(w / pixelsPerMetre / 2) + 2;
    for (let offset = -tickRadius; offset <= tickRadius; offset += 1) {
      const metre = centreMetre + offset;
      const x = w / 2 + (metre - position) * pixelsPerMetre;
      const major = metre % 10 === 0;
      context.strokeStyle = major ? "#f9fafb" : "#cbd5e1"; context.lineWidth = major ? 2 : 1;
      context.beginPath(); context.moveTo(x, layout.rulerY); context.lineTo(x, layout.rulerY - (major ? layout.rulerMajorTickHeight : layout.rulerMinorTickHeight)); context.stroke();
      if (major) { context.fillStyle = "#f9fafb"; context.font = "bold 12px ui-monospace, monospace"; context.textAlign = "center"; context.fillText(Model.format3(metre), x, layout.rulerLabelY); }
    }
    context.strokeStyle = "#f9fafb"; context.lineWidth = 3; context.beginPath(); context.moveTo(0, layout.rulerY); context.lineTo(w, layout.rulerY); context.stroke();
    const scale = Visuals.carScale(pixelsPerMetre);
    drawCar(w / 2, layout.carGroundY, scale, Visuals.wheelAngle(worldPosition));
    const pointerTop = Math.max(82, layout.carGroundY - 88 * scale);
    context.strokeStyle = "#f59e0b"; context.lineWidth = 3; context.beginPath(); context.moveTo(w / 2, pointerTop); context.lineTo(w / 2, layout.rulerY + 2); context.stroke();
    context.fillStyle = "#78350f"; context.textAlign = "center"; context.font = "bold 12px system-ui"; context.fillText("量度指針", w / 2, pointerTop - 7);
    drawMeasurementMarkers(currentMeasurement(), worldPosition, pixelsPerMetre, layout);
  }
  function drawMeasurementMarkers(measurement, currentWorldPosition, pixelsPerMetre, layout) {
    if (!measurement) return;
    const markers = [
      { endpoint: "x1", label: "開始 x₁", dashed: true, shape: "circle", colour: "#00695c", labelOffset: -34 },
      { endpoint: "x2", label: "停止 x₂", dashed: false, shape: "square", colour: "#5b21b6", labelOffset: 34 }
    ].filter((marker) => Number.isFinite(measurement[marker.endpoint]));
    markers.forEach((marker, index) => {
      const world = Model.measurementWorldPosition(measurement, marker.endpoint);
      const x = view.width / 2 + (world - currentWorldPosition) * pixelsPerMetre;
      if (x < 12 || x > view.width - 12) {
        const left = x < 12, cueX = left ? 8 : view.width - 8;
        context.save(); context.fillStyle = "#fff"; context.strokeStyle = marker.colour; context.lineWidth = 3;
        context.beginPath(); context.roundRect(left ? 2 : view.width - 82, layout.roadCentreY + 9 + index * 28, 80, 23, 5); context.fill(); context.stroke();
        context.fillStyle = "#111827"; context.font = "bold 11px system-ui"; context.textAlign = left ? "left" : "right";
        context.fillText(`${left ? "←" : "→"} ${marker.label}`, left ? cueX : cueX, layout.roadCentreY + 25 + index * 28); context.restore();
        return;
      }
      context.save(); context.strokeStyle = "#fff"; context.lineWidth = 8; context.setLineDash(marker.dashed ? [6, 5] : []);
      context.beginPath(); context.moveTo(x, layout.roadCentreY + 7); context.lineTo(x, layout.roadBottom - 10); context.stroke(); context.setLineDash([]);
      context.strokeStyle = marker.colour; context.fillStyle = marker.colour; context.lineWidth = 4; context.setLineDash(marker.dashed ? [6, 5] : []);
      context.beginPath(); context.moveTo(x, layout.roadCentreY + 7); context.lineTo(x, layout.roadBottom - 10); context.stroke(); context.setLineDash([]);
      if (marker.shape === "circle") { context.beginPath(); context.arc(x, layout.roadBottom - 9, 5, 0, Math.PI * 2); context.fill(); }
      else context.fillRect(x - 5, layout.roadBottom - 14, 10, 10);
      const badgeX = Math.max(44, Math.min(view.width - 44, x + marker.labelOffset));
      context.fillStyle = "#fff"; context.strokeStyle = marker.colour; context.lineWidth = 3;
      context.beginPath(); context.roundRect(badgeX - 40, layout.roadCentreY + 8, 80, 24, 5); context.fill(); context.stroke();
      context.fillStyle = "#111827"; context.font = "bold 11px system-ui"; context.textAlign = "center"; context.fillText(marker.label, badgeX, layout.roadCentreY + 24); context.restore();
    });
  }
  function drawLandmarks(position, scale, layout) {
    const size = Math.max(.72, Math.min(1.08, Math.min(view.width / 680, view.height / 330)));
    for (const layer of ["far", "roadside"]) {
      const config = Visuals.BACKGROUND_LAYERS[layer];
      for (const cellId of Visuals.visibleBackgroundCells(layer, position, scale, view.width)) {
        const appearance = Visuals.backgroundAppearance(layer, cellId);
        if (appearance.type === "empty") continue;
        const world = (cellId + appearance.offset) * config.spacing;
        const x = view.width / 2 + (world - position) * scale * config.parallax;
        if (layer === "far") drawFarLandmark(x, layout.farGroundY, appearance, size * .88);
        else drawRoadsideLandmark(x, layout.roadsideGroundY, appearance, size);
      }
    }
  }
  function drawFarLandmark(x, ground, appearance, size) {
    const wallColours = ["#94a3b8", "#a8a29e", "#93a7a1", "#a3a3a3"];
    const roofColours = ["#7c5f52", "#64748b", "#6b7280", "#78716c"];
    const width = appearance.width * size, height = appearance.height * size;
    context.save(); context.translate(x, ground);
    if (appearance.type === "treeCluster") {
      context.fillStyle = "#6f855d";
      [[-.28, -.56, .34], [.05, -.7, .4], [.32, -.53, .31]].forEach(([dx, dy, radius]) => { context.beginPath(); context.arc(dx * width, dy * height, radius * height, 0, Math.PI * 2); context.fill(); });
      context.fillStyle = "#765846"; context.fillRect(-2 * size, -height * .5, 4 * size, height * .5); context.restore(); return;
    }
    context.fillStyle = wallColours[appearance.variant]; context.fillRect(-width / 2, -height, width, height);
    context.fillStyle = roofColours[appearance.variant];
    if (appearance.type === "house") { context.beginPath(); context.moveTo(-width * .58, -height); context.lineTo(0, -height - 16 * size); context.lineTo(width * .58, -height); context.closePath(); context.fill(); }
    else { context.fillRect(-width * .54, -height - 5 * size, width * 1.08, 5 * size); }
    if (appearance.type === "shop") { context.fillStyle = ["#d97706", "#0f766e", "#2563eb", "#9f1239"][appearance.variant]; context.fillRect(-width * .46, -height * .74, width * .92, 9 * size); }
    context.fillStyle = "#dce8e8";
    const rows = appearance.type === "apartment" ? Math.max(2, Math.floor(height / (18 * size))) : 1;
    const columns = appearance.type === "house" ? 2 : 3;
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      const wx = -width * .32 + column * width * .32;
      const wy = -height + 11 * size + row * 17 * size;
      if (wy + 7 * size < -3 * size) context.fillRect(wx - 3 * size, wy, 6 * size, 7 * size);
    }
    context.fillStyle = "#5b4636"; context.fillRect(-4 * size, -14 * size, 8 * size, 14 * size);
    context.restore();
  }
  function drawRoadsideLandmark(x, ground, appearance, size) {
    const greens = ["#3f6f49", "#4f7c45", "#386641", "#52734d"];
    const width = appearance.width * size, height = appearance.height * size;
    context.save(); context.translate(x, ground);
    if (["tree", "treeShrubs"].includes(appearance.type)) {
      context.fillStyle = "#76513e"; context.fillRect(-3 * size, -height * .58, 6 * size, height * .58);
      context.fillStyle = greens[appearance.variant];
      [[0, -.74, .28], [-.18, -.58, .22], [.2, -.57, .23]].forEach(([dx, dy, radius]) => { context.beginPath(); context.arc(dx * width, dy * height, radius * height, 0, Math.PI * 2); context.fill(); });
    }
    if (["shrubs", "treeShrubs"].includes(appearance.type)) {
      const shrubY = appearance.type === "shrubs" ? 0 : -1;
      context.fillStyle = greens[(appearance.variant + 1) % greens.length];
      [-.32, 0, .32].forEach((offset, index) => { context.beginPath(); context.arc(offset * width, shrubY - height * (.12 + index % 2 * .04), height * .2, 0, Math.PI * 2); context.fill(); });
    } else if (appearance.type === "lamp") {
      context.strokeStyle = "#475569"; context.lineWidth = 4 * size; context.beginPath(); context.moveTo(0, 0); context.lineTo(0, -height); context.quadraticCurveTo(0, -height - 7 * size, 9 * size, -height - 7 * size); context.stroke();
      context.fillStyle = "#fef3c7"; context.beginPath(); context.ellipse(12 * size, -height - 5 * size, 7 * size, 4 * size, 0, 0, Math.PI * 2); context.fill();
    } else if (appearance.type === "sign") {
      context.fillStyle = "#64748b"; context.fillRect(-2 * size, -height * .7, 4 * size, height * .7);
      context.fillStyle = ["#2563eb", "#047857", "#b45309", "#7c3aed"][appearance.variant]; context.strokeStyle = "#f8fafc"; context.lineWidth = 2 * size; context.fillRect(-width / 2, -height, width, height * .42); context.strokeRect(-width / 2, -height, width, height * .42);
      context.fillStyle = "#fff"; context.beginPath(); context.moveTo(-width * .2, -height * .79); context.lineTo(width * .18, -height * .79); context.lineTo(width * .07, -height * .9); context.lineTo(width * .28, -height * .79); context.lineTo(width * .07, -height * .68); context.closePath(); context.fill();
    }
    context.restore();
  }
  function drawCar(x, ground, scale, wheelAngle = 0) {
    context.save(); context.translate(x, ground); context.scale(scale, scale);
    context.fillStyle = "rgba(15,23,42,.2)"; context.beginPath(); context.ellipse(3, 1, 72, 8, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#e4554f"; context.strokeStyle = "#8f2d32"; context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-64, -18); context.lineTo(-63, -37); context.quadraticCurveTo(-61, -46, -52, -48);
    context.lineTo(-28, -51); context.lineTo(-16, -68); context.quadraticCurveTo(-12, -73, -5, -73);
    context.lineTo(20, -73); context.quadraticCurveTo(27, -72, 32, -66); context.lineTo(44, -50);
    context.lineTo(59, -47); context.quadraticCurveTo(70, -44, 75, -34); context.lineTo(79, -24);
    context.quadraticCurveTo(80, -18, 72, -16); context.lineTo(-57, -16); context.quadraticCurveTo(-64, -16, -64, -18);
    context.closePath(); context.fill(); context.stroke();

    context.fillStyle = "#bfdbfe"; context.strokeStyle = "#64748b"; context.lineWidth = 2;
    context.beginPath(); context.moveTo(-12, -67); context.lineTo(-23, -52); context.lineTo(3, -52); context.lineTo(3, -67); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(10, -67); context.lineTo(20, -67); context.lineTo(37, -51); context.lineTo(10, -51); context.closePath(); context.fill(); context.stroke();
    context.strokeStyle = "#8f2d32"; context.beginPath(); context.moveTo(7, -50); context.lineTo(7, -18); context.stroke();
    context.beginPath(); context.moveTo(44, -49); context.quadraticCurveTo(58, -47, 68, -41); context.stroke();
    context.fillStyle = "#fef3c7"; context.strokeStyle = "#92400e"; context.beginPath(); context.moveTo(66, -41); context.lineTo(75, -36); context.lineTo(77, -29); context.lineTo(66, -31); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = "#7f1d1d"; context.fillRect(-64, -37, 6, 11);
    context.fillStyle = "#374151"; context.fillRect(73, -23, 10, 7); context.fillRect(-67, -21, 8, 5);
    context.strokeStyle = "#d1d5db"; context.lineWidth = 1.5; [-1, 1].forEach((offset) => { context.beginPath(); context.moveTo(73, -27 + offset * 3); context.lineTo(79, -27 + offset * 3); context.stroke(); });
    [-38, 43].forEach((wheel) => {
      context.fillStyle = "#1f2937";
      context.beginPath(); context.arc(wheel, -14, 15, 0, Math.PI * 2); context.fill();
      context.save(); context.translate(wheel, -14); context.rotate(wheelAngle);
      context.strokeStyle = "#e5e7eb"; context.lineWidth = 2.2;
      context.beginPath(); context.moveTo(-9, 0); context.lineTo(9, 0); context.moveTo(0, -9); context.lineTo(0, 9); context.stroke();
      context.restore();
      context.fillStyle = "#d1d5db"; context.beginPath(); context.arc(wheel, -14, 5, 0, Math.PI * 2); context.fill();
    });
    context.restore();
  }
  function drawGraph() {
    const analysis = UiPolicy.graphAnalysis(state.definition);
    const rows = analysis.geometry;
    const selected = state.phase === "instant" ? normalizedActiveWindowIndex() : Model.WINDOWS.length - 1;
    const target = analysis.target;
    const compact = view.height < 260;
    const left = view.width < 420 ? 44 : 58, top = compact ? 78 : 125, right = view.width - 18, bottom = view.height - (compact ? 30 : 40);
    canvas.dataset.graphHeight = String(Math.max(0, Math.round(bottom - top)));
    const { t0, t1, points, minX, maxX } = analysis;
    const sx = (time) => left + (time - t0) / (t1 - t0) * (right - left);
    const sy = (position) => bottom - (position - minX) / Math.max(.2, maxX - minX) * (bottom - top);
    context.fillStyle = "#fff"; context.fillRect(0, 0, view.width, view.height);
    const instantDemoActive = state.phase === "instant" && !locked;
    let instantDemo = null;
    if (instantDemoActive) {
      if (instantDemoStartedAt == null) instantDemoStartedAt = performance.now();
      const demoElapsed = reducedMotion
        ? Visuals.INSTANT_DEMO.travelMs * .62
        : instantDemoPaused ? instantDemoPausedElapsed : Math.max(0, performance.now() - instantDemoStartedAt);
      instantDemo = Visuals.instantDemoFrame(demoElapsed);
    }
    drawFrozenContext(Model.variablePosition(state.definition.variable, target), compact, instantDemo);
    context.strokeStyle = "#d1d5db"; context.lineWidth = 1; context.beginPath(); context.moveTo(left, top); context.lineTo(left, bottom); context.lineTo(right, bottom); context.stroke();
    context.fillStyle = "#374151"; context.font = "bold 11px system-ui"; context.textAlign = "left"; context.fillText("x / m", left + 6, top + 14); context.font = "11px system-ui"; context.textAlign = "right"; context.fillText("t / s", right, bottom + 30);
    for (let index = 0; index <= 3; index += 1) {
      const time = t0 + (t1 - t0) * index / 3;
      const x = sx(time);
      context.strokeStyle = "#e5e7eb"; context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom + 4); context.stroke();
      context.fillStyle = "#4b5563"; context.textAlign = "center"; context.fillText(Model.format3(time), x, bottom + 17);
      const position = minX + (maxX - minX) * index / 3;
      const y = sy(position);
      context.strokeStyle = "#e5e7eb"; context.beginPath(); context.moveTo(left - 4, y); context.lineTo(right, y); context.stroke();
      context.fillStyle = "#4b5563"; context.textAlign = "right"; context.fillText(Model.format3(position), left - 6, y + 4);
    }
    context.strokeStyle = "#2563eb"; context.lineWidth = 3; context.beginPath(); points.forEach((point, index) => index ? context.lineTo(sx(point.t), sy(point.x)) : context.moveTo(sx(point.t), sy(point.x))); context.stroke();
    context.strokeStyle = "#9333ea"; context.setLineDash([5, 5]); context.beginPath(); context.moveTo(sx(target), top); context.lineTo(sx(target), bottom); context.stroke(); context.setLineDash([]);
    if (selected >= 0) {
      const row = rows[selected]; context.strokeStyle = "#f59e0b"; context.lineWidth = 3; context.beginPath(); context.moveTo(sx(row.startTime), sy(row.startPosition)); context.lineTo(sx(row.endTime), sy(row.endPosition)); context.stroke();
      [[row.startTime, row.startPosition], [row.endTime, row.endPosition]].forEach(([time, position]) => { context.fillStyle = "#f59e0b"; context.beginPath(); context.arc(sx(time), sy(position), 5, 0, Math.PI * 2); context.fill(); });
    }
    const showSolution = UiPolicy.canRevealSolution({ locked, trustedReview, result });
    if (showSolution) {
      const velocity = Scoring.correctOption(state.definition).value;
      const centreX = Model.variablePosition(state.definition.variable, target);
      const dt = .32; context.strokeStyle = "#dc2626"; context.lineWidth = 2; context.setLineDash([8, 4]); context.beginPath(); context.moveTo(sx(target - dt), sy(centreX - velocity * dt)); context.lineTo(sx(target + dt), sy(centreX + velocity * dt)); context.stroke(); context.setLineDash([]);
    }
    const targetWorldPosition = Model.variablePosition(state.definition.variable, target);
    elements.positionReadout.textContent = `${Model.format3(targetWorldPosition)} m`;
    elements.timerReadout.textContent = `${Model.format3(target)} s`;
    elements.positionReadoutLabel.textContent = "目標位置";
    elements.timerReadoutLabel.textContent = "目標時刻";
    elements.positionReadout.setAttribute("aria-label", `目標位置 ${elements.positionReadout.textContent}`);
    elements.timerReadout.setAttribute("aria-label", `目標時刻 ${elements.timerReadout.textContent}`);
    const demoDescription = reducedMotion
      ? "靜態示意圖以淡色車影標記要研究的一刻；畫面不代表速度大小。"
      : instantDemoPaused
      ? "示範已暫停；可按「繼續示範」重看車輛通過目標位置。"
      : "示意動畫中，車輛通過中央金色標記後留下淡色車影；畫面不代表速度大小。";
    elements.motionStatus.textContent = instantDemoActive
      ? `${demoDescription}${showSolution ? "已揭示該點切線；其斜率代表瞬時速度。" : "請比較逐步縮短的割線。"}`
      : showSolution ? "已揭示目標點切線；其斜率代表瞬時速度。" : "目標瞬時速度仍未揭示；請比較逐步縮短的割線。";
  }
  function drawFrozenContext(position, compact, demoFrame = null) {
    const y = compact ? 35 : 66;
    const sky = compact ? 8 : 12;
    const road = compact ? 24 : 38;
    const ruler = y + sky + road;
    context.fillStyle = "#dbeafe"; context.fillRect(0, y - sky, view.width, sky * 2);
    context.fillStyle = "#4b5563"; context.fillRect(0, y + sky, view.width, road);
    context.strokeStyle = "#f8fafc"; context.setLineDash([18, 14]); context.beginPath(); context.moveTo(0, y + sky + road * .45); context.lineTo(view.width, y + sky + road * .45); context.stroke(); context.setLineDash([]);
    context.strokeStyle = "#111827"; context.lineWidth = 2; context.beginPath(); context.moveTo(0, ruler); context.lineTo(view.width, ruler); context.stroke();
    const scale = Math.max(10, Math.min(18, view.width / 25));
    const centreMetre = Math.floor(position);
    const tickRadius = Math.ceil(view.width / scale / 2) + 1;
    for (let offset = -tickRadius; offset <= tickRadius; offset += 1) {
      const metre = centreMetre + offset;
      const x = view.width / 2 + (metre - position) * scale;
      context.strokeStyle = metre % 5 === 0 ? "#111827" : "#6b7280";
      context.beginPath(); context.moveTo(x, ruler); context.lineTo(x, ruler - (metre % 5 === 0 ? 9 : 5)); context.stroke();
    }
    context.strokeStyle = "#f59e0b"; context.lineWidth = 2; context.beginPath(); context.moveTo(view.width / 2, y - sky + 4); context.lineTo(view.width / 2, ruler + 2); context.stroke();
    const carScale = Visuals.carScale(scale);
    if (demoFrame) {
      const geometry = Visuals.instantDemoGeometry(demoFrame, view.width, carScale);
      const wheelPosition = (geometry.carX - geometry.startX) / scale;
      if (demoFrame.ghostVisible) {
        context.save(); context.globalAlpha = .24;
        drawCar(geometry.targetX, y + sky + 5, carScale, Visuals.wheelAngle((geometry.targetX - geometry.startX) / scale));
        context.restore();
      }
      if (demoFrame.moving) drawCar(geometry.carX, y + sky + 5, carScale, Visuals.wheelAngle(wheelPosition));
    } else drawCar(view.width / 2, y + sky + 5, carScale, Visuals.wheelAngle(position));
  }
  function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value ?? ""); return span.innerHTML; }
  function feedbackHtml(value) {
    return escapeHtml(value)
      .replaceAll("Δt", "<var>Δt</var>");
  }
  function fractionHtml(numerator, denominator) {
    return `<span class="fraction"><span>${numerator}</span><span>${denominator}</span></span>`;
  }
  function feedbackFormulaHtml(formula) {
    if (!formula) return "";
    if (formula.kind === "average") {
      const displacement = `${quantityHtml(formula.x2, "m")} − ${quantityHtml(formula.x1, "m")}`;
      const aria = `位移大小等於終點位置 ${Model.format3(formula.x2)} 米減起點位置 ${Model.format3(formula.x1)} 米，等於 ${Model.format3(formula.displacement)} 米。平均速度大小等於位移大小除以經過時間，等於 ${Model.format3(formula.averageVelocity)} 米每秒。`;
      return `<div class="feedback-formula" role="math" aria-label="${escapeHtml(aria)}"><div><strong>位移大小</strong> = ${displacement} = ${quantityHtml(formula.displacement, "m")}</div><div><strong>平均速度大小</strong> = ${fractionHtml("位移大小", "經過時間")} = ${fractionHtml(quantityHtml(formula.displacement, "m"), quantityHtml(formula.time, "s"))} = ${quantityHtml(formula.averageVelocity, "m/s")}</div></div>`;
    }
    const sequence = formula.windows.map((row) => `<span class="limit-step"><span>時間間隔 = ${quantityHtml(row.duration, "s")}</span><span>→</span><span>平均速度大小 = ${quantityHtml(row.averageVelocity, "m/s")}</span></span>`).join("");
    const aria = `時間區間逐步縮短，平均速度依次趨近 ${Model.format3(formula.exact)} 米每秒。`;
    return `<div class="feedback-formula limit-formula" role="math" aria-label="${escapeHtml(aria)}">${sequence}<strong>→ 目標時刻的瞬時速度 = ${quantityHtml(formula.exact, "m/s")}</strong></div>`;
  }
  function feedbackItemHtml(item) {
    return `<article class="feedback-item ${item.correct ? "is-correct" : "is-wrong"}"><h3>${escapeHtml(item.title)}</h3><p>${feedbackHtml(item.text)}</p>${feedbackFormulaHtml(item.formula)}</article>`;
  }

  elements.observeButton.addEventListener("click", startOrResume);
  elements.pauseButton.addEventListener("click", pause);
  elements.resetButton.addEventListener("click", resetMeasurement);
  elements.timerButton.addEventListener("click", stopwatch);
  elements.measurementForm.addEventListener("submit", submitMeasurement);
  elements.longerWindowButton.addEventListener("click", showLongerWindow);
  elements.shorterWindowButton.addEventListener("click", showShorterWindow);
  elements.demoToggleButton.addEventListener("click", toggleInstantDemo);
  elements.instantForm.addEventListener("submit", submitInstant);
  elements.previousStageButton.addEventListener("click", previousStage);
  elements.nextStageButton.addEventListener("click", nextStage);
  [elements.displacementInput, elements.timeInput, elements.averageInput].forEach((input) => input.addEventListener("input", syncMeasurementDraftFromForm));
  relationshipInputs.forEach((input) => input.addEventListener("change", syncMeasurementDraftFromForm));
  elements.optionChoices.addEventListener("change", syncInstantDraftFromForm);
  conceptInputs.forEach((input) => input.addEventListener("change", syncInstantDraftFromForm));
  elements.stoppedInput.addEventListener("input", syncInstantDraftFromForm);
  elements.submitButton.addEventListener("click", submitAll);
  elements.retryButton.addEventListener("click", retrySubmission);
  elements.reviewRetryButton.addEventListener("click", retrySubmission);
  new ResizeObserver(resize).observe(canvas);

  const attempt = window.SimScorm.loadAttempt(ACTIVITY);
  const startup = window.SimActivityFlow.startup(attempt);
  const startupView = Persistence.startupView(startup);
  if (startupView.mode === "review") restoreFinished(attempt);
  else if (startupView.mode === "activity") {
    try {
      if (attempt.state === "draft") {
        state = Persistence.decode(attempt.snapshot?.answer);
        if (!state && UiPolicy.isLegacySnapshot(attempt.snapshot?.answer, Persistence.VERSION)) {
          state = Persistence.initialState(Model.createAttempt());
          announce("活動已更新；舊開發版本草稿不能安全沿用，現已開始新版活動。");
        }
      } else state = Persistence.initialState(Model.createAttempt());
      if (!state) throw new Error("Invalid draft");
      const restoredRuntime = Persistence.runtimeFlagsForRestore(state);
      running = restoredRuntime.running;
      timerRunning = restoredRuntime.timerRunning;
      locked = false;
      if (state.phase === "uniform" || state.phase === "variable") loadMeasurementForm(state.draftAnswers[state.phase]); else if (state.phase === "instant") loadInstantForm();
      window.SimScorm.setDraftProvider(draftSnapshot);
      if (attempt.state !== "new" || saveDraft()) render();
    } catch (error) { locked = true; showTechnical("未能安全載入或產生本次題目，活動已鎖定。", false); console.warn(error); }
  } else if (startupView.mode === "pending") { locked = true; retryMode = "pending"; showTechnical("上次提交仍待確認；答案已凍結，請重試同一份提交。", true); }
  else { locked = true; showTechnical("未能讀取 Moodle 嘗試資料，活動已鎖定。", false); }
  frameId = requestAnimationFrame(animate);
  window.addEventListener("unload", () => cancelAnimationFrame(frameId), { once: true });
})();
