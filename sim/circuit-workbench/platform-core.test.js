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
test('fixed switch stock uses switch and document permissions, not generic params',()=>{
  const palette=[{type:'switch',key:'open',params:{closed:false},limit:1},{type:'switch',key:'closed',params:{closed:true},limit:1}];
  for(const params of [true,['closed']])for(const allowSwitch of [false,true]){
    const initial=M.empty();initial.policy.allowSwitch=allowSwitch;
    const p=P.compile({initialDocument:initial,palette,components:{default:{params,switch:false}}}),d=M.clone(p.initial);
    for(const e of p.palette)M.add(d,'switch',200+200*d.components.length,200,e.params);
    p.assertSnapshot(d);assert.deepEqual(p.palette.map(e=>p.count(d,e)),[1,1]);assert(p.palette.every(e=>!p.canAdd(e,d)));
    const restored=p.assertSnapshot(D.decode(D.encode(d)));assert.deepEqual(p.palette.map(e=>p.count(restored,e)),[1,1]);
    const one=P.compile({initialDocument:initial,palette:[palette[1]],components:{default:{params,switch:!allowSwitch}}}),bad=M.clone(one.initial);M.add(bad,'switch',200,200,{closed:false});assert.throws(()=>one.assertSnapshot(bad),/未提供/);
    const changed=M.clone(d);changed.components[0].params.closed=true;assert.throws(()=>p.assertTransition(d,changed));
  }
  assert.throws(()=>P.compile({palette,components:{byType:{switch:{switch:true}}}}),/庫存有歧義/);
  const initial=M.empty();M.add(initial,'switch',200,200,{closed:true});
  assert.throws(()=>P.compile({initialDocument:initial,palette,components:{byId:{c1:{switch:true}}}}),/庫存有歧義/);
  initial.policy.allowSwitch=false;const p=P.compile({initialDocument:initial,palette,components:{byId:{c1:{switch:true}}}});assert.equal(p.allows(p.initial,p.initial.components[0],'switch'),false);assert.deepEqual(p.palette.map(e=>p.count(p.initial,e)),[0,1]);
});
test('document locks remain effective in initial stock discriminators',()=>{
  const initial=M.empty(),c=M.add(initial,'lamp',200,200,{resistance:12});c.locked=true;
  const p=P.compile({initialDocument:initial,palette:variants,components:{byId:{c1:{params:['resistance']}}}});assert.deepEqual(p.palette.map(e=>p.count(p.initial,e)),[1,0]);
  const bad=M.clone(p.initial);bad.components[0].params.resistance=24;assert.throws(()=>p.assertSnapshot(bad));
  const teacher=P.compile({role:'teacher',palette:[{type:'switch'}],components:{default:{params:true}}}),d=M.clone(teacher.initial);M.add(d,'switch',200,200,{closed:false});assert.equal(teacher.count(d,teacher.palette[0]),1,'teacher stock matching remains compatible');
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
test('shared point and lower-canvas wire creation preserves branches, stock, permissions and history in DC/AC/household',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),G=require('./circuit-routing'),source=fs.readFileSync(require.resolve('./circuit-editor'),'utf8');require('./circuit-ac-components');require('./circuit-household-components');
  const code=source.slice(source.indexOf('  function wirePlacement('),source.indexOf('  $("quickWire").onclick'));
  for(const [analysis,type,port]of [['dc','resistor','a'],['transient','resistor','a'],['household','house-socket','l']])for(const [width,height,scale]of [[390,360,.5],[1280,600,2],[320,100,.8]]){
    const d=M.empty(analysis),camera={x:-300,y:-200,scale},c=M.add(d,type,camera.x+width/2/scale,camera.y+height/3/scale),endpoint=c.id+':'+port,initial=M.clone(d);let history=M.history(d),enabled=true;
    const context=vm.createContext({M,R,G,camera,surface:{clientWidth:width,clientHeight:height},autoFit:true,selection:null,selectedConnection:null,panMode:false,probeMode:false,screen:p=>({x:(p.x-camera.x)*scale,y:(p.y-camera.y)*scale}),wireAllowed:()=>enabled,cancel(){},notify(){},addWire:M.addWire,change:fn=>{try{history.change(fn);return true;}catch{return false;}}});vm.runInContext(code,context);
    assert(context.takeWire());const loose=history.get(),w=loose.wires[0],a=M.endpoints(loose).get(w.from),b=M.endpoints(loose).get(w.to);assert(a.x<b.x);assert((a.y-camera.y)*scale>=height/2);for(const p of [a,b]){assert((p.x-camera.x)*scale>=0&&(p.x-camera.x)*scale<=width);assert((p.y-camera.y)*scale>=0&&(p.y-camera.y)*scale<=height);}assert.equal(w.length,d.cables.length);assert.equal(context.autoFit,false);
    assert(context.takeWire());assert.notDeepEqual(M.endpoints(history.get()).get(history.get().wires[1].from),a);assert(history.undo());assert.deepEqual(history.get(),loose);
    assert(context.takeWire(endpoint));const first=M.clone(history.get().wires),free=first[0].from;assert.equal(first.at(-1).from,endpoint);assert(context.takeWire(endpoint));assert.deepEqual(history.get().wires.slice(0,-1),first);assert.equal(M.degree(history.get(),endpoint),2);
    assert(context.takeWire(free));assert.equal(M.degree(history.get(),free),2,'an existing loose wire end can become a branch');const after=M.clone(history.get());assert.deepEqual(D.decode(D.encode(after)),after);assert(history.undo());assert(history.redo());assert.deepEqual(history.get(),after);
    enabled=false;assert.equal(context.takeWire(endpoint),false);assert.deepEqual(history.get(),after);enabled=true;
    const full=M.clone(after);full.cables.count=full.wires.length;history=M.history(full);assert.equal(context.takeWire(endpoint),false);assert.deepEqual(history.get(),full);assert.deepEqual(d,initial);
  }
});
test('shared connection actions show add for empty, loose and occupied points with touch-size targets and guards',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),G=require('./circuit-routing'),source=fs.readFileSync(require.resolve('./circuit-editor'),'utf8'),d=M.empty(),c=M.add(d,'resistor',200,100),endpoint=c.id+':a',targets=new Map();let enabled=true;
 const context=vm.createContext({M,R,G,targets,camera:{scale:1},surface:{clientWidth:320,clientHeight:240},selection:null,selectedConnection:endpoint,drag:null,cameraGesture:null,touches:new Map(),wireMode:false,probeMode:false,household:false,prefix:'test-',routes:{},screen:p=>p,allow:M.permission,wireAllowed:()=>enabled,readableMeter:()=>false,target:(key,meta,p,width,height)=>{const t=targets.get(key)||{style:{transform:''},classList:{toggle(){}},remove(){}};Object.assign(t,{meta,p,width,height});targets.set(key,t);return t;}});
 vm.runInContext(source.slice(source.indexOf('  function renderHits('),source.indexOf('  function canDiscard(')),context);
 context.renderHits(d);assert(targets.has('addConnectionWire'));assert(!targets.has('detachConnection'));assert.equal(targets.get('addConnectionWire').width,44);assert.equal(targets.get('addConnectionWire').height,44);
 const w=M.addWire(d,200,180);context.routes={[w.id]:G.route(d,w)};context.selectedConnection=w.from;context.renderHits(d);assert(targets.has('addConnectionWire'));assert(!targets.has('detachConnection'));
 assert(M.attach(d,w.id,'from',endpoint));context.selectedConnection=endpoint;context.routes={[w.id]:G.route(d,w)};context.renderHits(d);assert(targets.has('addConnectionWire'));assert(targets.has('detachConnection'));for(const key of ['addConnectionWire','detachConnection']){const t=targets.get(key);assert(t.p.x>=22&&t.p.x<=298&&t.p.y>=22&&t.p.y<=218);}
 d.cables.count=1;context.renderHits(d);assert.equal(targets.get('addConnectionWire').disabled,true);enabled=false;context.renderHits(d);assert(!targets.has('addConnectionWire'));assert(!targets.has('detachConnection'));enabled=true;context.probeMode=true;context.renderHits(d);assert(!targets.has('addConnectionWire'));
});
test('new branches choose separate visible directions around straight, bent and nearby wires',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),G=require('./circuit-routing'),source=fs.readFileSync(require.resolve('./circuit-editor'),'utf8'),code=source.slice(source.indexOf('  function wirePlacement('),source.indexOf('  $("quickWire").onclick'));
 for(const [analysis,type,port]of [['dc','resistor','a'],['transient','resistor','a'],['household','house-socket','l']])for(const end of ['from','to'])for(const bent of [false,true])for(const scale of [.5,2]){
  const d=M.empty(analysis),c=M.add(d,type,400,300);c.angle=end==='to'?90:0;const endpoint=c.id+':'+port,p=M.endpoints(d).get(endpoint),dx=p.dx,dy=p.dy;d.junctions.push({id:'far',x:p.x+dx*180,y:p.y+dy*180});const old=M.connect(d,end==='from'?endpoint:'far:p',end==='from'?'far:p':endpoint,[], 'free');if(bent)old.via=[{x:p.x+dx*60-dy*50,y:p.y+dy*60+dx*50}];const original=M.clone(old),history=M.history(d),camera={x:p.x-300/scale,y:p.y-220/scale,scale};
  const context=vm.createContext({M,R,G,camera,surface:{clientWidth:600,clientHeight:440},autoFit:false,selection:null,selectedConnection:null,panMode:false,probeMode:false,screen:p=>({x:(p.x-camera.x)*scale,y:(p.y-camera.y)*scale}),wireAllowed:()=>true,cancel(){},notify(){},addWire:M.addWire,change:fn=>{try{history.change(fn);return true;}catch{return false;}}});vm.runInContext(code,context);const directions=[];
  for(let n=0;n<3;n++){assert(context.takeWire(endpoint));const next=history.get(),wire=next.wires.at(-1),q=M.endpoints(next).get(wire.to),vx=q.x-p.x,vy=q.y-p.y,len=Math.hypot(vx,vy);assert(len>0);if(!bent)assert((vx*dx+vy*dy)/len<.98,'new wire separates from the original departure');for(const other of directions)assert((vx*other.x+vy*other.y)/len<.98,'repeated branches fan apart');directions.push({x:vx/len,y:vy/len});assert.deepEqual(next.wires[0],original);const shown=context.screen(q);assert(shown.x>=0&&shown.x<=600&&shown.y>=0&&shown.y<=440);assert.equal(wire.from,endpoint);assert.equal(wire.length,d.cables.length);}
  const final=M.clone(history.get());assert.deepEqual(D.decode(D.encode(final)),final);assert(history.undo());assert(history.redo());assert.deepEqual(history.get(),final);
 }
 const d=M.empty(),c=M.add(d,'resistor',400,300),p=M.endpoints(d).get(c.id+':b');d.junctions.push({id:'east',x:p.x+180,y:p.y},{id:'near-a',x:p.x-80,y:p.y+60},{id:'near-b',x:p.x+200,y:p.y+60});M.connect(d,c.id+':b','east:p',[],'free');const nearby=M.connect(d,'near-a:p','near-b:p',[],'free');const camera={x:p.x-300,y:p.y-220,scale:1},context=vm.createContext({M,R,G,camera,surface:{clientWidth:600,clientHeight:440},selection:null,screen:p=>({x:p.x-camera.x,y:p.y-camera.y})});vm.runInContext(code,context);const placement=context.wirePlacement(d,c.id+':b');assert(placement.to.y<p.y,'the free upper side avoids the unrelated wire below');assert(G.nearest(G.route(d,nearby),placement.to).distance>20);
 for(const scale of [.5,2]){const edge=M.empty(),c=M.add(edge,'resistor',400,300),p=M.endpoints(edge).get(c.id+':a');edge.junctions.push({id:'inward',x:p.x+200,y:p.y});M.connect(edge,c.id+':a','inward:p',[],'free');const camera={x:p.x-8/scale,y:p.y-24/scale,scale},context=vm.createContext({M,R,G,camera,surface:{clientWidth:390,clientHeight:240},selection:null,screen:p=>({x:(p.x-camera.x)*scale,y:(p.y-camera.y)*scale})});vm.runInContext(code,context);const q=context.screen(context.wirePlacement(edge,c.id+':a').to);assert(q.x>=0&&q.x<=390&&q.y>=0&&q.y<=240);assert(q.y>64,'when the outward side is offscreen, choose visible space away from the inward wire');}
});
test('clear wire ends continue forward before considering freer directions; obstacles divert them',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),G=require('./circuit-routing'),source=fs.readFileSync(require.resolve('./circuit-editor'),'utf8'),code=source.slice(source.indexOf('  function wirePlacement('),source.indexOf('  $("quickWire").onclick'));
 for(const analysis of ['dc','transient','household'])for(const end of ['from','to'])for(const bent of [false,true])for(const scale of [.5,2])for(const obstacle of ['none','wire','body']){
  const d=M.empty(analysis),p={x:400,y:300},dx=bent?0:1,dy=bent?1:0;d.junctions.push({id:'tip',...p},{id:'back',x:p.x-180,y:p.y-(bent?80:0)});
  const old=M.connect(d,end==='from'?'tip:p':'back:p',end==='from'?'back:p':'tip:p',bent?[{x:p.x,y:p.y-80}]:[],'free'),length=Math.min(120,d.cables.length*.65*scale),camera={x:p.x-300/scale,y:p.y-220/scale,scale};
  const side={x:p.x-dy*20/scale,y:p.y+dx*20/scale};d.junctions.push({id:'side-a',...side},{id:'side-b',x:side.x+dx*200/scale,y:side.y+dy*200/scale});M.connect(d,'side-a:p','side-b:p',[],'free');
  if(obstacle==='wire'){const q={x:p.x+dx*length*.65/scale,y:p.y+dy*length*.65/scale};d.junctions.push({id:'block-a',x:q.x-dy*40/scale,y:q.y+dx*40/scale},{id:'block-b',x:q.x+dy*40/scale,y:q.y-dx*40/scale});M.connect(d,'block-a:p','block-b:p',[],'free');}
  if(obstacle==='body')M.add(d,'resistor',p.x+dx*(length*.65/scale+75),p.y+dy*(length*.65/scale+75));
  const before=M.clone(d),context=vm.createContext({M,R,G,camera,selection:{kind:'wireend',id:old.id,end},surface:{clientWidth:600,clientHeight:440},screen:p=>({x:(p.x-camera.x)*scale,y:(p.y-camera.y)*scale})});vm.runInContext(code,context);
  const q=context.wirePlacement(d,'tip:p').to,vx=q.x-p.x,vy=q.y-p.y,cos=(vx*dx+vy*dy)/Math.hypot(vx,vy);
  if(obstacle==='none')assert(cos>.9999,'clear forward continuation beats a direction with more clearance');else assert(cos<.98,obstacle+' in front diverts the new wire');assert.deepEqual(d,before);
 }
 const css=fs.readFileSync(require.resolve('../circuit-household-workbench/styles.css'),'utf8');assert(!/stage-tools/.test(css),'household uses the shared responsive toolbar without hiding pan or overriding wrapping');
});
test('probe pointer sequences never start editing, change history or select transient edit targets',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('./circuit-editor'),'utf8'),events=source.slice(source.indexOf('  on(document,"pointerdown"'),source.indexOf('  function undo(')),probe=source.slice(source.indexOf('  function probePort('),source.indexOf('\n',source.indexOf('  function probePort('))),keys=source.slice(source.indexOf('  on(window,"keydown"'),source.indexOf('  on(window,"keyup"')),toggle=source.slice(source.indexOf('  $("probe").onclick='),source.indexOf('\n',source.indexOf('  $("probe").onclick=')));
 for(const [analysis,type,port]of [['dc','resistor','a'],['transient','resistor','a'],['household','house-socket','l']])for(const pointerType of ['mouse','touch'])for(const kind of ['port','wireend','junction','body','wire'])for(const gesture of ['tap','slip','drag','cancel']){
  const d=M.empty(analysis),c=M.add(d,type,200,200),w=M.addWire(d,400,300),endpoint=c.id+':'+port;d.junctions.push({id:'shared',x:160,y:70});M.connect(d,w.to,'shared:p');M.connect(d,'shared:p',endpoint);const history=M.history(d);history.change(doc=>doc.display.names=false);assert(history.undo());const before=D.encode(history.get()),identity=history.get(),listeners=new Map(),captured=new Set(),nodes=new Map(),rendered=[];
  const node=meta=>({meta,tagName:'BUTTON',contains:()=>false,closest:s=>s==='.hit'?meta?target:null:null,setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)}),target=node(null);target.meta=kind==='port'?{kind,id:endpoint}:kind==='wireend'?{kind,id:w.id,end:'from'}:{kind,id:kind==='junction'?'shared':kind==='body'?c.id:w.id};target.closest=s=>s==='.hit'?target:null;
  const surface={contains:e=>e===target,setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id),classList:{add(){},remove(){}}},document={activeElement:null},window={},host={contains:()=>true,querySelector:()=>null},$=id=>{if(!nodes.has(id))nodes.set(id,node(null));return nodes.get(id);};
  const context=vm.createContext({M,R,history,surface,document,window,host,$,camera:{x:0,y:0,scale:1},autoFit:false,household:analysis==='household',selection:{kind:'junction',id:'shared'},selectedConnection:'shared:p',probeMode:false,probeFirst:null,probeResult:null,drag:null,previewDoc:null,paramSession:null,discardZoneAt:()=>null,meterPreview:null,panMode:false,wireMode:false,spacePan:false,spacePanUsed:false,touchBlocked:false,touchOrigin:null,touches:new Map(),cameraGesture:null,suppressClick:false,releasedMeta:null,blankMouseDown:null,targets:new Map(),activeHost:host,analysis:{potentials:{[endpoint]:1},voltage:()=>42},Q:{quantity:(v,u)=>v+u},portName:id=>id,probeEndpointAt:()=>{const m=target.meta;return m?.kind==='port'?m.id:m?.kind==='junction'?m.id+':p':m?.kind==='wireend'?history.get().wires.find(w=>w.id===m.id)?.[m.end]:null;},referenceText:()=>'',notify:message=>context.lastMessage=JSON.stringify(message),render:()=>rendered.push(context.selection&&M.clone(context.selection)),owned:()=>true,releaseTouches:ids=>ids.forEach(id=>captured.delete(id)),cancelInteraction(){context.drag=null;context.releasedMeta=null;},cancel(){context.drag=null;},selectedWire:()=>null,selectedComponent:()=>null,wireAllowed:()=>true,allow:()=>true,world:(x,y)=>({x,y}),change:()=>assert.fail('probe must not mutate history'),on:(owner,event,fn)=>{const k=(owner===document?'document':owner===window?'window':'surface')+':'+event;listeners.set(k,fn);}});
  vm.runInContext(events+probe+keys+toggle,context);$('probe').onclick();assert.equal(context.selection,null);assert.equal(context.selectedConnection,null);
  const event=(x=160,y=70)=>({target,clientX:x,clientY:y,pointerId:1,pointerType,isPrimary:true,button:0,buttons:1,detail:1,preventDefault(){}}),dispatch=(name,e)=>{listeners.get('document:'+name)?.(e);listeners.get('surface:'+name)?.(e);};
  // Complete the first measurement point through the real click handler.
  const meta=target.meta;target.meta={kind:'port',id:endpoint};listeners.get('surface:click')(event());target.meta=meta;const selected=context.selection,renders=rendered.length;
  dispatch('pointerdown',event());assert.equal(context.drag,null);assert.equal(captured.size,0);assert.equal(context.selection,selected);assert.equal(rendered.length,renders,'pointerdown does not reflow selection tools');
  if(gesture==='slip'||gesture==='drag')dispatch('pointermove',event(gesture==='slip'?157:120,gesture==='slip'?68:40));dispatch(gesture==='cancel'?'pointercancel':'pointerup',event());
  if(gesture!=='cancel')listeners.get('surface:click')(event());assert.equal(context.drag,null);assert.equal(context.touches.size,0);assert(context.selection===null||context.selection.kind==='port');
  if(['wireend','junction'].includes(kind)&&['tap','slip'].includes(gesture))assert.equal(context.probeResult?.voltage,42,'endpoint clicks still measure');
  for(const key of ['ArrowLeft','Delete','r','Enter'])listeners.get('window:keydown')({...event(),key});assert.equal(D.encode(history.get()),before);assert.equal(history.get(),identity);assert.equal(history.canUndo(),false);assert.equal(history.canRedo(),true);assert(history.redo());assert.equal(history.get().display.names,false);assert(history.undo());assert.equal(D.encode(history.get()),before);
  if(pointerType==='mouse'&&kind==='junction'&&gesture==='tap'){
   context.probePort(endpoint);const first=context.probeFirst,closest=target.closest;target.closest=()=>null;
   dispatch('pointerdown',event());listeners.get('surface:mousedown')({...event(),detail:2});assert.equal(context.drag?.kind,'pan');dispatch('pointermove',event(200,100));dispatch('pointerup',event(200,100));assert.equal(context.probeFirst,first);assert.equal(context.probeMode,true);assert.equal(context.camera.x,-40);assert.equal(context.camera.y,-30);assert.equal(D.encode(history.get()),before);assert.equal(history.canUndo(),false);assert.equal(history.canRedo(),true);
   target.closest=closest;target.meta={kind:'junction',id:'shared'};dispatch('pointerdown',event());dispatch('pointerup',event());listeners.get('surface:click')(event());assert.equal(context.probeResult?.from,first);assert.equal(context.probeResult?.to,'shared:p');assert.equal(context.probeResult?.voltage,42);
  }
  context.probeMode=false;target.meta={kind:'junction',id:'shared'};dispatch('pointerdown',event());assert.equal(context.drag?.kind,'junction','normal editing remains available outside probe mode');
 }
});
test('probe coordinates resolve actual visible endpoints despite overlapping body and port hit areas',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),G=require('./circuit-routing'),source=fs.readFileSync(require.resolve('./circuit-editor'),'utf8'),pick=source.slice(source.indexOf('  function probeEndpointAt('),source.indexOf('  function probePort(')),fit=source.slice(source.indexOf('  function fit('),source.indexOf('  function focusPoint('));
 for(const analysis of ['dc','transient','household'])for(const [width,height]of [[1280,500],[390,280],[320,280],[320,100]]){
  const d=analysis==='household'?require('../circuit-household-workbench/presets').create('C01'):M.empty(analysis);if(!d.components.length)M.add(d,'resistor',200,200);const before=D.encode(d),camera={},targets=new Map(),ends=M.endpoints(d);let message='';
  for(const c of d.components){targets.set('body:'+c.id,{meta:{kind:'body',id:c.id}});for(const p of R.ports(c).filter(p=>!p.hidden))targets.set('port:'+p.id,{meta:{kind:'port',id:p.id}});}
  for(const j of d.junctions)targets.set('junction:'+j.id,{meta:{kind:'junction',id:j.id}});
  for(const w of d.wires)for(const end of ['from','to'])targets.set(w.id+end,{meta:{kind:'wireend',id:w.id,end,endpoint:w[end]}});
  let click,chosen;const context=vm.createContext({M,R,G,history:{get:()=>d},current:()=>d,camera,targets,household:analysis==='household',transient:analysis==='transient',surface:{clientWidth:width,clientHeight:height},world:(x,y)=>({x:camera.x+(x-31)/camera.scale,y:camera.y+(y-117)/camera.scale}),notify:m=>message=m,$:()=>({contains:()=>false}),probeMode:true,panMode:false,suppressClick:false,releasedMeta:null,probePort:id=>chosen=id,on:(_owner,_event,fn)=>click=fn});vm.runInContext(pick+fit+source.slice(source.indexOf('  on(surface,"click"'),source.indexOf('  function undo(')),context);context.fit();
  for(const [id,p]of ends){const clientX=31+(p.x-camera.x)*camera.scale,clientY=117+(p.y-camera.y)*camera.scale;assert.equal(context.probeEndpointAt(clientX,clientY),id,id+' at fitted scale '+camera.scale);click({detail:1,clientX,clientY,target:{closest:()=>({meta:{kind:'body',id:'wrong-body'}})}});assert.equal(chosen,id,'body overlay does not decide the click');}
  const reversed=new Map([...targets].reverse());context.targets=reversed;for(const c of d.components)for(const p of R.ports(c).filter(p=>!p.hidden)){const clientX=31+(p.x-camera.x)*camera.scale,clientY=117+(p.y-camera.y)*camera.scale;assert.equal(context.probeEndpointAt(clientX,clientY),p.id,'DOM order does not decide the probe');click({detail:1,clientX,clientY,target:{closest:()=>({meta:{kind:'port',id:ends.keys().next().value}})}});assert.equal(chosen,p.id,'overlapping neighboring port does not decide the click');}
  assert.equal(context.probeEndpointAt(-10000,-10000),null);assert.equal(D.encode(d),before);assert.equal(message,'');
  const id=ends.keys().next().value;click({detail:0,target:{closest:()=>({meta:{kind:'port',id}})}});assert.equal(chosen,id,'keyboard uses its focused terminal');
 }
 const d=M.empty();d.junctions.push({id:'a',x:0,y:0},{id:'b',x:2,y:0});const targets=new Map(d.junctions.map(j=>[j.id,{meta:{kind:'junction',id:j.id}}]));let message='';const context=vm.createContext({M,history:{get:()=>d},targets,camera:{scale:1},world:(x,y)=>({x,y}),notify:m=>message=m});vm.runInContext(pick,context);assert.equal(context.probeEndpointAt(1,0),null);assert.match(message,/放大/);assert.equal(context.probeEndpointAt(0,0),'a:p');
});
console.log(`Circuit platform: ${groups} focused groups passed.`);
