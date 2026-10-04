(async () => {
  'use strict';
  window.CircuitWorkbench = await CircuitEditor.mount(document.getElementById('app'), {
    role:'teacher', title:'電路工作台', subtitle:'搭建・量測・探索',
    initialDocument:CircuitPresets.create('series'), idPrefix:''
  });
})().catch(error => {
  console.error('Circuit workbench startup failed',error);
  document.getElementById('app').textContent='電路工作台未能載入，請重新整理頁面。';
});
