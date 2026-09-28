"use strict";
const assert=require("node:assert/strict"),G=require("./generator.js"),M=require("./model.js"),N=require("./notation.js"),S=require("./scoring.js"),F=require("./feedback.js");
const explain=(q,i,r)=>{const answer=M.clone(q.expected);answer[i]=r;return F.explanations(q,i,r,S.questionScore(answer,q).detail[i]).join(" ");};
for(const version of [1,2])for(let family=0;family<5;family++)for(const p of G.parameterSets(family)){
 const q=G.build(family,p,version),before=JSON.stringify(q),description=N.sceneDescription(q);
 assert.match(description,/水平向右.*逆時針/);assert.ok(!description.includes("undefined"));
 for(const f of q.given){assert.ok(description.includes(`${N.value(f.force100/100)}牛頓`));assert.ok(description.includes(`${N.value(f.angle10/10)}度`));}
 for(const [i,r]of q.expected.entries()){
  assert.equal(explain(q,i,r),"");assert.match(explain(q,i,M.blank()),/尚未選受力物體.*尚未畫出箭頭.*大小應相等.*尚未標明/s);
  const wrongBody=[0,...r.slice(1)];assert.match(explain(q,i,wrongBody),/不同物體/);
  const reverse=[...r];reverse[3]=(r[3]+1800)%3600;assert.match(explain(q,i,reverse),/方向相反/);
  const larger=[...r];larger[4]=r[4]*2;assert.match(explain(q,i,larger),/大小應相等.*你畫的是/);
 }
 assert.equal(JSON.stringify(q),before,"descriptions and explanations cannot change questions");
}
const pendulum=G.build(3,{theta:30,W:15,moving:true,chi:1});assert.match(N.sceneDescription(pendulum),/右下方/);assert.match(N.sceneDescription(pendulum),/向左上方，120度/);
assert.match(explain(pendulum,0,[2,0,2,3000,2800]),/固定架受到的是繩的拉力/);
const earth=G.build(4,{angle:135,W:12});assert.match(N.sceneDescription(earth),/左上方/);assert.match(N.sceneDescription(earth),/向右下方，315度/);
for(const family of [1,2]){
 const q=G.generate(21).questions[family],i=q.targets.indexOf("normal"),r=[...q.expected[i]];r[2]=4;assert.match(explain(q,i,r),/壓力.*並非萬有引力/);
 r[2]=0;r[1]=0;assert.match(explain(q,i,r),/接觸的位置/);
}
console.log("Reaction explanations: known directions, spatial descriptions, blank/partial work and misconception-specific submitted feedback passed.");
