(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const dep=(file,name)=>node?require('./'+file+'.js'):root[name];
  const api=factory(dep('celestial','RocketCelestial'),dep('parts','RocketParts'),
    dep('model','RocketModel'),dep('surface','RocketSurface'),dep('recovery','RocketRecovery'));
  if(node)module.exports=api;
  else root.RocketLunar=api;
})(globalThis,function(C,P,M,S,R){
  'use strict';
  const {norm,dot,cross,add,scale,unit,DEG}=C;
  const LAUNCH=3212112.6804642463,BEARING=142.2141656696786;
  const INSERTION_FUEL=30-13.940448204644234,THRUST=3000,ISP=300;
  const NEAR=80000000,FORECAST_SPAN=10*C.DAY,TURN_LEAD=16,TURN_THRESHOLD=Math.cos(.15*DEG);
  const TRANSFER_START=7200,FAST_WARP=10000,ENCOUNTER_WARP_HEIGHT=20000000;
  // Inertial state obtained by shooting backward from the Moon and targeting both Earth passes.
  const RETURN_EPOCH=3285490.002632308;
  const RETURN_STATE=[205344.5406768357,5772131.665025363,3121096.882471883,
    -10927.918431983415,449.7399473737207,-161.45889226108693];
  const epoch=f=>f.lunar.epoch??LAUNCH;
  const flightLimit=f=>C.MAX_TIME-epoch(f)-1e-6;
  const PITCH=[
    [0,0],[2.4,8.1],[10,16.54],[20,21.5],[30,33.98],[45,52.43],[60,67.88],
    [75,74.41],[90,80.34],[105,81.78],[120,86.91],[145,87.41],[180,88.41],[230,90.01],[306,89.41]
  ];
  const OFFSET=[[0,0],[60,-4],[120,-2.5],[230,0]];
  const DIRECTIONS=['prograde','retrograde','radial-out','radial-in','normal','antinormal'];
  const station=[0,1,2].map(i=>S.fromGeocentric(...[0,1,2].map(j=>Number(i===j)))[1]);
  const preset=()=>({payload:0,stages:[{engine:0,small:0,large:4},{engine:1,small:1,medium:1,large:0}],separator:true,boosters:4});
  function compatible(c){
    const [a,b]=c.stages;
    return P.complete(c)&&c.boosters===4&&a.engine===0&&a.large===4&&!a.small&&!a.medium&&
      b?.engine===1&&b.small===1&&b.medium===1&&!b.large;
  }
  function interp(t,knots){
    const i=knots.findIndex(point=>point[0]>t);
    if(i<0)return knots.at(-1)[1];
    if(i===0)return knots[0][1];
    const [a,x]=knots[i-1],[b,y]=knots[i];
    return x+(y-x)*(t-a)/(b-a);
  }
  function localAxis(r,pole,pitch,bearing){
    const up=unit(r),east=unit(cross(pole,up)),north=cross(up,east);
    const forward=add(scale(north,Math.cos(bearing*DEG)),east,Math.sin(bearing*DEG));
    return add(scale(up,Math.cos(pitch*DEG)),forward,Math.sin(pitch*DEG));
  }
  function burnAxis(q,direction){
    const r=q.slice(0,3),v=q.slice(3,6);
    if(direction==='radial-out'||direction==='radial-in')return scale(unit(r),direction==='radial-out'?1:-1);
    if(direction==='normal'||direction==='antinormal')return scale(unit(cross(r,v)),direction==='normal'?1:-1);
    return scale(unit(v),direction==='retrograde'?-1:1);
  }
  function slew(from,to,dt){
    const angle=Math.acos(Math.max(-1,Math.min(1,dot(from,to))));
    const limit=dt*12*DEG;
    if(angle<=limit)return to;
    let lateral=unit(add(to,from,-dot(to,from)));
    if(norm(lateral)<.5)lateral=unit(cross(from,Math.abs(from[0])<.8?[1,0,0]:[0,1,0]));
    return unit(add(scale(from,Math.cos(limit)),lateral,Math.sin(limit)));
  }
  function surfaceVector(frame,v){
    const [east,up,north]=S.fromGeocentric(...C.toColumns(frame,v));
    return [up,east,north];
  }
  function elements(q){
    const r=q.slice(0,3),v=q.slice(3,6),radius=norm(r),speed=norm(v);
    const momentum=cross(r,v),energy=speed*speed/2-P.MU/radius;
    const eccentricity=norm(add(scale(cross(v,momentum),1/P.MU),unit(r),-1));
    const a=energy<0?-P.MU/(2*energy):null;
    return {height:radius-P.R,speed,radial:dot(r,v)/radius,tangential:norm(momentum)/radius,
      bound:a!==null,hp:a===null?null:a*(1-eccentricity)-P.R,ha:a===null?null:a*(1+eccentricity)-P.R,
      period:a===null?null:2*Math.PI*Math.sqrt(a**3/P.MU),e:eccentricity};
  }
  function sync(f,table){
    const frame=C.earthFrame(epoch(f)+f.t);
    if(!f.lunar.mapAxes){
      const approach=table.body(epoch(f)+(f.lunar.freeReturn?4.2:5.2)*C.DAY,0);
      // Match the east/up/north handedness of the existing scene.
      const right=unit(approach.slice(0,3)),depth=unit(cross(approach.slice(3),right));
      f.lunar.mapAxes=[right,cross(right,depth),depth];
    }
    for(const body of [f,f.upperStage].filter(Boolean)){
      const r=body.eci.slice(0,3),v=body.eci.slice(3,6);
      const position=surfaceVector(frame,r),velocity=surfaceVector(frame,v),axis=surfaceVector(frame,body.axis);
      body.state=[...position,...velocity];
      body.attitude=Math.atan2(axis[1],axis[0]);
      body.pitch=Math.acos(Math.max(-1,Math.min(1,dot(unit(r),body.axis))))/DEG;
      body.axisSurface=axis;
      body.orbit=elements(body.eci);
    }
    const moonState=table.body(epoch(f)+f.t,0);
    f.sky=Object.fromEntries(['moon','sun'].map((name,i)=>{
      const [up,east,north]=surfaceVector(frame,i?table.body(epoch(f)+f.t,i).slice(0,3):moonState.slice(0,3));
      return [name,[east/1000,up/1000,north/1000]];
    }));
    const [up,east,north]=surfaceVector(frame,unit(cross(moonState.slice(0,3),moonState.slice(3,6))));
    f.sky.moonNorth=[east,up,north];
    f.sky.mapBasis=f.lunar.mapAxes.map(axis=>S.fromGeocentric(...C.toColumns(frame,axis)));
    const sample=lunarDistance(table,f,f.t,f.eci);
    f.moon={height:sample.height,speed:sample.speed};
  }
  const flow=(force,isp)=>force/(P.G0*isp);
  const boostEnd=P.BOOSTER.fuel/flow(P.BOOSTER.thrust,P.BOOSTER.isp);
  function open(craft,table){
    if(!compatible(craft))throw Error('The lunar demonstrator requires the reference rocket');
    const f=M.flight(craft);
    const frame=C.earthFrame(LAUNCH),up=C.fromColumns(frame,station),r=scale(up,P.R);
    f.eci=[...r,...C.spin(frame[2],r)];
    f.axis=up;
    const lower=P.ENGINES[craft.stages[0].engine],upper=P.ENGINES[craft.stages[1].engine];
    const stage=f.fuel[0]/flow(lower.thrust,lower.isp),cutoff=stage+f.fuel[1]/flow(upper.thrust,upper.isp);
    const ignite=cutoff+12,stop=ignite+INSERTION_FUEL/flow(THRUST,ISP);
    f.lunar={guided:true,next:0,pole:frame[2],bearing:BEARING,cutoff:null,
      maneuver:null,drops:[],events:[],outcome:null,closest:null,transferCutoff:stop,
      trail:[r],lastTrail:0,
      sequence:[[boostEnd,'jettison'],[stage,'separate'],[cutoff,'capsule-separate'],
        [ignite,'injection'],[stop,'cutoff']]};
    sync(f,table);
    return f;
  }
  function lunarDistance(table,f,t,q){
    const moon=table.body(epoch(f)+t,0);
    const dr=add(q.slice(0,3),moon.slice(0,3),-1),dv=add(q.slice(3,6),moon.slice(3,6),-1);
    const distance=norm(dr);
    return {height:distance-C.MOON_RADIUS,rate:dot(dr,dv)/distance,speed:norm(dv)};
  }
  function log(f,type,extra){
    f.lunar.events.push({type,t:f.t,altitude:f.orbit?.height, fuel:f.capsule.fuel,...extra});
  }
  function coreSettings(f){
    const engine=f.capsule.detached?{thrust:THRUST,isp:ISP}:P.ENGINES[f.craft.stages[f.active].engine];
    const fuel=f.capsule.detached?f.capsule.fuel:f.fuel[f.active];
    const force=f.controls.lit&&fuel>0&&!f.lunar.entry?engine.thrust*f.controls.throttle:0;
    return {force,fuel,flow:flow(force,engine.isp)};
  }
  function separate(f,type){
    const b=f.boosters;
    if(type==='jettison'&&P.attached(f)){
      const lateral=unit(cross(f.axis,f.lunar.pole)),side=cross(f.axis,lateral);
      for(const [x,y] of P.boosterMounts(f.craft.boosters)){
        const out=add(scale(lateral,x),side,y),q=f.eci.slice();
        for(let i=0;i<3;i++){q[i]+=2.4*out[i]+3.6*f.axis[i];q[i+3]+=2*out[i];}
        f.lunar.drops.push({eci:q,axis:f.axis,out,start:f.t,kind:'booster',dry:P.BOOSTER.dry,
          fuel:b.fuel,area:Math.PI*.65**2});
      }
      b.status='jettisoned';
    }else if(type==='separate'&&f.active===0&&!P.attached(f)){
      f.lunar.drops.push({eci:f.eci.slice(),kind:'lower',dry:P.dry(f.craft.stages[0])+60,
        fuel:f.fuel[0],area:P.CORE_DRAG_AREA,start:f.t});
      f.active=1;
      f.separated=true;
      f.fuel[0]=0;
      f.controls.lit=false;
    }else if(type==='capsule-separate'&&R.canSeparate(f)){
      const stage=f.craft.stages[f.active],fuel=f.fuel[f.active];
      const mass=P.dry(stage)+fuel,body=M.flight({payload:0,capsule:false,stages:[P.clone(stage)],separator:false});
      body.capsule=null;
      body.eci=f.eci.slice();
      body.axis=f.axis;
      body.t=f.t;
      body.status='flying';
      body.fuel=[fuel,null];
      body.auto={mode:'manual'};
      const gap=R.stageHeight(body)+.3, fraction=mass/(mass+R.mass(f));
      for(let i=0;i<3;i++){
        f.eci[i]+=gap*f.axis[i];
        f.eci[i+3]+=fraction*f.axis[i];
        body.eci[i+3]-=(1-fraction)*f.axis[i];
      }
      f.upperStage=body;
      f.fuel=f.fuel.map(value=>value===null?null:0);
      f.capsule.detached=true;
      f.controls={mode:'hold',angle:0,throttle:1,lit:false};
    }else return false;
    return true;
  }
  function plannedEvent(s,type,table,report){
    const f=s.flight;
    if(type==='capsule-separate'||type==='cutoff')f.controls.lit=false;
    if(['jettison','separate','capsule-separate'].includes(type)){
      if(!separate(f,type))throw Error('Invalid guidance separation');
      if(type==='separate')f.controls.lit=true;
      sync(f,table);
    }
    if(type==='injection')f.controls={mode:'prograde',angle:0,throttle:1,lit:true};
    log(f,type);
    report?.(type,f.t,f);
  }
  function guidanceAxis(f,t,q){
    const l=f.lunar;
    if(l.guided&&!f.capsule.detached)return localAxis(q.slice(0,3),l.pole,interp(t,PITCH)+interp(t,OFFSET),l.bearing);
    if(l.guided&&f.controls.lit)return burnAxis(q,'prograde');
    return f.axis;
  }
  function manualAxis(f,q){
    const l=f.lunar,mode=f.controls.mode;
    if(l.entry){
      const r=q.slice(0,3);
      return f.capsule.chute.phase!=='stowed'?unit(r):unit(add(C.spin(l.pole,r),q.slice(3),-1));
    }
    if(l.maneuver?.active||l.maneuver?.aligning)return burnAxis(q,l.maneuver.direction);
    if(l.returning&&!f.controls.lit&&f.orbit.height<600000){
      return unit(add(C.spin(l.pole,q.slice(0,3)),q.slice(3),-1));
    }
    if(l.guided&&f.capsule.detached&&l.next<l.sequence.length)return burnAxis(q,'prograde');
    if(mode==='tilt')return localAxis(q.slice(0,3),l.pole,f.controls.angle,l.bearing);
    if(DIRECTIONS.includes(mode))return burnAxis(q,mode);
    return f.axis;
  }
  function turningCapsule(f,target){
    return f.status==='flying'&&f.capsule.detached&&f.capsule.chute.phase==='stowed'&&
      !guidanceLocked(f)&&dot(f.axis,target)<TURN_THRESHOLD;
  }
  function dynamics(table,l,area,mass,force,axis){
    return (t,q)=>{
      const r=q.slice(0,3),v=q.slice(3,6),air=add(v,C.spin(l.pole,r),-1);
      const density=M.atmosphere(norm(r)-P.R);
      const acceleration=C.gravity(table,(l.epoch??LAUNCH)+t,r);
      if(density>0){
        const coefficient=.5*density*area*norm(air)/mass(t);
        for(let i=0;i<3;i++)acceleration[i]-=coefficient*air[i];
      }
      if(force>0){
        const direction=axis(t,q),a=force/mass(t);
        for(let i=0;i<3;i++)acceleration[i]+=a*direction[i];
      }
      return [...v,...acceleration];
    };
  }
  function advanceDrops(f,table,t,dt){
    const l=f.lunar;
    for(const body of [...l.drops,f.upperStage].filter(Boolean)){
      if(body.status==='impact')continue;
      const booster=body.kind==='booster',fuel=body.kind?body.fuel:body.fuel[0];
      const dry=body.kind?body.dry:P.dry(body.craft.stages[0]);
      const force=booster&&fuel>0?P.BOOSTER.thrust:0,rate=flow(force,P.BOOSTER.isp);
      const burning=force?Math.min(dt,fuel/rate):0;
      if(burning>0){
        const axis=time=>{
          const tilt=M.boosterTilt(time-body.start);
          return add(scale(body.axis,Math.cos(tilt)),body.out,Math.sin(tilt));
        };
        body.eci=C.rk4(dynamics(table,l,body.area,time=>dry+Math.max(0,fuel-rate*(time-t)),force,axis),t,body.eci,burning);
        body.fuel=Math.max(0,fuel-rate*burning);
      }
      if(dt>burning){
        const coast=dynamics(table,l,body.area??P.CORE_DRAG_AREA,()=>dry+(body.kind?body.fuel:fuel),0);
        let elapsed=burning;
        while(elapsed<dt-1e-9){
          const radius=norm(body.eci.slice(0,3));
          const chunk=Math.min(dt-elapsed,radius<P.R+120000?.1:radius<20000000?2:60);
          body.eci=C.rk4(coast,t+elapsed,body.eci,chunk);
          elapsed+=chunk;
          if(norm(body.eci.slice(0,3))<P.R){body.status='impact';break;}
        }
      }
      body.t=t+dt;
    }
  }
  function finish(s,reason,report){
    const f=s.flight;
    f.controls.lit=false;
    f.lunar.outcome=reason;
    f.lunar.maneuver=null;
    f.status=reason==='moon-impact'||reason==='earth-impact'?'impact':reason==='landed'||reason==='destroyed'?reason:'completed';
    s.phase='ended';
    log(f,reason);
    report?.(reason,f.t,f);
  }
  function returnAir(f,q){
    const r=q.slice(0,3),v=add(q.slice(3),C.spin(f.lunar.pole,r),-1);
    return {speed:norm(v),radial:dot(unit(r),v),altitude:norm(r)-P.R,air:v};
  }
  function returnClearance(f,q,t){
    const r=q.slice(0,3),radius=norm(r);
    if(radius>P.R+S.MAX_HEIGHT+1000)return radius-P.R;
    return S.clearance(surfaceVector(C.earthFrame(epoch(f)+t),r),t);
  }
  function recoveryArea(f,current){
    const {phase,since}=f.capsule.chute;
    const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    const age=f.t-since;
    const canopy=phase==='stowed'?0:phase==='drogue-opening'?8*smooth(age/2):
      phase==='drogue'?8:phase==='main-opening'?8+110.5*smooth(age/4):118.5;
    return 1.5+canopy*smooth(-current.radial/3);
  }
  function updateRecovery(f,dt,report){
    const r=returnAir(f,f.eci),rho=M.atmosphere(r.altitude),chute=f.capsule.chute;
    const pressure=.5*rho*r.speed*r.speed;
    const facing=-dot(f.axis,unit(r.air));
    const flux=Math.sqrt(rho)*(r.speed/7800)**3;
    f.lunar.air=r;
    f.lunar.thermal={flux,protected:facing>.8,shieldAngle:Math.acos(Math.max(-1,Math.min(1,facing)))/DEG};
    // shortcut: use normalized shield dose until material response and entry lift are modeled.
    f.capsule.heat=Math.min(1,f.capsule.heat+flux*dt*(facing>.8?.15:1.5));
    if(f.capsule.heat>=1)return 'destroyed';
    const set=phase=>{chute.phase=phase;chute.since=f.t;log(f,phase);report?.(phase,f.t,f);};
    const agl=r.altitude<16000?returnClearance(f,f.eci,f.t):r.altitude;
    if(chute.phase==='stowed'&&r.radial<0&&agl<=8000&&r.speed<=250&&pressure<=10000)set('drogue-opening');
    else if(chute.phase==='drogue-opening'&&f.t-chute.since>=2)chute.phase='drogue';
    else if(chute.phase==='drogue'&&r.radial<0&&agl<=3000&&r.speed<=80&&pressure<=4000)set('main-opening');
    else if(chute.phase==='main-opening'&&f.t-chute.since>=4)chute.phase='main';
    return null;
  }
  function processEvents(s,table,report){
    const f=s.flight,l=f.lunar;
    while(l.guided&&l.sequence[l.next]?.[0]<=f.t+1e-8){
      plannedEvent(s,l.sequence[l.next++][1],table,report);
    }
    if(l.cutoff!==null&&l.cutoff<=f.t+1e-8){
      l.cutoff=null;
      f.controls.lit=false;
      log(f,'cutoff');
      report?.('cutoff',f.t,f);
    }
    const m=l.maneuver;
    if(!m)return;
    if(!m.aligning&&f.t>=m.start-TURN_LEAD-1e-8)m.aligning=true;
    if(!m.active&&f.t>=m.start-1e-8){
      m.active=true;
      m.axis=burnAxis(f.eci,m.direction);
      m.before=f.capsule.fuel;
      f.controls.lit=true;
      f.controls.throttle=m.throttle;
      log(f,'correction-start',{direction:m.direction});
      report?.('correction-start',f.t,f);
    }
    if(m.active&&(f.t>=m.end-1e-8||f.capsule.fuel<=1e-8)){
      f.controls.lit=false;
      f.controls.throttle=m.previousThrottle;
      l.maneuver=null;
      f.controls.mode='hold';
      log(f,'correction-stop',{used:m.before-f.capsule.fuel});
      report?.('correction-stop',f.t,f);
    }
  }
  function step(s,request,table,report){
    const f=s.flight,l=f.lunar,t=f.t,end=flightLimit(f);
    processEvents(s,table,report);
    const core=coreSettings(f),booster=P.burning(f)?P.BOOSTER.thrust*f.craft.boosters:0;
    const boostFlow=flow(booster,P.BOOSTER.isp);
    const before=lunarDistance(table,f,t,f.eci);
    const radius=norm(f.eci.slice(0,3)),height=radius-P.R;
    const maneuver=l.maneuver,planned=l.guided?(l.sequence[l.next]?.[0]??Infinity):Infinity;
    const cut=l.cutoff??Infinity,deadline=maneuver?(maneuver.active?maneuver.end:maneuver.aligning?maneuver.start:maneuver.start-TURN_LEAD):Infinity;
    const guidedAscent=l.guided&&!f.capsule.detached;
    // A pitch slope changes at each knot. Sampling across a knot makes insertion depend on frame timing.
    const knot=guidedAscent?(PITCH.find(point=>point[0]>t+1e-8)?.[0]??Infinity):Infinity;
    const nearEarth=radius<=20000000;
    const target=manualAxis(f,f.eci),turning=turningCapsule(f,target);
    const fine=core.force>0||booster>0||height<120000||maneuver?.aligning||turning||f.upperStage?.status==='flying'&&f.upperStage.orbit?.height<120000;
    const maxStep=fine?.1:nearEarth?2:before.height<=NEAR?5:60;
    const dt=Math.min(request,maxStep,planned-t,cut-t,deadline-t,knot-t,
      core.flow?core.fuel/core.flow:Infinity,boostFlow?f.boosters.fuel*f.craft.boosters/boostFlow:Infinity,end-t);
    if(dt<=1e-9){
      if(t>=end-1e-8)finish(s,'ephemeris-end',report);
      return 0;
    }
    const guidedInjection=l.guided&&f.capsule.detached&&l.next<l.sequence.length&&f.controls.lit;
    const nextAxis=slew(f.axis,target,dt);
    const axis=guidedAscent||guidedInjection?(time,q)=>guidanceAxis(f,time,q):
      ()=>maneuver?.active?maneuver.axis:unit(add(f.axis,nextAxis));
    const m0=P.mass(f);
    const m=time=>m0-(core.flow+boostFlow)*(time-t);
    const area=l.entry?recoveryArea(f,returnAir(f,f.eci)):
      f.capsule.detached?1.5:P.CORE_DRAG_AREA+(P.attached(f)?.35*f.craft.boosters*Math.PI*.65**2:0);
    const derivative=dynamics(table,l,area,m,core.force+booster,axis);
    const at=duration=>C.rk4(derivative,t,f.eci,duration);
    let h=dt,q=at(dt),after=lunarDistance(table,f,t+dt,q),reason;
    const locate=predicate=>{
      let lo=0,hi=dt;
      for(let i=0;i<27;i++){
        const middle=(lo+hi)/2;
        if(predicate(at(middle),middle))hi=middle;
        else lo=middle;
      }
      return hi;
    };
    if(l.entry&&returnClearance(f,q,t+dt)<=0){
      h=locate((state,time)=>returnClearance(f,state,t+time)<=0);
      const contact=returnAir(f,at(h));
      f.capsule.touchdown={normal:Math.abs(contact.radial),tangent:Math.sqrt(Math.max(0,contact.speed**2-contact.radial**2)),slope:0};
      reason=contact.speed<20?'landed':'earth-impact';
    }else if(after.height<=0){
      h=locate((state,time)=>lunarDistance(table,f,t+time,state).height<=0);
      reason='moon-impact';
    }else if(!l.entry&&f.capsule.detached&&height>120000&&norm(q.slice(0,3))-P.R<=120000){
      h=locate(state=>norm(state.slice(0,3))-P.R<=120000);
      reason='return-entry';
    }else if(f.status!=='pad'&&norm(q.slice(0,3))<P.R){
      h=locate(state=>norm(state.slice(0,3))<=P.R);
      reason='earth-impact';
    }else if(f.capsule.detached&&before.rate<0&&after.rate>=0){
      const time=locate((state,time)=>lunarDistance(table,f,t+time,state).rate>=0);
      const sample=lunarDistance(table,f,t+time,at(time));
      if(!l.closest||sample.height<l.closest.height){
        l.closest={...sample,t:t+time,fuel:f.capsule.fuel-core.flow*time};
        if(sample.height<=NEAR)report?.('lunar-closest',t+time,f);
      }
    }else if(!l.returning&&l.closest?.height<=NEAR&&before.height<=NEAR&&after.height>NEAR){
      h=locate((state,time)=>lunarDistance(table,f,t+time,state).height>NEAR);
      reason=l.freeReturn?'return-coast':l.closest.height>=3000000&&l.closest.height<=10000000?'flyby':'lunar-pass';
    }
    if(h!==dt){q=at(h);after=lunarDistance(table,f,t+h,q);}
    if(f.status==='pad'&&norm(q.slice(0,3))<=P.R){
      const frame=C.earthFrame(epoch(f)+t+h),r=scale(C.fromColumns(frame,station),P.R);
      q=[...r,...C.spin(frame[2],r)];
    }else if(f.status==='pad'){
      f.status='flying';
      report?.('liftoff',t+h,f);
    }
    f.rcsDirection=0;
    if(turning){
      // shortcut: show the nearest existing jet pair until the capsule has a three-axis nozzle model.
      const turn=cross(f.axis,nextAxis),radial=unit(f.eci.slice(0,3));
      const pitchAxis=cross(radial,localAxis(f.eci.slice(0,3),l.pole,90,l.bearing));
      f.rcsDirection=Math.sign(dot(turn,pitchAxis))||1;
    }
    f.axis=guidedAscent||guidedInjection?axis(t+h,q):nextAxis;
    advanceDrops(f,table,t,h);
    f.eci=q;
    f.t=t+h;
    if(reason||f.t-l.lastTrail>=(f.t<1000?5:l.trailInterval??1400)){
      if(l.trail.length>=4096){
        l.trail=l.trail.filter((_,i)=>i%2===0);
        l.trailInterval=(l.trailInterval??1400)*2;
      }
      l.trail.push(q.slice(0,3));
      l.lastTrail=f.t;
    }
    f.maxHeight=Math.max(f.maxHeight,norm(q.slice(0,3))-P.R);
    const fuel=Math.max(0,core.fuel-core.flow*h);
    if(f.capsule.detached)f.capsule.fuel=fuel;
    else f.fuel[f.active]=fuel;
    if(fuel<=1e-8){
      f.controls.lit=false;
      if(l.cutoff>f.t+1e-8)l.cutoff=null;
    }
    if(boostFlow){
      const reserve=Math.max(0,f.boosters.fuel-boostFlow*h/f.craft.boosters);
      f.boosters.fuel=reserve;
      if(reserve<=1e-8)f.boosters.status='spent';
    }
    if(l.entry){
      const thermalReason=updateRecovery(f,h,report);
      if(!reason)reason=thermalReason;
    }
    sync(f,table);
    if(reason==='return-entry'||reason==='return-coast'){
      if(reason==='return-entry'){
        const air=returnAir(f,f.eci);
        l.entry={t:f.t,speed:air.speed,angle:Math.asin(air.radial/air.speed)/DEG};
        f.controls.lit=false;
        f.capsule.chute.armed=true;
        l.cutoff=l.maneuver=null;
      }else l.returning=true;
      log(f,reason);
      report?.(reason,f.t,f);
      reason=null;
    }
    if(reason==='landed'){
      const r=f.eci.slice(0,3);
      f.eci=[...r,...C.spin(l.pole,r)];
      sync(f,table);
    }
    if(reason)finish(s,reason,report);
    else{
      processEvents(s,table,report);
      if(t+h>=end-1e-8)finish(s,'ephemeris-end',report);
      else if(f.status!=='pad')s.phase=f.controls.lit||P.burning(f)?'ascent':'coast';
    }
    return h;
  }
  function advance(s,seconds,budget,table,report){
    const start=s.flight.t;
    let steps=0;
    while(s.phase!=='ended'&&steps<budget&&seconds-(s.flight.t-start)>1e-9){
      if(!step(s,seconds-(s.flight.t-start),table,report))break;
      steps++;
    }
    return {elapsed:s.flight.t-start,steps};
  }
  function transfer(table,freeReturn=false){
    const s={flight:open(preset(),table),phase:freeReturn?'coast':'pad'};
    if(freeReturn){
      const f=s.flight;
      f.eci=RETURN_STATE.slice();
      f.axis=unit(f.eci.slice(3));
      f.active=1;
      f.separated=f.capsule.detached=true;
      f.capsule.fuel=30-INSERTION_FUEL;
      f.boosters.status='jettisoned';
      f.fuel=[0,0];
      f.status='flying';
      Object.assign(f.lunar,{freeReturn:true,epoch:RETURN_EPOCH,pole:C.earthFrame(RETURN_EPOCH)[2],mapAxes:null,
        guided:false,sequence:[],trail:[f.eci.slice(0,3)]});
      sync(f,table);
    }else command(s,{type:'ignite'},table);
    // Reuse the verified launch and injection, including propellant and the live discarded stages.
    advance(s,TRANSFER_START,20000,table);
    const f=s.flight;
    if(s.phase!=='coast'||Math.abs(f.t-TRANSFER_START)>1e-7||!f.capsule.detached||f.controls.lit){
      throw Error('Unable to prepare the lunar transfer');
    }
    f.lunar.shortcut=true;
    return f;
  }
  const guidanceLocked=f=>f.lunar.guided&&f.lunar.next<f.lunar.sequence.length;
  function command(s,action,table,report){
    const f=s.flight,l=f.lunar;
    if(s.phase==='ended'||l.entry)return false;
    const type=action.type,value=action.value;
    if(type==='manual'&&guidanceLocked(f)){
      l.guided=false;
      f.controls.angle=f.pitch;
    }else if(type==='ignite'&&(!guidanceLocked(f)||f.status==='pad')&&!f.controls.lit&&coreSettings(f).fuel>0&&!l.maneuver){
      f.controls.lit=true;
      if(f.boosters?.status==='ready')f.boosters.status='burning';
      s.phase='ascent';
      report?.('ignite',f.t,f);
    }else if(type==='stop'&&f.controls.lit){
      l.guided=false;
      if(l.maneuver)f.controls.throttle=l.maneuver.previousThrottle;
      f.controls.lit=false;
      l.cutoff=l.maneuver=null;
      log(f,'cutoff');
      report?.('cutoff',f.t,f);
    }else if(type==='control'&&!guidanceLocked(f)&&!l.maneuver){
      if(action.key==='throttle'&&Number.isFinite(value)&&value>=0&&value<=1)f.controls.throttle=value;
      else if(action.key==='angle'&&Number.isFinite(value)&&value>=0&&value<360)Object.assign(f.controls,{mode:'tilt',angle:value});
      else if(action.key==='bearing'&&Number.isFinite(value)&&value>=0&&value<360)l.bearing=value;
      else if(action.key==='mode'&&DIRECTIONS.includes(value))f.controls.mode=value;
      else return false;
    }else if(type==='lunar-cutoff'&&!guidanceLocked(f)&&f.controls.lit&&!l.maneuver&&Number.isFinite(value)&&value>f.t&&value<=flightLimit(f)){
      l.cutoff=value;
    }else if(type==='lunar-cancel'&&l.cutoff!==null){
      l.cutoff=null;
    }else if(type==='lunar-cancel'&&l.maneuver&&!l.maneuver.active){
      l.maneuver=null;
    }else if(type==='lunar-correction'&&f.capsule.detached&&!guidanceLocked(f)&&!f.controls.lit&&!l.maneuver&&f.orbit.height>=120000){
      const {start,duration,throttle,direction}=action;
      if(!Number.isFinite(start)||start<f.t+TURN_LEAD+.1||!Number.isFinite(duration)||duration<.01||
        start+duration>flightLimit(f)||!Number.isFinite(throttle)||throttle<.01||throttle>1||!DIRECTIONS.includes(direction)||
        flow(THRUST*throttle,ISP)*duration>f.capsule.fuel||norm(burnAxis(f.eci,direction))<.5)return false;
      l.maneuver={start,end:start+duration,direction,throttle,previousThrottle:f.controls.throttle};
    }else if(!guidanceLocked(f)&&f.status==='flying'&&!l.maneuver&&separate(f,type)){
      l.cutoff=null;
      log(f,type);
      report?.(type,f.t,f);
    }else return false;
    sync(f,table);
    return true;
  }
  function warpLimit(f){
    if(f.t<6&&!f.separated)return 1;
    if(f.lunar.entry)return f.capsule.chute.phase==='stowed'?20:100;
    if(f.controls.lit||P.burning(f)||f.orbit.height<120000||f.lunar.maneuver?.aligning)return 20;
    if(f.controls.mode==='tilt'&&turningCapsule(f,manualAxis(f,f.eci)))return 5;
    return f.capsule.detached&&f.orbit.height>=20000000&&f.moon.height>ENCOUNTER_WARP_HEIGHT
      ?FAST_WARP:1000;
  }
  function* forecast(f,table){
    const start=f.t,end=Math.min(start+FORECAST_SPAN,flightLimit(f)),l=f.lunar,position=q=>q.slice(0,3);
    const derivative=(t,q)=>[...q.slice(3),...C.gravity(table,epoch(f)+t,position(q))];
    let t=start,q=f.eci.slice(),moon=lunarDistance(table,f,t,q),closest=null,entry=null;
    const points=[position(q)],times=[t];
    let sampled=start,count=0;
    while(t<end){
      const earth=norm(position(q))-P.R;
      const dt=Math.min(end-t,earth<14000000?2:moon.height<NEAR?15:120);
      const at=h=>C.rk4(derivative,t,q,h),next=at(dt);
      const sample=lunarDistance(table,f,t+dt,next);
      if(norm(position(next))-P.R<=120000||sample.height<=0){
        if(sample.height>0){
          let lo=0,hi=dt;
          for(let i=0;i<22;i++){
            const mid=(lo+hi)/2;
            if(norm(position(at(mid)))-P.R<=120000)hi=mid;
            else lo=mid;
          }
          entry={t:t+hi};
          points.push(position(at(hi)));
          times.push(entry.t);
        }else{points.push(position(next));times.push(t+dt);}
        break;
      }
      if(moon.rate<0&&sample.rate>=0){
        let lo=0,hi=dt;
        for(let i=0;i<20;i++){
          const mid=(lo+hi)/2;
          if(lunarDistance(table,f,t+mid,at(mid)).rate>=0)hi=mid;
          else lo=mid;
        }
        const nearest=at(hi);
        const minimum={...lunarDistance(table,f,t+hi,nearest),t:t+hi,position:position(nearest)};
        if(!closest||minimum.height<closest.height)closest=minimum;
      }
      const ends=!l.freeReturn&&closest?.height<=NEAR&&moon.height<=NEAR&&sample.height>NEAR;
      t+=dt;q=next;moon=sample;
      if(t-sampled>=900||ends||t>=end){points.push(position(q));times.push(t);sampled=t;}
      if(ends)break;
      if(++count%48===0)yield;
    }
    return {points,times,closest,entry};
  }
  function skyFrame(f){return {sun:f.sky.sun,moon:f.sky.moon,moonNorth:f.sky.moonNorth,angle:0};}
  function trajectory(f,points){return points.map(point=>{
    const [right,up,depth]=C.toColumns(f.lunar.mapAxes,point);
    return [up,right,depth];
  });}
  const flightUtc=f=>C.utc(epoch(f)+f.t);
  return Object.freeze({LAUNCH,FAST_WARP,MOON_RADIUS:C.MOON_RADIUS,utc:C.utc,flightUtc,flightLimit,preset,compatible,open,transfer,advance,command,warpLimit,guidanceLocked,skyFrame,trajectory,forecast});
});
