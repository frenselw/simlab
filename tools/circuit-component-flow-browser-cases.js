'use strict';
const assert=require('node:assert/strict'),P=require('../sim/circuit-workbench/presets'),V=require('../sim/circuit-workbench/circuit-renderer');
const near=(a,b,tolerance=1e-7)=>assert(Math.abs(a-b)<tolerance,`${a} != ${b}`),step=(a,b)=>((b-a+97.5)%65)-32.5;
async function componentFlowCases(h,mode,base){
  const{inside,send,load,save,doc,point,delay,evidence}=h;let width;
  async function tap(selector){
    const p=await point(selector);
    if(width===390){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:901,radiusX:2,radiusY:2,force:1}]});await delay(20);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}
    await delay(45);
  }
  async function pause(value){await tap('#settings');if(await inside('document.getElementById("pause").checked')!==value)await tap('#pause');await tap('#closeSettings');}
  async function samples(count=14){return inside(`new Promise((resolve,reject)=>{
    const rows=[];function frame(t){try{
      const groups=[...document.querySelectorAll('#flowLayer [data-flow-component]')].map(g=>{
        const track=g.querySelector('[data-flow-track]'),length=track.getTotalLength(),particles=[...g.querySelectorAll('[data-flow-distance]')].map(e=>{
          const distance=+e.dataset.flowDistance,p=track.getPointAtLength(distance),m=e.tagName==='circle'?null:e.transform.baseVal.consolidate().matrix,x=m?m.e:+e.getAttribute('cx'),y=m?m.f:+e.getAttribute('cy');
          const q=track.getPointAtLength(Math.max(0,distance-.25)),r=track.getPointAtLength(Math.min(length,distance+.25)),u=Math.hypot(p.x-q.x,p.y-q.y),v=Math.hypot(r.x-p.x,r.y-p.y),corner=u&&v&&((p.x-q.x)*(r.x-p.x)+(p.y-q.y)*(r.y-p.y))/(u*v)<.999999,angle=Math.atan2(r.y-q.y,r.x-q.x)+(g.dataset.direction==='-1'?Math.PI:0),arrowChecked=!!m&&!corner;
          return{distance,x,y,error:Math.hypot(x-p.x,y-p.y),arrowChecked,arrowError:arrowChecked?Math.hypot(m.a-Math.cos(angle),m.b-Math.sin(angle)):0};
        });return{id:g.dataset.flowComponent,path:g.dataset.flowPath,current:+g.dataset.current,speed:+g.dataset.speed,phase:+g.dataset.phase,direction:+g.dataset.direction,spacing:+g.dataset.spacing,length,particles};
      });rows.push({t,groups});if(rows.length===${count})resolve(rows);else requestAnimationFrame(frame);
    }catch(e){reject(e);}}requestAnimationFrame(frame);
  })`);}
  async function geometry(){return inside(`(()=>{
    const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
    return [...document.querySelectorAll('#flowLayer [data-flow-component]')].map(g=>{
      const track=g.querySelector('[data-flow-track]'),numbers=track.getAttribute('d').match(/[-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?/gi).map(Number),points=[];for(let n=0;n<numbers.length;n+=2)points.push({x:numbers[n],y:numbers[n+1]});
      const nearest=p=>Math.min(...points.slice(1).map((b,n)=>segmentDistance(p,points[n],b))),portError=[];
      for(const [name,end] of [['from',points[0]],['to',points.at(-1)]]){const p=document.querySelector('#scene [data-port="'+g.dataset[name]+'"]');if(p)portError.push(Math.hypot(end.x-+p.getAttribute('cx'),end.y-+p.getAttribute('cy')));}
      const filament=document.querySelector('#scene [data-component="'+g.dataset.flowComponent+'"] [data-lamp-filament]');let filamentError=0,contactError=0;
      if(filament){for(let n=0;n<=32;n++){const p=filament.getPointAtLength(filament.getTotalLength()*n/32),q=new DOMPoint(p.x,p.y).matrixTransform(filament.getScreenCTM()).matrixTransform(track.getScreenCTM().inverse());filamentError=Math.max(filamentError,nearest(q));}
        const bottom=document.querySelector('#scene [data-component="'+g.dataset.flowComponent+'"] [data-lamp] circle[cy="18"]'),q=new DOMPoint(0,18).matrixTransform(bottom.getScreenCTM()).matrixTransform(track.getScreenCTM().inverse());contactError=nearest(q);
      }return{id:g.dataset.flowComponent,path:g.dataset.flowPath,portError,filament:!!filament,filamentError,contactError};
    });
  })()`);}
  console.log(`${mode}: current passes through components, filaments and contacts`);
  for(const w of [1280,390]){
    width=w;await h.freshPage();h.setContext('window');await send('Emulation.setDeviceMetricsOverride',{width:w,height:w===390?844:800,deviceScaleFactor:1,mobile:w===390});await send('Emulation.setTouchEmulationEnabled',{enabled:w===390,maxTouchPoints:2});await send('Emulation.setEmulatedMedia',{features:[]});await send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();await send('Page.bringToFront',{});
    await inside('window.__componentInputs=[];for(const type of ["pointerup","pointercancel"])document.addEventListener(type,e=>__componentInputs.push({type,trusted:e.isTrusted,pointer:e.pointerType,target:e.target.id||e.target.dataset.hit}),true)');
    for(const style of ['current','electron'])for(const view of ['real','schematic']){
      const d=P.create('series');d.display.flow=style;await load(d);if(view==='schematic')await tap('#schematicView');await pause(false);
      const snapshot=await save(),analysis=await inside('CircuitWorkbench.getAnalysis()'),rows=await samples(),geometryRows=await geometry();
      assert.equal((await doc()).display.view,view);
      for(const row of rows){assert.equal(row.groups.length,4);for(const g of row.groups){near(g.current,analysis.components[g.id].current);near(g.speed,V.flowSpeed(g.current));assert.equal(g.direction,Math.sign(g.current)*(style==='electron'?-1:1));assert(g.particles.length>=2);assert(g.particles.every(p=>p.error<.001&&p.arrowError<.001),'actual SVG particles lie on the complete conductor and point in the current direction: '+JSON.stringify(g));if(style==='current')assert(g.particles.some(p=>p.arrowChecked));}}
      for(let n=1;n<rows.length;n++)for(const g of rows[n].groups){const previous=rows[n-1].groups.find(p=>p.id===g.id);assert(step(previous.phase,g.phase)*g.direction>0,'signed current moves through each component on successive RAF frames');}
      // SVG getPointAtLength returns float32 coordinates (measured ~1e-6 world px).
      for(const g of geometryRows){assert(g.portError.every(e=>e<1e-7));assert(g.filamentError<1e-5&&g.contactError<1e-5,JSON.stringify({width:w,view,style,...g}));}
      assert.equal(geometryRows.filter(g=>g.filament).length,view==='real'?2:0);assert.equal(await save(),snapshot);assert.deepEqual(await inside('CircuitWorkbench.getAnalysis()'),analysis);
      assert(await inside('document.documentElement.scrollWidth<=innerWidth'));
      if(view==='real')await h.screenshot(`${mode}-through-components-${style}-${w}.png`);
      evidence.push({mode,width:w,view,style,componentFlow:'actual-RAF-and-geometry',rows,geometry:geometryRows,documentAndReadingsUnchanged:true});
    }
    await pause(true);const frozen=await samples(6);assert(frozen.every(row=>row.groups.every(g=>g.phase===frozen[0].groups.find(p=>p.id===g.id).phase)));await pause(false);
    const closed=await save();await tap('[data-hit="body:c2"]');assert.equal((await doc()).components[1].params.closed,false);assert((await samples(3)).every(row=>row.groups.length===0));
    const opened=await save();await load(opened);await tap('[data-hit="body:c2"]');assert.equal(await save(),closed);assert((await samples(6)).every(row=>row.groups.length===4));
    const inputs=await inside('__componentInputs');assert(inputs.every(e=>e.trusted));assert(!inputs.some(e=>e.type==='pointercancel'));assert(inputs.some(e=>e.pointer===(w===390?'touch':'mouse')));
    evidence.push({mode,width:w,componentFlow:'pause-and-restored-switch-continuation',frozen:true,openHasNoFlow:true,trustedCloseResumesFlow:true,inputs});
    const divider=P.create('divider');divider.display.flow='current';await load(divider);const analysis=await inside('CircuitWorkbench.getAnalysis()'),rows=await samples(8),geometryRows=await geometry(),expected=V.componentFlowPaths(divider,analysis).filter(p=>V.flowSpeed(p.current));
    for(const row of rows){assert.equal(row.groups.length,expected.length);for(const g of row.groups){const p=expected.find(p=>p.component===g.id&&p.key===g.path);near(g.current,p.current);assert(g.particles.every(p=>p.error<.001&&p.arrowError<.001));}}
    assert(!rows.some(row=>row.groups.some(g=>g.id==='c5')),'ideal voltage meter displays voltage without invented current');
    assert(rows.every(row=>row.groups.some(g=>g.id==='c2'&&g.path==='bar-left'&&g.current<0)&&row.groups.some(g=>g.id==='c4'&&g.path==='low'&&g.current>0)));
    assert(geometryRows.every(g=>g.portError.every(e=>e<1e-7)));evidence.push({mode,width:w,componentFlow:'loaded-divider-and-meter',rows,geometry:geometryRows,idealVoltageMeterHasNoFlow:true});
  }
}
module.exports={componentFlowCases};
