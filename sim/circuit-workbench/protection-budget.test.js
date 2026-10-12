'use strict';
const assert=require('node:assert/strict'),P=require('./circuit-ac-presets'),T=require('./circuit-transient');
(async()=>{
 for(const L of [2,1,.5]){const d=P.create('coupled');d.components[1].params.inductance=L;const s=new T.Session(d);s.advance(.99);const saved=s.capture(),reference=T.Session.restore(saved);reference.advance(.02);
  const start=performance.now(),timer=new Promise(resolve=>setTimeout(()=>resolve(performance.now()-start),0));s.advance(.02,{budget:10});const elapsed=performance.now()-start,wait=await timer;assert(elapsed<80&&wait<100,JSON.stringify({L,elapsed,wait}));
  let calls=0,max=elapsed;while(s.state.time<1.01-1e-12){const begin=performance.now();s.advance(1.01-s.state.time,{budget:5});max=Math.max(max,performance.now()-begin);assert(++calls<2000);}assert.equal(s.fault,null);assert.deepEqual(s.state,reference.state);assert.deepEqual(s.capture().protectionHistory,reference.capture().protectionHistory);console.log('Feedback protection budget',JSON.stringify({L,elapsed,timer:wait,max,calls}));
 }
 console.log('No speculative protection solves; finite-budget physical progression and timer responsiveness passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
