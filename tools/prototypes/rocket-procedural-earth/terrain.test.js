const assert = require('node:assert/strict');

(async () => {
  const {sample, regionPoint, views, MAX_HEIGHT} = await import('./terrain.mjs');
  let land = 0, water = 0, maximum = -Infinity, minimum = Infinity;
  for (let lat = -89; lat <= 89; lat += 2) {
    for (let lon = -180; lon < 180; lon += 2) {
      const s = sample(lon, lat);
      assert(Object.values(s).every(Number.isFinite));
      assert(s.height <= MAX_HEIGHT && s.height >= -5000);
      assert.deepEqual(s, sample(lon, lat));
      maximum = Math.max(maximum, s.height); minimum = Math.min(minimum, s.height);
      if (s.height > 0) land++; else water++;
    }
    const west = sample(-180, lat), east = sample(180, lat);
    assert(Math.abs(west.height - east.height) < 1e-7);
    assert(Math.abs(west.coast - east.coast) < 1e-9);
  }
  assert(land > 2000 && water > 2000 && maximum > 4000 && minimum < -1000);
  for (const [lon, lat, isLand] of [[47, -19, true], [41, -21, false], [138, 37, true], [150, 37, false], [-58, -10, true], [-30, -10, false]]) {
    const s = sample(lon, lat);
    assert.equal(s.coast > 0, isLand, `Coast near ${lon}, ${lat}`);
    assert.equal(s.height > 0, isLand);
  }
  assert(sample(18, 24).aridity > .5);
  assert(sample(0, -89).snow > .95);
  for (const pole of [-90, 90]) assert.deepEqual(sample(-70, pole), sample(130, pole));
  const interpolation = {};
  for (const [name, view] of Object.entries(views).filter(([, v]) => v.span)) {
    assert.equal(regionPoint(view, 0, 0).height, sample(view.lon, view.lat).height);
    for (const edge of [-.5, .5]) assert(Number.isFinite(regionPoint(view, view.span * edge, view.span * edge).height));
    let error = 0, highest = -Infinity, lowest = Infinity;
    const step = view.span / 224;
    for (let row = 0; row < 224; row += 3) for (let col = 0; col < 224; col += 3) {
      const x = -view.span / 2 + col * step, y = -view.span / 2 + row * step;
      const direct = regionPoint(view, x + step / 2, y + step / 2).height;
      const mesh = (regionPoint(view, x + step, y).height + regionPoint(view, x, y + step).height) / 2;
      error = Math.max(error, Math.abs(direct - mesh));
      highest = Math.max(highest, direct); lowest = Math.min(lowest, direct);
    }
    interpolation[name] = {sampledMaxErrorMeters: error, highest, lowest, spacing: step};
    if (name === 'mountains') assert(highest > 4000 && highest - lowest > 3000);
  }
  console.log(JSON.stringify({samples: land + water, land, water, minimum, maximum, interpolation, status: 'passed'}));
})().catch(error => {console.error(error); process.exitCode = 1;});
