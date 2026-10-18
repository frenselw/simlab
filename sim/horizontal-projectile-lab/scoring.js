(function (root, factory) {
  const api=factory(typeof module==='object'&&module.exports?require('./model.js'):root.ProjectileModel);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ProjectileScoring=api;
})(typeof window==='undefined'?globalThis:window,function(M){
  'use strict';
  const near=(value,expected,absolute,relative=0)=>value!==null&&Number.isFinite(value)&&Number.isFinite(expected)&&Math.abs(value-expected)<=Math.max(absolute,Math.abs(expected)*relative)+1e-10;
  function score(s){
    const detail=[];
    const award=(name,max,ok,expected=null,answer=null)=>detail.push({name,max,points:ok?max:0,expected,answer});
    const depths=s.rows.filter(Boolean).map(r=>r.depthMm).sort((a,b)=>a-b);
    let last=-Infinity,count=0;
    depths.forEach(d=>{if(d-last>=(s.schemaVersion===3?50:20)){count++;last=d;}});
    detail.push({name:'不同高度取樣',max:6,points:count,expected:s.schemaVersion===3?'六個相隔至少5cm的高度':'六個相隔至少2cm的高度'});
    const span=depths.length?depths.at(-1)-depths[0]:0;
    detail.push({name:'取樣跨度',max:4,points:span>=500?4:span>=250?2:0,expected:'跨度至少50cm'});
    s.rows.forEach((r,i)=>{
      const actual=r?M.impact(r.depthMm,r.speedOffsetPpm):null, c=s.schemaVersion===1?s.calculations[i]:null;
      for(let axis=0;axis<2;axis++){
        const position=actual?(axis?actual.y:actual.x):null,target=s.schemaVersion===1?position:position===null?null:Math.round(position);
        award(`P${i+1} ${axis?'y':'x'}讀數 / cm`,s.schemaVersion===3?3:2,!!r&&(s.schemaVersion===1?near(r.read[axis],target,5):r.read[axis]===target),target===null?null:target/10,r?.read[axis]==null?null:r.read[axis]/10);
        if(s.schemaVersion===1)award(`P${i+1} ${axis?'y':'x'}轉繪 / cm`,1,!!r?.point&&near(r.point[axis],r.read[axis],5),r?.read[axis]===null?null:r?.read[axis]/10,r?.point?.[axis]/10);
      }
      if(s.schemaVersion!==1)return;
      const t=r&&r.read[1]>0?Math.sqrt(2*r.read[1]/1000/M.G):NaN;
      award(`P${i+1} 時間 / s`,1,near(c.t,t,.002,.02),Number.isFinite(t)?t:null,c.t);
      const v=r&&c.t>0&&r.read[0]!==null?r.read[0]/1000/c.t:NaN;
      award(`P${i+1} 初速度 / m/s`,1,near(c.v,v,.02,.02),Number.isFinite(v)?v:null,c.v);
    });
    if(s.schemaVersion===2){
      award('時間公式',6,s.formulas.time==='fall','t=√(2y/g)',s.formulas.time);
      award('水平初速度公式',6,s.formulas.speed==='horizontal','v₀=x/t',s.formulas.speed);
      award('選擇二次類擬合模型',6,['quadratic','square'].includes(s.fit.model),'一般二次函數或過原點平方模型',s.fit.model);
      award('成功執行資料擬合',6,s.fit.attempted&&M.fit(s).ok,'以自己的完整讀數完成有效擬合',s.fit.attempted?'已執行':'未執行');
    }
    if(s.schemaVersion===3){
      award('時間公式',8,s.formulas.time==='fall','t=√(2y/g)',s.formulas.time);
      award('水平初速度公式',8,s.formulas.speed==='horizontal','v₀=x/t',s.formulas.speed);
      award('選擇二次函數擬合',10,s.fit.model==='quadratic','二次函數',s.fit.model);
      award('成功執行資料擬合',10,s.fit.attempted&&M.fit(s).ok,'包含原點及自己的完整讀數',s.fit.attempted?'已執行':'未執行');
    }
    award('軌跡類型',s.schemaVersion===3?10:4,s.trajectory==='parabola','拋物線',s.trajectory);
    const calculations=M.calculations(s),indices=M.included(s), avg=indices.length>=2?M.mean(indices.map(i=>calculations[i].v)):NaN;
    const trueAvg=indices.length>=2?M.mean(indices.map(i=>M.velocity(s.rows[i].speedOffsetPpm))):NaN;
    award('平均初速度運算 / m/s',s.schemaVersion===3?4:2,near(s.meanV,avg,.02,.02),Number.isFinite(avg)?avg:null,s.meanV);
    award('平均初速度準確度 / m/s',s.schemaVersion===3?4:3,near(s.meanV,trueAvg,0,.1),Number.isFinite(trueAvg)?trueAvg:null,s.meanV);
    if(s.schemaVersion!==3){
    const f=s.fit.attempted?M.fit(s):null;
    const fitV=s.fit.model==='square'&&f?.ok&&f.coefficients[0]>0?Math.sqrt(M.G/(2*f.coefficients[0])):NaN;
    award('由擬合係數換算速度 / m/s',1,near(s.fitV,fitV,.02,.02),Number.isFinite(fitV)?fitV:null,s.fitV);
    award('擬合速度準確度 / m/s',2,Number.isFinite(fitV)&&near(s.fitV,M.referenceSpeed(s),0,.1),M.referenceSpeed(s),s.fitV);
    const correct={horizontal:'uniform',hEvidence:'linear-x-time',vertical:'free-fall',vEvidence:'quadratic-y-time-zero-initial'};
    Object.keys(correct).forEach(k=>award(M.QUESTIONS[k][0],6,s.conclusions[k]===correct[k],M.QUESTIONS[k][1].find(p=>p[0]===correct[k])[1],s.conclusions[k]));
    const yf=s.clockShown?M.timeFit(s,1):null, estimate=yf?.ok?2*yf.coefficients[0]:NaN;
    award('由時間擬合換算加速度 / m/s²',3,near(s.gFromClock,estimate,.1,.02),Number.isFinite(estimate)?estimate:null,s.gFromClock);
    award('重力加速度準確度 / m/s²',3,Number.isFinite(estimate)&&near(s.gFromClock,M.G,0,.1),M.G,s.gFromClock);
    }
    const total=detail.reduce((n,d)=>n+d.points,0);
    return {score:Math.min(100,Math.max(0,total)),maxScore:100,passed:total>=60,completed:true,feedback:'查看量度、擬合、公式及平均初速度的分項回饋。',detail};
  }
  return Object.freeze({score,near});
});
