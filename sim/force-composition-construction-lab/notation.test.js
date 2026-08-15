"use strict";

const assert = require("node:assert/strict");
const N = require("./notation.js");

for (const index of [1, 2, 3]) {
  const token = N.vector(index);
  assert.equal(token.className, "math-vector");
  assert.equal(token.subscript, String(index));
  assert.match(token.accessible, /力矢量/);
  assert.equal(N.scalar(index).className, "math-scalar");
}
assert.deepEqual(N.vector("R"), { kind: "vector", text: "F", subscript: "R", className: "math-vector", accessible: "合力 F R" });
assert.equal(N.point("O").className, "math-point");
assert.equal(N.operator("+").className, "math-operator");
assert.equal(N.number(3).className, "math-number");
assert.equal(N.unit("N").className, "math-unit");
assert.deepEqual(N.expression(2).parts.map((token) => `${token.text}${token.subscript || ""}`), ["FR", "=", "F1", "+", "F2"]);
assert.deepEqual(N.expression(3).parts.map((token) => `${token.text}${token.subscript || ""}`), ["FR", "=", "F1", "+", "F2", "+", "F3"]);
assert.equal(N.expression(3).accessible, "合力等於力矢量 F 一加力矢量 F 二加力矢量 F 三");
assert.throws(() => N.expression(4), /Only two-force/);
assert.equal(JSON.stringify(N.expression(2)).includes("F_1"), false, "notation never exposes underscore syntax");

console.log("force-composition notation tests passed");
