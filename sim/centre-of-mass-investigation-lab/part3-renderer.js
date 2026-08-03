import * as THREE from "./vendor/three-0.185.1/three.module.min.js";

const LABEL = "Three.js 0.185.1";
const CANDIDATE_COLORS = Object.freeze({ A: 0x2563eb, B: 0xdb2777, C: 0x16a34a, D: 0xea580c, E: 0x7c3aed });

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
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  camera.position.set(0, 0, 6.2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(-3, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfdbfe, 1.6); rim.position.set(4, 1, -4); scene.add(rim);
  const group = new THREE.Group(); scene.add(group);
  const geometry = geometryFor(problem);
  const solid = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ color: 0x60a5fa, roughness: .36, metalness: 0, transparent: true, opacity: .42, transmission: .08, thickness: .6, side: THREE.DoubleSide, depthWrite: false }));
  group.add(solid);
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: .62 })));
  if (problem.type === "sphere") {
    const radius = problem.axes[0], sphereGuides = new THREE.Group();
    const guideMaterials = [
      new THREE.LineBasicMaterial({ color: 0x1e40af, transparent: true, opacity: .42, depthTest: false, depthWrite: false }),
      new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: .9, depthTest: false, depthWrite: false })
    ];
    const addLoop = (points, material, renderOrder = 2) => {
      const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
      loop.renderOrder = renderOrder; sphereGuides.add(loop); return loop;
    };
    for (const latitude of [-.48, 0, .48]) {
      const y = Math.sin(latitude) * radius, ringRadius = Math.cos(latitude) * radius;
      addLoop(Array.from({ length: 96 }, (_, i) => { const angle = i * Math.PI * 2 / 96; return new THREE.Vector3(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius); }), guideMaterials[0]);
    }
    for (const longitude of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      addLoop(Array.from({ length: 96 }, (_, i) => { const latitude = -Math.PI / 2 + i * Math.PI / 95; return new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude) * radius, Math.sin(latitude) * radius, Math.cos(latitude) * Math.sin(longitude) * radius); }), longitude === 0 ? guideMaterials[1] : guideMaterials[0]);
    }
    sphereGuides.renderOrder = 2; group.add(sphereGuides);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, depthWrite: false });
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 10), markerMaterial); marker.position.set(radius * 1.04, 0, 0); marker.renderOrder = 5; group.add(marker);
    const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(radius * .79, 0, 0), new THREE.Vector3(radius * 1.01, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: .9, depthTest: false, depthWrite: false })); stem.renderOrder = 4; group.add(stem);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.105, .2, 12), markerMaterial); arrow.position.set(radius * 1.13, 0, 0); arrow.rotation.z = -Math.PI / 2; arrow.renderOrder = 5; group.add(arrow);
  }
  const candidateMeshes = new Map();
  for (const candidate of problem.candidates) {
    const marker = new THREE.Group();
    const halo = new THREE.Mesh(new THREE.SphereGeometry(.09, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.06, 20, 14), new THREE.MeshBasicMaterial({ color: CANDIDATE_COLORS[candidate.key], depthTest: false, depthWrite: false }));
    marker.position.fromArray(candidate.position); marker.userData.key = candidate.key;
    halo.visible = false; halo.renderOrder = 6; dot.renderOrder = 7; marker.add(halo, dot); group.add(marker);
    candidateMeshes.set(candidate.key, { marker, dot, halo });
  }
  const grid = new THREE.GridHelper(8, 16, 0xd1d5db, 0xe5e7eb); grid.position.y = -1.75; scene.add(grid);
  let lost = false;
  const lostHandler = (event) => { event.preventDefault(); lost = true; onContext?.("lost"); };
  const restoredHandler = () => { lost = false; onContext?.("restored"); };
  canvas.addEventListener("webglcontextlost", lostHandler, false);
  canvas.addEventListener("webglcontextrestored", restoredHandler, false);
  function render(view, selectedKey) {
    if (lost) return [];
    const rect = canvas.getBoundingClientRect(), cssWidth=Math.max(2,rect.width),cssHeight=Math.max(2,rect.height),width = Math.max(2, Math.round(cssWidth * Math.min(devicePixelRatio || 1, 2))), height = Math.max(2, Math.round(cssHeight * Math.min(devicePixelRatio || 1, 2)));
    if (canvas.width !== width || canvas.height !== height) renderer.setSize(cssWidth, cssHeight, false);
    camera.aspect = cssWidth / cssHeight; camera.updateProjectionMatrix();
    group.rotation.order = "YXZ"; group.rotation.y = view.yaw10 * Math.PI / 1800; group.rotation.x = view.pitch10 * Math.PI / 1800;
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const projected = [];
    for (const [keyName, candidate] of candidateMeshes) {
      candidate.dot.material.color.setHex(CANDIDATE_COLORS[keyName]);
      candidate.halo.visible = keyName === selectedKey;
      const point = candidate.marker.getWorldPosition(new THREE.Vector3()).project(camera);
      projected.push({ key:keyName, x:(point.x*.5+.5)*700, y:(.5-point.y*.5)*460, depth:-point.z });
    }
    renderer.render(scene, camera);
    canvas.dataset.renderer = "three"; canvas.dataset.frame = String((Number(canvas.dataset.frame)||0)+1);
    return projected.sort((a,b)=>a.depth-b.depth);
  }
  function dispose() {
    canvas.removeEventListener("webglcontextlost",lostHandler); canvas.removeEventListener("webglcontextrestored",restoredHandler);
    const geometries = new Set(), materials = new Set();
    scene.traverse((object) => { if (object.geometry) geometries.add(object.geometry); for (const material of (Array.isArray(object.material) ? object.material : [object.material])) if (material) materials.add(material); });
    geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose()); renderer.dispose();
  }
  return { label:LABEL, render, dispose, context:renderer.getContext() };
}

window.CentreMassPart3Renderer = { create, label: LABEL };
window.dispatchEvent(new CustomEvent("centre-mass-renderer-ready"));
