'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model'),P=require('../sim/circuit-workbench/presets');
async function wireInspectorCases(h,mode,base){
  let width,touchId=76000;
  async function tapAt(p){if(width<600){await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:touchId++,radiusX:2,radiusY:2,force:1}]});await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await h.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1});}await h.delay(60);}
  const tap=async selector=>tapAt(await h.point(selector));
  async function selectWire(id){
    const p=await h.inside(`(()=>{for(const e of document.querySelectorAll('[data-hit^="wire:${id}:"]')){const r=e.getBoundingClientRect();for(const f of [.5,.25,.75]){const x=r.left+r.width*f,y=r.top+r.height/2;if(document.elementFromPoint(x,y)===e)return{x,y};}}throw Error('No exposed wire ${id}');})()`);
    await tapAt(p);assert.equal(await h.inside('CircuitWorkbench.getInteraction().selection.id'),id);
  }
  const reference=()=>h.inside('document.querySelector("#properties .potential-reference").textContent');
  const reading=label=>h.inside(`(()=>{const dt=[...document.querySelectorAll('#properties dt')].find(e=>e.textContent===${JSON.stringify(label)});return dt.nextElementSibling.querySelector('[data-math]').dataset.math;})()`);
  async function geometry(){
    const g=await h.inside(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return{overflow:document.documentElement.scrollWidth-innerWidth,rows:[...document.querySelectorAll('.connection-controls')].map(e=>({row:rect(e),select:rect(e.querySelector('select')),buttons:[...e.querySelectorAll('button')].map(b=>({box:rect(b),title:b.title,aria:b.getAttribute('aria-label'),badge:b.querySelector('small').textContent,badgeBox:rect(b.querySelector('small')),icon:b.querySelector('use').getAttribute('href')}))})),other:[...document.querySelectorAll('#objectActions button')].map(e=>({box:rect(e),textAction:e.classList.contains('text-action')}))};})()`);
    assert(g.overflow<=1);assert.equal(g.rows.length,2);
    for(const [i,row]of g.rows.entries()){
      assert(row.select.width>55);assert.equal(row.buttons.length,2);
      for(const [j,b]of row.buttons.entries()){assert(b.box.width>=44&&b.box.height>=44);assert.equal(b.badge,i?'B':'A');assert.equal(b.aria,(j?'拔開 ':'接好 ')+b.badge);assert.equal(b.title,b.aria);assert(b.icon.endsWith(j?'icon-detach':'icon-attach'));assert(b.badgeBox.left>=b.box.left&&b.badgeBox.right<=b.box.right&&b.badgeBox.top>=b.box.top&&b.badgeBox.bottom<=b.box.bottom);assert(Math.abs(b.box.top-row.select.top)<.1);assert(b.box.right<=row.row.right+.1);}
    }
    assert.equal(g.other.length,1);assert(g.other.every(b=>!b.textAction));return g;
  }
  for(width of [320,390,1280]){
    await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width,height:width<600?844:900,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:2});await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
    await h.inside("window.__wireActionEvents=[];document.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b)__wireActionEvents.push({trusted:e.isTrusted,action:b.dataset.action});},true)");
    const d=P.create('series');await h.load(d);await selectWire('w3');if(await h.inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="false"'))await tap('#panelToggle');
    assert.equal(await reference(),'以「電源 −」為 0 V 參考。');assert.equal(await reading('A 端相對電勢'),'3 V');assert.equal(await reading('A − B 電壓'),'0 V');const layout=await geometry();
    const inspector=await h.inside("document.getElementById('selectionTitle').closest('section').getBoundingClientRect().top-document.getElementById('panel').getBoundingClientRect().top+document.getElementById('panel').scrollTop");await h.inside(`document.getElementById('panel').scrollTop=${inspector}-12`);await h.screenshot(`${mode}-wire-inspector-${width}.png`);
    const original=await h.save();
    for(const [end,letter,target]of [['from','A','c3:b'],['to','B','c4:a']]){
      await tap('[data-action="拔開 '+letter+'"]');assert((await h.doc()).wires.find(w=>w.id==='w3')[end]!==target);assert(await h.inside(`document.querySelector('[data-action="拔開 ${letter}"]').disabled`));
      // Select the fixture option directly; the connection button itself is trusted input.
      await h.inside(`document.querySelector('#properties select[data-end="${end}"]').value='${target}'`);await tap('[data-action="接好 '+letter+'"]');assert.equal((await h.doc()).wires.find(w=>w.id==='w3')[end],target);assert.equal(await reading('A 端相對電勢'),'3 V');
      const connected=await h.save();await tap('#undo');assert((await h.doc()).wires.find(w=>w.id==='w3')[end]!==target);await tap('#redo');assert.equal(await h.save(),connected);await selectWire('w3');
    }
    const saved=await h.save();await h.load(saved);await selectWire('w3');await tap('[data-action="拔開 B"]');assert.notEqual((await h.doc()).wires.find(w=>w.id==='w3').to,'c4:a');await tap('#undo');assert.equal(await h.save(),saved);
    const custom=M.clone(d);custom.display.reference='c3:b';await h.load(custom);await selectWire('w3');assert.equal(await reference(),'以「燈泡 1 b」為 0 V 參考。');assert.equal(await reading('A 端相對電勢'),'0 V');assert.equal(await reading('A − B 電壓'),'0 V');
    const reversed=M.clone(d);reversed.components[0].params.polarity=-1;await h.load(reversed);await selectWire('w3');assert.equal(await reference(),'以「電源 −」為 0 V 參考。');assert.equal(await reading('A 端相對電勢'),'3 V');
    const isolated=M.clone(custom),source=M.add(isolated,'battery',950,180,{voltage:9}),load=M.add(isolated,'resistor',1150,180);source.label='獨立電源';const extra=M.connect(isolated,source.id+':a',load.id+':a',[],'free');M.connect(isolated,load.id+':b',source.id+':b',[],'free');await h.load(isolated);await selectWire(extra.id);assert.equal(await reference(),'以「獨立電源 −」為 0 V 參考。');assert.equal(await reading('A 端相對電勢'),'9 V');
    const events=await h.inside('__wireActionEvents');assert(events.length&&events.every(e=>e.trusted));assert(events.some(e=>e.action==='接好 A')&&events.some(e=>e.action==='接好 B')&&events.some(e=>e.action==='拔開 A')&&events.some(e=>e.action==='拔開 B'));
    h.evidence.push({mode,width,wireInspector:true,layout,referenceVariants:['default','custom','reversed','independent-island'],trustedButtons:true,dropdown:'fixture value assignment',restoredContinuation:true,undoRedo:true,originalBytes:original.length});console.log(`${mode}: ${width}px wire inspector, reference and trusted A/B actions passed`);
  }
}
module.exports={wireInspectorCases};
