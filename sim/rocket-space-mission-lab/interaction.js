(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RocketInteraction=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function nearest(points,x,y,radius){let best=null,distance=radius;points.forEach((p,i)=>{if(!p?.visible||p.compatible===false)return;const body=Number.isFinite(p.bodyX)&&Number.isFinite(p.bodyY)?Math.hypot(p.bodyX-x,p.bodyY-y):Infinity,d=Math.min(Math.hypot(p.x-x,p.y-y),body);if(d<=distance){best=i;distance=d;}});return best;}
  function install(d,api){
    let active=null,draggedCard=null;const diagnostics={down:0,move:0,up:0,cancel:0,trustedTouch:0};
    const release=()=>{if(!active)return;const a=active;active=null;try{a.target.releasePointerCapture(a.id);}catch(_){}d.dragPartGhost.hidden=true;d.touchPreview.hidden=true;d.returnZone.hidden=true;d.controlPanel.classList.remove('return-active');[d.slot0,d.slot1].forEach(b=>b.classList.remove('snap'));api.drag(null);};
    function down(e,kind,part){
      if(active){cancel();return;}if(e.isPrimary===false)return;draggedCard=null;if(e.button!==0||!api.allowed(kind)||kind==='part'&&e.pointerType==='touch'&&!e.target.closest('[data-part-handle]'))return;
      let source=null;if(kind==='installed'){const r=d.stage.getBoundingClientRect();source=api.pickPart(e.clientX-r.left,e.clientY-r.top,e.pointerType==='touch');if(source)part=source.part;else{kind='camera';if(!api.allowed(kind))return;}}
      e.preventDefault();active={id:e.pointerId,kind,part,source,target:e.currentTarget,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,touch:e.pointerType==='touch',moved:false,snap:null,angle:null,returning:false};e.currentTarget.setPointerCapture(e.pointerId);diagnostics.down++;if(e.isTrusted&&active.touch)diagnostics.trustedTouch++;
      if(part){api.select(part,source);const art=d.partsGrid.querySelector('[data-part="'+part+'"] .part-art');d.dragPartGhost.replaceChildren(art.cloneNode(true),document.createElement('span'));d.dragPartGhost.lastChild.textContent=api.label(part);}
    }
    function move(e){
      if(!active||e.pointerId!==active.id)return;const a=active,rect=d.stage.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;a.moved ||= Math.hypot(e.clientX-a.x,e.clientY-a.y)>6;diagnostics.move++;if(a.kind==='part'&&a.moved)draggedCard=a.target;
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
      if(!active||e.pointerId!==active.id)return;const a=active,target=a.snap===null?null:api.slots(a.part,a.source)[a.snap];diagnostics.up++;release();
      if(a.part){if(!a.moved){if(a.source)api.selectedInstalled(a.source);}else if(a.returning)api.transfer(a.source,null);else if(a.snap!==null){if(a.source)api.transfer(a.source,target.stage,target.at);else api.attach(target.stage,target.at);}else{const r=d.stage.getBoundingClientRect();if(a.lastX>=r.left&&a.lastX<=r.right&&a.lastY>=r.top&&a.lastY<=r.bottom)api.missed();}}
      api.end();
    }
    function cancel(){if(active){diagnostics.cancel++;release();api.end();}}
    function bind(target,kind,part){target.addEventListener('pointerdown',e=>down(e,kind,part));target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',cancel);target.addEventListener('lostpointercapture',cancel);}
    d.partsGrid.querySelectorAll('[data-part]').forEach(b=>{bind(b,'part',b.dataset.part);b.addEventListener('click',e=>{if(e.detail!==0&&(draggedCard===b||e.target.closest('[data-part-handle]'))){draggedCard=null;return;}if(api.allowed('part')){api.select(b.dataset.part,null);api.attach();api.end();}});});bind(d.rocketGrip,'installed');bind(d.cameraSurface,'camera');
    d.cameraSurface.addEventListener('keydown',e=>{const delta={ArrowLeft:[-14,0],ArrowRight:[14,0],ArrowUp:[0,-14],ArrowDown:[0,14]}[e.key];if(delta){e.preventDefault();api.rotate(...delta);}});
    document.addEventListener('pointerdown',e=>{if(active&&e.pointerId!==active.id)cancel();},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();cancel();}});
    return {cancel,diagnostics,get active(){return active;}};
  }
  return Object.freeze({nearest,install});
});
