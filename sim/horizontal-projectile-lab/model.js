(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../newtons-second-law-investigation-lab/fitting.js') : root.NewtonFitting);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProjectileModel = api;
})(typeof window === 'undefined' ? globalThis : window, function (F) {
  'use strict';
  const G = 9.8, H = 0.2, IDEAL = Math.sqrt(10 * G * H / 7), SPEED = 0.99 * IDEAL;
  const VIEWS = ['collect', 'measure', 'plot', 'speed'];
  const FORMULAS={
    time:[{id:'fall',tex:'t=\\sqrt{\\frac{2y}{g}}',calculate:(x,y)=>Math.sqrt(2*y/G)},{id:'half',tex:'t=\\sqrt{\\frac{y}{g}}',calculate:(x,y)=>Math.sqrt(y/G)},{id:'double',tex:'t=\\sqrt{\\frac{4y}{g}}',calculate:(x,y)=>Math.sqrt(4*y/G)},{id:'horizontal',tex:'t=\\sqrt{\\frac{2x}{g}}',calculate:x=>Math.sqrt(2*x/G)}],
    speed:[{id:'vertical',tex:'v_0=\\frac{y}{t}',calculate:(x,y,t)=>y/t},{id:'double',tex:'v_0=\\frac{2x}{t}',calculate:(x,y,t)=>2*x/t},{id:'horizontal',tex:'v_0=\\frac{x}{t}',calculate:(x,y,t)=>x/t},{id:'half',tex:'v_0=\\frac{x}{2t}',calculate:(x,y,t)=>x/(2*t)}]
  };
  const QUESTIONS = {
    horizontal: ['在只有重力作用的水平拋出模型下，水平方向屬於哪種運動？', [['uniform','勻速直線運動'],['accelerating','勻加速直線運動'],['decelerating','勻減速直線運動'],['insufficient','模型條件不足以判斷']]],
    hEvidence: ['哪種數據特徵可支持水平勻速模型？', [['quadratic-path','軌跡彎曲便足夠'],['linear-x-time','x–t 近似直線，斜率穩定'],['equal-y','相等時間的豎直位移相等'],['same-release-only','只要釋放位置相同便足夠']]],
    vertical: ['在相同理想模型下，豎直方向屬於哪種運動？', [['uniform','勻速直線運動'],['nonzero-initial-speed','具有向下初速度的勻加速運動'],['free-fall','由靜止開始的自由落體'],['insufficient','模型條件不足以判斷']]],
    vEvidence: ['哪種證據可支持由靜止開始的自由落體？', [['y-derived-time','用 y = ½gt² 反算 t，再驗證同一公式'],['curved-path-only','只有彎曲軌跡'],['equal-x-only','只有相等水平間距'],['quadratic-y-time-zero-initial','獨立計時的 y–t 二次項約為 g/2，一次項近零，且出口水平']]]
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const mean = values => values.reduce((average, value, i) => average + (value - average) / (i + 1), 0);
  function fresh(launchOffsetPpm=0) {
    return { schemaVersion:3, modelVersion:1, rubricVersion:3, launchOffsetPpm, rows:Array(6).fill(null), fit:{model:null,attempted:false}, trajectory:null,
      formulas:{time:null,speed:null}, meanV:null, phase:'edit', view:'collect', returnToCheck:false,
      setup:{depthMm:200,slot:0}, ruler:{axis:'x',zero:[0,0]} };
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
    // New readings are assessed to the nearest millimetre; a wrong zero never supplies that answer.
    for(let distance=0;values.length<4;distance+=3)for(const n of distance?[reading-distance,reading+distance]:[reading]){
      if(integer(n,0,1000)&&(ruler.zero[axis]===0||n!==actual))values.push(n);
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
  function drawLaunchOffset(random=Math.random){
    const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw new Error('Invalid random draw');
    return Math.floor(value*300001)-300000;
  }
  const observedOffset=(base,jitter)=>Math.round(base+(1+base/1000000)*jitter);
  const offsetBounds=state=>[-10000,10000].map(jitter=>observedOffset(state.launchOffsetPpm??0,jitter));
  const referenceSpeed=state=>velocity(state.schemaVersion===1?0:state.launchOffsetPpm??0);
  function practice(state,random=Math.random){
    if(state.phase!=='edit'||state.rows.some(Boolean))throw new Error('Practice needs an empty experiment');
    let s=clone(state);
    [50,150,300,450,650,800].forEach((depthMm,slot)=>{
      const ppm=observedOffset(s.launchOffsetPpm??0,drawOffset(random));s=change(s,{type:'record',slot,depthMm,ppm});
      const p=impact(depthMm,ppm);[p.x,p.y].forEach((n,axis)=>{s=change(s,{type:'read',slot,axis,value:Math.round(n)});});
    });
    s.view='plot';return s;
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
    let data = points(state).filter(Boolean).map(p=>p.map(n=>n/1000));
    if(state.schemaVersion===3){
      data=[[0,0],...data.filter(([x,y])=>x!==0||y!==0)];
      if(model==='inverse')return{ok:false,message:'原點的橫座標為零，反比例函數在此沒有定義，不適合這組資料。',n:data.length};
    }
    return F.fit(model === 'square' ? 'origin' : model, model === 'square' ? data.map(([x,y])=>[x*x,y]) : data);
  }
  function predict(state, result, x) { return F.predict(state.fit.model === 'square' ? 'origin' : state.fit.model, result.coefficients, state.fit.model === 'square' ? x*x : x); }
  function timeFit(state, axis) {
    const points = state.rows.filter(r=>r && r.read[axis] !== null).map(r=>[r.clockMs/1000,r.read[axis]/1000]);
    return F.fit(axis === 0 ? 'linear' : 'quadratic', points);
  }
  function points(state){return state.rows.map(r=>state.schemaVersion===1?r?.point??null:r&&!r.read.includes(null)?r.read.slice():null);}
  function calculations(state){
    if(state.schemaVersion===1)return state.calculations;
    const time=FORMULAS.time.find(f=>f.id===state.formulas.time),speed=FORMULAS.speed.find(f=>f.id===state.formulas.speed);
    return state.rows.map(r=>{
      if(!r||r.read.includes(null))return{t:null,v:null};
      const [x,y]=r.read.map(n=>n/1000),t=time?.calculate(x,y)??null,v=t>0&&speed?speed.calculate(x,y,t):null;
      return{t:Number.isFinite(t)?t:null,v:Number.isFinite(v)?v:null};
    });
  }
  function included(state) { return calculations(state).map((c,i)=>c.v === null ? null : i).filter(i=>i !== null); }
  function invalidateFit(s) { s.fit.attempted = false; }
  function change(state, action) {
    const s = clone(state), i = action.slot;
    if (s.phase !== 'edit'||s.schemaVersion!==3) throw new Error('Not editable');
    switch (action.type) {
      case 'setup': s.setup = {...s.setup,...action.value}; break;
      case 'record': {
        const [min,max]=offsetBounds(s);
        if (!integer(i,0,5) || !integer(action.depthMm,50,800) || action.depthMm%5 || !integer(action.ppm,min,max)) throw new Error('Invalid observation');
        if(heightConflict(s,action.depthMm,i)>=0)throw new Error('Observation heights must be at least 5 cm apart');
        s.meanV=null;
        s.rows[i] = {depthMm:action.depthMm,speedOffsetPpm:action.ppm,clockMs:impact(action.depthMm,action.ppm).clockMs,read:[null,null]};
        invalidateFit(s);
        const next = s.rows.findIndex(r=>r === null); if (next >= 0) s.setup.slot = next;
        break;
      }
      case 'read':
        if (!s.rows[i] || !integer(action.axis,0,1)) throw new Error('Missing observation');
        if (s.rows[i].read[action.axis] === action.value) return s;
        s.rows[i].read[action.axis] = action.value; s.meanV=null; invalidateFit(s);
        break;
      case 'model':
        if(action.value!==null&&!['linear','quadratic'].includes(action.value))throw new Error('Invalid fit model');
        s.fit.model = action.value; invalidateFit(s); break;
      case 'fit': s.fit.attempted = true; break;
      case 'formula':
        if(!FORMULAS[action.field]||(action.value!==null&&!FORMULAS[action.field].some(f=>f.id===action.value)))throw new Error('Invalid formula');
        if(s.formulas[action.field]===action.value)return s;
        s.formulas[action.field]=action.value;s.meanV=null;break;
      case 'answer':
        if (!['meanV','trajectory'].includes(action.field)) throw new Error('Invalid answer');
        s[action.field] = action.value; break;
      case 'practice': return practice(s);
      case 'ruler': s.ruler = clone(action.value); break;
      case 'clearPlot': s.fit={model:null,attempted:false}; s.trajectory=null; break;
      default: throw new Error('Unknown action');
    }
    return s;
  }
  return Object.freeze({G,H,IDEAL,SPEED,VIEWS,FORMULAS,QUESTIONS,clone,integer,mean,fresh,velocity,impact,rulerChoices,drawOffset,drawLaunchOffset,observedOffset,offsetBounds,referenceSpeed,practice,heightConflict,rulerSlot,snapRuler,rulerAligned,points,calculations,fit,predict,timeFit,included,change});
});
