'use strict';
const assert=require('node:assert/strict'),F=require('./presentation.js'),M=require('./model.js');
global.CircuitMath=require('../circuit-workbench/circuit-math.js');
assert(F.math('\\Delta x','Δx').includes('data-tex="\\Delta x"'));
assert(!F.prose('Δx / Δt；Δv').includes('<text'));
let cases=0;
for(const [w,h]of [[320,77],[160,77],[160,220],[195,371],[390,371],[920,730]])for(let angle=0;angle<360;angle+=3)for(const gap of [5,60])for(const sense of [-1,1])for(const velocity of [false,true])for(const review of [false,true]){
  const {compact,r,center:o,labelTop}=F.positionGeometry(w,h,h<140?22:36,velocity),at=t=>[o[0]+r*Math.cos(t),o[1]-r*Math.sin(t)];
  const theta=angle*Math.PI/180,A=at(theta),B=at(theta+sense*gap*Math.PI/180),segments=[];
  const endpoint=(p,v,length)=>{const n=Math.hypot(...v);return[p[0]+v[0]/n*length,p[1]+v[1]/n*length];};
  if(velocity){const scale=Math.max(18,Math.min(w-68,h-92,330))*.5;segments.push([A,[A[0]-sense*Math.sin(theta)*scale,A[1]-sense*Math.cos(theta)*scale]],[B,[B[0]-sense*Math.sin(theta+sense*gap*Math.PI/180)*scale,B[1]-sense*Math.cos(theta+sense*gap*Math.PI/180)*scale]]);const change=M.subtract(M.subtract(segments[1][1],B),M.subtract(segments[0][1],A));segments.push([A,endpoint(A,change,Math.max(20,r*.95))]);}
  else segments.push([A,B],[A,endpoint(A,M.subtract(B,A),Math.max(22,r*.8))]);
  if(review)segments.push([A,endpoint(A,[-sense*Math.sin(theta),-sense*Math.cos(theta)],r*.65)]);
  let labels;try{labels=F.labels([A,B],o,r,w,h,segments,compact,labelTop);}catch(error){throw Error(JSON.stringify({w,h,angle,gap,sense,velocity,review,r,o,labelTop})+error.message);}
  labels.forEach(p=>{assert(Math.hypot(p.x-o[0],p.y-o[1])>=r+29);assert(segments.every(([a,b])=>!F.intersects(p.box,a,b)));assert(p.box[0]>=5&&p.box[2]<=w-5&&p.box[1]>=0&&p.box[3]<=h-5);});
  const [a,b]=labels.map(p=>p.box);assert(a[2]+8<b[0]||a[0]-8>b[2]||a[3]+8<b[1]||a[1]-8>b[3]);cases++;
}
const angles=new Set();
for(let angle=0;angle<360;angle++){
  const draws=[Math.floor(angle/90)/4,0,0,((angle%90)+.5)/90],s=M.fresh(()=>draws.shift()??0);
  angles.add(Math.round(M.scene(s).thetaA*180/Math.PI));
}
assert.equal(angles.size,360);
let centered=0;
for(let angle=0;angle<360;angle+=3)for(const sense of [-1,1])for(let gap=5;gap<=60;gap++){
  const s=M.fresh(()=>0);s.definition={startIndex:Math.floor(angle/90),startOffsetDeg:angle%90,sense,choiceShift:0};s.task=1;s.observation.velocityGapDeg=gap;
  const nodes=M.scene(s).nodes,origin=F.velocityOrigin(nodes,332.5,265.75,173.75),points=Object.values(nodes).map(p=>[origin[0]+p[0]*173.75,origin[1]-p[1]*173.75]);
  for(let axis=0;axis<2;axis++){const values=points.map(p=>p[axis]);assert(Math.abs((Math.min(...values)+Math.max(...values))/2-[332.5,265.75][axis]/2)<1e-9);}
  centered++;
}
console.log(`Velocity diagram: ${centered} angle/sense/gap configurations center the full S/U/V extent without changing scale.`);
console.log(`Circular vector presentation: ${cases} crowded label layouts; all 360 fresh starting angles and local math glyphs passed.`);

let chinese=0;
assert.equal(F.nodeName('U'),'初速度末端');assert.equal(F.nodeName(null),'未選');
for(const [width,height]of [[129,173],[160,77],[160,200],[160,260],[195,439],[332.5,314],[460,730]])for(let angle=0;angle<360;angle+=6)for(const sense of [-1,1])for(let gap=5;gap<=60;gap++){
  const s=M.fresh(()=>0);s.definition={startIndex:Math.floor(angle/90),startOffsetDeg:angle%90,sense,choiceShift:0};s.task=1;s.observation.velocityGapDeg=gap;
  const unit=Math.max(18,Math.min(width-68,height-92,330)),g=M.scene(s),origin=F.velocityOrigin(g.nodes,width,height,unit),nodes=Object.fromEntries(Object.entries(g.nodes).map(([k,p])=>[k,[origin[0]+unit*p[0],origin[1]-unit*p[1]]])),segments=[[nodes.S,nodes.U],[nodes.S,nodes.V],[nodes.U,nodes.V]];
  let labels;try{labels=F.velocityLabels(nodes,width,height);}catch(error){throw Error(JSON.stringify({width,height,angle,sense,gap})+error.message);}
  assert.equal(labels.length,3);labels.forEach(p=>{assert(!/[SUV]/.test(p.label));assert(p.box[0]>=0&&p.box[2]<=width&&p.box[1]>=0&&p.box[3]<=height);assert(segments.every(([a,b])=>!F.intersects(p.box,a,b)));});
  chinese++;
}
console.log(`Chinese velocity annotations: ${chinese} crowded graph layouts passed.`);
const wideNodes={S:[570,315],U:[710,395],V:[725,370]};
for(const p of F.velocityLabels(wideNodes,1290,730))assert(Math.hypot(p.x-wideNodes[p.key][0],p.y-wideNodes[p.key][1])<100,'wide-screen endpoint label too far from its point');

const nodes={S:[90,170],U:[170,105],V:[195,145]},specs=[{key:'v1',tex:'v_1',from:nodes.S,to:nodes.U},{key:'v2',tex:'v_2',from:nodes.S,to:nodes.V},{key:'dv',tex:'\\Delta v',from:nodes.U,to:nodes.V}],segments=specs.map(p=>[p.from,p.to]),occupied=F.velocityLabels(nodes,332,314).map(p=>p.box),annotations=F.quantityLabels(specs,332,314,segments,occupied,35);
for(let i=0;i<annotations.length;i++){const p=annotations[i];assert(p.box[0]>=0&&p.box[2]<=332&&p.box[1]>=35&&p.box[3]<=314);assert(!segments.some(([a,b])=>F.intersects(p.box,a,b)));for(const b of occupied.concat(annotations.slice(0,i).map(p=>p.box)))assert(p.box[2]<=b[0]||p.box[0]>=b[2]||p.box[3]<=b[1]||p.box[1]>=b[3]);}
for(const p of annotations)assert(Math.hypot(p.x-(p.from[0]+p.to[0])/2,p.y-(p.from[1]+p.to[1])/2)<120,'quantity label too far from its arrow');
assert.equal(annotations.length,3);console.log('Direct v1/v2/Delta-v labels stay separate from arrows and Chinese endpoint labels.');

assert(!/vec|overrightarrow/.test(F.prose('Δv v₁ v₂')));
for(let angle=0;angle<360;angle+=15)for(const gap of [5,60]){
  const s=M.fresh(()=>0);s.definition.startIndex=Math.floor(angle/90);s.definition.startOffsetDeg=angle%90;s.observation.positionGapDeg=gap;
  const g=M.scene(s),p=F.positionGeometry(390,439,36),at=r=>[p.center[0]+r[0]*p.r/.5,p.center[1]-r[1]*p.r/.5],A=at(g.rA),B=at(g.rB),segments=[[A,B]],occupied=F.labels([A,B],p.center,p.r,390,439,segments,false,p.labelTop).map(p=>p.box),q=F.quantityLabels([{tex:'\\Delta x',from:A,to:B}],390,439,segments,occupied,p.labelTop,{center:p.center,r:p.r})[0],b=q.box,[cx,cy]=p.center;
  const near=Math.hypot(Math.max(b[0]-cx,0,cx-b[2]),Math.max(b[1]-cy,0,cy-b[3])),far=Math.hypot(Math.max(Math.abs(cx-b[0]),Math.abs(cx-b[2])),Math.max(Math.abs(cy-b[1]),Math.abs(cy-b[3])));
  assert(near>=p.r+4||far<=p.r-4,'Delta x label crosses circle');
}
console.log('Textbook symbols have no vector accent; displacement labels avoid the circle edge in 48 orientations/gaps.');


let combined=0;
for(const [width,height]of [[160.5,83],[160.5,260],[195.5,439],[240.5,171],[240.5,75],[189.5,171],[270,623]])for(let angle=0;angle<360;angle+=15)for(const sense of [-1,1])for(const gap of [5,30,60])for(const pair of [[null,null],['U','V'],['V','U'],['S','U'],['S','V'],['U','S'],['V','S']])for(const review of [false,true]){
  const s=M.fresh(()=>0);s.task=1;s.definition={startIndex:Math.floor(angle/90),startOffsetDeg:angle%90,sense,choiceShift:0};s.observation.velocityGapDeg=gap;
  const g=M.scene(s),p=F.positionGeometry(width,height,36,true),room=Math.max(p.r+1,Math.min(width/2-16,height/2-23)),unit=Math.max(18,Math.min(width-68,height-92,330,Math.sqrt(room*room-p.r*p.r)/M.SPEED)),origin=F.velocityOrigin(g.nodes,width,height,unit),nodes=Object.fromEntries(Object.entries(g.nodes).map(([k,p])=>[k,[origin[0]+unit*p[0],origin[1]-unit*p[1]]])),endpoints=F.velocityLabels(nodes,width,height);
  const specs=[{tex:'v_1',from:nodes.S,to:nodes.U},{tex:'v_2',from:nodes.S,to:nodes.V}];
  if(pair[0])specs.push({tex:'\\Delta v',from:nodes[pair[0]],to:nodes[pair[1]]});
  if(review&&(pair[0]!=='U'||pair[1]!=='V'))specs.push({tex:'\\Delta v',from:nodes.U,to:nodes.V});
  const segments=specs.map(p=>[p.from,p.to]),occupied=[...endpoints.map(p=>p.box),...Object.values(nodes).map(p=>[p[0]-9,p[1]-9,p[0]+9,p[1]+9])],labels=F.quantityLabels(specs,width,height,segments,occupied,height<150?0:35);
  for(const label of labels){const box=label.box,context=JSON.stringify({width,height,angle,sense,gap,pair,review,tex:label.tex});assert(box[0]>=0&&box[1]>=0&&box[2]<=width&&box[3]<=height,context);assert(occupied.every(b=>box[2]<=b[0]||box[0]>=b[2]||box[3]<=b[1]||box[1]>=b[3]),context);assert(segments.every(([a,b])=>!F.intersects(box,a,b)),context);occupied.push(box);}
  combined++;
}
console.log(`Combined endpoint/quantity placement: ${combined} source geometry cases, including wrong answers and review references, passed.`);

for(let angle=0;angle<360;angle++)for(const sense of [-1,1])for(const pair of [['U','V'],['V','U'],['S','V']]){
  const s=M.fresh(()=>0);s.task=1;s.definition={startIndex:Math.floor(angle/90),startOffsetDeg:angle%90,sense,choiceShift:0};s.observation.velocityGapDeg=5;
  const g=M.scene(s),p=F.positionGeometry(159.5,83,22,true),at=(v,o,u)=>[o[0]+u*v[0],o[1]-u*v[1]],A=at(g.rA,p.center,p.r/M.RADIUS),B=at(g.rB,p.center,p.r/M.RADIUS),segments=[[A,at(g.vA,A,18)],[B,at(g.vB,B,18)]],v=M.subtract(g.nodes[pair[1]],g.nodes[pair[0]]),n=M.length(v),tangent=M.direction(s,1,'forward-tangent');
  segments.push([A,[A[0]+20*v[0]/n,A[1]-20*v[1]/n]],[A,[A[0]+tangent[0]*p.r*.65,A[1]-tangent[1]*p.r*.65]]);
  const pointLabels=F.labels([A,B],p.center,p.r,159.5,83,segments,true,p.labelTop);assert.equal(pointLabels.length,2,JSON.stringify({angle,sense,pair}));
  const time=CircuitMath.measure('\\Delta t=0.0873\\,\\mathrm{s}',16),origin=CircuitMath.measure('O',22),occupied=[...pointLabels.map(p=>p.box),...[A,B,p.center].map(p=>[p[0]-10,p[1]-10,p[0]+10,p[1]+10]),[p.center[0]-time.width/2,0,p.center[0]+time.width/2,23],[p.center[0]+16-origin.width/2,p.center[1]+8-origin.ascent,p.center[0]+16+origin.width/2,p.center[1]+8+origin.descent]];
  for(const q of F.quantityLabels([{tex:'v_1',from:A,to:segments[0][1]},{tex:'v_2',from:B,to:segments[1][1]}],159.5,83,segments,occupied,0,{center:p.center,r:p.r})){const box=q.box;assert(occupied.every(b=>box[2]<=b[0]||box[0]>=b[2]||box[3]<=b[1]||box[1]>=b[3]),JSON.stringify({angle,sense,pair,box}));occupied.push(box);}
}
console.log('Short-player review: A/B labels render at every integer starting angle, both senses and three drawing directions.');
