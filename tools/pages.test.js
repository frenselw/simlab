'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {XMLParser} = require('fast-xml-parser');
const {build, directory, workbenches, activities} = require('./build-pages');
const root = path.resolve(__dirname, '..');

build();
fs.writeFileSync(path.join(directory, 'removed-activity.html'), 'stale');
build();
const rocketManifest = new XMLParser({ignoreAttributes: false}).parse(fs.readFileSync(path.join(root, 'sim/manifests/rocket-space-mission-lab.xml'), 'utf8'));
const sourceFiles = new Set([...workbenches.flatMap(slug => require('../sim/' + slug + '/assets.json').files), ...rocketManifest.manifest.resources.resource.file.map(file => file['@_href'])]);
const pageFiles = ['index.html', 'styles.css', ...activities.map(slug => 'previews/' + slug + '.png')];
const expected = [...sourceFiles, ...pageFiles].sort();
const actual = fs.readdirSync(directory, {recursive: true}).filter(file => fs.statSync(path.join(directory, file)).isFile()).map(file => file.split(path.sep).join('/')).sort();
assert.deepEqual(actual, expected, 'Publish only the four declared simulations and previews; remove stale files');
for (const file of sourceFiles) assert(fs.readFileSync(path.join(directory, file)).equals(fs.readFileSync(path.join(root, 'sim', file))), 'Stale runtime: ' + file);
for (const file of pageFiles) assert(fs.readFileSync(path.join(directory, file)).equals(fs.readFileSync(path.join(__dirname, 'pages', file))));
const homepage = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
assert(homepage.includes('<title>SimLab · 互動模擬</title>') && homepage.includes('<h1>SimLab · 互動模擬</h1>'));
assert.deepEqual([...homepage.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]), activities.map(slug => slug + '/index.html'));
const images = [...homepage.matchAll(/<img src="([^"]+)" width="(\d+)" height="(\d+)" alt="([^"]+)"/g)];
assert.deepEqual(images.map(match => match[1]), activities.map(slug => 'previews/' + slug + '.png'));
for (const [, file, width, height] of images) {
  const png = fs.readFileSync(path.join(directory, file));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Expected real PNG screenshot: ' + file);
  assert.equal(png.readUInt32BE(16), Number(width));
  assert.equal(png.readUInt32BE(20), Number(height));
}
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
console.log('Pages checks passed: ' + actual.length + ' exact files, fresh build, source bytes, four entries, screenshots and local dependencies.');
