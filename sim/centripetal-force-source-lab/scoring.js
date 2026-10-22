(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.CentripetalSourceModel,node?require('./persistence.js'):root.CentripetalSourcePersistence);
  if(node)module.exports=api;if(root)root.CentripetalSourceScoring=api;
})(typeof window==='undefined'?globalThis:window,function(M,P){
  'use strict';
  function score(s){
    P.validate(s,s.phase==='review'?'review':'draft');
    const detail=M.CASES.map((q,page)=>{
      const item=s.items[page],physics=M.physics(s.def,page),reference=physics.forces;
      const inward=item.inward===physics.inward?3:0;
      const used=new Set(),matches=[];
      for(const [kind,correctAngle] of reference){
        const candidates=item.arrows.map((a,index)=>({a,index})).filter(x=>x.a[0]===kind&&!used.has(x.index));
        candidates.sort((a,b)=>{
          const da=a.a[1]===null?Infinity:M.difference(a.a[1],correctAngle);
          const db=b.a[1]===null?Infinity:M.difference(b.a[1],correctAngle);
          return da-db||a.index-b.index;
        });
        if(candidates.length){const chosen=candidates[0];used.add(chosen.index);matches.push({kind,index:chosen.index,correctAngle,angle:chosen.a[1]});}
      }
      const force=Math.max(0,6*matches.length/reference.length-2*(item.arrows.length-used.size));
      const direction=4*matches.filter(x=>x.angle!==null&&M.difference(x.angle,x.correctAngle)<=100).length/reference.length;
      const relation=item.relation===q.relation?3:0;
      return {id:q.id,title:q.title,earned:inward+force+direction+relation,max:16,inward,force,direction,relation,reference:reference.map(x=>[x[0],x[1]])};
    });
    const concept=s.concept==='radial-effect'?4:0;
    const total=Math.round((detail.reduce((v,d)=>v+d.earned,0)+concept)*100)/100;
    return {score:total,maxScore:100,passed:total>=60,completed:true,detail,concept,feedback:'先找圓心，再畫作用在研究對象上的實際力；向心力表示徑向合效果。'};
  }
  return Object.freeze({score});
});
