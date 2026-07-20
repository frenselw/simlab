"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const S = require("./scoring.js");

const zeroSeed = "00000000000000000000000000000000";
const oneSeed = "00000000000000000000000000000001";
assert.deepEqual(G.decodeSeed(G.encodeSeed([0, 1, 0x7fffffff, 0xffffffff])), [0, 1, 0x7fffffff, 0xffffffff], "seed words round-trip through fixed hex encoding");
for (const invalid of [null, "", "0".repeat(31), "0".repeat(33), "g".repeat(32), "A".repeat(32)]) assert.equal(G.decodeSeed(invalid), null, "malformed seed is rejected");
assert.equal(G.createSeed({ getRandomValues(words) { words.set([1, 2, 3, 4]); return words; } }), "00000001000000020000000300000004", "Web Crypto words create a 128-bit seed");
assert.equal(G.createSeed({ getRandomValues() { throw new Error("unavailable"); } }), null, "Web Crypto failure has no low-entropy fallback");

const zeroPrng = G.createPrng(zeroSeed, "mission-1");
assert.deepEqual(Array.from({ length: 5 }, () => zeroPrng.nextUint32()), [2047023922, 81069331, 2287479434, 2538081563, 3462478753], "xoshiro/domain golden vector is stable");
const firstDomain = G.createPrng(oneSeed, "mission-1");
const secondDomain = G.createPrng(oneSeed, "mission-2");
assert.notDeepEqual(Array.from({ length: 6 }, () => firstDomain.nextUint32()), Array.from({ length: 6 }, () => secondDomain.nextUint32()), "mission streams are domain-separated");
const bounded = G.createPrng(oneSeed, "bounded");
for (let index = 0; index < 5000; index += 1) {
  const value = bounded.bounded(7);
  assert.ok(value >= 0 && value < 7, "bounded sampler stays in range");
}
assert.deepEqual(G.createPrng(oneSeed, "shuffle").shuffle([0, 1, 2, 3, 4]).slice().sort(), [0, 1, 2, 3, 4], "shuffle preserves a complete permutation");

const sizes = G.poolSizes();
assert.ok(sizes.m1 >= 100 && sizes.m2 >= 60 && sizes.m5 >= 100, "single-mission pools retain broad candidate ranges");
for (const size of Object.values(sizes.m3)) assert.ok(size >= 150, "each mission 3 category has a broad pool");
assert.ok(sizes.m4.stationary >= 17 && sizes.m4.positive >= 200 && sizes.m4.negative >= 200, "all mission 4 categories have broad pools");
const pools = G.candidatePools();
for (const candidate of pools.m1) assert.ok(G.validateMission("m1", candidate));
for (const candidate of pools.m2) assert.ok(G.validateMission("m2", candidate));
for (const category of G.M3_CATEGORIES) for (const candidate of pools.m3[category]) {
  assert.ok(G.validateMission("m3", candidate));
  assert.ok(candidate.A.v < 0 || candidate.B.v < 0);
}
for (const category of G.M4_CATEGORIES) for (const candidate of pools.m4[category]) assert.ok(G.validateMission("m4", candidate));
for (const candidate of pools.m5) {
  assert.ok(G.validateMission("m5", candidate));
  const solutions = G.enumerateMeetingSolutions(candidate);
  assert.ok(solutions.length >= 3, "each meeting problem has at least three non-coincident UI-reachable solutions");
  for (const solution of solutions) {
    assert.ok(Number.isInteger(solution.x0) && Number.isInteger(solution.v * 2));
    assert.ok(S.lineWithinBounds(solution));
    assert.equal(S.intersection(candidate.A, solution).kind, "point");
  }
}

const deterministic = G.generatePaper(oneSeed);
assert.deepEqual(G.generatePaper(oneSeed), deterministic, "same seed and generator version produce the same paper");
assert.ok(G.validateGeneratedPaper(deterministic));
assert.equal(G.matchesSeed(oneSeed, deterministic), true, "canonical generated paper is bound to its seed and version");
assert.notEqual(G.fingerprint(G.generatePaper("fedcba98765432100123456789abcdef")), G.fingerprint(deterministic), "different fixed seeds change the generated paper");
assert.equal(G.matchesSeed("fedcba98765432100123456789abcdef", deterministic), false, "a different valid seed cannot authenticate the same paper");

const fingerprints = new Set();
const missionFingerprints = Object.fromEntries(G.MISSION_KEYS.map((key) => [key, new Set()]));
const m3Counts = { A: 0, B: 0, same: 0 };
const m4Counts = { stationary: 0, positive: 0, negative: 0 };
for (let index = 0; index < 10000; index += 1) {
  const seed = G.encodeSeed([0x51a7e000 ^ index, index, Math.imul(index + 1, 0x9e3779b9) >>> 0, (0xffffffff - index) >>> 0]);
  const paper = G.generatePaper(seed);
  assert.ok(G.validateGeneratedPaper(paper), `fixed property seed ${index} generates a valid paper`);
  fingerprints.add(G.fingerprint(paper));
  for (const key of G.MISSION_KEYS) missionFingerprints[key].add(JSON.stringify(paper.missions[key]));
  const a = Math.abs(paper.missions.m3.A.v);
  const b = Math.abs(paper.missions.m3.B.v);
  m3Counts[a === b ? "same" : a > b ? "A" : "B"] += 1;
  m4Counts[paper.missions.m4.v === 0 ? "stationary" : paper.missions.m4.v > 0 ? "positive" : "negative"] += 1;
}
assert.ok(fingerprints.size > 9900, `10,000 seeds retain high paper diversity (${fingerprints.size} unique)`);
assert.ok(missionFingerprints.m1.size > 120 && missionFingerprints.m2.size > 65 && missionFingerprints.m3.size > 700 && missionFingerprints.m4.size > 500 && missionFingerprints.m5.size > 280, "property sweep reaches broad diversity in every mission");
for (const count of [...Object.values(m3Counts), ...Object.values(m4Counts)]) assert.ok(count > 2800 && count < 3900, `category-first selection remains approximately balanced (${count})`);

for (const mutate of [
  (paper) => { paper.extra = true; },
  (paper) => { paper.missions.m1.v = 0; },
  (paper) => { paper.missions.m2.x0 = 1; },
  (paper) => { paper.missions.m3.B.x0 = paper.missions.m3.A.x0; },
  (paper) => { paper.missions.m4.atPosition += 0.5; },
  (paper) => { paper.missions.m5.meetTime = 1; },
  (paper) => { paper.missions.m5 = { A: { x0: -8, v: -2 }, meetTime: 2 }; },
  (paper) => { paper.missions.m4 = { ...paper.missions.m1, atTime: 4, atPosition: S.positionAt(paper.missions.m1, 4) }; }
]) {
  const invalid = structuredClone(deterministic);
  mutate(invalid);
  assert.equal(G.validateGeneratedPaper(invalid), false, "tampered generated paper fails closed");
}

console.log(`Position-time generator checks passed; pool sizes ${JSON.stringify(sizes)}, 10k unique papers ${fingerprints.size}`);
