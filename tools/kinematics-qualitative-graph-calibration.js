#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Tasks = require("../sim/kinematics-qualitative-graph-sketching/task-definitions.js");
const Scoring = require("../sim/kinematics-qualitative-graph-sketching/scoring.js");

function usage() {
  console.error("Usage: node tools/kinematics-qualitative-graph-calibration.js <labelled-traces.json>");
  console.error("Records: { id, learnerGroup, taskId, inputMode, split, label, trace }");
}

function validateRecord(record, index) {
  const labels = ["正確", "可接受", "錯誤", "亂畫／不可判讀"];
  if (!record || typeof record.id !== "string" || typeof record.learnerGroup !== "string" ||
      !Tasks.taskById(record.taskId) || !["touch", "mouse", "keyboard"].includes(record.inputMode) ||
      !["calibration", "holdout"].includes(record.split) || !labels.includes(record.label) ||
      typeof record.trace !== "string") {
    throw new Error(`Invalid calibration record at index ${index}`);
  }
}

function predictedClass(result) {
  if (result.grossInvalid) return "亂畫／不可判讀";
  const ratio = result.maxScore ? result.score / result.maxScore : 0;
  return ratio >= 0.82 ? "正確" : ratio >= 0.55 ? "可接受" : "錯誤";
}

function summarize(records) {
  const rows = records.map((record) => {
    const result = Scoring.scoreTask(Tasks.taskById(record.taskId), record.trace);
    return { ...record, result, predicted: predictedClass(result) };
  });
  const labels = ["正確", "可接受", "錯誤", "亂畫／不可判讀"];
  const matrix = Object.fromEntries(labels.map((actual) => [
    actual,
    Object.fromEntries(labels.map((predicted) => [
      predicted, rows.filter((row) => row.label === actual && row.predicted === predicted).length
    ]))
  ]));
  const classReport = Object.fromEntries(labels.map((label) => {
    const labelled = rows.filter((row) => row.label === label);
    const correct = labelled.filter((row) => row.predicted === label).length;
    return [label, { count: labelled.length, recall: labelled.length ? correct / labelled.length : null }];
  }));
  const deviceReport = Object.fromEntries(["touch", "mouse", "keyboard"].map((inputMode) => {
    const selected = rows.filter((row) => row.inputMode === inputMode);
    return [inputMode, {
      count: selected.length,
      meanFraction: selected.length
        ? selected.reduce((sum, row) => sum + row.result.score / row.result.maxScore, 0) / selected.length : null,
      falseZero: selected.filter((row) => ["正確", "可接受"].includes(row.label) && row.result.grossInvalid).length
    }];
  }));
  const expectedGroups = new Set();
  for (const row of rows) {
    const key = `${row.learnerGroup}\u0000${row.taskId}`;
    const previous = Array.from(expectedGroups).find((item) => item === key);
    if (!previous) expectedGroups.add(key);
  }
  return {
    count: rows.length,
    confusionMatrix: matrix,
    classReport,
    deviceReport,
    grossFalseZeroRate: fraction(rows,
      (row) => ["正確", "可接受"].includes(row.label) && row.result.grossInvalid,
      (row) => ["正確", "可接受"].includes(row.label)),
    scribbleHalfCreditRate: fraction(rows,
      (row) => row.label === "亂畫／不可判讀" && row.result.score >= row.result.maxScore * 0.5,
      (row) => row.label === "亂畫／不可判讀")
  };
}

function fraction(rows, numerator, denominator) {
  const eligible = rows.filter(denominator);
  return eligible.length ? eligible.filter(numerator).length / eligible.length : null;
}

function assertSplitIsolation(records) {
  const assignments = new Map();
  for (const record of records) {
    const key = `${record.learnerGroup}\u0000${record.taskId}`;
    const previous = assignments.get(key);
    if (previous && previous !== record.split) {
      throw new Error(`Learner/task group appears in both calibration and holdout: ${record.learnerGroup}/${record.taskId}`);
    }
    assignments.set(key, record.split);
  }
}

function main() {
  const target = process.argv[2];
  if (!target) {
    usage();
    process.exitCode = 2;
    return;
  }
  const file = path.resolve(process.cwd(), target);
  const records = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(records)) throw new Error("Calibration dataset must be a JSON array");
  records.forEach(validateRecord);
  assertSplitIsolation(records);
  const report = {
    generatedAt: new Date().toISOString(),
    source: path.basename(file),
    calibration: summarize(records.filter((record) => record.split === "calibration")),
    holdout: summarize(records.filter((record) => record.split === "holdout"))
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

module.exports = { predictedClass, summarize, assertSplitIsolation };
