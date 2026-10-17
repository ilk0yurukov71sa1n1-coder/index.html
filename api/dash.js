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
//   POST   ?r=lock      { id, locked }  lock or unlock one key
//   POST   ?r=lockall   { locked }      panic button: lock or unlock every key
//   GET    ?r=alerts                 alert channels (never the URL or secret)
//   POST   ?r=alerts    { kind, target, label, events }   webhook secret returned once
//   PATCH  ?r=alerts    { id, label, events }
//   DELETE ?r=alerts&id=
//   POST   ?r=alerttest { id }        send a test alert to one channel
//   GET    ?r=activity               security log
//   GET    ?r=billing                plan, requests used this month, subscription state
//   POST   ?r=checkout  { plan }      Stripe Checkout URL, or switches an existing subscription
//   POST   ?r=portal                 Stripe billing portal URL (card, invoices, cancel)
//   POST   ?r=check     { answers }   Shield check: score the answers and save them
import { assess, cleanAnswers } from './_lib/assess.js';
import { checkCompat } from './_lib/compat.js';
import { resolvesPublic } from './_lib/url.js';
import { EVENTS, MAX_CHANNELS, checkTarget, deliver, newSigningSecret } from './_lib/alerts.js';
import { decrypt, encrypt, encryptionReady, isAdmin, newGatewayKey, readLiveSession } from './_lib/crypto.js';
import { DEFAULT_LIMITS, db, dbReady } from './_lib/db.js';
import { syncSubscription } from './_lib/billing.js';
import { baseUrl, body, dayStart, fail, monthStart, sameOrigin, toMicros } from './_lib/http.js';
import { cleanEntry } from './_lib/ip.js';
import { mailReady } from './_lib/mail.js';
import { PAID, PLANS, planOf, requestsThisMonth } from './_lib/plans.js';
import { getMany } from './_lib/redis.js';
import { priceFor, stripe, stripeMode, stripeReady } from './_lib/stripe.js';

const PROVIDERS = ['openai', 'anthropic', 'compat'];
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
  ip_allowlist: k.ip_allowlist || [],
  blocked_countries: k.blocked_countries || [],
  max_tokens: k.max_tokens ?? null,
  expires_at: k.expires_at ?? null,
  auto_lock: k.auto_lock !== false,
  locked: Boolean(k.suspended_at),
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
  for (const f of ['injection_filter', 'pii_redaction', 'auto_lock']) if (f in b) patch[f] = Boolean(b[f]);
  if ('ip_allowlist' in b) {
    const list = Array.isArray(b.ip_allowlist) ? b.ip_allowlist : String(b.ip_allowlist || '').split(/[\s,]+/);
    const raw = list.map((x) => String(x).trim()).filter(Boolean);
    const clean = [...new Set(raw.map(cleanEntry))];
    if (raw.length > 50 || clean.includes(null)) return { error: 'invalid_ip_allowlist' };
    patch.ip_allowlist = clean.length ? clean : null;
  }
  if ('blocked_countries' in b) {
    const list = Array.isArray(b.blocked_countries) ? b.blocked_countries : String(b.blocked_countries || '').split(/[\s,]+/);
    const clean = [...new Set(list.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
    if (clean.length > 250 || clean.some((c) => !/^[A-Z]{2}$/.test(c))) return { error: 'invalid_blocked_countries' };
    patch.blocked_countries = clean.length ? clean : null;
  }
  if ('max_tokens' in b) {
    if (b.max_tokens === null || b.max_tokens === '') patch.max_tokens = null;
    else {
      const n = Number(b.max_tokens);
      if (!Number.isInteger(n) || n < 1 || n > 1_000_000) return { error: 'invalid_max_tokens' };
      patch.max_tokens = n;
    }
  }
  if ('expires_at' in b) {
    if (b.expires_at === null || b.expires_at === '') patch.expires_at = null;
    else {
      const d = new Date(b.expires_at);
      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 864e5 || d.getTime() > Date.now() + 5 * 365 * 864e5) return { error: 'invalid_expires_at' };
      patch.expires_at = d.toISOString();
    }
  }
  return { patch };
};

// Plain-English summary of a settings change for the security log. Never includes secrets.
const describe = (patch) =>
  Object.keys(patch)
    .map((k) => k.replace(/_micros$/, '').replace(/_/g, ' '))
    .join(', ')
    .slice(0, 200);

const cleanEvents = (list) => {
  const events = [...new Set((Array.isArray(list) ? list : []).map(String))];
  return events.length && events.every((e) => e in EVENTS) ? events : null;
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
  const email = await readLiveSession(req);
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
  const audit = (action, detail) => db.logAudit({ account_id: account.id, action, detail: String(detail || '').slice(0, 300) }).catch(() => {});

  try {
    if (r === 'me' && req.method === 'GET') {
      const providers = await db.listProviders(account.id);
      const answers = account.profile ? cleanAnswers(account.profile) : null;
      return res.status(200).json({
        email,
        plan: account.plan,
        admin: isAdmin(email),
        providers: providers.map((p) => p.provider),
        encryption: encryptionReady(),
        check: answers ? { answers, ...assess(answers), at: account.profile_at || null } : null,
      });
    }

    if (r === 'check' && req.method === 'POST') {
      const answers = cleanAnswers(b.answers);
      if (!answers) return fail(res, 400, 'invalid_answers');
      const result = assess(answers);
      let saved = true;
      try {
        await db.saveProfile(account.id, answers);
      } catch {
        saved = false; // the profile column is not there yet; the report still works
      }
      if (saved) audit('check_done', `score ${result.score}`);
      return res.status(200).json({ answers, ...result, saved });
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
        if (active.length >= planOf(account).keys) return fail(res, 400, 'too_many_keys');
        const name = String(b.name || '').trim().slice(0, 60) || `Key ${active.length + 1}`;
        const { key, prefix, hash } = newGatewayKey();
        const row = await db.createKey({ account_id: account.id, name, prefix, key_hash: hash, ...DEFAULT_LIMITS });
        await audit('key_created', `${name} (${prefix}…)`);
        return res.status(201).json({ key: keyView(row), secret: key });
      }
      if (req.method === 'PATCH') {
        const { patch, error } = limitsPatch(b);
        if (error) return fail(res, 400, error);
        const row = await db.updateKey(account.id, String(b.id || ''), patch);
        if (!row) return fail(res, 404, 'not_found');
        await audit('key_updated', `${row.name}: ${describe(patch)}`);
        return res.status(200).json({ key: keyView(row) });
      }
      if (req.method === 'DELETE') {
        const row = await db.updateKey(account.id, String(req.query?.id || ''), { revoked_at: new Date().toISOString() });
        if (!row) return fail(res, 404, 'not_found');
        await audit('key_revoked', row.name);
        return res.status(200).json({ ok: true });
      }
    }

    if (r === 'lock' && req.method === 'POST') {
      const locked = Boolean(b.locked);
      const row = await db.updateKey(account.id, String(b.id || ''), { suspended_at: locked ? new Date().toISOString() : null });
      if (!row || row.revoked_at) return fail(res, 404, 'not_found');
      await audit(locked ? 'key_locked' : 'key_unlocked', row.name);
      return res.status(200).json({ key: keyView(row) });
    }

    if (r === 'lockall' && req.method === 'POST') {
      const locked = Boolean(b.locked);
      const rows = await db.lockAll(account.id, locked ? new Date().toISOString() : null);
      await audit(locked ? 'all_keys_locked' : 'all_keys_unlocked', `${rows.length} key${rows.length === 1 ? '' : 's'}`);
      return res.status(200).json({ ok: true, count: rows.length });
    }

    if (r === 'alerts') {
      if (req.method === 'GET') return res.status(200).json({ channels: await db.listChannels(account.id), events: EVENTS, email: mailReady, encryption: encryptionReady() });
      if (req.method === 'POST') {
        const kind = String(b.kind || '');
        const { target, hint, error } = checkTarget(kind, b.target);
        if (error) return fail(res, 400, error);
        const events = cleanEvents(b.events);
        if (!events) return fail(res, 400, 'invalid_events');
        const label = String(b.label || '').trim().slice(0, 60) || null;
        if ((await db.listChannels(account.id)).length >= MAX_CHANNELS) return fail(res, 400, 'too_many_channels');
        if (kind === 'email' && !mailReady) return fail(res, 503, 'email_unavailable');
        if (kind !== 'email' && !encryptionReady()) return fail(res, 503, 'encryption_unavailable');
        const secret = kind === 'webhook' ? newSigningSecret() : null;
        const row = await db.createChannel({
          account_id: account.id,
          kind,
          label,
          target: kind === 'email' ? target : encrypt(target),
          target_hint: hint,
          secret: secret ? encrypt(secret) : null,
          events,
        });
        await audit('alert_added', `${kind}: ${hint}`);
        return res.status(201).json({ channel: row, ...(secret ? { signing_secret: secret } : {}) });
      }
      if (req.method === 'PATCH') {
        const patch = {};
        if ('label' in b) patch.label = String(b.label || '').trim().slice(0, 60) || null;
        if ('events' in b) {
          patch.events = cleanEvents(b.events);
          if (!patch.events) return fail(res, 400, 'invalid_events');
        }
        const row = await db.updateChannel(account.id, String(b.id || ''), patch);
        if (!row) return fail(res, 404, 'not_found');
        await audit('alert_updated', `${row.kind}: ${row.target_hint}`);
        return res.status(200).json({ channel: row });
      }
      if (req.method === 'DELETE') {
        const ok = await db.deleteChannel(account.id, String(req.query?.id || ''));
        if (!ok) return fail(res, 404, 'not_found');
        await audit('alert_removed', '');
        return res.status(200).json({ ok: true });
      }
    }

    if (r === 'alerttest' && req.method === 'POST') {
      const ch = await db.channelById(account.id, String(b.id || ''));
      if (!ch) return fail(res, 404, 'not_found');
      const ok = await deliver(ch, 'test', { key_name: 'Example key', reason: 'This is a test. Nothing is wrong.' });
      await db.markChannel(ch.id, ok).catch(() => {});
      return ok ? res.status(200).json({ ok: true }) : fail(res, 502, 'alert_failed');
    }

    if (r === 'billing' && req.method === 'GET') {
      const plan = planOf(account);
      return res.status(200).json({
        plan: account.plan,
        plans: PLANS,
        used: Math.min(await requestsThisMonth(account.id), plan.requests ?? Infinity),
        limit: plan.requests,
        keys_limit: plan.keys,
        status: account.plan_status || null,
        renews_at: account.plan_renews_at || null,
        cancel_at_period_end: Boolean(account.plan_cancel_at_period_end),
        has_billing: Boolean(account.stripe_customer_id),
        stripe: stripeReady(),
        mode: stripeReady() ? stripeMode() : null,
      });
    }

    if (r === 'checkout' && req.method === 'POST') {
      const plan = String(b.plan || '');
      if (!PAID.includes(plan)) return fail(res, 400, 'invalid_plan');
      if (!stripeReady()) return fail(res, 503, 'billing_unavailable');
      if (account.plan === 'business') return fail(res, 400, 'plan_managed');
      if (account.plan === plan) return fail(res, 400, 'already_on_plan');
      const price = await priceFor(plan);
      // Already paying: change the existing subscription instead of starting a second one.
      if (account.stripe_subscription_id) {
        const sub = await stripe('GET', `subscriptions/${encodeURIComponent(account.stripe_subscription_id)}`);
        await stripe('POST', `subscriptions/${encodeURIComponent(sub.id)}`, {
          items: [{ id: sub.items.data[0].id, price }],
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
        });
        await syncSubscription(sub.id, account.id);
        await audit('plan_switch_requested', `${account.plan} → ${plan}`);
        return res.status(200).json({ switched: true });
      }
      const site = baseUrl(req);
      const session = await stripe('POST', 'checkout/sessions', {
        mode: 'subscription',
        line_items: [{ price, quantity: 1 }],
        client_reference_id: account.id,
        ...(account.stripe_customer_id ? { customer: account.stripe_customer_id } : { customer_email: email }),
        subscription_data: { metadata: { account_id: account.id } },
        metadata: { account_id: account.id, plan },
        billing_address_collection: 'required',
        tax_id_collection: { enabled: 'true' },
        ...(process.env.STRIPE_TAX === '1' ? { automatic_tax: { enabled: 'true' }, ...(account.stripe_customer_id ? { customer_update: { address: 'auto', name: 'auto' } } : {}) } : {}),
        success_url: `${site}/app?paid=1#billing`,
        cancel_url: `${site}/app#billing`,
      });
      await audit('checkout_started', plan);
      return res.status(200).json({ url: session.url });
    }

    if (r === 'portal' && req.method === 'POST') {
      if (!stripeReady()) return fail(res, 503, 'billing_unavailable');
      if (!account.stripe_customer_id) return fail(res, 400, 'no_billing');
      const session = await stripe('POST', 'billing_portal/sessions', { customer: account.stripe_customer_id, return_url: `${baseUrl(req)}/app#billing` });
      return res.status(200).json({ url: session.url });
    }

    if (r === 'activity' && req.method === 'GET') return res.status(200).json({ events: await db.listAudit(account.id, 200) });

    if (r === 'providers') {
      if (req.method === 'GET') {
        const providers = await db.listProviders(account.id);
        // For the OpenAI-compatible entry, show which provider it points at (never the key).
        for (const p of providers.filter((x) => x.provider === 'compat')) {
          try {
            const c = JSON.parse(decrypt(await db.providerSecret(account.id, 'compat')));
            Object.assign(p, { name: c.name, host: new URL(c.base).hostname, priced: Boolean(c.price) });
          } catch {
            /* unreadable: show it without details */
          }
        }
        return res.status(200).json({ providers, encryption: encryptionReady() });
      }
      if (req.method === 'POST') {
        const provider = String(b.provider || '');
        if (!PROVIDERS.includes(provider)) return fail(res, 400, 'invalid_provider');
        if (provider === 'compat') {
          const { config, error } = checkCompat(b);
          if (error) return fail(res, 400, error);
          if (!(await resolvesPublic(new URL(config.base)))) return fail(res, 400, 'invalid_base_url');
          if (!encryptionReady()) return fail(res, 503, 'encryption_unavailable');
          await db.upsertProvider(account.id, 'compat', encrypt(JSON.stringify(config)), config.key.slice(-4));
          await audit('provider_key_saved', `${config.name} (${new URL(config.base).hostname}) …${config.key.slice(-4)}`);
          return res.status(200).json({ ok: true });
        }
        const secret = String(b.key || '').trim();
        if (secret.length > 300 || !PROVIDER_SHAPE[provider].test(secret)) return fail(res, 400, 'invalid_provider_key');
        if (!encryptionReady()) return fail(res, 503, 'encryption_unavailable');
        await db.upsertProvider(account.id, provider, encrypt(secret), secret.slice(-4));
        await audit('provider_key_saved', `${provider} …${secret.slice(-4)}`);
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'DELETE') {
        const provider = String(req.query?.provider || '');
        if (!PROVIDERS.includes(provider)) return fail(res, 400, 'invalid_provider');
        await db.deleteProvider(account.id, provider);
        await audit('provider_key_removed', provider);
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
      if (r === 'usage') {
        // Response cache this month: answers served without calling the provider, and what they would have cost.
        const m = new Date().toISOString().slice(0, 7);
        const c = await getMany([`cachehit:${account.id}:${m}`, `cachesave:${account.id}:${m}`]);
        return res.status(200).json({ ...summarize(events, keys, days), cache: { hits: c?.[0] || 0, saved_usd: (c?.[1] || 0) / 1e6 } });
      }

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
    return fail(res, 502, e.message === 'stripe_error' ? 'billing_error' : 'storage_error');
  }

  return fail(res, 404, 'not_found');
}
