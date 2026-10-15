(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('../circuit-workbench/circuit-household-components'):root.CircuitHouseholdComponents,node?require('../circuit-workbench/circuit-model'):root.CircuitModel);if(node)module.exports=api;else root.CircuitHouseholdPresets=api;})(globalThis,function(C,M){
  'use strict';
  const names=Object.freeze({empty:'空白工作台',C01:'家庭電路怎樣接',C02:'開關應接哪條線',C03:'地線如何保護人',C04:'漏電保護器為何跳掣',C05:'雙重絕緣多了一層甚麼',C06:'兩件家電為何並聯',C07:'斷路器保護甚麼',C07fuse:'保險絲保護甚麼',C08:'兩條線接到哪裏',C09:'站在絕緣椅上也會觸電嗎'});
  const questions=Object.freeze({empty:'取出元件，試試你的接法。',C01:'三條線怎樣連到插座和電器？',C02:'電器停止後，火線是否已經隔離？',C03:'地線如何把金屬外殼接回地？',C04:'哪些回流路徑會令漏電保護器跳掣？',C05:'內層破損後，外層仍隔離甚麼？',C06:'拔開其中一件，另一件會怎樣？',C07:'同一件電器，改小額定電流會怎樣？',C07fuse:'熔絲斷了，合上開關能恢復嗎？',C08:'兩條工作線接到不同孔，電器會怎樣？',C09:'兩手分別接火線和零線，椅子能斷開這個回路嗎？'});
  function create(key='C01'){
    if(!Object.hasOwn(names,key))throw new Error('不存在的家庭示例');
    const doc=M.empty('household');doc.cables={count:40,length:900,resistance:0};doc.display.fontSize='s';doc.display.values=false;
    const add=(id,type,x,y,params={},label)=>{const c=M.add(doc,type,x,y,params);c.id=id;c.label=label||C.definitions[type].name;return c;};
    const wire=(from,to,via=[])=>{const ends=M.endpoints(doc),a=ends.get(from),b=ends.get(to);return M.connect(doc,from,to,via,via.length||a.x===b.x||a.y===b.y?'free':'auto');};
    if(key==='empty')return M.validate(doc);
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
    }else if(key==='C04'||key==='C07'){
      add('protector',key==='C04'?'house-rcd':'house-breaker',20,-110,key==='C07'?{rating:15}:{},key==='C04'?'漏電保護器':'斷路器');
      wire(live,'protector:li');wire(neutral,'protector:ni');live='protector:lo';neutral='protector:no';
    }else if(key==='C07fuse'){
      add('protector','house-fuse',20,-132,{rating:13});wire(live,'protector:a');live='protector:b';
    }
    const insulated=['C05','C06','C08'].includes(key),kind=key==='C01'||key==='C07'||key==='C07fuse'?'heater':insulated?'blender':'fan';
    add('load',insulated?'house-insulated':'house-metal',loadX,100,{kind},C.applianceKinds[insulated?'insulated':'metal'][kind].label);
    if(['C01','C03','C04','C07','C07fuse','C08'].includes(key)){
      add('earth','house-earth',socketX-190,20);wire('earth:e','socket:e',[{x:socketX,y:20}]);
    }
    if(['C02','C03','C04','C05'].includes(key))add('person','house-person',loadX+140,125,{},'人');
    if(key==='C02')add('switch','house-switch',340,-5,{},'開關');
    if(key==='C06'){
      add('socket2','house-socket',socketX,340,{},'插座 2');add('load2','house-insulated',loadX,340,{kind:'fan'},'風扇');
    }
    // Separate junctions make a real branch; a visual crossing alone never connects.
    function bus(from,role,y){
      const taps=[{socket:'socket',x:socketX+(role==='l'?66:-66),y:124}];
      if(key==='C06')taps.push({socket:'socket2',x:socketX+(role==='l'?104:-104),y:364});
      taps.sort((a,b)=>a.x-b.x);let previous=from;
      for(const tap of taps){const id='bus-'+role+'-'+tap.socket;doc.junctions.push({id,x:tap.x,y});wire(previous,id+':p');previous=id+':p';}
      const id='bus-'+role+'-end';doc.junctions.push({id,x:loadX+48,y});wire(previous,id+':p');
      for(const tap of taps)wire('bus-'+role+'-'+tap.socket+':p',tap.socket+':'+role,[{x:tap.x,y:tap.y}]);
    }
    bus(live,'l',-132);bus(neutral,'n',-88);
    for(const suffix of key==='C06'?['','2']:['']){
      const socket=doc.components.find(c=>c.id==='socket'+suffix),load=doc.components.find(c=>c.id==='load'+suffix);
      if(key==='C02'){
        wire('socket:l','switch:a',[{x:207,y:170},{x:270,y:170},{x:270,y:-5}]);wire('switch:b','load:l',[{x:400,y:-5},{x:400,y:74}]);
      }else wire(socket.id+':l',load.id+':l',[{x:socket.x+27,y:socket.y+70},{x:socket.x+75,y:socket.y+70},{x:socket.x+75,y:load.y-26}]);
      wire(socket.id+':n',load.id+':n',[{x:socket.x-27,y:socket.y+112},{x:load.x-115,y:socket.y+112},{x:load.x-115,y:load.y}]);
      if(C.definitions[load.type].ports.some(p=>p.key==='e')&&key!=='C02')wire('socket:e','load:e',[{x:socket.x,y:socket.y-55},{x:load.x-105,y:socket.y-55},{x:load.x-105,y:load.y+26}]);
    }
    return M.validate(doc);
  }
  return Object.freeze({names,questions,create});
});
