import { useEffect, useRef, useState } from 'react';
import { chat, faq, links, ui } from '../../config/site';
import { english } from '../../config/i18n';
import { makeBrain, words } from './chatBrain';
import LatticeLoader from '../reactbits/LatticeLoader';
import './ChatHelper.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const t = ui.chatUi;

// Every answer the helper knows: the FAQ section plus chat.extra, each with
// its English original so English questions match on translated pages too.
const brain = makeBrain([
  ...faq.items.map((f, i) => ({ q: f.q, a: f.a, keys: f.keywords, en: english.faq[i] && { ...english.faq[i], keys: english.faq[i].keywords } })),
  ...chat.extra.map((f, i) => ({ q: f.q, a: f.a, keys: f.keywords, en: english.extra[i] && { ...english.extra[i], keys: english.extra[i].keywords } })),
]);

const HELLO = /^(hi|hey|hello|hiya|yo|good (morning|afternoon|evening)|здравей|здрасти|hallo|bonjour|salut|hola)(?![\p{L}])/iu;
const THANKS = /(thanks|thank you|thx|cheers|appreciate|благодаря|мерси|danke|merci|gracias)/i;
let turn = 0;

// A warm reply from the built-in answers, with follow-up questions to tap.
const reply = (text) => {
  if (THANKS.test(text)) return { text: chat.thanksReply, known: true };
  if (HELLO.test(text.trim()) && words(text).length <= 2) return { text: chat.hello, known: true, chips: chat.suggestions, chipsLabel: '' };
  const { answer, related, unsure } = brain.ask(text);
  if (unsure) return { text: t.didYouMean, known: true, chips: related.map((r) => r.q), chipsLabel: '' };
  if (!answer) return { text: chat.noMatch, known: false, chips: related.map((r) => r.q), chipsLabel: t.related };
  const opener = chat.openers[turn++ % chat.openers.length];
  return { text: `${opener} ${answer.a}`, known: true, chips: related.map((r) => r.q), chipsLabel: t.related };
};

const Mark = ({ size = 22 }) => <img className="chat__mark" src="/logo-rc.png" alt="" width={size} height={size} />;

// Small FAQ chat in the corner. Unanswered questions go to /api/questions.
export default function ChatHelper() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([{ from: 'bot', text: chat.greeting }]);
  const [pending, setPending] = useState(null); // question waiting for an email
  const [status, setStatus] = useState('idle');
  const [thinking, setThinking] = useState(false);
  const aiOff = useRef(false); // set once the server says the AI is not available
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [log, pending, thinking]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Built-in FAQ answer, used when the AI assistant is off or busy.
  const faqAnswer = (q) => {
    const r = reply(q);
    setLog((l) => [...l, { from: 'bot', text: r.text, chips: r.chips, chipsLabel: r.chipsLabel }]);
    setPending(r.known ? null : q);
  };

  const ask = async (text) => {
    const q = text.trim().slice(0, 1500);
    if (!q || thinking) return;
    const history = [...log.slice(1), { from: 'me', text: q }];
    setLog((l) => [...l, { from: 'me', text: q }]);
    setPending(null);
    setStatus('idle');
    if (aiOff.current) return faqAnswer(q);
    setThinking(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: document.documentElement.lang, messages: history.map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', text: m.text })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ai && data.text) {
        setLog((l) => [...l, { from: 'bot', text: data.text, ai: true }]);
      } else {
        if (res.ok && !data.reason) aiOff.current = true;
        faqAnswer(q);
      }
    } catch {
      faqAnswer(q);
    } finally {
      setThinking(false);
    }
  };

  // After an AI answer, the visitor can still hand the question to a person.
  const lastMine = [...log].reverse().find((m) => m.from === 'me')?.text;
  const showFollow = !pending && !thinking && log[log.length - 1]?.ai;

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
          <Mark size={30} />
          <div className="chat__who">
            <p>{chat.title}</p>
            <span className="chat__status">{chat.status}</span>
          </div>
          <button type="button" className="chat__close" onClick={() => setOpen(false)} aria-label={t.close}>×</button>
        </header>

        <div className="chat__body" ref={bodyRef} aria-live="polite">
          {log.map((m, i) => (
            m.from === 'bot' ? (
              <div key={i} className="chat__row">
                <Mark size={22} />
                <p className="chat__msg chat__msg--bot">{m.text}</p>
              </div>
            ) : (
              <p key={i} className="chat__msg chat__msg--me">{m.text}</p>
            )
          ))}
          {!thinking && (log.length === 1 || log[log.length - 1].chips?.length) ? (
            <div className="chat__chips">
              {log[log.length - 1].chipsLabel ? <span className="chat__chips-label">{log[log.length - 1].chipsLabel}</span> : null}
              {(log.length === 1 ? chat.suggestions : log[log.length - 1].chips).map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          ) : null}
          {thinking ? (
            <div className="chat__row">
              <Mark size={22} />
              <p className="chat__msg chat__msg--bot chat__msg--thinking">{t.thinking}</p>
            </div>
          ) : null}
          {showFollow ? (
            <button type="button" className="chat__follow" onClick={() => setPending(lastMine)}>
              {t.leaveEmail}
            </button>
          ) : null}
          {pending ? (
            <form className="chat__email" onSubmit={onEmail} noValidate>
              <input type="email" name="email" placeholder={chat.askEmail} aria-label={chat.askEmail} autoComplete="email" required maxLength={254} />
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="chat__trap" aria-hidden="true" />
              <button type="submit" disabled={status === 'sending'}>{chat.send}</button>
              {status === 'sending' ? (
                <span className="chat__sending">
                  <LatticeLoader label={t.sendingTeam} color="#7d1d20" cellSize={4} fontSize={12} showTimer={false} />
                </span>
              ) : null}
              {status === 'bad' ? <span className="chat__err">{t.badEmail}</span> : null}
              {status === 'error' ? (
                <span className="chat__err">
                  {t.notSent} <a href={links.contact}>{links.email}</a>.
                </span>
              ) : null}
            </form>
          ) : null}
        </div>

        <form className="chat__ask" onSubmit={onAsk}>
          <input ref={inputRef} name="q" placeholder={t.placeholder} aria-label={t.question} maxLength={2000} autoComplete="off" />
          <button type="submit" aria-label={t.ask} disabled={thinking}>→</button>
        </form>
        <p className="chat__foot mono">
          {log.some((m) => m.ai) ? `${t.aiNote} ` : ''}
          {t.orEmail} <a href={links.contact}>{links.email}</a>
        </p>
      </section>

      <button
        type="button"
        className={`chat__toggle${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t.close : chat.button}
        title={open ? t.close : chat.button}
      >
        {open ? <span className="chat__x" aria-hidden="true">×</span> : <Mark size={40} />}
      </button>
    </div>
  );
}
