import { story } from '../config/site';
import Reveal from '../components/ui/Reveal';
import './Story.css';

// Why Rollcfluence exists. "What comes next" lives in the Vision band below.
export default function Story({ id }) {
  return (
    <section id={id} className="section story">
      <div className="container story__grid">
        <Reveal className="story__mark">
          <img src="/logo-rc.png" alt="" width="160" height="160" />
          <p className="kicker">
            <span>{story.label}</span>
          </p>
        </Reveal>
        <div>
          <Reveal as="h2" className="story__title" delay={60}>{story.title}</Reveal>
          {story.paragraphs.map((p, i) => (
            <Reveal as="p" key={i} className="story__p" delay={120 + i * 60}>{p}</Reveal>
          ))}
          <Reveal as="p" className="story__sign mono" delay={320}>{story.sign}</Reveal>
        </div>
      </div>
    </section>
  );
}
