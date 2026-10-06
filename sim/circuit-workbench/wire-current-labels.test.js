'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),S=require('./circuit-solver'),V=require('./circuit-renderer'),G=require('./circuit-routing'),L=require('./circuit-label-layout'),P=require('./circuit-profile'),D=require('./circuit-document'),{XMLValidator}=require('fast-xml-parser');
function fixture(){const d=M.empty(),b=M.add(d,'battery',180,220,{voltage:6}),r=M.add(d,'resistor',420,220,{resistance:12});b.angle=90;M.connect(d,b.id+':a',r.id+':a',[],'free');M.connect(d,r.id+':b',b.id+':b',[{x:480,y:380},{x:240,y:380}],'free');return d;}
function render(d){return V.scene(d,S.solve(d),1,{},null,false,null,{wireCurrents:new Set(d.wires.map(w=>w.id))});}
const d=fixture(),before=D.encode(d),solved=S.solve(d);
assert(!V.scene(d,solved).includes('data-wire-current-label='));
for(const view of ['real','schematic'])for(const flow of ['off','current','electron']){
  const copy=M.clone(d);Object.assign(copy.display,{view,flow});
  const svg=render(copy);assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert.equal((svg.match(/data-wire-current-label=/g)||[]).length,2);assert(svg.includes('data-wire-current-arrow="w1" data-direction="1"'));assert(svg.includes('data-wire-current-arrow="w2" data-direction="1"'));assert(svg.includes('data-math="500 mA"'));
  copy.components[0].params.polarity=-1;const reversed=render(copy);assert(reversed.includes('data-wire-current-arrow="w1" data-direction="-1"'));assert(reversed.includes('data-math="500 mA"'));
}
for(const scale of [.3,.7,1,1.6]){
  const options={wireCurrents:new Set(['w1','w2'])},r=S.solve(d),routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)])),placed=V.labels(d,r,scale,routes,null,options);
  assert.equal(placed.filter(p=>p.rows[0].kind==='wireCurrent').length,2);assert(placed.every(p=>!p.crowded));
  for(let i=0;i<placed.length;i++){
    const p=placed[i];for(const q of placed.slice(i+1))assert(!L.intersects(p.box,q.box));
    for(const points of Object.values(routes))for(let n=1;n<points.length;n++)assert(!L.segmentHits(points[n-1],points[n],p.box));
  }
  const again=V.labels(d,r,scale,routes,null,options);assert.deepEqual(again,placed,'slots remain stable');
}
const micro=fixture();micro.components[1].params.resistance=1e6;assert(render(micro).includes('data-math="6 μA"'));
const zero=fixture();zero.components[0].params.voltage=0;const z=render(zero);assert(z.includes('data-math="0 A"'));assert(!z.includes('data-wire-current-arrow='));
const unknown={...solved,wires:{w1:{current:null},w2:{current:null}}};const u=V.scene(d,unknown,1,{},null,false,null,{wireCurrents:new Set(['w1'])});assert(u.includes('未能確定'));assert(!u.includes('data-wire-current-arrow='));assert(!u.includes('data-wire-current-label="w2"'));
const loop=M.empty();loop.junctions=[{id:'j1',x:100,y:100},{id:'j2',x:340,y:100},{id:'j3',x:220,y:300}];M.connect(loop,'j1:p','j2:p',[],'free');M.connect(loop,'j2:p','j3:p',[],'free');M.connect(loop,'j3:p','j1:p',[],'free');assert(Object.values(S.solve(loop).wires).every(w=>w.current===null));assert.equal((render(loop).match(/未能確定/g)||[]).length,6);
const overview=V.scene(d,solved,.3,{},null,false,{x:0,y:0,width:1000,height:800},{wireCurrents:new Set(['w1'])});assert(!overview.includes('data-wire-current-label='));assert(overview.includes('data-wire-current-overview="true"'));
const crop={x:320,y:200,width:100,height:70};assert(V.labels(d,solved,1,{},crop,{wireCurrents:new Set(['w1'])}).some(p=>p.id==='w1'),'visible segment remains labelled while its full midpoint is offscreen');
assert.deepEqual(L.segmentSpan({x:-100,y:0},{x:100,y:0},{left:-10,right:10,top:-10,bottom:10}),[.45,.55]);
assert.equal(D.encode(d),before);assert.deepEqual(S.solve(d).wires,solved.wires);
assert.equal(P.compile({role:'teacher'}).ui.wireCurrents,true);assert.equal(P.compile({role:'student'}).ui.wireCurrents,false);assert.equal(P.compile({role:'student',ui:{wireCurrents:true}}).ui.wireCurrents,true);assert.throws(()=>P.compile({ui:{wireCurrents:'true'}}));
console.log('Wire current labels: signed conventional directions, all/individual visibility, zero/unknown, micro units, both views/animations, zoom/clearance/stability, viewport clipping and profile defaults passed.');
