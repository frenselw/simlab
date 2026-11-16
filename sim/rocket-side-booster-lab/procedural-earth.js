(function (root) {
  'use strict';
  const MAX_HEIGHT = 8500;
  const radians = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  function smooth(a, b, x) {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  function hash(x, y, z) {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ 731;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy), w = smooth(0, 1, z - iz);
    const mix = (a, b, t) => a + (b - a) * t;
    return mix(mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), u),
      mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u), v),
    mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u),
      mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u), v), w);
  }
  function fbm(x, y, z, octaves = 4) {
    let sum = 0, weight = .5, total = 0;
    for (let i = 0; i < octaves; i++) {
      sum += weight * noise(x, y, z);
      total += weight;
      x = x * 2.03 + 17.1; y = y * 2.03 + 31.7; z = z * 2.03 + 5.3;
      weight *= .5;
    }
    return sum / total;
  }
  function direction(lon, lat) {
    const c = Math.cos(lat * radians);
    return [c * Math.cos(lon * radians), Math.sin(lat * radians), c * Math.sin(lon * radians)];
  }
  // Hand-designed continental lobes, in degrees. The last value tilts the long axis.
  const continents = [
    [-151, 63, 24, 9, 10], [-118, 54, 24, 21], [-90, 44, 24, 18, 8], [-66, 51, 15, 12, 16],
    [-106, 25, 12, 10, -30], [-87, 14, 10, 4, -31], [-78, 21, 7, 2, -12],
    [-69, 2, 14, 15], [-57, -11, 22, 17, 20], [-66, -31, 22, 9, -77], [-42, 72, 18, 11, 24],
    [-7, 15, 16, 13], [12, 22, 24, 13, 4], [25, 6, 20, 18, 12], [26, -17, 19, 12, -82],
    [46, 7, 7, 4, 39], [47, -19, 8, 2.5, 62],
    [-2, 43, 12, 6, 14], [13, 51, 14, 9], [-4, 56, 5, 3, -66], [19, 65, 13, 5, 72],
    [45, 55, 28, 16], [86, 55, 31, 21], [125, 53, 31, 20], [160, 63, 19, 12, -24],
    [48, 24, 13, 7, -32], [64, 34, 21, 9], [93, 35, 25, 13], [78, 19, 10, 7, -72],
    [105, 19, 14, 7, -53], [115, 30, 16, 12, 14], [138, 37, 9, 2.7, 47], [123, 12, 7, 2.6, -55],
    [101, -1, 9, 2.7, -42], [114, 1, 6, 4, 53], [113, -8, 10, 2, -7], [143, -6, 11, 3.4, -16],
    [133, -25, 23, 13, 9], [146, -36, 8, 4, 20], [172, -42, 8, 2.3, 51]
  ].map(([lon, lat, width, height, degrees = 0]) => [lon, lat, width, height, Math.cos(degrees * radians), Math.sin(degrees * radians), Math.max(width, height) * 1.6]);
  const belts = [[-121, 48, -108, 29, 3.6, 3900], [-74, 9, -71, -47, 3, 5600],
    [4, 45, 19, 48, 2.2, 4600], [65, 33, 99, 29, 3.7, 6500],
    [37, 12, 34, -13, 3.2, 2700], [98, 30, 120, 47, 4, 2800]];
  function longitudeDelta(a, b) { return ((a - b + 540) % 360) - 180; }
  function coastField(lon, lat, x, y, z, large) {
    const east = lon + 6 * (noise(x * 8 + 10, y * 8, z * 8) - .5);
    const north = lat + 5 * (noise(x * 8, y * 8 + 18, z * 8) - .5);
    const blend = .24;
    let land = Math.max(-1.1, 1 - ((north + 90) / 18) ** 2);
    for (const [cx, cy, width, height, cos, sin, reach] of continents) {
      const dy = north - cy;
      if (Math.abs(dy) > reach) continue;
      const dx = longitudeDelta(east, cx);
      if (Math.abs(dx) > reach) continue;
      const lobe = 1 - ((dx * cos + dy * sin) / width) ** 2 - ((dy * cos - dx * sin) / height) ** 2;
      const overlap = Math.max(0, blend - Math.abs(land - lobe));
      land = Math.max(land, lobe) + overlap ** 2 / (4 * blend);
    }
    const coast = land + .46 * (large - .5);
    const detail = 1 - smooth(.13, .3, Math.abs(coast));
    if (!detail) return coast;
    const bays = fbm(x * 38 + 7, y * 38, z * 38, 3) - .5;
    const inlets = noise(x * 170, y * 170 + 31, z * 170) - .5;
    const coves = noise(x * 510 + 29, y * 510, z * 510) - .5;
    return coast + detail * (.21 * bays + .075 * inlets + .023 * coves);
  }
  function mountainWeight(lon, lat, belt) {
    const [ax, ay, bx, by, width, amplitude] = belt;
    const x = longitudeDelta(lon, ax), y = lat - ay, dx = longitudeDelta(bx, ax), dy = by - ay;
    const t = clamp((x * dx + y * dy) / (dx * dx + dy * dy));
    return amplitude * Math.exp(-((x - t * dx) ** 2 + (y - t * dy) ** 2) / width ** 2);
  }
  function sample(lon, lat) {
    if (Math.abs(lat) === 90) lon = 0;
    const [x, y, z] = direction(lon, lat);
    const large = fbm(x * 7, y * 7, z * 7, 3);
    const coast = coastField(lon, lat, x, y, z, large);
    const continental = smooth(0, .21, coast);
    const low = fbm(x * 90, y * 90, z * 90);
    const warp = (fbm(x * 25, y * 25, z * 25, 3) - .5) * 1.2;
    let mountain = 0;
    for (const belt of belts) mountain = Math.max(mountain, mountainWeight(lon + warp, lat + warp * .4, belt));
    const massif = fbm(x * 140, y * 140, z * 140, 4);
    const ridge = (1 - Math.abs(2 * noise(x * 480, y * 480, z * 480) - 1)) ** 2;
    const secondary = (1 - Math.abs(2 * noise(x * 1350, y * 1350, z * 1350) - 1)) ** 2;
    const fine = fbm(x * 5500, y * 5500, z * 5500, 3);
    const foothills = fbm(x * 530 + 6, y * 370, z * 530, 3);
    const valleys = (1 - Math.abs(2 * noise(x * 2230, y * 1510 + 17, z * 2230) - 1)) ** 3;
    const highland = smooth(400, 3000, mountain);
    const hill = 90 + 450 * low ** 2 + 65 * fine + 250 * foothills ** 2;
    const duneMask = smooth(.25, .7, .65 - Math.abs(Math.abs(lat) - 25) / 40 + (large - .5) * .5);
    const dune = ((Math.sin(x * 60000 + z * 22000 + fbm(x * 4500, y * 4500, z * 4500, 2) * 4) + 1) * .5) ** 3;
    const uplift = mountain * (.07 + .93 * ridge) * (.5 + .85 * massif) * (.68 + .32 * secondary);
    const ravines = (55 + 285 * highland) * valleys * smooth(90, 650, hill + uplift);
    const relief = hill + uplift - ravines + 85 * dune * duneMask;
    const raw = coast >= 0 ? continental * relief + 12 * (1 - continental) * coast : 1250 * coast;
    const height = clamp(raw, -5000, MAX_HEIGHT);
    const aridity = smooth(.25, .7, .65 - Math.abs(Math.abs(lat) - 25) / 40 + (large - .5) * .5);
    const snow = Math.max(smooth(59, 78, Math.abs(lat)), smooth(3000 - Math.abs(lat) * 12, 4300 - Math.abs(lat) * 12, height));
    const forest = (1 - aridity) * (1 - smooth(1700, 2900, height)) * (1 - snow);
    return {height, coast, aridity, snow, forest, variation: fine, mountain};
  }
  function color(s) {
    if (s.height < 0) {
      const shore = Math.exp(s.height / 75);
      return [.19 + shore * .20, .54 + shore * .25, .72 + shore * .10];
    }
    let rgb = [.43, .72, .40].map((v, i) => v * (1 - s.aridity) + [.93, .75, .46][i] * s.aridity);
    const forest = s.forest * .55, rock = smooth(1000, 3800, s.height) * (1 - s.snow) * .7;
    rgb = rgb.map((v, i) => v * (1 - forest) + [.24, .58, .37][i] * forest);
    rgb = rgb.map((v, i) => v * (1 - rock) + [.62, .69, .67][i] * rock);
    const beach = 1 - smooth(.001, .032, s.coast);
    const edge = smooth(0, .011, s.coast);
    return rgb.map((v, i) => {
      const land = (v * (1 - s.snow) + [.94, .97, .99][i] * s.snow) * (.92 + s.variation * .16);
      const shore = land * (1 - beach) + [.88, .82, .59][i] * beach;
      return [.39, .79, .82][i] * (1 - edge) + shore * edge;
    });
  }

  function writeColor(pixels, offset, rgb) {
    for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(Math.min(1, rgb[channel]) * 255);
    pixels[offset + 3] = rgb[3] ?? 255;
  }

  function generateGlobe(width, height, sample, color, scale = 2) {
    const base = new Uint8Array(width * height * 4), coast = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      const lat = 90 - (y + .5) / height * 180;
      for (let x = 0; x < width; x++) {
        const lon = (x + .5) / width * 360 - 180;
        const surface = sample(lon, lat), index = y * width + x;
        coast[index] = surface.coast;
        writeColor(base, index * 4, color(surface));
      }
    }

    const columns = width * scale, rows = height * scale;
    const pixels = new Uint8Array(columns * rows * 4);
    let coastalSamples = 0;
    for (let y = 0; y < rows; y++) {
      const lat = 90 - (y + .5) / rows * 180;
      const sourceY = (y + .5) / scale - .5, row = Math.floor(sourceY), v = sourceY - row;
      const top = Math.max(0, row) * width, bottom = Math.min(height - 1, row + 1) * width;
      for (let x = 0; x < columns; x++) {
        const sourceX = (x + .5) / scale - .5, column = Math.floor(sourceX), u = sourceX - column;
        const left = (column + width) % width, right = (column + 1) % width;
        const a = top + left, b = top + right, c = bottom + left, d = bottom + right;
        const low = Math.min(coast[a], coast[b], coast[c], coast[d]);
        const high = Math.max(coast[a], coast[b], coast[c], coast[d]);
        const offset = (y * columns + x) * 4;
        if (low <= .16 && high >= -.16) {
          const lon = (x + .5) / columns * 360 - 180;
          writeColor(pixels, offset, color(sample(lon, lat)));
          coastalSamples++;
          continue;
        }
        for (let channel = 0; channel < 4; channel++) {
          const north = base[a * 4 + channel] * (1 - u) + base[b * 4 + channel] * u;
          const south = base[c * 4 + channel] * (1 - u) + base[d * 4 + channel] * u;
          pixels[offset + channel] = Math.round(north * (1 - v) + south * v);
        }
      }
    }
    return {pixels, width: columns, height: rows, coastalSamples};
  }
  const earth = Object.freeze({MAX_HEIGHT, clamp, smooth, direction, noise, fbm, sample, color, generateGlobe});
  if (typeof module === 'object' && module.exports) module.exports = earth;
  else root.RocketProceduralEarth = earth;
})(globalThis);
