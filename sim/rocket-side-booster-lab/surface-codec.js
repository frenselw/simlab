(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.RocketSurfaceCodec=api;
})(globalThis,function(){
 'use strict';
 const stride=32;

 async function readBytes(stream,limit,exact=false){
  const reader=stream.getReader(),bytes=new Uint8Array(limit);
  let offset=0;
  try{
   while(true){
    const {value,done}=await reader.read();
    if(done)break;
    if(offset+value.length>limit)throw Error('Terrain data exceeds its declared length');
    bytes.set(value,offset);
    offset+=value.length;
   }
   if(exact&&offset!==limit)throw Error('Invalid terrain data length');
   return bytes.subarray(0,offset);
  }finally{
   reader.cancel().catch(()=>{});
   reader.releaseLock();
  }
 }

 function gunzip(bytes,limit,exact=false){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return readBytes(stream,limit,exact);
 }

 function decode(bytes,record){
  const {width,height,step,maximum,near}=record,count=width*height,maskBytes=Math.ceil(count/8);
  const roots=((width-1)/stride+1)*((height-1)/stride+1);
  const expected=maskBytes+count+roots+(near?near.size**2*2:0);
  if(record.codec!=='pyramid-i8-v1'||bytes.byteLength!==expected)throw Error('Invalid height data length or format');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const grid=new Uint16Array(count),land=i=>Boolean(bytes[i>>3]&(1<<(i&7)));
  let offset=maskBytes;
  for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){
   const i=y*width+x,h=view.getUint16(offset,true);
   offset+=2;
   if(h>maximum||(!land(i)&&h!==0))throw Error('Invalid base height');
   grid[i]=h;
  }
  for(let span=stride/2;span>=1;span/=2){
   const vertical=span*width;
   for(const [row,col] of [[0,1],[1,0],[1,1]]){
    for(let y=row*span;y<height;y+=span*2)for(let x=col*span;x<width;x+=span*2){
     const i=y*width+x,d=view.getInt8(offset++);
     if(!land(i)){
      if(d!==0)throw Error('Invalid ocean residual');
      continue;
     }
     let prediction;
     if(!row)prediction=(grid[i-span]+grid[i+span])>>1;
     else if(!col)prediction=(grid[i-vertical]+grid[i+vertical])>>1;
     else prediction=(grid[i-vertical-span]+grid[i-vertical+span]+grid[i+vertical-span]+grid[i+vertical+span])>>2;
     grid[i]=Math.max(0,Math.min(maximum,prediction+d*step));
    }
   }
  }
  if(near){
   const {start,size,feather}=near;
   for(let y=0;y<size;y++){
    let h=0;
    for(let x=0;x<size;x++){
     h+=view.getInt16(offset,true);
     offset+=2;
     const i=(start+y)*width+start+x;
     if(h<0||h>maximum||(!land(i)&&h!==0))throw Error('Invalid launch area height');
     const t=Math.min(1,Math.min(x,y,size-1-x,size-1-y)/feather);
     grid[i]=Math.round(grid[i]+(h-grid[i])*t*t*(3-2*t));
    }
   }
  }else{
   for(let y=0;y<height;y++)grid[y*width+width-1]=grid[y*width];
   grid.fill(grid[0],0,width);
   grid.fill(grid[count-width],count-width);
  }
  for(let i=0;i<count;i++)if(land(i))grid[i]=near?grid[i]+1:grid[i]|32768;
  return grid;
 }

 return {readBytes,gunzip,decode};
});
