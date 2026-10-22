"use strict";
const assert = require("node:assert/strict"), M = require("./model.js"), S = require("./scoring.js");
const s = M.fresh(1); assert.equal(S.score(s).score, 0);
s.tasks[0].inquiry = ["equal-mass", "ratio-steady"]; s.tasks[0].law = "linear";
assert.equal(S.score(s).detail.pages[0].score, 12, "concept credit is independent of data");
assert.equal(M.begin(s.tasks[0]), true); const run = s.tasks[0].runs[0]; run.cfg = [4, 2, 2, 2];
for (const q of [500, 1250, 2250, 3500]) assert.equal(M.record(s.tasks[0], q / 1000), true);
assert.equal(M.fitCurrent("radius", s.tasks[0]).ok, true);
run.a = ["1.5", "supports", "coefficient"];
assert.equal(S.score(s).detail.pages[0].score, 30);
assert.equal(S.near("1.47", 1.5), true); assert.equal(S.near("1.469", 1.5), false);
assert.equal(S.near("1.53", 1.5), true); assert.equal(S.near("1.531", 1.5), false);
run.cfg = [4, 2, 2, 4]; run.fit = true; run.a[1] = "confounded"; run.a[2] = "uncertain";
assert.equal(S.comparison("radius", run), "confounded");
assert.equal(S.page(s, 0).fitScore, 6, "correct recognition of confounding keeps interpretation credit");
const omega = s.tasks[2]; M.begin(omega); for (const q of [500, 1500, 3000]) M.record(omega, q / 1000);
assert.equal(M.fitCurrent("omega", omega).ok, true); omega.roles = ["omega", ["m", "r"]]; omega.law = "square";
omega.runs[0].a = ["4", "square", "coefficient"];
assert.equal(S.page(s, 2).score, 30);
s.sync = "same-omega"; s.massParts = "cap-screw-weights";
assert.equal(S.score(s).detail.syncScore + S.score(s).detail.massPartsScore, 10);
console.log("centripetal scoring ok");

const inquiry=M.fresh(99);inquiry.tasks[0].inquiry=["equal-mass",null];
assert.equal(S.page(inquiry,0).roleScore,3);
inquiry.tasks[0].inquiry=["equal-radius","ratio-steady"];
assert.equal(S.page(inquiry,0).roleScore,3);
inquiry.tasks[1].inquiry=["equal-radius","ratio-steady"];
assert.equal(S.page(inquiry,1).roleScore,6);


// Storage capacity is not a scoring target.
for (const kind of M.KINDS) {
  const run=M.freshRun(M.CFG);
  run.q=[500,1000,1500];
  assert.deepEqual(S.coverage(kind,run),{slots:3,span:1,dataScore:4});
  run.q=Array.from({length:48},(_,i)=>250+i*120);
  assert.equal(S.coverage(kind,run).dataScore,4,"48 points earn no more data credit than three well-spaced points");
  run.q=Array.from({length:48},(_,i)=>1000+i);
  assert.equal(S.coverage(kind,run).dataScore,0,"many tightly clustered points do not meet the coverage requirement");
  run.q=[500,750,999];assert.equal(S.coverage(kind,run).dataScore,0);
  run.q=[500,750,1000];assert.equal(S.coverage(kind,run).dataScore,2);
  run.q=[500,1000,1499];assert.equal(S.coverage(kind,run).dataScore,2);
  run.q=[-1000,-500,500];
  assert.equal(S.coverage(kind,run).dataScore,kind==="omega"?4:2,"radius/mass count magnitude; omega retains sign");
}
