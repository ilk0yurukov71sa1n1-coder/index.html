import { features } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Features.css';

// Tracks the pointer so each card's border lights up where you hover.
const onMove = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
};

export default function Features({ id }) {
  return (
    <section id={id} className="section features">
      <div className="container">
        <SectionHeading index={features.index} label={features.label} title={features.title} />
        <div className="features__grid" onPointerMove={onMove}>
          {features.items.map((f, i) => (
            <div key={f.name} className={`feature ${f.size === 'wide' ? 'feature--wide' : ''}`}>
              <Reveal delay={(i % 4) * 70}>
                <span className="feature__n mono">{String(i + 1).padStart(2, '0')}</span>
                <h3>{f.name}</h3>
                <p>{f.text}</p>
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
