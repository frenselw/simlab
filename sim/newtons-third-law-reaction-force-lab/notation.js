(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ReactionNotation=api;})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const names=["接觸正向力（支持力／壓力）","摩擦力","繩端拉力","彈力（彈簧接觸）","萬有引力"],shortNames=["接觸正向力","摩擦力","繩端拉力","彈簧接觸力","萬有引力"],symbols=["N","f","T","Fs","G"];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const value=n=>Number(n.toFixed(2)).toString(),html=s=>s==="Fs"?"<var>F</var><sub>s</sub>":`<var>${escape(s)}</var>`;
  function description(q,i){const f=q.given.find(f=>f.id===q.targets[i]);return `${f.source===-1?"地球":q.bodies[f.source].name}對${q.bodies[0].name}的${f.name.includes("對")?shortNames[f.kind]:f.name}`;}
  const reactionSymbol=(kind,given)=>kind===null?"F":kind===0&&given.symbol==="F"?"F":symbols[kind];
  function direction(angle10){const a=angle10/10,words=a===0?"向右":a===90?"向上":a===180?"向左":a===270?"向下":a<90?"向右上方":a<180?"向左上方":a<270?"向左下方":"向右下方";return `${words}，${value(a)}度`;}
  function sceneDescription(q){
    const side=q.params.mirror?"右":"左",layouts=[
      `斜面向${q.params.mirror?"左":"右"}上方升高，木塊位於斜面上。`,
      `木塊A在木塊B的${side}方，兩者相接觸，下方是光滑水平地面。`,
      `固定座與彈簧在小車的${side}方，小車下方是光滑水平軌道；彈簧已${q.params.stretched?"拉長":"壓縮"}。`,
      `輕繩上端連接固定架，下端連接小球；小球位於固定架${q.params.theta>0?"右下方":q.params.theta<0?"左下方":"正下方"}。`,
      `小球已離地，位於地球${q.params.angle<90?"右上方":q.params.angle>90?"左上方":"正上方"}；虛線連接地心與小球中心。`
    ];
    const given=q.given.map(f=>{const source=f.source===-1?"地球":q.bodies[f.source].name,label=f.kind===0?(f.symbol==="F"?"推力":"支持力"):shortNames[f.kind];return `${source}對${q.bodies[0].name}的${label}：${value(f.force100/100)}牛頓，${direction(f.angle10)}。`;}).join("");
    return `${layouts[q.family]}${q.motion}。角度從水平向右起，逆時針量度。已知力：${given}`;
  }
  return Object.freeze({names,shortNames,symbols,escape,value,html,description,reactionSymbol,direction,sceneDescription});
});
