import { useEffect, useState } from 'react';
import { api, when } from '../api';

const LABELS = {
  key_created: 'Key created',
  key_updated: 'Key settings changed',
  key_revoked: 'Key revoked',
  key_locked: 'Key locked',
  key_unlocked: 'Key unlocked',
  key_auto_locked: 'Key locked automatically',
  all_keys_locked: 'All keys locked',
  all_keys_unlocked: 'All keys unlocked',
  alert_added: 'Alert channel added',
  alert_updated: 'Alert channel changed',
  alert_removed: 'Alert channel removed',
  provider_key_saved: 'Provider key saved',
  provider_key_removed: 'Provider key removed',
  defaults_applied: 'Safe defaults applied',
  plan_changed: 'Plan changed',
  plan_switch_requested: 'Plan change requested',
  checkout_started: 'Checkout opened',
};

const DAY = 864e5;

// Each check is a real setting the gateway enforces. Weight = how much it matters.
const checks = (keys, channels) => {
  const all = (fn) => keys.length > 0 && keys.every(fn);
  const events = new Set(channels.flatMap((c) => c.events));
  return [
    { ok: all((k) => k.daily_cap_usd != null), weight: 3, text: 'Every key has a daily spend cap', fix: '#keys' },
    { ok: all((k) => k.monthly_cap_usd != null), weight: 2, text: 'Every key has a monthly spend cap', fix: '#keys' },
    { ok: all((k) => k.injection_filter), weight: 2, text: 'Prompt-injection filter is on for every key', fix: '#keys' },
    { ok: all((k) => k.auto_lock), weight: 2, text: 'Every key locks itself after repeated attacks', fix: '#keys' },
    { ok: channels.length > 0, weight: 3, text: 'At least one alert channel is set up', fix: '#alerts' },
    { ok: events.has('cap_reached') && events.has('key_locked'), weight: 2, text: 'You are alerted when a cap is hit or a key is locked', fix: '#alerts' },
    { ok: all((k) => k.allowed_models.length > 0), weight: 1, text: 'Every key is limited to the models it needs', fix: '#keys' },
    { ok: keys.some((k) => k.ip_allowlist.length > 0), weight: 1, text: 'Server keys are restricted to your server IPs', fix: '#keys' },
    { ok: all((k) => k.max_tokens != null), weight: 1, text: 'Every key has a max output tokens ceiling', fix: '#keys' },
    { ok: all((k) => k.expires_at || Date.now() - new Date(k.created_at).getTime() < 90 * DAY), weight: 1, text: 'No key is older than 90 days without an expiry date', fix: '#keys' },
  ];
};

export default function Defense() {
  const [keys, setKeys] = useState(null);
  const [channels, setChannels] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [k, a, l] = await Promise.all([api('keys'), api('alerts'), api('activity')]);
    if (!k.ok) return setError(k.error);
    setKeys(k.data.keys.filter((x) => !x.revoked));
    setChannels(a.ok ? a.data.channels : []);
    setLog(l.ok ? l.data.events : []);
  };
  useEffect(() => {
    load();
  }, []);

  if (!keys) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const list = checks(keys, channels);
  const total = list.reduce((s, c) => s + c.weight, 0);
  const score = keys.length ? Math.round((list.reduce((s, c) => s + (c.ok ? c.weight : 0), 0) / total) * 100) : 0;
  const level = score >= 85 ? 'Strong' : score >= 60 ? 'Good' : score >= 35 ? 'Basic' : 'Weak';
  const lockedCount = keys.filter((k) => k.locked).length;

  const applyDefaults = async () => {
    setBusy(true);
    setMsg('Applying…');
    const results = await Promise.all(
      keys.map((k) =>
        api('keys', {
          method: 'PATCH',
          body: { id: k.id, daily_cap_usd: k.daily_cap_usd ?? 10, monthly_cap_usd: k.monthly_cap_usd ?? 100, injection_filter: true, auto_lock: true, max_tokens: k.max_tokens ?? 4096 },
        })
      )
    );
    const failed = results.find((r) => !r.ok);
    setMsg(failed ? failed.error : 'Done. Keys without caps now have $10 a day, $100 a month and a 4,096 token ceiling. The injection filter and auto-lock are on.');
    setBusy(false);
    load();
  };

  const lockAll = async (locked) => {
    if (locked && !window.confirm('Lock every key now? All your apps stop reaching the AI providers until you unlock them.')) return;
    setBusy(true);
    const r = await api('lockall', { method: 'POST', body: { locked } });
    setMsg(r.ok ? `${locked ? 'Locked' : 'Unlocked'} ${r.data.count} key${r.data.count === 1 ? '' : 's'}.` : r.error);
    setBusy(false);
    load();
  };

  return (
    <>
      <header className="view-head">
        <h1>Defense</h1>
        <p className="muted">How well your keys are protected, what to switch on next, and an emergency stop.</p>
      </header>

      <section className="card defense">
        <div className={`score score--${level.toLowerCase()}`} aria-label={`Defense score ${score} out of 100`}>
          <b>{score}</b>
          <span>{level}</span>
        </div>
        <div className="defense__body">
          <h2>Defense score</h2>
          <p className="muted small">Based only on settings Shield enforces on every request. {keys.length === 0 && 'Create a key to start.'}</p>
          <div className="row">
            <button className="btn" type="button" onClick={applyDefaults} disabled={busy || keys.length === 0}>
              Apply safe defaults
            </button>
            {msg && <span className="small" role="status">{msg}</span>}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Upgrade your defenses</h2>
        <ol className="steps">
          {list.map((c) => (
            <li key={c.text} className={c.ok ? 'is-done' : ''}>
              <span className="steps__dot" aria-hidden="true" />
              {c.ok ? <span>{c.text}</span> : <a href={c.fix}>{c.text}</a>}
            </li>
          ))}
        </ol>
      </section>

      <section className="card panic">
        <div>
          <h2>Emergency stop</h2>
          <p className="muted small">
            Think a key leaked? Lock every key in one click. Requests are refused at once, nothing reaches your provider, and you can unlock when it is safe. {lockedCount > 0 && <b>{lockedCount} locked now.</b>}
          </p>
        </div>
        <div className="row">
          <button className="btn btn--danger" type="button" onClick={() => lockAll(true)} disabled={busy || keys.length === 0}>
            Lock all keys
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => lockAll(false)} disabled={busy || lockedCount === 0}>
            Unlock all
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Security log</h2>
        {log.length === 0 ? (
          <p className="muted">Nothing yet. Changes to keys, alerts and provider keys show up here.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={`${e.created_at}-${i}`}>
                    <td className="small">{when(e.created_at)}</td>
                    <td className={e.action === 'key_auto_locked' ? 'accent' : ''}>{LABELS[e.action] || e.action}</td>
                    <td className="muted small">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
