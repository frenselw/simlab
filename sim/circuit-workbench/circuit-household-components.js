(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry'):root.CircuitRegistry);
  if(node)module.exports=api;else root.CircuitHouseholdComponents=api;
})(globalThis,function(R){
  'use strict';
  const colours=Object.freeze({L:'#a56535',N:'#2583b5',E:'#5d9b49',unknown:'#738698'});
  const applianceKinds=Object.freeze({
    metal:{heater:{label:'熱水器',power:2000},aircon:{label:'冷氣機',power:1000},fan:{label:'金屬外殼風扇',power:60}},
    insulated:{blender:{label:'攪拌機',power:400},fan:{label:'風扇',power:60},dryer:{label:'吹風機',power:1200},vacuum:{label:'吸塵機',power:700}}
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
    'house-insulated':{name:'雙重絕緣用電器',icon:'雙重',ports:workPorts,bounds:{left:-64,right:64,top:-69,bottom:101},primaryParameter:'kind',params:{kind:{...choice('家電種類','blender',Object.keys(applianceKinds.insulated),{...Object.fromEntries(Object.entries(applianceKinds.insulated).map(([k,v])=>[k,v.label+' · '+v.power+' W'])),lamp:'台燈 · 40 W（舊文件）'}),legacyChoices:['lamp']},fault:choice('絕緣狀態',false,[false,true],{false:'正常',true:'內層破損（外層完整）'})}},
    'house-person':{name:'人',icon:'人',ports:[],bounds:{left:-42,right:47,top:-72,bottom:81},params:{stance:choice('站立狀態','grounded',['grounded','insulated'],{grounded:'站在地上',insulated:'站在絕緣椅上'})}},
    'house-rcd':{name:'漏電保護器',icon:'30mA',ports:channelPorts,bounds:box,params:{closed:closed()}}
  };
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(x,y,value,size=14,attrs='')=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${size}" fill="#36546c" ${attrs}>${esc(value)}</text>`;
  const path=(d,colour='#718797',width=2,attrs='')=>`<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
  const rect=(x,y,w,h,fill,rx=5,stroke='#6f879b',width=1.5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  function lead(d,role,width=3){return path(d,colours[role],width)+(role==='E'?path(d,'#edcd4d',width/2,'stroke-dasharray="6 5"'):'');}
  const power=c=>applianceKinds[c.type==='house-metal'?'metal':'insulated']?.[c.params.kind]?.power??(c.type==='house-insulated'&&c.params.kind==='lamp'?40:0);
  const isAppliance=c=>['house-metal','house-insulated'].includes(c.type);
  const isProtection=c=>['house-breaker','house-fuse','house-rcd'].includes(c.type);
  function gradients(id){return `<defs><linearGradient id="${id}-plastic" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#edf3f7"/><stop offset="1" stop-color="#cad7e1"/></linearGradient><linearGradient id="${id}-metal"><stop stop-color="#859aa7"/><stop offset=".2" stop-color="#dfe8ed"/><stop offset=".48" stop-color="#f7fafb"/><stop offset=".75" stop-color="#bdcdd6"/><stop offset="1" stop-color="#8fa5b2"/></linearGradient><linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e7f4f7" stop-opacity=".8"/><stop offset=".5" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#adcad4" stop-opacity=".8"/></linearGradient></defs>`;}
  function caseBox(id,x=-46,y=-52,w=92,h=104){return rect(x+3,y+3,w,h,'#c0ced8',7)+rect(x,y,w,h,`url(#${id}-plastic)`,7,'#446482',2)+path(`M${x+7} ${y+7}H${x+w-7}`,'#fff',2);}
  function channelLeads(){return lead('M-58-22H-40 M40-22H58','L')+lead('M-58 22H-40 M40 22H58','N');}
  function socketHoles(c){return definitions['house-socket'].ports.map(p=>{const w=p.key==='e'?10:16,h=p.key==='e'?16:10;return `<rect data-house-socket-hole="${p.key}" data-port="${c.id}:${p.key}" x="${p.x-w/2}" y="${p.y-h/2}" width="${w}" height="${h}" rx="1" fill="#526676" stroke="#9eb3c0" stroke-width="1.5"/><path d="M${p.x-w/2+2} ${p.y+h/2-2}V${p.y-h/2+2}H${p.x+w/2-2}" fill="none" stroke="#334c5e" stroke-width="2"/>`;}).join('');}
  function fan(c,id,on,palette=false){
    const plastic=c.type==='house-insulated',material=`url(#${id}-${plastic?'plastic':'metal'})`;
    let out=`<ellipse cy="59" rx="29" ry="5" fill="#5b778b" opacity=".1"/><path d="M-27 53Q-24 45-10 44H10Q24 45 27 53V57Q0 64-27 57Z" fill="${material}" stroke="#617f91" stroke-width="1.5"/>`+rect(-5,13,10,34,material,3)+path('M-2 24V44','#f5fafc',1.5)+`<circle cy="-17" r="38" fill="url(#${id}-glass)" fill-opacity=".3" stroke="#58788b" stroke-width="1.6"/><circle cy="-17" r="35" fill="none" stroke="#b0c4cd" stroke-width="1.2"/>`;
    if(!palette){
      out+=lead('M-86-26H-57L-45 -24H-15','L')+lead('M-86 0H-60L-45-10H-15','N');
      out+=`<g data-house-motor="true" data-house-fan-motor="true" transform="translate(0 -17)" opacity=".55"><title>機殼內的馬達，轉軸連接中央扇葉</title><circle cy="-2" r="14" fill="${material}" stroke="#839daa" stroke-width="1"/><circle r="13" fill="url(#${id}-glass)" stroke="#6f8e9f" stroke-width="1"/>`+path('M-15-7H-10 M-15 7H-10','#b48352',1.8);
      for(const angle of [0,90,180,270])out+=`<g transform="rotate(${angle})"><path d="M-5-11Q0-15 5-11L4-7Q0-10-4-7Z" fill="#d9b17e" stroke="#a67843" stroke-width=".8"/>`+path('M-3-12L-2-8 M0-12V-9 M3-12L2-8','#f3d3a5',.7)+'</g>';
      out+=`<circle r="6" fill="${material}" stroke="#809aa8" stroke-width="1"/><circle data-house-fan-shaft="true" r="2.8" fill="#7895a4" stroke="#eff5f7" stroke-width=".7"/></g>`;
      if(plastic)out+=`<circle data-house-insulation="inner" cy="-17" r="16" fill="none" stroke="#83a99c" stroke-width="1.1" opacity=".6"/><circle data-house-insulation="outer" cy="-17" r="19" fill="none" stroke="#6b94ad" stroke-width="1.1" opacity=".6"/>`+(c.params.fault?path('M-14-26l3 4-4 3 3 3','#bd825f',1.6):'')+rect(39,37,14,14,'none',0,'#557d90',1.5)+rect(43,41,6,6,'none',0,'#557d90',1.3);
      else out+=lead('M-86 26H-57L-43 42H20L28 9','E')+`<circle data-house-earth-bond="true" cx="28" cy="9" r="4" fill="#e2dbad" stroke="#7d9a66"/>`+path('M25 9H31','#769266',1)+(c.params.fault?path('M-15 -24L-8 -29L28 9','#c27b54',2,'stroke-dasharray="3 3" data-house-fault-path="true"'):'');
    }
    out+=`<g transform="translate(0 -17)" data-house-fan="${on?'running':'stopped'}"><g data-house-fan-rotor="true" transform="rotate(0)">`;
    for(let n=0;n<3;n++)out+=`<path d="M-4-4C-13-12-19-29-6-31C7-33 23-24 22-14C21-7 11-3 4 2Z" transform="rotate(${n*120})" fill="#94b9c2" fill-opacity="${palette?.85:.48}" stroke="#7b9eac" stroke-width=".8"/><path d="M-5-7Q-12-22-6-28" transform="rotate(${n*120})" fill="none" stroke="#d4e6eb" stroke-width=".9" opacity=".7"/>`;
    out+='</g><g data-house-fan-grille="true" opacity=".6">';
    for(let n=0;n<16;n++){const angle=n*Math.PI/8;out+=path(`M${(7*Math.cos(angle)).toFixed(2)} ${(7*Math.sin(angle)).toFixed(2)}L${(34*Math.cos(angle)).toFixed(2)} ${(34*Math.sin(angle)).toFixed(2)}`,'#7895a2',.55);}
    for(const radius of [24,32])out+=`<circle r="${radius}" fill="none" stroke="#8aa5af" stroke-width=".65"/>`;
    return out+`</g><circle data-house-fan-hub="true" r="6.5" fill="url(#${id}-glass)" fill-opacity=".5" stroke="#7b99a8" stroke-width="1"/><circle r="2.8" fill="${material}" fill-opacity=".6" stroke="#9db4c0" stroke-width=".7"/></g>`+path('M-25-42Q-5-57 20-44','#fff',1.3)+rect(12,50,7,3,'#71929f',1,'none');
  }
  function applianceOutline(c,id,on,palette=false){
    switch(c.params.kind){
      case 'heater':return `<ellipse cy="66" rx="29" ry="4" fill="#5b778b" opacity=".1"/><path d="M-33-51C-33-66 33-66 33-51V49C33 65-33 65-33 49Z" fill="url(#${id}-metal)" stroke="#648293" stroke-width="1.6"/><ellipse cy="-51" rx="33" ry="11" fill="url(#${id}-plastic)" stroke="#87a0ad" stroke-width="1"/>`+path('M-29-45Q0-33 29-45 M-29 46Q0 57 29 46','#b5c5cd',1)+path('M-23-35V38','#fff',1.8)+rect(-17,26,34,20,'#e9f0f3',5,'#a1b5c0',1)+`<circle cy="36" r="6" fill="url(#${id}-plastic)" stroke="#7d98a7" stroke-width="1"/>`+path('M0 36l3-3','#577d94',1.5)+`<circle cx="11" cy="36" r="1.7" fill="${on?'#d5a657':'#a4b8c2'}"/>`+path('M-13 58V67 M13 58V67','#8ea6b1',5)+path('M-13 64V67',colours.N,4)+path('M13 64V67',colours.L,4);
      case 'aircon':return `<path d="M-61-31Q-61-41-51-41H51Q61-41 61-31V22Q60 38 48 38H-48Q-60 38-61 22Z" fill="url(#${id}-plastic)" stroke="#648293" stroke-width="1.6"/>`+path('M-55-31H55 M-55-27H55','#c0ced6',1)+path('M-54 14Q0 20 54 14L50 29Q0 35-50 29Z','#7896a6',1.2)+`<path d="M-53 15Q0 22 53 15L50 28Q0 32-50 28Z" fill="#65808f"/><g data-house-aircon-louver="true" transform="translate(0 14) scale(1 .65) translate(0 -14)"><path d="M-52 16Q0 23 52 16L50 26Q0 33-50 26Z" fill="url(#${id}-plastic)" stroke="#91aab8" stroke-width="1"/>`+path('M-49 19Q0 26 49 19','#eef5f7',1)+`</g><circle data-house-aircon-indicator="${on?'on':'off'}" cx="45" cy="-29" r="2.2" fill="${on?'#59b889':'#b6c5cd'}" stroke="#eff7f5" stroke-width=".6"/><text data-house-aircon-temperature="true" x="51" y="9" text-anchor="end" font-family="system-ui,sans-serif" font-size="14px" font-weight="500" fill="#438b7f" visibility="${on?'visible':'hidden'}" aria-label="25 攝氏度">25<tspan font-size="9px" dy="-4">°C</tspan></text>`+path('M-54-35H40','#fff',1.5);
      case 'fan':return fan(c,id,on,palette);
      case 'blender':return `<ellipse cy="68" rx="36" ry="4" fill="#5b778b" opacity=".1"/><path d="M25-45H35Q48-45 47-29L44-9Q42 1 28-2" fill="none" stroke="#7e9caa" stroke-width="6"/><path d="M26-45H35Q44-45 43-29L40-11Q38-5 29-6" fill="none" stroke="#e7f0f4" stroke-width="2"/><path d="M-28-53H28L22 7H-21Z" fill="url(#${id}-glass)" stroke="#7f9dab" stroke-width="1.5"/>`+path('M-21-46L-17-1 M-9-47V-2','#fff',1.5)+path('M9-38H22 M12-26H21 M14-14H20','#9bb4bf',1)+`<ellipse cy="6" rx="22" ry="5" fill="#c4d7df" stroke="#8da9b7"/><path d="M-11 2L-3-2 0 3 12-1 5 5-5 6Z" fill="url(#${id}-metal)" stroke="#7894a4"/><path d="M-31-56Q0-62 31-56V-51H-31Z" fill="url(#${id}-plastic)" stroke="#7c98a7"/>`+rect(-9,-64,18,7,`url(#${id}-plastic)`,3,'#90a8b5',1)+`<path d="M-23 10H23Q32 12 33 24L36 59Q36 65 29 65H-29Q-36 65-36 59L-33 24Q-32 12-23 10Z" fill="url(#${id}-plastic)" stroke="#648293" stroke-width="1.6"/>`+path('M-28 20L-30 55','#fff',1.5)+rect(-13,58,26,4,'#829fac',2,'#6d8d9f',.8)+path('M-24 65V68 M24 65V68','#718997',4);
      case 'lamp':return `<ellipse cy="62" rx="32" ry="3" fill="#5b778b" opacity=".1"/>`+rect(-31,48,62,13,`url(#${id}-plastic)`,7,'#7291a3',1.2)+path('M-25 52H23','#fff',1.5)+path('M0 48V17L22-20','#7796a9',6)+path('M-1 46V17L21-20','#e2eef3',1.5)+`<circle cy="17" r="4" fill="url(#${id}-metal)" stroke="#7692a2"/><path d="M-17-28Q2-47 28-32L40-4Q8 5-24-4Z" fill="url(#${id}-plastic)" stroke="#668998" stroke-width="1.5"/><path d="M-14-28Q3-39 24-30" fill="none" stroke="#fff" stroke-width="1.3"/><ellipse cx="8" cy="-4" rx="32" ry="6" fill="${on?'#f5dc89':'#c4d2db'}" stroke="#89a1b1" stroke-width="1"/><path d="M-1 1Q8 12 17 1" fill="${on?'#ffed9d':'#e5ebef'}" stroke="#acb6b9" stroke-width="1"/>`+rect(15,51,7,3,'#89a9b8',1,'none');
      case 'dryer':return `<path d="M-24-34Q-34-13-16 5L-8 9-7 51Q4 58 14 47L7 9Q19 8 29 0L55-3V-30L31-33Q7-48-24-34Z" fill="url(#${id}-plastic)" stroke="#64869e" stroke-width="1.5"/>`+path('M-20-31Q6-41 28-29L43-27 M-3 12L-2 46','#fff',1.6)+path('M6 12L12 44Q6 50-4 49','#a8bdc9',1)+rect(42,-28,13,22,'#a6bdca',2,'#7996a6',1)+path('M45-23H51 M45-17H51 M45-11H51','#4f7287',1.3)+rect(-4,20,8,13,'#7fa0b4',3,'#688d9f',1)+path('M-2 24H2','#cde2ea',1)+`<circle cx="-14" cy="-17" r="13" fill="#b9cedb" stroke="#7896aa" stroke-width="1"/><circle cx="-14" cy="-17" r="10" fill="#dce8ed" stroke="#8ba7b6" stroke-width=".7"/>`+path('M-22-20H-6 M-22-15H-6 M-20-10H-8','#7795a8',1);
      case 'vacuum':return `<ellipse cy="48" rx="44" ry="4" fill="#5b778b" opacity=".1"/>`+path('M32 28C67 26 66-51 45-48H28','#829eab',8)+path('M33 27C65 25 64-49 45-49H29','#c6d9e1',1.3)+path('M28-48L12-11','#8ca7b5',5)+path('M27-47L13-13','#e0edf2',1)+path('M8-7H29','#6d8b9d',7)+`<path d="M-36 34Q-41-2-20-10H19Q42-1 43 33Z" fill="url(#${id}-plastic)" stroke="#5f8299" stroke-width="1.5"/>`+path('M-31 27Q0 21 37 27','#b0c3cd',1)+path('M-24-5Q-11-10 14-6','#fff',1.5)+rect(-16,-2,35,15,'#bfd4de',5,'#90adbc',1)+path('M-11 2H13 M-11 6H13','#86a5b5',.8)+`<circle cx="-23" cy="34" r="13" fill="#6a8495" stroke="#465f71" stroke-width="1"/><circle cx="-23" cy="34" r="8" fill="url(#${id}-metal)" stroke="#92acba" stroke-width="1"/><circle cx="-23" cy="34" r="3" fill="#809bab"/><circle cx="31" cy="34" r="10" fill="#6a8495" stroke="#465f71" stroke-width="1"/><circle cx="31" cy="34" r="5" fill="url(#${id}-metal)"/>`;
      default:return '';
    }
  }
  function person(c,r,id){
    const stool=c.params.stance==='insulated',offset=stool?-22:0;
    let out=path(`M-40 ${stool?77:75}H46`,'#b8c7c8',2);
    if(stool)out+=`<path d="M-27 53H29V60H-27Z" fill="url(#${id}-plastic)" stroke="#819da9"/><path d="M-22 60L-26 77H-20L-16 60 M21 60L25 77H31L27 60" fill="#b9ccd6" stroke="#819da9" stroke-width="1.2"/>`+path('M-20 69H25','#9fb5c0',2);
    out+=`<g transform="translate(0 ${offset})">
      <path d="M-11 19H13L15 44 20 67 11 69 2 43-1 34-5 46-9 68-18 67-14 42Z" fill="#617c94" stroke="#48667c" stroke-width="1.2"/>
      <path d="M1 26V38 M-10 30L-12 54 M12 30L15 54" fill="none" stroke="#89a0b2" stroke-width="1"/>
      <path d="M-18 65L-8 66-6 72H-25Q-27 67-18 65 M11 66L20 65 29 70Q30 74 24 74H10Z" fill="#3e596b" stroke="#2e4c60" stroke-width="1"/>
      <path d="M-5-37H5V-27H-5Z" fill="#e0b79c" stroke="#bc957d" stroke-width=".8"/>
      <path d="M-6-30L-15-25-12 2-11 22H13L15-4 14-25 6-30Q0-24-6-30Z" fill="#91b8c8" stroke="#5f879c" stroke-width="1.2"/>
      <path d="M-14-25Q-20-20-21-8L-26 10-19 13-12-6-9-17 M12-25Q18-25 23-12L27-5 34-10 38-4 26 4Q22 5 19 0L10-15" fill="#91b8c8" stroke="#5f879c" stroke-width="1.2"/>
      <path d="M-26 10L-29 18Q-30 23-26 23L-22 20-19 13Z M34-10L38-15Q42-18 44-14L43-9 38-4Z" fill="#e8c3a9" stroke="#ba947c" stroke-width=".9"/>
      <path d="M-6-29L0-23 6-29 M-7 5H9 M-7 18H9" fill="none" stroke="#c3dce5" stroke-width="1"/>
      <path d="M-11-51Q-11-64 1-64Q13-64 13-50L11-41Q6-34 0-36Q-9-38-10-47Z" fill="#e8c3a9" stroke="#b9947f" stroke-width="1"/>
      <path d="M-11-49Q-16-61-5-66Q5-70 13-61L14-49 9-55 3-57-5-54-8-46Z" fill="#4e6776"/>
      <path d="M2-48h2 M9-48h1 M7-46l1 4H5 M3-39Q6-37 9-40" fill="none" stroke="#8b6c5b" stroke-width=".9" stroke-linecap="round"/>
    </g>`;
    if(r?.contact)out+=`<circle data-house-hand="true" cx="40" cy="${-13+offset}" r="5" fill="#e3bfa5" stroke="${Math.abs(r.current||0)>.000001?'#c17845':'#80a18c'}" stroke-width="2"/>`;
    return out;
  }
  function symbol(c,r,d,id){
    if(c.type==='house-person')return person(c,r,id);
    if(c.type==='house-earth')return lead('M58 0H0V11','E')+path('M-22 11H22 M-15 18H15 M-7 25H7','#587d75',2.5);
    if(c.type==='house-mains')return lead('M24-22H76','L')+lead('M24 22H76','N')+`<circle cx="0" r="27" fill="#fff" stroke="#5d7d96" stroke-width="2"/>`+text(0,7,'~',26);
    if(c.type==='house-socket')return caseBox(id)+socketHoles(c);
    if(isAppliance(c)){const metal=c.type==='house-metal';return lead('M-86-26H-28V-12','L')+lead('M-86 0H-28V12','N')+(metal?lead('M-86 26H-45V40H41','E'):'')+rect(-27,-12,54,24,'#fff',0)+path('M-23-8L23 8 M-23 8L23-8','#788c9b',1)+(metal?rect(-43,-40,86,83,'none',5):rect(-39,-36,78,72,'none',4)+rect(-44,-41,88,82,'none',4))+(c.params.fault?(metal?path('M-28-12L-16-18 41 40','#c27b54',2,'stroke-dasharray="3 3" data-house-fault-path="true"'):path('M-39-24l5 6-5 5 5 6','#bd825f',2)):'')+text(0,64,power(c)+' W',14);}
    if(c.type==='house-switch')return path('M-58 0H-20 M20 0H58')+path(`M-20 0L20 ${c.params.closed?0:-24}`,'#617f95',2.5)+`<circle cx="-20" r="3" fill="#fff" stroke="#607b91"/><circle cx="20" r="3" fill="#fff" stroke="#607b91"/>`;
    if(c.type==='house-fuse')return lead('M-64 0H-28 M28 0H64','L')+rect(-28,-12,56,24,'#fff',0)+path(r?.status==='blown'?'M-28 0H-5 M6 0H28':'M-28 0H28','#a97d54',2)+text(0,35,c.params.rating+' A');
    return channelLeads()+caseBox(id)+text(0,-38,c.type==='house-meter'?'kWh':c.type==='house-rcd'?'30 mA':c.params.rating+' A',14)+path(`M-38-22H-14L14 ${(r?.status?r.status==='closed':c.params.closed)||c.type==='house-meter'?-22:-8} M14-22H38 M-38 22H-14L14 ${(r?.status?r.status==='closed':c.params.closed)||c.type==='house-meter'?22:8} M14 22H38`,'#738da0',2)+text(0,45,r?.status==='tripped'?'跳掣':r?.status==='open'?'斷開':'',14);
  }
  function render(c,r={},d={}){
    r=r||{};
    const id=esc((d.idPrefix||'')+'family-art-'+(c.id||c.type)+'-'+(d.view||'real')),metal=`url(#${id}-metal)`,plastic=`url(#${id}-plastic)`,on=Math.abs(r.power||0)>.01;
    let out=gradients(id);
    if(d.palette&&isAppliance(c))return out+applianceOutline(c,id,false,true)+(c.type==='house-insulated'?rect(39,37,14,14,'none',0,'#557d90',1.5)+rect(43,41,6,6,'none',0,'#557d90',1.3):'');
    if(d.view==='schematic'){let drawing=out+symbol(c,r,d,id);if(Number.isFinite(d.renderScale))drawing=drawing.replace(/font-size="([\d.]+)"/g,(_,size)=>`font-size="${Math.max(Number(size),14/d.renderScale)}"`);if(c.angle)drawing=drawing.replace(/<text x="([\d.-]+)" y="([\d.-]+)"/g,(_,x,y)=>`<text x="${x}" y="${y}" transform="rotate(${-c.angle} ${x} ${y})"`);return `<g data-house-apparatus="${c.type}" data-house-view="schematic">${drawing}</g>`;}
    if(c.type==='house-mains')out+=`<defs><linearGradient id="${id}-cable" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8096a3"/><stop offset=".2" stop-color="#dce7ed"/><stop offset=".36" stop-color="#f5f9fb"/><stop offset=".65" stop-color="#b6c8d3"/><stop offset="1" stop-color="#667f90"/></linearGradient></defs><path d="M-51-20H-24A7 20 0 0 1-24 20H-51A7 20 0 0 1-51-20Z" fill="url(#${id}-cable)" stroke="#657e8e" stroke-width="1.5"/><path d="M-50-19C-58-15-58 15-50 19" fill="none" stroke="#eff5f7" stroke-width="1" opacity=".7"/><path d="M-53-9H-28" stroke="#fff" stroke-width="1.3" opacity=".7"/><ellipse cx="-24" rx="7" ry="20" fill="#526b7b" stroke="#8198a6" stroke-width="1.2"/><ellipse cx="-24" rx="4.7" ry="17" fill="#d6e0e5"/><ellipse cx="-24" cy="-7" rx="2.5" ry="4" fill="#a56535"/><ellipse cx="-24" cy="7" rx="2.5" ry="4" fill="#2583b5"/>`+lead('M-24-7H-8C12-7 12-22 32-22H76','L',4)+lead('M-24 7H-8C12 7 12 22 32 22H76','N',4)+path('M-8-8C12-8 12-23 32-23H67','#dab58e',.8)+path('M-8 6C12 6 12 21 32 21H67','#8fc5df',.8)+text(10,-37,'230 V～',14);
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
      if(c.params.kind!=='fan'){
      const lamp=c.params.kind==='lamp',heater=c.params.kind==='heater',center=c.params.kind==='dryer'?{x:-14,y:-17}:c.params.kind==='vacuum'?{x:0,y:12}:lamp?{x:8,y:0}:heater?{x:-4,y:0}:c.params.kind==='blender'?{x:0,y:32}:{x:0,y:-17};
      out+=lead(`M-86-26H-57L-45 ${center.y-7}H${center.x-15}`,'L')+lead(`M-86 0H-60L-45 ${center.y+7}H${center.x-15}`,'N');
      if(heater)out+=rect(-31,-15,54,31,'#ffffffde',4,'#8da6b5',1)+path('M-21-8L-15 8-9-8-3 8 3-8 9 8 15-8','#9b7c59',1.8);
      else if(lamp)out+=`<ellipse cx="8" cy="0" rx="13" ry="12" fill="${on?'#fff1c8':'#eef4f6'}" stroke="#90a8b4"/>`+path('M-7-7H2L4-3 7-7 10-3 13-7H17V7H-7','#b78a57',1.4);
      else out+=`<g data-house-motor="true" transform="translate(${center.x} ${center.y})"><title>馬達：線圈、筒身及轉軸</title><path d="M-15-7H-10 M-15 7H-10" fill="none" stroke="#b48352" stroke-width="2"/><path d="M-9-11H7C15-11 15 11 7 11H-9C-15 11-15-11-9-11Z" fill="url(#${id}-metal)" stroke="#6d8a9c" stroke-width="1.2"/><path d="M-9-8H3V8H-9Z" fill="#e6d0b3" stroke="#ad845b" stroke-width=".7"/><path d="M-7-8V8 M-4-8V8 M-1-8V8 M2-8V8" stroke="#b17a42" stroke-width="1.4"/><path d="M-8-6V6 M-5-6V6 M-2-6V6 M1-6V6" stroke="#efd2a6" stroke-width=".6"/><ellipse cx="8" rx="5" ry="11" fill="url(#${id}-plastic)" stroke="#7894a4" stroke-width="1"/><ellipse cx="9" rx="2.2" ry="4" fill="#688695"/><path d="M9 0H18" stroke="#698392" stroke-width="3.5" stroke-linecap="round"/><path d="M10-1H18" stroke="#dce8ee" stroke-width=".8"/><path d="M-9-10H6" stroke="#fff" stroke-width="1"/></g>`;
      if(c.type==='house-metal'){const bond=c.params.kind==='fan'?{x:28,y:9}:c.params.kind==='heater'?{x:30,y:33}:{x:50,y:30};out+=lead(`M-86 26H-57L-43 42H${bond.x-8}L${bond.x} ${bond.y}`,'E')+`<circle data-house-earth-bond="true" cx="${bond.x}" cy="${bond.y}" r="4" fill="#e2dbad" stroke="#7d9a66"/>`+path(`M${bond.x-3} ${bond.y}H${bond.x+3}`,'#769266',1)+ (c.params.fault?path(`M${center.x-15} ${center.y-7}L${center.x-8} ${center.y-12}L${bond.x} ${bond.y}`,'#c27b54',2,'stroke-dasharray="3 3" data-house-fault-path="true"'):'');}
      else out+=rect(center.x-20,center.y-20,40,40,'none',7,'#83a99c',1.6)+rect(center.x-24,center.y-24,48,48,'none',9,'#6b94ad',1.6)+(c.params.fault?path(`M${center.x-20} ${center.y-14}l5 6-5 5 5 6`,'#bd825f',2):'')+rect(39,37,14,14,'none',0,'#557d90',1.5)+rect(43,41,6,6,'none',0,'#557d90',1.3);
      }
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
    else{const [left,top,right,bottom]=({heater:[-33,-62,33,61],aircon:[-61,-41,61,38],blender:[-35,10,35,65],lamp:[-24,-28,40,-4],dryer:[-29,-34,55,9],vacuum:[-38,-10,43,34]})[c.params.kind];const p=local||{x:left,y:(top+bottom)/2},x=Math.max(left,Math.min(right,p.x)),y=Math.max(top,Math.min(bottom,p.y));q=[{x:left,y},{x:right,y},{x,y:top},{x,y:bottom}].sort((u,v)=>Math.hypot(u.x-p.x,u.y-p.y)-Math.hypot(v.x-p.x,v.y-p.y))[0];}
    return{x:c.x+q.x*a.cos-q.y*a.sin,y:c.y+q.x*a.sin+q.y*a.cos};
  }
  function placeHand(person,point){const h=hand(person);person.x+=point.x-h.x;person.y+=point.y-h.y;}
  return Object.freeze({definitions,colours,applianceKinds,power,isAppliance,isProtection,hand,contactPoint,placeHand,render,palette:Object.keys(definitions).map(type=>({type,label:({'house-socket':'三孔插座','house-metal':'金屬家電','house-insulated':'雙重絕緣'})[type]||definitions[type].name,...(type==='house-mains'?{limit:1}:{})}))});
});
