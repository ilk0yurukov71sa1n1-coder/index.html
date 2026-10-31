import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { LOOKS, VAULT } from './looks';

const STORE = 'rc-playground-v1';

const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    return {};
  }
};
const writeSaved = (all) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
};

// Only the values that differ from what is live, so the note for Claude stays short.
const changes = (look, values) =>
  Object.fromEntries(Object.entries(values).filter(([k, v]) => k !== 'src' && JSON.stringify(v) !== JSON.stringify(look.live[k])));

const fmt = (c, v) => (c.step >= 1 ? String(v) : Number(v).toFixed(c.step < 0.01 ? 3 : 2));

const hasWebGL2 = (() => {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
})();

function Control({ c, value, onChange }) {
  const id = `pg-${c.key}`;
  if (c.type === 'range') {
    return (
      <div className="pg-row">
        <label htmlFor={id}>{c.label}</label>
        <output className="mono" htmlFor={id}>{fmt(c, value)}</output>
        <input id={id} type="range" min={c.min} max={c.max} step={c.step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    );
  }
  if (c.type === 'color') {
    return (
      <div className="pg-row pg-row--inline">
        <label htmlFor={id}>{c.label}</label>
        <span className="pg-color">
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          <span className="mono">{value}</span>
        </span>
      </div>
    );
  }
  if (c.type === 'select') {
    return (
      <div className="pg-row pg-row--inline">
        <label htmlFor={id}>{c.label}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="pg-row">
      <label htmlFor={id}>{c.label}</label>
      <textarea id={id} rows={2} maxLength={40} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function VaultView({ item }) {
  const [phone, setPhone] = useState(false);
  return (
    <main className="pg-main">
      <section className="pg-stagewrap" aria-label="Preview">
        <div className={`pg-stage pg-stage--frame${phone ? ' pg-stage--phone' : ''}`}>
          <iframe key={item.id} className="pg-frame" src={item.frame} title={item.name} loading="lazy" />
        </div>
        <div className="pg-tools">
          <label className="pg-check pg-check--phone"><input type="checkbox" checked={phone} onChange={(e) => setPhone(e.target.checked)} /> Phone size</label>
        </div>
        <p className="pg-where mono">{item.frame}</p>
      </section>
      <aside className="pg-panel" aria-label="About this piece">
        <p className="pg-kind mono">{item.kind}</p>
        <h2 className="pg-vault-title">{item.name}</h2>
        <p className="pg-vault-text">{item.text}</p>
        <div className="pg-actions">
          <a className="pg-btn pg-btn--primary" href={item.frame} target="_blank" rel="noopener">Open full screen</a>
        </div>
        <p className="pg-hint">Scroll, click and play inside the preview. Tell me in our chat where on the site you want it, and I will build it in.</p>
      </aside>
    </main>
  );
}

export default function Playground() {
  const [lookId, setLookId] = useState(() => {
    const h = window.location.hash.slice(1);
    return LOOKS.concat(VAULT).some((l) => l.id === h) ? h : LOOKS[0].id;
  });
  const vaultItem = VAULT.find((x) => x.id === lookId);
  const pick = (id) => {
    setLookId(id);
    window.history.replaceState(null, '', `#${id}`);
  };
  const look = LOOKS.find((l) => l.id === lookId) || LOOKS[0];
  const [values, setValues] = useState(() => Object.fromEntries(LOOKS.map((l) => [l.id, { ...l.live }])));
  const v = values[look.id];
  const [run, setRun] = useState(0); // bumps to restart the animation
  const [phone, setPhone] = useState(false);
  const [sample, setSample] = useState(true);
  const [saved, setSaved] = useState(readSaved);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const photoUrl = useRef(null);
  const noteTimer = useRef(0);

  useEffect(() => () => {
    clearTimeout(noteTimer.current);
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
  }, []);

  const set = (key, val) => setValues((all) => ({ ...all, [lookId]: { ...all[lookId], [key]: val } }));

  // Structural values (thread count, slat size…) are read once when the effect starts, so a change restarts it.
  const restartSig = (look.restartKeys || []).map((k) => v[k]).join('|');
  const props = useMemo(() => {
    const p = look.toProps ? look.toProps(v) : v;
    return { ...p, ...look.fixed };
  }, [look, v]);

  const flash = (text) => {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 2600);
  };

  const mine = saved[lookId] || [];
  const save = (e) => {
    e.preventDefault();
    const label = name.trim().slice(0, 40) || `Look ${mine.length + 1}`;
    const { src, ...keep } = v;
    const next = { ...saved, [lookId]: [{ name: label, values: keep, at: Date.now() }, ...mine].slice(0, 12) };
    setSaved(next);
    setName('');
    flash(writeSaved(next) ? `Saved "${label}" in this browser.` : 'This browser blocked saving. Use "Copy for Claude" instead.');
  };
  const remove = (i) => {
    const next = { ...saved, [lookId]: mine.filter((_, j) => j !== i) };
    setSaved(next);
    writeSaved(next);
  };
  const load = (s) => {
    setValues((all) => ({ ...all, [lookId]: { ...look.live, ...s.values, src: all[lookId].src } }));
    setRun((n) => n + 1);
  };

  const copyForClaude = async () => {
    const diff = changes(look, v);
    const text = Object.keys(diff).length
      ? `Playground look for "${look.name}" (${look.where}). Please put these values live:\n${JSON.stringify(diff, null, 2)}`
      : `Playground: "${look.name}" has no changes from the live site.`;
    try {
      await navigator.clipboard.writeText(text);
      flash('Copied. Paste it in our chat and I will put it on the site.');
    } catch {
      window.prompt('Copy this and paste it in our chat:', text);
    }
  };

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = URL.createObjectURL(file);
    set('src', photoUrl.current);
  };

  const Comp = look.Comp;
  const changed = Object.keys(changes(look, v)).length;

  return (
    <div className="pg">
      <header className="pg-bar">
        <a className="pg-brand" href="/">
          <img src="/logo-rc.png" alt="" width="28" height="28" />
          <span>Background playground</span>
        </a>
        <p className="pg-bar__note">Changes here stay on this page until you send them to Claude.</p>
      </header>

      <nav className="pg-tabs" aria-label="On the site now">
        <span className="pg-tabs__label mono">On the site</span>
        {LOOKS.map((l) => (
          <button key={l.id} type="button" className="pg-tab" aria-pressed={l.id === lookId} onClick={() => pick(l.id)}>
            {l.name}
          </button>
        ))}
      </nav>
      <nav className="pg-tabs pg-tabs--vault" aria-label="Vault">
        <span className="pg-tabs__label mono">Vault</span>
        {VAULT.map((l) => (
          <button key={l.id} type="button" className="pg-tab" aria-pressed={l.id === lookId} onClick={() => pick(l.id)}>
            {l.name}
          </button>
        ))}
      </nav>

      {vaultItem ? <VaultView item={vaultItem} /> : (
      <main className="pg-main">
        <section className="pg-stagewrap" aria-label="Preview">
          <div className={`pg-stage pg-stage--${look.stage}${phone ? ' pg-stage--phone' : ''}`}>
            {hasWebGL2 ? (
              <Suspense fallback={<div className="pg-loading mono">Loading…</div>}>
                <div className="pg-canvas" key={`${lookId}:${run}:${restartSig}`}>
                  <Comp {...props} />
                </div>
              </Suspense>
            ) : (
              <p className="pg-loading">This browser can't draw 3D effects, so the preview is off.</p>
            )}
            {sample && (
              <div className="pg-sample" aria-hidden="true">
                <span className="mono">Sample text</span>
                <strong>Your AI, kept safe.</strong>
                <span>This shows how words read on top of the background.</span>
              </div>
            )}
          </div>
          <div className="pg-tools">
            <label className="pg-check pg-check--phone"><input type="checkbox" checked={phone} onChange={(e) => setPhone(e.target.checked)} /> Phone size</label>
            <label className="pg-check"><input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Sample text</label>
            <button type="button" className="pg-btn pg-btn--quiet" onClick={() => setRun((n) => n + 1)}>Restart animation</button>
          </div>
          <p className="pg-where mono">{look.where}</p>
        </section>

        <aside className="pg-panel" aria-label="Controls">
          {look.photo && (
            <div className="pg-photo">
              <label className="pg-btn">
                Try your own photo
                <input type="file" accept="image/*" onChange={pickPhoto} hidden />
              </label>
              {v.src !== look.live.src && (
                <button type="button" className="pg-btn pg-btn--quiet" onClick={() => set('src', look.live.src)}>Original photo</button>
              )}
              <p className="pg-hint">Your photo stays on your device. To use it on the site, upload it in our chat.</p>
            </div>
          )}

          <div className="pg-controls">
            {look.controls.map((c) => (
              <Control key={c.key} c={c} value={v[c.key]} onChange={(val) => set(c.key, val)} />
            ))}
          </div>

          <div className="pg-actions">
            <button type="button" className="pg-btn pg-btn--primary" onClick={copyForClaude}>Copy for Claude</button>
            <button
              type="button"
              className="pg-btn pg-btn--quiet"
              disabled={!changed}
              onClick={() => setValues((all) => ({ ...all, [lookId]: { ...look.live } }))}
            >
              Reset to live
            </button>
            <span className="pg-count mono">{changed ? `${changed} change${changed > 1 ? 's' : ''}` : 'Same as live'}</span>
          </div>

          <form className="pg-save" onSubmit={save}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this look" maxLength={40} aria-label="Look name" />
            <button type="submit" className="pg-btn">Save</button>
          </form>
          {note && <p className="pg-note" role="status">{note}</p>}

          {mine.length > 0 && (
            <ul className="pg-saved" aria-label="Saved looks">
              {mine.map((s, i) => (
                <li key={s.at}>
                  <button type="button" className="pg-saved__load" onClick={() => load(s)}>{s.name}</button>
                  <button type="button" className="pg-saved__del" aria-label={`Delete ${s.name}`} onClick={() => remove(i)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
      )}
    </div>
  );
}
