(function(root){
'use strict';
async function mount(){const Q=root.CircuitTaskSpec,P=root.CircuitTaskPersistence,S=root.CircuitTaskScoring,$=id=>document.getElementById(id);
$('activityTitle').textContent=Q.title;$('rubric').textContent=Q.rubric;document.title=Q.title+' · SimLab';
let loading=false,accepting=false;const editor=await root.CircuitEditor.mount($('editor'),Q.config());
function render(c){$('app').dataset.mode=c.mode;const canEdit=c.mode==='edit';if(editor.getInteraction().readOnly===canEdit)editor.setReadOnly(!canEdit);
if(c.state&&!accepting){const doc=P.document(c.state);if(JSON.stringify(editor.getDocument())!==JSON.stringify(doc)){loading=true;editor.setReadOnly(false);try{editor.loadDocument(doc);}finally{editor.setReadOnly(!canEdit);loading=false;}}}
$('editor').hidden=!c.state;$('task').textContent=Q.tasks[c.state?.question??0];$('notice').textContent=c.notice;$('notice').hidden=!c.notice;
$('navigation').replaceChildren();if(Q.count>1&&c.state)for(let i=0;i<Q.count;i++){const b=document.createElement('button');b.textContent='第 '+(i+1)+' 題';b.setAttribute('aria-pressed',String(c.state.question===i));b.onclick=()=>c.navigate(i);$('navigation').append(b);}
$('reasons').hidden=!Q.reasons||!c.state;if(Q.reasons&&c.state){if(!$('reasons').children.length){const legend=document.createElement('legend');legend.textContent='相對初始 50% 的接入電阻';$('reasons').append(legend);for(const [value,label]of Q.reasons){const l=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='reason';input.value=value;input.onchange=()=>c.reason(value);l.append(input,document.createTextNode(label));$('reasons').append(l);}}for(const input of $('reasons').querySelectorAll('input')){input.checked=c.state.answers[c.state.question].reason===Number(input.value);input.disabled=!canEdit;}}
$('check').hidden=!canEdit;$('edit').hidden=c.mode!=='check';$('submit').hidden=c.mode!=='check';$('submit').disabled=c.unsaved;$('retrySave').hidden=!c.unsaved||!c.editable;$('retryFinal').hidden=!['frozen','committed'].includes(c.mode);$('retryFinal').textContent=c.mode==='committed'?'重試完成連線':'重試同一份提交';
$('checkSummary').hidden=c.mode!=='check';$('checkSummary').replaceChildren();if(c.mode==='check'){const rows=c.state.answers?c.state.answers.map((a,i)=>'第 '+(i+1)+' 題：'+(a.position===null?'尚未調整滑片':'滑片 '+Number((a.position*100).toFixed(2))+'%')+'；'+(a.reason===null?'尚未選擇電阻變化':Q.reasons.find(r=>r[0]===a.reason)[1])):[c.state.c.length||c.state.w.length?'已放置 '+c.state.c.length+' 個元件、'+c.state.w.length+' 條導線。':'尚未取出元件或接線。'];for(const row of rows){const p=document.createElement('p');p.textContent=row;$('checkSummary').append(p);}}
$('review').hidden=!c.result;$('review').replaceChildren();if(c.result){const h=document.createElement('h2');h.textContent=(c.result.score===null?'成績未能讀取':c.result.score+' / 100 分')+' · '+root.SimActivityFlow.completionLabel(c.result.passed);$('review').append(h);for(const row of c.result.detail||[]){const p=document.createElement('p');p.textContent=row.label+'：'+row.earned+' / '+row.max;$('review').append(p);}}
$('phase').textContent={edit:'作答',check:'檢查與提交：可提交空白或部分答案，提交後不能修改。',review:'已記錄：只讀檢視',frozen:'等待提交確認',committed:'成績已記錄',technical:'暫停作答',mismatch:'已完成：只讀摘要'}[c.mode];
}
const runtime=new root.CircuitActivityRuntime.Controller(Q,P,S,root.SimScorm,root.SimActivityFlow,render);
editor.onChange(doc=>{if(loading||runtime.mode!=='edit')return;accepting=true;try{runtime.updateDocument(doc);}finally{accepting=false;}});
$('check').onclick=()=>runtime.check();$('edit').onclick=()=>runtime.edit();$('submit').onclick=()=>runtime.submit();$('retrySave').onclick=()=>runtime.retrySave();$('retryFinal').onclick=()=>runtime.retryFinal();
runtime.start();root.CircuitActivity={editor,runtime};return root.CircuitActivity;
}
root.CircuitActivityPage={mount};
})(window);
