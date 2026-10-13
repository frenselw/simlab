'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const {findBrowser} = require('./position-time-browser-regression');
const {trackedDiff} = require('./test-runner');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');

function validateVersions(actual, expected) {
  for (const key of ['node', 'chrome']) {
    if (expected[key] && actual[key] !== expected[key]) {
      throw new Error(key + ' version mismatch: expected ' + expected[key] + ', got ' + actual[key]);
    }
  }
}
function output(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout: 15000});
  if (result.status !== 0) throw new Error('Environment probe failed: ' + command + ' ' + (result.stderr || result.error || ''));
  return result.stdout.trim();
}
function main(args) {
  if (args.length === 1 && args[0] === '--check-clean') {
    const diff = trackedDiff(root);
    if (diff) {
      const target = path.resolve(process.env.SIMLAB_TEST_REPORT || 'output/ci-tests/report.json');
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(path.join(path.dirname(target), 'tracked-changes.diff'), diff);
      throw new Error('Build changed tracked files. Commit asset/manifest updates before validating this SHA.');
    }
    return console.log('Tracked checkout unchanged.');
  }
  const nodeOnly=args.length===1&&args[0]==='--node-only';
  if (args.length&&!nodeOnly) throw new Error('Unknown environment option');
  const browser = nodeOnly?null:findBrowser();
  if (!nodeOnly&&!browser) throw new Error('Configured Chrome executable is missing');
  const version = browser?output(browser, ['--version']):'';
  const fonts = !nodeOnly&&process.platform === 'linux' ? output('fc-match', ['-f', '%{family}|%{file}', 'sans-serif:lang=zh-tw']) : null;
  const report = {
    node: process.versions.node, chrome: version.match(/\d+\.\d+\.\d+\.\d+/)?.[0],
    chromePath: browser, chromeVersionText: version, platform: process.platform, arch: process.arch,
    os: process.platform === 'linux' ? fs.readFileSync('/etc/os-release', 'utf8') : process.platform,
    image: process.env.ImageOS || null, imageVersion: process.env.ImageVersion || null,
    display: process.env.DISPLAY || null,
    sha: output('git', ['rev-parse', 'HEAD']), runId: process.env.GITHUB_RUN_ID || 'local',
    attempt: process.env.GITHUB_RUN_ATTEMPT || '1', jobKey: process.env.SIMLAB_JOB_KEY || 'local',
    fonts, fontSha256: fonts ? createHash('sha256').update(fs.readFileSync(fonts.slice(fonts.indexOf('|')+1))).digest('hex') : null
  };
  const target = path.resolve(process.env.SIMLAB_ENVIRONMENT_REPORT || 'output/ci-tests/environment.json');
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  validateVersions(report, {node: process.env.SIMLAB_EXPECTED_NODE, chrome: nodeOnly?null:process.env.SIMLAB_EXPECTED_CHROME});
  if (process.env.GITHUB_ACTIONS === 'true' && trackedDiff(root)) throw new Error('Tracked checkout must be clean before validation');
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) {
  try {main(process.argv.slice(2));} catch (e) {console.error(e.stack); process.exitCode = 1;}
}
module.exports = {validateVersions};
