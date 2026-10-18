(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../newtons-second-law-investigation-lab/fitting.js') : root.NewtonFitting);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProjectileModel = api;
})(typeof window === 'undefined' ? globalThis : window, function (F) {
  'use strict';
  const G = 9.8, H = 0.2, IDEAL = Math.sqrt(10 * G * H / 7), SPEED = 0.99 * IDEAL;
  const VIEWS = ['collect', 'measure', 'plot', 'speed', 'motion'];
  const QUESTIONS = {
    horizontal: ['在只有重力作用的水平拋出模型下，水平方向屬於哪種運動？', [['uniform','勻速直線運動'],['accelerating','勻加速直線運動'],['decelerating','勻減速直線運動'],['insufficient','模型條件不足以判斷']]],
    hEvidence: ['哪種數據特徵可支持水平勻速模型？', [['quadratic-path','軌跡彎曲便足夠'],['linear-x-time','x–t 近似直線，斜率穩定'],['equal-y','相等時間的豎直位移相等'],['same-release-only','只要釋放位置相同便足夠']]],
    vertical: ['在相同理想模型下，豎直方向屬於哪種運動？', [['uniform','勻速直線運動'],['nonzero-initial-speed','具有向下初速度的勻加速運動'],['free-fall','由靜止開始的自由落體'],['insufficient','模型條件不足以判斷']]],
    vEvidence: ['哪種證據可支持由靜止開始的自由落體？', [['y-derived-time','用 y = ½gt² 反算 t，再驗證同一公式'],['curved-path-only','只有彎曲軌跡'],['equal-x-only','只有相等水平間距'],['quadratic-y-time-zero-initial','獨立計時的 y–t 二次項約為 g/2，一次項近零，且出口水平']]]
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const mean = values => values.reduce((average, value, i) => average + (value - average) / (i + 1), 0);
  function fresh() {
    return { schemaVersion:1, modelVersion:1, rubricVersion:1, rows:Array(6).fill(null), fit:{model:null,attempted:false}, trajectory:null,
      calculations:Array.from({length:6},()=>({t:null,v:null})), meanV:null, fitV:null, clockShown:false, gFromClock:null,
      conclusions:Object.fromEntries(Object.keys(QUESTIONS).map(k=>[k,null])), phase:'edit', view:'collect', returnToCheck:false,
      setup:{depthMm:200,slot:0}, selectedSlot:null, ruler:{axis:'x',zero:[0,0]}, connectPoints:false };
  }
  function velocity(ppm) { return SPEED * (1 + ppm / 1000000); }
  function impact(depthMm, ppm) {
    const t = Math.sqrt(2 * depthMm / 1000 / G), v = velocity(ppm);
    return {x:v*t*1000,y:depthMm,t,v,clockMs:Math.round(t*1000)};
  }
  function rulerChoices(row,ruler){
    if(!row)return[];
    const p=impact(row.depthMm,row.speedOffsetPpm),axis=ruler.axis==='x'?0:1;
    const actual=Math.round(axis?p.y:p.x),reading=Math.max(0,Math.min(1000,actual-ruler.zero[axis])),values=[];
    // A misplaced zero must not accidentally offer an answer inside the scoring tolerance.
    for(let distance=0;values.length<4;distance+=10)for(const n of distance?[reading-distance,reading+distance]:[reading]){
      if(integer(n,0,1000)&&(ruler.zero[axis]===0||Math.abs(n-actual)>5))values.push(n);
      if(values.length===4)break;
    }
    values.sort((a,b)=>a-b);
    const turn=Math.abs(Math.round(p.x)+row.depthMm+ruler.zero[0]+3*ruler.zero[1])%4;
    return values.slice(turn).concat(values.slice(0,turn));
  }
  function drawOffset(random = Math.random) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid random draw');
    return Math.floor(value * 20001) - 10000;
  }
  const heightConflict=(state,depthMm,slot)=>state.rows.findIndex((r,i)=>i!==slot&&r&&Math.abs(r.depthMm-depthMm)<50);
  function rulerSlot(rows,ruler,tolerance=0){
    const across=ruler.axis==='x'?1:0;let slot=null,distance=Infinity;
    rows.forEach((row,i)=>{if(!row)return;const p=impact(row.depthMm,row.speedOffsetPpm),d=Math.abs(Math.round(across?p.y:p.x)-ruler.zero[across]);if(d<=tolerance&&d<distance){slot=i;distance=d;}});
    return slot;
  }
  function snapRuler(state,raw,scale,threshold){
    const along=state.ruler.axis==='x'?0:1,result=raw.slice();
    if(Math.abs(raw[along])*scale<=threshold)result[along]=0;
    const slot=rulerSlot(state.rows,{axis:state.ruler.axis,zero:raw},threshold/scale),row=state.rows[slot];if(!row)return result;
    const mark=impact(row.depthMm,row.speedOffsetPpm),axis=1-along,target=Math.round(axis?mark.y:mark.x);
    if(Math.abs(target-raw[axis])*scale<=threshold)result[axis]=target;
    return result;
  }
  function rulerAligned(row,ruler){
    if(!row)return false;
    const mark=impact(row.depthMm,row.speedOffsetPpm),axis=ruler.axis==='x'?1:0;
    return ruler.zero[axis]===Math.round(axis?mark.y:mark.x);
  }
  function fit(state) {
    const model = state.fit.model;
    if (!model) return {ok:false,message:'先選擇擬合模型。',n:0};
    const points = state.rows.filter(r=>r?.point).map(r=>r.point.map(n=>n/1000));
    return F.fit(model === 'square' ? 'origin' : model, model === 'square' ? points.map(([x,y])=>[x*x,y]) : points);
  }
  function predict(state, result, x) { return F.predict(state.fit.model === 'square' ? 'origin' : state.fit.model, result.coefficients, state.fit.model === 'square' ? x*x : x); }
  function timeFit(state, axis) {
    const points = state.rows.filter(r=>r && r.read[axis] !== null).map(r=>[r.clockMs/1000,r.read[axis]/1000]);
    return F.fit(axis === 0 ? 'linear' : 'quadratic', points);
  }
  function included(state) { return state.calculations.map((c,i)=>c.v === null ? null : i).filter(i=>i !== null); }
  function clearCalculation(s, i) {
    if (s.calculations[i].v !== null) s.meanV = null;
    s.calculations[i] = {t:null,v:null};
  }
  function invalidateFit(s) { s.fit.attempted = false; s.fitV = null; }
  function change(state, action) {
    const s = clone(state), i = action.slot;
    if (s.phase !== 'edit') throw new Error('Not editable');
    switch (action.type) {
      case 'setup': s.setup = {...s.setup,...action.value}; break;
      case 'select': s.selectedSlot = i; break;
      case 'record': {
        if (!integer(i,0,5) || !integer(action.depthMm,50,800) || action.depthMm%5 || !integer(action.ppm,-10000,10000)) throw new Error('Invalid observation');
        if(heightConflict(s,action.depthMm,i)>=0)throw new Error('Observation heights must be at least 5 cm apart');
        clearCalculation(s,i);
        s.rows[i] = {depthMm:action.depthMm,speedOffsetPpm:action.ppm,clockMs:impact(action.depthMm,action.ppm).clockMs,read:[null,null],point:null};
        s.selectedSlot = i; invalidateFit(s); s.gFromClock = null;
        const next = s.rows.findIndex(r=>r === null); if (next >= 0) s.setup.slot = next;
        break;
      }
      case 'read':
        if (!s.rows[i] || !integer(action.axis,0,1)) throw new Error('Missing observation');
        if (s.rows[i].read[action.axis] === action.value) return s;
        s.rows[i].read[action.axis] = action.value; clearCalculation(s,i); invalidateFit(s);
        if (action.axis === 1) s.gFromClock = null;
        if (action.value === null) s.rows[i].point = null;
        break;
      case 'point':
        if (!s.rows[i] || s.rows[i].read.includes(null)) throw new Error('Missing readings');
        s.selectedSlot=i;
        if(JSON.stringify(s.rows[i].point)===JSON.stringify(action.value))break;
        s.rows[i].point=action.value;invalidateFit(s);break;
      case 'model': s.fit.model = action.value; invalidateFit(s); break;
      case 'fit': s.fit.attempted = true; break;
      case 'calculation':
        if (!s.rows[i] || s.rows[i].read.includes(null) || !['t','v'].includes(action.field)) throw new Error('Missing readings');
        if (s.calculations[i][action.field] === action.value) return s;
        if (action.field === 't') { if (s.calculations[i].v !== null) s.meanV=null; s.calculations[i].v=null; }
        else s.meanV=null;
        s.calculations[i][action.field] = action.value; break;
      case 'answer':
        if (!['meanV','fitV','gFromClock','trajectory'].includes(action.field)) throw new Error('Invalid answer');
        s[action.field] = action.value; break;
      case 'conclusion': if (!QUESTIONS[action.field]) throw new Error('Invalid conclusion'); s.conclusions[action.field] = action.value; break;
      case 'clock': s.clockShown = true; break;
      case 'ruler': s.ruler = clone(action.value); break;
      case 'connect': s.connectPoints = Boolean(action.value); break;
      case 'clearPlot': s.rows.forEach(r=>{if(r)r.point=null;}); s.fit={model:null,attempted:false}; s.fitV=null; s.trajectory=null; break;
      default: throw new Error('Unknown action');
    }
    return s;
  }
  return Object.freeze({G,H,IDEAL,SPEED,VIEWS,QUESTIONS,clone,integer,mean,fresh,velocity,impact,rulerChoices,drawOffset,heightConflict,rulerSlot,snapRuler,rulerAligned,fit,predict,timeFit,included,change});
});
