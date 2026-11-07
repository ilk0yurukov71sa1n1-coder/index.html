import { trust } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Trust.css';

// Specific reasons to trust Shield with provider keys.
export default function Trust({ id }) {
  return (
    <section id={id} className="section trust">
      <div className="container trust__grid">
        <div>
          <SectionHeading index={trust.index} label={trust.label} title={trust.title} />
          <Reveal delay={160}>
            <a className="trust__link" href={trust.link.href}>
              {trust.link.label} <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </div>
        <ul className="trust__list">
          {trust.items.map((t, i) => (
            <Reveal as="li" key={t.name} delay={i * 80}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <h3>{t.name}</h3>
                <p>{t.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
