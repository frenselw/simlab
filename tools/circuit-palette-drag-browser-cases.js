'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model');
async function paletteDragCases(h,mode,base){
  const button=key=>key==='wire-tool'?'[data-circuit-id="addWire"]':`[data-add="${key}"]`;
  async function launch(width=1280){await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:2});await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();}
  async function fixture(view='real',scale=1,cables={}){
    const d=M.empty();d.display.view=view;Object.assign(d.cables,cables);await h.load(d);
    await h.inside(`window.__paletteUnsubscribe?.();window.__paletteChanges=0;window.__paletteUnsubscribe=CircuitWorkbench.onChange(()=>__paletteChanges++);window.__paletteEventAbort?.abort();window.__paletteEventAbort=new AbortController();window.__paletteEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>__paletteEvents.push({type,trusted:e.isTrusted,pointer:e.pointerType,key:e.target.closest('[data-add]')?.dataset.add}),{capture:true,signal:__paletteEventAbort.signal});`);
    const p=await h.point('[data-circuit-id="surface"]');await h.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:p.x,y:p.y,deltaX:0,deltaY:-Math.log(scale)/.0015});await h.delay(70);
  }
  const target=()=>h.inside(`(()=>{const r=document.querySelector('[data-circuit-id=surface]').getBoundingClientRect(),c=CircuitWorkbench.getInteraction().camera,x=r.left+r.width*.4,y=r.top+r.height*.45;return{x,y,world:{x:Math.round((c.x+(x-r.left)/c.scale)/20)*20,y:Math.round((c.y+(y-r.top)/c.scale)/20)*20}};})()`);
  async function begin(key,to,pointer='mouse'){
    const p=await h.point(button(key));await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,pointerType:pointer});
    await h.inside(`window.__paletteDown=[];document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-add],[data-circuit-id=addWire]');if(b)__paletteDown.push({trusted:e.isTrusted,type:e.pointerType,id:e.pointerId,action:getComputedStyle(b).touchAction});},{once:true,capture:true});`);
    await h.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1,pointerType:pointer});
    for(let n=1;n<=5;n++){await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+(to.x-p.x)*n/5,y:p.y+(to.y-p.y)*n/5,button:'left',buttons:1,pointerType:pointer});await h.delay(15);}
  }
  async function end(to,pointer='mouse'){await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:to.x,y:to.y,button:'left',buttons:0,clickCount:1,pointerType:pointer});await h.delay(70);}
  const preview=()=>h.inside(`(()=>{const e=document.querySelector('[data-palette-preview]');return e?{key:e.dataset.palettePreview,transform:e.getAttribute('transform'),hit:getComputedStyle(e).pointerEvents}:null;})()`);
  const evidence=(kind,data={})=>h.evidence.push({mode,paletteDrag:kind,...data});
  await launch();
  for(const pointer of ['mouse','pen'])for(const view of ['real','schematic'])for(const scale of [.7,1.3]){
    await fixture(view,scale);const saved=await h.save(),camera=await h.inside('CircuitWorkbench.getInteraction().camera'),to=await target();await begin('rheostat',to,pointer);
    const ghost=await preview();assert(ghost);assert.equal(ghost.transform,`translate(${to.world.x} ${to.world.y})`);assert.equal(ghost.hit,'none');assert.equal(await h.save(),saved);assert.equal(await h.inside('__paletteChanges'),0);
    const down=await h.inside('__paletteDown');assert(down[0].trusted);assert.equal(down[0].type,pointer);if(pointer==='pen')assert.equal(down[0].action,'none','pen owns drag before pointerdown');
    if(pointer==='mouse'&&view==='real'&&scale===.7)await h.screenshot(`${mode}-palette-drag-preview.png`);
    await end(to,pointer);const d=await h.doc();assert.equal(d.components.length,1,'release and click add exactly once');assert.equal(d.components[0].type,'rheostat');assert.equal(d.components[0].x,to.world.x);assert.equal(d.components[0].y,to.world.y);assert.equal(await h.inside('__paletteChanges'),1);assert.equal(await preview(),null);assert.deepEqual(await h.inside('CircuitWorkbench.getInteraction().camera'),camera,'drop preserves view');
    const events=await h.inside(`__paletteEvents.filter(e=>e.key==='rheostat')`);assert(events.every(e=>e.trusted&&e.pointer===pointer));assert(events.some(e=>e.type==='pointermove'));assert(events.some(e=>e.type==='pointerup'));assert(!events.some(e=>e.type==='pointercancel'));
    const placed=await h.save();await h.click('#undo');assert.equal(await h.save(),saved);await h.click('#redo');assert.equal(await h.save(),placed);await h.load(placed);assert(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c1',key:'position',value:.75})`));assert.equal((await h.doc()).components[0].params.position,.75);
    evidence('placement',{pointer,view,scale,ghost:ghost.transform,exactPosition:true,oneCommit:true,undoRedo:true,restoredContinuation:true});
  }
  for(const pointer of ['mouse','pen'])for(const view of ['real','schematic'])for(const [length,scale]of [[120,.7],[600,1.3]]){
    await fixture(view,scale,{length,resistance:2});const saved=await h.save(),to=await target(),camera=await h.inside('CircuitWorkbench.getInteraction().camera');await begin('wire-tool',to,pointer);
    const ends=await h.inside(`(()=>{const g=document.querySelector('[data-wire-tool-preview]');return [...g.querySelectorAll('circle')].map(e=>({x:+e.getAttribute('cx'),y:+e.getAttribute('cy')}));})()`);
    if(pointer==='mouse'&&view==='real'&&length===120)await h.screenshot(`${mode}-wire-tool-drag-preview.png`);
    assert.equal(await h.save(),saved);assert.equal(await h.inside('__paletteChanges'),0);await end(to,pointer);const d=await h.doc(),w=d.wires[0],points=M.endpoints(d);
    assert.equal(d.wires.length,1);assert.equal(d.junctions.length,2);assert.equal(d.components.length,0);assert.deepEqual(ends.map(p=>({x:p.x,y:p.y})),[points.get(w.from),points.get(w.to)].map(p=>({x:p.x,y:p.y})));assert.equal((ends[0].x+ends[1].x)/2,to.world.x);assert.equal(ends[0].y,to.world.y);assert.equal(w.length,length);assert.equal(w.resistance,2);assert.equal(await preview(),null);assert.equal(await h.inside('__paletteChanges'),1);assert.deepEqual(await h.inside('CircuitWorkbench.getInteraction().camera'),camera);
    const placed=await h.save();await h.click('#undo');assert.equal(await h.save(),saved);await h.click('#redo');assert.equal(await h.save(),placed);await h.load(placed);
    assert(await h.inside(`CircuitWorkbench.execute({type:'addComponent',key:'resistor',x:${to.world.x},y:${to.world.y}})`));for(const [end,port]of [['from','a'],['to','b']])assert(await h.inside(`CircuitWorkbench.execute({type:'attach',id:'w1',end:'${end}',target:'c1:${port}'})`));
    evidence('wire-placement',{pointer,view,scale,length,resistance:2,previewEnds:ends,oneCommit:true,undoRedo:true,restoredWiring:true});
  }
  for(const key of ['battery','wire-tool'])for(const kind of ['outside','escape','blur','capture','resize','load','readonly','destroy']){
    await fixture();const saved=await h.save(),to=await target();await begin(key,to);assert(await preview());
    if(kind==='outside'){const p=await h.point('#settings');await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,button:'left',buttons:1});assert.equal(await preview(),null);await end(p);}
    else{
      if(kind==='escape')await h.key('Escape','Escape',27);
      if(kind==='blur')await h.inside(`window.dispatchEvent(new Event('blur'))`);
      if(kind==='capture'){await h.inside(`const b=document.querySelector(${JSON.stringify(button(key))});b.releasePointerCapture(__paletteDown[0].id);`);await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:to.x+2,y:to.y,button:'left',buttons:1});}
      if(kind==='resize'){await h.send('Emulation.setDeviceMetricsOverride',{width:1200,height:800,deviceScaleFactor:1,mobile:false});await h.delay(100);}
      if(kind==='load')await h.load(M.empty());
      if(kind==='readonly')await h.inside('CircuitWorkbench.setReadOnly(true)');
      if(kind==='destroy')await h.inside('window.__oldPaletteEditor=CircuitWorkbench;CircuitWorkbench.destroy()');
      await end(to);
    }
    assert.equal(await h.save(),saved);assert.equal(await preview(),null);assert.equal(await h.inside('CircuitWorkbench.getInteraction().dragging'),null);
    if(kind==='readonly')await h.inside('CircuitWorkbench.setReadOnly(false)');
    if(kind==='destroy')await h.inside(`(async()=>{window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),{role:'teacher',idPrefix:''});})()`);
    if(kind==='resize')await h.send('Emulation.setDeviceMetricsOverride',{width:1280,height:844,deviceScaleFactor:1,mobile:false});
    evidence('cancel',{key,kind,noComponent:true,noPreview:true});
  }
  await fixture('real',1,{count:1});let wireTarget=await target();await begin('wire-tool',wireTarget);await end(wireTarget);const wireFull=await h.save();assert(await h.inside(`document.querySelector('[data-circuit-id=addWire]').disabled`));await begin('wire-tool',wireTarget);await end(wireTarget);assert.equal(await h.save(),wireFull);await h.inside(`CircuitWorkbench.execute({type:'remove',id:'w1'})`);await h.click(button('wire-tool'));assert.equal((await h.doc()).wires.length,1);await h.click('#undo');await h.inside(`document.querySelector('[data-circuit-id=addWire]').focus()`);await h.key('Enter','Enter',13);assert.equal((await h.doc()).wires.length,1);evidence('wire-stock-click-keyboard',{stock:true,deleteReturnsStock:true,click:true,keyboard:true});
  const fixed=M.empty();fixed.policy.mode='wiring';await h.load(fixed);await h.click('#pan');assert(await h.inside('CircuitWorkbench.getInteraction().panMode'));wireTarget=await target();await begin('wire-tool',wireTarget,'pen');await end(wireTarget,'pen');assert.equal((await h.doc()).wires.length,1);assert.equal(await h.inside('CircuitWorkbench.getInteraction().panMode'),false);evidence('wire-fixed-mode',{allowed:true,returnsToWiring:true});
  await fixture();await h.click(button('battery'));assert.equal((await h.doc()).components.length,1);await h.click('#undo');await h.inside(`document.querySelector('[data-add=lamp]').focus()`);await h.key('Enter','Enter',13);assert.equal((await h.doc()).components[0].type,'lamp');evidence('click-keyboard',{onePerClick:true,keyboard:true});
  const initial=M.empty();M.add(initial,'battery',180,220);
  const config={initialDocument:initial,palette:[{type:'battery',limit:1},{type:'rheostat',key:'fixed-rheo',params:{resistance:120},limit:1}],components:{default:{remove:true}},ui:{palette:true,inspector:true}};
  await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),${JSON.stringify(config)});})()`);
  assert(await h.inside(`document.querySelector('[data-add=battery]').disabled`));await h.inside(`CircuitWorkbench.execute({type:'remove',id:'c1'})`);
  let to=await target();await begin('fixed-rheo',to,'pen');await end(to,'pen');let d=await h.doc();assert.equal(d.components[0].id,'c2','author ID is reserved');assert.equal(d.components[0].params.resistance,120);assert(await h.inside(`document.querySelector('[data-add=fixed-rheo]').disabled`));
  const full=await h.save();await begin('fixed-rheo',to);await end(to);assert.equal(await h.save(),full);assert.equal(await preview(),null);
  assert.equal(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c2',key:'resistance',value:80})`),false);await h.load(full);await h.inside(`CircuitWorkbench.execute({type:'remove',id:'c2'})`);await begin('fixed-rheo',to);await end(to);assert.equal((await h.doc()).components.length,1);evidence('student-stock',{stock:true,authorIds:true,fixedParameters:true,restoredStock:true});
  await h.inside(`(async()=>{const other=document.createElement('div');other.id='other';other.style.cssText='position:fixed;left:20px;top:130px;width:280px;height:350px;z-index:20';document.body.append(other);window.__otherEditor=await CircuitEditor.mount(other,{ui:{header:false,inspector:false,viewToggle:false}});})()`);
  await h.inside(`CircuitWorkbench.execute({type:'remove',id:'c2'})`);const other=await h.point('#other [data-circuit-id=surface]');await begin('fixed-rheo',other);await end(other);assert.equal((await h.doc()).components.length,0);assert.equal(await h.inside('__otherEditor.getDocument().components.length'),0);await h.inside('__otherEditor.destroy();document.getElementById("other").remove()');evidence('isolation',{otherCanvasRejected:true});
  await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),{role:'teacher',wires:false});})()`);assert.equal(await h.inside(`document.querySelector('[data-circuit-id=addWire]')`),null);assert.equal(await h.inside(`CircuitWorkbench.execute({type:'addWire',x:100,y:100})`),false);assert.equal((await h.doc()).wires.length,0);evidence('wire-forbidden',{buttonAbsent:true,commandRejected:true});
  for(const width of [320,390]){
  await launch(width);const touchDoc=M.empty();M.add(touchDoc,'rheostat',300,240);await h.load(touchDoc);await h.touch(await h.point('[data-hit="body:c1"]'),0,0);await h.touch(await h.point('#panelToggle'),0,0);await h.inside(`document.querySelector('[data-circuit-id=panel]').scrollTop=0`);
  assert(await h.inside(`(()=>{const p=document.querySelector('[data-circuit-id=panel]');return p.scrollHeight-p.clientHeight>110;})()`),'selected-component panel has native scroll range');
  const row=await h.point(button('battery'));await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:row.x,y:row.y,pointerType:'pen'});
  await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:100,pointerType:'pen'});assert.equal(await h.inside(`getComputedStyle(document.querySelector('[data-add=battery]')).touchAction`),'pan-y','leaving pen hover restores the next gesture owner');
  const saved=await h.save();await h.touch(row,0,-110,async()=>{assert.equal(await h.save(),saved);assert.equal(await preview(),null);});
  assert(await h.inside(`document.querySelector('[data-circuit-id=panel]').scrollTop>20`),'finger scrolls the panel from a palette button');assert.equal(await h.inside(`getComputedStyle(document.querySelector('[data-add=battery]')).touchAction`),'pan-y');
  await h.inside(`document.querySelector('[data-circuit-id=panel]').scrollTop=0`);await h.touch(await h.point(button('battery')),0,0);assert.equal((await h.doc()).components.length,2);evidence('touch',{width,nativePanelScroll:true,penToTouch:true,tapAddsOne:true});
  const wireRow=await h.point(button('wire-tool')),beforeScroll=await h.inside(`document.querySelector('[data-circuit-id=panel]').scrollTop`),beforeWire=await h.save();await h.touch(wireRow,0,-110,async()=>{assert.equal(await h.save(),beforeWire);assert.equal(await preview(),null);});assert(await h.inside(`document.querySelector('[data-circuit-id=panel]').scrollTop`)>beforeScroll+20);await h.touch(await h.point(button('wire-tool')),0,0);assert.equal((await h.doc()).wires.length,1);evidence('wire-touch',{width,nativePanelScroll:true,tapAddsOne:true});
  }
}
module.exports={paletteDragCases};
