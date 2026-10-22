(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../newtons-second-law-investigation-lab/fitting.js") : root.NewtonFitting);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentripetalModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (Fitting) {
  "use strict";
  const KINDS = ["radius", "mass", "omega"];
  const SETUP_REASONS = ["equal-mass", "equal-radius", "equal-force", "different-both"];
  const SPEED_RELATIONS = ["ratio-steady", "forces-steady", "ratio-speed", "unrelated"];
  const VARIABLES = ["m", "r", "omega", "force"];
  const COMPARE = ["supports", "confounded", "no-contrast", "insufficient"];
  const REASONS = ["coefficient", "constant", "other", "uncertain"];
  const LAWS = ["linear", "square", "inverse", "none"];
  const SYNC = ["same-omega", "same-force", "same-mass", "unknown"];
  const MASS_PARTS = ["cap-screw-weights", "weights-only", "sensor-and-weights", "cap-only"];
  const CFG = [2, 2, 2, 2];
  const MAX_SAMPLES = 48;
  const clone = value => JSON.parse(JSON.stringify(value));
  const radius = index => 0.1 + 0.05 * index;
  const mass = count => 0.04 + 0.02 * count;
  const quantities = cfg => ({ rA: radius(cfg[0]), rB: radius(cfg[1]), mA: mass(cfg[2]), mB: mass(cfg[3]) });
  const readings = (cfg, omega) => {
    const { rA, rB, mA, mB } = quantities(cfg);
    return { omega, a: mA * rA * omega ** 2, b: mB * rB * omega ** 2 };
  };
  const slot = q => Math.sign(q) * (1 + Math.min(23, Math.floor((Math.abs(q) - 250) / 250)));
  const points = (kind, run) => run.q.map(q => {
    const values = readings(run.cfg, q / 1000);
    return kind === "omega" ? [values.omega, values.a] : [values.b, values.a];
  });
  const fit = (kind, run) => Fitting.fit(kind === "omega" ? "quadratic" : "linear", points(kind, run));
  const freshRun = cfg => ({ cfg: cfg.slice(), q: [], fit: false, a: [null, null, null] });
  const freshTask = () => ({ work: CFG.slice(), current: null, selected: null, roles: [null, null], inquiry: [null, null], runs: [], law: null });
  const fresh = (seed = Math.floor(Math.random() * 0x100000000)) => ({
    v: 1, mv: 2, rv: 2, seed: seed >>> 0, page: 0, view: "setup", fromReview: false,
    returnTo: null, tasks: KINDS.map(freshTask), sync: null, massParts: null
  });
  function begin(task) {
    if (task.runs.length >= 2) return false;
    task.runs.push(freshRun(task.work));
    task.current = task.runs.length - 1;
    if (task.selected === null) task.selected = task.current;
    return true;
  }
  function record(task, omega) {
    if (task.current === null || !Number.isFinite(omega)) return false;
    const q = Math.round(omega * 1000);
    if (Math.abs(q) < 250 || Math.abs(q) > 6000) return false;
    const run = task.runs[task.current];
    if (run.q.length >= MAX_SAMPLES || run.q.includes(q)) return false;
    run.q.push(q);
    run.fit = false;
    return true;
  }
  function fitCurrent(kind, task) {
    if (task.current === null) return { ok: false, message: "請先收集資料。" };
    const result = fit(kind, task.runs[task.current]);
    task.runs[task.current].fit = result.ok;
    return result;
  }
  function removeRun(task, index) {
    if (!Number.isInteger(index) || index < 0 || index >= task.runs.length) return false;
    task.runs.splice(index, 1);
    task.current = task.current === index ? (task.runs.length ? 0 : null) : task.current > index ? task.current - 1 : task.current;
    task.selected = task.selected === index ? null : task.selected > index ? task.selected - 1 : task.selected;
    return true;
  }
  function setWork(task, field, value) {
    const max = field < 2 ? 6 : 8;
    if (!Number.isInteger(field) || field < 0 || field > 3 || !Number.isInteger(value) || value < 0 || value > max) return false;
    task.work[field] = value;
    return true;
  }
  const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
  function motion() { return { angle: 0, omega: 0, pointerAngle: null, time: null, warning: false }; }
  function dragMotion(state, angle, time) {
    if (!Number.isFinite(angle) || !Number.isFinite(time)) return state;
    if (state.pointerAngle === null) return { ...state, pointerAngle: angle, time, warning: false };
    const dt = (time - state.time) / 1000, delta = -wrap(angle - state.pointerAngle);
    if (!(dt > 0) || dt > 0.12) return { ...state, pointerAngle: angle, time, warning: false };
    if (Math.abs(delta) > Math.PI * 0.8) return { ...state, pointerAngle: angle, time, warning: true };
    const limited = Math.max(-6 * dt, Math.min(6 * dt, delta));
    return { ...state, pointerAngle: angle, time, angle: state.angle + limited, omega: limited / dt, warning: false };
  }
  function upgradeDraft(state) {
    if (state.rv === 1) {
      state.tasks.forEach(task => { task.inquiry = [null, null]; });
      state.rv = 2;
    }
    return state;
  }
  function sampleReady(run, omega) {
    const q = Math.round(omega * 1000);
    return !!run && Number.isFinite(q) && Math.abs(q) >= 250 && Math.abs(q) <= 6000 &&
      run.q.length < MAX_SAMPLES && run.q.every(old => Math.abs(old - q) >= 250);
  }
  function coast(state, dt, braking = false) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.12) return state;
    const omega = braking ? (Math.sign(state.omega) * Math.max(0, Math.abs(state.omega) - 0.45 * dt) || 0) : state.omega;
    return { ...state, omega, angle: state.angle + (state.omega + omega) * dt / 2 };
  }
  return Object.freeze({ KINDS, SETUP_REASONS, SPEED_RELATIONS, VARIABLES, COMPARE, REASONS, LAWS, SYNC, MASS_PARTS, clone, CFG, radius, mass,
    quantities, readings, slot, MAX_SAMPLES, points, fit, freshRun, freshTask, fresh, begin, record, fitCurrent, removeRun, setWork,
    motion, dragMotion, coast, sampleReady, upgradeDraft });
});
