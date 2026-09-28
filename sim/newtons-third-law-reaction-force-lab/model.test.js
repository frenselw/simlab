"use strict";
const assert=require("node:assert/strict"),G=require("./generator.js"),M=require("./model.js");
for(let family=0;family<5;family++)for(const params of G.parameterSets(family)){
 const q=G.build(family,params);let a=q.targets.map(M.blank);
 for(const b of q.bodies)for(const anchor of b.anchors){const r=[b.id,anchor.id,null,100,100];assert.ok(M.validRecord(r,q));}
 a=M.change(a,{type:"kind",index:0,kind:4},q);assert.deepEqual(a[0],[null,null,4,null,null]);
 a=M.change(a,{type:"body",index:0,body:0},q);a=M.change(a,{type:"anchor",index:0,anchor:0},q);a=M.change(a,{type:"place",index:0,angle:720.12,force:3.21},q);assert.deepEqual(a[0],[0,0,4,1,321]);
 const prev=M.clone(a);a=M.change(a,{type:"body",index:0,body:1},q);assert.deepEqual(a[0],[1,null,4,null,null]);assert.deepEqual(prev[0],[0,0,4,1,321]);
 const h=new M.History();h.record(family,prev);assert.deepEqual(h.apply(family,a),prev);assert.deepEqual(h.apply(family,prev,true),a);
 for(const [w,height] of [[320,200],[390,229],[390,276],[860,720]]){
  const l=M.layout(w,height,q),r=q.expected[0];
  for(const answer of q.expected)assert.equal(M.handle(M.endpoint(answer,q,l),l).offscale,false,`correct arrow fully editable at ${w}x${height}: ${q.family} ${JSON.stringify(q.params)}`);
  for(const angle of [0,35,90,180,270]){const v=[r[0],r[1],r[2],angle*10,r[4]],start=M.pixel(M.origin(v,q),l),end=M.endpoint(v,q,l),distance=Math.hypot(end.x-start.x,end.y-start.y);assert.ok(Math.abs(distance-r[4]/100*l.forceScale*l.unit)<1e-9);}
  const original=q.expected[0],end=M.endpoint(original,q,l),resolved=M.fromPoint(original,q,l,end,"touch");assert.ok(M.angleDelta(resolved.record[3]/10,original[3]/10)<=.1);assert.ok(Math.abs(resolved.record[4]-original[4])<=5);
 }
}
assert.equal(M.snap(179,[0,180],"touch").angle,180);assert.equal(M.snap(1,[0,180],"touch").angle,0);
const q=G.generate(21).questions[0];for(const r of [[null,0,null,null,null],[0,null,null,0,100],[0,0,9,null,null],[0,0,null,null,100],[0,0,null,NaN,100],[0,0,null,100,Infinity],[9,0,0,0,100]])assert.equal(M.validRecord(r,q),false);
console.log("Reaction model: all body/anchor alternatives, dependencies, snap, undo and direction-independent force scale passed.");
