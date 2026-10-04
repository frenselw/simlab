(async()=>{
  'use strict';
  const choice=document.getElementById('activityChoice'), feedback=document.getElementById('activityFeedback'), review=document.getElementById('reviewOnly'), check=document.getElementById('checkActivity');
  let editor, changing=false;
  async function load(id) {
    if(changing)return;changing=true;choice.disabled=check.disabled=true;
    try {
      editor?.destroy();window.CircuitActivity=null;review.checked=false;
      const definition=CircuitActivityProfiles.definitions.find(d=>d.id===id);
      document.getElementById('activityTask').textContent=definition.task;
      editor=await CircuitEditor.mount(document.getElementById('activityEditor'),CircuitActivityProfiles.create(id));
      window.CircuitActivity=editor;feedback.textContent='接線後按「檢查電路」。此頁用於示範共用基礎，沒有成績或提交。';delete feedback.dataset.passed;
      editor.onChange(()=>{feedback.textContent='電路已修改，可以再檢查。';delete feedback.dataset.passed;});
    }finally{changing=false;choice.disabled=check.disabled=false;}
  }
  check.onclick=()=>{const result=editor.check();feedback.textContent=result.message;feedback.dataset.passed=String(result.passed);};
  review.onchange=()=>editor.setReadOnly(review.checked);
  choice.onchange=()=>load(choice.value).catch(error=>{feedback.textContent=error.message;});
  const requested=new URLSearchParams(location.search).get('activity');if(CircuitActivityProfiles.definitions.some(d=>d.id===requested))choice.value=requested;
  await load(choice.value);
})().catch(error=>{console.error('Circuit activity example failed',error);document.getElementById('activityFeedback').textContent='活動未能載入：'+error.message;});
