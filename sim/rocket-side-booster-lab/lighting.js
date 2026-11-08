(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./parts.js'):root.RocketParts);if(typeof module==='object'&&module.exports)module.exports=api;root.RocketLighting=api;})(typeof window==='undefined'?globalThis:window,function(P){
 'use strict';
 const norm=Math.hypot(-.5,.3,1),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 function solar(q){
  if(!Array.isArray(q)||q.length<2||!q.slice(0,3).every(Number.isFinite))throw Error('Invalid lighting position');
  const radius=Math.hypot(q[0],q[1],q[2]||0);if(radius<1)throw Error('Invalid lighting radius');
  const elevation=(-.5*q[1]+.3*q[0]+(q[2]||0))/(radius*norm),horizon=-Math.sqrt(Math.max(0,1-(P.R/radius)**2));
  return {elevation,daylight:smooth(-.12,.18,elevation),sunlight:smooth(horizon-.005,horizon+.005,elevation),horizon};
 }
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
 #include <project_vertex>`);shader.fragmentShader='varying vec3 vShadowWorld;uniform vec3 uShadowPlanetCenter,uShadowSun;uniform float uShadowPlanetRadius,uShadowEnabled,uBodySunVisibility;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`float solarVisibility=1.0;
 if(uShadowEnabled>.5){solarVisibility=uBodySunVisibility;if(solarVisibility<0.0){vec3 point=vShadowWorld-uShadowPlanetCenter;float r=max(length(point),.000001);float horizon=-sqrt(max(0.0,1.0-pow(uShadowPlanetRadius/r,2.0)));solarVisibility=smoothstep(horizon-.005,horizon+.005,dot(point/r,uShadowSun));}}
 outgoingLight=mix(diffuseColor.rgb*vec3(.020,.028,.045)+totalEmissiveRadiance,outgoingLight,solarVisibility);
 #include <opaque_fragment>`);};material.customProgramCacheKey=()=>key.call(material)+'-planet-shadow';material.needsUpdate=true;
   }
   visibility.value=bodyVisibility;
  }});
 }
 return Object.freeze({solar,shade});
});
