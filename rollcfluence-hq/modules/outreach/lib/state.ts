/**
 * Outreach module: state and actions as pure functions (no storage, no clock, no randomness inside).
 * The server loads state from the repository, applies an action, and saves only what changed.
 */
import type { Lead, Platform, SentMessage, Settings, Template } from "./types.ts";
import { DEFAULT_SETTINGS } from "./types.ts";
import { DEFAULT_TEMPLATES, render } from "./templates.ts";
import { markMessaged, newLead, nextAction } from "./leads.ts";
import { canSendFollowUp, computeStats, normalizeEmail, verdict } from "./rules.ts";
import { importLeads } from "./csv.ts";
import { applyInterview, interviewProblems, type InterviewInput } from "./interview.ts";
import { daysBetween } from "./time.ts";

export interface OutreachState {
  leads: Lead[];
  templates: Template[];
  sent: SentMessage[];
  suppressed: string[];
  settings: Settings;
}

export const emptyOutreach = (): OutreachState => ({
  leads: [],
  templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })),
  sent: [],
  suppressed: [],
  settings: { ...DEFAULT_SETTINGS, targets: { ...DEFAULT_SETTINGS.targets } },
});

export type OutreachAction =
  | { type: "saveLead"; lead: Partial<Lead> & { name: string } }
  | { type: "deleteLead"; id: string }
  | { type: "restoreLead"; id: string }
  | { type: "importCsv"; text: string }
  | { type: "markSent"; leadId: string; templateId: string }
  | { type: "setDoNotContact"; leadId: string; value: boolean }
  | { type: "cancelFollowUp"; leadId: string }
  | { type: "saveTemplate"; template: Template }
  | { type: "resetTemplates" }
  | { type: "saveInterview"; leadId: string; interview: InterviewInput }
  | { type: "saveTargets"; targets: Settings["targets"]; followUpDays: number };

export interface OutreachResult {
  ok: boolean;
  message: string;
  /** Activity-log entries to record with the change. */
  events: { type: string; summary: string; data?: Record<string, unknown> }[];
}

const fail = (message: string): OutreachResult => ({ ok: false, message, events: [] });

export const activeLeads = (s: OutreachState) => s.leads.filter((l) => !l.deletedAt);
export const deletedLeads = (s: OutreachState) => s.leads.filter((l) => !!l.deletedAt);

function findLead(s: OutreachState, id: string): Lead | null {
  return s.leads.find((l) => l.id === id) ?? null;
}

function replace(s: OutreachState, lead: Lead) {
  s.leads = s.leads.map((l) => (l.id === lead.id ? lead : l));
}

const clampInt = (v: number, lo: number, hi: number, fallback: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);

/** Applies one action to `s` (mutates it) and says what happened. `signature` comes from core settings. */
export function applyOutreach(s: OutreachState, a: OutreachAction, now: Date, makeId: () => string): OutreachResult {
  switch (a.type) {
    case "saveLead": {
      const name = a.lead.name.trim();
      if (!name) return fail("A lead needs a name.");
      const email = a.lead.email?.trim().toLowerCase() || null;
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(`"${email}" is not a valid email address.`);
      if (email && activeLeads(s).some((l) => l.email === email && l.id !== a.lead.id)) return fail(`Another lead already has ${email}.`);
      if (a.lead.id) {
        const old = findLead(s, a.lead.id);
        if (!old) return fail("That lead no longer exists.");
        replace(s, { ...old, ...a.lead, name, email, id: old.id, createdAt: old.createdAt });
        return { ok: true, message: `Saved ${name}.`, events: [{ type: "lead.updated", summary: `Updated ${name}`, data: { id: old.id } }] };
      }
      const lead = newLead({ ...a.lead, name, email }, now, makeId());
      s.leads.push(lead);
      return { ok: true, message: `Added ${name}.`, events: [{ type: "lead.added", summary: `Added lead ${name}`, data: { id: lead.id } }] };
    }
    case "deleteLead": {
      const lead = findLead(s, a.id);
      if (!lead || lead.deletedAt) return fail("That lead no longer exists.");
      replace(s, { ...lead, deletedAt: now.toISOString() });
      return { ok: true, message: `Deleted ${lead.name}. You can bring them back from "Recently deleted".`, events: [{ type: "lead.deleted", summary: `Deleted lead ${lead.name}`, data: { id: lead.id } }] };
    }
    case "restoreLead": {
      const lead = findLead(s, a.id);
      if (!lead || !lead.deletedAt) return fail("That lead isn't in Recently deleted.");
      replace(s, { ...lead, deletedAt: null });
      return { ok: true, message: `${lead.name} is back.`, events: [{ type: "lead.restored", summary: `Restored lead ${lead.name}`, data: { id: lead.id } }] };
    }
    case "importCsv": {
      const r = importLeads(a.text, activeLeads(s), now, makeId);
      s.leads.push(...r.leads);
      const skipped = r.skipped.length
        ? ` Skipped ${r.skipped.length}: ${r.skipped.slice(0, 5).map((k) => `row ${k.row} (${k.reason})`).join(", ")}${r.skipped.length > 5 ? "…" : ""}.`
        : "";
      if (!r.leads.length && r.skipped.length) return fail(`Nothing imported.${skipped}`);
      return { ok: true, message: `Imported ${r.leads.length} leads.${skipped}`, events: [{ type: "leads.imported", summary: `Imported ${r.leads.length} leads from CSV`, data: { count: r.leads.length } }] };
    }
    case "markSent": {
      const lead = findLead(s, a.leadId);
      const t = s.templates.find((x) => x.id === a.templateId);
      if (!lead || lead.deletedAt) return fail("That lead no longer exists.");
      if (!t) return fail("Template not found.");
      if (lead.doNotContact || (lead.email && s.suppressed.includes(normalizeEmail(lead.email)))) return fail(`${lead.name} asked not to be contacted.`);
      const r = render(t, lead, s.settings, { email: false });
      if (r.problems.length) return fail(r.problems.join(" "));
      const kind = t.purpose === "followup" ? "followup" : t.purpose === "first" && !lead.dateMessaged ? "first" : "other";
      if (kind === "followup") {
        const f = canSendFollowUp(lead);
        if (!f.ok) return fail(f.reason);
      }
      const channel: Platform = lead.platform;
      s.sent.push({ id: makeId(), leadId: lead.id, channel, kind, templateId: t.id, to: lead.email ?? lead.handle ?? "", subject: "", body: r.body, messageId: null, sentAt: now.toISOString(), dryRun: false });
      replace(s, markMessaged(lead, channel, kind, now));
      return { ok: true, message: `Logged: ${t.name.replace(/^\d+\.\s*/, "")} sent to ${lead.name}.`, events: [{ type: "message.sent", summary: `Sent "${t.name.replace(/^\d+\.\s*/, "")}" to ${lead.name} (${channel}, sent by you)`, data: { leadId: lead.id, channel, kind } }] };
    }
    case "setDoNotContact": {
      const lead = findLead(s, a.leadId);
      if (!lead) return fail("That lead no longer exists.");
      replace(s, { ...lead, doNotContact: a.value });
      if (lead.email) {
        const e = normalizeEmail(lead.email);
        s.suppressed = a.value ? [...new Set([...s.suppressed, e])] : s.suppressed.filter((x) => x !== e);
      }
      return {
        ok: true,
        message: a.value ? `${lead.name} won't be contacted again.` : `${lead.name} can be contacted again.`,
        events: [{ type: a.value ? "lead.do_not_contact" : "lead.contact_allowed", summary: a.value ? `Marked ${lead.name} do not contact` : `Allowed contact with ${lead.name} again` }],
      };
    }
    case "cancelFollowUp": {
      const lead = findLead(s, a.leadId);
      if (!lead) return fail("That lead no longer exists.");
      replace(s, { ...lead, followUpCancelled: true });
      return { ok: true, message: "Follow-up cancelled.", events: [{ type: "followup.cancelled", summary: `Cancelled follow-up for ${lead.name}` }] };
    }
    case "saveTemplate": {
      const t = a.template;
      if (!t.name.trim() || !t.body.trim()) return fail("A template needs a name and a message.");
      s.templates = s.templates.some((x) => x.id === t.id) ? s.templates.map((x) => (x.id === t.id ? t : x)) : [...s.templates, t];
      return { ok: true, message: "Template saved.", events: [{ type: "template.saved", summary: `Saved template "${t.name}"` }] };
    }
    case "resetTemplates":
      s.templates = DEFAULT_TEMPLATES.map((t) => ({ ...t }));
      return { ok: true, message: "Templates reset to the 7 starter messages.", events: [{ type: "template.reset", summary: "Reset templates to the starter messages" }] };
    case "saveInterview": {
      const lead = findLead(s, a.leadId);
      if (!lead || lead.deletedAt) return fail("That lead no longer exists.");
      const problems = interviewProblems(a.interview);
      if (problems.length) return fail(problems.join(" "));
      const updated = applyInterview(lead, a.interview, now);
      replace(s, updated);
      return {
        ok: true,
        message: `Interview saved to ${lead.name}. Next: ${nextAction(updated, now, s.settings.followUpDays).toLowerCase()}.`,
        events: [{ type: "interview.saved", summary: `Interviewed ${lead.name}: pain ${a.interview.pain ?? "–"}, would pay ${a.interview.pay ?? "–"}`, data: { leadId: lead.id } }],
      };
    }
    case "saveTargets": {
      const old = s.settings;
      s.settings = {
        ...old,
        followUpDays: clampInt(a.followUpDays, 1, 30, old.followUpDays),
        targets: {
          painConfirmed: clampInt(a.targets.painConfirmed, 1, 1000, old.targets.painConfirmed),
          wouldPay: clampInt(a.targets.wouldPay, 1, 1000, old.targets.wouldPay),
          minSent: clampInt(a.targets.minSent, 1, 10_000, old.targets.minSent),
          days: clampInt(a.targets.days, 1, 365, old.targets.days),
        },
      };
      return { ok: true, message: "Targets saved.", events: [{ type: "settings.changed", summary: "Changed validation targets" }] };
    }
  }
}

/** The numbers on Today and the Outreach overview. */
export function outreachSummary(s: OutreachState, now: Date) {
  const leads = activeLeads(s);
  const stats = computeStats(leads);
  const v = verdict(stats, s.settings.targets);
  const day = stats.firstMessageAt ? Math.min(s.settings.targets.days, Math.floor(daysBetween(stats.firstMessageAt, now)) + 1) : 0;
  const counts: Record<string, number> = {};
  for (const l of leads) {
    const na = nextAction(l, now, s.settings.followUpDays);
    counts[na] = (counts[na] ?? 0) + 1;
  }
  return { stats, verdict: v, day, counts, total: leads.length };
}
