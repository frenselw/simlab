"use strict";
const assert=require("node:assert/strict");
const M=require("./model.js");
for(const kind of M.CASES)for(let radiusIndex=0;radiusIndex<3;radiusIndex++)for(let ratioIndex=0;ratioIndex<2;ratioIndex++)for(let speedIndex=0;speedIndex<4;speedIndex++){
  const d={radiusIndex,ratioIndex,speedIndex},p=M.parameters(kind,d);
  assert.ok(p.rA<p.rB && p.omegaA>0 && p.omegaB>0);
  if(kind==="coaxial"){assert.equal(p.omegaA,p.omegaB);assert.ok(p.vA<p.vB);}
  else{assert.ok(Math.abs(p.vA-p.vB)<1e-12);assert.ok(p.omegaA>p.omegaB);}
  for(const elapsed of [.001,2,30,100]){
    const r=M.readings(kind,d,elapsed);
    assert.ok(r.sA>0&&r.sB>0&&r.angleA>0&&r.angleB>0);
    assert.equal(r.vA,M.displayedNumber(r.sA/r.dt));
    assert.equal(r.omegaB,M.displayedNumber(r.angleB/r.dt));
    if(kind==="coaxial")assert.equal(r.angleA,r.angleB);
    else assert.equal(r.sA,r.sB);
  }
  const g=M.beltTangents(p.rA,p.rB,p.centreDistance);
  for(const [a,b] of [[g.upperA,g.upperB],[g.lowerA,g.lowerB]]){
    const vector=[b[0]-a[0],b[1]-a[1]];
    assert.ok(Math.abs(a[0]*vector[0]+a[1]*vector[1])<1e-10);
    assert.ok(Math.abs((b[0]-p.centreDistance)*vector[0]+b[1]*vector[1])<1e-10);
  }
}
const d={radiusIndex:0,ratioIndex:1,speedIndex:3};
const r=M.readings("belt",d,100);
assert.ok(r.turnsA>1&&r.angleA>2*Math.PI&&r.sA>2*Math.PI*.1);
assert.equal(M.readings("belt",d,0),null);
assert.equal(M.readings("belt",d,M.MAX_TIME+1),null);
console.log("Circular speed model: 48 combinations and multi-turn readings passed");
