(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AdvancedEquilibriumGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const VERSION = 1, RAD = Math.PI / 180;
  const normalize = a => ((a % 360) + 360) % 360;
  const sin = a => Math.sin(a * RAD), cos = a => Math.cos(a * RAD), tan = a => Math.tan(a * RAD);
  const mirror = (a, sign) => normalize(sign === 1 ? a : 180 - a);
  const choices = Object.freeze({ wallAngles: [30, 40, 45, 50, 55], ropeAngles: [45, 55, 65], springAngles: [-15, 0, 15],
    weights: [.8, 1, 1.2], compression: [.15, .20, .25], pushes: [.10, .15], slopeAngles: [25, 30, 35, 40], friction: [.15, .25, .35], suspension: [20, 25, 30, 35] });
  function random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let z = Math.imul(value ^ value >>> 15, value | 1);
      z ^= z + Math.imul(z ^ z >>> 7, z | 61);
      return ((z ^ z >>> 14) >>> 0) / 4294967296;
    };
  }
  const force = (kind, angle, magnitude, source, reason) => ({ kind, angle: normalize(angle), magnitude, source, reason });
  function build(family, p) {
    if (![1, -1].includes(p.sign)) throw new Error("Invalid mirror");
    const sign = p.sign, right = sign === 1 ? "右" : "左", left = sign === 1 ? "左" : "右";
    const angle = a => mirror(a, sign), g = w => force(0, 270, w, "earth", "地球對研究物體的重力鉛直向下。"), expected = [];
    let title, prompt, target = "小球", surface = "none", slope = 0, motion = 0, ropes = [], springs = [], rods = [], checks = {};
    if (family === "A") {
      title = "兩個接觸面"; surface = "smooth"; slope = angle(p.theta);
      prompt = `小球靜止在${left}側豎直擋板與向${right}升高的斜面之間。兩個面固定、光滑，小球同時接觸兩面。請畫出小球所受的各個力。`;
      expected.push(g(1), force(1, angle(0), tan(p.theta), "wall", `豎直擋板的支持力垂直擋板，向${right}推小球。`),
        force(1, angle(90 + p.theta), 1 / cos(p.theta), "slope", "斜面的支持力垂直斜面並指離斜面；它與擋板的支持力是兩個不同的力。"));
    } else if (family === "B") {
      title = "斜繩與彈簧";
      const t = cos(p.delta) / sin(p.gamma + p.delta), s = cos(p.gamma) / sin(p.gamma + p.delta);
      ropes = [{ id: "rope", angle: angle(180 - p.gamma) }];
      springs = [{ id: "spring", angle: angle(p.delta), state: "stretched" }];
      prompt = "小球由一條拉緊的輕繩及一條已被拉長的輕彈簧連接固定端，保持靜止。請畫出小球所受的各個力。";
      expected.push(g(1), force(3, ropes[0].angle, t, "rope", "繩拉力沿拉緊的繩，從小球指向固定端。"),
        force(5, springs[0].angle, s, "spring", "彈簧已被拉長，沿彈簧軸線把小球拉向固定端；彈簧彈力不一定向上。"));
      checks.spring = { k: 10, naturalLength: .4, length: .4 + s / 10, magnitude: s };
    } else if (family === "C") {
      if (!["A", "B"].includes(p.target)) throw new Error("Invalid block target");
      title = "彈簧與兩木塊"; surface = "rough"; target = `木塊${p.target}`;
      const s = p.compression, push = p.push, w = p.target === "A" ? 1 : p.weightB;
      springs = [{ id: "spring", angle: angle(0), state: "compressed" }];
      rods = [{ id: "push", angle: angle(0), body: "B" }];
      prompt = `木塊A、B放在粗糙水平面，之間的輕彈簧保持壓縮。施力器水平向${right}推B，兩木塊仍靜止。請只畫出${target}所受的各個力。`;
      const springAngle = angle(p.target === "A" ? 180 : 0), frictionAngle = angle(p.target === "A" ? 0 : 180);
      const tendency = p.target === "A" ? left : right, frictionDirection = p.target === "A" ? right : left;
      expected.push(g(w), force(1, 90, w, "floor", "地面支持力垂直水平面，方向向上。"),
        force(5, springAngle, s, "spring", `壓縮彈簧把兩端推開，對${target}的彈力向${tendency}。`),
        force(2, frictionAngle, p.target === "A" ? s : s + push, "floor-friction", `${target}有向${tendency}滑動的趨勢；靜摩擦力向${frictionDirection}，使它保持靜止。`));
      if (p.target === "B") expected.push(force(4, rods[0].angle, push, "actuator", `施力器另向${right}推B。它和彈簧來自不同來源，即使同向也要各畫一支力。`));
      checks.spring = { k: 2, naturalLength: .4, length: .4 - s / 2, magnitude: s };
      checks.friction = [{ normal: 1, magnitude: s, coefficient: s + .10 }, { normal: p.weightB, magnitude: s + push, coefficient: (s + push) / p.weightB + .10 }];
    } else if (family === "D") {
      if (![1, -1].includes(p.travel)) throw new Error("Invalid motion");
      title = "水平推力與斜面"; target = "木塊"; surface = "rough"; slope = angle(p.theta); motion = p.travel;
      const push = (sin(p.theta) + motion * p.mu * cos(p.theta)) / (cos(p.theta) - motion * p.mu * sin(p.theta));
      const normal = cos(p.theta) + push * sin(p.theta);
      rods = [{ id: "push", angle: angle(0), body: "block" }];
      prompt = `施力器水平向${right}推木塊，木塊沿向${right}升高的粗糙斜面，相對地面勻速${motion > 0 ? "上行" : "下行"}。施力器隨木塊移動。請畫出木塊所受的各個力。`;
      expected.push(g(1), force(1, angle(90 + p.theta), normal, "slope", "支持力垂直斜面並指離斜面，不沿鉛直方向。"),
        force(4, rods[0].angle, push, "actuator", `題設推力保持水平向${right}，不能把它畫成沿斜面。`),
        force(2, angle(p.theta + (motion > 0 ? 180 : 0)), p.mu * normal, "slope-friction", `木塊相對斜面向${motion > 0 ? "上" : "下"}滑動，滑動摩擦力沿斜面向${motion > 0 ? "下" : "上"}。`));
      checks.friction = [{ normal, magnitude: p.mu * normal, coefficient: p.mu }];
    } else if (family === "E") {
      if (![1, 2].includes(p.target)) throw new Error("Invalid sphere target");
      title = "三繩連接兩球"; target = `小球${p.target}`;
      const beta = Math.atan(1 / (2 * tan(p.alpha))) / RAD, ta = 2 / cos(p.alpha), tb = 1 / sin(beta), tc = tb * cos(beta);
      ropes = [{ id: "a", angle: angle(90 + p.alpha) }, { id: "b", angle: angle(-beta) }, { id: "c", angle: angle(0) }];
      prompt = `兩個等重小球由三條拉緊的輕繩連接。繩a連接天花與球1，繩b連接兩球，水平繩c連接球2與${right}牆。兩球保持靜止，請只畫出${target}所受的各個力。`;
      const ball1 = [g(1), force(3, ropes[0].angle, ta, "a", `繩a沿繩把球1拉向${left}上方的固定端。`),
        force(3, ropes[1].angle, tb, "b", `繩b對球1的拉力沿繩指向球2，方向為${right}下方；繩拉力可以有向下分量。`)];
      const ball2 = [g(1), force(3, ropes[1].angle + 180, tb, "b", `繩b對球2的拉力沿繩指向球1，方向為${left}上方。`),
        force(3, ropes[2].angle, tc, "c", `水平繩c把球2拉向${right}側固定牆。繩a沒有直接接到球2。`)];
      expected.push(...(p.target === 1 ? ball1 : ball2)); checks.otherBody = p.target === 1 ? ball2 : ball1;
    } else throw new Error("Unknown family");
    const referenceAngles = [0, 90, 180, 270];
    if (family === "A" || family === "D") referenceAngles.push(slope, slope + 90, slope + 180, slope + 270);
    for (const f of [...ropes, ...springs, ...rods]) referenceAngles.push(f.angle, f.angle + 180);
    if (expected.some(f => !Number.isFinite(f.magnitude) || f.magnitude <= 0 || !Number.isFinite(f.angle))) throw new Error("Nonphysical question");
    return { family, title, prompt, target, params: { ...p }, motion, surface, slope, ropes, springs, rods, expected, checks,
      motionLabel: motion ? `相對地面沿斜面勻速${motion > 0 ? "上行" : "下行"}` : ["C", "E"].includes(family) ? `靜止 · 作圖物體：${target}` : "相對地面靜止",
      referenceAngles: [...new Set(referenceAngles.map(normalize))] };
  }
  function generateV1(seed) {
    const questions = ["A", "B", "C", "D", "E"].map((family, i) => {
      const r = random(seed ^ Math.imul(i + 1, 0x9e3779b9)), pick = a => a[Math.floor(r() * a.length)];
      const p = { sign: pick([-1, 1]) };
      if (family === "A") p.theta = pick(choices.wallAngles);
      if (family === "B") Object.assign(p, { gamma: pick(choices.ropeAngles), delta: pick(choices.springAngles) });
      if (family === "C") Object.assign(p, { target: pick(["A", "B"]), weightB: pick(choices.weights), compression: pick(choices.compression), push: pick(choices.pushes) });
      if (family === "D") Object.assign(p, { theta: pick(choices.slopeAngles), mu: pick(choices.friction), travel: pick([-1, 1]) });
      if (family === "E") Object.assign(p, { alpha: pick(choices.suspension), target: pick([1, 2]) });
      return build(family, p);
    });
    const order = [0, 1, 2, 3, 4], r = random(seed ^ 0x123ab987);
    for (let i = 4; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return { questions, order };
  }
  const GENERATORS = Object.freeze({ 1: generateV1 });
  function generate(seed, version = VERSION) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !Object.prototype.hasOwnProperty.call(GENERATORS, version)) throw new Error("Invalid generator identity");
    return GENERATORS[version](seed);
  }
  function newSeed() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }
  return Object.freeze({ VERSION, GENERATORS, choices, generate, build, newSeed, normalize, mirror });
});
