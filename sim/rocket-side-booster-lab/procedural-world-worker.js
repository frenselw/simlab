'use strict';
importScripts('parts.js', 'procedural-earth.js', 'surface.js');

function clouds(width, height, earth) {
  const pixels = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const lat = -90 + (row + .5) * 180 / height;
    for (let col = 0; col < width; col++) {
      const lon = -180 + (col + .5) * 360 / width;
      const [x, y, z] = earth.direction(lon, lat);
      const drift = earth.noise(x * 4, y * 4, z * 4) * 1.5;
      const coverage = earth.smooth(.48, .68, earth.fbm(x * 13 + drift, y * 16, z * 13 - drift, 3));
      const offset = (row * width + col) * 4;
      pixels.set([245, 250, 255, Math.round(coverage * 255)], offset);
    }
  }
  return {pixels, width, height};
}

function groundPatch({center, east, north, divisions, extent, requestId}) {
  const radius = RocketParts.R, side = divisions + 1;
  const axis = new Float64Array(side), depth = new Float64Array(side ** 2);
  const positions = new Float32Array(depth.length * 3), colors = new Float32Array(positions.length), water = new Float32Array(depth.length);
  for (let i = 0; i < side; i++) {
    const t = 2 * i / divisions - 1;
    axis[i] = extent * (.12 * t + .88 * t ** 3);
  }
  for (let row = 0; row < side; row++) for (let col = 0; col < side; col++) {
    const index = row * side + col, x = axis[col], y = axis[row];
    const direction = center.map((value, i) => value + (east[i] * x + north[i] * y) / radius);
    const length = Math.hypot(...direction);
    const unit = direction.map(value => value / length);
    const height = RocketSurface.heightAt(...unit);
    const fade = 1 - RocketProceduralEarth.smooth(extent * .78, extent, Math.max(Math.abs(x), Math.abs(y)));
    const scale = 1 + fade * (height + 5) / (radius - 5);
    water[index] = Number(RocketSurface.waterAt(...unit));
    colors.set(RocketSurface.colorAt(...unit), index * 3);
    const offset = index * 3;
    positions.set(unit.map(value => value * scale), offset);
    depth[index] = 1 / (center[0] * positions[offset] + center[1] * positions[offset + 1] + center[2] * positions[offset + 2]);
  }
  self.postMessage({requestId, axis, depth, positions, colors, water}, [axis.buffer, depth.buffer, positions.buffer, colors.buffer, water.buffer]);
}

self.onmessage = ({data}) => {
  try {
    if (data.center) {
      groundPatch(data);
      return;
    }
    const {width, includeWeather, scale} = data;
    const world = self.RocketProceduralEarth;
    const globe = world.generateGlobe(width, width / 2, (lon, lat) => RocketSurface.geographicSample(lon, -lat),
      surface => [...world.color(surface), surface.coast < 0 ? 0 : 255], scale);
    const weather = includeWeather ? clouds(512, 256, world) : null;
    const buffers = [globe.pixels.buffer];
    if (weather) buffers.push(weather.pixels.buffer);
    self.postMessage({requestId:data.requestId,globe,weather}, buffers);
  } catch (error) {
    self.postMessage({requestId:data.requestId,error:error.message});
  }
};
