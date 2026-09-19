"use strict";

const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");

const root = path.resolve(__dirname, "..");
const slug = "force-orthogonal-decomposition";
const zipPath = path.join(root, "output", `${slug}-scorm.zip`);
const packageRoot = path.join(root, "output", `${slug}-scorm-extracted`);

if (!fs.existsSync(zipPath)) throw new Error(`Missing SCORM package: ${zipPath}`);
fs.mkdirSync(packageRoot, { recursive: true });
const zip = new AdmZip(zipPath);
for (const entry of zip.getEntries()) {
  const normalized = entry.entryName.replace(/\\/g, "/");
  if (path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) throw new Error(`Unsafe SCORM ZIP entry: ${entry.entryName}`);
}
zip.extractAllTo(packageRoot, true);
process.stdout.write(`${packageRoot}\n`);
