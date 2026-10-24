'use strict';
const assert=require('node:assert/strict'),I=require('./interaction'),M=require('./model'),O=require('./orbit'),T=require('./test-support');
assert.equal(I.nearest([{x:10,y:10,visible:true},{x:30,y:30,visible:false}],15,15,14),0);assert.equal(I.nearest([{x:10,y:10,visible:true}],40,10,24),null);
let s=T.reachOrbit(1);s=M.change(s,{type:'import'});const original=JSON.stringify(s.records);s=M.change(s,{type:'node',dv:120});let checked=M.change(s,{type:'check'});assert.equal(M.change(checked,{type:'return'}).phase,'planning');assert.deepEqual(checked.node,s.node);assert.deepEqual(M.change(checked,{type:'node',dv:400}),checked);s=M.change(s,{type:'cancel'});assert.equal(s.node,null);assert.equal(JSON.stringify(s.records),original);
s=M.change(s,{type:'workshop'});s=M.change(s,{type:'part',stage:0,part:'engine',value:1});assert.equal(JSON.stringify(s.records),original);assert(O.safe(s.records[0].state));
console.log('rocket interaction: visible snap geometry, check return, immutable task records and cancel paths passed');
