(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ReactionNotation=api;})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const names=["接觸正向力（支持力／壓力）","摩擦力","繩端拉力","彈力（彈簧接觸）","萬有引力"],shortNames=["接觸正向力","摩擦力","繩端拉力","彈簧接觸力","萬有引力"],symbols=["N","f","T","Fs","G"];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const value=n=>Number(n.toFixed(2)).toString(),html=s=>s==="Fs"?"<var>F</var><sub>s</sub>":`<var>${escape(s)}</var>`;
  function description(q,i){const f=q.given.find(f=>f.id===q.targets[i]);return `${f.source===-1?"地球":q.bodies[f.source].name}對${q.bodies[0].name}的${f.name.includes("對")?shortNames[f.kind]:f.name}`;}
  return Object.freeze({names,shortNames,symbols,escape,value,html,description});
});
