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
    const r = await api('keys', { method: 'PATCH', body: { id: k.id, ...form, daily_cap_usd: form.daily_cap_usd === '' ? null : form.daily_cap_usd, monthly_cap_usd: form.monthly_cap_usd === '' ? null : form.monthly_cap_usd } });
    setMsg(r.ok ? 'Saved. New limits apply to the next request.' : r.error);
    if (r.ok) onChanged();
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
          <h2>{k.name}</h2>
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
        <div className="row">
          <button className="btn" type="submit">
            Save limits
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
        <KeyCard key={`${k.id}-${k.name}`} k={k} onChanged={load} />
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
