// Demo mode (/app?demo): the real dashboard screens running on sample data
// in the browser. Nothing is sent to the server and nothing is saved.
import { assess, cleanAnswers } from '../../api/_lib/assess.js';

export const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

const keys = [
  { id: 'k1', name: 'Production backend', prefix: 'rk_live_Qx7a', daily_cap_usd: 10, monthly_cap_usd: 100, rpm_limit: 60, allowed_models: ['gpt-4o-mini', 'claude-haiku-4-5'], injection_filter: true, pii_redaction: false, ip_allowlist: ['203.0.113.0/24'], blocked_countries: [], max_tokens: 4096, expires_at: null, auto_lock: true, locked: false, created_at: iso(40 * 864e5), last_used_at: iso(6e5), revoked: false },
  { id: 'k2', name: 'Staging', prefix: 'rk_live_m3Pz', daily_cap_usd: 2, monthly_cap_usd: 20, rpm_limit: 30, allowed_models: [], injection_filter: true, pii_redaction: true, ip_allowlist: [], blocked_countries: [], max_tokens: null, expires_at: null, auto_lock: false, locked: false, created_at: iso(30 * 864e5), last_used_at: iso(36e5), revoked: false },
];
const EVENTS = {
  cap_warning: 'A key used 80% of its daily or monthly cap',
  cap_reached: 'A key hit its spend cap and was stopped',
  injection_blocked: 'A prompt-injection attempt was blocked',
  key_locked: 'A key was locked automatically',
  access_denied: 'A request came from a blocked IP or country',
  key_expired: 'Someone used an expired key',
};
const channels = [
  { id: 'c1', kind: 'email', label: 'Founder inbox', target_hint: 'demo@gmail.com', events: ['cap_warning', 'cap_reached', 'key_locked'], created_at: iso(20 * 864e5), last_sent_at: iso(2 * 864e5), last_ok: true },
  { id: 'c2', kind: 'slack', label: 'Ops channel', target_hint: 'hooks.slack.com/…x9Qa', events: ['cap_reached', 'injection_blocked', 'key_locked', 'access_denied'], created_at: iso(12 * 864e5), last_sent_at: iso(5 * 36e5), last_ok: true },
];
const audit = [
  { action: 'alert_added', detail: 'slack: Ops channel', created_at: iso(12 * 864e5) },
  { action: 'key_updated', detail: 'Production backend: ip_allowlist, max_tokens', created_at: iso(10 * 864e5) },
  { action: 'key_auto_locked', detail: 'Staging: 5 injection attempts in 10 minutes', created_at: iso(3 * 864e5) },
  { action: 'key_unlocked', detail: 'Staging', created_at: iso(3 * 864e5 - 9e5) },
];
const log = (action, detail) => audit.push({ action, detail, created_at: new Date().toISOString() });
const KEY_FIELDS = ['name', 'rpm_limit', 'injection_filter', 'pii_redaction', 'auto_lock', 'max_tokens', 'expires_at'];
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);
const providers = [{ provider: 'openai', last4: 'k9Qa', created_at: iso(39 * 864e5) }];
const reasons = ['rate_limited', 'prompt_injection_blocked', 'daily_cap_reached', 'model_not_allowed'];
const events = [];
for (let d = 89; d >= 0; d--) {
  for (let i = 0; i < 4 + Math.floor(rnd() * 14); i++) {
    const blocked = rnd() < 0.12;
    const model = rnd() < 0.7 ? 'gpt-4o-mini' : 'claude-haiku-4-5';
    const inp = Math.floor(rnd() * 3000);
    const out = Math.floor(rnd() * 900);
    events.push({
      key_id: rnd() < 0.75 ? 'k1' : 'k2',
      provider: model.startsWith('gpt') ? 'openai' : 'anthropic',
      model,
      status: blocked ? 429 : 200,
      blocked_reason: blocked ? reasons[Math.floor(rnd() * 4)] : null,
      input_tokens: blocked ? 0 : inp,
      output_tokens: blocked ? 0 : out,
      cost_micros: blocked ? 0 : Math.ceil(inp * 0.15 + out * 0.6) * 40,
      latency_ms: 300 + Math.floor(rnd() * 900),
      created_at: iso(d * 864e5 + rnd() * 3e7),
    });
  }
}
events.sort((a, b) => b.created_at.localeCompare(a.created_at));
const waitlist = [
  { email: 'ana@northwind.dev', goal: 'Cap my AI spend', country: 'DE', verified: true, created_at: iso(2 * 864e5), approved_at: null },
  { email: 'li@harbor.ai', goal: 'Stop leaked keys', country: 'SG', verified: true, created_at: iso(864e5), approved_at: null },
  { email: 'sam@tinyapps.io', goal: 'All of it', country: 'US', verified: false, created_at: iso(3e6), approved_at: null },
];

const dayStart = new Date(new Date().toISOString().slice(0, 10)).toISOString();
const monthStart = new Date().toISOString().slice(0, 8) + '01T00:00:00.000Z';
const spend = (id, since) => events.filter((e) => e.key_id === id && e.created_at >= since).reduce((s, e) => s + e.cost_micros, 0) / 1e6;

const usage = (days) => {
  const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const list = events.filter((e) => e.created_at.slice(0, 10) >= since);
  const daily = [];
  for (let i = days - 1; i >= 0; i--) daily.push({ day: new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), requests: 0, blocked: 0, cost_usd: 0 });
  const byDay = Object.fromEntries(daily.map((d) => [d.day, d]));
  const models = {};
  const why = {};
  const totals = { requests: 0, blocked: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  for (const e of list) {
    const c = e.cost_micros / 1e6;
    totals.requests++;
    totals.input_tokens += e.input_tokens;
    totals.output_tokens += e.output_tokens;
    totals.cost_usd += c;
    const d = byDay[e.created_at.slice(0, 10)];
    if (d) {
      d.requests++;
      d.cost_usd += c;
    }
    if (e.blocked_reason) {
      totals.blocked++;
      if (d) d.blocked++;
      why[e.blocked_reason] = (why[e.blocked_reason] || 0) + 1;
    }
    models[e.model] = models[e.model] || { model: e.model, requests: 0, cost_usd: 0 };
    models[e.model].requests++;
    models[e.model].cost_usd += c;
  }
  const names = Object.fromEntries(keys.map((k) => [k.id, k.name]));
  return {
    days,
    totals,
    daily,
    models: Object.values(models).sort((a, b) => b.cost_usd - a.cost_usd),
    blocked_reasons: Object.entries(why).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    recent: list.slice(0, 50).map((e) => ({ ...e, key_name: names[e.key_id], cost_usd: e.cost_micros / 1e6 })),
  };
};

// Live view sample: requests over the last hour from a few places and users.
const PLACES = [
  ['Sofia', 'BG', 42.7, 23.32], ['Berlin', 'DE', 52.52, 13.4], ['London', 'GB', 51.5, -0.12], ['New York', 'US', 40.71, -74.0],
  ['San Francisco', 'US', 37.77, -122.42], ['São Paulo', 'BR', -23.55, -46.63], ['Singapore', 'SG', 1.35, 103.82], ['Tokyo', 'JP', 35.68, 139.69],
];
const USERS = ['user_2841', 'user_1177', 'acme-support-bot', 'user_9302', null, 'checkout-assistant'];
const liveEvent = (msAgo) => {
  const [city, country, lat, lon] = PLACES[Math.floor(rnd() * PLACES.length)];
  const blocked = rnd() < 0.14;
  const model = rnd() < 0.65 ? 'gpt-4o-mini' : 'claude-haiku-4-5';
  const inp = Math.floor(rnd() * 2500);
  const out = Math.floor(rnd() * 700);
  const key = rnd() < 0.75 ? keys[0] : keys[1];
  return {
    key_id: key.id, key_name: key.name, provider: model.startsWith('gpt') ? 'openai' : 'anthropic', model,
    status: blocked ? 429 : 200, blocked_reason: blocked ? reasons[Math.floor(rnd() * 4)] : null,
    input_tokens: blocked ? 0 : inp, output_tokens: blocked ? 0 : out,
    cost_usd: blocked ? 0 : (Math.ceil(inp * 0.15 + out * 0.6) * 40) / 1e6,
    latency_ms: 300 + Math.floor(rnd() * 900), country, city, lat, lon, end_user: USERS[Math.floor(rnd() * USERS.length)],
    created_at: iso(msAgo),
  };
};
const live = [];
for (let i = 0; i < 70; i++) live.push(liveEvent(rnd() * 36e5));
live.sort((a, b) => b.created_at.localeCompare(a.created_at));

let checkAnswers = { use: 'chatbot', providers: 'both', spend: 'm', volume: 'v2', keys: 'server', callers: 'customers', origin: 'cloud', pii: 'some', incident: 'unknown' };

const ok = (data) => ({ ok: true, status: 200, data, error: null });
const bad = (error) => ({ ok: false, status: 400, data: {}, error });

export const demoApi = async (r, { method = 'GET', body, query = '' } = {}) => {
  body = body || {};
  const q = new URLSearchParams(query.replace(/^&/, ''));
  if (r === 'me') return ok({ email: 'demo@rollcfluence.com', plan: 'pro', admin: true, providers: providers.map((p) => p.provider), encryption: true, demo: true, check: { answers: checkAnswers, ...assess(checkAnswers), at: iso(40 * 864e5) } });
  if (r === 'check' && method === 'POST') {
    const answers = cleanAnswers(body.answers);
    if (!answers) return bad('Answer every question to see your report.');
    checkAnswers = answers;
    return ok({ answers, ...assess(answers), saved: true });
  }
  if (r === 'keys' && method === 'GET') return ok({ keys: keys.map((k) => (k.revoked ? k : { ...k, spent_today_usd: spend(k.id, dayStart), spent_month_usd: spend(k.id, monthStart) })) });
  if (r === 'keys' && method === 'POST') {
    const secret = `rk_live_demo_${uid()}${uid()}`;
    keys.push({ id: uid(), name: body?.name || `Key ${keys.length + 1}`, prefix: secret.slice(0, 12), daily_cap_usd: 10, monthly_cap_usd: 100, rpm_limit: 60, allowed_models: [], injection_filter: true, pii_redaction: false, ip_allowlist: [], blocked_countries: [], max_tokens: null, expires_at: null, auto_lock: true, locked: false, created_at: new Date().toISOString(), last_used_at: null, revoked: false });
    log('key_created', keys.at(-1).name);
    return ok({ secret });
  }
  if (r === 'keys' && method === 'PATCH') {
    const k = keys.find((x) => x.id === body.id);
    if ('rpm_limit' in body) {
      const rpm = Number(body.rpm_limit);
      if (!Number.isInteger(rpm) || rpm < 1 || rpm > 10000) return bad('Requests per minute must be a whole number from 1 to 10,000.');
      body = { ...body, rpm_limit: rpm };
    }
    for (const f of KEY_FIELDS) if (f in body) k[f] = body[f];
    for (const f of ['daily_cap_usd', 'monthly_cap_usd']) if (f in body) k[f] = body[f] == null || body[f] === '' ? null : Number(body[f]);
    for (const f of ['allowed_models', 'ip_allowlist']) if (f in body) k[f] = list(body[f]);
    if ('blocked_countries' in body) k.blocked_countries = list(body.blocked_countries).map((c) => c.toUpperCase());
    log('key_updated', k.name);
    return ok({ key: k });
  }
  if (r === 'keys' && method === 'DELETE') {
    keys.find((x) => x.id === q.get('id')).revoked = true;
    return ok({ ok: true });
  }
  if (r === 'lock') {
    const k = keys.find((x) => x.id === body.id);
    k.locked = Boolean(body.locked);
    log(k.locked ? 'key_locked' : 'key_unlocked', k.name);
    return ok({ key: k });
  }
  if (r === 'lockall') {
    const active = keys.filter((k) => !k.revoked && k.locked !== Boolean(body.locked));
    active.forEach((k) => (k.locked = Boolean(body.locked)));
    log(body.locked ? 'all_keys_locked' : 'all_keys_unlocked', `${active.length} keys`);
    return ok({ count: active.length });
  }
  if (r === 'alerts' && method === 'GET') return ok({ channels: channels.map((c) => ({ ...c })), events: EVENTS, email: true, encryption: true });
  if (r === 'alerts' && method === 'POST') {
    const target = String(body.target || '').trim();
    if (body.kind === 'email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target) : !/^https:\/\/[^/\s]+\.[^/\s]+\//.test(target)) return bad('That address or URL does not look right.');
    const hint = body.kind === 'email' ? target.toLowerCase() : `${new URL(target).hostname}/…${target.slice(-4)}`;
    channels.push({ id: uid(), kind: body.kind, label: body.label || '', target_hint: hint, events: body.events, created_at: new Date().toISOString(), last_sent_at: null, last_ok: null });
    log('alert_added', `${body.kind}: ${body.label || hint}`);
    return ok(body.kind === 'webhook' ? { signing_secret: `whsec_demo_${uid()}${uid()}` } : {});
  }
  if (r === 'alerts' && method === 'PATCH') {
    Object.assign(channels.find((c) => c.id === body.id), { events: body.events });
    return ok({});
  }
  if (r === 'alerts' && method === 'DELETE') {
    const i = channels.findIndex((c) => c.id === q.get('id'));
    if (i >= 0) log('alert_removed', channels.splice(i, 1)[0].kind);
    return ok({ ok: true });
  }
  if (r === 'alerttest') {
    Object.assign(channels.find((c) => c.id === body.id), { last_sent_at: new Date().toISOString(), last_ok: true });
    return ok({ ok: true });
  }
  if (r === 'billing') {
    const plans = {
      starter: { name: 'Starter', cents: 0, requests: 10000, keys: 2 },
      pro: { name: 'Pro', cents: 4900, requests: 200000, keys: 20 },
      team: { name: 'Team', cents: 29900, requests: 1250000, keys: 20 },
      scale: { name: 'Scale', cents: 79900, requests: 3500000, keys: 20 },
      business: { name: 'Business', cents: null, requests: null, keys: 20 },
    };
    return ok({ plan: 'pro', plans, used: 61840, limit: 200000, keys_limit: 20, status: 'active', renews_at: iso(-12 * 864e5), cancel_at_period_end: false, has_billing: true, stripe: true, mode: 'test' });
  }
  if (r === 'checkout' || r === 'portal') return bad('Payments are not available in the demo. Sign in for real to upgrade.');
  if (r === 'activity') return ok({ events: audit.slice().reverse() });
  if (r === 'providers' && method === 'GET') return ok({ providers, encryption: true });
  if (r === 'providers' && method === 'POST') {
    const i = providers.findIndex((p) => p.provider === body.provider);
    if (i >= 0) providers.splice(i, 1);
    providers.push({ provider: body.provider, last4: String(body.key).slice(-4), created_at: new Date().toISOString(), ...(body.provider === 'compat' ? { name: body.name || 'OpenAI-compatible', host: (() => { try { return new URL(body.base_url).hostname; } catch { return 'custom'; } })() } : {}) });
    return ok({ ok: true });
  }
  if (r === 'providers' && method === 'DELETE') {
    const i = providers.findIndex((p) => p.provider === q.get('provider'));
    if (i >= 0) providers.splice(i, 1);
    return ok({ ok: true });
  }
  if (r === 'usage') return ok(usage(Number(q.get('days')) || 30));
  if (r === 'live') {
    if (rnd() < 0.8) live.unshift(liveEvent(0));
    const cutoff = iso(36e5);
    while (live.length && live.at(-1).created_at < cutoff) live.pop();
    return ok({ now: new Date().toISOString(), events: live.slice() });
  }
  return bad('Not available in the demo.');
};

export const demoAdmin = async (r, { body } = {}) => {
  if (r === 'waitlist') return { ok: true, data: { waitlist, mail: true }, error: null };
  const emails = body?.emails || waitlist.filter((w) => w.verified && !w.approved_at).map((w) => w.email);
  emails.forEach((e) => {
    const w = waitlist.find((x) => x.email === e);
    if (w) w.approved_at = new Date().toISOString();
  });
  return { ok: true, data: { results: emails.map((email) => ({ email, status: 'sent' })) }, error: null };
};
