(function () {
  "use strict";

  const Model = window.LinearMotionModel;
  const Scoring = window.LinearMotionScoring;
  const Persistence = window.LinearMotionPersistence;
  if (!Model || !Scoring || !Persistence) throw new Error("Linear-motion modules were not loaded");

  const ACTIVITY = "linear-motion-velocity-lab";
  const canvas = document.getElementById("motionCanvas");
  const context = canvas.getContext("2d");
  const elements = Object.fromEntries(Array.from(document.querySelectorAll("[id]")).map((element) => [element.id, element]));
  const progressItems = Array.from(document.querySelectorAll("[data-progress]"));
  const relationshipInputs = Array.from(document.querySelectorAll("input[name=relationship]"));
  const conceptInputs = Array.from(document.querySelectorAll("input[name=concept]"));
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
  let view = { width: 800, height: 500, dpr: 1 };

  function announce(message) { elements.liveRegion.textContent = ""; requestAnimationFrame(() => { elements.liveRegion.textContent = message; }); }
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
    const readingOrigin = measurement?.readingOrigin ?? Model.rollingReadingOrigin(worldPosition);
    return Model.readingPosition(worldPosition, readingOrigin);
  }
  function activeDuration() { return timerRunning && currentMeasurement() ? state.scene.simulationTime - currentMeasurement().startModelTime : currentMeasurement()?.dt || 0; }
  function minimumDuration() { return state.phase === "variable" ? Model.cycleDuration(state.definition.variable) : 1.5; }
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
      const time = state.scene.simulationTime;
      const readingOrigin = Model.rollingReadingOrigin(positionAt(time));
      const measurement = {
        startModelTime: time, currentOrEndModelTime: time, readingOrigin,
        x1: Model.canonicalNumber(Model.readingPosition(positionAt(time), readingOrigin)), x2: null, dt: 0
      };
      setCurrentMeasurement(measurement);
      state.answers[state.phase] = null;
      state.variant = state.returnToReview ? "review-edit-paused-measuring" : "paused-measuring";
      timerRunning = true;
      announce(`已記錄起點 ${Model.format3(measurement.x1)} m，開始計時。`);
      if (!saveDraft()) return;
      render();
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
  function submitMeasurement(event) {
    event.preventDefault();
    if (locked || !currentMeasurement()?.x2) return;
    const parsed = [elements.displacementInput, elements.timeInput, elements.averageInput].map((input) => Model.normalizeInput(input.value));
    const relationship = relationshipInputs.find((input) => input.checked)?.value;
    if (parsed.some((item) => !item)) return void (elements.answerError.textContent = "請用三位有效數字，例如 5.00 或 1.00e2；不要輸入單位。");
    if (!relationship) return void (elements.answerError.textContent = "請回答瞬時速度與平均速度的關係。");
    state.answers[state.phase] = {
      displacement: parsed[0].text, time: parsed[1].text, averageVelocity: parsed[2].text, relationship
    };
    state.variant = state.returnToReview ? "review-edit-answered" : "answered";
    elements.answerError.textContent = "";
    announce("本關答案已記錄，提交前仍可修改。");
    if (!saveDraft()) return;
    render();
  }

  function advance() {
    const next = Persistence.next(state, state.returnToReview ? "return-review" : state.phase === "instant" ? "review" : "advance");
    if (!next) return;
    state = next;
    running = false;
    timerRunning = false;
    if (state.phase === "variable") clearMeasurementForm();
    announce(state.phase === "review" ? "已進入提交前檢查。" : state.phase === "instant" ? "已進入時間放大鏡。" : "已進入下一關。");
    if (!saveDraft()) return;
    render();
  }
  function nextWindow() {
    if (locked || state.phase !== "instant" || state.viewedWindowCount >= 4) return;
    state.viewedWindowCount += 1;
    announce(`已顯示第 ${state.viewedWindowCount} 個時間區間。`);
    if (!saveDraft()) return;
    render();
  }
  function submitInstant(event) {
    event.preventDefault();
    const predictionChoice = document.querySelector("input[name=prediction]:checked")?.value;
    const concept = conceptInputs.find((input) => input.checked)?.value;
    const stopped = Model.normalizeInput(elements.stoppedInput.value);
    if (!predictionChoice || !concept) return void (elements.instantError.textContent = "請完成兩條選擇題。");
    if (!stopped) return void (elements.instantError.textContent = "停止速度請用三位有效數字，例如 0.00。");
    state.answers.instant = { predictionChoice, concept, stoppedVelocity: stopped.text };
    state.variant = state.returnToReview ? "review-edit-answered" : "answered";
    elements.instantError.textContent = "";
    announce("時間放大鏡答案已記錄，現在顯示切線和模型值。");
    if (!saveDraft()) return;
    render();
  }
  function editStage(stage) {
    if (locked || state.phase !== "review") return;
    state = Persistence.next(state, ["edit-uniform", "edit-variable", "edit-instant"][stage]);
    if (!state) return;
    running = false;
    timerRunning = false;
    if (stage < 2) loadMeasurementForm(state.answers[state.phase]);
    else loadInstantForm();
    announce(`返回第 ${stage + 1} 關修改答案。`);
    if (!saveDraft()) return;
    render();
  }
  function loadInstantForm() {
    const answer = state.answers.instant;
    document.querySelectorAll("input[name=prediction]").forEach((input) => { input.checked = input.value === answer?.predictionChoice; });
    conceptInputs.forEach((input) => { input.checked = input.value === answer?.concept; });
    elements.stoppedInput.value = answer?.stoppedVelocity || "";
  }

  function submitAll() {
    if (locked || state.phase !== "review" || !window.confirm("確認提交全部答案？提交後本次嘗試只可重看。")) return;
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
        result = Scoring.scoreAttempt(review.definition, review.uniformMeasurement, review.variableMeasurement, review.answers);
        trustedReview = true;
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
    elements.feedbackList.innerHTML = `<div class="feedback-item"><p>${escapeHtml(message)}</p></div>` + items.map((item) => `<article class="feedback-item ${item.correct ? "is-correct" : "is-wrong"}"><h3>${escapeHtml(item.title)}</h3><p aria-label="${escapeHtml(item.text)}">${feedbackHtml(item.text)}</p></article>`).join("");
    elements.retryButton.classList.toggle("is-hidden", !retryable);
    elements.retryButton.textContent = retryMode === "finish" ? "重試完成連線" : "重試連線";
    const detail = items.map((item) => `${item.title}。${item.text}`).join(" ");
    announce(`${elements.resultTitle.textContent}。${elements.scorePanel.textContent}。${message}${detail ? ` ${detail}` : ""}`);
    elements.resultTitle.focus({ preventScroll: true });
  }

  function render() {
    if (!state) return drawEmpty();
    setGraphLayout(state.phase === "instant" || state.phase === "review" || locked);
    const stageIndex = state.stage;
    progressItems.forEach((item, index) => { item.classList.toggle("is-current", index === stageIndex); item.classList.toggle("is-done", index < stageIndex); });
    elements.activitySection.classList.toggle("is-hidden", state.phase === "review" || locked);
    elements.reviewSection.classList.toggle("is-hidden", state.phase !== "review" || locked);
    if (!locked) elements.resultSection.classList.add("is-hidden");
    if (state.phase === "review") renderReview();
    else if (state.phase === "instant") renderInstant();
    else renderMeasurementStage();
    if (["uniform", "variable"].includes(state.phase)) renderLiveReadouts(false);
    draw();
  }
  function setGraphLayout(graph) { canvas.parentElement.classList.toggle("is-graph", graph); }
  function renderMeasurementStage() {
    const variable = state.phase === "variable";
    elements.stageKicker.textContent = variable ? "第 2 關" : "第 1 關";
    elements.stageTitle.textContent = variable ? "變速運動" : "勻速運動";
    elements.instructionText.textContent = variable ? "量度至少一個完整週期，觀察慢、快和短暫停止。" : "操作計時器記錄 x₁、x₂ 和經過時間。";
    elements.relationshipLegend.innerHTML = variable
      ? "在這段變速直線運動中，車在每一時刻的 |<var>v</var>(<var>t</var>)| 是否都等於這段時間的 |<var class=\"overbar\">v</var>|？"
      : "在這段勻速直線運動中，車在每一時刻的 |<var>v</var>(<var>t</var>)| 是否都等於這段時間的 |<var class=\"overbar\">v</var>|？";
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
    const answered = state.variant.endsWith("answered");
    elements.navigationControls.classList.toggle("is-hidden", !answered);
    elements.advanceButton.classList.toggle("is-hidden", state.returnToReview);
    elements.advanceButton.textContent = variable ? "前往時間放大鏡" : "前往變速運動";
    elements.returnReviewButton.classList.toggle("is-hidden", !state.returnToReview);
    if (answered) loadMeasurementForm(state.answers[state.phase]);
  }
  function renderMeasurementProgress() {
    const measurement = currentMeasurement();
    const captured = measurement?.x2 != null;
    const answered = state.variant.endsWith("answered");
    const control = Persistence.measurementControlState({ timerRunning, duration: activeDuration(), minimum: minimumDuration(), captured, answered });
    if (measurement && !timerRunning) setQuantityValue(elements.dtReadout, activeDuration(), "s");
    else {
      elements.dtReadout.textContent = measurement ? `${Model.format3(activeDuration())} s` : "--";
      elements.dtReadout.setAttribute("aria-label", measurement ? `${Model.format3(activeDuration())} s` : "經過時間，未記錄");
    }
    elements.timerButton.textContent = control.label;
    elements.timerButton.classList.toggle("is-running", timerRunning);
    elements.timerButton.disabled = control.disabled;
    const remaining = Math.max(0, minimumDuration() - activeDuration());
    elements.progressMessage.textContent = timerRunning && remaining > 0
      ? state.phase === "variable" ? `請繼續量度，直至觀察到快、慢和短暫停止；尚欠約 ${Model.format3(remaining)} s。` : `尚需量度 ${Model.format3(remaining)} s。`
      : timerRunning ? "已達最低量度時間，可自行按停止計時；觀察不會自動暫停。" : captured ? "量度已完成；觀察可繼續，如要更改讀數請先按重新量度。" : `最低量度時間：${Model.format3(minimumDuration())} s。`;
  }
  function renderInstant() {
    elements.stageKicker.textContent = "第 3 關";
    elements.stageTitle.textContent = "時間放大鏡";
    elements.instructionText.textContent = "同一目標時刻前的區間愈短，平均速度會趨近瞬時速度。";
    elements.observationControls.classList.add("is-hidden");
    elements.timerButton.classList.add("is-hidden");
    elements.progressMessage.classList.add("is-hidden");
    elements.measurementCard.classList.add("is-hidden");
    elements.measurementForm.classList.add("is-hidden");
    elements.instantControls.classList.remove("is-hidden");
    const rows = Model.analysisWindows(state.definition).slice(0, state.viewedWindowCount);
    elements.windowRows.innerHTML = rows.map((row) => `<tr><td>${quantityHtml(row.duration, "s")}</td><td>${quantityHtml(row.startTime, "s")}，${quantityHtml(row.startPosition, "m")}</td><td>${quantityHtml(row.endTime, "s")}，${quantityHtml(row.endPosition, "m")}</td><td>${quantityHtml(row.averageVelocity, "m/s")}</td></tr>`).join("");
    elements.nextWindowButton.classList.toggle("is-hidden", state.viewedWindowCount >= 4);
    if (state.viewedWindowCount < 4) elements.nextWindowButton.innerHTML = `顯示 ${quantityHtml(state.definition.windows[state.viewedWindowCount], "s")} 區間`;
    elements.instantForm.classList.toggle("is-hidden", state.viewedWindowCount < 4);
    if (!elements.optionChoices.children.length) elements.optionChoices.innerHTML = state.definition.instantOptions.map((option) => `<label><input type="radio" name="prediction" value="${option.id}" aria-label="${Model.format3(option.value)} 米每秒"> ${quantityHtml(option.value, "m/s")}</label>`).join("");
    const answered = state.variant.endsWith("answered");
    elements.revealCard.classList.toggle("is-hidden", !answered);
    if (answered) {
      loadInstantForm();
      elements.revealCard.innerHTML = `模型在目標時刻的瞬時速度 <var>v</var>(<var>t</var><sup>*</sup>) 是 ${quantityHtml(Scoring.correctOption(state.definition).value, "m/s")}；圖中虛線顯示該點切線。`;
    }
    elements.navigationControls.classList.toggle("is-hidden", !answered);
    elements.advanceButton.classList.toggle("is-hidden", state.returnToReview);
    elements.advanceButton.textContent = "前往提交前檢查";
    elements.returnReviewButton.classList.toggle("is-hidden", !state.returnToReview);
  }
  function renderReview() {
    elements.reviewList.innerHTML = [
      reviewItem(0, "勻速運動", state.uniformMeasurement, state.answers.uniform),
      reviewItem(1, "變速運動", state.variableMeasurement, state.answers.variable),
      `<article class="review-item"><h3>時間放大鏡</h3><p>瞬時速度 <var>v</var>(<var>t</var><sup>*</sup>) 估計：${quantityHtml(state.definition.instantOptions.find((option) => option.id === state.answers.instant.predictionChoice).value, "m/s")}</p><p>概念答案：${escapeHtml(conceptLabel(state.answers.instant.concept))}</p><p>完全停止期間：${quantityHtml(Model.normalizeInput(state.answers.instant.stoppedVelocity).value, "m/s")}</p><button type="button" data-edit="2">修改第 3 關</button></article>`
    ].join("");
    elements.reviewList.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editStage(Number(button.dataset.edit))));
  }
  function reviewItem(index, title, measurement, answer) {
    return `<article class="review-item"><h3>${title}</h3><p>讀數：<var>x</var><sub>1</sub> = ${quantityHtml(measurement.x1, "m")}；<var>x</var><sub>2</sub> = ${quantityHtml(measurement.x2, "m")}；<var>Δt</var> = ${quantityHtml(measurement.dt, "s")}</p><p>答案：|<var>Δx</var>| = ${quantityHtml(Model.normalizeInput(answer.displacement).value, "m")}；<var>Δt</var> = ${quantityHtml(Model.normalizeInput(answer.time).value, "s")}；|<var class="overbar">v</var>| = ${quantityHtml(Model.normalizeInput(answer.averageVelocity).value, "m/s")}；每一時刻關係：${answer.relationship === "yes" ? "是" : "否"}</p><button type="button" data-edit="${index}">修改第 ${index + 1} 關</button></article>`;
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
    frameId = requestAnimationFrame(animate);
  }
  function renderLiveReadouts(announceBoundary) {
    elements.positionReadout.textContent = `${Model.format3(displayedPositionAt())} m`;
    elements.timerReadout.textContent = `${Model.format3(timerRunning ? activeDuration() : currentMeasurement()?.dt || 0)} s`;
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
    const w = view.width, h = view.height, horizon = h * .45, roadTop = h * .55;
    context.fillStyle = "#dbeafe"; context.fillRect(0, 0, w, roadTop);
    context.fillStyle = "#bbd7a8"; context.fillRect(0, horizon, w, roadTop - horizon);
    const worldPosition = positionAt();
    const position = displayedPositionAt();
    context.fillStyle = "#4b5563"; context.fillRect(0, roadTop, w, h - roadTop);
    context.strokeStyle = "#f8fafc"; context.lineWidth = 3; context.setLineDash([28, 22]); context.beginPath(); context.moveTo(0, roadTop + (h - roadTop) * .37); context.lineTo(w, roadTop + (h - roadTop) * .37); context.stroke(); context.setLineDash([]);
    const pixelsPerMetre = Math.max(16, Math.min(28, w / 24));
    const centreMetre = Math.floor(position);
    const tickRadius = Math.ceil(w / pixelsPerMetre / 2) + 2;
    for (let offset = -tickRadius; offset <= tickRadius; offset += 1) {
      const metre = centreMetre + offset;
      const x = w / 2 + (metre - position) * pixelsPerMetre;
      const major = metre % 10 === 0;
      context.strokeStyle = major ? "#111827" : "#6b7280"; context.lineWidth = major ? 2 : 1;
      context.beginPath(); context.moveTo(x, h - 31); context.lineTo(x, h - (major ? 55 : 43)); context.stroke();
      if (major) { context.fillStyle = "#111827"; context.font = "bold 12px ui-monospace, monospace"; context.textAlign = "center"; context.fillText(Model.format3(metre), x, h - 10); }
    }
    context.strokeStyle = "#111827"; context.lineWidth = 3; context.beginPath(); context.moveTo(0, h - 31); context.lineTo(w, h - 31); context.stroke();
    drawLandmarks(worldPosition, pixelsPerMetre, horizon, roadTop);
    drawCar(w / 2, roadTop - 8, Math.min(1.15, w / 520));
    context.strokeStyle = "#f59e0b"; context.lineWidth = 3; context.beginPath(); context.moveTo(w / 2, roadTop - 90); context.lineTo(w / 2, h - 30); context.stroke();
    context.fillStyle = "#92400e"; context.textAlign = "center"; context.font = "bold 12px system-ui"; context.fillText("量度指針", w / 2, roadTop - 98);
  }
  function drawLandmarks(position, scale, horizon, roadTop) {
    const spacing = 18;
    for (let index = -2; index < 5; index += 1) {
      const world = Math.floor(position / spacing) * spacing + index * spacing;
      const x = view.width / 2 + (world - position) * scale;
      context.fillStyle = index % 2 ? "#64748b" : "#588157";
      if (index % 2) { context.fillRect(x - 13, horizon - 32, 26, 32); context.fillStyle = "#f8fafc"; context.fillRect(x - 7, horizon - 24, 5, 7); context.fillRect(x + 3, horizon - 24, 5, 7); }
      else { context.fillRect(x - 3, horizon - 18, 6, 22); context.beginPath(); context.arc(x, horizon - 31, 17, 0, Math.PI * 2); context.fill(); }
    }
  }
  function drawCar(x, ground, scale) {
    context.save(); context.translate(x, ground); context.scale(scale, scale);
    context.fillStyle = "rgba(15,23,42,.2)"; context.beginPath(); context.ellipse(2, 1, 78, 8, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#e4554f"; context.strokeStyle = "#8f2d32"; context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-72, -18); context.lineTo(-71, -40); context.quadraticCurveTo(-68, -49, -56, -50);
    context.lineTo(-31, -52); context.lineTo(-18, -69); context.quadraticCurveTo(-14, -74, -6, -74);
    context.lineTo(22, -74); context.quadraticCurveTo(29, -73, 34, -67); context.lineTo(47, -52);
    context.lineTo(66, -47); context.quadraticCurveTo(76, -44, 79, -34); context.lineTo(82, -23);
    context.quadraticCurveTo(82, -17, 74, -16); context.lineTo(-64, -16); context.quadraticCurveTo(-72, -16, -72, -18);
    context.closePath(); context.fill(); context.stroke();

    context.fillStyle = "#bfdbfe"; context.strokeStyle = "#64748b"; context.lineWidth = 2;
    context.beginPath(); context.moveTo(-14, -68); context.lineTo(-26, -52); context.lineTo(5, -52); context.lineTo(5, -68); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(11, -68); context.lineTo(22, -68); context.lineTo(40, -52); context.lineTo(11, -52); context.closePath(); context.fill(); context.stroke();
    context.strokeStyle = "#8f2d32"; context.beginPath(); context.moveTo(8, -51); context.lineTo(8, -18); context.stroke();
    context.beginPath(); context.moveTo(47, -49); context.quadraticCurveTo(60, -47, 71, -42); context.stroke();
    context.fillStyle = "#fef3c7"; context.strokeStyle = "#92400e"; context.beginPath(); context.moveTo(69, -41); context.lineTo(78, -37); context.lineTo(79, -29); context.lineTo(68, -31); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = "#7f1d1d"; context.fillRect(-73, -39, 7, 12);
    context.fillStyle = "#374151"; context.fillRect(76, -23, 10, 7); context.fillRect(-75, -21, 10, 5);
    context.strokeStyle = "#d1d5db"; context.lineWidth = 1.5; [-1, 1].forEach((offset) => { context.beginPath(); context.moveTo(77, -27 + offset * 3); context.lineTo(82, -27 + offset * 3); context.stroke(); });
    context.fillStyle = "#1f2937"; [-42, 46].forEach((wheel) => {
      context.beginPath(); context.arc(wheel, -14, 15, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#d1d5db"; context.beginPath(); context.arc(wheel, -14, 6, 0, Math.PI * 2); context.fill(); context.fillStyle = "#1f2937";
    });
    context.restore();
  }
  function drawGraph() {
    const rows = Model.analysisWindows(state.definition);
    const count = state.phase === "instant" ? state.viewedWindowCount : 4;
    const target = Model.targetSceneTime(state.definition);
    const compact = view.height < 260;
    const left = view.width < 420 ? 44 : 58, top = compact ? 78 : 125, right = view.width - 18, bottom = view.height - (compact ? 30 : 40);
    canvas.dataset.graphHeight = String(Math.max(0, Math.round(bottom - top)));
    const t0 = target - 2.25, t1 = target + .35;
    const points = Array.from({ length: 90 }, (_, index) => { const t = t0 + (t1 - t0) * index / 89; return { t, x: Model.variablePosition(state.definition.variable, t) }; });
    const minX = Math.min(...points.map((point) => point.x)), maxX = Math.max(...points.map((point) => point.x));
    const sx = (time) => left + (time - t0) / (t1 - t0) * (right - left);
    const sy = (position) => bottom - (position - minX) / Math.max(.2, maxX - minX) * (bottom - top);
    context.fillStyle = "#fff"; context.fillRect(0, 0, view.width, view.height);
    drawFrozenContext(Model.variablePosition(state.definition.variable, target), compact);
    context.strokeStyle = "#d1d5db"; context.lineWidth = 1; context.beginPath(); context.moveTo(left, top); context.lineTo(left, bottom); context.lineTo(right, bottom); context.stroke();
    context.fillStyle = "#374151"; context.font = "11px system-ui"; context.textAlign = "left"; context.fillText("x / m", left, top - 8); context.textAlign = "right"; context.fillText("t / s", right, bottom + 30);
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
    if (count) {
      const row = rows[count - 1]; context.strokeStyle = "#f59e0b"; context.lineWidth = 3; context.beginPath(); context.moveTo(sx(row.startTime), sy(row.startPosition)); context.lineTo(sx(row.endTime), sy(row.endPosition)); context.stroke();
      [[row.startTime, row.startPosition], [row.endTime, row.endPosition]].forEach(([time, position]) => { context.fillStyle = "#f59e0b"; context.beginPath(); context.arc(sx(time), sy(position), 5, 0, Math.PI * 2); context.fill(); });
    }
    if (state.answers.instant || locked) {
      const velocity = Scoring.correctOption(state.definition).value;
      const centreX = Model.variablePosition(state.definition.variable, target);
      const dt = .32; context.strokeStyle = "#dc2626"; context.lineWidth = 2; context.setLineDash([8, 4]); context.beginPath(); context.moveTo(sx(target - dt), sy(centreX - velocity * dt)); context.lineTo(sx(target + dt), sy(centreX + velocity * dt)); context.stroke(); context.setLineDash([]);
    }
    const targetWorldPosition = Model.variablePosition(state.definition.variable, target);
    elements.positionReadout.textContent = `${Model.format3(targetWorldPosition)} m`;
    elements.timerReadout.textContent = `${Model.format3(target)} s`;
    elements.motionStatus.textContent = state.answers.instant ? "已揭示目標點切線；其斜率代表瞬時速度。" : "目標瞬時速度仍未揭示；請比較逐步縮短的割線。";
  }
  function drawFrozenContext(position, compact) {
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
    drawCar(view.width / 2, y + sky + 5, compact ? .2 : .28);
    context.strokeStyle = "#f59e0b"; context.lineWidth = 2; context.beginPath(); context.moveTo(view.width / 2, y - sky + 4); context.lineTo(view.width / 2, ruler + 2); context.stroke();
  }
  function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value ?? ""); return span.innerHTML; }
  function feedbackHtml(value) {
    return escapeHtml(value)
      .replaceAll("|Δx|", "|<var>Δx</var>|")
      .replaceAll("|v̄|", "|<var class=\"overbar\">v</var>|")
      .replaceAll("v(t*)", "<var>v</var>(<var>t</var><sup>*</sup>)")
      .replaceAll("Δt", "<var>Δt</var>");
  }

  elements.observeButton.addEventListener("click", startOrResume);
  elements.pauseButton.addEventListener("click", pause);
  elements.resetButton.addEventListener("click", resetMeasurement);
  elements.timerButton.addEventListener("click", stopwatch);
  elements.measurementForm.addEventListener("submit", submitMeasurement);
  elements.nextWindowButton.addEventListener("click", nextWindow);
  elements.instantForm.addEventListener("submit", submitInstant);
  elements.advanceButton.addEventListener("click", advance);
  elements.returnReviewButton.addEventListener("click", advance);
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
      state = attempt.state === "draft" ? Persistence.decode(attempt.snapshot?.answer) : Persistence.initialState(Model.createAttempt());
      if (!state) throw new Error("Invalid draft");
      const restoredRuntime = Persistence.runtimeFlagsForRestore(state);
      running = restoredRuntime.running;
      timerRunning = restoredRuntime.timerRunning;
      locked = false;
      if (state.phase === "uniform" || state.phase === "variable") loadMeasurementForm(state.answers[state.phase]); else if (state.phase === "instant") loadInstantForm();
      window.SimScorm.setDraftProvider(draftSnapshot);
      if (attempt.state !== "new" || saveDraft()) render();
    } catch (error) { locked = true; showTechnical("未能安全載入或產生本次題目，活動已鎖定。", false); console.warn(error); }
  } else if (startupView.mode === "pending") { locked = true; retryMode = "pending"; showTechnical("上次提交仍待確認；答案已凍結，請重試同一份提交。", true); }
  else { locked = true; showTechnical("未能讀取 Moodle 嘗試資料，活動已鎖定。", false); }
  frameId = requestAnimationFrame(animate);
  window.addEventListener("unload", () => cancelAnimationFrame(frameId), { once: true });
})();
