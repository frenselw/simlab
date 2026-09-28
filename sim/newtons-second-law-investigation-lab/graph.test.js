"use strict";
const assert=require("node:assert/strict"), {XMLValidator}=require("fast-xml-parser"), G=require("./graph.js"), E=require("./experiment.js"), M=require("./model.js"), {filled}=require("./test-support.js");
for(const [w,h] of [[320,166],[320,230],[390,276],[768,400],[896,760]]) for(const graph of [0,1,2]) {
  const s=filled(),g=G.geometry(w,h,M.bounds(s,graph));
  assert.ok(g.majorY/g.range.y*g.plotHeight>=g.font*1.2,"tick labels remain separated in short viewports");
  assert.ok(g.left-22>=32 && w-g.right-22>=32,"point targets leave usable side strips");
  for(const p of [[0,0],[g.range.x,g.range.y],M.expected(graph,s.groups[M.sourceGroup(graph)].records[2])]) {
    const q=G.data(g,G.pixel(g,p));q.forEach((v,i)=>assert.ok(Math.abs(v-p[i])<1e-10));
  }
  const known=M.expected(graph,s.groups[M.sourceGroup(graph)].records[2]),pixel=G.pixel(g,known);
  assert.deepEqual(G.snap(g,{x:pixel.x+5,y:pixel.y},known,"touch").point,known);
  assert.deepEqual(G.snap(g,pixel,known,"touch",[known[0]+g.minorX,known[1]+g.minorY]).point,known,"reading wins over a nearby held grid point");
  assert.deepEqual(G.snap(g,{x:pixel.x+13,y:pixel.y},known,"touch",known).point,known);
  assert.notDeepEqual(G.snap(g,{x:pixel.x+17,y:pixel.y},known,"touch",known).held,known);
  const off=G.handle(g,[.5,3]);assert.equal(off.offscale,3>g.range.y);assert.equal(off.y,g.top);
  const markup=`<svg>${G.svg(s,graph,g,0,null,true)}</svg>`;assert.equal(XMLValidator.validate(markup),true);assert.ok(markup.includes("fit-curve"));assert.ok(!/NaN|Infinity/.test(markup));
  assert.ok(!markup.includes('class="point-label"') && !markup.includes('class="projection"'),"idle selected points do not cover other data with coordinates");
  const working=G.svg(s,graph,g,0,[.7,.333]);
  assert.ok(working.includes('class="point-label"') && working.includes('#1 (0.7, 0.333)') && working.includes('class="projection"'),"the current working coordinate remains visible during adjustment");
}
for(const [w,h] of [[320,166],[320,500],[390,276],[650,360],[896,760]])for(let mi=0;mi<7;mi++)for(let fi=0;fi<6;fi++)for(const time of [0,1,E.timing([mi,fi]).ready,E.timing([mi,fi]).end]) {
  const completed=time===E.timing([mi,fi]).end,markup=`<svg>${E.svg(w,h,[mi,fi],time,completed,0)}</svg>`;
  assert.equal(XMLValidator.validate(markup),true);assert.ok(!/NaN|Infinity/.test(markup));
  if(completed)assert.ok(+markup.match(/class="cart-body" x="([^"]+)"/)[1]>w,"whole cart clears every viewport before the run ends");
}
console.log("newton graphs: scale conversion, snap hysteresis, offscale handles, all apparatus settings and valid SVG passed");
