'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {build, directory, workbenches} = require('./build-pages');
const root = path.resolve(__dirname, '..');

build();
fs.writeFileSync(path.join(directory, 'removed-activity.html'), 'stale');
build();
const sourceFiles = new Set(workbenches.flatMap(slug => require('../sim/' + slug + '/assets.json').files));
const expected = [...sourceFiles, 'index.html', 'styles.css'].sort();
const actual = fs.readdirSync(directory, {recursive: true}).filter(file => fs.statSync(path.join(directory, file)).isFile()).map(file => file.split(path.sep).join('/')).sort();
assert.deepEqual(actual, expected, 'Publish only the three declared workbenches; remove stale files');
for (const file of sourceFiles) assert(fs.readFileSync(path.join(directory, file)).equals(fs.readFileSync(path.join(root, 'sim', file))), 'Stale runtime: ' + file);
for (const file of ['index.html', 'styles.css']) assert(fs.readFileSync(path.join(directory, file)).equals(fs.readFileSync(path.join(__dirname, 'pages', file))));
const homepage = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
assert.deepEqual([...homepage.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]), workbenches.map(slug => slug + '/index.html'));
for (const file of actual.filter(file => /\.(html|css)$/.test(file))) {
  const text = fs.readFileSync(path.join(directory, file), 'utf8');
  const refs = file.endsWith('.html') ? [...text.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]) : [...text.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)].map(match => match[1]);
  for (const ref of refs) {
    if (ref.startsWith('#') || ref.startsWith('data:')) continue;
    assert(!ref.startsWith('/') && !/^[a-z]+:/i.test(ref), 'Expected a project-relative runtime asset: ' + ref);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), ref.split(/[?#]/)[0]));
    assert(expected.includes(target), file + ' references missing asset: ' + ref);
  }
}
console.log('Pages checks passed: ' + actual.length + ' exact files, fresh build, source bytes, three entries and local dependencies.');
