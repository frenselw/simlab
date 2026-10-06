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
for(const view of ['real','schematic'])for(const angle of [0,90,180,270])for(const polarity of [1,-1]){
  const copy=fixture();copy.components[1].angle=angle;copy.components[0].params.polarity=polarity;copy.display.view=view;
  const result=S.solve(copy),options={wireCurrents:new Set(copy.wires.map(w=>w.id)),potentialDirections:new Set(copy.components.map(c=>c.id))},routes=Object.fromEntries(copy.wires.map(w=>[w.id,G.route(copy,w)]));
  for(const scale of [.4,.7,1,1.6]){
    const placed=V.labels(copy,result,scale,routes,null,options);assert(placed.every(p=>!p.crowded));assert.equal(placed.filter(p=>p.rows[0].kind==='potentialDirection').length,2);
    for(let i=0;i<placed.length;i++){const p=placed[i];for(const q of placed.slice(i+1))assert(!L.intersects(p.box,q.box));for(const c of copy.components)assert(!L.intersects(L.bodyBounds(c,view),p.box));for(const points of Object.values(routes))for(let j=1;j<points.length;j++)assert(!L.segmentHits(points[j-1],points[j],p.box));}
    for(const p of placed.filter(p=>p.rows[0].kind==='potentialDirection')){const row=p.rows[0],ports=M.endpoints(copy),from=ports.get(row.from),to=ports.get(row.to);assert(result.potentials[row.to]>result.potentials[row.from]);assert.equal(row.angle,Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI);assert.equal(row.size,16);}
    const svg=V.scene(copy,result,scale,routes,null,false,null,options);assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert.equal((svg.match(/data-potential-direction=/g)||[]).length,2);assert(svg.includes('stroke="#a45d0b"'));assert.deepEqual(V.labels(copy,result,scale,routes,null,options),placed);
  }
}
for(const flag of [false,true]){const copy=fixture();copy.display.potential=flag;assert(!V.scene(copy,S.solve(copy)).includes('data-potential-direction='));assert(V.scene(copy,S.solve(copy),1,{},null,false,null,{potentialDirections:new Set(['c2'])}).includes('data-potential-label="c2"'));}
const equal=V.scene(zero,S.solve(zero),1,{},null,false,null,{potentialDirections:new Set(['c2'])});assert(equal.includes('等電勢'));assert(!equal.includes('data-potential-direction='));
const floating=M.empty();M.add(floating,'switch',200,200,{closed:false});const unresolved=V.scene(floating,S.solve(floating),1,{},null,false,null,{potentialDirections:new Set(['c1'])});assert(unresolved.includes('未能確定'));assert(!unresolved.includes('data-potential-direction='));
const meters=require('./presets').create('meters'),meterSVG=V.scene(meters,S.solve(meters),1,{},null,false,null,{potentialDirections:new Set(meters.components.map(c=>c.id))});assert(meterSVG.includes('data-potential-direction="c3" data-potential-from="c3:d" data-potential-to="c3:c"'),'W direction uses voltage coil');assert(meterSVG.includes('data-potential-label="c4"'));
const small=V.scene(d,solved,.3,{},null,false,{x:0,y:0,width:1000,height:800},{potentialDirections:new Set(['c2'])});assert(small.includes('data-potential-overview="true"'));assert(!small.includes('data-potential-label='));
const short=require('./presets').create('series'),shortResult=S.solve(short),shortRoutes=Object.fromEntries(short.wires.map(w=>[w.id,G.route(short,w)])),shortOptions={wireCurrents:new Set(short.wires.map(w=>w.id)),potentialDirections:new Set(short.components.map(c=>c.id))};
const dense=V.scene(short,shortResult,.5,shortRoutes,'c4',false,{x:100,y:120,width:640,height:370},shortOptions);assert(dense.includes('data-potential-overview="true"'));assert(!dense.includes('data-potential-label='),'dense overview never paints colliding direction labels');
const focused=V.scene(short,shortResult,1,shortRoutes,'c4',false,{x:490,y:200,width:320,height:240},shortOptions);assert(focused.includes('data-potential-label="c4"'));assert(focused.includes('燈泡 2：電勢升高'),'wrapped labels retain their complete accessible title');assert(!focused.includes('data-potential-label="c3"'),'mostly offscreen components do not crowd the focused view');
const tinyVoltage=fixture();tinyVoltage.components[0].params.voltage=1e-9;assert(V.scene(tinyVoltage,S.solve(tinyVoltage),1,{},null,false,null,{potentialDirections:new Set(['c2'])}).includes('data-potential-direction="c2"'));
assert.equal(P.compile({role:'teacher'}).ui.potentialDirections,true);assert.equal(P.compile({role:'student'}).ui.potentialDirections,false);assert.equal(P.compile({role:'student',ui:{potentialDirections:true}}).ui.potentialDirections,true);assert.throws(()=>P.compile({ui:{potentialDirections:1}}));assert.equal(D.encode(d),before);
const coloured=require('./presets').create('series');assert.deepEqual(V.potentialRange(S.solve(coloured)),{low:0,high:6,max:6,known:true});
coloured.display.reference='c1:a';assert.deepEqual(V.potentialRange(S.solve(coloured)),{low:-6,high:0,max:6,known:true});
coloured.components[0].params.voltage=0;assert.deepEqual(V.potentialRange(S.solve(coloured)),{low:0,high:0,max:1,known:true});
assert.deepEqual(V.potentialRange({potentials:{a:null,b:null}}),{low:0,high:0,max:1,known:false});assert.deepEqual(V.potentialRange({potentials:{a:-3,b:6,c:null}}),{low:-3,high:6,max:6,known:true});
console.log('Diagram labels: signed current, potential directions/colour range, four rotations, both views, zero/unknown, zoom/clearance/stability, independent colour and trusted profile defaults passed.');
