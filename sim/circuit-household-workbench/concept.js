(function (root) {
  'use strict';
  const explanations = {
    all: ['一個家，幾條並聯的分路', '插座和電燈各自接在火線與零線之間。關掉電燈，插座仍可供電。'],
    L: ['火線 L：接到家電的開關', '火線接到插座的 L 孔，也接到電燈開關。開關和保險絲應切斷火線。'],
    N: ['零線 N：完成供電迴路', '家電的另一端接到零線，與火線一起形成完整迴路。零線不能代替地線。'],
    PE: ['地線 E：連到金屬外殼', '地孔經插頭連到金屬外殼。正常工作不用地線；外殼漏電時，它提供故障回路，配合保護器斷電。']
  };
  const wire = (role, d) => (role==='PE'?`<path data-line="PE" class="pe-band" d="${d}"/>`:'')+`<path data-line="${role}" d="${d}"/>`;
  const label = (x, y, text, extra = '') => `<text x="${x}" y="${y}" ${extra}>${text}</text>`;
  function socket(x, y) {
    return `<g data-open-socket role="button" tabindex="0" aria-label="放大看插座三孔" transform="translate(${x} ${y})"><rect class="socket-face" width="86" height="88" rx="9"/><rect class="hole" x="39" y="16" width="8" height="18"/><rect class="hole" x="17" y="53" width="16" height="7"/><rect class="hole" x="54" y="53" width="16" height="7"/>${label(43, 12, 'E', 'text-anchor="middle"')}${label(25, 78, 'N', 'text-anchor="middle"')}${label(62, 78, 'L', 'text-anchor="middle"')}</g>`;
  }
  function lamp(x, y, on) {
    return `<g class="lamp ${on ? 'on' : ''}" transform="translate(${x} ${y})"><ellipse class="lamp-light" cx="0" cy="28" rx="32" ry="18"/><path d="M-32 15Q-30-20 0-20Q30-20 32 15Z" fill="#719aa2" stroke="#365b65" stroke-width="2"/><ellipse cx="0" cy="15" rx="32" ry="7" fill="#d9e5e7"/><path d="M0-38V-20" stroke="#3b5560" stroke-width="3"/></g>`;
  }
  function kettle(x, y, on) {
    return `<g transform="translate(${x} ${y})" class="kettle ${on ? 'on' : ''}"><path d="M-19-24Q-27 0-27 27H29Q31 0 18-24Z" fill="#cfab58" stroke="#695638" stroke-width="2"/><path d="M21-18Q50-20 44 13Q40 25 30 20" fill="none" stroke="#49545c" stroke-width="7"/><path d="M-21-12L-39-19L-28 4" fill="#cfab58" stroke="#695638" stroke-width="2"/><ellipse cx="0" cy="-25" rx="20" ry="5" fill="#49545c"/><path d="M-28 29H31" stroke="#49545c" stroke-width="7"/><path class="steam" d="M-8-36Q-16-44-8-52M6-36Q14-44 6-52" fill="none" stroke="#7699a6" stroke-width="2"/></g>`;
  }
  function house(phone, state) {
    if (phone) return {
      box: '0 0 360 285',
      art: `<g class="supply"><circle cx="24" cy="41" r="14"/>${label(24,47,'~','text-anchor="middle"')}${label(24,76,'市電','text-anchor="middle"')}</g><g class="meter"><rect x="81" y="14" width="63" height="62" rx="7"/><rect x="91" y="23" width="43" height="19" rx="2"/>${label(112,37,'kWh','text-anchor="middle"')}${label(112,97,'電能表','text-anchor="middle"')}</g><g class="main-switch"><rect x="176" y="14" width="71" height="62" rx="7"/><rect x="198" y="33" width="27" height="23" rx="3"/>${label(211,97,'總開關','text-anchor="middle"')}</g>` +
        wire('L','M38 35H81M144 35H176M247 35H332V264M332 143H98V168M332 222H231M211 222H150') + wire('N','M38 56H81M144 56H176M247 56H307V280M307 184H61V168M307 263H150V233') + wire('PE','M260 110H282V190M282 110H79V131') +
        `<path class="ground" d="M260 110V129M250 129H270M254 135H266M258 141H262"/>${socket(36,112)}${label(79,223,'插座','text-anchor="middle"')}<path class="cord" d="M105 188Q124 211 146 177"/>${kettle(166,163,state.kettle)}${lamp(150,236,state.light)}<g data-light-switch role="button" tabindex="0" aria-label="切換電燈開關"><rect class="switch-hit" x="195" y="200" width="48" height="44" rx="6"/><path class="switch-contact" d="M211 222L231 ${state.switch ? 222 : 208}"/><circle class="contact" cx="211" cy="222" r="3"/><circle class="contact" cx="231" cy="222" r="3"/></g>${label(225,277,'燈的開關','text-anchor="middle"')}${label(345,40,'L')}${label(320,61,'N')}${label(291,106,'E')}`
    };
    return {
      box: '0 0 960 430',
      art: `<g class="supply"><circle cx="50" cy="154" r="28"/>${label(50,164,'~','text-anchor="middle"')}${label(50,207,'市電','text-anchor="middle"')}</g><g class="meter"><rect x="140" y="110" width="96" height="106" rx="9"/><rect x="155" y="127" width="66" height="31" rx="3"/>${label(188,149,'kWh','text-anchor="middle"')}${label(188,244,'電能表','text-anchor="middle"')}</g><g class="main-switch"><rect x="298" y="110" width="118" height="106" rx="9"/><rect x="337" y="141" width="39" height="37" rx="4"/>${label(357,244,'總開關','text-anchor="middle"')}</g>` +
        wire('L','M78 140H140M236 140H298M416 140H454V61H883M575 61V260M862 61V238H841M821 238H769V299') + wire('N','M78 171H140M236 171H298M416 171H474V89H883M538 89V260M882 89V322H791V299') + wire('PE','M491 117H883M556 117V229') +
        `<path class="ground" d="M491 117V160M477 160H505M482 167H500M487 174H495"/>${label(900,66,'L 火線')}${label(900,94,'N 零線')}${label(900,122,'E 地線')}${socket(513,204)}${label(556,318,'插座','text-anchor="middle"')}<path class="cord" d="M575 292Q592 369 641 364"/>${kettle(661,353,state.kettle)}${label(661,411,'水壺','text-anchor="middle"')}${lamp(780,321,state.light)}<g data-light-switch role="button" tabindex="0" aria-label="切換電燈開關"><rect class="switch-hit" x="808" y="216" width="47" height="44" rx="6"/><path class="switch-contact" d="M821 238L841 ${state.switch ? 238 : 222}"/><circle class="contact" cx="821" cy="238" r="3"/><circle class="contact" cx="841" cy="238" r="3"/></g>${label(865,242,'燈的開關')}`
    };
  }
  function closeup(state) {
    const art = `<g transform="translate(20 30) scale(1.5)">${socket(0,0)}</g>${label(84,22,'插座正面','text-anchor="middle"')}<rect class="metal-case" x="215" y="45" width="125" height="150" rx="15"/>` + wire('L','M113 114V236H270V125') + wire('N','M57.5 114V214H295V125') + wire('PE','M84.5 54V192H215V170') +
      `<rect class="plug-fuse" x="169" y="229" width="35" height="14" rx="3"/>${label(186,265,'插頭保險絲','text-anchor="middle"')}<path class="heater" d="M270 125V95L277 89L283 101L289 89L295 101V125"/>${label(277,75,'家電','text-anchor="middle"')}${label(277,177,'金屬外殼','text-anchor="middle"')}`+(state.fault?'<path class="fault-contact" d="M270 150H229V170H215"/><circle class="fault-mark" cx="215" cy="170" r="5"/>':'');
    return {box:'0 0 360 285',art};
  }
  function mount(editor, load) {
    const app=document.getElementById('concept-app'),advanced=document.getElementById('app');
    app.querySelector('header').insertAdjacentHTML('beforeend','<button data-advanced class="concept-teacher" aria-label="教師搭建工具" title="教師搭建工具">⋯</button>');
    app.insertAdjacentHTML('beforeend','<nav class="concept-lines" aria-label="選一條線"><button data-topic="L">L 火線</button><button data-topic="N">N 零線</button><button data-topic="PE">E 地線</button></nav><section class="concept-stage sim-stage"><div class="concept-drawing"></div><button class="concept-back" hidden>返回家居圖</button></section><section class="concept-notes sim-panel"><h2></h2><p class="concept-copy"></p><div class="concept-actions"><button data-fault hidden>試看外殼漏電</button><button data-normal hidden>還原正常</button></div><p class="concept-footnote">接線示意；家用交流電的方向會週期改變。</p></section>');
    const stage=app.querySelector('.concept-stage'),notes=app.querySelector('.concept-notes'),drawing=app.querySelector('.concept-drawing'),back=app.querySelector('.concept-back');
    let topic='all',view='house',mode='concept';
    function components(){const d=editor.getDocument();return {source:d.components.find(c=>c.type==='hh-source'),lamp:d.components.find(c=>c.label==='電燈'),kettle:d.components.find(c=>c.type==='hh-appliance'&&c.label!=='電燈'),sw:d.components.find(c=>c.label==='電燈開關'),protection:d.components.find(c=>c.type==='hh-rccb')};}
    function state(){const c=components(),a=editor.getAnalysis();return {mode,view,topic,source:c.source?.params.closed??false,switch:c.sw?.params.closed??false,light:(a.components[c.lamp?.id]?.power??0)>1,kettle:(a.components[c.kettle?.id]?.power??0)>1,fault:!!c.kettle&&c.kettle.params.fault!=='none',tripped:a.components[c.protection?.id]?.protection?.status==='tripped'};}
    function render(){
      if(mode!=='concept')return;const s=state(),phone=matchMedia('(max-width:600px)').matches,diagram=view==='house'?house(phone,s):closeup(s);
      drawing.innerHTML=`<svg viewBox="${diagram.box}" class="concept-diagram" data-topic="${topic}" role="img" aria-label="${view==='house'?'市電經電能表和總開關，火線零線連到並聯的插座和電燈，地線連到插座地孔':'插座正面三孔，L與N接家電，地線連金屬外殼，保險絲只在火線上'}">${diagram.art}</svg>`;
      const [heading,copy]=explanations[topic];notes.querySelector('h2').textContent=s.tripped?'外殼漏電，保護器斷開了回路':view==='socket'&&topic==='all'?'三個孔，三種作用':heading;
      notes.querySelector('.concept-copy').textContent=s.tripped?'火線碰到金屬外殼，故障電流經地線回源，保護器切斷供電。正常工作時，家電用的是 L 和 N。':view==='socket'&&topic==='all'?'面向插座：上方是地孔 E，左邊是 N，右邊是 L。插頭把它們接到家電；保險絲設在火線上。':topic==='all'&&!s.light&&s.kettle?'電燈關了，家電仍在工作。它們各有自己的供電分路，並不是一件接一件的串聯。':copy;
      back.hidden=view!=='socket';app.querySelector('[data-fault]').hidden=topic!=='PE'||s.tripped||view!=='socket';app.querySelector('[data-normal]').hidden=!s.tripped;
      for(const b of app.querySelectorAll('[data-topic]'))if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.topic===topic));
      for(const b of app.querySelectorAll('[data-fault],[data-normal]'))b.disabled=editor.getPlayback().readOnly;
    }
    function setMode(next){
      if(next==='concept'&&mode==='advanced'&&!load('concept','grouped',true))return false;
      editor.setPlayback({paused:true});mode=next;app.hidden=mode!=='concept';advanced.hidden=mode!=='advanced';stage.classList.toggle('sim-stage',mode==='concept');notes.classList.toggle('sim-panel',mode==='concept');if(mode==='concept')render();return true;
    }
    function activate(target){
      if(target.matches('[data-topic]'))topic=topic===target.dataset.topic?'all':target.dataset.topic;
      else if(target.matches('[data-open-socket]'))view='socket';
      else if(target.matches('.concept-back'))view='house';
      else if(target.matches('[data-advanced]')){setMode('advanced');return;}
      else if(target.matches('[data-light-switch]')){const c=components().sw;if(c)editor.execute({type:'setParam',id:c.id,key:'closed',value:!c.params.closed});}
      else if(target.matches('[data-fault]')){const c=components().kettle;if(c&&editor.execute({type:'setParam',id:c.id,key:'faultResistance',value:100})&&editor.execute({type:'setParam',id:c.id,key:'fault',value:'basic'}))editor.advanceTime(.05);}
      else if(target.matches('[data-normal]'))load('concept','grouped',false);
      render();
    }
    app.addEventListener('click',e=>{const target=e.target.closest('[data-topic],[data-open-socket],[data-light-switch],.concept-back,[data-fault],[data-normal],[data-advanced]');if(target)activate(target);});
    app.addEventListener('keydown',e=>{const target=e.target.closest('g[role=button]');if(target&&['Enter',' '].includes(e.key)){e.preventDefault();activate(target);}});
    advanced.querySelector('[data-hh-concept]').onclick=()=>setMode('concept');editor.onChange(render);editor.onAnalysis(render);window.addEventListener('resize',render);
    root.CircuitHouseholdConcept={mount,setMode,getState:state};render();
  }
  root.CircuitHouseholdConcept={mount};
})(window);
