// Daily run of "Clients who return" (Vercel cron, see vercel.json).
// For every business: reminders for tomorrow, review requests after a visit,
// and "time for your next visit" when a service is due again.
// Only Vercel's cron can call it: it sends Authorization: Bearer CRON_SECRET.
import { timingSafeEqual } from 'node:crypto';
import { BUSINESSES } from './_lib/businesses.js';
import { addDays, compose, pickEmails, stopToken, todayIn } from './_lib/returns.js';
import { bookingsBetween, markSent, optoutsFor, storeReady } from './_lib/store.js';
import { mailReady, send } from './_lib/mail.js';

// A ceiling per business per run, so a bad import can never mail thousands.
export const MAX_PER_RUN = 200;
const FIELD = { reminder: 'reminded_at', review: 'review_asked_at', winback: 'winback_at' };

const authorized = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(String(req.headers?.authorization || ''));
  return want.length === got.length && timingSafeEqual(want, got);
};

export const runFor = async (biz, { now = new Date(), base, secret }) => {
  const today = todayIn(biz.tz, now);
  const rows = await bookingsBetween(biz.id, addDays(today, -100), addDays(today, 2));
  const picked = pickEmails(biz, rows, await optoutsFor(biz.id), now);
  const sent = { reminder: 0, review: 0, winback: 0, failed: 0 };
  let budget = MAX_PER_RUN;
  for (const [kind, list] of [['reminder', picked.reminders], ['review', picked.reviews], ['winback', picked.winbacks]]) {
    for (const b of list) {
      if (budget-- <= 0) return sent;
      const stopUrl = `${base}/api/stop?t=${encodeURIComponent(stopToken(secret, biz.id, b.email))}`;
      const ok = await send({ to: b.email, ...compose(kind, biz, b, stopUrl) });
      // Marked only after a successful send, so a failure is retried tomorrow.
      if (ok && (await markSent(b.id, FIELD[kind]))) sent[kind] += 1;
      else sent.failed += 1;
    }
  }
  return sent;
};

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const secret = process.env.RETURNS_SECRET;
  if (!storeReady() || !mailReady() || !secret) return res.status(503).json({ error: 'not_configured' });
  const base = process.env.PUBLIC_BASE_URL || 'https://rollcfluence.vercel.app';
  const out = {};
  for (const biz of Object.values(BUSINESSES)) {
    try {
      out[biz.id] = await runFor(biz, { base, secret });
    } catch {
      out[biz.id] = { error: 'failed' };
    }
  }
  return res.status(200).json({ ok: true, sent: out });
}
