'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser');
const E=require('./circuit-experiments'),M=require('./circuit-model'),D=require('./circuit-document'),S=require('./circuit-solver'),P=require('./presets');
let cases=0;
const test=(name,fn)=>{fn();cases++;};
const near=(a,b)=>assert(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const rows=(axis,x,fn)=>x.map(v=>({u:axis==='UI'?fn(v):v,i:axis==='UI'?v:fn(v),uLabel:'V',iLabel:'A',uRange:100,iRange:100,uStatus:'normal',iStatus:'normal'}));
const fixtures={linear:{fn:x=>2*x+.3,coeff:[2,.3]},proportional:{fn:x=>.4*x,coeff:[.4]},inverse:{fn:x=>3/x,coeff:[3]},quadratic:{fn:x=>.15*x*x-.3*x+.7,coeff:[.15,-.3,.7]}};
for(const axis of ['IU','UI'])for(const model of E.models)test(`${axis} ${model}`,()=>{
  const f=fixtures[model],data=rows(axis,[-2,-1,.5,1.5,3],f.fn),out=E.fit(data,axis,model);
  assert.equal(out.used,5);out.coefficients.forEach((v,n)=>near(v,f.coeff[n]));near(out.rSquared,1);
  for(const x of [-1.7,.8,2.4])near(E.predict(out,x),f.fn(x));
  const plot=E.plot({...E.empty(),axis,fit:true,fitModel:model,rows:data});assert.equal(XMLValidator.validate(plot),true);assert(!/NaN|Infinity/.test(plot));assert(plot.includes(`data-fit-model="${model}"`));
  assert.equal(XMLValidator.validate(E.plot({...E.empty(),axis,fit:true,fitModel:model,rows:data},'detail')),true);
  const formula=E.formula(out,axis);assert(formula.text.startsWith(axis==='UI'?'U =':'I ='));assert.equal(XMLValidator.validate(require('./circuit-math').html(formula)),true);
});
test('inverse exclusions and separate branches at zero',()=>{
  const data=rows('IU',[-2,-1,1,2],x=>2/x);data.push(...rows('IU',[0],()=>999));data.push({...data[0],i:999,iStatus:'overrange'});
  const fitted=E.fit(data,'IU','inverse');near(fitted.coefficients[0],2);assert.equal(fitted.used,4);assert.equal(fitted.excluded,2);
  const plot=E.plot({...E.empty(),fit:true,fitModel:'inverse',rows:data}),d=plot.match(/data-measurement-fit="true"[^>]* d="([^"]*)"/)[1];assert.equal((d.match(/M/g)||[]).length,2);assert(!/NaN|Infinity/.test(d));
});
test('least squares and R squared measure the original y values',()=>{
  const data=rows('IU',[1,2,3],x=>x+2),p=E.fit(data,'IU','proportional');near(p.coefficients[0],26/14);
  const ymean=4,error=data.reduce((s,r)=>s+(r.i-E.predict(p,r.u))**2,0),variance=data.reduce((s,r)=>s+(r.i-ymean)**2,0);near(p.rSquared,1-error/variance);
  assert(E.fit(rows('IU',[1,2,3],x=>x),'IU','inverse').rSquared<0,'a poor constrained fit must not be clamped to zero');
  assert.equal(E.fit(rows('IU',[1,2,3],()=>4),'IU','inverse').rSquared,null,'constant y with nonzero residual has undefined R squared');
});
test('microamp data and large shifted polynomial remain numerically stable',()=>{
  const small=E.fit(rows('UI',[1e-6,2e-6,4e-6,8e-6],x=>4000*x+.01),'UI','linear');near(small.slope,4000);near(small.intercept,.01);
  const large=E.fit(rows('IU',[999999,1000000,1000001,1000002],x=>.2*(x-1000000)**2+.5*(x-1000000)+.7),'IU','quadratic');near(E.predict(large,1000000.5),1);near(large.rSquared,1);
});
test('insufficient, degenerate and invalid models produce no curve',()=>{
  for(const model of E.models){assert.equal(E.fit([],'IU',model),null);assert.equal(E.fit(rows('IU',[1,1,1],()=>3),'IU',model),null);assert.equal(E.fit(rows('IU',[1],()=>3),'IU',model),null);}
  assert.equal(E.fit(rows('IU',[1,2],x=>x*x),'IU','quadratic'),null);assert.equal(E.fit(rows('IU',[0,1],()=>2),'IU','inverse'),null);assert.equal(E.fit([],'IU','unknown'),null);
});
test('polynomial roundoff does not invent a quadratic term for a straight line',()=>{
  const fit=E.fit(rows('UI',[.31,.48,.71,.93,1.4],x=>6-2*x),'UI','quadratic');
  assert.equal(fit.coefficients[0],0);near(fit.coefficients[1],-2);near(fit.coefficients[2],6);near(fit.rSquared,1);assert(!E.formula(fit,'UI').tex.includes('I^2'));
});
test('vertical label is at the vertical axis rather than plot center',()=>{
  for(const axis of ['IU','UI']){const svg=E.plot({...E.empty(),axis,rows:rows(axis,[1,2],x=>x)});assert(svg.includes('data-measurement-axis="y"><g'));assert(svg.match(/data-measurement-axis="y"><g[^>]*transform="translate\(55 23\)/));}
});
test('legacy and new saved documents restore and continue legal recording',()=>{
  for(const model of [undefined,...E.models]){
    const doc=P.create('ohm');doc.measurements=E.empty();doc.measurements.fit=true;if(model===undefined)delete doc.measurements.fitModel;else doc.measurements.fitModel=model;
    const voltage=doc.components.find(c=>c.type==='voltmeter').id,current=doc.components.find(c=>c.type==='ammeter').id;
    E.record(doc,S.solve(doc),voltage,current);const stored=D.encode(doc),restored=D.decode(stored);assert.deepEqual(restored,doc);E.record(restored,S.solve(restored),voltage,current);assert.equal(restored.measurements.rows.length,2);D.decode(D.encode(restored));
    const history=M.history(doc);history.change(d=>d.measurements.fitModel='inverse');const changed=D.encode(history.get());history.undo();assert.equal(D.encode(history.get()),stored);history.redo();assert.equal(D.encode(history.get()),changed);
  }
});
test('unknown or malformed fit model is rejected without accepting extra keys',()=>{
  for(const value of [null,7,'exponential',{},false]){const d=P.create('ohm');d.measurements={...E.empty(),fitModel:value};assert.throws(()=>D.decode(JSON.stringify(d)),/擬合模型/);}
  const d=P.create('ohm');d.measurements={...E.empty(),extra:true};assert.throws(()=>D.decode(JSON.stringify(d)));
});
console.log(`Experimental fits: ${cases} focused groups passed; SI numeric models, domains, axis label, strict legacy/new persistence and recording continuation.`);
