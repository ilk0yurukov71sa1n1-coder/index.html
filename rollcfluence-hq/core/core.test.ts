import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteRepository, verifyDatabaseFile } from "./sqliteRepo.ts";
import { createBackup, listBackups, pruneBackups, restoreDatabaseFile, checkRestorable, lastBackupAgeHours, KEEP_BACKUPS } from "./backup.ts";
import { ErrorLog, redact } from "./errorLog.ts";
import { systemChecks, overall, type SystemInputs } from "./systemChecks.ts";
import { exportAll, toCsv } from "./exporter.ts";
import { cleanCoreSettings, DEFAULT_CORE_SETTINGS, changedFields } from "./settings.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "hq-"));

test("repository: put, get, list, remove, collections", () => {
  const r = new SqliteRepository(":memory:");
  r.put("leads", "a", { id: "a", name: "Ana" });
  r.put("leads", "b", { id: "b", name: "Bo" });
  r.put("leads", "a", { id: "a", name: "Ana P." });
  assert.deepEqual(r.get("leads", "a"), { id: "a", name: "Ana P." });
  assert.equal(r.get("leads", "zzz"), null);
  assert.deepEqual(r.list<{ name: string }>("leads").map((x) => x.name), ["Ana P.", "Bo"]);
  assert.equal(r.remove("leads", "b"), true);
  assert.equal(r.remove("leads", "b"), false);
  assert.deepEqual(r.collections(), ["leads"]);
});

test("repository: transactions are all-or-nothing", () => {
  const r = new SqliteRepository(":memory:");
  assert.throws(() =>
    r.transaction(() => {
      r.put("leads", "x", { id: "x" });
      r.appendEvent({ type: "lead.added", summary: "x" });
      throw new Error("boom");
    }),
  );
  assert.equal(r.get("leads", "x"), null);
  assert.equal(r.events().length, 0);
  r.transaction(() => r.transaction(() => r.put("leads", "y", { id: "y" })));
  assert.deepEqual(r.get("leads", "y"), { id: "y" });
});

test("event log: append, newest first, filter by type and time", () => {
  const r = new SqliteRepository(":memory:");
  r.appendEvent({ type: "lead.added", summary: "Added Ana", at: "2026-10-01T10:00:00.000Z" });
  r.appendEvent({ type: "settings.changed", summary: "Changed currency", data: { fields: ["currency"] }, at: "2026-10-02T10:00:00.000Z" });
  r.appendEvent({ type: "lead.added", summary: "Added Bo", at: "2026-10-03T10:00:00.000Z" });
  assert.deepEqual(r.events().map((e) => e.summary), ["Added Bo", "Changed currency", "Added Ana"]);
  assert.equal(r.events({ type: "lead.added" }).length, 2);
  assert.equal(r.events({ since: "2026-10-02T00:00:00.000Z" }).length, 2);
  assert.deepEqual(r.events({ type: "settings.changed" })[0]!.data, { fields: ["currency"] });
  assert.equal(r.events({ limit: 1 }).length, 1);
});

test("probe reports a healthy store", () => {
  assert.deepEqual(new SqliteRepository(":memory:").probe(), { ok: true });
});

test("backup + restore round-trip: a deleted lead comes back", () => {
  const dir = tmp();
  const dbFile = join(dir, "hq.sqlite");
  const backups = join(dir, "backups");
  let r = new SqliteRepository(dbFile);
  r.put("leads", "ana", { id: "ana", name: "Ana" });
  const b = createBackup(r, backups, "manual");
  assert.ok(existsSync(b.file));
  assert.equal(verifyDatabaseFile(b.file).ok, true);
  r.remove("leads", "ana");
  assert.equal(r.get("leads", "ana"), null);
  // restore: safety copy first, then close, swap, reopen
  checkRestorable(b.file, backups);
  createBackup(r, backups, "pre-restore");
  r.close();
  restoreDatabaseFile(dbFile, b.file, backups);
  r = new SqliteRepository(dbFile);
  assert.deepEqual(r.get("leads", "ana"), { id: "ana", name: "Ana" });
  // and the pre-restore copy still holds the state without Ana, so the restore can be undone
  const pre = listBackups(backups).find((x) => x.reason === "pre-restore")!;
  const preRepo = new SqliteRepository(pre.file);
  assert.equal(preRepo.get("leads", "ana"), null);
  preRepo.close();
  r.close();
});

test("restore refuses damaged files and files outside the backups folder", () => {
  const dir = tmp();
  const backups = join(dir, "backups");
  const r = new SqliteRepository(join(dir, "hq.sqlite"));
  createBackup(r, backups, "manual");
  const junk = join(backups, "hq-2026-01-01T00-00-00Z-manual.sqlite");
  writeFileSync(junk, "not a database");
  assert.throws(() => checkRestorable(junk, backups), /damaged|Can't read|not an HQ backup/);
  const outside = join(dir, "elsewhere.sqlite");
  r.snapshotTo(outside);
  assert.throws(() => checkRestorable(outside, backups), /backups folder/);
  r.close();
});

test("backups keep only the newest 14", () => {
  const dir = tmp();
  const r = new SqliteRepository(":memory:");
  const base = Date.parse("2026-10-01T00:00:00Z");
  for (let i = 0; i < 20; i++) createBackup(r, dir, "daily", new Date(base + i * 3_600_000));
  const list = listBackups(dir);
  assert.equal(list.length, KEEP_BACKUPS);
  assert.equal(list[0]!.at, new Date(base + 19 * 3_600_000).toISOString());
  assert.equal(list.at(-1)!.at, new Date(base + 6 * 3_600_000).toISOString());
  assert.deepEqual(pruneBackups(dir, 14), []);
  assert.equal(Math.round(lastBackupAgeHours(dir, new Date(base + 21 * 3_600_000))!), 2);
});

test("redaction removes secrets from logs", () => {
  const out = redact('login failed for me@x.com password="hunter22" token: abc.def.ghi app pass abcd efgh ijkl mnop and MYSECRETVALUE', ["MYSECRETVALUE"]);
  assert.doesNotMatch(out, /hunter22|abc\.def\.ghi|abcd efgh ijkl mnop|MYSECRETVALUE/);
  assert.match(out, /me@x\.com/);
  assert.match(redact("Authorization: Bearer abcdefghijkl123"), /\[redacted\]/);
});

test("error log writes JSON lines, redacts, rotates", () => {
  const dir = tmp();
  const file = join(dir, "logs", "errors.log");
  process.env.TEST_MAIL_PASS = "supersecret-123";
  const log = new ErrorLog(file, { maxBytes: 300, keep: 2 });
  log.write("backup", new Error("failed with supersecret-123"));
  assert.doesNotMatch(readFileSync(file, "utf8"), /supersecret-123/);
  for (let i = 0; i < 10; i++) log.write("test", new Error(`error number ${i} with some padding text to fill the file`));
  assert.ok(existsSync(`${file}.1`));
  assert.ok(existsSync(`${file}.2`));
  assert.ok(!existsSync(`${file}.3`));
  assert.match(log.last()!.message, /error number 9/);
  delete process.env.TEST_MAIL_PASS;
});

const baseInputs = (): SystemInputs => ({
  store: { ok: true },
  lastBackupAgeHours: 2,
  backupCount: 3,
  email: { configured: false },
  freeDiskBytes: 50 * 1024 ** 3,
  lastError: null,
  version: "0.1.0",
  commit: "abc1234",
  now: new Date("2026-10-14T12:00:00Z"),
});

test("system checks: all green", () => {
  const c = systemChecks(baseInputs());
  assert.equal(overall(c), "green");
  assert.equal(c.find((x) => x.id === "email")!.level, "info");
});

test("system checks: amber and red each come with a fix", () => {
  const c = systemChecks({
    ...baseInputs(),
    store: { ok: false, error: "disk I/O error" },
    lastBackupAgeHours: 30,
    freeDiskBytes: 0.5 * 1024 ** 3,
    email: { configured: true, lastTest: { ok: false, at: "2026-10-14T11:00:00Z", message: "Login rejected" } },
    lastError: { at: "2026-10-14T11:00:00Z", where: "backup", message: "x" },
  });
  assert.equal(overall(c), "red");
  for (const x of c.filter((x) => x.level === "red" || x.level === "amber")) assert.ok(x.fix && x.fix.length > 10, x.id);
  assert.equal(c.find((x) => x.id === "backup")!.level, "amber");
  assert.equal(c.find((x) => x.id === "disk")!.level, "red");
  assert.equal(systemChecks({ ...baseInputs(), lastBackupAgeHours: null }).find((x) => x.id === "backup")!.level, "red");
  assert.equal(systemChecks({ ...baseInputs(), lastBackupAgeHours: 100 }).find((x) => x.id === "backup")!.level, "red");
  assert.equal(systemChecks({ ...baseInputs(), lastError: { at: "2026-10-10T00:00:00Z", where: "x", message: "old" } }).find((x) => x.id === "errors")!.level, "green");
});

test("export: JSON of every collection plus CSV files", () => {
  const r = new SqliteRepository(":memory:");
  r.put("leads", "a", { id: "a", name: 'Ana "A"', tags: ["x"] });
  r.appendEvent({ type: "lead.added", summary: "Added Ana" });
  const out = exportAll(r, new Date("2026-10-14T00:00:00Z"));
  assert.equal(out.json.collections.leads!.length, 1);
  assert.equal(out.json.events.length, 1);
  assert.match(out.csv["leads.csv"]!, /^id,name,tags\na,"Ana ""A""","\[""x""\]"\n$/);
  assert.ok(out.csv["events.csv"]);
  assert.equal(toCsv([]), "\n");
});

test("settings: cleaned, invalid email rejected, changed fields listed", () => {
  const { settings, problems } = cleanCoreSettings({ ownEmail: "not-an-email", currency: "¥", yourName: "  Ilko  " }, DEFAULT_CORE_SETTINGS);
  assert.equal(problems.length, 1);
  assert.equal(settings.ownEmail, "");
  assert.equal(settings.currency, "€");
  assert.equal(settings.yourName, "Ilko");
  const ok = cleanCoreSettings({ ownEmail: "ME@Example.com", currency: "$" }, DEFAULT_CORE_SETTINGS);
  assert.equal(ok.settings.ownEmail, "me@example.com");
  assert.deepEqual(changedFields(DEFAULT_CORE_SETTINGS, ok.settings), ["ownEmail", "currency"]);
});
