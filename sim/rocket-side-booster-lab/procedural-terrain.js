import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import {groundLight, terrainLighting, terrainSlopeDetail, surfaceUniforms, requestProceduralWorld} from './terrain.js';

export function createProceduralTerrain(sun) {
  const surface = window.RocketSurface, radius = window.RocketParts.R;
  const group = new THREE.Group(), regional = {value: 0};
  const compact = innerWidth < 960 || matchMedia('(pointer: coarse)').matches;
  const divisions = compact ? 64 : 80, side = divisions + 1, extent = 145000;
  const positions = new Float32Array(side ** 2 * 3), colors = new Float32Array(positions.length);
  const water = new Float32Array(side ** 2), indices = [];
  for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions; col++) {
    const a = row * side + col, b = a + side;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('surfaceWater', new THREE.BufferAttribute(water, 1));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({vertexColors: true});
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, surfaceUniforms, {uRegional: regional, uSun: {value: sun}, uSlopeDetail: terrainSlopeDetail});
    shader.vertexShader = `attribute float surfaceWater;
varying float vSurfaceWater;
varying vec3 vRadial,vSlope,vGroundPoint,vGroundWorld;
` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vSurfaceWater=surfaceWater;
vGroundPoint=position;
vGroundWorld=(modelMatrix*vec4(position,1.0)).xyz;
vRadial=normalize(mat3(modelMatrix)*position);
vSlope=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader = groundLight + `uniform float uRegional;
uniform vec3 uSun;
varying float vSurfaceWater;
varying vec3 vRadial,vSlope,vGroundPoint,vGroundWorld;
` + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if(dot(normalize(vRadial),cameraPosition-vGroundWorld)<=0.0||vSurfaceWater>.5)discard;
if(uRegional>.5&&vGroundPoint.y>0.0&&max(abs(vGroundPoint.x),abs(vGroundPoint.z))*6371000.0<211200.0)discard;`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + terrainLighting);
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = -1;
  group.add(mesh);
  const center = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3();
  let axis, depth, retryAfter = 0, requested;
  const stats = group.userData = {procedural: true, active: [], rebuilds: 0, fineTriangles: 0, pending: false, centerSpacing: 0};

  function rebuild(direction) {
    const tangent = new THREE.Vector3(0, 1, 0).cross(direction);
    if (tangent.lengthSq() < .001) tangent.set(1, 0, 0).cross(direction);
    tangent.normalize();
    const transverse = new THREE.Vector3().crossVectors(direction, tangent).normalize();
    stats.pending = true;
    const finish = data => {
      stats.pending = false;
      if (!data) retryAfter = performance.now() + 1500;
      else if (requested && requested.distanceToSquared(direction) < (42000 / radius) ** 2) {
        center.copy(direction); east.copy(tangent); north.copy(transverse);
        axis = data.axis; depth = data.depth;
        positions.set(data.positions); colors.set(data.colors); water.set(data.water);
        for (const name of ['position', 'color', 'surfaceWater']) geometry.getAttribute(name).needsUpdate = true;
        geometry.computeVertexNormals();
        stats.centerSpacing = axis[divisions / 2 + 1];
        stats.rebuilds++;
      }
      group.onChange?.();
    };
    requestProceduralWorld({center:direction.toArray(),east:tangent.toArray(),north:transverse.toArray(),divisions,extent})
      .then(finish,()=>finish(null));
  }

  function interval(value) {
    let low = 0, high = divisions;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (axis[mid] <= value) low = mid;
      else high = mid;
    }
    return low;
  }

  group.surfaceHeight = direction => {
    const forward = direction.dot(center);
    if (!mesh.visible || forward <= 0) return -5;
    const x = direction.dot(east) * radius / forward, y = direction.dot(north) * radius / forward;
    if (Math.abs(x) >= extent || Math.abs(y) >= extent) return -5;
    const col = interval(x), row = interval(y), i = row * side + col;
    const u = (x - axis[col]) / (axis[col + 1] - axis[col]), v = (y - axis[row]) / (axis[row + 1] - axis[row]);
    const projected = u + v <= 1 ? depth[i] * (1 - u - v) + depth[i + 1] * u + depth[i + side] * v
      : depth[i + side + 1] * (u + v - 1) + depth[i + 1] * (1 - v) + depth[i + side] * (1 - u);
    return (radius - 5) / (projected * forward) - radius;
  };
  group.colorAt = (direction, out) => out.setRGB(...surface.colorAt(direction.x, direction.y, direction.z));
  group.advanceDetail = () => false;
  group.updateDetail = (camera, pixels, quality, enabled, localVisible, allowFine, flight) => {
    group.visible = Boolean(enabled); regional.value = Number(localVisible);
    surfaceUniforms.uOrbitalBlend.value = camera.isOrthographicCamera ? 1 : 0;
    const active = enabled && flight && !camera.isOrthographicCamera && surface.clearance(flight.state) < 115000;
    requested = null;
    mesh.visible = false;
    if (active) {
      const direction = new THREE.Vector3(...surface.direction(flight.state));
      const overlapsLocal = !localVisible || direction.y < .99 || Math.max(Math.abs(direction.x), Math.abs(direction.z)) * radius > 90000;
      if (overlapsLocal) {
        requested = direction;
        const distance = center.distanceToSquared(direction);
        mesh.visible = Boolean(axis && distance < (95000 / radius) ** 2);
        if (!stats.pending && performance.now() >= retryAfter && distance > (8000 / radius) ** 2) rebuild(direction);
      }
    }
    stats.active = mesh.visible ? [stats.rebuilds] : [];
    stats.fineTriangles = mesh.visible ? indices.length / 3 : 0;
  };
  return group;
}
