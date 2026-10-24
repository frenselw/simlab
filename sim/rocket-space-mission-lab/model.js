(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./orbit.js'):root.RocketOrbit);if(node)module.exports=api;root.RocketModel=api;})(typeof window==='undefined'?globalThis:window,function(P,O){
  'use strict';
  const clone=P.clone,PHASES=['workshop','pad','ascent','coast','ended','mission','planning','armed','burning','check'];
  function fresh(random=Math.random){const variant=Math.min(2,Math.floor(random()*3));return {schema:1,modelVersion:1,variant,phase:'workshop',backPhase:null,craft:P.emptyCraft(variant),task:'A',flight:null,node:null,burn:null,records:[null,null]};}
  function flight(craft,source='own',q=[P.R,0,0,0,0,0]){return {source,craft:clone(craft),t:0,state:q.slice(),fuel:[P.capacity(craft.stages[0]),craft.stages[1]?P.capacity(craft.stages[1]):null],active:0,separated:false,attitude:0,controls:{mode:'tilt',angle:0,throttle:1,lit:false},status:source==='practice'?'flying':'pad'};}
  function atmosphere(h){if(h>=120000)return 0;const t=Math.max(0,Math.min(1,(h-80000)/40000));return 1.225*Math.exp(-Math.max(0,h)/8500)*(1-t*t*(3-2*t));}
  function targetAttitude(f){const q=f.state,c=f.controls;if(c.mode==='tilt')return Math.atan2(q[1],q[0])+Math.sign(q[0]*q[4]-q[1]*q[3]||1)*c.angle*Math.PI/180;return Math.atan2(q[4],q[3])+(c.mode==='retrograde'?Math.PI:0);}
  function thrust(f){return f.controls.lit&&f.fuel[f.active]>0?P.ENGINES[f.craft.stages[f.active].engine].thrust*f.controls.throttle:0;}
  function derivative(y,f,attitude,vacuum=false,noGravity=false){
    const [x,yy,,vx,vy,,p]=y,r=Math.hypot(x,yy),v=Math.hypot(vx,vy),fuel=f.fuel.slice();fuel[f.active]=Math.max(0,p);const m=P.mass(f,fuel),F=thrust(f),drag=vacuum?0:.5*atmosphere(r-P.R)*.35*3.14*v,g=noGravity?0:P.MU/r**3;
    return [vx,vy,0,-g*x+(F*Math.cos(attitude)-drag*vx)/m,-g*yy+(F*Math.sin(attitude)-drag*vy)/m,0,-F/(P.ENGINES[f.craft.stages[f.active].engine].isp*P.G0)];
  }
  function rk4(y,dt,f,angle,options){const d=(q)=>derivative(q,f,angle,options?.vacuum,options?.noGravity),add=(a,b,k)=>a.map((v,i)=>v+k*b[i]),k1=d(y),k2=d(add(y,k1,dt/2)),k3=d(add(y,k2,dt/2)),k4=d(add(y,k3,dt));return y.map((v,i)=>v+dt/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));}
  function step(f,requested,options){
    if(['impact','escaped'].includes(f.status))return 0;
    const F=thrust(f),engine=P.ENGINES[f.craft.stages[f.active].engine],mdot=F/(engine.isp*P.G0),dt=Math.min(requested,F>0?f.fuel[f.active]/mdot:Infinity),old=f.state.slice(),oldFuel=f.fuel[f.active],m0=P.mass(f),oldAttitude=f.attitude;
    const delta=Math.atan2(Math.sin(targetAttitude(f)-oldAttitude),Math.cos(targetAttitude(f)-oldAttitude)),turn=Math.max(-12*Math.PI/180*dt,Math.min(12*Math.PI/180*dt,delta));
    f.attitude=O.wrap(oldAttitude+turn);const angle=oldAttitude+turn/2,y=[...old,oldFuel];let next=rk4(y,dt,f,angle,options),usedDt=dt;
    if(f.status==='pad'&&Math.hypot(next[0],next[1])<=P.R+.001){next=[P.R,0,0,0,0,0,next[6]];}
    else if(Math.hypot(next[0],next[1])<P.R){
      let lo=0,hi=dt;for(let i=0;i<32;i++){const mid=(lo+hi)/2,q=rk4(y,mid,f,angle,options);if(Math.hypot(q[0],q[1])>=P.R)lo=mid;else hi=mid;}usedDt=hi;next=rk4(y,hi,f,angle,options);const r=Math.hypot(next[0],next[1]);next[0]*=P.R/r;next[1]*=P.R/r;f.status='impact';f.controls.lit=false;
    }else f.status='flying';
    if(Math.hypot(next[0],next[1])>P.R+1e8){let lo=0,hi=dt;for(let i=0;i<32;i++){const mid=(lo+hi)/2,q=rk4(y,mid,f,angle,options);if(Math.hypot(q[0],q[1])<=P.R+1e8)lo=mid;else hi=mid;}usedDt=lo;next=rk4(y,lo,f,angle,options);f.status=O.elements(next).energy>=0?'escaped':'flying';f.controls.lit=false;}
    f.state=next.slice(0,6);f.fuel[f.active]=Math.max(0,next[6]);f.t+=usedDt;
    if(f.fuel[f.active]<1e-8){f.fuel[f.active]=0;f.controls.lit=false;}
    const o=O.elements(f.state);if(o.energy>=0&&o.radial>0&&o.height>=1e8-.01){f.status='escaped';f.controls.lit=false;}
    return F>0?engine.isp*P.G0*Math.log(m0/P.mass(f)):0;
  }
  function ignite(s){if(!s.flight||s.flight.fuel[s.flight.active]<=0||['ended','workshop'].includes(s.phase))return;s.flight.controls.lit=true;s.phase=s.task==='A'?'ascent':'coast';}
  function stop(s){if(s.flight)s.flight.controls.lit=false;if(s.burn?.status==='active')s.burn.status='interrupted';if(s.flight&&s.flight.status==='flying')s.phase='coast';s.node=null;}
  function beginBurn(s){const f=s.flight;s.burn={status:'active',before:f.state.slice(),beforeFuel:f.fuel.slice(),startTime:f.t,achievedDv:0,targetDv:s.node.dv,direction:s.node.direction};f.controls.mode=s.node.direction;f.controls.throttle=1;f.controls.lit=true;s.phase='burning';}
  function advance(s,seconds,budget=20000){
    const f=s.flight;if(!f||!['pad','ascent','coast','armed','burning','mission'].includes(s.phase)||['impact','escaped'].includes(f.status))return {elapsed:0,steps:0,limited:false};
    const target=Math.min(f.t+seconds,604800),start=f.t;let steps=0;
    while(f.t<target-1e-9&&steps<budget){
      if(s.phase==='armed'&&f.t>=s.node.fireAt-1e-7)beginBurn(s);
      let dt=Math.min(target-f.t,thrust(f)>0||O.elements(f.state).height<120000?.1:2);
      if(s.phase==='armed')dt=Math.min(dt,Math.max(0,s.node.fireAt-f.t));
      if(s.phase==='burning'){
        const engine=P.ENGINES[f.craft.stages[f.active].engine],remaining=s.burn.targetDv-s.burn.achievedDv,F=thrust(f);
        if(F>0)dt=Math.min(dt,P.mass(f)*(1-Math.exp(-remaining/(engine.isp*P.G0)))/(F/(engine.isp*P.G0)));
        if(dt<1e-9||F===0){f.controls.lit=false;s.burn.status=remaining<.001?'completed':'interrupted';s.phase='coast';s.node=null;continue;}
      }
      const dv=step(f,dt);steps++;
      if(s.phase==='burning'){s.burn.achievedDv+=dv;if(s.burn.achievedDv>=s.burn.targetDv-1e-7||!f.controls.lit){s.burn.status=s.burn.achievedDv>=s.burn.targetDv-1e-4?'completed':'interrupted';f.controls.lit=false;s.phase='coast';s.node=null;}}
      if(O.elements(f.state).height>=1e8-.01&&f.status==='flying')break;
      if(['impact','escaped'].includes(f.status)){if(s.burn?.status==='active')s.burn.status='interrupted';s.phase='ended';s.node=null;break;}
    }
    return {elapsed:f.t-start,steps,limited:f.t<target-1e-7};
  }
  function change(s,action){
    const n=clone(s),f=n.flight;if(n.phase==='check'&&action.type!=='return')return n;
    switch(action.type){
      case 'part':{if(n.phase!=='workshop')break;const st=n.craft.stages[action.stage];if(!st)break;if(action.part==='engine')st.engine=action.value;else if(['small','large'].includes(action.part)&&Number.isInteger(action.value)&&action.value>=0&&action.value<=4&&action.value+st[action.part==='small'?'large':'small']<=4)st[action.part]=action.value;break;}
      case 'stages':if(n.phase==='workshop'&&[1,2].includes(action.count)){n.craft.stages=action.count===1?[n.craft.stages[0]]:[n.craft.stages[0],n.craft.stages[1]||P.emptyStage()];n.craft.separator=action.count===2;}break;
      case 'launch':if(P.complete(n.craft)){n.flight=flight(n.craft);n.task='A';n.phase='pad';n.node=null;n.burn=null;}break;
      case 'workshop':n.phase='workshop';n.task='A';n.flight=null;n.node=null;n.burn=null;break;
      case 'mission':n.task='B';n.phase='mission';n.flight=null;n.node=null;n.burn=null;break;
      case 'practice':{const c={payload:n.variant,stages:[{engine:1,small:1,large:0}],separator:false};n.flight=flight(c,'practice',O.circular(300000));n.flight.attitude=Math.PI/2;n.task='B';n.phase='coast';n.node=null;n.burn=null;break;}
      case 'import':{const a=n.records[0];if(!a||!O.safe(a.state)||a.status!=='flying')break;n.flight={...clone(a),source:'own',t:0,attitude:O.wrap(Math.atan2(a.state[4],a.state[3])),controls:{mode:'prograde',angle:90,throttle:1,lit:false},status:'flying'};n.task='B';n.phase='coast';n.node=null;n.burn=null;break;}
      case 'control':if(f&&['pad','ascent','coast','mission'].includes(n.phase)){if(action.key==='throttle'&&Number.isFinite(action.value)&&action.value>=0&&action.value<=1)f.controls.throttle=action.value;if(action.key==='angle'&&Number.isFinite(action.value)&&action.value>=0&&action.value<=180){f.controls.angle=action.value;f.controls.mode='tilt';}if(action.key==='mode'&&['tilt','prograde','retrograde'].includes(action.value))f.controls.mode=action.value;}break;
      case 'ignite':if(n.task==='A')ignite(n);break;
      case 'stop':if(f)stop(n);break;
      case 'separate':if(n.task==='A'&&f?.craft.stages.length===2&&!f.separated){stop(n);f.active=1;f.separated=true;f.fuel[0]=0;n.phase=f.status==='pad'?'pad':'coast';}break;
      case 'node':if(n.task==='B'&&f&&O.operable(f.state)&&['coast','planning'].includes(n.phase)){const at=action.at||n.node?.at||'phase',angle=action.angle??n.node?.angle??O.wrap(Math.atan2(f.state[1],f.state[0])+Math.PI/4),node=O.node(f.state,at,angle);if(node){n.node={at,angle:node.angle,direction:action.direction||n.node?.direction||'prograde',dv:action.dv??n.node?.dv??0,confirmed:false,fireAt:null};n.phase='planning';}}break;
      case 'execute':if(n.phase==='planning'&&n.node.dv>0&&f.fuel[f.active]>0){n.node.confirmed=true;n.node.fireAt=f.t+O.timeToAngle(f.state,n.node.angle);n.phase='armed';f.controls.lit=false;f.controls.mode=n.node.direction;}break;
      case 'cancel':if(['planning','armed'].includes(n.phase)){n.node=null;n.phase='coast';}break;
      case 'record':if(f&&f.t>0){if(n.task==='A'&&f.source==='own'&&f.status!=='pad')n.records[0]={craft:clone(f.craft),state:f.state.slice(),fuel:f.fuel.slice(),active:f.active,separated:f.separated,t:f.t,status:f.status};if(n.task==='B'&&n.burn?.achievedDv>0){if(n.burn.status==='active')stop(n);n.records[1]={source:f.source,craft:clone(f.craft),before:n.burn.before.slice(),after:f.state.slice(),fuelBefore:n.burn.beforeFuel.slice(),fuelAfter:f.fuel.slice(),active:f.active,separated:f.separated,elapsed:f.t-n.burn.startTime,direction:n.burn.direction,achievedDv:n.burn.achievedDv};}}break;
      case 'clear-record':if([0,1].includes(action.index))n.records[action.index]=null;break;
      case 'check':n.backPhase=n.phase;n.phase='check';break;
      case 'return':if(n.phase==='check'){n.phase=n.backPhase;n.backPhase=null;}break;
    }
    return n;
  }
  function preview(s){if(s.phase!=='planning'||!s.node)return null;const q=change(s,{type:'execute'});if(q.phase!=='armed')return null;let steps=0;while(['armed','burning'].includes(q.phase)&&steps<200000){advance(q,10);steps+=100;}return {state:q.flight.state,orbit:O.elements(q.flight.state),fuel:q.flight.fuel,elapsed:q.flight.t-s.flight.t,achievedDv:q.burn?.achievedDv||0};}
  return Object.freeze({ACTIVITY:P.ACTIVITY,PHASES,clone,fresh,flight,atmosphere,targetAttitude,thrust,derivative,rk4,step,advance,change,preview});
});
