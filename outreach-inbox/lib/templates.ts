import type { Lead, Settings, Template } from "./types.ts";

/**
 * Starter messages. Edit them in the Templates screen to match your own voice.
 * Variables: {name}, {first_line}, {company}
 */
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "first-dm",
    name: "1. First DM",
    purpose: "first",
    channel: "dm",
    subject: "",
    body: "Hi {name}, {first_line}\n\nQuick question: do any of your automations at {company} ever break without telling you? I'm researching how small teams catch that. Not selling anything, just trying to learn.",
  },
  {
    id: "follow-up",
    name: "2. Day-3 follow-up",
    purpose: "followup",
    channel: "email",
    subject: "Re: quick question about {company}",
    body: "Hi {name}, just bringing this back up in case it got buried. A one-line answer is plenty: do automations at {company} ever fail quietly?",
  },
  {
    id: "interview",
    name: "3. Interview invite",
    purpose: "interview",
    channel: "email",
    subject: "5 quick questions?",
    body: "Thanks for answering, {name}. Could I ask you 5 short questions about how {company} handles broken automations? 15 minutes on a call, or reply here, whichever is easier.",
  },
  {
    id: "email-first",
    name: "4. First email",
    purpose: "first",
    channel: "email",
    subject: "Quick question about {company}",
    body: "Hi {name},\n\n{first_line}\n\nI'm looking into how small teams find out when an automation stops working, especially when it still says \"success\". Does that ever happen at {company}?\n\nNot a sales pitch. A one-line reply helps me a lot.",
  },
  {
    id: "health-check",
    name: "5. Free health check offer",
    purpose: "offer",
    channel: "email",
    subject: "Free automation health check for {company}",
    body: "Hi {name}, thanks again for the honest answers. I can run a free health check on {company}'s automation history: you export a file, I show you what failed, what failed silently and roughly what it cost. You keep the report either way. Want to try it?",
  },
  {
    id: "price",
    name: "6. Price question",
    purpose: "price",
    channel: "email",
    subject: "One more question",
    body: "Hi {name}, one last thing: if a monthly check caught these problems for {company} before your clients noticed, what would make that a clear yes for you? A price range or a must-have feature both help.",
  },
  {
    id: "close",
    name: "7. Polite close",
    purpose: "close",
    channel: "email",
    subject: "Thank you",
    body: "Hi {name}, thank you for your time and honesty, it really helped. I won't follow up again. All the best with {company}.",
  },
];

const PLACEHOLDER = /\{[a-zA-Z_]+\}/g;

export function signatureFor(s: Settings): string {
  return `\n\n${s.senderName}, ${s.businessName}\nReply "no thanks" and I won't email again.`;
}

export interface Rendered {
  subject: string;
  body: string;
  /** Reasons sending is blocked. Empty = OK. */
  problems: string[];
}

/** Fills {name}, {first_line}, {company}. Blocks if anything is left unfilled or not personalised. */
export function render(t: Template, lead: Lead, settings: Settings, opts: { email: boolean }): Rendered {
  const firstName = lead.name.trim().split(/\s+/)[0] ?? "";
  const vars: Record<string, string> = {
    name: firstName,
    first_line: lead.firstLine.trim(),
    company: lead.company.trim(),
  };
  const problems: string[] = [];
  const usesFirstLine = /\{first_line\}/.test(t.body) || /\{first_line\}/.test(t.subject);
  if (usesFirstLine && !vars.first_line) problems.push("Write a personal first line for this lead. Every message must be personalised.");
  const fill = (s: string) => s.replace(PLACEHOLDER, (m) => {
    const key = m.slice(1, -1);
    return key in vars && vars[key] !== "" ? vars[key]! : m;
  });
  const subject = fill(t.subject);
  let body = fill(t.body);
  const left = [...new Set([...(subject.match(PLACEHOLDER) ?? []), ...(body.match(PLACEHOLDER) ?? [])])];
  for (const p of left) {
    if (p === "{first_line}" && usesFirstLine && !vars.first_line) continue;
    problems.push(`${p} is not filled in${p === "{company}" ? ": add the company name to this lead" : p === "{name}" ? ": add the lead's name" : ""}.`);
  }
  if (opts.email) {
    if (!subject.trim()) problems.push("Add a subject line.");
    body += signatureFor(settings);
  }
  return { subject, body, problems };
}
