 'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),S=require('./scoring'),D=require('./persistence'),T=require('./test-support');
assert.equal(S.score(M.fresh()).score,0);
for(const random of [()=>0,()=>.5,()=>.999]){const s=M.fresh(random);assert.equal(s.variant,0);assert.equal(P.PAYLOADS[s.craft.payload],150);}
let s=T.reachOrbit();assert.equal(S.score(s).score,100);assert.equal(S.score(D.decode(T.snapshot(s),'draft')).score,100);
const original=P.clone(s.records[0]);
function at(h,e=0){const r=P.R+h,a=r/(1-e);return [r,0,0,0,Math.sqrt(P.MU*(2/r-1/a)),0];}
function result(h,e=0,extra={}){s.records[0]={...P.clone(original),state:at(h,e),maxHeight:Math.max(h,100000),...extra};return S.score(s);}
for(const [h,points]of [[9,0],[10,10],[99999,10],[100000,25]]){s.records[0]={...P.clone(original),state:O.circular(h),maxHeight:h,engineOff:false};assert.equal(S.score(s).score,points);}
assert.equal(result(149998).score,25);assert.equal(result(150000).score,100);assert.equal(result(1000000).score,100);assert.equal(result(1000002).score,25);assert.equal(result(500000).score,100,'200–400 km is guidance, not a scoring constraint');
for(const [e,score]of [[.03,100],[.04,90],[.05,80],[.06,70]]){const v=result(150000,e);assert.equal(v.score,score);assert(v.passed);}
assert.equal(result(150000,.03001).score,99,'Rounding cannot award full marks before near-circular is reached');assert.equal(result(300000,0,{engineOff:false}).score,25);assert.equal(result(300000,0,{status:'impact'}).score,25);
s.records[0]={...P.clone(original),state:at(0),status:'impact',maxHeight:200000};assert.equal(S.score(s).score,25,'A later crash preserves reached milestones only');
const saved=P.clone(s.records);s=M.change(s,{type:'workshop'});s=M.change(s,{type:'launch'});assert.deepEqual(s.records,saved,'A retry cannot overwrite the selected flight');
s=T.launched();M.advance(s,1);const lit=M.change(s,{type:'record'});assert.equal(lit.records[0].engineOff,false);const stopped=M.change(s,{type:'record-stop'});assert.equal(stopped.flight.controls.lit,false);assert.equal(stopped.records[0].engineOff,true);assert.equal(stopped.flight.t,s.flight.t);
console.log('rocket scoring: fixed payload, untouched zero, earned milestones, safe boundaries, graduated circularity, cutoff and retained flight passed');

let ballistic=T.launched();M.advance(ballistic,1800,40000);assert.equal(ballistic.flight.status,'impact');assert(ballistic.flight.maxHeight>=100000);ballistic=M.change(ballistic,{type:'record'});assert.equal(S.score(ballistic).score,25);assert.equal(S.score(D.decode(T.snapshot(ballistic),'draft')).score,25);
