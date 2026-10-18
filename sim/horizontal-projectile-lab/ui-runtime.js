(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.ProjectileModel,node?require('./scoring.js'):root.ProjectileScoring,node?require('./persistence.js'):root.ProjectilePersistence);
  if(node)module.exports=api;if(root)root.ProjectileRuntime=api;
})(typeof window==='undefined'?globalThis:window,function(M,S,P){
  'use strict';
  class Controller{
    constructor(scorm,flow,render=()=>{}){this.scorm=scorm;this.flow=flow;this.render=render;this.state=null;this.mode='technical';this.notice='';this.result=null;this.trusted=false;this.unsaved=false;this.finalSnapshot=null;this.reviewView='collect';}
    get editable(){return this.mode==='edit'||this.mode==='check';}
    get view(){return this.editable?this.state.view:this.reviewView;}
    emit(){this.scorm.setDraftProvider(this.editable?()=>this.draftSnapshot():null);this.render(this);}
    draftSnapshot(){return this.scorm.makeSnapshot(P.ACTIVITY,'draft',P.draft(this.state));}
    save(){if(!this.editable)return false;try{this.unsaved=!this.scorm.saveDraft(this.draftSnapshot());}catch(_){this.unsaved=true;}this.notice=this.unsaved?'最新修改尚未確認保存。請重試保存；本頁保留你的答案。':'';return !this.unsaved;}
    technical(message){this.mode='technical';this.result=null;this.trusted=false;this.notice=message;this.emit();}
    start(){
      try{
        const attempt=this.scorm.loadAttempt(P.ACTIVITY), startup=this.flow.startup(attempt);
        if(startup==='editable'){this.state=attempt.state==='draft'?P.decode(attempt.snapshot,'draft'):M.fresh(M.drawLaunchOffset());this.mode=this.state.phase;if(attempt.state==='new')this.save();}
        else if(startup==='review'){
          this.mode='mismatch';this.result={...this.flow.recordedResult(attempt),maxScore:100};this.notice='已完成紀錄未能核對，保持只讀，僅顯示可信的已記錄摘要。';
          try{const s=P.decode(attempt.snapshot,'review'),result=S.score(s);if(this.flow.reviewResult(result,attempt.snapshot,attempt).trusted){this.state=s;this.result=result;this.trusted=true;this.mode='review';this.notice='';}}catch(_){}
        }else if(startup==='frozen'){
          try{
            const snap=attempt.snapshot;
            if(snap?.version!==1||snap.activity!==P.ACTIVITY||snap.kind!=='pending-final'||P.bytes(snap)>P.MAX_BYTES||typeof snap.payload?.reviewJson!=='string')throw new Error('Invalid pending');
            const inner=JSON.parse(snap.payload.reviewJson),verified=this.validateFinal(inner,snap.payload);
            this.finalSnapshot=M.clone(inner);this.state=verified.answer;this.mode='frozen';this.notice='提交尚未確認，答案已凍結。請重試同一份提交。';
          }catch(_){this.scorm.quarantinePending();this.technical('凍結的提交資料未能驗證，已停止重試。請聯絡教師檢查紀錄。');return;}
        }else{this.technical('未能安全載入本次作答，請檢查連線並重新開啟活動。');return;}
      }catch(error){this.technical(error.message==='Legacy draft requires original activity'?'這份未完成紀錄屬於舊版活動，請使用原版繼續，或由教師開新一次作答。原紀錄保持不變，本頁不會覆寫。':'未能還原作答資料；原紀錄保持不變，本頁不會覆寫。');return;}
      this.emit();
    }
    validateFinal(snapshot,payload=null){
      const answer=P.decode(snapshot,'review'),result=S.score(answer);
      if(snapshot.score!==result.score||snapshot.passed!==result.passed)throw new Error('Review mismatch');
      if(payload&&(payload.score!==result.score||payload.maxScore!==100||payload.passed!==result.passed))throw new Error('Pending mismatch');
      if(this.finalSnapshot&&JSON.stringify(P.review(P.decode(this.finalSnapshot,'review')))!==JSON.stringify(answer))throw new Error('Frozen answer changed');
      return{answer,result};
    }
    command(action){
      if(this.mode!=='edit')return false;
      try{const next=P.draft(M.change(this.state,action));if(JSON.stringify(next)===JSON.stringify(this.state))return false;this.state=next;this.save();this.emit();return true;}
      catch(_){this.notice='這個操作未能安全記錄，請檢查數值及所需資料。';this.emit();return false;}
    }
    navigate(view){
      if(!M.VIEWS.includes(view)||!this.state)return;
      if(this.editable){this.state=P.navigate(this.state,view);this.mode='edit';this.save();}
      else if(['review','committed','frozen'].includes(this.mode))this.reviewView=view;
      this.emit();
    }
    check(){if(!this.editable)return;this.state=P.navigate(this.state,this.view,true);this.mode='check';this.save();this.emit();}
    clear(){if(!this.editable)return;this.state=M.fresh(M.drawLaunchOffset());this.mode='edit';this.save();this.emit();}
    retrySave(){this.save();this.emit();}
    submit(){
      if(this.mode!=='check'||this.unsaved)return;
      try{
        this.beforeSubmission=P.draft(this.state);const result=S.score(this.state);
        this.finalSnapshot=this.scorm.makeSnapshot(P.ACTIVITY,'review',P.review(this.state),result);
        this.mode='submitting';this.emit();const handle=o=>this.handleOutcome(o);
        this.scorm.submitWithCallbacks(result,this.finalSnapshot,{onSuccess:handle,onFailure:handle});
      }catch(_){this.technical('未能安全建立提交資料；成績未確認，本次保持鎖定。');}
    }
    handleOutcome(raw){
      const o=raw.activityState?raw:{...raw,activityState:raw.ok?'success':raw.committed?'committed':raw.frozen?'frozen':'retry'};
      const confirmed=mode=>{
        try{const v=this.validateFinal(o.review||this.finalSnapshot);if((o.score!=null&&o.score!==v.result.score)||(o.status&&o.status!==(v.result.passed?'passed':'failed')))throw new Error('LMS mismatch');this.state=v.answer;this.result=v.result;this.trusted=true;this.mode=mode;this.unsaved=false;this.notice=mode==='committed'?'結果已記錄，結束連線尚未完成。請重試完成程序。':'';}
        catch(_){this.technical('提交結果未能核對，本次保持鎖定，請聯絡教師。');}
      };
      this.flow.submission(o,{success:()=>confirmed('review'),committed:()=>confirmed('committed'),frozen:()=>{this.mode='frozen';this.result=null;this.trusted=false;this.notice='提交尚未確認，答案已凍結。請重試同一份提交。';},retry:f=>{if(f.retryable){this.state=this.beforeSubmission;this.mode='check';this.finalSnapshot=null;this.notice='提交未完成，可返回修改或重試提交。';}else this.technical('提交資料未能安全建立，需要技術檢查。');}});
      this.emit();
    }
    retryFinal(){if(!['frozen','committed'].includes(this.mode))return;try{this.validateFinal(this.finalSnapshot);this.handleOutcome(this.mode==='committed'?this.scorm.retryFinish():this.scorm.retryPending());}catch(_){this.scorm.quarantinePending();this.technical('提交資料未能安全核對，已停止重試。');}}
  }
  return Object.freeze({Controller});
});
