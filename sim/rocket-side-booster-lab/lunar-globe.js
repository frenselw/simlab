import * as T from './vendor/three-0.185.1/three.module.min.js';

export const moonLighting=`
  const float moonGray=.22;
  vec3 shadeMoon(float reflectance,float sunlight){
    return vec3(reflectance*(.009+1.15*pow(max(0.0,sunlight),.72)));
  }
`;
const maxDetailAltitude=80000000,fadeMilliseconds=900;

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
  const coordinates=[...offsets.slice(1).reverse().map(m=>-m),...offsets],width=coordinates.length;
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
  let anchor,east,north;
  const relative=new T.Vector3(),direction=new T.Vector3(),appearance={shade:0};
  const rotate=(axis,basis)=>new T.Vector3().addScaledVector(basis[0],axis.x)
    .addScaledVector(basis[1],axis.y).addScaledVector(basis[2],axis.z);
  function rebuild(up){
    anchor=up.clone();
    east=new T.Vector3(-anchor.z,0,anchor.x).normalize();
    if(east.lengthSq()<.5)east.set(0,0,1);
    north=new T.Vector3().crossVectors(east,anchor).normalize();
    const [tileEast,tileNorth]=C.moonMap(anchor.toArray());
    const uvEast=(tileEast*Math.hypot(anchor.x,anchor.z)%19)/19,uvNorth=(tileNorth%19)/19;
    let low=0,high=0;
    for(let row=0;row<width;row++)for(let col=0;col<width;col++){
      const i=row*width+col,x=coordinates[col],z=coordinates[row];
      direction.copy(anchor).addScaledVector(east,x/radius).addScaledVector(north,z/radius).normalize();
      const elevation=C.moonTerrain(...C.moonMap(direction.toArray()),appearance);
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
  }
  ground.userData.update=(up,basis,center,altitude)=>{
    if(!anchor||anchor.distanceTo(up)*radius>Math.min(625,Math.max(35,altitude*.35)))rebuild(up);
    const upWorld=rotate(anchor,basis);
    ground.position.copy(center).addScaledVector(upWorld,radius*.001);
    ground.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(rotate(east,basis),upWorld,rotate(north,basis)));
  };
  return ground;
}

export function createLunarGlobe(){
  const light={value:new T.Vector3()},albedo={value:null},detailBlend={value:0};
  const terrainCut={value:new T.Vector4(0,0,0,2)};
  const material=new T.ShaderMaterial({
    uniforms:{light,albedo,detailBlend,terrainCut},
    vertexShader:`
      varying vec3 lunarNormal;
      varying vec2 lunarUv;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){
        lunarNormal=normalize(mat3(modelMatrix)*normal);
        lunarUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
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
          float surface=dot(texture2D(albedo,lunarUv).rgb,vec3(.2126,.7152,.0722));
          gray+=(surface-.52)*.32*detailBlend;
        }
        gl_FragColor=vec4(shadeMoon(gray,dot(n,light)),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const globe=new T.Mesh(new T.SphereGeometry(1,64,40),material);
  globe.visible=false;
  let requested=false,timer=null,loadedAt=0;
  async function load(refresh){
    const response=await fetch(new URL('./assets/moon-albedo-2k.jpg',import.meta.url));
    if(!response.ok)return;
    const bytes=await RocketSurfaceCodec.readBytes(response.body,500000);
    const uri=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
    try{
      const texture=await new T.TextureLoader().loadAsync(uri);
      if(texture.image.width!==2048||texture.image.height!==1024){texture.dispose();return;}
      texture.colorSpace=T.SRGBColorSpace;
      texture.anisotropy=4;
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
      T.MathUtils.smoothstep(pixels,96,240)*
      T.MathUtils.smoothstep(performance.now()-loadedAt,0,fadeMilliseconds):0;
    if(requested)return;
    if(moonAltitude>=maxDetailAltitude||pixels<96||!new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
    ).intersectsSphere(new T.Sphere(position,radius))){
      clearTimeout(timer);timer=null;return;
    }
    if(timer===null)timer=setTimeout(()=>{
      timer=null;
      if(!globe.visible||document.hidden)return;
      requested=true;
      load(refresh).catch(()=>{});
    },1000);
  }
  globe.userData.update=update;
  globe.userData.detailBlend=detailBlend;
  globe.userData.terrainCut=terrainCut;
  return globe;
}
