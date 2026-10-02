"use strict";
// Each entry is an explicit legal UI path or a production encode/decode/restore.
const centre=require("../sim/centre-of-mass-investigation-lab/generator.js");
const second=require("../sim/newtons-second-law-investigation-lab/test-support.js");
const click=(id,selectors,extra={})=>({id,prepare:selectors.map(s=>`click(${JSON.stringify(s)});`).join(""),...extra});
const submit=(check,button)=>[
  click("check",[check]),click("submitted",[check,button]),
  {id:"pending",prepare:`click(${JSON.stringify(check)});auditHost.__failFinal=true;click(${JSON.stringify(button)});`}
];
function orthogonal(index,phase) {
  return {id:`question-${index+1}-${phase}`,prepare:`
    const P=window.ForceOrthogonalDecompositionPersistence,M=window.ForceOrthogonalDecompositionModel;
    const s=P.freshDraft(),id=P.SCENARIO_IDS[${index}],scene=M.getScenario(id);s.currentQuestion=${index};
    let directions=[],perpendiculars=[],components=[];
    for(const axis of scene.axes){const r=M.commitDirection(M.add(scene.origin,M.scale(axis.unit,180)),directions,{scene});if(!r.accepted)throw new Error('direction fixture invalid');directions=r.directions;}
    for(const direction of directions){const r=M.commitPerpendicular(M.projectionFoot(scene.forceHead,direction,scene),directions,perpendiculars,{scene,bounds:P.WORLD_BOUNDS,minDistance:4});if(!r.accepted)throw new Error('perpendicular fixture invalid');perpendiculars=r.perpendiculars;}
    for(const intersection of M.visibleIntersections(perpendiculars,directions,scene)){const r=M.commitComponent(intersection.point,perpendiculars,directions,components,{scene,bounds:P.WORLD_BOUNDS,minDistance:4});if(!r.accepted)throw new Error('component fixture invalid');components=r.components;}
    const q={...M.createQuestionState(id),phase:${JSON.stringify(phase)},directions,perpendiculars,components,theta:M.thetaCandidates(directions,scene)[0].key};
    q.formulas=Object.fromEntries(M.formulaExpectations(q).map(e=>[e.key,e.value]));s.questions[${index}]=q;
    const encoded=P.encodeDraft(s);P.decodeDraft(encoded);return restore(P.ACTIVITY,encoded);
  `,continue:["#stageBackButton","#stageNextButton"],expect:`window.__forceOrthogonalApp.getState().phase===${JSON.stringify(phase)}`};
}
function composition(index) {
  return {id:`question-${index+1}-drawing`,prepare:`
    const app=window.__forceCompositionApp,M=window.ForceCompositionModel,P=window.ForceCompositionPersistence,s=app.getState(),q=app.getScenario().questions[${index}];s.currentQuestion=${index};s.phase='practice';let a=s.answers[${index}];
    for(let i=0;i<q.forces.length;i++)a=M.commitForceTranslation(a,i,M.endpointForKey(a,q,q.type==='parallelogram'||i===0?'ORIGIN':'F'+i+'_HEAD'),q);
    if(q.type==='parallelogram')for(const key of ['F1_HEAD','F2_HEAD'])a=M.commitGuide(a,key,M.endpointForKey(a,q,'CORNER'),q);
    if(!M.resultantAvailable(a,q))throw new Error('resultant prerequisites are not legal');s.answers[${index}]=a;const encoded=P.encodeDraft(s);P.decodeDraft(encoded);return restore(P.ACTIVITY,encoded);
  `,continue:["#drawResultant"],expect:"document.getElementById('stage').classList.contains('resultant-draw-ready')"};
}
function mirror(id,kinds,extra={}) {
  const prepare="click('[data-action=\"add\"][data-segment=\"incident\"]');const mirrorX=Number(document.querySelector('.mirror-face').getAttribute('x1'));for(let i=0;i<80;i++){const h=document.querySelector('#diagram circle[data-kind=incident]'),x=Number(h.getAttribute('cx'));if(Math.abs(x-mirrorX)<=16)break;h.dispatchEvent(new window.KeyboardEvent('keydown',{key:x<mirrorX?'ArrowRight':'ArrowLeft',bubbles:true}));}";
  return {id,settleMs:400,prepare:prepare+kinds.slice(1).map(k=>`click('[data-action="add"][data-segment="${k}"]');`).join(''),...extra};
}
function activityProfiles(slug) {
  if(slug==="newtons-third-law-fullscreen-test")slug="newtons-third-law-reaction-force-lab";
  const initial={id:"initial"};
  if(slug.startsWith("force-equilibrium"))return [initial,...Array.from({length:5},(_,i)=>click(`question-${i+1}`,[`#questionNav button:nth-child(${i+1})`])),...Array.from({length:5},(_,i)=>({id:`question-${i+1}-partial`,prepare:`click('#questionNav button:nth-child(${i+1})');click('[data-add-kind]:not(:disabled)');`,handoffTarget:".origin-hit:not([hidden])"})),...submit("#checkButton","#submitButton")];
  if(slug==="newtons-third-law-reaction-force-lab")return [initial,...Array.from({length:5},(_,i)=>click(`question-${i+1}`,[`#questionNav button:nth-child(${i+1})`])),...Array.from({length:5},(_,i)=>({id:`question-${i+1}-partial`,prepare:`click('#questionNav button:nth-child(${i+1})');click('#bodyChoices button:not(:disabled)');click('#anchorChoices button:not(:disabled)');`,handoffTarget:'.anchor-hit:not([hidden])'})),...submit("#checkButton","#submitButton")];
  if(slug==="newtons-second-law-investigation-lab") {
    const data=second.durableDraft(second.filled());
    const restored=(id,selectors)=>({...click(id,[],{continue:selectors}),prepare:`auditHost.__auditNextValues=${JSON.stringify(data)};window.location.reload();return {reload:true};`});
    return [initial,...[0,1].map(i=>click(`collect-${i}`,['[data-phase="collect"]',`[data-group="${i}"]`])),...[0,1,2].map(i=>({...restored(`plot-${i}`,[ '[data-phase="plot"]',`[data-graph="${i}"]`]),handoffTarget:'.plot-point-hit:not([hidden])'})),restored('conclude',['[data-phase="conclude"]']),...submit('#checkButton','#submitButton')];
  }
  if(slug==="force-orthogonal-decomposition")return [initial,...Array.from({length:3},(_,i)=>click(`question-${i+1}-directions`,[`#questionProgress button:nth-child(${i+1})`])),...[0,1,2].flatMap(i=>['perpendiculars','components','angle','formulas'].map(p=>orthogonal(i,p))),...submit('#goSummary','#submitAttempt')];
  if(slug==="force-composition-construction-lab")return [initial,...Array.from({length:5},(_,i)=>click(`question-${i+1}`,[`#questionProgress button:nth-child(${i+1})`])),...[0,1,2,3,4].map(composition),...submit('#goSummary','#submitAttempt').map(p=>({...p,prepare:p.prepare+(p.id==='check'?'':"click('#confirmSubmit');")}))];
  if(slug==="static-kinetic-friction-investigation-lab")return [initial,...['balance','experiment','analysis','predict','review'].map(p=>click(p,[`[data-phase-pill="${p}"]`],{expect:`window.__staticKineticFrictionApp.getState().phase===${JSON.stringify(p)}`})),{
    id:'analysis-recorded',
    prepare:`const P=window.StaticKineticFrictionPersistence,M=window.StaticKineticFrictionMeasurement;
      const samples=Array.from({length:301},(_,i)=>({timeS:i*.1,pullCN:i<50?i*12:500,velocityMMps:i<50?0:i<90?100:i<110?100+(i-90)*6:220}));
      const trial=M.packTrace({regularSamples:samples,breakaway:{timeMs:2000,measuredPullCN:600,measuredVelocityMMps:4,preBreakPeakGridIndex:19}});
      let state=P.transitions.setPhase(P.freshState(9),'experiment');state=P.transitions.acceptTrial(state,trial);
      const encoded=P.encodeDraft(state),snapshot={version:1,activity:${JSON.stringify(slug)},kind:'draft',answer:encoded};
      if(!P.decodeSnapshot(snapshot,window.StaticKineticFrictionGenerator.generateScenario({seed:9}),'draft'))throw new Error('Invalid friction trace fixture');
      return restore(${JSON.stringify(slug)},encoded);`,
    continue:['[data-phase-pill="analysis"]'],expect:'window.__staticKineticFrictionApp.getState().phase==="analysis"&&Boolean(window.__staticKineticFrictionApp.getState().trial)'
  }];
  if(slug==="linear-motion-velocity-lab") {
    const restored=(id,phase,captured=false)=>({id,prepare:`const P=window.LinearMotionPersistence,M=window.LinearMotionModel;let s=P.navigate(P.initialState(M.createAttempt(77123)),${JSON.stringify(phase)});${captured?"s=P.continueOnce(P.continueOnce(s));":""}const encoded=P.encode(s);if(!P.decode(encoded))throw new Error('Invalid linear fixture');return restore('linear-motion-velocity-lab',encoded);`,continue:['[data-progress="2"]',`[data-progress="${phase==='uniform'?0:phase==='variable'?1:3}"]`]});
    const instant={id:'instant',prepare:`click('[data-progress="2"]');`};
    return [initial,restored('uniform-captured','uniform',true),restored('variable','variable'),restored('variable-captured','variable',true),instant,{id:'instant-expanded',prepare:`click('[data-progress="2"]');for(let i=0;i<4;i++)click('#shorterWindowButton');`},restored('review','review')];
  }
  if(slug==="kinematics-driving-challenge") {
    const ready={id:'levels-unlocked',prepare:`const P=window.KinematicsDrivingPersistence,M=window.KinematicsDrivingModel,L=window.KinematicsDrivingLevels,s=P.initialState(),codes={level1:0,level2:2,level3:5,level4:2,level5:2};for(const level of L.LEVELS){let inputs=[],run=M.replay(level,inputs);while(!run.state.terminal){inputs.push(codes[level.id]);run=M.replay(level,inputs);}s.selectedRuns[level.id]={revision:1,codes:inputs};}s.phase='review';s.variant='complete';s.currentItem='review';s.graphCheckpoint={sourceLevelId:'level2',sourceRunRevision:1,viewedXt:true,viewedVt:true,answerId:'vt-linear'};const encoded=P.encode(s);P.decode(encoded);return restore('kinematics-driving-challenge',encoded);`};
    return [initial,...[1,2,3,4,5].map(i=>({...ready,id:`level-${i}`,continue:[`[data-pick-level="level${i}"]`]})),{...ready,id:'graph-check',continue:['[data-pick-checkpoint]']},{...ready,id:'check',continue:['[data-pick-review]']}];
  }
  if(slug==="centre-of-mass-investigation-lab") {
    const seeds=[];for(let i=1;seeds.length<3&&i<300;i++){const type=centre.generate(i).part3.type;if(!seeds.some(s=>centre.generate(s).part3.type===type)&&['sphere','cube','cuboid'].includes(type))seeds.push(i);}
    if(seeds.length<3)throw new Error('Missing sphere/cube/cuboid coverage');
    return [...[1,2,3].map(part=>({id:`part-${part}`,part})),...seeds.flatMap(seed=>['three','canvas'].flatMap(renderer=>[false,true].map(rotated=>({id:`solid-${centre.generate(seed).part3.type}-${renderer}-${rotated?'rotated':'initial'}`,part:3,renderer,prepare:`const P=window.CentreMassPersistence;let s=P.switchPart(P.initial(${seed}),3);${rotated?"s=P.setView(s,{yaw10:1200,pitch10:350});":""}const encoded=P.encode(s);P.decode(encoded);return restore('centre-of-mass-investigation-lab',encoded);`,continue:['[data-part-tab="1"]','[data-part-tab="3"]'],expect:`window.__centreMassDebug.getState().phase==='part3'&&window.__centreMassDebug.getState().seed===${seed}`,expectReady:`window.__centreMassDebug.renderer().mode===${JSON.stringify(renderer==='three'?'three':'fallback')}&&window.CentreMassGenerator.generate(window.__centreMassDebug.getState().seed).part3.type===${JSON.stringify(centre.generate(seed).part3.type)}`}))))];
  }
  if(slug==="fbd-horizontal-block")return [initial,click('partial',['[data-force="weight"][data-action="add"]']),click('submitted',['[data-force="weight"][data-action="add"]','#submitDiagram'])];
  if(slug==="plane-mirror-pencil-ray-diagram")return [initial,...['incident','reflected','extension'].map((kind,i)=>mirror(kind,['incident','reflected','extension'].slice(0,i+1),{ownedTarget:`#diagram circle[data-kind="${kind}"]`})),{...mirror('image',['incident'],{ownedTarget:'#diagram circle[data-image-handle="top"]'}),continue:['[data-image-choice="virtual"]']},click('submitted',['[data-action="add"][data-segment="incident"]','#submitDiagram'],{releasedTarget:'#diagram circle[data-kind="incident"]'}),{id:'pending',prepare:"click('[data-action=\"add\"][data-segment=\"incident\"]');auditHost.__failFinal=true;click('#submitDiagram');",releasedTarget:'#diagram circle[data-kind="incident"]'}];
  // The map's walking, arrows, cancellation and locked phases are independently
  // exercised by mobile-touch-browser-regression.js with production snapshots.
  return [initial];
}
function profiles(slug) {
  return activityProfiles(slug).map(profile => {
    const checkOnly=profile.id==='check'&&(slug.startsWith('force-equilibrium')||slug==='newtons-third-law-reaction-force-lab'||slug==='newtons-third-law-fullscreen-test'||slug==='newtons-second-law-investigation-lab');
    const conclude=slug==='newtons-second-law-investigation-lab'&&profile.id==='conclude';
    return {...profile,...(checkOnly||conclude?{noStageReason:'此正式 phase 使用全高控制面板；production layout 隱藏舞台，G1/G4 舞台手勢不適用。'}:{})};
  });
}
module.exports={profiles};
