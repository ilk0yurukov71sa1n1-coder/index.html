import { useEffect, useState } from 'react';
import { api, usd } from '../api';
import { QUESTIONS } from '../../../api/_lib/assess.js';

const PLAN_NAMES = { starter: 'Starter', pro: 'Pro', team: 'Team', scale: 'Scale', business: 'Business' };
const PLAN_ORDER = ['starter', 'pro', 'team', 'scale', 'business'];
// Monthly price in euros, same as the pricing page. Business shows its floor.
const PRICE = { starter: 0, pro: 49, team: 299, scale: 799, business: 1500 };
const GRADE = { low: 'Low risk', medium: 'Medium risk', high: 'High risk', critical: 'Critical risk' };

// The setup list, built from the report and ticked off from the account's real state.
const buildSteps = (check, me, keys, channels) => {
  const s = check.settings;
  const live = keys.filter((k) => !k.revoked);
  const any = (fn) => live.some(fn);
  const steps = [];
  if (s.rotate) steps.push({ id: 'rotate', text: 'Rotate your old provider key at the provider, then use the new one only in Shield.', manual: true });
  steps.push({ id: 'provider', text: 'Add your provider key to Shield', href: '#providers', done: me.providers.length > 0 });
  steps.push({ id: 'key', text: 'Create a Shield key for your app', href: '#keys', done: live.length > 0 });
  steps.push({
    id: 'caps',
    text: `Set a daily cap of ${usd(s.daily_cap_usd, 0)}${s.monthly_cap_usd ? ` and a monthly cap of ${usd(s.monthly_cap_usd, 0)}` : ' and a monthly cap at your budget'}`,
    href: '#keys',
    done: any((k) => k.daily_cap_usd != null && k.daily_cap_usd <= s.daily_cap_usd),
  });
  steps.push({ id: 'rpm', text: `Limit each key to ${s.rpm_limit} requests a minute`, href: '#keys', done: any((k) => k.rpm_limit <= s.rpm_limit) });
  if (s.max_tokens) steps.push({ id: 'tokens', text: `Set max output tokens to ${s.max_tokens.toLocaleString('en-US')}`, href: '#keys', done: any((k) => k.max_tokens != null && k.max_tokens <= s.max_tokens) });
  if (s.pii_redaction) steps.push({ id: 'pii', text: 'Turn on PII masking', href: '#keys', done: any((k) => k.pii_redaction) });
  if (s.ip_allowlist) steps.push({ id: 'ip', text: 'Add your server IPs to the IP allow-list', href: '#keys', done: any((k) => k.ip_allowlist.length > 0) });
  if (s.block_countries) steps.push({ id: 'geo', text: 'Block countries you do not serve', href: '#keys', done: any((k) => k.blocked_countries.length > 0) });
  steps.push({ id: 'alerts', text: 'Add an alert channel (email, Slack, Discord or webhook)', href: '#alerts', done: channels.length > 0 });
  if (check.plan !== 'starter') {
    const enough = PLAN_ORDER.indexOf(me.plan) >= PLAN_ORDER.indexOf(check.plan);
    steps.push({ id: 'plan', text: `Move to the ${PLAN_NAMES[check.plan]} plan so your traffic is covered`, href: '#billing', done: enough });
  }
  return steps;
};

const SOURCES = {
  register: 'https://theregister.com/2026/03/03/gemini_api_key_82314_dollar_charge/',
  sysdig: 'https://www.sysdig.com/blog/llmjacking-stolen-cloud-credentials-used-in-new-ai-attack',
  gitguardian: 'https://blog.gitguardian.com/ai-secrets-spread-fast/',
};

// Why it pays: public incident numbers next to this team's own cap and plan price.
function WhyItPays({ check }) {
  const cap = check.settings.daily_cap_usd;
  const price = PRICE[check.plan];
  const perDay = 82314 / 2; // The Register case: about $82,314 in about two days
  return (
    <section className="card check-why">
      <h2>Why it pays for itself</h2>
      <div className="check-why__figs">
        <div>
          <b>$82,314</b>
          <span>
            run up in about two days on one stolen key, by a startup that normally spent about $180 a month.{' '}
            <a href={SOURCES.register} target="_blank" rel="noopener noreferrer">The Register, 2026</a>
          </span>
        </div>
        <div>
          <b>$46,000 a day</b>
          <span>
            is what attackers can burn on a fully abused AI account.{' '}
            <a href={SOURCES.sysdig} target="_blank" rel="noopener noreferrer">Sysdig, 2024</a>
          </span>
        </div>
        <div>
          <b>1.27M</b>
          <span>
            AI keys leaked on public GitHub in 2025, up 81% in a year.{' '}
            <a href={SOURCES.gitguardian} target="_blank" rel="noopener noreferrer">GitGuardian, 2026</a>
          </span>
        </div>
      </div>
      <div className="check-why__you">
        <div>
          <span className="mono small">One day like that case, without a cap</span>
          <b>{usd(perDay, 0)}</b>
        </div>
        <div>
          <span className="mono small">The most a stolen Shield key can spend in a day</span>
          <b>{usd(cap, 0)}</b>
        </div>
        <div>
          <span className="mono small">{PLAN_NAMES[check.plan]} plan{check.plan === 'business' ? ', from' : ''}</span>
          <b>{price ? `€${price.toLocaleString('en-US')}/month` : 'Free'}</b>
        </div>
      </div>
      <p className="muted small">
        With the daily cap from your report, a key stolen like in that case stops at {usd(cap, 0)} instead of about {usd(perDay, 0)} a day, and auto-lock can shut it off sooner. These are
        reported cases and estimates, not a promise of what you would lose or save.
      </p>
    </section>
  );
}

function Quiz({ initial, onDone, onSkip, first }) {
  const [answers, setAnswers] = useState(initial || {});
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const q = QUESTIONS[i];
  const last = i === QUESTIONS.length - 1;

  const pick = async (value) => {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (!last) return setI(i + 1);
    setBusy(true);
    const r = await api('check', { method: 'POST', body: { answers: next } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone(r.data);
  };

  return (
    <section className="card check-quiz">
      <div className="check-quiz__top">
        <span className="mono small muted">
          Question {i + 1} of {QUESTIONS.length}
        </span>
        <div className="meter__bar" aria-hidden="true">
          <i style={{ width: `${((i + (busy ? 1 : 0)) / QUESTIONS.length) * 100}%`, background: 'var(--accent)' }} />
        </div>
      </div>
      <h2>{q.q}</h2>
      <div className="check-quiz__options" role="radiogroup" aria-label={q.q}>
        {q.options.map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={answers[q.id] === value} className={answers[q.id] === value ? 'is-on' : ''} disabled={busy} onClick={() => pick(value)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row row--between">
        <button type="button" className="link" disabled={i === 0 || busy} onClick={() => setI(i - 1)}>
          Back
        </button>
        {busy ? <span className="muted small">Scoring…</span> : first && <button type="button" className="link" onClick={onSkip}>Skip for now</button>}
      </div>
    </section>
  );
}

function Report({ check, me, onRetake }) {
  const [keys, setKeys] = useState(null);
  const [channels, setChannels] = useState(null);

  useEffect(() => {
    Promise.all([api('keys'), api('alerts')]).then(([k, a]) => {
      setKeys(k.ok ? k.data.keys : []);
      setChannels(a.ok ? a.data.channels : []);
    });
  }, []);

  const steps = keys && channels ? buildSteps(check, me, keys, channels) : [];
  const tracked = steps.filter((s) => !s.manual);
  const done = tracked.filter((s) => s.done).length;

  return (
    <>
      <section className={`card check-score check-score--${check.grade}`}>
        <div className="check-score__num">
          <b>{check.score}</b>
          <span>/100</span>
        </div>
        <div>
          <span className={`pill ${check.grade === 'low' ? 'ok' : 'bad'}`}>{GRADE[check.grade]}</span>
          <h2>Your exposure today, before Shield</h2>
          <p className="muted">
            Higher means a leaked or abused key would cost you more, faster. Each fix below maps to a Shield setting.
            {check.saved === false && ' Your answers could not be saved yet, so this report is only shown once.'}
          </p>
        </div>
      </section>

      {check.risks.length > 0 && (
        <section className="card">
          <h2>What we found</h2>
          <ul className="check-risks">
            {check.risks.map((r) => (
              <li key={r.title} className={`check-risk check-risk--${r.level}`}>
                <span className="mono small">{r.level}</span>
                <b>{r.title}</b>
                <p className="muted">{r.fix}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <WhyItPays check={check} />

      <section className="card">
        <div className="row row--between">
          <h2>Your setup</h2>
          {keys && <span className="pill">{done} of {tracked.length} done</span>}
        </div>
        {!keys ? (
          <p className="muted">Loading…</p>
        ) : (
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.id} className={s.done ? 'is-done' : ''}>
                <span className="steps__dot" aria-hidden="true">{s.done ? '✓' : s.manual ? '!' : ''}</span>
                {s.href ? <a href={s.href}>{s.text}</a> : <span>{s.text}</span>}
              </li>
            ))}
          </ol>
        )}
        {check.settings.other_provider && (
          <p className="muted small">Most other providers (Gemini, Mistral, Groq, DeepSeek, xAI, OpenRouter and more) offer an OpenAI-compatible API. Add yours under <a href="#providers">Provider keys</a> and send requests to <code>/v1/compat</code>.</p>
        )}
      </section>

      <p className="muted small">
        <button type="button" className="link" onClick={onRetake}>
          Retake the check
        </button>{' '}
        if your setup changes.
      </p>
    </>
  );
}

export default function Check({ me, refreshMe, first = false, onSkip }) {
  const [check, setCheck] = useState(me.check);
  const [retake, setRetake] = useState(false);

  const done = (result) => {
    setCheck(result);
    setRetake(false);
    if (first) window.location.hash = 'check';
    if (refreshMe) refreshMe();
  };

  return (
    <>
      <header className="view-head">
        <h1>{first ? 'Welcome to Shield' : 'Shield check'}</h1>
        <p className="muted">
          {first
            ? 'Nine quick questions. You get your risk score and a setup list made for how you use AI, then the dashboard.'
            : 'Your risk score and the settings that fit how you use AI.'}
        </p>
      </header>
      {!check || retake ? <Quiz initial={check?.answers} onDone={done} onSkip={onSkip} first={first} /> : <Report check={check} me={me} onRetake={() => setRetake(true)} />}
      {first && check && !retake && (
        <p>
          <a className="btn" href="#overview" onClick={onSkip}>
            Go to the dashboard
          </a>
        </p>
      )}
    </>
  );
}
