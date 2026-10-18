// /api/auth?a=login     POST { email }  Emails a sign-in link (customers and admins only).
// /api/auth?a=callback  GET  ?t=token   Shows "Sign in as …?" with one button.
// /api/auth?a=callback  POST t=token     Sets the session cookie and opens /app.
//   The extra click means a link someone else sends you cannot sign you in to
//   their account behind your back, and each link works only once.
// /api/auth?a=logout    POST            Clears the session.
import { EMAIL, allowed, clientIp, mask } from './_lib/shared.js';
import { loginEmail, mailReady, send } from './_lib/mail.js';
import { clearSession, endAllSessions, hashKey, isAdmin, makeSigned, readLiveSession, readSigned, sessionReady, setSession } from './_lib/crypto.js';
import { once } from './_lib/redis.js';
import { db, dbReady } from './_lib/db.js';
import { baseUrl, body, fail, sameOrigin } from './_lib/http.js';

const LOGIN_MS = 15 * 60 * 1000;

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A small page with one button, styled like the site, no scripts.
const confirmPage = (email, token) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Sign in · Rollcfluence Shield</title><link rel="icon" href="/favicon.png">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f1ec;color:#1e1615;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(420px,calc(100% - 32px));background:#fbf9f6;border:1px solid rgba(30,22,21,.12);border-radius:18px;padding:32px;text-align:center}
img{width:48px;height:48px}h1{font-size:22px;margin:12px 0 6px}p{color:#6b625e;margin:0 0 22px}b{color:#1e1615;word-break:break-all}
button{width:100%;padding:13px 18px;border:0;border-radius:999px;background:#7d1d20;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#651619}small{display:block;margin-top:16px;color:#8a817c;font-size:13px}
</style></head><body><main>
<img src="/logo-rc.png" alt="">
<h1>Sign in to Shield</h1>
<p>You are signing in as <b>${esc(email)}</b>.</p>
<form method="post" action="/api/auth?a=callback"><input type="hidden" name="t" value="${esc(token)}"><button type="submit">Continue to the dashboard</button></form>
<small>Not you, or did not ask for this link? Just close this page.</small>
</main></body></html>`;

export default async function handler(req, res) {
  const action = String(req.query?.a || '');

  if (action === 'callback' && req.method === 'GET') {
    const token = String(req.query?.t || '');
    const data = readSigned('login', token);
    if (!data?.email) return res.redirect(302, '/app#expired');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // same-origin, not no-referrer: with no-referrer browsers send Origin: null
    // on the confirm POST, and the same-site check below would refuse it.
    res.setHeader('Referrer-Policy', 'same-origin');
    return res.status(200).send(confirmPage(data.email, token));
  }

  if (action === 'callback' && req.method === 'POST') {
    const origin = String(req.headers.origin || '');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let ours = false;
    try {
      ours = new URL(origin).host === host;
    } catch {
      ours = false;
    }
    if (!ours && req.headers['sec-fetch-site'] !== 'same-origin') return res.redirect(303, '/app#expired');
    const token = String(body(req).t || '');
    const data = readSigned('login', token);
    if (!data?.email) return res.redirect(303, '/app#expired');
    if (!(await once(`used-link:${hashKey(token)}`, 3 * 86400))) return res.redirect(303, '/app#used');
    try {
      let account = await db.accountByEmail(data.email);
      if (!account && isAdmin(data.email)) account = await db.upsertAccount(data.email, 'business');
      if (!account) return res.redirect(303, '/app#expired');
      await db.touchLogin(account.id);
    } catch {
      return res.redirect(303, '/app#error');
    }
    setSession(res, data.email);
    return res.redirect(303, '/app');
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'method_not_allowed');
  }
  if (!sameOrigin(req)) return fail(res, 403, 'forbidden');

  if (action === 'logout') {
    const email = await readLiveSession(req);
    if (email) await endAllSessions(email);
    clearSession(res);
    return res.status(200).json({ ok: true });
  }

  if (action === 'login') {
    if (!dbReady() || !mailReady || !sessionReady()) return fail(res, 503, 'login_unavailable');
    if (!(await allowed(clientIp(req), 'login'))) return fail(res, 429, 'too_many_requests');
    const email = String(body(req).email || '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) return fail(res, 400, 'invalid_email');

    // Same answer whether or not the email has an account, so the form
    // can't be used to find out who our customers are.
    const account = await db.accountByEmail(email).catch(() => null);
    if ((account || isAdmin(email)) && (await once(`mail:login:${email}`, 60))) {
      const link = `${baseUrl(req)}/api/auth?a=callback&t=${encodeURIComponent(makeSigned('login', { email }, LOGIN_MS))}`;
      await send({ to: email, subject: 'Your Rollcfluence Shield sign-in link', html: loginEmail(link) });
      console.log(`login link sent: ${mask(email)}`);
    }
    return res.status(200).json({ ok: true });
  }

  return fail(res, 404, 'not_found');
}
