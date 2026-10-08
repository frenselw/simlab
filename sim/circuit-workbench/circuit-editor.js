(function (root) {
  'use strict';
  let serial=0, activeHost=null;
  const mounts=new WeakMap();
  async function mount(host, config={}) {
    if (!(host instanceof HTMLElement)) throw new TypeError('mount requires an HTML host');
    if (mounts.has(host)) throw new Error('此容器已有電路編輯器，請先 destroy');
    const profile=root.CircuitProfile.compile(config), prefix=config.idPrefix ?? ('circuit-'+(++serial)+'-');
    if (typeof prefix!=='string' || !/^[a-zA-Z0-9_-]*$/.test(prefix)) throw new Error('idPrefix 無效');
    mounts.set(host,true);
    const ownedAttributes=['class','tabindex','data-sim-fullscreen-target','data-role','data-read-only'];
    const originalAttributes=Object.fromEntries(ownedAttributes.map(name=>[name,host.getAttribute(name)]));
    const restoreHost=()=>{for(const [name,value]of Object.entries(originalAttributes))if(value===null)host.removeAttribute(name);else host.setAttribute(name,value);};
    let refs;
    try { refs=root.CircuitEditorUI.build(host,profile,prefix); await root.CircuitMath.ready();
      for(const e of host.querySelectorAll('[data-help-tex]'))e.innerHTML=root.CircuitMath.html({tex:e.dataset.helpTex,text:e.dataset.helpText});
    }
    catch(error) { mounts.delete(host); host.replaceChildren();restoreHost();throw error; }
    host.dataset.role=profile.role;
    const teacher=profile.role==='teacher', abort=new AbortController();
    let destroyed=false, readOnly=false, frame, observer;
    const on=(target,type,callback,options={})=>target.addEventListener(type,callback,{...(typeof options==='boolean'?{capture:options}:options),signal:abort.signal});
    const later=callback=>requestAnimationFrame(()=>{if(!destroyed)callback();});
    const allow=(d,c,op,key)=>profile.allows(d,c,op,key,readOnly);
    const wireAllowed=()=>profile.wires&&!readOnly;
    const $=id=>refs[id];
    const fullscreen=profile.ui.header ? root.SimFullscreen?.attach({
      getElementById:id=>refs[id]||host.querySelector('[id="'+id+'"]'),
      querySelector:selector=>host.matches(selector)?host:host.querySelector(selector),
      createElement:tag=>document.createElement(tag),documentElement:host,defaultView:window,
      addEventListener:document.addEventListener.bind(document),removeEventListener:document.removeEventListener.bind(document),
      get fullscreenElement(){return document.fullscreenElement;},get webkitFullscreenElement(){return document.webkitFullscreenElement;},
      get fullscreenEnabled(){return document.fullscreenEnabled;},get webkitFullscreenEnabled(){return document.webkitFullscreenEnabled;},
      exitFullscreen:document.exitFullscreen?.bind(document),webkitExitFullscreen:document.webkitExitFullscreen?.bind(document)
    }) : null;
    for (const id of ['fullscreenButton','fullscreenStatus']) {
      const element=host.querySelector('[id="'+id+'"]'); if(element){refs[id]=element;element.dataset.circuitId=id;element.id=prefix+id;}
    }

  try {
  const M=window.CircuitModel,R=window.CircuitRegistry,S=window.CircuitSolver,D=window.CircuitDocument,G=window.CircuitRouting,V=window.CircuitRenderer,P=window.CircuitPresets,Q=window.CircuitMath,N=window.CircuitMeterMotion,J=window.CircuitSnapping,H=window.CircuitRelayMotion;
  const surface=$("surface"),svg=$("circuitSvg"),hitLayer=$("hitLayer");
  const history=M.history(profile.initial),camera={x:0,y:0,scale:1},listeners=new Set(),targets=new Map();
  const wireCurrents=new Set(),potentialDirections=new Set(),labelOptions={previous:null,exclusions:[],idPrefix:prefix,wireCurrents,potentialDirections},flowOffsets=new Map(),flowScales=new Map(),needleStates=new Map(),relayStates=new Map();
  const flowContext=()=>(drag||previewDoc)?new Map(flowScales):flowScales;
  const solve=doc=>{H.sync(relayStates,history.get());return S.solve(doc,relayStates);};
  let analysis=solve(history.get()),routes={},geometryKey="",selection=null,drag=null,previewDoc=null,meterPreview=null,panMode=false,wireMode=false,probeMode=false,probeFirst=null,probeResult=null,autoFit=true,lastMessage="",suppressClick=false;
  let quickBinding=null,releasedMeta=null,blankMouseDown=null;
  const touches=new Map(),minScale=.001,maxScale=2.5;
  const owned=e=>host.contains(e.target)||touches.size||drag||cameraGesture;
  let cameraGesture=null,touchOrigin=null,touchBlocked=false,spacePan=false,spacePanUsed=false;
  let noticeTimer;
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  let paused=reducedMotion.matches,slowMotion=false,animationTime=0,lastTime=0,relayLastTime=performance.now();
  on(document,'visibilitychange',()=>{lastTime=0;relayLastTime=performance.now();});
  on(reducedMotion,'change',()=>{if(reducedMotion.matches)paused=true;lastTime=0;relayLastTime=performance.now();render(false);});
  const current=()=>previewDoc||history.get(),world=(x,y)=>{const r=surface.getBoundingClientRect();return{x:camera.x+(x-r.left)/camera.scale,y:camera.y+(y-r.top)/camera.scale};};
  const screen=p=>({x:(p.x-camera.x)*camera.scale,y:(p.y-camera.y)*camera.scale}),snapGrid=v=>Math.round(v/20)*20;
  const rich=parts=>(Array.isArray(parts)?parts:[parts]).map(p=>typeof p==='string'?V.esc(p):Q.html(p)).join('');
  function notify(content,error=false){const text=Array.isArray(content)?content.map(p=>typeof p==='string'?p:p.text).join(''):content;lastMessage=text;if(error&&$("settingsDialog").open){$("settingsNotice").textContent=text;$("settingsNotice").hidden=false;}$("hint").innerHTML=rich(content);$("hint").title=text;$("hint").style.color=error?"#a35d13":"";const n=$("canvasNotice");n.innerHTML=rich(content);n.hidden=false;n.classList.toggle("error",error);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{n.hidden=true;},3500);}
  function selectedWire(){return history.get().wires.find(w=>w.id===selection?.id);}
  function selectedComponent(){return history.get().components.find(c=>c.id===selection?.id);}
  function emitChange(){for(const fn of listeners)try{fn(M.clone(history.get()));}catch(e){console.error("CircuitWorkbench onChange callback failed",e);}}
  const readableMeter=(d,c)=>c&&d.display.values&&R.isMeter(c);
  function rollbackDrag(){meterPreview=null;const old=drag;drag=null;previewDoc=null;analysis=solve(history.get());$("preview").hidden=true;
    if(old?.kind==="wireend"||old?.kind==="body"||old?.wholeWire)$("canvasNotice").hidden=true;
    if(old?.kind==="pan"){Object.assign(camera,old.base);autoFit=old.autoFitBefore;}
    if(old)selection=old.selectionBefore;
    if(old?.kind==='palette')old.target.suppressAddClick=true;
    // Active touches keep their original capture until lift or an explicit transfer.
    if(old?.target.hasPointerCapture?.(old.pointerId)&&!touches.has(old.pointerId))old.target.releasePointerCapture(old.pointerId);
    if(old)suppressClick=true;
  }
  function releaseTouches(ids){for(const id of ids)if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);}
  function cancel(deferRender=false){if(destroyed)return;relayLastTime=performance.now();releasedMeta=null;const old=cameraGesture;cameraGesture=null;rollbackDrag();labelOptions.previous=null;
    if(old){Object.assign(camera,old.base);autoFit=old.autoFitBefore;selection=old.selectionBefore;releaseTouches(old.ids.filter(id=>!touches.has(id)));}
    if(touches.size){touchBlocked=true;suppressClick=true;}
    if(deferRender===true)later(()=>render());else render();
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
  function change(fn,inspector=true){if(destroyed)throw new Error("編輯器已卸載");const beforeSelection=selection&&M.clone(selection);
    try{const before=history.get();history.change(doc=>{fn(doc);profile.assertTransition(before,doc,readOnly);});previewDoc=null;meterPreview=null;relayLastTime=performance.now();analysis=solve(history.get());
      if(selection&&!M.endpoints(history.get()).has(selection.id)&&![...history.get().components,...history.get().junctions,...history.get().wires].some(x=>x.id===selection.id))selection=null;
      $("settingsNotice").hidden=true;if(autoFit)fit();render(inspector);if(before!==history.get())emitChange();return true;
    }catch(e){selection=beforeSelection;previewDoc=null;analysis=solve(history.get());render(inspector);notify(e.message,true);return false;}
  }
  function addComponent(doc,type,x,y,params){
    const c=M.add(doc,type,x,y,params);
    // Removed author-supplied IDs must not become a different toolbox component.
    if(!teacher&&profile.initial.components.some(initial=>initial.id===c.id))c.id=M.nextId({...doc,components:[...doc.components,...profile.initial.components]},'c');
    return c;
  }
  function addWire(doc,x,y){const w=M.addWire(doc,x,y);if(!teacher&&profile.initial.wires.some(initial=>initial.id===w.id))w.id=M.nextId({...doc,wires:[...doc.wires,...profile.initial.wires]},'w');return w;}
  function fit(){const d=current(),points=[...d.components.flatMap(c=>[{x:c.x-90,y:c.y-90},{x:c.x+90,y:c.y+130}]),...d.junctions,...d.wires.flatMap(w=>G.route(d,w))];
    if(!points.length){Object.assign(camera,{x:0,y:0,scale:1});return;}
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    camera.scale=Math.max(.001,Math.min(1.2,(surface.clientWidth-40)/Math.max(120,maxX-minX),(surface.clientHeight-40)/Math.max(120,maxY-minY)));
    camera.x=(minX+maxX)/2-surface.clientWidth/(2*camera.scale);camera.y=(minY+maxY)/2-surface.clientHeight/(2*camera.scale);
  }
  function focusPoint(p){autoFit=false;camera.scale=Math.max(1,camera.scale);camera.x=p.x-surface.clientWidth/(2*camera.scale);camera.y=p.y-surface.clientHeight/(2*camera.scale);render(false);}
  function resolveSnap(d,id,key,p){const w=d.wires.find(w=>w.id===id),other=key==="from"?"to":"from";let found=null,distance=24/camera.scale;
    for(const [endpoint,q]of M.endpoints(d)){if(endpoint===w[key]||(endpoint===w[other]&&!M.attached(d,w,other)))continue;
      const size=Math.hypot(q.x-p.x,q.y-p.y);if(size<distance){found={...q,id:endpoint};distance=size;}}
    return found;
  }
  function snapWholeWire(d,id){const w=d.wires.find(w=>w.id===id),ends=M.endpoints(d);let best=null;
    for(const end of ["from","to"]){const p=ends.get(w[end]),candidate=resolveSnap(d,id,end,p);if(!candidate)continue;const distance=Math.hypot(candidate.x-p.x,candidate.y-p.y);
      if(!best||distance<best.distance)best={...candidate,end,distance};}
    if(!best)return null;const snapped=M.clone(d),p=ends.get(w[best.end]);
    // A body grip snaps by translating the entire loose cable. Endpoint
    // attachment itself fixes the opposite end, as a direct endpoint grip does.
    if(M.translateWire(snapped,id,best.x-p.x,best.y-p.y).limited||!M.attach(snapped,id,best.end,best.id))return null;
    return{doc:snapped,snap:best};
  }
  function probePort(id){selection={kind:"port",id};const value=analysis.potentials[id];if(probeFirst&&probeFirst!==id){probeResult={from:probeFirst,to:id,voltage:analysis.voltage(probeFirst,id)};probeFirst=null;notify(probeResult.voltage===null?"兩點不屬同一個可確定電勢差的電路。":["兩點電壓：",Q.quantity(probeResult.voltage,'V'),"（第一點 − 第二點）"]);}else{probeFirst=id;probeResult=null;notify(['相對電勢 ',Q.quantity(value,'V'),'（'+referenceText(id)+'）；再點另一個端子測量。']);}render();}
  function target(key,meta,p,width=44,height=44,touch="none"){let t=targets.get(key);if(!t){t=document.createElement("button");t.type="button";t.className="hit "+meta.kind;t.dataset.hit=key;targets.set(key,t);hitLayer.append(t);}
    t.meta=meta;t.setAttribute("aria-label",meta.label);Object.assign(t.style,{left:p.x+"px",top:p.y+"px",width:Math.max(meta.kind==="wire"?12:44,width)+"px",height:Math.max(meta.kind==="wire"?12:44,height)+"px",touchAction:touch,transform:"translate(-50%,-50%)"});
    t.classList.toggle("snap",!!drag?.snap&&(drag.snap.connections||[drag.snap]).some(s=>s.id===meta.id||s.id===meta.endpoint));t.tabIndex=meta.kind==="wire"&&meta.segment>0?-1:0;return t;
  }
  function renderHits(d){const needed=new Set(),put=(key,...args)=>{needed.add(key);return target(key,...args);};
    d.components.forEach(c=>{const dual=R.dualMeter(c),size=d.display.view==='real'?R.meterBodyScale(c):1,w=(dual?(d.display.view==='real'?144:70):c.type==='relay'?150:c.type==='galvanometer'?102:c.type==='rheostat'?100:c.type==='wattmeter'?80:70)*size,h=(dual?(d.display.view==='real'?130:70):c.type==='relay'?108:c.type==="lamp"?106:c.type==='galvanometer'?97:c.type==='rheostat'?64:c.type==="wattmeter"?78:46)*size,angle=c.angle*Math.PI/180,center=dual&&d.display.view==='real'?{x:c.x+22*size*Math.sin(angle),y:c.y-22*size*Math.cos(angle)}:c.type==='relay'?{x:c.x-14*Math.sin(angle),y:c.y+14*Math.cos(angle)}:c;
      put("body:"+c.id,{kind:"body",id:c.id,label:c.label+"，拖動本體或用方向鍵移動"},screen(center),(c.angle%180?h:w)*camera.scale,(c.angle%180?w:h)*camera.scale,allow(d,c,"move")||readableMeter(d,c)?"none":"pan-y");
      if(c.type==="rheostat"){const angle=c.angle*Math.PI/180,x=-30+c.params.position*60,y=(c.params.terminals??2)>2?-34:38;put("slider:"+c.id,{kind:"slider",id:c.id,label:c.label+"滑片，拖動調整電阻"},screen({x:c.x+x*Math.cos(angle)-y*Math.sin(angle),y:c.y+x*Math.sin(angle)+y*Math.cos(angle)}),44,44,allow(d,c,"params","position")?"none":"pan-y");}
      if(dual?camera.scale>=.7:camera.scale>=.55||probeMode||drag?.kind==="wireend")R.ports(c).forEach(p=>put("port:"+p.id,{kind:"port",id:p.id,label:c.label+" "+p.label+"端子，拖導線端點到這裏接好"},screen(p),44,44,"pan-y"));
    });
    d.junctions.filter(j=>M.degree(d,j.id+":p")>1).forEach(j=>put("junction:"+j.id,{kind:"junction",id:j.id,label:"共接點，點選量測或拖動"},screen(j)));
    d.wires.forEach(w=>{const points=G.simplify(routes[w.id],1.2/camera.scale);
      points.slice(1).forEach((p,i)=>{const a=screen(points[i]),b=screen(p),n=put("wire:"+w.id+":"+i,{kind:"wire",id:w.id,segment:i,point:{x:(points[i].x+p.x)/2,y:(points[i].y+p.y)/2},label:"導線 "+w.id+"，拿線身搬動或彎曲"},{x:(a.x+b.x)/2,y:(a.y+b.y)/2},Math.hypot(b.x-a.x,b.y-a.y)+6,18);n.style.transform+=` rotate(${Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}deg)`;n.classList.toggle("selected",selection?.id===w.id);});
      const ends=M.endpoints(d);["from","to"].forEach((end,i)=>{if(!M.attached(d,w,end)||selection?.id===w.id||wireMode){const n=put("wireend:"+w.id+":"+end,{kind:"wireend",id:w.id,end,endpoint:w[end],label:`導線 ${w.id} ${i?"B":"A"}端，${M.attached(d,w,end)?"拉走可拔開":"拖到端子或其他線端接好"}`},screen(ends.get(w[end])));n.classList.toggle("selected",selection?.id===w.id);}});
    });
    for(const [key,t]of targets)if(!needed.has(key)&&t!==drag?.target&&![...touches.values()].some(p=>p.target===t)){t.remove();targets.delete(key);}
  }
  function renderGhost(){const snap=drag?.snap;$("ghostLayer").innerHTML=snap?(snap.connections||[snap]).map(s=>`<circle data-snap-target="${V.esc(s.id)}" cx="${s.x}" cy="${s.y}" r="${14/camera.scale}" fill="#a7d4f344" stroke="#2563eb" stroke-width="${2/camera.scale}"/>`).join(""):"";
    host.classList.toggle('palette-dragging',drag?.kind==='palette'&&drag.moved);
    const d=current();$('emptyHint').hidden=!!(d.components.length||d.wires.length||drag?.kind==='palette'&&(drag.component||drag.wirePreview));
    if(drag?.kind==='palette'&&drag.component){const c=drag.component;$("ghostLayer").innerHTML+=`<g data-palette-preview="${V.esc(drag.entry.key)}" transform="translate(${c.x} ${c.y})" opacity=".65" pointer-events="none">${V.body(c,null,history.get().display)}</g>`;}
    if(drag?.kind==='palette'&&drag.wirePreview){const points=drag.wirePreview;$("ghostLayer").innerHTML+=`<g data-palette-preview="wire-tool" data-wire-tool-preview="true" opacity=".65" pointer-events="none"><path d="${G.path(points)}" fill="none" stroke="#50677e" stroke-width="${4/camera.scale}"/>${[points[0],points.at(-1)].map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${7/camera.scale}" fill="#fff" stroke="#526f88" stroke-width="${2/camera.scale}"/>`).join('')}</g>`;}
    if(drag?.kind==="wireend"||drag?.kind==="body"||drag?.wholeWire){const n=$("canvasNotice");clearTimeout(noticeTimer);n.hidden=!snap&&!drag.limited;n.classList.toggle("error",drag.limited);
      n.innerHTML=rich(snap?[drag.kind==="body"?"元件將接線：":drag.wholeWire?(snap.end==="from"?"A":"B")+" 端將接到：":"將接到：",...connectionLabel(snap.id)]:drag.limited?"線已拉盡；移近元件，或用另一條線接長。":"");}
    if(probeFirst){const p=M.endpoints(current()).get(probeFirst);if(p)$("ghostLayer").innerHTML+=`<circle cx="${p.x}" cy="${p.y}" r="${11/camera.scale}" fill="none" stroke="#b56e20" stroke-width="${2/camera.scale}"/>`;}
  }
  function render(inspector=true){if(destroyed)return;const d=current(),surfaceRect=surface.getBoundingClientRect();N.sync(needleStates,d,analysis,reducedMotion.matches);svg.setAttribute("viewBox",`${camera.x} ${camera.y} ${surfaceRect.width/camera.scale} ${surfaceRect.height/camera.scale}`);
    for(const id of wireCurrents)if(!history.get().wires.some(w=>w.id===id))wireCurrents.delete(id);
    $('showWireCurrents').disabled=!d.wires.length||wireCurrents.size===d.wires.length;$('hideWireCurrents').disabled=!wireCurrents.size;
    for(const id of potentialDirections)if(!history.get().components.some(c=>c.id===id))potentialDirections.delete(id);
    $('showPotentialDirections').disabled=!d.components.length||potentialDirections.size===d.components.length;$('hidePotentialDirections').disabled=!potentialDirections.size;
    $('potential').disabled=readOnly;
    const potentialRange=V.potentialRange(analysis),{low,high,max,known}=potentialRange,mid=(low+high)/2,equal=low===high;
    $('potentialScale').style.background=known?'linear-gradient(to right,'+Array.from({length:21},(_,i)=>V.colour(low+(high-low)*i/20,max)+' '+i*5+'%').join(',')+')':V.colour(null,max);
    $('potentialScale').setAttribute('aria-label',known?(equal?'等電勢：'+Q.quantity(mid,'V').text:'電勢由低至高：'+[low,mid,high].map(v=>Q.quantity(v,'V').text).join('、')):'電勢未能確定');
    $('potentialLow').hidden=$('potentialHigh').hidden=equal||!known;$('potentialTicks').style.justifyContent=equal?'center':'space-between';
    for(const [id,label,value]of [['potentialLow','低',low],['potentialMid',equal?'等電勢':'中',mid],['potentialHigh','高',high]])$(id).innerHTML=known?rich([label+' ',Q.quantity(value,'V')]):'未能確定';
    labelOptions.exclusions=[...host.querySelectorAll('.scroll-strip, .canvas-notice:not([hidden])')].map(e=>{const r=e.getBoundingClientRect();return{left:camera.x+(r.left-surfaceRect.left)/camera.scale,right:camera.x+(r.right-surfaceRect.left)/camera.scale,top:camera.y+(r.top-surfaceRect.top)/camera.scale,bottom:camera.y+(r.bottom-surfaceRect.top)/camera.scale};});
    surface.style.backgroundSize=`${Math.max(16,20*camera.scale)}px ${Math.max(16,20*camera.scale)}px`;surface.style.backgroundPosition=`${-camera.x*camera.scale}px ${-camera.y*camera.scale}px`;
    const key=JSON.stringify([d.components.map(c=>[c.id,c.type,c.x,c.y,c.angle,c.mirrored,R.ports(c).map(p=>[p.id,p.x,p.y,p.dx,p.dy])]),d.junctions,d.wires]);if(key!==geometryKey){routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)]));geometryKey=key;}
    $("scene").innerHTML=V.scene(d,analysis,camera.scale,routes,selection?.id,wireMode,{x:camera.x,y:camera.y,width:surfaceRect.width/camera.scale,height:surfaceRect.height/camera.scale},labelOptions);$("flowLayer").innerHTML=V.flow(d,analysis,routes,animationTime,camera.scale,flowOffsets,flowContext());renderHits(d);renderGhost();
    $("zoomReadout").textContent=(camera.scale<.01?(camera.scale*100).toFixed(1):Math.round(camera.scale*100))+"%";
    $("fitView").setAttribute("aria-pressed",String(autoFit));
    $("fitView").title=autoFit?"自動全圖已啟用；移動元件後會自動適應":"顯示全圖並啟用自動適應";
    $("undo").disabled=readOnly||!profile.undo||!history.canUndo();$("redo").disabled=readOnly||!profile.undo||!history.canRedo();["realView","schematicView"].forEach(id=>$(id).setAttribute("aria-pressed",String(d.display.view===(id==="realView"?"real":"schematic"))));
    ["flow"].forEach(id=>$(id).value=d.display[id]);["potential","names","values","projection"].forEach(id=>$(id).checked=d.display[id]);$("pause").setAttribute("aria-pressed",String(paused));$("pause").setAttribute("aria-label",paused?"繼續模擬":"暫停模擬");$("pause").title=paused?"繼續模擬":"暫停模擬";$("pause").querySelector("use").setAttribute("href","#"+prefix+(paused?"icon-play":"icon-pause"));$("slowMotion").setAttribute("aria-pressed",String(slowMotion));$("mode").value=d.policy.mode;$("policyOptions").hidden=d.policy.mode!=="wiring";["allowRotate","allowParams","allowSwitch"].forEach(id=>$(id).checked=d.policy[id]);
    Object.keys(M.quantityDefaults).filter(id=>$(id)).forEach(id=>{$(id).checked=d.display.quantities[id];$(id).disabled=!d.display.values;});
    $("potentialLegend").hidden=!d.display.potential;$("pan").setAttribute("aria-pressed",String(panMode));$("probe").setAttribute("aria-pressed",String(probeMode));$("pickWire").setAttribute("aria-pressed",String(wireMode));surface.classList.toggle('wire-priority',wireMode);surface.classList.toggle("panning",panMode);surface.classList.toggle("quick-pan",spacePan||!!drag?.quick);surface.classList.toggle("camera-gesture",!!cameraGesture);surface.classList.toggle("grabbing",!!(drag||cameraGesture));surface.classList.toggle("effects-paused",paused);surface.classList.toggle("effects-slow",slowMotion);
    const w=selectedWire(),c=selectedComponent(),actions=!!(w||c||selection?.kind==="junction");$("selectionActions").hidden=!actions;$("hint").parentElement.classList.toggle("has-actions",actions);
    $("focusSelected").hidden=!actions;
    const canCopy=!!c&&profile.palette.some(e=>e.type===c.type&&profile.canAdd(e,d,readOnly));$("copySelected").hidden=!c||!teacher&&!canCopy;$("copySelected").disabled=!canCopy;
    $("detachFrom").hidden=!w||!wireAllowed();$("detachTo").hidden=!w||!wireAllowed();$("detachFrom").disabled=!!w&&!M.attached(history.get(),w,"from");$("detachTo").disabled=!!w&&!M.attached(history.get(),w,"to");["rotateSelected","rotateCounterSelected"].forEach(id=>{$(id).hidden=!c||!teacher&&!allow(d,c,"rotate");$(id).disabled=!!c&&!allow(d,c,"rotate");});
    $('inspectMeter').hidden=!c||!R.dualMeter(c)&&c.type!=='galvanometer';$('straightenSelected').hidden=!w||!wireAllowed();
    $('flipMeterSelected').hidden=!c||!R.dualMeter(c)||!teacher&&!allow(d,c,'rotate');$('flipMeterSelected').disabled=!!c&&!allow(d,c,'rotate');
    const deleteLabel=w?"刪除導線":c?"刪除元件":"拆開接點";$("deleteSelected").title=deleteLabel;$("deleteSelected").setAttribute("aria-label",deleteLabel);$("deleteSelected").disabled=c?!allow(d,c,"remove"):!wireAllowed();$("deleteSelected").hidden=!teacher&&$("deleteSelected").disabled;
    $("selectionTip").textContent=w?(drag?.limited?"線已拉盡":!M.attached(d,d.wires.find(x=>x.id===w.id),"from")&&!M.attached(d,d.wires.find(x=>x.id===w.id),"to")?"拿端點調整直線 · 拿線身搬動":"拿端點接線 · 拿線身彎曲"):c?c.label:"共接點";
    $("cableCount").disabled=d.policy.mode!=="free";$("cableLength").disabled=d.policy.mode!=="free";$("cableResistance").disabled=d.policy.mode!=="free"||!profile.canSetWireResistance(d,readOnly);$("cableResistance").value=d.cables.resistance;const remaining=d.cables.count-d.wires.length;$("wireStock").textContent=remaining+" / "+d.cables.count;$("quickWire").innerHTML=`＋導線 <span>${remaining}/${d.cables.count}</span>`;["addWire","quickWire"].forEach(id=>$(id).disabled=remaining===0||!wireAllowed());$("cableCount").value=d.cables.count;const lengthSelect=$("cableLength");[...lengthSelect.options].filter(o=>o.dataset.custom&&Number(o.value)!==d.cables.length).forEach(o=>o.remove());if(![...lengthSelect.options].some(o=>Number(o.value)===d.cables.length)){const o=new Option("自訂 · "+d.cables.length,String(d.cables.length));o.dataset.custom="true";lengthSelect.add(o);}lengthSelect.value=d.cables.length;
    const hazards=V.visualState(d,analysis);$("circuitStatus").textContent=hazards.short?"短路 · 發熱":hazards.overload?"過載 · 發熱":analysis.diagnostics.length?"需檢查電路":"";host.querySelectorAll("[data-add]").forEach(b=>b.disabled=!profile.canAdd(b.entry,d,readOnly));
    if(inspector)renderProperties();
    else {
      const input=$('properties').querySelector('[data-param="position"]'),component=d.components.find(c=>c.id===input?.dataset.component);
      if(component&&document.activeElement!==input){
        input.value=Number((component.params.position*100).toPrecision(12));
        const range=input.parentElement.nextElementSibling;if(range?.type==='range')range.value=input.value;
        const reading=$('properties').querySelector('.reading-host');if(reading)reading.innerHTML=componentReadings(component.id);
      }
    }
    renderQuickParameters();
    const held=drag?.pointerType==="touch"&&["body","meterread"].includes(drag.kind)&&!drag.moved?d.components.find(c=>c.id===drag.id):null;
    const pinned=meterPreview?d.components.find(c=>c.id===meterPreview.id):null,reading=readableMeter(d,held)?held:readableMeter(d,pinned)?pinned:null;
    if(reading)renderPreview(null,reading);else if(drag?.pointerType==="touch"&&drag.kind==="wireend")renderPreview(drag.focus||world(drag.lastX,drag.lastY));else $("preview").hidden=true;
    updateMeterNeedles();
  }
  function updateMeterNeedles(){
    for(const root of [$("scene"),$("preview"),$("meterDetail")])for(const needle of root.querySelectorAll('[data-meter-needle]')){
      const state=needleStates.get(needle.dataset.meterNeedle);if(!state||state.target===null)continue;
      const fraction=state.fraction,p=V.dialPoint(fraction,69);
      needle.setAttribute('d',`M0 24L${p.x} ${p.y}`);needle.dataset.fraction=fraction;needle.dataset.angle=V.dialAngle(fraction);needle.dataset.targetFraction=state.target;
      needle.dataset.moving=String(fraction!==state.target||state.velocity!==0);
    }
  }
  function renderPreview(p,meter=null){const host=$("preview"),preview=host.querySelector("svg");host.hidden=false;host.dataset.mode=meter?"meter":"connection";host.setAttribute("aria-hidden",String(!meter));$("closePreview").hidden=!meter;host.querySelector("span").textContent=meter?"刻度預覽":"接線預覽";if(drag&&!drag.previewSide)drag.previewSide=drag.x-surface.getBoundingClientRect().left>surface.clientWidth/2?"left":"right";const side=drag?.previewSide||meterPreview?.side;host.style.left=side==="left"?"46px":"auto";host.style.right=side==="left"?"auto":"46px";
    if(meter){preview.setAttribute("role","img");preview.setAttribute("aria-label",meter.label+"指針刻度");const d=current(),r=analysis.components[meter.id];preview.setAttribute("viewBox",R.dualMeter(meter)?"-78 -85 156 119":meter.type==='galvanometer'?'-50 -45 100 90':"-70 -55 140 110");preview.innerHTML=R.dualMeter(meter)?V.dualDial(meter,r,d.display.values):meter.type==='galvanometer'?V.galvanometerDial(meter,r,d.display.values):V.body({...meter,angle:0},r,{...d.display,view:"real"});}
    else{preview.setAttribute("viewBox",`${p.x-70} ${p.y-55} 140 110`);preview.innerHTML=($("scene").innerHTML+$("ghostLayer").innerHTML).replace(/(id="|url\(#)([\w-]*wire-potential-[\w-]+)/g,'$1preview-$2');}
  }
  const actionIcons={'反接電源極性':'flip','整理線形':'wire'};
  function button(label,fn,disabled=false,danger=false,parent=$("objectActions")){const b=document.createElement("button"),socket=/^(接好|拔開) [AB]$/.test(label),name=actionIcons[label]||(socket?label.startsWith('接好 ')?'attach':'detach':null);b.type="button";
    if(name){b.className='icon-button';b.innerHTML=`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#${prefix}icon-${name}"/></svg>`;if(socket){b.classList.add('socket-action');b.innerHTML+='<small>'+V.esc(label.slice(-1))+'</small>';}}
    else{b.className='text-action';b.textContent=label;}
    if(!teacher && disabled)return b;b.title=label;b.setAttribute('aria-label',label);b.dataset.action=label;b.disabled=disabled;if(danger)b.classList.add('danger');b.onclick=fn;parent.append(b);return b;
  }
  function readings(values){return '<dl class="readings">'+values.map(([name,value,unit])=>`<dt>${V.esc(name)}</dt><dd>${Q.html(Q.quantity(value,unit))}</dd>`).join("")+"</dl>";}
  function referenceText(endpoint){const island=analysis.islandOf[endpoint],requested=history.get().display.reference,reference=requested&&analysis.islandOf[requested]===island?requested:analysis.references.find(r=>r.island===island)?.endpoint;return reference?'以「'+portName(reference)+'」為 0 V 參考':'0 V 參考未能確定';}
  const referenceNote=endpoint=>'<p class="note potential-reference" data-reference-for="'+V.esc(endpoint)+'">'+V.esc(referenceText(endpoint))+'。</p>';
  function field(label,element){const l=document.createElement("label"),caption=document.createElement('span');caption.innerHTML=rich(label);l.append(caption,element);$("properties").append(l);}
  function checkbox(label,checked,fn){const l=document.createElement("label");l.className="check";const i=document.createElement("input");i.type="checkbox";i.checked=checked;i.onchange=()=>fn(i.checked);l.append(i,document.createTextNode(label));$("properties").append(l);}
  function setDiagramDisplay(kind,id,visible){
    const wire=kind==='wireCurrents',items=history.get()[wire?'wires':'components'],ids=wire?wireCurrents:potentialDirections,name=wire?'導線電流':'電勢方向';
    if(!profile.ui[kind]){notify('此活動未開放'+name+'標示。',true);return false;}
    if(typeof visible!=='boolean'||id!==undefined&&!items.some(item=>item.id===id)){notify(name+'顯示設定無效。',true);return false;}
    cancel();for(const item of items)if(id===undefined||item.id===id){if(visible)ids.add(item.id);else ids.delete(item.id);}render();return true;
  }
  function renderProperties(){const d=history.get(),c=selectedComponent(),wire=selectedWire(),prop=$("properties");prop.replaceChildren();$("objectActions").replaceChildren();
    if (c) {
      $("selectionTitle").textContent = c.label;
      if(profile.ui.potentialDirections)checkbox('顯示此元件電勢方向',potentialDirections.has(c.id),v=>setDiagramDisplay('potentialDirections',c.id,v));
      const name = document.createElement("input"); name.type = "text"; name.value = c.label; name.maxLength = 40; name.disabled = !allow(d, c, "label"); name.onchange = () => change((doc) => { doc.components.find((x) => x.id === c.id).label = name.value; }); if(teacher||allow(d,c,"label"))field("名稱", name);
      for (const [key, spec] of Object.entries(R.get(c.type).params)) {
        if (key === "polarity") continue;
        if(c.type==='lamp'&&c.params.model==='ideal'&&['coldRatio','linearLoss'].includes(key))continue;
        const enabled = allow(d, c, key === "closed" ? "switch" : "params",key);
        if(!teacher&&!enabled)continue;
        if (spec.choices) { const input = document.createElement("select");input.dataset.param=key; spec.choices.forEach((choice) => { const o = document.createElement("option"); o.value = String(choice); o.textContent = c.type==='lamp'&&key === "model" ? choice === "ideal" ? "恆阻燈（理想化）" : "變阻燈（熱效應）" : c.type==='rheostat'&&key==='terminals'?choice+' 孔'+(choice===4?'（教學器材）':choice===3?'（分壓）':'（限流）'):c.type==='switch'&&key==='closed'?choice ? "閉合" : "斷開":String(choice); input.append(o); }); input.selectedIndex = spec.choices.findIndex(choice=>choice===c.params[key]); input.disabled = !enabled; input.onchange = () => {const value=spec.choices[input.selectedIndex];const ok=change((doc) => {if(c.type==='rheostat'&&key==='terminals')M.setTerminals(doc,c.id,value);else doc.components.find((x) => x.id === c.id).params[key] = value; });if(ok&&c.type==='rheostat'&&key==='terminals')notify('已切換接線孔；隱去孔的導線拔開並留在畫布。');}; field(spec.label||(c.type==='lamp'&&key === "model" ? "燈泡模型" : c.type==='switch'&&key==='closed'?"開關狀態":key), input); }
        else {
          const factor = ['position','linearLoss'].includes(key) ? 100 : spec.factor||1;
          const input = document.createElement("input"); input.type = "number"; input.value = c.params[key] * factor; input.min = spec.min * factor; input.max = spec.max * factor; input.step = "any"; input.disabled = !enabled; input.dataset.param = key; input.dataset.component = c.id; input.onchange = () => { const value = input.valueAsNumber / factor; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; field(spec.unit?[spec.label+' · ',Q.unit(spec.unit)]:spec.label,input);
          if (["voltage", "resistance", "position"].includes(key)) {
            const range = document.createElement("input"),preferredMax=key==='position'?1:key==='voltage'?24:c.type==='battery'?10:100;
            range.type = "range"; range.min = spec.min * factor;
            range.max = Math.min(spec.max,Math.max(preferredMax<=spec.min?spec.max:preferredMax,c.params[key])) * factor;
            range.step = spec.step * factor; range.value = c.params[key] * factor; range.disabled = !enabled; range.setAttribute("aria-label", spec.label + "滑塊");
            range.oninput = () => {
              if(!allow(history.get(),c,"params",key))return;
              const candidate=M.clone(history.get());candidate.components.find(x=>x.id===c.id).params[key]=Number(range.value)/factor;
              try{profile.assertTransition(history.get(),candidate,readOnly);}catch(e){cancel();notify(e.message,true);return;}
              input.value=range.value;previewDoc=candidate;analysis=solve(previewDoc);render(false);
              const result=prop.querySelector('.reading-host');if(result)result.innerHTML=componentReadings(c.id);
            };
            range.onchange = () => { const value = Number(range.value) / factor; previewDoc = null; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; range.onpointercancel = cancel; prop.append(range);
          }
        }
      }
      if(c.type==='lamp'&&(teacher||allow(d,c,'params','resistance'))){
        const input=document.createElement('input');input.type='number';input.step='any';input.min='.00000001';input.value=c.params.ratedVoltage**2/c.params.resistance;input.dataset.param='ratedPower';input.disabled=!allow(d,c,'params','resistance');input.onchange=()=>change(doc=>{if(!Number.isFinite(input.valueAsNumber)||input.valueAsNumber<=0)throw new Error('額定功率必須大於零');doc.components.find(x=>x.id===c.id).params.resistance=c.params.ratedVoltage**2/input.valueAsNumber;});field(['額定功率 · ',Q.unit('W')],input);
      }
      const host = document.createElement("div"); host.className = "reading-host"; host.innerHTML = componentReadings(c.id); if(profile.ui.readings)prop.append(host);
      if (teacher && c.type === "lamp" && c.params.model === "thermal") { const n = document.createElement("p"); n.className = "note";n.innerHTML=rich(['冷態電阻 ',Q.quantity(c.params.resistance/c.params.coldRatio,'Ω'),'。穩態散熱含線性及輻射兩部分；參數可用多個實測點校準。未模擬預熱或燒毀。']); prop.append(n); }
      if(teacher&&c.type==='rheostat'){const n=document.createElement('p');n.className='note';n.textContent=c.params.terminals===2?'A–P：滑片改變接入電阻。':'A、B 是電阻絲兩端，P₁／P₂ 接同一滑片。接 A–P 限流；接 A–B 供電並由 P 取出分壓。';prop.append(n);}
      if(c.type==='relay'){const n=document.createElement('p');n.className='note';n.innerHTML=rich(['線圈與觸點電氣隔離；上觸點常閉、下觸點常開，切換中兩邊斷開。釋放電流 ',Q.quantity(c.params.pickupCurrent*600,'mA'),'。延時為教學示意，未模擬線圈電感、火花或接點彈跳。']);prop.append(n);}
      if(c.type==='galvanometer'){const n=document.createElement('p');n.className='note';n.innerHTML=rich(['中心零：±',Q.quantity(c.params.range*1e6,'μA'),'。並聯分流電阻可擴大電流量程，串聯電阻可改作電壓表。',V.statusText(analysis.components[c.id])]);prop.append(n);}
      if (teacher && c.type === "wattmeter") { const n = document.createElement("p"); n.className = "note"; n.innerHTML = rich([{text:'I+、I−',tex:'I_{+},\\ I_{-}'},' 串聯；',{text:'V+、V−',tex:'V_{+},\\ V_{-}'},' 跨接用電器。',{text:'P = (V+ − V−) I',tex:'P=(V_{+}-V_{-})I'},'。']); prop.append(n); }
      if(R.dualMeter(c)){const r=analysis.components[c.id],n=document.createElement('p');n.className='note';n.innerHTML=rich([...(V.statusText(r)?[V.statusText(r)]:['目前量程 ',Q.quantity(r.range,r.unit)]),'。接共用 − 與其中一個正極孔；先用大量程，再換小量程。每小格 ',Q.quantity(r.division,r.unit),'；負刻度至 ',Q.quantity(r.minimum,r.unit),'。',camera.scale<.7?'孔太近時可按「定位所選」分清三個孔。':'']);prop.append(n);}
      d.wires.filter(w=>[w.from,w.to].some(id=>id.split(':')[0]===c.id)).forEach(w=>button('選導線 '+w.id,()=>{selection={kind:'wire',id:w.id};render();}));
      if (c.type === "battery") button("反接電源極性", () => change((doc) => { doc.components.find((x) => x.id === c.id).params.polarity *= -1; }), !allow(d, c, "params","polarity"));
      if (teacher && d.policy.mode === "free") checkbox("固定此元件", c.locked, (v) => change((doc) => { doc.components.find((x) => x.id === c.id).locked = v; }));
      else if(teacher)checkbox("此元件可調參數", c.editable, (v) => change((doc) => { doc.components.find((x) => x.id === c.id).editable = v; }));

    }else if(wire){
      $("selectionTitle").textContent="導線 "+wire.id;prop.innerHTML=`<p class="note">A：${V.esc(portName(wire.from))}<br>B：${V.esc(portName(wire.to))}<br>目前長度 ${Math.round(G.length(routes[wire.id]))} / 上限 ${Math.round(wire.length)} 畫布單位</p>`+(profile.ui.readings?readings([["A → B 電流",analysis.wires[wire.id]?.current,"A"],["A 端相對電勢",analysis.wires[wire.id]?.potential,"V"],["B 端相對電勢",analysis.wires[wire.id]?.potentialTo,"V"],["A − B 電壓",analysis.wires[wire.id]?.voltage,"V"],["導線耗散功率",analysis.wires[wire.id]?.power,"W"]])+referenceNote(wire.from):'');
      if(analysis.wires[wire.id]?.cyclic)prop.insertAdjacentHTML("beforeend",'<p class="note">理想導線環路中，此段電流不能唯一確定。</p>');
      if(profile.ui.wireCurrents)checkbox('顯示此導線電流',wireCurrents.has(wire.id),v=>setDiagramDisplay('wireCurrents',wire.id,v));
      if(profile.canSetWireResistance(d,readOnly)){const input=document.createElement('input');input.type='number';input.min=0;input.max=M.limits.resistance;input.step='any';input.value=wire.resistance;input.dataset.param='wireResistance';input.onchange=()=>execute({type:'setWireResistance',id:wire.id,value:input.valueAsNumber});field(['導線電阻 · ',Q.unit('Ω')],input);prop.insertAdjacentHTML('beforeend','<p class="note">0 Ω 為理想導線；阻值不隨拖動或彎線改變。</p>');}
      else if(d.display.values)prop.insertAdjacentHTML('beforeend',readings([['導線電阻',wire.resistance,'Ω']]));
      if(wireAllowed())["from","to"].forEach((key,i)=>{const input=document.createElement("select");input.dataset.end=key;const none=document.createElement("option");none.value="";none.textContent="選接線對象";input.append(none);
        for(const [id]of M.endpoints(d)){if(id===wire[key]||(id===wire[key==="from"?"to":"from"]&&!M.attached(d,wire,key==="from"?"to":"from")))continue;const o=document.createElement("option");o.value=id;o.textContent=portName(id);input.append(o);}
        input.id=prefix+'wire-end-'+key;const caption=document.createElement('label');caption.className='connection-caption';caption.htmlFor=input.id;caption.textContent=(i?'B':'A')+'端接到';
        const row=document.createElement('div');row.className='connection-controls';row.dataset.wireEnd=key;prop.append(caption,row);row.append(input);
        button("接好 "+(i?"B":"A"),()=>{if(!input.value)return notify("先選擇接線對象。",true);change(doc=>{if(!M.attach(doc,wire.id,key,input.value))throw new Error("導線太短；移近元件或用另一條線接長");});},false,false,row);
        button("拔開 "+(i?"B":"A"),()=>unplug(wire.id,key),!M.attached(d,wire,key),false,row);
      });
      if(wireAllowed())prop.insertAdjacentHTML('beforeend','<p class="note connection-legend">接合接頭：接好　分離接頭：拔開</p>');
      button("整理線形",()=>tidy(wire.id),!wireAllowed());
    }else if(selection?.kind==="port"||selection?.kind==="junction"){
      const endpoint=selection.kind==="junction"?selection.id+":p":selection.id;$("selectionTitle").textContent=portName(endpoint);if(profile.ui.readings){prop.innerHTML=readings([["相對電勢",analysis.potentials[endpoint],"V"]])+referenceNote(endpoint);if(probeResult)prop.innerHTML+=readings([["第一點 − 第二點",probeResult.voltage,"V"]]);}if(profile.ui.probe)button("設為 0 V",()=>change(doc=>doc.display.reference=endpoint),readOnly);
      d.wires.filter(w=>w.from===endpoint||w.to===endpoint).forEach(w=>button("選導線 "+w.id,()=>{selection={kind:"wire",id:w.id};render();}));
    }else{$("selectionTitle").textContent="電路概覽";prop.innerHTML=`<p class="note">${d.components.length} 個元件 · ${d.wires.length} 條導線<br>取線 → 拿端點接好 → 拿線身彎曲。</p>`;if(profile.ui.readings&&probeResult)prop.innerHTML+=readings([["第一點 − 第二點",probeResult.voltage,"V"]]);}
    for(const diagnostic of analysis.diagnostics){const p=document.createElement("p");p.className="diagnostic";p.textContent=diagnostic.message;prop.append(p);}
    const list=$("wireList");list.replaceChildren();d.wires.forEach(w=>{const row=document.createElement("div");row.className="wire-row";const b=document.createElement("button");b.textContent=w.id+" · "+portName(w.from)+" → "+portName(w.to);b.onclick=()=>{selection={kind:"wire",id:w.id};render();focusPoint(G.along(routes[w.id],G.length(routes[w.id])/2));};const del=document.createElement("button");del.className="delete";del.textContent="×";del.setAttribute("aria-label","刪除導線 "+w.id);del.onclick=()=>{cancel();change(doc=>M.remove(doc,w.id));};row.append(b);if(wireAllowed())row.append(del);list.append(row);});
  }
  function relayReadings(c,r){return readings([['線圈兩端電壓',r.voltage,'V'],['線圈電流',r.current===null?null:r.current*1000,'mA'],['觸點支路電流',r.contactCurrent,'A'],['線圈功率',r.power,'W']])+'<p class="note">'+(r.contact===null?'銜鐵移動中 · 兩邊斷開':r.contact==='e'?'已吸合 · 接下觸點':'未吸合 · 接上觸點')+'</p>';}
  function componentReadings(id) { const c = current().components.find((c) => c.id === id), r = analysis.components[id]; if (!c || !r) return ""; if(c.type==='relay')return relayReadings(c,r); const isRheo=c.type==='rheostat',g=c.type==='galvanometer';const items = [[isRheo?'A–P 電壓':"兩端電壓", r.voltage, "V"], [c.type === "battery" ? "向外供出電流" : R.dualMeter(c)?'所接正極 → − 電流':isRheo?'A → P 電流':g?"+ → − 電流":"a → b 電流", c.type === "battery" && r.current !== null ? -c.params.polarity * r.current : g&&Number.isFinite(r.current)?r.current*1e6:r.current, g?'μA':"A"], [c.type === "battery" ? "端口輸出功率" : "吸收功率", c.type === "battery" ? r.delivered : r.power, "W"]]; if (c.type === "battery") items.push(["內阻發熱", r.internalPower, "W"], ["電源總供能", r.sourcePower, "W"]); if (c.type === "lamp") items.push(["工作電阻", r.resistance, "Ω"]);if(isRheo){items.push(['A–P 電阻',R.effectiveResistance(c),'Ω']);if(c.params.terminals>2)items.push(['P–B 電阻',c.params.resistance*(1-c.params.position),'Ω'],['A–B 電壓',analysis.voltage(id+':a',id+':c'),'V']);} if (r.unit) items.push(["儀表讀值", g&&Number.isFinite(r.reading)?r.reading*1e6:r.reading, g?'μA':r.unit]);if(R.dualMeter(c)||g)items.push([g?'滿偏電流':'目前量程',g?r.range*1e6:r.range,g?'μA':r.unit],['每小格',g?r.division*1e6:r.division,g?'μA':r.unit]);return readings(items); }
  function inspectMeter(c=selectedComponent()){if(!c||!R.dualMeter(c)&&c.type!=='galvanometer')return;meterPreview=null;$('preview').hidden=true;const r=analysis.components[c.id],g=c.type==='galvanometer',factor=g?1e6:1,unit=g?'μA':r.unit;$('meterTitle').textContent=g?'靈敏電流計刻度':'雙量程錶盤';$('meterDetail').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g?'-50 -45 100 90':'-78 -85 156 119'}" aria-label="${V.esc(c.label)}刻度">${g?V.galvanometerDial(c,r,history.get().display.values):V.dualDial(c,r,history.get().display.values)}</svg><p>${rich([c.label+' · ',...(g?['中心零，滿偏 ±',Q.quantity(r.range*factor,unit)]:r.activePort?['接 ',Q.quantity(r.range,r.unit),' 孔']:['未選單一量程'])])}<br>${rich([V.statusText(r)?V.statusText(r)+'；':'','每小格 ',Q.quantity(r.division*factor,unit),'；負刻度至 ',Q.quantity(r.minimum*factor,unit)])}</p>`;$('meterDialog').showModal();updateMeterNeedles();}

  function portName(id){const d=history.get(),[cid,key]=id.split(":"),c=d.components.find(c=>c.id===cid);if(c)return c.label+" "+R.ports(c).find(p=>p.key===key)?.label;return M.degree(d,id)>1?"共接點 "+cid:"懸空線端 "+cid;}
  function quickParameter(binding=selection){
    if(!profile.ui.quickParameters||!binding)return null;
    const d=history.get(),c=d.components.find(c=>c.id===binding.id);if(!c)return null;
    const p=R.primaryParameter(c);return p&&(!binding.key||binding.key===p.key)&&allow(d,c,'params',p.key)?{c,p}:null;
  }
  function renderQuickParameters(){
    const controls=[$('quickValue'),$('quickMinus'),$('quickPlus')];
    // Selection is set on pointerdown. Keep the existing footer size until
    // release so ResizeObserver cannot cancel a newly started component drag.
    if(drag||cameraGesture||touches.size){controls.forEach(e=>e.disabled=true);return;}
    const selected=selectedComponent();$('hint').parentElement.classList.toggle('has-meter',!!selected&&(R.dualMeter(selected)||selected.type==='galvanometer'));
    if(document.activeElement===$('quickValue')&&quickBinding?.id===selection?.id&&quickParameter(quickBinding))return;
    const data=quickParameter();$('quickParameters').hidden=!data;
    $('hint').parentElement.classList.toggle('has-quick',!!data);quickBinding=data?{id:data.c.id,key:data.p.key}:null;
    controls.forEach(e=>e.disabled=!data);$('quickValue').removeAttribute('aria-invalid');
    if(!data){$('quickValue').value='';$('quickValue').removeAttribute('data-param');return;}
    const {c,p}=data,label=c.label+' · '+p.label;
    $('quickName').textContent=label;$('quickName').title=label;$('quickParameters').setAttribute('aria-label',label);
    $('quickLabel').textContent=label+(p.unit?' · '+p.unit:'');$('quickUnit').innerHTML=p.unit?rich(Q.unit(p.unit)):'';
    $('quickValue').value=Number((p.value*p.factor).toPrecision(12));$('quickValue').min=p.min*p.factor;$('quickValue').max=p.max*p.factor;
    const numeric=$('quickValue').value,quantity={text:numeric+(p.unit?' '+p.unit:''),tex:numeric.replace(/e([+-]?\d+)$/i,'\\times10^{$1}')+(p.unit?'\\,'+Q.unit(p.unit).tex:'')};
    const readoutWidth=Math.max(64,Math.ceil(Q.measure(quantity.tex,16).width)+12);$('quickReadout').innerHTML=Q.html(quantity);$('quickValue').parentElement.style.width=readoutWidth+'px';
    $('hint').parentElement.classList.toggle('has-wide-param',readoutWidth>64);
    $('quickValue').dataset.param=p.key;$('quickValue').title=label;
    for(const [id,direction]of [['quickMinus',-1],['quickPlus',1]]){
      $(id).disabled=direction<0?p.value<=p.min:p.value>=p.max;
      $(id).title=(direction<0?'減少':'增加')+p.label;$(id).setAttribute('aria-label',$(id).title);
    }
  }
  function setQuickParameter(value,binding=quickBinding){
    const data=quickParameter(binding);if(!data)return false;const {c,p}=data;
    if(!Number.isFinite(value)||value<p.min||value>p.max){renderQuickParameters();$('quickValue').setAttribute('aria-invalid','true');notify(['請輸入 ',Q.quantity(p.min*p.factor,p.unit),' 至 ',Q.quantity(p.max*p.factor,p.unit),'。'],true);return false;}
    const changed=execute({type:'setParam',id:c.id,key:p.key,value});
    if(changed||value===p.value){notify([c.label+' · '+p.label+'：',Q.quantity(value*p.factor,p.unit)]);$('canvasNotice').hidden=true;}
    return changed;
  }
  $('quickValue').onchange=()=>{const data=quickParameter(quickBinding);if(data)setQuickParameter($('quickValue').valueAsNumber/data.p.factor);};
  $('quickValue').oninput=()=>{if($('quickValue').hasAttribute('aria-invalid'))$('canvasNotice').hidden=true;$('quickValue').removeAttribute('aria-invalid');};
  on($('quickValue'),'keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('quickValue').blur();}});
  for(const [id,direction]of [['quickMinus',-1],['quickPlus',1]])$(id).onclick=()=>{const data=quickParameter(quickBinding);if(data)setQuickParameter(R.stepPrimaryParameter(data.c,direction));};
  function connectionLabel(id){const [cid,key]=id.split(":"),c=current().components.find(c=>c.id===cid);if(!c||!R.dualMeter(c))return[portName(id)];
    return key==="b"?[c.label+" · 共用 − 孔"]:[c.label+" · +",Q.quantity(key==="c"?c.params.range/5:c.params.range,c.type==="ammeter"?"A":"V")," 孔"];}
  function rotate(id,direction=1){const c=history.get().components.find(c=>c.id===id);if(!c||!allow(history.get(),c,"rotate"))return;cancel();if(change(doc=>M.rotateComponent(doc,id,direction)))notify("元件已旋轉，所連導線已自動拉直。");}
  function flipMeter(id){cancel();if(change(doc=>M.flipMeter(doc,id)))notify('接孔已左右換位，接線保持連接。');}
  function unplug(id,key){cancel();change(doc=>{M.detach(doc,id,key);selection={kind:"wireend",id,end:key};});notify("已拔開這一端，導線留在畫布，可重新接線。");}
  function straighten(id){cancel();if(change(doc=>M.straightenWire(doc,id)))notify("導線已拉直，兩端接線保持不變；可再拿線身彎曲。");}
  function tidy(id){cancel();change(doc=>{doc.wires.filter(w=>!id||w.id===id).forEach(w=>{const points=G.route(doc,w),clean=G.smooth(G.simplify(points,12));const fitted=G.fitLength(G.resample(clean,10),w.length);if(!fitted)throw new Error('導線已拉盡；移近端點後再整理線形。');w.shape="free";w.via=fitted.slice(1,-1).map(p=>({x:p.x,y:p.y}));});});}
  function takeWire(){if(!wireAllowed())return false;cancel();panMode=false;probeMode=false;const ok=change(doc=>{const x=camera.x+surface.clientWidth/(2*camera.scale),y=camera.y+surface.clientHeight/(2*camera.scale);let dy=0;while(doc.wires.some(w=>{const points=G.route(doc,w),mid=G.along(points,G.length(points)/2);return Math.hypot(mid.x-x,mid.y-y-dy)<45;}))dy+=45;const w=addWire(doc,x,y+dy);selection={kind:"wire",id:w.id};});if(ok)notify("直線導線已取出。拿端點時另一端固定；拿線身可搬整條，接好一端後可彎曲。");}
  $("quickWire").onclick=takeWire;
  on($("addWire"),'click',e=>{if(e.detail&&$("addWire").suppressAddClick){$("addWire").suppressAddClick=false;return;}takeWire();});
  $("cableCount").onchange=()=>change(doc=>{doc.cables.count=$("cableCount").valueAsNumber;});$("cableLength").onchange=()=>change(doc=>{doc.cables.length=Number($("cableLength").value);});
  $("cableResistance").onchange=()=>change(doc=>{doc.cables.resistance=$("cableResistance").valueAsNumber;});
  function moveObject(base,kind,id,dx,dy){const candidate=f=>{const d=M.clone(base),item=(kind==="body"?d.components:d.junctions).find(x=>x.id===id);item.x+=dx*f;item.y+=dy*f;if(!M.reconcile(d,base))return null;try{M.validate(d);return d;}catch{return null;}};let d=candidate(1);if(d)return {doc:d,limited:false};let low=0,high=1;for(let n=0;n<28;n++){const mid=(low+high)/2;if(candidate(mid))low=mid;else high=mid;}return {doc:candidate(low),limited:true};}
  on(document,"pointerdown",e=>{
    if(!owned(e)){if(activeHost===host)activeHost=null;return;}
    if(host.contains(e.target))activeHost=host;
    // Commit the old field before selection re-renders it or a touch is registered.
    if(surface.contains(e.target)&&!$("preview").contains(e.target)&&(document.activeElement===$('quickValue')||$("properties").contains(document.activeElement)))document.activeElement.blur();
    if(!$("preview").contains(e.target)){meterPreview=null;$("preview").hidden=true;}
    if(e.pointerType==="touch"){
      if(drag&&drag.pointerType!=="touch")cancel();
      // A fresh primary touch means any previous physical touch sequence has ended.
      if(e.isPrimary&&touches.size){cancel();touches.clear();touchOrigin=null;touchBlocked=false;render(false);}
      const central=surface.contains(e.target)&&!$("preview").contains(e.target);
      if(!touches.size){touchBlocked=false;touchOrigin=central?{camera:{...camera},autoFit,selection:selection&&M.clone(selection)}:null;}
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY,downX:e.clientX,downY:e.clientY,moved:false,central,target:e.target.closest(".hit")});
      if(touches.size===2&&!touchBlocked&&[...touches.values()].every(p=>p.central)){startCameraGesture();return;}
      if(touches.size>1){if(drag||cameraGesture||[...touches.values()].some(p=>p.central)){cancel();notify(touches.size>2?"已取消雙指操作；放開手指後可再操作。":[...touches.values()].every(p=>p.central)?"請先放開手指，再開始雙指操作。":"畫布外的第二指已取消本次拖動。");}else touchBlocked=true;}
    }else if((drag&&e.pointerId!==drag.pointerId)||cameraGesture)cancel();
  },true);
  on(document,"pointermove",e=>{
    if(!owned(e))return;
    const p=touches.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;p.moved||=Math.hypot(p.x-p.downX,p.y-p.downY)>6;
    // Reacquire only on a live move, never inside lostcapture while a lift is dispatching.
    if(touchBlocked&&!cameraGesture&&p.central&&e.buttons&&!surface.hasPointerCapture(e.pointerId))surface.setPointerCapture(e.pointerId);
    if(cameraGesture&&cameraGesture.ids.includes(e.pointerId))moveCameraGesture();
  },true);
  on(document,"pointerup",e=>{
    if(!owned(e))return;
    if(touches.get(e.pointerId)?.central&&touches.get(e.pointerId).moved)suppressClick=true;
    if(cameraGesture?.ids.includes(e.pointerId)){cameraGesture=null;suppressClick=true;render(false);}
    releaseTouches([e.pointerId]);
    touches.delete(e.pointerId);if(!touches.size){const blocked=touchBlocked;touchBlocked=false;touchOrigin=null;if(blocked)render(false);}
  },true);
  on(document,"pointercancel",e=>{
    if(!owned(e))return;
    touches.delete(e.pointerId);if(cameraGesture?.ids.includes(e.pointerId)||drag?.pointerId===e.pointerId)cancel();
    if(!touches.size){const blocked=touchBlocked;touchBlocked=false;touchOrigin=null;if(blocked)render(false);}
  },true);
  function startPan(e,quick){
    if(quick){e.preventDefault();spacePanUsed||=spacePan;}
    drag={kind:"pan",quick,pointerId:e.pointerId,target:surface,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,base:{...camera},pointerType:e.pointerType,selectionBefore:selection&&M.clone(selection),autoFitBefore:autoFit,moved:false};
    $("canvasNotice").hidden=true;surface.setPointerCapture(e.pointerId);render(false);
  }
  on(surface,"pointerdown",e=>{
    releasedMeta=null;blankMouseDown=null;
    if($("preview").contains(e.target))return;
    if(touchBlocked||cameraGesture||(e.pointerType==="touch"&&!e.isPrimary))return;
    const quick=e.pointerType==="mouse"&&(e.button===1||(e.button===0&&spacePan));if(e.button!==0&&!quick)return;suppressClick=false;
    if(panMode||quick){startPan(e,quick);return;}
    const t=e.target.closest(".hit"),meta=t?.meta,d=history.get();
    if(!t&&e.pointerType==="mouse")blankMouseDown=e;
    if(!meta||meta.kind==="port")return;if(["wire","wireend","junction"].includes(meta.kind)&&!wireAllowed())return;if(probeMode&&meta.kind==="wireend")return;
    let readOnly=false;if(meta.kind==="body"||meta.kind==="slider"){const c=d.components.find(c=>c.id===meta.id);if(!allow(d,c,meta.kind==="slider"?"params":"move",meta.kind==="slider"?"position":undefined)){if(meta.kind!=="body"||e.pointerType!=="touch"||!readableMeter(d,c))return;readOnly=true;}}
    const before=selection&&M.clone(selection);selection={...meta};drag={...meta,pointerId:e.pointerId,pointerType:e.pointerType,target:t,down:world(e.clientX,e.clientY),x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,baseDoc:M.clone(d),selectionBefore:before,moved:false,snap:null,limited:false};
    if(readOnly)drag.kind="meterread";
    if(meta.kind==="wire"){const w=d.wires.find(w=>w.id===meta.id);drag.wholeWire=!M.attached(d,w,"from")&&!M.attached(d,w,"to");}
    if(meta.kind==="wireend")drag.start=M.endpoints(d).get(d.wires.find(w=>w.id===meta.id)[meta.end]);t.setPointerCapture(e.pointerId);render();
  });
  on(surface,"mousedown",e=>{
    // Native mousedown supplies the OS double-click count; pointerdown supplies capture ID.
    if(e.button===0&&e.detail===2&&blankMouseDown){e.preventDefault();startPan(blankMouseDown,true);}
    blankMouseDown=null;
  });
  on(surface,"pointermove",e=>{
    if(touchBlocked||!drag||e.pointerId!==drag.pointerId)return;drag.lastX=e.clientX;drag.lastY=e.clientY;const p=world(e.clientX,e.clientY);drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;
    if(drag.kind==="pan"){autoFit=false;camera.x=drag.base.x-(e.clientX-drag.x)/camera.scale;camera.y=drag.base.y-(e.clientY-drag.y)/camera.scale;render(false);return;}if(!drag.moved)return;
    if(drag.kind==="meterread"){render(false);return;}
    const dx=p.x-drag.down.x,dy=p.y-drag.down.y;previewDoc=M.clone(drag.baseDoc);drag.snap=null;drag.limited=false;
    if(drag.kind==="wireend"){
      const desired={x:drag.start.x+dx,y:drag.start.y+dy},result=M.moveWireEnd(previewDoc,drag.id,drag.end,desired);drag.limited=result.limited;
      const candidate=resolveSnap(previewDoc,drag.id,drag.end,desired);if(candidate){const snapped=M.clone(previewDoc);if(M.attach(snapped,drag.id,drag.end,candidate.id)){previewDoc=snapped;drag.snap=candidate;drag.limited=false;}}
      drag.focus=M.endpoints(previewDoc).get(previewDoc.wires.find(w=>w.id===drag.id)[drag.end]);
    }else if(drag.kind==="body"||drag.kind==="junction"){
      const old=(drag.kind==="body"?drag.baseDoc.components:drag.baseDoc.junctions).find(x=>x.id===drag.id),desired={x:old.x+dx,y:old.y+dy};
      const snapped=drag.kind==="body"&&wireAllowed()?J.component(drag.baseDoc,drag.id,desired,24/camera.scale):null;
      if(snapped){previewDoc=snapped.doc;drag.snap=snapped.snap;}
      else{const result=moveObject(drag.baseDoc,drag.kind,drag.id,snapGrid(desired.x)-old.x,snapGrid(desired.y)-old.y);previewDoc=result.doc;drag.limited=result.limited;}
      drag.focus=(drag.kind==="body"?previewDoc.components:previewDoc.junctions).find(x=>x.id===drag.id);
    }else if(drag.kind==="slider"){const c=previewDoc.components.find(c=>c.id===drag.id),angle=c.angle*Math.PI/180,local=(p.x-c.x)*Math.cos(angle)+(p.y-c.y)*Math.sin(angle);c.params.position=Math.max(0,Math.min(1,Math.round((local+30)/60*100)/100));drag.focus=p;
    }else if(drag.kind==="wire"){drag.limited=!!M.bendWire(previewDoc,drag.id,drag.down,dx,dy,Math.max(100,110/camera.scale))?.limited;drag.focus=p;
      if(drag.wholeWire){const snapped=snapWholeWire(previewDoc,drag.id);if(snapped){previewDoc=snapped.doc;drag.snap=snapped.snap;drag.limited=false;}}
    }
    try{profile.assertTransition(history.get(),previewDoc,readOnly);}catch{previewDoc=null;return;}analysis=solve(previewDoc);if(drag.limited){$("canvasNotice").textContent="線已拉盡；移近元件，或用另一條線接長。";$("canvasNotice").hidden=false;}render(false);
  });
  on(surface,"pointerup",e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;const done=drag,preview=previewDoc;drag=null;previewDoc=null;const c=history.get().components.find(c=>c.id===done.id);meterPreview=done.pointerType==="touch"&&["body","meterread"].includes(done.kind)&&!done.moved&&readableMeter(history.get(),c)?{id:c.id,side:done.previewSide}:null;$("preview").hidden=true;suppressClick=done.moved||done.quick;
    // Footer reflow may move scene targets before the browser sends click.
    // Keep the original tap target rather than reselecting whatever moved under it.
    releasedMeta=!done.moved&&!done.quick&&done.kind!=="pan"?M.clone(selection):null;
    if(done.target.hasPointerCapture(e.pointerId))done.target.releasePointerCapture(e.pointerId);
    if(preview&&done.moved&&change(doc=>Object.assign(doc,preview)))notify(done.limited?"導線已拉盡；移近元件或用另一條導線接長。":done.snap?done.kind==="body"?["元件已接線：",...connectionLabel(done.snap.id),"。"]:["端點已接好：",...connectionLabel(done.snap.id),"。拖另一端繼續接線。"]:done.kind==="wireend"?"未接上的端點已留在畫布，可再拿起接線。":done.kind==="wire"?"導線位置／線形已更新。":"位置已更新，接線保持連接。");
    render();
  });
  on(surface,"lostpointercapture",e=>{if(drag?.pointerId===e.pointerId||(cameraGesture?.ids.includes(e.pointerId)&&!surface.hasPointerCapture(e.pointerId)))cancel(true);});
  on(window,"blur",()=>{spacePan=false;spacePanUsed=false;cancel();touches.clear();touchOrigin=null;touchBlocked=false;render(false);});
  on(surface,"wheel",e=>{e.preventDefault();if(drag||touches.size)return;
    const unit=e.deltaMode===1?16:e.deltaMode===2?surface.clientHeight:1,dx=e.deltaX*unit,dy=e.deltaY*unit,pan=(panMode||spacePan)&&!e.ctrlKey;
    if(pan?!dx&&!dy:!dy)return;
    meterPreview=null;if(spacePan)spacePanUsed=true;
    // A trackpad pinch emits Ctrl + wheel and keeps zoom ownership, even in hand mode.
    if(pan){autoFit=false;camera.x+=dx/camera.scale;camera.y+=dy/camera.scale;}
    else zoomAt(Math.exp(-Math.max(-600,Math.min(600,dy))*.0015),e.clientX,e.clientY);
    render(false);
  },{passive:false});
  on(surface,"auxclick",e=>{if(e.button===1)e.preventDefault();});
  on(surface,"click",e=>{
    if($("preview").contains(e.target))return;
    const meta=e.detail&&releasedMeta?releasedMeta:e.target.closest(".hit")?.meta;releasedMeta=null;
    if(suppressClick&&e.detail)return;if(panMode)return;
    if(meta){if(probeMode&&["port","junction","wireend"].includes(meta.kind)){probePort(meta.kind==="junction"?meta.id+":p":meta.kind==="wireend"?history.get().wires.find(w=>w.id===meta.id)[meta.end]:meta.id);return;}
      selection={...meta};if(meta.kind==="body"&&selectedComponent()?.type==="switch"&&allow(history.get(),selectedComponent(),"switch"))change(doc=>{const c=doc.components.find(c=>c.id===meta.id);c.params.closed=!c.params.closed;});else render();
    }else{selection=null;render();}
  });
  function undo(redo=false){if(readOnly||!profile.undo)return false;cancel();const changed=redo?history.redo():history.undo();selection=null;analysis=solve(history.get());if(changed&&autoFit)fit();render();if(changed)emitChange();notify(redo?"已重做。":"已復原。");return changed;}
  on(window,"keydown",e=>{
    if(!host.contains(e.target)&&!(e.target===document.body&&activeHost===host))return;
    const typing=/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.target.isContentEditable;if(e.key==="Escape"){cancel();probeFirst=null;notify("已取消目前拖動。");return;}if(typing)return;
    if((e.code==="Space"||e.key===" ")&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!host.querySelector("dialog[open]")&&(!e.target.closest("button,a")||surface.contains(e.target))){
      if(!spacePan){spacePan=true;spacePanUsed=false;surface.classList.add("quick-pan");}
      // A focused scene button accepts Space on release unless navigation used it.
      if(!e.target.closest("button"))e.preventDefault();return;
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo(e.shiftKey);return;}
    if(host.querySelector("dialog[open]"))return;
    const focused=e.target.meta;if(focused)selection={...focused};if(e.key.toLowerCase()==="r"&&selection?.kind==="body"){e.preventDefault();rotate(selection.id,e.shiftKey?-1:1);}
    if(["Delete","Backspace"].includes(e.key)&&selection&&selection.kind!=="port"){e.preventDefault();const id=selection.id;cancel();change(doc=>M.remove(doc,id));}
    const offset={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!offset||!selection)return;e.preventDefault();const [dx,dy]=offset;
    if(selection.kind==="wireend"){const id=selection.id,key=selection.end;change(doc=>{const w=doc.wires.find(w=>w.id===id),p=M.endpoints(doc).get(w[key]);M.moveWireEnd(doc,id,key,{x:p.x+dx,y:p.y+dy});});}
    else if(selection.kind==="wire"){change(doc=>M.bendWire(doc,selection.id,selection.point||G.along(routes[selection.id],G.length(routes[selection.id])/2),dx,dy));}
    else if(selection.kind==="body"||selection.kind==="junction"){change(doc=>{if(selection.kind==="body"&&!allow(doc,doc.components.find(c=>c.id===selection.id),"move"))throw new Error("此元件已固定");Object.assign(doc,moveObject(doc,selection.kind,selection.id,dx,dy).doc);});}
    else if(selection.kind==="slider"){change(doc=>{const c=doc.components.find(c=>c.id===selection.id);if(!allow(doc,c,"params","position"))throw new Error("參數已固定");c.params.position=Math.max(0,Math.min(1,c.params.position+(dx+dy)/400));});}
  });
  on(window,"keyup",e=>{
    if(!spacePan&&!host.contains(e.target))return;if(e.code!=="Space"&&e.key!==" ")return;if(spacePanUsed)e.preventDefault();spacePan=false;spacePanUsed=false;surface.classList.remove("quick-pan");});
  $("copySelected").onclick=()=>{const c=selectedComponent();if(!c||!profile.palette.some(e=>e.type===c.type&&profile.canAdd(e,history.get(),readOnly)))return;cancel();change(doc=>{const copy=addComponent(doc,c.type,c.x+140,c.y+80,c.params);copy.angle=c.angle;if(R.dualMeter(c))copy.mirrored=c.mirrored;if(allow(doc,copy,'label'))copy.label=(c.label+" 副本").slice(0,40);selection={kind:"body",id:copy.id};});};
  $("focusSelected").onclick=()=>{const w=selectedWire(),c=selectedComponent(),j=history.get().junctions.find(j=>j.id===selection?.id);if(w)focusPoint(G.along(routes[w.id],G.length(routes[w.id])/2));else if(c||j)focusPoint(c||j);};
  $('straightenSelected').onclick=()=>{if(selectedWire())straighten(selection.id);};$('closePreview').onclick=()=>{meterPreview=null;$('preview').hidden=true;};
  $('inspectMeter').onclick=()=>inspectMeter();$('closeMeter').onclick=()=>$('meterDialog').close();
  $('flipMeterSelected').onclick=()=>{if(selectedComponent())flipMeter(selection.id);};
  $("detachFrom").onclick=()=>{const w=selectedWire();if(w)unplug(w.id,"from");};$("detachTo").onclick=()=>{const w=selectedWire();if(w)unplug(w.id,"to");};
  $("deleteSelected").onclick=()=>{const id=selection?.id;if(!id||selection.kind==="port")return;cancel();change(doc=>M.remove(doc,id));notify("已刪除；刪線歸還庫存，復原可還原。");};$("rotateSelected").onclick=()=>{if(selectedComponent())rotate(selection.id);};$("rotateCounterSelected").onclick=()=>{if(selectedComponent())rotate(selection.id,-1);};$("undo").onclick=()=>undo();$("redo").onclick=()=>undo(true);
  function loadDocument(doc){if(destroyed)throw new Error("編輯器已卸載");if(readOnly)throw new Error("目前為只讀，不能載入電路");const imported=D.importDocument(doc),valid=profile.assertSnapshot(imported.document);cancel();const before=history.get();history.replace(valid);wireCurrents.clear();potentialDirections.clear();labelOptions.previous=null;flowOffsets.clear();flowScales.clear();needleStates.clear();relayStates.clear();analysis=solve(history.get());selection=null;wireMode=false;probeFirst=null;probeResult=null;autoFit=true;fit();render();if(before!==history.get())emitChange();if(imported.removedMeasurements)notify("已載入電路；舊檔的數據記錄不再提供，沒有載入。原檔保持不變。");return imported.removedMeasurements;}
  $("preset").onchange=()=>{loadDocument(P.create($("preset").value));notify("已載入範例，可取線、改接及量測。");};$("realView").onclick=()=>change(doc=>doc.display.view="real");$("schematicView").onclick=()=>change(doc=>doc.display.view="schematic");
  ["flow","potential","names","values","projection"].forEach(id=>$(id).onchange=()=>change(doc=>doc.display[id]=$(id).type==="checkbox"?$(id).checked:$(id).value));$("pause").onclick=()=>{paused=!paused;lastTime=0;relayLastTime=performance.now();render(false);};$("slowMotion").onclick=()=>{slowMotion=!slowMotion;lastTime=0;relayLastTime=performance.now();render(false);};
  Object.keys(M.quantityDefaults).filter(id=>$(id)).forEach(id=>$(id).onchange=()=>change(doc=>doc.display.quantities[id]=$(id).checked));
  $("mode").onchange=()=>{const value=$("mode").value;cancel();change(doc=>doc.policy.mode=value);};["allowRotate","allowParams","allowSwitch"].forEach(id=>$(id).onchange=()=>{const value=$(id).checked;cancel();change(doc=>doc.policy[id]=value);});
  $("probe").onclick=()=>{cancel();probeMode=!probeMode;probeFirst=null;probeResult=null;panMode=false;wireMode=false;render();notify(probeMode?"點一個端子看電勢，再點另一個量兩點電壓。":"取線後拖端點接線；拿線身搬動或彎曲。");};
  $("pan").onclick=()=>{cancel();panMode=!panMode;probeMode=false;wireMode=false;render();notify(panMode?"手掌工具：拖動畫布；觸控板可雙指滑動，捏合縮放。再按一次返回拿取元件。":"已返回拿取模式，可拿導線端點或線身。");};
  $('pickWire').onclick=()=>{cancel();wireMode=!wireMode;panMode=false;probeMode=false;render();notify(wireMode?'拿導線：重疊時優先拿線身或線端。再按一次返回拿元件。':'已返回拿取元件與導線。');};
  host.querySelectorAll("[data-camera]").forEach(b=>b.onclick=()=>{cancel();const action=b.dataset.camera,r=surface.getBoundingClientRect();if(action==="fit"){autoFit=true;fit();}else{autoFit=false;if(["in","out"].includes(action))zoomAt(action==="in"?1.2:1/1.2,r.left+r.width/2,r.top+r.height/2);else{const delta=100/camera.scale;if(action==="left")camera.x-=delta;if(action==="right")camera.x+=delta;if(action==="up")camera.y-=delta;if(action==="down")camera.y+=delta;}}render(false);});
  $("panelToggle").onclick=()=>{cancel();const hidden=$("app").classList.toggle("panel-hidden");$("panelToggle").setAttribute("aria-expanded",String(!hidden));$("panelToggle").setAttribute("aria-label",hidden?"展開操作面板":"收起操作面板");later(()=>{if(autoFit)fit();render(false);});};
  $('showWireCurrents').onclick=()=>setDiagramDisplay('wireCurrents',undefined,true);$('hideWireCurrents').onclick=()=>setDiagramDisplay('wireCurrents',undefined,false);
  $('showPotentialDirections').onclick=()=>setDiagramDisplay('potentialDirections',undefined,true);$('hidePotentialDirections').onclick=()=>setDiagramDisplay('potentialDirections',undefined,false);
  $("clearAll").onclick=()=>{cancel();selection=null;change(doc=>{if(doc.policy.mode!=="free")throw new Error("固定模式可用「只移除導線」重新接線。");const cables=doc.cables;Object.keys(doc).forEach(key=>delete doc[key]);Object.assign(doc,M.empty(),{cables});});};
  $("clearWires").onclick=()=>{cancel();change(doc=>{doc.wires=[];doc.junctions=[];if(doc.display.reference&&!M.endpoints(doc).has(doc.display.reference))doc.display.reference=null;});};$("autoRoute").onclick=()=>tidy();
  function download(text, name, type) { const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  $("save").onclick = () => { try { download(D.encode(history.get()), "電路工作台.json", "application/json"); notify("已匯出電路檔，可用「開啟」繼續編輯。"); } catch (e) { notify(e.message, true); } };
  $("saveTemplate").onclick = () => { try { download(D.encode(D.template(history.get())), "固定元件接線模板.json", "application/json"); } catch (e) { notify(e.message, true); } };
  $("open").onclick = () => $("fileInput").click();
  $("fileInput").onchange = async () => { const file = $("fileInput").files[0]; $("fileInput").value = ""; if (!file) return; try { if (file.size > M.limits.bytes) throw new Error("電路檔超出 256 KiB 限制"); const retired=loadDocument(await file.text()); if(!retired)notify("已開啟電路檔；按復原可返回原電路。"); } catch (e) { notify(e.message, true); } };
  $("exportSvg").onclick = () => { const d = history.get(), labelBounds=V.labels(d,analysis,1,routes,null,{wireCurrents,potentialDirections}).flatMap(p=>[{x:p.box.left,y:p.box.top},{x:p.box.right,y:p.box.bottom}]), points = [...labelBounds, ...M.endpoints(d).values(), ...d.components.flatMap((c) => [{ x: c.x - 90, y: c.y - 100 }, { x: c.x + 90, y: c.y + 140 }]), ...Object.values(routes).flat()]; if (!points.length) return notify("先加入元件再匯出電路圖。"); const x = Math.min(...points.map((p) => p.x)) - 20, y = Math.min(...points.map((p) => p.y)) - 20, w = Math.max(...points.map((p) => p.x)) - x + 20, h = Math.max(...points.map((p) => p.y)) - y + 20; const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${V.scene(d, analysis, 1, routes,null,false,null,{wireCurrents,potentialDirections})}${V.flow(d, analysis, routes, animationTime, 1, flowOffsets,flowContext())}</svg>`; download(content, "電路圖.svg", "image/svg+xml"); };

  $('settings').onclick=()=>{cancel();$('settingsNotice').hidden=true;$('settingsDialog').showModal();$('settings').setAttribute('aria-expanded','true');};
  $('closeSettings').onclick=()=>$('settingsDialog').close();
  on($('settingsDialog'),'close',()=>{$('settings').setAttribute('aria-expanded','false');});
  $("help").onclick=()=>$("helpDialog").showModal();$("closeHelp").onclick=()=>$("helpDialog").close();
  function toolDropPoint(e){
    const at=document.elementFromPoint(e.clientX,e.clientY);
    if(!at||!surface.contains(at)||at.closest('.scroll-strip,.preview,.canvas-notice'))return null;
    const p=world(e.clientX,e.clientY),x=snapGrid(p.x),y=snapGrid(p.y);
    return Math.abs(x)<=M.limits.coordinate&&Math.abs(y)<=M.limits.coordinate?{x,y}:null;
  }
  function bindToolDrag(b,entry=null){
    const canTake=()=>entry?profile.canAdd(entry,history.get(),readOnly):wireAllowed()&&history.get().wires.length<history.get().cables.count;
    b.title=(entry?.label||'導線')+'：點選新增，或用滑鼠／觸控筆拖到畫布';
    // ponytail: pen hover owns this button; use a separate drag handle if concurrent finger scrolling is required.
    on(b,'pointerover',e=>{b.style.touchAction=e.pointerType==='pen'?'none':'';});
    on(b,'pointerleave',()=>{if(drag?.target!==b)b.style.touchAction='';});
    on(b,'pointerdown',e=>{
      if(!['mouse','pen'].includes(e.pointerType)||e.button!==0||!e.isPrimary||touches.size||!canTake())return;
      if(document.activeElement===$('quickValue')||$('properties').contains(document.activeElement))document.activeElement.blur();
      cancel();b.suppressAddClick=false;drag={kind:'palette',entry,pointerId:e.pointerId,pointerType:e.pointerType,target:b,x:e.clientX,y:e.clientY,moved:false,selectionBefore:selection&&M.clone(selection)};
      b.setPointerCapture(e.pointerId);render(false);
    });
    on(b,'pointermove',e=>{
      if(drag?.kind!=='palette'||drag.target!==b||drag.pointerId!==e.pointerId)return;
      drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;if(!drag.moved)return;
      b.suppressAddClick=true;const p=canTake()?toolDropPoint(e):null;
      if(entry)drag.component=p?M.component(history.get(),entry.type,p.x,p.y,entry.params):null;
      else{drag.wirePreview=null;if(p){const candidate=M.clone(history.get()),w=addWire(candidate,p.x,p.y);drag.wirePreview=G.route(candidate,w);}}
      renderGhost();
    });
    on(b,'pointerup',e=>{
      if(drag?.kind!=='palette'||drag.target!==b||drag.pointerId!==e.pointerId)return;
      if(!drag.moved){drag=null;if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId);render(false);return;}
      const p=canTake()?toolDropPoint(e):null;if(p){const fitted=autoFit;autoFit=false;if(!entry){panMode=false;probeMode=false;}if(execute(entry?{type:'addComponent',key:entry.key,...p}:{type:'addWire',...p}))notify(entry?'元件已放到畫布。':'導線已放到畫布。拖動端點接線。');else{autoFit=fitted;render(false);}}else cancel();
    });
    on(b,'lostpointercapture',e=>{if(drag?.target===b&&drag.pointerId===e.pointerId)cancel(true);});
  }
  if(host.contains($('addWire')))bindToolDrag($('addWire'));
  if(profile.ui.palette)for (const entry of profile.palette) {
    const {type}=entry, b=document.createElement('button');b.type='button';b.dataset.add=entry.key;b.entry=entry;
    const sample={type,params:entry.params};
    b.innerHTML=`<span class="icon"><svg viewBox="${sample.type==='relay'?'-84 -64 188 154':R.dualMeter(sample)?'-84 -90 168 180':'-64 -68 128 124'}" aria-hidden="true">${V.body(sample,null,{view:'real',meters:'analog',values:false})}</svg></span><span>${V.esc(entry.label)}</span>`;
    bindToolDrag(b,entry);
    on(b,'click',e=>{if(e.detail&&b.suppressAddClick){b.suppressAddClick=false;return;}if(!profile.canAdd(entry,history.get(),readOnly))return;cancel();const succeeded=change(d=>{
      const x=snapGrid(camera.x+surface.clientWidth/(2*camera.scale)),y=snapGrid(camera.y+surface.clientHeight/(2*camera.scale));let offset=0;
      while(d.components.some(c=>Math.hypot(c.x-x-offset,c.y-y-offset)<100))offset+=40;
      const c=addComponent(d,type,x+offset,y+offset,entry.params);selection={kind:'body',id:c.id};
    });if(succeeded)notify('元件已加入。再取出導線接線，或拖動本體調整位置。');});$('palette').append(b);
  }

  if(matchMedia("(max-width:759px) and (min-height:451px)").matches){$("app").classList.add("panel-hidden");$("panelToggle").setAttribute("aria-expanded","false");$("panelToggle").setAttribute("aria-label","展開操作面板");}
  observer=new ResizeObserver(()=>{const interrupted=!!(drag||previewDoc||cameraGesture);if(interrupted)cancel();if(autoFit&&!interrupted)fit();render(false);});observer.observe(surface);
  function execute(command) {
    if(destroyed)throw new Error('編輯器已卸載');
    if(!command || typeof command.type!=='string')throw new TypeError('命令格式無效');
    if(command.type==='setWireCurrentDisplay')return setDiagramDisplay('wireCurrents',command.id,command.visible);
    if(command.type==='setPotentialDirectionDisplay')return setDiagramDisplay('potentialDirections',command.id,command.visible);
    if(readOnly){notify('目前為只讀，不能修改電路。',true);return false;}
    if(command.type==='undo'||command.type==='redo')return undo(command.type==='redo');
    cancel();
    return change(doc=>{
      const c=doc.components.find(c=>c.id===command.id);
      switch(command.type) {
        case 'addComponent': {
          const entry=profile.palette.find(e=>e.key===command.key);
          if(!entry||!profile.canAdd(entry,doc,readOnly))throw new Error('活動未提供此元件或庫存已用完');
          const added=addComponent(doc,entry.type,command.x,command.y,entry.params);selection={kind:'body',id:added.id};break;
        }
        case 'addWire': {const w=addWire(doc,command.x??camera.x+surface.clientWidth/(2*camera.scale),command.y??camera.y+surface.clientHeight/(2*camera.scale));selection={kind:'wire',id:w.id};break;}
        case 'attach': if(!M.attach(doc,command.id,command.end,command.target))throw new Error('導線太短，不能接到該端點');break;
        case 'detach': M.detach(doc,command.id,command.end);break;
        case 'straighten': M.straightenWire(doc,command.id);break;
        case 'setWireResistance': if(!profile.canSetWireResistance(doc,readOnly))throw new Error('導線電阻已固定');M.setWireResistance(doc,command.id,command.value);break;
        case 'remove': M.remove(doc,command.id);break;
        case 'rotate': M.rotateComponent(doc,command.id,command.direction??1);break;
        case 'flipMeter': M.flipMeter(doc,command.id);break;
        case 'move': {
          if(!c)throw new Error('找不到元件');
          Object.assign(doc,moveObject(doc,'body',c.id,command.x-c.x,command.y-c.y).doc);break;
        }
        case 'setParam': {
          if(!c||!Object.hasOwn(R.get(c.type).params,command.key))throw new Error('找不到指定參數');
          if(c.type==='rheostat'&&command.key==='terminals')M.setTerminals(doc,c.id,command.value);else c.params[command.key]=command.value;break;
        }
        case 'toggleSwitch': if(c?.type!=='switch')throw new Error('找不到開關');c.params.closed=!c.params.closed;break;
        default: throw new Error('不支援的命令：'+command.type);
      }
    });
  }
  const controller=Object.freeze({getDocument:()=>M.clone(history.get()),getAnalysis:()=>{const{voltage,...data}=solve(history.get());return M.clone(data);},voltage:(a,b)=>solve(history.get()).voltage(a,b),exportDocument:()=>D.encode(history.get()),loadDocument,execute,
    applyPolicy(policy){cancel();return change(doc=>doc.policy={...doc.policy,...policy});},onChange(fn){if(destroyed)throw new Error('編輯器已卸載');if(typeof fn!=="function")throw new TypeError("onChange requires a callback");listeners.add(fn);return()=>listeners.delete(fn);},
    setReadOnly(value=true){if(destroyed)throw new Error('編輯器已卸載');if(typeof value!=='boolean')throw new TypeError('只讀狀態必須是布林值');cancel();readOnly=value;host.dataset.readOnly=String(value);render();},
    check(){if(destroyed)throw new Error('編輯器已卸載');if(!profile.check)throw new Error('此活動沒有設定檢查');const doc=M.clone(history.get()),checked=profile.check(doc,solve(doc));if(typeof checked?.passed!=='boolean')throw new Error('檢查結果格式無效');return M.clone(checked);},
    fit(){if(destroyed)throw new Error('編輯器已卸載');cancel();autoFit=true;fit();render(false);},
    destroy(){
      if(destroyed)return;
      cancel();for(const id of touches.keys())if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
      touches.clear();destroyed=true;abort.abort();clearTimeout(noticeTimer);cancelAnimationFrame(frame);observer.disconnect();fullscreen?.destroy();
      listeners.clear();targets.clear();needleStates.clear();flowOffsets.clear();flowScales.clear();wireCurrents.clear();potentialDirections.clear();relayStates.clear();
      for(const dialog of host.querySelectorAll('dialog[open]'))dialog.close();
      // Drop handlers on detached, disabled UI references as well.
      for(const element of Object.values(refs))for(const key of ['onclick','onchange','oninput','onpointercancel'])element[key]=null;
      host.replaceChildren();restoreHost();
      if(activeHost===host)activeHost=null;mounts.delete(host);
    },
    getInteraction:()=>({pending:null,readOnly,destroyed,meterPreview:meterPreview?.id||null,wireCurrents:[...wireCurrents],potentialDirections:[...potentialDirections],dragging:cameraGesture?"camera":drag?.kind||null,selection:selection?M.clone(selection):null,camera:{...camera},panMode,wireMode,probeMode,spacePan,touchCount:touches.size,touchBlocked,snap:drag?.snap?.id||null,limited:!!drag?.limited,lastMessage}),cancel});
  render();function animate(time){if(destroyed)return;
    const rate=slowMotion?.25:1,elapsed=lastTime?Math.max(0,Math.min(.05,(time-lastTime)/1000))*rate:0;lastTime=time;
    const active=!paused&&!document.hidden;if(active)animationTime+=elapsed;
    const relayEligible=active&&!drag&&!previewDoc&&!cameraGesture&&!touches.size,relayElapsed=relayEligible?Math.max(0,(time-relayLastTime)/1000)*rate:0;relayLastTime=time;
    if(relayEligible&&relayStates.size){
      const progress=H.advanceFrame(relayStates,history.get(),analysis,relayElapsed,solve);analysis=progress.result;
      if(progress.switched){render(false);const c=selectedComponent(),reading=$('properties').querySelector('.reading-host');if(c&&reading)reading.innerHTML=componentReadings(c.id);else if(selectedWire()&&!$('properties').contains(document.activeElement))renderProperties();}
      else if(progress.moved){for(const [id,state]of relayStates){const r=analysis.components[id],c=history.get().components.find(c=>c.id===id);r.position=state.position;const body=$('scene').querySelector('[data-relay="'+id+'"]');if(body)body.outerHTML=V.body(c,r,history.get().display);}}
    }
    V.advanceFlow(flowOffsets,current(),analysis,active?elapsed:0,flowContext());
    if(N.advance(needleStates,active?elapsed:0))updateMeterNeedles();
    // A captured grip may stay still between pointer events; its live circuit
    // must keep displaying the same RAF phase that the accumulator advances.
    if(!document.hidden&&!cameraGesture)$("flowLayer").innerHTML=V.flow(current(),analysis,routes,animationTime,camera.scale,flowOffsets,flowContext());
    frame=requestAnimationFrame(animate);
  }frame=requestAnimationFrame(animate);
    mounts.set(host,controller);
    return controller;
    } catch(error) {
      abort.abort();cancelAnimationFrame(frame);observer?.disconnect();fullscreen?.destroy();mounts.delete(host);host.replaceChildren();restoreHost();throw error;
    }
  }
  root.CircuitEditor=Object.freeze({mount});
})(window);
