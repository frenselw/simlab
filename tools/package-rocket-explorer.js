#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),AdmZip=require('adm-zip');
const root=path.resolve(__dirname,'..'),sim=path.join(root,'sim'),assets=require('../sim/rocket-side-booster-lab/assets.json');
function build(){
  if(assets.kind!=='standalone'||!assets.files.includes(assets.entry)||new Set(assets.files).size!==assets.files.length)throw Error('Invalid standalone asset manifest');
  const zip=new AdmZip();
  for(const name of assets.files){
    if(!/^[a-z0-9_./-]+$/i.test(name)||name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe asset path: '+name);
    const file=fs.realpathSync(path.join(sim,name));if(!file.startsWith(sim+path.sep)||!fs.statSync(file).isFile())throw Error('Invalid asset: '+name);zip.addFile(name,fs.readFileSync(file));
  }
  const html=fs.readFileSync(path.join(sim,assets.entry),'utf8');
  for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g))if(!ref.startsWith('#')&&!ref.startsWith('data:')&&!assets.files.includes(path.posix.normalize(path.posix.join(path.posix.dirname(assets.entry),ref))))throw Error('Undeclared HTML asset: '+ref);
  const directory=path.join(root,'output/packages');fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'rocket-explorer-standalone.zip');zip.writeZip(file);
  const names=new AdmZip(file).getEntries().map(e=>e.entryName).sort();if(JSON.stringify(names)!==JSON.stringify([...assets.files].sort())||names.includes('imsmanifest.xml'))throw Error('Standalone package mismatch');return file;
}
module.exports={assets,build};if(require.main===module)console.log(build());
