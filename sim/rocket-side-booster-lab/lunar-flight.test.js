'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const C=require('./celestial'),L=require('./lunar-flight'),P=require('./parts');
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

const demo=new Controller();
demo.lunarTable=table;
assert(demo.command({type:'lunar-return'}));
const returning=demo.state.flight,initialFuel=returning.capsule.fuel;
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
until(offCourse,900000.2);
assert(drifting.rcsDirection===1||drifting.rcsDirection===-1);
until(offCourse,900020);
assert.equal(drifting.rcsDirection,0);
assert.equal(drifting.capsule.fuel,0);

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
  heat:returning.capsule.heat,touchdown:returning.capsule.touchdown}));
console.log('Lunar replay, time warp correction, exact cutoff and flyby fuel passed');
