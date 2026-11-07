import { lazy, Suspense } from 'react';
import { threats } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import LazyMount from '../components/ui/LazyMount';
import './Threats.css';

const PaperCrumple = lazy(() => import('../components/reactbits/PaperCrumple'));

export default function Threats({ id }) {
  return (
    <section id={id} className="section threats">
      <div className="container threats__grid">
        <div>
          <SectionHeading index={threats.index} label={threats.label} title={threats.title}>
            {threats.body}
          </SectionHeading>

          <ol className="threats__list">
            {threats.items.map((t, i) => (
              <Reveal as="li" key={t.name} delay={i * 80}>
                <span className="threats__n mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{t.name}</h3>
                  <p>{t.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal className="threats__stage" delay={120}>
          <LazyMount minHeight={560}>
            <Suspense fallback={<div className="threats__fallback" />}>
              <PaperCrumple
                src="/media/leaked-env.png"
                alt="A leaked .env file with OpenAI, Anthropic and Gemini keys, stamped LEAKED"
                width={320}
                height={400}
                sceneHeight={560}
                releaseBehavior="creased"
                crumpleAmount={0.9}
                crumpleDuration={0.55}
                releaseDuration={0.45}
                foldCount={7}
                foldSharpness={0.62}
                wrinkleDepth={0.7}
                creaseStrength={0.22}
                paperColor="#efe9df"
                paperTexture={0.08}
                lightAngle={-35}
                shadowOpacity={0.22}
                draggable
                returnToOrigin
              />
            </Suspense>
          </LazyMount>
          <div className="threats__caption">
            <span className="mono">{threats.demo.caption}</span>
            <p>{threats.demo.note}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
