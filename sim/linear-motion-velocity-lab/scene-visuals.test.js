"use strict";

const assert = require("assert");
const Visuals = require("./scene-visuals.js");

assert.strictEqual(Visuals.wheelAngle(0), 0);
assert(Math.abs(Visuals.wheelAngle(Visuals.WHEEL_RADIUS_METRES * Math.PI) - Math.PI) < 1e-12, "wheel angle follows travelled distance");
assert(Visuals.wheelAngle(Visuals.WHEEL_RADIUS_METRES * Math.PI / 2) > 0, "positive rightward travel rotates clockwise in Canvas coordinates");
assert.strictEqual(Visuals.wheelAngle(123.456), Visuals.wheelAngle(123.456), "restored world position recreates the same wheel angle");
assert.throws(() => Visuals.wheelAngle(1, 0), /Invalid wheel geometry/);
for (const pixelsPerMetre of [16, 20, 28]) {
  const renderedRadius = 15 * Visuals.carScale(pixelsPerMetre);
  const backgroundTravelPerTurn = Visuals.TAU * Visuals.WHEEL_RADIUS_METRES * pixelsPerMetre;
  assert(Math.abs(backgroundTravelPerTurn - Visuals.TAU * renderedRadius) < 1e-12, "one wheel turn exactly matches one rendered circumference");
}

for (const [width, height] of [[320, 180], [320, 224], [768, 360], [1280, 520]]) {
  const layout = Visuals.sceneLayout(width, height);
  assert.strictEqual(layout.roadCentreY, (layout.roadTop + layout.roadBottom) / 2, "lane divider is at the exact road centre");
  assert(layout.roadTop < layout.upperLaneCentreY && layout.upperLaneCentreY < layout.roadCentreY, "upper lane has its own centre");
  assert(layout.roadCentreY < layout.lowerLaneCentreY && layout.lowerLaneCentreY < layout.roadBottom, "lower lane has its own centre");
  assert(layout.roadTop < layout.carGroundY && layout.carGroundY < layout.roadCentreY, "car wheel contact line is inside the upper lane");
  assert(layout.roadBottom < layout.rulerY && layout.rulerY < height, "measurement ruler is separate from both traffic lanes");
  assert(layout.rulerY - layout.rulerMajorTickHeight >= layout.roadBottom + layout.rulerTickTopMargin - 1e-12, "major ticks and top margin stay inside the measurement strip");
  assert(layout.rulerY - layout.rulerMinorTickHeight >= layout.roadBottom + layout.rulerTickTopMargin - 1e-12, "minor ticks and top margin stay inside the measurement strip");
  assert(layout.rulerLabelY > layout.rulerY && layout.rulerLabelY < height, "ruler labels remain below the baseline and inside the viewport");
  assert(layout.vergeTop < layout.farGroundY && layout.farGroundY < layout.roadsideGroundY, "far objects have a distinct deeper baseline");
  assert(layout.roadsideGroundY < layout.roadTop && layout.roadTop - layout.roadsideGroundY <= 4, "roadside objects meet the road edge");
  const maximumWheelRadius = 15 * Visuals.carScale(28);
  assert(layout.carGroundY + maximumWheelRadius < layout.roadCentreY, "both wheels remain clear of the centre divider");
}
assert.throws(() => Visuals.sceneLayout(0, 300), /Invalid scene viewport/);

assert.strictEqual(Visuals.laneDashOffset(0, 20), 0);
assert.strictEqual(Visuals.laneDashOffset(1, 20), 20, "positive car travel moves the lane pattern backwards by the same screen distance");
assert.strictEqual(Visuals.laneDashOffset(2.5, 20), 0, "lane pattern wraps without a visible discontinuity");
assert.strictEqual(Visuals.laneDashOffset(-1, 20), 30, "negative world positions use a stable positive phase");
assert.strictEqual(Visuals.laneDashOffset(123.456, 20), Visuals.laneDashOffset(123.456, 20), "restored world position recreates the same lane phase");
assert.throws(() => Visuals.laneDashOffset(1, 0), /Invalid lane dash geometry/);

const supportedTypes = {
  far: new Set(["empty", "house", "shop", "apartment", "treeCluster"]),
  roadside: new Set(["empty", "tree", "shrubs", "lamp", "sign", "treeShrubs"])
};
for (const layer of Object.keys(supportedTypes)) {
  const found = new Set();
  for (let cellId = -1000; cellId <= 1000; cellId += 1) {
    const appearance = Visuals.backgroundAppearance(layer, cellId);
    assert.deepStrictEqual(appearance, Visuals.backgroundAppearance(layer, cellId), `${layer} cell ${cellId} has a stable identity`);
    assert(supportedTypes[layer].has(appearance.type), `${layer} cell uses a supported type`);
    assert(appearance.offset >= -.3 && appearance.offset <= .3, "within-cell offset stays bounded");
    found.add(appearance.type);
  }
  assert.deepStrictEqual(found, supportedTypes[layer], `${layer} generator reaches every designed object type`);
}
assert.throws(() => Visuals.backgroundAppearance("unknown", 0), /Invalid background cell/);
for (const layer of Object.keys(supportedTypes)) {
  for (const cell of [0, 5_000_000_000, -5_000_000_000, Number.MAX_SAFE_INTEGER - 1, Number.MIN_SAFE_INTEGER + 1]) {
    assert.deepStrictEqual(Visuals.backgroundAppearance(layer, cell), Visuals.backgroundAppearance(layer, cell), `${layer} safely hashes large cell ${cell}`);
  }
  for (const cell of [-5_000_000_000, -17, 0, 23, 5_000_000_000]) {
    assert.notDeepStrictEqual(Visuals.backgroundAppearance(layer, cell), Visuals.backgroundAppearance(layer, cell + 0x100000000), `${layer} appearance incorporates cell bits above 32-bit range`);
  }
}

for (const layer of Object.keys(supportedTypes)) {
  const config = Visuals.BACKGROUND_LAYERS[layer];
  const beforeBoundary = Visuals.visibleBackgroundCells(layer, config.spacing - .01, 20, 600);
  const afterBoundary = Visuals.visibleBackgroundCells(layer, config.spacing + .01, 20, 600);
  const persistent = beforeBoundary.filter((cell) => afterBoundary.includes(cell));
  assert(persistent.length > 0, `${layer} cells persist across a world-cell boundary`);
  for (const cell of persistent) assert.deepStrictEqual(Visuals.backgroundAppearance(layer, cell), Visuals.backgroundAppearance(layer, cell), "persistent cells keep their appearance");
  assert(Visuals.visibleBackgroundCells(layer, -100, 20, 320).some((cell) => cell < 0), `${layer} supports negative world coordinates`);
  assert(Visuals.visibleBackgroundCells(layer, 100, 20, 320).length < Visuals.visibleBackgroundCells(layer, 100, 20, 1200).length, "viewport width controls buffered cell count");
}

console.log("Linear motion scene visual tests passed");
