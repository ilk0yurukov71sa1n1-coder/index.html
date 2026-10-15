/** Pure rules for the System page: inputs in, green/amber/red checks with a plain-English fix out. */

export type CheckLevel = "green" | "amber" | "red" | "info";

export interface Check {
  id: string;
  label: string;
  level: CheckLevel;
  detail: string;
  /** What to do, in plain English. Present for amber and red. */
  fix?: string;
}

export interface SystemInputs {
  store: { ok: true } | { ok: false; error: string };
  lastBackupAgeHours: number | null;
  backupCount: number;
  email: { configured: false } | { configured: true; lastTest: { ok: boolean; at: string; message: string } | null };
  freeDiskBytes: number | null;
  lastError: { at: string; where: string; message: string } | null;
  version: string;
  commit: string | null;
  now: Date;
}

const GB = 1024 ** 3;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const fmtHours = (h: number) => (h < 1 ? plural(Math.max(1, Math.round(h * 60)), "minute") : h < 48 ? plural(Math.round(h), "hour") : plural(Math.round(h / 24), "day"));

export function systemChecks(i: SystemInputs): Check[] {
  const checks: Check[] = [];

  checks.push(
    i.store.ok
      ? { id: "store", label: "Data store", level: "green", detail: "Readable and writable. Integrity check passed." }
      : { id: "store", label: "Data store", level: "red", detail: i.store.error, fix: "Stop HQ, restore the newest backup from the Backups section, then start HQ again. Your backups are in data/backups." },
  );

  if (i.lastBackupAgeHours === null) {
    checks.push({ id: "backup", label: "Backups", level: "red", detail: "No backup exists yet.", fix: "Press \"Back up now\" below. HQ also backs up every time it starts." });
  } else if (i.lastBackupAgeHours <= 26) {
    checks.push({ id: "backup", label: "Backups", level: "green", detail: `Last backup ${fmtHours(i.lastBackupAgeHours)} ago. ${i.backupCount} kept (newest 14).` });
  } else if (i.lastBackupAgeHours <= 72) {
    checks.push({ id: "backup", label: "Backups", level: "amber", detail: `Last backup ${fmtHours(i.lastBackupAgeHours)} ago.`, fix: "Press \"Back up now\". HQ backs up daily while it is open, so open it more often." });
  } else {
    checks.push({ id: "backup", label: "Backups", level: "red", detail: `Last backup ${fmtHours(i.lastBackupAgeHours)} ago.`, fix: "Press \"Back up now\" right away. If it fails, check disk space." });
  }

  if (!i.email.configured) {
    checks.push({ id: "email", label: "Email connection", level: "info", detail: "Not set up yet. This comes with the Email module." });
  } else if (!i.email.lastTest) {
    checks.push({ id: "email", label: "Email connection", level: "amber", detail: "Set up but not tested yet.", fix: "Go to Settings and press \"Test connection\"." });
  } else if (i.email.lastTest.ok) {
    checks.push({ id: "email", label: "Email connection", level: "green", detail: i.email.lastTest.message });
  } else {
    checks.push({ id: "email", label: "Email connection", level: "red", detail: i.email.lastTest.message, fix: "Check the App Password in .env.local (see README), then press \"Test connection\" again." });
  }

  if (i.freeDiskBytes === null) {
    checks.push({ id: "disk", label: "Disk space", level: "info", detail: "Couldn't read free disk space on this system." });
  } else {
    const gb = i.freeDiskBytes / GB;
    const detail = `${gb.toFixed(1)} GB free.`;
    if (gb >= 5) checks.push({ id: "disk", label: "Disk space", level: "green", detail });
    else if (gb >= 1) checks.push({ id: "disk", label: "Disk space", level: "amber", detail, fix: "Free some space soon (empty the Trash, delete old downloads). Backups need room." });
    else checks.push({ id: "disk", label: "Disk space", level: "red", detail, fix: "Free at least 1 GB now. With a full disk, HQ can't save or back up." });
  }

  if (!i.lastError) {
    checks.push({ id: "errors", label: "Error log", level: "green", detail: "No errors recorded." });
  } else {
    const ageH = (i.now.getTime() - Date.parse(i.lastError.at)) / 3_600_000;
    const detail = `Last error ${fmtHours(ageH)} ago in ${i.lastError.where}: ${i.lastError.message.split("\n")[0]}`;
    checks.push(
      ageH <= 24
        ? { id: "errors", label: "Error log", level: "amber", detail, fix: "If something didn't work, try it once more. If it keeps happening, note what you clicked and check data/logs/errors.log." }
        : { id: "errors", label: "Error log", level: "green", detail: `No errors in the last 24 hours. (${detail})` },
    );
  }

  checks.push({ id: "version", label: "App version", level: "info", detail: `HQ ${i.version}${i.commit ? ` · commit ${i.commit}` : ""}` });
  return checks;
}

export function overall(checks: Check[]): CheckLevel {
  if (checks.some((c) => c.level === "red")) return "red";
  if (checks.some((c) => c.level === "amber")) return "amber";
  return "green";
}
