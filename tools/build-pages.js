#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const {build: packageWorkbench} = require('./package-circuit-workbench');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'output', 'pages');
const workbenches = ['circuit-workbench', 'circuit-ac-workbench', 'circuit-household-workbench'];

function build() {
  // Only this fixed generated directory is replaced; never follow an existing symlink.
  if (fs.existsSync(directory) && fs.realpathSync(directory) !== directory) throw Error('Unsafe Pages output directory');
  fs.rmSync(directory, {recursive: true, force: true});
  fs.mkdirSync(directory, {recursive: true});
  for (const slug of workbenches) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sim', slug, 'assets.json'), 'utf8'));
    const zip = packageWorkbench(manifest, slug + '-standalone.zip');
    new AdmZip(zip).extractAllTo(directory, true);
  }
  for (const file of ['index.html', 'styles.css']) fs.copyFileSync(path.join(__dirname, 'pages', file), path.join(directory, file));
  return directory;
}

module.exports = {build, directory, workbenches};
if (require.main === module) console.log('Built GitHub Pages site: ' + build());
