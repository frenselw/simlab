'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');

function entryInfo(test) {
  const file = typeof test === 'string' ? test : test.file;
  const args = typeof test === 'string' ? [] : test.args || [];
  return {id: typeof test==='object'&&test.id ? test.id : [file, ...args].join(' '), file, args,
    kind: typeof test==='object'&&test.kind ? test.kind : file.endsWith('.test.js') ? 'node' : 'browser'};
}

function summary(report) {
  return ['## Test execution', '',
    'Commit: ' + report.sha + ' · run ' + report.runId + ' · attempt ' + report.attempt + ' · ' + report.jobKey,
    '', '| Entry | Result | Seconds |', '|---|---|---|',
    ...report.entries.map(e => '| ' + e.id + ' | ' + e.status + ' | ' + (e.durationMs / 1000).toFixed(2) + ' |'),
    '', 'Result: ' + report.status + '. Expected: ' + report.expected.length + '.',
    ...report.errors.map(e => 'Error: ' + e), ''].join('\n');
}

function validateInventory(tests,root,excluded=[]) {
  const entries=tests.map(entryInfo),files=new Set(entries.map(e=>e.file));
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('Duplicate registered test identity');
  for(const e of entries)if(!fs.existsSync(path.resolve(root,e.file)))throw Error('Registered test does not exist: '+e.file);
  const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(directory,e.name)):
    /(?:\.test\.js|-(?:browser-(?:regression|cases|test)|activity-regression)\.(?:js|sh))$/.test(e.name)?[path.relative(root,path.join(directory,e.name)).replaceAll('\\','/')]:[]);
  const discovered=['sim','tools'].flatMap(d=>walk(path.join(root,d)));
  const packageFile=path.join(root,'package.json');
  if(fs.existsSync(packageFile))for(const [name,command] of Object.entries(JSON.parse(fs.readFileSync(packageFile,'utf8')).scripts||{})){
    if(name.startsWith('test:browser:'))discovered.push(...[...command.matchAll(/(?:sim|tools)\/[\w./-]+\.(?:js|sh)\b/g)].map(m=>m[0]));
  }
  for(const file of discovered)if(!files.has(file)&&!excluded.includes(file))throw Error('Unregistered test: '+file);
}

function trackedDiff(root) {
  const result = spawnSync('git', ['diff', 'HEAD', '--'], {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) throw new Error('Could not verify tracked files: ' + result.stderr);
  return result.stdout;
}

async function executeEntry(entry, {root, directory, timeoutMs, output = true}) {
  const name = createHash('sha256').update(entry.id).digest('hex').slice(0, 16) + '.log';
  const log = fs.createWriteStream(path.join(directory, name));
  const startedAt = new Date().toISOString(), start = performance.now();
  let timedOut = false, error = null, killTimer;
  const child = spawn(process.execPath, [path.resolve(root, entry.file), ...entry.args],
    {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32'});
  const stop = signal => {
    if (!child.pid) return;
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio: 'ignore'});
      } else process.kill(-child.pid, signal);
    } catch (e) { if (e.code !== 'ESRCH') error = String(e); }
  };
  const timeout = setTimeout(() => {
    timedOut = true; stop('SIGTERM');
    killTimer = setTimeout(() => stop('SIGKILL'), 5000);
  }, timeoutMs);
  const cancel = () => { error = 'Execution interrupted'; stop('SIGTERM'); };
  process.once('SIGTERM', cancel);
  process.once('SIGINT', cancel);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {
    log.write(data);
    if (output) (stream === child.stdout ? process.stdout : process.stderr).write(data);
  });
  const result = await new Promise(resolve => {
    child.on('error', e => { error = e.message; });
    child.on('close', (code, signal) => resolve({code, signal}));
  });
  clearTimeout(timeout); clearTimeout(killTimer);
  process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  await new Promise(resolve => log.end(resolve));
  return {...entry, startedAt, completedAt: new Date().toISOString(), durationMs: performance.now() - start,
    status: error === 'Execution interrupted' ? 'cancelled' : timedOut ? 'timeout' : result.code === 0 && !error ? 'passed' : 'failed',
    exitCode: result.code, signal: result.signal, error, log: name};
}

async function runTests(tests, options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const reportPath = path.resolve(options.reportPath || process.env.SIMLAB_TEST_REPORT || path.join(root,
    'output/ci-tests/local-' + Date.now() + '-' + process.pid, 'report.json'));
  const directory = path.dirname(reportPath);
  fs.mkdirSync(directory, {recursive: true});
  const entries = tests.map(entryInfo);
  if (!entries.length || new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('Expected unique nonempty test entries');
  const git = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'});
  const environmentPath = path.resolve(root, process.env.SIMLAB_ENVIRONMENT_REPORT || 'output/ci-tests/environment.json');
  const environment = fs.existsSync(environmentPath) ? JSON.parse(fs.readFileSync(environmentPath, 'utf8')) :
    {node: process.version, platform: process.platform, arch: process.arch};
  const report = {schemaVersion: 1, runId: process.env.GITHUB_RUN_ID || 'local',
    attempt: process.env.GITHUB_RUN_ATTEMPT || '1', jobKey: process.env.SIMLAB_JOB_KEY || 'local',
    sha: git.status === 0 ? git.stdout.trim() : 'fixture', event: process.env.GITHUB_EVENT_NAME || 'local',
    environment, worktreeDirty: git.status === 0 ? !!trackedDiff(root) : null,ciPlanHash:options.ciPlanHash||null,
    planHash: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
    expected: entries.map(e => e.id), entries: entries.map(e => ({...e, status: 'pending', durationMs: 0})),
    errors: [], status: 'running', startedAt: new Date().toISOString()};
  const write = async () => {
    fs.writeFileSync(reportPath + '.tmp', JSON.stringify(report, null, 2) + '\n');
    for (let attempt = 0; ; attempt++) {
      try { await fs.promises.rename(reportPath + '.tmp', reportPath); break; }
      catch (e) {
        // Windows readers/virus scanners can briefly deny atomic replacement.
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(e.code) || attempt === 9) throw e;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };
  const requireClean = options.requireClean ?? process.env.GITHUB_ACTIONS === 'true';
  await write();
  try {
    if (requireClean && trackedDiff(root)) throw new Error('Checkout has uncommitted tracked changes before tests');
    for (let i = 0; i < entries.length; i++) {
      if (options.output !== false) console.log('\n[' + (i + 1) + '/' + entries.length + '] ' + entries[i].id);
      report.entries[i] = {...report.entries[i], status: 'running'};
      await write();
      const timeoutMs = options.timeoutMs || (entries[i].kind === 'browser' ? 3600000 : 120000);
      report.entries[i] = await executeEntry(entries[i], {root, directory, timeoutMs, output: options.output});
      await write();
      if (report.entries[i].status === 'cancelled') break;
      if (requireClean) {
        const diff = trackedDiff(root);
        if (diff) {
          fs.writeFileSync(path.join(directory, 'tracked-changes.diff'), diff);
          throw new Error('Tests/build modified tracked files; commit generated assets before testing this SHA');
        }
      }
    }
  } catch (e) { report.errors.push(e.stack || String(e)); }
  for (const e of report.entries) if (e.status === 'pending' || e.status === 'running') e.status = 'not-run';
  report.status = !report.errors.length && report.entries.every(e => e.status === 'passed') ? 'passed' : 'failed';
  report.completedAt = new Date().toISOString();
  await write();
  fs.writeFileSync(path.join(directory, 'summary.md'), summary(report));
  if (options.output !== false && process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(report));
  if (options.output !== false) console.log('\n' + report.status + ': ' + report.entries.filter(e => e.status === 'passed').length +
    '/' + entries.length + '; report: ' + reportPath);
  return report;
}

module.exports = {entryInfo, runTests, summary, trackedDiff,validateInventory};
