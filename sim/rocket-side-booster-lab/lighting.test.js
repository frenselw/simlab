'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),L=require('./lighting');
const q=(angle,height=0)=>[(P.R+height)*Math.cos(angle),(P.R+height)*Math.sin(angle),0];
assert.equal(L.solar(q(0)).daylight,1);assert.equal(L.solar(q(0)).sunlight,1);
assert.equal(L.solar(q(Math.PI)).daylight,0);assert.equal(L.solar(q(Math.PI)).sunlight,0);
assert.equal(L.solar(q(Math.PI,200000)).sunlight,0);assert.equal(L.solar(q(Math.PI,400000)).sunlight,1,'High spacecraft can see sunlight over a dark ground horizon');
let previous=1;for(let angle=0;angle<2;angle+=.001){const s=L.solar(q(angle));assert(s.daylight<=previous+1e-12&&s.daylight>=0&&s.daylight<=1);previous=s.daylight;}
for(const bad of [[],[NaN,1,0],[0,0,0],[Infinity,0,0]])assert.throws(()=>L.solar(bad));
const before=q(1.4,200000),snapshot=before.slice();L.solar(before);assert.deepEqual(before,snapshot);
const material={isMeshLambertMaterial:true,onBeforeCompile:s=>{s.fragmentShader+='\n/* original hook */';},customProgramCacheKey:()=> 'base'},root={traverse:visit=>visit({material})},uniforms={uShadowEnabled:{value:1}};
L.shade(root,uniforms,0);const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <opaque_fragment>'};material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('original hook')&&shader.fragmentShader.includes('solarVisibility'));assert.equal(shader.uniforms.uBodySunVisibility.value,0);const hook=material.onBeforeCompile;L.shade(root,uniforms,1);assert.equal(material.onBeforeCompile,hook);assert.equal(shader.uniforms.uBodySunVisibility.value,1);assert.equal(material.customProgramCacheKey(),'base-planet-shadow');
console.log('Unified daylight, continuous twilight, Earth-shadow sunlight at 200/400km, validation and no model mutation passed.');
