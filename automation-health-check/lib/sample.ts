import type { Table } from "./parse.ts";

/**
 * Realistic, deterministic sample data in an n8n-style export format.
 * Clearly fictional: workflow names are generic, no real customers.
 *
 * Deliberate problems (so the demo has something to find):
 *  - Invoice Sync: every 20th run says "success" but returns 0 items.
 *  - CRM Contact Sync: stops for 20 scheduled runs in a row (missed runs).
 *  - Inventory Update: every 20th run is 5–8x slower, every 60th ends almost instantly.
 *  - Support Ticket Triage: 1 in 7 runs fails with a parsing error.
 *  - Weekly KPI Report: too little history to judge.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const SAMPLE_HEADERS = ["id", "workflowName", "startedAt", "stoppedAt", "status", "itemsOut", "costEur", "error"];

export interface SampleExpectation {
  emptyOutput: Record<string, number>;
  slow: Record<string, number>;
  tooFast: Record<string, number>;
  missedRuns: Record<string, number>;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RawRun {
  workflow: string;
  start: number;
  durationMs: number;
  ok: boolean;
  items: number | null;
  error: string;
}

export interface SampleOptions {
  /** How many days of history (30 gives about 3,000 runs). */
  days?: number;
  /** End of the period, epoch ms. Defaults to the start of today (UTC). */
  end?: number;
  seed?: number;
}

export function generateSample(opts: SampleOptions = {}): { table: Table; expected: SampleExpectation } {
  const days = opts.days ?? 30;
  const end = opts.end ?? Math.floor(Date.now() / DAY) * DAY;
  const begin = end - days * DAY;
  const rng = mulberry32(opts.seed ?? 20261014);
  const jitter = () => Math.round((rng() - 0.5) * 4 * 60_000); // ±2 min
  const dur = (median: number) => Math.round(median * (0.7 + 0.6 * rng()));
  const runs: RawRun[] = [];
  const expected: SampleExpectation = { emptyOutput: {}, slow: {}, tooFast: {}, missedRuns: {} };
  const bump = (rec: Record<string, number>, wf: string, n = 1) => (rec[wf] = (rec[wf] ?? 0) + n);

  const scheduled = (everyMs: number, offsetMs: number, fn: (i: number, start: number) => void) => {
    for (let i = 0, t = begin + offsetMs; t < end; i++, t += everyMs) fn(i, t + jitter());
  };
  const events = (perDay: number, fn: (start: number) => void) => {
    let t = begin;
    for (;;) {
      t += (-Math.log(1 - rng()) / perDay) * DAY;
      if (t >= end) break;
      fn(Math.round(t));
    }
  };

  // 1. Invoice Sync — hourly, silent empty outputs
  scheduled(HOUR, 5 * 60_000, (i, start) => {
    const wf = "Invoice Sync";
    if (i % 50 === 17) {
      runs.push({ workflow: wf, start, durationMs: dur(4000), ok: false, items: null, error: "HTTP 429 Too Many Requests" });
    } else if (i % 20 === 13) {
      bump(expected.emptyOutput, wf);
      runs.push({ workflow: wf, start, durationMs: dur(4000), ok: true, items: 0, error: "" });
    } else {
      runs.push({ workflow: wf, start, durationMs: dur(4000), ok: true, items: 3 + Math.floor(rng() * 38), error: "" });
    }
  });

  // 2. CRM Contact Sync — every 90 min, then silently stops for 20 runs
  const crmSlots = Math.ceil((days * DAY) / (90 * 60_000));
  const gapFrom = Math.floor(crmSlots * 0.6);
  scheduled(90 * 60_000, 20 * 60_000, (i, start) => {
    const wf = "CRM Contact Sync";
    if (i >= gapFrom && i < gapFrom + 20) {
      if (i === gapFrom) bump(expected.missedRuns, wf, 20);
      return;
    }
    const ok = rng() >= 0.02;
    runs.push({ workflow: wf, start, durationMs: dur(6000), ok, items: ok ? 1 + Math.floor(rng() * 25) : null, error: ok ? "" : "Contact already exists (duplicate key)" });
  });

  // 3. Lead Enrichment — event-driven; often legitimately finds nothing
  events(18, (start) => {
    const ok = rng() >= 0.05;
    runs.push({ workflow: "Lead Enrichment", start, durationMs: dur(2500), ok, items: ok ? (rng() < 0.4 ? 0 : 1 + Math.floor(rng() * 5)) : null, error: ok ? "" : "Enrichment API timeout after 30s" });
  });

  // 4. Order Confirmation Emails — event-driven, healthy
  events(25, (start) => {
    const ok = rng() >= 0.01;
    runs.push({ workflow: "Order Confirmation Emails", start, durationMs: dur(1200), ok, items: ok ? 1 : null, error: ok ? "" : "SMTP 451 temporary failure" });
  });

  // 5. Inventory Update — every 3 h, abnormal durations
  scheduled(3 * HOUR, 45 * 60_000, (i, start) => {
    const wf = "Inventory Update";
    let durationMs = dur(45_000);
    if (i % 20 === 5) {
      bump(expected.slow, wf);
      durationMs = Math.round(45_000 * (5 + 3 * rng()));
    } else if (i % 60 === 31) {
      bump(expected.tooFast, wf);
      durationMs = Math.round(45_000 * 0.03);
    }
    runs.push({ workflow: wf, start, durationMs, ok: true, items: 10 + Math.floor(rng() * 200), error: "" });
  });

  // 6. Support Ticket Triage — every 4 h, frequent hard failures
  scheduled(4 * HOUR, 10 * 60_000, (i, start) => {
    const ok = i % 7 !== 3;
    runs.push({ workflow: "Support Ticket Triage", start, durationMs: dur(8000), ok, items: ok ? 1 + Math.floor(rng() * 12) : null, error: ok ? "" : "LLM response could not be parsed as JSON" });
  });

  // 7. Daily Team Digest — daily 08:00, healthy
  scheduled(DAY, 8 * HOUR, (_i, start) => {
    runs.push({ workflow: "Daily Team Digest", start, durationMs: dur(3000), ok: true, items: 1, error: "" });
  });

  // 8. Weekly KPI Report — weekly, too little history in 30 days
  scheduled(7 * DAY, 7 * HOUR, (_i, start) => {
    runs.push({ workflow: "Weekly KPI Report", start, durationMs: dur(20_000), ok: true, items: 1, error: "" });
  });

  runs.sort((a, b) => a.start - b.start);
  const rows = runs.map((r, i) => [
    String(100_000 + i),
    r.workflow,
    new Date(r.start).toISOString(),
    new Date(r.start + r.durationMs).toISOString(),
    r.ok ? "success" : "error",
    r.items === null ? "" : String(r.items),
    (0.001 + r.durationMs / 2_000_000).toFixed(4),
    r.error,
  ]);
  return { table: { headers: [...SAMPLE_HEADERS], rows }, expected };
}

/** CSV text for a table (quotes fields when needed). */
export function toCSV(table: Table): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [table.headers, ...table.rows].map((r) => r.map(esc).join(",")).join("\n") + "\n";
}
