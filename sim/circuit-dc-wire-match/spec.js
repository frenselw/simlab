(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('../circuit-workbench/circuit-model'):root.CircuitModel);if(node)module.exports=api;else root.CircuitTaskSpec=api;})(globalThis,function(M){
'use strict';

const ACTIVITY='circuit-dc-wire-match',title='電路接線挑戰',count=5,stocks=[4,5,7,8,8],wirePointLimit=64;
const tasks=['單燈電路','兩燈串聯','兩燈並聯','總開關與分路開關','串、並聯混合'];
const descriptions=['正極經開關 S 接燈泡 L₁，再回負極。','正極依次經 S、L₁、L₂，再回負極。','正極經總開關 S 後分成 L₁、L₂ 兩條支路，再回負極。','正極經總開關 S 後分流：一支經 S₁、L₁，另一支經 L₂，再回負極。','正極經 L₃ 後分流：一支經 S₁、L₁，另一支經 L₂，再回負極。'];
const groups=[
[['B:a','S:a'],['S:b','L1:a'],['L1:b','B:b']],
[['B:a','S:a'],['S:b','L1:a'],['L1:b','L2:a'],['L2:b','B:b']],
[['B:a','S:a'],['S:b','L1:a','L2:a'],['B:b','L1:b','L2:b']],
[['B:a','S:a'],['S:b','S1:a','L2:a'],['S1:b','L1:a'],['B:b','L1:b','L2:b']],
[['B:a','L3:a'],['L3:b','S1:a','L2:a'],['S1:b','L1:a'],['B:b','L1:b','L2:b']]
];
function transform(v,x,y){if(v>=8){const n=v-8,stretch=n>=4?1.1:1;return{x:300+(x-300)*stretch*(n%2?-1:1),y:300+(y-260)*(Math.floor(n/2)%2?-1:1)};}const mirror=v>=4,turn=[1,2,3,1][v%4],stretch=v%4===3?1.1:1;let a=(x-300)*stretch*(mirror?-1:1),b=y-260;for(let i=0;i<turn;i++)[a,b]=[-b,a];return{x:300+a,y:300+b};}
function initial(q,v){if(!Number.isInteger(q)||q<0||q>=5||!Number.isInteger(v)||v<0||v>15)throw Error('題面無效');const d=M.empty();d.cables={count:stocks[q],length:1200,resistance:0};d.display.flow='off';d.display.values=false;
const add=(id,type,x,y,angle=0)=>{const c=M.add(d,type,x,y,type==='switch'?{closed:false}:{});c.id=id;c.label={B:'電源',S:'S',S1:'S₁',L1:'L₁',L2:'L₂',L3:'L₃'}[id];Object.assign(c,transform(v,x,y));c.angle=v>=8?(type==='lamp'?0:(v%2?180-angle:angle)):(((v>=4?180-angle:angle)+[1,2,3,1][v%4]*90)%360+360)%360;};
add('B','battery',420,440);add(q===4?'L3':'S',q===4?'lamp':'switch',160,440,180);
if(q>=3)add('S1','switch',160,80);
add('L1','lamp',q===1?200:360,80);if(q>0)add('L2','lamp',q===1?400:360,q===1?80:260);return d;}
function config(q=0,v=0,panelContent,revision=3){return{role:'student',initialDocument:initial(q,v),palette:[],wireResistance:false,wirePointLimit:revision===2?96:wirePointLimit,components:{byType:{switch:{switch:true}}},ui:{header:false,palette:false,inspector:true,wireList:true,viewToggle:true,quickParameters:false,status:true,pickWire:false,cableToolbox:true,mathNames:true},...(panelContent?{panelContent}:{})};}
return{ACTIVITY,title,count,snapshotLimit:64000,wirePointLimit,stocks,tasks,descriptions,groups,initial,config,transform};

});
