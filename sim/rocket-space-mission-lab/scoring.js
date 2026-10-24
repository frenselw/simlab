(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./orbit.js'):root.RocketOrbit);if(node)module.exports=api;root.RocketScoring=api;})(typeof window==='undefined'?globalThis:window,function(P,O){
  'use strict';
  function score(s){
    const [a,b]=s.records,oa=a?O.elements(a.state):null,ob=b?O.elements(b.after):null,target=P.TARGETS[s.variant],inBand=h=>h!==null&&h>=target*.9-1&&h<=target*1.1+1;
    const boundA=oa?.bound&&a.status==='flying',boundB=ob?.bound&&Math.hypot(b.after[0],b.after[1])>P.R;
    const conditions=[a&&P.complete(a.craft)&&P.twr(a.craft)>1.05+1e-6,oa&&oa.height>=100000-1,boundA&&oa.hp>=150000-1&&oa.ha<=1000000+1,boundA&&oa.hp>=200000-1&&oa.ha<=400000+1&&oa.e<=.03+1e-6,boundB&&inBand(ob.ha),boundB&&inBand(ob.hp),boundB&&inBand(ob.hp)&&inBand(ob.ha)&&ob.hp>=150000-1&&ob.e<=.03+1e-6];
    const names=['A：可起飛設計','A：到達太空高度','A：安全束縛軌道','A：目標近圓軌道','B：遠地點到達目標','B：近地點到達目標','B：完成圓化'],points=[10,10,20,20,15,15,10];
    const detail=names.map((title,i)=>({id:String(i+1),title,earned:conditions[i]?points[i]:0,max:points[i]})),total=detail.reduce((v,d)=>v+d.earned,0);
    return {score:total,maxScore:100,passed:total>=60,completed:true,detail};
  }
  return Object.freeze({score});
});
