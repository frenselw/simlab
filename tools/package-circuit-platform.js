#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{spawnSync}=require('node:child_process'),AdmZip=require('adm-zip'),{XMLParser}=require('fast-xml-parser');
const root=path.resolve(__dirname,'..'),core=require('../sim/circuit-workbench/runtime-assets.json');
const slugs=['circuit-dc-series-build','circuit-dc-rheostat-adjust'];
function syncAssets(){
  const teacherFiles=['index.html','styles.css','main.js','activity-profiles.js','activity-examples.html','activity-examples.css','activity-examples.js','assets.json'].map(f=>'circuit-workbench/'+f);
  const teacher=require('../sim/circuit-workbench/assets.json');teacher.files=[...core,...teacherFiles];
  const teacherPath=path.join(root,'sim/circuit-workbench/assets.json'),text=JSON.stringify(teacher,null,2)+'\n';if(fs.readFileSync(teacherPath,'utf8')!==text)fs.writeFileSync(teacherPath,text);
  const shell=['shared/scorm.js','shared/activity-flow.js',...['circuit-activity-data.js','circuit-activity-runtime.js','circuit-activity-page.js','circuit-activity.css'].map(f=>'circuit-workbench/'+f)];
  for(const slug of slugs){
    const file=path.join(root,'sim/manifests',slug+'.xml'),source=fs.readFileSync(file,'utf8');
    const files=[...core,...shell,...['index.html','styles.css','main.js','spec.js','scoring.js','persistence.js'].map(f=>slug+'/'+f)];
    assert.equal(new Set(files).size,files.length);
    const updated=source.replace(/\s*<file href="[^"]+"\/>/g,'').replace('</resource>',files.map(f=>'      <file href="'+f+'"/>').join('\n')+'\n</resource>');
    if(updated!==source)fs.writeFileSync(file,updated);
  }
}
function build(){
  syncAssets();
  const teacher=require('./package-circuit-workbench');
  for(const f of core)assert(teacher.assets.files.includes(f),'Teacher missing common asset '+f);
  const packages=[teacher.build()];
  for(const slug of slugs){
    const manifest=fs.readFileSync(path.join(root,'sim/manifests',slug+'.xml'),'utf8');
    const files=new XMLParser({ignoreAttributes:false}).parse(manifest).manifest.resources.resource.file.map(f=>f['@_href']);
    for(const f of core)assert(files.includes(f),'Activity missing common asset '+f);
    const run=spawnSync(process.execPath,['tools/package-scorm.js',slug],{cwd:root,encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr||run.stdout);packages.push(path.join(root,'output',slug+'-scorm.zip'));
  }
  for(const file of packages){const zip=new AdmZip(file);for(const asset of core)assert(zip.readFile(asset).equals(fs.readFileSync(path.join(root,'sim',asset))),'Stale shared source '+asset);
    for(const entry of zip.getEntries()){
      if(entry.entryName==='imsmanifest.xml')continue;
      assert(entry.getData().equals(fs.readFileSync(path.join(root,'sim',entry.entryName))),'Stale package file '+entry.entryName);
      if(!/\.(html|css)$/.test(entry.entryName))continue;
      const source=entry.getData().toString('utf8'),refs=entry.entryName.endsWith('.html')?[...source.matchAll(/(?:src|href)="([^"]+)"/g)]:[...source.matchAll(/@import\s+url\("([^"]+)"\)/g)];
      for(const ref of refs){if(ref[1].startsWith('data:')||ref[1].startsWith('#'))continue;const asset=path.posix.normalize(path.posix.join(path.posix.dirname(entry.entryName),ref[1]));assert(zip.getEntry(asset),'Undeclared package dependency '+asset);}
    }
  }
  const hash=data=>createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(path.join(root,'output/circuit-platform-build.json'),JSON.stringify({core:Object.fromEntries(core.map(f=>[f,hash(fs.readFileSync(path.join(root,'sim',f)))])),packages:packages.map(file=>({file:path.basename(file),files:new AdmZip(file).getEntries().length,sha256:hash(fs.readFileSync(file)),sharedFilesMatch:core.length}))},null,2)+'\n');
  return packages;
}
module.exports={build,syncAssets,slugs,core};
if(require.main===module)console.log(build().join('\n'));
