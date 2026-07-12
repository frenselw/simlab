#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { XMLParser, XMLValidator } = require("fast-xml-parser");

const root = path.resolve(__dirname, "..");

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
  if (XMLValidator.validate(xml) !== true) throw new Error("Malformed XML: " + path.relative(root, file));
  validateManifestSemantics(xml, file);
}

const invalidFixture = path.join(__dirname, "fixtures", "invalid-manifest.xml");
assertSemanticFailure(fs.readFileSync(invalidFixture, "utf8"));

const validXml = fs.readFileSync(path.join(root, "sim", "manifests", "fbd-horizontal-block.xml"), "utf8");
[
  validXml.replace('default="ORG-FBD-HORIZONTAL-BLOCK"', 'default="MISSING"'),
  validXml.replace('identifierref="RES-FBD-HORIZONTAL-BLOCK"', 'identifierref="MISSING"'),
  validXml.replace("<schemaversion>1.2</schemaversion>", "<schemaversion>2004</schemaversion>"),
  validXml.replace('type="webcontent"', 'type="other"'),
  validXml.replace('<file href="fbd-horizontal-block/index.html"/>', ""),
  validXml.replace('identifier="fbd-horizontal-block"', 'identifier=""'),
  validXml.replace('identifier="fbd-horizontal-block" version="1.0"', 'identifier="fbd-horizontal-block" version=""'),
  validXml.replace('xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"', 'xmlns:adlcp="wrong"'),
  validXml.replace('<organization identifier="ORG-FBD-HORIZONTAL-BLOCK">', '<organization identifier="ORG-FBD-HORIZONTAL-BLOCK">').replace('<title>水平面靜止物體受力圖</title>', '<title></title>'),
  validXml.replace('identifier="ITEM-FBD-HORIZONTAL-BLOCK"', 'identifier=""'),
  validXml.replace(/<item[\s\S]*?<\/item>/, ""),
  validXml.replace('adlcp:scormtype="sco"', 'adlcp:scormType="sco"'),
  validXml.replace('<file href="shared/scorm.js"/>', '<file href=""/>')
].forEach((invalidXml, index) => assertSemanticFailure(invalidXml, `negative mutation ${index + 1}`));

console.log("JavaScript and SimLab SCORM 1.2 manifest profile checks passed");

function validateManifestSemantics(xml, file = "manifest") {
  const manifest = new XMLParser({ ignoreAttributes: false }).parse(xml).manifest;
  const ims = "http://www.imsproject.org/xsd/imscp_rootv1p1p2";
  const adl = "http://www.adlnet.org/xsd/adlcp_rootv1p2";
  const schemaLocation = manifest?.["@_xsi:schemaLocation"] || "";
  if (!manifest?.["@_identifier"] || !manifest["@_version"] || manifest["@_xmlns"] !== ims || manifest["@_xmlns:adlcp"] !== adl || manifest["@_xmlns:xsi"] !== "http://www.w3.org/2001/XMLSchema-instance" || !schemaLocation.includes(ims) || !schemaLocation.includes(adl)) {
    throw new Error(file + ": manifest root must declare its identifier and SCORM 1.2 namespaces");
  }
  const metadata = manifest?.metadata || {};
  if (metadata.schema !== "ADL SCORM" || String(metadata.schemaversion) !== "1.2") {
    throw new Error(file + ": metadata must declare ADL SCORM 1.2");
  }
  const organizations = manifest?.organizations;
  const organizationTags = [].concat(organizations?.organization || []);
  const resourceBlocks = [].concat(manifest?.resources?.resource || []);
  if (!organizations || organizationTags.length === 0 || resourceBlocks.length === 0) throw new Error(file + ": organizations and resources are required");
  const organizationIds = organizationTags.map((item) => item["@_identifier"]);
  const defaultId = organizations["@_default"];
  if (!defaultId || !organizationIds.includes(defaultId)) throw new Error(file + ": organizations default must reference an organization");
  const resourceIds = resourceBlocks.map((resource) => resource["@_identifier"]);
  assertUnique(organizationIds, file, "organization identifier");
  assertUnique(resourceIds, file, "resource identifier");
  const itemIds = [];
  for (const organization of organizationTags) {
    if (!String(organization.title || "").trim()) throw new Error(file + ": organization title is required");
    const items = [].concat(organization.item || []);
    if (items.length === 0) throw new Error(file + ": organization item is required");
    for (const item of items) {
      itemIds.push(item["@_identifier"]);
      if (!String(item.title || "").trim()) throw new Error(file + ": item title is required");
      if (!resourceIds.includes(item["@_identifierref"])) throw new Error(file + ": item identifierref must reference a resource");
    }
  }
  assertUnique(itemIds, file, "item identifier");
  for (const resource of resourceBlocks) {
    const files = [].concat(resource.file || []).map((entry) => entry["@_href"]);
    if (resource["@_type"] !== "webcontent" || resource["@_adlcp:scormtype"] !== "sco") throw new Error(file + ": resource must be a SCORM webcontent SCO");
    if (!resource["@_href"] || !files.includes(resource["@_href"])) throw new Error(file + ": launch href must be declared as a file");
    assertUnique(files, file, "file href");
  }
}

function assertUnique(values, file, label) {
  if (values.some((value) => !value) || new Set(values).size !== values.length) throw new Error(file + ": invalid or duplicate " + label);
}

function assertSemanticFailure(xml, label = "negative semantic fixture") {
  try {
    validateManifestSemantics(xml, label);
  } catch {
    return;
  }
  throw new Error(label + " unexpectedly passed");
}
