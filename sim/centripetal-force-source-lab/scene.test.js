'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),V=require('./scene.js'),P=require('./persistence.js'),S=require('./scoring.js');
const s=M.fresh(()=>.2);
for(let page=0;page<6;page++)for(const [w,h]of [[256,80],[326,371],[876,690]]){
  const initial=V.scene(page,s.def,{w,h},.13),later=V.scene(page,s.def,{w,h},.63);
  assert.notEqual(initial,later);assert(!/NaN|Infinity|undefined/.test(initial));
  assert(initial.includes('data-object="'+['ball','block','ball','car','car','earth'][page]+'"'));
  assert(V.duration(s.def,page)>=3);
}
for(const page of [3,4]){
  const middle=V.carPose(page,600,400,.5),before=V.carPose(page,600,400,.25),after=V.carPose(page,600,400,.75);
  assert.equal(middle.x,300);assert.equal(Math.abs(middle.rotation),0);assert.equal(before.y,after.y);
  assert(page===3?middle.y<before.y:middle.y>before.y);
  assert.equal(V.carPose(page,600,400,1.5).y,middle.y);
  for(const [w,h]of [[256,80],[326,371],[876,690]]){
    const svg=V.scene(page,s.def,{w,h},.5),road=svg.match(/data-road="surface" d="([^"]+)"/)[1],points=road.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi).map(Number);
    const [x0,y0,cx,cy,x1,y1]=points;
    assert.equal(x0,0);assert.equal(x1,w);assert.equal(cx,w/2);assert.equal(y0,y1);assert(y0>=0&&y0<h);
    for(const t of [0,.1,.25,.5,.75,.9,.9999]){
      const p=V.carPose(page,w,h,t),u=p.x/w,y=(1-u)**2*y0+2*(1-u)*u*cy+u*u*y1,slope=2*((1-u)*(cy-y0)+u*(y1-cy))/w;
      assert(Math.abs(p.y-y)<1e-8,'car stays on the extended road');assert(Math.abs(p.rotation-Math.atan(slope)*180/Math.PI)<1e-8,'car follows the continuous road tangent');
    }
  }
}
const far=V.pendulumPose(160,200,80,Math.PI/2),near=V.pendulumPose(160,200,80,3*Math.PI/2);
assert(near.scale/far.scale>1.5&&near.y>far.y,'near side must be visibly larger and lower');
for(let i=0;i<=36;i++){
  const a=i*Math.PI/18,p=V.pendulumPose(160,200,80,a),rx=80/Math.sqrt(1-.26**2),ry=80*.28/(1-.26**2),cy=200+.26*ry;
  assert(Math.abs(((p.x-160)/rx)**2+((p.y-cy)/ry)**2-1)<1e-10,'bob must follow its projected orbit');
}
assert(Math.abs(V.pendulumPose(160,200,80,0).x-V.pendulumPose(160,200,80,2*Math.PI).x)<1e-8,'perspective must loop continuously');
for(const [w,h]of [[256,80],[256,220],[326,371],[876,690]]){
  const scale=Math.max(.5,Math.min(1.25,w/460,h/290)),half=4*scale;
  for(let i=0;i<360;i++){
    const svg=V.scene(2,s.def,{w,h},i/360),match=svg.match(/data-object="ball"><circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/),[x,y,radius]=match.slice(1).map(Number);
    for(const [x1,y1,x2,y2]of [[w*.045,h*.12,w*.045,h*.88],[w*.015,h*.88,w*.085,h*.88],[w*.045,h*.12,w/2+25*scale,h*.12]]){
      const px=Math.max(x1,Math.min(x2,x)),py=Math.max(y1,Math.min(y2,y));
      assert(Math.hypot(x-px,y-py)>radius+half+8,`pendulum hits support at ${w}x${h}, phase ${i}/360`);
    }
  }
  for(const page of [0,1,2,5])for(const svg of [V.scene(page,s.def,{w,h},.35),V.backdrop(page,s.def,{w,cx:w/2,cy:h/2,scale},null)]){
    assert(svg.includes('class="circle-center"')&&svg.includes('data-tex="O"'),'circle center needs a point and LaTeX O');
  }
}
assert.equal(V.nextTarget(.2),.5);assert.equal(V.nextTarget(.5),.5);assert.equal(V.nextTarget(.7),1.5);assert.equal(V.nextTarget(2.9),3.5);
for(const pose of [0,1345,3876,5000,9999]){
  // Older saved attempts keep their original observation and answers.
  let state=M.navigate(s,5);state.items[5].pose=pose;state.view='analysis';
  const p=M.physics(state.def,5,pose),a=state.items[5];a.inward=p.inward;a.arrows=p.forces.map(f=>[f[0],f[1],60]);a.relation=M.CASES[5].relation;
  assert.equal(S.score(state).detail[5].earned,16);
  const copy=P.decode({version:1,activity:M.ACTIVITY,kind:'draft',answer:P.draft(state)},'draft');
  assert.equal(copy.items[5].pose,pose);assert.equal(M.change(copy,{type:'analyse',pose:1234}).items[5].pose,pose);
  const cleared=M.change(copy,{type:'clear-page'}),aligned=M.change(cleared,{type:'analyse',pose:1234});assert.equal(aligned.items[5].pose,1250);
  const restored=P.decode({version:1,activity:M.ACTIVITY,kind:'draft',answer:P.draft(aligned)},'draft');assert.deepEqual(restored,aligned);
  const resumed=M.change(restored,{type:'inward',value:M.inward(restored.def,5,1250)});assert.equal(resumed.items[5].pose,1250);
}
let drawn=M.change(s,{type:'palette',value:2});drawn=M.change(drawn,{type:'draw',angle:1800,length:70});assert.deepEqual(drawn.items[0].arrows,[[2,1800,70]]);
assert.deepEqual(s.items[0].arrows,[]);assert.throws(()=>M.change(drawn,{type:'draw',angle:NaN,length:70}));
console.log('Centripetal scenes: six visible objects, moving poses, bridge target crossing, legacy Earth scoring, aligned pose continuation and atomic drawing passed.');
