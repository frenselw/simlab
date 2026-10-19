'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),T=require('./test-support.js');
assert.equal(M.drawOffset(()=>0),-10000);assert.equal(M.drawOffset(()=>.5),0);assert.equal(M.drawOffset(()=>1-Number.EPSILON),10000);
for(const n of[-1,1,Infinity,NaN])assert.throws(()=>M.drawOffset(()=>n));
for(const d of[50,200,800])for(const ppm of[-10000,0,10000]){
  const p=M.impact(d,ppm);assert(p.v<=M.IDEAL);assert.equal(p.y,d);assert(Math.abs(.5*M.G*p.t*p.t-d/1000)<1e-12);assert(Math.abs(p.x/(M.SPEED*p.t*1000)-(1+ppm/1e6))<1e-12);
}
let s=T.filled();assert.equal(P.validate(s,'draft'),s);
for(const type of['formula','read','record']){
  const action=type==='formula'?{type,field:'time',value:'half'}:type==='read'?{type,slot:0,axis:0,value:100}:{type,slot:0,depthMm:50,ppm:123};
  const n=M.change(s,action);assert.equal(n.meanV,null);if(type!=='formula')assert.deepEqual(M.calculations(n)[1],M.calculations(s)[1]);P.draft(n);
}
const c=M.change(s,{type:'clearPlot'});assert.equal(c.fit.attempted,false);assert.equal(c.meanV,s.meanV);assert.deepEqual(M.points(c),M.points(s));
const unchanged=M.change(s,{type:'read',slot:0,axis:0,value:s.rows[0].read[0]});assert.deepEqual(unchanged,s);
assert.deepEqual(M.change(s,{type:'formula',field:'time',value:'fall'}),s);
assert.equal(M.practice,undefined);
for(const type of ['practice','point','calculation','select','connect'])assert.throws(()=>M.change(s,{type}));
assert.throws(()=>M.change(s,{type:'formula',field:'time',value:'unknown'}));
assert.equal(M.mean(Array(6).fill(Number.MAX_VALUE)),Number.MAX_VALUE);
const oldClock=s.rows[0].clockMs;assert.equal(M.change(s,{type:'read',slot:0,axis:1,value:800}).rows[0].clockMs,oldClock);
s=M.change(s,{type:'read',slot:0,axis:1,value:null});assert.equal(M.points(s)[0],null);assert.deepEqual(M.calculations(s)[0],{t:null,v:null});
const parabola=M.fresh();[[200,70],[400,280],[600,630]].forEach((point,i)=>{parabola.rows[i]={depthMm:50+i*50,speedOffsetPpm:0,clockMs:M.impact(50+i*50,0).clockMs,read:point.slice()};});
for(const model of['quadratic']){parabola.fit={model,attempted:true};const f=M.fit(parabola);assert(f.ok);assert(Math.abs(f.coefficients[0]-1.75)<1e-12);assert(f.rmse<1e-12);}
parabola.fit.model='linear';assert(M.fit(parabola).rmse>.01);
console.log('Projectile model: noise, energy, fixed clocks and atomic dependencies passed.');

const row=T.filled().rows[0],x=Math.round(M.impact(row.depthMm,row.speedOffsetPpm).x);
for(const axis of ['x','y']){
  const actual=axis==='x'?x:row.depthMm;
  for(const zero of [[0,0],[1,1],[-1,-1],[10,10],[20,20],[50,50],[-100,-100],[1000,1000]]){
    const ruler={axis,zero},choices=M.rulerChoices(row,ruler),local=actual-zero[axis==='x'?0:1],sorted=choices.slice().sort((a,b)=>a-b);
    assert(sorted.slice(1).every((n,i)=>n-sorted[i]>=3));
    assert.equal(choices.length,4);assert.equal(new Set(choices).size,4);assert(choices.every(v=>M.integer(v,0,1000)));if(zero[axis==='x'?0:1]===0)assert(choices.includes(local));assert.deepEqual(choices,M.rulerChoices(row,ruler));
    if(zero[0]===0)assert.equal(choices.filter(v=>SCORE_NEAR(v,actual)).length,1);else assert(choices.every(v=>!SCORE_NEAR(v,actual)));
  }
}
function SCORE_NEAR(a,b){return a===b;}
assert.deepEqual(M.rulerChoices(null,{axis:'x',zero:[0,0]}),[]);
assert.equal(M.rulerChoices(row,{axis:'x',zero:[1000,0]}).length,4);
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
const unsel=M.clone(spaced);unsel.selectedSlot=null;assert.deepEqual(M.snapRuler(unsel,[5,6],1,12),[0,6]);
unsel.ruler.axis='y';assert.deepEqual(M.snapRuler(unsel,[5,6],1,12),[5,0]);unsel.ruler.axis='x';
unsel.selectedSlot=0;
for(const axis of ['x','y']){
 unsel.ruler.axis=axis;const p=M.impact(unsel.rows[0].depthMm,unsel.rows[0].speedOffsetPpm),mark=[Math.round(p.x),p.y],along=axis==='x'?0:1,across=1-along;
 for(const offset of [0,1,10,50]){
  const raw=mark.slice();raw[along]=offset;raw[across]+=8;
  const snapped=M.snapRuler(unsel,raw,1,12);assert.equal(snapped[along],offset<=12?0:offset);assert.equal(snapped[across],mark[across]);
  assert(M.rulerAligned(unsel.rows[0],{axis,zero:snapped}));assert(!M.rulerAligned(unsel.rows[0],{axis,zero:raw}));
 }
 const near=[5,6],expected=near.slice();expected[along]=0;assert.deepEqual(M.snapRuler(unsel,near,1,12),expected);
 for(const offset of [-13,-12,12,13]){const raw=mark.slice();raw[along]=offset;const result=M.snapRuler(unsel,raw,1,12);assert.equal(result[along],Math.abs(offset)<=12?0:offset);}
 const wrong=mark.slice();wrong[along]=100;const displaced=M.snapRuler(unsel,wrong,.3,12);assert.equal(displaced[along],100);assert(M.rulerAligned(unsel.rows[0],{axis,zero:displaced}));
 assert(M.rulerChoices(unsel.rows[0],{axis,zero:displaced}).every(n=>Math.abs(n-mark[along])>5));
}
assert(!M.rulerAligned(null,{axis:'x',zero:[0,0]}));
for(const time of M.FORMULAS.time)for(const speed of M.FORMULAS.speed){
 const q=T.filled();q.formulas={time:time.id,speed:speed.id};const [x,y]=q.rows[0].read.map(n=>n/1000),t={fall:Math.sqrt(2*y/M.G),half:Math.sqrt(y/M.G),double:Math.sqrt(4*y/M.G),horizontal:Math.sqrt(2*x/M.G)}[time.id];
 const v={horizontal:x/t,vertical:y/t,double:2*x/t,half:x/(2*t)}[speed.id];assert.deepEqual(M.calculations(q)[0],{t,v});
}
for(const time of [null,...M.FORMULAS.time.map(f=>f.id)]){
 const q=T.filled();q.formulas.time=time;q.rows[0].read=[0,0];assert.equal(M.calculations(q)[0].t,time===null?null:0);assert.equal(M.calculations(q)[0].v,null);
 q.rows[0].read=[10,null];assert.deepEqual(M.calculations(q)[0],{t:null,v:null});
}
for(const axis of ['x','y']){
 const values=M.rulerChoices(row,{axis,zero:[0,0]});assert.equal(Math.max(...values)-Math.min(...values),9);assert.equal(values.filter(n=>SCORE_NEAR(n,axis==='x'?x:row.depthMm)).length,1);
}
const example=T.measured(M.fresh(-80000),()=>.5).rows[1];
assert.deepEqual(M.rulerChoices(example,{axis:'x',zero:[0,150]}).sort((a,b)=>a-b),[261,264,267,270]);
for(const axis of ['x','y'])for(const selectedSlot of [null,0,1]){
 const s=M.clone(spaced);s.selectedSlot=selectedSlot;s.ruler.axis=axis;const before=M.clone(s),along=axis==='x'?0:1,across=1-along;
 for(let i=0;i<2;i++){
  const p=M.impact(s.rows[i].depthMm,s.rows[i].speedOffsetPpm),target=[Math.round(p.x),p.y],raw=target.slice();raw[along]=50;raw[across]+=7;
  assert.equal(M.rulerSlot(s.rows,{axis,zero:raw}),null);
  const zero=M.snapRuler(s,raw,1,8);assert.equal(zero[across],target[across]);assert.equal(zero[along],50);assert.equal(M.rulerSlot(s.rows,{axis,zero}),i);
  raw[across]=target[across]+9;assert.deepEqual(M.snapRuler(s,raw,1,8),raw);
 }
 assert.deepEqual(s,before);
 const a=M.impact(s.rows[0].depthMm,s.rows[0].speedOffsetPpm),b=M.impact(s.rows[1].depthMm,s.rows[1].speedOffsetPpm),middle=[0,0];middle[across]=(Math.round(across?a.y:a.x)+Math.round(across?b.y:b.x))/2;
 assert.equal(M.rulerSlot(s.rows,{axis,zero:middle},100),0);
 assert.equal(M.rulerSlot(legacy.rows,{axis,zero:[Math.round(a.x),a.y]}),0);
}
assert.equal(M.rulerSlot(M.fresh().rows,{axis:'x',zero:[0,0]}),null);
assert.equal(M.drawLaunchOffset(()=>0),-300000);assert.equal(M.drawLaunchOffset(()=>1-Number.EPSILON),0);
for(const n of [-1,1,NaN,Infinity])assert.throws(()=>M.drawLaunchOffset(()=>n));
for(const base of [-300000,-150000,0]){
 const start=M.fresh(base),demo=T.measured(start,()=>.65);P.draft(demo);assert.equal(demo.view,'plot');assert.equal(demo.launchOffsetPpm,base);assert.equal(M.points(demo).filter(Boolean).length,6);
 assert.deepEqual(demo.formulas,{time:null,speed:null});assert.deepEqual(demo.fit,{model:null,attempted:false});assert.equal(demo.meanV,null);assert(!Object.hasOwn(demo,'clockShown'));assert(!Object.hasOwn(demo,'conclusions'));assert(start.rows.every(v=>v===null));assert.throws(()=>T.measured(demo));
 for(const jitter of [-10000,0,10000]){
  const ppm=M.observedOffset(base,jitter),p=M.impact(800,ppm);assert(Math.abs(p.v/M.referenceSpeed(start)-(1+jitter/1e6))<.000001);assert(p.v<=M.IDEAL);assert.equal(p.t,M.impact(800,0).t);
  const saved=M.change(start,{type:'record',slot:0,depthMm:800,ppm});P.draft(saved);assert.equal(saved.rows[0].speedOffsetPpm,ppm);
 }
 const [low,high]=M.offsetBounds(start);for(const ppm of [low-1,high+1])assert.throws(()=>M.change(start,{type:'record',slot:0,depthMm:800,ppm}));
}
assert(M.impact(800,M.observedOffset(-300000,0)).x<M.impact(800,M.observedOffset(0,0)).x);
console.log('Per-experiment random launch offsets, one-percent within-run scatter and test-only measurements passed.');
console.log('Height spacing, legacy resume, automatic nearest ruler targets, ties, thresholds and selection independence passed.');

// The known origin participates in the same ordinary least-squares fit.
const F=require('../newtons-second-law-investigation-lab/fitting.js');
for(const model of ['linear','quadratic']){
 const s=T.filled();s.fit={model,attempted:true};const data=M.points(s).filter(Boolean).map(p=>p.map(n=>n/1000));
 const actual=M.fit(s),expected=F.fit(model,[[0,0],...data]);assert(actual.ok);assert.equal(actual.n,7);assert.deepEqual(actual.coefficients,expected.coefficients);
 assert.notDeepEqual(actual.coefficients,F.fit(model,data).coefficients);
 s.rows[0].read=[0,0];s.rows[1].read=[0,0];assert.equal(M.fit(s).n,5);
}
const inverse=T.filled();inverse.fit={model:'inverse',attempted:true};assert(!M.fit(inverse).ok);assert.equal(M.fit(inverse).n,7);assert(M.fit(inverse).message.includes('沒有定義'));
assert.throws(()=>M.change(T.filled(),{type:'model',value:'inverse'}));
assert.equal(M.change(inverse,{type:'model',value:'quadratic'}).fit.model,'quadratic');
assert.deepEqual(M.VIEWS,['collect','measure','plot','speed']);
for(const action of [{type:'clock'},{type:'conclusion',field:'horizontal',value:'uniform'},{type:'answer',field:'fitV',value:1}])assert.throws(()=>M.change(T.filled(),action));
console.log('Origin participates once in linear/quadratic fits; inverse never discards the origin.');
