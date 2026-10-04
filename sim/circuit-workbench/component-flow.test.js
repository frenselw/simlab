'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),M=require('./circuit-model'),S=require('./circuit-solver'),D=require('./circuit-document'),R=require('./component-registry'),V=require('./circuit-renderer'),P=require('./presets');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),point=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
const step=(a,b)=>((b-a+V.flowSpacing*1.5)%V.flowSpacing)-V.flowSpacing/2;
let cases=0;
function loop(type,params={}){
  const d=M.empty(),source=M.add(d,'battery',180,150),load=M.add(d,type,460,150,params);
  d.display.flow='current';M.connect(d,source.id+':a',load.id+':a',[],'free');M.connect(d,load.id+':b',source.id+':b',[],'free');
  return{d,source,load};
}
function paths(d){return V.componentFlowPaths(d,S.solve(d));}
function rheostatFixture(terminals,loadPort=null,divider=false){
  const f=loop('rheostat',{resistance:100,position:.25,terminals});
  // The loop initially uses P1. A divider instead feeds the complete resistance.
  if(divider)f.d.wires[1].from=f.load.id+':c';
  if(loadPort){
    f.d.wires[1].from=divider?f.load.id+':c':f.load.id+':'+loadPort;
    const load=M.add(f.d,'resistor',650,300,{resistance:divider?50:12});
    if(!divider)f.d.wires[1].to=load.id+':a';else M.connect(f.d,f.load.id+':'+loadPort,load.id+':a',[],'free');
    M.connect(f.d,load.id+':b',f.source.id+':b',[],'free');
  }
  return f;
}
{
  const{d,load}=loop('lamp'),p=paths(d).find(p=>p.component===load.id);
  assert.deepEqual(p.points.map(p=>[p.x-load.x,p.y-load.y]),[[-60,0],[-12,0],[-7,-8],[-7,-26],[-10,-31],[-6,-35],[-2,-29],[2,-35],[6,-29],[10,-33],[7,-26],[7,-8],[0,18],[40,18],[40,0],[60,0]]);
  near(p.current,.5);
  const body=V.body(load,S.solve(d).components[load.id],d.display),filament=body.match(/data-lamp-filament="true" d="([^"]+)"/)[1];
  assert.equal(filament,'M-7,-8 L-7,-26 L-10,-31 L-6,-35 L-2,-29 L2,-35 L6,-29 L10,-33 L7,-26 L7,-8');cases++;
}
{
  // Endpoints must be the actual sockets in both views, all rotations and mirrors.
  for(const type of Object.keys(R.definitions))for(const view of ['real','schematic'])for(const angle of [0,90,180,270])for(const mirrored of R.dualMeter({type})?[false,true]:[false]){
    const{d,load}=loop(type,type==='rheostat'?{terminals:4}:{});load.angle=angle;d.display.view=view;if(R.dualMeter(load))load.mirrored=mirrored;
    const ports=new Map(R.ports(load).map(p=>[p.id,p]));
    for(const path of paths(d).filter(p=>p.component===load.id)){
      assert(path.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
      if(ports.has(path.from))point(path.points[0],ports.get(path.from));
      if(ports.has(path.to))point(path.points.at(-1),ports.get(path.to));
    }
  }
  for(const terminals of [2,3]){
    const{d,load}=loop('rheostat',{terminals});for(const p of paths(d).filter(p=>p.component===load.id))assert(p.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  }
  cases++;
}
{
  for(const terminals of [3,4])for(const port of terminals===3?['b']:['b','d'])for(const divider of [false,true]){
    const{d,load}=rheostatFixture(terminals,port,divider),result=S.solve(d),actual=new Map(V.componentFlowPaths(d,result).filter(p=>p.component===load.id).map(p=>[p.key,p.current]));
    const incoming=divider?6/55:6/37,right=divider?incoming*30/75:0,tap=incoming-right;
    near(actual.get('resistance-a'),incoming);near(actual.get('resistance-c'),right);near(actual.get('slider'),tap);
    near(actual.get('bar-left'),port==='b'?-tap:0);if(terminals===4)near(actual.get('bar-right'),port==='d'?tap:0);
    // KCL at the slider and at the resistive contact, independently of rendering.
    near(actual.get('slider')+actual.get('bar-left')-(actual.get('bar-right')||0),0);
    near(actual.get('resistance-a')-actual.get('resistance-c')-actual.get('slider'),0);
  }
  const{d,load}=rheostatFixture(4,null,true),actual=paths(d).filter(p=>p.component===load.id);
  near(actual.find(p=>p.key==='resistance-a').current,.06);near(actual.find(p=>p.key==='resistance-c').current,.06);
  for(const key of ['slider','bar-left','bar-right'])near(actual.find(p=>p.key===key).current,0);
  const svg=V.flow(d,S.solve(d),{},1,1);assert(!svg.includes('data-flow-path="slider"'));assert(!svg.includes('data-flow-path="bar-left"'));cases++;
}
{
  const{d,source,load}=loop('voltmeter');const ideal=S.solve(d);near(ideal.components[load.id].reading,6);
  assert(!V.flow(d,ideal,{},1,1).includes('data-flow-component="'+load.id+'"'),'a voltage reading is not an electric current');
  load.params.resistance=30;let result=S.solve(d),p=V.componentFlowPaths(d,result).filter(p=>p.component===load.id);
  near(p.find(p=>p.key==='high').current,.2);near(p.find(p=>p.key==='low').current,0);near(p.find(p=>p.key==='common').current,.2);
  d.wires[0].to=load.id+':c';result=S.solve(d);p=V.componentFlowPaths(d,result).filter(p=>p.component===load.id);
  near(p.find(p=>p.key==='high').current,0);near(p.find(p=>p.key==='low').current,1);near(p.find(p=>p.key==='common').current,1);
  source.params.polarity=-1;p=paths(d).filter(p=>p.component===load.id);near(p.find(p=>p.key==='low').current,-1);near(p.find(p=>p.key==='common').current,-1);cases++;
}
{
  const{d,source,load}=loop('wattmeter',{resistance:10,inputResistance:30});
  M.connect(d,load.id+':c',source.id+':a',[],'free');M.connect(d,load.id+':d',source.id+':b',[],'free');
  const result=S.solve(d),p=V.componentFlowPaths(d,result).filter(p=>p.component===load.id);
  near(result.components[load.id].reading,3.6);near(p.find(p=>p.key==='current-coil').current,.6);near(p.find(p=>p.key==='voltage-coil').current,.2);
  load.params.inputResistance=0;assert(!V.flow(d,S.solve(d),{},1,1).includes('data-flow-path="voltage-coil"'));cases++;
}
{
  const{d,load}=loop('lamp'),zero=M.clone(d);zero.components[0].params.voltage=0;assert.equal(V.flow(zero,S.solve(zero),{},1,1),'');
  const open=P.create('series');open.components[1].params.closed=false;assert.equal(V.flow(open,S.solve(open),{},1,1),'');
  const bypass=M.clone(d);M.connect(bypass,load.id+':a',load.id+':b',[],'free');const result=S.solve(bypass);
  assert.equal(result.components[load.id].current,null);assert.equal(result.components.c1.current,null);assert.equal(V.flow(bypass,result,{},1,1),'');
  bypass.components[0].params.resistance=.5;const finite=S.solve(bypass);near(finite.components[load.id].current,0);near(finite.components.c1.current,-12);
  assert(!V.flow(bypass,finite,{},1,1).includes('data-flow-component="'+load.id+'"'));assert(V.flow(bypass,finite,{},1,1).includes('data-flow-component="c1"'));cases++;
}
{
  for(const view of ['real','schematic'])for(const style of ['current','electron'])for(const scale of [.2,.6,1,2]){
    const d=P.create('series');d.display.view=view;d.display.flow=style;const result=S.solve(d),offsets=new Map();
    for(const p of V.componentFlowPaths(d,result))offsets.set(p.id,64.8);
    const svg=V.flow(d,result,{},0,scale,offsets);assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);
    for(const group of svg.matchAll(/<g data-flow-component="([^"]+)"[^>]*>(.*?)<\/g>/g)){
      assert((group[2].match(/data-flow-distance=/g)||[]).length>=2,'small parts retain at least two visible moving glyphs');
      const expected=(group[1]==='c1'?-1:1)*(style==='electron'?-1:1);assert(group[0].includes('data-direction="'+expected+'"'));
    }
  }
  cases++;
}
{
  const d=P.create('series'),result=S.solve(d),offsets=new Map(),saved=D.encode(d);d.display.flow='current';
  const p=V.componentFlowPaths(d,result).find(p=>p.component==='c3');
  offsets.set(p.id,64.8);V.advanceFlow(offsets,d,result,.02);near(step(64.8,offsets.get(p.id)),V.flowSpeed(.25)*.02);
  const snapshot=new Map(offsets);V.advanceFlow(offsets,d,result,0);assert.deepEqual(offsets,snapshot);V.flow(d,result,{},999,.6,offsets);assert.deepEqual(offsets,snapshot);
  const reversed=M.clone(d);reversed.components[0].params.polarity=-1;V.advanceFlow(offsets,reversed,S.solve(reversed),0);assert.deepEqual(offsets,snapshot);
  V.advanceFlow(offsets,reversed,S.solve(reversed),.02);near(step(snapshot.get(p.id),offsets.get(p.id)),-V.flowSpeed(.25)*.02);
  d.display.flow='electron';const before=offsets.get(p.id);V.advanceFlow(offsets,d,result,.02);near(step(before,offsets.get(p.id)),-V.flowSpeed(.25)*.02);
  const restored=D.decode(saved);assert.equal(D.encode(restored),saved);assert(!saved.includes('component:'));restored.components[1].params.closed=false;assert.equal(V.flow(restored,S.solve(restored),{},1,1),'');
  restored.components[1].params.closed=true;restored.components[0].params.voltage=12;near(S.solve(restored).components.c3.current,.5);assert(V.flow(restored,S.solve(restored),{},1,1).includes('data-flow-component="c3"'));
  offsets.set('component:deleted:main',5);V.advanceFlow(offsets,restored,S.solve(restored),0);assert(!offsets.has('component:deleted:main'));cases++;
}
console.log(`Component flow: ${cases} focused groups passed; filament and real ports, rotations/mirrors, rheostat KCL, independent meter coils, zero/unknown suppression, visible particles and ephemeral signed motion.`);
