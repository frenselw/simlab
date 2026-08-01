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
const h=p.part2.holes[0],c=p.part2.centre,s=p.part2.size,dx=c.x-h.x,dy=c.y-h.y,d=Math.hypot(dx,dy),u=[dx/d,dy/d];
const line=(offset,length)=>({holeKey:h.key,a:[h.x-u[1]*offset-u[0]*length/2,h.y+u[0]*offset-u[1]*length/2],b:[h.x-u[1]*offset+u[0]*length/2,h.y+u[0]*offset+u[1]*length/2]});
assert.equal(M.lineValid(line(.0249*s,.4501*s),h,c,s),true);assert.equal(M.lineValid(line(.0251*s,.4501*s),h,c,s),false);assert.equal(M.lineValid(line(0,.4499*s),h,c,s),false);
const lines=p.part2.holes.slice(0,3).map(hole=>({a:[hole.x,hole.y],b:[c.x,c.y]})),intersection=M.leastSquares(lines);assert.ok(Math.hypot(intersection.x-c.x,intersection.y-c.y)<1e-10);assert.equal(M.leastSquares([line(0,s),line(.01,s)]),null);
assert.deepEqual(M.canonicalView({yaw10:1800,pitch10:900}),{yaw10:-1800,pitch10:800});assert.ok(Number.isFinite(M.project([1,2,3],{yaw10:0,pitch10:0}).depth));
console.log("Centre-of-mass model checks passed");
