'use strict';
const fs=require('node:fs'),path=require('node:path'),AdmZip=require('adm-zip');
function client({token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY,fetchImpl=fetch}={}){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo||''))throw Error('Invalid GitHub repository identity');
 const request=async route=>{
  for(let attempt=0;attempt<2;attempt++){
   const response=await fetchImpl('https://api.github.com/repos/'+repo+'/'+route,{
    headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{})},
    signal:AbortSignal.timeout(30000)
   });
   if(response.ok)return response;
   if(attempt===0&&[502,503,504].includes(response.status)){
    console.warn('GitHub read temporarily failed: '+route+' ('+response.status+'); retrying once');
    await new Promise(resolve=>setTimeout(resolve,1000));continue;
   }
   throw Error('GitHub request failed: '+route+' ('+response.status+')');
  }
 };
 const json=async route=>(await request(route)).json();
 const pages=async(route,key)=>{
  const output=[];
  for(let page=1;page<=20;page++){
   const data=await json(route+(route.includes('?')?'&':'?')+'per_page=100&page='+page);
   if(!Array.isArray(data[key]))throw Error('Invalid GitHub collection: '+key);
   output.push(...data[key]);
   if(data[key].length<100)return output;
  }
  throw Error('GitHub result exceeded supported pagination');
 };
 const artifactFiles=async artifact=>{
  if(artifact.expired)throw Error('Artifact expired: '+artifact.id);
  const response=await request('actions/artifacts/'+artifact.id+'/zip');
  const zip=new AdmZip(Buffer.from(await response.arrayBuffer()));
  return new Map(zip.getEntries().filter(e=>!e.isDirectory).map(e=>[e.entryName,e.getData()]));
 };
 const artifactJSON=async(artifact,basename)=>{
  const matches=[...(await artifactFiles(artifact))].filter(([name])=>path.posix.basename(name)===basename);
  if(matches.length!==1)throw Error('Artifact must contain exactly one '+basename);
  return JSON.parse(matches[0][1].toString('utf8'));
 };
 const saveEvidence=(files,directory)=>{
  fs.mkdirSync(directory,{recursive:true});
  for(const [name,data]of files){
   const target=path.resolve(directory,name);
   if(!target.startsWith(path.resolve(directory)+path.sep))throw Error('Artifact path escaped its destination');
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);
  }
 };
 return {json,pages,artifactFiles,artifactJSON,saveEvidence};
}
module.exports={client};
