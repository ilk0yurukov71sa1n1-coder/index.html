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

export type { OutreachState } from "@/modules/outreach/lib/state.ts";
import type { OutreachAction, OutreachState } from "@/modules/outreach/lib/state.ts";

export type CoreAction =
  | { type: "saveSettings"; settings: Partial<CoreSettings> }
  | { type: "backupNow" }
  | { type: "restore"; name: string; confirm: string };

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Everything the app shows: core + each module. */
export interface HqSnapshot {
  core: CoreSnapshot;
  outreach: OutreachState;
}

export type HqAction = { module: "core"; action: CoreAction } | { module: "outreach"; action: OutreachAction };

export interface CoreBackend {
  load(): Promise<HqSnapshot>;
  act(a: HqAction): Promise<{ snapshot: HqSnapshot; result: ActionResult }>;
  /** URL for the full export, or null where export isn't available. */
  exportUrl(kind: "json" | string): string | null;
}

export const RESTORE_CONFIRM_WORD = "RESTORE";
