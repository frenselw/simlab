(function(){
  'use strict';
  const M=CircularVectorModel,P=CircularVectorPersistence,S=CircularVectorScoring;
  const d=Object.fromEntries([...document.querySelectorAll('[id]')].map(e=>[e.id,e]));
  const titles=['位移與速度','速度變化與加速度','遷移挑戰'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n.toPrecision(3)).toLocaleString('en-US',{maximumSignificantDigits:3,minimumSignificantDigits:3});
  const C={earlier:'#a74920',later:'#1764b1',student:'#7049a4',answer:'#18734b'};
  let drag=null,layout=null,questionDefinition='',animated=false,animations=[],resizeFrame=0,rendererFailed=false;
  const diagnostics={down:0,move:0,up:0,cancel:0,trustedTouch:0};
  const controller=new CircularVectorRuntime.Controller(SimScorm,SimActivityFlow,render);
  function arrow(from,to,color,width=3){
    const v=M.subtract(to,from),len=M.length(v);if(len<1e-8)return '';
    const u=M.scale(v,1/len),normal=[-u[1],u[0]],head=Math.min(10,len*.45),half=Math.min(width/2,len*.15),wing=Math.min(5,len*.24),base=M.subtract(to,M.scale(u,head));
    const at=(p,n)=>[p[0]+normal[0]*n,p[1]+normal[1]*n].join(',');
    return `<path d="M${at(from,half)} L${at(base,half)} L${at(base,wing)} L${to} L${at(base,-wing)} L${at(base,-half)} L${at(from,-half)} Z" fill="${color}"/>`;
  }
  const referenceArrow=(from,to)=>arrow(from,to,C.answer).replace(`fill="${C.answer}"`,`fill="white" stroke="${C.answer}" stroke-width="1.5"`);
  const text=(x,y,label,extra='')=>`<text x="${x}" y="${y}" ${extra}>${label}</text>`;
  const circle=(p,r,color)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${color}"/>`;
  function extension(from,vector,length,color){const mag=M.length(vector);if(mag<1e-8)return '';const to=[from[0]+vector[0]/mag*length,from[1]+vector[1]/mag*length];return `<path d="M${from} L${to}" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4" fill="none"/>`+circle(to,2,color);}
  function compass(v){return ['向右','向右上','向上','向左上','向左','向左下','向下','向右下'][(Math.round(Math.atan2(v[1],v[0])*4/Math.PI)+8)%8];}
  function directionChoice(s,q,key,index){
    const g=M.scene(s,q.task),p=[37+19*Math.cos(g.thetaA),37-19*Math.sin(g.thetaA)],v=M.direction(s,q.task,key),end=[p[0]+v[0]*21,p[1]-v[1]*21];
    return `<label class="choice direction-choice"><input data-answer-choice type="radio" name="${q.field}" value="${key}" aria-label="選項 ${index+1}，箭頭${compass(v)}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="37" cy="37" r="19" fill="none" stroke="#bfccdc"/>${circle([37,37],1.8,'#53647a')}${arrow(p,end,'#243c5a',2.5)}${circle(p,2.5,'#a74920')}${text(p[0]-8,p[1]+12,'A','font-size="12"')}</svg><span class="choice-text">${index+1}</span></label>`;
  }
  function buildQuestions(s){
    const identity=JSON.stringify(s.definition);if(identity===questionDefinition)return;questionDefinition=identity;
    d.questions.innerHTML=M.QUESTIONS.map(q=>`<fieldset data-question="${q.field}" data-task-group="${q.task}"><legend>${q.title}</legend><div class="${q.type==='direction'?'choice-grid':'reason-options'}">${M.options(s,q).map(([key,label],i)=>q.type==='direction'?directionChoice(s,q,key,i):`<label class="choice"><input data-answer-choice type="radio" name="${q.field}" value="${key}"><span class="choice-text">${esc(label)}</span></label>`).join('')}</div><button class="clear-answer" data-clear-answer="${q.field}" type="button">清除此題</button></fieldset>`).join('');
  }
  function geometry(){
    const pr=d.positionDiagram.getBoundingClientRect(),vr=d.velocityDiagram.getBoundingClientRect();
    const compact=pr.height<140,r=Math.max(10,Math.min((pr.width-108)/2,(pr.height-(compact?28:100))/2,165));
    const center=[pr.width/2,compact?pr.height/2:pr.height/2+7],unit=r/M.RADIUS;
    const vscale=Math.max(18,Math.min((vr.width-68)/M.SPEED/2,(vr.height-92)/M.SPEED/2,330));
    const origin=[vr.width/2,vr.height/2+10];
    return {position:{width:pr.width,height:pr.height,r,center,unit,compact,left:pr.left,top:pr.top},velocity:{width:vr.width,height:vr.height,origin,unit:vscale,left:vr.left,top:vr.top}};
  }
  const screen=(v,origin,unit)=>[origin[0]+unit*v[0],origin[1]-unit*v[1]];
  function positionDrawing(g,s,task,geo,reference=false){
    const {width:w,height:h,r,center:o,unit,compact}=geo,A=screen(g.rA,o,unit),B=screen(g.rB,o,unit),pad=compact?8:21;
    let svg=`<circle cx="${o[0]}" cy="${o[1]}" r="${r}" fill="#f5f8fc" stroke="#c3cfdf" stroke-width="1.5"/>`;
    if(!compact)svg+=text(12,22,task===1?'位置圖':'較早 A → 較後 B')+text(12,h-12,g.sense===1?'逆時針 ↺':'順時針 ↻');
    const path=Array.from({length:33},(_,i)=>{const t=g.thetaA+(g.thetaB-g.thetaA)*i/32;return screen([M.RADIUS*Math.cos(t),M.RADIUS*Math.sin(t)],o,unit);});
    svg+=`<polyline points="${path.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#9aaec7" stroke-width="4"/>`;
    const mid=(g.thetaA+g.thetaB)/2,point=screen([M.RADIUS*Math.cos(mid),M.RADIUS*Math.sin(mid)],o,unit),tangent=[-g.sense*Math.sin(mid),-g.sense*Math.cos(mid)];
    svg+=arrow([point[0]-tangent[0]*5,point[1]-tangent[1]*5],[point[0]+tangent[0]*5,point[1]+tangent[1]*5],'#687f9c',2);
    if(task!==1){svg+=extension(A,[unit*g.dr[0],-unit*g.dr[1]],Math.max(22,r*.8),C.student)+arrow(A,B,C.student);if(!compact)svg+=text(12,43,'實線：位移　虛線：方向延長','fill="#7049a4"');}
    else{
      const vs=layout.velocity.unit;
      svg+=arrow(A,screen(g.vA,A,vs),C.earlier)+arrow(B,screen(g.vB,B,vs),C.later);
      if(!compact)svg+=text(12,43,'初速度 v<tspan baseline-shift="sub" font-size="10">A</tspan>　末速度 v<tspan baseline-shift="sub" font-size="10">B</tspan>（m/s）');
      if(s.answers.deltaFrom!==null&&s.answers.deltaTo!==null){const v=M.subtract(g.nodes[s.answers.deltaTo],g.nodes[s.answers.deltaFrom]);svg+=extension(A,[v[0],-v[1]],Math.max(20,r*.95),C.student);if(!compact)svg+=text(12,h-34,'我的方向（虛線）','fill="#7049a4"');}
    }
    if(reference){const v=M.direction(s,task,'forward-tangent');svg+=referenceArrow(A,[A[0]+v[0]*r*.65,A[1]-v[1]*r*.65]);if(task!==0)svg+=referenceArrow(A,o);svg+=`<path d="M${A} L${o}" stroke="#81998b" stroke-width="1" fill="none"/>`;}
    svg+=circle(o,2,'#596c83')+text(o[0]+5,o[1]+5,'O')+circle(A,4,C.earlier)+circle(B,4,C.later);
    const label=[A[0]+Math.cos(g.thetaA)*pad,A[1]-Math.sin(g.thetaA)*pad+5];svg+=text(Math.max(8,Math.min(w-18,label[0])),Math.max(14,Math.min(h-4,label[1])),'A','fill="#a74920"');
    return {svg,A,B};
  }
  function drawStage(){
    if(!controller.state||controller.mode==='check'||rendererFailed)return;
    try{drawScene();}catch(_){rendererFailed=true;cancelDrag();controller.technical('圖像暫時無法呈現，本次作答已停止修改。請聯絡教師檢查。');}
  }
  function drawScene(){
    const s=controller.state,task=controller.task,gap=drag?drag.value:s.observation[M.GAP_KEYS[task]],g=M.scene(s,task,gap);
    layout=geometry();const pos=positionDrawing(g,s,task,layout.position,controller.trusted);
    d.positionSvg.setAttribute('viewBox',`0 0 ${layout.position.width} ${layout.position.height}`);d.positionSvg.innerHTML=pos.svg;
    d.positionHandle.style.left=pos.B[0]+'px';d.positionHandle.style.top=pos.B[1]+'px';d.positionHandle.hidden=controller.mode==='check'||!controller.state;d.positionHandle.disabled=controller.mode!=='edit';
    d.positionHandle.setAttribute('aria-valuetext',`時間間隔 ${fmt(g.dt)} 秒`);
    if(task===1){
      const v=layout.velocity,at=p=>screen(p,v.origin,v.unit),nodes=Object.fromEntries(Object.entries(g.nodes).map(([key,p])=>[key,at(p)]));
      let svg=text(12,22,'速度向量圖（m/s）')+`<g data-speed="A">${arrow(nodes.S,nodes.U,C.earlier)}</g><g data-speed="B">${arrow(nodes.S,nodes.V,C.later)}</g>`;
      if(s.answers.deltaFrom!==null&&s.answers.deltaTo!==null)svg+=`<g data-student-vector>${arrow(nodes[s.answers.deltaFrom],nodes[s.answers.deltaTo],C.student,3.5)}</g>`;
      if(controller.trusted)svg+=`<g data-reference-vector>${referenceArrow(nodes.U,nodes.V)}</g>`;
      Object.entries(nodes).forEach(([key,p])=>{svg+=circle(p,3,'#344c6a');});
      svg+=text(nodes.S[0]-16,nodes.S[1]+20,'S')+text(nodes.U[0]-16,nodes.U[1]-8,'U','fill="#a74920"')+text(nodes.V[0]+8,nodes.V[1]+19,'V','fill="#1764b1"');
      if(v.height>140)svg+=text(12,v.height-13,'紫線：我的作圖','fill="#7049a4"');
      d.velocitySvg.setAttribute('viewBox',`0 0 ${v.width} ${v.height}`);d.velocitySvg.innerHTML=svg;
    }
    d.timeReadout.textContent=fmt(g.dt)+' s';d.distanceReadout.textContent=fmt(M.length(g.dr))+' m';
    if(drag&&drag.touch){
      const r=d.stage.getBoundingClientRect(),B=[pos.B[0]+layout.position.left-r.left,pos.B[1]+layout.position.top-r.top],left=B[0]>r.width/2?6:r.width-138;
      d.preview.hidden=false;d.preview.style.left=left+'px';d.preview.style.top='4px';
      const pw=44,ph=Math.min(112,r.height)/3;d.previewSvg.setAttribute('viewBox',`${pos.B[0]-pw/2} ${pos.B[1]-ph/2} ${pw} ${ph}`);d.previewSvg.innerHTML=pos.svg;
    }else d.preview.hidden=true;
  }
  function animateAlignment(){
    if(animated||matchMedia('(prefers-reduced-motion: reduce)').matches||!controller.startedNew)return;animated=true;
    const g=M.scene(controller.state,1),p=layout.position,v=layout.velocity;
    for(const [key,point]of[['A',g.rA],['B',g.rB]]){const a=screen(point,p.center,p.unit),delta=[p.left+a[0]-v.left-v.origin[0],p.top+a[1]-v.top-v.origin[1]];const el=d.velocitySvg.querySelector(`[data-speed="${key}"]`);if(el)animations.push(el.animate([{transform:`translate(${delta[0]}px,${delta[1]}px)`},{transform:'translate(0,0)'}],{duration:420,easing:'ease-out'}));}
  }
  function cancelAnimations(){animations.forEach(a=>a.cancel());animations=[];}
  function feedback(item){
    const a=controller.state.answers;
    if(item.id==='D1')return `已選端點：${a.deltaFrom??'未選'} → ${a.deltaTo??'未選'}。U、V 每找對一個得 5 分；共同起點 S 不屬於這兩個速度末端。`;
    if(item.id==='D2')return '參考：U → V。從初速度末端指向末速度末端，才是末速度減初速度；V → U 比較了正確兩端，但相減方向反了。';
    const q=M.QUESTIONS.find(q=>q.id===item.id);
    if(q.type==='reason')return '參考：'+q.options.find(o=>o[0]===q.correct)[1]+(q.id==='A2'?' 時間間隔也在縮短，不能只看 Δv 長度判斷加速度大小。':'');
    return q.correct==='inward'?'瞬時加速度指向圓心。速率不變，速度方向仍在改變。':'瞬時速度沿 A 點切線，並配合實際轉向；切線的反方向不是本次速度方向。';
  }
  function render(){
    cancelAnimations();if(drag&&controller.mode!=='edit')cancelDrag();
    const s=controller.state,task=controller.task,editable=controller.mode==='edit',checking=controller.mode==='check';
    d.app.classList.toggle('checking',checking||!s||rendererFailed);d.stage.hidden=!s||rendererFailed;d.learningPanel.hidden=!s||checking||rendererFailed;d.checkPanel.hidden=!checking;
    d.notice.hidden=!controller.notice;d.notice.textContent=controller.notice;d.saveRetry.hidden=!controller.unsaved||!controller.editable;
    d.checkButton.hidden=!controller.editable;d.checkButton.disabled=checking;
    d.status.textContent=controller.editable?'位移 → 速度 → 加速度':controller.trusted?'已記錄 · 唯讀查看':controller.mode==='frozen'?'提交結果尚未確認':'技術狀態';
    d.resultPanel.hidden=controller.editable;d.resultTitle.textContent=controller.trusted?'已提交':controller.mode==='frozen'?'提交結果尚未確認':controller.mode==='submitting'?'正在提交':'作答紀錄';
    d.scoreText.textContent=controller.result?.score!=null?`${controller.result.score} / 100 · ${SimActivityFlow.completionLabel(controller.result.passed)}`:'-- · 未能確認成績';
    d.retryFinal.hidden=!['frozen','committed'].includes(controller.mode);d.retryFinal.textContent=controller.mode==='committed'?'重試結束連線':'重試同一份提交';
    d.feedback.hidden=!controller.trusted;
    if(!s){d.taskNav.querySelectorAll('button').forEach(b=>{b.disabled=true;});d.compactNav.disabled=true;return;}
    d.taskNav.querySelectorAll('button').forEach(b=>{b.disabled=!controller.editable&&!['review','committed','frozen'].includes(controller.mode);b.setAttribute('aria-current',Number(b.dataset.task)===task?'step':'false');});
    d.compactNav.value=String(task);d.compactNav.disabled=!controller.editable&&!['review','committed','frozen'].includes(controller.mode);
    d.taskTitle.textContent=`${task+1}. ${titles[task]}`;
    const a=s.answers;
    d.instruction.textContent=task===0?'把較後位置 B 拖近 A，觀察位移方向。':task===2?'位置與轉向都換了；用相同的推理作答。':a.deltaFrom===null?'先選線段起點，再選終點，表示末速度減初速度。':a.deltaTo===null?'再選另一個節點作為線段終點。':'把 B 拖近 A，比較「我的作圖方向」的變化。';
    d.definition.innerHTML=task===0?'平均速度 <span class="vector">v</span><sub>平均</sub> = Δ<span class="vector">r</span> / Δt<span class="caption">位移除以正的時間間隔，方向不變。</span>':task===1?'平均加速度 <span class="vector">a</span><sub>平均</sub> = Δ<span class="vector">v</span> / Δt<span class="caption">Δ<span class="vector">v</span> = <span class="vector">v</span><sub>B</sub> − <span class="vector">v</span><sub>A</sub>；除以正的 Δt，方向不變。</span>':'同一物體作勻速圓周運動；只改了起點與轉向。';
    d.velocityDiagram.hidden=task!==1;d.vectorControls.hidden=task!==1;d.distanceGroup.hidden=task===1;
    d.diagramLegend.textContent=(task===1?'橙色為初速度，藍色為末速度。紫色實線是我的作圖；A 點虛線只比較方向，不表示大小。':'實線 A→B 是位移，淡色圓弧是路徑；虛線只延長方向。')+(controller.trusted?' 綠色空心箭頭為參考答案。':'');
    d.shorten.disabled=!editable||s.observation[M.GAP_KEYS[task]]===5;d.lengthen.disabled=!editable||s.observation[M.GAP_KEYS[task]]===60;
    const nodeNames={S:'共同起點 S',U:'初速度端 U',V:'末速度端 V'};
    d.nodePrompt.textContent=`起點：${nodeNames[a.deltaFrom]??'未選'}；終點：${nodeNames[a.deltaTo]??'未選'}`;
    d.vectorControls.querySelectorAll('[data-vector-node]').forEach(b=>{b.disabled=!editable||a.deltaTo!==null;b.setAttribute('aria-pressed',String([a.deltaFrom,a.deltaTo].includes(b.dataset.vectorNode)));});
    d.redraw.disabled=!editable||a.deltaFrom===null;d.changeEnd.disabled=!editable||a.deltaTo===null;
    d.vectorEdits.hidden=!editable||a.deltaFrom===null;
    buildQuestions(s);
    d.questions.querySelectorAll('fieldset').forEach(e=>{e.hidden=Number(e.dataset.taskGroup)!==task;});
    d.questions.querySelectorAll('input').forEach(e=>{e.checked=a[e.name]===e.value;e.disabled=!editable;});
    d.questions.querySelectorAll('[data-clear-answer]').forEach(e=>{e.hidden=!editable;e.disabled=a[e.dataset.clearAnswer]===null;});
    d.editFooter.hidden=!editable;d.nextTask.textContent=task<2?'下一個探究':'檢查答案';
    if(checking){d.checkSummary.innerHTML=titles.map((title,i)=>`<section><h3>${i+1}. ${title}</h3><ul>${M.QUESTIONS.filter(q=>q.task===i).map(q=>`<li>${q.id}：${a[q.field]===null?'未答':'已答'}</li>`).join('')}${i===1?`<li>速度變化量連線：${a.deltaFrom??'未選'} → ${a.deltaTo??'未選'}</li>`:''}</ul><button type="button" data-return="${i}">返回修改</button></section>`).join('');d.submitButton.disabled=controller.unsaved;}
    if(controller.trusted)d.feedbackList.innerHTML=controller.result.detail.filter(item=>item.task===task).map(item=>`<details><summary>${esc(item.id)} · ${item.earned} / ${item.max} 分</summary><p>${esc(item.title)}</p><p>${esc(feedback(item))}</p></details>`).join('');
    drawStage();
  }
  function cancelDrag(){if(!drag)return;const active=drag;drag=null;diagnostics.cancel++;try{if(active.target.hasPointerCapture(active.id))active.target.releasePointerCapture(active.id);}catch(_){}d.preview.hidden=true;}
  function command(action){cancelDrag();controller.command(action);}
  function navigate(task){cancelDrag();const before=controller.task;controller.navigate(task);d.controlPanel.scrollTop=0;if(before!==1&&task===1)animateAlignment();}
  function check(){cancelDrag();controller.check();d.controlPanel.scrollTop=0;}
  d.taskNav.addEventListener('click',e=>{const b=e.target.closest('[data-task]');if(b)navigate(Number(b.dataset.task));});d.compactNav.addEventListener('change',()=>navigate(Number(d.compactNav.value)));
  d.checkButton.addEventListener('click',check);d.nextTask.addEventListener('click',()=>controller.task<2?navigate(controller.task+1):check());
  d.checkSummary.addEventListener('click',e=>{const b=e.target.closest('[data-return]');if(b)navigate(Number(b.dataset.return));});
  d.submitButton.addEventListener('click',()=>{cancelDrag();controller.submit();d.controlPanel.scrollTop=0;});d.retryFinal.addEventListener('click',()=>controller.retryFinal());d.saveRetry.addEventListener('click',()=>controller.retrySave());
  d.shorten.addEventListener('click',()=>command({type:'gap',value:Math.max(5,controller.state.observation[M.GAP_KEYS[controller.task]]-5)}));d.lengthen.addEventListener('click',()=>command({type:'gap',value:Math.min(60,controller.state.observation[M.GAP_KEYS[controller.task]]+5)}));
  d.vectorControls.addEventListener('click',e=>{const b=e.target.closest('[data-vector-node]');if(b){if(controller.state.answers.deltaFrom===b.dataset.vectorNode){d.nodePrompt.textContent='請選另一個節點作為終點。';return;}command({type:'node',value:b.dataset.vectorNode});}});
  d.redraw.addEventListener('click',()=>command({type:'redraw'}));d.changeEnd.addEventListener('click',()=>command({type:'change-end'}));
  d.questions.addEventListener('change',e=>{if(e.target.matches('input[data-answer-choice]'))command({type:'answer',field:e.target.name,value:e.target.value});});d.questions.addEventListener('click',e=>{const b=e.target.closest('[data-clear-answer]');if(b)command({type:'answer',field:b.dataset.clearAnswer,value:null});});
  d.clearTask.addEventListener('click',()=>{const a=controller.state.answers,has=M.QUESTIONS.some(q=>q.task===controller.task&&a[q.field]!==null)||(controller.task===1&&a.deltaFrom!==null);if(!has||confirm('只清除本頁答案並重設本頁時間間隔；其他頁的答案保留。'))command({type:'clear-task'});});
  d.positionHandle.addEventListener('pointerdown',e=>{if(controller.mode!=='edit'||drag||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;cancelAnimations();diagnostics.down++;if(e.isTrusted&&e.pointerType==='touch')diagnostics.trustedTouch++;drag={id:e.pointerId,target:e.currentTarget,value:controller.state.observation[M.GAP_KEYS[controller.task]],touch:e.pointerType==='touch'};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();drawStage();});
  d.positionHandle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=layout.position,g=M.scene(controller.state,controller.task),theta=Math.atan2(-(e.clientY-p.top-p.center[1]),e.clientX-p.left-p.center[0]);let delta=((g.sense*(theta-g.thetaA)*180/Math.PI)%360+360)%360;if(delta>180)delta=0;drag.value=Math.max(5,Math.min(60,Math.round(delta)));diagnostics.move++;drawStage();});
  d.positionHandle.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const active=drag;drag=null;diagnostics.up++;try{active.target.releasePointerCapture(active.id);}catch(_){}controller.command({type:'gap',value:active.value});drawStage();});
  ['pointercancel','lostpointercapture'].forEach(type=>d.positionHandle.addEventListener(type,()=>{cancelDrag();drawStage();}));
  d.positionHandle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||controller.mode!=='edit')return;e.preventDefault();const step=['ArrowLeft','ArrowDown'].includes(e.key)?-1:1;command({type:'gap',value:Math.max(5,Math.min(60,controller.state.observation[M.GAP_KEYS[controller.task]]+step))});});
  document.addEventListener('pointerdown',e=>{if(drag&&drag.id!==e.pointerId){cancelDrag();drawStage();}},true);window.addEventListener('blur',()=>{cancelDrag();drawStage();});
  new ResizeObserver(()=>{cancelDrag();cancelAnimations();cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(drawStage);}).observe(d.stage);
  window.__circularVectorApp={controller,getState:()=>controller.state?M.clone(controller.state):null,getGeometry:()=>layout,diagnostics:()=>({...diagnostics}),isDragging:()=>Boolean(drag)};
  controller.start();
})();
