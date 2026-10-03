#!/usr/bin/env node
"use strict";
const fs = require("node:fs"), path = require("node:path"), AdmZip = require("adm-zip");
const root = path.resolve(__dirname, ".."), simRoot = path.join(root, "sim"), assets = require("../sim/circuit-workbench/assets.json");
function build() {
  if (assets.kind !== "standalone" || !assets.files.includes(assets.entry) || new Set(assets.files).size !== assets.files.length) throw new Error("Invalid workbench asset manifest");
  const zip = new AdmZip();
  for (const name of assets.files) { if (!/^(circuit-workbench|shared)\/[a-z0-9-]+\.(html|css|js|json|txt)$/.test(name)) throw new Error("Unsafe asset path: " + name); const file = fs.realpathSync(path.join(simRoot, name)); if (!file.startsWith(simRoot + path.sep) || !fs.statSync(file).isFile()) throw new Error("Invalid runtime asset: " + name); zip.addFile(name, fs.readFileSync(file)); }
  const html = fs.readFileSync(path.join(simRoot, assets.entry), "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) { if (match[1].startsWith("data:")) continue; const ref = path.posix.normalize(path.posix.join(path.posix.dirname(assets.entry), match[1])); if (!assets.files.includes(ref)) throw new Error("Undeclared runtime reference: " + match[1]); }
  const directory = path.join(root, "output"); fs.mkdirSync(directory, { recursive: true }); const file = path.join(directory, "circuit-workbench-standalone.zip"); zip.writeZip(file);
  const actual = new AdmZip(file).getEntries().map((e) => e.entryName).sort(); if (JSON.stringify(actual) !== JSON.stringify([...assets.files].sort())) throw new Error("ZIP does not match asset manifest");
  return file;
}
module.exports = { build, assets };
if (require.main === module) console.log(build());
