"use strict";
const assert=require("node:assert/strict"),M=require("../sim/circuit-workbench/circuit-model"),R=require("../sim/circuit-workbench/component-registry"),P=require("../sim/circuit-workbench/presets");
const {meterMathFixture}=require("./circuit-meters-math-browser-cases");
async function rotationCases(h,mode,base){
  const topology=d=>d.wires.map(w=>[w.id,w.from,w.to,w.length]);
  for(const width of [1280,390]){
    await h.freshPage();h.setContext("window");await h.send("Emulation.setDeviceMetricsOverride",{width,height:width===390?844:800,deviceScaleFactor:1,mobile:width===390});await h.send("Emulation.setTouchEmulationEnabled",{enabled:width===390,maxTouchPoints:2});await h.send("Page.navigate",{url:base+"/circuit-workbench/index.html"});await h.ready();
    const tap=async selector=>width===390?h.touch(await h.point(selector),0,0):h.click(selector);
    async function body(id){const p=await h.inside(`(()=>{const e=document.querySelector('[data-hit="body:${id}"]'),r=e.getBoundingClientRect();for(const [fx,fy]of [[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75],[.1,.1],[.9,.1],[.1,.9],[.9,.9]]){const x=r.left+r.width*fx,y=r.top+r.height*fy;if(document.elementFromPoint(x,y)===e)return{x,y};}return null;})()`);assert(p,"fixture has an exposed component body");if(width===390)await h.touch(p,0,0);else{await h.send("Input.dispatchMouseEvent",{type:"mousePressed",...p,button:"left",buttons:1,clickCount:1});await h.send("Input.dispatchMouseEvent",{type:"mouseReleased",...p,button:"left",buttons:0,clickCount:1});}assert.equal((await h.inside("CircuitWorkbench.getInteraction()")).selection.id,id);}
    async function verify(before,id,angle){
      const after=await h.doc(),ports=new Set(R.ports(before.components.find(c=>c.id===id)).map(p=>p.id));assert.equal(after.components.find(c=>c.id===id).angle,angle);assert.deepEqual(topology(after),topology(before));
      const attached=after.wires.filter(w=>ports.has(w.from)||ports.has(w.to));attached.forEach(w=>{assert.equal(w.shape,"free");assert.deepEqual(w.via,[]);});for(const w of before.wires.filter(w=>!ports.has(w.from)&&!ports.has(w.to)))assert.deepEqual(after.wires.find(v=>v.id===w.id),w);
      const svg=await h.inside(`(()=>{const d=CircuitWorkbench.getDocument(),c=d.components.find(c=>c.id===${JSON.stringify(id)}),ports=new Set(CircuitRegistry.ports(c).map(p=>p.id)),point=(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM());return d.wires.filter(w=>ports.has(w.from)||ports.has(w.to)).map(w=>{const e=document.querySelector('#scene [data-wire="'+w.id+'"]'),s=e.getPointAtLength(0),t=e.getPointAtLength(e.getTotalLength()),a=point(e,s),b=point(e,t),errors=['from','to'].map((key,i)=>{const mark=document.querySelector('#scene [data-port="'+w[key]+'"]');if(!mark)return 0;const p=point(mark,{x:+mark.getAttribute('cx'),y:+mark.getAttribute('cy')});return Math.hypot(p.x-(i?b:a).x,p.y-(i?b:a).y);});return{id:w.id,commands:(e.getAttribute('d').match(/[ML]/g)||[]).length,chord:Math.hypot(t.x-s.x,t.y-s.y),length:e.getTotalLength(),errors};});})()`);
      for(const w of svg){assert.equal(w.commands,2,"displayed wire really is a straight segment");assert(Math.abs(w.length-w.chord)<.002,"SVG length equals endpoint chord");assert(w.errors.every(v=>v<.02),"actual SVG cable meets each white socket");}
      return svg;
    }
    for(const type of ["ammeter","rheostat"]){
      const d=type==="ammeter"?meterMathFixture("ammeter","c",.1):P.create("divider"),id=d.components.find(c=>c.type===type).id;await h.load(d);await body(id);const before=await h.doc(),original=await h.save(),analysis=await h.inside("CircuitWorkbench.getAnalysis()"),steps=[];
      await h.inside("window.__rotateClicks=[];document.addEventListener('click',window.__rotateWatch||(window.__rotateWatch=e=>{const b=e.target.closest('button');if(b?.id==='rotateSelected'||b?.dataset.action==='旋轉 90°')__rotateClicks.push({trusted:e.isTrusted,action:b.id||b.dataset.action});}),true)");
      for(const [i,angle]of [90,180,270,0].entries()){
        if(i%2===0)await tap("#rotateSelected");
        else if(width===1280)await h.key("r","KeyR",82);
        else{if(await h.inside('document.getElementById("panelToggle").getAttribute("aria-expanded")==="false"'))await tap("#panelToggle");await tap('[data-action="旋轉 90°"]');await tap("#panelToggle");}
        const svg=await verify(before,id,angle);assert.deepEqual(await h.inside("CircuitWorkbench.getAnalysis()"),analysis);steps.push({angle,svg});
      }
      const rotated=await h.save();for(let i=0;i<4;i++)await tap("#undo");assert.equal(await h.save(),original,"one undo per rotation also restores its curves");for(let i=0;i<4;i++)await tap("#redo");assert.equal(await h.save(),rotated);
      await h.load(rotated);await body(id);await tap("#rotateSelected");await verify(before,id,90);assert.deepEqual(await h.inside("CircuitWorkbench.getAnalysis()"),analysis);
      const events=await h.inside("__rotateClicks");assert(events.length>=3&&events.every(e=>e.trusted));assert.equal(await h.inside("document.documentElement.scrollWidth-innerWidth"),0);if(width===390)await h.screenshot(`${mode}-${type}-rotation-straight-390.png`);
      h.evidence.push({mode,width,rotationStraight:type,steps,unchangedReadings:true,unrelatedCablesFixed:true,oneStepUndo:true,productionRestoreContinuation:true,trustedEvents:events});
    }
    const short=M.empty(),c=M.add(short,"battery",0,0);short.junctions.push({id:"j1",x:-220,y:0});const w=M.connect(short,c.id+":a","j1:p",[{x:-140,y:20}],"free");w.length=180;await h.load(short);await body(c.id);const saved=await h.save(),history=await h.inside('[document.getElementById("undo").disabled,document.getElementById("redo").disabled]');await tap("#rotateSelected");assert.equal(await h.save(),saved);assert.deepEqual(await h.inside('[document.getElementById("undo").disabled,document.getElementById("redo").disabled]'),history);assert((await h.inside("CircuitWorkbench.getInteraction().lastMessage")).includes("導線太短"));h.evidence.push({mode,width,rotationShortCableAtomic:true});
  }
}
module.exports={rotationCases};
