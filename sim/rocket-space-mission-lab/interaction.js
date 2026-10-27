(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RocketInteraction=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function nearest(points,x,y,radius){let best=null,distance=radius;points.forEach((p,i)=>{if(!p?.visible||p.compatible===false)return;const body=Number.isFinite(p.bodyX)&&Number.isFinite(p.bodyY)?Math.hypot(p.bodyX-x,p.bodyY-y):Infinity,d=Math.min(Math.hypot(p.x-x,p.y-y),body);if(d<=distance){best=i;distance=d;}});return best;}
  function wheelFactor(delta,mode,height){const pixels=delta*(mode===1?16:mode===2?height:1);return Number.isFinite(pixels)?Math.exp(-Math.max(-600,Math.min(600,pixels))*.0015):1;}
  function install(d,api){
    let active=null,draggedCard=null,pinch=null,blocked=false,suppressClick=false,lastTap=null,nativeGesture=null;const touches=new Map(),diagnostics={down:0,move:0,up:0,cancel:0,trustedTouch:0,pinch:0,wheel:0,reset:0};
    Object.defineProperties(diagnostics,{touchCount:{enumerable:true,get:()=>touches.size},touchBlocked:{enumerable:true,get:()=>blocked},pinching:{enumerable:true,get:()=>Boolean(pinch)}});
    const release=()=>{if(!active)return;const a=active;active=null;try{a.target.releasePointerCapture(a.id);}catch(_){}d.dragPartGhost.hidden=true;d.touchPreview.hidden=true;d.returnZone.hidden=true;d.controlPanel.classList.remove('return-active');[d.slot0,d.slot1].forEach(b=>b.classList.remove('snap'));if(a.part)api.drag(null);};
    function down(e,kind,part){
      if(blocked||pinch||nativeGesture||touches.size>1)return;if(active){cancel();return;}if(e.isPrimary===false)return;draggedCard=null;if(e.button!==0||!api.allowed(kind)||kind==='part'&&e.pointerType==='touch'&&!e.target.closest('[data-part-handle]'))return;
      let source=null;if(kind==='installed'){const r=d.stage.getBoundingClientRect();source=api.pickPart(e.clientX-r.left,e.clientY-r.top,e.pointerType==='touch');if(source)part=source.part;else{kind='camera';if(!api.allowed(kind))return;}}
      e.preventDefault();active={id:e.pointerId,kind,part,source,target:e.currentTarget,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,touch:e.pointerType==='touch',moved:false,snap:null,angle:null,returning:false,blank:kind==='camera'&&!api.pickPart(e.clientX-d.stage.getBoundingClientRect().left,e.clientY-d.stage.getBoundingClientRect().top,false),started:performance.now()};if(kind!=='camera')lastTap=null;e.currentTarget.setPointerCapture(e.pointerId);diagnostics.down++;if(e.isTrusted&&active.touch)diagnostics.trustedTouch++;
      if(part){api.select(part,source);const art=d.partsGrid.querySelector('[data-part="'+part+'"] .part-art');d.dragPartGhost.replaceChildren(art.cloneNode(true),document.createElement('span'));d.dragPartGhost.lastChild.textContent=api.label(part);}
    }
    function move(e){
      if(!active||e.pointerId!==active.id)return;const a=active,rect=d.stage.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;a.moved ||= Math.hypot(e.clientX-a.x,e.clientY-a.y)>6;diagnostics.move++;if(a.moved){lastTap=null;suppressClick=true;}if(a.kind==='part'&&a.moved)draggedCard=a.target;
      if(a.kind==='camera')api.rotate(e.clientX-a.lastX,e.clientY-a.lastY);
      if(a.part&&a.moved){
        const panel=d.controlPanel.getBoundingClientRect();a.returning=Boolean(a.source&&e.clientX>=panel.left&&e.clientX<=panel.right&&e.clientY>=panel.top&&e.clientY<=panel.bottom);
        a.snap=a.returning?null:nearest(api.slots(a.part,a.source),x,y,30);
        d.dragPartGhost.hidden=a.snap!==null;d.dragPartGhost.style.left=e.clientX+'px';d.dragPartGhost.style.top=e.clientY+'px';d.dragPartGhost.classList.toggle('fits',a.snap!==null||a.returning);d.dragPartGhost.classList.toggle('blocked',!a.returning&&a.snap===null&&x>=0&&y>=0&&x<=rect.width&&y<=rect.height);
        [d.slot0,d.slot1].forEach((slot,i)=>slot.classList.toggle('snap',a.snap===i));d.controlPanel.classList.toggle('return-active',a.returning);
        d.returnZone.hidden=!a.source;d.returnZone.textContent=a.returning?'放手，將零件放回元件箱':'元件箱 · 拖到這裏即可取出零件';d.returnZone.style.left=panel.left+8+'px';d.returnZone.style.top=panel.top+8+'px';d.returnZone.style.width=panel.width-16+'px';
        api.drag(a.part,x,y,a.snap,a.source,a.returning);
      }
      a.lastX=e.clientX;a.lastY=e.clientY;
    }
    function up(e){
      if(!active||e.pointerId!==active.id)return;const a=active,target=a.snap===null?null:api.slots(a.part,a.source)[a.snap];diagnostics.up++;release();if(a.moved)suppressClick=true;
      if(a.blank&&!a.moved&&performance.now()-a.started<=320){const now=performance.now();if(lastTap&&now-lastTap.time<=320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<=24){lastTap=null;suppressClick=true;diagnostics.reset++;api.resetCamera();}else lastTap={time:now,x:e.clientX,y:e.clientY};}
      if(a.part){if(!a.moved){if(a.source)api.selectedInstalled(a.source);}else if(a.returning)api.transfer(a.source,null);else if(a.snap!==null){if(a.source)api.transfer(a.source,target.stage,target.at);else api.attach(target.stage,target.at);}else{const r=d.stage.getBoundingClientRect();if(a.lastX>=r.left&&a.lastX<=r.right&&a.lastY>=r.top&&a.lastY<=r.bottom)api.missed();}}
      api.end();
    }
    function releaseTouches(){for(const id of touches.keys())try{d.cameraSurface.releasePointerCapture(id);}catch(_){}}
    function cancel(){const had=Boolean(active||pinch||nativeGesture);pinch=nativeGesture=null;lastTap=null;blocked=touches.size>0;if(had){diagnostics.cancel++;suppressClick=true;release();releaseTouches();api.end();}}
    function central(e){const r=d.cameraSurface.getBoundingClientRect();return [d.cameraSurface,d.rocketGrip,d.sceneHost,d.sceneHost.firstElementChild].includes(e.target)&&e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom;}
    function distance(){const [a,b]=[...touches.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
    document.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch'){if(touches.size||nativeGesture||active&&active.id!==e.pointerId){cancel();return;}suppressClick=false;if(!central(e))lastTap=null;return;}
      // A new primary touch also clears an interrupted browser sequence.
      if(e.isPrimary&&touches.size){cancel();touches.clear();blocked=false;}
      if(!touches.size){blocked=false;suppressClick=false;}
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY,central:central(e)});
      if(!central(e))lastTap=null;
      if(touches.size===2&&!blocked&&[...touches.values()].every(p=>p.central)&&api.allowed('camera')){
        const span=distance();pinch={distance:span>=24?span:null};blocked=true;suppressClick=true;lastTap=null;nativeGesture=null;release();api.end();
        for(const id of touches.keys())try{d.cameraSurface.setPointerCapture(id);}catch(_){cancel();return;}
        diagnostics.pinch++;e.preventDefault();return;
      }
      if(touches.size>1||active&&!active.touch||nativeGesture){cancel();blocked=true;suppressClick=true;}
    },true);
    document.addEventListener('pointermove',e=>{
      const point=touches.get(e.pointerId);if(!point)return;point.x=e.clientX;point.y=e.clientY;
      if(!pinch)return;const span=distance();e.preventDefault();
      if(span>=24){if(pinch.distance!==null)api.zoom(api.zoom()*span/pinch.distance);pinch.distance=span;}else pinch.distance=null;
    },{capture:true,passive:false});
    document.addEventListener('pointerup',e=>{if(pinch){pinch=null;suppressClick=true;releaseTouches();}touches.delete(e.pointerId);if(!touches.size)blocked=false;},true);
    document.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);cancel();if(!touches.size)blocked=false;},true);
    d.cameraSurface.addEventListener('lostpointercapture',e=>{if(pinch&&touches.has(e.pointerId)&&!d.cameraSurface.hasPointerCapture(e.pointerId))cancel();});
    d.stage.addEventListener('click',e=>{if(suppressClick&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();}},true);
    d.partsGrid.addEventListener('click',e=>{if(suppressClick&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();}},true);
    d.stage.addEventListener('wheel',e=>{
      if(!central(e)||!api.allowed('camera'))return;e.preventDefault();lastTap=null;
      if(active||touches.size||nativeGesture)return;const factor=wheelFactor(e.deltaY,e.deltaMode,d.cameraSurface.clientHeight);if(factor===1)return;api.zoom(api.zoom()*factor);diagnostics.wheel++;
    },{passive:false});
    d.stage.addEventListener('gesturestart',e=>{
      if(!central(e)||!api.allowed('camera'))return;e.preventDefault();lastTap=null;
      if(active||touches.size||blocked)return;nativeGesture={scale:1};
    },{passive:false});
    d.stage.addEventListener('gesturechange',e=>{if(!nativeGesture)return;e.preventDefault();if(Number.isFinite(e.scale)&&e.scale>0){api.zoom(api.zoom()*e.scale/nativeGesture.scale);nativeGesture.scale=e.scale;}},{passive:false});
    d.stage.addEventListener('gestureend',e=>{if(nativeGesture){e.preventDefault();nativeGesture=null;}},{passive:false});
    function bind(target,kind,part){target.addEventListener('pointerdown',e=>down(e,kind,part));target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',cancel);target.addEventListener('lostpointercapture',e=>{if(active?.id===e.pointerId&&!active.target.hasPointerCapture(e.pointerId))cancel();});}
    d.partsGrid.querySelectorAll('[data-part]').forEach(b=>{bind(b,'part',b.dataset.part);b.addEventListener('click',e=>{if(e.detail!==0&&(draggedCard===b||e.target.closest('[data-part-handle]'))){draggedCard=null;return;}if(api.allowed('part')){api.select(b.dataset.part,null);api.attach();api.end();}});});bind(d.rocketGrip,'installed');bind(d.cameraSurface,'camera');
    d.cameraSurface.addEventListener('keydown',e=>{if(!api.allowed('camera')||e.ctrlKey||e.metaKey||e.altKey)return;const delta={ArrowLeft:[-14,0],ArrowRight:[14,0],ArrowUp:[0,-14],ArrowDown:[0,14]}[e.key];if(delta||['+','=','-','Home'].includes(e.key)){e.preventDefault();cancel();if(delta)api.rotate(...delta);else if(e.key==='Home')api.resetCamera();else api.zoom(api.zoom()*(e.key==='-'?1/1.2:1.2));}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(active||pinch||nativeGesture)){e.preventDefault();cancel();}});
    return {cancel,diagnostics,get active(){return active;}};
  }
  return Object.freeze({nearest,wheelFactor,install});
});
