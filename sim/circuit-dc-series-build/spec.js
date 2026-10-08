(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../circuit-workbench/circuit-model'):root.CircuitModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitTaskSpec=api;})(globalThis,function(M){
'use strict';
const ACTIVITY='circuit-dc-series-build',title='兩燈串聯搭建';
function config(){const d=M.empty();d.cables={count:4,length:600,resistance:0};d.display.flow='off';d.display.values=false;
return {role:'student',initialDocument:d,wirePointLimit:8,palette:[{type:'battery',limit:1,params:{voltage:6,resistance:0}},{type:'switch',limit:1},{type:'lamp',limit:2,params:{model:'ideal',resistance:12,ratedVoltage:6}}],components:{default:{move:true,rotate:true,remove:true,switch:true}},ui:{header:false,palette:true,inspector:true,viewToggle:true}};}
return {ACTIVITY,title,count:1,config,tasks:['從工具箱取出一個 6 V 電源、一個開關、兩個 12 Ω 恆阻燈和最多四條導線，搭建能亮起的兩燈串聯電路。'],rubric:'兩燈串聯 30 分；開關與兩燈串聯 20 分；全部元件形成環路接線 30 分；兩燈各有 0.25 A 電流 20 分。合格須達 80 分且兩燈亮起。'};
});
