import { market, ui } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Market.css';

// How fast AI is growing, with sources, and who Shield is for.
export default function Market({ id }) {
  return (
    <section id={id} className="section market">
      <div className="container">
        <SectionHeading index={market.index} label={market.label} title={market.title}>
          {market.body}
        </SectionHeading>

        <div className="market__stats">
          {market.stats.map((s, i) => (
            <Reveal key={s.stat} className="market__stat" delay={60 + i * 60}>
              <p className="market__num">{s.stat}</p>
              <p className="market__text">{s.text}</p>
              {s.note ? <p className="market__note">{s.note}</p> : null}
              <a className="market__src mono" href={s.href} target="_blank" rel="noopener noreferrer">
                {s.source} <span aria-hidden="true">↗</span>
              </a>
            </Reveal>
          ))}
        </div>

        <Reveal as="h3" className="market__for-title" delay={80}>{market.forTitle}</Reveal>
        <div className="market__for">
          {market.for.map((f, i) => (
            <Reveal key={f.who} className="market__card" delay={120 + i * 60}>
              <p className="market__who">{f.who}</p>
              <p className="market__price">{f.price}</p>
              <p className="market__card-text">{f.text}</p>
            </Reveal>
          ))}
        </div>
        <Reveal as="p" className="market__fine" delay={200}>
          {market.forNote} <a href="#pricing">{ui.seePlans}</a>
        </Reveal>
      </div>
    </section>
  );
}
