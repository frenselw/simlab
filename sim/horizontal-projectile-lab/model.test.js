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
const unchanged=M.change(s,{type:'point',slot:0,value:s.rows[0].point.slice()});assert.deepEqual(unchanged.fit,s.fit);assert.equal(unchanged.fitV,s.fitV);
const newRow=M.clone(s);newRow.rows[5]=null;newRow.calculations[5]={t:null,v:null};newRow.meanV=M.mean(newRow.calculations.slice(0,5).map(v=>v.v));
assert.equal(M.change(newRow,{type:'record',slot:5,depthMm:800,ppm:10}).meanV,newRow.meanV);
assert.equal(M.mean(Array(6).fill(Number.MAX_VALUE)),Number.MAX_VALUE);
const oldClock=s.rows[0].clockMs;assert.equal(M.change(s,{type:'read',slot:0,axis:1,value:800}).rows[0].clockMs,oldClock);
s=M.change(s,{type:'read',slot:0,axis:1,value:null});assert.equal(s.rows[0].point,null);assert.deepEqual(s.calculations[0],{t:null,v:null});
const parabola=M.fresh();[[200,70],[400,280],[600,630]].forEach((point,i)=>{parabola.rows[i]={depthMm:50+i*50,speedOffsetPpm:0,clockMs:M.impact(50+i*50,0).clockMs,read:point.slice(),point};});
for(const model of['square','quadratic']){parabola.fit={model,attempted:true};const f=M.fit(parabola);assert(f.ok);assert(Math.abs(f.coefficients[0]-1.75)<1e-12);assert(f.rmse<1e-12);}
parabola.fit.model='linear';assert(M.fit(parabola).rmse>.01);
console.log('Projectile model: noise, energy, fixed clocks and atomic dependencies passed.');

const row=T.filled().rows[0],x=Math.round(M.impact(row.depthMm,row.speedOffsetPpm).x);
for(const axis of ['x','y']){
  const actual=axis==='x'?x:row.depthMm;
  for(const zero of [[0,0],[50,50],[-100,-100]]){
    const ruler={axis,zero},choices=M.rulerChoices(row,ruler),local=actual-zero[axis==='x'?0:1];
    assert.equal(choices.length,4);assert.equal(new Set(choices).size,4);assert(choices.every(v=>M.integer(v,0,1000)));assert(choices.includes(local));assert.deepEqual(choices,M.rulerChoices(row,ruler));
    if(zero[0]===0)assert.equal(choices.filter(v=>SCORE_NEAR(v,actual)).length,1);else assert(choices.every(v=>!SCORE_NEAR(v,actual)));
  }
}
function SCORE_NEAR(a,b){return Math.abs(a-b)<=5;}
assert.deepEqual(M.rulerChoices(null,{axis:'x',zero:[0,0]}),[]);
assert.deepEqual(M.rulerChoices(row,{axis:'x',zero:[1000,0]}),[]);
for(const depth of [50,800])for(const offset of [-10000,10000])for(const axis of ['x','y']){
 const r={depthMm:depth,speedOffsetPpm:offset},p=M.impact(depth,offset),zero=axis==='x'?[Math.round(p.x),0]:[0,depth];
 assert.equal(new Set(M.rulerChoices(r,{axis,zero})).size,4);
}
const V=require('./presentation.js');
for(const tex of ['O(0,0)','t=\\sqrt{\\frac{2y}{g}}','v_0 / (\\mathrm{m}\\,\\mathrm{s}^{-1})',V.number(Number.MAX_VALUE),V.number(-Number.MAX_VALUE)])assert(!V.math(tex).includes('merror'));
assert(!V.number(Number.MAX_VALUE).includes('Infinity'));assert(V.prose('P1 x–t，9.80 m/s²').includes('data-tex'));
console.log('Ruler choices: own-scale values, unique aligned answer, wrong-origin distractors, endpoints and TeX passed.');

let spaced=M.change(M.fresh(),{type:'record',slot:0,depthMm:200,ppm:0});
assert.equal(M.heightConflict(spaced,200,1),0);assert.equal(M.heightConflict(spaced,245,1),0);assert.equal(M.heightConflict(spaced,250,1),-1);
for(const depthMm of [155,195,200,245])assert.throws(()=>M.change(spaced,{type:'record',slot:1,depthMm,ppm:0}));
spaced=M.change(spaced,{type:'record',slot:1,depthMm:250,ppm:0});assert.equal(spaced.rows[1].depthMm,250);
assert.doesNotThrow(()=>M.change(spaced,{type:'record',slot:0,depthMm:200,ppm:10}));
const legacy=M.clone(spaced);legacy.rows[1]=M.clone(legacy.rows[0]);assert.deepEqual(P.decode(T.snapshot(legacy),'draft'),legacy);assert.doesNotThrow(()=>M.change(legacy,{type:'record',slot:1,depthMm:250,ppm:0}));
const unsel=M.clone(spaced);unsel.selectedSlot=null;assert.deepEqual(M.snapRuler(unsel,[5,6],1,12),[5,6]);
unsel.selectedSlot=0;assert.deepEqual(M.snapRuler(unsel,[5,6],1,12),[0,0]);assert.deepEqual(M.snapRuler(unsel,[30,35],1,12),[30,35]);
console.log('Height spacing: 5 cm boundaries, atomic rejection, own-slot redo, legacy resume; selected-only ruler snapping passed.');
