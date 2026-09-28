(function(root,factory){const api=factory(typeof module==="object"&&module.exports?require("./notation.js"):root.ReactionNotation);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ReactionFeedback=api;})(typeof window!=="undefined"?window:globalThis,function(N){
  "use strict";
  // Called only for a trusted submitted result. These explain the failed
  // components without changing the rubric or the learner's saved answer.
  function explanations(q,index,record,result){
    const f=q.given.find(f=>f.id===q.targets[index]),expected=q.expected[index],recipient=q.bodies[expected[0]],anchor=recipient.anchors[expected[1]],original=q.bodies[0].name,messages=[];
    if(!result.body){
      if(q.family===3&&record[0]===2)messages.push("小球直接拉的是繩；固定架受到的是繩的拉力，屬於另一組相互作用。");
      else messages.push(`${record[0]===null?"尚未選受力物體":`你選了${q.bodies[record[0]].name}`}。反作用力應作用在${recipient.name}，與原力作用的${original}是不同物體。`);
    }
    if(result.body&&!result.placement){
      if(record[1]!==expected[1])messages.push(`應從${recipient.name}的${anchor.name}起筆；${q.family===4?"本題用地心表示地球所受的引力":"接觸力應畫在相互接觸的位置"}。`);
      else if(result.drawn)messages.push("起筆點正確，但作用線未對齊；這對相互作用力須位於同一直線上。");
    }
    if(!result.direction)messages.push(result.drawn?`已知力${N.direction(f.angle10)}；反作用力應${N.direction(expected[3])}，與原力方向相反。你畫的方向是${N.value(record[3]/10)}度。`:"尚未畫出箭頭；反作用力的方向須與已知力相反。");
    if(!result.magnitude)messages.push(`兩力大小應相等，反作用力應為${N.value(expected[4]/100)}牛頓${result.drawn?`；你畫的是${N.value(record[4]/100)}牛頓`:""}。`);
    if(!result.kind){
      if(f.id==="normal"&&record[2]===4)messages.push(`支持力的反作用力是${original}對${recipient.name}的壓力，兩者都屬接觸正向力，並非萬有引力。`);
      else messages.push(`${record[2]===null?"尚未標明力的種類":`你選了${N.shortNames[record[2]]}`}；這對力來自同一種相互作用，種類應為${N.shortNames[f.kind]}。`);
    }
    return messages;
  }
  return Object.freeze({explanations});
});
