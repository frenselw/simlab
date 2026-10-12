"use strict";
const assert=require('node:assert/strict');
const M=require('../sim/circuit-workbench/circuit-model'),P=require('../sim/circuit-workbench/presets'),R=require('../sim/circuit-workbench/component-registry');

async function presetCases(h,mode,base){
  const {inside,send,click,point,load,save,doc,touch,delay,screenshot,freshPage,ready,evidence}=h;
  async function launch(width){
    await freshPage();h.setContext('window');
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?620:800,deviceScaleFactor:1,mobile:width===320});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width===320,maxTouchPoints:3});
    await send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await ready();
  }
  async function display(view){
    if((await doc()).display.view!==view)await click(view==='real'?'#realView':'#schematicView');
  }
  async function alignment(){return inside(`(()=>{
    const out=[],screen=(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM());
    for(const c of CircuitWorkbench.getDocument().components.filter(CircuitRegistry.dualMeter)){
      const ports=CircuitRegistry.ports(c),group=document.querySelector('[data-component="'+c.id+'"]');
      for(const p of ports){
        const mark=document.querySelector('[data-port="'+p.id+'"]'),center=screen(mark,{x:+mark.getAttribute('cx'),y:+mark.getAttribute('cy')}),socket=group.querySelector('[data-socket="'+p.key+'"]'),hit=document.querySelector('[data-hit="port:'+p.id+'"]');
        const physical=socket?screen(socket,{x:+socket.getAttribute('cx'),y:+socket.getAttribute('cy')}):center;
        let hitError=null;if(hit){const r=hit.getBoundingClientRect();hitError=Math.hypot(r.x+r.width/2-center.x,r.y+r.height/2-center.y);}
        for(const w of CircuitWorkbench.getDocument().wires){for(const key of ['from','to'])if(w[key]===p.id){
          const path=document.querySelector('[data-wire="'+w.id+'"]'),end=screen(path,path.getPointAtLength(key==='from'?0:path.getTotalLength()));
          out.push({id:p.id,wire:w.id,key,socket:Math.hypot(center.x-physical.x,center.y-physical.y),end:Math.hypot(center.x-end.x,center.y-end.y),foreground:Boolean(group.compareDocumentPosition(path)&Node.DOCUMENT_POSITION_FOLLOWING),hit:hitError});
        }}
      }
    }return out;
  })()`);}
  function aligned(samples,hitRequired=false){for(const x of samples){assert(x.socket<.02,'physical socket and model terminal align');assert(x.end<.02,'SVG wire ends at its socket');assert(x.foreground,'actual cable stays in front of the housing');if(hitRequired)assert(x.hit!==null,'zoomed socket has an independent hit target');if(x.hit!==null)assert(x.hit<.05,'touch target is centered within browser subpixel rounding: '+JSON.stringify(x));}}
  console.log(`${mode}: classroom preset layouts and rotated meter sockets`);
  for(const width of [1280,320]){
    await launch(width);
    for(const name of Object.keys(P.names))for(const view of ['real','schematic']){
      // Exercise the production dropdown's change handler, rather than only loading a test fixture.
      await inside(`(()=>{const e=document.getElementById('preset');e.value=${JSON.stringify(name)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      const loaded=await doc(),expected=P.create(name);for(const key of ['components','wires','junctions'])assert.deepEqual(loaded[key],expected[key],'dropdown loads the authored '+key);await display(view);
      const samples=await alignment();aligned(samples);
      const layout=await inside(`(()=>{const r=document.getElementById('surface').getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth-innerWidth,scale:CircuitWorkbench.getInteraction().camera.scale,overview:document.querySelector('[data-overview-caption]')?.textContent||null,overviewReadings:[...document.querySelectorAll('[data-overview-readout]')].map(e=>({id:e.dataset.overviewReadout,text:e.dataset.math||e.textContent,font:+e.getAttribute('font-size')*CircuitWorkbench.getInteraction().camera.scale})),labels:[...document.querySelectorAll('[data-component-label]')].map(e=>{const b=e.getBoundingClientRect();return {id:e.dataset.componentLabel,visible:b.right>r.left&&b.left<r.right&&b.bottom>r.top&&b.top<r.bottom,font:+e.getAttribute('font-size')*CircuitWorkbench.getInteraction().camera.scale};})};})()`);
      assert.equal(layout.scroll,0);assert(layout.labels.every(x=>x.visible&&x.font>=13.9),'zoomed diagram retains readable component labels');
      const prepared=P.create(name);if(layout.scale<.4&&prepared.components.length){assert(layout.overview?.includes('放大查看'),'small overview has an explicit zoom hint');assert.equal(layout.labels.length,0,'small overview keeps captions off the wiring');assert.equal(layout.overviewReadings.length,prepared.components.filter(R.isMeter).length);assert(layout.overviewReadings.every(x=>x.font>=13.9));}else{assert.equal(new Set(layout.labels.map(p=>p.id)).size,prepared.components.length);assert.equal(layout.overview,null);}
      assert.deepEqual((await inside('CircuitWorkbench.getAnalysis()')).diagnostics,[]);
      await screenshot(`${mode}-preset-${name}-${view}-${width}.png`);
      evidence.push({mode,preset:name,width,view,meters:'analog',dropdownChangeSignal:true,layout,socketsAligned:samples});
      if(name==='mixed'){
        const switches=(await doc()).components.filter(c=>c.type==='switch');
        await inside(`window.__presetSwitchEvents=[];if(!window.__presetSwitchWatching){window.__presetSwitchWatching=true;document.getElementById('surface').addEventListener('pointerup',e=>window.__presetSwitchEvents.push({trusted:e.isTrusted,pointer:e.pointerType}));}`);
        for(const closed of [[false,true],[false,false],[true,false],[true,true]]){
          for(let i=0;i<switches.length;i++)if((await doc()).components.find(c=>c.id===switches[i].id).params.closed!==closed[i]){
            const selector='[data-hit="body:'+switches[i].id+'"]';if(width===320)await touch(await point(selector),0,0);else await click(selector);
          }
          assert.deepEqual((await doc()).components.filter(c=>c.type==='switch').map(c=>c.params.closed),closed,'trusted switch taps operate the two branches independently');
          const lamps=await inside(`(()=>{const d=CircuitWorkbench.getDocument(),r=CircuitWorkbench.getAnalysis();return d.components.filter(c=>c.type==='lamp').map(c=>({current:r.components[c.id].current,brightness:CircuitRenderer.lampLight(c,r.components[c.id]).brightness}));})()`);
          for(let i=0;i<2;i++)assert.equal(lamps[i+1].brightness>0,closed[i],'only the switched branch goes dark');
          assert(Math.abs(lamps[0].current-lamps[1].current-lamps[2].current)<1e-8,'trunk current equals both branch currents');
          if(closed.every(Boolean))assert(lamps[0].brightness>lamps[1].brightness&&Math.abs(lamps[1].brightness-lamps[2].brightness)<1e-8,'trunk lamp is brighter than equal branch lamps');
          const saved=await save();await load(saved);assert.equal(await save(),saved,'each switch combination restores before the next trusted continuation');
          evidence.push({mode,preset:name,width,view,closed,lamps,restored:true});
        }
        const events=await inside('__presetSwitchEvents');assert.equal(events.length,4);assert(events.every(e=>e.trusted&&e.pointer===(width===320?'touch':'mouse')));
      }
    }
    for(const type of ['ammeter','voltmeter'])for(const port of ['a','c'])for(const view of ['real','schematic'])for(const meters of ['digital','analog']){
      const d=P.create('ohm'),c=d.components.find(c=>c.type===type);
      if(port==='c'){const before=M.clone(d);for(const w of d.wires)for(const key of ['from','to'])if(w[key]===c.id+':a')w[key]=c.id+':c';assert(M.reconcile(d,before));}
      d.display.view=view;d.display.meters=meters;await load(M.validate(d));
      await click('[data-hit="body:'+c.id+'"]');
      if(await inside('!document.getElementById("focusSelected").hidden'))await click('#focusSelected');
      const original=await save(),readings=await inside('CircuitWorkbench.getAnalysis()'),ids=(await doc()).wires.map(w=>[w.from,w.to,w.length]);
      await inside(`window.__rotationEvents=[];if(!window.__rotationWatching){__rotationWatching=true;document.getElementById('rotateSelected').addEventListener('click',e=>__rotationEvents.push({type:e.type,trusted:e.isTrusted}));}`);
      for(const angle of [90,180,270,0]){
        if(width===320)await touch(await point('#rotateSelected'),0,0);else await click('#rotateSelected');
        await delay(20);const after=await doc();assert.equal(after.components.find(v=>v.id===c.id).angle,angle,'trusted rotation completes');
        assert.deepEqual(after.wires.map(w=>[w.from,w.to,w.length]),ids,'rotation preserves terminal IDs and finite cable lengths');
        const ports=new Set(R.ports(after.components.find(v=>v.id===c.id)).map(p=>p.id));
        after.wires.filter(w=>ports.has(w.from)||ports.has(w.to)).forEach(w=>{assert.equal(w.shape,'free');assert.deepEqual(w.via,[],'each attached cable straightens after rotation');});
        assert.deepEqual(await inside('CircuitWorkbench.getAnalysis()'),readings,'rotation cannot alter circuit readings');
        const samples=await alignment();aligned(samples.filter(x=>x.id.startsWith(c.id+':')),true);
        const result=readings.components[c.id];assert.equal(result.activePort,port);
        const pins=await inside(`(()=>{const e=document.querySelector('[data-meter-dial="${c.id}"] [data-meter-needle]');return e?{range:+e.dataset.range,reading:+e.dataset.reading}:null})()`);
        if(view==='real'&&meters==='analog'){assert.equal(pins.range,result.range);assert.equal(pins.reading,result.reading);}
        if(view==='real'&&meters==='analog'&&port==='a'&&[90,270].includes(angle))await screenshot(`${mode}-rotated-${type}-${angle}-${width}.png`);
        evidence.push({mode,meterRotation:true,type,port,width,view,meters,angle,terminalIdsFixed:true,readingsFixed:true,socketsAligned:samples});
      }
      const rotated=await save();for(let n=0;n<4;n++)await click('#undo');assert.equal(await save(),original,'four rotations are exactly four undo transactions');
      for(let n=0;n<4;n++)await click('#redo');assert.equal(await save(),rotated,'redo restores the actual connector paths');
      await touch(await point('#quickWire'),0,0);assert.equal((await doc()).wires.length,d.wires.length+1);await click('#undo');assert.equal(await save(),rotated,'normal cable editing works after rotation');
      const events=await inside('__rotationEvents');assert.equal(events.length,4);assert(events.every(e=>e.trusted),'all four rotate actions use native mouse/touch');
    }
  }
}
module.exports={presetCases};
