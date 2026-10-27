'use strict';
const assert=require('node:assert/strict'),I=require('./interaction'),M=require('./model'),O=require('./orbit'),T=require('./test-support');
assert.equal(I.nearest([{x:10,y:10,visible:true},{x:30,y:30,visible:false}],15,15,14),0);assert.equal(I.nearest([{x:10,y:10,visible:true}],40,10,24),null);
let s=T.reachOrbit();const original=JSON.stringify(s.records),checked=M.change(s,{type:'check'});assert.equal(M.change(checked,{type:'return'}).phase,'coast');assert.deepEqual(M.change(checked,{type:'control',key:'angle',value:30}),checked);
s=M.change(s,{type:'workshop'});s=M.change(s,{type:'part',stage:0,part:'engine',value:1});assert.equal(JSON.stringify(s.records),original);assert(O.safe(s.records[0].state));
console.log('rocket interaction: visible snap geometry, check return, immutable task records and cancel paths passed');

assert.equal(I.nearest([{x:10,y:10,visible:true,compatible:false}],10,10,30),null);assert.equal(I.nearest([{x:90,y:50,bodyX:40,bodyY:50,visible:true,compatible:true}],40,50,30),0);assert.equal(I.nearest([{x:90,y:50,bodyX:40,bodyY:50,visible:true,compatible:false}],40,50,30),null);

assert.equal(I.wheelFactor(1,1,400),I.wheelFactor(16,0,400));
assert.equal(I.wheelFactor(1,2,400),I.wheelFactor(400,0,400));
assert.equal(I.wheelFactor(0,0,400),1);
assert.equal(I.wheelFactor(NaN,0,400),1);
assert.equal(I.wheelFactor(Infinity,0,400),1);
assert.equal(I.wheelFactor(-6000,0,400),I.wheelFactor(-600,0,400));
assert(I.wheelFactor(-20,0,400)>1&&I.wheelFactor(20,0,400)<1);
