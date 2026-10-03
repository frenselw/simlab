(async() => {
  "use strict";
  await window.CircuitMath.ready();
  const M=window.CircuitModel,R=window.CircuitRegistry,S=window.CircuitSolver,D=window.CircuitDocument,G=window.CircuitRouting,V=window.CircuitRenderer,P=window.CircuitPresets,Q=window.CircuitMath;
  const $=id=>document.getElementById(id),surface=$("surface"),svg=$("circuitSvg"),hitLayer=$("hitLayer");
  const history=M.history(P.create("series")),camera={x:0,y:0,scale:1},listeners=new Set(),targets=new Map();
  const labelOptions={previous:null,exclusions:[]};
  let analysis=S.solve(history.get()),routes={},geometryKey="",selection=null,drag=null,previewDoc=null,panMode=false,wireMode=false,probeMode=false,probeFirst=null,probeResult=null,autoFit=true,lastMessage="",suppressClick=false;
  const touches=new Map(),minScale=.001,maxScale=2.5;
  let cameraGesture=null,touchOrigin=null,touchBlocked=false,spacePan=false,spacePanUsed=false;
  let noticeTimer;
  let paused=matchMedia("(prefers-reduced-motion: reduce)").matches,animationTime=0,lastTime=0;
  const current=()=>previewDoc||history.get(),world=(x,y)=>{const r=surface.getBoundingClientRect();return{x:camera.x+(x-r.left)/camera.scale,y:camera.y+(y-r.top)/camera.scale};};
  const screen=p=>({x:(p.x-camera.x)*camera.scale,y:(p.y-camera.y)*camera.scale}),snapGrid=v=>Math.round(v/20)*20;
  const rich=parts=>(Array.isArray(parts)?parts:[parts]).map(p=>typeof p==='string'?V.esc(p):Q.html(p)).join('');
  function notify(content,error=false){const text=Array.isArray(content)?content.map(p=>typeof p==='string'?p:p.text).join(''):content;lastMessage=text;$("hint").innerHTML=rich(content);$("hint").title=text;$("hint").style.color=error?"#a35d13":"";const n=$("canvasNotice");n.innerHTML=rich(content);n.hidden=false;n.classList.toggle("error",error);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{n.hidden=true;},3500);}
  function selectedWire(){return history.get().wires.find(w=>w.id===selection?.id);}
  function selectedComponent(){return history.get().components.find(c=>c.id===selection?.id);}
  function emitChange(){for(const fn of listeners)try{fn(M.clone(history.get()));}catch(e){console.error("CircuitWorkbench onChange callback failed",e);}}
  function rollbackDrag(){const old=drag;drag=null;previewDoc=null;analysis=S.solve(history.get());$("preview").hidden=true;
    if(old?.kind==="pan"){Object.assign(camera,old.base);autoFit=old.autoFitBefore;}
    if(old)selection=old.selectionBefore;
    // Active touches keep their original capture until lift or an explicit transfer.
    if(old?.target.hasPointerCapture?.(old.pointerId)&&!touches.has(old.pointerId))old.target.releasePointerCapture(old.pointerId);
    if(old)suppressClick=true;
  }
  function releaseTouches(ids){for(const id of ids)if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);}
  function cancel(deferRender=false){const old=cameraGesture;cameraGesture=null;rollbackDrag();labelOptions.previous=null;
    if(old){Object.assign(camera,old.base);autoFit=old.autoFitBefore;selection=old.selectionBefore;releaseTouches(old.ids.filter(id=>!touches.has(id)));}
    if(touches.size){touchBlocked=true;suppressClick=true;}
    if(deferRender===true)requestAnimationFrame(()=>render());else render();
  }
  function touchPair(){const [a,b]=[...touches.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(24,Math.hypot(a.x-b.x,a.y-b.y))};}
  function startCameraGesture(){const live={...camera},liveFit=autoFit;rollbackDrag();Object.assign(camera,live);autoFit=liveFit;
    const pair=touchPair(),origin=touchOrigin||{camera:live,autoFit,selection:selection&&M.clone(selection)};
    selection=origin.selection;cameraGesture={ids:[...touches.keys()],base:origin.camera,autoFitBefore:origin.autoFit,selectionBefore:origin.selection,start:live,pair,anchor:world(pair.x,pair.y)};
    touchBlocked=true;suppressClick=true;$("canvasNotice").hidden=true;for(const id of cameraGesture.ids)surface.setPointerCapture(id);render();
  }
  function moveCameraGesture(){const g=cameraGesture,pair=touchPair(),r=surface.getBoundingClientRect();
    camera.scale=Math.max(minScale,Math.min(maxScale,g.start.scale*pair.distance/g.pair.distance));
    camera.x=g.anchor.x-(pair.x-r.left)/camera.scale;camera.y=g.anchor.y-(pair.y-r.top)/camera.scale;
    if(Math.hypot(pair.x-g.pair.x,pair.y-g.pair.y)>.5||Math.abs(pair.distance-g.pair.distance)>.5)autoFit=false;
    render(false);
  }
  function zoomAt(factor,x,y){const anchor=world(x,y),r=surface.getBoundingClientRect();camera.scale=Math.max(minScale,Math.min(maxScale,camera.scale*factor));
    camera.x=anchor.x-(x-r.left)/camera.scale;camera.y=anchor.y-(y-r.top)/camera.scale;autoFit=false;
  }
  function change(fn,inspector=true){const beforeSelection=selection&&M.clone(selection);
    try{const before=history.get();history.change(fn);previewDoc=null;analysis=S.solve(history.get());
      if(selection&&!M.endpoints(history.get()).has(selection.id)&&![...history.get().components,...history.get().junctions,...history.get().wires].some(x=>x.id===selection.id))selection=null;
      if(autoFit)fit();render(inspector);if(before!==history.get())emitChange();return true;
    }catch(e){selection=beforeSelection;previewDoc=null;analysis=S.solve(history.get());render(inspector);notify(e.message,true);return false;}
  }
  function fit(){const d=current(),points=[...d.components.flatMap(c=>[{x:c.x-90,y:c.y-90},{x:c.x+90,y:c.y+130}]),...d.junctions,...d.wires.flatMap(w=>G.route(d,w))];
    if(!points.length){Object.assign(camera,{x:0,y:0,scale:1});return;}
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    camera.scale=Math.max(.001,Math.min(1.2,(surface.clientWidth-40)/Math.max(120,maxX-minX),(surface.clientHeight-40)/Math.max(120,maxY-minY)));
    camera.x=(minX+maxX)/2-surface.clientWidth/(2*camera.scale);camera.y=(minY+maxY)/2-surface.clientHeight/(2*camera.scale);
  }
  function focusPoint(p){autoFit=false;camera.scale=Math.max(1,camera.scale);camera.x=p.x-surface.clientWidth/(2*camera.scale);camera.y=p.y-surface.clientHeight/(2*camera.scale);render(false);}
  function resolveSnap(d,id,key,p){const w=d.wires.find(w=>w.id===id),other=key==="from"?"to":"from";let found=null,distance=24/camera.scale;
    for(const [endpoint,q]of M.endpoints(d)){if(endpoint===w[key]||(endpoint===w[other]&&!M.attached(d,w,other)))continue;
      if(R.dualMeter(d.components.find(c=>c.id===endpoint.split(':')[0])||{type:''})&&camera.scale<.7)continue;
      const size=Math.hypot(q.x-p.x,q.y-p.y);if(size<distance){found={...q,id:endpoint};distance=size;}}
    return found;
  }
  function probePort(id){selection={kind:"port",id};const value=analysis.potentials[id];if(probeFirst&&probeFirst!==id){probeResult={from:probeFirst,to:id,voltage:analysis.voltage(probeFirst,id)};probeFirst=null;notify(probeResult.voltage===null?"兩點不屬同一個可確定電勢差的電路。":["兩點電壓：",Q.quantity(probeResult.voltage,'V'),"（第一點 − 第二點）"]);}else{probeFirst=id;probeResult=null;notify(['相對電勢 ',Q.quantity(value,'V'),'；再點另一個端子測量。']);}render();}
  function target(key,meta,p,width=44,height=44,touch="none"){let t=targets.get(key);if(!t){t=document.createElement("button");t.type="button";t.className="hit "+meta.kind;t.dataset.hit=key;targets.set(key,t);hitLayer.append(t);}
    t.meta=meta;t.setAttribute("aria-label",meta.label);Object.assign(t.style,{left:p.x+"px",top:p.y+"px",width:Math.max(meta.kind==="wire"?12:44,width)+"px",height:Math.max(meta.kind==="wire"?12:44,height)+"px",touchAction:touch,transform:"translate(-50%,-50%)"});
    t.classList.toggle("snap",!!drag?.snap&&(drag.snap.id===meta.id||drag.snap.id===meta.endpoint));t.tabIndex=meta.kind==="wire"&&meta.segment>0?-1:0;return t;
  }
  function renderHits(d){const needed=new Set(),put=(key,...args)=>{needed.add(key);return target(key,...args);};
    d.components.forEach(c=>{const dual=R.dualMeter(c),w=dual?(d.display.view==='real'?144:70):c.type==='wattmeter'?80:70,h=dual?(d.display.view==='real'?130:70):c.type==="lamp"?106:c.type==="wattmeter"?78:46,angle=c.angle*Math.PI/180,center=dual&&d.display.view==='real'?{x:c.x+22*Math.sin(angle),y:c.y-22*Math.cos(angle)}:c;
      put("body:"+c.id,{kind:"body",id:c.id,label:c.label+"，拖動本體或用方向鍵移動"},screen(center),(c.angle%180?h:w)*camera.scale,(c.angle%180?w:h)*camera.scale,M.permission(d,c,"move")?"none":"pan-y");
      if(c.type==="rheostat"){const angle=c.angle*Math.PI/180,x=-30+c.params.position*60,y=38;put("slider:"+c.id,{kind:"slider",id:c.id,label:c.label+"滑塊，拖動調整電阻"},screen({x:c.x+x*Math.cos(angle)-y*Math.sin(angle),y:c.y+x*Math.sin(angle)+y*Math.cos(angle)}),44,44,M.permission(d,c,"params")?"none":"pan-y");}
      if(dual?camera.scale>=.7:camera.scale>=.55||probeMode||drag?.kind==="wireend")R.ports(c).forEach(p=>put("port:"+p.id,{kind:"port",id:p.id,label:c.label+" "+p.label+"端子，拖導線端點到這裏接好"},screen(p),44,44,"pan-y"));
    });
    d.junctions.filter(j=>M.degree(d,j.id+":p")>1).forEach(j=>put("junction:"+j.id,{kind:"junction",id:j.id,label:"共接點，點選量測或拖動"},screen(j)));
    d.wires.forEach(w=>{const points=G.simplify(routes[w.id],1.2/camera.scale);
      points.slice(1).forEach((p,i)=>{const a=screen(points[i]),b=screen(p),n=put("wire:"+w.id+":"+i,{kind:"wire",id:w.id,segment:i,point:{x:(points[i].x+p.x)/2,y:(points[i].y+p.y)/2},label:"導線 "+w.id+"，拿線身搬動或彎曲"},{x:(a.x+b.x)/2,y:(a.y+b.y)/2},Math.hypot(b.x-a.x,b.y-a.y)+6,18);n.style.transform+=` rotate(${Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}deg)`;n.classList.toggle("selected",selection?.id===w.id);});
      const ends=M.endpoints(d);["from","to"].forEach((end,i)=>{if(!M.attached(d,w,end)||selection?.id===w.id||wireMode){const n=put("wireend:"+w.id+":"+end,{kind:"wireend",id:w.id,end,endpoint:w[end],label:`導線 ${w.id} ${i?"B":"A"}端，${M.attached(d,w,end)?"拉走可拔開":"拖到端子或其他線端接好"}`},screen(ends.get(w[end])));n.classList.toggle("selected",selection?.id===w.id);}});
    });
    for(const [key,t]of targets)if(!needed.has(key)&&t!==drag?.target&&![...touches.values()].some(p=>p.target===t)){t.remove();targets.delete(key);}
  }
  function renderGhost(){const snap=drag?.snap;$("ghostLayer").innerHTML=snap?`<circle cx="${snap.x}" cy="${snap.y}" r="${14/camera.scale}" fill="#a7d4f344" stroke="#2563eb" stroke-width="${2/camera.scale}"/>`:"";
    if(probeFirst){const p=M.endpoints(current()).get(probeFirst);if(p)$("ghostLayer").innerHTML+=`<circle cx="${p.x}" cy="${p.y}" r="${11/camera.scale}" fill="none" stroke="#b56e20" stroke-width="${2/camera.scale}"/>`;}
  }
  function render(inspector=true){const d=current(),surfaceRect=surface.getBoundingClientRect();svg.setAttribute("viewBox",`${camera.x} ${camera.y} ${surfaceRect.width/camera.scale} ${surfaceRect.height/camera.scale}`);
    labelOptions.exclusions=[...document.querySelectorAll('.scroll-strip')].map(e=>{const r=e.getBoundingClientRect();return{left:camera.x+(r.left-surfaceRect.left)/camera.scale,right:camera.x+(r.right-surfaceRect.left)/camera.scale,top:camera.y+(r.top-surfaceRect.top)/camera.scale,bottom:camera.y+(r.bottom-surfaceRect.top)/camera.scale};});
    surface.style.backgroundSize=`${Math.max(16,20*camera.scale)}px ${Math.max(16,20*camera.scale)}px`;surface.style.backgroundPosition=`${-camera.x*camera.scale}px ${-camera.y*camera.scale}px`;
    const key=JSON.stringify([d.components.map(c=>[c.id,c.type,c.x,c.y,c.angle]),d.junctions,d.wires]);if(key!==geometryKey){routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)]));geometryKey=key;}
    $("scene").innerHTML=V.scene(d,analysis,camera.scale,routes,selection?.id,wireMode,{x:camera.x,y:camera.y,width:surfaceRect.width/camera.scale,height:surfaceRect.height/camera.scale},labelOptions);$("flowLayer").innerHTML=V.flow(d,analysis,routes,animationTime,camera.scale);renderHits(d);renderGhost();
    $("emptyHint").hidden=!!(d.components.length||d.wires.length);$("zoomReadout").textContent=(camera.scale<.01?(camera.scale*100).toFixed(1):Math.round(camera.scale*100))+"%";
    $("undo").disabled=!history.canUndo();$("redo").disabled=!history.canRedo();["realView","schematicView"].forEach(id=>$(id).setAttribute("aria-pressed",String(d.display.view===(id==="realView"?"real":"schematic"))));
    ["flow","meters"].forEach(id=>$(id).value=d.display[id]);["potential","names","values","projection"].forEach(id=>$(id).checked=d.display[id]);$("pause").checked=paused;$("mode").value=d.policy.mode;$("policyOptions").hidden=d.policy.mode!=="wiring";["allowRotate","allowParams","allowSwitch"].forEach(id=>$(id).checked=d.policy[id]);
    $("potentialLegend").hidden=!d.display.potential;$("pan").setAttribute("aria-pressed",String(panMode));$("probe").setAttribute("aria-pressed",String(probeMode));$("pickWire").setAttribute("aria-pressed",String(wireMode));surface.classList.toggle('wire-priority',wireMode);surface.classList.toggle("panning",panMode);surface.classList.toggle("quick-pan",spacePan);surface.classList.toggle("camera-gesture",!!cameraGesture);surface.classList.toggle("grabbing",!!(drag||cameraGesture));
    const w=selectedWire(),c=selectedComponent(),actions=!!(w||c||selection?.kind==="junction");$("selectionActions").hidden=!actions;$("hint").parentElement.classList.toggle("has-actions",actions);
    $("focusSelected").hidden=!actions||camera.scale>=.8;$("detachFrom").hidden=!w;$("detachTo").hidden=!w;$("detachFrom").disabled=!!w&&!M.attached(history.get(),w,"from");$("detachTo").disabled=!!w&&!M.attached(history.get(),w,"to");$("rotateSelected").hidden=!c;$("rotateSelected").disabled=!!c&&!M.permission(d,c,"rotate");
    $('inspectMeter').hidden=!c||!R.dualMeter(c);
    $("deleteSelected").textContent=w?"刪除導線":c?"刪除元件":"拆開接點";$("deleteSelected").disabled=!!c&&!M.permission(d,c,"remove");
    $("selectionTip").textContent=w?(drag?.limited?"線已拉盡":!M.attached(d,d.wires.find(x=>x.id===w.id),"from")&&!M.attached(d,d.wires.find(x=>x.id===w.id),"to")?"拿起整條線":"拿端點接線 · 拿線身彎曲"):c?c.label:"共接點";
    $("cableCount").disabled=d.policy.mode!=="free";$("cableLength").disabled=d.policy.mode!=="free";const remaining=d.cables.count-d.wires.length;$("wireStock").textContent=remaining+" / "+d.cables.count;$("quickWire").innerHTML=`＋導線 <span>${remaining}/${d.cables.count}</span>`;["addWire","quickWire"].forEach(id=>$(id).disabled=remaining===0);$("cableCount").value=d.cables.count;const lengthSelect=$("cableLength");[...lengthSelect.options].filter(o=>o.dataset.custom&&Number(o.value)!==d.cables.length).forEach(o=>o.remove());if(![...lengthSelect.options].some(o=>Number(o.value)===d.cables.length)){const o=new Option("自訂 · "+d.cables.length,String(d.cables.length));o.dataset.custom="true";lengthSelect.add(o);}lengthSelect.value=d.cables.length;
    $("circuitStatus").textContent=analysis.diagnostics.length?"需檢查電路":d.policy.mode==="wiring"?"固定元件 · 接線":"直流穩態";$("circuitStatus").classList.toggle("warning",!!analysis.diagnostics.length);document.querySelectorAll("[data-add]").forEach(b=>b.disabled=d.policy.mode!=="free");
    if(inspector)renderProperties();if(drag?.pointerType==="touch"&&drag.kind!=="pan")renderPreview(drag.focus||world(drag.lastX,drag.lastY));
  }
  function renderPreview(p){const host=$("preview"),preview=host.querySelector("svg");host.hidden=false;if(drag&&!drag.previewSide)drag.previewSide=drag.x-surface.getBoundingClientRect().left>surface.clientWidth/2?"left":"right";host.style.left=drag?.previewSide==="left"?"46px":"auto";host.style.right=drag?.previewSide==="left"?"auto":"46px";preview.setAttribute("viewBox",`${p.x-70} ${p.y-55} 140 110`);preview.innerHTML=$("scene").innerHTML+$("ghostLayer").innerHTML;}
  function button(label,fn,disabled=false,danger=false){const b=document.createElement("button");b.type="button";b.textContent=label;b.dataset.action=label;b.disabled=disabled;if(danger)b.className="danger";b.onclick=fn;$("objectActions").append(b);return b;}
  function readings(values){return '<dl class="readings">'+values.map(([name,value,unit])=>`<dt>${V.esc(name)}</dt><dd>${Q.html(Q.quantity(value,unit))}</dd>`).join("")+"</dl>";}
  function field(label,element){const l=document.createElement("label"),caption=document.createElement('span');caption.innerHTML=rich(label);l.append(caption,element);$("properties").append(l);}
  function checkbox(label,checked,fn){const l=document.createElement("label");l.className="check";const i=document.createElement("input");i.type="checkbox";i.checked=checked;i.onchange=()=>fn(i.checked);l.append(i,document.createTextNode(label));$("properties").append(l);}
  function renderProperties(){const d=history.get(),c=selectedComponent(),wire=selectedWire(),prop=$("properties");prop.replaceChildren();$("objectActions").replaceChildren();
    if (c) {
      $("selectionTitle").textContent = c.label;
      const name = document.createElement("input"); name.type = "text"; name.value = c.label; name.maxLength = 40; name.disabled = !M.permission(d, c, "params"); name.onchange = () => change((doc) => { doc.components.find((x) => x.id === c.id).label = name.value; }); field("名稱", name);
      for (const [key, spec] of Object.entries(R.get(c.type).params)) {
        if (key === "polarity") continue;
        const enabled = M.permission(d, c, key === "closed" ? "switch" : "params");
        if (spec.choices) { const input = document.createElement("select"); spec.choices.forEach((choice) => { const o = document.createElement("option"); o.value = String(choice); o.textContent = key === "model" ? choice === "ideal" ? "恆阻燈（理想化）" : "熱效應燈（變阻）" : choice ? "閉合" : "斷開"; input.append(o); }); input.value = String(c.params[key]); input.disabled = !enabled; input.onchange = () => change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = key === "closed" ? input.value === "true" : input.value; }); field(key === "model" ? "燈泡模型" : "開關狀態", input); }
        else {
          const factor = key === "position" ? 100 : 1;
          const input = document.createElement("input"); input.type = "number"; input.value = c.params[key] * factor; input.min = spec.min * factor; input.max = spec.max * factor; input.step = "any"; input.disabled = !enabled; input.dataset.param = key; input.onchange = () => { const value = input.valueAsNumber / factor; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; field([spec.label+' · ',Q.unit(spec.unit)],input);
          if (["voltage", "resistance", "position"].includes(key)) { const range = document.createElement("input"); range.type = "range"; range.min = spec.min * factor; range.max = (key === "position" ? 1 : Math.max(key === "voltage" ? 24 : c.type === "battery" ? 10 : 100, c.params[key])) * factor; range.step = spec.step * factor; range.value = c.params[key] * factor; range.disabled = !enabled; range.setAttribute("aria-label", spec.label + "滑塊"); range.oninput = () => { input.value = range.value; previewDoc = M.clone(history.get()); previewDoc.components.find((x) => x.id === c.id).params[key] = Number(range.value) / factor; analysis = S.solve(previewDoc); render(false); const result = prop.querySelector(".reading-host"); if (result) result.innerHTML = componentReadings(c.id); }; range.onchange = () => { const value = Number(range.value) / factor; previewDoc = null; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; range.onpointercancel = cancel; prop.append(range); }
        }
      }
      const host = document.createElement("div"); host.className = "reading-host"; host.innerHTML = componentReadings(c.id); prop.append(host);
      if (c.type === "lamp" && c.params.model === "thermal") { const n = document.createElement("p"); n.className = "note"; n.textContent = "穩態教學近似：冷態電阻為額定熱態的 1/10；以額定電壓校準散熱。未模擬預熱或燒毀。"; prop.append(n); }
      if (c.type === "wattmeter") { const n = document.createElement("p"); n.className = "note"; n.textContent = "I+/I− 串聯；V+/V− 跨接負載。讀值 = 電壓線圈電壓 × 電流線圈電流。"; prop.append(n); }
      if(R.dualMeter(c)){const r=analysis.components[c.id],n=document.createElement('p');n.className='note';n.innerHTML=rich([...(V.statusText(r)?[V.statusText(r)]:['目前量程 ',Q.quantity(r.range,r.unit)]),'。接共用 − 與其中一個正極孔；先用大量程，再換小量程。每小格 ',Q.quantity(r.division,r.unit),'；負刻度至 ',Q.quantity(r.minimum,r.unit),'。',camera.scale<.7?'先按「放大所選」分清三個孔。':'']);prop.append(n);button('放大錶盤',()=>inspectMeter(c));}
      button("旋轉 90°", () => rotate(c.id), !M.permission(d, c, "rotate"));
      button("刪除元件", () => { cancel(); change((doc) => M.remove(doc, c.id)); }, !M.permission(d, c, "remove"), true);
      button("複製元件", () => change((doc) => { const copy = M.add(doc, c.type, c.x + 140, c.y + 80, c.params); copy.angle = c.angle; copy.label = c.label + " 副本"; selection = { kind: "body", id: copy.id }; }), d.policy.mode !== "free");
      button("定位所選", () => focusPoint(c));
      d.wires.filter(w=>[w.from,w.to].some(id=>id.split(':')[0]===c.id)).forEach(w=>button('選導線 '+w.id,()=>{selection={kind:'wire',id:w.id};render();}));
      if (c.type === "battery") button("反接電源極性", () => change((doc) => { doc.components.find((x) => x.id === c.id).params.polarity *= -1; }), !M.permission(d, c, "params"));
      if (d.policy.mode === "free") checkbox("固定此元件", c.locked, (v) => change((doc) => { doc.components.find((x) => x.id === c.id).locked = v; }));
      else checkbox("此元件可調參數", c.editable, (v) => change((doc) => { doc.components.find((x) => x.id === c.id).editable = v; }));

    }else if(wire){
      $("selectionTitle").textContent="導線 "+wire.id;prop.innerHTML=`<p class="note">A：${V.esc(portName(wire.from))}<br>B：${V.esc(portName(wire.to))}<br>目前長度 ${Math.round(G.length(routes[wire.id]))} / 上限 ${Math.round(wire.length)} 畫布單位</p>`+readings([["A → B 電流",analysis.wires[wire.id]?.current,"A"],["相對電勢",analysis.wires[wire.id]?.potential,"V"]]);
      if(analysis.wires[wire.id]?.cyclic)prop.insertAdjacentHTML("beforeend",'<p class="note">理想導線環路中，此段電流不能唯一確定。</p>');
      ["from","to"].forEach((key,i)=>{const input=document.createElement("select");input.dataset.end=key;const none=document.createElement("option");none.value="";none.textContent="選接線對象";input.append(none);
        for(const [id]of M.endpoints(d)){if(id===wire[key]||(id===wire[key==="from"?"to":"from"]&&!M.attached(d,wire,key==="from"?"to":"from")))continue;const o=document.createElement("option");o.value=id;o.textContent=portName(id);input.append(o);}field((i?"B":"A")+"端接到",input);
        button("接好 "+(i?"B":"A"),()=>{if(!input.value)return notify("先選擇接線對象。",true);change(doc=>{if(!M.attach(doc,wire.id,key,input.value))throw new Error("導線太短；移近元件或用另一條線接長");});});
        button("拔開 "+(i?"B":"A"),()=>unplug(wire.id,key),!M.attached(d,wire,key));
      });
      button("刪除導線",()=>{cancel();change(doc=>M.remove(doc,wire.id));},false,true);button("定位所選",()=>focusPoint(G.along(routes[wire.id],G.length(routes[wire.id])/2)));
      button("整理線形",()=>tidy(wire.id));
    }else if(selection?.kind==="port"||selection?.kind==="junction"){
      const endpoint=selection.kind==="junction"?selection.id+":p":selection.id;$("selectionTitle").textContent=portName(endpoint);prop.innerHTML=readings([["相對電勢",analysis.potentials[endpoint],"V"]]);if(probeResult)prop.innerHTML+=readings([["第一點 − 第二點",probeResult.voltage,"V"]]);button("設為 0 V",()=>change(doc=>doc.display.reference=endpoint));
      d.wires.filter(w=>w.from===endpoint||w.to===endpoint).forEach(w=>button("選導線 "+w.id,()=>{selection={kind:"wire",id:w.id};render();}));
      if(selection.kind==="junction")button("拆開共接點",()=>{const id=selection.id;cancel();change(doc=>M.remove(doc,id));},false,true);
    }else{$("selectionTitle").textContent="電路概覽";prop.innerHTML=`<p class="note">${d.components.length} 個元件 · ${d.wires.length} 條導線<br>取線 → 拿端點接好 → 拿線身彎曲。</p>`;if(probeResult)prop.innerHTML+=readings([["第一點 − 第二點",probeResult.voltage,"V"]]);}
    for(const diagnostic of analysis.diagnostics){const p=document.createElement("p");p.className="diagnostic";p.textContent=diagnostic.message;prop.append(p);}
    const list=$("wireList");list.replaceChildren();d.wires.forEach(w=>{const row=document.createElement("div");row.className="wire-row";const b=document.createElement("button");b.textContent=w.id+" · "+portName(w.from)+" → "+portName(w.to);b.onclick=()=>{selection={kind:"wire",id:w.id};render();focusPoint(G.along(routes[w.id],G.length(routes[w.id])/2));};const del=document.createElement("button");del.className="delete";del.textContent="×";del.setAttribute("aria-label","刪除導線 "+w.id);del.onclick=()=>{cancel();change(doc=>M.remove(doc,w.id));};row.append(b,del);list.append(row);});
  }
  function componentReadings(id) { const c = history.get().components.find((c) => c.id === id), r = analysis.components[id]; if (!c || !r) return ""; const items = [["兩端電壓", r.voltage, "V"], [c.type === "battery" ? "向外供出電流" : R.dualMeter(c)?'所接正極 → − 電流':"a → b 電流", c.type === "battery" && r.current !== null ? -c.params.polarity * r.current : r.current, "A"], [c.type === "battery" ? "端口輸出功率" : "吸收功率", c.type === "battery" ? r.delivered : r.power, "W"]]; if (c.type === "battery") items.push(["內阻發熱", r.internalPower, "W"], ["電源總供能", r.sourcePower, "W"]); if (c.type === "lamp") items.push(["工作電阻", r.resistance, "Ω"]); if (r.unit) items.push(["儀表讀值", r.reading, r.unit]);if(R.dualMeter(c))items.push(['目前量程',r.range,r.unit],['每小格',r.division,r.unit]);return readings(items); }
  function inspectMeter(c=selectedComponent()){if(!c||!R.dualMeter(c))return;const r=analysis.components[c.id];$('meterDetail').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -88 160 135" aria-label="${V.esc(c.label)}雙量程刻度">${V.dualDial(c,r,history.get().display.values)}</svg><p>${rich([c.label+' · ',...(r.activePort?['接 ',Q.quantity(r.range,r.unit),' 孔']:['未選單一量程'])])}<br>${rich([V.statusText(r)?V.statusText(r)+'；':'','每小格 ',Q.quantity(r.division,r.unit),'，負刻度至 ',Q.quantity(r.minimum,r.unit)])}</p>`;$('meterDialog').showModal();}

  function portName(id){const d=history.get(),[cid,key]=id.split(":"),c=d.components.find(c=>c.id===cid);if(c)return c.label+" "+R.ports(c).find(p=>p.key===key)?.label;return M.degree(d,id)>1?"共接點 "+cid:"懸空線端 "+cid;}
  function rotate(id){const c=history.get().components.find(c=>c.id===id);if(!c||!M.permission(history.get(),c,"rotate"))return;cancel();change(doc=>{const before=M.clone(doc);doc.components.find(c=>c.id===id).angle=(c.angle+90)%360;if(!M.reconcile(doc,before))throw new Error("導線太短，請先拔開或移近元件再旋轉");});}
  function unplug(id,key){cancel();change(doc=>{M.detach(doc,id,key);selection={kind:"wireend",id,end:key};});notify("已拔開這一端，導線留在畫布，可重新接線。");}
  function tidy(id){cancel();change(doc=>{doc.wires.filter(w=>!id||w.id===id).forEach(w=>{const points=G.route(doc,w),clean=G.smooth(G.simplify(points,12));const fitted=G.fitLength(G.resample(clean,10),w.length);w.shape="free";w.via=fitted.slice(1,-1).map(p=>({x:p.x,y:p.y}));});});}
  function takeWire(){cancel();panMode=false;probeMode=false;const ok=change(doc=>{const x=camera.x+surface.clientWidth/(2*camera.scale),y=camera.y+surface.clientHeight/(2*camera.scale);let dy=0;while(doc.wires.some(w=>{const points=G.route(doc,w),mid=G.along(points,G.length(points)/2);return Math.hypot(mid.x-x,mid.y-y-dy)<45;}))dy+=45;const w=M.addWire(doc,x,y+dy);selection={kind:"wire",id:w.id};});if(ok)notify("導線已取出。两端未接時拿起整條；把拿著的端點放到接線處。".replace("两","兩"));}
  $("addWire").onclick=$("quickWire").onclick=takeWire;
  $("cableCount").onchange=()=>change(doc=>{doc.cables.count=$("cableCount").valueAsNumber;});$("cableLength").onchange=()=>change(doc=>{doc.cables.length=Number($("cableLength").value);});
  function moveObject(base,kind,id,dx,dy){const candidate=f=>{const d=M.clone(base),item=(kind==="body"?d.components:d.junctions).find(x=>x.id===id);item.x+=dx*f;item.y+=dy*f;if(!M.reconcile(d,base))return null;try{M.validate(d);return d;}catch{return null;}};let d=candidate(1);if(d)return {doc:d,limited:false};let low=0,high=1;for(let n=0;n<28;n++){const mid=(low+high)/2;if(candidate(mid))low=mid;else high=mid;}return {doc:candidate(low),limited:true};}
  document.addEventListener("pointerdown",e=>{
    if(e.pointerType==="touch"){
      if(drag&&drag.pointerType!=="touch")cancel();
      // A fresh primary touch means any previous physical touch sequence has ended.
      if(e.isPrimary&&touches.size){cancel();touches.clear();touchOrigin=null;touchBlocked=false;render(false);}
      const central=surface.contains(e.target);
      if(!touches.size){touchBlocked=false;touchOrigin=central?{camera:{...camera},autoFit,selection:selection&&M.clone(selection)}:null;}
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY,downX:e.clientX,downY:e.clientY,moved:false,central,target:e.target.closest(".hit")});
      if(touches.size===2&&!touchBlocked&&[...touches.values()].every(p=>p.central)){startCameraGesture();return;}
      if(touches.size>1){if(drag||cameraGesture||[...touches.values()].some(p=>p.central)){cancel();notify(touches.size>2?"已取消雙指操作；放開手指後可再操作。":[...touches.values()].every(p=>p.central)?"請先放開手指，再開始雙指操作。":"畫布外的第二指已取消本次拖動。");}else touchBlocked=true;}
    }else if((drag&&e.pointerId!==drag.pointerId)||cameraGesture)cancel();
  },true);
  document.addEventListener("pointermove",e=>{
    const p=touches.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;p.moved||=Math.hypot(p.x-p.downX,p.y-p.downY)>6;
    // Reacquire only on a live move, never inside lostcapture while a lift is dispatching.
    if(touchBlocked&&!cameraGesture&&p.central&&e.buttons&&!surface.hasPointerCapture(e.pointerId))surface.setPointerCapture(e.pointerId);
    if(cameraGesture&&cameraGesture.ids.includes(e.pointerId))moveCameraGesture();
  },true);
  document.addEventListener("pointerup",e=>{
    if(touches.get(e.pointerId)?.central&&touches.get(e.pointerId).moved)suppressClick=true;
    if(cameraGesture?.ids.includes(e.pointerId)){cameraGesture=null;suppressClick=true;render(false);}
    releaseTouches([e.pointerId]);
    touches.delete(e.pointerId);if(!touches.size){const blocked=touchBlocked;touchBlocked=false;touchOrigin=null;if(blocked)render(false);}
  },true);
  document.addEventListener("pointercancel",e=>{
    touches.delete(e.pointerId);if(cameraGesture?.ids.includes(e.pointerId)||drag?.pointerId===e.pointerId)cancel();
    if(!touches.size){const blocked=touchBlocked;touchBlocked=false;touchOrigin=null;if(blocked)render(false);}
  },true);
  surface.addEventListener("pointerdown",e=>{
    if(touchBlocked||cameraGesture||(e.pointerType==="touch"&&!e.isPrimary))return;
    const quick=e.pointerType==="mouse"&&(e.button===1||(e.button===0&&spacePan));if(e.button!==0&&!quick)return;suppressClick=false;
    if(panMode||quick){if(quick){e.preventDefault();spacePanUsed||=spacePan;}drag={kind:"pan",quick,pointerId:e.pointerId,target:surface,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,base:{...camera},pointerType:e.pointerType,selectionBefore:selection&&M.clone(selection),autoFitBefore:autoFit,moved:false};$("canvasNotice").hidden=true;surface.setPointerCapture(e.pointerId);render(false);return;}
    const t=e.target.closest(".hit"),meta=t?.meta,d=history.get();if(!meta||meta.kind==="port")return;if(probeMode&&meta.kind==="wireend")return;
    if(meta.kind==="body"||meta.kind==="slider"){const c=d.components.find(c=>c.id===meta.id);if(!M.permission(d,c,meta.kind==="slider"?"params":"move"))return;}
    const before=selection&&M.clone(selection);selection={...meta};drag={...meta,pointerId:e.pointerId,pointerType:e.pointerType,target:t,down:world(e.clientX,e.clientY),x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,baseDoc:M.clone(d),selectionBefore:before,moved:false,snap:null,limited:false};
    if(meta.kind==="wireend")drag.start=M.endpoints(d).get(d.wires.find(w=>w.id===meta.id)[meta.end]);t.setPointerCapture(e.pointerId);render();
  });
  surface.addEventListener("pointermove",e=>{
    if(touchBlocked||!drag||e.pointerId!==drag.pointerId)return;drag.lastX=e.clientX;drag.lastY=e.clientY;const p=world(e.clientX,e.clientY);drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;
    if(drag.kind==="pan"){autoFit=false;camera.x=drag.base.x-(e.clientX-drag.x)/camera.scale;camera.y=drag.base.y-(e.clientY-drag.y)/camera.scale;render(false);return;}if(!drag.moved)return;
    const dx=p.x-drag.down.x,dy=p.y-drag.down.y;previewDoc=M.clone(drag.baseDoc);drag.snap=null;drag.limited=false;
    if(drag.kind==="wireend"){
      const desired={x:drag.start.x+dx,y:drag.start.y+dy},result=M.moveWireEnd(previewDoc,drag.id,drag.end,desired);drag.limited=result.limited;
      const candidate=resolveSnap(previewDoc,drag.id,drag.end,desired);if(candidate){const snapped=M.clone(previewDoc);if(M.attach(snapped,drag.id,drag.end,candidate.id)){previewDoc=snapped;drag.snap=candidate;}}
      drag.focus=M.endpoints(previewDoc).get(previewDoc.wires.find(w=>w.id===drag.id)[drag.end]);
    }else if(drag.kind==="body"||drag.kind==="junction"){
      const old=(drag.kind==="body"?drag.baseDoc.components:drag.baseDoc.junctions).find(x=>x.id===drag.id),result=moveObject(drag.baseDoc,drag.kind,drag.id,snapGrid(old.x+dx)-old.x,snapGrid(old.y+dy)-old.y);previewDoc=result.doc;drag.limited=result.limited;drag.focus=(drag.kind==="body"?previewDoc.components:previewDoc.junctions).find(x=>x.id===drag.id);
    }else if(drag.kind==="slider"){const c=previewDoc.components.find(c=>c.id===drag.id),angle=c.angle*Math.PI/180,local=(p.x-c.x)*Math.cos(angle)+(p.y-c.y)*Math.sin(angle);c.params.position=Math.max(0,Math.min(1,Math.round((local+30)/60*100)/100));drag.focus=p;
    }else if(drag.kind==="wire"){drag.limited=!!M.bendWire(previewDoc,drag.id,drag.down,dx,dy,Math.max(100,110/camera.scale))?.limited;drag.focus=p;}
    analysis=S.solve(previewDoc);if(drag.limited){$("canvasNotice").textContent="線已拉盡；移近元件，或用另一條線接長。";$("canvasNotice").hidden=false;}render(false);
  });
  surface.addEventListener("pointerup",e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;const done=drag,preview=previewDoc;drag=null;previewDoc=null;$("preview").hidden=true;suppressClick=done.moved||done.quick;
    if(done.target.hasPointerCapture(e.pointerId))done.target.releasePointerCapture(e.pointerId);
    if(preview&&done.moved){change(doc=>Object.assign(doc,preview));notify(done.limited?"導線已拉盡；移近元件或用另一條導線接長。":done.snap?"端點已接好；拖另一端繼續接線。":done.kind==="wireend"?"未接上的端點已留在畫布，可再拿起接線。":done.kind==="wire"?"導線位置／線形已更新。":"位置已更新，接線保持連接。");}
    render();
  });
  surface.addEventListener("lostpointercapture",e=>{if(drag?.pointerId===e.pointerId||(cameraGesture?.ids.includes(e.pointerId)&&!surface.hasPointerCapture(e.pointerId)))cancel(true);});
  window.addEventListener("blur",()=>{spacePan=false;spacePanUsed=false;cancel();touches.clear();touchOrigin=null;touchBlocked=false;render(false);});
  surface.addEventListener("wheel",e=>{e.preventDefault();if(drag||touches.size)return;
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?surface.clientHeight:1);if(!delta)return;
    zoomAt(Math.exp(-Math.max(-600,Math.min(600,delta))*.0015),e.clientX,e.clientY);render(false);
  },{passive:false});
  surface.addEventListener("auxclick",e=>{if(e.button===1)e.preventDefault();});
  surface.addEventListener("click",e=>{
    if(suppressClick&&e.detail)return;if(panMode)return;const meta=e.target.closest(".hit")?.meta;
    if(meta){if(probeMode&&["port","junction","wireend"].includes(meta.kind)){probePort(meta.kind==="junction"?meta.id+":p":meta.kind==="wireend"?history.get().wires.find(w=>w.id===meta.id)[meta.end]:meta.id);return;}
      selection={...meta};if(meta.kind==="body"&&selectedComponent()?.type==="switch"&&M.permission(history.get(),selectedComponent(),"switch"))change(doc=>{const c=doc.components.find(c=>c.id===meta.id);c.params.closed=!c.params.closed;});else render();
    }else{selection=null;render();}
  });
  function undo(redo=false){cancel();const changed=redo?history.redo():history.undo();selection=null;analysis=S.solve(history.get());render();if(changed)emitChange();notify(redo?"已重做。":"已復原。");}
  window.addEventListener("keydown",e=>{
    const typing=/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.target.isContentEditable;if(e.key==="Escape"){cancel();probeFirst=null;notify("已取消目前拖動。");return;}if(typing)return;
    if((e.code==="Space"||e.key===" ")&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!document.querySelector("dialog[open]")&&(!e.target.closest("button,a")||surface.contains(e.target))){
      if(!spacePan){spacePan=true;spacePanUsed=false;surface.classList.add("quick-pan");}
      // A focused scene button still accepts Space on release unless a drag used it.
      if(!e.target.closest("button"))e.preventDefault();return;
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo(e.shiftKey);return;}
    const focused=e.target.meta;if(focused)selection={...focused};if(e.key.toLowerCase()==="r"&&selection?.kind==="body"){e.preventDefault();rotate(selection.id);}
    if(["Delete","Backspace"].includes(e.key)&&selection&&selection.kind!=="port"){e.preventDefault();const id=selection.id;cancel();change(doc=>M.remove(doc,id));}
    const offset={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!offset||!selection)return;e.preventDefault();const [dx,dy]=offset;
    if(selection.kind==="wireend"){const id=selection.id,key=selection.end;change(doc=>{const w=doc.wires.find(w=>w.id===id),p=M.endpoints(doc).get(w[key]);M.moveWireEnd(doc,id,key,{x:p.x+dx,y:p.y+dy});});}
    else if(selection.kind==="wire"){change(doc=>M.bendWire(doc,selection.id,selection.point||G.along(routes[selection.id],G.length(routes[selection.id])/2),dx,dy));}
    else if(selection.kind==="body"||selection.kind==="junction"){change(doc=>{if(selection.kind==="body"&&!M.permission(doc,doc.components.find(c=>c.id===selection.id),"move"))throw new Error("此元件已固定");Object.assign(doc,moveObject(doc,selection.kind,selection.id,dx,dy).doc);});}
    else if(selection.kind==="slider"){change(doc=>{const c=doc.components.find(c=>c.id===selection.id);if(!M.permission(doc,c,"params"))throw new Error("參數已固定");c.params.position=Math.max(0,Math.min(1,c.params.position+(dx+dy)/400));});}
  });
  window.addEventListener("keyup",e=>{if(e.code!=="Space"&&e.key!==" ")return;if(spacePanUsed)e.preventDefault();spacePan=false;spacePanUsed=false;surface.classList.remove("quick-pan");});
  $("focusSelected").onclick=()=>{const w=selectedWire(),c=selectedComponent(),j=history.get().junctions.find(j=>j.id===selection?.id);if(w)focusPoint(G.along(routes[w.id],G.length(routes[w.id])/2));else if(c||j)focusPoint(c||j);};
  $('inspectMeter').onclick=()=>inspectMeter();$('closeMeter').onclick=()=>$('meterDialog').close();
  $("detachFrom").onclick=()=>{const w=selectedWire();if(w)unplug(w.id,"from");};$("detachTo").onclick=()=>{const w=selectedWire();if(w)unplug(w.id,"to");};
  $("deleteSelected").onclick=()=>{const id=selection?.id;if(!id||selection.kind==="port")return;cancel();change(doc=>M.remove(doc,id));notify("已刪除；刪線歸還庫存，復原可還原。");};$("rotateSelected").onclick=()=>{if(selectedComponent())rotate(selection.id);};$("undo").onclick=()=>undo();$("redo").onclick=()=>undo(true);
  function loadDocument(doc){const valid=typeof doc==="string"?D.decode(doc):M.validate(doc);cancel();const before=history.get();history.replace(valid);analysis=S.solve(history.get());selection=null;wireMode=false;probeFirst=null;probeResult=null;autoFit=true;fit();render();if(before!==history.get())emitChange();}
  $("preset").onchange=()=>{loadDocument(P.create($("preset").value));notify("已載入範例，可取線、改接及量測。");};$("realView").onclick=()=>change(doc=>doc.display.view="real");$("schematicView").onclick=()=>change(doc=>doc.display.view="schematic");
  ["flow","meters","potential","names","values","projection"].forEach(id=>$(id).onchange=()=>change(doc=>doc.display[id]=$(id).type==="checkbox"?$(id).checked:$(id).value));$("pause").onchange=()=>paused=$("pause").checked;
  $("mode").onchange=()=>{cancel();change(doc=>doc.policy.mode=$("mode").value);};["allowRotate","allowParams","allowSwitch"].forEach(id=>$(id).onchange=()=>{cancel();change(doc=>doc.policy[id]=$(id).checked);});
  $("probe").onclick=()=>{cancel();probeMode=!probeMode;probeFirst=null;probeResult=null;panMode=false;wireMode=false;render();notify(probeMode?"點一個端子看電勢，再點另一個量兩點電壓。":"取線後拖端點接線；拿線身搬動或彎曲。");};
  $("pan").onclick=()=>{cancel();panMode=!panMode;probeMode=false;wireMode=false;render();notify(panMode?"手掌工具：用一指拖動整張畫布。再按一次返回拿取元件。":"已返回拿取模式，可拿導線端點或線身。");};
  $('pickWire').onclick=()=>{cancel();wireMode=!wireMode;panMode=false;probeMode=false;render();notify(wireMode?'拿導線：重疊時優先拿線身或線端。再按一次返回拿元件。':'已返回拿取元件與導線。');};
  document.querySelectorAll("[data-camera]").forEach(b=>b.onclick=()=>{cancel();const action=b.dataset.camera,r=surface.getBoundingClientRect();if(action==="fit"){autoFit=true;fit();}else{autoFit=false;if(["in","out"].includes(action))zoomAt(action==="in"?1.2:1/1.2,r.left+r.width/2,r.top+r.height/2);else{const delta=100/camera.scale;if(action==="left")camera.x-=delta;if(action==="right")camera.x+=delta;if(action==="up")camera.y-=delta;if(action==="down")camera.y+=delta;}}render(false);});
  $("panelToggle").onclick=()=>{cancel();const hidden=$("app").classList.toggle("panel-hidden");$("panelToggle").setAttribute("aria-expanded",String(!hidden));$("panelToggle").setAttribute("aria-label",hidden?"展開操作面板":"收起操作面板");requestAnimationFrame(()=>{if(autoFit)fit();render(false);});};
  $("clearAll").onclick=()=>{cancel();selection=null;change(doc=>{if(doc.policy.mode!=="free")throw new Error("固定模式可用「只移除導線」重新接線。");const cables=doc.cables;Object.assign(doc,M.empty());doc.cables=cables;});};
  $("clearWires").onclick=()=>{cancel();change(doc=>{doc.wires=[];doc.junctions=[];if(doc.display.reference&&!M.endpoints(doc).has(doc.display.reference))doc.display.reference=null;});};$("autoRoute").onclick=()=>tidy();
  function download(text, name, type) { const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  $("save").onclick = () => { try { download(D.encode(history.get()), "電路工作台.json", "application/json"); notify("已匯出電路檔，可用「開啟」繼續編輯。"); } catch (e) { notify(e.message, true); } };
  $("saveTemplate").onclick = () => { try { download(D.encode(D.template(history.get())), "固定元件接線模板.json", "application/json"); } catch (e) { notify(e.message, true); } };
  $("open").onclick = () => $("fileInput").click();
  $("fileInput").onchange = async () => { const file = $("fileInput").files[0]; $("fileInput").value = ""; if (!file) return; try { if (file.size > M.limits.bytes) throw new Error("電路檔超出 256 KiB 限制"); loadDocument(await file.text()); notify("已開啟電路檔；按復原可返回原電路。"); } catch (e) { notify(e.message, true); } };
  $("exportSvg").onclick = () => { const d = history.get(), labelBounds=V.labels(d,analysis,1,routes).flatMap(p=>[{x:p.box.left,y:p.box.top},{x:p.box.right,y:p.box.bottom}]), points = [...labelBounds, ...M.endpoints(d).values(), ...d.components.flatMap((c) => [{ x: c.x - 90, y: c.y - 100 }, { x: c.x + 90, y: c.y + 140 }]), ...Object.values(routes).flat()]; if (!points.length) return notify("先加入元件再匯出電路圖。"); const x = Math.min(...points.map((p) => p.x)) - 20, y = Math.min(...points.map((p) => p.y)) - 20, w = Math.max(...points.map((p) => p.x)) - x + 20, h = Math.max(...points.map((p) => p.y)) - y + 20; const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${V.scene(d, analysis, 1, routes)}${V.flow(d, analysis, routes, animationTime, 1)}</svg>`; download(content, "電路圖.svg", "image/svg+xml"); };

  $("help").onclick=$("panelHelp").onclick=()=>$("helpDialog").showModal();$("closeHelp").onclick=()=>$("helpDialog").close();
  for (const [type, thermal] of [["battery"], ["resistor"], ["rheostat"], ["switch"], ["lamp", false], ["lamp", true], ["ammeter"], ["voltmeter"], ["wattmeter"]]) {
    const b = document.createElement("button"); b.type = "button"; b.dataset.add = type + (thermal ? ":thermal" : "");
    const sample={type,params:R.defaults(type)}; if (thermal) sample.params.model="thermal";
    b.innerHTML = `<span class="icon"><svg viewBox="${R.dualMeter(sample)?'-84 -90 168 180':'-64 -68 128 124'}" aria-hidden="true">${V.body(sample,null,{view:"real",meters:"digital",values:false})}</svg></span><span>${type === "lamp" ? thermal ? "變阻燈" : "恆阻燈" : R.get(type).name}</span>`;
    b.onclick = () => { cancel(); const succeeded = change((d) => { const x = snapGrid(camera.x + surface.clientWidth / (2 * camera.scale)), y = snapGrid(camera.y + surface.clientHeight / (2 * camera.scale)); let offset = 0; while (d.components.some((c) => Math.hypot(c.x - x - offset, c.y - y - offset) < 100)) offset += 40; const c = M.add(d, type, x + offset, y + offset, type === "lamp" ? { model: thermal ? "thermal" : "ideal" } : {}); selection = { kind: "body", id: c.id }; }); if(succeeded) notify("元件已加入。再取出導線接線，或拖動本體調整位置。"); }; $("palette").append(b);
  }

  if(matchMedia("(max-width:759px) and (min-height:451px)").matches){$("app").classList.add("panel-hidden");$("panelToggle").setAttribute("aria-expanded","false");$("panelToggle").setAttribute("aria-label","展開操作面板");}
  new ResizeObserver(()=>{const interrupted=!!(drag||previewDoc||cameraGesture);if(interrupted)cancel();if(autoFit&&!interrupted)fit();render(false);}).observe(surface);
  window.CircuitWorkbench=Object.freeze({getDocument:()=>M.clone(history.get()),getAnalysis:()=>{const{voltage,...data}=analysis;return M.clone(data);},voltage:(a,b)=>analysis.voltage(a,b),exportDocument:()=>D.encode(history.get()),loadDocument,
    applyPolicy(policy){cancel();change(doc=>doc.policy={...doc.policy,...policy});},onChange(fn){if(typeof fn!=="function")throw new TypeError("onChange requires a callback");listeners.add(fn);return()=>listeners.delete(fn);},
    getInteraction:()=>({pending:null,dragging:cameraGesture?"camera":drag?.kind||null,selection:selection?M.clone(selection):null,camera:{...camera},panMode,wireMode,probeMode,spacePan,touchCount:touches.size,touchBlocked,snap:drag?.snap?.id||null,limited:!!drag?.limited,lastMessage}),cancel});
  render();function animate(time){if(!paused&&lastTime)animationTime+=Math.min(.05,(time-lastTime)/1000);lastTime=time;if(!document.hidden&&!drag&&!cameraGesture)$("flowLayer").innerHTML=V.flow(current(),analysis,routes,animationTime,camera.scale);requestAnimationFrame(animate);}requestAnimationFrame(animate);
})().catch(error=>{console.error('Circuit workbench startup failed',error);const hint=document.getElementById('hint');hint.textContent='數學排版未能載入，請重新整理頁面。';hint.style.color='#a35d13';});
