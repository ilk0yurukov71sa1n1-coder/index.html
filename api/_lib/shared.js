// Shared helpers for the API routes. Files under api/_lib are not routes.
// Every env var is server-only. If one is missing the routes still work:
// rate limiting falls back to memory and rows are only logged.

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // fallback only, per warm instance.

const env = process.env;
const REDIS_URL = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
const REDIS_TOKEN = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
// Server-only key. Older projects have a JWT service_role key; newer ones a
// sb_secret_ key, which goes only in the apikey header (it is not a JWT).
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
export const supaHeaders = (key = SUPABASE_KEY) => (String(key).startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key });

const allowedInMemory = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length <= MAX_PER_WINDOW;
};

// Fixed-window counter in Upstash: INCR + EXPIRE in one round trip.
export const allowed = async (ip, bucket = 'waitlist') => {
  if (!REDIS_URL || !REDIS_TOKEN) return allowedInMemory(`${bucket}:${ip}`);
  try {
    const key = `rl:${bucket}:${ip}`;
    const r = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(WINDOW_MS / 1000), 'NX']]),
    });
    if (!r.ok) return allowedInMemory(`${bucket}:${ip}`);
    const [incr] = await r.json();
    return Number(incr?.result) <= MAX_PER_WINDOW;
  } catch {
    return allowedInMemory(`${bucket}:${ip}`);
  }
};

// Insert into Supabase over REST. Duplicate emails are ignored, not errors.
export const storageReady = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Returns false when the database isn't connected, so nothing is ever
// silently dropped while the visitor is told it was saved.
export const store = async (table, row) => {
  if (!storageReady) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${table === 'waitlist' ? '?on_conflict=email' : ''}`, {
    method: 'POST',
    headers: {
      ...supaHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) console.error(`${table} store failed: ${r.status}`);
  return r.ok;
};

// Mark a signup as verified. Returns true when storage isn't connected yet.
export const markVerified = async (email) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return true;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      ...supaHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ verified: true, verified_at: new Date().toISOString() }),
  });
  if (!r.ok) console.error(`verify store failed: ${r.status}`);
  return r.ok;
};

export const GOALS = ['Cap my AI spend', 'Stop leaked keys', 'Block prompt injection', 'Per-user limits', 'All of it'];


// POST + JSON + same-origin. Returns an error response or null when the request is fine.
export const guard = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return res.status(415).json({ error: 'unsupported_media_type' });
  }
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let foreign = false;
  try {
    foreign = Boolean(origin && host && new URL(origin).host !== host);
  } catch {
    foreign = true; // "null" or garbage
  }
  if (foreign) return res.status(403).json({ error: 'forbidden' });
  return null;
};

export const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
export const country = (req) => String(req.headers['x-vercel-ip-country'] || '').slice(0, 2) || null;
export const mask = (email) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
};

// Live checks for /api/health. Each one is a cheap read with a short timeout.
const ping = async (url, headers) => {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
};

export const health = async () => {
  const [storage, rateLimit] = await Promise.all([
    SUPABASE_URL && SUPABASE_KEY
      ? ping(`${SUPABASE_URL}/rest/v1/waitlist?select=id&limit=1`, supaHeaders())
      : false,
    REDIS_URL && REDIS_TOKEN ? ping(`${REDIS_URL}/ping`, { Authorization: `Bearer ${REDIS_TOKEN}` }) : false,
  ]);
  return { ok: true, storage, rateLimit, email: Boolean(env.RESEND_API_KEY), verification: Boolean(env.RESEND_API_KEY && env.VERIFY_SECRET), encryption: /^[0-9a-f]{64}$/i.test(String(env.ENCRYPTION_KEY || '')), payments: /^(sk|rk)_(test|live)_/.test(String(env.STRIPE_SECRET_KEY || '')), paymentWebhook: Boolean(env.STRIPE_WEBHOOK_SECRET), chat: Boolean(env.ANTHROPIC_API_KEY) };
};
