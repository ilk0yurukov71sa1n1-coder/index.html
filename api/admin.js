// Admin API. Only emails listed in ADMIN_EMAILS (default rollcfluence@gmail.com).
//   GET  ?r=waitlist               everyone who signed up, with their status
//   POST ?r=approve { emails: [] } let people in: account + first key + welcome email
//   POST ?r=approve { next: 100 }  the next N confirmed signups, oldest first
import { isAdmin, makeSigned, newGatewayKey, readSession } from './_lib/crypto.js';
import { DEFAULT_LIMITS, db, dbReady } from './_lib/db.js';
import { mailReady, send, welcomeEmail } from './_lib/mail.js';
import { EMAIL } from './_lib/shared.js';
import { baseUrl, body, fail, sameOrigin } from './_lib/http.js';

const INVITE_MS = 48 * 60 * 60 * 1000;

// One person: account, first key, email. The key is only ever in this email,
// so nothing is created unless email is configured.
const approveOne = async (email, base) => {
  const existing = await db.accountByEmail(email);
  const account = existing || (await db.upsertAccount(email, 'starter'));
  const active = (await db.listKeys(account.id)).filter((k) => !k.revoked_at);
  if (active.length) {
    await db.markApproved(email);
    return { email, status: 'already_has_key' };
  }
  const { key, prefix, hash } = newGatewayKey();
  const row = await db.createKey({ account_id: account.id, name: 'Default', prefix, key_hash: hash, ...DEFAULT_LIMITS });
  const login = `${base}/api/auth?a=callback&t=${encodeURIComponent(makeSigned('login', { email }, INVITE_MS))}`;
  const sent = await send({
    to: email,
    subject: 'Your Rollcfluence Shield key',
    html: welcomeEmail({ key, login, base, daily: DEFAULT_LIMITS.daily_cap_micros / 1e6, monthly: DEFAULT_LIMITS.monthly_cap_micros / 1e6, rpm: DEFAULT_LIMITS.rpm_limit }),
  });
  if (!sent) {
    // Nobody can ever see this key, so retire it and let the admin retry.
    await db.updateKey(account.id, row.id, { revoked_at: new Date().toISOString() });
    return { email, status: 'email_failed' };
  }
  await db.markApproved(email);
  return { email, status: 'sent' };
};

export default async function handler(req, res) {
  if (!dbReady()) return fail(res, 503, 'storage_unavailable');
  const me = readSession(req);
  if (!me) return fail(res, 401, 'signed_out');
  if (!isAdmin(me)) return fail(res, 403, 'not_admin');
  if (!sameOrigin(req)) return fail(res, 403, 'forbidden');
  const r = String(req.query?.r || '');

  try {
    if (r === 'waitlist' && req.method === 'GET') {
      const rows = await db.waitlist();
      return res.status(200).json({ waitlist: rows, mail: mailReady });
    }

    if (r === 'approve' && req.method === 'POST') {
      if (!mailReady) return fail(res, 503, 'email_unavailable');
      const b = body(req);
      let emails;
      if (Array.isArray(b.emails)) {
        emails = [...new Set(b.emails.map((e) => String(e).trim().toLowerCase()))].filter((e) => e.length <= 254 && EMAIL.test(e));
      } else {
        const n = Math.min(Math.max(Number(b.next) || 0, 1), 100);
        emails = (await db.waitlist()).filter((w) => w.verified && !w.approved_at).slice(0, n).map((w) => w.email);
      }
      if (!emails.length) return fail(res, 400, 'nobody_to_approve');
      if (emails.length > 100) return fail(res, 400, 'too_many');
      const base = baseUrl(req);
      const results = [];
      for (const email of emails) {
        try {
          results.push(await approveOne(email, base));
        } catch {
          results.push({ email, status: 'error' });
        }
      }
      return res.status(200).json({ results });
    }
  } catch {
    return fail(res, 502, 'storage_error');
  }
  return fail(res, 404, 'not_found');
}
