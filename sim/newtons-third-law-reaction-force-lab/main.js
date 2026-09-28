(function () {
  "use strict";
  const M=ReactionModel,N=ReactionNotation,P=ReactionPersistence,Scene=ReactionScene;
  const ids=["app","attemptStatus","questionNav","checkButton","stage","stageSvg","motionLabel","ownerLabel","dragLayer","magnifier","magnifierSvg","previewBody","previewValues","controlPanel","notice","saveRetryButton","questionIntro","questionKicker","questionTitle","questionPrompt","gravityNote","pauseButton","givenSummary","targetNav","editPanel","bodyChoices","anchorField","anchorChoices","drawHint","kindSelect","forceReadout","undoButton","redoButton","clearForceButton","clearQuestionButton","stepGuide","stepProgress","nextButton","returnCheckButton","clearAllButton","checkPanel","checkList","submitButton","reviewPanel","reviewTitle","scorePanel","retryFinalButton","referenceButton","feedback","technicalPanel","recoverButton","liveRegion"];
  const d=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  const c=new ReactionRuntime.Controller(SimScorm,SimActivityFlow,render), reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let layout=null,drag=null,keyboard=null,showReference=false,paused=reduced.matches,elapsed=0,lastFrame=null,motionFamily=null;
  const targets=new Map(),diagnostics={downs:0,moves:0,ups:0,cancels:0,trustedTouch:0,previews:0,lastTarget:null};
  const editable=()=>c.mode==="edit",q=()=>c.scenario?.questions[c.familyIndex]||null,selected=()=>c.targetIndex,answers=()=>c.state?.answers[c.familyIndex],record=()=>answers()?.[selected()];
  const announce=message=>{d.liveRegion.textContent=message;};
  const status=a=>a.every(M.complete)?"complete":a.some(M.started)?"partial":"empty",statusName={complete:"✓ 已作答",partial:"作答中",empty:"未開始"};
  const point=event=>{const r=d.stage.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};};
  const working=()=>drag?.active?drag.working:keyboard?.record||null;
  function cancel(count=false){const previous=drag;drag=null;keyboard=null;hidePreview();if(previous){if(count)diagnostics.cancels++;try{previous.element.releasePointerCapture(previous.id);}catch(_){}}}
  function navigate(question,target=0){const newContent=question!==c.familyIndex||c.mode==="check";cancel();showReference=false;c.navigate(question,target);if(newContent)d.controlPanel.scrollTop=0;}
  function enterCheck(){cancel();showReference=false;c.check();d.controlPanel.scrollTop=0;}
  function render(){
    const panelScroll=d.controlPanel.scrollTop;
    if(!editable())cancel();const question=q(),safe=Boolean(question&&["edit","review","committed","frozen"].includes(c.mode));
    if(question?.family!==motionFamily){motionFamily=question?.family;elapsed=0;lastFrame=null;}
    d.app.classList.toggle("no-scene",!safe);d.stage.setAttribute("aria-hidden",String(!safe));
    d.attemptStatus.textContent=c.editable?"反作用力作圖挑戰":c.mode==="review"?"已提交 · 只讀檢討":c.mode==="committed"?"成績已記錄":c.mode==="frozen"?"提交待確認":"作答狀態";
    d.notice.hidden=!c.notice;d.notice.textContent=c.notice;d.saveRetryButton.hidden=!c.editable||!c.unsaved;
    d.checkButton.hidden=!c.editable;d.questionIntro.hidden=!safe;d.editPanel.hidden=!editable();d.checkPanel.hidden=c.mode!=="check";
    d.reviewPanel.hidden=!["review","committed","frozen","mismatch"].includes(c.mode);d.technicalPanel.hidden=c.mode!=="technical";d.recoverButton.hidden=!c.canRecover;
    d.questionNav.replaceChildren();
    if(c.scenario)for(const [position,family] of c.scenario.order.entries()){
      const a=c.state.answers[family],b=document.createElement("button");b.dataset.question=family;b.dataset.progress=status(a);b.setAttribute("aria-current",c.familyIndex===family&&c.mode!=="check"?"step":"false");b.setAttribute("aria-label",`第${position+1}題 ${c.scenario.questions[family].title}，${statusName[status(a)]}`);b.innerHTML=`${position+1}<span class="nav-status">${a.filter(M.complete).length}/${a.length}</span>`;b.onclick=()=>navigate(family);d.questionNav.append(b);
    }
    if(safe){
      const r=record(),force=question.given.find(f=>f.id===question.targets[selected()]);
      d.questionKicker.textContent=`第${c.position+1}題 · ${question.targets.length}個反作用力配對`;d.questionTitle.textContent=question.title;d.questionPrompt.textContent=question.prompt;
      d.gravityNote.textContent=question.family===4?"同題所有力箭頭按相同大小比例繪製。":"本題毋須畫重力的反作用力。";
      d.pauseButton.hidden=!M.backgroundMotion(question,0);d.pauseButton.textContent=paused?"播放背景":"暫停背景";
      document.getElementById("motionNote").hidden=question.family!==1;
      document.getElementById("valueNote").hidden=c.state.generatorVersion===1;
      for(const b of d.editPanel.querySelectorAll('[data-adjust="less"],[data-adjust="more"]'))b.textContent=`${b.dataset.adjust==="less"?"−":"＋"} ${c.state.generatorVersion===1?"0.01":"0.1"} N`;
      d.givenSummary.innerHTML=`<strong>已知：${N.escape(question.bodies[0].name)}所受的力</strong><br>`+question.given.map(f=>`${N.html(f.symbol)} = ${N.value(f.force100/100)} N · ${N.escape(f.name)}`).join("<br>");
      d.targetNav.replaceChildren();question.targets.forEach((id,i)=>{const f=question.given.find(f=>f.id===id),b=document.createElement("button");b.dataset.target=i;b.dataset.progress=status([answers()[i]]);b.setAttribute("aria-current",selected()===i?"step":"false");b.innerHTML=`${N.html(f.symbol)} 的反作用力<small>${statusName[status([answers()[i]])]}</small>`;b.onclick=()=>navigate(question.family,i);d.targetNav.append(b);});
      if(editable()){
        d.bodyChoices.replaceChildren();question.bodies.forEach(body=>{const b=document.createElement("button");b.className="body-select";b.dataset.body=body.id;b.setAttribute("aria-pressed",String(body.id===r[0]));b.textContent=body.name;b.onclick=()=>{cancel();const had=r[3]!==null;c.command({type:"body",index:selected(),body:body.id});if(had&&r[0]!==body.id)announce("已更換受力物體，原箭頭已清除，可按復原還原。");};d.bodyChoices.append(b);});
        d.anchorField.disabled=r[0]===null;d.anchorChoices.replaceChildren();
        if(r[0]!==null)question.bodies[r[0]].anchors.forEach(a=>{const b=document.createElement("button");b.className="anchor-choice";b.dataset.anchor=a.id;b.setAttribute("aria-pressed",String(r[1]===a.id));b.textContent=a.name;b.onclick=()=>{cancel();c.command({type:"anchor",index:selected(),anchor:a.id});};d.anchorChoices.append(b);});
        d.drawHint.textContent=r[0]===null?"先選受力物體。":r[1]===null?"選一個起筆點，圖中便會出現可拖動的圓點。":r[3]===null?"從圖中所選圓點拖出箭頭，方向和長度由你決定。":"拖箭尖可修改；更換起筆點會保留方向與大小。";
        d.kindSelect.value=r[2]===null?"":String(r[2]);
        d.forceReadout.innerHTML=r[3]===null?"尚未畫出箭頭":`畫在：${N.escape(question.bodies[r[0]].name)}<br><var>F</var>′ = <strong>${N.value(r[4]/100)} N</strong> · <var>θ</var> = ${N.value(r[3]/10)}°`;
        for(const b of d.editPanel.querySelectorAll("[data-adjust]"))b.disabled=r[3]===null;
        d.undoButton.disabled=!c.history.undo[question.family].length;d.redoButton.disabled=!c.history.redo[question.family].length;
        d.clearForceButton.disabled=!M.started(r);d.clearQuestionButton.disabled=!answers().some(M.started);d.clearAllButton.disabled=!c.state.answers.some(a=>a.some(M.started));
        const complete=answers().filter(M.complete).length;d.stepGuide.dataset.progress=status(answers());d.stepProgress.textContent=`本題已作答 ${complete}/${question.targets.length} · 本格${M.complete(r)?"已作答":r[3]===null?"尚未畫箭頭":r[2]===null?"尚未標種類":"作答中"}`;
        d.nextButton.textContent=selected()+1<question.targets.length?"下一個反作用力":c.position<4?"下一題":"下一步：檢查作答";d.returnCheckButton.hidden=!c.state.returnToCheck;
      }
      d.motionLabel.textContent=question.motion;const shown=showReference?question.expected[selected()]:r;
      d.ownerLabel.textContent=(showReference?"參考圖 · ":"")+(shown[0]===null?"選受力物體，再畫反作用力":`此箭頭畫在：${question.bodies[shown[0]].name}`);
    }
    if(c.mode==="check"){
      d.checkList.replaceChildren();for(const [position,family] of c.scenario.order.entries()){const a=c.state.answers[family],div=document.createElement("div");div.className="check-row";const b=document.createElement("button");b.innerHTML=`${position+1}. ${N.escape(c.scenario.questions[family].title)}<small>已選物體 ${a.filter(r=>r[0]!==null).length}/${a.length} · 已畫 ${a.filter(r=>r[3]!==null).length}/${a.length} · 已標種類 ${a.filter(r=>r[2]!==null).length}/${a.length}</small>`;b.onclick=()=>navigate(family);div.append(b);d.checkList.append(div);}d.submitButton.disabled=c.unsaved;
    }
    if(!d.reviewPanel.hidden){
      d.reviewTitle.textContent=c.mode==="frozen"?"提交尚未確認":c.mode==="committed"?"成績已記錄":c.mode==="mismatch"?"已完成紀錄未能核對":"只讀檢討";
      d.scorePanel.innerHTML=c.result?`<strong>${c.result.score===null?"—":N.value(c.result.score)} / 100</strong><p>${N.escape(SimActivityFlow.completionLabel(c.result.passed))}</p>`:"<p>答案已凍結，成績尚未確認。</p>";
      d.retryFinalButton.hidden=!["frozen","committed"].includes(c.mode);d.retryFinalButton.textContent=c.mode==="committed"?"重試完成程序":"重試同一份提交";
      d.referenceButton.hidden=!c.trusted;d.referenceButton.textContent=showReference?"返回你的作圖":"顯示參考圖";d.feedback.innerHTML="";
      if(c.trusted&&question){const detail=c.result.detail[question.family];d.feedback.innerHTML=`<p>本題 ${N.value(detail.score)} / 20 分</p>`+detail.detail.map((result,i)=>{const f=question.given.find(f=>f.id===question.targets[i]),expected=question.expected[i],body=question.bodies[expected[0]],anchor=body.anchors[expected[1]];return `<article><h3>${N.html(f.symbol)} 的反作用力</h3><p>${N.escape(question.bodies[0].name)}對${N.escape(body.name)}的${N.escape(N.shortNames[f.kind])}，畫在${N.escape(anchor.name)}；與原力等大反向。</p><p>${[["body","受力物體"],["placement","起點／作用線"],["direction","方向"],["magnitude","大小"],["kind","種類"]].map(([key,label])=>`<span class="${result[key]?"ok":"issue"}">${result[key]?"✓":"○"} ${label}</span>`).join(" · ")}</p></article>`;}).join("")+`<p class="small">作用力與反作用力分別作用在兩個物體上。${question.family===4?"地球受到小球的萬有引力，不是支持力；兩力相等不代表兩者加速度相等。":question.family===3?"小球直接拉的是繩；固定架所受的力屬於另一組相互作用。":"物體是否加速，不改變同一配對力等大反向的關係。"}</p>`;}
    }
    renderStage();
    d.controlPanel.scrollTop=panelScroll;
  }
  function getTarget(key,kind){
    if(targets.has(key))return targets.get(key);
    const b=document.createElement("button");b.type="button";b.className=kind;b.dataset.hit=key;
    b.addEventListener("pointerdown",event=>pointerDown(event,b,kind==="anchor-hit"));b.addEventListener("pointermove",pointerMove);b.addEventListener("pointerup",pointerUp);
    for(const type of ["pointercancel","lostpointercapture"])b.addEventListener(type,event=>{if(drag?.id===event.pointerId){cancel(true);renderStage();}});
    b.addEventListener("keydown",event=>keyDown(event,b));b.addEventListener("focusout",()=>{if(keyboard?.element===b){cancel();renderStage();}});
    d.dragLayer.append(b);targets.set(key,b);return b;
  }
  function renderStage(){
    const question=q();if(!question||d.stage.getAttribute("aria-hidden")==="true"){for(const b of targets.values())b.hidden=true;hidePreview();return;}
    const rect=d.stage.getBoundingClientRect();layout=M.layout(rect.width,rect.height,question);const work=working();
    d.stageSvg.setAttribute("viewBox",`0 0 ${rect.width} ${rect.height}`);d.stageSvg.innerHTML=Scene.svg(question,layout,answers(),selected(),work,showReference&&c.trusted);
    paintBackground();
    const r=work||record(), visible=new Set();
    if(editable()&&r[1]!==null){
      const creating=r[3]===null||drag?.creating||keyboard?.creating,originPoint=M.pixel(M.origin(r,question),layout),p=creating?originPoint:M.handle(M.endpoint(r,question,layout),layout),key=`${question.family}-${selected()}-${creating?"anchor":"head"}`;
      const b=getTarget(key,creating?"anchor-hit":"reaction-head-hit");visible.add(key);b.hidden=false;
      b.className=creating?"anchor-hit":p.offscale?"offscale-head-hit":"reaction-head-hit";b.style.left=`${p.x}px`;b.style.top=`${p.y}px`;b.style.zIndex="8";
      b.setAttribute("aria-label",creating?`從${question.bodies[r[0]].name}的${question.bodies[r[0]].anchors[r[1]].name}畫出反作用力`:`${question.bodies[r[0]].name}上的反作用力，${N.value(r[4]/100)} N，${N.value(r[3]/10)}度${p.offscale?"，超出圖框":""}`);
    }
    for(const [key,b] of targets)if(!visible.has(key)&&b!==drag?.element)b.hidden=true;
    if(drag?.active)preview();
  }
  function hidePreview(){d.magnifier.hidden=true;d.magnifierSvg.replaceChildren();d.previewBody.textContent="";d.previewValues.textContent="";}
  function preview(){
    if(!drag||drag.type==="mouse"||!drag.active||drag.working[3]===null)return;
    const r=drag.working,width=Math.min(240,layout.width-68),height=Math.min(100,(layout.height-44)/2),cursor=drag.cursor;
    const options=[{x:34,y:3},{x:layout.width-34-width,y:3},{x:34,y:layout.height-height-3},{x:layout.width-34-width,y:layout.height-height-3}],clear=p=>!(cursor.x>p.x-18&&cursor.x<p.x+width+18&&cursor.y>p.y-18&&cursor.y<p.y+height+18);
    if(!drag.corner||!clear(drag.corner))drag.corner=options.filter(clear).sort((a,b)=>Math.hypot(b.x+width/2-cursor.x,b.y+height/2-cursor.y)-Math.hypot(a.x+width/2-cursor.x,a.y+height/2-cursor.y))[0]||options[0];
    Object.assign(d.magnifier.style,{width:`${width}px`,height:`${height}px`,left:`${drag.corner.x}px`,top:`${drag.corner.y}px`});d.magnifier.classList.toggle("compact",height<82);d.magnifier.hidden=false;
    d.previewBody.textContent=`畫在：${q().bodies[r[0]].name}`;d.previewValues.innerHTML=`<var>F</var>′ = <strong>${N.value(r[4]/100)}</strong> N<br><var>θ</var> = <strong>${N.value(r[3]/10)}</strong>°`;
    const iw=d.magnifierSvg.clientWidth,ih=d.magnifierSvg.clientHeight,focus=M.endpoint(r,q(),layout),scene=d.stageSvg.cloneNode(true);
    for(const node of scene.querySelectorAll("text"))node.remove();for(const node of scene.querySelectorAll("[clip-path]"))node.removeAttribute("clip-path");
    d.magnifierSvg.setAttribute("viewBox",`${focus.x-iw/4} ${focus.y-ih/4} ${iw/2} ${ih/2}`);d.magnifierSvg.innerHTML=scene.innerHTML.replaceAll("scene-clip","preview-clip").replaceAll("surface","preview-surface")+`<path d="M${focus.x-3} ${focus.y}h6M${focus.x} ${focus.y-3}v6" stroke="#172b43" stroke-width=".6"/>`;diagnostics.previews++;
  }
  function pointerDown(event,element,creating){
    if(!editable()||drag||event.isPrimary===false||event.button>0||record()[1]===null)return;cancel();
    const p=point(event),before=M.clone(record()),end=creating?M.pixel(M.origin(before,q()),layout):M.endpoint(before,q(),layout);
    drag={id:event.pointerId,type:event.pointerType,element,creating,before,working:M.clone(before),down:p,cursor:p,baseEnd:end,active:false,corner:null,snap:null,forceSnap:null};
    diagnostics.downs++;diagnostics.lastTarget=creating?"anchor":"head";if(event.isTrusted&&event.pointerType==="touch")diagnostics.trustedTouch++;element.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function resolveDrag(event){
    if(!drag)return;const p=point(event);drag.cursor=p;const dx=p.x-drag.down.x,dy=p.y-drag.down.y;
    if(!drag.active&&Math.hypot(dx,dy)<(drag.type==="mouse"?3:6))return;drag.active=true;
    const resolved=M.fromPoint(drag.before,q(),layout,{x:drag.baseEnd.x+dx,y:drag.baseEnd.y+dy},drag.type,drag.snap,drag.forceSnap);
    if(resolved){drag.working=resolved.record;drag.snap=resolved.target;drag.forceSnap=resolved.forceTarget;}
  }
  function pointerMove(event){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();diagnostics.moves++;resolveDrag(event);renderStage();}
  function pointerUp(event){
    if(!drag||event.pointerId!==drag.id)return;const p=point(event);
    if(p.x<32||p.x>layout.width-32||p.y<0||p.y>layout.height){cancel(true);renderStage();return;}
    resolveDrag(event);diagnostics.ups++;const active=drag,newAnswer=M.clone(answers());if(active.active)newAnswer[selected()]=active.working;
    cancel();c.setAnswer(newAnswer);renderStage();if(active.active)announce("已記錄這支反作用力。");
  }
  function keyDown(event,element){
    if(!editable()||record()[1]===null)return;
    if(event.key==="Escape"){if(keyboard){event.preventDefault();cancel();renderStage();}return;}
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"].includes(event.key))return;event.preventDefault();
    if(keyboard&&keyboard.element!==element)cancel();
    if(event.key==="Enter"&&keyboard){const next=M.clone(answers());next[selected()]=keyboard.record;cancel();c.setAnswer(next);renderStage();return;}
    if(!keyboard){const r=M.clone(record());keyboard={element,creating:r[3]===null,record:r};if(r[3]===null){r[3]=0;r[4]=100;}}
    const r=keyboard.record;if(event.key==="ArrowLeft")r[3]=(r[3]+(event.shiftKey?50:10))%3600;if(event.key==="ArrowRight")r[3]=(r[3]+3600-(event.shiftKey?50:10))%3600;
    if(event.key==="ArrowUp")r[4]=Math.min(q().maxForce100,r[4]+(event.shiftKey?50:10));if(event.key==="ArrowDown")r[4]=Math.max(1,r[4]-(event.shiftKey?50:10));renderStage();
  }
  d.kindSelect.innerHTML+=""+N.names.map((name,i)=>`<option value="${i}">${N.escape(name)}</option>`).join("");
  d.kindSelect.onchange=()=>{cancel();c.command({type:"kind",index:selected(),kind:d.kindSelect.value===""?null:Number(d.kindSelect.value)});};
  for(const b of d.editPanel.querySelectorAll("[data-adjust]"))b.onclick=()=>{if(!editable()||record()[3]===null)return;cancel();const r=record(),action=b.dataset.adjust,step=c.state.generatorVersion===1?.01:.1;c.command({type:"place",index:selected(),angle:r[3]/10+(action==="ccw"?1:action==="cw"?-1:0),force:r[4]/100+(action==="more"?step:action==="less"?-step:0)});};
  d.undoButton.onclick=()=>{cancel();c.undo();};d.redoButton.onclick=()=>{cancel();c.undo(true);};
  d.clearForceButton.onclick=()=>{if(editable()&&confirm("清除此反作用力的物體、起點、箭頭及種類？其他配對會保留。")){cancel();c.command({type:"remove",index:selected()});}};
  d.clearQuestionButton.onclick=()=>{if(editable()&&confirm("清除此題的全部反作用力答案？其他題會保留。")){cancel();c.command({type:"clear"});}};
  d.clearAllButton.onclick=()=>{if(editable()&&confirm("清除五題的全部答案？題目及次序保持不變。")){cancel();showReference=false;c.clearAllAnswers();d.controlPanel.scrollTop=0;}};
  d.checkButton.onclick=d.returnCheckButton.onclick=enterCheck;
  d.nextButton.onclick=()=>{if(selected()+1<q().targets.length)navigate(q().family,selected()+1);else if(c.position<4)navigate(c.scenario.order[c.position+1]);else enterCheck();};
  d.submitButton.onclick=()=>{cancel();c.submit();d.controlPanel.scrollTop=0;};d.saveRetryButton.onclick=()=>c.retrySave();d.retryFinalButton.onclick=()=>{cancel();c.retryFinal();};
  d.referenceButton.onclick=()=>{cancel();showReference=!showReference;render();};d.pauseButton.onclick=()=>{paused=!paused;lastFrame=null;render();};
  d.recoverButton.onclick=()=>{if(confirm("只清除此已確認未提交的損壞草稿？"))c.recoverDraft();};
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&(drag||keyboard)){event.preventDefault();cancel();renderStage();}if(editable()&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();cancel();c.undo(event.shiftKey);}});
  const touchOwners=new Map();let handoffPanel=false;const ownTarget=target=>target?.closest?.(".anchor-hit,.reaction-head-hit,.offscale-head-hit");
  document.addEventListener("pointerdown",event=>{if(event.pointerType!=="touch"||event.isPrimary!==false||!drag||ownTarget(event.target))return;handoffPanel=d.controlPanel.contains(event.target);cancel(true);renderStage();},true);
  document.addEventListener("touchstart",event=>{for(const t of event.changedTouches){let owner="native";if(ownTarget(t.target))owner="draw";else if(d.stage.contains(t.target)&&!t.target.closest?.("button"))owner="host";else if(handoffPanel&&d.controlPanel.contains(t.target))owner="panel-handoff";touchOwners.set(t.identifier,{owner,y:owner==="host"?t.screenY:t.clientY});}handoffPanel=false;},{passive:true});
  document.addEventListener("touchmove",event=>{let handled=false;for(const t of event.changedTouches){const r=touchOwners.get(t.identifier);if(!r)continue;const y=r.owner==="host"?t.screenY:t.clientY,delta=r.y-y;r.y=y;if(r.owner==="host"){try{if(window.parent!==window&&window.parent.document){window.parent.scrollBy(0,delta/(window.parent.visualViewport?.scale||1));handled=true;}}catch(_){/* Cross-origin host requires deployment verification. */}}else if(r.owner==="panel-handoff"){d.controlPanel.scrollTop+=delta;handled=true;}}if(handled&&event.cancelable)event.preventDefault();},{passive:false});
  for(const type of ["touchend","touchcancel"])document.addEventListener(type,event=>{for(const t of event.changedTouches)touchOwners.delete(t.identifier);},{passive:true});
  window.addEventListener("blur",()=>{cancel(true);renderStage();});window.addEventListener("resize",()=>{cancel(true);renderStage();});document.addEventListener("visibilitychange",()=>{if(document.hidden){cancel(true);lastFrame=null;renderStage();}});reduced.addEventListener("change",event=>{paused=event.matches;lastFrame=null;render();});
  new ResizeObserver(()=>{if(drag||keyboard)cancel(true);renderStage();}).observe(d.stage);
  function paintBackground(){const motion=M.backgroundMotion(q(),elapsed);if(motion)d.stageSvg.querySelector("#surface")?.setAttribute("patternTransform",`translate(${motion.x} ${motion.y})`);}
  function frame(now){
    const playing=!document.hidden&&M.backgroundMotion(q(),0)&&!paused&&["edit","review"].includes(c.mode);
    if(playing){if(lastFrame!==null)elapsed+=(now-lastFrame)/1000;paintBackground();}
    lastFrame=playing?now:null;requestAnimationFrame(frame);
  }
  window.__reactionApp=Object.freeze({getState:()=>M.clone(c.state),getMode:()=>c.mode,getQuestion:()=>M.clone(q()),getGeometry:()=>M.clone(layout),getPointerDiagnostics:()=>({...diagnostics}),getResult:()=>M.clone(c.result),getSnapshot:()=>c.editable?c.draftSnapshot():M.clone(c.finalSnapshot),getAnimation:()=>({elapsed,paused,motion:M.backgroundMotion(q(),elapsed)})});
  c.start();requestAnimationFrame(frame);
})();
