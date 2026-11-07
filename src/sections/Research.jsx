import { research } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Research.css';

// Cited findings from security research, each paired with Shield's answer.
export default function Research({ id }) {
  return (
    <section id={id} className="section research">
      <div className="container">
        <SectionHeading index={research.index} label={research.label} title={research.title}>
          {research.body}
        </SectionHeading>
        <ol className="research__grid">
          {research.items.map((r, i) => (
            <Reveal as="li" key={r.stat} className="study" delay={i * 80}>
              <p className="study__stat">{r.stat}</p>
              <p className="study__text">{r.text}</p>
              <p className="study__answer">
                <span className="mono">Shield</span>
                {r.answer}
              </p>
              <a className="study__source mono" href={r.href} target="_blank" rel="noopener noreferrer">
                {r.source} ↗
              </a>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
