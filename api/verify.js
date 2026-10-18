// GET /api/verify?t=token          Confirms a signup email from the link we sent.
// GET /api/verify?a=alert&t=token  Shows "Send alerts to …?" with one button.
// POST /api/verify?a=alert  t=token  Adds the email alert channel. Like sign-in
//   links, the extra click keeps link scanners from confirming, and each link works once.
import { allowed, clientIp, markVerified } from './_lib/shared.js';
import { once } from './_lib/redis.js';
import { NOTIFY, alertHtml, readToken, send } from './_lib/mail.js';
import { hashKey, readSigned } from './_lib/crypto.js';
import { MAX_CHANNELS } from './_lib/alerts.js';
import { db, dbReady } from './_lib/db.js';
import { body } from './_lib/http.js';

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A small page with one button, styled like the sign-in confirm page, no scripts.
const confirmPage = (target, token) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Confirm alerts · Rollcfluence Shield</title><link rel="icon" href="/favicon.png">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f1ec;color:#1e1615;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(420px,calc(100% - 32px));background:#fbf9f6;border:1px solid rgba(30,22,21,.12);border-radius:18px;padding:32px;text-align:center}
img{width:48px;height:48px}h1{font-size:22px;margin:12px 0 6px}p{color:#6b625e;margin:0 0 22px}b{color:#1e1615;word-break:break-all}
button{width:100%;padding:13px 18px;border:0;border-radius:999px;background:#7d1d20;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#651619}small{display:block;margin-top:16px;color:#8a817c;font-size:13px}
</style></head><body><main>
<img src="/logo-rc.png" alt="">
<h1>Get Shield alerts?</h1>
<p>Security alerts will be sent to <b>${esc(target)}</b>.</p>
<form method="post" action="/api/verify?a=alert"><input type="hidden" name="t" value="${esc(token)}"><button type="submit">Yes, send me alerts</button></form>
<small>Did not expect this? Just close this page and nothing is sent.</small>
</main></body></html>`;

const sameSite = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return new URL(String(req.headers.origin || '')).host === host;
  } catch {
    return false;
  }
};

const confirmAlert = async (req, res) => {
  if (req.method === 'GET') {
    const token = String(req.query?.t || '');
    const data = readSigned('alert', token);
    if (!data?.target) return res.redirect(302, '/verified?state=expired');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.status(200).send(confirmPage(data.target, token));
  }
  if (!sameSite(req)) return res.redirect(303, '/verified?state=expired');
  const token = String(body(req).t || '');
  const data = readSigned('alert', token);
  if (!data?.target || !dbReady()) return res.redirect(303, '/verified?state=expired');
  if (!(await once(`used-link:${hashKey(token)}`, 3 * 86400))) return res.redirect(303, '/verified?state=used');
  try {
    if ((await db.listChannels(data.account_id)).length >= MAX_CHANNELS) return res.redirect(303, '/verified?state=error');
    await db.createChannel({ account_id: data.account_id, kind: 'email', label: data.label || null, target: data.target, target_hint: data.target, secret: null, events: data.events });
    await db.logAudit({ account_id: data.account_id, action: 'alert_added', detail: `email: ${data.target} (confirmed)` }).catch(() => {});
  } catch {
    return res.redirect(303, '/verified?state=error');
  }
  return res.redirect(303, '/verified?state=alerts');
};

export default async function handler(req, res) {
  if (req.query?.a === 'alert' && ['GET', 'POST'].includes(req.method)) return confirmAlert(req, res);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!(await allowed(clientIp(req), 'verify'))) return res.redirect(302, '/verified?state=error');
  const email = readToken(String(req.query?.t || ''));
  if (!email) return res.redirect(302, '/verified?state=expired');

  const ok = await markVerified(email);
  if (!ok) return res.redirect(302, '/verified?state=error');

  // Opening the same link again confirms again but tells the team only once.
  if (await once(`mail:verified:${email}`, 86400)) await send({ to: NOTIFY, subject: 'Early access email confirmed', html: alertHtml('Email confirmed', [['Email', email]]), replyTo: email });
  return res.redirect(302, '/verified');
}
