(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./model.js") : root.MotionCompositionModel, node ? require("./scoring.js") : root.MotionCompositionScoring, node ? require("./persistence.js") : root.MotionCompositionPersistence);
  if (node) module.exports = api;
  if (root) root.MotionCompositionRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, S, P) {
  "use strict";
  class Controller {
    constructor(scorm, flow, onChange = () => {}) {
      this.scorm = scorm; this.flow = flow; this.onChange = onChange;
      this.state = null; this.mode = "technical"; this.result = null; this.trusted = false; this.notice = ""; this.unsaved = false;
      this.reviewCase = 0; this.reviewTime = 1; this.finalSnapshot = null;
    }
    get editable() { return ["edit", "check"].includes(this.mode); }
    get caseIndex() { return this.editable ? this.state.activeCase : this.reviewCase; }
    get timeIndex() { return this.editable ? this.state.activeTime : this.reviewTime; }
    emit() { this.scorm.setDraftProvider(this.editable ? () => this.draftSnapshot() : null); this.onChange(this); }
    draftSnapshot() { return this.scorm.makeSnapshot(P.ACTIVITY, "draft", P.draft(this.state)); }
    save() {
      try { this.unsaved = !this.scorm.saveDraft(this.draftSnapshot()); } catch (_) { this.unsaved = true; }
      this.notice = this.unsaved ? "最新修改尚未保存。請重試保存後再提交。" : "";
      return !this.unsaved;
    }
    technical(message) { this.mode = "technical"; this.trusted = false; this.result = null; this.notice = message; this.emit(); }
    start() {
      try {
        const attempt = this.scorm.loadAttempt(P.ACTIVITY); this.attempt = attempt;
        const outcome = this.flow.startup(attempt);
        if (outcome === "editable") {
          this.state = attempt.state === "draft" ? P.decode(attempt.snapshot, "draft") : P.fresh();
          this.mode = this.state.phase;
          if (attempt.state === "new") this.save();
        } else if (outcome === "review") this.restoreReview(attempt);
        else if (outcome === "frozen") this.restorePending(attempt.snapshot);
        else this.technical("未能安全讀取作答，請檢查連線後重新開啟活動。");
      } catch (_) { this.technical("作答資料未能通過驗證；原有記錄保持不變。"); }
      this.emit();
    }
    restoreReview(attempt) {
      this.mode = "mismatch"; this.result = { ...this.flow.recordedResult(attempt), maxScore: 100 };
      this.notice = "已完成記錄未能核對；只顯示可確認的Moodle成績。";
      try {
        const answer = P.decode(attempt.snapshot, "review"), computed = S.score(answer), checked = this.flow.reviewResult(computed, attempt.snapshot, attempt);
        if (!checked.trusted) return;
        this.state = answer; this.reviewCase = answer.activeCase; this.reviewTime = answer.activeTime;
        this.mode = "review"; this.result = computed; this.trusted = true; this.notice = "";
      } catch (_) { /* A recorded attempt never becomes editable. */ }
    }
    validateFinal(snapshot, payload = null) {
      const answer = P.decode(snapshot, "review"), result = S.score(answer);
      if (snapshot.score !== result.score || snapshot.passed !== result.passed) throw new Error("Review result mismatch");
      if (payload && (payload.score !== result.score || payload.maxScore !== 100 || payload.passed !== result.passed)) throw new Error("Pending result mismatch");
      if (this.finalSnapshot && JSON.stringify(P.review(P.decode(this.finalSnapshot, "review"))) !== JSON.stringify(P.review(answer))) throw new Error("Authoritative answers changed");
      return { answer, result };
    }
    restorePending(snapshot) {
      try {
        if (!snapshot || snapshot.version !== 1 || snapshot.activity !== P.ACTIVITY || snapshot.kind !== "pending-final" || P.bytes(snapshot) > 4000 || typeof snapshot.payload?.reviewJson !== "string") throw new Error("Invalid pending envelope");
        const inner = JSON.parse(snapshot.payload.reviewJson), value = this.validateFinal(inner, snapshot.payload);
        this.finalSnapshot = M.clone(inner); this.state = value.answer; this.reviewCase = this.state.activeCase; this.reviewTime = this.state.activeTime;
        this.mode = "frozen"; this.result = null; this.trusted = false; this.notice = "提交尚未確認，答案已凍結。請重試同一份提交。";
      } catch (_) { this.scorm.quarantinePending(); this.technical("凍結的提交資料未能通過驗證，暫停重試以保留原有記錄。"); }
    }
    command(action) {
      if (this.mode !== "edit") return false;
      this.state = P.command(this.state, action); this.finalSnapshot = null; this.save(); this.emit(); return true;
    }
    navigate(index, time = 1) {
      if (!this.state || !Number.isInteger(index) || index < 0 || index > 3 || !Number.isInteger(time) || time < 1 || time > 4) return;
      if (this.editable) { this.state = P.navigate(this.state, index, time); this.mode = "edit"; this.save(); }
      else if (["review", "committed", "frozen"].includes(this.mode)) { this.reviewCase = index; this.reviewTime = time; }
      this.emit();
    }
    check() { if (this.editable) { this.state = P.check(this.state); this.mode = "check"; this.save(); this.emit(); } }
    retrySave() { if (this.editable) { this.save(); this.emit(); } }
    submit() {
      if (this.mode !== "check" || this.unsaved) return;
      try {
        const result = S.score(this.state);
        this.finalSnapshot = this.scorm.makeSnapshot(P.ACTIVITY, "review", P.review(this.state), result);
        const handle = outcome => this.handleOutcome(outcome);
        this.scorm.submitWithCallbacks(result, this.finalSnapshot, { onSuccess: handle, onFailure: handle });
      } catch (_) { this.technical("未能建立提交資料，成績尚未確認。"); }
    }
    handleOutcome(raw) {
      const outcome = raw.activityState ? raw : { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
      const confirmed = mode => {
        try {
          const value = this.validateFinal(outcome.review || this.finalSnapshot);
          if ((outcome.score != null && outcome.score !== value.result.score) || (outcome.status && outcome.status !== (value.result.passed ? "passed" : "failed"))) throw new Error("LMS result mismatch");
          this.state = value.answer; this.reviewCase = this.state.activeCase; this.reviewTime = this.state.activeTime;
          this.mode = mode; this.result = value.result; this.trusted = true; this.unsaved = false;
          this.notice = mode === "committed" ? "成績已記錄，完成程序待重試。" : "";
        } catch (_) { this.technical("提交結果未能安全核對，作答保持鎖定。"); }
      };
      this.flow.submission(outcome, {
        success: () => confirmed("review"), committed: () => confirmed("committed"),
        frozen: () => { this.reviewCase = this.state.activeCase; this.reviewTime = this.state.activeTime; this.mode = "frozen"; this.trusted = false; this.result = null; this.notice = "提交尚未確認，答案已凍結。請重試同一份提交。"; },
        retry: failure => { if (failure.retryable) { this.mode = "check"; this.state = P.check(this.state); this.finalSnapshot = null; this.notice = "尚未提交成功，可返回修改或重試提交。"; } else this.technical("未能安全建立提交，需要技術檢查。"); }
      });
      this.emit();
    }
    retryFinal() {
      if (!["frozen", "committed"].includes(this.mode)) return;
      try { this.validateFinal(this.finalSnapshot); this.handleOutcome(this.mode === "committed" ? this.scorm.retryFinish() : this.scorm.retryPending()); }
      catch (_) { this.scorm.quarantinePending(); this.technical("提交資料未能核對，已停止重試。"); }
    }
  }
  return Object.freeze({ Controller });
});
