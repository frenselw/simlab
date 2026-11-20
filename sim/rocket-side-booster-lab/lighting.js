(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./parts.js'):root.RocketParts);if(typeof module==='object'&&module.exports)module.exports=api;root.RocketLighting=api;})(typeof window==='undefined'?globalThis:window,function(P){
 'use strict';
 const norm=Math.hypot(-.5,.3,1),fixedSun=Object.freeze([-.5/norm,.3/norm,1/norm]),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 function solar(q,sun=fixedSun){
  if(!Array.isArray(q)||q.length<2||!q.slice(0,3).every(Number.isFinite))throw Error('Invalid lighting position');
  const radius=Math.hypot(q[0],q[1],q[2]||0);if(radius<1)throw Error('Invalid lighting radius');
  const elevation=(sun[0]*q[1]+sun[1]*q[0]+sun[2]*(q[2]||0))/radius,horizon=-Math.sqrt(Math.max(0,1-(P.R/radius)**2));
  return {elevation,daylight:smooth(-.12,.18,elevation),sunlight:smooth(horizon-.005,horizon+.005,elevation),horizon};
 }
 function exposure(altitude,daylight){
  const space=smooth(8000,95000,altitude);
  return 1.15-.13*space+.10*(1-space)*(1-daylight);
 }
 const localLightShader=`
 uniform vec4 uTowerLight,uRoadLightA,uRoadLightB,uExhaustLight;
 vec3 lightPool(vec4 lamp,vec3 point,vec3 normal,float range,vec3 tint,float surface){
   if(lamp.w<=0.0)return vec3(0.0);
   vec3 offset=(lamp.xyz-point)*1000.0;
   float distanceMetres=length(offset);
   if(distanceMetres>=range)return vec3(0.0);
   float incidence=max(0.0,dot(offset,normal)/max(distanceMetres,0.1));
   float falloff=1.0-smoothstep(0.0,range,distanceMetres);
   return tint*(lamp.w*falloff*falloff*mix(1.0,.12+.88*incidence,surface));
 }
 vec3 localIllumination(vec3 point,vec3 normal,float surface){
   return lightPool(uTowerLight,point,normal,48.0,vec3(.73,.87,1.0),surface)
        + lightPool(uRoadLightA,point,normal,21.0,vec3(1.0,.79,.51),surface)
        + lightPool(uRoadLightB,point,normal,21.0,vec3(1.0,.79,.51),surface)
        + lightPool(uExhaustLight,point,normal,110.0,vec3(1.0,.48,.16),surface);
 }`;
 const shaded=new WeakMap();
 function shade(group,uniforms,bodyVisibility=-1){
  const seen=new Set();group?.traverse(object=>{for(const material of [].concat(object.material||[])){
   if(seen.has(material)||!(material.isMeshLambertMaterial||material.isMeshPhongMaterial))continue;seen.add(material);
   let visibility=shaded.get(material);
   if(!visibility){
    visibility={value:bodyVisibility};shaded.set(material,visibility);const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
    material.onBeforeCompile=shader=>{compile.call(material,shader);Object.assign(shader.uniforms,uniforms,{uBodySunVisibility:visibility});shader.vertexShader='varying vec3 vShadowWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`vec4 shadowPoint=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 shadowPoint=instanceMatrix*shadowPoint;
 #endif
 vShadowWorld=(modelMatrix*shadowPoint).xyz;
 #include <project_vertex>`);shader.fragmentShader=localLightShader+'varying vec3 vShadowWorld;uniform vec3 uShadowPlanetCenter,uShadowSun;uniform float uShadowPlanetRadius,uShadowEnabled,uBodySunVisibility,uNightSkyFill;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`float solarVisibility=1.0;
 if(uShadowEnabled>.5){solarVisibility=uBodySunVisibility;if(solarVisibility<0.0){vec3 point=vShadowWorld-uShadowPlanetCenter;float r=max(length(point),.000001);float horizon=-sqrt(max(0.0,1.0-pow(uShadowPlanetRadius/r,2.0)));solarVisibility=smoothstep(horizon-.005,horizon+.005,dot(point/r,uShadowSun));}}
 vec3 worldNormal=normalize(normal*mat3(viewMatrix));
 vec3 skyFill=vec3(.036,.056,.095)*uNightSkyFill*(.4+.6*max(0.0,worldNormal.y));
 outgoingLight=mix(diffuseColor.rgb*(vec3(.020,.028,.045)+skyFill)+totalEmissiveRadiance,outgoingLight,solarVisibility);
 outgoingLight+=diffuseColor.rgb*localIllumination(vShadowWorld,worldNormal,${material.userData?.vapour?'0.0':'1.0'});
 #include <opaque_fragment>`);};material.customProgramCacheKey=()=>key.call(material)+'-planet-shadow';material.needsUpdate=true;
   }
   visibility.value=bodyVisibility;
  }});
 }
 return Object.freeze({solar,exposure,shade,fixedSun,localLightShader});
});
