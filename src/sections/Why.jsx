import { why } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Why.css';

// Reasons to start now. No cursor effects on this site.
export default function Why({ id }) {
  return (
    <section id={id} className="why">
      <div className="section container">
        <SectionHeading index={why.index} label={why.label} title={why.title} />
        <ul className="why__grid">
          {why.items.map((item, i) => (
            <Reveal as="li" key={item.name} className="why__card" delay={i * 80}>
              <span className="why__n mono">0{i + 1}</span>
              <h3>{item.name}</h3>
              <p>{item.text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
