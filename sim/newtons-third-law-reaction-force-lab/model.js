(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ReactionModel=api;})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const clone=x=>JSON.parse(JSON.stringify(x)), clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), normalize=a=>(a%360+360)%360;
  const angleDelta=(a,b)=>Math.abs((normalize(a-b)+180)%360-180), blank=()=>[null,null,null,null,null];
  const emptyAnswers=()=>[2,2,2,1,1].map(n=>Array.from({length:n},blank));
  function validRecord(r,q){
    if(!Array.isArray(r)||r.length!==5)return false;
    const [b,a,k,d,f]=r, body=q.bodies.find(x=>x.id===b);
    if(b!==null&&(!Number.isInteger(b)||!body))return false;
    if(a!==null&&(!Number.isInteger(a)||!body?.anchors.some(x=>x.id===a)))return false;
    if(k!==null&&(!Number.isInteger(k)||k<0||k>4))return false;
    if(d===null||f===null)return d===null&&f===null;
    return a!==null&&Number.isInteger(d)&&d>=0&&d<3600&&Number.isInteger(f)&&f>=1&&f<=q.maxForce100;
  }
  const validAnswer=(a,q)=>Array.isArray(a)&&a.length===q.targets.length&&a.every(r=>validRecord(r,q));
  const started=r=>r.some(x=>x!==null), complete=r=>r.every(x=>x!==null);
  function change(answer,action,q){
    const a=clone(answer), i=action.index;
    if(action.type==="clear")return q.targets.map(blank);
    if(!Number.isInteger(i)||!a[i])return a;
    const r=a[i];
    if(action.type==="body"){if(action.body===r[0])return a;r[0]=action.body;r[1]=r[3]=r[4]=null;}
    else if(action.type==="anchor")r[1]=action.anchor;
    else if(action.type==="kind")r[2]=action.kind;
    else if(action.type==="remove")a[i]=blank();
    else if(action.type==="place"){r[1]=action.anchor??r[1];r[3]=Math.round(normalize(action.angle)*10)%3600;r[4]=clamp(Math.round(action.force*100),1,q.maxForce100);}
    else return a;
    return validAnswer(a,q)?a:clone(answer);
  }
  function layout(width,height,q){
    const unit=Math.min((width-88)/7,(height-64)/4.2), forceScale=1.8/(Math.max(...q.given.map(f=>f.force100))/100);
    return {width,height,unit,forceScale,cx:width/2,cy:height/2-5,left:56,right:width-56,top:40,bottom:height-32};
  }
  const pixel=(p,l)=>({x:l.cx+p.x*l.unit,y:l.cy-p.y*l.unit});
  const origin=(r,q)=>q.bodies.find(b=>b.id===r[0])?.anchors.find(a=>a.id===r[1])?.point||null;
  function endpoint(r,q,l){const o=origin(r,q);if(!o)return null;const p=pixel(o,l);if(r[3]===null)return p;const a=r[3]*Math.PI/1800,length=r[4]/100*l.forceScale*l.unit;return {x:p.x+Math.cos(a)*length,y:p.y-Math.sin(a)*length};}
  function handle(p,l){const x=clamp(p.x,l.left,l.right),y=clamp(p.y,l.top,l.bottom);return {x,y,offscale:Math.abs(x-p.x)>.01||Math.abs(y-p.y)>.01};}
  function references(q){const angles=[0,90,180,270];
    if(q.family===0){const a=q.params.mirror?180-q.params.theta:q.params.theta;angles.push(a,a+90,a+180,a+270);}
    if(q.family===3){const a=q.params.theta+90;angles.push(a,a+180);}
    if(q.family===4)angles.push(q.params.angle,q.params.angle+180);
    return [...new Set(angles.map(normalize))];
  }
  function snap(angle,refs,type,previous=null){const entry=type==="touch"?6:4,leave=type==="touch"?9:6;
    if(previous!==null&&angleDelta(angle,previous)<=leave)return {angle:previous,target:previous};
    const near=refs.reduce((best,a)=>angleDelta(a,angle)<angleDelta(best,angle)?a:best,refs[0]);
    return angleDelta(near,angle)<=entry?{angle:near,target:near}:{angle:normalize(angle),target:null};
  }
  function fromPoint(r,q,l,p,type,previous=null){
    const o=origin(r,q);if(!o)return null;const start=pixel(o,l),dx=p.x-start.x,dy=start.y-p.y,radius=Math.hypot(dx,dy);if(radius<3)return null;
    const resolved=snap(Math.atan2(dy,dx)*180/Math.PI,references(q),type,previous);
    let force=radius/(l.unit*l.forceScale);const tick=Math.round(force*10)/10,threshold=type==="touch"?5:3;
    if(Math.abs(tick-force)<=.05+1e-9&&Math.abs(tick-force)*l.unit*l.forceScale<=threshold)force=tick;
    return {record:[r[0],r[1],r[2],Math.round(resolved.angle*10)%3600,clamp(Math.round(force*100),1,q.maxForce100)],target:resolved.target};
  }
  class History{constructor(){this.undo=Array.from({length:5},()=>[]);this.redo=Array.from({length:5},()=>[]);}record(i,a){this.undo[i].push(clone(a));if(this.undo[i].length>20)this.undo[i].shift();this.redo[i]=[];}apply(i,a,redo=false){const from=redo?this.redo[i]:this.undo[i],to=redo?this.undo[i]:this.redo[i];if(!from.length)return clone(a);to.push(clone(a));return from.pop();}}
  return Object.freeze({clone,clamp,normalize,angleDelta,blank,emptyAnswers,validRecord,validAnswer,started,complete,change,layout,pixel,origin,endpoint,handle,references,snap,fromPoint,History});
});
