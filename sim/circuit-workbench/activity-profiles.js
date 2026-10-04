(function (root,factory) {
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-checks'):root.CircuitChecks);
  if(node)module.exports=api;else root.CircuitActivityProfiles=api;
})(typeof window==='undefined'?globalThis:window,function(M,C) {
  'use strict';
  const definitions=[
    {id:'two-lamps',title:'兩燈串聯',task:'只用導線，把這兩盞燈串聯。這一題只檢查接法，不需要電源。'},
    {id:'toolbox',title:'指定工具箱',task:'取出一個電源、一個開關及兩盞燈，搭建能亮起的串聯電路。'},
    {id:'fixed',title:'固定元件接線',task:'元件的位置與參數已固定。接好導線，讓兩盞燈串聯並亮起。'},
    {id:'slider',title:'滑片向右，燈變暗',task:'用四孔滑動變阻器控制燈泡。接好後，滑片向右移動要令燈變暗；只有滑片位置可調。'}
  ];
  function twoLampCheck(doc,powered) {
    const lamps=doc.components.filter(c=>c.type==='lamp');
    if(lamps.length!==2)return {passed:false,message:'請使用兩盞燈。',evidence:{count:lamps.length}};
    if(powered&&(doc.components.filter(c=>c.type==='battery').length!==1||doc.components.filter(c=>c.type==='switch').length!==1))return {passed:false,message:'請使用一個電源及一個開關。',evidence:{}};
    const checks=[C.series(doc,lamps.map(c=>c.id),{requirePowered:powered})];
    if(powered){const parts=doc.components.filter(c=>['battery','switch','lamp'].includes(c.type));checks.push(C.series(doc,parts.map(c=>c.id),{requirePowered:true}));}
    return checks.length===1?checks[0]:C.all(...checks);
  }
  function create(id) {
    const definition=definitions.find(d=>d.id===id);if(!definition)throw new Error('未知活動示例');
    const d=M.empty();d.cables={count:id==='two-lamps'?4:8,length:600};d.display.flow='off';d.display.values=false;
    const add=(type,x,y,label,angle=0,params={})=>{const c=M.add(d,type,x,y,params);c.label=label;c.angle=angle;return c;};
    let components={},palette=[],ui={inspector:false,viewToggle:true};
    if(id==='two-lamps'){add('lamp',260,220,'燈泡 1');add('lamp',560,220,'燈泡 2');}
    else if(id==='toolbox'){
      palette=[{type:'battery',limit:1},{type:'switch',limit:1},{type:'lamp',limit:2}];
      components={default:{move:true,rotate:true,remove:true,switch:true}};
      ui={palette:true,inspector:true,viewToggle:true};
    }else if(id==='fixed'){
      add('battery',160,260,'電源',90);add('switch',340,120,'開關');add('lamp',600,120,'燈泡 1');add('lamp',600,380,'燈泡 2',90);
      components={byType:{switch:{switch:true}}};
    }else{
      add('battery',120,250,'電源',90);add('switch',340,100,'開關');add('lamp',550,300,'燈泡',90);add('rheostat',350,440,'滑動變阻器',0,{resistance:40,terminals:4,position:.5});
      components={byType:{switch:{switch:true},rheostat:{params:['position']}}};ui={inspector:true,viewToggle:true};
    }
    return {role:'student',title:definition.title,subtitle:'活動示例',initialDocument:M.validate(d),palette,components,ui,
      check:doc=>id==='slider'?C.sliderEffect(doc,{rheostat:'c4',lamp:'c3',direction:'right',effect:'dimmer'}):twoLampCheck(doc,id!=='two-lamps')};
  }
  return {definitions,create};
});
