import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { LOOKS, VAULT } from './looks';
import { LEVELS, rankOf, scoreOf } from './rank';

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

// The exact JSX for a look with its current values, ready to paste into a page.
const jsxValue = (val) => {
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'boolean') return val ? '' : '={false}';
  return `{${JSON.stringify(val)}}`;
};
const codeFor = (look, values) => {
  const p = { ...(look.toProps ? look.toProps(values) : values), ...look.fixed };
  const items = Array.isArray(p.items) ? p.items : null;
  const lines = Object.entries(p)
    .filter(([k, val]) => k !== 'src' && val !== undefined && typeof val !== 'function')
    .map(([k, val]) => (k === 'items' ? [k, '__items'] : [k, val]))
    .map(([k, val]) => (val === true ? `  ${k}` : val === '__items' ? '  items={items}' : `  ${k}=${jsxValue(val)}`));
  const name = look.component || 'Component';
  const list = items ? `const items = ${JSON.stringify(items, null, 2)};\n\n` : '';
  return `import ${name} from './${name}';\n\n${list}<div style={{ width: '100%', height: '600px', position: 'relative' }}>\n  <${name}\n${lines.map((l) => `  ${l}`).join('\n')}\n  />\n</div>`;
};

const TIERS = [
  ['signature', 'Signature'],
  ['concierge', 'Concierge'],
  ['flagship', 'Flagship'],
  ['atelier', 'Atelier'],
];
const TIER_STORE = 'rc-playground-tiers-v1';
const readTiers = () => {
  try {
    return JSON.parse(localStorage.getItem(TIER_STORE)) || {};
  } catch {
    return {};
  }
};
const parseHash = () => {
  const [id, query = ''] = window.location.hash.slice(1).split('&');
  const t = new URLSearchParams(query).get('t');
  return { id, tiers: t ? t.split('.').filter((x) => TIERS.some(([k]) => k === x)) : null };
};


const ORDER_STORE = 'rc-playground-order-v1';
const readOrder = () => {
  try {
    const a = JSON.parse(localStorage.getItem(ORDER_STORE));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};
const ALL = LOOKS.map((l) => ({ id: l.id, name: l.name, kind: 'On the site' })).concat(VAULT.map((v) => ({ id: v.id, name: v.name, kind: v.kind })));
const byId = (id) => ALL.find((x) => x.id === id);
const linkFor = (id) => `${window.location.origin}/playground#${id}`;

const receiptText = (order, tierMap, who) => {
  const items = order.map(byId).filter(Boolean);
  const top = items.reduce((m, x) => Math.max(m, rankOf(x.id).level), 0);
  const lines = ['ROLLCFLUENCE ORDER RECEIPT', who ? `For: ${who}` : '', ''];
  items.forEach((x, i) => {
    const r = rankOf(x.id);
    const ticks = (tierMap[x.id] || []).map((k) => TIERS.find(([t]) => t === k)?.[1]).filter(Boolean);
    lines.push(`${i + 1}. ${x.name} (${x.kind})`, `   Package: ${r.label} and up${ticks.length ? `, ticked: ${ticks.join(', ')}` : ''}`, `   ${linkFor(x.id)}`);
  });
  lines.push('', `Elements: ${items.length}`, `Package needed: ${top ? LEVELS[top - 1] : 'none yet'}`);
  return lines.filter((l, i) => l !== '' || i > 1).join('\n');
};

function OrderButton({ id, order, onToggle }) {
  const has = order.includes(id);
  const r = rankOf(id);
  return (
    <div className="pg-tiers pg-orderbox">
      <p className="pg-kind mono">Package rank</p>
      <p className="pg-rank"><strong>{r.label}</strong> and up{r.niche ? <span> · {r.niche}</span> : null}</p>
      <div className="pg-actions">
        <button type="button" className={`pg-btn ${has ? 'pg-btn--quiet' : 'pg-btn--primary'}`} onClick={() => onToggle(id)}>
          {has ? 'Remove from order' : 'Add to order'}
        </button>
      </div>
    </div>
  );
}


// The receipt prints out of a slot in 3D when the order is ready: it feeds out line by line, leans toward the pointer, and gets a stamp at the end.
function ReceiptPrint({ items, top, who, play }) {
  const ref = useRef(null);
  const num = useMemo(() => String(1000 + (items.reduce((a, x) => a + x.id.length * 7, 0) % 9000)), [items]);
  const date = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), []);
  const lean = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    el.style.setProperty('--rx', `${-ny * 9}deg`);
    el.style.setProperty('--ry', `${nx * 14}deg`);
  };
  const rest = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg'); };
  return (
    <div className="pg-rc" ref={ref} onPointerMove={lean} onPointerLeave={rest}>
      <div className="pg-rc__printer" aria-hidden="true"><span className="pg-rc__led" /><span className="pg-rc__slot" /></div>
      <div className="pg-rc__tilt">
        <div className="pg-rc__paper" key={play} role="img" aria-label={`Receipt with ${items.length} elements, package needed ${top ? LEVELS[top - 1] : 'none'}`}>
          <p className="pg-rc__h">ORDER RECEIPT</p>
          <p className="pg-rc__meta"><span>No. {num}</span><span>{date}</span></p>
          {who ? <p className="pg-rc__who">For {who}</p> : null}
          <hr />
          {items.map((x, i) => (
            <p className="pg-rc__ln" key={x.id} style={{ '--i': i }}>
              <span>{String(i + 1).padStart(2, '0')} {x.name}</span><b>{rankOf(x.id).label}</b>
            </p>
          ))}
          <hr />
          <p className="pg-rc__ln pg-rc__sum" style={{ '--i': items.length }}><span>Elements</span><b>{items.length}</b></p>
          <p className="pg-rc__ln pg-rc__sum" style={{ '--i': items.length + 1 }}><span>Package needed</span><b>{top ? LEVELS[top - 1] : 'none'}</b></p>
          <div className="pg-rc__bars" aria-hidden="true" />
          <span className="pg-rc__stamp" style={{ '--i': items.length + 2 }} aria-hidden="true">READY</span>
        </div>
      </div>
    </div>
  );
}

function OrderPanel({ order, tierMap, onRemove, onClear, onClose }) {
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [play, setPlay] = useState(0);
  const items = order.map(byId).filter(Boolean);
  const top = items.reduce((m, x) => Math.max(m, rankOf(x.id).level), 0);
  const text = receiptText(order, tierMap, who.trim());
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Receipt copied. Paste it in our chat.');
    } catch {
      setNote('Copy is blocked here. Select the receipt text and copy it.');
    }
  };
  return (
    <aside className="pg-order" aria-label="Your order">
      <div className="pg-order__head">
        <h2>Order receipt</h2>
        <button type="button" className="pg-btn pg-btn--quiet" onClick={onClose}>Close</button>
      </div>
      {items.length === 0 ? (
        <p className="pg-hint">Nothing here yet. Open any design and press Add to order.</p>
      ) : (
        <>
          <ol className="pg-order__list">
            {items.map((x) => (
              <li key={x.id}>
                <span><b>{x.name}</b><em className="mono">{x.kind} · {rankOf(x.id).label}</em></span>
                <button type="button" className="pg-btn pg-btn--quiet" onClick={() => onRemove(x.id)} aria-label={`Remove ${x.name}`}>Remove</button>
              </li>
            ))}
          </ol>
          <p className="pg-order__sum mono">{items.length} element{items.length > 1 ? 's' : ''} · package needed: {LEVELS[top - 1]}</p>
          <label className="pg-order__who">For <input type="text" value={who} placeholder="Business name (optional)" onChange={(e) => setWho(e.target.value)} /></label>
          <ReceiptPrint items={items} top={top} who={who.trim()} play={`${play}:${items.length}`} />
          <div className="pg-actions">
            <button type="button" className="pg-btn pg-btn--primary" onClick={copy}>Copy receipt</button>
            <button type="button" className="pg-btn pg-btn--quiet" onClick={() => setPlay((n) => n + 1)}>Print again</button>
            <button type="button" className="pg-btn pg-btn--quiet" onClick={onClear}>Clear order</button>
          </div>
          {note && <p className="pg-note" role="status">{note}</p>}
        </>
      )}
    </aside>
  );
}

const SORTS = [
  ['pack', 'Package'],
  ['best', 'Best first (looks + hook)'],
  ['looks', 'Looks'],
  ['hook', 'Hook'],
  ['easy', 'Easiest to make'],
  ['hard', 'Hardest to make'],
  ['small', 'Least code'],
  ['big', 'Most code'],
];
const sortRows = (rows, by) => {
  const f = {
    best: (a, b) => scoreOf(b.id).total - scoreOf(a.id).total,
    looks: (a, b) => scoreOf(b.id).looks - scoreOf(a.id).looks,
    hook: (a, b) => scoreOf(b.id).hook - scoreOf(a.id).hook,
    easy: (a, b) => scoreOf(a.id).diff - scoreOf(b.id).diff || scoreOf(a.id).kb - scoreOf(b.id).kb,
    hard: (a, b) => scoreOf(b.id).diff - scoreOf(a.id).diff || scoreOf(b.id).kb - scoreOf(a.id).kb,
    small: (a, b) => scoreOf(a.id).kb - scoreOf(b.id).kb,
    big: (a, b) => scoreOf(b.id).kb - scoreOf(a.id).kb,
  }[by];
  return f ? [...rows].sort(f) : rows;
};
const kbText = (kb) => (kb >= 100 ? `${Math.round(kb)} KB` : `${kb} KB`);

function Row({ x, order, onToggle, onOpen }) {
  const r = rankOf(x.id); const sc = scoreOf(x.id);
  return (
    <li>
      <button type="button" className="pg-link" onClick={() => onOpen(x.id)}>
        <b>{x.name}</b>
        <em className="mono">{x.kind} · {r.label} · {r.niche}</em>
      </button>
      <span className="pg-scores mono" aria-label={`Looks ${sc.looks} of 10, hook ${sc.hook} of 10, difficulty ${sc.diff} of 5, code ${kbText(sc.kb)}`}>
        <span><i>Looks</i>{sc.looks}</span><span><i>Hook</i>{sc.hook}</span><span><i>Hard</i>{sc.diff}/5</span><span><i>Code</i>{kbText(sc.kb)}</span>
      </span>
      <button type="button" className={`pg-btn ${order.includes(x.id) ? 'pg-btn--quiet' : ''}`} onClick={() => onToggle(x.id)}>{order.includes(x.id) ? 'Added' : 'Add'}</button>
    </li>
  );
}

function RankingView({ order, onToggle, onOpen }) {
  const [by, setBy] = useState('pack');
  return (
    <main className="pg-rank-view">
      <p className="pg-hint">Every design with its package, looks and hook (out of 10), how hard it is to make (1 to 5) and how much code it is. Scores are my own judgement, code size is measured. Add what you want to your order, then copy the receipt.</p>
      <label className="pg-order__who pg-sortby">Sort by
        <select value={by} onChange={(e) => setBy(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      {by === 'pack' ? LEVELS.map((label, i) => {
        const rows = ALL.filter((x) => rankOf(x.id).level === i + 1);
        return (
          <section key={label} className="pg-rank-group">
            <h2>{label} <span className="mono">{rows.length}</span></h2>
            <ul>{rows.map((x) => <Row key={x.id} x={x} order={order} onToggle={onToggle} onOpen={onOpen} />)}</ul>
          </section>
        );
      }) : (
        <section className="pg-rank-group">
          <ul>{sortRows(ALL, by).map((x, i) => <Row key={x.id} x={{ ...x }} order={order} onToggle={onToggle} onOpen={onOpen} />)}</ul>
        </section>
      )}
    </main>
  );
}

// Tick which package a design belongs to. The ticks ride along in the shared link.
function TierPanel({ id, name, tiers, onChange }) {
  const [note, setNote] = useState('');
  const link = () => `${window.location.origin}/playground#${id}${tiers.length ? `&t=${tiers.join('.')}` : ''}`;
  const copy = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote(msg);
    } catch {
      setNote('Copy is blocked here. Select the address bar instead.');
    }
  };
  const toggle = (k) => onChange(tiers.includes(k) ? tiers.filter((x) => x !== k) : [...tiers, k]);
  return (
    <div className="pg-tiers">
      <p className="pg-kind mono">Package</p>
      <div className="pg-tiers__list">
        {TIERS.map(([k, label]) => (
          <label key={k} className="pg-check"><input type="checkbox" checked={tiers.includes(k)} onChange={() => toggle(k)} /> {label}</label>
        ))}
      </div>
      <div className="pg-actions">
        <button type="button" className="pg-btn" onClick={() => copy(link(), 'Link copied. It opens this design with the ticks.')}>Copy link</button>
        <button
          type="button"
          className="pg-btn pg-btn--quiet"
          onClick={() => copy(`${name}: ${tiers.length ? tiers.map((k) => TIERS.find(([x]) => x === k)[1]).join(', ') : 'no package yet'}\n${link()}`, 'Copied with the packages.')}
        >
          Copy with packages
        </button>
      </div>
      {note && <p className="pg-note" role="status">{note}</p>}
    </div>
  );
}

function VaultView({ item, tiers, onTiers, order, onToggle }) {
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
        <OrderButton id={item.id} order={order} onToggle={onToggle} />
        <TierPanel id={item.id} name={item.name} tiers={tiers} onChange={onTiers} />
        <div className="pg-actions">
          <a className="pg-btn pg-btn--primary" href={item.frame} target="_blank" rel="noopener">Open full screen</a>
        </div>
        <p className="pg-hint">Scroll, click and play inside the preview.</p>
      </aside>
    </main>
  );
}

export default function Playground() {
  const [lookId, setLookId] = useState(() => {
    const h = parseHash().id;
    return h === 'ranking' || LOOKS.concat(VAULT).some((l) => l.id === h) ? h : LOOKS[0].id;
  });
  const [tierMap, setTierMap] = useState(() => {
    const all = readTiers();
    const h = parseHash();
    return h.tiers ? { ...all, [h.id]: h.tiers } : all;
  });
  const setTiers = (id, list) => {
    setTierMap((m) => {
      const next = { ...m, [id]: list };
      try {
        localStorage.setItem(TIER_STORE, JSON.stringify(next));
      } catch {
        /* ticks stay for this visit only */
      }
      return next;
    });
  };
  const [order, setOrder] = useState(readOrder);
  const [showOrder, setShowOrder] = useState(false);
  const saveOrder = (next) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_STORE, JSON.stringify(next));
    } catch {
      /* the order stays for this visit only */
    }
  };
  const toggleOrder = (id) => saveOrder(order.includes(id) ? order.filter((x) => x !== id) : [...order, id]);
  const vaultItem = VAULT.find((x) => x.id === lookId);
  const pick = (id) => {
    setLookId(id);
    window.history.replaceState(null, '', `#${id}`);
  };
  const look = LOOKS.find((l) => l.id === lookId) || LOOKS[0];
  const ranking = lookId === 'ranking';
  const [values, setValues] = useState(() => Object.fromEntries(LOOKS.map((l) => [l.id, { ...l.live }])));
  const v = values[look.id];
  const [run, setRun] = useState(0); // bumps to restart the animation
  const [phone, setPhone] = useState(false);
  const [sample, setSample] = useState(true);
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

  const code = useMemo(() => codeFor(look, v), [look, v]);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      flash('Code copied.');
    } catch {
      flash('Copy is blocked here. Select the code and copy it.');
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
          <span>Design playground</span>
        </a>
        <p className="pg-bar__note">Pick a design, try it live, and copy the code.</p>
        <div className="pg-bar__acts">
          <button type="button" className="pg-btn" aria-pressed={ranking} onClick={() => pick('ranking')}>Ranking</button>
          <button type="button" className="pg-btn pg-btn--primary" onClick={() => setShowOrder((v) => !v)}>Order ({order.length})</button>
        </div>
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

      {showOrder && <OrderPanel order={order} tierMap={tierMap} onRemove={toggleOrder} onClear={() => saveOrder([])} onClose={() => setShowOrder(false)} />}
      {ranking ? <RankingView order={order} onToggle={toggleOrder} onOpen={pick} /> : vaultItem ? <VaultView item={vaultItem} tiers={tierMap[vaultItem.id] || []} onTiers={(l) => setTiers(vaultItem.id, l)} order={order} onToggle={toggleOrder} /> : (
      <main className="pg-main">
        <section className="pg-stagewrap" aria-label="Preview">
          <div className={`pg-stage pg-stage--${look.stage}${phone ? ' pg-stage--phone' : ''}`}>
            {hasWebGL2 || look.noGL ? (
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

          <OrderButton id={look.id} order={order} onToggle={toggleOrder} />
          <TierPanel id={look.id} name={look.name} tiers={tierMap[look.id] || []} onChange={(l) => setTiers(look.id, l)} />

          <div className="pg-controls">
            {look.controls.map((c) => (
              <Control key={c.key} c={c} value={v[c.key]} onChange={(val) => set(c.key, val)} />
            ))}
          </div>

          <div className="pg-actions">
            <button type="button" className="pg-btn pg-btn--primary" onClick={copyCode}>Copy code</button>
            <button
              type="button"
              className="pg-btn pg-btn--quiet"
              disabled={!changed}
              onClick={() => setValues((all) => ({ ...all, [lookId]: { ...look.live } }))}
            >
              Reset
            </button>
            <span className="pg-count mono">{changed ? `${changed} change${changed > 1 ? 's' : ''}` : 'Default settings'}</span>
          </div>
          {note && <p className="pg-note" role="status">{note}</p>}
          <pre className="pg-code mono" tabIndex={0}>{code}</pre>
        </aside>
      </main>
      )}
    </div>
  );
}
