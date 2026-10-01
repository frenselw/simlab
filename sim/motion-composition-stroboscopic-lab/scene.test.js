"use strict";
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),Scene=require('./scene.js');
const s=P.fresh(),l=M.layout(390,252);assert.ok(!Scene.svg(s,0,1,l).includes('stroke="#166534"'));
s.cases[0].observed=true;s.cases[0].points[0]=[800,-800];s.cases[0].points[2]=[2400,-2400];const html=Scene.svg(s,0,1,l);
assert.ok(!html.includes('opacity=".4"'),'student positions have no connecting lines');assert.ok(!html.includes('勻速'));
assert.ok(!Scene.svg(s,0,1,l,{guides:true,animation:.4}).includes('data-composition-guides'),'partial placement does not reveal the intersection');
for(let index=0;index<4;index++){
  s.cases[index].observed=true;s.cases[index].points=M.expected(index);
  assert.ok(!Scene.svg(s,index,4,l).includes('opacity=".4"'),'complete placement still has no connecting lines');
  assert.ok(!Scene.svg(s,index,4,l,{guides:true}).includes('data-composition-guides'),'guides require component playback');
  for(const time of [.2,.4,.6,.8]){
    const rendered=Scene.svg(s,index,4,l,{guides:true,animation:time});
    const lines=[...rendered.matchAll(/<line data-guide-axis="([xy])" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)];
    assert.equal(lines.length,2);
    const origin=M.pixel([0,0],l),intersection=M.pixel(M.position(index,time),l);
    assert.deepEqual(lines.map(m=>m.slice(1,2).concat(m.slice(2).map(Number))),[
      ['x',intersection.x,origin.y,intersection.x,intersection.y],
      ['y',origin.x,intersection.y,intersection.x,intersection.y]
    ],'perpendicular lines start at the two components and meet at the same-time resultant');
  }
}
for(let index=0;index<4;index++){const svg=Scene.svg(s,index,4,l,{reference:true});assert.ok(svg.includes('#166534'));assert.ok(svg.includes('scene-plot'));}
const preview=Scene.svg(s,0,1,l,{working:[600,-200],prefix:'preview'});assert.ok(preview.includes('preview-plot'));assert.ok(!preview.includes('scene-plot'));
for(let count=0;count<=4;count++){
  const capture=Scene.svg(s,0,1,l,{stamps:count,animation:count*M.DT});
  assert.equal((capture.match(/data-stamp=/g)||[]).length,count*2,'two simultaneous projections per exposure');
  assert.equal((capture.match(/data-live-ball=/g)||[]).length,2);
  assert.ok(capture.includes('fill="url(#scene-x-ball)"')&&capture.includes('fill="url(#scene-y-ball)"'));
}
assert.ok(preview.includes('preview-answer-ball')&&!preview.includes('scene-answer-ball'));
console.log('motion composition scene: unconnected student balls, gated perpendicular guides for all four models and distinct preview IDs passed');
