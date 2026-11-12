'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),R=require('./recovery'),T=require('./test-support');
function orbit(){let s=T.launched();s.phase='coast';const f=s.flight;Object.assign(f,{t:1,status:'flying',state:O.circular(200000),maxHeight:200000,active:1,separated:true,fuel:[0,500],attitude:Math.PI/2});f.controls.lit=false;return s;}
function continueCheck(s){T.validate(s);let next=P.clone(s);if(next.phase==='ended')next=M.change(next,{type:'workshop'});else M.advance(next,.1);T.validate(next);return s;}
let s=orbit(),before=P.clone(s.flight),m=P.mass(before);s=M.change(s,{type:'capsule-separate'});let f=s.flight;assert.ok(f.capsule.detached);assert.ok(Math.abs(P.mass(f)+P.mass(f.upperStage)-m)<1e-8);for(const i of [3,4])assert.ok(Math.abs(P.mass(f)*f.state[i]+P.mass(f.upperStage)*f.upperStage.state[i]-m*before.state[i])<1e-7);assert.equal(O.elements(f.state).height>199990,true);continueCheck(s);
s=M.change(s,{type:'control',key:'mode',value:'retrograde'});M.advance(s,16);s=M.change(s,{type:'ignite'});while(O.elements(s.flight.state).hp>60000&&s.flight.t<100)M.advance(s,.1);assert.ok(O.elements(s.flight.state).hp<=60000);s=M.change(s,{type:'stop'});s=M.change(s,{type:'chute-arm'});assert.equal(s.flight.capsule.chute.phase,'stowed');const entrySnapshot=P.clone(s);
const events=[],seen=new Set();for(let i=0;i<10000;i++){M.advance(s,1);f=s.flight;const c=f.capsule;if(!seen.has(c.chute.phase)){seen.add(c.chute.phase);events.push({t:f.t,chute:c.chute.phase,height:O.elements(f.state).height,speed:O.elements(f.state).speed,heat:c.heat});continueCheck(s);}if(i%100===0)continueCheck(s);if(R.terminal(f))break;}
f=s.flight;assert.equal(f.status,'landed',JSON.stringify({status:f.status,events,heat:f.capsule.heat,t:f.t}));assert.ok(f.capsule.touchdown.normal<=6);assert.ok(f.capsule.touchdown.tangent<=5);assert.ok(seen.has('drogue-opening')&&seen.has('main-opening')&&seen.has('main'));continueCheck(s);M.advance(s,10);continueCheck(s);
let empty=M.change(orbit(),{type:'capsule-separate'});empty.flight.upperStage.fuel[0]=0;M.advance(empty,100);assert.equal(empty.flight.upperStage.auto.mode,'no-fuel');assert.ok(O.safe(empty.flight.upperStage.state));
console.log('Capsule return: mass/momentum, independent deorbit, 200km braking, thermal entry, both parachutes, safe touchdown, independent physical continuations passed.');

let real=T.reachOrbit();const injection=O.elements(real.flight.state);real=M.change(real,{type:'capsule-separate'});real=M.change(real,{type:'control',key:'mode',value:'retrograde'});M.advance(real,16);real=M.change(real,{type:'ignite'});for(let i=0;i<1000&&O.elements(real.flight.state).hp>60000;i++)M.advance(real,.1);real=M.change(real,{type:'stop'});real=M.change(real,{type:'chute-arm'});for(let i=0;i<10000&&!R.terminal(real.flight);i++)M.advance(real,1);assert.equal(real.flight.status,'landed');continueCheck(real);console.log(JSON.stringify({productionLaunchAndReturn:true,injection:[injection.hp,injection.ha],touchdown:real.flight.capsule.touchdown,time:real.flight.t,fuel:real.flight.capsule.fuel}));

for(const phase of ['stowed','main']){
 for(const [radial,tangent,expected]of [[19.99,0,'landed'],[20.01,0,'impact'],[12,15,'landed'],[14,15,'impact']]){
  const s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight;
  f.state=[P.R+.00001,0,0,-radial,tangent,0];f.capsule.chute={armed:phase==='main',phase,since:phase==='main'?f.t-5:null};
  M.advance(s,.001);
  assert.equal(f.status,expected,phase+' '+radial+'/'+tangent);
  const hit=f.capsule.touchdown;
  assert.equal(Math.hypot(hit.normal,hit.tangent)<20,expected==='landed');
  assert.equal(O.elements(f.state).speed,0);
  continueCheck(s);
 }
}
{
 const f=M.change(orbit(),{type:'capsule-separate'}).flight;
 f.state=[P.R,0,0,-12,16,0];
 R.stepCapsule(f,0,M.atmosphere);
 assert.equal(f.status,'impact','Exactly 20 m/s is outside the safe range');
}
let manual=M.change(orbit(),{type:'capsule-separate'});manual=M.change(manual,{type:'select-body',value:'upper'});manual=M.change(manual,{type:'control',key:'throttle',value:.25});assert.equal(manual.flight.upperStage.auto.mode,'manual');assert.equal(manual.flight.upperStage.controls.throttle,.25);assert.equal(manual.flight.controls.throttle,1);continueCheck(manual);manual=M.change(manual,{type:'auto-dispose'});assert.equal(manual.flight.upperStage.auto.mode,'waiting');continueCheck(manual);
console.log('20 m/s total touchdown threshold with and without parachutes, background continuation and manual/automatic control passed.');


let wrong=M.change(entrySnapshot,{type:'control',key:'angle',value:0});for(let i=0;i<10000&&!R.terminal(wrong.flight);i++)M.advance(wrong,1);assert.equal(wrong.flight.status,'destroyed');assert.equal(wrong.flight.capsule.heat,1);continueCheck(wrong);console.log('Thermal comparison: protected retrograde entry lands; exposed orientation exhausts protection and exhausts the heat shield.');


for(const height of [27000,60000,100000,200000])for(const attitude of [0,.7,Math.PI/2]){
 let s=orbit(),f=s.flight;f.state=height===200000?O.circular(height):[P.R+height,0,0,1000,0,0];f.attitude=attitude;f.controls={mode:'tilt',angle:attitude*180/Math.PI,throttle:0,lit:false};const original=f.state.slice(3);s=M.change(s,{type:'capsule-separate'});f=s.flight;assert(Math.hypot(...f.state.slice(3).map((v,i)=>v-original[i]))<1.2);assert(Math.abs(Math.hypot(f.state[3]-f.upperStage.state[3],f.state[4]-f.upperStage.state[4])-1)<1e-8);
 for(let i=0;i<800;i++){M.advance(s,.01);assert.equal(R.contact(s.flight),null,'No overlap at '+height+'/'+attitude+'/'+i);if(i===100)continueCheck(s);}continueCheck(s);
}
{
 const s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight,u=f.upperStage;f.state[1]-=.5;const before=[3,4].map(i=>R.mass(f)*f.state[i]+P.mass(u)*u.state[i]);f.state[3]=u.state[3];f.state[4]=u.state[4]-2;const momentum=[3,4].map(i=>R.mass(f)*f.state[i]+P.mass(u)*u.state[i]);assert(R.contact(f));R.resolveContact(f);assert.equal(R.contact(f),null);for(const [j,i]of [3,4].entries())assert(Math.abs(R.mass(f)*f.state[i]+P.mass(u)*u.state[i]-momentum[j])<1e-7);
}
console.log('Capsule separation: inherited velocity, gentle spring impulses, twelve altitude/attitude cases, mass-weighted nonpenetration, momentum and physical continuations passed.');

{
 const s=orbit(),f=s.flight;f.state=[P.R+200000,0,0,1000,0,0];f.attitude=0;f.controls={mode:'tilt',angle:0,throttle:0,lit:false};M.advance(s,2);assert.equal(f.attitude,0);assert.equal(f.state[1],0);assert.equal(f.state[4],0);assert.equal(f.capsule.detached,false);
}
// A pending steering target must not rotate either body after the release.
for(const actual of [0,.7,Math.PI/2]){
 let s=orbit();s.flight.state=[P.R+200000,0,0,1000,0,0];s.flight.attitude=actual;s.flight.controls={mode:'tilt',angle:120,throttle:0,lit:false};s=M.change(s,{type:'capsule-separate'});const f=s.flight,u=f.upperStage,axis=[Math.cos(actual),Math.sin(actual)],dv=[f.state[3]-u.state[3],f.state[4]-u.state[4]];
 assert(Math.abs(dv[0]*axis[1]-dv[1]*axis[0])<1e-10);assert(Math.abs(dv[0]*axis[0]+dv[1]*axis[1]-1)<1e-10);assert.equal(f.controls.mode,'hold');assert.equal(u.controls.mode,'hold');continueCheck(s);M.advance(s,2);assert(Math.abs(f.attitude-actual)<1e-12);assert(Math.abs(u.attitude-actual)<1e-12);if(actual===0){assert.equal(f.state[1],0);assert.equal(u.state[1],0);assert.equal(f.state[4],0);assert.equal(u.state[4],0);}continueCheck(s);
}
console.log('Axial-only 1m/s release, no lateral impulse, actual attitude hold and independent continuation passed.');

{
 let s=orbit();s.flight.controls.throttle=0;s=M.change(s,{type:'capsule-separate'});const f=s.flight,u=f.upperStage;assert.equal(f.controls.throttle,1);assert.equal(u.controls.throttle,0);assert.equal(f.controls.lit,false);const start=Math.hypot(f.state[0]-u.state[0],f.state[1]-u.state[1]);s=M.change(s,{type:'ignite'});assert.equal(R.thrust(s.flight),3000);M.advance(s,2);assert(Math.hypot(s.flight.state[0]-s.flight.upperStage.state[0],s.flight.state[1]-s.flight.upperStage.state[1])>start+8);assert(s.flight.capsule.fuel<30);continueCheck(s);
}
console.log('Capsule ignition starts with its own 100% throttle after a zero-throttle stage; real fuel burn opens the gap.');


for(const height of [1,10,100,500])for(const speed of [2,20]){
 let s=T.launched();Object.assign(s.flight,{state:[P.R+height,0,0,speed,0,0],status:'flying',t:1,maxHeight:height});s.phase='coast';s=M.change(s,{type:'separate'});s=M.change(s,{type:'capsule-separate'});let f=s.flight;assert(Math.abs(f.state[3]-f.upperStage.state[3]-1)<1e-8);assert.equal(f.state[4],0);const initial=f.state[0]-f.upperStage.state[0];M.advance(s,.25);assert(s.flight.state[0]-s.flight.upperStage.state[0]>initial+.1);s=M.change(s,{type:'ignite'});for(let i=0;i<60;i++)M.advance(s,.1);f=s.flight;assert.equal(f.status,'flying');assert(O.elements(f.state).height>height+80);assert(f.state[0]-f.upperStage.state[0]>initial+50);assert.equal(f.attitude,0);assert.equal(f.state[4],0);assert(f.capsule.fuel<30);continueCheck(s);
}
console.log('Near-ground release uses the same 1m/s impulse; prompt manual ignition gives independent ascent.');

for(const remaining of [0,500,3000,6000]){
 let s=T.singlePad(0,0,1);Object.assign(s.flight,{state:[P.R+4163.4,0,0,277.5,0,0],status:'flying',t:40,maxHeight:4163.4,fuel:[remaining,null]});s.phase='coast';s=M.change(s,{type:'capsule-separate'});const initial=s.flight.state[0]-s.flight.upperStage.state[0]-R.stageHeight(s.flight.upperStage);let last=initial;
 for(let i=0;i<80;i++){M.advance(s,.05);const f=s.flight,u=f.upperStage,gap=f.state[0]-u.state[0]-R.stageHeight(u);assert(gap>=last-1e-6&&gap<initial+4.5);assert.equal(f.state[1],0);assert.equal(u.state[1],0);assert.equal(f.attitude,0);assert.equal(u.attitude,0);assert(f.state[3]>u.state[3]);assert.equal(R.contact(f),null);last=gap;if(i===20)continueCheck(s);}continueCheck(s);
 s=M.change(s,{type:'ignite'});M.advance(s,2);assert(s.flight.state[0]-s.flight.upperStage.state[0]-R.stageHeight(s.flight.upperStage)>last+5);continueCheck(s);
 // Already-touching drafts also move forward when the existing capsule engine is burning.
 let f=s.flight,u=f.upperStage;f.state=[P.R+4163.4,0,0,277.5,0,0];u.state=[f.state[0]-R.stageHeight(u)-.001,0,0,277.5,0,0];f.capsule.fuel=25.9;f.t=u.t=44;u.auto.separatedAt=40;continueCheck(s);M.advance(s,1);assert(f.state[0]-u.state[0]-R.stageHeight(u)>.5);assert.equal(f.state[1],0);assert.equal(u.state[1],0);assert.equal(f.state[4],0);assert.equal(u.state[4],0);assert.equal(f.attitude,0);continueCheck(s);
}
console.log('4163.4m / 277.5m/s: empty/full cores stay behind; unlit release grows gradually for four seconds, ignition accelerates only the capsule and already touching poses recover without side kicks.');

{
 const s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight;f.state=[P.R+4163.4,0,0,277.5,0,0];f.attitude=0;assert(Math.abs(R.area(f)/R.mass(f)-P.CORE_DRAG_AREA/P.mass(f.upperStage))<1e-14);f.attitude=Math.PI;assert.equal(R.area(f),1.5);f.attitude=0;f.state[3]=-277.5;assert.equal(R.area(f),1.5);f.capsule.chute={armed:true,phase:'drogue',since:0};assert.equal(R.area(f),9.5);
}
console.log('The shared ascent drag reference is explicit; retrograde, descent and parachutes retain the original drag areas.');

for(const remaining of [0,6000])for(const attitude of [.7,1.1,Math.PI/2]){
 let s=T.singlePad(0,0,1);Object.assign(s.flight,{state:[P.R+4163.4,0,0,277.5,0,0],status:'flying',t:40,maxHeight:4163.4,fuel:[remaining,null],attitude});s.phase='coast';s=M.change(s,{type:'capsule-separate'});const axis=[Math.cos(attitude),Math.sin(attitude)];let last=.3;for(let i=0;i<80;i++){M.advance(s,.05);const f=s.flight,u=f.upperStage,dx=f.state[0]-u.state[0],dy=f.state[1]-u.state[1],gap=dx*axis[0]+dy*axis[1]-R.stageHeight(u),cross=-(f.state[3]-u.state[3])*axis[1]+(f.state[4]-u.state[4])*axis[0];assert(gap>=last-1e-5);assert(Math.abs(cross)<.5);assert(Math.abs(f.attitude-attitude)<1e-12&&Math.abs(u.attitude-attitude)<1e-12);last=gap;}assert(last>2);continueCheck(s);
}
console.log('Gentle forward release also holds during 40/63/90-degree steering, with empty/full cores and no imposed side impulse.');

// Full-circle commands retain one local frame even when tangential motion reverses.
for(const body of ['main','upper'])for(const value of [0,2,180,182,270,358,359.99]){
 let a=M.change(orbit(),{type:'capsule-separate'});a=M.change(a,{type:'select-body',value:body});a=M.change(a,{type:'control',key:'angle',value});assert.equal(R.selected(a.flight).controls.angle,value);assert.equal(R.selected(a.flight).controls.mode,'tilt');continueCheck(a);
}
for(const value of [-1,360,361,NaN,Infinity]){
 const a=M.change(orbit(),{type:'capsule-separate'}),changed=M.change(a,{type:'control',key:'angle',value});assert.equal(changed.flight.controls.angle,a.flight.controls.angle);
}
for(const tangent of [-100,100]){
 const a=M.change(orbit(),{type:'capsule-separate'}),f=a.flight;f.state=[P.R+200000,0,0,0,tangent,0];f.attitude=3*Math.PI/2;f.controls={mode:'tilt',angle:270,throttle:0,lit:false};R.stepCapsule(f,.1,M.atmosphere);assert(Math.abs(Math.atan2(Math.sin(f.attitude-3*Math.PI/2),Math.cos(f.attitude-3*Math.PI/2)))<1e-9);
}
const hot=M.change(orbit(),{type:'capsule-separate'}).flight;hot.state=[P.R+65000,0,0,-600,7400,0];hot.attitude=Math.atan2(7400,-600)+Math.PI;hot.controls.mode='hold';const safeEntry=R.reentry(hot,M.atmosphere);assert(safeEntry.protected&&safeEntry.shieldAngle<1e-5&&safeEntry.pathAngle<0&&safeEntry.flux>.001);const protectedFlight=P.clone(hot),exposed=P.clone(hot);exposed.attitude=O.wrap(hot.attitude+Math.PI);R.stepCapsule(protectedFlight,.1,M.atmosphere);R.stepCapsule(exposed,.1,M.atmosphere);assert(exposed.capsule.heat>protectedFlight.capsule.heat*9);assert(!R.reentry(exposed,M.atmosphere).protected);
console.log('360-degree local attitude: both bodies, reverse tangential velocity, invalid boundary rejection, continued flight and shared reentry angles/thermal protection passed.');


for(const fuel of [0,30])for(const [angle,sign]of [[358,-1],[2,1]]){
 const s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight;
 f.state=[P.R+200000,0,0,100,0,0];f.attitude=0;f.capsule.fuel=fuel;
 const command=M.change(s,{type:'control',key:'angle',value:angle}),steered=command.flight;
 R.stepCapsule(steered,.1,M.atmosphere);
 const turn=Math.atan2(Math.sin(steered.attitude),Math.cos(steered.attitude));
 assert(Math.abs(turn-sign*12*Math.PI/180*.1)<1e-9);
 assert.equal(steered.capsule.fuel,fuel);
 if(!fuel){
  const lit=M.change(command,{type:'ignite'}).flight;
  assert.equal(lit.controls.lit,false);
  assert.equal(R.thrust(lit),0);
 }
}
console.log('Cross-zero steering turns at the same RCS rate with or without return-engine fuel.');

for(const radial of [0,1,30]){const a=M.change(orbit(),{type:'capsule-separate'}).flight;a.state=[P.R+5000,0,0,radial,0,0];a.capsule.chute.armed=true;a.controls.lit=false;R.stepCapsule(a,radial===0?0:.01,M.atmosphere);assert.equal(a.capsule.chute.phase,'stowed');}
const chuteFlight=M.change(orbit(),{type:'capsule-separate'}).flight;chuteFlight.state=[P.R+5000,0,0,-20,0,0];chuteFlight.capsule.chute={armed:true,phase:'main',since:0};chuteFlight.t=5;chuteFlight.attitude=Math.PI/2;const fullArea=R.area(chuteFlight),fuelBefore=chuteFlight.capsule.fuel;R.stepCapsule(chuteFlight,.1,M.atmosphere);assert(chuteFlight.attitude<Math.PI/2&&chuteFlight.attitude>Math.PI/2-13*Math.PI/180*.1);assert.equal(chuteFlight.capsule.fuel,fuelBefore);assert.equal(fullArea,120);
let lastArea=1.5;for(const radial of [20,1,0,-.1,-1,-2,-3,-20]){const a=P.clone(chuteFlight);a.state[3]=radial;const area=R.area(a);assert(area>=lastArea&&area<=120);lastArea=area;if(radial>=0)assert.equal(area,1.5);}
console.log('Parachute load: ascent stays armed, existing canopy unloads continuously at the apex, full descent area returns, and finite-rate aerodynamic alignment consumes no RCS fuel.');

let disposal=M.change(orbit(),{type:'capsule-separate'});const disposalFuel=disposal.flight.upperStage.fuel[0];M.advance(disposal,9);assert.equal(disposal.flight.upperStage.auto.mode,'waiting');assert.equal(disposal.flight.upperStage.fuel[0],disposalFuel);disposal=M.change(disposal,{type:'select-body',value:'upper'});assert.equal(disposal.flight.upperStage.auto.mode,'waiting');M.advance(disposal,200);assert(O.elements(disposal.flight.upperStage.state).hp<=60000);assert(disposal.flight.upperStage.fuel[0]<disposalFuel);assert.equal(disposal.flight.upperStage.auto.mode,'coasting');continueCheck(disposal);disposal=M.change(disposal,{type:'control',key:'angle',value:270});assert.equal(disposal.flight.upperStage.auto.mode,'manual');disposal=M.change(disposal,{type:'auto-dispose'});assert.equal(disposal.flight.upperStage.auto.mode,'waiting');M.advance(disposal,.1);assert.equal(disposal.flight.upperStage.auto.mode,'coasting');
console.log('Upper-stage disposal is automatic after safe separation, viewing does not cancel it, a real burn lowers periapsis, and manual takeover can resume the program.');

for(const point of [[P.R,0,0],T.remoteHill()]){
 const Surface=require('./surface'),s=M.change(orbit(),{type:'capsule-separate'}),u=s.flight.upperStage,t=704.6,a=Math.atan2(point[1],point[0]),axis=[Math.cos(a),Math.sin(a)],ground=Surface.radius(point,t);s.flight.t=u.t=t;u.state=[(ground+1)*axis[0],(ground+1)*axis[1],0,-120.4*axis[0],-120.4*axis[1],0].map(x=>x||0);u.maxHeight=Math.max(u.maxHeight,ground-P.R+1);u.attitude=a+Math.PI/2;u.controls={mode:'tilt',angle:0,throttle:1,lit:false};u.auto.mode='manual';u.fuel[0]=0;continueCheck(s);M.advance(s,.1);assert.equal(u.status,'impact');assert.equal(O.elements(u.state).speed,0);assert.equal(u.controls.lit,false);assert.equal(u.auto.mode,'done');assert(Math.abs(Surface.clearance(u.state,u.t))<1e-6);const position=u.state.slice(0,2),attitude=u.attitude,cap=s.flight.state.slice();continueCheck(s);M.advance(s,2);assert.equal(O.elements(u.state).speed,0);assert.equal(u.attitude,attitude);assert(Math.abs(Math.atan2(u.state[1],u.state[0])-Math.atan2(position[1],position[0]))<1e-12);assert(Math.abs(Surface.clearance(u.state,u.t))<1e-6);assert.notDeepEqual(s.flight.state,cap);continueCheck(s);
 // Existing impact poses may retain the instantaneous impact velocity.
 u.state[3]=120.4;continueCheck(s);M.advance(s,.1);assert.equal(O.elements(u.state).speed,0);continueCheck(s);
}
console.log('Detached upper-stage ground contacts freeze velocity, attitude and thrust; capsule continues; existing impact poses settle without schema changes.');

{
 const f={state:[P.R,0,0,0,0,0],attitude:0,capsule:{touchdown:{normal:5.2,lateral:0,slope:0}}};
 for(const lateral of [-4.5,-.3,0,.3,4.5]){f.capsule.touchdown.lateral=lateral;const saved=JSON.stringify(f);for(const water of [false,true]){const first=R.landingPose(f,0,water);assert.equal(first.angle,0);assert.equal(first.heave,0);let last=first;for(let i=1;i<=360;i++){const next=R.landingPose(f,i/60,water);assert(Number.isFinite(next.angle)&&Number.isFinite(next.heave));assert(Math.abs(next.angle-last.angle)<.1);assert(Math.abs(next.heave-last.heave)<.04);last=next;}if(water){assert(last.heave<-.4&&last.heave>-.7);assert(Math.abs(last.angle)<.26);assert.notEqual(last.heave,R.landingPose(f,7,true).heave);}else if(Math.abs(lateral)>4){assert(last.tipped);assert(Math.sign(last.angle)===-Math.sign(lateral));assert(Math.abs(last.angle)>1.3);}else assert(Math.abs(last.angle)<1e-8);assert.deepEqual(R.landingPose(f,6,water,true),R.landingPose(f,12,water,true));}assert.equal(JSON.stringify(f),saved);}
 const q=[P.R,0,0,-5,4,0],positive=R.contactVelocity(q,0),negative=R.contactVelocity([P.R,0,0,-5,-4,0],0);assert(positive.lateral>0&&negative.lateral<0);assert.equal(positive.tangent,Math.abs(positive.lateral));assert(Number.isFinite(positive.slope));f.capsule.touchdown={normal:5,lateral:0,slope:.2};assert(R.landingPose(f,6,false).angle>0);
}
console.log('Capsule settling: signed contact momentum, continuous direction-sensitive roll, low-speed stability, buoyancy and reduced-motion rest passed.');

{
 const Surface=require('./surface'),s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight,q=T.remoteHill(),r=Surface.radius(q,1000),a=Math.atan2(q[1],q[0]);
 Object.assign(f,{t:1000,status:'landed',state:[r*Math.cos(a),r*Math.sin(a),0,0,0,0]});f.controls.lit=false;f.upperStage.t=1000;f.upperStage.auto.mode='manual';f.upperStage.controls.lit=false;
 const position=f.state.slice(),direction=Surface.direction(f.state,1000),height=Surface.height(f.state,1000),water=Surface.isWater(f.state,1000);
 for(const t of [0,600,3600,86400]){assert.deepEqual(Surface.direction(f.state,t),direction);assert.equal(Surface.height(f.state,t),height);assert.equal(Surface.isWater(f.state,t),water);}
 for(const seconds of [1,20,100,1000]){const time=f.t,upper=f.upperStage.state.slice();M.advance(s,seconds);assert(f.t>time);assert.notDeepEqual(f.upperStage.state,upper);for(let i=0;i<6;i++)assert(Math.abs(f.state[i]-position[i])<1e-6);assert.equal(O.elements(f.state).speed,0);assert(Math.abs(Surface.clearance(f.state,f.t))<1e-6);}
 assert.deepEqual(Surface.direction([3,4,0],0),Surface.direction([3,4,0],10000));assert.deepEqual(Surface.direction([3,4,2],0),Surface.direction([3,4,2],10000));
}
console.log('Fixed terrain and landed capsule remain anchored across mission time while the independent upper stage continues.');
