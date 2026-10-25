'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),T=require('./test-support');
let s=T.launched();const initial=P.mass(s.flight),engine=P.ENGINES[0];M.advance(s,10);assert(Math.abs(P.mass(s.flight)-(initial-10*engine.thrust/(engine.isp*P.G0)))<1e-6);assert(s.flight.state[0]>P.R);
const q=s.flight.state.slice(),fuel=s.flight.fuel[1];s=M.change(s,{type:'separate'});assert.deepEqual(s.flight.state,q);assert.equal(s.flight.fuel[1],fuel);assert.equal(s.flight.fuel[0],0);assert.equal(s.flight.controls.lit,false);assert.deepEqual(M.change(s,{type:'separate'}),s);
for(let variant=0;variant<3;variant++){const result=T.reachOrbit(variant);assert(O.safe(result.flight.state));assert(O.elements(result.flight.state).e<.03);assert(result.flight.fuel[1]>0);}
assert(O.safe(T.reachOrbit(1,1,true).flight.state));
let weak=M.fresh(()=>.5);weak.craft={payload:1,stages:[{engine:1,small:0,large:4}],separator:false};weak=M.change(M.change(weak,{type:'launch'}),{type:'ignite'});M.advance(weak,5);assert.equal(weak.flight.status,'pad');assert(weak.flight.fuel[0]<24000);assert.equal(weak.flight.state[0],P.R);
const falling=M.flight({payload:1,stages:[{engine:1,small:1,large:0}],separator:false},'own',[P.R+2,0,0,-100,0,0]);falling.status='flying';M.step(falling,.1);assert.equal(falling.status,'impact');assert(Math.abs(O.elements(falling.state).height)<.01);
const vacuum=M.flight({payload:1,stages:[{engine:1,small:1,large:0}],separator:false},'practice',O.circular(300000));vacuum.controls.lit=true;vacuum.controls.mode='tilt';vacuum.status='flying';const m0=P.mass(vacuum),v0=vacuum.state[3];for(let i=0;i<100;i++)M.step(vacuum,.1,{vacuum:true,noGravity:true});const ideal=P.ENGINES[1].isp*P.G0*Math.log(m0/P.mass(vacuum));assert(Math.abs((vacuum.state[3]-v0)/ideal-1)<.001);
let a=T.launched(),b=P.clone(a);for(let i=0;i<150;i++)M.advance(a,1/15);for(let i=0;i<600;i++)M.advance(b,1/60);assert(Math.hypot(...a.flight.state.map((v,i)=>v-b.flight.state[i]))<.01);
console.log('rocket model: mass, launch variants, staging, pad, impact, rocket equation and frame-rate checks passed');

let assembly=M.change(M.fresh(()=>.5),{type:'stages',count:2});assembly=M.change(assembly,{type:'part',stage:0,part:'engine',value:0});assembly=M.change(assembly,{type:'part',stage:0,part:'large',value:2});assert(!P.canFit(assembly.craft,0,'engine-1'));assert(P.canFit(assembly.craft,1,'engine-0'));assert(!P.canFit(assembly.craft,2,'small'));assert(!P.canFit(assembly.craft,1,'other'));
let moved=M.change(assembly,{type:'transfer',from:0,to:1,part:'engine-0'});assert.equal(moved.craft.stages[0].engine,null);assert.equal(moved.craft.stages[1].engine,0);assert.equal(assembly.craft.stages[0].engine,0);
moved=M.change(moved,{type:'transfer',from:0,to:1,part:'large'});assert.equal(moved.craft.stages[0].large,1);assert.equal(moved.craft.stages[1].large,1);let removed=M.change(moved,{type:'transfer',from:1,to:null,part:'large'});assert.equal(removed.craft.stages[1].large,0);assert.deepEqual(removed.records,assembly.records);
for(const action of [{from:1,to:0,part:'large'},{from:1,to:0,part:'engine-1'},{from:1,to:3,part:'engine-0'},{from:1,to:1,part:'engine-0'},{from:1,to:undefined,part:'engine-0'},{from:1,to:null,part:'other'}])assert.deepEqual(M.change(removed,{type:'transfer',...action}),removed);
let full=M.change(moved,{type:'part',stage:1,part:'large',value:4});assert(!P.canFit(full.craft,1,'small'));assert.deepEqual(M.change(full,{type:'transfer',from:0,to:1,part:'large'}),full);let checkedAssembly=M.change(moved,{type:'check'});assert.deepEqual(M.change(checkedAssembly,{type:'transfer',from:0,to:null,part:'large'}),checkedAssembly);

const withRecord=M.change(T.reachOrbit(1),{type:'workshop'}),storedRecord=P.clone(withRecord.records),afterRemoval=M.change(withRecord,{type:'transfer',from:0,to:null,part:'large'});assert.deepEqual(afterRemoval.records,storedRecord);assert.equal(afterRemoval.craft.stages[0].large,withRecord.craft.stages[0].large-1);


let ordered=M.change(M.fresh(()=>.5),{type:'part',stage:0,part:'large',value:2});
ordered=M.change(ordered,{type:'insert',stage:0,part:'small',at:1});assert.deepEqual(P.tanks(ordered.craft.stages[0]),['large','small','large']);assert.equal(ordered.craft.stages[0].order,'lsl');
const immutable=P.clone(ordered),massBefore=P.dry(ordered.craft.stages[0]),capacityBefore=P.capacity(ordered.craft.stages[0]);
let reordered=M.change(ordered,{type:'transfer',from:0,to:0,part:'large',ordinal:1,at:0});assert.deepEqual(P.tanks(reordered.craft.stages[0]),['large','large','small']);assert.equal(reordered.craft.stages[0].order,undefined);assert.equal(P.dry(reordered.craft.stages[0]),massBefore);assert.equal(P.capacity(reordered.craft.stages[0]),capacityBefore);assert.deepEqual(ordered,immutable);
assert.deepEqual(P.tanks(M.change(ordered,{type:'transfer',from:0,to:null,part:'large',ordinal:0}).craft.stages[0]),['small','large']);
let two=M.change(ordered,{type:'stages',count:2});two=M.change(two,{type:'part',stage:1,part:'small',value:1});two=M.change(two,{type:'transfer',from:0,to:1,part:'large',ordinal:1,at:0});assert.deepEqual(P.tanks(two.craft.stages[0]),['large','small']);assert.deepEqual(P.tanks(two.craft.stages[1]),['large','small']);
let four=M.change(ordered,{type:'insert',stage:0,part:'small',at:0});assert.deepEqual(P.tanks(four.craft.stages[0]),['small','large','small','large']);assert.deepEqual(M.change(four,{type:'insert',stage:0,part:'small',at:2}),four);assert.deepEqual(P.tanks(M.change(four,{type:'transfer',from:0,to:0,part:'large',ordinal:1,at:1}).craft.stages[0]),['small','large','large','small']);
for(const at of [-1,4,.5,null,NaN])assert.deepEqual(M.change(ordered,{type:'insert',stage:0,part:'small',at}),ordered);
for(const ordinal of [-1,2,.5,NaN])assert.deepEqual(M.change(ordered,{type:'transfer',from:0,to:null,part:'large',ordinal}),ordered);
for(const action of [{type:'insert',stage:0,part:'engine-0',at:1},{type:'insert',stage:4,part:'small',at:0},{type:'transfer',from:0,to:0,part:'small',ordinal:0,at:8}])assert.deepEqual(M.change(ordered,action),ordered);
const lockedOrder=M.change(ordered,{type:'check'});assert.deepEqual(M.change(lockedOrder,{type:'insert',stage:0,part:'small',at:1}),lockedOrder);assert.deepEqual(M.change(lockedOrder,{type:'transfer',from:0,to:0,part:'large',at:1}),lockedOrder);
console.log('rocket insertion: ordered middle insertion, same-stage reorder, exact removal, atomic transfer, limits and locking passed');

for(let variant=0;variant<3;variant++){
 let upper=M.fresh(()=>variant/3+.01);assert.deepEqual(M.change(upper,{type:'separator'}),upper);
 upper=M.change(upper,{type:'part',stage:0,part:'engine',value:1});assert.deepEqual(M.change(upper,{type:'separator'}),upper);
 upper=M.change(upper,{type:'part',stage:0,part:'large',value:1});upper=M.change(upper,{type:'insert',stage:0,part:'small',at:0});
 const original=P.clone(upper.craft.stages[0]),built=M.change(upper,{type:'separator'});assert.equal(built.craft.stages.length,2);assert.deepEqual(built.craft.stages[1],original);assert.deepEqual(built.craft.stages[0],P.emptyStage());assert.equal(built.craft.separator,true);assert.equal(P.mass({craft:built.craft,separated:false},built.craft.stages.map(P.capacity))-P.mass({craft:upper.craft,separated:false},upper.craft.stages.map(P.capacity)),60);assert.deepEqual(M.change(built,{type:'separator'}),built);
 assert.deepEqual(M.change(built,{type:'transfer',from:1,to:null,part:'separator'}),upper);
 let lower=M.change(built,{type:'part',stage:0,part:'engine',value:0});assert.deepEqual(M.change(lower,{type:'transfer',from:1,to:null,part:'separator'}),lower);lower=M.change(lower,{type:'part',stage:0,part:'large',value:1});const fly=M.change(M.change(lower,{type:'launch'}),{type:'ignite'});assert.equal(fly.flight.active,0);assert.equal(M.thrust(fly.flight),600000);const staged=M.change(fly,{type:'separate'});assert.equal(staged.flight.active,1);assert.deepEqual(staged.flight.craft.stages[1],original);assert.equal(M.thrust(M.change(staged,{type:'ignite'}).flight),80000);assert.deepEqual(M.change(fly,{type:'separator'}),fly);assert.deepEqual(M.change(M.change(built,{type:'check'}),{type:'separator'}),M.change(built,{type:'check'}));
}
console.log('rocket separator: bottom extension preserves upper stage, adds 60kg, rejects loss/duplicates and fires lower then upper');

// A detached stage has its own drag mass, without changing the authoritative craft.
{
 const f=M.flight(T.launched().craft,'own',[P.R+10000,0,0,500,100,0]);f.status='flying';
 const original=P.clone(f),light=P.clone(f),heavy=P.clone(f),vacuum=P.clone(f);
 M.step(light,.1,{mass:960});M.step(heavy,.1,{mass:9600});M.step(vacuum,.1,{mass:960,vacuum:true});
 assert(light.state[3]<heavy.state[3]&&heavy.state[3]<vacuum.state[3]);assert(light.state[4]<heavy.state[4]);
 assert.deepEqual(f,original);assert.deepEqual(light.fuel,f.fuel);
 const ground=P.clone(f);ground.state=[P.R+2,0,0,-100,0,0];M.step(ground,.1,{mass:960});assert.equal(ground.status,'impact');assert(Math.abs(O.elements(ground.state).height)<.01);
}
