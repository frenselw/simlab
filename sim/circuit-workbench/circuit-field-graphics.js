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
  // Display geometry only: Biot–Savart directions of a finite current sheet,
  // sampled as coaxial rings. No B values enter the circuit solver or snapshots.
  const ringXs=Array.from({length:24},(_,n)=>-34+68*(n+.5)/24),ringCosines=Array.from({length:32},(_,n)=>Math.cos(2*Math.PI*(n+.5)/32)),solenoidCache=new Map();
  function solenoidDirection(x,y){
    let bx=0,by=0;for(const x0 of ringXs){const dx=x-x0;for(const cosine of ringCosines){const r2=dx*dx+y*y+576-48*y*cosine,weight=1/(r2*Math.sqrt(r2));bx+=(576-24*y*cosine)*weight;by+=24*dx*cosine*weight;}}
    const magnitude=Math.hypot(bx,by);return [bx/magnitude,by/magnitude];
  }
  function solenoidBranch(seed,direction){
    const points=[[0,seed]];let clipped=false;
    for(let n=0;n<900;n++){
      const p=points.at(-1),a=solenoidDirection(...p),v=solenoidDirection(p[0]+direction*.325*a[0],p[1]+direction*.325*a[1]),next=p.map((z,k)=>z+direction*.65*v[k]);
      if(Math.abs(next[0])>=84||Math.abs(next[1])>=58){const delta=next.map((z,k)=>z-p[k]),fraction=Math.min(Math.abs(next[0])>=84?(Math.sign(next[0])*84-p[0])/delta[0]:1,Math.abs(next[1])>=58?(Math.sign(next[1])*58-p[1])/delta[1]:1);points.push(p.map((z,k)=>z+fraction*delta[k]));clipped=true;break;}
      // A natural return reaches the other half of the same streamline. Only
      // those paths close; all other lines terminate at the observation boundary.
      if(n>30&&p[0]*next[0]<0&&Math.abs(next[1])>24){const fraction=-p[0]/(next[0]-p[0]);points.push([0,p[1]+fraction*(next[1]-p[1])]);break;}
      points.push(next);
    }
    return {points,clipped};
  }
  // Subpixel polyline simplification keeps the cached SVG light enough for live
  // observation. It does not change the traced directions or clipping points.
  function simplifyField(points){
    const keep=new Set([0,points.length-1]),pending=[[0,points.length-1]];
    while(pending.length){const [a,b]=pending.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],length=dx*dx+dy*dy;let worst=.04*.04,index=-1;
      for(let n=a+1;n<b;n++){const t=length?Math.max(0,Math.min(1,((points[n][0]-p[0])*dx+(points[n][1]-p[1])*dy)/length)):0,distance=(points[n][0]-p[0]-t*dx)**2+(points[n][1]-p[1]-t*dy)**2;if(distance>worst){worst=distance;index=n;}}
      if(index!==-1){keep.add(index);pending.push([a,index],[index,b]);}
    }
    return points.filter((_,n)=>keep.has(n));
  }
  const fieldPath=points=>'M'+simplifyField(points).map(point).join('L');
  function solenoidLine(seed){
    const left=solenoidBranch(seed,-1),right=solenoidBranch(seed,1),points=[...left.points.reverse(),...right.points.slice(1)],clipped=left.clipped||right.clipped;
    const bore=points.filter(([x,y])=>Math.abs(x)<=40&&Math.abs(y)<=22);
    return {seed,points,clipped,path:fieldPath(points)+(clipped?'':'Z'),bore:fieldPath(bore)};
  }
  function solenoidGeometry(count){
    if(!solenoidCache.has(count))solenoidCache.set(count,{spread:Array.from({length:count},(_,n)=>solenoidLine(count===1?0:-16+32*n/(count-1))),returns:(count>=17?[-22,-20,20,22]:count>=7?[-22,22]:[]).map(solenoidLine),content:new Map()});
    return solenoidCache.get(count);
  }
  function inductor(c,r){
    const i=r?.fieldCurrent??r?.current,d=sign(i),reference=r?.fieldCurrentReference>0?r.fieldCurrentReference:Math.abs(c.params.initialCurrent||0)||r?.currentPeak||.6/Math.sqrt(c.params.inductance),s=Number.isFinite(i)?Math.min(1,Math.abs(i)/reference):0,count=d?1+2*Math.round(12*s):0,pitch=count>1?32/(count-1):32,geometry=solenoidGeometry(count);
    if(!geometry.content.has(d)){
      let back='',front='';
      for(const [n,g]of geometry.spread.entries()){
        const showArrow=count<5?n===Math.floor(count/2):n%4===2;
        back+=line(g.path,magnetic,'spread',.65).replace(' d=',` data-field-seed="${g.seed}" data-field-clipped="${g.clipped}" d=`);
        front+='<g data-field-occluded="true" opacity=".85">'+line(g.bore,hiddenMagnetic,'inside',.8).replace(' d=',` data-field-seed="${g.seed}" d=`).replace('stroke-linecap=', 'stroke-dasharray="2.5 1.5" stroke-linecap=')+(showArrow?arrow(d*3,g.seed,d,0,hiddenMagnetic,1.7):'')+'</g>';
        if(showArrow){const p=g.points.find(([x,y])=>x>52||x>0&&y>34||x>0&&y<-34),v=p&&solenoidDirection(...p);if(p)back+=arrow(...p,d*v[0],d*v[1],magnetic,1.9);}
      }
      for(const g of geometry.returns){back+=line(g.path,magnetic,'return',.65);const p=g.points[0],v=solenoidDirection(...p);back+=arrow(...p,d*v[0],d*v[1],magnetic,2);}
      geometry.content.set(d,{back,front});
    }
    const {back,front}=geometry.content.get(d);
    return {back:group('magnetic',i,s,pitch,back),front:group('magnetic',i,s,pitch,front),markers:inductorPoles(c,r),geometryKey:[count,d,Number.isFinite(i),Math.sign(r?.current)||r?.polarity||Math.sign(c.params.initialCurrent)||1].join('/'),strength:s};
  }
  function inductorPoles(c,r){
    const d=Math.sign(r?.current)||r?.polarity||Math.sign(c.params.initialCurrent)||1,active=Number.isFinite(r?.fieldCurrent??r?.current)&&(r?.fieldCurrent??r?.current)!==0;
    return '<g pointer-events="none" data-field-poles="true" data-polarity-active="'+active+'">'+text(-48,-18,d>0?'S':'N',active?(d>0?'#397cab':'#b4534d'):'#8795a1',9)+text(48,-18,d>0?'N':'S',active?(d>0?'#b4534d':'#397cab'):'#8795a1',9)+'</g>';
  }
  function capacitorPoles(r,gap){
    const d=Math.sign(r?.voltage)||r?.polarity||1,active=Number.isFinite(r?.fieldVoltage??r?.voltage)&&(r?.fieldVoltage??r?.voltage)!==0;
    return '<g pointer-events="none" data-capacitor-polarity="true" data-polarity-active="'+active+'">'+text(-gap/2-14,-33,d>0?'＋':'−',active?(d>0?'#c43f4c':'#286cb7'):'#8795a1',9)+text(gap/2+14,-33,d>0?'−':'＋',active?(d>0?'#286cb7':'#c43f4c'):'#8795a1',9)+'</g>';
  }

  const transformerTurns=n=>Math.max(1,Math.ceil(16*Math.sqrt(n/2000)));
  function transformerWindings(c){
    return [[-39,c.params.primaryTurns,'primary'],[39,c.params.secondaryTurns,'secondary']].map(([x,nominal,side])=>{
      const count=transformerTurns(nominal),pitch=Math.min(3.5,48/count),start=-count*pitch/2,width=2.05;
      return {x,radius:15,nominal,side,count,pitch,start,end:-start,width,outline:2.6};
    });
  }
  function transformer(c,r,schematic=false,id='transformer-field'){
    let flux=r?.coreFlux;if(c.params.model==='coupled'&&Number.isFinite(r?.energy)&&r.energy<1e-9)flux=0;if(Number.isFinite(flux)&&Math.abs(flux)<Math.max(1e-9,(r?.coreFluxPeak||0)*1e-4))flux=0;
    const extent=schematic?4.5:3.5,grid=density(flux,.004,1,3,-extent,extent),d=sign(flux),colour='#087c82';let paths='',arrows='';
    id=String(id).replace(/[^\w-]/g,'-');
    if(!schematic){
      const hidden=transformerWindings(c).map(w=>`<rect x="${w.x-w.radius-1}" y="${w.start-4}" width="${2*w.radius+2}" height="${w.end-w.start+8}"/>`).join('');
      paths=`<defs><mask id="${id}-exposed" maskUnits="userSpaceOnUse" x="-60" y="-45" width="120" height="90"><rect x="-60" y="-45" width="120" height="90" fill="white"/><g fill="black">${hidden}</g></mask><clipPath id="${id}-hidden">${hidden}</clipPath></defs>`;
    }
    for(const [index,offset]of grid.positions.entries()){const x=(schematic?6:39)+offset*(schematic?1/3:1),y=(schematic?29:32)+offset*(schematic?1/3:1),bend=schematic?2:6;
      const path='M'+(-x+bend)+' '+(-y)+'H'+(x-bend)+'Q'+x+' '+(-y)+' '+x+' '+(-y+bend)+'V'+(y-bend)+'Q'+x+' '+y+' '+(x-bend)+' '+y+'H'+(-x+bend)+'Q'+(-x)+' '+y+' '+(-x)+' '+(y-bend)+'V'+(-y+bend)+'Q'+(-x)+' '+(-y)+' '+(-x+bend)+' '+(-y)+'Z';
      if(schematic)paths+='<path data-field-line="core-closed" d="'+path+'" fill="none" stroke="'+colour+'" stroke-width=".8" stroke-dasharray="2.2 1.5"/>';
      else{
        paths+=`<g mask="url(#${id}-exposed)">${line(path,'#f4ffff','core-halo',1.7)}${line(path,colour,'core-closed',.9)}</g>`;
        paths+=`<g data-field-occluded="true" clip-path="url(#${id}-hidden)" stroke-dasharray="2.8 1.8">${line(path,'#f4ffff','core-hidden-halo',1.5)}${line(path,colour,'core-hidden',.8)}</g>`;
      }
      arrows+=arrow(d*4,-y,d,0,colour,schematic?2:2.8)+arrow(-d*4,y,-d,0,colour,schematic?2:2.8);
      if(!schematic&&index===Math.floor(grid.positions.length/2))arrows+=arrow(x,7,0,d,colour,2.8)+arrow(-x,-7,0,-d,colour,2.8);
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
    if(c.type==='inductor')return !Number.isFinite(r?.current)?'電流未能確定，暫不標示磁場方向。':r.current===0?'磁場示意收起；灰色 N／S 只作方向參考。':(r.current>0?'線圈內部磁場向右，右端為 N 極。':'線圈內部磁場向左，左端為 N 極。')+'線圈內部磁感線密集、接近平行；兩端向外散開，外部較稀疏。圖只顯示附近的一小段空間，延伸到邊界的場線在此截去，並非磁感線在這裏終止。內部虛線表示被繞線遮擋的部分。電流反向時兩極對調；自感電動勢會阻礙電流的變化。';
    if(c.type==='generator')return c.params.field===0?'設定的磁場為零；在這個理想模型中，磁通量及感應電動勢為零。':'只顯示 [[poleN]]、[[poleS]] 極之間的均勻磁場 [[B]]，方向由 [[poleN]] 指向 [[poleS]]。[[n]] 是線圈平面的法線，[[theta]] 是法線與磁場的夾角。單匝磁通量 [[fluxFormula]]；法線平行磁場時，磁通量大小最大；法線垂直磁場時，感應電動勢 [[e]] 的大小達峰值。';
    if(c.type==='transformer'){const state=!Number.isFinite(r?.coreFlux)?'正在收集完整觀察窗的交變磁通，暫不畫方向。':Math.abs(r.coreFlux)<1e-9?'當刻共同磁通接近零，磁感線收起。':'共同磁通沿鐵芯閉合，穿過原、副線圈；交變磁通在兩側產生感應電動勢。';return state+(r.coreFluxFrequencies?.length>1?'磁通採用 '+r.coreFluxWindow+' s '+(r.coreFluxWindowKind==='common-cycle'?'共同週期':'指定時間窗（非共同週期）')+'。':'')+'銅線繞在鐵芯兩柱；青綠色實線及箭頭表示鐵芯內的磁通，虛線透視被繞組遮住的部分。省略外部漏磁。'+(c.params.model==='ideal'?'理想模型以繞組電壓積分顯示交變磁通，以觀察窗平均值作基準，不計磁化電流及磁化儲能。':'磁通計入兩個線圈的共同作用，原、副電流的磁化作用可以抵銷。');}
    return '';
  }
  return {density,capacitor,capacitorSection,capacitorPoles,inductor,inductorPoles,transformerTurns,transformerWindings,transformer,generatorOverlay,description};
});
