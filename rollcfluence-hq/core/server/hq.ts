import "server-only";
import { execFileSync } from "node:child_process";
import { statfsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SqliteRepository } from "../sqliteRepo.ts";
import type { Repository } from "../repo.ts";
import { createBackup, lastBackupAgeHours, listBackups, restoreFromBackup } from "../backup.ts";
import { ErrorLog } from "../errorLog.ts";
import { systemChecks, overall } from "../systemChecks.ts";
import { cleanCoreSettings, changedFields, DEFAULT_CORE_SETTINGS, SETTING_LABEL, type CoreSettings } from "../settings.ts";
import { exportAll } from "../exporter.ts";
import { RESTORE_CONFIRM_WORD, type ActionResult, type CoreAction, type CoreSnapshot, type HqAction, type HqSnapshot } from "../api.ts";
import { loadOutreach, runOutreach } from "@/modules/outreach/server.ts";

const DATA_DIR = process.env.HQ_DATA_DIR || join(process.cwd(), "data");
const DB_FILE = join(DATA_DIR, "hq.sqlite");
const BACKUP_DIR = join(DATA_DIR, "backups");
const LOG_FILE = join(DATA_DIR, "logs", "errors.log");

interface HqState {
  repo: Repository;
  log: ErrorLog;
  timer: NodeJS.Timeout | null;
  version: string;
  commit: string | null;
}

const g = globalThis as unknown as { __hq?: HqState };

function readVersion(): string {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;
  } catch {
    return "unknown";
  }
}

function readCommit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).toString().trim() || null;
  } catch {
    return null;
  }
}

/** Opens HQ once per server process: data store, a start-up backup, and the daily backup timer. */
export function hq(): HqState {
  if (g.__hq) return g.__hq;
  const log = new ErrorLog(LOG_FILE);
  const repo = new SqliteRepository(DB_FILE);
  const state: HqState = { repo, log, timer: null, version: readVersion(), commit: readCommit() };
  g.__hq = state;
  try {
    createBackup(repo, BACKUP_DIR, "start");
    repo.appendEvent({ type: "backup.created", summary: "Backup made when HQ started" });
  } catch (e) {
    log.write("start-up backup", e);
  }
  // Every hour, make the daily backup if the newest one is a day old.
  state.timer = setInterval(() => {
    try {
      const age = lastBackupAgeHours(BACKUP_DIR);
      if (age === null || age >= 24) {
        createBackup(g.__hq!.repo, BACKUP_DIR, "daily");
        g.__hq!.repo.appendEvent({ type: "backup.created", summary: "Daily backup made" });
      }
    } catch (e) {
      log.write("daily backup", e);
    }
  }, 3_600_000);
  state.timer.unref();
  return state;
}

export function coreSettings(): CoreSettings {
  return { ...DEFAULT_CORE_SETTINGS, ...(hq().repo.get<Partial<CoreSettings>>("settings", "core") ?? {}) };
}

function freeDisk(): number | null {
  try {
    const s = statfsSync(DATA_DIR);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

export function snapshot(): CoreSnapshot {
  const s = hq();
  const backups = listBackups(BACKUP_DIR);
  const checks = systemChecks({
    store: s.repo.probe(),
    lastBackupAgeHours: lastBackupAgeHours(BACKUP_DIR),
    backupCount: backups.length,
    email: { configured: false },
    freeDiskBytes: freeDisk(),
    lastError: s.log.last(),
    version: s.version,
    commit: s.commit,
    now: new Date(),
  });
  return {
    now: new Date().toISOString(),
    preview: false,
    settings: coreSettings(),
    checks,
    overall: overall(checks),
    backups: backups.map(({ name, at, reason, sizeBytes }) => ({ name, at, reason, sizeBytes })),
    events: s.repo.events({ limit: 50 }),
    version: s.version,
    commit: s.commit,
    dataFolder: DATA_DIR,
    exportFiles: [...s.repo.collections().map((c) => `${c}.csv`), "events.csv"],
  };
}

export function runAction(a: CoreAction): ActionResult {
  const s = hq();
  try {
    switch (a.type) {
      case "saveSettings": {
        const old = coreSettings();
        const { settings, problems } = cleanCoreSettings(a.settings, old);
        if (problems.length) return { ok: false, error: problems.join(" ") };
        const fields = changedFields(old, settings);
        if (!fields.length) return { ok: true, message: "Nothing changed." };
        s.repo.transaction(() => {
          s.repo.put("settings", "core", settings);
          s.repo.appendEvent({ type: "settings.changed", summary: `Changed settings: ${fields.map((f) => SETTING_LABEL[f as keyof typeof SETTING_LABEL] ?? f).join(", ")}`, data: { fields } });
        });
        return { ok: true, message: "Settings saved." };
      }
      case "backupNow": {
        const b = createBackup(s.repo, BACKUP_DIR, "manual");
        s.repo.appendEvent({ type: "backup.created", summary: "Backup made by hand", data: { name: b.name } });
        return { ok: true, message: "Backup made." };
      }
      case "restore": {
        if (a.confirm !== RESTORE_CONFIRM_WORD) return { ok: false, error: `Type ${RESTORE_CONFIRM_WORD} to confirm.` };
        const chosen = listBackups(BACKUP_DIR).find((b) => b.name === a.name);
        s.repo = restoreFromBackup({ repo: s.repo, liveFile: DB_FILE, dir: BACKUP_DIR, backupName: a.name, open: (f) => new SqliteRepository(f) });
        const from = chosen ? new Date(chosen.at).toLocaleString("en-GB", { timeZone: "Europe/Sofia", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : a.name;
        s.repo.appendEvent({ type: "backup.restored", summary: `Restored the backup from ${from}. The data from just before is kept as a "pre-restore" backup.`, data: { name: a.name } });
        return { ok: true, message: "Restored. Your data from just before is kept as a \"pre-restore\" backup, so you can undo this." };
      }
    }
  } catch (e) {
    const entry = s.log.write(`action ${a.type}`, e);
    return { ok: false, error: entry.message.split("\n")[0]! };
  }
}

export function fullExport() {
  const s = hq();
  const out = exportAll(s.repo);
  s.repo.appendEvent({ type: "data.exported", summary: "Exported all data" });
  return out;
}

export function logError(where: string, e: unknown) {
  return hq().log.write(where, e);
}

/** Everything the screens need, in one read. */
export function hqSnapshot(): HqSnapshot {
  return { core: snapshot(), outreach: loadOutreach(hq().repo, coreSettings()) };
}

export function runHq(a: HqAction): ActionResult {
  if (a.module === "core") return runAction(a.action);
  try {
    const r = runOutreach(hq().repo, a.action, coreSettings());
    return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
  } catch (e) {
    const entry = hq().log.write(`outreach ${a.action.type}`, e);
    return { ok: false, error: `Something went wrong and nothing was changed (${entry.message.split("\n")[0]}).` };
  }
}
