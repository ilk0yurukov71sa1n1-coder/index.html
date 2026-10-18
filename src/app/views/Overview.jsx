import { useEffect, useState } from 'react';
import { api, usd } from '../api';

export default function Overview({ me }) {
  const [keys, setKeys] = useState(null);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('keys'), api('usage', { query: '&days=30' })]).then(([k, u]) => {
      if (!k.ok || !u.ok) return setError(k.error || u.error);
      setKeys(k.data.keys);
      setUsage(u.data);
    });
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!keys || !usage) return <p className="muted">Loading…</p>;

  const active = keys.filter((k) => !k.revoked);
  const today = active.reduce((s, k) => s + (k.spent_today_usd || 0), 0);
  const month = active.reduce((s, k) => s + (k.spent_month_usd || 0), 0);
  const base = window.location.origin;
  const steps = [
    { done: active.length > 0, text: 'You have a Shield key', href: '#keys' },
    { done: me.providers.length > 0, text: 'Add your provider key (OpenAI, Anthropic or any OpenAI-compatible)', href: '#providers' },
    { done: usage.totals.requests > 0, text: 'Send your first request through Shield', href: '#overview' },
  ];

  return (
    <>
      <header className="view-head">
        <h1>Overview</h1>
        <p className="muted">Spend is an estimate from list prices. Your provider's invoice is the final number.</p>
      </header>

      <div className="stats">
        <div className="stat">
          <span>Spent today</span>
          <b>{usd(today)}</b>
        </div>
        <div className="stat">
          <span>Spent this month</span>
          <b>{usd(month)}</b>
        </div>
        <div className="stat">
          <span>Requests, 30 days</span>
          <b>{usage.totals.requests.toLocaleString()}</b>
        </div>
        <div className="stat">
          <span>Blocked, 30 days</span>
          <b className={usage.totals.blocked ? 'accent' : ''}>{usage.totals.blocked.toLocaleString()}</b>
        </div>
      </div>

      <section className="card">
        <h2>Get set up</h2>
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.text} className={s.done ? 'is-done' : ''}>
              <span className="steps__dot" aria-hidden="true">{s.done ? '✓' : ''}</span>
              <a href={s.href}>{s.text}</a>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Quickstart</h2>
        <p className="muted">Keep your code. Change the base URL and use your Shield key instead of your provider key.</p>
        <pre className="code">{`# OpenAI SDK (Python)
import os
from openai import OpenAI
client = OpenAI(base_url="${base}/v1", api_key=os.environ["SHIELD_KEY"])

# Anthropic SDK (Python)
from anthropic import Anthropic
client = Anthropic(base_url="${base}", api_key=os.environ["SHIELD_KEY"])

# curl
curl ${base}/v1/chat/completions \\
  -H "Authorization: Bearer $SHIELD_KEY" -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`}</pre>
        <p className="muted small">
          Supported today: OpenAI <code>/v1/chat/completions</code>, Anthropic <code>/v1/messages</code> and any OpenAI-compatible provider at <code>/v1/compat/chat/completions</code>, streaming included.
        </p>
      </section>
    </>
  );
}
