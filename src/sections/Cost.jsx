import { cost } from '../config/site';
import Ferrofluid from '../components/reactbits/Ferrofluid';
import LazyMount from '../components/ui/LazyMount';
import Reveal from '../components/ui/Reveal';
import DodgeField from '../components/reactbits/DodgeField';
import './Cost.css';

const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;

// Dark band: a leaked-key timeline over the Ferrofluid field.
export default function Cost({ id }) {
  return (
    <section id={id} className="cost" aria-labelledby="cost-title">
      <LazyMount className="cost__field" aria-hidden="true">
        <Ferrofluid
          transparent={false}
          color="#150b0b"
          colors={['#f4f1ec', '#b0323a', '#c9a59c']}
          brightness={1.5}
          scale={isSmall ? 1.05 : 1.3}
          spikeHeight={1.15}
          sharpness={2.6}
          tilt={52}
          speed={0.4}
          magnetism={2}
          flowDirection="down"
          mouseInteraction={false}
          clickPulse={false}
          dpr={isSmall ? 1.25 : 1.5}
        />
      </LazyMount>

      <div className="container cost__inner">
        <Reveal className="kicker cost__kicker">
          <span className="kicker__index">{cost.index}</span>
          <span className="kicker__rule" aria-hidden="true" />
          <span>{cost.label}</span>
        </Reveal>
        <Reveal as="h2" className="h2" id="cost-title" delay={80}>{cost.title}</Reveal>
        <Reveal as="p" className="cost__body" delay={140}>{cost.body}</Reveal>

        <ol className="cost__timeline">
          {cost.timeline.map((t, i) => (
            <Reveal as="li" key={t.time} delay={180 + i * 90}>
              <span className="cost__time mono">{t.time}</span>
              <p>{t.text}</p>
            </Reveal>
          ))}
        </ol>

        <div className="cost__bottom">
          <Reveal as="p" className="cost__shield" delay={200}>
            <span className="mono">Shield</span>
            {cost.shield}
          </Reveal>
          <Reveal className="cost__key" delay={260}>
            <p className="cost__key-caption mono">{cost.key.caption}</p>
            <DodgeField
              className="cost__dodge"
              taunts={cost.key.taunts}
              notice={cost.key.notice}
              inkColor="#f4f1ec"
              contrastColor="#4f1012"
              fieldHeight={180}
              reach={84}
              radius={130}
              patience={4}
              wall="bounce"
              disabled
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
