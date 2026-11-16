import * as THREE from '../../../sim/rocket-side-booster-lab/vendor/three-0.185.1/three.module.min.js';
import {sample, color, regionPoint, views, noise, clamp, smooth} from './terrain.mjs';

const canvas = document.getElementById('scene'), stage = document.getElementById('stage');
const started = performance.now(), compact = matchMedia('(max-width: 600px)').matches;
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .001, 500);
const sun = new THREE.Vector3(-.6, .65, 1).normalize();
scene.add(new THREE.HemisphereLight('#eef8ff', '#e5ddbc', .85));
const light = new THREE.DirectionalLight('#fff8e8', 1.7);
light.position.copy(sun).multiplyScalar(100); scene.add(light);
const globe = new THREE.Group(), region = new THREE.Group(); scene.add(globe, region);
const diagnostics = {ready: false, terrainRequests: 0, generationMs: 0, regions: {}, errors: []};
let active = 'globe', yaw = .75, pitch = .18, distance = 3.15;
const target = new THREE.Vector3();
let earth, cloud, halo, regionCache = new Map();

const cloudNoise = `
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*noise3(p);p=p*2.04+7.3;a*=.5;}return s;}
`;
const sphereVertex = `varying vec3 vLocal,vWorld,vNormal;
void main(){vLocal=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
const shadeBands = new THREE.DataTexture(new Uint8Array([96, 152, 208, 255]), 4, 1, THREE.RedFormat);
shadeBands.minFilter = shadeBands.magFilter = THREE.NearestFilter;
shadeBands.generateMipmaps = false; shadeBands.needsUpdate = true;
const material = new THREE.MeshToonMaterial({gradientMap: shadeBands});
earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), material);
globe.add(earth);
cloud = new THREE.Mesh(new THREE.SphereGeometry(1.009, 96, 48), new THREE.ShaderMaterial({
  uniforms: {sun: {value: sun}}, vertexShader: sphereVertex,
  fragmentShader: cloudNoise + `uniform vec3 sun;varying vec3 vLocal,vWorld,vNormal;
void main(){vec3 p=normalize(vLocal);vec3 warp=vec3(fbm(p*4.),fbm(p*4.+11.),fbm(p*4.+23.));
float bands=fbm(p*9.+warp*2.);float coverage=smoothstep(.46,.60,bands);
float light=.8+.22*max(dot(vNormal,sun),0.);gl_FragColor=vec4(vec3(.94,.97,1.)*light,coverage*.82);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`, transparent: true, depthWrite: false
}));
globe.add(cloud);
halo = new THREE.Mesh(new THREE.SphereGeometry(1.025, 96, 48), new THREE.ShaderMaterial({
  uniforms: {sun: {value: sun}}, vertexShader: sphereVertex,
  fragmentShader: `uniform vec3 sun;varying vec3 vLocal,vWorld,vNormal;
void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld))),3.);
float lit=smoothstep(-.25,.7,dot(vNormal,sun));gl_FragColor=vec4(.18,.5,1.,rim*lit*.5);}`,
  transparent: true, side: THREE.BackSide, depthWrite: false
}));
globe.add(halo);

function buildRegion(key) {
  const view = views[key], group = new THREE.Group(), start = performance.now();
  const divisions = compact ? 160 : 224, span = view.span;
  const positions = new Float32Array((divisions + 1) ** 2 * 3), colors = new Float32Array(positions.length);
  const indices = [], samples = [], linear = new THREE.Color(); let minimum = Infinity, maximum = -Infinity;
  for (let row = 0; row <= divisions; row++) {
    for (let col = 0; col <= divisions; col++) {
      const east = (col / divisions - .5) * span, north = (.5 - row / divisions) * span;
      const at = (row * (divisions + 1) + col) * 3, s = regionPoint(view, east, north);
      positions.set([east / 1000, s.height / 1000, -north / 1000], at);
      samples.push(s);
      minimum = Math.min(minimum, s.height); maximum = Math.max(maximum, s.height);
      linear.setRGB(...color(s), THREE.SRGBColorSpace); colors.set(linear.toArray(), at);
      if (row < divisions && col < divisions) {
        const a = row * (divisions + 1) + col, b = a + divisions + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], slope = 1 - normals.getY(i);
    const snow = s.snow * (1 - smooth(.12, .6, slope));
    const rock = smooth(.12, .55, slope) * (1 - s.aridity);
    const rgb = color({...s, snow}).map((v, channel) => v * (1 - rock) + [.65, .72, .74][channel] * rock);
    linear.setRGB(...rgb, THREE.SRGBColorSpace); colors.set(linear.toArray(), i * 3);
  }
  const land = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({vertexColors: true, gradientMap: shadeBands}));
  group.add(land);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(span / 1000, span / 1000), new THREE.MeshToonMaterial({color: '#60bdce', gradientMap: shadeBands}));
  water.rotation.x = -Math.PI / 2; water.position.y = .001; group.add(water);
  if (key === 'forest') {
    const crown = new THREE.ConeGeometry(.013, .045, 7);
    const trees = new THREE.InstancedMesh(crown, new THREE.MeshToonMaterial({color: '#489e70', gradientMap: shadeBands}), 12000);
    const transform = new THREE.Object3D(); let count = 0;
    for (let i = 0; i < 12000; i++) {
      const east = (noise(i, 11, 3) - .5) * span, north = (noise(i, 42, 9) - .5) * span;
      const s = regionPoint(view, east, north);
      if (s.height <= 35 || s.forest < .3) continue;
      if (noise(east / 1000, north / 1000, 31) < .34) continue;
      const gridX = (east / span + .5) * divisions, gridY = (.5 - north / span) * divisions;
      const col = Math.min(divisions - 1, Math.floor(gridX)), row = Math.min(divisions - 1, Math.floor(gridY));
      const u = gridX - col, v = gridY - row, at = row * (divisions + 1) + col;
      const h = offset => positions[(at + offset) * 3 + 1];
      const ground = u + v <= 1 ? h(0) * (1 - u - v) + h(1) * u + h(divisions + 1) * v : h(divisions + 2) * (u + v - 1) + h(1) * (1 - v) + h(divisions + 1) * (1 - u);
      const scale = .6 + noise(i, 71, 2);
      transform.position.set(east / 1000, ground + .0225 * scale, -north / 1000);
      transform.scale.setScalar(scale); transform.updateMatrix();
      trees.setMatrixAt(count++, transform.matrix);
    }
    trees.count = count; group.add(trees);
  }
  diagnostics.regions[key] = {generationMs: performance.now() - start, minimum, maximum, triangles: indices.length / 3, span};
  regionCache.set(key, group); region.add(group);
  return group;
}

function render() {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) renderer.setSize(width, height, false);
  camera.aspect = width / height; camera.updateProjectionMatrix();
  camera.position.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)).multiplyScalar(distance).add(target);
  camera.lookAt(target); renderer.render(scene, camera);
  diagnostics.drawCalls = renderer.info.render.calls; diagnostics.triangles = renderer.info.render.triangles;
}
function select(key) {
  active = key;
  globe.visible = key === 'globe'; region.visible = !globe.visible;
  for (const child of region.children) child.visible = false;
  if (globe.visible) {
    scene.background = new THREE.Color('#142d45'); scene.fog = null;
    target.set(0, 0, 0); yaw = 1.78; pitch = .18;
    distance = 1.14 / Math.sin(Math.atan(Math.tan(21 * Math.PI / 180) * Math.min(1, stage.clientWidth / stage.clientHeight)));
  } else {
    const group = regionCache.get(key) || buildRegion(key); group.visible = true;
    const view = views[key], center = sample(view.lon, view.lat).height / 1000;
    scene.background = new THREE.Color('#cceaf5'); scene.fog = new THREE.Fog('#d5edf2', view.span / 2000, view.span / 520);
    target.set(0, key === 'mountains' ? 2.2 : Math.max(0, center) * .75, 0); yaw = -.35; pitch = key === 'mountains' ? .38 : .18; distance = view.distance * (compact ? 1.12 : 1);
  }
  document.getElementById('place').textContent = views[key].label;
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === key));
  document.getElementById('clouds').disabled = !globe.visible;
  render();
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => select(button.dataset.view));
document.getElementById('clouds').addEventListener('change', event => {cloud.visible = event.target.checked; render();});

const pointers = new Map(); let previous = null;
function gesture() {
  const points = [...pointers.values()];
  return {x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length,
    separation: points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0};
}
function pan(dx, dy) {
  const scale = distance * .0015;
  target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), -dx * scale);
  target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), dy * scale);
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x: e.clientX, y: e.clientY}); previous = gesture();
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x: e.clientX, y: e.clientY}); const next = gesture();
  if (pointers.size > 1 || e.shiftKey) pan(next.x - previous.x, next.y - previous.y);
  else {yaw -= (next.x - previous.x) * .006; pitch = clamp(pitch + (next.y - previous.y) * .006, -1.5, 1.5);}
  if (previous.separation > 0 && next.separation > 0) distance *= previous.separation / next.separation;
  distance = clamp(distance, active === 'globe' ? 1.15 : 2, active === 'globe' ? 10 : 100);
  previous = next; render();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, e => {
  pointers.delete(e.pointerId); previous = pointers.size ? gesture() : null;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault(); distance = clamp(distance * Math.exp(clamp(e.deltaY, -300, 300) * .0015), active === 'globe' ? 1.15 : 2, active === 'globe' ? 10 : 100); render();
}, {passive: false});
canvas.addEventListener('keydown', e => {
  const actions = {ArrowLeft: () => yaw -= .12, ArrowRight: () => yaw += .12, ArrowUp: () => pitch = Math.min(1.5, pitch + .1), ArrowDown: () => pitch = Math.max(-1.5, pitch - .1), '+': () => distance *= .9, '-': () => distance *= 1.1};
  if (actions[e.key]) {e.preventDefault(); actions[e.key](); render();}
});
new ResizeObserver(render).observe(stage);
window.preview = {diagnostics, select, render, get camera() {return {yaw, pitch, distance, target: target.toArray()};}};
const worker = new Worker(new URL('./generate.mjs', import.meta.url), {type: 'module'});
worker.onerror = event => {diagnostics.errors.push(event.message); document.getElementById('loading').textContent = '地球生成失敗，請重新載入。'; worker.terminate();};
worker.onmessage = ({data}) => {
  const texture = new THREE.DataTexture(data.pixels, data.width, data.height);
  texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = true;
  texture.wrapS = THREE.RepeatWrapping; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  material.map = texture; material.needsUpdate = true;
  diagnostics.globe = {width: data.width, height: data.height, coastalSamples: data.coastalSamples};
  diagnostics.generationMs = data.ms; diagnostics.readyMs = performance.now() - started; diagnostics.ready = true;
  document.getElementById('loading').hidden = true;
  document.getElementById('metrics').textContent = '地形及圖片下載 0 B · 地球表面運算 ' + (data.ms / 1000).toFixed(2) + ' 秒';
  worker.terminate(); select('globe');
};
worker.postMessage({width: compact ? 512 : 1024, height: compact ? 256 : 512});
select('globe');
