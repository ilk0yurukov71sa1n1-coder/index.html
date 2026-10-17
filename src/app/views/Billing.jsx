import { useEffect, useState } from 'react';
import { api, when } from '../api';

const WHY = {
  starter: 'Try Shield on a side project. Caps, rate limits and the injection filter are all included.',
  pro: 'For an app with real users. 25× the requests and up to 20 keys, one per app or environment.',
  team: 'For heavy traffic. 5M protected requests a month on the same full set of defenses.',
  business: 'Custom volume and terms, arranged with us by email.',
};
const n = (x) => (x == null ? 'Custom' : x.toLocaleString('en-US'));
const eur = (cents) => (cents == null ? 'Custom' : `€${cents / 100}`);

export default function Billing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const paid = new URLSearchParams(window.location.search).has('paid');

  const load = async () => {
    const r = await api('billing');
    if (r.ok) setData(r.data);
    else setError(r.error);
    return r;
  };
  useEffect(() => {
    load();
    if (!paid) return undefined;
    // Stripe tells us about the payment a moment after the redirect.
    let tries = 0;
    const t = setInterval(async () => {
      const r = await load();
      if (++tries >= 6 || (r.ok && r.data.plan !== 'starter')) clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const go = async (plan) => {
    setBusy(plan);
    setMsg(plan === 'portal' ? 'Opening billing…' : 'Opening secure checkout…');
    const r = plan === 'portal' ? await api('portal', { method: 'POST', body: {} }) : await api('checkout', { method: 'POST', body: { plan } });
    if (!r.ok) {
      setBusy('');
      return setMsg(r.error);
    }
    if (r.data.url) return window.location.assign(r.data.url);
    setBusy('');
    setMsg('Plan changed. The difference for this month was charged to your card on file.');
    load();
  };

  const pct = data.limit ? Math.min(100, (data.used / data.limit) * 100) : 0;
  const current = data.plans[data.plan] || data.plans.starter;

  return (
    <>
      <header className="view-head">
        <h1>Plan and billing</h1>
        <p className="muted">Prices are in euros, excluding VAT. Your AI provider bills its own usage separately.</p>
      </header>

      {paid && <p className="notice">Thanks! Payment received. Your plan updates here as soon as Stripe confirms it.</p>}
      {!data.stripe && <p className="error">Payments are not switched on yet (STRIPE_SECRET_KEY), so upgrades are not available.</p>}

      <section className="card">
        <div className="key__head">
          <div>
            <h2>
              {current.name} plan {data.mode === 'test' && <span className="pill">Test mode</span>}
            </h2>
            <p className="muted small">
              {data.status === 'past_due' && <b className="accent">Your last payment failed. Update your card to keep the plan. </b>}
              {data.renews_at ? (data.cancel_at_period_end ? `Ends ${when(data.renews_at)}.` : `Renews ${when(data.renews_at)}.`) : data.plan === 'starter' ? 'Free, no card needed.' : ''}
            </p>
          </div>
          {data.has_billing && (
            <button className="btn btn--ghost" type="button" onClick={() => go('portal')} disabled={Boolean(busy)}>
              Manage billing
            </button>
          )}
        </div>
        <div className="meter">
          <div className="meter__top">
            <span>Protected requests this month</span>
            <span>
              {n(data.used)} of {n(data.limit)}
            </span>
          </div>
          <div className="meter__bar">
            <i style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-full' : pct >= 80 ? 'is-high' : ''} />
          </div>
        </div>
        <p className="muted small">When the allowance runs out, Shield answers with a clear error instead of calling the provider until the 1st of next month or until you upgrade. Up to {data.keys_limit} active keys on this plan.</p>
        {msg && <p className="small" role="status">{msg}</p>}
      </section>

      <div className="plans">
        {Object.entries(data.plans).map(([id, p]) => {
          const isCurrent = id === data.plan;
          return (
            <section key={id} className={`card plan${isCurrent ? ' is-current' : ''}${id === 'pro' ? ' is-featured' : ''}`}>
              <h2>{p.name}</h2>
              <p className="plan__price">
                <b>{eur(p.cents)}</b>
                {p.cents != null && <span className="muted">/month</span>}
              </p>
              <p className="small">{p.requests == null ? 'Volume agreed with you' : `${n(p.requests)} protected requests a month`}</p>
              <p className="muted small">{WHY[id]}</p>
              {isCurrent ? (
                <span className="pill ok">Your plan</span>
              ) : id === 'business' ? (
                <a className="btn btn--ghost" href="mailto:rollcfluence@gmail.com?subject=Rollcfluence%20Business">
                  Talk to us
                </a>
              ) : id === 'starter' ? (
                data.has_billing && (
                  <button className="btn btn--ghost" type="button" onClick={() => go('portal')} disabled={Boolean(busy)}>
                    Cancel in billing
                  </button>
                )
              ) : (
                <button className="btn" type="button" onClick={() => go(id)} disabled={Boolean(busy) || !data.stripe || data.plan === 'business'}>
                  {busy === id ? 'Opening…' : `${data.plans[data.plan]?.cents > p.cents ? 'Switch to' : 'Upgrade to'} ${p.name}`}
                </button>
              )}
            </section>
          );
        })}
      </div>
      <p className="muted small">Payments are handled by Stripe. Shield never sees or stores your card number.</p>
    </>
  );
}
