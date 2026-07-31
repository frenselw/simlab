(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.FreeFallModel;
  const animation = typeof module === "object" && module.exports ? require("./animation.js") : root.FreeFallAnimation;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.FreeFallScoring;
  const persistence = typeof module === "object" && module.exports ? require("./persistence.js") : root.FreeFallPersistence;
  const api = factory(model, animation, scoring, persistence);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FreeFallApp = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.boot);
})(typeof window !== "undefined" ? window : globalThis, function (Model, Animation, Scoring, Persistence) {
  "use strict";

  const ACTIVITY = "free-fall-stroboscopic-measurement-lab";
  const SVG_W = 360;
  const SVG_H = 440;
  const BALL_X = 170;
  const GUIDE_X1 = 80;
  const GUIDE_X2 = 285;
  const CAMERA_TOP_MARGIN = 55;
  const CAMERA_BOTTOM_MARGIN = 25;
  const RULER_W = 72;
  const RULER_END_MARGIN = 12;
  const MIN_BALL_RADIUS_PX = 9;
  const MIN_POINT_LABEL_PX = 10;
  const MIN_RULER_LABEL_PX = 16;
  const MIN_RULER_UNIT_PX = 18;
  const RULER_GEOMETRY = "fixed-left-v1";
  const MIN_APPARATUS_STROKE_PX = 1;
  const PARK = Object.freeze({ x: 292, y: CAMERA_TOP_MARGIN });
  const RATIO_DEFINITIONS = Object.freeze([
    ["cumulativeTimeRatio", "累積時間比 <var>t</var><sub>1</sub>:<var>t</var><sub>2</sub>:<var>t</var><sub>3</sub>:<var>t</var><sub>4</sub>"],
    ["intervalTimeRatio", "每段時間比 <span class=\"delta\">Δ</span><var>t</var><sub>1</sub>:<span class=\"delta\">Δ</span><var>t</var><sub>2</sub>:<span class=\"delta\">Δ</span><var>t</var><sub>3</sub>:<span class=\"delta\">Δ</span><var>t</var><sub>4</sub>"]
  ]);

  function trimFixed(value, fractionDigits) {
    return value.toFixed(fractionDigits).replace(/(?:\.0+|(\.\d+?)0+)$/, "$1").replace(/^-0$/, "0");
  }
  function formatPhotoCm(frequencyHz, meters, fractionDigits = 2) {
    const photoCm = Model.metersToPhotoCm(frequencyHz, meters);
    return Number.isFinite(photoCm) ? trimFixed(photoCm, fractionDigits) : "";
  }
  function photoCmToMeters(frequencyHz, value) {
    return Model.photoCmToMeters(frequencyHz, value);
  }
  function resolveManualReading(frequencyHz, text, baselineText = null, originalReadingM = null) {
    if (typeof text !== "string") return { ok: false, readingM: null };
    if (baselineText !== null && text === baselineText && Number.isFinite(originalReadingM)) {
      return { ok: true, readingM: originalReadingM, reusedOriginal: true };
    }
    const trimmed = text.trim();
    const photoCm = Number(trimmed);
    if (!trimmed || !Number.isFinite(photoCm) || photoCm < 0 || photoCm > Model.PHOTO_RULER_CM) {
      return { ok: false, readingM: null };
    }
    const readingM = photoCmToMeters(frequencyHz, photoCm);
    return Number.isFinite(readingM) ? { ok: true, readingM, reusedOriginal: false } :
      { ok: false, readingM: null };
  }
  function mathQuantity(symbol, value, unit) {
    const variable = symbol.startsWith("Δ")
      ? `<span class="delta">Δ</span><var>${symbol.slice(1)}</var>`
      : `<var>${symbol}</var>`;
    return `<span class="math-expression">${variable}<span class="operator"> = </span><span class="value">${value}</span> <span class="unit">${unit}</span></span>`;
  }

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
      const decoded = Persistence.decodeImmutableReview(saved?.answer);
      if (!decoded || JSON.stringify(decoded) !== JSON.stringify(review)) return false;
      const computed = Scoring.scoreAttempt(decoded);
      return computed.maxScore === 100 && computed.score === saved.score && computed.passed === saved.passed &&
        saved.score === payload.score && saved.passed === payload.passed &&
        computed.score === score.score && computed.passed === score.passed;
    } catch { return false; }
  }
  function resolveImmutableReview(value) {
    try {
      const review = Persistence.decodeImmutableReview(value);
      return review ? { review, result: Scoring.scoreAttempt(review) } : null;
    } catch { return null; }
  }
  function resultFeedbackItems(review, result) {
    if (!review || !result?.detail) return [];
    const frequency = review.frequencyHz;
    const totals = Scoring.expectedTotals(frequency);
    const gaps = Scoring.expectedGaps(frequency);
    const ideal = (values) => values.map((value) => formatPhotoCm(frequency, value)).join("、");
    const tolerances = (values) => values.map((value) => `±${formatPhotoCm(frequency, Scoring.distanceTolerance(value))}`).join("、");
    return [
      `相鄰影像時間理想值為 ${mathQuantity("Δt", Model.deltaT(frequency).toFixed(4), "s")}，接受絕對誤差 ±${Scoring.DELTA_T_ABS_TOLERANCE_S.toFixed(3)} <span class="unit">s</span>。`,
      `<var>P</var><sub>0</sub> 至 <var>P</var><sub>1</sub>–<var>P</var><sub>4</sub> 的理想相片上總位移為 ${ideal(totals)} <span class="unit">cm</span>；各項相片容差為 ${tolerances(totals)} <span class="unit">cm</span>。`,
      `四段理想相片上相鄰距離為 ${ideal(gaps)} <span class="unit">cm</span>；各項相片容差為 ${tolerances(gaps)} <span class="unit">cm</span>。`,
      "理想累積時間比 1:2:3:4、總位移比 1:4:9:16、每段時間比 1:1:1:1、相鄰距離比 1:3:5:7；兩組距離系列只用作比較與解釋，不是可編輯的比例答案。",
      ...Scoring.measurementDiagnostic(review, result)
    ];
  }
  function unansweredCount(analysis) {
    return Number(analysis.deltaTS === null) +
      analysis.cumulativeTimeRatio.values.slice(1).filter((value) => value === null).length +
      analysis.intervalTimeRatio.values.slice(1).filter((value) => value === null).length +
      [analysis.lawAnswerId, analysis.intervalLawAnswerId, analysis.accelerationAnswerId].filter((value) => value === null).length;
  }
  function answerLabel(itemId, value) {
    const labels = {
      displacement: { square: "總位移與時間平方成正比", linear: "總位移與時間成正比", constant: "總位移不變" },
      intervals: { odd: "相鄰間隔按連續奇數比增加", equal: "相鄰間隔每段相等", square: "相鄰間隔為平方數比" },
      acceleration: { "constant-acceleration": "加速度固定，速度等量增加", "constant-speed": "速度保持不變", "frequency-changes-gravity": "頻閃頻率改變重力" }
    };
    return labels[itemId]?.[value] || null;
  }

  function boot(options = {}) {
    const random = typeof options?.random === "function" ? options.random : Math.random;
    const $ = (id) => document.getElementById(id);
    const dom = {
      stage: $("stage"), scene: $("scene"), trajectory: $("trajectoryGroup"), cueGroup: $("exposureCueGroup"),
      rulerGraphic: $("rulerGraphic"),
      ruler: $("rulerHandle"), stageReadout: $("stageReadout"), stageHint: $("stageHint"), panel: $("controlPanel"),
      badge: $("phaseBadge"), frequencyChip: $("frequencyChip"), setup: $("setupSection"), measurement: $("measurementSection"),
      analysis: $("analysisSection"), review: $("reviewSection"), result: $("resultSection"),
      technical: $("technicalSection"), technicalTitle: $("technicalTitle"), technicalMessage: $("technicalMessage"),
      technicalRetry: $("technicalRetry"), generate: $("generateButton"), assignedFrequency: $("assignedFrequency"),
      measurementTitle: $("measurementTitle"), analysisTitle: $("analysisTitle"),
      replayPreview: $("replayPreviewButton"), animationStatus: $("animationStatus"),
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
    let lockedPresentation = null;
    let ruler = { ...PARK };
    let drag = null;
    let movementStart = { ...PARK };
    let movementNorm = 0;
    let lastCompletedRuler = { ...PARK };
    let latestResult = null;
    let latestReview = null;
    let manualTaskKey = null;
    let manualBaselineText = null;
    let manualOriginalReadingM = null;
    let stageReadoutTaskKey = null;
    let stageOutputAllowedTaskKey = null;
    let assignmentCheckpointPending = false;
    let previewAutoplayStarted = false;
    let blankConfirmationReview = null;
    let animationView = { mode: "idle", liveBallM: null, stamps: [] };
    const motion = Animation.createController({
      onUpdate(view) {
        animationView = view;
        renderStage();
        renderExposureCue();
        updateAnimationStatus();
      },
      onComplete(view) {
        if (view.mode === "static" && state.generated) render();
      }
    });

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
        heading.innerHTML = title;
        section.append(heading);
        const row = document.createElement("div");
        row.className = "ratio-inputs";
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", heading.textContent);
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
          input.setAttribute("aria-label", `${heading.textContent}，第 ${index + 1} 項`);
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
      document.querySelectorAll("[data-reset-frequency]").forEach((button) => button.addEventListener("click", resetFrequency));
      dom.generate.addEventListener("click", () => {
        if (locked) return;
        const next = Persistence.generate(state);
        if (!next) return;
        state = next; ruler = { ...PARK }; lastCompletedRuler = { ...PARK };
        checkpoint();
        motion.startCapture(state.frequencyHz, { reducedMotion: prefersReducedMotion() });
        render();
      });
      dom.replayPreview.addEventListener("click", () => {
        if (!locked && state.phase === "setup") motion.startPreview({ reducedMotion: prefersReducedMotion() });
      });
      dom.ruler.addEventListener("pointerdown", pointerDown);
      dom.ruler.addEventListener("pointermove", pointerMove);
      dom.ruler.addEventListener("pointerup", pointerUp);
      dom.ruler.addEventListener("pointercancel", pointerCancel);
      dom.ruler.addEventListener("keydown", rulerKey);
      dom.park.addEventListener("click", parkRuler);
      dom.record.addEventListener("click", () => resolve(false));
      dom.skip.addEventListener("click", () => resolve(true));
      dom.returnReview.addEventListener("click", () => {
        if (locked || !state.returnToReview) return;
        clearStageOutput();
        resetManualInput();
        delete state.activePlacement;
        state.phase = "review"; state.variant = "ready";
        state.currentStep = "review"; state.returnToReview = false; checkpoint(); render(); focusPhaseHeading();
      });
      dom.reviewButton.addEventListener("click", collectAnalysisAndReview);
      dom.deltaT.addEventListener("change", savePartialAnalysis);
      dom.ratioGroups.addEventListener("change", savePartialAnalysis);
      for (const name of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        document.querySelectorAll(`input[name="${name}"]`).forEach((input) => input.addEventListener("change", savePartialAnalysis));
      }
      document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
        if (locked) return;
        const area = button.dataset.edit;
        const next = Persistence.edit(state, area, 0);
        if (next) { clearStageOutput(); resetManualInput(); state = next; blankConfirmationReview = null; restoreRuler(); checkpoint(); render(); focusPhaseHeading(); }
      }));
      dom.reviewContent.addEventListener("click", (event) => {
        if (locked) return;
        const button = event.target.closest("[data-edit-measurement]");
        if (!button) return;
        const key = button.dataset.editMeasurement;
        const totalIndex = Scoring.TOTAL_KEYS.indexOf(key);
        const gapIndex = Scoring.GAP_KEYS.indexOf(key);
        const next = totalIndex >= 0 ? Persistence.edit(state, "total", totalIndex) :
          gapIndex >= 0 ? Persistence.edit(state, "interval", gapIndex) : null;
        if (next) { clearStageOutput(); resetManualInput(); state = next; blankConfirmationReview = null; restoreRuler(); checkpoint(); render(); focusPhaseHeading(); }
      });
      dom.submit.addEventListener("click", () => submit(false));
      dom.submissionNotice.addEventListener("click", (event) => {
        const action = event.target.closest("[data-blank-action]")?.dataset.blankAction;
        if (action === "return") {
          const next = Persistence.edit(state, "analysis");
          if (next) { blankConfirmationReview = null; state = next; checkpoint(); render(); focusPhaseHeading(); }
        }
        if (action === "confirm") submit(true);
      });
      dom.submissionRetry.addEventListener("click", () => submit(true));
      dom.resultRetry.addEventListener("click", retryFinish);
      dom.technicalRetry.addEventListener("click", retryTechnical);
      window.addEventListener("resize", () => {
        if (state.activePlacement) restoreRuler();
        renderStage();
        if (currentTask()) updatePlacementStatus();
        updateRulerDescription();
      });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) return;
        cancelAnimationForInterruption();
      });
      window.__freeFallDebug = {
        state: () => JSON.parse(JSON.stringify(state)),
        ruler: () => ({ ...ruler }),
        locked: () => locked,
        animation: () => motion.snapshot(),
        rulerLayout: () => {
          const geometry = rulerGeometry();
          return Object.fromEntries(Object.entries(geometry).filter(([, value]) => typeof value === "number"));
        },
        setRuler(position) {
          if (locked || !currentTask() || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
          applyRulerGeometry(position); positionRuler(); drawRuler(); updatePlacementStatus(); updateRulerDescription();
          return true;
        },
        eventCounts: () => ({
          moves: Number(dom.ruler.dataset.moves || 0), ups: Number(dom.ruler.dataset.ups || 0),
          cancels: Number(dom.ruler.dataset.cancels || 0), trusted: dom.ruler.dataset.trusted === "true",
          pointerType: dom.ruler.dataset.pointerType || ""
        }),
        setReview(review) {
          const decoded = Persistence.decodeReview(review);
          if (!decoded) return false;
          state = Persistence.fromReview(decoded);
          motion.showStatic(state.frequencyHz);
          latestReview = decoded;
          latestResult = Scoring.scoreAttempt(decoded);
          locked = false;
          render();
          return true;
        },
        routeStartup: (startupOutcome, startupAttempt) => routeStartup(startupOutcome, startupAttempt),
        routeSubmission: (submissionOutcome) => routeSubmission(submissionOutcome),
        replayPreview: () => !locked && state.phase === "setup" && motion.startPreview({ reducedMotion: prefersReducedMotion() }),
        cancelAnimation: cancelAnimationForInterruption
      };
    }
    function cancelAnimationForInterruption() {
      if (locked || !motion.isActive()) return false;
      const mode = motion.snapshot().mode;
      if (mode === "capture") {
        motion.showStatic(state.frequencyHz);
        render();
        return true;
      }
      if (mode === "preview") return motion.showPreviewStatic();
      return false;
    }
    function routeStartup(outcome, attempt) {
      const view = startupView(outcome);
      locked = view.locked;
      lockedPresentation = null;
      if (outcome === "editable") {
        if (attempt.state === "draft") {
          const restored = Persistence.decode(attempt.snapshot?.answer);
          if (!restored) return technicalLock("儲存的草稿不符合實驗狀態規則，系統沒有把它改成另一份答案。");
          state = restored;
          restoreRuler();
        }
        SimScorm.setDraftProvider(() => SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(state)));
        if (state.phase === "setup" && state.variant === "new") {
          const frequency = Persistence.chooseFrequency(random);
          const assigned = Persistence.assignFrequency(state, frequency);
          if (!assigned) return technicalLock("未能安全指派今次頻閃頻率；相片拍攝保持鎖定。");
          state = assigned;
          if (!checkpoint()) {
            assignmentCheckpointPending = true;
            return technicalLock("未能保存今次隨機頻率；相片拍攝保持鎖定。重試只會保存同一個已指派頻率，不會重新抽取。", "assignment");
          }
        }
        if (state.generated) motion.showStatic(state.frequencyHz);
        render();
        if (state.phase === "setup" && !previewAutoplayStarted) startSetupPreview();
      } else if (outcome === "review") {
        try {
          const resolved = resolveImmutableReview(attempt.snapshot?.answer);
          if (!resolved) return safeFinishedFallback(attempt, "已完成 attempt 的詳細量度資料無法驗證。");
          const { review, result: computed } = resolved;
          const trusted = SimActivityFlow.reviewResult(computed, attempt.snapshot, attempt);
          state = Persistence.fromReview(review);
          if (!state) return safeFinishedFallback(attempt, "已完成 attempt 的顯示狀態無法重建。");
          motion.showStatic(state.frequencyHz);
          latestReview = review;
          latestResult = trusted.result;
          renderLockedResult(trusted.result, trusted.trusted, trusted.trusted ? "已完成並鎖定" : "Moodle 記錄與活動重算不一致");
        } catch {
          return safeFinishedFallback(attempt, "已完成 attempt 的詳細量度資料無法安全重算。");
        }
      } else if (outcome === "frozen") {
        try {
          const payload = attempt.snapshot?.payload;
          const saved = JSON.parse(payload?.reviewJson || "null");
          const resolved = resolveImmutableReview(saved?.answer);
          if (!resolved || !canonicalReviewMatches(resolved.review, payload, resolved.result)) throw new Error("invalid frozen review");
          const { review, result: computed } = resolved;
          state = Persistence.fromReview(review);
          if (!state) throw new Error("invalid frozen display state");
          motion.showStatic(state.frequencyHz);
          latestReview = review; latestResult = computed;
          pendingLock("上次提交仍未確認。只可重試同一份已凍結答案。");
        } catch {
          SimScorm.quarantinePending();
          return technicalLock("待提交資料的權威答案與重算結果不相符；已停止本頁自動重試。");
        }
      } else technicalLock("無法安全讀取 Moodle attempt；操作及分數均未確認。");
    }
    function resetFrequency() {
      if (locked || !window.confirm("重新開始會清除今次量度值、答案及操作證據，但保留已指派頻率。是否繼續？")) return;
      motion.cancel();
      const reset = Persistence.reset(state);
      if (!reset) return technicalLock("未能安全保留今次指派頻率；活動已鎖定。");
      state = reset; ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; movementNorm = 0;
      clearStageOutput();
      resetManualInput();
      checkpoint(); render(); startSetupPreview();
    }
    function prefersReducedMotion() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }
    function startSetupPreview() {
      previewAutoplayStarted = true;
      motion.startPreview({ reducedMotion: prefersReducedMotion() });
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
    function screenCtm() {
      const matrix = dom.scene.getScreenCTM();
      return matrix && [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)
        ? matrix : null;
    }
    function transformPoint(x, y, matrix) {
      const point = dom.scene.createSVGPoint();
      point.x = x; point.y = y;
      const transformed = point.matrixTransform(matrix);
      return { x: transformed.x, y: transformed.y };
    }
    function clientToSvg(x, y) {
      const matrix = screenCtm();
      return matrix ? transformPoint(x, y, matrix.inverse()) : null;
    }
    function svgToClient(x, y) {
      const matrix = screenCtm();
      return matrix ? transformPoint(x, y, matrix) : null;
    }
    function apparatusMetrics() {
      const matrix = screenCtm();
      const scaleX = Math.max(matrix ? Math.hypot(matrix.a, matrix.b) : 1, .01);
      const scaleY = Math.max(matrix ? Math.hypot(matrix.c, matrix.d) : 1, .01);
      const scale = Math.min(scaleX, scaleY);
      return {
        scaleX, scaleY,
        ballRadius: Math.max(11, MIN_BALL_RADIUS_PX / scale),
        pointLabelSize: Math.max(16, MIN_POINT_LABEL_PX / scale),
        rulerLabelSize: MIN_RULER_LABEL_PX / scale,
        rulerUnitSize: MIN_RULER_UNIT_PX / scale,
        strokeWidth: MIN_APPARATUS_STROKE_PX / scale
      };
    }
    function rulerGeometry(candidate = ruler) {
      const metrics = apparatusMetrics();
      const { scaleX, scaleY } = metrics;
      const modelGeometry = state.generated ? Model.geometry(state.frequencyHz, SVG_H, CAMERA_TOP_MARGIN, CAMERA_BOTTOM_MARGIN) : null;
      const bodyWidth = Math.min(SVG_W, Math.max(RULER_W, 48 / scaleX));
      const anchorX = clamp(candidate.x, Math.min(SVG_W, 48 / scaleX), SVG_W);
      const rulerSide = anchorX < (GUIDE_X1 + GUIDE_X2) / 2 ? "left" : "right";
      const direction = -1;
      const x = anchorX - bodyWidth;
      const zeroY = clamp(candidate.y, 0, SVG_H);
      const tickSpan = modelGeometry
        ? modelGeometry.metersToY(Model.cameraMax(state.frequencyHz)) - modelGeometry.metersToY(0) : 0;
      const headerMargin = Math.max(RULER_END_MARGIN, 36 / scaleY);
      const fullTop = zeroY - headerMargin;
      const fullBottom = zeroY + tickSpan + RULER_END_MARGIN;
      const visibleTop = clamp(fullTop, 0, SVG_H);
      const visibleBottom = clamp(fullBottom, 0, SVG_H);
      const visibleLeft = clamp(x, 0, SVG_W);
      const visibleRight = clamp(x + bodyWidth, 0, SVG_W);
      return {
        x, anchorX, rulerSide, direction, zeroY, bodyWidth, tickSpan, fullTop, fullBottom, headerMargin,
        visibleLeft, visibleTop, visibleWidth: Math.max(0, visibleRight - visibleLeft),
        visibleHeight: Math.max(0, visibleBottom - visibleTop),
        scaleX, scaleY, ballRadius: metrics.ballRadius, strokeWidth: metrics.strokeWidth,
        rulerLabelSize: metrics.rulerLabelSize, rulerUnitSize: metrics.rulerUnitSize, modelGeometry
      };
    }
    function applyRulerGeometry(candidate) {
      const geometry = rulerGeometry(candidate);
      ruler = { x: geometry.anchorX, y: geometry.zeroY };
      return geometry;
    }
    function placementFromRuler(mode) {
      const task = currentTask();
      if (!task || !state.generated) return null;
      const rulerBox = rulerGeometry();
      const geometry = rulerBox.modelGeometry;
      const targetY = geometry.metersToY(Model.displacementAt(state.frequencyHz, task.start));
      const zeroClient = svgToClient(0, rulerBox.zeroY);
      const targetClient = svgToClient(0, targetY);
      const tickStart = svgToClient(rulerBox.anchorX, rulerBox.zeroY);
      const tickEnd = svgToClient(rulerBox.anchorX + rulerBox.direction * 23 / rulerBox.scaleX, rulerBox.zeroY);
      const guideStart = svgToClient(GUIDE_X1, targetY);
      const guideEnd = svgToClient(GUIDE_X2, targetY);
      const tickLeft = Math.min(tickStart?.x ?? 0, tickEnd?.x ?? 0);
      const tickRight = Math.max(tickStart?.x ?? 0, tickEnd?.x ?? 0);
      const guideLeft = Math.min(guideStart?.x ?? 0, guideEnd?.x ?? 0);
      const guideRight = Math.max(guideStart?.x ?? 0, guideEnd?.x ?? 0);
      const overlapPx = Math.max(0, Math.min(tickRight, guideRight) - Math.max(tickLeft, guideLeft));
      const horizontal = tickLeft < guideLeft
        ? { horizontalMode: "left-boundary", boundaryOverlapPx: overlapPx }
        : tickRight > guideRight
          ? { horizontalMode: "right-boundary", boundaryOverlapPx: overlapPx }
          : { horizontalMode: "guide-fraction",
              guideFraction: clamp((rulerBox.anchorX - GUIDE_X1) / (GUIDE_X2 - GUIDE_X1), 0, 1) };
      return {
        mode, moveNorm: movementNorm, rulerZeroM: geometry.yToMeters(rulerBox.zeroY),
        rulerX: rulerBox.anchorX,
        rulerSide: rulerBox.rulerSide,
        rulerGeometry: RULER_GEOMETRY,
        ...horizontal,
        zeroTickOverlapPx: overlapPx,
        zeroErrorPx: zeroClient && targetClient ? zeroClient.y - targetClient.y :
          (rulerBox.zeroY - targetY) * rulerBox.scaleY
      };
    }
    function readingFromRuler() {
      const task = currentTask();
      const placement = state.activePlacement;
      if (drag || !task || !placement || placement.task !== task.task ||
          !(Scoring.validPlacement(placement, task.task) ||
            Scoring.validLegacyPlacement(placement, task.task))) return null;
      const current = placementFromRuler(placement.mode);
      if (!current || Math.abs(current.rulerZeroM - placement.rulerZeroM) > 1e-9 ||
          Math.abs(current.zeroErrorPx - placement.zeroErrorPx) > .01) return null;
      if (Object.prototype.hasOwnProperty.call(placement, "zeroTickOverlapPx")) {
        if (Math.abs(current.rulerX - placement.rulerX) > 1e-9 ||
            current.rulerSide !== placement.rulerSide ||
            current.rulerGeometry !== placement.rulerGeometry ||
            current.horizontalMode !== placement.horizontalMode ||
            (current.horizontalMode === "guide-fraction"
              ? Math.abs(current.guideFraction - placement.guideFraction) > 1e-9
              : Math.abs(current.boundaryOverlapPx - placement.boundaryOverlapPx) > .01) ||
            Math.abs(current.zeroTickOverlapPx - placement.zeroTickOverlapPx) > .01) return null;
      } else {
        const box = rulerGeometry();
        const legacyGapPx = Math.max(0,
          (Math.abs(box.x < BALL_X ? box.x + box.bodyWidth - BALL_X : box.x - BALL_X) - box.ballRadius) * box.scaleX);
        const legacySide = box.x < BALL_X ? "left" : "right";
        if (legacySide !== placement.legacyEdgeSide ||
            Math.abs(legacyGapPx - placement.legacyEdgeGapPx) > .01) return null;
      }
      const readingM = Model.displacementAt(state.frequencyHz, task.end) - placement.rulerZeroM;
      return Number.isFinite(readingM) && readingM >= 0 ? readingM : null;
    }
    function clearStageOutput() {
      stageReadoutTaskKey = null;
      stageOutputAllowedTaskKey = null;
      dom.stageReadout.textContent = "";
      dom.stageReadout.classList.add("is-hidden");
      delete dom.stageReadout.dataset.readingM;
      delete dom.stageReadout.dataset.measuredY;
    }
    function resetManualInput() {
      manualTaskKey = null;
      manualBaselineText = null;
      manualOriginalReadingM = null;
      dom.reading.value = "";
    }
    function showStageOutput(readingM) {
      const task = currentTask();
      if (!Number.isFinite(readingM) || !task) return clearStageOutput();
      const rulerBox = rulerGeometry();
      const stageRect = dom.stage.getBoundingClientRect();
      const measuredY = rulerBox.zeroY + rulerBox.tickSpan * readingM / rulerBox.modelGeometry.cameraMaxM;
      const anchor = svgToClient(rulerBox.anchorX, measuredY);
      const bodyLeft = svgToClient(rulerBox.visibleLeft, measuredY);
      if (!anchor) return clearStageOutput();
      const readingKey = String(readingM);
      const announce = stageReadoutTaskKey !== task.key || dom.stageReadout.dataset.readingM !== readingKey ||
        dom.stageReadout.classList.contains("is-hidden");
      if (announce) dom.stageReadout.textContent = `${formatPhotoCm(state.frequencyHz, readingM, 2)} cm`;
      dom.stageReadout.dataset.readingM = readingKey;
      dom.stageReadout.dataset.measuredY = String(measuredY);
      dom.stageReadout.classList.remove("is-hidden");
      const width = dom.stageReadout.offsetWidth;
      const height = dom.stageReadout.offsetHeight;
      const right = anchor.x - stageRect.left + 6;
      const fallback = (bodyLeft?.x ?? anchor.x) - stageRect.left - width - 6;
      const maxLeft = stageRect.width - width - 4;
      const candidates = [right, fallback].map((left) => clamp(left, 4, maxLeft));
      for (let left = 4; left <= maxLeft; left += 2) candidates.push(left);
      const protectedRects = [...dom.scene.querySelectorAll(
        '[data-stamp],[data-point-label],[data-ruler-body],[data-ruler-tick],[data-ruler-label-cm],[data-ruler-unit]')]
        .map((node) => node.getBoundingClientRect());
      const top = anchor.y - stageRect.top - height / 2;
      const overlapArea = (left) => {
        const rect = { left: stageRect.left + left, right: stageRect.left + left + width,
          top: stageRect.top + top, bottom: stageRect.top + top + height };
        return protectedRects.reduce((sum, protectedRect) => sum +
          Math.max(0, Math.min(rect.right, protectedRect.right) - Math.max(rect.left, protectedRect.left)) *
          Math.max(0, Math.min(rect.bottom, protectedRect.bottom) - Math.max(rect.top, protectedRect.top)), 0);
      };
      const ranked = candidates.map((left, index) => ({ left, index, overlap: overlapArea(left) }))
        .sort((a, b) => a.overlap - b.overlap || a.index - b.index);
      dom.stageReadout.style.left = `${ranked[0].left}px`;
      dom.stageReadout.style.top = `${top}px`;
      stageReadoutTaskKey = task.key;
      stageOutputAllowedTaskKey = task.key;
    }
    function completeMovement(mode) {
      const placement = placementFromRuler(mode);
      const next = placement && Persistence.withPlacement(state, placement);
      if (!next) {
        clearStageOutput();
        updatePlacementStatus();
        updateRulerDescription();
        return false;
      }
      state = next; lastCompletedRuler = { ...ruler };
      stageOutputAllowedTaskKey = currentTask()?.key || null;
      checkpoint(); render();
      if (readingFromRuler() !== null) dom.live.textContent = `尺位完成；舞台顯示 ${dom.stageReadout.textContent}。`;
      dom.ruler.focus({ preventScroll: true });
      return true;
    }
    function pointerDown(event) {
      if (locked || !currentTask() || event.button !== 0) return;
      const startSvg = clientToSvg(event.clientX, event.clientY);
      if (!startSvg) return;
      clearStageOutput();
      drag = {
        pointerId: event.pointerId, startSvg,
        rulerStart: { ...ruler }, prior: { ...lastCompletedRuler }
      };
      movementStart = { ...ruler };
      dom.ruler.setPointerCapture(event.pointerId);
      dom.ruler.dataset.moves = "0"; dom.ruler.dataset.ups = "0"; dom.ruler.dataset.cancels = "0";
      dom.ruler.dataset.trusted = String(event.isTrusted); dom.ruler.dataset.pointerType = event.pointerType;
    }
    function pointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      dom.ruler.dataset.moves = String(Number(dom.ruler.dataset.moves || 0) + 1);
      const currentSvg = clientToSvg(event.clientX, event.clientY);
      if (!currentSvg) return;
      clearStageOutput();
      applyRulerGeometry({
        x: drag.rulerStart.x + currentSvg.x - drag.startSvg.x,
        y: drag.rulerStart.y + currentSvg.y - drag.startSvg.y
      });
      movementNorm = distance(ruler, movementStart) / Math.hypot(SVG_W, SVG_H);
      positionRuler(); drawRuler(); updatePlacementStatus();
    }
    function pointerUp(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      dom.ruler.dataset.ups = String(Number(dom.ruler.dataset.ups || 0) + 1);
      dom.ruler.releasePointerCapture(event.pointerId);
      drag = null; completeMovement("pointer");
    }
    function pointerCancel(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      dom.ruler.dataset.cancels = String(Number(dom.ruler.dataset.cancels || 0) + 1);
      ruler = { ...drag.prior }; drag = null; movementNorm = state.activePlacement?.moveNorm || 0;
      clearStageOutput();
      positionRuler(); drawRuler();
      dom.live.textContent = "拖動中斷；直尺已回復到上一次完成的位置，未建立證據。";
    }
    function rulerKey(event) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) || locked || !currentTask()) return;
      event.preventDefault();
      nudge(event.key.replace("Arrow", "").toLowerCase(), event.shiftKey);
    }
    function nudge(direction, large) {
      if (locked || !currentTask()) return;
      clearStageOutput();
      const amount = large ? 8 : 2;
      movementStart = { ...ruler };
      const candidate = { ...ruler };
      if (direction === "up") candidate.y -= amount;
      if (direction === "down") candidate.y += amount;
      if (direction === "left") candidate.x -= amount;
      if (direction === "right") candidate.x += amount;
      applyRulerGeometry(candidate);
      const previous = state.activePlacement?.moveNorm || 0;
      movementNorm = previous + distance(ruler, movementStart) / Math.hypot(SVG_W, SVG_H);
      positionRuler(); drawRuler(); completeMovement("keyboard");
    }
    function parkRuler() {
      if (locked) return;
      clearStageOutput();
      ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; movementNorm = 0;
      if (state.activePlacement) {
        delete state.activePlacement;
        state.variant = state.returnToReview ? "review-edit-unpositioned" : "normal-unpositioned";
        checkpoint();
      }
      render();
    }
    function resolve(skipped) {
      if (locked) return;
      dom.measurementError.textContent = "";
      if (drag) {
        clearStageOutput();
        dom.measurementError.textContent = "請先完成移尺；放手後才可記錄讀數。";
        return;
      }
      const resolvedInput = skipped ? null : resolveManualReading(
        state.frequencyHz, dom.reading.value, manualBaselineText, manualOriginalReadingM);
      if (!skipped && !resolvedInput.ok) {
        dom.measurementError.textContent = "請輸入 0 至 5 cm（包括 0 和 5）的有限相片讀數。";
        return;
      }
      if (!skipped && state.activePlacement) {
        const current = placementFromRuler(state.activePlacement.mode);
        const refreshed = current && Persistence.refreshPlacement(state, current);
        if (refreshed) state = refreshed;
        else {
          delete state.activePlacement;
          state.variant = state.returnToReview ? "review-edit-unpositioned" : "normal-unpositioned";
        }
      }
      const value = skipped ? null : resolvedInput.readingM;
      const next = Persistence.resolveMeasurement(state, value, skipped, {
        reusedOriginal: resolvedInput?.reusedOriginal === true
      });
      if (!next) {
        dom.measurementError.textContent = "未能安全記錄這個相片讀數，請檢查輸入。";
        return;
      }
      clearStageOutput();
      resetManualInput();
      state = next; movementNorm = state.activePlacement?.moveNorm || 0;
      if (!state.activePlacement) { ruler = { ...PARK }; lastCompletedRuler = { ...PARK }; }
      checkpoint(); render();
      if (state.phase === "review") focusPhaseHeading();
    }
    function collectAnalysisAndReview() {
      if (locked) return;
      dom.analysisError.textContent = "";
      const deltaText = dom.deltaT.value.trim();
      const delta = deltaText === "" ? null : Number(deltaText);
      if (delta !== null && (!Number.isFinite(delta) || delta <= 0)) return analysisError("Δt 必須留空或填寫正有限數值。");
      const patch = { deltaTS: delta };
      for (const [key] of RATIO_DEFINITIONS) {
        const inputs = [...document.querySelectorAll(`[data-ratio-key="${key}"]`)];
        const values = inputs.map((input) => input.value.trim() === "" ? null : Number(input.value));
        if (values.some((term) => term !== null && (!Number.isFinite(term) || term <= 0))) {
          return analysisError("時間比各項必須留空或填寫正有限數值。");
        }
        patch[key] = { values: [1, ...values] };
      }
      for (const key of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        const selected = document.querySelector(`input[name="${key}"]:checked`);
        patch[key] = selected?.value || null;
      }
      const updated = Persistence.setAnalysis(state, patch);
      const next = updated && Persistence.enterReview(updated);
      if (!next) return analysisError("答案狀態未能通過驗證，請檢查所有欄位。");
      clearStageOutput(); resetManualInput(); state = next; checkpoint(); render(); dom.reviewTitle.focus({ preventScroll: true });
    }
    function savePartialAnalysis() {
      if (state.phase !== "analyze" || locked) return;
      const patch = { deltaTS: null };
      const deltaText = dom.deltaT.value.trim();
      if (deltaText !== "") {
        const value = Number(deltaText);
        if (Number.isFinite(value) && value > 0) patch.deltaTS = value;
      }
      for (const [key] of RATIO_DEFINITIONS) {
        const inputs = [...document.querySelectorAll(`[data-ratio-key="${key}"]`)];
        patch[key] = { values: [1, ...inputs.map((input) => {
          const value = Number(input.value);
          return input.value.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
        })] };
      }
      for (const key of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        const selected = document.querySelector(`input[name="${key}"]:checked`);
        patch[key] = selected?.value || null;
      }
      const next = Persistence.setAnalysis(state, patch);
      if (next) { state = next; checkpoint(); }
    }
    function analysisError(message) { dom.analysisError.textContent = message; }
    function submit(confirmed = false) {
      if (locked || state.phase !== "review" || state.variant !== "ready") return;
      const candidate = Persistence.makeReview(state);
      const canonical = JSON.stringify(candidate);
      const blanks = unansweredCount(candidate.analysis);
      if (blanks && !(confirmed && blankConfirmationReview === canonical)) {
        blankConfirmationReview = canonical;
        dom.submissionNotice.setAttribute("role", "alertdialog");
        dom.submissionNotice.setAttribute("aria-modal", "false");
        dom.submissionNotice.setAttribute("aria-labelledby", "blankWarningTitle");
        dom.submissionNotice.setAttribute("aria-describedby", "blankWarningDescription");
        dom.submissionNotice.innerHTML = `<p id="blankWarningTitle"><strong>${blanks} 項未答</strong></p><p id="blankWarningDescription">未答項目會得 0 分；提交後會鎖定今次 attempt。</p><div class="blank-actions"><button type="button" data-blank-action="return">返回修改</button><button type="button" class="primary-button" data-blank-action="confirm">仍然提交</button></div>`;
        dom.submissionNotice.classList.remove("is-hidden");
        dom.submissionNotice.querySelector('[data-blank-action="return"]').focus();
        return;
      }
      latestReview = candidate;
      latestResult = Scoring.scoreAttempt(latestReview);
      locked = true;
      lockedPresentation = "submitting";
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
            locked = false; lockedPresentation = null; render(); clearSubmissionDialog();
            dom.submissionNotice.textContent = "提交未建立持久 final state；可保留目前答案再試。";
            dom.submissionNotice.classList.remove("is-hidden"); dom.submissionRetry.classList.remove("is-hidden");
          } else technicalLock("提交前檢查失敗；系統不能承諾重試，亦未聲稱已提交。");
        }
      });
    }
    function retryConnection() {
      if (!locked || lockedPresentation !== "pending") return;
      const outcome = SimScorm.retryPending();
      routeSubmission({ ...outcome, activityState: outcome.ok ? "success" : outcome.committed ? "committed" : outcome.frozen ? "frozen" : "retry" });
    }
    function retryTechnical() {
      if (!locked) return;
      if (lockedPresentation !== "assignment" || !assignmentCheckpointPending) {
        window.location.reload();
        return;
      }
      locked = false;
      if (!checkpoint()) {
        locked = true;
        lockedPresentation = "assignment";
        dom.technicalMessage.textContent = "仍未能保存今次隨機頻率；相片拍攝保持鎖定。再次重試仍會使用同一頻率。";
        return;
      }
      assignmentCheckpointPending = false;
      lockedPresentation = null;
      render();
      if (!previewAutoplayStarted) startSetupPreview();
    }
    function retryFinish() {
      if (!locked || lockedPresentation !== "committed") return;
      const finished = SimScorm.finish();
      if (finished) renderLockedResult(latestResult, true, "已提交並完成連線");
      else renderLockedResult(latestResult, true, "結果已寫入 Moodle；完成連線仍需重試", "finish");
    }
    function pendingLock(message) {
      locked = true;
      lockedPresentation = "pending";
      hideAll();
      dom.technical.classList.remove("is-hidden"); dom.technicalTitle.textContent = "提交狀態仍待確認";
      dom.technicalMessage.textContent = message; dom.technicalRetry.classList.add("is-hidden");
      const button = document.createElement("button");
      button.type = "button"; button.className = "primary-button"; button.textContent = "重試同一份提交";
      button.addEventListener("click", retryConnection);
      dom.technical.append(button);
      dom.badge.textContent = "待確認";
      renderFrequencyChip();
      renderStage();
    }
    function technicalLock(message, kind = "technical") {
      locked = true; lockedPresentation = kind; hideAll(); dom.technical.classList.remove("is-hidden");
      dom.technicalTitle.textContent = "暫時未能安全載入活動"; dom.technicalMessage.textContent = message;
      dom.technicalRetry.textContent = kind === "assignment" ? "重試保存同一頻率" : "重試連線";
      dom.technicalRetry.classList.remove("is-hidden"); dom.badge.textContent = "技術鎖定";
      renderFrequencyChip();
      renderStage();
    }
    function safeFinishedFallback(attempt, message) {
      locked = true; lockedPresentation = "fallback"; hideAll(); dom.result.classList.remove("is-hidden");
      const recorded = SimActivityFlow.recordedResult(attempt);
      dom.resultTitle.textContent = "已完成 attempt（詳細資料不可驗證）";
      dom.scorePanel.textContent = `Moodle 分數：${recorded.score ?? "--"} / 100　${SimActivityFlow.completionLabel(recorded.passed)}`;
      dom.resultFeedback.textContent = message; dom.badge.textContent = "已鎖定";
      renderFrequencyChip();
    }
    function renderLockedResult(result, trusted, title, retryKind) {
      locked = true; lockedPresentation = retryKind === "finish" ? "committed" : "result"; hideAll(); dom.result.classList.remove("is-hidden");
      dom.resultTitle.textContent = title; dom.badge.textContent = "已鎖定";
      const hasRecordedScore = Number.isFinite(result?.score);
      const hasRecordedStatus = typeof result?.passed === "boolean";
      dom.scorePanel.textContent = trusted
        ? `分數：${result.score ?? "--"} / ${result.maxScore || 100}　${SimActivityFlow.completionLabel(result.passed)}`
        : hasRecordedScore || hasRecordedStatus
          ? `Moodle 記錄：分數 ${hasRecordedScore ? result.score : "--"} / ${result?.maxScore || 100}　${SimActivityFlow.completionLabel(result?.passed)}`
          : "Moodle 記錄：分數 --　未能安全判斷合格狀態";
      dom.resultFeedback.replaceChildren();
      const feedback = document.createElement("p");
      feedback.textContent = trusted ? result.feedback : "Moodle 記錄優先；詳細 component feedback 已隱藏。";
      dom.resultFeedback.append(feedback);
      if (trusted && result.detail) {
        const details = document.createElement("p");
        const capped = result.capApplied || !result.meaningfulRulerUse && result.rawScore > 59;
        details.textContent = `操作 ${result.detail.process.points}/40；量度與時間 ${formatPoints(result.detail.quantitative.points)}/30；物理規律 ${result.detail.laws.points}/30。${capped ? " 因直尺證據不足，總分上限為 59 分。" : " 沒有套用 59 分上限。"}`;
        dom.resultFeedback.append(details);
        const information = document.createElement("div");
        information.innerHTML = recordedSeriesMarkup();
        information.querySelector(".recorded-series").setAttribute("aria-label", "量度系列資訊卡，不判定正確或錯誤");
        dom.resultFeedback.append(information.firstElementChild);
        const aggregateItems = (source, definitions, zeroStatus = "unanswered") => definitions.map(([id, label, max]) => {
          const points = source[id] || 0;
          return { id, label, status: points === max ? "correct" : points ? "incorrect" : zeroStatus,
            learner: `${formatPoints(points)} 分`, expected: `${max} 分`, guidance: "這是舊版 rubric 的保留結果；分數不會改按新版重算。", points, max };
        });
        const groups = [["操作", result.detail.process.items || aggregateItems(result.detail.process,
          [["setup", "拍攝設定", 4], ["totalPlacement", "總位移尺位", 8], ["totalReadings", "總位移操作", 4], ["intervals", "相鄰間隔操作", 24]], "no-evidence")],
        ["量度與時間", result.detail.quantitative.items || aggregateItems(result.detail.quantitative,
          [["deltaT", "相鄰影像時間", 4], ["totalReadings", "總位移讀數", 8], ["gapReadings", "相鄰間隔讀數", 8], ["ratios", "比例", 10]])],
        ["物理規律", result.detail.laws.items || aggregateItems(result.detail.laws,
          [["displacement", "總位移規律", 12], ["intervals", "相鄰間隔規律", 10], ["acceleration", "自由落體原因", 8]])]];
        for (const [name, items] of groups) {
          const section = document.createElement("section"); section.className = "result-group";
          const heading = document.createElement("h3"); heading.textContent = name; section.append(heading);
          const cards = document.createElement("div"); cards.className = "result-cards";
          for (const item of items || []) cards.append(resultCard(item, latestReview?.frequencyHz));
          section.append(cards); dom.resultFeedback.append(section);
        }
        const teaching = document.createElement("ul"); teaching.className = "result-detail-list";
        for (const text of resultFeedbackItems(latestReview, result)) {
          const item = document.createElement("li"); item.innerHTML = text; teaching.append(item);
        }
        dom.resultFeedback.append(teaching);
      }
      dom.resultRetry.classList.toggle("is-hidden", retryKind !== "finish");
      renderFrequencyChip();
      renderStage();
    }
    function resultCard(item, frequencyHz) {
      const card = document.createElement("article"); card.className = `result-card status-${item.status}`;
      card.dataset.resultItem = item.id;
      const icon = { correct: "✓", incorrect: "✕", unanswered: "—", "no-evidence": "!" }[item.status] || "•";
      const status = { correct: "正確", incorrect: "需修正", unanswered: "未答", "no-evidence": "未有證據" }[item.status] || item.status;
      const isDistance = Scoring.TOTAL_KEYS.includes(item.id) || Scoring.GAP_KEYS.includes(item.id);
      const display = (value) => {
        if (value === null || value === undefined) return "未答";
        if (answerLabel(item.id, value)) return answerLabel(item.id, value);
        if (typeof value !== "number") return String(value);
        if (isDistance) return `${formatPhotoCm(frequencyHz, value)} cm`;
        return item.id === "delta-t" ? `${trimFixed(value, 4)} s` : trimFixed(value, 4);
      };
      const tolerance = isDistance ? `容差：±${formatPhotoCm(frequencyHz, Scoring.distanceTolerance(item.expected))} cm` :
        item.id === "delta-t" ? `容差：±${Scoring.DELTA_T_ABS_TOLERANCE_S} s` :
          item.id.startsWith("cumulative-time-") || item.id.startsWith("interval-time-") ? `容差：±${Scoring.RATIO_TERM_TOLERANCE}` : "";
      card.innerHTML = `<h4><span aria-hidden="true">${icon}</span> ${escapeHtml(item.label)} — ${status}</h4>
        <p>你的答案：${escapeHtml(display(item.learner))}</p><p>參考答案：${escapeHtml(display(item.expected))}</p>
        ${tolerance ? `<p>${escapeHtml(tolerance)}</p>` : ""}<p>得分：${formatPoints(item.points)} / ${formatPoints(item.max)}</p><p>${escapeHtml(item.guidance)}</p>`;
      return card;
    }
    function render() {
      hideAll();
      renderFrequencyChip();
      renderStage();
      const capturing = animationView.mode === "capture";
      dom.assignedFrequency.innerHTML = state.frequencyAssigned
        ? mathQuantity("f", state.frequencyHz, "Hz")
        : "正在保存…";
      dom.generate.disabled = state.variant !== "assigned" || capturing;
      dom.replayPreview.disabled = capturing;
      if (capturing) { dom.setup.classList.remove("is-hidden"); dom.badge.textContent = "拍攝中"; }
      else if (state.phase === "setup") { dom.setup.classList.remove("is-hidden"); dom.badge.textContent = "設定"; }
      else if (["measure-total", "measure-interval"].includes(state.phase)) renderMeasurement();
      else if (state.phase === "analyze") renderAnalysis();
      else if (state.phase === "review") renderReview();
      updateAnimationStatus();
      updateRulerDescription();
    }
    function hideAll() {
      [dom.setup, dom.measurement, dom.analysis, dom.review, dom.result, dom.technical].forEach((element) => element.classList.add("is-hidden"));
      dom.submissionRetry.classList.add("is-hidden"); dom.submissionNotice.classList.add("is-hidden");
      clearSubmissionDialog();
    }
    function clearSubmissionDialog() {
      for (const name of ["role", "aria-modal", "aria-labelledby", "aria-describedby"]) dom.submissionNotice.removeAttribute(name);
    }
    function renderFrequencyChip() {
      const valid = Model.validFrequency(state?.frequencyHz);
      dom.frequencyChip.textContent = valid ? `頻閃頻率：f = ${state.frequencyHz} Hz` : "頻閃頻率：未能確認";
      dom.frequencyChip.setAttribute("aria-label", valid ? `頻閃頻率 f = ${state.frequencyHz} Hz` : "頻閃頻率未能確認");
    }
    function focusPhaseHeading() {
      const heading = state.phase === "analyze" ? dom.analysisTitle :
        ["measure-total", "measure-interval"].includes(state.phase) ? dom.measurementTitle :
          state.phase === "review" ? dom.reviewTitle : null;
      heading?.focus({ preventScroll: true });
    }
    function renderStage() {
      dom.trajectory.replaceChildren();
      if (!state.generated) {
        clearStageOutput();
        dom.ruler.classList.add("is-hidden"); dom.rulerGraphic.replaceChildren();
        drawPreview();
        return;
      }
      const geometry = Model.geometry(state.frequencyHz, SVG_H, CAMERA_TOP_MARGIN, CAMERA_BOTTOM_MARGIN);
      const ns = "http://www.w3.org/2000/svg";
      if (animationView.mode === "capture") {
        clearStageOutput();
        for (const stamp of animationView.stamps) drawBall(ns, geometry.metersToY(stamp.displacementM), stamp.index, true);
        if (Number.isFinite(animationView.liveBallM)) drawLiveBall(ns, geometry.metersToY(animationView.liveBallM));
        dom.ruler.classList.add("is-hidden"); dom.rulerGraphic.replaceChildren();
        dom.stageHint.innerHTML = "實心球正在連續下落；半透明球影是相機按固定 <span class=\"delta\">Δ</span><var>t</var> 留下的位置。";
        return;
      }
      const task = currentTask();
      if (!task || locked) clearStageOutput();
      const metrics = apparatusMetrics();
      if (task) {
        [task.start, task.end].forEach((index) => {
          const line = document.createElementNS(ns, "line");
          const y = geometry.metersToY(Model.displacementAt(state.frequencyHz, index));
          line.setAttribute("x1", GUIDE_X1); line.setAttribute("x2", GUIDE_X2); line.setAttribute("y1", y); line.setAttribute("y2", y);
          line.setAttribute("stroke", "#2563eb"); line.setAttribute("stroke-dasharray", "5 5"); line.setAttribute("opacity", ".55");
          line.setAttribute("pointer-events", "none");
          line.dataset.measurementGuide = index === task.start ? "start" : "end";
          line.style.strokeWidth = String(metrics.strokeWidth);
          dom.trajectory.append(line);
        });
      }
      Model.trajectory(state.frequencyHz).forEach((point) =>
        drawBall(ns, geometry.metersToY(point.displacementM), point.index, false));
      dom.ruler.classList.toggle("is-hidden", locked || state.phase === "review");
      dom.stageHint.textContent = task ? "在操作面板選定的量度起點對準直尺零刻度。" : "頻閃相片已生成；按操作面板完成數據分析。";
      drawRuler(); positionRuler();
    }
    function drawPreview() {
      const ns = "http://www.w3.org/2000/svg";
      const previewY = (meters) => 30 + (SVG_H - 55) * meters / 5.5;
      if (["preview-reduced", "preview-static"].includes(animationView.mode)) {
        drawLiveBall(ns, previewY(0));
        drawLiveBall(ns, previewY(5));
        const guide = document.createElementNS(ns, "path");
        guide.setAttribute("d", `M ${BALL_X} ${previewY(.25)} L ${BALL_X} ${previewY(4.75)}`);
        guide.setAttribute("class", "preview-guide");
        guide.style.strokeWidth = String(apparatusMetrics().strokeWidth * 2);
        dom.trajectory.insertBefore(guide, dom.trajectory.firstChild);
        dom.stageHint.textContent = prefersReducedMotion()
          ? "連續下落動畫已按你的動態效果設定省略；起點、終點及箭頭只作示意。"
          : "連續下落預覽已暫停；按「重播連續下落」可再看一次。";
        return;
      }
      const displacement = Number.isFinite(animationView.liveBallM) ? animationView.liveBallM : 0;
      drawLiveBall(ns, previewY(displacement));
      dom.stageHint.textContent = "連續自由落體示意；尚未拍攝，亦不產生量度數據。";
    }
    function drawLiveBall(ns, y) {
      const metrics = apparatusMetrics();
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", BALL_X); circle.setAttribute("cy", y); circle.setAttribute("r", metrics.ballRadius);
      circle.setAttribute("class", "preview-ball"); circle.dataset.liveBall = "true";
      circle.style.strokeWidth = String(metrics.strokeWidth * 2);
      dom.trajectory.append(circle);
    }
    function drawBall(ns, y, index, capture) {
      const metrics = apparatusMetrics();
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", BALL_X); circle.setAttribute("cy", y); circle.setAttribute("r", metrics.ballRadius);
      circle.setAttribute("class", capture ? "capture-stamp" : "preview-ball");
      circle.style.strokeWidth = String(metrics.strokeWidth * 2);
      circle.dataset.stamp = String(index);
      const label = document.createElementNS(ns, "text");
      const labelGap = Math.max(7, 6 / Math.min(metrics.scaleX, metrics.scaleY));
      const right = index % 2 === 0;
      label.dataset.pointLabel = String(index);
      label.setAttribute("x", right ? BALL_X + metrics.ballRadius + labelGap : BALL_X - metrics.ballRadius - labelGap);
      label.setAttribute("text-anchor", right ? "start" : "end");
      label.setAttribute("y", y + metrics.pointLabelSize * .32);
      label.setAttribute("font-size", metrics.pointLabelSize);
      label.setAttribute("font-weight", "800");
      label.style.paintOrder = "stroke";
      label.style.stroke = "#fff";
      label.style.strokeWidth = String(metrics.strokeWidth * 3);
      label.style.strokeLinejoin = "round";
      label.style.fill = "#111827";
      label.textContent = `P${"₀₁₂₃₄"[index]}`;
      dom.trajectory.append(circle, label);
    }
    function renderExposureCue() {
      if (!dom.cueGroup) return;
      const index = Number.isInteger(animationView.cueIndex) ? animationView.cueIndex :
        animationView.reducedCue && state.generated ? 4 : null;
      if (index === null) {
        if (animationView.mode !== "capture") dom.cueGroup.replaceChildren();
        return;
      }
      if (dom.cueGroup.dataset.index === String(index) && dom.cueGroup.childElementCount) return;
      const geometry = state.generated ? Model.geometry(state.frequencyHz, SVG_H, CAMERA_TOP_MARGIN, CAMERA_BOTTOM_MARGIN) : null;
      if (!geometry) return;
      const metrics = apparatusMetrics();
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", BALL_X);
      ring.setAttribute("cy", geometry.metersToY(Model.displacementAt(state.frequencyHz, index)));
      ring.setAttribute("r", metrics.ballRadius + 6 / Math.min(metrics.scaleX, metrics.scaleY));
      ring.setAttribute("class", `exposure-cue${animationView.reducedCue ? " is-static" : ""}`);
      ring.dataset.exposureCue = String(index);
      ring.style.strokeWidth = String(metrics.strokeWidth * 3);
      ring.setAttribute("aria-hidden", "true");
      dom.cueGroup.dataset.index = String(index);
      dom.cueGroup.replaceChildren(ring);
      if (!animationView.reducedCue) ring.addEventListener("animationend", () => {
        if (ring.isConnected) {
          dom.cueGroup.replaceChildren();
          delete dom.cueGroup.dataset.index;
        }
      }, { once: true });
    }
    function updateAnimationStatus() {
      if (!dom.animationStatus) return;
      let message;
      if (animationView.mode === "capture") {
        const last = animationView.stamps.at(-1);
        message = last
          ? `正在拍攝：已記錄 <var>P</var><sub>${last.index}</sub>。實心球是同一個正在下落的球。`
          : "正在拍攝。";
      } else if (state.generated) {
        message = "頻閃相片完成：五個球影來自同一個球，以相等時間間隔記錄；現在量度靜態相片。";
      } else if (prefersReducedMotion()) {
        message = "連續下落動畫已按你的動態效果設定省略；此靜態示意不產生量度數據。";
      } else message = "預覽只作說明，尚未建立頻閃相片。";
      if (dom.animationStatus.innerHTML !== message) dom.animationStatus.innerHTML = message;
    }
    function drawRuler() {
      dom.rulerGraphic.replaceChildren();
      if (!state.generated) return;
      const ns = "http://www.w3.org/2000/svg";
      const rulerBox = applyRulerGeometry(ruler);
      const body = document.createElementNS(ns, "rect");
      body.dataset.rulerBody = "true";
      body.setAttribute("x", rulerBox.x); body.setAttribute("y", rulerBox.fullTop);
      body.setAttribute("width", rulerBox.bodyWidth); body.setAttribute("height", rulerBox.fullBottom - rulerBox.fullTop);
      body.setAttribute("fill", "rgba(254,243,199,.78)"); body.setAttribute("stroke", "#92400e");
      body.style.strokeWidth = String(rulerBox.strokeWidth);
      const visibleBody = document.createElementNS(ns, "rect");
      visibleBody.dataset.rulerVisibleBody = "true";
      visibleBody.setAttribute("x", rulerBox.visibleLeft); visibleBody.setAttribute("y", rulerBox.visibleTop);
      visibleBody.setAttribute("width", rulerBox.visibleWidth); visibleBody.setAttribute("height", rulerBox.visibleHeight);
      visibleBody.setAttribute("fill", "none"); visibleBody.setAttribute("stroke", "none");
      dom.rulerGraphic.append(body, visibleBody);
      for (let tenth = 0; tenth <= 50; tenth += 1) {
        const photoCm = tenth / 10;
        const y = rulerBox.zeroY + rulerBox.tickSpan * photoCm / Model.PHOTO_RULER_CM;
        const major = tenth % 10 === 0;
        const medium = !major && tenth % 5 === 0;
        const kind = major ? "major" : medium ? "medium" : "fine";
        const line = document.createElementNS(ns, "line");
        line.dataset.rulerTick = "true"; line.dataset.tickCm = String(photoCm); line.dataset.tickKind = kind;
        const tickLength = (major ? 23 : medium ? 16 : 10) / rulerBox.scaleX;
        line.setAttribute("x1", rulerBox.anchorX); line.setAttribute("x2", rulerBox.anchorX + rulerBox.direction * tickLength);
        line.setAttribute("y1", y); line.setAttribute("y2", y); line.setAttribute("stroke", "#78350f");
        line.style.strokeWidth = String(rulerBox.strokeWidth);
        dom.rulerGraphic.append(line);
        if (major) {
          const text = document.createElementNS(ns, "text");
          text.dataset.rulerLabelCm = String(photoCm);
          text.setAttribute("x", rulerBox.anchorX + rulerBox.direction * 46 / rulerBox.scaleX);
          text.setAttribute("text-anchor", rulerBox.direction > 0 ? "start" : "end");
          text.setAttribute("y", y + rulerBox.rulerLabelSize * .34);
          text.setAttribute("font-size", rulerBox.rulerLabelSize);
          text.setAttribute("font-weight", "700");
          text.textContent = String(photoCm); dom.rulerGraphic.append(text);
        }
      }
      const unit = document.createElementNS(ns, "text");
      unit.dataset.rulerUnit = "true";
      unit.setAttribute("font-size", rulerBox.rulerUnitSize); unit.setAttribute("font-style", "normal");
      unit.setAttribute("font-weight", "800");
      unit.setAttribute("text-anchor", "middle");
      unit.setAttribute("x", rulerBox.x + rulerBox.bodyWidth / 2);
      unit.setAttribute("y", rulerBox.zeroY + rulerBox.tickSpan * .3 / Model.PHOTO_RULER_CM);
      unit.textContent = "cm";
      dom.rulerGraphic.append(unit);
    }
    function positionRuler() {
      const rulerBox = applyRulerGeometry(ruler);
      const stageRect = dom.stage.getBoundingClientRect();
      const topLeft = svgToClient(rulerBox.visibleLeft, rulerBox.visibleTop);
      const bottomRight = svgToClient(rulerBox.visibleLeft + rulerBox.visibleWidth,
        rulerBox.visibleTop + rulerBox.visibleHeight);
      if (!topLeft || !bottomRight) return;
      const visibleLeft = Math.min(topLeft.x, bottomRight.x) - stageRect.left;
      dom.ruler.style.left = `${visibleLeft}px`;
      dom.ruler.style.top = `${Math.min(topLeft.y, bottomRight.y) - stageRect.top}px`;
      dom.ruler.style.width = `${Math.abs(bottomRight.x - topLeft.x)}px`;
      dom.ruler.style.height = `${Math.abs(bottomRight.y - topLeft.y)}px`;
      dom.ruler.dataset.zeroY = String(rulerBox.zeroY);
      dom.ruler.dataset.zeroTickX = String(rulerBox.anchorX);
      dom.ruler.dataset.visibleTop = String(rulerBox.visibleTop);
      dom.ruler.dataset.visibleHeight = String(rulerBox.visibleHeight);
    }
    function restoreRuler() {
      if (!state.activePlacement || !state.generated) {
        ruler = { ...PARK }; movementNorm = 0; lastCompletedRuler = { ...ruler };
        stageOutputAllowedTaskKey = null;
        return;
      }
      const placement = state.activePlacement;
      const geometry = Model.geometry(state.frequencyHz, SVG_H, CAMERA_TOP_MARGIN, CAMERA_BOTTOM_MARGIN);
      const provisional = rulerGeometry({ x: 0, y: geometry.metersToY(placement.rulerZeroM) });
      const targetM = placement.task === "total" ? 0 :
        Model.displacementAt(state.frequencyHz, Scoring.GAP_KEYS.indexOf(placement.task));
      const targetY = geometry.metersToY(targetM);
      const zeroY = Object.prototype.hasOwnProperty.call(placement, "horizontalMode")
        ? targetY + placement.zeroErrorPx / provisional.scaleY
        : geometry.metersToY(placement.rulerZeroM);
      const legacyGapSvg = placement.legacyEdgeGapPx / provisional.scaleX + provisional.ballRadius;
      const historicalLeftOffset = !Object.prototype.hasOwnProperty.call(placement, "rulerGeometry") &&
        placement.rulerSide === "left" ? 23 / provisional.scaleX : 0;
      const x = placement.horizontalMode === "left-boundary"
        ? GUIDE_X1 + placement.boundaryOverlapPx / provisional.scaleX
        : placement.horizontalMode === "right-boundary"
          ? GUIDE_X2 + (23 - placement.boundaryOverlapPx) / provisional.scaleX
          : placement.horizontalMode === "guide-fraction"
            ? GUIDE_X1 + placement.guideFraction * (GUIDE_X2 - GUIDE_X1) + historicalLeftOffset
            : Number.isFinite(placement.rulerX) ? placement.rulerX :
        placement.legacyEdgeSide === "left"
          ? BALL_X - legacyGapSvg
          : BALL_X + legacyGapSvg + provisional.bodyWidth;
      applyRulerGeometry({ x, y: zeroY });
      movementNorm = placement.moveNorm;
      if (placement.horizontalMode) {
        const current = placementFromRuler(placement.mode);
        const refreshed = current && Persistence.refreshPlacement(state, current);
        if (refreshed) state = refreshed;
      }
      lastCompletedRuler = { ...ruler };
      stageOutputAllowedTaskKey = currentTask()?.key || null;
    }
    function renderMeasurement() {
      dom.measurement.classList.remove("is-hidden");
      const total = state.phase === "measure-total";
      const task = currentTask();
      dom.badge.textContent = total ? "量度總位移" : "量度相鄰間隔";
      dom.measurementTitle.textContent = total ? "2. 量度總位移" : "2. 量度相鄰間隔";
      dom.measurementPrompt.innerHTML = total
        ? `第 ${state.currentStep + 1}/4 項：保持零刻度對準 <var>P</var><sub>0</sub>，讀取 <var>P</var><sub>${state.currentStep + 1}</sub> 的總位移。`
        : `第 ${state.currentStep + 1}/4 項：重新移尺，把零刻度對準 <var>P</var><sub>${state.currentStep}</sub>，讀取 <var>P</var><sub>${state.currentStep + 1}</sub>。`;
      dom.readingLabel.innerHTML = total
        ? `相片上 <var>P</var><sub>0</sub> 至 <var>P</var><sub>${state.currentStep + 1}</sub> 距離`
        : `相片上 <var>P</var><sub>${state.currentStep}</sub><var>P</var><sub>${state.currentStep + 1}</sub> 距離`;
      if (manualTaskKey !== task.key) {
        const previous = state.returnToReview ? state.measurements[task.key] : null;
        const baseline = previous?.status === "recorded"
          ? formatPhotoCm(state.frequencyHz, previous.readingM, 12) : "";
        dom.reading.value = baseline;
        manualBaselineText = previous?.status === "recorded" ? baseline : null;
        manualOriginalReadingM = previous?.status === "recorded" ? previous.readingM : null;
        manualTaskKey = task.key;
      }
      if (stageReadoutTaskKey && stageReadoutTaskKey !== task.key) clearStageOutput();
      dom.returnReview.classList.toggle("is-hidden", !state.returnToReview);
      updatePlacementStatus();
    }
    function updatePlacementStatus() {
      const task = currentTask();
      const reading = readingFromRuler();
      const valid = reading !== null;
      dom.placementStatus.classList.toggle("is-ready", Boolean(valid));
      dom.placementStatus.textContent = drag ? "正在移動直尺；放手完成尺位後才會顯示舞台讀尺提示。" :
        ruler.x === PARK.x && ruler.y === PARK.y ? "直尺仍在停泊區。" :
        valid ? "零刻度已對準所選起點，並與起點投影線重疊。" : "請把零刻度對準所選起點，並讓零主刻度與起點投影線重疊。";
      if (valid && !drag && stageOutputAllowedTaskKey === task?.key) showStageOutput(reading);
      else clearStageOutput();
    }
    function updateRulerDescription() {
      if (!state.generated) return;
      const task = currentTask();
      const geometry = Model.geometry(state.frequencyHz, SVG_H, CAMERA_TOP_MARGIN, CAMERA_BOTTOM_MARGIN);
      const zero = geometry.yToMeters(ruler.y);
      const photoZero = formatPhotoCm(state.frequencyHz, zero);
      const reading = readingFromRuler();
      const readingText = reading === null ? "" : `；相片上距離 ${formatPhotoCm(state.frequencyHz, reading)} cm`;
      dom.ruler.setAttribute("aria-label", `${task ? dom.measurementPrompt.textContent : "頻閃相片"}；直尺零刻度在相片尺 ${photoZero} cm${readingText}。`);
    }
    function renderAnalysis() {
      dom.analysis.classList.remove("is-hidden"); dom.badge.textContent = "分析";
      dom.deltaT.value = state.analysis.deltaTS ?? "";
      for (const [key] of RATIO_DEFINITIONS) {
        const answer = state.analysis[key];
        const section = document.querySelector(`[data-ratio="${key}"]`);
        section.querySelector(".ratio-inputs").classList.remove("is-hidden");
        section.querySelector(`[data-insufficient="${key}"]`).classList.add("is-hidden");
        section.querySelectorAll("input").forEach((input, index) => { input.value = answer.values[index + 1] ?? ""; });
      }
      const existing = dom.analysis.querySelector(".recorded-series");
      existing?.remove();
      dom.ratioGroups.insertAdjacentHTML("beforebegin", recordedSeriesMarkup());
      for (const key of ["lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"]) {
        document.querySelectorAll(`input[name="${key}"]`).forEach((input) => { input.checked = input.value === state.analysis[key]; });
      }
    }
    function renderReview() {
      dom.review.classList.remove("is-hidden"); dom.badge.textContent = "提交前檢查";
      const rows = Persistence.MEASUREMENT_KEYS.map((key) => {
        const item = state.measurements[key];
        const evidence = key.startsWith("total")
          ? item?.usedTotalPlacement === true : Boolean(state.evidence[key]?.usedWhileValid);
        return `<tr><th>${measurementName(key)}</th><td>${item?.status === "recorded" ? `相片上 ${escapeHtml(formatPhotoCm(state.frequencyHz, item.readingM))} <span class="unit">cm</span>` : "已跳過"}</td><td>${evidence ? "有尺位證據" : "未有尺位證據"}</td><td><button type="button" data-edit-measurement="${key}">修正 ${measurementName(key)}</button></td></tr>`;
      }).join("");
      const ratioRows = RATIO_DEFINITIONS.map(([key, title]) => {
        const answered = state.analysis[key].values.slice(1).filter((value) => value !== null).length;
        return `<p><strong>${title}：</strong>${answered === 3 ? "已作答" : answered ? `${answered}/3 項已作答` : "未答"}</p>`;
      }).join("");
      const concepts = [
        ["總位移與時間", state.analysis.lawAnswerId],
        ["相等時間間隔位移", state.analysis.intervalLawAnswerId],
        ["間隔增加原因", state.analysis.accelerationAnswerId]
      ].map(([title, value]) => `<p><strong>${title}：</strong>${value === null ? "未答" : "已作答"}</p>`).join("");
      dom.reviewContent.innerHTML = `
        ${recordedSeriesMarkup()}
        <table class="review-table"><thead><tr><th>量度</th><th>讀數</th><th>操作</th><th>修正</th></tr></thead><tbody>${rows}</tbody></table>
        <section class="review-analysis" aria-label="比例及物理規律答案">${ratioRows}${concepts}</section>
        <p>${unansweredCount(state.analysis)} 項未答；你仍可提交，未答項目會得 0 分。</p>`;
      dom.submit.disabled = false;
    }
    function measurementName(key) {
      const totalIndex = Scoring.TOTAL_KEYS.indexOf(key);
      if (totalIndex >= 0) return `<var>P</var><sub>0</sub>→<var>P</var><sub>${totalIndex + 1}</sub>`;
      const gapIndex = Scoring.GAP_KEYS.indexOf(key);
      return `<var>P</var><sub>${gapIndex}</sub><var>P</var><sub>${gapIndex + 1}</sub>`;
    }
    function recordedSeriesMarkup() {
      const series = (keys) => keys.map((key) => {
        const item = state.measurements[key];
        return item?.status === "recorded" ? `${formatPhotoCm(state.frequencyHz, item.readingM)} cm` : "未量得";
      });
      const totals = series(Scoring.TOTAL_KEYS); const gaps = series(Scoring.GAP_KEYS);
      const totalItems = totals.map((value, index) => `<li data-series-key="${Scoring.TOTAL_KEYS[index]}"><var>P</var><sub>0</sub>→<var>P</var><sub>${index + 1}</sub>：${value}</li>`).join("");
      const gapItems = gaps.map((value, index) => `<li data-series-key="${Scoring.GAP_KEYS[index]}"><var>P</var><sub>${index}</sub><var>P</var><sub>${index + 1}</sub>：${value}</li>`).join("");
      return `<section class="recorded-series" aria-label="已記錄的相片量度系列"><h3>已記錄量度（資料展示，不計比例答案分）</h3>
        <h4>總位移</h4><ul>${totalItems}</ul><p><strong>總位移系列：</strong>${totals.join(":")}</p>
        <h4>相鄰間隔</h4><ul>${gapItems}</ul><p><strong>相鄰間隔系列：</strong>${gaps.join(":")}</p>
        <p>比較兩組數值怎樣隨序號變化，再完成你的時間比例與物理規律答案。</p></section>`;
    }
    function formatPoints(value) { return Number.isInteger(value) ? String(value) : value.toFixed(2); }
    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
    }
  }

  return {
    ACTIVITY, formatPhotoCm, photoCmToMeters, resolveManualReading, mathQuantity,
    startupView, submissionView, canonicalReviewMatches, resolveImmutableReview, resultFeedbackItems, unansweredCount, answerLabel, boot
  };
});
