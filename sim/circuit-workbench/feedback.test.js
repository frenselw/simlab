'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),M=require('./circuit-model'),R=require('./component-registry'),S=require('./circuit-solver'),D=require('./circuit-document'),G=require('./circuit-routing'),V=require('./circuit-renderer');
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function lampCircuit(voltage=6,model='ideal',resistance=0){const d=M.empty(),source=M.add(d,'battery',160,140,{voltage,resistance}),lamp=M.add(d,'lamp',420,340,{model});M.connect(d,source.id+':a',lamp.id+':a',[],'free');M.connect(d,lamp.id+':b',source.id+':b',[],'free');d.display.flow='off';return{d,source,lamp};}
let cases=0;
for(const model of ['ideal','thermal']){
  let previous=-1;
  for(const voltage of [0,.15,1.5,3,4.5,6]){
    const f=lampCircuit(voltage,model),s=S.solve(f.d),light=V.lampLight(f.lamp,s.components[f.lamp.id]);
    assert(light.known);near(light.power,s.components[f.lamp.id].power);assert(light.brightness>previous);previous=light.brightness;
    const same=M.clone(f.d);same.components[0].params.polarity=-1;near(V.lampLight(same.components[1],S.solve(same).components[f.lamp.id]).brightness,light.brightness);
    for(const view of ['real','schematic']){f.d.display.view=view;const svg=V.scene(f.d,s);assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert(svg.includes('data-lamp-glass'));assert(svg.includes('data-power-known="true"'));}
    cases++;
  }
  const f=lampCircuit(12,model),r=S.solve(f.d);assert(V.lampLight(f.lamp,r.components[f.lamp.id]).overloaded);assert.equal(V.visualState(f.d,r).components[f.lamp.id],'overload');
}
{
  const f=lampCircuit(),unknown=V.lampLight(f.lamp,{power:null});assert.equal(unknown.known,false);assert.equal(unknown.power,null);
  // Bypassing a lamp, while another load limits the source, is not a source short.
  const load=M.add(f.d,'resistor',420,140);f.d.wires=[];M.connect(f.d,f.source.id+':a',load.id+':a',[],'free');M.connect(f.d,load.id+':b',f.lamp.id+':a',[],'free');M.connect(f.d,f.lamp.id+':b',f.source.id+':b',[],'free');M.connect(f.d,f.lamp.id+':a',f.lamp.id+':b',[],'free');
  const s=S.solve(f.d);near(s.components[f.lamp.id].power,0);assert.equal(V.lampLight(f.lamp,s.components[f.lamp.id]).brightness,0);assert.deepEqual(V.visualState(f.d,s),{wires:{},components:{},short:false,overload:false});cases++;
}
for(const resistance of [0,.2,2]){
  const d=M.empty(),source=M.add(d,'battery',300,240,{resistance});const w=M.connect(d,source.id+':a',source.id+':b',[],'free'),s=S.solve(d),hazards=V.visualState(d,s);assert(hazards.short);assert.equal(hazards.components[source.id],'short');assert.equal(hazards.wires[w.id],'short');
  if(resistance===0)assert.equal(s.components[source.id].current,null);else near(s.components[source.id].current,-6/resistance);
  const saved=D.decode(D.encode(d));assert.equal(V.visualState(saved,S.solve(saved)).short,true);M.detach(saved,w.id,'from');assert.equal(V.visualState(saved,S.solve(saved)).short,false);assert(!V.scene(saved,S.solve(saved)).includes('data-hazard-component'));M.validate(saved);cases++;
}
{
  const d=M.empty(),source=M.add(d,'battery',300,240,{voltage:0});M.connect(d,source.id+':a',source.id+':b',[],'free');assert.equal(V.visualState(d,S.solve(d)).short,false);
  const f=lampCircuit(6,'ideal'),load=f.lamp;load.type='resistor';load.params=R.defaults('resistor');load.params.resistance=.5;const s=S.solve(f.d);assert.equal(V.visualState(f.d,s).short,false);assert.equal(V.visualState(f.d,s).components[f.source.id],'overload');assert(Object.values(V.visualState(f.d,s).wires).every(x=>x==='overload'));cases++;
}
{
  const f=lampCircuit(),b2=M.add(f.d,'battery',650,240,{voltage:3});M.connect(f.d,f.source.id+':a',b2.id+':a',[],'free');M.connect(f.d,f.source.id+':b',b2.id+':b',[],'free');const s=S.solve(f.d);assert.equal(s.components[f.lamp.id].power,null);assert.equal(V.visualState(f.d,s).short,false);assert.equal(V.lampLight(f.lamp,s.components[f.lamp.id]).known,false);
  const d=M.empty(),battery=M.add(d,'battery',160,140),bypass=M.connect(d,battery.id+':a',battery.id+':b',[],'free'),goodSource=M.add(d,'battery',420,140),lamp=M.add(d,'lamp',660,340);M.connect(d,goodSource.id+':a',lamp.id+':a',[],'free');M.connect(d,lamp.id+':b',goodSource.id+':b',[],'free');const result=S.solve(d),hazards=V.visualState(d,result);near(result.components[lamp.id].power,3);assert.equal(hazards.components[lamp.id],undefined);assert.equal(hazards.wires[bypass.id],'short');cases++;
}
for(const view of ['real','schematic'])for(const type of ['ammeter','voltmeter'])for(const angle of [0,90,180,270])for(const scale of [.7,1,1.2]){
  const c=M.add(M.empty(),type,300,240);c.angle=angle;const ports=R.ports(c),labels=ports.map(p=>V.portLabel(c,p,scale,view)),bounds=view==='real'?R.meterHousingBounds(c):{left:c.x-35,right:c.x+35,top:c.y-35,bottom:c.y+35};
  for(let i=0;i<labels.length;i++){assert(!intersects(labels[i].box,bounds),'mark is outside meter frame');assert(labels[i].y<ports[i].y,'mark above terminal end');for(const p of ports)assert(!intersects(labels[i].box,{left:p.x-8,right:p.x+8,top:p.y-8,bottom:p.y+8}),'mark clears all sockets');for(let j=i+1;j<labels.length;j++)assert(!intersects(labels[i].box,labels[j].box),'three range marks separated');}
  assert(!V.body(c,null,{view,meters:'digital',values:true}).includes('接入'));assert(!V.body(c,{meterStatus:'missing-common'}, {view,meters:'analog',values:true}).includes('請接'));cases++;
}
for(const ends of [0,1,2]){
  const f=lampCircuit(),w=f.d.wires[0];w.via=[{x:50,y:140},{x:50,y:340}];w.length=900;for(let i=0;i<2-ends;i++)M.detach(f.d,w.id,i===0?'from':'to');const before=M.validate(f.d),original=D.encode(before),readings=S.solve(before).components,history=M.history(before),endpoints=M.endpoints(before),pairs=[w.from,w.to];
  history.change(d=>M.straightenWire(d,w.id));const straight=history.get(),wire=straight.wires.find(x=>x.id===w.id),a=endpoints.get(w.from),b=endpoints.get(w.to);assert.deepEqual([wire.from,wire.to],pairs);assert.deepEqual(wire.via,[]);near(G.length(G.route(straight,wire)),Math.hypot(a.x-b.x,a.y-b.y));assert.equal(wire.length,w.length);assert.deepEqual(S.solve(straight).components,readings);assert.deepEqual(straight.cables,before.cables);history.undo();assert.equal(D.encode(history.get()),original);history.redo();
  const restored=D.decode(D.encode(history.get()));assert.equal(D.encode(restored),D.encode(history.get()));const p=G.along(G.route(restored,wire),G.length(G.route(restored,wire))/2);M.bendWire(restored,w.id,p,0,25,110);M.validate(restored);const endpoint=M.endpoints(restored).get(wire.from);M.moveWireEnd(restored,w.id,'from',{x:endpoint.x+20,y:endpoint.y+20});M.validate(restored);assert(G.length(G.route(restored,restored.wires.find(x=>x.id===w.id)))<=wire.length+.05);cases++;
}
{
  const d=M.empty(),c=M.add(d,'battery',300,240),w=M.connect(d,c.id+':a',c.id+':b',[], 'free');assert(M.attach(d,w.id,'to',c.id+':a'));M.straightenWire(d,w.id);const restored=D.decode(D.encode(d));near(G.length(G.route(restored,w)),0);assert(M.attach(restored,w.id,'to',c.id+':b'));M.validate(restored);near(G.length(G.route(restored,restored.wires[0])),120);cases++;
}
console.log(`Circuit visual feedback: ${cases} physical brightness/hazard, actual TeX mark clearance, shortest-wire identity/history and production round-trip continuation cases passed.`);
module.exports={lampCircuit};
