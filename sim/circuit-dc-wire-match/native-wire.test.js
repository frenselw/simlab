'use strict';
const a=require('node:assert/strict'),M=require('../circuit-workbench/circuit-model'),G=require('../circuit-workbench/circuit-routing'),F=require('../circuit-workbench/circuit-profile'),Q=require('./spec'),P=require('./persistence'),S=require('./scoring'),X=require('./crossings');
let maxDeviation=0;
for(let q=0;q<5;q++)for(let v=0;v<Q.layoutCount;v++){
const activity=Q.initial(q,v);M.connect(activity,'B:a','L1:a',[],'free');activity.wires[0].length=1200;
const tp=F.compile({role:'teacher',initialDocument:activity}),ap=F.compile(Q.config(q,v));a.equal(tp.wirePointLimit,96);a.equal(ap.wirePointLimit,64);
for(let step=0;step<4;step++){
const teacher=M.clone(activity);
for(const d of [teacher,activity]){const route=G.route(d,d.wires[0]),at=G.along(route,G.length(route)*.45);M.bendWire(d,d.wires[0].id,at,step%2?-35:60,step%2?45:-70);}
tp.prepare(teacher);ap.prepare(activity);const expected=M.clone(teacher);M.limitWirePoints(expected,64);a.deepEqual(activity.wires,expected.wires);a.equal(activity.wires[0].via.length,64);
const native=G.route(teacher,teacher.wires[0]),route=G.route(activity,activity.wires[0]);a.deepEqual(route[0],native[0]);a.deepEqual(route.at(-1),native.at(-1));a(G.length(route)<=G.length(native)+1e-8);for(const point of native)maxDeviation=Math.max(maxDeviation,G.nearest(route,point).distance);
const text=P.encode(activity,q,v),restored=P.unpack(text,q);a.deepEqual(G.route(restored,restored.wires[0]),route);a.deepEqual(X.events(restored),X.events(activity));a.deepEqual(S.assess(restored,q),S.assess(activity,q));
const old=F.compile(Q.config(q,v,null,2)),before=M.clone(teacher);old.prepare(teacher);a.deepEqual(teacher,before);a.equal(old.wirePointLimit,96);
}
}
a(maxDeviation<2,'64-point curves must remain close to the native path');
for(let n=0;n<100;n++){const b=Uint8Array.from({length:n},(_,i)=>(i*71+n)%256);const text=P.to85(b),decoded=P.from85(text);a.deepEqual(decoded.slice(0,n),b);a(decoded.slice(n).every(x=>x===0));a(!/["\\]/.test(text));}
for(const text of ['#######','#####','~~~~~','0000"'])a.throws(()=>P.from85(text));
console.log('400 layouts x repeated 64-point bends: native limiter, endpoints, lossless restore, crossings/scoring, legacy 96-point preservation and Base85 passed; maximum deviation '+maxDeviation+' world units');

const V=require('../circuit-workbench/circuit-renderer'),Solver=require('../circuit-workbench/circuit-solver');const upright=Q.initial(4,8),cfg=F.compile(Q.config(4,8));a.equal(cfg.ui.pickWire,false);a.equal(cfg.ui.cableToolbox,true);a.equal(cfg.ui.mathNames,true);const labels=V.labels(upright,Solver.solve(upright),1,{},null,{mathNames:true});a.equal(labels.find(p=>p.id==='L3').rows[0].tex,'L_3');a.equal(V.labels(upright,Solver.solve(upright),1).find(p=>p.id==='L3').rows[0].tex,undefined);const student=F.compile({role:'student'}),teacher=F.compile({role:'teacher'});a.equal(student.ui.pickWire,true);a.equal(student.ui.cableToolbox,false);a.equal(teacher.ui.cableToolbox,true);a.equal(teacher.ui.mathNames,false);a(P.fresh().answers.every(text=>P.layout(text)>=8));
