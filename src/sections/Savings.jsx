import { useMemo, useState } from 'react';
import { savings, pricing, links } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Savings.css';

const STEPS = [100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000, 15000, 25000, 50000];
const eur = (n) => `€${Math.round(n).toLocaleString('en-US')}`;
const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

// Pick the plan from the visitor's monthly AI spend.
// Rough guide: ~1k requests per €10 of AI spend, matched to plan limits.
const planFor = (spend) => {
  const [starter, pro, team, business] = pricing.tiers;
  if (spend <= 100) return { tier: starter, monthly: 0 };
  if (spend <= 2500) return { tier: pro, monthly: 49 };
  if (spend <= 25000) return { tier: team, monthly: 299 };
  return { tier: business, monthly: null };
};

// Interactive estimate: exposure without a cap vs. the worst day with Shield.
export default function Savings({ id }) {
  const [i, setI] = useState(4);
  const spend = STEPS[i];

  const m = useMemo(() => {
    const daily = spend / 30;
    const cap = Math.max(10, Math.round((daily * savings.capFactor) / 10) * 10);
    const night = savings.worstPerDayUsd / 3; // one 8-hour night
    const plan = planFor(spend);
    const perMinute = savings.worstPerDayUsd / 1440;
    const payback = plan.monthly ? Math.max(1, Math.ceil(plan.monthly / perMinute)) : null;
    return { cap, night, plan, payback };
  }, [spend]);

  return (
    <section id={id} className="section savings">
      <div className="container">
        <SectionHeading index={savings.index} label={savings.label} title={savings.title}>
          {savings.body}
        </SectionHeading>

        <Reveal className="savings__card" delay={80}>
          <div className="savings__input">
            <label htmlFor="spend" className="mono">Your monthly AI bill</label>
            <output htmlFor="spend" className="savings__spend">{eur(spend)}{spend === 50000 ? '+' : ''}</output>
            <input
              id="spend"
              type="range"
              min="0"
              max={STEPS.length - 1}
              step="1"
              value={i}
              onChange={(e) => setI(Number(e.target.value))}
              aria-valuetext={eur(spend)}
              style={{ '--p': `${(i / (STEPS.length - 1)) * 100}%` }}
            />
            <div className="savings__scale mono" aria-hidden="true">
              <span>€100</span>
              <span>€50k+</span>
            </div>
          </div>

          <dl className="savings__grid">
            <div className="savings__cell savings__cell--risk">
              <dt>One leaked key, one night, no cap</dt>
              <dd>{usd(m.night)}</dd>
              <p>Eight hours at the worst-case rate attackers can burn.</p>
            </div>
            <div className="savings__cell savings__cell--safe">
              <dt>Your worst day with Shield</dt>
              <dd>{eur(m.cap)}</dd>
              <p>A daily cap at 150% of your average day. Past it, traffic stops.</p>
            </div>
            <div className="savings__cell">
              <dt>Your plan</dt>
              <dd>
                {m.plan.tier.name}
                <span>{m.plan.monthly === null ? ' · custom' : m.plan.monthly === 0 ? ' · free' : ` · ${eur(m.plan.monthly)}/mo`}</span>
              </dd>
              <p>
                {m.plan.monthly === null
                  ? 'Volume pricing for your traffic. We size it with you.'
                  : m.plan.monthly === 0
                    ? 'Free while your traffic is small. Caps and rate limits included.'
                    : `${eur(m.plan.monthly * 12)} a year, all providers and keys included.`}
              </p>
            </div>
            <div className="savings__cell">
              <dt>Pays for itself if it stops a leak</dt>
              <dd>{m.payback ? `${m.payback} min` : m.plan.monthly === 0 ? 'Day one' : 'One incident'}</dd>
              <p>
                {m.payback
                  ? `That is how long the worst case takes to cost more than a month of ${m.plan.tier.name}.`
                  : m.plan.monthly === 0
                    ? 'There is nothing to pay back on the free plan.'
                    : 'A single stopped incident covers years of the plan.'}
              </p>
            </div>
          </dl>

          <div className="savings__foot">
            <a className="btn btn--primary" href={m.plan.monthly === null ? links.contact : links.getKey}>
              {m.plan.monthly === null ? 'Talk to us' : 'Protect my keys'} <span className="btn__arrow" aria-hidden="true">→</span>
            </a>
            <p className="mono">
              {savings.note}{' '}
              <a href={savings.source.href} target="_blank" rel="noopener noreferrer">{savings.source.label} ↗</a>
            </p>
          </div>
        </Reveal>

        <ul className="savings__ease">
          {savings.ease.map((e, k) => (
            <Reveal as="li" key={e.label} delay={k * 80}>
              <b>{e.value}</b>
              <span>{e.label}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
