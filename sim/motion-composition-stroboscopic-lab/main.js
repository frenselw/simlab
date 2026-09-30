(function () {
  "use strict";
  const M=MotionCompositionModel, P=MotionCompositionPersistence, Scene=MotionCompositionScene;
  const d=Object.fromEntries([...document.querySelectorAll('[id]')].map(e=>[e.id,e]));
  let layout, drag=null, keyboard=null, reference=false, compareAxis=0, animation=null, animationStart=null, playing=false;
  let blockedTouchSequence=false;
  const diagnostics={downs:0,moves:0,ups:0,cancels:0,trustedTouch:0,previews:0};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const c=new MotionCompositionRuntime.Controller(SimScorm,SimActivityFlow,render);
  const editable=()=>c.mode==='edit', current=()=>c.state?.cases[c.caseIndex], saved=()=>current()?.points[c.timeIndex-1]??null;
  const working=()=>drag?.working||keyboard?.point||null;
  const announce=text=>{d.liveRegion.textContent=text;};
  const timeHTML=i=>`<var>t</var><sub>${i}</sub>`;
  function playbackLabel(){d.playButton.textContent=playing?'停止播放':reference&&c.trusted?'播放參考合運動':'播放分運動';}
  function stop(){playing=false;animation=null;animationStart=null;playbackLabel();}
  function hidePreview(){d.magnifier.hidden=true;d.magnifierSvg.replaceChildren();d.previewValues.textContent='';}
  function cancel(interrupted=false){
    const old=drag;drag=null;keyboard=null;hidePreview();
    if(old){if(interrupted)diagnostics.cancels++;try{if(old.element.hasPointerCapture(old.id))old.element.releasePointerCapture(old.id);}catch(_){/* Detached document. */}}
  }
  function command(action){cancel();stop();c.command(action);}
  function navigate(index,time=1){cancel();stop();c.navigate(index,time);}
  function enterCheck(){cancel();stop();c.check();d.controlPanel.scrollTop=0;}
  function render(){
    const scroll=d.controlPanel.scrollTop, focus=document.activeElement, focusKey=focus?.dataset.case!=null?`[data-case="${focus.dataset.case}"]`:focus?.dataset.time!=null?`[data-time="${focus.dataset.time}"]`:null;
    d.attemptStatus.textContent=c.mode==='review'?(SimScorm.isStandalone()?'練習結果':'已提交'):c.mode==='check'?'檢查中':c.mode==='frozen'?'待確認':c.mode==='committed'?'已記錄':['technical','mismatch'].includes(c.mode)?'技術狀態':'作答中';
    d.notice.hidden=!c.notice;d.notice.textContent=c.notice;d.saveRetryButton.hidden=!c.unsaved||!c.editable;
    d.checkButton.hidden=!c.editable;d.editPanel.hidden=!editable();d.checkPanel.hidden=c.mode!=='check';
    d.reviewPanel.hidden=!['review','committed','frozen','mismatch'].includes(c.mode);d.technicalPanel.hidden=c.mode!=='technical';
    d.questionIntro.hidden=!c.state||c.mode==='check'||['technical','mismatch'].includes(c.mode);
    d.questionNav.replaceChildren();
    if(c.state){
      for(let i=0;i<4;i++){const p=M.progress(c.state.cases[i]),b=document.createElement('button');b.type='button';b.dataset.case=String(i);b.dataset.progress=p.complete?'complete':p.started?'partial':'empty';b.innerHTML=`${i+1}<small>${p.count}/7</small>`;b.setAttribute('aria-label',`情境${i+1}，已答${p.count}/7項`);if(i===c.caseIndex)b.setAttribute('aria-current','step');b.disabled=['technical','mismatch'].includes(c.mode);b.onclick=()=>{navigate(i);d.controlPanel.scrollTop=0;};d.questionNav.append(b);}
      d.questionKicker.textContent=`情境 ${c.caseIndex+1} · 等時頻閃`;
      d.observeButton.hidden=!editable();d.observeButton.textContent=current().observed?'頻閃圖已顯示':'顯示頻閃圖';d.observeButton.disabled=current().observed;
      playbackLabel();d.playButton.disabled=['frozen','committed'].includes(c.mode);
      d.timeNav.replaceChildren();for(let i=1;i<=4;i++){const b=document.createElement('button');b.type='button';b.dataset.time=String(i);b.innerHTML=timeHTML(i);b.setAttribute('aria-label',`時刻${i}，${(i*M.DT).toFixed(2)}秒，${current().points[i-1]?'已放置':'未放置'}`);if(i===c.timeIndex)b.setAttribute('aria-current','step');b.onclick=()=>navigate(c.caseIndex,i);d.timeNav.append(b);}
      d.horizontalMotion.value=current().motions[0]??'';d.verticalMotion.value=current().motions[1]??'';d.trajectorySelect.value=current().trajectory??'';
      d.placeHint.textContent=current().observed?'每小格0.20 m；按同一時刻的兩個球影拖放。':'先顯示頻閃圖，再放置位置。';
      d.startPlaceButton.disabled=!current().observed;d.startPlaceButton.textContent=saved()?'開始調整':'開始放置';
      for(const b of d.adjustDetails.querySelectorAll('[data-adjust]'))b.disabled=!keyboard;
      d.commitPlaceButton.disabled=!keyboard;d.cancelPlaceButton.disabled=!keyboard;d.removePointButton.disabled=!saved();
      const p=M.progress(current());d.stepProgress.textContent=`位置 ${p.points}/4 · 分運動 ${p.types}/2 · 軌跡${p.trajectory?'已選':'未選'}`;
      d.clearCaseButton.disabled=p.count===0;d.returnCheckButton.hidden=!c.state.returnToCheck;
      d.nextButton.textContent=c.timeIndex<4?'下一個時刻':c.caseIndex<3?'下一個情境':'檢查作答';
      renderComparison();
    }
    if(c.mode==='check'){
      d.checkList.replaceChildren();for(let i=0;i<4;i++){const p=M.progress(c.state.cases[i]),row=document.createElement('div');row.className='check-row';const b=document.createElement('button');b.innerHTML=`情境 ${i+1}<small>位置 ${p.points}/4 · 分運動 ${p.types}/2 · 軌跡${p.trajectory?'已選':'未選'}</small>`;b.onclick=()=>{navigate(i);d.controlPanel.scrollTop=0;};row.append(b);d.checkList.append(row);}d.submitButton.disabled=c.unsaved;
    }
    if(!d.reviewPanel.hidden){
      d.reviewTitle.textContent=c.mode==='frozen'?'提交尚未確認':c.mode==='committed'?'成績已記錄':c.mode==='mismatch'?'記錄未能核對':'只讀檢討';
      d.scorePanel.innerHTML=c.result?`<strong>${c.result.score===null?'--':c.result.score} / 100</strong><p>${SimActivityFlow.completionLabel(c.result.passed)}</p>`:'<p>答案已凍結，成績尚未確認。</p>';
      d.retryFinalButton.hidden=!['frozen','committed'].includes(c.mode);d.retryFinalButton.textContent=c.mode==='committed'?'重試完成程序':'重試同一份提交';d.referenceButton.hidden=!c.trusted;d.referenceButton.textContent=reference?'返回你的作圖':'顯示參考作圖';
      d.feedback.innerHTML='';if(c.trusted&&current())renderFeedback();
    }
    renderStage();if(focusKey)document.querySelector(focusKey)?.focus({preventScroll:true});d.controlPanel.scrollTop=scroll;
  }
  function renderComparison(){
    d.spacingHint.textContent=current().observed?'各段均0.20 s，橫條使用相同比例。':'先顯示頻閃圖，才能比較間距。';d.showIncreases.disabled=!current().observed;
    for(const b of d.spacingDetails.querySelectorAll('[data-compare-axis]'))b.setAttribute('aria-pressed',String(Number(b.dataset.compareAxis)===compareAxis));
    d.spacingBars.replaceChildren();if(!current().observed)return;
    const gaps=M.gaps(c.caseIndex,compareAxis);gaps.forEach((gap,i)=>{const row=document.createElement('div');row.className='spacing-row';row.innerHTML=`<span>${i}→${i+1}</span><div class="bar-rail"><div class="gap-bar" style="width:${100*gap/1400}%;background:${compareAxis?'#b45309':'#2563eb'}"></div></div><span class="gap-value">${(gap/1000).toFixed(2)} m</span>${d.showIncreases.checked&&i>0?`<span class="increase-value">比上一段多 ${((gap-gaps[i-1])/1000).toFixed(2)} m</span>`:''}`;d.spacingBars.append(row);});
  }
  function renderFeedback(){
    const detail=c.result.detail[c.caseIndex],expected=M.expected(c.caseIndex),definition=M.CASES[c.caseIndex];
    const status=(correct,label)=>`<span class="${correct?'ok':'issue'}">${correct?'✓':'○'} ${label}</span>`;
    const explanation=definition.explanation.replace(/\b([gxy])\b/g,'<var>$1</var>').replace('m/s²','m/s<sup>2</sup>');
    d.feedback.innerHTML=`<article><h3>情境 ${c.caseIndex+1}：${detail.score}/25 分</h3><p>${explanation}</p><p>${detail.motions.map((ok,i)=>`${status(ok,i?'垂直':'水平')}：${M.MOTIONS[definition.motions[i]]}`).join('<br>')}</p><p>${status(detail.trajectory,'合運動軌跡')}：${M.TRAJECTORIES[definition.trajectory]}</p></article><article><h3>各時刻的位置</h3><table class="feedback-table"><thead><tr><th>時刻</th><th>你的 (<var>x</var>, <var>y</var>) / m</th><th>分量</th></tr></thead><tbody>${current().points.map((p,i)=>`<tr><td>${timeHTML(i+1)}</td><td>${p?`${M.format(p[0])}, ${M.format(p[1])}`:'未放置'}</td><td>${status(detail.points[i].x,'<var>x</var>')} ${status(detail.points[i].y,'<var>y</var>')}</td></tr>`).join('')}</tbody></table><p class="small">參考位置：${expected.map((p,i)=>`${timeHTML(i+1)} (${M.format(p[0])}, ${M.format(p[1])})`).join('；')} m。每個分量容差為±0.050 m。</p></article><p class="small">同一時刻的水平位置與垂直位置配成一個點。球影越來越疏只表示各段平均速率增加；間距等量增加才與勻加速模型相符。</p>`;
  }
  function renderStage(){
    const rect=d.stage.getBoundingClientRect();layout=M.layout(rect.width,rect.height);
    d.stageSvg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    if(!c.state||['technical','mismatch'].includes(c.mode)){d.stageSvg.replaceChildren();d.trayHandle.hidden=d.activeHandle.hidden=true;d.stageHint.textContent='作答資料需要檢查';d.stageTime.textContent='';return;}
    const tray=editable()&&current().observed&&!saved(),value=working()||saved(),showRef=reference&&c.trusted;
    d.stageSvg.innerHTML=Scene.svg(c.state,c.caseIndex,c.timeIndex,layout,{working:working(),reference:showRef,tray,animation});
    d.stageTime.innerHTML=animation!==null?`<var>t</var> = ${animation.toFixed(2)} s`:`${timeHTML(c.timeIndex)} = ${(c.timeIndex*M.DT).toFixed(2)} s`;
    const componentIndex=(current().observed||showRef)&&animation===null?`<sub>${c.timeIndex}</sub>`:'';
    d.componentLegend.innerHTML=`<span class="x-key">X${componentIndex} 水平</span> · <span class="y-key">Y${componentIndex} 垂直</span>`;
    d.stageHint.textContent=c.mode==='frozen'?'作答已凍結':showRef?'參考軌跡':!editable()?'你的作圖':!current().observed?'在操作面板顯示頻閃圖':tray?'拖球放置':'你的連線';d.stageHint.classList.toggle('with-tray',tray);
    const place=(element,p,visible)=>{element.hidden=!visible;if(visible){element.style.left=`${p.x}px`;element.style.top=`${p.y}px`;}};
    place(d.trayHandle,layout.tray,tray);place(d.activeHandle,M.pixel(value||[0,0],layout),editable()&&current().observed&&saved()!==null);
    d.trayHandle.setAttribute('aria-label',`放置t${c.timeIndex}的合運動球`);d.activeHandle.setAttribute('aria-label',`修改t${c.timeIndex}，${value?`x=${M.format(value[0])}米，y=${M.format(value[1])}米`:''}`);
    d.positionReadout.innerHTML=value?`<var>x</var> = ${M.format(value[0])} m · <var>y</var> = ${M.format(value[1])} m${keyboard?'（待放置）':''}`:'尚未放置';
    const known=current().observed?M.expected(c.caseIndex).map((p,i)=>`時刻${i+1}，水平位置${M.format(p[0])}米，垂直位置${M.format(p[1])}米。`).join(''):'共同原點O，水平向右，垂直向下。';
    d.sceneDescription.textContent=`${known}兩個球影是分運動示意。橫豎刻度相同，向上為正y。`;
    if(drag?.active)preview();else hidePreview();
  }
  function local(event){const r=d.stage.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
  function down(event,element,creating){
    if(!editable()||!current().observed||drag||event.isPrimary===false||event.button>0||(event.pointerType==='touch'&&blockedTouchSequence))return;cancel();stop();const p=local(event);
    drag={id:event.pointerId,type:event.pointerType,element,creating,down:p,cursor:p,base:creating?null:M.pixel(saved(),layout),working:null,active:false,snap:null,resolved:false,corner:null};
    diagnostics.downs++;if(event.isTrusted&&event.pointerType==='touch')diagnostics.trustedTouch++;element.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function resolveDrag(event){
    const p=local(event);drag.cursor=p;const dx=p.x-drag.down.x,dy=p.y-drag.down.y;
    if(!drag.active&&Math.hypot(dx,dy)<4)return;drag.active=true;
    const location=drag.creating?p:{x:drag.base.x+dx,y:drag.base.y+dy},resolved=M.resolve(location,layout,drag.type,drag.snap);
    drag.resolved=Boolean(resolved);drag.working=resolved?.point||null;drag.snap=resolved?.snap||null;
  }
  function move(event){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();diagnostics.moves++;resolveDrag(event);renderStage();}
  function up(event){
    if(!drag||event.pointerId!==drag.id)return;resolveDrag(event);diagnostics.ups++;const value=drag.active&&drag.resolved?drag.working:null;cancel();
    if(value){c.command({type:'place',point:value});announce(`已放置t${c.timeIndex}。`);}else renderStage();
  }
  function preview(){
    if(!drag||drag.type!=='touch'||!drag.working){hidePreview();return;}
    const fragment=Scene.svg(c.state,c.caseIndex,c.timeIndex,layout,{working:drag.working,prefix:'preview'});
    d.magnifierSvg.innerHTML=fragment;for(const node of d.magnifierSvg.querySelectorAll('text'))node.remove();
    d.previewValues.innerHTML=`${timeHTML(c.timeIndex)} · 3×<br><var>x</var> ${M.format(drag.working[0])} m<br><var>y</var> ${M.format(drag.working[1])} m`;d.magnifier.hidden=false;
    const box=d.magnifier.getBoundingClientRect(),app=d.app.getBoundingClientRect(),stage=d.stage.getBoundingClientRect(),width=box.width,height=box.height,offset={x:stage.left-app.left,y:stage.top-app.top},cursor={x:drag.cursor.x+offset.x,y:drag.cursor.y+offset.y};
    const inside=p=>p.x>=0&&p.y>=0&&p.x+width<=app.width&&p.y+height<=app.height,clear=p=>!(cursor.x>p.x-16&&cursor.x<p.x+width+16&&cursor.y>p.y-16&&cursor.y<p.y+height+16);
    const corners=[{x:28,y:2},{x:layout.width-28-width,y:2},{x:2,y:2},{x:layout.width-2-width,y:2},{x:2,y:layout.height-height-2},{x:layout.width-2-width,y:layout.height-height-2}].filter(p=>p.x>=0&&p.y>=0&&p.x+width<=layout.width&&p.y+height<=layout.height).map(p=>({x:p.x+offset.x,y:p.y+offset.y}));
    // A short split stage has no room for both the finger and the lens.
    // Its shell sibling can use the other column without intercepting input.
    const shellY=Math.max(2,Math.min(offset.y+2,app.height-height-2));
    const options=corners.concat([{x:app.width-width-2,y:shellY},{x:2,y:shellY},{x:app.width-width-2,y:2},{x:2,y:2}]).filter(inside);
    if(!drag.corner||!inside(drag.corner)||!clear(drag.corner))drag.corner=options.find(clear)||options[0]||{x:2,y:2};
    Object.assign(d.magnifier.style,{left:`${drag.corner.x}px`,top:`${drag.corner.y}px`});
    const focus=M.pixel(drag.working,layout),lens=d.magnifierSvg.getBoundingClientRect();
    d.magnifierSvg.setAttribute('viewBox',`${focus.x-lens.width/6} ${focus.y-lens.height/6} ${lens.width/3} ${lens.height/3}`);diagnostics.previews++;
  }
  function begin(element=null){if(!editable()||!current().observed)return;cancel();stop();keyboard={point:M.clone(saved()||[0,0]),element};render();}
  function adjust(direction,fine=false){if(!keyboard)return;const step=fine?10:200,p=keyboard.point;p[0]=Math.max(-400,Math.min(3600,p[0]+(direction==='right'?step:direction==='left'?-step:0)));p[1]=Math.max(-3600,Math.min(400,p[1]+(direction==='up'?step:direction==='down'?-step:0)));renderStage();}
  function commit(){if(!keyboard)return;const p=[...keyboard.point],restoreFocus=keyboard.element;cancel();c.command({type:'place',point:p});if(restoreFocus)d.activeHandle.focus({preventScroll:true});announce('已放置此位置。');}
  for(const [element,creating] of [[d.trayHandle,true],[d.activeHandle,false]]){
    element.addEventListener('pointerdown',e=>down(e,element,creating));element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);
    for(const type of ['pointercancel','lostpointercapture'])element.addEventListener(type,e=>{if(drag?.id===e.pointerId){cancel(true);renderStage();}});
    element.addEventListener('keydown',e=>{if(!editable())return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){cancel();render();}else if(e.key==='Enter'&&keyboard)commit();else{if(!keyboard)begin(element);if(e.key.startsWith('Arrow'))adjust(e.key.slice(5).toLowerCase(),e.shiftKey);}}});
    element.addEventListener('focusout',()=>{if(keyboard?.element===element){cancel();renderStage();}});
  }
  for(const id of ['horizontalMotion','verticalMotion'])d[id].innerHTML+=Object.entries(M.MOTIONS).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  d.trajectorySelect.innerHTML+=Object.entries(M.TRAJECTORIES).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  d.horizontalMotion.onchange=()=>command({type:'motion',axis:0,value:d.horizontalMotion.value||null});d.verticalMotion.onchange=()=>command({type:'motion',axis:1,value:d.verticalMotion.value||null});d.trajectorySelect.onchange=()=>command({type:'trajectory',value:d.trajectorySelect.value||null});
  d.observeButton.onclick=()=>command({type:'observe'});d.checkButton.onclick=d.returnCheckButton.onclick=enterCheck;
  d.nextButton.onclick=()=>{if(c.timeIndex<4)navigate(c.caseIndex,c.timeIndex+1);else if(c.caseIndex<3)navigate(c.caseIndex+1);else enterCheck();};
  d.removePointButton.onclick=()=>command({type:'remove'});d.clearCaseButton.onclick=()=>{if(editable()&&confirm('清除此題的四個位置、兩個分運動類型及軌跡選擇？頻閃圖與其他題會保留。'))command({type:'clear'});};
  d.backEditButton.onclick=()=>navigate(c.state.activeCase,c.state.activeTime);d.submitButton.onclick=()=>{cancel();stop();c.submit();d.controlPanel.scrollTop=0;};d.saveRetryButton.onclick=()=>c.retrySave();d.retryFinalButton.onclick=()=>{cancel();stop();c.retryFinal();};
  d.referenceButton.onclick=()=>{cancel();stop();reference=!reference;render();};
  d.startPlaceButton.onclick=()=>begin();d.commitPlaceButton.onclick=commit;d.cancelPlaceButton.onclick=()=>{cancel();render();};
  for(const b of d.adjustDetails.querySelectorAll('[data-adjust]'))b.onclick=()=>adjust(b.dataset.adjust,d.fineStep.checked);
  for(const b of d.spacingDetails.querySelectorAll('[data-compare-axis]'))b.onclick=()=>{compareAxis=Number(b.dataset.compareAxis);renderComparison();};d.showIncreases.onchange=renderComparison;
  d.playButton.onclick=()=>{cancel();if(playing)stop();else if(reduced.matches){animation=c.timeIndex*M.DT;playing=false;}else{playing=true;animationStart=null;animation=0;}render();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(drag||keyboard)){cancel(true);render();}});
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.isPrimary===false&&drag){blockedTouchSequence=true;cancel(true);renderStage();}},true);
  const touches=new Map();
  document.addEventListener('touchstart',e=>{for(const t of e.changedTouches){const point=Boolean(t.target.closest?.('.point-handle')),host=d.stage.contains(t.target)&&!point;touches.set(t.identifier,{host,point,y:t.screenY});}if(touches.size>1&&[...touches.values()].some(t=>t.point)){blockedTouchSequence=true;cancel(true);renderStage();}},{passive:true});
  document.addEventListener('touchmove',e=>{if(blockedTouchSequence){if(e.cancelable)e.preventDefault();return;}let handled=false;for(const t of e.changedTouches){const r=touches.get(t.identifier);if(!r?.host)continue;const dy=r.y-t.screenY;r.y=t.screenY;try{if(window.parent!==window&&window.parent.document){window.parent.scrollBy(0,dy/(window.parent.visualViewport?.scale||1));handled=true;}}catch(_){/* Cross-origin deployment is verified separately. */}}if(handled&&e.cancelable)e.preventDefault();},{passive:false});
  for(const type of ['touchend','touchcancel'])document.addEventListener(type,e=>{for(const t of e.changedTouches)touches.delete(t.identifier);if(!touches.size)blockedTouchSequence=false;},{passive:true});
  for(const type of ['blur','resize'])window.addEventListener(type,()=>{cancel(true);stop();renderStage();});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel(true);stop();renderStage();}});reduced.addEventListener('change',()=>{cancel(true);stop();render();});
  new ResizeObserver(()=>{if(drag||keyboard)cancel(true);renderStage();}).observe(d.stage);
  function frame(now){if(playing){if(animationStart===null)animationStart=now;animation=Math.min(.8,(now-animationStart)/4000);if(animation>=.8){playing=false;animationStart=null;}renderStage();if(!playing)playbackLabel();}requestAnimationFrame(frame);}
  window.__motionComposition=Object.freeze({getState:()=>M.clone(c.state),getSelection:()=>({case:c.caseIndex,time:c.timeIndex,reference,compareAxis}),getMode:()=>c.mode,getResult:()=>M.clone(c.result),getGeometry:()=>M.clone(layout),getPointerDiagnostics:()=>({...diagnostics}),getInteraction:()=>({point:M.clone(working()),cursor:M.clone(drag?.cursor),pointerId:drag?.id??null,active:Boolean(drag?.active),blockedTouchSequence}),getSnapshot:()=>c.editable?c.draftSnapshot():M.clone(c.finalSnapshot)});
  c.start();requestAnimationFrame(frame);
})();
