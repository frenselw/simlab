#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const schema = path.join(__dirname, "schema", "simlab-scorm12-manifest-profile.xsd");

function filesBelow(directory, suffix) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target, suffix) : entry.name.endsWith(suffix) ? [target] : [];
  });
}

for (const file of filesBelow(path.join(root, "sim"), ".js").concat(filesBelow(path.join(root, "tools"), ".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const file of filesBelow(path.join(root, "sim", "manifests"), ".xml")) {
  const xml = fs.readFileSync(file, "utf8");
  const parsed = spawnSync("xmllint", ["--noout", "--schema", schema, file], { stdio: "inherit" });
  if (parsed.status !== 0) process.exit(parsed.status || 1);
  if (!/adlcp:scormtype="sco"/.test(xml) || /adlcp:scormType=/.test(xml)) {
    throw new Error("Invalid SCORM 1.2 resource type in " + path.relative(root, file));
  }
  validateManifestSemantics(xml, file);
}

const invalidFixture = path.join(__dirname, "fixtures", "invalid-manifest.xml");
const invalid = spawnSync("xmllint", ["--noout", "--schema", schema, invalidFixture], { stdio: "ignore" });
if (invalid.status === 0) throw new Error("Invalid manifest fixture unexpectedly passed schema validation");

const validXml = fs.readFileSync(path.join(root, "sim", "manifests", "fbd-horizontal-block.xml"), "utf8");
for (const invalidXml of [
  validXml.replace('default="ORG-FBD-HORIZONTAL-BLOCK"', 'default="MISSING"'),
  validXml.replace('identifierref="RES-FBD-HORIZONTAL-BLOCK"', 'identifierref="MISSING"'),
  validXml.replace("<schemaversion>1.2</schemaversion>", "<schemaversion>2004</schemaversion>"),
  validXml.replace('type="webcontent"', 'type="other"'),
  validXml.replace('<file href="fbd-horizontal-block/index.html"/>', "")
]) {
  assertSemanticFailure(invalidXml);
}

console.log("JavaScript and SimLab SCORM 1.2 manifest profile checks passed");

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1], match[2]]));
}

function validateManifestSemantics(xml, file = "manifest") {
  const metadata = xml.match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1] || "";
  if (!/<schema>\s*ADL SCORM\s*<\/schema>/.test(metadata) || !/<schemaversion>\s*1\.2\s*<\/schemaversion>/.test(metadata)) {
    throw new Error(file + ": metadata must declare ADL SCORM 1.2");
  }
  const organizationsTag = xml.match(/<organizations\b[^>]*>/)?.[0];
  const organizationTags = [...xml.matchAll(/<organization\b[^>]*>/g)].map((match) => attributes(match[0]));
  const resourceBlocks = [...xml.matchAll(/(<resource\b[^>]*>)([\s\S]*?)<\/resource>/g)];
  if (!organizationsTag || organizationTags.length === 0 || resourceBlocks.length === 0) throw new Error(file + ": organizations and resources are required");
  const organizationIds = organizationTags.map((item) => item.identifier);
  const defaultId = attributes(organizationsTag).default;
  if (!defaultId || !organizationIds.includes(defaultId)) throw new Error(file + ": organizations default must reference an organization");
  const resourceIds = resourceBlocks.map((block) => attributes(block[1]).identifier);
  assertUnique(organizationIds, file, "organization identifier");
  assertUnique(resourceIds, file, "resource identifier");
  for (const item of xml.matchAll(/<item\b[^>]*>/g)) {
    if (!resourceIds.includes(attributes(item[0]).identifierref)) throw new Error(file + ": item identifierref must reference a resource");
  }
  for (const block of resourceBlocks) {
    const resource = attributes(block[1]);
    const files = [...block[2].matchAll(/<file\b[^>]*>/g)].map((match) => attributes(match[0]).href);
    if (resource.type !== "webcontent" || resource["adlcp:scormtype"] !== "sco") throw new Error(file + ": resource must be a SCORM webcontent SCO");
    if (!resource.href || !files.includes(resource.href)) throw new Error(file + ": launch href must be declared as a file");
    assertUnique(files, file, "file href");
  }
}

function assertUnique(values, file, label) {
  if (values.some((value) => !value) || new Set(values).size !== values.length) throw new Error(file + ": invalid or duplicate " + label);
}

function assertSemanticFailure(xml) {
  try {
    validateManifestSemantics(xml, "negative semantic fixture");
  } catch {
    return;
  }
  throw new Error("Invalid semantic manifest fixture unexpectedly passed");
}
