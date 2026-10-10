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
console.log('Compact AC meter vectors, fixed terminals, reversed RMS / signed power, and grouped preset names passed');
