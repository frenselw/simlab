(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('../circuit-workbench/circuit-ac-presets'):root.CircuitACPresets,node?require('../circuit-workbench/circuit-transient'):root.CircuitTransient,node?require('../circuit-workbench/circuit-profile'):root.CircuitProfile);if(node)module.exports=api;else root.CircuitACExampleState=api;})(globalThis,function(P,T,F){
 'use strict';
 const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
 function decode(input){const data=typeof input==='string'?JSON.parse(input):input;if(!data||Object.keys(data).sort().join(',')!=='example,model,parameters,physics,version'||data.version!==3||data.model!==1||!['transformer','lc'].includes(data.example)||bytes(data)>1500)throw new Error('示例快照無效');const config=P.examples(data.example),doc=config.initialDocument,params=data.parameters;if(!Array.isArray(params)||params.length!==(data.example==='transformer'?2:1))throw new Error('示例參數無效');
  if(data.example==='transformer'){doc.components.find(c=>c.type==='transformer').params.secondaryTurns=params[0];doc.components.find(c=>c.label==='負載電阻').params.resistance=params[1];}else doc.components.find(c=>c.type==='spdt').params.closed=params[0];
  F.compile(config).assertSnapshot(doc);return T.Session.restore({kind:'simlab-circuit-session',version:1,modelRevision:1,document:doc,physics:data.physics}).capture();
 }
 function encode(name,snapshot){const config=P.examples(name),valid=F.compile(config).assertSnapshot(snapshot.document),parameters=name==='transformer'?[valid.components.find(c=>c.type==='transformer').params.secondaryTurns,valid.components.find(c=>c.label==='負載電阻').params.resistance]:[valid.components.find(c=>c.type==='spdt').params.closed];const data={version:3,model:1,example:name,parameters,physics:snapshot.physics};decode(data);return JSON.stringify(data);}
 return {encode,decode,bytes};
});
