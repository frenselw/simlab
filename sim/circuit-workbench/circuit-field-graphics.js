(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./circuit-math'):root.CircuitMath);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitFieldGraphics=api;
})(globalThis,function(Q){
  'use strict';
  const electric='#326ec4',magnetic='#247b87',hiddenMagnetic='#526f79';
  const number=n=>Number(n.toFixed(4)),point=p=>p.map(number).join(' ');
  const sign=v=>Number.isFinite(v)?Math.sign(v):0;
  const strength=(v,reference)=>Number.isFinite(v)?Math.abs(v)/(Math.abs(v)+reference):0;
  // Fill the same extent at every strength; all intervals in a family are equal.
  function density(v,reference,minIntervals,maxIntervals,from,to){
    const s=strength(v,reference),intervals=minIntervals+Math.round((maxIntervals-minIntervals)*s),spacing=(to-from)/intervals;
    return {strength:s,spacing,intervals,positions:Array.from({length:intervals+1},(_,n)=>from+(to-from)*n/intervals)};
  }
  function arrow(x,y,dx,dy,color,size=2.2){
    const length=Math.hypot(dx,dy);if(!length)return '';
    const ux=dx/length,uy=dy/length,bx=x-ux*size,by=y-uy*size;
    return '<path data-field-arrow="true" d="M'+point([x,y])+'L'+point([bx-uy*size*.55,by+ux*size*.55])+'L'+point([bx+uy*size*.55,by-ux*size*.55])+'Z" fill="'+color+'"/>';
  }
  const line=(d,color,kind,width=.7)=>'<path data-field-line="'+kind+'" d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"/>';
  const text=(x,y,value,color='#52677c',size=8)=>'<text x="'+x+'" y="'+y+'" text-anchor="middle" font-size="'+size+'"'+(value==='n'?' font-style="italic" font-family="STIX Two Math, Cambria Math, Times New Roman, serif"':'')+' fill="'+color+'">'+value+'</text>';
  const group=(kind,v,s,pitch,content)=>'<g data-field-kind="'+kind+'" data-field-sign="'+sign(v)+'" data-field-known="'+Number.isFinite(v)+'" data-field-strength="'+s+'" data-field-spacing="'+pitch+'" opacity="'+(sign(v)?1:0)+'" pointer-events="none">'+content+'</g>';
  function capacitor(r,gap=48){
    const v=r?.fieldVoltage??r?.voltage,d=sign(v),grid=density(v,6,4,14,-20,20),left=-gap/2,right=gap/2;
    let front='<rect x="'+left+'" y="-22" width="'+gap+'" height="44" fill="'+electric+'" opacity=".07"/>';
    for(const y of grid.positions)front+=line('M'+left+' '+y+'H'+right,electric,'uniform')+arrow(d*2,y,d,0,electric);
    return {back:'',front:group('electric',v,grid.strength,grid.spacing,front)};
  }
  function capacitorSection(r,gap=48){
    const d=sign(r?.fieldVoltage??r?.voltage),f=capacitor(r,gap),left=d>=0?'#c43f4c':'#286cb7',right=d>=0?'#286cb7':'#c43f4c';
    let plates='<rect x="'+(-gap/2-5)+'" y="-30" width="5" height="60" rx="1" fill="'+(d?left:'#9eafb9')+'"/><rect x="'+gap/2+'" y="-30" width="5" height="60" rx="1" fill="'+(d?right:'#9eafb9')+'"/>';
    if(d)for(const y of [-21,-7,7,21]){plates+=text(-gap/2-10,y+2,d>0?'＋':'−',left,9)+text(gap/2+10,y+2,d>0?'−':'＋',right,9);}
    if(!d){const polarity=r?.polarity||1;plates+='<g data-capacitor-polarity="reference">'+text(-gap/2-10,3,polarity>0?'＋':'−','#8795a1',9)+text(gap/2+10,3,polarity>0?'−':'＋','#8795a1',9)+'</g>';}
    return '<g data-plate-gap="'+gap+'">'+plates+f.front+text(0,51,'極板剖面 · 兩板間均勻電場')+'</g>';
  }
  function inductor(c,r){
    const i=r?.fieldCurrent??r?.current,d=sign(i),field=Number.isFinite(i)?i*Math.sqrt(c.params.inductance):null,s=strength(field,.6),pairs=3+Math.round(4*s),pitch=32/(2*pairs-1);
    let back='',front='';
    for(const side of [-1,1])for(let n=0;n<pairs;n++){
      // Enter the physical bore at x=-40, rather than the first visible turn.
      // Nested return paths stay behind the former and never cross each other.
      const t=n/(pairs-1),y=side*(n+.5)*pitch,outer=side*(45-18*t),x0=-40,x1=40,edge=74-19*t;
      const path='M'+x0+' '+y+'H'+x1+'C'+edge+' '+y+' '+edge+' '+outer+' '+x1+' '+outer+'H'+x0+'C'+(-edge)+' '+outer+' '+(-edge)+' '+y+' '+x0+' '+y+'Z';
      back+=line(path,magnetic,'closed',.7)+arrow(-d*2,outer,-d,0,magnetic,2.4);
      front+='<g data-field-occluded="true" opacity=".65"><path data-field-line="inside" d="M'+x0+' '+y+'H'+x1+'" fill="none" stroke="'+hiddenMagnetic+'" stroke-width=".75" stroke-dasharray="2.5 2"/>'+arrow(d*3,y,d,0,hiddenMagnetic,2)+'</g>';
    }
    return {back:group('magnetic',i,s,pitch,back),front:group('magnetic',i,s,pitch,front),markers:inductorPoles(c,r)};
  }
  function inductorPoles(c,r){
    const d=Math.sign(r?.current)||r?.polarity||Math.sign(c.params.initialCurrent)||1,active=Number.isFinite(r?.fieldCurrent??r?.current)&&(r?.fieldCurrent??r?.current)!==0;
    return '<g pointer-events="none" data-field-poles="true" data-polarity-active="'+active+'">'+text(-48,-18,d>0?'S':'N',active?(d>0?'#397cab':'#b4534d'):'#8795a1',9)+text(48,-18,d>0?'N':'S',active?(d>0?'#b4534d':'#397cab'):'#8795a1',9)+'</g>';
  }
  function capacitorPoles(r,gap){
    const d=Math.sign(r?.voltage)||r?.polarity||1,active=Number.isFinite(r?.fieldVoltage??r?.voltage)&&(r?.fieldVoltage??r?.voltage)!==0;
    return '<g pointer-events="none" data-capacitor-polarity="true" data-polarity-active="'+active+'">'+text(-gap/2-14,-33,d>0?'＋':'−',active?(d>0?'#c43f4c':'#286cb7'):'#8795a1',9)+text(gap/2+14,-33,d>0?'−':'＋',active?(d>0?'#286cb7':'#c43f4c'):'#8795a1',9)+'</g>';
  }

  function transformer(c,r,schematic=false){
    let flux=r?.coreFlux;if(c.params.model==='coupled'&&Number.isFinite(r?.energy)&&r.energy<1e-9)flux=0;if(Number.isFinite(flux)&&Math.abs(flux)<Math.max(1e-9,(r?.coreFluxPeak||0)*1e-4))flux=0;
    const grid=density(flux,.004,1,3,-4.5,4.5),d=sign(flux);let paths='',arrows='';
    for(const offset of grid.positions){const x=(schematic?6:36)+offset*(schematic?1/3:1),y=29+offset*(schematic?1/3:1),bend=schematic?2:5;
      const path='M'+(-x+bend)+' '+(-y)+'H'+(x-bend)+'Q'+x+' '+(-y)+' '+x+' '+(-y+bend)+'V'+(y-bend)+'Q'+x+' '+y+' '+(x-bend)+' '+y+'H'+(-x+bend)+'Q'+(-x)+' '+y+' '+(-x)+' '+(y-bend)+'V'+(-y+bend)+'Q'+(-x)+' '+(-y)+' '+(-x+bend)+' '+(-y)+'Z';
      paths+='<path data-field-line="core-closed" d="'+path+'" fill="none" stroke="'+hiddenMagnetic+'" stroke-width=".8" stroke-dasharray="2.2 1.5"/>';arrows+=arrow(d*4,-y,d,0,magnetic,2)+arrow(-d*4,y,-d,0,magnetic,2);
    }
    return group('transformer-core',flux,grid.strength,grid.spacing*(schematic?1/3:1),paths+arrows);
  }
  function generatorOverlay(c,r,project){
    const t=Number.isFinite(r?.phase)?r.phase:c.params.phase*Math.PI/180,origin=project([0,0,0]),end=project([17*Math.cos(t),17*Math.sin(t),0]);
    const corner=(s,z)=>project([s*Math.sin(t),-s*Math.cos(t),z]);
    const p=[corner(-17,-22.5),corner(17,-22.5),corner(17,22.5),corner(-17,22.5)];
    const fill=Number.isFinite(r?.flux)&&r.flux<0?'#d59b55':'#568bc9';
    return '<g data-generator-normal="true" pointer-events="none"><path d="M'+p.map(point).join('L')+'Z" fill="'+fill+'" opacity=".08"/>'+line('M'+point(origin)+'L'+point(end),'#4c65ad','normal',.9)+arrow(end[0],end[1],end[0]-origin[0],end[1]-origin[1],'#4c65ad',3)+Q.svg(end[0]+4,end[1]-3,Q.symbol('n'),9,'text-anchor="start" fill="#4c65ad"')+'</g>';
  }
  function description(c,r){
    r={...r,current:r?.fieldCurrent??r?.current,voltage:r?.fieldVoltage??r?.voltage};
    if(c.type==='capacitor')return !Number.isFinite(r?.voltage)?'電壓未能確定，暫不標示電場方向。':r.voltage===0?'電場示意收起；灰色＋／−只作極性參考。':(r.voltage>0?'左板帶正電、右板帶負電。':'右板帶正電、左板帶負電。')+'只顯示兩板之間的均勻電場，由正板指向負板；忽略邊緣效應。';
    if(c.type==='inductor')return !Number.isFinite(r?.current)?'電流未能確定，暫不標示磁場方向。':r.current===0?'磁場示意收起；灰色 N／S 只作方向參考。':(r.current>0?'線圈內部磁場向右，右端為 N 極。':'線圈內部磁場向左，左端為 N 極。')+'磁場如通電螺線管，外部場線返回另一端並穿過線圈中央，形成閉合路徑；內部較暗虛線表示被線圈遮擋的部分。電流反向時兩極對調；自感電動勢會阻礙電流的變化。';
    if(c.type==='generator')return c.params.field===0?'設定的磁場為零；在這個理想模型中，磁通及感應電動勢為零。':'只顯示 N、S 極之間的均勻磁場，方向固定由 N 指向 S。[[n]] 是線圈平面的法線；平行磁場時磁通大小最大，垂直時電動勢大小達峰值。';
    if(c.type==='transformer'){const state=!Number.isFinite(r?.coreFlux)?'正在收集一個週期的交變磁通，暫不畫方向。':Math.abs(r.coreFlux)<1e-9?'當刻共同磁通接近零，磁感線收起。':'共同磁通沿鐵芯閉合，穿過原、副線圈；交變磁通在兩側產生感應電動勢。';return state+'虛線表示鐵芯內部及被繞組遮住的磁場，只畫鐵芯範圍，省略外部漏磁。'+(c.params.model==='ideal'?'理想模型以繞組電壓積分顯示零平均的交變磁通，不計磁化電流及磁化儲能。':'磁通計入兩個線圈的共同作用，原、副電流的磁化作用可以抵銷。');}
    return '';
  }
  return {density,capacitor,capacitorSection,capacitorPoles,inductor,inductorPoles,transformer,generatorOverlay,description};
});
