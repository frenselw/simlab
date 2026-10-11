'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),P=require('./circuit-ac-presets'),M=require('./circuit-model'),T=require('./circuit-transient'),V=require('./circuit-renderer'),F=require('./circuit-field-graphics'),Q=require('./circuit-math'),R=require('./component-registry'),D=require('./circuit-ac-display');
const close=(a,b,tol=2e-6)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
// The field observes U/N, including an unloaded ideal transformer (I=0).
for(const unloaded of [false,true]){
 const d=P.create('transformer');if(unloaded){d.components=d.components.filter(c=>['ac-source','transformer'].includes(c.type));const ids=new Set(d.components.map(c=>c.id));d.wires=d.wires.filter(w=>ids.has(w.from.split(':')[0])&&ids.has(w.to.split(':')[0]));}
 const s=new T.Session(d),c=d.components.find(c=>c.type==='transformer'),peak=6*Math.SQRT2/(2*Math.PI*c.params.primaryTurns);assert.equal(s.read().components[c.id].coreFlux,null);
 for(const t of [1.125,1.25,1.5,1.75,2]){s.advance(t-s.state.time);const r=s.read().components[c.id];assert.equal(r.coreFluxStatus,'ready');close(r.coreFlux,-peak*Math.cos(2*Math.PI*t),peak*.001);if(unloaded)close(r.current,0,1e-10);const shown=V.displayComponent(s.doc,s.read(),c);if(t===1.25||t===1.75)assert.equal(shown.coreFlux,0);}
 assert(s.coreTracker.records.get(c.id).bins.length<=515);const saved=s.capture(),restored=T.Session.restore(saved);assert.deepEqual(restored.capture(),saved);assert.equal(restored.read().components[c.id].coreFlux,null);restored.advance(1.125);close(restored.read().components[c.id].coreFlux,-peak*Math.cos(2*Math.PI*restored.state.time),peak*.001);assert.deepEqual(s.capture(),saved);
 const preview=M.clone(s.doc); // Preview cannot mutate the live observation window.
 s.preview(preview);assert.deepEqual(s.capture(),saved);
}
// Voltage integral remains valid for square/triangle sources, not just a sine proxy.
for(const waveform of ['square','triangle']){const d=P.create('transformer');d.components[0].params.waveform=waveform;const s=new T.Session(d),id=d.components[1].id;for(const t of [1.0,1.25,1.5,1.75]){s.advance(t-s.state.time);const r=s.read().components[id];assert.equal(r.coreFluxStatus,'ready');if(t===1)assert(r.coreFlux<0);if(t===1.5)assert(r.coreFlux>0);if(t===1.25||t===1.75)assert(Math.abs(r.coreFlux)<2e-6);}}
// Shared flux includes both winding MMFs; equal/opposite ampere-turns cancel.
{const d=P.create('coupled'),c=d.components.find(c=>c.type==='transformer');c.params.initialPrimaryCurrent=1;c.params.initialSecondaryCurrent=-2;const s=new T.Session(d),r=s.read().components[c.id];close(r.coreFlux,0,1e-12);assert(r.energy>0,'leakage energy is not common-core flux');assert(F.transformer(c,r).includes('opacity="0"'));const snap=s.capture(),restored=T.Session.restore(snap);close(restored.read().components[c.id].coreFlux,r.coreFlux);restored.advance(.01);assert.equal(restored.fault,null);assert.deepEqual(s.capture(),snap);}
const c=M.component(M.empty('transient'),'transformer',0,0);
const bars=new D.Readouts();bars.html(c,'coreFlux',null,'Wb');assert(bars.html(c,'coreFlux',.004,'Wb',{result:{coreFluxPeak:.00675}}).includes('aria-valuemax="0.01"'));
assert.equal(Q.turnsRatio(200,100).text,'N₁:N₂ = 2:1');assert.equal(Q.turnsRatio(1,2000).text,'N₁:N₂ = 1:2000');
let previous=Infinity;for(const flux of [1e-7,.001,.005,.1]){const svg=F.transformer(c,{coreFlux:flux}),spacing=Number(svg.match(/data-field-spacing="([^"]+)"/)[1]);assert(spacing<=previous);previous=spacing;const paths=[...svg.matchAll(/data-field-line="core-closed" d="([^"]+)"/g)];assert(paths.length>=2&&paths.length<=4);const nums=paths.flatMap(p=>p[1].match(/[-+]?[\d.]+/g).map(Number));assert(Math.max(...nums)<=42.5&&Math.min(...nums)>=-42.5);assert(paths.every(p=>p[1].endsWith('Z')));assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);}
for(const flux of [null,0,1e-25])assert(F.transformer(c,{coreFlux:flux}).includes('opacity="0"'));
for(const angle of [0,90,180,270])for(const view of ['real','schematic']){c.angle=angle;const svg=V.body(c,{coreFlux:.005,energy:.1},{view,values:true,fields:true});assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert.equal((svg.match(/data-transformer-ratio=/g)||[]).length,1);assert(svg.includes('N_1:N_2=2:1'));assert(!svg.includes('>原 200匝')&&!svg.includes('>副 100匝'));assert(!V.body(c,{coreFlux:.005},{view,values:true,fields:false}).includes('data-field-kind="transformer-core"'));const box=R.bodyBounds(c);assert(box.top<-70,'upright ratio is reserved above the rotated core');}
const d=P.create('transformer'),r=new T.Session(d).read(),rows=V.labels(d,r,1).find(x=>x.id===d.components[1].id).rows;assert(rows.every(x=>x.kind==='name'),'no duplicate bare secondary-turn value below the name');
// Front and rear half-turns must meet at every joint, including both external leads.
for(const turns of [1,200,2000]){
 const sample={...c,angle:0,params:{...c.params,primaryTurns:turns,secondaryTurns:turns}},svg=V.body(sample,{coreFlux:.005},{view:'real',values:true,fields:false});
 const paths=kind=>[...svg.matchAll(new RegExp('data-transformer-'+kind+'="[^"]*"[^>]*><path d="([^"]*)"','g'))].map(m=>m[1]);
 const halves=path=>path.split('M').slice(1).map(part=>part.match(/-?\d+(?:\.\d+)?/g).map(Number));
 const fronts=paths('front').map(halves),backs=paths('back').map(halves),leads=paths('leads').map(halves);
 assert.equal(fronts.length,2);assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);
 for(let side=0;side<2;side++){
  const front=fronts[side],back=backs[side],lead=leads[side],sign=side?1:-1;
  assert.equal(front.length,Math.max(1,Math.round(turns/10)));assert.equal(back.length,front.length);
  assert.deepEqual(lead[0].slice(0,2),[sign*76,-26]);assert.equal(lead[1].at(-1),sign*76);
  assert.deepEqual(lead[0].slice(-2),front[0].slice(0,2));assert.deepEqual(back.at(-1).slice(-2),lead[1].slice(0,2));
  for(let n=0;n<front.length;n++){assert.deepEqual(front[n].slice(-2),back[n].slice(0,2));if(n+1<front.length)assert.deepEqual(back[n].slice(-2),front[n+1].slice(0,2));}
  assert(back.at(-1).at(-1)-front[0][1]<=48.00001,'dense windings remain inside the iron limb');
 }
}
// Scene, observation panels and separate editors may display the same component id.
{const render=(idPrefix,fields=true)=>V.body(c,{coreFlux:.005},{view:'real',values:true,fields,idPrefix}),joined=['first-scene-','first-panel-','first-dialog-','second-scene-'].map(p=>render(p)).join('');
 const ids=[...joined.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const ref of joined.matchAll(/url\(#([^\)]+)\)/g))assert(ids.includes(ref[1]),'every gradient and mask resolves within its render');
 const shown=render('sample-'),solid=render('sample-',false);assert(shown.includes('data-visible-turns="20" opacity="1"'));assert(solid.includes('data-visible-turns="20" opacity="1"'));assert(shown.includes('data-field-occluded="true"'));assert(!solid.includes('data-field-kind="transformer-core"'));assert(shown.indexOf('data-transformer-field-slot')>shown.lastIndexOf('data-transformer-leads'));
 const rings=[...shown.matchAll(/data-core-(?:lamination="\d+"|face="true") d="([^"]+)"/g)].map(m=>m[1]);assert.equal(rings.length,7);assert.equal(new Set(rings).size,1,'laminations and face share identical corners and inner window');
}
console.log('Transformer: voltage-integral flux, unloaded field, MMF cancellation, continuous sparse/dense windings, scoped SVG resources, ratio/rotation, field toggle and restore continuation passed');
