(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitActivityRuntime=api;})(globalThis,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
class Controller {
 constructor(spec,persistence,scoring,scorm,flow,onChange=()=>{}){Object.assign(this,{Q:spec,P:persistence,S:scoring,scorm,flow,onChange,state:null,mode:'technical',result:null,notice:'',unsaved:false,finalSnapshot:null});}
 get editable(){return this.mode==='edit'||this.mode==='check';}
 emit(){this.scorm.setDraftProvider(this.editable?()=>this.draftSnapshot():null);this.onChange(this);}
 draftSnapshot(){return this.scorm.makeSnapshot(this.P.ACTIVITY,'draft',this.P.draft(this.state));}
 save(){if(!this.editable)return false;try{this.unsaved=!this.scorm.saveDraft(this.draftSnapshot());}catch(_){this.unsaved=true;}this.notice=this.unsaved?'最新修改尚未保存。可以繼續編輯，請重試保存後再提交。':'';return !this.unsaved;}
 technical(message){this.scorm.quarantinePending();this.mode='technical';this.result=null;this.notice=message;this.emit();}
 start(){try{const attempt=this.scorm.loadAttempt(this.P.ACTIVITY);this.attempt=attempt;switch(this.flow.startup(attempt)){
 case 'editable':this.state=attempt.state==='draft'?this.P.decode(attempt.snapshot,'draft'):this.P.fresh();this.mode=this.state.phase;if(attempt.state==='new')this.save();break;
 case 'review':this.restoreReview(attempt);break;
 case 'frozen':this.restorePending(attempt.snapshot);break;
 default:this.technical('未能安全讀取目前的作答狀態。請重新開啟活動。');return;
 }}catch(_){this.technical('未能還原作答資料；目前資料保持不變，需要技術檢查。');return;}this.emit();}
 restoreReview(attempt){this.mode='mismatch';this.result=this.flow.reviewResult(null,null,attempt).result;this.notice='已完成的作答未能安全核對；保持只讀，只顯示已記錄的成績。';try{const state=this.P.decode(attempt.snapshot,'review'),result=this.S.score(state),checked=this.flow.reviewResult(result,attempt.snapshot,attempt);if(checked.trusted){this.state=state;this.result=result;this.mode='review';this.notice='';}}catch(_){} }
 validateFinal(snapshot,payload=null){const state=this.P.decode(snapshot,'review'),result=this.S.score(state);if(snapshot.score!==result.score||snapshot.passed!==result.passed||payload&&(payload.score!==result.score||payload.maxScore!==100||payload.passed!==result.passed))throw new Error('提交分數不一致');if(this.finalSnapshot&&JSON.stringify(this.P.review(this.P.decode(this.finalSnapshot,'review')))!==JSON.stringify(this.P.review(state)))throw new Error('提交答案已改變');return {state,result};}
 restorePending(snapshot){try{const A=typeof module==='object'&&module.exports?require('./circuit-activity-data'):globalThis.CircuitActivityData;A.keys(snapshot,['version','activity','kind','payload']);A.keys(snapshot.payload,['reviewJson','score','maxScore','passed']);if(snapshot.version!==1||snapshot.activity!==this.P.ACTIVITY||snapshot.kind!=='pending-final'||this.P.bytes(snapshot)>4000||typeof snapshot.payload.reviewJson!=='string')throw new Error('提交封套無效');const inner=JSON.parse(snapshot.payload.reviewJson),validated=this.validateFinal(inner,snapshot.payload);this.finalSnapshot=clone(inner);this.state=validated.state;this.mode='frozen';this.result=null;this.notice='提交尚未確認。答案已凍結，請重試同一份提交。';}catch(_){this.scorm.quarantinePending();this.technical('凍結提交未能通過驗證；需要技術檢查，暫時不能重試。');}}
 updateDocument(doc){if(this.mode!=='edit')return false;const next=this.P.capture(doc,this.state);if(JSON.stringify(next)===JSON.stringify(this.state))return false;this.state=next;this.finalSnapshot=null;this.save();this.emit();return true;}
 reason(value){if(this.mode!=='edit'||!this.Q.reasons)return;const next=clone(this.state);next.answers[next.question].reason=value;this.state=this.P.validate(next);this.save();this.emit();}
 navigate(question){if(this.Q.count===1||!this.state||!Number.isInteger(question)||question<0||question>=this.Q.count)return;if(this.editable){this.state=this.P.validate({...this.state,question,phase:'edit'});this.mode='edit';this.save();}else if(['review','committed','frozen'].includes(this.mode)){this.state=this.P.validate({...this.state,question});}this.emit();}
 check(){if(!this.editable)return;this.state=this.P.validate({...this.state,phase:'check'});this.mode='check';this.save();this.emit();}
 edit(){if(!this.editable)return;this.state=this.P.validate({...this.state,phase:'edit'});this.mode='edit';this.save();this.emit();}
 retrySave(){this.save();this.emit();}
 submit(){if(this.mode!=='check'||this.unsaved)return;try{const result=this.S.score(this.state);this.finalSnapshot=this.scorm.makeSnapshot(this.P.ACTIVITY,'review',this.P.review(this.state),result);this.validateFinal(this.finalSnapshot);const payload={reviewJson:JSON.stringify(this.finalSnapshot),score:result.score,maxScore:100,passed:result.passed};if(this.P.bytes({version:1,activity:this.P.ACTIVITY,kind:'pending-final',payload})>4000)throw new Error('提交超出容量');const handle=x=>this.handleOutcome(x);this.scorm.submitWithCallbacks(result,this.finalSnapshot,{onSuccess:handle,onFailure:handle});}catch(_){this.technical('未能建立提交資料；本頁不會宣稱成績已確認。');}}
 handleOutcome(raw){const outcome=raw.activityState?raw:{...raw,activityState:raw.ok?'success':raw.committed?'committed':raw.frozen?'frozen':'retry'};
 const confirmed=mode=>{try{const validated=this.validateFinal(outcome.review||this.finalSnapshot);if(outcome.score!=null&&outcome.score!==validated.result.score||outcome.status&&outcome.status!==(validated.result.passed?'passed':'failed'))throw new Error('LMS 成績不一致');this.state=validated.state;this.result=validated.result;this.mode=mode;this.unsaved=false;this.notice=mode==='committed'?'成績已記錄，結束連線尚未完成。請重試完成連線。':'';}catch(_){this.technical('提交結果未能安全核對，作答保持鎖定。');}};
 this.flow.submission(outcome,{success:()=>confirmed('review'),committed:()=>confirmed('committed'),frozen:()=>{this.mode='frozen';this.result=null;this.notice='提交尚未確認。答案已凍結，請重試同一份提交。';},retry:x=>{if(x.retryable){this.mode='check';this.finalSnapshot=null;this.notice='提交未完成；可修改答案或重試提交。';}else this.technical('未能安全提交，需要技術檢查。');}});this.emit();}
 retryFinal(){if(!['frozen','committed'].includes(this.mode))return;try{this.validateFinal(this.finalSnapshot);this.handleOutcome(this.mode==='committed'?this.scorm.retryFinish():this.scorm.retryPending());}catch(_){this.scorm.quarantinePending();this.technical('提交資料未能安全核對，已停止重試。');}}
}
return {Controller};
});
