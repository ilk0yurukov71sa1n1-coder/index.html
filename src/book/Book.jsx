import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEMO, PHONE, freeSlots } from '../../api/_lib/booking.js';
import { copy } from './copy';
import FluidGlass from '../components/reactbits/FluidGlass';
import LineWaves from '../components/reactbits/LineWaves';
import Assistant from './Assistant';
import BlurText from './BlurText';
import { CAN_LIQUID, LiquidIntro, LiquidOrb, introWanted } from './Liquid';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MONTHS_BG = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'bg' || q === 'en') return q;
  } catch {}
  return 'bg';
}

// "вт 21 окт" / "Tue 21 Oct", read as a calendar date (no time zone shift).
const dayParts = (day, locale) => {
  const d = new Date(`${day}T12:00:00Z`);
  const f = (o) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...o }).format(d);
  // Some browsers print Bulgarian short months as digits, so the names are written out.
  const mon = (locale.startsWith('bg') ? MONTHS_BG : MONTHS_EN)[d.getUTCMonth()];
  return { wd: f({ weekday: 'short' }), num: f({ day: 'numeric' }), mon, long: f({ weekday: 'long', day: 'numeric', month: 'long' }) };
};

// Both effects need WebGL2. Without it the page stays plain: no blank glass box.
const hasWebGL2 = (() => {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
})();

export default function Book() {
  const [lang, setLang] = useState(startLang);
  const t = copy[lang];
  const [data, setData] = useState(null); // { days, busy } from /api/book
  const [loadError, setLoadError] = useState(false);
  const [service, setService] = useState(null);
  const [day, setDay] = useState(null);
  const [time, setTime] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', email: '', note: '', company: '' });
  const [state, setState] = useState({ kind: 'idle' }); // idle | sending | error | done
  const [intro, setIntro] = useState(introWanted);
  const endIntro = useCallback(() => setIntro(false), []);
  const timesRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = t.meta.lang;
    document.title = t.meta.title;
  }, [t]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/book?business=${DEMO.id}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const switchLang = (next) => {
    setLang(next);
    try {
      const u = new URL(location.href);
      u.searchParams.set('lang', next);
      history.replaceState(null, '', u);
    } catch {}
  };

  const svc = DEMO.services.find((s) => s.id === service) || null;
  const busyOn = useCallback((d) => (data?.busy || []).filter((b) => b.day === d), [data]);
  const times = useMemo(() => (svc && day ? freeSlots(DEMO, { day, service: svc.id, busy: busyOn(day) }) : []), [svc, day, busyOn]);
  // A day is greyed out when it is closed or nothing fits the chosen service.
  const dayFull = (d) => Boolean(svc) && freeSlots(DEMO, { day: d, service: svc.id, busy: busyOn(d) }).length === 0;

  // A time stays picked only while it is still free for the chosen service.
  useEffect(() => {
    if (time && !times.includes(time)) setTime(null);
  }, [times, time]);

  const pickService = (id) => {
    setService(id);
    setState({ kind: 'idle' });
  };
  const pickDay = (d) => {
    setDay(d);
    setState({ kind: 'idle' });
    requestAnimationFrame(() => timesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const pickTime = (x) => {
    setTime(x);
    setState({ kind: 'idle' });
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (state.kind === 'sending' || !svc || !day || !time) return;
    if (f.name.trim().length < 2) return setState({ kind: 'error', code: 'invalid_name' });
    if (!PHONE.test(f.phone.trim())) return setState({ kind: 'error', code: 'invalid_phone' });
    if (f.email.trim() && !EMAIL_OK.test(f.email.trim())) return setState({ kind: 'error', code: 'invalid_email' });
    setState({ kind: 'sending' });
    try {
      const r = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business: DEMO.id, service: svc.id, day, time, lang, ...f, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() }),
      });
      const out = await r.json().catch(() => ({}));
      if (r.ok) return setState({ kind: 'done', mailed: Boolean(out.mailed), when: { day, time, svc } });
      if (out.error === 'slot_taken') {
        setTime(null);
        load();
      }
      setState({ kind: 'error', code: out.error in t.errors ? out.error : 'other' });
    } catch {
      setState({ kind: 'error', code: 'other' });
    }
  };

  const again = () => {
    setService(null);
    setDay(null);
    setTime(null);
    setF((v) => ({ ...v, note: '' }));
    setState({ kind: 'idle' });
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const euro = (n) => `€${n}`;
  const locale = t.meta.locale;

  return (
    <div className="bk">
      {intro && <LiquidIntro text={DEMO.name} skip={t.skip} onDone={endIntro} />}
      {hasWebGL2 && (
        <div className="bk-waves" aria-hidden="true">
          <LineWaves color1="#7d1d20" color2="#b0323a" color3="#4f1012" lightMode speed={0.18} lineCount={56} lineWidth={1.1} glow={0.4} highlight={0.8} warpIntensity={0.9} rotation={-28} mouseInfluence={0} opacity={0.34} maxDevicePixelRatio={1.5} />
        </div>
      )}
      <div className="bk-demo" role="note">
        <div className="bk-wrap bk-demo__inner">
          <p>{t.demo}</p>
          <a href={`/services${lang === 'en' ? '?lang=en' : ''}#contact`}>{t.demoLink} →</a>
        </div>
      </div>

      <header className="bk-bar">
        <div className="bk-wrap bk-bar__inner">
          <span className="bk-brand">
            <span className="bk-brand__mark" aria-hidden="true">A</span>
            <span className="bk-brand__name">{DEMO.name}</span>
          </span>
          <div className="bk-lang" role="group" aria-label="Language">
            {['bg', 'en'].map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => switchLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="bk-wrap bk-main">
        {state.kind === 'done' ? (
          <section className="bk-done" role="status">
            {CAN_LIQUID && (
              <div className="bk-glass bk-glass--done" aria-hidden="true">
                <FluidGlass text={DEMO.name.replace(' ', '\n')} textColor="#7d1d20" fontWeight={600} interaction="none" shape="lens" shapes={['lens', 'pill', 'blob']} size={180} refraction={1} dispersion={0.3} shadow={0.35} elevation={0.4} wobble={0.4} spin={0.2} maxDevicePixelRatio={1.75} />
              </div>
            )}
            <span className="bk-done__tick" aria-hidden="true">✓</span>
            <h1>
              <BlurText text={t.done.title} />
            </h1>
            <p className="bk-done__when">
              <b>{lang === 'bg' ? state.when.svc.bg : state.when.svc.en}</b>
              <br />
              {dayParts(state.when.day, locale).long}, {state.when.time}
            </p>
            <p>{t.done.text}</p>
            {state.mailed && <p className="bk-muted">{t.done.mailed}</p>}
            <button type="button" className="bk-btn bk-btn--ghost" onClick={again}>
              {t.done.again}
            </button>
          </section>
        ) : (
          <>
            <section className="bk-hero">
              {CAN_LIQUID ? (
                <div className="bk-glass bk-glass--liquid">
                  <LiquidOrb text={DEMO.name} label={t.orb} />
                </div>
              ) : hasWebGL2 && (
                <div className="bk-glass" aria-hidden="true">
                  <FluidGlass text={DEMO.name.replace(' ', '\n')} textColor="#7d1d20" fontWeight={600} interaction="none" shape="lens" shapes={['lens', 'pill', 'blob']} size={210} refraction={1} dispersion={0.3} shadow={0.35} elevation={0.4} wobble={0.4} spin={0.2} maxDevicePixelRatio={1.75} />
                </div>
              )}
              <p className="bk-eyebrow">{t.eyebrow}</p>
              <h1 key={`${lang}-${intro}`}>
                <BlurText text={t.title} />
              </h1>
              <p className="bk-lead">{t.lead}</p>
            </section>

            {loadError && (
              <p className="bk-alert" role="alert">
                {t.errors.load}
              </p>
            )}

            <section className="bk-step" aria-labelledby="bk-s1">
              <h2 id="bk-s1">
                <span className="bk-step__n">1</span> {t.steps[0]}
              </h2>
              <div className="bk-services" role="radiogroup" aria-labelledby="bk-s1">
                {DEMO.services.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={service === s.id} className="bk-service" onClick={() => pickService(s.id)}>
                    <span className="bk-service__name">{lang === 'bg' ? s.bg : s.en}</span>
                    <span className="bk-service__meta">
                      {s.min} {t.min} · <b>{euro(s.eur)}</b>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="bk-step" aria-labelledby="bk-s2">
              <h2 id="bk-s2">
                <span className="bk-step__n">2</span> {t.steps[1]}
              </h2>
              {!svc ? (
                <p className="bk-muted">{t.pickService}</p>
              ) : (
                <div className="bk-days" role="radiogroup" aria-labelledby="bk-s2">
                  {(data?.days || []).map(({ day: d, open }) => {
                    const p = dayParts(d, locale);
                    const off = !open || dayFull(d);
                    return (
                      <button key={d} type="button" role="radio" aria-checked={day === d} disabled={off} className="bk-day" onClick={() => pickDay(d)} aria-label={`${p.long}${open ? '' : `, ${t.closed}`}`}>
                        <span className="bk-day__wd">{p.wd}</span>
                        <span className="bk-day__num">{p.num}</span>
                        <span className="bk-day__mon">{open ? p.mon : t.closed}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bk-step" aria-labelledby="bk-s3" ref={timesRef}>
              <h2 id="bk-s3">
                <span className="bk-step__n">3</span> {t.steps[2]}
              </h2>
              {!svc || !day ? (
                <p className="bk-muted">{!svc ? t.pickService : t.pickDay}</p>
              ) : times.length ? (
                <div className="bk-times" role="radiogroup" aria-labelledby="bk-s3">
                  {times.map((x) => (
                    <button key={x} type="button" role="radio" aria-checked={time === x} className="bk-time" onClick={() => pickTime(x)}>
                      {x}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="bk-muted">{t.noTimes}</p>
              )}
            </section>

            <section className="bk-step" aria-labelledby="bk-s4" ref={formRef}>
              <h2 id="bk-s4">
                <span className="bk-step__n">4</span> {t.steps[3]}
              </h2>
              <form className="bk-form" onSubmit={submit} noValidate>
                <div className="bk-form__row">
                  <label>
                    {t.name}
                    <input autoComplete="name" value={f.name} onChange={set('name')} maxLength={80} required />
                  </label>
                  <label>
                    {t.phone}
                    <input type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} maxLength={20} required />
                  </label>
                </div>
                <label>
                  {t.email}
                  <input type="email" autoComplete="email" value={f.email} onChange={set('email')} maxLength={254} />
                </label>
                <label>
                  {t.note}
                  <textarea rows={2} value={f.note} onChange={set('note')} maxLength={300} />
                </label>
                {/* Bots fill every field; people never see this one. */}
                <label className="bk-trap" aria-hidden="true">
                  Company
                  <input tabIndex={-1} autoComplete="off" value={f.company} onChange={set('company')} />
                </label>

                <div className="bk-summary" aria-live="polite">
                  <span className="bk-summary__label">{t.summary}</span>
                  {svc && day && time ? (
                    <span className="bk-summary__text">
                      <b>{lang === 'bg' ? svc.bg : svc.en}</b> · {dayParts(day, locale).long}, {time} · {svc.min} {t.min} · {euro(svc.eur)}
                    </span>
                  ) : (
                    <span className="bk-summary__text bk-muted">{!svc ? t.pickService : !day ? t.pickDay : t.steps[2]}</span>
                  )}
                </div>

                {state.kind === 'error' && (
                  <p className="bk-alert" role="alert">
                    {t.errors[state.code] || t.errors.other}
                  </p>
                )}

                <button type="submit" className="bk-btn" disabled={!svc || !day || !time || state.kind === 'sending'}>
                  {state.kind === 'sending' ? t.sending : t.submit}
                </button>
                <p className="bk-privacy">{t.privacy}</p>
              </form>
            </section>
          </>
        )}
      </main>

      {state.kind !== 'done' && (
        <Assistant
          lang={lang}
          onBook={(id) => {
            pickService(id);
            requestAnimationFrame(() => document.getElementById('bk-s2')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          }}
        />
      )}

      <footer className="bk-foot">
        <div className="bk-wrap">
          <a href="/services">Rollcfluence</a> · <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
