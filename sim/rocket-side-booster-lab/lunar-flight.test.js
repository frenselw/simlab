'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const C=require('./celestial'),L=require('./lunar-flight'),P=require('./parts');
const {Controller,advanceFrame}=require('./ui-runtime');
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
advanceFrame(corrected,.2,1000);
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
console.log('Lunar replay, time warp correction, exact cutoff and flyby fuel passed');
