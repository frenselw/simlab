'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),M=require('./circuit-model'),S=require('./circuit-solver'),D=require('./circuit-document'),G=require('./circuit-routing'),V=require('./circuit-renderer'),P=require('./presets');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),signedStep=(a,b)=>((b-a+V.flowSpacing*1.5)%V.flowSpacing)-V.flowSpacing/2;
const wireSpeed=(doc,result,id)=>{const w=doc.wires.find(w=>w.id===id),references=V.flowReferences(doc,result);return V.flowSpeed(result.wires[id].current,references.get(result.islandOf[w.from]));};
let cases=0;
let previous=0;
for(const current of [.001,.01,.1,.25,.5,1,3,10,1000,1e6]){const speed=V.flowSpeed(current);assert(speed>previous&&speed<240);near(speed,V.flowSpeed(-current));previous=speed;cases++;}
assert(Number.isFinite(V.flowSpeed(1e300))&&V.flowSpeed(1e300)<=240);
for(const current of [0,null,undefined,NaN,Infinity,-Infinity]){assert.equal(V.flowSpeed(current),0);cases++;}
const d=P.create('parallel');d.components[3].params.resistance=60;d.display.flow='current';
const initial=D.encode(d),result=S.solve(d),routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)]));near(result.wires.w3.current,.5);near(result.wires.w4.current,.1);
for(const view of ['real','schematic'])for(const flow of ['current','electron']){
  d.display.view=view;d.display.flow=flow;const offsets=new Map(),direction=flow==='current'?1:-1;
  for(let frame=0;frame<240;frame++){
    const before=new Map(offsets);V.advanceFlow(offsets,d,result,1/60);
    for(const w of d.wires){near(signedStep(before.get(w.id)||0,offsets.get(w.id)),direction*Math.sign(result.wires[w.id].current)*wireSpeed(d,result,w.id)/60);assert(offsets.get(w.id)>=0&&offsets.get(w.id)<V.flowSpacing);}
  }
  const snapshot=new Map(offsets),svg=V.flow(d,result,routes,999,1,offsets);assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert.equal((svg.match(/data-flow-wire=/g)||[]).length,7);
  assert(svg.includes('data-current="0.5"'));assert(svg.includes('data-direction="'+direction+'"'));assert(svg.includes(flow==='electron'?'<circle':'rotate('));
  // Rendering, pausing and changing parameters retain particle positions.
  V.flow(d,result,routes,10000,.65,offsets);assert.deepEqual(offsets,snapshot);V.advanceFlow(offsets,d,result,0);assert.deepEqual(offsets,snapshot);
  const changed=M.clone(d);changed.components[0].params.voltage=12;changed.display.flow=flow==='electron'?'current':'electron';const next=S.solve(changed);near(next.wires.w3.current,1);V.flow(changed,next,routes,0,1,offsets);assert.deepEqual(offsets,snapshot);V.advanceFlow(offsets,changed,next,.02);
  near(signedStep(snapshot.get('w3'),offsets.get('w3')),-direction*wireSpeed(changed,next,'w3')*.02);
  const reversed=M.clone(changed);reversed.components[0].params.polarity=-1;const negative=S.solve(reversed),start=offsets.get('w3');near(negative.wires.w3.current,-1);V.advanceFlow(offsets,reversed,negative,.02);near(signedStep(start,offsets.get('w3')),direction*wireSpeed(reversed,negative,'w3')*.02);
  for(const dt of [-1,NaN,Infinity]){const before=new Map(offsets);V.advanceFlow(offsets,d,result,dt);assert.deepEqual(offsets,before);}
  const startLarge=offsets.get('w3');V.advanceFlow(offsets,d,result,10);near(signedStep(startLarge,offsets.get('w3')),direction*wireSpeed(d,result,'w3')*.05);
  cases++;
}
{
  d.display.flow='current';const offsets=new Map([['deleted',20],['w3',25]]),before=D.encode(d);V.advanceFlow(offsets,d,result,.02);assert(!offsets.has('deleted'));assert.equal(D.encode(d),before,'animation is ephemeral and does not mutate the circuit');
  d.display.flow='off';const frozen=new Map(offsets);V.advanceFlow(offsets,d,result,.02);assert.deepEqual(offsets,frozen);assert.equal(V.flow(d,result,routes,1,1,offsets),'');cases++;
}
{
  const opened=D.decode(initial);opened.components[1].params.closed=false;const zero=S.solve(opened),offsets=new Map();V.advanceFlow(offsets,opened,zero,.05);assert.equal(offsets.size,0);assert.equal(V.flow(opened,zero,{},1,1,offsets),'');cases++;
  const unknown=M.empty(),source=M.add(unknown,'battery',150,180),short=M.connect(unknown,source.id+':a',source.id+':b',[],'free'),good=M.add(unknown,'battery',450,180),load=M.add(unknown,'resistor',650,320,{resistance:12});M.connect(unknown,good.id+':a',load.id+':a',[],'free');M.connect(unknown,load.id+':b',good.id+':b',[],'free');const solved=S.solve(unknown);assert.equal(solved.wires[short.id].current,null);V.advanceFlow(offsets,unknown,solved,.05);assert(!offsets.has(short.id));assert(V.flow(unknown,solved,{},1,1,offsets).includes('data-flow-wire="w2"'));assert(!V.flow(unknown,solved,{},1,1,offsets).includes('data-flow-wire="w1"'));cases++;
}
{
  const restored=D.decode(initial);assert.equal(D.encode(restored),initial);restored.components[3].params.resistance=30;M.validate(restored);const continued=S.solve(restored);near(continued.wires.w4.current,.2);assert(wireSpeed(restored,continued,'w4')>wireSpeed(d,result,'w4'));assert(!D.encode(restored).includes('phase'));cases++;
}
// A removed menu entry must also be absent from the preset API.
assert(!Object.hasOwn(P.names,'lampCurve'));assert.throws(()=>P.create('lampCurve'),/未知的範例/);assert(P.create('divider').components.some(c=>c.type==='rheostat'));cases++;
for(const name of ['gVoltmeter','gAmmeter']){
  const d=P.create(name),s=S.solve(d),g=d.components.find(c=>c.type==='galvanometer'),references=V.flowReferences(d,s),reference=references.get(s.islandOf[g.id+':a']);
  near(s.components[g.id].reading,.00005);near(reference,name==='gAmmeter'?.001:.00005);
  const slow=V.flowSpeed(s.components[g.id].reading,reference);assert(slow>=40&&slow<=92.000001,'G full scale stays visibly animated');
  if(name==='gAmmeter')assert(slow<V.flowSpeed(.00095,reference)&&V.flowSpeed(.00095,reference)<V.flowSpeed(.001,reference));
  for(const view of ['real','schematic'])for(const flow of ['current','electron']){
    d.display.view=view;d.display.flow=flow;const offsets=new Map(),before=D.encode(d);
    for(let frame=0;frame<30;frame++)V.advanceFlow(offsets,d,s,1/60);
    const svg=V.flow(d,s,{},0,.6,offsets);assert(svg.includes('data-flow-component="'+g.id+'"'));assert(svg.includes('data-current="'+s.components[g.id].current+'"'));
    near(offsets.get('component:'+g.id+':main'),(flow==='electron'?-slow*.5:slow*.5)+ (flow==='electron'?V.flowSpacing:0));assert.equal(D.encode(d),before);
  }
  // A separate 0.5 A loop cannot rescale the G circuit.
  const oldSpeed=slow,source=M.add(d,'battery',1250,180),load=M.add(d,'resistor',1450,320);
  M.connect(d,source.id+':a',load.id+':a',[],'free');M.connect(d,load.id+':b',source.id+':b',[],'free');
  const separate=S.solve(d),scales=V.flowReferences(d,separate);near(V.flowSpeed(separate.components[g.id].reading,scales.get(separate.islandOf[g.id+':a'])),oldSpeed);assert.equal(scales.size,2);
  const restored=D.decode(D.encode(d));restored.components[1].params.resistance*=2;const continued=S.solve(restored);assert(continued.components[g.id].reading>0&&continued.components[g.id].reading<.00005);assert(V.flow(restored,continued,{},1,.6).includes('data-flow-component="'+g.id+'"'));cases++;
}
{
  // Sub-nanoamp currents are real results, not a global animation cutoff.
  const d=M.empty(),source=M.add(d,'battery',180,180),load=M.add(d,'resistor',380,180,{resistance:12}),v=M.add(d,'voltmeter',500,380,{resistance:1e12});
  M.connect(d,source.id+':a',load.id+':a',[],'free');M.connect(d,load.id+':b',source.id+':b',[],'free');M.connect(d,v.id+':a',source.id+':a',[],'free');M.connect(d,v.id+':b',source.id+':b',[],'free');
  const s=S.solve(d);near(s.components[v.id].current,6e-12);const svg=V.flow(d,s,{},0,1);assert(svg.includes('data-flow-component="'+v.id+'"'));assert(V.flowSpeed(6e-12,.5)>=18);assert(V.flowSpeed(1e-300,1e300)>=18);cases++;
}
{
  const d=M.empty(),b=M.add(d,'battery',160,180,{voltage:6}),r=M.add(d,'resistor',420,180,{resistance:12});M.connect(d,b.id+':a',r.id+':a',[],'free');M.connect(d,r.id+':b',b.id+':b',[],'free');
  for(const style of ['current','electron']){d.display.flow=style;const baselines=new Map(),offsets=new Map(),initial=S.solve(d);V.flowReferences(d,initial,baselines);let previous=Infinity;
    for(const resistance of [0,6,12]){d.wires[0].resistance=resistance;const a=S.solve(d),reference=V.flowReferences(d,a,baselines).get(a.islandOf[d.wires[0].from]);near(reference,.5);assert.equal(baselines.size,1,'ideal/resistive wire roots keep the same island baseline');const speed=V.flowSpeed(a.wires.w1.current,reference);assert(speed<previous);previous=speed;const before=offsets.get('w1')||0;V.advanceFlow(offsets,d,a,.02,baselines);near(signedStep(before,offsets.get('w1')),(style==='electron'?-1:1)*speed*.02);const snapshot=new Map(offsets),svg=V.flow(d,a,{},0,1,offsets,baselines);assert.deepEqual(offsets,snapshot);assert(svg.includes('data-reference-current="0.5"'));assert(svg.includes('data-speed="'+speed+'"'));
    }
    d.wires[0].resistance=0;const restored=S.solve(d);near(V.flowSpeed(restored.wires.w1.current,V.flowReferences(d,restored,baselines).get(restored.islandOf[d.wires[0].from])),92);
    const snapshot=new Map(baselines),preview=M.clone(d);preview.junctions.push({id:'j1',x:300,y:300});preview.wires[0].to='j1:p';V.flowReferences(preview,S.solve(preview),new Map(baselines));assert.deepEqual(baselines,snapshot,'preview scale changes cannot pollute the committed baseline');
    const before=D.encode(d),loaded=D.decode(before),fresh=new Map();loaded.wires[0].resistance=12;const a=S.solve(loaded);near(V.flowReferences(loaded,a,fresh).get(a.islandOf[loaded.wires[0].from]),.25);assert.equal(D.encode(d),before);assert(!before.includes('baseline'));
  }cases++;
}
{
  const d=P.create('gAmmeter'),baselines=new Map(),first=S.solve(d);V.flowReferences(d,first,baselines);const originalWireIds=new Set(d.wires.map(w=>w.id)),source=M.add(d,'battery',1250,180),load=M.add(d,'resistor',1450,180);M.connect(d,source.id+':a',load.id+':a',[],'free');M.connect(d,load.id+':b',source.id+':b',[],'free');const added=S.solve(d);near(V.flowReferences(d,added,baselines).get(added.islandOf['c3:a']),.001);assert.equal(baselines.size,2);d.components.find(c=>c.type==='battery').params.voltage=1.5;const changed=S.solve(d),ref=V.flowReferences(d,changed,baselines).get(changed.islandOf['c3:a']);near(ref,.001);assert(V.flowSpeed(changed.components.c3.reading,ref)<V.flowSpeed(first.components.c3.reading,ref));assert(V.flowSpeed(changed.components.c3.reading,ref)>=18);M.remove(d,source.id);M.remove(d,load.id);d.wires=d.wires.filter(w=>originalWireIds.has(w.id));M.cleanup(d);V.flowReferences(d,S.solve(d),baselines);assert.equal(baselines.size,1);cases++;
}
console.log(`Circuit flow: ${cases} current-linked speeds, signed continuous phases, zero/unknown/off, SVG and production restoration cases passed.`);
