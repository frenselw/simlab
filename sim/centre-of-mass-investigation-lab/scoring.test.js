"use strict";
const assert=require("node:assert/strict"),G=require("./generator.js"),P=require("./persistence.js"),S=require("./scoring.js");
function complete(seed=3){let s=P.initial(seed),p=G.generate(seed);s=P.release(s,p.part1.xCm);s=P.markPart1(s,p.part1.xCm);s=P.switchPart(s,2);for(const key of ["h1","h2"]){s=P.settleHole(s,key);s=P.traceVertical(s);s=P.detachActiveHole(s);}s=P.markPart2(s,p.part2.centre);s=P.switchPart(s,3);s=P.setView(s,{yaw10:650,pitch10:-180});s=P.setView(s,{yaw10:1100,pitch10:220});s=P.selectPart3(s,p.part3.correctKey);return P.enterCheck(s);}
let s=complete(),r=S.score(s);assert.equal(r.score,100);assert.equal(r.detail.reduce((sum,x)=>sum+x.max,0),100);
assert.equal(r.detail.find(x=>x.key==="p1-mark").label,"平衡後揭示一維重心");
const p=G.generate(s.seed);for(const [error,expected] of [[.02,15],[.035,10],[.05,5],[.05001,0]]){const x=structuredClone(s);x.part1.markX=p.part1.xCm+error;assert.ok(Math.abs(S.score(x).detail.find(i=>i.key==="p1-mark").points-expected)<1e-9);}
const injected=P.initial(3);injected.part1.markX=p.part1.xCm;injected.part2.mark=p.part2.centre;injected.part3.selectedCandidateKey=p.part3.correctKey;assert.equal(S.score(injected).score,0,"answers without evidence score zero");
let tentative=P.switchPart(P.initial(3),3);tentative=P.selectPart3(tentative,p.part3.correctKey);assert.equal(P.validate(tentative),true);assert.equal(S.score(tentative).detail.find(i=>i.key==="p3-select").points,0,"tentative candidate without observations scores zero");
const wrong=structuredClone(s);wrong.part3.selectedCandidateKey=G.LABELS.find(k=>k!==p.part3.correctKey);assert.equal(S.score(wrong).detail.find(i=>i.key==="p3-select").points,0);
const forged=structuredClone(s);forged.correct=true;forged.score=100;forged.part2.lines.forEach(line=>line.valid=true);assert.equal(S.score(forged).score,100,"derived flags are ignored");
const intersection=S.evidence(s,p).intersection;for(const factor of [.08,.0800001]){const x=structuredClone(s);x.part2.mark={x:intersection.x+factor*p.part2.size,y:intersection.y};const points=S.score(x).detail.find(i=>i.key==="p2-intersection").points;assert.ok(points>=0&&points<=10,`intersection partial is clamped at ${factor}`);if(factor===.08)assert.ok(points<1e-9);}
console.log("Centre-of-mass scoring checks passed");
