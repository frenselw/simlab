'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser'),E=require('./circuit-experiments'),M=require('./circuit-model'),S=require('./circuit-solver'),D=require('./circuit-document'),R=require('./component-registry'),P=require('./presets');
const near=(a,b)=>assert(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
let cases=0;const test=(name,fn)=>{fn();cases++;};
const row=(u,i,r=10)=>({u,i,r,rLabel:'R',uLabel:'V',iLabel:'A',uRange:100,iRange:100,uStatus:'normal',iStatus:'normal'});
function fixture(){const d=P.create('ohm');d.components[0].params.resistance=0;d.measurements={...E.empty(),voltage:'c4',current:'c2',resistance:'c3:a:b',axis:'IR',fit:true,fitModel:'inverse'};return d;}
function fitPath(data){return E.plot(data).match(/data-measurement-fit="true"[^>]* d="([^"]*)"/)[1];}
function pathPoints(path){const numbers=path.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);return Array.from({length:numbers.length/2},(_,n)=>({x:numbers[n*2],y:numbers[n*2+1]}));}
test('linear and proportional fits reach the whole plot, beyond the samples',()=>{
  for(const model of ['linear','proportional']){
    const rows=[10,20,21].map(x=>row(x,2*x+(model==='linear'?.3:0))),path=fitPath({...E.empty(),rows,fit:true,fitModel:model}),p=pathPoints(path);
    assert(p.length>=2);near(p[0].x,55);near(p.at(-1).x,275);assert(p.every(p=>p.y>=40-1e-7&&p.y<=205+1e-7));
  }
});
test('steep line intersects the real top and bottom without slope-altering clamps',()=>{
  const rows=[1,1.0001,1.0002].map(x=>row((x-1)*10000,x)),p=pathPoints(fitPath({...E.empty(),rows,axis:'UI',fit:true}));
  assert.equal(p.length,2);near(p[0].y,205);near(p[1].y,40);assert(p[1].x-p[0].x<.05);
});
test('quadratic and inverse curves extend and stay inside the rectangle',()=>{
  const quadratic={...E.empty(),axis:'UI',fit:true,fitModel:'quadratic',rows:[1,2,3].map(x=>row((x-2)**2,x))},p=pathPoints(fitPath(quadratic));
  near(p[0].y,40);near(p.at(-1).y,40);assert(p.every(p=>p.x>=55-1e-7&&p.x<=275+1e-7&&p.y>=40-1e-7&&p.y<=205+1e-7));
  const inverse={...E.empty(),fit:true,fitModel:'inverse',rows:[-2,-1,1,2].map(x=>row(x,2/x))},path=fitPath(inverse);assert.equal((path.match(/M/g)||[]).length,2);assert(!/NaN|Infinity/.test(path));
  assert(pathPoints(path).every(p=>p.x>=55-1e-7&&p.x<=275+1e-7&&p.y>=40-1e-7&&p.y<=205+1e-7));
});
test('fixed voltage records R independently and gives I = 6/R',()=>{
  const d=fixture();for(const position of [.4,.6,.8,1]){d.components[2].params.position=position;const r=E.record(d,S.solve(d),'c4','c2');near(r.u,6);near(r.r,20*position);near(r.i,6/r.r);}
  const result=E.fit(d.measurements.rows,'IR','inverse');near(result.coefficients[0],6);near(result.rSquared,1);assert(E.formula(result,'IR').tex.includes('I=\\frac{6}{R}'));
  d.components[1].params.resistance=2;const r=E.record(d,S.solve(d),'c4','c2');near(r.r,20);near(r.u/r.i,22);assert.notEqual(r.r,r.u/r.i,'a measured ratio would make the verification circular');
  const original=d.measurements.rows[0].r;d.components[2].params.position=.9;assert.equal(d.measurements.rows[0].r,original,'historical R is frozen');
});
test('all six axes fit their SI values, formulas and scaled currents',()=>{
  for(const [axis,a]of Object.entries(E.axes)){
    const rows=[1,2,4,7].map(x=>({...row(1,.0005,10),[a.x]:x,[a.y]:3/x})),result=E.fit(rows,axis,'inverse');near(result.coefficients[0],3);near(result.rSquared,1);
    const formula=E.formula(result,axis);assert(formula.tex.startsWith(a.y.toUpperCase()+'=')&&formula.tex.endsWith('{'+a.x.toUpperCase()+'}'));
    const plot=E.plot({...E.empty(),axis,rows,fit:true,fitModel:'inverse'});assert.equal(XMLValidator.validate(plot),true);assert.equal((plot.match(/data-measurement-point=/g)||[]).length,4);
  }
  const d=fixture();for(const position of [.4,.6,.8,1]){d.components[2].params.position=position;E.record(d,S.solve(d),'c4','c2');}
  for(const axis of ['IR','RI']){const plot=E.plot({...d.measurements,axis});assert(plot.includes('mA'));assert(plot.includes('R\\,/\\,\\Omega'));}
});
test('rheostat segments and real lamp resistance are explicit sources',()=>{
  const d=P.create('limiting'),c=d.components[1];c.params.position=.3;
  for(const [pair,value]of [['a:b',6],['c:b',14],['a:c',20]])near(E.resistanceReading(d,S.solve(d),c.id+':'+pair).value,value);
  const lamp=d.components[2];lamp.params.model='thermal';lamp.params.coldRatio=10;const result=S.solve(d);near(E.resistanceReading(d,result,lamp.id+':a:b').value,result.components[lamp.id].resistance);assert(result.components[lamp.id].resistance<lamp.params.resistance);
  M.connect(d,'c1:a','c1:b',[],'free');assert.equal(E.resistanceReading(d,S.solve(d),lamp.id+':a:b').value,null,'unknown thermal working resistance is not the rated value');
});
test('legacy rows remain unchanged and missing R is neither zero nor a plotted point',()=>{
  const d=fixture();delete d.measurements.resistance;d.measurements.axis='IU';d.measurements.rows=[row(6,.5)];delete d.measurements.rows[0].r;delete d.measurements.rows[0].rLabel;
  const stored=D.encode(d),restored=D.decode(stored);assert.equal(D.encode(restored),stored);restored.measurements.axis='IR';restored.measurements.resistance='c3:a:b';
  assert.throws(()=>E.record(restored,S.solve(restored),'c4','c2',null),/電阻來源/);E.record(restored,S.solve(restored),'c4','c2');
  const plot=E.plot(restored.measurements);assert.equal((plot.match(/data-measurement-point=/g)||[]).length,1);assert(plot.includes('data-measurement-point="1"'));assert.equal(restored.measurements.rows[0].r,undefined);
  assert(E.csv(restored.measurements).includes('"R (Ω)"'));assert(E.csv(restored.measurements).includes('"1","6","0.5",""'));
});
test('production save/restore, continuation, deletion and undo preserve R snapshots',()=>{
  const d=fixture();E.record(d,S.solve(d),'c4','c2');const stored=D.encode(d),restored=D.decode(stored);assert.equal(D.encode(restored),stored);restored.components[2].params.position=.75;E.record(restored,S.solve(restored),'c4','c2');near(restored.measurements.rows[1].r,15);
  const h=M.history(restored);h.change(doc=>M.remove(doc,'c3'));assert.equal(h.get().measurements.resistance,null);near(h.get().measurements.rows[1].r,15);h.undo();assert.equal(D.encode(h.get()),D.encode(restored));
  const template=D.template(restored);assert.equal(template.measurements.resistance,'c3:a:b');assert.equal(template.measurements.rows.length,0);M.validate(template);
  const rheo=P.create('limiting');rheo.measurements={...E.empty(),resistance:'c2:c:b'};M.setTerminals(rheo,'c2',2);assert.equal(rheo.measurements.resistance,null);M.validate(rheo);
  rheo.measurements.resistance='c2:a:b';M.setTerminals(rheo,'c2',4);assert.equal(rheo.measurements.resistance,'c2:a:b');M.validate(rheo);
});
test('invalid references, values and incomplete R snapshots are rejected',()=>{
  const d=fixture();E.record(d,S.solve(d),'c4','c2');
  for(const source of ['',false,{},'c1:a:b','c3:c:b','c999:a:b','c3:a:a']){const bad=M.clone(d);bad.measurements.resistance=source;assert.throws(()=>D.decode(JSON.stringify(bad)));}
  for(const fn of [r=>r.r=-1,r=>r.r='10',r=>delete r.rLabel,r=>r.rLabel='',r=>{r.r=null;r.rLabel='R';},r=>r.extra=1]){const bad=M.clone(d);fn(bad.measurements.rows[0]);assert.throws(()=>D.decode(JSON.stringify(bad)));}
  const before=D.encode(d);assert.throws(()=>E.record(d,S.solve(d),'c4','c2','c999:a:b'));assert.equal(D.encode(d),before);
  d.measurements.rows[0].rLabel='=HYPERLINK("evil")';assert(E.csv(d.measurements).includes("'=HYPERLINK"));
});
console.log(`Resistance recording / plot range: ${cases} focused groups passed; full frame curves, independent R / fixed U, six axes, working segments, strict legacy/new persistence and continuation.`);
