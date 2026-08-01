import * as THREE from "./vendor/three-0.185.1/three.module.min.js";

const LABEL = "Three.js 0.185.1";

function geometryFor(problem) {
  const [x, y, z] = problem.axes;
  if (problem.type === "sphere") return new THREE.SphereGeometry(x, 48, 32);
  return new THREE.BoxGeometry(x * 2, y * 2, z * 2);
}

function create(canvas, problem, onContext) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdde7e8);
  scene.fog = new THREE.Fog(0xdde7e8, 6, 11);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  camera.position.set(0, 0, 6.2);
  scene.add(new THREE.HemisphereLight(0xf8fbff, 0x6d5946, 2.4));
  const key = new THREE.DirectionalLight(0xfff0d2, 3.2); key.position.set(-3, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fc8e4, 2.1); rim.position.set(4, 1, -4); scene.add(rim);
  const group = new THREE.Group(); scene.add(group);
  const geometry = geometryFor(problem);
  const solid = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ color: 0x6ba3bf, roughness: .28, metalness: .03, transparent: true, opacity: .54, transmission: .12, thickness: .9, side: THREE.DoubleSide, depthWrite: false }));
  group.add(solid);
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), new THREE.LineBasicMaterial({ color: 0x163e58, transparent: true, opacity: .92 })));
  if (problem.type === "sphere") {
    const ringMaterial = new THREE.LineBasicMaterial({ color: 0x214e67, transparent: true, opacity: .55 });
    for (const rotation of [[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0]]) {
      const points = Array.from({length:65},(_,i)=>{const a=i*Math.PI*2/64;return new THREE.Vector3(Math.cos(a)*problem.axes[0],Math.sin(a)*problem.axes[0],0)});
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial); ring.rotation.set(...rotation); group.add(ring);
    }
  }
  const candidateMeshes = new Map();
  for (const candidate of problem.candidates) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.065, 18, 12), new THREE.MeshStandardMaterial({ color: 0xf2a444, emissive: 0x6a270b, emissiveIntensity: .15, roughness: .35 }));
    dot.position.fromArray(candidate.position); dot.userData.key = candidate.key; group.add(dot); candidateMeshes.set(candidate.key, dot);
  }
  const grid = new THREE.GridHelper(8, 16, 0x82949c, 0xb9c4c7); grid.position.y = -1.75; scene.add(grid);
  let lost = false;
  const lostHandler = (event) => { event.preventDefault(); lost = true; onContext?.("lost"); };
  const restoredHandler = () => { lost = false; onContext?.("restored"); };
  canvas.addEventListener("webglcontextlost", lostHandler, false);
  canvas.addEventListener("webglcontextrestored", restoredHandler, false);
  function render(view, selectedKey) {
    if (lost) return [];
    const rect = canvas.getBoundingClientRect(), width = Math.max(2, Math.round(rect.width * Math.min(devicePixelRatio || 1, 2))), height = Math.max(2, Math.round(rect.height * Math.min(devicePixelRatio || 1, 2)));
    if (canvas.width !== width || canvas.height !== height) renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
    group.rotation.order = "YXZ"; group.rotation.y = view.yaw10 * Math.PI / 1800; group.rotation.x = view.pitch10 * Math.PI / 1800;
    const projected = [];
    for (const [keyName, mesh] of candidateMeshes) {
      mesh.material.color.setHex(keyName === selectedKey ? 0xd34d32 : 0xf2a444);
      mesh.scale.setScalar(keyName === selectedKey ? 1.45 : 1);
      const point = mesh.getWorldPosition(new THREE.Vector3()).project(camera);
      projected.push({ key:keyName, x:(point.x*.5+.5)*700, y:(.5-point.y*.5)*460, depth:-point.z });
    }
    renderer.render(scene, camera);
    canvas.dataset.renderer = "three"; canvas.dataset.frame = String((Number(canvas.dataset.frame)||0)+1);
    return projected.sort((a,b)=>a.depth-b.depth);
  }
  function dispose() { canvas.removeEventListener("webglcontextlost",lostHandler);canvas.removeEventListener("webglcontextrestored",restoredHandler);geometry.dispose();renderer.dispose(); }
  return { label:LABEL, render, dispose, context:renderer.getContext() };
}

window.CentreMassPart3Renderer = { create, label: LABEL };
window.dispatchEvent(new CustomEvent("centre-mass-renderer-ready"));
