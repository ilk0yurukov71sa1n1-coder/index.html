import { why } from '../config/site';
import SwarmCursor from '../components/reactbits/SwarmCursor';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Why.css';

const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;

// Reasons to start now, with the SwarmCursor flowing behind the cards.
export default function Why({ id }) {
  return (
    <section id={id} className="why">
      <SwarmCursor
        lightMode
        color="#7d1d20"
        accentColor="#b0323a"
        count={isSmall ? 260 : 600}
        size={2.2}
        spread={90}
        swirl={0.55}
        tail={0.5}
        depth={0.6}
        idle="roam"
        clickEffect="burst"
        targets=""
        dpr={isSmall ? 1.25 : 1.5}
      >
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
      </SwarmCursor>
    </section>
  );
}
