'use strict';
const assert=require('node:assert/strict'),G=require('./circuit-generator-graphics'),AC=require('./circuit-ac-components'),M=require('./circuit-model'),R=require('./component-registry'),V=require('./circuit-renderer');
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const length=p=>Math.hypot(...p[0].map((x,i)=>x-p[1][i]));
const initial=G.geometry(0),reference=new Map(initial.map(p=>[p.id,p])),poses=new Set();
for(let n=0;n<=360;n++){
 const theta=n*Math.PI/180,parts=G.geometry(theta),byId=new Map(parts.map(p=>[p.id,p]));
 for(const part of parts){for(const point of part.points){assert(point.every(Number.isFinite));const p=G.project(point);assert(p[0]>=-46&&p[0]<=46&&p[1]>=-40&&p[1]<=40,part.id);}if(part.local)near(length(part.points),length(reference.get(part.id).points));}
 for(let i=0;i<4;i++)near(G.project(byId.get('north-front').points[i])[1],G.project(byId.get('south-front').points[i])[1]);
 near(G.project(byId.get('N').points[0])[1],G.project(byId.get('S').points[0])[1]);
 const end=turn=>parts.filter(p=>p.id.startsWith('winding-'+turn+'-')).sort((a,b)=>Number(a.id.split('-').at(-1))-Number(b.id.split('-').at(-1))).at(-1).points[1];
 assert.deepEqual(byId.get('tail-a-1').points[0],byId.get('winding-0-1').points[0]);
 assert.deepEqual(byId.get('tail-b-1').points[0],end(1));
 assert.deepEqual(byId.get('series-1').points[0],end(0));
 assert.deepEqual(byId.get('series-3').points[1],byId.get('winding-1-1').points[0]);
 poses.add(byId.get('winding-0-1').d);
}
assert(poses.size>300,'angle must not be quantized into a few drawings');
for(const ring of [1,2]){
 const faces=initial.filter(p=>p.id.startsWith('ring-'+ring+'-face-')).sort((a,b)=>Number(a.id.split('-').at(-1))-Number(b.id.split('-').at(-1)));
 assert.equal(faces.length,20);
 for(let i=0;i<20;i++)for(let axis=0;axis<3;axis++)near(faces[i].points[1][axis],faces[(i+1)%20].points[0][axis]);
}
const c=M.component(M.empty('transient'),'generator',160,200),before=JSON.stringify(c);
let lastSpacing=Infinity;
for(const field of [0,.001,.01,.1,.2,1,10]){
 const parts=G.geometry(0,field),lines=parts.filter(p=>/^field-\d+$/.test(p.id)&&p.fieldActive).sort((a,b)=>a.points[0][1]-b.points[0][1]);
 if(field===0){assert.equal(lines.length,0);continue;}assert(lines.length>=5&&lines.length<=13);assert.equal(lines[0].points[0][1],-16);assert.equal(lines.at(-1).points[0][1],16);const spacing=lines[1].points[0][1]-lines[0].points[0][1];assert(spacing<=lastSpacing);lastSpacing=spacing;
 for(let n=1;n<lines.length;n++)near(lines[n].points[0][1]-lines[n-1].points[0][1],spacing);
 assert(lines.every(p=>Math.abs(p.points[0][1])<=18.6&&p.points[0][0]===-25&&p.points[1][0]===25));
 assert(parts.filter(p=>p.field).every(p=>p.points.every(v=>v[1]>=-19&&v[1]<=21)),'all field lines and arrowheads stay between the facing poles');
 assert.deepEqual(parts.filter(p=>p.field).map(p=>p.d),G.geometry(1.2,field).filter(p=>p.field).map(p=>p.d),'rotor phase does not change the permanent field');
 const model=G.render({...c,params:{...c.params,field}},{phase:0},true);
 assert.equal((model.match(/data-generator-field="true"/g)||[]).length,26);
 if(field>0)assert.equal((model.match(/data-generator-field="true" opacity="1"/g)||[]).length,2*lines.length);
}
// Independently integrate (v × B)·dl along the A→B winding. Its negative
// must have the sign of the a−b source voltage in both half cycles.
for(const theta of [Math.PI/4,Math.PI/2,5*Math.PI/4,3*Math.PI/2]){
 const h=1e-5,now=G.geometry(theta),left=new Map(G.geometry(theta-h).map(p=>[p.id,p])),right=new Map(G.geometry(theta+h).map(p=>[p.id,p]));
 let emf=0;
 for(const part of now.filter(p=>p.id.startsWith('winding-'))){const v=part.points.map((_,i)=>(right.get(part.id).points[i][1]-left.get(part.id).points[i][1])/(2*h));emf-=((v[0]+v[1])/2)*(part.points[1][2]-part.points[0][2]);}
 assert.equal(Math.sign(-emf),Math.sign(AC.source(c,theta)));
}
for(const angle of [0,90,180,270]){
 c.angle=angle;const ports=R.ports(c);
 for(const phase of [0,.017,.42,1.57,Math.PI,5.9]){
  const r={phase},real=V.body(c,r,{view:'real',fields:true});assert(real.includes('data-generator-model="rectangular"'));assert(real.includes('data-generator-angle="'+phase+'"'));assert.deepEqual(R.ports(c),ports);
  const noField=V.body(c,r,{view:'real',fields:false});assert(noField.includes('data-generator-fields="false"'));assert.equal((noField.match(/data-generator-field="true" opacity="0"/g)||[]).length,26);
  assert(!V.body(c,r,{view:'schematic',values:true}).includes('data-generator-model'));
 }
}
c.angle=0;assert.equal(JSON.stringify(c),before);assert.equal(AC.types.generator.ports[0].x,-60);assert.equal(AC.types.generator.ports[1].x,60);
console.log('Generator: 361 rigid poses, aligned poles, continuous winding/rings, fixed ports and display modes passed');
