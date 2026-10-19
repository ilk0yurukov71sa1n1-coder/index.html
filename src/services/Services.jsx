import { Suspense, lazy, useEffect, useState } from 'react';
import GlassButton from '../components/ui/GlassButton';
import TextScanner from '../components/ui/TextScanner';
import '../components/ui/TextScanner.css';
import { copy } from './copy';

// The 3D machine is heavy (three.js), so it loads after the page text.
const Factory = lazy(() => import('../components/ui/AgenticFactory3D'));
const MicroSlats = lazy(() => import('../components/reactbits/MicroSlats'));

const EMAIL = 'rollcfluence@gmail.com';
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function startLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'bg' || q === 'en') return q;
  } catch {}
  // Bulgarian first: the page is for local businesses in Bulgaria.
  return 'bg';
}

// €1,190 in English, €1 190 in Bulgarian (bg-BG leaves 4-digit numbers ungrouped).
const euro = (n, lang) => '€' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'bg' ? '\u00a0' : ',');

// One quiet webgl check so phones without it get the text-only hero.
function canWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function Services() {
  const [lang, setLang] = useState(startLang);
  const t = copy[lang];
  const [gl] = useState(canWebGL);

  useEffect(() => {
    document.documentElement.lang = t.meta.lang;
    document.title = t.meta.title;
  }, [t]);

  // Links like /services#contact land before the page has laid out, so jump once it has.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return;
    const go = () => document.getElementById(id)?.scrollIntoView();
    requestAnimationFrame(go);
    const later = setTimeout(go, 400);
    return () => clearTimeout(later);
  }, []);

  const switchLang = (next) => {
    setLang(next);
    try {
      const u = new URL(location.href);
      u.searchParams.set('lang', next);
      history.replaceState(null, '', u);
    } catch {}
  };

  return (
    <div className="svc">
      {gl && (
        <div className="svc-bg" aria-hidden="true">
          <Suspense fallback={null}>
            <MicroSlats
              preset="tide"
              color="#7d1d20"
              glintColor="#d9474f"
              backgroundColor="#14100f"
              slatWidth={8}
              slatHeight={22}
              gap={3}
              roundness={0.75}
              speed={0.35}
              glint={0.5}
              fog={0.6}
              cursorStrength={0.7}
              cursorSize={46}
              trail={1.4}
            />
          </Suspense>
        </div>
      )}
      <header className="svc-bar">
        <div className="svc-wrap svc-bar__inner">
          <a className="svc-brand" href="/services" aria-label="Rollcfluence">
            <img src="/logo-rc.png" alt="" width="32" height="32" />
            <TextScanner className="svc-brand__name" text="rollcfluence" />
          </a>
          <nav className="svc-bar__links" aria-label="Sections">
            <a href="#offers">{t.nav.offers}</a>
            <a href="#steps">{t.nav.steps}</a>
            <a href="#examples">{t.nav.examples}</a>
            <a href="#faq">{t.nav.faq}</a>
          </nav>
          <div className="svc-bar__end">
            <div className="svc-lang" role="group" aria-label="Language">
              {['bg', 'en'].map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => switchLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a className="btn btn--primary btn--sm" href="#contact">{t.nav.cta}</a>
          </div>
        </div>
      </header>

      <section className="svc-hero" aria-labelledby="svc-title">
        {gl && (
          <div className="svc-hero__scene" aria-hidden="false">
            <Suspense fallback={null}>
              <Factory height="100%" embed lang={lang} />
            </Suspense>
          </div>
        )}
        <div className="svc-wrap svc-hero__text">
          <p className="svc-eyebrow mono">{t.hero.eyebrow}</p>
          <h1 id="svc-title">
            {t.hero.title[0]}
            <br />
            <span>{t.hero.title[1]}</span>
          </h1>
          <p className="svc-hero__body">{t.hero.body}</p>
          <div className="svc-hero__cta">
            <GlassButton tone="red" href="#contact">
              {t.hero.primary} <span aria-hidden="true">→</span>
            </GlassButton>
            <GlassButton href="#offers">{t.hero.secondary}</GlassButton>
          </div>
          {gl && <p className="svc-hero__hint">{t.hero.hint}</p>}
        </div>
      </section>

      <section id="offers" className="svc-section">
        <div className="svc-wrap">
          <Heading label={t.offers.label} title={t.offers.title} body={t.offers.body} />
          <div className="svc-offers">
            {t.offers.items.map((o) => (
              <article key={o.tag} className={`svc-offer${o.featured ? ' svc-offer--featured' : ''}`}>
                <span className="svc-offer__tag mono">{o.tag}</span>
                <h3>{o.title}</h3>
                <p className="svc-offer__price">
                  <span className="svc-offer__from">{t.offers.from}</span>{' '}
                  <strong>{euro(o.price, lang)}</strong> {t.offers.setup}
                  <br />
                  <span className="svc-offer__monthly">
                    + {t.offers.from} {euro(o.monthly, lang)} {t.offers.monthly}
                  </span>
                </p>
                <p className="svc-offer__text">{o.text}</p>
                <ul>
                  {o.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <a className={`btn ${o.featured ? 'btn--primary' : 'btn--ghost'}`} href="#contact">
                  {t.nav.cta} <span className="btn__arrow" aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>
          <p className="svc-note">{t.offers.vat}</p>
        </div>
      </section>

      <section id="steps" className="svc-section svc-section--tint">
        <div className="svc-wrap">
          <Heading label={t.steps.label} title={t.steps.title} body={t.steps.body} />
          <ol className="svc-steps">
            {t.steps.items.map((s, i) => (
              <li key={s.title}>
                <span className="svc-steps__n mono">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p className="svc-steps__when mono">{s.when}</p>
                <p>{s.text}</p>
                <ul className="svc-steps__points">
                  {s.points.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <p className="svc-steps__you">
                  <span>{t.steps.youLabel}</span> {s.you}
                </p>
              </li>
            ))}
          </ol>
          <div className="svc-timeline">
            <h3>{t.steps.timeline.title}</h3>
            <dl>
              {t.steps.timeline.rows.map((r) => (
                <div key={r.what}>
                  <dt>{r.what}</dt>
                  <dd>{r.time}</dd>
                </div>
              ))}
            </dl>
            <p>{t.steps.timeline.note}</p>
          </div>
        </div>
      </section>

      <section id="examples" className="svc-section">
        <div className="svc-wrap">
          <Heading label={t.examples.label} title={t.examples.title} body={t.examples.body} />
          <div className="svc-examples">
            {t.examples.items.map((e) => (
              <article key={e.title}>
                <h3>{e.title}</h3>
                <p>{e.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="svc-section svc-section--dark">
        <div className="svc-wrap">
          <Heading label={t.why.label} title={t.why.title} body={t.why.body} />
          <div className="svc-why">
            {t.why.items.map((w) => (
              <div key={w.title}>
                <h3>{w.title}</h3>
                <p className="svc-why__them">
                  <span className="mono">{t.why.them}</span>
                  {w.them}
                </p>
                <p className="svc-why__us">
                  <span className="mono">{t.why.us}</span>
                  {w.us}
                </p>
              </div>
            ))}
          </div>
          <p className="svc-why__note">{t.why.note}</p>
        </div>
      </section>

      <section className="svc-section">
        <div className="svc-wrap">
          <Heading label={t.built.label} title={t.built.title} />
          <div className="svc-built">
            {t.built.items.map((b) => (
              <div key={b.title} className="svc-built__card">
                <h3>{b.title}</h3>
                <ul>
                  {b.points.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="svc-section">
        <div className="svc-wrap svc-faq">
          <Heading label={t.faq.label} title={t.faq.title} />
          <div className="svc-faq__list">
            {t.faq.items.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="svc-section svc-section--tint">
        <div className="svc-wrap svc-contact">
          <div>
            <Heading label={t.contact.label} title={t.contact.title} body={t.contact.body} />
            <p className="svc-note">
              {t.contact.or} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </p>
          </div>
          <ContactForm t={t.contact} lang={lang} />
        </div>
      </section>

      <footer className="svc-foot">
        <div className="svc-wrap svc-foot__inner">
          <span>© {new Date().getFullYear()} Rollcfluence</span>
          <nav aria-label="Footer">
            <a href="/">{t.footer.shield}</a>
            <a href="/privacy">{t.footer.privacy}</a>
            <a href="/terms">{t.footer.terms}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Heading({ label, title, body }) {
  return (
    <div className="svc-heading">
      <p className="svc-eyebrow mono">{label}</p>
      <h2>{title}</h2>
      {body && <p className="svc-heading__body">{body}</p>}
    </div>
  );
}

// Sends to /api/questions, which stores it for the owner inbox (/app#owner)
// and emails it once email sending is set up.
function ContactForm({ t, lang }) {
  const [f, setF] = useState({ name: '', business: '', email: '', phone: '', need: 0, message: '', company: '' });
  const [state, setState] = useState('idle');
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'sending') return;
    if (!f.name.trim() || !f.business.trim() || !EMAIL_OK.test(f.email.trim())) return setState('invalid');
    setState('sending');
    const question = [
      '[Services enquiry]',
      `Name: ${f.name.trim()}`,
      `Business: ${f.business.trim()}`,
      f.phone.trim() && `Phone: ${f.phone.trim()}`,
      `Needs: ${copy.en.contact.needs[f.need]}`,
      `Language: ${lang}`,
      f.message.trim() && `Message: ${f.message.trim()}`,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000);
    try {
      const r = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email.trim(), question, company: f.company }),
      });
      setState(r.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="svc-form svc-form--done" role="status">
        <p>{t.sent}</p>
      </div>
    );
  }

  return (
    <form className="svc-form" onSubmit={submit} noValidate>
      <label>
        {t.name}
        <input id="svc-name" autoComplete="name" value={f.name} onChange={set('name')} maxLength={120} required />
      </label>
      <label>
        {t.business}
        <input id="svc-business" autoComplete="organization" value={f.business} onChange={set('business')} maxLength={160} required />
      </label>
      <div className="svc-form__row">
        <label>
          {t.email}
          <input id="svc-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} maxLength={254} required />
        </label>
        <label>
          {t.phone}
          <input id="svc-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} maxLength={40} />
        </label>
      </div>
      <fieldset>
        <legend>{t.need}</legend>
        <div className="svc-form__chips">
          {t.needs.map((n, i) => (
            <label key={n} className="svc-chip">
              <input type="radio" name="need" checked={f.need === i} onChange={() => setF((v) => ({ ...v, need: i }))} />
              <span>{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        {t.message}
        <textarea id="svc-message" rows={3} value={f.message} onChange={set('message')} maxLength={1200} />
      </label>
      {/* Honeypot: people never see or fill this. */}
      <input className="svc-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="company" value={f.company} onChange={set('company')} />
      {state === 'invalid' && <p className="svc-form__msg" role="alert">{t.invalid}</p>}
      {state === 'error' && (
        <p className="svc-form__msg" role="alert">
          {t.error} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      )}
      <button className="btn btn--primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? t.sending : t.send}
      </button>
      <p className="svc-form__privacy">
        {t.privacy} <a href="/privacy">{t.privacyLink}</a>.
      </p>
    </form>
  );
}
