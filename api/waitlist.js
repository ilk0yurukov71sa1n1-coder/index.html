// POST /api/waitlist  { email, company }
// Serverless function on Vercel. Validates input, drops bots, rate limits per IP.
// Storage is not wired yet: see README "Next steps".

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // best-effort, per warm instance. Pair with a Vercel Firewall rate-limit rule.

const allowed = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length <= MAX_PER_WINDOW;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return res.status(415).json({ error: 'unsupported_media_type' });
  }

  // Same-origin only: reject posts from other sites.
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host && new URL(origin).host !== host) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!allowed(ip)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const email = String(body.email || '').trim().toLowerCase();
  const company = String(body.company || '');

  // Honeypot filled in: pretend success so the bot learns nothing.
  if (company) return res.status(200).json({ ok: true });

  if (email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  // Masked so logs never hold a full address.
  const [user, domain] = email.split('@');
  console.log(`waitlist signup: ${user.slice(0, 2)}***@${domain}`);

  return res.status(200).json({ ok: true });
}
