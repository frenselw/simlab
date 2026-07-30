(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.FreeFallModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.FreeFallScoring;
  const persistence = typeof module === "object" && module.exports ? require("./persistence.js") : root.FreeFallPersistence;
  const api = factory(model, scoring, persistence);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FreeFallApp = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.boot);
})(typeof window !== "undefined" ? window : globalThis, function (Model, Scoring, Persistence) {
  "use strict";

  const ACTIVITY = "free-fall-stroboscopic-measurement-lab";
  const SVG_W = 360;
  const SVG_H = 440;
  const BALL_X = 170;
  const RULER_W = 54;
  const PARK = Object.freeze({ x: 292, y: 28 });
  const RATIO_DEFINITIONS = Object.freeze([
    ["cumulativeTimeRatio", "累積時間比 t₁:t₂:t₃:t₄", false],
    ["totalDisplacementRatio", "總位移比 s₁:s₂:s₃:s₄（按讀數約化）", true],
    ["intervalTimeRatio", "每段時間比 Δt₁:Δt₂:Δt₃:Δt₄", false],
    ["intervalDistanceRatio", "相鄰距離比 Δs₁:Δs₂:Δs₃:Δs₄（按讀數約化）", true]
  ]);

  function startupView(outcome) {
    return {
      editable: outcome === "editable", locked: outcome !== "editable",
      mode: outcome === "review" ? "review" : outcome === "frozen" ? "pending" :
        outcome === "editable" ? "activity" : "technical"
    };
  }
  function submissionView(outcome) {
    const state = outcome?.activityState || "retry";
    if (state === "success") return { locked: true, mode: "review", trusted: true, retry: "none" };
    if (state === "committed") return { locked: true, mode: "committed", trusted: true, retry: "finish" };
    if (state === "frozen") return { locked: true, mode: "pending", trusted: false, retry: "pending" };
    return { locked: !outcome?.retryable, mode: "technical", trusted: false, retry: outcome?.retryable ? "resubmit" : "none" };
  }
  function canonicalReviewMatches(review, payload, score) {
    if (!review || !payload || typeof payload.reviewJson !== "string" ||
        !Number.isFinite(payload.score) || payload.maxScore !== 100 || typeof payload.passed !== "boolean") return false;
    try {
      const saved = JSON.parse(payload.reviewJson);
      if (!saved || saved.version !== 1 || saved.activity !== ACTIVITY || saved.kind !== "review" ||
          !Number.isFinite(saved.score) || typeof saved.passed !== "boolean") return false;
      const decoded = Persistence.decodeReview(saved?.answer);
      if (!decoded || JSON.stringify(decoded) !== JSON.stringify(review)) return false;
      const computed = Scoring.scoreAttempt(decoded);
      return computed.maxScore === 100 && computed.score === saved.score && computed.passed === saved.passed &&
        saved.score === payload.score && saved.passed === payload.passed &&
        computed.score === score.score && computed.passed === score.passed;
    } catch { return false; }
  }
  function resultFeedbackItems(review, result) {
    if (!review || !result?.detail) return [];
    const frequency = review.frequencyHz;
    const totals = Scoring.expectedTotals(frequency);
    const gaps = Scoring.expectedGaps(frequency);
    const ideal = (values) => values.map((value) => value.toFixed(3)).join("、");
    const tolerances = (values) => values.map((value) => `±${Scoring.distanceTolerance(value).toFixed(3)}`).join("、");
    return [
      `相鄰影像時間理想值為 ${Model.deltaT(frequency).toFixed(4)} s，接受絕對誤差 ±${Scoring.DELTA_T_ABS_TOLERANCE_S.toFixed(3)} s。`,
      `P₀ 至 P₁–P₄ 的理想總位移為 ${ideal(totals)} m；各項容差為 ${tolerances(totals)} m。`,
      `四段理想相鄰距離為 ${ideal(gaps)} m；各項容差為 ${tolerances(gaps)} m。`,
      "理想累積時間比 1:2:3:4、總位移比 1:4:9:16、每段時間比 1:1:1:1、相鄰距離比 1:3:5:7；距離比例分按你的正有限讀數約化。",
      ...Scoring.measurementDiagnostic(review, result)
    ];
  }

  function boot() {
    const $ = (id) => document.getElementById(id);
    const dom = {
      stage: $("stage"), scene: $("scene"), trajectory: $("trajectoryGroup"), rulerGraphic: $("rulerGraphic"),
      ruler: $("rulerHandle"), magnifier: $("magnifier"), magnifierReadout: $("magnifierReadout"), stageHint: $("stageHint"), panel: $("controlPanel"),
      badge: $("phaseBadge"), setup: $("setupSection"), measurement: $("measurementSection"),
      analysis: $("analysisSection"), review: $("reviewSection"), result: $("resultSection"),
      technical: $("technicalSection"), technicalTitle: $("technicalTitle"), technicalMessage: $("technicalMessage"),
      technicalRetry: $("technicalRetry"), generate: $("generateButton"), measurementTitle: $("measurementTitle"),
      measurementPrompt: $("measurementPrompt"), placementStatus: $("placementStatus"), readingLabel: $("readingLabel"),
      reading: $("readingInput"), measurementError: $("measurementError"), record: $("recordButton"), skip: $("skipButton"),
      park: $("parkButton"), returnReview: $("returnReviewButton"), deltaT: $("deltaTInput"),
      ratioGroups: $("ratioGroups"), analysisError: $("analysisError"), reviewButton: $("reviewButton"),
      reviewTitle: $("reviewTitle"), reviewContent: $("reviewContent"), reviewEdits: $("reviewEdits"),
      submit: $("submitButton"), submissionNotice: $("submissionNotice"), submissionRetry: $("submissionRetry"),
      resultTitle: $("resultTitle"), scorePanel: $("scorePanel"), resultFeedback: $("resultFeedback"),
      resultRetry: $("resultRetry"), live: $("liveRegion")
    };
    let state = Persistence.initialState();
    let locked = false;
    let ruler = { ...PARK };
    let drag = null;
    let movementStart = { ...PARK };
    let movementNorm = 0;
    let lastCompletedRuler = { ...PARK };
    let latestResult = null;
    let latestReview = null;

    buildRatioInputs();
    bind();
    const attempt = SimScorm.loadAttempt(ACTIVITY);
    const outcome = SimActivityFlow.startup(attempt);
    routeStartup(outcome, attempt);

    function buildRatioInputs() {
      dom.ratioGroups.replaceChildren(...RATIO_DEFINITIONS.map(([key, title]) => {
        const section = document.createElement("section");
        section.className = "ratio-group";
        section.dataset.ratio = key;
        const heading = document.createElement("h3");
        heading.textContent = title;
        section.append(heading);
        const row = document.createElement("div");
        row.className = "ratio-inputs";
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", title);
        const first = document.createElement("output");
        first.textContent = "1";
        row.append(first);
        for (let index = 1; index < 4; index += 1) {
          const colon = document.createElement("span");
          colon.textContent = ":";
          const input = document.createElement("input");
          input.inputMode = "decimal";
          input.dataset.ratioKey = key;
          input.dataset.term = String(index + 1);
          input.setAttribute("aria-label", `${title}，第 ${index + 1} 項`);
          row.append(colon, input);
        }
        const insufficient = document.createElement("p");
        insufficient.className = "muted is-hidden";
        insufficient.dataset.insufficient = key;
        insufficient.textContent = "量度數據不足，不能約化；確認後此部分為 0 分。";
        section.append(row, insufficient);
        return section;
      }));
    }
    function bind() {
      document.querySelectorAll("[data-frequency]").forEach((button) => button.addEventListener("click", () => selectFrequency(Number(button.dataset.frequency))));
      document.querySelectorAll("[data-reset-frequency]").forEach((button) => button.addEventListener("click", resetFrequency));
      dom.generate.addEventListener("click", () => {
        const next = Persistence.generate(state);
        if (next) { state = next; ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; checkpoint(); render(true); }
      });
      dom.ruler.addEventListener("pointerdown", pointerDown);
      dom.ruler.addEventListener("pointermove", pointerMove);
      dom.ruler.addEventListener("pointerup", pointerUp);
      dom.ruler.addEventListener("pointercancel", pointerCancel);
      dom.ruler.addEventListener("keydown", rulerKey);
      document.querySelectorAll("[data-nudge]").forEach((button) => button.addEventListener("click", () => nudge(button.dataset.nudge, false)));
      dom.park.addEventListener("click", parkRuler);
      dom.record.addEventListener("click", () => resolve(false));
      dom.skip.addEventListener("click", () => resolve(true));
      dom.returnReview.addEventListener("click", () => {
        if (!state.returnToReview) return;
        delete state.activePlacement;
        state.phase = "review"; state.variant = Persistence.analysisFieldValid(state.analysis, state.measurements, true) ? "complete" : "incomplete";
        state.currentStep = "review"; state.returnToReview = false; checkpoint(); render();
      });
      dom.reviewButton.addEventListener("click", collectAnalysisAndReview);
      dom.deltaT.addEventListener("change", savePartialAnalysis);
      dom.ratioGroups.addEventListener("change", savePartialAnalysis);
      for (const name of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        document.querySelectorAll(`input[name="${name}"]`).forEach((input) => input.addEventListener("change", savePartialAnalysis));
      }
      document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
        const area = button.dataset.edit;
        const next = Persistence.edit(state, area, 0);
        if (next) { state = next; restoreRuler(); checkpoint(); render(); }
      }));
      dom.reviewContent.addEventListener("click", (event) => {
        const button = event.target.closest("[data-edit-measurement]");
        if (!button) return;
        const key = button.dataset.editMeasurement;
        const totalIndex = Scoring.TOTAL_KEYS.indexOf(key);
        const gapIndex = Scoring.GAP_KEYS.indexOf(key);
        const next = totalIndex >= 0 ? Persistence.edit(state, "total", totalIndex) :
          gapIndex >= 0 ? Persistence.edit(state, "interval", gapIndex) : null;
        if (next) { state = next; restoreRuler(); checkpoint(); render(); }
      });
      dom.submit.addEventListener("click", submit);
      dom.submissionRetry.addEventListener("click", submit);
      dom.resultRetry.addEventListener("click", retryFinish);
      dom.technicalRetry.addEventListener("click", () => window.location.reload());
      window.addEventListener("resize", () => { positionRuler(); drawRuler(); updateRulerDescription(); });
      window.__freeFallDebug = {
        state: () => JSON.parse(JSON.stringify(state)),
        ruler: () => ({ ...ruler }),
        locked: () => locked,
        eventCounts: () => ({
          moves: Number(dom.ruler.dataset.moves || 0), ups: Number(dom.ruler.dataset.ups || 0),
          cancels: Number(dom.ruler.dataset.cancels || 0), trusted: dom.ruler.dataset.trusted === "true",
          pointerType: dom.ruler.dataset.pointerType || ""
        }),
        setReview(review) {
          const decoded = Persistence.decodeReview(review);
          if (!decoded) return false;
          state = Persistence.fromReview(decoded);
          latestReview = decoded;
          latestResult = Scoring.scoreAttempt(decoded);
          locked = false;
          render();
          return true;
        },
        routeStartup: (startupOutcome, startupAttempt) => routeStartup(startupOutcome, startupAttempt),
        routeSubmission: (submissionOutcome) => routeSubmission(submissionOutcome)
      };
    }
    function routeStartup(outcome, attempt) {
      const view = startupView(outcome);
      locked = view.locked;
      if (outcome === "editable") {
        if (attempt.state === "draft") {
          const restored = Persistence.decode(attempt.snapshot?.answer);
          if (!restored) return technicalLock("儲存的草稿不符合實驗狀態規則，系統沒有把它改成另一份答案。");
          state = restored;
          restoreRuler();
        }
        SimScorm.setDraftProvider(() => SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(state)));
        render();
      } else if (outcome === "review") {
        const review = Persistence.decodeReview(attempt.snapshot?.answer);
        if (!review) return safeFinishedFallback(attempt, "已完成 attempt 的詳細量度資料無法驗證。");
        const computed = Scoring.scoreAttempt(review);
        const trusted = SimActivityFlow.reviewResult(computed, attempt.snapshot, attempt);
        state = Persistence.fromReview(review);
        latestReview = review;
        latestResult = trusted.result;
        renderLockedResult(trusted.result, trusted.trusted, trusted.trusted ? "已完成並鎖定" : "Moodle 記錄與活動重算不一致");
      } else if (outcome === "frozen") {
        const payload = attempt.snapshot?.payload;
        let saved;
        try { saved = JSON.parse(payload?.reviewJson || "null"); } catch { saved = null; }
        const review = Persistence.decodeReview(saved?.answer);
        const computed = review ? Scoring.scoreAttempt(review) : null;
        if (!review || !computed || !canonicalReviewMatches(review, payload, computed)) {
          SimScorm.quarantinePending();
          return technicalLock("待提交資料的權威答案與重算結果不相符；已停止本頁自動重試。");
        }
        state = Persistence.fromReview(review);
        latestReview = review; latestResult = computed;
        pendingLock("上次提交仍未確認。只可重試同一份已凍結答案。");
      } else technicalLock("無法安全讀取 Moodle attempt；操作及分數均未確認。");
    }
    function selectFrequency(frequency) {
      if (locked) return;
      if (state.phase !== "setup") {
        if (!window.confirm("重新拍攝會清除今次量度值、答案及操作證據。是否繼續？")) return;
        state = Persistence.configuredState(frequency);
      } else state = Persistence.configuredState(frequency);
      ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; movementNorm = 0;
      checkpoint(); render();
    }
    function resetFrequency() {
      if (locked || !window.confirm("重新拍攝會清除今次量度值、答案及操作證據。是否繼續？")) return;
      state = Persistence.initialState(); ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; movementNorm = 0;
      checkpoint(); render();
    }
    function checkpoint() {
      if (locked || !Persistence.validateDraft(state)) return false;
      return SimScorm.saveDraft(SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(state)));
    }
    function currentTask() {
      if (state.phase === "measure-total") return { key: Scoring.TOTAL_KEYS[state.currentStep], task: "total", start: 0, end: state.currentStep + 1 };
      if (state.phase === "measure-interval") return { key: Scoring.GAP_KEYS[state.currentStep], task: Scoring.GAP_KEYS[state.currentStep], start: state.currentStep, end: state.currentStep + 1 };
      return null;
    }
    function placementFromRuler(mode) {
      const task = currentTask();
      if (!task || !state.generated) return null;
      const geometry = Model.geometry(state.frequencyHz, SVG_H, 30, 25);
      const targetY = geometry.metersToY(Model.displacementAt(state.frequencyHz, task.start));
      const rect = dom.stage.getBoundingClientRect();
      const pxScaleX = rect.width / SVG_W;
      const pxScaleY = rect.height / SVG_H;
      const edgeX = ruler.x < BALL_X ? ruler.x + RULER_W : ruler.x;
      const edgeGapSvg = Math.abs(edgeX - BALL_X) - 12;
      return {
        mode, moveNorm: movementNorm, rulerZeroM: geometry.yToMeters(ruler.y),
        edgeSide: ruler.x < BALL_X ? "left" : "right",
        edgeGapPx: Math.max(0, edgeGapSvg * pxScaleX),
        zeroErrorPx: (ruler.y - targetY) * pxScaleY
      };
    }
    function completeMovement(mode) {
      const placement = placementFromRuler(mode);
      const next = placement && Persistence.withPlacement(state, placement);
      if (!next) return;
      state = next; lastCompletedRuler = { ...ruler }; checkpoint(); render();
      dom.ruler.focus({ preventScroll: true });
    }
    function pointerDown(event) {
      if (locked || !currentTask() || event.button !== 0) return;
      const rect = dom.stage.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        rulerStart: { ...ruler }, prior: { ...lastCompletedRuler }, rect
      };
      movementStart = { ...ruler };
      dom.ruler.setPointerCapture(event.pointerId);
      dom.magnifier.classList.remove("is-hidden");
      dom.ruler.dataset.moves = "0"; dom.ruler.dataset.ups = "0"; dom.ruler.dataset.cancels = "0";
      dom.ruler.dataset.trusted = String(event.isTrusted); dom.ruler.dataset.pointerType = event.pointerType;
      updateMagnifier(event.clientY, drag.rect);
    }
    function pointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      dom.ruler.dataset.moves = String(Number(dom.ruler.dataset.moves || 0) + 1);
      const sx = SVG_W / drag.rect.width;
      const sy = SVG_H / drag.rect.height;
      ruler.x = clamp(drag.rulerStart.x + (event.clientX - drag.startX) * sx, 0, SVG_W - RULER_W);
      ruler.y = clamp(drag.rulerStart.y + (event.clientY - drag.startY) * sy, 0, SVG_H - 40);
      movementNorm = distance(ruler, movementStart) / Math.hypot(SVG_W, SVG_H);
      positionRuler(); drawRuler(); updatePlacementStatus(); updateMagnifier(event.clientY, drag.rect);
    }
    function pointerUp(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      dom.ruler.dataset.ups = String(Number(dom.ruler.dataset.ups || 0) + 1);
      dom.ruler.releasePointerCapture(event.pointerId);
      drag = null; dom.magnifier.classList.add("is-hidden"); completeMovement("pointer");
    }
    function pointerCancel(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      dom.ruler.dataset.cancels = String(Number(dom.ruler.dataset.cancels || 0) + 1);
      ruler = { ...drag.prior }; drag = null; movementNorm = state.activePlacement?.moveNorm || 0;
      positionRuler(); drawRuler(); dom.magnifier.classList.add("is-hidden");
      dom.live.textContent = "拖動中斷；直尺已回復到上一次完成的位置，未建立證據。";
    }
    function updateMagnifier(clientY, rect) {
      const geometry = Model.geometry(state.frequencyHz, SVG_H, 30, 25);
      const localSvgY = (clientY - rect.top) * SVG_H / rect.height;
      const rulerReading = Math.max(0, (localSvgY - ruler.y) / geometry.pixelsPerMeter);
      const nearestFine = Math.round(rulerReading / .05) * .05;
      dom.magnifierReadout.textContent = `指尖附近刻度 ${nearestFine.toFixed(2)} m`;
    }
    function rulerKey(event) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) || locked || !currentTask()) return;
      event.preventDefault();
      nudge(event.key.replace("Arrow", "").toLowerCase(), event.shiftKey);
    }
    function nudge(direction, large) {
      if (locked || !currentTask()) return;
      const amount = large ? 8 : 2;
      movementStart = { ...ruler };
      if (direction === "up") ruler.y -= amount;
      if (direction === "down") ruler.y += amount;
      if (direction === "left") ruler.x -= amount;
      if (direction === "right") ruler.x += amount;
      ruler.x = clamp(ruler.x, 0, SVG_W - RULER_W); ruler.y = clamp(ruler.y, 0, SVG_H - 40);
      const previous = state.activePlacement?.moveNorm || 0;
      movementNorm = previous + distance(ruler, movementStart) / Math.hypot(SVG_W, SVG_H);
      positionRuler(); drawRuler(); completeMovement("keyboard");
    }
    function parkRuler() {
      if (locked) return;
      ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; movementNorm = 0;
      if (state.activePlacement) {
        delete state.activePlacement;
        state.variant = state.returnToReview ? "review-edit-unpositioned" : "normal-unpositioned";
        checkpoint();
      }
      render();
    }
    function resolve(skipped) {
      dom.measurementError.textContent = "";
      let value = null;
      if (!skipped) {
        value = Number(dom.reading.value);
        if (dom.reading.value.trim() === "" || !Number.isFinite(value) || value < 0) {
          dom.measurementError.textContent = "請輸入有效的非負讀數，或明確選擇跳過。";
          return;
        }
      }
      const next = Persistence.resolveMeasurement(state, value, skipped);
      if (!next) { dom.measurementError.textContent = "讀數超出今次相機範圍，請重新檢查。"; return; }
      state = next; dom.reading.value = ""; movementNorm = state.activePlacement?.moveNorm || 0;
      if (!state.activePlacement) { ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; }
      checkpoint(); render();
    }
    function collectAnalysisAndReview() {
      dom.analysisError.textContent = "";
      const delta = Number(dom.deltaT.value);
      if (dom.deltaT.value.trim() === "" || !Number.isFinite(delta) || delta < 0) return analysisError("請填寫有效的 Δt。");
      const patch = { deltaTS: delta };
      for (const [key, , distanceRatio] of RATIO_DEFINITIONS) {
        const sources = key === "totalDisplacementRatio" ? Scoring.TOTAL_KEYS : key === "intervalDistanceRatio" ? Scoring.GAP_KEYS : null;
        const sufficient = !sources || sources.every((source) => state.measurements[source]?.status === "recorded" && state.measurements[source].readingM > 0);
        if (distanceRatio && !sufficient) patch[key] = { status: "insufficient-data" };
        else {
          const inputs = [...document.querySelectorAll(`[data-ratio-key="${key}"]`)];
          const values = [1, ...inputs.map((input) => Number(input.value))];
          if (inputs.some((input) => input.value.trim() === "") || values.some((term) => !Number.isFinite(term) || term <= 0)) return analysisError("請完成所有可約化比例的正有限數值。");
          patch[key] = { status: "answered", values };
        }
      }
      for (const key of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        const selected = document.querySelector(`input[name="${key}"]:checked`);
        if (!selected) return analysisError("請回答三條物理規律題。");
        patch[key] = selected.value;
      }
      const updated = Persistence.setAnalysis(state, patch);
      const next = updated && Persistence.enterReview(updated);
      if (!next) return analysisError("答案狀態未能通過驗證，請檢查所有欄位。");
      state = next; checkpoint(); render(); dom.reviewTitle.focus({ preventScroll: true });
    }
    function savePartialAnalysis() {
      if (state.phase !== "analyze" || locked) return;
      const patch = {};
      if (dom.deltaT.value.trim() !== "") {
        const value = Number(dom.deltaT.value);
        if (Number.isFinite(value) && value >= 0 && value <= 1) patch.deltaTS = value;
      }
      for (const [key] of RATIO_DEFINITIONS) {
        const section = document.querySelector(`[data-ratio="${key}"]`);
        if (section.querySelector(".ratio-inputs").classList.contains("is-hidden")) {
          patch[key] = { status: "insufficient-data" };
          continue;
        }
        const inputs = [...section.querySelectorAll("input")];
        if (inputs.every((input) => input.value.trim() !== "" && Number.isFinite(Number(input.value)) && Number(input.value) > 0)) {
          patch[key] = { status: "answered", values: [1, ...inputs.map((input) => Number(input.value))] };
        }
      }
      for (const key of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        const selected = document.querySelector(`input[name="${key}"]:checked`);
        if (selected) patch[key] = selected.value;
      }
      const next = Persistence.setAnalysis(state, patch);
      if (next) { state = next; checkpoint(); }
    }
    function analysisError(message) { dom.analysisError.textContent = message; }
    function submit() {
      if (state.phase !== "review" || state.variant !== "complete") return;
      latestReview = Persistence.makeReview(state);
      latestResult = Scoring.scoreAttempt(latestReview);
      locked = true;
      const reviewSnapshot = SimScorm.makeSnapshot(ACTIVITY, "review", latestReview, latestResult);
      const handle = (outcome) => routeSubmission(outcome);
      SimScorm.submitWithCallbacks(latestResult, reviewSnapshot, { onSuccess: handle, onFailure: handle });
    }
    function routeSubmission(outcome) {
      const view = submissionView(outcome);
      locked = view.locked;
      SimActivityFlow.submission(outcome, {
        success: () => renderLockedResult(latestResult, true, "已提交並鎖定"),
        committed: () => renderLockedResult(latestResult, true, "結果已寫入 Moodle；完成連線仍需重試", "finish"),
        frozen: () => pendingLock("提交仍待確認；答案已凍結，只可重試同一份資料。"),
        retry: () => {
          if (outcome.retryable) {
            locked = false; render(); dom.submissionNotice.textContent = "提交未建立持久 final state；可保留目前答案再試。";
            dom.submissionNotice.classList.remove("is-hidden"); dom.submissionRetry.classList.remove("is-hidden");
          } else technicalLock("提交前檢查失敗；系統不能承諾重試，亦未聲稱已提交。");
        }
      });
    }
    function retryConnection() {
      const outcome = SimScorm.retryPending();
      routeSubmission({ ...outcome, activityState: outcome.ok ? "success" : outcome.committed ? "committed" : outcome.frozen ? "frozen" : "retry" });
    }
    function retryFinish() {
      const finished = SimScorm.finish();
      if (finished) renderLockedResult(latestResult, true, "已提交並完成連線");
      else renderLockedResult(latestResult, true, "結果已寫入 Moodle；完成連線仍需重試", "finish");
    }
    function pendingLock(message) {
      locked = true;
      hideAll();
      dom.technical.classList.remove("is-hidden"); dom.technicalTitle.textContent = "提交狀態仍待確認";
      dom.technicalMessage.textContent = message; dom.technicalRetry.classList.add("is-hidden");
      const button = document.createElement("button");
      button.type = "button"; button.className = "primary-button"; button.textContent = "重試同一份提交";
      button.addEventListener("click", retryConnection);
      dom.technical.append(button);
      dom.badge.textContent = "待確認";
      renderStage();
    }
    function technicalLock(message) {
      locked = true; hideAll(); dom.technical.classList.remove("is-hidden");
      dom.technicalTitle.textContent = "暫時未能安全載入活動"; dom.technicalMessage.textContent = message;
      dom.technicalRetry.classList.remove("is-hidden"); dom.badge.textContent = "技術鎖定";
      renderStage();
    }
    function safeFinishedFallback(attempt, message) {
      locked = true; hideAll(); dom.result.classList.remove("is-hidden");
      const recorded = SimActivityFlow.recordedResult(attempt);
      dom.resultTitle.textContent = "已完成 attempt（詳細資料不可驗證）";
      dom.scorePanel.textContent = `Moodle 分數：${recorded.score ?? "--"} / 100　${SimActivityFlow.completionLabel(recorded.passed)}`;
      dom.resultFeedback.textContent = message; dom.badge.textContent = "已鎖定";
    }
    function renderLockedResult(result, trusted, title, retryKind) {
      locked = true; hideAll(); dom.result.classList.remove("is-hidden");
      dom.resultTitle.textContent = title; dom.badge.textContent = "已鎖定";
      dom.scorePanel.textContent = `分數：${result.score ?? "--"} / ${result.maxScore || 100}　${SimActivityFlow.completionLabel(result.passed)}`;
      dom.resultFeedback.replaceChildren();
      const feedback = document.createElement("p");
      feedback.textContent = trusted ? result.feedback : "Moodle 記錄優先；詳細 component feedback 已隱藏。";
      dom.resultFeedback.append(feedback);
      if (trusted && result.detail) {
        const details = document.createElement("p");
        details.textContent = `操作 ${result.detail.process.points}/40；數據及比例 ${formatPoints(result.detail.quantitative.points)}/30；物理規律 ${result.detail.laws.points}/30。`;
        dom.resultFeedback.append(details);
        const list = document.createElement("ul");
        list.className = "result-detail-list";
        for (const text of resultFeedbackItems(latestReview, result)) {
          const item = document.createElement("li");
          item.textContent = text;
          list.append(item);
        }
        dom.resultFeedback.append(list);
      }
      dom.resultRetry.classList.toggle("is-hidden", retryKind !== "finish");
      renderStage();
    }
    function render(animate) {
      hideAll();
      renderStage(animate);
      document.querySelectorAll("[data-frequency]").forEach((button) => {
        button.classList.toggle("is-selected", Number(button.dataset.frequency) === state.frequencyHz);
        button.setAttribute("aria-pressed", String(Number(button.dataset.frequency) === state.frequencyHz));
      });
      dom.generate.disabled = state.variant !== "configured";
      if (state.phase === "setup") { dom.setup.classList.remove("is-hidden"); dom.badge.textContent = "設定"; }
      else if (["measure-total", "measure-interval"].includes(state.phase)) renderMeasurement();
      else if (state.phase === "analyze") renderAnalysis();
      else if (state.phase === "review") renderReview();
      updateRulerDescription();
    }
    function hideAll() {
      [dom.setup, dom.measurement, dom.analysis, dom.review, dom.result, dom.technical].forEach((element) => element.classList.add("is-hidden"));
      dom.submissionRetry.classList.add("is-hidden"); dom.submissionNotice.classList.add("is-hidden");
    }
    function renderStage(animate) {
      dom.trajectory.replaceChildren();
      if (!state.generated) {
        dom.ruler.classList.add("is-hidden"); dom.rulerGraphic.replaceChildren();
        dom.stageHint.textContent = "先在操作面板設定頻閃頻率。";
        return;
      }
      const geometry = Model.geometry(state.frequencyHz, SVG_H, 30, 25);
      const ns = "http://www.w3.org/2000/svg";
      const task = currentTask();
      if (task) {
        [task.start, task.end].forEach((index) => {
          const line = document.createElementNS(ns, "line");
          const y = geometry.metersToY(Model.displacementAt(state.frequencyHz, index));
          line.setAttribute("x1", "80"); line.setAttribute("x2", "285"); line.setAttribute("y1", y); line.setAttribute("y2", y);
          line.setAttribute("stroke", "#2563eb"); line.setAttribute("stroke-dasharray", "5 5"); line.setAttribute("opacity", ".55");
          dom.trajectory.append(line);
        });
      }
      Model.trajectory(state.frequencyHz).forEach((point) => {
        const y = geometry.metersToY(point.displacementM);
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", BALL_X); circle.setAttribute("cy", y); circle.setAttribute("r", "11");
        circle.setAttribute("fill", "#dc2626"); circle.setAttribute("stroke", "#7f1d1d"); circle.setAttribute("stroke-width", "2");
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", BALL_X + 18); label.setAttribute("y", y + 5); label.setAttribute("font-weight", "800");
        label.textContent = `P${"₀₁₂₃₄"[point.index]}`;
        dom.trajectory.append(circle, label);
      });
      if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dom.trajectory.classList.remove("is-entering"); void dom.trajectory.getBBox(); dom.trajectory.classList.add("is-entering");
      } else dom.trajectory.classList.remove("is-entering");
      dom.ruler.classList.toggle("is-hidden", locked || state.phase === "review");
      dom.stageHint.textContent = task ? "在操作面板選定的量度起點對準直尺零刻度。" : "頻閃相片已生成；按操作面板完成數據分析。";
      drawRuler(); positionRuler();
    }
    function drawRuler() {
      dom.rulerGraphic.replaceChildren();
      if (!state.generated) return;
      const ns = "http://www.w3.org/2000/svg";
      const geometry = Model.geometry(state.frequencyHz, SVG_H, 30, 25);
      const height = Math.min(SVG_H - ruler.y, geometry.pixelsPerMeter * Model.cameraMax(state.frequencyHz));
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", ruler.x); body.setAttribute("y", ruler.y); body.setAttribute("width", RULER_W); body.setAttribute("height", Math.max(40, height));
      body.setAttribute("fill", "rgba(254,243,199,.78)"); body.setAttribute("stroke", "#92400e");
      dom.rulerGraphic.append(body);
      for (let halfDecimeters = 0; halfDecimeters <= Model.cameraMax(state.frequencyHz) * 20 + 1e-9; halfDecimeters += 1) {
        const meters = halfDecimeters / 20;
        const y = ruler.y + meters * geometry.pixelsPerMeter;
        if (y > SVG_H) break;
        const major = halfDecimeters % 10 === 0;
        const medium = halfDecimeters % 2 === 0;
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", ruler.x); line.setAttribute("x2", ruler.x + (major ? 32 : medium ? 22 : 14));
        line.setAttribute("y1", y); line.setAttribute("y2", y); line.setAttribute("stroke", "#78350f");
        dom.rulerGraphic.append(line);
        if (major) {
          const text = document.createElementNS(ns, "text");
          text.setAttribute("x", ruler.x + 34); text.setAttribute("y", y + 4); text.setAttribute("font-size", "10");
          text.textContent = meters.toFixed(1); dom.rulerGraphic.append(text);
        }
      }
    }
    function positionRuler() {
      const rect = dom.stage.getBoundingClientRect();
      dom.ruler.style.left = `${ruler.x / SVG_W * rect.width}px`;
      dom.ruler.style.top = `${ruler.y / SVG_H * rect.height}px`;
      dom.ruler.style.width = `${Math.max(44, RULER_W / SVG_W * rect.width)}px`;
      dom.ruler.style.height = `${Math.max(44, Math.min(180, rect.height - ruler.y / SVG_H * rect.height))}px`;
    }
    function restoreRuler() {
      if (!state.activePlacement || !state.generated) { ruler = { ...PARK }; movementNorm = 0; lastCompletedRuler = { ...ruler }; return; }
      const placement = state.activePlacement;
      const geometry = Model.geometry(state.frequencyHz, SVG_H, 30, 25);
      const rect = dom.stage.getBoundingClientRect();
      const pxScaleX = Math.max(rect.width / SVG_W, .01);
      const edgeGapSvg = placement.edgeGapPx / pxScaleX + 12;
      ruler.y = geometry.metersToY(placement.rulerZeroM);
      ruler.x = placement.edgeSide === "left" ? BALL_X - edgeGapSvg - RULER_W : BALL_X + edgeGapSvg;
      ruler.x = clamp(ruler.x, 0, SVG_W - RULER_W); ruler.y = clamp(ruler.y, 0, SVG_H - 40);
      movementNorm = placement.moveNorm; lastCompletedRuler = { ...ruler };
    }
    function renderMeasurement() {
      dom.measurement.classList.remove("is-hidden");
      const total = state.phase === "measure-total";
      const task = currentTask();
      dom.badge.textContent = total ? "量度總位移" : "量度相鄰間隔";
      dom.measurementTitle.textContent = total ? "2. 量度總位移" : "2. 量度相鄰間隔";
      dom.measurementPrompt.textContent = total
        ? `第 ${state.currentStep + 1}/4 項：保持零刻度對準 P₀，讀取 P${"₁₂₃₄"[state.currentStep]} 的總位移。`
        : `第 ${state.currentStep + 1}/4 項：重新移尺，把零刻度對準 P${"₀₁₂₃"[state.currentStep]}，讀取 P${"₁₂₃₄"[state.currentStep]}。`;
      dom.readingLabel.textContent = total ? `P₀ 至 P${"₁₂₃₄"[state.currentStep]} 總位移` : `P${"₀₁₂₃"[state.currentStep]}P${"₁₂₃₄"[state.currentStep]} 間隔`;
      const existing = state.measurements[task.key];
      dom.reading.value = existing?.status === "recorded" ? String(existing.readingM) : "";
      dom.returnReview.classList.toggle("is-hidden", !state.returnToReview);
      updatePlacementStatus();
    }
    function updatePlacementStatus() {
      const task = currentTask();
      const placement = placementFromRuler(state.activePlacement?.mode || "pointer");
      const valid = placement && Scoring.validPlacement({ task: task?.task, ...placement }, task?.task);
      dom.placementStatus.classList.toggle("is-ready", Boolean(valid));
      dom.placementStatus.textContent = ruler.x === PARK.x && ruler.y === PARK.y ? "直尺仍在停泊區。" :
        valid ? "直尺已靠近所選起點，可以讀數。" : "請把零刻度對準所選起點，並讓尺邊靠近球列。";
    }
    function updateRulerDescription() {
      if (!state.generated) return;
      const task = currentTask();
      const geometry = Model.geometry(state.frequencyHz, SVG_H, 30, 25);
      const zero = geometry.yToMeters(ruler.y);
      dom.ruler.setAttribute("aria-label", `${task ? dom.measurementPrompt.textContent : "頻閃相片"}；直尺零刻度約在 ${zero.toFixed(2)} 米位置。`);
    }
    function renderAnalysis() {
      dom.analysis.classList.remove("is-hidden"); dom.badge.textContent = "分析";
      dom.deltaT.value = state.analysis.deltaTS ?? "";
      for (const [key, , distanceRatio] of RATIO_DEFINITIONS) {
        const answer = state.analysis[key];
        const sources = key === "totalDisplacementRatio" ? Scoring.TOTAL_KEYS : key === "intervalDistanceRatio" ? Scoring.GAP_KEYS : null;
        const sufficient = !sources || sources.every((source) => state.measurements[source]?.status === "recorded" && state.measurements[source].readingM > 0);
        const section = document.querySelector(`[data-ratio="${key}"]`);
        section.querySelector(".ratio-inputs").classList.toggle("is-hidden", distanceRatio && !sufficient);
        section.querySelector(`[data-insufficient="${key}"]`).classList.toggle("is-hidden", !distanceRatio || sufficient);
        section.querySelectorAll("input").forEach((input, index) => { input.value = answer?.status === "answered" ? answer.values[index + 1] : ""; });
      }
      for (const key of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        document.querySelectorAll(`input[name="${key}"]`).forEach((input) => { input.checked = input.value === state.analysis[key]; });
      }
    }
    function renderReview() {
      dom.review.classList.remove("is-hidden"); dom.badge.textContent = state.variant === "complete" ? "提交前檢查" : "尚未完成";
      const rows = Persistence.MEASUREMENT_KEYS.map((key) => {
        const item = state.measurements[key];
        const evidence = key.startsWith("total")
          ? item?.usedTotalPlacement === true : Boolean(state.evidence[key]?.usedWhileValid);
        return `<tr><th>${measurementName(key)}</th><td>${item?.status === "recorded" ? `${escapeHtml(item.readingM)} m` : "已跳過"}</td><td>${evidence ? "有尺位證據" : "未有尺位證據"}</td><td><button type="button" data-edit-measurement="${key}">修正 ${measurementName(key)}</button></td></tr>`;
      }).join("");
      const ratioRows = RATIO_DEFINITIONS.map(([key, title]) => `<p><strong>${escapeHtml(title)}：</strong>${escapeHtml(ratioText(state.analysis[key]))}</p>`).join("");
      const concepts = [
        ["總位移與時間", state.analysis.lawAnswerId, { square: "s ∝ t²", linear: "s ∝ t", constant: "s 不變" }],
        ["相等時間間隔位移", state.analysis.intervalLawAnswerId, { odd: "連續奇數比", equal: "每段相等", square: "平方數比" }],
        ["間隔增加原因", state.analysis.accelerationAnswerId, { "constant-acceleration": "加速度固定，速度等量增加", "constant-speed": "速度不變", "frequency-changes-gravity": "頻率改變重力" }]
      ].map(([title, value, labels]) => `<p><strong>${title}：</strong>${escapeHtml(labels[value] || "未答")}</p>`).join("");
      dom.reviewContent.innerHTML = `<p>頻率：${state.frequencyHz} Hz；Δt：${state.analysis.deltaTS ?? "未填"} s</p>
        <table class="review-table"><thead><tr><th>量度</th><th>讀數</th><th>操作</th><th>修正</th></tr></thead><tbody>${rows}</tbody></table>
        <section class="review-analysis" aria-label="比例及物理規律答案">${ratioRows}${concepts}</section>
        <p>${state.variant === "complete" ? "所有必需答案已填妥，可以提交。" : "仍有分析答案未完成；請返回修正。"}</p>`;
      dom.submit.disabled = state.variant !== "complete";
    }
    function measurementName(key) {
      const totalIndex = Scoring.TOTAL_KEYS.indexOf(key);
      if (totalIndex >= 0) return `P₀→P${"₁₂₃₄"[totalIndex]}`;
      const gapIndex = Scoring.GAP_KEYS.indexOf(key);
      return `P${"₀₁₂₃"[gapIndex]}P${"₁₂₃₄"[gapIndex]}`;
    }
    function ratioText(answer) {
      return answer?.status === "answered" ? answer.values.join(":") :
        answer?.status === "insufficient-data" ? "量度數據不足，不能約化" : "未答";
    }
    function formatPoints(value) { return Number.isInteger(value) ? String(value) : value.toFixed(2); }
    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
    }
  }

  return { ACTIVITY, startupView, submissionView, canonicalReviewMatches, resultFeedbackItems, boot };
});
