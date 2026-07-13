#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");

const root = path.resolve(__dirname, "..");
const simRoot = path.join(root, "sim");
const outputDir = path.join(root, "output");
const manifestDir = path.join(simRoot, "manifests");
const slug = process.argv[2];

function availableSlugs() {
  return fs
    .readdirSync(manifestDir)
    .filter((file) => file.endsWith(".xml"))
    .map((file) => path.basename(file, ".xml"))
    .sort();
}

function usage() {
  console.error("Usage: node tools/package-scorm.js <activity-slug>");
  console.error("Available: " + availableSlugs().join(", "));
  process.exit(1);
}

if (!slug) usage();

const manifestPath = path.join(manifestDir, slug + ".xml");
if (!fs.existsSync(manifestPath)) usage();

function manifestFiles(manifestPath) {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
  const resources = [].concat(parsed.manifest?.resources?.resource || []);
  const files = ["imsmanifest.xml", ...resources.flatMap((resource) => [].concat(resource.file || []).map((file) => file["@_href"]))];
  return [...new Set(files)].sort();
}

const files = manifestFiles(manifestPath);
for (const file of files) {
  if (file.includes("..") || path.isAbsolute(file)) throw new Error("Unsafe path: " + file);
  if (file.endsWith(".test.js")) throw new Error("Refusing to package test file: " + file);
  const source = file === "imsmanifest.xml" ? manifestPath : path.join(simRoot, file);
  if (!fs.existsSync(source)) throw new Error("Missing package file: " + file);
}

fs.mkdirSync(outputDir, { recursive: true });
const outputFile = path.join(outputDir, slug + "-scorm.zip");
const zip = new AdmZip();
for (const file of files) {
  const source = file === "imsmanifest.xml" ? manifestPath : path.join(simRoot, file);
  zip.addFile(file, fs.readFileSync(source));
}
zip.writeZip(outputFile);
console.log("Wrote " + path.relative(root, outputFile) + " with " + files.length + " files");
