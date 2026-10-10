(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-meter-motion'):root.CircuitMeterMotion,node?require('./circuit-generator-graphics'):root.CircuitGeneratorGraphics,node?require('./circuit-field-graphics'):root.CircuitFieldGraphics,node?require('./circuit-ac-display'):root.CircuitACDisplay,node?require('./circuit-math'):root.CircuitMath);
  if(node)module.exports=api;else root.CircuitAC=api;
})(globalThis,function(R,M,N,Generator,Fields,Display,Q){
  'use strict';
  const TAU=2*Math.PI,ports=[{key:'a',x:-60,y:0,label:'a'},{key:'b',x:60,y:0,label:'b'}];
  const meterPorts=ports.map(p=>({...p,label:'接線端',labelVisible:false}));
  const number=(label,unit,value,min,max,step,factor=1)=>({label,unit,value,min,max,step,factor});
  const choices=(label,value,values)=>({label,value,choices:values});
  const resistance=()=>number('線圈電阻','Ω',1,0,1e6,.1);
  const signed=(label,unit)=>number(label,unit,0,-1e6,1e6,.1);
  const types={
    'ac-source':{bounds:{left:-45,right:45,top:-36,bottom:36},name:'交流電源',icon:'~',ports,primaryParameter:'frequency',params:{voltage:number('電動勢有效值','V',6,0,1000,.5),frequency:number('頻率','Hz',1,.1,1000,.1),phase:number('初相位','°',0,-180,180,5),resistance:number('內阻','Ω',0,0,1e6,.1),waveform:choices('波形','sine',['sine','square','triangle'])}},
    generator:{bounds:{left:-48,right:48,top:-42,bottom:42},name:'交流發電機',icon:'G~',ports,primaryParameter:'frequency',params:{frequency:number('轉動頻率','Hz',2,.1,1000,.1),phase:number('初始角度','°',0,-180,180,5),turns:number('線圈匝數','',200,1,2000,10),field:number('磁感應強度','T',.2,0,2,.01),area:number('線圈面積','m²',.02,.0001,.1,.001),resistance:number('內阻','Ω',1,0,1e6,.1)}},
    capacitor:{bounds:{left:-45,right:45,top:-41,bottom:40},name:'電容器',icon:'C',ports,primaryParameter:'capacitance',params:{capacitance:number('電容','F',.02,1e-6,.2,.001),initialVoltage:signed('初始電壓','V'),rating:number('耐壓值','V',25,.1,1e6,1)}},
    inductor:{bounds:{left:-47,right:47,top:-27,bottom:27},name:'電感線圈',icon:'L',ports,primaryParameter:'inductance',params:{inductance:number('自感系數','H',1,.001,100,.1),resistance:resistance(),initialCurrent:signed('初始電流','A')}},
    spdt:{bounds:{left:-45,right:45,top:-37,bottom:37},name:'單刀雙擲開關',icon:'S',ports:[{key:'a',x:-60,y:0,label:'共用'},{key:'b',x:60,y:-24,label:'充電側'},{key:'c',x:60,y:24,label:'放電側'}],params:{closed:choices('接通側','b',['b','c'])}},
    transformer:{name:'變壓器',icon:'T',ports:[{key:'a',x:-76,y:-26,label:'原線圈同名端'},{key:'b',x:-76,y:26,label:'原線圈'},{key:'c',x:76,y:-26,label:'副線圈同名端'},{key:'d',x:76,y:26,label:'副線圈'}],bounds:{left:-80,right:80,top:-48,bottom:42},primaryParameter:'secondaryTurns',params:{model:choices('模型','ideal',['ideal','coupled']),primaryTurns:number('原線圈匝數','',200,1,2000,10),secondaryTurns:number('副線圈匝數','',100,1,2000,10),inductance:number('原線圈電感','H',2,.001,100,.1),coupling:number('耦合係數','',.999,0,.9999,.001),primaryResistance:number('原線圈電阻','Ω',1,0,1e6,.1),secondaryResistance:number('副線圈電阻','Ω',.25,0,1e6,.1),initialPrimaryCurrent:signed('原線圈初始電流','A'),initialSecondaryCurrent:signed('副線圈初始電流','A')}},
    led:{bounds:{left:-31,right:31,top:-47,bottom:41},name:'發光二極管',icon:'LED',ports,params:{forwardVoltage:number('正向壓降','V',1.8,.1,10,.1),resistance:number('導通電阻','Ω',10,.01,1e6,1),colour:choices('顏色','red',['red','green'])}},
    'ac-ammeter':{bounds:{left:-49,right:49,top:-46,bottom:36},name:'交流電流表',icon:'A',meter:true,ports:meterPorts,params:{range:number('量程','A',3,.001,1e6,.5),resistance:number('內阻','Ω',0,0,1e6,.1)}},
    'ac-voltmeter':{bounds:{left:-49,right:49,top:-46,bottom:36},name:'交流電壓表',icon:'V',meter:true,ports:meterPorts,params:{range:number('量程','V',15,.001,1e6,1),resistance:number('輸入電阻（0 為理想）','Ω',0,0,1e12,1000)}},
    'ac-wattmeter':{bounds:{left:-49,right:49,top:-46,bottom:36},name:'交流功率表',icon:'W',meter:true,ports:[{key:'a',x:-60,y:-20,label:'電流輸入端'},{key:'b',x:60,y:-20,label:'電流輸出端'},{key:'c',x:-60,y:40,label:'電壓正端'},{key:'d',x:60,y:40,label:'電壓負端'}],params:{range:number('量程','W',20,.001,1e6,1),resistance:number('電流線圈內阻','Ω',0,0,1e6,.1),inputResistance:number('電壓線圈內阻（0 為理想）','Ω',0,0,1e12,1000)}}
  };
  for(const type of ['ac-source','generator'])Object.assign(types[type].params.frequency,{controlMax:2,controlSpecial:50});
  for(const key of ['primaryTurns','secondaryTurns'])Object.assign(types.transformer.params[key],{slider:true,controlStep:1});
  types['ac-source'].params.waveform.labels={sine:'正弦波',square:'方波',triangle:'三角波'};types.transformer.params.model.labels={ideal:'理想交流',coupled:'線性線圈'};types.spdt.params.closed.labels={b:'充電側',c:'放電側'};types.led.params.colour.labels={red:'紅色',green:'綠色'};
  types.capacitor.params.capacitance.sliderMin=.01;types.inductor.params.inductance.sliderMin=.5;
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
  const socket=(x,y)=>`<circle cx="${x}" cy="${y}" r="5" fill="#b7c6cf" stroke="#526779"/><circle cx="${x}" cy="${y}" r="2" fill="#3c4d5b"/>`;
  const caseBox=(x,y,w,h,fill='#d9e6ef')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="#567185" stroke-width="2"/><path d="M${x+7} ${y+4}H${x+w-7}" stroke="#ffffff" stroke-width="2" opacity=".75"/>`;
  // Visible turns are schematic: fixed magnetic geometry gives L proportional to N squared.
  const inductorTurns=c=>Math.max(1,Math.round(10*Math.sqrt(c.params.inductance)));
  const transformerTurns=n=>Math.max(1,Math.round(n/10));
  function coil(count){let d='M-34 0';const half=34/count;for(let n=0;n<count;n++)d+=`q0-16 ${half}-16t${half} 16`;return path(d,'#334155',Math.min(3,45/count));}
  function winding(count,span=68,radius=24,full=false){
    const pitch=Math.min(3.5,span/count),start=1.75-(count-1)*pitch/2,end=full?start+count*pitch:start+(count-.5)*pitch+6,entry=start-pitch/2,width=Math.min(2.1,pitch*.65),outline=width+Math.min(.65,pitch*.25);let front='',back=full?'':`M${entry} ${radius}C${entry-5} ${radius} ${start-5} ${-radius} ${start} ${-radius}`;
    for(let n=0;n<count;n++){const x=start+n*pitch;front+=n===count-1&&!full?`M${x} ${-radius}C${x+5} ${-radius} ${end-1} 0 ${end} 0`:`M${x} ${-radius}C${x+5} ${-radius} ${x+5+pitch/2} ${radius} ${x+pitch/2} ${radius}`;if(n<count-1||full)back+=`M${x+pitch/2} ${radius}C${x-5+pitch/2} ${radius} ${x-5+pitch} ${-radius} ${x+pitch} ${-radius}`;}
    return {pitch,start,end,entry,width,outline,front,back};
  }
  const copper=(d,w)=>path(d,'#8d6135',w.outline)+path(d,'#d8b17e',w.width);
  function transformerCaption(c,values=true){const angle=(c.angle||0)*Math.PI/180,edge=Math.abs(Math.sin(angle))*61+Math.abs(Math.cos(angle))*45;
    return `<g data-transformer-ratio="true" transform="rotate(${-(c.angle||0)})">${text(values?'匝數比（原：副）':'原／副線圈',0,-edge-24,8.5)}${values?Q.svg(0,-edge-10,Q.turnsRatio(c.params.primaryTurns,c.params.secondaryTurns),13):''}</g>`;
  }
  types.transformer.annotationBounds=c=>{const angle=(c.angle||0)*Math.PI/180,edge=Math.abs(Math.sin(angle))*61+Math.abs(Math.cos(angle))*45,width=Math.max(80,Q.measure(Q.turnsRatio(c.params.primaryTurns,c.params.secondaryTurns).tex,13).width)+6;return {left:c.x-width/2,right:c.x+width/2,top:c.y-edge-34,bottom:c.y-edge-8};};
  const transformerFieldSlot=(c,r,d,schematic=false)=>'<g data-transformer-field-slot="'+(schematic?'schematic':'real')+'">'+(d.fields===false?'':Fields.transformer(c,r,schematic))+'</g>';
  function transformerCore(){
    let core='<g data-transformer-core="true"><path data-core-depth="top" d="M-53-39L-47-45H59L53-39Z" fill="#bcc9d2" stroke="#617685" stroke-width=".8"/><path data-core-depth="side" d="M53-39L59-45V33L53 39Z" fill="#586d7c" stroke="#475d6d" stroke-width=".8"/>';
    for(let n=1;n<=3;n++){const z=n*1.5;core+=path(`M${-53+z} ${-39-z}H${53+z}V${39-z}`,'#758a99',.5);}
    core+='<path data-core-face="true" d="M-49-39H49Q53-39 53-35V35Q53 39 49 39H-49Q-53 39-53 35V-35Q-53-39-49-39Z M-19-20V20H19V-20Z" fill-rule="evenodd" fill="#899ca9" stroke="#526c7d" stroke-width="1.5"/><path data-core-window="true" d="M-19-20H-13V14L-19 20Z" fill="#596f7e"/><path d="M-19 20L-13 14H19V20Z" fill="#6b8190"/><path d="M-49-37H49 M-51-34V34 M-17-18H17V18" fill="none" stroke="#d9e2e8" stroke-width=".85" opacity=".65"/><path d="M-49 37H49 M51-34V34 M-19-20V20H19" fill="none" stroke="#627988" stroke-width=".7"/></g>';
    return core;
  }
  const capacitorGap=c=>8+48/(1+c.params.capacitance/.025);
  function plate(c,r,d,left){
    const known=Number.isFinite(r?.voltage),enabled=known,voltage=r?.fieldVoltage??r?.voltage,sign=enabled&&Math.abs(voltage)>1e-8?(voltage>0?1:-1)*(left?1:-1):0,gap=capacitorGap(c),x=left?-gap/2:gap/2,colour=sign>0?'#c43f4c':sign<0?'#286cb7':'#748895',fill=sign>0?'#f7dddf':sign<0?'#dceafa':'#e3eaee',charge=known?Math.abs(c.params.capacitance*r.voltage):0,raw=charge/.0025;
    // ponytail: compress very dense charge pictures, with at most 4096 groups per plate; q itself is never clipped.
    const wanted=raw<=192?raw:192+64*Math.log2(1+(raw-192)/64),rows=sign!==0?Math.min(1024,Math.ceil(wanted/4)):0,count=rows*4;
    // Equal-area radial samples remain uniform after projecting the circular plate.
    let marks='';for(let n=0;n<count;n++){const radius=22*Math.sqrt((n+.5)/count),angle=n*Math.PI*(3-Math.sqrt(5)),u=radius*Math.cos(angle),v=radius*Math.sin(angle),px=x+.48*u,py=v;marks+=`M${px-1.7} ${py}h3.4`;if(sign>0)marks+=`M${px} ${py-1.7}v3.4`;}
    return `<g data-capacitor-plate="${left?'a':'b'}" data-charge-count="${count}" data-charge-sign="${sign}" data-charge-colour="${colour}" data-charge-known="${known}" role="img" aria-label="${!known?'電荷未能確定':!enabled?'電荷示意已關閉':sign>0?'正圓極板，電荷量示意':sign<0?'負圓極板，電荷量示意':'近零電荷圓極板'}"><circle data-capacitor-disc="back" r="28" transform="matrix(.48 0 0 1 ${x-1.5} 0)" fill="#afbec7" stroke="${colour}" stroke-width="1.2"/><circle data-capacitor-disc="front" r="28" transform="matrix(.48 0 0 1 ${x} 0)" fill="${fill}" stroke="${colour}" stroke-width="1.2"/>${marks?path(marks,colour,.9):''}</g>`;
  }
  function meterFace(c,r,d){
    const signed=c.type==='ac-wattmeter',unit=R.get(c.type).icon,fraction=N.target(c,r)??(!r?0:null),minimum=signed?-1:0,a=N.point(c,minimum,37),b=N.point(c,1,37);
    let face=path(`M${a.x} ${a.y}A37 37 0 0 1 ${b.x} ${b.y}`,'#94a3b8',.8)+Q.svg(0,-30,{text:unit+'~',tex:Q.unit(unit).tex+'\\sim'},14);
    for(let n=signed?-30:0;n<=30;n++){const f=n/30,major=n%(signed?15:10)===0,p=N.point(c,f,37),q=N.point(c,f,major?31:34.5);face+=`<path data-meter-tick="${n}" data-fraction="${f}" d="M${p.x} ${p.y}L${q.x} ${q.y}" stroke="${n<0?'#9b6258':'#607487'}" stroke-width="${major?1.2:.7}"/>`;if(major){const label=N.point(c,f,24),value=Number((f*c.params.range).toPrecision(3)),size=Math.min(8.5,29/(String(value).length+1));face+=Q.svg(label.x,label.y+2.5,Q.quantity(value),size);}}
    if((!c.id||d.values)&&fraction!==null){const p=N.point(c,fraction);face+=`<path data-meter-needle="${c.id||'preview'}" data-reading="${Number.isFinite(r?.reading)?r.reading:''}" data-range="${c.params.range}" data-fraction="${fraction}" data-target-fraction="${fraction}" data-angle="${p.angle}" d="M0 ${p.cy}L${p.x} ${p.y}" fill="none" stroke="#c33b35" stroke-width="1.8" stroke-linecap="round"/>`;}
    return `<g data-meter-dial="${c.id||'preview'}" data-divisions="30" data-negative-divisions="${signed?30:0}">${face}<circle cy="16" r="3" fill="#475569"/></g>`;
  }

  function chargeMarks(r,d){return d.values&&Math.abs(r?.fieldVoltage??r?.voltage)>1e-8?text(r.voltage>0?'+':'−',-23,-31,15)+text(r.voltage>0?'−':'+',23,-31,15):'';}
  function symbol(c,r,d){
    const p=c.params,lead=path('M-60 0H-28 M28 0H60','#334155');
    if(c.type==='capacitor')return path('M-60 0H-9 M9 0H60 M-9-26V26 M9-26V26','#334155')+chargeMarks(r,d);
    if(c.type==='inductor')return `<g data-inductor-turns="${inductorTurns(c)}">${path('M-60 0H-34 M34 0H60')}${coil(inductorTurns(c))}${Fields.inductorPoles(c,r)}</g>`;
    if(c.type==='spdt')return path('M-60 0H-24 M28-24H60 M28 24H60')+path(`M-24 0L25 ${p.closed==='b'?-24:24}`,'#334155',3)+socket(-24,0)+socket(28,-24)+socket(28,24);
    if(c.type==='transformer')return path('M-76-26V-34H-32 M-76 26V34H-32 M76-26V-34H32 M76 26V34H32')+`<g data-transformer-winding="primary" data-nominal-turns="${p.primaryTurns}" data-visible-turns="${transformerTurns(p.primaryTurns)}" transform="translate(-32 0) rotate(-90)">${coil(transformerTurns(p.primaryTurns))}</g><g data-transformer-winding="secondary" data-nominal-turns="${p.secondaryTurns}" data-visible-turns="${transformerTurns(p.secondaryTurns)}" transform="translate(32 0) rotate(90)">${coil(transformerTurns(p.secondaryTurns))}</g>`+path('M-6-32V32 M6-32V32','#334155',2)+text('•',-43,-34,18)+text('•',43,-34,18)+transformerFieldSlot(c,r,d,true)+transformerCaption(c,d.values);
    if(c.type==='led')return path('M-60 0H-22 M16 0H60')+`<path d="M-22-17L16 0L-22 17Z" fill="${Number.isFinite(r?.current)&&r.current>1e-6?(p.colour==='red'?'#dc5856':'#55a96b'):'none'}" stroke="#334155" stroke-width="2"/>`+path('M16-20V20 M6-23L19-36 M12-35L19-36L18-29 M20-17L33-30 M26-29L33-30L32-23','#334155',2);
    if(R.get(c.type).meter)return (c.type==='ac-wattmeter'?path('M-60-20H-23 M23-20H60 M-60 40H-20V22 M20 22V40H60'):lead)+'<circle r="30" fill="#fff" stroke="#334155" stroke-width="2"/>'+`<g transform="rotate(${-(c.angle||0)})">${Q.svg(0,6,{text:R.get(c.type).icon+'~',tex:Q.unit(R.get(c.type).icon).tex+'\\sim'},22)}</g>`;
    return lead+'<circle r="28" fill="#fff" stroke="#334155" stroke-width="2"/>'+path('M-19 0q9-18 19 0t19 0','#334155',2)+(c.type==='generator'?text('G',0,21,11):'');
  }
  function apparatus(c,r,d){
    const p=c.params;
    if(c.type==='ac-source')return path('M-60 0H-43 M43 0H60')+caseBox(-43,-34,86,68,'#d7e5f2')+'<rect x="-32" y="-23" width="45" height="22" rx="3" fill="#203f50"/>'+`<text x="-10" y="-8" text-anchor="middle" font-size="11" fill="#d3f4db">${d.values?Number(p.voltage.toPrecision(3))+' V~':'V~'}</text>`+'<circle cx="24" cy="-12" r="9" fill="#4b647a" stroke="#243c50"/>'+path('M24-18V-12','#f1f5f9',2)+text('AC',-9,16,11)+socket(-28,23)+socket(28,23)+path('M-43 0H-37V23H-28 M28 23H37V0H43','#8093a0',2);
    if(c.type==='generator'){
      return caseBox(-46,-40,92,80,'#e6edf1')+path(Generator.leads,'#667b8e',1.5)+Generator.render(c,r,d.fields!==false);
    }
    if(c.type==='capacitor'){const gap=capacitorGap(c),left=-gap/2-1.5-28*.48,right=gap/2,f=d.fields===false?{back:'',front:''}:Fields.capacitor(r,gap);return `<g data-capacitor-voltage="${Number.isFinite(r?.voltage)?r.voltage:''}" data-plate-gap="${gap}">${f.back}${plate(c,r,d,true)}${plate(c,r,d,false)}${f.front}${Fields.capacitorPoles(r,gap)}<path data-capacitor-leads="true" d="M-60 0H${left} M60 0H${right}" fill="none" stroke="#7a8790" stroke-width="3" stroke-linecap="round"/></g>`;}
    if(c.type==='inductor'){
      const count=inductorTurns(c),w=winding(count),{pitch,start,end,entry}=w;
      const leads=`M-60 0H${start-12}C${start-2} 0 ${entry+5} 24 ${entry} 24 M${end} 0H60`,wire=d=>copper(d,w),f=d.fields===false?{back:'',front:'',markers:Fields.inductorPoles(c,r)}:Fields.inductor(c,r);
      return `<g data-inductor-turns="${count}" data-winding-span="${count*pitch}" data-winding-entry="${start}" data-winding-exit="${end}">${f.back}<g data-inductor-back="true">${wire(w.back)}</g><path data-inductor-former="true" d="M-40-24H40C47-24 47 24 40 24H-40Z" fill="#e3edf2" stroke="#567185" stroke-width="1.7"/><path d="M-35-20H38" fill="none" stroke="#fff" stroke-width="1.5" opacity=".8"/><ellipse data-inductor-end-face="true" cx="-40" rx="5.5" ry="24" fill="#bdcfd9" stroke="#567185" stroke-width="1.7"/><ellipse cx="-40" rx="2.8" ry="18" fill="#dbe7ed" stroke="#8ca5b5" stroke-width=".8"/><g data-inductor-front="true">${wire(w.front)}</g><g data-inductor-leads="true">${wire(leads)}</g>${f.front}${f.markers}</g>`;
    }
    if(c.type==='spdt')return path('M-60 0H-40 M40-24H60 M40 24H60')+caseBox(-43,-35,86,70,'#c8b396')+socket(-29,0)+socket(29,-24)+socket(29,24)+path(`M-29 0L29 ${p.closed==='b'?-24:24}`,'#ba8b40',7)+path(`M-29-2L29 ${p.closed==='b'?-26:22}`,'#f3d39a',2)+`<circle cx="1" cy="${p.closed==='b'?-12:12}" r="7" fill="#334e60" stroke="#203746"/>`+path('M-40 0H-29 M29-24H40 M29 24H40','#9a783e',3);
    if(c.type==='transformer'){
      const coils=[[-37,p.primaryTurns,'primary'],[37,p.secondaryTurns,'secondary']].map(([x,nominal,side])=>({x,nominal,side,count:transformerTurns(nominal),w:winding(transformerTurns(nominal),44,21,true)}));
      let core=coils.map(({x,w})=>`<g data-transformer-back="true" transform="translate(${x} 0) rotate(90) scale(1 ${Math.sign(x)})">${copper(w.back,w)}</g>`).join('')+transformerCore()+transformerFieldSlot(c,r,d);
      for(const {x,nominal,side,count,w}of coils){const direction=Math.sign(x),terminal=direction*76,entryX=x+direction*21;
        const leads=`M${terminal}-26H${entryX+direction*8}C${entryX+direction*2}-26 ${entryX} ${w.start-4} ${entryX} ${w.start} M${entryX} ${w.end}C${entryX} ${w.end+4} ${entryX+direction*2} 26 ${entryX+direction*8} 26H${terminal}`;
        core+=`<g data-transformer-winding="${side}" data-nominal-turns="${nominal}" data-visible-turns="${count}"><g data-transformer-front="true" transform="translate(${x} 0) rotate(90) scale(1 ${direction})">${copper(w.front,w)}</g><g data-transformer-leads="true">${copper(leads,w)}</g></g>`;
      }
      return core+text('•',-66,-30,13)+text('•',66,-30,13)+transformerCaption(c,d.values);
    }
    if(c.type==='led'){
      const on=Number.isFinite(r?.current)&&r.current>1e-6,colour=p.colour==='red'?'#dc5856':'#55a96b';
      return path('M-60 0H-29V24H-9V-6 M9-6V24H29V0H60','#86969f',3)+(on?`<ellipse cy="-17" rx="28" ry="30" fill="${colour}" opacity=".2"/>`:'')+`<path d="M-16-4V-21a16 16 0 0 1 32 0V-4Z" fill="${on?colour:'#b5c1c9'}" stroke="${colour}" stroke-width="2"/><rect x="-20" y="-7" width="40" height="5" rx="2" fill="${colour}" stroke="#667e89"/><path d="M-8-28Q-10-25-10-18" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>`+text('A',-34,38,10)+text('K',34,38,10);
    }
    if(R.get(c.type).meter)return (c.type==='ac-wattmeter'?path('M-60-20H-46 M46-20H60 M-60 40H-34V29 M34 29V40H60'):path('M-60 0H-46 M46 0H60'))+'<rect data-meter-case="true" x="-46" y="-43" width="92" height="78" rx="10" fill="#e8f0f6" stroke="#446482" stroke-width="2"/><rect x="-41" y="-38" width="82" height="67" rx="6" fill="#fff" stroke="#b2c2cf"/>'+`<g data-meter-face="${c.id}" transform="rotate(${-(c.angle||0)})">${meterFace(c,r,d)}</g>`;
    return '';
  }
  function render(c,r,d){return `<g data-ac-apparatus="${c.type}" data-ac-view="${d.view==='schematic'?'schematic':'real'}">${d.view==='schematic'?symbol(c,r,d):apparatus(c,r,d)}</g>`;}
  for(const type of ['capacitor','inductor'])types[type].displayResult=Display.visual;
  types.transformer.displayResult=Display.transformerVisual;
  for(const [type,definition]of Object.entries(types))if(!Object.hasOwn(R.definitions,type))R.register(type,{...definition,analysis:'transient',render,dc(){throw new Error('此元件需要時間求解器');}});
  const palette=[{type:'ac-source'},{type:'generator'},{type:'battery'},{type:'resistor'},{type:'rheostat'},{type:'lamp',params:{model:'ideal'}},{type:'switch'},{type:'spdt'},{type:'capacitor'},{type:'inductor'},{type:'transformer'},{type:'led',key:'red-led',params:{colour:'red'},label:'紅色 LED'},{type:'led',key:'green-led',params:{colour:'green'},label:'綠色 LED'},{type:'ac-ammeter'},{type:'ac-voltmeter'},{type:'ac-wattmeter'},{type:'galvanometer'}];
  return {types,palette,supported,toAC,source,wrap,TAU,capacitorGap,meterFace};
});
