import { hero, brand } from '../config/site';
import DitherVeil from '../components/reactbits/DitherVeil';
import Reveal from '../components/ui/Reveal';
import SpecularButton from '../components/reactbits/SpecularButton';
import './Hero.css';

const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;

export default function Hero({ id }) {
  return (
    <section id={id} className="hero" aria-labelledby="hero-title">
      <div className="container hero__grid">
      <div className="hero__content">
        <Reveal className="hero__eyebrow mono">
          {hero.eyebrow}
        </Reveal>

        <h1 id="hero-title" className="hero__title">
          <Reveal as="span" delay={80}>{hero.title[0]}</Reveal>
          <Reveal as="span" delay={160} className="hero__title-muted">{hero.title[1]}</Reveal>
        </h1>

        <Reveal as="p" className="hero__body" delay={240}>{hero.body}</Reveal>

        <Reveal className="hero__ctas" delay={320}>
          <SpecularButton
            size="md"
            radius={999}
            tint="#7d1d20"
            tintOpacity={1}
            textColor="#fbf9f6"
            lineColor="#ffd9d4"
            baseColor="#4f1012"
            idleIntensity={0.45}
            proximity={280}
            className="hero__cta"
            onClick={() => document.querySelector(hero.primary.href)?.scrollIntoView({ behavior: 'smooth' })}
          >
            {hero.primary.label}
            <span aria-hidden="true">→</span>
          </SpecularButton>
          <a href={hero.secondary.href} className="btn btn--ghost">{hero.secondary.label}</a>
        </Reveal>

        <Reveal className="hero__endpoint mono" delay={400}>
          <span className="hero__endpoint-label">baseURL</span>
          <code>{brand.gatewayUrl}</code>
        </Reveal>
      </div>

        <Reveal className="hero__panel" delay={200}>
          <div className="hero__veil" aria-hidden="true">
            <DitherVeil
              src="/media/rc-glass.jpg"
              fit="cover"
              pattern="floyd"
              pixelSize={2}
              levels={3}
              inkColor="#4f1012"
              paperColor="#f4f1ec"
              contrast={1.35}
              brightness={-0.08}
              revealRadius={isSmall ? 120 : 170}
              softness={0.6}
              linger={1.2}
              rimColor="#b0323a"
              rim={0.4}
              wander
            />
          </div>
          <span className="hero__panel-label mono">{hero.panel.label}</span>
          <div className="hero__panel-card">
            <p className="hero__panel-stat">{hero.panel.stat}</p>
            <p className="hero__panel-text">{hero.panel.text}</p>
            <p className="hero__panel-source mono">{hero.panel.source}</p>
          </div>
        </Reveal>
      </div>

      <div className="hero__bottom">
        <div className="container">
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
