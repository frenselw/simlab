'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const cases = {
  startup:'editing', 'inline-editing':'editing', camera:'editing', presets:'editing',
  cableHandling:'editing', quickControls:'editing', relay:'editing', componentSnapping:'editing',
  activity:'editing', foundation:'editing', textbook:'editing', refinements:'editing', bends:'editing',
  teaching:'editing', discard:'editing', paletteDrag:'editing', wireGrip:'editing', rotation:'editing', settings:'editing',
  labels:'instruments', meterMath:'instruments', meterSnapping:'instruments', feedback:'instruments',
  flow:'instruments', flowScale:'instruments', flowDrag:'instruments', wireInspector:'instruments',
  wireResistance:'instruments', wireCurrent:'instruments', help:'instruments', microFlow:'instruments',
  componentFlow:'instruments', needle:'instruments', displayMirror:'instruments',
  interruptions:'interruptions', 'host-ownership':'hosts', 'fullscreen-policy':'hosts'
};
const groups = ['editing','instruments','interruptions','hosts'];
function parseCircuitSelection(args){
 const matches=key=>args.filter(a=>a.startsWith(key));
 const groupFlags=matches('--group='),entryFlags=matches('--entry=');
 if(groupFlags.length>1||entryFlags.length>1)throw Error('Duplicate circuit group/entry');
 const group=groupFlags[0]?.slice(8)||null,entryFlag=entryFlags[0];
 if(groupFlags.length&&!groups.includes(group))throw Error('Unknown circuit group');
 if(entryFlag&&!['--entry=source','--entry=package'].includes(entryFlag))throw Error('Unknown circuit entry');
 const fullRun=!args.some(a=>!a.startsWith('--entry=')&&!a.startsWith('--group='));
 if(group&&!fullRun)throw Error('Full groups cannot be combined with focused smoke flags');
 return {group,groupFlag:groupFlags[0],entryFlag,fullRun};
}
function createCoverage(group, modes, directory) {
  if (group && !groups.includes(group)) throw new Error('Unknown circuit group: ' + group);
  const entries = modes.flatMap(mode => Object.keys(cases).filter(id => !group || cases[id] === group)
    .map(id => ({id:mode + '/' + id, mode, case:id, group:cases[id], status:'pending'})));
  const byId = new Map(entries.map(e => [e.id,e]));
  const write = () => { if (directory) fs.writeFileSync(path.join(directory,'coverage.json'),JSON.stringify({group:group || 'all',entries},null,2)+'\n'); };
  const begin = (mode,id) => {
    if (group && cases[id] !== group) return false;
    const e = byId.get(mode+'/'+id);
    assert(e,'Unknown case or mode: '+mode+'/'+id);
    assert.equal(e.status,'pending','Case cannot execute twice: '+e.id);
    e.status='running';e.startedAt=new Date().toISOString();e.startedMs=performance.now(); write(); return true;
  };
  const end = (mode,id) => { const e=byId.get(mode+'/'+id);assert.equal(e?.status,'running');e.status='passed';e.completedAt=new Date().toISOString();e.durationMs=performance.now()-e.startedMs;delete e.startedMs;write(); };
  const run = async (mode,id,fn) => { if(begin(mode,id)){await fn();end(mode,id);} };
  const finish = () => { assert(entries.every(e=>e.status==='passed'),'Circuit group coverage is incomplete');write(); };
  const fail = error => { for(const e of entries)if(e.status!=='passed'){e.status=e.status==='running'?'failed':'not-run';e.error=String(error);}write(); };
  write();
  return {begin,end,run,finish,fail,entries,write};
}
module.exports = {cases,groups,createCoverage,parseCircuitSelection};
