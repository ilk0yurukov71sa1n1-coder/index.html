import { useState } from 'react';
import { explain } from './api';
import TextScanner from '../components/ui/TextScanner';

const NOTES = {
  expired: 'That sign-in link has expired or was already replaced. Ask for a new one below.',
  used: 'That sign-in link was already used. Each link works once, so ask for a new one below.',
  error: 'We could not sign you in because the database did not answer. Try again.',
};

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState(NOTES[window.location.hash.slice(1)] || '');

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/auth?a=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return setState('sent');
      setError(explain(data.error));
    } catch {
      setError(explain('network'));
    }
    setState('idle');
  };

  return (
    <div className="signin">
      <a className="app__brand" href="/">
        <img src="/logo-rc.png" alt="" width="40" height="40" />
        <span>
          <TextScanner text="rollcfluence" /> <em>shield</em>
        </span>
      </a>
      <div className="card signin__card">
        <h1>Sign in to your dashboard</h1>
        {state === 'sent' ? (
          <p className="muted">
            If <b>{email}</b> has access, a sign-in link is on its way. It works for 15 minutes. Check your spam folder if it does not arrive.
          </p>
        ) : (
          <form onSubmit={submit}>
            <p className="muted">We email you a link. No password to remember.</p>
            <label className="field">
              <span>Email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
            <p className="muted small">
              By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>.
            </p>
          </form>
        )}
      </div>
      <p className="muted small">
        No access yet? <a className="link" href="/#access">Join the waitlist</a> or <a className="link" href="/app?demo">try the demo</a>
      </p>
    </div>
  );
}
