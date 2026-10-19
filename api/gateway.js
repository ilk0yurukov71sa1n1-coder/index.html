// The Shield gateway. Customers send requests here with their rk_live_ key
// instead of their provider key. Rewritten from /v1/* in vercel.json:
//   POST /v1/chat/completions  -> OpenAI
//   POST /v1/messages          -> Anthropic
//   POST /v1/compat/chat/completions -> the customer's OpenAI-compatible provider
// Order of checks: key (revoked, locked, expired), IP allow-list, blocked
// countries, rate limit, allowed models, token ceiling, spend caps, injection
// filter, PII redaction, provider key, response cache, plan allowance, then
// forward. Every
// request, allowed or blocked, is written to usage_events so the dashboard
// can show it, and the customer's alert channels hear about the ones that matter.
import { createHash } from 'node:crypto';
import { alert } from './_lib/alerts.js';
import { decrypt, encrypt, encryptionReady, hashKey } from './_lib/crypto.js';
import { db, dbReady } from './_lib/db.js';
import { injectionScan, redact } from './_lib/filter.js';
import { ipAllowed } from './_lib/ip.js';
import { hasRequestsLeft, planOf, takeRequest } from './_lib/plans.js';
import { compatRate, isAzure } from './_lib/compat.js';
import { costMicros } from './_lib/prices.js';
import { adjust, getText, incr, incrBy, once, peek, redisReady, setText } from './_lib/redis.js';
import { resolvesPublic } from './_lib/url.js';
import { addSpend, spendSoFar } from './_lib/spend.js';

const env = process.env;
const ROUTES = {
  'chat/completions': { provider: 'openai', url: () => `${env.SHIELD_OPENAI_URL || 'https://api.openai.com'}/v1/chat/completions` },
  messages: { provider: 'anthropic', url: () => `${env.SHIELD_ANTHROPIC_URL || 'https://api.anthropic.com'}/v1/messages` },
  'compat/chat/completions': { provider: 'compat', url: (c) => `${c.base}/chat/completions` },
};

// OpenAI-style error body, which both SDKs surface readably.
const deny = (res, status, code, message) => res.status(status).json({ error: { type: 'rollcfluence_shield', code, message } });

// Requests per minute per key: Upstash when connected, memory otherwise.
const underRpm = async (keyId, limit) => (await incr(`gw:${keyId}:${Math.floor(Date.now() / 60000)}`, 70)) <= limit;

// Response cache, opt-in per request: "X-Shield-Cache: 3600" (seconds) or "on"
// (one hour). Only identical, non-streaming requests from the same account
// match. Answers are stored encrypted and expire on their own.
const CACHE_MAX_TTL = 7 * 86400;
const CACHE_MAX_BYTES = 512 * 1024;
const cacheTtl = (req) => {
  const v = String(req.headers['x-shield-cache'] || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 3600;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, CACHE_MAX_TTL) : 0;
};
const monthTag = () => new Date().toISOString().slice(0, 7);

// One end user (x-shield-user, user or metadata.user_id) with this many blocked
// injection attempts in 10 minutes is paused for 10 minutes. The key keeps
// working for everyone else, so a visitor can never switch off a customer's key.
const PAUSE_AFTER = 5;
const PAUSE_S = 600;
// Auto-lock: attempts that carry no end-user id are counted per key, and this
// many within 10 minutes locks the key. Attempts with user ids never lock it,
// since end users could then switch it off; when this many different users
// attack one key in 10 minutes, the customer is alerted to lock it themselves.
const LOCK_AFTER = 20;
const BURST_USERS = 20;
// Output tokens assumed for the spend hold when a request names no limit.
const DEFAULT_OUTPUT = 16000;

// Where the request came from, from Vercel's IP lookup headers. The IP
// itself is never stored. Requests sent from a server show the server's location.
const where = (req) => {
  const h = req.headers;
  const num = (v) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : null);
  let city = null;
  try {
    city = h['x-vercel-ip-city'] ? decodeURIComponent(String(h['x-vercel-ip-city'])).slice(0, 80) : null;
  } catch {
    city = null;
  }
  return { country: String(h['x-vercel-ip-country'] || '').slice(0, 2) || null, city, lat: num(h['x-vercel-ip-latitude']), lon: num(h['x-vercel-ip-longitude']) };
};

const presented = (req) => {
  const auth = String(req.headers.authorization || '');
  const raw = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : String(req.headers['x-api-key'] || '');
  return raw.trim();
};

// The caller's IP as Vercel saw it. Used for the allow-list check only, never stored.
const callerIp = (req) => String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0]).trim();

// Pulls token counts out of a finished JSON body or out of SSE events.
const usageFrom = (provider, obj, acc) => {
  if (!obj || typeof obj !== 'object') return;
  if ((provider === 'openai' || provider === 'compat') && obj.usage) {
    acc.input = obj.usage.prompt_tokens ?? acc.input;
    acc.output = obj.usage.completion_tokens ?? acc.output;
    acc.final = true;
  }
  if (provider === 'anthropic') {
    const u = obj.type === 'message_start' ? obj.message?.usage : obj.usage;
    if (u?.input_tokens != null) acc.input = u.input_tokens + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    if (u?.output_tokens != null) acc.output = u.output_tokens;
    // message_start carries a placeholder output count; only the final count settles the cost.
    if (u?.output_tokens != null && obj.type !== 'message_start') acc.final = true;
  }
};

// Provider error bodies can quote parts of the customer's provider key
// ("Incorrect API key provided: sk-proj-****abcd"). Only the status, the
// error type and code and a short, scrubbed message are passed on.
const KEYISH = /\b(?:sk|rk|pk|gsk|xai|key)[-_][\w*.-]*|[*.\u2026]{3,}[\w-]*|\b[\w-]*\*{2,}[\w-]*/gi;
const scrubMessage = (m) => String(m || '').replace(KEYISH, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, 300);
const shortCode = (v) => (typeof v === 'string' && /^[\w.-]{1,64}$/.test(v) ? v : null);
const providerError = (provider, status, text) => {
  let e = {};
  try {
    const j = JSON.parse(text);
    e = (j && typeof j.error === 'object' && j.error) || j || {};
  } catch {
    e = {};
  }
  const message = scrubMessage(typeof e.message === 'string' ? e.message : '') || `The provider answered with status ${status}.`;
  if (provider === 'anthropic') return { type: 'error', error: { type: shortCode(e.type) || 'api_error', message } };
  return { error: { message, type: shortCode(e.type) || 'provider_error', code: shortCode(e.code), param: shortCode(e.param) } };
};

// A Redis error while Upstash is configured: limits cannot be checked, so the request is refused.
const isRedisDown = (e) => e?.code === 'redis_unavailable';

export default async function handler(req, res) {
  try {
    return await gateway(req, res);
  } catch (e) {
    if (!isRedisDown(e) || res.headersSent) throw e;
    return deny(res, 503, 'gateway_unavailable', 'Shield rate limiting (Upstash Redis) is not answering, so requests are paused to keep your caps safe. Try again in a minute.');
  }
}

async function gateway(req, res) {
  const started = Date.now();
  const path = String(req.query?.path || '').replace(/^\/+|\/+$/g, '');
  const route = ROUTES[path];
  if (!route) return deny(res, 404, 'unknown_route', 'Shield supports POST /v1/chat/completions (OpenAI), POST /v1/messages (Anthropic) and POST /v1/compat/chat/completions (any OpenAI-compatible provider).');
  if (req.method !== 'POST') return deny(res, 405, 'method_not_allowed', 'Use POST.');
  if (!dbReady()) return deny(res, 503, 'gateway_unavailable', 'Shield storage is not connected yet.');
  // Without Redis, caps and rate limits would only count per instance, so production fails closed.
  if (env.VERCEL_ENV === 'production' && !redisReady()) return deny(res, 503, 'gateway_unavailable', 'Shield rate limiting (Upstash Redis) is not connected, so requests are paused to keep your caps safe.');

  const token = presented(req);
  if (!token.startsWith('rk_live_') || token.length > 120) return deny(res, 401, 'invalid_key', 'Send your Rollcfluence key (rk_live_...) as the API key.');

  let key;
  try {
    key = await db.keyByHash(hashKey(token));
  } catch {
    return deny(res, 502, 'gateway_unavailable', 'Shield could not reach its database. Try again.');
  }
  if (!key || key.revoked_at) return deny(res, 401, 'invalid_key', 'This key does not exist or was revoked.');

  const { provider } = route;
  let payload = typeof req.body === 'object' && req.body !== null ? req.body : null;
  const model = String(payload?.model || '').slice(0, 80);
  const origin = where(req);
  const endUser = String(req.headers['x-shield-user'] || payload?.user || payload?.metadata?.user_id || '').slice(0, 128) || null;
  const about = { key_id: key.id, key_name: key.name, model: model || null, city: origin.city, country: origin.country, end_user: endUser };
  const log = (row) =>
    db.insertUsage({ account_id: key.account_id, key_id: key.id, provider, model: model || null, latency_ms: Date.now() - started, input_tokens: 0, output_tokens: 0, cost_micros: 0, blocked_reason: null, ...origin, end_user: endUser, ...row }).catch(() => {});
  const block = async (status, code, message, event, extra = {}) => {
    await Promise.all([log({ status, blocked_reason: code }), event ? alert(key.account_id, event, { ...about, reason: code, ...extra }) : null]);
    return deny(res, status, code, message);
  };

  if (key.suspended_at) return block(403, 'key_locked', 'This key is locked. Unlock it in the Shield dashboard.');
  if (key.expires_at && new Date(key.expires_at) <= new Date()) return block(401, 'key_expired', 'This key has expired. Create a new one in the Shield dashboard.', 'key_expired');
  if (key.ip_allowlist?.length && !ipAllowed(callerIp(req), key.ip_allowlist)) {
    return block(403, 'ip_not_allowed', 'Requests from this IP address are not allowed for this key.', 'access_denied');
  }
  if (key.blocked_countries?.length && origin.country && key.blocked_countries.includes(origin.country)) {
    return block(403, 'country_blocked', 'Requests from this country are blocked for this key.', 'access_denied');
  }

  // Plan allowance, checked early so a request over it costs almost nothing.
  let account;
  try {
    account = await db.accountById(key.account_id);
  } catch {
    return deny(res, 502, 'gateway_unavailable', 'Shield could not check your plan. Try again.');
  }
  const overPlan = () => {
    const p = planOf(account);
    return block(429, 'plan_limit_reached', `Your ${p.name} plan's ${p.requests.toLocaleString('en-US')} requests for this month are used up. Upgrade in the Shield dashboard, or wait for the 1st.`);
  };
  if (account && !(await hasRequestsLeft(account))) return overPlan();

  if (!payload || !model || !Array.isArray(payload.messages)) return block(400, 'invalid_request', 'The body must be JSON with a model and messages.');
  if (!(await underRpm(key.id, key.rpm_limit))) return block(429, 'rate_limited', `This key allows ${key.rpm_limit} requests a minute.`);

  if (key.allowed_models?.length && !key.allowed_models.some((m) => model === m || model.startsWith(`${m}-`))) {
    return block(403, 'model_not_allowed', `This key is not allowed to use ${model}.`);
  }

  // Token ceiling: refuse a request that asks for more output than the key
  // allows, and set the ceiling on OpenAI requests that name no limit.
  // A body may name both limits; the larger one is what a provider could honour.
  const askedFor = (p) => Math.max(Number(p.max_completion_tokens) || 0, Number(p.max_tokens) || 0);
  if (key.max_tokens) {
    const asked = askedFor(payload);
    if (asked > key.max_tokens) return block(400, 'max_tokens_exceeded', `This key allows at most ${key.max_tokens} output tokens per request.`);
    if (!asked && provider === 'openai') payload = { ...payload, max_completion_tokens: key.max_tokens };
    if (!asked && provider === 'compat') payload = { ...payload, max_tokens: key.max_tokens };
  } else if (!askedFor(payload)) {
    // No limit anywhere: send the same ceiling the spend hold assumes, so a
    // single answer can never run past what was held against the cap.
    if (provider === 'openai') payload = { ...payload, max_completion_tokens: DEFAULT_OUTPUT };
    if (provider === 'compat') payload = { ...payload, max_tokens: DEFAULT_OUTPUT };
  }

  let today = 0;
  let month = 0;
  try {
    ({ today, month } = await spendSoFar(key));
  } catch {
    return deny(res, 502, 'gateway_unavailable', 'Shield could not check spend. Try again.');
  }
  if (key.daily_cap_micros != null && today >= key.daily_cap_micros) {
    return block(429, 'daily_cap_reached', 'This key reached its daily spend cap. It resets at 00:00 UTC.', 'cap_reached', { spent_usd: today / 1e6, cap_usd: key.daily_cap_micros / 1e6 });
  }
  if (key.monthly_cap_micros != null && month >= key.monthly_cap_micros) {
    return block(429, 'monthly_cap_reached', 'This key reached its monthly spend cap.', 'cap_reached', { spent_usd: month / 1e6, cap_usd: key.monthly_cap_micros / 1e6 });
  }

  if (key.injection_filter && endUser && (await peek(`pause:${key.id}:${endUser}`))) {
    return block(429, 'end_user_paused', 'This user is paused for a few minutes after repeated blocked requests.');
  }
  const scan = key.injection_filter ? injectionScan(payload) : { hit: false };
  if (scan.hit) {
    let lockReason = null;
    if (scan.latest && endUser) {
      const n = await incr(`inj:${key.id}:u:${endUser}`, PAUSE_S);
      // Re-set on every hit past the limit, in case one write failed.
      if (n >= PAUSE_AFTER) await once(`pause:${key.id}:${endUser}`, PAUSE_S);
      if (n === PAUSE_AFTER) await db.logAudit({ account_id: key.account_id, action: 'end_user_paused', detail: `${key.name}: user ${endUser} paused for 10 minutes after ${PAUSE_AFTER} injection attempts` }).catch(() => {});
      // Counts each user once per window, so one user's burst adds 1.
      if ((await once(`inj:${key.id}:seen:${endUser}`, 600)) && (await incr(`inj:${key.id}:users`, 600)) === BURST_USERS) {
        await Promise.all([
          db.logAudit({ account_id: key.account_id, action: 'injection_burst', detail: `${key.name}: ${BURST_USERS} different users sent injection attempts in 10 minutes` }).catch(() => {}),
          alert(key.account_id, 'injection_burst', { ...about, reason: `${BURST_USERS} different users sent injection attempts in 10 minutes. Lock the key in the dashboard if this is not expected.` }),
        ]);
      }
    } else if (scan.latest && key.auto_lock && (await incr(`inj:${key.id}`, 600)) >= LOCK_AFTER) {
      lockReason = `${LOCK_AFTER} injection attempts in 10 minutes`;
    }
    if (lockReason) {
      await db.updateKey(key.account_id, key.id, { suspended_at: new Date().toISOString() }).catch(() => {});
      await Promise.all([
        db.logAudit({ account_id: key.account_id, action: 'key_auto_locked', detail: `${key.name}: ${lockReason}` }).catch(() => {}),
        alert(key.account_id, 'key_locked', { ...about, reason: lockReason }),
      ]);
    }
    return block(400, 'prompt_injection_blocked', 'The request looks like a prompt-injection attempt and was blocked.', 'injection_blocked');
  }
  if (key.pii_redaction) {
    const r = redact(payload);
    payload = r.body;
    if (r.skipped) console.log(`pii redaction skipped ${r.skipped} oversized part(s) for key ${key.id}`);
  }

  let secret;
  let compat = null;
  try {
    const box = await db.providerSecret(key.account_id, provider);
    secret = box ? decrypt(box) : null;
    if (secret && provider === 'compat') {
      compat = JSON.parse(secret);
      secret = compat.key;
    }
  } catch {
    secret = null;
  }
  const label = { openai: 'OpenAI', anthropic: 'Anthropic', compat: 'OpenAI-compatible provider' }[provider];
  if (!secret) return block(400, 'provider_key_missing', `Add your ${label} key in the Shield dashboard first.`);

  // A customer-chosen host must still resolve to the public internet.
  if (compat && !(await resolvesPublic(new URL(compat.base)))) return block(400, 'provider_url_refused', 'The provider URL does not point to a public address.');

  // A repeat of a cached request is answered here: no provider call, no cost.
  const stream = payload.stream === true;
  const ttl = !stream && encryptionReady() ? cacheTtl(req) : 0;
  const cacheKey = ttl ? `cache:${key.account_id}:${createHash('sha256').update(JSON.stringify([provider, compat?.base || '', payload])).digest('hex')}` : null;
  if (cacheKey) {
    let hit = null;
    try {
      const box = await getText(cacheKey);
      hit = box ? JSON.parse(decrypt(box)) : null;
    } catch {
      hit = null;
    }
    if (hit) {
      if (account && !(await takeRequest(account))) return overPlan();
      const m = monthTag();
      await Promise.all([
        log({ status: 200 }),
        incr(`cachehit:${key.account_id}:${m}`, 40 * 86400),
        incrBy(`cachesave:${key.account_id}:${m}`, hit.cost || 0, 40 * 86400),
        db.touchKey(key.id).catch(() => {}),
      ]);
      res.status(200).setHeader('Content-Type', hit.type);
      res.setHeader('X-Shield-Cache', 'HIT');
      return res.send(hit.text);
    }
  }

  // Hold the most this request could cost until it finishes, so many requests
  // sent at once cannot all slip under the cap before any of them is counted.
  const compatPrice = compat && compatRate(compat);
  const price = (input, output) => (compatPrice ? Math.ceil(input * compatPrice[0] + output * compatPrice[1]) : costMicros(provider, model, input, output));
  // n answers are billed n times; system prompts and tool definitions are input too.
  const answers = Math.min(Math.max(1, Math.floor(Number(payload.n)) || 1), 128);
  const outGuess = (askedFor(payload) || key.max_tokens || DEFAULT_OUTPUT) * answers;
  const inGuess = Math.ceil(JSON.stringify([payload.messages, payload.system, payload.tools, payload.functions]).length / 3);
  const reserve = price(inGuess, outGuess);
  const holdKey = `hold:${key.id}`;
  const held = await adjust(holdKey, reserve, 600);
  let released = false;
  const release = () => {
    if (released) return null;
    released = true;
    return adjust(holdKey, -reserve, 600).catch(() => {});
  };
  const over = (spent, cap) => cap != null && spent + held > cap;
  if (over(today, key.daily_cap_micros) || over(month, key.monthly_cap_micros)) {
    await release();
    const daily = over(today, key.daily_cap_micros);
    return block(429, daily ? 'daily_cap_reached' : 'monthly_cap_reached', 'This request could pass the key\'s spend cap, counting requests still running. Lower max_tokens or wait for them to finish.', 'cap_reached', {
      spent_usd: (daily ? today : month) / 1e6,
      cap_usd: (daily ? key.daily_cap_micros : key.monthly_cap_micros) / 1e6,
    });
  }

  // Count this request against the plan; the last one in a race is refused.
  if (account && !(await takeRequest(account))) {
    await release();
    return overPlan();
  }

  if (stream && provider !== 'anthropic') payload = { ...payload, stream_options: { ...(payload.stream_options || {}), include_usage: true } };

  const headers = { 'Content-Type': 'application/json' };
  if (provider !== 'anthropic') headers.Authorization = `Bearer ${secret}`;
  if (compat && isAzure(compat.base)) headers['api-key'] = secret;
  else {
    headers['x-api-key'] = secret;
    headers['anthropic-version'] = String(req.headers['anthropic-version'] || '2023-06-01');
    if (req.headers['anthropic-beta']) headers['anthropic-beta'] = String(req.headers['anthropic-beta']);
  }

  let upstream;
  try {
    // A customer-chosen URL may not redirect us elsewhere (for example into a private network).
    upstream = await fetch(route.url(compat), { method: 'POST', headers, body: JSON.stringify(payload), redirect: compat ? 'error' : 'follow', signal: AbortSignal.timeout(290_000) });
  } catch {
    await release();
    await log({ status: 502, blocked_reason: 'provider_unreachable' });
    return deny(res, 502, 'provider_unreachable', 'The provider did not answer.');
  }

  const acc = { input: 0, output: 0, final: false };
  // Warns once when this request carries a key past 80% of a cap.
  const crossed = (before, cost, cap) => cap != null && before < cap * 0.8 && before + cost >= cap * 0.8;
  // A success with no final usage (a provider that leaves it out, or a stream
  // cut off early) is charged what was held for it, never $0.
  const charge = () => {
    if (!upstream.ok) return 0;
    if (acc.final) return price(acc.input, acc.output);
    return acc.input ? price(acc.input, outGuess) : reserve;
  };
  const finish = async () => {
    const cost = charge();
    const warn = crossed(today, cost, key.daily_cap_micros)
      ? { spent_usd: (today + cost) / 1e6, cap_usd: key.daily_cap_micros / 1e6, reason: 'daily cap' }
      : crossed(month, cost, key.monthly_cap_micros)
        ? { spent_usd: (month + cost) / 1e6, cap_usd: key.monthly_cap_micros / 1e6, reason: 'monthly cap' }
        : null;
    await Promise.all([
      log({ status: upstream.status, input_tokens: acc.input, output_tokens: acc.output, cost_micros: cost })
        .then(() => addSpend(key.id, cost).catch(() => {}))
        .finally(release),
      db.touchKey(key.id).catch(() => {}),
      warn ? alert(key.account_id, 'cap_warning', { ...about, ...warn }) : null,
    ]);
    return cost;
  };

  const type = upstream.headers.get('content-type') || 'application/json';
  if (!stream || !upstream.body || !type.includes('event-stream')) {
    const text = await upstream.text();
    try {
      usageFrom(provider, JSON.parse(text), acc);
    } catch {
      /* not JSON: nothing to count */
    }
    const cost = await finish();
    if (!upstream.ok) return res.status(upstream.status).json(providerError(provider, upstream.status, text));
    if (cacheKey && upstream.status === 200 && text.length <= CACHE_MAX_BYTES) {
      await setText(cacheKey, encrypt(JSON.stringify({ type, text, cost })), ttl).catch(() => {});
    }
    res.status(upstream.status).setHeader('Content-Type', type);
    if (cacheKey) res.setHeader('X-Shield-Cache', 'MISS');
    return res.send(text);
  }

  // Streaming: pass every chunk straight through and read usage on the way.
  res.writeHead(upstream.status, { 'Content-Type': type, 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const decoder = new TextDecoder();
  let buffer = '';
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          usageFrom(provider, JSON.parse(data), acc);
        } catch {
          /* partial or non-JSON line */
        }
      }
    }
  } catch {
    /* client or provider hung up; still record what we saw */
  }
  await finish();
  return res.end();
}
