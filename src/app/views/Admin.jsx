import { useEffect, useState } from 'react';
import { adminApi, when } from '../api';

const STATUS = { sent: 'Key sent', already_has_key: 'Already had a key', email_failed: 'Email failed, nothing created', error: 'Error' };

export default function Admin() {
  const [rows, setRows] = useState(null);
  const [mail, setMail] = useState(true);
  const [pick, setPick] = useState(new Set());
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('waiting');

  const load = async () => {
    const r = await adminApi('waitlist');
    if (!r.ok) return setError(r.error);
    setRows(r.data.waitlist);
    setMail(r.data.mail);
  };
  useEffect(() => {
    load();
  }, []);

  const approve = async (body, label) => {
    if (!window.confirm(`${label}? Each person gets an email with their key and a sign-in link.`)) return;
    setBusy(true);
    setError('');
    const r = await adminApi('approve', { method: 'POST', body });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResults(r.data.results);
    setPick(new Set());
    load();
  };

  if (!rows) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const waiting = rows.filter((w) => !w.approved_at);
  const confirmed = waiting.filter((w) => w.verified);
  const shown = filter === 'waiting' ? waiting : rows;
  const toggle = (email) => {
    const next = new Set(pick);
    next.has(email) ? next.delete(email) : next.add(email);
    setPick(next);
  };

  return (
    <>
      <header className="view-head">
        <h1>Waitlist</h1>
        <p className="muted">
          {rows.length} signups · {confirmed.length} confirmed and waiting · {rows.length - waiting.length} let in. Approving creates the account and a first key with $10/day, $100/month and 60 requests a minute, then emails it.
        </p>
      </header>
      {!mail && <p className="error">Email is not switched on yet, so nobody can be approved yet.</p>}
      {error && <p className="error">{error}</p>}

      <div className="card row">
        <button className="btn" type="button" disabled={busy || !mail || !confirmed.length} onClick={() => approve({ next: 100 }, `Let in the next ${Math.min(100, confirmed.length)} confirmed signups`)}>
          Approve next {Math.min(100, confirmed.length)} confirmed
        </button>
        <button className="btn btn--ghost" type="button" disabled={busy || !mail || !pick.size} onClick={() => approve({ emails: [...pick] }, `Let in ${pick.size} selected`)}>
          Approve selected ({pick.size})
        </button>
        <div className="seg" role="group" aria-label="Show">
          <button type="button" className={filter === 'waiting' ? 'is-on' : ''} onClick={() => setFilter('waiting')}>Waiting</button>
          <button type="button" className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>Everyone</button>
        </div>
        {busy && <span className="small">Sending emails…</span>}
      </div>

      {results && (
        <section className="card">
          <h2>Last approval</h2>
          <ul className="plain">
            {results.map((r) => (
              <li key={r.email}>
                {r.email} · <span className={`pill ${r.status === 'sent' ? 'ok' : r.status === 'already_has_key' ? '' : 'bad'}`}>{STATUS[r.status] || r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        {shown.length === 0 ? <p className="muted">Nobody here yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th aria-label="Select" /><th>Email</th><th>Goal</th><th>Country</th><th>Email confirmed</th><th>Signed up</th><th>Let in</th></tr></thead>
              <tbody>
                {shown.map((w) => (
                  <tr key={w.email}>
                    <td>{!w.approved_at && <input type="checkbox" checked={pick.has(w.email)} onChange={() => toggle(w.email)} aria-label={`Select ${w.email}`} />}</td>
                    <td>{w.email}</td>
                    <td>{w.goal || '–'}</td>
                    <td>{w.country || '–'}</td>
                    <td>{w.verified ? <span className="pill ok">Yes</span> : <span className="pill">No</span>}</td>
                    <td>{when(w.created_at)}</td>
                    <td>{w.approved_at ? when(w.approved_at) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
