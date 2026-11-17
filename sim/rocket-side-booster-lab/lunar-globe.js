import * as T from './vendor/three-0.185.1/three.module.min.js';

export function createLunarGlobe(){
  const light={value:new T.Vector3()},albedo={value:null},detailed={value:0};
  const material=new T.ShaderMaterial({
    uniforms:{light,albedo,detailed},
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
      uniform float detailed;
      varying vec3 lunarNormal;
      varying vec2 lunarUv;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n=normalize(lunarNormal);
        float sunlight=max(0.0,dot(n,light));
        vec3 color=vec3(.38,.37,.35);
        if(detailed>0.5)color=texture2D(albedo,lunarUv).rgb*2.0;
        gl_FragColor=vec4(color*(.009+1.7*pow(sunlight,.58)),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const globe=new T.Mesh(new T.SphereGeometry(1,64,40),material);
  globe.visible=false;
  let requested=false,timer=null;
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
      detailed.value=1;
      refresh();
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
    if(requested)return;
    if(moonAltitude>80000000||pixels<96||!new T.Frustum().setFromProjectionMatrix(
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
  globe.userData.detailed=detailed;
  return globe;
}
