(function(root,factory){const node=typeof module==='object'&&module.exports;if(node)require('../circuit-workbench/circuit-household-components');const api=factory(node?require('../circuit-workbench/circuit-model'):root.CircuitModel);if(node)module.exports=api;else root.CircuitHouseholdPresets=api;})(globalThis,function(M){
  'use strict';
  const experiments=[
    ['H01','市電與三線','量度 L–N、L–PE、N–PE。電壓／電流為有效值；地電勢從回路求解。'],
    ['H02','兩家電並聯','關掉一件家電，另一件仍工作；比較總電流。'],
    ['H03','開關接 L 與 N','開關目前接 N；燈滅仍可能內部帶電。改接 L 比較對地讀值。'],
    ['H04','英式插頭與插座','切換插座正面／背面與插頭針腳／接線面；L 保險絲只切斷 L。'],
    ['H05','選保險絲','2 kW 家電的插頭暫用 3 A；換 5 A／13 A 比較教學曲線。配用須依器具及軟線。'],
    ['H06','拖板過載','三件 2 kW 家電共用 13 A 拖板；孔數增加不增加總載流額定。'],
    ['H07','L–N 短路','低阻短路令過流保護動作；L／N 平衡的短路不觸發 RCCB 漏電機制。'],
    ['H08','外殼漏電、PE 連續','故障電流經外殼及 PE 回源；觀察剩餘電流和保護。'],
    ['H09','外殼故障、PE 斷開','先觀察外殼帶電但沒有漏電回路，再閉合接觸路徑比較。'],
    ['H10','漏電與過載保護','毫安級漏電足以符合所選漏電模型；MCB 按安培級過流判斷。'],
    ['H11','TEST 與斷地','外部 PE 已斷，TEST 仍由內部跨感測支路驅動；TEST 不能證明接地完整。'],
    ['H12','全屋四分路','照明、插座、熱水器、冷氣分路；比較共用 RCCB 和各路 RCBO 停電範圍。'],
    ['H13','環形與放射式','插座仍是並聯；兩側線阻不等，分流也不等。比較放射配置。'],
    ['H14','斷環但仍通電','分別把 L／N／PE 線段設開路，觀察仍有電與線段負擔。'],
    ['H15','L／N 反接與 N–PE 錯接','能運作不代表接法正確；把回流錯接 PE，比較差流。'],
    ['H16','功率與電能','電能按模擬時間積分；暫停不累積。2 kW 理想負載 600 s 為 1/3 kWh。'],
    ['H17','接觸不良','2 Ω 接頭有局部耗散，總電流未必超過上游額定。'],
    ['H18','I 類與 II 類','II 類基本絕緣失效仍有補充絕緣；改成整體失效才建立外殼故障支路。']
  ].map(([id,title,description])=>({id,title,description}));
  function create(id='H01',variant='grouped'){
    if(id!=='blank'&&!experiments.some(e=>e.id===id))throw new Error('未知家庭示例');
    const doc=M.empty('household-rms');doc.cables.count=240;doc.cables.length=1200;
    if(id==='blank')return doc;
    const add=(type,label,x,y,params={})=>{const c=M.add(doc,type,x,y,params);c.label=label;return c;};
    const wire=(a,b,role='L',resistance=.02,rating=32)=>Object.assign(M.connect(doc,a,b),{role,resistance,rating});
    const source=add('hh-source','市電 230 V~ · 50 Hz',0,0);doc.earthReference=source.id+':e';
    const fuse=add('hh-fuse','供電側保險絲',200,0,{rating:60});wire(source.id+':a',fuse.id+':a','L',.02,60);
    const meter=add('hh-energy-meter','全屋 W／kWh',400,0,{range:15000});wire(fuse.id+':b',meter.id+':a','L',.02,60);wire(source.id+':b',meter.id+':c','N',.02,60);
    const isolator=add('hh-isolator','總隔離（非過流保護）',600,0);wire(meter.id+':b',isolator.id+':a','L',.02,60);wire(meter.id+':d',isolator.id+':c','N',.02,60);
    const pe=add('hh-bus','PE 排',600,170,{role:'PE'});wire(source.id+':e',pe.id+':a','PE');
    const feed={L:isolator.id+':b',N:isolator.id+':d',PE:pe.id+':c'};
    function protect(input,type,label,x,y,rating){const c=add(type,label,x,y,{rating});wire(input.L,c.id+':a');const hasN=type!=='hh-mcb';if(hasN)wire(input.N,c.id+':c','N');return {L:c.id+':b',N:hasN?c.id+':d':input.N,PE:input.PE,device:c};}
    function appliance(input,label,x,y,power,params={}){const c=add('hh-appliance',label,x,y,{ratedPower:power,...params});wire(input.L,c.id+':a','L',.02,input.rating??20);wire(input.N,c.id+':b','N',.02,input.rating??20);if(c.params.insulation==='I')wire(input.PE,c.id+':e','PE',.02,input.rating??20);return c;}
    function socket(input,label,x,y){const c=add('hh-socket',label,x,y);wire(input.L,c.id+':a','L',.04,20);wire(input.N,c.id+':c','N',.04,20);wire(input.PE,c.id+':e','PE',.04,20);return c;}
    function plug(s,label,x,y,power,params={}){const c=add('hh-plug','插頭 '+label,x,y);wire(s.id+':b',c.id+':a','L',.01,13);wire(s.id+':d',c.id+':c','N',.01,13);wire(s.id+':f',c.id+':e','PE',.01,13);return appliance({L:c.id+':b',N:c.id+':d',PE:c.id+':f',rating:13},label,x+210,y,power,params);}
    function ring(input,y){
      const sockets=[];let previous=input;
      for(let n=0;n<3;n++){const s=socket(previous,'插座 '+(n+1),1050+n*480,y);sockets.push(s);previous={L:s.id+':a',N:s.id+':c',PE:s.id+':e'};}
      if(variant!=='radial')for(const [role,key]of [['L','a'],['N','c'],['PE','e']])wire(sockets[2].id+':'+key,input[role],role,.08,20);
      const powers=[100,2000,2000];return sockets.map((s,n)=>plug(s,['桌燈','水壺','暖爐'][n],s.x+150,y+190,powers[n]));
    }
    if(id==='H12'){
      const group=variant==='rcbo'?feed:protect(feed,'hh-rccb','共用 RCCB',800,0,60);
      const light=protect(group,variant==='rcbo'?'hh-rcbo':'hh-mcb','照明 · 客廳／睡房',900,-270,6);
      appliance(light,'客廳照明',1300,-380,60,{insulation:'II'});appliance(light,'睡房照明',1550,-260,60,{insulation:'II'});
      const sockets=protect(group,variant==='rcbo'?'hh-rcbo':'hh-mcb','插座環形 · 客廳／廚房',900,100,32);ring(sockets,100);
      for(const [label,power,rating,y]of [['熱水器 · 浴室',3500,20,570],['冷氣機 · 睡房（等效）',1500,16,850]]){const branch=protect(feed,'hh-rcbo',label,900,y,rating),iso=protect(branch,'hh-isolator','雙極隔離',1150,y,rating);appliance(iso,label,1450,y,power);}
      return M.validate(doc);
    }
    const rccb=protect(feed,'hh-rccb','RCCB 60 A／30 mA',800,0,60),branch=protect(rccb,'hh-mcb','插座分路 MCB 32 A',1000,0,32);
    if(['H13','H14'].includes(id)){ring(branch,0);if(id==='H14')doc.wires.find(w=>w.from.endsWith(':a')&&w.to===branch.L).open=true;return M.validate(doc);}
    const s=socket(branch,'英式插座 · 13 A',1200,0),load=plug(s,'水壺（I 類）',1400,0,2000);
    const plugC=doc.components.find(c=>c.type==='hh-plug');
    if(id==='H02')appliance(branch,'第二件家電',1600,330,1000);
    if(id==='H03'){load.params.ratedPower=60;load.label='照明（開關接 N）';const w=doc.wires.find(w=>w.to===load.id+':b'),sw=add('switch','N 上開關',1600,270,{closed:false});w.to=sw.id+':a';wire(sw.id+':b',load.id+':b','N');}
    if(id==='H05')plugC.params.rating=3;
    if(id==='H06'){doc.wires=doc.wires.filter(w=>![load.id+':a',load.id+':b',load.id+':e'].includes(w.to));const strip=add('hh-strip','13 A 共同軟線拖板',1600,0);wire(plugC.id+':b',strip.id+':a','L',.02,13);wire(plugC.id+':d',strip.id+':c','N',.02,13);wire(plugC.id+':f',strip.id+':e','PE',.02,13);for(const [role,key]of [['L','b'],['N','d'],['PE','f']])wire(strip.id+':'+key,load.id+':'+({L:'a',N:'b',PE:'e'})[role],role,.02,13);for(const [n,keys]of [[1,['g','h','i']],[2,['j','k','l']]])appliance({L:strip.id+':'+keys[0],N:strip.id+':'+keys[1],PE:strip.id+':'+keys[2],rating:13},'拖板家電 '+(n+1),1900,n*260,2000);}
    if(id==='H07')Object.assign(load.params,{fault:'short',faultResistance:.1});
    if(['H08','H09','H10'].includes(id))Object.assign(load.params,{fault:'basic',faultResistance:id==='H10'?5000:100});
    if(id==='H09'){load.params.earth=false;const sw=add('switch','接觸路徑開關',1800,280,{closed:false}),body=add('resistor','接觸等效（非人體安全判定）',1600,400,{resistance:1000});wire(load.id+':h',sw.id+':a','signal');wire(sw.id+':b',body.id+':a','signal');wire(body.id+':b',doc.earthReference,'PE');}
    if(id==='H11')load.params.earth=false;
    if(id==='H15'){const l=doc.wires.find(w=>w.to===load.id+':a'),n=doc.wires.find(w=>w.to===load.id+':b');[l.to,n.to]=[n.to,l.to];}
    if(id==='H17')doc.wires.find(w=>w.to===load.id+':a').resistance=2;
    if(id==='H18'){Object.assign(load.params,{insulation:'II',fault:'basic',earth:false});load.label='II 類：補充絕緣仍完整';doc.wires=doc.wires.filter(w=>w.to!==load.id+':e');}
    return M.validate(doc);
  }
  return {experiments,create};
});
