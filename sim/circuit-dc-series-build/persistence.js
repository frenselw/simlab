(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./spec'):root.CircuitTaskSpec,node?require('../circuit-workbench/circuit-model'):root.CircuitModel,node?require('../circuit-workbench/circuit-profile'):root.CircuitProfile,node?require('../circuit-workbench/circuit-activity-data'):root.CircuitActivityData);if(node)module.exports=api;else root.CircuitTaskPersistence=api;})(globalThis,function(Q,M,F,A){
'use strict';
const types=['battery','switch','lamp'],profile=F.compile(Q.config());
const fresh=()=>({revision:1,phase:'edit',c:[],j:'',w:[],view:0});
function document(s){A.keys(s,['revision','phase','c','j','w','view']);if(s.revision!==1||!['edit','check'].includes(s.phase)||![0,1].includes(s.view)||!Array.isArray(s.c)||s.c.length>4||!Array.isArray(s.w)||s.w.length>4)throw new Error('接線作答無效');
const d=M.clone(profile.initial);d.display.view=s.view?'schematic':'real';
s.c.forEach(a=>{if(!Array.isArray(a)||a.length!==5||!Number.isInteger(a[0])||!types[a[0]]||(a[0]===1?typeof a[4]!=='boolean':a[4]!==null))throw new Error('元件編碼無效');const type=types[a[0]],p=profile.palette.find(e=>e.type===type);const c=M.add(d,type,a[1],a[2],p.params);c.angle=a[3];if(type==='switch')c.params.closed=a[4];});
const j=A.unpack(s.j,16);if(j.length%2)throw new Error('接點編碼無效');for(let i=0;i<j.length;i+=2)d.junctions.push({id:'j'+(i/2+1),x:j[i],y:j[i+1]});
const ref=n=>{if(!Number.isInteger(n)||n<0||n>=8+d.junctions.length||n<8&&Math.floor(n/2)>=d.components.length)throw new Error('端點編碼無效');return n<8?'c'+(Math.floor(n/2)+1)+':'+(n%2?'b':'a'):'j'+(n-7)+':p';};
s.w.forEach((a,i)=>{if(!Array.isArray(a)||a.length!==5||!Number.isInteger(a[2])||!['auto','free','smooth'][a[2]])throw new Error('導線編碼無效');const nums=A.unpack(a[4],16);if(nums.length%2)throw new Error('線形編碼無效');d.wires.push({id:'w'+(i+1),from:ref(a[0]),to:ref(a[1]),shape:['auto','free','smooth'][a[2]],length:a[3],resistance:0,via:Array.from({length:nums.length/2},(_,k)=>({x:nums[2*k],y:nums[2*k+1]}))});});
return profile.assertSnapshot(d);}
function validate(s){document(s);return M.clone(s);}
function capture(input,s){const d=profile.assertSnapshot(input);if(d.junctions.length>8)throw new Error('接點超出容量');const refs=new Map();d.components.forEach((c,i)=>{refs.set(c.id+':a',i*2);refs.set(c.id+':b',i*2+1);});d.junctions.forEach((j,i)=>refs.set(j.id+':p',8+i));return validate({revision:1,phase:s.phase,c:d.components.map(c=>[types.indexOf(c.type),c.x,c.y,c.angle,c.type==='switch'?c.params.closed:null]),j:A.pack(d.junctions.flatMap(j=>[j.x,j.y])),w:d.wires.map(w=>[refs.get(w.from),refs.get(w.to),['auto','free','smooth'].indexOf(w.shape),w.length,A.pack(w.via.flatMap(p=>[p.x,p.y]))]),view:d.display.view==='schematic'?1:0});}
function decode(x,kind){A.envelope(x,Q.ACTIVITY,kind);const s=validate(x.answer);if(kind==='review'&&s.phase!=='check')throw new Error('提交階段無效');return s;}
return {ACTIVITY:Q.ACTIVITY,fresh,document,capture,validate,draft:validate,review:s=>validate({...s,phase:'check'}),decode,bytes:A.bytes};
});
