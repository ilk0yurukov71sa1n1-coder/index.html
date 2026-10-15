/**
 * All state changes go through here. The real app runs these on the server with a real mailer;
 * the live preview runs the very same functions in the browser with a pretend mailer.
 */
import type { Lead, Reply, SentMessage, Store, Template } from "./types.ts";
import { markMessaged, markReplied, newLead } from "./leads.ts";
import { render } from "./templates.ts";
import { canSendEmailNow, canSendFollowUp, dueFollowUps, isOptOut, isSuppressed, matchReply, normalizeEmail } from "./rules.ts";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
}

export interface Mailer {
  send(msg: OutgoingEmail): Promise<{ messageId: string }>;
}

export interface IncomingEmail {
  from: string;
  subject: string;
  text: string;
  date: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
}

export type Result = { ok: true; message: string } | { ok: false; error: string };

const kindFor = (t: Template, lead: Lead): SentMessage["kind"] =>
  t.purpose === "followup" ? "followup" : t.purpose === "first" && !lead.dateMessaged ? "first" : "other";

function findLead(store: Store, id: string): Lead {
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) throw new Error("That lead no longer exists.");
  return lead;
}

function replaceLead(store: Store, lead: Lead) {
  store.leads = store.leads.map((l) => (l.id === lead.id ? lead : l));
}

export function previewMessage(store: Store, leadId: string, templateId: string) {
  const lead = findLead(store, leadId);
  const t = store.templates.find((x) => x.id === templateId);
  if (!t) throw new Error("Template not found.");
  const email = lead.platform === "email";
  return { lead, template: t, kind: kindFor(t, lead), ...render(t, lead, store.settings, { email }) };
}

export async function sendEmail(store: Store, leadId: string, templateId: string, now: Date, mailer: Mailer, makeId: () => string): Promise<Result> {
  const { lead, template, kind, subject, body, problems } = previewMessage(store, leadId, templateId);
  const s = store.settings;
  if (lead.platform !== "email" || !lead.email) return { ok: false, error: "This lead has no email address. Use assisted send for social leads." };
  if (lead.doNotContact || isSuppressed(store.suppressed, lead.email)) return { ok: false, error: "This person asked not to be contacted. They are on your suppression list." };
  if (problems.length) return { ok: false, error: problems.join(" ") };
  if (kind === "followup") {
    const f = canSendFollowUp(lead);
    if (!f.ok) return { ok: false, error: f.reason };
  }
  const limit = canSendEmailNow(store.sent, s, now);
  if (!limit.ok) return { ok: false, error: limit.reason };
  if (s.dryRun && !s.ownAddress) return { ok: false, error: "Dry-run is on: add your own email address in Settings so test emails have somewhere to go." };

  const thread = kind === "followup" ? store.sent.find((m) => m.leadId === lead.id && m.kind === "first" && m.messageId) : undefined;
  const msg: OutgoingEmail = {
    to: s.dryRun ? s.ownAddress : lead.email,
    subject: (s.dryRun ? "[TEST] " : "") + subject,
    text: body,
    ...(thread?.messageId ? { inReplyTo: thread.messageId, references: [thread.messageId] } : {}),
  };
  let messageId: string;
  try {
    ({ messageId } = await mailer.send(msg));
  } catch (e) {
    // The mailer's message says whether the email definitely did not go out or might have.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  store.sent.push({ id: makeId(), leadId: lead.id, channel: "email", kind, templateId, to: lead.email, subject: msg.subject, body, messageId, sentAt: now.toISOString(), dryRun: s.dryRun });
  replaceLead(store, markMessaged(lead, "email", kind === "first" ? "first" : kind === "followup" ? "followup" : "other", now));
  return { ok: true, message: s.dryRun ? `Test email sent to your own address (${s.ownAddress}).` : `Email sent to ${lead.email}.` };
}

/** Assisted send for Instagram / LinkedIn / X: you sent it yourself; this only logs it. */
export function markDmSent(store: Store, leadId: string, templateId: string, now: Date, makeId: () => string): Result {
  const { lead, kind, body, problems } = previewMessage(store, leadId, templateId);
  if (lead.doNotContact) return { ok: false, error: "This person asked not to be contacted." };
  if (problems.length) return { ok: false, error: problems.join(" ") };
  if (kind === "followup") {
    const f = canSendFollowUp(lead);
    if (!f.ok) return { ok: false, error: f.reason };
  }
  store.sent.push({ id: makeId(), leadId, channel: lead.platform, kind, templateId, to: lead.handle ?? "", subject: "", body, messageId: null, sentAt: now.toISOString(), dryRun: false });
  replaceLead(store, markMessaged(lead, lead.platform, kind === "first" ? "first" : kind === "followup" ? "followup" : "other", now));
  return { ok: true, message: "Logged as sent." };
}

/** Handles one incoming email. Returns the stored reply, or null if it is not a reply to our outreach. */
export function processIncoming(store: Store, mail: IncomingEmail, now: Date, makeId: () => string): Reply | null {
  const ourIds = new Set(store.sent.map((m) => m.messageId?.toLowerCase()).filter(Boolean));
  if (mail.messageId && ourIds.has(mail.messageId.toLowerCase())) return null; // our own dry-run email arriving in the inbox
  if (mail.messageId && store.replies.some((r) => r.messageId === mail.messageId)) return null; // already seen
  const leadId = matchReply(mail, store.sent, store.leads);
  if (!leadId) return null;
  const optOut = isOptOut(mail.text);
  const reply: Reply = { id: makeId(), leadId, from: mail.from, subject: mail.subject, text: mail.text, receivedAt: mail.date || now.toISOString(), messageId: mail.messageId, inReplyTo: mail.inReplyTo, references: mail.references, optOut };
  store.replies.push(reply);
  let lead = markReplied(findLead(store, leadId), new Date(reply.receivedAt));
  if (optOut) {
    lead = { ...lead, doNotContact: true };
    suppress(store, lead.email ?? mail.from);
  }
  replaceLead(store, lead);
  return reply;
}

export function suppress(store: Store, address: string) {
  const a = normalizeEmail(address);
  if (a && !store.suppressed.includes(a)) store.suppressed.push(a);
}

export function setDoNotContact(store: Store, leadId: string, value: boolean) {
  const lead = findLead(store, leadId);
  replaceLead(store, { ...lead, doNotContact: value });
  if (value && lead.email) suppress(store, lead.email);
  if (!value && lead.email) store.suppressed = store.suppressed.filter((a) => a !== normalizeEmail(lead.email!));
}

export function cancelFollowUp(store: Store, leadId: string) {
  const lead = findLead(store, leadId);
  replaceLead(store, { ...lead, followUpCancelled: true });
}

export const followUpQueue = (store: Store, now: Date) => dueFollowUps(store.leads, store.suppressed, store.settings, now);

export function upsertLead(store: Store, input: Partial<Lead> & { name: string }, now: Date, makeId: () => string): Lead {
  if (!input.name.trim()) throw new Error("A lead needs a name.");
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`"${email}" is not a valid email address.`);
  if (input.id) {
    const old = findLead(store, input.id);
    const updated: Lead = { ...old, ...input, email, name: input.name.trim() };
    replaceLead(store, updated);
    return updated;
  }
  const lead = newLead({ ...input, email }, now, makeId());
  store.leads.push(lead);
  return lead;
}

export function deleteLead(store: Store, id: string) {
  store.leads = store.leads.filter((l) => l.id !== id);
  store.sent = store.sent.filter((m) => m.leadId !== id);
  store.replies = store.replies.filter((r) => r.leadId !== id);
}
