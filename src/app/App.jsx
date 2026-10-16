import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import SignIn from './SignIn';
import Overview from './views/Overview';
import Keys from './views/Keys';
import Providers from './views/Providers';
import Usage from './views/Usage';
import Admin from './views/Admin';

const VIEWS = [
  { id: 'overview', label: 'Overview', el: Overview },
  { id: 'keys', label: 'Keys and limits', el: Keys },
  { id: 'providers', label: 'Provider keys', el: Providers },
  { id: 'usage', label: 'Usage and reports', el: Usage },
  { id: 'admin', label: 'Waitlist', el: Admin, admin: true },
];

const route = () => window.location.hash.replace('#', '') || 'overview';

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
  const [view, setView] = useState(route);

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

  const views = VIEWS.filter((v) => !v.admin || me.admin);
  const current = views.find((v) => v.id === view) || views[0];
  const View = current.el;

  const signOut = async () => {
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
            rollcfluence <em>shield</em>
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
            Sign out
          </button>
        </div>
      </aside>
      <main className="app__main">
        <View me={me} refreshMe={load} />
      </main>
    </div>
  );
}
