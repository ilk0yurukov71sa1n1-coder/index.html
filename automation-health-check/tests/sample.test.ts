import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSample, toCSV } from "../lib/sample.ts";
import { guessMapping, parseTable, toRuns, distinctValues, guessStatus } from "../lib/parse.ts";
import { analyze } from "../lib/analyze.ts";
import { DEFAULT_SETTINGS } from "../lib/types.ts";

const END = Date.UTC(2026, 9, 14);

/** Run the sample through the exact same path the app uses: CSV text -> parse -> map -> analyze. */
function pipeline(days = 30) {
  const { table, expected } = generateSample({ days, end: END });
  const parsed = parseTable("sample.csv", toCSV(table));
  const mapping = guessMapping(parsed.headers);
  const statusMap = Object.fromEntries(distinctValues(parsed, mapping.status!).map((v) => [v.value, guessStatus(v.value)]));
  const { runs, skipped } = toRuns(parsed, mapping, statusMap);
  return { table, expected, runs, skipped, analysis: analyze(runs, DEFAULT_SETTINGS) };
}

test("sample is about 3,000 runs across 8 workflows, all importable", () => {
  const { runs, skipped, table } = pipeline();
  assert.ok(runs.length > 2700 && runs.length < 3300, `got ${runs.length} runs`);
  assert.equal(runs.length, table.rows.length);
  assert.deepEqual(skipped, { badDate: 0, missingWorkflow: 0, ignoredStatus: 0 });
  assert.equal(new Set(runs.map((r) => r.workflow)).size, 8);
});

test("sample is deterministic", () => {
  assert.deepEqual(generateSample({ end: END }).table, generateSample({ end: END }).table);
});

test("sample produces exactly the deliberate silent failures, and no others", () => {
  const { expected, analysis } = pipeline();
  const byName = new Map(analysis.workflows.map((w) => [w.workflow, w]));

  assert.ok((expected.emptyOutput["Invoice Sync"] ?? 0) >= 30);
  assert.equal(byName.get("Invoice Sync")!.emptyOutput, expected.emptyOutput["Invoice Sync"]);
  assert.equal(byName.get("Inventory Update")!.slow, expected.slow["Inventory Update"]);
  assert.equal(byName.get("Inventory Update")!.tooFast, expected.tooFast["Inventory Update"]);
  assert.equal(byName.get("CRM Contact Sync")!.missedRuns, 20);
  assert.equal(byName.get("Weekly KPI Report")!.limitedHistory, true);

  const flagged = new Set(["Invoice Sync", "Inventory Update", "CRM Contact Sync"]);
  for (const w of analysis.workflows) {
    if (!flagged.has(w.workflow)) assert.equal(w.silentTotal, 0, `${w.workflow} should have no silent failures`);
  }
  // Invoice Sync has only empty-output silent failures, CRM only missed runs
  assert.equal(byName.get("Invoice Sync")!.silentRuns, byName.get("Invoice Sync")!.emptyOutput);
  assert.equal(byName.get("CRM Contact Sync")!.silentRuns, 0);
  // event-driven workflows are not treated as scheduled
  assert.equal(byName.get("Lead Enrichment")!.scheduleIntervalMs, null);
  assert.equal(byName.get("Order Confirmation Emails")!.scheduleIntervalMs, null);
});

test("sample top problems name the planted issues in plain English", () => {
  const { analysis } = pipeline();
  const texts = analysis.problems.map((p) => p.text).join("\n");
  assert.match(texts, /Invoice Sync ran \d+ times, \d+ returned nothing but said "success"\./);
  assert.match(texts, /Support Ticket Triage failed/);
  assert.equal(analysis.trend.length, 30);
  assert.ok(analysis.totals.risk > 0 && analysis.totals.risk < 100);
});
