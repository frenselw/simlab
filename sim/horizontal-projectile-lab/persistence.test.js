'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js'),T=require('./test-support.js'),R=require('./ui-runtime.js'),Flow=require('../shared/activity-flow.js');
const variants=[M.fresh(),T.filled()];
let a=M.change(M.fresh(),{type:'formula',field:'speed',value:'vertical'});variants.push(a);
for(const axis of[0,1]){let p=M.change(M.fresh(),{type:'record',slot:0,depthMm:50,ppm:-10000});p=M.change(p,{type:'read',slot:0,axis,value:0});variants.push(p);}
for(const model of[null,'linear','quadratic','inverse'])for(const attempted of[false,true]){if(model===null&&attempted)continue;const s=M.fresh();s.fit={model,attempted};variants.push(s);}
for(const n of[1,2,3,4,5,6]){const s=T.filled();for(let i=n;i<6;i++)s.rows[i]=null;s.meanV=n>=2?M.mean(M.calculations(s).slice(0,n).map(c=>c.v)):null;variants.push(s);}
for(const time of [null,...M.FORMULAS.time.map(f=>f.id)])for(const speed of [null,...M.FORMULAS.speed.map(f=>f.id)]){const s=T.filled();s.formulas={time,speed};s.meanV=null;variants.push(s);}
const zero=T.filled();zero.rows.forEach(r=>r.read=[0,0]);zero.meanV=null;zero.fit.attempted=true;variants.push(zero);
for(const base of [-300000,-150000,0])variants.push(M.practice(M.fresh(base),()=>.65));
for(const s of [...variants])variants.push({...M.clone(s),rubricVersion:3});
let cases=0;
for(const base of variants)for(const view of M.VIEWS)for(const phase of['edit','check'])for(const returning of[false,true]){
  if(phase==='check'&&returning)continue;
  const s={...M.clone(base),phase,view,returnToCheck:returning},snap=T.snapshot(s),decoded=P.decode(JSON.parse(JSON.stringify(snap)),'draft');
  assert.deepEqual(decoded,s);assert.equal(S.score(s).score,S.score(decoded).score);assert.deepEqual(M.points(decoded),M.points(s));assert.deepEqual(M.calculations(decoded),M.calculations(s));
  const fake=T.fake({state:'draft',snapshot:snap}),c=new R.Controller(fake,Flow);c.start();assert.equal(c.mode,phase);
  if(phase==='check'){c.navigate('speed');assert(c.state.returnToCheck);}assert(c.command({type:'formula',field:'time',value:s.formulas.time==='fall'?'half':'fall'}));assert.deepEqual(c.state.rows,s.rows);c.check();assert.equal(c.mode,'check');
  const review=T.snapshot(s,'review');assert.equal(S.score(P.decode(review,'review')).score,S.score(s).score);cases++;
}
const corrupt=[s=>delete s.rows,s=>s.rows[0].speedOffsetPpm=10001,s=>s.rows[0].clockMs++,s=>s.rows[0].read[0]=NaN,s=>s.rows[0].point=[10,20],s=>s.calculations=[],s=>s.formulas.time='unknown',s=>delete s.formulas.speed,s=>s.selectedSlot=0,s=>s.schemaVersion=4,s=>s.rubricVersion=1,s=>s.rubricVersion=5,s=>s.phase='unknown',s=>s.clockShown=false,s=>s.conclusions={},s=>s.fit.model='square',s=>s.view='motion',s=>s.meanV=Infinity,s=>s.trajectory='ellipse'];
for(const mutate of corrupt){const s=T.filled();mutate(s);assert.throws(()=>P.draft(s),String(mutate));}
const legacy=T.legacyFilled(),oldReview=T.snapshot(legacy,'review');assert.equal(S.score(P.decode(oldReview,'review')).score,100);
for(const value of [null,1,-300001,NaN,Infinity]){const s=T.filled();s.launchOffsetPpm=value;assert.throws(()=>P.draft(s));}
const mixed=M.practice(M.fresh(-300000),()=>.5);mixed.rows[0].speedOffsetPpm=0;assert.throws(()=>P.draft(mixed));
assert.throws(()=>P.decode({version:1,activity:P.ACTIVITY,kind:'draft',answer:legacy},'draft'),/Legacy draft/);assert.throws(()=>P.editableFromReview(P.review(legacy)));
const max=T.filled();max.meanV=Number.MAX_VALUE;max.ruler.zero=[-100,1000];
const draft=T.snapshot(max),review=T.snapshot(max,'review'),pending={version:1,activity:P.ACTIVITY,kind:'pending-final',payload:{score:review.score,maxScore:100,passed:review.passed,reviewJson:JSON.stringify(review)}};
for(const snap of[draft,review,pending])assert(P.bytes(snap)<=4000,`oversize ${P.bytes(snap)}`);
assert.equal(P.decode(draft,'draft').rows[0].speedOffsetPpm,max.rows[0].speedOffsetPpm);
console.log(`Projectile persistence: ${cases} draft variants with executed formula continuations, review, legacy review and draft protection; max bytes ${P.bytes(draft)}/${P.bytes(review)}/${P.bytes(pending)} passed.`);

const oldV2=T.legacyV2Filled();delete oldV2.launchOffsetPpm;const v2Review=T.snapshot(oldV2,'review');assert.equal(S.score(P.decode(v2Review,'review')).score,100);
assert.throws(()=>P.decode({version:1,activity:P.ACTIVITY,kind:'draft',answer:oldV2},'draft'),/Legacy draft/);assert.throws(()=>P.editableFromReview(P.review(oldV2)));
for(const model of ['linear','quadratic','inverse']){const s=T.filled();s.fit={model,attempted:true};const restored=P.decode(T.snapshot(s),'draft');assert.deepEqual(M.fit(restored),M.fit(s));assert.equal(P.navigate(restored,'speed').view,'speed');}

for(const s of[T.legacyFilled(),T.legacyV2Filled()]){s.rubricVersion=4;assert.throws(()=>P.review(s));}
