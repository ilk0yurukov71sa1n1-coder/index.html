import "server-only";
import { randomUUID } from "node:crypto";
import type { Repository } from "@/core/repo.ts";
import type { Lead, SentMessage, Settings, Template } from "./lib/types.ts";
import { applyOutreach, emptyOutreach, type OutreachAction, type OutreachResult, type OutreachState } from "./lib/state.ts";

/** Loads the Outreach module's data from the shared repository. */
export function loadOutreach(repo: Repository, signature?: { yourName: string; businessName: string }): OutreachState {
  const base = emptyOutreach();
  const templates = repo.list<Template>("templates");
  const saved = repo.get<Partial<Settings>>("settings", "outreach");
  return {
    leads: repo.list<Lead>("leads"),
    sent: repo.list<SentMessage>("sent"),
    templates: templates.length ? templates : base.templates,
    suppressed: repo.get<{ list: string[] }>("settings", "suppressed")?.list ?? [],
    settings: {
      ...(saved ? { ...base.settings, ...saved, targets: { ...base.settings.targets, ...saved.targets } } : base.settings),
      // the email signature always uses the name and business from HQ Settings
      ...(signature ? { senderName: signature.yourName, businessName: signature.businessName } : {}),
    },
  };
}

/** Saves only what changed, together with the activity-log entries, in one transaction. */
function persist(repo: Repository, before: OutreachState, after: OutreachState, events: OutreachResult["events"]) {
  repo.transaction(() => {
    for (const [col, b, a] of [
      ["leads", before.leads, after.leads],
      ["sent", before.sent, after.sent],
      ["templates", before.templates, after.templates],
    ] as const) {
      const old = new Map((b as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
      const now = new Set<string>();
      for (const item of a as { id: string }[]) {
        now.add(item.id);
        if (old.get(item.id) !== JSON.stringify(item)) repo.put(col, item.id, item);
      }
      for (const id of old.keys()) if (!now.has(id)) repo.remove(col, id);
    }
    // the starter templates are saved the first time anything changes, so edits always persist
    if (!repo.list("templates").length) for (const t of after.templates) repo.put("templates", t.id, t);
    if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) repo.put("settings", "outreach", after.settings);
    if (JSON.stringify(before.suppressed) !== JSON.stringify(after.suppressed)) repo.put("settings", "suppressed", { list: after.suppressed });
    for (const e of events) repo.appendEvent(e);
  });
}

const REDACTED = "[deleted person]";

export function runOutreach(repo: Repository, a: OutreachAction, signature?: { yourName: string; businessName: string }): OutreachResult {
  const before = loadOutreach(repo, signature);
  const after = structuredClone(before);
  const result = applyOutreach(after, a, new Date(), () => randomUUID());
  if (result.ok) {
    persist(repo, before, after, result.events);
    if (result.redact) {
      repo.transaction(() => repo.redactEvents(result.redact!.name, result.redact!.id, REDACTED));
      repo.compact();
    }
  }
  return result;
}
