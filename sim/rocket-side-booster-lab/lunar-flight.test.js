'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const C=require('./celestial'),L=require('./lunar-flight'),P=require('./parts'),S=require('./surface');
const {Controller,advanceFrame,warpLimit}=require('./ui-runtime');
const references=require('../../tools/rocket-art/lunar-flyby-results.json');
const bytes=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'assets/lunar-ephemeris.bin.gz')));
const table=C.ephemeris(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));

function launch(){
  const controller=new Controller();
  controller.lunarTable=table;
  assert(controller.command({type:'lunar-loadout'}));
  assert(controller.command({type:'launch-lunar'}));
  assert(C.norm(controller.state.flight.eci.slice(3))>370);
  assert(controller.command({type:'ignite'}));
  controller.play();
  return controller;
}
function until(controller,time){
  for(let i=0;i<2000&&controller.running&&controller.state.flight.t<time-1e-7;i++){
    const {elapsed}=controller.tick(Math.min(21600,time-controller.state.flight.t),900);
    assert(elapsed>0||!controller.running,JSON.stringify(controller.state.flight.lunar.events));
  }
  assert(!controller.running||Math.abs(controller.state.flight.t-time)<1e-7);
  return controller.state.flight;
}

const reference=references.missions[0],nominal=launch();
const departed=until(nominal,340);
assert(departed.capsule.detached);
assert(Math.abs(departed.capsule.fuel-reference.capsuleFuelKg)<1e-7);
assert(departed.lunar.drops.length===5);
const insertionState=departed.eci.slice();
const complete=until(nominal,10*C.DAY);
assert.equal(complete.lunar.outcome,'flyby');
assert(Math.abs(complete.lunar.closest.height-reference.nominal.nearest.altitudeM)<50);
assert(Math.abs(complete.lunar.closest.t-reference.nominal.nearest.t)<.05);
assert(Math.abs(complete.moon.height-80000000)<.1);

const corrected=launch();
// Partition the live ascent differently, including across the first guidance knot.
for(let i=0;i<129;i++)advanceFrame(corrected,.037,1);
const secondInsertion=until(corrected,340).eci;
assert(C.norm(C.add(secondInsertion.slice(0,3),insertionState.slice(0,3),-1))<.01);
assert(C.norm(C.add(secondInsertion.slice(3),insertionState.slice(3),-1))<.00001);
const burn={type:'lunar-correction',start:C.DAY,duration:.1,throttle:.1,direction:'normal'};
assert(!corrected.command({...burn,duration:500}));
assert(!corrected.command({...burn,start:341}));
assert(corrected.command(burn));
until(corrected,C.DAY-.05);
const f=corrected.state.flight, before=f.eci.slice();
assert.equal(warpLimit(f),20);
advanceFrame(corrected,.2,10000);
assert(f.t>C.DAY+.1);
const [start,stop]=f.lunar.events.filter(e=>e.type.startsWith('correction'));
assert(Math.abs(start.t-C.DAY)<1e-8&&Math.abs(stop.t-C.DAY-.1)<1e-8);
assert(Math.abs(stop.used-3000*.1*.1/(300*P.G0))<1e-8);
assert(C.norm(C.add(f.eci.slice(3),before.slice(3),-1))>.1);
until(corrected,10*C.DAY);
assert.equal(f.lunar.outcome,'flyby');
assert(f.lunar.closest.height<complete.lunar.closest.height-5000);
assert(Math.abs(f.capsule.fuel-13.93025104252)<1e-8);

const manual=launch();
until(manual,12);
assert(manual.command({type:'manual'}));
assert(manual.command({type:'control',key:'bearing',value:180}));
assert(manual.command({type:'lunar-cutoff',value:12.27}));
const cut=until(manual,13);
assert(!cut.controls.lit&&P.burning(cut));
assert.equal(cut.lunar.events.at(-1).type,'cutoff');
assert(Math.abs(cut.lunar.events.at(-1).t-12.27)<1e-8);

const shortcut=new Controller();
shortcut.lunarTable=table;
assert(shortcut.command({type:'part',stage:0,part:'engine',value:2}));
const design=structuredClone(shortcut.state.craft);
assert(shortcut.command({type:'lunar-transfer'}));
assert.deepEqual(shortcut.state.craft,design);
const ship=shortcut.state.flight;
assert.equal(shortcut.state.phase,'coast');
assert(!shortcut.running&&ship.capsule.detached&&!ship.controls.lit);
assert.equal(ship.t,7200);
assert.equal(warpLimit(ship),10000);
assert(Math.abs(ship.capsule.fuel-reference.capsuleFuelKg)<1e-7);
shortcut.play();
let slowed=false,resumed=false,wall=0;
for(;shortcut.running&&wall<100;wall+=.1){
  advanceFrame(shortcut,.1,10000);
  const limit=warpLimit(ship);
  if(limit===1000){
    assert(ship.moon.height<=20000000);
    slowed=true;
  }else if(slowed&&limit===10000)resumed=true;
}
assert(slowed&&resumed&&ship.lunar.outcome==='flyby'&&wall<90);
assert(Math.abs(ship.lunar.closest.height-complete.lunar.closest.height)<10);
assert(Math.abs(ship.capsule.fuel-complete.capsule.fuel)<1e-8);
assert(shortcut.command({type:'workshop'}));
assert.deepEqual(shortcut.state.craft,design);

function startGroundReturn(){
  const controller=new Controller();
  controller.lunarTable=table;
  assert(controller.command({type:'part',stage:0,part:'engine',value:2}));
  assert(controller.command({type:'lunar-return-launch'}));
  const f=controller.state.flight;
  assert.deepEqual(f.craft,L.preset());
  assert.equal(controller.state.craft.stages[0].engine,2);
  assert.equal(controller.state.phase,'pad');
  assert.equal(f.t,0);
  assert(Math.abs(C.norm(f.eci.slice(0,3))-P.R)<1e-6);
  assert(f.lunar.groundReturn&&f.lunar.freeReturn&&!f.capsule.detached);
  assert(controller.command({type:'ignite'}));
  controller.play();
  return controller;
}

const inland=startGroundReturn(),ground=inland.state.flight;
advanceFrame(inland,1,10000);
assert.equal(ground.t,0);
assert(warpLimit(ground)===1&&ground.controls.lit);
advanceFrame(inland,1,10000);
assert(ground.t>0&&ground.t<1&&ground.status==='flying');
until(inland,340);
const departureFuel=ground.capsule.fuel;
assert(!ground.controls.lit&&ground.controls.mode==='hold'&&ground.capsule.detached);
assert(Math.abs(departureFuel-12.306618)<.000001);
until(inland,10*C.DAY);
const route=ground.lunar;
assert.equal(route.outcome,'landed');
assert.equal(ground.capsule.chute.phase,'main');
assert.equal(ground.capsule.fuel,departureFuel);
assert(Math.abs(route.closest.height-9339514)<300&&route.closest.farSide>9000000);
assert(Math.abs(route.entry.speed-10592)<5&&Math.abs(route.entry.angle+6)<.3);
assert(ground.capsule.heat<.5&&route.landing.speed<8&&Math.abs(S.clearance(ground.state))<.01);
assert(Math.abs(route.landing.lat-28.11)<.03&&Math.abs(route.landing.lon+2.27)<.03);
assert.equal(route.landing.water,false);
assert.deepEqual(route.events.map(e=>e.type),['jettison','separate','capsule-separate','injection','cutoff',
  'return-coast','return-entry','drogue-opening','main-opening','landed']);
assert(inland.command({type:'workshop'}));
assert.equal(inland.state.craft.stages[0].engine,2);

const replay=startGroundReturn();
for(let frame=0;replay.running&&frame<3000;frame++)advanceFrame(replay,frame%2===0?.073:.137,10000);
const replayed=replay.state.flight.lunar;
assert.equal(replayed.outcome,'landed');
assert.equal(replayed.landing.water,false);
assert(Math.hypot(replayed.landing.lat-route.landing.lat,replayed.landing.lon-route.landing.lon)<.01);
assert(Math.abs(replayed.closest.height-route.closest.height)<100);

const demo=new Controller();
demo.lunarTable=table;
assert(demo.command({type:'lunar-return'}));
const returning=demo.state.flight,initialFuel=returning.capsule.fuel;
const cruiseAxis=returning.axis.slice(),cruiseRight=returning.bodyRight.slice();
assert.equal(returning.t,7200);
assert(returning.lunar.freeReturn&&returning.capsule.detached&&!returning.controls.lit);
const steps=L.forecast(returning,table);
let next;
do{next=steps.next();}while(!next.done);
const predicted=next.value;
assert(predicted.points.length>500&&predicted.closest&&predicted.entry);
assert.equal(predicted.times.length,predicted.points.length);
assert(predicted.times.every((t,i)=>i===0||t>predicted.times[i-1]));
const mapReference=L.trajectory(returning,[returning.eci.slice(0,3)])[0],returnAxes=returning.lunar.mapAxes;
demo.play();
until(demo,200000);
assert.equal(returning.controls.mode,'hold');
assert.equal(returning.rcsDirection,0);
assert(C.dot(returning.axis,cruiseAxis)>1-1e-12&&C.dot(returning.bodyRight,cruiseRight)>1-1e-12);
assert.equal(returning.lunar.mapAxes,returnAxes);
assert.deepEqual(L.trajectory(returning,[predicted.points[0]])[0],mapReference);
until(demo,10*C.DAY);
const {closest,entry,events,outcome}=returning.lunar;
assert.equal(outcome,'landed');
assert(Math.abs(closest.height-9262600)<25,JSON.stringify(closest));
assert(Math.abs(closest.height-predicted.closest.height)<50);
assert(Math.abs(entry.t-predicted.entry.t)<1);
assert(Math.abs(entry.speed-10588.39)<1&&Math.abs(entry.angle+5.925)<.01);
assert.deepEqual(events.map(e=>e.type),['return-coast','return-entry','drogue-opening','main-opening','landed']);
assert.equal(returning.capsule.fuel,initialFuel);
assert(returning.capsule.heat>0&&returning.capsule.heat<1);
assert(Math.abs(Math.hypot(returning.capsule.touchdown.normal,returning.capsule.touchdown.tangent)-5.084)<.1);
function arrivalSampling(path){
  const arrival=path.slice(path.findLastIndex(point=>C.norm(point)>P.R+3e6)+1);
  const sweep=arrival.slice(1).map((point,i)=>Math.atan2(C.norm(C.cross(arrival[i],point)),C.dot(arrival[i],point))/C.DEG);
  return {points:arrival.length,maxSweepDegrees:Math.max(...sweep)};
}
const sampling={actual:arrivalSampling(returning.lunar.trail),forecast:arrivalSampling(predicted.points)};
assert(sampling.actual.points>30&&sampling.forecast.points>20,JSON.stringify(sampling));
assert(sampling.actual.maxSweepDegrees<1.2&&sampling.forecast.maxSweepDegrees<1.2,JSON.stringify(sampling));

const offCourse=new Controller();
offCourse.lunarTable=table;
assert(offCourse.command({type:'lunar-return'}));
offCourse.play();
const drifting=until(offCourse,400000);
assert(offCourse.command({type:'control',key:'mode',value:'radial-out'}));
until(offCourse,400020);
assert(offCourse.command({type:'ignite'}));
until(offCourse,900000);
assert.equal(offCourse.state.phase,'coast');
assert.equal(drifting.t,900000);
assert.equal(drifting.lunar.outcome,null);
assert.equal(drifting.capsule.fuel,0);
assert(!drifting.controls.lit&&drifting.orbit.height>100e6);
assert(offCourse.command({type:'control',key:'angle',value:(drifting.pitch+90)%360}));
assert.equal(warpLimit(drifting),5);
const beforeTurn=drifting.turnVelocity.slice();
until(offCourse,900000.2);
assert(drifting.rcsDirection===1||drifting.rcsDirection===-1);
const [turnX,turnZ]=drifting.rcsAxes;
const torque=C.add(C.scale(drifting.bodyRight,turnX),C.cross(drifting.bodyRight,drifting.axis),-turnZ);
assert(C.dot(C.unit(torque),C.unit(C.add(drifting.turnVelocity,beforeTurn,-1)))>.99);
until(offCourse,900020);
assert.equal(drifting.rcsDirection,0);
assert.equal(drifting.rcsAxes,null);
assert.equal(drifting.capsule.fuel,0);

const steering=new Controller();
steering.lunarTable=table;
assert(steering.command({type:'lunar-return'}));
const turningShip=steering.state.flight;
const steeringFuel=turningShip.capsule.fuel;
assert(steering.command({type:'control',key:'mode',value:'normal'}));
steering.play();
const phases=new Set();
let previousSpeed=0;
for(let i=0;i<400;i++){
  steering.tick(.05,1000);
  const speed=C.norm(turningShip.turnVelocity??[0,0,0]);
  if(turningShip.rcsAxes){
    const [x,z]=turningShip.rcsAxes;
    const torque=C.add(C.scale(turningShip.bodyRight,x),C.cross(turningShip.bodyRight,turningShip.axis),-z);
    const power=C.dot(torque,turningShip.turnVelocity);
    if(power>1e-6&&speed>previousSpeed)phases.add('accelerate');
    if(power<-1e-6&&speed<previousSpeed)phases.add('brake');
  }else if(speed>.01)phases.add('coast');
  assert(speed<=12*C.DEG+1e-8);
  assert(Math.abs(C.dot(turningShip.axis,turningShip.bodyRight))<1e-10);
  previousSpeed=speed;
}
assert.deepEqual([...phases].sort(),['accelerate','brake','coast']);
assert(C.norm(turningShip.turnVelocity)<1e-8&&turningShip.rcsDirection===0);
assert.equal(turningShip.capsule.fuel,steeringFuel);

const correctionAlignment=launch();
until(correctionAlignment,340);
assert(correctionAlignment.command({type:'lunar-correction',start:360,duration:1000,throttle:.01,direction:'radial-out'}));
for(const time of [360,860,1359.99]){
  const body=until(correctionAlignment,time);
  assert(body.lunar.maneuver.active);
  assert(C.dot(body.axis,body.lunar.maneuver.axis)>Math.cos(.2*C.DEG));
}

for(const direction of ['radial-in','retrograde']){
  const retargeted=new Controller();retargeted.lunarTable=table;
  assert(retargeted.command({type:'lunar-return'}));
  assert(retargeted.command({type:'control',key:'mode',value:'normal'}));
  retargeted.play();
  for(let i=0;i<100;i++)retargeted.tick(.05,1000);
  assert(retargeted.command({type:'control',key:'mode',value:direction}));
  const body=retargeted.state.flight,fuel=body.capsule.fuel;
  for(let i=0;i<500;i++){
    retargeted.tick(.05,1000);
    assert(C.norm(body.turnVelocity)<=12*C.DEG+1e-8);
    assert(Math.abs(C.dot(body.axis,body.bodyRight))<1e-10);
  }
  assert(C.norm(body.turnVelocity)<1e-8);
  assert.equal(body.capsule.fuel,fuel);
}

const reversal=new Controller();reversal.lunarTable=table;
assert(reversal.command({type:'lunar-return'}));
assert(reversal.command({type:'control',key:'angle',value:140}));
reversal.play();until(reversal,7220);
assert(reversal.command({type:'control',key:'angle',value:230}));
until(reversal,7222.34);
assert(reversal.command({type:'lunar-correction',start:7239.34,duration:.1,throttle:1,direction:'radial-out'}));
const igniting=until(reversal,7239.34);
assert(igniting.lunar.maneuver.active);
assert(C.dot(igniting.axis,igniting.lunar.maneuver.axis)>Math.cos(.15*C.DEG));
assert(C.norm(igniting.turnVelocity)<.15*C.DEG);

// Exercise the data boundary without integrating hundreds of demonstration days.
const end=L.flightLimit(drifting);
assert(end>340*C.DAY);
drifting.t=end-.25;
const lastForecast=L.forecast(drifting,table).next();
assert(lastForecast.done&&lastForecast.value.times.at(-1)<=end);
offCourse.tick(1,900);
assert.equal(drifting.t,end);
assert.equal(drifting.lunar.outcome,'ephemeris-end');
assert.equal(offCourse.state.phase,'ended');
console.log('Lunar free return:',JSON.stringify({closest,entry,events,outcome,fuelKg:initialFuel,
  heat:returning.capsule.heat,touchdown:returning.capsule.touchdown,sampling}));
console.log('Lunar replay, time warp correction, exact cutoff and flyby fuel passed');

const lunarPilot=require('../../tools/rocket-lunar-landing-browser-cases');
function launchLander(stepSeconds){
  const controller=new Controller();
  controller.lunarTable=table;
  const design=structuredClone(controller.state.craft);
  assert(controller.command({type:'lunar-landing-launch'}));
  const f=controller.state.flight;
  assert(f.t===0&&f.status==='pad'&&f.controls.lit&&controller.ignitionHold>0);
  const blocked=[
    {type:'ignite'},{type:'stop'},{type:'control',key:'throttle',value:.5},{type:'control',key:'angle',value:90},
    {type:'separate'},{type:'capsule-separate'},{type:'select-body',value:'upper'},
    {type:'lunar-correction'},{type:'manual'},{type:'moon-takeover'}
  ];
  const snapshot=JSON.stringify(f);
  for(const action of blocked)assert(!controller.command(action));
  assert.equal(JSON.stringify(f),snapshot);
  until(controller,340);
  assert(!f.capsule.detached&&!f.controls.lit&&f.fuel[1]>840&&f.capsule.fuel===260);
  for(const action of blocked)assert(!controller.command(action));
  const prediction=L.forecast(f,table);
  let next;
  do{next=prediction.next();}while(!next.done);
  assert(Math.abs(next.value.closest.height-8500000)<1000);
  assert(Math.abs(next.value.entry.t-738461)<8);
  while(controller.running)controller.tick(stepSeconds,1600);
  const handoffTime=f.t;
  assert.equal(f.lunar.handoff,'ready');
  assert.equal(f.lunar.events.filter(event=>event.type==='moon-capture').length,2);
  assert(f.moon.hp>=80000&&f.moon.ha<=120000&&f.capsule.detached);
  assert(f.capsule.fuel===260&&!f.controls.lit&&f.controls.throttle===0);
  controller.play();
  assert(!controller.running&&!controller.tick(1000,1000)&&f.t===handoffTime);
  assert(!controller.command({type:'ignite'}));
  return {controller,design,handoffTime};
}
for(const hover of [false,true]){
  const {controller,design,handoffTime}=launchLander(hover?383.75:21600);
  const {outcome,held,fuel,touchdown}=lunarPilot(controller,L,undefined,hover);
  assert.equal(outcome,'moon-landed');
  assert(!hover||held>=20);
  assert(touchdown.vertical>=-2&&touchdown.horizontal<1&&touchdown.tilt<10&&fuel>10);
  assert(controller.command({type:'workshop'}));
  assert.deepEqual(controller.state.craft,design);
  console.log('Lunar landing',JSON.stringify({handoffTime,hover,held,fuel,touchdown}));
}
const verifiedOrbit=launchLander(580).controller.state;
const delayedPilot=new Controller();
delayedPilot.state=structuredClone(verifiedOrbit);
delayedPilot.lunarTable=table;
assert(delayedPilot.command({type:'moon-takeover'}));
delayedPilot.play();
delayedPilot.tick(.1,1000);
assert.equal(lunarPilot(delayedPilot,L).outcome,'moon-landed');
const landingMap=[3.038304*L.MOON_RADIUS,.2368043*L.MOON_RADIUS];
const craterMap=[landingMap[0]-115,landingMap[1]-145];
const floor=C.moonTerrain(...craterMap),shoulder=C.moonTerrain(craterMap[0]-71,craterMap[1]);
assert(C.moonTerrain(...landingMap)===0);
assert(floor<-7&&shoulder-floor>8);
const seam=[C.moonTerrain(-Math.PI*L.MOON_RADIUS,420000),C.moonTerrain(Math.PI*L.MOON_RADIUS,420000)];
assert(Math.abs(seam[0]-seam[1])<1e-8);
for(const [down,horizontal,outcome] of [
  [1,0,'moon-landed'],[3,0,'moon-hard-landing'],[1,5,'moon-impact'],[12,0,'moon-impact']
]){
  const state=structuredClone(verifiedOrbit),f=state.flight;
  assert(L.command(state,{type:'moon-takeover'},table));
  const moon=table.body(f.lunar.epoch+f.t,0);
  const lon=landingMap[0]/L.MOON_RADIUS,lat=landingMap[1]/L.MOON_RADIUS;
  const up=C.fromColumns(C.moonFrame(moon),[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)]);
  const right=C.unit(C.cross(up,[0,0,1]));
  const position=C.scale(up,L.MOON_RADIUS+.65);
  const spin=C.scale(C.cross(moon.slice(0,3),moon.slice(3)),1/C.norm(moon.slice(0,3))**2);
  const velocity=C.add(C.add(C.cross(spin,position),up,-down),right,horizontal);
  f.eci=[...C.add(moon.slice(0,3),position),...C.add(moon.slice(3),velocity)];
  f.axis=up;f.bodyRight=right;
  if(down===1&&horizontal===0){
    // Refresh the surface reading through the production integrator.
    L.advance(state,.01,1000,table);
    const controller=new Controller();
    controller.state=state;
    controller.lunarTable=table;
    controller.play();
    const time=f.t;
    assert(advanceFrame(controller,.02,1000)>.99);
    assert(Math.abs(f.t-time-.02)<1e-7);
  }
  L.advance(state,1,1000,table);
  assert.equal(f.lunar.outcome,outcome);
}
// A descending craft can cross the mean-radius sphere above a crater floor.
const craterFlight=structuredClone(verifiedOrbit);
assert(L.command(craterFlight,{type:'moon-takeover'},table));
const craterShip=craterFlight.flight,craterMoon=table.body(craterShip.lunar.epoch+craterShip.t,0);
const lon=craterMap[0]/L.MOON_RADIUS,lat=craterMap[1]/L.MOON_RADIUS;
const up=C.fromColumns(C.moonFrame(craterMoon),[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)]);
craterShip.eci=[...C.add(craterMoon.slice(0,3),up,L.MOON_RADIUS+1),...C.add(craterMoon.slice(3),up,-4)];
craterShip.axis=up;
craterShip.bodyRight=C.unit(C.cross(up,[0,0,1]));
L.advance(craterFlight,.40,1000,table);
assert(craterShip.moon.height<0&&craterShip.moon.surface.height>4);
assert.equal(craterShip.lunar.outcome,null);
