"use strict";
const assert=require('node:assert/strict'),A=require('./animation.js'),M=require('./model.js');
function fakeClock(){let now=0,id=0;const callbacks=new Map();return {now:()=>now,request:fn=>{callbacks.set(++id,fn);return id;},cancel:key=>callbacks.delete(key),advance:ms=>{now+=ms;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn());},take:()=>[...callbacks.values()][0]};}
for(const reduced of [false,true]){
  const clock=fakeClock(),views=[],done=[],motion=A.createController({clock,onUpdate:v=>views.push(v),onComplete:v=>done.push(v)});
  motion.start('capture',reduced);assert.equal(motion.snapshot().stamps,0);
  clock.advance(799);assert.equal(motion.snapshot().stamps,0);assert.ok(reduced?motion.snapshot().time===0:motion.snapshot().time>0);
  clock.advance(1);assert.equal(motion.snapshot().stamps,1);assert.equal(motion.snapshot().time,M.DT);
  clock.advance(800);assert.equal(motion.snapshot().stamps,2);assert.equal(done.length,0);
  clock.advance(800);assert.equal(motion.snapshot().stamps,3);
  clock.advance(800);assert.equal(motion.snapshot().stamps,4);assert.equal(motion.snapshot().time,.8);assert.equal(motion.isActive(),false);assert.equal(done.length,1);
  assert.deepEqual([...new Set(views.filter(v=>v.kind==='capture').map(v=>v.stamps))],[0,1,2,3,4]);
  motion.start('replay',reduced);clock.advance(801);assert.equal(motion.snapshot().stamps,1);
  const stale=clock.take();motion.cancel();stale();assert.equal(motion.snapshot().kind,'idle');assert.equal(done.length,1,'cancelled frame cannot finish a different observation');
  motion.start('capture',reduced);clock.advance(9000);assert.equal(motion.snapshot().stamps,4);assert.equal(done.length,2,'skipped browser frames retain exact exposure positions');
  motion.start('preview',reduced);clock.advance(A.DURATION_MS);assert.equal(motion.snapshot().stamps,0,'preview creates no strobe evidence');
}
console.log('motion composition animation: progressive equal-time exposure, reduced-motion stepping, cancellation and delayed frames passed');
