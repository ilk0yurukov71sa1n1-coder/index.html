import { useEffect, useState } from 'react';
import { api, when } from '../api';

const KINDS = {
  email: { name: 'Email', placeholder: 'you@company.com', help: 'Works with Gmail or any inbox.' },
  slack: { name: 'Slack', placeholder: 'https://hooks.slack.com/services/…', help: 'Slack → Apps → Incoming Webhooks → Add to a channel, then paste the URL.' },
  discord: { name: 'Discord', placeholder: 'https://discord.com/api/webhooks/…', help: 'Channel settings → Integrations → Webhooks → New webhook → Copy URL.' },
  webhook: { name: 'Webhook', placeholder: 'https://your-app.com/shield-alerts', help: 'We POST JSON signed with HMAC-SHA256 (X-Shield-Signature) so your app can trust it.' },
};
const DEFAULT_EVENTS = ['cap_warning', 'cap_reached', 'key_locked', 'injection_blocked'];

function Channel({ c, events, onChanged }) {
  const [msg, setMsg] = useState('');
  const toggle = async (ev) => {
    const next = c.events.includes(ev) ? c.events.filter((e) => e !== ev) : [...c.events, ev];
    if (!next.length) return setMsg('Keep at least one event, or remove the channel.');
    const r = await api('alerts', { method: 'PATCH', body: { id: c.id, events: next } });
    setMsg(r.ok ? '' : r.error);
    if (r.ok) onChanged();
  };
  const test = async () => {
    setMsg('Sending…');
    const r = await api('alerttest', { method: 'POST', body: { id: c.id } });
    setMsg(r.ok ? 'Test sent. Check the channel.' : r.error);
    onChanged();
  };
  const remove = async () => {
    if (!window.confirm('Remove this alert channel?')) return;
    const r = await api('alerts', { method: 'DELETE', query: `&id=${c.id}` });
    if (!r.ok) return setMsg(r.error);
    onChanged();
  };
  return (
    <section className="card channel">
      <div className="key__head">
        <div>
          <h2>
            {c.label || KINDS[c.kind]?.name} <span className="pill">{KINDS[c.kind]?.name}</span>
          </h2>
          <code className="muted">{c.target_hint}</code>
        </div>
        <span className="small muted">
          {c.last_sent_at ? (
            <>
              Last sent {when(c.last_sent_at)} <span className={`pill ${c.last_ok ? 'ok' : 'bad'}`}>{c.last_ok ? 'delivered' : 'failed'}</span>
            </>
          ) : (
            'Nothing sent yet'
          )}
        </span>
      </div>
      <div className="events">
        {Object.entries(events).map(([id, text]) => (
          <label key={id} className="toggle">
            <input type="checkbox" checked={c.events.includes(id)} onChange={() => toggle(id)} />
            <span>{text}</span>
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn btn--ghost" type="button" onClick={test}>
          Send test alert
        </button>
        <button className="btn btn--ghost" type="button" onClick={remove}>
          Remove
        </button>
        {msg && <span className="small" role="status">{msg}</span>}
      </div>
    </section>
  );
}

export default function Alerts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('email');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const [chosen, setChosen] = useState(DEFAULT_EVENTS);
  const [secret, setSecret] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const r = await api('alerts');
    if (r.ok) setData(r.data);
    else setError(r.error);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setMsg('Adding…');
    const r = await api('alerts', { method: 'POST', body: { kind, target, label, events: chosen } });
    if (!r.ok) return setMsg(r.error);
    setMsg('Added. Send a test alert to check it works.');
    setTarget('');
    setLabel('');
    setSecret(r.data.signing_secret || null);
    load();
  };

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const pick = (ev) => setChosen(chosen.includes(ev) ? chosen.filter((x) => x !== ev) : [...chosen, ev]);

  return (
    <>
      <header className="view-head">
        <h1>Alerts and integrations</h1>
        <p className="muted">Hear about spend caps, attacks and locked keys where you already are. Repeats are bundled: at most one alert per key and event every 15 minutes.</p>
      </header>

      {secret && (
        <section className="card reveal" role="alert">
          <h2>Copy your webhook signing secret now</h2>
          <p className="muted">Use it to check the X-Shield-Signature header: HMAC-SHA256 of "timestamp.body". It is shown only once.</p>
          <div className="row">
            <code className="secret">{secret}</code>
            <button className="btn btn--ghost" type="button" onClick={() => setSecret(null)}>
              I saved it
            </button>
          </div>
        </section>
      )}

      <form className="card" onSubmit={add}>
        <h2>Add a channel</h2>
        <div className="seg" role="radiogroup" aria-label="Channel type">
          {Object.entries(KINDS).map(([id, k]) => (
            <button key={id} type="button" role="radio" aria-checked={kind === id} className={kind === id ? 'is-on' : ''} onClick={() => setKind(id)}>
              {k.name}
            </button>
          ))}
        </div>
        <p className="muted small">{KINDS[kind].help}</p>
        {kind === 'email' && !data.email && <p className="error">Email sending is not switched on yet (RESEND_API_KEY), so email alerts cannot be added.</p>}
        {kind !== 'email' && !data.encryption && <p className="error">Webhook URLs are stored encrypted, which needs ENCRYPTION_KEY set in Vercel first.</p>}
        <div className="limits">
          <label className="field field--wide">
            <span>{kind === 'email' ? 'Email address' : 'Webhook URL'}</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={KINDS[kind].placeholder} type={kind === 'email' ? 'email' : 'url'} required />
          </label>
          <label className="field field--wide">
            <span>Name (optional)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Ops channel" />
          </label>
          <div className="events field--wide">
            {Object.entries(data.events).map(([id, text]) => (
              <label key={id} className="toggle">
                <input type="checkbox" checked={chosen.includes(id)} onChange={() => pick(id)} />
                <span>{text}</span>
              </label>
            ))}
          </div>
          <div className="row">
            <button className="btn" type="submit" disabled={!chosen.length}>
              Add channel
            </button>
            {msg && <span className="small" role="status">{msg}</span>}
          </div>
        </div>
      </form>

      {data.channels.length === 0 && <p className="muted">No alert channels yet.</p>}
      {data.channels.map((c) => (
        <Channel key={c.id} c={c} events={data.events} onChanged={load} />
      ))}
    </>
  );
}
