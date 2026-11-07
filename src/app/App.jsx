import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import SignIn from './SignIn';
import Overview from './views/Overview';
import Live from './views/Live';
import Keys from './views/Keys';
import Providers from './views/Providers';
import Usage from './views/Usage';
import Admin from './views/Admin';
import Defense from './views/Defense';
import Alerts from './views/Alerts';
import Billing from './views/Billing';
import Check from './views/Check';
import Owner from './views/Owner';
import Guard from './views/Guard';
import Feedback from '../components/ui/Feedback';

const VIEWS = [
  { id: 'overview', label: 'Overview', el: Overview, group: 'Monitor' },
  { id: 'check', label: 'Shield check', el: Check },
  { id: 'live', label: 'Live', el: Live },
  { id: 'guard', label: 'Bill Guard', el: Guard },
  { id: 'defense', label: 'Defense', el: Defense, group: 'Protect' },
  { id: 'keys', label: 'Keys and limits', el: Keys },
  { id: 'alerts', label: 'Alerts', el: Alerts },
  { id: 'providers', label: 'Provider keys', el: Providers },
  { id: 'usage', label: 'Usage and reports', el: Usage, group: 'Account' },
  { id: 'billing', label: 'Plan and billing', el: Billing },
  { id: 'owner', label: 'Owner console', el: Owner, admin: true, group: 'Admin' },
  { id: 'admin', label: 'Waitlist', el: Admin, admin: true },
];

const SKIP = 'shield-check-skipped';
const skipped = () => {
  try {
    return localStorage.getItem(SKIP) === '1';
  } catch {
    return false;
  }
};

// The one-time key link from the welcome email (#reveal=…). The token is kept
// until the person is signed in, then the key is opened once and forgotten.
const PENDING = 'shield-reveal';
let pendingReveal = null;
let opening = false; // one request even if the effect runs twice
const revealHash = window.location.hash.match(/^#reveal=([\w-]+)$/);
if (revealHash) {
  pendingReveal = revealHash[1];
  try {
    localStorage.setItem(PENDING, pendingReveal);
  } catch {
    /* private mode: keep it for this page only */
  }
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
const readPending = () => {
  try {
    return pendingReveal || localStorage.getItem(PENDING);
  } catch {
    return pendingReveal;
  }
};
const clearPending = () => {
  pendingReveal = null;
  try {
    localStorage.removeItem(PENDING);
  } catch {
    /* nothing stored */
  }
};

function WelcomeKey({ shown, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  if (shown.error) {
    return (
      <section className="card" role="alert">
        <p className="error">{shown.error}</p>
        <button className="btn btn--ghost" type="button" onClick={onClose}>
          OK
        </button>
      </section>
    );
  }
  return (
    <section className="card reveal" role="alert">
      <h2>Copy your Shield key now</h2>
      <p className="muted">This is the only time it is shown. We keep only a fingerprint of it.</p>
      <div className="row">
        <code className="secret">{shown.secret}</code>
        <button className="btn" type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onClose}>
          I saved it
        </button>
      </div>
    </section>
  );
}

const REVEAL_ERRORS = {
  reveal_used: 'That key link was already used, so the key cannot be shown again. If you did not save it, revoke it and create a new key in Keys and limits.',
  not_found: 'That key link has expired or belongs to another account. Create a new key in Keys and limits.',
};

const route = () => window.location.hash.replace('#', '') || 'overview';

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
  const [view, setView] = useState(route);
  const [skip, setSkip] = useState(skipped);
  const [shown, setShown] = useState(null);

  const load = useCallback(async () => {
    const r = await api('me');
    setMe(r.ok ? r.data : null);
  }, []);

  // Signed in with a key link waiting: open it once.
  useEffect(() => {
    const t = readPending();
    if (!me || me.demo || !t || opening) return;
    opening = true;
    api('reveal', { method: 'POST', body: { t } }).then((r) => {
      opening = false;
      if (r.status === 0 || r.status === 401) return; // try again on the next load
      clearPending();
      setShown(r.ok ? { secret: r.data.secret } : { error: REVEAL_ERRORS[r.data.error] || r.error });
    });
  }, [me]);
  const welcome = shown && <WelcomeKey shown={shown} onClose={() => setShown(null)} />;

  useEffect(() => {
    load();
    const onHash = () => setView(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [load]);

  if (me === undefined) return <div className="app-loading">Loading…</div>;
  if (me === null) return <SignIn />;

  // New accounts take the Shield check before anything else (once, or until skipped).
  if (!me.check && !me.demo && !skip) {
    const later = () => {
      try {
        localStorage.setItem(SKIP, '1');
      } catch {
        /* private mode: skip for this visit only */
      }
      setSkip(true);
    };
    return (
      <div className="app app--onboard">
        <main className="app__main">
          <a className="app__brand" href="/">
            <img src="/logo-rc.png" alt="" width="32" height="32" />
            <span>
              <b className="app__word">rollcfluence</b> <em>shield</em>
            </span>
          </a>
          {welcome}
          <Check me={me} refreshMe={load} first onSkip={later} />
        </main>
      </div>
    );
  }

  const views = VIEWS.filter((v) => !v.admin || me.admin);
  const current = views.find((v) => v.id === view) || views[0];
  const View = current.el;

  const signOut = async () => {
    if (me.demo) return window.location.assign('/app');
    await fetch('/api/auth?a=logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    window.location.hash = '';
    setMe(null);
  };

  return (
    <div className="app">
      <aside className="app__side">
        <a className="app__brand" href="/">
          <img src="/logo-rc.png" alt="" width="32" height="32" />
          <span>
            <b className="app__word">rollcfluence</b> <em>shield</em>
          </span>
        </a>
        <nav className="app__nav" aria-label="Dashboard">
          {views.map((v) => [
            v.group && (
              <span key={`g-${v.group}`} className="app__group" aria-hidden="true">
                {v.group}
              </span>
            ),
            <a key={v.id} href={`#${v.id}`} className={v.id === current.id ? 'is-active' : ''} aria-current={v.id === current.id ? 'page' : undefined}>
              {v.label}
            </a>,
          ])}
        </nav>
        <div className="app__me">
          <span className="app__avatar" aria-hidden="true">
            {(me.email || '?').charAt(0).toUpperCase()}
          </span>
          <span className="app__who">
            <span className="app__email" title={me.email}>{me.email}</span>
            <span className="app__plan">{me.plan} plan</span>
          </span>
          <button type="button" className="link app__out" onClick={signOut}>
            {me.demo ? 'Leave demo' : 'Sign out'}
          </button>
        </div>
      </aside>
      <main className="app__main">
        {me.demo && (
          <p className="demo-bar">
            <span className="demo-bar__tag">Demo</span>
            <span>Sample data. Changes are not saved.</span> <a href="/app">Sign in for real</a>
          </p>
        )}
        {welcome}
        <View me={me} refreshMe={load} />
        {current.id === 'overview' && !me.demo && (
          <div className="app__feedback">
            <Feedback page="dashboard" email={me.email} title="How is Shield working for you?" />
          </div>
        )}
      </main>
    </div>
  );
}
