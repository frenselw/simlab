const ephemerisFile=new URL('./assets/lunar-ephemeris.bin.gz',import.meta.url);
const transferHint='由發射台自動起飛，飛掠月球後自由返回地球，開傘降落陸地。';
const landingHint='由地球自動發射，穩定環月後由你接手登月。';
const outcomes={flyby:'已完成月球飛掠','lunar-pass':'已掠過月球，最近高度超出目標範圍',
  'moon-impact':'撞擊月球','earth-impact':'撞擊地球',
  'ephemeris-end':'已到達日月星曆終點',landed:'已安全降落','destroyed':'隔熱防護耗盡'};

export function installLunarControls(d,{controller,launchAllowed,command,setView,fmt}){
  const L=()=>window.RocketLunar;
  let loading=false,failure=null;
  const values=input=>input.valueAsNumber;
  async function loadModules(){
    await import('./celestial.js');
    await import('./lunar-flight.js');
  }
  async function prepare(type){
    const loadout=type==='lunar-loadout',groundReturn=type==='lunar-return-launch',returning=type==='lunar-return';
    const lunarLanding=type==='lunar-landing-launch';
    if(loading||(!loadout&&!launchAllowed()))return;
    if(type==='launch-lunar'&&!L()?.compatible(controller.state.craft))return;
    const origin=controller.state;
    loading=true;
    failure=null;
    if(lunarLanding)d.lunarLandingHint.textContent='正在準備登月航線…';
    (groundReturn?d.lunarTransferHint:d.lunarPreparation).textContent=groundReturn||returning?'正在準備自由返回航線…':'正在準備月球飛掠…';
    d.lunarLandingLaunch.disabled=d.lunarReturn.disabled=d.lunarReturnShortcut.disabled=d.lunarTransfer.disabled=d.lunarLaunch.disabled=d.lunarLoadout.disabled=true;
    try{
      await loadModules();
      if(controller.state!==origin)return;
      if(!loadout&&!controller.lunarTable){
        const response=await fetch(ephemerisFile);
        if(!response.ok)throw Error('Geometric ephemeris unavailable');
        const bytes=await RocketSurfaceCodec.readBytes(response.body,75000);
        const raw=await RocketSurfaceCodec.gunzip(bytes,RocketCelestial.PACKED_BYTES,true);
        controller.lunarTable=RocketCelestial.ephemeris(raw.buffer);
      }
      if(controller.state!==origin)return;
      if(!command({type}))throw Error('Lunar entry unavailable');
      if(!loadout){
        d.lunarMessage.textContent='';
        d.lunarTiming.open=false;
        setView(returning?'orbit':'follow',true);
        if(returning||groundReturn&&command({type:'ignite'}))controller.play();
      }
    }catch(_){if(controller.state===origin)failure=type;}
    finally{loading=false;controller.emit();}
  }
  d.lunarLandingLaunch.addEventListener('click',()=>prepare('lunar-landing-launch'));
  d.lunarTakeover.addEventListener('click',()=>{if(command({type:'moon-takeover'}))controller.play();});
  d.lunarOrientation.addEventListener('click',event=>{
    const button=event.target.closest('[data-moon-mode]');
    if(button)command({type:'control',key:'mode',value:button.dataset.moonMode});
  });
  d.lunarReturn.addEventListener('click',()=>prepare('lunar-return-launch'));
  d.lunarReturnShortcut.addEventListener('click',()=>prepare('lunar-return'));
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
      d.lunarReturn.disabled=d.lunarReturnShortcut.disabled=d.lunarTransfer.disabled=!launchAllowed();
      d.lunarLandingLaunch.disabled=!launchAllowed();
      d.lunarLandingHint.textContent=failure==='lunar-landing-launch'?'未能準備登月航線。請重試。':landingHint;
      d.lunarTransferHint.textContent=failure==='lunar-return-launch'?'未能準備自由返回航線。請重試。':transferHint;
      d.lunarLoadout.disabled=false;
      d.lunarLaunch.disabled=!ready||!launchAllowed();
      d.lunarPreparation.textContent=failure==='lunar-return'?'未能準備自由返回航線。請重試。':
        failure&&failure!=='lunar-return-launch'?'未能準備月球飛掠。請重試。':ready?'示範火箭已就緒。':'可自行組裝，或載入示範火箭。';
    }
    d.lunarPanel.hidden=!l||Boolean(l.landingMission);
    d.lunarMilestone.hidden=!l?.freeReturn&&!l?.landingMission;
    d.lunarLandingControls.hidden=!l?.landingMission;
    d.lunarReadout.hidden=Boolean(l?.landingMission);
    d.lunarTiming.hidden=Boolean(l?.landingMission);
    d.app.classList.toggle('lunar-flight',Boolean(l));
    const nearMoon=l?.landingMission&&f.moon.height<20000000;
    const label=nearMoon?(f.moon.surface?'相對月面速率':'相對月球速率'):l?.air?'相對大氣速率':l?'地心慣性速率':'總速率';
    if(d.totalSpeedLabel.textContent!==label)d.totalSpeedLabel.textContent=label;
    const apsides=nearMoon?['近月點','遠月點']:['近地點','遠地點'];
    for(const [element,value] of [[d.periapsisLabel,apsides[0]],[d.apoapsisLabel,apsides[1]]]){
      if(element.textContent!==value)element.textContent=value;
    }
    for(const value of [d.periapsisValue,d.apoapsisValue]){
      value.title=l?'按目前地心狀態估算的瞬時二體軌道數值':'';
    }
    if(!l)return;
    if(l.landingMission){
      const ready=l.handoff==='ready',manual=l.handoff==='manual',ended=s.phase==='ended';
      const distance=height=>height>=1000?fmt(height/1000,1)+' km':fmt(height,1)+' m';
      const status={
        'moon-landed':'已安全着陸月面','moon-hard-landing':'月面硬着陸','moon-impact':'撞擊月球',
        'earth-impact':'撞擊地球','moon-orbit-failed':'未能確認穩定環月，控制仍鎖定',
        'ephemeris-end':'已到達日月星曆終點'
      }[l.outcome]||(ready?'已穩定環月，可以接手':manual?'手動操控登月艙':
        l.capturePhase==='align'?'自動轉向':l.capturePhase==='burn'?'自動制動入軌':
        l.capturePhase==='settle'?'環月滑行及軌道核對':f.t>=l.transferCutoff?'自由返回航線 · 奔月途中':'自動發射及奔月點火');
      d.lunarMilestone.textContent=status;
      if(d.lunarLandingStatus.textContent!==status)d.lunarLandingStatus.textContent=status;
      d.lunarLandingTelemetry.textContent=f.moon.surface?
        '離月面 '+distance(f.moon.surface.height)+' · 垂直速度 '+fmt(f.moon.surface.vertical,1)+' m/s · 橫移 '+fmt(f.moon.surface.horizontal,1)+' m/s · 傾角 '+fmt(f.moon.surface.tilt,0)+'° · 餘油 '+fmt(f.capsule.fuel,1)+' kg':
        '距月面 '+fmt(f.moon.height/1000,0)+' km';
      d.lunarTakeover.hidden=!ready;
      d.lunarOrientation.hidden=!manual||ended;
      for(const button of d.lunarOrientation.querySelectorAll('button'))button.setAttribute('aria-pressed',String(f.controls.mode===button.dataset.moonMode));
      d.lunarManual.hidden=d.lunarBearingRow.hidden=d.lunarForecast.hidden=true;
      d.chuteArm.hidden=d.recoveryControls.hidden=d.reentryGauge.hidden=true;
      d.separateButton.disabled=d.bodySelect.disabled=true;
      if(!manual)d.igniteButton.disabled=true;
      if(ready)d.playButton.disabled=true;
      d.flightHint.textContent=manual&&!ended?'離軌時選月球逆行並點火。接近月面時，調姿和油門以降低下降及橫移速度。':status;
      if(nearMoon){
        const altitude=f.moon.surface?.height??f.moon.height;
        d.heightValue.textContent=fmt(altitude>=1000?altitude/1000:altitude,1);
        d.heightUnit.textContent=altitude>=1000?'km':'m';
        d.surfaceAltitude.textContent='距月面';
        d.periapsisValue.textContent=f.moon.bound?fmt(f.moon.hp/1000)+' km':'—';
        d.apoapsisValue.textContent=f.moon.bound?fmt(f.moon.ha/1000)+' km':'非束縛';
        d.periapsisValue.title='近月點';
        d.apoapsisValue.title='遠月點';
        d.orbitStatus.textContent=status;
        const surface=f.moon.surface,vertical=surface?.vertical??f.moon.radial,horizontal=surface?.horizontal??f.moon.tangential;
        for(const [id,value] of [['totalSpeed',Math.hypot(vertical,horizontal)],['verticalSpeed',Math.abs(vertical)],['speed',horizontal]]){
          const km=value>=1000;
          d[id+'Value'].textContent=fmt(km?value/1000:value,km?2:1);
          d[id+'Unit'].textContent=km?'km/s':'m/s';
        }
      }
      if(f.capsule.detached){
        d.fuelLabel0.textContent='登月艙';
        d.fuelBar.style.width=(100*f.capsule.fuel/L().LANDER.fuel)+'%';
      }else{
        const capacity=L().landingCapacity(f);
        for(const [fuel,max,label,bar] of [
          [f.fuel[0],capacity.lower,d.fuelValue,d.fuelBar],
          [f.fuel[1],capacity.upper,d.upperFuelValue,d.upperFuelBar],
          [f.boosters.fuel,capacity.booster,d.boosterFuelValue,d.boosterFuelBar]
        ]){
          if(label.textContent==='已分離')continue;
          const percent=100*fuel/max;
          label.textContent=fmt(percent,0)+'%';
          bar.style.width=percent+'%';
        }
      }
      return;
    }
    const ended=s.phase==='ended',locked=L().guidanceLocked(f),m=l.maneuver;
    const latest=(Math.floor(L().flightLimit(f)*100)/100).toFixed(2);
    for(const input of [d.lunarCutoffAt,d.lunarBurnAt,d.lunarBurnDuration])if(input.max!==latest)input.max=latest;
    const lastCorrection=l.events.findLast(event=>event.type==='correction-stop');
    const distance=fmt(Math.max(0,f.moon.height)/1000,0)+' km';
    const entryPhase={'stowed':'再入大氣層','drogue-opening':'張開減速傘',drogue:'減速傘下降',
      'main-opening':'張開主降落傘',main:'主傘下降'}[f.capsule.chute.phase];
    const coast=l.returning?(f.orbit.radial<0?'接近地球':'飛掠後滑行'):'自由返回 · 奔月途中';
    const ascent=l.groundReturn&&locked?(f.status==='pad'?'發射準備':f.capsule.detached?'奔月點火程序':f.separated?'上級推進':'發射升空'):null;
    const landing=l.outcome==='landed'&&l.landing;
    const phase=landing?(landing.water?'已安全濺落':'已安全降落陸地'):
      outcomes[l.outcome]||(l.entry?entryPhase:ascent||(l.freeReturn?coast:locked?'示範引導中':'三維飛行'));
    if(l.freeReturn)d.lunarMilestone.textContent=l.outcome||l.entry||l.returning||ascent?phase:f.moon.height<=80000000?'距月面 '+distance:phase;
    d.lunarReadout.textContent=phase+' · 距月面 '+distance+
      ' · 月球相對速率 '+fmt(f.moon.speed/1000,2)+' km/s'+
      (l.closest?.height<=80000000?' · 最近 '+fmt(l.closest.height/1000,1)+' km · T+'+fmt(l.closest.t/86400,2)+' 日 · '+fmt(l.closest.speed/1000,2)+' km/s':'')+
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
    const coordinate=(value,positive,negative)=>fmt(Math.abs(value),2)+'°'+(value>=0?positive:negative);
    d.flightHint.textContent=landing?phase+' · '+coordinate(landing.lat,'N','S')+' '+coordinate(landing.lon,'E','W')+
        ' · 接觸速率 '+fmt(landing.speed,1)+' m/s · 剩油 '+fmt(f.capsule.fuel,2)+' kg':
      outcomes[l.outcome]||(l.modified?'已調整示範航線。再入時自動調整隔熱盾及開傘。':l.freeReturn?'航線隨飛行速度和地月引力改變。再入時自動調整隔熱盾及開傘。':
        locked?'示範程序會自動分級、點火及精準關機。':'以發射時間 T+ 預約關機或航線修正。');
  };
}
