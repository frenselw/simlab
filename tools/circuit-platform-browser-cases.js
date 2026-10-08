'use strict';
const assert=require('node:assert/strict');
async function platformCases(h,mode,base){
  let contactId=190000;
  const control=id=>`#embeddedEditor [data-circuit-id="${id}"]`;
  async function wait(expression){for(let n=0;n<100;n++){if(await h.inside(expression))return;await h.delay(30);}throw Error('Embedded editor timed out: '+expression);}
  async function contact(p,dy=0,mobile=true,dx=0){
    const id=contactId++;
    if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id,radiusX:2,radiusY:2,force:1}]});
    else await h.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
    for(let n=1;n<=6;n++){const to={x:p.x+dx*n/6,y:p.y+dy*n/6};if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...to,id,radiusX:2,radiusY:2,force:1}]});else await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...to,button:'left',buttons:1});await h.delay(18);}
    if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+dx,y:p.y+dy,button:'left',buttons:0,clickCount:1});
    await h.delay(70);
  }
  const tap=async(selector,mobile)=>contact(await h.point(selector),0,mobile);
  const doc=()=>h.inside('__embedded.exportDocument()');
  async function fixture(profile='toolbox'){
    await h.inside(`(async()=>{
      window.CircuitWorkbench?.destroy();window.CircuitActivity?.destroy();window.__embedded?.destroy();window.__outerFullscreen?.destroy();
      document.body.innerHTML='<main id="embeddedActivity" class="sim-app" data-sim-fullscreen-target style="height:100dvh;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto"><header class="sim-header" data-sim-fullscreen style="display:flex;align-items:center;gap:8px;padding:6px 56px 6px 8px;min-height:56px"><div><h1 style="font-size:1.25rem">電路嵌入驗證</h1></div><button id="outerCheck">檢查電路</button></header><div id="embeddedEditor" style="min-height:0"></div><p id="outerFeedback" style="margin:0;padding:4px;font-size:1rem" role="status">此頁只驗證共用核心。</p></main>';
      const config=CircuitActivityProfiles.create(${JSON.stringify(profile)});config.ui.header=false;
      window.__embedded=await CircuitEditor.mount(document.getElementById('embeddedEditor'),config);
      window.__outerFullscreen=SimFullscreen.attach(document);
      document.getElementById('outerCheck').onclick=()=>document.getElementById('outerFeedback').textContent=__embedded.check().message;
      window.__embedEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>__embedEvents.push({type,trusted:e.isTrusted,pointer:e.pointerType,hit:e.target.dataset.hit}),true);
    })()`);
    await h.delay(100);
    assert.equal(await h.inside('document.querySelectorAll("[data-sim-fullscreen-target]").length'),1);
    assert.equal(await h.inside('document.querySelectorAll(".sim-fullscreen-button").length'),1);
    assert.equal(await h.inside('document.querySelectorAll("#embeddedEditor .sim-header").length'),0);
    assert(await h.inside('!document.getElementById("embeddedEditor").hasAttribute("data-sim-fullscreen-target")'));
  }
  for(const [width,height]of [[1280,800],[768,1024],[390,844],[320,500],[844,390]]){
    const mobile=width<900;
    await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await h.send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:2});
    await h.send('Page.navigate',{url:base+'/circuit-workbench/activity-examples.html'});await wait('Boolean(window.CircuitActivity)');await fixture();
    console.log(`${mode}: embedded circuit ${width}×${height}`);
    if(await h.inside(`document.querySelector('${control('panelToggle')}').getAttribute('aria-expanded')==='false'`))await tap(control('panelToggle'),mobile);
    for(const id of ['undo','redo','panelToggle']){
      const r=await h.point(control(id));assert(r.width>=44&&r.height>=44);
      assert(r.x-r.width/2>=0&&r.x+r.width/2<=width+1&&r.y-r.height/2>=0&&r.y+r.height/2<=height+1,'embedded controls remain reachable');
    }
    await tap('#embeddedEditor [data-add="lamp"]',mobile);await tap('#embeddedEditor [data-add="lamp"]',mobile);
    assert.equal(await h.inside('__embedded.getDocument().components.length'),2);
    const full=await doc();assert.equal(await h.inside('__embedded.execute({type:"addComponent",key:"lamp"})'),false);assert.equal(await doc(),full);
    await tap(control('undo'),mobile);assert.equal(await h.inside('__embedded.getDocument().components.length'),1);
    await tap(control('redo'),mobile);assert.equal(await doc(),full);
    await tap(control('panelToggle'),mobile);await tap(control('quickWire'),mobile);
    const partial=await doc();await h.inside('__embedded.loadDocument(__embedded.getDocument())');await tap(control('quickWire'),mobile);assert.equal(await h.inside('__embedded.getDocument().wires.length'),2);
    await tap(control('undo'),mobile);assert.equal(await doc(),partial);
    const before=await doc();await tap('#fullscreenButton',mobile);await wait('document.fullscreenElement===document.getElementById("embeddedActivity")');assert.equal(await doc(),before);
    await h.inside('document.exitFullscreen()');await wait('!document.fullscreenElement&&document.getElementById("fullscreenButton").getAttribute("aria-pressed")==="false"');
    await h.inside('__embedded.setReadOnly(true)');assert.equal(await h.inside('__embedded.execute({type:"remove",id:"c1"})'),false);assert.equal(await doc(),before);
    await tap('#fullscreenButton',mobile);await wait('!!document.fullscreenElement');await tap('#fullscreenButton',mobile);await wait('!document.fullscreenElement');assert.equal(await doc(),before);
    await h.inside('window.__nativeFullscreen=Element.prototype.requestFullscreen;window.__webkitFullscreen=Element.prototype.webkitRequestFullscreen;Element.prototype.requestFullscreen=undefined;Element.prototype.webkitRequestFullscreen=undefined;');
    await tap('#fullscreenButton',mobile);await wait('!document.getElementById("fullscreenStatus").hidden');assert.equal(await doc(),before);
    await h.inside('Element.prototype.requestFullscreen=__nativeFullscreen;Element.prototype.webkitRequestFullscreen=__webkitFullscreen;');
    assert(await h.inside('__embedEvents.some(e=>e.trusted)'));
    await h.screenshot(`${mode}-embedded-${width}x${height}.png`);
    // Destroy an embedded instance without destroying the outer fullscreen controller.
    await h.inside(`(async()=>{__embedded.destroy();window.__embedded=await CircuitEditor.mount(document.getElementById('embeddedEditor'),{...CircuitActivityProfiles.create('two-lamps'),ui:{header:false,inspector:false,viewToggle:true}});})()`);
    assert.equal(await h.inside('document.querySelectorAll(".sim-fullscreen-button").length'),1);
    for(let n=0;await h.inside('__embedded.getInteraction().camera.scale<.6');n++){assert(n<30);await tap('#embeddedEditor [data-camera="in"]',mobile);}
    await tap(control('quickWire'),mobile);assert.equal(await h.inside('__embedded.getDocument().wires.length'),1);
    for(const [end,target]of [['from','c1:b'],['to','c2:a']]){
      const a=await h.point(`#embeddedEditor [data-hit="wireend:w1:${end}"]`),b=await h.inside(`(()=>{const p=CircuitModel.endpoints(__embedded.getDocument()).get('${target}'),c=__embedded.getInteraction().camera,r=document.querySelector('${control('surface')}').getBoundingClientRect();return{x:r.left+(p.x-c.x)*c.scale,y:r.top+(p.y-c.y)*c.scale};})()`);
      const hit=await h.inside(`document.elementFromPoint(${a.x},${a.y})?.dataset.hit`);assert.equal(hit,'wireend:w1:'+end);await h.inside('__embedEvents=[]');
      await contact(a,b.y-a.y,mobile,b.x-a.x);
      if(await h.inside(`__embedded.getDocument().wires[0].${end}`)!==target){console.log({width,height,end,target,a,b,hit,interaction:await h.inside('__embedded.getInteraction()'),surface:await h.point(control('surface'))});await h.screenshot(`${mode}-embedded-wire-failure.png`);}
      assert.equal(await h.inside(`__embedded.getDocument().wires[0].${end}`),target);
      const events=await h.inside('__embedEvents');assert(events.some(e=>e.type==='pointerdown'&&e.trusted&&e.hit==='wireend:w1:'+end));assert(events.some(e=>e.type==='pointermove'&&e.trusted));assert(events.some(e=>e.type==='pointerup'&&e.trusted));assert(!events.some(e=>e.type==='pointercancel'));
    }
    await tap('#outerCheck',mobile);assert(await h.inside('__embedded.check().passed'));
    await h.inside(`(async()=>{const host=document.createElement('div');host.id='secondEmbedded';host.style.height='120px';document.body.append(host);const first=__embedded.exportDocument();const second=await CircuitEditor.mount(host,{...CircuitActivityProfiles.create('two-lamps'),ui:{header:false,inspector:false}});second.execute({type:'addWire'});if(__embedded.exportDocument()!==first)throw Error('Embedded instance leaked');if(new Set([...document.querySelectorAll('[id]')].map(e=>e.id)).size!==document.querySelectorAll('[id]').length)throw Error('Duplicate IDs');second.destroy();host.remove();})()`);
    assert.equal(await h.inside('document.querySelectorAll(".sim-fullscreen-button").length'),1);
    h.evidence.push({mode,width,height,embedded:true,stock:true,undoRedo:true,restoreContinuation:true,wholeActivityFullscreen:true,unsupportedFullscreen:true,readOnly:true,remount:true,trustedWiring:true,instanceIsolation:true});
  }
  for(const host of ['T1','T2','T3','denied']){
    await h.freshPage();const nested=host==='T2';h.setContext(nested?'window.document.getElementById("wrapper").contentWindow.document.getElementById("activity").contentWindow':'window.document.getElementById("activity").contentWindow');
    await h.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await h.send('Page.navigate',{url:base+'/__circuit-host?case='+(host==='denied'?'T1&blocked':host)});await h.ready();
    // The teacher page does not load the demo profiles; its core accepts the same local configuration.
    await h.inside(`window.CircuitActivityProfiles={create:()=>({role:'student',initialDocument:CircuitModel.empty(),ui:{inspector:false,viewToggle:true}})};`);await fixture();
    if(host==='denied'){
      const before=await doc();await tap('#fullscreenButton',true);await wait('!document.getElementById("fullscreenStatus").hidden');assert(!await h.inside('document.fullscreenElement'));assert.equal(await doc(),before);h.evidence.push({mode,host,blockedFullscreen:true,visibleFailure:true,answerUnchanged:true});continue;
    }
    const reset=()=>h.inside(host==='T3'?'window.top.document.getElementById("owner").scrollTop=200':'window.top.scrollTo(0,200)');
    const metrics=()=>h.inside(`(()=>{const owner=${host==='T3'?'window.top.document.getElementById("owner").scrollTop':'window.top.scrollY'};return{owner,activity:scrollY,wrapper:${nested?'window.parent.scrollY':'0'},panel:document.querySelector('${control('panel')}')?.scrollTop||0,viewport:{x:visualViewport.offsetLeft,y:visualViewport.offsetTop,scale:visualViewport.scale}};})()`);
    for(const readonly of [false,true]){
      await h.inside(`__embedded.setReadOnly(${readonly})`);
      for(const side of ['left','right'])for(const dy of [-65,65]){
        await reset();await h.delay(80);const before=await doc(),start=await metrics(),samples=[];
        const p=await h.point('#embeddedEditor .scroll-strip.'+side),id=contactId++;
        await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id,radiusX:2,radiusY:2,force:1}]});
        for(let n=1;n<=8;n++){await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y+dy*n/8,id,radiusX:2,radiusY:2,force:1}]});await h.delay(22);samples.push(await metrics());}
        await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await h.delay(70);samples.push(await metrics());
        const delta=samples.at(-1).owner-start.owner;assert(dy<0?delta>10:delta<-10,`${host} embedded ${side} host scroll`);
        for(const s of samples){assert.equal(s.activity,0);assert.equal(s.wrapper,0);assert.equal(s.panel,0);assert.deepEqual(s.viewport,start.viewport);}assert.equal(await doc(),before);
        h.evidence.push({mode,host,readonly,side,dy,samples,hostScroll:true,answerUnchanged:true});
      }
    }
  }
  await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
  for(const policyAllows of [true,false]){
    const config={role:'student',ui:{header:false,palette:true,inspector:true},components:{default:{params:true,switch:!policyAllows}},palette:[{type:'switch',params:{closed:true},limit:1}]};
    await h.inside(`(async()=>{CircuitWorkbench.destroy();const config=${JSON.stringify(config)},d=CircuitModel.empty();d.policy.allowSwitch=${policyAllows};config.initialDocument=d;window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),config);window.__switchLoadChanges=0;CircuitWorkbench.onChange(()=>__switchLoadChanges++);})()`);
    const before=await h.save(),result=await h.inside(`(()=>{const d=CircuitWorkbench.getDocument();CircuitModel.add(d,'switch',200,200,{closed:false});try{CircuitWorkbench.loadDocument(d);return{rejected:false};}catch(e){return{rejected:true,message:e.message};}})()`);assert(result.rejected);assert.equal(await h.save(),before);assert.equal(await h.inside('__switchLoadChanges'),0,'invalid restore is atomic and does not notify');
    assert(await h.inside(`CircuitWorkbench.execute({type:'addComponent',key:'switch',x:200,y:200})`));const saved=await h.save();await h.load(saved);assert.equal(await h.save(),saved);assert.equal((await h.doc()).components[0].params.closed,true);assert.equal(await h.inside(`CircuitWorkbench.execute({type:'setParam',id:'c1',key:'closed',value:false})`),false);assert.equal(await h.save(),saved);
    h.evidence.push({mode,switchRestore:true,policyAllows,invalidAtomic:true,legalRestore:true,fixedClosed:true});
  }
  await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),{ui:{palette:true,inspector:true},components:{default:{params:['closed'],switch:false}},palette:[{type:'switch',key:'open',params:{closed:false},limit:1},{type:'switch',key:'closed',params:{closed:true},limit:1}]});})()`);
  for(const key of ['open','closed'])assert(await h.inside(`CircuitWorkbench.execute({type:'addComponent',key:'${key}',x:${key==='open'?200:400},y:200})`));const pair=await h.save();await h.load(pair);assert.deepEqual((await h.doc()).components.map(c=>c.params.closed),[false,true]);assert(await h.inside(`[...document.querySelectorAll('[data-add]')].every(b=>b.disabled)`));assert(await h.inside(`CircuitWorkbench.execute({type:'undo'})`));
  h.evidence.push({mode,fixedSwitchVariants:true,separateStock:true,restoredContinuation:true});
}
module.exports={platformCases};
