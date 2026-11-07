import { lazy, Suspense, useMemo } from 'react';
import { network } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import LazyMount from '../components/ui/LazyMount';
import './Network.css';

const EdgeGlobe = lazy(() => import('../components/ui/EdgeGlobe'));

export default function Network({ id }) {
  const nodes = useMemo(() => network.regions.map(({ lat, lon }) => ({ lat, lon })), []);
  return (
    <section id={id} className="section network">
      <div className="container network__grid">
        <div>
          <SectionHeading index={network.index} label={network.label} title={network.title}>
            {network.body}
          </SectionHeading>
          <ul className="network__regions mono">
            {network.regions.map((r, i) => (
              <Reveal as="li" key={r.code} delay={i * 40}>
                <span className="network__code">{r.code}</span>
                <span className="network__name">{r.name}</span>
                <span className="network__ms">{r.ms}</span>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal className="network__globe" delay={120}>
          <LazyMount minHeight="100%" className="network__mount">
            <Suspense fallback={null}>
              <EdgeGlobe nodes={nodes} arcs={network.arcs} />
            </Suspense>
          </LazyMount>
          <span className="network__hint mono" aria-hidden="true">{network.hint}</span>
        </Reveal>
      </div>
    </section>
  );
}
