import { hero, brand } from '../config/site';
import Ferrofluid from '../components/reactbits/Ferrofluid';
import Reveal from '../components/ui/Reveal';
import './Hero.css';

const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;

export default function Hero({ id }) {
  return (
    <section id={id} className="hero" aria-labelledby="hero-title">
      <div className="hero__field" aria-hidden="true">
        <Ferrofluid
          colors={['#e0245e', '#6b2bd9', '#f3eef2']}
          brightness={1.6}
          scale={isSmall ? 1.05 : 1.3}
          spikeHeight={1.15}
          sharpness={2.6}
          tilt={52}
          speed={0.4}
          magnetism={2}
          flowDirection="down"
          mouseInteraction
          mouseStrength={1.15}
          clickPulse
          dpr={isSmall ? 1.25 : 1.75}
        />
      </div>
      <div className="hero__scrim" aria-hidden="true" />

      <div className="container hero__content">
        <Reveal className="hero__eyebrow mono">
          <span className="hero__dot" aria-hidden="true" />
          {hero.eyebrow}
        </Reveal>

        <h1 id="hero-title" className="hero__title">
          <Reveal as="span" delay={80}>{hero.title[0]}</Reveal>
          <Reveal as="span" delay={160} className="hero__title-muted">{hero.title[1]}</Reveal>
        </h1>

        <Reveal as="p" className="hero__body" delay={240}>{hero.body}</Reveal>

        <Reveal className="hero__ctas" delay={320}>
          <a href={hero.primary.href} className="btn btn--primary">
            {hero.primary.label}
            <span className="btn__arrow" aria-hidden="true">→</span>
          </a>
          <a href={hero.secondary.href} className="btn btn--ghost">{hero.secondary.label}</a>
        </Reveal>

        <Reveal className="hero__endpoint mono" delay={400}>
          <span className="hero__endpoint-label">baseURL</span>
          <code>{brand.gatewayUrl}</code>
        </Reveal>
      </div>

      <div className="hero__bottom">
        <div className="container">
          <p className="hero__hint mono" aria-hidden="true">{hero.hint}</p>
          <dl className="hero__stats">
            {hero.stats.map((s, i) => (
              <Reveal key={s.label} className="hero__stat" delay={480 + i * 60}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
