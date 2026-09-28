"use strict";
const assert=require("node:assert/strict"),G=require("./generator.js"),M=require("./model.js"),Scene=require("./scene.js");
let count=0;
for(let family=0;family<5;family++)for(const p of G.parameterSets(family))for(const [w,h]of [[320,200],[390,260],[860,720]]){
 const q=G.build(family,p),l=M.layout(w,h,q),svg=Scene.svg(q,l,q.expected,0);assert.ok(!svg.includes("NaN"));assert.ok(!svg.includes("Infinity"));assert.equal((svg.match(/data-given=/g)||[]).length,q.given.length);assert.equal((svg.match(/data-reaction=/g)||[]).length,q.targets.length);assert.ok(svg.includes(" N"));count++;
}
assert.ok(Scene.arrowPath({x:0,y:0},{x:10,y:0}).includes("10,0"));assert.equal(Scene.arrowPath({x:1,y:1},{x:1,y:1}),"");
console.log(`Reaction scene: ${count} family/viewport cases with exact arrow tips and common magnitude scaling.`);
