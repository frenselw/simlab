(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./model.js'):root.RocketModel,node?require('./persistence.js'):root.RocketPersistence,node?require('./scoring.js'):root.RocketScoring);if(node)module.exports=api;root.RocketRuntime=api;})(typeof window==='undefined'?globalThis:window,function(P,M,D,S){
  'use strict';
  class Controller{
    constructor(scorm,flow,render=()=>{}){Object.assign(this,{scorm,flow,render,state:null,mode:'technical',notice:'',result:null,trusted:false,unsaved:false,finalSnapshot:null,frozenCanonical:null,running:false,canResetDraft:false});}
    get editable(){return ['edit','check'].includes(this.mode);}
    emit(){this.scorm.setDraftProvider(this.editable?()=>this.draftSnapshot():null);this.render(this);}
    draftSnapshot(){return this.scorm.makeSnapshot(P.ACTIVITY,'draft',D.draft(this.state));}
    save(){if(!this.editable)return false;try{this.unsaved=!this.scorm.saveDraft(this.draftSnapshot());}catch(_){this.unsaved=true;}this.notice=this.unsaved?'最新修改尚未確認保存，本頁仍保留進度。請重試保存。':'';return !this.unsaved;}
    technical(message){this.running=false;this.mode='technical';this.result=null;this.trusted=false;this.notice=message;this.emit();}
    start(){
      const attempt=this.scorm.loadAttempt(P.ACTIVITY),startup=this.flow.startup(attempt);
      if(startup==='editable'){
        try{this.state=attempt.state==='draft'?D.decode(attempt.snapshot,'draft'):M.fresh();this.mode=this.state.phase==='check'?'check':'edit';if(attempt.state==='new')this.save();}
        catch(_){this.canResetDraft=attempt.state==='draft';this.technical('未提交的草稿未能還原。可保留原紀錄聯絡教師，或明確重新載入空白草稿。');return;}
      }else if(startup==='review'){
        this.mode='mismatch';this.result={...this.flow.recordedResult(attempt),maxScore:100};this.notice='已記錄結果未能完整核對，保持唯讀，只顯示可信的 Moodle 摘要。';
        try{const s=D.decode(attempt.snapshot,'review'),result=S.score(s);if(this.flow.reviewResult(result,attempt.snapshot,attempt).trusted){this.state=s;this.result=result;this.mode='review';this.trusted=true;this.notice='';}}catch(_){}
      }else if(startup==='frozen'){
        try{const snap=attempt.snapshot;if(snap?.version!==1||snap.activity!==P.ACTIVITY||snap.kind!=='pending-final'||D.bytes(snap)>4000||typeof snap.payload?.reviewJson!=='string')throw Error('Invalid pending');const inner=JSON.parse(snap.payload.reviewJson),v=this.validateFinal(inner,snap.payload);this.finalSnapshot=P.clone(inner);this.frozenCanonical=JSON.stringify(v.answer);this.state=v.answer;this.mode='frozen';this.notice='提交結果尚未確認，答案已凍結。請重試同一份提交。';}
        catch(_){this.scorm.quarantinePending();this.technical('提交資料未能驗證，已停止重試。請聯絡教師檢查。');return;}
      }else{this.technical('暫時無法安全載入作答，請檢查連線並重新開啟活動。');return;}
      this.emit();
    }
    resetInvalidDraft(){if(!this.canResetDraft||this.mode!=='technical')return;this.state=M.fresh();this.mode='edit';this.canResetDraft=false;this.save();this.emit();}
    validateFinal(snapshot,payload){const answer=D.decode(snapshot,'review'),result=S.score(answer);if(snapshot.score!==result.score||snapshot.passed!==result.passed)throw Error('Review mismatch');if(payload&&(payload.score!==result.score||payload.maxScore!==100||payload.passed!==result.passed))throw Error('Pending mismatch');if(this.frozenCanonical&&this.frozenCanonical!==JSON.stringify(answer))throw Error('Frozen answer changed');return {answer,result};}
    command(action,options={}){if(this.mode!=='edit')return false;try{const next=M.change(this.state,action);D.validate(next);if(JSON.stringify(next)===JSON.stringify(this.state))return false;this.state=next;if(action.type!=='control')this.running=false;if(options.save!==false)this.save();this.emit();return true;}catch(_){this.notice='這個操作未能安全記錄，原有進度保持不變。';this.emit();return false;}}
    tick(seconds,budget){if(!this.running||this.mode!=='edit')return null;const result=M.advance(this.state,seconds,budget);if(!result.elapsed||this.state.phase==='ended'||this.state.flight.t>=604800||Math.hypot(...this.state.flight.state.slice(0,2))>=P.R+1e8-.01)this.running=false;return result;}
    pause(){this.running=false;if(this.editable)this.save();this.emit();}
    play(){if(this.mode==='edit'&&this.state.flight&&!['planning','ended','workshop'].includes(this.state.phase)){this.running=true;this.emit();}}
    check(){if(!this.editable)return;this.running=false;if(this.state.phase!=='check')this.state=M.change(this.state,{type:'check'});this.mode='check';this.save();this.emit();}
    back(){if(this.mode!=='check')return;this.state=M.change(this.state,{type:'return'});this.mode='edit';this.save();this.emit();}
    retrySave(){this.save();this.emit();}
    submit(){if(this.mode!=='check'||this.unsaved)return;try{this.running=false;this.beforeSubmission=P.clone(this.state);const result=S.score(this.state);this.finalSnapshot=this.scorm.makeSnapshot(P.ACTIVITY,'review',D.review(this.state),result);this.frozenCanonical=JSON.stringify(D.decode(this.finalSnapshot,'review'));this.mode='submitting';this.emit();const handle=o=>this.handleOutcome(o);this.scorm.submitWithCallbacks(result,this.finalSnapshot,{onSuccess:handle,onFailure:handle});}catch(_){this.technical('未能安全建立提交資料，成績尚未確認。請聯絡教師。');}}
    handleOutcome(raw){const o=raw.activityState?raw:{...raw,activityState:raw.ok?'success':raw.committed?'committed':raw.frozen?'frozen':'retry'};
      const confirmed=mode=>{try{const v=this.validateFinal(o.review||this.finalSnapshot);if((o.score!=null&&o.score!==v.result.score)||(o.status&&o.status!==(v.result.passed?'passed':'failed')))throw Error('Recorded mismatch');this.state=v.answer;this.result=v.result;this.trusted=true;this.mode=mode;this.unsaved=false;this.notice=mode==='committed'?'成績已記錄，結束連線尚未完成。請重試完成程序。':'';}catch(_){this.technical('提交結果未能核對，請聯絡教師檢查。');}};
      this.flow.submission(o,{success:()=>confirmed('review'),committed:()=>confirmed('committed'),frozen:()=>{this.mode='frozen';this.result=null;this.trusted=false;this.notice='提交結果尚未確認，答案已凍結。請重試同一份提交。';},retry:f=>{if(f.retryable){this.state=this.beforeSubmission;this.mode='check';this.finalSnapshot=null;this.notice='提交尚未完成，可返回修改或重試提交。';}else this.technical('提交資料未能安全建立，需要技術檢查。');}});this.emit();
    }
    retryFinal(){if(!['frozen','committed'].includes(this.mode))return;try{this.validateFinal(this.finalSnapshot);this.handleOutcome(this.mode==='committed'?this.scorm.retryFinish():this.scorm.retryPending());}catch(_){this.scorm.quarantinePending();this.technical('提交資料未能核對，已停止重試。請聯絡教師。');}}
  }
  return Object.freeze({Controller});
});
