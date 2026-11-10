import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import {groundLight,orbitalLighting,surfaceUniforms,terrainSlopeDetail} from './terrain.js';

const R=6371000,radians=Math.PI/180,side=67,segments=32,limit=28,cacheLimit=36;
const offsets=Array.from({length:63},(_,i)=>[(i%9-4)*.24,(Math.floor(i/9)-3)*.32]);
offsets.sort(([ax,ay],[bx,by])=>ax*ax+ay*ay-bx*bx-by*by);
const wrap=lon=>((lon+180)%360+360)%360-180;
const idFor=(west,south,size)=>`${west}/${south}/${size}`;
const footprint=p=>p.y>0?R*Math.pow(p.x**8+p.z**8,.125):Infinity;

export function terrainPatch(longitude,latitude,metresPerPixel){
  const size=2**THREE.MathUtils.clamp(Math.ceil(Math.log2(metresPerPixel*220/111195)),-5,0);
  const west=Math.floor(wrap(longitude)/size)*size;
  const south=Math.floor(THREE.MathUtils.clamp(latitude,-90,90-1e-7)/size)*size;
  return {west,south,size,id:idFor(west,south,size)};
}

export function createPreciseTerrain(sun,endpoint){
  const group=new THREE.Group(),S=window.RocketSurface,cache=new Map(),failed=new Map();
  const basis=[[1,0,0],[0,1,0],[0,0,1]].map(direction=>{
    const [a,b]=S.geographic(...direction).map(v=>v*radians);
    return new THREE.Vector3(Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b));
  });
  const inverse=new THREE.Matrix4(),ray=new THREE.Raycaster(),sphere=new THREE.Sphere(new THREE.Vector3(),1),point=new THREE.Vector3();
  const cameraLocal=new THREE.Vector3(),geo=new THREE.Vector3(),nearHit=new THREE.Vector3(),screen=new THREE.Vector2();
  const contactCenter={value:new THREE.Vector3()},contactRadius={value:0};
  let wanted=new Map(),pending=null,worker,sequence=0;
  const stats=group.userData={active:0,loaded:0,pending:0,failed:0,triangles:0,maximumSpacingMetres:0};
  const faceIndices=[];
  for(let y=0;y<segments;y++)for(let x=0;x<segments;x++){
    const a=y*(segments+1)+x,b=a+segments+1;
    faceIndices.push(a,b,a+1,a+1,b,b+1);
  }
  const index=new THREE.Uint16BufferAttribute(faceIndices,1);
  const uv=[];
  for(let y=0;y<=segments;y++)for(let x=0;x<=segments;x++)uv.push(x/segments,y/segments);
  const uvAttribute=new THREE.Float32BufferAttribute(uv,2);

  function createMesh(patch,heights,water){
    if(heights.length!==side**2||water.length!==side**2)throw Error('Invalid terrain patch');
    const pixels=new Uint8Array(side*side*4);
    for(let i=0;i<heights.length;i++){
      if(heights[i]>40000||water[i]>3)throw Error('Invalid terrain patch sample');
      pixels.set([heights[i]>>8,heights[i]&255,water[i]===0?0:255,255],4*i);
    }
    const texture=new THREE.DataTexture(pixels,side,side);
    texture.minFilter=texture.magFilter=THREE.LinearFilter;
    texture.needsUpdate=true;
    const position=new Float32Array((segments+1)**2*3);
    for(let y=0;y<=segments;y++){
      const latitude=(patch.south+patch.size*y/segments)*radians,cos=Math.cos(latitude);
      for(let x=0;x<=segments;x++){
        const longitude=(patch.west+patch.size*x/segments)*radians;
        const height=heights[(1+y*2)*side+1+x*2]/4;
        geo.set(cos*Math.cos(longitude),Math.sin(latitude),cos*Math.sin(longitude));
        const i=3*(y*(segments+1)+x),radius=1+height/R;
        for(let k=0;k<3;k++)position[i+k]=geo.dot(basis[k])*radius;
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
    geometry.setAttribute('uv',uvAttribute.clone());geometry.setIndex(index.clone());geometry.computeBoundingSphere();
    // Draw blended borders before the craft, using the unchanged globe as the fallback surface.
    const material=new THREE.MeshBasicMaterial({depthTest:false,depthWrite:true,side:THREE.DoubleSide,
      blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor});
    const fade={value:0},edges={value:new THREE.Vector4()};
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,surfaceUniforms,{uSun:{value:sun},uSlopeDetail:terrainSlopeDetail,
        uTile:{value:texture},uStep:{value:patch.size*radians*R/64},uFade:fade,uEdges:edges,
        uGroundContact:contactCenter,uGroundRadius:contactRadius});
      shader.vertexShader='varying vec3 vTilePoint,vTileWorld; varying vec2 vTileUv;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vTilePoint=position;vTileWorld=(modelMatrix*vec4(position,1.0)).xyz;vTileUv=uv;`);
      shader.fragmentShader=groundLight+orbitalLighting+`
uniform sampler2D uTile;
uniform float uStep,uFade,uGroundRadius;
uniform vec3 uSun,uGroundContact;
uniform vec4 uEdges;
varying vec3 vTilePoint,vTileWorld;
varying vec2 vTileUv;
float tileHeight(vec2 uv){return dot(texture2D(uTile,uv).rg,vec2(65280.0,255.0))*.25;}
`+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 p=normalize(vTilePoint),radial=normalize(uSurfaceRotation*p);
if(dot(radial,cameraPosition-vTileWorld)<=0.0)discard;
vec4 sides=mix(smoothstep(vec4(0.0),vec4(.12),vec4(vTileUv.x,1.0-vTileUv.x,vTileUv.y,1.0-vTileUv.y)),vec4(1.0),uEdges);
float opacity=uFade*min(min(sides.x,sides.y),min(sides.z,sides.w));
vec2 m=abs(p.xz)*6371000.0;
if(p.y>0.0&&max(m.x,m.y)<239500.0){
  float extent=239500.0*pow(pow(m.x/239500.0,8.0)+pow(m.y/239500.0,8.0),.125);
  opacity*=smoothstep(175000.0,239500.0,extent);
}
if(uGroundRadius>0.0)opacity*=smoothstep(uGroundRadius,2.0*uGroundRadius,distance(p,uGroundContact));
if(opacity<=.001)discard;
vec2 tile=(vTileUv*64.0+1.5)/67.0,d=vec2(1.0/67.0,0.0);
vec3 g=normalize(geographicDirection(p));
vec3 east=normalize(cross(p,vec3(0.0,sin(.605629),cos(.605629)))+vec3(.0000001,0.0,0.0));
vec3 north=cross(east,p);
float dx=(tileHeight(tile+d)-tileHeight(tile-d))/(2.0*uStep*max(.02,length(g.xz)));
float dy=(tileHeight(tile+d.yx)-tileHeight(tile-d.yx))/(2.0*uStep);
vec3 normal=normalize(uSurfaceRotation*(p-east*dx-north*dy));
vec2 uv=geographicUv(g),du=dFdx(uv),dv=dFdy(uv);du.x-=round(du.x);dv.x-=round(dv.x);
vec3 land=textureGrad(uOrbitalMap,uv,du,dv).rgb;
float h=tileHeight(tile),rock=smoothstep(1600.0,3500.0,h),snow=smoothstep(4000.0,5200.0,h);
land=mix(mix(land,vec3(.31,.30,.27),rock*.55),vec3(.75,.80,.82),snow*.8);
float w=texture2D(uTile,tile).b,edge=max(.01,.5*fwidth(w)),water=smoothstep(.5-edge,.5+edge,w);
vec3 color=land*terrainIrradiance(normal,radial,uSun);
if(water>0.0)color=mix(color,shadeSurface(oceanAlbedo,radial,radial,p,vTileWorld,uSun,1.0),water);
diffuseColor=vec4(color,opacity);`);
    };
    material.customProgramCacheKey=()=> 'rocket-precise-terrain-v1';
    const mesh=new THREE.Mesh(geometry,material);
    mesh.renderOrder=-.75;mesh.visible=false;group.add(mesh);
    return {mesh,texture,fade,edges,since:performance.now(),patch};
  }

  function forget(id,item){
    group.remove(item.mesh);item.mesh.material.dispose();item.mesh.geometry.dispose();item.texture.dispose();cache.delete(id);
  }

  function load(){
    if(pending)return;
    const now=performance.now(),patch=[...wanted.values()].find(p=>!cache.has(p.id)&&(failed.get(p.id)??0)<=now);
    if(!patch)return;
    if(!worker){
      try{worker=new Worker(new URL('./precise-terrain-worker.js',import.meta.url));}
      catch{failed.set(patch.id,now+30000);return;}
      worker.onmessage=({data})=>{
        if(!pending||data.id!==pending.id)return;
        const {patch}=pending;pending=null;
        if(data.error)failed.set(patch.id,performance.now()+30000);
        else if(wanted.has(patch.id)){
          try{
            while(cache.size>=cacheLimit){const [id,item]=[...cache].find(([id])=>!wanted.has(id));forget(id,item);}
            cache.set(patch.id,createMesh(patch,data.heights,data.water));
          }catch{failed.set(patch.id,performance.now()+30000);}
        }
        group.onChange?.();
      };
      worker.onerror=()=>{
        if(pending)failed.set(pending.patch.id,performance.now()+30000);
        pending=null;worker.terminate();worker=null;group.onChange?.();
      };
    }
    pending={id:++sequence,patch};worker.postMessage({...patch,id:pending.id,endpoint});
  }

  function refresh(now){
    let moving=false,active=0,spacing=0;
    for(const [id,item] of cache){
      item.mesh.visible=wanted.has(id);
      if(!item.mesh.visible)continue;
      active++;spacing=Math.max(spacing,item.patch.size*radians*R/segments);
      item.fade.value=Math.min(1,Math.max(0,(now-item.since)/550));moving ||= item.fade.value<1;
    }
    for(const {mesh,patch,edges} of cache.values())if(mesh.visible){
      const {west,south,size}=patch;
      const edge=(x,y)=>wanted.has(idFor(wrap(x),y,size))?(cache.get(idFor(wrap(x),y,size))?.fade.value??0):0;
      edges.value.set(edge(west-size,south),edge(west+size,south),edge(west,south-size),edge(west,south+size));
    }
    Object.assign(stats,{active,loaded:cache.size,pending:Number(Boolean(pending)),failed:failed.size,
      triangles:active*segments*segments*2,maximumSpacingMetres:spacing,textureBytes:cache.size*side*side*4});
    return moving;
  }

  group.update=(camera,pixels,enabled,clip)=>{
    const now=performance.now();
    for(const [id,until] of failed)if(until<=now)failed.delete(id);
    if(clip){contactCenter.value.copy(clip.uContactCenter.value);contactRadius.value=clip.uContactRadius.value;}
    cameraLocal.copy(camera.position);group.parent.worldToLocal(cameraLocal);
    const radius=cameraLocal.length(),mpp=Math.max(1,(radius-1)*R/pixels),next=new Map();
    if(enabled&&mpp<800){
      inverse.copy(group.parent.matrixWorld).invert();
      for(const [x,y] of offsets){
        ray.setFromCamera(screen.set(x,y),camera);ray.ray.applyMatrix4(inverse);
        sphere.radius=1;
        if(!ray.ray.intersectSphere(sphere,point))continue;
        const coarseHeight=S.heightAt(point.x,point.y,point.z);
        sphere.radius=Math.min(1+coarseHeight/R,radius-1/R);
        if(sphere.radius>1&&ray.ray.intersectSphere(sphere,nearHit))point.copy(nearHit).normalize();
        if(footprint(point)<175000)continue;
        const [lon,lat]=S.geographic(point.x,point.y,point.z),patch=terrainPatch(lon,lat,mpp);
        if(!next.has(patch.id))next.set(patch.id,patch);
        if(next.size===limit)break;
      }
    }
    wanted=next;load();refresh(now);
  };
  group.advance=refresh;
  return group;
}
