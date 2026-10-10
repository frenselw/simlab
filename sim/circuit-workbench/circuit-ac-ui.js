(function(root){
  'use strict';
  function mount({host,refs,profile,controller,viewDocument,routes,readouts,currentReferences}){
    const V=root.CircuitRenderer,Q=root.CircuitMath,F=root.CircuitFieldGraphics,G=root.CircuitGeneratorGraphics,abort=new AbortController();
    host.classList.add('ac-editor');
    const on=(e,type,fn)=>e.addEventListener(type,fn,{signal:abort.signal});
    const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
    const section=(title)=>{const e=element('section','panel-section'),h=element('h2','',title);e.append(h);return e;};
    const button=(text,fn,label=text)=>{const b=element('button','',text);b.type='button';b.setAttribute('aria-label',label);on(b,'click',fn);return b;};
    const quantity=(value,unit)=>Q.html(Q.quantity(unit==='J'?V.displayEnergy(value):value,unit));
    if(profile.ui.presets){const P=root.CircuitACPresets;refs.preset.replaceChildren(new Option(P.names.empty,'empty'),...P.groups.map(({label,keys})=>{const group=document.createElement('optgroup');group.label=label;group.append(...keys.map(key=>new Option(P.names[key],key)));return group;}));refs.preset.value='resistive';}
    const notice=element('p','diagnostic ac-diagnostic');notice.setAttribute('role','status');refs.panel.prepend(notice);
    function documentLoaded(doc){if(!profile.ui.presets)return;const value=JSON.stringify(doc),name=Object.keys(root.CircuitACPresets.names).find(name=>JSON.stringify(root.CircuitACPresets.create(name))===value);if(name)refs.preset.value=name;else{if(![...refs.preset.options].some(o=>o.value==='custom')){const option=new Option('自訂電路','custom');option.disabled=true;refs.preset.add(option);}refs.preset.value='custom';}}
    const scope=profile.ui.waveform?root.CircuitScopeUI.mount({host,refs,profile,controller,viewDocument,routes,readouts,currentReferences}):null;
    let lastAnalysis=controller.getAnalysis(),energyScale=0,observed=null;
    const energyPanel=section('儲能與耗散'),fieldPanel=section('電場與磁場'),energyContent=element('div','ac-energy'),fieldCheck=document.createElement('input'),energyCheck=document.createElement('input');fieldCheck.type=energyCheck.type='checkbox';fieldCheck.checked=energyCheck.checked=true;
    const fieldLabel=element('label','check','在畫布顯示場線'),energyLabel=element('label','check','顯示能量');fieldLabel.prepend(fieldCheck);energyLabel.prepend(energyCheck);
    const fieldDetails=element('details','ac-field-details'),fieldSummary=element('summary','','場的觀察'),fieldContent=element('div','ac-field');fieldDetails.append(fieldSummary,fieldContent);fieldPanel.append(fieldLabel,fieldDetails);energyPanel.append(energyLabel,energyContent);
    on(fieldCheck,'change',()=>controller.setFieldDisplay(fieldCheck.checked));on(energyCheck,'change',()=>energyContent.hidden=!energyCheck.checked);if(profile.ui.energy)refs.panel.append(energyPanel);if(profile.ui.field)refs.panel.append(fieldPanel);
    const fieldDialog=element('dialog','ac-field-dialog'),fieldHead=element('div','dialog-head'),fieldTitle=element('h2','','場的觀察'),fieldLarge=element('div','ac-field ac-field-large');fieldDialog.setAttribute('aria-label','電場與磁場觀察');
    const fieldClose=button('×',()=>fieldDialog.close(),'關閉場的觀察'),fieldPlay=button('暫停',()=>controller.setPlayback({paused:!controller.getPlayback().paused}));fieldClose.dataset.fieldClose='true';fieldPlay.dataset.fieldPlay='true';fieldHead.append(fieldTitle,fieldClose);fieldDialog.append(fieldHead,fieldLarge,fieldPlay);if(profile.ui.field)host.append(fieldDialog);
    const panelView={host:fieldContent},largeView={host:fieldLarge};
    on(fieldDialog,'keydown',e=>e.stopPropagation());on(fieldDetails,'toggle',()=>{if(fieldDetails.open)observe(controller.getAnalysis());});
    function openField(){if(!observed)return;fieldDialog.showModal();observe(controller.getAnalysis());}
    function plot(c,r,fresh){
      if(c.type==='capacitor')return {box:'-72 -56 144 116',back:'',body:'',overlay:F.capacitorSection(r,root.CircuitAC.capacitorGap(c))};
      if(c.type==='generator')return {box:'-65 -49 130 100',back:'',body:fresh?G.render({...c,angle:0},r,true):'',overlay:F.generatorOverlay(c,r,G.project)};
      if(c.type==='inductor'){const f=F.inductor(c,r);return {box:'-80 -56 160 112',back:f.back,body:fresh?V.body({...c,angle:0},r,{view:'real',values:false,fields:false}):'',overlay:f.front+f.markers+'<text x="0" y="-49" text-anchor="middle" font-size="8" fill="#52677c">內部虛線表示被線圈遮擋的磁場</text>'};}
      return {box:'-85 -83 170 130',back:'',body:fresh?V.body({...c,angle:0},r,{view:'real',values:true,fields:false}):'',overlay:''};
    }
    function rows(c,r,analysis,doc){
      const current=(endpoint,value)=>V.displayCurrent(doc,analysis,endpoint,value);
      if(c.type==='generator')return [['phase','角度 θ',r.phase*180/Math.PI,'°'],['field','磁場 B',c.params.field,'T'],['flux','單匝 Φ',r.flux,'Wb'],['fluxLinkage','磁通鏈 NΦ',r.fluxLinkage,'Wb'],['sourceEmf','電動勢 e',r.sourceEmf,'V']];
      if(c.type==='capacitor')return [['voltage','電壓',r.voltage,'V'],['charge','電荷',r.charge,'C'],['energy','電場儲能',r.energy,'J']];
      if(c.type==='transformer'){const data=[['current','原線圈電流',current(c.id+':a',r.current),'A'],['secondaryCurrent','副線圈電流',current(c.id+':c',r.secondaryCurrent),'A'],['coreFlux','共同磁通',r.coreFlux,'Wb']];if(c.params.model==='coupled')data.push(['energy','耦合磁場儲能',r.energy,'J']);return data;}
      const shown=current(c.id+':a',r.current),data=[['current','線圈電流',shown,'A'],['energy','磁場儲能',r.energy,'J']];if(c.type==='transformer')data.push(['secondaryCurrent','副線圈電流',current(c.id+':c',r.secondaryCurrent),'A']);else {const emf=Number.isFinite(r.voltage)&&Number.isFinite(r.current)?-(r.voltage-c.params.resistance*r.current):null;data.unshift(['inductance','電感',c.params.inductance,'H']);data.push(['selfEmf','自感電動勢',shown===0&&Number.isFinite(emf)&&Math.abs(emf)<1e-6?0:emf,'V']);}return data;
    }
    function drawField(view,c,r,analysis,doc){
      r=V.displayComponent(doc,analysis,c,currentReferences?.());
      const key=JSON.stringify([c.id,c.type,c.params]),p=plot(c,r,view.key!==key);
      if(view.key!==key){view.key=key;view.host.innerHTML='<svg class="ac-field-diagram" viewBox="'+p.box+'" role="img" aria-label="'+({capacitor:'極板剖面及兩板間均勻電場',inductor:'線圈內外閉合磁場及兩極方向',generator:'永久磁場、線圈法線及磁通方向',transformer:'原副線圈及共同磁路'}[c.type])+'"><g data-field-back="true"></g><g data-field-body="true"></g><g data-field-overlay="true"></g></svg><dl class="ac-field-readouts"></dl><p class="ac-field-explanation"></p><p class="note">'+(c.type==='capacitor'?'場線在固定範圍內的疏密表示相對強弱。極板以剖面顯示。':c.type==='transformer'?'磁感線主要沿鐵芯閉合；疏密表示相對強弱，繞組匝數作示意。':'場線在固定範圍內的疏密表示相對強弱。繞組匝數作示意。')+'</p>';view.back=view.host.querySelector('[data-field-back]');view.body=view.host.querySelector('[data-field-body]');view.overlay=view.host.querySelector('[data-field-overlay]');view.explanation=view.host.querySelector('.ac-field-explanation');view.values=new Map();for(const [id,label]of rows(c,r,analysis,doc)){const dt=element('dt'),dd=element('dd');dt.innerHTML=Q.labelHtml(label);dd.dataset.fieldReadout=id;if(c.type==='generator')dd.dataset.generatorReadout=id;view.values.set(id,dd);view.host.querySelector('dl').append(dt,dd);}if(view===panelView){const open=button('放大觀察',openField);open.dataset.fieldOpen='true';view.host.append(open);}view.body.innerHTML=p.body;view.body.querySelector('[data-field-poles]')?.remove();view.model=view.body.querySelector('[data-generator-model]');}
      if(c.type==='generator'){G.update(view.model,{...c,angle:0},r,true);if(view.back.innerHTML!==p.back)view.back.innerHTML=p.back;view.overlay.innerHTML=p.overlay;}
      else {view.back.innerHTML=p.back;view.overlay.innerHTML=p.overlay;if(c.type==='transformer'){const slot=view.body.querySelector('[data-transformer-field-slot]');if(slot)slot.innerHTML=F.transformer(c,r);}}
      const explanation=F.description(c,r);if(view.explanationSource!==explanation){view.explanationSource=explanation;view.explanation.innerHTML=Q.prose(explanation);}
      for(const [id,label,value,unit]of rows(c,r,analysis,doc)){const html=['capacitor','inductor','generator','transformer'].includes(c.type)&&!['inductance','field'].includes(id)?readouts.html(c,id,value,unit,{paused:controller.getPlayback().paused,result:r,doc,label}):quantity(value,unit),el=view.values.get(id);if(el.innerHTML!==html)el.innerHTML=html;}
    }
    function observe(analysis){
      const doc=viewDocument?.()||controller.getDocument(),selection=controller.getInteraction().selection,c=doc.components.find(c=>c.id===selection?.id&&['generator','capacitor','inductor','transformer'].includes(c.type))||doc.components.find(c=>['generator','capacitor','inductor','transformer'].includes(c.type));observed=c?{c,doc}:null;
      fieldSummary.textContent=c?'觀察 '+c.label:'場的觀察';fieldTitle.textContent=c?c.label+' · 場的觀察':'場的觀察';
      if(!c){if(panelView.key||!fieldContent.textContent){fieldContent.textContent='選取電容、電感、變壓器或發電機以觀察場。';panelView.key=null;}if(fieldDialog.open)fieldDialog.close();return;}
      const r=analysis.components[c.id];if(!r)return;
      if(fieldDetails.open)drawField(panelView,c,r,analysis,doc);if(fieldDialog.open)drawField(largeView,c,r,analysis,doc);
    }
    if(profile.ui.help){const p=element('p','note');p.innerHTML=Q.prose('交流模型：電容電壓及電感電流有時間狀態。[[R]]／開關變更保留儲能；[[C]]／[[L]]／匝數及重新接線建立新實驗。理想空斷線圈、短接帶電電容可能沒有有限解。');refs.helpDialog.querySelector('.help-body')?.prepend(p);}
    function render(analysis){lastAnalysis=analysis;const playback=controller.getPlayback();refs.pause.disabled=playback.readOnly||!profile.simulation.play;refs.slowMotion.disabled=playback.readOnly||!profile.simulation.rate;notice.hidden=!analysis.diagnostics.length;notice.textContent=analysis.diagnostics.map(d=>d.message).join(' ');
      if(profile.ui.energy){const doc=viewDocument?.()||controller.getDocument(),shownEnergy=c=>V.displayComponent(doc,analysis,c,currentReferences?.())?.energy||0,electric=doc.components.filter(c=>c.type==='capacitor').reduce((s,c)=>s+shownEnergy(c),0),magnetic=doc.components.filter(c=>['inductor','transformer'].includes(c.type)).reduce((s,c)=>s+shownEnergy(c),0);energyScale=Math.max(energyScale,electric+magnetic,1e-12);energyContent.innerHTML=[['電場儲能',electric],['磁場儲能',magnetic]].map(([label,value])=>'<div class="ac-energy-row"><span>'+Q.labelHtml(label)+'</span><span>'+quantity(value,'J')+'</span><meter min="0" max="'+energyScale+'" value="'+V.displayEnergy(value)+'" aria-label="'+label+'"></meter></div>').join('')+'<p class="note">儲能條以已觀察最大儲能為量尺。'+(doc.components.some(c=>c.type==='transformer'&&c.params.model==='ideal')?'理想變壓器未計磁化儲能。':'')+'</p><p>累計耗散 '+quantity(analysis.dissipatedEnergy,'J')+'</p>';
      }
      if(profile.ui.field)observe(analysis);
      scope?.render();
    }
    function clear(){scope?.clear();energyScale=0;readouts.clear();}
    function animate(analysis=lastAnalysis){lastAnalysis=analysis;scope?.render();if(observed){const {c,doc}=observed,r=analysis.components[c.id];if(r){if(fieldDetails.open)drawField(panelView,c,r,analysis,doc);if(fieldDialog.open)drawField(largeView,c,r,analysis,doc);}}const playback=controller.getPlayback();fieldPlay.disabled=playback.readOnly||!profile.simulation.play;fieldPlay.textContent=playback.paused?'繼續模擬':'暫停模擬';}

    const originalLoaded=documentLoaded;
    render(lastAnalysis);
    return {render,preview:result=>scope?.preview(result),endPreview:commit=>scope?.endPreview(commit),animate,setChannels:channels=>scope?.setChannels(channels)??false,getTools:()=>scope?.getTools()||[],setTools:tools=>scope?.setTools(tools)??false,clear,documentLoaded(doc){readouts.clear();originalLoaded(doc);scope?.resetDocument();},destroy(){readouts.clear();abort.abort();if(fieldDialog.open)fieldDialog.close();fieldDialog.remove();scope?.destroy();host.classList.remove('ac-editor');}};
  }
  root.CircuitACUI={mount};
})(window);
