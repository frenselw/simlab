(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.CentripetalModel,
    typeof module === "object" && module.exports ? require("./scoring.js") : root.CentripetalScoring,
    typeof module === "object" && module.exports ? require("./persistence.js") : root.CentripetalPersistence);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentripetalRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, S, P) {
  "use strict";
  class Controller {
    constructor(scorm, flow, render = () => {}) {
      this.scorm = scorm; this.flow = flow; this.render = render;
      this.state = null; this.mode = "technical"; this.notice = ""; this.result = null;
      this.unsaved = false; this.final = null; this.before = null; this.reviewPage = 0; this.reviewView = "analyse";
    }
    get editable() { return this.mode === "editable"; }
    emit(render = true) { this.scorm.setDraftProvider(this.editable ? () => this.draftSnapshot() : null); if (render) this.render(this); }
    draftSnapshot() { return this.scorm.makeSnapshot(P.ACTIVITY, "draft", P.encode(P.validate(this.state))); }
    save() {
      try { this.unsaved = !this.scorm.saveDraft(this.draftSnapshot()); }
      catch (_) { this.unsaved = true; }
      this.notice = this.unsaved ? "最新作答尚未保存。請重試保存後再提交。" : "";
      return !this.unsaved;
    }
    technical(message) { this.mode = "technical"; this.result = null; this.notice = message; this.emit(); }
    start() {
      let attempt;
      try { attempt = this.scorm.loadAttempt(P.ACTIVITY); }
      catch (_) { this.technical("未能讀取作答狀態；請重新開啟活動。"); return; }
      this.attempt = attempt;
      const mode = this.flow.startup(attempt);
      if (mode === "editable") {
        try { this.state = attempt.state === "draft" ? P.decode(attempt.snapshot, "draft") : M.fresh(); this.mode = "editable";
          const revisedQuestions = this.state.rv < 6, legacy = revisedQuestions || this.state.mv < 5;
          M.upgradeDraft(this.state);
          if (attempt.state === "new" || legacy) this.save();
          if (revisedQuestions && !this.unsaved) this.notice = "分析題已修訂；已保留原有數據和答案，請核對後再提交。"; }
        catch (_) { this.technical("草稿未能安全還原；原有數據保持不變。"); return; }
      } else if (mode === "review") this.restoreReview(attempt);
      else if (mode === "frozen") this.restorePending(attempt.snapshot);
      else { this.technical("未能安全讀取作答狀態；請檢查連線。"); return; }
      this.emit();
    }
    restoreReview(attempt) {
      this.mode = "mismatch"; this.result = { ...this.flow.recordedResult(attempt), maxScore: 100 };
      this.notice = "已完成紀錄未能核對；只顯示 Moodle 已記錄的成績。";
      try {
        const answer = P.decode(attempt.snapshot, "review"), result = S.score(answer);
        const checked = this.flow.reviewResult(result, attempt.snapshot, attempt);
        if (!checked.trusted) return;
        this.state = answer; this.result = checked.result; this.mode = "review"; this.notice = "";
      } catch (_) { /* Finished work stays locked. */ }
    }
    validateFinal(snapshot, payload) {
      const answer = P.decode(snapshot, "review"), result = S.score(answer);
      if (snapshot.score !== result.score || snapshot.passed !== result.passed ||
        payload && (payload.score !== result.score || payload.maxScore !== 100 || payload.passed !== result.passed) ||
        this.final && JSON.stringify(P.decode(this.final, "review")) !== JSON.stringify(answer)) throw new Error("Final answer mismatch");
      return { answer, result };
    }
    restorePending(snapshot) {
      try {
        if (snapshot?.version !== 1 || snapshot.activity !== P.ACTIVITY || snapshot.kind !== "pending-final" ||
          P.bytes(snapshot) > P.MAX_BYTES || typeof snapshot.payload?.reviewJson !== "string") throw new Error("Invalid pending");
        const inner = JSON.parse(snapshot.payload.reviewJson), checked = this.validateFinal(inner, snapshot.payload);
        this.final = inner; this.state = checked.answer; this.mode = "frozen"; this.result = null;
        this.notice = "提交尚未確認；答案已凍結，可重試同一份提交。";
      } catch (_) { this.scorm.quarantinePending(); this.technical("凍結數據未能通過驗證；已停止重試，需要技術檢查。"); }
    }
    update(change, render = true) {
      if (!this.editable || this.state.view === "check") return false;
      try {
        const next = M.upgradeDraft(M.clone(this.state)); change(next); M.upgradeDraft(next);
        P.validate(next);
        if (JSON.stringify(next) === JSON.stringify(this.state)) return false;
        this.state = next; this.save(); this.emit(render); return true;
      } catch (_) { return false; }
    }
    navigate(page, view = "setup") {
      if (!Number.isInteger(page) || page < 0 || page > 2 || !["setup", "collect", "analyse"].includes(view)) return false;
      if (!this.editable) {
        if (["review", "committed", "frozen"].includes(this.mode)) { this.reviewPage = page; this.reviewView = view; this.emit(); return true; }
        return false;
      }
      const next = M.clone(this.state);
      if (["collect", "analyse"].includes(view) && next.tasks[page].current === null) return false;
      next.page = page; next.view = view; next.returnTo = null;
      if (this.state.view === "check") next.fromReview = true;
      try { P.validate(next); } catch (_) { return false; }
      this.state = next; this.save(); this.emit(); return true;
    }
    check() {
      if (!this.editable) return false;
      if (this.state.view !== "check") {
        const next = M.clone(this.state); next.returnTo = [next.page, next.view]; next.view = "check";
        this.state = P.validate(next); this.save(); this.emit();
      }
      return true;
    }
    back() {
      if (!this.editable || this.state.view !== "check") return false;
      const [page, view] = this.state.returnTo;
      return this.navigate(page, view);
    }
    retrySave() { if (this.editable) { this.save(); this.emit(); } }
    submit() {
      if (!this.editable || this.state.view !== "check" || this.unsaved) return false;
      try {
        this.before = P.validate(this.state);
        const answer = P.review(this.before), result = S.score(answer);
        this.final = this.scorm.makeSnapshot(P.ACTIVITY, "review", P.encode(answer), result);
        this.mode = "submitting"; this.emit();
        const handle = outcome => this.handleOutcome(outcome);
        this.scorm.submitWithCallbacks(result, this.final, { onSuccess: handle, onFailure: handle });
        return true;
      } catch (_) { this.technical("未能建立提交數據；成績尚未確認。"); return false; }
    }
    handleOutcome(outcome) {
      const raw = outcome?.activityState ? outcome : { ...outcome, activityState: outcome?.ok ? "success" : outcome?.committed ? "committed" : outcome?.frozen ? "frozen" : "retry" };
      const confirmed = mode => {
        try {
          const checked = this.validateFinal(raw.review || this.final);
          if (raw.score != null && raw.score !== checked.result.score ||
            raw.status && raw.status !== (checked.result.passed ? "passed" : "failed")) throw new Error("Moodle mismatch");
          this.state = checked.answer; this.result = checked.result; this.mode = mode; this.unsaved = false;
          this.notice = mode === "committed" ? "成績已記錄，活動結束程序尚未完成；請重試完成程序。" : "";
        } catch (_) { this.technical("提交結果未能安全核對；作答保持鎖定。"); }
      };
      this.flow.submission(raw, {
        success: () => confirmed("review"), committed: () => confirmed("committed"),
        frozen: () => { this.mode = "frozen"; this.result = null; this.notice = "提交尚未確認；答案已凍結，可重試同一份提交。"; },
        retry: failure => {
          if (failure.retryable) { this.state = this.before; this.mode = "editable"; this.final = null;
            this.notice = "提交未完成；可返回修改或重試。"; }
          else this.technical("未能安全建立提交數據；需要技術檢查。");
        }
      });
      this.emit();
    }
    retryFinal() {
      if (!["frozen", "committed"].includes(this.mode)) return;
      try { this.validateFinal(this.final); this.handleOutcome(this.mode === "committed" ? this.scorm.retryFinish() : this.scorm.retryPending()); }
      catch (_) { this.scorm.quarantinePending(); this.technical("凍結數據未能核對；已停止重試。"); }
    }
  }
  return Object.freeze({ Controller });
});
