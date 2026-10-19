import { useEffect, useState } from 'react';
import { api, when } from '../api';
import Dial from '../Dial';
import { RULES } from '../rules';

const LABELS = {
  key_created: 'Key created',
  key_updated: 'Key settings changed',
  key_revoked: 'Key revoked',
  key_locked: 'Key locked',
  key_unlocked: 'Key unlocked',
  key_auto_locked: 'Key locked automatically',
  end_user_paused: 'User paused after repeated attacks',
  injection_burst: 'Many users attacking one key',
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

// Protection level dial: four steps on the existing rule sets, gentlest
// first. Relaxed = 'server' (raises the rate to 120 a minute and leaves caps
// alone, for trusted backend traffic). Standard = 'safe' (the default caps
// every new key should have). Strict = 'public' (lower caps and tokens plus
// PII masking, for prompts typed by strangers). Lockdown = 'flood' (10
// requests a minute and $2 a day, the tightest setting that still answers).
// 'leak' is not a level: it locks the key, which belongs behind its own
// confirm, not on a dial.
const LEVELS = [
  ['Relaxed', 'server'],
  ['Standard', 'safe'],
  ['Strict', 'public'],
  ['Lockdown', 'flood'],
].map(([name, id]) => ({ name, rule: RULES.find((r) => r.id === id) }));

const FIELDS = {
  daily_cap_usd: ['Daily cap', (v) => (v == null ? 'none' : `$${v}`)],
  monthly_cap_usd: ['Monthly cap', (v) => (v == null ? 'none' : `$${v}`)],
  rpm_limit: ['Requests a minute', (v) => String(v)],
  max_tokens: ['Output tokens', (v) => (v == null ? 'no limit' : v.toLocaleString('en-US'))],
  injection_filter: ['Injection filter', (v) => (v ? 'on' : 'off')],
  pii_redaction: ['PII masking', (v) => (v ? 'on' : 'off')],
  auto_lock: ['Auto-lock', (v) => (v ? 'on' : 'off')],
};
// What a level would change on this key, field by field.
const changesFor = (key, rule) =>
  Object.entries(rule.patch())
    .filter(([f, v]) => FIELDS[f] && key[f] !== v)
    .map(([f, v]) => ({ f, label: FIELDS[f][0], from: FIELDS[f][1](key[f]), to: FIELDS[f][1](v) }));
// The strictest level whose settings this key already has, if any.
const levelOf = (key) => [...LEVELS].reverse().find((l) => changesFor(key, l.rule).length === 0);

// Each check is a real setting the gateway enforces. Weight = how much it matters.
const checks = (keys, channels) => {
  const all = (fn) => keys.length > 0 && keys.every(fn);
  const events = new Set(channels.flatMap((c) => c.events));
  return [
    { ok: all((k) => k.daily_cap_usd != null), weight: 3, text: 'Every key has a daily spend cap', fix: '#keys' },
    { ok: all((k) => k.monthly_cap_usd != null), weight: 2, text: 'Every key has a monthly spend cap', fix: '#keys' },
    { ok: all((k) => k.injection_filter), weight: 2, text: 'Prompt-injection filter is on for every key', fix: '#keys' },
    { ok: all((k) => k.auto_lock), weight: 2, text: 'Every key pauses repeat attackers and locks itself if attacks carry no user id', fix: '#keys' },
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
  const [target, setTarget] = useState('');
  const [ruleMsg, setRuleMsg] = useState('');
  const [pick, setPick] = useState(null);
  const [levelMsg, setLevelMsg] = useState('');

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

  const applyRule = async (rule, say = setRuleMsg) => {
    const key = keys.find((k) => k.id === target) || keys[0];
    if (!key) return;
    if (rule.lock && !window.confirm(`Lock "${key.name}" now? Apps using it stop reaching the AI provider until you unlock it.`)) return;
    setBusy(true);
    setMsg('');
    const r = rule.lock ? await api('lock', { method: 'POST', body: { id: key.id, locked: true } }) : await api('keys', { method: 'PATCH', body: { id: key.id, ...rule.patch() } });
    say(r.ok ? `${rule.title} applied to "${key.name}". ${rule.next || ''}`.trim() : r.error);
    setBusy(false);
    load();
  };

  const key = keys.find((k) => k.id === target) || keys[0];
  const current = key ? levelOf(key) : null;
  const chosen = LEVELS[(pick ?? (current ? LEVELS.indexOf(current) + 1 : 2)) - 1];
  const changes = key ? changesFor(key, chosen.rule) : [];
  const choose = (v) => {
    setPick(v);
    setLevelMsg('');
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

      <section className="card">
        <h2>Rules for every situation</h2>
        <p className="muted small">Pick a key, then apply the rule set that matches how it is used. Each one changes real settings you can still edit under Keys.</p>
        {keys.length === 0 ? (
          <p className="muted">Create a key first.</p>
        ) : (
          <>
            <label className="field rules__key">
              <span>Key</span>
              <select
                value={target || keys[0].id}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setPick(null);
                  setLevelMsg('');
                }}
              >
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.locked ? ' (locked)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="power level">
              <Dial value={LEVELS.indexOf(chosen) + 1} label={`Protection level for ${key.name}`} onChange={choose} />
              <div className="power__body">
                <span className="power__eyebrow">Protection level</span>
                <b className="power__name" role="status">
                  {chosen.name}
                </b>
                <p className="small">{chosen.rule.does}</p>
                <p className="muted small">
                  {current ? `"${key.name}" is at ${current.name} now.` : `"${key.name}" does not match a level now.`}{' '}
                  {changes.length === 0 ? 'This level would change nothing.' : 'Applying this level changes:'}
                </p>
                {changes.length > 0 && (
                  <ul className="level__changes small">
                    {changes.map((c) => (
                      <li key={c.f}>
                        <span>{c.label}</span>
                        <span>
                          <s className="muted">{c.from}</s> <span aria-hidden="true">→</span>
                          <span className="sr-only"> to </span> <b>{c.to}</b>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="row">
                  <button className="btn" type="button" onClick={() => applyRule(chosen.rule, setLevelMsg)} disabled={busy || changes.length === 0}>
                    Apply to {key.name}
                  </button>
                  {levelMsg && (
                    <span className="small" role="status">
                      {levelMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="muted small rules__or">Or pick the rule set for a specific situation:</p>
            <ul className="rules">
              {RULES.map((rule) => (
                <li key={rule.id} className={rule.lock ? 'rules__item rules__item--danger' : 'rules__item'}>
                  <div>
                    <b>{rule.title}</b>
                    <p className="small">{rule.when}</p>
                    <p className="muted small">{rule.does}</p>
                  </div>
                  <button className={`btn ${rule.lock ? 'btn--danger' : 'btn--ghost'}`} type="button" onClick={() => applyRule(rule)} disabled={busy}>
                    {rule.lock ? 'Lock key' : 'Apply'}
                  </button>
                </li>
              ))}
            </ul>
            {ruleMsg && (
              <p className="small rules__msg" role="status">
                {ruleMsg}
              </p>
            )}
          </>
        )}
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
