'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model'),A=require('../sim/circuit-workbench/activity-profiles');
async function activityCases(h,mode,base) {
  let contactId=91000;
  for(const width of [1280,390]) {
    const mobile=width===390,height=mobile?844:800;
    console.log(`${mode}: configurable activity editor ${width}px`);
    await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await h.send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:2});
    await h.send('Page.navigate',{url:base+'/circuit-workbench/activity-examples.html'});
    async function until(expression){for(let i=0;i<100;i++){if(await h.inside(expression))return;await h.delay(40);}throw new Error('Activity timed out: '+expression);}
    await until('Boolean(window.CircuitActivity)');await h.delay(100);
    const doc=()=>h.inside('CircuitActivity.getDocument()'), save=()=>h.inside('CircuitActivity.exportDocument()');
    const control=id=>`[data-circuit-id="${id}"]`;
    async function contact(a,b=a) {
      const id=contactId++;
      if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y,id,radiusX:2,radiusY:2,force:1}]});
      else await h.send('Input.dispatchMouseEvent',{type:'mousePressed',x:a.x,y:a.y,button:'left',buttons:1,clickCount:1});
      for(let i=1;i<=8;i++){const p={x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8};if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id,radiusX:2,radiusY:2,force:1}]});else await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1});}
      if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:b.x,y:b.y,button:'left',buttons:0,clickCount:1});await h.delay(50);
    }
    const tap=async selector=>contact(await h.point(selector));
    async function worldPoint(p){return h.inside(`(()=>{const r=document.querySelector(${JSON.stringify(control('surface'))}).getBoundingClientRect(),c=CircuitActivity.getInteraction().camera;return{x:r.left+(${p.x}-c.x)*c.scale,y:r.top+(${p.y}-c.y)*c.scale};})()`);}
    async function link(w,end,target){const a=await h.point(`[data-hit="wireend:${w}:${end}"]`),b=await worldPoint(M.endpoints(await doc()).get(target));await contact(a,b);assert.equal((await doc()).wires.find(x=>x.id===w)[end],target);}
    async function choose(id){await h.inside(`window.__previousActivity=CircuitActivity;document.getElementById('activityChoice').value=${JSON.stringify(id)};document.getElementById('activityChoice').dispatchEvent(new Event('change',{bubbles:true}));`);await until('CircuitActivity&&CircuitActivity!==__previousActivity');assert(await h.inside('__previousActivity.getInteraction().destroyed'));await h.delay(80);}
    const evidence=(kind,extra={})=>h.evidence.push({mode,width,activity:kind,...extra});
    await h.inside('window.__activityEvents=[];document.addEventListener("pointerup",e=>__activityEvents.push({trusted:e.isTrusted,pointer:e.pointerType}),true);window.__changes=0;CircuitActivity.onChange(()=>__changes++);');
    assert.deepEqual((await doc()).components.map(c=>c.type),['lamp','lamp']);
    assert(await h.inside('!["settings","settingsDialog","preset","save","open","fileInput","palette","panel"].some(id=>document.querySelector("[data-circuit-id=\\\""+id+"\\\"]"))'));
    assert(!(await h.inside('CircuitActivity.check().passed')));await tap(control('quickWire'));const w=(await doc()).wires[0];await link(w.id,'from','c1:b');await link(w.id,'to','c2:a');
    await tap('#checkActivity');assert(await h.inside('document.getElementById("activityFeedback").dataset.passed==="true"'));
    const good=await save(),basePart=(await doc()).components[0],p=await h.point('[data-hit="body:c1"]');await contact(p,{x:p.x+40,y:p.y+20});await h.key('r','KeyR');await h.key('Delete','Delete',46);assert.deepEqual((await doc()).components[0],basePart);assert.equal(await save(),good);
    assert.equal(await h.inside('CircuitActivity.execute({type:"setParam",id:"c1",key:"resistance",value:20})'),false);
    assert(await h.inside('(()=>{const d=CircuitActivity.getDocument();d.policy.allowParams=true;try{CircuitActivity.loadDocument(d);return false;}catch{return true;}})()'));assert.equal(await save(),good);
    const restored=await doc();await h.inside(`CircuitActivity.loadDocument(${JSON.stringify(restored)})`);await tap(control('quickWire'));assert.equal((await doc()).wires.length,2);assert(await h.inside('__changes>=4'));
    evidence('minimal-series-and-fixed-guards',{trustedWiring:true,topologyChecked:true,teacherControlsAbsent:true,keyboardCommandAndImportGuarded:true,restoredContinuation:true});
    await tap('#reviewOnly');const frozen=await save();assert(await h.inside('CircuitActivity.getInteraction().readOnly'));assert(await h.inside('document.querySelector("[data-circuit-id=quickWire]").disabled'));
    assert.equal(await h.inside('CircuitActivity.execute({type:"detach",id:"w1",end:"from"})'),false);
    await tap(control('pan'));const surface=await h.point(control('surface')),camera=await h.inside('CircuitActivity.getInteraction().camera');await contact({x:surface.x,y:surface.y},{x:surface.x+30,y:surface.y+20});assert.notDeepEqual(await h.inside('CircuitActivity.getInteraction().camera'),camera);assert.equal(await save(),frozen);await tap(control('pan'));await tap('#reviewOnly');
    evidence('review-navigation',{readOnlyGuard:true,panStillWorks:true});
    if(!mobile){
      const beforeFullscreen=await save();await tap(control('fullscreenButton'));await until('document.fullscreenElement===document.getElementById("activityEditor")');
      assert.equal(await h.inside('document.querySelector("[data-circuit-id=fullscreenButton]").getAttribute("aria-pressed")'),'true');
      await tap(control('fullscreenButton'));await until('!document.fullscreenElement');assert.equal(await save(),beforeFullscreen);
      evidence('fullscreen',{trustedEnterAndExit:true,scopedTarget:true});
    }
    await choose('toolbox');await tap(control('panelToggle')); // mobile starts collapsed; desktop starts open
    if(await h.inside('document.querySelector("[data-circuit-id=panelToggle]").getAttribute("aria-expanded")==="false"'))await tap(control('panelToggle'));
    assert.deepEqual(await h.inside('[...document.querySelectorAll("[data-add]")].map(b=>b.dataset.add)'),['battery','switch','lamp']);
    await tap('[data-add="lamp"]');await tap('[data-add="lamp"]');assert(await h.inside('document.querySelector("[data-add=lamp]").disabled'));assert.equal((await doc()).components.length,2);
    assert.equal(await h.inside('CircuitActivity.execute({type:"addComponent",key:"voltmeter",x:600,y:300})'),false);assert.equal(await h.inside('CircuitActivity.execute({type:"addComponent",key:"lamp",x:600,y:300})'),false);
    await tap('[data-add="battery"]');await tap('[data-add="switch"]');assert.equal((await doc()).components.length,4);
    await h.inside('CircuitActivity.execute({type:"move",id:"c1",x:260,y:220});CircuitActivity.execute({type:"rotate",id:"c1"})');assert.equal((await doc()).components[0].angle,90);await h.screenshot(`${mode}-activity-toolbox-${width}.png`);
    evidence('limited-toolbox',{onlyThreeTypes:true,stockEnforced:true,addMoveRotate:true});
    await choose('fixed');const fixed=await save(),fixedPoint=await h.point('[data-hit="body:c3"]');await contact(fixedPoint,{x:fixedPoint.x-35,y:fixedPoint.y+20});assert.equal(await save(),fixed);assert(!(await h.inside('CircuitActivity.check().passed')));await tap(control('quickWire'));assert.equal((await doc()).wires.length,1);evidence('fixed-parts',{partsStayFixed:true,wiringAllowed:true});
    await choose('slider');await h.inside('CircuitActivity.execute({type:"setParam",id:"c4",key:"position",value:.25})');assert.equal((await doc()).components[3].params.position,.25);
    assert.equal(await h.inside('CircuitActivity.execute({type:"setParam",id:"c4",key:"resistance",value:80})'),false);assert.equal(await h.inside('CircuitActivity.execute({type:"setParam",id:"c4",key:"terminals",value:2})'),false);
    await tap('[data-hit="slider:c4"]');if(await h.inside('document.querySelector("[data-circuit-id=panelToggle]").getAttribute("aria-expanded")==="false"'))await tap(control('panelToggle'));
    assert.deepEqual(await h.inside('[...document.querySelectorAll("[data-circuit-id=properties] [data-param]")].map(e=>e.dataset.param)'),['position']);
    const input=control('properties')+' [data-param="position"]';await tap(input);await h.inside('document.querySelector("[data-circuit-id=properties] [data-param=position]").select()');await h.send('Input.insertText',{text:'75'});await tap(control('selectionTitle'));assert.equal((await doc()).components[3].params.position,.75);
    // Use the same permitted physical cable commands as an activity host. These
    // setup calls are distinct from the trusted mouse/touch wiring above.
    for(const [from,to] of [['c1:a','c2:a'],['c2:b','c3:a'],['c3:b','c4:b'],['c4:a','c1:b']]) {
      await h.inside(`(()=>{const d=CircuitActivity.getDocument(),ends=CircuitModel.endpoints(d),a=ends.get(${JSON.stringify(from)}),b=ends.get(${JSON.stringify(to)});CircuitActivity.execute({type:'addWire',x:(a.x+b.x)/2,y:(a.y+b.y)/2});const w=CircuitActivity.getDocument().wires.at(-1);CircuitActivity.execute({type:'attach',id:w.id,end:'from',target:${JSON.stringify(from)}});CircuitActivity.execute({type:'attach',id:w.id,end:'to',target:${JSON.stringify(to)}});})()`);
    }
    const sliderAnswer=await save(),checked=await h.inside('CircuitActivity.check()');assert(checked.passed);assert.equal(await save(),sliderAnswer);assert.equal(checked.evidence.samples.length,3);await tap('#checkActivity');await h.screenshot(`${mode}-activity-slider-${width}.png`);
    evidence('four-post-slider',{positionOnly:true,trustedParameterEdit:true,realSolverSamples:checked.evidence.samples,checkDoesNotMutateAnswer:true});
    if(mobile) {
      if(await h.inside('document.querySelector("[data-circuit-id=panelToggle]").getAttribute("aria-expanded")==="true"'))await tap(control('panelToggle'));
      const r=await h.point(control('surface')),start=await h.inside('CircuitActivity.getInteraction().camera'),points=[{x:r.x-35,y:r.y+20,id:contactId++},{x:r.x+35,y:r.y+20,id:contactId++}];
      await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points.map((p,i)=>({...p,x:p.x+(i?35:-35)+15,y:p.y-20}))});await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await h.delay(50);
      assert.notDeepEqual(await h.inside('CircuitActivity.getInteraction().camera'),start);assert.equal(await save(),sliderAnswer);evidence('touch-camera',{twoFingerPanAndPinch:true,answerUnchanged:true});
    }
    assert(await h.inside('document.documentElement.scrollWidth<=innerWidth'));assert(await h.inside('__activityEvents.some(e=>e.trusted&&e.pointer==='+JSON.stringify(mobile?'touch':'mouse')+')'));
    await h.inside('(async()=>{CircuitActivity.destroy();const config=CircuitActivityProfiles.create("two-lamps");config.ui.help=true;window.CircuitActivity=await CircuitEditor.mount(document.getElementById("activityEditor"),config);})()');
    await tap(control('help'));assert(await h.inside('document.querySelector("[data-circuit-id=helpDialog]").open'));await tap(control('closeHelp'));assert(!(await h.inside('document.querySelector("[data-circuit-id=helpDialog]").open')));
    evidence('optional-help',{studentInstructionsOnly:true,trustedOpenClose:true});
    if(!mobile) {
      await h.inside(`(async()=>{window.__old=CircuitActivity;window.__oldFlow=document.querySelector('[data-circuit-id=flowLayer]');window.__mutations=0;window.__watch=new MutationObserver(rs=>__mutations+=rs.length);__watch.observe(__oldFlow,{childList:true});__old.destroy();await new Promise(r=>requestAnimationFrame(r));__mutations=0;window.__one=await CircuitEditor.mount(document.getElementById('activityEditor'),CircuitActivityProfiles.create('two-lamps'));const sibling=document.createElement('div');sibling.id='second-editor';sibling.style.cssText='position:fixed;inset:0;height:50vh';document.body.append(sibling);window.__two=await CircuitEditor.mount(sibling,CircuitActivityProfiles.create('two-lamps'));window.CircuitActivity=__two;})()`);
      await h.delay(120);assert.equal(await h.inside('__mutations'),0,'destroy stops old RAF DOM writes');assert(await h.inside('(()=>{const ids=[...document.querySelectorAll("[id]")].map(e=>e.id);return new Set(ids).size===ids.length;})()'));
      assert(await h.inside('Array.from(document.querySelectorAll("use[href^=\\\"#\\\"]")).every(e=>document.getElementById(e.getAttribute("href").slice(1)))'));
      const first=await h.inside('__one.exportDocument()');await tap('#second-editor [data-circuit-id=quickWire]');assert.equal(await h.inside('__two.getDocument().wires.length'),1);assert.equal(await h.inside('__one.exportDocument()'),first);
      await h.inside('__two.destroy();document.getElementById("second-editor").remove();__one.destroy();__watch.disconnect()');assert(await h.inside('__old.getInteraction().destroyed&&__one.getInteraction().destroyed&&__two.getInteraction().destroyed'));
      evidence('instance-lifecycle',{destroyedAnimationStops:true,remount:true,simultaneousInstances:true,uniqueIds:true,scopedEvents:true});
    }
  }
}
module.exports={activityCases};
