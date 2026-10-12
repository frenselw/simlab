'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),T=require('./circuit-transient');
function roundtrip(s){const saved=s.capture(),copy=T.decodeSession(T.encodeSession(saved));assert.deepEqual(copy.capture(),saved);const a=s.fork();a.advance(.04);copy.advance(.04);assert.equal(copy.fault,null);assert.deepEqual(copy.state,a.state);}
let cases=0;
for(const status of ['normal','limited','tripped'])for(const peer of [false,true])for(const time of [.1,1.1,5])for(const type of ['resistor','capacitor','ac-voltmeter']){
 const d=M.empty('transient'),a=M.add(d,'ac-source',100,100,{protectionEnabled:true,phase:status==='limited'?90:0,maxCurrent:status==='limited'?.2:1});
 if(status==='limited'){const r=M.add(d,'resistor',300,100);for(const p of ['a','b'])M.connect(d,a.id+':'+p,r.id+':'+p);}
 if(status==='tripped')M.connect(d,a.id+':a',a.id+':b');
 if(peer){const b=M.add(d,'ac-source',100,400,{protectionEnabled:true}),r=M.add(d,'resistor',300,400);for(const p of ['a','b'])M.connect(d,b.id+':'+p,r.id+':'+p);}
 const s=new T.Session(d);if(status==='limited'){s.advance(8);const next=M.clone(s.doc);next.wires=next.wires.filter(w=>!w.from.startsWith(a.id+':')&&!w.to.startsWith(a.id+':'));s.update(next);}
 s.advance(time);assert.equal(s.state.protection[a.id].status,status);const before=s.capture(),next=M.clone(s.doc),c=M.add(next,type,700,100);s.update(next);assert.equal(s.fault,null);
 if(s.state.time===0){assert.equal(s.state.protection[a.id].reviewAt,.02);}else assert.equal(s.state.protection[a.id].reviewAt,before.physics.protection[a.id].reviewAt);
 assert.equal(s.state.protection[a.id].status,status);roundtrip(s);
 const remove=M.clone(s.doc);M.remove(remove,c.id);s.update(remove);assert.equal(s.fault,null);roundtrip(s);if(status==='tripped')assert.equal(s.state.protection[a.id].status,'tripped');cases++;
}
console.log(`CW-20: ${cases} unloaded normal/limited/tripped add/remove cases, with/without a closed peer, immediate capture/restore/continuation passed.`);
