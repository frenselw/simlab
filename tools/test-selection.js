'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const {info,tests:registered,helpers,assetLists} = require('./test-registry');
const {XMLParser} = require('fast-xml-parser');
const evidenceDocs = new Set(['docs/ci-test-baseline-2026-10-13.md','docs/ci-test-split-2026-10-13.md','docs/ci-test-optimization-2026-10-13.md']);
const circuitScopes = new Set(['circuit-workbench','circuit-ac-workbench','circuit-dc-series-build','circuit-dc-rheostat-adjust','circuit-household-workbench']);
const circuitInputs = new Set([...registered.map(info).filter(e=>e.scope==='circuit-family'),...helpers.filter(e=>e.scope==='circuit-family')].map(e=>e.file));

function assetOwners(root = path.resolve(__dirname,'..')) {
  const result = new Map(), add = (file, scope) => {
    const key = path.posix.normalize('sim/' + file);
    if (!result.has(key)) result.set(key,new Set());
    result.get(key).add(scope);
  };
  const directory = path.join(root,'sim/manifests');
  for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.xml'))) {
    const manifest = new XMLParser({ignoreAttributes:false}).parse(fs.readFileSync(path.join(directory,name),'utf8')).manifest;
    for (const resource of [].concat(manifest?.resources?.resource || [])) {
      for (const file of [].concat(resource.file || [])) add(file['@_href'],path.basename(name,'.xml'));
    }
  }
  for (const {scope,file} of assetLists) {
    const source = JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
    for (const file of source.files) add(file,scope);
  }
  return result;
}

function parseNameStatus(text) {
  const tokens = text.split('\0');
  if (tokens.pop() !== '') throw new Error('Git diff must be NUL terminated');
  const paths = [];
  for (let i = 0; i < tokens.length;) {
    const status = tokens[i++];
    if (!/^(?:[MADTU]|[RC]\d+)$/.test(status)) throw new Error('Unknown Git change status: ' + status);
    const count = /^[RC]/.test(status) ? 2 : 1;
    for (let j = 0; j < count; j++) {
      if (!tokens[i]) throw new Error('Missing Git change path');
      paths.push(tokens[i++]);
    }
  }
  return [...new Set(paths)];
}
function git(root, args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) throw new Error('Git comparison failed: ' + result.stderr);
  return result.stdout;
}
function commit(root, ref) {
  if (!ref || ref.startsWith('-')) throw new Error('Expected a valid comparison ref');
  return git(root, ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}']).trim();
}
function changedPaths(root, base, head) {
  const baseSha = commit(root, base), headSha = commit(root, head);
  if (headSha !== commit(root, 'HEAD')) throw new Error('The tested checkout must match the requested head');
  return {baseSha, headSha, paths: parseNameStatus(git(root, ['diff', '--name-status', '-z', '--find-renames', baseSha, headSha, '--']))};
}
function selectAffected(tests, paths, {trustedEmpty = false, forceFullReason = null, assets = null} = {}) {
  const entries = tests.map(info), fast = entries.filter(e => e.kind === 'node'), browser = entries.filter(e => e.kind === 'browser');
  const full = reason => ({mode:'full', entries, reasons:[reason], packages:'all', paths});
  if (forceFullReason) return full(forceFullReason);
  if (!paths.length) return trustedEmpty ? {mode:'fast', entries:fast, reasons:['Qualified unchanged main commit'], packages:[], paths} :
    full('Empty range has no qualified main success');
  const isPolicy = p => p === 'AGENTS.md' || p === 'plans/00-shared-platform-and-style.md' ||
    p === 'plans/34-ci-test-improvement-plan.md' || p === 'docs/simulation-scorm-production-guide.md' || (/^docs\/ci-/.test(p) && !evidenceDocs.has(p));
  const isDoc = p => p === 'README.md' || /^(plans|docs)\/.*\.md$/.test(p);
  if (paths.every(p => isDoc(p) && !isPolicy(p))) return {mode:'docs', entries:[], reasons:['Only ordinary documentation changed'], packages:[], paths};
  try { assets ||= assetOwners(); } catch (e) { return full('Could not validate asset consumers: ' + e.message); }
  const selected = new Set(fast.map(e => e.id)), packages = new Set(), reasons = [];
  const addScope = scope => {
    const matches = browser.filter(e => e.scope === scope);
    if (!matches.length) return false;
    matches.forEach(e => selected.add(e.id));
    if (scope === 'circuit-family') ['circuit-workbench','circuit-ac-workbench','circuit-dc-series-build','circuit-dc-rheostat-adjust','circuit-household-workbench'].forEach(p => packages.add(p));
    else packages.add(scope);
    return true;
  };
  for (const p of paths) {
    if (isDoc(p) && !isPolicy(p)) continue;
    if (isPolicy(p) || p.startsWith('.github/') || p.startsWith('sim/shared/') || p.startsWith('sim/vendor/') ||
      /^package(?:-lock)?\.json$/.test(p) || p === 'sim/config.js' ||
      /^tools\/(?:run-tests|test-runner|test-selection|test-registry|ci-|package-|position-time-browser-regression)/.test(p)) return full('Shared policy, infrastructure or dependency changed: ' + p);
    if (p.startsWith('sim/')) {
      const parts = p.split('/');
      const scope = parts[1] === 'manifests' ? path.posix.basename(p, '.xml') : parts[1];
      const family = circuitScopes.has(scope) ? 'circuit-family' : scope;
      if (parts[1] !== 'manifests' && !p.endsWith('.test.js') && !/(?:assets|runtime-assets)\.json$/.test(p) && !assets.has(p)) return full('Runtime file has no declared asset consumer: ' + p);
      if (!addScope(family)) return full('No complete browser mapping for ' + p);
      for (const consumer of assets.get(p) || []) {
        if (!addScope(circuitScopes.has(consumer) ? 'circuit-family' : consumer)) return full('Unmapped reverse asset consumer: ' + consumer);
      }
      reasons.push(p + ' -> ' + family);
      continue;
    }
    if (p.startsWith('tools/circuit-')) {
      if (!circuitInputs.has(p)) return full('Unknown circuit helper consumer: ' + p);
      addScope('circuit-family');
      reasons.push(p + ' -> all circuit consumers');
      continue;
    }
    const helper=helpers.find(e=>e.file===p);
    if(helper){
      if(helper.scope.startsWith('shared-')||!addScope(helper.scope))return full('Shared or unmapped browser helper: '+p);
      reasons.push(p+' -> '+helper.scope);continue;
    }
    const exact = browser.filter(e => e.file === p || e.file === p.replace(/\.test\.js$/,'.js'));
    if (exact.length) {
      if (exact.some(e => e.scope.startsWith('shared-'))) return full('Shared browser coverage changed: ' + p);
      for (const e of exact) if (!addScope(e.scope)) return full('Unmapped browser owner: ' + p);
      reasons.push(p + ' -> owning browser scope');
      continue;
    }
    if (entries.some(e => e.kind === 'node' && e.file === p)) {
      reasons.push(p + ' -> all Node tests');
      continue;
    }
    return full('Unrecognised dependency: ' + p);
  }
  return {mode:'affected', entries:entries.filter(e => selected.has(e.id)), reasons, packages:[...packages].sort(), paths};
}
module.exports = {info, parseNameStatus, changedPaths, selectAffected, commit, assetOwners};
