// Tiny Upstash Redis helpers for counters and one-time flags.
// Without Upstash they fall back to memory, which only counts per warm
// instance: fine for tests, weaker in production.
const env = process.env;
const URL_ = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
const TOKEN = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;

const local = new Map(); // key -> { n, until }
const sweep = () => {
  if (local.size < 10000) return;
  const now = Date.now();
  for (const [k, v] of local) if (v.until <= now) local.delete(k);
  if (local.size > 10000) local.clear();
};

const pipeline = async (cmds) => {
  if (!URL_ || !TOKEN) return null;
  try {
    const r = await fetch(`${URL_}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(1500),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

// Adds 1 to a counter that expires `ttl` seconds after its first hit. Returns the new count.
export const incr = async (key, ttl) => {
  const out = await pipeline([['INCR', key], ['EXPIRE', key, String(ttl), 'NX']]);
  if (out) return Number(out[0]?.result) || 0;
  sweep();
  const now = Date.now();
  const cur = local.get(key);
  const next = cur && cur.until > now ? { n: cur.n + 1, until: cur.until } : { n: 1, until: now + ttl * 1000 };
  local.set(key, next);
  return next.n;
};

// True the first time it is called for `key` within `ttl` seconds, false after that.
export const once = async (key, ttl) => {
  const out = await pipeline([['SET', key, '1', 'EX', String(ttl), 'NX']]);
  if (out) return out[0]?.result === 'OK';
  sweep();
  const now = Date.now();
  const cur = local.get(key);
  if (cur && cur.until > now) return false;
  local.set(key, { n: 1, until: now + ttl * 1000 });
  return true;
};

// Current value of a counter, or 0.
export const peek = async (key) => {
  const out = await pipeline([['GET', key]]);
  if (out) return Number(out[0]?.result) || 0;
  const cur = local.get(key);
  return cur && cur.until > Date.now() ? cur.n : 0;
};

// Adds n to a counter. Returns the new value, or null when Upstash is not connected.
export const incrBy = async (key, n, ttl) => {
  const out = await pipeline([['INCRBY', key, String(Math.max(0, Math.round(n)))], ['EXPIRE', key, String(ttl), 'NX']]);
  return out ? Number(out[0]?.result) || 0 : null;
};

// Adds n (which may be negative) to a counter, with a memory fallback.
// Returns the new value. Used for spend held by requests still in flight.
export const adjust = async (key, n, ttl) => {
  const out = await pipeline([['INCRBY', key, String(Math.round(n))], ['EXPIRE', key, String(ttl)]]);
  if (out) return Number(out[0]?.result) || 0;
  sweep();
  const now = Date.now();
  const cur = local.get(key);
  const next = { n: (cur && cur.until > now ? cur.n : 0) + Math.round(n), until: now + ttl * 1000 };
  local.set(key, next);
  return next.n;
};

// Reads several counters at once. Missing ones come back as null; without Upstash the whole result is null.
export const getMany = async (keys) => {
  const out = await pipeline(keys.map((k) => ['GET', k]));
  return out ? out.map((o) => (o?.result == null ? null : Number(o.result))) : null;
};

// Sets a counter only if it does not exist yet.
export const seed = (key, n, ttl) => pipeline([['SET', key, String(Math.round(n)), 'EX', String(ttl), 'NX']]);

// Overwrites a counter.
export const setValue = (key, n, ttl) => pipeline([['SET', key, String(Math.round(n)), 'EX', String(ttl)]]);
