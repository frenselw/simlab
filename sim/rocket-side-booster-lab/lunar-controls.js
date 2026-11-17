const ephemerisFile=new URL('./assets/lunar-ephemeris.bin.gz',import.meta.url);
const outcomes={flyby:'已完成月球飛掠','lunar-pass':'已掠過月球，最近高度超出目標範圍',
  'moon-impact':'撞擊月球','earth-impact':'撞擊地球','earth-entry':'到達地球大氣邊界',
  'time-limit':'已到達示範時間上限'};

export function installLunarControls(d,{controller,launchAllowed,command,setView,fmt}){
  const L=()=>window.RocketLunar;
  let loading=false,failed=false;
  const values=input=>input.valueAsNumber;
  d.lunarLoadout.addEventListener('click',async()=>{
    if(loading)return;
    loading=true;
    failed=false;
    d.lunarPreparation.textContent='正在準備月球飛掠…';
    d.lunarLoadout.disabled=d.lunarLaunch.disabled=true;
    try{
      await import('./celestial.js');
      await import('./lunar-flight.js');
      command({type:'lunar-loadout'});
    }catch(_){failed=true;}
    finally{loading=false;controller.emit();}
  });
  d.lunarLaunch.addEventListener('click',async()=>{
    if(loading||!L()?.compatible(controller.state.craft)||!launchAllowed())return;
    loading=true;
    failed=false;
    d.lunarPreparation.textContent='正在讀取本地日月位置資料…';
    d.lunarLaunch.disabled=d.lunarLoadout.disabled=true;
    try{
      if(!controller.lunarTable){
        const response=await fetch(ephemerisFile);
        if(!response.ok)throw Error('Geometric ephemeris unavailable');
        const bytes=await RocketSurfaceCodec.readBytes(response.body,75000);
        const raw=await RocketSurfaceCodec.gunzip(bytes,RocketCelestial.PACKED_BYTES,true);
        controller.lunarTable=RocketCelestial.ephemeris(raw.buffer);
      }
      if(command({type:'launch-lunar'})){
        d.lunarMessage.textContent='';
        d.lunarTiming.open=false;
        setView('follow',true);
      }
    }catch(_){failed=true;}
    finally{loading=false;controller.emit();}
  });
  // A manually assembled matching rocket can open the lunar tools without replacing it.
  d.lunarSetup.addEventListener('toggle',async()=>{
    if(!d.lunarSetup.open||L()||loading)return;
    try{
      await import('./celestial.js');
      await import('./lunar-flight.js');
      controller.emit();
    }catch(_){failed=true;controller.emit();}
  });
  d.lunarManual.addEventListener('click',()=>command({type:'manual'}));
  d.lunarBearing.addEventListener('change',()=>{
    if(d.lunarBearing.reportValidity())command({type:'control',key:'bearing',value:values(d.lunarBearing)});
  });
  d.lunarCutoffForm.addEventListener('submit',event=>{
    event.preventDefault();
    const ok=command({type:'lunar-cutoff',value:values(d.lunarCutoffAt)});
    d.lunarMessage.textContent=ok?'已預約關機。':'請輸入未來的關機時間，並確認引擎正在燃燒。';
  });
  d.lunarCorrectionForm.addEventListener('submit',event=>{
    event.preventDefault();
    const ok=command({type:'lunar-correction',start:values(d.lunarBurnAt),
      duration:values(d.lunarBurnDuration),throttle:values(d.lunarBurnThrottle)/100,direction:d.lunarBurnDirection.value});
    d.lunarMessage.textContent=ok?'已預約修正。':'請預留至少 17 秒轉向時間，並確認餘油足夠。';
  });
  d.lunarCancel.addEventListener('click',()=>{
    if(command({type:'lunar-cancel'}))d.lunarMessage.textContent='已取消預約。';
  });
  return function render(){
    const s=controller.state,f=s.flight,l=f?.lunar;
    if(s.phase==='workshop'&&!loading){
      const ready=L()?.compatible(s.craft);
      d.lunarLoadout.disabled=false;
      d.lunarLaunch.disabled=!ready||!launchAllowed();
      d.lunarPreparation.textContent=failed?'未能準備月球飛掠。請重試。':ready?'示範火箭已就緒。':'可自行組裝，或載入示範火箭。';
    }
    d.lunarPanel.hidden=!l;
    d.app.classList.toggle('lunar-flight',Boolean(l));
    const label=l?'地心慣性速率':'總速率';
    if(d.totalSpeedLabel.textContent!==label)d.totalSpeedLabel.textContent=label;
    for(const value of [d.periapsisValue,d.apoapsisValue]){
      value.title=l?'按目前地心狀態估算的瞬時二體軌道數值':'';
    }
    if(!l)return;
    const ended=s.phase==='ended',locked=L().guidanceLocked(f),m=l.maneuver;
    const lastCorrection=l.events.findLast(event=>event.type==='correction-stop');
    const distance=fmt(Math.max(0,f.moon.height)/1000,0)+' km';
    d.lunarReadout.textContent=(outcomes[l.outcome]||(locked?'示範引導中':'三維飛行'))+' · 距月面 '+distance+
      ' · 月球相對速率 '+fmt(f.moon.speed/1000,2)+' km/s'+
      (l.closest?.height<=80000000?' · 最近 '+fmt(l.closest.height/1000,1)+' km':'')+
      ' · 太空艙 '+fmt(f.capsule.fuel,2)+' kg';
    d.lunarManual.hidden=!locked||ended;
    d.lunarBearingRow.hidden=locked||ended;
    if(document.activeElement!==d.lunarBearing)d.lunarBearing.value=l.bearing.toFixed(2);
    d.lunarCutoffButton.disabled=ended||locked||!f.controls.lit||Boolean(m);
    d.lunarCorrectionButton.disabled=ended||locked||!f.capsule.detached||f.controls.lit||Boolean(m)||f.orbit.height<120000;
    d.lunarCancel.hidden=l.cutoff===null&&(!m||m.active);
    d.lunarSchedule.textContent=m?(m.active?'修正點火中':m.aligning?'轉向中':'已預約修正')+
        ' · T+'+fmt(m.start,2)+'–'+fmt(m.end,2)+' s':
      l.cutoff!==null?'已預約關機 · T+'+fmt(l.cutoff,2)+' s':
      locked?'示範奔月關機 · T+'+fmt(l.transferCutoff,2)+' s':
      lastCorrection?'已修正 · 推進劑用量 '+fmt(lastCorrection.used,4)+' kg':'';
    d.chuteArm.hidden=true;
    d.recoveryControls.hidden=true;
    d.reentryGauge.hidden=true;
    d.separationReadout.hidden=true;
    d.bodySelect.disabled=true;
    d.separateButton.disabled ||= locked;
    d.igniteButton.disabled ||= ended||locked&&f.status!=='pad'&&!f.controls.lit||Boolean(m&&!m.active);
    d.orbitStatus.textContent=outcomes[l.outcome]||'地月三維航線';
    d.flightHint.textContent=outcomes[l.outcome]||(locked?'示範程序會自動分級、點火及精準關機。':'以發射時間 T+ 預約關機或航線修正。');
  };
}
