'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto'),Q=require('./spec'),P=require('./persistence'),S=require('./scoring'),X=require('./crossings'),G=require('../circuit-workbench/circuit-routing'),F=require('../circuit-workbench/circuit-profile'),R=require('../circuit-workbench/component-registry'),{solved}=require('./fixtures');
const legacy=Array.from({length:5},(_,q)=>Array.from({length:16},(_,v)=>Q.initial(q,v).components.map(c=>[c.id,c.x,c.y,c.angle])));
assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),'502b1043ff289b90f43666e84e6cdc7a27d14d8a19962b87e2f0ee1fd8f94c1a');
let maximum=0;
for(let q=0;q<5;q++){
 const layouts=new Set(),arrangements=new Set(),slots=new Map();
 for(let v=0;v<Q.layoutCount;v++){
  const d=solved(q,v);if(v>=8)assert(d.components.filter(c=>c.type==='lamp').every(c=>c.angle===0));
  F.compile(Q.config(q,v)).assertSnapshot(d);layouts.add((v<8?'legacy:':'current:')+JSON.stringify(d.components.map(c=>[c.x,c.y,c.angle])));
  assert.equal(X.events(d).length,0,JSON.stringify({q,v,events:X.events(d)}));assert.equal(S.assess(d,q).units,3360);assert(d.wires.length<=Q.stocks[q]);
  for(const w of d.wires){const route=G.route(d,w),length=G.length(route);maximum=Math.max(maximum,length);assert(length<=(v<16?800:1000));
   if(v>=16)for(const c of d.components){const b=R.bodyBounds(c),corners=[{x:b.left,y:b.top},{x:b.right,y:b.top},{x:b.right,y:b.bottom},{x:b.left,y:b.bottom}];for(let i=1;i<route.length;i++)for(let j=0;j<4;j++)assert.equal(X.intersection(route[i-1],route[i],corners[j],corners[(j+1)%4]),null,JSON.stringify({q,v,wire:w.id,body:c.id}));}
  }
  const text=P.encode(d,q,v),restored=P.unpack(text,q);assert.equal(S.assess(restored,q).units,3360);assert.deepEqual(restored.wires.map(w=>G.route(restored,w)),d.wires.map(w=>G.route(d,w)));
  if(v<16)continue;
  const positions=d.components.map(c=>{const slot=Math.round((c.x-100)/200)+3*Math.round((c.y-130)/250);if(!slots.has(c.id))slots.set(c.id,new Set());slots.get(c.id).add(slot);return slot;});arrangements.add(positions.join(','));
  for(const old of legacy[q]){const oldSlots=old.map(([,x,y])=>Math.round((x-100)/200)+3*Math.round((y-130)/250));assert(positions.filter((p,i)=>p===oldSlots[i]).length<=Math.floor(positions.length/2),'at least half the components must change region even against old rotated/mirrored layouts');}
  const boxes=d.components.map(R.bodyBounds);for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.right+24<b.left||b.right+24<a.left||a.bottom+24<b.top||b.bottom+24<a.top);}
 }
 assert.equal(layouts.size,Q.layoutCount);assert(arrangements.size>=48);assert([...slots.values()].every(s=>s.size===6),'each component must appear in all six placement regions');
}
for(const v of [-1,80,255,1.5,NaN])assert.throws(()=>Q.initial(0,v));
console.log('400 layouts: 80 legacy unchanged; 320 shuffled, varied roles/regions, clear bodies, non-crossing full-credit solutions, exact restore; maximum wire length '+maximum);
