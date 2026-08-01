"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");
const seenSides = new Set(), seenCorrect = new Set(), seenSolids = new Set();
for (let seed = 0; seed < 200; seed += 1) {
  const a = G.generate(seed), b = G.generate(seed);
  assert.deepEqual(a, b, "version and seed rebuild exactly");
  assert.ok(a.part1.masses.every((item) => item.m > 0));
  assert.ok(a.part1.xCm >= .18 && a.part1.xCm <= .82 && Math.abs(a.part1.xCm - .5) >= .08);
  seenSides.add(Math.sign(a.part1.xCm - .5));
  assert.equal(a.part2.size, Math.round(Math.sqrt(G.polygonArea(a.part2.polygon)) * 10000) / 10000, "S is exactly quantized sqrt(A)");
  assert.ok(a.part2.holes.length >= 3 && a.part2.holes.length <= 5);
  assert.ok(a.part2.holes.every((hole) => Math.hypot(hole.x-a.part2.centre.x,hole.y-a.part2.centre.y) >= .18*a.part2.size));
  assert.ok(a.part2.holes.some((h,i)=>a.part2.holes.slice(i+1).some((k)=>{
    const l1={a:[h.x,h.y],b:[a.part2.centre.x,a.part2.centre.y]},l2={a:[k.x,k.y],b:[a.part2.centre.x,a.part2.centre.y]};const angle=M.acuteLineAngle(l1,l2);return angle>=45&&angle<=135;
  })));
  const correct = a.part3.candidates.find((item)=>item.key===a.part3.correctKey);
  assert.deepEqual(correct.position,[0,0,0]); seenCorrect.add(a.part3.correctKey); seenSolids.add(a.part3.type);
  for (const item of a.part3.candidates) {
    if (a.part3.type === "sphere") assert.ok(Math.hypot(...item.position) <= .82*a.part3.axes[0]);
    else item.position.forEach((value,index)=>assert.ok(Math.abs(value) <= .88*a.part3.axes[index]));
  }
}
assert.deepEqual([...seenSides].sort(),[-1,1]); assert.equal(seenCorrect.size,5); assert.equal(seenSolids.size,3);
assert.throws(()=>G.generate(1,2));
console.log("Centre-of-mass generator checks passed");
