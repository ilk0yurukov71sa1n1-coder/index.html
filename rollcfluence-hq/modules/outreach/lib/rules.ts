import { HARD_MAX_DAILY_CAP, type Lead, type Reply, type SentMessage, type Settings } from "./types.ts";
import { daysBetween, sofiaDate, sofiaParts } from "./time.ts";

// ---------------- sending limits ----------------

export const effectiveCap = (s: Settings) => Math.max(0, Math.min(HARD_MAX_DAILY_CAP, Math.floor(s.dailyCap)));

/** Emails (not DMs) sent today, Sofia calendar day. Dry-run emails count too, so tests behave like the real thing. */
export function sentToday(sent: SentMessage[], now: Date): number {
  const today = sofiaDate(now);
  return sent.filter((m) => m.channel === "email" && sofiaDate(new Date(m.sentAt)) === today).length;
}

export type SendCheck = { ok: true } | { ok: false; reason: string };

export function canSendEmailNow(sent: SentMessage[], settings: Settings, now: Date): SendCheck {
  const { hour, minute } = sofiaParts(now);
  if (hour < settings.startHour || hour >= settings.endHour) {
    return {
      ok: false,
      reason: `Outside sending hours (${pad(settings.startHour)}:00–${pad(settings.endHour)}:00 Sofia time). It is ${pad(hour)}:${pad(minute)} now.`,
    };
  }
  const cap = effectiveCap(settings);
  const today = sentToday(sent, now);
  if (today >= cap) return { ok: false, reason: `Daily limit reached: ${today} / ${cap} emails sent today.` };
  const last = sent.filter((m) => m.channel === "email").reduce((max, m) => Math.max(max, Date.parse(m.sentAt)), 0);
  const waitMs = last + settings.minGapMinutes * 60_000 - now.getTime();
  if (waitMs > 0) {
    const s = Math.ceil(waitMs / 1000);
    return { ok: false, reason: `Wait ${Math.floor(s / 60)}m ${s % 60}s: at least ${settings.minGapMinutes} minutes between emails.` };
  }
  return { ok: true };
}

const pad = (n: number) => String(n).padStart(2, "0");

// ---------------- suppression ----------------

export const normalizeEmail = (addr: string) => {
  const m = /<([^>]+)>/.exec(addr);
  return (m ? m[1]! : addr).trim().toLowerCase();
};

/** Removes quoted history so "stop" in our own earlier email doesn't count. */
export function newTextOnly(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*On .+wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^\s*-- ?$/.test(line)) break;
    out.push(line);
  }
  return out.join("\n");
}

export function isOptOut(text: string): boolean {
  return /\b(no thanks|no, thanks|no thank you|unsubscribe|stop)\b/i.test(newTextOnly(text));
}

/** Do-not-contact entries are email addresses, or lowercased handles/links for people reached by DM. */
export const handleKey = (handle: string) => handle.trim().toLowerCase();

export function suppressionKeys(lead: Pick<Lead, "email" | "handle">): string[] {
  return [lead.email ? normalizeEmail(lead.email) : "", lead.handle ? handleKey(lead.handle) : ""].filter(Boolean);
}

export function isSuppressed(suppressed: string[], email: string | null, handle: string | null = null): boolean {
  return (!!email && suppressed.includes(normalizeEmail(email))) || (!!handle && suppressed.includes(handleKey(handle)));
}

// ---------------- reply matching ----------------

const cleanId = (id: string) => id.trim().replace(/^<|>$/g, "").toLowerCase();

/** Match by In-Reply-To / References to a Message-ID we sent; fall back to the sender's address. */
export function matchReply(
  reply: Pick<Reply, "from" | "inReplyTo" | "references">,
  sent: SentMessage[],
  leads: Lead[],
): string | null {
  const ids = [reply.inReplyTo, ...reply.references].filter((x): x is string => !!x).map(cleanId);
  for (const m of sent) {
    if (m.messageId && ids.includes(cleanId(m.messageId))) return m.leadId;
  }
  const from = normalizeEmail(reply.from);
  const lead = leads.find((l) => l.email && normalizeEmail(l.email) === from);
  return lead ? lead.id : null;
}

// ---------------- follow-ups ----------------

/** Email leads whose single follow-up is due. Never returns a lead that already had one. */
export function dueFollowUps(leads: Lead[], suppressed: string[], settings: Settings, now: Date): Lead[] {
  return leads.filter(
    (l) =>
      l.platform === "email" &&
      l.channelMessaged === "email" &&
      !!l.dateMessaged &&
      !l.replied &&
      !l.followUpSentAt &&
      !l.followUpCancelled &&
      !l.doNotContact &&
      !isSuppressed(suppressed, l.email, l.handle) &&
      daysBetween(l.dateMessaged, now) >= settings.followUpDays,
  );
}

export function canSendFollowUp(lead: Lead): SendCheck {
  if (lead.followUpSentAt) return { ok: false, reason: "This lead already had its one follow-up." };
  if (lead.replied) return { ok: false, reason: "They replied, so no follow-up is needed." };
  if (lead.followUpCancelled) return { ok: false, reason: "The follow-up was cancelled." };
  if (!lead.dateMessaged) return { ok: false, reason: "Send the first message before a follow-up." };
  return { ok: true };
}

// ---------------- verdict ----------------

export type VerdictKind = "PASS" | "KEEP GOING" | "FAIL";

export interface Stats {
  sentByChannel: Record<string, number>;
  messagedLeads: number;
  replies: number;
  replyRate: number;
  painConfirmed: number;
  wouldPay: number;
  firstMessageAt: string | null;
}

export function computeStats(leads: Lead[]): Stats {
  const messaged = leads.filter((l) => l.dateMessaged);
  const sentByChannel: Record<string, number> = { email: 0, instagram: 0, linkedin: 0, x: 0 };
  for (const l of messaged) sentByChannel[l.channelMessaged ?? l.platform] = (sentByChannel[l.channelMessaged ?? l.platform] ?? 0) + 1;
  const replies = messaged.filter((l) => l.replied).length;
  const first = messaged.map((l) => l.dateMessaged!).sort()[0] ?? null;
  return {
    sentByChannel,
    messagedLeads: messaged.length,
    replies,
    replyRate: messaged.length ? replies / messaged.length : 0,
    painConfirmed: leads.filter((l) => l.painConfirmed === "Y").length,
    wouldPay: leads.filter((l) => l.wouldPay === "Y").length,
    firstMessageAt: first,
  };
}

/** PASS when pain ≥ target AND would-pay ≥ target; KEEP GOING while fewer than minSent people messaged; otherwise FAIL. */
export function verdict(stats: Stats, targets: Settings["targets"]): { kind: VerdictKind; text: string } {
  if (stats.painConfirmed >= targets.painConfirmed && stats.wouldPay >= targets.wouldPay) {
    return { kind: "PASS", text: `${stats.painConfirmed} confirmed the pain and ${stats.wouldPay} would pay. The problem is real: build the offer.` };
  }
  if (stats.messagedLeads < targets.minSent) {
    return { kind: "KEEP GOING", text: `${stats.messagedLeads} of ${targets.minSent} people messaged. Keep going before judging.` };
  }
  return { kind: "FAIL", text: "Enough people messaged without enough pain or buyers: change the angle, don't build more." };
}
