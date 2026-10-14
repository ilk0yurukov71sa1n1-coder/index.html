import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  median,
  percentile,
  riskScore,
  riskLevel,
} from "../lib/analyze.ts";
import type { Run, Settings } from "../lib/types.ts";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);
const settings: Settings = { costPerFailure: 10, minutesPerFailure: 30, currency: "€" };

function run(p: Partial<Run> & { start: number }): Run {
  return {
    workflow: "WF",
    ok: true,
    durationMs: 1000,
    cost: null,
    output: 5,
    error: null,
    ...p,
  };
}

/** n hourly runs of a healthy workflow */
function hourly(n: number, workflow = "WF", over: (i: number) => Partial<Run> = () => ({})): Run[] {
  return Array.from({ length: n }, (_, i) => run({ workflow, start: T0 + i * HOUR, ...over(i) }));
}

test("median and nearest-rank percentile", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(xs, 95), 95);
  assert.equal(percentile([5], 95), 5);
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
});

test("empty input gives an empty, valid analysis", () => {
  const a = analyze([], settings);
  assert.equal(a.totals.runs, 0);
  assert.equal(a.totals.successRate, 0);
  assert.equal(a.totals.risk, 0);
  assert.deepEqual(a.workflows, []);
  assert.deepEqual(a.trend, []);
  assert.deepEqual(a.problems, []);
});

test("success rate, failure counts, average and p95 duration", () => {
  // 20 runs, durations 1..20 s, runs 0..3 failed
  const runs = hourly(20, "WF", (i) => ({
    durationMs: (i + 1) * 1000,
    ok: i >= 4,
    error: i < 4 ? "Timeout" : null,
  }));
  const a = analyze(runs, settings);
  const wf = a.workflows[0]!;
  assert.equal(wf.runs, 20);
  assert.equal(wf.failed, 4);
  assert.equal(wf.ok, 16);
  assert.equal(wf.successRate, 0.8);
  assert.equal(wf.avgDurationMs, 10_500);
  assert.equal(wf.p95DurationMs, 19_000);
  assert.deepEqual(wf.topError, { message: "Timeout", count: 4 });
  assert.equal(a.totals.successRate, 0.8);
});

test("silent failure a: success with empty output when the workflow normally returns data", () => {
  const runs = hourly(30, "Invoice Sync", (i) => ({ output: i % 10 === 3 ? 0 : 12 }));
  const a = analyze(runs, settings);
  const wf = a.workflows[0]!;
  assert.equal(wf.emptyOutput, 3);
  assert.equal(wf.silentRuns, 3);
  const f = a.findings.filter((x) => x.kind === "empty-output");
  assert.equal(f.length, 3);
  assert.match(f[0]!.reason, /returned nothing/);
  assert.equal(a.problems[0]!.text, 'Invoice Sync ran 30 times, 3 returned nothing but said "success".');
});

test("empty output is NOT flagged when the workflow often returns nothing", () => {
  const runs = hourly(30, "WF", (i) => ({ output: i % 2 === 0 ? 0 : 4 }));
  assert.equal(analyze(runs, settings).workflows[0]!.emptyOutput, 0);
});

test("empty output is NOT flagged when output is unknown", () => {
  const runs = hourly(30, "WF", () => ({ output: null }));
  assert.equal(analyze(runs, settings).workflows[0]!.emptyOutput, 0);
});

test("failed runs with empty output count as failures, not silent failures", () => {
  const runs = hourly(30, "WF", (i) => (i === 5 ? { ok: false, output: 0 } : {}));
  const wf = analyze(runs, settings).workflows[0]!;
  assert.equal(wf.failed, 1);
  assert.equal(wf.emptyOutput, 0);
});

test("silent failure b: duration > 3x median or < 0.1x median", () => {
  const runs = hourly(30, "WF", (i) => ({
    durationMs: i === 7 ? 3_500 : i === 9 ? 50 : 1000 + (i % 3) * 10,
  }));
  const wf = analyze(runs, settings).workflows[0]!;
  assert.equal(wf.slow, 1);
  assert.equal(wf.tooFast, 1);
  assert.equal(wf.silentRuns, 2);
});

test("a run with empty output AND odd duration is counted once", () => {
  const runs = hourly(30, "WF", (i) => (i === 4 ? { output: 0, durationMs: 9000 } : {}));
  const wf = analyze(runs, settings).workflows[0]!;
  assert.equal(wf.silentRuns, 1);
  assert.equal(wf.emptyOutput, 1);
  assert.equal(wf.slow, 0);
});

test("silent failure c: missed scheduled runs", () => {
  // hourly, but hours 10..14 are missing (5 runs missed)
  const runs = hourly(40).filter((_, i) => i < 10 || i > 14);
  const wf = analyze(runs, settings).workflows[0]!;
  assert.equal(wf.scheduleIntervalMs, HOUR);
  assert.equal(wf.missedRuns, 5);
  assert.equal(wf.silentTotal, 5);
});

test("irregular (event-driven) workflows are not checked for missed runs", () => {
  let t = T0;
  const runs: Run[] = [];
  const gaps = [1, 9, 2, 30, 1, 7, 3, 1, 20, 2, 5, 1, 40, 2, 3, 1, 8, 2, 300, 1];
  for (const g of gaps) {
    t += g * 60_000;
    runs.push(run({ start: t }));
  }
  const wf = analyze(runs, settings).workflows[0]!;
  assert.equal(wf.scheduleIntervalMs, null);
  assert.equal(wf.missedRuns, 0);
});

test("workflows with fewer than 10 successful runs are not judged for silent failures", () => {
  const runs = hourly(6, "Weekly", (i) => ({ output: i === 2 ? 0 : 5 }));
  const wf = analyze(runs, settings).workflows[0]!;
  assert.equal(wf.limitedHistory, true);
  assert.equal(wf.silentRuns, 0);
});

test("wasted money and hours lost use (failed + silent) x settings", () => {
  const runs = hourly(30, "WF", (i) => ({
    ok: i !== 1 && i !== 2,
    output: i === 20 ? 0 : 5,
  }));
  const a = analyze(runs, settings);
  assert.equal(a.totals.failed, 2);
  assert.equal(a.totals.silentTotal, 1);
  assert.equal(a.totals.problemCount, 3);
  assert.equal(a.totals.wastedMoney, 30);
  assert.equal(a.totals.hoursLost, 1.5);
  assert.equal(a.totals.trueSuccessRate, 27 / 30);
});

test("recorded cost of problems sums the cost column on failed and silent runs", () => {
  const runs = hourly(30, "WF", (i) => ({ cost: 0.5, ok: i !== 3, output: i === 8 ? 0 : 2 }));
  assert.equal(analyze(runs, settings).totals.recordedCostOfProblems, 1);
  assert.equal(analyze(hourly(30), settings).totals.recordedCostOfProblems, null);
});

test("risk score formula and caps", () => {
  assert.deepEqual(riskScore(0, 0, 0), { score: 0, parts: { failures: 0, silent: 0, missed: 0 } });
  // 10% failures -> 20, 5% silent -> 15, 4% missed -> 6
  assert.equal(riskScore(0.1, 0.05, 0.04).score, 41);
  // everything capped
  assert.deepEqual(riskScore(1, 1, 1), { score: 100, parts: { failures: 50, silent: 35, missed: 15 } });
  assert.equal(riskLevel(10), "Low");
  assert.equal(riskLevel(20), "Elevated");
  assert.equal(riskLevel(50), "High");
});

test("daily trend covers the last 30 days ending on the last run day", () => {
  const runs = [
    ...hourly(48, "A", (i) => ({ ok: i % 4 !== 0 })), // 2 days, 25% failure
    run({ workflow: "A", start: T0 + 40 * 24 * HOUR }),
  ];
  const a = analyze(runs, settings);
  assert.equal(a.trend.length, 30);
  assert.equal(a.trend[29]!.day, "2026-02-10");
  assert.equal(a.trend[29]!.runs, 1);
  assert.equal(a.trend[0]!.day, "2026-01-12");
  assert.equal(a.trend[0]!.rate, null);
  // day 1-2 are outside the window
  assert.equal(a.trend.reduce((s, d) => s + d.runs, 0), 1);
});

test("trend rate per day", () => {
  const runs = hourly(48, "A", (i) => ({ ok: i % 4 !== 0 }));
  const a = analyze(runs, settings);
  const last = a.trend[29]!;
  assert.equal(last.day, "2026-01-02");
  assert.equal(last.runs, 24);
  assert.equal(last.failed, 6);
  assert.equal(last.rate, 0.25);
});

test("top 3 problems are ranked by affected runs, in plain English", () => {
  const runs = [
    ...hourly(50, "Invoice Sync", (i) => ({ output: i % 10 === 0 ? 0 : 3 })), // 5 empty
    ...hourly(50, "CRM Sync", (i) => ({ ok: i % 5 !== 0, error: i % 5 === 0 ? "HTTP 429" : null })), // 10 failed
    ...hourly(50, "Mailer", (i) => ({ ok: i !== 0, error: i === 0 ? "SMTP down" : null })), // 1 failed
    ...hourly(50, "Healthy"),
  ];
  const a = analyze(runs, settings);
  assert.equal(a.problems.length, 3);
  assert.equal(a.problems[0]!.workflow, "CRM Sync");
  assert.equal(a.problems[0]!.text, 'CRM Sync failed 10 of 50 runs (20%). Most common error: "HTTP 429" (10×).');
  assert.equal(a.problems[1]!.workflow, "Invoice Sync");
  assert.equal(a.problems[2]!.workflow, "Mailer");
  assert.ok(a.recommendations.length >= 1);
  assert.ok(a.recommendations.some((r) => r.includes("Invoice Sync")));
  assert.ok(!a.problems.some((p) => p.workflow === "Healthy"));
});

test("workflows are sorted by risk, highest first", () => {
  const runs = [...hourly(20, "Good"), ...hourly(20, "Bad", (i) => ({ ok: i % 2 === 0 }))];
  const a = analyze(runs, settings);
  assert.equal(a.workflows[0]!.workflow, "Bad");
  assert.equal(a.workflows[0]!.risk, 50);
  assert.equal(a.workflows[1]!.risk, 0);
});

test("input order does not change the result", () => {
  const runs = hourly(40, "WF", (i) => ({ output: i % 9 === 0 ? 0 : 1 })).filter((_, i) => i < 20 || i > 23);
  const a = analyze(runs, settings);
  const b = analyze([...runs].reverse(), settings);
  assert.deepEqual(a, b);
});
