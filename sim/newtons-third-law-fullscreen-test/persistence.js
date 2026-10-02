(function(root,factory){const api=factory(typeof module==="object"&&module.exports?require("./generator.js"):root.ReactionGenerator,typeof module==="object"&&module.exports?require("./model.js"):root.ReactionModel);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ReactionPersistence=api;})(typeof window!=="undefined"?window:globalThis,function(G,M){
  "use strict";
  const ACTIVITY="newtons-third-law-fullscreen-test",MAX_BYTES=4000,keys=["schemaVersion","generatorVersion","rubricVersion","seed","phase","question","target","returnToCheck","answers"];
  const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
  function fresh(seed,generatorVersion=G.VERSION){const scene=G.generate(seed,generatorVersion);return {schemaVersion:1,generatorVersion,rubricVersion:1,seed,phase:"edit",question:scene.order[0],target:0,returnToCheck:false,answers:M.emptyAnswers()};}
  function validate(s,kind){
    if(!["draft","review"].includes(kind)||!s||Array.isArray(s)||Object.keys(s).length!==keys.length||!keys.every(k=>Object.hasOwn(s,k)))throw new Error("Invalid snapshot fields");
    if(s.schemaVersion!==1||!G.supportsVersion(s.generatorVersion)||s.rubricVersion!==1)throw new Error("Unsupported snapshot version");
    const scene=G.generate(s.seed,s.generatorVersion);
    if(!Array.isArray(s.answers)||s.answers.length!==5||!s.answers.every((a,i)=>M.validAnswer(a,scene.questions[i])))throw new Error("Invalid reaction records");
    if(!Number.isInteger(s.question)||s.question<0||s.question>4||!Number.isInteger(s.target)||s.target<0||s.target>=scene.questions[s.question].targets.length)throw new Error("Invalid selection");
    if(typeof s.returnToCheck!=="boolean"||(!["edit","check","review"].includes(s.phase))||(s.phase!=="edit"&&s.returnToCheck))throw new Error("Invalid phase continuation");
    if((kind==="review")!==(s.phase==="review"))throw new Error("Snapshot phase mismatch");
    if(bytes(s)>MAX_BYTES)throw new Error("Snapshot too large");return M.clone(s);
  }
  const draft=s=>validate(s,"draft"),review=s=>validate({...s,phase:"review",returnToCheck:false},"review");
  function decode(snapshot,kind){if(!snapshot||snapshot.version!==1||snapshot.activity!==ACTIVITY||snapshot.kind!==kind||bytes(snapshot)>MAX_BYTES)throw new Error("Invalid envelope");if(kind==="review"&&(!Number.isFinite(snapshot.score)||snapshot.score<0||snapshot.score>100||typeof snapshot.passed!=="boolean"))throw new Error("Invalid result metadata");return validate(snapshot.answer,kind);}
  const navigate=(s,question,target=0,fromCheck=false)=>draft({...s,phase:"edit",question,target,returnToCheck:fromCheck||s.returnToCheck});
  const check=s=>draft({...s,phase:"check",returnToCheck:false});
  return Object.freeze({ACTIVITY,MAX_BYTES,bytes,fresh,validate,draft,review,decode,navigate,check});
});
