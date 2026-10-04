"use strict";
// Source-grounded verification data, not a runtime component/preset extension.
const M = require('../sim/circuit-workbench/circuit-model');
const R = require('../sim/circuit-workbench/component-registry');
const G = require('../sim/circuit-workbench/circuit-routing');
const D = require('../sim/circuit-workbench/circuit-document');
const S = require('../sim/circuit-workbench/circuit-solver');
const textbook = Object.freeze({
  title: '人教版《普通高中教科書 物理 必修第三冊》',
  file: '【人教版】高中必修 第三册物理电子课本.pdf',
  printedPages: [52, 102], pdfPages: [57, 107], pdfOffset: 5,
  chapters: ['第十一章 電路及其應用', '第十二章 電能 能量守恆定律']
});
const inventory = [
  ['sustained', 54, '11.1-2', '電源維持電流', 'equivalent', '可用電源、有限負載表示持續電流；沒有帶電球及電場模型。'],
  ['wire-ratios', 58, '11.2-2', '四段導體串聯、比較電壓', 'native', '可搭電路；長度、截面、材料須先換算成 R，非材料實驗模型。'],
  ['divider-measure', 65, '11.3-7', '分壓接法測電阻率', 'equivalent', '缺三接點滑動變阻器；以下用兩個互補電阻表示兩段。長度／直徑另行計算。'],
  ['water', 67, '11.3-13', '純淨水電阻測量器材', 'equivalent', '電阻代表水樣，A/V 表代表儀表；沒有水槽、電極或電導率參數。'],
  ['series3', 68, '11.4-1', '三電阻串聯', 'native', ''],
  ['parallel3', 68, '11.4-2', '三電阻並聯', 'native', ''],
  ['series2', 69, '11.4-3', '兩電阻串聯', 'native', ''],
  ['parallel2', 69, '11.4-4', '兩電阻並聯', 'native', ''],
  ['g-voltage', 70, '11.4-5', '表頭串聯分壓電阻', 'equivalent', '電流表設定小量程及內阻來代表表頭；未重印電壓刻度。'],
  ['g-shunt', 70, '11.4-6、例題（續頁 71）', '表頭並聯分流電阻', 'equivalent', '電流表代表表頭，另接分流電阻；表頭仍讀表頭電流。'],
  ['series-rheostat', 71, '11.4-7', '限流接法及輸出電壓範圍', 'native', ''],
  ['fixed-divider', 71, '11.4-8', '兩電阻分壓', 'native', ''],
  ['potentiometer', 71, '11.4-9', '三接點分壓器', 'equivalent', '缺三接點滑動變阻器；兩電阻需同步手動調整，沒有單一滑片。'],
  ['meter-error', 71, '11.4-10 甲／乙', '伏安法兩種接法的系統誤差', 'native', ''],
  ['dual-v', 71, '11.4-11', '10 V／100 V 雙量程改裝', 'equivalent', '可搭內部表頭／電阻網絡；原生 V 表固定 5:1，不能設定 10:1 的雙量程。'],
  ['dual-a', 71, '11.4-12', '1 A／0.1 A 雙量程改裝', 'equivalent', '可搭內部表頭／分流電阻網絡；原生 A 表固定 5:1，不能設定 10:1 的雙量程。'],
  ['multimeter-v', 72, '11.5-2', '多用電表測燈泡電壓', 'equivalent', '獨立 V 表可測；沒有多用電表、表筆和擋位。'],
  ['multimeter-a', 73, '11.5-3', '多用電表測燈泡電流', 'equivalent', '獨立 A 表可測；沒有多用電表、表筆和擋位。'],
  ['single-fault', 74, '11.5-7', '電池／開關／燈座故障診斷', 'equivalent', 'V 表代替多用電表；零電動勢、斷開開關、拔線代表故障，沒有燈座接觸模型。'],
  ['mixed', 75, '11-1', '串並聯混合網絡', 'native', ''],
  ['lamp-shunt', 75, '11-2', '變阻器旁路燈泡', 'native', ''],
  ['t-network', 75, '11-3', 'T 型網絡與短接 C/D', 'native', ''],
  ['broken-wire', 76, '11-5', '三條導線中的斷線定位', 'equivalent', '可拔開指定導線並用 V 表檢測；沒有導線內部隱藏斷裂或多用表擋位。'],
  ['corrected', 76, '11-6', '錯誤器材接線的修正', 'native', '測試修正後的伏安法及額定 0.3 A；續操作開啟開關。原圖是待糾正的實物接線。'],
  ['meter-error-b', 76, '11-8 甲／乙', '200 Ω 電阻的伏安法誤差', 'native', ''],
  ['lamp-curve', 77, '11-9 甲／乙', '分壓測小燈泡伏安曲線', 'equivalent', '缺三接點變阻器；熱效應燈是教學近似，另比較原圖讀得的近似曲線。'],
  ['black-box', 77, '11-10', '四個相同電阻的三端黑箱', 'equivalent', '可搭電阻網絡並以測試電源算等效電阻；沒有黑箱遮罩及 Ω 表。'],
  ['micro-g', 77, '11-11 甲／乙', '50 μA 表頭的兩種改裝', 'equivalent', '數值可用內阻 800 Ω 的 A 表及外接電阻驗算；原生最小滿偏值 200 μA，無法呈現 50 μA 滿偏表頭。'],
  ['two-lamp-fault', 77, '11-12', '兩燈串聯故障定位', 'equivalent', '用 V 表及拔線重現直流斷路檢測；沒有多用表或隱藏元件故障。'],
  ['energy', 79, '12.1-1', '一段電路的電功、電功率', 'equivalent', '可求 UI；沒有時間積分的 q、W、Q 顯示。測試列出人工換算。'],
  ['motor220', 82, '12.1 例題（圖 12.1-3 是風扇照片）', '220 V 電動機功率', 'equivalent', '沒有電動機和 AC；用串聯電源與反電動勢／線圈電阻只驗算指定工作點。'],
  ['rice', 82, '12.1-4', '電飯鍋加熱／保溫', 'equivalent', '220 V 單電源超出上限，改兩個 110 V 直流電源；只對純電阻的 RMS 等效功率成立，沒有熱控。'],
  ['power-order', 82, '12.1-5', '四電阻功率排序', 'native', ''],
  ['line-loss', 82, '12.1-6', '輸電線電阻及並聯電熱器', 'equivalent', '導線理想零阻，須外加兩個電阻代表輸電線；220 V 用兩個 110 V 直流源。'],
  ['parallel-dim', 83, '12.2 開頭問題的兩幅實物電路', '多燈並聯因電源內阻而變暗', 'native', ''],
  ['closed', 83, '12.2-1', '閉合電路', 'native', ''],
  ['source-r', 85, '12.2-3／12.2-4、12-1（頁 100）', '電動勢、內阻及能量守恆', 'native', '包含內建內阻及外接電阻兩種表示，以及圖 12-1 的源／負載交點和串聯電池練習。'],
  ['ohmmeter', 87, '12.2-6', '電阻表內部電路', 'equivalent', '可以接出內部電路並讀 I；沒有非均勻 Ω 刻度、倍率及歐姆調零控制。'],
  ['car', 88, '12.2-8', '汽車啟動、兩盞車燈', 'equivalent', '沒有電動機；僅用啟動瞬間的等效電阻比較內阻導致的燈光變化。'],
  ['emf-av', 89, '12.3-1', 'A/V 法測電動勢、內阻', 'native', '可手動記錄 U/I 及擬合；沒有記錄表／自動 U-I 作圖。'],
  ['fruit-v', 91, '12.3-3 乙', '水果電池的 V/R 法', 'equivalent', '電源代水果電池、可調 R 代電阻箱；不包含電極距離、化學及內阻隨時間變化。'],
  ['emf-physical', 92, '12.3-4', '補全實物 A/V 測量電路', 'native', '與 12.3-1 的拓撲相同，測試實物／符號及低量程接孔。'],
  ['orange-a', 92, '12.3-5', '300 μA 電流表測橙汁電池', 'equivalent', '可設定 1.5 mA 高孔／300 μA 低孔及 100 Ω 低孔內阻；電源和可調 R 代電池／電阻箱。'],
  ['motor12', 100, '12-2', '電動機並聯 R₂ 的功率', 'equivalent', '缺電動機；反電動勢＋線圈電阻只驗算已指定的工作點。'],
  ['lighting20', 100, '12-3', '220 V、10／20 盞燈及線損', 'equivalent', '220 V 以兩電源表示，20 支 807 Ω 電阻代燈；220 V 額定燈參數亦超出 120 V 上限。需提高導線庫存。'],
  ['series-graph', 101, '12-4 甲／乙', '串聯變阻器的 U-I 圖', 'native', ''],
  ['constant-i', 101, '12-5', '維持總電流不變的並聯電路', 'equivalent', '沒有恆流源；逐次人工改電源電壓可得到指定工作點，但不是自動維持 I。'],
  ['car-start', 101, '12-6', '10 A／60 A 啟動時車燈功率', 'equivalent', '沒有電動機及啟動暫態；只驗算兩個指定工作點。'],
  ['maximum', 101, '12-7（續頁 102）', '負載／變阻器最大功率', 'native', ''],
  ['fruit-table', 102, '12-8、題目引用 12.3-3', '水果電池實驗數據', 'equivalent', '以固定 E/r 擬合，明列測量／電池漂移的殘差；不宣稱可精確重現所有實驗點。']
].map(([id,page,figure,title,construction,note])=>({id,page,pdfPage:page+5,figure,title,construction,note}));
const unavailable = [
  {page:53,figure:'11.1-1',title:'帶電導體接通後達到靜電平衡',reason:'沒有帶電體、電容或暫態積分。'},
  {page:60,figure:'11.2-5',title:'二極管正、反向伏安特性',reason:'工具箱沒有二極管。'},
  {page:72,pages:[72,73,74,75],figure:'11.5-1／11.5-4／11.5-5／11.5-6、11-4',title:'多用電表、Ω 刻度、倍率和換擋',reason:'工具箱沒有多用電表或歐姆表；獨立 A/V 表不能代替這套操作。'},
  {page:73,figure:'11.5「做一做」',title:'二極管／人體電阻測量',reason:'沒有二極管或人體模型，亦沒有 Ω 擋。'},
  {page:100,figure:'第十二章 A 組第 3 題',title:'LED 顏色、定電流及廣告牌',reason:'沒有 LED、顏色／伏安模型；不可用白熾燈代替。'},
  {page:101,figure:'第十二章 B 組第 3 題',title:'140×5000 個起電斑的電鰻',reason:'原樣 700000 個電源超過 80 元件；750 V 等效源超過單源 120 V。可串聯 7 個等效源只驗算電學等效值。'}
];
// Retain the tested baseline's two-terminal/thermal defaults for historical fixtures.
// Native multi-terminal experiments are verified separately by teaching.test.js.
const part = (key,type,from,to,params={},pose) => ({key,type,ports:{a:from,b:to},params:{...(type==='rheostat'?{terminals:2}:type==='lamp'?{coldRatio:10,linearLoss:0}:{}),...params},pose});
const resistor = (key,from,to,resistance,pose) => part(key,'resistor',from,to,{resistance},pose);
const battery = (key,from,to,voltage,resistance=0,pose) => part(key,'battery',from,to,{voltage,resistance},pose);
const switchPart = (key,from,to,closed=true,pose) => part(key,'switch',from,to,{closed},pose);
function meter(key,type,positive,negative,resistance=0,range=type==='ammeter'?3:15,low=false,pose) {
  return {key,type,ports:{[low?'c':'a']:positive,b:negative},params:{resistance:low?resistance*(type==='ammeter'?1/5:5):resistance,range:low?range*5:range},pose};
}
const check = (component,field,expected,unit,label,absolute=1e-9) => ({kind:'component',component,field,expected,unit,label:label||component+' '+field,absolute});
const ratio = (numerator,nfield,denominator,dfield,expected,unit,label,factor=1) => ({kind:'ratio',numerator,nfield,denominator,dfield,expected,unit,label,factor,absolute:1e-9});
const nodeVoltage = (from,to,expected,label) => ({kind:'voltage',from,to,expected,unit:'V',label,absolute:1e-9});
function circuit(parts) {
  const doc=M.empty(),components={},nets=new Map(),nodes={};doc.cables={count:240,length:1200};doc.display.flow='off';
  parts.forEach((p,i)=>{
    const pose=p.pose|| (p.type==='battery'?{x:120,y:300+i*180,angle:90}:{x:340+(i%4)*250,y:170+Math.floor(i/4)*240,angle:0});
    const c=M.add(doc,p.type,pose.x,pose.y,p.params);c.label=p.key;c.angle=pose.angle||0;components[p.key]=c.id;
    for(const [port,node]of Object.entries(p.ports)){if(node==null)continue;if(!nets.has(node))nets.set(node,[]);nets.get(node).push(c.id+':'+port);}
  });
  // Each net is a tree of actual cables. Geometric crossings never add nodes.
  const endpoints=M.endpoints(doc);
  for(const [key,refs]of nets){nodes[key]=refs[0];const connected=[refs[0]],pending=refs.slice(1);
    while(pending.length){let best=null;for(const from of connected)for(const to of pending){const a=endpoints.get(from),b=endpoints.get(to),distance=Math.hypot(a.x-b.x,a.y-b.y);if(!best||distance<best.distance)best={from,to,distance};}
      const provisional=M.connect(doc,best.from,best.to),points=G.rounded(G.route(doc,provisional),16),length=G.length(points),segments=Math.ceil(length/1100)||1;
      doc.wires.pop();let from=best.from;
      // Long nets use joined finite cables available in the actual toolbox.
      // Do not exploit the document's legacy allowance for oversized wires.
      for(let i=0;i<segments;i++){
        let to=best.to;
        if(i<segments-1){const p=G.along(points,length*(i+1)/segments),j={id:'j'+(doc.junctions.length+1),x:p.x,y:p.y};doc.junctions.push(j);to=j.id+':p';}
        const count=Math.max(1,Math.ceil(length/segments/10)),sample=Array.from({length:count+1},(_,n)=>G.along(points,length*(i+n/count)/segments));
        const w=M.connect(doc,from,to);w.shape='free';w.via=G.resample(sample,10).slice(1,-1).map(({x,y})=>({x,y}));w.length=1200;from=to;
      }
      connected.push(best.to);pending.splice(pending.indexOf(best.to),1);
    }
  }
  doc.cables.count=Math.max(10,doc.wires.length+4);return {doc:M.validate(doc),components,nodes};
}
function makeCase(id,group,title,conditions,parts,checks,{basis='chosen',note='',comparison=null,continuation=null}={}) {
  const built=circuit(parts),first=built.doc.components.find(c=>c.type==='switch')||built.doc.components.find(c=>c.type==='resistor')||built.doc.components.find(c=>c.type==='rheostat')||built.doc.components.find(c=>c.type==='lamp');
  const legal=continuation||(first?{id:first.id,param:first.type==='switch'?'closed':first.type==='rheostat'?'position':'resistance',value:first.type==='switch'?!first.params.closed:first.type==='rheostat'?(first.params.position<.5?.75:.25):first.params.resistance*1.1}:null);
  return {id,group,title,conditions,basis,note,comparison,...built,checks,continuation:legal};
}
function fit(rows) {
  const n=rows.length,sx=rows.reduce((s,p)=>s+p[0],0),sy=rows.reduce((s,p)=>s+p[1],0),sxx=rows.reduce((s,p)=>s+p[0]**2,0),sxy=rows.reduce((s,p)=>s+p[0]*p[1],0);
  const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx);return {E:(sy-slope*sx)/n,r:-slope};
}
function read(one,analysis,spec) {
  if(spec.kind==='component')return analysis.components[one.components[spec.component]][spec.field];
  if(spec.kind==='ratio')return (spec.factor??1)*analysis.components[one.components[spec.numerator]][spec.nfield]/analysis.components[one.components[spec.denominator]][spec.dfield];
  if(spec.kind==='voltage')return analysis.potentials[one.nodes[spec.from]]-analysis.potentials[one.nodes[spec.to]];
  throw new Error('Unknown textbook observation');
}
function observe(one,analysis) {
  return one.checks.map(spec=>{const actual=read(one,analysis,spec),error=actual===null?null:Math.abs(actual-spec.expected),tolerance=spec.absolute+1e-7*Math.abs(spec.expected);return {...spec,actual,error,tolerance,pass:Number.isFinite(actual)&&error<=tolerance};});
}
function cases() {
  const out=[],add=(...args)=>out.push(makeCase(...args));
  const p=(rs)=>1/rs.reduce((s,r)=>s+1/r,0);
  // Unspecified textbook circuits receive clearly disclosed test values.
  add('sustained','sustained','電源維持電流','E=6 V，有限負載 R=12 Ω。',[battery('E','p','n',6),resistor('H','p','n',12)],[check('H','current',.5,'A'),check('H','voltage',6,'V')],{basis:'equivalent',note:'H 含 12 Ω，不能把理想零阻導線直接短接理想電源當作持續電流。'});
  for(const position of [0,.25,1]){
    const rs=[10,20,5,15],I=6/(50+20*position),parts=[battery('E','p','n',6),switchPart('S','p','q'),part('R','rheostat','q','r',{resistance:20,position})];
    rs.forEach((r,i)=>parts.push(resistor(['a','b','c','d'][i],i?'m'+i:'r',i===3?'n':'m'+(i+1),r)));
    rs.forEach((_,i)=>parts.push(meter('V'+(i+1),'voltmeter',i?'m'+i:'r',i===3?'n':'m'+(i+1))));
    add('wire-ratios-'+position,'wire-ratios','四段導體電壓比','E=6 V；Ra/Rb/Rc/Rd=10/20/5/15 Ω；變阻器 20 Ω×'+position,parts,rs.flatMap((r,i)=>[check(['a','b','c','d'][i],'current',I,'A'),check('V'+(i+1),'reading',I*r,'V')]).concat([ratio('V2','reading','V1','reading',2,'','Ub/Ua'),ratio('V3','reading','V1','reading',.5,'','Uc/Ua')]));
  }
  for(const [group,rs,parallel]of [['series3',[10,20,30],false],['parallel3',[10,20,30],true],['series2',[10,20],false],['parallel2',[10,20],true]]){
    const parts=[battery('E','p','n',6)],I=6/(parallel?p(rs):rs.reduce((s,r)=>s+r,0));
    rs.forEach((r,i)=>parts.push(resistor('R'+(i+1),parallel?'p':i?'m'+i:'p',parallel?'n':i===rs.length-1?'n':'m'+(i+1),r,{x:360+i*230,y:parallel?200+i*180:200,angle:0})));
    add(group,group,parallel?'並聯電阻':'串聯電阻','E=6 V；R='+rs.join('/')+' Ω',parts,[check('E','current',-I,'A','總電流（電源 a→b）'),...rs.flatMap((r,i)=>[check('R'+(i+1),'voltage',parallel?6:I*r,'V'),check('R'+(i+1),'power',parallel?36/r:I*I*r,'W')])]);
  }
  for(const position of [0,.25,.5,.75,1]){
    const I=6/(10+20*position);
    add('series-rheostat-'+position,'series-rheostat','限流接法掃描','U=6 V；R=10 Ω，R1=20 Ω，滑片比例 '+position,[battery('E','p','n',6),meter('A','ammeter','p','q'),part('R1','rheostat','q','m',{resistance:20,position}),resistor('R','m','n',10)],[check('A','reading',I,'A'),check('R','voltage',I*10,'V'),check('R1','resistance',20*position,'Ω')]);
  }
  add('fixed-divider','fixed-divider','固定電阻分壓','U=12 V，R1=10 Ω、R2=20 Ω。',[battery('E','p','n',12),resistor('R2','p','m',20),resistor('R1','m','n',10),meter('V1','voltmeter','m','n')],[check('V1','reading',4,'V'),ratio('R1','voltage','E','voltage',1/3,'','U1/U')]);
  for(const t of [0,.25,.5,.75,1]){
    const total=20,low=total*t,high=total-low,parts=[battery('E','p','n',6)];
    // At an endpoint use a zero-ohm rheostat, not an invalid zero resistor.
    parts.push(part('upper','rheostat','p','m',{resistance:total,position:1-t}),part('lower','rheostat','m','n',{resistance:total,position:t}),meter('V','voltmeter','m','n'));
    add('potentiometer-'+t,'potentiometer','三接點分壓的兩電阻等效','U=6 V，總電阻 20 Ω，下段比例 '+t,parts,[check('V','reading',6*t,'V'),check('E','current',-.3,'A')],{basis:'equivalent',note:'這是同步改兩電阻的等效，不是可用單一滑片拖動的原生三接點元件。'});
    const load=100,ra=.1,rv=1000,Rp=p([load,rv]);
    const ps=[battery('E','p','n',6),switchPart('S','n','z'),part('upper','rheostat','p','m',{resistance:20,position:1-t}),part('lower','rheostat','m','z',{resistance:20,position:t}),resistor('Rx','p','x',load),meter('V','voltmeter','p','x',rv),meter('A','ammeter','x','m',ra)];
    // high=0 shorts the load side; the parallel formula must use zero, not Infinity.
    const expectedLeft=high===0?0:p([high,Rp+ra]),expectedI=6/(expectedLeft+low),expectedUr=expectedI*expectedLeft/(Rp+ra)*Rp,expectedA=expectedI*expectedLeft/(Rp+ra);
    add('divider-measure-'+t,'divider-measure','分壓測電阻率的等效接法','E=6 V；變阻器總 20 Ω，左段比例 '+(1-t)+'；Rx=100 Ω；RA=0.1 Ω；RV=1 kΩ。',ps,[check('V','reading',expectedUr,'V'),check('A','reading',expectedA,'A'),check('Rx','power',expectedUr**2/load,'W')],{basis:'equivalent',note:'原圖 11.3-7 是分壓接法。用上下兩段電阻，沒有三接點滑片、長度或直徑工具。'});
  }
  add('water','water','純淨水樣的電阻等效','E=1.5 V；水樣等效 10 kΩ；A 表 300 μA/100 Ω（低孔）；V 表理想。',[battery('E','p','n',1.5),resistor('water','p','q',10000),meter('A','ammeter','q','n',100,.0003,true),meter('V','voltmeter','p','q',0,3,true)],[check('A','reading',1.5/10100,'A'),check('A','range',.0003,'A'),check('A','resistance',100,'Ω'),check('V','reading',1.5*10000/10100,'V')],{basis:'equivalent'});
  for(const [group,rx,ra,rv,U]of [['meter-error',87.4,.1,1000,6],['meter-error-b',200,10,2000,6]])for(const internal of [false,true]){
    const parts=[battery('E','p','n',U),resistor('Rx','q','n',rx),meter('A','ammeter','p','q',ra),meter('V','voltmeter',internal?'p':'q','n',rv)];
    const effective=internal?rx+ra:p([rx,rv]),i=internal?U/(rx+ra):U/(ra+effective),v=internal?U:i*effective;
    add(group+'-'+(internal?'internal':'external'),group,internal?'電流表內接':'電流表外接','Rx='+rx+' Ω；RA='+ra+' Ω；RV='+rv+' Ω；測試 U='+U+' V。',parts,[check('A','reading',i,'A'),check('V','reading',v,'V'),ratio('V','reading','A','reading',effective,'Ω','伏安法測得 R')],{basis:'textbook',note:'Rx、RA、RV 是教材原值；電源電壓自行選 6 V，電阻誤差與這個測試電壓無關。對應 '+(group==='meter-error'?'11.4-10 '+(internal?'乙':'甲'):'11-8 '+(internal?'甲':'乙'))+'。'});
  }
  add('g-voltage','g-voltage','表頭改裝電壓表','Rg=500 Ω、Ig=1 mA、串聯電阻 9500 Ω，端口 U=10 V。',[battery('E','p','n',10),meter('G','ammeter','p','m',500,.001),resistor('R','m','n',9500)],[check('G','reading',.001,'A'),check('G','voltage',.5,'V'),check('R','voltage',9.5,'V')],{basis:'chosen',note:'圖 11.4-5 無指定數值，採下一頁雙量程題的 10 V 設定。'});
  const shunt=.001*30/(.6-.001);
  add('g-shunt','g-shunt','0.6 A 電流表改裝例題','教材：Rg=30 Ω、Ig=1 mA、I=0.6 A；分流 R=0.03/0.599 Ω。',[battery('E','p','n',.03),meter('G','ammeter','p','n',30,.001),resistor('shunt','p','n',shunt)],[check('G','reading',.001,'A'),check('shunt','current',.599,'A'),check('E','current',-.6,'A'),check('shunt','resistance',shunt,'Ω')],{basis:'textbook',note:'精確值 R=0.05008347 Ω，等效 RA=0.05 Ω；教材的 5×10⁻² Ω 為有效數字近似。'});
  for(const U of [10,100]){
    const parts=[battery('E','p','n',U),meter('G','ammeter','p','a',500,.001),resistor('R1','a','b',9500),resistor('R2','b','c',90000),switchPart('tap','n',U===10?'b':'c')];
    add('dual-v-'+U,'dual-v','雙量程 V 表內部網絡','Rg=500 Ω、Ig=1 mA；R1=9500 Ω、R2=90000 Ω；接 '+U+' V 端。',parts,[check('G','reading',.001,'A'),check('E','current',-.001,'A')],{basis:'textbook',note:'表頭顯示 1 mA 滿偏；不是原生 10/100 V 錶盤。'});
  }
  // Ayrton shunt: R1+R2=Ig*Rg/(I_low-Ig), R1 sets the high-current tap.
  function ayrton(Ig,Rg,high,low){const sum=Ig*Rg/(low-Ig),r1=Ig*(Rg+sum)/high;return {r1,r2:sum-r1};}
  for(const [group,Ig,Rg,high,low]of [['dual-a',.002,200,1,.1],['micro-g',.00005,800,.01,.001]]){
    const rs=ayrton(Ig,Rg,high,low);
    for(const large of [true,false]){
      const total=large?high:low,U=large?(Ig*(Rg+rs.r2)):Ig*Rg;
      const parts=[battery('E',large?'b':'c','a',U),meter('G','ammeter','c','a',Rg,Math.max(Ig,.001)),resistor('R1','a','b',rs.r1),resistor('R2','b','c',rs.r2)];
      add(group+'-ayrton-'+total,group,'通用分流雙量程內部網絡','Rg='+Rg+' Ω、Ig='+Ig+' A；R1='+rs.r1+' Ω、R2='+rs.r2+' Ω；總電流 '+total+' A。',parts,[check('G','reading',Ig,'A'),check('E','current',-total,'A')],{basis:'textbook',note:group==='micro-g'?'G 用 1 mA 數字表代表，50 μA 滿偏刻度不能呈現。':'接線選擇原圖的不同外部端點；原生 A 表的 5:1 量程不是這個內部網絡。'});
    }
  }
  for(const total of [.001,.01]){
    const Ig=.00005,Rg=800,rs=Ig*Rg/(total-Ig);
    add('micro-g-simple-'+total,'micro-g','兩個獨立分流電阻換擋','Rg=800 Ω、Ig=50 μA，量程 '+total+' A；選中分流電阻 '+rs+' Ω。',[battery('E','p','n',.04),meter('G','ammeter','p','n',800,.001),resistor('R','p','n',rs)],[check('G','reading',Ig,'A'),check('E','current',-total,'A')],{basis:'textbook',note:'另一擋斷開，相當於圖 11-11 乙；缺原生雙擲開關及 50 μA 錶盤。'});
  }
  for(const [group,type]of [['multimeter-v','voltmeter'],['multimeter-a','ammeter']]){
    const parts=[battery('E','p','n',3),switchPart('S','p','q'),part('L','lamp','q',type==='ammeter'?'m':'n',{resistance:12,ratedVoltage:3}),meter('meter',type,type==='ammeter'?'m':'q','n')];
    add(group,group,'用獨立電表測燈泡','E=3 V、R燈=12 Ω，理想 A/V。',parts,[check('meter','reading',type==='ammeter'?.25:3,type==='ammeter'?'A':'V'),check('L','power',.75,'W')],{basis:'equivalent'});
  }
  for(const fault of ['normal','battery','switch','socket']){
    const parts=[battery('E','p','n',fault==='battery'?0:1.5),switchPart('S','p','q',fault!=='switch'),part('L','lamp','q',fault==='socket'?'loose':'n',{resistance:6,ratedVoltage:1.5}),meter('Vs','voltmeter','p','q',0,2.5),meter('Vl','voltmeter','q','n',0,2.5),meter('Ve','voltmeter','p','n',0,2.5)];
    add('single-fault-'+fault,'single-fault','單燈故障：'+fault,'E=1.5 V、R燈=6 Ω；'+fault,parts,[check('L','current',fault==='normal'?.25:0,'A'),check('Ve','reading',fault==='battery'?0:1.5,'V'),check('Vs','reading',fault==='switch'?1.5:0,'V'),check('Vl','reading',fault==='normal'||fault==='socket'?1.5:0,'V')],{basis:'equivalent'});
  }
  const small=p([1000,5]),upper=small+2000,I=10/(p([upper,10]));
  add('mixed','mixed','教材混聯網絡','U=10 V；R1=1000 Ω，R2=5 Ω，R3=2000 Ω，R4=10 Ω。',[battery('E','p','n',10),resistor('R1','p','m',1000),resistor('R2','p','m',5),resistor('R3','m','n',2000),resistor('R4','p','n',10)],[check('E','current',-I,'A','干路電流（a→b）'),check('R4','current',1,'A'),check('R3','current',10/upper,'A'),check('R1','voltage',10*small/upper,'V')],{basis:'textbook'});
  for(const position of [.1,.5,1]){
    const rp=p([12,20*position]),u=6*rp/(10+rp);
    add('lamp-shunt-'+position,'lamp-shunt','可調旁路與燈泡亮度','E=6 V；R0=10 Ω、R燈=12 Ω，旁路 R1=20 Ω×'+position,[battery('E','p','n',6),resistor('R0','p','m',10),part('L','lamp','m','n',{resistance:12}),part('R1','rheostat','m','n',{resistance:20,position})],[check('L','voltage',u,'V'),check('L','power',u*u/12,'W')]);
  }
  for(const short of [false,true]){
    const parts=[battery('E','p','n',100),resistor('R1','p','m',10),resistor('R2','m','c',120),resistor('R3','m','n',40)];if(short)parts.push(switchPart('CD','c','n'));
    const effective=short?10+p([120,40]):50;
    add('t-network-'+short,'t-network','T 型網絡 '+(short?'短接 C/D':'C/D 開路'),'R1=10 Ω、R2=120 Ω、R3=40 Ω；電源 100 V。',parts,[check('E','current',-100/effective,'A'),nodeVoltage('c','n',short?0:80,'C-D 電壓'),ratio('E','voltage','E','current',effective,'Ω','A-B 等效電阻（取電源向外 I）',-1)],{basis:'textbook'});
  }
  for(const broken of ['AB','CD','EF']){
    const parts=[battery('E','A','F',6),switchPart('AB','A','B',broken!=='AB'),resistor('R1','B','C',50),switchPart('CD','C','D',broken!=='CD'),resistor('R2','D','E',30),switchPart('EF','E','F',broken!=='EF')];
    const before=broken==='AB'?[]:broken==='CD'?['B','C']:['B','C','D','E'];
    add('broken-wire-'+broken,'broken-wire','斷線定位 '+broken,'U=6 V、R1=50 Ω、R2=30 Ω。開關代表指定線的斷路。',parts,[check('R1','current',0,'A'),...['B','C','D','E','F'].map(n=>nodeVoltage('A',n,before.includes(n)?0:6,'A-'+n+' 電壓'))],{basis:'equivalent'});
  }
  add('corrected','corrected','修正接線後 0.3 A 測量','U=12 V、Rx=25 Ω、限流 R=15 Ω；理想 0.6 A 小孔／15 V 大孔。',[battery('E','p','n',12),part('R','rheostat','p','q',{resistance:30,position:.5}),resistor('Rx','q','m',25),meter('A','ammeter','m','z',0,.6,true),switchPart('S','z','n'),meter('V','voltmeter','q','m',0,15)],[check('A','reading',.3,'A'),check('V','reading',7.5,'V'),check('Rx','power',2.25,'W')],{basis:'textbook',note:'額定 I、標稱 R 是教材原值；12 V、15 Ω 是明列的試驗工作點。V 表選 15 V 孔避免 7.5 V 超量程。'});
  {
    // Full external-A experiment at the rated point, including the book's
    // 0.1 Ω / 3 kΩ meter burdens and a 20 Ω (chosen) divider equivalent.
    const u=2.5,il=.43,iv=u/3000,ia=il+iv,up=u+.1*ia,total=20,
      b=3+ia*total,top=(b-Math.sqrt(b*b-4*ia*total*(3-up)))/(2*ia),bottom=total-top,source=ia+up/bottom;
    add('lamp-measure-rated','lamp-curve','小燈泡分壓實驗的額定工作點',
      '教材 E=兩節乾電池（取 3 V），A 內阻 0.1 Ω、量程 0.6 A，V 內阻 3 kΩ、量程 3 V；自選 20 Ω 分壓器拆成兩個互補 R；圖估 2.5 V／0.43 A。',
      [battery('E','p','n',3),switchPart('S','p','s'),resistor('Rtop','s','q',top),resistor('Rbottom','q','n',bottom),meter('A','ammeter','q','m',.1,.6,true),part('L','lamp','m','n',{resistance:u/il,ratedVoltage:u,model:'thermal'}),meter('V','voltmeter','m','n',3000,3,true)],
      [check('V','reading',u,'V'),check('A','reading',ia,'A'),check('L','current',il,'A'),check('L','power',u*il,'W'),check('E','current',-source,'A'),check('A','power',ia*ia*.1,'W')],
      {basis:'equivalent',note:'保留教材電表內阻和外接拓撲；兩段變阻器只是額定位置的等效，不具備三接點滑片。燈泡額定點用來校準，不能證明中間曲線符合。'});
  }
  for(const U of [0,.5,1,1.5,2,2.5]){
    const ratedI=.43,hot=2.5/ratedI,parts=[battery('E','p','n',U),part('L','lamp','p','m',{resistance:hot,ratedVoltage:2.5,model:'thermal'}),meter('A','ammeter','m','n',0,.6,true),meter('V','voltmeter','p','m',0,3,true)];
    const checks=[check('V','reading',U,'V')];if(U===0||U===2.5)checks.push(check('A','reading',U===0?0:ratedI,'A'));
    // Magnified source plot: U=0..3 V, I=0..0.6 A. Read to 0.01 A;
    // the 0.02 A comparison band is deliberately wider than one minor division.
    const graph={.5:.17,1:.28,1.5:.35,2:.40,2.5:.43};
    add('lamp-curve-'+U,'lamp-curve','熱效應燈曲線工作點 '+U+' V','教材額定 2.5 V；原圖額定電流約 0.43 A，校準熱態 R=2.5/0.43 Ω。電源直接供給工作點。',parts,checks,{basis:'equivalent',note:'未加入分壓器；沒有圖表掃描功能。放大原圖估讀至 0.01 A，以 ±0.02 A 比較，不視為精密實驗數據。',comparison:U>0?{component:'A',field:'reading',reported:graph[U],absolute:.02,unit:'A',source:'放大圖 11-9 乙估讀'}:null});
  }
  for(const [from,to,expected]of [['1','2',1],['2','3',1.5],['1','3',2.5]]){
    add('black-box-'+from+to,'black-box','三端黑箱 '+from+'/'+to,'四個相同 1 Ω 電阻：1–2 為 1 Ω；2–3 為 1 Ω＋(1 Ω∥1 Ω)。測試源 1 V。',[battery('test',from,to,1),resistor('R1','1','2',1),resistor('R2','2','m',1),resistor('R3','m','3',1),resistor('R4','m','3',1)],[check('test','current',-1/expected,'A'),ratio('test','voltage','test','current',expected,'Ω','等效電阻（向外電流）',-1)],{basis:'textbook',note:'R=1 Ω 由三個測得值解出；不是在 Ω 表上直接讀取。'});
  }
  for(const gap of ['normal','L1','L2']){
    const parts=[battery('E','A','B',6),switchPart('S','A','F'),part('L2','lamp','F','E',{resistance:12}),switchPart('gapL2','E','D',gap!=='L2'),part('L1','lamp','D','C',{resistance:12}),switchPart('gapL1','C','m',gap!=='L1'),part('R','rheostat','m','B',{resistance:20,position:.5})];
    add('two-lamp-fault-'+gap,'two-lamp-fault','兩燈故障 '+gap,'E=6 V；兩燈各 12 Ω，變阻器 10 Ω。故障以開關斷路表示。',parts,[check('L1','current',gap==='normal'?6/34:0,'A'),check('L2','current',gap==='normal'?6/34:0,'A'),nodeVoltage('A','B',6,'A-B 電壓'),nodeVoltage('C','m',gap==='L1'?6:0,'L1 接口電壓'),nodeVoltage('E','D',gap==='L2'?6:0,'L2 接口電壓')],{basis:'equivalent'});
  }
  add('energy','energy','電功、焦耳熱與 W 表','E=12 V、R=6 Ω；理想 W 表；另以 t=10 s 計算 W=240 J。',[battery('E','p','n',12),{key:'W',type:'wattmeter',ports:{a:'p',b:'q',c:'q',d:'n'},params:{}},resistor('R','q','n',6)],[check('R','power',24,'W'),check('W','reading',24,'W'),check('R','current',2,'A')]);
  for(const closed of [false,true]){
    const r1=30,load=closed?30:r1+30,I=220/load;
    add('rice-'+closed,'rice','電飯鍋 '+(closed?'加熱':'保溫'),'教材 U=220 V；自行選 R2=30 Ω，推得 R1=R2=30 Ω，使開路總功率為加熱一半。',[battery('E1','p','e',110),battery('E2','e','n',110),resistor('R1','p','m',r1),switchPart('S','p','m',closed),resistor('R2','m','n',30)],[check('R2','current',I,'A'),check('R2','power',I*I*30,'W'),check('E1','sourcePower',110*I,'W'),check('E2','sourcePower',110*I,'W'),check('R1','power',closed?0:I*I*r1,'W')],{basis:'equivalent',note:'原題要的是整個電飯鍋的功率，保溫時須算 R1+R2；不能只比較 R2 功率。兩個 110 V 直流源只作純電阻 RMS 等效。'});
  }
  const eq=p([50,25]),it=10/(25+eq+50),vbc=it*eq;
  add('power-order','power-order','四電阻功率排序','RA=RC=10²/4=25 Ω；RB=RD=10²/2=50 Ω；試驗 U=10 V。',[battery('E','p','n',10),resistor('RA','p','a',25),resistor('RB','a','b',50),resistor('RC','a','b',25),resistor('RD','b','n',50)],[check('RA','power',it*it*25,'W'),check('RB','power',vbc*vbc/50,'W'),check('RC','power',vbc*vbc/25,'W'),check('RD','power',it*it*50,'W')],{basis:'textbook',note:'規格是教材原值；端口電壓未給定，自行選 10 V。功率排序不隨所選 U 改變。'});
  for(const closed of [false,true]){
    const load=closed?p([30,40]):30,I=220/(10+load),u=I*load;
    add('line-loss-'+closed,'line-loss','輸電線與電熱器 '+(closed?'A+B':'只有 A'),'U=220 V；每條線 5 Ω；RA=30 Ω、RB=40 Ω。',[battery('E1','p','e',110),battery('E2','e','n',110),resistor('line1','p','q',5),resistor('A','q','m',30),resistor('B','q','z',40),switchPart('S','z','m',closed),resistor('line2','m','n',5)],[check('A','voltage',u,'V'),check('A','power',u*u/30,'W'),check('B','power',closed?u*u/40:0,'W'),check('line1','power',I*I*5,'W'),check('E1','current',-I,'A')],{basis:'equivalent'});
  }
  for(const count of [1,4]){
    const E=3,r=1,Rl=6,u=E*(Rl/count)/(r+Rl/count),parts=[battery('E','p','n',E,r),switchPart('S','p','q')];for(let i=1;i<=count;i++)parts.push(part('L'+i,'lamp','q','n',{resistance:Rl,ratedVoltage:3},{x:480,y:180+i*180,angle:0}));
    add('parallel-dim-'+count,'parallel-dim','相同電源接 '+count+' 盞燈','E=3 V、r=1 Ω；各燈 6 Ω，恆阻模型。',parts,[check('L1','voltage',u,'V'),check('L1','power',u*u/Rl,'W'),check('E','internalPower',(E/(r+Rl/count))**2*r,'W')]);
  }
  for(const closed of [false,true])for(const explicitR of [false,true]){
    const parts=[battery('E','p','n',6,explicitR?0:2),resistor('R','q','z',10),switchPart('S','p','q',closed),meter('V','voltmeter','p','n')];if(explicitR)parts.push(resistor('r','z','n',2));else parts.push(switchPart('lead','z','n'));
    const I=closed?.5:0;
    add('closed-'+closed+'-'+explicitR,explicitR?'source-r':'closed','閉合電路 '+(closed?'接通':'斷開')+(explicitR?'、外接 r':'、內建 r'),'E=6 V、r=2 Ω、R=10 Ω。',parts,[check('E','current',-I,'A'),check('R','power',I*I*10,'W'),check('V','reading',explicitR?6:6-I*2,'V'),check('E','internalPower',explicitR?0:I*I*2,'W')],{note:explicitR?'V 表跨理想 E，其讀數是 E；整個電源（E+r）路端電壓另讀 R 的端壓。':''});
  }
  for(const short of [false,true]){
    const parts=[battery('E','p','n',3.85,.23),switchPart('short','p','n',short)];
    add('short-'+short,'closed',short?'鋰電池短路':'鋰電池開路','教材 E=3.85 V、r=0.23 Ω。',parts,[check('E','current',short?-3.85/.23:0,'A'),check('E','voltage',short?0:3.85,'V'),check('E','internalPower',short?3.85**2/.23:0,'W')],{basis:'textbook'});
  }
  for(const arrangement of ['one','parallel','series']){
    const ext=arrangement==='parallel'?p([4,6]):arrangement==='series'?10:4,parts=[battery('E','p','n',4.5,.5),resistor('R4','p',arrangement==='series'?'m':'n',4)];if(arrangement!=='one')parts.push(resistor('R6',arrangement==='series'?'m':'p','n',6));
    add('load-voltage-'+arrangement,'source-r','並／串接後路端電壓','教材 E=4.5 V，初始 R=4 Ω、U=4 V，得 r=0.5 Ω；新增 6 Ω '+arrangement,parts,[check('E','voltage',4.5*ext/(ext+.5),'V'),check('E','current',-4.5/(ext+.5),'A')],{basis:'textbook'});
  }
  for(const cells of [2,4,5]){
    const voltage=cells===2?1.5:1.5,r=cells===2?1.6:1,load=cells===2?8.8:60,extra=cells===5?10:0,parts=[];
    for(let i=0;i<cells;i++)parts.push(battery('E'+(i+1),i===0?'p':'b'+i,i===cells-1?'n':'b'+(i+1),voltage,r,{x:160,y:150+i*160,angle:90}));parts.push(resistor('load','p',extra?'m':'n',load));if(extra)parts.push(resistor('extra','m','n',extra));
    const I=cells*voltage/(cells*r+load+extra);
    add('cells-'+cells,'source-r','串聯 '+cells+' 節電池','教材：'+(cells===2?'2.2 V／0.25 A 燈泡，反推每節 r=1.6 Ω。':'每節 1.5 V／1 Ω，6 V／0.1 A 負載。')+(extra?'加 10 Ω 分壓。':''),parts,[check('load','current',I,'A'),check('load','voltage',I*load,'V'),check('E1','internalPower',I*I*r,'W')],{basis:'textbook'});
  }
  for(const rx of [0,1500,3000,15000]){
    const Rg=100,r=10,R1=1390,Romega=1500,parts=[battery('E','p','n',1.5,r),meter('G','ammeter','p','g',Rg,.001),part('R1','rheostat','g','q',{resistance:R1,position:1}),part('Rx','rheostat','q','n',{resistance:Math.max(1,rx),position:rx?1:0})];
    add('ohmmeter-'+rx,'ohmmeter','Ω 表內部接入 '+rx+' Ω','E=1.5 V、r=10 Ω、Rg=100 Ω、R1=1390 Ω；RΩ=1500 Ω，Ig=1 mA。',parts,[check('G','reading',1.5/(Romega+rx),'A'),check('Rx','resistance',rx,'Ω')],{basis:'equivalent',note:'只驗算 I=E/(RΩ+Rx)，讀數仍是 A；原生沒有 Ω 盤或倍率。'});
  }
  for(const group of ['emf-av','emf-physical'])for(const load of [2,5,10,20]){
    const E=1.5,r=.5,I=E/(r+load),parts=[battery('E','p','n',E,r),switchPart('S','p','q'),part('R','rheostat','q','m',{resistance:20,position:load/20}),meter('A','ammeter','m','n',0,group==='emf-physical'?.6:3,group==='emf-physical'),meter('V','voltmeter','q','n',0,3,true)];
    add(group+'-'+load,group,'A/V 法採樣 R='+load+' Ω','E=1.5 V、r=0.5 Ω；理想 A/V；R='+load+' Ω。',parts,[check('A','reading',I,'A'),check('V','reading',E-r*I,'V'),check('E','sourcePower',E*I,'W')]);
  }
  for(const load of [2,5,10,20]){
    const E=1.5,r=.5,ra=.1,rv=1000,U=E/(1+r*(1/(load+ra)+1/rv)),I=U/(load+ra);
    add('emf-loaded-'+load,'emf-av','含電表內阻的電池量測','E=1.5 V、r=0.5 Ω、RA=0.1 Ω、RV=1000 Ω（均用低孔）；R='+load+' Ω。',[battery('E','p','n',E,r),part('R','rheostat','p','m',{resistance:20,position:load/20}),meter('A','ammeter','m','n',ra,.6,true),meter('V','voltmeter','p','n',rv,3,true)],[check('A','reading',I,'A'),check('V','reading',U,'V'),check('E','current',-(I+U/rv),'A')],{note:'以電流表讀值 I 作圖時 E測=E/(1+r/RV)，r測=r/(1+r/RV)，可重現測量系統誤差。'});
  }
  const leadI=[1.72,1.35,.98,.63,.34],leadU=[1.88,1.92,1.93,1.98,1.99],leadFit=fit(leadI.map((i,n)=>[i,leadU[n]]));
  leadI.forEach((i,n)=>{const load=leadU[n]/i;
    add('lead-cell-table-'+n,'emf-av','蓄電池五點實驗表 '+(n+1),'教材表 1：I='+i+' A、U='+leadU[n]+' V；固定參數擬合 E='+leadFit.E+' V、r='+leadFit.r+' Ω，R=U/I。',[battery('E','p','n',leadFit.E,leadFit.r),resistor('R','p','m',load),meter('A','ammeter','m','n'),meter('V','voltmeter','p','n')],[check('V','reading',leadFit.E*load/(load+leadFit.r),'V'),check('A','reading',leadFit.E/(load+leadFit.r),'A')],{basis:'experimental-fit',note:'原表是量測值而非五個完全共線的理論點；以 0.02 V 比較。',comparison:{component:'V',field:'reading',reported:leadU[n],absolute:.02,unit:'V',source:'教材蓄電池表 1'}});
  });
  for(const load of [100,200,400,800,1600,4000]){
    const E=.8,r=800;
    add('fruit-v-'+load,'fruit-v','水果電池 V/R 法 '+load+' Ω','自定 E=0.8 V、r=800 Ω；理想 V；R='+load+' Ω。',[battery('E','p','n',E,r),switchPart('S','p','q'),resistor('R','q','n',load),meter('V','voltmeter','q','n',0,3,true)],[check('V','reading',E*load/(load+r),'V'),check('R','current',E/(load+r),'A')],{basis:'equivalent'});
  }
  const orangeR=[9000,8000,7000,6000,5000,4000,3000],orangeI=[92,102,115,131,152,180,220].map(v=>v*1e-6),orangeFit=fit(orangeR.map((r,i)=>[orangeI[i],orangeI[i]*r]));
  orangeR.forEach((load,i)=>{
    const r=orangeFit.r-100,E=orangeFit.E;
    add('orange-a-'+load,'orange-a','橙汁電池 A/R 法 '+load+' Ω','教材 A 表 300 μA、RA=100 Ω；由表 2 最小二乘擬合 E='+E+' V，r='+r+' Ω；R='+load+' Ω。',[battery('E','p','n',E,r),switchPart('S','p','q'),resistor('R','q','m',load),meter('A','ammeter','m','n',100,.0003,true)],[check('A','reading',E/(load+r+100),'A'),check('A','range',.0003,'A'),check('A','resistance',100,'Ω')],{basis:'experimental-fit',note:'U=IR 只跨電阻箱，擬合斜率包含 RA，電池內阻須減去 100 Ω。',comparison:{component:'A',field:'reading',reported:orangeI[i],absolute:2e-6,unit:'A',source:'教材表 2'}});
  });
  const fruitR=[100,200,400,800,1600,4000],fruitU=[.09,.16,.27,.40,.60,.67],fruitFit=fit(fruitR.map((r,i)=>[fruitU[i]/r,fruitU[i]]));
  fruitR.forEach((load,i)=>add('fruit-table-'+load,'fruit-table','原水果電池數據 '+load+' Ω','教材表：R='+load+' Ω、U='+fruitU[i]+' V；整表擬合固定 E='+fruitFit.E+' V、r='+fruitFit.r+' Ω。',[battery('E','p','n',fruitFit.E,fruitFit.r),resistor('R','p','n',load),meter('V','voltmeter','p','n',0,3,true)],[check('V','reading',fruitFit.E*load/(load+fruitFit.r),'V')],{basis:'experimental-fit',note:'實驗點不必精確共線；此比較容差為 0.02 V，較大殘差明列，不歸咎 solver 算式。',comparison:{component:'V',field:'reading',reported:fruitU[i],absolute:.02,unit:'V',source:'教材水果電池數據表'}}));
  // Motor equivalents use back EMF sources, never a plain resistance mistaken for a motor.
  add('motor220','motor220','220 V 電動機指定工作點','教材 U=220 V、I=5 A、線圈 6 Ω；反電動勢 190 V。兩個 110 V 供源、兩個 95 V 反電源。',[battery('E1','p','e',110),battery('E2','e','n',110),resistor('coil','p','q',6),battery('back1','q','b',95),battery('back2','b','n',95)],[check('coil','current',5,'A'),check('coil','power',150,'W'),check('back1','delivered',-475,'W'),check('back2','delivered',-475,'W'),check('E1','sourcePower',550,'W'),check('E2','sourcePower',550,'W')],{basis:'equivalent',note:'P機=反電動勢×I=950 W，只驗算既定工作點；沒有轉速、負載或啟動模型。'});
  add('motor12','motor12','12 V 電動機並聯網絡','教材 E=12 V、r=1 Ω、R1=1 Ω、R2=6 Ω、U機=6 V、線圈 0.5 Ω；得 I機=2 A，反電動勢 5 V。',[battery('E','p','n',12,1),switchPart('S','p','s'),resistor('R1','s','q',1),resistor('R2','q','n',6),resistor('coil','q','m',.5),battery('back','m','n',5)],[check('E','current',-3,'A'),check('R2','voltage',6,'V'),check('coil','current',2,'A'),check('coil','power',2,'W'),check('back','delivered',-10,'W')],{basis:'equivalent',note:'12 W 電輸入=2 W 線圈熱+10 W 機械功率等效；沒有原生電動機。'});
  for(const count of [10,20]){
    const E=220,line=1,Rl=807,load=Rl/count,I=E/(2*line+load),u=I*load,parts=[battery('E1','p','e',110),battery('E2','e','n',110),resistor('line1','p','q',line),resistor('line2','m','n',line)];
    for(let i=1;i<=20;i++){parts.push(resistor('L'+i,'q','l'+i,Rl,{x:580,y:160+i*160,angle:0}),switchPart('S'+i,'l'+i,'m',i<=count,{x:880,y:160+i*160,angle:0}));}
    add('lighting20-'+count,'lighting20','20 盞中的 '+count+' 盞接通','教材 U=220 V，每條線 1 Ω，各燈 807 Ω；20 支電阻和各自開關。',parts,[check('E1','current',-I,'A'),check('L1','voltage',u,'V'),check('L1','power',u*u/Rl,'W'),check('L20','power',count===20?u*u/Rl:0,'W'),check('line1','power',I*I,'W'),check('line2','power',I*I,'W'),check('E1','sourcePower',110*I,'W')],{basis:'equivalent',note:'20 個燈均實際建立支路，而非只替成一個 Req。電阻代表額定恆阻燈，沒有 AC 或 220 V 額定燈模型；庫存自動設定為 '+(circuit(parts).doc.cables.count)+' 條。'});
  }
  for(const variable of [20,10,10/3,0]){
    const E=2.5,R2=5,I=E/(variable+R2);
    add('series-graph-'+variable,'series-graph','U-I 圖採樣 R1='+variable+' Ω','圖 12-4：A=(0.1 A,2 V)、B=(0.3 A,1 V)，解得 E=2.5 V、R2=5 Ω；R1='+variable+' Ω。',[battery('E','p','n',E),switchPart('S','p','q'),part('R1','rheostat','q','m',{resistance:20,position:variable/20}),resistor('R2','m','z',R2),meter('A','ammeter','z','n'),meter('V','voltmeter','q','m')],[check('A','reading',I,'A'),check('V','reading',E-I*R2,'V'),check('R2','voltage',I*R2,'V')],{basis:'textbook'});
  }
  for(const r1 of [10,20,40]){
    const r2=20,req=p([r1,r2]),I=.6,U=I*req;
    add('constant-i-'+r1,'constant-i','固定總電流工作點 R1='+r1+' Ω','I=0.6 A（自行選），R2=20 Ω；人工同步把理想電源改成 U=I×Req='+U+' V。',[battery('E','p','n',U),resistor('R1','p','n',r1),resistor('R2','p','n',r2)],[check('E','current',-I,'A'),check('R1','voltage',U,'V'),check('R1','current',U/r1,'A'),check('R2','current',U/r2,'A'),check('E','sourcePower',I*U,'W')],{basis:'equivalent',note:'這個測試不是有恆流源；固定電源電压後改 R1 不會維持總電流。'});
  }
  for(const starting of [false,true]){
    const E=12.5,r=.05,Rl=1.2,u=starting?9.5:12,Il=u/Rl,Im=starting?60-Il:0,motorR=9.5/(60-9.5/Rl),parts=[battery('E','p','n',E,r),part('L','lamp','p','n',{resistance:Rl,ratedVoltage:12}),switchPart('S','p','q',starting),resistor('motor-equivalent','q','n',motorR)];
    add('car-start-'+starting,'car-start','車燈 '+(starting?'啟動指定瞬間':'未啟動'),'教材 12-6：E=12.5 V、r=0.05 Ω，I總=10/60 A，推得 R燈=1.2 Ω；啟動支路等效 R='+motorR+' Ω。',parts,[check('E','current',starting?-60:-10,'A'),check('L','voltage',u,'V'),check('L','power',u*u/Rl,'W'),check('motor-equivalent','current',Im,'A')],{basis:'equivalent',note:'只驗算兩個指定工作點；未建立電動機及啟動過程。'});
    const Ecar=12,rcar=.5,Rcar=12,rm=.5,Ucar=Ecar/(1+rcar*(2/Rcar+(starting?1/rm:0)));
    add('car-'+starting,'car','兩盞車燈及啟動負載','圖 12.2-8 未給數值，自行選 E=12 V、r=0.5 Ω、兩燈各 12 Ω，啟動支路等效 0.5 Ω。',[battery('E','p','n',Ecar,rcar),part('L1','lamp','p','n',{resistance:Rcar,ratedVoltage:12}),part('L2','lamp','p','n',{resistance:Rcar,ratedVoltage:12}),switchPart('S','p','q',starting),resistor('motor-equivalent','q','n',rm)],[check('L1','power',Ucar*Ucar/Rcar,'W'),check('L2','voltage',Ucar,'V')],{basis:'equivalent',note:'保留兩條車燈支路；電阻只代表啟動瞬間的負載，不是電動機模型。'});
  }
  for(const load of [0,.5,2,2.5,3,5]){
    const E=6,r=2,R1=.5,I=E/(r+R1+load);
    add('maximum-'+load,'maximum','最大功率掃描 R2='+load+' Ω','教材 r=2 Ω、R1=0.5 Ω、R2最大 5 Ω；自行選 E=6 V。',[battery('E','p','n',E,r),resistor('R1','p','q',R1),part('R2','rheostat','q','m',{resistance:5,position:load/5}),switchPart('S','m','n')],[check('R1','power',I*I*R1,'W'),check('R2','power',I*I*load,'W'),check('E','delivered',I*I*(R1+load),'W')],{basis:'textbook',note:'R1 功率最大在 R2=0；R2 功率最大在 R2=r+R1=2.5 Ω；輸出功率最大在 R2=r−R1=1.5 Ω（另測該點）。'});
  }
  const rr=1.5,Imax=6/(2+.5+rr);
  add('maximum-output','maximum','電源最大輸出功率','E=6 V、r=2 Ω、R1=0.5 Ω、R2=1.5 Ω。',[battery('E','p','n',6,2),resistor('R1','p','q',.5),part('R2','rheostat','q','n',{resistance:5,position:.3})],[check('E','delivered',4.5,'W'),check('R1','power',Imax*Imax*.5,'W')],{basis:'textbook'});
  add('source-graph','source-r','圖 12-1 源與電阻交點','圖讀：源 E=6 V、r=2 Ω，R=4 Ω，交點 I=1 A、U=4 V。',[battery('E','p','n',6,2),resistor('R','p','n',4)],[check('R','current',1,'A'),check('R','power',4,'W'),check('E','internalPower',2,'W')],{basis:'textbook'});
  const eelParts=[],eelR=5000*.25/140,eelI=750/(800+eelR);
  for(let i=0;i<7;i++)eelParts.push(battery('E'+(i+1),i?'b'+i:'p',i===6?'n':'b'+(i+1),750/7,eelR/7,{x:160,y:160+i*180,angle:90}));eelParts.push(resistor('water','p','n',800));
  add('eel-equivalent','eel','電鰻七段等效電源','原題 140 並聯×5000 串聯：E=750 V、r=1250/140 Ω。以七個串聯等效源表示，水 R=800 Ω。',eelParts,[check('water','current',eelI,'A'),check('water','voltage',800*eelI,'V')],{basis:'equivalent',note:'不是原樣建立 700000 電源，沒有生物放電暫態。'});
  return out;
}
function limitations() {
  const base=M.empty();const probes=[
    ['three-terminal-rheostat',()=>{const d=M.empty();M.add(d,'rheostat',0,0,{terminals:3});return M.validate(d);},'三接點變阻器',false],
    ['multimeter',()=>M.add(base,'multimeter',0,0),'多用電表',true],
    ['ohmmeter',()=>M.add(base,'ohmmeter',0,0),'Ω 表',true],
    ['diode',()=>M.add(base,'diode',0,0),'二極管',true],
    ['led',()=>M.add(base,'led',0,0),'LED',true],
    ['motor',()=>M.add(base,'motor',0,0),'電動機',true],
    ['current-source',()=>M.add(base,'current-source',0,0),'恆流源',true],
    ['capacitor',()=>M.add(base,'capacitor',0,0),'暫態電容',true],
    ['source-220V',()=>{const d=M.empty();M.add(d,'battery',0,0,{voltage:220});return M.validate(d);},'220 V 單電源',true],
    ['lamp-rated-220V',()=>{const d=M.empty();M.add(d,'lamp',0,0,{ratedVoltage:220});return M.validate(d);},'220 V 額定燈',true],
    ['g-50uA',()=>{const d=M.empty();M.add(d,'galvanometer',0,0,{range:.00005});return M.validate(d);},'50 μA 原生 G 表滿偏',false]
  ];
  const result=probes.map(([id,run,title])=>{try{run();return{id,title,rejected:false,error:null};}catch(e){return{id,title,rejected:true,error:e.message};}});
  result.push({id:'native-dual-range-ratio',title:'原生 A/V 雙量程固定 5:1',rejected:true,error:'量程小孔固定為大孔／5；不能獨立設置教材的 10:1。',measuredRatio:R.meterRanges({params:{range:100}}).high/R.meterRanges({params:{range:100}}).low});
  return result;
}
function verify(one) {
  const text=D.encode(one.doc),restored=D.decode(text),analysis=S.solve(restored),observations=observe(one,analysis);
  const roundTrip=JSON.stringify(restored)===JSON.stringify(one.doc);
  const resumed=M.clone(restored);if(one.continuation){const c=resumed.components.find(c=>c.id===one.continuation.id);c.params[one.continuation.param]=one.continuation.value;}
  const continuation=M.validate(resumed);D.decode(D.encode(continuation));const next=S.solve(continuation);
  const energy=Object.values(analysis.components).reduce((sum,x)=>sum+(x.power??NaN),0);
  let comparison=null;if(one.comparison){const c=one.comparison,actual=analysis.components[one.components[c.component]][c.field];comparison={...c,actual,error:Math.abs(actual-c.reported),within:Math.abs(actual-c.reported)<=c.absolute};}
  return {id:one.id,group:one.group,title:one.title,conditions:one.conditions,basis:one.basis,note:one.note,components:one.doc.components.length,wires:one.doc.wires.length,junctions:one.doc.junctions.length,maximumCableLength:Math.max(0,...one.doc.wires.map(w=>w.length)),bytes:D.bytes(text),roundTrip,continuation:{performed:Boolean(one.continuation),diagnostics:next.diagnostics,residual:next.residual},diagnostics:analysis.diagnostics,residual:analysis.residual,energy,observations,comparison,pass:roundTrip&&observations.every(x=>x.pass)&&analysis.diagnostics.length===0&&Math.abs(energy)<1e-7};
}
module.exports={textbook,inventory,unavailable,cases,circuit,part,resistor,battery,meter,check,observe,read,verify,fit,limitations};
