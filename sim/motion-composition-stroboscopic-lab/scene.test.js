"use strict";
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),Scene=require('./scene.js');
const s=P.fresh(),l=M.layout(390,252);assert.ok(!Scene.svg(s,0,1,l).includes('#166534'));
s.cases[0].observed=true;s.cases[0].points[0]=[800,-800];s.cases[0].points[2]=[2400,-2400];const html=Scene.svg(s,0,1,l);
assert.equal((html.match(/opacity=".4"/g)||[]).length,1,'no connection across unanswered time slots');assert.ok(!html.includes('勻速'));
for(let index=0;index<4;index++){const svg=Scene.svg(s,index,4,l,{reference:true});assert.ok(svg.includes('#166534'));assert.ok(svg.includes('scene-plot'));}
const preview=Scene.svg(s,0,1,l,{working:[600,-200],prefix:'preview'});assert.ok(preview.includes('preview-plot'));assert.ok(!preview.includes('scene-plot'));
console.log('motion composition scene: no premature answer curve, no interpolation over missing slots and distinct preview IDs passed');
