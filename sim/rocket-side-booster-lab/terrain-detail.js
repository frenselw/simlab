import * as THREE from './vendor/three-0.185.1/three.module.min.js';

export function createTerrainDetail(metadata){
 const size=259,width=size*4,height=size*3,columns=144,rows=72;
 if(metadata.version!==2||metadata.size!==size||metadata.samples!==256||metadata.border!==1||metadata.encoding!=='tangent-rgb8-127')throw Error('Invalid terrain detail metadata');
 for(const [id,bytes]of Object.entries(metadata.cells)){
  const [x,y]=id.split('-').map(Number);
  if(!/^\d+-\d+$/.test(id)||x>=columns||y>=rows||!Number.isInteger(bytes)||bytes<=0||bytes>300000)throw Error('Invalid terrain detail cell');
 }
 const pixels=new Uint8Array(width*height*4),lookupPixels=new Uint8Array(columns*rows*4),atlas=new THREE.DataTexture(pixels,width,height),lookup=new THREE.DataTexture(lookupPixels,columns,rows),entries=new Map(),slots=Array(12).fill(null);let selected=new Set(),published=new Set(),decoder;
 for(const texture of [atlas,lookup]){texture.generateMipmaps=false;texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;}
 atlas.minFilter=atlas.magFilter=THREE.LinearFilter;lookup.minFilter=lookup.magFilter=THREE.NearestFilter;
 const stats={loaded:0,visible:0,ids:[],bytes:pixels.byteLength+lookupPixels.byteLength,sourceBytes:0,fading:false};
 function publish(now){
  const next=new Set();let moving=false,changed=false;
  for(const [id,item]of entries)if(selected.has(id)){
   const at=item.offset,fade=Math.min(1,Math.max(0,(now-item.since)/600)),opacity=Math.round(fade*255);
   if(lookupPixels[at]!==item.slot+1||lookupPixels[at+1]!==opacity){
    lookupPixels.set([item.slot+1,opacity,0,255],at);
    changed=true;
   }
   next.add(at);
   moving ||= fade<1;
  }
  for(const at of published)if(!next.has(at)){lookupPixels.fill(0,at,at+4);changed=true;}
  published=next;
  if(changed)lookup.needsUpdate=true;
  stats.fading=moving;stats.loaded=entries.size;stats.visible=next.size;stats.ids=[...entries.keys()];stats.sourceBytes=stats.ids.reduce((n,id)=>n+metadata.cells[id],0);return moving;
 }
 return {
  textures:[atlas,lookup],stats,has:id=>entries.has(id),sizeOf:id=>metadata.cells[id]||0,capacity:slots.length,
  async read(id,signal){
   const cell=metadata.cells[id];if(!cell)return null;
   const response=await fetch(new URL('./assets/global-detail/normal-'+id+'.webp',import.meta.url),{signal});if(!response.ok)throw Error('Terrain slope tile unavailable');
   const bytes=await RocketSurfaceCodec.readBytes(response.body,cell,true);
   const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/webp'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
   try{
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    if(bitmap.width!==size||bitmap.height!==size)throw Error('Invalid terrain slope tile size');
    if(!decoder){decoder=document.createElement('canvas');decoder.width=decoder.height=size;}
    const context=decoder.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Terrain slope decode unavailable');context.clearRect(0,0,size,size);context.drawImage(bitmap,0,0);
    const data=context.getImageData(0,0,size,size).data;for(let i=3;i<data.length;i+=4)if(data[i]!==255)throw Error('Terrain slope tile must be opaque');return data;
   }finally{bitmap.close();}
  },
  install(id,data,now=performance.now()){
   if(!metadata.cells[id]||data.length!==size*size*4)throw Error('Invalid terrain slope pixels');
   const slot=entries.get(id)?.slot??slots.indexOf(null);if(slot<0)throw Error('Terrain slope atlas full');
   const col=slot%4,row=Math.floor(slot/4);
   for(let y=0;y<size;y++){const start=((row*size+y)*width+col*size)*4;pixels.set(data.subarray(y*size*4,(y+1)*size*4),start);}
   // A single upload avoids issuing a GL call for every tile row.
   const [x,y]=id.split('-').map(Number);
   atlas.needsUpdate=true;slots[slot]=id;entries.set(id,{slot,since:now,offset:(y*columns+x)*4});publish(now);
  },
  drop(id){const item=entries.get(id);if(!item)return;entries.delete(id);slots[item.slot]=null;publish(performance.now());},
  select(ids,now=performance.now()){selected=new Set(ids);return publish(now);},
  advance:publish,
  dispose(){entries.clear();slots.fill(null);atlas.dispose();lookup.dispose();}
 };
}
