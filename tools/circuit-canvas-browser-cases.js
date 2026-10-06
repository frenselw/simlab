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
module.exports={canvasLayoutCases};
