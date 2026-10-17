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
import TextScanner from '../components/ui/TextScanner';
import Feedback from '../components/ui/Feedback';

const VIEWS = [
  { id: 'overview', label: 'Overview', el: Overview },
  { id: 'check', label: 'Shield check', el: Check },
  { id: 'live', label: 'Live', el: Live },
  { id: 'defense', label: 'Defense', el: Defense },
  { id: 'keys', label: 'Keys and limits', el: Keys },
  { id: 'alerts', label: 'Alerts', el: Alerts },
  { id: 'providers', label: 'Provider keys', el: Providers },
  { id: 'usage', label: 'Usage and reports', el: Usage },
  { id: 'billing', label: 'Plan and billing', el: Billing },
  { id: 'owner', label: 'Owner console', el: Owner, admin: true },
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

const route = () => window.location.hash.replace('#', '') || 'overview';

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
  const [view, setView] = useState(route);
  const [skip, setSkip] = useState(skipped);

  const load = useCallback(async () => {
    const r = await api('me');
    setMe(r.ok ? r.data : null);
  }, []);

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
              <TextScanner text="rollcfluence" /> <em>shield</em>
            </span>
          </a>
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
            <TextScanner text="rollcfluence" /> <em>shield</em>
          </span>
        </a>
        <nav className="app__nav" aria-label="Dashboard">
          {views.map((v) => (
            <a key={v.id} href={`#${v.id}`} className={v.id === current.id ? 'is-active' : ''} aria-current={v.id === current.id ? 'page' : undefined}>
              {v.label}
            </a>
          ))}
        </nav>
        <div className="app__me">
          <span title={me.email}>{me.email}</span>
          <span className="app__plan">{me.plan} plan</span>
          <button type="button" className="link" onClick={signOut}>
            {me.demo ? 'Leave demo' : 'Sign out'}
          </button>
        </div>
      </aside>
      <main className="app__main">
        {me.demo && (
          <p className="demo-bar">
            Demo with sample data. Changes are not saved. <a href="/app">Sign in for real</a>
          </p>
        )}
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
