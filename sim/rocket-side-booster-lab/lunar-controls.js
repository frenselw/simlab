const ephemerisFile=new URL('./assets/lunar-ephemeris.bin.gz',import.meta.url);
const transferHint='由奔月途中開始。掠過月球後，借引力返地球並開傘降落。';
const outcomes={flyby:'已完成月球飛掠','lunar-pass':'已掠過月球，最近高度超出目標範圍',
  'moon-impact':'撞擊月球','earth-impact':'撞擊地球','earth-entry':'到達地球大氣邊界',
  'time-limit':'已到達示範時間上限',landed:'已安全降落','destroyed':'隔熱防護耗盡'};

export function installLunarControls(d,{controller,launchAllowed,command,setView,fmt}){
  const L=()=>window.RocketLunar;
  let loading=false,failure=null;
  const values=input=>input.valueAsNumber;
  async function loadModules(){
    await import('./celestial.js');
    await import('./lunar-flight.js');
  }
  async function prepare(type){
    const loadout=type==='lunar-loadout',returning=type==='lunar-return';
    if(loading||(!loadout&&!launchAllowed()))return;
    if(type==='launch-lunar'&&!L()?.compatible(controller.state.craft))return;
    loading=true;
    failure=null;
    (returning?d.lunarTransferHint:d.lunarPreparation).textContent=returning?'正在準備自由返回航線…':'正在準備月球飛掠…';
    d.lunarReturn.disabled=d.lunarTransfer.disabled=d.lunarLaunch.disabled=d.lunarLoadout.disabled=true;
    try{
      await loadModules();
      if(!loadout&&!controller.lunarTable){
        const response=await fetch(ephemerisFile);
        if(!response.ok)throw Error('Geometric ephemeris unavailable');
        const bytes=await RocketSurfaceCodec.readBytes(response.body,75000);
        const raw=await RocketSurfaceCodec.gunzip(bytes,RocketCelestial.PACKED_BYTES,true);
        controller.lunarTable=RocketCelestial.ephemeris(raw.buffer);
      }
      if(!command({type}))throw Error('Lunar entry unavailable');
      if(!loadout){
        d.lunarMessage.textContent='';
        d.lunarTiming.open=false;
        setView(returning?'orbit':'follow',true);
        if(returning)controller.play();
      }
    }catch(_){failure=type;}
    finally{loading=false;controller.emit();}
  }
  d.lunarReturn.addEventListener('click',()=>prepare('lunar-return'));
  d.lunarTransfer.addEventListener('click',()=>prepare('lunar-transfer'));
  d.lunarLoadout.addEventListener('click',()=>prepare('lunar-loadout'));
  d.lunarLaunch.addEventListener('click',()=>prepare('launch-lunar'));
  // A manually assembled matching rocket can open the lunar tools without replacing it.
  d.lunarSetup.addEventListener('toggle',async()=>{
    if(!d.lunarSetup.open||L()||loading)return;
    try{
      await loadModules();
      controller.emit();
    }catch(_){failure='lunar-loadout';controller.emit();}
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
  return function render(forecast){
    const s=controller.state,f=s.flight,l=f?.lunar;
    if(s.phase==='workshop'&&!loading){
      const ready=L()?.compatible(s.craft);
      d.lunarReturn.disabled=d.lunarTransfer.disabled=!launchAllowed();
      d.lunarTransferHint.textContent=failure==='lunar-return'?'未能準備自由返回航線。請重試。':transferHint;
      d.lunarLoadout.disabled=false;
      d.lunarLaunch.disabled=!ready||!launchAllowed();
      d.lunarPreparation.textContent=failure&&failure!=='lunar-return'?'未能準備月球飛掠。請重試。':ready?'示範火箭已就緒。':'可自行組裝，或載入示範火箭。';
    }
    d.lunarPanel.hidden=!l;
    d.lunarMilestone.hidden=!l?.freeReturn;
    d.app.classList.toggle('lunar-flight',Boolean(l));
    const label=l?.air?'相對大氣速率':l?'地心慣性速率':'總速率';
    if(d.totalSpeedLabel.textContent!==label)d.totalSpeedLabel.textContent=label;
    for(const value of [d.periapsisValue,d.apoapsisValue]){
      value.title=l?'按目前地心狀態估算的瞬時二體軌道數值':'';
    }
    if(!l)return;
    const ended=s.phase==='ended',locked=L().guidanceLocked(f),m=l.maneuver;
    const lastCorrection=l.events.findLast(event=>event.type==='correction-stop');
    const distance=fmt(Math.max(0,f.moon.height)/1000,0)+' km';
    const entryPhase={'stowed':'再入大氣層','drogue-opening':'張開減速傘',drogue:'減速傘下降',
      'main-opening':'張開主降落傘',main:'主傘下降'}[f.capsule.chute.phase];
    const phase=outcomes[l.outcome]||(l.entry?entryPhase:l.returning?'返地球途中':l.freeReturn?'自由返回 · 奔月途中':locked?'示範引導中':'三維飛行');
    if(l.freeReturn)d.lunarMilestone.textContent=l.entry||l.returning?phase:f.moon.height<=80000000?'距月面 '+distance:'自由返回 · 奔月途中';
    d.lunarReadout.textContent=phase+' · 距月面 '+distance+
      ' · 月球相對速率 '+fmt(f.moon.speed/1000,2)+' km/s'+
      (l.closest?.height<=80000000?' · 最近 '+fmt(l.closest.height/1000,1)+' km':'')+
      ' · 太空艙 '+fmt(f.capsule.fuel,2)+' kg';
    const estimates=[];
    if(forecast?.closest?.height<=80000000)estimates.push('預計最近月面 '+fmt(forecast.closest.height/1000,1)+' km · T+'+fmt(forecast.closest.t/86400,2)+' 日');
    if(forecast?.entry)estimates.push('預計返抵大氣層 T+'+fmt(forecast.entry.t/86400,2)+' 日');
    d.lunarForecast.hidden=ended||Boolean(l.entry)||f.controls.lit||!f.capsule.detached;
    d.lunarForecast.textContent=estimates.length?estimates.join('；')+'（關機滑行）':forecast?'預測範圍內暫無近月或再入事件。':'正在預測關機後路徑…';
    d.lunarManual.hidden=!locked||ended;
    d.lunarBearingRow.hidden=locked||ended||Boolean(l.entry);
    if(document.activeElement!==d.lunarBearing)d.lunarBearing.value=l.bearing.toFixed(2);
    d.lunarCutoffButton.disabled=ended||locked||!f.controls.lit||Boolean(m);
    d.lunarCorrectionButton.disabled=ended||locked||!f.capsule.detached||f.controls.lit||Boolean(m)||Boolean(l.entry)||f.orbit.height<120000;
    d.lunarCancel.hidden=l.cutoff===null&&(!m||m.active);
    d.lunarSchedule.textContent=m?(m.active?'修正點火中':m.aligning?'轉向中':'已預約修正')+
        ' · T+'+fmt(m.start,2)+'–'+fmt(m.end,2)+' s':
      l.cutoff!==null?'已預約關機 · T+'+fmt(l.cutoff,2)+' s':
      locked?'示範奔月關機 · T+'+fmt(l.transferCutoff,2)+' s':
      lastCorrection?'已修正 · 推進劑用量 '+fmt(lastCorrection.used,4)+' kg':'';
    d.chuteArm.hidden=true;
    d.recoveryControls.hidden=true;
    d.reentryGauge.hidden=!l.thermal||f.capsule.chute.phase!=='stowed'||l.thermal.flux<.0001||ended;
    if(!d.reentryGauge.hidden){
      d.reentryGauge.classList.toggle('warning',!l.thermal.protected);
      d.heatReadout.textContent='隔熱防護 '+fmt((1-f.capsule.heat)*100,0)+'%';
      d.heatTarget.textContent='隔熱盾迎風';
    }
    d.separationReadout.hidden=true;
    d.bodySelect.disabled=true;
    d.separateButton.disabled ||= locked;
    d.igniteButton.disabled ||= ended||Boolean(l.entry)||locked&&f.status!=='pad'&&!f.controls.lit||Boolean(m&&!m.active);
    d.orbitStatus.textContent=phase;
    d.flightHint.textContent=l.outcome==='landed'?'安全降落 · 接地速率 '+fmt(Math.hypot(f.capsule.touchdown.normal,f.capsule.touchdown.tangent),1)+' m/s':
      outcomes[l.outcome]||(l.freeReturn?'太空艙借地月引力返回；再入時自動調整隔熱盾及開傘。':
        locked?'示範程序會自動分級、點火及精準關機。':'以發射時間 T+ 預約關機或航線修正。');
  };
}
