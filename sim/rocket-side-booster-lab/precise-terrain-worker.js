'use strict';

importScripts('./vendor/geotiff-3.0.5/geotiff.js');

const intervals=64,side=intervals+3,sourceCache=new Map();
const wrap=lon=>((lon+180)%360+360)%360-180;
let index,active;

function windowFor(points,width,height){
  const xs=points.map(point=>pixel(point[1],width)),ys=points.map(point=>pixel(point[2],height));
  return [Math.floor(Math.min(...xs)),Math.floor(Math.min(...ys)),Math.min(width,Math.floor(Math.max(...xs))+2),Math.min(height,Math.floor(Math.max(...ys))+2)];
}
const pixel=(fraction,size)=>Math.max(0,Math.min(size-1,fraction*size));
async function raster(url,overview,points,signal){
  const key=url+'/'+overview,saved=sourceCache.get(key);
  if(saved){
    const [left,top,right,bottom]=windowFor(points,saved.width,saved.height),[x,y,endX,endY]=saved.window;
    if(left>=x&&top>=y&&right<=endX&&bottom<=endY){
      sourceCache.delete(key);sourceCache.set(key,saved);return saved;
    }
  }
  // GeoTIFF does not pass the read signal through its metadata range requests.
  const client={async request({headers}){
    const response=await fetch(url,{headers,signal});
    return {ok:response.ok,status:response.status,getHeader:name=>response.headers.get(name),getData:()=>response.arrayBuffer()};
  }};
  const tiff=await GeoTIFF.fromCustomClient(client,{allowFullFile:false,blockSize:65536,cacheSize:8},signal);
  try{
    const image=await tiff.getImage(overview);
    const width=image.getWidth(),height=image.getHeight();
    if(width<1||width>1200||height<1||height>1200)throw Error('Invalid terrain raster size');
    const window=windowFor(points,width,height),[left,top,right,bottom]=window;
    const values=await image.readRasters({window,samples:[0],interleave:true,signal});
    if(values.length!==(right-left)*(bottom-top))throw Error('Invalid terrain raster data');
    const entry={width,height,window,values};
    if(signal.aborted)throw signal.reason;
    sourceCache.delete(key);sourceCache.set(key,entry);
    if(sourceCache.size>10)sourceCache.delete(sourceCache.keys().next().value);
    return entry;
  }finally{await tiff.close();}
}

async function cell(endpoint,lat,lon,overview,points,signal){
  const id=(lat+90)*360+lon+180;
  if(!(index[id>>3]&(1<<(id&7))))return null;
  const path=new URL(`${lat}/${lon}/`,endpoint);
  const [dem,water]=await Promise.all([
    raster(new URL('dem.tif',path).href,overview,points,signal),
    raster(new URL('water.tif',path).href,0,points,signal)
  ]);
  return {dem,water};
}

function sample({width,height,window:[left,top,endX,endY],values},u,v,nearest=false){
  const x=pixel(u,width)-left,y=pixel(v,height)-top,stride=endX-left;
  if(nearest)return values[Math.round(y)*stride+Math.round(x)];
  const i=Math.floor(x),j=Math.floor(y),right=Math.min(stride-1,i+1),down=Math.min(endY-top-1,j+1);
  const a=x-i,b=y-j;
  const upper=values[j*stride+i]*(1-a)+values[j*stride+right]*a;
  const lower=values[down*stride+i]*(1-a)+values[down*stride+right]*a;
  return upper*(1-b)+lower*b;
}

async function read({endpoint,west,south,size},signal){
  if(!index){
    const response=await fetch(new URL('./assets/precise-terrain-index.bin',location.href),{signal});
    if(!response.ok)throw Error('Global terrain inventory unavailable');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length!==8100)throw Error('Invalid global terrain inventory');
    index=bytes;
  }
  const jobs=new Map(),step=size/intervals,overview=size>=.5?2:size>=.25?1:0;
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const longitude=wrap(west+(x-1)*step),latitude=Math.max(-90,Math.min(90,south+(y-1)*step));
    const lon=Math.floor(longitude),lat=Math.max(-90,Math.ceil(latitude)-1),key=`${lat}/${lon}`;
    if(!jobs.has(key))jobs.set(key,{lat,lon,points:[]});
    jobs.get(key).points.push([y*side+x,longitude-lon,lat+1-latitude]);
  }
  const heights=new Uint16Array(side*side),water=new Uint8Array(side*side).fill(1);
  for(const {lat,lon,points} of jobs.values()){
    const data=await cell(endpoint,lat,lon,overview,points,signal);
    if(!data)continue;
    for(const [i,u,v] of points){
      const kind=sample(data.water,u,v,true),height=sample(data.dem,u,v);
      if(!Number.isInteger(kind)||kind<0||kind>3||!Number.isFinite(height)||height< -1000||height>10000)throw Error('Invalid terrain value');
      water[i]=kind;heights[i]=kind===1?0:Math.round(Math.max(0,height)*4);
    }
  }
  return {heights,water};
}

self.onmessage=async({data})=>{
  if(data.cancel){if(active?.id===data.cancel)active.controller.abort();return;}
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),22000);
  active={id:data.id,controller};
  try{
    const {heights,water}=await read(data,controller.signal);
    postMessage({id:data.id,heights,water},[heights.buffer,water.buffer]);
  }catch(error){postMessage({id:data.id,error:error.message});}
  finally{clearTimeout(timeout);controller.abort();if(active?.id===data.id)active=null;}
};
