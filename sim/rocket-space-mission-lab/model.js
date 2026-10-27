(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./orbit.js'):root.RocketOrbit,node?require('./surface.js'):root.RocketSurface);if(node)module.exports=api;root.RocketModel=api;})(typeof window==='undefined'?globalThis:window,function(P,O,S){
  'use strict';
  const clone=P.clone,PHASES=['workshop','pad','ascent','coast','ended','check'];
  function fresh(){return {schema:4,modelVersion:2,variant:0,phase:'workshop',backPhase:null,craft:P.emptyCraft(0),flight:null,records:[null]};}
  function flight(craft,source='own',q=[P.R,0,0,0,0,0]){return {source,craft:clone(craft),t:0,state:q.slice(),fuel:[P.capacity(craft.stages[0]),craft.stages[1]?P.capacity(craft.stages[1]):null],active:0,separated:false,attitude:0,controls:{mode:'tilt',angle:0,throttle:1,lit:false},status:source==='practice'?'flying':'pad',maxHeight:Math.max(0,O.elements(q).height)};}
  function atmosphere(h){if(h>=120000)return 0;const t=Math.max(0,Math.min(1,(h-80000)/40000));return 1.225*Math.exp(-Math.max(0,h)/8500)*(1-t*t*(3-2*t));}
  function targetAttitude(f){const q=f.state,c=f.controls;if(c.mode==='tilt')return Math.atan2(q[1],q[0])+Math.sign(q[0]*q[4]-q[1]*q[3]||1)*c.angle*Math.PI/180;return Math.atan2(q[4],q[3])+(c.mode==='retrograde'?Math.PI:0);}
  function thrust(f){return f.controls.lit&&f.fuel[f.active]>0?P.ENGINES[f.craft.stages[f.active].engine].thrust*f.controls.throttle:0;}
  function derivative(y,f,attitude,vacuum=false,noGravity=false,mass){
    const [x,yy,,vx,vy,,p]=y,r=Math.hypot(x,yy),v=Math.hypot(vx,vy),fuel=f.fuel.slice();fuel[f.active]=Math.max(0,p);const m=mass??P.mass(f,fuel),F=thrust(f),drag=vacuum?0:.5*atmosphere(r-P.R)*.35*3.14*v,g=noGravity?0:P.MU/r**3;
    return [vx,vy,0,-g*x+(F*Math.cos(attitude)-drag*vx)/m,-g*yy+(F*Math.sin(attitude)-drag*vy)/m,0,-F/(P.ENGINES[f.craft.stages[f.active].engine].isp*P.G0)];
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
  function step(f,requested,options){
    if(['impact','escaped'].includes(f.status))return 0;
    const F=thrust(f),engine=P.ENGINES[f.craft.stages[f.active].engine],mdot=F/(engine.isp*P.G0),dt=Math.min(requested,F>0?f.fuel[f.active]/mdot:Infinity),old=f.state.slice(),oldFuel=f.fuel[f.active],m0=P.mass(f),oldAttitude=f.attitude;
    const delta=Math.atan2(Math.sin(targetAttitude(f)-oldAttitude),Math.cos(targetAttitude(f)-oldAttitude)),turn=Math.max(-12*Math.PI/180*dt,Math.min(12*Math.PI/180*dt,delta));
    f.attitude=O.wrap(oldAttitude+turn);const angle=oldAttitude+turn/2,y=[...old,oldFuel];let next=rk4(y,dt,f,angle,options),usedDt=dt;
    if(f.status==='pad'&&Math.hypot(next[0],next[1])<=P.R+.001){next=[P.R,0,0,0,0,0,next[6]];}
    else{const interval=contactInterval(y,next,dt,f,angle,options);if(interval){
      let [lo,hi]=interval;for(let i=0;i<32;i++){const mid=(lo+hi)/2,q=rk4(y,mid,f,angle,options);if(clearance(q,f.t+mid)>0)lo=mid;else hi=mid;}usedDt=hi;next=rk4(y,hi,f,angle,options);const r=Math.hypot(next[0],next[1]),ground=S.radius(next,f.t+hi);next[0]*=ground/r;next[1]*=ground/r;f.status='impact';f.controls.lit=false;
    }else f.status='flying';}
    if(Math.hypot(next[0],next[1])>P.R+1e8){let lo=0,hi=dt;for(let i=0;i<32;i++){const mid=(lo+hi)/2,q=rk4(y,mid,f,angle,options);if(Math.hypot(q[0],q[1])<=P.R+1e8)lo=mid;else hi=mid;}usedDt=lo;next=rk4(y,lo,f,angle,options);f.status=O.elements(next).energy>=0?'escaped':'flying';f.controls.lit=false;}
    f.state=next.slice(0,6);f.fuel[f.active]=Math.max(0,next[6]);f.t+=usedDt;f.maxHeight=Math.max(f.maxHeight||0,O.elements(f.state).height);
    if(f.fuel[f.active]<1e-8){f.fuel[f.active]=0;f.controls.lit=false;}
    const o=O.elements(f.state);if(o.energy>=0&&o.radial>0&&o.height>=1e8-.01){f.status='escaped';f.controls.lit=false;}
    return F>0?engine.isp*P.G0*Math.log(m0/P.mass(f)):0;
  }
  function ignite(s){if(!s.flight||s.flight.fuel[s.flight.active]<=0||['ended','workshop','check'].includes(s.phase))return;s.flight.controls.lit=true;s.phase='ascent';}
  function stop(s){if(s.flight)s.flight.controls.lit=false;if(s.flight&&s.flight.status==='flying')s.phase='coast';}
  function advance(s,seconds,budget=20000){
    const f=s.flight;if(!f||!['pad','ascent','coast'].includes(s.phase)||['impact','escaped'].includes(f.status))return {elapsed:0,steps:0,limited:false};
    const target=Math.min(f.t+seconds,604800),start=f.t;let steps=0;
    while(f.t<target-1e-9&&steps<budget){
      step(f,Math.min(target-f.t,thrust(f)>0||O.elements(f.state).height<120000?.1:2));steps++;
      if(O.elements(f.state).height>=1e8-.01&&f.status==='flying')break;
      if(['impact','escaped'].includes(f.status)){s.phase='ended';break;}
    }
    return {elapsed:f.t-start,steps,limited:f.t<target-1e-7};
  }
  function change(s,action){
    const n=clone(s),f=n.flight;if(n.phase==='check'&&action.type!=='return')return n;
    switch(action.type){
      case 'clear-craft':if(n.phase==='workshop')n.craft=P.emptyCraft(n.variant);break;
      case 'part':{if(n.phase!=='workshop')break;const st=n.craft.stages[action.stage];if(!st)break;if(action.part==='engine'){if([null,0,1].includes(action.value))st.engine=action.value;}else if(['small','large'].includes(action.part)&&Number.isInteger(action.value)&&action.value>=0&&action.value<=4&&action.value+st[action.part==='small'?'large':'small']<=4&&(action.value<=st[action.part]||P.canFit(n.craft,action.stage,action.part))){const list=P.tanks(st);while(list.filter(k=>k===action.part).length>action.value)list.splice(list.lastIndexOf(action.part),1);while(list.filter(k=>k===action.part).length<action.value)list.push(action.part);P.setTanks(st,list);}break;}
      case 'insert':{
        if(n.phase!=='workshop'||!['small','large'].includes(action.part)||!P.canFit(n.craft,action.stage,action.part))break;
        const st=n.craft.stages[action.stage],list=P.tanks(st);if(!Number.isInteger(action.at)||action.at<0||action.at>list.length)break;list.splice(action.at,0,action.part);P.setTanks(st,list);break;
      }
      case 'transfer':{
        if(n.phase!=='workshop'||!Number.isInteger(action.from)||action.to!==null&&!Number.isInteger(action.to))break;
        if(action.part==='capsule'){if(action.from===n.craft.stages.length-1&&action.to===null&&action.at===undefined&&(action.ordinal===undefined||action.ordinal===0)&&P.hasCapsule(n.craft))n.craft.capsule=false;break;}
        if(action.part==='separator'){const upper=n.craft.stages[1];if(action.from===1&&action.to===null&&action.at===undefined&&(action.ordinal===undefined||action.ordinal===0)&&n.craft.separator&&upper&&upper.engine===null&&!upper.small&&!upper.large&&!P.hasCapsule(n.craft)){n.craft.stages.pop();n.craft.separator=false;}break;}
        const st=n.craft.stages[action.from],part=action.part,engine=['engine-0','engine-1'].includes(part),same=action.from===action.to;
        if(!st||!(engine?st.engine===Number(part.slice(-1)):['small','large'].includes(part)&&st[part]>0)||action.to!==null&&!same&&!P.canFit(n.craft,action.to,part))break;
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
      case 'control':if(f&&['pad','ascent','coast'].includes(n.phase)){if(action.key==='throttle'&&Number.isFinite(action.value)&&action.value>=0&&action.value<=1)f.controls.throttle=action.value;if(action.key==='angle'&&Number.isFinite(action.value)&&action.value>=0&&action.value<=180){f.controls.angle=action.value;f.controls.mode='tilt';}if(action.key==='mode'&&['tilt','prograde','retrograde'].includes(action.value))f.controls.mode=action.value;}break;
      case 'ignite':ignite(n);break;
      case 'stop':if(f)stop(n);break;
      case 'separate':if(f?.craft.stages.length===2&&!f.separated&&!['impact','escaped'].includes(f.status)){stop(n);f.active=1;f.separated=true;f.fuel[0]=0;n.phase=f.status==='pad'?'pad':'coast';}break;
      case 'record-stop':case 'record':if(f&&f.t>0&&f.status!=='pad'){if(action.type==='record-stop')stop(n);n.records[0]={craft:clone(f.craft),state:f.state.slice(),fuel:f.fuel.slice(),active:f.active,separated:f.separated,t:f.t,status:f.status,maxHeight:f.maxHeight,engineOff:!f.controls.lit};}break;
      case 'clear-record':if(action.index===0)n.records[0]=null;break;
      case 'check':n.backPhase=n.phase;n.phase='check';break;
      case 'return':if(n.phase==='check'){n.phase=n.backPhase;n.backPhase=null;}break;
    }
    return n;
  }
  return Object.freeze({ACTIVITY:P.ACTIVITY,PHASES,clone,fresh,flight,atmosphere,targetAttitude,thrust,derivative,rk4,step,advance,change});
});
