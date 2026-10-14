(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('../circuit-workbench/circuit-household'):root.CircuitHousehold,node?require('../circuit-workbench/circuit-document'):root.CircuitDocument);if(node)module.exports=api;else root.CircuitHouseholdPersistence=api;})(globalThis,function(H,D){
  'use strict';
  function encode(editor,experiment=true,scenarioId){if(!experiment)return D.encode(editor.getDocument());const snapshot=editor.captureSession();if(scenarioId!==undefined)snapshot.scenarioId=scenarioId;return H.encodeSession(snapshot);}
  function decode(text){if(typeof text!=='string'||D.bytes(text)>H.sessionByteLimit)throw new Error('家庭檔案超出 1 MiB');const data=JSON.parse(text);return data.kind==='simlab-household-session'?{experiment:H.validateSnapshot(data)}:{document:H.validate(D.decode(text))};}
  function restore(editor,text){const data=decode(text);if(data.experiment)editor.restoreSession(data.experiment);else editor.loadDocument(data.document);return data;}
  return {encode,decode,restore};
});
