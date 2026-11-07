import { useMemo, useState } from 'react';
import { copy } from '../services/copy';
import { DESIGNS, GROUPS, ADDONS, NOT_BUILT } from './designs';

const PHONE = '+359 886 053 663';
const TEL = 'tel:+359886053663';

const T = {
  bg: {
    title: 'Изберете дизайн и вижте пакета си',
    lead: 'Отбележете стиловете, които харесвате. Страницата показва кой пакет ги включва и колко струва. Накрая изпращате избора си с един SMS.',
    groups: { background: 'Фон', buttons: 'Бутони', text: 'Текст', motion: 'Движение в страницата' },
    see: 'Вижте на живо',
    levels: ['', 'Готов стил във вашите цветове', 'Със Call и SMS бутони', 'Изработен специално за вас', 'Изработен от нулата'],
    callSms: 'Искам бутони за обаждане и SMS до всяка услуга',
    custom: 'Искам нещо, което го няма в списъка (изработва се отделно)',
    yourPackage: 'Вашият пакет',
    build: 'за изработка',
    monthly: 'на месец',
    quote: 'Цената се определя след безплатния разговор',
    vat: 'Цените са без ДДС и са ориентировъчни. Точната цена се записва след безплатен разговор.',
    because: 'Защо този пакет',
    becauseNone: 'Изберете поне един стил, за да видите пакета.',
    addons: 'Допълнения',
    each: 'бр.',
    included: 'включено',
    howMany: 'Колко',
    total: 'Общо за изработка',
    totalNote: 'Месечната такса е отделно.',
    info: 'Информация за поръчката',
    name: 'Вашето име',
    business: 'Име на бизнеса',
    phone: 'Телефон за връзка',
    about: 'С какво се занимава бизнесът',
    colors: 'Цветове и лого (имате ли ги?)',
    domain: 'Домейн (имате ли или да изберем ли?)',
    notes: 'Нещо друго, което да знаем',
    send: 'Изпрати с SMS',
    copyBtn: 'Копирай обобщението',
    callBtn: 'Обадете се',
    copied: 'Копирано.',
    need: 'Попълнете име и телефон, за да изпратите.',
    notBuilt: 'Какво не правим',
    notBuiltLead: 'Казваме го предварително, за да не се изненадате.',
    lang: 'English',
    summaryTitle: 'Избор от Rollcfluence',
  },
  en: {
    title: 'Pick a design and see your package',
    lead: 'Tick the styles you like. The page shows which package includes them and what it costs. At the end you send your choice in one text message.',
    groups: { background: 'Background', buttons: 'Buttons', text: 'Text', motion: 'Motion in the page' },
    see: 'See it live',
    levels: ['', 'Ready-made style in your colours', 'With Call and SMS buttons', 'Made specially for you', 'Made from scratch'],
    callSms: 'I want call and SMS buttons next to every service',
    custom: 'I want something that is not on the list (made separately)',
    yourPackage: 'Your package',
    build: 'to build',
    monthly: 'a month',
    quote: 'The price is set after the free call',
    vat: 'Prices exclude VAT and are indicative. The exact price is written down after a free call.',
    because: 'Why this package',
    becauseNone: 'Pick at least one style to see the package.',
    addons: 'Add-ons',
    each: 'each',
    included: 'included',
    howMany: 'How many',
    total: 'Total to build',
    totalNote: 'The monthly fee is separate.',
    info: 'Order details',
    name: 'Your name',
    business: 'Business name',
    phone: 'Phone to reach you',
    about: 'What the business does',
    colors: 'Colours and logo (do you have them?)',
    domain: 'Domain (do you have one, or should we pick?)',
    notes: 'Anything else we should know',
    send: 'Send by SMS',
    copyBtn: 'Copy the summary',
    callBtn: 'Call us',
    copied: 'Copied.',
    need: 'Fill in your name and phone to send.',
    notBuilt: 'What we do not do',
    notBuiltLead: 'We say it up front so nothing surprises you.',
    lang: 'Български',
    summaryTitle: 'Choice from Rollcfluence',
  },
};

const euro = (n, lang) => {
  const w = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'bg' ? ' ' : ',');
  return `€${w}`;
};

export default function Pick() {
  const [lang, setLang] = useState(() => (new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'bg'));
  const [picked, setPicked] = useState(() => {
    const ids = (new URLSearchParams(window.location.search).get('d') || '').split('.');
    return DESIGNS.filter((d) => ids.includes(d.id)).map((d) => d.id);
  });
  const [callSms, setCallSms] = useState(false);
  const [custom, setCustom] = useState(false);
  const [counts, setCounts] = useState({ page: 0, language: 0, google: 0, brand: 0 });
  const [form, setForm] = useState({ name: '', business: '', phone: '', about: '', colors: '', domain: '', notes: '' });
  const [note, setNote] = useState('');
  const t = T[lang];
  const offers = copy.en.offers.items;
  const offersBg = copy.bg.offers.items;

  const chosen = useMemo(() => DESIGNS.filter((d) => picked.includes(d.id)), [picked]);
  const level = Math.max(chosen.length ? 1 : 0, ...chosen.map((d) => d.level), callSms ? 2 : 0, custom ? 4 : 0);
  const offer = level ? offers[level - 1] : null;
  const offerBg = level ? offersBg[level - 1] : null;
  const name = (offer && (lang === 'bg' ? offerBg : offer).tag.split(' · ')[0]) || '';
  const drivers = level ? chosen.filter((d) => d.level === level) : [];

  const addonLine = (a) => {
    const included = a.includedAt && level >= a.includedAt;
    const n = a.each ? counts[a.id] : counts[a.id] ? 1 : 0;
    return { a, included, n, cost: included ? 0 : a.price * n };
  };
  const lines = ADDONS.map(addonLine);
  const addonTotal = lines.reduce((s, l) => s + l.cost, 0);
  const total = offer && offer.price ? offer.price + addonTotal : null;

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setCount = (id, v) => setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(9, v)) }));
  const field = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const summary = () => {
    const rows = [t.summaryTitle];
    if (offer) rows.push(`${t.yourPackage}: ${name}${offer.price ? ` (${euro(offer.price, lang)} ${t.build} + ${euro(offer.monthly, lang)} ${t.monthly})` : ` (${t.quote})`}`);
    if (chosen.length) rows.push(`${lang === 'bg' ? 'Стилове' : 'Styles'}: ${chosen.map((d) => d[lang][0]).join(', ')}`);
    if (callSms) rows.push(t.callSms);
    if (custom) rows.push(t.custom);
    lines.filter((l) => l.n).forEach((l) => rows.push(`${l.a[lang]}: ${l.a.each ? `${l.n} x ` : ''}${l.included ? t.included : euro(l.cost, lang)}`));
    if (total) rows.push(`${t.total}: ${euro(total, lang)}`);
    [['name', t.name], ['business', t.business], ['phone', t.phone], ['about', t.about], ['colors', t.colors], ['domain', t.domain], ['notes', t.notes]].forEach(([k, label]) => {
      if (form[k].trim()) rows.push(`${label}: ${form[k].trim()}`);
    });
    return rows.join('\n');
  };
  const ready = form.name.trim() && form.phone.trim();
  const smsHref = `sms:+359886053663?&body=${encodeURIComponent(summary())}`;
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setNote(t.copied);
    } catch {
      window.prompt('', summary());
    }
  };

  return (
    <div className="pk">
      <header className="pk-bar">
        <a className="pk-brand" href="/services"><img src="/logo-rc.png" alt="" width="28" height="28" /><span>Rollcfluence</span></a>
        <button type="button" className="pk-lang" onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}>{t.lang}</button>
      </header>

      <main className="pk-main">
        <section className="pk-intro">
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </section>

        <div className="pk-layout">
          <div className="pk-left">
            {GROUPS.map((g) => (
              <section key={g} className="pk-group" aria-labelledby={`g-${g}`}>
                <h2 id={`g-${g}`}>{t.groups[g]}</h2>
                <ul className="pk-list">
                  {DESIGNS.filter((d) => d.group === g).map((d) => (
                    <li key={d.id} className={`pk-card${picked.includes(d.id) ? ' is-on' : ''}`}>
                      <label>
                        <input type="checkbox" checked={picked.includes(d.id)} onChange={() => toggle(d.id)} />
                        <span className="pk-card__body">
                          <strong>{d[lang][0]}</strong>
                          <span>{d[lang][1]}</span>
                          <em>{offers[d.level - 1].tag.split(' · ')[0]} · {t.levels[d.level]}</em>
                        </span>
                      </label>
                      <a href={`/playground#${d.lab}`} target="_blank" rel="noopener">{t.see}</a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="pk-group">
              <h2>{lang === 'bg' ? 'Още' : 'More'}</h2>
              <ul className="pk-list">
                <li className={`pk-card${callSms ? ' is-on' : ''}`}><label><input type="checkbox" checked={callSms} onChange={(e) => setCallSms(e.target.checked)} /><span className="pk-card__body"><strong>{t.callSms}</strong></span></label></li>
                <li className={`pk-card${custom ? ' is-on' : ''}`}><label><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} /><span className="pk-card__body"><strong>{t.custom}</strong></span></label></li>
              </ul>
            </section>

            <section className="pk-group pk-not">
              <h2>{t.notBuilt}</h2>
              <p>{t.notBuiltLead}</p>
              <ul>{NOT_BUILT[lang].map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          </div>

          <aside className="pk-side" aria-label={t.yourPackage}>
            <div className="pk-box">
              <p className="pk-eyebrow">{t.yourPackage}</p>
              {offer ? (
                <>
                  <h2>{name}</h2>
                  {offer.price ? (
                    <p className="pk-price"><strong>{euro(offer.price, lang)}</strong> {t.build}<br />+ {euro(offer.monthly, lang)} {t.monthly}</p>
                  ) : (
                    <p className="pk-price">{t.quote}</p>
                  )}
                  <p className="pk-why"><b>{t.because}:</b> {drivers.map((d) => d[lang][0]).join(', ') || (callSms ? t.callSms : t.custom)}</p>
                </>
              ) : (
                <p className="pk-why">{t.becauseNone}</p>
              )}
              <p className="pk-vat">{t.vat}</p>
            </div>

            <div className="pk-box">
              <p className="pk-eyebrow">{t.addons}</p>
              <ul className="pk-addons">
                {lines.map((l) => (
                  <li key={l.a.id}>
                    <span>{l.a[lang]} <small>{euro(l.a.price, lang)}{l.a.each ? ` ${t.each}` : ''}</small></span>
                    {l.included ? <em>{t.included}</em> : l.a.each ? (
                      <span className="pk-step">
                        <button type="button" aria-label="-" onClick={() => setCount(l.a.id, l.n - 1)}>-</button>
                        <output>{l.n}</output>
                        <button type="button" aria-label="+" onClick={() => setCount(l.a.id, l.n + 1)}>+</button>
                      </span>
                    ) : (
                      <input type="checkbox" aria-label={l.a[lang]} checked={l.n === 1} onChange={(e) => setCount(l.a.id, e.target.checked ? 1 : 0)} />
                    )}
                  </li>
                ))}
              </ul>
              {total && <p className="pk-total">{t.total}: <strong>{euro(total, lang)}</strong><br /><small>{t.totalNote}</small></p>}
            </div>

            <form className="pk-box pk-form" onSubmit={(e) => e.preventDefault()}>
              <p className="pk-eyebrow">{t.info}</p>
              {[['name', t.name, 'text'], ['business', t.business, 'text'], ['phone', t.phone, 'tel']].map(([k, label, type]) => (
                <label key={k}>{label}<input type={type} value={form[k]} onChange={field(k)} maxLength={80} autoComplete={k === 'name' ? 'name' : k === 'phone' ? 'tel' : 'off'} /></label>
              ))}
              {[['about', t.about], ['colors', t.colors], ['domain', t.domain], ['notes', t.notes]].map(([k, label]) => (
                <label key={k}>{label}<textarea rows="2" value={form[k]} onChange={field(k)} maxLength={400} /></label>
              ))}
              <div className="pk-actions">
                {ready ? <a className="pk-btn pk-btn--primary" href={smsHref}>{t.send}</a> : <button type="button" className="pk-btn pk-btn--primary" disabled>{t.send}</button>}
                <button type="button" className="pk-btn" onClick={copyText}>{t.copyBtn}</button>
                <a className="pk-btn" href={TEL}>{t.callBtn} {PHONE}</a>
              </div>
              {!ready && <p className="pk-vat">{t.need}</p>}
              {note && <p className="pk-vat" role="status">{note}</p>}
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
