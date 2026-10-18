'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js'),T=require('./test-support.js'),R=require('./ui-runtime.js'),Flow=require('../shared/activity-flow.js');
const variants=[M.fresh(),T.filled()];
let a=M.change(M.fresh(),{type:'clock'});a=M.change(a,{type:'conclusion',field:'horizontal',value:'uniform'});variants.push(a);
for(const axis of[0,1]){let p=M.change(M.fresh(),{type:'record',slot:0,depthMm:50,ppm:-10000});p=M.change(p,{type:'read',slot:0,axis,value:0});variants.push(p);}
for(const model of[null,'linear','quadratic','square'])for(const attempted of[false,true]){if(model===null&&attempted)continue;const s=M.fresh();s.fit={model,attempted};variants.push(s);}
for(const n of[1,2,3,4,5,6]){const s=T.filled();for(let i=n;i<6;i++){s.rows[i]=null;s.calculations[i]={t:null,v:null};}s.selectedSlot=0;s.meanV=n>=2?M.mean(s.calculations.slice(0,n).map(c=>c.v)):null;s.fitV=null;s.gFromClock=null;variants.push(s);}
let cases=0;
for(const base of variants)for(const view of M.VIEWS)for(const phase of['edit','check'])for(const returning of[false,true]){
  if(phase==='check'&&returning)continue;
  const s={...M.clone(base),phase,view,returnToCheck:returning};const snap=T.snapshot(s);const decoded=P.decode(JSON.parse(JSON.stringify(snap)),'draft');
  assert.deepEqual(decoded,s);assert.equal(S.score(s).score,S.score(decoded).score);
  const fake=T.fake({state:'draft',snapshot:snap}),c=new R.Controller(fake,Flow);c.start();assert.equal(c.mode,phase);
  if(phase==='check'){c.navigate('collect');assert.equal(c.mode,'edit');assert(c.state.returnToCheck);}else{c.check();assert.equal(c.mode,'check');}
  const review=T.snapshot(s,'review');assert.equal(S.score(P.decode(review,'review')).score,S.score(s).score);cases++;
}
const zero=variants[2],c=new R.Controller(T.fake({state:'draft',snapshot:T.snapshot(zero)}),Flow);c.start();c.navigate('collect');c.command({type:'record',slot:0,depthMm:50,ppm:123});assert.equal(c.state.conclusions.horizontal,'uniform');assert(c.state.clockShown);
const corrupt=[s=>delete s.rows,s=>s.rows[0].speedOffsetPpm=10001,s=>s.rows[0].clockMs++,s=>s.rows[0].read[0]=NaN,s=>s.rows[0].point=[Infinity,0],s=>s.calculations[0].v=-1,s=>s.calculations[0].t=11,s=>s.selectedSlot=6,s=>s.schemaVersion=2,s=>s.phase='unknown',s=>s.clockShown=false,s=>s.rows[0]=null,s=>s.conclusions.horizontal='wrong',s=>s.fit.attempted=false];
for(const mutate of corrupt){const s=T.filled();mutate(s);assert.throws(()=>P.draft(s));}
const max=T.filled();max.calculations.forEach(c=>c.v=Number.MAX_VALUE);max.meanV=max.fitV=max.gFromClock=Number.MAX_VALUE;max.ruler.zero=[-100,1000];
const draft=T.snapshot(max),review=T.snapshot(max,'review'),pending={version:1,activity:P.ACTIVITY,kind:'pending-final',payload:{score:review.score,maxScore:100,passed:review.passed,reviewJson:JSON.stringify(review)}};
for(const snap of[draft,review,pending])assert(P.bytes(snap)<=4000,`oversize ${P.bytes(snap)}`);
assert.equal(P.decode(draft,'draft').rows[0].speedOffsetPpm,max.rows[0].speedOffsetPpm);
console.log(`Projectile persistence: ${cases} draft variants plus review round-trips and legal continuations; max bytes ${P.bytes(draft)}/${P.bytes(review)}/${P.bytes(pending)} passed.`);
