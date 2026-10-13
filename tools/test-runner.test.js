'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {runTests, entryInfo,validateInventory} = require('./test-runner');

async function main() {
  const parent = path.resolve(__dirname, '../output/ci-tests');
  fs.mkdirSync(parent, {recursive: true});
  const root = fs.mkdtempSync(path.join(parent, 'runner-fixture-'));
  try {
    fs.writeFileSync(path.join(root, 'fail.js'), 'console.error("first failure");process.exitCode=2;');
    fs.writeFileSync(path.join(root, 'pass.js'), 'console.log("later success");');
    fs.writeFileSync(path.join(root, 'hang.js'), 'setTimeout(()=>{},10000);');
    const reportPath = path.join(root, 'report.json');
    const report = await runTests(['fail.js', 'pass.js'], {root, reportPath, output: false, requireClean: false});
    assert.equal(report.status, 'failed');
    assert.deepEqual(report.entries.map(e => e.status), ['failed', 'passed'], 'one failure cannot hide later independent results');
    assert.equal(report.entries[0].exitCode, 2);
    assert.equal(JSON.parse(fs.readFileSync(reportPath)).status, 'failed');
    assert.match(fs.readFileSync(path.join(root, report.entries[0].log), 'utf8'), /first failure/);
    assert.match(fs.readFileSync(path.join(root, report.entries[1].log), 'utf8'), /later success/);
    const timed = await runTests(['hang.js', 'pass.js'], {root, reportPath, timeoutMs: 1000, output: false, requireClean: false});
    assert.equal(timed.status, 'failed');
    assert.deepEqual(timed.entries.map(e => e.status), ['timeout', 'passed']);
    const passed = await runTests(['pass.js'], {root, reportPath, output: false, requireClean: false});
    assert.equal(passed.status, 'passed');
    assert.notEqual(passed.planHash, report.planHash);
    const rename = fs.promises.rename;
    let locks = 0;
    try {
      fs.promises.rename = async (...args) => {
        if (locks++ < 2) throw Object.assign(new Error('temporary Windows file lock'), {code:'EPERM'});
        return rename(...args);
      };
      assert.equal((await runTests(['pass.js'], {root, reportPath, output:false, requireClean:false})).status,'passed');
      assert(locks >= 3);
    } finally { fs.promises.rename = rename; }
    assert.notEqual(entryInfo({file: 'a.js', args: ['--entry=source']}).id,
      entryInfo({file: 'a.js', args: ['--entry=package']}).id);
    await assert.rejects(runTests([], {root, reportPath}), /nonempty/);
    await assert.rejects(runTests(['pass.js', 'pass.js'], {root, reportPath}), /unique/);
    fs.mkdirSync(path.join(root,'sim'));fs.mkdirSync(path.join(root,'tools'));
    fs.writeFileSync(path.join(root,'sim/unregistered.test.js'),'');
    assert.throws(()=>validateInventory(['pass.js'],root),/Unregistered test/);
    validateInventory(['pass.js','sim/unregistered.test.js'],root);
  } finally {
    assert.equal(path.dirname(root), parent);
    assert(path.basename(root).startsWith('runner-fixture-'));
    fs.rmSync(root, {recursive: true, force: true});
  }
  console.log('Runner preserves failures, later results, timeouts, modes and reports.');
}
main().catch(e => {console.error(e); process.exitCode = 1;});
