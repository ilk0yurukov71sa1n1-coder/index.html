import { useRef, useState } from 'react';
import { access } from '../config/site';
import FlyingButton from '../components/reactbits/FlyingButton';
import SectionHeading from '../components/ui/SectionHeading';
import './Access.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Access({ id }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const launch = () => {
    setOpen(true);
    // Focus after the form has rendered.
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
  };

  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    if (!EMAIL.test(email) || email.length > 254) {
      setError('Enter a valid work email.');
      return;
    }
    setError('');
    setStatus('sending');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company: form.get('company') || '' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('done');
    } catch {
      setStatus('error');
      setError('Something went wrong. Try again in a minute.');
    }
  };

  return (
    <section id={id} className="section access">
      <div className="container access__grid">
        <SectionHeading index={access.index} label={access.label} title={access.title}>
          {access.body}
        </SectionHeading>

        <div className="access__panel">
          <div className="access__launch">
            <FlyingButton
              theme="dark"
              size="large"
              altitude={190}
              hoverTime={2.2}
              jets={2}
              thrusters
              trigger="hover"
              carryCursor={false}
              smoke={0.9}
              turbulence={1}
              wobble={0.8}
              thrustColor="#ff4d80"
              smokeColor="#d9cfe0"
              buttonColor="#e0245e"
              textColor="#ffffff"
              onClick={launch}
            >
              {access.button}
            </FlyingButton>
          </div>

          <div className={`access__form ${open ? 'is-open' : ''}`} aria-hidden={!open}>
            {status === 'done' ? (
              <p className="access__success" role="status">{access.success}</p>
            ) : (
              <form onSubmit={submit} noValidate>
                <label htmlFor="access-email" className="mono">{access.formTitle}</label>
                <div className="access__row">
                  <input
                    ref={inputRef}
                    id="access-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    required
                    placeholder={access.placeholder}
                    tabIndex={open ? 0 : -1}
                    aria-invalid={Boolean(error)}
                    aria-describedby="access-error"
                  />
                  {/* Honeypot: hidden from people, bots fill it in. */}
                  <input type="text" name="company" tabIndex={-1} autoComplete="off" className="access__trap" aria-hidden="true" />
                  <button type="submit" className="btn btn--primary" disabled={status === 'sending'} tabIndex={open ? 0 : -1}>
                    {status === 'sending' ? 'Sending…' : access.submit}
                  </button>
                </div>
                <p id="access-error" className="access__error" role="alert">{error}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
