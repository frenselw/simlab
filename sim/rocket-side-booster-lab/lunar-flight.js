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
  // Launch guidance targeted offline for a far-side flyby and an inland touchdown.
  const GROUND_RETURN={epoch:3210876.071472819,bearing:148.1440749642866,fuel:17.693382291934025,pitchTrim:3.3915660663192986};
  const LANDER={dry:220,fuel:260,thrust:3000,isp:300};
  const LANDING_LAUNCHER={scale:3,upper:{dry:1400,fuel:14000,thrust:240000,isp:410}};
  const MOON_MU=4.902800118e12,ORBIT_LOW=80000,ORBIT_HIGH=120000,ORBIT_SETTLE=60;
  const LANDING_FUEL_MIN=250,FOOT_HEIGHT=.55,FOOT_SPREAD=1.85;
  const LANDING_PROFILE={
    epoch:3211006.4838839234,bearing:151.61767998629648,cutoff:338.1127358466407,
    capture:417710.5728963027,stop:417758.16972739715,circularize:438803.03194553684,orbit:438823.94045052305
  };
  const NEAR=80000000,FORECAST_SPAN=10*C.DAY,TURN_LEAD=16.5,TURN_THRESHOLD=Math.cos(.15*DEG);
  const PATH_SWEEP=DEG,MAX_PATH_POINTS=4096;
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
  const RETURN_PITCH_TRIM=[[60,0],[120,1],[230,1],[270,0]];
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
  function pointBody(body,axis){
    const from=body.axis,right=body.bodyRight,turn=cross(from,axis),cosine=dot(from,axis);
    // Transport the transverse axis with the nose instead of rebuilding roll from local vertical.
    const moved=cosine>-1+1e-12?add(add(right,cross(turn,right)),cross(turn,cross(turn,right)),1/(1+cosine)):right;
    body.bodyRight=unit(add(moved,axis,-dot(moved,axis)));
    body.axis=axis;
    return unit(turn);
  }
  function capsuleTurn(f,target,dt){
    const velocity=f.turnVelocity??[0,0,0],normal=cross(f.axis,target);
    const angle=Math.atan2(norm(normal),dot(f.axis,target));
    const axis=norm(normal)>1e-10?unit(normal):norm(velocity)>1e-10?unit(velocity):f.bodyRight;
    const along=dot(velocity,axis),side=add(velocity,axis,-along),sideSpeed=norm(side);
    const turn={attitude:0,angularVelocity:along,controls:{mode:'tilt',angle:angle/DEG},state:[1,0,0,0,0,0]};
    // Use the same acceleration, coasting and counterfire controller as Earth flight.
    R.turn(turn,dt,Math.sqrt(Math.max(0,(12*DEG)**2-sideSpeed**2)));
    const sideAfter=scale(side,sideSpeed?Math.max(0,1-20*DEG*dt/sideSpeed):0);
    const displacement=add(scale(axis,Math.atan2(Math.sin(turn.attitude),Math.cos(turn.attitude))),add(side,sideAfter),dt/2);
    const rotation=norm(displacement),pivot=unit(displacement);
    const rotate=v=>add(add(scale(v,Math.cos(rotation)),cross(pivot,v),Math.sin(rotation)),pivot,dot(pivot,v)*(1-Math.cos(rotation)));
    const attitude=unit(rotate(f.axis)),right=unit(rotate(f.bodyRight));
    return {axis:attitude,right,velocity:add(scale(axis,turn.angularVelocity),sideAfter),
      torque:add(scale(axis,turn.rcsDirection),unit(side),-Math.min(1,sideSpeed/(20*DEG*dt)))};
  }
  function surfaceVector(frame,v){
    const [east,up,north]=S.fromGeocentric(...C.toColumns(frame,v));
    return [up,east,north];
  }
  function elements(q,mu=P.MU,surface=P.R){
    const r=q.slice(0,3),v=q.slice(3,6),radius=norm(r),speed=norm(v);
    const momentum=cross(r,v),energy=speed*speed/2-mu/radius;
    const eccentricity=norm(add(scale(cross(v,momentum),1/mu),unit(r),-1));
    const a=energy<0?-mu/(2*energy):null;
    return {height:radius-surface,speed,radial:dot(r,v)/radius,tangential:norm(momentum)/radius,
      bound:a!==null,hp:a===null?null:a*(1-eccentricity)-surface,ha:a===null?null:a*(1+eccentricity)-surface,
      period:a===null?null:2*Math.PI*Math.sqrt(a**3/mu),e:eccentricity};
  }
  const moonRelative=(table,f,t,q)=>add(q,table.body(epoch(f)+t,0),-1);
  const moonOrbit=(table,f,t,q)=>elements(moonRelative(table,f,t,q),MOON_MU,C.MOON_RADIUS);
  const stable=o=>o.bound&&o.hp>=ORBIT_LOW&&o.ha<=ORBIT_HIGH;
  function moonMotion(table,f,t,q){
    const center=table.body(epoch(f)+t,0),relative=add(q,center,-1);
    const r=relative.slice(0,3),up=unit(r),centerPosition=center.slice(0,3);
    const spin=scale(cross(centerPosition,center.slice(3)),1/norm(centerPosition)**2);
    const velocity=add(relative.slice(3),cross(spin,r),-1);
    return {r,up,velocity};
  }
  function moonSurface(table,f,t,q){
    const {r,up,velocity}=moonMotion(table,f,t,q);
    const vertical=dot(up,velocity),horizontal=norm(add(velocity,up,-vertical));
    const tilt=Math.acos(Math.max(-1,Math.min(1,dot(f.axis,up))))/DEG;
    const base=add(r,f.axis,-FOOT_HEIGHT),crossbar=cross(f.axis,f.bodyRight);
    const clearance=Math.min(...[-1,1].flatMap(a=>[-1,1].map(b=>
      norm(add(add(base,f.bodyRight,a*FOOT_SPREAD),crossbar,b*FOOT_SPREAD))-C.MOON_RADIUS)));
    return {height:Math.max(0,clearance),clearance,vertical,horizontal,tilt};
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
      const vertical=body===f&&f.lunar.landingMission&&f.capsule.detached?moonMotion(table,f,f.t,f.eci).up:unit(r);
      body.pitch=Math.acos(Math.max(-1,Math.min(1,dot(vertical,body.axis))))/DEG;
      body.axisSurface=axis;
      body.rightSurface=surfaceVector(frame,body.bodyRight);
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
    if(f.lunar.landingMission){
      Object.assign(f.moon,moonOrbit(table,f,f.t,f.eci));
      if(f.capsule.detached)f.moon.surface=f.lunar.touchdown??moonSurface(table,f,f.t,f.eci);
    }
  }
  const flow=(force,isp)=>force/(P.G0*isp);
  const boostEnd=P.BOOSTER.fuel/flow(P.BOOSTER.thrust,P.BOOSTER.isp);
  const landingCapacity=f=>({lower:P.capacity(f.craft.stages[0])*LANDING_LAUNCHER.scale,
    upper:LANDING_LAUNCHER.upper.fuel,booster:P.BOOSTER.fuel*LANDING_LAUNCHER.scale});
  function open(craft,table,groundReturn=false){
    if(!compatible(craft))throw Error('The lunar demonstrator requires the reference rocket');
    const f=M.flight(craft);
    const profile=groundReturn?GROUND_RETURN:null;
    const frame=C.earthFrame(profile?.epoch??LAUNCH),up=C.fromColumns(frame,station),r=scale(up,P.R);
    f.eci=[...r,...C.spin(frame[2],r)];
    f.axis=up;
    f.bodyRight=unit(cross(frame[2],up));
    const lower=P.ENGINES[craft.stages[0].engine],upper=P.ENGINES[craft.stages[1].engine];
    const stage=f.fuel[0]/flow(lower.thrust,lower.isp),cutoff=stage+f.fuel[1]/flow(upper.thrust,upper.isp);
    const ignite=cutoff+12,stop=ignite+(profile?.fuel??INSERTION_FUEL)/flow(THRUST,ISP);
    f.lunar={groundReturn,freeReturn:groundReturn,epoch:profile?.epoch,
      guided:true,next:0,pole:frame[2],bearing:profile?.bearing??BEARING,cutoff:null,
      maneuver:null,drops:[],events:[],outcome:null,closest:null,transferCutoff:stop,
      trail:[r],lastTrail:0,
      sequence:[[boostEnd,'jettison'],[stage,'separate'],[cutoff,'capsule-separate'],
        [ignite,'injection'],[stop,'cutoff']]};
    sync(f,table);
    return f;
  }
  function openLanding(table,profile=LANDING_PROFILE){
    const f=open(preset(),table);
    const frame=C.earthFrame(profile.epoch),up=C.fromColumns(frame,station),r=scale(up,P.R);
    f.eci=[...r,...C.spin(frame[2],r)];
    f.axis=up;
    f.bodyRight=unit(cross(frame[2],up));
    const lower=P.ENGINES[0],stage=P.capacity(f.craft.stages[0])/flow(lower.thrust,lower.isp);
    const capacity=landingCapacity(f);
    f.fuel=[capacity.lower,capacity.upper];
    f.boosters.fuel=capacity.booster;
    f.capsule.fuel=LANDER.fuel;
    Object.assign(f.lunar,{landingMission:true,epoch:profile.epoch,pole:frame[2],mapAxes:null,bearing:profile.bearing,
      transferCutoff:profile.cutoff,trail:[r],handoff:null,
      sequence:[[boostEnd,'jettison'],[stage,'separate'],[profile.cutoff,'cutoff'],
        [profile.capture-20,'moon-align'],[profile.capture,'moon-capture'],[profile.stop,'moon-cutoff'],
        [profile.circularize-20,'moon-align'],[profile.circularize,'moon-capture'],[profile.orbit,'moon-cutoff'],
        [profile.orbit+20,'capsule-separate'],[profile.orbit+20+ORBIT_SETTLE,'moon-verify']]});
    sync(f,table);
    return f;
  }
  function lunarDistance(table,f,t,q){
    const moon=table.body(epoch(f)+t,0);
    const dr=add(q.slice(0,3),moon.slice(0,3),-1),dv=add(q.slice(3,6),moon.slice(3,6),-1);
    const distance=norm(dr);
    return {height:distance-C.MOON_RADIUS,rate:dot(dr,dv)/distance,speed:norm(dv)};
  }
  function pathSampleDue(q,moon,last,elapsed,maximum,stride){
    const moonRate=Math.sqrt(Math.max(0,moon.speed**2-moon.rate**2))/(moon.height+C.MOON_RADIUS);
    if(elapsed>=Math.min(maximum,PATH_SWEEP/moonRate)*stride)return true;
    const r=q.slice(0,3),sweep=PATH_SWEEP*stride;
    return sweep<Math.PI&&dot(last,r)<norm(last)*norm(r)*Math.cos(sweep);
  }
  function log(f,type,extra){
    f.lunar.events.push({type,t:f.t,altitude:f.orbit?.height, fuel:f.capsule.fuel,...extra});
  }
  function coreSettings(f){
    const landing=f.lunar.landingMission;
    const engine=f.capsule.detached?(landing?LANDER:{thrust:THRUST,isp:ISP}):
      landing&&f.active===1?LANDING_LAUNCHER.upper:P.ENGINES[f.craft.stages[f.active].engine];
    const fuel=f.capsule.detached?f.capsule.fuel:f.fuel[f.active];
    const multiplier=landing&&!f.capsule.detached&&f.active===0?LANDING_LAUNCHER.scale:1;
    const force=f.controls.lit&&fuel>0&&!f.lunar.entry?multiplier*engine.thrust*f.controls.throttle:0;
    return {force,fuel,flow:flow(force,engine.isp)};
  }
  function flightMass(f){
    if(!f.lunar.landingMission)return P.mass(f);
    const spec=LANDING_LAUNCHER,lander=LANDER.dry+f.capsule.fuel;
    if(f.capsule.detached)return lander;
    const upper=spec.upper.dry+f.fuel[1];
    if(f.separated)return upper+lander;
    const booster=P.attached(f)?f.craft.boosters*(P.BOOSTER.dry*spec.scale+f.boosters.fuel):0;
    return upper+lander+spec.scale*(P.dry(f.craft.stages[0])+60)+f.fuel[0]+booster;
  }
  function separate(f,type){
    const b=f.boosters,launcher=f.lunar.landingMission?LANDING_LAUNCHER:null,mult=launcher?.scale??1;
    if(type==='jettison'&&P.attached(f)){
      const lateral=unit(cross(f.axis,f.lunar.pole)),side=cross(f.axis,lateral);
      for(const [x,y] of P.boosterMounts(f.craft.boosters)){
        const out=add(scale(lateral,x),side,y),q=f.eci.slice();
        for(let i=0;i<3;i++){q[i]+=2.4*out[i]+3.6*f.axis[i];q[i+3]+=2*out[i];}
        f.lunar.drops.push({eci:q,axis:f.axis,out,start:f.t,kind:'booster',dry:P.BOOSTER.dry*mult,
          fuel:b.fuel,area:Math.PI*.65**2*mult**(2/3),thrust:P.BOOSTER.thrust*mult});
      }
      b.status='jettisoned';
    }else if(type==='separate'&&f.active===0&&!P.attached(f)){
      f.lunar.drops.push({eci:f.eci.slice(),kind:'lower',dry:(P.dry(f.craft.stages[0])+60)*mult,
        fuel:f.fuel[0],area:P.CORE_DRAG_AREA,start:f.t});
      f.active=1;
      f.separated=true;
      f.fuel[0]=0;
      f.controls.lit=false;
    }else if(type==='capsule-separate'&&R.canSeparate(f)){
      const stage=f.craft.stages[f.active],fuel=f.fuel[f.active];
      const mass=(launcher?.upper.dry??P.dry(stage))+fuel,body=M.flight({payload:0,capsule:false,stages:[P.clone(stage)],separator:false});
      body.capsule=null;
      body.eci=f.eci.slice();
      body.axis=f.axis;
      body.bodyRight=f.bodyRight;
      body.t=f.t;
      body.status='flying';
      body.fuel=[fuel,null];
      body.auto={mode:'manual'};
      const gap=R.stageHeight(body)+.3, fraction=mass/(mass+(launcher?LANDER.dry+f.capsule.fuel:R.mass(f)));
      if(launcher)body.dry=launcher.upper.dry;
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
    const l=f.lunar;
    if(type==='moon-align')l.capturePhase='align';
    if(type==='moon-capture'){
      l.capturePhase='burn';
      f.controls.lit=true;
      f.controls.throttle=.2;
    }
    if(type==='moon-cutoff'){
      l.capturePhase='settle';
      f.controls.lit=false;
      f.controls.throttle=1;
    }
    if(type==='moon-verify'){
      if(!f.capsule.detached||f.controls.lit||l.unstable||f.capsule.fuel<LANDING_FUEL_MIN||
        !verifyMoonOrbit(f,table)){
        finish(s,'moon-orbit-failed',report);
        return;
      }
      l.handoff='ready';
      f.controls.throttle=0;
      f.controls.mode='hold';
    }
    if(type==='capsule-separate'||type==='cutoff')f.controls.lit=false;
    if(type==='cutoff'&&f.lunar.groundReturn)f.controls.mode='hold';
    if(['jettison','separate','capsule-separate'].includes(type)){
      if(!separate(f,type))throw Error('Invalid guidance separation');
      if(type==='separate')f.controls.lit=true;
      sync(f,table);
    }
    if(type==='injection')f.controls={mode:'prograde',angle:0,throttle:1,lit:true};
    log(f,type);
    report?.(type,f.t,f);
  }
  function guidanceAxis(f,t,q,table){
    const l=f.lunar;
    if(l.landingMission){
      if(l.capturePhase==='align'||l.capturePhase==='burn')return burnAxis(moonRelative(table,f,t,q),'retrograde');
      if(t>=l.transferCutoff)return f.axis;
    }
    if(l.guided&&!f.capsule.detached){
      const trim=(l.landingMission?2:l.groundReturn?GROUND_RETURN.pitchTrim:0)*interp(t,RETURN_PITCH_TRIM);
      return localAxis(q.slice(0,3),l.pole,interp(t,PITCH)+interp(t,OFFSET)+trim,l.bearing);
    }
    if(l.guided&&f.controls.lit)return burnAxis(q,'prograde');
    return f.axis;
  }
  function manualAxis(f,q){
    const l=f.lunar,mode=f.controls.mode;
    if(l.entry){
      const r=q.slice(0,3);
      return f.capsule.chute.phase!=='stowed'?unit(r):unit(add(C.spin(l.pole,r),q.slice(3),-1));
    }
    if(l.maneuver?.active)return l.maneuver.axis;
    if(l.maneuver?.aligning)return burnAxis(q,l.maneuver.direction);
    if(l.returning&&!f.controls.lit&&f.orbit.height<600000){
      return unit(add(C.spin(l.pole,q.slice(0,3)),q.slice(3),-1));
    }
    if(l.guided&&f.capsule.detached&&l.next<l.sequence.length)return burnAxis(q,'prograde');
    if(mode==='tilt')return localAxis(q.slice(0,3),l.pole,f.controls.angle,l.bearing);
    if(DIRECTIONS.includes(mode))return burnAxis(q,mode);
    return f.axis;
  }
  function lunarManualAxis(f,table,q){
    const relative=moonRelative(table,f,f.t,q),mode=f.controls.mode;
    if(mode==='tilt'){
      const {up,velocity}=moonMotion(table,f,f.t,q),along=add(velocity,up,-dot(up,velocity));
      const horizontal=norm(along)>.05?unit(along):unit(add(f.bodyRight,up,-dot(up,f.bodyRight)));
      return unit(add(scale(up,Math.cos(f.controls.angle*DEG)),horizontal,Math.sin(f.controls.angle*DEG)));
    }
    return DIRECTIONS.includes(mode)?burnAxis(relative,mode):f.axis;
  }
  function turningCapsule(f,target){
    return f.status==='flying'&&f.capsule.detached&&f.capsule.chute.phase==='stowed'&&
      !guidanceLocked(f)&&(dot(f.axis,target)<TURN_THRESHOLD||norm(f.turnVelocity??[0,0,0])>1e-8);
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
      const dry=body.dry??P.dry(body.craft.stages[0]);
      const force=booster&&fuel>0?body.thrust??P.BOOSTER.thrust:0,rate=flow(force,P.BOOSTER.isp);
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
    f.status=['moon-impact','earth-impact','moon-hard-landing'].includes(reason)?'impact':
      reason==='moon-landed'?'landed':reason==='landed'||reason==='destroyed'?reason:'completed';
    s.phase='ended';
    log(f,reason);
    report?.(reason,f.t,f);
  }
  function verifyMoonOrbit(f,table){
    let t=f.t,q=f.eci;
    const start=moonOrbit(table,f,t,q);
    if(!stable(start))return false;
    const initial=unit(moonRelative(table,f,t,q).slice(0,3));
    let last=initial,sweep=0;
    const drift=(time,state)=>[...state.slice(3),...C.gravity(table,epoch(f)+time,state.slice(0,3))];
    const end=t+1.02*start.period;
    if(end>=flightLimit(f))return false;
    while(t<end&&sweep<2*Math.PI){
      const step=Math.min(10,end-t);
      q=C.rk4(drift,t,q,step);
      t+=step;
      if(!stable(moonOrbit(table,f,t,q)))return false;
      const radial=unit(moonRelative(table,f,t,q).slice(0,3));
      sweep+=Math.atan2(norm(cross(last,radial)),dot(last,radial));
      last=radial;
    }
    return sweep>=2*Math.PI;
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
    const agl=r.agl=r.altitude<16000?returnClearance(f,f.eci,f.t):r.altitude;
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
      if(l.handoff||s.phase==='ended')return;
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
      if(l.groundReturn)l.modified=true;
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
    if(l.handoff==='ready'||s.phase==='ended')return 0;
    const mult=l.landingMission?LANDING_LAUNCHER.scale:1;
    const core=coreSettings(f),booster=P.burning(f)?mult*P.BOOSTER.thrust*f.craft.boosters:0;
    const boostFlow=flow(booster,P.BOOSTER.isp);
    const before=lunarDistance(table,f,t,f.eci);
    const radius=norm(f.eci.slice(0,3)),height=radius-P.R;
    const maneuver=l.maneuver,planned=l.guided?(l.sequence[l.next]?.[0]??Infinity):Infinity;
    const cut=l.cutoff??Infinity,deadline=maneuver?(maneuver.active?maneuver.end:maneuver.aligning?maneuver.start:maneuver.start-TURN_LEAD):Infinity;
    const guidedAscent=l.guided&&!f.capsule.detached&&(!l.landingMission||t<l.transferCutoff);
    // A pitch slope changes at each knot. Sampling across a knot makes insertion depend on frame timing.
    const pitchKnot=guidedAscent?(PITCH.find(point=>point[0]>t+1e-8)?.[0]??Infinity):Infinity;
    const trimEnd=RETURN_PITCH_TRIM.at(-1)[0];
    const knot=guidedAscent&&(l.groundReturn||l.landingMission)&&t<trimEnd-1e-8?Math.min(pitchKnot,trimEnd):pitchKnot;
    const nearEarth=radius<=20000000;
    const capture=l.capturePhase==='burn',align=l.capturePhase==='align';
    const target=l.landingMission?(align||capture?guidanceAxis(f,t,f.eci,table):l.handoff==='manual'?lunarManualAxis(f,table,f.eci):f.axis):manualAxis(f,f.eci);
    const turning=turningCapsule(f,target);
    const fine=core.force>0||booster>0||height<120000||maneuver?.aligning||turning||align||
      l.handoff==='manual'&&before.height<3000||f.upperStage?.status==='flying'&&f.upperStage.orbit?.height<120000;
    const maxStep=fine?.1:nearEarth?2:before.height<=NEAR?5:60;
    const dt=Math.min(request,maxStep,planned-t,cut-t,deadline-t,knot-t,
      core.flow?core.fuel/core.flow:Infinity,boostFlow?f.boosters.fuel*f.craft.boosters/boostFlow:Infinity,end-t);
    if(dt<=1e-9){
      if(t>=end-1e-8)finish(s,'ephemeris-end',report);
      return 0;
    }
    const guidedInjection=!l.landingMission&&l.guided&&f.capsule.detached&&l.next<l.sequence.length&&f.controls.lit;
    const inertialTurn=f.capsule.detached&&!guidedInjection;
    const turn=inertialTurn?capsuleTurn(f,target,dt):null;
    const nextAxis=turn?turn.axis:slew(f.axis,target,dt);
    const axis=guidedAscent||guidedInjection||capture?(time,q)=>guidanceAxis(f,time,q,table):
      ()=>maneuver?.active?maneuver.axis:unit(add(f.axis,nextAxis));
    const m0=flightMass(f);
    const m=time=>m0-(core.flow+boostFlow)*(time-t);
    const area=l.entry?recoveryArea(f,returnAir(f,f.eci)):
      f.capsule.detached?1.5:(P.CORE_DRAG_AREA+(P.attached(f)?.35*f.craft.boosters*Math.PI*.65**2:0))*mult**(2/3);
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
      const state=at(h),contact=returnAir(f,state);
      f.capsule.touchdown={normal:Math.abs(contact.radial),tangent:Math.sqrt(Math.max(0,contact.speed**2-contact.radial**2)),slope:0};
      reason=contact.speed<20?'landed':'earth-impact';
      const direction=S.direction(surfaceVector(C.earthFrame(epoch(f)+t+h),state.slice(0,3)));
      const [lon,lat]=S.geographic(...direction);
      l.landing={lon,lat,speed:contact.speed,water:S.waterAt(...direction)};
    }else if(l.handoff==='manual'&&after.height<FOOT_SPREAD*2+FOOT_HEIGHT&&moonSurface(table,f,t+dt,q).clearance<=0){
      h=locate((state,time)=>moonSurface(table,f,t+time,state).clearance<=0);
      const contact=moonSurface(table,f,t+h,at(h));
      l.touchdown=contact;
      reason=contact.vertical>=-2&&contact.horizontal<=1&&contact.tilt<=10?'moon-landed':
        contact.vertical>=-5&&contact.horizontal<=3&&contact.tilt<=20?'moon-hard-landing':'moon-impact';
    }else if(after.height<=0){
      h=locate((state,time)=>lunarDistance(table,f,t+time,state).height<=0);
      reason='moon-impact';
    }else if(!l.landingMission&&!l.entry&&f.capsule.detached&&height>120000&&norm(q.slice(0,3))-P.R<=120000){
      h=locate(state=>norm(state.slice(0,3))-P.R<=120000);
      reason='return-entry';
    }else if(f.status!=='pad'&&norm(q.slice(0,3))<P.R){
      h=locate(state=>norm(state.slice(0,3))<=P.R);
      reason='earth-impact';
    }else if(f.capsule.detached&&before.rate<0&&after.rate>=0){
      const time=locate((state,time)=>lunarDistance(table,f,t+time,state).rate>=0);
      const nearest=at(time),sample=lunarDistance(table,f,t+time,nearest);
      if(!l.closest||sample.height<l.closest.height){
        const moon=table.body(epoch(f)+t+time,0).slice(0,3);
        const farSide=dot(add(nearest.slice(0,3),moon,-1),unit(moon));
        l.closest={...sample,t:t+time,fuel:f.capsule.fuel-core.flow*time,farSide};
        if(sample.height<=NEAR)report?.('lunar-closest',t+time,f);
      }
    }else if(!l.landingMission&&!l.returning&&l.closest?.height<=NEAR&&before.height<=NEAR&&after.height>NEAR){
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
    const actualTurn=inertialTurn?(h===dt?turn:capsuleTurn(f,target,h)):null;
    const attitude=guidedAscent||guidedInjection||capture?axis(t+h,q):h===dt?nextAxis:slew(f.axis,target,h);
    const torque=actualTurn?actualTurn.torque:pointBody(f,attitude);
    if(actualTurn){f.axis=actualTurn.axis;f.bodyRight=actualTurn.right;f.turnVelocity=actualTurn.velocity;}
    f.rcsAxes=null;f.rcsDirection=0;
    if(turning&&norm(torque)>1e-8){
      // The scene uses east/up/north. Reverse the axial-vector sign across that reflection.
      const x=dot(torque,f.bodyRight),z=-dot(torque,cross(f.bodyRight,f.axis));
      f.rcsAxes=[x,z];
      f.rcsDirection=Math.sign(Math.abs(x)>Math.abs(z)?x:z);
    }
    advanceDrops(f,table,t,h);
    f.eci=q;
    f.t=t+h;
    if(reason||pathSampleDue(q,after,l.trail.at(-1),f.t-l.lastTrail,f.t<1000?5:1400,l.trailStride??1)){
      if(l.trail.length>=MAX_PATH_POINTS){
        l.trail=l.trail.filter((_,i)=>i%2===0);
        l.trailStride=(l.trailStride??1)*2;
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
    if(l.landingMission&&l.capturePhase==='settle'&&f.capsule.detached&&!l.handoff&&!stable(f.moon))l.unstable=true;
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
      if(s.phase!=='ended'){
        if(t+h>=end-1e-8)finish(s,'ephemeris-end',report);
        else if(f.status!=='pad')s.phase=f.controls.lit||P.burning(f)?'ascent':'coast';
      }
    }
    return h;
  }
  function advance(s,seconds,budget,table,report){
    const start=s.flight.t;
    let steps=0;
    while(s.phase!=='ended'&&s.flight.lunar.handoff!=='ready'&&steps<budget&&seconds-(s.flight.t-start)>1e-9){
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
      pointBody(f,unit(f.eci.slice(3)));
      f.controls.mode='hold';
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
  const guidanceLocked=f=>f.lunar.landingMission?f.lunar.handoff!=='manual':f.lunar.guided&&f.lunar.next<f.lunar.sequence.length;
  function command(s,action,table,report,automatic=false){
    const f=s.flight,l=f.lunar;
    if(s.phase==='ended'||l.entry)return false;
    const type=action.type,value=action.value;
    if(l.landingMission){
      if(type==='moon-takeover'&&l.handoff==='ready'){
        l.handoff='manual';
        l.guided=false;
        l.capturePhase=null;
        return true;
      }
      if(l.handoff!=='manual'&&!(automatic&&type==='ignite'&&f.status==='pad'))return false;
      if(l.handoff==='manual'&&!['ignite','stop','control'].includes(type))return false;
    }
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
    if(l.groundReturn&&(type==='manual'||type==='stop'||type==='ignite'&&f.t>0))l.modified=true;
    sync(f,table);
    return true;
  }
  function warpLimit(f){
    if(f.lunar.landingMission){
      if(f.lunar.handoff==='ready'||f.lunar.handoff==='manual'&&f.moon.surface.height<1000)return 1;
      if(['align','burn'].includes(f.lunar.capturePhase))return 20;
      if(!f.controls.lit&&f.orbit.height>20000000&&f.moon.height>ENCOUNTER_WARP_HEIGHT)return FAST_WARP;
    }
    if(f.t<6&&!f.separated)return 1;
    if(f.lunar.entry)return f.capsule.chute.phase==='stowed'||f.lunar.groundReturn&&f.lunar.air?.agl<150?20:100;
    if(f.controls.lit||P.burning(f)||f.orbit.height<120000||f.lunar.maneuver?.aligning)return 20;
    if(f.controls.mode==='tilt'&&turningCapsule(f,manualAxis(f,f.eci))||norm(f.turnVelocity??[0,0,0])>.2*DEG)return 5;
    return f.capsule.detached&&f.orbit.height>=20000000&&f.moon.height>ENCOUNTER_WARP_HEIGHT
      ?FAST_WARP:1000;
  }
  function* forecast(f,table){
    if(f.lunar.landingMission&&f.moon.bound&&f.moon.height<300000&&f.moon.ha<500000){
      const points=[],times=[];
      let t=f.t,q=f.eci;
      const end=Math.min(t+1.02*f.moon.period,flightLimit(f));
      const drift=(time,state)=>[...state.slice(3),...C.gravity(table,epoch(f)+time,state.slice(0,3))];
      for(let index=0;t<end;index++){
        const point=moonRelative(table,f,t,q).slice(0,3);
        points.push(point);times.push(t);
        if(norm(point)<=C.MOON_RADIUS)break;
        const dt=Math.min(10,end-t);
        q=C.rk4(drift,t,q,dt);
        t+=dt;
        if(index%48===47)yield;
      }
      return {points,times,localMoon:true};
    }
    const start=f.t,l=f.lunar,end=Math.min(start+(l.groundReturn?14*C.DAY:FORECAST_SPAN),flightLimit(f)),position=q=>q.slice(0,3);
    const derivative=(t,q)=>[...q.slice(3),...C.gravity(table,epoch(f)+t,position(q))];
    let t=start,q=f.eci.slice(),moon=lunarDistance(table,f,t,q),closest=null,entry=null;
    let points=[position(q)],times=[t],sampled=start,count=0,stride=1;
    function record(state,time){
      if(points.length>=MAX_PATH_POINTS){
        points=points.filter((_,i)=>i%2===0);
        times=times.filter((_,i)=>i%2===0);
        stride*=2;
      }
      points.push(position(state));times.push(time);sampled=time;
    }
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
          record(at(hi),entry.t);
        }else record(next,t+dt);
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
      const ends=!l.freeReturn&&!l.landingMission&&closest?.height<=NEAR&&moon.height<=NEAR&&sample.height>NEAR;
      t+=dt;q=next;moon=sample;
      if(ends||t>=end||pathSampleDue(q,moon,points.at(-1),t-sampled,900,stride))record(q,t);
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
  return Object.freeze({LAUNCH,FAST_WARP,MOON_RADIUS:C.MOON_RADIUS,LANDER,utc:C.utc,flightUtc,flightLimit,preset,compatible,open,openLanding,landingCapacity,transfer,advance,command,warpLimit,guidanceLocked,skyFrame,trajectory,forecast});
});
