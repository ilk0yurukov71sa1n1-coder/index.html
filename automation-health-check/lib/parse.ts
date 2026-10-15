import type { Run } from "./types.ts";

/** A parsed file: header names and string cells. */
export interface Table {
  headers: string[];
  rows: string[][];
}

export type StatusClass = "success" | "failure" | "ignore";

export interface Mapping {
  workflow: string | null;
  start: string | null;
  status: string | null;
  end: string | null;
  duration: string | null;
  cost: string | null;
  output: string | null;
  error: string | null;
  durationUnit: "ms" | "s" | "min";
}

export type MappingField = Exclude<keyof Mapping, "durationUnit">;

export const FIELD_LABELS: Record<MappingField, { label: string; required: boolean; hint: string }> = {
  workflow: { label: "Workflow name", required: true, hint: "Which automation ran" },
  start: { label: "Start time", required: true, hint: "When the run started" },
  status: { label: "Status", required: true, hint: "success / error / …" },
  duration: { label: "Duration", required: false, hint: "How long it took" },
  end: { label: "End time", required: false, hint: "Used for duration if there is no duration column" },
  output: { label: "Output size / items", required: false, hint: "Needed to catch empty 'success' runs" },
  cost: { label: "Cost", required: false, hint: "Platform cost per run" },
  error: { label: "Error message", required: false, hint: "Why it failed" },
};

export class ImportError extends Error {}

// ---------------- CSV ----------------

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t", "|"]) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 CSV parser: quoted fields, "" escapes, newlines inside quotes, CRLF, BOM. */
export function parseCSV(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const endRow = () => {
    row.push(field);
    field = "";
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  while (i < len) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      // copy a run of ordinary characters at once (much faster for big files)
      const next = text.indexOf('"', i);
      const stop = next === -1 ? len : next;
      field += text.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' && field === "") {
      inQuotes = true;
      i++;
    } else if (c === delim) {
      row.push(field);
      field = "";
      i++;
    } else if (c === "\n" || c === "\r") {
      endRow();
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

// ---------------- JSON ----------------

function flatten(obj: unknown, prefix: string, out: Record<string, string>, depth: number): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "object" && !Array.isArray(obj) && depth < 3) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    }
    return;
  }
  out[prefix] = typeof obj === "object" ? JSON.stringify(obj) : String(obj);
}

export function parseJSON(text: string): Table {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("This file is not valid JSON.");
  }
  let list: unknown = data;
  if (!Array.isArray(list) && list && typeof list === "object") {
    const o = list as Record<string, unknown>;
    const key = ["data", "runs", "executions", "results", "items", "records"].find((k) => Array.isArray(o[k]));
    list = key ? o[key] : undefined;
  }
  if (!Array.isArray(list)) {
    throw new ImportError("Expected a list of runs (a JSON array, or an object with a \"data\" / \"runs\" / \"executions\" array).");
  }
  const flat = list.map((item) => {
    const out: Record<string, string> = {};
    flatten(item, "", out, 0);
    return out;
  });
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of flat.slice(0, 1000)) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  return { headers, rows: flat.map((r) => headers.map((h) => r[h] ?? "")) };
}

export function parseTable(fileName: string, text: string): Table {
  if (text.trim() === "") throw new ImportError("The file is empty.");
  const trimmed = text.trimStart().replace(/^﻿/, "");
  const looksJson = /\.json$/i.test(fileName) || trimmed.startsWith("[") || trimmed.startsWith("{");
  let table: Table;
  if (looksJson) {
    table = parseJSON(trimmed);
  } else {
    const rows = parseCSV(text);
    const headers = (rows[0] ?? []).map((h, i) => h.trim() || `Column ${i + 1}`);
    table = { headers, rows: rows.slice(1) };
  }
  if (table.rows.length === 0) throw new ImportError("The file has a header but no data rows.");
  return table;
}

// ---------------- values ----------------

/** Parses ISO dates, "YYYY-MM-DD HH:mm:ss" (treated as UTC) and epoch seconds/milliseconds. */
export function parseDate(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  if (/^\d{9,13}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n >= 1e12 ? Math.round(n) : Math.round(n * 1000);
  }
  let iso = s;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?)(.*)$/.exec(s);
  if (m) {
    const time = /^\d:/.test(m[2]!) ? `0${m[2]}` : m[2]!;
    const tz = m[5]!.trim();
    iso = `${m[1]}T${time}${tz === "" || /^utc$/i.test(tz) ? "Z" : tz}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    iso = `${s}T00:00:00Z`;
  }
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/[^\d.,\-eE]/g, "");
  if (s === "" || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // "1,234" (thousands) vs "0,25" (decimal comma)
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const SUCCESS = new Set(["success", "succeeded", "successful", "ok", "completed", "complete", "done", "true", "passed", "pass", "finished", "200", "201", "204"]);
const IGNORE = new Set(["", "running", "waiting", "queued", "new", "pending", "scheduled", "in progress", "in_progress", "started", "canceled", "cancelled", "skipped"]);

export function guessStatus(value: string): StatusClass {
  const v = value.trim().toLowerCase();
  if (SUCCESS.has(v)) return "success";
  if (IGNORE.has(v)) return "ignore";
  return "failure";
}

export function distinctValues(table: Table, column: string, limit = 50): { value: string; count: number }[] {
  const idx = table.headers.indexOf(column);
  if (idx === -1) return [];
  const counts = new Map<string, number>();
  for (const row of table.rows) {
    const v = (row[idx] ?? "").trim();
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

// ---------------- mapping ----------------

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Candidate header names per field, best first (compared without case/punctuation). */
const CANDIDATES: Record<MappingField, string[]> = {
  workflow: ["workflowname", "workflow", "scenarioname", "scenario", "zapname", "zap", "automation", "flowname", "flow", "jobname", "job", "name"],
  start: ["startedat", "starttime", "start", "started", "startdate", "createdat", "created", "timestamp", "date", "time", "datetime", "executedat"],
  status: ["status", "zaprunstatus", "runstatus", "state", "result", "outcome", "finished", "success"],
  end: ["stoppedat", "finishedat", "endedat", "endtime", "end", "completedat"],
  duration: ["durationms", "duration", "durationseconds", "durations", "executiontime", "runtime", "elapsed", "elapsedms", "took"],
  cost: ["cost", "costeur", "costusd", "price", "spend"],
  output: ["itemsout", "outputitems", "items", "itemcount", "records", "recordcount", "rows", "outputsize", "output", "datatransfer", "bytes", "size", "results"],
  error: ["error", "errormessage", "errormsg", "message", "failurereason", "reason", "details"],
};

export function guessMapping(headers: readonly string[]): Mapping {
  const used = new Set<string>();
  const pick = (field: MappingField): string | null => {
    const normed = headers.map(norm);
    for (const c of CANDIDATES[field]) {
      const i = normed.indexOf(c);
      if (i !== -1 && !used.has(headers[i]!)) {
        used.add(headers[i]!);
        return headers[i]!;
      }
    }
    for (const c of CANDIDATES[field]) {
      if (c.length < 4) continue;
      const i = normed.findIndex((h, j) => h.includes(c) && !used.has(headers[j]!));
      if (i !== -1) {
        used.add(headers[i]!);
        return headers[i]!;
      }
    }
    return null;
  };
  // order matters: specific fields first so generic words ("name", "date") are not stolen
  const workflow = pick("workflow");
  const status = pick("status");
  const end = pick("end");
  const start = pick("start");
  const duration = pick("duration");
  const output = pick("output");
  const error = pick("error");
  const cost = pick("cost");
  const d = duration ? norm(duration) : "";
  const durationUnit: Mapping["durationUnit"] = /ms|milli/.test(d) ? "ms" : /min/.test(d) ? "min" : d === "" ? "ms" : /sec|s$/.test(d) ? "s" : "ms";
  return { workflow, start, status, end, duration, cost, output, error, durationUnit };
}

export const REQUIRED_FIELDS: MappingField[] = ["workflow", "start", "status"];

export interface ImportReport {
  totalRows: number;
  skipped: { badDate: number; missingWorkflow: number; ignoredStatus: number };
}

export function toRuns(
  table: Table,
  mapping: Mapping,
  statusMap: Record<string, StatusClass>,
): { runs: Run[] } & ImportReport {
  for (const f of REQUIRED_FIELDS) {
    if (!mapping[f]) throw new ImportError(`Please choose the column for "${FIELD_LABELS[f].label.toLowerCase()}".`);
  }
  const col = (f: MappingField): number => {
    const name = mapping[f];
    if (!name) return -1;
    const i = table.headers.indexOf(name);
    if (i === -1) throw new ImportError(`Column "${name}" was not found in this file.`);
    return i;
  };
  const iWf = col("workflow");
  const iStart = col("start");
  const iStatus = col("status");
  const iEnd = col("end");
  const iDur = col("duration");
  const iCost = col("cost");
  const iOut = col("output");
  const iErr = col("error");
  const unit = mapping.durationUnit === "ms" ? 1 : mapping.durationUnit === "s" ? 1000 : 60_000;

  const runs: Run[] = [];
  const skipped = { badDate: 0, missingWorkflow: 0, ignoredStatus: 0 };
  for (const row of table.rows) {
    const workflow = (row[iWf] ?? "").trim();
    if (!workflow) {
      skipped.missingWorkflow++;
      continue;
    }
    const start = parseDate(row[iStart] ?? "");
    if (start === null) {
      skipped.badDate++;
      continue;
    }
    const rawStatus = (row[iStatus] ?? "").trim();
    const cls = statusMap[rawStatus] ?? guessStatus(rawStatus);
    if (cls === "ignore") {
      skipped.ignoredStatus++;
      continue;
    }
    let durationMs: number | null = null;
    if (iDur !== -1) {
      const d = parseNumber(row[iDur] ?? "");
      durationMs = d === null || d < 0 ? null : d * unit;
    }
    if (durationMs === null && iEnd !== -1) {
      const end = parseDate(row[iEnd] ?? "");
      durationMs = end !== null && end >= start ? end - start : null;
    }
    const error = iErr === -1 ? "" : (row[iErr] ?? "").trim();
    runs.push({
      workflow,
      start,
      ok: cls === "success",
      durationMs,
      cost: iCost === -1 ? null : parseNumber(row[iCost] ?? ""),
      output: iOut === -1 ? null : parseNumber(row[iOut] ?? ""),
      error: error === "" ? null : error.slice(0, 200),
    });
  }
  return { runs, totalRows: table.rows.length, skipped };
}
