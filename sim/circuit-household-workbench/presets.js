(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('../circuit-workbench/circuit-household-components'):root.CircuitHouseholdComponents,node?require('../circuit-workbench/circuit-model'):root.CircuitModel);if(node)module.exports=api;else root.CircuitHouseholdPresets=api;})(globalThis,function(C,M){
  'use strict';
  const names=Object.freeze({empty:'空白工作台',C01:'家庭電路怎樣接',C02:'開關應接哪條線',C03:'地線如何保護人',C04:'漏電保護器為何跳掣',C05:'雙重絕緣多了一層甚麼',C06:'兩件家電為何並聯',C07:'斷路器保護甚麼',C07fuse:'保險絲保護甚麼',C08:'兩條線接到哪裏'});
  const questions=Object.freeze({empty:'取出元件，試試你的接法。',C01:'三條線怎樣連到插座和電器？',C02:'電器停止後，火線是否已經隔離？',C03:'地線如何把金屬外殼接回地？',C04:'哪些回流路徑會令漏電保護器跳掣？',C05:'內層破損後，外層仍隔離甚麼？',C06:'拔開其中一件，另一件會怎樣？',C07:'同一件電器，改小額定電流會怎樣？',C07fuse:'熔絲斷了，合上開關能恢復嗎？',C08:'兩條工作線接到不同孔，電器會怎樣？'});
  function create(key='C01'){
    if(!Object.hasOwn(names,key))throw new Error('不存在的家庭示例');
    const doc=M.empty('household');doc.cables={count:40,length:900,resistance:0};doc.display.fontSize='s';doc.display.values=false;
    const add=(id,type,x,y,params={},label)=>{const c=M.add(doc,type,x,y,params);c.id=id;c.label=label||C.definitions[type].name;return c;};
    const wire=(from,to,via=[])=>{const ends=M.endpoints(doc),a=ends.get(from),b=ends.get(to);return M.connect(doc,from,to,via,via.length||a.x===b.x||a.y===b.y?'free':'auto');};
    if(key==='empty')return M.validate(doc);
    if(key==='C08'){
      add('source','house-mains',-170,-30,{},'市電');add('socket','house-socket',10,-30,{},'插座');add('load','house-insulated',250,-15,{kind:'blender'},'攪拌機');add('earth','house-earth',-160,95);
      wire('source:l','socket:l',[{x:-52,y:-52},{x:-52,y:-100},{x:66,y:-100},{x:66,y:-6}]);wire('source:n','socket:n');
      wire('earth:e','socket:e',[{x:-72,y:95},{x:-72,y:55},{x:10,y:55}]);
      wire('socket:l','load:l',[{x:108,y:-6},{x:108,y:-41}]);wire('socket:n','load:n',[{x:-17,y:105},{x:140,y:105},{x:140,y:-15}]);return M.validate(doc);
    }
    add('source','house-mains',-100,-110,{},'市電');
    if(key==='C01'){
      doc.components[0].x=-200;doc.components[0].y=-120;
      add('meter','house-meter',-30,-120);add('breaker','house-breaker',140,-120,{rating:15});add('socket','house-socket',-40,110,{},'插座');add('load','house-metal',200,110,{kind:'heater'},'熱水器');add('earth','house-earth',-170,100);
      wire('source:l','meter:li');wire('source:n','meter:ni');wire('meter:lo','breaker:li');wire('meter:no','breaker:ni');
      wire('breaker:lo','socket:l',[{x:240,y:-142},{x:240,y:-25},{x:-13,y:-25}]);wire('breaker:no','socket:n',[{x:220,y:-98},{x:220,y:-45},{x:-95,y:-45},{x:-95,y:134}]);
      wire('earth:e','socket:e',[{x:-112,y:30},{x:-40,y:30}]);
    }else{
      const socketY=key==='C08'?85:100;add('socket','house-socket',-60,socketY,{},'插座');
      if(key==='C04'||key==='C07')add('protector',key==='C04'?'house-rcd':'house-breaker',100,-110,key==='C07'?{rating:15}:{},key==='C04'?'漏電保護器':'斷路器');
      if(key==='C07fuse')add('protector','house-fuse',100,-110,{rating:13});
      const protection=doc.components.find(c=>c.id==='protector');
      if(protection&&protection.type!=='house-fuse'){
        wire('source:l','protector:li');wire('source:n','protector:ni');
        wire('protector:lo','socket:l',[{x:205,y:-132},{x:205,y:-25},{x:-33,y:-25}]);wire('protector:no','socket:n',[{x:180,y:-88},{x:180,y:-48},{x:-115,y:-48},{x:-115,y:socketY+24}]);
      }else{
        if(protection){wire('source:l','protector:a');wire('protector:b','socket:l',[{x:215,y:-110},{x:215,y:-35},{x:-33,y:-35}]);}
        else wire('source:l','socket:l',[{x:40,y:-132},{x:40,y:-28},{x:-33,y:-28}]);
        wire('source:n','socket:n',[{x:12,y:-88},{x:12,y:5},{x:-120,y:5},{x:-120,y:socketY+24}]);
      }
      const insulated=['C05','C06','C08'].includes(key),kind=key==='C07'||key==='C07fuse'?'heater':insulated?'blender':'fan';
      add('load',insulated?'house-insulated':'house-metal',180,100,{kind},C.applianceKinds[insulated?'insulated':'metal'][kind].label);
      if(['C03','C04','C07','C07fuse','C08'].includes(key)){add('earth','house-earth',-190,110);wire('earth:e','socket:e',[{x:-132,y:30},{x:-60,y:30}]);}
      if(['C02','C03','C04','C05'].includes(key))add('person','house-person',340,125,{},'人');
      if(key==='C02')add('switch','house-switch',165,-110,{},'開關');
    }
    const socket=doc.components.find(c=>c.id==='socket'),load=doc.components.find(c=>c.id==='load'),lp=C.definitions[load.type].ports;
    if(key==='C02'){
      wire('socket:l','switch:a',[{x:25,y:124},{x:25,y:-110}]);wire('switch:b','load:l',[{x:260,y:-110},{x:260,y:-10},{x:55,y:-10},{x:55,y:load.y-26}]);
    }else wire('socket:l','load:l',[{x:socket.x+75,y:socket.y+24},{x:socket.x+75,y:load.y-26}]);
    wire('socket:n','load:n',[{x:socket.x-27,y:socket.y+112},{x:load.x-115,y:socket.y+112},{x:load.x-115,y:load.y}]);
    if(lp.some(p=>p.key==='e')&&key!=='C02')wire('socket:e','load:e',[{x:socket.x,y:socket.y-75},{x:load.x-105,y:socket.y-75},{x:load.x-105,y:load.y+26}]);
    if(key==='C06'){
      add('socket2','house-socket',-60,340,{},'插座 2');add('load2','house-insulated',180,340,{kind:'fan'},'風扇');
      wire('socket:l','socket2:l',[{x:-10,y:124},{x:-10,y:364}]);wire('socket:n','socket2:n',[{x:-150,y:124},{x:-150,y:364}]);
      wire('socket2:l','load2:l',[{x:15,y:364},{x:15,y:314}]);wire('socket2:n','load2:n',[{x:-87,y:435},{x:65,y:435},{x:65,y:340}]);
    }
    return M.validate(doc);
  }
  return Object.freeze({names,questions,create});
});
