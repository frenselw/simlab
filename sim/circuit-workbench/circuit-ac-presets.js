(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-routing'):root.CircuitRouting,node?require('./circuit-ac-components'):root.CircuitAC);if(node)module.exports=api;else root.CircuitACPresets=api;})(globalThis,function(M,G,AC){
  'use strict';
  const names={resistive:'交流 · 電阻與有效值',mains:'50 Hz · 真實交流效果',square:'交流 · 方波有效值',triangle:'交流 · 三角波有效值',generator:'交流的產生 · 發電機',led:'電流方向 · 反向並聯 LED',capacitive:'電容對交流的作用',inductive:'電感對交流的作用',rc:'電容充電與放電',rl:'通電自感 · 電流建立',self:'斷電自感 · 燈的電流反向',transformer:'理想變壓器 · 匝數與負載',coupled:'線性變壓器 · 電阻與耦合',mutual:'互感 · 直流通斷電',lc:'LC · 先充電再振盪',damped:'LC · 電阻造成衰減',empty:'空白畫布'};
  const descriptions={resistive:'調整頻率及有效值。電阻的電壓與電流同相；有效值用一個週期的實際波形積分。',square:'方波有效值等於峰值；不要套用正弦波的 √2 關係。',triangle:'三角波有效值等於峰值除以 √3。',generator:'觀察 θ、Φ=BS cosθ 及 e=NBSω sinθ。改轉速會同時改頻率及振幅；外界維持轉速。',led:'紅、綠 LED 反向並聯，每半週由不同 LED 導通。',capacitive:'在相同電動勢有效值下，增加 C 或 f 通常令容抗降低。電流是外部充放電流，電子不穿過介質。',inductive:'增加 L 或 f 會增加感抗；線圈電阻另外計入。可改用直流電源作比較。',rc:'合上開關並播放，觀察電容逐漸充電。重新搭接帶電電容會建立新實驗；reset 回初始條件。',rl:'合上開關並播放。自感阻礙電流變化；電流逐漸建立。',self:'合上開關並播放；稍後斷開。線圈經燈放電，燈的電流反向。是否閃亮取決於斷開前線圈电流，不是必然。',transformer:'理想交流模型：U₁/U₂=n₁/n₂，兩側電氣隔離。改匝數或負載，觀察有效值與功率。直流請用線性線圈模型。',coupled:'線性線圈包括線阻及不完全耦合，不含磁芯飽和、磁滯及鐵損；實際電壓比不必完全等於匝數比。',mutual:'合上開關、播放至穩定，再斷開。原線圈的可見放電電阻提供通路；副線圈的感應方向在通斷時相反。',lc:'播放約 0.1 s 讓電容充電，暫停並把單刀雙擲開關切至放電側，再播放。觀察反向充電及電場／磁場能交換。',damped:'與理想 LC 比較：線圈有 1 Ω 電阻，儲能逐漸轉為內能；不模擬輻射損失。',empty:'從工具箱取物。滑鼠／觸控筆可拖放；手指點選。接孔及線端互相靠近便吸附。'};
  const rate=()=>1;
  function create(name){if(!Object.hasOwn(names,name))throw new Error('未知交流預設');const d=M.empty('transient');d.cables.count=40;
    const add=(type,x,y,label,params={},angle=0)=>{const c=M.add(d,type,x,y,params);c.label=label;c.angle=angle;return c;};
    const link=(a,ap,b,bp,via=[])=>{const pa=a.id+':'+ap,pb=b.id+':'+bp,end=M.endpoints(d),points=G.rounded([end.get(pa),...via,end.get(pb)]),w=M.connect(d,pa,pb,points.slice(1,-1),'free');w.length=Math.max(600,Math.ceil(G.length(points))+100);return w;};
    if(name==='empty')return d;
    const dc=['rc','rl','self','mutual','lc','damped'].includes(name),source=add(name==='generator'?'generator':dc?'battery':'ac-source',150,330,name==='generator'?'交流發電機':dc?'直流電源':'交流電源',{},90);
    if(name==='mains')source.params.frequency=50;
    if(['lc','damped'].includes(name)){
      const r=add('resistor',340,150,'充電電阻',{resistance:10}),sw=add('spdt',350,300,'充電／放電',{},180),c=add('capacitor',590,300,'電容器'),l=add('inductor',590,490,'電感線圈',{resistance:name==='lc'?0:1});
      link(source,'a',r,'a',[{x:150,y:150}]);link(r,'b',sw,'b',[{x:430,y:150},{x:430,y:380},{x:270,y:380}]);link(sw,'a',c,'a');link(sw,'c',l,'a',[{x:250,y:276},{x:250,y:430},{x:510,y:430}]);link(c,'b',source,'b',[{x:740,y:300},{x:740,y:570},{x:150,y:570}]);link(l,'b',c,'b',[{x:740,y:490}]);return M.validate(d);
    }
    if(['transformer','coupled','mutual'].includes(name)){
      const t=add('transformer',490,300,'變壓器',{model:name==='transformer'?'ideal':'coupled'}),load=add('resistor',790,180,name==='mutual'?'副線圈限流電阻':'負載電阻',{resistance:name==='mutual'?100000:12}),meter=add(name==='mutual'?'galvanometer':'ac-ammeter',790,430,name==='mutual'?'感應電流計':'副線圈電流表',name==='mutual'?{range:.0005}:{range:1});
      if(name==='mutual'){const sw=add('switch',300,150,'通斷開關',{closed:false}),r=add('resistor',300,270,'限流電阻',{resistance:12}),discharge=add('resistor',350,490,'放電電阻',{resistance:100});t.params.primaryResistance=12;t.params.secondaryResistance=1;link(source,'a',sw,'a',[{x:150,y:150}]);link(sw,'b',r,'a',[{x:400,y:150},{x:400,y:220},{x:240,y:220}]);link(r,'b',t,'a');link(t,'a',discharge,'a',[{x:390,y:274},{x:270,y:350},{x:270,y:490}]);link(discharge,'b',t,'b',[{x:450,y:490},{x:450,y:390}]);}
      else link(source,'a',t,'a',[{x:150,y:160},{x:390,y:160}]);
      link(t,'b',source,'b',[{x:390,y:590},{x:150,y:590}]);link(t,'c',load,'a',[{x:640,y:274},{x:640,y:180}]);link(load,'b',meter,'b',[{x:930,y:180},{x:930,y:430}]);link(meter,'a',t,'d',[{x:640,y:430},{x:640,y:326}]);return M.validate(d);
    }
    if(name==='self'){
      const sw=add('switch',300,170,'通斷開關',{closed:false}),r=add('resistor',500,170,'限流電阻',{resistance:5}),l=add('inductor',600,310,'儲能線圈',{resistance:1}),lamp=add('lamp',600,490,'放電燈');
      link(source,'a',sw,'a',[{x:150,y:170}]);link(sw,'b',r,'a');link(r,'b',l,'a',[{x:480,y:170},{x:480,y:310}]);link(r,'b',lamp,'a',[{x:450,y:170},{x:450,y:490}]);link(l,'b',lamp,'b',[{x:770,y:310},{x:770,y:490}]);link(lamp,'b',source,'b',[{x:770,y:590},{x:150,y:590}]);return M.validate(d);
    }
    const sw=add('switch',310,170,'開關',{closed:!dc}),load=add(name==='rc'?'resistor':'lamp',730,170,name==='rc'?'充電電阻':'負載燈',name==='rc'?{resistance:1000}:{resistance:12});link(source,'a',sw,'a',[{x:150,y:170}]);
    if(['capacitive','inductive','rc','rl'].includes(name)){const type=['capacitive','rc'].includes(name)?'capacitor':'inductor',reactive=add(type,510,170,type==='capacitor'?'電容器':'電感線圈',name==='capacitive'?{capacitance:.00022}:name==='inductive'?{inductance:.1}:{});link(sw,'b',reactive,'a');link(reactive,'b',load,'a');}
    else link(sw,'b',load,'a');
    if(name==='led'){const red=add('led',730,310,'紅色 LED'),green=add('led',730,450,'綠色 LED',{colour:'green'},180);source.params.frequency=2;load.type='resistor';load.params=RDefaults('resistor');load.params.resistance=100;load.label='限流電阻';link(load,'b',red,'a',[{x:900,y:170},{x:900,y:250},{x:640,y:250},{x:640,y:310}]);link(red,'a',green,'b',[{x:640,y:450}]);link(red,'b',green,'a',[{x:870,y:310},{x:870,y:450}]);link(green,'a',source,'b',[{x:870,y:550},{x:150,y:550}]);}
    else link(load,'b',source,'b',[{x:880,y:170},{x:880,y:550},{x:150,y:550}]);
    if(['square','triangle'].includes(name))source.params.waveform=name;
    return M.validate(d);
  }
  function RDefaults(type){return typeof module==='object'&&module.exports?require('./component-registry').defaults(type):globalThis.CircuitRegistry.defaults(type);}
  function examples(name){
    const transformer=name==='transformer',doc=create(transformer?'transformer':'lc'),t=doc.components.find(c=>c.type==='transformer'),r=doc.components.find(c=>c.type==='resistor'&&c.label==='負載電阻'),sw=doc.components.find(c=>c.type==='spdt'),c=doc.components.find(c=>c.type==='capacitor');
    if(transformer)doc.components[0].params.frequency=50; // Keep the fixed example's saved template compatible.
    return {role:'student',analysis:'transient',title:transformer?'變壓器調參示例':'LC 切換觀察示例',initialDocument:doc,palette:[],wires:false,undo:false,ui:{header:false,inspector:true,readings:true,palette:false,waveform:true,energy:true,phase:false,field:false,playback:true},components:{byId:transformer?{[t.id]:{params:['secondaryTurns']},[r.id]:{params:['resistance']}}:{[sw.id]:{switch:true}}},simulation:{play:true,step:true,rate:false,reset:false},observationChannels:transformer?[{id:t.id,quantity:'voltage'},{id:r.id,quantity:'voltage'}]:[{id:c.id,quantity:'voltage'},{id:c.id,quantity:'current'},{id:c.id,quantity:'energy'}]};
  }
  return {names,descriptions,rate,create,examples};
});
