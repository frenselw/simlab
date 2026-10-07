"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('./circuit-textbook-cases'),M=require('../sim/circuit-workbench/circuit-model'),R=require('../sim/circuit-workbench/component-registry');
const folder=path.resolve(__dirname,'../output/circuit-textbook-verification');
async function textbookCases(h,mode,base){
  const {inside,send,click,point,scenePoint,load,save,doc,key,delay,screenshot,freshPage,ready,evidence}=h;
  let width=1280,touchId=81000;
  const all=T.cases(),selected=new Set(['mixed','meter-error-external','divider-measure-0.5','lamp-curve-1','lamp-measure-rated','emf-physical-5','orange-a-9000','motor12','lighting20-20']);
  const settle=()=>inside('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  async function tap(selector){const p=await point(selector);if(width<600){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:touchId++,radiusX:2,radiusY:2,force:1}]});await delay(30);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else await click(selector);await settle();}
  async function launch(w){width=w;await freshPage();h.setContext('window');await send('Emulation.setDeviceMetricsOverride',{width:w,height:w<600?844:900,deviceScaleFactor:1,mobile:w<600});await send('Emulation.setTouchEmulationEnabled',{enabled:w<600,maxTouchPoints:2});await send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await ready();await send('Page.bringToFront');await settle();await inside(`window.__textbookEvents=[];for(const type of ['pointerdown','pointermove','pointerup','click','change'])document.addEventListener(type,e=>__textbookEvents.push({type,trusted:e.isTrusted,pointer:e.pointerType||null,target:e.target.id||e.target.dataset.hit||e.target.dataset.param||e.target.dataset.add}),true);`);}
  async function alignment(){return inside(`(()=>{const d=CircuitWorkbench.getDocument(),out=[];for(const w of d.wires){const path=document.querySelector('#scene [data-wire="'+w.id+'"]');for(const end of ['from','to']){let mark=document.querySelector('#scene [data-port="'+w[end]+'"]');const j=d.junctions.find(j=>j.id+':p'===w[end]);if(!mark&&j)mark=[...document.querySelectorAll('#scene>circle')].find(e=>Math.abs(+e.getAttribute('cx')-j.x)<1e-7&&Math.abs(+e.getAttribute('cy')-j.y)<1e-7);if(!mark)throw new Error('Missing visible port '+w[end]);const local=path.getPointAtLength(end==='from'?0:path.getTotalLength()),a=new DOMPoint(local.x,local.y).matrixTransform(path.getScreenCTM()),b=new DOMPoint(+mark.getAttribute('cx'),+mark.getAttribute('cy')).matrixTransform(mark.getScreenCTM());out.push({wire:w.id,end,endpoint:w[end],error:Math.hypot(a.x-b.x,a.y-b.y)});}}return out;})()`);}
  console.log(`${mode}: ${all.length} textbook documents; analytic readings and actual rendered terminals`);
  for(const w of process.argv.includes('--textbook-ui-smoke')?[]:[1280,390]){
    await launch(w);
    for(const one of all){
      await load(one.doc);const before=await inside('CircuitWorkbench.getAnalysis()');
      for(const view of ['real','schematic']){
        if(view==='schematic')await tap('#schematicView');
        const analysis=await inside('CircuitWorkbench.getAnalysis()'),observations=T.observe(one,analysis),ends=await alignment();
        assert(observations.every(x=>x.pass),mode+' '+one.id+' browser oracle '+JSON.stringify(observations.filter(x=>!x.pass)));
        assert.deepEqual(analysis,before,'view cannot change electrical results');assert.deepEqual(analysis.diagnostics,[]);
        assert(ends.every(x=>x.error<.03),'actual cable ends coincide with the actual visible terminals');
        const layout=await inside('({scroll:document.documentElement.scrollWidth-innerWidth,scale:CircuitWorkbench.getInteraction().camera.scale,components:document.querySelectorAll("#scene [data-component]").length,wires:document.querySelectorAll("#scene [data-wire]").length})');
        assert.equal(layout.scroll,0);assert.equal(layout.components,one.doc.components.length);assert.equal(layout.wires,one.doc.wires.length);
        if(selected.has(one.id))await screenshot(`${mode}-textbook-${one.id}-${view}-${w}.png`);
        evidence.push({mode,textbook:'document',id:one.id,width:w,view,observations,diagnostics:analysis.diagnostics,layout,terminals:ends.length,maxTerminalError:Math.max(0,...ends.map(x=>x.error)),inputEvidence:'production loadDocument; view switch uses trusted '+(w<600?'touch':'mouse')});
      }
      const restored=await save();await load(restored);assert.equal(await save(),restored,'browser production JSON round trip');
    }
    // Real dial values, 41 ticks and needle geometry, including the 300 μA socket.
    for(const id of ['water','orange-a-3000','g-voltage','micro-g-simple-0.001','emf-physical-5']){
      const one=all.find(c=>c.id===id),d=M.clone(one.doc);d.display.meters='analog';await load(d);
      const needles=await inside(`(()=>{const a=CircuitWorkbench.getAnalysis();return [...document.querySelectorAll('#scene [data-meter-needle]')].map(e=>{const r=a.components[e.dataset.meterNeedle],q=e.getAttribute('d').match(/L([^ ]+) ([^ ]+)/);return{id:e.dataset.meterNeedle,reading:r.reading,shown:+e.dataset.reading,range:r.range,shownRange:+e.dataset.range,fraction:+e.dataset.fraction,angle:+e.dataset.angle,x:+q[1],y:+q[2],ticks:e.closest('[data-meter-dial]').querySelectorAll('[data-meter-tick]').length};});})()`);
      for(const n of needles){assert.equal(n.shown,n.reading);assert.equal(n.shownRange,n.range);assert.equal(n.ticks,41);assert(Math.abs(n.angle-(-120+90*n.fraction))<1e-8);assert(Math.hypot(n.x-69*Math.cos(n.angle*Math.PI/180),n.y-(24+69*Math.sin(n.angle*Math.PI/180)))<1e-7);}
      await screenshot(`${mode}-textbook-dial-${id}-${w}.png`);evidence.push({mode,textbook:'dial',id,width:w,needles});
    }
  }
  // Explicitly demonstrate construction in the tool UI; imported networks above
  // are not advertised as manually built circuits.
  await launch(1280);await load(M.empty());const ids={};
  async function drag(selector,destination){const start=await point(selector),finish=await scenePoint(destination);assert(finish.x>=0&&finish.x<=width&&finish.y>=0&&finish.y<=900,'drag target remains visible');
    if(width<600){const id=touchId++;await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id,radiusX:2,radiusY:2,force:1}]});for(let n=1;n<=12;n++){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(finish.x-start.x)*n/12,y:start.y+(finish.y-start.y)*n/12,id,radiusX:2,radiusY:2,force:1}]});await delay(15);}await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',buttons:1,clickCount:1});for(let n=1;n<=12;n++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x+(finish.x-start.x)*n/12,y:start.y+(finish.y-start.y)*n/12,button:'left',buttons:1});await delay(10);}await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:finish.x,y:finish.y,button:'left',buttons:0,clickCount:1});}await settle();}
  async function number(selector,value){await inside(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();})()`);await send('Input.insertText',{text:String(value)});await key('Tab','Tab',9);await settle();}
  for(const [name,type,x,y,angle,resistance]of [['E','battery',300,400,90,0],['S','switch',440,200,0,null],['A','ammeter',600,200,180,.1],['Rx','resistor',820,200,0,87.4],['V','voltmeter',620,420,0,1000]]){
    await tap('[data-add="'+type+'"]');const c=(await doc()).components.at(-1);ids[name]=c.id;
    await drag('[data-hit="body:'+c.id+'"]',{x,y});
    // Drag already selects the component; tapping a switch would open it.
    for(let n=0;n<angle/90;n++)await tap('#rotateSelected');
    if(resistance!==null)await number('[data-param="resistance"]',resistance);
  }
  await inside(`(()=>{const e=document.getElementById('cableLength');e.value='1200';e.onchange();})()`);
  async function connect(from,to){await tap('#quickWire');const wire=(await doc()).wires.at(-1);
    for(const [end,ref]of [['from',from],['to',to]]){const p=M.endpoints(await doc()).get(ref);await drag('[data-hit="wireend:'+wire.id+':'+end+'"]',p);assert.equal((await doc()).wires.find(w=>w.id===wire.id)[end],ref,'trusted endpoint snap '+ref);}
    return wire.id;
  }
  for(const [a,b]of [[ids.E+':a',ids.S+':a'],[ids.S+':b',ids.A+':a'],[ids.A+':b',ids.Rx+':a'],[ids.Rx+':b',ids.E+':b'],[ids.V+':a',ids.Rx+':a'],[ids.V+':b',ids.Rx+':b']])await connect(a,b);
  const constructed=await doc(),analysis=await inside('CircuitWorkbench.getAnalysis()'),expected=87.4*1000/(87.4+1000);
  assert(Math.abs(analysis.components[ids.V].reading/analysis.components[ids.A].reading-expected)<1e-7,JSON.stringify({ids,components:constructed.components,analysis:analysis.components}));
  const nativeSaved=await save();await tap('[data-hit="body:'+ids.S+'"]');assert.equal(await inside('CircuitWorkbench.getAnalysis().components.'+ids.A+'.reading'),0);await tap('#undo');assert.equal(await save(),nativeSaved);
  await screenshot(`${mode}-textbook-manually-built-1280.png`);
  const events=await inside('__textbookEvents');assert(events.filter(e=>e.type==='pointerup'&&e.pointer==='mouse'&&e.trusted).length>=17);assert(events.some(e=>e.type==='change'&&e.trusted&&e.target==='resistance'));
  evidence.push({mode,textbook:'manual-construction',width:1280,figure:'11.4-10 甲',componentToolbox:true,componentPlacement:true,parameterInput:true,cables:constructed.wires.length,endpoints:12,reading:expected,observed:analysis.components[ids.V].reading/analysis.components[ids.A].reading,openSwitch:true,undo:true,trustedEvents:events.filter(e=>e.trusted).length,cableLengthSetting:'production select handler'});
  // The actual numeric field rejects 220 V; preserve this capability failure.
  await tap('[data-hit="body:'+ids.E+'"]');await number('[data-param="voltage"]',220);assert.equal((await doc()).components.find(c=>c.id===ids.E).params.voltage,6);assert(await inside('document.getElementById("canvasNotice").classList.contains("error") && !document.getElementById("canvasNotice").hidden'),"invalid voltage shows visible error feedback");
  evidence.push({mode,textbook:'ui-limit',width:1280,requestedVoltage:220,preservedVoltage:6,trusted:true});
  await launch(390);const one=all.find(c=>c.id==='emf-physical-5'),d=M.clone(one.doc),poses=[[180,380,90],[320,180,0],[540,180,0],[540,390,0],[300,390,0]];
  d.components.forEach((c,i)=>{[c.x,c.y,c.angle]=poses[i];});d.wires.forEach(w=>{w.shape='auto';w.via=[];w.length=1200;});
  const removed=d.wires.find(w=>[w.from,w.to].includes(one.components.A+':c')),refs=[removed.from,removed.to];d.wires=d.wires.filter(w=>w!==removed);await load(M.validate(d));
  const newId=await connect(refs[0],refs[1]),phoneResult=await inside('CircuitWorkbench.getAnalysis()');assert(T.observe(one,phoneResult).every(x=>x.pass));assert.equal(phoneResult.components[one.components.A].activePort,'c');assert.equal(phoneResult.components[one.components.A].range,.6);
  await screenshot(`${mode}-textbook-phone-low-socket-390.png`);const phoneSaved=await save();fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,mode+'-phone-restored.json');fs.writeFileSync(file,phoneSaved);
  await load(M.empty());const root=await send('DOM.getDocument',{}),node=await send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#fileInput'});await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[file]});await delay(150);assert.equal(await save(),phoneSaved,'real fileInput -> file.text -> production restore');
  if(await inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="true"'))await tap('#panelToggle');
  await tap('[data-hit="body:'+one.components.S+'"]');assert.equal(await inside('CircuitWorkbench.getAnalysis().components.'+one.components.A+'.reading'),0);await tap('#undo');assert.equal(await save(),phoneSaved);
  const phoneEvents=await inside('__textbookEvents');assert(phoneEvents.some(e=>e.type==='pointermove'&&e.pointer==='touch'&&e.trusted));
  evidence.push({mode,textbook:'phone-rewire',width:390,figure:'12.3-4',preparedParts:true,wire:newId,endpoints:refs,lowRange:.6,reading:phoneResult.components[one.components.A].reading,trusted:true,fileInputRestore:true,continuedSwitch:true,undo:true});
}
async function textbookReport(h,base,root){
  const {inside,send,click,key,delay,screenshot}=h;
  const snapshots=[];
  for(const width of [1280,390]){
    await h.freshPage();h.setContext('window');
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await send('Page.navigate',{url:base+'/output/circuit-textbook-verification/report.html'});
    for(let n=0;n<100;n++){if(await inside('document.readyState==="complete"&&!!document.getElementById("inventory")'))break;await delay(50);}
    await inside('document.fonts.ready');
    const state=await inside(`({rows:document.querySelectorAll('#inventory tbody tr').length,cases:document.querySelectorAll('details.case').length,overflow:document.documentElement.scrollWidth-innerWidth,chart:document.querySelector('img[src="lamp-curve.png"]')?.naturalWidth,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)})`);
    assert.equal(state.rows,T.inventory.length);assert.equal(state.cases,T.cases().length);assert.equal(state.overflow,0);assert(state.chart>1000);assert.equal(state.images,true);
    await screenshot('textbook-report-'+width+'.png');
    await click('#search');await send('Input.insertText',{text:'220'});
    assert(await inside('[...document.querySelectorAll("#inventory tbody tr")].filter(r=>!r.hidden).length')>=4);
    await inside('document.getElementById("search").select()');await key('Backspace','Backspace',8);
    assert.equal(await inside('[...document.querySelectorAll("#inventory tbody tr")].filter(r=>!r.hidden).length'),50);
    await click('#case-meter-error-external summary');await delay(80);assert.equal(await inside('document.getElementById("case-meter-error-external").open'),true,'details opens at '+width+' px');
    await inside('location.hash="case-lamp-shunt-0.1"');await delay(80);assert.equal(await inside('document.getElementById("case-lamp-shunt-0.1").open'),true,'fractional case identifiers open correctly');
    snapshots.push({width,...state,search:true,details:true,fractionalAnchor:true});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await inside('scrollTo(0,0)');await send('Emulation.setEmulatedMedia',{media:'print'});
  const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  const filename=path.join(root,'output/pdf/textbook-circuit-verification.pdf');fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,Buffer.from(pdf.data,'base64'));
  fs.writeFileSync(path.join(folder,'report-preview.json'),JSON.stringify({generatedAt:new Date().toISOString(),snapshots,pdf:filename},null,2));
  console.log('Report preview and PDF: '+filename);
}
module.exports={textbookCases,textbookReport};
