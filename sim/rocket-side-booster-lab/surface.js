(function (root) {
  'use strict';
  const common = typeof module === 'object' && module.exports;
  const P = common ? require('./parts.js') : root.RocketParts;
  const earth = common ? require('./procedural-earth.js') : root.RocketProceduralEarth;
  const {smooth, noise, color, MAX_HEIGHT} = earth;
  const LAT = .605629, LON = -2.101376, degrees = 180 / Math.PI;
  const sinLat = Math.sin(LAT), cosLat = Math.cos(LAT), sinLon = Math.sin(LON), cosLon = Math.cos(LON);
  const coastOffset = 20600;
  const coastWaves = Object.freeze([[2150,9600,0],[740,2700,0],[260,850,.6],[100,290,0]].map(Object.freeze));

  function siteShore(x, z) {
    return coastWaves.reduce((distance,[amplitude,period,phase]) => distance + amplitude * Math.sin(z / period + phase), x + coastOffset);
  }

  function launchFoothills(x, z, distance) {
    const ridge = (1 - Math.abs(2 * noise(x / 680 + z / 1300, z / 620, 19) - 1)) ** 2;
    const banks = noise(x / 205, z / 230, 27);
    const westHill = 42 * Math.exp(-((x + 160) ** 2 + (z + 150) ** 2) / 21500);
    const eastHill = 68 * Math.exp(-((x - 245) ** 2 + (z + 205) ** 2) / 31000);
    const channels = noise(x / 172 + z / 360, z / 112, 37);
    const gullies = (5 + 15 * smooth(150, 1700, distance)) * (1 - channels) ** 2;
    const height = (22 + 210 * smooth(140, 3400, distance)) * (.13 + .66 * ridge + .21 * banks);
    return Math.max(0,height + westHill + eastHill - gullies) * smooth(45, 140, distance) * (1 - smooth(3200, 9500, distance));
  }

  function geographic(e, u, n) {
    const x = -e * sinLon + (u * cosLat - n * sinLat) * cosLon;
    const y = u * sinLat + n * cosLat;
    const z = e * cosLon + (u * cosLat - n * sinLat) * sinLon;
    return [Math.atan2(z, x) * degrees, Math.asin(earth.clamp(y, -1, 1)) * degrees];
  }

  function fromGeocentric(x, y, z) {
    const equator = x * cosLon + y * sinLon;
    return [-x * sinLon + y * cosLon, equator * cosLat + z * sinLat, -equator * sinLat + z * cosLat];
  }

  function samplePosition(lon, lat, e, u, n) {
    const surface = earth.sample(lon, lat);
    if (u < .9998) return surface;
    const x = e * P.R, z = n * P.R, distance = Math.hypot(x, z);
    const site = 1 - smooth(30000, 95000, distance);
    if (!site) return surface;
    const shore = siteShore(x, z) / 18000;
    const hills = distance < 9500 ? launchFoothills(x, z, distance) : 0;
    const inland = (Math.max(0, surface.height) * smooth(2900, 9500, distance) + hills) * smooth(0, .75, shore);
    const local = shore < 0 ? shore * 400 : inland;
    const coast = shore * site + surface.coast * (1 - site);
    const rawHeight = local * site + surface.height * (1 - site);
    const height = coast < 0 ? coast * 400 : Math.max(0, rawHeight) * smooth(0, .15, coast);
    const forest = site * (.35 + .55 * noise(x / 6200, z / 6200, 12)) + (1 - site) * surface.forest;
    return {...surface, height, coast, forest};
  }

  function geographicSample(lon, lat) {
    if (lon < -122 || lon > -119 || lat < 33 || lat > 36) return earth.sample(lon, lat);
    const [x, z, y] = earth.direction(lon, lat);
    return samplePosition(lon, lat, ...fromGeocentric(x, y, z));
  }

  let previousE, previousU, previousN, previous;
  function sampleAt(e, u, n) {
    if (e !== previousE || u !== previousU || n !== previousN) {
      previous = samplePosition(...geographic(e, u, n), e, u, n);
      previousE = e;
      previousU = u;
      previousN = n;
    }
    return previous;
  }

  const toLinear = value => value < .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  const colorAt = (e, u, n) => color(sampleAt(e, u, n)).map(toLinear);
  const heightAt = (e, u, n) => Math.max(0, sampleAt(e, u, n).height);
  const waterAt = (e, u, n) => sampleAt(e, u, n).coast < 0;
  const forestAt = (e, u, n) => sampleAt(e, u, n).forest;

  // The flight integrator stores north in Z and exchanges up and east.
  function direction(q) {
    const nz = q[2] || 0, radius = Math.hypot(q[0], q[1], nz);
    return [q[1] / radius, q[0] / radius, nz / radius];
  }
  const height = q => heightAt(...direction(q));
  const radius = q => P.R + height(q);
  const clearance = q => Math.hypot(q[0], q[1], q[2] || 0) - radius(q);
  const isWater = q => waterAt(...direction(q));
  const api = Object.freeze({MAX_HEIGHT, coastOffset, coastWaves, geographic, fromGeocentric, geographicSample, sampleAt, direction, colorAt, heightAt, waterAt, forestAt, height, radius, clearance, isWater});
  if (common) module.exports = api;
  root.RocketSurface = api;
})(typeof window === 'undefined' ? globalThis : window);
