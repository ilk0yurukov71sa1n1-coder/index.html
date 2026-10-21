import { useEffect, useMemo, useState } from 'react';
import { adminApi, when } from '../api';
import { BUSINESSES, toTime } from '../../../api/_lib/booking.js';

const SEEN = 'owner-milestones-seen';
const TICKS = 'owner-setup-ticked';
const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // Private mode: nothing is remembered, everything still works.
  }
};
const eur = (n, d = 0) => `€${Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const num = (n) => Number(n).toLocaleString('en-US');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const GROUP_ICON = { Waitlist: 'W', Customers: 'C', Product: 'P', Money: '€' };

// Bursts of little pieces when a milestone is new since the last visit.
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 0.6, r: Math.random() * 360, c: i % 3 })), []);
  return (
    <div className="owner-confetti" aria-hidden="true">
      {bits.map((b) => (
        <i key={b.i} className={`c${b.c}`} style={{ left: `${b.x}%`, animationDelay: `${b.d}s`, '--r': `${b.r}deg` }} />
      ))}
    </div>
  );
}

function Celebrate({ fresh, onClose }) {
  if (!fresh.length) return null;
  const top = fresh[0];
  return (
    <section className="card owner-cheer" role="status">
      <Confetti />
      <span className="owner-cheer__badge">{GROUP_ICON[top.group] || '·'}</span>
      <div>
        <p className="mono small">{fresh.length > 1 ? `${fresh.length} new milestones` : 'New milestone'}</p>
        <h2>{top.title}</h2>
        {fresh.length > 1 && <p className="muted small">Also: {fresh.slice(1, 4).map((m) => m.title).join(' · ')}{fresh.length > 4 ? ' …' : ''}</p>}
      </div>
      <button type="button" className="btn btn--ghost" onClick={onClose}>
        Nice!
      </button>
    </section>
  );
}

function Numbers({ n }) {
  const tiles = [
    ['Monthly plan revenue', eur(n.mrr), n.business ? `+ ${n.business} Business (custom)` : 'excl. VAT, before costs'],
    ['Paying customers', num(n.paying), `${num(n.accounts)} accounts · ${n.newThisWeek} new this week`],
    ['Waitlist', num(n.waitlist), `${num(n.confirmed)} confirmed · ${num(n.letIn)} let in · ${n.signupsThisWeek} this week`],
    ['Protected requests', num(n.requestsMonth), `this month · ${num(n.requestsToday)} today`],
    ['Stopped', num(n.blockedMonth), 'attacks and overspend blocked this month'],
  ];
  return (
    <div className="owner-tiles">
      {tiles.map(([label, value, sub]) => (
        <div key={label} className="stat">
          <span>{label}</span>
          <b>{value}</b>
          <small className="muted">{sub}</small>
        </div>
      ))}
      <div className="stat owner-plans">
        <span>Accounts by plan</span>
        <div className="owner-plans__bar">
          {Object.entries(n.byPlan).map(([p, c]) => (c ? <i key={p} className={`plan-${p}`} style={{ flex: c }} title={`${p}: ${c}`} /> : null))}
          {!n.accounts && <i className="plan-none" style={{ flex: 1 }} />}
        </div>
        <small className="muted">{Object.entries(n.byPlan).filter(([, c]) => c).map(([p, c]) => `${p} ${c}`).join(' · ') || 'No accounts yet'}</small>
      </div>
    </div>
  );
}

function Goals({ list }) {
  const next = Object.values(
    list.reduce((acc, m) => {
      if (!m.reached && !acc[m.group]) acc[m.group] = m;
      return acc;
    }, {})
  );
  return (
    <section className="card">
      <h2>Next goals</h2>
      <ul className="owner-goals">
        {next.map((m) => {
          const pct = Math.round((m.value / m.target) * 100);
          return (
            <li key={m.id}>
              <div className="row row--between">
                <span>
                  <span className="owner-goals__icon" aria-hidden="true">{GROUP_ICON[m.group]}</span> {m.title}
                </span>
                <span className="mono small">
                  {m.group === 'Money' && !m.id.startsWith('paying') ? `${eur(m.value)} of ${eur(m.target)}` : `${num(m.value)} of ${num(m.target)}`}
                </span>
              </div>
              <div className="owner-goals__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={m.title}>
                <i style={{ '--w': `${Math.max(pct, 2)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Timeline({ list }) {
  const [group, setGroup] = useState('All');
  const groups = ['All', ...new Set(list.map((m) => m.group))];
  const shown = list.filter((m) => group === 'All' || m.group === group);
  const reached = shown.filter((m) => m.reached).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const ahead = shown.filter((m) => !m.reached);
  const total = list.filter((m) => m.reached).length;
  return (
    <section className="card">
      <div className="row row--between">
        <h2>Milestones</h2>
        <span className="pill ok">{total} of {list.length} reached</span>
      </div>
      <div className="seg" role="group" aria-label="Show milestones">
        {groups.map((g) => (
          <button key={g} type="button" className={group === g ? 'is-on' : ''} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <ol className="owner-line">
        {reached.map((m) => (
          <li key={m.id} className="is-done">
            <span className="owner-line__dot" aria-hidden="true">{GROUP_ICON[m.group]}</span>
            <div>
              <b>{m.title}</b>
              <span className="muted small">{m.at ? day(m.at) : 'Reached'}</span>
            </div>
          </li>
        ))}
        {ahead.map((m) => (
          <li key={m.id}>
            <span className="owner-line__dot" aria-hidden="true" />
            <div>
              <b>{m.title}</b>
              <span className="muted small">{Math.round((m.value / m.target) * 100)}% of the way</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Payments({ p }) {
  const [open, setOpen] = useState(null);
  const [all, setAll] = useState(false);
  const months = useMemo(() => {
    const out = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      out.push({ key, label: m.toLocaleDateString(undefined, { month: 'short' }), sum: p.list.filter((x) => x.at.slice(0, 7) === key).reduce((s, x) => s + x.amount, 0) });
    }
    return out;
  }, [p.list]);
  const top = Math.max(1, ...months.map((m) => m.sum));

  if (!p.connected) {
    return (
      <section className="card">
        <h2>Payments</h2>
        <p className="muted">Payments show up here as soon as card payments are connected. See “Card payments” in the setup list below.</p>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="row row--between">
        <h2>Payments</h2>
        <span className={`pill ${p.mode === 'live' ? 'ok' : ''}`}>{p.mode === 'live' ? 'Live money' : 'Test mode, no real money'}</span>
      </div>
      <div className="owner-pay">
        <div>
          <span className="mono small muted">Collected (last 100 payments)</span>
          <b className="owner-pay__total">{eur(p.total, 2)}</b>
        </div>
        <div className="owner-chart" role="img" aria-label="Payments per month, last 6 months">
          {months.map((m) => (
            <div key={m.key} className="owner-chart__col" title={`${m.label}: ${eur(m.sum, 2)}`}>
              <span className="mono small">{m.sum ? eur(m.sum) : ''}</span>
              <i style={{ '--h': `${(m.sum / top) * 100}%` }} />
              <span className="mono small muted">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
      {p.failed.length > 0 && (
        <p className="error">
          {p.failed.length} payment{p.failed.length > 1 ? 's' : ''} failed and {p.failed.length > 1 ? 'are' : 'is'} being retried: {p.failed.map((f) => `${f.email || 'unknown'} ${eur(f.amount, 2)}`).join(', ')}.
        </p>
      )}
      {p.list.length === 0 ? (
        <p className="muted">No payments yet. The first one will light up a milestone.</p>
      ) : (
        <ul className="owner-feed">
          {p.list.slice(0, all ? 50 : 6).map((x) => (
            <li key={x.id}>
              <button type="button" className="owner-feed__row" aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}>
                <span className="owner-feed__amt">+{eur(x.amount, 2)}</span>
                <span>{x.email || 'Customer'}</span>
                <span className="muted small">{when(x.at)}</span>
              </button>
              {open === x.id && (
                <p className="small muted owner-feed__more">
                  {x.currency} · invoice {x.id}
                  {x.url ? (
                    <>
                      {' · '}
                      <a href={x.url} target="_blank" rel="noopener noreferrer">
                        Open invoice
                      </a>
                    </>
                  ) : null}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {p.list.length > 6 && (
        <button type="button" className="link" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${p.list.length} payments`}
        </button>
      )}
    </section>
  );
}

function Setup({ steps }) {
  const [ticks, setTicks] = useState(() => read(TICKS) || {});
  const [open, setOpen] = useState(null);
  const isDone = (s) => (s.done === null ? Boolean(ticks[s.id]) : s.done);
  const done = steps.filter(isDone).length;
  const pct = Math.round((done / steps.length) * 100);
  const tick = (id) => {
    const next = { ...ticks, [id]: !ticks[id] };
    setTicks(next);
    write(TICKS, next);
  };
  const groups = [...new Set(steps.map((s) => s.group))];
  const firstOpen = steps.find((s) => !isDone(s));

  return (
    <section className="card">
      <div className="owner-setup__head">
        <div className="owner-ring" style={{ '--p': pct }} aria-hidden="true">
          <b>{pct}%</b>
        </div>
        <div>
          <h2>Setup</h2>
          <p className="muted">
            {done} of {steps.length} done. {firstOpen ? <>Next: <button type="button" className="link" onClick={() => setOpen(firstOpen.id)}>{firstOpen.title}</button></> : 'Everything is set up.'}
          </p>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g} className="owner-setup__group">
          <p className="mono small muted">{g}</p>
          <ul className="owner-setup">
            {steps
              .filter((s) => s.group === g)
              .map((s) => {
                const ok = isDone(s);
                return (
                  <li key={s.id} className={ok ? 'is-done' : ''}>
                    <button type="button" className="owner-setup__row" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                      <span className="steps__dot" aria-hidden="true">{ok ? '✓' : ''}</span>
                      <span>{s.title}</span>
                      <span className="muted small">{s.done === null ? 'tick by hand' : ok ? 'detected' : 'to do'}</span>
                    </button>
                    {open === s.id && (
                      <div className="owner-setup__how">
                        <ol>
                          {s.how.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ol>
                        <div className="row">
                          {s.extra && (
                            <a className="btn btn--ghost" href={s.extra} target="_blank" rel="noopener noreferrer">
                              {s.extra.includes('stripe') ? 'Open Stripe' : s.extra.includes('resend') ? 'Open Resend' : s.extra.includes('anthropic') ? 'Open Claude Console' : 'Open'}
                            </a>
                          )}
                          {s.link && (
                            <a className="btn" href={s.link} target={s.link.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">
                              {s.link.includes('vercel.com') ? 'Open Vercel settings' : s.link.includes('supabase') ? 'Open SQL editor' : s.link.includes('github') ? 'Open GitHub' : s.link.includes('stripe') ? 'Open Stripe' : s.link.includes('upstash') ? 'Open Upstash' : 'Open'}
                            </a>
                          )}
                          {s.done === null && (
                            <label className="check">
                              <input type="checkbox" checked={Boolean(ticks[s.id])} onChange={() => tick(s.id)} /> Done
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <p className="muted small">Ticks are detected live from the server, except the ones marked “tick by hand”, which are saved in this browser.</p>
    </section>
  );
}

function Inbox({ items }) {
  const [kind, setKind] = useState('all');
  const shown = items.filter((x) => kind === 'all' || x.kind === kind);
  return (
    <section className="card">
      <div className="row row--between">
        <h2>Inbox</h2>
        <div className="seg" role="group" aria-label="Show">
          {['all', 'question', 'feedback'].map((k) => (
            <button key={k} type="button" className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>
              {k === 'all' ? 'All' : k === 'question' ? 'Questions' : 'Feedback'}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="muted">Nothing yet. Chat questions and feedback land here.</p>
      ) : (
        <ul className="owner-inbox">
          {shown.map((x, i) => (
            <li key={`${x.at}-${i}`}>
              <div className="row row--between">
                <span className="pill">{x.kind === 'feedback' ? `${x.rating}/5` : 'Question'}</span>
                <span className="muted small">{when(x.at)}{x.country ? ` · ${x.country}` : ''}</span>
              </div>
              <p>{x.text || <span className="muted">No message</span>}</p>
              {x.email && (
                <a className="small" href={`mailto:${x.email}?subject=${encodeURIComponent('Re: your message to Rollcfluence')}`}>
                  Reply to {x.email}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Bookings({ list }) {
  const view = (b) => {
    const biz = BUSINESSES[b.business];
    const svc = biz?.services.find((s) => s.id === b.service);
    const [y, m, d] = String(b.day).split('-');
    return { biz: biz?.name || b.business, svc: svc ? `${svc.en} · ${svc.min} min · €${svc.eur}` : b.service, at: `${d}.${m}.${y} ${toTime(b.start_min)}` };
  };
  return (
    <section className="card">
      <div className="row row--between">
        <h2>Bookings</h2>
        <a className="small" href="/book" target="_blank" rel="noopener">
          Open the booking page
        </a>
      </div>
      {list === null ? (
        <p className="muted">Bookings could not be read. Either the table is not set up yet (run supabase/upgrade-2026-10-21-bookings.sql once in Supabase) or the database is not answering.</p>
      ) : list.length === 0 ? (
        <p className="muted">No bookings yet. Requests from /book land here, newest first.</p>
      ) : (
        <ul className="owner-inbox">
          {list.map((b) => {
            const v = view(b);
            return (
              <li key={b.id}>
                <div className="row row--between">
                  <span className="pill">{v.at}</span>
                  <span className="muted small">
                    {v.biz} · booked {when(b.created_at)}
                  </span>
                </div>
                <p>
                  <b>{b.name}</b> · {v.svc}
                  {b.note ? <><br /><span className="muted">{b.note}</span></> : null}
                </p>
                <span className="small">
                  <a href={`tel:${String(b.phone).replace(/[^+0-9]/g, '')}`}>Call {b.phone}</a>
                  {b.email && (
                    <>
                      {' · '}
                      <a href={`mailto:${b.email}`}>{b.email}</a>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function Owner() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState([]);

  const load = async () => {
    const r = await adminApi('console');
    if (!r.ok) return setError(r.error);
    setData(r.data);
    const seen = new Set(read(SEEN) || []);
    const reached = r.data.milestones.filter((m) => m.reached).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    // Money first, then customers: the biggest news leads the banner.
    const rank = { Money: 0, Customers: 1, Product: 2, Waitlist: 3 };
    setFresh(reached.filter((m) => !seen.has(m.id)).sort((a, b) => rank[a.group] - rank[b.group] || String(b.at || '').localeCompare(String(a.at || ''))));
  };
  useEffect(() => {
    load();
  }, []);

  const dismiss = () => {
    write(SEEN, data.milestones.filter((m) => m.reached).map((m) => m.id));
    setFresh([]);
  };

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  return (
    <>
      <header className="view-head">
        <div>
          <h1>Owner console</h1>
          <p className="muted">Everything about Rollcfluence Shield in one place: setup, money, milestones, bookings and messages. Only you can see this.</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={load}>
          Refresh
        </button>
      </header>
      <Celebrate fresh={fresh} onClose={dismiss} />
      <Numbers n={data.numbers} />
      <div className="grid2">
        <Goals list={data.milestones} />
        <Payments p={data.payments} />
      </div>
      <Timeline list={data.milestones} />
      <Setup steps={data.setup} />
      <Bookings list={data.bookings ?? null} />
      <Inbox items={data.inbox} />
    </>
  );
}
