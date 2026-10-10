'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),F=require('./circuit-field-graphics'),G=require('./circuit-generator-graphics'),AC=require('./circuit-ac-components'),M=require('./circuit-model'),V=require('./circuit-renderer');
const cap=M.component(M.empty('transient'),'capacitor',0,0),coil=M.component(M.empty('transient'),'inductor',0,0),generator=M.component(M.empty('transient'),'generator',0,0);
function valid(markup){assert.equal(XMLValidator.validate('<svg>'+markup+'</svg>'),true);assert(!/NaN|Infinity/.test(markup));}
function loops(markup){return [...markup.matchAll(/data-field-line="closed" d="([^"]+)"/g)].map(m=>{
 const n=m[1].match(/[-+]?(?:\d*\.)?\d+/g).map(Number),p=[[n[0],n[1]],[n[2],n[1]]];
 const cubic=(a,b,c,d)=>{for(let i=1;i<=40;i++){const t=i/40,u=1-t;p.push(a.map((v,k)=>u*u*u*v+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]));}};
 cubic(p.at(-1),[n[3],n[4]],[n[5],n[6]],[n[7],n[8]]);p.push([n[9],n[8]]);cubic(p.at(-1),[n[10],n[11]],[n[12],n[13]],[n[14],n[15]]);return p;
});}
function noncrossing(paths){const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);for(let p=0;p<paths.length;p++)for(let q=p+1;q<paths.length;q++)for(let i=1;i<paths[p].length;i++)for(let j=1;j<paths[q].length;j++){const a=paths[p][i-1],b=paths[p][i],c=paths[q][j-1],d=paths[q][j];assert(!(cross(a,b,c)*cross(a,b,d)<-1e-8&&cross(c,d,a)*cross(c,d,b)<-1e-8),'magnetic field paths must not cross');}}
noncrossing(loops(F.inductor(coil,{current:1}).back));
const starts=(markup,kind)=>[...markup.matchAll(new RegExp('data-field-line="'+kind+'" d="M([-\\d.]+) ([-\\d.]+)','g'))].map(m=>Number(m[2])).sort((a,b)=>a-b);
const pitch=ys=>ys[1]-ys[0],visible=html=>Number(html.match(/ opacity="([^"]+)"/)[1]);
let previousCap=Infinity,previousCoil=Infinity;
for(const value of [.00001,.01,.1,.5,1,3,6,24,100,1000]){
 const capField=F.capacitor({voltage:value}).front,coilField=F.inductor(coil,{current:value});
 const cp=pitch(starts(capField,'uniform')),ip=pitch(starts(coilField.front,'inside'));
 assert(cp<=previousCap&&ip<=previousCoil,'stronger field must not widen spacing');previousCap=cp;previousCoil=ip;
 assert(starts(capField,'uniform').length>=5&&starts(capField,'uniform').length<=15);assert(starts(coilField.front,'inside').length>=6&&starts(coilField.front,'inside').length<=14);
 assert.equal(visible(capField),1);assert.equal(visible(coilField.front),1);assert.equal(visible(coilField.back),1);
 assert.deepEqual(starts(F.capacitor({voltage:-value}).front,'uniform'),starts(capField,'uniform'));
 assert.deepEqual(starts(F.inductor(coil,{current:-value}).front,'inside'),starts(coilField.front,'inside'));
 for(const [ys,extent] of [[starts(capField,'uniform'),20],[starts(coilField.front,'inside'),16]]){assert(Math.abs(ys[0]+extent)<1e-9);assert(Math.abs(ys.at(-1)-extent)<1e-9);for(let n=1;n<ys.length;n++)assert(Math.abs(ys[n]-ys[n-1]-pitch(ys))<1e-9,'uniform spacing across full span');}
 noncrossing(loops(coilField.back));
 const envelope=loops(coilField.back).flat(),xs=envelope.map(p=>p[0]),ys=envelope.map(p=>p[1]);assert(Math.abs(Math.min(...xs)+65.5)<1e-9);assert(Math.abs(Math.max(...xs)-65.5)<1e-9);assert.equal(Math.min(...ys),-45);assert.equal(Math.max(...ys),45);
}
assert.equal(visible(F.capacitor({voltage:0}).front),0);assert.equal(visible(F.inductor(coil,{current:null}).back),0);
for(const voltage of [null,0,.1,6,-6,1000]){
 const r={voltage,charge:voltage===null?null:cap.params.capacitance*voltage},saved=JSON.stringify(r),f=F.capacitor(r,AC.capacitorGap(cap));valid(f.back+f.front);valid(F.capacitorSection(r));assert(f.front.includes('data-field-sign="'+(Number.isFinite(voltage)?Math.sign(voltage):0)+'"'));assert((f.front.match(/data-field-line="uniform"/g)||[]).length>=5);assert.equal((f.back.match(/data-field-line="fringe"/g)||[]).length,0);assert.equal(JSON.stringify(r),saved);
}
for(const current of [null,0,.0001,.1,1,-1]){
 const r={current},saved=JSON.stringify(r),f=F.inductor(coil,r);valid(f.back+f.front);const count=(f.back.match(/data-field-line="closed"/g)||[]).length;assert(count>=6&&count<=14);assert.equal((f.front.match(/stroke-dasharray="2.5 2"/g)||[]).length,count);assert.equal((f.front.match(/data-field-occluded="true"/g)||[]).length,count);for(const d of f.back.matchAll(/data-field-line="closed" d="([^"]+)"/g)){assert(d[1].endsWith('Z'));assert(d[1].startsWith('M-40 '),'field enters physical left bore');assert(d[1].includes('H40C'),'field passes through physical right bore');}
 if(current===1){assert(f.markers.includes('>N</text>'));assert(F.description(coil,r).includes('右端為 N'));}if(current===-1)assert(F.description(coil,r).includes('左端為 N'));assert.equal(JSON.stringify(r),saved);
}
const relativeStrength=html=>Number(html.match(/data-field-strength="([^"]+)"/)[1]);assert(relativeStrength(F.inductor(coil,{current:.01}).front)<relativeStrength(F.inductor(coil,{current:1}).front));assert.equal(relativeStrength(F.inductor(coil,{current:0}).front),0);assert.equal(relativeStrength(F.capacitor({voltage:null}).front),0);
for(const phase of [0,Math.PI/2,Math.PI,3*Math.PI/2]){const r={phase,flux:.004*Math.cos(phase)};valid(F.generatorOverlay(generator,r,G.project));const model=G.render(generator,r,true);valid(model);assert(!model.includes('data-field-line="closed"'));assert(!model.includes('data-field-outer-poles'));assert.equal((model.match(/data-generator-field=/g)||[]).length,26);}
generator.params.field=0;assert(G.render(generator,{phase:1},true).includes('data-generator-fields="false"'));
for(const c of [cap,coil]){const r={voltage:6,current:1},before=JSON.stringify(c);assert(V.body(c,r,{view:'real',fields:true}).includes('data-field-kind'));assert(!V.body(c,r,{view:'real',fields:false}).includes('data-field-kind'));assert.equal(JSON.stringify(c),before);}
console.log('Fields: uniform plates without fringe, solenoid bore entry/hidden dashed paths, generator gap only, fixed extents/uniform changing density/equal opacity, reversal, zero/unknown, normal and unchanged model data passed');
