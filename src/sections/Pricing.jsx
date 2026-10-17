import { useMemo, useState } from 'react';
import { pricing, modelCompare, links } from '../config/site';
import { priceFor } from '../../api/_lib/prices.js';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Pricing.css';

// Allowance per plan, in the same order as pricing.tiers. Business has none.
const ALLOWANCE = { starter: 10_000, pro: 200_000, team: 1_250_000, scale: 3_500_000 };
const short = (n) => (n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}k`);
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
          <span className="mono">Requests a month</span>
          <b>{requests.toLocaleString('en-US')}</b>
          <input type="range" min="0" max={modelCompare.volumes.length - 1} step="1" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-valuetext={`${requests} requests a month`} />
          <span className="mc__ticks mono" aria-hidden="true">
            {modelCompare.volumes.map((v) => (
              <i key={v}>{short(v)}</i>
            ))}
          </span>
        </label>
        <div className="mc__sizes" role="radiogroup" aria-label="Request size">
          {modelCompare.sizes.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={size === x.id} className={size === x.id ? 'is-on' : ''} onClick={() => setSize(x.id)}>
              {x.label}
              <span className="mono">
                {x.input.toLocaleString('en-US')} in · {x.output} out tokens
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mc__plan">
        <span className="mono">Shield plan that covers this</span>
        <b>
          {plan.name} · {plan.price}
          {plan.period}
        </b>
        <a href={plan.href ?? links.getKey} className="btn btn--primary">
          {plan.cta}
        </a>
      </div>

      <div className="mc__table" role="region" aria-label="Model comparison" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Input / 1M tokens</th>
              <th>Output / 1M tokens</th>
              <th>Your provider bill / month</th>
              <th>Shield on top</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model}>
                <td>
                  <b>{r.name}</b>
                  <span className="mono">{r.provider === 'openai' ? 'OpenAI' : 'Anthropic'}</span>
                </td>
                <td className="mono">${r.inRate}</td>
                <td className="mono">${r.outRate}</td>
                <td className="mono">{usd(r.bill)}</td>
                <td className="mono">{planEur == null ? 'Custom' : planEur === 0 ? 'Free' : `${plan.price}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

export default function Pricing({ id }) {
  return (
    <section id={id} className="section pricing">
      <div className="container">
        <SectionHeading index={pricing.index} label={pricing.label} title={pricing.title} />
        <div className="pricing__grid">
          {pricing.tiers.map((t, i) => (
            <Reveal key={t.name} className={`tier ${t.featured ? 'tier--featured' : ''}`} delay={i * 80}>
              <div className={`tier__img ${t.imageClass || ''}`}>
                <img src={t.image} alt="" loading="lazy" decoding="async" />
                {t.featured ? <span className="tier__badge mono">Recommended</span> : null}
              </div>
              <div className="tier__body">
                <h3>{t.name}</h3>
                <p className="tier__blurb">{t.blurb}</p>
                <p className="tier__price">
                  {t.price}
                  <span>{t.period}</span>
                </p>
                <p className="tier__hook">{t.hook}</p>
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
          {pricing.note} *{' '}
          <a href={pricing.hookSource.href} target="_blank" rel="noopener noreferrer">
            {pricing.hookSource.label}
          </a>
        </p>
        <ModelCompare />
      </div>
    </section>
  );
}
