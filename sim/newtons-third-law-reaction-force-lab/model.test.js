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
  const original=q.expected[0],end=M.endpoint(original,q,l),resolved=M.fromPoint(original,q,l,end,"touch");assert.ok(M.angleDelta(resolved.record[3]/10,original[3]/10)<=.1);assert.equal(resolved.record[4],Math.round(M.snapForce(original[4]/100)*100));
  // Every correct magnitude remains reachable within the unchanged 10% rubric,
  // approaching slowly from either direction through the hysteresis band.
  for(const expected of q.expected)for(const direction of [-1,1]){
   assert.equal(M.fromPoint(expected,q,l,M.endpoint(expected,q,l),"touch").record[4],expected[4],"every v2 given value can be drawn exactly at every viewport");
   const force=expected[4]/100;let previous=null;
   for(let offset=2;offset>=0;offset-=.01)previous=M.snapForce(force+direction*offset,previous);
   previous=M.snapForce(force,previous);
   assert.ok(Math.abs(previous-force)<=force*.1,`${q.code} ${force} N remains creditable from ${direction}`);
  }
 }
}
assert.equal(M.snap(179,[0,180],"touch").angle,180);assert.equal(M.snap(1,[0,180],"touch").angle,0);
assert.equal(M.snapForce(17.9),18);assert.equal(M.snapForce(18.15),18);
for(const f of [17.45,17.9,18.15,18.6,17.5])assert.equal(M.snapForce(f,18),18,"18 N survives natural jitter across the nearest-tick boundary");
assert.equal(M.snapForce(18.69,18),19);assert.equal(M.snapForce(17.31,18),17);
assert.equal(M.snapForce(8.15),8);assert.equal(M.snapForce(8.4),8.5);
assert.equal(M.snapForce(9.67,10),10);assert.equal(M.snapForce(9.65,10),9.5);
assert.equal(M.snapForce(10.67,10),10);assert.equal(M.snapForce(10.69,10),11);
assert.equal(M.snapForce(.01),.5);
for(const mirror of [false,true]){
 const scene=G.build(1,{mirror,mass:3,acceleration:6}),frozen=M.clone(scene),sign=mirror?1:-1;
 const start=M.backgroundMotion(scene,0),mid=M.backgroundMotion(scene,2),limit=M.backgroundMotion(scene,4),late=M.backgroundMotion(scene,3600);
 assert.equal(start.speed,6);assert.ok(mid.speed>start.speed);assert.equal(limit.speed,46);assert.equal(late.speed,46);assert.equal(Math.sign(mid.x),sign);assert.equal(mid.y,0);
 for(const time of [1,3,4,5,60]){const a=M.backgroundMotion(scene,time),b=M.backgroundMotion(scene,time+.0001);assert.ok(Math.abs(Math.abs(b.x-a.x)/.0001-a.speed)<.001,"continuous displacement matches bounded speed");}
 // Frame rate does not determine visual speed; geometry/physics remain immutable.
 for(const fps of [30,60,120]){let elapsed=0;for(let n=0;n<fps*6;n++)elapsed+=1/fps;assert.ok(Math.abs(M.backgroundMotion(scene,elapsed).x-M.backgroundMotion(scene,6).x)<1e-8);}
 assert.deepEqual(scene,frozen);
 const incline=G.build(0,{mirror,theta:30,W:15}),motion=M.backgroundMotion(incline,2);assert.equal(motion.speed,12);assert.equal(Math.sign(motion.x),-sign);assert.ok(motion.y<0);
}
for(const family of [2,3,4])assert.equal(M.backgroundMotion(G.generate(21).questions[family],2),null,"instantaneous release/swing/gravity snapshots are not animated as constant acceleration");
const q=G.generate(21).questions[0];for(const r of [[null,0,null,null,null],[0,null,null,0,100],[0,0,9,null,null],[0,0,null,null,100],[0,0,null,NaN,100],[0,0,null,100,Infinity],[9,0,0,0,100]])assert.equal(M.validRecord(r,q),false);
console.log("Reaction model: all body/anchor alternatives, dependencies, force-grid hysteresis, bounded background motion, undo and direction-independent force scale passed.");
