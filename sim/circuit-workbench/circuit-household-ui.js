(function(root){
  'use strict';
  const C=root.CircuitHouseholdComponents,V=root.CircuitRenderer,Q=root.CircuitMath;
  const abs=value=>Number.isFinite(value)?Math.abs(value):null;
  function mount({host,refs,controller}){
    const fanAngles=new Map(),louverPhases=new Map(),blowerAngles=new Map(),shockPhases=new Map(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');let fans=[],louvers=[],blowers=[],people=[];
    function animate(result,elapsed){
      for(const {id,node,flow}of people){
        const shocked=Math.abs(result.components[id]?.current||0)>=.001,phase=shocked?((shockPhases.get(id)||0)+(reducedMotion.matches?0:elapsed*2*Math.PI))%(2*Math.PI):0;
        shockPhases.set(id,phase);node.setAttribute('transform','skewX('+(reducedMotion.matches?0:1.8*Math.sin(phase*4)).toFixed(3)+')');if(flow)flow.setAttribute('stroke-dashoffset',(-8*Math.sin(phase)).toFixed(3));
      }
      for(const {id,node}of fans){const previous=fanAngles.get(id)||0,angle=(previous+(result.components[id]?.working?elapsed*(node.hasAttribute('data-house-washer-drum')?36:240):0))%360;fanAngles.set(id,angle);const transform='rotate('+angle.toFixed(3)+')';if(node.getAttribute('transform')!==transform)node.setAttribute('transform',transform);}
      for(const {id,node}of louvers){const phase=((louverPhases.get(id)||0)+(result.components[id]?.working?elapsed*Math.PI/3:0))%(2*Math.PI);louverPhases.set(id,phase);const transform='translate(0 14) scale(1 '+(.65+.3*Math.sin(phase)).toFixed(4)+') translate(0 -14)';if(node.getAttribute('transform')!==transform)node.setAttribute('transform',transform);}
      for(const {id,node,fins}of blowers){const angle=((blowerAngles.get(id)||0)+(result.components[id]?.working?elapsed*240:0))%360;blowerAngles.set(id,angle);if(node.dataset.angle===angle.toFixed(3))continue;node.dataset.angle=angle.toFixed(3);fins.forEach((fin,n)=>{const phase=angle*Math.PI/180+n*2*Math.PI/fins.length,y=-15+7*Math.sin(phase);fin.setAttribute('d','M-13 '+y+'Q12 '+(y-Math.cos(phase))+' 37 '+y);fin.setAttribute('opacity',String(.3+.7*Math.max(0,Math.cos(phase))));});}
    }
    const observation=document.createElement('output');observation.className='household-observation';observation.setAttribute('aria-live','polite');observation.dataset.householdObservation='true';refs.stage.insertBefore(observation,refs.canvasArea);
    const legend=document.createElement('div');legend.className='household-legend';legend.innerHTML='<span><i></i>火線 L</span><span><i class="neutral"></i>零線 N</span><span><i class="earth"></i>地線 E</span>';refs.diagramLabels.append(legend);
    const settings=document.createElement('section');settings.className='settings-section';settings.innerHTML='<h3>家庭供電與標示</h3><label>供電電壓<select data-household-setting="supplyVoltage"><option value="220">220 V</option><option value="230">230 V</option></select></label><label class="check"><input type="checkbox" data-household-setting="terminalLabels">顯示接線標示 L／N／E</label><label class="check"><input type="checkbox" data-household-setting="showSupplyVoltage">顯示市電電壓</label><p class="note">家電標示功率以 230 V 額定；改為 220 V 時，按相同電阻計算電流及功率。</p>';host.querySelector('[data-circuit-id="settingsDialog"] .settings-grid')?.prepend(settings);
    for(const input of settings.querySelectorAll('[data-household-setting]'))input.onchange=()=>controller.execute({type:'setHouseholdSetting',key:input.dataset.householdSetting,value:input.type==='checkbox'?input.checked:Number(input.value)});
    refs.canvasInstructions.textContent='雙手可接普通導線，亦可拖到端子、插座孔及接地點直接接觸；只有直接接觸會在移開時斷開。雙指移圖、捏合縮放；單指滑動空白及左右底角捲頁把手可捲動外層頁面。桌面滾輪縮放，按空白鍵拖移。';
    refs.helpDialog.querySelector('.help-body').innerHTML='<section><h3>接線與觀察</h3><ol class="help-steps"><li><strong>拖線端接孔</strong><span>兩條工作線可同接一孔，錯接亦會保留；線身交叉不接通。</span></li><li><strong>選元件改條件</strong><span>可換家電種類（額定功率隨種類設定）、故障或保護規格。按斷路器／漏電保護器把手開合、復位；按外框只選取。故障未排除會再次跳掣；熔斷後須更換保險絲。</span></li><li><strong>連接人體</strong><span>雙手可用導線接線，或拖到端子直接接觸；直接接觸移開便斷開。右手亦可接觸外殼，或用「右手接觸對象」選擇。</span></li></ol></section><section><h3>三條線</h3><p>火線 L 和零線 N 供電；地線 E 在正確接線時連到金屬外殼，不承載正常工作電流。能工作或已停止，都不能單憑這點判定接法正確。</p></section><section><h3>保護裝置</h3><p>斷路器和保險絲按過流程度及持續時間動作；漏電保護器比較流出與返回自身的電流。本模型差流達 30 mA 持續 0.10 s 才切斷。若雙手接同一保護器下游的 L／N、電流全經 N 返回，且無其他漏電，就不會因這條人體支路產生差流。</p></section><details class="help-more"><summary>操作及模型界限</summary><div class="household-model-note"><p>雙指移圖、捏合縮放；精細接線或拖手時有放大預覽。已接導線不會因移開手而斷開，須拔線。「人體觸電：三種接觸比較」可比較站姿及接法；絕緣椅只斷開腳的路徑，不能隔開雙手回路。短路修復後須手動復位，切斷前讀數會保留。</p><p>以 220／230 V、50 Hz 有效值及電阻等效求解。導線電流為有效值；電勢方向及顏色是等效參考電勢，並非 50 Hz 瞬時分布。風扇／冷氣不計啟動及功率因數；往返箭頭只作示意。</p><p>外殼受損絕緣取 2000 Ω，每手至身體、身體至地各取 1000 Ω，單手至地或雙手之間等效 2000 Ω。供電等效電阻為 0.05 Ω；每條外接導線，以及電表、閉合開關、保護器及拖板的導通通道取 0.001 Ω，與畫布線長無關。一般過流連續超額 2 s 動作；達額定值 5 倍時 0.02 s 快速切斷，均為教學等效。</p><p>地線仍有壓降；本模型不判定實際接地是否可靠。漏電保護器不能保證不受傷。絕緣椅忽略潮濕及其他接觸；雙重絕緣只演示內層破損、外層完整。人體電流達 1 mA 才顯示表情、橙色路徑及顫動；暫停保留狀態，減少動態效果會停用顫動。顯示門檻不代表安全界線或實際傷害程度。</p></div></details>';
    function reading(c,r,readings){
      if(c.type==='house-person')return readings([['人體電流',Math.abs(r.current||0)*1000,'mA'],['雙手之間電壓',abs(r.handVoltage),'V'],['流向地面的電流',abs(r.groundCurrent)*1000,'mA']]);
      if(C.isProtection(c))return readings([['目前通過電流',abs(r.current),'A'],...(c.type==='house-rcd'?[['漏電差流',r.residualCurrent*1000,'mA']]:[]),...(Number.isFinite(r.protection?.currentBeforeTrip)?[['切斷前電流',r.protection.currentBeforeTrip,'A'],...(c.type==='house-rcd'?[['切斷前漏電差流',r.protection.residualBeforeTrip*1000,'mA']]:[])]:[])])+`<p class="note" data-family-protection="${V.esc(c.id)}">${r.status==='tripped'?'已跳掣':r.status==='blown'?'已熔斷':r.status==='open'?'手動斷開':'合上'}${r.protection?.elapsed?' · 動作計時 '+r.protection.elapsed.toFixed(2)+' s':''}</p>`;
      if(C.isAppliance(c))return readings([['兩端電壓（有效值）',abs(r.voltage),'V'],['工作電流（有效值）',abs(r.current),'A'],['工作功率',r.power,'W'],['外殼對地電壓',r.casePotential,'V']]);
      if(c.type==='house-meter')return readings([['累積電能',r.energyKWh,'kWh'],['供出功率',r.power,'W']]);
      if(c.type==='house-earth')return '<p class="note">拖普通導線到 E 接線點，表示連回供電系統的地。</p>';
      if(c.type==='house-socket')return '<p class="note">正面：上 E、左 N、右 L；家電兩條線可接同一孔。</p>';
      if(c.type==='house-power-strip')return readings([['總電流（有效值）',abs(r.current),'A']])+'<p class="note">拖白色插頭到插座，三腳一同接通；拖開便拔出。三個插位同名端子並聯，白色電源線內藏 L／N／E。插頭可用方向鍵移動、Shift 微調及 Enter 吸附。</p>';
      if(c.type==='house-switch')return readings([['開關兩端電壓',abs(r.voltage),'V']])+`<p class="note">${r.sourceRoles.length>1?'開關兩端接到不同或混接的線別：'+r.sourceRoles.join('／'):r.role==='N'?'開關接在零線':r.role==='L'?'開關接在火線':r.role==='E'?'開關接在地線':'尚未接入 L／N 線路'}</p>`;
      return readings([['供電電壓（有效值）',r.voltage,'V'],['頻率',50,'Hz'],['供出電流',r.current,'A']]);
    }
    function protectionAction(c,r,actions){
      let button=actions.querySelector('[data-household-reset]');
      const closed=refs.properties.querySelector('[data-param="closed"]');
      if(c&&C.isProtection(c)&&closed){
        let trip=closed.querySelector('[value="tripped"]');
        if(r.status==='tripped'){
          if(!trip){trip=new Option('跳掣（已斷開）','tripped');trip.disabled=true;closed.append(trip);}
          closed.value='tripped';
        }else{trip?.remove();closed.value=String(c.params.closed);}
      }
      if(!c||!C.isProtection(c)||!['tripped','blown'].includes(r.status)){button?.remove();return;}
      if(!button){button=document.createElement('button');button.type='button';button.className='text-action';button.dataset.householdReset=c.id;button.textContent=c.type==='house-fuse'?'更換保險絲':'復位並合上';button.onclick=()=>controller.execute({type:'resetHouseholdProtection',id:c.id});actions.append(button);}
      button.disabled=controller.getInteraction().readOnly;
    }
    function properties(c,doc,parent,actions){
      const readonly=controller.getInteraction().readOnly,r=controller.getAnalysis().components[c.id];
      protectionAction(c,r,actions);
      if(c.type==='house-metal'&&c.params.kind==='aircon'){const note=document.createElement('p');note.className='note';note.dataset.householdMetalParts=c.id;note.textContent='塑膠外罩不導電；地線接內部金屬機架。本例「接觸外殼」代表碰到導電金屬部位。';parent.append(note);}
      const closed=parent.querySelector('[data-param="closed"]');
      if(C.isProtection(c)&&closed){
        const change=closed.onchange;
        closed.onchange=()=>closed.value==='true'&&controller.getAnalysis().components[c.id].status==='tripped'?controller.execute({type:'resetHouseholdProtection',id:c.id}):change();
      }
      if(c.type==='house-person'){const label=document.createElement('label'),span=document.createElement('span'),select=document.createElement('select');span.textContent='右手接觸對象';select.dataset.householdContact=c.id;select.append(new Option('離開外殼',''));for(const a of doc.components.filter(C.isAppliance))select.append(new Option(a.label,a.id));select.value=r.contact||'';select.disabled=readonly;select.onchange=()=>controller.execute({type:'setContact',id:c.id,target:select.value||null});label.append(span,select);parent.append(label);}
      if(C.isAppliance(c)){const note=document.createElement('p');note.className='note';note.dataset.householdConnections=c.id;note.textContent=Object.entries(r.connectionSources).map(([expected,sources])=>`${expected.toUpperCase()} 引線：${sources.length>1?'混接 '+sources.join('／'):sources.length?'接 '+sources[0]:'未接到供電節點'}`).join('；');parent.append(note);}
    }
    function resultText(doc,result){
      const entries=Object.entries(result.components),trip=entries.find(([,r])=>['tripped','blown'].includes(r.status));
      const acrossHands=doc.components.find(c=>c.type==='house-person'&&Math.abs(result.components[c.id].current)>=.001&&result.components[c.id].handCurrents.right*result.components[c.id].handCurrents.left< -1e-18);
      if(acrossHands)return acrossHands.params.stance==='insulated'?'電流經雙手和身體形成回路，站在絕緣椅上仍會觸電。':'電流經雙手和身體形成回路。';
      if(doc.components.some(c=>c.type==='house-person'&&Math.abs(result.components[c.id].current)>=.001))return doc.components.some(c=>c.type==='house-person'&&(result.components[c.id].contact||Object.values(result.components[c.id].caseContacts).some(Boolean))&&Math.abs(result.components[c.id].current)>=.001)?'有電流經外殼、人體和地回到電源。':'有電流經導線、人體和地回到電源。';
      if(result.shortCircuit)return '目前仍有短路：低電阻路徑繞過用電器，查看供電電流及各支路。'+(trip?'「'+doc.components.find(c=>c.id===trip[0]).label+'」已'+(trip[1].status==='blown'?'熔斷':'跳掣')+'，但未切斷目前的短路。':'');
      if(trip){const r=trip[1],current=r.protection.currentBeforeTrip;if(r.protection.reason==='short-circuit'&&!r.protection.bodyCurrentBeforeTrip)return (r.status==='blown'?'短路令保險絲熔斷':'短路令斷路器跳掣')+'；切斷前 '+Q.quantity(current,'A').text+'。';const message=r.protection.bodyCurrentBeforeTrip?'曾有電流通過人體，現已切斷。':r.protection.reason==='short-circuit'?'短路，'+(r.status==='blown'?'保險絲已熔斷。':'斷路器已切斷。'):r.status==='blown'?'電流超額，保險絲已熔斷。':r.protection.reason==='residual'?'回流繞過零線，漏電保護器已切斷。':'電流超額，斷路器已切斷。';return message+(Number.isFinite(current)?'切斷前 '+Q.quantity(current,'A').text+'。':'');}
      const c=doc.components.find(c=>c.id==='load')||doc.components.find(C.isAppliance);if(!c)return doc.components.length?'接上兩條工作線，觀察回路。':'從工具箱取出元件和導線。';const r=result.components[c.id],a=r.connections.l,b=r.connections.n;
      if(Object.values(r.connectionSources).some(sources=>sources.length>1))return '引線混接不同線別，查看各引線的接線。'+(c.type==='house-metal'&&!r.earthed?'外殼尚未正確接地。':'');
      if(a&&a===b&&Number.isFinite(r.voltage)&&abs(r.voltage)<1e-8){const live=['l','n'].some(k=>Math.abs(result.potentials[c.id+':'+k]||0)>25);return `同接${({L:'火線',N:'零線',E:'地線'})[a]}：電器不工作。${live?'引線仍對地帶電。':''}`;}
      if((a==='L'&&b==='E'||a==='E'&&b==='L'))return r.working?'電器可工作，但工作電流錯經地線回流。':'火線–地線接法，目前沒有工作電流。';
      if(a==='N'&&b==='L')return r.working?'火線與零線反接；能工作不代表接法正確。':'火線與零線反接；目前沒有工作電流。';
      if(a==='N'&&b==='E'||a==='E'&&b==='N')return r.working?'接零線與地線，本例仍有工作電流。':'零線與地線之間，本例不足以正常工作。';
      if(c.type==='house-metal'&&r.connections.e==='L')return Math.abs(r.casePotential||0)>25?'外殼引線接火線，完整外殼也已帶電。':'外殼引線接火線，供電時外殼可帶電。';
      if(c.type==='house-insulated'&&c.params.fault)return '內層破損，完整外層仍隔離可觸外表。';
      if(c.params.fault)return Math.abs(r.leakageCurrent)>1e-9?'受損絕緣有電流流向外殼。':Number.isFinite(r.casePotential)&&Math.abs(r.casePotential)>25?'外殼已帶電，尚沒有持續回流。':'已設定絕緣破損，結果取決於接線。';
      const loads=doc.components.filter(C.isAppliance);if(loads.length>1){const working=loads.filter(c=>result.components[c.id].working).length,total=loads.reduce((sum,c)=>sum+(result.components[c.id].power||0),0),message=working===loads.length?loads.length+' 件用電器都在工作。':working?working+' 件仍在工作；其餘用電器已停止。':'各用電器均已停止，查看各支路的接線。';return message+'總功率約 '+Math.round(total)+' W。';}
      if(r.working)return c.type==='house-metal'&&!r.earthed?'電器正在工作，外殼尚未正確接地。':'兩條工作線之間有電壓，形成工作回路。';
      return '電器不工作，查看兩條線和開關。';
    }
    function render(doc,result){legend.hidden=doc.display.potential||doc.display.roleColours===false;const message=resultText(doc,result);if(observation.textContent!==message)observation.textContent=message;observation.dataset.alert=String(doc.components.some(c=>c.type==='house-person'&&Math.abs(result.components[c.id].current)>1e-9));
      for(const input of settings.querySelectorAll('[data-household-setting]')){const key=input.dataset.householdSetting;if(input.type==='checkbox')input.checked=doc.display[key];else input.value=String(doc.supplyVoltage);input.disabled=controller.getInteraction().readOnly;}
      const selected=doc.components.find(c=>c.id===controller.getInteraction().selection?.id);protectionAction(selected,result.components[selected?.id],refs.objectActions);
      const ids=new Set(doc.components.filter(c=>C.isAppliance(c)&&['fan','washer','dryer','blender','vacuum'].includes(c.params.kind)).map(c=>c.id));for(const id of fanAngles.keys())if(!ids.has(id))fanAngles.delete(id);
      const aircons=new Set(doc.components.filter(c=>C.isAppliance(c)&&c.params.kind==='aircon').map(c=>c.id));for(const id of louverPhases.keys())if(!aircons.has(id))louverPhases.delete(id);
      for(const id of blowerAngles.keys())if(!aircons.has(id))blowerAngles.delete(id);
      const personIds=new Set(doc.components.filter(c=>c.type==='house-person').map(c=>c.id));for(const id of shockPhases.keys())if(!personIds.has(id)||Math.abs(result.components[id].current)<.001)shockPhases.delete(id);
      people=Array.from(refs.scene.querySelectorAll('[data-house-person-reaction]'),node=>({id:node.closest('[data-component]').dataset.component,node,flow:node.closest('[data-component]').querySelector('[data-house-body-flow]')}));
      fans=Array.from(refs.scene.querySelectorAll('[data-house-fan-rotor], [data-house-rotor]'),node=>({id:node.closest('[data-component]').dataset.component,node}));
      louvers=Array.from(refs.scene.querySelectorAll('[data-house-aircon-louver]'),node=>({id:node.closest('[data-component]').dataset.component,node}));
      blowers=Array.from(refs.scene.querySelectorAll('[data-house-aircon-rotor]'),node=>({id:node.closest('[data-component]').dataset.component,node,fins:Array.from(node.querySelectorAll('[data-house-aircon-fin]'))}));animate(result,0);
    }
    return {readings:reading,properties,render,animate,destroy(){fans=[];louvers=[];blowers=[];people=[];shockPhases.clear();fanAngles.clear();louverPhases.clear();blowerAngles.clear();observation.remove();settings.remove();}};
  }
  root.CircuitHouseholdUI=Object.freeze({mount});
})(window);
