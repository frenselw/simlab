'use strict';
// Observe the production RAF/SVG output; use trusted input for all user changes.
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model'),P=require('../sim/circuit-workbench/presets'),V=require('../sim/circuit-workbench/circuit-renderer');
const near=(a,b,t=1e-7)=>assert(Math.abs(a-b)<t,`${a} != ${b}`),step=(a,b)=>((b-a+97.5)%65)-32.5;
function unequalBranches(view='real',flow='electron'){const d=P.create('parallel');d.components[3].params.resistance=60;d.components[2].label='較大電流';d.components[3].label='較小電流';d.display.view=view;d.display.flow=flow;return d;}
async function flowCases(h,mode,base){
  const {inside,send,point,load,save,doc,key,delay,freshPage,ready,evidence}=h;let width=1280,contactId=41000;
  const settle=()=>inside('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  async function tap(selector){const p=await point(selector);if(width<600){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:contactId++,radiusX:2,radiusY:2,force:1}]});await delay(30);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});}await settle();}
  async function panel(){if(await inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="false"'))await tap('#panelToggle');}
  async function pause(value){await panel();if(await inside('document.getElementById("pause").checked')!==value)await tap('#pause');assert.equal(await inside('document.getElementById("pause").checked'),value);}
  async function choose(flow){
    await panel();
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
    await settle();assert.equal((await doc()).display.flow,flow);
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
        for(const row of rows){assert.equal(row.groups.length,7);for(const g of row.groups){near(g.speed,V.flowSpeed(readings.wires[g.id].current));near(g.current,readings.wires[g.id].current);assert.equal(g.direction,Math.sign(g.current)*(flow==='electron'?-1:1));if(g.hasGlyph)assert(g.positionError<.0001&&g.arrowError<1e-6,'actual SVG glyph is on the route with the actual current direction: '+JSON.stringify(g));else assert(g.length<65,'only sub-spacing wires may have no particle in a frame');}assert(row.groups.filter(g=>['w4','w5'].includes(g.id)).every(g=>g.hasGlyph));}
        for(let i=1;i<rows.length;i++)for(const id of Object.keys(distances)){const a=rows[i-1].groups.find(g=>g.id===id),b=rows[i].groups.find(g=>g.id===id),delta=step(a.phase,b.phase);assert(delta*(flow==='electron'?-1:1)>0,'particles progress every observed animation frame');distances[id]+=Math.abs(delta);}
        assert(distances.w5>distances.w4*4.4);near(distances.w5/distances.w4,V.flowSpeed(.5)/V.flowSpeed(.1),1e-6);assert.equal(await save(),before);assert.deepEqual(await inside('CircuitWorkbench.getAnalysis()'),readings);evidence.push({mode,flow:'actual-motion',width:w,view,style:flow,camera:await inside('CircuitWorkbench.getInteraction().camera'),distances,rows,documentAndReadingsFixed:true});
      }
      // Pause freezes the visible phase across style/current/sign changes; resume uses the new current.
      await load(unequalBranches(view));await pause(true);const paused=await phase(),frozen=await samples(12);assert(frozen.every(r=>r.groups.every(g=>g.phase===paused[g.id])));await choose('current');assert.deepEqual(await phase(),paused);await voltage(12);assert.deepEqual(await phase(),paused);near(await inside('CircuitWorkbench.getAnalysis().wires.w3.current'),1);await pause(false);const quicker=await samples(14);assert(quicker.every(r=>r.groups.find(g=>g.id==='w3').speed===V.flowSpeed(1)));assert(quicker.slice(1).every((r,i)=>step(quicker[i].groups.find(g=>g.id==='w3').phase,r.groups.find(g=>g.id==='w3').phase)>0));
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
module.exports={flowCases};
