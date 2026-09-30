"use strict";
const assert=require('node:assert/strict'),M=require('./model.js');
const reference=[[[800,-800],[1600,-1600],[2400,-2400],[3200,-3200]],[[800,-200],[1600,-800],[2400,-1800],[3200,-3200]],[[200,-800],[800,-1600],[1800,-2400],[3200,-3200]],[[200,-200],[800,-800],[1800,-1800],[3200,-3200]]];
for(let index=0;index<4;index++){
  assert.deepEqual(M.expected(index),reference[index]);
  for(let time=0;time<=80;time++){
    const [x,y]=M.position(index,time/100).map(v=>v/1000);
    if(index===0||index===3)assert.ok(Math.abs(x+y)<.002);
    if(index===1)assert.ok(Math.abs(y+5*x*x/16)<.002);
    if(index===2)assert.ok(Math.abs(x-5*y*y/16)<.002);
  }
  for(const axis of [0,1])assert.deepEqual(M.gaps(index,axis),M.CASES[index][axis?'ay':'ax']===0?[800,800,800,800]:[200,600,1000,1400]);
}
assert.deepEqual(M.expected(0).at(-1),M.expected(3).at(-1));assert.notDeepEqual(M.gaps(0,0),M.gaps(3,0));
for(const [w,h] of [[320,210],[390,252],[1280,800]]){
  const l=M.layout(w,h);
  for(const p of reference.flat()){const pixel=M.pixel(p,l),back=M.world(pixel,l);assert.ok(back.every((v,i)=>Math.abs(v-p[i])<1e-9));}
  const a=M.pixel([200,0],l),b=M.pixel([0,-200],l),o=M.pixel([0,0],l);assert.ok(Math.abs((a.x-o.x)-(b.y-o.y))<1e-9);
  for(const type of ['touch','mouse','pen'])for(const p of [[200,-200],[2000,-1200],[0,0],[-400,400]])assert.deepEqual(M.resolve(M.pixel(p,l),l,type).point,p);
  assert.equal(M.resolve({x:l.left-1,y:l.top},l),null);
}
assert.equal(M.validPoint([NaN,0]),false);assert.equal(M.validPoint([Infinity,0]),false);assert.equal(M.validPoint([0.5,0]),false);assert.equal(M.validPoint([3601,0]),false);
assert.equal(M.validCase({...M.emptyCase(),motions:['accelerating',null]}),true);assert.equal(M.validCase({...M.emptyCase(),points:[[0,0],null,null,null]}),false);
console.log('motion composition model: four independent motions, trajectories, equal-time gaps, geometry and public-grid snap passed');
