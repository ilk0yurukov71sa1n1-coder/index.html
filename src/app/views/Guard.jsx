import { useEffect, useState } from 'react';
import { api, usd, when } from '../api';
import { DEMO } from '../demo';
import { PRICES_CHECKED, REGIONS } from '../../../api/_lib/vercel-prices.js';

const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const money = (n) => usd(n, n && n < 0.1 ? 4 : 2);

const snippet = (base) => `// shield-guard.js: copy into your project, set SHIELD_GUARD_KEY in Vercel,
// then wrap each API route:  export default guard('/api/search', handler)
const KEY = process.env.SHIELD_GUARD_KEY;
const ENDPOINT = '${base}/api/guard';
const SAMPLE = 1; // busy site? 0.1 sends 1 request in 10, and Shield counts it 10 times
const BOT = /bot|crawl|spider|slurp|preview|scrape|headless|python-requests|curl|wget|httpclient|go-http/i;

// The same hook @vercel/functions uses, so the send finishes after the response.
const waitUntil = (p) => globalThis[Symbol.for('@vercel/request-context')]?.get?.()?.waitUntil?.(p);
let queue = [];
let firstAt = 0;
let over = new Set(); // routes past the hourly limit you set in Shield

const flush = () => {
  if (!KEY || !queue.length) return;
  const events = queue.splice(0, 100);
  const sent = fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: \`Bearer \${KEY}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    signal: AbortSignal.timeout(3000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) over = new Set(d.over); })
    .catch(() => {});
  waitUntil(sent);
};

const note = (event) => {
  if (Math.random() >= SAMPLE) return;
  if (!queue.length) firstAt = Date.now();
  queue.push({ ...event, sample: SAMPLE, deploy: process.env.VERCEL_DEPLOYMENT_ID, commit: process.env.VERCEL_GIT_COMMIT_SHA });
  if (queue.length >= 20 || Date.now() - firstAt > 10_000) flush();
};

export const guard = (route, handler) => async (req, res) => {
  const bot = BOT.test(req.headers['user-agent'] || '');
  if (over.has(route)) {
    note({ route, ms: 0, status: 429, bot });
    res.statusCode = 429;
    res.setHeader('Retry-After', '600');
    return res.end('Too busy right now. Please try again later.');
  }
  const start = performance.now();
  try {
    return await handler(req, res);
  } finally {
    note({ route, ms: Math.round(performance.now() - start), status: res.statusCode, bot });
  }
};`;

function NewProject({ onMade }) {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('iad1');
  const [memory, setMemory] = useState(2);
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const r = await api('guard', { method: 'POST', body: { name: name.trim(), region, memory_gb: memory } });
    if (!r.ok) return setMsg(r.error);
    setName('');
    setMsg('');
    onMade(r.data);
  };
  return (
    <section className="card">
      <h2>Watch a site</h2>
      <p className="muted">One site key per Vercel project. Pick the region and memory its functions use, so the prices match.</p>
      <form className="row guard-new" onSubmit={submit}>
        <input aria-label="Site name" placeholder="Site name, e.g. Client shop" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        <select aria-label="Function region" value={region} onChange={(e) => setRegion(e.target.value)}>
          {Object.entries(REGIONS).map(([id, r]) => (
            <option key={id} value={id}>
              {id} · {r.name}
            </option>
          ))}
        </select>
        <select aria-label="Function memory" value={memory} onChange={(e) => setMemory(Number(e.target.value))}>
          {[1, 2, 3, 4].map((m) => (
            <option key={m} value={m}>
              {m} GB{m === 2 ? ' (Vercel default)' : ''}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          Create site key
        </button>
      </form>
      {msg && <p className="error">{msg}</p>}
    </section>
  );
}

function Limits({ p, onSaved }) {
  const [caps, setCaps] = useState(() => Object.fromEntries(Object.entries(p.caps || {}).map(([k, v]) => [k, String(v)])));
  const [route, setRoute] = useState('');
  const [msg, setMsg] = useState('');
  const save = async () => {
    const clean = {};
    for (const [k, v] of Object.entries(caps)) if (String(v).trim() !== '') clean[k] = Number(v);
    const r = await api('guard', { method: 'PATCH', body: { id: p.id, caps: clean } });
    setMsg(r.ok ? 'Saved. Your site gets the new limits with its next report.' : r.error);
    if (r.ok) onSaved();
  };
  const routes = [...new Set([...Object.keys(caps), ...p.routes.map((r) => r.route)])].slice(0, 20);
  return (
    <details className="guard-limits">
      <summary>Hourly limits per route</summary>
      <p className="small muted">
        When a route passes its limit, your site answers it with "Too busy" until the hour ends. Your site checks with Shield every few seconds, so a few extra requests can get through. Leave a field empty for no limit.
      </p>
      <div className="guard-caps">
        {routes.map((r) => (
          <label key={r}>
            <code>{r}</code>
            <input inputMode="numeric" placeholder="No limit" value={caps[r] ?? ''} onChange={(e) => setCaps((c) => ({ ...c, [r]: e.target.value.replace(/\D/g, '') }))} />
            <span className="small muted">requests an hour</span>
          </label>
        ))}
      </div>
      <div className="row">
        <input aria-label="Another route" placeholder="/api/another-route" value={route} onChange={(e) => setRoute(e.target.value)} />
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => {
            if (route.trim().startsWith('/')) setCaps((c) => ({ ...c, [route.trim()]: c[route.trim()] ?? '' }));
            setRoute('');
          }}
        >
          Add route
        </button>
        <button className="btn" type="button" onClick={save}>
          Save limits
        </button>
        {msg && (
          <span className="small" role="status">
            {msg}
          </span>
        )}
      </div>
    </details>
  );
}

function Project({ p, base, onChanged }) {
  const remove = async () => {
    if (!window.confirm(`Stop watching ${p.name}? Its site key stops working at once.`)) return;
    const r = await api('guard', { method: 'DELETE', query: `&id=${p.id}` });
    if (r.ok) onChanged();
  };
  const max = Math.max(1, ...p.series.map((s) => s.requests));
  return (
    <section className="card guard-project">
      <div className="key__head">
        <div>
          <h2>
            {p.name} <span className="pill">{p.region}</span> <span className="pill">{p.memory_gb} GB</span>
          </h2>
          <code className="muted">{p.prefix}…</code>
        </div>
        <button className="btn btn--ghost" type="button" onClick={remove}>
          Remove
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <span>Requests, 24 h</span>
          <b>{p.totals.requests.toLocaleString()}</b>
        </div>
        <div className="stat">
          <span>Bots</span>
          <b className={p.totals.bot_share > 0.3 ? 'accent' : ''}>{pct(p.totals.bot_share)}</b>
        </div>
        <div className="stat">
          <span>Functions, 24 h</span>
          <b>{money(p.totals.cost_24h)}</b>
        </div>
        <div className="stat">
          <span>A month like today</span>
          <b>{money(p.totals.month_if_same)}</b>
        </div>
      </div>

      {p.series.some((s) => s.requests) && (
        <div className="guard-bars" role="img" aria-label="Requests per hour, last 24 hours">
          {p.series.map((s) => (
            <span key={s.at} style={{ height: `${Math.max(2, (s.requests / max) * 100)}%` }} title={`${new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${s.requests.toLocaleString()} requests`} />
          ))}
        </div>
      )}

      {p.spikes.length > 0 && (
        <div className="guard-spikes" role="alert">
          {p.spikes.map((s) => (
            <div key={s.route} className="guard-spike">
              <b>
                <code>{s.route}</code> {s.kind === 'slower' ? 'got at least 2x slower' : s.kind === 'both' ? 'doubled and got slower' : 'at least doubled'}
              </b>
              <p className="small">
                Before: {s.before.per_hour.toLocaleString()} an hour, {s.before.avg_ms} ms, {money(s.before.cost_per_hour)} an hour. Now: {s.after.per_hour.toLocaleString()} an hour, {s.after.avg_ms} ms, {money(s.after.cost_per_hour)} an hour, {pct(s.after.bot_share)} bots.
              </p>
              <p className="small muted">{s.deploy ? `Started after deploy ${s.deploy.id}${s.deploy.commit ? ` (commit ${s.deploy.commit})` : ''}, ${when(s.deploy.at)}. Roll back in Vercel if the change was not meant to do this.` : 'No new deploy explains it, so it is likely traffic or bots. Check the bot share, or set an hourly limit.'}</p>
            </div>
          ))}
        </div>
      )}

      {p.routes.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Requests</th>
                <th>Avg time</th>
                <th>Bots</th>
                <th>5xx</th>
                <th>Est. 24 h</th>
              </tr>
            </thead>
            <tbody>
              {p.routes.map((r) => (
                <tr key={r.route}>
                  <td>
                    <code>{r.route}</code>
                    {p.caps[r.route] ? <span className="small muted"> · limit {p.caps[r.route].toLocaleString()}/h</span> : null}
                  </td>
                  <td>{r.requests.toLocaleString()}</td>
                  <td>{r.avg_ms} ms</td>
                  <td>{pct(r.bot_share)}</td>
                  <td>{r.errors}</td>
                  <td>{money(r.cost_24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Nothing counted yet. Add the code below to your site and deploy it. The first numbers show up a few seconds after its first requests.</p>
      )}

      {p.deploys.length > 0 && (
        <p className="small muted">
          Deploys seen: {p.deploys.slice(0, 3).map((d) => `${d.commit || d.id.slice(0, 12)} (${when(d.at)})`).join(', ')}
        </p>
      )}

      <Limits p={p} onSaved={onChanged} />

      <details className="guard-limits">
        <summary>Connect this site</summary>
        <ol className="small guard-steps">
          <li>In Vercel, open the site's project, then Settings, then Environment Variables. Add SHIELD_GUARD_KEY with the site key you copied, and redeploy.</li>
          <li>Add this file to the project and wrap each API route with it. It works for Vercel Node functions and the Next.js pages router.</li>
        </ol>
        <pre className="code">{snippet(base)}</pre>
      </details>
    </section>
  );
}

export default function Guard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [made, setMade] = useState(null);
  const [copied, setCopied] = useState(false);
  const base = window.location.origin;

  const load = async () => {
    const r = await api('guard');
    if (r.ok) {
      setData(r.data);
      setError('');
    } else setError(r.error);
  };
  useEffect(() => {
    load();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(made.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <header className="view-head">
        <h1>Bill Guard</h1>
        <p className="muted">
          Your site tells Shield about its own requests, and Shield prices them with Vercel's published rates (checked {PRICES_CHECKED}). The cost is an estimate of function time: it counts each request's full time as busy, so your real bill is usually lower. Your Vercel invoice is the final number.
          {DEMO ? ' Shown with sample data.' : ''}
        </p>
      </header>

      {made && (
        <section className="card reveal" role="alert">
          <h2>Copy the site key for {made.project.name} now</h2>
          <p className="muted">This is the only time it is shown. We keep only a fingerprint of it. It can only send traffic counts, never spend money or read anything.</p>
          <div className="row">
            <code className="secret">{made.key}</code>
            <button className="btn" type="button" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => setMade(null)}>
              I saved it
            </button>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}
      {data?.projects.map((p) => (
        <Project key={p.id} p={p} base={base} onChanged={load} />
      ))}
      <NewProject
        onMade={(d) => {
          setMade(d);
          setCopied(false);
          load();
        }}
      />
      <p className="small muted">
        Want to see what a site would cost before connecting it? Try the <a href="/bill">free Vercel bill check</a>.
      </p>
    </>
  );
}
