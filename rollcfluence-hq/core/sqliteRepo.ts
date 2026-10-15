import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { HqEvent, NewEvent, Repository } from "./repo.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (collection, id)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_at ON events(at);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export const SCHEMA_VERSION = 1;

type Row = Record<string, unknown>;

/** SQLite-backed repository. Every write is a transaction; the file is fsynced (synchronous=FULL). */
export class SqliteRepository implements Repository {
  readonly file: string;
  private db: DatabaseSync;
  private depth = 0;

  constructor(file: string) {
    this.file = file;
    if (file !== ":memory:" && !existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    // secure_delete: deleted or replaced data is overwritten with zeros instead of lingering in free space.
    this.db.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;");
    this.db.exec(SCHEMA);
    this.db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  }

  get<T>(collection: string, id: string): T | null {
    const row = this.db.prepare("SELECT data FROM records WHERE collection = ? AND id = ?").get(collection, id) as Row | undefined;
    return row ? (JSON.parse(String(row.data)) as T) : null;
  }

  list<T>(collection: string): T[] {
    const rows = this.db.prepare("SELECT data FROM records WHERE collection = ? ORDER BY created_at, id").all(collection) as Row[];
    return rows.map((r) => JSON.parse(String(r.data)) as T);
  }

  put<T>(collection: string, id: string, value: T): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO records(collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(collection, id, JSON.stringify(value), now, now);
  }

  remove(collection: string, id: string): boolean {
    return Number(this.db.prepare("DELETE FROM records WHERE collection = ? AND id = ?").run(collection, id).changes) > 0;
  }

  collections(): string[] {
    return (this.db.prepare("SELECT DISTINCT collection FROM records ORDER BY collection").all() as Row[]).map((r) => String(r.collection));
  }

  transaction<R>(fn: () => R): R {
    // Nested calls join the outer transaction.
    if (this.depth > 0) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.depth++;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this.depth--;
    }
  }

  appendEvent(e: NewEvent): HqEvent {
    const at = e.at ?? new Date().toISOString();
    const data = e.data ? JSON.stringify(e.data) : null;
    const r = this.db.prepare("INSERT INTO events(at, type, summary, data) VALUES (?, ?, ?, ?)").run(at, e.type, e.summary, data);
    return { id: Number(r.lastInsertRowid), at, type: e.type, summary: e.summary, data: e.data ?? null };
  }

  events(opts: { limit?: number; type?: string; since?: string } = {}): HqEvent[] {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (opts.type) {
      where.push("type = ?");
      args.push(opts.type);
    }
    if (opts.since) {
      where.push("at >= ?");
      args.push(opts.since);
    }
    const sql = `SELECT id, at, type, summary, data FROM events ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`;
    args.push(Math.max(1, Math.min(10_000, opts.limit ?? 200)));
    return (this.db.prepare(sql).all(...args) as Row[]).map((r) => ({
      id: Number(r.id),
      at: String(r.at),
      type: String(r.type),
      summary: String(r.summary),
      data: r.data ? (JSON.parse(String(r.data)) as Record<string, unknown>) : null,
    }));
  }

  redactEvents(name: string, id: string, replacement: string): number {
    let changed = 0;
    if (name.trim().length >= 2) {
      changed += Number(this.db.prepare("UPDATE events SET summary = replace(summary, ?, ?) WHERE instr(summary, ?) > 0").run(name, replacement, name).changes);
    }
    if (id) {
      changed += Number(this.db.prepare("UPDATE events SET data = NULL WHERE instr(data, ?) > 0").run(JSON.stringify(id)).changes);
    }
    return changed;
  }

  compact(): void {
    // Rebuilds the file from live data only, so nothing deleted can be recovered from it.
    this.db.exec("VACUUM");
  }

  probe(): { ok: true } | { ok: false; error: string } {
    try {
      const token = `probe-${Date.now()}`;
      this.transaction(() => {
        this.db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('probe', ?)").run(token);
      });
      const back = this.db.prepare("SELECT value FROM meta WHERE key = 'probe'").get() as Row | undefined;
      if (back?.value !== token) return { ok: false, error: "Wrote a test value but read back something else." };
      const check = this.db.prepare("PRAGMA quick_check").get() as Row | undefined;
      const result = check ? String(Object.values(check)[0]) : "";
      if (result !== "ok") return { ok: false, error: `Database check failed: ${result}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  snapshotTo(file: string): void {
    if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
    // VACUUM INTO writes a consistent, compacted copy without stopping the app.
    this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }
}

/** Opens a file read-only and checks it is a healthy HQ database. */
export function verifyDatabaseFile(file: string): { ok: true } | { ok: false; error: string } {
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const check = db.prepare("PRAGMA integrity_check").get() as Row | undefined;
    if (!check || String(Object.values(check)[0]) !== "ok") return { ok: false, error: "The backup file is damaged." };
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Row[]).map((r) => String(r.name));
    if (!tables.includes("records") || !tables.includes("events")) return { ok: false, error: "This file is not an HQ backup." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Can't read this backup (${e instanceof Error ? e.message : String(e)}).` };
  } finally {
    db?.close();
  }
}
