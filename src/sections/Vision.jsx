import { useRef, useState } from 'react';
import { vision } from '../config/site';
import Reveal from '../components/ui/Reveal';
import LazyMount from '../components/ui/LazyMount';
import CrystalizedBall from '../components/reactbits/CrystalizedBall';
import SpecularButton from '../components/reactbits/SpecularButton';
import './Vision.css';

const toAccess = () => document.getElementById('access')?.scrollIntoView({ behavior: 'smooth' });

// Dark band: the Rollcfluence knot held inside the CrystalizedBall,
// next to "This is only the beginning". The ball reacts to the cursor and
// a click shakes it; the knot leans toward the cursor and wobbles with it.
export default function Vision({ id }) {
  const stageRef = useRef(null);
  const [shake, setShake] = useState(0);

  const onMove = e => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--vx', x.toFixed(3));
    el.style.setProperty('--vy', y.toFixed(3));
  };
  const onLeave = () => {
    stageRef.current?.style.setProperty('--vx', '0');
    stageRef.current?.style.setProperty('--vy', '0');
  };

  return (
    <section id={id} className="vision" aria-labelledby="vision-title">
      <div className="container vision__grid">
        <div
          ref={stageRef}
          className="vision__stage"
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onPointerDown={() => setShake(n => n + 1)}
        >
          <LazyMount className="vision__ball">
            <CrystalizedBall
              preset="plasma"
              color="#c23a42"
              size={0.86}
              crackle={0.7}
              fill={0.45}
              glow={0.9}
              motion="rise"
              interactive
              hoverStrength={0.7}
            />
          </LazyMount>
          <div className="vision__logo" aria-hidden="true">
            <img key={shake} className={shake ? 'is-shaking' : ''} src="/media/rc-knot.png" alt="" width="512" height="512" />
          </div>
        </div>

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
          <Reveal as="p" className="vision__hint mono" delay={320}>{vision.hint}</Reveal>
        </div>
      </div>
    </section>
  );
}
