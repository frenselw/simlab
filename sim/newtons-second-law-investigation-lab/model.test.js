"use strict";
const assert = require("node:assert/strict"), M = require("./model.js"), P = require("./persistence.js"), E = require("./experiment.js");
const { record, filled } = require("./test-support.js");
for (let mi=0;mi<7;mi++) for(let fi=0;fi<6;fi++) {
  const a=M.force(fi)/M.mass(mi), r=M.measure(mi,fi);
  assert.deepEqual(r,[mi,fi,Math.round(a*1000)]); assert.ok(M.validRecord(r));
  for(const t of [0,.125,.4,.85,1]) {
    const v=M.motion(mi,fi,t); assert.ok(Math.abs(v.position-(.1+.5*a*t*t))<1e-12);
    assert.equal(v.velocity,a*t); assert.ok(v.position<2 && v.position>=.1);
  }
  const timing=E.timing([mi,fi]), ready=M.motion(mi,fi,timing.ready), end=M.motion(mi,fi,timing.end);
  assert.ok(timing.ready>=1 && timing.ready<timing.end,"first-second sample precedes reading, reading precedes exit");
  assert.ok(ready.position>=1.1-1e-12 && ready.position<=1.3+1e-12,"reading after about one metre of travel");
  assert.ok(Math.abs(end.position-2.8)<1e-12 && end.velocity>ready.velocity,"cart keeps accelerating to exit");
  assert.ok(timing.end<7.35,"slowest real-time run remains bounded");
  assert.equal(M.values(r).inverse,Math.round(1000/M.mass(mi))/1000);
  const s=record(M.fresh(),1,mi,fi); assert.deepEqual(M.bounds(s,1),M.bounds(s,2));
  assert.ok(M.bounds(s,1).y>=a*1.09);
}
for(const args of [[-1,0,0],[0,6,0],[0,0,-1],[0,0,Infinity],[0,0,Number.MAX_VALUE],[0,0,NaN]]) assert.throws(()=>M.motion(...args));
let s=M.fresh(); const pristine=M.clone(s);
s=M.change(s,{type:"measure"}); assert.equal(s.groups[0].records.length,0);
assert.deepEqual(s.setups[0].candidate,[2,2,600]); assert.deepEqual(pristine,M.fresh());
s=M.change(s,{type:"lock",index:0});
assert.deepEqual(M.change(s,{type:"setting",index:0,value:0}),s,"lock holds measured condition");
s=M.change(s,{type:"setting",index:1,value:3}); assert.equal(s.setups[0].candidate,null);
s=M.change(s,{type:"record"}); assert.equal(s.groups[0].records.length,0,"no invented reading");
for(let i=0;i<7;i++) s=record(s,0,2,i%6);
assert.equal(s.groups[0].records.length,6); assert.equal(s.setups[0].candidate,null);
assert.deepEqual(s.plots.map(p=>p.points.length),[6,0,0]); P.draft(s);
s=filled(); assert.deepEqual(M.change(s,{type:"place",graph:0,index:0,point:s.plots[0].points[0]}),s,"selecting a point preserves its fit"); const independent=M.clone(s.plots[0]), original=M.clone(s);
s=M.change(s,{type:"removeRecord",group:1,index:2});
assert.deepEqual(s.plots[0],independent);
for(const g of [1,2]) { assert.equal(s.plots[g].points.length,5);assert.deepEqual(s.plots[g].points[2],original.plots[g].points[3]); assert.equal(s.plots[g].fitAttempted,false); }
s=record(s,1,6,2); assert.equal(s.plots[1].points[5],null);assert.equal(s.plots[2].points[5],null);
const sibling=M.clone(s.plots[2]); s=M.change(s,{type:"clearGraph",graph:1}); assert.deepEqual(s.plots[2],sibling); assert.equal(s.groups[1].records.length,6);
s=M.change(s,{type:"clearGroup",group:1}); assert.deepEqual(s.plots[0],independent); assert.equal(s.plots[2].points.length,0);assert.deepEqual(s.conclusions,original.conclusions);
assert.deepEqual(M.change(s,{type:"clearAll"}),M.fresh());
console.log("newton model: all 42 physical settings, measured slopes, locks, candidates, limits and dependent graph operations passed");
