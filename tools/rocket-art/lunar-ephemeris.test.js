'use strict';
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {gunzipSync} = require('node:zlib');
const reference = require('./lunar-ephemeris-reference.json');

const compressed = readFileSync(join(__dirname, 'lunar-ephemeris.bin.gz'));
assert(compressed.length <= 75000, 'Packed geometric ephemeris exceeds its size budget');
assert.equal(createHash('sha256').update(compressed).digest('hex'), reference.sha256);
const samples = 1545;
const bytes = gunzipSync(compressed, {maxOutputLength: 2 * samples * 24});
assert.equal(bytes.length, 2 * samples * 24);
for (const [body, scale, min, max] of [[0, 1, 340e6, 420e6], [1, 100, 145e9, 155e9]]) {
  for (let i = 0; i < samples; i++) {
    const start = (body * samples + i) * 24;
    const distance = Math.hypot(...[0, 4, 8].map(offset => bytes.readInt32LE(start + offset))) * scale;
    assert(distance >= min && distance <= max, 'Unexpected body, units, or sample order');
  }
}
