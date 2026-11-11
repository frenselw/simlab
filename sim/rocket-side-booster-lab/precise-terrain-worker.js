'use strict';

importScripts('./vendor/geotiff-3.0.5/geotiff.js');

const intervals=64,side=intervals+3,sourceCache=new Map();
const wrap=lon=>((lon+180)%360+360)%360-180;
let index,active;

async function raster(url,overview,signal){
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
    const values=await image.readRasters({samples:[0],interleave:true,signal});
    if(values.length!==width*height)throw Error('Invalid terrain raster data');
    return {width,height,values};
  }finally{await tiff.close();}
}

async function cell(endpoint,lat,lon,overview,signal){
  const key=`${lat}/${lon}/${overview}`,saved=sourceCache.get(key);
  if(saved){sourceCache.delete(key);sourceCache.set(key,saved);return saved;}
  const id=(lat+90)*360+lon+180;
  if(!(index[id>>3]&(1<<(id&7))))return null;
  const path=new URL(`${lat}/${lon}/`,endpoint);
  const [dem,water]=await Promise.all([
    raster(new URL('dem.tif',path).href,overview,signal),
    raster(new URL('water.tif',path).href,0,signal)
  ]);
  const entry={dem,water};sourceCache.set(key,entry);
  if(sourceCache.size>5)sourceCache.delete(sourceCache.keys().next().value);
  return entry;
}

function sample({width,height,values},u,v,nearest=false){
  const x=Math.max(0,Math.min(width-1,u*width)),y=Math.max(0,Math.min(height-1,v*height));
  if(nearest)return values[Math.round(y)*width+Math.round(x)];
  const i=Math.floor(x),j=Math.floor(y),right=Math.min(width-1,i+1),down=Math.min(height-1,j+1);
  const a=x-i,b=y-j;
  const top=values[j*width+i]*(1-a)+values[j*width+right]*a;
  const bottom=values[down*width+i]*(1-a)+values[down*width+right]*a;
  return top*(1-b)+bottom*b;
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
    const data=await cell(endpoint,lat,lon,overview,signal);
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
  finally{clearTimeout(timeout);controller.abort();active=null;}
};
