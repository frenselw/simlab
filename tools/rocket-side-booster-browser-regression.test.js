'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),AdmZip=require('adm-zip'),{caseNames}=require('./rocket-side-booster-browser-regression'),{assets,build}=require('./package-rocket-explorer');
assert.equal(new Set(caseNames).size,6);assert.deepEqual(caseNames,['layout','assembly','controls','flight','return','effects']);assert.equal(assets.kind,'standalone');assert(!assets.files.some(f=>/scorm|scoring|persistence|activity-flow/.test(f)));assert(assets.files.includes('shared/fullscreen.js'));
const html=fs.readFileSync(path.join(__dirname,'../sim/rocket-side-booster-lab/index.html'),'utf8');assert(!/計分|評分|滿分|分數|提交|成果與|側助推器實驗版|scorm\.js|scoring\.js|persistence\.js/.test(html));
const zip=new AdmZip(build()),names=zip.getEntries().map(e=>e.entryName);assert(!names.includes('imsmanifest.xml'));assert.equal(names.length,assets.files.length);for(const file of assets.files)assert(zip.readFile(file).equals(fs.readFileSync(path.join(__dirname,'../sim',file))));
console.log('Explorer: six browser owners, dependency-complete standalone package, no assessment runtime or manifest passed.');
