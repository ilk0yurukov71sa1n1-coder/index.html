// Tiny Upstash Redis helpers for counters and one-time flags.
// Without Upstash configured they fall back to memory, which only counts per
// warm instance: fine for local dev and tests, too weak for production, where
// the gateway refuses requests unless redisReady(). When Upstash IS configured
// but does not answer, incr, once, peek and adjust throw RedisDown instead of
// quietly counting per instance, so limits and one-time links fail closed.
const env = process.env;
const conf = () => [env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL, env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN];

// True when Upstash (or Vercel KV) is configured.
export const redisReady = () => conf().every(Boolean);

export class RedisDown extends Error {
  constructor() {
    super('redis_unavailable');
    this.code = 'redis_unavailable';
  }
}
// Memory is only allowed when Upstash is not configured at all.
const fallback = () => {
  if (redisReady()) throw new RedisDown();
};

const local = new Map(); // key -> { n, until }
const sweep = () => {
  if (local.size < 10000) return;
  const now = Date.now();
  for (const [k, v] of local) if (v.until <= now) local.delete(k);
  if (local.size > 10000) local.clear();
};

const pipeline = async (cmds) => {
  const [URL_, TOKEN] = conf();
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
  fallback();
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
  fallback();
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
  fallback();
  const cur = local.get(key);
  return cur && cur.until > Date.now() ? cur.n : 0;
};

// Adds n to a counter. Returns the new value, or null when Upstash is not connected.
export const incrBy = async (key, n, ttl) => {
  const out = await pipeline([['INCRBY', key, String(Math.max(0, Math.round(n)))], ['EXPIRE', key, String(ttl), 'NX']]);
  return out ? Number(out[0]?.result) || 0 : null;
};

// Adds n (which may be negative) to a counter, with a memory fallback when Upstash is not configured.
// Returns the new value. Used for spend held by requests still in flight.
export const adjust = async (key, n, ttl) => {
  const out = await pipeline([['INCRBY', key, String(Math.round(n))], ['EXPIRE', key, String(ttl)]]);
  if (out) return Number(out[0]?.result) || 0;
  fallback();
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

// Text values (the response cache). Memory fallback keeps a small number per warm instance.
const texts = new Map(); // key -> { v, until }
export const getText = async (key) => {
  const out = await pipeline([['GET', key]]);
  if (out) return out[0]?.result ?? null;
  const cur = texts.get(key);
  return cur && cur.until > Date.now() ? cur.v : null;
};
export const setText = async (key, value, ttl) => {
  const out = await pipeline([['SET', key, String(value), 'EX', String(ttl)]]);
  if (out) return;
  if (texts.size > 500) texts.clear();
  texts.set(key, { v: String(value), until: Date.now() + ttl * 1000 });
};

// Runs raw commands for Bill Guard (hashes). Upstash when configured; when it is
// configured but down this throws RedisDown. Without Upstash a small memory
// version of the same commands runs, for local dev and tests.
const hashes = new Map(); // key -> { h: Map, until }
const live = (key) => {
  const cur = hashes.get(key);
  if (cur && cur.until > Date.now()) return cur;
  hashes.delete(key);
  return null;
};
const memRun = ([cmd, key, ...a]) => {
  if (hashes.size > 20000) hashes.clear();
  const cur = live(key);
  if (cmd === 'HINCRBY') {
    const e = cur || { h: new Map(), until: Infinity };
    e.h.set(a[0], (Number(e.h.get(a[0])) || 0) + Number(a[1]));
    hashes.set(key, e);
    return e.h.get(a[0]);
  }
  if (cmd === 'HSETNX') {
    const e = cur || { h: new Map(), until: Infinity };
    if (e.h.has(a[0])) return 0;
    e.h.set(a[0], a[1]);
    hashes.set(key, e);
    return 1;
  }
  if (cmd === 'HGETALL') return cur ? [...cur.h].flat().map(String) : [];
  if (cmd === 'HLEN') return cur ? cur.h.size : 0;
  if (cmd === 'HGET') return cur && cur.h.has(a[0]) ? String(cur.h.get(a[0])) : null;
  if (cmd === 'EXPIRE') {
    if (cur) cur.until = Date.now() + Number(a[0]) * 1000;
    return cur ? 1 : 0;
  }
  if (cmd === 'DEL') return hashes.delete(key) ? 1 : 0;
  if (cmd === 'GET') return cur && 'v' in cur ? cur.v : null;
  if (cmd === 'SET') {
    hashes.set(key, { v: String(a[0]), h: new Map(), until: a[1] === 'EX' ? Date.now() + Number(a[2]) * 1000 : Infinity });
    return 'OK';
  }
  throw new Error(`unsupported: ${cmd}`);
};
export const exec = async (cmds) => {
  if (!cmds.length) return [];
  const out = await pipeline(cmds);
  if (out) return out.map((o) => o?.result ?? null);
  fallback();
  return cmds.map(memRun);
};
