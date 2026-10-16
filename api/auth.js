// /api/auth?a=login     POST { email }  Emails a sign-in link (customers and admins only).
// /api/auth?a=callback  GET  ?t=token   Sets the session cookie and opens /app.
// /api/auth?a=logout    POST            Clears the session.
import { EMAIL, allowed, clientIp, mask } from './_lib/shared.js';
import { loginEmail, mailReady, send } from './_lib/mail.js';
import { clearSession, isAdmin, makeSigned, readSigned, sessionReady, setSession } from './_lib/crypto.js';
import { db, dbReady } from './_lib/db.js';
import { baseUrl, body, fail, sameOrigin } from './_lib/http.js';

const LOGIN_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
  const action = String(req.query?.a || '');

  if (action === 'callback' && req.method === 'GET') {
    const data = readSigned('login', String(req.query?.t || ''));
    if (!data?.email) return res.redirect(302, '/app#expired');
    try {
      let account = await db.accountByEmail(data.email);
      if (!account && isAdmin(data.email)) account = await db.upsertAccount(data.email, 'business');
      if (!account) return res.redirect(302, '/app#expired');
      await db.touchLogin(account.id);
    } catch {
      return res.redirect(302, '/app#error');
    }
    setSession(res, data.email);
    return res.redirect(302, '/app');
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'method_not_allowed');
  }
  if (!sameOrigin(req)) return fail(res, 403, 'forbidden');

  if (action === 'logout') {
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
    if (account || isAdmin(email)) {
      const link = `${baseUrl(req)}/api/auth?a=callback&t=${encodeURIComponent(makeSigned('login', { email }, LOGIN_MS))}`;
      await send({ to: email, subject: 'Your Rollcfluence Shield sign-in link', html: loginEmail(link) });
      console.log(`login link sent: ${mask(email)}`);
    }
    return res.status(200).json({ ok: true });
  }

  return fail(res, 404, 'not_found');
}
