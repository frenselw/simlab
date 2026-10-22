(function(){
  'use strict';
  const M=CentripetalSourceModel;
  const d=Object.fromEntries([...document.querySelectorAll('[id]')].map(e=>[e.id,e]));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const mathLabel=x=>esc(x).replace(/F向|F引|fₛ|μₛ|mv²/g,t=>({'F向':'<math><msub><mi>F</mi><mtext>向</mtext></msub></math>','F引':'<math><msub><mi>F</mi><mtext>引</mtext></msub></math>','fₛ':'<math><msub><mi>f</mi><mi>s</mi></msub></math>','μₛ':'<math><msub><mi>μ</mi><mi>s</mi></msub></math>','mv²':'<math><mrow><mi>m</mi><msup><mi>v</mi><mn>2</mn></msup></mrow></math>'}[t]));
  const kindText=i=>M.KINDS[i]?.[1]||'';
  const symbol=['mg','F引','T','N','fₛ','fₖ','F向','F離','F驅'];
  const feedback=[
    '水平拉力提供徑向合力；重力與支持力在豎直方向平衡。不要另外畫一個向心力。',
    '靜摩擦指向圓心，不一定沿運動反方向；這裏沒有相對滑動。',
    '拉力的水平分量 T sin θ 提供徑向合力；豎直分量 T cos θ 平衡重力。',
    '最高點圓心向下，故 mg − N = mv²/r；汽車仍接觸路面。',
    '最低點圓心向上，故 N − mg = mv²/r；與拱頂方向相反。',
    '作用在地球上的徑向力是太陽對地球的引力，不另加向心力或離心力。地球對太陽的引力作用在太陽。'
  ];
  const controller=new CentripetalSourceRuntime.Controller(SimScorm,SimActivityFlow,render);
  let drag=null,layout=null,resizeFrame=0,scenePlaying=null;
  const diagnostics={down:0,move:0,up:0,cancel:0,trustedTouch:0};
  d.caseNav.innerHTML=M.CASES.map((q,i)=>`<button type="button" data-page="${i}">${i+1} ${esc(q.title)}</button>`).join('');
  d.compactNav.innerHTML=M.CASES.map((q,i)=>`<option value="${i}">${i+1} ${esc(q.title)}</option>`).join('');
  d.forcePalette.innerHTML+=[...M.KINDS].map(([key,label],i)=>`<option value="${i}">${esc(label)}</option>`).join('');
  const point=(cx,cy,a,length)=>[cx+Math.cos(a*Math.PI/1800)*length,cy-Math.sin(a*Math.PI/1800)*length];
  function arrow(cx,cy,a,len,color,outline=false){
    const [x,y]=point(cx,cy,a,len),dx=(x-cx)/len,dy=(y-cy)/len,head=Math.min(13,len*.45),wing=Math.min(6,len*.22),bx=x-dx*head,by=y-dy*head,nx=-dy,ny=dx;
    return `<path d="M${cx},${cy} L${bx},${by} M${x},${y} L${bx+nx*wing},${by+ny*wing} L${bx-nx*wing},${by-ny*wing} Z" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="${outline?'white':color}"/>`;
  }
  const text=(x,y,value,attr='')=>`<text x="${x}" y="${y}" ${attr}>${esc(value)}</text>`;
  const circle=(x,y,r,fill,stroke='none')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  function geometry(){const r=d.diagram.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),cx=w/2,cy=h/2,scale=Math.min(2.4,(w-64)/220,(h-34)/190);return {w,h,cx,cy,scale:Math.max(.3,scale)};}
  function context(page,geo,def){
    const {w,h,cx,cy,scale}=geo,inner=M.inward(def,page),sign=inner==='E'?1:-1;
    let s='';
    if(page===0||page===1){
      s+=`<path d="M8,${cy+27*scale} H${w-8}" stroke="#73899e" stroke-width="5"/>`;
      if(page===0){s+=`<path d="M${cx},${cy} L${cx+sign*104*scale},${cy}" stroke="#9b7049" stroke-width="2.5"/>${circle(cx+sign*104*scale,cy,5,'#795636')}`;}
      else s+=`<path d="M${cx+sign*102*scale},${cy+27*scale} V${cy+10*scale}" stroke="#9b7049" stroke-width="3"/>`;
      s+=text(cx+sign*104*scale,cy-13*scale,'圓心',`text-anchor="middle"`);
    }else if(page===2){
      const pivot=[cx+sign*76*scale,cy-84*scale];s+=`<path d="M${cx},${cy} L${pivot}" stroke="#9b7049" stroke-width="3"/>${circle(...pivot,5,'#795636')}${text(pivot[0]+sign*7,pivot[1]-5,'懸點')}`;
      s+=`<path d="M${pivot[0]},${pivot[1]} V${cy+4}" stroke="#a7b4c3" stroke-dasharray="5 4"/>`;
    }else if(page===3||page===4){
      const y=cy+24*scale,edge=page===3?y+35*scale:y-35*scale;
      s+=`<path d="M5,${edge} Q${cx},${page===3?y-35*scale:y+35*scale} ${w-5},${edge}" fill="none" stroke="#73899e" stroke-width="6"/>`;
      const centerY=cy+(page===3?75:-75)*scale;
      s+=`<path d="M${cx},${cy} V${centerY}" stroke="#a7b4c3" stroke-width="2" stroke-dasharray="5 4"/>${text(cx+10,Math.max(18,Math.min(h-9,centerY)), '圓心方向')}`;
    }else{
      const a=M.directionAngle(inner),[sx,sy]=point(cx,cy,a,80*scale);
      s+=circle(sx,sy,80*scale,'none','#acbdd0')+circle(sx,sy,12*scale,'#e8aa32')+text(sx+14*scale,sy,'太陽');
      s+=`<path d="M${cx},${cy} L${sx},${sy}" stroke="#a7b4c3" stroke-dasharray="5 4"/>`;
    }
    s+=circle(cx,cy,10*scale,page===5?'#3179b5':'#405e7d')+text(cx+14*scale,cy-12*scale,page===5?'地球':page===3||page===4?'汽車':'研究對象');
    return s;
  }
  function analysisDrawing(state,page,geo,reference=false,previewArrow=null){
    const {w,h,cx,cy,scale}=geo,item=state.items[page],forces=reference?M.physics(state.def,page).forces.map(([kind,a,m])=>[kind,a,m]):item.arrows;
    let svg=context(page,geo,state.def);
    let referenceScale=1;
    if(reference){const max=Math.max(...forces.map(f=>f[2]));referenceScale=76/max;}
    forces.forEach(([kind,angle,len],i)=>{
      const a=previewArrow&&previewArrow.index===i?previewArrow.angle:angle;
      const displayLength=reference?len*referenceScale*scale:(previewArrow&&previewArrow.index===i?previewArrow.length:len)*scale;
      if(a===null){svg+=circle(cx+20*scale,cy-20*scale,5,'#7049a4')+text(cx+28*scale,cy-22*scale,'方向未定');return;}
      svg+=arrow(cx,cy,a,displayLength,reference?'#18734b':'#7049a4',reference);
      const [x,y]=point(cx,cy,a,displayLength*.65),rad=a*Math.PI/1800;
      svg+=text(Math.max(20,Math.min(w-20,x-Math.sin(rad)*16*scale)),Math.max(18,Math.min(h-8,y-Math.cos(rad)*16*scale)),symbol[kind],`text-anchor="middle" fill="${reference?'#18734b':'#7049a4'}"`);
    });
    return svg;
  }
  function sceneDrawing(state,page,geo){
    const {w,h,cx,cy,scale}=geo,q=M.CASES[page],p=M.physics(state.def,page);
    if(page===3||page===4)return context(page,geo,state.def)+text(cx,Math.max(20,cy-45*scale),'只分析此刻的速度與受力',`text-anchor="middle"`);
    const r=Math.max(22,Math.min(w,h)*.29),sense=page===5?p.values.sense:1,start=page===5?-45*state.def[5][0]:state.def[page][0]===0?0:180;
    const duration=page===5?12:page===2?2*Math.PI/p.values.omega:2*Math.PI*p.values.r/p.values.v;
    let svg=circle(cx,cy,r,'none','#afc0d2')+circle(cx,cy,page===5?11:5,page===5?'#e8aa32':'#795636');
    svg+=text(cx+12,cy-8,page===5?'太陽':'圓心');
    const motion=!scenePlaying||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'':`<animateTransform attributeName="transform" type="rotate" from="${start} ${cx} ${cy}" to="${start-sense*360} ${cx} ${cy}" dur="${duration.toFixed(2)}s" repeatCount="indefinite"/>`;
    svg+=`<g transform="rotate(${start} ${cx} ${cy})">${motion}${circle(cx+r,cy,10,page===5?'#3179b5':'#405e7d')}${page===0||page===2?`<path d="M${cx},${cy} H${cx+r-10}" stroke="#9b7049" stroke-width="2"/>`:''}</g>`;
    svg+=text(cx,Math.max(22,cy-r-22),q.title,`text-anchor="middle"`);
    return svg;
  }
  function drawStage(){
    if(!controller.state||!['edit','check','review','committed','frozen'].includes(controller.mode)){if(controller.mode!=='technical')d.diagramSvg.innerHTML='';d.forceHandle.hidden=true;d.preview.hidden=true;return;}
    const s=controller.state,page=controller.page,item=s.items[page];layout=geometry();
    const scene=controller.mode==='edit'&&s.view==='scene';
    d.diagramSvg.setAttribute('viewBox',`0 0 ${layout.w} ${layout.h}`);
    d.diagramSvg.innerHTML=scene?sceneDrawing(s,page,layout):analysisDrawing(s,page,layout,false,drag);
    const selected=item.selected===null?null:item.arrows[item.selected];
    d.forceHandle.hidden=scene||controller.mode!=='edit'||!selected;
    if(selected&&!d.forceHandle.hidden){
      const a=drag?drag.angle:selected[1],len=drag?drag.length:selected[2],at=a===null?[layout.cx+20*layout.scale,layout.cy-20*layout.scale]:point(layout.cx,layout.cy,a,len*layout.scale);
      d.forceHandle.style.left=at[0]+'px';d.forceHandle.style.top=at[1]+'px';d.forceHandle.dataset.index=String(item.selected);
      d.forceHandle.setAttribute('aria-label',`${kindText(selected[0])}，${a===null?'方向未定':(a/10).toFixed(1)+'度'}；拖動箭尖或使用方向控制`);
    }
    if(drag&&drag.touch){
      d.preview.hidden=false;const stage=d.stage.getBoundingClientRect();d.preview.style.left=(drag.clientX>stage.left+stage.width/2?4:Math.max(4,stage.width-144))+'px';
      d.previewSvg.setAttribute('viewBox',`${layout.cx-35} ${layout.cy-30} 70 60`);
      d.previewSvg.innerHTML=analysisDrawing(s,page,layout,false,drag);
    }else d.preview.hidden=true;
  }
  function render(c){
    if(scenePlaying===null)scenePlaying=Boolean(c.startedNew);
    d.notice.hidden=!c.notice;d.notice.textContent=c.notice;d.saveRetry.hidden=!c.unsaved;
    d.status.textContent={edit:'選擇圓心方向、畫實際受力並判斷關係',check:'檢查後明確提交',review:'已記錄・唯讀回看',committed:'已記錄・完成程序待重試',frozen:'提交待確認・答案凍結',mismatch:'紀錄未能核對',technical:'載入技術問題',submitting:'正在提交'}[c.mode]||'';
    const hasState=Boolean(c.state),page=hasState?c.page:0,editable=c.mode==='edit',item=hasState?c.state.items[page]:null;
    d.caseNav.querySelectorAll('button').forEach((b,i)=>{b.disabled=!hasState||c.mode==='technical'||c.mode==='mismatch'||c.mode==='submitting';b.setAttribute('aria-current',i===page?'step':'false');});
    d.compactNav.disabled=!hasState||c.mode==='technical'||c.mode==='mismatch'||c.mode==='submitting';d.compactNav.value=String(page);
    d.checkButton.hidden=!editable;d.learningPanel.hidden=!hasState||c.mode==='check'||c.mode==='technical'||c.mode==='mismatch'||c.mode==='submitting';
    d.checkPanel.hidden=c.mode!=='check';d.resultPanel.hidden=!['review','committed','frozen','mismatch'].includes(c.mode);
    d.retryFinal.hidden=!['committed','frozen'].includes(c.mode);d.feedback.hidden=!c.trusted;
    d.app.classList.toggle('checking',c.mode==='technical'||c.mode==='mismatch');
    if(hasState){
      const q=M.CASES[page];d.caseTitle.textContent=`${page+1}. ${q.title}`;d.caseNote.textContent=q.note;
      d.analyseButton.disabled=!editable||c.state.view==='analysis';d.sceneButton.disabled=!editable||(c.state.view==='scene'&&scenePlaying);d.sceneButton.textContent=c.state.view==='scene'?(scenePlaying?'正在播放':'播放運動'):'觀看運動';
      d.directionChoices.innerHTML=M.DIRECTIONS.map((key,i)=>`<button type="button" data-inward="${key}" aria-pressed="${item.inward===key}" ${editable?'':'disabled'}>${M.DIRECTION_LABELS[i]}</button>`).join('');
      d.forcePalette.value=item.palette===null?'':String(item.palette);d.forcePalette.disabled=!editable;d.addForce.disabled=!editable||item.palette===null||item.arrows.length>=6;
      d.forceList.innerHTML=item.arrows.map(([kind,angle],i)=>`<div class="force-row" data-selected="${item.selected===i}"><button type="button" data-select="${i}" ${editable?'':'disabled'} aria-pressed="${item.selected===i}">${i+1} 選取</button><select data-kind="${i}" aria-label="第${i+1}支力的種類與來源" ${editable?'':'disabled'}>${M.KINDS.map(([key,label],j)=>`<option value="${j}" ${j===kind?'selected':''}>${esc(label)}</option>`).join('')}</select><span class="force-state">${angle===null?'方向未定':`方向 ${(angle/10).toFixed(1)}°`}</span></div>`).join('')||'<p>尚未加入任何力。</p>';
      d.directionTools.hidden=item.selected===null;d.selectedForceLabel.textContent=item.selected===null?'':kindText(item.arrows[item.selected][0]);
      d.arrowDirections.innerHTML=M.DIRECTIONS.map((key,i)=>`<button type="button" data-arrow-angle="${i*450}" ${editable?'':'disabled'}>${M.DIRECTION_LABELS[i]}</button>`).join('');
      d.deleteForce.disabled=!editable||item.selected===null;d.clearDrawing.disabled=!editable||!item.arrows.length;d.clearPage.disabled=!editable;
      d.relationChoices.innerHTML=M.options(c.state,page).map(([key,label])=>`<label class="choice"><input type="radio" name="relation" value="${key}" ${item.relation===key?'checked':''} ${editable?'':'disabled'}><span>${mathLabel(label)}</span></label>`).join('');
      d.conceptChoices.innerHTML=M.CONCEPT.map(([key,label])=>`<label class="choice"><input type="radio" name="concept" value="${key}" ${c.state.concept===key?'checked':''} ${editable?'':'disabled'}><span>${esc(label)}</span></label>`).join('');
      d.conceptField.hidden=page!==5;
      d.checkSummary.innerHTML=M.CASES.map((q,i)=>{const a=c.state.items[i],answered=[a.inward!==null,a.arrows.some(x=>x[1]!==null),a.relation!==null].filter(Boolean).length,geo={w:290,h:150,cx:145,cy:76,scale:.7};return `<div class="summary-row"><button type="button" data-return="${i}">${i+1} ${esc(q.title)}</button>${answered}/3 項已答；${a.arrows.filter(x=>x[1]===null).length} 支力方向未定<svg viewBox="0 0 290 150" role="img" aria-label="${esc(q.title)}的目前受力圖">${analysisDrawing(c.state,i,geo)}</svg></div>`;}).join('')+`<p>共同概念：${c.state.concept===null?'未答':'已答'}</p>`;
      d.returnEdit.disabled=false;d.submitButton.disabled=c.unsaved;
      if(c.trusted){
        d.feedbackList.innerHTML=M.CASES.map((q,i)=>{const result=c.result.detail[i],refGeo={w:290,h:150,cx:145,cy:76,scale:.7},forces=M.physics(c.state.def,i).forces;return `<article class="feedback-card"><h3>${i+1}. ${esc(q.title)} — ${result.earned.toFixed(2)} / 16</h3><p>圓心 ${result.inward}/3；力種類與來源 ${result.force.toFixed(2)}/6；方向 ${result.direction.toFixed(2)}/4；關係 ${result.relation}/3</p><svg viewBox="0 0 290 150" role="img" aria-label="${esc(q.title)}的參考受力圖">${analysisDrawing(c.state,i,refGeo,true)}</svg><p>參考實際力：${forces.map(f=>esc(kindText(f[0]))).join('、')}。</p><p>${esc(feedback[i])}</p></article>`;}).join('')+`<p>共同概念 ${c.result.concept}/4。向心力是徑向合效果，不是參考圖上另一支外力箭頭。等速圓周運動的全合力向內；一般變速圓周運動只有徑向分量提供向心加速度。</p>`;
      }
      if(c.mode!=='technical'&&c.mode!=='mismatch')try{drawStage();}catch(_){c.technical('圖像暫時無法呈現，本次作答已停止修改。請聯絡教師檢查。');return;}
    }else{d.diagramSvg.innerHTML='';d.forceHandle.hidden=true;d.preview.hidden=true;}
    d.resultTitle.textContent=c.mode==='frozen'?'提交結果未確認':c.mode==='mismatch'?'記錄需要核對':c.mode==='committed'?'成績已記錄':'提交結果';
    d.scoreText.textContent=c.mode==='frozen'?'-- / 100（尚未確認）':c.mode==='mismatch'?`${c.result?.score??'--'} / 100；${SimActivityFlow.completionLabel(c.result?.passed??null)}`:c.result?`${c.result.score.toFixed(2)} / 100；${SimActivityFlow.completionLabel(c.result.passed)}`:'';
  }
  function cancelDrag(){if(!drag)return;diagnostics.cancel++;drag=null;d.preview.hidden=true;drawStage();}
  function locate(e){
    const r=d.diagram.getBoundingClientRect(),x=e.clientX-r.left-layout.cx,y=layout.cy-(e.clientY-r.top),radius=Math.hypot(x,y),raw=M.angle(Math.atan2(y,x)*180/Math.PI),touch=e.pointerType==='touch';
    const inward=M.directionAngle(M.inward(controller.state.def,controller.page));
    const candidate=[0,900,1800,2700,inward,M.angle(inward/10+180),...M.physics(controller.state.def,controller.page).forces.flatMap(f=>[f[1],M.angle(f[1]/10+180)])];
    let a=raw,best=Infinity;for(const snap of candidate){const diff=M.difference(raw,snap);if(diff<best&&diff<=(touch?80:50)&&Math.sin(diff*Math.PI/1800)*radius<=(touch?14:10)){best=diff;a=snap;}}
    return {angle:a,length:Math.max(40,Math.min(100,Math.round(radius/layout.scale)))};
  }
  d.forceHandle.addEventListener('pointerdown',e=>{
    if(controller.mode!=='edit'||drag)return;
    const item=controller.state.items[controller.page],index=item.selected;if(index===null)return;
    e.preventDefault();d.forceHandle.setPointerCapture(e.pointerId);drag={index,angle:item.arrows[index][1],length:item.arrows[index][2],pointerId:e.pointerId,touch:e.pointerType==='touch',clientX:e.clientX};
    diagnostics.down++;if(e.isTrusted&&e.pointerType==='touch')diagnostics.trustedTouch++;
    if(e.pointerType==='touch'){const p=locate(e);Object.assign(drag,p);drawStage();}
  });
  d.forceHandle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;Object.assign(drag,locate(e));drag.clientX=e.clientX;diagnostics.move++;drawStage();});
  d.forceHandle.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointerId)return;Object.assign(drag,locate(e));const {angle,length}=drag;drag=null;diagnostics.up++;d.preview.hidden=true;controller.command({type:'arrow',angle,length});});
  d.forceHandle.addEventListener('pointercancel',cancelDrag);
  d.forceHandle.addEventListener('lostpointercapture',()=>{if(drag)cancelDrag();});
  d.forceHandle.addEventListener('keydown',e=>{
    if(controller.mode!=='edit'||drag)return;const item=controller.state.items[controller.page],a=item.arrows[item.selected];if(!a)return;
    const step=e.shiftKey?50:10;let next=a[1],len=a[2];
    if(e.key==='ArrowLeft')next=((next??0)+step)%3600;else if(e.key==='ArrowRight')next=((next??0)-step+3600)%3600;else if(e.key==='ArrowUp')len=Math.min(100,len+5);else if(e.key==='ArrowDown')len=Math.max(40,len-5);else return;
    e.preventDefault();if(next!==null)controller.command({type:'arrow',angle:next,length:len});
  });
  document.addEventListener('pointerdown',e=>{if(drag&&e.pointerId!==drag.pointerId)cancelDrag();},true);
  window.addEventListener('blur',cancelDrag);
  d.caseNav.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){cancelDrag();controller.navigate(Number(b.dataset.page));}});
  d.compactNav.addEventListener('change',()=>{cancelDrag();controller.navigate(Number(d.compactNav.value));});
  d.checkButton.addEventListener('click',()=>{cancelDrag();scenePlaying=false;controller.check();});
  d.analyseButton.addEventListener('click',()=>{scenePlaying=false;controller.command({type:'analyse'});});
  d.sceneButton.addEventListener('click',()=>{scenePlaying=true;if(controller.state?.view==='scene')render(controller);else controller.command({type:'scene'});});
  d.directionChoices.addEventListener('click',e=>{const b=e.target.closest('[data-inward]');if(b)controller.command({type:'inward',value:b.dataset.inward});});
  d.forcePalette.addEventListener('change',()=>controller.command({type:'palette',value:d.forcePalette.value===''?null:Number(d.forcePalette.value)}));
  d.addForce.addEventListener('click',()=>controller.command({type:'add'}));
  d.forceList.addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b)controller.command({type:'select',index:Number(b.dataset.select)});});
  d.forceList.addEventListener('change',e=>{const x=e.target.closest('[data-kind]');if(x){controller.command({type:'select',index:Number(x.dataset.kind)});controller.command({type:'kind',value:Number(x.value)});}});
  d.arrowDirections.addEventListener('click',e=>{const b=e.target.closest('[data-arrow-angle]');if(b){const item=controller.state.items[controller.page],a=item.arrows[item.selected];controller.command({type:'arrow',angle:Number(b.dataset.arrowAngle),length:a[2]});}});
  d.deleteForce.addEventListener('click',()=>controller.command({type:'delete'}));d.clearDrawing.addEventListener('click',()=>controller.command({type:'clear-drawing'}));d.clearPage.addEventListener('click',()=>controller.command({type:'clear-page'}));
  d.relationChoices.addEventListener('change',e=>{if(e.target.name==='relation')controller.command({type:'relation',value:e.target.value});});
  d.conceptChoices.addEventListener('change',e=>{if(e.target.name==='concept')controller.command({type:'concept',value:e.target.value});});
  d.returnEdit.addEventListener('click',()=>controller.returnToEdit());
  d.checkSummary.addEventListener('click',e=>{const b=e.target.closest('[data-return]');if(b)controller.navigate(Number(b.dataset.return));});
  d.submitButton.addEventListener('click',()=>controller.submit());d.retryFinal.addEventListener('click',()=>controller.retryFinal());d.saveRetry.addEventListener('click',()=>controller.retrySave());
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(drawStage);});
  window.__centripetalSourceApp={controller,diagnostics,getState:()=>M.clone(controller.state),getLayout:()=>layout};
  controller.start();
})();
