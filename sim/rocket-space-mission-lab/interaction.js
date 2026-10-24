(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RocketInteraction=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function nearest(points,x,y,radius){let best=null,distance=radius;points.forEach((p,i)=>{if(!p?.visible)return;const d=Math.hypot(p.x-x,p.y-y);if(d<=distance){best=i;distance=d;}});return best;}
  function install(d,api){
    let active=null;const diagnostics={down:0,move:0,up:0,cancel:0,trustedTouch:0};
    const release=()=>{if(!active)return;const a=active;active=null;try{a.target.releasePointerCapture(a.id);}catch(_){}d.dragPartGhost.hidden=true;d.touchPreview.hidden=true;d.slot0.classList.remove('snap');d.slot1.classList.remove('snap');};
    function down(e,kind,part){if(active){release();return;}if(!api.allowed(kind))return;e.preventDefault();active={id:e.pointerId,kind,part,target:e.currentTarget,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,touch:e.pointerType==='touch',moved:false,snap:null,angle:null};e.currentTarget.setPointerCapture(e.pointerId);diagnostics.down++;if(e.isTrusted&&active.touch)diagnostics.trustedTouch++;if(part)api.select(part);}
    function move(e){if(!active||e.pointerId!==active.id)return;const a=active,rect=d.stage.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;a.moved ||= Math.hypot(e.clientX-a.x,e.clientY-a.y)>6;diagnostics.move++;
      if(a.kind==='camera')api.rotate(e.clientX-a.lastX,e.clientY-a.lastY);
      if(a.kind==='part'&&a.moved){d.dragPartGhost.hidden=false;d.dragPartGhost.textContent=a.target.querySelector('b').textContent;d.dragPartGhost.style.left=e.clientX+'px';d.dragPartGhost.style.top=e.clientY+'px';a.snap=nearest(api.slots(),x,y,30);[d.slot0,d.slot1].forEach((slot,i)=>slot.classList.toggle('snap',a.snap===i));if(a.touch&&a.snap!==null){const p=api.slots()[a.snap];api.preview(p.x,p.y,'接點預覽');}}
      if(a.kind==='node'){a.angle=api.angle(x,y,a.touch?24:14);api.moveNode(a.angle);if(a.touch)api.preview(x,y,'變軌標記預覽');}
      a.lastX=e.clientX;a.lastY=e.clientY;
    }
    function up(e){if(!active||e.pointerId!==active.id)return;const a=active;diagnostics.up++;release();if(a.kind==='part'){if(!a.moved)api.attach();else if(a.snap!==null)api.attach(a.snap);else api.missed();}if(a.kind==='node'&&a.angle!==null)api.commitNode(a.angle);api.end();}
    function cancel(){if(active){diagnostics.cancel++;release();api.end();}}
    function bind(target,kind,part){target.addEventListener('pointerdown',e=>down(e,kind,part));target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',cancel);target.addEventListener('lostpointercapture',cancel);}
    d.partsGrid.querySelectorAll('[data-part]').forEach(b=>{bind(b,'part',b.dataset.part);b.addEventListener('click',e=>{if(e.detail===0&&api.allowed('part')){api.select(b.dataset.part);api.attach();}});});bind(d.nodeHandle,'node');bind(d.cameraSurface,'camera');
    d.cameraSurface.addEventListener('keydown',e=>{const delta={ArrowLeft:[-14,0],ArrowRight:[14,0],ArrowUp:[0,-14],ArrowDown:[0,14]}[e.key];if(delta){e.preventDefault();api.rotate(...delta);}});
    document.addEventListener('pointerdown',e=>{if(active&&e.pointerId!==active.id)cancel();},true);
    return {cancel,diagnostics,get active(){return active;}};
  }
  return Object.freeze({nearest,install});
});
