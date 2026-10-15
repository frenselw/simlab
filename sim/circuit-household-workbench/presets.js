(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('../circuit-workbench/circuit-household-components'):root.CircuitHouseholdComponents,node?require('../circuit-workbench/circuit-model'):root.CircuitModel);if(node)module.exports=api;else root.CircuitHouseholdPresets=api;})(globalThis,function(C,M){
  'use strict';
  const names=Object.freeze({empty:'空白工作台',C01:'基本接線：市電、插座與家電',C02:'開關位置：切斷火線與零線',C03:'地線保護：金屬外殼漏電',C04:'漏電保護：偵測差流並跳掣',C05:'雙重絕緣：隔開帶電部分',C06:'並聯用電：各支路獨立工作',C07:'過載跳掣：逐件開啟家電',C07fuse:'保險絲：過流時熔斷',C08:'接線比較：家電接到不同導線',C09:'人體觸電：雙手接火線與零線',C10:'短路保護：大電流與跳掣'});
  const groups=Object.freeze([{label:'接線基礎',keys:['C01','C06','C02']},{label:'防觸電保護',keys:['C03','C05','C04','C09']},{label:'過流與短路',keys:['C07','C07fuse','C10']}]);
  const questions=Object.freeze({empty:'取出元件，試試你的接法。',C01:'三條線怎樣連到插座和電器？',C02:'電器停止後，火線是否已經隔離？',C03:'地線如何把金屬外殼接回地？',C04:'哪些回流路徑會令漏電保護器跳掣？',C05:'外層絕緣如何隔開帶電部分？',C06:'拔開其中一件，另一件會怎樣？',C07:'逐件開啟家電，總電流何時超過 5 A？',C07fuse:'合上開關，3 A 保險絲能承受這件家電嗎？',C08:'兩條線接到不同孔，電器會怎樣？',C09:'兩手分別接火線和零線，椅子能斷開這個回路嗎？',C10:'把跨線的自由端接到 N，電流會怎樣？'});
  function create(key='C01'){
    if(!Object.hasOwn(names,key))throw new Error('不存在的家庭示例');
    const doc=M.empty('household');doc.cables={count:40,length:900,resistance:0};doc.display.fontSize='s';doc.display.values=false;
    const add=(id,type,x,y,params={},label)=>{const c=M.add(doc,type,x,y,params);c.id=id;c.label=label||C.definitions[type].name;return c;};
    const wire=(from,to,via=[])=>{const ends=M.endpoints(doc),a=ends.get(from),b=ends.get(to);return M.connect(doc,from,to,via,via.length||a.x===b.x||a.y===b.y?'free':'auto');};
    if(key==='empty')return M.validate(doc);
    if(key==='C07fuse'){
      add('source','house-mains',-230,0,{},'市電');add('protector','house-fuse',-40,-22,{rating:3});add('switch','house-switch',120,-22,{closed:false},'開關');add('load','house-insulated',380,100,{kind:'dryer'},'吹風機');
      wire('source:l','protector:a');wire('protector:b','switch:a');wire('switch:b','load:l',[{x:230,y:-22},{x:230,y:74}]);wire('source:n','load:n',[{x:-120,y:22},{x:-120,y:160},{x:260,y:160},{x:260,y:100}]);return M.validate(doc);
    }
    if(key==='C07'){
      add('source','house-mains',-290,-100,{},'市電');add('protector','house-breaker',-80,-100,{rating:5});wire('source:l','protector:li');wire('source:n','protector:ni');
      for(const role of ['l','n']){const y=role==='l'?-122:-78;let previous='protector:'+role+'o';for(let n=0;n<3;n++){const id='bus-'+role+'-'+n;doc.junctions.push({id,x:80+n*280+(role==='l'?80:0),y});wire(previous,id+':p');previous=id+':p';}const id='bus-'+role+'-end';doc.junctions.push({id,x:920,y});wire(previous,id+':p');}
      for(const [n,kind]of ['blender','vacuum','dryer'].entries()){const suffix=n?String(n+1):'',x=280+n*280,sw=add('switch'+suffix,'house-switch',x-120,100,{closed:n===0},'開關 '+(n+1));sw.angle=90;add('load'+suffix,'house-insulated',x,260,{kind},C.applianceKinds.insulated[kind].label);wire('bus-l-'+n+':p',sw.id+':a');wire(sw.id+':b','load'+suffix+':l',[{x:x-120,y:234}]);wire('bus-n-'+n+':p','load'+suffix+':n',[{x:x-200,y:260}]);}return M.validate(doc);
    }
    if(key==='C10'){
      add('source','house-mains',-210,-80,{},'市電');add('protector','house-breaker',-30,-80,{rating:15});add('load','house-insulated',300,160,{kind:'fan'},'風扇');const sw=add('switch','house-switch',164,20,{},'開關');sw.angle=90;
      doc.junctions.push({id:'short-l',x:110,y:-102},{id:'short-n',x:70,y:-58});
      wire('source:l','protector:li');wire('source:n','protector:ni');wire('protector:lo','short-l:p');wire('protector:no','short-n:p');
      wire('short-l:p','switch:a',[{x:164,y:-102}]);wire('switch:b','load:l',[{x:164,y:134}]);wire('short-n:p','load:n',[{x:70,y:160}]);
      const bridge=M.addWire(doc,20,130);bridge.id='short-link';M.attach(doc,bridge.id,'from','short-l:p');return M.validate(doc);
    }
    if(key==='C09'){
      add('source','house-mains',-170,0,{},'市電');add('person','house-person',130,20,{stance:'insulated'},'人');
      wire('source:l','person:hand',[{x:-65,y:-22},{x:-65,y:-110},{x:195,y:-110},{x:195,y:-15}]);
      wire('source:n','person:hand-left',[{x:-65,y:22},{x:-65,y:75},{x:70,y:75},{x:70,y:18}]);return M.validate(doc);
    }
    add('source','house-mains',key==='C01'?-260:-140,-110,{},'市電');
    const socketX=key==='C01'?260:180,loadX=key==='C01'?490:key==='C02'?500:410;
    add('socket','house-socket',socketX,100,{},'插座');
    let live='source:l',neutral='source:n';
    if(key==='C01'){
      add('meter','house-meter',-100,-110);add('breaker','house-breaker',60,-110,{rating:15});
      wire(live,'meter:li');wire(neutral,'meter:ni');wire('meter:lo','breaker:li');wire('meter:no','breaker:ni');live='breaker:lo';neutral='breaker:no';
    }else if(key==='C04'){
      add('protector','house-rcd',20,-110,{},'漏電保護器');
      wire(live,'protector:li');wire(neutral,'protector:ni');live='protector:lo';neutral='protector:no';
    }
    const insulated=['C05','C06','C08'].includes(key),kind=key==='C01'?'heater':insulated?'blender':'fan';
    add('load',insulated?'house-insulated':'house-metal',loadX,100,{kind},C.applianceKinds[insulated?'insulated':'metal'][kind].label);
    if(['C01','C03','C04','C08'].includes(key)){
      add('earth','house-earth',socketX-190,20);wire('earth:e','socket:e',[{x:socketX-36,y:20},{x:socketX-36,y:78}]);
    }
    if(['C02','C03','C04','C05'].includes(key))add('person','house-person',loadX+140,125,{},'人');
    if(key==='C02')add('switch','house-switch',280,170,{},'開關');
    if(key==='C06'){
      add('socket2','house-socket',socketX+380,100,{},'插座 2');add('load2','house-insulated',loadX+380,100,{kind:'fan'},'風扇');
    }
    // Separate junctions make a real branch; a visual crossing alone never connects.
    function bus(from,role,y){
      const taps=[{socket:'socket',x:socketX+(role==='l'?66:-66),y:124}];
      if(key==='C06')taps.push({socket:'socket2',x:socketX+380+(role==='l'?66:-66),y:124});
      taps.sort((a,b)=>a.x-b.x);let previous=from;
      for(const tap of taps){const id='bus-'+role+'-'+tap.socket;doc.junctions.push({id,x:tap.x,y});wire(previous,id+':p');previous=id+':p';}
      const id='bus-'+role+'-end';doc.junctions.push({id,x:loadX+(key==='C06'?380:0)+48,y});wire(previous,id+':p');
      for(const tap of taps){if(role==='l'&&!['C02','C08'].includes(key)){const suffix=tap.socket==='socket'?'':'2',sw=add('switch'+suffix,'house-switch',tap.x,-8,{},'開關'+(suffix?' 2':''));sw.angle=90;wire('bus-l-'+tap.socket+':p',sw.id+':a');wire(sw.id+':b',tap.socket+':l',[{x:tap.x,y:tap.y}]);}else wire('bus-'+role+'-'+tap.socket+':p',tap.socket+':'+role,[{x:tap.x,y:tap.y}]);}
    }
    bus(live,'l',-132);bus(neutral,'n',-88);
    for(const suffix of key==='C06'?['','2']:['']){
      const socket=doc.components.find(c=>c.id==='socket'+suffix),load=doc.components.find(c=>c.id==='load'+suffix);
      if(key==='C02'){
        wire('socket:l','switch:a',[{x:207,y:170}]);wire('switch:b','load:l',[{x:350,y:170},{x:350,y:74}]);
      }else wire(socket.id+':l',load.id+':l',[{x:socket.x+27,y:socket.y+70},{x:socket.x+75,y:socket.y+70},{x:socket.x+75,y:load.y-26}]);
      wire(socket.id+':n',load.id+':n',key==='C02'?[{x:socket.x-27,y:245},{x:390,y:245},{x:390,y:100}]:[{x:socket.x-27,y:socket.y+112},{x:load.x-95,y:socket.y+112},{x:load.x-95,y:load.y}]);
      if(C.definitions[load.type].ports.some(p=>p.key==='e')&&key!=='C02')wire('socket:e','load:e',[{x:socket.x,y:socket.y-55},{x:load.x-130,y:socket.y-55},{x:load.x-130,y:load.y+26}]);
    }
    return M.validate(doc);
  }
  return Object.freeze({names,questions,groups,create});
});
