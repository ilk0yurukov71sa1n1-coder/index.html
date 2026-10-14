/** Preview backend: example data in memory, the real rules for checks and settings. Nothing is saved. */
import type { ActionResult, CoreAction, CoreBackend, CoreSnapshot, HqAction, HqSnapshot } from "./api.ts";
import { applyOutreach, emptyOutreach, type OutreachState } from "@/modules/outreach/lib/state.ts";
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

  // Fictional leads at different stages, made with the real Outreach rules.
  const outreach: OutreachState = emptyOutreach();
  let n = 0;
  const mk = () => `demo${++n}`;
  const DAY = 86_400_000;
  const at = (daysAgo: number) => new Date(start - daysAgo * DAY);
  const add = (lead: Parameters<typeof applyOutreach>[1] & { type: "saveLead" }) => applyOutreach(outreach, lead, at(12), mk);
  const people: [string, string, string, "email" | "instagram" | "linkedin", string][] = [
    ["Maria Petrova", "Lumen Studio", "Wedding photography studio", "email", "Your Plovdiv wedding series was beautiful."],
    ["Georgi Dimitrov", "FitForge", "Gym with online booking", "email", "Saw FitForge opened a second location."],
    ["Elena Ivanova", "Smile Point", "Dental clinic", "instagram", "Your before-and-after posts explain the work clearly."],
    ["Nikolay Stoyanov", "Stoyanov Logistics", "Freight broker", "linkedin", ""],
    ["Daniela Koleva", "Koleva Legal", "Small law office", "email", "Your GDPR article for small shops was useful."],
    ["Stefan Marinov", "Marinov Auto", "Car service", "email", "Your SMS service reminders are a smart touch."],
    ["Ralitsa Georgieva", "Bloom Florals", "Florist with webshop", "email", "Bloom's Valentine's campaign was clever."],
    ["Hristo Vasilev", "Vasilev Accounting", "Accounting firm", "linkedin", "Your post on month-end close stuck with me."],
  ];
  for (const [name, company, what, platform, firstLine] of people) {
    add({ type: "saveLead", lead: { name, company, whatTheyDo: what, platform, firstLine, notes: "Fictional demo lead", email: platform === "email" ? `${name.split(" ")[0]!.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, "")}.example` : null, handle: platform === "email" ? null : `@${company.toLowerCase().replace(/[^a-z]/g, "")}` } });
  }
  const byName = (nm: string) => outreach.leads.find((l) => l.name === nm)!.id;
  const send = (nm: string, tpl: string, daysAgo: number) => applyOutreach(outreach, { type: "markSent", leadId: byName(nm), templateId: tpl }, at(daysAgo), mk);
  send("Daniela Koleva", "email-first", 4);
  send("Elena Ivanova", "first-dm", 1);
  for (const nm of ["Stefan Marinov", "Ralitsa Georgieva"]) send(nm, "email-first", 8);
  send("Hristo Vasilev", "first-dm", 7);
  applyOutreach(outreach, { type: "saveInterview", leadId: byName("Stefan Marinov"), interview: { answers: ["Booking and reminder flows", "Reminders stopped for a week; a client told us"], proofAnswer: "", pain: "Y", pay: "Y" } }, at(5), mk);
  applyOutreach(outreach, { type: "saveInterview", leadId: byName("Ralitsa Georgieva"), interview: { answers: ["Webshop order sync"], proofAnswer: "Sometimes", pain: "Y", pay: "Maybe" } }, at(6), mk);
  applyOutreach(outreach, { type: "saveLead", lead: { ...outreach.leads.find((l) => l.name === "Hristo Vasilev")!, replied: true } }, at(6), mk);

  const snapshot = (): HqSnapshot => ({ core: coreSnapshot(), outreach: structuredClone(outreach) });

  const coreSnapshot = (): CoreSnapshot => {
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
    async act(h: HqAction) {
      if (h.module === "outreach") {
        const r = applyOutreach(outreach, h.action, new Date(), mk);
        if (r.ok) for (const e of r.events) log(e.type, e.summary);
        return { snapshot: snapshot(), result: r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message } };
      }
      const a: CoreAction = h.action;
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
