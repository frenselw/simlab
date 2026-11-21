import * as T from './vendor/three-0.185.1/three.module.min.js';

export const moonLighting=`
  const float moonGray=.22;
  vec3 shadeMoon(float reflectance,float sunlight){
    return vec3(reflectance*(.009+1.15*pow(max(0.0,sunlight),.72)));
  }
`;
const maxDetailAltitude=80000000,fadeMilliseconds=900;

export function createLunarGlobe(){
  const light={value:new T.Vector3()},albedo={value:null},detailBlend={value:0};
  const material=new T.ShaderMaterial({
    uniforms:{light,albedo,detailBlend},
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
      varying vec3 lunarNormal;
      varying vec2 lunarUv;
      #include <logdepthbuf_pars_fragment>
      ${moonLighting}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n=normalize(lunarNormal);
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
  return globe;
}
