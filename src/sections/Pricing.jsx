import { useMemo, useState } from 'react';
import { pricing, modelCompare, links, ui } from '../config/site';
import { priceFor } from '../../api/_lib/prices.js';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import LazyMount from '../components/ui/LazyMount';
import DriftWall from '../components/reactbits/DriftWall';
import './Pricing.css';

// Allowance per plan, in the same order as pricing.tiers. Business has none.
const ALLOWANCE = { starter: 10_000, pro: 200_000, team: 1_250_000, scale: 3_500_000 };
const short = (n) => (n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}k`);
// Per-day figures for the value strip: allowance and price over 30 days, rounded down.
const loc = () => (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
const num = (n) => n.toLocaleString(loc());
const eur = (n) => n.toLocaleString(loc(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const perDay = (t) => {
  const reqs = ALLOWANCE[t.id];
  if (!reqs) return null;
  const n = num(Math.floor(reqs / 30 / (reqs >= 30_000 ? 100 : 10)) * (reqs >= 30_000 ? 100 : 10));
  const price = Number(t.price.replace(/[^\d.]/g, ''));
  if (!price) return pricing.value.dayFree.replace('{n}', n);
  return pricing.value.dayPaid.replace('{eur}', eur(Math.floor((price / 30) * 100) / 100)).replace('{n}', n);
};
const proFacts = () => {
  const pro = pricing.tiers.find((t) => t.id === 'pro');
  const cents = Number(pro.price.replace(/[^\d.]/g, '')) * 100;
  return pricing.value.facts.map((f) =>
    f.replace('{n}', num(Math.floor(ALLOWANCE.pro / 30 / 100) * 100)).replace('{c}', num(Math.floor(ALLOWANCE.pro / cents)))
  );
};

const usd = (n) => (n < 1 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString('en-US')}`);

const planFor = (requests) => {
  const id = Object.keys(ALLOWANCE).find((k) => ALLOWANCE[k] >= requests) || 'business';
  return pricing.tiers.find((t) => t.id === id);
};

function ModelCompare() {
  const [volume, setVolume] = useState(2);
  const [size, setSize] = useState('chat');
  const requests = modelCompare.volumes[volume];
  const s = modelCompare.sizes.find((x) => x.id === size);
  const plan = planFor(requests);
  const planEur = plan.id === 'business' ? null : Number(plan.price.replace('€', ''));

  const rows = useMemo(
    () =>
      modelCompare.models.map(([provider, model, name]) => {
        const [inRate, outRate] = priceFor(provider, model).rate;
        const bill = (requests * (s.input * inRate + s.output * outRate)) / 1e6;
        return { provider, model, name, inRate, outRate, bill };
      }),
    [requests, s]
  );

  return (
    <div className="mc">
      <div className="mc__head">
        <h3>{modelCompare.title}</h3>
        <p>{modelCompare.intro}</p>
      </div>
      <div className="mc__controls">
        <label className="mc__volume">
          <span className="mono">{ui.requestsMonth}</span>
          <b>{requests.toLocaleString('en-US')}</b>
          <input type="range" min="0" max={modelCompare.volumes.length - 1} step="1" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-valuetext={`${requests} requests a month`} />
          <span className="mc__ticks mono" aria-hidden="true">
            {modelCompare.volumes.map((v) => (
              <i key={v}>{short(v)}</i>
            ))}
          </span>
        </label>
        <div className="mc__sizes" role="radiogroup" aria-label={ui.requestSize}>
          {modelCompare.sizes.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={size === x.id} className={size === x.id ? 'is-on' : ''} onClick={() => setSize(x.id)}>
              {x.label}
              <span className="mono">
                {x.input.toLocaleString('en-US')} {ui.tokensInOut.replace('{out}', x.output)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mc__plan">
        <span className="mono">{ui.planCovers}</span>
        <b>
          {plan.name} · {plan.price}
          {plan.period}
        </b>
        <a href={plan.href ?? links.getKey} className="btn btn--primary">
          {plan.cta}
        </a>
      </div>

      <ul className="mc__models" aria-label="Model comparison">
        {rows.map((r) => (
          <li key={r.model} className="mc__model">
            <div className="mc__swatch">
              <img src={`/media/models/${r.model}.jpg`} alt="" loading="lazy" decoding="async" />
              <span className="mono">{r.provider === 'openai' ? 'OpenAI' : 'Anthropic'}</span>
              <b>{r.name}</b>
            </div>
            <dl>
              <div>
                <dt>{ui.inputRate}</dt>
                <dd className="mono">${r.inRate}</dd>
              </div>
              <div>
                <dt>{ui.outputRate}</dt>
                <dd className="mono">${r.outRate}</dd>
              </div>
              <div className="mc__bill">
                <dt>{ui.providerBill}</dt>
                <dd className="mono">{usd(r.bill)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="mc__note mono">
        {modelCompare.note}{' '}
        {modelCompare.sources.map(([label, href], i) => (
          <span key={href}>
            {i ? ' · ' : ''}
            <a href={href} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}

// The opening wall: every plan's and model's silk drifting behind the headline.
const WALL = [
  ...pricing.tiers.map((t) => ({ image: t.image, title: t.name })),
  ...modelCompare.models.map(([, model, name]) => ({ image: `/media/models/${model}.jpg`, title: name })),
];

export default function Pricing({ id }) {
  return (
    <section id={id} className="section pricing">
      <div className="container">
        <div className="pricing__wall">
          <LazyMount className="pricing__drift" margin="200px">
            <DriftWall items={WALL} columns={6} tileWidth={190} tileHeight={124} gap={16} tilt={18} turn={-12} speed={26} parallax={0} lift={48} fade={0.55} dim={0.85} overlayColor="#f4f1ec" />
          </LazyMount>
          <div className="pricing__wallhead">
            <SectionHeading index={pricing.index} label={pricing.label} title={pricing.title} />
          </div>
        </div>
        <div className="pricing__value">
          <div>
            <h3>{pricing.value.title}</h3>
            <p>{pricing.value.body}</p>
          </div>
          <ul>
            {proFacts().map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div className="pricing__grid">
          {pricing.tiers.map((t, i) => (
            <Reveal key={t.name} className={`tier ${t.featured ? 'tier--featured' : ''}`} delay={i * 80}>
              <div className="tier__img">
                <img src={t.image} alt="" loading="lazy" decoding="async" />
                {t.featured ? <span className="tier__badge mono">{ui.recommended}</span> : null}
              </div>
              <div className="tier__body">
                <h3>{t.name}</h3>
                <p className="tier__blurb">{t.blurb}</p>
                <p className="tier__price">
                  {t.price}
                  <span>{t.period}</span>
                </p>
                <p className="tier__hook">{t.hook}</p>
                {perDay(t) ? <p className="tier__day mono">{perDay(t)}</p> : null}
                <a href={t.href ?? links.getKey} className={`btn ${t.featured ? 'btn--primary' : 'btn--ghost'}`}>
                  {t.cta}
                </a>
                <p className="tier__pick">{t.pick}</p>
                <ul>
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="pricing__note mono">
          {pricing.note} {pricing.value.footnote} *{' '}
          <a href={pricing.hookSource.href} target="_blank" rel="noopener noreferrer">
            {pricing.hookSource.label}
          </a>
        </p>
        <ModelCompare />
      </div>
    </section>
  );
}
