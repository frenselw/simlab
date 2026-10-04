'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),R=require('./component-registry'),
  D=require('./circuit-document'),P=require('./presets'),S=require('./circuit-solver'),Profile=require('./circuit-profile');
let cases=0;
function test(name,fn){fn();cases++;console.log('✓ '+name);}
const component=type=>M.component(M.empty(),type,200,200);
test('one primary control per useful component uses actual parameter metadata',()=>{
  for(const [type,key,label,unit]of [['battery','voltage','電動勢','V'],['resistor','resistance','電阻','Ω'],['lamp','resistance','電阻','Ω'],['rheostat','position','滑片位置','%']]){
    const c=component(type),p=R.primaryParameter(c);assert.equal(p.key,key);assert.equal(p.label,label);assert.equal(p.unit,unit);
    assert.equal(p.value,c.params[key]);assert.equal(p.min,R.get(type).params[key].min);assert.equal(p.step,R.get(type).params[key].step);
  }
  const thermal=component('lamp');thermal.params.model='thermal';assert.equal(R.primaryParameter(thermal).label,'熱態電阻');
  for(const type of ['switch','ammeter','voltmeter','galvanometer','wattmeter'])assert.equal(R.primaryParameter(component(type)),null);
});
test('steps clamp at real bounds without floating drift; slider display stays percent',()=>{
  const e=component('battery');assert.equal(R.stepPrimaryParameter(e,1),6.5);assert.equal(R.stepPrimaryParameter(e,-1),5.5);
  e.params.voltage=119.8;assert.equal(R.stepPrimaryParameter(e,1),120);e.params.voltage=.2;assert.equal(R.stepPrimaryParameter(e,-1),0);
  const r=component('resistor');r.params.resistance=.01;assert.equal(R.stepPrimaryParameter(r,-1),.01);assert.equal(R.stepPrimaryParameter(r,1),1.01);
  const slider=component('rheostat');for(let i=0;i<50;i++)slider.params.position=R.stepPrimaryParameter(slider,1);
  assert.equal(slider.params.position,1);assert.equal(R.primaryParameter(slider).factor,100);assert.equal(R.stepPrimaryParameter(slider,1),1);
  assert.throws(()=>R.stepPrimaryParameter(slider,0));assert.throws(()=>R.stepPrimaryParameter(component('switch'),1));
});
test('quick UI is configurable and never expands exact parameter permissions',()=>{
  const d=M.empty(),c=M.add(d,'battery',200,200),profile=Profile.compile({initialDocument:d,components:{default:{params:['voltage']}}});
  assert(profile.ui.quickParameters);assert(profile.allows(d,c,'params','voltage'));assert(!profile.allows(d,c,'params','resistance'));
  assert.equal(Profile.compile({initialDocument:d,ui:{quickParameters:false}}).ui.quickParameters,false);
  assert.throws(()=>Profile.compile({ui:{quickParameters:'yes'}}));
  const next=M.clone(d);next.components[0].params.voltage=9;profile.assertTransition(d,next);
  assert.throws(()=>profile.assertTransition(d,next,true));assert.throws(()=>Profile.compile({initialDocument:d}).assertTransition(d,next));
  d.policy.mode='wiring';assert(!profile.allows(d,c,'params','voltage'));c.editable=true;assert(profile.allows(d,c,'params','voltage'));
  d.policy.mode='free';c.locked=true;assert(!profile.allows(d,c,'params','voltage'));
});
test('a parameter change is one history item and a restored circuit can continue',()=>{
  const d=P.create('series'),history=M.history(d),before=D.encode(d);
  history.change(n=>{n.components[0].params.voltage=9;});
  assert(Math.abs(S.solve(history.get()).components.c1.current+.375)<1e-8);
  assert(history.undo());assert.equal(D.encode(history.get()),before);assert(history.redo());
  const restored=D.decode(D.encode(history.get()));restored.components[0].params.voltage=R.stepPrimaryParameter(restored.components[0],-1);
  assert.equal(restored.components[0].params.voltage,8.5);assert.equal(restored.version,4);
  assert.deepEqual(restored.wires,d.wires);assert.deepEqual(restored.cables,d.cables);
  assert(!Object.hasOwn(restored,'quickParameters'));assert(!Object.hasOwn(restored.components[0],'primaryParameter'));
});
test('invalid numeric changes are atomic and cannot override fixed values',()=>{
  const d=M.empty();M.add(d,'battery',200,200);const history=M.history(d),before=D.encode(d);
  for(const value of [-1,121,NaN,Infinity,'9']){
    assert.throws(()=>history.change(n=>n.components[0].params.voltage=value));assert.equal(D.encode(history.get()),before);assert(!history.canUndo());
  }
});
test('a trusted registry extension can declare its own primary numeric control',()=>{
  R.register('quick-control-test',{name:'測試元件',icon:'T',ports:R.definitions.resistor.ports,
    primaryParameter:'level',params:{level:{label:'控制量',unit:'',value:.25,min:0,max:1,step:.1,factor:10}},dc:()=>[]});
  const c=component('quick-control-test'),p=R.primaryParameter(c);
  assert.equal(p.key,'level');assert.equal(p.factor,10);assert.equal(p.value,.25);assert.equal(R.stepPrimaryParameter(c,1),.35);
});
console.log('Quick component controls: '+cases+' focused groups passed.');
