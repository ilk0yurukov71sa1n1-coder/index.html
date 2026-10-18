import { doors } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Doors.css';

// Two ways in: the local AI service and Shield for agencies.
export default function Doors({ id }) {
  return (
    <section id={id} className="section doors">
      <div className="container">
        <SectionHeading index={doors.index} label={doors.label} title={doors.title}>
          {doors.body}
        </SectionHeading>

        <div className="doors__grid">
          {doors.items.map((d, i) => (
            <Reveal key={d.title} as="article" className={`doors__card${i === 0 ? ' doors__card--local' : ''}`} delay={80 + i * 80}>
              <span className="doors__tag mono">{d.tag}</span>
              <h3>{d.title}</h3>
              <p className="doors__text">{d.text}</p>
              <ul>
                {d.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className="doors__foot">
                <a className={`btn ${i === 0 ? 'btn--primary' : 'btn--ghost'}`} href={d.cta.href}>
                  {d.cta.label} <span className="btn__arrow" aria-hidden="true">→</span>
                </a>
                <span className="doors__note">{d.note}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
