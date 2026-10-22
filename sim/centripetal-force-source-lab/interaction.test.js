'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js');
let s=M.fresh(()=>.2);assert.equal(s.items[0].palette,null);assert.throws(()=>M.change(s,{type:'add'}));
s=M.change(s,{type:'palette',value:2});s=M.change(s,{type:'add'});assert.deepEqual(s.items[0].arrows,[[2,null,60]]);assert.equal(s.view,'analysis');
s=M.change(s,{type:'arrow',angle:3599,length:75});s=M.change(s,{type:'kind',value:6});assert.deepEqual(s.items[0].arrows,[[6,3599,75]]);
s=M.change(s,{type:'inward',value:'W'});s=M.change(s,{type:'relation',value:'tension'});s=M.change(s,{type:'clear-drawing'});assert.deepEqual(s.items[0].arrows,[]);assert.equal(s.items[0].inward,'W');assert.equal(s.items[0].relation,'tension');
s=M.change(s,{type:'palette',value:0});s=M.change(s,{type:'add'});const copy=P.draft(s);assert.deepEqual(P.decode({version:1,activity:M.ACTIVITY,kind:'draft',answer:copy},'draft'),s);
s.phase='check';s.returnTo=[0,'analysis'];assert.throws(()=>M.change(s,{type:'delete'}));
console.log('Centripetal source interactions: explicit palette, null arrow, kind change, selective clear and lock passed.');
