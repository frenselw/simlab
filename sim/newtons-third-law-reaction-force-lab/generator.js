(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ReactionGenerator = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const normalize = a => (a % 360 + 360) % 360, rad = a => a * Math.PI / 180;
  const point = (x, y) => ({ x, y });
  const add = (p, v, k = 1) => point(p.x + v.x * k, p.y + v.y * k);
  const direction = a => point(Math.cos(rad(a)), Math.sin(rad(a)));
  function random(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  function parameterSets(family) {
    const rows = [], put = p => rows.push(p);
    if (family === 0) for (const mirror of [false, true]) for (const theta of [20, 30, 40]) for (const W of [10, 15, 20]) put({ mirror, theta, W });
    if (family === 1) for (const mirror of [false, true]) for (const mass of [2, 3]) for (const acceleration of [4, 6]) put({ mirror, mass, acceleration });
    if (family === 2) for (const mirror of [false, true]) for (const stretched of [false, true]) for (const W of [10, 20]) for (const ratio of [.5, .75]) put({ mirror, stretched, W, ratio });
    if (family === 3) for (const W of [10, 15, 20]) { put({ moving: false, theta: 0, W, chi: 0 }); for (const theta of [-30, 0, 30]) for (const chi of [.5, 1]) put({ moving: true, theta, W, chi }); }
    if (family === 4) for (const angle of [45, 75, 105, 135]) for (const W of [8, 12, 16]) put({ angle, W });
    return rows;
  }
  function build(family, params) {
    const p = { ...params }, mirrored = p.mirror === true;
    const transform = v => point(mirrored ? -v.x : v.x, v.y);
    const angle = a => Math.round(normalize(mirrored ? 180 - a : a) * 10) % 3600;
    const body = (id, name, center, anchors) => ({ id, name, center: transform(center), anchors: anchors.map(([name, v], i) => ({ id: i, name, point: transform(v) })) });
    const force = (id, name, symbol, kind, source, origin, a, value, reactionAnchor = null) => ({ id, name, symbol, kind, source, recipient: 0, origin: transform(origin), angle10: angle(a), force100: Math.round(value * 100), reactionAnchor });
    let title, prompt, motion, bodies, given, geometry, facts;
    const leftRight = mirrored ? "左" : "右";
    if (family === 0) {
      title = "斜面上的滑塊"; motion = `沿斜面向${mirrored ? "右" : "左"}下方勻速滑動`;
      prompt = `木塊沿粗糙斜面勻速下滑。請分別畫出圖中支持力和摩擦力的反作用力。斜面傾角為 ${p.theta}°。`;
      const c = point(0, .1), t = direction(p.theta), n = direction(p.theta + 90), contact = point(0, c.y - .45 / Math.cos(rad(p.theta)));
      const corners = [[-.75,-.45],[.75,-.45],[.75,.45],[-.75,.45]].map(([x,y]) => transform(add(add(c,t,x),n,y)));
      const N = p.W * Math.cos(rad(p.theta)), f = p.W * Math.sin(rad(p.theta));
      bodies = [body(0,"木塊",c,[["中心",c],["與斜面接觸處",contact]]), body(1,"斜面",point(.5,-1.5),[["斜面內部標記",point(.5,-1.5)],["與木塊接觸處",contact]])];
      given = [force("normal","支持力","N",0,1,contact,p.theta+90,N,1),force("friction","摩擦力","f",1,1,contact,p.theta,f,1),force("weight","重力","G",4,-1,c,270,p.W)];
      geometry = { corners, plane: [transform(add(contact,t,-4)),transform(add(contact,t,4))], contact: transform(contact) };
      facts = { weight:p.W, normal:N, friction:f, mu:f/N, contactLocalX:-.45*Math.tan(rad(p.theta)), blockHeight:.9, blockWidth:1.5 };
    } else if (family === 1) {
      title = "一起加速的兩個木塊"; motion = `兩木塊一起向${leftRight}加速`;
      prompt = `外部推動器推著 A，使 A、B 在光滑水平面上一起向${leftRight}加速。圖中已畫出 B 所受的三個力。請畫出接觸推力和地面支持力的反作用力。`;
      const c = point(.8,.2), a = point(-.4,.2), contact = point(.2,.2), ground = point(.8,-.3), ag = point(-.4,-.3);
      bodies = [body(0,"木塊 B",c,[["B 的中心",c],["B 與地面接觸處",ground],["B 與 A 接觸處",contact]]),body(1,"木塊 A",a,[["A 的中心",a],["A 與 B 接觸處",contact],["A 與地面接觸處",ag]]),body(2,"地面",point(-.7,-1.4),[["地面內部標記",point(-.7,-1.4)],["與 B 接觸處",ground],["與 A 接觸處",ag]])];
      given = [force("push","A 對 B 的推力","P",0,1,contact,0,p.mass*p.acceleration,1),force("normal","地面支持力","N",0,2,ground,90,p.mass*10,1),force("weight","重力","G",4,-1,c,270,p.mass*10)];
      geometry = { groundY:-.3, drive:[transform(point(-2,.2)),transform(point(-1,.2))] };
      facts = { massA:1, massB:p.mass, acceleration:p.acceleration, drive:(1+p.mass)*p.acceleration, contact:p.mass*p.acceleration };
    } else if (family === 2) {
      title = p.stretched ? "拉伸彈簧與小車" : "壓縮彈簧與小車"; motion = "由靜止釋放的一刻";
      prompt = `小車在光滑軌道上連接一條已${p.stretched ? "拉長" : "壓縮"}的彈簧，此刻剛由靜止釋放。請為圖中的彈簧力和軌道支持力，各畫出它的反作用力。`;
      const c = point(p.stretched ? .7 : 0,.1), attach = point(c.x-.6,.1), fixed = point(-2.5,.1), middle = point((attach.x+fixed.x)/2,.1), ground = point(c.x,-.4);
      bodies = [body(0,"小車",c,[["小車中心",c],["與軌道接觸處",ground],["與彈簧連接處",attach]]),body(1,"彈簧",middle,[["彈簧中點",middle],["靠小車的一端",attach],["靠固定座的一端",fixed]]),body(2,"軌道",point(1.5,-1.4),[["軌道內部標記",point(1.5,-1.4)],["與小車接觸處",ground]]),body(3,"固定座",point(-2.6,.35),[["固定座中心",point(-2.6,.35)],["與彈簧連接處",fixed]])];
      given = [force("spring","彈簧對小車的力","Fs",3,1,attach,p.stretched?180:0,p.W*p.ratio,1),force("normal","軌道支持力","N",0,2,ground,90,p.W,1),force("weight","重力","G",4,-1,c,270,p.W)];
      geometry = { groundY:-.4, spring:[transform(fixed),transform(attach)], stretched:p.stretched };
      const extension = p.stretched ? .1 : -.1;
      facts = { weight:p.W, springForce:p.W*p.ratio, stiffness:p.W*p.ratio/.1, extension, acceleration:(p.stretched?-1:1)*10*p.ratio };
    } else if (family === 3) {
      title = p.moving ? "圓弧運動中的擺球" : "靜止懸吊的小球"; motion = p.moving ? "沿圓弧運動的瞬間" : "小球靜止";
      prompt = `小球以輕繩連接固定架，${p.moving ? "此刻正沿圓弧運動" : "保持靜止"}。圖中已畫出重力和繩拉力。請畫出繩拉力的反作用力。`;
      const pivot = point(0,1.3), out = direction(p.theta-90), c = add(pivot,out,1.8), attach = add(c,out,-.27), middle = point((pivot.x+attach.x)/2,(pivot.y+attach.y)/2), T=p.W*(Math.cos(rad(p.theta))+p.chi);
      bodies = [body(0,"小球",c,[["小球中心",c],["與繩連接處",attach]]),body(1,"繩",middle,[["繩的中點",middle],["靠小球的一端",attach],["靠固定架的一端",pivot]]),body(2,"固定架",point(0,1.52),[["固定架中心",point(0,1.52)],["與繩連接處",pivot]])];
      given = [force("tension","繩對小球的拉力","T",2,1,attach,p.theta+90,T,1),force("weight","重力","G",4,-1,c,270,p.W)];
      geometry = { rope:[pivot,attach], pivot, moving:p.moving, arcRadius:1.8 };
      facts = { tension:T, weight:p.W, radialAcceleration:p.chi*10, tangentialAcceleration:-10*Math.sin(rad(p.theta)), length:1.8, speed:Math.sqrt(p.chi*10*1.8) };
    } else if (family === 4) {
      title = "地球與下落的小球"; motion = "忽略空氣阻力，小球下落中";
      prompt = "圖中的小球已離開地面，只受地球的萬有引力（重力）。請畫出這支力的反作用力。物體大小與距離為示意，不按比例。";
      const earth=point(0,-.4), c=add(earth,direction(p.angle),2.15), surface=add(earth,direction(p.angle),1.03);
      bodies = [body(0,"小球",c,[["小球中心",c]]),body(1,"地球",earth,[["地心",earth],["地表標記",surface]])];
      given = [force("gravity","地球對小球的萬有引力","G",4,1,c,p.angle+180,p.W,0)];
      geometry = { earth, earthRadius:1.03, axis:[earth,c] }; facts = { gravity:p.W, mass:p.W/10 };
    } else throw new Error("Unknown question family");
    const targets = given.filter(f=>f.reactionAnchor!==null).map(f=>f.id);
    const expected = targets.map(id=>{ const f=given.find(g=>g.id===id); return [f.source,f.reactionAnchor,f.kind,(f.angle10+1800)%3600,f.force100]; });
    return { family, code:"ABCDE"[family], params:p, title, prompt, motion, bodies, given, targets, expected, geometry, facts, maxForce100:3*Math.max(...given.map(f=>f.force100)) };
  }
  function generate(seed, version=1) {
    if (!Number.isInteger(seed)||seed<0||seed>4294967295||version!==1) throw new Error("Unsupported seed or generator");
    const questions=Array.from({length:5},(_,i)=>{ const rng=random((seed ^ Math.imul(i+1,0x9e3779b9))>>>0);return build(i,pick(rng,parameterSets(i))); });
    const order=[0,1,2,3,4], rng=random((seed ^ 0xa5b35705)>>>0);
    for(let i=4;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    return {seed,version,questions,order};
  }
  function newSeed() { if (typeof crypto!=="undefined"&&crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];return Math.floor(Math.random()*4294967296); }
  return Object.freeze({generate,build,parameterSets,newSeed,normalize,rad,direction});
});
