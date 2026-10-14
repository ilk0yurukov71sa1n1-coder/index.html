/** Preview backend: example data in memory, the real rules for checks and settings. Nothing is saved. */
import type { ActionResult, CoreAction, CoreBackend, CoreSnapshot } from "./api.ts";
import type { HqEvent } from "./repo.ts";
import { systemChecks, overall } from "./systemChecks.ts";
import { cleanCoreSettings, changedFields, DEFAULT_CORE_SETTINGS } from "./settings.ts";

export function createDemoBackend(): CoreBackend {
  const start = Date.now();
  let settings = { ...DEFAULT_CORE_SETTINGS };
  let eventId = 0;
  const events: HqEvent[] = [];
  const log = (type: string, summary: string, at = new Date()) => events.unshift({ id: ++eventId, at: at.toISOString(), type, summary, data: null });
  const backups = [
    { name: "demo-3", at: new Date(start - 26 * 3_600_000).toISOString(), reason: "daily", sizeBytes: 48_000 },
    { name: "demo-2", at: new Date(start - 2 * 3_600_000).toISOString(), reason: "start", sizeBytes: 52_000 },
  ];
  log("backup.created", "Daily backup made", new Date(start - 26 * 3_600_000));
  log("backup.created", "Backup made when HQ started", new Date(start - 2 * 3_600_000));
  backups.sort((a, b) => b.at.localeCompare(a.at));

  const snapshot = (): CoreSnapshot => {
    const now = new Date();
    const checks = systemChecks({
      store: { ok: true },
      lastBackupAgeHours: (now.getTime() - Date.parse(backups[0]!.at)) / 3_600_000,
      backupCount: backups.length,
      email: { configured: false },
      freeDiskBytes: 84 * 1024 ** 3,
      lastError: null,
      version: "0.1.0",
      commit: null,
      now,
    });
    return {
      now: now.toISOString(),
      preview: true,
      settings,
      checks,
      overall: overall(checks),
      backups: [...backups],
      events: [...events],
      version: "0.1.0",
      commit: null,
      dataFolder: "~/Documents/rollcfluence-hq/data (on your Mac)",
      exportFiles: ["settings.csv", "events.csv"],
    };
  };

  return {
    load: async () => snapshot(),
    exportUrl: () => null,
    async act(a: CoreAction) {
      let result: ActionResult;
      if (a.type === "saveSettings") {
        const { settings: next, problems } = cleanCoreSettings(a.settings, settings);
        if (problems.length) result = { ok: false, error: problems.join(" ") };
        else {
          const fields = changedFields(settings, next);
          settings = next;
          if (fields.length) log("settings.changed", `Changed settings: ${fields.join(", ")}`);
          result = { ok: true, message: fields.length ? "Settings saved (preview only)." : "Nothing changed." };
        }
      } else if (a.type === "backupNow") {
        backups.unshift({ name: `demo-${Date.now()}`, at: new Date().toISOString(), reason: "manual", sizeBytes: 52_000 });
        log("backup.created", "Backup made by hand");
        result = { ok: true, message: "Backup made (preview only)." };
      } else {
        result = { ok: false, error: "Restoring works in the HQ app on your Mac." };
      }
      return { snapshot: snapshot(), result };
    },
  };
}
