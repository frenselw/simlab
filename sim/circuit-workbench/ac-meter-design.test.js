'use strict';
const assert=require('node:assert/strict'),{XMLParser,XMLValidator}=require('fast-xml-parser'),M=require('./circuit-model'),R=require('./component-registry'),V=require('./circuit-renderer'),N=require('./circuit-meter-motion'),T=require('./circuit-transient'),P=require('./circuit-ac-presets'),{fixture}=require('../../tools/circuit-meter-design-browser-cases');
for(const [type,options,expected]of [['ac-ammeter',{},.5],['ac-ammeter',{reverseCurrent:true},.5],['ac-voltmeter',{},6],['ac-voltmeter',{reverseVoltage:true},6],['ac-wattmeter',{},3],['ac-wattmeter',{reverseCurrent:true},-3],['ac-wattmeter',{reverseVoltage:true},-3],['ac-wattmeter',{reverseCurrent:true,reverseVoltage:true},3]]){
 const s=new T.Session(fixture(type,options));s.advance(1.1);const r=s.read().components.c2;assert.equal(r.meterStatus,'normal');assert(Math.abs(r.reading-expected)<.015);
 const c=s.doc.components[1],before=JSON.stringify(s.capture());
 for(const view of ['real','schematic']){const svg='<svg>'+V.body(c,r,{view,values:true})+'</svg>';assert.equal(XMLValidator.validate(svg),true);assert(svg.includes('data-tex='));assert(!svg.includes('<text'));assert(!svg.includes('未接妥'));}
 const face=V.body(c,r,{view:'real',values:true}),xml=new XMLParser({ignoreAttributes:false}).parse('<svg>'+face+'</svg>');assert(xml.svg.g);assert(face.includes('width="92" height="78"'));assert.equal(JSON.stringify(s.capture()),before);
 const needle=N.point(c,.5);assert.equal(needle.cy,16);assert.equal(N.scale(c).radius,34);
 const ports=R.ports(c);assert.deepEqual(ports.map(p=>[p.key,p.x-c.x,p.y-c.y]),type==='ac-wattmeter'?[['a',-60,-20],['b',60,-20],['c',-60,40],['d',60,40]]:[['a',-60,0],['b',60,0]]);
 if(type==='ac-wattmeter')for(const p of ports){const a=V.portLabel(c,p);assert(a.spec.tex.includes('_{'));}else assert(ports.every(p=>p.labelVisible===false));
}
assert.equal(new Set(P.groups.flatMap(g=>g.keys)).size,Object.keys(P.names).length-1);assert.deepEqual(P.groups.flatMap(g=>g.keys),Object.keys(P.names).filter(k=>k!=='empty'));
assert(Object.values(P.names).every(name=>name==='空白電路'||name.includes('：')));
// Screen-sized terminal labels must clear the actual housing at overview zooms and every rotation.
for(const view of ['real','schematic'])for(const angle of [0,90,180,270])for(const scale of [.4,.55,1,1.8]){
 const d=M.empty('transient'),c=M.add(d,'ac-wattmeter',300,320);c.angle=angle;
 const body=view==='real'?R.bodyBounds(c):{left:c.x-31,right:c.x+31,top:c.y-31,bottom:c.y+31};
 const labels=R.ports(c).map(p=>V.portLabel(c,p,scale,view).box),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 for(const [i,box]of labels.entries()){assert(!overlap(box,body),`${view}/${angle}/${scale}: terminal label overlaps case`);for(const other of labels.slice(i+1))assert(!overlap(box,other),'terminal labels remain distinct');}
}
console.log('Compact AC meter vectors, fixed terminals, reversed RMS / signed power, terminal clearance at four angles/zooms, and grouped preset names passed');
