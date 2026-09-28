"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),G=require("./generator.js"),M=require("./model.js");
let count=0;
for(let family=0;family<5;family++)for(const params of G.parameterSets(family)){
 const q=G.build(family,params),old=G.build(family,params,1);assert.equal(q.targets.length,family<3?2:1);assert.ok(q.given.every(f=>f.force100>0));assert.equal(q.given.filter(f=>f.kind===4).length,1);
 for(const [i,f] of q.given.entries()){assert.equal(M.snapForce(f.force100/100)*100,f.force100,"every supplied force is an exact public tick");assert.ok(Math.abs(f.force100-old.given[i].force100)<=old.given[i].force100*.05,"rounding remains within 5% of the original reading");}
 q.expected.forEach((e,i)=>{const f=q.given.find(f=>f.id===q.targets[i]);assert.notEqual(e[0],0);assert.equal(e[0],f.source);assert.equal(e[2],f.kind);assert.equal(e[4],f.force100);assert.equal((e[3]-f.angle10+3600)%3600,1800);if(family!==4)assert.deepEqual(q.bodies[e[0]].anchors[e[1]].point,f.origin);});
 if(family===0){const a=params.theta*Math.PI/180,f=q.facts;assert.ok(Math.abs(f.normal*Math.cos(a)+f.friction*Math.sin(a)-f.weight)<1e-12);assert.ok(Math.abs(-f.normal*Math.sin(a)+f.friction*Math.cos(a))<1e-12);assert.ok(Math.abs(f.contactLocalX*f.normal+f.blockHeight/2*f.friction)<1e-12);assert.ok(Math.abs(f.contactLocalX)<f.blockWidth/2);assert.ok(Math.abs(f.mu-Math.tan(a))<1e-12);}
 if(family===1){const f=q.facts;assert.equal(f.contact,f.massB*f.acceleration);assert.equal(f.drive-f.contact,f.massA*f.acceleration);assert.equal(q.given[0].symbol,"F");}
 if(family===2){const f=q.facts;assert.equal(f.stiffness*Math.abs(f.extension),f.springForce);assert.equal(Math.sign(f.acceleration),-Math.sign(f.extension));}
 if(family===3){const f=q.facts;assert.ok(Math.abs(f.tension-f.weight*Math.cos(params.theta*Math.PI/180)-(f.weight/10)*f.speed*f.speed/f.length)<1e-12);}
 if(family===4){assert.equal(q.expected[0][0],1);assert.equal(q.expected[0][1],0);assert.equal(q.expected[0][3],params.angle*10);}
 count++;
}
for(let seed=0;seed<300;seed++){const a=G.generate(seed);assert.deepEqual(G.generate(seed),a);assert.deepEqual(a.order.slice().sort(),[0,1,2,3,4]);assert.equal(a.questions.reduce((n,q)=>n+q.targets.length,0),8);}
assert.equal(G.generate(6).questions[3].given[0].force100,2800);
assert.equal(G.generate(6,1).questions[3].given[0].force100,2799);
// Fingerprint captured from the shipped v1 generator before this change.
// Old numeric geometry, answers, order and physical facts must not silently change.
const legacy=[];for(let seed=0;seed<300;seed++){const s=G.generate(seed,1);legacy.push({seed,order:s.order,questions:s.questions.map(q=>({params:q.params,given:q.given.map(f=>({id:f.id,force100:f.force100,angle10:f.angle10,origin:f.origin})),expected:q.expected,geometry:q.geometry,facts:q.facts,maxForce100:q.maxForce100}))});assert.deepEqual(G.generate(seed).order,s.order);}
assert.equal(crypto.createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),'6be8588eefabacc26c9f535c5fdf4e63fc8368f05187ae7be2366bcb06221989');
for(const seed of [-1,1.5,NaN,Infinity,4294967296,"1"])assert.throws(()=>G.generate(seed));for(const version of [0,3,"2",null])assert.throws(()=>G.generate(1,version));
console.log(`Reaction generator: ${count} finite variants verified, 300 deterministic papers, gravity/contact/acceleration constraints.`);
