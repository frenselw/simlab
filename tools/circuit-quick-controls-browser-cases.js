'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model'),
  P=require('../sim/circuit-workbench/presets'),A=require('../sim/circuit-workbench/activity-profiles');
async function quickControlsCases(h,mode,base){
  let touchId=98000,width,height;
  const control=id=>`[data-circuit-id="${id}"]`;
  const evidence=(kind,data={})=>h.evidence.push({mode,width,height,quickControls:kind,...data});
  async function contact(p,to=p){
    const id=touchId++,mobile=width<600;
    if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id,radiusX:2,radiusY:2,force:1}]});
    else await h.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
    if(p.x!==to.x||p.y!==to.y)for(let i=1;i<=6;i++){
      const point={x:p.x+(to.x-p.x)*i/6,y:p.y+(to.y-p.y)*i/6};
      if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id,radiusX:2,radiusY:2,force:1}]});
      else await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point,button:'left',buttons:1});
      await h.delay(12);
    }
    if(mobile)await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    else await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',buttons:0,clickCount:1});
    await h.delay(65);
  }
  async function tap(selector){
    const overflow=await h.inside(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e?.closest('[data-circuit-id=selectionActions]')&&!e.hidden&&getComputedStyle(e).display==='none'?e.dataset.circuitId:null;})()`);
    if(overflow){await contact(await h.point(control('moreSelected')));selector='[data-selection-action="'+overflow+'"]';}
    await contact(await h.point(selector));
  }
  async function body(id){return h.inside(`(()=>{const e=document.querySelector('[data-hit="body:${id}"]'),r=e.getBoundingClientRect();for(const x of [.5,.2,.8])for(const y of [.5,.2,.8]){const p={x:r.left+r.width*x,y:r.top+r.height*y};if(document.elementFromPoint(p.x,p.y)===e)return p;}throw new Error('No exposed body ${id}');})()`);}
  const select=async id=>{await contact(await body(id));assert.equal(await h.inside('CircuitWorkbench.getInteraction().selection?.id'),id);};
  async function enter(text){
    await tap(control('quickValue'));await h.inside(`document.querySelector('${control('quickValue')}').select()`);
    assert(await h.inside(`getComputedStyle(document.querySelector('${control('quickReadout')}')).display==='none'&&getComputedStyle(document.querySelector('${control('quickUnit')}')).display==='flex'`),'editing uses native input and math unit');
    await h.send('Input.insertText',{text});await h.key('Enter','Enter',13);await h.delay(60);
  }
  const value=()=>h.inside(`document.querySelector('${control('quickValue')}').valueAsNumber`);
  async function mount(config){
    await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),${JSON.stringify(config)});})()`);await h.delay(100);
  }
  async function layout(){
    const result=await h.inside(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{id:e.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};},visible=e=>e.getBoundingClientRect().width>1&&e.getBoundingClientRect().height>1;
      return{overflow:document.documentElement.scrollWidth-innerWidth,stage:rect(document.querySelector('.stage')),footer:rect(document.querySelector('.stage-bottom')),canvas:rect(document.querySelector('${control('surface')}')),
      top:[...document.querySelectorAll('.stage-tools>button')].filter(visible).map(rect),
      zoom:[document.querySelector('[data-camera=out]'),document.querySelector('${control('zoomReadout')}'),document.querySelector('[data-camera=in]'),document.querySelector('${control('fitView')}')].map(rect),
      actions:[...document.querySelectorAll('${control('selectionActions')} button')].filter(visible).map(rect),
      controls:[...document.querySelectorAll('.stage-bottom button,.stage-bottom input,.stage-bottom output')].filter(visible).map(rect)};})()`);
    assert(result.overflow<=1);assert(result.canvas.height>80);
    for(const r of result.controls){assert(r.width>=43.99&&r.height>=43.99,JSON.stringify(r));assert(r.left>=result.stage.left-.1&&r.right<=result.stage.right+.1,JSON.stringify(r));assert(r.top>=result.footer.top-.1&&r.bottom<=result.footer.bottom+.1,JSON.stringify(r));}
    for(let a=0;a<result.controls.length;a++)for(let b=a+1;b<result.controls.length;b++){
      const u=result.controls[a],v=result.controls[b];assert(Math.min(u.right,v.right)-Math.max(u.left,v.left)<.1||Math.min(u.bottom,v.bottom)-Math.max(u.top,v.top)<.1,'footer controls overlap: '+u.id+' '+v.id);
    }
    assert(result.zoom.every(r=>Math.abs(r.width-44)<.1));
    assert(await h.inside(`(()=>{const cells=[...document.querySelector('.camera-zoom').children];return cells.slice(1).every((e,i)=>parseFloat(getComputedStyle(cells[i]).borderRightWidth)+parseFloat(getComputedStyle(e).borderLeftWidth)===1);})()`),'each zoom cell boundary has one 1 px separator');
    for(const group of [result.zoom,result.actions])for(let i=1;i<group.length;i++)assert(Math.abs(group[i].left-group[i-1].right)<.1,'joined controls must touch without overlapping');
    assert.equal(await h.inside(`getComputedStyle(document.querySelector('${control('quickValue')}')).fontSize`),'16px');
    assert.equal(await h.inside(`getComputedStyle(document.querySelector('${control('zoomReadout')}')).fontSize`),'16px');
    if(await h.inside(`!document.querySelector('${control('quickParameters')}').hidden`)){
      const math=await h.inside(`(()=>{const input=document.querySelector('${control('quickValue')}'),svg=document.querySelector('${control('quickReadout')} svg'),a=input.getBoundingClientRect(),b=svg.getBoundingClientRect();return{value:input.value,text:svg.dataset.math,tex:svg.dataset.tex,font:getComputedStyle(svg).fontSize,left:b.left-a.left,right:a.right-b.right,top:b.top-a.top,bottom:a.bottom-b.bottom,shown:getComputedStyle(svg.parentElement).display};})()`);
      assert.equal(math.font,'16px');assert(math.text.startsWith(math.value+' '),'math readout preserves exact input digits');assert.equal(math.shown,'flex');assert(Math.min(math.left,math.right,math.top,math.bottom)>=-.1,'TeX glyphs stay inside input: '+JSON.stringify(math));
    }
    return result;
  }
  for(const size of [[1280,800],[390,844],[320,700],[844,390]]){
    [width,height]=size;console.log(`${mode}: quick parameters and alignment ${width}x${height}`);
    await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:2});
    await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();await h.load(P.create('series'));
    await h.inside(`window.__quickEvents=[];document.addEventListener('click',e=>__quickEvents.push({type:'click',trusted:e.isTrusted,id:e.target.id||e.target.closest('button')?.id}),true);document.addEventListener('input',e=>__quickEvents.push({type:'input',trusted:e.isTrusted,id:e.target.id}),true);`);
    if(await h.inside(`document.querySelector('${control('panelToggle')}').getAttribute('aria-expanded')==='true'`))await tap(control('panelToggle'));
    assert(await h.inside('document.getElementById("app").classList.contains("panel-hidden")'));
    const hidden=await layout();evidence('hidden-panel-columns',{layout:hidden});
    await select('c1');assert(await h.inside(`!document.querySelector('${control('quickParameters')}').hidden`));assert.equal(await value(),6);
    assert.equal(await h.inside(`document.querySelector('${control('quickValue')}').dataset.param`),'voltage');
    assert.equal(await h.inside(`document.querySelector('${control('quickUnit')} svg').dataset.math`),'V');
    assert(await h.inside(`document.querySelector('${control('quickReadout')} svg').dataset.tex==='6'+String.fromCharCode(92)+','+String.fromCharCode(92)+'mathrm{V}'`));
    assert(await h.inside(`document.querySelector('${control('focusSelected')} use').getAttribute('href').endsWith('icon-locate')&&document.querySelector('[data-camera=in] use').getAttribute('href').endsWith('icon-zoom-in')`),'locate and zoom use distinct icons');
    const before=await h.save();await h.inside('window.__quickChanges=0;CircuitWorkbench.onChange(()=>__quickChanges++);');
    await tap(control('quickPlus'));assert.equal((await h.doc()).components[0].params.voltage,6.5);assert.equal(await value(),6.5);assert.equal(await h.inside('__quickChanges'),1);
    assert(Math.abs((await h.inside('CircuitWorkbench.getAnalysis().components.c1.current'))+6.5/24)<1e-8);
    await tap(control('undo'));assert.equal(await h.save(),before);await tap(control('redo'));await select('c1');assert.equal(await value(),6.5);
    await enter('9');assert.equal((await h.doc()).components[0].params.voltage,9);assert(Math.abs((await h.inside('CircuitWorkbench.getAnalysis().components.c1.current'))+.375)<1e-8);
    const valid=await h.save();await enter('121');assert.equal(await h.save(),valid);assert(await h.inside(`document.querySelector('${control('quickValue')}').getAttribute('aria-invalid')==='true'&&!document.querySelector('${control('canvasNotice')}').hidden`));
    await enter('1e-7');assert.equal(await value(),1e-7);await layout();assert(await h.inside(`document.querySelector('${control('quickReadout')} svg').dataset.tex.includes('10^{-7}')`));
    await enter('9');assert(await h.inside(`document.querySelector('${control('canvasNotice')}').hidden`));const selected=await layout();await h.screenshot(`${mode}-quick-voltage-${width}.png`);
    evidence('voltage',{panelClosed:true,plus:true,typed:true,invalidAtomic:true,undoRedo:true,current:.375,layout:selected});
    await select('c3');assert.equal(await value(),12);assert.equal(await h.inside(`document.querySelector('${control('quickUnit')} svg').dataset.math`),'Ω');
    const old=await h.doc();await tap(control('quickPlus'));assert.equal((await h.doc()).components[2].params.resistance,13);assert.equal((await h.doc()).components[3].params.resistance,12);
    assert.deepEqual((await h.doc()).wires,old.wires);assert(Math.abs((await h.inside('CircuitWorkbench.getAnalysis().components.c1.current'))+.36)<1e-8);
    const saved=await h.save();await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(saved)})`);await h.delay(80);await select('c3');await tap(control('quickPlus'));assert.equal((await h.doc()).components[2].params.resistance,14);
    await tap(control('panelToggle'));assert(await h.inside(`!document.getElementById('app').classList.contains('panel-hidden')`));assert.equal(await value(),14);
    const opened=await layout();assert.equal(await h.inside(`document.querySelector('[data-param=resistance]:not(#quickValue)').valueAsNumber`),14);
    await h.screenshot(`${mode}-quick-resistance-${width}.png`);evidence('resistance-and-restore',{unchangedWires:true,continued:true,panelOpen:true,layout:opened});
    if(width===1280){
      const committed=await h.save(),slider=await h.point(`${control('properties')} input[type=range]`),changed=await h.inside('__quickChanges');
      await h.send('Input.dispatchMouseEvent',{type:'mousePressed',...slider,button:'left',buttons:1,clickCount:1});
      await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:slider.x+40,y:slider.y,button:'left',buttons:1});
      assert.equal(await h.save(),committed,'inspector range preview remains uncommitted');
      await h.key('Escape','Escape',27);
      await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:slider.x+40,y:slider.y,button:'left',buttons:0,clickCount:1});
      await h.delay(60);assert.equal(await h.save(),committed,'late native change after Escape cannot commit a cancelled range');assert.equal(await h.inside('__quickChanges'),changed);evidence('inspector-escape-release-no-commit');
    }
    await tap(control('panelToggle'));await h.load(P.create('series'));await h.delay(50);
    // Dragging the first selected component must not be cancelled by footer reflow.
    const d=await h.doc(),p=await body('c1');await h.inside('window.__bodyEvents=[];document.getElementById("surface").addEventListener("pointercancel",e=>__bodyEvents.push(e.type));');
    await contact(p,{x:p.x+30,y:p.y+20});assert.notEqual((await h.doc()).components[0].x,d.components[0].x);assert.deepEqual((await h.doc()).wires.map(w=>[w.from,w.to]),d.wires.map(w=>[w.from,w.to]));
    assert.deepEqual(await h.inside('__bodyEvents'),[]);assert.equal(await value(),6);await tap(control('undo'));assert.deepEqual(await h.doc(),d);evidence('drag-footer-stability');
    await h.load(P.create('series'));await select('c1');await h.inside('CircuitWorkbench.setReadOnly(true)');assert(await h.inside(`document.querySelector('${control('quickParameters')}').hidden`));
    const locked=await h.save();await h.inside(`document.querySelector('${control('quickPlus')}').onclick()`);assert.equal(await h.save(),locked);await h.inside('CircuitWorkbench.setReadOnly(false)');
    const events=await h.inside('__quickEvents');assert(events.some(e=>e.id==='quickPlus'&&e.trusted));assert(events.some(e=>e.id==='quickValue'&&e.type==='input'&&e.trusted));evidence('trusted-and-read-only',{trustedEvents:events.filter(e=>e.trusted).length});
    if(width===320){
      await select('c2');assert.equal((await h.doc()).components[1].params.closed,false);await select('c2');assert.equal((await h.doc()).components[1].params.closed,true);evidence('original-tap-target-retained');
    }
    const single=M.empty();M.add(single,'lamp',260,220);await h.load(single);await select('c1');
    const grouped=await layout();if(width===390)assert(grouped.footer.height<110,'390 px lamp uses two rows');if(width===320)assert(grouped.footer.height<110,'320 px lamp uses two rows');
    assert.equal(grouped.actions.length,width<480?3:5);
    assert.equal(await h.inside(`document.querySelector('${control('objectActions')}').querySelectorAll('button').length`),0,'inspector does not duplicate selected lamp actions');
    await tap(control('rotateSelected'));assert.equal((await h.doc()).components[0].angle,45);await tap(control('rotateCounterSelected'));assert.equal((await h.doc()).components[0].angle,0);
    await tap(control('copySelected'));const copied=await h.doc();assert.equal(copied.components.length,2);assert.equal(copied.components[1].params.resistance,12);assert.equal(copied.components[1].label,'白熾燈 副本');
    await tap(control('focusSelected'));assert((await h.inside('CircuitWorkbench.getInteraction().camera.scale'))>=1);await layout();
    await tap(control('deleteSelected'));assert.equal((await h.doc()).components.length,1);await tap(control('undo'));assert.equal((await h.doc()).components.length,2);
    await h.load(single);await select('c1');await h.inside('CircuitWorkbench.setReadOnly(true)');const frozen=await h.save();await h.inside(`document.querySelector('${control('copySelected')}').onclick()`);assert.equal(await h.save(),frozen);await tap(control('focusSelected'));assert.equal(await h.save(),frozen);await layout();await h.inside('CircuitWorkbench.setReadOnly(false)');
    await enter('12.3456789');assert.equal(await value(),12.3456789);await layout();assert.equal(await h.inside(`document.querySelector('${control('quickReadout')} svg').dataset.math`),'12.3456789 Ω');
    await enter('1000000');assert.equal(await value(),1000000);const wide=await layout();assert(await h.inside(`document.querySelector('.stage-bottom').classList.contains('has-wide-param')`));if(width<480)assert(wide.footer.height<110);evidence('wide-parameter',{value:1000000,exactDecimal:true,layout:wide});
    const meter=M.empty();M.add(meter,'ammeter',260,220);await h.load(meter);await select('c1');const meterLayout=await layout();assert.equal(meterLayout.actions.length,7);await tap(control('inspectMeter'));assert(await h.inside(`document.querySelector('${control('meterDialog')}').open`));await tap(control('closeMeter'));await tap(control('flipMeterSelected'));assert((await h.doc()).components[0].mirrored);
    evidence('joined-direct-actions',{layout:grouped,meterLayout,rotate:true,copy:true,locate:true,deleteUndo:true,readOnly:true});
    if(width===390){
      await h.load(P.create('series'));
      const wire=await h.inside(`(()=>{for(const e of document.querySelectorAll('.hit.wire')){if(e.meta.id!=='w4')continue;const r=e.getBoundingClientRect(),p={x:r.left+r.width/2,y:r.top+r.height/2};if(document.elementFromPoint(p.x,p.y)===e)return p;}throw new Error('No exposed wire w4');})()`);
      await contact(wire);assert.equal(await h.inside('CircuitWorkbench.getInteraction().selection?.id'),'w4');assert(await h.inside(`document.querySelector('${control('quickParameters')}').hidden`));evidence('wire-action-columns',{layout:await layout()});
      const config=A.create('slider');await mount(config);await select('c4');assert.equal(await value(),50);
      assert(await h.inside(`(()=>{const input=document.querySelector('${control('quickValue')}');return input.id!=='quickValue'&&input.closest('label').control===input;})()`));
      assert.equal(await h.inside(`document.querySelector('${control('quickValue')}').dataset.param`),'position');await tap(control('quickPlus'));assert.equal((await h.doc()).components[3].params.position,.51);assert.equal(await value(),51);
      assert(!await h.inside('Boolean(document.querySelector("[data-circuit-id=settings]"))'));evidence('student-slider-whitelist',{stored:.51,display:51});
      await tap(control('quickValue'));await h.inside(`document.querySelector('${control('quickValue')}').select()`);await h.send('Input.insertText',{text:'65'});
      await select('c3');assert.equal((await h.doc()).components[3].params.position,.65);assert(await h.inside(`document.querySelector('${control('quickParameters')}').hidden`));evidence('student-fixed-parameter-hidden',{blurCommitsOriginalComponent:true,prefixedLabel:true});
      await mount({...config,ui:{...config.ui,quickParameters:false}});await select('c4');assert(!await h.inside(`Boolean(document.querySelector('${control('quickParameters')}'))`));evidence('author-disables-quick-ui');
      await mount({role:'student',initialDocument:single,palette:[{type:'lamp',limit:2}],components:{default:{rotate:true,remove:true,params:['resistance']}},ui:{inspector:false}});await select('c1');await tap(control('copySelected'));assert.equal((await h.doc()).components.length,2);const atLimit=await h.save();assert(await h.inside(`document.querySelector('${control('copySelected')}').hidden`));await h.inside(`document.querySelector('${control('copySelected')}').onclick()`);assert.equal(await h.save(),atLimit);await tap(control('deleteSelected'));assert.equal((await h.doc()).components.length,1);await select('c1');assert(!await h.inside(`document.querySelector('${control('copySelected')}').hidden`));await tap(control('copySelected'));assert.equal((await h.doc()).components.length,2);evidence('student-copy-stock',{limit:2,inspectorDisabled:true});
    }
  }
  await h.freshPage();h.setContext('window');await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
  const checks=await compactFooterCases({...h,call:code=>h.inside('CircuitWorkbench.'+code),screenshot:name=>h.screenshot(name+'.png')},mode);
  evidence('two-row-footer',{checks});
}
// The same footer is used by DC and AC, including narrow native-dialog actions.
async function compactFooterCases(h,source,transient=false){
  let checks=0;
  const control=id=>`[data-circuit-id="${id}"]`,tap=async selector=>h.touch(await h.point(selector),0,0);
  const fixture=transient?require('../sim/circuit-workbench/circuit-ac-presets').create('resistive'):P.create('series');
  const lamp=fixture.components.findLast(c=>c.type==='lamp');
  async function layout(){
    const result=await h.inside(`(()=>{const footer=document.querySelector('.stage-bottom'),r=footer.getBoundingClientRect(),controls=[...footer.querySelectorAll('button,input,output')].filter(e=>e.getBoundingClientRect().width>0),boxes=controls.map(e=>e.getBoundingClientRect());return {height:r.height,overflow:document.documentElement.scrollWidth-innerWidth,rows:getComputedStyle(footer).gridTemplateRows,targets:boxes.every(b=>b.width>=44&&b.height>=44&&b.left>=r.left&&b.right<=r.right+.1&&b.top>=r.top&&b.bottom<=r.bottom+.1),overlap:boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.1))};})()`);
    assert.equal(result.rows,'44px 44px');assert(result.height<=105);assert(result.overflow<=1);assert(result.targets);assert(!result.overlap);checks+=5;return result;
  }
  for(const [width,height]of [[834,1194],[1194,834],[390,844]])for(const panelOpen of [true,false]){
    await h.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await h.call('loadDocument('+JSON.stringify(fixture)+')');if(transient)await h.call('setPlayback({paused:true})');await h.delay(80);
    if(await h.inside('!document.getElementById("app").classList.contains("panel-hidden")')!==panelOpen)await tap(control('panelToggle'));
    const sw=fixture.components.find(c=>c.type==='switch');assert(sw);const initial=sw.params.closed;
    for(let n=0;n<2;n++){
      await h.inside('window.__heldInspectorChildren=[...document.querySelector("[data-circuit-id=properties]").children]');
      const p=await h.point('[data-hit="body:'+sw.id+'"]',true),id=970000+n;
      await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id,radiusX:2,radiusY:2,force:1}]});await h.delay(80);
      assert(await h.inside('(()=>{const p=document.querySelector("[data-circuit-id=properties]");return p.children.length===__heldInspectorChildren.length&&__heldInspectorChildren.every((e,i)=>e===p.children[i]);})()'),'touch down preserves inspector DOM until native click');checks++;
      assert.equal((await h.call('getDocument()')).components.find(c=>c.id===sw.id).params.closed,n?!initial:initial);checks++;
      await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await h.delay(100);
      const expected=n?initial:!initial;assert.equal((await h.call('getDocument()')).components.find(c=>c.id===sw.id).params.closed,expected);checks++;
      assert.equal(await h.inside('document.querySelector("[data-circuit-id=properties] [data-param=closed]").value'),String(expected));checks++;
    }
    console.log(source+' '+(transient?'AC':'DC')+' touch inspector '+width+'x'+height+' panel '+panelOpen+': passed');
  }
  for(const width of [320,360,384,390,480]){
    await h.send('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:true});await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await h.call('loadDocument('+JSON.stringify(fixture)+')');if(transient)await h.call('setPlayback({paused:true})');await h.delay(80);
    if(await h.inside(`document.querySelector('${control('panelToggle')}').getAttribute('aria-expanded')==='true'`))await tap(control('panelToggle'));
    await h.touch(await h.point('[data-hit="body:'+lamp.id+'"]',true),0,0);assert.equal((await h.call('getInteraction()')).selection.id,lamp.id);checks++;
    const compact=await layout();
    if(width===384)await h.screenshot(source+'-two-row-footer-'+(transient?'ac':'dc'));
    if(width<480){
      const before=await h.call('exportDocument()');await tap(control('moreSelected'));
      assert(await h.inside(`(()=>{const d=document.querySelector('${control('selectionActionsDialog')}'),r=d.getBoundingClientRect();return d.open&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44)&&!!d.querySelector('[data-selection-action=copySelected]');})()`));assert.equal(await h.call('exportDocument()'),before);checks+=2;
      if(width===384)await h.screenshot(source+'-more-actions-'+(transient?'ac':'dc'));
      await h.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await h.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await h.delay(40);
      assert(await h.inside(`!document.querySelector('${control('selectionActionsDialog')}').open&&document.activeElement===document.querySelector('${control('moreSelected')}')`));assert.equal(await h.call('exportDocument()'),before);checks+=2;
      await tap(control('moreSelected'));await tap('[data-selection-action="rotateCounterSelected"]');assert.equal((await h.call('getDocument()')).components.find(c=>c.id===lamp.id).angle,(lamp.angle+315)%360);checks++;
      await tap(control('moreSelected'));await h.call('setReadOnly(true)');assert(await h.inside(`!document.querySelector('${control('selectionActionsDialog')}').open`));checks++;await h.call('setReadOnly(false)');
    }
    await h.call('execute({type:"setParam",id:'+JSON.stringify(lamp.id)+',key:"resistance",value:12.3456789})');await layout();
    if(width===320){await h.screenshot(source+'-wide-footer-'+(transient?'ac':'dc'));await tap(control('moreSelected'));assert(await h.inside(`!!document.querySelector('[data-selection-action="deleteSelected"]')&&!!document.querySelector('[data-selection-action="rotateSelected"]')`));await tap(control('closeSelectionActions'));checks++;}
    console.log(source+' '+(transient?'AC':'DC')+' two-row footer '+width+' px: '+compact.height+' px high');
  }
  return checks;
}
module.exports={quickControlsCases,compactFooterCases};
