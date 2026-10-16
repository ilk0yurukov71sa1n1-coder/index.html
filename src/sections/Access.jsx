import { useRef, useState } from 'react';
import { access } from '../config/site';
import FlyingButton from '../components/reactbits/FlyingButton';
import LatticeLoader from '../components/reactbits/LatticeLoader';
import OptionWheel from '../components/reactbits/OptionWheel';
import SectionHeading from '../components/ui/SectionHeading';
import './Access.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Access({ id }) {
  // The form is always shown: the flying button is a flourish, not a gate,
  // so a visitor who can't catch it can still sign up.
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [goal, setGoal] = useState(access.goals[access.goalDefault]);
  const [verify, setVerify] = useState(false);
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
        body: JSON.stringify({ email, goal, company: form.get('company') || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || String(res.status));
      setVerify(Boolean(data.verify));
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(
        err.message === 'storage_unavailable'
          ? 'Signups are not open just yet. Email rollcfluence@gmail.com and we will save your spot by hand.'
          : 'Something went wrong. Try again in a minute.'
      );
    }
  };

  return (
    <section id={id} className="section access">
      <div className="container access__grid">
        <div>
          <SectionHeading index={access.index} label={access.label} title={access.title}>
            {access.body}
          </SectionHeading>
          <ul className="access__limits">
            {access.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>

        <div className="access__panel">
          <div className="access__launch">
            <FlyingButton
              theme="light"
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
              thrustColor="#b0323a"
              smokeColor="#e6dfd6"
              buttonColor="#7d1d20"
              textColor="#ffffff"
              onClick={launch}
            >
              {access.button}
            </FlyingButton>
          </div>

          <div className={`access__form ${open ? 'is-open' : ''}`} aria-hidden={!open}>
            {status === 'done' ? (
              <p className="access__success" role="status">{verify ? access.verifySuccess : access.success}</p>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="access__goals">
                  <p className="access__goals-label mono" id="access-goal">{access.goalLabel}</p>
                  <div className="access__wheel" aria-labelledby="access-goal">
                    <OptionWheel
                      items={access.goals}
                      defaultSelected={access.goalDefault}
                      onChange={(_, item) => setGoal(item)}
                      textColor="#9b8f8b"
                      activeColor="#7d1d20"
                      side="left"
                      fontSize={1.35}
                      spacing={1.5}
                      curve={1}
                      tilt={9}
                      blur={1.2}
                      fade={0.3}
                      smoothing={180}
                      inset={4}
                    />
                  </div>
                </div>
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
                    {access.submit}
                  </button>
                </div>
                <p id="access-error" className="access__error" role="alert">{error}</p>
              </form>
            )}
            {status !== 'idle' ? (
              <div className="access__loader">
                <LatticeLoader
                  status={status === 'sending' ? 'working' : status === 'done' ? 'done' : 'error'}
                  label={access.sending}
                  doneLabel={access.sent}
                  errorLabel={access.failed}
                  pattern="orbit"
                  color="#7d1d20"
                  doneColor="#2c8a57"
                  errorColor="#a3262c"
                  cellSize={5}
                  fontSize={13}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
