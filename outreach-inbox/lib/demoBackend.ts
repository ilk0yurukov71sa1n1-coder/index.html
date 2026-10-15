/**
 * Live-preview backend: runs the real rules in the browser on fictional data.
 * Nothing is ever sent; "emails" go to a pretend mailer.
 */
import type { Store } from "./types.ts";
import { emptyStore } from "./defaults.ts";
import { applyAction, type Action, type Backend, type Snapshot } from "./actions.ts";
import { processIncoming, type Mailer } from "./engine.ts";
import { newLead } from "./leads.ts";

const KEY = "outreach-inbox-preview-v1";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface DemoState {
  store: Store;
  offsetMs: number;
}

let counter = 0;
const makeId = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`;

function seed(now: Date): DemoState {
  const store = emptyStore();
  store.settings.ownAddress = "you@example.com";
  const ago = (d: number, h = 0) => new Date(now.getTime() - d * DAY - h * HOUR).toISOString();
  const rows: Parameters<typeof newLead>[0][] = [
    { name: "Maria Petrova", email: "maria@lumen-studio.example", company: "Lumen Studio", whatTheyDo: "Wedding photography studio", firstLine: "Your Plovdiv wedding series last month was beautiful." },
    { name: "Georgi Dimitrov", email: "georgi@fitforge.example", company: "FitForge", whatTheyDo: "Gym with online booking", firstLine: "Saw FitForge just opened a second location, congrats." },
    { name: "Elena Ivanova", handle: "@elena.dental", platform: "instagram", company: "Smile Point", whatTheyDo: "Dental clinic", firstLine: "Your before-and-after posts explain the work really clearly." },
    { name: "Nikolay Stoyanov", handle: "https://www.linkedin.com/in/example-nikolay", platform: "linkedin", company: "Stoyanov Logistics", whatTheyDo: "Freight broker", firstLine: "" },
    { name: "Daniela Koleva", email: "daniela@koleva-law.example", company: "Koleva Legal", whatTheyDo: "Small law office", firstLine: "Your article on GDPR for small shops was useful.", dateMessaged: ago(4), channelMessaged: "email" },
    { name: "Petar Angelov", email: "petar@brewbox.example", company: "BrewBox", whatTheyDo: "Coffee subscription", firstLine: "BrewBox's new Ethiopian roast sold out fast.", dateMessaged: ago(1, 3), channelMessaged: "email" },
    { name: "Ivana Todorova", handle: "@ivana.yoga", platform: "instagram", company: "Flow Yoga", whatTheyDo: "Yoga studio", firstLine: "Your sunrise classes look calm.", dateMessaged: ago(5), channelMessaged: "instagram" },
    { name: "Stefan Marinov", email: "stefan@marinov-auto.example", company: "Marinov Auto", whatTheyDo: "Car service", firstLine: "Your service reminders by SMS are a smart touch.", dateMessaged: ago(6), channelMessaged: "email", replied: true, repliedAt: ago(5), painConfirmed: "Y", wouldPay: "Y" },
    { name: "Ralitsa Georgieva", email: "ralitsa@bloom.example", company: "Bloom Florals", whatTheyDo: "Florist with webshop", firstLine: "Bloom's Valentine's campaign was clever.", dateMessaged: ago(7), channelMessaged: "email", replied: true, repliedAt: ago(6), painConfirmed: "Y", wouldPay: "Maybe" },
    { name: "Hristo Vasilev", handle: "https://www.linkedin.com/in/example-hristo", platform: "linkedin", company: "Vasilev Accounting", whatTheyDo: "Accounting firm", firstLine: "Your post on month-end close stuck with me.", dateMessaged: ago(8), channelMessaged: "linkedin", replied: true, repliedAt: ago(7), painConfirmed: "Y" },
    { name: "Kalina Pavlova", email: "kalina@pawsandco.example", company: "Paws & Co", whatTheyDo: "Pet grooming", firstLine: "The grooming reels made my day.", dateMessaged: ago(9), channelMessaged: "email", replied: true, repliedAt: ago(8), painConfirmed: "N" },
    { name: "Viktor Nikolov", email: "viktor@printhub.example", company: "PrintHub", whatTheyDo: "Print shop", firstLine: "PrintHub's same-day turnaround is impressive.", dateMessaged: ago(10), channelMessaged: "email", replied: true, repliedAt: ago(9) },
  ];
  store.leads = rows.map((r) => newLead({ notes: "Fictional demo lead", ...r }, new Date(ago(12)), makeId()));
  // matching sent log + replies so the Inbox has history
  for (const l of store.leads) {
    if (!l.dateMessaged) continue;
    const email = l.channelMessaged === "email";
    const mid = email ? `<demo-${l.id}@rollcfluence.local>` : null;
    store.sent.push({ id: makeId(), leadId: l.id, channel: l.channelMessaged!, kind: "first", templateId: email ? "email-first" : "first-dm", to: l.email ?? l.handle ?? "", subject: email ? `Quick question about ${l.company}` : "", body: "(demo message)", messageId: mid, sentAt: l.dateMessaged, dryRun: false });
    if (l.replied && email) {
      store.replies.push({ id: makeId(), leadId: l.id, from: l.email!, subject: `Re: Quick question about ${l.company}`, text: replyText(l.painConfirmed), receivedAt: l.repliedAt!, messageId: `<r-${l.id}@demo>`, inReplyTo: mid, references: mid ? [mid] : [], optOut: false });
    }
  }
  return { store, offsetMs: 0 };
}

function replyText(pain: string | null): string {
  if (pain === "Y") return "Honestly yes. Last month our invoice sync stopped for a week and nobody noticed until a client called.";
  if (pain === "N") return "Not really an issue for us, we only have two automations and I check them daily.";
  return "Interesting question. Sometimes, yes. What did you have in mind?";
}

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // storage unavailable: start fresh
  }
  return seed(new Date());
}

export function createDemoBackend(): Backend {
  let state = loadState();
  const now = () => new Date(Date.now() + state.offsetMs);
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // ignore: preview still works without storage
    }
  };
  const mailer: Mailer = { send: async () => ({ messageId: `<demo-${makeId()}@rollcfluence.local>` }) };
  const snapshot = (): Snapshot => ({
    store: structuredClone(state.store),
    now: now().toISOString(),
    preview: true,
    email: { via: "preview", configured: true, user: "you@example.com (preview)", lastCheck: now().toISOString(), lastCheckError: null },
  });

  return {
    load: async () => snapshot(),
    async act(a: Action) {
      let result;
      switch (a.type) {
        case "demoAdvance":
          state.offsetMs += a.hours * HOUR;
          result = { ok: true as const, message: `Demo clock moved forward ${a.hours >= 24 ? `${a.hours / 24} day(s)` : `${a.hours} hour(s)`}.` };
          break;
        case "demoReset":
          state = seed(new Date());
          result = { ok: true as const, message: "Demo data reset." };
          break;
        case "demoReply": {
          const s = state.store;
          const lead = s.leads.find((l) => l.id === a.leadId);
          const first = s.sent.find((m) => m.leadId === a.leadId && m.channel === "email");
          if (!lead || !first) {
            result = { ok: false as const, error: "Send this lead an email first, then simulate their reply." };
            break;
          }
          const r = processIncoming(s, {
            from: lead.email ?? "",
            subject: `Re: ${first.subject.replace(/^\[TEST\] /, "")}`,
            text: a.optOut ? "No thanks, please don't email me again." : "Yes, this has bitten us before. Happy to answer a few questions.",
            date: now().toISOString(),
            messageId: `<demo-reply-${makeId()}@example>`,
            inReplyTo: first.messageId,
            references: first.messageId ? [first.messageId] : [],
          }, now(), makeId);
          result = r ? { ok: true as const, message: a.optOut ? "Reply received: they opted out and were added to the suppression list." : "Reply received: lead marked Replied, follow-up stopped." } : { ok: false as const, error: "Could not match that reply." };
          break;
        }
        case "testConnection":
          result = { ok: true as const, message: "Preview: no real connection. In the Mac app this checks your mail server (SMTP and IMAP)." };
          break;
        case "checkReplies":
          result = { ok: true as const, message: "Preview: use \"Simulate a reply\" below. In the Mac app this checks your inbox every 2 minutes." };
          break;
        default:
          result = await applyAction(state.store, a, now(), mailer, makeId);
      }
      save();
      return { snapshot: snapshot(), result };
    },
  };
}
