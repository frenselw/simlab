'use strict';
// Observe the production RAF/SVG output; use trusted input for all user changes.
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model'),P=require('../sim/circuit-workbench/presets'),V=require('../sim/circuit-workbench/circuit-renderer');
const near=(a,b,t=1e-7)=>assert(Math.abs(a-b)<t,`${a} != ${b}`),step=(a,b)=>((b-a+97.5)%65)-32.5;
function unequalBranches(view='real',flow='electron'){const d=P.create('parallel');d.components[3].params.resistance=60;d.components[2].label='較大電流';d.components[3].label='較小電流';d.display.view=view;d.display.flow=flow;return d;}
async function flowCases(h,mode,base){
  const {inside,send,point,load,save,doc,key,delay,freshPage,ready,evidence}=h;let width=1280,contactId=41000;
  const speedFor=(d,s,id)=>{const wire=d.wires.find(w=>w.id===id);return V.flowSpeed(s.wires[id].current,V.flowReferences(d,s).get(s.islandOf[wire.from]));};
  const settle=()=>inside('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  async function tap(selector){const p=await point(selector);if(width<600){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:contactId++,radiusX:2,radiusY:2,force:1}]});await delay(30);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});}await settle();}
  async function panel(){if(await inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="false"'))await tap('#panelToggle');}
  async function pause(value){await tap('#settings');if(await inside('document.getElementById("pause").checked')!==value)await tap('#pause');assert.equal(await inside('document.getElementById("pause").checked'),value);await tap('#closeSettings');}
  async function choose(flow){
    await tap('#settings');
    if(width>=600){
      // This macOS headless run did not change native selects via CDP keys. Use the
      // production display handler explicitly; do not call this a trusted gesture.
      await inside(`(()=>{const e=document.getElementById('flow');e.value=${JSON.stringify(flow)};e.onchange();})()`);
    }else{
      await inside('document.getElementById("flow").focus()');
      const choices=['current','electron','off'],before=choices.indexOf((await doc()).display.flow),target=choices.indexOf(flow);
      for(let n=0;n<Math.abs(target-before);n++)await key(target>before?'ArrowDown':'ArrowUp',target>before?'ArrowDown':'ArrowUp',target>before?40:38);
      await key('Tab','Tab',9);
    }
    await settle();assert.equal((await doc()).display.flow,flow);await tap('#closeSettings');
  }
  async function voltage(value){
    await tap('[data-hit="body:c1"]');await panel();
    await inside('(()=>{const e=document.querySelector("#properties [data-param=voltage]");e.focus();e.select();})()');
    await send('Input.insertText',{text:String(value)});await key('Tab','Tab',9);await settle();
    assert.equal((await doc()).components[0].params.voltage,value);
  }
  async function launch(w,reduced=false){width=w;await freshPage();h.setContext('window');await send('Emulation.setDeviceMetricsOverride',{width:w,height:w===320?500:w<600?844:800,deviceScaleFactor:1,mobile:w<600});await send('Emulation.setTouchEmulationEnabled',{enabled:w<600,maxTouchPoints:2});await send('Emulation.setEmulatedMedia',{features:reduced?[{name:'prefers-reduced-motion',value:'reduce'}]:[]});await send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await ready();await send('Page.bringToFront',{});assert.equal(await inside('document.hidden'),false);await inside("window.__flowInputs=[];for(const type of ['pointerup','keydown','change'])document.addEventListener(type,e=>__flowInputs.push({type,trusted:e.isTrusted,pointer:e.pointerType||null,target:e.target.id||e.target.dataset.hit||e.target.dataset.param}),true)");}
  async function samples(count=32){return inside(`new Promise((resolve,reject)=>{
    const rows=[];function frame(t){try{
      const d=CircuitWorkbench.getDocument(),c=CircuitWorkbench.getInteraction().camera;
      const groups=[...document.querySelectorAll('#flowLayer [data-flow-wire]')].map(g=>{
        const w=d.wires.find(w=>w.id===g.dataset.flowWire),route=CircuitRouting.route(d,w),e=g.firstElementChild;
        const base={id:w.id,phase:+g.dataset.phase,current:+g.dataset.current,speed:+g.dataset.speed,direction:+g.dataset.direction,hasGlyph:!!e,length:CircuitRouting.length(route)*c.scale};
        if(!e)return base;
        const p=CircuitRouting.along(route,base.phase/c.scale),m=e.tagName==='circle'?null:e.transform.baseVal.consolidate().matrix,x=m?m.e:+e.getAttribute('cx'),y=m?m.f:+e.getAttribute('cy'),angle=(p.angle+(base.direction<0?180:0))*Math.PI/180;
        return{...base,x,y,positionError:Math.hypot(x-p.x,y-p.y),arrowError:m?Math.hypot(m.a-Math.cos(angle),m.b-Math.sin(angle)):0};
      });rows.push({t,groups});if(rows.length===${count})resolve(rows);else requestAnimationFrame(frame);
    }catch(error){reject(error);}}requestAnimationFrame(frame);
  })`);}
  const phase=()=>inside("Object.fromEntries([...document.querySelectorAll('#flowLayer [data-flow-wire]')].map(e=>[e.dataset.flowWire,+e.dataset.phase]))");
  console.log(`${mode}: current-linked electron/arrow motion and continuous phases`);
  for(const w of [320,390,1280]){await launch(w);console.log(`${mode}: ${w}px flow observations`);
    for(const view of ['real','schematic']){
      for(const flow of ['current','electron']){await load(unequalBranches(view,flow));while(await inside('CircuitWorkbench.getInteraction().camera.scale')<.55)await tap('[data-camera=in]');await pause(false);const before=await save(),readings=await inside('CircuitWorkbench.getAnalysis()'),rows=await samples(),distances={w5:0,w4:0};
        for(const row of rows){assert.equal(row.groups.length,7);for(const g of row.groups){near(g.speed,speedFor(unequalBranches(view,flow),readings,g.id));near(g.current,readings.wires[g.id].current);assert.equal(g.direction,Math.sign(g.current)*(flow==='electron'?-1:1));if(g.hasGlyph)assert(g.positionError<.0001&&g.arrowError<1e-6,'actual SVG glyph is on the route with the actual current direction: '+JSON.stringify(g));else assert(g.length<65,'only sub-spacing wires may have no particle in a frame');}assert(row.groups.filter(g=>['w4','w5'].includes(g.id)).every(g=>g.hasGlyph));}
        for(let i=1;i<rows.length;i++)for(const id of Object.keys(distances)){const a=rows[i-1].groups.find(g=>g.id===id),b=rows[i].groups.find(g=>g.id===id),delta=step(a.phase,b.phase);assert(delta*(flow==='electron'?-1:1)>0,'particles progress every observed animation frame');distances[id]+=Math.abs(delta);}
        assert(distances.w5>distances.w4);near(distances.w5/distances.w4,speedFor(unequalBranches(view,flow),readings,'w5')/speedFor(unequalBranches(view,flow),readings,'w4'),1e-6);assert.equal(await save(),before);assert.deepEqual(await inside('CircuitWorkbench.getAnalysis()'),readings);evidence.push({mode,flow:'actual-motion',width:w,view,style:flow,camera:await inside('CircuitWorkbench.getInteraction().camera'),distances,rows,documentAndReadingsFixed:true});
      }
      // Pause freezes the visible phase across style/current/sign changes; resume uses the new current.
      await load(unequalBranches(view));await pause(true);const paused=await phase(),frozen=await samples(12);assert(frozen.every(r=>r.groups.every(g=>g.phase===paused[g.id])));await choose('current');assert.deepEqual(await phase(),paused);await voltage(12);assert.deepEqual(await phase(),paused);near(await inside('CircuitWorkbench.getAnalysis().wires.w3.current'),1);await pause(false);const quicker=await samples(14);const resumedDoc=await doc(),resumedAnalysis=await inside('CircuitWorkbench.getAnalysis()');assert(quicker.every(r=>Math.abs(r.groups.find(g=>g.id==='w3').speed-speedFor(resumedDoc,resumedAnalysis,'w3'))<1e-7));assert(quicker.slice(1).every((r,i)=>step(quicker[i].groups.find(g=>g.id==='w3').phase,r.groups.find(g=>g.id==='w3').phase)>0));
      await pause(true);const reverseStart=await phase();await tap('[data-action="反接電源極性"]');assert.deepEqual(await phase(),reverseStart);near(await inside('CircuitWorkbench.getAnalysis().wires.w3.current'),-1);await pause(false);const negative=await samples(14);assert(negative.slice(1).every((r,i)=>step(negative[i].groups.find(g=>g.id==='w3').phase,r.groups.find(g=>g.id==='w3').phase)<0));
      const saved=await save();await pause(true);await load(saved);assert.equal(await save(),saved);assert(Object.values(await phase()).every(p=>p===0),'animation phase is not persisted');await voltage(6);near(await inside('CircuitWorkbench.getAnalysis().wires.w3.current'),-.5);const continued=await save();await tap('#undo');assert.equal(await save(),saved);await tap('#redo');assert.equal(await save(),continued);await choose('off');assert.equal(await inside('document.getElementById("flowLayer").childElementCount'),0);evidence.push({mode,flow:'pause-current-reverse-restore',width:w,view,modeSelection:w<600?'trusted-keyboard':'production-select-handler',phasePreserved:true,actualNewCurrent:true,restoredContinuation:true,undoRedo:true});
    }
    await pause(false);const zero=unequalBranches();zero.components[1].params.closed=false;await load(zero);assert((await samples(8)).every(r=>r.groups.length===0));if(width<600&&await inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="true"'))await tap('#panelToggle');await tap('[data-hit="body:c2"]');assert.equal((await doc()).components[1].params.closed,true);assert((await samples(8)).every(r=>r.groups.length===7));evidence.push({mode,flow:'zero-and-close',width:w,noInventedMotion:true,trustedContinuation:true});
    const unknown=M.empty(),source=M.add(unknown,'battery',150,180);M.connect(unknown,source.id+':a',source.id+':b',[],'free');const good=M.add(unknown,'battery',450,180),loadC=M.add(unknown,'resistor',650,340,{resistance:12});M.connect(unknown,good.id+':a',loadC.id+':a',[],'free');M.connect(unknown,loadC.id+':b',good.id+':b',[],'free');await load(unknown);assert.equal(await inside('CircuitWorkbench.getAnalysis().wires.w1.current'),null);const isolated=await samples(8);assert(isolated.every(r=>r.groups.length===2&&!r.groups.some(g=>g.id==='w1')));evidence.push({mode,flow:'unknown-island',width:w,unknownSuppressed:true,independentFiniteCircuitMoves:true});
    const inputs=await inside('__flowInputs');assert(inputs.every(e=>e.trusted));assert(inputs.some(e=>e.type==='pointerup'&&e.pointer===(w<600?'touch':'mouse')));assert(inputs.some(e=>e.type==='change'&&e.target==='voltage'));evidence.push({mode,flow:'trusted-input',width:w,count:inputs.length});
    await load(unequalBranches());if(w===1280){await inside('document.getElementById("panel").scrollTop=0');await h.screenshot(`${mode}-current-linked-electrons.png`);}
    await launch(w,true);assert(await inside('document.getElementById("pause").checked'));await load(unequalBranches());const reduced=await samples(12);assert(reduced.every(r=>r.groups.every(g=>g.phase===0)));await pause(false);assert((await samples(8)).slice(1).some(r=>r.groups.some(g=>g.phase!==0)));evidence.push({mode,flow:'reduced-motion',width:w,startsPaused:true,explicitResume:true});
  }
}
async function microFlowCases(h,mode,base){
  const{inside,send,point,load,save,doc,delay,evidence}=h;let width,contactId=51000;
  async function tap(selector){
    const p=await point(selector);
    if(width===390){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:contactId++,radiusX:2,radiusY:2,force:1}]});await delay(25);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});}
    await delay(45);
  }
  async function pause(value){await tap('#settings');if(await inside('document.getElementById("pause").checked')!==value)await tap('#pause');await tap('#closeSettings');}
  async function samples(count=24){return inside(`new Promise((resolve,reject)=>{
    const rows=[];function frame(t){try{
      const d=CircuitWorkbench.getDocument(),scale=CircuitWorkbench.getInteraction().camera.scale;
      const groups=[...document.querySelectorAll('#flowLayer [data-speed]')].map(g=>{
        const e=g.querySelector('[data-flow-distance]'),track=g.querySelector('[data-flow-track]');let error=null;
        if(e){const m=e.tagName==='circle'?null:e.transform.baseVal.consolidate().matrix,x=m?m.e:+e.getAttribute('cx'),y=m?m.f:+e.getAttribute('cy');
          const p=track?track.getPointAtLength(+e.dataset.flowDistance):CircuitRouting.along(CircuitRouting.route(d,d.wires.find(w=>w.id===g.dataset.flowWire)),+e.dataset.flowDistance);
          error=Math.hypot(x-p.x,y-p.y);
        }
        return{id:g.dataset.flowWire||'component:'+g.dataset.flowComponent+':'+g.dataset.flowPath,component:g.dataset.flowComponent||null,current:+g.dataset.current,reference:+g.dataset.referenceCurrent,speed:+g.dataset.speed,phase:+g.dataset.phase,direction:+g.dataset.direction,hasGlyph:!!e,error};
      });rows.push({t,scale,groups});if(rows.length===${count})resolve(rows);else requestAnimationFrame(frame);
    }catch(error){reject(error);}}requestAnimationFrame(frame);
  })`);}
  for(const w of [1280,390]){
    width=w;await h.freshPage();h.setContext('window');await send('Emulation.setDeviceMetricsOverride',{width:w,height:w===390?844:800,deviceScaleFactor:1,mobile:w===390});await send('Emulation.setTouchEmulationEnabled',{enabled:w===390,maxTouchPoints:2});await send('Emulation.setEmulatedMedia',{features:[]});await send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();await send('Page.bringToFront',{});
    const names=await inside('[...document.getElementById("preset").options].map(o=>o.value)');assert(!names.includes('lampCurve'));assert(names.includes('divider')&&names.includes('gAmmeter')&&names.includes('gVoltmeter'));
    await inside("window.__microInputs=[];document.addEventListener('pointerup',e=>__microInputs.push({trusted:e.isTrusted,pointer:e.pointerType,target:e.target.id}),true)");
    for(const name of ['gVoltmeter','gAmmeter'])for(const view of ['real','schematic'])for(const style of ['current','electron']){
      const d=P.create(name);d.display.view=view;d.display.flow=style;await load(d);await pause(false);const saved=await save(),analysis=await inside('CircuitWorkbench.getAnalysis()');near(analysis.components.c3.reading,50e-6,1e-12);
      const rows=await samples(),gId='component:c3:main',reference=name==='gAmmeter'?.001:50e-6;let travelled=0;
      for(const row of rows){const g=row.groups.find(g=>g.id===gId);assert(g&&g.hasGlyph,'G carries visible particles');near(g.current,50e-6,1e-12);near(g.reference,reference,1e-12);assert(g.speed>=40&&g.speed<=92.000001);assert.equal(g.direction,style==='electron'?-1:1);assert(row.groups.every(g=>!g.hasGlyph||g.error<.001),'actual particles stay on the native wire/inside-component tracks');
        if(name==='gAmmeter'){const shunt=row.groups.find(g=>g.component==='c4'),source=row.groups.find(g=>g.component==='c1');assert(shunt.speed>g.speed&&source.speed>shunt.speed);}
      }
      for(let i=1;i<rows.length;i++){const delta=step(rows[i-1].groups.find(g=>g.id===gId).phase,rows[i].groups.find(g=>g.id===gId).phase);assert(delta*(style==='electron'?-1:1)>0);travelled+=Math.abs(delta);}
      assert(travelled>5,'microamp particles visibly travel several CSS pixels');assert.equal(await save(),saved);assert.deepEqual(await inside('CircuitWorkbench.getAnalysis()'),analysis);
      evidence.push({mode,width:w,preset:name,view,style,travelled,rows,readingsAndDocumentFixed:true});
    }
    await load(P.create('gVoltmeter'));await pause(true);const frozen=await samples(6);assert(frozen.every(r=>r.groups.every(g=>g.phase===frozen[0].groups.find(x=>x.id===g.id).phase)));const saved=await save();await load(saved);await tap('[data-hit="body:c1"]');await tap('#quickPlus');near((await doc()).components[0].params.voltage,3.5);near((await inside('CircuitWorkbench.getAnalysis()')).components.c3.reading,3.5/60000,1e-12);await tap('#undo');assert.equal(await save(),saved);await pause(false);assert((await samples(8)).some(r=>r.groups.some(g=>g.phase!==0)));
    const inputs=await inside('__microInputs');assert(inputs.length>0&&inputs.every(e=>e.trusted&&e.pointer===(w===390?'touch':'mouse')));evidence.push({mode,width:w,pauseAndRestoreContinuation:true,trustedInput:true});
    await h.screenshot(`${mode}-micro-flow-${w}.png`);
  }
}
module.exports={flowCases,microFlowCases};
