import type { Check, CheckLevel } from "./systemChecks.ts";
import type { CoreSettings } from "./settings.ts";
import type { HqEvent } from "./repo.ts";

/** What the screens receive. Never contains secrets. */
export interface CoreSnapshot {
  now: string;
  preview: boolean;
  settings: CoreSettings;
  checks: Check[];
  overall: CheckLevel;
  backups: { name: string; at: string; reason: string; sizeBytes: number }[];
  events: HqEvent[];
  version: string;
  commit: string | null;
  dataFolder: string;
  /** CSV files available in the export (one per collection, plus events). */
  exportFiles: string[];
}

export type CoreAction =
  | { type: "saveSettings"; settings: Partial<CoreSettings> }
  | { type: "backupNow" }
  | { type: "restore"; name: string; confirm: string };

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export interface CoreBackend {
  load(): Promise<CoreSnapshot>;
  act(a: CoreAction): Promise<{ snapshot: CoreSnapshot; result: ActionResult }>;
  /** URL for the full export, or null where export isn't available. */
  exportUrl(kind: "json" | string): string | null;
}

export const RESTORE_CONFIRM_WORD = "RESTORE";
