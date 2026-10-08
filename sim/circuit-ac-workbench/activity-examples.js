(async()=>{
 'use strict';let editor=null,saved=null;
 async function load(name){editor?.destroy();saved=null;const panel=document.createElement('section');panel.className='panel-section ac-panel-content';const description=document.createElement('p');description.textContent=name==='transformer'?'固定接線，只准調副線圈匝數及負載；本頁是無評分的配置示例。':'固定接線，只准切換單刀雙擲及觀察時間、波形；本頁沒有分數。';const status=document.createElement('p');status.setAttribute('role','status');const save=document.createElement('button'),restore=document.createElement('button'),lock=document.createElement('button');save.textContent='保存目前瞬間';restore.textContent='恢復保存瞬間';lock.textContent='切換只讀';restore.disabled=true;
  save.onclick=()=>{const snapshot=editor.captureSession();saved=CircuitACExampleState.encode(name,snapshot);restore.disabled=false;status.textContent='已在記憶體保存 t='+snapshot.physics.time+' s；重新整理會開始新示例。';};restore.onclick=()=>{try{editor.restoreSession(CircuitACExampleState.decode(saved));status.textContent='已恢复並暫停，量測窗重新收集。';}catch(e){status.textContent=e.message;}};lock.onclick=()=>editor.setReadOnly(!editor.getInteraction().readOnly);panel.append(description,save,restore,lock,status);
  editor=await CircuitEditor.mount(document.getElementById('editor'),{...CircuitACPresets.examples(name),panelContent:panel});window.CircuitACExample=editor;
 }
 for(const button of document.querySelectorAll('[data-example]'))button.onclick=()=>load(button.dataset.example);SimFullscreen.attach(document);await load('transformer');
})().catch(error=>{console.error(error);document.getElementById('editor').textContent=error.message;});
