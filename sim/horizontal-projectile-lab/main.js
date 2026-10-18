(async function () {
  'use strict';
  await CircuitMath.ready();
  const M=ProjectileModel, P=ProjectilePersistence, S=ProjectileScoring, V=ProjectilePresentation;
  const math=V.math, prose=V.prose;
  const d=Object.fromEntries([...document.querySelectorAll('[id]')].map(e=>[e.id,e]));
  const names=['取點','量度','軌跡','估速與平均','計時對照'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=V.format;
  const pn=i=>'P'+'₁₂₃₄₅₆'[i];
  const controller=new ProjectileRuntime.Controller(SimScorm,SimActivityFlow,render);
  let drag=null, run=null, frame=0, placing=false, readingZoom=false, timeAxis=0, geometry=null, hint='';
  const diagnostics={downs:0,moves:0,ups:0,cancels:0,trustedTouch:0};
  const pointButtons=Array.from({length:6},(_,i)=>{
    const b=document.createElement('button');b.type='button';b.className='handle point-handle';b.dataset.pointSlot=i;b.setAttribute('aria-label',`移動${pn(i)}圖點`);b.hidden=true;d.pointHandles.append(b);return b;
  });
  function rowsTable(kind){
    return Array.from({length:6},(_,i)=>`<div class="data-row"><span>${math(`P_{${i+1}}`,pn(i))}</span>${(kind==='read'?[['x','x'],['y','y']]:[['t','t'],['v','v_0']]).map(([key,symbol])=>`<label>${math(symbol+' / '+V.unit(kind==='read'?'cm':key==='t'?'s':'m/s'))}${kind==='read'?`<output id="read-${key}-${i}">—</output><button type="button" data-clear-read="${i}" data-axis="${key==='x'?0:1}" aria-label="清除${pn(i)}${key}讀數">清除</button>`:`<input id="calc-${key}-${i}" data-calc="${i}" data-field="${key}" aria-label="${pn(i)} ${key==='t'?'時間，秒':'初速度，米每秒'}" type="number" min="0" step="any" inputmode="decimal">`}</label>`).join('')}</div>`).join('');
  }
  d.readTable.innerHTML=rowsTable('read');d.speedTable.innerHTML=rowsTable('calc');
  d.questions.innerHTML=Object.entries(M.QUESTIONS).map(([key,[title,options]])=>`<fieldset><legend>${prose(title)}</legend>${options.map(([value,label])=>`<label><input type="radio" name="${key}" data-question="${key}" value="${value}"><span>${prose(label)}</span></label>`).join('')}</fieldset>`).join('');
  d.checkReturn.innerHTML=M.VIEWS.map((v,i)=>`<button type="button" data-go="${v}">返回${names[i]}</button>`).join(' ');
  const reviewNav=document.createElement('div');reviewNav.className='button-row';reviewNav.innerHTML=M.VIEWS.map((v,i)=>`<button type="button" data-go="${v}">${names[i]}</button>`).join('');d.resultPanel.append(reviewNav);
  document.querySelectorAll('[data-formula]').forEach(e=>e.innerHTML=math(e.dataset.formula,e.getAttribute('aria-label')||e.dataset.formula));
  const editing=()=>controller.mode==='edit';
  const command=action=>{
    const interrupted=Boolean(drag);if(interrupted)cancelDrag();
    const changed=controller.command(action);if(interrupted&&!changed)drawStage();
    return changed;
  };
  function cancelDrag(){
    const old=drag;drag=null;d.magnifier.hidden=true;
    if(old){diagnostics.cancels++;try{old.target.releasePointerCapture(old.id);}catch(_){} }
  }
  function cancelFlight(){if(run)hint='投球已取消，保留上次完成的印記。';if(frame)cancelAnimationFrame(frame);frame=0;run=null;}
  function navigate(view){cancelDrag();cancelFlight();placing=false;readingZoom=false;hint='';controller.navigate(view);d.controlPanel.scrollTop=0;}
  function check(){cancelDrag();cancelFlight();placing=false;readingZoom=false;controller.check();d.controlPanel.scrollTop=0;}
  function value(el,value){if(document.activeElement!==el)el.value=value===null||value===undefined?'':String(value);}
  function options(el,list,selected){
    const html=list.map(([v,label])=>`<option value="${v}">${label}</option>`).join('');
    if(el.innerHTML!==html)el.innerHTML=html;el.value=selected===null?'':String(selected);
  }
  function selected(){const i=controller.state?.selectedSlot;return i!==null&&i!==undefined?i:null;}
  function render(){
    const s=controller.state, locked=!controller.editable, view=controller.view, checking=controller.mode==='check';
    if(locked){cancelDrag();cancelFlight();placing=false;readingZoom=false;}
    d.app.classList.toggle('checking',checking||!s);
    d.app.classList.toggle('measuring',view==='measure'&&!checking&&Boolean(s));
    d.status.textContent=controller.mode==='review'?'已提交 · 只讀回顧':controller.mode==='committed'?'結果已記錄':controller.mode==='frozen'?'提交待確認':'取點、量度與擬合';
    d.progress.textContent=s?`${M.VIEWS.indexOf(view)+1} / 5 ${names[M.VIEWS.indexOf(view)]}`:'';
    d.notice.hidden=!controller.notice;d.notice.innerHTML=prose(controller.notice);
    d.saveRetry.hidden=!controller.editable||!controller.unsaved;
    d.checkButton.hidden=locked;d.checkButton.textContent=checking?'檢查作答':'檢查作答';
    d.checkPanel.hidden=!checking;d.editFooter.hidden=locked||checking;
    d.resultPanel.hidden=controller.editable||controller.mode==='submitting';
    d.resultTitle.textContent=controller.mode==='review'?'已提交 · 只讀回顧':controller.mode==='committed'?'結果已記錄':controller.mode==='frozen'?'提交尚未確認':controller.mode==='mismatch'?'紀錄未能核對':'技術狀態';
    d.scoreText.textContent=controller.result?`${fmt(controller.result.score)} / 100 · ${SimActivityFlow.completionLabel(controller.result.passed)}`:'— · 結果尚未確認';
    d.retryFinal.hidden=!['frozen','committed'].includes(controller.mode);d.retryFinal.textContent=controller.mode==='committed'?'重試完成程序':'重試同一份提交';
    reviewNav.hidden=!s;
    document.querySelectorAll('[data-panel]').forEach(e=>{e.hidden=!s||checking||e.dataset.panel!==view;});
    d.feedback.hidden=!controller.trusted;
    if(!s){drawStage();return;}
    const records=s.rows.map((r,i)=>r?[i,`第${i+1}點 · 已記錄`]:null).filter(Boolean);
    const complete=s.rows.map((r,i)=>r&&!r.read.includes(null)?[i,`第${i+1}點`]:null).filter(Boolean);
    options(d.recordSlot,s.rows.map((r,i)=>[i,`第${i+1}點 · ${r?'已有印記（重做）':'空白'}`]),s.setup?.slot??0);
    options(d.measureSlot,[['','選擇印記'],...records],selected());
    options(d.plotSlot,[['','選擇已有完整讀數的點'],...complete],selected());
    d.readingZoom.disabled=locked||selected()===null;d.readingZoom.setAttribute('aria-pressed',String(readingZoom));
    d.recordCount.innerHTML=`已留下 ${records.length} / 6 個印記。高度相隔至少${math("5\\,\\mathrm{cm}","5 cm")}。槽微調每次${math("0.5\\,\\mathrm{cm}","0.5 cm")}；建議取高低分散的位置。`;
    d.recordList.innerHTML=records.map(([i])=>`<li>${math(`P_{${i+1}}`,pn(i))}：已將印記轉記到記錄紙</li>`).join('');
    for(let i=0;i<6;i++){
      const r=s.rows[i];
      ['x','y'].forEach((key,axis)=>{const e=document.getElementById(`read-${key}-${i}`),n=r?.read[axis];e.innerHTML=n==null?'—':math(V.number(n/10)+'\\,\\mathrm{cm}',fmt(n/10)+' cm');document.querySelector(`[data-clear-read="${i}"][data-axis="${axis}"]`).disabled=locked||n==null;});
      ['t','v'].forEach(key=>{const e=document.getElementById(`calc-${key}-${i}`);value(e,s.calculations[i][key]);e.disabled=locked||!r||r.read.includes(null);});
    }
    const indices=M.included(s);
    d.included.innerHTML=`納入全部已填速度：${indices.length?indices.map(i=>math(`P_{${i+1}}`,pn(i))).join("、"):"尚無"}；${math(`n=${indices.length}`)}。未填列不補0，已填錯值亦不自動刪除。`;
    ['meanV','fitV','gFromClock'].forEach(key=>value(d[key],s[key]));
    d.meanV.disabled=locked||indices.length<2;
    const fit=s.fit.attempted?M.fit(s):null, speedAllowed=s.fit.model==='square'&&fit?.ok&&fit.coefficients[0]>0;
    d.fitV.disabled=locked||!speedAllowed;
    d.speedFit.innerHTML=speedAllowed?`自己的平方擬合：${math(`k=${V.number(fit.coefficients[0])}\\,\\mathrm{m}^{-1}`)}；請自行換算。`:'先在軌跡步驟選平方模型並完成有效擬合。';
    d.fitModel.value=s.fit.model??'';d.trajectory.value=s.trajectory??'';d.connectPoints.checked=s.connectPoints??false;
    d.fitFormula.innerHTML=s.fit.model?math({linear:'y=mx+b',quadratic:'y=Ax^2+Bx+C',square:'y=kx^2'}[s.fit.model]):'';
    d.fitResult.innerHTML=fit?fitText(fit,s.fit.model):'尚未擬合。改點後需要重新擬合。';
    const point=s.rows[selected()]?.point;
    value(d.pointX,point?point[0]/10:null);value(d.pointY,point?point[1]/10:null);
    const canPoint=selected()!==null&&s.rows[selected()]&&!s.rows[selected()].read.includes(null);
    [d.placePoint,d.keyboardPoint].forEach(e=>e.disabled=locked||!canPoint);
    d.removePoint.disabled=locked||!point;d.pointX.disabled=locked||!point;d.pointY.disabled=locked||!point;
    d.fitButton.disabled=locked||s.fit.model===null;
    d.showClock.disabled=locked||s.clockShown;d.showClock.textContent=s.clockShown?'已顯示計時記錄':'顯示計時記錄';
    d.clockTable.innerHTML=s.clockShown?records.map(([i])=>`<div>${math(`P_{${i+1}}`,pn(i))}：${math(`${(s.rows[i].clockMs/1000).toFixed(3)}\\,\\mathrm{s}`)}</div>`).join('')||'尚未記錄任何投球。':'計時記錄尚未揭示。';
    d.timeFitResult.innerHTML=s.clockShown?fitText(M.timeFit(s,timeAxis),timeAxis===0?'timeX':'timeY'):'先顯示獨立計時記錄。';
    d.gFromClock.disabled=locked||!s.clockShown||!M.timeFit(s,1).ok;
    Object.keys(M.QUESTIONS).forEach(k=>document.querySelectorAll(`[data-question="${k}"]`).forEach(e=>{e.checked=s.conclusions[k]===e.value;e.disabled=locked;}));
    [d.recordSlot,d.depthUp,d.depthDown,d.release,d.measureSlot,d.rulerX,d.rulerY,d.rulerHome,d.plotSlot,d.fitModel,d.trajectory,d.connectPoints,d.clearPlot].forEach(e=>e.disabled=locked);
    [d.recordSlot,d.depthUp,d.depthDown,d.catcherHandle].forEach(e=>e.disabled=locked||Boolean(run));
    const conflict=s.setup?M.heightConflict(s,s.setup.depthMm,s.setup.slot):-1;
    d.release.disabled=locked||Boolean(run)||conflict>=0;
    d.heightNotice.hidden=locked||conflict<0;
    d.heightNotice.innerHTML=conflict<0?'':`此高度與第${conflict+1}點相距不足${math('5\\,\\mathrm{cm}','5 cm')}，請上下調槽。`;
    d.previous.disabled=M.VIEWS.indexOf(view)===0;d.next.textContent=view==='motion'?'檢查目前作答':'下一步';d.returnCheck.hidden=!s.returnToCheck;
    if(checking){
      const reads=s.rows.reduce((n,r)=>n+(r?r.read.filter(v=>v!==null).length:0),0), points=s.rows.filter(r=>r?.point).length, times=s.calculations.filter(c=>c.t!==null).length;
      d.checkSummary.innerHTML=`<p>印記 ${records.length}/6；座標讀數 ${reads}/12；圖點 ${points}/6；時間 ${times}/6；速度 ${indices.length}/6。</p><p>平均初速度：${s.meanV===null?'未答':math(V.number(s.meanV)+'\\,\\mathrm{m}\\,\\mathrm{s}^{-1}',fmt(s.meanV)+' m/s')}；納入${math(`n=${indices.length}`)}。概念題 ${Object.values(s.conclusions).filter(Boolean).length}/4。</p><p>平方擬合估速：${s.fitV===null?'未答':'已答'}；時間擬合加速度：${s.gFromClock===null?'未答':'已答'}；軌跡類型：${s.trajectory===null?'未答':'已答'}。</p>`;
      d.submitButton.disabled=controller.unsaved;
    }
    if(controller.trusted){
      const labels=Object.fromEntries(Object.values(M.QUESTIONS).flatMap(q=>q[1]).concat([['parabola','拋物線'],['line','直線'],['circle','圓弧'],['other','其他曲線']]));
      d.feedbackList.innerHTML=controller.result.detail.map(f=>`<details><summary>${prose(f.name)}：${f.points} / ${f.max}</summary><p>你的作答：${f.answer===null||f.answer===undefined?'未答':typeof f.answer==='number'?math(V.number(f.answer),fmt(f.answer)):prose(labels[f.answer]??f.answer)}；參考：${f.expected===null?'所需資料不足':typeof f.expected==='number'?math(V.number(f.expected),fmt(f.expected)):prose(f.expected)}</p></details>`).join('');
    }
    drawStage();
  }
  function fitText(f,model){
    if(!f.ok)return `<p>${esc(f.message)}</p>`;
    const c=f.coefficients,variable=model.startsWith('time')?'t':'x';
    const term=(n,v,first=false)=>`${n<0?'-':first?'':'+'}${V.number(Math.abs(n))}${v}`;
    const quad=model==='quadratic'||model==='timeY';
    const equation=quad?`${term(c[0],variable+'^2',true)}${term(c[1],variable)}${term(c[2],'')}`:model==='square'?term(c[0],'x^2',true):`${term(c[0],variable,true)}${term(c[1],'')}`;
    return `<p>${math((model==='timeX'?'x':'y')+'='+equation)}</p><p>擬合式中，${math('x')}、${math('y')}以 ${math('\\mathrm{m}','m')} 表示，${math('t')}以 ${math('\\mathrm{s}','s')} 表示；圖上位移刻度以 ${math('\\mathrm{cm}','cm')} 表示。</p><p>使用${f.n}點；${math('\\mathrm{RMSE}='+V.number(f.rmse)+'\\,\\mathrm{m}','RMSE = '+fmt(f.rmse)+' m')}。${quad?'保留一次項與截距，請解讀其物理意義。':''}</p>`;
  }

  function makeGeometry(view){
    const w=d.stage.clientWidth,h=d.stage.clientHeight;
    const extent=view==='collect'?1300:1100;
    const scale=Math.max(.01,Math.min((w-108)/extent,(h-124)/extent));
    const left=(w-extent*scale)/2,top=60;
    const ox=left+(view==='collect'?300:50)*scale,oy=top+(view==='collect'?250:30)*scale;
    return{w,h,s:scale,ox,oy,x:n=>ox+n*scale,y:n=>oy+n*scale};
  }
  function world(g,view,clipId){
    const s=controller.state;if(!s)return'';
    const x=g.x,y=g.y,scale=g.s, time=view==='motion', q=1000*scale;
    const line=(x1,y1,x2,y2,color='#dbe2eb',width=1,arrow=false)=>`<path d="M${x1},${y1}L${x2},${y2}" stroke="${color}" stroke-width="${width}" fill="none"${arrow?` marker-end="url(#${clipId}Arrow)"`:''}/>`;
    const labelSize=innerWidth>=900?24:16;
    const text=(px,py,t,color='#354a64',anchor='start',tex=null)=>{
      const point=String(t).match(/^P([₁₂₃₄₅₆])$/);
      const expression=tex??(point?`P_{${'₁₂₃₄₅₆'.indexOf(point[1])+1}}`:String(t).trim()!==''&&Number.isFinite(Number(t))?V.number(Number(t)):null);
      return expression!==null?CircuitMath.svg(px,py,{tex:expression,text:String(t)},labelSize,`fill="${color}" text-anchor="${anchor}"`):`<text x="${px}" y="${py}" font-size="${labelSize}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`;
    };
    let html=`<defs><clipPath id="${clipId}"><rect x="${x(0)}" y="${y(0)}" width="${q}" height="${q}"/></clipPath><marker id="${clipId}Arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#263b55"/></marker></defs><rect width="${g.w}" height="${g.h}" fill="#fff"/>`;
    const step=q<180?500:200;
    for(let i=0;i<=1000;i+=step){html+=line(x(i),y(0),x(i),y(1000))+line(x(0),y(i),x(1000),y(i));if(i>0)html+=text(x(i),time?y(1000)+17:y(0)-6,time?fmt(i/1000*.45):i/10,'#53647b','middle')+text(x(0)-5,y(i)+4,time?(1000-i)/10:i/10,'#53647b','end');}
    if(time)html+=text(x(0)-4,y(0)-6,'100','#263b55','end');
    else html+=`<circle data-origin="true" cx="${x(0)}" cy="${y(0)}" r="6" fill="#b13f25" stroke="#fff" stroke-width="2"/>`+text(x(0)+10,clipId==='sceneClip'?Math.max(labelSize,y(0)-30):y(0)-30,'O(0,0)','#a3321e','start','O(0,0)');
    if(time){html+=line(x(0),y(1000),x(1000)+8,y(1000),'#263b55',1.5,true)+line(x(0),y(1000),x(0),y(0)-8,'#263b55',1.5,true)+text(x(0)+5,y(0)+17,`${timeAxis===0?'x':'y'} / cm`,'#263b55','start',`${timeAxis===0?'x':'y'} / \\mathrm{cm}`)+text(x(1000),y(1000)+34,'t / s','#263b55','end','t / \\mathrm{s}');}
    else html+=line(x(0),y(0),x(1000)+8,y(0),'#263b55',1.5,true)+line(x(0),y(0),x(0),y(1000)+8,'#263b55',1.5,true)+text(x(1000),y(0)-42,'x / cm','#263b55','end','x / \\mathrm{cm}')+text(x(0)+5,y(1000)+28,'y / cm','#263b55','start','y / \\mathrm{cm}');
    const plot=view==='plot'||view==='speed';
    const curve=(fn,color,dash='')=>{
      let path='',connected=false;
      for(let i=0;i<=160;i++){
        const u=i/160*1000,v=fn(u);
        if(!Number.isFinite(v)||v<0||v>1000){connected=false;continue;}
        path+=`${connected?'L':'M'}${x(u)},${y(v)}`;connected=true;
      }
      return `<path clip-path="url(#${clipId})" d="${path}" fill="none" stroke="${color}" stroke-width="2" ${dash?'stroke-dasharray="6 4"':''}/>`;
    };
    if(time){
      if(s.clockShown){
        const f=M.timeFit(s,timeAxis);
        if(f.ok)html+=curve(u=>1000-NewtonFitting.predict(timeAxis===0?'linear':'quadratic',f.coefficients,u/1000*.45)*1000,'#157c75');
        s.rows.forEach(r=>{if(r&&r.read[timeAxis]!==null)html+=`<circle cx="${x(r.clockMs/450*1000)}" cy="${y(1000-r.read[timeAxis])}" r="4" fill="#1764b1"/>`;});
      }
      return html;
    }
    if(plot){
      const points=s.rows.map((r,i)=>{const p=drag?.kind==='point'&&drag.index===i?drag.value:r?.point;return p?{i,p}:null;}).filter(Boolean);
      if(s.connectPoints&&points.length)html+=`<path d="${points.slice().sort((a,b)=>a.p[0]-b.p[0]).map(({p},i)=>`${i?'L':'M'}${x(p[0])},${y(p[1])}`).join('')}" fill="none" stroke="#8b98a8" stroke-dasharray="3 4"/>`;
      if(s.fit.attempted){const f=M.fit(s);if(f.ok)html+=curve(u=>M.predict(s,f,u/1000)*1000,'#157c75');}
      if(controller.trusted)html+=curve(u=>M.G/(2*M.SPEED**2)*(u/1000)**2*1000,'#b3542d',true);
      points.forEach(({i,p})=>{html+=`<circle cx="${x(p[0])}" cy="${y(p[1])}" r="4" fill="#1764b1"/>`;if(q>100||selected()===i)html+=text(x(p[0])+8,y(p[1])-7,pn(i));});
      return html;
    }
    s.rows.forEach((r,i)=>{if(r){const p=M.impact(r.depthMm,r.speedOffsetPpm);html+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="3" fill="#182333"/>`;if(q>100||selected()===i)html+=text(x(p.x)+8,y(p.y)+(p.y*scale<labelSize*2?labelSize*.35:-8),pn(i));}});
    if(view==='collect'){
      const depth=drag?.kind==='catcher'?drag.value:s.setup?.depthMm??200;
      html+=`<path d="M${x(-240)},${y(-190)}C${x(-160)},${y(-190)} ${x(-160)},${y(10)} ${x(-40)},${y(10)}L${x(0)},${y(10)}" fill="none" stroke="#52677e" stroke-width="5"/>`;
      html+=line(x(0),y(depth+10),x(1000),y(depth+10),'#1764b1',5);
      let ball=[-240,-200];
      if(run){
        const elapsed=Math.max(0,performance.now()-run.started);
        if(elapsed<run.ramp){const u=elapsed/run.ramp;if(u<.85){const v=u/.85,a=1-v;ball=[a*a*a*-240+3*a*a*v*-160+3*a*v*v*-160+v*v*v*-40,a*a*a*-200+3*a*a*v*-200];}else ball=[-40+(u-.85)/.15*40,0];}
        else{const t=Math.min(run.impact.t,(elapsed-run.ramp)/run.slow/1000);ball=[M.velocity(run.ppm)*t*1000,.5*M.G*t*t*1000];}
      }
      html+=`<circle cx="${x(ball[0])}" cy="${y(ball[1])}" r="${Math.max(3,10*scale)}" fill="#677586" stroke="#172438"/>`;
      if(q>110)html+=text(x(500),y(depth+10)+labelSize+8,'接球槽','#1764b1');
    }
    if(view==='measure'){
      const ruler=drag?.kind==='ruler'?{...s.ruler,zero:drag.value}:s.ruler??{axis:'x',zero:[0,0]},[rx,ry]=ruler.zero, horizontal=ruler.axis==='x';
      const rxp=x(rx),ryp=y(ry),pad=labelSize+4,thickness=Math.max(labelSize+28,CircuitMath.measure('100',labelSize).width+24);
      html+=`<rect data-ruler-body="true" x="${rxp-(horizontal?pad:0)}" y="${ryp-(horizontal?0:pad)}" width="${horizontal?q+2*pad:thickness}" height="${horizontal?thickness:q+2*pad}" fill="#f9e5ab" fill-opacity=".82" stroke="#a88a3e"/>`;
      let ticks='';
      for(let mm=0;mm<=1000;mm++){
        const pos=mm*scale,len=mm%10===0?14:mm%5===0?9:4;
        ticks+=horizontal?`M${rxp+pos},${ryp}v${len}`:`M${rxp},${ryp+pos}h${len}`;
      }
      html+=`<path d="${ticks}" stroke="#654c17" stroke-width=".7" fill="none"/>`;
      const spacing=[10,20,50,100,200,500,1000].find(mm=>mm*scale>=labelSize*2)??1000;
      for(let mm=0;mm<=1000;mm+=spacing)html+=text(rxp+(horizontal?mm*scale:18),ryp+(horizontal?labelSize+22:mm*scale+labelSize*.35),mm/10,'#654c17',horizontal?'middle':'start').replace('<g ',`<g data-ruler-value="${mm}" `);
      const actual=s.rows[selected()];if(actual){const p=M.impact(actual.depthMm,actual.speedOffsetPpm),px=horizontal?x(p.x):rxp,py=horizontal?ryp:y(p.y);html+=line(x(p.x),y(p.y),px,py,'#8d6e37')+`<circle data-reading-target="true" cx="${px}" cy="${py}" r="5" fill="#a3321e" stroke="#fff" stroke-width="1.5"/>`;}
    }
    return html;
  }
  function position(e,x,y){e.style.left=x+'px';e.style.top=y+'px';}
  function drawStage(){
    const s=controller.state;if(!s){d.scene.innerHTML='';d.readingChoices.hidden=true;d.catcherHandle.hidden=d.rulerHandle.hidden=true;pointButtons.forEach(b=>b.hidden=true);return;}
    const view=controller.view;geometry=makeGeometry(view);const g=geometry;
    d.scene.setAttribute('viewBox',`0 0 ${g.w} ${g.h}`);d.scene.innerHTML=world(g,view,'sceneClip');
    d.catcherHandle.hidden=!editing()||view!=='collect';d.rulerHandle.hidden=!editing()||view!=='measure';
    const depth=drag?.kind==='catcher'?drag.value:s.setup?.depthMm??200;
    position(d.catcherHandle,Math.min(g.w-24,g.x(900)),Math.max(23,Math.min(g.h-24,g.y(depth+10))));
    const zero=drag?.kind==='ruler'?drag.value:s.ruler?.zero??[0,0];position(d.rulerHandle,Math.max(23,Math.min(g.w-23,g.x(zero[0])-36)),Math.max(23,Math.min(g.h-55,g.y(zero[1])-36)));
    drawReadingChoices(g,view);
    pointButtons.forEach((b,i)=>{
      const p=drag?.kind==='point'&&drag.index===i?drag.value:s.rows[i]?.point;
      b.hidden=!editing()||view!=='plot'||!p;b.setAttribute('aria-pressed',String(selected()===i));b.style.zIndex=selected()===i?'4':'3';if(p)position(b,g.x(p[0]),g.y(p[1]));
    });
    const p=selected(),eligible=p!==null&&s.rows[p]&&!s.rows[p].read.includes(null);
    d.plotInputSurface.hidden=!editing()||view!=='plot'||!placing||!eligible;
    d.plotInputSurface.style.cssText=`left:${g.x(0)}px;top:${g.y(0)}px;width:${1000*g.s}px;height:${1000*g.s}px`;
    d.stageHint.innerHTML=prose(hint||(view==='collect'?'上下調槽，每次留下一個固定撞擊印記。':view==='measure'?'拖動零刻度旁把手，對準原點後，在紅色讀數點旁揀選讀數。':view==='plot'?(placing?'在中央圖域放置所選點；兩側空白可滑動頁面。':'選資料點，再放點或拖動；兩側空白可滑動頁面。'):view==='speed'?'圖為自己的點及擬合；請在面板計算逐點速度與平均。':'獨立計時配對自己的讀數；圖示位移大小隨時間變化。'));
    if(drag&&drag.kind!=='catcher'){
      const focus=drag.value,zs=Math.max(g.s*8,4),zoom={w:128,h:112,s:zs,ox:64-focus[0]*zs,oy:50-focus[1]*zs};zoom.x=n=>zoom.ox+n*zs;zoom.y=n=>zoom.oy+n*zs;
      d.magnifier.hidden=false;d.magnifier.style.left=drag.previewLeft?'8px':'auto';d.magnifier.style.right=drag.previewLeft?'auto':'8px';d.magnifierSvg.setAttribute('viewBox','0 0 128 112');d.magnifierSvg.innerHTML=world(zoom,view,'zoomClip');
    }else d.magnifier.hidden=true;
  }

  function drawReadingChoices(g,view){
    const s=controller.state,i=selected(),row=s?.rows[i],values=row?M.rulerChoices(row,s.ruler):[];
    d.readingChoices.hidden=!editing()||view!=='measure'||!row||Boolean(drag)||values.length!==4;
    d.readingPreview.hidden=!readingZoom;
    if(d.readingChoices.hidden)return;
    const active=d.readingChoices.contains(document.activeElement)?document.activeElement:null;
    d.readingPreview.hidden=!readingZoom;
    d.readingZoomInline.textContent=readingZoom?'收起':'放大';d.readingZoomInline.setAttribute('aria-pressed',String(readingZoom));
    const axis=s.ruler.axis==='x'?0:1,p=M.impact(row.depthMm,row.speedOffsetPpm),size=innerWidth>=900?24:16;
    const thickness=Math.max(size+28,CircuitMath.measure('100',size).width+24),cardWidth=innerWidth>=900?270:190;
    const target=[g.x(axis?s.ruler.zero[0]:p.x),g.y(axis?p.y:s.ruler.zero[1])];
    d.readingChoiceTitle.innerHTML=math(`P_{${i+1}}\\;${axis?'y':'x'}`,pn(i)+' '+s.ruler.axis)+' 讀數';
    readingButtons.forEach((b,j)=>{const n=values[j],html=math(V.number(n/10)+'\\,\\mathrm{cm}',fmt(n/10)+' cm');if(b.innerHTML!==html)b.innerHTML=html;b.dataset.reading=n;b.setAttribute('aria-label',`${pn(i)} ${s.ruler.axis} ${fmt(n/10)} 厘米`);b.setAttribute('aria-pressed',String(row.read[axis]===n));});
    let fallback=g.h<(readingZoom?390:300)||(axis&&target[0]+thickness+12+cardWidth>g.w-32);
    const host=fallback?d.readingFallback:d.stage;if(d.readingChoices.parentElement!==host)host.append(d.readingChoices);d.readingChoices.classList.toggle('in-panel',fallback);
    let box=d.readingChoices.getBoundingClientRect(),left=axis?target[0]+thickness+12:Math.max(32,Math.min(g.w-32-box.width,target[0]+18)),top=axis?Math.max(4,Math.min(g.h-box.height-40,target[1]-18)):target[1]+thickness+12;
    if(!axis&&top+box.height>g.h-40)top=target[1]-box.height-12;
    if(!fallback&&(top<4||top+box.height>g.h-40)){
      fallback=true;d.readingFallback.append(d.readingChoices);d.readingChoices.classList.add('in-panel');
    }
    if(readingZoom){
      const width=d.readingPreview.clientWidth,height=d.readingPreview.clientHeight,zs=Math.max(g.s*8,4),focus=axis?[s.ruler.zero[0],p.y]:[p.x,s.ruler.zero[1]],zoom={w:width,h:height,s:zs,ox:width/2-focus[0]*zs,oy:height/2-focus[1]*zs};zoom.x=n=>zoom.ox+n*zs;zoom.y=n=>zoom.oy+n*zs;
      d.readingPreviewSvg.setAttribute('viewBox',`0 0 ${width} ${height}`);d.readingPreviewSvg.innerHTML=world(zoom,'measure','readingClip');
    }
    d.readingChoices.style.left=left+'px';d.readingChoices.style.top=top+'px';active?.focus({preventScroll:true});
  }
  const readingButtons=Array.from({length:4},()=>{const b=document.createElement('button');b.type='button';b.className='reading-choice';b.onclick=()=>{const s=controller.state,i=selected();if(!editing()||controller.view!=='measure'||drag||i===null)return;const n=Number(b.dataset.reading);if(M.rulerChoices(s.rows[i],s.ruler).includes(n))command({type:'read',slot:i,axis:s.ruler.axis==='x'?0:1,value:n});};d.readingOptions.append(b);return b;});
  function modelPoint(event){const r=d.stage.getBoundingClientRect();return[(event.clientX-r.left-geometry.ox)/geometry.s,(event.clientY-r.top-geometry.oy)/geometry.s];}
  function resolveDrag(event){
    const p=modelPoint(event), start=drag.startModel, delta=[p[0]-start[0],p[1]-start[1]], clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    if(drag.kind==='catcher')return clamp(Math.round((drag.before+delta[1])/5)*5,50,800);
    const raw=drag.before.map((v,i)=>clamp(Math.round(v+delta[i]),drag.kind==='point'?0:-100,1000));
    const threshold=event.pointerType==='mouse'?8:12;
    if(drag.kind==='point')return raw.map(v=>{const grid=Math.round(v/10)*10;return Math.abs(grid-v)*geometry.s<=threshold?grid:v;});
    return M.snapRuler(controller.state,raw,geometry.s,threshold);
  }

  function beginDrag(event,kind,index=null,placement=false){
    if(!editing()||run||event.button!==0||event.isPrimary===false)return;
    if(drag){cancelDrag();drawStage();return;}
    const s=controller.state,before=placement?modelPoint(event).map(v=>Math.round(v/10)*10):kind==='catcher'?s.setup.depthMm:kind==='ruler'?s.ruler.zero:s.rows[index]?.point;
    if(before===null||before===undefined)return;
    diagnostics.downs++;if(event.isTrusted&&event.pointerType==='touch')diagnostics.trustedTouch++;
    drag={kind,index,placement,before:M.clone(before),value:M.clone(before),id:event.pointerId,target:event.currentTarget,start:[event.clientX,event.clientY],startModel:modelPoint(event),moved:false,previewLeft:event.clientX>d.stage.getBoundingClientRect().left+d.stage.clientWidth/2};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
    if(placement||kind==='ruler')drawStage();
  }
  function moveDrag(event){if(!drag||event.pointerId!==drag.id)return;const distance=Math.hypot(event.clientX-drag.start[0],event.clientY-drag.start[1]);if(!drag.moved&&distance<(event.pointerType==='mouse'?3:6))return;drag.moved=true;drag.value=resolveDrag(event);diagnostics.moves++;drawStage();}
  function finishDrag(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(event.type!=='pointerup'){cancelDrag();drawStage();return;}
    const previous=drag;if(previous.moved)previous.value=resolveDrag(event);drag=null;d.magnifier.hidden=true;diagnostics.ups++;
    try{previous.target.releasePointerCapture(previous.id);}catch(_){}
    if(previous.placement)placing=false;
    if(previous.moved||previous.placement){if(previous.kind==='catcher')command({type:'setup',value:{depthMm:previous.value}});else if(previous.kind==='ruler')command({type:'ruler',value:{axis:controller.state.ruler.axis,zero:previous.value}});else command({type:'point',slot:previous.index,value:previous.value});}
    else if(previous.kind==='point')command({type:'select',slot:previous.index});
    drawStage();
  }
  function attachDrag(element,kind,index=null){element.addEventListener('pointerdown',e=>beginDrag(e,kind,index));element.addEventListener('pointermove',moveDrag);['pointerup','pointercancel','lostpointercapture'].forEach(t=>element.addEventListener(t,finishDrag));}
  attachDrag(d.catcherHandle,'catcher');attachDrag(d.rulerHandle,'ruler');pointButtons.forEach((b,i)=>attachDrag(b,'point',i));
  document.addEventListener('pointerdown',e=>{if(drag&&e.pointerId!==drag.id){cancelDrag();drawStage();}},true);
  d.plotInputSurface.addEventListener('pointerdown',e=>{
    if(!editing()||!placing||e.button!==0||e.isPrimary===false)return;const p=modelPoint(e);if(p.some(v=>v<0||v>1000))return;
    beginDrag(e,'point',selected(),true);
  });
  d.plotInputSurface.addEventListener('pointermove',moveDrag);['pointerup','pointercancel','lostpointercapture'].forEach(t=>d.plotInputSurface.addEventListener(t,finishDrag));
  function keyboard(event,kind,index=null){
    if(!editing()||run||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    if(kind==='catcher')command({type:'setup',value:{depthMm:clamp(controller.state.setup.depthMm+dy*(event.shiftKey?25:5),50,800)}});
    else if(kind==='ruler'){const r=controller.state.ruler,n=event.shiftKey?10:1;command({type:'ruler',value:{axis:r.axis,zero:[clamp(r.zero[0]+dx*n,-100,1000),clamp(r.zero[1]+dy*n,-100,1000)]}});}
    else{const p=controller.state.rows[index].point,n=event.shiftKey?1:10;command({type:'point',slot:index,value:[clamp(p[0]+dx*n,0,1000),clamp(p[1]+dy*n,0,1000)]});}
  }
  d.catcherHandle.addEventListener('keydown',e=>keyboard(e,'catcher'));d.rulerHandle.addEventListener('keydown',e=>keyboard(e,'ruler'));pointButtons.forEach((b,i)=>b.addEventListener('keydown',e=>keyboard(e,'point',i)));
  function numberInput(e,options={}){
    if(e.value.trim()==='')return null;
    const n=Number(e.value),scale=options.scale??1;
    if(!Number.isFinite(n)||(!options.signed&&n<0)||(options.max!==undefined&&n>options.max)||(scale!==1&&Math.abs(n*scale-Math.round(n*scale))>1e-7)){
      controller.notice='數值未記錄：請輸入有效範圍內的數字；座標精確至0.1cm。';e.blur();render();return undefined;
    }
    return scale===1?n:Math.round(n*scale);
  }
  document.querySelectorAll('[data-clear-read]').forEach(e=>e.onclick=()=>command({type:'read',slot:+e.dataset.clearRead,axis:+e.dataset.axis,value:null}));
  document.querySelectorAll('[data-calc]').forEach(e=>e.addEventListener('change',()=>{const n=numberInput(e,e.dataset.field==='t'?{max:10}:{});if(n!==undefined)command({type:'calculation',slot:+e.dataset.calc,field:e.dataset.field,value:n});}));
  ['meanV','fitV','gFromClock'].forEach(key=>d[key].addEventListener('change',()=>{const n=numberInput(d[key],{signed:key==='gFromClock'});if(n!==undefined)command({type:'answer',field:key,value:n});}));
  document.querySelectorAll('[data-question]').forEach(e=>e.addEventListener('change',()=>command({type:'conclusion',field:e.dataset.question,value:e.value})));
  d.recordSlot.addEventListener('change',()=>command({type:'setup',value:{slot:+d.recordSlot.value}}));
  [d.measureSlot,d.plotSlot].forEach(e=>e.addEventListener('change',()=>{placing=false;command({type:'select',slot:e.value===''?null:+e.value});}));
  d.depthUp.onclick=()=>command({type:'setup',value:{depthMm:Math.max(50,controller.state.setup.depthMm-5)}});
  d.depthDown.onclick=()=>command({type:'setup',value:{depthMm:Math.min(800,controller.state.setup.depthMm+5)}});
  ['x','y'].forEach(axis=>d[axis==='x'?'rulerX':'rulerY'].onclick=()=>command({type:'ruler',value:{...controller.state.ruler,axis}}));
  d.rulerHome.onclick=()=>command({type:'ruler',value:{...controller.state.ruler,zero:[0,0]}});
  d.readingZoom.onclick=d.readingZoomInline.onclick=()=>{readingZoom=!readingZoom;render();};
  d.placePoint.onclick=()=>{placing=!placing;drawStage();};
  d.keyboardPoint.onclick=()=>{const i=selected();if(i===null)return;placing=false;if(!command({type:'point',slot:i,value:controller.state.rows[i].point??[500,500]}))drawStage();pointButtons[i].focus();};
  d.removePoint.onclick=()=>command({type:'point',slot:selected(),value:null});
  [d.pointX,d.pointY].forEach((e,axis)=>e.addEventListener('change',()=>{const n=numberInput(e,{max:100,scale:10}),p=controller.state.rows[selected()]?.point;if(n!==undefined&&n!==null&&p){const v=p.slice();v[axis]=n;command({type:'point',slot:selected(),value:v});}else render();}));
  d.fitModel.onchange=()=>command({type:'model',value:d.fitModel.value||null});d.fitButton.onclick=()=>command({type:'fit'});d.trajectory.onchange=()=>command({type:'answer',field:'trajectory',value:d.trajectory.value||null});
  d.connectPoints.onchange=()=>command({type:'connect',value:d.connectPoints.checked});
  d.clearPlot.onclick=()=>{cancelDrag();placing=false;if(confirm('清除圖點、擬合及軌跡分類？印記、讀數及逐點估速保留。'))command({type:'clearPlot'});drawStage();};
  d.showClock.onclick=()=>command({type:'clock'});d.timeX.onclick=()=>{timeAxis=0;render();};d.timeY.onclick=()=>{timeAxis=1;render();};
  d.previous.onclick=()=>navigate(M.VIEWS[Math.max(0,M.VIEWS.indexOf(controller.view)-1)]);
  d.next.onclick=()=>controller.view==='motion'?check():navigate(M.VIEWS[Math.min(4,M.VIEWS.indexOf(controller.view)+1)]);
  d.checkButton.onclick=check;d.returnCheck.onclick=check;d.submitButton.onclick=()=>controller.submit();d.retryFinal.onclick=()=>controller.retryFinal();d.saveRetry.onclick=()=>controller.retrySave();
  document.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>navigate(e.dataset.go));
  d.clearAll.onclick=()=>{cancelDrag();cancelFlight();if(confirm('清除本次全部印記、讀數、圖點及答案？')){placing=false;controller.clear();}else render();};
  d.release.onclick=()=>{
    if(!editing()||run)return;const {slot,depthMm}=controller.state.setup;
    if(M.heightConflict(controller.state,depthMm,slot)>=0){render();return;}
    if(controller.state.rows[slot]&&!confirm(`重做${pn(slot)}會清除此點的讀數、圖點及計算，並更新相關擬合。繼續？`))return;
    const ppm=M.drawOffset(), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    run={slot,depthMm,ppm,impact:M.impact(depthMm,ppm),started:performance.now(),ramp:reduced?20:900,slow:reduced ? 0.1 : 4};hint='鋼珠正在滾出水平出口……';render();
    const tick=()=>{
      if(!run)return;
      if(performance.now()-run.started>=run.ramp+run.impact.t*1000*run.slow){const completed=run;run=null;frame=0;hint=`已將${pn(completed.slot)}撞擊印記轉記到記錄紙。`;command({type:'record',slot:completed.slot,depthMm:completed.depthMm,ppm:completed.ppm});return;}
      drawStage();frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
  };
  window.addEventListener('blur',()=>{cancelDrag();cancelFlight();readingZoom=false;render();});
  new ResizeObserver(()=>{cancelDrag();cancelFlight();readingZoom=false;render();}).observe(d.stage);
  window.__projectileApp={getState:()=>M.clone(controller.state),controller,getGeometry:()=>geometry?{s:geometry.s,ox:geometry.ox,oy:geometry.oy,w:geometry.w,h:geometry.h}:null,getDiagnostics:()=>({...diagnostics}),isRunning:()=>Boolean(run)};
  controller.start();
})().catch(error=>{document.getElementById('notice').hidden=false;document.getElementById('notice').textContent='數學排版未能載入，請重新載入活動。';console.error(error);});
