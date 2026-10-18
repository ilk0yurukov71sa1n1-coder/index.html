import { useEffect, useState } from 'react';
import { api, usd, when } from '../api';

const toForm = (k) => ({
  name: k.name,
  daily_cap_usd: k.daily_cap_usd ?? '',
  monthly_cap_usd: k.monthly_cap_usd ?? '',
  rpm_limit: k.rpm_limit,
  allowed_models: k.allowed_models.join(', '),
  injection_filter: k.injection_filter,
  pii_redaction: k.pii_redaction,
  ip_allowlist: (k.ip_allowlist || []).join(', '),
  blocked_countries: (k.blocked_countries || []).join(', '),
  max_tokens: k.max_tokens ?? '',
  expires_at: k.expires_at ? k.expires_at.slice(0, 10) : '',
  auto_lock: k.auto_lock !== false,
});

// Empty inputs mean "off" for the optional limits.
const toBody = (id, f) => ({
  id,
  ...f,
  daily_cap_usd: f.daily_cap_usd === '' ? null : f.daily_cap_usd,
  monthly_cap_usd: f.monthly_cap_usd === '' ? null : f.monthly_cap_usd,
  max_tokens: f.max_tokens === '' ? null : Number(f.max_tokens),
  expires_at: f.expires_at === '' ? null : new Date(`${f.expires_at}T23:59:59Z`).toISOString(),
});

const Meter = ({ spent, cap, label }) => {
  const pct = cap ? Math.min(100, (spent / cap) * 100) : 0;
  return (
    <div className="meter">
      <div className="meter__top">
        <span>{label}</span>
        <span>
          {usd(spent)} of {cap == null ? 'no cap' : usd(cap)}
        </span>
      </div>
      <div className="meter__bar">
        <i style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-full' : pct >= 80 ? 'is-high' : ''} />
      </div>
    </div>
  );
};

function KeyCard({ k, onChanged }) {
  const [form, setForm] = useState(() => toForm(k));
  const [msg, setMsg] = useState('');
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setMsg('Saving…');
    const r = await api('keys', { method: 'PATCH', body: toBody(k.id, form) });
    setMsg(r.ok ? 'Saved. New limits apply to the next request.' : r.error);
    if (r.ok) onChanged();
  };
  const lock = async () => {
    const r = await api('lock', { method: 'POST', body: { id: k.id, locked: !k.locked } });
    if (!r.ok) return setMsg(r.error);
    onChanged();
  };
  const revoke = async () => {
    if (!window.confirm(`Revoke "${k.name}"? Every app using it stops working at once. This cannot be undone.`)) return;
    const r = await api('keys', { method: 'DELETE', query: `&id=${k.id}` });
    if (!r.ok) return setMsg(r.error);
    onChanged();
  };

  return (
    <section className="card key">
      <div className="key__head">
        <div>
          <h2>
            {k.name} {k.locked && <span className="pill bad">Locked</span>}
          </h2>
          <code className="muted">{k.prefix}…</code>
        </div>
        <span className="muted small">Last used: {when(k.last_used_at)}</span>
      </div>
      <Meter label="Today (resets 00:00 UTC)" spent={k.spent_today_usd} cap={k.daily_cap_usd} />
      <Meter label="This month" spent={k.spent_month_usd} cap={k.monthly_cap_usd} />

      <form className="limits" onSubmit={save}>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={set('name')} maxLength={60} required />
        </label>
        <label className="field">
          <span>Daily spend cap ($)</span>
          <input type="number" min="0" step="0.01" value={form.daily_cap_usd} onChange={set('daily_cap_usd')} placeholder="No cap" />
        </label>
        <label className="field">
          <span>Monthly spend cap ($)</span>
          <input type="number" min="0" step="0.01" value={form.monthly_cap_usd} onChange={set('monthly_cap_usd')} placeholder="No cap" />
        </label>
        <label className="field">
          <span>Requests per minute</span>
          <input type="number" min="1" max="10000" step="1" value={form.rpm_limit} onChange={set('rpm_limit')} required />
        </label>
        <label className="field field--wide">
          <span>Allowed models (empty = all)</span>
          <input value={form.allowed_models} onChange={set('allowed_models')} placeholder="gpt-4o-mini, claude-haiku-4-5" />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={form.injection_filter} onChange={set('injection_filter')} />
          <span>
            Block common prompt-injection phrases <em className="muted">(basic pattern filter)</em>
          </span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={form.pii_redaction} onChange={set('pii_redaction')} />
          <span>
            Mask emails, card numbers and phone numbers before they reach the provider
          </span>
        </label>
        <details className="defenses field--wide" open={Boolean(form.ip_allowlist || form.blocked_countries || form.max_tokens || form.expires_at)}>
          <summary>Advanced defenses</summary>
          <div className="limits">
            <label className="field field--wide">
              <span>Only allow these IP addresses (empty = any)</span>
              <input value={form.ip_allowlist} onChange={set('ip_allowlist')} placeholder="203.0.113.10, 198.51.100.0/24" />
            </label>
            <label className="field field--wide">
              <span>Block these countries (2-letter codes)</span>
              <input value={form.blocked_countries} onChange={set('blocked_countries')} placeholder="RU, KP" />
            </label>
            <label className="field">
              <span>Max output tokens per request</span>
              <input type="number" min="1" max="1000000" step="1" value={form.max_tokens} onChange={set('max_tokens')} placeholder="No limit" />
            </label>
            <label className="field">
              <span>Key stops working after</span>
              <input type="date" value={form.expires_at} onChange={set('expires_at')} />
            </label>
            <label className="toggle field--wide">
              <input type="checkbox" checked={form.auto_lock} onChange={set('auto_lock')} />
              <span>Lock this key after 20 blocked injection attempts in 10 minutes (50 if they carry user ids). A single user who sends 5 is paused for 10 minutes instead, and the key keeps working for everyone else</span>
            </label>
          </div>
        </details>
        <div className="row">
          <button className="btn" type="submit">
            Save limits
          </button>
          <button className="btn btn--ghost" type="button" onClick={lock}>
            {k.locked ? 'Unlock key' : 'Lock key'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={revoke}>
            Revoke key
          </button>
          {msg && <span className="small" role="status">{msg}</span>}
        </div>
      </form>
    </section>
  );
}

export default function Keys() {
  const [keys, setKeys] = useState(null);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState(null);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const r = await api('keys');
    if (r.ok) setKeys(r.data.keys);
    else setError(r.error);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    const r = await api('keys', { method: 'POST', body: { name } });
    if (!r.ok) return setError(r.error);
    setSecret(r.data.secret);
    setCopied(false);
    setName('');
    load();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!keys) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const active = keys.filter((k) => !k.revoked);
  const revoked = keys.filter((k) => k.revoked);

  return (
    <>
      <header className="view-head">
        <h1>Keys and limits</h1>
        <p className="muted">Give each app or environment its own key, so you can cap it and revoke it on its own. When a cap is reached, Shield answers with an error instead of calling the provider.</p>
      </header>

      {secret && (
        <section className="card reveal" role="alert">
          <h2>Copy your new key now</h2>
          <p className="muted">This is the only time it is shown. We keep only a fingerprint of it.</p>
          <div className="row">
            <code className="secret">{secret}</code>
            <button className="btn" type="button" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => setSecret(null)}>
              I saved it
            </button>
          </div>
        </section>
      )}

      <form className="card row" onSubmit={create}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="New key name, e.g. Production backend" aria-label="New key name" />
        <button className="btn" type="submit">
          Create key
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {active.length === 0 && <p className="muted">No active keys. Create one above.</p>}
      {active.map((k) => (
        <KeyCard key={`${k.id}-${k.name}-${k.locked}`} k={k} onChanged={load} />
      ))}

      {revoked.length > 0 && (
        <details className="card">
          <summary>Revoked keys ({revoked.length})</summary>
          <ul className="plain">
            {revoked.map((k) => (
              <li key={k.id}>
                {k.name} <code className="muted">{k.prefix}…</code> <span className="muted small">created {when(k.created_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
