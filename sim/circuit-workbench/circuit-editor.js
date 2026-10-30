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
  const M=window.CircuitModel,R=window.CircuitRegistry,S=window.CircuitSolver,D=window.CircuitDocument,G=window.CircuitRouting,V=window.CircuitRenderer,P=profile.analysis==='household'?window.CircuitHouseholdPresets:profile.analysis==='transient'?window.CircuitACPresets:window.CircuitPresets,Q=window.CircuitMath,N=window.CircuitMeterMotion,J=window.CircuitSnapping,H=window.CircuitRelayMotion;
  const surface=$("surface"),svg=$("circuitSvg"),hitLayer=$("hitLayer");
  const history=M.history(profile.initial),camera={x:0,y:0,scale:1},listeners=new Set(),targets=new Map();
  const transient=profile.analysis==='transient',household=profile.analysis==='household',timed=transient||household,Backend=household?root.CircuitHousehold:root.CircuitTransient,Family=root.CircuitHouseholdComponents,reactiveReadouts=transient?new root.CircuitACDisplay.Readouts():null,analysisListeners=new Set(),sessionHistory=new WeakMap();
  const stageBottom=$('stage').querySelector('.stage-bottom'),shortHousehold=household?matchMedia('(max-width:559px) and (max-height:600px)'):null;
  function reflowControls(){
    if(!household)return;
    const inPanel=shortHousehold.matches&&$('panel').isConnected&&!$('app').classList.contains('panel-hidden'),parent=inPanel?$('panel'):$('stage');
    if(stageBottom.parentElement===parent)return;
    const focused=stageBottom.contains(document.activeElement)?document.activeElement:null;
    if(inPanel){parent.prepend(stageBottom);parent.scrollTop=0;}else parent.append(stageBottom);
    focused?.focus({preventScroll:true});
  }
  let session=timed?new Backend.Session(history.get()):null,sessionDocument=history.get(),acUI=null,familyUI=null,lastSessionChange=null,paramSession=null,unsubscribePreview=null;
  const forwardAnalysis=result=>{const {voltage,...data}=result;for(const fn of analysisListeners)try{fn(M.clone(data));}catch(e){console.error('CircuitEditor analysis callback failed',e);}};
  let unsubscribeAnalysis=session?.subscribe(forwardAnalysis);
  const wireCurrents=new Set(),potentialDirections=new Set(),labelOptions={previous:null,exclusions:[],idPrefix:prefix,wireCurrents,potentialDirections,fields:profile.ui.field,mathNames:profile.ui.mathNames},flowOffsets=new Map(),flowScales=new Map(),needleStates=new Map(),relayStates=new Map();
  const flowContext=()=>(drag||previewDoc)?new Map(flowScales):flowScales;
  function clearFieldScales(){for(const key of flowScales.keys())if(key.startsWith("field:"))flowScales.delete(key);}
  const solve=doc=>{if(timed){if(doc!==history.get()){if(doc===previewDoc&&(transient||paramSession))return (paramSession||session).read();return JSON.stringify(doc)===JSON.stringify(history.get())?session.read():session.preview(doc);}if(doc!==sessionDocument){lastSessionChange=session.update(doc);if(lastSessionChange==='restarted')clearFieldScales();sessionDocument=doc;}return session.read();}H.sync(relayStates,history.get());return S.solve(doc,relayStates);};
  let analysis=solve(history.get()),routes={},geometryKey="",selection=null,selectedConnection=null,drag=null,previewDoc=null,meterPreview=null,panMode=false,wireMode=false,probeMode=false,probeFirst=null,probeResult=null,autoFit=true,lastMessage="",suppressClick=false;
  let quickBinding=null,releasedMeta=null,blankMouseDown=null;
  const settingsDrafts=new Map();
  function syncSetting(id,value){const input=$(id);if(document.activeElement!==input&&!settingsDrafts.has(id))input.value=value;}
  function discardSettingsDrafts(){settingsDrafts.clear();for(const [id,key]of [['cableCount','count'],['cableResistance','resistance']]){$(id).value=history.get().cables[key];$(id).removeAttribute('aria-invalid');}}
  function commitSetting(id,key){const input=$(id),value=input.valueAsNumber;if(value===history.get().cables[key]){settingsDrafts.delete(id);input.removeAttribute('aria-invalid');return true;}const accepted=change(doc=>{doc.cables[key]=value;});if(accepted){settingsDrafts.delete(id);input.removeAttribute('aria-invalid');input.value=history.get().cables[key];}else input.setAttribute('aria-invalid','true');return accepted;}
  const touches=new Map(),minScale=.001,maxScale=2.5;
  const owned=e=>host.contains(e.target)||touches.size||drag||cameraGesture;
  let cameraGesture=null,touchOrigin=null,touchBlocked=false,spacePan=false,spacePanUsed=false;
  let noticeTimer;
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  let paused=reducedMotion.matches||timed&&!profile.simulation.play,slowMotion=false,timeRate=1,actualRate=0,acLag=0,animationTime=0,lastTime=0,relayLastTime=performance.now(),lastACPaint=0;
  on(document,'visibilitychange',()=>{lastTime=0;relayLastTime=performance.now();});
  on(document,'visibilitychange',()=>{lastTime=0;acLag=0;});
  on(reducedMotion,'change',()=>{if(reducedMotion.matches)paused=true;lastTime=0;relayLastTime=performance.now();render(false);});
  const current=()=>previewDoc||history.get(),world=(x,y)=>{const r=surface.getBoundingClientRect();return{x:camera.x+(x-r.left)/camera.scale,y:camera.y+(y-r.top)/camera.scale};};
  const screen=p=>({x:(p.x-camera.x)*camera.scale,y:(p.y-camera.y)*camera.scale}),snapGrid=v=>Math.round(v/20)*20;
  const rich=parts=>(Array.isArray(parts)?parts:[parts]).map(p=>typeof p==='string'?V.esc(p):Q.html(p)).join('');
  function notify(content,error=false){const text=Array.isArray(content)?content.map(p=>typeof p==='string'?p:p.text).join(''):content;lastMessage=text;if(error&&$("settingsDialog").open){$("settingsNotice").textContent=text;$("settingsNotice").hidden=false;}$("hint").innerHTML=rich(content);$("hint").title=text;$("hint").style.color=error?"#a35d13":"";const n=$("canvasNotice");n.innerHTML=rich(content);n.hidden=false;n.classList.toggle("error",error);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{n.hidden=true;},3500);}
  function selectedWire(){return history.get().wires.find(w=>w.id===selection?.id);}
  function selectedComponent(){return history.get().components.find(c=>c.id===selection?.id);}
  function emitChange(){for(const fn of listeners)try{fn(M.clone(history.get()));}catch(e){console.error("CircuitWorkbench onChange callback failed",e);}}
  const readableMeter=(d,c)=>c&&d.display.values&&R.isMeter(c);
  const inspectableMeter=c=>!!c&&(R.dualMeter(c)||c.type==='galvanometer'||c.type.startsWith('ac-')&&R.isMeter(c));
  function discardParamPreview(){unsubscribePreview?.();unsubscribePreview=null;paramSession?.destroy();paramSession=null;acLag=0;acUI?.endPreview(false);}
  function previewParameter(doc){if(timed){if(!paramSession){paramSession=session.fork();unsubscribePreview=paramSession.subscribe(result=>acUI?.preview(result));}lastSessionChange=paramSession.update(doc,{continuous:true});}previewDoc=doc;analysis=solve(doc);if(paramSession)acUI?.preview(analysis);}
  function rollbackDrag(){discardParamPreview();meterPreview=null;const old=drag;drag=null;previewDoc=null;analysis=solve(history.get());$("preview").hidden=true;
    if(old?.kind==="wireend"||old?.kind==="body"||old?.wholeWire||old?.discardNoticed)$("canvasNotice").hidden=true;
    if(old?.kind==="pan"){Object.assign(camera,old.base);autoFit=old.autoFitBefore;}
    if(old){selection=old.selectionBefore;selectedConnection=old.connectionBefore??null;}
    if(old?.kind==='palette')old.target.suppressedToolPointers.add(old.pointerId);
    // Active touches keep their original capture until lift or an explicit transfer.
    if(old?.target.hasPointerCapture?.(old.pointerId)&&!touches.has(old.pointerId))old.target.releasePointerCapture(old.pointerId);
    if(old)suppressClick=true;
  }
  function releaseTouches(ids){for(const id of ids)if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);}
  function cancelInteraction(){if(destroyed)return;relayLastTime=performance.now();releasedMeta=null;const old=cameraGesture;cameraGesture=null;rollbackDrag();labelOptions.previous=null;
    if(old){Object.assign(camera,old.base);autoFit=old.autoFitBefore;selection=old.selectionBefore;releaseTouches(old.ids.filter(id=>!touches.has(id)));}
    if(touches.size){touchBlocked=true;suppressClick=true;}
  }
  function cancel(deferRender=false,inspector=true){if(destroyed)return;cancelInteraction();
    if(deferRender===true)later(()=>render(inspector));else render(inspector);
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
    try{const before=history.get();if(session)sessionHistory.set(before,session.capture());history.change(doc=>{fn(doc);
      if(household)for(const c of doc.components.filter(Family.isAppliance)){
        const previous=before.components.find(p=>p.id===c.id),kinds=Family.applianceKinds[c.type==='house-metal'?'metal':'insulated'],label=kinds[c.params.kind]?.label;
        if(label&&previous&&previous.params.kind!==c.params.kind&&c.label===previous.label&&allow(before,previous,'label')&&[Family.definitions[c.type].name,previous.params.kind==='lamp'?'台燈':previous.params.kind==='aircon'?'冷氣機':kinds[previous.params.kind]?.label].includes(previous.label))c.label=label;
      }
      if(household)for(const c of doc.components.filter(c=>c.type==='house-person')){const previous=before.components.find(p=>p.id===c.id);if(previous&&(session.state.contacts[c.id]||Family.handContacts(before).some(p=>p.hand.startsWith(c.id+':'))||R.ports(previous).some(p=>M.degree(before,p.id)>0))&&previous.params.stance!==c.params.stance){const point=Family.hand(previous);Family.placeHand(c,point);}}profile.prepare(doc);profile.assertTransition(before,doc,readOnly);});if(paramSession&&previewDoc&&JSON.stringify(previewDoc)===JSON.stringify(history.get())){const next=paramSession;unsubscribePreview?.();unsubscribePreview=null;paramSession=null;acUI?.endPreview(true);replaceSession(next,true);}else if(paramSession)discardParamPreview();previewDoc=null;meterPreview=null;relayLastTime=performance.now();analysis=solve(history.get());
      if(selection&&!M.endpoints(history.get()).has(selection.id)&&![...history.get().components,...history.get().junctions,...history.get().wires].some(x=>x.id===selection.id))selection=null;
      $("settingsNotice").hidden=true;if(autoFit)fit();render(inspector);if(before!==history.get())emitChange();if(transient&&lastSessionChange==='restarted')notify('已建立新實驗，回到 t = 0 及初始儲能條件。');lastSessionChange=null;return true;
    }catch(e){discardParamPreview();selection=beforeSelection;previewDoc=null;analysis=solve(history.get());render(inspector);notify(e.message,true);return false;}
  }
  function addComponent(doc,type,x,y,params){
    const c=M.add(doc,type,x,y,params);
    // Removed author-supplied IDs must not become a different toolbox component.
    if(!teacher&&profile.initial.components.some(initial=>initial.id===c.id))c.id=M.nextId({...doc,components:[...doc.components,...profile.initial.components]},'c');
    return c;
  }
  function addWire(doc,x,y){const w=M.addWire(doc,x,y);if(!teacher&&profile.initial.wires.some(initial=>initial.id===w.id))w.id=M.nextId({...doc,wires:[...doc.wires,...profile.initial.wires]},'w');return w;}
  function canvasBounds(){
    const width=surface.clientWidth,height=surface.clientHeight,r=surface.getBoundingClientRect(),pad=Math.min(22,width/2,height/2),exclusions=[];let left=pad,right=width-pad;
    for(const grip of host.querySelectorAll('.scroll-strip')){
      if(!grip.getClientRects().length)continue;const g=grip.getBoundingClientRect();if(g.right<=r.left||g.left>=r.right||g.bottom<=r.top||g.top>=r.bottom)continue;
      exclusions.push({left:g.left-r.left,right:g.right-r.left,top:g.top-r.top,bottom:g.bottom-r.top});
      if((g.left+g.right)/2<(r.left+r.right)/2)left=Math.max(left,g.right-r.left+22);else right=Math.min(right,g.left-r.left-22);
    }
    return{left,right,top:pad,bottom:height-pad,exclusions};
  }
  function fit(){const d=current(),points=[...d.components.flatMap(c=>{if(household){const b=R.bodyBounds(c);return[{x:b.left-25,y:b.top-30},{x:b.right+25,y:b.bottom+35},...R.ports(c)];}return[{x:c.x-90,y:c.y-90},{x:c.x+90,y:c.y+130}];}),...d.junctions,...d.wires.flatMap(w=>G.route(d,w))];
    if(!points.length){Object.assign(camera,{x:0,y:0,scale:1});return;}
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    const box=canvasBounds(),place=(left,right)=>{
      camera.scale=Math.max(.001,Math.min(transient?1.8:1.2,(right-left)/Math.max(120,maxX-minX),(box.bottom-box.top)/Math.max(120,maxY-minY)));
      camera.x=(minX+maxX)/2-(left+right)/(2*camera.scale);camera.y=(minY+maxY)/2-(box.top+box.bottom)/(2*camera.scale);
    };
    place(box.top,surface.clientWidth-box.top);
    if(box.exclusions.length&&[...M.endpoints(d).values()].some(p=>{const q=screen(p);return box.exclusions.some(g=>q.x+22>g.left&&q.x-22<g.right&&q.y+22>g.top&&q.y-22<g.bottom);}))place(box.left,box.right);
  }
  function focusPoint(p){autoFit=false;camera.scale=Math.max(1,camera.scale);camera.x=p.x-surface.clientWidth/(2*camera.scale);camera.y=p.y-surface.clientHeight/(2*camera.scale);render(false);}
  function resolveSnap(d,id,key,p){const w=d.wires.find(w=>w.id===id),other=key==="from"?"to":"from";let found=null,distance=24/camera.scale;
    for(const [endpoint,q]of M.endpoints(d)){if(endpoint===w[key]||(endpoint===w[other]&&!M.attached(d,w,other)))continue;
      if(household){try{const candidate=M.clone(d);const next=candidate.wires.find(v=>v.id===id);next[key]=endpoint;root.CircuitHouseholdConnections.validate(candidate);}catch{continue;}}const size=Math.hypot(q.x-p.x,q.y-p.y);if(size<distance){found={...q,id:endpoint};distance=size;}}
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
  function probeEndpointAt(x,y){
    const p=world(x,y),ends=M.endpoints(history.get()),candidates=new Map();
    for(const t of targets.values()){
      const m=t.meta,id=m.kind==='port'?m.id:m.kind==='junction'?m.id+':p':['wireend','hand'].includes(m.kind)?m.endpoint:null,q=ends.get(id);
      if(!q)continue;const distance=Math.hypot(q.x-p.x,q.y-p.y)*camera.scale,node=household?analysis.netOf[id]:id;
      if(distance<=22&&(!candidates.has(node)||distance<candidates.get(node).distance))candidates.set(node,{id,distance});
    }
    const nearby=[...candidates.values()].sort((a,b)=>a.distance-b.distance);
    if(nearby[1]&&nearby[1].distance-nearby[0].distance<2){notify('測點太接近，請放大後再選。');return null;}
    return nearby[0]?.id||null;
  }
  function probePort(id){selection={kind:"port",id};const value=analysis.potentials[id];if(probeFirst&&probeFirst!==id){probeResult={from:probeFirst,to:id,voltage:analysis.voltage(probeFirst,id)};probeFirst=null;notify(probeResult.voltage===null?"兩點不屬同一個可確定電勢差的電路。":["兩點電壓：",Q.quantity(probeResult.voltage,'V'),'（'+portName(probeResult.from)+' − '+portName(id)+'）']);}else{probeFirst=id;probeResult=null;notify([portName(id)+'：相對電勢 ',Q.quantity(value,'V'),'（'+referenceText(id)+'）；再點另一個端子測量。']);}render();}
  function target(key,meta,p,width=44,height=44,touch="none"){let t=targets.get(key);if(!t){t=document.createElement("button");t.type="button";t.className="hit "+meta.kind;t.dataset.hit=key;targets.set(key,t);hitLayer.append(t);}
    t.meta=meta;t.setAttribute("aria-label",meta.label);Object.assign(t.style,{left:p.x+"px",top:p.y+"px",width:Math.max(meta.kind==="wire"?12:44,width)+"px",height:Math.max(meta.kind==="wire"?12:44,height)+"px",touchAction:touch,transform:"translate(-50%,-50%)"});
    t.classList.toggle("snap",!!drag?.snap&&(drag.snap.connections||[drag.snap]).some(s=>s.id===meta.id||s.id===meta.endpoint));t.tabIndex=meta.kind==="wire"&&meta.segment>0?-1:0;return t;
  }
  function renderHits(d){const needed=new Set(),put=(key,...args)=>{needed.add(key);return target(key,...args);};
    d.components.forEach(c=>{const dual=R.dualMeter(c),size=d.display.view==='real'?R.meterBodyScale(c):1,w=(dual?(d.display.view==='real'?144:70):c.type==='relay'?150:c.type==='galvanometer'?102:c.type==='rheostat'?100:c.type==='wattmeter'?80:70)*size,h=(dual?(d.display.view==='real'?130:70):c.type==='relay'?108:c.type==="lamp"?106:c.type==='galvanometer'?97:c.type==='rheostat'?64:c.type==="wattmeter"?78:46)*size,angle=c.angle*Math.PI/180,center=dual&&d.display.view==='real'?{x:c.x+22*size*Math.sin(angle),y:c.y-22*size*Math.cos(angle)}:c.type==='relay'?{x:c.x-14*Math.sin(angle),y:c.y+14*Math.cos(angle)}:c;
      const acBounds=c.type==='house-power-strip'?{left:c.x-158,right:c.x+158,top:c.y-55,bottom:c.y+55}:R.get(c.type).analysis?R.bodyBounds(c):null;
      put("body:"+c.id,{kind:"body",id:c.id,label:c.label+"，拖動本體或用方向鍵移動"},screen(acBounds?{x:(acBounds.left+acBounds.right)/2,y:(acBounds.top+acBounds.bottom)/2}:center),(acBounds?acBounds.right-acBounds.left:Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h)*camera.scale,(acBounds?acBounds.bottom-acBounds.top:Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*h)*camera.scale,allow(d,c,"move")||readableMeter(d,c)?"none":"pan-y");
      targets.get('body:'+c.id).classList.toggle('overview',camera.scale<(dual?.7:.55));
      if(household&&c.type==='house-power-strip')put('plug:'+c.id,{kind:'plug',id:c.id,label:'拖板插頭：拖到插座吸附，方向鍵移動，Shift 加方向鍵微調，Enter 插入附近插座'},screen(Family.plugPoint(c)),86*camera.scale,87*camera.scale,allow(d,c,'plug')?'none':'pan-y');
      if(household&&c.type==='house-person')for(const p of R.ports(c))put(p.key==='hand'?'hand:'+c.id:'port:'+p.id,{kind:'hand',id:c.id,endpoint:p.id,label:p.label+'：可拖到接線端或插座孔吸附'+'，或接觸金屬家電外殼'},screen(p),44,44,readOnly?'pan-y':'none').classList.add('port');
      if(c.type==="rheostat"){const angle=c.angle*Math.PI/180,x=-30+c.params.position*60,y=(c.params.terminals??2)>2?-34:38;put("slider:"+c.id,{kind:"slider",id:c.id,label:c.label+"滑片，拖動調整電阻"},screen({x:c.x+x*Math.cos(angle)-y*Math.sin(angle),y:c.y+x*Math.sin(angle)+y*Math.cos(angle)}),44,44,allow(d,c,"params","position")?"none":"pan-y");}
      R.ports(c).filter(p=>!p.hidden&&!(household&&c.type==='house-person')&&((dual?camera.scale>=.7:camera.scale>=.55)||probeMode||drag?.kind==="wireend"||M.degree(d,p.id)>0)).forEach(p=>{const t=put("port:"+p.id,{kind:"port",id:p.id,label:c.label+" "+p.label+"端子，拖導線端點到這裏接好"},screen(p),44,44,!probeMode&&allow(d,c,"move")?"none":"pan-y");t.classList.toggle("overview",camera.scale<(dual?.7:.55));});
    });
    d.junctions.filter(j=>M.degree(d,j.id+":p")>1).forEach(j=>put("junction:"+j.id,{kind:"junction",id:j.id,label:"共接點，點選量測或拖動"},screen(j)));
    d.wires.forEach(w=>{const points=G.simplify(routes[w.id],1.2/camera.scale);
      points.slice(1).forEach((p,i)=>{const a=screen(points[i]),b=screen(p),n=put("wire:"+w.id+":"+i,{kind:"wire",id:w.id,segment:i,point:{x:(points[i].x+p.x)/2,y:(points[i].y+p.y)/2},label:"導線 "+w.id+"，拿線身搬動或彎曲"},{x:(a.x+b.x)/2,y:(a.y+b.y)/2},Math.hypot(b.x-a.x,b.y-a.y)+6,18);n.style.transform+=` rotate(${Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}deg)`;n.classList.toggle("selected",selection?.id===w.id);});
      const ends=M.endpoints(d);["from","to"].forEach((end,i)=>{if(!M.attached(d,w,end)||selection?.id===w.id||wireMode){const n=put("wireend:"+w.id+":"+end,{kind:"wireend",id:w.id,end,endpoint:w[end],label:`導線 ${w.id} ${i?"B":"A"}端，${M.attached(d,w,end)?"拉走可拔開":"拖到端子或其他線端接好"}`},screen(ends.get(w[end])));n.classList.toggle("selected",selection?.id===w.id);}});
    });
    const connection=selectedConnection&&M.endpoints(d).get(selectedConnection),count=connection?M.degree(d,selectedConnection):0,detach=count&&M.attached(d,{from:selectedConnection},'from');
    for(const t of targets.values()){t.classList.toggle('connection-selected',!!connection&&t.meta.id===selectedConnection||!!connection&&t.meta.endpoint===selectedConnection);t.classList.toggle('connection-wire',!!connection&&t.meta.kind==='wire'&&d.wires.some(w=>w.id===t.meta.id&&(w.from===selectedConnection||w.to===selectedConnection)));}
    if(connection&&screen(connection).x>=0&&screen(connection).x<=surface.clientWidth&&screen(connection).y>=0&&screen(connection).y<=surface.clientHeight&&wireAllowed()&&!probeMode&&!drag&&!cameraGesture){
      const p=screen(connection),width=surface.clientWidth,height=surface.clientHeight,space=detach?50:0;
      const side=p.x+48+space<=width-24?p.x+48:p.x-48-space,x=Math.max(24,Math.min(width-24-space,side)),y=Math.max(24,Math.min(height-24,p.y-48<24?p.y+48:p.y-48));
      const add=put('addConnectionWire',{kind:'addConnectionWire',id:selectedConnection,label:'由此接點加一條導線'},{x,y},44,44,'manipulation');add.title=add.meta.label;add.disabled=d.wires.length>=d.cables.count;add.innerHTML='<span aria-hidden="true">＋</span>';
      if(detach){const icon=put('detachConnection',{kind:'detachConnection',id:selectedConnection,label:'拆開全部 · '+count+' 個線端'},{x:x+50,y},44,44,'manipulation');icon.title=icon.meta.label;icon.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#'+prefix+'icon-detach"/></svg><small>'+count+'</small>';}
    }
    for(const [key,t]of targets)if(!needed.has(key)&&t!==drag?.target&&![...touches.values()].some(p=>p.target===t)){t.remove();targets.delete(key);}
  }
  function canDiscard(grip,doc=grip?.baseDoc){
    if(!grip||!doc||readOnly)return false;
    if(grip.kind==='body'){const c=doc.components.find(c=>c.id===grip.id);return !!c&&allow(doc,c,'remove')&&!doc.wires.some(w=>[w.from,w.to].some(p=>p.split(':')[0]===c.id));}
    if(['wire','wireend'].includes(grip.kind)){const w=doc.wires.find(w=>w.id===grip.id);return !!w&&wireAllowed()&&!M.attached(doc,w,'from')&&!M.attached(doc,w,'to');}
    return false;
  }
  function discardZoneAt(grip,x,y){
    if(!grip?.moved||!['body','wire','wireend'].includes(grip.kind))return null;
    const at=document.elementFromPoint(x,y);if(!at)return null;
    if($('deleteSelected').contains(at)&&$('deleteSelected').getBoundingClientRect().width>0)return 'trash';
    if($('panel').contains(at)&&$('panel').getBoundingClientRect().width>0)return 'panel';
    return null;
  }
  function renderGhost(){const snap=drag?.snap;$("ghostLayer").innerHTML=snap?(snap.connections||[snap]).map(s=>`<circle data-snap-target="${V.esc(s.id)}" cx="${s.x}" cy="${s.y}" r="${14/camera.scale}" fill="#a7d4f344" stroke="#2563eb" stroke-width="${2/camera.scale}"/>`).join(""):"";
    $('deleteSelected').classList.toggle('trash-open',!!drag?.discard);$('panel').classList.toggle('discard-active',drag?.discard==='panel');
    host.classList.toggle('palette-dragging',drag?.kind==='palette'&&drag.moved);
    const d=current();$('emptyHint').hidden=!!(d.components.length||d.wires.length||drag?.kind==='palette'&&(drag.component||drag.wirePreview));
    if(drag?.kind==='palette'&&drag.component){const c=drag.component;$("ghostLayer").innerHTML+=`<g data-palette-preview="${V.esc(drag.entry.key)}" transform="translate(${c.x} ${c.y})" opacity=".65" pointer-events="none">${V.body(c,null,{...history.get().display,idPrefix:prefix+'ghost-',fields:c.type==='transformer'?false:undefined})}</g>`;}
    if(drag?.kind==='palette'&&drag.wirePreview){const points=drag.wirePreview;$("ghostLayer").innerHTML+=`<g data-palette-preview="wire-tool" data-wire-tool-preview="true" opacity=".65" pointer-events="none"><path d="${G.path(points)}" fill="none" stroke="#50677e" stroke-width="${4/camera.scale}"/>${[points[0],points.at(-1)].map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${7/camera.scale}" fill="#fff" stroke="#526f88" stroke-width="${2/camera.scale}"/>`).join('')}</g>`;}
    if(drag?.discardZone){const n=$('canvasNotice'),message=drag.discard?'放手刪除；復原可還原。':'仍有接線或不可移除；放手會放回原位。';clearTimeout(noticeTimer);if(n.textContent!==message)n.textContent=message;n.hidden=false;n.classList.toggle('error',!drag.discard);drag.discardNoticed=true;}
    else if(drag?.kind==="wireend"||drag?.kind==="body"||drag?.wholeWire){const n=$("canvasNotice");clearTimeout(noticeTimer);n.hidden=!snap&&!drag.limited;n.classList.toggle("error",drag.limited);
      n.innerHTML=rich(snap?[drag.kind==="body"?"元件將接線：":drag.wholeWire?(snap.end==="from"?"A":"B")+" 端將接到：":"將接到：",...connectionLabel(snap.id)]:drag.limited?"線已拉盡；移近元件，或用另一條線接長。":"");}
    else if(drag?.discardNoticed){$('canvasNotice').hidden=true;drag.discardNoticed=false;}
    if(probeFirst){const p=M.endpoints(current()).get(probeFirst);if(p)$("ghostLayer").innerHTML+=`<circle cx="${p.x}" cy="${p.y}" r="${11/camera.scale}" fill="none" stroke="#b56e20" stroke-width="${2/camera.scale}"/>`;}
    if(probeMode&&selection?.kind==='port'){const p=M.endpoints(d).get(selection.id);if(p)$("ghostLayer").innerHTML+=`<circle data-probe-target="${V.esc(selection.id)}" cx="${p.x}" cy="${p.y}" r="${6/camera.scale}" fill="#93c5fd66" stroke="#2563eb" stroke-width="${2/camera.scale}"/>`;}
  }
  function render(inspector=true){if(destroyed)return;reflowControls();const d=current(),surfaceRect=surface.getBoundingClientRect();N.sync(needleStates,d,analysis,reducedMotion.matches);svg.setAttribute("viewBox",`${camera.x} ${camera.y} ${surfaceRect.width/camera.scale} ${surfaceRect.height/camera.scale}`);
    for(const id of wireCurrents)if(!history.get().wires.some(w=>w.id===id))wireCurrents.delete(id);
    $('showWireCurrents').disabled=!d.wires.length||wireCurrents.size===d.wires.length;$('hideWireCurrents').disabled=!wireCurrents.size;
    for(const id of potentialDirections)if(!history.get().components.some(c=>c.id===id))potentialDirections.delete(id);
    $('showPotentialDirections').disabled=!d.components.length||potentialDirections.size===d.components.length;$('hidePotentialDirections').disabled=!potentialDirections.size;
    $('potential').disabled=readOnly;
    // Hidden math labels need no rebuilding or layout until potential is shown.
    if(d.display.potential){
      const potentialRange=V.potentialRange(analysis),{low,high,max,known}=potentialRange,mid=(low+high)/2,equal=low===high;
      $('potentialScale').style.background=known?'linear-gradient(to right,'+Array.from({length:21},(_,i)=>V.colour(low+(high-low)*i/20,max,household)+' '+i*5+'%').join(',')+')':V.colour(null,max,household);
      $('potentialScale').setAttribute('aria-label',known?(equal?'等電勢：'+Q.quantity(mid,'V').text:'電勢由低至高：'+[low,mid,high].map(v=>Q.quantity(v,'V').text).join('、')):'電勢未能確定');
      $('potentialLow').hidden=$('potentialHigh').hidden=equal||!known;$('potentialTicks').style.justifyContent=equal?'center':'space-between';
      for(const [id,label,value]of [['potentialLow','低',low],['potentialMid',equal?'等電勢':'中',mid],['potentialHigh','高',high]])$(id).innerHTML=known?rich([label+' ',Q.quantity(value,'V')]):'未能確定';
    }
    labelOptions.exclusions=[...host.querySelectorAll('.scroll-strip, .canvas-notice:not([hidden])')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{left:camera.x+(r.left-surfaceRect.left)/camera.scale,right:camera.x+(r.right-surfaceRect.left)/camera.scale,top:camera.y+(r.top-surfaceRect.top)/camera.scale,bottom:camera.y+(r.bottom-surfaceRect.top)/camera.scale};});
    surface.style.backgroundSize=`${Math.max(16,20*camera.scale)}px ${Math.max(16,20*camera.scale)}px`;surface.style.backgroundPosition=`${-camera.x*camera.scale}px ${-camera.y*camera.scale}px`;
    const key=JSON.stringify([d.components.map(c=>[c.id,c.type,c.x,c.y,c.angle,c.mirrored,R.ports(c).map(p=>[p.id,p.x,p.y,p.dx,p.dy])]),d.junctions,d.wires]);if(key!==geometryKey){routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)]));geometryKey=key;}
    labelOptions.currentReferences=V.flowReferences(d,analysis,flowContext());
    $("scene").innerHTML=V.scene(d,analysis,camera.scale,routes,selection?.id,wireMode,{x:camera.x,y:camera.y,width:surfaceRect.width/camera.scale,height:surfaceRect.height/camera.scale},labelOptions);$("flowLayer").innerHTML=V.flow(d,analysis,routes,animationTime,camera.scale,flowOffsets,flowContext());renderHits(d);renderGhost();
    $("zoomReadout").textContent=(camera.scale<.01?(camera.scale*100).toFixed(1):Math.round(camera.scale*100))+"%";
    $("fitView").setAttribute("aria-pressed",String(autoFit));
    $("fitView").title=autoFit?"自動全圖已啟用；移動元件後會自動適應":"顯示全圖並啟用自動適應";
    $("undo").disabled=readOnly||!profile.undo||!history.canUndo();$("redo").disabled=readOnly||!profile.undo||!history.canRedo();["realView","schematicView"].forEach(id=>$(id).setAttribute("aria-pressed",String(d.display.view===(id==="realView"?"real":"schematic"))));
    ["flow"].forEach(id=>$(id).value=d.display[id]);["names","values"].forEach(id=>$(id).checked=d.display[id]);if(household)$("potential").value=d.display.potential?'potential':d.display.roleColours===false?'plain':'roles';else $("potential").checked=d.display.potential;$("fontSize").value=M.fontSize(d.display);$("pause").setAttribute("aria-pressed",String(paused));$("pause").setAttribute("aria-label",paused?"繼續模擬":"暫停模擬");$("pause").title=paused?"繼續模擬":"暫停模擬";$("pause").querySelector("use").setAttribute("href","#"+prefix+(paused?"icon-play":"icon-pause"));$("slowMotion").setAttribute("aria-pressed",String(slowMotion));$("mode").value=d.policy.mode;$("policyOptions").hidden=d.policy.mode!=="wiring";["allowRotate","allowParams","allowSwitch"].forEach(id=>$(id).checked=d.policy[id]);
    Object.keys(M.quantityDefaults).filter(id=>$(id)).forEach(id=>{$(id).checked=d.display.quantities[id];$(id).disabled=!d.display.values;});
    $("potentialLegend").hidden=!d.display.potential;$("pan").setAttribute("aria-pressed",String(panMode));$("probe").setAttribute("aria-pressed",String(probeMode));$("pickWire").setAttribute("aria-pressed",String(wireMode));surface.classList.toggle('wire-priority',wireMode);surface.classList.toggle("panning",panMode);surface.classList.toggle("quick-pan",spacePan||!!drag?.quick);surface.classList.toggle("camera-gesture",!!cameraGesture);surface.classList.toggle("grabbing",!!(drag||cameraGesture));surface.classList.toggle("effects-paused",paused);surface.classList.toggle("effects-slow",slowMotion);
    const w=selectedWire(),c=selectedComponent(),actions=!probeMode&&!!(w||c||selection?.kind==="junction");if(!household||!drag&&!cameraGesture){$("selectionActions").hidden=!actions;$("hint").parentElement.classList.toggle("has-actions",actions);}
    $("focusSelected").hidden=!actions;
    const canCopy=!!c&&profile.palette.some(e=>e.type===c.type&&profile.canAdd(e,d,readOnly));$("copySelected").hidden=!c||!teacher&&!canCopy;$("copySelected").disabled=!canCopy;
    $("detachFrom").hidden=!w||!wireAllowed();$("detachTo").hidden=!w||!wireAllowed();$("detachFrom").disabled=!!w&&(!M.attached(history.get(),w,"from"));$("detachTo").disabled=!!w&&(!M.attached(history.get(),w,"to"));["rotateSelected","rotateCounterSelected"].forEach(id=>{$(id).hidden=!c||R.get(c.type).rotatable===false||!teacher&&!allow(d,c,"rotate");$(id).disabled=!!c&&!allow(d,c,"rotate");});
    $('inspectMeter').hidden=!inspectableMeter(c);$('straightenSelected').hidden=!w||!wireAllowed();
    $('flipMeterSelected').hidden=!c||!R.dualMeter(c)||!teacher&&!allow(d,c,'rotate');$('flipMeterSelected').disabled=!!c&&!allow(d,c,'rotate');
    const deleteLabel=w?"刪除導線":c?"刪除元件":"拆開接點";$("deleteSelected").title=deleteLabel;$("deleteSelected").setAttribute("aria-label",deleteLabel);$("deleteSelected").disabled=c?!allow(d,c,"remove"):!wireAllowed();$("deleteSelected").hidden=!teacher&&$("deleteSelected").disabled;
    $("selectionTip").textContent=w?(drag?.limited?"線已拉盡":!M.attached(d,d.wires.find(x=>x.id===w.id),"from")&&!M.attached(d,d.wires.find(x=>x.id===w.id),"to")?"拿端點調整直線 · 拿線身搬動":"拿端點接線 · 拿線身彎曲"):c?c.label:"共接點";
    $("cableCount").disabled=readOnly||d.policy.mode!=="free";$("cableLength").disabled=d.policy.mode!=="free";$("cableResistance").disabled=readOnly||d.policy.mode!=="free"||!profile.canSetWireResistance(d,readOnly);syncSetting("cableResistance",d.cables.resistance);const remaining=d.cables.count-d.wires.length;$("wireStock").textContent=remaining+" / "+d.cables.count;$("quickWire").innerHTML=`＋導線 <span>${remaining}/${d.cables.count}</span>`;["addWire","quickWire"].forEach(id=>$(id).disabled=remaining===0||!wireAllowed());syncSetting("cableCount",d.cables.count);const lengthSelect=$("cableLength");[...lengthSelect.options].filter(o=>o.dataset.custom&&Number(o.value)!==d.cables.length).forEach(o=>o.remove());if(![...lengthSelect.options].some(o=>Number(o.value)===d.cables.length)){const o=new Option("自訂 · "+d.cables.length,String(d.cables.length));o.dataset.custom="true";lengthSelect.add(o);}lengthSelect.value=d.cables.length;
    const hazards=V.visualState(d,analysis);$("circuitStatus").textContent=Object.values(analysis.components).some(r=>r.protection?.reason==='overload')?"電源超限 · 回饋調節中":hazards.short?"短路 · 發熱":hazards.overload?"過載 · 發熱":analysis.diagnostics.length?"需檢查電路":"";host.querySelectorAll("[data-add]").forEach(b=>b.disabled=!profile.canAdd(b.entry,d,readOnly));
    if(inspector)renderProperties();
    else {
      const input=$('properties').querySelector('[data-param="position"]'),component=d.components.find(c=>c.id===input?.dataset.component);
      if(component&&document.activeElement!==input){
        input.value=Number((component.params.position*100).toPrecision(12));
        const range=input.parentElement.nextElementSibling;if(range?.type==='range')range.value=input.value;

      }
    }
    if(!inspector){updateSelectionReadings(true);renderProtectionStatus();}
    renderQuickParameters();
    if($('selectionActionsDialog').open&&(selection?.id!==$('selectionActionsDialog').dataset.selection||getComputedStyle($('moreSelected')).display==='none'))$('selectionActionsDialog').close();
    const held=drag?.pointerType==="touch"&&["body","meterread"].includes(drag.kind)&&!drag.moved?d.components.find(c=>c.id===drag.id):null;
    const pinned=meterPreview?d.components.find(c=>c.id===meterPreview.id):null,reading=readableMeter(d,held)?held:readableMeter(d,pinned)?pinned:null;
    if(reading)renderPreview(null,reading);else if(drag?.pointerType==="touch"&&['wireend','hand','plug'].includes(drag.kind))renderPreview(drag.focus||world(drag.lastX,drag.lastY));else $("preview").hidden=true;
    updateMeterNeedles();
    if(acUI)acUI.render(analysis);
    familyUI?.render(d,analysis);
  }
  function updateMeterNeedles(){
    for(const root of [$("scene"),$("preview"),$("meterDetail")])for(const needle of root.querySelectorAll('[data-meter-needle]')){
      const state=needleStates.get(needle.dataset.meterNeedle);if(!state)continue;if(state.target===null){needle.setAttribute('visibility','hidden');continue;}needle.removeAttribute('visibility');
      const fraction=state.fraction,p=N.point({type:state.type},fraction);
      needle.setAttribute('d',`M0 ${p.cy}L${p.x} ${p.y}`);needle.dataset.fraction=fraction;needle.dataset.angle=p.angle;needle.dataset.targetFraction=state.target;
      needle.dataset.moving=String(fraction!==state.target||state.velocity!==0);
      const r=analysis.components[needle.dataset.meterNeedle];if(state.type.startsWith('ac-')){needle.dataset.reading=Number.isFinite(r?.reading)?r.reading:Number.isFinite(r?.estimatedReading)?r.estimatedReading:'';needle.dataset.provisional=String(r?.meterStatus==='collecting'&&Number.isFinite(r?.estimatedReading));}
    }
    for(const status of $('meterDetail').querySelectorAll('[data-meter-status]')){const r=analysis.components[status.dataset.meterStatus],q=analysis.measurements?.[status.dataset.meterStatus];status.textContent=r?.meterStatus==='collecting'?(Number.isFinite(r.estimatedReading)?'暫估；':'')+'收集完整量測窗 '+Q.number(Math.max(0,(q?.end??0)-(q?.start??0)))+' / '+Q.number(q?.window)+' s':r?.meterStatus==='unconnected'?'請接妥電表接孔':V.statusText(r)||'量測窗已完整';}
  }
  function renderPreview(p,meter=null){const host=$("preview"),preview=host.querySelector("svg");host.hidden=false;host.dataset.mode=meter?"meter":"connection";host.setAttribute("aria-hidden",String(!meter));$("closePreview").hidden=!meter;host.querySelector("span").textContent=meter?"刻度預覽":"接線預覽";if(drag&&!drag.previewSide)drag.previewSide=drag.x-surface.getBoundingClientRect().left>surface.clientWidth/2?"left":"right";const side=drag?.previewSide||meterPreview?.side;host.style.left=side==="left"?"46px":"auto";host.style.right=side==="left"?"auto":"46px";
    if(meter){preview.setAttribute("role","img");preview.setAttribute("aria-label",meter.label+"指針刻度");const d=current(),r=analysis.components[meter.id];preview.setAttribute("viewBox",meter.type.startsWith('ac-')?'-66 -47 132 92':R.dualMeter(meter)?"-78 -85 156 119":meter.type==='galvanometer'?'-50 -45 100 90':"-70 -55 140 110");preview.innerHTML=R.dualMeter(meter)?V.dualDial(meter,r,d.display.values):meter.type==='galvanometer'?V.galvanometerDial(meter,r,d.display.values):V.body({...meter,angle:0},r,{...d.display,view:"real"});}
    else{preview.setAttribute("viewBox",`${p.x-70} ${p.y-55} 140 110`);preview.innerHTML=($("scene").innerHTML+$("ghostLayer").innerHTML).replace(/(id="|url\(#)([\w-]*(?:wire-potential|transformer-art|family-art)-[\w-]+)/g,'$1preview-$2');}
  }
  const actionIcons={'反接電源極性':'flip','整理線形':'wire'};
  function button(label,fn,disabled=false,danger=false,parent=$("objectActions")){const b=document.createElement("button"),socket=/^(接好|拔開) [AB]$/.test(label),name=actionIcons[label]||(socket?label.startsWith('接好 ')?'attach':'detach':null);b.type="button";
    if(name){b.className='icon-button';b.innerHTML=`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#${prefix}icon-${name}"/></svg>`;if(socket){b.classList.add('socket-action');b.innerHTML+='<small>'+V.esc(label.slice(-1))+'</small>';}}
    else{b.className='text-action';b.textContent=label;}
    if(!teacher && disabled)return b;b.title=label;b.setAttribute('aria-label',label);b.dataset.action=label;b.disabled=disabled;if(danger)b.classList.add('danger');b.onclick=fn;parent.append(b);return b;
  }
  function readings(values){return '<dl class="readings">'+values.map(([name,value,unit])=>`<dt>${transient?Q.labelHtml(name):V.esc(name)}</dt><dd>${Q.html(Q.quantity(value,unit))}</dd>`).join("")+"</dl>";}
  function referenceText(endpoint){if(household)return '以供電端等效地為 0 V 參考';const island=analysis.islandOf[endpoint],requested=history.get().display.reference,reference=requested&&analysis.islandOf[requested]===island?requested:analysis.references.find(r=>r.island===island)?.endpoint;return reference?'以「'+portName(reference)+'」為 0 V 參考':'0 V 參考未能確定';}
  const referenceNote=endpoint=>'<p class="note potential-reference" data-reference-for="'+V.esc(endpoint)+'">'+V.esc(referenceText(endpoint))+'。</p>';
  function field(label,element,parent=$("properties")){const l=document.createElement("label"),caption=document.createElement('span');caption.innerHTML=rich(label);l.append(caption,element);parent.append(l);}
  function checkbox(label,checked,fn){const l=document.createElement("label");l.className="check";const i=document.createElement("input");i.type="checkbox";i.checked=checked;i.onchange=()=>fn(i.checked);l.append(i,document.createTextNode(label));$("properties").append(l);}
  function setDiagramDisplay(kind,id,visible){
    const wire=kind==='wireCurrents',items=history.get()[wire?'wires':'components'],ids=wire?wireCurrents:potentialDirections,name=wire?'導線電流':'電勢方向';
    if(!profile.ui[kind]){notify('此活動未開放'+name+'標示。',true);return false;}
    if(typeof visible!=='boolean'||id!==undefined&&!items.some(item=>item.id===id)){notify(name+'顯示設定無效。',true);return false;}
    cancel();for(const item of items)if(id===undefined||item.id===id){if(visible)ids.add(item.id);else ids.delete(item.id);}render();return true;
  }
  function selectionReadings(){
    const d=current(),c=selectedComponent(),wire=selectedWire(),probe=probeResult?readings([["第一點 − 第二點",analysis.voltage(probeResult.from,probeResult.to),"V"]]):'';
    if(c)return componentReadings(c.id);
    if(wire){const r=analysis.wires[wire.id];return readings([["A → B 電流",V.displayCurrent(d,analysis,wire.from,r?.current,labelOptions.currentReferences,r?.currentPeak),"A"],["A 端相對電勢",r?.potential,"V"],["B 端相對電勢",r?.potentialTo,"V"],["A − B 電壓",r?.voltage,"V"],["導線耗散功率",r?.power,"W"]])+referenceNote(wire.from)+(r?.cyclic?'<p class="note">理想導線環路中，此段電流不能唯一確定。</p>':'')+(analysis.reliable===false?'<p class="diagnostic">讀數未能可靠確定，模擬已暫停。</p>':'');}
    if(selection?.kind==='port'||selection?.kind==='junction'){const endpoint=selection.kind==='junction'?selection.id+':p':selection.id;return readings([["相對電勢",analysis.potentials[endpoint],"V"]])+referenceNote(endpoint)+probe;}
    return probe;
  }
  function readingHost(){return '<div class="reading-host">'+selectionReadings()+'</div>';}
  function renderProtectionStatus(){
    const status=$('properties').querySelector('[data-protection-status]');if(!status)return;const q=analysis.components[status.dataset.protectionStatus]?.protection,reset=$('properties').querySelector('[data-protection-reset]');
    status.textContent=!q?'保護關閉':q.status==='normal'?'正常供電':q.status==='limited'?(q.reason==='overload'?'仍超限 · 回饋調節中 · ':'限流／限功率 · ')+ '輸出波幅 '+(100*q.scale).toFixed(1)+'%':q.reason==='short-circuit'?'保護停機 · 短路，請排除故障後重設。':'保護停機 · 無法可靠限制輸出，請檢查電源衝突或儲能放電路徑後重設。';
    if(q)status.textContent+=' · 實際內阻 '+root.CircuitAC.sourceResistance(history.get().components.find(c=>c.id===status.dataset.protectionStatus))+' Ω';
    if(q&&analysis.measurements?.[status.dataset.protectionStatus]?.currentStatus==='collecting')status.textContent+=' · 量測窗收集中';if(reset)reset.hidden=q?.status!=='tripped';
  }
  function renderProperties(){const d=history.get(),c=selectedComponent(),wire=selectedWire(),prop=$("properties"),previous=prop.querySelector('[data-source-protection]'),protectionOpen=previous&&previous.dataset.sourceProtection===c?.id&&previous.open;prop.replaceChildren();$("objectActions").replaceChildren();
    if (c) {
      $("selectionTitle").innerHTML = profile.ui.mathNames?nameHtml(c.label):V.esc(c.label);
      if(profile.ui.potentialDirections)checkbox('顯示此元件電勢方向',potentialDirections.has(c.id),v=>setDiagramDisplay('potentialDirections',c.id,v));
      const name = document.createElement("input"); name.type = "text"; name.value = c.label; name.maxLength = 40; name.disabled = !allow(d, c, "label"); name.onchange = () => change((doc) => { doc.components.find((x) => x.id === c.id).label = name.value; }); if(!household&&(teacher||allow(d,c,"label")))field("名稱", name);
      let protection;
      if(c.type==='ac-source'&&(teacher||allow(d,c,'params','protectionEnabled'))){
        protection=document.createElement('details');protection.className='ac-source-protection';protection.dataset.sourceProtection=c.id;protection.open=!!protectionOpen;
        const summary=document.createElement('summary');summary.textContent='進階：電源保護';protection.append(summary);
        const toggle=document.createElement('input');toggle.type='checkbox';toggle.dataset.param='protectionEnabled';toggle.checked=c.params.protectionEnabled;toggle.disabled=!allow(d,c,'params','protectionEnabled');toggle.onchange=()=>change(doc=>{doc.components.find(x=>x.id===c.id).params.protectionEnabled=toggle.checked;});field('啟用電源保護',toggle,protection);
      }
      if(teacher&&c.type==='transformer'&&c.params.model==='ideal'){const note=document.createElement('p');note.className='note';note.textContent='理想模型忽略線圈電阻、電感、耦合及初始電流；這些參數只適用於「線性線圈」。';prop.append(note);}
      for (const key of Object.keys(R.get(c.type).params)) {
        const spec={...profile.parameterSpec(c,key),...(c.type==='ac-source'&&key==='voltage'&&c.params.protectionEnabled?{label:'電動勢有效值（調節前）'}:{})};
        if(spec.legacyChoices?.includes(c.params[key]))spec.choices=[c.params[key],...spec.choices];
        if (key === "polarity" || spec.hidden) continue;
        if(c.type==='ac-source'&&['protectionEnabled','maxCurrent','maxPower'].includes(key))continue;
        if(c.type==='lamp'&&c.params.model==='ideal'&&['coldRatio','linearLoss'].includes(key))continue;
        const enabled = allow(d, c, key === "closed" ? "switch" : "params",key);
        if(!teacher&&!enabled)continue;
        if (spec.choices) { const input = document.createElement("select");input.dataset.param=key; spec.choices.forEach((choice) => { const o = document.createElement("option"); o.value = String(choice); o.textContent = spec.labels?.[choice] ?? (c.type==='lamp'&&key === "model" ? choice === "ideal" ? "恆阻燈（理想化）" : "變阻燈（熱效應）" : c.type==='rheostat'&&key==='terminals'?choice+' 孔'+(choice===4?'（教學器材）':choice===3?'（分壓）':'（限流）'):c.type==='switch'&&key==='closed'?choice ? "閉合" : "斷開":String(choice)); input.append(o); }); input.selectedIndex = spec.choices.findIndex(choice=>choice===c.params[key]); input.disabled = !enabled; input.onchange = () => {const value=spec.choices[input.selectedIndex];const ok=change((doc) => {if(c.type==='rheostat'&&key==='terminals')M.setTerminals(doc,c.id,value);else doc.components.find((x) => x.id === c.id).params[key] = value; });if(ok&&c.type==='rheostat'&&key==='terminals')notify('已切換接線孔；隱去孔的導線拔開並留在畫布。');}; field(spec.label||(c.type==='lamp'&&key === "model" ? "燈泡模型" : c.type==='switch'&&key==='closed'?"開關狀態":key), input); }
        else {
          const factor = ['position','linearLoss'].includes(key) ? 100 : spec.factor||1;
          const input = document.createElement("input"); input.type = "number"; input.value = c.params[key] * factor; input.min = spec.min * factor; input.max = (spec.controlSpecial??spec.max) * factor; input.step = "any"; input.disabled = !enabled; input.dataset.param = key; input.dataset.component = c.id; input.onchange = () => { const value = input.valueAsNumber / factor; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; field(transient?[...Q.labelParts(spec.label),...(spec.unit?[' · ',Q.unit(spec.unit)]:[])]:spec.unit?[spec.label+' · ',Q.unit(spec.unit)]:spec.label,input);
          if (["voltage", "resistance", "position"].includes(key)||transient&&(R.get(c.type).primaryParameter===key||spec.slider)) {
            const range = document.createElement("input"),preferredMax=key==='position'?1:key==='voltage'?24:c.type==='battery'?10:100;
            const commonMin=teacher&&spec.sliderMin<spec.max?Math.max(spec.min,spec.sliderMin):spec.min;
            range.type = "range"; range.min = Math.min(c.params[key],commonMin) * factor;
            range.max = (spec.controlMax??(spec.slider?spec.max:Math.min(spec.max,Math.max(preferredMax<=spec.min?spec.max:preferredMax,c.params[key])))) * factor;
            range.step = c.params[key]<commonMin?"any":(spec.controlStep??spec.step) * factor; range.value = c.params[key] * factor; range.disabled = !enabled; range.setAttribute("aria-label", spec.label + "滑塊");if(teacher&&spec.sliderMin)range.title="常用範圍 "+commonMin*factor+"–"+range.max+" "+spec.unit+"；較小數值可在數字欄設定。";
            range.oninput = () => {
              if(!range.isConnected||!allow(history.get(),c,"params",key))return;
              const candidate=M.clone(history.get());candidate.components.find(x=>x.id===c.id).params[key]=Number(range.value)/factor;
              try{profile.assertTransition(history.get(),candidate,readOnly);}catch(e){cancel();notify(e.message,true);return;}
              input.value=range.value;previewParameter(candidate);render(false);
              const result=prop.querySelector('.reading-host');if(result)result.innerHTML=componentReadings(c.id);
            };
            if(spec.controlSpecial){const special=document.createElement('button');special.type='button';special.className='ac-frequency-special';special.textContent='50 Hz · 真實交流';special.setAttribute('aria-pressed',String(c.params[key]===spec.controlSpecial));special.disabled=!enabled;special.onclick=()=>change(doc=>{doc.components.find(x=>x.id===c.id).params[key]=spec.controlSpecial;});prop.append(special);}
            range.onchange = () => { if(!range.isConnected||!previewDoc)return;const value = Number(range.value) / factor; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; range.onpointercancel = cancel; prop.append(range);
          }
        }
      }
      if(protection){
        if(c.params.protectionEnabled)for(const key of ['maxCurrent','maxPower']){const spec=profile.parameterSpec(c,key),input=document.createElement('input');input.type='number';input.value=c.params[key];input.min=spec.min;input.max=spec.max;input.step='any';input.dataset.param=key;input.disabled=!allow(d,c,'params',key);input.onchange=()=>change(doc=>{doc.components.find(x=>x.id===c.id).params[key]=input.valueAsNumber;});field([spec.label+' · ',Q.unit(spec.unit)],input,protection);}
        const status=document.createElement('p');status.dataset.protectionStatus=c.id;status.className='note';protection.append(status);
        const reset=button('重設保護',()=>controller.resetSourceProtection(c.id),!allow(d,c,'params','protectionEnabled'),false,protection);reset.dataset.protectionReset=c.id;
        const note=document.createElement('p');note.className='note';note.textContent='設定電壓為電動勢有效值；啟用時實際內阻至少 0.05 Ω（較大設定沿用），端電壓有壓降。按最近實測 RMS／平均輸出功率逐步調節，允許短暫超限及反應延遲；啟動仍在收集量測窗。';protection.append(note);prop.append(protection);renderProtectionStatus();
      }
      if(c.type==='lamp'&&(teacher||allow(d,c,'params','resistance'))){
        const input=document.createElement('input');input.type='number';input.step='any';input.min='.00000001';input.value=c.params.ratedVoltage**2/c.params.resistance;input.dataset.param='ratedPower';input.disabled=!allow(d,c,'params','resistance');input.onchange=()=>change(doc=>{if(!Number.isFinite(input.valueAsNumber)||input.valueAsNumber<=0)throw new Error('額定功率必須大於零');doc.components.find(x=>x.id===c.id).params.resistance=c.params.ratedVoltage**2/input.valueAsNumber;});field(['額定功率 · ',Q.unit('W')],input);
      }
      if(household)familyUI?.properties(c,d,prop,$('objectActions'));
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
      $("selectionTitle").textContent="導線 "+wire.id;prop.innerHTML=`<p class="note">A：${portHtml(wire.from)}<br>B：${portHtml(wire.to)}<br>目前長度 ${Math.round(G.length(routes[wire.id]))} / 上限 ${Math.round(wire.length)} 畫布單位</p>`+(profile.ui.readings?readingHost():'');
      if(profile.ui.wireCurrents)checkbox('顯示此導線電流',wireCurrents.has(wire.id),v=>setDiagramDisplay('wireCurrents',wire.id,v));
      if(profile.canSetWireResistance(d,readOnly)){const input=document.createElement('input');input.type='number';input.min=0;input.max=M.limits.resistance;input.step='any';input.value=wire.resistance;input.dataset.param='wireResistance';input.onchange=()=>execute({type:'setWireResistance',id:wire.id,value:input.valueAsNumber});field(['導線電阻 · ',Q.unit('Ω')],input);prop.insertAdjacentHTML('beforeend','<p class="note">0 Ω 為理想導線；阻值不隨拖動或彎線改變。</p>');}
      else if(d.display.values)prop.insertAdjacentHTML('beforeend',readings([[household?'導線等效電阻':'導線電阻',household?analysis.wires[wire.id]?.resistance:wire.resistance,'Ω']]));
      if(wireAllowed())["from","to"].forEach((key,i)=>{const input=document.createElement("select");input.dataset.end=key;const none=document.createElement("option");none.value="";none.textContent="選接線對象";input.append(none);
        for(const [id]of M.wireEndpoints(d)){if(id===wire[key]||(id===wire[key==="from"?"to":"from"]&&!M.attached(d,wire,key==="from"?"to":"from")))continue;const o=document.createElement("option");o.value=id;o.textContent=portName(id);input.append(o);}
        input.id=prefix+'wire-end-'+key;const caption=document.createElement('label');caption.className='connection-caption';caption.htmlFor=input.id;caption.textContent=(i?'B':'A')+'端接到';
        const row=document.createElement('div');row.className='connection-controls';row.dataset.wireEnd=key;prop.append(caption,row);row.append(input);
        button("接好 "+(i?"B":"A"),()=>{if(!input.value)return notify("先選擇接線對象。",true);change(doc=>{if(!M.attach(doc,wire.id,key,input.value))throw new Error("導線太短；移近元件或用另一條線接長");});},false,false,row);
        button("拔開 "+(i?"B":"A"),()=>unplug(wire.id,key),!M.attached(d,wire,key),false,row);
      });
      if(wireAllowed())prop.insertAdjacentHTML('beforeend','<p class="note connection-legend">接合接頭：接好　分離接頭：拔開</p>');
      button("整理線形",()=>tidy(wire.id),!wireAllowed());
    }else if(selection?.kind==="port"||selection?.kind==="junction"){
      const endpoint=selection.kind==="junction"?selection.id+":p":selection.id;$("selectionTitle").textContent=portName(endpoint);if(profile.ui.readings){prop.innerHTML=readingHost();}if(profile.ui.probe&&!household)button("設為 0 V",()=>change(doc=>doc.display.reference=endpoint),readOnly);
      if(!probeMode)d.wires.filter(w=>w.from===endpoint||w.to===endpoint).forEach(w=>button("選導線 "+w.id,()=>{selection={kind:"wire",id:w.id};render();}));
    }else{$("selectionTitle").textContent=profile.ui.readings&&probeResult?"兩點量測":analysis.diagnostics.length?"電路提示":"";if(profile.ui.readings&&probeResult)prop.innerHTML=readingHost();}
    for(const diagnostic of analysis.diagnostics){const p=document.createElement("p");p.className="diagnostic";p.textContent=diagnostic.message;prop.append(p);}
    $("selectionTitle").closest('.inspector')?.toggleAttribute('hidden',!profile.ui.inspector||!prop.childElementCount&&!$("objectActions").childElementCount);
    const list=$("wireList");list.replaceChildren();d.wires.forEach(w=>{const row=document.createElement("div");row.className="wire-row";const b=document.createElement("button");b.innerHTML=V.esc(w.id)+" · "+portHtml(w.from)+" → "+portHtml(w.to);b.onclick=()=>{selection={kind:"wire",id:w.id};render();focusPoint(G.along(routes[w.id],G.length(routes[w.id])/2));};const del=document.createElement("button");del.className="delete";del.textContent="×";del.setAttribute("aria-label","刪除導線 "+w.id);del.onclick=()=>{cancel();change(doc=>M.remove(doc,w.id));};row.append(b);if(wireAllowed())row.append(del);list.append(row);});
  }
  function relayReadings(c,r){return readings([['線圈兩端電壓',r.voltage,'V'],['線圈電流',r.current===null?null:r.current*1000,'mA'],['觸點支路電流',r.contactCurrent,'A'],['線圈功率',r.power,'W']])+'<p class="note">'+(r.contact===null?'銜鐵移動中 · 兩邊斷開':r.contact==='e'?'已吸合 · 接下觸點':'未吸合 · 接上觸點')+'</p>';}
  function acReadings(c,r,host=null,refreshNotes=false){
    const currentView=value=>V.displayCurrent(current(),analysis,c.id+':a',value,labelOptions.currentReferences);
    if(['capacitor','inductor','transformer'].includes(c.type))r=V.displayComponent(current(),analysis,c,labelOptions.currentReferences);
    if(!R.isMeter(c))r={...r,current:currentView(r.current),secondaryCurrent:c.type==='transformer'?V.displayCurrent(current(),analysis,c.id+':c',r.secondaryCurrent,labelOptions.currentReferences):r.secondaryCurrent};
    let q=analysis.measurements?.[c.id];if(q&&['capacitor','inductor'].includes(c.type)&&V.storedEnergyInvisible(current(),analysis,c.id+':a'))q={...q,currentRms:0,voltageRms:0,averagePower:0};if(q&&!R.isMeter(c))q={...q,currentRms:currentView(q.currentRms)};const g=c.type==='galvanometer',measuresCurrent=g||c.type==='ac-ammeter',voltage=c.type==='ac-voltmeter',power=c.type==='ac-wattmeter';
    if(!R.isMeter(c)){const small=value=>Number.isFinite(value)&&Math.abs(value)<1e-6?0:value;if(r.current===0){r.voltage=small(r.voltage);r.power=small(r.power);}if(q?.currentRms===0){q.voltageRms=small(q.voltageRms);q.averagePower=small(q.averagePower);}}
    if(R.isMeter(c)){const show=value=>g?Number.isFinite(value)?value:null:R.meterDisplayReading(c,r,value);r={...r,reading:show(r.reading),estimatedReading:show(r.estimatedReading??null),current:measuresCurrent?show(r.current):r.current,voltage:voltage?show(r.voltage):r.voltage};if(q)q={...q,currentRms:measuresCurrent?show(q.currentRms):q.currentRms,voltageRms:voltage?show(q.voltageRms):q.voltageRms,averagePower:power?show(q.averagePower):q.averagePower};}
    // G is resistive: below its current resolution, its corresponding U/P are also unreadable.
    if(g){if(r.current===0&&Number.isFinite(r.voltage))r.voltage=0;if(q?.status==='ready'&&q.currentRms===0){q.voltageRms=0;q.averagePower=0;}}
    r={...r,energy:V.displayEnergy(r.energy)};
    const wattmeter=['wattmeter','ac-wattmeter'].includes(c.type);
    const items=[[wattmeter?'電壓端瞬時電壓（V₊−V₋）':'瞬時電壓',wattmeter?r.sensedVoltage:r.voltage,'V'],['瞬時電流（a → b）',r.current,'A']];
    if(q&&r.meterStatus!=='unconnected'&&r.meterStatus!=='missing-common'){if(q.voltageStatus==='ready')items.push([wattmeter?'電壓端有效值（V₊−V₋）':'電壓有效值',q.voltageRms,'V']);if(q.currentStatus==='ready')items.push(['電流有效值',q.currentRms,'A']);if(q.powerStatus==='ready')items.push([c.type==='transformer'?'原線圈平均輸入功率':c.type==='rheostat'?'元件總平均有功功率':'平均有功功率',q.averagePower,'W']);}
    if(c.type==='capacitor')items.push(['極板電荷',r.charge,'C'],['電場儲能',r.energy,'J']);
    if(c.type==='inductor')items.push(['磁場儲能',r.energy,'J']);
    if(c.type==='transformer'){items.push(['副線圈瞬時電壓',r.secondaryVoltage,'V'],['副線圈瞬時電流',r.secondaryCurrent,'A']);items.push(['共同磁通',r.coreFlux,'Wb']);if(c.params.model==='coupled'&&r.energy!==undefined)items.push(['耦合磁場儲能',r.energy,'J']);}
    if(['battery','ac-source'].includes(c.type))items.push(['電源電動勢',r.sourceEmf,'V']);
    if(c.type==='generator')items.push(['線圈角度',r.phase*180/Math.PI,'°'],['單匝磁通量',r.flux,'Wb'],['總磁通量',r.fluxLinkage,'Wb'],['感應電動勢',r.sourceEmf,'V']);
    if(r.unit)items.push([Number.isFinite(r.estimatedReading)?'暫估讀值':'儀表讀值',Number.isFinite(r.estimatedReading)?r.estimatedReading:r.reading,r.unit]);
    const patched=host&&reactiveReadings(c,items,r,host);if(patched&&!refreshNotes)return;
    const distinctWindows=q&&new Set([q.voltageWindow,q.currentWindow,q.powerWindow].filter(Number.isFinite)).size>1,windowNote=distinctWindows?'<p class="note">'+rich(['各項按相關電源分別收集：電壓 ',Q.quantity(q.voltageWindow,'s'),'、電流 ',Q.quantity(q.currentWindow,'s'),'、功率 ',Q.quantity(q.powerWindow,'s'),'。'])+'</p>':q&&q.windowKind!=='cycle'?'<p class="note">'+rich([q.windowKind==='common-cycle'?'量測採共同週期：':q.windowKind==='natural'?'量測採自由振盪參考窗：':'量測採時間窗：',Q.quantity(q.window,'s'),q.windowKind==='time'&&q.frequencies?.length>1?'；多頻率信號，這個時間窗不是共同週期。':'。'])+'</p>':'';
    const connectionNote=c.type==='ac-wattmeter'?'<p class="note">'+rich(['電流端 ',Q.symbol('Iplus'),'／',Q.symbol('Iminus'),' 串聯；電壓端 ',Q.symbol('Vplus'),'／',Q.symbol('Vminus'),' 並聯。反接其中一組，功率讀值會反號。'])+'</p>':'';
    const unknown=q?[['voltageStatus','電壓'],['currentStatus','電流'],['powerStatus','功率']].filter(([key])=>q[key]==='unknown').map(([,name])=>name):[],measurementNote=(unknown.length?'<p class="note">'+unknown.join('／')+'未能唯一確定；保留可確定的讀數。</p>':'')+(q&&[q.voltageStatus,q.currentStatus,q.powerStatus].includes('collecting')?'<p class="note">'+rich(['收集完整量測窗：',Q.quantity(Math.max(0,q.end-q.start),'s'),'／',Q.quantity(q.window,'s'),'。',Number.isFinite(r.estimatedReading)?'暫估根據已取得的樣本，未滿完整週期／時間窗，讀數仍可能變動。':''])+'</p>':'');
    const notes=(['unconnected','missing-common'].includes(r.meterStatus)?'<p class="note">電表未接妥；指針回零，尚無量測讀值。</p>':analysis.reliable===false?'<p class="note">量測未能可靠確定，模擬已暫停。</p>':measurementNote)+windowNote+connectionNote;
    if(patched){const slot=host.querySelector('[data-reading-notes]');if(slot&&slot.innerHTML!==notes)slot.innerHTML=notes;return;}
    const html=reactiveReadings(c,items,r)+'<div data-reading-notes>'+notes+'</div>';if(host)host.innerHTML=html;else return html;
  }
  function reactiveReadings(c,items,r,host=null){const rows=items.map(([label,value,unit])=>({label,value,unit,key:label.includes('讀值')?(['ac-ammeter','ac-voltmeter'].includes(c.type)?'meterReadingRms':'meterReading'):label.includes('共同磁通')?'coreFlux':label.includes('角度')?'phase':label.includes('總磁通量')?'fluxLinkage':label.includes('磁通量')?'flux':label.includes('電動勢')?'sourceEmf':label.includes('副線圈瞬時電壓')?'secondaryVoltage':label.includes('副線圈瞬時電流')?'secondaryCurrent':label.includes('電荷')?'charge':label.includes('儲能')?'energy':label.includes('電流')?label.includes('有效值')?'currentRms':'current':label.includes('功率')?'power':label.includes('有效值')?'voltageRms':'voltage'})),options={paused,now:performance.now(),result:r,doc:current(),preserveTiny:!['capacitor','inductor','generator','transformer'].includes(c.type)};
    if(host){const bars=[...host.querySelectorAll('[data-readout-bar]')];if(bars.length!==rows.length||rows.some((row,i)=>bars[i].dataset.readoutBar!==row.key||bars[i].querySelector('[role=meter]').getAttribute('aria-label')!==row.label))return false;rows.forEach((row,i)=>reactiveReadouts.update(bars[i],c,row.key,row.value,row.unit,{...options,label:row.label}));return true;}
    return '<dl class="readings ac-reading-bars">'+rows.map(row=>'<dt>'+Q.labelHtml(row.label)+'</dt><dd>'+reactiveReadouts.html(c,row.key,row.value,row.unit,{...options,label:row.label})+'</dd>').join('')+'</dl>';
  }
  function updateSelectionReadings(refreshNotes=false){const host=$('properties').querySelector('.reading-host'),c=selectedComponent();if(!host)return;if(transient&&c)acReadings(c,analysis.components[c.id],host,refreshNotes);else if(refreshNotes){const html=selectionReadings();if(host.innerHTML!==html)host.innerHTML=html;}}
  function componentReadings(id) { const c = current().components.find((c) => c.id === id), r = analysis.components[id]; if (!c || !r) return ""; if(household)return familyUI?.readings(c,r,readings)||''; if(transient)return acReadings(c,r); if(c.type==='relay')return relayReadings(c,r); const isRheo=c.type==='rheostat',g=c.type==='galvanometer';const items = [[isRheo?'A–P 電壓':"兩端電壓", r.voltage, "V"], [c.type === "battery" ? "向外供出電流" : R.dualMeter(c)?'所接正極 → − 電流':isRheo?'A → P 電流':g?"+ → − 電流":"a → b 電流", c.type === "battery" && r.current !== null ? -c.params.polarity * r.current : g&&Number.isFinite(r.current)?R.meterDisplayReading(c,r,r.current)*1e6:r.current, g?'μA':"A"], [c.type === "battery" ? "端口輸出功率" : "吸收功率", c.type === "battery" ? r.delivered : r.power, "W"]]; if (c.type === "battery") items.push(["內阻發熱", r.internalPower, "W"], ["電源總供能", r.sourcePower, "W"]); if (c.type === "lamp") items.push(["工作電阻", r.resistance, "Ω"]);if(isRheo){items.push(['A–P 電阻',R.effectiveResistance(c),'Ω']);if(c.params.terminals>2)items.push(['P–B 電阻',c.params.resistance*(1-c.params.position),'Ω'],['A–B 電壓',analysis.voltage(id+':a',id+':c'),'V']);} if (r.unit) items.push(["儀表讀值", g&&Number.isFinite(r.reading)?R.meterDisplayReading(c,r)*1e6:R.meterDisplayReading(c,r), g?'μA':r.unit]);if(R.dualMeter(c)||g)items.push([g?'滿偏電流':'目前量程',g?r.range*1e6:r.range,g?'μA':r.unit],['每小格',g?r.division*1e6:r.division,g?'μA':r.unit]);return readings(items); }
  function inspectMeter(c=selectedComponent()){if(!inspectableMeter(c))return;meterPreview=null;$('preview').hidden=true;const r=analysis.components[c.id],g=c.type==='galvanometer',ac=c.type.startsWith('ac-'),factor=g?1e6:1,unit=g?'μA':r.unit,status=ac&&r.meterStatus==='unconnected'?'請接妥電表接孔':ac&&r.meterStatus==='collecting'?Number.isFinite(r.estimatedReading)?'暫估（尚未收齊完整量測窗）':'收集量測中':V.statusText(r);$('meterTitle').textContent=ac?c.type==='ac-wattmeter'?'交流功率表刻度':'交流電表刻度':g?'靈敏電流計刻度':'雙量程錶盤';$('meterDetail').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ac?'-43 -40 86 62':g?'-50 -45 100 90':'-78 -85 156 119'}" aria-label="${V.esc(c.label)}刻度">${ac?root.CircuitAC.meterFace(c,r,history.get().display):g?V.galvanometerDial(c,r,history.get().display.values):V.dualDial(c,r,history.get().display.values)}</svg><p>${rich([c.label+' · ',...(ac?['量程 ',Q.quantity(r.range,unit)]:g?['中心零，滿偏 ±',Q.quantity(r.range*factor,unit)]:r.activePort?['接 ',Q.quantity(r.range,r.unit),' 孔']:['未選單一量程'])])}<br>${ac?'<span data-meter-status="'+V.esc(c.id)+'">'+V.esc(status)+'</span>；':''}${rich([!ac&&status?status+'；':'','每小格 ',Q.quantity(r.division*factor,unit),'；負刻度至 ',Q.quantity(r.minimum*factor,unit)])}</p>`;$('meterDialog').showModal();updateMeterNeedles();}

  function nameHtml(label){const spec=Q.componentName(label);return spec.tex?Q.html(spec):V.esc(label);}
  function portHtml(id){const text=portName(id),c=current().components.find(c=>id.startsWith(c.id+':'));return profile.ui.mathNames&&c?nameHtml(c.label)+V.esc(text.slice(c.label.length)):V.esc(text);}
  function portName(id){
    const d=history.get(),[cid,key]=id.split(":"),c=d.components.find(c=>c.id===cid);if(!c)return M.degree(d,id)>1?"共接點 "+cid:"懸空線端 "+cid;
    const ports=R.ports(c),p=ports.find(p=>p.key===key);if(p?.labelVisible!==false||household&&d.display.terminalLabels)return c.label+' '+p?.label;
    const side=q=>{const dx=q.dx||q.dy?q.dx:q.x-c.x,dy=q.dx||q.dy?q.dy:q.y-c.y;return Math.abs(dx)>Math.abs(dy)?dx<0?'左':'右':dy<0?'上':'下';},direction=side(p),vertical=['左','右'].includes(direction),axis=vertical?'y':'x',other=vertical?'x':'y';
    const peers=ports.filter(q=>q.labelVisible===false&&side(q)===direction).sort((a,b)=>Math.abs(a[axis]-b[axis])>1e-6?a[axis]-b[axis]:a[other]-b[other]),rank=peers.findIndex(q=>q.key===key);
    let position=direction;if(peers.length>1){const words=vertical?['上','中','下']:['左','中','右'];position+=peers.length<=3&&new Set(peers.map(q=>q[axis].toFixed(6))).size===peers.length?words[peers.length===2?rank*2:rank]:'側第 '+(rank+1)+' 個';}
    return c.label+' '+position+'接線端';
  }
  function quickParameter(binding=selection){
    if(!profile.ui.quickParameters||!binding)return null;
    const d=history.get(),c=d.components.find(c=>c.id===binding.id);if(!c)return null;
    const key=R.get(c.type).primaryParameter;let spec=profile.parameterSpec(c,key);
    if(spec?.legacyChoices?.includes(c.params[key]))spec={...spec,choices:[c.params[key],...spec.choices]};
    const p=R.primaryParameter(c,spec)||(household&&spec?.choices?{...spec,key,value:c.params[key],factor:1}:null);return p&&(!binding.key||binding.key===p.key)&&allow(d,c,'params',p.key)?{c,p}:null;
  }
  const quickChoice=household?document.createElement('select'):null;
  if(quickChoice){quickChoice.hidden=true;quickChoice.dataset.householdQuick='true';$('quickValue').parentElement.append(quickChoice);quickChoice.onchange=()=>{const data=quickParameter(quickBinding);if(data?.p.choices)setQuickParameter(data.p.choices.find(value=>String(value)===quickChoice.value));};}
  function renderQuickParameters(){
    const controls=[$('quickValue'),$('quickMinus'),$('quickPlus')];
    // Freeze selection/layout during canvas gestures, not ordinary footer taps.
    // Playback can repaint between touch down and the native click on release;
    // disabling a pressed button here would discard that click.
    if(drag||cameraGesture||touchBlocked||[...touches.values()].some(t=>t.central)){controls.forEach(e=>e.disabled=true);if(quickChoice)quickChoice.disabled=true;return;}
    const selected=selectedComponent();$('hint').parentElement.classList.toggle('has-meter',!!selected&&(R.dualMeter(selected)||selected.type==='galvanometer'));
    const focused=document.activeElement,editing=[$('quickValue'),quickChoice].includes(focused)&&quickBinding?.id===selection?.id?quickParameter(quickBinding):null;
    if(editing&&(focused===$('quickValue')||editing.p.choices?.length===quickChoice.options.length&&editing.p.choices.every((value,i)=>String(value)===quickChoice.options[i].value)&&quickChoice.value===String(editing.p.value)))return;
    const data=quickParameter();$('quickParameters').hidden=!data;
    $('hint').parentElement.classList.toggle('has-quick',!!data);quickBinding=data?{id:data.c.id,key:data.p.key}:null;
    controls.forEach(e=>e.disabled=!data);$('quickValue').removeAttribute('aria-invalid');
    if(quickChoice){quickChoice.hidden=!data?.p.choices;quickChoice.disabled=!data;}
    if(!data){$('quickValue').value='';$('quickValue').removeAttribute('data-param');return;}
    const {c,p}=data,label=c.label+' · '+p.label;
    $('quickName').textContent=label;$('quickName').title=label;$('quickParameters').setAttribute('aria-label',label);
    $('quickLabel').textContent=label+(p.unit?' · '+p.unit:'');$('quickUnit').innerHTML=p.unit?rich(Q.unit(p.unit)):'';
    if(p.choices){quickChoice.replaceChildren(...p.choices.map(v=>new Option(p.labels?.[v]||String(v),String(v))));quickChoice.selectedIndex=p.choices.indexOf(p.value);quickChoice.setAttribute('aria-label',label);const width=typeof p.value==='number'?64:136;$('quickValue').parentElement.style.width=width+'px';$('hint').parentElement.classList.toggle('has-wide-param',width>64);$('quickMinus').disabled=quickChoice.selectedIndex<=0;$('quickPlus').disabled=quickChoice.selectedIndex>=p.choices.length-1;return;}
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
    if(p.choices){if(!p.choices.includes(value))return false;return execute({type:'setParam',id:c.id,key:p.key,value});}
    if(!Number.isFinite(value)||value<p.min||value>p.max){renderQuickParameters();$('quickValue').setAttribute('aria-invalid','true');notify(['請輸入 ',Q.quantity(p.min*p.factor,p.unit),' 至 ',Q.quantity(p.max*p.factor,p.unit),'。'],true);return false;}
    const changed=execute({type:'setParam',id:c.id,key:p.key,value});
    if(changed||value===p.value){notify([c.label+' · '+p.label+'：',Q.quantity(value*p.factor,p.unit)]);$('canvasNotice').hidden=true;}
    return changed;
  }
  $('quickValue').onchange=()=>{const data=quickParameter(quickBinding);if(data)setQuickParameter($('quickValue').valueAsNumber/data.p.factor);};
  $('quickValue').oninput=()=>{if($('quickValue').hasAttribute('aria-invalid'))$('canvasNotice').hidden=true;$('quickValue').removeAttribute('aria-invalid');};
  on($('quickValue'),'keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('quickValue').blur();}});
  for(const [id,direction]of [['quickMinus',-1],['quickPlus',1]])$(id).onclick=()=>{const data=quickParameter(quickBinding);if(data)setQuickParameter(data.p.choices?data.p.choices[data.p.choices.indexOf(data.p.value)+direction]:R.stepPrimaryParameter(data.c,direction,profile.parameterSpec(data.c,data.p.key)));};
  function connectionLabel(id){const [cid,key]=id.split(":"),c=current().components.find(c=>c.id===cid);if(!c||!R.dualMeter(c))return[portName(id)];
    return key==="b"?[c.label+" · 共用 − 孔"]:[c.label+" · +",Q.quantity(key==="c"?c.params.range/5:c.params.range,c.type==="ammeter"?"A":"V")," 孔"];}
  function rotate(id,direction=1){const c=history.get().components.find(c=>c.id===id);if(!c||!allow(history.get(),c,"rotate"))return;cancel();if(change(doc=>M.rotateComponent(doc,id,direction)))notify("元件已旋轉，所連導線已自動拉直。");}
  function flipMeter(id){cancel();if(change(doc=>M.flipMeter(doc,id)))notify('接孔已左右換位，接線保持連接。');}
  function unplug(id,key){cancel();change(doc=>{M.detach(doc,id,key);selection={kind:"wireend",id,end:key};});notify("已拔開這一端，導線留在畫布，可重新接線。");}
  function straighten(id){cancel();if(change(doc=>M.straightenWire(doc,id)))notify("導線已拉直，兩端接線保持不變；可再拿線身彎曲。");}
  function tidy(id){cancel();change(doc=>{doc.wires.filter(w=>!id||w.id===id).forEach(w=>{const points=G.route(doc,w),clean=G.smooth(G.simplify(points,12));const fitted=G.fitLength(G.resample(clean,10),w.length);if(!fitted)throw new Error('導線已拉盡；移近端點後再整理線形。');w.shape="free";w.via=fitted.slice(1,-1).map(p=>({x:p.x,y:p.y}));});});}
  function wirePlacement(doc,endpoint){
    const width=surface.clientWidth,height=surface.clientHeight,pad=Math.min(32,width/4,height/4),box=canvasBounds(),left=Math.max(pad,box.left),right=Math.min(width-pad,box.right),top=Math.max(pad,box.top),bottom=Math.min(height-pad,box.bottom),edgeX=Math.max(pad,Math.min(22,width/2)),clampY=v=>Math.max(top,Math.min(bottom,v)),length=Math.min(120,doc.cables.length*.65*camera.scale,right-left);
    if(endpoint){
      const origin=M.endpoints(doc).get(endpoint);if(!origin)throw Error('接線點不存在');
      const p=screen(origin),nx=origin.dx||0,ny=origin.dy||0,paths=doc.wires.map(w=>G.simplify(G.route(doc,w).map(screen),1)),bodies=doc.components.filter(c=>!endpoint.startsWith(c.id+':')).map(c=>{const b=R.bodyBounds(c);return{a:screen({x:b.left,y:b.top}),b:screen({x:b.right,y:b.bottom})};}).filter(box=>p.x<box.a.x||p.x>box.b.x||p.y<box.a.y||p.y>box.b.y),candidates=[];
      const incident=doc.wires.filter(w=>w.from===endpoint||w.to===endpoint),wire=incident.find(w=>w.id===selection?.id)||incident[0];
      const path=wire?paths[doc.wires.indexOf(wire)]:[],next=wire?.from===endpoint?path[1]:path.at(-2),angle=next?Math.atan2(p.y-next.y,p.x-next.x):Math.atan2(ny,nx);
      for(let n=0;n<16;n++){
        const a=angle+n*Math.PI/8,q={x:Math.max(edgeX,Math.min(width-edgeX,p.x+Math.cos(a)*length)),y:clampY(p.y+Math.sin(a)*length)},span=Math.hypot(q.x-p.x,q.y-p.y),f=Math.min(1,length/(span||1));q.x=p.x+(q.x-p.x)*f;q.y=p.y+(q.y-p.y)*f;
        if(q.x<edgeX-1e-6||q.x>width-edgeX+1e-6||q.y<top-1e-6||q.y>bottom+1e-6||(box.exclusions||[]).some(g=>q.x+22>g.left+1e-6&&q.x-22<g.right-1e-6&&q.y+22>g.top+1e-6&&q.y-22<g.bottom-1e-6))continue;
        const dx=q.x-p.x,dy=q.y-p.y,reach=Math.hypot(dx,dy);if(reach<.01)continue;
        let clearance=24,clear=true;
        // Taper the clearance at the shared origin so a clear continuation remains preferred.
        for(let i=1;i<=16;i++){
          const point={x:p.x+dx*i/16,y:p.y+dy*i/16};let distance=24;
          for(const path of paths)distance=Math.min(distance,G.nearest(path,point)?.distance??24);
          for(const box of bodies)distance=Math.min(distance,Math.hypot(Math.max(box.a.x-point.x,0,point.x-box.b.x),Math.max(box.a.y-point.y,0,point.y-box.b.y)));
          clearance=Math.min(clearance,distance);if(distance<Math.min(12,reach*i/32))clear=false;
        }
        candidates.push({...q,clearance,reach,preferred:n===0&&clear&&reach>=length*.95,outward:nx*dx+ny*dy>= -1e-6&&reach>=Math.min(32,length/2)});
      }
      const outward=candidates.filter(q=>q.outward),available=outward.length?outward:candidates;
      available.sort((a,b)=>Number(b.preferred)-Number(a.preferred)||(Math.abs(b.clearance-a.clearance)>.01?b.clearance-a.clearance:b.reach-a.reach));
      const best=available[0];if(!best)throw Error('接點太近畫布邊緣，請先移動畫布或放大再取線。');
      return{from:origin,to:{x:camera.x+best.x/camera.scale,y:camera.y+best.y/camera.scale}};
    }
    const rows=Math.max(1,Math.floor((bottom-top)/28)),middle=(left+right)/2;let x=middle,y=bottom;
    for(let n=0;n<=doc.wires.length;n++){x=Math.max(left+length/2,Math.min(right-length/2,middle+(Math.floor(n/rows)%2?1:-1)*Math.ceil(Math.floor(n/rows)/2)*28));y=clampY(bottom-(n%rows)*28);if(!doc.wires.some(w=>{const points=G.route(doc,w),q=screen(G.along(points,G.length(points)/2));return Math.hypot(q.x-x,q.y-y)<22;}))break;}
    return{from:{x:camera.x+(x-length/2)/camera.scale,y:camera.y+y/camera.scale},to:{x:camera.x+(x+length/2)/camera.scale,y:camera.y+y/camera.scale}};
  }
  function takeWire(endpoint=null){if(!wireAllowed())return false;cancel();panMode=false;probeMode=false;const fitted=autoFit;autoFit=false;const ok=change(doc=>{const p=wirePlacement(doc,endpoint),w=addWire(doc,(p.from.x+p.to.x)/2,(p.from.y+p.to.y)/2);M.moveWireEnd(doc,w.id,'from',p.from);M.moveWireEnd(doc,w.id,'to',p.to);if(endpoint&&!M.attach(doc,w.id,'from',endpoint))throw Error('導線未能接到此接點');selection={kind:'wireend',id:w.id,end:'to'};selectedConnection=endpoint;});if(!ok)autoFit=fitted;else notify(endpoint?'導線已由接點接出，拖自由端繼續接線。':'導線已放在畫布下方，拖動線端接線。');return ok;}
  $("quickWire").onclick=()=>takeWire();
  on($("addWire"),'click',e=>{if(suppressedToolClick($("addWire"),e))return;takeWire();});
  for(const [id,key]of [['cableCount','count'],['cableResistance','resistance']]){
    on($(id),'input',()=>settingsDrafts.set(id,$(id).value));
    $(id).onchange=()=>commitSetting(id,key);
    on($(id),'keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(commitSetting(id,key))$(id).blur();}});
  }
  $("cableLength").onchange=()=>change(doc=>{doc.cables.length=Number($("cableLength").value);});
  function moveObject(base,kind,id,dx,dy){const candidate=f=>{const d=M.clone(base),item=(kind==="body"?d.components:d.junctions).find(x=>x.id===id);item.x+=dx*f;item.y+=dy*f;if(!M.reconcile(d,base))return null;try{M.validate(d);return d;}catch{return null;}};let d=candidate(1);if(d)return {doc:d,limited:false};let low=0,high=1;for(let n=0;n<28;n++){const mid=(low+high)/2;if(candidate(mid))low=mid;else high=mid;}return {doc:candidate(low),limited:true};}
  on(document,"pointerdown",e=>{
    if(!owned(e)){if(activeHost===host)activeHost=null;return;}
    if(host.contains(e.target))activeHost=host;
    if(e.target.closest('.ac-scopes,.ac-scope-dialog,.ac-scope-picker,.ac-scope-tool'))return;
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
    const t=e.target.closest(".hit");if(!t&&e.pointerType==="mouse")blankMouseDown=e;
    if(probeMode)return;
    const d=history.get();let meta=t?.meta,tapMeta=meta;
    if(meta?.kind==='wireend'&&M.attached(d,d.wires.find(w=>w.id===meta.id),meta.end)&&!selectedWire()){const endpoint=d.wires.find(w=>w.id===meta.id)[meta.end],component=d.components.find(c=>c.id===endpoint.split(':')[0]);meta=tapMeta={kind:component?'port':'junction',id:component?endpoint:endpoint.split(':')[0]};}
    if(meta?.kind==='hand'){
      const p=world(e.clientX,e.clientY),ports=R.ports(d.components.find(c=>c.id===meta.id));
      ports.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));meta=tapMeta={...meta,endpoint:ports[0].id};
    }
    if(household&&meta?.kind==='junction'&&!wireMode){
      const p=world(e.clientX,e.clientY),j=d.junctions.find(j=>j.id===meta.id),c=j&&Math.hypot(j.x-p.x,j.y-p.y)*camera.scale>5&&d.components.findLast(c=>Family.switchHit(c,p,d.display.view));
      // The painted 5 px junction keeps its gesture; transparent padding must not cover a switch handle.
      if(c)meta=tapMeta={kind:'body',id:c.id,operateProtection:true};
    }
    const owner=meta&&['body','port','slider'].includes(meta.kind)&&d.components.find(c=>c.id===meta.id.split(':')[0]);
    if(owner&&!meta.operateProtection&&camera.scale<(R.dualMeter(owner)?.7:.55)){
      const p=world(e.clientX,e.clientY),features=['body:'+owner.id,'slider:'+owner.id,...R.ports(owner).map(p=>'port:'+p.id)].map(key=>targets.get(key)).filter(Boolean);
      features.sort((a,b)=>{const distance=t=>{const r=t.getBoundingClientRect(),q=world(r.left+r.width/2,r.top+r.height/2);return Math.hypot(q.x-p.x,q.y-p.y);};return distance(a)-distance(b);});if(features[0])meta=tapMeta=features[0].meta;
    }else if(meta?.kind==='port'){const p=world(e.clientX,e.clientY),ports=R.ports(owner).filter(p=>targets.has('port:'+p.id));ports.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));if(ports[0])meta=tapMeta={...meta,id:ports[0].id};}
    if(!meta||['detachConnection','addConnectionWire'].includes(meta.kind))return;
    if(meta.kind==='plug'&&(!household||!allow(d,d.components.find(c=>c.id===meta.id),'plug')))return;
    if(meta.kind==='hand'&&(!household||!allow(d,d.components.find(c=>c.id===meta.id),'move')||!allow(d,d.components.find(c=>c.id===meta.id),'params','stance')))return;
    if(meta.kind==='port'){const w=selectedWire(),key=w&&['from','to'].find(k=>w[k]===meta.id);meta=key?{kind:'wireend',id:w.id,end:key,endpoint:meta.id}:{kind:'body',id:meta.id.split(':')[0]};}if(["wire","wireend","junction"].includes(meta.kind)&&!wireAllowed())return;
    let readOnly=false;if(meta.kind==="body"||meta.kind==="slider"){const c=d.components.find(c=>c.id===meta.id);if(!allow(d,c,meta.kind==="slider"?"params":"move",meta.kind==="slider"?"position":undefined)){if(meta.kind!=="body"||e.pointerType!=="touch"||!readableMeter(d,c))return;readOnly=true;}}
    if(household&&meta.kind==='body')tapMeta={...tapMeta,operateProtection:Family.switchHit(d.components.find(c=>c.id===meta.id),world(e.clientX,e.clientY),d.display.view)};
    const before=selection&&M.clone(selection);selection={...meta};drag={...meta,pointerId:e.pointerId,pointerType:e.pointerType,target:t,down:world(e.clientX,e.clientY),x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,baseDoc:M.clone(d),selectionBefore:before,tapMeta,connectionBefore:selectedConnection,moved:false,snap:null,limited:false};
    if(readOnly)drag.kind="meterread";
    if(meta.kind==="wire"){const w=d.wires.find(w=>w.id===meta.id);drag.wholeWire=!M.attached(d,w,"from")&&!M.attached(d,w,"to");}
    // Keep the inspector stable until native click; iPad can cancel taps when it gains visible controls.
    if(meta.kind==="wireend")drag.start=M.endpoints(d).get(d.wires.find(w=>w.id===meta.id)[meta.end]);t.setPointerCapture(e.pointerId);render(e.pointerType!=="touch");
  });
  on(surface,"mousedown",e=>{
    // Native mousedown supplies the OS double-click count; pointerdown supplies capture ID.
    if(e.button===0&&e.detail===2&&blankMouseDown){e.preventDefault();startPan(blankMouseDown,true);}
    blankMouseDown=null;
  });
  if(household)on(surface,'touchstart',e=>{if(cameraGesture&&e.touches.length===2&&e.cancelable)e.preventDefault();},{passive:false});
  on(surface,"pointermove",e=>{
    if(touchBlocked||!drag||e.pointerId!==drag.pointerId)return;drag.lastX=e.clientX;drag.lastY=e.clientY;const p=world(e.clientX,e.clientY);drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;
    if(drag.kind==="pan"){autoFit=false;camera.x=drag.base.x-(e.clientX-drag.x)/camera.scale;camera.y=drag.base.y-(e.clientY-drag.y)/camera.scale;render(false);return;}if(!drag.moved)return;selectedConnection=null;
    if(drag.kind==="meterread"){render(false);return;}
    if(drag.kind==='hand'){
      const original=drag.baseDoc.components.find(c=>c.id===drag.id),start=R.ports(original).find(q=>q.id===drag.endpoint),wanted={x:start.x+p.x-drag.down.x,y:start.y+p.y-drag.down.y},position={x:original.x+wanted.x-start.x,y:original.y+wanted.y-start.y};let contact=null,distance=24/camera.scale;
      const snapped=wireAllowed()?J.component(drag.baseDoc,drag.id,position,distance,drag.endpoint,drag.baseDoc.components.filter(c=>c.type!=='house-person').flatMap(c=>R.ports(c))):null;
      if(!snapped)for(const c of drag.baseDoc.components.filter(c=>drag.endpoint===drag.id+':hand'?Family.isAppliance(c):c.type==='house-metal')){const point=Family.contactPoint(c,wanted),gap=Math.hypot(point.x-wanted.x,point.y-wanted.y);if(gap<distance){distance=gap;contact={id:c.id,...point};}}
      drag.snap=snapped?.snap||contact;drag.contactTarget=contact?.id||(snapped?.snap.endpoint?.endsWith(':case')?snapped.snap.endpoint.split(':')[0]:null);drag.limited=false;
      if(snapped)previewDoc=snapped.doc;
      else{const focus=contact||wanted,moved=moveObject(drag.baseDoc,'body',drag.id,focus.x-start.x,focus.y-start.y);previewDoc=moved.doc;if(moved.limited){drag.snap=null;drag.contactTarget=null;drag.limited=true;}}
      drag.focus=R.ports(previewDoc.components.find(c=>c.id===drag.id)).find(q=>q.id===drag.endpoint);
      try{profile.assertTransition(history.get(),previewDoc,readOnly);if(!paramSession)paramSession=session.fork();paramSession.update(previewDoc);if(drag.endpoint===drag.id+':hand')paramSession.contact(drag.id,drag.contactTarget);analysis=paramSession.read();render(false);}catch{cancel();}return;
    }
    drag.discardZone=discardZoneAt(drag,e.clientX,e.clientY);drag.discard=drag.discardZone&&canDiscard(drag)?drag.discardZone:null;
    if(drag.discardZone){drag.snap=null;drag.limited=false;renderGhost();return;}
    const dx=p.x-drag.down.x,dy=p.y-drag.down.y;previewDoc=M.clone(drag.baseDoc);drag.snap=null;drag.limited=false;
    if(drag.kind==="plug"){
      const original=drag.baseDoc.components.find(c=>c.id===drag.id),start=Family.plugPoint(original),result=Family.previewPlug(drag.baseDoc,drag.id,{x:start.x+dx,y:start.y+dy},wireAllowed()?24/camera.scale:0);
      previewDoc=result?.doc||M.clone(drag.baseDoc);drag.snap=result?.snap||null;drag.limited=!result;drag.focus=Family.plugPoint(previewDoc.components.find(c=>c.id===drag.id));
    }else if(drag.kind==="wireend"){
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
    try{profile.prepare(previewDoc);profile.assertTransition(history.get(),previewDoc,readOnly);}catch{previewDoc=null;return;}if(timed&&drag.kind==='slider')previewParameter(previewDoc);else analysis=solve(previewDoc);if(drag.limited){$("canvasNotice").textContent="線已拉盡；移近元件，或用另一條線接長。";$("canvasNotice").hidden=false;}render(false);
  });
  on(surface,"pointerup",e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;const done=drag,preview=previewDoc,discardZone=discardZoneAt(done,e.clientX,e.clientY);drag=null;if(!paramSession)previewDoc=null;const c=history.get().components.find(c=>c.id===done.id);meterPreview=done.pointerType==="touch"&&["body","meterread"].includes(done.kind)&&!done.moved&&readableMeter(history.get(),c)?{id:c.id,side:done.previewSide}:null;$("preview").hidden=true;suppressClick=done.moved||done.quick;
    // Footer reflow may move scene targets before the browser sends click.
    // Keep the original tap target rather than reselecting whatever moved under it.
    releasedMeta=!done.moved&&!done.quick&&done.kind!=="pan"?M.clone(done.tapMeta||selection):null;
    if(done.target.hasPointerCapture(e.pointerId))done.target.releasePointerCapture(e.pointerId);
    if(done.kind==='hand'){if(done.moved&&done.contactTarget&&done.endpoint===done.id+':hand')setContact(done.id,done.contactTarget,done.focus);else if(done.moved&&preview){if(change(doc=>Object.assign(doc,preview)))notify(done.snap?'手部已接觸接線位置。':done.limited?'導線已拉盡，接線保持不變。':'人物位置已更新。');}else{discardParamPreview();previewDoc=null;analysis=solve(history.get());render();}return;}
    if(discardZone){
      $('canvasNotice').hidden=true;analysis=solve(history.get());
      if(canDiscard(done,history.get())){if(change(doc=>{if(!canDiscard(done,doc))throw new Error('此物件不能拖放刪除');M.remove(doc,done.id);}))notify('已刪除；復原可還原，刪線歸還庫存。');}
      else{render();notify('仍有接線或不可移除，已放回原位。',true);}
      return;
    }
    if(preview&&done.moved&&change(doc=>Object.assign(doc,preview)))notify(done.limited?"導線已拉盡；移近元件或用另一條導線接長。":done.snap?done.kind==="body"?["元件已接線：",...connectionLabel(done.snap.id),"。"]:["端點已接好：",...connectionLabel(done.snap.id),"。拖另一端繼續接線。"]:done.kind==="wireend"?"未接上的端點已留在畫布，可再拿起接線。":done.kind==="wire"?"導線位置／線形已更新。":"位置已更新，接線保持連接。");
    if(paramSession){discardParamPreview();previewDoc=null;analysis=solve(history.get());}
    render(done.pointerType!=="touch"||done.moved);
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
    const endpoint=meta?.endpoint??(meta?.kind==='port'?meta.id:meta?.kind==='junction'?meta.id+':p':meta?.kind==='wireend'?history.get().wires.find(w=>w.id===meta.id)?.[meta.end]:null);
    if(probeMode){const id=e.detail?probeEndpointAt(e.clientX,e.clientY):endpoint;if(id&&M.endpoints(history.get()).has(id))probePort(id);return;}
    if(meta?.kind==='addConnectionWire'){takeWire(meta.id);return;}
    if(meta?.kind==='detachConnection'){const endpoint=meta.id;cancel();if(!wireAllowed())return;change(doc=>M.detachConnection(doc,endpoint,32/camera.scale));selectedConnection=null;selection=null;render();notify('已拆開並分開全部線端；復原可還原整組接線。');return;}
    selectedConnection=endpoint&&M.endpoints(history.get()).has(endpoint)?endpoint:null;
    if(meta){
      if(!(selectedConnection&&selectedWire()&&[selectedWire().from,selectedWire().to].includes(selectedConnection)))selection={...meta};const c=selectedComponent(),protection=c&&['house-breaker','house-rcd'].includes(c.type);if(meta.kind==="body"&&["switch","spdt","house-switch","house-breaker","house-rcd"].includes(c?.type)&&(!protection||meta.operateProtection===true)&&allow(history.get(),c,"switch"))execute({type:'toggleSwitch',id:meta.id});else render();
    }else{selection=null;render();}
  });
  function undo(redo=false){if(readOnly||!profile.undo)return false;cancel();if(session)sessionHistory.set(history.get(),session.capture());const changed=redo?history.redo():history.undo();if(changed&&session){const saved=sessionHistory.get(history.get());if(saved)replaceSession(Backend.Session.restore(saved));else replaceSession(new Backend.Session(history.get()));paused=true;}selection=null;analysis=solve(history.get());if(changed&&autoFit)fit();render();if(changed)emitChange();notify(redo?"已重做。":"已復原。");return changed;}
  on(window,"keydown",e=>{
    if(!host.contains(e.target)&&!(e.target===document.body&&activeHost===host))return;
    if(e.key==='Escape'&&$('selectionActionsDialog').open){e.preventDefault();$('selectionActionsDialog').close();return;}
    if(e.key==='Escape'&&$('settingsDialog').open){e.preventDefault();discardSettingsDrafts();$('settingsDialog').close();return;}
    const typing=/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.target.isContentEditable;if(e.key==="Escape"){cancel();probeFirst=null;notify("已取消目前拖動。");return;}if(typing)return;
    if((e.code==="Space"||e.key===" ")&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!host.querySelector("dialog[open]")&&(!e.target.closest("button,a")||surface.contains(e.target))){
      if(!spacePan){spacePan=true;spacePanUsed=false;surface.classList.add("quick-pan");}
      // A focused scene button accepts Space on release unless navigation used it.
      if(!e.target.closest("button"))e.preventDefault();return;
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo(e.shiftKey);return;}
    if(host.querySelector("dialog[open]"))return;
    if(probeMode)return;
    const focused=e.target.meta;if(focused)selection={...focused};
    if(e.key==='Enter'&&selection?.kind==='plug'){e.preventDefault();change(doc=>{const c=doc.components.find(c=>c.id===selection.id);if(!allow(doc,c,'plug'))throw Error('插頭已固定');const next=Family.previewPlug(doc,c.id,Family.plugPoint(c),wireAllowed()?24/camera.scale:0);if(next)Object.assign(doc,next.doc);});return;}
    if(e.key.toLowerCase()==="r"&&selection?.kind==="body"){e.preventDefault();rotate(selection.id,e.shiftKey?-1:1);}
    if(["Delete","Backspace"].includes(e.key)&&selection&&selection.kind!=="port"){e.preventDefault();const id=selection.id;cancel();change(doc=>M.remove(doc,id));}
    const offset={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!offset||!selection)return;e.preventDefault();const [dx,dy]=offset;
    if(selection.kind==="plug"){change(doc=>{const c=doc.components.find(c=>c.id===selection.id);if(!allow(doc,c,'plug'))throw Error('插頭已固定');const p=Family.plugPoint(c),next=Family.previewPlug(doc,c.id,{x:p.x+dx/(e.shiftKey?20:1),y:p.y+dy/(e.shiftKey?20:1)});if(next)Object.assign(doc,next.doc);});}
    else if(selection.kind==="wireend"){const id=selection.id,key=selection.end;change(doc=>{const w=doc.wires.find(w=>w.id===id),p=M.endpoints(doc).get(w[key]);M.moveWireEnd(doc,id,key,{x:p.x+dx,y:p.y+dy});});}
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
  $('moreSelected').onclick=()=>{
    const dialog=$('selectionActionsDialog'),list=$('selectionActionsList');list.replaceChildren();
    const labels={rotateCounterSelected:'逆時針旋轉',rotateSelected:'順時針旋轉',copySelected:'複製元件',focusSelected:'定位所選',inspectMeter:'放大錶盤',flipMeterSelected:'左右換接孔'};
    for(const source of $('selectionActions').querySelectorAll('button')){
      if(source===$('moreSelected')||source.hidden||getComputedStyle(source).display!=='none')continue;
      const button=document.createElement('button'),label=document.createElement('span');button.type='button';button.dataset.selectionAction=source.dataset.circuitId;button.disabled=source.disabled;
      if(source.classList.contains('danger'))button.classList.add('danger');
      const icon=source.querySelector('svg');if(icon)button.append(icon.cloneNode(true));label.textContent=labels[source.dataset.circuitId]||source.getAttribute('aria-label');button.append(label);
      button.onclick=()=>{dialog.close();if(source.isConnected&&!source.hidden&&!source.disabled)source.click();};list.append(button);
    }
    if(!list.children.length)return;
    $('selectionActionsTitle').textContent=(selectedComponent()?.label||'所選物件')+' · 操作';dialog.dataset.selection=selection.id;dialog.showModal();$('moreSelected').setAttribute('aria-expanded','true');
  };
  $('closeSelectionActions').onclick=()=>$('selectionActionsDialog').close();
  on($('selectionActionsDialog'),'close',()=>{$('moreSelected').setAttribute('aria-expanded','false');});
  $('flipMeterSelected').onclick=()=>{if(selectedComponent())flipMeter(selection.id);};
  $("detachFrom").onclick=()=>{const w=selectedWire();if(w)unplug(w.id,"from");};$("detachTo").onclick=()=>{const w=selectedWire();if(w)unplug(w.id,"to");};
  $("deleteSelected").onclick=()=>{const id=selection?.id;if(!id||selection.kind==="port")return;cancel();change(doc=>M.remove(doc,id));notify("已刪除；刪線歸還庫存，復原可還原。");};$("rotateSelected").onclick=()=>{if(selectedComponent())rotate(selection.id);};$("rotateCounterSelected").onclick=()=>{if(selectedComponent())rotate(selection.id,-1);};$("undo").onclick=()=>undo();$("redo").onclick=()=>undo(true);
  function loadDocument(doc){if(destroyed)throw new Error("編輯器已卸載");if(readOnly)throw new Error("目前為只讀，不能載入電路");const size=D.bytes(typeof doc==='string'?doc:JSON.stringify(doc));if(size>(transient?root.CircuitTransient.sessionByteLimit:M.limits.bytes))throw new Error('電路檔過大');const data=typeof doc==='string'?JSON.parse(doc):doc;if(data?.kind==='simlab-circuit-session'||data?.kind==='simlab-household-concepts'){controller.restoreSession(data);return false;}if(size>M.limits.bytes)throw new Error('電路檔超出 256 KiB 限制');const imported=D.importDocument(data),valid=profile.assertSnapshot(transient?root.CircuitAC.toAC(imported.document):imported.document);cancel();const before=history.get();if(session)sessionHistory.set(before,session.capture());history.replace(valid);if(timed&&history.get()===before)history.checkpoint();discardSettingsDrafts();if(timed){replaceSession(new Backend.Session(valid));if(household||session.fault)paused=true;}wireCurrents.clear();potentialDirections.clear();labelOptions.previous=null;flowOffsets.clear();flowScales.clear();needleStates.clear();relayStates.clear();analysis=solve(history.get());selection=null;selectedConnection=null;wireMode=false;probeFirst=null;probeResult=null;autoFit=true;fit();render();acUI?.documentLoaded(valid);if(before!==history.get())emitChange();if(imported.removedMeasurements)notify("已載入電路；舊檔的數據記錄不再提供，沒有載入。原檔保持不變。");return imported.removedMeasurements;}
  $("preset").onchange=()=>{const name=$("preset").value,next=P.create(name);if(teacher){const previous=history.get();next.display=M.clone(previous.display);next.display.reference=null;if(household)next.supplyVoltage=previous.supplyVoltage;next.policy=M.clone(previous.policy);next.cables={...previous.cables,count:Math.max(previous.cables.count,next.wires.length)};}loadDocument(next);$("preset").value=name;if(household&&profile.simulation.play&&!reducedMotion.matches)setPlayback({paused:false});};$("realView").onclick=()=>change(doc=>doc.display.view="real");$("schematicView").onclick=()=>change(doc=>doc.display.view="schematic");
  $("fontSize").onchange=()=>change(doc=>{doc.display.fontSize=$("fontSize").value;doc.display.projection=false;});
  ["flow","potential","names","values"].forEach(id=>$(id).onchange=()=>change(doc=>{if(household&&id==='potential'){doc.display.potential=$(id).value==='potential';if($(id).value==='plain')doc.display.roleColours=false;else delete doc.display.roleColours;}else doc.display[id]=$(id).type==="checkbox"?$(id).checked:$(id).value;}));$("pause").onclick=()=>{if(timed){setPlayback({paused:!paused});return;}paused=!paused;lastTime=0;relayLastTime=performance.now();render(false);};$("slowMotion").onclick=()=>{if(timed&&(readOnly||!profile.simulation.rate))return;slowMotion=!slowMotion;lastTime=0;acLag=0;relayLastTime=performance.now();render(false);};
  Object.keys(M.quantityDefaults).filter(id=>$(id)).forEach(id=>$(id).onchange=()=>change(doc=>doc.display.quantities[id]=$(id).checked));
  $("mode").onchange=()=>{const value=$("mode").value;cancel();change(doc=>doc.policy.mode=value);};["allowRotate","allowParams","allowSwitch"].forEach(id=>$(id).onchange=()=>{const value=$(id).checked;cancel();change(doc=>doc.policy[id]=value);});
  $("probe").onclick=()=>{cancelInteraction();probeMode=!probeMode;probeFirst=null;probeResult=null;selection=null;selectedConnection=null;panMode=false;wireMode=false;render();notify(probeMode?"點一個端子看電勢，再點另一個量兩點電壓。":"取線後拖端點接線；拿線身搬動或彎曲。");};
  $("pan").onclick=()=>{cancelInteraction();panMode=!panMode;probeMode=false;wireMode=false;render();notify(panMode?"手掌工具：拖動畫布；觸控板可雙指滑動，捏合縮放。再按一次返回拿取元件。":"已返回拿取模式，可拿導線端點或線身。");};
  $('pickWire').onclick=()=>{cancelInteraction();wireMode=!wireMode;panMode=false;probeMode=false;render();notify(wireMode?'拿導線：重疊時優先拿線身或線端。再按一次返回拿元件。':'已返回拿取元件與導線。');};
  host.querySelectorAll("[data-camera]").forEach(b=>b.onclick=()=>{cancel();const action=b.dataset.camera,r=surface.getBoundingClientRect();if(action==="fit"){autoFit=true;fit();}else{autoFit=false;if(["in","out"].includes(action))zoomAt(action==="in"?1.2:1/1.2,r.left+r.width/2,r.top+r.height/2);else{const delta=100/camera.scale;if(action==="left")camera.x-=delta;if(action==="right")camera.x+=delta;if(action==="up")camera.y-=delta;if(action==="down")camera.y+=delta;}}render(false);});
  $("panelToggle").onclick=()=>{cancel();const hidden=$("app").classList.toggle("panel-hidden");$("panelToggle").setAttribute("aria-expanded",String(!hidden));$("panelToggle").setAttribute("aria-label",hidden?"展開操作面板":"收起操作面板");reflowControls();later(()=>{if(autoFit)fit();render(false);});};
  $('showWireCurrents').onclick=()=>setDiagramDisplay('wireCurrents',undefined,true);$('hideWireCurrents').onclick=()=>setDiagramDisplay('wireCurrents',undefined,false);
  $('showPotentialDirections').onclick=()=>setDiagramDisplay('potentialDirections',undefined,true);$('hidePotentialDirections').onclick=()=>setDiagramDisplay('potentialDirections',undefined,false);
  $("clearAll").onclick=()=>{cancel();selection=null;change(doc=>{if(doc.policy.mode!=="free")throw new Error("固定模式可用「只移除導線」重新接線。");const cables=doc.cables;Object.keys(doc).forEach(key=>delete doc[key]);Object.assign(doc,M.empty(profile.analysis),{cables});});};
  $("clearWires").onclick=()=>{cancel();change(doc=>{doc.wires=[];doc.junctions=[];if(doc.display.reference&&!M.endpoints(doc).has(doc.display.reference))doc.display.reference=null;});};$("autoRoute").onclick=()=>tidy();
  function download(text, name, type) { const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  $("save").onclick = () => { try { download(household?Backend.encode(session.capture()):session?.state.protection?root.CircuitTransient.encodeSession(session.capture()):D.encode(history.get()), "電路工作台.json", "application/json"); notify("已匯出電路檔，可用「開啟」繼續編輯。"); } catch (e) { notify(e.message, true); } };
  $("saveTemplate").onclick = () => { try { download(household?Backend.encode(new Backend.Session(D.template(history.get())).capture()):D.encode(D.template(history.get())), "固定元件接線模板.json", "application/json"); } catch (e) { notify(e.message, true); } };
  $("open").onclick = () => $("fileInput").click();
  $("fileInput").onchange = async () => { const file = $("fileInput").files[0]; $("fileInput").value = ""; if (!file) return; try { if(file.size>(transient?root.CircuitTransient.sessionByteLimit:M.limits.bytes))throw new Error("電路檔過大"); const retired=loadDocument(await file.text()); if(!retired)notify("已開啟電路檔；按復原可返回原電路。"); } catch (e) { notify(e.message, true); } };
  $("exportSvg").onclick = () => { const d = history.get(), labelBounds=V.labels(d,analysis,1,routes,null,{wireCurrents,potentialDirections}).flatMap(p=>[{x:p.box.left,y:p.box.top},{x:p.box.right,y:p.box.bottom}]), points = [...labelBounds, ...M.endpoints(d).values(), ...d.components.flatMap((c) => [{ x: c.x - 90, y: c.y - 100 }, { x: c.x + 90, y: c.y + 140 }]), ...Object.values(routes).flat()]; if (!points.length) return notify("先加入元件再匯出電路圖。"); const x = Math.min(...points.map((p) => p.x)) - 20, y = Math.min(...points.map((p) => p.y)) - 20, w = Math.max(...points.map((p) => p.x)) - x + 20, h = Math.max(...points.map((p) => p.y)) - y + 20; const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${V.scene(d, analysis, 1, routes,null,false,null,{wireCurrents,potentialDirections,fields:labelOptions.fields})}${V.flow(d, analysis, routes, animationTime, 1, flowOffsets,flowContext())}</svg>`; download(content, "電路圖.svg", "image/svg+xml"); };

  $('settings').onclick=()=>{cancel();$('settingsNotice').hidden=true;$('settingsDialog').showModal();$('settings').setAttribute('aria-expanded','true');};
  on($('closeSettings'),'pointerdown',()=>discardSettingsDrafts(),{capture:true});
  $('closeSettings').onclick=()=>{discardSettingsDrafts();$('settingsDialog').close();};
  on($('settingsDialog'),'cancel',e=>{e.preventDefault();discardSettingsDrafts();$('settingsDialog').close();});
  on($('settingsDialog'),'close',()=>{discardSettingsDrafts();$('settings').setAttribute('aria-expanded','false');});
  $("help").onclick=()=>$("helpDialog").showModal();$("closeHelp").onclick=()=>$("helpDialog").close();
  function toolDropPoint(e){
    const at=document.elementFromPoint(e.clientX,e.clientY);
    if(!at||!surface.contains(at)||at.closest('.scroll-strip,.preview,.canvas-notice'))return null;
    const p=world(e.clientX,e.clientY),x=snapGrid(p.x),y=snapGrid(p.y);
    return Math.abs(x)<=M.limits.coordinate&&Math.abs(y)<=M.limits.coordinate?{x,y}:null;
  }
  function suppressedToolClick(b,e){
    const id=e.pointerId??b.lastToolPointerId;if(!e.detail||!b.suppressedToolPointers?.has(id))return false;
    b.suppressedToolPointers.delete(id);return true;
  }
  function bindToolDrag(b,entry=null){
    const canTake=()=>entry?profile.canAdd(entry,history.get(),readOnly):wireAllowed()&&history.get().wires.length<history.get().cables.count;
    b.suppressedToolPointers=new Set();
    b.title=(entry?.label||'導線')+'：點選新增，或用滑鼠／觸控筆拖到畫布';
    // ponytail: pen hover owns this button; use a separate drag handle if concurrent finger scrolling is required.
    on(b,'pointerover',e=>{b.style.touchAction=e.pointerType==='pen'?'none':'';});
    on(b,'pointerleave',()=>{if(drag?.target!==b)b.style.touchAction='';});
    on(b,'pointerdown',e=>{
      if(e.isPrimary&&e.button===0){b.lastToolPointerId=e.pointerId;b.suppressedToolPointers.delete(e.pointerId);}
      if(!['mouse','pen'].includes(e.pointerType)||e.button!==0||!e.isPrimary||touches.size||!canTake())return;
      if(document.activeElement===$('quickValue')||$('properties').contains(document.activeElement))document.activeElement.blur();
      cancel();drag={kind:'palette',entry,pointerId:e.pointerId,pointerType:e.pointerType,target:b,x:e.clientX,y:e.clientY,moved:false,selectionBefore:selection&&M.clone(selection)};
      b.setPointerCapture(e.pointerId);render(false);
    });
    on(b,'pointermove',e=>{
      if(drag?.kind!=='palette'||drag.target!==b||drag.pointerId!==e.pointerId)return;
      drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;if(!drag.moved)return;
      b.suppressedToolPointers.add(e.pointerId);const p=canTake()?toolDropPoint(e):null;
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
    const sample={id:'palette-'+entry.key,type,params:entry.params};
    const bounds=household?(type==='house-power-strip'?R.bodyBounds({...sample,x:0,y:0,angle:0}):R.get(type).bounds):null,ports=household?R.ports({...sample,x:0,y:0,angle:0}):[];
    const left=bounds?Math.min(bounds.left,...ports.map(p=>p.x))-8:0,right=bounds?Math.max(bounds.right,...ports.map(p=>p.x))+8:0;
    const paletteBox=household&&type==='house-metal'?'-42 -58 84 124':household&&type==='house-insulated'?'-48 -73 108 145':bounds?`${left} ${bounds.top-10} ${right-left} ${bounds.bottom-bounds.top+20}`:null;
    if(household){b.title=R.get(type).name;b.setAttribute('aria-label',R.get(type).name);}
    b.innerHTML=`<span class="icon"><svg viewBox="${paletteBox|| (sample.type==='transformer'?'-82 -83 164 132':sample.type==='relay'?'-84 -64 188 154':R.dualMeter(sample)?'-84 -90 168 180':sample.type.startsWith('ac-')&&R.isMeter(sample)?'-66 -47 132 92':'-64 -68 128 124')}" aria-hidden="true">${V.body(sample,null,{view:'real',palette:household,meters:'analog',values:false,fields:sample.type==='transformer'?false:undefined,idPrefix:prefix+'palette-'+entry.key+'-'})}</svg></span><span>${V.esc(entry.label)}</span>`;
    bindToolDrag(b,entry);
    on(b,'click',e=>{if(suppressedToolClick(b,e))return;if(!profile.canAdd(entry,history.get(),readOnly))return;cancel();const succeeded=change(d=>{
      const x=snapGrid(camera.x+surface.clientWidth/(2*camera.scale)),y=snapGrid(camera.y+surface.clientHeight/(2*camera.scale));let offset=0;
      while(d.components.some(c=>Math.hypot(c.x-x-offset,c.y-y-offset)<100))offset+=40;
      const c=addComponent(d,type,x+offset,y+offset,entry.params);selection={kind:'body',id:c.id};
    });if(succeeded)notify('元件已加入。再取出導線接線，或拖動本體調整位置。');});$('palette').append(b);
  }

  if(!transient&&matchMedia("(max-width:759px) and (min-height:451px)").matches){$("app").classList.add("panel-hidden");$("panelToggle").setAttribute("aria-expanded","false");$("panelToggle").setAttribute("aria-label","展開操作面板");}
  observer=new ResizeObserver(()=>{const interrupted=!!(drag||previewDoc||cameraGesture);if(interrupted)cancel();reflowControls();if(autoFit&&!interrupted)fit();render(false);});observer.observe(surface);
  function execute(command) {
    if(destroyed)throw new Error('編輯器已卸載');
    if(!command || typeof command.type!=='string')throw new TypeError('命令格式無效');
    if(command.type==='setWireCurrentDisplay')return setDiagramDisplay('wireCurrents',command.id,command.visible);
    if(command.type==='setPotentialDirectionDisplay')return setDiagramDisplay('potentialDirections',command.id,command.visible);
    if(readOnly){notify('目前為只讀，不能修改電路。',true);return false;}
    if(command.type==='undo'||command.type==='redo')return undo(command.type==='redo');
    if(household&&command.type==='setContact')return setContact(command.id,command.target);
    if(household&&command.type==='toggleSwitch'&&analysis.components[command.id]?.status==='tripped')return execute({type:'resetHouseholdProtection',id:command.id});
    if(household&&command.type==='resetHouseholdProtection')return householdAction(next=>{const c=next.doc.components.find(c=>c.id===command.id);if(!c||!Family.isProtection(c)||!allow(next.doc,c,c.type==='house-fuse'?'params':'switch'))throw Error('目前不能復位');if(!next.resetProtection(c.id))throw Error('找不到保護裝置');});
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
        case 'detachConnection': if(!wireAllowed())throw Error('目前不能拆線');M.detachConnection(doc,command.id,32/camera.scale);selectedConnection=null;selection=null;break;
        case 'straighten': M.straightenWire(doc,command.id);break;
        case 'setWireResistance': if(!profile.canSetWireResistance(doc,readOnly))throw new Error('導線電阻已固定');M.setWireResistance(doc,command.id,command.value);break;
        case 'remove': M.remove(doc,command.id);break;
        case 'rotate': M.rotateComponent(doc,command.id,command.direction??1);break;
        case 'flipMeter': M.flipMeter(doc,command.id);break;
        case 'move': {
          if(!c)throw new Error('找不到元件');
          Object.assign(doc,moveObject(doc,'body',c.id,command.x-c.x,command.y-c.y).doc);break;
        }
        case 'setHouseholdSetting': {
          if(!household||!teacher||!['supplyVoltage','terminalLabels','showSupplyVoltage'].includes(command.key))throw new Error('家庭設定未開放');
          if(command.key==='supplyVoltage')doc.supplyVoltage=command.value;else doc.display[command.key]=command.value;break;
        }
        case 'setParam': {
          if(!c||!Object.hasOwn(R.get(c.type).params,command.key))throw new Error('找不到指定參數');
          if(c.type==='rheostat'&&command.key==='terminals')M.setTerminals(doc,c.id,command.value);else c.params[command.key]=command.value;break;
        }
        case 'toggleSwitch': if(!['switch','spdt','house-switch','house-breaker','house-rcd'].includes(c?.type))throw new Error('找不到開關');c.params.closed=c.type==='spdt'?(c.params.closed==='b'?'c':'b'):!c.params.closed;break;
        default: throw new Error('不支援的命令：'+command.type);
      }
    });
  }
  function replaceSession(next,preserveTrace=false){unsubscribeAnalysis?.();session?.destroy();session=next;lastTime=0;acLag=0;sessionDocument=history.get();unsubscribeAnalysis=session.subscribe(forwardAnalysis);if(household)forwardAnalysis(session.read());if(!preserveTrace){clearFieldScales();acUI?.clear();}}
  function householdAction(fn,prepare){
    if(!household||readOnly||destroyed)return false;
    cancel();const before=history.get(),saved=session.capture(),next=session.fork();
    try{if(prepare){const doc=M.clone(before);prepare(doc);if(!M.reconcile(doc,before))throw Error('導線太短，請先拔開或移近人物');profile.assertTransition(before,doc,readOnly);next.update(doc);}fn(next);profile.assertTransition(before,next.doc,readOnly);if(JSON.stringify(next.capture())===JSON.stringify(saved)){next.destroy();return true;}sessionHistory.set(before,saved);history.replace(next.doc);if(history.get()===before)history.checkpoint();replaceSession(next);analysis=solve(history.get());render();emitChange();return true;}
    catch(error){next.destroy();notify(error.message,true);return false;}
  }
  function setContact(id,target,point){
    return householdAction(next=>next.contact(id,target),doc=>{const person=doc.components.find(c=>c.id===id&&c.type==='house-person');if(!person||!allow(doc,person,'params','stance'))throw Error('目前不能更改接觸');const appliance=doc.components.find(c=>c.id===target&&Family.isAppliance(c));if(target!==null&&!appliance)throw Error('接觸對象無效');if(appliance||point)Family.placeHand(person,point||Family.contactPoint(appliance));});
  }
  function setPlayback(options){
    if(destroyed)throw new Error('編輯器已卸載');if(!session||readOnly||!options||typeof options!=='object'||Object.keys(options).some(k=>!['paused','rate'].includes(k)))return false;
    if(options.paused!==undefined&&(typeof options.paused!=='boolean'||!profile.simulation.play))return false;
    if(options.rate!==undefined&&(!Number.isFinite(options.rate)||options.rate<.0001||options.rate>1||!profile.simulation.rate))return false;
    if(options.paused===false&&session.fault)return false;const inspector=!!(drag||previewDoc||cameraGesture);cancelInteraction();if(options.paused!==undefined)paused=options.paused;if(options.rate!==undefined){timeRate=options.rate;slowMotion=false;}lastTime=0;acLag=0;render(inspector);return true;
  }
  function advanceTime(seconds){if(destroyed)throw new Error('編輯器已卸載');if(!session||readOnly||!profile.simulation.step)return false;if(!Number.isFinite(seconds)||seconds<=0||seconds>10)throw new Error('單步時間需要大於零且不超過 10 s');cancel(false,!!(drag||previewDoc||cameraGesture));paused=true;const progress=session.advance(seconds);analysis=progress.result;animationTime=session.state.time;render(false);return {...progress,result:controller.getAnalysis()};}
  function resetSimulation(){if(destroyed)throw new Error('編輯器已卸載');if(!session||readOnly||!profile.simulation.reset)return false;cancel();lastTime=0;acLag=0;analysis=session.reset();clearFieldScales();acUI?.clear();flowOffsets.clear();needleStates.clear();animationTime=0;render();notify('已回到初始條件；搭建電路保持。');return true;}
  const controller=Object.freeze({getDocument:()=>M.clone(history.get()),getAnalysis:()=>{const{voltage,...data}=solve(history.get());return M.clone(data);},voltage:(a,b)=>solve(history.get()).voltage(a,b),exportDocument:()=>household?Backend.encode(session.capture()):D.encode(history.get()),loadDocument,execute,
    applyPolicy(policy){cancel();return change(doc=>doc.policy={...doc.policy,...policy});},onChange(fn){if(destroyed)throw new Error('編輯器已卸載');if(typeof fn!=="function")throw new TypeError("onChange requires a callback");listeners.add(fn);return()=>listeners.delete(fn);},
    setReadOnly(value=true){if(destroyed)throw new Error('編輯器已卸載');if(typeof value!=='boolean')throw new TypeError('只讀狀態必須是布林值');cancel();readOnly=value;if(timed)paused=true;host.dataset.readOnly=String(value);render();},
    onAnalysis(fn){if(destroyed)throw new Error('編輯器已卸載');if(!timed||typeof fn!=='function')throw new Error('分析訂閱需要時間模型及函數');analysisListeners.add(fn);return()=>analysisListeners.delete(fn);},
    getPlayback:()=>({paused,rate:timeRate*(slowMotion?.25:1),actualRate:paused?0:actualRate,readOnly,available:timed&&profile.ui.playback,permissions:{...profile.simulation}}),setPlayback,advanceTime,resetSimulation,
    resetSourceProtection(id){if(destroyed||!session||readOnly)return false;const c=history.get().components.find(c=>c.id===id);if(c?.type!=='ac-source'||!allow(history.get(),c,'params','protectionEnabled'))return false;cancel();if(!session.resetProtection(id))return false;analysis=session.read();lastTime=0;acLag=0;render();emitChange();return true;},
    setFieldDisplay(visible){if(destroyed||!transient||!profile.ui.field||typeof visible!=='boolean')return false;labelOptions.fields=visible;render(false);return true;},
    captureSession(){if(destroyed||!session)throw new Error('此編輯器沒有時間 session');return session.capture();},
    restoreSession(snapshot){if(destroyed||!session||readOnly)throw new Error('目前不能恢復時間 session');const next=Backend.Session.restore(snapshot);profile.assertSnapshot(next.doc);cancel();sessionHistory.set(history.get(),session.capture());const before=history.get();history.replace(next.doc);if(history.get()===before)history.checkpoint();replaceSession(next);paused=true;needleStates.clear();analysis=solve(history.get());selection=null;autoFit=true;fit();render();emitChange();if(household&&snapshot.version===1)notify('已轉用有限線路電阻；接線、時間、電能及保護事件保留，舊事件沒有切斷前讀數。');if(snapshot.version<5&&snapshot.physics?.protection)notify("已轉用實測回饋保護及至少0.05 Ω內阻；儲能、相位、歷史與停機鎖定保留，後續軌跡按新模型運算。");},
    getObservationTools(){return acUI?.getTools()||[];},
    setObservationTools(tools){if(destroyed||!acUI||!profile.ui.waveform)return false;return acUI.setTools(tools);},
    setObservationChannels(channels){if(!acUI||!profile.ui.waveform)return false;return acUI.setChannels(channels);},
    check(){if(destroyed)throw new Error('編輯器已卸載');if(!profile.check)throw new Error('此活動沒有設定檢查');const doc=M.clone(history.get()),checked=profile.check(doc,solve(doc));if(typeof checked?.passed!=='boolean')throw new Error('檢查結果格式無效');return M.clone(checked);},
    fit(){if(destroyed)throw new Error('編輯器已卸載');cancel();autoFit=true;fit();render(false);},
    destroy(){
      if(destroyed)return;
      cancel();for(const id of touches.keys())if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
      touches.clear();destroyed=true;abort.abort();clearTimeout(noticeTimer);cancelAnimationFrame(frame);observer.disconnect();fullscreen?.destroy();
      listeners.clear();analysisListeners.clear();unsubscribeAnalysis?.();session?.destroy();acUI?.destroy();familyUI?.destroy();targets.clear();needleStates.clear();flowOffsets.clear();flowScales.clear();wireCurrents.clear();potentialDirections.clear();relayStates.clear();
      for(const dialog of host.querySelectorAll('dialog[open]'))dialog.close();
      // Drop handlers on detached, disabled UI references as well.
      for(const element of Object.values(refs))for(const key of ['onclick','onchange','oninput','onpointercancel'])element[key]=null;
      host.replaceChildren();restoreHost();
      if(activeHost===host)activeHost=null;mounts.delete(host);
    },
    getInteraction:()=>({pending:null,readOnly,destroyed,meterPreview:meterPreview?.id||null,wireCurrents:[...wireCurrents],potentialDirections:[...potentialDirections],dragging:cameraGesture?"camera":drag?.kind||null,selection:selection?M.clone(selection):null,selectedConnection,camera:{...camera},panMode,wireMode,probeMode,spacePan,touchCount:touches.size,touchBlocked,snap:drag?.snap?.id||null,limited:!!drag?.limited,lastMessage}),cancel});
  if(household)familyUI=root.CircuitHouseholdUI.mount({host,refs,controller});
  if(transient){if(!root.CircuitACUI)throw new Error('缺少交流介面依賴');acUI=root.CircuitACUI.mount({host,refs,profile,controller,viewDocument:current,routes:()=>routes,readouts:reactiveReadouts,currentReferences:()=>labelOptions.currentReferences});}
  render();function animate(time){if(destroyed)return;
    const rate=slowMotion?.25:1,rawElapsed=lastTime?Math.max(0,(time-lastTime)/1000):0,elapsed=Math.min(timed?.25:.05,rawElapsed)*rate;lastTime=time;
    let acAdvanced=0;const active=!paused&&!document.hidden,householdPreview=household&&!!(drag||previewDoc||cameraGesture||touches.size);if(active)animationTime+=elapsed;
    const relayEligible=active&&!drag&&!previewDoc&&!cameraGesture&&!touches.size,relayElapsed=relayEligible?Math.max(0,(time-relayLastTime)/1000)*rate:0;relayLastTime=time;
    // Household gestures freeze physics while their illustrative motors keep moving.
    // A completed request can leave a rounding remainder that is not another physics step.
    if(timed&&active&&!readOnly&&!householdPreview){acLag+=elapsed*timeRate;const live=paramSession||session,progress=live.advance(acLag,{budget:10});acAdvanced=progress.advanced;acLag=progress.complete?0:Math.max(0,acLag-progress.advanced);actualRate=rawElapsed?progress.advanced/rawElapsed:0;analysis=progress.result;animationTime=live.state.time;if(live.fault&&!paramSession)paused=true;if(live.fault||time-lastACPaint>=200){lastACPaint=time;render(false);}}
    if(household&&paused&&!document.hidden&&!readOnly&&!householdPreview){
      // Pause stops new time, but an event already due still finishes within frame budgets.
      const previous=analysis;analysis=session.advance(0,{budget:10}).result;
      if(session.fault||Object.keys(session.state.protection).some(id=>analysis.components[id].status!==previous.components[id].status))render(false);
    }
    if(transient&&active&&!readOnly)for(const c of current().components)if(['lamp','capacitor','inductor','generator','transformer'].includes(c.type)){const node=$('scene').querySelector('[data-component="'+c.id+'"] '+(c.type==='lamp'?'[data-lamp]':c.type==='generator'?'[data-generator-model]':'[data-ac-apparatus]'));if(node){if(c.type==='generator')root.CircuitGeneratorGraphics.update(node,c,analysis.components[c.id],labelOptions.fields??true);else if(c.type==='transformer'){const slot=node.querySelector('[data-transformer-field-slot]');if(slot){if(labelOptions.fields===false)slot.innerHTML='';else root.CircuitFieldGraphics.updateTransformer(slot,c,V.displayComponent(current(),analysis,c,labelOptions.currentReferences),current().display.view==='schematic',slot.dataset.transformerFieldId);}}else node.outerHTML=V.body(c,V.displayComponent(current(),analysis,c,labelOptions.currentReferences),{...current().display,fields:labelOptions.fields??true});}}
    if(timed&&(!active||householdPreview))acLag=0;
    familyUI?.animate(analysis,active&&!readOnly?(householdPreview?elapsed*timeRate:acAdvanced):0);
    if(!timed&&relayEligible&&relayStates.size){
      const progress=H.advanceFrame(relayStates,history.get(),analysis,relayElapsed,solve);analysis=progress.result;
      if(progress.switched){render(false);const c=selectedComponent(),reading=$('properties').querySelector('.reading-host');if(c&&reading)reading.innerHTML=componentReadings(c.id);else if(selectedWire()&&!$('properties').contains(document.activeElement))renderProperties();}
      else if(progress.moved){for(const [id,state]of relayStates){const r=analysis.components[id],c=history.get().components.find(c=>c.id===id);r.position=state.position;const body=$('scene').querySelector('[data-relay="'+id+'"]');if(body)body.outerHTML=V.body(c,r,history.get().display);}}
    }
    V.advanceFlow(flowOffsets,current(),analysis,active?(timed?acAdvanced:elapsed):0,flowContext());
    if(transient&&active&&!readOnly)N.sync(needleStates,current(),analysis,reducedMotion.matches);
    if(N.advance(needleStates,active?elapsed:0)||transient&&active&&!readOnly)updateMeterNeedles();
    // A captured grip may stay still between pointer events; its live circuit
    // must keep displaying the same RAF phase that the accumulator advances.
    if(timed&&!document.hidden){updateSelectionReadings(household);acUI?.animate(analysis);}
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
