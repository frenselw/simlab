"use strict";
const assert=require("node:assert/strict"),M=require("./circuit-model"),R=require("./component-registry"),S=require("./circuit-solver"),D=require("./circuit-document"),G=require("./circuit-routing"),V=require("./circuit-renderer"),P=require("./presets"),{XMLValidator}=require("fast-xml-parser");
const near=(a,b,msg,eps=1e-7)=>assert(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),`${msg}: ${a} != ${b}`);
function dualFixture(type,port='a',internal=0){const d=M.empty(),b=M.add(d,'battery',100,100,{voltage:type==='ammeter'?3:1.5}),load=M.add(d,'resistor',400,100,{resistance:10}),meter=M.add(d,type,260,300,{resistance:internal});
 if(type==='ammeter'){M.connect(d,b.id+':a',meter.id+':'+port,[],'free');M.connect(d,meter.id+':b',load.id+':a',[],'free');}else{M.connect(d,b.id+':a',load.id+':a',[],'free');M.connect(d,meter.id+':'+port,load.id+':a',[],'free');M.connect(d,meter.id+':b',load.id+':b',[],'free');}M.connect(d,load.id+':b',b.id+':b',[],'free');
 // Rotation fixtures have finite slack for the longer path around both casings.
 d.wires.forEach(w=>w.length=1000);return {d,b,load,meter};}

// Prepared classroom diagrams must be visually unambiguous as well as electrical.
function segmentCross(a,b,c,d){const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,det=ux*vy-uy*vx;
 if(Math.abs(det)<1e-9){if(Math.abs((c.x-a.x)*uy-(c.y-a.y)*ux)>1e-7)return null;const axis=Math.abs(ux)>Math.abs(uy)?'x':'y',lo=Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis])),hi=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]));return hi-lo>1e-6?{overlap:true}:null;}
 const t=((c.x-a.x)*vy-(c.y-a.y)*vx)/det,u=((c.x-a.x)*uy-(c.y-a.y)*ux)/det;return t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8?{x:a.x+t*ux,y:a.y+t*uy}:null;
}
function outsideMeter(d,w,c){const p=G.route(d,w),total=G.length(p),box=R.bodyBounds({...c,angle:0,x:0,y:0}),{cos,sin}=R.rotation(c.angle);for(let distance=0;distance<=total;distance+=2){const world=G.along(p,distance),q={x:(world.x-c.x)*cos+(world.y-c.y)*sin,y:-(world.x-c.x)*sin+(world.y-c.y)*cos};
 if(distance<=24&&w.from.startsWith(c.id+':')||total-distance<=24&&w.to.startsWith(c.id+':'))continue;
 assert(!(q.x>box.left+.1&&q.x<box.right-.1&&q.y>box.top+.1&&q.y<box.bottom-.1),`${c.type} ${c.angle} ${c.id} cable ${w.id} enters the rotated housing at ${distance}/${total}: ${JSON.stringify(q)}`);
}}
for(const name of ['series','parallel','mixed','ammeter','voltmeter','ohm','meters','bridge','limiting','divider','gAmmeter','gVoltmeter']){const d=P.create(name),routes=d.wires.map(w=>G.route(d,w)),ends=M.endpoints(d);
 assert.deepEqual(D.decode(D.encode(d)),d,'every authored example survives production encoding');assert.deepEqual(S.solve(d).diagnostics,[],'every example has a reliable solution');
 for(let i=0;i<routes.length;i++){const p=routes[i],w=d.wires[i];assert(G.length(p)<=w.length+.05);for(const key of ['x','y']){near(p[0][key],ends.get(w.from)[key],'prepared from '+key);near(p.at(-1)[key],ends.get(w.to)[key],'prepared to '+key);}
  for(let a=1;a<p.length;a++)for(let b=a+2;b<p.length;b++)assert(!segmentCross(p[a-1],p[a],p[b-1],p[b]),`${name} ${w.id} has a self crossing`);
  for(let j=i+1;j<routes.length;j++)for(let a=1;a<p.length;a++)for(let b=1;b<routes[j].length;b++){const q=segmentCross(p[a-1],p[a],routes[j][b-1],routes[j][b]);if(!q)continue;assert(!q.overlap,`${name} duplicates a bus segment`);
   const shared=[w.from,w.to].filter(id=>[d.wires[j].from,d.wires[j].to].includes(id));if(shared.some(id=>Math.hypot(q.x-ends.get(id).x,q.y-ends.get(id).y)<1e-5))continue;
   assert.fail(`${name} has an unnecessary crossing at ${JSON.stringify(q)}`);
  }
  d.components.filter(R.dualMeter).forEach(c=>outsideMeter(d,w,c));
  const total=G.length(p);
  for(let distance=0;distance<=total;distance+=2){const q=G.along(p,distance);for(const c of d.components){
   if(distance<=24&&w.from.startsWith(c.id+':')||total-distance<=24&&w.to.startsWith(c.id+':'))continue;
   const local={...c,x:0,y:0,angle:0},box=R.dualMeter(c)||c.type==='wattmeter'?R.meterHousingBounds(local):R.bodyBounds(local),{cos,sin}=R.rotation(c.angle),at={x:(q.x-c.x)*cos+(q.y-c.y)*sin,y:-(q.x-c.x)*sin+(q.y-c.y)*cos};
   assert(!(at.x>box.left+.1&&at.x<box.right-.1&&at.y>box.top+.1&&at.y<box.bottom-.1),`${name} ${w.id} crosses ${c.label} at ${JSON.stringify(q)}`);
  }}
 }
}
assert(P.groups.find(g=>g.label==='電路基礎').keys.includes('ammeter'));
assert(P.groups.find(g=>g.label==='電路基礎').keys.includes('voltmeter'));
for(const name of ['ammeter','voltmeter']){
 const d=D.decode(D.encode(P.create(name))),meter=d.components.find(c=>c.type===name),lamp=d.components.find(c=>c.type==='lamp'),sw=d.components.find(c=>c.type==='switch'),result=S.solve(d);
 near(result.components[meter.id].reading,name==='ammeter'?.5:6,`${name} correct signed reading`);
 near(result.components[lamp.id].power,3,`${name} leaves the lamp powered`);
 if(name==='ammeter'){
  meter.params.resistance=2;near(S.solve(d).components[meter.id].reading,6/14,'series ammeter burden');
 }else{
  meter.params.resistance=12;near(S.solve(d).components[meter.id].reading,6,'parallel voltmeter keeps the load voltage');near(S.solve(d).components[lamp.id].power,3,'voltmeter forms an independent parallel branch');
 }
 sw.params.closed=false;const off=S.solve(M.validate(d));near(off.components[meter.id].reading,0,'restored example can open the switch');near(off.components[lamp.id].power,0,'open switch turns the lamp off');
}
for(const closed of [[true,true],[true,false],[false,true],[false,false]]){
 const d=D.decode(D.encode(P.create('parallel'))),lamps=d.components.filter(c=>c.type==='lamp'),[master,...switches]=d.components.filter(c=>c.type==='switch');
 assert.equal(lamps.length,2);assert.equal(switches.length,2);
 switches.forEach((c,i)=>c.params.closed=closed[i]);const result=S.solve(M.validate(d));
 near(result.components[master.id].current,closed.filter(Boolean).length*.5,'trunk current equals the sum of the active branches');
 lamps.forEach((c,i)=>{near(result.components[c.id].current,closed[i]?.5:0,'each switch only disconnects its own branch');near(result.components[c.id].power,closed[i]?3:0,'the other parallel lamp retains its power');});
 master.params.closed=false;const off=S.solve(M.validate(d));lamps.forEach(c=>near(off.components[c.id].power,0,'master switch turns both lamps off'));
}
{
 const d=D.decode(D.encode(P.create('mixed'))),lamps=d.components.filter(c=>c.type==='lamp'),result=S.solve(d);
 assert.equal(lamps.length,3);assert(!d.components.some(c=>['switch','resistor'].includes(c.type)),'mixed example has lamps and no branch switches');
 near(result.components[lamps[0].id].current,1/3,'mixed trunk current');lamps.slice(1).forEach(c=>near(result.components[c.id].current,1/6,'mixed branch current'));
 const lights=lamps.map(c=>V.lampLight(c,result.components[c.id]).brightness);assert(lights[0]>lights[1]);near(lights[1],lights[2],'identical mixed branch lamps have equal brightness');
}
{
 const d=D.decode(D.encode(P.create('bridge'))),[top,bottom,left,right]=d.junctions,meter=d.components.find(R.dualMeter);
 assert.equal(top.x,bottom.x);assert.equal(left.y,right.y);assert(top.y<left.y&&bottom.y>left.y&&left.x<top.x&&right.x>top.x,'bridge has four diamond vertices');
 const rheostat=d.components.find(c=>c.type==='rheostat');assert.equal(d.components.filter(c=>c.type==='resistor').length,3);assert.equal(rheostat.params.terminals,2);assert.deepEqual(R.ports(rheostat).map(p=>p.key),['a','b']);near(R.effectiveResistance(rheostat),20,'bridge starts with a 20 ohm effective resistance');
 assert.deepEqual(d.components.filter(c=>['resistor','rheostat'].includes(c.type)).map(c=>c.angle),[315,45,45,315]);for(const w of d.wires.slice(1,9).filter(w=>!w.from.startsWith('c1:')&&!w.to.startsWith('c1:'))){const points=G.route(d,w),a=points[0],b=points.at(-1);near(Math.abs(a.x-b.x),Math.abs(a.y-b.y),'straight 45 degree bridge arm');assert(points.length===2);}near(S.solve(d).components[meter.id].reading,0,'diamond starts balanced');const currents=[];
 assert.equal(S.solve(d).components[meter.id].activePort,'c');near(S.solve(d).components[meter.id].range,.6,'bridge uses the 0.6 A socket');
 for(const position of [.25,.75,.5]){rheostat.params.position=position;const restored=D.decode(D.encode(M.validate(d)));currents.push(S.solve(restored).components[meter.id].reading);assert.equal(restored.components.find(c=>c.type==='rheostat').params.position,position,'slider position survives production round trip');}
 assert(currents[0]*currents[1]<0&&Math.abs(currents[0])>.01&&Math.abs(currents[1])>.01,'slider movement to either side reverses bridge current');near(currents[2],0,'returning the slider restores balance');
}
{
 const d=P.create('meters'),result=S.solve(d),w=d.components.find(c=>c.type==='wattmeter'),lamp=d.components.find(c=>c.type==='lamp'),a=d.components.find(c=>c.type==='ammeter'),v=d.components.find(c=>c.type==='voltmeter');
 near(result.components[w.id].reading,result.components[lamp.id].power,'supply-side ideal wattmeter reads lamp power');near(result.components[a.id].reading,.5,'series current');near(result.components[v.id].reading,6,'voltmeter measures the lamp');
 w.params.resistance=2;const burden=S.solve(d);near(burden.components[w.id].reading,burden.components[lamp.id].power+burden.components[w.id].current**2*2,'supply-side sensing includes added current-coil dissipation');
}
const ohmExample=P.create('ohm');ohmExample.components.find(c=>c.type==='ammeter').params.resistance=1;const ohmResult=S.solve(ohmExample);near(ohmResult.components.c2.reading,6/13,'Ohm example includes the ammeter burden');near(ohmResult.components.c4.reading,ohmResult.voltage('c1:a','c1:b'),'terminal voltmeter measures the source terminals with finite A resistance');near(ohmResult.components.c4.reading,66/13,'terminal voltage includes all external drops');
for(const type of ['ammeter','voltmeter'])for(const port of ['a','c'])for(const view of ['real','schematic']){
 const f=dualFixture(type,port),baseResult=S.solve(f.d);f.d.display.view=view;const original=M.clone(f.d);let rotations=0;
 for(const angle of [45,90,135,180,225,270,315,0]){const before=M.clone(f.d),c=f.d.components.find(c=>c.id===f.meter.id);c.angle=angle;assert(M.reconcile(f.d,before),`${type} ${port} turns to ${angle}`);M.validate(f.d);
  for(const w of f.d.wires){outsideMeter(f.d,w,c);const p=G.route(f.d,w),key=w.from.startsWith(c.id+':')?'from':w.to.startsWith(c.id+':')?'to':null;if(!key){assert.deepEqual(w,before.wires.find(v=>v.id===w.id),'rotation cannot rearrange unrelated cables');continue;}
   const src=key==='from'?p:[...p].reverse(),terminal=R.ports(c).find(p=>p.id===w[key]),next=G.along(src,6);near(next.x,terminal.x+terminal.dx*6,'socket lead x');near(next.y,terminal.y+terminal.dy*6,'socket lead y');
  }
  near(S.solve(f.d).components[c.id].reading,baseResult.components[c.id].reading,'socket rotation keeps signed reading/range');assert.deepEqual(D.decode(D.encode(f.d)),f.d);
  for(const meters of ['digital','analog']){const svg=V.scene({...f.d,display:{...f.d.display,meters}},S.solve(f.d));assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);const lastBody=Math.max(...f.d.components.map(c=>svg.indexOf(`data-component="${c.id}"`)));for(const w of f.d.wires){assert(svg.indexOf(`data-wire="${w.id}"`)>lastBody,'entire cable stays above every housing');assert(svg.includes(`d="${G.path(G.route(f.d,w))}"`),'foreground cable follows the actual endpoint route');}}
  rotations++;
 }assert.equal(rotations,8);assert.deepEqual(f.d.wires.map(w=>[w.from,w.to,w.length]),original.wires.map(w=>[w.from,w.to,w.length]));
}
const tautMeter=dualFixture('ammeter').d,tautWire=tautMeter.wires[1];tautWire.length=G.length(G.route(tautMeter,tautWire));const tautHistory=M.history(tautMeter),tautBefore=D.encode(tautHistory.get());assert.throws(()=>tautHistory.change(d=>{const before=M.clone(d);d.components[2].angle=90;if(!M.reconcile(d,before))throw Error('finite connector reach');}));assert.equal(D.encode(tautHistory.get()),tautBefore,'a short cable refuses a turn atomically');
const translated=dualFixture('ammeter').d,translationBefore=M.clone(translated);translated.components[2].x+=240;translated.components[2].y+=20;assert(M.reconcile(translated,translationBefore),'normal meter movement retains its original deformation');
const translatedEnds=M.endpoints(translated);for(const w of translated.wires){const previous=translationBefore.wires.find(v=>v.id===w.id),expected=G.deform(G.route(translationBefore,previous),translatedEnds.get(w.from),translatedEnds.get(w.to),w.length);assert.deepEqual(w.via,expected.slice(1,-1));}
for(const name of ['ohm','meters','bridge'])for(const id of P.create(name).components.filter(R.dualMeter).map(c=>c.id)){
 const d=P.create(name),c=d.components.find(c=>c.id===id),ids=d.wires.map(w=>[w.from,w.to,w.length]),reading=S.solve(d).components[id].reading;
 for(let n=0;n<12;n++){const before=M.clone(d);c.angle=(c.angle+90)%360;assert(M.reconcile(d,before),`${name} ${id} continuous turn ${n}`);M.validate(d);d.wires.forEach(w=>outsideMeter(d,w,c));assert.deepEqual(d.wires.map(w=>[w.from,w.to,w.length]),ids);near(S.solve(d).components[id].reading,reading,'repeated rotation preserves the reading');}
}
const farDoc=P.create('meters'),farMeter=farDoc.components.find(c=>c.type==='ammeter'),farWire=farDoc.wires.find(w=>w.to===farMeter.id+':a'),farPoints=G.route(farDoc,farWire).filter(p=>Math.max(Math.abs(p.x-farMeter.x),Math.abs(p.y-farMeter.y))>240);
for(let n=0;n<12;n++){const before=M.clone(farDoc);farMeter.angle=(farMeter.angle+90)%360;assert(M.reconcile(farDoc,before));const p=G.route(farDoc,farWire);farPoints.forEach(q=>assert(G.nearest(p,q).distance<.05,'rotation preserves the distant cable shape'));}
for(const type of ['ammeter','voltmeter']){const d=M.empty(),c=M.add(d,type,260,300),w=M.connect(d,c.id+':a',c.id+':b',[],'free');for(let n=0;n<4;n++){const before=M.clone(d);c.angle=(c.angle+90)%360;assert(M.reconcile(d,before),'a cable joining two sockets on the same meter rotates');M.validate(d);outsideMeter(d,w,c);}}
for(const view of ['real','schematic'])for(const values of [true,false]){const d=P.create('meters');Object.assign(d.display,{view,values});const saved=D.encode(d),result=S.solve(d),viewport={x:0,y:0,width:320/.22,height:360/.22};const small=V.scene(d,result,.22,{},null,false,viewport);assert.equal(XMLValidator.validate('<svg>'+small+'</svg>'),true);assert(small.includes('data-overview-caption'));assert(!small.includes('data-component-label'));assert.equal((small.match(/data-overview-readout=/g)||[]).length,values?3:0);assert.equal(D.encode(d),saved,'overview stays out of the authoritative circuit');const enlarged=V.scene(d,result,.5,{},null,false,viewport);assert(!enlarged.includes('data-overview-caption'));assert.equal((enlarged.match(/data-component-label=/g)||[]).length,d.components.length,'zoom restores all component labels');}
console.log('Classroom diagrams: no wire/body crossings or duplicate buses, independent branch switches and lamp brightness, series A/parallel V, diamond bridge, supply-side W, restore/continuation, rotated sockets and finite reach passed.');
