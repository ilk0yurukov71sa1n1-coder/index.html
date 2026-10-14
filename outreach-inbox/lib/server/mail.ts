import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { IncomingEmail, Mailer, OutgoingEmail } from "../engine.ts";

/** Mail settings from .env.local. The password never leaves this module. */
export interface MailConfig {
  user: string;
  pass: string;
  fromName: string;
  smtp: { host: string; port: number };
  imap: { host: string; port: number };
}

export function readMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig | null {
  const user = env.MAIL_USER?.trim();
  const pass = env.MAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  const gmail = /@(gmail|googlemail)\.com$/i.test(user);
  return {
    user,
    pass,
    fromName: env.MAIL_FROM_NAME?.trim() || "Ilko",
    smtp: { host: env.SMTP_HOST?.trim() || (gmail ? "smtp.gmail.com" : ""), port: Number(env.SMTP_PORT || 465) },
    imap: { host: env.IMAP_HOST?.trim() || (gmail ? "imap.gmail.com" : ""), port: Number(env.IMAP_PORT || 993) },
  };
}

/** Turns technical mail errors into plain English. */
export function explainMailError(e: unknown, which: "SMTP" | "IMAP", host: string): string {
  const err = e as { code?: string; responseCode?: number; authenticationFailed?: boolean; message?: string };
  const msg = String(err?.message ?? e);
  if (err?.authenticationFailed || err?.code === "EAUTH" || err?.responseCode === 535 || /AUTHENTICATIONFAILED|Invalid credentials|Username and Password not accepted/i.test(msg)) {
    return `${which}: the login was rejected. For Gmail you need a 16-letter App Password (not your normal password), and 2-Step Verification must be on. Check MAIL_USER and MAIL_APP_PASSWORD in .env.local.`;
  }
  if (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN" || /ENOTFOUND|EAI_AGAIN/.test(msg)) return `${which}: can't find the server "${host}". Check the host name, and that you're online.`;
  if (err?.code === "ECONNREFUSED") return `${which}: "${host}" refused the connection. Check the port number.`;
  if (err?.code === "ETIMEDOUT" || err?.code === "ECONNECTION" || /timed? ?out/i.test(msg)) return `${which}: no answer from "${host}". Check the port, and whether a firewall or VPN is blocking it.`;
  if (/certificate|SSL|TLS|wrong version number/i.test(msg)) return `${which}: secure connection failed. Use port 465 for SMTP (or 587) and 993 for IMAP.`;
  if (/IMAP.*disabled|IMAP access/i.test(msg)) return "IMAP: IMAP is turned off for this account. In Gmail: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP.";
  return `${which}: ${msg.slice(0, 200)}`;
}

function transport(cfg: MailConfig) {
  return nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15_000,
    logger: false,
  });
}

function imapClient(cfg: MailConfig) {
  return new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: cfg.imap.port === 993,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
    connectionTimeout: 15_000,
  });
}

export function createMailer(cfg: MailConfig): Mailer {
  const t = transport(cfg);
  const domain = cfg.user.split("@")[1] ?? "localhost";
  return {
    async send(msg: OutgoingEmail) {
      const messageId = `<${randomUUID()}@${domain}>`;
      try {
        await t.sendMail({
          from: { name: cfg.fromName, address: cfg.user },
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          messageId,
          ...(msg.inReplyTo ? { inReplyTo: msg.inReplyTo, references: msg.references } : {}),
        });
      } catch (e) {
        throw new Error(explainMailError(e, "SMTP", cfg.smtp.host));
      }
      return { messageId };
    },
  };
}

export async function testConnection(cfg: MailConfig): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  let ok = true;
  try {
    await transport(cfg).verify();
    lines.push(`Sending (SMTP ${cfg.smtp.host}:${cfg.smtp.port}): OK`);
  } catch (e) {
    ok = false;
    lines.push(explainMailError(e, "SMTP", cfg.smtp.host));
  }
  const c = imapClient(cfg);
  try {
    await c.connect();
    await c.mailboxOpen("INBOX", { readOnly: true });
    lines.push(`Reading replies (IMAP ${cfg.imap.host}:${cfg.imap.port}): OK`);
  } catch (e) {
    ok = false;
    lines.push(explainMailError(e, "IMAP", cfg.imap.host));
  } finally {
    await c.logout().catch(() => undefined);
  }
  return { ok, lines };
}

const cleanId = (s: string) => s.trim().toLowerCase();

/**
 * Reads INBOX (read-only, nothing is marked as read) for messages since `since`,
 * and returns those that look like replies to our emails or come from a lead's address.
 */
export async function fetchCandidateReplies(cfg: MailConfig, since: Date, ourIds: Set<string>, leadAddresses: Set<string>): Promise<IncomingEmail[]> {
  const c = imapClient(cfg);
  const out: IncomingEmail[] = [];
  try {
    await c.connect();
    const lock = await c.getMailboxLock("INBOX", { readOnly: true });
    try {
      const uids = await c.search({ since }, { uid: true });
      if (!uids || uids.length === 0) return out;
      const wanted: number[] = [];
      for await (const m of c.fetch(uids, { uid: true, envelope: true, headers: ["references"] }, { uid: true })) {
        const env = m.envelope;
        const refs = (m.headers?.toString("utf8").match(/<[^>]+>/g) ?? []).map(cleanId);
        const from = env?.from?.[0]?.address?.toLowerCase() ?? "";
        const replyTo = env?.inReplyTo ? cleanId(env.inReplyTo) : "";
        if ((replyTo && ourIds.has(replyTo)) || refs.some((r) => ourIds.has(r)) || leadAddresses.has(from)) wanted.push(m.uid);
      }
      for (const uid of wanted) {
        const msg = await c.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const p = await simpleParser(msg.source);
        const refs = Array.isArray(p.references) ? p.references : p.references ? [p.references] : [];
        out.push({
          from: p.from?.value?.[0]?.address ?? "",
          subject: p.subject ?? "",
          text: (p.text ?? "").slice(0, 20_000),
          date: (p.date ?? new Date()).toISOString(),
          messageId: p.messageId ?? null,
          inReplyTo: p.inReplyTo ?? null,
          references: refs,
        });
      }
    } finally {
      lock.release();
    }
  } catch (e) {
    throw new Error(explainMailError(e, "IMAP", cfg.imap.host));
  } finally {
    await c.logout().catch(() => undefined);
  }
  return out;
}
