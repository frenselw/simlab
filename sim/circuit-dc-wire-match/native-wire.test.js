'use strict';
const a=require('node:assert/strict'),M=require('../circuit-workbench/circuit-model'),G=require('../circuit-workbench/circuit-routing'),F=require('../circuit-workbench/circuit-profile'),Q=require('./spec'),P=require('./persistence'),S=require('./scoring'),X=require('./crossings');
for(let q=0;q<5;q++)for(let v=0;v<8;v++){
const teacher=Q.initial(q,v),load=teacher.components.find(c=>c.id==='L1');M.connect(teacher,'B:a',load.id+':a',[],'free');teacher.wires[0].length=1200;
const activity=M.clone(teacher),tp=F.compile({role:'teacher',initialDocument:teacher}),ap=F.compile(Q.config(q,v));a.equal(ap.wirePointLimit,96);
for(let step=0;step<4;step++){for(const d of [teacher,activity]){const route=G.route(d,d.wires[0]),at=G.along(route,G.length(route)*.45);M.bendWire(d,d.wires[0].id,at,step%2?-35:60,step%2?45:-70);}tp.prepare(teacher);ap.prepare(activity);a.deepEqual(activity.wires,teacher.wires,'activity must retain the exact native curve');a(activity.wires[0].via.length>3);const text=P.encode(activity,q,v),restored=P.unpack(text,q);a.deepEqual(G.route(restored,restored.wires[0]),G.route(activity,activity.wires[0]));a.deepEqual(S.assess(restored,q),S.assess(activity,q));}
}
for(let n=0;n<100;n++){const b=Uint8Array.from({length:n},(_,i)=>(i*71+n)%256);const text=P.to85(b),decoded=P.from85(text);a.deepEqual(decoded.slice(0,n),b);a(decoded.slice(n).every(x=>x===0));a(!/["\\]/.test(text));}
for(const text of ['#######','#####','~~~~~','0000"'])a.throws(()=>P.from85(text));
console.log('40 layouts x repeated native bends: identical teacher/activity curves, full-precision restore, scoring and canonical Base85 passed');
