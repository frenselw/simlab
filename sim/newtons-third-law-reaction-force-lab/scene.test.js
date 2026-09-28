"use strict";
const assert=require("node:assert/strict"),G=require("./generator.js"),M=require("./model.js"),Scene=require("./scene.js"),N=require("./notation.js");
let count=0;
for(let family=0;family<5;family++)for(const p of G.parameterSets(family))for(const [w,h]of [[320,200],[390,260],[860,720]]){
 const q=G.build(family,p),l=M.layout(w,h,q),svg=Scene.svg(q,l,q.expected,0);assert.ok(!svg.includes("NaN"));assert.ok(!svg.includes("Infinity"));assert.equal((svg.match(/data-given=/g)||[]).length,q.given.length);assert.equal((svg.match(/data-reaction=/g)||[]).length,q.targets.length);assert.ok(svg.includes(" N"));count++;
}
assert.ok(Scene.arrowPath({x:0,y:0},{x:10,y:0}).includes("10,0"));assert.equal(Scene.arrowPath({x:1,y:1},{x:1,y:1}),"");
const contact=G.generate(0).questions[1];assert.equal(N.reactionSymbol(0,contact.given[0]),"F");assert.equal(N.reactionSymbol(0,contact.given[1]),"N");assert.equal(N.reactionSymbol(2,contact.given[0]),"T","wrong force types keep their chosen symbol");
const contactSvg=Scene.svg(contact,M.layout(390,260,contact),contact.expected,0);assert.ok(!contactSvg.includes('>P<'));assert.ok(contactSvg.includes('<tspan class="math">F</tspan><tspan>′'));
// Measure rendered arrows, not just model coordinates: moving N must leave G
// fixed and keep the contact marker and reaction on the same action line.
function arrow(svg,attribute){const d=svg.match(new RegExp(`<path ${attribute}[^>]* d="([^"]+)"`))[1],points=[...d.matchAll(/([\d.e+-]+),([\d.e+-]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));return {start:{x:(points[0].x+points.at(-1).x)/2,y:(points[0].y+points.at(-1).y)/2},tip:points[3]};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
for(const version of [1,2])for(const family of [1,2])for(const params of G.parameterSets(family))for(const [w,h]of [[320,199],[390,260],[860,720]]){
 const q=G.build(family,params,version),before=JSON.stringify(q),l=M.layout(w,h,q),i=q.targets.indexOf("normal"),svg=Scene.svg(q,l,q.expected,i),n=arrow(svg,'data-given="normal"'),g=arrow(svg,'data-given="weight"'),r=arrow(svg,`data-reaction="${i}"`),weight=q.given.find(f=>f.id==="weight"),originalG=M.pixel(weight.origin,l);
 close(g.start.x,originalG.x);close(g.start.y,originalG.y);close(g.tip.x,originalG.x);close(g.tip.y-originalG.y,weight.force100/100*l.forceScale*l.unit);
 assert.ok(Math.abs(n.start.x-g.start.x)>=9,"N and G remain visibly separated on the shortest phone stage");
 assert.equal(Math.sign(n.start.x-g.start.x),params.mirror?-1:1);close(n.start.x,r.start.x);close(n.start.y,r.start.y);close(n.tip.x,r.tip.x);close(n.start.y-n.tip.y,r.tip.y-r.start.y);
 const marker=svg.match(new RegExp(`<circle data-anchor-dot="${q.expected[i][1]}" cx="([^"]+)" cy="([^"]+)"`));close(Number(marker[1]),n.start.x);close(Number(marker[2]),n.start.y);
 // Choosing the original body remains possible at the same visible contact.
 const wrong=[...q.expected[i]];wrong[0]=0;close(M.pixel(M.origin(wrong,q),l).x,n.start.x);assert.equal(JSON.stringify(q),before,"display offsets never mutate authoritative geometry or values");
}
console.log(`Reaction scene: ${count} family/viewport cases with exact arrow tips and common magnitude scaling.`);
