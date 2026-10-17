import { useEffect, useState } from 'react';
import { api, when } from '../api';

const LIST = [
  { id: 'openai', name: 'OpenAI', hint: 'sk-…', where: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic', hint: 'sk-ant-…', where: 'https://console.anthropic.com/settings/keys' },
];

export default function Providers({ refreshMe }) {
  const [saved, setSaved] = useState(null);
  const [encryption, setEncryption] = useState(true);
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState({});

  const load = async () => {
    const r = await api('providers');
    if (r.ok) {
      setSaved(Object.fromEntries(r.data.providers.map((p) => [p.provider, p])));
      setEncryption(r.data.encryption);
    } else setMsg({ all: r.error });
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (id) => {
    setMsg({ [id]: 'Saving…' });
    const r = await api('providers', { method: 'POST', body: { provider: id, key: draft[id] || '' } });
    setMsg({ [id]: r.ok ? 'Saved and encrypted.' : r.error });
    if (r.ok) {
      setDraft({ ...draft, [id]: '' });
      load();
      refreshMe();
    }
  };
  const remove = async (id) => {
    if (!window.confirm('Remove this key? Requests to this provider will stop until you add one again.')) return;
    const r = await api('providers', { method: 'DELETE', query: `&provider=${id}` });
    setMsg({ [id]: r.ok ? 'Removed.' : r.error });
    load();
    refreshMe();
  };

  if (msg.all) return <p className="error">{msg.all}</p>;
  if (!saved) return <p className="muted">Loading…</p>;

  return (
    <>
      <header className="view-head">
        <h1>Provider keys</h1>
        <p className="muted">
          Shield calls the provider with your own key, so you keep your provider account and its prices. Keys are encrypted with AES-256-GCM before they are stored and are never sent back to this page.
        </p>
      </header>
      {!encryption && <p className="error">Saving is not switched on yet.</p>}
      {LIST.map((p) => (
        <section className="card provider" key={p.id}>
          <div className="provider__head">
            <h2>{p.name}</h2>
            {saved[p.id] ? <span className="pill ok">Saved · ends in {saved[p.id].last4}</span> : <span className="pill">Not added</span>}
          </div>
          {saved[p.id] && <p className="muted small">Added {when(saved[p.id].created_at)}</p>}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              save(p.id);
            }}
          >
            <input type="password" autoComplete="off" spellCheck="false" placeholder={saved[p.id] ? 'Paste a new key to replace it' : p.hint} value={draft[p.id] || ''} onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value })} aria-label={`${p.name} API key`} />
            <button className="btn" type="submit" disabled={!draft[p.id]}>
              Save
            </button>
            {saved[p.id] && (
              <button className="btn btn--ghost" type="button" onClick={() => remove(p.id)}>
                Remove
              </button>
            )}
          </form>
          {msg[p.id] && <p className="small" role="status">{msg[p.id]}</p>}
          <p className="muted small">
            Get one at{' '}
            <a className="link" href={p.where} target="_blank" rel="noreferrer">
              {p.where.replace('https://', '')}
            </a>
            . Tip: set a usage limit there too.
          </p>
        </section>
      ))}
    </>
  );
}
