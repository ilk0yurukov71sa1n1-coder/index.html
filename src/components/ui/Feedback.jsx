import { useState } from 'react';
import './Feedback.css';

const SCORES = [
  [1, 'Poor'],
  [2, 'Meh'],
  [3, 'Okay'],
  [4, 'Good'],
  [5, 'Love it'],
];

// "What do you think?" form. Saves to /api/questions (kind: feedback).
// Email is optional, so people can answer anonymously.
export default function Feedback({ page = 'site', title = 'What do you think of Shield so far?', email: knownEmail = '' }) {
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

  if (status === 'done') return <div className="feedback feedback--done" role="status">Thank you. We read every answer, and it shapes what we build next.</div>;

  return (
    <form className="feedback" onSubmit={submit}>
      <p className="feedback__title">{title}</p>
      <div className="feedback__scores" role="radiogroup" aria-label="Your rating">
        {SCORES.map(([n, label]) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} className={rating === n ? 'is-on' : ''} onClick={() => setRating(n)}>
            <b>{n}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <textarea name="message" rows={3} maxLength={2000} placeholder="What would make it better? What is missing? (optional)" />
      {!knownEmail && <input name="email" type="email" maxLength={254} placeholder="Email, if you want a reply (optional)" />}
      <input name="company" tabIndex={-1} autoComplete="off" className="feedback__trap" aria-hidden="true" />
      <div className="feedback__row">
        <button className="feedback__send" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
        {status === 'pick' && <span role="status">Pick a score from 1 to 5 first.</span>}
        {status === 'bad' && <span role="status">Check the email address.</span>}
        {status === 'error' && <span role="status">That did not go through. Try again in a moment.</span>}
      </div>
    </form>
  );
}
