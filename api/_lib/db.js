// Data access for accounts, keys, provider keys and usage.
// Production talks to Supabase over its REST API with the service role key.
// ROLLC_DB=memory swaps in an in-process store, used by the local tests.
import { randomUUID } from 'node:crypto';
import { supaHeaders } from './shared.js';

const env = process.env;
const URL_ = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

// Limits every new key starts with: $10 a day, $100 a month, 60 requests a minute.
export const DEFAULT_LIMITS = { daily_cap_micros: 10_000_000, monthly_cap_micros: 100_000_000, rpm_limit: 60 };

export const dbReady = () => env.ROLLC_DB === 'memory' || Boolean(URL_ && KEY);

const KEY_COLS =
  'id,account_id,name,prefix,daily_cap_micros,monthly_cap_micros,rpm_limit,allowed_models,injection_filter,pii_redaction,ip_allowlist,blocked_countries,max_tokens,expires_at,auto_lock,suspended_at,created_at,last_used_at,revoked_at';
const EDITABLE = ['name', 'daily_cap_micros', 'monthly_cap_micros', 'rpm_limit', 'allowed_models', 'injection_filter', 'pii_redaction', 'ip_allowlist', 'blocked_countries', 'max_tokens', 'expires_at', 'auto_lock'];
const WRITABLE = [...EDITABLE, 'revoked_at', 'suspended_at'];
// Alert channels: the browser sees these columns; target and secret stay on the server.
const CHANNEL_COLS = 'id,kind,label,target_hint,events,created_at,last_sent_at,last_ok';
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

// ── Supabase REST driver ────────────────────────────────────────────────
const rest = async (method, path, body, prefer = 'return=representation') => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { ...supaHeaders(KEY), 'Content-Type': 'application/json', Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    console.error(`db ${method} ${path.split('?')[0]} failed: ${r.status}`);
    throw new Error('db_error');
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
};
const q = encodeURIComponent;

const supabase = {
  accountByEmail: async (email) => (await rest('GET', `accounts?email=eq.${q(email)}&limit=1`))[0] || null,
  accountById: async (id) => (await rest('GET', `accounts?id=eq.${q(id)}&limit=1`))[0] || null,
  upsertAccount: async (email, plan = 'starter') =>
    (await rest('POST', 'accounts?on_conflict=email', { email, plan }, 'resolution=merge-duplicates,return=representation'))[0],
  touchLogin: (id) => rest('PATCH', `accounts?id=eq.${q(id)}`, { last_login_at: new Date().toISOString() }, 'return=minimal'),

  listKeys: (accountId) => rest('GET', `gateway_keys?account_id=eq.${q(accountId)}&select=${KEY_COLS}&order=created_at.asc`),
  createKey: async (row) => (await rest('POST', `gateway_keys?select=${KEY_COLS}`, row))[0],
  updateKey: async (accountId, id, patch) =>
    (await rest('PATCH', `gateway_keys?id=eq.${q(id)}&account_id=eq.${q(accountId)}&select=${KEY_COLS}`, pick(patch, WRITABLE)))[0] || null,
  keyByHash: async (hash) => (await rest('GET', `gateway_keys?key_hash=eq.${q(hash)}&select=${KEY_COLS}&limit=1`))[0] || null,
  touchKey: (id) => rest('PATCH', `gateway_keys?id=eq.${q(id)}`, { last_used_at: new Date().toISOString() }, 'return=minimal'),

  listProviders: (accountId) => rest('GET', `provider_keys?account_id=eq.${q(accountId)}&select=provider,last4,created_at`),
  providerSecret: async (accountId, provider) =>
    (await rest('GET', `provider_keys?account_id=eq.${q(accountId)}&provider=eq.${q(provider)}&select=ciphertext&limit=1`))[0]?.ciphertext || null,
  upsertProvider: (accountId, provider, ciphertext, last4) =>
    rest('POST', 'provider_keys?on_conflict=account_id,provider', { account_id: accountId, provider, ciphertext, last4, created_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal'),
  deleteProvider: (accountId, provider) => rest('DELETE', `provider_keys?account_id=eq.${q(accountId)}&provider=eq.${q(provider)}`, undefined, 'return=minimal'),

  lockAll: (accountId, at) =>
    rest('PATCH', `gateway_keys?account_id=eq.${q(accountId)}&revoked_at=is.null&select=id`, { suspended_at: at }),

  listChannels: (accountId) => rest('GET', `alert_channels?account_id=eq.${q(accountId)}&select=${CHANNEL_COLS}&order=created_at.asc`),
  channelsFor: (accountId) => rest('GET', `alert_channels?account_id=eq.${q(accountId)}&select=id,kind,target,secret,events`),
  createChannel: async (row) => (await rest('POST', `alert_channels?select=${CHANNEL_COLS}`, row))[0],
  updateChannel: async (accountId, id, patch) =>
    (await rest('PATCH', `alert_channels?id=eq.${q(id)}&account_id=eq.${q(accountId)}&select=${CHANNEL_COLS}`, pick(patch, ['label', 'events'])))[0] || null,
  deleteChannel: async (accountId, id) => (await rest('DELETE', `alert_channels?id=eq.${q(id)}&account_id=eq.${q(accountId)}&select=id`)).length > 0,
  channelById: async (accountId, id) => (await rest('GET', `alert_channels?id=eq.${q(id)}&account_id=eq.${q(accountId)}&select=id,kind,target,secret,events&limit=1`))[0] || null,
  markChannel: (id, ok) => rest('PATCH', `alert_channels?id=eq.${q(id)}`, { last_sent_at: new Date().toISOString(), last_ok: ok }, 'return=minimal'),

  logAudit: (row) => rest('POST', 'audit_events', row, 'return=minimal'),
  listAudit: (accountId, limit = 100) => rest('GET', `audit_events?account_id=eq.${q(accountId)}&select=action,detail,created_at&order=created_at.desc&limit=${limit}`),

  insertUsage: (row) => rest('POST', 'usage_events', row, 'return=minimal'),
  usageSince: (accountId, since, limit = 5000) =>
    rest('GET', `usage_events?account_id=eq.${q(accountId)}&created_at=gte.${q(since)}&select=key_id,provider,model,status,blocked_reason,input_tokens,output_tokens,cost_micros,latency_ms,country,city,lat,lon,end_user,created_at&order=created_at.desc&limit=${limit}`),
  keySpend: async (keyId, since) => Number(await rest('POST', 'rpc/key_spend', { p_key: keyId, p_since: since })) || 0,

  waitlist: () => rest('GET', 'waitlist?select=email,goal,country,verified,created_at,approved_at&order=created_at.asc&limit=2000'),
  markApproved: (email) => rest('PATCH', `waitlist?email=eq.${q(email)}`, { approved_at: new Date().toISOString() }, 'return=minimal'),
};

// ── In-memory driver (tests) ────────────────────────────────────────────
const mem = { accounts: [], keys: [], providers: [], usage: [], waitlist: [], channels: [], audit: [] };
const strip = (k) => (k ? pick(k, KEY_COLS.split(',')) : null);
const publicChannel = (c) => pick(c, CHANNEL_COLS.split(','));
const now = () => new Date().toISOString();

const memory = {
  _state: mem,
  accountByEmail: async (email) => mem.accounts.find((a) => a.email === email) || null,
  accountById: async (id) => mem.accounts.find((a) => a.id === id) || null,
  upsertAccount: async (email, plan = 'starter') => {
    let a = mem.accounts.find((x) => x.email === email);
    if (a) a.plan = plan;
    else mem.accounts.push((a = { id: randomUUID(), email, plan, created_at: now(), last_login_at: null }));
    return a;
  },
  touchLogin: async (id) => {
    const a = mem.accounts.find((x) => x.id === id);
    if (a) a.last_login_at = now();
  },
  listKeys: async (accountId) => mem.keys.filter((k) => k.account_id === accountId).map(strip),
  createKey: async (row) => {
    const k = {
      id: randomUUID(),
      name: 'Default',
      rpm_limit: 60,
      injection_filter: true,
      pii_redaction: false,
      allowed_models: null,
      daily_cap_micros: null,
      monthly_cap_micros: null,
      ip_allowlist: null,
      blocked_countries: null,
      max_tokens: null,
      expires_at: null,
      auto_lock: true,
      suspended_at: null,
      created_at: now(),
      last_used_at: null,
      revoked_at: null,
      ...row,
    };
    mem.keys.push(k);
    return strip(k);
  },
  updateKey: async (accountId, id, patch) => {
    const k = mem.keys.find((x) => x.id === id && x.account_id === accountId);
    if (!k) return null;
    Object.assign(k, pick(patch, WRITABLE));
    return strip(k);
  },
  keyByHash: async (hash) => strip(mem.keys.find((k) => k.key_hash === hash)),
  touchKey: async (id) => {
    const k = mem.keys.find((x) => x.id === id);
    if (k) k.last_used_at = now();
  },
  listProviders: async (accountId) => mem.providers.filter((p) => p.account_id === accountId).map(({ provider, last4, created_at }) => ({ provider, last4, created_at })),
  providerSecret: async (accountId, provider) => mem.providers.find((p) => p.account_id === accountId && p.provider === provider)?.ciphertext || null,
  upsertProvider: async (accountId, provider, ciphertext, last4) => {
    mem.providers = mem.providers.filter((p) => !(p.account_id === accountId && p.provider === provider));
    mem.providers.push({ account_id: accountId, provider, ciphertext, last4, created_at: now() });
  },
  deleteProvider: async (accountId, provider) => {
    mem.providers = mem.providers.filter((p) => !(p.account_id === accountId && p.provider === provider));
  },
  lockAll: async (accountId, at) => {
    const hit = mem.keys.filter((k) => k.account_id === accountId && !k.revoked_at);
    hit.forEach((k) => (k.suspended_at = at));
    return hit.map((k) => ({ id: k.id }));
  },
  listChannels: async (accountId) => mem.channels.filter((c) => c.account_id === accountId).map(publicChannel),
  channelsFor: async (accountId) => mem.channels.filter((c) => c.account_id === accountId),
  createChannel: async (row) => {
    const c = { id: randomUUID(), label: null, created_at: now(), last_sent_at: null, last_ok: null, ...row };
    mem.channels.push(c);
    return publicChannel(c);
  },
  updateChannel: async (accountId, id, patch) => {
    const c = mem.channels.find((x) => x.id === id && x.account_id === accountId);
    if (!c) return null;
    Object.assign(c, pick(patch, ['label', 'events']));
    return publicChannel(c);
  },
  deleteChannel: async (accountId, id) => {
    const before = mem.channels.length;
    mem.channels = mem.channels.filter((c) => !(c.id === id && c.account_id === accountId));
    return mem.channels.length < before;
  },
  channelById: async (accountId, id) => mem.channels.find((c) => c.id === id && c.account_id === accountId) || null,
  markChannel: async (id, ok) => {
    const c = mem.channels.find((x) => x.id === id);
    if (c) Object.assign(c, { last_sent_at: now(), last_ok: ok });
  },
  logAudit: async (row) => mem.audit.push({ created_at: now(), ...row }),
  listAudit: async (accountId, limit = 100) =>
    mem.audit.filter((a) => a.account_id === accountId).reverse().slice(0, limit).map(({ action, detail, created_at }) => ({ action, detail, created_at })),
  insertUsage: async (row) => mem.usage.push({ created_at: now(), ...row }),
  usageSince: async (accountId, since, limit = 5000) => mem.usage.filter((u) => u.account_id === accountId && u.created_at >= since).reverse().slice(0, limit),
  keySpend: async (keyId, since) => mem.usage.filter((u) => u.key_id === keyId && u.created_at >= since).reduce((s, u) => s + (u.cost_micros || 0), 0),
  waitlist: async () => mem.waitlist,
  markApproved: async (email) => {
    const w = mem.waitlist.find((x) => x.email === email);
    if (w) w.approved_at = now();
  },
};

export const db = env.ROLLC_DB === 'memory' ? memory : supabase;
