#!/usr/bin/env node
"use strict";
const path=require('node:path');
const {entryInfo,runTests}=require('./test-runner');
const {tests,registeredTests,extraBrowserTests,validateRegistry}=require('./test-registry');
const {info,changedPaths,selectAffected}=require('./test-selection');
const root=path.resolve(__dirname,'..');

function selectTests(files, shard) {
  if (!shard) return files;
  const match = /^--shard=(\d+)\/(\d+)$/.exec(shard);
  if (!match) throw new Error('Expected --shard=index/count');
  const index = Number(match[1]), count = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || index < 1 || index > count || count > files.length) throw new Error('Invalid test shard');
  return files.filter((_, position) => position % count === index - 1);
}

function parseOptions(args) {
  const options = {suite: 'all', kind: null, shard: null, list: false, reportPath: null, base:null, head:null, plan:false, affected:false};
  const seen = new Set();
  for (const arg of args) {
    const key = arg.split('=')[0];
    if (seen.has(key)) throw new Error('Duplicate option: ' + key);
    seen.add(key);
    if (arg === '--list') options.list = true;
    else if(arg==='--affected')options.affected=true;
    else if(arg==='--plan')options.plan=true;
    else if(arg.startsWith('--base=')&&arg.length>7)options.base=arg.slice(7);
    else if(arg.startsWith('--head=')&&arg.length>7)options.head=arg.slice(7);
    else if (/^--suite=(all|registered|extra)$/.test(arg)) options.suite = arg.split('=')[1];
    else if (/^--kind=(node|browser)$/.test(arg)) options.kind = arg.split('=')[1];
    else if (arg.startsWith('--shard=')) options.shard = arg;
    else if (arg.startsWith('--report=') && arg.length > 9) options.reportPath = arg.slice(9);
    else throw new Error('Unknown test option: ' + arg);
  }
  if(!!options.base!==!!options.head)throw new Error('Supply both --base and --head');
  if(options.affected&&!options.base)throw new Error('test:affected requires --base and --head');
  if(options.base&&(options.kind||options.suite!=='all'))throw new Error('Affected comparison cannot be combined with suite/kind filters');
  if(options.plan&&options.list)throw new Error('Choose either --plan or --list');
  return options;
}

function plannedTests(options) {
  let selected = options.suite === 'registered' ? registeredTests : options.suite === 'extra' ? extraBrowserTests : tests;
  if (options.kind) selected = selected.filter(t => entryInfo(t).kind === options.kind);
  return selectTests(selected, options.shard);
}

async function main(args = process.argv.slice(2)) {
  validateRegistry();
  const options = parseOptions(args);
  let selected=plannedTests(options);
  if(options.base){
    const comparison=changedPaths(root,options.base,options.head), plan=selectAffected(tests,comparison.paths);
    console.log(JSON.stringify({...comparison,mode:plan.mode,reasons:plan.reasons,packages:plan.packages,expected:plan.entries.map(e=>e.id)},null,2));
    if(options.plan)return;
    if(plan.mode==='docs'){console.log(JSON.stringify(require('./check-docs').checkDocs(comparison.paths,root)));return;}
    selected=selectTests(plan.entries,options.shard);
  }else if(options.plan)throw new Error('--plan needs explicit comparison refs');
  if (options.list) return console.log(JSON.stringify(selected.map(info), null, 2));
  const report = await runTests(selected, {root, reportPath: options.reportPath});
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
if (require.main === module) main().catch(e => {console.error(e.stack); process.exitCode = 1;});
module.exports = {tests, registeredTests, extraBrowserTests, selectTests, parseOptions, plannedTests};
