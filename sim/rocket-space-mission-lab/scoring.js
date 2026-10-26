(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./orbit.js'):root.RocketOrbit);if(node)module.exports=api;root.RocketScoring=api;})(typeof window==='undefined'?globalThis:window,function(O){
  'use strict';
  function evaluate(r){const orbit=r?O.elements(r.state):null,engineOff=Boolean(r&&(r.engineOff??!r.controls?.lit)),safe=Boolean(r&&r.status==='flying'&&engineOff&&O.safe(r.state)),near=Boolean(safe&&orbit.e<=.03+1e-9);return {orbit,engineOff,safe,near};}
  function score(s){
    const r=s.records[0],v=evaluate(r),height=r?.maxHeight||0,circle=v.safe?(v.near?30:Math.min(29,Math.round(30*Math.max(0,Math.min(1,(.06-v.orbit.e)/.03))))):0;
    const detail=[
      {id:'liftoff',title:'成功升空',earned:height>=10-1e-6?10:0,max:10,reason:height>=10-1e-6?'已離台並升至 10 m。':'尚未升至 10 m。'},
      {id:'space',title:'到達太空',earned:height>=100000-1e-6?15:0,max:15,reason:height>=100000-1e-6?'最高海拔已達 100 km。':'最高海拔未達 100 km。'},
      {id:'safe',title:'建立安全軌道',earned:v.safe?45:0,max:45,reason:v.safe?'已關機；近地點至少 150 km、遠地點不超過 1,000 km。':!r?'未保留試飛成果。':!v.engineOff?'引擎仍在推進，需關機保留。':r.status!=='flying'?'試飛已墜毀或離開範圍。':!v.orbit.bound?'尚未建立束縛軌道。':v.orbit.hp<150000-1?'近地點低於 150 km。':'遠地點超過 1,000 km。'},
      {id:'circular',title:'軌道圓化程度',earned:circle,max:30,reason:!v.safe?'先建立安全軌道，再計圓化分數。':v.near?'已接近圓形（e ≤ 0.03）。':'軌道仍較橢圓；e 由 0.06 降至 0.03 可逐步取得 30 分。'}
    ],total=detail.reduce((sum,d)=>sum+d.earned,0);return {score:total,maxScore:100,passed:total>=70,completed:true,detail};
  }
  return Object.freeze({score,evaluate});
});
