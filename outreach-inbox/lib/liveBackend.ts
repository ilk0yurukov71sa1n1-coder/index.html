/**
 * Live backend for the hosted page: data is saved in the page's own database (owner-only),
 * email is sent and replies are read through the viewer's own Gmail connector.
 * The same engine and rules as the Mac app decide what may be sent.
 */
import type { Lead, Reply, SentMessage, Store } from "./types.ts";
import { emptyStore } from "./defaults.ts";
import { applyAction, type Action, type Backend, type Snapshot } from "./actions.ts";
import { processIncoming, type IncomingEmail, type Mailer, type Result } from "./engine.ts";
import { normalizeEmail } from "./rules.ts";

/* Minimal typings for the runtime namespaces this page uses. */
interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface QuerySnap { docs: DocSnap[] }
interface Query { where(f: string, op: string, v: unknown): Query; orderBy(f: string, d?: "asc" | "desc"): Query; limit(n: number): Query; get(): Promise<QuerySnap> }
interface DocRef { get(): Promise<DocSnap>; set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
interface DB { doc(p: string): DocRef; collection(p: string): Query & { doc(id: string): DocRef } }
interface McpError { code: string; message: string; retryable?: boolean }
interface Mcp { callTool(server: string, tool: string, input?: unknown, opts?: unknown): Promise<{ payload?: unknown }> }
interface Downloads { save(o: { filename: string; data: string | Blob }): Promise<unknown> }
type ClaudeRuntime = { use(name: string): Promise<unknown> };

const GMAIL = "Gmail";
// "sent" first: if saving is interrupted, the record that an email went out is the part that must survive.
const COLLECTIONS = ["sent", "replies", "leads"] as const;
type CollectionName = (typeof COLLECTIONS)[number];

let counter = 0;
const makeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${(counter++).toString(36)}`;

/** Our stored id for a Gmail-sent email: gmail:<threadId>:<messageId>. */
const token = (threadId: string, messageId: string) => `gmail:${threadId}:${messageId}`;
const parseToken = (t: string | null | undefined) => {
  const m = /^gmail:([^:]+):(.+)$/.exec(t ?? "");
  return m ? { threadId: m[1]!, messageId: m[2]! } : null;
};

export function explainGmailError(e: unknown, action: "send" | "read"): string {
  const err = e as McpError;
  switch (err?.code) {
    case "server_not_connected":
      return "Gmail isn't connected. Add it in claude.ai Settings → Connectors, then reload this page.";
    case "needs_reauth":
      return "Your Gmail connection expired. Reconnect Gmail in claude.ai Settings → Connectors.";
    case "not_in_manifest":
    case "approval_required":
    case "consent_required":
      return "This page needs your permission to use Gmail. Allow Gmail when asked, or turn it on in this page's Permissions menu.";
    case "blocked_by_policy":
      return "Your organisation's policy blocks this Gmail action.";
    case "selection_required":
      return "You have more than one Gmail connector. Choose one when claude.ai asks.";
    case "server_unavailable":
    case "upstream_error":
      return action === "send"
        ? "Gmail didn't confirm the send. Check your Gmail Sent folder before trying again, so nobody gets it twice."
        : "Gmail didn't answer just now. Try again in a minute.";
    case "tool_error":
      return `Gmail refused: ${err.message}`;
    default:
      return `Gmail: ${err?.message ?? String(e)}`;
  }
}

interface GmailMessage {
  id: string;
  threadId?: string;
  sender?: string;
  subject?: string;
  snippet?: string;
  date?: string;
  labelIds?: string[];
  label_ids?: string[];
  plaintextBody?: string;
  plaintext_body?: string;
}

export async function createLiveBackend(): Promise<Backend | { error: string }> {
  const claude = (globalThis as unknown as { claude?: ClaudeRuntime }).claude;
  if (!claude?.use) return { error: "Open this page on claude.ai, signed in, to use your saved outreach data." };
  const [db, mcp, downloads] = (await Promise.all([claude.use("db"), claude.use("mcp"), claude.use("downloads")])) as [DB | null, Mcp | null, Downloads | null];
  if (!db) return { error: "Your saved data isn't available in this view. Open the page on claude.ai while signed in as its owner." };

  // ---------- load everything once ----------
  async function loadCollection(name: CollectionName): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let last = "";
    for (;;) {
      const q = (last ? db!.collection(name).where("id", ">", last) : db!.collection(name)).orderBy("id").limit(1000);
      const snap = await q.get();
      for (const d of snap.docs) if (d.exists) out.push(d.data()!);
      if (snap.docs.length < 1000) break;
      last = String(out[out.length - 1]!.id);
    }
    return out;
  }
  const base = emptyStore();
  async function readAll(): Promise<Store> {
  const [leads, sent, replies, settingsDoc, templatesDoc, suppressedDoc] = await Promise.all([
    loadCollection("leads"),
    loadCollection("sent"),
    loadCollection("replies"),
    db!.doc("meta/settings").get(),
    db!.doc("meta/templates").get(),
    db!.doc("meta/suppressed").get(),
  ]);
  return {
    ...base,
    leads: leads as unknown as Lead[],
    sent: sent as unknown as SentMessage[],
    replies: replies as unknown as Reply[],
    settings: settingsDoc.exists ? { ...base.settings, ...(settingsDoc.data() as object), targets: { ...base.settings.targets, ...((settingsDoc.data() as { targets?: object }).targets ?? {}) } } : base.settings,
    templates: templatesDoc.exists && Array.isArray(templatesDoc.data()!.list) && (templatesDoc.data()!.list as unknown[]).length ? (templatesDoc.data()!.list as Store["templates"]) : base.templates,
    suppressed: suppressedDoc.exists && Array.isArray(suppressedDoc.data()!.list) ? (suppressedDoc.data()!.list as string[]) : [],
  };
  }
  let store: Store = await readAll();
  /** Re-read before acting, so another tab or device can never be overwritten with stale data. */
  const refresh = async () => {
    try {
      store = await readAll();
    } catch {
      // keep the last good copy; the next action tries again
    }
  };
  const status: Snapshot["email"] = { via: "connector", configured: !!mcp, user: mcp ? "Your Gmail (through claude.ai)" : null, lastCheck: null, lastCheckError: mcp ? null : "Gmail isn't available in this view." };

  // ---------- save only what changed ----------
  const retryOnce = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if ((e as { code?: string }).code !== "unavailable") throw e;
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      await fn();
    }
  };
  async function persist(before: Store, after: Store) {
    for (const c of COLLECTIONS) {
      const old = new Map((before[c] as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
      const now = new Map((after[c] as { id: string }[]).map((x) => [x.id, x]));
      for (const [id, item] of now) if (old.get(id) !== JSON.stringify(item)) await retryOnce(() => db!.doc(`${c}/${id}`).set(item as unknown as Record<string, unknown>));
      for (const id of old.keys()) if (!now.has(id)) await retryOnce(() => db!.doc(`${c}/${id}`).delete());
    }
    if (JSON.stringify(before.suppressed) !== JSON.stringify(after.suppressed)) await retryOnce(() => db!.doc("meta/suppressed").set({ list: after.suppressed }));
    if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) await retryOnce(() => db!.doc("meta/settings").set(after.settings as unknown as Record<string, unknown>));
    if (JSON.stringify(before.templates) !== JSON.stringify(after.templates)) await retryOnce(() => db!.doc("meta/templates").set({ list: after.templates }));
  }

  // ---------- Gmail ----------
  const mailer: Mailer = {
    async send(msg) {
      if (!mcp) throw new Error("Gmail isn't available in this view.");
      const thread = parseToken(msg.inReplyTo);
      let payload: unknown;
      try {
        ({ payload } = await mcp.callTool(GMAIL, "send_message", { to: [msg.to], subject: msg.subject, body: msg.text, ...(thread ? { replyThreadId: thread.threadId } : {}) }));
      } catch (e) {
        const why = explainGmailError(e, "send");
        const unsure = ["server_unavailable", "upstream_error", "cancelled"].includes((e as McpError)?.code);
        throw new Error(unsure ? why : `The email was not sent. ${why}`);
      }
      const p = (payload ?? {}) as { id?: string; threadId?: string; message?: { id?: string; threadId?: string } };
      const id = p.id ?? p.message?.id;
      const threadId = p.threadId ?? p.message?.threadId;
      // Sent, but Gmail gave no ids: still record it (with a unique token) so it is never sent twice.
      return { messageId: id && threadId ? token(threadId, id) : `gmail:unknown:${makeId()}` };
    },
  };

  let checking: Promise<Result> | null = null;
  let checkedOnce = false;
  function checkReplies(wide: boolean): Promise<Result> {
    if (checking) return checking;
    checking = (async (): Promise<Result> => {
      if (!mcp) return { ok: false, error: "Gmail isn't available in this view." };
      await refresh();
      const ourThreads = new Map<string, string>(); // threadId -> token of our first email in it
      const ourGmailIds = new Set<string>();
      const realThreads = new Set<string>(); // threads where a real (not dry-run) email went to a lead
      for (const m of store.sent) {
        const t = parseToken(m.messageId);
        if (!t) continue;
        ourGmailIds.add(t.messageId);
        if (!ourThreads.has(t.threadId)) ourThreads.set(t.threadId, m.messageId!);
        if (!m.dryRun) realThreads.add(t.threadId);
      }
      const own = store.settings.ownAddress ? normalizeEmail(store.settings.ownAddress) : "";
      if (ourThreads.size === 0) {
        status.lastCheck = new Date().toISOString();
        status.lastCheckError = null;
        return { ok: true, message: "No emails sent yet, so there is nothing to check." };
      }
      try {
        const candidates = new Set<string>();
        let pageToken: string | undefined;
        if (!checkedOnce) wide = true; // first check after opening the page looks back 30 days
        checkedOnce = true;
        for (let page = 0; page < (wide ? 6 : 2); page++) {
          const { payload } = await mcp.callTool(GMAIL, "search_threads", { query: `in:inbox newer_than:${wide ? 30 : 3}d`, pageSize: 50, view: "THREAD_VIEW_METADATA_ONLY", ...(pageToken ? { pageToken } : {}) }, { cache: false });
          const p = (payload ?? {}) as { threads?: { id: string }[]; nextPageToken?: string };
          for (const t of p.threads ?? []) if (ourThreads.has(t.id)) candidates.add(t.id);
          pageToken = p.nextPageToken;
          if (!pageToken) break;
        }
        const before = structuredClone(store);
        let found = 0;
        for (const threadId of candidates) {
          const { payload } = await mcp.callTool(GMAIL, "get_thread", { threadId, messageFormat: "PLAIN_TEXT" }, { cache: false });
          const messages = ((payload ?? {}) as { messages?: GmailMessage[] }).messages ?? [];
          for (const m of messages) {
            if (ourGmailIds.has(m.id)) continue; // our own outreach email
            const labels = m.labelIds ?? m.label_ids ?? [];
            if (labels.includes("SENT") && !labels.includes("INBOX")) continue; // something you wrote yourself in Gmail
            // In a thread with a real lead, a message from your own address is you, not their reply.
            // (In dry-run you reply to your own test email on purpose, so it counts there.)
            if (own && realThreads.has(threadId) && normalizeEmail(m.sender ?? "") === own) continue;
            const mail: IncomingEmail = {
              from: m.sender ?? "",
              subject: m.subject ?? "",
              text: m.plaintextBody ?? m.plaintext_body ?? m.snippet ?? "",
              date: m.date ?? new Date().toISOString(),
              messageId: `gmail-msg:${m.id}`,
              inReplyTo: ourThreads.get(threadId)!,
              references: [],
            };
            if (processIncoming(store, mail, new Date(), makeId)) found++;
          }
        }
        if (found) await persist(before, store);
        status.lastCheck = new Date().toISOString();
        status.lastCheckError = null;
        return { ok: true, message: found ? `${found} new ${found === 1 ? "reply" : "replies"}.` : "No new replies." };
      } catch (e) {
        status.lastCheck = new Date().toISOString();
        status.lastCheckError = explainGmailError(e, "read");
        return { ok: false, error: status.lastCheckError };
      } finally {
        checking = null;
      }
    })();
    return checking;
  }

  // One action at a time, so two clicks can never both pass the sending limits.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>) => {
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
  };

  // Check for replies every N minutes while this page is open.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    timer = setTimeout(async () => {
      if (store.sent.some((m) => m.channel === "email")) await serial(() => checkReplies(false));
      schedule();
    }, store.settings.pollMinutes * 60_000);
  };
  if (mcp) schedule();
  void timer;

  const snapshot = (): Snapshot => ({ store: structuredClone(store), now: new Date().toISOString(), preview: false, email: { ...status } });

  return {
    load: async () => {
      await serial(refresh);
      return snapshot();
    },
    saveFile: downloads
      ? async (filename: string, text: string) => {
          await downloads.save({ filename, data: text });
        }
      : undefined,
    act: (a: Action) =>
      serial(async () => {
        let result: Result;
        if (a.type === "testConnection") {
          if (!mcp) result = { ok: false, error: "Gmail isn't available in this view." };
          else {
            try {
              await mcp.callTool(GMAIL, "search_threads", { query: "in:sent", pageSize: 1, view: "THREAD_VIEW_METADATA_ONLY" }, { cache: false });
              result = { ok: true, message: "Gmail is connected: this page can send from your account and read replies." };
            } catch (e) {
              result = { ok: false, error: explainGmailError(e, "read") };
            }
          }
        } else if (a.type === "checkReplies") {
          result = await checkReplies(true);
        } else if (a.type.startsWith("demo")) {
          result = { ok: false, error: "Demo controls are only in the preview." };
        } else {
          await refresh();
          const before = structuredClone(store);
          const working = structuredClone(store);
          result = await applyAction(working, a, new Date(), mailer, makeId);
          store = working;
          try {
            await persist(before, store);
          } catch (e) {
            const err = e as { code?: string; message?: string };
            result = {
              ok: false,
              error: err.code === "quota_exceeded" ? "Your saved data is full. Delete old leads to make room." : `Saving failed (${err.message ?? String(e)}). Reload the page to see what was saved.`,
            };
          }
        }
        return { snapshot: snapshot(), result };
      }),
  };
}
