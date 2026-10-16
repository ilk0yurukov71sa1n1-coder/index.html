import { useState } from 'react';
import { start, links } from '../config/site';
import SpringCheck from '../components/reactbits/SpringCheck';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Start.css';

// Plain-language setup checklist for people who have never used a gateway.
export default function Start({ id }) {
  const [done, setDone] = useState(() => start.steps.map(() => false));
  const count = done.filter(Boolean).length;
  const toggle = (i) => (on) => setDone((d) => d.map((v, j) => (j === i ? on : v)));

  return (
    <section id={id} className="section start">
      <div className="container">
        <SectionHeading index={start.index} label={start.label} title={start.title}>
          {start.body}
        </SectionHeading>

        <Reveal className="start__list" delay={80}>
          <div className="start__progress mono" aria-live="polite">
            <span className="start__bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${count / start.steps.length})` }} />
            </span>
            {count} {start.progress}
          </div>
          <ol>
            {start.steps.map((s, i) => (
              <li key={s.name} className={done[i] ? 'is-done' : ''}>
                <span className="start__n mono" aria-hidden="true">0{i + 1}</span>
                <div>
                  <SpringCheck
                    label={s.name}
                    checked={done[i]}
                    onChange={toggle(i)}
                    color="#1e1615"
                    fillColor="#7d1d20"
                    checkColor="#fbf9f6"
                    boxSize={26}
                    boxRadius={8}
                    fontSize={19}
                    doneOpacity={0.45}
                  />
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="start__help" delay={120}>
          <p>{start.help}</p>
          <a className="btn btn--primary" href={links.getKey}>
            Join the waitlist <span className="btn__arrow" aria-hidden="true">→</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
