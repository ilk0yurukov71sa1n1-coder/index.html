import { useEffect, useState } from 'react';
import { api, when } from '../api';
import { FALLBACK_RATE, PRESETS } from '../../../api/_lib/compat.js';

const LIST = [
  { id: 'openai', name: 'OpenAI', hint: 'sk-…', where: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic', hint: 'sk-ant-…', where: 'https://console.anthropic.com/settings/keys' },
];

// One form for every provider with an OpenAI-compatible API.
function Compat({ saved, onSaved, remove, msg, setMsg, encryption }) {
  const [f, setF] = useState({ name: PRESETS[0][0], base_url: PRESETS[0][1], key: '', price_in: '', price_out: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const preset = (e) => {
    const hit = PRESETS.find(([n]) => n === e.target.value);
    setF({ ...f, name: hit ? hit[0] : '', base_url: hit ? hit[1] : '' });
  };
  const save = async (e) => {
    e.preventDefault();
    setMsg({ compat: 'Saving…' });
    const r = await api('providers', { method: 'POST', body: { provider: 'compat', ...f } });
    setMsg({ compat: r.ok ? 'Saved and encrypted.' : r.error });
    if (r.ok) {
      setF({ ...f, key: '' });
      onSaved();
    }
  };
  const base = window.location.origin;
  return (
    <section className="card provider">
      <div className="provider__head">
        <h2>Any OpenAI-compatible provider</h2>
        {saved ? <span className="pill ok">{saved.name || 'Saved'} · {saved.host} · ends in {saved.last4}</span> : <span className="pill">Not added</span>}
      </div>
      <p className="muted small">
        Google Gemini, Mistral, Groq, DeepSeek, xAI, Cohere, Azure OpenAI, AWS Bedrock, OpenRouter, Together, Fireworks, Perplexity and any other provider with an OpenAI-style chat API. Pick one or paste its base URL. One at a time; saving
        replaces the previous one.
      </p>
      <form className="grid2" onSubmit={save}>
        <label className="field">
          Provider
          <select value={PRESETS.some(([n]) => n === f.name) ? f.name : ''} onChange={preset}>
            {PRESETS.map(([n]) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="">Other (enter the URL)</option>
          </select>
        </label>
        <label className="field">
          Base URL
          <input value={f.base_url} onChange={set('base_url')} placeholder="https://api.example.com/v1" spellCheck="false" />
        </label>
        <label className="field field--wide">
          API key
          <input type="password" autoComplete="off" spellCheck="false" value={f.key} onChange={set('key')} placeholder={saved ? 'Paste a key to save or replace' : 'Your key from that provider'} />
        </label>
        <label className="field">
          Input price, $ per 1M tokens (optional)
          <input inputMode="decimal" value={f.price_in} onChange={set('price_in')} placeholder={String(FALLBACK_RATE[0])} />
        </label>
        <label className="field">
          Output price, $ per 1M tokens (optional)
          <input inputMode="decimal" value={f.price_out} onChange={set('price_out')} placeholder={String(FALLBACK_RATE[1])} />
        </label>
        <div className="row field--wide">
          <button className="btn" type="submit" disabled={!f.key || !f.base_url || !encryption}>
            Save
          </button>
          {saved && (
            <button className="btn btn--ghost" type="button" onClick={() => remove('compat')}>
              Remove
            </button>
          )}
        </div>
      </form>
      {PRESETS.find(([n]) => n === f.name)?.[2] && <p className="muted small">{PRESETS.find(([n]) => n === f.name)[2]}</p>}
      {msg.compat && <p className="small" role="status">{msg.compat}</p>}
      <p className="muted small">
        Without prices, spend caps count every token at ${FALLBACK_RATE[0]} in and ${FALLBACK_RATE[1]} out per 1M, so a cap can never be under-counted. In your code, point the OpenAI SDK at{' '}
        <code>{base}/v1/compat</code> with your Shield key.
      </p>
    </section>
  );
}

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
      <Compat
        saved={saved.compat}
        encryption={encryption}
        msg={msg}
        setMsg={setMsg}
        remove={remove}
        onSaved={() => {
          load();
          refreshMe();
        }}
      />
    </>
  );
}
