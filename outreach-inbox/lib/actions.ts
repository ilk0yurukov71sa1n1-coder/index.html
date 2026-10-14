import type { Lead, Settings, Store, Template } from "./types.ts";
import { HARD_MAX_DAILY_CAP } from "./types.ts";
import { DEFAULT_TEMPLATES } from "./templates.ts";
import { importLeads } from "./csv.ts";
import { cancelFollowUp, deleteLead, markDmSent, sendEmail, setDoNotContact, upsertLead, type Mailer, type Result } from "./engine.ts";

export interface EmailStatus {
  configured: boolean;
  user: string | null;
  lastCheck: string | null;
  lastCheckError: string | null;
}

/** Everything the screens need. Never contains passwords. */
export interface Snapshot {
  store: Store;
  now: string;
  preview: boolean;
  email: EmailStatus;
}

export type Action =
  | { type: "saveLead"; lead: Partial<Lead> & { name: string } }
  | { type: "deleteLead"; id: string }
  | { type: "importCsv"; text: string }
  | { type: "sendEmail"; leadId: string; templateId: string }
  | { type: "markDmSent"; leadId: string; templateId: string }
  | { type: "setDoNotContact"; leadId: string; value: boolean }
  | { type: "cancelFollowUp"; leadId: string }
  | { type: "saveTemplate"; template: Template }
  | { type: "resetTemplates" }
  | { type: "saveSettings"; settings: Settings }
  | { type: "testConnection" }
  | { type: "checkReplies" }
  | { type: "demoReply"; leadId: string; optOut: boolean }
  | { type: "demoAdvance"; hours: number }
  | { type: "demoReset" };

export interface Backend {
  load(): Promise<Snapshot>;
  act(a: Action): Promise<{ snapshot: Snapshot; result: Result }>;
}

const clamp = (v: number, lo: number, hi: number, fallback: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);

export function cleanSettings(s: Settings, old: Settings): Settings {
  const startHour = clamp(s.startHour, 0, 23, old.startHour);
  return {
    dryRun: !!s.dryRun,
    ownAddress: s.ownAddress.trim().toLowerCase(),
    senderName: s.senderName.trim() || old.senderName,
    businessName: s.businessName.trim() || old.businessName,
    dailyCap: clamp(s.dailyCap, 1, HARD_MAX_DAILY_CAP, old.dailyCap),
    startHour,
    endHour: clamp(s.endHour, startHour + 1, 24, old.endHour),
    minGapMinutes: clamp(s.minGapMinutes, 3, 120, old.minGapMinutes),
    followUpDays: clamp(s.followUpDays, 1, 30, old.followUpDays),
    pollMinutes: clamp(s.pollMinutes, 1, 60, old.pollMinutes),
    targets: {
      painConfirmed: clamp(s.targets.painConfirmed, 1, 1000, old.targets.painConfirmed),
      wouldPay: clamp(s.targets.wouldPay, 1, 1000, old.targets.wouldPay),
      minSent: clamp(s.targets.minSent, 1, 10000, old.targets.minSent),
      days: clamp(s.targets.days, 1, 365, old.targets.days),
    },
  };
}

/** Applies a data action to the store. Connection checks and demo controls are handled by each backend. */
export async function applyAction(store: Store, a: Action, now: Date, mailer: Mailer, makeId: () => string): Promise<Result> {
  switch (a.type) {
    case "saveLead": {
      const lead = upsertLead(store, a.lead, now, makeId);
      return { ok: true, message: `Saved ${lead.name}.` };
    }
    case "deleteLead":
      deleteLead(store, a.id);
      return { ok: true, message: "Lead deleted." };
    case "importCsv": {
      const r = importLeads(a.text, store.leads, now, makeId);
      store.leads.push(...r.leads);
      const skipped = r.skipped.length ? ` Skipped ${r.skipped.length}: ${r.skipped.slice(0, 5).map((s) => `row ${s.row} (${s.reason})`).join(", ")}${r.skipped.length > 5 ? "…" : ""}.` : "";
      return r.leads.length || !r.skipped.length ? { ok: true, message: `Imported ${r.leads.length} leads.${skipped}` } : { ok: false, error: `Nothing imported.${skipped}` };
    }
    case "sendEmail":
      return sendEmail(store, a.leadId, a.templateId, now, mailer, makeId);
    case "markDmSent":
      return markDmSent(store, a.leadId, a.templateId, now, makeId);
    case "setDoNotContact":
      setDoNotContact(store, a.leadId, a.value);
      return { ok: true, message: a.value ? "Marked do not contact. They won't be emailed again." : "Removed from do not contact." };
    case "cancelFollowUp":
      cancelFollowUp(store, a.leadId);
      return { ok: true, message: "Follow-up cancelled." };
    case "saveTemplate": {
      const t = a.template;
      if (!t.name.trim() || !t.body.trim()) return { ok: false, error: "A template needs a name and a message." };
      store.templates = store.templates.some((x) => x.id === t.id) ? store.templates.map((x) => (x.id === t.id ? t : x)) : [...store.templates, t];
      return { ok: true, message: "Template saved." };
    }
    case "resetTemplates":
      store.templates = DEFAULT_TEMPLATES.map((t) => ({ ...t }));
      return { ok: true, message: "Templates reset to the 7 starter messages." };
    case "saveSettings":
      store.settings = cleanSettings(a.settings, store.settings);
      return { ok: true, message: "Settings saved." };
    default:
      return { ok: false, error: "This action is not available here." };
  }
}
