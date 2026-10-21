"use strict";
const assert=require("node:assert/strict");
const M=require("./model.js"),S=require("./scoring.js"),P=require("./persistence.js");
let state=P.initial(()=>0);
assert.equal(S.scoreAttempt(state).score,0);
state.cases.coaxial.answers.speedRelation="lt";
assert.equal(S.scoreAttempt(state).score,5,"concept credit does not require measurement");
for(const kind of M.CASES){
  let c=state.cases[kind];c.phase="unwrapped";c.measurement={startAngles:[0,0],elapsed:10};
  const r=M.readings(kind,c.definition,10);
  for(const key of S.NUMERIC)c.answers[key]=String(r[key]);
  Object.assign(c.answers,S.CORRECT[kind]);
}
assert.equal(S.scoreAttempt(state).score,100);
state.cases.belt.answers.vA="oops";
assert.equal(S.scoreAttempt(state).score,92);
assert.equal(S.parseNumeric("1.25e-2"),.0125);
for(const bad of ["-1","NaN","Infinity","1 m/s","1,2",".",""])assert.equal(S.parseNumeric(bad),null);
assert.ok(S.matches("0.12549",.125));
assert.ok(!S.matches("0.12551",.125));
assert.ok(S.matches("0.1245",.125));
assert.ok(!S.matches("0.12449",.125));
console.log("Circular speed scoring: independent partial credit and display tolerance passed");
