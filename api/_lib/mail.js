// Email: signup verification and alerts to the team, sent through Resend.
// Needs RESEND_API_KEY and VERIFY_SECRET in Vercel. Without them nothing is
// sent and signups are stored unverified.
import { createHmac, timingSafeEqual } from 'node:crypto';

const env = process.env;
const KEY = env.RESEND_API_KEY;
const SECRET = env.VERIFY_SECRET;
const FROM = env.MAIL_FROM || 'Rollcfluence <onboarding@resend.dev>';
export const NOTIFY = env.NOTIFY_EMAIL || 'rollcfluence@gmail.com';
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export const mailReady = Boolean(KEY);
export const verifyReady = Boolean(KEY && SECRET);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const send = async ({ to, subject, html, replyTo }) => {
  if (!KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.error(`mail failed: ${r.status}`);
    return r.ok;
  } catch {
    console.error('mail failed: network');
    return false;
  }
};

// Stateless token: base64url(email|expiry).hmac
const sign = (payload) => createHmac('sha256', SECRET).update(payload).digest('base64url');

export const makeToken = (email) => {
  const payload = Buffer.from(`${email}|${Date.now() + TOKEN_TTL_MS}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const readToken = (token) => {
  if (!SECRET || typeof token !== 'string' || token.length > 600) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [email, exp] = Buffer.from(payload, 'base64url').toString().split('|');
  if (!email || Number(exp) < Date.now()) return null;
  return email;
};

const shell = (body) => `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f4f1ec;color:#1e1615">
<p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7d1d20;margin:0 0 20px">Rollcfluence Shield</p>${body}
<p style="font-size:12px;color:#9b8f8b;margin-top:32px">Rollcfluence · rollcfluence@gmail.com</p></div>`;

export const verifyEmail = (link, goal) =>
  shell(`<h1 style="font-size:24px;margin:0 0 12px">Confirm your spot</h1>
<p style="font-size:15px;line-height:1.6">Thanks for requesting early access. Access is limited, so we only hold spots for confirmed emails.${goal ? ` You told us your goal is: <b>${esc(goal)}</b>.` : ''}</p>
<p style="margin:28px 0"><a href="${esc(link)}" style="background:#7d1d20;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Confirm my email</a></p>
<p style="font-size:13px;color:#685c59">The link works for 48 hours. If you didn't ask for this, ignore this email and nothing happens.</p>`);

export const alertHtml = (title, rows) =>
  shell(`<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
<table style="font-size:14px;border-collapse:collapse">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#685c59;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('')}</table>`);
