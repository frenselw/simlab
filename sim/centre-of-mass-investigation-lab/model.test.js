"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js"), M = require("./model.js");
const p=G.generate(7);
assert.equal(M.supportOutcome(p.part1.xCm+.017999,p.part1.xCm),"balanced");
assert.notEqual(M.supportOutcome(p.part1.xCm+.018001,p.part1.xCm),"balanced");
assert.equal(M.supportOutcome(p.part1.xCm-.03,p.part1.xCm),"right-fall");
assert.equal(M.supportOutcome(p.part1.xCm+.03,p.part1.xCm),"left-fall");
const pose={x:2,y:-1,angle:.73}, point={x:.2,y:-.35}; const world=M.transform(point,pose), back=M.inverseTransform(world,pose);assert.ok(Math.hypot(back.x-point.x,back.y-point.y)<1e-12);
for(let seed=0;seed<32;seed+=1){const problem=G.generate(seed);for(const hole of problem.part2.holes){const swing=M.createSwing(problem.part2,hole,0);assert.equal(swing.inertia,swing.inertiaCm+swing.mass*swing.distance*swing.distance,"parallel-axis theorem Ip = Icm + M d^2");assert.ok(swing.damping>0&&Number.isFinite(swing.damping));let time=0;while(time<4&&!M.stepSwing(swing,1/60))time+=1/60;assert.ok(time>=1.5&&time<=3,`seed ${seed} ${hole.key} settles visibly in 1.5–3.0 s: ${time}`);assert.ok(Math.abs(swing.angle-swing.target)<1e-12);const pivot=M.transform(hole,{x:0,y:0,angle:swing.target}),com=M.transform(problem.part2.centre,{x:0,y:0,angle:swing.target});assert.ok(Math.abs(com.x-pivot.x)<1e-12&&com.y>pivot.y,"analytic equilibrium puts COM vertically below pivot");}}
function advanceWithFrames(swing,frames,total=1){let elapsed=0,index=0;while(elapsed<total-1e-12){const dt=Math.min(frames[index%frames.length],total-elapsed);M.stepSwing(swing,dt);elapsed+=dt;index+=1;}return swing;}
function comparisonSwing(){return {angle:1,omega:0,target:-.35,distance:.7,inertia:1.4,damping:.85,settledFor:0,accumulator:0};}
const reference=advanceWithFrames(comparisonSwing(),[1/120]);
for(const hz of [60,90,120,144,165]){
  const actual=advanceWithFrames(comparisonSwing(),[1/hz]);
  assert.ok(Math.abs(actual.angle-reference.angle)<1e-12&&Math.abs(actual.omega-reference.omega)<1e-12,`${hz} Hz preserves the same 120 Hz fixed-step result`);
  assert.ok(actual.accumulator>=0&&actual.accumulator<1/120,"sub-frame remainder stays bounded");
}
const jittered=advanceWithFrames(comparisonSwing(),[1/144,1/90,1/165,1/72,1/120]);
assert.ok(Math.abs(jittered.angle-reference.angle)<1e-12&&Math.abs(jittered.omega-reference.omega)<1e-12,"irregular frame intervals preserve elapsed simulation time");
function settleTime(swing,limit=5){for(let frame=1;frame<=limit*60;frame+=1)if(M.stepSwing(swing,1/60))return frame/60;return Infinity;}
let slowestReachable={time:0};
for(let seed=0;seed<32;seed+=1){
  const problem=G.generate(seed).part2;
  for(const hole of problem.holes){
    const target=M.equilibriumAngle(hole,problem.centre);
    for(let degrees=-180;degrees<=180;degrees+=5){
      const swing=M.createSwing(problem,hole,target+degrees*Math.PI/180),time=settleTime(swing);
      if(time>slowestReachable.time)slowestReachable={time,seed,hole:hole.key,degrees};
      assert.ok(time<=4.3,`reachable angle settles within 4.3 s: ${JSON.stringify({time,seed,hole:hole.key,degrees})}`);
      assert.equal(swing.angle,target,"settled swing snaps to the canonical target");
    }
    for(const side of [-1,1])for(const distanceFromInverted of [0,M.INVERTED_ESCAPE/2,M.INVERTED_ESCAPE*1.01]){
      const initial=target+side*(Math.PI-distanceFromInverted),swing=M.createSwing(problem,hole,initial);
      assert.equal(swing.target,target,"unstable escape does not change the canonical target");
      if(distanceFromInverted<M.INVERTED_ESCAPE)assert.ok(Math.abs(Math.abs(M.angularDifference(swing.angle,target))-(Math.PI-M.INVERTED_ESCAPE))<1e-12,"exact and near-inverted starts receive the deterministic 3 degree perturbation");
      const before=swing.angle;M.stepSwing(swing,1/60);
      assert.notEqual(swing.angle,before,"inverted and near-inverted starts visibly begin falling");
      assert.ok(settleTime(swing)<=4.3,"inverted and near-inverted starts settle within the bounded exception");
    }
  }
}
assert.ok(slowestReachable.time>4&&slowestReachable.time<=4.3,`matrix exercises the inverted escape bound: ${JSON.stringify(slowestReachable)}`);
const h=p.part2.holes[0],c=p.part2.centre,s=p.part2.size,dx=c.x-h.x,dy=c.y-h.y,d=Math.hypot(dx,dy),u=[dx/d,dy/d];
const line=(offset,length)=>({holeKey:h.key,a:[h.x-u[1]*offset-u[0]*length/2,h.y+u[0]*offset-u[1]*length/2],b:[h.x-u[1]*offset+u[0]*length/2,h.y+u[0]*offset+u[1]*length/2]});
assert.equal(M.lineValid(line(.0249*s,.4501*s),h,c,s),true);assert.equal(M.lineValid(line(.0251*s,.4501*s),h,c,s),false);assert.equal(M.lineValid(line(0,.4499*s),h,c,s),false);
const syntheticHole={key:"h",x:0,y:0},syntheticCentre={x:0,y:1};
assert.equal(M.lineRecordable({holeKey:"h",a:[0,0],b:[0,1.5]},syntheticHole,syntheticCentre,1),true,"recordable endpoint accepts the exact coordinate bound");
assert.equal(M.lineRecordable({holeKey:"h",a:[0,0],b:[0,1.500001]},syntheticHole,syntheticCentre,1),false,"recordable endpoint rejects beyond the coordinate bound");
assert.equal(M.lineRecordable({holeKey:"h",a:[0,0],b:[.5,.5]},syntheticHole,syntheticCentre,1),true,"a finite downward slanted line is structurally recordable");
assert.equal(M.lineValid({holeKey:"h",a:[0,0],b:[.5,.5]},syntheticHole,syntheticCentre,1),false,"recordable does not widen strict scoring validity");
for(const invalid of [
  {holeKey:"h",a:[0,0],b:[0,-.6]},
  {holeKey:"h",a:[0,0],b:[0,.4499]},
  {holeKey:"h",a:[0,0],b:[0,NaN]},
  {holeKey:"h",a:[0,0],b:[0,.6],extra:true}
])assert.equal(M.lineRecordable(invalid,syntheticHole,syntheticCentre,1),false,"upward, short, nonfinite and noncanonical shapes are rejected");
const lines=p.part2.holes.slice(0,3).map(hole=>({a:[hole.x,hole.y],b:[c.x,c.y]})),intersection=M.leastSquares(lines);assert.ok(Math.hypot(intersection.x-c.x,intersection.y-c.y)<1e-10);assert.equal(M.leastSquares([line(0,s),line(.01,s)]),null);
for(const count of [2,3,4]){const fan=Array.from({length:count},(_,i)=>({a:[0,0],b:[1,i+1]}));assert.equal(M.pairwiseIntersections(fan).length,count*(count-1)/2,`${count} lines expose every finite pairwise intersection`);}
assert.deepEqual(M.canonicalView({yaw10:1800,pitch10:900}),{yaw10:-1800,pitch10:800});assert.ok(Number.isFinite(M.project([1,2,3],{yaw10:0,pitch10:0}).depth));
console.log("Centre-of-mass model checks passed");
