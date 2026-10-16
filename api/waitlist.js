// POST /api/waitlist  { email, company }
// Validates input, drops bots, rate limits per IP (Upstash when connected)
// and stores the signup in Supabase (table: waitlist).
import { EMAIL, allowed, store, guard, clientIp, country, mask } from './_lib/shared.js';

export default async function handler(req, res) {
  const blocked = guard(req, res);
  if (blocked) return blocked;

  if (!(await allowed(clientIp(req), 'waitlist'))) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const email = String(body.email || '').trim().toLowerCase();

  // Honeypot filled in: pretend success so the bot learns nothing.
  if (body.company) return res.status(200).json({ ok: true });

  if (email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  console.log(`waitlist signup: ${mask(email)}`);
  const ok = await store('waitlist', { email, source: 'landing', country: country(req) });
  if (!ok) return res.status(502).json({ error: 'storage_unavailable' });

  return res.status(200).json({ ok: true });
}
