import "server-only";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { JsonStore } from "../store.ts";
import { applyAction, type Action, type EmailStatus, type Snapshot } from "../actions.ts";
import { processIncoming, type Mailer, type Result } from "../engine.ts";
import { normalizeEmail } from "../rules.ts";
import { createMailer, fetchCandidateReplies, readMailConfig, testConnection } from "./mail.ts";

const makeId = () => randomUUID();

/** One instance per server process (survives hot reloads in dev). */
interface AppState {
  store: JsonStore;
  status: EmailStatus;
  timer: NodeJS.Timeout | null;
  checking: Promise<Result> | null;
}

const g = globalThis as unknown as { __outreach?: AppState };

function app(): AppState {
  if (!g.__outreach) {
    const cfg = readMailConfig();
    g.__outreach = {
      store: new JsonStore(process.env.OUTREACH_DATA_FILE || join(process.cwd(), "data", "outreach.json")),
      status: { via: "env", configured: !!cfg, user: cfg?.user ?? null, lastCheck: null, lastCheckError: null },
      timer: null,
      checking: null,
    };
  }
  return g.__outreach;
}

const noMailer: Mailer = {
  send: async () => {
    throw new Error("No email account is set up. Add MAIL_USER and MAIL_APP_PASSWORD to .env.local (see the README).");
  },
};

export async function snapshot(): Promise<Snapshot> {
  const a = app();
  return { store: await a.store.read(), now: new Date().toISOString(), preview: false, email: { ...a.status } };
}

/** Looks for new replies. Only one check runs at a time. */
export function checkReplies(): Promise<Result> {
  const a = app();
  if (a.checking) return a.checking;
  a.checking = (async (): Promise<Result> => {
    const cfg = readMailConfig();
    if (!cfg) return { ok: false, error: "No email account is set up yet." };
    try {
      const current = await a.store.read();
      if (current.sent.every((m) => m.channel !== "email")) {
        a.status.lastCheck = new Date().toISOString();
        a.status.lastCheckError = null;
        return { ok: true, message: "No emails sent yet, so there is nothing to check." };
      }
      const firstSent = current.sent.filter((m) => m.channel === "email").map((m) => Date.parse(m.sentAt)).sort((x, y) => x - y)[0]!;
      const since = new Date(Math.max(firstSent - 86_400_000, Date.now() - 60 * 86_400_000));
      const ourIds = new Set(current.sent.flatMap((m) => (m.messageId ? [m.messageId.toLowerCase()] : [])));
      const addresses = new Set(current.leads.flatMap((l) => (l.email ? [normalizeEmail(l.email)] : [])));
      if (current.settings.dryRun && current.settings.ownAddress) addresses.add(current.settings.ownAddress);
      const mails = await fetchCandidateReplies(cfg, since, ourIds, addresses);
      const found = await a.store.update((s) => {
        let n = 0;
        for (const m of mails) if (processIncoming(s, m, new Date(), makeId)) n++;
        return n;
      });
      a.status.lastCheck = new Date().toISOString();
      a.status.lastCheckError = null;
      return { ok: true, message: found ? `${found} new ${found === 1 ? "reply" : "replies"}.` : "No new replies." };
    } catch (e) {
      a.status.lastCheck = new Date().toISOString();
      a.status.lastCheckError = e instanceof Error ? e.message : String(e);
      return { ok: false, error: a.status.lastCheckError };
    } finally {
      a.checking = null;
    }
  })();
  return a.checking;
}

/** Background inbox check every N minutes, only while the app runs. */
export async function startPolling() {
  const a = app();
  if (a.timer) return;
  const schedule = async () => {
    const minutes = (await a.store.read().catch(() => null))?.settings.pollMinutes ?? 2;
    a.timer = setTimeout(async () => {
      if (readMailConfig()) await checkReplies();
      void schedule();
    }, minutes * 60_000);
    a.timer.unref();
  };
  await schedule();
}

export async function runAction(action: Action): Promise<{ snapshot: Snapshot; result: Result }> {
  const a = app();
  let result: Result;
  if (action.type === "testConnection") {
    const cfg = readMailConfig();
    if (!cfg) result = { ok: false, error: "No email account is set up yet. Add MAIL_USER and MAIL_APP_PASSWORD to .env.local (see the README)." };
    else {
      const r = await testConnection(cfg);
      result = r.ok ? { ok: true, message: r.lines.join(" · ") } : { ok: false, error: r.lines.join(" · ") };
    }
  } else if (action.type === "checkReplies") {
    result = await checkReplies();
  } else if (action.type.startsWith("demo")) {
    result = { ok: false, error: "Demo controls exist only in the preview." };
  } else {
    const cfg = readMailConfig();
    const mailer = cfg ? createMailer(cfg) : noMailer;
    result = await a.store.update((s) => applyAction(s, action, new Date(), mailer, makeId));
  }
  return { snapshot: await snapshot(), result };
}
