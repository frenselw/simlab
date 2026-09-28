"use strict";
const assert=require("node:assert/strict"),G=require("./generator.js"),M=require("./model.js"),P=require("./persistence.js"),S=require("./scoring.js");
for(let seed=0;seed<120;seed++){
 const s=P.fresh(seed),qs=G.generate(seed).questions;assert.equal(S.score(s).score,0);s.answers=qs.map(q=>M.clone(q.expected));assert.equal(S.score(s).score,100);
 for(let i=0;i<5;i++)s.answers[i]=qs[i].expected.map(r=>[0,0,r[2],r[3],r[4]]);assert.equal(S.score(s).score,50);assert.equal(S.score(s).passed,false);
 s.answers=qs.map(q=>q.expected.map(r=>[null,null,r[2],null,null]));assert.equal(S.score(s).score,10);
 s.answers=qs.map(q=>q.expected.map(r=>[r[0],null,null,null,null]));assert.equal(S.score(s).score,45);
 s.answers=qs.map(q=>q.expected.map(r=>[r[0],r[1],r[2],null,null]));assert.equal(S.score(s).score,55);
}
const q=G.build(4,{angle:75,W:10}),e=q.expected[0];
for(const [delta,expected] of [[100,true],[101,false],[-100,true],[-101,false]]){const r=e.slice();r[3]=(r[3]+3600+delta)%3600;assert.equal(S.questionScore([r],q).detail[0].direction,expected);}
for(const [force,expected] of [[900,true],[1100,true],[899,false],[1101,false]]){const r=e.slice();r[4]=force;assert.equal(S.questionScore([r],q).detail[0].magnitude,expected);}
const opposite=e.slice();opposite[3]=(opposite[3]+1800)%3600;const r=S.questionScore([opposite],q).detail[0];assert.equal(r.placement,true);assert.equal(r.direction,false);
console.log("Reaction scoring: empty/partial work, all-wrong recipients below pass, independent components and tolerance boundaries passed.");
