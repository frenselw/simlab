'use strict';
const fs=require('node:fs'),path=require('node:path');
function checkDocs(files,root=path.resolve(__dirname,'..')){
 const errors=[],skipped=[];
 if(files.some(f=>f.endsWith('.md')&&!fs.existsSync(path.resolve(root,f)))){
  const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(directory,e.name)):e.name.endsWith('.md')?[path.relative(root,path.join(directory,e.name))]:[]);
  files=[...new Set([...files,...fs.readdirSync(root).filter(f=>f.endsWith('.md')),
   ...['docs','plans'].filter(d=>fs.existsSync(path.join(root,d))).flatMap(d=>walk(path.join(root,d)))])];
 }
 for(const file of files.filter(f=>f.endsWith('.md')&&fs.existsSync(path.resolve(root,f)))){
  const text=fs.readFileSync(path.resolve(root,file),'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm,'');
  for(const [,raw]of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
   let url=raw.trim();
   if(/^[a-z][a-z0-9+.-]*:/i.test(url))continue;
   if(url.startsWith('<')&&url.endsWith('>'))url=url.slice(1,-1);
   if(/[<>]/.test(url)){skipped.push(file+': template '+url);continue;}
   url=url.split(/\s+"/)[0];
   const [target,anchor]=url.split('#'), resolved=path.resolve(root,path.dirname(file),decodeURIComponent(target||path.basename(file)));
   const relative=path.relative(root,resolved).replaceAll('\\','/');
   if(relative.startsWith('../')||path.isAbsolute(relative)){errors.push(file+': outside repository '+url);continue;}
   if(relative.startsWith('output/')){skipped.push(file+': generated evidence '+url);continue;}
   if(!fs.existsSync(resolved)){errors.push(file+': missing '+url);continue;}
   if(anchor&&resolved.endsWith('.md')){
    const source=fs.readFileSync(resolved,'utf8'),seen=new Map();
    const anchors=[...source.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>{
     const key=m[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu,'').replaceAll(' ','-'),n=seen.get(key)||0;
     seen.set(key,n+1);return key+(n?'-'+n:'');
    });
    if(!anchors.includes(anchor)&&!source.includes('id="'+anchor+'"'))errors.push(file+': missing anchor '+url);
   }
  }
 }
 if(errors.length)throw new Error(errors.join('\n'));
 return {files:files.filter(f=>f.endsWith('.md')),skipped};
}
if(require.main===module){try{console.log(JSON.stringify(checkDocs(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={checkDocs};
