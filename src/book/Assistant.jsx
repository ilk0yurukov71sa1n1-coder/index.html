import { useEffect, useRef, useState } from 'react';
import { DEMO, PHONE } from '../../api/_lib/booking.js';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COPY = {
  bg: {
    open: 'Въпрос?',
    title: 'Попитайте салона',
    sub: 'AI асистент. Отговаря от информацията на салона.',
    hello: 'Здравейте! Питайте ме за услугите, цените или работното време. Мога и да ви насоча към записване.',
    ideas: ['Колко струва боядисване?', 'Работите ли в събота?', 'Колко трае маникюрът?'],
    placeholder: 'Напишете въпрос…',
    send: 'Изпрати',
    close: 'Затвори',
    thinking: 'Пише…',
    book: (name) => `Запазете час: ${name}`,
    toTeam: 'Предайте въпроса на екипа',
    off: 'Асистентът не е на линия в момента. Оставете въпроса си и екипът ще ви се обади.',
    cap: 'Асистентът почива за днес. Оставете въпроса си и екипът ще ви се обади.',
    slow: 'Твърде много въпроси за минута. Опитайте пак след малко.',
    form: 'Екипът ще ви отговори лично.',
    name: 'Име',
    phone: 'Телефон',
    email: 'или имейл',
    question: 'Вашият въпрос',
    sendTeam: 'Изпратете на екипа',
    sent: 'Изпратено. Екипът ще се свърже с вас.',
    errors: { invalid_name: 'Напишете името си.', need_contact: 'Оставете телефон или имейл.', invalid_phone: 'Проверете телефона.', invalid_email: 'Проверете имейла.', invalid_question: 'Напишете въпроса си.', other: 'Не успяхме да изпратим. Опитайте отново.' },
    note: 'Не пишете телефон, имейл или карта в чата: скриваме ги, преди да стигнат до AI.',
  },
  en: {
    open: 'Questions?',
    title: 'Ask the salon',
    sub: 'AI assistant. Answers from the salon’s own information.',
    hello: 'Hello! Ask me about services, prices or opening hours. I can also take you to booking.',
    ideas: ['How much is root colour?', 'Are you open on Saturday?', 'How long is a manicure?'],
    placeholder: 'Type a question…',
    send: 'Send',
    close: 'Close',
    thinking: 'Typing…',
    book: (name) => `Book: ${name}`,
    toTeam: 'Pass my question to the team',
    off: 'The assistant is offline right now. Leave your question and the team will get back to you.',
    cap: 'The assistant is resting for today. Leave your question and the team will get back to you.',
    slow: 'Too many questions in a minute. Please try again shortly.',
    form: 'The team will answer you in person.',
    name: 'Name',
    phone: 'Phone',
    email: 'or email',
    question: 'Your question',
    sendTeam: 'Send to the team',
    sent: 'Sent. The team will get in touch.',
    errors: { invalid_name: 'Please write your name.', need_contact: 'Please leave a phone or an email.', invalid_phone: 'Please check the phone.', invalid_email: 'Please check the email.', invalid_question: 'Please write your question.', other: 'Could not send. Please try again.' },
    note: 'Please don’t type phone numbers, emails or cards in the chat: we hide them before they reach the AI.',
  },
};

const post = async (body) => {
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business: DEMO.id, ...body }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

export default function Assistant({ lang, onBook }) {
  const t = COPY[lang] || COPY.bg;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]); // { role, text, book?, handover? }
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState(null); // null | { reason } shows the hand-over form
  const [f, setF] = useState({ name: '', phone: '', email: '', question: '' });
  const [sent, setSent] = useState('idle'); // idle | sending | done | error code
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, team]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    if (open) window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const lastQuestion = () => [...msgs].reverse().find((m) => m.role === 'user')?.text || '';
  const showTeam = (reason) => {
    setTeam({ reason });
    setF((v) => ({ ...v, question: v.question || lastQuestion() }));
  };

  const ask = async (q) => {
    const question = q.trim().slice(0, 600);
    if (!question || busy) return;
    const next = [...msgs, { role: 'user', text: question }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      const r = await post({ lang, messages: next.map(({ role, text }) => ({ role, text })) });
      if (r.status === 429) setMsgs((m) => [...m, { role: 'assistant', text: t.slow, local: true }]);
      else if (r.body.ai) setMsgs((m) => [...m, { role: 'assistant', text: r.body.text, book: r.body.book, handover: r.body.handover }]);
      else {
        setMsgs((m) => [...m, { role: 'assistant', text: r.body.reason === 'cap' ? t.cap : t.off, local: true }]);
        setTeam({ reason: 'off' });
        setF((v) => ({ ...v, question: v.question || question }));
      }
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: t.off, local: true }]);
      setTeam({ reason: 'off' });
    } finally {
      setBusy(false);
    }
  };

  const sendTeam = async (e) => {
    e.preventDefault();
    if (sent === 'sending') return;
    if (f.name.trim().length < 2) return setSent('invalid_name');
    if (!f.phone.trim() && !f.email.trim()) return setSent('need_contact');
    if (f.phone.trim() && !PHONE.test(f.phone.trim())) return setSent('invalid_phone');
    if (f.email.trim() && !EMAIL_OK.test(f.email.trim())) return setSent('invalid_email');
    if (f.question.trim().length < 2) return setSent('invalid_question');
    setSent('sending');
    try {
      const transcript = msgs.filter((m) => !m.local).map(({ role, text }) => ({ role, text }));
      const r = await post({ lang, handover: { ...f, transcript } });
      setSent(r.status === 200 ? 'done' : r.body.error in t.errors ? r.body.error : 'other');
    } catch {
      setSent('other');
    }
  };

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const svcName = (id) => {
    const s = DEMO.services.find((x) => x.id === id);
    return s ? (lang === 'bg' ? s.bg : s.en) : '';
  };

  if (!open)
    return (
      <button type="button" className="bk-ai-open" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {t.open}
      </button>
    );

  return (
    <section className="bk-ai" role="dialog" aria-label={t.title}>
      <header className="bk-ai__head">
        <div>
          <p className="bk-ai__title">{t.title}</p>
          <p className="bk-ai__sub">{t.sub}</p>
        </div>
        <button type="button" className="bk-ai__close" onClick={() => setOpen(false)} aria-label={t.close}>
          ×
        </button>
      </header>

      <div className="bk-ai__list" ref={listRef} aria-live="polite">
        <p className="bk-ai__msg">{t.hello}</p>
        {msgs.length === 0 && (
          <div className="bk-ai__ideas">
            {t.ideas.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bk-ai__msg${m.role === 'user' ? ' is-me' : ''}`}>
            <p>{m.text}</p>
            {m.book && (
              <button
                type="button"
                className="bk-btn bk-ai__act"
                onClick={() => {
                  onBook(m.book);
                  setOpen(false);
                }}
              >
                {t.book(svcName(m.book))}
              </button>
            )}
            {m.handover && !team && (
              <button type="button" className="bk-btn bk-btn--ghost bk-ai__act" onClick={() => showTeam('asked')}>
                {t.toTeam}
              </button>
            )}
          </div>
        ))}
        {busy && <p className="bk-ai__msg bk-ai__typing">{t.thinking}</p>}

        {team &&
          (sent === 'done' ? (
            <p className="bk-ai__msg" role="status">
              {t.sent}
            </p>
          ) : (
            <form className="bk-form bk-ai__team" onSubmit={sendTeam} noValidate>
              <p className="bk-ai__sub">{t.form}</p>
              <label>
                {t.name}
                <input autoComplete="name" value={f.name} onChange={set('name')} maxLength={80} />
              </label>
              <div className="bk-form__row">
                <label>
                  {t.phone}
                  <input type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} maxLength={20} />
                </label>
                <label>
                  {t.email}
                  <input type="email" autoComplete="email" value={f.email} onChange={set('email')} maxLength={254} />
                </label>
              </div>
              <label>
                {t.question}
                <textarea rows={2} value={f.question} onChange={set('question')} maxLength={500} />
              </label>
              {sent !== 'idle' && sent !== 'sending' && (
                <p className="bk-alert" role="alert">
                  {t.errors[sent] || t.errors.other}
                </p>
              )}
              <button type="submit" className="bk-btn" disabled={sent === 'sending'}>
                {t.sendTeam}
              </button>
            </form>
          ))}
      </div>

      {!(team && team.reason === 'off') && (
        <form
          className="bk-ai__input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} maxLength={600} aria-label={t.placeholder} />
          <button type="submit" className="bk-btn" disabled={busy || !text.trim()}>
            {t.send}
          </button>
        </form>
      )}
      <p className="bk-ai__note">{t.note}</p>
    </section>
  );
}
