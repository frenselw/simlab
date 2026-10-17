'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),S=require('./circuit-solver'),T=require('./circuit-transient'),O=require('./circuit-observation'),V=require('./circuit-renderer'),D=require('./circuit-document'),C=require('./circuit-household-components'),H=require('./household-model'),F=require('./circuit-profile');
const close=(a,b)=>assert(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-24,Math.abs(b)*1e-7),`${a} != ${b}`);
const storageClose=(a,b)=>{assert.deepEqual(Object.keys(a),Object.keys(b));for(const id of Object.keys(a))for(const key of ['i','v'])close(a[id][key],b[id][key]);};
const link=(d,a,b,ap='a',bp='a')=>M.connect(d,a.id+':'+ap,b.id+':'+bp);

// DC-01/02: independent heat-balance root, including nanoampere KCL and power balance.
for(const voltage of [.001,.01,1,6])for(const resistance of [.02,12,1e6])for(const ratedVoltage of [.1,6]){
 const d=M.empty(),b=M.add(d,'battery',0,0,{voltage,resistance:0}),lamp=M.add(d,'lamp',200,0,{model:'thermal',resistance,ratedVoltage,coldRatio:10,linearLoss:.1});link(d,b,lamp);link(d,b,lamp,'b','b');
 let lo=293,hi=2600;const cold=resistance/10,r=t=>cold*(1+9*(t-293)/(2600-293)),loss=t=>ratedVoltage**2/resistance*(.1*(t-293)/(2600-293)+.9*(t**4-293**4)/(2600**4-293**4));
 while(loss(hi)<voltage**2/r(hi))hi*=2;
 for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(loss(mid)<voltage**2/r(mid))lo=mid;else hi=mid;}
 const expected=voltage/r((lo+hi)/2),a=S.solve(d);assert.deepEqual(a.diagnostics,[]);close(a.components[lamp.id].current,expected);close(-a.components[b.id].current,expected);close(a.components[b.id].sourcePower,a.components[lamp.id].power);
 for(const w of d.wires)close(Math.abs(a.wires[w.id].current),expected);
}

// AC-01: an electrically invalid wire probe cannot sample or be imported.
{
 const d=M.empty('transient'),b=M.add(d,'ac-source',0,0,{frequency:1}),r=M.add(d,'resistor',200,0),w=link(d,b,r);link(d,b,r,'b','b');const s=new T.Session(d);s.advance(.25);
 const tool={id:'scope-audit',kind:'voltage',x:32,y:0,width:300,height:200,range:10,span:1,probes:[{target:{kind:'wire',id:w.id,fraction:.5},position:{x:100,y:0},bends:[]},{target:{kind:'endpoint',id:b.id+':b'},position:{x:0,y:0},bends:[]}]};
 assert(O.signal(tool,s.read(),d)>8);w.resistance=12;s.update(d);assert(!O.targetValid(tool.probes[0].target,'voltage',d));assert.equal(O.signal(tool,s.read(),d),null);assert.equal(O.validateTools([tool],d,{ui:{waveform:true},observationLimit:2,observationChannels:null}),null);
 tool.probes[0].target={kind:'endpoint',id:r.id+':a'};close(O.signal(tool,s.read(),d),s.read().components[r.id].voltage);
}

// AC-02: unrelated excitation cannot erase an isolated capacitor's displayed storage.
for(const voltage of [6,230]){
 const d=M.empty('transient'),c=M.add(d,'capacitor',0,0,{capacitance:.02,initialVoltage:.01});M.add(d,'ac-source',300,0,{voltage,frequency:1});const s=new T.Session(d);s.advance(2);const a=s.read(),view=V.displayComponent(d,a,c);
 for(const key of ['voltage','charge','energy'])close(view[key],a.components[c.id][key]);assert(view.fieldVoltage>0);assert(view.energy>0);
 const bars=new (require('./circuit-ac-display').Readouts)();assert.equal(bars.data(c,'voltage',view.voltage,'V',{doc:d,result:view}).value,view.voltage);
}

// AC-03: floating and singly connected wires preserve RC/RL/LC storage and continuation.
for(const kind of ['RC','RL','LC']){
 const d=M.empty('transient'),c=M.add(d,kind==='RL'?'inductor':'capacitor',300,0,kind==='RL'?{inductance:1,resistance:0}:{capacitance:.02,initialVoltage:kind==='LC'?6:0}),r=M.add(d,kind==='LC'?'inductor':'resistor',100,0,kind==='LC'?{inductance:1,resistance:0}:{resistance:5});
 if(kind==='LC'){link(d,c,r);link(d,c,r,'b','b');}else{const b=M.add(d,'battery',-100,0);link(d,b,r);link(d,r,c,'b','a');link(d,c,b,'b','b');}
 const s=new T.Session(d);s.advance(.1);const before=M.clone(s.state.dynamic),time=s.state.time;
 const next=M.clone(s.doc),w=M.addWire(next,500,100);assert.equal(s.update(next),'event');assert.equal(s.state.time,time);storageClose(s.state.dynamic,before);
 const attached=M.clone(s.doc);assert(M.attach(attached,w.id,'from',c.id+':a'));s.update(attached);assert.equal(s.state.time,time);storageClose(s.state.dynamic,before);
 const restored=T.Session.restore(JSON.parse(JSON.stringify(s.capture())));s.advance(.01);restored.advance(.01);storageClose(restored.state.dynamic,s.state.dynamic);assert.equal(s.fault,null);
 const changed=M.clone(s.doc);changed.components.find(x=>x.id===c.id).params[kind==='RL'?'inductance':'capacitance']*=2;s.update(changed);assert.notDeepEqual(s.state.dynamic,before,'changed storage still resets');
}

// H-02/04: rotate an inserted plug, undo/save/reload, and reject every loose-pin entry.
{
 const d=M.empty('household');d.cables.length=1200;const source=M.add(d,'house-mains',-200,0),socket=M.add(d,'house-socket',0,0),strip=M.add(d,'house-power-strip',300,150),load=M.add(d,'house-insulated',500,250,{kind:'dryer'});
 for(const p of ['l','n']){link(d,source,socket,p,p);link(d,strip,load,p+'1',p);}
 const inserted=C.previewPlug(d,strip.id,{x:0,y:0},24).doc,contacts=C.plugContacts(inserted),history=M.history(inserted),initialPower=new H.Session(inserted).read().components[load.id].power;
 for(let i=0;i<8;i++){history.change(doc=>M.rotateComponent(doc,socket.id));assert.deepEqual(C.plugContacts(history.get()),contacts);close(new H.Session(history.get()).read().components[load.id].power,initialPower);}
 assert(history.undo());assert(history.redo());const saved=D.decode(D.encode(history.get()));assert.deepEqual(C.plugContacts(saved),contacts);const restored=H.Session.restore(H.decode(H.encode(new H.Session(saved).capture())));restored.advance(.01);assert(restored.read().components[load.id].working);
 const before=M.clone(saved),w=M.addWire(saved,500,100);
 for(const pin of ['pl','pn','pe']){const endpoint=strip.id+':'+pin;assert(!M.wireEndpoints(saved).has(endpoint));assert.throws(()=>M.connect(saved,source.id+':l',endpoint));assert.equal(M.attach(saved,w.id,'to',endpoint),false);const bad=M.clone(saved);bad.wires.at(-1).to=endpoint;assert.throws(()=>M.validate(bad));assert.throws(()=>D.decode(JSON.stringify(bad)));}
 assert.deepEqual(saved.components,before.components);
 const limited=M.clone(inserted),wire=limited.wires[0];limited.components.find(c=>c.id===source.id).x=200;wire.via=[];wire.shape='free';wire.length=require('./circuit-routing').length(require('./circuit-routing').route(limited,wire));const original=M.clone(limited);assert.throws(()=>M.rotateComponent(limited,socket.id,1));assert.deepEqual(limited,original,'a rejected rotation is atomic');
}

// Configuration-01: both creating and breaking direct hand contact are wiring changes.
for(const contact of [false,true]){
 const d=M.empty('household'),source=M.add(d,'house-mains',0,0),person=M.add(d,'house-person',300,200),target=M.endpoints(d).get(source.id+':l');
 if(contact){const hand=C.hand(person);person.x+=target.x-hand.x;person.y+=target.y-hand.y;}
 const f=F.compile({role:'teacher',analysis:'household',initialDocument:d,palette:C.palette,wires:false}),next=M.clone(d),p=next.components.find(c=>c.id===person.id),hand=C.hand(p);
 if(contact)p.x+=20;else{p.x+=target.x-hand.x;p.y+=target.y-hand.y;}
 assert.throws(()=>f.assertSnapshot(next),/手部接觸/);assert.throws(()=>f.assertTransition(d,next),/手部接觸/);const moved=M.clone(d);moved.components.find(c=>c.id===person.id).y+=100; if(!contact)assert.doesNotThrow(()=>f.assertTransition(d,moved));
}
console.log('2026-10-17 audit: DC heat/KCL, probe validity, isolated charge, RC/RL/LC continuation, plug rotation/pins and no-wiring hand contacts passed');
