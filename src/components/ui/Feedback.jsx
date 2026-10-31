import { useState } from 'react';
import { ui } from '../../config/site';
import './Feedback.css';

const t = ui.feedback;

// "What do you think?" form. Saves to /api/questions (kind: feedback).
// Email is optional, so people can answer anonymously.
export default function Feedback({ page = 'site', title = t.title, email: knownEmail = '' }) {
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState('idle');

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setStatus('pick');
    const f = new FormData(e.currentTarget);
    setStatus('sending');
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'feedback', rating, message: String(f.get('message') || ''), email: String(f.get('email') || knownEmail || ''), page, company: f.get('company') || '' }),
      });
      setStatus(res.ok ? 'done' : res.status === 400 ? 'bad' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') return <div className="feedback feedback--done" role="status">{t.done}</div>;

  return (
    <form className="feedback" onSubmit={submit}>
      <p className="feedback__title">{title}</p>
      <div className="feedback__scores" role="radiogroup" aria-label={t.rating}>
        {t.scores.map((label, i) => [i + 1, label]).map(([n, label]) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} className={rating === n ? 'is-on' : ''} onClick={() => setRating(n)}>
            <b>{n}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <textarea name="message" rows={3} maxLength={2000} placeholder={t.message} />
      {!knownEmail && <input name="email" type="email" maxLength={254} placeholder={t.email} />}
      <input name="company" tabIndex={-1} autoComplete="off" className="feedback__trap" aria-hidden="true" />
      <div className="feedback__row">
        <button className="feedback__send" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? t.sending : t.send}
        </button>
        {status === 'pick' && <span role="status">{t.pick}</span>}
        {status === 'bad' && <span role="status">{t.bad}</span>}
        {status === 'error' && <span role="status">{t.error}</span>}
      </div>
    </form>
  );
}
