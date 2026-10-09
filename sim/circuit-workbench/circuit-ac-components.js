(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-model'):root.CircuitModel);
  if(node)module.exports=api;else root.CircuitAC=api;
})(globalThis,function(R,M){
  'use strict';
  const TAU=2*Math.PI,ports=[{key:'a',x:-60,y:0,label:'a'},{key:'b',x:60,y:0,label:'b'}];
  const number=(label,unit,value,min,max,step,factor=1)=>({label,unit,value,min,max,step,factor});
  const choices=(label,value,values)=>({label,value,choices:values});
  const resistance=()=>number('線圈電阻','Ω',1,0,1e6,.1);
  const signed=(label,unit)=>number(label,unit,0,-1e6,1e6,.1);
  const types={
    'ac-source':{bounds:{left:-45,right:45,top:-36,bottom:36},name:'交流電源',icon:'~',ports,primaryParameter:'frequency',params:{voltage:number('電動勢有效值','V',6,0,1000,.5),frequency:number('頻率','Hz',1,.1,1000,.1),phase:number('初相位','°',0,-180,180,5),resistance:number('內阻','Ω',0,0,1e6,.1),waveform:choices('波形','sine',['sine','square','triangle'])}},
    generator:{bounds:{left:-48,right:48,top:-42,bottom:42},name:'交流發電機',icon:'G~',ports,primaryParameter:'frequency',params:{frequency:number('轉動頻率','Hz',2,.1,1000,.1),phase:number('初始角度','°',0,-180,180,5),turns:number('線圈匝數','',200,1,2000,10),field:number('磁感應強度','T',.2,0,2,.01),area:number('線圈面積','m²',.02,.0001,.1,.001),resistance:number('內阻','Ω',1,0,1e6,.1)}},
    capacitor:{bounds:{left:-33,right:33,top:-39,bottom:43},name:'電容器',icon:'C',ports,primaryParameter:'capacitance',params:{capacitance:number('電容','μF',.001,1e-6,.01,.0001,1e6),initialVoltage:signed('初始電壓','V'),rating:number('耐壓值','V',25,.1,1e6,1)}},
    inductor:{bounds:{left:-43,right:43,top:-26,bottom:26},name:'電感線圈',icon:'L',ports,primaryParameter:'inductance',params:{inductance:number('自感系數','H',1,.001,100,.1),resistance:resistance(),initialCurrent:signed('初始電流','A')}},
    spdt:{bounds:{left:-45,right:45,top:-37,bottom:37},name:'單刀雙擲開關',icon:'S',ports:[{key:'a',x:-60,y:0,label:'共用'},{key:'b',x:60,y:-24,label:'充電側'},{key:'c',x:60,y:24,label:'放電側'}],params:{closed:choices('接通側','b',['b','c'])}},
    transformer:{name:'變壓器／互感線圈',icon:'T',ports:[{key:'a',x:-76,y:-26,label:'原線圈同名端'},{key:'b',x:-76,y:26,label:'原線圈'},{key:'c',x:76,y:-26,label:'副線圈同名端'},{key:'d',x:76,y:26,label:'副線圈'}],bounds:{left:-80,right:80,top:-48,bottom:58},primaryParameter:'secondaryTurns',params:{model:choices('模型','ideal',['ideal','coupled']),primaryTurns:number('原線圈匝數','',200,1,2000,10),secondaryTurns:number('副線圈匝數','',100,1,2000,10),inductance:number('原線圈電感','H',2,.001,100,.1),coupling:number('耦合係數','',.999,0,.9999,.001),primaryResistance:number('原線圈電阻','Ω',1,0,1e6,.1),secondaryResistance:number('副線圈電阻','Ω',.25,0,1e6,.1),initialPrimaryCurrent:signed('原線圈初始電流','A'),initialSecondaryCurrent:signed('副線圈初始電流','A')}},
    led:{bounds:{left:-31,right:31,top:-47,bottom:41},name:'發光二極管',icon:'LED',ports,params:{forwardVoltage:number('正向壓降','V',1.8,.1,10,.1),resistance:number('導通電阻','Ω',10,.01,1e6,1),colour:choices('顏色','red',['red','green'])}},
    'ac-ammeter':{bounds:{left:-40,right:40,top:-43,bottom:57},name:'交流電流表',icon:'A',meter:true,ports,params:{range:number('量程','A',3,.001,1e6,.5),resistance:number('內阻','Ω',0,0,1e6,.1)}},
    'ac-voltmeter':{bounds:{left:-40,right:40,top:-43,bottom:57},name:'交流電壓表',icon:'V',meter:true,ports,params:{range:number('量程','V',15,.001,1e6,1),resistance:number('輸入電阻（0 為理想）','Ω',0,0,1e12,1000)}},
    'ac-wattmeter':{bounds:{left:-44,right:44,top:-43,bottom:57},name:'交流功率表',icon:'W',meter:true,ports:[{key:'a',x:-60,y:-20,label:'I+'},{key:'b',x:60,y:-20,label:'I−'},{key:'c',x:-60,y:40,label:'V+'},{key:'d',x:60,y:40,label:'V−'}],params:{range:number('量程','W',20,.001,1e6,1),resistance:number('電流線圈內阻','Ω',0,0,1e6,.1),inputResistance:number('電壓線圈內阻（0 為理想）','Ω',0,0,1e12,1000)}}
  };
  for(const type of ['ac-source','generator'])Object.assign(types[type].params.frequency,{controlMax:2,controlSpecial:50});
  types['ac-source'].params.waveform.labels={sine:'正弦波',square:'方波',triangle:'三角波'};types.transformer.params.model.labels={ideal:'理想交流',coupled:'線性線圈'};types.spdt.params.closed.labels={b:'充電側',c:'放電側'};types.led.params.colour.labels={red:'紅色',green:'綠色'};
  const baseTypes=['battery','resistor','rheostat','switch','lamp','galvanometer','ammeter','voltmeter','wattmeter'];
  const supported=c=>!!types[c.type]||baseTypes.includes(c.type)&&!(c.type==='lamp'&&c.params.model!=='ideal');
  const wrap=phase=>{const value=((phase%TAU)+TAU)%TAU;return value<1e-12||TAU-value<1e-12?0:Math.abs(value-Math.PI)<1e-12?Math.PI:value;};
  function source(c,theta,left=false){
    if(c.type==='battery')return c.params.voltage*c.params.polarity;
    const p=c.params;if(c.type==='generator')return p.turns*p.field*p.area*TAU*p.frequency*Math.sin(theta);
    const angle=wrap(theta-(left?1e-11:0));
    return p.waveform==='square'?p.voltage*(angle<Math.PI?1:-1):p.waveform==='triangle'?p.voltage*Math.sqrt(3)*2/Math.PI*Math.asin(Math.sin(theta)):p.voltage*Math.sqrt(2)*Math.sin(theta);
  }
  function toAC(input){const d=M.validate(input);if(d.version<7){d.version=7;d.analysis='transient';d.modelRevision=1;}const bad=d.components.filter(c=>!supported(c));if(bad.length)throw new Error('時間模型不支援：'+bad.map(c=>c.label).join('、'));return M.validate(d);}
  const text=(value,x=0,y=7,size=18)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#334155">${value}</text>`;
  const path=(d,stroke='#475569',width=3)=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const coil='M-34 0q0-16 11.333333-16t11.333334 16q0-16 11.333333-16t11.333334 16q0-16 11.333333-16t11.333334 16';
  const socket=(x,y)=>`<circle cx="${x}" cy="${y}" r="5" fill="#b7c6cf" stroke="#526779"/><circle cx="${x}" cy="${y}" r="2" fill="#3c4d5b"/>`;
  const caseBox=(x,y,w,h,fill='#d9e6ef')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="#567185" stroke-width="2"/><path d="M${x+7} ${y+4}H${x+w-7}" stroke="#ffffff" stroke-width="2" opacity=".75"/>`;
  function meterFace(c,r,d){
    const unit=R.get(c.type).icon,value=Number.isFinite(r?.reading)?Number(r.reading.toPrecision(4)):'—',signed=c.type==='ac-wattmeter',fraction=Number.isFinite(r?.reading)?Math.max(0,Math.min(1,signed?(r.reading/c.params.range+1)/2:r.reading/c.params.range)):null,angle=fraction===null?0:(-150+120*fraction)*Math.PI/180;
    let face=path('M-23-1A26 26 0 0 1 23-1','#94a3b8',1)+text(unit+'~',0,-25,14)+text(signed?-c.params.range:0,-24,26,10)+text(c.params.range,24,26,10);
    for(let n=0;n<=6;n++){const a=(-150+120*n/6)*Math.PI/180;face+=path(`M${Math.cos(a)*23} ${12+Math.sin(a)*23}L${Math.cos(a)*27} ${12+Math.sin(a)*27}`,'#64748b',1);}
    if(d.values&&fraction!==null)face+=path(`M0 12L${Math.cos(angle)*24} ${12+Math.sin(angle)*24}`,'#dc2626',2);
    return face+'<circle cy="12" r="2" fill="#334155"/>'+(d.values?text(value,0,46,12):'');
  }
  function chargeMarks(r,d){return d.fields!==false&&d.values&&Math.abs(r?.voltage)>1e-8?text(r.voltage>0?'+':'−',-23,-31,15)+text(r.voltage>0?'−':'+',23,-31,15):'';}
  function symbol(c,r,d){
    const p=c.params,lead=path('M-60 0H-28 M28 0H60','#334155');
    if(c.type==='capacitor')return path('M-60 0H-9 M9 0H60 M-9-26V26 M9-26V26','#334155')+chargeMarks(r,d);
    if(c.type==='inductor')return path('M-60 0H-34 M34 0H60')+path(coil,'#334155');
    if(c.type==='spdt')return path('M-60 0H-24 M28-24H60 M28 24H60')+path(`M-24 0L25 ${p.closed==='b'?-24:24}`,'#334155',3)+socket(-24,0)+socket(28,-24)+socket(28,24);
    if(c.type==='transformer')return path('M-76-26V-34H-32 M-76 26V34H-32 M76-26V-34H32 M76 26V34H32')+`<g transform="translate(-32 0) rotate(-90)">${path(coil,'#334155')}</g><g transform="translate(32 0) rotate(90)">${path(coil,'#334155')}</g>`+path('M-6-32V32 M6-32V32','#334155',2)+text('•',-43,-34,18)+text('•',43,-34,18);
    if(c.type==='led')return path('M-60 0H-22 M16 0H60')+`<path d="M-22-17L16 0L-22 17Z" fill="${Number.isFinite(r?.current)&&r.current>1e-6?(p.colour==='red'?'#dc5856':'#55a96b'):'none'}" stroke="#334155" stroke-width="2"/>`+path('M16-20V20 M6-23L19-36 M12-35L19-36L18-29 M20-17L33-30 M26-29L33-30L32-23','#334155',2);
    if(R.get(c.type).meter)return (c.type==='ac-wattmeter'?path('M-60-20H-23 M23-20H60 M-60 40H-20V22 M20 22V40H60'):lead)+'<circle r="30" fill="#fff" stroke="#334155" stroke-width="2"/>'+`<g transform="rotate(${-(c.angle||0)})">${text(R.get(c.type).icon+'~',0,6,20)+(d.values?text(Number.isFinite(r?.reading)?Number(r.reading.toPrecision(4)):'—',0,49,12):'')}</g>`;
    return lead+'<circle r="28" fill="#fff" stroke="#334155" stroke-width="2"/>'+path('M-19 0q9-18 19 0t19 0','#334155',2)+(c.type==='generator'?text('G',0,21,11):'');
  }
  function apparatus(c,r,d){
    const p=c.params;
    if(c.type==='ac-source')return path('M-60 0H-43 M43 0H60')+caseBox(-43,-34,86,68,'#d7e5f2')+'<rect x="-32" y="-23" width="45" height="22" rx="3" fill="#203f50"/>'+`<text x="-10" y="-8" text-anchor="middle" font-size="11" fill="#d3f4db">${d.values?Number(p.voltage.toPrecision(3))+' V~':'V~'}</text>`+'<circle cx="24" cy="-12" r="9" fill="#4b647a" stroke="#243c50"/>'+path('M24-18V-12','#f1f5f9',2)+text('AC',-9,16,11)+socket(-28,23)+socket(28,23)+path('M-43 0H-37V23H-28 M28 23H37V0H43','#8093a0',2);
    if(c.type==='generator'){
      const theta=r?.phase??p.phase*Math.PI/180;
      return path('M-60 0H-46V31H-17 M17 31H46V0H60')+caseBox(-46,-40,92,80,'#e6edf1')+'<path d="M-35-29H-22V22H-35Z" fill="#c6766f" stroke="#935149"/><path d="M22-29H35V22H22Z" fill="#789cbc" stroke="#526e8b"/>'+text('N',-28,-13,11)+text('S',28,-13,11)+path('M-18-20H18 M-18 0H18 M-18 20H18','#becdd7',1)+`<g data-generator-angle="${theta}" transform="rotate(${theta*180/Math.PI})"><ellipse rx="15" ry="27" fill="#f7e5c744" stroke="#b47e42" stroke-width="3"/><path d="M0-27V27" stroke="#e1bc82" stroke-width="1"/></g>`+'<circle r="3" fill="#6a7e8a"/>'+path('M0 0H39V-12','#526779',3)+'<circle cx="39" cy="-14" r="4" fill="#344f64"/>'+socket(-17,31)+socket(17,31);
    }
    // A non-polar teaching capacitor; no electrolytic polarity stripe on an AC device.
    if(c.type==='capacitor')return path('M-60 0H-31 M31 0H60','#7a8790',3)+caseBox(-31,-25,62,50,'#c9dbc9')+'<rect x="-24" y="-18" width="28" height="36" rx="2" fill="#f3f6e9" stroke="#8ba383"/>'+Array.from({length:5},(_,n)=>path(`M${-19+n*4}-13V13`,n%2?'#9cb4c5':'#b59560',2)).join('')+text('C',17,5,17)+text('無極性',0,40,10)+chargeMarks(r,d);
    if(c.type==='inductor')return path('M-60 0H-39 M39 0H60')+'<rect x="-38" y="-21" width="76" height="42" rx="3" fill="#718897" stroke="#486374"/><rect x="-31" y="-15" width="62" height="30" fill="#d4c5ac"/>'+Array.from({length:10},(_,n)=>`<ellipse cx="${-27+n*6}" rx="4" ry="18" fill="none" stroke="#a66936" stroke-width="3"/>`+path(`M${-28+n*6}-13V12`,'#e0b06f',1)).join('')+'<rect x="-41" y="-24" width="7" height="48" rx="2" fill="#92a6b3"/><rect x="34" y="-24" width="7" height="48" rx="2" fill="#92a6b3"/>';
    if(c.type==='spdt')return path('M-60 0H-40 M40-24H60 M40 24H60')+caseBox(-43,-35,86,70,'#c8b396')+socket(-29,0)+socket(29,-24)+socket(29,24)+path(`M-29 0L29 ${p.closed==='b'?-24:24}`,'#ba8b40',7)+path(`M-29-2L29 ${p.closed==='b'?-26:22}`,'#f3d39a',2)+`<circle cx="1" cy="${p.closed==='b'?-12:12}" r="7" fill="#334e60" stroke="#203746"/>`+path('M-40 0H-29 M29-24H40 M29 24H40','#9a783e',3);
    if(c.type==='transformer'){
      let core='<rect x="-53" y="-39" width="106" height="78" rx="3" fill="#94a4ae" stroke="#566e7e" stroke-width="2"/><rect x="-19" y="-20" width="38" height="40" rx="2" fill="#fff" stroke="#566e7e"/>';
      for(let n=0;n<5;n++)core+=path(`M-48 ${-34+n*3}H48 M-48 ${22+n*3}H48`,'#c7d0d6',1);
      for(const x of [-37,37])core+=`<rect x="${x-15}" y="-27" width="30" height="54" rx="4" fill="#c49a62" stroke="#8d6135"/>`+Array.from({length:10},(_,n)=>path(`M${x-13} ${-22+n*5}H${x+13}`,'#9d6335',3)+path(`M${x-12} ${-23+n*5}H${x+12}`,'#edc38c',1)).join('');
      return path('M-76-26H-53 M-76 26H-53 M53-26H76 M53 26H76','#8b7762',3)+core+socket(-57,-26)+socket(-57,26)+socket(57,-26)+socket(57,26)+text('•',-66,-30,13)+text('•',66,-30,13)+text('原',-37,49,11)+text('副',37,49,11);
    }
    if(c.type==='led'){
      const on=Number.isFinite(r?.current)&&r.current>1e-6,colour=p.colour==='red'?'#dc5856':'#55a96b';
      return path('M-60 0H-29V24H-9V-6 M9-6V24H29V0H60','#86969f',3)+(on?`<ellipse cy="-17" rx="28" ry="30" fill="${colour}" opacity=".2"/>`:'')+`<path d="M-16-4V-21a16 16 0 0 1 32 0V-4Z" fill="${on?colour:'#b5c1c9'}" stroke="${colour}" stroke-width="2"/><rect x="-20" y="-7" width="40" height="5" rx="2" fill="${colour}" stroke="#667e89"/><path d="M-8-28Q-10-25-10-18" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>`+text('A',-34,38,10)+text('K',34,38,10);
    }
    if(R.get(c.type).meter)return (c.type==='ac-wattmeter'?path('M-60-20H-38 M38-20H60 M-60 40H-38 M38 40H60'):path('M-60 0H-38 M38 0H60'))+caseBox(-38,-41,76,96,'#cbdbe8')+'<rect x="-32" y="-35" width="64" height="67" rx="4" fill="#fffaf0" stroke="#8da1ae"/>'+`<g transform="rotate(${-(c.angle||0)})">${meterFace(c,r,d)}</g>`+(c.type==='ac-wattmeter'?socket(-38,-20)+socket(38,-20)+socket(-38,40)+socket(38,40):socket(-38,0)+socket(38,0));
    return '';
  }
  function render(c,r,d){return `<g data-ac-apparatus="${c.type}" data-ac-view="${d.view==='schematic'?'schematic':'real'}">${d.view==='schematic'?symbol(c,r,d):apparatus(c,r,d)}</g>`;}
  for(const [type,definition]of Object.entries(types))if(!Object.hasOwn(R.definitions,type))R.register(type,{...definition,analysis:'transient',render,dc(){throw new Error('此元件需要時間求解器');}});
  const palette=[{type:'ac-source'},{type:'generator'},{type:'battery'},{type:'resistor'},{type:'rheostat'},{type:'lamp',params:{model:'ideal'}},{type:'switch'},{type:'spdt'},{type:'capacitor'},{type:'inductor'},{type:'transformer'},{type:'led',key:'red-led',params:{colour:'red'},label:'紅色 LED'},{type:'led',key:'green-led',params:{colour:'green'},label:'綠色 LED'},{type:'ac-ammeter'},{type:'ac-voltmeter'},{type:'ac-wattmeter'},{type:'galvanometer'}];
  return {types,palette,supported,toAC,source,wrap,TAU};
});
