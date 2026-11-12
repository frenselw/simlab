(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./orbit.js'):root.RocketOrbit,node?require('./surface.js'):root.RocketSurface);if(node)module.exports=api;root.RocketRecovery=api;})(typeof window==='undefined'?globalThis:window,function(P,O,S){
  'use strict';
  const terminal=f=>['impact','escaped','landed','destroyed'].includes(f.status);
  const fresh=()=>({detached:false,fuel:30,heat:0,chute:{armed:false,phase:'stowed',since:null},touchdown:null});
  const mass=f=>180+f.capsule.fuel;
  const stageHeight=u=>2+P.tanks(u.craft.stages[0]).reduce((sum,k)=>sum+({small:2.4,medium:3.25,large:4.1})[k],0);
  function hull(f,height){const a=[Math.cos(f.attitude),Math.sin(f.attitude)],side=[-a[1],a[0]];return {axes:[a,side],half:[height/2,1.65],center:[f.state[0]+a[0]*height/2,f.state[1]+a[1]*height/2]};}
  function contact(f){const u=f.upperStage;if(!u||terminal(f)||terminal(u))return null;const a=hull(f,3.25),b=hull(u,stageHeight(u)),delta=a.center.map((v,i)=>v-b.center[i]);let depth=Infinity,normal;
    for(const axis of [...a.axes,...b.axes]){const extent=h=>h.half.reduce((sum,r,i)=>sum+r*Math.abs(h.axes[i][0]*axis[0]+h.axes[i][1]*axis[1]),0),distance=delta[0]*axis[0]+delta[1]*axis[1],overlap=extent(a)+extent(b)-Math.abs(distance);if(overlap<=0)return null;if(overlap<depth){depth=overlap;normal=axis.map(v=>v*(distance<0?-1:1));}}
    return {depth,normal};
  }
  function resolveContact(f){const hit=contact(f);if(!hit)return;const u=f.upperStage,cm=mass(f),um=P.mass(u),normal=hit.normal,closing=(f.state[3]-u.state[3])*normal[0]+(f.state[4]-u.state[4])*normal[1];
    // Contact transfers momentum; it must not remove atmospheric drag or reset orbital velocity.
    for(let i=0;i<2;i++){f.state[i]+=normal[i]*(hit.depth+.001)*um/(cm+um);u.state[i]-=normal[i]*(hit.depth+.001)*cm/(cm+um);if(closing<0){f.state[i+3]-=normal[i]*closing*um/(cm+um);u.state[i+3]+=normal[i]*closing*cm/(cm+um);}}
    f.maxHeight=Math.max(f.maxHeight,O.elements(f.state).height);u.maxHeight=Math.max(u.maxHeight,O.elements(u.state).height);
  }
  const thrust=f=>!terminal(f)&&f.controls.lit&&f.capsule.fuel>0&&f.capsule.chute.phase==='stowed'?3000*f.controls.throttle:0;
  const angle=f=>f.controls.mode==='hold'?f.attitude:f.controls.mode==='tilt'?Math.atan2(f.state[1],f.state[0])+f.controls.angle*Math.PI/180:Math.atan2(f.state[4],f.state[3])+(f.controls.mode==='retrograde'?Math.PI:0);
  const localAngle=f=>O.wrap(f.attitude-Math.atan2(f.state[1],f.state[0]))*180/Math.PI;
  function reentry(f,atmosphere){const o=O.elements(f.state),heading=Math.atan2(f.state[4],f.state[3]),facing=-Math.cos(f.attitude-heading);return {pathAngle:Math.atan2(o.radial,Math.abs(o.tangential))*180/Math.PI,shieldAngle:Math.acos(Math.max(-1,Math.min(1,facing)))*180/Math.PI,targetAngle:O.wrap(heading+Math.PI-Math.atan2(f.state[1],f.state[0]))*180/Math.PI,flux:Math.sqrt(atmosphere(o.height))*(o.speed/7800)**3,protected:facing>.8};}
  function chuteLoad(f){const x=Math.max(0,Math.min(1,-O.elements(f.state).radial/3));return x*x*(3-2*x);}
  function area(f){const c=f.capsule.chute;
    if(c.phase==='stowed'){
      const o=O.elements(f.state),forward=(Math.cos(f.attitude)*f.state[3]+Math.sin(f.attitude)*f.state[4])/Math.max(1,o.speed);
      // shortcut: nose-first ascent shares a ballistic-coefficient reference for gentle release; calibrate independent aerodynamics for CFD fidelity.
      return f.upperStage&&o.radial>0&&forward>=0?Math.min(1.5,mass(f)*P.CORE_DRAG_AREA/P.mass(f.upperStage)):1.5;
    }
    const age=Math.max(0,f.t-(c.since??f.t)),smooth=x=>{x=Math.min(1,x);return x*x*(3-2*x);},opened=c.phase==='drogue-opening'?8*smooth(age/2):c.phase==='drogue'?8:c.phase==='main-opening'?8+110.5*smooth(age/4):118.5;return 1.5+opened*chuteLoad(f);
  }

  function chute(f,rho,report){const c=f.capsule.chute,o=O.elements(f.state),h=S.clearance(f.state,f.t),q=.5*rho*o.speed**2;if(!c.armed||terminal(f)||o.radial>=0||thrust(f)>0||rho<=0)return;
    if(c.phase==='stowed'&&h<=8000&&o.speed<=250&&q<=10000){c.phase='drogue-opening';c.since=f.t;f.controls.lit=false;report?.(c.phase,c.since,f);}
    if(c.phase==='drogue-opening'&&f.t-c.since>=2)c.phase='drogue';
    if(c.phase==='drogue'&&h<=3000&&o.speed<=80&&q<=4000){c.phase='main-opening';c.since=f.t;report?.(c.phase,c.since,f);}
    if(c.phase==='main-opening'&&f.t-c.since>=4)c.phase='main';
  }
  function settle(f){if(['landed','impact'].includes(f.status)){f.state[3]=f.state[4]=f.state[5]=0;f.controls.lit=false;const r=Math.hypot(f.state[0],f.state[1]),ground=S.radius(f.state,f.t);f.state[0]*=ground/r;f.state[1]*=ground/r;f.maxHeight=Math.max(f.maxHeight,ground-P.R);}}
  function contactVelocity(q,t){
    const r=Math.hypot(q[0],q[1]),a=Math.atan2(q[1],q[0]),e=20/P.R;
    const sample=b=>S.radius([r*Math.cos(b),r*Math.sin(b),0,0,0,0],t),slope=(sample(a+e)-sample(a-e))/40,n=Math.sqrt(1+slope*slope),radial=(q[0]*q[3]+q[1]*q[4])/r,tangent=(-q[1]*q[3]+q[0]*q[4])/r;
    const lateral=(tangent+slope*radial)/n;return {normal:Math.abs((radial-slope*tangent)/n),tangent:Math.abs(lateral),lateral,slope};
  }
  function landingPose(f,age,water,reduced=false){
    const hit=f.capsule.touchdown||{},lateral=hit.lateral||0,slope=hit.slope||0,speed=Math.abs(lateral),direction=Math.sign(lateral)||-Math.sign(slope)||1,base=Math.atan2(f.state[1],f.state[0])-f.attitude;
    const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);},t=Math.max(0,age),blend=reduced?smooth(t/.45):t>=6?1:1-(1+3*t)*Math.exp(-3*t);
    const tipped=smooth((speed+Math.abs(slope)*3-2.2)/2.4),target=water?-direction*Math.min(.18,speed*.04):Math.atan(slope)-direction*tipped*1.45,delta=Math.atan2(Math.sin(target-base),Math.cos(target-base));
    const rock=reduced||t>=6?0:-direction*Math.min(.5,.06+speed*.09)*t*Math.exp(-1.6*t)*Math.sin(5.2*t),ramp=reduced?blend:1-Math.exp(-1.8*t);
    // shortcut: damped contact response and buoyancy are visual; use a rigid-body solver for interacting wrecks.
    const angle=delta*blend+rock+(water&&!reduced?(.035*Math.sin(1.1*t)+.018*Math.sin(1.7*t))*ramp:0);
    const heave=water?-.55*ramp+(reduced?0:(.06*Math.sin(1.4*t)+.025*Math.sin(2.3*t))*ramp-.55*Math.min(1,(hit.normal||0)/6)*t*Math.exp(-2*t)):reduced||t>=6?0:Math.max(0,Math.sin(5*t))*t*Math.exp(-2*t)*Math.min(6,hit.normal||0)*.035;
    return {angle,heave,tipped:!water&&tipped>.6,water};
  }
  function stepCapsule(f,dt,atmosphere,report){
    if(terminal(f)){f.t+=dt;settle(f);return;}
    const c=f.capsule,o=O.elements(f.state),startTime=f.t;chute(f,atmosphere(o.height),report);
    const underChute=c.chute.phase!=='stowed',load=underChute&&atmosphere(o.height)>1e-5?chuteLoad(f)*Math.min(1,(area(f)-1.5)/8):0,target=underChute?Math.atan2(f.state[4],f.state[3])+Math.PI:angle(f),delta=Math.atan2(Math.sin(target-f.attitude),Math.cos(target-f.attitude));
    const turn=Math.sign(delta)*Math.min(Math.abs(delta),12*Math.PI/180*dt*(underChute?load:1));
    f.attitude=O.wrap(f.attitude+turn);
    const force=thrust(f),flow=force/(300*P.G0),h=Math.min(dt,flow?c.fuel/flow:dt),a=f.attitude,cd=area(f),start=f.state.slice(),m=mass(f);
    const derivative=q=>{const r=Math.hypot(q[0],q[1]),v=Math.hypot(q[3],q[4]),drag=.5*atmosphere(r-P.R)*cd*v,g=P.MU/r**3;return [q[3],q[4],0,-g*q[0]+(force*Math.cos(a)-drag*q[3])/m,-g*q[1]+(force*Math.sin(a)-drag*q[4])/m,0];};
    const integrate=t=>{const add=(q,k,s)=>q.map((v,i)=>v+k[i]*s),k1=derivative(start),k2=derivative(add(start,k1,t/2)),k3=derivative(add(start,k2,t/2)),k4=derivative(add(start,k3,t));return start.map((v,i)=>v+t/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));};
    let next=integrate(h),used=h;
    // Locate contact within terrain cells as in the launcher integrator.
    const samples=Math.max(1,Math.ceil(Math.hypot(next[0]-start[0],next[1]-start[1])/250));
    if(Math.min(Math.hypot(...start.slice(0,2)),Math.hypot(...next.slice(0,2)))<P.R+S.MAX_HEIGHT+1000){for(let i=1;i<=samples;i++){if(S.clearance(integrate(h*i/samples),f.t+h*i/samples)<=0){let lo=h*(i-1)/samples,hi=h*i/samples;for(let j=0;j<30;j++){const mid=(lo+hi)/2;if(S.clearance(integrate(mid),f.t+mid)>0)lo=mid;else hi=mid;}used=hi;next=integrate(used);
      c.touchdown=contactVelocity(next,f.t+used);
      f.status=Math.hypot(next[3],next[4])<20?'landed':'impact';
      const r=Math.hypot(next[0],next[1]),ground=S.radius(next,f.t+used);next[0]*=ground/r;next[1]*=ground/r;next[3]=next[4]=0;break;}}}
    if(Math.hypot(next[0],next[1])>P.R+1e8){let lo=0,hi=h;for(let j=0;j<32;j++){const mid=(lo+hi)/2;if(Math.hypot(...integrate(mid).slice(0,2))<=P.R+1e8)lo=mid;else hi=mid;}used=lo;next=integrate(lo);f.status='escaped';}
    f.state=next;f.t+=dt;c.fuel=Math.max(0,c.fuel-flow*used);
    const end=O.elements(next),entry=reentry(f,atmosphere);
    // shortcut: normalized thermal dose, not material temperature; recalibrate for lifting reentry.
    c.heat=Math.min(1,c.heat+entry.flux*used*(entry.protected?.15:1.5));
    if(c.heat>=1)f.status='destroyed';if(end.height>=1e8){f.status='escaped';}
    if(terminal(f)||c.fuel<=1e-8)f.controls.lit=false;
    if(f.status==='destroyed')report?.(f.status,f.t,f);
    else if(f.status==='landed'||f.status==='impact')report?.(f.status,startTime+used,f);
    settle(f);f.maxHeight=Math.max(f.maxHeight,end.height);chute(f,atmosphere(end.height),report);
  }
  function canSeparate(f){return Boolean(f?.capsule&&!f.capsule.detached&&f.status==='flying'&&!P.attached(f)&&(f.craft.stages.length===1||f.separated)&&(!f.controls.lit||f.controls.throttle===0||f.fuel[f.active]===0));}
  function separate(f,makeFlight){if(!canSeparate(f))return false;const index=f.craft.stages.length-1,c=P.clone(f.craft),stage=c.stages[index];c.stages=[stage];c.separator=false;c.capsule=false;delete c.boosters;
    const u=makeFlight(c,'own',f.state);delete u.capsule;delete u.upperStage;delete u.controlled;u.fuel=[f.fuel[index],null];u.t=f.t;u.status='flying';u.attitude=f.attitude;u.controls={...f.controls,lit:false};u.maxHeight=f.maxHeight;u.heat=0;u.auto={mode:'waiting',separatedAt:f.t};
    const releaseSpeed=1,cm=mass(f),um=P.mass(u),axis=[Math.cos(f.attitude),Math.sin(f.attitude)],gap=2+P.tanks(stage).reduce((sum,k)=>sum+({small:2.4,medium:3.25,large:4.1})[k],0)+.3;
    for(let i=0;i<2;i++){const push=axis[i]*releaseSpeed;f.state[i]+=axis[i]*gap;f.state[i+3]+=push*um/(cm+um);u.state[i+3]-=push*cm/(cm+um);}
    f.maxHeight=Math.max(f.maxHeight,O.elements(f.state).height);f.fuel=f.fuel.map(v=>v===null?null:0);f.capsule.detached=true;f.controls={...f.controls,mode:'hold',throttle:1,lit:false};u.controls.mode='hold';f.upperStage=u;f.controlled='main';return true;
  }
  function program(f){const u=f.upperStage;if(!u||terminal(u)||u.auto.mode==='manual')return;const o=O.elements(u.state),gap=Math.hypot(u.state[0]-f.state[0],u.state[1]-f.state[1]);u.controls.lit=false;
    if(o.bound&&o.hp<=60000){u.auto.mode='coasting';return;}
    if(u.fuel[0]<=0){u.auto.mode='no-fuel';return;}
    if(f.t-u.auto.separatedAt<10||gap<50){u.auto.mode='waiting';return;}
    u.controls.mode='retrograde';const error=Math.abs(Math.atan2(Math.sin(angle(u)-u.attitude),Math.cos(angle(u)-u.attitude)));u.auto.mode=error>5*Math.PI/180?'turning':'burning';u.controls.lit=u.auto.mode==='burning';u.controls.throttle=Math.min(.2,Math.max(.005,(o.hp-60000)/1e6));
  }
  function advance(s,seconds,budget,step,atmosphere,report){const f=s.flight,start=f.t,target=Math.min(604800,start+seconds);let steps=0;
    while(f.t<target-1e-9&&steps<budget){const u=f.upperStage,wasLit=u?.controls.lit;program(f);if(u?.controls.lit&&!wasLit)report?.('ignite',f.t,u);const bodies=[f,u].filter(b=>b&&!terminal(b)),fine=bodies.some(b=>b.controls.lit||O.elements(b.state).height<=120000)||['waiting','turning','burning'].includes(u?.auto.mode);let dt=Math.min(fine?.1:2,target-f.t);if(u&&!terminal(f)&&!terminal(u)){const distance=Math.hypot(f.state[0]-u.state[0],f.state[1]-u.state[1]),reach=stageHeight(u)+10;const relative=Math.hypot(f.state[3]-u.state[3],f.state[4]-u.state[4]);if(distance<=reach+1)dt=Math.min(dt,.02,.25/Math.max(1,relative));else if(relative>0)dt=Math.min(dt,(distance-reach)/relative);}for(const b of bodies){const o=O.elements(b.state);if(o.height>120000&&o.radial<0)dt=Math.min(dt,Math.max(.001,(o.height-120000)/-o.radial));}stepCapsule(f,dt,atmosphere,report);if(u&&!terminal(u)){for(let j=0;j<3&&u.t<f.t-1e-9&&!terminal(u);j++)step(u,Math.min(dt,f.t-u.t));const hitTime=u.t;u.t=f.t;const o=O.elements(u.state);u.heat=Math.min(1,u.heat+Math.sqrt(atmosphere(o.height))*(o.speed/7800)**3*dt*.25);if(u.heat>=1){u.status='destroyed';u.controls.lit=false;}if(u.status==='destroyed')report?.(u.status,u.t,u);else if(u.status==='impact')report?.(u.status,hitTime,u);if(terminal(u))u.auto.mode='done';}if(u){u.t=f.t;settle(u);}resolveContact(f);steps++;if(terminal(f)&&(!u||terminal(u))){s.phase='ended';break;}}
    return {elapsed:f.t-start,steps,limited:f.t<target-1e-7};
  }
  const selected=f=>f?.controlled==='upper'&&f.upperStage?f.upperStage:f;
  return Object.freeze({fresh,mass,thrust,localAngle,reentry,chuteLoad,area,stageHeight,contact,resolveContact,contactVelocity,landingPose,terminal,canSeparate,separate,advance,selected,stepCapsule});
});
