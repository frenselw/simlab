(async()=>{
  'use strict';
  window.CircuitHouseholdWorkbench=await CircuitEditor.mount(document.getElementById('app'),{
    role:'teacher',analysis:'household',title:'家庭電路工作台',subtitle:'火線・零線・地線',idPrefix:'house-',
    palette:CircuitHouseholdComponents.palette,initialDocument:CircuitHouseholdPresets.create('C01'),wireResistance:false,
    ui:{waveform:false,field:false,energy:false,phase:false,wireCurrents:false,potentialDirections:false,wireList:false},simulation:{reset:false}
  });
})().catch(error=>{console.error(error);document.getElementById('app').textContent='家庭工作台未能載入：'+error.message;});
