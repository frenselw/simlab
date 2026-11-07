'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),D=require('./persistence'),R=require('./recovery'),S=require('./scoring'),T=require('./test-support');
function orbit(){let s=T.launched();s.phase='coast';const f=s.flight;Object.assign(f,{t:1,status:'flying',state:O.circular(200000),maxHeight:200000,active:1,separated:true,fuel:[0,500],attitude:Math.PI/2});f.controls.lit=false;return M.change(s,{type:'record'});}
function round(s){const a={version:1,activity:P.ACTIVITY,kind:'draft',answer:D.draft(s)};assert.ok(D.bytes(a)<=4000);const restored=D.decode(JSON.parse(JSON.stringify(a)),'draft');assert.deepEqual(restored,s);assert.equal(S.score(restored).score,S.score(s).score);let next=P.clone(restored);if(next.phase==='check')next=M.change(next,{type:'return'});if(next.phase==='ended')next=M.change(next,{type:'workshop'});else M.advance(next,.1);D.validate(next);return restored;}
let s=orbit(),before=P.clone(s.flight),m=P.mass(before);s=M.change(s,{type:'capsule-separate'});let f=s.flight;assert.ok(f.capsule.detached);assert.ok(Math.abs(P.mass(f)+P.mass(f.upperStage)-m)<1e-8);for(const i of [3,4])assert.ok(Math.abs(P.mass(f)*f.state[i]+P.mass(f.upperStage)*f.upperStage.state[i]-m*before.state[i])<1e-7);assert.equal(O.elements(f.state).height>199990,true);round(s);
const score=S.score(s).score;s=M.change(s,{type:'control',key:'mode',value:'retrograde'});M.advance(s,16);s=M.change(s,{type:'ignite'});while(O.elements(s.flight.state).hp>60000&&s.flight.t<100)M.advance(s,.1);assert.ok(O.elements(s.flight.state).hp<=60000);s=M.change(s,{type:'stop'});s=M.change(s,{type:'chute-arm'});assert.equal(s.flight.capsule.chute.phase,'stowed');const entrySnapshot=P.clone(s);
const events=[],seen=new Set();for(let i=0;i<10000;i++){M.advance(s,1);f=s.flight;const c=f.capsule;if(!seen.has(c.chute.phase)){seen.add(c.chute.phase);events.push({t:f.t,chute:c.chute.phase,height:O.elements(f.state).height,speed:O.elements(f.state).speed,heat:c.heat});round(s);}if(i%100===0)round(s);if(R.terminal(f))break;}
f=s.flight;assert.equal(f.status,'landed',JSON.stringify({status:f.status,events,heat:f.capsule.heat,t:f.t}));assert.ok(f.capsule.touchdown.normal<=6);assert.ok(f.capsule.touchdown.tangent<=5);assert.ok(seen.has('drogue-opening')&&seen.has('main-opening')&&seen.has('main'));assert.equal(S.score(s).score,score);round(s);M.advance(s,10);round(s);
const review={version:1,activity:P.ACTIVITY,kind:'review',answer:D.review(s)};assert.ok(D.bytes(review)<4000);assert.equal(S.score(D.decode(review,'review')).score,score);
for(const mutate of [s=>s.flight.capsule.fuel=31,s=>s.flight.capsule.chute.since=s.flight.t+1,s=>s.flight.upperStage.t++,s=>s.flight.fuel[1]=1,s=>s.flight.controlled='missing']){const bad=P.clone(s);mutate(bad);assert.throws(()=>D.validate(bad));}
let empty=M.change(orbit(),{type:'capsule-separate'});empty.flight.upperStage.fuel[0]=0;M.advance(empty,100);assert.equal(empty.flight.upperStage.auto.mode,'no-fuel');assert.ok(O.safe(empty.flight.upperStage.state));
console.log('Capsule return: mass/momentum, independent deorbit, 200km braking, thermal entry, both parachutes, safe touchdown, preserved score, round-trip/continuation and invalid states passed.');
console.log(JSON.stringify({events,touchdown:f.capsule.touchdown,shieldRemaining:1-f.capsule.heat,fuel:f.capsule.fuel,upper:f.upperStage.status,draftBytes:D.bytes({version:1,activity:P.ACTIVITY,kind:'draft',answer:D.draft(s)})}));

let real=T.reachOrbit();const injection=O.elements(real.flight.state),realScore=S.score(real).score;real=M.change(real,{type:'capsule-separate'});real=M.change(real,{type:'control',key:'mode',value:'retrograde'});M.advance(real,16);real=M.change(real,{type:'ignite'});for(let i=0;i<1000&&O.elements(real.flight.state).hp>60000;i++)M.advance(real,.1);real=M.change(real,{type:'stop'});real=M.change(real,{type:'chute-arm'});for(let i=0;i<10000&&!R.terminal(real.flight);i++)M.advance(real,1);assert.equal(real.flight.status,'landed');assert.equal(S.score(real).score,realScore);round(real);console.log(JSON.stringify({productionLaunchAndReturn:true,injection:[injection.hp,injection.ha],touchdown:real.flight.capsule.touchdown,time:real.flight.t,fuel:real.flight.capsule.fuel,score:S.score(real).score}));

for(const [normal,tangent,expected]of [[5.99,0,'landed'],[6.01,0,'impact'],[5,4.99,'landed'],[5,5.01,'impact']]){const s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight;f.state=[P.R+.00001,0,0,-normal,tangent,0];M.advance(s,.001);assert.equal(f.status,expected);round(s);}
let manual=M.change(orbit(),{type:'capsule-separate'});manual=M.change(manual,{type:'select-body',value:'upper'});manual=M.change(manual,{type:'control',key:'throttle',value:.25});assert.equal(manual.flight.upperStage.auto.mode,'manual');assert.equal(manual.flight.upperStage.controls.throttle,.25);assert.equal(manual.flight.controls.throttle,1);round(manual);manual=M.change(manual,{type:'auto-dispose'});assert.equal(manual.flight.upperStage.auto.mode,'waiting');round(manual);
console.log('Touchdown limits on both velocity components, background continuation and selected-body manual/automatic control passed.');

let maximum=M.fresh();for(const stage of [0,1]){if(stage)maximum=M.change(maximum,{type:'separator'});for(const a of [{type:'part',stage,part:'engine',value:stage?1:0},{type:'part',stage,part:'large',value:2},{type:'insert',stage,part:'medium',at:0},{type:'insert',stage,part:'small',at:1}])maximum=M.change(maximum,a);}maximum=M.change(maximum,{type:'capsule'});for(let i=0;i<2;i++)maximum=M.change(maximum,{type:'boosters'});maximum=M.change(M.change(maximum,{type:'launch'}),{type:'ignite'});maximum=M.change(maximum,{type:'control',key:'angle',value:31.23456789012345});maximum=M.change(maximum,{type:'control',key:'throttle',value:.7654321098765432});M.advance(maximum,100);maximum=M.change(maximum,{type:'jettison'});maximum=M.change(maximum,{type:'stop'});maximum=M.change(maximum,{type:'separate'});maximum=M.change(maximum,{type:'record'});maximum=M.change(maximum,{type:'capsule-separate'});assert(maximum.flight.capsule.detached&&maximum.flight.upperStage);maximum=M.change(maximum,{type:'check'});round(maximum);const maxReview={version:1,activity:P.ACTIVITY,kind:'review',answer:D.review(maximum),score:S.score(maximum).score,passed:S.score(maximum).passed},pending={version:1,activity:P.ACTIVITY,kind:'pending-final',payload:{reviewJson:JSON.stringify(maxReview),score:maxReview.score,maxScore:100,passed:maxReview.passed}};assert(D.bytes(pending)<=4000);console.log(JSON.stringify({maximumPartsTwoBodies:true,draftBytes:D.bytes(T.snapshot(maximum)),reviewBytes:D.bytes(maxReview),pendingBytes:D.bytes(pending)}));

const numberBound=value=>typeof value==='number'?-0.0000012345678901234567:Array.isArray(value)?value.map(numberBound):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,numberBound(v)])):value;
const boundReview=numberBound(maxReview),boundPending={...pending,payload:{...pending.payload,reviewJson:JSON.stringify(boundReview)}};assert(D.bytes(boundPending)+256<=4000);console.log(JSON.stringify({numericSpellingBoundWith256ByteVariantMargin:D.bytes(boundPending)+256}));

{
 const {Controller}=require('./ui-runtime'),Flow=require('../shared/activity-flow'),locked=new Controller({loadAttempt:()=>({state:'pending-final',snapshot:pending}),setDraftProvider(){},retryPending:()=>({activityState:'success',ok:true,review:maxReview,score:maxReview.score,status:maxReview.passed?'passed':'failed'})},Flow);
 locked.start();assert.equal(locked.mode,'frozen');assert(!locked.running);assert(locked.state.flight.upperStage);const canonical=JSON.stringify(locked.state);assert.equal(locked.command({type:'select-body',value:'upper'}),false);assert.equal(JSON.stringify(locked.state),canonical);locked.retryFinal();assert.equal(locked.mode,'review');assert(!locked.running);assert.deepEqual(D.review(locked.state),maxReview.answer);
 console.log('Two-body pending remains frozen and retries the same canonical answer into read-only review.');
}

let wrong=M.change(entrySnapshot,{type:'control',key:'angle',value:0});for(let i=0;i<10000&&!R.terminal(wrong.flight);i++)M.advance(wrong,1);assert.equal(wrong.flight.status,'destroyed');assert.equal(wrong.flight.capsule.heat,1);round(wrong);assert.equal(S.score(wrong).score,score);console.log('Thermal comparison: protected retrograde entry lands; exposed orientation exhausts protection and preserves the recorded orbit result.');

let legacy=T.reachOrbit();legacy.schema=6;legacy.modelVersion=4;for(const k of ['capsule','upperStage','controlled'])delete legacy.flight[k];for(const r of legacy.records)if(r){delete r.capsule;delete r.physicsVersion;}legacy.flight.controls.lit=true;legacy.flight.controls.throttle=0;legacy=M.change(legacy,{type:'record'});D.validate(legacy);assert.equal(legacy.records[0].engineOff,false);console.log('Ongoing model4 flights keep their legacy recording semantics at zero throttle.');

for(const height of [27000,60000,100000,200000])for(const attitude of [0,.7,Math.PI/2]){
 let s=orbit(),f=s.flight;f.state=height===200000?O.circular(height):[P.R+height,0,0,1000,0,0];f.attitude=attitude;f.controls={mode:'tilt',angle:attitude*180/Math.PI,throttle:0,lit:false};const original=f.state.slice(3);s=M.change(s,{type:'capsule-separate'});f=s.flight;assert(Math.hypot(...f.state.slice(3).map((v,i)=>v-original[i]))<1.2);assert(Math.abs(Math.hypot(f.state[3]-f.upperStage.state[3],f.state[4]-f.upperStage.state[4])-1)<1e-8);
 for(let i=0;i<800;i++){M.advance(s,.01);assert.equal(R.contact(s.flight),null,'No overlap at '+height+'/'+attitude+'/'+i);if(i===100)round(s);}round(s);
}
{
 const s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight,u=f.upperStage;f.state[1]-=.5;const before=[3,4].map(i=>R.mass(f)*f.state[i]+P.mass(u)*u.state[i]);f.state[3]=u.state[3];f.state[4]=u.state[4]-2;const momentum=[3,4].map(i=>R.mass(f)*f.state[i]+P.mass(u)*u.state[i]);assert(R.contact(f));R.resolveContact(f);assert.equal(R.contact(f),null);for(const [j,i]of [3,4].entries())assert(Math.abs(R.mass(f)*f.state[i]+P.mass(u)*u.state[i]-momentum[j])<1e-7);
}
console.log('Capsule separation: inherited velocity, gentle spring impulses, twelve altitude/attitude cases, mass-weighted nonpenetration, momentum and restore continuations passed.');

{
 const s=orbit(),f=s.flight;f.state=[P.R+200000,0,0,1000,0,0];f.attitude=0;f.controls={mode:'tilt',angle:0,throttle:0,lit:false};M.advance(s,2);assert.equal(f.attitude,0);assert.equal(f.state[1],0);assert.equal(f.state[4],0);assert.equal(f.capsule.detached,false);
}
// A pending steering target must not rotate either body after the release.
for(const actual of [0,.7,Math.PI/2]){
 let s=orbit();s.flight.state=[P.R+200000,0,0,1000,0,0];s.flight.attitude=actual;s.flight.controls={mode:'tilt',angle:120,throttle:0,lit:false};s=M.change(s,{type:'capsule-separate'});const f=s.flight,u=f.upperStage,axis=[Math.cos(actual),Math.sin(actual)],dv=[f.state[3]-u.state[3],f.state[4]-u.state[4]];
 assert(Math.abs(dv[0]*axis[1]-dv[1]*axis[0])<1e-10);assert(Math.abs(dv[0]*axis[0]+dv[1]*axis[1]-1)<1e-10);assert.equal(f.controls.mode,'hold');assert.equal(u.controls.mode,'hold');round(s);M.advance(s,2);assert(Math.abs(f.attitude-actual)<1e-12);assert(Math.abs(u.attitude-actual)<1e-12);if(actual===0){assert.equal(f.state[1],0);assert.equal(u.state[1],0);assert.equal(f.state[4],0);assert.equal(u.state[4],0);}round(s);
}
console.log('Axial-only 1m/s release, no lateral impulse, actual attitude hold and legal persistence continuation passed.');

{
 let s=orbit();s.flight.controls.throttle=0;s=M.change(s,{type:'capsule-separate'});const f=s.flight,u=f.upperStage;assert.equal(f.controls.throttle,1);assert.equal(u.controls.throttle,0);assert.equal(f.controls.lit,false);const start=Math.hypot(f.state[0]-u.state[0],f.state[1]-u.state[1]);s=M.change(s,{type:'ignite'});assert.equal(R.thrust(s.flight),3000);M.advance(s,2);assert(Math.hypot(s.flight.state[0]-s.flight.upperStage.state[0],s.flight.state[1]-s.flight.upperStage.state[1])>start+8);assert(s.flight.capsule.fuel<30);round(s);
}
console.log('Capsule ignition starts with its own 100% throttle after a zero-throttle stage; real fuel burn opens the gap.');


for(const height of [1,10,100,500])for(const speed of [2,20]){
 let s=T.launched();Object.assign(s.flight,{state:[P.R+height,0,0,speed,0,0],status:'flying',t:1,maxHeight:height});s.phase='coast';s=M.change(s,{type:'separate'});s=M.change(s,{type:'capsule-separate'});let f=s.flight;assert(Math.abs(f.state[3]-f.upperStage.state[3]-1)<1e-8);assert.equal(f.state[4],0);const initial=f.state[0]-f.upperStage.state[0];M.advance(s,.25);assert(s.flight.state[0]-s.flight.upperStage.state[0]>initial+.1);s=M.change(s,{type:'ignite'});for(let i=0;i<60;i++)M.advance(s,.1);f=s.flight;assert.equal(f.status,'flying');assert(O.elements(f.state).height>height+80);assert(f.state[0]-f.upperStage.state[0]>initial+50);assert.equal(f.attitude,0);assert.equal(f.state[4],0);assert(f.capsule.fuel<30);round(s);
}
console.log('Near-ground release uses the same 1m/s impulse; prompt manual ignition gives independent ascent.');

for(const remaining of [0,500,3000,6000]){
 let s=T.singlePad(0,0,1);Object.assign(s.flight,{state:[P.R+4163.4,0,0,277.5,0,0],status:'flying',t:40,maxHeight:4163.4,fuel:[remaining,null]});s.phase='coast';s=M.change(s,{type:'capsule-separate'});const initial=s.flight.state[0]-s.flight.upperStage.state[0]-R.stageHeight(s.flight.upperStage);let last=initial;
 for(let i=0;i<80;i++){M.advance(s,.05);const f=s.flight,u=f.upperStage,gap=f.state[0]-u.state[0]-R.stageHeight(u);assert(gap>=last-1e-6&&gap<initial+4.5);assert.equal(f.state[1],0);assert.equal(u.state[1],0);assert.equal(f.attitude,0);assert.equal(u.attitude,0);assert(f.state[3]>u.state[3]);assert.equal(R.contact(f),null);last=gap;if(i===20)round(s);}round(s);
 s=M.change(s,{type:'ignite'});M.advance(s,2);assert(s.flight.state[0]-s.flight.upperStage.state[0]-R.stageHeight(s.flight.upperStage)>last+5);round(s);
 // Already-touching drafts also move forward when the existing capsule engine is burning.
 let f=s.flight,u=f.upperStage;f.state=[P.R+4163.4,0,0,277.5,0,0];u.state=[f.state[0]-R.stageHeight(u)-.001,0,0,277.5,0,0];f.capsule.fuel=25.9;f.t=u.t=44;u.auto.separatedAt=40;round(s);M.advance(s,1);assert(f.state[0]-u.state[0]-R.stageHeight(u)>.5);assert.equal(f.state[1],0);assert.equal(u.state[1],0);assert.equal(f.state[4],0);assert.equal(u.state[4],0);assert.equal(f.attitude,0);round(s);
}
console.log('4163.4m / 277.5m/s: empty/full cores stay behind; unlit release grows gradually for four seconds, ignition accelerates only the capsule and old touching drafts recover without side kicks.');

{
 const s=M.change(orbit(),{type:'capsule-separate'}),f=s.flight;f.state=[P.R+4163.4,0,0,277.5,0,0];f.attitude=0;assert(Math.abs(R.area(f)/R.mass(f)-P.CORE_DRAG_AREA/P.mass(f.upperStage))<1e-14);f.attitude=Math.PI;assert.equal(R.area(f),1.5);f.attitude=0;f.state[3]=-277.5;assert.equal(R.area(f),1.5);f.capsule.chute={armed:true,phase:'drogue',since:0};assert.equal(R.area(f),9.5);
}
console.log('The shared ascent drag reference is explicit; retrograde, descent and parachutes retain the original drag areas.');

for(const remaining of [0,6000])for(const attitude of [.7,1.1,Math.PI/2]){
 let s=T.singlePad(0,0,1);Object.assign(s.flight,{state:[P.R+4163.4,0,0,277.5,0,0],status:'flying',t:40,maxHeight:4163.4,fuel:[remaining,null],attitude});s.phase='coast';s=M.change(s,{type:'capsule-separate'});const axis=[Math.cos(attitude),Math.sin(attitude)];let last=.3;for(let i=0;i<80;i++){M.advance(s,.05);const f=s.flight,u=f.upperStage,dx=f.state[0]-u.state[0],dy=f.state[1]-u.state[1],gap=dx*axis[0]+dy*axis[1]-R.stageHeight(u),cross=-(f.state[3]-u.state[3])*axis[1]+(f.state[4]-u.state[4])*axis[0];assert(gap>=last-1e-5);assert(Math.abs(cross)<.5);assert(Math.abs(f.attitude-attitude)<1e-12&&Math.abs(u.attitude-attitude)<1e-12);last=gap;}assert(last>2);round(s);
}
console.log('Gentle forward release also holds during 40/63/90-degree steering, with empty/full cores and no imposed side impulse.');

// Full-circle commands retain one local frame even when tangential motion reverses.
for(const body of ['main','upper'])for(const value of [0,2,180,182,270,358,359.99]){
 let a=M.change(orbit(),{type:'capsule-separate'});a=M.change(a,{type:'select-body',value:body});a=M.change(a,{type:'control',key:'angle',value});assert.equal(R.selected(a.flight).controls.angle,value);assert.equal(R.selected(a.flight).controls.mode,'tilt');round(a);
 const review={version:1,activity:P.ACTIVITY,kind:'review',answer:D.review(a)};assert.deepEqual(D.decode(review,'review').flight,a.flight);
}
for(const value of [-1,360,361,NaN,Infinity]){
 const a=M.change(orbit(),{type:'capsule-separate'}),changed=M.change(a,{type:'control',key:'angle',value});assert.equal(changed.flight.controls.angle,a.flight.controls.angle);const bad=P.clone(a);bad.flight.controls.angle=value;assert.throws(()=>D.validate(bad));
}
for(const tangent of [-100,100]){
 const a=M.change(orbit(),{type:'capsule-separate'}),f=a.flight;f.state=[P.R+200000,0,0,0,tangent,0];f.attitude=3*Math.PI/2;f.controls={mode:'tilt',angle:270,throttle:0,lit:false};R.stepCapsule(f,.1,M.atmosphere);assert(Math.abs(Math.atan2(Math.sin(f.attitude-3*Math.PI/2),Math.cos(f.attitude-3*Math.PI/2)))<1e-9);
}
const hot=M.change(orbit(),{type:'capsule-separate'}).flight;hot.state=[P.R+65000,0,0,-600,7400,0];hot.attitude=Math.atan2(7400,-600)+Math.PI;hot.controls.mode='hold';const safeEntry=R.reentry(hot,M.atmosphere);assert(safeEntry.protected&&safeEntry.shieldAngle<1e-5&&safeEntry.pathAngle<0&&safeEntry.flux>.001);const protectedFlight=P.clone(hot),exposed=P.clone(hot);exposed.attitude=O.wrap(hot.attitude+Math.PI);R.stepCapsule(protectedFlight,.1,M.atmosphere);R.stepCapsule(exposed,.1,M.atmosphere);assert(exposed.capsule.heat>protectedFlight.capsule.heat*9);assert(!R.reentry(exposed,M.atmosphere).protected);
console.log('360-degree local attitude: both bodies, reverse tangential velocity, invalid boundary rejection, draft/review continuation and shared reentry angles/thermal protection passed.');

legacy=M.change(legacy,{type:'control',key:'angle',value:270});assert.equal(legacy.flight.controls.angle,270);round(legacy);console.log('Existing model4 drafts can use and resume the new full-circle controls without losing their recorded result.');

for(const [angle,sign]of [[358,-1],[2,1]]){const a=M.change(orbit(),{type:'capsule-separate'}).flight;a.state=[P.R+200000,0,0,100,0,0];a.attitude=0;a.controls={mode:'tilt',angle,throttle:0,lit:false};const fuel=a.capsule.fuel;R.stepCapsule(a,.1,M.atmosphere);const turn=Math.atan2(Math.sin(a.attitude),Math.cos(a.attitude));assert.equal(Math.sign(turn),sign);assert(Math.abs(turn)<=12*Math.PI/180*.1+1e-9);assert(a.capsule.fuel<fuel);}
console.log('Cross-zero steering turns in each requested direction at the finite RCS rate and consumes fuel.');

for(const radial of [0,1,30]){const a=M.change(orbit(),{type:'capsule-separate'}).flight;a.state=[P.R+5000,0,0,radial,0,0];a.capsule.chute.armed=true;a.controls.lit=false;R.stepCapsule(a,radial===0?0:.01,M.atmosphere);assert.equal(a.capsule.chute.phase,'stowed');}
const chuteFlight=M.change(orbit(),{type:'capsule-separate'}).flight;chuteFlight.state=[P.R+5000,0,0,-20,0,0];chuteFlight.capsule.chute={armed:true,phase:'main',since:0};chuteFlight.t=5;chuteFlight.attitude=Math.PI/2;const fullArea=R.area(chuteFlight),fuelBefore=chuteFlight.capsule.fuel;R.stepCapsule(chuteFlight,.1,M.atmosphere);assert(chuteFlight.attitude<Math.PI/2&&chuteFlight.attitude>Math.PI/2-13*Math.PI/180*.1);assert.equal(chuteFlight.capsule.fuel,fuelBefore);assert.equal(fullArea,120);
let lastArea=1.5;for(const radial of [20,1,0,-.1,-1,-2,-3,-20]){const a=P.clone(chuteFlight);a.state[3]=radial;const area=R.area(a);assert(area>=lastArea&&area<=120);lastArea=area;if(radial>=0)assert.equal(area,1.5);}
console.log('Parachute load: ascent stays armed, existing canopy unloads continuously at the apex, full descent area returns, and finite-rate aerodynamic alignment consumes no RCS fuel.');
