(function(root){
  'use strict';
  const C=root.CircuitHouseholdComponents,V=root.CircuitRenderer,Q=root.CircuitMath,P=root.CircuitHouseholdPresets;
  const abs=value=>Number.isFinite(value)?Math.abs(value):null;
  function mount({host,refs,controller}){
    const observation=document.createElement('output');observation.className='household-observation';observation.setAttribute('aria-live','polite');observation.dataset.householdObservation='true';refs.stage.insertBefore(observation,refs.canvasArea);
    refs.diagramLabels.replaceChildren();const legend=document.createElement('div');legend.className='household-legend';legend.innerHTML='<span><i></i>火線 L</span><span><i class="neutral"></i>零線 N</span><span><i class="earth"></i>地線 E</span>';refs.diagramLabels.append(legend);
    for(const strip of host.querySelectorAll('.scroll-strip'))strip.setAttribute('aria-label',(strip.classList.contains('left')?'左':'右')+'側捲頁區：上下滑動可捲動頁面');
    refs.canvasInstructions.textContent='拖線端接孔，或拖人的手到外殼。雙指移圖、捏合縮放；單指滑動空白及左右捲頁區可捲動外層頁面。桌面滾輪縮放，按空白鍵拖移。';
    refs.helpDialog.querySelector('.help-body').innerHTML='<section><h3>接線與觀察</h3><ol class="help-steps"><li><strong>拖線端接孔</strong><span>家電兩條線可以同接一孔，也可以接錯；放手後保留你的接法。</span></li><li><strong>選元件改條件</strong><span>可換家電種類、功率、故障或保護規格。點開關開合；跳掣後選保護器復位，熔絲需更換。</span></li><li><strong>拖人的手到外殼</strong><span>也可選「接觸對象」。比較站地上與站在絕緣椅上的回路。</span></li></ol></section><section><h3>三條線</h3><p>火線 L 和零線 N 供電；地線 E 在正確接線時連到金屬外殼，不承載正常工作電流。家電停止或能工作，都不能單憑這點判定接法正確。</p></section><section><h3>保護裝置</h3><p>斷路器和保險絲看電流是否超過額定值；漏電保護器比較流出與返回自身的電流，差流達 30 mA 才按延時切斷。</p></section><details class="help-more"><summary>操作及模型界限</summary><div class="household-model-note"><p>沿用 DC 工作台的取線、彎線、相機、復原、實物／符號及全螢幕。手機雙指移圖；精細接線或拖手時提供放大預覽。線身交叉不接通。</p><p>市電以 230 V、50 Hz 有效值及電阻等效表示；風扇／冷氣不計啟動及功率因數。往返箭嘴只示意交流，並非真實頻率動畫。</p><p>外殼受損絕緣取 2000 Ω，人體取 2000 Ω；地線為理想導體。過電流連續超額 2 s、差流達 30 mA 持續 0.10 s 才動作，均為教學延時。</p><p>理想地線不能代表任何實際接地都可靠；漏電保護器在電流發生後才動作，不能保證不受傷。絕緣椅忽略潮濕及其他接觸；雙重絕緣只演示內層破損、外層仍完整。此工作台用於概念探索。</p></div></details>';
    function reading(c,r,readings){
      if(c.type==='house-person')return readings([['人體電流',Math.abs(r.current||0)*1000,'mA'],['接觸外殼對地電壓',r.voltage,'V']]);
      if(C.isProtection(c))return readings([['通過電流',abs(r.current),'A'],...(c.type==='house-rcd'?[['漏電差流',r.residualCurrent*1000,'mA']]:[])])+`<p class="note" data-family-protection="${V.esc(c.id)}">${r.status==='tripped'?'已跳掣':r.status==='blown'?'已熔斷':r.status==='open'?'手動斷開':'合上'}${r.protection?.elapsed?' · 動作計時 '+r.protection.elapsed.toFixed(2)+' s':''}</p>`;
      if(C.isAppliance(c))return readings([['兩端電壓（有效值）',abs(r.voltage),'V'],['工作電流（有效值）',abs(r.current),'A'],['工作功率',r.power,'W'],['外殼對地電壓',r.casePotential,'V']]);
      if(c.type==='house-meter')return readings([['累積電能',r.energyKWh,'kWh'],['供出功率',r.power,'W']]);
      if(c.type==='house-earth')return '<p class="note">只接插座 E 孔，表示連回供電系統的地。</p>';
      if(c.type==='house-socket')return '<p class="note">正面：上 E、左 N、右 L；家電兩條線可接同一孔。</p>';
      if(c.type==='house-switch')return readings([['開關兩端電壓',abs(r.voltage),'V']])+`<p class="note">${r.role==='N'?'開關接在零線':r.role==='L'?'開關接在火線':'尚未接入 L／N 線路'}</p>`;
      return readings([['供電電壓（有效值）',r.voltage,'V'],['頻率',50,'Hz'],['供出電流',r.current,'A']]);
    }
    function properties(c,doc,parent,actions){
      const readonly=controller.getInteraction().readOnly,r=controller.getAnalysis().components[c.id];
      if(C.isProtection(c)&&['tripped','blown'].includes(r.status)){const button=document.createElement('button');button.type='button';button.className='text-action';button.dataset.householdReset=c.id;button.textContent=c.type==='house-fuse'?'更換保險絲':'復位';button.disabled=readonly;button.onclick=()=>controller.execute({type:'resetHouseholdProtection',id:c.id});actions.append(button);}
      if(c.type==='house-person'){const label=document.createElement('label'),span=document.createElement('span'),select=document.createElement('select');span.textContent='接觸對象';select.dataset.householdContact=c.id;select.append(new Option('離開外殼',''));for(const a of doc.components.filter(C.isAppliance))select.append(new Option(a.label,a.id));select.value=r.contact||'';select.disabled=readonly;select.onchange=()=>controller.execute({type:'setContact',id:c.id,target:select.value||null});label.append(span,select);parent.append(label);}
      if(C.isAppliance(c)){const note=document.createElement('p');note.className='note';note.dataset.householdConnections=c.id;note.textContent=Object.entries(r.connections).map(([expected,actual])=>`${expected.toUpperCase()} 引線：${actual?'接 '+actual:'未接到供電節點'}`).join('；');parent.append(note);}
    }
    function resultText(doc,result){
      const entries=Object.entries(result.components),trip=entries.find(([,r])=>['tripped','blown'].includes(r.status));
      if(doc.components.some(c=>c.type==='house-person'&&Math.abs(result.components[c.id].current)>1e-9))return '有電流經外殼、人體和地回到電源。';
      if(trip)return trip[1].protection.bodyCurrentBeforeTrip?'曾有電流通過人體，現已切斷。':trip[1].status==='blown'?'電流超額，保險絲已熔斷。':trip[1].protection.reason==='residual'?'回流繞過零線，漏電保護器已切斷。':'電流超額，斷路器已切斷。';
      const c=doc.components.find(c=>c.id==='load')||doc.components.find(C.isAppliance);if(!c)return doc.components.length?'接上兩條工作線，觀察回路。':'從工具箱取出元件和導線。';const r=result.components[c.id],a=r.connections.l,b=r.connections.n;
      if(a&&a===b&&Number.isFinite(r.voltage)&&abs(r.voltage)<1e-8){const live=['l','n'].some(k=>Math.abs(result.potentials[c.id+':'+k]||0)>25);return `同接${({L:'火線',N:'零線',E:'地線'})[a]}：電器不工作。${live?'引線仍對地帶電。':''}`;}
      if((a==='L'&&b==='E'||a==='E'&&b==='L'))return r.working?'電器可工作，但工作電流錯經地線回流。':'火線–地線接法，目前沒有工作電流。';
      if(a==='N'&&b==='L')return r.working?'火線與零線反接；能工作不代表接法正確。':'火線與零線反接；目前沒有工作電流。';
      if(a==='N'&&b==='E'||a==='E'&&b==='N')return r.working?'接零線與地線，本例仍有工作電流。':'零線與地線之間，本例不足以正常工作。';
      if(c.type==='house-metal'&&r.connections.e==='L')return Math.abs(r.casePotential||0)>25?'外殼引線接火線，完整外殼也已帶電。':'外殼引線接火線，供電時外殼可帶電。';
      if(c.type==='house-insulated'&&c.params.fault)return '內層破損，完整外層仍隔離可觸外表。';
      if(c.params.fault)return Math.abs(r.leakageCurrent)>1e-9?'受損絕緣有電流流向外殼。':Number.isFinite(r.casePotential)&&Math.abs(r.casePotential)>25?'外殼已帶電，尚沒有持續回流。':'已設定絕緣破損，結果取決於接線。';
      if(r.working)return c.type==='house-metal'&&!r.earthed?'電器正在工作，外殼尚未正確接地。':'兩條工作線之間有電壓，形成工作回路。';
      return '電器不工作，查看兩條線和開關。';
    }
    function render(doc,result){const key=refs.preset.value;const question=P.questions[key]||P.questions.empty;host.querySelector('.brand p').textContent=question;const message=resultText(doc,result);if(observation.textContent!==message)observation.textContent=message;observation.dataset.alert=String(doc.components.some(c=>c.type==='house-person'&&Math.abs(result.components[c.id].current)>1e-9));}
    return {readings:reading,properties,render,destroy(){observation.remove();}};
  }
  root.CircuitHouseholdUI=Object.freeze({mount});
})(window);
