'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),P=require('./circuit-profile'),D=require('./circuit-document'),S=require('./circuit-solver'),V=require('./circuit-renderer'),R=require('./component-registry');
let groups=0;
function test(name,fn){fn();groups++;console.log('✓ '+name);}
const variants=[{type:'lamp',key:'low',params:{resistance:12},limit:1},{type:'lamp',key:'high',params:{resistance:24},limit:1}];
test('duplicate and mutable discriminators fail before mounting',()=>{
  assert.throws(()=>P.compile({palette:[variants[0],{...variants[0],key:'duplicate'}]}),/庫存有歧義/);
  for(const params of [true,['resistance']])assert.throws(()=>P.compile({palette:variants,components:{default:{params}}}),/庫存有歧義/);
  assert.throws(()=>P.compile({palette:[{type:'switch',key:'open',params:{closed:false}},{type:'switch',key:'closed',params:{closed:true}}],components:{byType:{switch:{switch:true}}}}),/庫存有歧義/);
});
test('type and ID overrides are applied to stock compatibility',()=>{
  assert.doesNotThrow(()=>P.compile({palette:variants,components:{default:{params:true},byType:{lamp:{params:false}}}}));
  const initial=M.empty(),lamp=M.add(initial,'lamp',200,200);
  assert.throws(()=>P.compile({initialDocument:initial,palette:variants,components:{byId:{[lamp.id]:{params:['resistance']}}}}),/庫存有歧義/);
  initial.components[0].params.model='thermal';
  assert.doesNotThrow(()=>P.compile({initialDocument:initial,palette:variants,components:{byId:{[lamp.id]:{params:['resistance']}}}}));
  initial.components[0].id='undefined';
  assert.throws(()=>P.compile({initialDocument:initial,palette:variants,components:{default:{params:true},byId:{undefined:{params:false}}}}),/庫存有歧義/,'new components must not inherit an initial ID rule through a missing ID');
});
test('immutable variants keep separate stock after edits and production document restore',()=>{
  const p=P.compile({palette:variants,components:{default:{move:true,remove:true}}}),initial=M.clone(p.initial);
  M.add(initial,'lamp',200,200,p.palette[0].params);M.add(initial,'lamp',400,200,p.palette[1].params);p.assertSnapshot(initial);
  assert.deepEqual(p.palette.map(e=>p.count(initial,e)),[1,1]);assert(p.palette.every(e=>!p.canAdd(e,initial)));
  const invalid=M.clone(initial);invalid.components[1].params.resistance=12;assert.throws(()=>p.assertTransition(initial,invalid));assert.equal(initial.components[1].params.resistance,24);
  const restored=p.assertSnapshot(D.decode(D.encode(initial))),next=M.clone(restored);M.remove(next,next.components[0].id);p.assertTransition(restored,next);
  assert.deepEqual(p.palette.map(e=>p.count(next,e)),[0,1]);assert(p.canAdd(p.palette[0],next));
  M.add(next,'lamp',250,200,p.palette[0].params);p.assertSnapshot(next);
});
test('fixed models can distinguish variants even when another parameter is adjustable',()=>{
  const palette=[{type:'lamp',key:'ideal',params:{model:'ideal'}},{type:'lamp',key:'thermal',params:{model:'thermal'}}];
  assert.doesNotThrow(()=>P.compile({palette,components:{byType:{lamp:{params:['resistance']}}}}));
  assert.throws(()=>P.compile({palette,components:{byType:{lamp:{params:['model']}}}}),/庫存有歧義/);
});
test('header is opt-in compatible and hidden header features fail closed',()=>{
  assert.equal(P.compile().ui.header,true);assert.equal(P.compile({role:'teacher'}).ui.header,true);
  const p=P.compile({ui:{header:false,probe:true}});assert.equal(p.ui.header,false);assert(p.ui.probe);
  assert.throws(()=>P.compile({ui:{header:'false'}}));
  assert.throws(()=>P.compile({ui:{header:false,help:true}}),/頂欄/);
  assert.throws(()=>P.compile({role:'teacher',ui:{header:false}}),/頂欄/);
  assert.doesNotThrow(()=>P.compile({role:'teacher',ui:{header:false,presets:false,files:false,settings:false,help:false}}));
});
test('pure DC hazards preserve short paths, finite resistance, unknowns and threshold semantics',()=>{
  const doc=M.empty(),source=M.add(doc,'battery',200,200),wire=M.connect(doc,source.id+':a',source.id+':b');
  let result=S.solve(doc);assert.equal(result.components[source.id].current,null);
  assert.deepEqual(S.hazards(doc,result),{wires:{[wire.id]:'short'},components:{[source.id]:'short'},short:true,overload:false});
  wire.resistance=6;result=S.solve(doc);assert.equal(S.hazards(doc,result).short,false);assert.equal(result.wires[wire.id].current,1);
  const lamp=M.add(doc,'lamp',500,200,R.defaults('lamp'));
  const check=power=>S.hazards(doc,{...result,components:{...result.components,[lamp.id]:{power}}});
  assert.equal(check(null).components[lamp.id],undefined);assert.equal(check(4.5).components[lamp.id],undefined);assert.equal(check(4.500001).components[lamp.id],'overload');
  assert.deepEqual(V.visualState(doc,result),S.hazards(doc,result));assert.equal(V.hazardLimits,S.hazardLimits);
});
console.log(`Circuit platform: ${groups} focused groups passed.`);
