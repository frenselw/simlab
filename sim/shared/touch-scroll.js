(function (root, factory) {
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.SimTouchScroll=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  // Only for a secondary touch after cancelling a gesture that started with
  // touch-action:none. Normal background gestures remain wholly browser-owned.
  function findHost(child) {
    try {
      for(let current=child;current.parent!==current;){
        const frame=current.frameElement;if(!frame)return null;
        const host=frame.ownerDocument.defaultView;
        for(let element=frame.parentElement;element;element=element.parentElement){
          if(/^(auto|scroll)$/.test(host.getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+1)return {element,window:host};
        }
        const root=host.document.scrollingElement;
        const htmlOverflow=host.getComputedStyle(host.document.documentElement).overflowY;
        const bodyOverflow=host.document.body?host.getComputedStyle(host.document.body).overflowY:"visible";
        const viewportBlocked=/hidden|clip/.test(htmlOverflow)||(htmlOverflow==="visible"&&/hidden|clip/.test(bodyOverflow));
        if(root&&root.scrollHeight>root.clientHeight+1&&!viewportBlocked)return {element:root,window:host};
        current=host;
      }
    }catch(_){ /* Cross-origin native scrolling still works; no unverified bridge. */ }
    return null;
  }
  function move(owner, screenDelta) {
    if(!owner||!Number.isFinite(screenDelta))return false;
    const delta=screenDelta/(owner.window.visualViewport?.scale||1);
    owner.element.scrollTop+=delta;
    return true;
  }
  return {findHost,move};
});
