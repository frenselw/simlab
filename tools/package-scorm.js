#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  const files = ["imsmanifest.xml", "config.js"];
  for (const match of manifest.matchAll(/<file\s+href="([^"]+)"\s*\/>/g)) {
    files.push(match[1]);
  }
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
const tempDir = path.join(outputDir, ".scorm-" + slug);
fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });
for (const file of files) {
  const source = file === "imsmanifest.xml" ? manifestPath : path.join(simRoot, file);
  const destination = path.join(tempDir, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const outputFile = path.join(outputDir, slug + "-scorm.zip");
if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
const result = spawnSync("zip", ["-q", "-X", outputFile, ...files], { cwd: tempDir, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status);
console.log("Wrote " + path.relative(root, outputFile) + " with " + files.length + " files");
