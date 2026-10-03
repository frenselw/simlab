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
function outsideMeter(d,w,c){const p=G.route(d,w),total=G.length(p),box=R.bodyBounds(c);for(let distance=0;distance<=total;distance+=2){const q=G.along(p,distance);
 if(distance<=24&&w.from.startsWith(c.id+':')||total-distance<=24&&w.to.startsWith(c.id+':'))continue;
 assert(!(q.x>box.left+.1&&q.x<box.right-.1&&q.y>box.top+.1&&q.y<box.bottom-.1),`${c.type} ${c.angle} ${c.id} cable ${w.id} enters the rotated housing at ${distance}/${total}: ${JSON.stringify(q)}`);
}}
for(const name of ['series','parallel','mixed','ohm','meters','bridge']){const d=P.create(name),routes=d.wires.map(w=>G.route(d,w)),ends=M.endpoints(d);let crossings=0;
 assert.deepEqual(D.decode(D.encode(d)),d,'every authored example survives production encoding');assert.deepEqual(S.solve(d).diagnostics,[],'every example has a reliable solution');
 for(let i=0;i<routes.length;i++){const p=routes[i],w=d.wires[i];assert(G.length(p)<=w.length+.05);for(const key of ['x','y']){near(p[0][key],ends.get(w.from)[key],'prepared from '+key);near(p.at(-1)[key],ends.get(w.to)[key],'prepared to '+key);}
  for(let a=1;a<p.length;a++)for(let b=a+2;b<p.length;b++)assert(!segmentCross(p[a-1],p[a],p[b-1],p[b]),`${name} ${w.id} has a self crossing`);
  for(let j=i+1;j<routes.length;j++)for(let a=1;a<p.length;a++)for(let b=1;b<routes[j].length;b++){const q=segmentCross(p[a-1],p[a],routes[j][b-1],routes[j][b]);if(!q)continue;assert(!q.overlap,`${name} duplicates a bus segment`);
   const shared=[w.from,w.to].filter(id=>[d.wires[j].from,d.wires[j].to].includes(id));if(shared.some(id=>Math.hypot(q.x-ends.get(id).x,q.y-ends.get(id).y)<1e-5))continue;
   assert(name==='meters'&&Math.hypot(q.x-600,q.y-260)<1e-5,`${name} has an unnecessary crossing at ${JSON.stringify(q)}`);crossings++;
  }
  d.components.filter(R.dualMeter).forEach(c=>outsideMeter(d,w,c));
 }assert.equal(crossings,name==='meters'?1:0,'only the clearly separated wattmeter sense lead crosses');
}
const ohmExample=P.create('ohm');ohmExample.components.find(c=>c.type==='ammeter').params.resistance=1;const ohmResult=S.solve(ohmExample);near(ohmResult.components.c2.reading,6/13,'Ohm example includes the ammeter burden');near(ohmResult.components.c4.reading,ohmResult.voltage('c1:a','c1:b'),'terminal voltmeter measures the source terminals with finite A resistance');near(ohmResult.components.c4.reading,66/13,'terminal voltage includes all external drops');
for(const type of ['ammeter','voltmeter'])for(const port of ['a','c'])for(const view of ['real','schematic']){
 const f=dualFixture(type,port),baseResult=S.solve(f.d);f.d.display.view=view;const original=M.clone(f.d);let rotations=0;
 for(const angle of [90,180,270,0]){const before=M.clone(f.d),c=f.d.components.find(c=>c.id===f.meter.id);c.angle=angle;assert(M.reconcile(f.d,before),`${type} ${port} turns to ${angle}`);M.validate(f.d);
  for(const w of f.d.wires){outsideMeter(f.d,w,c);const p=G.route(f.d,w),key=w.from.startsWith(c.id+':')?'from':w.to.startsWith(c.id+':')?'to':null;if(!key){assert.deepEqual(w,before.wires.find(v=>v.id===w.id),'rotation cannot rearrange unrelated cables');continue;}
   const src=key==='from'?p:[...p].reverse(),terminal=R.ports(c).find(p=>p.id===w[key]),next=G.along(src,6);near(next.x,terminal.x+terminal.dx*6,'socket lead x');near(next.y,terminal.y+terminal.dy*6,'socket lead y');
  }
  near(S.solve(f.d).components[c.id].reading,baseResult.components[c.id].reading,'socket rotation keeps signed reading/range');assert.deepEqual(D.decode(D.encode(f.d)),f.d);
  for(const meters of ['digital','analog']){const svg=V.scene({...f.d,display:{...f.d.display,meters}},S.solve(f.d));assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);const lastBody=Math.max(...f.d.components.map(c=>svg.indexOf(`data-component="${c.id}"`)));for(const w of f.d.wires){assert(svg.indexOf(`data-wire="${w.id}"`)>lastBody,'entire cable stays above every housing');assert(svg.includes(`d="${G.path(G.route(f.d,w))}"`),'foreground cable follows the actual endpoint route');}}
  rotations++;
 }assert.equal(rotations,4);assert.deepEqual(f.d.wires.map(w=>[w.from,w.to,w.length]),original.wires.map(w=>[w.from,w.to,w.length]));
}
const tautMeter=dualFixture('ammeter').d,tautWire=tautMeter.wires[1];tautWire.length=G.length(G.route(tautMeter,tautWire));const tautHistory=M.history(tautMeter),tautBefore=D.encode(tautHistory.get());assert.throws(()=>tautHistory.change(d=>{const before=M.clone(d);d.components[2].angle=90;if(!M.reconcile(d,before))throw Error('finite connector reach');}));assert.equal(D.encode(tautHistory.get()),tautBefore,'a short cable refuses a turn atomically');
const translated=dualFixture('ammeter').d,translationBefore=M.clone(translated);translated.components[2].x+=240;translated.components[2].y+=20;assert(M.reconcile(translated,translationBefore),'normal meter movement retains its original deformation');
const translatedEnds=M.endpoints(translated);for(const w of translated.wires){const previous=translationBefore.wires.find(v=>v.id===w.id),expected=G.deform(G.route(translationBefore,previous),translatedEnds.get(w.from),translatedEnds.get(w.to),w.length);assert.deepEqual(w.via,expected.slice(1,-1));}
for(const name of ['ohm','meters','bridge'])for(const id of P.create(name).components.filter(R.dualMeter).map(c=>c.id)){
 const d=P.create(name),c=d.components.find(c=>c.id===id),ids=d.wires.map(w=>[w.from,w.to,w.length]),reading=S.solve(d).components[id].reading;
 for(let n=0;n<12;n++){const before=M.clone(d);c.angle=(c.angle+90)%360;assert(M.reconcile(d,before),`${name} ${id} continuous turn ${n}`);M.validate(d);d.wires.forEach(w=>outsideMeter(d,w,c));assert.deepEqual(d.wires.map(w=>[w.from,w.to,w.length]),ids);near(S.solve(d).components[id].reading,reading,'repeated rotation preserves the reading');}
}
const farDoc=P.create('meters'),farMeter=farDoc.components.find(c=>c.type==='ammeter'),farWire=farDoc.wires[4],farPoints=G.route(farDoc,farWire).filter(p=>Math.max(Math.abs(p.x-farMeter.x),Math.abs(p.y-farMeter.y))>240);
for(let n=0;n<12;n++){const before=M.clone(farDoc);farMeter.angle=(farMeter.angle+90)%360;assert(M.reconcile(farDoc,before));const p=G.route(farDoc,farWire);farPoints.forEach(q=>assert(G.nearest(p,q).distance<.05,'rotation preserves the distant cable shape'));}
for(const type of ['ammeter','voltmeter']){const d=M.empty(),c=M.add(d,type,260,300),w=M.connect(d,c.id+':a',c.id+':b',[],'free');for(let n=0;n<4;n++){const before=M.clone(d);c.angle=(c.angle+90)%360;assert(M.reconcile(d,before),'a cable joining two sockets on the same meter rotates');M.validate(d);outsideMeter(d,w,c);}}
for(const view of ['real','schematic'])for(const values of [true,false]){const d=P.create('meters');Object.assign(d.display,{view,values});const saved=D.encode(d),result=S.solve(d),viewport={x:0,y:0,width:256/.22,height:360/.22};const small=V.scene(d,result,.22,{},null,false,viewport);assert.equal(XMLValidator.validate('<svg>'+small+'</svg>'),true);assert(small.includes('data-overview-caption'));assert(!small.includes('data-component-label'));assert.equal((small.match(/data-overview-readout=/g)||[]).length,values?3:0);assert.equal(D.encode(d),saved,'overview stays out of the authoritative circuit');const enlarged=V.scene(d,result,.5,{},null,false,viewport);assert(!enlarged.includes('data-overview-caption'));assert.equal((enlarged.match(/data-component-label=/g)||[]).length,d.components.length,'zoom restores all component labels');}
console.log('Classroom diagrams: authored round corners, no duplicate buses/self crossings, one separated W sense crossing, true terminal voltage, four-direction socket exits, finite reach and original topology passed.');
