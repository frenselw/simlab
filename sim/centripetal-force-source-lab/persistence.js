(function (root, factory) {
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.CentripetalSourceModel);
  if(node)module.exports=api;if(root)root.CentripetalSourcePersistence=api;
})(typeof window==='undefined'?globalThis:window,function(M){
  'use strict';
  const MAX_BYTES=4000;
  const bytes=x=>new TextEncoder().encode(JSON.stringify(x)).length;
  const check=x=>{if(!x)throw Error('Invalid centripetal-force snapshot');};
  const exact=(x,keys)=>check(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k)));
  const ROOT=['v','mv','rv','seed','def','phase','view','page','fromReview','returnTo','items','concept'];
  const ITEM=['inward','arrows','relation','palette','selected','pose'];
  function validate(s,kind='draft',legacy=false){
    check(kind==='draft'||kind==='review');exact(s,ROOT);
    check(s.v===(legacy?1:2)&&s.mv===(legacy?1:2)&&s.rv===1&&M.integer(s.seed,0,4294967295)&&M.validDefinition(s.def));
    check((kind==='review'?s.phase==='review':['edit','check'].includes(s.phase))&&['scene','analysis'].includes(s.view)&&M.integer(s.page,0,5));
    check(typeof s.fromReview==='boolean');
    check(s.returnTo===null||(Array.isArray(s.returnTo)&&s.returnTo.length===2&&M.integer(s.returnTo[0],0,5)&&['scene','analysis'].includes(s.returnTo[1])));
    check(s.phase!=='check'||s.returnTo!==null);
    check(Array.isArray(s.items)&&s.items.length===6);
    s.items.forEach((item,page)=>{
      exact(item,legacy?ITEM.slice(0,-1):ITEM);
      if(!legacy)check(item.pose===null||M.integer(item.pose,0,9999));
      if(!legacy&&(page===3||page===4))check(item.pose===null||item.pose===5000);
      check(item.inward===null||M.DIRECTIONS.includes(item.inward));
      check(item.relation===null||M.CASES[page].choices.some(c=>c[0]===item.relation));
      check(item.palette===null||M.integer(item.palette,0,8));
      check(Array.isArray(item.arrows)&&item.arrows.length<=6);
      item.arrows.forEach(a=>check(Array.isArray(a)&&a.length===3&&M.integer(a[0],0,8)&&(a[1]===null||M.integer(a[1],0,3599))&&M.integer(a[2],40,100)));
      check(item.selected===null||M.integer(item.selected,0,item.arrows.length-1));
    });
    check(s.concept===null||M.CONCEPT.some(c=>c[0]===s.concept));
    check(bytes(s)<=MAX_BYTES);
    return s;
  }
  function draft(s){validate(s,'draft');return M.clone(s);}
  function review(s){validate(s,'draft');const n=M.clone(s);n.phase='review';validate(n,'review');return n;}
  function decode(snapshot,kind){
    check(snapshot&&snapshot.version===1&&snapshot.activity===M.ACTIVITY&&snapshot.kind===kind&&bytes(snapshot)<=MAX_BYTES);
    const s=M.clone(snapshot.answer);
    if(s.v===1){validate(s,kind,true);s.v=2;s.mv=2;s.items.forEach(item=>{item.pose=null;});}
    validate(s,kind);return s;
  }
  return Object.freeze({MAX_BYTES,bytes,validate,draft,review,decode});
});
