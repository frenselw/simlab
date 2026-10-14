(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry'):root.CircuitRegistry);
  if(node)module.exports=api;else root.CircuitHouseholdComponents=api;
})(globalThis,function(R){
  'use strict';
  const number=(label,unit,value,min,max,step)=>({label,unit,value,min,max,step});
  const choice=(label,value,choices,labels)=>({label,value,choices,labels});
  const closed=()=>choice('開關',true,[false,true],{false:'斷開',true:'閉合'});
  const rating=(value=13)=>number('額定載流量','A',value,1,100,1);
  const two=[{key:'a',x:-65,y:0,label:'L 入'},{key:'b',x:65,y:0,label:'L 出'}];
  const four=[{key:'a',x:-65,y:-32,label:'L 入'},{key:'b',x:65,y:-32,label:'L 出'},{key:'c',x:-65,y:32,label:'N 入'},{key:'d',x:65,y:32,label:'N 出'}];
  const six=[...four,{key:'e',x:-65,y:96,label:'PE 入'},{key:'f',x:65,y:96,label:'PE 出'}];
  const branch=(from,to,resistance=.001,emf=0)=>({from,to,resistance,emf,kind:emf||resistance===0?'branch':'resistor'});
  const active=(c,s)=>c.params.closed!==false&&(!s||s.status==='closed');
  const dual=(c,s)=>active(c,s)?[branch('a','b'),branch('c','d')]:[];
  const residualParams=()=>({residualRating:number('剩餘動作電流','mA',.03,.001,.3,.001),test:choice('內部 TEST 支路',false,[false,true],{false:'關閉',true:'測試'})});
  const types={
    'hh-source':{name:'單相市電',icon:'~',ports:[{key:'a',x:-65,y:0,label:'L'},{key:'b',x:65,y:0,label:'N'},{key:'e',x:65,y:64,label:'PE／源接地'}],primaryParameter:'voltage',params:{closed:closed(),voltage:choice('有效值供電',230,[220,230]),resistance:number('源回路電阻','Ω',.2,.001,10,.01)},dc:c=>[...(c.params.closed?[branch('a','b',c.params.resistance,c.params.voltage)]:[]),branch('b','e')]},
    'hh-fuse':{name:'保險絲',icon:'F',ports:two,params:{rating:rating(),closed:closed()},dc:(c,s)=>active(c,s)?[branch('a','b')]:[]},
    'hh-mcb':{name:'MCB 空氣開關',icon:'MCB',ports:two,params:{rating:rating(32),closed:closed()},dc:(c,s)=>active(c,s)?[branch('a','b')]:[]},
    'hh-isolator':{name:'雙極隔離開關',icon:'2P',ports:four,params:{rating:rating(60),closed:closed()},dc:dual},
    'hh-rccb':{name:'RCCB 漏電保護',icon:'RCCB',ports:four,params:{rating:rating(60),closed:closed(),...residualParams()},dc:(c,s)=>[...dual(c,s),...(active(c,s)&&c.params.test?[branch('a','d',230/.06)]:[])]},
    'hh-rcbo':{name:'RCBO 綜合保護',icon:'RCBO',ports:four,params:{rating:rating(20),closed:closed(),...residualParams()},dc:(c,s)=>[...dual(c,s),...(active(c,s)&&c.params.test?[branch('a','d',230/.06)]:[])]},
    'hh-socket':{name:'英式三孔插座',icon:'13A',ports:six,params:{closed:closed(),rating:rating(),view:choice('插座視角','front',['front','back'],{front:'正面孔位',back:'背面端子'})},dc:c=>[...(c.params.closed?[branch('a','b')]:[]),branch('c','d'),branch('e','f')]},
    'hh-plug':{name:'英式插頭與熔絲',icon:'插頭',ports:six,params:{closed:choice('插接',true,[false,true],{false:'拔出',true:'插入'}),rating:choice('L 保險絲','13',[3,5,13]),view:choice('插頭視角','pins',['pins','wiring'],{pins:'針腳面',wiring:'接線面'})},dc:(c,s)=>c.params.closed?[...(active(c,s)?[branch('a','b')]:[]),branch('c','d'),branch('e','f')]:[]},
    'hh-strip':{name:'三位拖板',icon:'拖板',ports:[...six,...[{key:'g',x:130,y:-32,label:'L 第二孔'},{key:'h',x:130,y:32,label:'N 第二孔'},{key:'i',x:130,y:96,label:'PE 第二孔'},{key:'j',x:195,y:-32,label:'L 第三孔'},{key:'k',x:195,y:32,label:'N 第三孔'},{key:'l',x:195,y:96,label:'PE 第三孔'}]],params:{closed:closed(),rating:rating()},dc:(c,s)=>[...(active(c,s)?[branch('a','b'),branch('b','g'),branch('g','j')]:[]),branch('c','d'),branch('d','h'),branch('h','k'),branch('e','f'),branch('f','i'),branch('i','l')]},
    'hh-bus':{name:'N／PE 接線排',icon:'排',ports:[{key:'a',x:-65,y:0,label:'入'},{key:'b',x:0,y:64,label:'分接'},{key:'c',x:65,y:0,label:'出'}],params:{role:choice('導體身份','N',['N','PE'])},dc:()=>[branch('a','b'),branch('b','c')]},
    'hh-appliance':{name:'家電等效負載',icon:'家電',ports:[{key:'a',x:-65,y:-32,label:'L'},{key:'b',x:65,y:-32,label:'N'},{key:'e',x:-65,y:64,label:'PE'},{key:'h',x:65,y:64,label:'可接觸部位'}],primaryParameter:'ratedPower',params:{closed:closed(),ratedVoltage:number('銘牌電壓','V',230,1,1000,1),ratedPower:number('銘牌功率','W',2000,1,20000,100),insulation:choice('絕緣類別','I',['I','II','nonconductive'],{I:'I 類金屬外殼',II:'II 類雙重絕緣',nonconductive:'非導電外殼'}),earth:choice('PE 連續',true,[false,true],{false:'斷地',true:'連續'}),fault:choice('故障實驗','none',['none','short','basic','double'],{none:'無故障',short:'L–N 短路',basic:'基本絕緣失效',double:'雙重絕緣整體失效'}),faultResistance:{...number('故障路徑電阻','Ω',10000,.1,1e6,100),slider:true}},dc:c=>[...(c.params.closed?[branch('a','b',c.params.ratedVoltage**2/c.params.ratedPower)]:[]),...(c.params.insulation==='I'&&c.params.earth?[branch('e','h')]:[]),...(c.params.fault==='short'?[branch('a','b',c.params.faultResistance)]:[]),...((c.params.insulation==='I'&&['basic','double'].includes(c.params.fault)||c.params.insulation==='II'&&c.params.fault==='double')?[branch('a','h',c.params.faultResistance)]:[])]},
    'hh-energy-meter':{name:'功率及電能計',icon:'kWh',ports:four,meter:true,params:{range:number('功率量程','W',10000,1,1e6,100)},dc:()=>[branch('a','b'),branch('c','d')]}
  };
  types['hh-plug'].params.rating.value=13;
  types['hh-appliance'].portsFor=c=>types['hh-appliance'].ports.filter(p=>p.key==='a'||p.key==='b'||p.key==='h'&&c.params.insulation!=='nonconductive'||p.key==='e'&&c.params.insulation==='I');
  for(const type of ['hh-rccb','hh-rcbo'])types[type].params.residualRating.factor=1000;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(c,r,d){
    const p=c.params,open=p.closed===false||r?.protection&&r.protection.status!=='closed',fill=open?'#f1f5f9':c.type==='hh-appliance'&&r?.power>1?'#fff0b2':'#e7edf2';
    let art=`<rect x="-49" y="-47" width="98" height="94" rx="${d.view==='schematic'?0:8}" fill="${fill}" stroke="#475569" stroke-width="2"/><text y="-16" text-anchor="middle" font-size="17">${types[c.type].icon}</text>`;
    if(['hh-socket','hh-plug'].includes(c.type)){
      const mirror=c.type==='hh-plug'?p.view==='pins':p.view==='back',left=mirror?'L':'N',right=mirror?'N':'L';
      art+=`<text y="-1" text-anchor="middle" font-size="13">E</text><rect x="-3" y="3" width="6" height="${c.type==='hh-plug'?17:10}" fill="#64748b"/><text x="-22" y="26" text-anchor="middle" font-size="14">${left}</text><text x="22" y="26" text-anchor="middle" font-size="14">${right}</text><text y="44" text-anchor="middle" font-size="10">${escape(types[c.type].params.view.labels[p.view])}</text>`;
    }else art+=`<text y="13" text-anchor="middle" font-size="14">${c.type==='hh-source'?p.voltage+' V~':c.type==='hh-appliance'?p.ratedPower+' W':p.rating?p.rating+' A':c.type==='hh-bus'?p.role:'平均功率'}</text>`;
    if(r?.protection&&r.protection.status!=='closed')art+=`<text y="34" text-anchor="middle" font-size="13" fill="#b45309">${r.protection.status==='blown'?'熔斷':'跳掣'}</text>`;
    for(const port of R.localPorts(c))art+=`<path d="M${port.x} ${port.y}L${Math.sign(port.x)*49} ${Math.max(-42,Math.min(42,port.y))}" fill="none" stroke="#64748b" stroke-width="2"/>`;
    return art;
  }
  for(const [type,def]of Object.entries(types))R.register(type,{...def,analysis:'household-rms',bounds:{left:-70,right:type==='hh-strip'?200:70,top:-50,bottom:def.ports.some(p=>p.y===96)?102:70},render:(c,r,d)=>render(c,r,d)});
  const supported=c=>!!types[c.type]||['resistor','switch','ammeter','voltmeter','wattmeter'].includes(c.type)||c.type==='lamp'&&c.params.model==='ideal';
  const protective=c=>['hh-fuse','hh-plug','hh-mcb','hh-rccb','hh-rcbo'].includes(c.type);
  return {types,supported,protective,palette:Object.keys(types).map(type=>({type}))};
});
