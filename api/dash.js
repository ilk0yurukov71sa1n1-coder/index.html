// Customer dashboard API. Every route needs the session cookie.
//   GET    ?r=me
//   GET    ?r=keys                 list keys (never the full key)
//   POST   ?r=keys      { name }    new key, full value returned once
//   PATCH  ?r=keys      { id, name, daily_cap_usd, monthly_cap_usd, rpm_limit, allowed_models, injection_filter, pii_redaction }
//   DELETE ?r=keys&id=              revoke
//   GET    ?r=providers             which provider keys are saved (last 4 only)
//   POST   ?r=providers { provider, key }
//   DELETE ?r=providers&provider=
//   GET    ?r=usage&days=30         totals, daily series, per key, per model, recent requests
//   GET    ?r=export&days=30        the same requests as CSV
//   GET    ?r=live                  the last hour of requests, with location and end user
import { encrypt, encryptionReady, isAdmin, newGatewayKey, readSession } from './_lib/crypto.js';
import { DEFAULT_LIMITS, db, dbReady } from './_lib/db.js';
import { body, dayStart, fail, monthStart, sameOrigin, toMicros } from './_lib/http.js';

const MAX_KEYS = 20;
const PROVIDERS = ['openai', 'anthropic'];
const PROVIDER_SHAPE = { openai: /^sk-[A-Za-z0-9_-]{20,}$/, anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/ };

const keyView = (k, spend) => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  daily_cap_usd: k.daily_cap_micros == null ? null : k.daily_cap_micros / 1e6,
  monthly_cap_usd: k.monthly_cap_micros == null ? null : k.monthly_cap_micros / 1e6,
  rpm_limit: k.rpm_limit,
  allowed_models: k.allowed_models || [],
  injection_filter: k.injection_filter,
  pii_redaction: k.pii_redaction,
  created_at: k.created_at,
  last_used_at: k.last_used_at,
  revoked: Boolean(k.revoked_at),
  ...(spend || {}),
});

// Validates a PATCH body into column values. Returns { patch } or { error }.
const limitsPatch = (b) => {
  const patch = {};
  if ('name' in b) {
    const name = String(b.name || '').trim();
    if (!name || name.length > 60) return { error: 'invalid_name' };
    patch.name = name;
  }
  for (const [field, col] of [['daily_cap_usd', 'daily_cap_micros'], ['monthly_cap_usd', 'monthly_cap_micros']]) {
    if (!(field in b)) continue;
    const v = toMicros(b[field]);
    if (v === undefined) return { error: `invalid_${field}` };
    patch[col] = v;
  }
  if ('rpm_limit' in b) {
    const n = Number(b.rpm_limit);
    if (!Number.isInteger(n) || n < 1 || n > 10000) return { error: 'invalid_rpm_limit' };
    patch.rpm_limit = n;
  }
  if ('allowed_models' in b) {
    const list = Array.isArray(b.allowed_models) ? b.allowed_models : String(b.allowed_models || '').split(',');
    const clean = [...new Set(list.map((m) => String(m).trim()).filter(Boolean))];
    if (clean.length > 50 || clean.some((m) => m.length > 80 || !/^[\w.:/-]+$/.test(m))) return { error: 'invalid_allowed_models' };
    patch.allowed_models = clean.length ? clean : null;
  }
  for (const f of ['injection_filter', 'pii_redaction']) if (f in b) patch[f] = Boolean(b[f]);
  return { patch };
};

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]|^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s;
};

const summarize = (events, keys, days) => {
  const byDay = new Map();
  for (let i = days - 1; i >= 0; i--) byDay.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), { day: '', requests: 0, blocked: 0, cost_usd: 0 });
  const byModel = new Map();
  const reasons = new Map();
  const totals = { requests: 0, blocked: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  for (const e of events) {
    const blocked = Boolean(e.blocked_reason);
    const cost = (e.cost_micros || 0) / 1e6;
    totals.requests++;
    totals.blocked += blocked ? 1 : 0;
    totals.input_tokens += e.input_tokens || 0;
    totals.output_tokens += e.output_tokens || 0;
    totals.cost_usd += cost;
    const d = byDay.get(String(e.created_at).slice(0, 10));
    if (d) {
      d.requests++;
      d.blocked += blocked ? 1 : 0;
      d.cost_usd += cost;
    }
    if (e.model) {
      const m = byModel.get(e.model) || { model: e.model, requests: 0, cost_usd: 0 };
      m.requests++;
      m.cost_usd += cost;
      byModel.set(e.model, m);
    }
    if (blocked) reasons.set(e.blocked_reason, (reasons.get(e.blocked_reason) || 0) + 1);
  }
  const names = Object.fromEntries(keys.map((k) => [k.id, k.name]));
  return {
    days,
    totals,
    daily: [...byDay].map(([day, v]) => ({ ...v, day })),
    models: [...byModel.values()].sort((a, b) => b.cost_usd - a.cost_usd),
    blocked_reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    recent: events.slice(0, 50).map((e) => ({ ...e, key_name: names[e.key_id] || '(deleted key)', cost_usd: (e.cost_micros || 0) / 1e6 })),
  };
};

export default async function handler(req, res) {
  if (!dbReady()) return fail(res, 503, 'storage_unavailable');
  const email = readSession(req);
  if (!email) return fail(res, 401, 'signed_out');
  if (!sameOrigin(req)) return fail(res, 403, 'forbidden');

  let account;
  try {
    account = await db.accountByEmail(email);
  } catch {
    return fail(res, 502, 'storage_error');
  }
  if (!account) return fail(res, 401, 'signed_out');
  const r = String(req.query?.r || '');
  const b = body(req);

  try {
    if (r === 'me' && req.method === 'GET') {
      const providers = await db.listProviders(account.id);
      return res.status(200).json({ email, plan: account.plan, admin: isAdmin(email), providers: providers.map((p) => p.provider), encryption: encryptionReady() });
    }

    if (r === 'keys') {
      if (req.method === 'GET') {
        const keys = await db.listKeys(account.id);
        const today = dayStart();
        const month = monthStart();
        const withSpend = await Promise.all(
          keys.map(async (k) => keyView(k, k.revoked_at ? null : { spent_today_usd: (await db.keySpend(k.id, today)) / 1e6, spent_month_usd: (await db.keySpend(k.id, month)) / 1e6 }))
        );
        return res.status(200).json({ keys: withSpend });
      }
      if (req.method === 'POST') {
        const active = (await db.listKeys(account.id)).filter((k) => !k.revoked_at);
        if (active.length >= MAX_KEYS) return fail(res, 400, 'too_many_keys');
        const name = String(b.name || '').trim().slice(0, 60) || `Key ${active.length + 1}`;
        const { key, prefix, hash } = newGatewayKey();
        const row = await db.createKey({ account_id: account.id, name, prefix, key_hash: hash, ...DEFAULT_LIMITS });
        return res.status(201).json({ key: keyView(row), secret: key });
      }
      if (req.method === 'PATCH') {
        const { patch, error } = limitsPatch(b);
        if (error) return fail(res, 400, error);
        const row = await db.updateKey(account.id, String(b.id || ''), patch);
        return row ? res.status(200).json({ key: keyView(row) }) : fail(res, 404, 'not_found');
      }
      if (req.method === 'DELETE') {
        const row = await db.updateKey(account.id, String(req.query?.id || ''), { revoked_at: new Date().toISOString() });
        return row ? res.status(200).json({ ok: true }) : fail(res, 404, 'not_found');
      }
    }

    if (r === 'providers') {
      if (req.method === 'GET') return res.status(200).json({ providers: await db.listProviders(account.id), encryption: encryptionReady() });
      if (req.method === 'POST') {
        const provider = String(b.provider || '');
        const secret = String(b.key || '').trim();
        if (!PROVIDERS.includes(provider)) return fail(res, 400, 'invalid_provider');
        if (secret.length > 300 || !PROVIDER_SHAPE[provider].test(secret)) return fail(res, 400, 'invalid_provider_key');
        if (!encryptionReady()) return fail(res, 503, 'encryption_unavailable');
        await db.upsertProvider(account.id, provider, encrypt(secret), secret.slice(-4));
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'DELETE') {
        const provider = String(req.query?.provider || '');
        if (!PROVIDERS.includes(provider)) return fail(res, 400, 'invalid_provider');
        await db.deleteProvider(account.id, provider);
        return res.status(200).json({ ok: true });
      }
    }

    // Live view: the last hour of requests with where they came from.
    if (r === 'live' && req.method === 'GET') {
      const [events, keys] = await Promise.all([db.usageSince(account.id, new Date(Date.now() - 36e5).toISOString(), 500), db.listKeys(account.id)]);
      const names = Object.fromEntries(keys.map((k) => [k.id, k.name]));
      return res.status(200).json({
        now: new Date().toISOString(),
        events: events.map((e) => ({ ...e, key_name: names[e.key_id] || '(deleted key)', cost_usd: (e.cost_micros || 0) / 1e6 })),
      });
    }

    if ((r === 'usage' || r === 'export') && req.method === 'GET') {
      const days = Math.min(Math.max(Number(req.query?.days) || 30, 1), 90);
      const since = new Date(Date.now() - (days - 1) * 864e5);
      const events = await db.usageSince(account.id, dayStart(since));
      const keys = await db.listKeys(account.id);
      if (r === 'usage') return res.status(200).json(summarize(events, keys, days));

      const names = Object.fromEntries(keys.map((k) => [k.id, k.name]));
      const head = ['time_utc', 'key', 'provider', 'model', 'status', 'blocked_reason', 'input_tokens', 'output_tokens', 'cost_usd_estimate', 'latency_ms', 'country', 'city', 'end_user'];
      const lines = events.map((e) =>
        [e.created_at, names[e.key_id] || '', e.provider, e.model, e.status, e.blocked_reason, e.input_tokens, e.output_tokens, ((e.cost_micros || 0) / 1e6).toFixed(6), e.latency_ms, e.country, e.city, e.end_user].map(csvCell).join(',')
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="shield-usage-${days}d.csv"`);
      return res.status(200).send([head.join(','), ...lines].join('\n'));
    }
  } catch (e) {
    console.error(`dash ${r} failed: ${e.message}`);
    return fail(res, 502, 'storage_error');
  }

  return fail(res, 404, 'not_found');
}
