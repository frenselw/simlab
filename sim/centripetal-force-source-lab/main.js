(function(){
  'use strict';
  const M=CentripetalSourceModel,Scene=CentripetalSourceScene,N=CentripetalSourceNotation;
  const d=Object.fromEntries([...document.querySelectorAll('[id]')].map(e=>[e.id,e]));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const kindText=i=>N.forces[i]?`${N.forces[i].source}的${N.forces[i].name}`:'';
  const directionCells=[[3,2],[3,1],[2,1],[1,1],[1,2],[1,3],[2,3],[3,3]];
  const feedback=[
    '水平拉力提供徑向合力；重力與支持力在豎直方向平衡。不要另外畫一個向心力。',
    '靜摩擦指向圓心，不一定沿運動反方向；這裏沒有相對滑動。',
    '拉力的水平分量 T sin θ 提供徑向合力；豎直分量 T cos θ 平衡重力。',
    '最高點圓心向下，故 mg − N = mv²/r；汽車仍接觸路面。',
    '最低點圓心向上，故 N − mg = mv²/r；與拱頂方向相反。',
    '作用在地球上的徑向力是太陽對地球的引力，不另加向心力或離心力。地球對太陽的引力作用在太陽。'
  ];
  const controller=new CentripetalSourceRuntime.Controller(SimScorm,SimActivityFlow,render);
  let drag=null,layout=null,resizeFrame=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion={page:-1,travel:0,playing:false,pending:null,last:0,paint:0};
  const diagnostics={down:0,move:0,up:0,cancel:0,trustedTouch:0};
  d.caseNav.innerHTML=M.CASES.map((q,i)=>`<button type="button" data-page="${i}">${i+1} ${esc(q.title)}</button>`).join('');
  d.compactNav.innerHTML=M.CASES.map((q,i)=>`<option value="${i}">${i+1} ${esc(q.title)}</option>`).join('');
  d.kindSelect.innerHTML=N.forces.map((f,i)=>`<option value="${i}">${esc(f.name+'：'+f.source)}</option>`).join('');
  d.notationHint.innerHTML='箭頭上的符號表示力矢量；重力大小 '+N.prose('G = mg')+'。';
  const point=(cx,cy,a,length)=>[cx+Math.cos(a*Math.PI/1800)*length,cy-Math.sin(a*Math.PI/1800)*length];
  const text=(x,y,value,attr='')=>`<text x="${x}" y="${y}" ${attr}>${esc(value)}</text>`;
  const circle=(x,y,r,fill,stroke='none')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  function geometry(){
    const r=d.diagram.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);
    const scale=Math.max(.3,Math.min(2.6,(w-74)/220,(h-68)/210));
    return {w,h,cx:w/2,cy:h/2+7,scale};
  }
  function analysisDrawing(state,page,geo,reference=false,previewArrow=null){
    const {w,h,cx,cy,scale}=geo,item=state.items[page],physics=M.physics(state.def,page,item.pose);
    const forces=reference?physics.forces.map(([kind,a,m])=>[kind,a,m]):item.arrows.slice();
    if(previewArrow?.creating&&previewArrow.angle!==null)forces.push([item.palette,previewArrow.angle,previewArrow.length]);
    let svg=`<rect width="${w}" height="${h}" fill="#fff"/>`;
    if(!geo.mini)svg+=text(8,20,page<3?'沿半徑的豎直剖面':page===3?'汽車在拱橋頂部':page===4?'汽車在凹路最低點':'地球受力分析','class="analysis-heading"');
    svg+=Scene.backdrop(page,state.def,geo,item.pose);
    const size=Math.max(16,Math.min(25,21*scale)),normalise=reference?76/Math.max(...forces.map(f=>f[2])):1;
    const entries=forces.map(([kind,angle,len],i)=>{
      const a=previewArrow?.index===i?previewArrow.angle:angle,length=(previewArrow?.index===i?previewArrow.length:len)*normalise*scale;
      const force=N.forces[kind],measure=N.measure(force.tex,size);return {i,kind,angle:a,length,force,width:measure.width+4,height:measure.height+4};
    }).filter(e=>e.angle!==null);
    const labels=Scene.labelPositions(entries,geo);
    svg+='<g class="student-arrows">';
    for(const e of labels)svg+=`<path class="force-vector" data-arrow="${e.i}" data-kind="${e.kind}" d="${Scene.arrowPath(geo,e.angle,e.length)}" fill="${e.force.color}" opacity="${reference||item.selected===null||item.selected===e.i?1:.8}"/><circle cx="${e.end.x}" cy="${e.end.y}" r="2.8" fill="#fff" stroke="${e.force.color}" stroke-width="1.5"/>`;
    svg+='</g><g class="force-labels">';
    for(const e of labels)svg+=N.svg(e.force.tex,e.force.name,e.box,size,e.force.color);
    return svg+'</g>'+circle(cx,cy,3.5,'#334155');
  }
  function syncMotion(c){
    if(!c.state)return;
    if(motion.page!==c.page){
      motion.page=c.page;motion.travel=(c.state.items[c.page].pose??0)/10000;motion.pending=null;
      motion.playing=c.startedNew&&!reduced.matches;
    }
    if(c.mode!=='edit'||c.state.view!=='scene'){motion.pending=null;motion.playing=false;}
  }
  function finishAnalysis(){
    const pose=Math.min(9999,Math.round(Scene.phase(motion.travel)*10000));
    motion.playing=false;motion.pending=null;controller.command({type:'analyse',pose});
  }
  function animate(now){
    const elapsed=motion.last?Math.min(.1,(now-motion.last)/1000):0;motion.last=now;
    if(controller.mode==='edit'&&controller.state?.view==='scene'&&motion.playing){
      motion.travel+=elapsed/Scene.duration(controller.state.def,controller.page);
      if(motion.pending!==null&&motion.travel>=motion.pending){motion.travel=motion.pending;finishAnalysis();}
      else if(now-motion.paint>=40){motion.paint=now;try{drawStage();}catch(_){controller.technical('圖像暫時無法呈現，本次作答已停止修改。請聯絡教師檢查。');}}
    }
    requestAnimationFrame(animate);
  }
  function drawStage(){
    if(!controller.state||!['edit','check','review','committed','frozen'].includes(controller.mode)){if(controller.mode!=='technical')d.diagramSvg.innerHTML='';d.forceHandle.hidden=true;d.originHandle.hidden=true;d.preview.hidden=true;return;}
    const s=controller.state,page=controller.page,item=s.items[page];layout=geometry();
    const scene=controller.mode==='edit'&&s.view==='scene';
    d.diagramSvg.setAttribute('viewBox',`0 0 ${layout.w} ${layout.h}`);
    d.diagramSvg.innerHTML=scene?Scene.scene(page,s.def,layout,Scene.phase(motion.travel)):analysisDrawing(s,page,layout,false,drag);
    if(scene)d.motionPosition.value=String(Math.min(9999,Math.floor(Scene.phase(motion.travel)*10000)));
    d.originHandle.hidden=scene||controller.mode!=='edit'||item.palette===null||item.arrows.length>=6;
    d.originHandle.style.left=layout.cx+'px';d.originHandle.style.top=layout.cy+'px';
    d.originHandle.style.setProperty('--force-color',N.forces[item.palette]?.color);
    d.originHandle.setAttribute('aria-label','從物件中心拖出所選的力');
    const selected=item.selected===null?null:item.arrows[item.selected];
    d.forceHandle.hidden=scene||controller.mode!=='edit'||!selected||Boolean(drag?.creating);
    if(selected&&!d.forceHandle.hidden){
      const a=drag?drag.angle:selected[1],len=drag?drag.length:selected[2],at=a===null?[layout.cx+20*layout.scale,layout.cy-20*layout.scale]:point(layout.cx,layout.cy,a,len*layout.scale);
      d.forceHandle.style.setProperty('--force-color',N.forces[selected[0]].color);
      d.forceHandle.style.left=at[0]+'px';d.forceHandle.style.top=at[1]+'px';d.forceHandle.dataset.index=String(item.selected);
      d.forceHandle.setAttribute('aria-label',`${kindText(selected[0])}，${a===null?'方向未定':(a/10).toFixed(1)+'度'}；拖動箭尖可修改`);
    }
    if(drag&&drag.touch){
      d.preview.hidden=false;const stage=d.stage.getBoundingClientRect();d.preview.style.left=(drag.clientX>stage.left+stage.width/2?4:Math.max(4,stage.width-144))+'px';
      const focus=drag.angle===null?[layout.cx,layout.cy]:point(layout.cx,layout.cy,drag.angle,drag.length*layout.scale);
      d.previewSvg.setAttribute('viewBox',`${focus[0]-35} ${focus[1]-30} 70 60`);
      d.previewSvg.innerHTML=analysisDrawing(s,page,layout,false,drag);
      d.previewOverview.setAttribute('viewBox',`0 0 ${layout.w} ${layout.h}`);d.previewOverview.innerHTML=d.previewSvg.innerHTML;
    }else d.preview.hidden=true;
  }
  function render(c){
    syncMotion(c);
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
      const q=M.CASES[page];d.caseTitle.textContent=`${page+1}. ${q.title}`;d.caseNote.innerHTML=N.prose(q.note);
      const scene=c.state.view==='scene';
      d.answerArea.hidden=editable&&scene;d.motionControls.hidden=!editable||!scene;
      d.analyseButton.disabled=!editable||!scene||motion.pending!==null;d.sceneButton.disabled=!editable||motion.pending!==null;
      d.analyseButton.textContent=page===3?'分析車在拱橋頂部時':page===4?'分析車在凹路最低點時':M.hasAnswers(item)?'返回本題受力圖':'畫受力圖';
      d.sceneButton.textContent=scene?(motion.playing?'暫停運動':'播放運動'):'再看運動';
      d.motionPosition.disabled=motion.pending!==null;
      d.motionMessage.textContent=motion.pending!==null?(page===3?'等待汽車到達橋頂；若已駛過，會在下一圈到頂時停下。':'等待汽車到達最低點；若已駛過，會在下一圈到達時停下。'):page===3||page===4?'先觀察汽車運動，再按分析按鈕；汽車會到指定位置才停下。':'可暫停或拖動位置，再開始畫力。';
      d.directionHint.textContent=page<3?'依受力圖的徑向豎直剖面判斷。':'';
      d.directionChoices.innerHTML=M.DIRECTIONS.map((key,i)=>`<button type="button" data-inward="${key}" style="grid-column:${directionCells[i][0]};grid-row:${directionCells[i][1]}" aria-label="${M.DIRECTION_LABELS[i]}" aria-pressed="${item.inward===key}" ${editable?'':'disabled'}>${N.directionIcon(i*450)}</button>`).join('')+'<span class="direction-origin" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="10" fill="#dbeafe" stroke="#476b96" stroke-width="2"/><circle cx="24" cy="24" r="3" fill="#334155"/></svg></span>';
      d.forcePalette.innerHTML=N.forces.map((f,i)=>`<button type="button" class="force-card" data-palette="${i}" style="--force-color:${f.color}" aria-label="選擇${esc(kindText(i))}" aria-pressed="${item.palette===i}" ${editable?'':'disabled'}><span class="force-symbol">${N.forceHtml(i)}</span><span><b>${esc(f.name)}</b><small>${esc(f.source)}</small></span></button>`).join('');
      d.drawInstruction.innerHTML=item.palette===null?'按選一種力，再在畫布上拖畫。':`${N.forceHtml(item.palette)} 已選取：從物件中心拖出箭頭。`;
      d.forceList.innerHTML=item.arrows.map(([kind,angle],i)=>`<button type="button" class="force-chip" data-select="${i}" style="--force-color:${N.forces[kind].color}" ${editable?'':'disabled'} aria-label="選取第${i+1}支${esc(kindText(kind))}" aria-pressed="${item.selected===i}"><span class="force-symbol">${N.forceHtml(kind)}</span>${angle===null?'<span class="pending-direction">方向未定</span>':N.directionIcon(angle)}</button>`).join('')||'<p class="hint">尚未畫力。</p>';
      d.directionTools.hidden=item.selected===null;
      const selected=item.selected===null?null:item.arrows[item.selected];
      d.selectedForceLabel.innerHTML=selected?N.forceHtml(selected[0])+' '+esc(N.forces[selected[0]].name):'';
      d.kindSelect.disabled=!editable;d.kindSelect.value=selected?String(selected[0]):'';
      d.deleteForce.disabled=!editable||item.selected===null;d.clearDrawing.disabled=!editable||!item.arrows.length;d.clearPage.disabled=!editable;
      d.relationChoices.innerHTML=M.options(c.state,page).map(([key,label])=>`<label class="choice"><input type="radio" name="relation" value="${key}" ${item.relation===key?'checked':''} ${editable?'':'disabled'}><span>${N.prose(label)}</span></label>`).join('');
      d.conceptChoices.innerHTML=M.CONCEPT.map(([key,label])=>`<label class="choice"><input type="radio" name="concept" value="${key}" ${c.state.concept===key?'checked':''} ${editable?'':'disabled'}><span>${esc(label)}</span></label>`).join('');
      d.conceptField.hidden=page!==5;
      d.checkSummary.innerHTML=M.CASES.map((q,i)=>{const a=c.state.items[i],answered=[a.inward!==null,a.arrows.some(x=>x[1]!==null),a.relation!==null].filter(Boolean).length,geo={w:320,h:230,cx:160,cy:115,scale:1,mini:true};return `<div class="summary-row"><button type="button" data-return="${i}">${i+1} ${esc(q.title)}</button>${answered}/3 項已答；${a.arrows.filter(x=>x[1]===null).length} 支力方向未定<svg viewBox="0 0 320 230" role="img" aria-label="${esc(q.title)}的目前受力圖">${analysisDrawing(c.state,i,geo)}</svg></div>`;}).join('')+`<p>共同概念：${c.state.concept===null?'未答':'已答'}</p>`;
      d.returnEdit.disabled=false;d.submitButton.disabled=c.unsaved;
      if(c.trusted){
        d.feedbackList.innerHTML=M.CASES.map((q,i)=>{const result=c.result.detail[i],refGeo={w:320,h:230,cx:160,cy:115,scale:1,mini:true},forces=M.physics(c.state.def,i,c.state.items[i].pose).forces;return `<article class="feedback-card"><h3>${i+1}. ${esc(q.title)} — ${result.earned.toFixed(2)} / 16</h3><p>圓心 ${result.inward}/3；力種類與來源 ${result.force.toFixed(2)}/6；方向 ${result.direction.toFixed(2)}/4；關係 ${result.relation}/3</p><svg viewBox="0 0 320 230" role="img" aria-label="${esc(q.title)}的參考受力圖">${analysisDrawing(c.state,i,refGeo,true)}</svg><p>參考實際力：${forces.map(f=>N.forceHtml(f[0])+' '+esc(N.forces[f[0]].name)).join('、')}。</p><p>${N.prose(feedback[i])}</p></article>`;}).join('')+`<p>共同概念 ${c.result.concept}/4。向心力是徑向合效果，不是參考圖上另一支外力箭頭。等速圓周運動的全合力向內；一般變速圓周運動只有徑向分量提供向心加速度。</p>`;
      }
      if(c.mode!=='technical'&&c.mode!=='mismatch')try{drawStage();}catch(_){c.technical('圖像暫時無法呈現，本次作答已停止修改。請聯絡教師檢查。');return;}
    }else{d.diagramSvg.innerHTML='';d.forceHandle.hidden=true;d.originHandle.hidden=true;d.preview.hidden=true;}
    d.resultTitle.textContent=c.mode==='frozen'?'提交結果未確認':c.mode==='mismatch'?'記錄需要核對':c.mode==='committed'?'成績已記錄':'提交結果';
    d.scoreText.textContent=c.mode==='frozen'?'-- / 100（尚未確認）':c.mode==='mismatch'?`${c.result?.score??'--'} / 100；${SimActivityFlow.completionLabel(c.result?.passed??null)}`:c.result?`${c.result.score.toFixed(2)} / 100；${SimActivityFlow.completionLabel(c.result.passed)}`:'';
  }
  function cancelDrag(){if(!drag)return;diagnostics.cancel++;drag=null;d.preview.hidden=true;drawStage();}
  function locate(e){
    const r=d.diagram.getBoundingClientRect(),x=e.clientX-r.left-layout.cx,y=layout.cy-(e.clientY-r.top),radius=Math.hypot(x,y),raw=M.angle(Math.atan2(y,x)*180/Math.PI),touch=e.pointerType==='touch';
    const inward=M.directionAngle(M.inward(controller.state.def,controller.page,controller.state.items[controller.page].pose));
    const candidate=[0,900,1800,2700,inward,M.angle(inward/10+180),...M.physics(controller.state.def,controller.page,controller.state.items[controller.page].pose).forces.flatMap(f=>[f[1],M.angle(f[1]/10+180)])];
    let a=raw,best=Infinity;for(const snap of candidate){const diff=M.difference(raw,snap);if(diff<best&&diff<=(touch?80:50)&&Math.sin(diff*Math.PI/1800)*radius<=(touch?14:10)){best=diff;a=snap;}}
    return {angle:a,length:Math.max(40,Math.min(100,Math.round(radius/layout.scale))),moved:radius>=12};
  }
  for(const handle of [d.originHandle,d.forceHandle]){
    handle.addEventListener('pointerdown',e=>{
      if(controller.mode!=='edit'||controller.state.view!=='analysis'||drag)return;
      const item=controller.state.items[controller.page],creating=handle===d.originHandle,index=creating?item.arrows.length:item.selected;
      if(creating?(item.palette===null||item.arrows.length>=6):index===null)return;
      e.preventDefault();handle.setPointerCapture(e.pointerId);
      drag={creating,index,angle:creating?null:item.arrows[index][1],length:creating?60:item.arrows[index][2],moved:false,pointerId:e.pointerId,touch:e.pointerType==='touch',clientX:e.clientX};
      diagnostics.down++;if(e.isTrusted&&e.pointerType==='touch')diagnostics.trustedTouch++;
      drawStage();
    });
    handle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;Object.assign(drag,locate(e));drag.clientX=e.clientX;diagnostics.move++;drawStage();});
    handle.addEventListener('pointerup',e=>{
      if(!drag||e.pointerId!==drag.pointerId)return;
      const end=locate(e),commit=!drag.creating||(drag.moved&&end.moved),command={type:drag.creating?'draw':'arrow',angle:end.angle,length:end.length};drag=null;diagnostics.up++;d.preview.hidden=true;
      if(commit)controller.command(command);else drawStage();
    });
    handle.addEventListener('pointercancel',cancelDrag);
    handle.addEventListener('lostpointercapture',()=>{if(drag)cancelDrag();});
  }
  d.originHandle.addEventListener('keydown',e=>{
    const angle={ArrowRight:0,ArrowUp:900,ArrowLeft:1800,ArrowDown:2700}[e.key];
    if(angle===undefined||controller.mode!=='edit'||controller.state.view!=='analysis'||drag)return;
    const item=controller.state.items[controller.page];
    if((item.palette===null||item.arrows.length>=6))return;
    e.preventDefault();controller.command({type:'draw',angle,length:60});d.forceHandle.focus();
  });
  d.forceHandle.addEventListener('keydown',e=>{
    if(controller.mode!=='edit'||drag)return;const item=controller.state.items[controller.page];
    const a=item.arrows[item.selected];if(!a)return;
    const step=e.shiftKey?50:10;let next=a[1],len=a[2];
    if(e.key==='ArrowLeft')next=((next??0)+step)%3600;else if(e.key==='ArrowRight')next=((next??0)-step+3600)%3600;else if(e.key==='ArrowUp')len=Math.min(100,len+5);else if(e.key==='ArrowDown')len=Math.max(40,len-5);else return;
    e.preventDefault();if(next!==null)controller.command({type:'arrow',angle:next,length:len});
  });
  document.addEventListener('pointerdown',e=>{if(drag&&e.pointerId!==drag.pointerId)cancelDrag();},true);
  window.addEventListener('blur',cancelDrag);
  d.caseNav.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){cancelDrag();controller.navigate(Number(b.dataset.page));}});
  d.compactNav.addEventListener('change',()=>{cancelDrag();controller.navigate(Number(d.compactNav.value));});
  d.checkButton.addEventListener('click',()=>{cancelDrag();motion.playing=false;motion.pending=null;controller.check();});
  d.analyseButton.addEventListener('click',()=>{
    const page=controller.page;
    if(page===3||page===4){
      motion.pending=Scene.nextTarget(motion.travel);
      if(reduced.matches||motion.pending===motion.travel){motion.travel=motion.pending;finishAnalysis();}
      else{motion.playing=true;render(controller);}
    }else finishAnalysis();
  });
  d.sceneButton.addEventListener('click',()=>{
    if(controller.state?.view==='scene'){motion.playing=!motion.playing;render(controller);}
    else{motion.travel=(controller.state.items[controller.page].pose??0)/10000;motion.playing=!reduced.matches;controller.command({type:'scene'});}
  });
  d.motionPosition.addEventListener('input',()=>{if(controller.mode!=='edit'||motion.pending!==null)return;motion.travel=Number(d.motionPosition.value)/10000;motion.playing=false;render(controller);});
  reduced.addEventListener('change',()=>{if(reduced.matches){if(motion.pending!==null){motion.travel=motion.pending;finishAnalysis();}else{motion.playing=false;render(controller);}}});
  d.directionChoices.addEventListener('click',e=>{const b=e.target.closest('[data-inward]');if(b){cancelDrag();controller.command({type:'inward',value:b.dataset.inward});}});
  d.forcePalette.addEventListener('click',e=>{const b=e.target.closest('[data-palette]');if(b){cancelDrag();controller.command({type:'palette',value:Number(b.dataset.palette)});}});
  d.forceList.addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b){cancelDrag();controller.command({type:'select',index:Number(b.dataset.select)});}});
  d.kindSelect.addEventListener('change',()=>controller.command({type:'kind',value:Number(d.kindSelect.value)}));
  d.deleteForce.addEventListener('click',()=>controller.command({type:'delete'}));d.clearDrawing.addEventListener('click',()=>controller.command({type:'clear-drawing'}));d.clearPage.addEventListener('click',()=>{controller.command({type:'clear-page'});controller.command({type:'scene'});});
  d.relationChoices.addEventListener('change',e=>{if(e.target.name==='relation')controller.command({type:'relation',value:e.target.value});});
  d.conceptChoices.addEventListener('change',e=>{if(e.target.name==='concept')controller.command({type:'concept',value:e.target.value});});
  d.returnEdit.addEventListener('click',()=>controller.returnToEdit());
  d.checkSummary.addEventListener('click',e=>{const b=e.target.closest('[data-return]');if(b)controller.navigate(Number(b.dataset.return));});
  d.submitButton.addEventListener('click',()=>controller.submit());d.retryFinal.addEventListener('click',()=>controller.retryFinal());d.saveRetry.addEventListener('click',()=>controller.retrySave());
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(drawStage);});
  window.__centripetalSourceApp={controller,diagnostics,getState:()=>M.clone(controller.state),getLayout:()=>layout,getMotion:()=>({...motion})};
  controller.start();
  requestAnimationFrame(animate);
})();
