(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-routing'):root.CircuitRouting,node?require('./circuit-ac-components'):root.CircuitAC,node?require('./circuit-math'):root.CircuitMath);if(node)module.exports=api;else root.CircuitACPresets=api;})(globalThis,function(M,G,AC,Q){
  'use strict';
  const names={resistive:'交流電阻：電壓、電流與有效值',mains:'50 Hz交流：燈泡亮度',generator:'交流發電機：轉動與感應電動勢',led:'交流方向：反向並聯LED',capacitive:'交流電容：頻率與電流',inductive:'交流電感：頻率與電流',rc:'電容充放電：電流與儲能',rl:'通電自感：電流建立',self:'斷電自感：線圈放電',transformer:'理想變壓器：匝數、電壓與電流',coupled:'非理想變壓器：耦合與線圈電阻',mutual:'互感：通斷電與感應電流',transmission:'高壓輸電：升壓與線路損耗',lc:'LC振盪：電場與磁場儲能',damped:'阻尼振盪：電阻與能量耗散',empty:'空白電路'};
  const groups=[{label:'交流基礎',keys:['resistive','mains','generator','led']},{label:'電容與電感',keys:['capacitive','inductive','rc','rl','self']},{label:'變壓器與互感',keys:['transformer','coupled','mutual','transmission']},{label:'振盪電路',keys:['lc','damped']}];
  const descriptions={resistive:'調較電源電壓或頻率，觀察燈泡及電壓、電流波形。電阻兩端的電壓與電流會同時轉向。',mains:'這個示例用 50 Hz 交流電源。電流快速反向，燈泡看起來持續發光；可用波形圖觀察電壓及電流。',square:'方波的有效值等於峰值；與正弦波的 √2 關係不同。',triangle:'三角波的有效值等於峰值除以 √3。',generator:'轉動線圈會產生電壓。加快轉速，觀察波形變密、電壓增大。',led:'紅、綠 LED 接成相反方向，交流電流每次轉向，由另一顆 LED 發光。',capacitive:'調大電容 C 或提高頻率 f，看看交流電流如何改變。兩塊極板會輪流充電、放電；電子不會穿過兩板之間。',inductive:'調大自感系數 L 或提高頻率 f，看看交流電流如何改變。線圈會儲存磁場能量；接通 C 放電，觀察燈泡逐漸變暗。',rc:'接通 B 充電，觀察燈泡由亮變暗；等幾秒後接通 C 放電，燈泡會再亮起並逐漸熄滅。',rl:'接通 B 供電：電流逐漸增加，燈泡逐漸亮起。再接通 C 放電，觀察燈泡逐漸熄滅。',self:'合上開關等約 8 秒，再斷開：線圈儲存的能量使燈泡短暫發光，之後逐漸變暗。觀察燈泡中的電流方向。',transformer:'調較副線圈匝數或負載電阻，觀察電壓與電流。理想情況下，電壓比等於匝數比：U₁/U₂=N₁/N₂。兩側導線沒有直接相連。',coupled:'部分磁場沒有穿過另一個線圈，加上繞線本身有電阻，電壓比未必等於匝數比。調整參數，與理想變壓器比較。',mutual:'合上開關，等電流穩定後再斷開，觀察副線圈電流計向兩個相反方向偏轉。原線圈電流改變，才會在副線圈產生感應。',lc:'先接通 B 充電，等約 2 秒後接通 C 振盪。觀察兩極板反覆改變電荷，能量在電容的電場與線圈的磁場之間轉換。',damped:'與 LC 振盪示例比較：加入電阻後，電流逐漸減弱，儲存的能量逐漸轉成熱。',empty:'從工具箱取出元件和導線。滑鼠或觸控筆可拖放；手指可點選。把接孔與線端移近便會接好。'};

  descriptions.transmission='上方直接輸電，下方由 230 V 升至約 23 kV，經輸電線後降回用戶端。兩邊負載均為 529 Ω，去回線各為 100 Ω；比較輸電電流、負載電壓與選取負載後的平均功率。線損等於有效值電流的平方乘 200 Ω。兩邊固定電源及負載，實際送達功率不同。變壓器為理想模型，畫面線長不改變線阻。';
  const rate=()=>1;
  function create(name,{comparisonMeters=true}={}){if(!Object.hasOwn(names,name)&&!['square','triangle'].includes(name))throw new Error('未知交流預設');const d=M.empty('transient');d.cables.count=40;
    const add=(type,x,y,label,params={},angle=0)=>{const c=M.add(d,type,x,y,params);c.label=label;c.angle=angle;return c;};
    const link=(a,ap,b,bp,via=[])=>{const pa=a.id+':'+ap,pb=b.id+':'+bp,end=M.endpoints(d),points=G.rounded([end.get(pa),...via,end.get(pb)]),w=M.connect(d,pa,pb,points.slice(1,-1),'free');w.length=Math.max(600,Math.ceil(G.length(points))+100);return w;};
    const joint=(x,y)=>{const j={id:M.nextId(d,'j'),x,y};d.junctions.push(j);return j;};
    if(name==='empty')return d;
    const dc=['rc','rl','self','mutual','lc','damped'].includes(name),source=add(name==='generator'?'generator':dc?'battery':'ac-source',180,260,name==='generator'?'交流發電機':dc?'直流電源':'交流電源',{},90);
    if(name==='transmission'){
      source.x=120;source.y=230;source.label='直接輸電電源';Object.assign(source.params,{voltage:230,frequency:50});
      const lowA=add('ac-ammeter',610,110,'直接輸電電流',{range:.5}),lowLoad=add('resistor',1120,230,'直接輸電負載',{resistance:529},90),lowV=add('ac-voltmeter',940,230,'直接輸電負載電壓',{range:300}),lowTop=joint(880,110),lowBottom=joint(1000,380);
      link(source,'a',lowA,'a',[{x:120,y:110}]);link(lowA,'b',lowTop,'p').resistance=100;link(lowTop,'p',lowLoad,'a',[{x:1120,y:110}]);
      link(lowLoad,'b',lowBottom,'p',[{x:1120,y:380}]);link(lowBottom,'p',source,'b',[{x:120,y:380}]).resistance=100;
      link(lowV,'a',lowTop,'p');link(lowV,'b',lowBottom,'p');
      const highSource=add('ac-source',120,640,'升壓輸電電源',{voltage:230,frequency:50},90),up=add('transformer',340,640,'升壓變壓器',{model:'ideal',primaryTurns:10,secondaryTurns:1000}),down=add('transformer',820,640,'降壓變壓器',{model:'ideal',primaryTurns:1000,secondaryTurns:10}),highA=add('ac-ammeter',570,500,'高壓輸電電流',{range:.01}),highLoad=add('resistor',1120,640,'升壓輸電負載',{resistance:529},90),lineV=add('ac-voltmeter',570,650,'高壓段電壓',{range:30000},90),highV=add('ac-voltmeter',990,640,'升壓輸電負載電壓',{range:300}),top=joint(740,560),bottom=joint(570,800),loadTop=joint(930,540),loadBottom=joint(1050,760);
      link(highSource,'a',up,'a',[{x:120,y:540},{x:240,y:540},{x:240,y:614}]);link(up,'b',highSource,'b',[{x:240,y:666},{x:240,y:760},{x:120,y:760}]);
      link(up,'c',highA,'a',[{x:450,y:614},{x:450,y:500}]).resistance=100;link(highA,'b',top,'p',[{x:740,y:500}]);link(top,'p',down,'a',[{x:740,y:614}]);link(down,'b',bottom,'p',[{x:740,y:666},{x:740,y:800}]);link(bottom,'p',up,'d',[{x:450,y:800},{x:450,y:666}]).resistance=100;
      link(lineV,'a',top,'p',[{x:570,y:560}]);link(lineV,'b',bottom,'p');
      link(down,'c',loadTop,'p',[{x:910,y:614},{x:910,y:540}]);link(loadTop,'p',highLoad,'a',[{x:1120,y:540}]);link(highLoad,'b',loadBottom,'p',[{x:1120,y:760}]);link(loadBottom,'p',down,'d',[{x:910,y:760},{x:910,y:666}]);
      link(highV,'a',loadTop,'p');link(highV,'b',loadBottom,'p');
      return M.validate(d);
    }
    if(name==='mains')source.params.frequency=50;
    if(name==='generator'){source.params.frequency=1;source.params.turns=300;}
    if(['lc','damped'].includes(name)){
      source.x=160;source.y=300;
      const r=add('resistor',300,180,'充電電阻',{resistance:30}),sw=add('spdt',460,180,'充電／振盪'),c=add('capacitor',300,300,'電容器',{capacitance:.02},90),l=add('inductor',520,360,'電感線圈',{inductance:5,resistance:name==='lc'?0:8},270),bus=joint(520,450);
      link(source,'a',r,'a',[{x:160,y:180}]);link(r,'b',sw,'b',[{x:360,y:100},{x:520,y:100}]);link(sw,'a',c,'a',[{x:400,y:240}]);link(c,'b',l,'b',[{x:400,y:360},{x:400,y:300}]);link(l,'a',bus,'p');link(sw,'c',bus,'p',[{x:650,y:204},{x:650,y:450}]);link(source,'b',bus,'p',[{x:160,y:450}]);return M.validate(d);
    }
    if(name==='coupled'||name==='transformer'&&comparisonMeters)Object.assign(source.params,{protectionEnabled:true,maxCurrent:1,maxPower:6});
    if(name==='transformer'&&comparisonMeters){
      source.x=120;source.y=320;
      const t=add('transformer',460,320,'變壓器',{model:'ideal'}),load=add('resistor',800,320,'負載電阻',{resistance:12},90),si=add('ac-ammeter',640,120,'副線圈電流表',{range:1}),pi=add('ac-ammeter',280,120,'原線圈電流表',{range:2}),pv=add('ac-voltmeter',280,270,'原線圈電壓表',{range:15}),sv=add('ac-voltmeter',640,270,'副線圈電壓表',{range:30});
      const pt=joint(360,160),pb=joint(360,410),st=joint(560,160),sb=joint(560,410),returnBus=joint(720,410);
      link(source,'a',pi,'a',[{x:120,y:120}]);link(pi,'b',pt,'p',[{x:360,y:120}]);
      link(pt,'p',t,'a',[{x:370,y:160},{x:370,y:294}]);link(t,'b',pb,'p',[{x:370,y:346},{x:370,y:410}]);link(pb,'p',source,'b',[{x:120,y:410}]);
      link(pt,'p',pv,'a',[{x:360,y:210},{x:200,y:210},{x:200,y:270}]);link(pv,'b',pb,'p',[{x:360,y:270}]);
      link(t,'c',st,'p',[{x:550,y:294},{x:550,y:160}]);link(st,'p',si,'a',[{x:560,y:120}]);link(si,'b',load,'a',[{x:800,y:120}]);
      link(load,'b',returnBus,'p',[{x:800,y:410}]);link(returnBus,'p',sb,'p');link(sb,'p',t,'d',[{x:550,y:410},{x:550,y:346}]);
      link(st,'p',sv,'a',[{x:560,y:270}]);link(sv,'b',returnBus,'p',[{x:720,y:270}]);
      return M.validate(d);
    }
    if(['transformer','coupled','mutual'].includes(name)){
      const mutual=name==='mutual',tx=mutual?500:430,sx=mutual?660:650,outer=mutual?780:760;
      const t=add('transformer',tx,300,'變壓器',{model:name==='transformer'?'ideal':'coupled'}),load=add('resistor',sx,mutual?140:200,mutual?'副線圈限流電阻':'負載電阻',{resistance:mutual?100000:12}),meter=add(mutual?'galvanometer':'ac-ammeter',sx,410,mutual?'感應電流計':'副線圈電流表',mutual?{range:.0005}:{range:1});source.y=300;
      if(mutual){
        source.x=100;
        const sw=add('switch',160,140,'通斷開關',{closed:false}),r=add('resistor',300,140,'限流電阻',{resistance:12}),discharge=add('resistor',320,300,'放電電阻',{resistance:20},90),top=joint(420,220),bottom=joint(320,380);
        t.params.inductance=5;t.params.primaryResistance=2;t.params.secondaryResistance=1;meter.params.range=.00005;meter.y=420;
        link(source,'a',sw,'a',[{x:100,y:140}]);link(sw,'b',r,'a');link(r,'b',top,'p',[{x:420,y:140}]);
        link(top,'p',t,'a',[{x:420,y:274}]);link(top,'p',discharge,'a',[{x:320,y:220}]);link(discharge,'b',bottom,'p');
        link(t,'b',bottom,'p',[{x:420,y:326},{x:420,y:380}]);link(source,'b',bottom,'p',[{x:100,y:380}]);
        link(t,'c',load,'a',[{x:600,y:274},{x:600,y:140}]);link(load,'b',meter,'b',[{x:780,y:140},{x:780,y:420}]);link(meter,'a',t,'d',[{x:600,y:420},{x:600,y:326}]);
        return M.validate(d);
      }
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
    const transformer=name==='transformer',doc=create(transformer?'transformer':'lc',{comparisonMeters:false}),t=doc.components.find(c=>c.type==='transformer'),r=doc.components.find(c=>c.type==='resistor'&&c.label==='負載電阻'),sw=doc.components.find(c=>c.type==='spdt'),c=doc.components.find(c=>c.type==='capacitor');
    if(transformer)doc.components[0].params.frequency=50; // Keep the fixed example's saved template compatible.
    return {role:'student',analysis:'transient',title:transformer?'變壓器：匝數與負載':'LC振盪：充電與振盪切換',initialDocument:doc,palette:[],wires:false,undo:false,ui:{header:false,inspector:true,readings:true,palette:false,waveform:true,energy:true,phase:false,field:false,playback:true},components:{byId:transformer?{[t.id]:{params:['secondaryTurns']},[r.id]:{params:['resistance']}}:{[sw.id]:{switch:true}}},simulation:{play:true,step:true,rate:false,reset:false},observationChannels:transformer?[{id:t.id,quantity:'voltage'},{id:r.id,quantity:'voltage'}]:[{id:c.id,quantity:'voltage'},{id:c.id,quantity:'current'},{id:c.id,quantity:'energy'}]};
  }
  function descriptionParts(name){const text=descriptions[name]||'已載入範例，可取線、改接及量測。',tokens={'Φ=BS cosθ':'[[fluxFormula]]','e=NBSω sinθ':'[[emfFormula]]','U₁/U₂=N₁/N₂':'[[transformerRatio]]','√2':'[[sqrt2]]','√3':'[[sqrt3]]','θ':'[[theta]]'};let marked=text;for(const [from,to]of Object.entries(tokens))marked=marked.replaceAll(from,to);marked=marked.replace(/\b[CfL]\b/g,x=>'[['+x+']]');return Q.proseParts(marked);}
  return {names,groups,descriptions,descriptionParts,rate,create,examples};
});
