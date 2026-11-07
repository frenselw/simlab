(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./orbit.js'):root.RocketOrbit,node?require('./surface.js'):root.RocketSurface,node?require('./recovery.js'):root.RocketRecovery);if(node)module.exports=api;root.RocketModel=api;})(typeof window==='undefined'?globalThis:window,function(P,O,S,R){
  'use strict';
  const clone=P.clone,PHASES=['workshop','pad','ascent','coast','ended'];
  function fresh(){return {variant:0,phase:'workshop',craft:P.emptyCraft(0),flight:null};}
  function flight(craft,source='own',q=[P.R,0,0,0,0,0]){return {capsule:R.fresh(),upperStage:null,controlled:'main',boosters:craft.boosters?{status:'ready',fuel:P.BOOSTER.fuel}:null,source,craft:clone(craft),t:0,state:q.slice(),fuel:[P.capacity(craft.stages[0]),craft.stages[1]?P.capacity(craft.stages[1]):null],active:0,separated:false,attitude:0,controls:{mode:'tilt',angle:0,throttle:1,lit:false},status:source==='practice'?'flying':'pad',maxHeight:Math.max(0,O.elements(q).height)};}
  function atmosphere(h){if(h>=120000)return 0;const t=Math.max(0,Math.min(1,(h-80000)/40000));return 1.225*Math.exp(-Math.max(0,h)/8500)*(1-t*t*(3-2*t));}
  function targetAttitude(f){const q=f.state,c=f.controls;if(c.mode==='hold')return f.attitude;if(c.mode==='tilt')return Math.atan2(q[1],q[0])+c.angle*Math.PI/180;return Math.atan2(q[4],q[3])+(c.mode==='retrograde'?Math.PI:0);}
  function coreThrust(f){if(f.capsule?.detached)return R.thrust(f);return f.controls.lit&&f.fuel[f.active]>0?P.ENGINES[f.craft.stages[f.active].engine].thrust*f.controls.throttle:0;}
  function thrust(f){return coreThrust(f)+(P.burning(f)?f.craft.boosters*P.BOOSTER.thrust:0);}
  function derivative(y,f,attitude,vacuum=false,noGravity=false,mass){
    const [x,yy,,vx,vy,,p]=y,r=Math.hypot(x,yy),v=Math.hypot(vx,vy),fuel=f.fuel.slice();fuel[f.active]=Math.max(0,p);const sample={...f,boosters:f.boosters?{...f.boosters,fuel:Math.max(0,y[7]??f.boosters.fuel)}:null},m=mass??P.mass(sample,fuel),F=thrust(f),drag=vacuum?0:.5*atmosphere(r-P.R)*(P.CORE_DRAG_AREA+.35*(P.attached(f)?f.craft.boosters*Math.PI*.65**2:0))*v,g=noGravity?0:P.MU/r**3;
    return [vx,vy,0,-g*x+(F*Math.cos(attitude)-drag*vx)/m,-g*yy+(F*Math.sin(attitude)-drag*vy)/m,0,-coreThrust(f)/(P.ENGINES[f.craft.stages[f.active].engine].isp*P.G0),...(y.length>7?[-(P.burning(f)?P.BOOSTER.thrust/(P.BOOSTER.isp*P.G0):0)]:[])];
  }
  function rk4(y,dt,f,angle,options){const d=(q)=>derivative(q,f,angle,options?.vacuum,options?.noGravity,options?.mass),add=(a,b,k)=>a.map((v,i)=>v+k*b[i]),k1=d(y),k2=d(add(y,k1,dt/2)),k3=d(add(y,k2,dt/2)),k4=d(add(y,k3,dt));return y.map((v,i)=>v+dt/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));}
  function clearance(q,t){const r=Math.hypot(q[0],q[1]);return r>P.R+S.MAX_HEIGHT?r-P.R:S.clearance(q,t);}
  function contactInterval(y,next,dt,f,angle,options){
    const distance=Math.hypot(next[0]-y[0],next[1]-y[1]);
    if(Math.min(Math.hypot(y[0],y[1]),Math.hypot(next[0],next[1]))>P.R+S.MAX_HEIGHT+distance)return null;
    if(clearance(y,f.t)<-.001)return [0,0];
    // Sample within the terrain grid spacing so a fast sideways pass cannot skip a ridge.
    const count=Math.max(1,Math.ceil(distance/250));
    for(let i=1;i<=count;i++){const time=dt*i/count,q=i===count?next:rk4(y,time,f,angle,options);if(clearance(q,f.t+time)<=0)return [dt*(i-1)/count,time];}
    return null;
  }
  function step(f,requested,options){if(f.capsule?.detached){const t=f.t;R.stepCapsule(f,requested,atmosphere);return f.t-t;}
    if(['impact','escaped'].includes(f.status))return 0;
    const F=thrust(f),engine=P.ENGINES[f.craft.stages[f.active].engine],mdot=coreThrust(f)/(engine.isp*P.G0),bdot=P.burning(f)?P.BOOSTER.thrust/(P.BOOSTER.isp*P.G0):0,dt=Math.min(requested,mdot>0?f.fuel[f.active]/mdot:Infinity,bdot>0?f.boosters.fuel/bdot:Infinity),old=f.state.slice(),oldFuel=f.fuel[f.active],m0=P.mass(f),oldAttitude=f.attitude;
    const delta=Math.atan2(Math.sin(targetAttitude(f)-oldAttitude),Math.cos(targetAttitude(f)-oldAttitude)),turn=Math.max(-12*Math.PI/180*dt,Math.min(12*Math.PI/180*dt,delta));
    f.attitude=O.wrap(oldAttitude+turn);const angle=oldAttitude+turn/2,y=[...old,oldFuel,...(f.boosters?[f.boosters.fuel]:[])];let next=rk4(y,dt,f,angle,options),usedDt=dt;
    if(f.status==='pad'&&Math.hypot(next[0],next[1])<=P.R){next=[P.R,0,0,0,0,0,...next.slice(6)];}
    else{const interval=contactInterval(y,next,dt,f,angle,options);if(interval){
      let [lo,hi]=interval;for(let i=0;i<32;i++){const mid=(lo+hi)/2,q=rk4(y,mid,f,angle,options);if(clearance(q,f.t+mid)>0)lo=mid;else hi=mid;}usedDt=hi;next=rk4(y,hi,f,angle,options);const r=Math.hypot(next[0],next[1]),ground=S.radius(next,f.t+hi);next[0]*=ground/r;next[1]*=ground/r;f.status='impact';f.controls.lit=false;
    }else f.status='flying';}
    if(Math.hypot(next[0],next[1])>P.R+1e8){let lo=0,hi=dt;for(let i=0;i<32;i++){const mid=(lo+hi)/2,q=rk4(y,mid,f,angle,options);if(Math.hypot(q[0],q[1])<=P.R+1e8)lo=mid;else hi=mid;}usedDt=lo;next=rk4(y,lo,f,angle,options);f.status=O.elements(next).energy>=0?'escaped':'flying';f.controls.lit=false;}
    f.state=next.slice(0,6);f.fuel[f.active]=Math.max(0,next[6]);if(f.boosters){f.boosters.fuel=Math.max(0,next[7]);if(f.boosters.status==='burning'&&f.boosters.fuel<1e-8){f.boosters.fuel=0;f.boosters.status='spent';}}f.t+=usedDt;f.maxHeight=Math.max(f.maxHeight||0,O.elements(f.state).height);
    if(f.fuel[f.active]<1e-8){f.fuel[f.active]=0;f.controls.lit=false;}
    const o=O.elements(f.state);if(o.energy>=0&&o.radial>0&&o.height>=1e8-.01){f.status='escaped';f.controls.lit=false;}
    return F>0?(bdot?F/(mdot+f.craft.boosters*bdot)*Math.log(m0/P.mass(f)):engine.isp*P.G0*Math.log(m0/P.mass(f))):0;
  }
  const boosterTilt=age=>.525*(1-Math.exp(-Math.max(0,age)/1.5));
  function boosterDirection(b,t=b.t){const a=boosterTilt(t-b.start);return b.axis.map((v,i)=>v*Math.cos(a)+b.out[i]*Math.sin(a));}
  function boosterFlight(f,mount,center=[mount[0]*2.4,3.6,mount[1]*2.4]){
    const a=f.attitude,axis=[Math.cos(a),Math.sin(a),0],out=[-mount[0]*Math.sin(a),mount[0]*Math.cos(a),mount[1]],state=f.state.slice();
    const offset=[center[1]*axis[0]-center[0]*Math.sin(a),center[1]*axis[1]+center[0]*Math.cos(a),center[2]];
    for(let i=0;i<3;i++){state[i]+=offset[i];state[i+3]+=2*out[i];}
    return {t:f.t,start:f.t,state,axis,out,fuel:f.boosters.fuel,status:'flying'};
  }
  function boosterClearance(q,t,b){const r=Math.hypot(...q.slice(0,3)),dir=boosterDirection(b,t),cos=q.slice(0,3).reduce((v,x,i)=>v+x*dir[i],0)/r,extent=3.6*Math.abs(cos)+.65*Math.sqrt(Math.max(0,1-cos*cos));return S.clearance(q,t)-extent;}
  function stepBooster(b,requested,options={}){
    if(b.status!=='flying'||requested<=0)return 0;
    const lit=b.fuel>0,flow=lit?P.BOOSTER.thrust/(P.BOOSTER.isp*P.G0):0,dt=Math.min(requested,flow?b.fuel/flow:Infinity),y=[...b.state,b.fuel];
    // shortcut: damped outward rotation represents separation hardware; add rigid-body torques only for a six-DOF activity.
    const d=(q,t)=>{const r=Math.hypot(...q.slice(0,3)),v=Math.hypot(...q.slice(3,6)),m=P.BOOSTER.dry+Math.max(0,q[6]),dir=boosterDirection(b,t),along=v?q.slice(3,6).reduce((sum,w,i)=>sum+w*dir[i],0)/v:1,area=Math.PI*.65**2+2*.65*6.6*Math.sqrt(Math.max(0,1-along*along)),drag=options.vacuum?0:.5*atmosphere(r-P.R)*.35*area*v,g=options.noGravity?0:P.MU/r**3;return [...q.slice(3,6),...dir.map((u,i)=>-g*q[i]+((lit?P.BOOSTER.thrust:0)*u-drag*q[i+3])/m),-flow];};
    const add=(a,k,h)=>a.map((v,i)=>v+k[i]*h),integrate=h=>{const k1=d(y,b.t),k2=d(add(y,k1,h/2),b.t+h/2),k3=d(add(y,k2,h/2),b.t+h/2),k4=d(add(y,k3,h),b.t+h);return y.map((v,i)=>v+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));};
    let used=dt,next=integrate(dt);const distance=Math.hypot(...next.slice(0,3).map((v,i)=>v-y[i]));
    if(!options.noGravity&&Math.min(Math.hypot(...y.slice(0,3)),Math.hypot(...next.slice(0,3)))<P.R+S.MAX_HEIGHT+distance){
      const count=Math.max(1,Math.ceil(distance/250));for(let i=1;i<=count;i++){const hi=dt*i/count;if(boosterClearance(integrate(hi),b.t+hi,b)<=0){let lo=dt*(i-1)/count,end=hi;for(let j=0;j<28;j++){const mid=(lo+end)/2;if(boosterClearance(integrate(mid),b.t+mid,b)>0)lo=mid;else end=mid;}used=end;next=integrate(used);b.status='impact';break;}}
    }
    b.state=next.slice(0,6);b.fuel=Math.max(0,next[6]);if(b.fuel<1e-8)b.fuel=0;b.t+=used;return used;
  }
  function ignite(s){if(!s.flight||s.flight.fuel[s.flight.active]<=0||['ended','workshop'].includes(s.phase))return;s.flight.controls.lit=true;if(s.flight.boosters?.status==='ready')s.flight.boosters.status='burning';s.phase='ascent';}
  function stop(s){if(s.flight)s.flight.controls.lit=false;if(s.flight&&s.flight.status==='flying')s.phase=P.burning(s.flight)?'ascent':'coast';}
  function advance(s,seconds,budget=20000){
    const f=s.flight;if(f?.capsule?.detached&&['ascent','coast'].includes(s.phase))return R.advance(s,seconds,budget,step,atmosphere);if(!f||!['pad','ascent','coast'].includes(s.phase)||['impact','escaped'].includes(f.status))return {elapsed:0,steps:0,limited:false};
    const target=Math.min(f.t+seconds,604800),start=f.t;let steps=0;
    while(f.t<target-1e-9&&steps<budget){
      step(f,Math.min(target-f.t,thrust(f)>0||O.elements(f.state).height<120000?.1:2));steps++;
      if(O.elements(f.state).height>=1e8-.01&&f.status==='flying')break;
      if(['impact','escaped'].includes(f.status)){s.phase='ended';break;}
    }
    if(f.status==='flying'&&!f.controls.lit&&!P.burning(f))s.phase='coast';
    return {elapsed:f.t-start,steps,limited:f.t<target-1e-7};
  }
  function change(s,action){
    const n=clone(s),f=n.flight;const target=R.selected(f);
    if(f?.controlled==='upper'&&['control','ignite','stop'].includes(action.type))f.upperStage.auto.mode='manual';
    switch(action.type){
      case 'capsule-separate':if(R.separate(f,flight))n.phase='coast';break;
      case 'chute-arm':if(f?.capsule?.detached&&!R.terminal(f))f.capsule.chute.armed=true;break;
      case 'select-body':if(f?.upperStage&&['main','upper'].includes(action.value))f.controlled=action.value;break;
      case 'auto-dispose':if(f?.upperStage&&!R.terminal(f.upperStage))f.upperStage.auto.mode='waiting';break;
      case 'boosters':if(n.phase==='workshop'&&P.canFit(n.craft,0,'boosters'))n.craft.boosters=(n.craft.boosters||0)+2;break;
      case 'jettison':if(['burning','spent'].includes(f?.boosters?.status)&&f.status==='flying')f.boosters.status='jettisoned';break;
      case 'clear-craft':if(n.phase==='workshop')n.craft=P.emptyCraft(n.variant);break;
      case 'part':{if(n.phase!=='workshop')break;const st=n.craft.stages[action.stage];if(!st)break;if(action.part==='engine'){if([null,0,1,2].includes(action.value))st.engine=action.value;}else if(['small','medium','large'].includes(action.part)&&Number.isInteger(action.value)&&action.value>=0&&action.value<=4&&P.tanks(st).filter(k=>k!==action.part).length+action.value<=4&&(action.value<=(st[action.part]||0)||P.canFit(n.craft,action.stage,action.part))){const list=P.tanks(st);while(list.filter(k=>k===action.part).length>action.value)list.splice(list.lastIndexOf(action.part),1);while(list.filter(k=>k===action.part).length<action.value)list.push(action.part);P.setTanks(st,list);}break;}
      case 'insert':{
        if(n.phase!=='workshop'||!['small','medium','large'].includes(action.part)||!P.canFit(n.craft,action.stage,action.part))break;
        const st=n.craft.stages[action.stage],list=P.tanks(st);if(!Number.isInteger(action.at)||action.at<0||action.at>list.length)break;list.splice(action.at,0,action.part);P.setTanks(st,list);break;
      }
      case 'transfer':{
        if(n.phase!=='workshop'||!Number.isInteger(action.from)||action.to!==null&&!Number.isInteger(action.to))break;
        if(action.part==='boosters'){if(action.from===0&&action.to===null)delete n.craft.boosters;break;}
        if(action.part==='capsule'){if(action.from===n.craft.stages.length-1&&action.to===null&&action.at===undefined&&(action.ordinal===undefined||action.ordinal===0)&&P.hasCapsule(n.craft))n.craft.capsule=false;break;}
        if(action.part==='separator'){const upper=n.craft.stages[1];if(action.from===1&&action.to===null&&action.at===undefined&&(action.ordinal===undefined||action.ordinal===0)&&n.craft.separator&&upper&&upper.engine===null&&!upper.small&&!upper.medium&&!upper.large&&!P.hasCapsule(n.craft)){n.craft.stages.pop();n.craft.separator=false;}break;}
        const st=n.craft.stages[action.from],part=action.part,engine=['engine-0','engine-1','engine-2'].includes(part),same=action.from===action.to;
        if(!st||!(engine?st.engine===Number(part.slice(-1)):['small','medium','large'].includes(part)&&st[part]>0)||action.to!==null&&!same&&!P.canFit(n.craft,action.to,part))break;
        if(engine){if(same||action.at!==undefined)break;st.engine=null;if(action.to!==null)n.craft.stages[action.to].engine=Number(part.slice(-1));break;}
        const list=P.tanks(st),ordinal=action.ordinal??0,index=list.map((k,i)=>k===part?i:-1).filter(i=>i>=0)[ordinal];if(!Number.isInteger(ordinal)||ordinal<0||index===undefined)break;
        const target=action.to===null?null:same?list:P.tanks(n.craft.stages[action.to]),at=action.at??target?.length;if(target&&(!Number.isInteger(at)||at<0||at>target.length)||same&&action.at===undefined)break;
        list.splice(index,1);if(target)target.splice(same&&at>index?at-1:at,0,part);P.setTanks(st,list);if(target&&!same)P.setTanks(n.craft.stages[action.to],target);break;
      }
      case 'separator':if(n.phase==='workshop'&&P.canFit(n.craft,0,'separator')){n.craft.stages.push(P.emptyStage());n.craft.separator=true;}break;
      case 'stages':if(n.phase==='workshop'&&[1,2].includes(action.count)&&!P.hasCapsule(n.craft)){n.craft.stages=action.count===1?[n.craft.stages[0]]:[n.craft.stages[0],n.craft.stages[1]||P.emptyStage()];n.craft.separator=action.count===2;}break;
      case 'capsule':if(n.phase==='workshop'&&P.canFit(n.craft,n.craft.stages.length-1,'capsule'))delete n.craft.capsule;break;
      case 'launch':if(n.phase==='workshop'&&P.complete(n.craft)){n.flight=flight(n.craft);n.phase='pad';}break;
      case 'workshop':n.phase='workshop';n.flight=null;break;
      case 'control':if(f&&['pad','ascent','coast'].includes(n.phase)){if(action.key==='throttle'&&Number.isFinite(action.value)&&action.value>=0&&action.value<=1)target.controls.throttle=action.value;if(action.key==='angle'&&Number.isFinite(action.value)&&action.value>=0&&action.value<360){target.controls.angle=action.value;target.controls.mode='tilt';}if(action.key==='mode'&&['tilt','prograde','retrograde'].includes(action.value))target.controls.mode=action.value;}break;
      case 'ignite':if(f?.capsule?.detached){if(!R.terminal(target)&&((target.capsule&&target.capsule.chute.phase==='stowed'&&target.capsule.fuel>0)||(!target.capsule&&target.fuel[0]>0)))target.controls.lit=true;}else ignite(n);break;
      case 'stop':if(target)target.controls.lit=false;if(!f?.capsule?.detached&&f)stop(n);break;
      case 'separate':if(!P.attached(f||{})&&f?.craft.stages.length===2&&!f.separated&&!['impact','escaped'].includes(f.status)){stop(n);f.active=1;f.separated=true;f.fuel[0]=0;n.phase=f.status==='pad'?'pad':'coast';}break;

    }
    if(n.phase==='workshop'&&n.craft.boosters&&!P.stageComplete(n.craft.stages[0]))return clone(s);
    return n;
  }
  return Object.freeze({PHASES,clone,fresh,flight,atmosphere,targetAttitude,coreThrust,thrust,derivative,rk4,step,boosterTilt,boosterDirection,boosterFlight,boosterClearance,stepBooster,advance,change});
});
