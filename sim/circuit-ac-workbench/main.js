(async()=>{
 'use strict';
 window.CircuitACWorkbench=await CircuitEditor.mount(document.getElementById('app'),{role:'teacher',analysis:'transient',title:'交流電路工作台',subtitle:'搭建・量測・波形・儲能',palette:CircuitAC.palette,initialDocument:CircuitACPresets.create('resistive'),simulation:{rate:false},idPrefix:'ac-'});
})().catch(error=>{console.error(error);document.getElementById('app').textContent='交流工作台未能載入：'+error.message;});
