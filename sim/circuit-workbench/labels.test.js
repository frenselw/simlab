'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),R=require('./component-registry'),G=require('./circuit-routing'),S=require('./circuit-solver'),D=require('./circuit-document'),V=require('./circuit-renderer'),P=require('./presets'),{XMLValidator}=require('fast-xml-parser');
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function verify(d,scale=1,viewport=null){
  const before=D.encode(d),r=S.solve(d),routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)])),placed=V.labels(d,r,scale,routes,viewport);
  assert(placed.every(p=>!p.crowded),'test circuit has enough clear room for every label');
  for(const [i,p]of placed.entries()){
    for(const q of placed.slice(i+1))assert(!overlap(p.box,q.box),'labels cannot overlap');
    for(const points of Object.values(routes))for(const q of G.resample(points,Math.ceil(G.length(points)*scale/.5)+1))assert(!(q.x>p.box.left-3/scale&&q.x<p.box.right+3/scale&&q.y>p.box.top-3/scale&&q.y<p.box.bottom+3/scale),'actual wire samples stay outside the label and visible stroke margin');
    if(viewport)assert(p.box.left>=viewport.x&&p.box.right<=viewport.x+viewport.width&&p.box.top>=viewport.y&&p.box.bottom<=viewport.y+viewport.height,'clear labels stay inside the viewport');
  }
  assert.equal(D.encode(d),before,'layout never writes authoritative positions or readings');assert.deepEqual(V.labels(d,r,scale,routes,viewport),placed,'cold layout is deterministic');
  assert.equal(XMLValidator.validate('<svg>'+V.scene(d,r,scale,routes,null,false,viewport)+'</svg>'),true);return placed;
}
for(const view of ['real','schematic'])for(const angle of [0,90,180,270])for(const scale of [.55,1,1.6]){
  const d=M.empty(),lamp=M.add(d,'lamp',300,260),neighbor=M.add(d,'resistor',300,380);lamp.angle=angle;d.display.view=view;
  const ports=R.ports(lamp),w=M.connect(d,ports[0].id,ports[1].id,[{x:220,y:326},{x:380,y:326}],'free');w.length=1000;
  const placed=verify(d,scale);assert(placed.some(p=>p.id===lamp.id));const oldLabel={x:300,y:326};assert(G.nearest(G.route(d,w),oldLabel).distance<1,'fixture crosses the former fixed label position');
  neighbor.x+=60;neighbor.y-=20;verify(d,scale);const restored=D.decode(D.encode(d));M.add(restored,'switch',580,440);M.validate(restored);verify(restored,scale);
}
for(const width of [320,390,1028])for(const height of [360,600])for(const name of ['series','parallel','mixed','ohm','meters','bridge'])for(const view of ['real','schematic']){
  const d=P.create(name);d.display.view=view;const points=[...d.components.flatMap(c=>[{x:c.x-90,y:c.y-90},{x:c.x+90,y:c.y+130}]),...d.wires.flatMap(w=>G.route(d,w))],x0=Math.min(...points.map(p=>p.x)),x1=Math.max(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y)),y1=Math.max(...points.map(p=>p.y)),scale=Math.min(1.2,(width-40)/(x1-x0),(height-40)/(y1-y0));
  const viewport={x:(x0+x1)/2-width/(2*scale),y:(y0+y1)/2-height/(2*scale),width:width/scale,height:height/scale};verify(d,scale,viewport);
}
for(const names of [false,true])for(const values of [false,true]){
  const d=P.create('series');Object.assign(d.display,{names,values});const restored=D.decode(D.encode(d));assert.equal(restored.display.names,names);assert.equal(restored.display.values,values);const svg=V.scene(restored,S.solve(restored));assert.equal(svg.includes('data-component-label='),names);assert.equal(svg.includes('data-component-value='),values);assert.equal(D.template(restored).display.names,names);assert.equal(D.template(restored).display.values,values);restored.components[1].params.closed=false;M.validate(restored);S.solve(restored);
}
for(const version of [1,2,3,4]){const d=P.create('series');d.version=version;delete d.display.names;if(version<3){delete d.cables;d.wires.forEach(w=>delete w.length);}if(version===1)d.wires.forEach(w=>delete w.shape);const restored=D.decode(JSON.stringify(d));assert.equal(restored.display.names,true);assert.equal(restored.version,4);restored.display.names=false;assert.equal(D.decode(D.encode(restored)).display.names,false);M.addWire(restored,900,600);D.decode(D.encode(restored));}
for(const invalid of [null,0,'true',{},[]]){const d=P.create('series');d.display.names=invalid;assert.throws(()=>M.validate(d),'names must be boolean when provided');}
const long=M.empty(),c=M.add(long,'resistor',200,200);c.label='這是一個需要自動換行顯示的較長元件名稱 <>&';const rows=verify(long)[0].rows;assert(rows.filter(r=>r.kind==='name').length>1);assert(rows.every(r=>r.size>=12));assert(V.scene(long,S.solve(long)).includes('&lt;&gt;&amp;'),'names are escaped as text');
console.log('Adaptive labels: actual cable sample clearance, rotated/nearby components, 72 responsive example layouts, stable pure layout, wrapped escaped names, independent visibility, strict optional v4 defaults and legal restored continuation passed.');
