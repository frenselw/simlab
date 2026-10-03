'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),M=require('./circuit-model'),S=require('./circuit-solver'),D=require('./circuit-document'),G=require('./circuit-routing'),V=require('./circuit-renderer'),P=require('./presets');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),signedStep=(a,b)=>((b-a+V.flowSpacing*1.5)%V.flowSpacing)-V.flowSpacing/2;
let cases=0;
let previous=0;
for(const current of [.001,.01,.1,.25,.5,1,3,10,1000,1e6]){const speed=V.flowSpeed(current);assert(speed>previous&&speed<240);near(speed,V.flowSpeed(-current));previous=speed;cases++;}
assert(Number.isFinite(V.flowSpeed(1e300))&&V.flowSpeed(1e300)<=240);
for(const current of [0,1e-10,-1e-10,null,undefined,NaN,Infinity,-Infinity]){assert.equal(V.flowSpeed(current),0);cases++;}
const d=P.create('parallel');d.components[3].params.resistance=60;d.display.flow='current';
const initial=D.encode(d),result=S.solve(d),routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)]));near(result.wires.w3.current,.5);near(result.wires.w4.current,.1);
for(const view of ['real','schematic'])for(const flow of ['current','electron']){
  d.display.view=view;d.display.flow=flow;const offsets=new Map(),direction=flow==='current'?1:-1;
  for(let frame=0;frame<240;frame++){
    const before=new Map(offsets);V.advanceFlow(offsets,d,result,1/60);
    for(const w of d.wires){near(signedStep(before.get(w.id)||0,offsets.get(w.id)),direction*Math.sign(result.wires[w.id].current)*V.flowSpeed(result.wires[w.id].current)/60);assert(offsets.get(w.id)>=0&&offsets.get(w.id)<V.flowSpacing);}
  }
  const snapshot=new Map(offsets),svg=V.flow(d,result,routes,999,1,offsets);assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert.equal((svg.match(/data-flow-wire=/g)||[]).length,7);
  assert(svg.includes('data-current="0.5"'));assert(svg.includes('data-direction="'+direction+'"'));assert(svg.includes(flow==='electron'?'<circle':'rotate('));
  // Rendering, pausing and changing parameters retain particle positions.
  V.flow(d,result,routes,10000,.65,offsets);assert.deepEqual(offsets,snapshot);V.advanceFlow(offsets,d,result,0);assert.deepEqual(offsets,snapshot);
  const changed=M.clone(d);changed.components[0].params.voltage=12;changed.display.flow=flow==='electron'?'current':'electron';const next=S.solve(changed);near(next.wires.w3.current,1);V.flow(changed,next,routes,0,1,offsets);assert.deepEqual(offsets,snapshot);V.advanceFlow(offsets,changed,next,.02);
  near(signedStep(snapshot.get('w3'),offsets.get('w3')),-direction*V.flowSpeed(1)*.02);
  const reversed=M.clone(changed);reversed.components[0].params.polarity=-1;const negative=S.solve(reversed),start=offsets.get('w3');near(negative.wires.w3.current,-1);V.advanceFlow(offsets,reversed,negative,.02);near(signedStep(start,offsets.get('w3')),direction*V.flowSpeed(1)*.02);
  for(const dt of [-1,NaN,Infinity]){const before=new Map(offsets);V.advanceFlow(offsets,d,result,dt);assert.deepEqual(offsets,before);}
  const startLarge=offsets.get('w3');V.advanceFlow(offsets,d,result,10);near(signedStep(startLarge,offsets.get('w3')),direction*V.flowSpeed(.5)*.05);
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
  const restored=D.decode(initial);assert.equal(D.encode(restored),initial);restored.components[3].params.resistance=30;M.validate(restored);const continued=S.solve(restored);near(continued.wires.w4.current,.2);assert(V.flowSpeed(continued.wires.w4.current)>V.flowSpeed(result.wires.w4.current));assert(!D.encode(restored).includes('phase'));cases++;
}
console.log(`Circuit flow: ${cases} current-linked speeds, signed continuous phases, zero/unknown/off, SVG and production restoration cases passed.`);
