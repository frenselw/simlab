const prefix='/rocket-terrain/',bucket='https://copernicus-dem-90m.s3.eu-central-1.amazonaws.com';
const configPath='/rocket-side-booster-lab/precise-terrain-config.js';
const limit=16*1024*1024;

export async function terrainRelay(request,fetchData=fetch){
  const {pathname,search}=new URL(request.url);
  if(pathname===configPath&&request.method==='GET'){
    return new Response(`window.RocketPreciseTerrainEndpoint=${JSON.stringify(prefix)};`,{
      headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}
    });
  }
  if(!pathname.startsWith(prefix))return null;
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
  const match=/^(-?\d{1,2})\/(-?\d{1,3})\/(dem|water)\.tif$/.exec(pathname.slice(prefix.length));
  if(!match||search)return new Response(null,{status:400});
  const lat=Number(match[1]),lon=Number(match[2]);
  if(lat< -90||lat>=90||lon< -180||lon>=180)return new Response(null,{status:400});
  const range=request.headers.get('Range'),bounds=range&&/^bytes=(\d{1,8})-(\d{1,8})$/.exec(range);
  if(range&&(!bounds||+bounds[2]<+bounds[1]||+bounds[2]-+bounds[1]>=limit))return new Response(null,{status:416});
  const ns=(lat<0?'S':'N')+String(Math.abs(lat)).padStart(2,'0');
  const ew=(lon<0?'W':'E')+String(Math.abs(lon)).padStart(3,'0');
  const stem=`Copernicus_DSM_COG_30_${ns}_00_${ew}_00`;
  const file=match[3]==='dem'?`${stem}_DEM.tif`:`AUXFILES/${stem}_WBM.tif`;
  let upstream;
  try{
    upstream=await fetchData(`${bucket}/${stem}_DEM/${file}`,{
      headers:range?{Range:range}:{},redirect:'manual',signal:request.signal
    });
  }catch{
    return new Response(null,{status:502});
  }
  const length=Number(upstream.headers.get('Content-Length'));
  if(![200,206].includes(upstream.status)||!length||length>limit||
    !upstream.headers.get('Content-Type')?.startsWith('image/tiff')){
    await upstream.body?.cancel();return new Response(null,{status:502});
  }
  const headers=new Headers({'Content-Type':'image/tiff','Content-Length':String(length),'Cache-Control':'public, max-age=86400'});
  for(const name of ['Accept-Ranges','Content-Range','ETag']){
    const value=upstream.headers.get(name);if(value)headers.set(name,value);
  }
  return new Response(upstream.body,{status:upstream.status,headers});
}

export default {async fetch(request,env){
  return await terrainRelay(request)??env.ASSETS.fetch(request);
}};
