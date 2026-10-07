'use strict';
const assert=require('node:assert/strict'),R=require('./component-registry'),M=require('./circuit-model'),S=require('./circuit-solver'),H=require('./circuit-relay-motion'),P=require('./presets'),D=require('./circuit-document'),V=require('./circuit-renderer'),Profile=require('./circuit-profile');
let groups=0;const test=(name,fn)=>{fn();console.log('✓ '+name);groups++;},near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function circuit(name='relay'){
  const doc=P.create(name),states=new Map();H.sync(states,doc);
  const solve=()=>S.solve(doc,states),tick=(seconds,trace=[])=>{for(let n=0;n<Math.round(seconds/.01);n++){const a=solve();H.advance(states,doc,a,.01);trace.push({state:{...states.get('c3')},analysis:solve()});}return solve();};
  return {doc,states,solve,tick};
}
test('five unlettered sockets rotate with the compact body',()=>{
  const {doc}=circuit(),c=doc.components[2];assert.equal(R.ports(c).length,5);
  assert(R.ports(c).every(p=>p.label.length>1));for(const angle of [0,90,180,270]){c.angle=angle;assert.equal(new Set(R.ports(c).map(p=>p.id)).size,5);assert(R.ports(c).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
  c.angle=0;const contacts=R.ports(c).filter(p=>['c','d','e'].includes(p.key));assert(contacts.every(p=>p.x>c.x));assert.equal(new Set(contacts.map(p=>p.x)).size,1);assert(contacts.find(p=>p.key==='d').y<contacts.find(p=>p.key==='c').y);assert(contacts.find(p=>p.key==='c').y<contacts.find(p=>p.key==='e').y);
});
test('separate control and load loops solve with signed branch currents',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;const a=x.solve();near(a.components.c3.current,.05);near(a.components.c3.contactCurrent,.5);near(a.components.c5.power,3);near(a.components.c6.power,0);
  assert.notEqual(a.islandOf['c3:a'],a.islandOf['c3:c']);assert.equal(a.voltage('c3:a','c3:c'),null);assert.equal(a.diagnostics.length,0);
  x.doc.components[0].params.polarity=-1;near(x.solve().components.c3.current,-.05);x.tick(.2);assert.equal(x.states.get('c3').contact,'e');
});
test('pickup waits, opens both contacts in transit, then changes the lamp',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;x.tick(.11);assert.equal(x.states.get('c3').contact,'d');
  const a=x.tick(.03);assert.equal(a.components.c3.contact,null);assert(x.states.get('c3').position>0&&x.states.get('c3').position<1);near(a.components.c5.current,0);near(a.components.c6.current,0);
  const b=x.tick(.06);assert.equal(b.components.c3.contact,'e');near(b.components.c3.current,.05);near(b.components.c3.contactCurrent,.5);near(b.components.c5.power,0);near(b.components.c6.power,3);
  assert.equal(b.components.c3.branches.filter(e=>e.from==='c3:c').length,1);
});
test('release is delayed and current hysteresis preserves an energized relay',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;x.tick(.2);x.doc.components[0].params.voltage=3;x.tick(.5);assert.equal(x.states.get('c3').contact,'e');
  x.doc.components[0].params.voltage=1;x.tick(.11);assert.equal(x.states.get('c3').contact,'e');x.tick(.09);assert.equal(x.states.get('c3').contact,'d');
  x.doc.components[0].params.voltage=3;x.tick(.5);assert.equal(x.states.get('c3').contact,'d');
});
test('slow foreground frames release on actual elapsed time and re-solve each contact change',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;x.tick(.2);assert.equal(x.states.get('c3').contact,'e');x.doc.components[1].params.closed=false;
  let result=H.advanceFrame(x.states,x.doc,x.solve(),.11,x.solve);assert.equal(result.result.components.c3.contact,'e');result=H.advanceFrame(x.states,x.doc,result.result,.09,x.solve);assert.equal(result.result.components.c3.contact,'d');near(result.result.components.c3.position,0);near(result.result.components.c5.power,3);near(result.result.components.c6.power,0);
  x.doc.components[1].params.closed=true;H.advanceFrame(x.states,x.doc,x.solve(),1,x.solve);assert.equal(x.states.get('c3').contact,'e');x.doc.components[0].params.voltage=0;H.advanceFrame(x.states,x.doc,x.solve(),1,x.solve);assert.equal(x.states.get('c3').contact,'d');
  const bell=circuit('relayBell');bell.doc.components[1].params.closed=true;let solves=0;H.advanceFrame(bell.states,bell.doc,bell.solve(),1,()=>{solves++;return bell.solve();});assert(solves>=8,'self-interruption must use intermediate topology, not a frozen old current');
});
test('a pulse shorter than the delay cancels without false pickup',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;x.tick(.08);x.doc.components[1].params.closed=false;x.tick(.5);assert.equal(x.states.get('c3').position,0);assert.equal(x.states.get('c3').waiting,0);
});
test('self-interruption oscillates through both positions and never bridges contacts',()=>{
  const x=circuit('relayBell');x.doc.components[1].params.closed=true;const trace=[];x.tick(2,trace);
  assert(trace.filter((t,i)=>i&&t.state.contact==='e'&&trace[i-1].state.contact!=='e').length>=4);
  assert(trace.some(t=>t.state.contact===null&&t.state.position>0&&t.state.position<1));
  for(const t of trace){const r=t.analysis.components.c3;assert(r.branches.filter(b=>b.from==='c3:c').length<=1);if(t.state.contact==='e'){near(r.current,0);near(t.analysis.components.c4.power,3);}if(t.state.contact===null){near(r.current,0);near(r.contactCurrent,0);}}
});
test('pause, unknown current, long frame clamp and independent relays are safe',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;x.tick(.14);const before=M.clone(x.states.get('c3'));H.advance(x.states,x.doc,x.solve(),0);assert.deepEqual(x.states.get('c3'),before);
  const unknown=x.solve();unknown.components.c3.current=null;H.advance(x.states,x.doc,unknown,.04);near(x.states.get('c3').position,before.position);
  const second=M.add(x.doc,'relay',1000,700);H.sync(x.states,x.doc);x.tick(.06);assert.equal(x.states.get(second.id).position,0);assert.equal(x.states.get('c3').position,1);
  const rest=new Map();H.sync(rest,x.doc);H.advance(rest,x.doc,x.solve(),10);assert.equal(rest.get('c3').contact,'d');assert(rest.get('c3').waiting<=.05);
});
test('real and schematic current paths follow only coil and closed armature',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;
  for(const view of ['real','schematic']){x.doc.display.view=view;for(const state of [{position:0,contact:'d'},{position:.5,contact:null},{position:1,contact:'e'}]){Object.assign(x.states.get('c3'),state);const a=x.solve(),paths=V.componentFlowPaths(x.doc,a).filter(p=>p.component==='c3');assert.equal(paths.length,state.contact?2:1);assert(paths.some(p=>p.key==='coil'&&p.from==='c3:a'&&p.to==='c3:b'));if(state.contact)assert(paths.some(p=>p.key==='contact'&&p.to==='c3:'+state.contact));const out=V.body(x.doc.components[2],a.components.c3,x.doc.display);assert(out.includes('data-relay-armature'));assert(out.includes('data-relay-coil'));assert(!out.includes('>A<')&&!out.includes('>B<'));}}
});
test('dynamic contact hazards use the actual state rather than the resting contact',()=>{
  const doc=M.empty(),source=M.add(doc,'battery',100,100),c=M.add(doc,'relay',300,200);M.connect(doc,source.id+':a',c.id+':c',[],'free');M.connect(doc,c.id+':e',source.id+':b',[],'free');
  const states=new Map();H.sync(states,doc);assert(!V.visualState(doc,S.solve(doc,states)).short);Object.assign(states.get(c.id),{contact:'e',position:1});assert(V.visualState(doc,S.solve(doc,states)).short);
});

test('coil back turns are occluded without shortening current travel; armature clears the core',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;const a=x.solve(),coil=V.componentFlowPaths(x.doc,a).find(p=>p.component==='c3'&&p.key==='coil');
  assert.equal(coil.hidden.length,7);assert(coil.track.split('M').length>6);
  for(let phase=0;phase<65;phase+=3){const offsets=new Map([[coil.id,phase]]),svg=V.flow(x.doc,a,{},0,1,offsets),group=svg.match(/<g data-flow-component="c3" data-flow-path="coil"[^>]*>(.*?)<\/g>/s)[1];assert(group.includes(`d="${coil.track}"`));for(const m of group.matchAll(/data-flow-distance="([^"]+)"/g))assert(!coil.hidden.some(([lo,hi])=>+m[1]>lo&&+m[1]<hi));}
  const realPoints=coil.points;x.doc.display.view='schematic';const symbolic=V.componentFlowPaths(x.doc,a).find(p=>p.component==='c3'&&p.key==='coil');assert.deepEqual(symbolic.points,realPoints);assert.equal(symbolic.hidden,undefined);
  x.doc.display.view='real';const tips=[];for(let n=0;n<=20;n++){const svg=V.body(x.doc.components[2],{...a.components.c3,position:n/20},x.doc.display),line=svg.match(/data-relay-armature="true" d="([^"]+)"/)[1],coords=line.match(/-?\d+(?:\.\d+)?/g).map(Number),slope=(coords[3]-coords[1])/(coords[2]-coords[0]);assert(coords[1]+(13-coords[0])*slope+2.25*Math.sqrt(1+slope*slope)<-4.5,'armature edge must stay above the entire top ellipse');near(coords[1]+(-50-coords[0])*slope,-15);tips.push(coords[3]);assert(svg.indexOf('data-relay-coil-back')<svg.indexOf('data-relay-core='));assert(svg.indexOf('data-relay-core=')<svg.indexOf('data-relay-coil='));}near(tips.at(-1)-tips[0],12);
  assert.equal(Profile.compile({role:'teacher'}).ui.playback,true);assert.equal(Profile.compile({role:'student'}).ui.playback,false);assert.equal(Profile.compile({role:'student',ui:{playback:true}}).ui.playback,true);
});
test('production round trip resets motion and permits a legal continuation',()=>{
  const x=circuit();x.doc.components[1].params.closed=true;x.tick(.2);const saved=D.encode(x.doc),restored=D.decode(saved),states=new Map();H.sync(states,restored);assert.equal(states.get('c3').contact,'d');assert.deepEqual(restored,x.doc);
  for(let n=0;n<20;n++)H.advance(states,restored,S.solve(restored,states),.01);assert.equal(states.get('c3').contact,'e');M.remove(restored,'c3');H.sync(states,restored);assert.equal(states.size,0);
  for(const [key,value]of [['delay',0],['resistance',-1],['pickupCurrent',NaN]]){const bad=M.clone(x.doc);bad.components[2].params[key]=value;assert.throws(()=>M.validate(bad));}
});
test('trusted student parameters, stock and read-only apply to relay additions',()=>{
  const x=circuit(),profile=Profile.compile({role:'student',initialDocument:x.doc,palette:[{type:'relay',limit:1}],components:{byType:{relay:{params:['delay']}}}});
  assert(!profile.canAdd(profile.palette[0],x.doc));assert(profile.allows(x.doc,x.doc.components[2],'params','delay'));assert(!profile.allows(x.doc,x.doc.components[2],'params','resistance'));assert(!profile.allows(x.doc,x.doc.components[2],'params','delay',true));
});
console.log(`Relay: ${groups} focused groups passed.`);
