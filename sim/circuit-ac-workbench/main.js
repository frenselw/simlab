(async()=>{
 'use strict';
 const introduction=document.createElement('section');introduction.className='panel-section ac-panel-content';
 const title=document.createElement('h2');title.textContent='課堂探索';const link=document.createElement('a');link.href='activity-examples.html';link.textContent='開啟兩個配置與恢復示例';introduction.append(title,link);
 window.CircuitACWorkbench=await CircuitEditor.mount(document.getElementById('app'),{role:'teacher',analysis:'transient',title:'交流電路工作台',subtitle:'搭建・量測・波形・儲能',palette:CircuitAC.palette,initialDocument:CircuitACPresets.create('resistive'),panelContent:introduction,idPrefix:'ac-'});
})().catch(error=>{console.error(error);document.getElementById('app').textContent='交流工作台未能載入：'+error.message;});
