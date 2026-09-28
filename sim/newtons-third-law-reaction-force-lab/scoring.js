(function(root,factory){const api=factory(typeof module==="object"&&module.exports?require("./generator.js"):root.ReactionGenerator,typeof module==="object"&&module.exports?require("./model.js"):root.ReactionModel);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ReactionScoring=api;})(typeof window!=="undefined"?window:globalThis,function(G,M){
  "use strict";
  const DIRECTION_TOLERANCE=10,MAGNITUDE_TOLERANCE=.1;
  function questionScore(answer,q){
    if(!M.validAnswer(answer,q))throw new Error("Invalid reaction answer");
    const detail=answer.map((r,i)=>{const e=q.expected[i],body=r[0]===e[0],kind=r[2]===e[2],drawn=r[3]!==null;
      const direction=drawn&&M.angleDelta(r[3]/10,e[3]/10)<=DIRECTION_TOLERANCE+1e-9;
      const parallel=drawn&&Math.min(M.angleDelta(r[3]/10,e[3]/10),M.angleDelta(r[3]/10,e[3]/10+180))<=DIRECTION_TOLERANCE+1e-9;
      const placement=body&&r[1]===e[1]&&parallel,magnitude=drawn&&Math.abs(r[4]-e[4])<=e[4]*MAGNITUDE_TOLERANCE+1e-9;
      const fraction=.45*body+.05*placement+.2*direction+.2*magnitude+.1*kind;
      return {body,placement,direction,magnitude,kind,drawn,fraction,score:20/q.targets.length*fraction};
    });
    return {family:q.family,score:detail.reduce((sum,d)=>sum+d.score,0),maxScore:20,detail};
  }
  function score(state){if(state.rubricVersion!==1||!Array.isArray(state.answers)||state.answers.length!==5)throw new Error("Unsupported rubric");const scene=G.generate(state.seed,state.generatorVersion),detail=scene.questions.map((q,i)=>questionScore(state.answers[i],q)),total=Math.round(detail.reduce((n,d)=>n+d.score,0)*1e8)/1e8;
    return {score:total,maxScore:100,passed:total>=60,completed:true,detail,feedback:"按受力物體、起點與作用線、方向、大小及力的種類評分。"};
  }
  return Object.freeze({score,questionScore,DIRECTION_TOLERANCE,MAGNITUDE_TOLERANCE});
});
