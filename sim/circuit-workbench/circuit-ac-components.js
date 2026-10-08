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
    'ac-source':{name:'交流電源',icon:'~',ports,primaryParameter:'frequency',params:{voltage:number('電動勢有效值','V',6,0,120,.5),frequency:number('頻率','Hz',50,.1,1000,1),phase:number('初相位','°',0,-180,180,5),resistance:number('內阻','Ω',0,0,1e6,.1),waveform:choices('波形','sine',['sine','square','triangle'])}},
    generator:{name:'交流發電機',icon:'G~',ports,primaryParameter:'frequency',params:{frequency:number('轉動頻率','Hz',2,.1,1000,.1),phase:number('初始角度','°',0,-180,180,5),turns:number('線圈匝數','',200,1,2000,10),field:number('磁感應強度','T',.2,0,2,.01),area:number('線圈面積','m²',.02,.0001,.1,.001),resistance:number('內阻','Ω',1,0,1e6,.1)}},
    capacitor:{name:'電容器',icon:'C',ports,primaryParameter:'capacitance',params:{capacitance:number('電容','μF',.001,1e-6,.01,.0001,1e6),initialVoltage:signed('初始電壓','V'),rating:number('耐壓值','V',25,.1,1e6,1)}},
    inductor:{name:'電感線圈',icon:'L',ports,primaryParameter:'inductance',params:{inductance:number('自感系數','H',1,.001,100,.1),resistance:resistance(),initialCurrent:signed('初始電流','A')}},
    spdt:{name:'單刀雙擲開關',icon:'S',ports:[{key:'a',x:-60,y:0,label:'共用'},{key:'b',x:60,y:-24,label:'充電側'},{key:'c',x:60,y:24,label:'放電側'}],params:{closed:choices('接通側','b',['b','c'])}},
    transformer:{name:'變壓器／互感線圈',icon:'T',ports:[{key:'a',x:-76,y:-26,label:'原線圈同名端'},{key:'b',x:-76,y:26,label:'原線圈'},{key:'c',x:76,y:-26,label:'副線圈同名端'},{key:'d',x:76,y:26,label:'副線圈'}],bounds:{left:-80,right:80,top:-48,bottom:58},primaryParameter:'secondaryTurns',params:{model:choices('模型','ideal',['ideal','coupled']),primaryTurns:number('原線圈匝數','',200,1,2000,10),secondaryTurns:number('副線圈匝數','',100,1,2000,10),inductance:number('原線圈電感','H',2,.001,100,.1),coupling:number('耦合係數','',.999,0,.9999,.001),primaryResistance:number('原線圈電阻','Ω',1,0,1e6,.1),secondaryResistance:number('副線圈電阻','Ω',.25,0,1e6,.1),initialPrimaryCurrent:signed('原線圈初始電流','A'),initialSecondaryCurrent:signed('副線圈初始電流','A')}},
    led:{name:'發光二極管',icon:'LED',ports,params:{forwardVoltage:number('正向壓降','V',1.8,.1,10,.1),resistance:number('導通電阻','Ω',10,.01,1e6,1),colour:choices('顏色','red',['red','green'])}},
    'ac-ammeter':{name:'交流電流表',icon:'A',meter:true,ports,params:{range:number('量程','A',3,.001,1e6,.5),resistance:number('內阻','Ω',0,0,1e6,.1)}},
    'ac-voltmeter':{name:'交流電壓表',icon:'V',meter:true,ports,params:{range:number('量程','V',15,.001,1e6,1),resistance:number('輸入電阻（0 為理想）','Ω',0,0,1e12,1000)}},
    'ac-wattmeter':{name:'交流功率表',icon:'W',meter:true,ports:[{key:'a',x:-60,y:-20,label:'I+'},{key:'b',x:60,y:-20,label:'I−'},{key:'c',x:-60,y:40,label:'V+'},{key:'d',x:60,y:40,label:'V−'}],params:{range:number('量程','W',20,.001,1e6,1),resistance:number('電流線圈內阻','Ω',0,0,1e6,.1),inputResistance:number('電壓線圈內阻（0 為理想）','Ω',0,0,1e12,1000)}}
  };
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
  const coil='M-34 0q0-16 10-16t10 16q0-16 10-16t10 16q0-16 10-16t10 16';
  function render(c,r,d){
    const p=c.params,schematic=d.view==='schematic',lead=path('M-60 0H-34 M34 0H60');
    if(c.type==='capacitor')return path('M-60 0H-9 M9 0H60')+path('M-9-26V26 M9-26V26',schematic?'#334155':'#7a9ba8',5)+(schematic?'':`<rect x="-4" y="-25" width="8" height="50" fill="#ddeefa"/>`)+text(r?.voltage>1e-8?'+':r?.voltage< -1e-8?'−':'',-23,-30,16)+text(r?.voltage>1e-8?'−':r?.voltage< -1e-8?'+':'',23,-30,16);
    if(c.type==='inductor')return lead+path(coil,schematic?'#334155':'#a57545',schematic?3:5);
    if(c.type==='spdt')return path('M-60 0H-24 M28-24H60 M28 24H60')+path(`M-24 0L25 ${p.closed==='b'?-24:24}`,'#334155',4)+'<circle cx="28" cy="-24" r="4" fill="#b88b4f"/><circle cx="28" cy="24" r="4" fill="#b88b4f"/>';
    if(c.type==='transformer')return path('M-76-26H-42V-20 M-76 26H-42V20 M76-26H42V-20 M76 26H42V20')+`<g transform="translate(-32 34) rotate(-90)">${path(coil,'#a57545',4)}</g><g transform="translate(32-34) rotate(90)">${path(coil,'#a57545',4)}</g>`+path('M-6-32V32 M6-32V32','#8296a3',4)+text('•',-43,-26,18)+text('•',43,-26,18)+text(p.model==='ideal'?'理想':'線性線圈',0,53,12);
    if(c.type==='led')return lead+`<path d="M-22-17L16 0L-22 17Z" fill="${Number.isFinite(r?.current)&&r.current>1e-6?(p.colour==='red'?'#ef4444':'#22c55e'):'#fff'}" stroke="#475569" stroke-width="2"/>`+path('M16-20V20 M6-23L19-36 M12-35L19-36L18-29 M20-17L33-30 M26-29L33-30L32-23','#64748b',2);
    if(R.get(c.type).meter){const unit=R.get(c.type).icon,value=Number.isFinite(r?.reading)?Number(r.reading.toPrecision(4)):'—';return (c.type==='ac-wattmeter'?path('M-60-20H-34 M34-20H60 M-60 40H-20V26 M20 26V40H60'):lead)+`<rect x="-35" y="-33" width="70" height="65" rx="9" fill="${schematic?'#fff':'#eef4fa'}" stroke="#446482" stroke-width="2"/>`+text(unit+'~',0,-10,17)+(d.values?text(value,0,14,13):'');}
    const theta=r?.phase??p.phase*Math.PI/180;
    let result=lead+'<circle r="32" fill="#eef4fa" stroke="#446482" stroke-width="2"/>'+path('M-23 0q11-22 23 0t23 0','#397cab',2);
    if(c.type==='generator')result+=`<g data-generator-angle="${theta}" transform="rotate(${theta*180/Math.PI})"><ellipse rx="24" ry="9" fill="none" stroke="#c28748" stroke-width="3"/></g>`;
    return result;
  }
  for(const [type,definition]of Object.entries(types))if(!Object.hasOwn(R.definitions,type))R.register(type,{...definition,analysis:'transient',render,dc(){throw new Error('此元件需要時間求解器');}});
  const palette=[{type:'ac-source'},{type:'generator'},{type:'battery'},{type:'resistor'},{type:'rheostat'},{type:'lamp',params:{model:'ideal'}},{type:'switch'},{type:'spdt'},{type:'capacitor'},{type:'inductor'},{type:'transformer'},{type:'led',key:'red-led',params:{colour:'red'},label:'紅色 LED'},{type:'led',key:'green-led',params:{colour:'green'},label:'綠色 LED'},{type:'ac-ammeter'},{type:'ac-voltmeter'},{type:'ac-wattmeter'},{type:'galvanometer'}];
  return {types,palette,supported,toAC,source,wrap,TAU};
});
