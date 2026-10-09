(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./circuit-model') : root.CircuitModel,
    typeof module === 'object' && module.exports ? require('./component-registry') : root.CircuitRegistry);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CircuitProfile = api;
})(typeof window === 'undefined' ? globalThis : window, function (M, R) {
  'use strict';
  function same(a,b) {
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keysA=Object.keys(a),keysB=Object.keys(b);
    return keysA.length===keysB.length&&keysA.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
  }
  function freeze(value) { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }
  const paramLabel=(c,key)=>R.get(c.type).params[key].label||({model:'燈泡模型',closed:'開關狀態',polarity:'電源極性'})[key]||key;
  const ruleKeys = ['move', 'rotate', 'remove', 'label', 'switch', 'params', 'ranges'];
  const uiKeys = ['header', 'palette', 'inspector', 'readings', 'presets', 'files', 'settings', 'probe', 'viewToggle', 'help', 'wireList', 'status', 'quickParameters', 'wireCurrents', 'potentialDirections', 'playback','waveform','field','energy','phase'];
  const teacherPalette = [
    {type:'battery'}, {type:'resistor'}, {type:'rheostat'}, {type:'switch'},
    {type:'lamp', key:'lamp', params:{model:'ideal'}, label:'恆阻燈'},
    {type:'relay'}, {type:'ammeter'}, {type:'voltmeter'}, {type:'galvanometer'}, {type:'wattmeter'}
  ];
  function keys(value, allowed, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw new Error(name + '設定無效');
  }
  function rule(value = {}, type) {
    keys(value, ruleKeys, '元件權限');
    for (const [k,v] of Object.entries(value)) {
      if(k==='ranges'){keys(v,Object.keys(v||{}),'參數範圍');for(const [key,bounds]of Object.entries(v)){keys(bounds,['min','max','step'],'參數範圍');if(![bounds.min,bounds.max].every(Number.isFinite)||bounds.min>bounds.max||bounds.step!==undefined&&(!Number.isFinite(bounds.step)||bounds.step<=0))throw new Error('參數範圍數值無效');const specs=(type?[R.get(type)]:Object.values(R.definitions)).map(d=>d.params[key]).filter(s=>s&&!s.choices);if(!specs.length||!specs.some(s=>bounds.min>=s.min&&bounds.max<=s.max))throw new Error('參數範圍超出模型：'+key);}}
      else if (k === 'params') {
        if (v !== true && v !== false && (!Array.isArray(v) || new Set(v).size !== v.length || v.some(p => typeof p !== 'string' || (type ? !Object.hasOwn(R.get(type).params,p) : !Object.values(R.definitions).some(d=>Object.hasOwn(d.params,p)))))) throw new Error('可調參數設定無效');
      } else if (typeof v !== 'boolean') throw new Error('元件權限必須是布林值');
    }
    return M.clone(value);
  }
  function compile(config = {}) {
    keys(config, ['role','title','subtitle','initialDocument','palette','components','ui','wires','wireResistance','wirePointLimit','undo','check','idPrefix','analysis','simulation','observationChannels','panelContent'], '活動');
    const analysis=config.analysis??'dc';if(!['dc','transient'].includes(analysis))throw new Error('不支援的分析種類');
    const wirePointLimit=config.wirePointLimit??M.limits.stroke;
    if(!Number.isInteger(wirePointLimit)||wirePointLimit<1||wirePointLimit>M.limits.stroke)throw new Error('導線線形容量無效');
    const prepare=doc=>M.limitWirePoints(doc,wirePointLimit);
    const role = config.role || 'student';
    if (!['teacher','student'].includes(role)) throw new Error('活動角色無效');
    const teacher = role === 'teacher', initial = M.validate(config.initialDocument || M.empty(analysis));
    const assertModel=doc=>{if((doc.version===7)!==(analysis==='transient'))throw new Error('電路文件與分析種類不符');if(analysis==='transient'){const AC=typeof module==='object'&&module.exports?require('./circuit-ac-components'):globalThis.CircuitAC;if(!AC)throw new Error('缺少交流元件依賴');AC.toAC(doc);}};
    assertModel(initial);
    const components = config.components || {};
    keys(components, ['default','byType','byId'], '元件');
    const defaults = rule(components.default), byType = {}, byId = {};
    for (const [type,v] of Object.entries(components.byType || {})) { R.get(type); byType[type] = rule(v,type); }
    for (const [id,v] of Object.entries(components.byId || {})) {
      const c = initial.components.find(c => c.id === id);
      if (!c) throw new Error('權限指定了不存在的元件：' + id);
      byId[id] = rule(v,c.type);
    }
    const ui = Object.fromEntries(uiKeys.map(k => [k,teacher]));
    // A student can have a small inspector without exposing teacher controls.
    ui.header = true; ui.inspector = true; ui.viewToggle = true; ui.quickParameters = true;
    for(const k of ['waveform','field','energy','phase'])ui[k]=analysis==='transient'&&teacher;
    keys(config.ui || {}, uiKeys, '介面');
    for (const [k,v] of Object.entries(config.ui || {})) { if (typeof v !== 'boolean') throw new Error('介面設定必須是布林值'); ui[k] = v; }
    const simulation={play:ui.playback,step:ui.playback,rate:ui.playback,reset:teacher};keys(config.simulation||{},Object.keys(simulation),'時間控制');for(const [k,v]of Object.entries(config.simulation||{})){if(typeof v!=='boolean')throw new Error('時間權限必須為布林值');simulation[k]=v;}
    if(config.panelContent!==undefined&&config.panelContent?.nodeType!==1)throw new Error('活動面板需要 DOM element');
    const observationChannels=config.observationChannels??null;if(observationChannels!==null){if(!Array.isArray(observationChannels)||observationChannels.length>4)throw new Error('觀察通道設定無效');for(const c of observationChannels){keys(c,['id','quantity'],'觀察通道');if(!initial.components.some(x=>x.id===c.id)||!['voltage','current','charge','energy','flux'].includes(c.quantity))throw new Error('觀察通道設定無效');}if(new Set(observationChannels.map(c=>c.id+':'+c.quantity)).size!==observationChannels.length)throw new Error('觀察通道重複');}
    if (!teacher && (ui.settings || ui.files || ui.presets)) throw new Error('教師設定、文件與範例只適用於教師工作台');
    if (!ui.header && ['presets','files','settings','help'].some(k=>ui[k])) throw new Error('不顯示頂欄時，須關閉範例、文件、設定及說明');
    const wires = config.wires !== false, undo = config.undo !== false, wireResistance=config.wireResistance??teacher;
    if(config.wireResistance!==undefined&&typeof config.wireResistance!=='boolean')throw new Error('導線電阻權限必須是布林值');
    if (config.wires !== undefined && typeof config.wires !== 'boolean' || config.undo !== undefined && typeof config.undo !== 'boolean') throw new Error('操作設定無效');
    const paletteConfig = config.palette || (teacher ? teacherPalette : []);
    if (!Array.isArray(paletteConfig)) throw new Error('工具箱設定無效');
    const palette = paletteConfig.map((entry,i) => {
      keys(entry,['type','key','label','params','limit'],'工具箱元件');
      const definition = R.get(entry.type), params = {...R.defaults(entry.type),...entry.params};
      const sample = M.empty(analysis); M.add(sample,entry.type,0,0,params); M.validate(sample);assertModel(sample);
      const limit = entry.limit ?? M.limits.components;
      if (!Number.isInteger(limit) || limit < 1 || limit > M.limits.components) throw new Error('元件庫存設定無效');
      const key = entry.key || entry.type;
      if (typeof key !== 'string' || !key || paletteConfig.some((p,j) => j < i && (p.key || p.type) === key)) throw new Error('工具箱 key 必須唯一');
      return {type:entry.type,key,label:entry.label || definition.name,params,limit};
    });
    if (config.check !== undefined && typeof config.check !== 'function') throw new Error('check 必須是本地函數');
    const getRule = c => ({move:false,rotate:false,remove:false,label:false,switch:false,params:false,...defaults,...byType[c.type],...byId[c.id],ranges:{...defaults.ranges,...byType[c.type]?.ranges,...byId[c.id]?.ranges}});
    function parameterSpec(c,key){const base=R.get(c.type).params[key];if(!getRule(c).ranges[key])return base;const range={...defaults.ranges?.[key],...byType[c.type]?.ranges?.[key],...byId[c.id]?.ranges?.[key]};if(!base||base.choices||range.min<base.min||range.max>base.max)throw new Error('參數範圍超出模型：'+key);const spec={...base,...range};delete spec.controlMax;delete spec.controlSpecial;return spec;}
    function assertRanges(c){for(const key of Object.keys(getRule(c).ranges)){const spec=parameterSpec(c,key),value=c.params[key];if(!Number.isFinite(value)||value<spec.min||value>spec.max)throw new Error(c.label+'：'+paramLabel(c,key)+'超出活動設定範圍。');}}
    for(const entry of palette)assertRanges({id:'palette',type:entry.type,params:entry.params,label:entry.label});
    const mutable = (r,k,c={locked:false,editable:false}) => {
      const declared=r.params===true||Array.isArray(r.params)&&r.params.includes(k);
      if(teacher)return declared||k==='closed'&&r.switch;
      return (k==='closed'?!!r.switch:declared)&&M.permission(initial,c,k==='closed'?'switch':'params');
    };
    if (!teacher) for (let i=0;i<palette.length;i++) for (const b of palette.slice(i+1)) {
      const a=palette[i]; if(a.type!==b.type)continue;
      const candidates=[{rule:{...defaults,...byType[a.type]}},...initial.components.filter(c=>c.type===a.type).map(c=>({params:c.params,rule:getRule(c),component:c}))];
      if(candidates.some(c=>Object.keys(a.params).every(k=>mutable(c.rule,k,c.component)||same(a.params[k],b.params[k])&&(!c.params||same(c.params[k],a.params[k]))))) throw new Error('工具箱款式的庫存有歧義：'+a.key+' / '+b.key+'；請以不可調參數區分');
    }
    function allows(doc,c,operation,param,readOnly=false) {
      if (readOnly || !c) return false;
      if (teacher) return M.permission(doc,c,operation === 'label' ? 'params' : operation);
      const r = getRule(c);
      if (operation === 'params') return (r.params === true || Array.isArray(r.params) && (param ? r.params.includes(param) : r.params.length > 0)) && M.permission(doc,c,'params');
      return !!r[operation] && M.permission(doc,c,operation === 'label' ? 'params' : operation);
    }
    function matches(c,entry) {
      if (c.type !== entry.type) return false;
      const r = getRule(c);
      return Object.keys(entry.params).every(k => mutable(r,k,c) || same(c.params[k],entry.params[k]));
    }
    function entryFor(c) { return palette.find(p => matches(c,p)); }
    function count(doc,entry) { return doc.components.filter(c => entryFor(c)?.key === entry.key).length; }
    function canAdd(entry,doc,readOnly=false) { return !readOnly && doc.policy.mode === 'free' && count(doc,entry) < entry.limit; }
    const canSetWireResistance=(doc,readOnly=false)=>wireResistance&&wires&&!readOnly&&(doc.policy.mode==='free'||doc.policy.allowParams);
    function assertSnapshot(input) {
      const doc = M.validate(input);
      assertModel(doc);doc.components.forEach(assertRanges);
      if(doc.wires.some(w=>w.via.length>wirePointLimit))throw new Error('導線線形超出活動容量');
      if (!wires && (!same(doc.wires,initial.wires) || !same(doc.junctions,initial.junctions))) throw new Error('活動不允許改接線');
      if (teacher) return doc;
      if (!same(doc.policy,initial.policy) || !same(doc.cables,initial.cables)) throw new Error('活動的操作規則與導線庫存不能更改');
      if(!canSetWireResistance(doc))for(const w of doc.wires){const old=initial.wires.find(x=>x.id===w.id);if(w.resistance!==(old?.resistance??initial.cables.resistance))throw new Error('導線電阻已固定');}
      const fixedDisplay = M.clone(initial.display), restoredDisplay = M.clone(doc.display);
      if (ui.viewToggle) { delete fixedDisplay.view; delete restoredDisplay.view; }
      if (ui.probe) { delete fixedDisplay.reference; delete restoredDisplay.reference; }
      if (!same(fixedDisplay,restoredDisplay)) throw new Error('活動顯示設定已固定');
      const originals = new Map(initial.components.map(c => [c.id,c]));
      for (const c of initial.components) if (!doc.components.some(n => n.id === c.id) && !allows(initial,c,'remove')) throw new Error('不能移除指定元件：' + c.label);
      for (const c of doc.components) {
        const old = originals.get(c.id), r = getRule(c);
        if (old) {
          if (old.type !== c.type) throw new Error('不能替換指定元件');
          if (!allows(initial,old,'move') && (old.x !== c.x || old.y !== c.y)) throw new Error('元件位置已固定：' + c.label);
          if (!allows(initial,old,'rotate') && (old.angle !== c.angle || old.mirrored !== c.mirrored)) throw new Error('元件方向已固定：' + c.label);
          if (!allows(initial,old,'label') && old.label !== c.label) throw new Error('元件名稱已固定');
          for (const k of Object.keys(old.params)) if (!allows(initial,old,k==='closed'?'switch':'params',k) && !same(old.params[k],c.params[k])) throw new Error('參數已固定：' + paramLabel(c,k));
          if (c.locked !== old.locked || c.editable !== old.editable) throw new Error('元件權限不能更改');
        } else {
          if (doc.policy.mode !== 'free' || !entryFor(c) || c.locked || c.editable) throw new Error('活動未提供這種元件或參數');
          if (!allows(doc,c,'label') && c.label !== R.get(c.type).name) throw new Error('元件名稱已固定');
        }
      }
      for (const entry of palette) if (count(doc,entry) > entry.limit) throw new Error('元件已超出庫存：' + entry.label);
      for (const w of doc.wires) if (w.length > Math.max(initial.cables.length,initial.wires.find(x => x.id === w.id)?.length || 0)) throw new Error('導線超出活動長度');
      return doc;
    }
    function assertTransition(before,after,readOnly=false) {
      const doc = assertSnapshot(after);
      if (same(before,doc)) return doc;
      if (readOnly) throw new Error('目前為只讀，不能修改電路');
      if(!canSetWireResistance(before)){
        for(const w of doc.wires){const old=before.wires.find(x=>x.id===w.id);if(w.resistance!==(old?.resistance??before.cables.resistance))throw new Error('導線電阻已固定');}
        if(doc.cables.resistance!==before.cables.resistance)throw new Error('新導線電阻已固定');
      }
      const old = new Map(before.components.map(c => [c.id,c]));
      for (const c of before.components) if (!doc.components.some(n => n.id === c.id) && !allows(before,c,'remove')) throw new Error('不能刪除此元件');
      for (const c of doc.components) {
        const previous = old.get(c.id);
        if (!previous) {
          const entry = entryFor(c);
          if ((!entry && !teacher) || !(entry ? canAdd(entry,before) : before.policy.mode === 'free')) throw new Error('活動未提供此元件或庫存已用完');
          continue;
        }
        if (previous.type !== c.type) throw new Error('不能替換元件型別');
        for (const [op,changed] of [['move',previous.x!==c.x || previous.y!==c.y],['rotate',previous.angle!==c.angle || previous.mirrored!==c.mirrored],['label',previous.label!==c.label]]) if (changed && !allows(before,previous,op)) throw new Error('此操作未開放：' + {move:'搬動元件',rotate:'旋轉元件',label:'改名'}[op]);
        for(const key of Object.keys(R.get(c.type).params))if(parameterSpec(c,key).controlMax&&previous.params[key]!==c.params[key]&&c.params[key]>parameterSpec(c,key).controlMax&&c.params[key]!==parameterSpec(c,key).controlSpecial)throw new Error(parameterSpec(c,key).label+'只可設 0.1–2 Hz 或 50 Hz。');
        for (const k of Object.keys(c.params)) if (!same(previous.params[k],c.params[k]) && !allows(before,previous,k === 'closed' ? 'switch' : 'params',k)) throw new Error('參數未開放：' + paramLabel(c,k));
      }
      if (!wires && (!same(before.wires,doc.wires) || !same(before.junctions,doc.junctions))) throw new Error('活動不允許改接線');
      if (!teacher) {
        const displayBefore = M.clone(before.display), displayAfter = M.clone(doc.display);
        if (ui.viewToggle) { delete displayBefore.view; delete displayAfter.view; }
        if (ui.probe) { delete displayBefore.reference; delete displayAfter.reference; }
        if (!same(displayBefore,displayAfter)) throw new Error('活動顯示設定已固定');
      }
      return doc;
    }
    // Validate the author configuration too; restrictions remain outside saved answers.
    assertSnapshot(initial);
    return Object.freeze({role,analysis,simulation:Object.freeze(simulation),observationChannels:observationChannels===null?null:freeze(M.clone(observationChannels)),panelContent:config.panelContent,initial:freeze(M.clone(initial)),ui:Object.freeze(ui),palette:freeze(palette),undo,wires,
      title:config.title || (teacher ? '電路工作台' : '電路活動'),subtitle:config.subtitle || '',
      allows,canAdd,count,canSetWireResistance,parameterSpec,prepare,wirePointLimit,assertSnapshot,assertTransition,check:config.check});
  }
  return {compile};
});
