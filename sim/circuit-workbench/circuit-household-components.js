(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry'):root.CircuitRegistry);
  if(node)module.exports=api;else root.CircuitHouseholdComponents=api;
})(globalThis,function(R){
  'use strict';
  const colours=Object.freeze({L:'#a56535',N:'#2583b5',E:'#5d9b49',unknown:'#738698'});
  const applianceKinds=Object.freeze({
    metal:{heater:{label:'熱水器',power:2000},aircon:{label:'冷氣機',power:1000},fan:{label:'金屬外殼風扇',power:60}},
    insulated:{lamp:{label:'台燈',power:40},fan:{label:'風扇',power:60},dryer:{label:'吹風機',power:1200},vacuum:{label:'吸塵機',power:1000}}
  });
  const choice=(label,value,choices,labels)=>({label,value,choices,labels});
  const closed=()=>choice('開關狀態',true,[true,false],{true:'合上',false:'斷開'});
  const port=(key,x,y,label,role=null)=>({key,x,y,label,role,dx:Math.sign(x),dy:0,labelVisible:false});
  const channelPorts=[port('li',-58,-22,'火線入','L'),port('lo',58,-22,'火線出','L'),port('ni',-58,22,'零線入','N'),port('no',58,22,'零線出','N')];
  const workPorts=[port('l',-86,-26,'預定火線 L'),port('n',-86,0,'預定零線 N')];
  const box={left:-50,right:50,top:-58,bottom:58};
  const definitions={
    'house-mains':{name:'市電電纜',icon:'~',ports:[port('l',76,-22,'火線 L','L'),port('n',76,22,'零線 N','N')],bounds:{left:-58,right:78,top:-36,bottom:36},params:{}},
    'house-meter':{name:'電能表',icon:'kWh',ports:channelPorts,bounds:box,params:{}},
    'house-breaker':{name:'斷路器',icon:'A',ports:channelPorts,bounds:box,primaryParameter:'rating',params:{rating:choice('額定電流',15,[5,15,30],{5:'5 A',15:'15 A',30:'30 A'}),closed:closed()}},
    'house-socket':{name:'英式三孔插座',icon:'插座',ports:[port('e',0,-22,'地線 E','E'),port('n',-27,24,'零線 N','N'),port('l',27,24,'火線 L','L')],bounds:{left:-52,right:52,top:-53,bottom:54},params:{},portStyle:'hole'},
    'house-switch':{name:'普通開關',icon:'S',ports:[port('a',-58,0,'一端'),port('b',58,0,'另一端')],bounds:{left:-45,right:45,top:-43,bottom:43},params:{closed:closed()}},
    'house-fuse':{name:'保險絲',icon:'熔絲',ports:[port('a',-64,0,'火線一端','L'),port('b',64,0,'火線另一端','L')],bounds:{left:-50,right:50,top:-22,bottom:22},primaryParameter:'rating',params:{rating:choice('額定電流',13,[3,5,13],{3:'3 A',5:'5 A',13:'13 A'})}},
    'house-earth':{name:'接地',icon:'⏚',ports:[port('e',58,0,'接地引線','E')],bounds:{left:-32,right:60,top:-32,bottom:32},params:{}},
    'house-metal':{name:'金屬外殼用電器',icon:'家電',ports:[...workPorts,port('e',-86,26,'外殼接地 E')],bounds:{left:-64,right:64,top:-69,bottom:101},primaryParameter:'kind',params:{kind:choice('家電種類','fan',Object.keys(applianceKinds.metal),Object.fromEntries(Object.entries(applianceKinds.metal).map(([k,v])=>[k,v.label+' · '+v.power+' W']))),fault:choice('絕緣狀態',false,[false,true],{false:'正常',true:'絕緣破損（外殼漏電）'})}},
    'house-insulated':{name:'雙重絕緣用電器',icon:'雙重',ports:workPorts,bounds:{left:-64,right:64,top:-69,bottom:101},primaryParameter:'kind',params:{kind:choice('家電種類','lamp',Object.keys(applianceKinds.insulated),Object.fromEntries(Object.entries(applianceKinds.insulated).map(([k,v])=>[k,v.label+' · '+v.power+' W']))),fault:choice('絕緣狀態',false,[false,true],{false:'正常',true:'內層破損（外層完整）'})}},
    'house-person':{name:'人',icon:'人',ports:[],bounds:{left:-42,right:47,top:-72,bottom:81},params:{stance:choice('站立狀態','grounded',['grounded','insulated'],{grounded:'站在地上',insulated:'站在絕緣椅上'})}},
    'house-rcd':{name:'漏電保護器',icon:'30mA',ports:channelPorts,bounds:box,params:{closed:closed()}}
  };
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(x,y,value,size=14,attrs='')=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${size}" fill="#36546c" ${attrs}>${esc(value)}</text>`;
  const path=(d,colour='#718797',width=2,attrs='')=>`<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
  const rect=(x,y,w,h,fill,rx=5,stroke='#6f879b',width=1.5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  function lead(d,role,width=3){return path(d,colours[role],width)+(role==='E'?path(d,'#edcd4d',width/2,'stroke-dasharray="6 5"'):'');}
  const power=c=>applianceKinds[c.type==='house-metal'?'metal':'insulated']?.[c.params.kind]?.power??0;
  const isAppliance=c=>['house-metal','house-insulated'].includes(c.type);
  const isProtection=c=>['house-breaker','house-fuse','house-rcd'].includes(c.type);
  function gradients(id){return `<defs><linearGradient id="${id}-plastic" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#edf3f7"/><stop offset="1" stop-color="#cad7e1"/></linearGradient><linearGradient id="${id}-metal"><stop stop-color="#859aa7"/><stop offset=".2" stop-color="#dfe8ed"/><stop offset=".48" stop-color="#f7fafb"/><stop offset=".75" stop-color="#bdcdd6"/><stop offset="1" stop-color="#8fa5b2"/></linearGradient><linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e7f4f7" stop-opacity=".8"/><stop offset=".5" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#adcad4" stop-opacity=".8"/></linearGradient></defs>`;}
  function caseBox(id,x=-46,y=-52,w=92,h=104){return rect(x+3,y+3,w,h,'#c0ced8',7)+rect(x,y,w,h,`url(#${id}-plastic)`,7,'#446482',2)+path(`M${x+7} ${y+7}H${x+w-7}`,'#fff',2);}
  function channelLeads(){return lead('M-58-22H-40 M40-22H58','L')+lead('M-58 22H-40 M40 22H58','N');}
  function socketHoles(c){return definitions['house-socket'].ports.map(p=>`<rect data-house-socket-hole="${p.key}" data-port="${c.id}:${p.key}" x="${p.x-5}" y="${p.y-8}" width="10" height="16" rx="1" fill="#526676" stroke="#9eb3c0" stroke-width="1.5"/><path d="M${p.x-3} ${p.y+6}V${p.y-6}H${p.x+3}" fill="none" stroke="#334c5e" stroke-width="2"/>`).join('');}
  function fan(id,on,plastic=false){const material=`url(#${id}-${plastic?'plastic':'metal'})`;let out=rect(-22,46,44,14,material,7)+rect(-6,15,12,33,plastic?'#c2d5df':'#abbfc9',4)+`<circle cy="-17" r="38" fill="${material}" stroke="#667f90" stroke-width="2"/><circle cy="-17" r="33" fill="#edf4f5" stroke="#91a5b2"/>`;
    out+=`<g transform="translate(0 -17)" data-house-fan="${on?'running':'stopped'}">`;
    for(let n=0;n<3;n++)out+=`<path d="M0 0C-5-12-28-28-15-29C5-36 21-15 0 0Z" transform="rotate(${n*120})" fill="${on?'#92b8bb':'#9aafb7'}" stroke="#6d929b"/>`;
    out+='</g>';
    for(let x=-28;x<=28;x+=7){const dy=Math.sqrt(33*33-x*x);out+=path(`M${x} ${-17-dy}V${-17+dy}`,'#78939e',.8);}
    for(let n=0;n<4;n++)out+=`<ellipse cy="-17" rx="${8+n*7}" ry="33" fill="none" stroke="#78939e" stroke-width=".7"/>`;
    return out+'<circle cy="-17" r="6" fill="#7599a7" stroke="#517285"/>';
  }
  function applianceOutline(c,id,on){
    switch(c.params.kind){
      case 'heater':return rect(-33,-62,66,123,`url(#${id}-metal)`,22)+`<ellipse cy="-50" rx="27" ry="10" fill="#eaf1f4" stroke="#98adb9"/>`+rect(-22,-1,44,30,'#d8e4eb',6)+`<circle cy="9" r="6" fill="#e8f0f5" stroke="#7893a4"/>`+path('M0 9l3-3','#4d7e9a')+path('M-13 59v7 M13 59v7','#7694a6',5)+`<circle cx="14" cy="23" r="2" fill="${on?'#d4a650':'#9cb2bf'}"/>`;
      case 'aircon':return rect(-58,-38,122,79,'#b3c6d2',7)+rect(-61,-41,122,79,`url(#${id}-metal)`,7,'#446482',2)+rect(-51,-30,102,18,'#f5f9fb',3)+path('M-51 6H51 M-51 13H51 M-49 20H49 M-46 27H46','#8ca6b5',2)+`<circle cx="44" cy="-20" r="2" fill="${on?'#71a478':'#a1b5c1'}"/>`;
      case 'fan':return fan(id,on,c.type==='house-insulated');
      case 'lamp':return rect(-31,48,62,13,`url(#${id}-plastic)`,7)+path('M0 48V17L22-20','#7796a9',7)+path('M0 48V17L22-20','#d7e6ec',2)+`<path d="M-17-28Q2-47 28-32L40-4H-24Z" fill="url(#${id}-plastic)" stroke="#668998" stroke-width="2"/><ellipse cx="8" cy="-4" rx="32" ry="6" fill="${on?'#f5dc89':'#c4d2db'}" stroke="#89a1b1"/><path d="M-1 1Q8 12 17 1" fill="${on?'#ffed9d':'#e5ebef'}" stroke="#acb6b9"/>`;
      case 'dryer':return `<path d="M-24-34Q-34-13-16 5L-8 9-7 51Q4 58 14 47L7 9Q19 8 29 0L55-3V-30L31-33Q7-48-24-34Z" fill="url(#${id}-plastic)" stroke="#64869e" stroke-width="2"/>`+rect(42,-28,13,22,'#a6bdca',2)+path('M45-23H51 M45-17H51 M45-11H51','#4f7287')+rect(-4,20,8,13,'#7fa0b4',3)+`<circle cx="-14" cy="-17" r="13" fill="#b9cedb" stroke="#7896aa"/>`+path('M-22-20H-6 M-22-15H-6 M-20-10H-8','#7795a8',1);
      case 'vacuum':return path('M32 28C67 26 66-51 45-48H28','#829eab',9)+path('M28-48L12-11','#8ca7b5',5)+path('M8-7H29','#6d8b9d',8)+`<path d="M-36 34Q-41-2-20-10H19Q42-1 43 33Z" fill="url(#${id}-plastic)" stroke="#5f8299" stroke-width="2"/>`+rect(-16,-2,35,15,'#bfd4de',5)+`<circle cx="-23" cy="34" r="13" fill="#6a8495" stroke="#465f71"/><circle cx="-23" cy="34" r="6" fill="#c4d4dd"/><circle cx="31" cy="34" r="10" fill="#6a8495" stroke="#465f71"/>`;
      default:return '';
    }
  }
  function person(c,r,id){
    const stool=c.params.stance==='insulated',offset=stool?-22:0;
    let out=path('M-40 77H46','#b8c7c8',2);
    if(stool)out+=rect(-28,53,56,10,`url(#${id}-plastic)`,3)+path('M-22 63L-26 77 M22 63L26 77 M-21 70H21','#91a6b0',4);
    out+=`<g transform="translate(0 ${offset})"><path d="M-9 20L-13 58-27 72H-10L2 51 13 71H29L19 58 12 20Z" fill="#607c94" stroke="#3e5d75" stroke-width="1.5"/><path d="M-10-27Q0-34 11-26L17 9 12 25H-12L-17 7Z" fill="#88aebc" stroke="#567e91" stroke-width="1.5"/><path d="M-13-21L-22-4-34-8" fill="none" stroke="#88aebc" stroke-width="12" stroke-linecap="round"/><path d="M12-20L24-3 38-12" fill="none" stroke="#88aebc" stroke-width="12" stroke-linecap="round"/><path d="M34-10l8-4" stroke="#dfb79c" stroke-width="8" stroke-linecap="round"/><circle cy="-49" r="15" fill="#e3bfa5" stroke="#b58f78"/><path d="M-14-49Q-18-65-1-65Q15-65 14-49L7-56-6-55Z" fill="#627987"/><path d="M-25 72H-10 M14 72H29" stroke="#425b6b" stroke-width="5" stroke-linecap="round"/></g>`;
    if(r?.contact)out+=`<circle data-house-hand="true" cx="40" cy="${-13+offset}" r="5" fill="#e3bfa5" stroke="${Math.abs(r.current||0)>.000001?'#c17845':'#80a18c'}" stroke-width="2"/>`;
    return out;
  }
  function symbol(c,r,d,id){
    if(c.type==='house-person')return person(c,r,id);
    if(c.type==='house-earth')return lead('M58 0H0V11','E')+path('M-22 11H22 M-15 18H15 M-7 25H7','#587d75',2.5);
    if(c.type==='house-mains')return lead('M24-22H76','L')+lead('M24 22H76','N')+`<circle cx="0" r="27" fill="#fff" stroke="#5d7d96" stroke-width="2"/>`+text(0,7,'~',26);
    if(c.type==='house-socket')return caseBox(id)+socketHoles(c);
    if(isAppliance(c)){const metal=c.type==='house-metal';return lead('M-86-26H-28V-12','L')+lead('M-86 0H-28V12','N')+(metal?lead('M-86 26H-45V40H41','E'):'')+rect(-27,-12,54,24,'#fff',0)+path('M-23-8L23 8 M-23 8L23-8','#788c9b',1)+(metal?rect(-43,-40,86,83,'none',5):rect(-39,-36,78,72,'none',4)+rect(-44,-41,88,82,'none',4))+text(0,64,power(c)+' W',14);}
    if(c.type==='house-switch')return path('M-58 0H-20 M20 0H58')+path(`M-20 0L20 ${c.params.closed?0:-24}`,'#617f95',2.5)+`<circle cx="-20" r="3" fill="#fff" stroke="#607b91"/><circle cx="20" r="3" fill="#fff" stroke="#607b91"/>`;
    if(c.type==='house-fuse')return lead('M-64 0H-28 M28 0H64','L')+rect(-28,-12,56,24,'#fff',0)+path(r?.status==='blown'?'M-28 0H-5 M6 0H28':'M-28 0H28','#a97d54',2)+text(0,35,c.params.rating+' A');
    return channelLeads()+caseBox(id)+text(0,-27,c.type==='house-meter'?'kWh':c.type==='house-rcd'?'30 mA':c.params.rating+' A',14)+path(`M-38-22H-14L14 ${r?.status==='closed'||c.type==='house-meter'?-22:-36} M14-22H38 M-38 22H-14L14 ${r?.status==='closed'||c.type==='house-meter'?22:8} M14 22H38`,'#738da0',2)+text(0,45,r?.status==='tripped'?'跳掣':r?.status==='open'?'斷開':'',14);
  }
  function render(c,r={},d={}){
    r=r||{};
    const id=esc((d.idPrefix||'')+'family-art-'+(c.id||c.type)+'-'+(d.view||'real')),metal=`url(#${id}-metal)`,plastic=`url(#${id}-plastic)`,on=Math.abs(r.power||0)>.01;
    let out=gradients(id);
    if(d.view==='schematic'){let drawing=out+symbol(c,r,d,id);if(Number.isFinite(d.renderScale))drawing=drawing.replace(/font-size="([\d.]+)"/g,(_,size)=>`font-size="${Math.max(Number(size),14/d.renderScale)}"`);if(c.angle)drawing=drawing.replace(/<text x="([\d.-]+)" y="([\d.-]+)"/g,(_,x,y)=>`<text x="${x}" y="${y}" transform="rotate(${-c.angle} ${x} ${y})"`);return `<g data-house-apparatus="${c.type}" data-house-view="schematic">${drawing}</g>`;}
    if(c.type==='house-mains')out+=`<path d="M-57-20H-25Q-18-20-18 0Q-18 20-25 20H-57" fill="${metal}" stroke="#7b8d98" stroke-width="2"/><ellipse cx="-22" ry="20" rx="7" fill="#dae2e4" stroke="#77929e"/>`+lead('M-21-7C16-7 13-22 40-22H76','L',4)+lead('M-21 7C16 7 13 22 40 22H76','N',4)+text(10,-37,'230 V～',14);
    else if(c.type==='house-meter')out+=channelLeads()+caseBox(id)+rect(-34,-37,68,27,'#b5c6cc',3)+rect(-30,-33,60,19,'#eef6ed',2,'#809888',1)+text(0,-19,Number.isFinite(d.renderScale)&&d.renderScale<.75?'電能':(r.energyKWh||0).toFixed(4),11,'font-variant-numeric="tabular-nums"')+text(0,7,'kWh',14)+rect(-25,19,50,19,'#d9e3e9',3)+Array.from({length:5},(_,n)=>path(`M${-20+n*10} 23V33`,'#94a9b8',1)).join('');
    else if(['house-breaker','house-rcd'].includes(c.type)){
      const shut=r.status?r.status==='closed':c.params.closed,y=shut?5:21;
      out+=channelLeads()+caseBox(id)+rect(-32,-40,64,18,'#e5edf2',2)+text(0,-26,c.type==='house-rcd'?'30 mA':c.params.rating+' A',14)+rect(-25,-9,50,40,'#b4c3cf',4)+rect(-21,y-8,42,16,'#6b8fa8',3,'#456b85')+path(`M-14 ${y-4}H14`,'#aec9d9',2)+text(0,48,r.status==='tripped'?'跳掣':shut?'合上':'斷開',14);
      if(c.type==='house-rcd')out+=rect(26,-3,11,13,'#bba574',2,'#9b865e',1);
    }else if(c.type==='house-socket')out+=caseBox(id,-48,-49,96,98)+rect(-41,-42,82,84,'#f8fafb',6,'#bdcdd7',1)+socketHoles(c)+`<circle cx="-36" r="2.5" fill="#ccd8df"/><circle cx="36" r="2.5" fill="#ccd8df"/>`;
    else if(c.type==='house-switch')out+=path('M-58 0H-36 M36 0H58','#9d795a',3)+caseBox(id,-39,-37,78,74)+`<path d="M-23-25H23V25H-23Z" fill="${plastic}" stroke="#859fae"/><path d="M-23 ${c.params.closed?-25:18}H23V${c.params.closed?-18:25}H-23Z" fill="#bdcdd8"/><path d="M-12 ${c.params.closed?17:-17}H12" stroke="#7190a5" stroke-width="2"/>`+path(`M-18 48L18 ${c.params.closed?48:38}`,'#7b94a5',1.5);
    else if(c.type==='house-fuse')out+=lead('M-64 0H-41 M41 0H64','L')+rect(-36,-12,72,24,`url(#${id}-glass)`,5)+rect(-45,-14,18,28,metal,4)+rect(27,-14,18,28,metal,4)+path(r.status==='blown'?'M-27 0H-7L-3-3 M5 2L9 0H27':'M-27 0H27','#a57c53',2)+path('M-23-7H21','#fff',2)+text(0,-23,c.params.rating+' A',14);
    else if(c.type==='house-earth')out+=lead('M58 0H0V10','E',3)+path('M-23 10H23 M-15 18H15 M-7 26H7','#638171',2.5);
    else if(c.type==='house-person')out+=person(c,r,id);
    else if(isAppliance(c)){
      out+=applianceOutline(c,id,on);
      const lamp=c.params.kind==='lamp',heater=c.params.kind==='heater',center=c.params.kind==='dryer'?{x:-14,y:-17}:c.params.kind==='vacuum'?{x:0,y:12}:lamp?{x:8,y:0}:heater?{x:-4,y:0}:{x:0,y:-17};
      out+=lead(`M-86-26H-72Q-67-26-67-17V${center.y-7}H${center.x-15}`,'L')+lead(`M-86 0H-73Q-67 0-67 8V${center.y+7}H${center.x-15}`,'N');
      if(heater)out+=rect(-31,-15,54,31,'#ffffffde',4,'#8da6b5',1)+path('M-21-8L-15 8-9-8-3 8 3-8 9 8 15-8','#9b7c59',1.8);
      else if(lamp)out+=`<ellipse cx="8" cy="0" rx="13" ry="12" fill="${on?'#fff1c8':'#eef4f6'}" stroke="#90a8b4"/>`+path('M-7-7H2L4-3 7-7 10-3 13-7H17V7H-7','#b78a57',1.4);
      else out+=`<g transform="translate(${center.x} ${center.y})"><circle r="16" fill="url(#${id}-glass)" stroke="#748d9d" stroke-width="1.4"/><path d="M-15-7H-8Q-13-12-2-12Q10-12 9-5Q-1-1-8-4 M-15 7H-8Q-13 12-2 12Q10 12 9 5Q-1 1-8 4" fill="none" stroke="#b48352" stroke-width="2"/><rect x="-5" y="-7" width="11" height="14" rx="3" fill="#b6c9d1" stroke="#688592"/><path d="M-2-6V6 M2-6V6" stroke="#e3edf1" stroke-width="1"/></g>`;
      if(c.type==='house-metal'){const bond=c.params.kind==='fan'?{x:28,y:9}:c.params.kind==='heater'?{x:30,y:33}:{x:50,y:30};out+=lead(`M-86 26H-71Q-65 26-65 42H${bond.x}V${bond.y}`,'E')+`<circle data-house-earth-bond="true" cx="${bond.x}" cy="${bond.y}" r="4" fill="#e2dbad" stroke="#7d9a66"/>`+path(`M${bond.x-3} ${bond.y}H${bond.x+3}`,'#769266',1)+ (c.params.fault?path('M-23-9L-31-26-42-30','#c27b54',2,'stroke-dasharray="3 3"'):'');}
      else out+=rect(center.x-20,center.y-20,40,40,'none',7,'#83a99c',1.6)+rect(center.x-24,center.y-24,48,48,'none',9,'#6b94ad',1.6)+(c.params.fault?path(`M${center.x-20} ${center.y-14}l5 6-5 5 5 6`,'#bd825f',2):'')+rect(39,37,14,14,'none',0,'#557d90',1.5)+rect(43,41,6,6,'none',0,'#557d90',1.3);
      out+=text(0,82,power(c)+' W',14);
      if(Number.isFinite(r.casePotential)&&Math.abs(r.casePotential)>25)out+=path('M50-47l-6 12h9l-6 12','#b87841',2,'data-house-case-live="true"');
    }
    if(Number.isFinite(d.renderScale))out=out.replace(/font-size="([\d.]+)"/g,(_,size)=>`font-size="${Math.max(Number(size),14/d.renderScale)}"`);
    if(c.angle)out=out.replace(/<text x="([\d.-]+)" y="([\d.-]+)"/g,(_,x,y)=>`<text x="${x}" y="${y}" transform="rotate(${-c.angle} ${x} ${y})"`);
    return `<g data-house-apparatus="${c.type}" data-house-view="real" data-house-working="${on}">${out}</g>`;
  }
  for(const [type,definition]of Object.entries(definitions))if(!R.definitions[type])R.register(type,{...definition,analysis:'household',render,dc(){throw new Error('家庭元件需要家庭有效值模型');}});
  const hand=c=>{const p={x:40,y:-13+(c.params.stance==='insulated'?-22:0)},a=R.rotation(c.angle);return{x:c.x+p.x*a.cos-p.y*a.sin,y:c.y+p.x*a.sin+p.y*a.cos};};
  function contactPoint(c,point=null){const a=R.rotation(c.angle),local=point?{x:(point.x-c.x)*a.cos+(point.y-c.y)*a.sin,y:-(point.x-c.x)*a.sin+(point.y-c.y)*a.cos}:null;let q;
    if(c.params.kind==='fan'){const dx=(local?.x??-38),dy=(local?.y??-17)+17,length=Math.hypot(dx,dy)||1;q={x:dx*38/length,y:-17+dy*38/length};}
    else{const [left,top,right,bottom]=({heater:[-33,-62,33,61],aircon:[-61,-41,61,38],lamp:[-24,-28,40,-4],dryer:[-29,-34,55,9],vacuum:[-38,-10,43,34]})[c.params.kind];const p=local||{x:left,y:(top+bottom)/2},x=Math.max(left,Math.min(right,p.x)),y=Math.max(top,Math.min(bottom,p.y));q=[{x:left,y},{x:right,y},{x,y:top},{x,y:bottom}].sort((u,v)=>Math.hypot(u.x-p.x,u.y-p.y)-Math.hypot(v.x-p.x,v.y-p.y))[0];}
    return{x:c.x+q.x*a.cos-q.y*a.sin,y:c.y+q.x*a.sin+q.y*a.cos};
  }
  function placeHand(person,point){const h=hand(person);person.x+=point.x-h.x;person.y+=point.y-h.y;}
  return Object.freeze({definitions,colours,applianceKinds,power,isAppliance,isProtection,hand,contactPoint,placeHand,render,palette:Object.keys(definitions).map(type=>({type,...(type==='house-mains'?{limit:1}:{})}))});
});
