import type { Lead, Platform } from "./types.ts";
import { daysBetween } from "./time.ts";

export type NextAction =
  | "Do not contact"
  | "Message them"
  | "Wait for reply"
  | "Send follow-up"
  | "Run the 5-question interview"
  | "Offer the free health check"
  | "Ask what would make it a yes"
  | "Thank them and close";

/**
 * The tracker's flow:
 * Message them → Wait for reply → Send follow-up (once, after 3 days, no reply)
 * → Run the 5-question interview → Offer the free health check / Ask what would make it a yes / Thank them and close.
 */
export function nextAction(lead: Lead, now: Date, followUpDays = 3): NextAction {
  if (lead.doNotContact) return "Do not contact";
  if (!lead.dateMessaged) return "Message them";
  if (!lead.replied) {
    if (lead.followUpSentAt || lead.followUpCancelled) return "Wait for reply";
    return daysBetween(lead.dateMessaged, now) >= followUpDays ? "Send follow-up" : "Wait for reply";
  }
  if (lead.painConfirmed === "N" || lead.wouldPay === "N") return "Thank them and close";
  if (lead.wouldPay === "Y") return "Offer the free health check";
  if (lead.wouldPay === "Maybe") return "Ask what would make it a yes";
  return "Run the 5-question interview";
}

/** Contact address for the lead's channel. */
export function contactFor(lead: Lead): string | null {
  return lead.platform === "email" ? lead.email : lead.handle;
}

const PLATFORM_BASE: Record<Exclude<Platform, "email">, string> = {
  instagram: "https://www.instagram.com/",
  linkedin: "https://www.linkedin.com/in/",
  x: "https://x.com/",
};

/** Turns "@studio", "studio" or a full URL into a profile link. Never contacts the site. */
export function profileUrl(lead: Lead): string | null {
  if (lead.platform === "email" || !lead.handle) return null;
  const h = lead.handle.trim();
  if (/^https?:\/\//i.test(h)) return h;
  return PLATFORM_BASE[lead.platform] + encodeURIComponent(h.replace(/^@/, ""));
}

export function newLead(input: Partial<Lead> & { name: string }, now: Date, id: string): Lead {
  return {
    id,
    name: input.name.trim(),
    email: input.email?.trim().toLowerCase() || null,
    handle: input.handle?.trim() || null,
    platform: input.platform ?? (input.email ? "email" : "instagram"),
    company: input.company?.trim() ?? "",
    whatTheyDo: input.whatTheyDo?.trim() ?? "",
    firstLine: input.firstLine?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    createdAt: now.toISOString(),
    dateMessaged: input.dateMessaged ?? null,
    channelMessaged: input.channelMessaged ?? null,
    followUpSentAt: input.followUpSentAt ?? null,
    followUpCancelled: input.followUpCancelled ?? false,
    replied: input.replied ?? false,
    repliedAt: input.repliedAt ?? null,
    painConfirmed: input.painConfirmed ?? null,
    wouldPay: input.wouldPay ?? null,
    doNotContact: input.doNotContact ?? false,
  };
}

/** Lead after a message was sent (first contact or the one follow-up). */
export function markMessaged(lead: Lead, channel: Platform, kind: "first" | "followup" | "other", at: Date): Lead {
  if (kind === "followup") return { ...lead, followUpSentAt: at.toISOString() };
  if (kind === "first" && !lead.dateMessaged) return { ...lead, dateMessaged: at.toISOString(), channelMessaged: channel };
  return lead;
}

/** Lead after a reply arrived: Replied = Y and any pending follow-up is cancelled. */
export function markReplied(lead: Lead, at: Date): Lead {
  return {
    ...lead,
    replied: true,
    repliedAt: lead.repliedAt ?? at.toISOString(),
    followUpCancelled: lead.followUpSentAt ? lead.followUpCancelled : true,
  };
}
