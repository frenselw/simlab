(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./generator.js") : root.EquilibriumGenerator,
    typeof module === "object" && module.exports ? require("./model.js") : root.EquilibriumModel,
    typeof module === "object" && module.exports ? require("./scoring.js") : root.EquilibriumScoring,
    typeof module === "object" && module.exports ? require("./persistence.js") : root.EquilibriumPersistence);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquilibriumRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function (G, M, S, P) {
  "use strict";
  class Controller {
    constructor(scorm, flow, onChange = () => {}, seedFactory = G.newSeed) {
      this.scorm = scorm; this.flow = flow; this.onChange = onChange; this.seedFactory = seedFactory;
      this.state = null; this.scenario = null; this.mode = "technical"; this.notice = ""; this.storageNotice = "";
      this.result = null; this.trusted = false; this.unsaved = false; this.reviewIndex = 0;
      this.finalSnapshot = null; this.history = new M.History(); this.canRecover = false;
    }
    get editable() { return this.mode === "edit" || this.mode === "check"; }
    get position() { return this.editable ? this.state.current : this.reviewIndex; }
    get familyIndex() { return this.scenario?.order[this.position ?? 0] ?? 0; }
    emit() {
      this.scorm.setDraftProvider(this.editable ? () => this.draftSnapshot() : null);
      this.onChange(this);
    }
    draftSnapshot() { return this.scorm.makeSnapshot(P.ACTIVITY, "draft", P.draft(this.state)); }
    save() {
      if (!this.editable) return false;
      try { this.unsaved = !this.scorm.saveDraft(this.draftSnapshot()); } catch (_) { this.unsaved = true; }
      this.notice = this.unsaved ? "最新修改尚未保存。可以繼續編輯，請重試保存後再提交。" : "";
      return !this.unsaved;
    }
    start() {
      try {
        const storage = this.scorm.enableStandalonePersistence(P.ACTIVITY);
        const attempt = this.scorm.loadAttempt(P.ACTIVITY); this.attempt = attempt;
        if (this.scorm.isStandalone?.() && storage !== "available") this.storageNotice = "本機儲存未完全可用；重新載入未必能恢復最新作答。";
        const startup = this.flow.startup(attempt);
        if (startup === "editable") {
          try {
            this.state = attempt.state === "draft" ? P.decode(attempt.snapshot, "draft") : P.fresh(this.seedFactory());
            this.scenario = G.generate(this.state.seed, this.state.generatorVersion); this.mode = this.state.phase;
            if (attempt.state === "new") this.save();
          } catch (_) { this.technical("未能還原作答資料；目前資料保持不變。", attempt.state === "draft"); return; }
        } else if (startup === "review") this.restoreReview(attempt);
        else if (startup === "frozen") this.restorePending(attempt.snapshot);
        else this.technical("目前未能安全讀取作答資料。請檢查連線，再重新開啟活動。");
      } catch (_) { this.technical("活動未能讀取目前的作答狀態。請重新開啟活動。"); return; }
      this.emit();
    }
    restoreReview(attempt) {
      this.mode = "mismatch"; this.result = { ...this.flow.recordedResult(attempt), maxScore: 100 };
      this.notice = "已完成的作答資料未能安全核對；本次保持只讀，以下僅顯示已記錄的成績。";
      try {
        const answer = P.decode(attempt.snapshot, "review"), computed = S.score(answer);
        const checked = this.flow.reviewResult(computed, attempt.snapshot, attempt);
        if (!checked.trusted) return;
        this.state = answer; this.scenario = G.generate(answer.seed, answer.generatorVersion);
        this.result = computed; this.trusted = true; this.mode = "review"; this.notice = "";
      } catch (_) { /* Finished evidence stays locked even when its geometry is invalid. */ }
    }
    validateFinal(snapshot, payload = null) {
      const answer = P.decode(snapshot, "review"), result = S.score(answer);
      if (snapshot.score !== result.score || snapshot.passed !== result.passed) throw new Error("Review score mismatch");
      if (payload && (payload.score !== result.score || payload.maxScore !== 100 || payload.passed !== result.passed)) throw new Error("Pending score mismatch");
      if (this.finalSnapshot && JSON.stringify(P.review(P.decode(this.finalSnapshot, "review"))) !== JSON.stringify(P.review(answer))) throw new Error("Final answers changed");
      return { answer, result };
    }
    restorePending(snapshot) {
      try {
        if (snapshot?.version !== 1 || snapshot.activity !== P.ACTIVITY || snapshot.kind !== "pending-final" || P.bytes(snapshot) > P.MAX_BYTES || typeof snapshot.payload?.reviewJson !== "string") throw new Error("Invalid pending envelope");
        const inner = JSON.parse(snapshot.payload.reviewJson), validated = this.validateFinal(inner, snapshot.payload);
        this.finalSnapshot = M.clone(inner); this.state = validated.answer; this.scenario = G.generate(this.state.seed, this.state.generatorVersion);
        this.mode = "frozen"; this.result = null; this.trusted = false;
        this.notice = "提交尚未確認。答案已凍結，請重試同一份提交。";
      } catch (_) {
        this.scorm.quarantinePending(); this.technical("已凍結的提交資料未能通過驗證；需要技術檢查，暫時不能重試。");
      }
    }
    technical(message, canRecover = false) {
      this.mode = "technical"; this.result = null; this.trusted = false; this.notice = message; this.canRecover = canRecover; this.emit();
    }
    setAnswer(answer) {
      if (!this.editable || this.state.phase !== "edit" || !M.validAnswer(answer)) return false;
      const i = this.familyIndex;
      if (JSON.stringify(answer) === JSON.stringify(this.state.answers[i])) return false;
      this.history.record(i, this.state.answers[i]); this.state.answers[i] = M.clone(answer); this.finalSnapshot = null;
      this.save(); this.emit(); return true;
    }
    command(action) {
      if (!this.editable || this.state.phase !== "edit") return false;
      return this.setAnswer(M.change(this.state.answers[this.familyIndex], action));
    }
    undo(redo = false) {
      if (!this.editable || this.state.phase !== "edit") return;
      const i = this.familyIndex; this.state.answers[i] = this.history.apply(i, this.state.answers[i], redo); this.save(); this.emit();
    }
    navigate(position) {
      if (!Number.isInteger(position) || position < 0 || position > 4 || !this.state) return;
      if (this.editable) { this.state = P.navigate(this.state, position, this.mode === "check"); this.mode = "edit"; this.save(); }
      else if (["review", "committed", "frozen"].includes(this.mode)) this.reviewIndex = position;
      this.emit();
    }
    check() { if (this.editable) { this.state = P.check(this.state); this.mode = "check"; this.save(); this.emit(); } }
    retrySave() { this.save(); this.emit(); }
    submit() {
      if (this.mode !== "check" || this.unsaved) return;
      try {
        const result = S.score(this.state);
        this.finalSnapshot = this.scorm.makeSnapshot(P.ACTIVITY, "review", P.review(this.state), result);
        const handle = outcome => this.handleOutcome(outcome);
        this.scorm.submitWithCallbacks(result, this.finalSnapshot, { onSuccess: handle, onFailure: handle });
      } catch (_) { this.technical("未能建立提交資料；本頁不會宣稱成績已確認。"); }
    }
    handleOutcome(raw) {
      const outcome = raw.activityState ? raw : { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
      const confirmed = mode => {
        try {
          const validated = this.validateFinal(outcome.review || this.finalSnapshot);
          if ((outcome.score != null && outcome.score !== validated.result.score) || (outcome.status && outcome.status !== (validated.result.passed ? "passed" : "failed"))) throw new Error("LMS result mismatch");
          this.state = validated.answer; this.scenario = G.generate(this.state.seed, this.state.generatorVersion);
          this.mode = mode; this.result = validated.result; this.trusted = true; this.unsaved = false;
          this.notice = mode === "committed" ? "成績已記錄，結束連線尚未完成。請重試完成連線。" : "";
        } catch (_) { this.technical("已處理的提交結果未能安全核對；作答保持鎖定。"); }
      };
      this.flow.submission(outcome, {
        success: () => confirmed("review"), committed: () => confirmed("committed"),
        frozen: () => { this.mode = "frozen"; this.trusted = false; this.result = null; this.notice = "提交尚未確認。答案已凍結，請重試同一份提交。"; },
        retry: failure => {
          if (failure.retryable) {
            this.state = P.check({ ...P.review(this.state), phase: "check", current: null, returnToCheck: false });
            this.mode = "check"; this.finalSnapshot = null; this.notice = "提交未完成；你可修改答案或重試提交。";
          } else this.technical("未能安全建立提交資料，需要技術檢查。");
        }
      });
      this.emit();
    }
    retryFinal() {
      try {
        if (this.mode !== "frozen" && this.mode !== "committed") return;
        this.validateFinal(this.finalSnapshot);
        this.handleOutcome(this.mode === "committed" ? this.scorm.retryFinish() : this.scorm.retryPending());
      } catch (_) { this.scorm.quarantinePending(); this.technical("提交資料未能安全核對，已停止重試。"); }
    }
    recoverDraft() {
      if (!this.canRecover || this.attempt?.state !== "draft") return false;
      if (this.scorm.isStandalone?.()) {
        if (this.scorm.clearStandaloneAttempt(P.ACTIVITY)) return "reload";
        this.technical("未能清除未提交的草稿，原資料保持鎖定。", true); return false;
      }
      this.state = P.fresh(this.seedFactory()); this.scenario = G.generate(this.state.seed); this.mode = "edit"; this.canRecover = false;
      if (!this.save()) this.technical("未能保存恢復的草稿，請檢查連線。"); else this.emit();
      return this.editable;
    }
  }
  return Object.freeze({ Controller });
});
