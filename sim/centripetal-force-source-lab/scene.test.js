'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),V=require('./scene.js'),P=require('./persistence.js'),S=require('./scoring.js');
const s=M.fresh(()=>.2);
for(let page=0;page<6;page++)for(const [w,h]of [[256,80],[326,371],[876,690]]){
  const initial=V.scene(page,s.def,{w,h},.13),later=V.scene(page,s.def,{w,h},.63);
  assert.notEqual(initial,later);assert(!/NaN|Infinity|undefined/.test(initial));
  assert(initial.includes('data-object="'+['ball','block','ball','car','car','earth'][page]+'"'));
  assert(V.duration(s.def,page)>=3);
}
for(const page of [3,4]){
  const middle=V.carPose(page,600,400,.5),before=V.carPose(page,600,400,.25),after=V.carPose(page,600,400,.75);
  assert.equal(middle.x,300);assert.equal(Math.abs(middle.rotation),0);assert.equal(before.y,after.y);
  assert(page===3?middle.y<before.y:middle.y>before.y);
  assert.equal(V.carPose(page,600,400,1.5).y,middle.y);
}
assert.equal(V.nextTarget(.2),.5);assert.equal(V.nextTarget(.5),.5);assert.equal(V.nextTarget(.7),1.5);assert.equal(V.nextTarget(2.9),3.5);
for(const pose of [0,1345,3876,5000,9999]){
  let state=M.navigate(s,5);state=M.change(state,{type:'analyse',pose});
  const p=M.physics(state.def,5,pose),a=state.items[5];a.inward=p.inward;a.arrows=p.forces.map(f=>[f[0],f[1],60]);a.relation=M.CASES[5].relation;
  assert.equal(S.score(state).detail[5].earned,16);
  const copy=P.decode({version:1,activity:M.ACTIVITY,kind:'draft',answer:P.draft(state)},'draft');
  assert.equal(copy.items[5].pose,pose);assert.equal(M.change(copy,{type:'analyse',pose:1234}).items[5].pose,pose);
  const cleared=M.change(copy,{type:'clear-page'});assert.equal(M.change(cleared,{type:'analyse',pose:1234}).items[5].pose,1234);
}
let drawn=M.change(s,{type:'palette',value:2});drawn=M.change(drawn,{type:'draw',angle:1800,length:70});assert.deepEqual(drawn.items[0].arrows,[[2,1800,70]]);
assert.deepEqual(s.items[0].arrows,[]);assert.throws(()=>M.change(drawn,{type:'draw',angle:NaN,length:70}));
console.log('Centripetal scenes: six visible objects, moving poses, bridge target crossing, free Earth pose scoring, stable observation and atomic drawing passed.');
