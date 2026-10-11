'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),F=require('./circuit-field-graphics'),G=require('./circuit-generator-graphics'),AC=require('./circuit-ac-components'),M=require('./circuit-model'),V=require('./circuit-renderer');
const cap=M.component(M.empty('transient'),'capacitor',0,0),coil=M.component(M.empty('transient'),'inductor',0,0),generator=M.component(M.empty('transient'),'generator',0,0);
function valid(markup){assert.equal(XMLValidator.validate('<svg>'+markup+'</svg>'),true);assert(!/NaN|Infinity/.test(markup));}
function loops(markup){return [...markup.matchAll(/data-field-line="(?:spread|return)"[^>]* d="([^"]+)"/g)].map(m=>{
 const tokens=m[1].match(/[MLCZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi),p=[];let at=0;
 while(at<tokens.length){const c=tokens[at++],read=()=>Number(tokens[at++]);if(c==='M')p.push([read(),read()]);else if(c==='L')p.push([read(),read()]);else if(c==='C'){const a=p.at(-1),b=[read(),read()],c=[read(),read()],d=[read(),read()];for(let i=1;i<=40;i++){const t=i/40,u=1-t;p.push(a.map((v,k)=>u*u*u*v+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]));}}else assert.equal(c,'Z');}return p;
});}
function noncrossing(paths){const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);for(let p=0;p<paths.length;p++)for(let q=p+1;q<paths.length;q++)for(let i=1;i<paths[p].length;i++)for(let j=1;j<paths[q].length;j++){const a=paths[p][i-1],b=paths[p][i],c=paths[q][j-1],d=paths[q][j];assert(!(cross(a,b,c)*cross(a,b,d)<-1e-8&&cross(c,d,a)*cross(c,d,b)<-1e-8),'magnetic field paths must not cross');}}
noncrossing(loops(F.inductor(coil,{current:1}).back));
const starts=(markup,kind)=>[...markup.matchAll(new RegExp('data-field-line="'+kind+'"[^>]*'+(kind==='inside'?'data-field-seed="([-\\d.e]+)"':'d="M[-\\d.]+ ([-\\d.]+)'),'g'))].map(m=>Number(m[1])).sort((a,b)=>a-b);
const pitch=ys=>ys[1]-ys[0],visible=html=>Number(html.match(/ opacity="([^"]+)"/)[1]);
let previousCap=Infinity,previousCoil=Infinity;
for(const value of [.00001,.01,.1,.5,1,3,6,24,100,1000]){
 const capField=F.capacitor({voltage:value}).front,coilField=F.inductor(coil,{current:value});
 const cp=pitch(starts(capField,'uniform')),ip=pitch(starts(coilField.front,'inside'));
 assert(cp<=previousCap&&ip<=previousCoil,'stronger field must not widen spacing');previousCap=cp;previousCoil=ip;
 assert(starts(capField,'uniform').length>=5&&starts(capField,'uniform').length<=15);assert(starts(coilField.front,'inside').length>=13&&starts(coilField.front,'inside').length<=25);
 assert.equal(visible(capField),1);assert.equal(visible(coilField.front),1);assert.equal(visible(coilField.back),1);
 assert.deepEqual(starts(F.capacitor({voltage:-value}).front,'uniform'),starts(capField,'uniform'));
 assert.deepEqual(starts(F.inductor(coil,{current:-value}).front,'inside'),starts(coilField.front,'inside'));
 for(const [ys,extent] of [[starts(capField,'uniform'),20],[starts(coilField.front,'inside'),16]]){assert(Math.abs(ys[0]+extent)<1e-9);assert(Math.abs(ys.at(-1)-extent)<1e-9);for(let n=1;n<ys.length;n++)assert(Math.abs(ys[n]-ys[n-1]-pitch(ys))<1e-9,'uniform spacing across full span');}
 if(value===.00001||value===1000)noncrossing(loops(coilField.back));
 const envelope=loops(coilField.back).flat(),xs=envelope.map(p=>p[0]),ys=envelope.map(p=>p[1]);assert(Math.abs(Math.min(...xs)+84)<1e-9);assert(Math.abs(Math.max(...xs)-84)<1e-9);assert.equal(Math.min(...ys),-58);assert.equal(Math.max(...ys),58);
}
// Compare physical spacing, rather than only path counts: the central bore
// stays near-parallel while the same lines fan apart near the sides of the frame.
const crossSection=(paths,x)=>paths.flatMap(points=>points.slice(1).flatMap((b,n)=>{const a=points[n];return (a[0]-x)*(b[0]-x)<=0&&a[0]!==b[0]?[a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])]:[];})).sort((a,b)=>a-b).filter((y,n,ys)=>n===0||Math.abs(y-ys[n-1])>.05);
for(const value of [.00001,1000]){
 const paths=loops(F.inductor(coil,{current:value}).back),inside=crossSection(paths,0).filter(y=>Math.abs(y)<=16.01),outside=crossSection(paths,70),pitch=inside[1]-inside[0],gaps=outside.slice(1).map((y,n)=>y-outside[n]);assert(gaps.length>=4);assert(gaps.every(gap=>gap>2*pitch),'field spreads to wider spacing outside the bore');
 const returns=crossSection(paths,0).filter(y=>y>24);assert.equal(returns.length,2);assert(returns[1]-returns[0]>4*pitch,'outside return lines are substantially sparser than bore lines');
 for(const points of paths)for(let n=1;n<points.length;n++){const a=points[n-1],b=points[n];if(Math.abs(a[0])<12&&Math.abs(b[0])<12&&Math.abs(a[1])<17&&Math.abs(b[1])<17)assert(Math.abs(b[1]-a[1])<.12*Math.abs(b[0]-a[0])+1e-5,'central field is nearly parallel to the axis');}
}
assert.equal(visible(F.capacitor({voltage:0}).front),0);assert.equal(visible(F.inductor(coil,{current:null}).back),0);
for(const voltage of [null,0,.1,6,-6,1000]){
 const r={voltage,charge:voltage===null?null:cap.params.capacitance*voltage},saved=JSON.stringify(r),f=F.capacitor(r,AC.capacitorGap(cap));valid(f.back+f.front);valid(F.capacitorSection(r));assert(f.front.includes('data-field-sign="'+(Number.isFinite(voltage)?Math.sign(voltage):0)+'"'));assert((f.front.match(/data-field-line="uniform"/g)||[]).length>=5);assert.equal((f.back.match(/data-field-line="fringe"/g)||[]).length,0);assert.equal(JSON.stringify(r),saved);
}
for(const current of [null,0,.0001,.1,1,-1]){
 const r={current},saved=JSON.stringify(r),f=F.inductor(coil,r);valid(f.back+f.front);const count=(f.back.match(/data-field-line="return"/g)||[]).length;assert.equal(count,4);const inside=(f.front.match(/data-field-line="inside"/g)||[]).length;assert(inside>=13&&inside<=25&&inside>=3*count);assert.equal((f.front.match(/stroke-dasharray="2.5 1.5"/g)||[]).length,inside);assert.equal((f.front.match(/data-field-occluded="true"/g)||[]).length,inside);const spread=[...f.back.matchAll(/data-field-line="spread"[^>]*d="([^"]+)"/g)];assert.equal(spread.length,inside);assert(spread.every(m=>!m[1].endsWith('Z')),'bore field fans extend beyond the observation frame');assert.equal((f.back.match(/data-field-clipped="true"/g)||[]).length,inside);assert(!f.back.includes('data-field-line="closed"'));
 if(current===1){assert(f.markers.includes('>N</text>'));assert(F.description(coil,r).includes('右端為 N'));}if(current===-1)assert(F.description(coil,r).includes('左端為 N'));assert.equal(JSON.stringify(r),saved);
}
const relativeStrength=html=>Number(html.match(/data-field-strength="([^"]+)"/)[1]);assert(relativeStrength(F.inductor(coil,{current:.01}).front)<relativeStrength(F.inductor(coil,{current:1}).front));assert.equal(relativeStrength(F.inductor(coil,{current:0}).front),0);assert.equal(relativeStrength(F.capacitor({voltage:null}).front),0);
for(const phase of [0,Math.PI/2,Math.PI,3*Math.PI/2]){const r={phase,flux:.004*Math.cos(phase)};valid(F.generatorOverlay(generator,r,G.project));const model=G.render(generator,r,true);valid(model);assert(!model.includes('data-field-line="closed"'));assert(!model.includes('data-field-outer-poles'));assert.equal((model.match(/data-generator-field=/g)||[]).length,26);}
generator.params.field=0;assert(G.render(generator,{phase:1},true).includes('data-generator-fields="false"'));
for(const c of [cap,coil]){const r={voltage:6,current:1},before=JSON.stringify(c);assert(V.body(c,r,{view:'real',fields:true}).includes('data-field-kind'));assert(!V.body(c,r,{view:'real',fields:false}).includes('data-field-kind'));assert.equal(JSON.stringify(c),before);}
console.log('Fields: uniform plates without fringe, solenoid continuous bore/fanning boundary cuts/hidden dashed paths, generator gap only, fixed extents/dense bore/sparse curved returns and equal opacity, reversal, zero/unknown, normal and unchanged model data passed');
