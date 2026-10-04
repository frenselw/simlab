'use strict';
const assert=require('node:assert/strict');
const M=require('../sim/circuit-workbench/circuit-model'),R=require('../sim/circuit-workbench/component-registry'),P=require('../sim/circuit-workbench/presets');
async function teachingCases(h,mode,base,output){
  console.log(`${mode}: G / four-post rheostat / lamp controls`);
  const near=(a,b,tol=1e-8)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
  for(const width of [320,390,1280]){
    console.log(`${mode}: teaching ${width} px`);
    await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width,height:width<600?700:900,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:3});await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
    const tap=async selector=>width<600?h.touch(await h.point(selector),0,0):h.click(selector);
    const choose=async (selector,value)=>h.inside(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const panel=async()=>{if(await h.inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="false"'))await tap('#panelToggle');};
    const hidePanel=async()=>{if(width<600&&await h.inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="true"'))await tap('#panelToggle');};
    const focus=async id=>{await hidePanel();await tap(`[data-hit="body:${id}"]`);if(!await h.inside('document.getElementById("focusSelected").hidden'))await tap('#focusSelected');};
    const number=async(selector,value)=>{await tap(selector);await h.inside(`document.querySelector(${JSON.stringify(selector)}).select()`);await h.send('Input.insertText',{text:String(value)});await tap('#selectionTitle');};
    const evidence=(kind,data)=>h.evidence.push({mode,width,kind,...data});
    await h.inside(`window.__teachingEvents=[];for(const name of ['pointerdown','pointermove','pointerup','input','change'])document.addEventListener(name,e=>__teachingEvents.push({type:e.type,trusted:e.isTrusted,pointer:e.pointerType||null,target:e.target.dataset.hit||e.target.id}),true);`);
    await h.load(M.empty());await panel();await tap('[data-add="galvanometer"]');let doc=await h.doc();assert.equal(doc.components[0].type,'galvanometer');assert.equal(doc.components[0].params.range,.00005);await tap('[data-add="rheostat"]');doc=await h.doc();assert.equal(doc.components[1].params.terminals,4);evidence('palette',{defaultFourPosts:true,nativeG:true});

    const divider=P.create('divider'),extra=M.addWire(divider,440,30);M.attach(divider,extra.id,'from','c2:d');await h.load(divider);await focus('c2');await panel();
    assert.equal(await h.inside('document.querySelector("[data-param=terminals]").value'),'4');const original=await h.save();
    await choose('[data-param=terminals]',3);doc=await h.doc();assert.equal(doc.components[1].params.terminals,3);assert(!doc.wires.some(w=>[w.from,w.to].includes('c2:d')));assert.equal(doc.wires.length,divider.wires.length);
    await choose('[data-param=terminals]',2);doc=await h.doc();assert.equal(doc.components[1].params.terminals,2);assert(!doc.wires.some(w=>[w.from,w.to].includes('c2:c')));assert.equal(doc.wires.length,divider.wires.length);await tap('#undo');await tap('#undo');assert.equal(await h.save(),original);evidence('terminal-controls',{counts:[4,3,2],hiddenPostsUnplugged:true,finiteStock:true,undo:true,selectMethod:'production change handler'});
    await h.load(P.create('divider'));await focus('c2');await hidePanel();let start=await h.point('[data-hit="slider:c2"]');const saved=await h.save(),ends=M.endpoints(await h.doc()),scale=await h.inside('CircuitWorkbench.getInteraction().camera.scale');
    if(width<600)await h.touch(start,24*scale,0);else{await h.send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',buttons:1,clickCount:1});for(let n=1;n<=6;n++)await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x+24*scale*n/6,y:start.y,button:'left',buttons:1});await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:start.x+24*scale,y:start.y,button:'left',buttons:0,clickCount:1});}
    doc=await h.doc();near(doc.components[1].params.position,.9,.011);for(const p of R.ports(doc.components[1]))assert.deepEqual(p,ends.get(p.id),'slider never moves sockets');assert(await h.inside('document.getElementById("preview").hidden'));await tap('#undo');assert.equal(await h.save(),saved);
    if(width<600){start=await h.point('[data-hit="slider:c2"]');await h.touch(start,24*scale,0,null,true);assert.equal(await h.save(),saved,'touch cancellation restores slider');}
    evidence('slider',{trusted:true,position:.9,fixedSockets:true,noPreview:true,undo:true,cancel:width<600});
    for(const view of ['real','schematic'])for(const angle of [0,90,180,270]){
      const f=P.create('divider'),c=f.components[1],before=M.clone(f);c.angle=angle;assert(M.reconcile(f,before));f.display.view=view;await h.load(f);
      const alignment=await h.inside(`(()=>{const d=CircuitWorkbench.getDocument(),errors=[];for(const c of d.components.filter(c=>['rheostat','galvanometer'].includes(c.type)))for(const p of CircuitRegistry.ports(c)){const node=document.querySelector('[data-port="'+p.id+'"]'),a=new DOMPoint(+node.getAttribute('cx'),+node.getAttribute('cy')).matrixTransform(node.getScreenCTM());for(const w of d.wires)for(const k of ['from','to'])if(w[k]===p.id){const line=document.querySelector('[data-wire="'+w.id+'"]'),b=line.getPointAtLength(k==='from'?0:line.getTotalLength()).matrixTransform(line.getScreenCTM());errors.push(Math.hypot(a.x-b.x,a.y-b.y));}}return errors;})()`);assert(alignment.every(e=>e<.04));evidence('rotated-rheostat',{view,angle,maximumError:Math.max(...alignment)});
    }

    const gd=M.empty();gd.display.meters='analog';M.add(gd,'battery',170,200,{voltage:.001});M.add(gd,'galvanometer',400,350);M.connect(gd,'c1:a','c2:a',[], 'free');M.connect(gd,'c2:b','c1:b',[], 'free');await h.load(gd);await focus('c2');await hidePanel();await tap('[data-hit="body:c2"]');
    if(width<600){await h.delay(500);assert(!await h.inside('document.getElementById("preview").hidden'));near(await h.inside('Number(document.querySelector("#preview [data-meter-needle]").dataset.angle)'),-78);await tap('#closePreview');assert(await h.inside('document.getElementById("preview").hidden'));}
    await tap('#inspectMeter');assert(await h.inside('document.getElementById("meterDialog").open'));assert.equal(await h.inside('document.querySelectorAll("#meterDetail [data-meter-tick]").length'),41);near(await h.inside('Number(document.querySelector("#meterDetail [data-meter-needle]").dataset.reading)'),.00001);await h.screenshot(`${mode}-teaching-G-${width}.png`);await tap('#closeMeter');
    await panel();near(await h.inside('document.querySelector("[data-param=range]").valueAsNumber'),50);await number('[data-param=range]',100);near((await h.doc()).components[1].params.range,.0001);await tap('#undo');near((await h.doc()).components[1].params.range,.00005);evidence('G-display',{centerZero:true,actualNeedle:true,ticks:41,microampInput:true,trustedNumericInput:true,persistentTouchPreview:width<600});
    for(const fraction of [-1.2,-1,-.2,0,.2,1,1.2]){
      const f=M.clone(gd);f.components[0].params.voltage=Math.abs(fraction)*.005;f.components[0].params.polarity=fraction<0?-1:1;await h.load(f);const out=await h.inside('({r:CircuitWorkbench.getAnalysis().components.c2,angle:Number(document.querySelector("#scene [data-meter-needle]").dataset.angle),ticks:document.querySelectorAll("#scene [data-meter-tick]").length})');near(out.r.reading,fraction*.00005);near(out.angle,-90+60*Math.max(-1.03,Math.min(1.03,fraction)));assert.equal(out.ticks,41);evidence('G-boundary',{fraction,...out});
    }
    // Actual cable pickup and snap to both polar sockets, with the other end initially free.
    const rewired=M.clone(gd);rewired.wires=[];await h.load(rewired);await hidePanel();await tap('[data-camera=fit]');
    for(const [from,to]of [['c2:a','c1:a'],['c2:b','c1:b']]){
      await tap('#quickWire');const cable=(await h.doc()).wires.at(-1);
      for(const [end,ref]of [['from',from],['to',to]]){
        const a=await h.point(`[data-hit="wireend:${cable.id}:${end}"]`),p=M.endpoints(await h.doc()).get(ref),b=await h.scenePoint(p);
        if(width<600)await h.touch(a,b.x-a.x,b.y-a.y);else{await h.send('Input.dispatchMouseEvent',{type:'mousePressed',x:a.x,y:a.y,button:'left',buttons:1,clickCount:1});for(let n=1;n<=8;n++)await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a.x+(b.x-a.x)*n/8,y:a.y+(b.y-a.y)*n/8,button:'left',buttons:1});await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:b.x,y:b.y,button:'left',buttons:0,clickCount:1});}
        assert.equal((await h.doc()).wires.find(w=>w.id===cable.id)[end],ref,'physical end snaps to G/source socket');
      }
    }
    near(await h.inside('CircuitWorkbench.getAnalysis().components.c2.reading'),.00001);const wired=await h.save();await h.load(wired);near(await h.inside('CircuitWorkbench.getAnalysis().components.c2.reading'),.00001);evidence('G-trusted-wiring',{twoSockets:true,finiteCables:true,restore:true});

    const thermal=P.create('divider');thermal.components[0].params.voltage=3;Object.assign(thermal.components[2].params,{model:'thermal',resistance:2.5/.43,ratedVoltage:2.5,coldRatio:2.1,linearLoss:.99});await h.load(thermal);const recorded=await h.save();
    // Lamp rated power input controls actual hot resistance, not only a caption.
    await hidePanel();await focus('c3');await panel();near(await h.inside('document.querySelector("[data-param=ratedPower]").valueAsNumber'),1.075);await number('[data-param=ratedPower]',2);near((await h.doc()).components[2].params.resistance,3.125);await tap('#undo');assert.equal(await h.save(),recorded);evidence('rated-lamp',{actualRatedPowerInput:true,undo:true});
    await tap('#settings');await tap('#clearAll');doc=await h.doc();assert.equal(doc.components.length,0);assert(!doc.measurements);await tap('#closeSettings');await tap('#undo');assert.equal(await h.save(),recorded);evidence('whole-clear',{emptyCircuit:true,undo:true});
    assert(await h.inside('document.documentElement.scrollWidth<=innerWidth'));const events=await h.inside('__teachingEvents');assert(events.some(e=>e.trusted&&e.type==='pointermove'&&e.pointer===(width<600?'touch':'mouse')));assert(events.some(e=>e.trusted&&e.type==='input'));evidence('input-and-layout',{trustedEvents:events.filter(e=>e.trusted).length,noHorizontalOverflow:true,selectMethod:'production change handler'});
  }
}
module.exports={teachingCases};
