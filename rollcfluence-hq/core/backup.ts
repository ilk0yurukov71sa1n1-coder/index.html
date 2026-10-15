import { readdirSync, statSync, unlinkSync, copyFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { Repository } from "./repo.ts";
import { verifyDatabaseFile } from "./sqliteRepo.ts";

export const KEEP_BACKUPS = 14;
const NAME = /^hq-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d{3})?Z)-(start|daily|manual|pre-restore)\.sqlite$/;

export type BackupReason = "start" | "daily" | "manual" | "pre-restore";

export interface BackupInfo {
  file: string;
  name: string;
  at: string;
  reason: BackupReason;
  sizeBytes: number;
}

const stamp = (d: Date) => d.toISOString().replace(/[:.]/g, "-");
const unstamp = (s: string) => s.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z$/, (_m, a, b, c, ms) => `${a}:${b}:${c}${ms ? "." + ms : ""}Z`);

export function listBackups(dir: string): BackupInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((name) => {
      const m = NAME.exec(name);
      if (!m) return [];
      const file = join(dir, name);
      return [{ file, name, at: new Date(unstamp(m[1]!)).toISOString(), reason: m[2] as BackupReason, sizeBytes: statSync(file).size }];
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.name.localeCompare(a.name));
}

/** Makes a snapshot, then keeps only the newest KEEP_BACKUPS. */
export function createBackup(repo: Repository, dir: string, reason: BackupReason, now = new Date()): BackupInfo {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  let file = join(dir, `hq-${stamp(now)}-${reason}.sqlite`);
  for (let i = 1; existsSync(file); i++) file = join(dir, `hq-${stamp(new Date(now.getTime() + i))}-${reason}.sqlite`);
  const tmp = `${file}.partial`;
  repo.snapshotTo(tmp);
  const ok = verifyDatabaseFile(tmp);
  if (!ok.ok) {
    unlinkSync(tmp);
    throw new Error(`Backup failed its own check: ${ok.error}`);
  }
  renameSync(tmp, file);
  pruneBackups(dir, KEEP_BACKUPS);
  return listBackups(dir).find((b) => b.file === file)!;
}

export function pruneBackups(dir: string, keep: number): string[] {
  const removed: string[] = [];
  for (const b of listBackups(dir).slice(keep)) {
    unlinkSync(b.file);
    removed.push(b.name);
  }
  return removed;
}

export function lastBackupAgeHours(dir: string, now = new Date()): number | null {
  const last = listBackups(dir)[0];
  return last ? (now.getTime() - Date.parse(last.at)) / 3_600_000 : null;
}

/** Checks a backup can be restored, without changing anything. */
export function checkRestorable(backupFile: string, dir: string): void {
  if (!resolve(backupFile).startsWith(resolve(dir) + sep)) throw new Error("Backups can only be restored from the backups folder.");
  const ok = verifyDatabaseFile(backupFile);
  if (!ok.ok) throw new Error(ok.error);
}

/**
 * Replaces the live database file with a backup. Call it only after
 * (1) checkRestorable, (2) a "pre-restore" backup of the current data, (3) closing the live repository.
 */
export function restoreDatabaseFile(liveFile: string, backupFile: string, dir: string): void {
  checkRestorable(backupFile, dir);
  const tmp = `${liveFile}.restoring`;
  copyFileSync(backupFile, tmp);
  for (const extra of ["-journal", "-wal", "-shm"]) if (existsSync(liveFile + extra)) unlinkSync(liveFile + extra);
  renameSync(tmp, liveFile);
}

/**
 * The whole restore, in the only safe order:
 * 1. check the chosen backup, 2. copy it aside (so pruning can't remove it),
 * 3. back up the current data ("pre-restore", so the restore can be undone),
 * 4. close, swap the file, reopen. If anything fails after closing, the old file is reopened.
 */
export function restoreFromBackup(opts: { repo: Repository; liveFile: string; dir: string; backupName: string; open: (file: string) => Repository }): Repository {
  const chosen = join(opts.dir, opts.backupName);
  if (!NAME.test(opts.backupName) || !existsSync(chosen)) throw new Error("That backup no longer exists. Pick one from the list.");
  checkRestorable(chosen, opts.dir);
  const staged = join(opts.dir, ".staged-restore.sqlite");
  copyFileSync(chosen, staged);
  try {
    createBackup(opts.repo, opts.dir, "pre-restore");
    opts.repo.close();
    try {
      restoreDatabaseFile(opts.liveFile, staged, opts.dir);
    } catch (e) {
      opts.open(opts.liveFile).close(); // make sure the old file still opens
      throw e;
    }
    return opts.open(opts.liveFile);
  } finally {
    if (existsSync(staged)) unlinkSync(staged);
  }
}
