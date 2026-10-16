// The Shield gateway. Customers send requests here with their rk_live_ key
// instead of their provider key. Rewritten from /v1/* in vercel.json:
//   POST /v1/chat/completions  -> OpenAI
//   POST /v1/messages          -> Anthropic
// Order of checks: key, rate limit, allowed models, spend caps, injection
// filter, PII redaction, then forward. Every request, allowed or blocked, is
// written to usage_events so the dashboard can show it.
import { decrypt, hashKey } from './_lib/crypto.js';
import { db, dbReady } from './_lib/db.js';
import { injectionHit, redact } from './_lib/filter.js';
import { costMicros } from './_lib/prices.js';
import { dayStart, monthStart } from './_lib/http.js';

const env = process.env;
const ROUTES = {
  'chat/completions': { provider: 'openai', url: () => `${env.SHIELD_OPENAI_URL || 'https://api.openai.com'}/v1/chat/completions` },
  messages: { provider: 'anthropic', url: () => `${env.SHIELD_ANTHROPIC_URL || 'https://api.anthropic.com'}/v1/messages` },
};

// OpenAI-style error body, which both SDKs surface readably.
const deny = (res, status, code, message) => res.status(status).json({ error: { type: 'rollcfluence_shield', code, message } });

// Requests per minute per key: Upstash when connected, memory otherwise.
const REDIS_URL = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
const REDIS_TOKEN = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
const local = new Map();
const underRpm = async (keyId, limit) => {
  const slot = `gw:${keyId}:${Math.floor(Date.now() / 60000)}`;
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const r = await fetch(`${REDIS_URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', slot], ['EXPIRE', slot, '70', 'NX']]),
        signal: AbortSignal.timeout(1500),
      });
      if (r.ok) return Number((await r.json())[0]?.result) <= limit;
    } catch {
      /* fall through to memory */
    }
  }
  if (local.size > 10000) local.clear();
  local.set(slot, (local.get(slot) || 0) + 1);
  return local.get(slot) <= limit;
};

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

// Pulls token counts out of a finished JSON body or out of SSE events.
const usageFrom = (provider, obj, acc) => {
  if (!obj || typeof obj !== 'object') return;
  if (provider === 'openai' && obj.usage) {
    acc.input = obj.usage.prompt_tokens ?? acc.input;
    acc.output = obj.usage.completion_tokens ?? acc.output;
  }
  if (provider === 'anthropic') {
    const u = obj.type === 'message_start' ? obj.message?.usage : obj.usage;
    if (u?.input_tokens != null) acc.input = u.input_tokens + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    if (u?.output_tokens != null) acc.output = u.output_tokens;
  }
};

export default async function handler(req, res) {
  const started = Date.now();
  const path = String(req.query?.path || '').replace(/^\/+|\/+$/g, '');
  const route = ROUTES[path];
  if (!route) return deny(res, 404, 'unknown_route', 'Shield supports POST /v1/chat/completions (OpenAI) and POST /v1/messages (Anthropic).');
  if (req.method !== 'POST') return deny(res, 405, 'method_not_allowed', 'Use POST.');
  if (!dbReady()) return deny(res, 503, 'gateway_unavailable', 'Shield storage is not connected yet.');

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
  const log = (row) =>
    db.insertUsage({ account_id: key.account_id, key_id: key.id, provider, model: model || null, latency_ms: Date.now() - started, input_tokens: 0, output_tokens: 0, cost_micros: 0, blocked_reason: null, ...origin, end_user: endUser, ...row }).catch(() => {});
  const block = async (status, code, message) => {
    await log({ status, blocked_reason: code });
    return deny(res, status, code, message);
  };

  if (!payload || !model || !Array.isArray(payload.messages)) return block(400, 'invalid_request', 'The body must be JSON with a model and messages.');
  if (!(await underRpm(key.id, key.rpm_limit))) return block(429, 'rate_limited', `This key allows ${key.rpm_limit} requests a minute.`);

  if (key.allowed_models?.length && !key.allowed_models.some((m) => model === m || model.startsWith(`${m}-`))) {
    return block(403, 'model_not_allowed', `This key is not allowed to use ${model}.`);
  }

  try {
    const [today, month] = await Promise.all([
      key.daily_cap_micros != null ? db.keySpend(key.id, dayStart()) : 0,
      key.monthly_cap_micros != null ? db.keySpend(key.id, monthStart()) : 0,
    ]);
    if (key.daily_cap_micros != null && today >= key.daily_cap_micros) return block(429, 'daily_cap_reached', 'This key reached its daily spend cap. It resets at 00:00 UTC.');
    if (key.monthly_cap_micros != null && month >= key.monthly_cap_micros) return block(429, 'monthly_cap_reached', 'This key reached its monthly spend cap.');
  } catch {
    return deny(res, 502, 'gateway_unavailable', 'Shield could not check spend. Try again.');
  }

  if (key.injection_filter && injectionHit(payload)) return block(400, 'prompt_injection_blocked', 'The request looks like a prompt-injection attempt and was blocked.');
  if (key.pii_redaction) payload = redact(payload).body;

  let secret;
  try {
    const box = await db.providerSecret(key.account_id, provider);
    secret = box ? decrypt(box) : null;
  } catch {
    secret = null;
  }
  if (!secret) return block(400, 'provider_key_missing', `Add your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} key in the Shield dashboard first.`);

  const stream = payload.stream === true;
  if (stream && provider === 'openai') payload = { ...payload, stream_options: { ...(payload.stream_options || {}), include_usage: true } };

  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'openai') headers.Authorization = `Bearer ${secret}`;
  else {
    headers['x-api-key'] = secret;
    headers['anthropic-version'] = String(req.headers['anthropic-version'] || '2023-06-01');
    if (req.headers['anthropic-beta']) headers['anthropic-beta'] = String(req.headers['anthropic-beta']);
  }

  let upstream;
  try {
    upstream = await fetch(route.url(), { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(290_000) });
  } catch {
    await log({ status: 502, blocked_reason: 'provider_unreachable' });
    return deny(res, 502, 'provider_unreachable', 'The provider did not answer.');
  }

  const acc = { input: 0, output: 0 };
  const finish = async () => {
    const cost = upstream.ok ? costMicros(provider, model, acc.input, acc.output) : 0;
    await Promise.all([log({ status: upstream.status, input_tokens: acc.input, output_tokens: acc.output, cost_micros: cost }), db.touchKey(key.id).catch(() => {})]);
  };

  const type = upstream.headers.get('content-type') || 'application/json';
  if (!stream || !upstream.body || !type.includes('event-stream')) {
    const text = await upstream.text();
    try {
      usageFrom(provider, JSON.parse(text), acc);
    } catch {
      /* not JSON: nothing to count */
    }
    await finish();
    res.status(upstream.status).setHeader('Content-Type', type);
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
