// Admin API. Only emails listed in ADMIN_EMAILS (default rollcfluence@gmail.com).
//   GET  ?r=waitlist               everyone who signed up, with their status
//   POST ?r=approve { emails: [] } let people in: account + first key + welcome email
//   POST ?r=approve { next: 100 }  the next N confirmed signups, oldest first
//   GET  ?r=console                setup checklist, numbers, payments, milestones, inbox
import { encryptionReady, isAdmin, makeSigned, newGatewayKey, readLiveSession } from './_lib/crypto.js';
import { dropKey, holdKey } from './_lib/reveal.js';
import { DEFAULT_LIMITS, db, dbReady } from './_lib/db.js';
import { mailReady, send, welcomeEmail } from './_lib/mail.js';
import { EMAIL } from './_lib/shared.js';
import { baseUrl, body, dayStart, fail, monthStart, sameOrigin } from './_lib/http.js';
import { health } from './_lib/shared.js';
import { stripe, stripeMode, stripeReady } from './_lib/stripe.js';
import { metrics, milestones, paymentsFrom, setupSteps } from './_lib/owner.js';

const INVITE_MS = 48 * 60 * 60 * 1000;

// A part that fails (a table not created yet, Stripe not connected) comes back
// empty instead of breaking the whole console.
const safe = (p, fallback) => Promise.resolve().then(() => p()).catch(() => fallback);

const ownerConsole = async () => {
  const month = monthStart();
  const [h, sqlBilling, sqlOnboarding, accounts, waitlist, reqMonth, blockedMonth, reqToday, firstRequest, firstBlocked, questions, feedback, invoices, failed] = await Promise.all([
    health(),
    safe(() => db.hasColumns('accounts', 'plan_status,stripe_subscription_id'), false),
    safe(() => db.hasColumns('accounts', 'profile,profile_at'), false),
    safe(() => db.allAccounts(), []),
    safe(() => db.waitlist(), []),
    safe(() => db.countUsage(month), 0),
    safe(() => db.countUsage(month, true), 0),
    safe(() => db.countUsage(dayStart()), 0),
    safe(() => db.firstUsage(), null),
    safe(() => db.firstUsage(true), null),
    safe(() => db.recent('questions', 15), []),
    safe(() => db.recent('feedback', 15), []),
    stripeReady() ? safe(async () => (await stripe('GET', 'invoices', { status: 'paid', limit: 100 })).data || [], []) : [],
    stripeReady() ? safe(async () => ((await stripe('GET', 'invoices', { status: 'open', limit: 30 })).data || []).filter((i) => i.attempt_count > 0), []) : [],
  ]);
  const numbers = metrics({ accounts, waitlist, usage: { requestsMonth: reqMonth, blockedMonth, requestsToday: reqToday } });
  const payments = paymentsFrom(invoices);
  const mode = stripeMode();
  return {
    setup: setupSteps({ health: h, sqlBilling, sqlOnboarding, stripeMode: mode }),
    numbers,
    payments: {
      connected: stripeReady(),
      mode,
      list: payments.slice(0, 50),
      total: payments.reduce((s, p) => s + p.amount, 0),
      failed: failed.map((i) => ({ id: i.id, amount: i.amount_due / 100, email: i.customer_email || null, at: new Date(i.created * 1000).toISOString() })),
    },
    milestones: milestones({ waitlist, accounts, firstRequest, firstBlocked, payments, mrr: numbers.mrr, paying: numbers.paying }),
    inbox: [
      ...questions.map((x) => ({ kind: 'question', text: x.question, email: x.email, country: x.country, at: x.created_at })),
      ...feedback.map((x) => ({ kind: 'feedback', rating: x.rating, text: x.message, email: x.email, page: x.page, at: x.created_at })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at))),
  };
};

// One person: account, first key, email. The email carries a one-time link
// that shows the key in the dashboard, never the key itself, so nothing is
// created unless email is configured.
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
  const token = await holdKey(account.id, key);
  const sent = await send({
    to: email,
    subject: 'Your Rollcfluence Shield key is ready',
    html: welcomeEmail({ reveal: `${base}/app#reveal=${token}`, login, base, daily: DEFAULT_LIMITS.daily_cap_micros / 1e6, monthly: DEFAULT_LIMITS.monthly_cap_micros / 1e6, rpm: DEFAULT_LIMITS.rpm_limit }),
  });
  if (!sent) {
    // Nobody can ever see this key, so retire it and let the admin retry.
    await dropKey(token);
    await db.updateKey(account.id, row.id, { revoked_at: new Date().toISOString() });
    return { email, status: 'email_failed' };
  }
  await db.markApproved(email);
  return { email, status: 'sent' };
};

export default async function handler(req, res) {
  if (!dbReady()) return fail(res, 503, 'storage_unavailable');
  const me = await readLiveSession(req);
  if (!me) return fail(res, 401, 'signed_out');
  if (!isAdmin(me)) return fail(res, 403, 'not_admin');
  if (!sameOrigin(req)) return fail(res, 403, 'forbidden');
  const r = String(req.query?.r || '');

  try {
    if (r === 'console' && req.method === 'GET') return res.status(200).json(await ownerConsole());

    if (r === 'waitlist' && req.method === 'GET') {
      const rows = await db.waitlist();
      return res.status(200).json({ waitlist: rows, mail: mailReady });
    }

    if (r === 'approve' && req.method === 'POST') {
      if (!mailReady) return fail(res, 503, 'email_unavailable');
      // The waiting key is stored encrypted until its owner opens it.
      if (!encryptionReady()) return fail(res, 503, 'encryption_unavailable');
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
