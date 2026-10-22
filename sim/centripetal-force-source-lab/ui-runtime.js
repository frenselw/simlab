(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.CentripetalSourceModel,node?require('./persistence.js'):root.CentripetalSourcePersistence,node?require('./scoring.js'):root.CentripetalSourceScoring);
  if(node)module.exports=api;if(root)root.CentripetalSourceRuntime=api;
})(typeof window==='undefined'?globalThis:window,function(M,P,S){
  'use strict';
  class Controller {
    constructor(scorm,flow,render=()=>{}){Object.assign(this,{scorm,flow,render,state:null,mode:'technical',notice:'',result:null,trusted:false,unsaved:false,finalSnapshot:null,reviewPage:0});}
    get editable(){return this.mode==='edit'||this.mode==='check';}
    get page(){return this.editable?this.state.page:this.reviewPage;}
    emit(){this.scorm.setDraftProvider(this.editable?()=>this.draftSnapshot():null);this.render(this);}
    draftSnapshot(){return this.scorm.makeSnapshot(M.ACTIVITY,'draft',P.draft(this.state));}
    save(){if(!this.editable)return false;try{this.unsaved=!this.scorm.saveDraft(this.draftSnapshot());}catch(_){this.unsaved=true;}this.notice=this.unsaved?'最新修改尚未確認保存。本頁保留答案，請重試保存。':'';return !this.unsaved;}
    technical(message){this.mode='technical';this.result=null;this.trusted=false;this.notice=message;this.emit();}
    start(){
      try{
        const attempt=this.scorm.loadAttempt(M.ACTIVITY),startup=this.flow.startup(attempt);this.startedNew=attempt.state==='new';
        if(startup==='editable'){this.state=attempt.state==='draft'?P.decode(attempt.snapshot,'draft'):M.fresh();this.mode=this.state.phase;if(attempt.state==='new')this.save();}
        else if(startup==='review'){
          this.mode='mismatch';this.result={...this.flow.recordedResult(attempt),maxScore:100};this.notice='已記錄的結果未能完整核對，保持唯讀，只顯示可信的記錄摘要。';
          try{const s=P.decode(attempt.snapshot,'review'),result=S.score(s);if(this.flow.reviewResult(result,attempt.snapshot,attempt).trusted){this.state=s;this.reviewPage=s.page;this.result=result;this.trusted=true;this.mode='review';this.notice='';}}catch(_){}
        }else if(startup==='frozen'){
          try{const snap=attempt.snapshot;if(snap?.version!==1||snap.activity!==M.ACTIVITY||snap.kind!=='pending-final'||P.bytes(snap)>P.MAX_BYTES||typeof snap.payload?.reviewJson!=='string')throw Error('Invalid pending');
            const inner=JSON.parse(snap.payload.reviewJson),v=this.validateFinal(inner,snap.payload);this.finalSnapshot=M.clone(inner);this.state=v.answer;this.reviewPage=v.answer.page;this.mode='frozen';this.notice='提交結果尚未確認，答案已凍結。請重試同一份提交。';
          }catch(_){this.scorm.quarantinePending();this.technical('提交資料未能驗證，已停止重試。請聯絡教師檢查紀錄。');return;}
        }else{this.technical('暫時無法安全載入作答，請檢查連線並重新開啟活動。');return;}
      }catch(_){this.technical('未能還原作答資料，原紀錄保持不變。請聯絡教師檢查。');return;}
      this.emit();
    }
    validateFinal(snapshot,payload=null){
      const answer=P.decode(snapshot,'review'),result=S.score(answer);
      if(snapshot.score!==result.score||snapshot.passed!==result.passed)throw Error('Review result mismatch');
      if(payload&&(payload.score!==result.score||payload.maxScore!==100||payload.passed!==result.passed))throw Error('Pending result mismatch');
      if(this.finalSnapshot&&JSON.stringify(P.decode(this.finalSnapshot,'review'))!==JSON.stringify(answer))throw Error('Frozen answer changed');
      return {answer,result};
    }
    command(action){
      if(this.mode!=='edit')return false;
      try{const next=P.draft(M.change(this.state,action));if(JSON.stringify(next)===JSON.stringify(this.state))return false;this.state=next;this.save();this.emit();return true;}
      catch(_){this.notice='這個操作未能安全記錄，請檢查選擇或重試。';this.emit();return false;}
    }
    navigate(page){if(!M.integer(page,0,5)||!this.state)return;
      if(this.editable){this.state=M.navigate(this.state,page);this.state.fromReview=this.mode==='check'||this.state.fromReview;this.mode='edit';this.save();}
      else if(['review','committed','frozen'].includes(this.mode))this.reviewPage=page;
      this.emit();
    }
    check(){if(this.mode!=='edit')return;this.state.returnTo=[this.state.page,this.state.view];this.state.phase='check';this.mode='check';this.save();this.emit();}
    returnToEdit(){if(this.mode!=='check')return;const [page,view]=this.state.returnTo;this.state=M.navigate(this.state,page);this.state.view=view;this.state.fromReview=true;this.mode='edit';this.save();this.emit();}
    retrySave(){this.save();this.emit();}
    submit(){if(this.mode!=='check'||this.unsaved)return;
      try{this.beforeSubmission=P.draft(this.state);const result=S.score(this.state);this.finalSnapshot=this.scorm.makeSnapshot(M.ACTIVITY,'review',P.review(this.state),result);this.reviewPage=this.state.page;this.mode='submitting';this.emit();const handle=o=>this.handleOutcome(o);this.scorm.submitWithCallbacks(result,this.finalSnapshot,{onSuccess:handle,onFailure:handle});}
      catch(_){this.technical('未能安全建立提交資料，成績尚未確認。請聯絡教師。');}
    }
    handleOutcome(raw){
      const o=raw.activityState?raw:{...raw,activityState:raw.ok?'success':raw.committed?'committed':raw.frozen?'frozen':'retry'};
      const confirmed=mode=>{try{const v=this.validateFinal(o.review||this.finalSnapshot);if((o.score!=null&&o.score!==v.result.score)||(o.status&&o.status!==(v.result.passed?'passed':'failed')))throw Error('Recorded result mismatch');this.state=v.answer;this.reviewPage=v.answer.page;this.result=v.result;this.trusted=true;this.mode=mode;this.unsaved=false;this.notice=mode==='committed'?'成績已記錄，結束連線尚未完成。請重試完成程序。':'';}catch(_){this.technical('提交結果未能核對，請聯絡教師檢查紀錄。');}};
      this.flow.submission(o,{success:()=>confirmed('review'),committed:()=>confirmed('committed'),frozen:()=>{this.mode='frozen';this.result=null;this.trusted=false;this.notice='提交結果尚未確認，答案已凍結。請重試同一份提交。';},retry:f=>{if(f.retryable){this.state=this.beforeSubmission;this.mode='check';this.finalSnapshot=null;this.notice='提交尚未完成，可返回修改或重試提交。';}else this.technical('提交資料未能安全建立，需要技術檢查。');}});
      this.emit();
    }
    retryFinal(){if(!['frozen','committed'].includes(this.mode))return;try{this.validateFinal(this.finalSnapshot);this.handleOutcome(this.mode==='committed'?this.scorm.retryFinish():this.scorm.retryPending());}catch(_){this.scorm.quarantinePending();this.technical('提交資料未能核對，已停止重試。請聯絡教師。');}}
  }
  return Object.freeze({Controller});
});
