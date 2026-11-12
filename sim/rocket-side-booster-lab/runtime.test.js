'use strict';
const assert=require('node:assert/strict'),{Controller,advanceFrame,warpLimit}=require('./ui-runtime'),M=require('./model'),P=require('./parts'),O=require('./orbit'),T=require('./test-support');
let renders=0;const c=new Controller(()=>renders++);c.start();assert.deepEqual(Object.keys(c.state).sort(),['craft','flight','phase','variant']);assert.equal(c.state.phase,'workshop');assert.equal(c.submit,undefined);assert.equal(c.save,undefined);
assert(!c.command({type:'control',key:'angle',value:10}));assert(!c.command(null));assert(c.notice);c.start();assert.equal(c.notice,'');
c.state=T.launched();c.play();assert(c.running);assert(c.command({type:'stop'}));assert(c.running);const t=c.state.flight.t;c.tick(.1);assert(c.state.flight.t>t);c.pause();const paused=P.clone(c.state);assert.equal(c.tick(1),null);assert.deepEqual(c.state,paused);
assert(c.command({type:'control',key:'angle',value:20}));assert(!c.running);assert(c.command({type:'workshop'}));const craft=P.clone(c.state.craft);assert(c.command({type:'launch'}));assert.deepEqual(c.state.craft,craft);c.start();assert.deepEqual(c.state,M.fresh());assert(renders>5);
for(const rate of [10,20]){const fast=new Controller(),normal=new Controller();fast.state=T.launched();normal.state=P.clone(fast.state);fast.play();normal.play();const before=fast.state.flight.t;assert(Math.abs(advanceFrame(fast,.1,rate)-rate)<1e-7);for(let i=0;i<rate;i++)advanceFrame(normal,.1,1);assert(Math.abs(fast.state.flight.t-before-.1*rate)<1e-7);for(let i=0;i<6;i++)assert(Math.abs(fast.state.flight.state[i]-normal.state.flight.state[i])<1e-5);}
const vacuum=new Controller();vacuum.state=T.reachOrbit();assert.equal(warpLimit(vacuum.state.flight),1000);vacuum.play();const tick=vacuum.tick.bind(vacuum);let steps=0;vacuum.tick=(seconds,budget)=>{assert.equal(budget,1);const r=tick(seconds,budget);steps+=r?.steps||0;return r;};const actual=advanceFrame(vacuum,10,1000);assert(actual>0&&actual<1000&&steps===800);vacuum.pause();assert.equal(advanceFrame(vacuum,.2,20),0);
let descent=T.launched();while(O.elements(descent.flight.state).height<200000)M.advance(descent,.1);descent=M.change(descent,{type:'stop'});while(O.elements(descent.flight.state).radial>0)M.advance(descent,2);while(O.elements(descent.flight.state).height>120500)M.advance(descent,.1);const crossing=new Controller();crossing.state=descent;crossing.play();advanceFrame(crossing,.2,1000);assert.equal(warpLimit(crossing.state.flight),20);assert.equal(crossing.state.flight.status,'flying');T.validate(crossing.state);
for(const status of ['destroyed','escaped']){const liveUpper=new Controller();liveUpper.state=M.change(T.reachOrbit(),{type:'capsule-separate'});const f=liveUpper.state.flight;f.controlled='upper';f.status=status;f.state=[P.R+(status==='destroyed'?65000:1e8),0,0,status==='destroyed'?-600:1000,7400,0];f.capsule.heat=status==='destroyed'?1:0;f.upperStage.state=O.circular(200000);f.upperStage.controls.lit=false;f.upperStage.auto.mode='manual';const rootState=f.state.slice(),start=f.t;liveUpper.play();assert.equal(warpLimit(f),1000);assert(Math.abs(advanceFrame(liveUpper,1,1000)-1000)<1e-7);assert(liveUpper.running);assert(Math.abs(f.t-start-1000)<1e-7);assert.equal(f.upperStage.status,'flying');assert.deepEqual(f.state,rootState);T.validate(liveUpper.state);}

const chuteState=M.change(T.reachOrbit(),{type:'capsule-separate'}),surface=require('./surface'),point=T.remoteHill(),theta=Math.atan2(point[1],point[0]),ground=surface.radius(point,chuteState.flight.t);
function falling(height,phase='main'){const state=P.clone(chuteState),f=state.flight;f.state=[(ground+height)*Math.cos(theta),(ground+height)*Math.sin(theta),0,-5.2*Math.cos(theta),-5.2*Math.sin(theta),0];f.attitude=theta;f.capsule.chute={armed:true,phase,since:f.t};f.upperStage.status='impact';f.upperStage.controls.lit=false;f.upperStage.auto.mode='done';return state;}
assert.equal(warpLimit(falling(1000,'stowed').flight),20);
for(const phase of ['drogue-opening','drogue','main-opening','main'])for(const rate of [1,5,10,20,100,1000]){const fast=new Controller(),normal=new Controller();fast.state=falling(1000,phase);normal.state=P.clone(fast.state);assert.equal(warpLimit(fast.state.flight),1000);fast.play();normal.play();assert(Math.abs(advanceFrame(fast,.01,rate)-rate)<1e-6);for(let remaining=.01*rate;remaining>1e-9;){const dt=Math.min(.1,remaining);advanceFrame(normal,dt,1);remaining-=dt;}for(let i=0;i<6;i++)assert(Math.abs(fast.state.flight.state[i]-normal.state.flight.state[i])<.001,phase+' '+rate);T.validate(fast.state);}
const poweredUpper=falling(1000);poweredUpper.flight.upperStage.status='flying';poweredUpper.flight.upperStage.controls.lit=true;poweredUpper.flight.upperStage.auto.mode='burning';assert.equal(warpLimit(poweredUpper.flight),1000);poweredUpper.flight.capsule.chute.phase='stowed';assert.equal(warpLimit(poweredUpper.flight),20);
const chuteBudget=new Controller();chuteBudget.state=falling(1000);chuteBudget.play();const capped=advanceFrame(chuteBudget,1,1000);assert(capped>0&&capped<1000);T.validate(chuteBudget.state);
for(const rate of [100,1000]){const descent=new Controller();descent.state=falling(1);descent.play();advanceFrame(descent,.1,rate);const f=descent.state.flight;assert.equal(f.status,'landed');assert(!descent.running);assert.equal(O.elements(f.state).speed,0);assert(Math.abs(surface.clearance(f.state,f.t))<1e-6);const stopped=P.clone(descent.state);assert.equal(advanceFrame(descent,.1,rate),0);assert.deepEqual(descent.state,stopped);}
let ready=false;
const events=new Controller(()=>{},()=>ready);
events.state=M.change(T.launched(),{type:'workshop'});
assert(events.command({type:'boosters'}));assert(!events.command({type:'launch'}));
ready=true;assert(events.command({type:'launch'}));assert.deepEqual(events.events,[]);
assert(events.command({type:'ignite'}));assert(!events.command({type:'ignite'}));
assert.deepEqual(events.events,[{type:'ignite',t:0,body:'rocket'}]);
events.play();events.tick(80,20000);
assert.deepEqual(events.events.map(e=>e.type),['booster-spent','liftoff']);
assert(Math.abs(events.events[0].t-P.BOOSTER.fuel*P.BOOSTER.isp*P.G0/P.BOOSTER.thrust)<1e-6);
assert(events.command({type:'jettison'}));assert(!events.command({type:'jettison'}));
assert(events.command({type:'separate'}));assert(events.command({type:'capsule-separate'}));
assert.deepEqual(events.events,[{type:'capsule-separate',t:80,body:'capsule'},{type:'separate',t:80,body:'upper'}]);
const history=events.events;assert(events.command({type:'select-body',value:'upper'}));events.pause();events.emit();
assert.equal(events.events,history);
assert(events.command({type:'workshop'}));assert.deepEqual(events.events,[]);
events.state=falling(1000,'stowed');events.state.flight.capsule.chute.armed=false;
assert(events.command({type:'chute-arm'}));assert.deepEqual(events.events,[]);
events.play();events.tick(8,20000);
const chute=events.state.flight.capsule.chute;
assert.deepEqual(events.events,[{type:'main-opening',t:chute.since,body:'capsule'},{type:'drogue-opening',t:chuteState.flight.t,body:'capsule'}]);
events.start();events.state=falling(1);events.play();const beforeLanding=events.state.flight.t;events.tick(.5,20000);
assert.equal(events.events[0].type,'landed');
assert(events.events[0].t>beforeLanding&&events.events[0].t<events.state.flight.t);
events.start();events.state=falling(65000,'stowed');
const overheated=events.state.flight;
overheated.state=[P.R+65000,0,0,-400,7400,0];overheated.capsule.heat=.999999;
events.play();events.tick(.1,1);
assert.deepEqual(events.events,[{type:'destroyed',t:overheated.t,body:'capsule'}]);
events.start();assert.deepEqual(events.events,[]);
events.state=M.change(T.reachOrbit(),{type:'capsule-separate'});
const upper=events.state.flight.upperStage;
upper.state=[P.R+1,0,0,-120.4,.9,0];upper.auto.mode='manual';
const expected=P.clone(upper);M.step(expected,.1);
events.play();events.tick(.1,1);
assert.deepEqual(events.events,[{type:'impact',t:expected.t,body:'upper'}]);
assert(upper.t>expected.t);
events.start();events.state=T.singlePad();events.command({type:'ignite'});events.play();events.tick(2);
assert(events.command({type:'stop'}));assert(events.command({type:'capsule-separate'}));
assert(events.command({type:'select-body',value:'upper'}));assert(events.command({type:'ignite'}));
assert.equal(events.events[0].body,'core');
console.log('Explorer controller: fresh start, repeatable flights, explicit pause, invalid actions, unchanged physics bounded real-time warp, all parachute rates and stopped high-warp touchdown passed.');
