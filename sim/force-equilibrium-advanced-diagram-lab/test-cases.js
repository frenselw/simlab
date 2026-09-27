"use strict";
const G = require('./generator.js'), c = G.choices, cases = [];
for (const sign of [-1, 1]) {
  for (const theta of c.wallAngles) cases.push(G.build('A', { sign, theta }));
  for (const gamma of c.ropeAngles) for (const delta of c.springAngles) cases.push(G.build('B', { sign, gamma, delta }));
  for (const target of ['A', 'B']) for (const weightB of c.weights) for (const compression of c.compression) for (const push of c.pushes)
    cases.push(G.build('C', { sign, target, weightB, compression, push }));
  for (const theta of c.slopeAngles) for (const mu of c.friction) for (const travel of [-1, 1]) cases.push(G.build('D', { sign, theta, mu, travel }));
  for (const alpha of c.suspension) for (const target of [1, 2]) cases.push(G.build('E', { sign, alpha, target }));
}
module.exports = cases;
