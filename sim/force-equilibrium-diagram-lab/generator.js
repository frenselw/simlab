(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquilibriumGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const VERSION = 1;
  const RAD = Math.PI / 180;
  const normalize = a => ((a % 360) + 360) % 360;
  const sin = a => Math.sin(a * RAD), cos = a => Math.cos(a * RAD), tan = a => Math.tan(a * RAD);
  const mirror = (a, sign) => normalize(sign === 1 ? a : 180 - a);
  function random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let z = Math.imul(value ^ value >>> 15, value | 1);
      z ^= z + Math.imul(z ^ z >>> 7, z | 61);
      return ((z ^ z >>> 14) >>> 0) / 4294967296;
    };
  }
  function force(kind, angle, magnitude, reason) {
    return { kind, angle: normalize(angle), magnitude, reason };
  }
  function build(family, p, motion = 0) {
    const sign = p.sign || 1, direction = sign === 1 ? "右" : "左";
    const g = force(0, 270, 1, "地球對物體的重力鉛直向下。"), expected = [g];
    let title, prompt, surface = "rough", slope = 0, ropes = [], rods = [], frictionCoefficient = 0;
    if (family === "A") {
      title = "粗糙斜面"; slope = mirror(p.theta, sign);
      prompt = `木塊靜止在向${direction}升高的粗糙斜面上，沒有繩或其他推拉。請畫出木塊所受的力。`;
      expected.push(force(1, mirror(90 + p.theta, sign), cos(p.theta), "支持力垂直斜面，指離接觸面。"),
        force(2, slope, sin(p.theta), "木塊有沿斜面向下滑的趨勢，靜摩擦力沿斜面向上。"));
      frictionCoefficient = tan(p.theta) + .15;
    } else if (family === "B") {
      title = "繩拉木箱";
      ropes = [mirror(p.alpha, sign)];
      prompt = `人在木箱${direction}方，以拉緊的${p.alpha ? "斜繩" : "水平繩"}拉木箱。地面粗糙，木箱${motion ? `相對地面向${direction}勻速直線運動` : "保持靜止"}。繩端隨拉繩者移動，並非固定在地面。`;
      const n = 1 - p.lambda * sin(p.alpha), f = p.lambda * cos(p.alpha);
      expected.push(force(1, 90, n, "地面的支持力垂直水平面，方向向上。"),
        force(3, ropes[0], p.lambda, "繩只能拉物體；拉力沿繩指向拉繩者。"),
        force(2, sign === 1 ? 180 : 0, f, motion ? "滑動摩擦力反對木箱相對地面的滑動方向。" : "繩拉力造成水平滑動趨勢，靜摩擦力反對這個趨勢。"));
      frictionCoefficient = f / n + (motion ? 0 : .15);
    } else if (family === "C") {
      title = "雙繩懸吊"; surface = "none";
      ropes = [180 - p.alpha, p.beta];
      prompt = "物體由兩條拉緊的斜繩懸吊，保持靜止，沒有接觸地面。請分別表示每條繩對物體的作用。";
      expected.push(force(3, ropes[0], cos(p.beta) / sin(p.alpha + p.beta), "左繩的拉力沿左繩，指向左上方的繩端。"),
        force(3, ropes[1], cos(p.alpha) / sin(p.alpha + p.beta), "右繩的拉力沿右繩，指向右上方的繩端。"));
    } else if (family === "D") {
      title = "斜面與拉繩"; surface = "smooth"; slope = mirror(p.theta, sign);
      ropes = [mirror(p.theta + p.beta, sign)];
      prompt = `木塊在向${direction}升高的光滑斜面上，由上坡側拉緊的繩拉住並保持靜止。光滑斜面沒有摩擦。`;
      const t = sin(p.theta) / cos(p.beta), n = cos(p.theta) - t * sin(p.beta);
      expected.push(force(1, mirror(90 + p.theta, sign), n, "支持力垂直斜面；它不一定鉛直向上。"),
        force(3, ropes[0], t, "繩拉力沿實際繩向，不一定與斜面平行。"));
    } else if (family === "E") {
      title = "光滑平地多力"; surface = "smooth";
      rods = p.count === 2 ? [force(4, 0, .5, "左側推桿向右推物體。"), force(4, 180, .5, "右側推桿向左推物體。")]
        : [force(4, mirror(-p.alpha, sign), p.p / cos(p.alpha), "斜推桿沿桿向物體施加斜向下的推力。"),
          force(4, mirror(180 + p.beta, sign), p.q / cos(p.beta), "另一支斜推桿沿自身方向向物體推。"),
          force(4, mirror(0, sign), p.q - p.p, "水平推桿沿水平方向向物體推。")];
      const n = 1 - rods.reduce((s, f) => s + f.magnitude * sin(f.angle), 0);
      expected.push(force(1, 90, n, "地面支持力向上，光滑地面不提供摩擦力。"), ...rods);
      prompt = `光滑水平面上的木塊同時受到${p.count === 2 ? "兩" : "三"}支推桿的推力，${motion ? `相對地面向${motion > 0 ? "右" : "左"}勻速直線運動` : "保持靜止"}。各推桿沿桿向木塊推，並隨木塊移動；請畫出所有外力。`;
    } else throw new Error("Unknown family");
    const referenceAngles = [0, 90, 180, 270];
    if (family === "A" || family === "D") referenceAngles.push(slope, slope + 90, slope + 180, slope + 270);
    for (const a of ropes.concat(rods.map(f => f.angle))) referenceAngles.push(a, a + 180);
    return { family, title, prompt, params: { ...p }, motion, surface, slope, ropes, rods, expected,
      referenceAngles: [...new Set(referenceAngles.map(normalize))], frictionCoefficient };
  }
  function generateV1(seed) {
    const motionRandom = random(seed ^ 0x7fa4123);
    const combo = [[0, 1], [1, 0], [1, 1]][Math.floor(motionRandom() * 3)];
    const questions = ["A", "B", "C", "D", "E"].map((family, i) => {
      const r = random(seed ^ Math.imul(i + 1, 0x9e3779b9)), pick = a => a[Math.floor(r() * a.length)];
      const sign = pick([-1, 1]);
      let p = { sign }, motion = 0;
      if (family === "A" || family === "D") p.theta = pick([20, 25, 30, 35]);
      if (family === "B") { p = { sign, alpha: pick([0, 20, 30, 40]), lambda: pick([.2, .3, .4]) }; motion = combo[0] * sign; }
      if (family === "C") {
        const angles = [25, 30, 35, 40, 45, 50, 55, 60, 65];
        p.alpha = pick(angles); p.beta = pick(angles.filter(a => Math.abs(a - p.alpha) >= 10));
      }
      if (family === "D") p.beta = pick([0, 10, 20]);
      if (family === "E") {
        p = { sign, count: pick([2, 3]), alpha: pick([25, 35, 45]), beta: pick([25, 35, 45]), p: pick([.35, .45, .55]), q: pick([.75, .85, .95]) };
        motion = combo[1] * pick([-1, 1]);
      }
      return build(family, p, motion);
    });
    const order = [0, 1, 2, 3, 4], r = random(seed ^ 0x123ab987);
    for (let i = 4; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return { questions, order };
  }
  const GENERATORS = Object.freeze({ 1: generateV1 });
  function generate(seed, version = VERSION) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !GENERATORS[version]) throw new Error("Invalid generator identity");
    return GENERATORS[version](seed);
  }
  function newSeed() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }
  return Object.freeze({ VERSION, GENERATORS, generate, build, newSeed, normalize, mirror });
});
