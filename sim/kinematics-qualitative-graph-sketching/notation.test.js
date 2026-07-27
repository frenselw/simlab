"use strict";

const assert = require("node:assert/strict");
const Notation = require("./notation.js");

function reconstructed(parts) {
  return parts.map((part) => part.text).join("");
}

const sample = "data-time extra-text Control Z x-t v–t x v a t";
const parts = Notation.tokenize(sample);
assert.equal(reconstructed(parts), "data-time extra-text Control Z x–t v–t x v a t");
assert.deepEqual(
  parts.filter((part) => part.variable).map((part) => part.text),
  ["x", "t", "v", "t", "x", "v", "a", "t"]
);
assert.equal(Notation.tokenize("prefixx-t x-time data-time extra-text Control Z")
  .some((part) => part.variable), false);
assert.equal(Notation.tokenize("x–t").filter((part) => part.variable).length, 2);
assert.equal(Notation.tokenize("").length, 0);

console.log("Qualitative kinematics notation tests passed");
