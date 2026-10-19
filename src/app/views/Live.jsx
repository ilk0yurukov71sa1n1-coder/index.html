import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { api, usd } from '../api';
import { DEMO } from '../demo';

const EdgeGlobe = lazy(() => import('../../components/ui/EdgeGlobe'));

// Shield's functions run in Vercel's iad1 region (Washington, D.C.).
const SHIELD = { lat: 38.9, lon: -77.04 };
const POLL_MS = 5000;

const flag = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '🌐');
const region = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const countryName = (cc) => {
  try {
    return cc ? region?.of(cc) || cc : 'Unknown';
  } catch {
    return cc || 'Unknown';
  }
};
const ago = (iso, now) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};
const REASON = {
  rate_limited: 'Rate limit',
  daily_cap_reached: 'Daily cap',
  monthly_cap_reached: 'Monthly cap',
  model_not_allowed: 'Model blocked',
  prompt_injection_blocked: 'Injection',
  provider_key_missing: 'No provider key',
  invalid_request: 'Bad request',
  provider_unreachable: 'Provider down',
};

const group = (events, keyOf, init) => {
  const m = new Map();
  for (const e of events) {
    const k = keyOf(e);
    if (k == null) continue;
    const row = m.get(k) || init(e);
    row.requests++;
    row.blocked += e.blocked_reason ? 1 : 0;
    row.cost += e.cost_usd || 0;
    m.set(k, row);
  }
  return [...m.values()].sort((a, b) => b.requests - a.requests);
};

export default function Live() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await api('live');
      if (!alive) return;
      if (r.ok) {
        setEvents(r.data.events);
        setError('');
      } else setError(r.error);
      setNow(Date.now());
    };
    load();
    const id = setInterval(load, DEMO ? 2500 : POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const places = useMemo(
    () => group(events || [], (e) => (e.country ? `${e.city || ''}|${e.country}` : null), (e) => ({ city: e.city, country: e.country, lat: e.lat, lon: e.lon, requests: 0, blocked: 0, cost: 0 })),
    [events]
  );
  const users = useMemo(
    () => group(events || [], (e) => `${e.end_user || ''}|${e.key_name}`, (e) => ({ user: e.end_user, key: e.key_name, requests: 0, blocked: 0, cost: 0 })),
    [events]
  );

  // Rebuild the globe only when the set of places changes, not on every poll.
  const placeKey = places.filter((p) => p.lat != null).map((p) => `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`).sort().join(';');
  const globe = useMemo(() => {
    const pts = placeKey ? placeKey.split(';').map((s) => s.split(',').map(Number)) : [];
    const nodes = [SHIELD, ...pts.map(([lat, lon]) => ({ lat, lon }))];
    return { nodes, arcs: pts.map((_, i) => [i + 1, 0]) };
  }, [placeKey]);

  if (error && !events) return <p className="error">{error}</p>;
  if (!events) return <p className="muted">Loading…</p>;

  const last5 = events.filter((e) => now - new Date(e.created_at).getTime() < 5 * 60e3);
  const blocked = events.filter((e) => e.blocked_reason).length;

  return (
    <>
      <header className="view-head view-head--row">
        <div>
          <h1 className="live-title">
            Live
          </h1>
          <p className="muted">The last hour of requests through Shield: where they came from, who sent them and what happened. Updates every {DEMO ? '2.5' : '5'} seconds.</p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="stats">
        <div className="stat"><span>Last 5 minutes</span><b>{last5.length}</b></div>
        <div className="stat"><span>Last hour</span><b>{events.length}</b></div>
        <div className="stat"><span>Blocked, last hour</span><b className={blocked ? 'accent' : ''}>{blocked}</b></div>
        <div className="stat"><span>Locations</span><b>{places.length}</b></div>
      </div>

      <div className="live-grid">
        <section className="card live-globe">
          <h2>Where requests come from</h2>
          <div className="live-globe__stage">
            <Suspense fallback={<p className="muted small">Loading globe…</p>}>
              <EdgeGlobe nodes={globe.nodes} arcs={globe.arcs} />
            </Suspense>
          </div>
          <p className="muted small">Each arc runs from where a request started to Shield in Washington, D.C. Drag to spin.</p>
        </section>

        <section className="card live-feed">
          <h2>Request feed</h2>
          {events.length === 0 ? (
            <p className="muted">Nothing in the last hour. Requests appear here a few seconds after they reach Shield.</p>
          ) : (
            <ol className="feed">
              {events.slice(0, 60).map((e, i) => (
                <li key={`${e.created_at}-${i}`} className={e.blocked_reason ? 'is-blocked' : ''}>
                  <span className="feed__flag" title={countryName(e.country)}>{flag(e.country)}</span>
                  <span className="feed__main">
                    <b>{e.end_user || e.key_name}</b>
                    <span className="muted small">
                      {e.city ? `${e.city}, ` : ''}
                      {countryName(e.country)} · <code>{e.model || '–'}</code>
                      {e.end_user ? ` · ${e.key_name}` : ''}
                    </span>
                  </span>
                  <span className="feed__side">
                    {e.blocked_reason ? <span className="pill bad">{REASON[e.blocked_reason] || 'Blocked'}</span> : <span className="pill ok">{usd(e.cost_usd, 4)}</span>}
                    <span className="muted small">{ago(e.created_at, now)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Where</h2>
          {places.length === 0 ? <p className="muted">No locations yet.</p> : (
            <table className="table">
              <thead><tr><th>Place</th><th>Requests</th><th>Blocked</th></tr></thead>
              <tbody>
                {places.slice(0, 12).map((p) => (
                  <tr key={`${p.city}|${p.country}`}>
                    <td>{flag(p.country)} {p.city ? `${p.city}, ` : ''}{countryName(p.country)}</td>
                    <td>{p.requests}</td>
                    <td>{p.blocked || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <h2>Who</h2>
          {users.length === 0 ? <p className="muted">No requests yet.</p> : (
            <table className="table">
              <thead><tr><th>User</th><th>Key</th><th>Requests</th><th>Spend</th></tr></thead>
              <tbody>
                {users.slice(0, 12).map((u) => (
                  <tr key={`${u.user}|${u.key}`}>
                    <td>{u.user || <span className="muted">Not sent</span>}</td>
                    <td>{u.key}</td>
                    <td>{u.requests}{u.blocked ? <span className="accent"> ({u.blocked} blocked)</span> : ''}</td>
                    <td>{usd(u.cost, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <p className="muted small">
        Location is where a request reached Shield from, looked up from its IP address, which we never store. If your server calls Shield, you see your server&apos;s location. To see your own users, send their ID in the <code>x-shield-user</code> header (or the <code>user</code> field in OpenAI requests).
      </p>
    </>
  );
}
