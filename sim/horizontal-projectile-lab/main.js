(async function () {
  'use strict';
  await CircuitMath.ready();
  const M=ProjectileModel, P=ProjectilePersistence, S=ProjectileScoring, V=ProjectilePresentation;
  const math=V.math, prose=V.prose;
  const d=Object.fromEntries([...document.querySelectorAll('[id]')].map(e=>[e.id,e]));
  const names=['取點','量度','軌跡','估速與平均'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=V.format;
  const pn=i=>'P'+'₁₂₃₄₅₆'[i];
  // Temporary standalone preview default; turn off after the later stages are approved.
  const TEMPORARY_TEST_DEFAULT=true;
  const testParameter=new URLSearchParams(location.search).get('test');
  const testing=()=>SimScorm.isStandalone()&&(testParameter==='1'||(TEMPORARY_TEST_DEFAULT&&testParameter!=='0'));
  const controller=new ProjectileRuntime.Controller(SimScorm,SimActivityFlow,render);
  let drag=null, run=null, frame=0, geometry=null, hint='';
  const diagnostics={downs:0,moves:0,ups:0,cancels:0,trustedTouch:0};
  function rowsTable(kind){
    return Array.from({length:6},(_,i)=>`<div class="data-row"><span>${math(`P_{${i+1}}`,pn(i))}</span>${(kind==='read'?[['x','x'],['y','y']]:[['t','t'],['v','v_0']]).map(([key,symbol])=>`<label>${math(symbol+' / '+V.unit(kind==='read'?'cm':key==='t'?'s':'m/s'))}<output id="${kind==='read'?'read':'calc'}-${key}-${i}">—</output>${kind==='read'?`<button type="button" data-clear-read="${i}" data-axis="${key==='x'?0:1}" aria-label="清除${pn(i)}${key}讀數">清除</button>`:''}</label>`).join('')}</div>`).join('');
  }
  d.readTable.innerHTML=rowsTable('read');d.speedTable.innerHTML=rowsTable('calc');
  d.formulaChoices.innerHTML=Object.entries(M.FORMULAS).map(([key,formulas])=>`<fieldset><legend>${key==='time'?'時間公式':'水平初速度公式'}</legend>${formulas.map(f=>`<label><input type="radio" name="formula-${key}" data-formula-choice="${key}" value="${f.id}"><span>${math(f.tex)}</span></label>`).join('')}<button type="button" data-clear-formula="${key}">清除此公式選擇</button></fieldset>`).join('');
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
    const old=drag;drag=null;
    if(old){diagnostics.cancels++;try{old.target.releasePointerCapture(old.id);}catch(_){} }
  }
  function cancelFlight(){if(run)hint='投球已取消，保留上次完成的印記。';if(frame)cancelAnimationFrame(frame);frame=0;run=null;}
  function navigate(view){cancelDrag();cancelFlight();hint='';controller.navigate(view);d.controlPanel.scrollTop=0;}
  function check(){cancelDrag();cancelFlight();controller.check();d.controlPanel.scrollTop=0;}
  function prepareTesting(){if(testing()&&editing()&&controller.state.rows.every(r=>r===null))controller.command({type:'practice'});}
  function value(el,value){if(document.activeElement!==el)el.value=value===null||value===undefined?'':String(value);}
  function options(el,list,selected){
    const html=list.map(([v,label])=>`<option value="${v}">${label}</option>`).join('');
    if(el.innerHTML!==html)el.innerHTML=html;el.value=selected===null?'':String(selected);
  }
  function render(){
    const s=controller.state, locked=!controller.editable, view=controller.view, checking=controller.mode==='check';
    if(locked){cancelDrag();cancelFlight();}
    d.app.classList.toggle('checking',checking||!s);
    d.app.classList.toggle('measuring',view==='measure'&&!checking&&Boolean(s));
    const hintHost=innerWidth<900&&innerHeight>420?d.controlPanel:d.stage;
    if(d.stageHint.parentElement!==hintHost){if(hintHost===d.controlPanel)hintHost.insertBefore(d.stageHint,d.notice);else hintHost.append(d.stageHint);}
    d.stageHint.hidden=checking||!s;
    d.status.textContent=controller.mode==='review'?'已提交 · 只讀回顧':controller.mode==='committed'?'結果已記錄':controller.mode==='frozen'?'提交待確認':'取點、量度與擬合';
    if(testing())d.status.textContent=controller.mode==='edit'||controller.mode==='check'?'測試模式':'測試模式 · '+d.status.textContent;
    d.modeControls.hidden=!SimScorm.isStandalone()||locked;
    d.modeMessage.textContent=testing()?'測試模式：已自動完成取點及讀尺，後續答案留空供測試。重新整理會產生另一組實驗數據。':'一般模式：從空白開始，手動取點及讀尺。';
    d.modeToggle.textContent=testing()?'切換一般模式（重新開始）':'切換測試模式（重新開始）';
    d.progress.textContent=s?`${M.VIEWS.indexOf(view)+1} / ${M.VIEWS.length} ${names[M.VIEWS.indexOf(view)]}`:'';
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
    const calculations=M.calculations(s),points=M.points(s);
    options(d.recordSlot,s.rows.map((r,i)=>[i,`第${i+1}點 · ${r?'已有印記（重做）':'空白'}`]),s.setup?.slot??0);
    d.plotCount.textContent=`已自動顯示 ${points.filter(Boolean).length} / 6 個完整讀數點，另加入原點。未量好的點不補零。`;
    d.recordCount.innerHTML=`已留下 ${records.length} / 6 個印記。高度相隔至少${math("5\\,\\mathrm{cm}","5 cm")}。槽微調每次${math("0.5\\,\\mathrm{cm}","0.5 cm")}；建議取高低分散的位置。`;
    d.recordList.innerHTML=records.map(([i])=>`<li>${math(`P_{${i+1}}`,pn(i))}：已將印記轉記到記錄紙</li>`).join('');
    for(let i=0;i<6;i++){
      const r=s.rows[i];
      ['x','y'].forEach((key,axis)=>{const e=document.getElementById(`read-${key}-${i}`),n=r?.read[axis];e.innerHTML=n==null?'—':math(V.number(n/10)+'\\,\\mathrm{cm}',fmt(n/10)+' cm');document.querySelector(`[data-clear-read="${i}"][data-axis="${axis}"]`).disabled=locked||n==null;});
      ['t','v'].forEach(key=>{const n=calculations[i][key];document.getElementById(`calc-${key}-${i}`).innerHTML=n===null?'—':math(V.number(n)+'\\,'+V.unit(key==='t'?'s':'m/s'));});
    }
    document.querySelectorAll('[data-formula-choice]').forEach(e=>{e.checked=s.formulas?.[e.dataset.formulaChoice]===e.value;e.disabled=locked;});
    document.querySelectorAll('[data-clear-formula]').forEach(e=>e.disabled=locked||s.formulas?.[e.dataset.clearFormula]==null);
    d.calculationNotice.textContent=s.schemaVersion===1?'舊版手動計算結果（只讀）。':'只顯示所選公式的運算結果，不代表公式正確。缺少讀數或公式時顯示「—」；時間為零時不能除以時間。平均初速度只需填一次。';
    const indices=M.included(s);
    value(d.meanV,s.meanV);
    d.meanV.disabled=locked||indices.length<2;
    const fit=s.fit.attempted?M.fit(s):null;
    d.fitModel.value=s.fit.model??'';d.trajectory.value=s.trajectory??'';
    d.fitFormula.innerHTML=s.fit.model==='inverse'?(locked?'原作答：反比例函數（此選項已移除）。':'此紀錄使用已移除的反比例選項，請改選一次或二次函數。'):s.fit.model?math({linear:'y=mx+b',quadratic:'y=Ax^2+Bx+C',square:'y=kx^2'}[s.fit.model]):'';
    d.fitResult.innerHTML=fit?fitText(fit,s.fit.model):'尚未擬合。修改讀數後需要重新擬合。';
    d.fitButton.disabled=locked||s.fit.model===null||s.fit.model==='inverse';
    [d.recordSlot,d.depthUp,d.depthDown,d.release,d.rulerX,d.rulerY,d.rulerHome,d.fitModel,d.trajectory,d.clearPlot].forEach(e=>e.disabled=locked);
    [d.recordSlot,d.depthUp,d.depthDown,d.catcherHandle].forEach(e=>e.disabled=locked||Boolean(run));
    d.previous.disabled=M.VIEWS.indexOf(view)===0;d.next.textContent=view===M.VIEWS.at(-1)?'檢查目前作答':'下一步';d.returnCheck.hidden=!s.returnToCheck;
    if(checking){
      const reads=s.rows.reduce((n,r)=>n+(r?r.read.filter(v=>v!==null).length:0),0);
      d.checkSummary.innerHTML=`<p>印記 ${records.length}/6；座標讀數 ${reads}/12；自動圖點 ${points.filter(Boolean).length}/6；公式 ${Object.values(s.formulas??{}).filter(Boolean).length}/2；速度結果 ${indices.length}/6。</p><p>平均初速度：${s.meanV===null?'未答':math(V.number(s.meanV)+'\\,\\mathrm{m}\\,\\mathrm{s}^{-1}',fmt(s.meanV)+' m/s')}。</p><p>擬合：${s.fit.attempted?'已執行':'未執行'}；軌跡類型：${s.trajectory===null?'未答':'已答'}。</p>`;
      d.submitButton.disabled=controller.unsaved;
    }
    if(controller.trusted){
      const labels=Object.fromEntries(Object.values(M.QUESTIONS).flatMap(q=>q[1]).concat([['parabola','拋物線'],['line','直線'],['circle','圓弧'],['other','其他曲線'],['linear','一般直線'],['quadratic','一般二次函數'],['square','過原點平方模型'],['inverse','反比例函數']]));
      d.feedbackList.innerHTML=controller.result.detail.map(f=>{
        const formulaKey=f.name==='時間公式'?'time':f.name==='水平初速度公式'?'speed':null,formula=formulaKey?M.FORMULAS[formulaKey].find(o=>o.id===f.answer):null;
        const answer=formulaKey?(formula?math(formula.tex):'未答'):f.answer==null?'未答':typeof f.answer==='number'?math(V.number(f.answer),fmt(f.answer)):prose(labels[f.answer]??f.answer);
        const expected=formulaKey?math(M.FORMULAS[formulaKey].find(o=>o.id===(formulaKey==='time'?'fall':'horizontal')).tex):f.expected===null?'所需資料不足':typeof f.expected==='number'?math(V.number(f.expected),fmt(f.expected)):prose(f.expected);
        return `<details><summary>${prose(f.name)}：${f.points} / ${f.max}</summary><p>你的作答：${answer}；參考：${expected}</p></details>`;
      }).join('');
    }
    drawStage();
  }
  function fitText(f,model){
    if(!f.ok)return `<p>${esc(f.message)}</p>`;
    const c=f.coefficients;
    const term=(n,v,first=false)=>`${n<0?'-':first?'':'+'}${V.number(Math.abs(n))}${v}`;
    const quad=model==='quadratic';
    const equation=quad?`${term(c[0],'x^2',true)}${term(c[1],'x')}${term(c[2],'')}`:model==='square'?term(c[0],'x^2',true):`${term(c[0],'x',true)}${term(c[1],'')}`;
    return `<p>${math('y='+equation)}</p><p>${math('x,y')}：${math('\\mathrm{m}','m')}。</p>`;
  }

  function makeGeometry(view){
    const w=d.stage.clientWidth,h=d.stage.clientHeight;
    if(innerWidth<900&&h>=150){
      const collect=view==='collect',left=collect?16:40,right=32,top=58,bottom=d.stageHint.parentElement===d.stage?88:40,spanX=collect?1260:1000;
      const scale=Math.max(.01,Math.min((w-left-right)/spanX,(h-top-bottom)/1000,collect?(h-16-bottom)/1220:Infinity));
      const originTop=collect?Math.max(top,16+220*scale):top;
      const ox=left+(w-left-right-spanX*scale)/2+(collect?260:0)*scale;
      const oy=originTop+(h-originTop-bottom-1000*scale)/2;
      return{w,h,s:scale,ox,oy,x:n=>ox+n*scale,y:n=>oy+n*scale};
    }
    const extent=view==='collect'?1300:1100;
    const scale=Math.max(.01,Math.min((w-108)/extent,(h-124)/extent));
    const left=(w-extent*scale)/2,top=60;
    const ox=left+(view==='collect'?300:50)*scale,oy=top+(view==='collect'?250:30)*scale;
    return{w,h,s:scale,ox,oy,x:n=>ox+n*scale,y:n=>oy+n*scale};
  }
  function world(g,view,clipId){
    const s=controller.state;if(!s)return'';
    const x=g.x,y=g.y,scale=g.s, q=1000*scale;
    const line=(x1,y1,x2,y2,color='#dbe2eb',width=1,arrow=false)=>`<path d="M${x1},${y1}L${x2},${y2}" stroke="${color}" stroke-width="${width}" fill="none"${arrow?` marker-end="url(#${clipId}Arrow)"`:''}/>`;
    const labelSize=g.labelSize??(innerWidth>=900?24:16);
    const text=(px,py,t,color='#354a64',anchor='start',tex=null)=>{
      const point=String(t).match(/^P([₁₂₃₄₅₆])$/);
      const expression=tex??(point?`P_{${'₁₂₃₄₅₆'.indexOf(point[1])+1}}`:String(t).trim()!==''&&Number.isFinite(Number(t))?V.number(Number(t)):null);
      return expression!==null?CircuitMath.svg(px,py,{tex:expression,text:String(t)},labelSize,`fill="${color}" text-anchor="${anchor}"`):`<text x="${px}" y="${py}" font-size="${labelSize}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`;
    };
    const pointLabel=(px,py,i)=>{
      if(px<0||px>g.w||py<0||py>g.h)return'';
      const metrics=CircuitMath.measure(`P_{${i+1}}`,labelSize),width=metrics.width;
      const leftBaseline=Math.max(py+(metrics.ascent-metrics.descent)/2,y(0)+6+metrics.ascent);
      const candidates=[[px-10,py-10,'end'],[px-10,leftBaseline,'end'],[px,py-10,'middle']];
      let rulerBox=null;
      if(view==='measure'){
        const r=currentRuler(),horizontal=r.axis==='x',pad=labelSize+4,thickness=Math.max(labelSize+28,CircuitMath.measure('100',labelSize).width+24);
        rulerBox={left:x(r.zero[0])-(horizontal?pad:0),top:y(r.zero[1])-(horizontal?0:pad)};
        rulerBox.right=rulerBox.left+(horizontal?q+2*pad:thickness);rulerBox.bottom=rulerBox.top+(horizontal?thickness:q+2*pad);
        candidates.push([Math.min(px-10,rulerBox.left-2),leftBaseline,'end'],[Math.min(px-10,rulerBox.left-2),py-10,'end']);
      }
      const chosen=candidates.find(([lx,ly,anchor])=>{
        const left=lx-(anchor==='end'?width:width/2),right=left+width,top=ly-metrics.ascent,bottom=ly+metrics.descent;
        const crossesAxis=right>=x(0)-2&&left<=x(1000)+10&&top<=y(0)+4&&bottom>=y(0)-labelSize-10;
        return left>=0&&right<=g.w-2&&top>=4&&bottom<=g.h-4&&!crossesAxis&&(!rulerBox||right<rulerBox.left||left>rulerBox.right||bottom<rulerBox.top||top>rulerBox.bottom);
      })??candidates[1];
      return text(chosen[0],chosen[1],pn(i),'#354a64',chosen[2]).replace('<g ',`<g data-point-label="${i}" `);
    };
    let html=`<defs><clipPath id="${clipId}"><rect x="${x(0)}" y="${y(0)}" width="${q}" height="${q}"/></clipPath><marker id="${clipId}Arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#263b55"/></marker></defs><rect width="${g.w}" height="${g.h}" fill="#fff"/>`;
    const step=q<180?500:200;
    for(let i=0;i<=1000;i+=step){html+=line(x(i),y(0),x(i),y(1000))+line(x(0),y(i),x(1000),y(i));if(i>0)html+=text(x(i),y(0)-6,i/10,'#53647b','middle')+text(x(0)-5,y(i)+4,i/10,'#53647b','end');}
    html+=`<circle data-origin="true" cx="${x(0)}" cy="${y(0)}" r="6" fill="#b13f25" stroke="#fff" stroke-width="2"/>`+text(x(0)+10,clipId==='sceneClip'?Math.max(labelSize,y(0)-30):y(0)-30,'O(0,0)','#a3321e','start','O(0,0)');
    html+=line(x(0),y(0),x(1000)+8,y(0),'#263b55',1.5,true)+line(x(0),y(0),x(0),y(1000)+8,'#263b55',1.5,true)+text(x(1000),y(0)-42,'x / cm','#263b55','end','x / \\mathrm{cm}')+text(x(0)+5,y(1000)+28,'y / cm','#263b55','start','y / \\mathrm{cm}');
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
    if(plot){
      const points=M.points(s).map((p,i)=>p?{i,p}:null).filter(Boolean);
      if(s.fit.attempted){const f=M.fit(s);if(f.ok)html+=curve(u=>M.predict(s,f,u/1000)*1000,'#157c75');}
      if(controller.trusted&&s.schemaVersion<3)html+=curve(u=>M.G/(2*M.referenceSpeed(s)**2)*(u/1000)**2*1000,'#b3542d',true);
      points.forEach(({i,p})=>{html+=`<circle data-plot-point="${i}" cx="${x(p[0])}" cy="${y(p[1])}" r="6" fill="#1764b1"/>`;html+=pointLabel(x(p[0]),y(p[1]),i);});
      return html;
    }
    s.rows.forEach((r,i)=>{if(r){const p=M.impact(r.depthMm,r.speedOffsetPpm);html+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" data-impact-mark="true" r="6" fill="#182333"/>`;html+=pointLabel(x(p.x),y(p.y),i);}});
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
      html+=`<circle cx="${x(ball[0])}" cy="${y(ball[1])}" r="${Math.max(7,12*scale)}" fill="#677586" stroke="#172438"/>`;
      if(q>110)html+=text(x(500),y(depth+10)+labelSize+8,'接球槽','#1764b1');
    }
    if(view==='measure'){
      const ruler=currentRuler(),horizontal=ruler.axis==='x',actual=s.rows[measured()],p=actual?M.impact(actual.depthMm,actual.speedOffsetPpm):null;
      // Keep saved millimetre snapping/readings; render the perpendicular edge at the exact mark.
      const rx=!horizontal&&M.rulerAligned(actual,ruler)?p.x:ruler.zero[0],ry=horizontal&&M.rulerAligned(actual,ruler)?p.y:ruler.zero[1];
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
      if(actual){const px=horizontal?x(p.x):rxp,py=horizontal?ryp:y(p.y);html+=line(x(p.x),y(p.y),px,py,'#8d6e37')+`<circle data-reading-target="true" data-reading-slot="${measured()}" cx="${px}" cy="${py}" r="5" fill="#a3321e" stroke="#fff" stroke-width="1.5"/>`;}
    }
    return html;
  }
  function position(e,x,y){e.style.left=x+'px';e.style.top=y+'px';}
  function currentRuler(){return drag?.kind==='ruler'?{...controller.state.ruler,zero:drag.value}:controller.state.ruler??{axis:'x',zero:[0,0]};}
  function heightFeedback(depth){
    const s=controller.state,conflict=s.setup?M.heightConflict(s,depth,s.setup.slot):-1;
    d.release.disabled=!controller.editable||Boolean(run)||Boolean(drag)||conflict>=0;
    d.heightNotice.hidden=!editing()||(conflict<0&&drag?.kind!=='catcher');
    d.heightNotice.dataset.valid=String(conflict<0);
    const html=conflict<0?'此高度可以取樣。':`此高度與第${conflict+1}點相距不足${math('5\\,\\mathrm{cm}','5 cm')}，請上下調槽。`;
    if(d.heightNotice.innerHTML!==html)d.heightNotice.innerHTML=html;
  }
  function drawStage(){
    const s=controller.state;if(!s){d.scene.innerHTML='';d.readingChoices.hidden=true;d.catcherHandle.hidden=d.rulerBodyTarget.hidden=true;return;}
    const view=controller.view;geometry=makeGeometry(view);const g=geometry;
    d.scene.setAttribute('viewBox',`0 0 ${g.w} ${g.h}`);d.scene.innerHTML=world(g,view,'sceneClip');
    d.catcherHandle.hidden=!editing()||view!=='collect';d.rulerBodyTarget.hidden=!editing()||view!=='measure';
    const depth=drag?.kind==='catcher'?drag.value:s.setup?.depthMm??200;
    heightFeedback(depth);
    position(d.catcherHandle,Math.min(g.w-24,g.x(900)),Math.max(23,Math.min(g.h-24,g.y(depth+10))));
    const body=d.scene.querySelector('[data-ruler-body]');
    if(body){const b=body.getBBox();position(d.rulerBodyTarget,b.x,b.y);d.rulerBodyTarget.style.width=b.width+'px';d.rulerBodyTarget.style.height=b.height+'px';}
    drawReadingChoices(g,view);
    d.stageHint.innerHTML=prose(hint||(view==='collect'?'上下調槽，每次留下一個固定撞擊印記。':view==='measure'?'拖動尺身，靠近任何印記會自動吸附及放大；請自行對準零位。':view==='plot'?'資料點已依讀數自動顯示，請選模型擬合及判斷曲線。':view==='speed'?'選擇公式，一次計出全部時間及初速度，再求平均。':'獨立計時配對自己的讀數；圖示位移大小隨時間變化。'));
  }

  function measured(){return M.rulerSlot(controller.state.rows,currentRuler());}
  function drawReadingChoices(g,view){
    const s=controller.state,i=measured(),row=s?.rows[i],ruler=currentRuler(),values=row?M.rulerChoices(row,ruler):[];
    d.readingChoices.dataset.slot=i??'';
    d.readingChoices.hidden=!editing()||view!=='measure'||!M.rulerAligned(row,ruler)||values.length!==4;
    if(d.readingChoices.hidden)return;
    const active=d.readingChoices.contains(document.activeElement)?document.activeElement:null;
    const axis=ruler.axis==='x'?0:1,p=M.impact(row.depthMm,row.speedOffsetPpm),size=innerWidth>=900?24:16;
    const thickness=Math.max(size+28,CircuitMath.measure('100',size).width+24),compact=innerWidth<900||g.h<380,tiny=compact&&g.h<240;
    const target=[g.x(axis?ruler.zero[0]:p.x),g.y(axis?p.y:ruler.zero[1])];
    const sideSpace=Math.max(g.w-target[0]-thickness-16,target[0]-16),stacked=compact&&(g.w<280||(axis&&sideSpace>=156&&g.h>=240));
    const cardWidth=compact?Math.min(g.w-(tiny?8:16),stacked&&g.w>=280?Math.min(220,sideSpace):360):270;
    d.readingChoices.classList.toggle('compact',compact);d.readingChoices.classList.toggle('stacked',stacked);d.readingChoices.classList.toggle('tiny',tiny);d.readingChoices.style.width=cardWidth+'px';
    d.readingChoiceTitle.innerHTML=math(`P_{${i+1}}\\;${axis?'y':'x'}`,pn(i)+' '+s.ruler.axis)+' 讀數';
    readingButtons.forEach((b,j)=>{const n=values[j],html=math(V.number(n/10)+'\\,\\mathrm{cm}',fmt(n/10)+' cm');if(b.innerHTML!==html)b.innerHTML=html;b.dataset.reading=n;b.disabled=Boolean(drag);b.setAttribute('aria-label',`${pn(i)} ${ruler.axis} ${fmt(n/10)} 厘米`);b.setAttribute('aria-pressed',String(row.read[axis]===n));});
    const box=d.readingChoices.getBoundingClientRect(),clamp=(n,max)=>Math.max(4,Math.min(max-4,n));
    const beside=axis?[target[0]+thickness+8,target[0]-box.width-8].find(x=>x>=4&&x+box.width<=g.w-4):undefined;
    const below=target[1]+(axis?8:thickness+8),above=target[1]-box.height-8;
    const left=beside??clamp(target[0]+12,g.w-box.width),top=beside!==undefined?clamp(target[1]-18,g.h-box.height):clamp(below+box.height<=g.h-4?below:above,g.h-box.height);
    {
      const width=d.readingPreview.clientWidth,height=d.readingPreview.clientHeight,zs=Math.max(g.s*8,4),focus=[p.x,p.y],labelSize=compact?16:size,zoomThickness=Math.max(labelSize+28,CircuitMath.measure('100',labelSize).width+24),focusY=axis?height/2:Math.max(6,Math.min(height/2,height-zoomThickness-4)),zoom={w:width,h:height,s:zs,ox:width/2-focus[0]*zs,oy:focusY-focus[1]*zs,labelSize};zoom.x=n=>zoom.ox+n*zs;zoom.y=n=>zoom.oy+n*zs;
      d.readingPreviewSvg.setAttribute('viewBox',`0 0 ${width} ${height}`);d.readingPreviewSvg.innerHTML=world(zoom,'measure','readingClip');
    }
    d.readingChoices.style.left=left+'px';d.readingChoices.style.top=top+'px';active?.focus({preventScroll:true});
  }
  const readingButtons=Array.from({length:4},()=>{const b=document.createElement('button');b.type='button';b.className='reading-choice';b.onclick=()=>{const s=controller.state,i=measured();if(!editing()||controller.view!=='measure'||drag||i===null||!M.rulerAligned(s.rows[i],s.ruler))return;const n=Number(b.dataset.reading);if(M.rulerChoices(s.rows[i],s.ruler).includes(n))command({type:'read',slot:i,axis:s.ruler.axis==='x'?0:1,value:n});};d.readingOptions.append(b);return b;});
  function modelPoint(event){const r=d.stage.getBoundingClientRect();return[(event.clientX-r.left-geometry.ox)/geometry.s,(event.clientY-r.top-geometry.oy)/geometry.s];}
  function resolveDrag(event){
    const p=modelPoint(event), start=drag.startModel, delta=[p[0]-start[0],p[1]-start[1]], clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    if(drag.kind==='catcher')return clamp(Math.round((drag.before+delta[1])/5)*5,50,800);
    const raw=drag.before.map((v,i)=>clamp(Math.round(v+delta[i]),-100,1000));
    const threshold=event.pointerType==='mouse'?8:12;
    return M.snapRuler(controller.state,raw,geometry.s,threshold);
  }

  function beginDrag(event,kind){
    if(!editing()||run||event.button!==0||event.isPrimary===false)return;
    if(drag){cancelDrag();drawStage();return;}
    const s=controller.state,before=kind==='catcher'?s.setup.depthMm:s.ruler.zero;
    if(before===null||before===undefined)return;
    diagnostics.downs++;if(event.isTrusted&&event.pointerType==='touch')diagnostics.trustedTouch++;
    drag={kind,before:M.clone(before),value:M.clone(before),id:event.pointerId,target:event.currentTarget,start:[event.clientX,event.clientY],startModel:modelPoint(event),moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
    if(kind==='ruler')drawStage();
  }
  function moveDrag(event){if(!drag||event.pointerId!==drag.id)return;const distance=Math.hypot(event.clientX-drag.start[0],event.clientY-drag.start[1]);if(!drag.moved&&distance<(event.pointerType==='mouse'?3:6))return;drag.moved=true;drag.value=resolveDrag(event);diagnostics.moves++;drawStage();}
  function finishDrag(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(event.type!=='pointerup'){cancelDrag();drawStage();return;}
    const previous=drag;if(previous.moved)previous.value=resolveDrag(event);drag=null;diagnostics.ups++;
    try{previous.target.releasePointerCapture(previous.id);}catch(_){}
    if(previous.moved){if(previous.kind==='catcher')command({type:'setup',value:{depthMm:previous.value}});else command({type:'ruler',value:{axis:controller.state.ruler.axis,zero:previous.value}});}
    drawStage();
  }
  function attachDrag(element,kind){element.addEventListener('pointerdown',e=>beginDrag(e,kind));element.addEventListener('pointermove',moveDrag);['pointerup','pointercancel','lostpointercapture'].forEach(t=>element.addEventListener(t,finishDrag));}
  attachDrag(d.catcherHandle,'catcher');attachDrag(d.rulerBodyTarget,'ruler');
  document.addEventListener('pointerdown',e=>{if(drag&&e.pointerId!==drag.id){cancelDrag();drawStage();}},true);
  function keyboard(event,kind){
    if(!editing()||run||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    if(kind==='catcher')command({type:'setup',value:{depthMm:clamp(controller.state.setup.depthMm+dy*(event.shiftKey?25:5),50,800)}});
    else if(kind==='ruler'){const r=controller.state.ruler,n=event.shiftKey?10:1;command({type:'ruler',value:{axis:r.axis,zero:[clamp(r.zero[0]+dx*n,-100,1000),clamp(r.zero[1]+dy*n,-100,1000)]}});}
  }
  d.catcherHandle.addEventListener('keydown',e=>keyboard(e,'catcher'));d.rulerBodyTarget.addEventListener('keydown',e=>keyboard(e,'ruler'));
  function numberInput(e,options={}){
    if(e.value.trim()==='')return null;
    const n=Number(e.value),scale=options.scale??1;
    if(!Number.isFinite(n)||(!options.signed&&n<0)||(options.max!==undefined&&n>options.max)||(scale!==1&&Math.abs(n*scale-Math.round(n*scale))>1e-7)){
      controller.notice='數值未記錄：請輸入有效範圍內的數字；座標精確至0.1cm。';e.blur();render();return undefined;
    }
    return scale===1?n:Math.round(n*scale);
  }
  document.querySelectorAll('[data-clear-read]').forEach(e=>e.onclick=()=>command({type:'read',slot:+e.dataset.clearRead,axis:+e.dataset.axis,value:null}));
  document.querySelectorAll('[data-formula-choice]').forEach(e=>e.addEventListener('change',()=>command({type:'formula',field:e.dataset.formulaChoice,value:e.value})));
  document.querySelectorAll('[data-clear-formula]').forEach(e=>e.onclick=()=>command({type:'formula',field:e.dataset.clearFormula,value:null}));
  d.meanV.addEventListener('change',()=>{const n=numberInput(d.meanV);if(n!==undefined)command({type:'answer',field:'meanV',value:n});});
  d.recordSlot.addEventListener('change',()=>command({type:'setup',value:{slot:+d.recordSlot.value}}));
  d.depthUp.onclick=()=>command({type:'setup',value:{depthMm:Math.max(50,controller.state.setup.depthMm-5)}});
  d.depthDown.onclick=()=>command({type:'setup',value:{depthMm:Math.min(800,controller.state.setup.depthMm+5)}});
  ['x','y'].forEach(axis=>d[axis==='x'?'rulerX':'rulerY'].onclick=()=>command({type:'ruler',value:{...controller.state.ruler,axis}}));
  d.rulerHome.onclick=()=>command({type:'ruler',value:{...controller.state.ruler,zero:[0,0]}});
  d.fitModel.onchange=()=>command({type:'model',value:d.fitModel.value||null});d.fitButton.onclick=()=>command({type:'fit'});d.trajectory.onchange=()=>command({type:'answer',field:'trajectory',value:d.trajectory.value||null});
  d.clearPlot.onclick=()=>{cancelDrag();if(confirm('清除擬合及軌跡分類？印記、讀數、自動圖點及速度結果保留。'))command({type:'clearPlot'});drawStage();};
  d.previous.onclick=()=>navigate(M.VIEWS[Math.max(0,M.VIEWS.indexOf(controller.view)-1)]);
  d.next.onclick=()=>controller.view===M.VIEWS.at(-1)?check():navigate(M.VIEWS[Math.min(M.VIEWS.length-1,M.VIEWS.indexOf(controller.view)+1)]);
  d.checkButton.onclick=check;d.returnCheck.onclick=check;d.submitButton.onclick=()=>controller.submit();d.retryFinal.onclick=()=>controller.retryFinal();d.saveRetry.onclick=()=>controller.retrySave();
  document.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>navigate(e.dataset.go));
  d.clearAll.onclick=()=>{cancelDrag();cancelFlight();if(confirm('清除本次全部印記、讀數及答案？')){controller.clear();prepareTesting();}else render();};
  d.modeToggle.onclick=()=>{const url=new URL(location.href);url.searchParams.set('test',testing()?'0':'1');location.replace(url.href);};
  d.release.onclick=()=>{
    if(!editing()||run)return;const {slot,depthMm}=controller.state.setup;
    if(M.heightConflict(controller.state,depthMm,slot)>=0){render();return;}
    if(controller.state.rows[slot]&&!confirm(`重做${pn(slot)}會清除此點的讀數及相應自動結果，並更新相關擬合。繼續？`))return;
    const ppm=M.observedOffset(controller.state.launchOffsetPpm??0,M.drawOffset()), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    run={slot,depthMm,ppm,impact:M.impact(depthMm,ppm),started:performance.now(),ramp:reduced?20:900,slow:reduced ? 0.1 : 4};hint='鋼珠正在滾出水平出口……';render();
    const tick=()=>{
      if(!run)return;
      if(performance.now()-run.started>=run.ramp+run.impact.t*1000*run.slow){const completed=run;run=null;frame=0;hint=`已將${pn(completed.slot)}撞擊印記轉記到記錄紙。`;command({type:'record',slot:completed.slot,depthMm:completed.depthMm,ppm:completed.ppm});return;}
      drawStage();frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
  };
  window.addEventListener('blur',()=>{cancelDrag();cancelFlight();render();});
  new ResizeObserver(()=>{cancelDrag();cancelFlight();render();}).observe(d.stage);
  window.__projectileApp={getState:()=>M.clone(controller.state),controller,getGeometry:()=>geometry?{s:geometry.s,ox:geometry.ox,oy:geometry.oy,w:geometry.w,h:geometry.h}:null,getDiagnostics:()=>({...diagnostics}),isRunning:()=>Boolean(run)};
  controller.start();
  prepareTesting();
})().catch(error=>{document.getElementById('notice').hidden=false;document.getElementById('notice').textContent='數學排版未能載入，請重新載入活動。';console.error(error);});
