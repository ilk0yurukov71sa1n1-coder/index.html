import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCSV,
  parseJSON,
  parseTable,
  parseDate,
  parseNumber,
  guessMapping,
  guessStatus,
  distinctValues,
  toRuns,
  type Mapping,
} from "../lib/parse.ts";

test("CSV: quotes, escaped quotes, newlines in fields, CRLF, BOM", () => {
  const text = '﻿name,msg\r\n"Invoice, Sync","He said ""hi""\nthen left"\r\nB,\r\n';
  assert.deepEqual(parseCSV(text), [
    ["name", "msg"],
    ["Invoice, Sync", 'He said "hi"\nthen left'],
    ["B", ""],
  ]);
});

test("CSV: detects semicolon and tab delimiters", () => {
  assert.deepEqual(parseCSV("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCSV("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
});

test("CSV: blank lines are skipped, empty text gives no rows", () => {
  assert.deepEqual(parseCSV("a,b\n\n1,2\n\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCSV(""), []);
});

test("JSON: array, wrapped array, nested objects are flattened", () => {
  const t = parseJSON('{"data":[{"workflow":{"name":"A"},"status":"success","items":3},{"workflow":{"name":"B"},"status":"error"}]}');
  assert.deepEqual(t.headers, ["workflow.name", "status", "items"]);
  assert.deepEqual(t.rows, [["A", "success", "3"], ["B", "error", ""]]);
});

test("parseTable rejects empty and malformed files with a clear message", () => {
  assert.throws(() => parseTable("runs.csv", "   "), /empty/i);
  assert.throws(() => parseTable("runs.json", "{nope"), /not valid JSON/i);
  assert.throws(() => parseTable("runs.csv", "only,a,header\n"), /no data rows/i);
  assert.throws(() => parseTable("runs.json", '{"a":1}'), /list of runs/i);
});

test("dates: ISO, no-timezone (UTC), epoch seconds and ms, bad dates", () => {
  const t = Date.UTC(2026, 2, 5, 10, 30, 0);
  assert.equal(parseDate("2026-03-05T10:30:00Z"), t);
  assert.equal(parseDate("2026-03-05T12:30:00+02:00"), t);
  assert.equal(parseDate("2026-03-05 10:30:00"), t);
  assert.equal(parseDate(String(t / 1000)), t);
  assert.equal(parseDate(String(t)), t);
  assert.equal(parseDate("not a date"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate("2026-13-45"), null);
});

test("numbers: plain, thousands separators, decimal comma, blanks", () => {
  assert.equal(parseNumber("12"), 12);
  assert.equal(parseNumber("1,234.5"), 1234.5);
  assert.equal(parseNumber("1.234,5"), 1234.5);
  assert.equal(parseNumber("0,25"), 0.25);
  assert.equal(parseNumber("€3.10"), 3.1);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("abc"), null);
});

test("status guesses", () => {
  for (const s of ["success", "SUCCEEDED", "ok", "completed", "true", "200"]) assert.equal(guessStatus(s), "success", s);
  for (const s of ["error", "failed", "crashed", "false", "500", "warning"]) assert.equal(guessStatus(s), "failure", s);
  for (const s of ["running", "waiting", "queued", "new", ""]) assert.equal(guessStatus(s), "ignore", s);
});

test("guessMapping recognises n8n, Make and Zapier style headers", () => {
  const n8n = guessMapping(["id", "workflowName", "startedAt", "stoppedAt", "status", "itemsOut", "error"]);
  assert.equal(n8n.workflow, "workflowName");
  assert.equal(n8n.start, "startedAt");
  assert.equal(n8n.end, "stoppedAt");
  assert.equal(n8n.status, "status");
  assert.equal(n8n.output, "itemsOut");
  assert.equal(n8n.error, "error");
  const make = guessMapping(["Scenario", "Date", "Status", "Duration (ms)", "Operations", "Data transfer"]);
  assert.equal(make.workflow, "Scenario");
  assert.equal(make.start, "Date");
  assert.equal(make.duration, "Duration (ms)");
  assert.equal(make.durationUnit, "ms");
  assert.equal(make.output, "Data transfer");
  const zap = guessMapping(["Zap Name", "Start Time", "Zap Run Status", "Error Message", "Duration Seconds"]);
  assert.equal(zap.workflow, "Zap Name");
  assert.equal(zap.status, "Zap Run Status");
  assert.equal(zap.error, "Error Message");
  assert.equal(zap.durationUnit, "s");
});

test("distinctValues counts status values", () => {
  const table = { headers: ["s"], rows: [["ok"], ["ok"], ["err"]] };
  assert.deepEqual(distinctValues(table, "s"), [
    { value: "ok", count: 2 },
    { value: "err", count: 1 },
  ]);
});

const base: Mapping = {
  workflow: "wf",
  start: "start",
  status: "status",
  end: null,
  duration: "dur",
  cost: null,
  output: "items",
  error: "err",
  durationUnit: "s",
};

test("toRuns normalises rows and reports what was skipped", () => {
  const table = {
    headers: ["wf", "start", "status", "dur", "items", "err"],
    rows: [
      ["A", "2026-01-01T00:00:00Z", "success", "2.5", "3", ""],
      ["A", "2026-01-01T01:00:00Z", "error", "1", "", "Boom"],
      ["A", "garbage", "success", "1", "1", ""],
      ["", "2026-01-01T02:00:00Z", "success", "1", "1", ""],
      ["A", "2026-01-01T03:00:00Z", "running", "1", "1", ""],
      ["A", "2026-01-01T04:00:00Z", "success", "", "", ""],
    ],
  };
  const res = toRuns(table, base, { success: "success", error: "failure", running: "ignore" });
  assert.equal(res.runs.length, 3);
  assert.deepEqual(res.runs[0], { workflow: "A", start: Date.UTC(2026, 0, 1), ok: true, durationMs: 2500, cost: null, output: 3, error: null });
  assert.equal(res.runs[1]!.ok, false);
  assert.equal(res.runs[1]!.error, "Boom");
  assert.equal(res.runs[2]!.durationMs, null);
  assert.equal(res.runs[2]!.output, null);
  assert.deepEqual(res.skipped, { badDate: 1, missingWorkflow: 1, ignoredStatus: 1 });
});

test("toRuns computes duration from an end-time column", () => {
  const table = { headers: ["wf", "start", "end", "status"], rows: [["A", "2026-01-01T00:00:00Z", "2026-01-01T00:00:04Z", "ok"]] };
  const res = toRuns(table, { ...base, end: "end", duration: null, output: null, error: null }, { ok: "success" });
  assert.equal(res.runs[0]!.durationMs, 4000);
});

test("toRuns fails clearly when a required column is not mapped or missing", () => {
  const table = { headers: ["wf"], rows: [["A"]] };
  assert.throws(() => toRuns(table, { ...base, start: null }, {}), /start time/i);
  assert.throws(() => toRuns(table, base, {}), /"start" was not found/);
});
