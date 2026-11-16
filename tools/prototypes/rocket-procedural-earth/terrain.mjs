import '../../../sim/rocket-side-booster-lab/procedural-earth.js';
export const RADIUS = 6371000;
const radians = Math.PI / 180;
const earth = globalThis.RocketProceduralEarth;
export const {MAX_HEIGHT, clamp, smooth, direction, noise, fbm, sample, color, generateGlobe} = earth ?? (await import('../../../sim/rocket-side-booster-lab/procedural-earth.js')).default;
export const views = {
  globe: {label: '地球全貌'},
  mountains: {label: '山脈與雪地', lon: 9.66, lat: 46.52, span: 55000, distance: 22},
  forest: {label: '森林與丘陵', lon: -124, lat: 46.5, span: 16000, distance: 7},
  desert: {label: '沙漠與平原', lon: 18, lat: 24, span: 6500, distance: 2.8}
};
export function regionPoint(view, east, north) {
  const lon = view.lon + east / (RADIUS * Math.cos(view.lat * radians)) / radians;
  const lat = view.lat + north / RADIUS / radians;
  return {lon, lat, ...sample(lon, lat)};
}
