#!/usr/bin/env node
"use strict";
const fs = require("node:fs"), path = require("node:path"), AdmZip = require("adm-zip");
const root = path.resolve(__dirname, ".."), simRoot = path.join(root, "sim"), assets = require("../sim/circuit-workbench/assets.json");
function build(manifest=assets,packageName='circuit-workbench-standalone.zip') {
  if(!/^[a-z0-9-]+-standalone\.zip$/.test(packageName))throw new Error('Unsafe standalone package name');
  if (manifest.kind !== "standalone" || !manifest.files.includes(manifest.entry) || new Set(manifest.files).size !== manifest.files.length) throw new Error("Invalid workbench asset manifest");
  const zip = new AdmZip();
  for (const name of manifest.files) { if (!/^(circuit-workbench|circuit-ac-workbench|shared)\/[a-z0-9-]+\.(html|css|js|json|txt)$/.test(name)) throw new Error("Unsafe asset path: " + name); const file = fs.realpathSync(path.join(simRoot, name)); if (!file.startsWith(simRoot + path.sep) || !fs.statSync(file).isFile()) throw new Error("Invalid runtime asset: " + name); zip.addFile(name, fs.readFileSync(file)); }
  const html = fs.readFileSync(path.join(simRoot, manifest.entry), "utf8");
  const ids=new Set([...html.matchAll(/\bid="([^"\s]+)"/g)].map(m=>m[1]));
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) { if (match[1].startsWith("data:")) continue; if(match[1].startsWith("#")){if(!ids.has(match[1].slice(1)))throw new Error("Unknown local SVG/anchor reference: "+match[1]);continue;} const ref = path.posix.normalize(path.posix.join(path.posix.dirname(manifest.entry), match[1])); if (!manifest.files.includes(ref)) throw new Error("Undeclared runtime reference: " + match[1]); }
  const directory = path.join(root, "output"); fs.mkdirSync(directory, { recursive: true }); const file = path.join(directory, packageName); zip.writeZip(file);
  const actual = new AdmZip(file).getEntries().map((e) => e.entryName).sort(); if (JSON.stringify(actual) !== JSON.stringify([...manifest.files].sort())) throw new Error("ZIP does not match asset manifest");
  return file;
}
module.exports = { build, assets };
if (require.main === module) console.log(build());
