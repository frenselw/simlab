"use strict";
const assert=require("node:assert/strict"),M=require("../sim/circuit-workbench/circuit-model");

async function canvasLayoutCases(h,mode,base){
  console.log(`${mode}: full-width canvas and corner scroll grips`);
  await h.freshPage();h.setContext('window');
  const measure=()=>h.inside(`(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};},area=box(document.getElementById('canvasArea')),surface=document.getElementById('surface'),r=box(surface),c=CircuitWorkbench.getInteraction().camera,d=CircuitWorkbench.getDocument(),points=[...d.components.flatMap(c=>[{x:c.x-85,y:c.y-85},{x:c.x+85,y:c.y+125}]),...d.wires.flatMap(w=>CircuitRouting.route(d,w))];
    return{area,surface:r,svg:box(document.getElementById('circuitSvg')),touch:getComputedStyle(surface).touchAction,grips:[...document.querySelectorAll('.scroll-strip')].map(e=>({...box(e),touch:getComputedStyle(e).touchAction})),scroll:document.documentElement.scrollHeight-innerHeight,horizontal:document.documentElement.scrollWidth-innerWidth,panel:box(document.getElementById('panel')).height,scale:c.scale,full:points.every(p=>(p.x-c.x)*c.scale>=0&&(p.y-c.y)*c.scale>=0&&(p.x-c.x)*c.scale<=r.width&&(p.y-c.y)*c.scale<=r.height),hits:[...document.querySelectorAll('.hit.port')].map(e=>[e.clientWidth,e.clientHeight]),bottom:document.querySelector('.stage-bottom').getBoundingClientRect().bottom,inner:innerHeight};
  })()`);
  function check(b,label){
    for(const part of [b.surface,b.svg]){assert(Math.abs(part.width-b.area.width)<.02,`${label}: full canvas width`);assert(Math.abs(part.x-b.area.x)<.02,`${label}: no left gutter`);assert(Math.abs(part.right-b.area.right)<.02,`${label}: no right gutter`);}
    assert.equal(b.touch,'none');assert(b.grips.every(g=>g.width>=32&&g.height>=44&&g.height<=64&&g.touch==='pan-y'));assert(Math.abs(b.grips[0].x-b.area.x)<.02);assert(Math.abs(b.grips[1].right-b.area.right)<.02);assert(b.grips.every(g=>Math.abs(g.bottom-(b.area.bottom-8))<.02));
    assert(b.scroll<=1&&b.horizontal<=1);assert(b.panel===0||b.panel>=112);assert(b.hits.every(([w,height])=>w>=44&&height>=44));assert(b.full,`${label}: initial whole circuit fits`);assert(b.bottom<=b.inner+1);
  }
  for(const [width,height]of [[320,500],[390,500],[390,600],[390,844],[844,390],[640,450],[1024,768],[1280,720],[640,360]]){
    await h.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();await h.delay(100);
    const saved=await h.save(),bounds=await measure();check(bounds,`${width}×${height}`);await h.screenshot(`${mode}-canvas-${width}x${height}.png`);
    if(bounds.panel===0){await h.click('#panelToggle');const open=await measure();check(open,`${width} panel open`);await h.inside('document.getElementById("panel").scrollTop=1e6');assert(await h.inside('document.getElementById("panel").lastElementChild.getBoundingClientRect().bottom')<=height);if(width===390&&height===844)await h.screenshot(`${mode}-canvas-390x844-open.png`);await h.click('#panelToggle');check(await measure(),`${width} panel closed again`);}
    assert.equal(await h.save(),saved);h.evidence.push({mode,canvasWidth:true,viewport:[width,height],layout:bounds,panelToggle:true});
    if([[320,500],[390,844],[844,390]].some(([w,v])=>w===width&&v===height)){
      await h.touch(await h.point('#fullscreenButton'),0,0);assert.equal(await h.inside('document.fullscreenElement?.id'),'app');check(await measure(),`${width} fullscreen`);assert.equal(await h.save(),saved);await h.inside('document.exitFullscreen()');await h.delay(100);assert.equal(await h.inside('Boolean(document.fullscreenElement)'),false);check(await measure(),`${width} fullscreen exit`);h.evidence.push({mode,canvasWidth:true,viewport:[width,height],fullscreen:true,trusted:true});
    }
  }
  for(const width of [320,390])for(const view of ['real','schematic'])for(const side of ['left','right']){
    await h.send('Emulation.setDeviceMetricsOverride',{width,height:600,deviceScaleFactor:1,mobile:true});await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
    const d=M.empty();M.add(d,'resistor',200,200);d.display.view=view;d.display.flow='off';await h.load(d);
    await h.click('#pan');const center=await h.point('#surface'),position=await h.inside(`(()=>{const r=document.getElementById('surface').getBoundingClientRect(),c=CircuitWorkbench.getInteraction().camera;return{x:r.left+(200-c.x)*c.scale,y:r.top+(200-c.y)*c.scale,left:r.left,top:r.top,width:r.width,height:r.height};})()`),grip={x:position.left+(side==='left'?16:position.width-16),y:position.top+position.height*.35};
    await h.touch(center,grip.x-position.x,grip.y-position.y);await h.click('#pan');const before=await h.save();
    assert.equal(await h.inside(`document.elementFromPoint(${grip.x},${grip.y}).dataset.hit`),'body:c1',`${width} ${side}: recovered edge accepts the component`);
    await h.inside('window.__edgeEvents=[];for(const type of ["pointerdown","pointermove","pointerup","pointercancel"])document.getElementById("surface").addEventListener(type,e=>__edgeEvents.push({type,trusted:e.isTrusted,pointer:e.pointerType,target:e.target.dataset.hit}))');
    await h.touch(grip,side==='left'?24:-24,6);assert.notEqual(await h.save(),before);const events=await h.inside('__edgeEvents');assert(events.some(e=>e.type==='pointerdown'&&e.trusted&&e.pointer==='touch'&&e.target==='body:c1'));assert(events.some(e=>e.type==='pointerup'&&e.trusted));assert(!events.some(e=>e.type==='pointercancel'));assert.equal(await h.inside('scrollY'),0);await h.click('#undo');assert.equal(await h.save(),before);h.evidence.push({mode,canvasEdge:true,width,view,side,trusted:true,events,undo:true});
  }
}
async function scrollGripVisibilityCases(h,source){let checks=0;
 for(const mode of ['ac','dc']){
  const host=mode==='ac'?'#app':'#grip-dc',api=mode==='ac'?'CircuitACWorkbench':'__gripDC';
  if(mode==='dc')await h.inside(`(async()=>{const host=document.createElement('div');host.id='grip-dc';host.style.cssText='position:fixed;inset:0;background:white;z-index:200';document.body.append(host);window.__gripDC=await CircuitEditor.mount(host,{role:'teacher',initialDocument:CircuitPresets.create('series'),idPrefix:'grip-dc-'});})()`);
  const saved=await h.inside(api+'.exportDocument()');
  for(const width of [1280,390])for(const input of ['mouse','touch']){
   await h.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<960});await h.send('Emulation.setTouchEmulationEnabled',{enabled:input!=='mouse',maxTouchPoints:2});
   await h.delay(40);
   const result=await h.inside(`(()=>{const fine=matchMedia('(hover:hover) and (pointer:fine)').matches,coarse=matchMedia('(any-pointer:coarse)').matches,strips=[...document.querySelectorAll('${host} .scroll-strip')].map(e=>{const r=e.getBoundingClientRect();return {visible:e.getClientRects().length>0,width:r.width,height:r.height,touch:getComputedStyle(e).touchAction};});return {fine,coarse,strips};})()`);
   assert.equal(result.fine,input!=='touch',JSON.stringify({input,result}));assert.equal(result.coarse,input!=='mouse');assert.equal(result.strips.length,2);assert(result.strips.every(s=>s.visible===(input!=='mouse')&&(!s.visible||s.width>=32&&s.height>=44&&s.touch==='pan-y')));assert.equal(await h.inside(api+'.exportDocument()'),saved);checks+=5;
   if(mode==='ac'&&(width===1280&&input==='mouse'||width===390&&input==='touch'))await h.screenshot(source+'-scroll-grips-'+input+'-'+width);
  }
  if(mode==='dc')await h.inside('__gripDC.destroy();document.getElementById("grip-dc").remove();delete window.__gripDC');
 }
 await h.send('Emulation.setEmulatedMedia',{features:[]});console.log(source+' scroll-grip visibility '+checks+' checks passed');return checks;
}
async function historyIconCases(h,source){let checks=0;
 for(const mode of ['ac','dc'])for(const width of [1280,390]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
  const prefix=mode==='dc'?'#history-dc ':'';
  await h.inside(mode==='dc'?`(async()=>{const host=document.createElement('div');host.id='history-dc';host.style.cssText='position:fixed;inset:0;background:white;z-index:200';document.body.append(host);window.__historyEditor=await CircuitEditor.mount(host,{role:'teacher',idPrefix:'history-dc-'});})()`:'window.__historyEditor=CircuitACWorkbench');
  await h.inside('__historyEditor.loadDocument('+ (mode==='ac'?"CircuitACPresets.create('empty')":"CircuitModel.empty()")+')');
  const before=await h.inside('__historyEditor.getDocument()');
  const rects=await h.inside(`[...document.querySelectorAll('${prefix}[data-circuit-id=undo],${prefix}[data-circuit-id=redo]')].map(e=>{const r=e.getBoundingClientRect(),svg=e.querySelector('svg'),q=svg.getBoundingClientRect(),b=svg.getBBox();return{label:e.getAttribute('aria-label'),disabled:e.disabled,width:r.width,height:r.height,cx:q.x+q.width/2-r.x-r.width/2,cy:q.y+q.height/2-r.y-r.height/2,glyphWidth:b.width,glyphHeight:b.height,text:e.textContent};})`);
  assert.deepEqual(rects.map(r=>r.label),['復原','重做']);assert(rects.every(r=>r.width>=44&&r.height>=44&&Math.abs(r.cx)<.1&&Math.abs(r.cy)<.1&&r.glyphWidth>=18&&r.glyphHeight>=18&&r.text===''),JSON.stringify(rects));assert(rects[1].disabled);checks+=3;
  await h.inside("__historyEditor.execute({type:'addComponent',key:'resistor',x:200,y:200})");const changed=await h.inside('__historyEditor.getDocument()');assert.notDeepEqual(changed,before);checks++;
  const clip=await h.inside(`(()=>{const a=document.querySelector('${prefix}[data-circuit-id=undo]').getBoundingClientRect(),b=document.querySelector('${prefix}[data-circuit-id=redo]').getBoundingClientRect();return {x:a.x,y:a.y,width:b.right-a.x,height:a.height,scale:1};})()`);await h.screenshot(source+'-history-icons-'+mode+'-'+width,clip);
  await h.click(prefix+'[data-circuit-id=undo]');assert.deepEqual(await h.inside('__historyEditor.getDocument()'),before);assert(await h.inside(`!document.querySelector('${prefix}[data-circuit-id=redo]').disabled`));checks+=2;
  await h.click(prefix+'[data-circuit-id=redo]');assert.deepEqual(await h.inside('__historyEditor.getDocument()'),changed);checks++;
  if(mode==='dc')await h.inside('__historyEditor.destroy();document.getElementById("history-dc").remove()');await h.inside('delete window.__historyEditor');
 }
 console.log(source+' history icons: '+checks+' checks passed');return checks;
}
module.exports={canvasLayoutCases,scrollGripVisibilityCases,historyIconCases};
