'use strict';
const assert=require('node:assert/strict'),Q=require('./circuit-math'),D=require('./circuit-ac-display'),M=require('./circuit-model'),P=require('./circuit-ac-presets'),T=require('./circuit-transient');
// Mathematical notation is controlled, self-contained and safe for arbitrary names.
for(const key of ['theta','Phi','NPhi','n','Urms','Irms','WC','WL','N1','N2','fluxFormula','emfFormula','transformerRatio']){
 const spec=Q.symbol(key),svg=Q.html(spec);assert(svg.includes('data-tex='));assert(svg.includes('<path'));assert(!/<(?:use|image|foreignObject)\b/.test(svg));
}
assert(Q.symbol('n').tex.includes('hat'));assert(Q.symbol('Urms').tex.includes('mathrm'));
assert(Q.labelHtml('<img onerror=alert(1)>').includes('&lt;img'));assert.throws(()=>Q.symbol('\\href'));
for(const unit of ['mWb','μWb','nA','kV','ms','°'])assert(Q.html(Q.unit(unit)).includes('<path'));
assert(Q.prose('[[fluxFormula]]；0.1 F').includes('data-tex="\\Phi=BS\\cos\\theta"'));
assert(P.descriptionParts('generator').some(p=>p.tex===Q.symbol('emfFormula').tex));
assert(P.descriptionParts('transformer').some(p=>p.tex===Q.symbol('transformerRatio').tex));
// Generator scales use the physical peak, retain their units and do not clip the phase at 200°.
const g=M.add(M.empty('transient'),'generator',0,0,{field:.2,area:.02,turns:300,frequency:1}),bars=new D.Readouts();
const h=(key,value,unit,options={})=>bars.html(g,key,value,unit,{now:0,...options});
assert(h('phase',350,'°').includes('aria-valuemax="360"'));assert(h('phase',-10,'°').includes('aria-valuenow="350"'));assert(h('phase',720,'°').includes('aria-valuenow="0"'));
assert(h('flux',.004,'Wb').includes('aria-valuemax="0.005"'));assert.equal(bars.states.get(g.id+':flux').unit,'mWb');
const initial=h('sourceEmf',3,'V',{paused:false}),later=h('sourceEmf',-4,'V',{paused:false,now:100});assert(initial.includes('positive'));assert(later.includes('negative'));assert.equal(initial.match(/ac-bar-value">([^<]*)/)[1],later.match(/ac-bar-value">([^<]*)/)[1]);
assert(h('sourceEmf',-4,'V',{paused:true,now:101}).includes('>-4.00 '));assert(h('sourceEmf',null,'V').includes('data-readout-known="false"'));assert(h('sourceEmf',0,'V',{paused:false}).includes('>大小 0.00 '));
const unit=bars.states.get(g.id+':flux').unit;h('flux',1e-8,'Wb');assert.equal(bars.states.get(g.id+':flux').unit,unit);
// UI projection is read-only; generator phase, flux and EMF still come from the solver.
const session=new T.Session(P.create('generator'));session.advance(.123);const before=JSON.stringify(session.capture()),doc=session.doc,c=doc.components.find(c=>c.type==='generator'),r=session.read().components[c.id];
for(const [key,value,u]of [['phase',r.phase*180/Math.PI,'°'],['flux',r.flux,'Wb'],['fluxLinkage',r.fluxLinkage,'Wb'],['sourceEmf',r.sourceEmf,'V']])bars.html(c,key,value,u,{doc,result:r});
assert.equal(JSON.stringify(session.capture()),before);
console.log('Generator bar scales, signed/cyclic readouts and controlled physics notation passed');
