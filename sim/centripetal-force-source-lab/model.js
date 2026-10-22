(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CentripetalSourceModel = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const ACTIVITY = 'centripetal-force-source-lab';
  const G = 9.8;
  const KINDS = [
    ['earth-gravity', '地球對物體的重力（mg）'],
    ['sun-gravity', '太陽對地球的引力（F引）'],
    ['tension', '繩對物體的拉力（T）'],
    ['normal', '接觸面對物體的支持力（N）'],
    ['static-friction', '接觸面對物體的靜摩擦力（fₛ）'],
    ['kinetic-friction', '接觸面對物體的滑動摩擦力'],
    ['extra-centripetal', '額外的「向心力」'],
    ['centrifugal', '額外的「離心力」'],
    ['drive', '發動機對物體的推力']
  ];
  const DIRECTIONS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  const DIRECTION_LABELS = ['向右', '右上', '向上', '左上', '向左', '左下', '向下', '右下'];
  const CASES = [
    {id:'string', title:'水平細線牽引小球', note:'光滑水平桌面；細線水平而拉緊。俯視觀察後，在徑向豎直剖面分析小球。', relation:'tension', choices:[['tension','F向 = T；N = mg'],['gravity','F向 = mg'],['normal','F向 = N'],['sum-all','F向 = T + N + mg']]},
    {id:'disk', title:'物體隨水平圓盤轉動', note:'物體與圓盤沒有相對滑動；靜摩擦足以維持圓周運動。', relation:'static', choices:[['static','F向 = fₛ；fₛ ≤ μₛN'],['kinetic','F向 = 滑動摩擦力'],['weight','F向 = mg'],['extra','F向 = 額外的向心力']]},
    {id:'cone', title:'圓錐擺', note:'繩與豎直線夾角為 θ；小球在水平面作等速圓周運動。', relation:'horizontal-resultant', choices:[['horizontal-resultant','F向 = T sin θ；T cos θ = mg。亦即 T 與 mg 的合力向內。'],['full-tension','F向 = T'],['weight','F向 = mg'],['extra','F向 = 額外的向心力']]},
    {id:'crest', title:'拱形路面最高點', note:'只分析汽車在最高點的瞬間；汽車仍接觸路面，忽略驅動、制動及空氣阻力。', relation:'weight-minus-normal', choices:[['weight-minus-normal','F向 = mg − N = mv²/r'],['normal-minus-weight','F向 = N − mg = mv²/r'],['sum','F向 = mg + N'],['weight','F向 = mg']]},
    {id:'trough', title:'凹形路面最低點', note:'只分析汽車在最低點的瞬間；汽車仍接觸路面，忽略驅動、制動及空氣阻力。', relation:'normal-minus-weight', choices:[['weight-minus-normal','F向 = mg − N = mv²/r'],['normal-minus-weight','F向 = N − mg = mv²/r'],['sum','F向 = mg + N'],['weight','F向 = mg']]},
    {id:'earth', title:'地球繞太陽', note:'以太陽近似固定的慣性參考框架分析地球；圓軌道、等速，示意尺寸及時間均非真實比例。', relation:'solar-gravity', choices:[['solar-gravity','F向 = 太陽對地球的引力'],['extra','F向 = 額外的向心力'],['centrifugal','F向 = 離心力'],['balanced-pair','太陽引力與地球對太陽的引力在地球上平衡']]}
  ];
  const CONCEPT = [['radial-effect','向心力是實際作用力的徑向合效果，不另加一個力。'],['extra-force','向心力是在所有實際力之外新增的一個力。'],['motion-force','只要沿圓周運動，運動方向本身會產生一個力。']];
  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = (v,a,b) => Number.isInteger(v) && v >= a && v <= b;
  const draw = (random,n) => { const x=random(); if (!Number.isFinite(x)||x<0||x>=1) throw Error('Invalid random draw'); return Math.floor(x*n); };
  const angle = degrees => ((Math.round(degrees*10)%3600)+3600)%3600;
  const difference = (a,b) => Math.min(Math.abs(a-b),3600-Math.abs(a-b));
  const directionAngle = key => DIRECTIONS.indexOf(key)*450;
  const angleDirection = a => DIRECTIONS[(Math.round(a/450)+8)%8];
  function validDefinition(def) {
    if (!Array.isArray(def)||def.length!==6||!def.every(Array.isArray)) return false;
    const pair=(row,limits)=>row.length===limits.length&&row.every((v,i)=>integer(v,0,limits[i]));
    if (!pair(def[0],[1,1,1,1])||!pair(def[1],[1,1,1,1])||!pair(def[2],[1,1,1,2])||!pair(def[3],[1,2,2])||!pair(def[4],[1,2,2])||!pair(def[5],[7,1])) return false;
    if (def[3].some((v,i)=>v!==def[4][i])) return false;
    const [,mi,ri,vi]=def[1],m=[.1,.2][mi],r=[.3,.4][ri],v=[.5,.7][vi];
    return m*v*v/r <= .5*m*G + 1e-12;
  }
  function fresh(random=Math.random) {
    const bridge=[draw(random,2),draw(random,3),draw(random,3)];
    const def=[
      [draw(random,2),draw(random,2),draw(random,2),draw(random,2)],
      [draw(random,2),draw(random,2),draw(random,2),draw(random,2)],
      [draw(random,2),draw(random,2),draw(random,2),draw(random,3)],
      bridge,bridge.slice(),[draw(random,8),draw(random,2)]
    ];
    const seed=Math.floor(random()*4294967296);
    return {v:1,mv:1,rv:1,seed,def,phase:'edit',view:'scene',page:0,fromReview:false,returnTo:null,
      items:CASES.map(()=>({inward:null,arrows:[],relation:null,palette:null,selected:null})),concept:null};
  }
  function inward(def,page) {
    if (page===3) return 'S';
    if (page===4) return 'N';
    if (page===5) return DIRECTIONS[(def[5][0]+4)%8];
    return def[page][0]===0?'W':'E';
  }
  function physics(def,page) {
    const inner=inward(def,page),a=directionAngle(inner),gravity=angle(270),up=angle(90);
    if (page===0) {const [,mi,ri,vi]=def[0],m=[.1,.2][mi],r=[.3,.45][ri],v=[.6,.9][vi];return {inward:inner,forces:[[0,gravity,m*G],[3,up,m*G],[2,a,m*v*v/r]],values:{m,r,v}};}
    if (page===1) {const [,mi,ri,vi]=def[1],m=[.1,.2][mi],r=[.3,.4][ri],v=[.5,.7][vi];return {inward:inner,forces:[[0,gravity,m*G],[3,up,m*G],[4,a,m*v*v/r]],values:{m,r,v,mu:.5}};}
    if (page===2) {const [,mi,li,ti]=def[2],m=[.2,.3][mi],L=[1,1.2][li],theta=[25,35,45][ti]*Math.PI/180,r=L*Math.sin(theta),T=m*G/Math.cos(theta),omega=Math.sqrt(G/(L*Math.cos(theta))),v=omega*r;return {inward:inner,forces:[[0,gravity,m*G],[2,angle(inner==='E'?90-theta*180/Math.PI:90+theta*180/Math.PI),T]],values:{m,L,theta,r,T,omega,v}};}
    if (page===3||page===4) {const [mi,ri,vi]=def[page],m=[800,1000][mi],r=[20,30,40][ri],lambda=[.4,.6,.8][vi],v=lambda*Math.sqrt(G*r),N=(page===3?1-lambda*lambda:1+lambda*lambda)*m*G;return {inward:inner,forces:[[0,gravity,m*G],[3,up,N]],values:{m,r,lambda,v,N}};}
    return {inward:inner,forces:[[1,a,1]],values:{position:def[5][0],sense:def[5][1]===0?1:-1}};
  }
  function options(state,page) {
    const choices=CASES[page].choices.slice();
    let x=(state.seed ^ Math.imul(page+1,0x9e3779b9))>>>0;
    for(let i=choices.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)>>>0;const j=x%(i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
    return choices;
  }
  function change(state,action) {
    if (state.phase!=='edit') throw Error('Answers locked');
    const n=clone(state),item=n.items[n.page];
    switch(action.type) {
      case 'analyse': n.view='analysis'; break;
      case 'scene': n.view='scene'; break;
      case 'inward': if(action.value!==null&&!DIRECTIONS.includes(action.value))throw Error('Invalid direction');item.inward=action.value;n.view='analysis';break;
      case 'relation': if(action.value!==null&&!CASES[n.page].choices.some(c=>c[0]===action.value))throw Error('Invalid relation');item.relation=action.value;n.view='analysis';break;
      case 'concept': if(action.value!==null&&!CONCEPT.some(c=>c[0]===action.value))throw Error('Invalid concept');n.concept=action.value;break;
      case 'palette': if(action.value!==null&&!integer(action.value,0,8))throw Error('Invalid palette');item.palette=action.value;break;
      case 'add': if(item.palette===null||item.arrows.length>=6)throw Error('Choose a force; six is the limit');item.arrows.push([item.palette,null,60]);item.selected=item.arrows.length-1;n.view='analysis';break;
      case 'select': if(!integer(action.index,0,item.arrows.length-1))throw Error('Invalid force');item.selected=action.index;break;
      case 'kind': if(!integer(item.selected,0,item.arrows.length-1)||!integer(action.value,0,8))throw Error('Invalid force');item.arrows[item.selected][0]=action.value;break;
      case 'arrow': if(!integer(item.selected,0,item.arrows.length-1)||!integer(action.angle,0,3599)||!integer(action.length,40,100))throw Error('Invalid arrow');item.arrows[item.selected][1]=action.angle;item.arrows[item.selected][2]=action.length;n.view='analysis';break;
      case 'delete': if(!integer(item.selected,0,item.arrows.length-1))throw Error('Invalid force');item.arrows.splice(item.selected,1);item.selected=item.arrows.length?Math.min(item.selected,item.arrows.length-1):null;break;
      case 'clear-drawing': item.arrows=[];item.selected=null;break;
      case 'clear-page': n.items[n.page]={inward:null,arrows:[],relation:null,palette:null,selected:null};break;
      default: throw Error('Unknown action');
    }
    return n;
  }
  function navigate(state,page) {if(!integer(page,0,5))throw Error('Invalid page');const n=clone(state);n.page=page;n.phase='edit';return n;}
  return Object.freeze({ACTIVITY,G,KINDS,DIRECTIONS,DIRECTION_LABELS,CASES,CONCEPT,clone,integer,angle,difference,directionAngle,angleDirection,validDefinition,fresh,inward,physics,options,change,navigate});
});
