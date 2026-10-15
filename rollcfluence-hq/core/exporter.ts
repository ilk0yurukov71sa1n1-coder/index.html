import type { Repository } from "./repo.ts";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One CSV per collection: columns are the union of top-level fields. */
export function toCsv(rows: Record<string, unknown>[]): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  return [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

export interface FullExport {
  exportedAt: string;
  app: "rollcfluence-hq";
  schemaVersion: number;
  collections: Record<string, unknown[]>;
  events: unknown[];
}

/** Everything HQ knows, as JSON plus CSV files. Secrets are never stored in the database, so none are exported. */
export function exportAll(repo: Repository, now = new Date()): { json: FullExport; csv: Record<string, string> } {
  const collections: Record<string, unknown[]> = {};
  for (const c of repo.collections()) collections[c] = repo.list(c);
  const events = repo.events({ limit: 10_000 });
  const csv: Record<string, string> = {};
  for (const [c, rows] of Object.entries(collections)) csv[`${c}.csv`] = toCsv(rows as Record<string, unknown>[]);
  csv["events.csv"] = toCsv(events as unknown as Record<string, unknown>[]);
  return { json: { exportedAt: now.toISOString(), app: "rollcfluence-hq", schemaVersion: 1, collections, events }, csv };
}
