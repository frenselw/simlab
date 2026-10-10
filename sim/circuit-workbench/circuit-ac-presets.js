(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-routing'):root.CircuitRouting,node?require('./circuit-ac-components'):root.CircuitAC,node?require('./circuit-math'):root.CircuitMath);if(node)module.exports=api;else root.CircuitACPresets=api;})(globalThis,function(M,G,AC,Q){
  'use strict';
  const names={resistive:'交流電阻：電壓、電流與有效值',mains:'50 Hz交流：燈泡亮度',generator:'交流發電機：轉動與感應電動勢',led:'交流方向：反向並聯LED',capacitive:'交流電容：頻率與電流',inductive:'交流電感：頻率與電流',rc:'電容充放電：電流與儲能',rl:'通電自感：電流建立',self:'斷電自感：線圈放電',transformer:'理想變壓器：匝數與電壓',coupled:'非理想變壓器：耦合與線圈電阻',mutual:'互感：通斷電與感應電流',lc:'LC振盪：電場與磁場儲能',damped:'阻尼振盪：電阻與能量耗散',empty:'空白電路'};
  const groups=[{label:'交流基礎',keys:['resistive','mains','generator','led']},{label:'電容與電感',keys:['capacitive','inductive','rc','rl','self']},{label:'變壓器與互感',keys:['transformer','coupled','mutual']},{label:'振盪電路',keys:['lc','damped']}];
  const descriptions={resistive:'調整頻率及有效值。電阻的電壓與電流同相；有效值用一個週期的實際波形積分。',square:'方波有效值等於峰值；不要套用正弦波的 √2 關係。',triangle:'三角波有效值等於峰值除以 √3。',generator:'觀察 θ、Φ=BS cosθ 及 e=NBSω sinθ。改轉速會同時改頻率及振幅；外界維持轉速。',led:'紅、綠 LED 反向並聯，每半週由不同 LED 導通。',capacitive:'在相同電動勢有效值下，增加 C 或 f 通常令容抗降低。電流是外部充放電流，電子不穿過介質。',inductive:'增加 L 或 f 會增加感抗；線圈電阻另外計入。可改用直流電源作比較。切換至放電側後，線圈經負載燈衰減。',rc:'切至充電側約6秒：燈先亮後暗，電容逐漸充電。再切至放電側：電源退出回路，電容使燈再次亮起並逐漸熄滅；0.1 F與20 Ω燈的時間常數約2秒。',rl:'直流電源、5 H線圈及3 Ω燈；切至供電側觀察約1.6秒的時間常數，再切至放電側。',self:'合上開關約8秒，再斷開：10 H線圈經3 Ω、3 V燈放電，燈的電流反向，亮度逐漸衰減。放電時間常數約2.5秒；儲能多少取決於斷開前線圈電流。',transformer:'理想交流模型：U₁/U₂=N₁/N₂，兩側電氣隔離。改匝數或負載，觀察有效值與功率。直流請用線性線圈模型。',coupled:'線性線圈包括線阻及不完全耦合，不含磁芯飽和、磁滯及鐵損；實際電壓比不必完全等於匝數比。',mutual:'合上開關、播放至穩定，再斷開。原線圈的可見放電電阻提供通路；副線圈的感應方向在通斷時相反。',lc:'電容與電感始終串聯成通路；先經電阻充電約2秒，再切至振盪側，可隨時切回充電。5 H與0.02 F的週期約2秒，可直接看能量交換。觀察反向充電及電場／磁場能交換。',damped:'與理想 LC 比較：線圈有8 Ω電阻，儲能逐漸轉為內能；不模擬輻射損失。',empty:'從工具箱取物。滑鼠／觸控筆可拖放；手指點選。接孔及線端互相靠近便吸附。'};
  const rate=()=>1;
  function create(name){if(!Object.hasOwn(names,name)&&!['square','triangle'].includes(name))throw new Error('未知交流預設');const d=M.empty('transient');d.cables.count=40;
    const add=(type,x,y,label,params={},angle=0)=>{const c=M.add(d,type,x,y,params);c.label=label;c.angle=angle;return c;};
    const link=(a,ap,b,bp,via=[])=>{const pa=a.id+':'+ap,pb=b.id+':'+bp,end=M.endpoints(d),points=G.rounded([end.get(pa),...via,end.get(pb)]),w=M.connect(d,pa,pb,points.slice(1,-1),'free');w.length=Math.max(600,Math.ceil(G.length(points))+100);return w;};
    const joint=(x,y)=>{const j={id:M.nextId(d,'j'),x,y};d.junctions.push(j);return j;};
    if(name==='empty')return d;
    const dc=['rc','rl','self','mutual','lc','damped'].includes(name),source=add(name==='generator'?'generator':dc?'battery':'ac-source',180,260,name==='generator'?'交流發電機':dc?'直流電源':'交流電源',{},90);
    if(name==='mains')source.params.frequency=50;
    if(name==='generator'){source.params.frequency=1;source.params.turns=300;}
    if(['lc','damped'].includes(name)){
      source.x=160;source.y=300;
      const r=add('resistor',300,180,'充電電阻',{resistance:30}),sw=add('spdt',460,180,'充電／振盪'),c=add('capacitor',300,300,'電容器',{capacitance:.02},90),l=add('inductor',520,360,'電感線圈',{inductance:5,resistance:name==='lc'?0:8},270),bus=joint(520,450);
      link(source,'a',r,'a',[{x:160,y:180}]);link(r,'b',sw,'b',[{x:360,y:100},{x:520,y:100}]);link(sw,'a',c,'a',[{x:400,y:240}]);link(c,'b',l,'b',[{x:400,y:360},{x:400,y:300}]);link(l,'a',bus,'p');link(sw,'c',bus,'p',[{x:650,y:204},{x:650,y:450}]);link(source,'b',bus,'p',[{x:160,y:450}]);return M.validate(d);
    }
    if(['transformer','coupled','mutual'].includes(name)){
      const mutual=name==='mutual',tx=mutual?500:430,sx=mutual?740:650,outer=mutual?850:760;
      const t=add('transformer',tx,300,'變壓器',{model:name==='transformer'?'ideal':'coupled'}),load=add('resistor',sx,200,mutual?'副線圈限流電阻':'負載電阻',{resistance:mutual?100000:12}),meter=add(mutual?'galvanometer':'ac-ammeter',sx,410,mutual?'感應電流計':'副線圈電流表',mutual?{range:.0005}:{range:1});source.y=300;
      if(mutual){const sw=add('switch',330,180,'通斷開關',{closed:false}),r=add('resistor',510,140,'限流電阻',{resistance:12}),discharge=add('resistor',330,380,'放電電阻',{resistance:20}),top=joint(380,210),bottom=joint(380,460);t.params.inductance=5;t.params.primaryResistance=2;t.params.secondaryResistance=1;meter.params.range=.00005;link(source,'a',sw,'a',[{x:180,y:180}]);link(sw,'b',r,'a',[{x:390,y:140}]);link(r,'b',top,'p',[{x:610,y:140},{x:610,y:210}]);link(top,'p',t,'a',[{x:380,y:274}]);link(top,'p',discharge,'a',[{x:270,y:210}]);link(discharge,'b',bottom,'p',[{x:410,y:380},{x:410,y:460}]);link(t,'b',bottom,'p',[{x:380,y:326}]);link(source,'b',bottom,'p',[{x:180,y:460}]);}
      else link(source,'a',t,'a',[{x:180,y:180},{x:300,y:180},{x:300,y:274}]);
      const primaryBus=mutual?390:300,bottom=mutual?510:450;
      if(!mutual)link(t,'b',source,'b',[{x:primaryBus,y:326},{x:primaryBus,y:bottom},{x:180,y:bottom}]);link(t,'c',load,'a',[{x:sx-110,y:274},{x:sx-110,y:200}]);link(load,'b',meter,'b',[{x:outer,y:200},{x:outer,y:410}]);link(meter,'a',t,'d',[{x:sx-110,y:410},{x:sx-110,y:326}]);return M.validate(d);
    }
    if(name==='self'){
      source.y=300;
      const sw=add('switch',330,180,'通斷開關',{closed:false}),r=add('resistor',510,180,'限流電阻',{resistance:5}),l=add('inductor',650,330,'儲能線圈',{inductance:10,resistance:1},90),lamp=add('lamp',430,330,'放電燈',{resistance:3,ratedVoltage:3},90),top=joint(650,230),bottom=joint(430,460);
      link(source,'a',sw,'a',[{x:180,y:180}]);link(sw,'b',r,'a');link(r,'b',top,'p',[{x:650,y:180}]);link(top,'p',l,'a');link(top,'p',lamp,'a',[{x:430,y:230}]);link(l,'b',bottom,'p',[{x:650,y:460}]);link(lamp,'b',bottom,'p');link(source,'b',bottom,'p',[{x:180,y:460}]);return M.validate(d);
    }
    if(['inductive','rl'].includes(name)){
      source.y=290;
      const sw=add('spdt',330,180,'供電／放電切換',{closed:name==='rl'?'c':'b'},180),load=add('lamp',650,290,name==='rl'?'觀察電流建立':'負載／放電燈',{resistance:name==='rl'?3:12},90),device=add('inductor',510,180,'電感線圈',{inductance:5,resistance:name==='rl'?.1:1});
      if(name==='inductive')source.params.frequency=.2;
      link(source,'a',sw,'b',[{x:180,y:204}]);link(sw,'a',device,'a');link(device,'b',load,'a',[{x:650,y:180}]);const bus=joint(180,400);link(load,'b',bus,'p',[{x:650,y:400}]);link(source,'b',bus,'p');link(sw,'c',bus,'p',[{x:270,y:110},{x:100,y:110},{x:100,y:400}]);return M.validate(d);
    }
    const reactive=['capacitive','rc'].includes(name),sw=add(name==='rc'?'spdt':'switch',330,180,name==='rc'?'充電／放電':'開關',{closed:name==='rc'?'c':!dc},name==='rc'?180:0),load=add('lamp',reactive?650:name==='led'?510:480,reactive?290:180,name==='rc'?'充放電燈':'負載燈',{resistance:name==='rc'?20:12},reactive?90:0);source.y=reactive?290:name==='led'?330:260;if(name==='rc'){link(source,'a',sw,'b',[{x:180,y:204}]);}else link(source,'a',sw,'a',[{x:180,y:180}]);
    if(reactive){const type=['capacitive','rc'].includes(name)?'capacitor':'inductor',device=add(type,510,180,type==='capacitor'?'電容器':'電感線圈',{capacitance:name==='rc'?.1:.02});link(sw,name==='rc'?'a':'b',device,'a');link(device,'b',load,'a',[{x:650,y:180}]);}
    else link(sw,'b',load,'a');
    if(name==='led'){const red=add('led',650,270,'紅色 LED'),green=add('led',650,410,'綠色 LED',{colour:'green'},180);source.params.frequency=2;load.type='resistor';load.params=RDefaults('resistor');load.params.resistance=100;load.label='限流電阻';const top=joint(570,270),bottom=joint(730,410);link(load,'b',top,'p');link(top,'p',red,'a');link(top,'p',green,'b',[{x:570,y:410}]);link(red,'b',bottom,'p',[{x:730,y:270}]);link(green,'a',bottom,'p');link(bottom,'p',source,'b',[{x:730,y:480},{x:180,y:480}]);}
    else if(name==='rc'){const bus=joint(180,400);link(load,'b',bus,'p',[{x:650,y:400}]);link(source,'b',bus,'p');link(sw,'c',bus,'p',[{x:270,y:110},{x:100,y:110},{x:100,y:400}]);}
    else link(load,'b',source,'b',reactive?[{x:650,y:400},{x:180,y:400}]:[{x:590,y:180},{x:590,y:350},{x:180,y:350}]);
    if(name==='capacitive')source.params.frequency=.5;
    if(['square','triangle'].includes(name))source.params.waveform=name;
    return M.validate(d);
  }
  function RDefaults(type){return typeof module==='object'&&module.exports?require('./component-registry').defaults(type):globalThis.CircuitRegistry.defaults(type);}
  function examples(name){
    const transformer=name==='transformer',doc=create(transformer?'transformer':'lc'),t=doc.components.find(c=>c.type==='transformer'),r=doc.components.find(c=>c.type==='resistor'&&c.label==='負載電阻'),sw=doc.components.find(c=>c.type==='spdt'),c=doc.components.find(c=>c.type==='capacitor');
    if(transformer)doc.components[0].params.frequency=50; // Keep the fixed example's saved template compatible.
    return {role:'student',analysis:'transient',title:transformer?'變壓器：匝數與負載':'LC振盪：充電與振盪切換',initialDocument:doc,palette:[],wires:false,undo:false,ui:{header:false,inspector:true,readings:true,palette:false,waveform:true,energy:true,phase:false,field:false,playback:true},components:{byId:transformer?{[t.id]:{params:['secondaryTurns']},[r.id]:{params:['resistance']}}:{[sw.id]:{switch:true}}},simulation:{play:true,step:true,rate:false,reset:false},observationChannels:transformer?[{id:t.id,quantity:'voltage'},{id:r.id,quantity:'voltage'}]:[{id:c.id,quantity:'voltage'},{id:c.id,quantity:'current'},{id:c.id,quantity:'energy'}]};
  }
  function descriptionParts(name){const text=descriptions[name]||'已載入範例，可取線、改接及量測。',tokens={'Φ=BS cosθ':'[[fluxFormula]]','e=NBSω sinθ':'[[emfFormula]]','U₁/U₂=N₁/N₂':'[[transformerRatio]]','√2':'[[sqrt2]]','√3':'[[sqrt3]]','θ':'[[theta]]'};let marked=text;for(const [from,to]of Object.entries(tokens))marked=marked.replaceAll(from,to);marked=marked.replace(/\b[CfL]\b/g,x=>'[['+x+']]');return Q.proseParts(marked);}
  return {names,groups,descriptions,descriptionParts,rate,create,examples};
});
