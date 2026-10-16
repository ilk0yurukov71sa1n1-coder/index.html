import { pricing, links } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Pricing.css';

export default function Pricing({ id }) {
  return (
    <section id={id} className="section pricing">
      <div className="container">
        <SectionHeading index={pricing.index} label={pricing.label} title={pricing.title} />
        <div className="pricing__grid">
          {pricing.tiers.map((t, i) => (
            <Reveal key={t.name} className={`tier ${t.featured ? 'tier--featured' : ''}`} delay={i * 90}>
              <div className="tier__head">
                <h3>{t.name}</h3>
                {t.featured ? <span className="tier__badge mono">Most picked</span> : null}
              </div>
              <p className="tier__blurb">{t.blurb}</p>
              <p className="tier__price">
                {t.price}
                <span>{t.period}</span>
              </p>
              <a href={links.getKey} className={`btn ${t.featured ? 'btn--primary' : 'btn--ghost'}`}>
                {t.cta}
              </a>
              <ul>
                {t.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
        <p className="pricing__note mono">{pricing.note}</p>
      </div>
    </section>
  );
}
