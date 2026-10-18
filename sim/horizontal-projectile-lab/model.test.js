'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),T=require('./test-support.js');
assert.equal(M.drawOffset(()=>0),-10000);assert.equal(M.drawOffset(()=>.5),0);assert.equal(M.drawOffset(()=>1-Number.EPSILON),10000);
for(const n of[-1,1,Infinity,NaN])assert.throws(()=>M.drawOffset(()=>n));
for(const d of[50,200,800])for(const ppm of[-10000,0,10000]){
  const p=M.impact(d,ppm);assert(p.v<=M.IDEAL);assert.equal(p.y,d);assert(Math.abs(.5*M.G*p.t*p.t-d/1000)<1e-12);assert(Math.abs(p.x/(M.SPEED*p.t*1000)-(1+ppm/1e6))<1e-12);
}
let s=T.filled();assert.equal(P.validate(s,'draft'),s);
for(const type of['calculation','read','record']){
  const action=type==='calculation'?{type,slot:0,field:'t',value:.3}:type==='read'?{type,slot:0,axis:0,value:100}:{type,slot:0,depthMm:50,ppm:123};
  const n=M.change(s,action);assert.equal(n.meanV,null);assert.equal(n.calculations[0].v,null);assert.deepEqual(n.calculations[1],s.calculations[1]);P.draft(n);
}
const c=M.change(s,{type:'clearPlot'});assert.equal(c.fitV,null);assert.equal(c.meanV,s.meanV);assert.deepEqual(c.calculations,s.calculations);
const newRow=M.clone(s);newRow.rows[5]=null;newRow.calculations[5]={t:null,v:null};newRow.meanV=M.mean(newRow.calculations.slice(0,5).map(v=>v.v));
assert.equal(M.change(newRow,{type:'record',slot:5,depthMm:800,ppm:10}).meanV,newRow.meanV);
assert.equal(M.mean(Array(6).fill(Number.MAX_VALUE)),Number.MAX_VALUE);
const oldClock=s.rows[0].clockMs;assert.equal(M.change(s,{type:'read',slot:0,axis:1,value:800}).rows[0].clockMs,oldClock);
s=M.change(s,{type:'read',slot:0,axis:1,value:null});assert.equal(s.rows[0].point,null);assert.deepEqual(s.calculations[0],{t:null,v:null});
console.log('Projectile model: noise, energy, fixed clocks and atomic dependencies passed.');
