#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");

const root = path.resolve(__dirname, "..");
const slugs = fs.readdirSync(path.join(root, "sim", "manifests"))
  .filter((file) => file.endsWith(".xml"))
  .map((file) => path.basename(file, ".xml"))
  .sort();

for (const slug of slugs) {
  const packaged = spawnSync(process.execPath, [path.join(__dirname, "package-scorm.js"), slug], { stdio: "inherit" });
  if (packaged.status !== 0) process.exit(packaged.status || 1);
  const zip = path.join(root, "output", slug + "-scorm.zip");
  const entries = new AdmZip(zip).getEntries().map((entry) => entry.entryName);
  if (!entries.includes("imsmanifest.xml")) throw new Error(slug + ": imsmanifest.xml is not at ZIP root");
  if (entries.some((entry) => /(^|\/)(tests?|screenshots?|temp)(\/|$)|\.test\.js$|(^|\/)\.scorm-/.test(entry))) {
    throw new Error(slug + ": package contains development-only files");
  }
  const manifest = fs.readFileSync(path.join(root, "sim", "manifests", slug + ".xml"), "utf8");
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
  const resources = [].concat(parsed.manifest?.resources?.resource || []);
  const declared = resources.flatMap((resource) => [].concat(resource.file || []).map((file) => file["@_href"]));
  const expected = ["imsmanifest.xml", ...new Set(declared)].sort();
  assertSameEntries(entries.sort(), expected, slug);
  const launch = resources[0]?.["@_href"];
  if (!launch || !declared.includes(launch)) throw new Error(slug + ": resource launch href is not declared as a file");
}

console.log("All SCORM packages verified");

function assertSameEntries(actual, expected, slug) {
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) {
    throw new Error(slug + ": ZIP entries do not exactly match manifest file declarations");
  }
}
