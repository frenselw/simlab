import * as T from './vendor/three-0.185.1/three.module.min.js';

export const moonLighting=`
  const float moonGray=.22;
  vec3 shadeMoon(float reflectance,float sunlight){
    return vec3(reflectance*(.009+1.15*pow(max(0.0,sunlight),.72)));
  }
`;

export function lunarImpactSize(impact){
  const energy=.5*impact.mass*impact.speed**2;
  // shortcut: crater scale is illustrative, calibrate with lunar impact data if size becomes a learning outcome.
  return T.MathUtils.clamp(1.6+.32*Math.log1p(energy/400),1.6,13);
}

export function createLunarEffects(){
  const C=window.RocketCelestial,radius=C.MOON_RADIUS;
  const count=128,positions=new Float32Array(count*3),styles=new Float32Array(count*2);
  const particles=Array.from({length:count},()=>({age:0,life:0,point:new T.Vector3(),up:new T.Vector3(),velocity:new T.Vector3()}));
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  geometry.setAttribute('style',new T.BufferAttribute(styles,2));
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:`attribute vec2 style;
      varying vec2 particleStyle;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){
        particleStyle=style;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        gl_PointSize=abs(style.y);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`varying vec2 particleStyle;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float edge=1.-smoothstep(.12,.5,length(gl_PointCoord-.5));
        vec3 gray=particleStyle.y>0.?vec3(.72,.68,.61):vec3(.48,.42,.35);
        gl_FragColor=vec4(gray,edge*particleStyle.x);
      }`
  });
  const effect=new T.Group(),dust=new T.Points(geometry,material);
  dust.name='lunar-dust-and-ejecta';
  dust.frustumCulled=false;
  const glow=document.createElement('canvas');
  glow.width=glow.height=64;
  const ctx=glow.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'#fff7d9');
  gradient.addColorStop(.18,'#ffba68');
  gradient.addColorStop(.45,'rgba(255,135,54,.48)');
  gradient.addColorStop(1,'rgba(255,99,24,0)');
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,64,64);
  const flash=new T.Sprite(new T.SpriteMaterial({
    map:new T.CanvasTexture(glow),transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending
  }));
  flash.name='lunar-impact-flash';
  effect.add(dust,flash);
  let impact=null,age=0,lastFlight=null,source=null,remainder=0,cursor=0,reduced=false,quality=0;
  const position=new T.Vector3(),world=new T.Vector3();
  const elevation=point=>C.moonTerrain(...C.moonMap(point.toArray()));
  function worldPoint(point,basis,center){
    world.copy(center);
    basis.forEach((axis,i)=>world.addScaledVector(axis,point.getComponent(i)*.001));
    return world;
  }
  function emit(point,ejecta=false){
    const p=particles[cursor++%count],up=p.up.copy(point).normalize();
    const tangent=new T.Vector3(-up.z,0,up.x);
    if(tangent.lengthSq()<1e-9)tangent.set(1,0,0);
    tangent.normalize();
    const angle=cursor*2.399963,spread=(cursor%11)/10;
    const speed=ejecta?(1+spread)*lunarImpactSize(impact)*1.7:2+13*spread;
    p.velocity.copy(tangent).multiplyScalar(Math.cos(angle)*speed)
      .addScaledVector(new T.Vector3().crossVectors(up,tangent),Math.sin(angle)*speed)
      .addScaledVector(up,ejecta?1.6+spread*4:.24+speed*.06);
    p.point.copy(point);
    p.age=0;
    p.life=ejecta?.65+spread*1.15:.35+spread*.63;
    p.ejecta=ejecta;
  }
  effect.update=(f,basis,center,craft,motion,level)=>{
    reduced=motion;quality=level;
    if(f!==lastFlight){
      lastFlight=f;impact=null;remainder=cursor=0;
      for(const p of particles)p.life=0;
    }
    effect.visible=Boolean(basis);
    source=null;
    if(!basis)return;
    if(f.lunar.impact&&f.lunar.impact!==impact){
      impact=f.lunar.impact;age=0;
      const up=new T.Vector3(...impact.point);
      const point=up.clone().multiplyScalar(radius+elevation(up)+.35);
      for(let i=0;i<(reduced?9:quality?38:66);i++)emit(point,true);
    }
    if(f.status==='flying'&&f.controls.lit&&f.controls.throttle>0&&f.moon.surface?.height<34){
      const axis=new T.Vector3(0,1,0).applyQuaternion(craft.quaternion);
      const nozzle=craft.position.clone().sub(center).addScaledVector(axis,-.0002);
      const fixed=new T.Vector3(...basis.map(vector=>1000*vector.dot(nozzle)));
      const exhaust=new T.Vector3(...basis.map(vector=>-vector.dot(axis)));
      if(exhaust.dot(fixed.clone().normalize())<-.24){
        let low=0,high=42;
        const gap=distance=>{
          position.copy(fixed).addScaledVector(exhaust,distance);
          return position.length()-radius-elevation(position.normalize());
        };
        if(gap(high)<=0){
          for(let i=0;i<8;i++){
            const mid=(low+high)*.5;
            if(gap(mid)>0)low=mid;else high=mid;
          }
          const point=fixed.addScaledVector(exhaust,high).normalize();
          source={point:point.clone().multiplyScalar(radius+elevation(point)+.22),
            strength:f.controls.throttle*(1-T.MathUtils.smoothstep(high,5,42))};
        }
      }
    }
    let visible=0;
    for(const p of particles){
      if(p.age>=p.life)continue;
      const a=p.age;
      position.copy(p.point).addScaledVector(p.velocity,a).addScaledVector(p.up,-.81*a*a);
      const ground=radius+elevation(position.clone().normalize());
      if(position.length()<ground)continue;
      worldPoint(position,basis,center).toArray(positions,visible*3);
      styles[visible*2]=(1-a/p.life)*(p.ejecta?.9:.8);
      styles[visible*2+1]=p.ejecta?-(2+p.life):4+a*10;
      visible++;
    }
    geometry.setDrawRange(0,visible);
    for(const attribute of Object.values(geometry.attributes))attribute.needsUpdate=true;
    flash.visible=Boolean(impact&&age<.36&&!reduced);
    if(flash.visible){
      const up=new T.Vector3(...impact.point);
      flash.position.copy(worldPoint(up.clone().multiplyScalar(radius+elevation(up)+1.2),basis,center));
      flash.scale.setScalar(.002*lunarImpactSize(impact)*(.55+age*4));
      flash.material.opacity=.95*(1-age/.36);
    }
    effect.userData={particles:visible,strength:source?.strength??0,impactAge:impact?age:null};
  };
  effect.advance=(dt,running)=>{
    if(!effect.visible||!running&&!impact)return false;
    const active=particles.some(p=>p.age<p.life)||Boolean(impact&&age<.36);
    age+=dt;
    for(const p of particles)if(p.age<p.life)p.age+=dt;
    if(source&&running){
      remainder+=dt*source.strength*(reduced?13:quality?48:82);
      while(remainder>=1){emit(source.point);remainder--;}
    }
    return active||Boolean(source&&running);
  };
  return effect;
}
const maxDetailAltitude=80000000,minDetailPixels=64,fadeMilliseconds=500;
const mapWidth=2048,mapHeight=1024,heightWidth=1024,heightHeight=512;

function createLunarRelief(image){
  const canvas=document.createElement('canvas');
  canvas.width=heightWidth;canvas.height=heightHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0,heightWidth,heightHeight,0,0,heightWidth,heightHeight);
  const heights=context.getImageData(0,0,heightWidth,heightHeight).data;
  // The alpha channel carries the measured elevations in 140 m steps.
  const elevation=(x,y)=>heights[4*(y*heightWidth+(x+heightWidth)%heightWidth)+3]*140-23500;
  const sample=(x,y)=>{
    y=T.MathUtils.clamp(y,0,heightHeight-1);
    const left=Math.floor(x),top=Math.floor(y),bottom=Math.min(top+1,heightHeight-1);
    const a=T.MathUtils.lerp(elevation(left,top),elevation(left+1,top),x-left);
    const b=T.MathUtils.lerp(elevation(left,bottom),elevation(left+1,bottom),x-left);
    return T.MathUtils.lerp(a,b,y-top);
  };
  const radius=RocketCelestial.MOON_RADIUS,spacing=2*Math.PI*radius/heightWidth;
  const geometry=new T.SphereGeometry(1,512,256);
  const {position,uv}=geometry.attributes,terrain=new Float32Array(position.count*4);
  const radial=new T.Vector3(),east=new T.Vector3(),north=new T.Vector3(),normal=new T.Vector3();
  for(let i=0;i<position.count;i++){
    const x=uv.getX(i)*heightWidth-.5,y=(1-uv.getY(i))*heightHeight-.5;
    radial.fromBufferAttribute(position,i);
    east.set(radial.z,0,-radial.x);
    const cosLatitude=east.length();
    normal.copy(radial);
    if(cosLatitude>.01){
      east.multiplyScalar(1/cosLatitude);
      north.crossVectors(radial,east);
      // Use the measured slope at map resolution, including relief between mesh vertices.
      normal.addScaledVector(east,(sample(x-1,y)-sample(x+1,y))/(2*spacing*cosLatitude));
      normal.addScaledVector(north,(sample(x,y+1)-sample(x,y-1))/(2*spacing)).normalize();
    }
    terrain.set([normal.x,normal.y,normal.z,sample(x,y)/radius],4*i);
  }
  geometry.setAttribute('terrain',new T.BufferAttribute(terrain,4));
  geometry.boundingSphere=new T.Sphere(new T.Vector3(),1.007);
  return geometry;
}

export function createLunarGround(){
  const C=window.RocketCelestial,radius=C.MOON_RADIUS;
  const size=128,data=new Uint8Array(size*size*4);
  let seed=1972;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const dustFields=[5,17,41].map(count=>({count,values:Float32Array.from({length:count*count},random)}));
  const dustAt=(x,z,{count,values})=>{
    const dx=x*count/size,dz=z*count/size,col=Math.floor(dx),row=Math.floor(dz);
    const u=dx-col,v=dz-row,fx=u*u*(3-2*u),fz=v*v*(3-2*v);
    const next=(col+1)%count,bottom=((row+1)%count)*count,top=row*count;
    return T.MathUtils.lerp(T.MathUtils.lerp(values[top+col],values[top+next],fx),
      T.MathUtils.lerp(values[bottom+col],values[bottom+next],fx),fz)-.5;
  };
  for(let i=0;i<data.length;i+=4){
    const x=i/4%size,z=Math.floor(i/4/size);
    const dust=17*dustAt(x,z,dustFields[0])+20*dustAt(x,z,dustFields[1])+13*dustAt(x,z,dustFields[2]);
    const grain=Math.round(203+dust+(random()-.5)*35-(random()<.033?36:0));
    data[i]=grain;data[i+1]=grain-1;data[i+2]=grain-3;data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size);
  texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.generateMipmaps=true;
  texture.minFilter=T.LinearMipmapLinearFilter;
  texture.magFilter=T.LinearFilter;
  texture.anisotropy=4;
  texture.needsUpdate=true;

  // Close grid lines resolve even small rims. Wider spacing carries the sphere to the horizon.
  const offsets=[0];
  for(let m=4;m<=112;m+=4)offsets.push(m);
  for(let m=120;m<=480;m+=12)offsets.push(m);
  for(let m=530;m<78000;m*=1.16)offsets.push(m);
  offsets.push(78000);
  const mirrored=values=>[...values.slice(1).reverse().map(m=>-m),...values];
  const coordinates=mirrored(offsets),width=coordinates.length;
  const impactCoordinates=mirrored([0,...Array.from({length:12},(_,i)=>(i+1)*.5),
    ...Array.from({length:10},(_,i)=>i+7),32,48,64,80,96,112,...offsets.slice(29)]);
  const positions=new Float32Array(width*width*3),colors=new Float32Array(positions.length),uv=new Float32Array(width*width*2);
  const index=[];
  for(let row=0;row<width-1;row++)for(let col=0;col<width-1;col++){
    const a=row*width+col,b=a+1,c=a+width,d=c+1;
    index.push(a,c,b,b,c,d);
  }
  const geometry=new T.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
  const ground=new T.Mesh(geometry,new T.MeshLambertMaterial({map:texture,vertexColors:true}));
  ground.name='moon-plains-and-impact-craters';
  ground.frustumCulled=false;
  let anchor,east,north,previousImpact;
  const relative=new T.Vector3(),direction=new T.Vector3(),appearance={shade:0};
  const rotate=(axis,basis)=>new T.Vector3().addScaledVector(basis[0],axis.x)
    .addScaledVector(basis[1],axis.y).addScaledVector(basis[2],axis.z);
  function rebuild(up,impact){
    anchor=up.clone();
    east=new T.Vector3(-anchor.z,0,anchor.x).normalize();
    if(east.lengthSq()<.5)east.set(0,0,1);
    north=new T.Vector3().crossVectors(east,anchor).normalize();
    const [tileEast,tileNorth]=C.moonMap(anchor.toArray());
    const uvEast=(tileEast*Math.hypot(anchor.x,anchor.z)%19)/19,uvNorth=(tileNorth%19)/19;
    const crater=impact?lunarImpactSize(impact):0;
    const grid=impact?impactCoordinates:coordinates;
    let low=0,high=0;
    for(let row=0;row<width;row++)for(let col=0;col<width;col++){
      const i=row*width+col,x=grid[col],z=grid[row];
      direction.copy(anchor).addScaledVector(east,x/radius).addScaledVector(north,z/radius).normalize();
      let elevation=C.moonTerrain(...C.moonMap(direction.toArray()),appearance);
      const range=crater?Math.hypot(x,z)/crater:Infinity;
      if(range<1.2){
        const bowl=1-T.MathUtils.smoothstep(range,.12,.84);
        const rim=1-T.MathUtils.smoothstep(Math.abs(range-.87),0,.28);
        elevation+=crater*(.14*rim-.34*bowl);
        appearance.shade*=1-.35*bowl+.18*rim;
      }
      relative.copy(direction).multiplyScalar(radius+elevation);
      positions.set([relative.dot(east)*.001,(relative.dot(anchor)-radius)*.001,relative.dot(north)*.001],3*i);
      const gray=appearance.shade;
      colors.set([gray,gray*.993,gray*.972],3*i);
      uv.set([x/19+uvEast,z/19+uvNorth],2*i);
      if(Math.hypot(x,z)<750){low=Math.min(low,elevation);high=Math.max(high,elevation);}
    }
    for(const attribute of Object.values(geometry.attributes))attribute.needsUpdate=true;
    geometry.computeVertexNormals();
    ground.userData.relief={low,high,vertices:width*width};
    ground.userData.impactCrater=crater||null;
  }
  ground.userData.update=(up,basis,center,altitude,impact)=>{
    if(impact)up=new T.Vector3(...impact.point);
    if(!anchor||impact!==previousImpact||anchor.distanceTo(up)*radius>Math.min(625,Math.max(35,altitude*.35))){
      rebuild(up,impact);
      previousImpact=impact;
    }
    const upWorld=rotate(anchor,basis);
    ground.position.copy(center).addScaledVector(upWorld,radius*.001);
    ground.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(rotate(east,basis),upWorld,rotate(north,basis)));
  };
  return ground;
}

export function createLunarGlobe(){
  const light={value:new T.Vector3()},albedo={value:null},detailBlend={value:0},reliefBlend={value:0};
  const terrainCut={value:new T.Vector4(0,0,0,2)};
  const material=new T.ShaderMaterial({
    uniforms:{light,albedo,detailBlend,terrainCut,reliefBlend},
    vertexShader:`
      uniform float reliefBlend;
      attribute vec4 terrain;
      varying vec3 lunarNormal;
      varying vec2 lunarUv;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){
        lunarNormal=normalize(mat3(modelMatrix)*mix(normal,terrain.xyz,reliefBlend));
        lunarUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position*(1.0+terrain.w*reliefBlend),1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      uniform vec3 light;
      uniform sampler2D albedo;
      uniform float detailBlend;
      uniform vec4 terrainCut;
      varying vec3 lunarNormal;
      varying vec2 lunarUv;
      #include <logdepthbuf_pars_fragment>
      ${moonLighting}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n=normalize(lunarNormal);
        if(dot(n,terrainCut.xyz)>terrainCut.w)discard;
        float gray=moonGray;
        if(detailBlend>0.0){
          float surface=texture2D(albedo,lunarUv).r;
          gray+=(surface-.52)*.42*detailBlend;
        }
        gl_FragColor=vec4(shadeMoon(gray,dot(n,light)),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sphere=new T.SphereGeometry(1,64,40);
  sphere.setAttribute('terrain',new T.BufferAttribute(new Float32Array(sphere.attributes.position.count*4),4));
  const globe=new T.Mesh(sphere,material);
  globe.visible=false;
  let requested=false,timer=null,loadedAt=0,relief;
  async function load(refresh){
    const response=await fetch(new URL('./assets/moon-surface.webp',import.meta.url));
    if(!response.ok)return;
    const bytes=await RocketSurfaceCodec.readBytes(response.body,500000);
    const uri=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
    try{
      const image=await new T.ImageLoader().loadAsync(uri);
      if(image.width!==mapWidth||image.height!==mapHeight)return;
      relief=createLunarRelief(image);
      const texture=new T.Texture(image);
      texture.colorSpace=T.SRGBColorSpace;
      texture.wrapS=T.RepeatWrapping;
      texture.anisotropy=4;
      texture.needsUpdate=true;
      albedo.value=texture;
      loadedAt=performance.now();
      function fade(now){
        if(!globe.visible||document.hidden)return;
        refresh();
        if(now-loadedAt<fadeMilliseconds)requestAnimationFrame(fade);
      }
      requestAnimationFrame(fade);
    }finally{URL.revokeObjectURL(uri);}
  }
  function update({position,radius,earth,north,sun,camera,pixels,moonAltitude,refresh}){
    globe.position.copy(position);
    globe.scale.setScalar(radius);
    const x=earth.clone().sub(position).normalize();
    const z=x.clone().cross(north).normalize(),y=z.clone().cross(x);
    globe.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
    light.value.copy(sun).normalize();
    globe.visible=true;
    detailBlend.value=albedo.value?
      (1-T.MathUtils.smoothstep(moonAltitude,20000000,maxDetailAltitude))*
      T.MathUtils.smoothstep(pixels,minDetailPixels,160)*
      T.MathUtils.smoothstep(performance.now()-loadedAt,0,fadeMilliseconds):0;
    // Let the established landing mesh take over as the spacecraft approaches touchdown.
    reliefBlend.value=detailBlend.value*T.MathUtils.smoothstep(moonAltitude,8000,50000)*
      (1-T.MathUtils.smoothstep(moonAltitude,850000,2500000));
    globe.geometry=reliefBlend.value>0?relief:sphere;
    if(requested)return;
    if(moonAltitude>=maxDetailAltitude||pixels<minDetailPixels||!new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
    ).intersectsSphere(new T.Sphere(position,radius))){
      clearTimeout(timer);timer=null;return;
    }
    if(timer===null)timer=setTimeout(()=>{
      timer=null;
      if(!globe.visible||document.hidden)return;
      requested=true;
      load(refresh).catch(()=>{});
    },250);
  }
  globe.userData.update=update;
  globe.userData.detailBlend=detailBlend;
  globe.userData.terrainCut=terrainCut;
  return globe;
}
