'use strict';
const assert = require('node:assert/strict');
const {tests, registeredTests, extraBrowserTests, selectTests, parseOptions, plannedTests} = require('./run-tests');
assert.deepEqual(selectTests(tests), tests);
for (const count of [1, 2, 4]) {
  const shards = Array.from({length: count}, (_, index) => selectTests(tests, `--shard=${index + 1}/${count}`));
  const assigned = shards.flat().map(test => JSON.stringify(test));
  assert.equal(new Set(assigned).size, tests.length, 'every registered test runs exactly once');
  assert.equal(assigned.length, tests.length, 'sharding neither duplicates nor drops tests');
  assert.deepEqual([...assigned].sort(), tests.map(test => JSON.stringify(test)).sort());
  assert(Math.max(...shards.map(shard => shard.length)) - Math.min(...shards.map(shard => shard.length)) <= 1);
}
assert.deepEqual(tests.filter(test => typeof test !== 'string'), [
  {file: 'tools/circuit-workbench-browser-regression.js', args: ['--entry=source']},
  {file: 'tools/circuit-workbench-browser-regression.js', args: ['--entry=package']}
], 'the full source and full ZIP matrices each run once');
for (const invalid of ['--shard=0/4', '--shard=5/4', '--shard=1/0', '--shard=1/99999', '--shard=1.5/4', '--shard=foo', '--unknown']) assert.throws(() => selectTests(tests, invalid));
assert.deepEqual(plannedTests(parseOptions(['--suite=registered'])), registeredTests);
assert.deepEqual(plannedTests(parseOptions(['--suite=extra'])), extraBrowserTests);
assert.equal(extraBrowserTests.length, 6, 'all six former workflow-only browser entries are preserved');
assert(plannedTests(parseOptions(['--kind=node'])).every(t => (typeof t === 'string' ? t : t.file).endsWith('.test.js')));
assert.equal(plannedTests(parseOptions(['--suite=extra', '--kind=browser'])).length, 6);
for (const args of [['--wat'], ['--suite=wat'], ['--kind=wat'], ['--list', '--list']]) assert.throws(() => parseOptions(args));
console.log('Test shards preserve every registered check exactly once.');
