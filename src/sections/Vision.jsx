import { vision } from '../config/site';
import Reveal from '../components/ui/Reveal';
import SpecularButton from '../components/reactbits/SpecularButton';
import './Vision.css';

const toAccess = () => document.getElementById('access')?.scrollIntoView({ behavior: 'smooth' });

// Dark band: "This is only the beginning" and the call to join.
export default function Vision({ id }) {
  return (
    <section id={id} className="vision" aria-labelledby="vision-title">
      <div className="container vision__grid">
        <div className="vision__copy">
          <Reveal className="kicker vision__kicker">
            <span>{vision.label}</span>
          </Reveal>
          <Reveal as="h2" className="h2" id="vision-title" delay={60}>{vision.title}</Reveal>
          {vision.big.map((p, i) => (
            <Reveal as="p" key={i} className="vision__p" delay={120 + i * 60}>{p}</Reveal>
          ))}
          <Reveal delay={260}>
            <SpecularButton
              size="md"
              radius={999}
              tint="#7d1d20"
              tintOpacity={1}
              textColor="#fbf9f6"
              lineColor="#ffd9d4"
              baseColor="#4f1012"
              idleIntensity={0.45}
              glow={1}
              proximity={260}
              onClick={toAccess}
            >
              {vision.cta} <span aria-hidden="true">→</span>
            </SpecularButton>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
