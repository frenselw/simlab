(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.NewtonModel,
    typeof module === "object" && module.exports ? require("./scoring.js") : root.NewtonScoring,
    typeof module === "object" && module.exports ? require("./persistence.js") : root.NewtonPersistence);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, S, P) {
  "use strict";
  class Controller {
    constructor(scorm, flow, onChange = () => {}) {
      this.scorm = scorm; this.flow = flow; this.onChange = onChange; this.state = null; this.mode = "technical";
      this.notice = ""; this.result = null; this.trusted = false; this.unsaved = false; this.canRecover = false;
      this.finalSnapshot = null; this.beforeSubmission = null; this.reviewView = { phase: "plot", index: 0 };
    }
    get editable() { return ["collect", "plot", "conclude", "check"].includes(this.mode); }
    get view() { return this.editable ? { phase: this.state.phase, index: this.state.group ?? this.state.graph } : this.reviewView; }
    emit() { this.scorm.setDraftProvider(this.editable ? () => this.draftSnapshot() : null); this.onChange(this); }
    draftSnapshot() { return this.scorm.makeSnapshot(P.ACTIVITY, "draft", P.draft(this.state)); }
    save() {
      if (!this.editable) return false;
      try { this.unsaved = !this.scorm.saveDraft(this.draftSnapshot()); } catch (_) { this.unsaved = true; }
      this.notice = this.unsaved ? "最新修改尚未保存。可繼續編輯，請重試保存後再提交。" : "";
      return !this.unsaved;
    }
    start() {
      try {
        const attempt = this.scorm.loadAttempt(P.ACTIVITY); this.attempt = attempt;
        const startup = this.flow.startup(attempt);
        if (startup === "editable") {
          try {
            const restored = attempt.state === "draft" ? P.decode(attempt.snapshot, "draft") : P.fresh();
            this.state = P.upgradeDraft(restored); this.mode = this.state.phase;
            if (attempt.state === "new" || restored.schemaVersion !== this.state.schemaVersion) this.save();
          }
          catch (_) { this.technical("未能還原作答資料；原有資料保持不變。", attempt.state === "draft"); return; }
        } else if (startup === "review") this.restoreReview(attempt);
        else if (startup === "frozen") this.restorePending(attempt.snapshot);
        else { this.technical("目前未能安全讀取作答資料。請檢查連線，再重新開啟活動。"); return; }
      } catch (_) { this.technical("活動未能讀取目前的作答狀態。請重新開啟活動。"); return; }
      this.emit();
    }
    restoreReview(attempt) {
      this.mode = "mismatch"; this.result = { ...this.flow.recordedResult(attempt), maxScore: 100 };
      this.notice = "已完成的資料未能安全核對。本次保持只讀，僅顯示已記錄的成績。";
      try {
        const answer = P.decode(attempt.snapshot, "review"), computed = S.score(answer);
        if (!this.flow.reviewResult(computed, attempt.snapshot, attempt).trusted) return;
        this.state = answer; this.result = computed; this.trusted = true; this.mode = "review"; this.notice = "";
      } catch (_) { /* A finished attempt must never reopen when its answer cannot be verified. */ }
    }
    validateFinal(snapshot, payload = null) {
      const answer = P.decode(snapshot, "review"), result = S.score(answer);
      if (snapshot.score !== result.score || snapshot.passed !== result.passed) throw new Error("Review result mismatch");
      if (payload && (payload.score !== result.score || payload.maxScore !== 100 || payload.passed !== result.passed)) throw new Error("Pending result mismatch");
      if (this.finalSnapshot && JSON.stringify(P.review(P.decode(this.finalSnapshot, "review"))) !== JSON.stringify(answer)) throw new Error("Frozen answers changed");
      return { answer, result };
    }
    restorePending(snapshot) {
      try {
        if (snapshot?.version !== 1 || snapshot.activity !== P.ACTIVITY || snapshot.kind !== "pending-final" || P.bytes(snapshot) > P.MAX_BYTES || typeof snapshot.payload?.reviewJson !== "string") throw new Error("Invalid pending envelope");
        const inner = JSON.parse(snapshot.payload.reviewJson), validated = this.validateFinal(inner, snapshot.payload);
        this.finalSnapshot = M.clone(inner); this.state = validated.answer; this.mode = "frozen"; this.result = null; this.trusted = false;
        this.notice = "提交尚未確認。答案已凍結，請重試同一份提交。";
      } catch (_) { this.scorm.quarantinePending(); this.technical("已凍結的提交資料未能通過驗證；暫時不能重試，需要技術檢查。"); }
    }
    technical(message, canRecover = false) { this.mode = "technical"; this.result = null; this.trusted = false; this.notice = message; this.canRecover = canRecover; this.emit(); }
    command(action) {
      if (!this.editable || this.mode === "check") return false;
      let next;
      try { next = P.draft(M.change(this.state, action)); } catch (_) { return false; }
      if (JSON.stringify(next) === JSON.stringify(this.state)) return false;
      this.state = next; this.mode = next.phase; this.finalSnapshot = null; this.save(); this.emit(); return true;
    }
    clearAllAnswers() {
      if (!this.editable) return false;
      this.state = P.fresh(this.state?.rubricVersion); this.mode = "collect"; this.finalSnapshot = null; this.save(); this.emit(); return true;
    }
    navigate(phase, index = null) {
      if (!this.state || !["collect", "plot", "conclude", "check"].includes(phase)) return;
      if ((phase === "collect" && !M.integer(index, 0, 1)) || (phase === "plot" && !M.integer(index, 0, 2))) return;
      if (this.editable) { this.state = P.navigate(this.state, phase, index); this.mode = phase; this.save(); }
      else if (["review", "committed", "frozen"].includes(this.mode)) this.reviewView = { phase: phase === "check" ? "conclude" : phase, index };
      this.emit();
    }
    check() { this.navigate("check"); }
    retrySave() { this.save(); this.emit(); }
    submit() {
      if (this.mode !== "check" || this.unsaved) return;
      try {
        const result = S.score(this.state); this.beforeSubmission = P.draft(this.state);
        this.finalSnapshot = this.scorm.makeSnapshot(P.ACTIVITY, "review", P.review(this.state), result);
        this.mode = "submitting"; this.emit();
        const handle = value => this.handleOutcome(value);
        this.scorm.submitWithCallbacks(result, this.finalSnapshot, { onSuccess: handle, onFailure: handle });
      } catch (_) { this.technical("未能建立提交資料；本頁不會宣稱成績已確認。"); }
    }
    handleOutcome(raw) {
      const outcome = raw.activityState ? raw : { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
      const confirmed = mode => {
        try {
          const verified = this.validateFinal(outcome.review || this.finalSnapshot);
          if ((outcome.score != null && outcome.score !== verified.result.score) || (outcome.status && outcome.status !== (verified.result.passed ? "passed" : "failed"))) throw new Error("LMS mismatch");
          this.state = verified.answer; this.result = verified.result; this.mode = mode; this.trusted = true; this.unsaved = false;
          this.notice = mode === "committed" ? "成績已記錄，但活動結束程序尚未完成。請重試完成程序。" : "";
        } catch (_) { this.technical("已處理的提交結果未能安全核對；作答保持鎖定。"); }
      };
      this.flow.submission(outcome, {
        success: () => confirmed("review"), committed: () => confirmed("committed"),
        frozen: () => { this.mode = "frozen"; this.result = null; this.trusted = false; this.notice = "提交尚未確認。答案已凍結，請重試同一份提交。"; },
        retry: failure => {
          if (failure.retryable) { this.state = this.beforeSubmission || P.navigate(P.editableFromReview(this.state), "check"); this.mode = "check"; this.finalSnapshot = null; this.notice = "提交未完成；你可修改答案或重試提交。"; }
          else this.technical("未能安全建立提交資料，需要技術檢查。");
        }
      });
      this.emit();
    }
    retryFinal() {
      if (!["frozen", "committed"].includes(this.mode)) return;
      try { this.validateFinal(this.finalSnapshot); this.handleOutcome(this.mode === "committed" ? this.scorm.retryFinish() : this.scorm.retryPending()); }
      catch (_) { this.scorm.quarantinePending(); this.technical("提交資料未能安全核對，已停止重試。"); }
    }
    recoverDraft() {
      if (!this.canRecover || this.attempt?.state !== "draft") return false;
      this.state = P.fresh(); this.mode = "collect"; this.canRecover = false;
      if (!this.save()) this.technical("未能保存恢復的草稿，請檢查連線。"); else this.emit();
      return this.editable;
    }
  }
  return Object.freeze({ Controller });
});
