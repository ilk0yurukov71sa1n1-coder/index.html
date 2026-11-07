import { useEffect, useState } from 'react';
import { api, usd, when } from '../api';
import { DEMO } from '../demo';

const REASONS = {
  rate_limited: 'Over the requests-per-minute limit',
  daily_cap_reached: 'Daily spend cap reached',
  monthly_cap_reached: 'Monthly spend cap reached',
  model_not_allowed: 'Model not on the allowed list',
  prompt_injection_blocked: 'Prompt-injection pattern',
  provider_key_missing: 'No provider key saved',
  invalid_request: 'Malformed request',
  provider_unreachable: 'Provider did not answer',
  plan_limit_reached: "Plan's monthly requests used up",
  key_locked: 'Key is locked',
  key_expired: 'Key has expired',
  end_user_paused: 'User paused after repeated attacks',
  ip_not_allowed: 'IP address not on the allow-list',
  country_blocked: 'Country is blocked',
  max_tokens_exceeded: 'Asked for more output than allowed',
};

// Daily bars: cost as the bar, blocked requests as a red tick on top.
function Chart({ daily, metric }) {
  const W = 720;
  const H = 180;
  const max = Math.max(...daily.map((d) => d[metric]), metric === 'cost_usd' ? 0.01 : 1);
  const bw = W / daily.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label={`${metric === 'cost_usd' ? 'Spend' : 'Requests'} per day`}>
      <line x1="0" x2={W} y1={H} y2={H} className="chart__axis" />
      {daily.map((d, i) => {
        const h = (d[metric] / max) * (H - 8);
        const bh = metric === 'requests' && d.requests ? (d.blocked / max) * (H - 8) : 0;
        return (
          <g key={d.day}>
            <title>{`${d.day}: ${metric === 'cost_usd' ? usd(d.cost_usd) : `${d.requests} requests, ${d.blocked} blocked`}`}</title>
            <rect x={i * bw + bw * 0.18} width={bw * 0.64} y={H - h} height={Math.max(h, d[metric] ? 1.5 : 0)} rx="2" className="chart__bar" />
            {bh > 0 && <rect x={i * bw + bw * 0.18} width={bw * 0.64} y={H - bh} height={bh} rx="2" className="chart__blocked" />}
            {(i === 0 || i === daily.length - 1 || (daily.length <= 14 && i % 2 === 0)) && (
              <text x={i === 0 ? 0 : i === daily.length - 1 ? W : i * bw + bw / 2} y={H + 16} textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'} className="chart__label">
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function Usage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('cost_usd');

  useEffect(() => {
    setData(null);
    api('usage', { query: `&days=${days}` }).then((r) => (r.ok ? setData(r.data) : setError(r.error)));
  }, [days]);

  return (
    <>
      <header className="view-head view-head--row">
        <div>
          <h1>Usage and reports</h1>
          <p className="muted">Every request through Shield, allowed or blocked. Costs are estimates from list prices.</p>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Period">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" className={d === days ? 'is-on' : ''} onClick={() => setDays(d)}>
                {d} days
              </button>
            ))}
          </div>
          {DEMO ? (
            <button className="btn btn--ghost" type="button" disabled title="Works in the real dashboard">
              Export CSV
            </button>
          ) : (
            <a className="btn btn--ghost" href={`/api/dash?r=export&days=${days}`} download>
              Export CSV
            </a>
          )}
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div className="stats">
            <div className="stat"><span>Estimated spend</span><b>{usd(data.totals.cost_usd)}</b></div>
            <div className="stat"><span>Requests</span><b>{data.totals.requests.toLocaleString()}</b></div>
            <div className="stat"><span>Blocked</span><b className={data.totals.blocked ? 'accent' : ''}>{data.totals.blocked.toLocaleString()}</b></div>
            <div className="stat"><span>Tokens in / out</span><b className="stat__sm">{data.totals.input_tokens.toLocaleString()} / {data.totals.output_tokens.toLocaleString()}</b></div>
          </div>

          <section className="card">
            <h2>Response cache</h2>
            {data.cache?.hits ? (
              <p>
                This month {data.cache.hits.toLocaleString()} repeated request{data.cache.hits === 1 ? ' was' : 's were'} answered from the cache, saving an estimated <b>{usd(data.cache.saved_usd)}</b> on your provider bill.
              </p>
            ) : (
              <p className="muted">Nothing cached yet this month.</p>
            )}
            <p className="muted small">
              Turn it on per request with the header <code>X-Shield-Cache: 3600</code> (seconds, up to 7 days) or <code>X-Shield-Cache: on</code> for one hour. Identical requests from your account are then answered by Shield, with no call to your provider. Streaming requests are never cached. Answers are stored encrypted.
            </p>
          </section>

          <section className="card">
            <div className="row row--between">
              <h2>Per day (UTC)</h2>
              <div className="seg" role="group" aria-label="Chart">
                <button type="button" className={metric === 'cost_usd' ? 'is-on' : ''} onClick={() => setMetric('cost_usd')}>Spend</button>
                <button type="button" className={metric === 'requests' ? 'is-on' : ''} onClick={() => setMetric('requests')}>Requests</button>
              </div>
            </div>
            <Chart daily={data.daily} metric={metric} />
            {metric === 'requests' && <p className="muted small"><i className="swatch" /> Blocked part of each day</p>}
          </section>

          <div className="grid2">
            <section className="card">
              <h2>By model</h2>
              {data.models.length === 0 ? <p className="muted">No requests yet.</p> : (
                <table className="table table--r2">
                  <thead><tr><th>Model</th><th>Requests</th><th>Spend</th></tr></thead>
                  <tbody>{data.models.map((m) => <tr key={m.model}><td><code>{m.model}</code></td><td>{m.requests}</td><td>{usd(m.cost_usd)}</td></tr>)}</tbody>
                </table>
              )}
            </section>
            <section className="card">
              <h2>Why requests were blocked</h2>
              {data.blocked_reasons.length === 0 ? <p className="muted">Nothing blocked in this period.</p> : (
                <table className="table table--r1">
                  <tbody>{data.blocked_reasons.map((r) => <tr key={r.reason}><td>{REASONS[r.reason] || r.reason}</td><td>{r.count}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </div>

          <section className="card">
            <h2>Latest requests</h2>
            {data.recent.length === 0 ? <p className="muted">No requests yet. Send one with the quickstart on the Overview page.</p> : (
              <div className="table-wrap">
                <table className="table table--r3">
                  <thead><tr><th>Time</th><th>Key</th><th>Model</th><th>Result</th><th>Tokens</th><th>Cost</th><th>ms</th></tr></thead>
                  <tbody>
                    {data.recent.map((e, i) => (
                      <tr key={i}>
                        <td>{when(e.created_at)}</td>
                        <td>{e.key_name}</td>
                        <td><code>{e.model || '–'}</code></td>
                        <td>{e.blocked_reason ? <span className="pill bad">{REASONS[e.blocked_reason] || e.blocked_reason}</span> : <span className={`pill ${e.status < 400 ? 'ok' : ''}`}>{e.status}</span>}</td>
                        <td>{e.input_tokens + e.output_tokens}</td>
                        <td>{usd(e.cost_usd, 4)}</td>
                        <td>{e.latency_ms ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
