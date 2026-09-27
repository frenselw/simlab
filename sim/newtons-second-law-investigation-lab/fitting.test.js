"use strict";
const assert=require("node:assert/strict"), F=require("./fitting.js");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ~ ${b}`);
for (const [model,c,xs] of [["linear",[2.5,.3],[.2,.4,.8,1]], ["origin",[1.75],[.1,.5,1.2]], ["quadratic",[.2,-.4,1],[.1,.3,.7,1.5]], ["inverse",[.6],[.5,.75,1,1.25,2]]]) {
  const points=xs.map(x=>[x,F.predict(model,c,x)]), fit=F.fit(model,points);
  assert.ok(fit.ok); fit.coefficients.forEach((v,i)=>close(v,c[i]));close(fit.rmse,0);
  close(F.fit(model,points.reverse()).rmse,0);
}
close(F.fit("origin",[[1,3],[2,3]]).coefficients[0],1.8);
close(F.fit("inverse",[[1,4],[2,4]]).coefficients[0],4.8);
const wrong=F.fit("linear",[[0,1],[1,2],[2,9]]); close(wrong.coefficients[0],4);close(wrong.coefficients[1],0); close(wrong.rmse,Math.sqrt(2));
assert.equal(F.fit("linear",[[0,2],[1,2],[2,2]]).ok,true,"horizontal lines are legitimate learner fits");
close(F.fit("quadratic",[[0,1],[1,3],[2,5]]).coefficients[0],0);
for (const [model,points] of [[null,[]],["linear",[null,[1,1]]],["origin",[[0,1],[0,2]]],["quadratic",[[1,1],[2,2]]],["quadratic",[[1,1],[1,2],[2,2]]],["inverse",[[0,1],[1,2]]],["inverse",[[-1,1],[1,2]]],["linear",[[NaN,0],[1,1]]],["linear",[[1,Infinity],[2,1]]]]) assert.equal(F.fit(model,points).ok,false);
assert.equal(F.fit("quadratic",[[0,1],[1e-14,1],[1,2]]).ok,false,"near rank deficiency is reported, not silently dropped");
assert.equal(F.fit("quadratic",[[1,1],[1.0001,1.2],[1.0002,1.4]]).ok,true,"legal close encoded points are numerically solvable");
assert.equal(F.fit("inverse",[[.5,1.2],null,[1,.6]]).n,2);
console.log("newton fitting: known least-squares solutions, wrong points, missing points, domain and rank checks passed");
