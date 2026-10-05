'use strict';
const assert=require('node:assert/strict'),{XMLParser,XMLValidator}=require('fast-xml-parser'),M=require('./circuit-model'),R=require('./component-registry'),S=require('./circuit-solver'),D=require('./circuit-document'),V=require('./circuit-renderer'),Q=require('./circuit-math');
const xml=new XMLParser({ignoreAttributes:false}),near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(type,port,fraction,range){const d=M.empty(),meter=M.add(d,type,300,320,{range}),load=M.add(d,'resistor',450,100,{resistance:10}),b=M.add(d,'battery',100,100,{voltage:Math.abs(fraction)*(port==='c'?range/5:range)*(type==='ammeter'?10:1),polarity:fraction<0?-1:1});
  if(type==='ammeter'){M.connect(d,b.id+':a',meter.id+':'+port,[],'free');M.connect(d,meter.id+':b',load.id+':a',[],'free');}else{M.connect(d,b.id+':a',load.id+':a',[],'free');M.connect(d,meter.id+':'+port,load.id+':a',[],'free');M.connect(d,meter.id+':b',load.id+':b',[],'free');}M.connect(d,load.id+':b',b.id+':b',[],'free');d.display.meters='analog';return{d,meter,b};}
let cases=0;
for(const type of ['ammeter','voltmeter'])for(const range of [type==='ammeter'?3:15,type==='ammeter'?6:30])for(const port of ['a','c'])for(const fraction of [-.5,-1/3-.001,-1/3,-.2,-1/30,0,1/30,.1,.5,1,1.02,1.1]){
  const f=fixture(type,port,fraction,range),r=S.solve(f.d).components[f.meter.id],value=fraction*(port==='c'?range/5:range);near(r.reading,value);near(r.minimum,-r.range/3);near(r.division,r.range/30);
  assert.equal(r.meterStatus,fraction<-1/3-1e-8||fraction>1+1e-8?'overrange':fraction<0?'reverse':'normal');
  const svg=V.dualDial(f.meter,r),parsed=xml.parse('<svg>'+svg+'</svg>').svg.g,needle=[].concat(parsed.path).find(p=>p['@_data-meter-needle']),ticks=[].concat(parsed.path).filter(p=>p['@_data-meter-tick']!==undefined);
  assert.equal(ticks.length,41);assert.equal(+ticks[0]['@_data-meter-tick'],-10);assert.equal(+ticks.at(-1)['@_data-meter-tick'],30);const zero=ticks.find(t=>+t['@_data-meter-tick']===0);near(+zero['@_data-angle'],-120);near((+zero['@_data-angle']- +ticks[0]['@_data-angle'])/(+ticks.at(-1)['@_data-angle']- +ticks[0]['@_data-angle']),.25);
  const clamped=Math.max(-1/3-.02,Math.min(1.02,fraction));near(+needle['@_data-fraction'],clamped);near(+needle['@_data-angle'],-120+90*clamped);near(+needle['@_data-reading'],value);
  for(const tick of ticks)near(+tick['@_data-angle'],-120+3* +tick['@_data-meter-tick']);
  const labels=[].concat(parsed.g).filter(p=>p['@_data-scale']);assert.equal(labels.length,10);for(const p of labels){const max=p['@_data-scale']==='high'?range:range/5;assert(+p['@_data-value']>=-max/3-1e-8&&+p['@_data-value']<=max);assert(p['@_data-tex']!==undefined);}
  assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);const saved=D.decode(D.encode(f.d));assert.deepEqual(saved,f.d);const wire=saved.wires.find(w=>[w.from,w.to].includes(f.meter.id+':'+port)),end=wire.from===f.meter.id+':'+port?'from':'to';assert(M.attach(saved,wire.id,end,f.meter.id+':'+(port==='a'?'c':'a')));near(S.solve(saved).components[f.meter.id].reading,value);cases++;
}
for(const q of [Q.quantity(0,'A'),Q.quantity(-.2,'A'),Q.quantity(15,'V'),Q.quantity(1e6,'Ω'),Q.quantity(1e-7,'W'),Q.quantity(null,'A'),Q.join([Q.assignment('E',6,'V'),Q.assignment('r',.5,'Ω')])]){
  const m=Q.measure(q.tex,16),c=Q.compiled(q.tex),svg=Q.svg(0,0,q,16);assert(m.width>0&&m.height>0&&m.ascent>0);assert(c.markup.includes('<path'));assert(!/<(?:use|text|image|foreignObject)\b|\b(?:href|id)=/.test(c.markup));assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert(Q.html(q).includes('aria-label='));
}
assert.equal(Q.number(-0),'0');assert.equal(Q.numberTex(1e-7),'1.00\\times10^{-7}');assert.equal(Q.quantity(2,'V').tex,'2\\,\\mathrm{V}');assert.throws(()=>Q.assignment('\\href',1,'V'));assert.throws(()=>Q.unit('javascript:'));
// Retired digital snapshots retain their data but use the same analog display.
assert.equal(M.empty().display.meters,'analog');
for(const type of ['ammeter','voltmeter','galvanometer','wattmeter'])for(const view of ['real','schematic'])for(const values of [true,false]){
  const d=M.empty(),c=M.add(d,type,300,320),r={reading:.2,range:c.params.range,unit:R.get(type).icon,meterStatus:'normal',activePort:'a'};
  Object.assign(d.display,{view,values,meters:'digital'});
  assert.equal(V.body(c,r,d.display),V.body(c,r,{...d.display,meters:'analog'}));
  const solved=S.solve(d),rows=V.labels(d,solved).find(p=>p.id===c.id)?.rows||[];
  assert.equal(rows.some(row=>row.kind==='value'),values,'numeric readings belong to labels for every meter');
  assert.equal(D.decode(D.encode(d)).display.meters,'digital','legacy files round-trip without changing circuit data');
}
for(const type of ['ammeter','voltmeter'])for(const mirrored of [true,false]){
  const d=M.empty(),c=M.add(d,type,300,320);c.mirrored=mirrored;
  const body=xml.parse('<svg>'+V.body(c,S.solve(d).components[c.id],d.display)+'</svg>').svg;
  for(const p of R.localPorts(c)){
    const lead=[].concat(body.path).find(e=>e['@_data-socket-lead']===p.key),socket=[].concat(body.circle).find(e=>e['@_data-socket']===p.key);
    const coordinates=lead['@_d'].match(/-?\d+(?:\.\d+)?/g).map(Number);
    near(coordinates[0],+socket['@_cx']);near(coordinates.at(-1),+socket['@_cy']);
    assert(!lead['@_d'].includes('H'),'lead stays straight through socket center');
    const label=V.portLabel(c,R.ports(c).find(e=>e.key===p.key));
    assert.equal(label.spec.text,p.key==='b'?'−':Q.number(p.key==='a'?c.params.range:c.params.range/5));
  }
}
for(const type of ['ammeter','voltmeter'])for(const scale of [.4,.55,.69,1]){
  const d=M.empty(),c=M.add(d,type,300,320),result=S.solve(d),bounds=R.meterHousingBounds(c),svg=V.scene(d,result,scale);
  assert.equal((svg.match(/data-port-label=/g)||[]).length,3,'normal phone overview keeps all range labels');
  for(const p of R.ports(c)){const label=V.portLabel(c,p,scale),b=label.box;assert(b.left>=bounds.left&&b.right<=bounds.right&&b.top>=bounds.top&&b.bottom<=bounds.bottom);if(scale>=.55)near(label.size*scale,16);assert(b.top>=c.y+25.1,'range label uses the dedicated lower strip');}
}
for(const type of ['galvanometer','wattmeter']){
  const d=M.empty(),c=M.add(d,type,300,320),rest=S.solve(d).components[c.id];assert.equal(rest.reading,null);assert.equal(rest.meterStatus,'unconnected');
  const resting=V.body(c,rest,d.display);assert(resting.includes('data-fraction="0"'));assert(resting.includes('data-reading=""'));assert(V.body(c,null,{...d.display,values:false}).includes('data-meter-needle'),'toolbox icon has a resting pointer');
  for(const reading of [0,c.params.range/2,-c.params.range/2]){
    const body=V.body(c,{...rest,reading,meterStatus:'normal'},d.display),match=body.match(/data-meter-needle=[\s\S]*?data-fraction="([^"]+)"/);assert(match);near(+match[1],reading/c.params.range);
    assert(!V.body(c,{...rest,reading},{...d.display,values:false}).includes('data-meter-needle'),'hidden values do not reveal deflection');
  }
  assert(!V.body(c,{...rest,reading:null,meterStatus:'unknown'},d.display).includes('data-meter-needle'),'unknown result is not displayed as zero');
}
for(const state of ['unconnected','missing-common','dual-positive','unknown']){const c={id:'c1',type:'ammeter',params:R.defaults('ammeter')};const dial=V.dualDial(c,{reading:null,meterStatus:state});assert.equal(dial.includes('data-meter-needle='),['unconnected','missing-common'].includes(state));if(['unconnected','missing-common'].includes(state))assert(dial.includes('data-fraction="0"')); assert(!V.dualDial(c,{reading:.2,range:.6,activePort:'c'},false).includes('data-meter-needle='));}
for(const view of ['real','schematic'])for(const angle of [0,90,180,270])for(const scale of [.55,1.2]){
  const d=M.empty(),c=M.add(d,'wattmeter',300,320);c.angle=angle;d.display.view=view;
  const scene=V.scene(d,S.solve(d),scale);assert.equal(XMLValidator.validate('<svg>'+scene+'</svg>'),true);
  for(const p of R.ports(c)){
    const label=V.portLabel(c,p,scale,view),expected=(['a','b'].includes(p.key)?'I':'V')+'_{'+(['a','c'].includes(p.key)?'+':'-')+'}';assert.equal(label.spec.tex,expected);
    assert(scene.includes('data-tex="'+expected+'"'));assert(scene.includes('data-port-label="'+p.id+'"'));const glyph=Q.compiled(expected);assert(glyph.markup.includes('<path'));const m=Q.measure(expected,label.size);near(label.box.bottom-label.box.top,m.height+4/scale);
  }
}
console.log(`Meters and LaTeX: ${cases} signed/range/boundary fixtures, offset zero and calibrated negative ticks, mechanical travel, true signed values, restore/range continuation, actual self-contained TeX vector glyphs, wattmeter terminal glyph bounds and scientific notation passed.`);
