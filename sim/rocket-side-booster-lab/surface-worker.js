'use strict';
importScripts('./surface-codec.js');

self.onmessage=async({data:{files}})=>{
 try{
  const grids=[];
  for(const {bytes,record} of files){
   if(globalThis.crypto?.subtle){
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const hex=Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('');
    if(hex!==record.sha256)throw Error('Terrain checksum mismatch');
   }
   const raw=await RocketSurfaceCodec.gunzip(bytes,record.decodedBytes,true);
   grids.push(RocketSurfaceCodec.decode(raw,record));
  }
  postMessage({grids},grids.map(grid=>grid.buffer));
 }catch(error){
  postMessage({error:error.message});
 }
};
