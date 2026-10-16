import { useEffect, useRef, useState } from 'react';
import { chat, faq, links } from '../../config/site';
import LatticeLoader from '../reactbits/LatticeLoader';
import './ChatHelper.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STOP = new Set(['the', 'a', 'an', 'is', 'it', 'do', 'does', 'i', 'my', 'you', 'your', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'can', 'what', 'how', 'with', 'be', 'are', 'if', 'me', 'we', 'much']);
const words = (t) => t.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => !STOP.has(w)) ?? [];

// Every answer the helper knows: the FAQ section plus chat.extra.
const KNOWN = [
  ...faq.items.map((f) => ({ q: f.q, a: f.a, keys: new Set(words(f.q + ' ' + f.a)) , title: new Set(words(f.q)) })),
  ...chat.extra.map((f) => ({ q: f.q, a: f.a, keys: new Set([...words(f.q), ...f.keywords]), title: new Set([...words(f.q), ...f.keywords]) })),
];

const answer = (text) => {
  const asked = words(text);
  let best = null;
  let bestScore = 0;
  for (const k of KNOWN) {
    const score = asked.reduce((n, w) => n + (k.title.has(w) ? 2 : k.keys.has(w) ? 1 : 0), 0);
    if (score > bestScore) [best, bestScore] = [k, score];
  }
  return bestScore >= 2 ? best.a : null;
};

// Small FAQ chat in the corner. Unanswered questions go to /api/questions.
export default function ChatHelper() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([{ from: 'bot', text: chat.greeting }]);
  const [pending, setPending] = useState(null); // question waiting for an email
  const [status, setStatus] = useState('idle');
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [log, pending]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = (text) => {
    const q = text.trim().slice(0, 2000);
    if (!q) return;
    const a = answer(q);
    setLog((l) => [...l, { from: 'me', text: q }, { from: 'bot', text: a ?? chat.noMatch }]);
    setPending(a ? null : q);
    setStatus('idle');
  };

  const onAsk = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    ask(String(f.get('q') || ''));
    e.currentTarget.reset();
  };

  const onEmail = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') || '').trim();
    if (!EMAIL.test(email) || email.length > 254) {
      setStatus('bad');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, question: pending, company: f.get('company') || '' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setLog((l) => [...l, { from: 'bot', text: chat.thanks }]);
      setPending(null);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className={`chat ${open ? 'is-open' : ''}`}>
      <section className="chat__panel" role="dialog" aria-label={chat.title} aria-hidden={!open} inert={!open}>
        <header className="chat__head">
          <img src="/logo-rc.svg" alt="" width="22" height="22" />
          <p>{chat.title}</p>
          <button type="button" className="chat__close" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
        </header>

        <div className="chat__body" ref={bodyRef} aria-live="polite">
          {log.map((m, i) => (
            <p key={i} className={`chat__msg chat__msg--${m.from}`}>{m.text}</p>
          ))}
          {log.length === 1 ? (
            <div className="chat__chips">
              {chat.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          ) : null}
          {pending ? (
            <form className="chat__email" onSubmit={onEmail} noValidate>
              <input type="email" name="email" placeholder={chat.askEmail} aria-label={chat.askEmail} autoComplete="email" required maxLength={254} />
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="chat__trap" aria-hidden="true" />
              <button type="submit" disabled={status === 'sending'}>{chat.send}</button>
              {status === 'sending' ? (
                <span className="chat__sending">
                  <LatticeLoader label="Sending to the team" color="#7d1d20" cellSize={4} fontSize={12} showTimer={false} />
                </span>
              ) : null}
              {status === 'bad' ? <span className="chat__err">Enter a valid email.</span> : null}
              {status === 'error' ? (
                <span className="chat__err">
                  That didn't send. Email us at <a href={links.contact}>{links.email}</a>.
                </span>
              ) : null}
            </form>
          ) : null}
        </div>

        <form className="chat__ask" onSubmit={onAsk}>
          <input ref={inputRef} name="q" placeholder="Type your question" aria-label="Your question" maxLength={2000} autoComplete="off" />
          <button type="submit" aria-label="Ask">→</button>
        </form>
        <p className="chat__foot mono">
          or email <a href={links.contact}>{links.email}</a>
        </p>
      </section>

      <button type="button" className="chat__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="chat__toggle-dot" aria-hidden="true" />
        {open ? 'Close' : chat.button}
      </button>
    </div>
  );
}
