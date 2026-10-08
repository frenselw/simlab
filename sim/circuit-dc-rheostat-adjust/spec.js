(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../circuit-workbench/circuit-model'):root.CircuitModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitTaskSpec=api;})(globalThis,function(M){
'use strict';
const ACTIVITY='circuit-dc-rheostat-adjust',title='滑動變阻器調參';
function config(){const d=M.empty();d.cables={count:6,length:600,resistance:0};d.display.flow='off';d.display.values=true;
M.add(d,'battery',140,350,{voltage:6,resistance:0}).angle=90;
M.add(d,'ammeter',280,180,{resistance:0,range:3});
M.add(d,'rheostat',500,180,{resistance:40,terminals:4,position:.5});
M.add(d,'lamp',500,430,{model:'ideal',resistance:12,ratedVoltage:3});
M.add(d,'voltmeter',740,430,{resistance:0,range:15});
for(const [a,b] of [['c1:a','c2:c'],['c2:b','c3:a'],['c3:b','c4:b'],['c4:a','c1:b'],['c5:c','c4:b'],['c5:b','c4:a']])M.connect(d,a,b);
return {role:'student',initialDocument:M.validate(d),wires:false,palette:[],components:{byType:{rheostat:{params:['position']}}},ui:{header:false,palette:false,inspector:true,readings:true,viewToggle:true}};}
return {ACTIVITY,title,count:2,config,tasks:['從初始 50% 滑片位置調到電流 0.25 A（±0.005 A），再選擇接入電阻的變化。','從初始 50% 滑片位置調到燈泡電壓 1.8 V（±0.03 V），再選擇接入電阻的變化。'],rubric:'每題：達到指定讀數 30 分；正確判斷相對初始 50% 的接入電阻變化 20 分。兩題共 100 分，合格 80 分。',reasons:[[-1,'接入電阻減小'],[1,'接入電阻增大']]};
});
